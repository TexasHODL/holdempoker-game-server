/*jshint node: true */
"use strict";

// Created by Sushil on  26/11/2016
// Handles the addOn part in tournaments

var _               = require('underscore'),
  keyValidator      = require("../../../../shared/keysDictionary"),
  imdb              = require("../../../../shared/model/inMemoryDbQuery.js"),
  profileMgmt       = require("../../../../shared/model/profileMgmt.js"),
  stateOfX          = require("../../../../shared/stateOfX.js"),
  db                = require("../../../../shared/model/dbQuery.js"),
  zmqPublish        = require("../../../../shared/infoPublisher.js"),
  broadcastHandler  = require('./broadcastHandler.js'),
  popupTextManager  = require("../../../../shared/popupTextManager"),
  async             = require("async");

var addOnHandler = {};

function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'addOnHandler';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}


/**
 * function to initilizeParams 
 *
 * @method initilizeParams
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var initilizeParams = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, "params is in initilizeParams in addOnHandler " );
	cb(null, params);
};

/**
 * function to initilizeParams 
 *
 * @method initilizeParams
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var getTournamentRoom = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, "params is in getTournamentRoom in addOnHandler " );
	db.getTournamentRoom(params.tournamentId, function(err, result) {
		serverLog(stateOfX.serverLogType.info, "tournamentRoom is in getTournamentRoom in addOnHandler " + JSON.stringify(result));
		if(!!result) {
			serverLog(stateOfX.serverLogType.info,"params.tournament room is " + JSON.stringify(result));
			params.tournamentRoom = result;
			params.gameVersionCount = result.gameVersionCount;
			serverLog(stateOfX.serverLogType.info,"params.tournament room is after assign - " + JSON.stringify(params.tournamentRoom));
			cb(null, params);
		} else {
      		cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBGETTOURNAMENTROOMFAIL_REBUYHANDLER});
		}
	});
};

/**
 * function to getBlindLevel 
 *
 * @method getBlindLevel
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var getBlindLevel = function(params, cb) {
	serverLog(stateOfX.serverLogType.info,"in getBlindLevel in addOnHandler" + JSON.stringify(params.channelId));
	imdb.getTable(params.channelId, function(err, tableResponse) {
		if(err || !tableResponse) {
			cb({success: false, info: "error in getting blind level"});
		} else {
			serverLog(stateOfX.serverLogType.info,"in getTable in addOnHandler" + JSON.stringify(tableResponse));
			if(tableResponse.isOnBreak){
				cb({success: false, info: "Tournament is in break , can't addOn "});
			}else{
				params.blindLevel = tableResponse.blindLevel;
				cb(null,params);
			}
		}
	});
		
};




/**
 * function to  check if isItAddOnTime 
 *
 * @method isItAddOnTime
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var isItAddOnTime = function(params,cb) {
	serverLog(stateOfX.serverLogType.info, "params is in isItAddOnTime in addOnHandler "+ params.blindLevel);
	var addonTimeExist = _.where(params.tournamentRoom.addonTime, {level : params.blindLevel});
	if(!!addonTimeExist && !!addonTimeExist[0]) {
		cb(null,params);
	} else {
		cb({success: false, info: "Something went wrong"});
	}
};


/**
 * function to getTournamentUser
 *
 * @method getTournamentUser
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var getTournamentUser = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, "params is in getTournamentUser in addOnHandler ");
	var filter = {
		tournamentId     : params.tournamentId,
		gameVersionCount : params.gameVersionCount,
		playerId         : params.playerId
	};
	serverLog(stateOfX.serverLogType.info, "filter is in getTournamentUsers in addOnHandler " + JSON.stringify(filter));
	db.findTournamentUser(filter, function(err, tournamentUser) {
		serverLog(stateOfX.serverLogType.info, "tournamentUser is in getTournamentUsers in addOnHandler " + JSON.stringify(tournamentUser));
		if(!!tournamentUser && tournamentUser.length>0) {
			params.tournamentUser = tournamentUser[0];
			cb(null, params);
		} else {
      cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBFINDTOURNAMENTUSERFAIL_REBUYHANDLER});
      //cb({success: false, info: "player is not a part of tournament"});
		}
	});
};


/**
 * function to Check for addon in db in rebuy collection and caculate elligibility
 * @method checkAddOnAlreadyOpt
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var checkAddOnAlreadyOpt = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, "params is in countRebuyAlreadyOpt in addOnHandler " );
	var filter = {
		tournamentId     : params.tournamentId,
		gameVersionCount : params.gameVersionCount,
		playerId         : params.playerId
	};
	db.countRebuyOpt(filter, function(err, rebuy) {
		if(!err) {
			var rebuyCount,addOn,isEligibleForRebuy = false;
			if(!rebuy) {
				rebuyCount = 0;
				addOn      = params.tournamentRoom.addonRule.tournamentChips;
				isEligibleForRebuy = true;
			} else {
				addOn = rebuy.addOn + params.tournamentRoom.addonRule.tournamentChips;
				isEligibleForRebuy = rebuy.isEligibleForRebuy;
				rebuyCount = rebuy.rebuyCount;
			}
			if(isEligibleForRebuy) {
				var query = {
					playerId     		 : params.playerId,
					tournamentId 		 : params.tournamentId,
					gameVersionCount : params.gameVersionCount
				};
				var updatedData = {
					playerId     		 : params.playerId,
					tournamentId 		 : params.tournamentId,
					gameVersionCount : params.gameVersionCount,
					rebuyCount       : rebuyCount,
					addOn            : addOn,
					isEligibleForAddon : false
				};
				db.updateRebuy(query, updatedData, function(err, result) {
					if(!!result) {
						cb(null, params);
					} else {
			      cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBUPDATEREBUY_REBUYHANDLER});
			      //cb({success: false, info: "Error in update rebuy"});
					}
				});
			} else {
				cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: "you are not eligible for rebuy"});
			}
		} else {
			cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: "db Error in getting addon"});
		}
	});
};




/**
 * this function runs only when player is in the game and opt for rebuy
 * @method addChipsInGame
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var addChipsInGame = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, "in add chipsInGame in rebuyHandler");
	//	> You can not use channel in connector server anymore.
	//  var channel = params.self.app.get('channelService').getChannel(params.channelId, false);
  var tempParams = {
  	channelId: params.channelId,
  	playerId: params.playerId,
  	amount: params.tournamentRoom.addonRule.tournamentChips,
  	isRequested: true
  };
  serverLog(stateOfX.serverLogType.info, "tempParams in add chipsInGame in rebuyHandler" + tempParams);
  params.self.app.rpc.database.tableRemote.addChipsOnTableInTournament(params.session, tempParams, function (addChipsOnTableResponse) {
		serverLog(stateOfX.serverLogType.info, "addChipsOnTableResponse is in addChipsInGame - " + JSON.stringify(addChipsOnTableResponse));
  	if(addChipsOnTableResponse.success) {
  		cb(null, params);
  	} else {
  		cb(addChipsOnTableResponse);
  	}
  });
};

/**
 * this function runs only when player is in the game and opt for rebuy
 * @method deductProfileChips
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var deductProfileChips = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, "params is in deductChips in addOnHandler " );
	profileMgmt.deductChips({playerId: params.playerId, chips: params.tournamentRoom.addonRule.mainAccountChips, isRealMoney: params.tournamentRoom.isRealMoney}, function(deductChipsResponse) {
		if(deductChipsResponse.success) {
			cb(null, params);
		} else {
      cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.falseMessages.DEDUCTCHIPSFAIL_REBUYHANDLER});
		}
	});
};


/**
 * this function is for toggling the value of isAutoAddon
 * @method updateAutoAddon
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
addOnHandler.updateAutoAddon = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, "params is in updateAutoAddon in rebuy handler " );
	var tempParams = {       // set the values that need to be updated
		channelId: params.channelId,
		playerId : params.playerId,
		isAutoAddOnEnabled : params.isAutoAddOn
	};
	params.self.app.rpc.database.tableRemote.updateAutoAddon(params.session, tempParams, function (updateAutoAddonResponse) {
		serverLog(stateOfX.serverLogType.info, "updateAutoAddonResponse is in addOnHandler - " + JSON.stringify(updateAutoAddonResponse));
  	if(updateAutoAddonResponse.success) {
  		cb({success: true, channelId:updateAutoAddonResponse.channelId, info: "auto addOn updated successfully",isRetry: false, isDisplay: true});
  	} else {
  		cb(updateAutoAddonResponse);
  	}
  });
};


/**
 * this function is for processing a series of functions in async that have been defined above
 * @method addOn
 * @param  {Object}       params  request json object {tournamentId, playerId,channelId}
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
addOnHandler.addOn = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "params is in rebuy in addOnHandler " );
  async.waterfall([
  	async.apply(initilizeParams, params),
  	getTournamentRoom,
  	getBlindLevel,
  	isItAddOnTime,
  	getTournamentUser,
  	checkAddOnAlreadyOpt,
  	addChipsInGame
  ], function(err,result){
  	if(err) {
  		console.log("in error ",err);
  		cb(err);
  	} else {
      cb({success: true,isRetry: false, isDisplay: true, channelId: "", info: "addon successfully done"});
  	}
  });
};

module.exports = addOnHandler;
