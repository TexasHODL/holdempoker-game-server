/*jshint node: true */
"use strict";


// This file is used to handle waiting list players

var _                    = require('underscore'),
    _ld                  = require("lodash"),
    async                = require("async"),
    // actionLogger         = require("./actionLogger"),
    // joinRequestUtil      = require("./joinRequestUtil"),
    // responseHandler      = require("./responseHandler"),
    broadcastHandler     = require("./broadcastHandler"),
    // channelTimerHandler  = require("./channelTimerHandler"),
    // updateProfileHandler = require("./updateProfileHandler"),
    // autoSitHandler       = require("./autoSitHandler"),
    keyValidator         = require("../../../../shared/keysDictionary"),
    // imdb                 = require("../../../../../shared/model/inMemoryDbQuery.js"),
    stateOfX             = require("../../../../shared/stateOfX.js"),
    zmqPublish           = require("../../../../shared/infoPublisher.js"),
    popupTextManager     = require("../../../../shared/popupTextManager")
const configConstants = require('../../../../shared/configConstants');

var waitingListHandler = {};
var pomelo = require('pomelo');
// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'waitingListHandler';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  // zmqPublish.sendLogMessage(logObject);
  console.log(type, log);
}

// init params
var intializeParams = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'In waitingListHandler function intializeParams');
  params.data           = {};
  params.data.key       = "queueList";
  params.data.queueList = [];
	cb(null, params);
};

// find if there is next player available to process
var getNextQueuedPlayerId = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'In waitingListHandler function getNextQueuedPlayerId');
	pomelo.app.rpc.database.tableRemote.getTableAttrib(params.session, {channelId: params.channelId, data: params.data, key: params.data.key}, function (getTableAttribResponse) {
    serverLog(stateOfX.serverLogType.info, "getTableAttrib response is - in waiting" + JSON.stringify(getTableAttribResponse));
    if(getTableAttribResponse.success) {
    	params.data.queueList = getTableAttribResponse.value;
    	if(params.data.queueList.length <= 0) {
        cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.GETNEXTQUEUEDPLAYERIDFAIL_WAITINGLISTHANDLER});
        //cb({success: false, channelId: params.channelId, info: "There is no waiting player for this table."});
    	} else {
    		cb(null, params);
    	}
    } else {
    	cb(getTableAttribResponse);
    }
  });
};

// find user session in db and
// hit auto autoSit "JOIN TABLE" API
// rpc to connector to rpc back to room
var getUserServerId = function(params, cb){
  pomelo.app.rpc.database.dbRemote.findUserSessionInDB({}, params.data.queueList[0].playerId, function (response) {
    // console.log("-------------response--- room -------------",response);
    if(response.success && !!response.result){
           pomelo.app.rpc.connector.sessionRemote.hitAutoSit({frontendId : response.result.serverId }, { playerId : params.data.queueList[0].playerId, playerName : params.data.queueList[0].playerName, channelId: params.channelId,seatIndex: 1, networkIp: "", imageAvtar: "", isRequested: false , channel : { channelType: params.channel.channelType, channelName: params.channel.channelName}}, function (hitAutoSitResponse) {
              // console.log("-------------response--- room -------------",hitAutoSitResponse);
              if(hitAutoSitResponse.success){
                // process next in queue
                params.nextToNext = false;
                if(hitAutoSitResponse.nextToNext){
                  params.nextToNext = true;
                }
                cb(null, params);
              }else{
                cb(hitAutoSitResponse);
              }
           });
        }else{
           cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.ERROR_GETTING_SERVER_ID});
        }
    });
};

// var replaceCurrentSession = function(params, cb) {
//   serverLog(stateOfX.serverLogType.info, 'In waitingListHandler function replaceCurrentSession');
//   params.session = !!params.self.app.sessionService.getByUid(params.data.queueList[0].playerId) ? params.self.app.sessionService.getByUid(params.data.queueList[0].playerId)[0] : {};
//   cb(null, params);
// }

// var getPlayerProfileDetails = function(params, cb) {
// 	serverLog(stateOfX.serverLogType.info, 'In waitingListHandler function getPlayerProfileDetails');
//   updateProfileHandler.getProfile({playerId: params.data.queueList[0].playerId, keys: ['profileImage', 'firstName', 'lastName', 'userName']}, function(getProfileResponse){
//     if(getProfileResponse.success){
//       params.data.profile = getProfileResponse.result;
//       serverLog(stateOfX.serverLogType.info, 'Profile details of waiting player - ' + JSON.stringify(params.data.profile));
//       cb(null, params);
//     } else {
//       cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.UPDATEPROFILEHANDLERFAIL_WAITINGLISTHANDLER + params.data.queueList[0].playerId});
//       //cb({success: false, channelId: params.channelId, info: "Get profile details from database failed for playerId - " + params.data.queueList[0].playerId});
//     }
//   });
// }

// var processPlayerAutoSit = function(params, cb) {
// 	serverLog(stateOfX.serverLogType.info, 'In waitingListHandler function processPlayerAutoSit');
//   autoSitHandler.processAutoSit({self: params.self, session: params.session, channel: params.channel, channelId: params.channelId, playerId: params.data.queueList[0].playerId, playerName: (params.data.profile.userName), seatIndex: 1, networkIp: "", imageAvtar: "", isRequested: false}, function(processAutoSitResponse){
//     serverLog(stateOfX.serverLogType.info, 'processPlayerAutoSit processAutoSitResponse response - ' + JSON.stringify(processAutoSitResponse));
//     if(!!processAutoSitResponse.isPlayerSit) {
//       actionLogger.createEventLog ({self: params.self, session: params.session, channel: params.channel, data: {channelId: params.channelId, eventName: stateOfX.logEvents.reserved, rawData: {playerName: processAutoSitResponse.player.playerName, chips: processAutoSitResponse.player.chips, seatIndex: processAutoSitResponse.data.seatIndex}}});
//       broadcastHandler.fireSitBroadcast({self: params.self, channel: params.channel, player: processAutoSitResponse.player, table: processAutoSitResponse.table});
//       channelTimerHandler.vacantReserveSeat({self: params.self, session: params.session, channel: params.channel, channelId: params.channelId, playerId: params.data.queueList[0].playerId});
//       broadcastHandler.fireBroadcastToAllSessions({app: params.self.app, data: {_id: params.channelId, channelType: params.channel.channelType, playerId: params.data.queueList[0].playerId, event: stateOfX.recordChange.tableViewLeftWaitingPlayer}, route: stateOfX.broadcasts.tableView});
//       cb(null, params);
//     } else {
//       if(processAutoSitResponse.data.isTableFull) {
//         cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.PROCESSPLAYERAUTOSITFAIL_WAITINGLISTHANDLER});
//         //cb({success: false, channelId: params.channelId, info: 'The table is already full, you can observe or please choose another.'})
//       } else {
//         serverLog(stateOfX.serverLogType.info, JSON.stringify(processAutoSitResponse));
//         cb(null, params);
//       }
//     }
//   });
// 	cb(null, params);
// }

// var informPlayerSeatReserved = function(params, cb) {
//   serverLog(stateOfX.serverLogType.info, 'In waitingListHandler function informPlayerSeatReserved');
//   broadcastHandler.autoJoinBroadcast({channelId: params.channelId, playerId: params.data.queueList[0].playerId, serverId: params.session.frontendId, self: params.self, channelType: params.channel.channelType, tableId: "", heading: 'Seat Reserved', info: 'A seat is reserved for you in table ' + params.channel.channelName + ', Please join within ' + configConstants.vacantReserveSeatTime + ' seconds or seat will be no longer reserved for you.', forceJoin: false})
//   cb(null, params);
// }

// remove player from queue if processed
var removePlayerFromQueueList = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In waitingListHandler function removePlayerFromQueueList'+params.channel.waitingPlayers);
  params.data.playerId = params.data.queueList[0].playerId;
  pomelo.app.rpc.database.requestRemote.removeWaitingPlayer(params.session, {channelId: params.channelId, data: params.data, playerId: params.data.queueList[0].playerId}, function (removeWaitingPlayer) {
    serverLog(stateOfX.serverLogType.info, "removeWaitingPlayer response is -" + JSON.stringify(removeWaitingPlayer));
    if(removeWaitingPlayer.success) {
      params.channel.waitingPlayers = (!!params.channel.waitingPlayers && params.channel.waitingPlayers > 0) ? params.channel.waitingPlayers - 1 : 0;
      broadcastHandler.fireBroadcastToAllSessions({app: pomelo.app, data: {_id: params.channelId, updated : {queuePlayers: params.channel.waitingPlayers}, event: stateOfX.recordChange.tableWaitingPlayer}, route: stateOfX.broadcasts.tableUpdate});
      serverLog(stateOfX.serverLogType.info, "Player has been successfully removed from player list -" + JSON.stringify(removeWaitingPlayer));
      cb(null, params);
    } else{
      cb(removeWaitingPlayer);
    }
  });
};

// process the first/next player in queue for table
// when seat becomes available in table after some leave event
waitingListHandler.processNextQueuedPlayer = function (params) {
  serverLog(stateOfX.serverLogType.info, 'Starting to process waiting list with keys - ' + JSON.stringify(_.keys(params)));
  keyValidator.validateKeySets("Request", "connector", "processNextQueuedPlayer", params, function (validated){
    if(validated.success) {
      async.waterfall([
        async.apply(intializeParams, params),
        getNextQueuedPlayerId,
        getUserServerId,
        // replaceCurrentSession,
        // getPlayerProfileDetails,
        // processPlayerAutoSit,
        // informPlayerSeatReserved,
        removePlayerFromQueueList
      ], function(err, response){
        if(!err && response) {
          serverLog(stateOfX.serverLogType.info, 'Waiting player processed - ' + JSON.stringify(_.keys(response)));
          if(response.nextToNext){
            serverLog(stateOfX.serverLogType.info, '-- recursion happened -- --- ');
            // recursion
            waitingListHandler.processNextQueuedPlayer({channelId: params.channelId, session: params.session,  channel: params.channel});
          }
				} else {
					serverLog(stateOfX.serverLogType.error, 'Unable to process next waiting list player - ' + JSON.stringify(err));
				}
			});
    } else{
    	serverLog(stateOfX.serverLogType.error, JSON.stringify(validated));
    }
  });
};

module.exports = waitingListHandler;
