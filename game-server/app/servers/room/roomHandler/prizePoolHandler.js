/*jshint node: true */
"use strict";

// Created by Nishant on 11/05/2017
// This file handles the Prize Pool part of tournament

var async 			        = require('async'),
		_                   = require("underscore"),
  //   broadcastHandler    = require("./broadcastHandler"),
		// startGameHandler    = require("./startGameHandler"),
		actionLogger        = require("./actionLogger"),
		zmqPublish          = require("../../../../shared/infoPublisher.js"),
    db                  = require("../../../../shared/model/dbQuery.js"),
		imdb                = require("../../../../shared/model/inMemoryDbQuery.js"),
    ObjectID     				= require('mongodb').ObjectID,
  	popupTextManager    = require("../../../../shared/popupTextManager"),
		stateOfX            = require("../../../../shared/stateOfX");


var prizePoolHandler = {};

function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'prizePoolHandler';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

/**
 * [get tournament rooms from give tournament ID]
 * @param  {[type]}   params [description]
 * @param  {Function} cb     callback to next function
 * @return {[callback]}          
 */
var getTournamentRooms = function(params, cb){
  serverLog(stateOfX.serverLogType.info,"params is in getTournamentRooms is - " + JSON.stringify(params));
  if(!!params.tournamentId && !!params.gameVersionCount){
  	//dbquery to find tournament room according to tournamentId and gameVersionCount
    db.findTournamentRoom({_id: ObjectID(params.tournamentId), gameVersionCount: params.gameVersionCount }, function(err, result){
  		if(!err && result && result.length > 0){
  			params.tournamentRoomData = result[0];
  			cb(null, params);
  		}
  		else{
  			cb({ success: false, tournamentId: (params.tournamentId || ""), info: popupTextManager.dbQyeryInfo.DBGETTOURNAMENTROOM_FINDTOURNAMENTROOM_TOURNAMENT});
  		}
	
  	});

  }
  else{
		cb({ success: false, tournamentId: (params.tournamentId || ""), info: popupTextManager.dbQyeryInfo.DB_GETTOURNAMENTROOM_TOURNAMENTID});

  }

};

/**
 * [this function checks whether GTD is enabled in the tournament room]
 * @param  {object}   params [contains tournamentId, gameVersionCount, and tournament room details from previous function]
 * @param  {Function} cb     [callback to next function]
 * @return {[callback]}         
 */
var isEnabledGTD = function(params, cb){
  serverLog(stateOfX.serverLogType.info,"params is in isEnabledGTD is - " + JSON.stringify(params));
  if(params.tournamentRoomData.isGtdEnabled && params.tournamentRoomData.gtdAmount){
  	params.isGtdEnabled = params.tournamentRoomData.isGtdEnabled;
  	params.gtdAmount = params.tournamentRoomData.gtdAmount;
  	cb(null, params);
  	
  }
  else{
  	cb(null, params);
  }

};

/**
 * [this function checks whether late registration or rebuy is enabled in the current tournament]
 * @param  {object}   params [contains tournamentId, gameVersionCount, (isGtdEnabled & gtdAmount, if these fields exist),  and tournament room details from previous function]
 * @param  {Function} cb     [callback to next function]
 * @return {[callback]}         
 */
var isEnabledLateRegistrationOrRebuy = function(params, cb){
  serverLog(stateOfX.serverLogType.info,"params is in isEnabledLateRegistrationOrRebuy is - " + JSON.stringify(params));
	if(params.isGtdEnabled && params.gtdAmount){
		if(params.tournamentRoomData.isLateRegistrationOpened || params.tournamentRoomData.isRebuyOpened){
			params.prizePool = params.gtdAmount;
  		cb(null, params);
		}
  }
	cb(null, params);  

};

/**
 * [this function finds the total tournament users count]
 * @param  {object}   params [contains tournamentId, gameVersionCount, (isGtdEnabled & gtdAmount, if these fields exist), prizePool (if already calculated) and tournament room details from previous function]
 * @param  {Function} cb     [callback to next function]
 * @return {[callback]}          
 */
var calculateTournamentUsers = function(params, cb){
  serverLog(stateOfX.serverLogType.info,"params is in calculateTournamentUsers is - " + JSON.stringify(params));
	if(!params.prizePool){
//dbquery to find tournament users count
		db.countTournamentusers({tournamentId: params.tournamentId.toString(), gameVersionCount: params.gameVersionCount}, function(err, count) {
	    serverLog(stateOfX.serverLogType.info, "result is in calculateTournamentUsers  is - " + JSON.stringify(count));
	    if(!err && count >= 0) {
  			serverLog(stateOfX.serverLogType.info,"params is in db.calculateTournamentUsers is - " + JSON.stringify(count));
	    	params.usersCount = count;
	    	cb(null, params);
	    } 
	
	    else {
	      serverLog(stateOfX.serverLogType.info, "error in getting tournament users in getEnrolledPlayersInTounaments: " + JSON.stringify(err));
	  		cb({ success: false, tournamentId: (params.tournamentId || ""), info: popupTextManager.dbQyeryInfo.DB_GETTOURNAMENTROOM_GETTOURNAMENTUSERS});
	    }
	  });

	}
	else{
	  cb(null, params);
	}

};


/**
 * [this function calculates the rebuy count and add On]
 * @param  {object}   params [contains tournamentId, gameVersionCount, (isGtdEnabled & gtdAmount, if these fields exist), prizePool (if already calculated), tournament users count and tournament room details from previous function]
 * @param  {Function} cb     [callback to next function]
 * @return {[callback]}          
 */
var calculateRebuyAndAddOn = function(params, cb){
  serverLog(stateOfX.serverLogType.info,"params is in calculateRebuyAndAddOn is - " + JSON.stringify(params));
	if(!params.prizePool){
		//dbQuery to find total rebuy and addOn in tournament
		db.findAllRebuy({tournamentId: params.tournamentId.toString(), gameVersionCount: params.gameVersionCount}, function(err, result) {
  	  serverLog(stateOfX.serverLogType.info, "result is in calculateRebuyAndAddOn is - " + JSON.stringify(result));
  	  if(!err && result) {
	  	  params.rebuyCount=0;
	  	  params.addOn=0;
	  	  for(var i in result){
	  	  	var rebuyCount = (result[i].rebuyCount)?result[i].rebuyCount:0;
	  	  	var addOn = (result[i].addOn)?result[i].addOn:0;
	  	  	params.rebuyCount += rebuyCount;
	  	  	params.addOn += addOn;
	  	  }
	  	  cb(null, params);
  	  } 
	
	    else {
  	   	serverLog(stateOfX.serverLogType.info, "error in getting tournament users in getEnrolledPlayersInTounaments: " + JSON.stringify(err));
  			cb({ success: false, tournamentId: (params.tournamentId || ""), info: popupTextManager.dbQyeryInfo.DB_GETTOURNAMENTROOM_GETTOURNAMENTUSERS});
	    }
  	});

	}
	
	else{
		cb(null, params);
	}

};

/**
 * [this function calculates final prize pool based on usersCount, rebuyCount, entryFees, and addOn]
 * @param  {[type]}   params [contains tournamentId, gameVersionCount, (isGtdEnabled & gtdAmount, if these fields exist), prizePool (if already calculated), tournament users count, total rebuy, addOn and tournament room details from previous function]
 * @param  {Function} cb     [callback to next function]
 * @return {[callback]}          
 */
var finalPrizePool = function(params, cb){
  if(!params.prizePool){
  	serverLog(stateOfX.serverLogType.info, "params is in finalPrizePool is - " + JSON.stringify(params));
  	var prizePool = ((params.usersCount + params.rebuyCount)*params.tournamentRoomData.entryfees)+params.addOn;
  	serverLog("prizePool------", prizePool);
  	cb(null, prizePool);
  }
  else
  {
  	serverLog("prizePool------", params.prizePool);
  	cb(null, params);
  }
};


/**
 * calculate prize pool in series of steps
 * @param  {object}   params [contains tournament Id, gameVersionCount]
 * @param  {Function} cb     [callback function]
 * @return {[callback]}          [returns error and result]
 */
prizePoolHandler.calculatePrizePool = function(params, cb){
  serverLog(stateOfX.serverLogType.info, "tournamentId, gameVersionCount is in tournamentActionHandler in prizePool " + params.tournamentId + " ... " + params.gameVersionCount);
  async.waterfall([
  	async.apply(getTournamentRooms, params),
  	isEnabledGTD,
  	isEnabledLateRegistrationOrRebuy,
  	calculateTournamentUsers,
  	calculateRebuyAndAddOn,
  	finalPrizePool
  	], function(err, result){
      console.log("result in prizePool......", result);
  		cb(err, result);
  	
  });


};

module.exports = prizePoolHandler;