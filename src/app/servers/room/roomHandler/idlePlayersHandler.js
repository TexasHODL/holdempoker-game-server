// Created by Amrendra 14th Jan 2017

/*jshint node: true */
"use strict";

// Handler to remove idle players on table and also
// not connected with server / internate anymore
//
// ========= REMOVE PLAYER FROM TABLE HANDLER ============

// - Record player activity time on player state change
// - Ping players after a regular interval for their connection
// - If no session found then remove player from table immediately
// - If session available then wait for client ping
// - If client ping recieved then do nothing
// - Otherwise remove plaer from table immediately

var _ 					 = require("underscore"),
		keyValidator = require("../../../../shared/keysDictionary"),
		zmqPublish   = require("../../../../shared/infoPublisher.js"),
		stateOfX     = require("../../../../shared/stateOfX.js"),
		zmqPublish   = require("../../../../shared/infoPublisher.js"),
		db           = require("../../../../shared/model/dbQuery.js"),
		imdb         = require("../../../../shared/model/inMemoryDbQuery.js");
var configMsg         = require("../../../../shared/popupTextManager").falseMessages;
var dbConfigMsg       = require("../../../../shared/popupTextManager").dbQyeryInfo;
var async = require('async');
var pomelo = require('pomelo');
const configConstants = require('../../../../shared/configConstants');


var idlePlayersHandler  = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'idlePlayersHandler';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

// Get all in memory cache tables
// created with current server

var getAllTables = function(params, cb) {
	imdb.getAllTable({"channelType": stateOfX.gameType.normal, 'serverId': params.globalThis.app.get('serverId')}, function(err, tables){
		if(!err && !!tables && tables.length > 0) {
			serverLog(stateOfX.serverLogType.info, 'The tables in cache database are: ' + JSON.stringify(_.pluck(tables, 'channelName')));
			params.tables = tables;
			cb(null, params);
		} else {
			serverLog(stateOfX.serverLogType.info, 'No tables are found in cache database, not cheking validation of idle players! - ' + JSON.stringify(err));
			// cb({success: false, info: 'No tables are found in cache database, not cheking validation of idle players!'});
			cb({success: false, info: dbConfigMsg.DBGETALLTABLESFAIL_IDLEPLAYERSHANDLER, isRetry: false, isDisplay: false, channelId: ""});
		}
	});
};

// // Check if players are available into table
var checkIfPlayersAvailable = function (params, cb) {
	var tablesWithPlayers = [];
	async.each(params.tables, function(table, ecb){
		if(table.players.length == 1 && table.stateInternal == stateOfX.gameState.idle) {
			serverLog(stateOfX.serverLogType.info, 'There are players in table ' + table.channelName + ', players: ' + JSON.stringify(_.pluck(table.players, 'playerName')));
			tablesWithPlayers.push(table);
		} else {
			serverLog(stateOfX.serverLogType.info, 'Skipping table ' + table.channelName + ' as there is no players in this table.');
		}
		ecb();
	}, function(err) {
		if(err) {
			// cb({success: false, info: "Error while checking players on cache table: " + JSON.stringify(err)});
			cb({success: false, info: dbConfigMsg.CHECKIFPLAYERSAVAILABLEFAIL_IDLEPLAYERSHANDLER + JSON.stringify(err), isRetry: false, isDisplay: false, channelId: ""});
		} else {
			params.tables = tablesWithPlayers;
			cb(null, params);
		}
	});
};


// Check if player is PLAYING or not
// Check players last activity
// Take a difference with current time and if it crosses pre-defined allowed idle interval
// Get this player's session
// If no session found then remove player from table immediately

var isPlayerPlaying = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'In function isPlayerPlaying!');
		//cb(null, params);
	if(params.processingPlayer.state == stateOfX.playerState.onBreak ) {
		serverLog(stateOfX.serverLogType.info, 'Player is in playing mode, so skipping removal of this player!');
		cb(null, params);
	} else {
		serverLog(stateOfX.serverLogType.info, 'Player is not in playing mode, considering for removal because of idle time crossed!');
		cb({success: false, info: "Player is in playing mode, so skipping removal of this player!", isRetry: false, isDisplay: false, channelId: ""});
	}
};

// Check if player crossed the idle time limit
var isPlayerCrossedLimit = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'In function isPlayerCrossedLimit!');
	var idleTimeForCurrentPlayer = Number (new Date()) -  (params.processingPlayer.activityRecord.lastActivityTime);
	serverLog(stateOfX.serverLogType.info, 'This player idle time: ' + parseInt(idleTimeForCurrentPlayer/1000));
	if(parseInt(idleTimeForCurrentPlayer/1000) >= parseInt(configConstants.removeIdlePlayersAfter)) {
		serverLog(stateOfX.serverLogType.info, 'Player crossed the idle time limit, remove from the table!');
		cb(null, params);
	} else {
		serverLog(stateOfX.serverLogType.info, 'Player yet not crossed the idle time limit, remove from the table!');
		// cb({success: false, info: "Player still not crossed the idle limit, not removing from table!"});
		cb({success: false, info: configMsg.ISPLAYERCROSSEDLIMITFAIL_IDLEPLAYERSHANDLER, isRetry: false, isDisplay: false, channelId: ""});
	}
};

// get player session setting from frontend server
var getPlayerSession = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'In function getPlayerSession!');
	serverLog(stateOfX.serverLogType.info, 'Going to get session for playerId: ' + params.processingPlayer.playerId);
	db.findUserSessionInDB(params.processingPlayer.playerId, function (err, result) {
		if(err || !result){
			cb('db query failed - findUserSessionInDB'); return;
		}
	params.processingPlayer.serverId = result.serverId;
	pomelo.app.rpc.connector.entryRemote.getUserSession({frontendId: params.processingPlayer.serverId}, {playerId: params.processingPlayer.playerId}, function (sessionExist) {
		serverLog(stateOfX.serverLogType.info, 'Getting player session response: ' + JSON.stringify(sessionExist));
		if(sessionExist.success && !sessionExist.isDisconnectedForce) {
			params.sessionDetails.isSessionExists = true;
			params.sessionDetails.sessionId       = sessionExist.sessionId;
		}
		cb(null, params);
	});
	});
};

// Set this player's session as disconnected forecefully
var setPlayerDisconnected = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'In function setPlayerDisconnected!');
	if(params.sessionDetails.isSessionExists) {
		pomelo.app.rpc.connector.entryRemote.sessionKeyValue({frontendId: params.processingPlayer.serverId}, {playerId: params.processingPlayer.playerId, key: 'isConnected', value: false}, function (valueOfKey) {
		serverLog(stateOfX.serverLogType.info, 'Setting player session key-value: isConnected' + JSON.stringify(valueOfKey));
		cb(null, params);
	});
	}else{
		cb(null, params);
	}
	// 	var currentSession = params.globalThis.app.get('sessionService').getByUid(params.processingPlayer.playerId) ? params.globalThis.app.get('sessionService').getByUid(params.processingPlayer.playerId) : null;
	// 	if(!!currentSession) {
	// 		currentSession[0]["settings"]["isConnected"] = false;
	// 	}
	// 	cb(null, params);
	// } else {
	// 	cb(null, params);
	// }
};

// deprecated
var pingPlayerForConnection = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'In function pingPlayerForConnection!',params);
	if(params.sessionDetails.isSessionExists) {
		var broadcastHandler = require("./broadcastHandler");
		serverLog(stateOfX.serverLogType.info, 'Session exists for this player so going to ping for connection!');
		broadcastHandler.fireAckBroadcastOnLogin({self: {"app": params.globalThis.app}, playerId: params.processingPlayer.playerId, serverId: params.processingPlayer.serverId, data: {}});
	}
	setTimeout(function(){
		cb(null, params);
	}, parseInt(configConstants.isConnectedCheckTime)*1000);
};

// Remove player from the table if idle time limit has been crossed
// var leavePlayer = function(params, cb){
// 	serverLog(stateOfX.serverLogType.info, 'In function leavePlayer!',params)
// 	if(!params.sessionDetails.isSessionExists) {
// 		serverLog(stateOfX.serverLogType.info, 'Leaving this player as session not found in pomelo!')
// 		params.handler.leaveTable({self: {app: null, keepThisApp: false}, playerId: params.processingPlayer.playerId, channelId: params.processingPlayer.channelId, isStandup: true, isRequested: false, playerName: params.processingPlayer.playerName}, {}, function(leaveTableResponse){
// 			serverLog(stateOfX.serverLogType.info, 'leaveTableResponse - ' + JSON.stringify(leaveTableResponse));
// 			cb(null, params);
// 		});
// 	} else {
// 		params.globalThis.app.rpc.connector.entryRemote.sessionKeyValue({frontendId: params.processingPlayer.serverId}, {playerId: params.processingPlayer.playerId, key: 'isConnected'}, function (valueOfKey) {
// 			serverLog(stateOfX.serverLogType.info, 'Getting player session key-value: isConnected' + JSON.stringify(valueOfKey));
// 			serverLog(stateOfX.serverLogType.info, 'Is current player still connected: ' + valueOfKey);
// 			if(valueOfKey.success && !!valueOfKey.value){
// 				serverLog(stateOfX.serverLogType.info, 'The player is connected, so skipping leave from table as idle player!');
// 				cb(null, params);
// 			} else{
// 				serverLog(stateOfX.serverLogType.info, 'Leaving this player as session is no more connected!')
// 				params.handler.leaveTable({self: {app: null, keepThisApp: false}, playerId: params.processingPlayer.playerId, channelId: params.processingPlayer.channelId, isStandup: true, isRequested: false, playerName: params.processingPlayer.playerName}, 'session', function(leaveTableResponse){
// 					serverLog(stateOfX.serverLogType.info, 'leaveTableResponse - ' + JSON.stringify(leaveTableResponse));
// 					// TODO: Kill this player session from pomelo as well
// 					// if(valueOfKey.success){
// 					// 	params.globalThis.app.rpc.connector.entryRemote.killUserSessionByUid({frontendId: params.processingPlayer.serverId}, params.processingPlayer.playerId, function (killUserSessionResponse) {
// 					// 		cb(null, params); return;
// 					// 	});
// 					// }
// 					serverLog(stateOfX.serverLogType.info, 'Session details missing for this player, removing from table!')
// 					cb(null, params);
// 				});
// 			}
// 		});
// 		// var currentSession = params.globalThis.app.get('sessionService').getByUid(params.processingPlayer.playerId) ? params.globalThis.app.get('sessionService').getByUid(params.processingPlayer.playerId) : null;

// 		// if(!!currentSession && currentSession.length > 0) {
// 		// 	if(!currentSession[0]["settings"]["isConnected"]) {

// 		// 	} else {
// 		// 		serverLog(stateOfX.serverLogType.info, 'The player is connected, so skipping leave from table as idle player!');
// 		// 		cb(null, params);
// 		// 	}
// 		// } else {
// 		// 	params.handler.leaveTable({self: {app: null, keepThisApp: false}, playerId: params.processingPlayer.playerId, channelId: params.processingPlayer.channelId, isStandup: false, isRequested: false, playerName: params.processingPlayer.playerName}, {}, function(leaveTableResponse){
// 		// 		serverLog(stateOfX.serverLogType.info, 'leaveTableResponse - ' + JSON.stringify(leaveTableResponse));
// 		// 		cb(null, params);
// 		// 	});
// 		// }
// 	}
// }

// fetch player session object from db
var getPlayerSessionServer = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler in getPlayerSessionServer');
  pomelo.app.rpc.database.dbRemote.findUserSessionInDB('', params.processingPlayer.playerId, function (res) {
    if (res.success) {
      params.processingPlayer.serverId = res.result.serverId;
      cb(null, params);
    } else {
      cb(null, params);
    }
  });
};

// run autoLeave via connector
var getHitLeave = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler in getHitLeave',params);
  if( params.processingPlayer.serverId){
    pomelo.app.rpc.connector.sessionRemote.hitLeave({frontendId:  params.processingPlayer.serverId}, { playerId:  params.processingPlayer.playerId, isStandup: true, channelId:  params.processingPlayer.channelId, isRequested: false, origin: 'idlePlayer'}, function (hitLeaveResponse) {
      serverLog(stateOfX.serverLogType.info, 'response of rpc-hitLeave' + JSON.stringify(hitLeaveResponse));
      cb(null, params);
    });
  } else{
    cb(null, params);
  }
};

// process a player
var processPlayer = function(params, cb) {
	async.waterfall([
		async.apply(isPlayerPlaying, params),
		//isPlayerCrossedLimit,
		getPlayerSession,
		//setPlayerDisconnected,
		//pingPlayerForConnection,
		//getPlayerSessionServer,
		getHitLeave
		//leavePlayer
	], function(err, response){
		if(err) {
			// cb({success: false, info: "Error while processing a player for idle cases! - " + JSON.stringify(err)});
			cb({success: false, info: configMsg.PROCESSPLAYERFAIL_IDLEPLAYERSHANDLER + JSON.stringify(err), isRetry: false, isDisplay: false, channelId: ""});
		} else {
			// cb({success:  true, info: "Player processed successfully!"});
			cb({success:  true, info: configMsg.PROCESSPLAYERTRUE_IDLEPLAYERSHANDLER, isRetry: false, isDisplay: false, channelId: ""});
		}
	});
};

// Start processing player from each inmem table each player

var startProcessingPlayers = function(params, cb) {
	async.eachSeries(params.tables, function(table, ecb) {
		serverLog(stateOfX.serverLogType.info, 'Processing players from cache table: ' + table.channelName + ' for players: ' + JSON.stringify(_.pluck(table.players, 'playerName')));
		async.eachSeries(table.players, function(player, secb){
			serverLog(stateOfX.serverLogType.info, 'Going to start process player: ' + JSON.stringify(player));
			params.processingPlayer = player;
			processPlayer(params, function(processPlayerResponse){
				if(processPlayerResponse.success) {
					secb();
				} else {
					secb();
				}
			});
		}, function(err) {
			if(err) {
				// cb({success: false, info: "PLAYERS: Error while processing players on cache table: " + JSON.stringify(err)});
				cb({success: false, info: configMsg.STARTPROCESSINGPLAYERFAIL_IDLEPLAYERSHANDLER + JSON.stringify(err), isRetry: false, isDisplay: false, channelId: ""});
			} else {
				ecb();
			}
		});
	}, function(err) {
		if(err) {
			cb({success: false, info: "TABLE: Error while processing players on cache table: " + JSON.stringify(err),isRetry: false, isDisplay: false, channelId: ""});
		} else {
			cb(null, params);
		}
	});
};

// run by cron - remove idle sitting players from table
// time and player state dependent
idlePlayersHandler.process = function(params) {
	params.sessionDetails = {
		isSessionExists: false,
		sesisonId: -1
	};
	// setInterval(function(){
		async.waterfall([
			async.apply(getAllTables, params), // get all tables only with current serverId
			checkIfPlayersAvailable,
			startProcessingPlayers
		], function(err, response){
			if(err) {
				serverLog(stateOfX.serverLogType.info, 'Error while performing idle player removal: ' + JSON.stringify(err));
			} else {
				serverLog(stateOfX.serverLogType.info, 'Idle players check performed successfully!');
			}
		});
	// }, parseInt(configConstants.checkIdlePlayerInterval)*1000);
};

module.exports = idlePlayersHandler;
