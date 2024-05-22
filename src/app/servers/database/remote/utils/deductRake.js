/*jshint node: true */
"use strict";

/* Created by Amrendra 02/08/2016 */

var _ld = require("lodash"),
	_ = require('underscore'),
	async = require('async'),
	stateOfX = require("../../../../../shared/stateOfX"),
	activity = require("../../../../../shared/activity"),
	zmqPublish = require("../../../../../shared/infoPublisher"),
	keyValidator = require("../../../../../shared/keysDictionary"),
	db = require("../../../../../shared/model/dbQuery"),
	adminDb = require("../../../../../shared/model/adminDbQuery"),
	customLibrary = require("../../../../../shared/customLibrary"),
	ObjectID = require("mongodb").ObjectID,
	deductRake = {};
const configConstants = require('../../../../../shared/configConstants');
// Create data for log generation

function serverLog(type, log) {
	var logObject = {};
	logObject.fileName = 'deductRake';
	logObject.serverName = stateOfX.serverType.database;
	// logObject.functionName  = arguments.callee.caller.name.toString();
	logObject.type = type;
	logObject.log = log;
	//   zmqPublish.sendLogMessage(logObject);
	console.log(JSON.stringify(logObject));
}

// round off to nearest integer
function roundOffInt(n) {
	return Math.round(n);
}

// round off to two decimal places
function roundOff(n) {
	return Math.round(n * 100) / 100;
}

function ceilValue(n) {
	return Math.ceil(n);
}

function fixedDecimal(number, precisionValue) {
	let precision = precisionValue ? precisionValue : 4;
	return Number(Number(number).toFixed(precision));
}

// init params as empty or zero
var initializeParams = function (params, cb) {
	serverLog(stateOfX.serverLogType.info, 'In deductRake function initializeParams');
	serverLog(stateOfX.serverLogType.info, 'Rake on table set from dashboard - ' + JSON.stringify(params.table.rake));
	serverLog(stateOfX.serverLogType.info, 'Pot before deducting rake - ' + JSON.stringify(params.data.pot));
	params.rakesToDeduct = [];
	params.rakesFromPlayers = [];
	params.potAmount = 0;
	params.rakeFromTable = 0;
	params.rakeDetails = {};
	params.rakeDetails.rakeDeducted = false;
	params.rakeDetails.playerWins = {};
	cb(null, params);
};

// ### Check if rake should deduct in this game or not
// this function is also used in - rewardMegaPoints
var shouldRakeDeduct = function (params, cb) {
	// cb({success: true, params: params, info: "Not deducting rake for testing purpose!"});
	//  return;

	console.log("in deduct rake shouldRakeDeduct method");
	console.log("in deduct rake shouldRakeDeduct method gameType " + params.table.channelType);
	
	if (params.table.channelType !== stateOfX.gameType.normal) {
		serverLog(stateOfX.serverLogType.info, 'Skipping rake deduct as ' + params.table.channelType + ' game is running on this table.');
		cb({ success: true, params: params, info: "This is not the case where rake should deduct!", isRetry: false, isDisplay: false, channelId: "" });
		return;
	}
	console.log("in deduct rake shouldRakeDeduct method moneyType " + params.table.isRealMoney);
	
	if (!params.table.isRealMoney) {
		serverLog(stateOfX.serverLogType.info, 'Skipping rake deduct as the game is real money - ' + params.table.isRealMoney + ' .');
		cb({ success: true, params: params, info: "This is not the case where rake should deduct!", isRetry: false, isDisplay: false, channelId: "" });
		return;
	}
	console.log("in deduct rake shouldRakeDeduct method round " + params.table.roundName);

	if (params.table.roundName === stateOfX.round.preflop) {
		serverLog(stateOfX.serverLogType.info, 'Skipping rake deduct as gams is over in round - ' + params.table.roundName + '.');
		cb({ success: true, params: params, info: "This is not the case where rake should deduct!", isRetry: false, isDisplay: false, channelId: "" });
		return;
	}

	//  console.error("&&&&&&&&&&&&&&&&&&&&####################%%%%%%%",JSON.stringify(params));
	if (!params.data.rakeShouldDeduct && !!params.data.winnerRanking) {
		var sameWinnerLength = _.where(params.data.winnerRanking, { winnerRank: 1 }).length;
		//  	console.error(params.data.winnerRanking.length,"&&&&&&&&&&&&&&&&&&&&####################%%%%%%%",sameWinnerLength);
		if (params.data.winnerRanking.length == sameWinnerLength) {
			var totalPot = params.table.totalPotForRound;
			var playerTotalBets = 0;
			//	console.error(params.data.winnerRanking.length,"&&&&&&&&&&&&&&&&&&&&####################%%%%%%%",sameWinnerLength);
			for (var i = 0; i < params.data.winnerRanking.length; i++) {
				var player = _.findWhere(params.table.players, { playerId: params.data.winnerRanking[i].playerId });
				if (player) {
					playerTotalBets += player.totalGameBet;
				}
			}
			//console.error(totalPot,"&&&&&&&&&&&&&&&&&&&&####################%%%%%%%",playerTotalBets);
			if (totalPot == playerTotalBets) {
				serverLog(stateOfX.serverLogType.info, 'Skipping rake deduct as chop pot condition met ' + params.table.roundName + '.');
				cb({ success: true, params: params, info: "This is not the case where rake should deduct!", isRetry: false, isDisplay: false, channelId: "" });
				return;
			}
		}
	}
	// if(params.data.decisionParams[0].isRit == false && params.data.decisionParams[0].winners.length == params.data.decisionParams[0].playerCards.length ){
	// 	if(params.data.decisionParams[0].winners.length == params.table.onStartPlayers.length){
	// 	 	serverLog(stateOfX.serverLogType.info, 'Skipping rake deduct as gams is over in round - ' + params.table.roundName + '.');
	//   	cb({success: true, params: params, info: "This is not the case where rake should deduct!", isRetry: false, isDisplay: false, channelId: ""});
	//   	return;
	// 	}else{

	// 	}
	// }

	cb(null, params);
};
deductRake.shouldRakeDeduct = shouldRakeDeduct; // will be exported

// ### Decide the value of rakePercent to be used
var decideRakeDeductValues = function (params, cb) {
	serverLog(stateOfX.serverLogType.info, 'In deductRake function decideRakeDeductValues');
	params.rakePercent = parseInt(configConstants.rakePercent); // btw rakePercent can be decimal value
	if (!!params.table.rake && !!params.table.rake.rakePercentTwo && !!params.table.rake.rakePercentThreeFour && !!params.table.rake.rakePercentMoreThanFive) {
		params.rakePercent = (params.table.onStartPlayers.length === 2) ? params.table.rake.rakePercentTwo : params.rakePercent;
		params.rakePercent = (params.table.onStartPlayers.length === 3 || params.table.onStartPlayers.length === 4) ? params.table.rake.rakePercentThreeFour : params.rakePercent;
		params.rakePercent = (params.table.onStartPlayers.length >= 5) ? params.table.rake.rakePercentMoreThanFive : params.rakePercent;
	} else {
		// keep it like - parseInt(configConstants.rakePercent)
	}
	serverLog(stateOfX.serverLogType.info, 'Rake percent from table set to - ' + params.rakePercent);
	cb(null, params);
};

// ### Calculate rake value generated from table
var calculateRakeValues = function (params, cb) {
	serverLog(stateOfX.serverLogType.info, 'In deductRake function calculateRakeValues');
	params.potAmount = 0;
	for (var i = 0; i < params.data.pot.length; i++) {
		serverLog(stateOfX.serverLogType.info, 'Processing pot to add amount for rake deduction: ' + JSON.stringify(params.data.pot[i]));
		if (!params.data.pot[i].isRefund) {
			params.potAmount = params.potAmount + params.data.pot[i].amount;
		} else {
			serverLog(stateOfX.serverLogType.info, 'Skipping current pot as it might be refund.');
		}
	}
	// _.reduce(_.pluck(params.data.pot, 'amount'), function(memo, num){ return memo + num; },0);
	serverLog(stateOfX.serverLogType.info, 'Total pot value from which rake should deduct - ' + params.potAmount);
	params.rakeFromTable = (params.rakePercent * params.potAmount) / 100;
	// params.rakeFromTable = roundOffInt(params.rakeFromTable);
	params.rakeFromTable = fixedDecimal(params.rakeFromTable, 4);
	serverLog(stateOfX.serverLogType.info, 'Rake to deduct from table set to - ' + params.rakeFromTable);
	cb(null, params);
};

// calculate actual rake-able amount
// total pot minus refund pot
var calculateRakeValuesSingleWinner = function (params, cb) {
	serverLog(stateOfX.serverLogType.info, 'In deductRake function calculateRakeValuesSingleWinner');
	params.potAmount = 0;
	var maxCont = -1, secondMaxCont = -1;
	if (params.table.contributors[0].amount > params.table.contributors[1].amount) {
		secondMaxCont = params.table.contributors[1].amount;
		maxCont = params.table.contributors[0].amount;
	} else {
		secondMaxCont = params.table.contributors[0].amount;
		maxCont = params.table.contributors[1].amount;
	}
	for (var i = 0; i < params.table.contributors.length; i++) {
		params.potAmount += params.table.contributors[i].amount;
		if (i >= 2 && params.table.contributors[i].amount >= maxCont) {
			secondMaxCont = maxCont;
			maxCont = params.table.contributors[i].amount;
		} else if (i >= 2 && params.table.contributors[i].amount >= secondMaxCont) {
			secondMaxCont = params.table.contributors[i].amount;
		}
	}
	params.potAmount -= (maxCont - secondMaxCont);
	// _.reduce(_.pluck(params.data.pot, 'amount'), function(memo, num){ return memo + num; },0);
	serverLog(stateOfX.serverLogType.info, 'Total pot value from which rake should deduct - ' + params.potAmount + 'rakePercent' + params.rakePercent);
	params.rakeFromTable = (params.rakePercent * params.potAmount) / 100;
	params.rakeFromTable = fixedDecimal(params.rakeFromTable, 4);
	// params.rakeFromTable = ceilValue(params.rakeFromTable);
	serverLog(stateOfX.serverLogType.info, 'Rake to deduct from table set to - ' + params.rakeFromTable);
	cb(null, params);
};

// ### Calculate rake to be deducted according to cap
var applyCapOnRake = function (params, cb) {
	serverLog(stateOfX.serverLogType.info, 'In deductRake function applyCapOnRake');
	serverLog(stateOfX.serverLogType.info, 'Total player sitting on table currently - ' + params.table.players.length);
	serverLog(stateOfX.serverLogType.info, 'Total player played for this game - ' + params.table.onStartPlayers.length);
	if (!!params.table.rake) {
		serverLog(stateOfX.serverLogType.info, 'Rake matched from dashboard. - ' + JSON.stringify(params.table.rake));
		var rakeCap = params.rakeFromTable;
		rakeCap = (params.table.onStartPlayers.length === 2) ? params.table.rake.capTwo : rakeCap;
		rakeCap = (params.table.onStartPlayers.length === 3 || params.table.onStartPlayers.length === 4) ? params.table.rake.capThreeFour : rakeCap;
		rakeCap = (params.table.onStartPlayers.length >= 5) ? params.table.rake.capMoreThanFive : rakeCap;
		params.rakeFromTable = (params.rakeFromTable > rakeCap) ? rakeCap : params.rakeFromTable;
	} else {
		serverLog(stateOfX.serverLogType.info, 'Rake didnt matched from dashboard.');
		params.rakeFromTable = (params.rakeFromTable > configConstants.rakeCapValue) ? configConstants.rakeCapValue : params.rakeFromTable;
	}
	serverLog(stateOfX.serverLogType.info, 'Updated rake after cap calculation set to - ' + params.rakeFromTable);
	cb(null, params);
};

// assign winningamount to winners after
var assignWinningAmount = function (winners, winningAmount, cb) {
	for (var i = 0; i < winners.length; i++) {
		var winner = winners[i];
		serverLog(stateOfX.serverLogType.info, 'Processing winner: ' + JSON.stringify(winner));
		winner.winningAmount = winningAmount;
		serverLog(stateOfX.serverLogType.info, 'Winning amount added for this winner: ' + JSON.stringify(winner));
	}
	cb(winners);
	/*
	async.each(winners, function(winner, ecb){
		serverLog(stateOfX.serverLogType.info, 'Processing winner: ' + JSON.stringify(winner));
		winner.winningAmount = winningAmount;
		serverLog(stateOfX.serverLogType.info, 'Winning amount added for this winner: ' + JSON.stringify(winner));
		ecb()
	}, function(err){
		if(err) {
			cb(err);
		} else {
			cb(winners)
		}
	});
	*/
};

// set each pot, each winner winning amount
var setEachPotRake = function (params, cb) {
	serverLog(stateOfX.serverLogType.info, 'In deductRake function setEachPotRake');

	// if(params.rakeFromTable >= 0) {
	// 	cb(null, params);
	// 	return
	// }

	params.rakeDetails = {};
	var totalPotAmount = 0;
	var winningAmount = 0;
	var winningAmountHigh = 0;
	var winningAmountLow = 0;

	serverLog(stateOfX.serverLogType.info, 'Decision params for rake calculation:' + JSON.stringify(params.data.decisionParams));
	//async.each(params.data.decisionParams, function(decisionParam, ecb){
	for (var i = 0; i < params.data.decisionParams.length; i++) {
		serverLog(stateOfX.serverLogType.info, 'Decision params for rake calculation:%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
		var decisionParamTemp = JSON.stringify(params.data.decisionParams[i]);
		var decisionParam = JSON.parse(decisionParamTemp);

		serverLog(stateOfX.serverLogType.info, 'Processing decision params: ' + JSON.stringify(decisionParam));
		totalPotAmount = totalPotAmount + decisionParam.amount;

		// Add winners for calculation
		if (params.table.channelVariation !== stateOfX.channelVariation.omahahilo) {
			params.winners = _.union(params.winners, decisionParam.winners);
		} else {
			if (!!decisionParam.winners.winnerHigh) {
				params.winners = _.union(params.winners, decisionParam.winners.winnerHigh);
				params.winners = _.union(params.winners, decisionParam.winners.winnerLo);
			} else {
				params.winners = _.union(params.winners, decisionParam.winners);
			}
		}

		serverLog(stateOfX.serverLogType.info, 'Setting each pot rake, rake from table: ' + params.rakeFromTable);
		serverLog(stateOfX.serverLogType.info, 'Setting each pot rake, current decision params amount: ' + decisionParam.amount);
		serverLog(stateOfX.serverLogType.info, 'Setting each pot rake, pot amount: ' + params.potAmount);
		serverLog(stateOfX.serverLogType.info, 'Setting each pot rake, total pot amount: ' + params.potAmount);

		if (!decisionParam.isRefund) {
			decisionParam.rake = params.rakeFromTable * ((decisionParam.amount / params.potAmount) < 1 ? (decisionParam.amount / params.potAmount) : 1);
			decisionParam.rake = decisionParam.rake || 0; // In case of table rake 0, values become NAN (preventing here)
			// decisionParam.rake = roundOffInt(decisionParam.rake); // converted to decimal
			decisionParam.rake = fixedDecimal(decisionParam.rake, 4); // converted to decimal
		} else {
			serverLog(stateOfX.serverLogType.info, 'Setting rake 0 for refund pot.');
			decisionParam.rake = 0;
		}

		params.totalPotAmount = fixedDecimal(totalPotAmount, 4);
		params.rakeDetails.totalPotAmount = fixedDecimal(totalPotAmount, 4);
		serverLog(stateOfX.serverLogType.info, 'Rake for current pot/decision param: ' + decisionParam.rake);

		//winning amount of each player on one decisionParam
		if (params.table.channelVariation !== stateOfX.channelVariation.omahahilo) {
			winningAmount = (decisionParam.amount - decisionParam.rake) / decisionParam.winners.length;
		} else {
			if (!!decisionParam.winners.winnerHigh && !!decisionParam.winners.winnerLo) {
				serverLog(stateOfX.serverLogType.info, 'Hi winners for this decision params: ' + decisionParam.winners.winnerHigh.length);
				serverLog(stateOfX.serverLogType.info, 'Lo winners for this decision params: ' + decisionParam.winners.winnerLo.length);
				if (decisionParam.winners.winnerLo.length == 0) {
					winningAmountHigh = (decisionParam.amount - decisionParam.rake) / (decisionParam.winners.winnerHigh.length);
				} else {
					winningAmountHigh = (decisionParam.amount - decisionParam.rake) / (decisionParam.winners.winnerHigh.length * 2);
					winningAmountLow = (decisionParam.amount - decisionParam.rake) / (decisionParam.winners.winnerLo.length * 2);
				}

			} else {
				winningAmount = (decisionParam.amount - decisionParam.rake) / decisionParam.winners.length;
			}
		}

		serverLog(stateOfX.serverLogType.info, 'Winning amount for each players in current decision params: ' + winningAmount);
		serverLog(stateOfX.serverLogType.info, 'Updated decisionParams in setEachPotRake: ' + JSON.stringify(decisionParam));
		// var roundOffWinAmount = (Math.ceil(winningAmount)-winningAmount==0.5 && Math.ceil(winningAmount)%2 != 0) ? Math.floor(winningAmount) : Math.round(winningAmount);
		// var roundOffWinAmount = roundOffInt(winningAmount); // converted to decimal
		var roundOffWinAmount = fixedDecimal(winningAmount, 4);

		// Assign winnign amount to winners
		if (params.table.channelVariation !== stateOfX.channelVariation.omahahilo || !decisionParam.winners.winnerHigh) {
			assignWinningAmount(decisionParam.winners, roundOffWinAmount, function (winners) {
				decisionParam.winners = winners;
				params.data.decisionParams[i] = decisionParam;
				serverLog(stateOfX.serverLogType.info, 'Updated --------------ation - ' + i + JSON.stringify(decisionParam));
				serverLog(stateOfX.serverLogType.info, 'Updated ########## calculation - ' + JSON.stringify(params.data.decisionParams));
				serverLog(stateOfX.serverLogType.info, 'Updated Decision params for rake calculation -!!!!!!!!! ' + JSON.stringify(params.data.decisionParams[i]));
				//i++;

				//ecb();
			});
		} else {

			serverLog(stateOfX.serverLogType.info, 'assignWinningAmount decisionParam: ' + JSON.stringify(decisionParam.winners));
			// var roundOffWinAmountHigh = (Math.ceil(winningAmountHigh)-winningAmountHigh==0.5 && Math.ceil(winningAmountHigh)%2 != 0) ? Math.floor(winningAmountHigh) : Math.round(winningAmountHigh);
			// var roundOffWinAmountHigh = roundOffInt(winningAmountHigh); // converted to decimal
			var roundOffWinAmountHigh = fixedDecimal(winningAmountHigh, 4); // converted to decimal
			// var roundOffWinAmountLow = (Math.ceil(winningAmountLow)-winningAmountLow==0.5 && Math.ceil(winningAmountLow)%2 != 0) ? Math.floor(winningAmountLow) : Math.round(winningAmountLow);
			// var roundOffWinAmountLow = roundOffInt(winningAmountLow); // converted to decimal
			var roundOffWinAmountLow = fixedDecimal(winningAmountLow, 4); // converted to decimal
			assignWinningAmount(decisionParam.winners.winnerHigh, roundOffWinAmountHigh, function (winners) {
				decisionParam.winners.winnerHigh = winners;
				params.data.decisionParams[i] = decisionParam;
				serverLog(stateOfX.serverLogType.info, 'Updated --------------ation - ' + i + JSON.stringify(decisionParam));
				serverLog(stateOfX.serverLogType.info, 'Updated ########## calculation - ' + JSON.stringify(params.data.decisionParams));
				assignWinningAmount(decisionParam.winners.winnerLo, roundOffWinAmountLow, function (winners) {
					decisionParam.winners.winnerLo = winners;
					params.data.decisionParams[i] = decisionParam;
					serverLog(stateOfX.serverLogType.info, 'Updated --------------ation - ' + i + JSON.stringify(decisionParam));
					serverLog(stateOfX.serverLogType.info, 'Updated ########## calculation - ' + JSON.stringify(params.data.decisionParams));
					// i++;
					//ecb();
				});
			});
		}



	}//, function(err) {
	// 	 if(err) {
	// 		 cb(err);
	// 	 } else {

	// 		serverLog(stateOfX.serverLogType.info, 'Updated Decision params for rake calculation - ' + JSON.stringify(params.data.decisionParams));
	cb(null, params);
	// 	 }
	// })
};

// assign totalRake in params
var playerWins = function (params, cb) {
	serverLog(stateOfX.serverLogType.info, 'In deductRake function playerWins');
	serverLog(stateOfX.serverLogType.info, 'In deductRake function playerWins decisionParams'+JSON.stringify(params.data.decisionParams));
	var totalRake = 0;
	_.each(params.data.decisionParams, function (decisionParam) {
		serverLog(stateOfX.serverLogType.info, 'Set of all winners - ' + JSON.stringify(params.winners));
		params.winnersGrouped = _.groupBy(params.winners, 'playerId'); //grouping all wins of each player
		serverLog(stateOfX.serverLogType.info, 'params.winnersGrouped - ' + JSON.stringify(params.winnersGrouped));
		totalRake += decisionParam.rake;
	});
	params.totalRake = totalRake;
	console.log('Total rake to deduct in player Wins method- ' + params.totalRake);
	console.log('Total winnnergrouped in player Wins method- ' + params.winnersGrouped);
	cb(null, params);
};

// handle rake round off
var handleRakeRoundOff = function (params, cb) {
	serverLog(stateOfX.serverLogType.info, 'In deductRake function handleRakeRoundOff');
	var sumOfRoundedWinAmt = 0;
	params.rakeDetails.playerWins = {};
	async.each(params.winnersGrouped, function (winner, ecb) {
		serverLog(stateOfX.serverLogType.info, 'Processing winner in rake roundOff - ' + JSON.stringify(winner));
		//total amount won by each player
		var winamt = 0;
		async.each(winner, function (singleWinner, secb) {
			winamt = winamt + singleWinner.winningAmount;
			secb();
		}, function (err) {
			if (err) {
				ecb(err);
			} else {
				serverLog(stateOfX.serverLogType.info, 'Winnign amount for this winner: ' + winamt);
				//if rake is in multiple of 5 then round to even (to resolve decimal as .5)
				// var roundedWinamt      = (Math.ceil(winamt)-winamt==0.5 && Math.ceil(winamt)%2 != 0) ? Math.floor(winamt) : Math.round(winamt);
				// var roundedWinamt = roundOffInt(winamt); // converted to decimal
				var roundedWinamt = fixedDecimal(winamt, 4);
				serverLog(stateOfX.serverLogType.info, 'Rounded winning amount for this winner: ' + roundedWinamt);
				console.log('Rounded winning amount for this winner: ' + roundedWinamt);
				sumOfRoundedWinAmt = sumOfRoundedWinAmt + roundedWinamt;
				console.log('sum Rounded winning amount for this winner: ' + roundedWinamt);
				var a = roundedWinamt - winamt;//difference to be rounded off
				console.log('a amount for this winner: ' + roundedWinamt + " value of a "+ a);
				params.rakeDetails.playerWins[winner[0].playerId] = roundedWinamt;
				params.totalRake = params.totalRake - a;//difference deducted from total rake
				console.log('total rake amount for this winner: ' + roundedWinamt);
				ecb();
			}
		});
	}, function (err) {
		if (!err) {
			params.rakeDetails.rakeDeducted = true;
			sumOfRoundedWinAmt = sumOfRoundedWinAmt + params.totalRake;
			// params.totalRake = Math.round(params.totalRake);
			params.totalRake = fixedDecimal(params.totalRake, 4);
			// params.rakeDetails.totalRake = Math.round(params.totalRake);
			params.rakeDetails.totalRake = fixedDecimal(params.totalRake, 4);
			params.table.summaryOfAllPlayers["rake"] = params.totalRake;
			console.log("sumofRoundedWinAmt " + sumOfRoundedWinAmt);
			console.log("total rake " + params.totalRake);
			console.log("total rake in rrake details " + params.rakeDetails.totalRake);
			if (fixedDecimal(sumOfRoundedWinAmt, 4) == fixedDecimal(params.totalPotAmount, 4)) {
				serverLog(stateOfX.serverLogType.info, " ==== RAKE ROUNDED OFF SUCCESSFULLY ===");
				cb(null, params);
			} else {
				serverLog(stateOfX.serverLogType.error, " ==== RAKE ROUND OFF FAILED ===");
				// Sending mail if eake round off failed 
				// Digvijay Rathore 20 Dec 2019
				process.emit('forceMail', { title: "for rakeDeduction on Table", data: params });
				// cb({success: false, channelId: params.channelId, info: "==== RAKE ROUND OFF FAILED ==="})
				cb(null, params);
			}
		} else {
			cb(err);
		}
	});
};

var insertRakeInDb = function(rakeObject){
	rakeObject = customLibrary.convertToJson(rakeObject);
	
	adminDb.createRegisterRake(rakeObject, function(err, result) {
		if (err) {
			console.log("error in creating rake in db");
		} else {
			console.log("creating rake in db successfully");
		}
	});
};

// handle register rake
var registerRake = function (params, cb) {
	serverLog(stateOfX.serverLogType.info, 'In deductRake function registerRake');

	for (const i of params.data.decisionParams) {
		let rake = i.winningAmount;
		let totalRake = rake / i.winners.length;

		for (const player of params.table.players) {
			db.findUser({ _id: ObjectID(player.playerId) }, function (err, result) {
				if (!err && result) {
					if (result.isParent === "" && result.isParentUserName === "" && result.sponserId && result.sponserId !== "") {
						insertRakeInDb({
							name: result.userName,
							tableId: params.table.id,
							handId: params.table.handId,
							playerId: player.id,
							potContribution: player.acummulatedContributionForRake,
							rakeAmount: totalRake,
							isBot: null,
							timestamp: moment().toISOString(),
							startTime: params.table.startTime
						});
					} else {
						cb();
					}
				} else {
					cb();
				}
			})
		}
	}

	cb(null, params);
};

// ### Deduct rake on table

deductRake.deductRakeOnTable = function (params, cb) {
	console.trace("not single winner case for rake distribution");
	keyValidator.validateKeySets("Request", "database", "deductRakeOnTable", params, function (validated) {
		if (validated.success) {
			async.waterfall([

				async.apply(initializeParams, params),
				shouldRakeDeduct,
				decideRakeDeductValues,
				calculateRakeValues,
				applyCapOnRake,
				setEachPotRake,
				playerWins,
				handleRakeRoundOff,

			], function (err, params) {
				if (err) {
					// activity.rakeDeducted(err,stateOfX.profile.category.gamePlay,stateOfX.gamePlay.subCategory.info,stateOfX.logType.error);
					activity.rakeDeducted(err, stateOfX.profile.category.game, stateOfX.game.subCategory.rakeDeduct, stateOfX.logType.error);
					cb(err);
				} else {
					// activity.rakeDeducted(params,stateOfX.profile.category.gamePlay,stateOfX.gamePlay.subCategory.info,stateOfX.logType.success);
					activity.rakeDeducted(params, stateOfX.profile.category.game, stateOfX.game.subCategory.rakeDeduct, stateOfX.logType.success);
					serverLog(stateOfX.serverLogType.info, JSON.stringify(params));
					cb({ success: true, params: params });
				}
			});
		} else {
			// activity.rakeDeducted(validated,stateOfX.profile.category.gamePlay,stateOfX.gamePlay.subCategory.info,stateOfX.logType.error);
			activity.rakeDeducted(validated, stateOfX.profile.category.game, stateOfX.game.subCategory.rakeDeduct, stateOfX.logType.error);
			cb(validated);
		}
	});
};

// deduct rake single conpetitor case
deductRake.deductRakeOnTableSingleWinner = function (params, cb) {
	console.trace("single winner case for rake distribution");
	keyValidator.validateKeySets("Request", "database", "deductRakeOnTable", params, function (validated) {
		if (validated.success) {
			async.waterfall([

				async.apply(initializeParams, params),
				shouldRakeDeduct,
				decideRakeDeductValues,
				calculateRakeValuesSingleWinner,
				applyCapOnRake,
				setEachPotRake,
				playerWins,
				handleRakeRoundOff,
				registerRake,

			], function (err, params) {
				if (err) {
					// activity.rakeDeducted(err,stateOfX.profile.category.gamePlay,stateOfX.gamePlay.subCategory.info,stateOfX.logType.error);
					activity.rakeDeducted(err, stateOfX.profile.category.game, stateOfX.game.subCategory.rakeDeduct, stateOfX.logType.error);
					cb(err);
				} else {
					// activity.rakeDeducted(params,stateOfX.profile.category.gamePlay,stateOfX.gamePlay.subCategory.info,stateOfX.logType.success);
					activity.rakeDeducted(params, stateOfX.profile.category.game, stateOfX.game.subCategory.rakeDeduct, stateOfX.logType.success);
					serverLog(stateOfX.serverLogType.info, JSON.stringify(params));
					cb({ success: true, params: params });
				}
			});
		} else {
			// activity.rakeDeducted(validated,stateOfX.profile.category.gamePlay,stateOfX.gamePlay.subCategory.info,stateOfX.logType.error);
			activity.rakeDeducted(validated, stateOfX.profile.category.game, stateOfX.game.subCategory.rakeDeduct, stateOfX.logType.error);
			cb(validated);
		}
	});
};


module.exports = deductRake;
