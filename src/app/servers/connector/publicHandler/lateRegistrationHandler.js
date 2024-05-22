/*jshint node: true */
"use strict";

// Created by Sushil on  22/10/2016
// Handles the tournamnet registration if late registratio allowed

var _                     = require('underscore'),
    keyValidator          = require("../../../../shared/keysDictionary"),
    popupTextManager  = require("../../../../shared/popupTextManager"),
    imdb                  = require("../../../../shared/model/inMemoryDbQuery.js"),
    stateOfX              = require("../../../../shared/stateOfX.js"),
    db                    = require("../../../../shared/model/dbQuery.js"),
    createtable           = require("../../../../shared/createTournamentTable.js"),
    broadcastHandler      = require('./broadcastHandler.js'),
    tournamentJoinHandler = require('./tournamentJoinHandler.js'),
    // startGameHandler      = require('./startGameHandler'),
    zmqPublish            = require("../../../../shared/infoPublisher.js"),
    async                 = require("async");

var lateRegistrationHandler = {};
/**
 * this function is for serverLog
 * @method serverLog
 * @param  {Object}  type  request json object 
 * @param  {Object}  log   request json object
 */
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'broadcastHandler';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}
/**
 * this function is to checkUserAlreadyRegistered
 * @method checkUserAlreadyRegistered
 * @param  {Object}  params  request json object 
 * @param  cb  callback function
 */
var checkUserAlreadyRegistered = function(params, cb) {
  var query = {
    playerId        : params.playerId.toString(),
    tournamentId    :params.tournamentId.toString(),
    gameVersionCount: params.gameVersionCount
  };
  db.findTournamentUser(query, function(err, tournamentUsers) {
    if(!err) {
      if(tournamentUsers.length>0) {
        serverLog(stateOfX.serverLogType.info,'tournament user is - ' + JSON.stringify(tournamentUsers[0]));
        cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBFINDTOURNAMENTUSER_USERELIMINATEDFAIL_LATEREGISTRATIONHANDLER});
        //cb({success: false, info: "You are already eliminated from this tournament"});
      } else {
        serverLog(stateOfX.serverLogType.info,'this user is not registered in tournament yet');
        cb(null, params);
      }
    } else {
      cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBFINDTOURNAMENTUSER_NOUSERFAIL_LATEREGISTRATIONHANDLER});
      //cb({success:false, info: "Error in getting tournament users"});
    }
  });
};



/**
 * Register tournament if late registration time is not over
 * @method registerTournament
 * @param  {Object}  params  request json object 
 * @param  cb  callback function
 */
var registerTournament = function(params, cb) {
  // serverLog(stateOfX.serverLogType.info,"in registerTournament in lateRegistrationHandler is - ",_.omit("session","self"));
  params.self.app.rpc.database.tournament.registerTournament(params.session, {playerId: params.playerId, tournamentId: params.tournamentId, isEligibleForRebuy: params.isEligibleForRebuy}, function(registerTournamentResponse) {
    serverLog(stateOfX.serverLogType.info,"register tournament response is - " + JSON.stringify(registerTournamentResponse));
    if(registerTournamentResponse.success) {
      console.log("Registration success ---------------------------------");
      serverLog(stateOfX.serverLogType.info,"Registration success !!!!!");
      params.isRegistrationSuccess = true; // This key is for handling refund money
      cb(null, params);
    } else {
      console.log("Registration un-success ---------------------------------");
      serverLog(stateOfX.serverLogType.info,"Registration Failed !!!!!");
      params.isRegistrationSuccess = false;
      cb(registerTournamentResponse);
    }
  });
};


/**
 * Check whether channel is available or not
 * @method isChannelAvailable
 * @param  {Object}  params  request json object 
 * @param  cb  callback function
 */
var isChannelAvailable = function(params, cb) {
  // serverLog(stateOfX.serverLogType.info,"in isChannelAvailable in lateRegistrationHandler is - ",_.omit("session","self"));
  imdb.getAllTableByTournamentId({tournamentId : params.tournamentId, gameVersionCount : params.gameVersionCount}, function(err, channels) {
    if(err || !channels || channels.length < 1) {
      serverLog(stateOfX.serverLogType.info,"Error in getting channel from in memeory db in isChannelAvailable");
      cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBGETALLTABLEBYTOURNAMENTIDFAIL_LATEREGISTRATIONHANDLER});
      //cb({success: false, info: "Channel search Failed"});
    } else {
      serverLog(stateOfX.serverLogType.info,"all channels are in isChannelAvailable - ",JSON.stringify(channels));
      var maxPlayerOnTable = channels[0].maxPlayers;
      // finding all playing players
      var playingPlayers = 0;
      for(var i=0;i<channels.length;i++) {
        for(var j=0; j<channels[i].players.length;j++) {
         if(channels[i].players[j].state === stateOfX.playerState.playing || channels[i].players[j].state === stateOfX.playerState.waiting) {
          playingPlayers++;
         }
        }
      }
      serverLog(stateOfX.serverLogType.info,'playing players are - ' + playingPlayers);
      params.playingPlayers = playingPlayers;
      channels = _.filter(channels, function(channel) { return channel.players.length < maxPlayerOnTable;});
      serverLog(stateOfX.serverLogType.info,"channels after filter is - ",JSON.stringify(channels));
      if(channels.length > 0) {
        params.isChannelAvailable = true;
        params.availableChannelId = channels[0].channelId;
        params.availableChannel = channels[0];
        params.playersInCurrentChannel = channels[0].players.length;
        serverLog(stateOfX.serverLogType.info,'playersInCurrentChannel are - ' + params.playersInCurrentChannel);
      }
      cb(null, params);
    }
  });
};

/**
 * preparePlayer to join channel with the required fields
 * @method preparePlayer
 * @param  {Object}  channel  request json object 
 * @param   {Object} player
 */
var preparePlayer = function(channel, player) {
  serverLog(stateOfX.serverLogType.info,"channel is in prepare players - " + JSON.stringify(channel));
  serverLog(stateOfX.serverLogType.info,"player is in prepare players - " + JSON.stringify(player));
  var freeIndex = (_.difference(_.range(1,channel.maxPlayers+1), _.pluck(channel.players, "seatIndex")))[0];
  serverLog(stateOfX.serverLogType.info,"free index is in preparePlayer - " + freeIndex);
  var playerData =  {
    playerId             : player.playerId,
    channelId            : channel.channelId,
    playerName           : player.playerName || player.userName,
    networkIp            : player.networkIp,
    active               : false,
    chips                : parseInt(channel.noOfChipsAtGameStart),
    seatIndex            : freeIndex,
    imageAvtar           : player.imageAvtar || "",
    cards                : [],
    moves                : [],
    preCheck             : -1,
    bestHands            : "",
    state                : stateOfX.playerState.waiting,
    lastBet              : 0,
    lastMove             : null,
    totalRoundBet        : 0,
    totalGameBet         : 0,
    isMuckHand           : false,
    preActiveIndex       : -1,
    nextActiveIndex      : -1,
    isDisconnected       : false,
    bigBlindMissed       : 0,
    isAutoReBuy          : false,
    autoReBuyAmount      : 0,
    isPlayed             : false,
    sitoutNextHand       : false,
    sitoutNextBigBlind   : false,
    autoSitout           : false,
    isSkipped            : false,
    sitoutGameMissed     : 0,
    disconnectedMissed   : 0,
    hasPlayedOnceOnTabl  : false,
    isForceBlindEnable   : true,
    isWaitingPlayer      : true,
    isStraddleOpted      : false,
    onGameStartBuyIn     : parseInt(channel.onGameStartBuyIn),
    onSitBuyIn           : parseInt(channel.onSitBuyIn),
    roundId: null,
    activityRecord: {
      seatReservedAt     : !!player.state && player.state === stateOfX.playerState.reserved ? new Date(): null,
      lastMovePlayerAt   : null,
      disconnectedAt     : null,
      lastActivityAction : "",
      lastActivityTime   : Number(new Date())
    },
    tournamentData: {
      userName           : player.userName,
      isTournamentSitout : false,
      isTimeBankUsed     : false,
      timeBankStartedAt  : null,
      totalTimeBank      : channel.timeBank,
      timeBankLeft       : channel.timeBankLeft || channel.timeBank
    }
  };
  return playerData;
};
/**
 * createChannel
 * @method createChannel
 * @param  {Object}  params  request json object 
 * @param  cb  callback function
 */
var createChannel = function(params, cb) {
  // serverLog(stateOfX.serverLogType.info,"in create channel in lateRegistrationHandler - ",_.omit("session","self"));
  if(params.isChannelAvailable) {
    db.findUser({playerId: params.playerId}, function(err, player) {
      if(err) {
        cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBFINDUSERFAIL_LATEREGISTRATIONHANDLER});
        //cb({success: false, info: "user not found in db"});
      } else {
        var updatedPlayer = [];
        params.player = preparePlayer(params.availableChannel, player);
        updatedPlayer.push(params.player);
        serverLog(stateOfX.serverLogType.info,"upadated player is - " + JSON.stringify(updatedPlayer));
        imdb.pushPlayersInTable(updatedPlayer,params.availableChannelId, function(err, result) {
          if(err) {
            cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBPUSHPLAYERSINTABLEFAIL_LATEREGISTRATIONHANDLER});
            //cb({success: false, info: "Error in pushing new players in inMemoryDb"});
          } else {
            cb(null, params);
          }
        });
      }
    });
  } else {
    createtable.createTableByTournamentId(params.tournamentId, function(response) {
      if(response.success) {
        serverLog(stateOfX.serverLogType.info,"reponse is in createtable by tournament id " + JSON.stringify(response));
        var channelId = response.table._id;
        var channel = params.self.app.get('channelService').getChannel(channelId, true);
        // create channel
        tournamentJoinHandler.createChannel({self: params.self, session: params.session, channel: channel, channelId: channelId, channelType: response.table.channelType, tableId: "",playerId: "",gameVersionCount: params.gameVersionCount}, function (createTableResponse){
          serverLog(stateOfX.serverLogType.info,"create table is in in memory is " + createTableResponse.table);
          if(createTableResponse.success) {
            serverLog(stateOfX.serverLogType.info,"channel created successfully");
            params.availableChannelId = createTableResponse.table.channelId;
            db.findUser({playerId: params.playerId}, function(err, player) {
              if(err) {
                cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBFINDUSERFAIL_LATEREGISTRATIONHANDLER});
                //cb({success: false, info: "user not found in db"});
              } else {
                var updatedPlayer = [];
                params.player = preparePlayer(createTableResponse.table, player);
                params.availableChannel = createTableResponse.table;
                updatedPlayer.push(params.player);
                serverLog(stateOfX.serverLogType.info,"upadated player is - " + JSON.stringify(updatedPlayer));
                imdb.pushPlayersInTable(updatedPlayer,params.availableChannelId, function(err, result) {
                  if(err) {
                    cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBPUSHPLAYERSINTABLEFAIL_LATEREGISTRATIONHANDLER});
                    //cb({success: false, info: "Error in pushing new players in inMemoryDb"});
                  } else {
                    cb(null, params);
                  }
                });
              }
            });
          } else {
            cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.falseMessages.ERRORCREATINGCHANNELFAIL_LATEREGISTRATIONHANDLER});
            //cb({success: false, info: "Error in creating channels"});
          }
        });
      } else {
        cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.falseMessages.ERRORCREATINGTABLEINCHANNELFAIL_LATEREGISTRATIONHANDLER});
        //cb({success: false, info: "Error in creating table in create channel"});
      }
    });
  }
};

/**
 * this function is for sending AutoJoinBroadcast
 * @method sendAutoJoinBroadcast
 * @param  {Object}  params  request json object 
 * @param    cb      callback
 */
var sendAutoJoinBroadcast = function(params, cb) {
    serverLog(stateOfX.serverLogType.info,"params in sendBrodcastForNewChannel - " + params);
    var broadcastData = {
      self: params.self,
      session: params.session,
      playerId: params.playerId,
      channelId : params.availableChannelId,
      channelType : stateOfX.gameType.tournament,
      tableId : "",
      info: "",
      forceJoin : true
    };
    broadcastHandler.autoJoinBroadcast(broadcastData);
    cb(null, params);
};

/**
 * this function is for sending SitBroadcast
 * @method sendSitBroadcast
 * @param  {Object}  params  request json object 
 * @param    cb      callback
 */
var sendSitBroadcast = function(params, cb) {
    serverLog(stateOfX.serverLogType.info,"params in sendSitBroadcast - " + params);
    var channel = params.self.app.get('channelService').getChannel(params.availableChannelId, true);
    var broadcastData = {
      self: params.self,
      channel : channel,
      player : params.player,
      table : params.availableChannel
    };
    broadcastHandler.fireSitBroadcast(broadcastData);
    cb(null, params);
};
/**
 * this function is for late Registration process through a series of async functions described above
 * @method process
 * @param  {Object}  params  request json object 
 * @param    cb      callback
 */
lateRegistrationHandler.process = function(params, cb) {
  // serverLog(stateOfX.serverLogType.info,"in process in lateRegistrationHandler is - ",_.omit("session","self"));
  params.isChannelAvailable = false;
  params.availableChannelId = "";
  params.isEligibleForRebuy = !!params.rebuy ? params.rebuy : false;
  async.waterfall([
    async.apply(checkUserAlreadyRegistered,params),
    registerTournament,
    isChannelAvailable,
    createChannel,
    sendAutoJoinBroadcast,
    sendSitBroadcast
  ], function(err, result) {
    if(err) {
      serverLog(stateOfX.serverLogType.info,"err - " + JSON.stringify(err));
      // If registration success then return money
      if(params.isRegistrationSuccess) {
        serverLog(stateOfX.serverLogType.info,"registration is failed refunding money --- ");
        params.self.app.rpc.database.tournament.deRegisterTournament(params.session, {playerId: params.playerId, tournamentId: params.tournamentId, gameVersionCount: params.gameVersionCount}, function(registerTournamentResponse) {
          serverLog(stateOfX.serverLogType.info,"deRegistration success");
          cb(err);
        });
      } else {
        cb(err);
      }
    } else {
      serverLog(stateOfX.serverLogType.info,'playing players is in waterfall - ' + params.playingPlayers);
      serverLog(stateOfX.serverLogType.info,'playersInCurrentChannel is in waterfall - ' + params.playersInCurrentChannel);
      if(params.playingPlayers < 2 || params.playersInCurrentChannel<2) {
        var paramsData = {
            self: params.self,
            session: "session",
            channelId: params.availableChannelId,
            channel: params.self.app.get('channelService').getChannel(params.availableChannelId, false),
            eventName: stateOfX.startGameEvent.tournament
          };
          serverLog(stateOfX.serverLogType.info,'GOING TO START GAME IN LATE REGISTRTION HANDLER --------');
          startGameHandler.startGame(paramsData);
      }
      cb({success: true,isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.falseMessages.PROCESS_TRUE_LATEREGISTRATIONHANDLER});
      //cb({success: true, info: "player joined successfully"});
    }
  });
};

module.exports = lateRegistrationHandler;
