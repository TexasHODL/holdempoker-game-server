/*jshint node: true */
"use strict";

/* Created by Amrendra 02/08/2016 */

var _ld           = require("lodash"),
    _             = require('underscore'),
		async        = require('async'),
		stateOfX     = require("../../../../../shared/stateOfX"),
		zmqPublish   = require("../../../../../shared/infoPublisher"),
		keyValidator = require("../../../../../shared/keysDictionary"),
		deductRake   = {};
const configConstants = require('../../../../../shared/configConstants');
// Create data for log generation

function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'deductRake';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

var initializeParams = function (params, cb) {
	serverLog(stateOfX.serverLogType.info, 'In deductRake function initializeParams');
	serverLog(stateOfX.serverLogType.info, 'Rake on table set from dashboard - ' + JSON.stringify(params.table.rake));
	serverLog(stateOfX.serverLogType.info, 'Pot before deducting rake - ' + JSON.stringify(params.data.pot));
	params.rakesToDeduct            = [];
	params.rakesFromPlayers         = [];
	params.potAmount                = 0;
	params.rakeFromTable            = 0;
	params.rakeDetails              = {};
	params.rakeDetails.rakeDeducted = false;
	params.rakeDetails.playerWins   = {};
	cb(null, params);
};

// ### Check if rake should deduct in this case or not

var shouldRakeDeduct = function (params, cb) {
	if(params.table.channelType !== stateOfX.gameType.normal) {
    serverLog(stateOfX.serverLogType.info, 'Skipping rake deduct as ' + params.table.channelType + ' game is running on this table.');
    cb({success: true, params: params, info: "This is not the case where rake should deduct!"});
    return;
  }

  if(!params.table.isRealMoney){
    serverLog(stateOfX.serverLogType.info, 'Skipping rake deduct as the game is real money - ' + params.table.isRealMoney + ' .');
    cb({success: true, params: params, info: "This is not the case where rake should deduct!"});
    return;
  }

  if(params.table.roundName === stateOfX.round.preflop) {
    serverLog(stateOfX.serverLogType.info, 'Skipping rake deduct as gams is over in round - ' + params.table.roundName + '.');
    cb({success: true, params: params, info: "This is not the case where rake should deduct!"});
    return;
  }
	cb(null, params);
};


// ### Decide the value of rakePercent to be used
var decideRakeDeductValues = function (params, cb) {
	serverLog(stateOfX.serverLogType.info, 'In deductRake function decideRakeDeductValues');
	params.rakePercent = !!params.table.rake ? params.table.rake.rakePercent : parseInt(configConstants.rakePercent);
	serverLog(stateOfX.serverLogType.info, 'Rake percent from table set to - ' + params.rakePercent);
	cb(null, params);
};

// ### Calculate rake value generated from table
var calculateRakeValues = function (params, cb){
	serverLog(stateOfX.serverLogType.info, 'In deductRake function calculateRakeValues');
	params.potAmount = _.reduce(_.pluck(params.data.pot, 'amount'), function(memo, num){ return memo + num; },0);
	params.rakeFromTable = (params.rakePercent*params.potAmount)/100;
	serverLog(stateOfX.serverLogType.info, 'Rake to deduct from table set to - ' + params.rakeFromTable);
	cb(null,params);
};

// ### Calculate rake to be deducted according to cap
var applyCapOnRake = function(params, cb){
	serverLog(stateOfX.serverLogType.info, 'In deductRake function applyCapOnRake');
	serverLog(stateOfX.serverLogType.info, 'Total player playing currently - ' + params.table.players.length);
	if(!!params.table.rake && !!params.table.rake.capTwo && !!params.table.rake.capThreeFour && !!params.table.rake.capMoreThanFive) {
		serverLog(stateOfX.serverLogType.info, 'Rake matched from dashboard. - ' + JSON.stringify(params.table.rake));
		params.rakeFromTable = (params.table.players.length === 2 && params.rakeFromTable > params.table.rake.capTwo) ? params.table.rake.capTwo : params.rakeFromTable;
		params.rakeFromTable = ((params.table.players.length === 3 || params.table.players.length === 4) && params.rakeFromTable > params.table.rake.capThreeFour) ? params.table.rake.capThreeFour : params.rakeFromTable;
		params.rakeFromTable = (params.table.players.length >= 5 && params.rakeFromTable > params.table.rake.capMoreThanFive) ? params.table.rake.capMoreThanFive : params.rakeFromTable;
	} else {
		serverLog(stateOfX.serverLogType.info, 'Rake didnt matched from dashboard.');
		params.rakeFromTable = (params.table.players.length === 2 && params.rakeFromTable > configConstants.capTwo) ? configConstants.capTwo : params.rakeFromTable;
		params.rakeFromTable = ((params.table.players.length === 3 || params.table.players.length === 4) && params.rakeFromTable > configConstants.capThreeFour) ? configConstants.capThreeFour : params.rakeFromTable;
		params.rakeFromTable = (params.table.players.length >= 5 && params.rakeFromTable > configConstants.capMoreThanFive) ? configConstants.capMoreThanFive : params.rakeFromTable;
	}
	serverLog(stateOfX.serverLogType.info, 'Updated rake after cap calculation set to - ' + params.rakeFromTable);
	cb(null,params);
};

var setEachPotRake = function(params,cb){
	serverLog(stateOfX.serverLogType.info, 'In deductRake function setEachPotRake');
	params.rakeDetails 			= {};
	var totalPotAmount = 0;
	serverLog(stateOfX.serverLogType.info, 'Rake percent set to - ' + params.rakePercent);
	serverLog(stateOfX.serverLogType.info, 'Decision params for rake calculation - ' + JSON.stringify(params.data.decisionParams));
	async.each(params.data.decisionParams, function(decisionParam,ecb){
		totalPotAmount        = totalPotAmount+decisionParam.amount;
		params.winners        = _.union(params.winners, decisionParam.winners);//array of all winners
		decisionParam.rake    = params.rakeFromTable * ((decisionParam.amount/params.potAmount)); //(params.rakePercent*decisionParam.amount)/100;
		serverLog(stateOfX.serverLogType.info, 'decisionParams in setEachPotRake - ' +  JSON.stringify(decisionParam));
		params.totalPotAmount = totalPotAmount;
		params.rakeDetails.totalPotAmount = totalPotAmount;

		//winning amount of each player on one decisionParam
		var winningAmount = (decisionParam.amount - decisionParam.rake)/decisionParam.winners.length;
		_.each(decisionParam.winners, function(winner){
			winner.winningAmount = winningAmount;
		});
		ecb();
	}, function(err) {
		if(err) {
			cb(err);
		} else {
			cb(null, params);
		}
	});
};

var playerWins = function(params, cb){
	serverLog(stateOfX.serverLogType.info, 'In deductRake function playerWins');
	var totalRake = 0;
	_.each(params.data.decisionParams, function(decisionParam){
		params.winnersGrouped = _.groupBy(params.winners,'playerId');//grouping all wins of each player
		serverLog(stateOfX.serverLogType.info, 'params.winnersGrouped - ' + JSON.stringify(params.winnersGrouped));
		totalRake += decisionParam.rake;
	});
	params.totalRake = totalRake;
	serverLog(stateOfX.serverLogType.info, 'Total rake to deduct - ' + params.totalRake);
	cb(null, params);	
};

var handleRakeRoundOff = function(params,cb){
	serverLog(stateOfX.serverLogType.info, 'In deductRake function handleRakeRoundOff');
	var sumOfRoundedWinAmt = 0;
	params.rakeDetails.playerWins = {};
	async.each(params.winnersGrouped, function(winner, ecb){
		serverLog(stateOfX.serverLogType.info, 'winner - ' + JSON.stringify(winner));
		//total amount won by each player
		// var winamt = _.reduce(_.pluck(winner,'winningAmount'), function(memo, num){ return memo + num; }, 0);
		var winamt = 0;
		async.each(winner, function(singleWinner, secb){
			winamt = winamt+singleWinner.winningAmount;
			secb();
		}, function(err){
			if(err) {
				ecb(err);
			} else {
				serverLog(stateOfX.serverLogType.info, 'winamt - ' + winamt);
				//if rake is in multiple of 5 then round to even (to resolve decimal as .5)
				var roundedWinamt      = (Math.ceil(winamt)-winamt==0.5 && Math.ceil(winamt)%2 != 0) ? Math.floor(winamt) : Math.round(winamt);
				serverLog(stateOfX.serverLogType.info, 'roundedWinamt - ' + roundedWinamt);
				sumOfRoundedWinAmt = sumOfRoundedWinAmt + roundedWinamt;
				var a              = roundedWinamt - winamt;//difference to be rounded off
				serverLog(stateOfX.serverLogType.info, winamt+" < Initial =====>  Final >"+roundedWinamt);
				params.rakeDetails.playerWins[winner[0].playerId] = roundedWinamt;
				params.totalRake   = params.totalRake-a;//difference deducted from total rake
				ecb();
			}
		});
	}, function(err){
		if(!err) {
			params.rakeDetails.rakeDeducted = true;
			sumOfRoundedWinAmt = sumOfRoundedWinAmt+params.totalRake;
			params.totalRake   = Math.round(params.totalRake);
			params.rakeDetails.totalRake = Math.round(params.totalRake);
			params.table.summaryOfAllPlayers["rake"] = params.totalRake;
			if(sumOfRoundedWinAmt == params.totalPotAmount){
				serverLog(stateOfX.serverLogType.info, " ==== RAKE ROUNDED OFF SUCCESSFULLY ===");
				cb(null, params);
			} else{
				serverLog(stateOfX.serverLogType.error, " ==== RAKE ROUND OFF FAILED ===");
				// cb({success: false, channelId: params.channelId, info: "==== RAKE ROUND OFF FAILED ==="})
				cb(null, params);
			}
		} else {
			cb(err);
		}
	});
};

// ### Deduct rake on table

deductRake.deductRakeOnTable = function (params, cb){
	keyValidator.validateKeySets("Request", "database", "deductRakeOnTable", params, function(validated){
    if(validated.success) {
			async.waterfall([
				
				async.apply(initializeParams, params),
				shouldRakeDeduct,
				decideRakeDeductValues,
				calculateRakeValues,
				applyCapOnRake,
				setEachPotRake,
				playerWins,
				handleRakeRoundOff,

			],function(err, params){
				if(err) {
						cb(err);
					// if(!!err.success) {
					// 	cb({success: true, params: params});
					// } else {
					// }
				} else {
					serverLog(stateOfX.serverLogType.info, JSON.stringify(params));
					cb({success: true, params: params});
				}
			});
    } else {
    	cb(validated);
    }
  });
};

module.exports = deductRake;