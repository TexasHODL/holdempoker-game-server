/*
* @Author: sushiljainam
* @Date:   2017-06-21 16:46:23
* @Last Modified by:   digvijay
* @Last Modified time: 2019-07-03 16:53:29
*/

/*jshint node: true */
"use strict";

// > This file is used to control following things -
// 1. Handle client request
// 2. Response to client
// 3. Perform db operation before sending response (if required)
// 4. Internal functions are also used to manipulate data before response (if required)


// ### External files and packages declaration ###
var _                       = require("underscore"),
    schedule                = require("node-schedule"),
    async                   = require("async"),
    _ld                     = require("lodash"),
    // appmetrics           = require("appmetrics"),
    // monitoring           = appmetrics.monitor(),
    keyValidator            = require("../../../../shared/keysDictionary"),
    imdb                    = require("../../../../shared/model/inMemoryDbQuery.js"),
    db                      = require("../../../../shared/model/dbQuery.js"),
    // logDB                   = require("../../../../../shared/model/logDbQuery.js"),
    // encryptDecrypt          = require("../../../../../shared/passwordencrytpdecrypt.js"),
    activity                = require("../../../../shared/activity.js"),
    stateOfX                = require("../../../../shared/stateOfX.js"),
    // profileMgmt             = require("../../../../../shared/model/profileMgmt.js"),
    zmqPublish              = require("../../../../shared/infoPublisher.js"),
    filterChat              = require("../../../../shared/filterChat"),
    configMsg               = require("../../../../shared/popupTextManager").falseMessages,
    // dbConfigMsg             = require("../../../../../shared/popupTextManager").dbQyeryInfo,
    broadcastHandler        = require("../roomHandler/broadcastHandler"),
    sessionHandler          = require("../roomHandler/sessionHandler"),
    joinChannelHandler      = require("../roomHandler/joinChannelHandler"),
    stickerHandler      = require("../roomHandler/stickerHandler.js"),
    startTournamentHandler  = require("../roomHandler/startTournamentHandler"),
    sitHereHandler          = require("../roomHandler/sitHereHandler"),
    // updateProfileHandler    = require("./updateProfileHandler"),
    actionHandler           = require("../roomHandler/actionHandler"),
    revertLockedHandler     = require("./revertLockedHandler"),
    actionLogger            = require("../roomHandler/actionLogger"),
    autoSitHandler          = require("../roomHandler/autoSitHandler"),
    // lateRegistrationHandler = require("./lateRegistrationHandler"),
    // logoutHandler           = require("./logoutHandler"),
    // tournamentSchedular     = require("./tournamentSchedular.js"),
    channelTimerHandler     = require("../roomHandler/channelTimerHandler"),
    // retryHandler            = require("./retryHandler"),
    // rebuyHandler            = require("./rebuyHandler"),
    // addOnHandler            = require("./addOnHandler"),
    // autoLogOutSchedular     = require("./autoLogOutSchedular.js"),
    // getFiltersFromDb        = require("./getFiltersFromDb"),
    // onlinePlayers           = require("./onlinePlayers"),
    // videoHandler            = require("./videoHandler"),
    // idlePlayersHandler      = require("./idlePlayersHandler"),
    resumeHandler           = require("../roomHandler/resumeHandler"),
    // tournamentLeaveHandler  = require("./tournamentLeaveHandler"),
    tournamentActionHandler = require("../roomHandler/tournamentActionHandler"),
    handleTipDealer         = require('../roomHandler/handleTipDealer');

var appDir = "../../../../../";
var serverDownManager = require(appDir+ "game-server/app/util/serverDownManager");
const configConstants = require('../../../../shared/configConstants');

    var schedular   = {};

    var pomelo = require('pomelo');
// Create data for log generation
function serverLog (type, log) {
  var logObject          = {};
  logObject.fileName     = 'channelHandler';
  logObject.serverName   = stateOfX.serverType.connector;
  // logObject.functionName = arguments.callee.caller.name.toString();
  logObject.type         = type;
  logObject.log          = log;
  zmqPublish.sendLogMessage(logObject);
}

// FILE THAT RECEIVES
// APIs related to table

// var globalThis = require('pomelo');

var Handler = function (app) {
  this.app = app;
  this.registerCounter = null;
};

module.exports = function (app) {
  return new Handler(app);
};

var handler = Handler.prototype;

// ### Join player to a channel or table ###
// Join channel
// - Join only if not in channel
// - create channel if not already exists
// - create table structure here
handler.joinChannel = function (msg, session, next) {
  console.trace("i am done");
  console.error(msg);
  if (serverDownManager.checkServerState('joinReq', pomelo.app)) {
    next(null, {success: false, channelId: (msg.channelId||""), info: "Server is going under maintenance. No new game will start now."});
    return;
  }
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "joinChannel", msg, function (validated){
  	// next(null, validated); return;
    if(validated.success) {
      var channel = pomelo.app.get('channelService').getChannel(msg.channelId, true);
      joinChannelHandler.processJoin({session: session, channel: channel, channelId: msg.channelId, channelType: msg.channelType, tableId: msg.tableId, playerId: msg.playerId, playerName: msg.playerName, password: msg.password, networkIp: msg.networkIp, deviceType: session.get("deviceType")}, function(processJoinResponse){
        serverLog(stateOfX.serverLogType.response, JSON.stringify(processJoinResponse));
        next(null, processJoinResponse);
        // if(processJoinResponse && processJoinResponse.roomConfig && processJoinResponse.roomConfig.channelName.search('Magic')>=0){
        //   var magicShow =  require('../demo/showMagic');
        //   if(magicShow.start){
        //     magicShow.start({playerId: msg.playerId, channel: channel});
        //   }
        // }
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

/*  @description : send sticker for sending the sticker to particular as well as all players joined in the channel
    @author : naman jain
    @date : 8/1/2021
 */
handler.sendSticker = function (msg, session, next) {
  keyValidator.validateKeySets("Request", "connector", "sendSticker", msg, function (validated){
    if(validated.success) {
      serverLog("sticker processing to be done here");
      msg.session = session;
      stickerHandler.sendStickerProcess(msg, function(sendStickerResponse){
        next(null, sendStickerResponse);
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};


// ### Auto join and sit player into a table request handler
// > Sit player based on different conditions - reserved state
// > Broadcast this player sit
// player will add chips and then a game may start
handler.autoSit = function (msg, session, next) {
  if (serverDownManager.checkServerState('autoSitReq', pomelo.app)) {
    next(null, {success: false, channelId: (msg.channelId||""), info: "Server is going under maintenance. No new game will start now."});
    return;
  }
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "autoSit", msg, function (validated){
    if(validated.success) {
      var channel   = pomelo.app.get('channelService').getChannel(msg.channelId, true),
          seatIndex = !!parseInt(msg.seatIndex) ? parseInt(msg.seatIndex) : 1;
      autoSitHandler.processAutoSit({ session: session, channel: channel, channelId: msg.channelId, playerId: msg.playerId, playerName: msg.playerName, seatIndex: seatIndex, networkIp: msg.networkIp, imageAvtar: msg.imageAvtar, password: msg.password, isRequested: msg.isRequested, deviceType: session.get("deviceType")}, function(processAutoSitResponse){
        serverLog(stateOfX.serverLogType.info, 'processAutoSitResponse response - ' + JSON.stringify(processAutoSitResponse));
        if(!!processAutoSitResponse.isPlayerSit) {
          next(null, processAutoSitResponse.response);
          actionLogger.createEventLog ({ session: session, channel: channel, data: {channelId: msg.channelId, eventName: stateOfX.logEvents.reserved, rawData: {playerName: processAutoSitResponse.player.playerName, chips: processAutoSitResponse.player.chips, seatIndex: processAutoSitResponse.data.seatIndex}}});
          broadcastHandler.fireSitBroadcast({ channel: channel, player: processAutoSitResponse.player, table: processAutoSitResponse.table});
          channelTimerHandler.vacantReserveSeat({ channel: channel, session: session, channelId: msg.channelId, playerId: msg.playerId});
          broadcastHandler.sendMessageToUser({ playerId: msg.playerId, serverId: session.frontendId, msg: {playerId: msg.playerId, channelId: msg.channelId, event : stateOfX.recordChange.playerJoinTable }, route: stateOfX.broadcasts.joinTableList});
        } else {
          if(!!processAutoSitResponse.data && !!processAutoSitResponse.data.isTableFull) {
            serverLog(stateOfX.serverLogType.response, JSON.stringify({success: false, channelId: msg.channelId, info: 'The table you want to join is already full, choose another.'}));
            // next(null, {success: false, channelId: msg.channelId, info: 'The table is already full, you can observe or please choose another.'})
            next(null, {success: false, channelId: (msg.channelId || ""), info: configMsg.AUTOSITFAIL_ENTRYHANDLER, isRetry: false, isDisplay: true});
          } else {
            serverLog(stateOfX.serverLogType.response, JSON.stringify(processAutoSitResponse));
            next(null, processAutoSitResponse);
          }
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

// ### Sit a player ###
// - Create player structure and push in waiting players
// - then try game start
handler.sitHere = function (msg, session, next) {
  if (serverDownManager.checkServerState('sitReq', pomelo.app)) {
    next(null, {success: false, channelId: (msg.channelId||""), info: "Server is going under maintenance. No new game will start now."});
    return;
  }
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "sitHere", msg, function (validated){
    if(validated.success) {

      var channelId = msg.channelId,
          playerId  = msg.playerId,
          chips     = parseInt(msg.chips),
          seatIndex = parseInt(msg.seatIndex),
          networkIp = msg.networkIp,
          channel   = pomelo.app.get('channelService').getChannel(channelId, false);

      sitHereHandler.processSit({ session: session, channelId: channelId, channel: channel, playerId: playerId, playerName: msg.playerName, imageAvtar: msg.imageAvtar, chips: chips, seatIndex: seatIndex, networkIp: networkIp, isAutoReBuy: msg.isAutoReBuy, deviceType: session.get("deviceType")}, function(processSitResponse) {
        if(processSitResponse.success) {
          serverLog(stateOfX.serverLogType.response, JSON.stringify(processSitResponse.response));
          next(null, processSitResponse.response);
        } else {
          serverLog(stateOfX.serverLogType.response, JSON.stringify(processSitResponse));
          next(null, processSitResponse);
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

//### Add buy in for player on table
// try for a game start
handler.addChipsOnTable = function(msg,session,next) {
  if (serverDownManager.checkServerState('addChipsReq', pomelo.app)) {
    next(null, {success: false, channelId: (msg.channelId||""), info: "Server is going under maintenance. No new game will start now."});
    return;
  }
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "addChipsOnTable", msg, function (validated) {
    if(validated) {
      var channel = pomelo.app.get('channelService').getChannel(msg.channelId, false);
      pomelo.app.rpc.database.tableRemote.addChipsOnTable(session, msg, function (addChipsOnTableResponse) {
        serverLog(stateOfX.serverLogType.response, JSON.stringify(addChipsOnTableResponse));
        next(null, addChipsOnTableResponse);
        actionHandler.handleAddChipsEvent({ channel: channel, session: session, channelId: msg.channelId, request: msg, response: addChipsOnTableResponse});
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};



// ### Player move or actions controller
// response handled by a function same as after precheck - afterMoveResponse
handler.makeMove = function (msg, session, next) {

  var isClient = true;
  if(msg.isRequested === true) {
    sessionHandler.recordLastActivityTime({session: session, msg: msg});
  } else {
    isClient = false;
  }
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  // var self            = this,
  var successResponse = {};
  keyValidator.validateKeySets("Request", pomelo.app.serverType, "makeMove", msg, function (validated){
    if(validated.success) {

      var channelId = msg.channelId,
          channel   = pomelo.app.get('channelService').getChannel(channelId, false);

      pomelo.app.rpc.database.tableRemote.makeMove(session, msg, afterMoveResponse.bind(null, successResponse, channelId, channel, msg, session, function (err, res) {
        if (isClient) {
          next(); // this API is notify - FOR CLIENT
        } else {
          next(err, res); // this API is pomelo.request - FOR AUTO MOVE
        }
      }));
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      if (isClient) {
        next(); // this API is notify - FOR CLIENT
      } else {
        next(null, validated); // this API is pomelo.request - FOR AUTO MOVE
      }
    }
  });
};



// ### Leave and Standup handler ###
// Request: {playerId: , channelId: , isStandup: , isRequested: }
// Response: {success: , playerId: , channelId: }
handler.leaveTable = function (msg, session, next) {
  if(!!msg.isRequested && msg.isRequested) {
    sessionHandler.recordLastActivityTime({session: session, msg: msg});
  }
  var self            = !!msg.self && msg.self.keepThisApp ? msg.self : this, // keepThisApp: false, if not sure while calling leave
      app             = !!msg.self && !!msg.self.app ? msg.self.app : pomelo.app,
      serverId        = session.frontendId,
      successResponse = {};
      msg             = _.omit(msg, 'self');

      self.app        = app; // Assign app to make RPC calls further

  msg.playerName  = msg.playerName ? msg.playerName : "A player",
  keyValidator.validateKeySets("Request", app.serverType, "leaveTable", msg, function (validated){
    if(validated.success) {

      var playerId  = msg.playerId,
          channelId = msg.channelId,
          channel   = app.get('channelService').getChannel(channelId, false);

      serverLog(stateOfX.serverLogType.info, 'in leaveRemote - ' + JSON.stringify(msg));
      app.rpc.database.tableRemote.leave(session, msg, function (leaveResponse) {
        serverLog(stateOfX.serverLogType.info, 'leaveResponse -------> ' + JSON.stringify(leaveResponse));
        if(leaveResponse.success) {
          // if(!msg.isStandup) {
          //   broadcastHandler.sendMessageToUser({self: self, playerId: playerId, serverId: session.frontendId, msg: {playerId: playerId, channelId: channelId, event : stateOfX.recordChange.playerLeaveTable}, route: stateOfX.broadcasts.joinTableList});
          // }
          // sent broadcast if player eliminate and it is tournament
          if(!!leaveResponse.channelType && (leaveResponse.channelType).toUpperCase() === stateOfX.gameType.tournament) {
            for(var playerIt = 0; playerIt < leaveResponse.tournamentRules.ranks.length; playerIt++) {
              if(!leaveResponse.tournamentRules.ranks[playerIt].isPrizeBroadcastSent) {
                serverLog(stateOfX.serverLogType.info, "creating broadcast data for playerEliminationBroadcast");
                var broadcastData = {
                  self          : self,
                  playerId      : leaveResponse.tournamentRules.ranks[playerIt].playerId,
                  tournamentId  : leaveResponse.tournamentRules.ranks[playerIt].tournamentId,
                  channelId     : leaveResponse.tournamentRules.ranks[playerIt].channelId,
                  rank          : leaveResponse.tournamentRules.ranks[playerIt].rank,
                  chipsWon      : leaveResponse.tournamentRules.ranks[playerIt].chipsWon,
                  route         : "playerElimination"
                };
                leaveResponse.tournamentRules.ranks[playerIt].isPrizeBroadcastSent = true;
                broadcastHandler.firePlayerEliminateBroadcast(broadcastData, function() {
                  //update values in db of isbroadcastsent and isgiftdistributed
                  serverLog(stateOfX.serverLogType.info, "`broadcast sent for player elimination in leave`");
                });
              }
            }
          }

          successResponse = {success: true, channelId: channelId};
          keyValidator.validateKeySets("Response", app.serverType, "leaveTable", successResponse, function (validated){
            if(validated.success) {
              channelTimerHandler.killReserveSeatReferennce({playerId: playerId, channel: channel});
              serverLog(stateOfX.serverLogType.response, JSON.stringify(successResponse));
              next(null, successResponse);
              serverLog(stateOfX.serverLogType.info, '------ Leave response sent to requester ' + JSON.stringify(leaveResponse) + ' -------');

              // Handle this leave event and perform actions after this leave
              actionLogger.createEventLog ({self: self, session: session, channel: channel, data: {channelId: channelId, eventName: stateOfX.logEvents.leave, rawData: {playerName: msg.playerName}}});
              actionHandler.handle({self: self, session: session, channel: channel, channelId: channelId, response: leaveResponse, request: msg});

              // Leave player from channel (not in standup case)
              console.trace("this standup is causing problems");
              console.error("!@!@!@!@!@!@!@!@!@",msg);
              console.error("!@!@!@!@!@!@!@!@!@",playerId);
              console.error("!@!@!@!@!@!@!@!@!@",serverId);
              if(!msg.isStandup) {
                channel.leave(playerId, serverId); //works with or without serverId
                var sessionChannels =  session.get("channels");
                serverLog(stateOfX.serverLogType.info, "sessionChannels are in joinchannel handler before push" + JSON.stringify(sessionChannels));
                var indexOfChannel = sessionChannels.indexOf(channelId);
                if( indexOfChannel >=0){
                 sessionChannels.splice(indexOfChannel,1);
                }
                session.set("channels", sessionChannels);
                session.push("channels", function (err){
                  if(err) {
                    serverLog(stateOfX.serverLogType.error, 'set new channel for session service failed! error is : %j', err.stack);
                    //cb({success : false, channelId: params.channelId, info: err,isRetry: false, isDisplay: false});
                  } else {
                    //var sessionChannels =   params.session.get("channels");
                    serverLog(stateOfX.serverLogType.info, "sessionChannels are in joinchannel handler after push" + JSON.stringify( session.get("channels")));
                    //cb(null, params);
                  }
                });
                // TODO: Make sure cases before destroying channel, such as player might be in waiting list
                // for this channel as well
                var waitingPlayerInChannel = !!channel.waitingPlayers ? channel.waitingPlayers : 0;
                var queryImdb = {};
                queryImdb.channelId = channelId;
                imdb.findRunningTable(queryImdb,function(err,results){
//                  console.error("%%%%%%%%%^^^^^^^^^&&&&&&&&&&&& ",results);
                  if(!err && results.length == 0 && waitingPlayerInChannel === 0){
                     app.rpc.database.tableRemote.removeTable(session,{channelId: channelId}, function (removeTableResp) {
                    serverLog(stateOfX.serverLogType.error, removeTableResp);
                    serverLog(stateOfX.serverLogType.error, 'CHANNEL ' + channel.channelName + ' IS GOING TO BE DESTROYED!');
                    channel.isTable = false;
                    // channel.destroy();
                    app.get('channelService').destroyChannel(channelId);
                    serverLog(stateOfX.serverLogType.error, 'CHANNEL HAS BEEN DESTROYED!');
                  });
                  }
                });
              }




              // if(channel.getMembers().length + waitingPlayerInChannel === 0) {
              //   app.rpc.database.tableRemote.removeTable(session,{channelId: channelId}, function (removeTableResp) {
              //     serverLog(stateOfX.serverLogType.error, removeTableResp);
              //     serverLog(stateOfX.serverLogType.error, 'CHANNEL ' + channel.channelName + ' IS GOING TO BE DESTROYED!');
              //     channel.isTable = false;
              //     // channel.destroy();
              //     app.get('channelService').destroyChannel(channelId);
              //     serverLog(stateOfX.serverLogType.error, 'CHANNEL HAS BEEN DESTROYED!');
              //   });
              // }

            } else {
              serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
              next(null, validated);
            }
          });
        } else {
          serverLog(stateOfX.serverLogType.response, JSON.stringify(leaveResponse));
          next(null, leaveResponse);
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

// return precheck data for a player from array of prechecks
var findPrecheck = function (preChecks, playerId) {
  for (var i = 0; i < preChecks.length; i++) {
    if (preChecks[i].playerId == playerId) {
      return preChecks[i];
    }
  }
  return {};
};

// API - update precehck - tick/untick
// if current player - also makeMove
// handle response by - afterMoveResponse
handler.updatePrecheck = function (msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  keyValidator.validateKeySets("Request", "connector", "updatePrecheck", msg, function (validated) {
    var channelIdOriginal = msg.channelId;
    if (validated.success) {
      pomelo.app.rpc.database.tableRemote.updatePrecheckOrMakeMove(session, {playerId: msg.playerId, channelId: msg.channelId, keyValues: {"precheckValue": msg.precheckValue, "callPCAmount": (msg.callPCAmount||0)}}, function (updatePrecheckResponse) {
        if (updatePrecheckResponse.success) {
          console.error("---------updatePrecheckResponse", JSON.stringify(updatePrecheckResponse));
          if (updatePrecheckResponse.makeMoveResponse) {
            var channel = pomelo.app.get('channelService').getChannel(channelIdOriginal, false);
            console.error("=------------", channel);
            console.error("=------------", Object.keys(channel));
            afterMoveResponse.call(null, {/*always empty*/}, channelIdOriginal, channel, updatePrecheckResponse.msg, session, function (err, moveResponseForClient) {
              if (moveResponseForClient.success) {
                var precheck = findPrecheck(updatePrecheckResponse.makeMoveResponse.preChecks, msg.playerId);
                next(null, {success: true, channelId: msg.channelId || "", set: precheck.set||-1, precheckValue: precheck.precheckValue||stateOfX.playerPrecheckValue.NONE, callPCAmount: 0});
              } else {
                next(null, moveResponseForClient);
              }
            }, updatePrecheckResponse.makeMoveResponse);
          } else {
            next(null, {success: true, channelId: msg.channelId || "", set: ([0,1,2,3].indexOf(msg.set)>=0?msg.set:-1), precheckValue: msg.precheckValue, callPCAmount: msg.callPCAmount||0});
          }
        } else {
          process.emit('forceMail', {title:"for second-last-else-of-updatePrecheck", data: updatePrecheckResponse});
          next(null, {success: false, channelId: msg.channelId || "", info: updatePrecheckResponse.info || "Unable to update Precheck." });
        }
      });
      return;
      // pomelo.app.rpc.database.tableRemote.setPlayerAttrib(session, {playerId: msg.playerId, channelId: msg.channelId, keyValues: {"precheckValue": msg.precheckValue, "callPCAmount": (msg.callPCAmount||0)}}, function (setPlayerAttribResponse) {
      //   if (setPlayerAttribResponse.success) {
      //     next(null, {success: true, channelId: msg.channelId || "", set: ([0,1,2,3].indexOf(msg.set)>=0?msg.set:-1), precheckValue: msg.precheckValue, callPCAmount: msg.callPCAmount||0});
      //   } else {
      //     next(null, {success: false, channelId: msg.channelId || "", info: setPlayerAttribResponse.info || "Unable to update Precheck." });
      //   }
      // })
    } else {
      next(null, validated);
    }
  });
};


// ### Handle player chat in game
handler.chat = function (msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  console.log(stateOfX.serverLogType.request+ JSON.stringify(msg));
  // var self = this;
  keyValidator.validateKeySets("Request", "connector", "chat", msg, function (validated){
    if(validated.success) {
      var channel = pomelo.app.get('channelService').getChannel(msg.channelId, false); //Added for channel is already present

      // TODO: Record last activity of a player through RPC call
      // params.table.players[params.data.index].activityRecord.lastActivityTime = Number(new Date()); // Record last activity of player

      //FEATURE: If all in occured on table then do not process chat
      if(channel.allInOccuredOnChannel) {
        next(null, {success: true, channelId: msg.channelId, info: "All in occured on table, cannot process player chat at this moment!", isRetry: false, isDisplay: false});
        return false;
      }
      console.log("channelName"+ channel.channelName);
      serverLog(stateOfX.serverLogType.info, 'input chat message - ' + msg.message);
      db.findUser({playerId: msg.playerId}, function(err, result){
        console.log("error and result"+JSON.stringify(result));
        if(!err && !!result && (result.settings.adminChat == false)){  //check if player chat is blocked by admin
          next(null, {success: false, channelId: msg.channelId, info: "Your chat has been disabled. Kindly contact the support team to enable it."});
        }else{
          filterChat.filter(msg.message,function(err,response){
            if(err){
              next(null,err);
            } else{
              db.savePlayerChat({playerName: msg.playerName, playerId: msg.playerId, text: msg.message.replace(/,|:/gi, ' '), channelId: msg.channelId, time: Number(new Date()), channelName: channel.channelName}, function(err, result){
                console.log("Player Chat saved");
              });
              serverLog(stateOfX.serverLogType.info, 'filter chat message - ' + response);
              broadcastHandler.fireChatBroadcast({channel: channel, channelId: msg.channelId, playerId: msg.playerId, playerName: msg.playerName, message: response});
              var success = {success: true, channelId: msg.channelId};
              serverLog(stateOfX.serverLogType.response, JSON.stringify(success));
              next(null, success);
            }
          });
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

// ### Reset sitout options handler
// > When player uncheck any sitout option
handler.resetSitout = function (msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  // var self = this;
  keyValidator.validateKeySets("Request", "connector", "resetSitout", msg, function (validated){
    if(validated.success) {
      var channel   = pomelo.app.get('channelService').getChannel(msg.channelId, false); //Added for channel is already present
      pomelo.app.rpc.database.tableRemote.resetSitout(session, {playerId: msg.playerId, channelId: msg.channelId}, function (resetSitoutResponse) {
        if(resetSitoutResponse.success) {
          keyValidator.validateKeySets("Response", pomelo.app.serverType, "resetSitout", resetSitoutResponse.data, function (validated){
            if(validated.success) {
              serverLog(stateOfX.serverLogType.response, JSON.stringify(resetSitoutResponse.data));
              next(null, resetSitoutResponse.data);
              broadcastHandler.firePlayerStateBroadcast({channel: channel, self: pomelo, playerId: msg.playerId, channelId: msg.channelId, state: resetSitoutResponse.data.state});
            } else {
              serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
              next(null, validated);
            }
          });
        } else {
          serverLog(stateOfX.serverLogType.info, 'Add player chips broadcast will not be sent !');
          next(null, resetSitoutResponse);
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

// ### Handle sitout in next hand option
handler.sitoutNextHand = function (msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  // var self = this;
  keyValidator.validateKeySets("Request", "database", "sitoutNextHand", msg, function (validated){
    if(validated.success) {
      var channel   = pomelo.app.get('channelService').getChannel(msg.channelId, false); //Added for channel is already present
      pomelo.app.rpc.database.tableRemote.sitoutNextHand(session, msg, function (sitoutNextHandResponse) {
        serverLog(stateOfX.serverLogType.info, 'Sitout Next Hand response from remote: ' + JSON.stringify(sitoutNextHandResponse));
        if(sitoutNextHandResponse.success) {
          keyValidator.validateKeySets("Response", "database", "sitoutNextHand", sitoutNextHandResponse, function (validated){
            if(validated.success) {
              serverLog(stateOfX.serverLogType.response, JSON.stringify(sitoutNextHandResponse));
              next(null, sitoutNextHandResponse);
              if(sitoutNextHandResponse.state !== stateOfX.playerState.playing)  {
                broadcastHandler.firePlayerStateBroadcast({channel: channel, self: {}, playerId: msg.playerId, channelId: msg.channelId, state: sitoutNextHandResponse.state});
              }
              if(sitoutNextHandResponse.state === stateOfX.playerState.playing && sitoutNextHandResponse.lastMove === stateOfX.move.fold ) {
                broadcastHandler.firePlayerStateBroadcast({channel: channel, self: {}, playerId: msg.playerId, channelId: msg.channelId, state: sitoutNextHandResponse.state});
              }
            } else {
              serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
              next(null, validated);
            }
          });
        } else {
          serverLog(stateOfX.serverLogType.response, JSON.stringify(sitoutNextHandResponse));
          next(null, sitoutNextHandResponse);
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

// ### Handle resume player option - SITIN
handler.resume = function (msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  // var self = this;
  keyValidator.validateKeySets("Request", "connector", "resume", msg, function (validated){
    if(validated.success) {
      resumeHandler.resume({self: {}, channelId: msg.channelId, session: session, request: msg}, function(resumeResponse) {
        next(null, resumeResponse);
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

// ### Join a channel as waiting (IN QUEUE) player
handler.joinWaitingList = function (msg, session, next) {
  if (serverDownManager.checkServerState('joinWaitReq', pomelo.app)) {
    next(null, {success: false, channelId: (msg.channelId||""), info: "Server is going under maintenance. No new game will start now."});
    return;
  }
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  // var self = this;
  msg.playerName = !!msg.playerName ? msg.playerName : "Player";
  keyValidator.validateKeySets("Request", "connector", "joinWaitingList", msg, function (validated){
    if(validated.success) {
      var channel = pomelo.app.get('channelService').getChannel(msg.channelId, false);
      if(!!channel) {
        pomelo.app.rpc.database.tableRemote.joinQueue(session, {playerId: msg.playerId, channelId: msg.channelId, playerName: msg.playerName, networkIp: msg.networkIp, deviceType: session.get("deviceType"), password: msg.password}, function (joinQueueResponse) {
          serverLog(stateOfX.serverLogType.response, JSON.stringify(joinQueueResponse));
          next(null, joinQueueResponse);
          if(joinQueueResponse.success) {
            actionHandler.handleWaitingList({self: {}, channel: channel, session: session, channelId: msg.channelId, response: joinQueueResponse, request: msg});
          }
        });
      } else {
        // var fail = {success: false, channelId: msg.channelId, info: "The table has been never played, cannot join as waiting."}
        var fail = {success: false, channelId: msg.channelId, info: configMsg.JOINWAITINGLISTFAIL_ENTRYHANDLER, isRetry: false, isDisplay: true};
        serverLog(stateOfX.serverLogType.response, JSON.stringify(fail));
        next(null, fail);
      }
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

// not sure if used or not
// deprecated
handler.insertVideoLog = function(msg,session,next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var channel  = pomelo.app.get('channelService').getChannel(msg.channelId, false); //Added for channel is already present
  keyValidator.validateKeySets("Request", "connector", "insertVideoLog", msg, function(validated) {
    if(validated.success) {
      db.insertVideoLog(msg.channelId,msg.roundId,msg.logData, function(err, videoLogResponse){
        if(err){
          next(null, videoLogResponse);
        } else{
          var habdTabData ={};
          habdTabData.channelId = msg.channelId;
          habdTabData.roundId = msg.roundId;
          habdTabData.data = {videoLogId: videoLogResponse.ops[0]._id.toString(),active:true};
           pomelo.app.rpc.database.videoRemote.updateHandTab(session, habdTabData, function (habdTabDataResponse) {
            serverLog(stateOfX.serverLogType.response, 'updateHandTab - ' + JSON.stringify(habdTabDataResponse));
            if(habdTabDataResponse.success){
               broadcastHandler.fireHandtabBroadcast({channel: channel, channelId: msg.channelId, handTab: habdTabDataResponse.response});
              next(null, {success: true, channelId: msg.channelId, info:"video added successfully", isRetry: false, isDisplay: false});
            }else{
               next(null, {success: false, channelId: msg.channelId, info: configMsg.INSERTVIDEOLOGFAIL_ENTRYHANDLER, isRetry: false, isDisplay: false});
            }
          });

          // logDB.updateHandTab(msg.channelId,msg.roundId,{videoLogId: videoLogResponse.ops[0]._id.toString(),active:true},function(err,response){
          //   if(err){
          //     // next(null, {success: false, channelId: msg.channelId, info:"video insertion failed"});
          //     next(null, {success: false, channelId: msg.channelId, info: configMsg.INSERTVIDEOLOGFAIL_ENTRYHANDLER, isRetry: false, isDisplay: false});
          //   } else{
          //     broadcastHandler.fireHandtabBroadcast({channel: channel, channelId: msg.channelId, handTab: response.value});
          //     next(null, {success: true, channelId: msg.channelId, info:"video added successfully", isRetry: false, isDisplay: false});
          //   }
          // });
        }
      });
    } else {
      next(null, validated);
    }
  });
};

// get video json data for a game by videoId
//{videoId, playerId}
handler.getVideo = function(msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request,JSON.stringify(msg));
  serverLog(stateOfX.serverLogType.request,'msg in entryHandler in getVideo is - ' + JSON.stringify(msg));
  keyValidator.validateKeySets("Request", "connector", "getVideo", msg, function(validated) {
    if(validated.success) {
      //msg.videoId = "59ba7f8db3ee87a86c39fa58";
      //console.error(msg);
      pomelo.app.rpc.database.videoGameRemote.getVideoData({}, msg, function (videoResponse) {
           next(null, videoResponse);
        });
      // videoHandler.getVideoData(msg, function(videoResponse) {
      //   next(null, videoResponse);
      // })
    } else {
      next(null, validated);
    }
  });
};

// To watch video in debug build
handler.videoAndTextByHandId = function (msg, session, next) {
  if (typeof msg.value == "string") {
    msg.value = msg.value.trim();
  } else {
    next(null, {success: false, info: "Invalid Request, value must be string."});
    return;
  }
  if (!msg.value) {
    next(null, {success: false, info: "Invalid Request, value must be non-empty string"});
    return;
  }
  msg.by = (["roundId", "handId"].indexOf(msg.by) >= 0 ) ? msg.by : "handId";
  if (msg.get instanceof Array) {
    if (msg.get.length <= 0) {
      msg.get = ["video", "text"];
    }
  } else {
    msg.get = ["video", "text"];
  }
  msg.responses = [];
  if (msg.get.indexOf("video")>=0) {
    msg.responses.push("video");
  }
  if (msg.get.indexOf("text")>=0) {
    msg.responses.push("text");
  }
  delete msg.get;
  if (msg.responses.length <= 0) {
    next(null, {success: false, info: "You are trying to get Nothing with 'get' variable."});
    return;
  }
  pomelo.app.rpc.database.videoGameRemote.getVideoAndText({}, msg, function (response) {
     next(null, response);
  });
};

// ### Unjoin waiting list: Remove player from queue
handler.leaveWaitingList = function(msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  // var self = this;
  keyValidator.validateKeySets("Request", "connector", "leaveWaitingList", msg, function (validated){
    if(validated.success) {
      var channel = pomelo.app.get('channelService').getChannel(msg.channelId, false);
      if(!!channel) {
        pomelo.app.rpc.database.requestRemote.removeWaitingPlayer(session, {playerId: msg.playerId, channelId: msg.channelId, playerName: msg.playerName}, function (leaveWaitingResponse) {
            serverLog(stateOfX.serverLogType.response, 'leaveWaitingResponse - ' + JSON.stringify(leaveWaitingResponse));
            if(!!leaveWaitingResponse.data) {
              next(null, leaveWaitingResponse.data);
            } else {
              next(null, leaveWaitingResponse);
            }
            if(leaveWaitingResponse.success) {
              actionHandler.handleLeaveWaitingList({self: {}, channel: channel, session: session, channelId: msg.channelId, request: msg, response: leaveWaitingResponse});
            }
        });
      } else {
        // var fail = {success: false, channelId: msg.channelId, info: "The table has been never played, cannot remove from waiting."}
        var fail = {success: false, channelId: msg.channelId, info: configMsg.LEAVEWAITINGLISTFAIL_ENTRYHANDLER, isRetry: false, isDisplay: true};
        serverLog(stateOfX.serverLogType.response, JSON.stringify(fail));
        next(null, fail);
      }
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};


//////////////////////////////////////////////////
// Broadcast on channel level at client request //
// > Used for show/hide cards on winning        //
//////////////////////////////////////////////////
handler.channelBroadcast = function(msg, session, next) {
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  msg = !!msg.__route__ ?  _.omit(msg,"__route__") : msg ;
  // var self = this;
  keyValidator.validateKeySets("Request", "connector", "channelBroadcast", msg, function (validated){
    if(validated.success) {
      var channel  = pomelo.app.get('channelService').getChannel(msg.channelId, false); //Added for channel is already present
      msg.data.route = msg.route;
      msg.data.channelId = msg.channelId;
      broadcastHandler.fireChannelBroadcast({channel: channel, data: msg.data, route: msg.route});
      next(null, {success: true, channelId: msg.channelId});
    } else {
      next(null, validated);
    }
  });
};

//handles tip to dealer
// PENDING FEATURE
handler.tipDealer = function(msg, session, next){
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  // var self = this;
  pomelo.app.rpc.database.tableRemote.processTip(session, msg, function(response){
    serverLog(stateOfX.serverLogType.request, JSON.stringify(_.omit(response, "table")));
    if( response.success ){
      next(null, { success: true, info: "Tip Deducted Successfully", channelId: msg.channelId });
      var channel  = pomelo.app.get('channelService').getChannel(msg.channelId, false);
      //send broadcast
      var bData = { channelId: response.data.channelId, chips: response.data.chips, playerId: response.data.playerId };
      broadcastHandler.fireChannelBroadcast({channel: channel, data: bData, route: "dealerTip"});
      handleTipDealer.handle(Object.assign({}, response.data ));
    }else{
      next(null, _.omit(response, "table", "data"));
    }
  });
};

// revert a locked table by dashboard
handler.revertLockedTable = function (msg, session, next) {
  // msg = {channelId: '', allowedLockedTime: 'numberSeconds'}
  if(!msg.channelId){
    next(null, {success: false, info: 'Please provide channelId.'});
    return;
  }
  revertLockedHandler.revertLockedTable({self: this, app: this.app, channelId: msg.channelId, force: msg.force || false, allowedLockedTime: msg.allowedLockedTime || configConstants.allowedLockedTime || 120 }, function (response) {
    next(null, response);
  });
};

// revert-remove a locked table by dashboard
handler.revertLockedTableAndRemove = function (msg, session, next) {
  // msg = {channelId: '', allowedLockedTime: 'numberSeconds'}
  if(!msg.channelId){
    next(null, {success: false, info: 'Please provide channelId.'});
    return;
  }
  revertLockedHandler.revertLockedTableAndRemove({self: this, app: this.app, channelId: msg.channelId, force: msg.force || false, allowedLockedTime: msg.allowedLockedTime || configConstants.allowedLockedTime || 120 }, function (response) {
    next(null, response);
  });
};

// general function to handle make move response
// used from makeMove and updatePrecheck hits
function afterMoveResponse(successResponse, channelId, channel, msg, session, next, makeMoveResponse) {
  // function (makeMoveResponse) {
  if(makeMoveResponse.success) {
    serverLog(stateOfX.serverLogType.info, 'makeMoveResponse - ' + JSON.stringify(makeMoveResponse));
    if(channel.channelType === stateOfX.gameType.tournament) {
      tournamentActionHandler.calculateActivePlayers(pomelo,makeMoveResponse);
      startTournamentHandler.eliminationProcess(pomelo,makeMoveResponse);
      startTournamentHandler.sendBountyBroadcast(pomelo,makeMoveResponse);
      if(!!makeMoveResponse.isBlindUpdated && makeMoveResponse.isBlindUpdated){
        serverLog(stateOfX.serverLogType.info, 'inside broadcast for makeMoveResponse - ' + makeMoveResponse.isBlindUpdated);
        var blindUpdateObjectForBroadcast  = {};
        blindUpdateObjectForBroadcast.data = {
          blindTimeRemaining :makeMoveResponse.newBlinds.nextBlindUpdateTime ,
          nextBigBlind :makeMoveResponse.newBlinds.bigBlind , 
          nextSmallBlind :makeMoveResponse.newBlinds.smallBlind ,
          nextAnte :makeMoveResponse.newBlinds.ante,
          nextBlindLevel :makeMoveResponse.newBlinds.blindLevel
        };
        blindUpdateObjectForBroadcast.data.channelId = channelId;
        blindUpdateObjectForBroadcast.channel = channel;
        serverLog(stateOfX.serverLogType.info, 'data in updateBlind Broadcast is ' + blindUpdateObjectForBroadcast);
        broadcastHandler.updateBlind(blindUpdateObjectForBroadcast); //send broadcast for updateBlind
      }
    }
    // Send broadcast to user if it is tournament
    successResponse = {success: true, channelId: channelId};

    keyValidator.validateKeySets("Response", pomelo.app.serverType, "makeMove", successResponse, function (validated){
      if(validated.success) {
        // Log this event in Hand history and create dealer chat
        actionLogger.createEventLog ({ session: session, channel: channel,
          data: {channelId: channelId, eventName: stateOfX.logEvents.playerTurn,
          rawData: {playerName: makeMoveResponse.turn.playerName, actionName: makeMoveResponse.turn.action, amount: makeMoveResponse.turn.amount}
        }});

        // broadcastHandler.fireLeaveBroadcast({channel: channel, serverType: "connector", data: {playerId: msg.playerId, channelId: msg.channelId, playerName: "amey", success: true}});
        serverLog(stateOfX.serverLogType.info, "success response in make move - " + JSON.stringify(successResponse));
        next(null, successResponse);
        actionHandler.handle({ session: session, channel: channel, channelId: channelId, response: makeMoveResponse, request: msg});
      } else {
        serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
        next(null, validated);
      }
    });
  } else {
    serverLog(stateOfX.serverLogType.response, 'Make move response error - ' + JSON.stringify(makeMoveResponse));
    if(configConstants.validateGameToPreventLock) {
      broadcastHandler.fireDealerChat({channel: channel, channelId: channelId, message: ' Error while making move  - ' + JSON.stringify(makeMoveResponse)});
    }
    next(null, makeMoveResponse);
  }
      // }
}

// var schStartedTimerReference = null;
// function startScheduledWatchers() {
//   schStartedTimerReference = setTimeout(function(){
//     if(!!globalThis && globalThis.app.get("serverType") === "room") {
//       console.log("Starting scheduler idle player watchers.");
//       clearTimeout(schStartedTimerReference);
//       schStartedTimerReference = null
      
//       // Start checking idle player removal from table
//       if(!app.get('idlePlayerWatcherStarted')) {
//         serverLog(stateOfX.serverLogType.info, 'Starting idle players watcher!');
//         app.set('idlePlayerWatcherStarted', true);
//         if(configConstants.removeIdleGamePlayers) {
//           idlePlayersHandler.process({handler: handler, globalThis: globalThis})
//         }
//       } else {
//         serverLog(stateOfX.serverLogType.info, 'Idle players watcher has been already started!');
//       }

//     }
//   }, parseInt(configConstants.startSchedulerServices)*1000);
// }

// ### <<<<<<<<<<<<<<<<<<< Room-server START SCHEDULER SERVICES ENDS >>>>>>>>>>>>>>>>>>>>>>

// startScheduledWatchers();
