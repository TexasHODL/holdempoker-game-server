/*jshint node: true */
"use strict";

// Created by Sushil on  26/11/2016
// Handles the rebuy part in tournaments

var _               = require('underscore'),
  keyValidator      = require("../../../../shared/keysDictionary"),
  imdb              = require("../../../../shared/model/inMemoryDbQuery.js"),
  profileMgmt       = require("../../../../shared/model/profileMgmt.js"),
  stateOfX          = require("../../../../shared/stateOfX.js"),
  db                = require("../../../../shared/model/dbQuery.js"),
  zmqPublish        = require("../../../../shared/infoPublisher.js"),
  broadcastHandler  = require('./broadcastHandler.js'),
  popupTextManager  = require("../../../../shared/popupTextManager"),
  lateRegistrationHandler  = require('./lateRegistrationHandler.js'),
  tournamentActionHandler = require('./tournamentActionHandler.js'),
  async             = require("async");

var rebuyHandler = {};

function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'rebuyHandler';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

/**
 * this function is used to initilizeParams
 *
 * @method initilizeParams
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var initilizeParams = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, "params is in initilizeParams in rebuy handler " );
	params.userCurrentChips = 0;
	cb(null, params);
};
/**
 * this function is used to getTournamentRoom
 *
 * @method getTournamentRoom
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var getTournamentRoom = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, "params is in getTournamentRoom in rebuy handler " );
	db.getTournamentRoom(params.tournamentId, function(err, result) {
		serverLog(stateOfX.serverLogType.info, "tournamentRoom is in getTournamentRoom in rebuy handler " + JSON.stringify(result));
		if(!!result) {
			serverLog(stateOfX.serverLogType.info,"params.tournament room is +++++++ " + JSON.stringify(result));
			params.tournamentRoom = result;
			params.gameVersionCount = result.gameVersionCount;
			serverLog(stateOfX.serverLogType.info,"params.tournament room is - " + JSON.stringify(params.tournamentRoom));
			cb(null, params);
		} else {
      cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBGETTOURNAMENTROOMFAIL_REBUYHANDLER});
      //cb({success: false, info: "Error in getting room details"});
		}
	});
};
/**
 * this function is used to getTournamentUser
 *
 * @method getTournamentUser
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var getTournamentUser = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, "params is in getTournamentUser in rebuy handler " );
	var filter = {
		tournamentId     : params.tournamentId,
		gameVersionCount : params.gameVersionCount,
		playerId         : params.playerId
	};
	serverLog(stateOfX.serverLogType.info, "filter is in getTournamentUsers in rebuy handler " + JSON.stringify(filter));
	db.findTournamentUser(filter, function(err, tournamentUser) {
		serverLog(stateOfX.serverLogType.info, "tournamentUser is in getTournamentUsers in rebuy handler " + JSON.stringify(tournamentUser));
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
 * this function is used to check if countRebuyAlreadyOpt
 *
 * @method getTournamentUser
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var countRebuyAlreadyOpt = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, "params is in countRebuyAlreadyOpt in rebuy handler " );
	var filter = {
		tournamentId     : params.tournamentId,
		gameVersionCount : params.gameVersionCount,
		playerId         : params.playerId
	};
	db.countRebuyOpt(filter, function(err, rebuy) {
		serverLog(stateOfX.serverLogType.info, "rebuy is in countRebuyAlreadyOpt in rebuy handler " +rebuy);
		if(!err) {
			params.rebuyCount = (!!rebuy && !!rebuy.rebuyCount) ? rebuy.rebuyCount : 0;
			cb(null, params);
		} else {
      cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBCOUNTREBUYOPTFAIL_REBUYHANDLER});
		}
	});
};
/**
 * this function is used to getUserCurrentChips
 *
 * @method getUserCurrentChips
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var getUserCurrentChips = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, "params is in getUserCurrentChips in rebuy handler " );
	if(params.tournamentRoom.state === stateOfX.tournamentState.running && params.tournamentUser.isActive) {
		imdb.getAllTableByTournamentId({tournamentId: params.tournamentId, gameVersionCount: params.gameVersionCount}, function(err, channels) {
			if(!!channels && channels.length>0) {
				var playerFound = false;
				for(var channelIt=0; channelIt<channels.length; channelIt++) {
					var player = _.where(channels[channelIt].players, {"playerId": params.playerId})[0];
					serverLog(stateOfX.serverLogType.info, "player is in channel is in getUserCurrentChips - " + JSON.stringify(player));
					if(!!player) {
						playerFound = true;
						params.channelId = channels[channelIt].channelId;
						params.userCurrentChips = player.chips;
						break;
					}
				}
				cb(null, params);
			} else {
        cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBGETALLTOURNAMENTBYTOURNAMENTIDGETUSERCHIPS_REBUYHANDLER});
        //cb({success: false, info: "Error in getting user current chips in game"});
			}
		});
	} else {
		cb(null, params);
	}
};
/**
 * this function is used to isEligibleForRebuy
 *
 * @method isEligibleForRebuy
 * @param  {Object}       params  request json object
 */
var isEligibleForRebuy = function(params) {
	serverLog(stateOfX.serverLogType.info, "params is in isEligibleForRebuy in rebuy handler " );
	serverLog(stateOfX.serverLogType.info,'in isEligibleForRebuy - ' + JSON.stringify(params.tournamentRoom));
	var rebuyTime = params.tournamentRoom.tournamentStartTime + params.tournamentRoom.rebuyTime*60000;
	var currentTime = Number(new Date());
	serverLog(stateOfX.serverLogType.info, "rebuy and currentTime is in isEligibleForRebuy is - " + rebuyTime + "  " + currentTime + " "+params.rebuyCount );
	serverLog(stateOfX.serverLogType.info, "user current chips is in isEligibleForRebuy is - " + params.userCurrentChips );
	
	if(params.tournamentRoom.state === stateOfX.tournamentState.running && params.rebuyCount < params.tournamentRoom.numberOfRebuy && params.userCurrentChips < params.tournamentRoom.rebuyMaxLimitForChips && rebuyTime>currentTime) {
		serverLog(stateOfX.serverLogType.info, "state is running and rebuyCount <  in isEligibleForRebuy");
		return {success: true};
	} else {
		serverLog(stateOfX.serverLogType.info, "player is not eligible for rebuy in isEligibleForRebuy");
		return {success: false};
	}
};

/**
 * this function is used to addChipsInGame
 *
 * @method addChipsInGame
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var addChipsInGame = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, "in add chipsInGame in rebuyHandler");
	// > You can not use channel in connector server anymore.
	// var channel = params.self.app.get('channelService').getChannel(params.channelId, false);
  var tempParams = {
  	channelId: params.channelId,
  	playerId: params.playerId,
  	chips: params.tournamentRoom.noOfChipsAtGameStart,
  	amount: params.tournamentRoom.buyIn,
  	isRequested: true
  };
  params.self.app.rpc.database.tableRemote.addChipsOnTableInTournament(params.session, tempParams, function (addChipsOnTableResponse) {
		serverLog(stateOfX.serverLogType.info, "addChipsOnTableResponse is in addChipsInGame - " + JSON.stringify(addChipsOnTableResponse));
  	if(addChipsOnTableResponse.success) {
  		cb(null, params);
  	} else {
  		cb(addChipsOnTableResponse);
  	}
  });
};

// this function runs only when player is eliminated and opt for rebuy
// var joinRebuyPlayer = function(params, cb) {
// 	serverLog(stateOfX.serverLogType.info, "params is in joinRebuyPlayer in rebuy handler");
// 	if(params.case === 3) {
// 		lateRegistrationHandler.process({self: params.self, session: params.session, playerId: params.playerId, tournamentId: params.tournamentId, gameVersionCount: params.tournamentRoom.gameVersionCount,rebuy: true}, function(lateRegistrationResponse) {
//       serverLog(stateOfX.serverLogType.info, "response of lateRegistrationHandler is in joinRebuyPlayer in rebuy handler");
//       if(lateRegistrationResponse.success) {
//       	cb(null, params);
//       } else {
// 				cb(lateRegistrationResponse);
//       }
//     })
// 	} else {
// 		cb(null, params);
// 	}
// }


/**
 * this function runs only when game not start but player opt for rebuy
 *
 * @method deductChips
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var deductChips = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, "params is in deductChips in rebuy handler " );
	profileMgmt.deductChips({playerId: params.playerId, chips: params.tournamentRoom.noOfChipsAtGameStart, isRealMoney: params.tournamentRoom.isRealMoney}, function(deductChipsResponse) {
		if(deductChipsResponse.success) {
			cb(null, params);
		} else {
      cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.falseMessages.DEDUCTCHIPSFAIL_REBUYHANDLER});
		}
	});
};


/**
 * this function will update rebuy count or ceate new one
 *
 * @method updateRebuyCount
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var updateRebuyCount = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, "params is in updateRebuyCount in rebuy handler " + params.rebuyCount);
	var query = {
		playerId     		 : params.playerId,
		tournamentId 		 : params.tournamentId,
		gameVersionCount : params.tournamentRoom.gameVersionCount
	};
	var updatedData = {
		playerId     		 : params.playerId,
		tournamentId 		 : params.tournamentId,
		gameVersionCount : params.tournamentRoom.gameVersionCount,
		rebuyCount       : params.rebuyCount + 1,
		addOn            : 0,
		isEligibleForAddon : false
	};
	db.updateRebuy(query, updatedData, function(err, result) {
		if(!!result) {
			cb(null, params);
		} else {
      cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBUPDATEREBUY_REBUYHANDLER});
		}
	});
};
/**
 * this function will performRebuy
 *
 * @method performRebuy
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var performRebuy = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, "params is in performRebuy in rebuy handler " );
	async.waterfall([
		async.apply(addChipsInGame, params),
		updateRebuyCount,
	], function(err, result) {
		if(err) {
			cb(err);
		} else {
			cb({success: true});
		}
	});
};
/**
 * this function is for rebuyProcess
 *
 * @method rebuyProcess
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var rebuyProcess = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, "params is in rebuyProcess in rebuy handler " );
	serverLog(stateOfX.serverLogType.info,"rebuy process - " + JSON.stringify(params.tournamentRoom));
	var eligibleForRebuy = isEligibleForRebuy(params);
	if(eligibleForRebuy.success) {
		performRebuy(params, function(performRebuyResponse) {
			serverLog(stateOfX.serverLogType.info, "response fom performRebuyResponse - " + JSON.stringify(performRebuyResponse));
			if(performRebuyResponse.success) {
				cb(null, performRebuyResponse);
			}	else {
    		cb(performRebuyResponse);
			}
		});
	} else {
		cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.falseMessages.REBUYPROCESSFAIL_REBUYHANDLER});
			}
		};

/**
 * this function contains a series of functions in waterfall to be executed
 *
 * @method rebuy
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
rebuyHandler.rebuy = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "params is in rebuy in rebuy handler " );
  async.waterfall([
  	async.apply(initilizeParams, params),
  	getTournamentRoom,
  	getTournamentUser,
  	countRebuyAlreadyOpt,
  	getUserCurrentChips,
  	rebuyProcess
  ], function(err,result){
  	if(err) {
  		cb(err);
  	} else {
      cb({success: true,isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.falseMessages.REBUY_TRUE_REBUYHANDLER});
  	}
  });
};


/**
 *  this function update rebuy count or ceate new one
 *
 * @method rebuyProcess
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var updateDoubleRebuyCount = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, "params is in updateRebuyCount in rebuy handler " + params.rebuyCount);
	var query = {
		playerId     		 : params.playerId,
		tournamentId 		 : params.tournamentId,
		gameVersionCount : params.tournamentRoom.gameVersionCount
	};
	var updatedData = {
		playerId     		 : params.playerId,
		tournamentId 		 : params.tournamentId,
		gameVersionCount : params.tournamentRoom.gameVersionCount,
		rebuyCount       : params.rebuyCount + 2,
		addOn            : 0,
		isEligibleForAddon : false
	};
	db.updateRebuy(query, updatedData, function(err, result) {
		if(!!result) {
			cb(null, params);
		} else {
      cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBUPDATEREBUY_REBUYHANDLER});
		}
	});
};


/**
 * this function runs only when player is in the game and opt for rebuy
 *
 * @method rebuyProcess
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var addChipsInGameForDoubleRebuy = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, "in add chipsInGame in rebuyHandler");
	// > You can not use channel in connector server anymore.
	// var channel = params.self.app.get('channelService').getChannel(params.channelId, false);
  var tempParams = {
  	channelId: params.channelId,
  	playerId: params.playerId,
  	chips: params.tournamentRoom.noOfChipsAtGameStart*2,
  	amount: params.tournamentRoom.buyIn*2,
  	isRequested: true
  };
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
 *  this function is used to performDoubleRebuy.
 *
 * @method performDoubleRebuy
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var performDoubleRebuy = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, "params is in performRebuy in rebuy handler " );
	async.waterfall([
		async.apply(addChipsInGameForDoubleRebuy, params),
		updateDoubleRebuyCount,
	], function(err, result) {
		if(err) {
			cb(err);
		} else {
			cb({success: true});
		}
	});
};

/**
 *  this function is used to check if isEligibleForDoubleRebuy.
 *
 * @method isEligibleForDoubleRebuy
 * @param  {Object}       params  request json object
 * @return {Object}               params/validated object
 */
var isEligibleForDoubleRebuy = function(params) {
	serverLog(stateOfX.serverLogType.info, "params is in isEligibleForRebuy in rebuy handler " );
	serverLog(stateOfX.serverLogType.info,'in isEligibleForRebuy - ' + JSON.stringify(params.tournamentRoom));
	var rebuyTime = params.tournamentRoom.tournamentStartTime + params.tournamentRoom.rebuyTime*60000;
	var currentTime = Number(new Date());
	serverLog(stateOfX.serverLogType.info, "rebuy and currentTime is in isEligibleForRebuy is - " + rebuyTime + "  " + currentTime);
	if(params.tournamentRoom.state === stateOfX.tournamentState.running && (params.rebuyCount+1) < params.tournamentRoom.numberOfRebuy && params.userCurrentChips < params.tournamentRoom.rebuyMaxLimitForChips && rebuyTime>currentTime) {
		serverLog(stateOfX.serverLogType.info, "state is running and rebuyCount <  in isEligibleForRebuy");
		return {success: true};
	} else {
		serverLog(stateOfX.serverLogType.info, "player is not eligible for rebuy in isEligibleForRebuy");
		return {success: false};
	}
};

/**
 *  this function is used for doubleRebuyProcess.
 *
 * @method doubleRebuyProcess
 * @param  {Object}       params  request json object
 * @return {Object}               params/validated object
 */
var doubleRebuyProcess = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, "params is in rebuyProcess in rebuy handler " );
	serverLog(stateOfX.serverLogType.info,"rebuy process - " + JSON.stringify(params.tournamentRoom));
	var eligibleForRebuy = isEligibleForDoubleRebuy(params);
	if(eligibleForRebuy.success) {
		performDoubleRebuy(params, function(performRebuyResponse) {
			serverLog(stateOfX.serverLogType.info, "response fom performRebuyResponse - " + JSON.stringify(performRebuyResponse));
			if(performRebuyResponse.success) {
				cb(null, performRebuyResponse);
			}	else {
    		cb(performRebuyResponse);
			}
		});
	} else {
		cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.falseMessages.REBUYPROCESSFAIL_REBUYHANDLER});
	}
};

/**
 *  this function is used for doubleRebuy.
 *
 * @method doubleRebuy
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */

rebuyHandler.doubleRebuy = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "params is in rebuy in rebuy handler " );
  async.waterfall([
  	async.apply(initilizeParams, params),
  	getTournamentRoom,
  	getTournamentUser,
  	countRebuyAlreadyOpt,
  	getUserCurrentChips,
  	doubleRebuyProcess
  ], function(err,result){
  	if(err) {
  		cb(err);
  	} else {
      		
      cb({success: true,isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.falseMessages.REBUY_TRUE_REBUYHANDLER});
  	}
  });
};

/**
 *  this function is used to updateAutoRebuy.
 *
 * @method doubleRebuy
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
rebuyHandler.updateAutoRebuy = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, "params is in updateAutoRebuy in rebuy handler " );
	var tempParams = {
		channelId: params.channelId,
		playerId : params.playerId,
		isAutoRebuyEnabled : params.isAutoRebuy
	};
	params.self.app.rpc.database.tableRemote.updateAutoRebuy(params.session, tempParams, function (updateAutoRebuyResponse) {
		serverLog(stateOfX.serverLogType.info, "updateAutoRebuyResponse is in addChipsInGame - " + JSON.stringify(updateAutoRebuyResponse));
  	if(updateAutoRebuyResponse.success) {
  		cb({success: true, channelId:updateAutoRebuyResponse.channelId, info: "auto rebuy updated successfully",isRetry: false, isDisplay: true});
  	} else {
  		cb(updateAutoRebuyResponse);
  	}
  });
};

module.exports = rebuyHandler;
