/*jshint node: true */
"use strict";

// This file is used to handle start game manipulation

// ### External files and packages declaration ###
var _                      = require("underscore"),
    async                  = require("async"),
    schedule               = require('node-schedule'),
    keyValidator           = require("../../../../../shared/keysDictionary"),
    stateOfX               = require("../../../../../shared/stateOfX.js"),
    db                     = require("../../../../../shared/model/dbQuery.js"),
    imdb                   = require("../../../../../shared/model/inMemoryDbQuery.js"),
    zmqPublish             = require("../../../../../shared/infoPublisher.js"),
    ofcBroadcastHandler    = require('./ofcBroadcastHandler'),
    ofcChannelTimerHandler = require("./ofcChannelTimerHandler"),
    ofcActionLogger        = require("./ofcActionLogger");
const configConstants = require('../../../../../shared/configConstants');
function ofcStartGameHandler() {}
var pomelo = require('pomelo');
// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'ofcStartGameHandler';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

// Fire turn broadcast if required after Game start cases

var fireGameStartTurnBroadcast = function (params, handleGameStartResponse) {
  if(handleGameStartResponse.turns.length > 0) {
    for (var i = 0; i < handleGameStartResponse.turns.length; i++) {
      handleGameStartResponse.turns[i].self = params.self;
      handleGameStartResponse.turns[i].channel = params.channel;
      ofcBroadcastHandler.fireOnTurnBroadcast(handleGameStartResponse.turns[i], function(fireOnTurnBroadcastResponse){
        if(fireOnTurnBroadcastResponse.success) {
         ofcChannelTimerHandler.startTurnTimeOut(params);
        } else {
          serverLog(stateOfX.serverLogType.error, 'Unable to broadcast turn, in Game start auto turn condition!');
        }
      });
    }
  }
};

var countCurrentPlayers = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "channelId is in change state of tornament is  ",params.channelId);
  var channelId = params.channelId.toString();
  db.findTableById(channelId, function(err,channel) {
    if(err || !channel || channel.channelType === stateOfX.gameType.normal) {
      serverLog(stateOfX.serverLogType.info, "Change Tournament state failed,  No channel found or NORMAL game is running !", err);
      cb({success: false});
    } else {
      serverLog(stateOfX.serverLogType.info, "channel in changeStateOfTournament is - ",JSON.stringify(channel));
      var tournamentId = (channel.tournament.tournamentId).toString();
      serverLog(stateOfX.serverLogType.info, "tournament ID is in changeStateOfTournament -",tournamentId);
      imdb.findChannels({tournamentId: tournamentId}, function(err, channels) {
        serverLog(stateOfX.serverLogType.info, "channels is getting players in changeStateOfTournament is - ",JSON.stringify(channels));
        if(err) {
         serverLog(stateOfX.serverLogType.info, "Error in getting channels from db in changeStateOfTournament in changeStateOfTournament");
         cb({success: false});
        } else {
          serverLog(stateOfX.serverLogType.info, "+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++");
          var playingPlayers = 0;
          var playerIds = [];
          var allPlayers = [];
          for(var i=0; i<channels.length; i++) {
            serverLog(stateOfX.serverLogType.info, "current channel is - " + JSON.stringify(channels[i]));
            allPlayers = allPlayers.concat(channels[i].players);
            var playingPlayerList  = _.where(channels[i].players,{state: stateOfX.playerState.playing});
            var waitingPlayerList  = _.where(channels[i].players,{state: stateOfX.playerState.waiting});
            serverLog(stateOfX.serverLogType.info, "waiting playerList - " + JSON.stringify(waitingPlayerList));
            serverLog(stateOfX.serverLogType.info, "playingPlayerList playerList - " + JSON.stringify(playingPlayerList));
            playingPlayers = playingPlayers + playingPlayerList.length + waitingPlayerList.length;

            serverLog(stateOfX.serverLogType.info, "playing players - " + JSON.stringify(playingPlayerList));
            // playerIds = _.pluck(playingPlayerList,"playerId");
            serverLog(stateOfX.serverLogType.info, playerIds);
          }
          serverLog(stateOfX.serverLogType.info, "playingPlayers is in getPlayingPlayers on changeStateOfTournament is " + playingPlayers);
          if(playingPlayers === 1) {
            playerIds = _.pluck(allPlayers, "playerId");
          }
          cb({success: true, playersCount : playingPlayers, tournamentId : tournamentId, channels : channels, playerIds: playerIds});
        }
      });
    }
  });
};

// Fire round over broadcast if required after Game start cases

var fireGameStartRoundOverBroadcast = function (params, handleGameStartResponse) {
  if(handleGameStartResponse.isRoundOver) {
    serverLog(stateOfX.serverLogType.info, 'About to fire Round over broadcast on Game start');
    handleGameStartResponse.round.self = params.self;
    handleGameStartResponse.round.channel = params.channel;
    ofcBroadcastHandler.fireRoundOverBroadcast(handleGameStartResponse.round);
  }
};

// Fire Game over broadcast if required after Game start cases

var fireGameStartGameOverBroadcast = function (params, handleGameStartResponse, table) {
  if(handleGameStartResponse.isGameOver) {
    serverLog(stateOfX.serverLogType.info, 'About to fire Game over broadcast on Game start');
    startTournamentHandler.eliminationProcess(params.self,table);
    handleGameStartResponse.over.self = params.self;
    handleGameStartResponse.over.channel = params.channel;
    handleGameStartResponse.over.session = params.session;
    // createEventLog ({self: params.self, session: params.session, channel: params.channel, data: {channelId: params.channelId, eventName: stateOfX.logEvents.gameOver, rawData: {}}});
    // createEventLog ({self: params.self, session: params.session, channel: params.channel, data: {channelId: params.channelId, eventName: stateOfX.logEvents.summary, rawData: {}}});
    ofcBroadcastHandler.fireGameOverBroadcast(handleGameStartResponse.over);
    setTimeout(function(){
      ofcStartGameHandler.startGame({self: params.self, session: params.session, channelId: params.channelId, channel: params.channel});
    }, (configConstants.deleayInGames)*1000);
  }
};

// ### Handle exceptional behavior

var handleAdditionalCases = function (params) {
  keyValidator.validateKeySets("Request", "connector", "handleAdditionalCases", params, function (validated){
    if(validated.success) {
      params.self.app.rpc.database.tableRemote.processCases(params.session, {serverType: "connector", channelId: params.channelId}, function (processCasesResponse) {
        serverLog(stateOfX.serverLogType.info, 'processCasesResponse ------> ' + JSON.stringify(processCasesResponse));
        if(processCasesResponse.success) {
          var handleGameStartResponse = processCasesResponse.data.overResponse;

          // Handle if there are ALLIN turn occur during game start
          fireGameStartTurnBroadcast(params, handleGameStartResponse);

          // Broadcast round over data if the Round is Over
          fireGameStartRoundOverBroadcast(params, handleGameStartResponse);

          // Handle if Game Over occur due to ALLIN occur on game start
          fireGameStartGameOverBroadcast(params, handleGameStartResponse,processCasesResponse.table);

        } else {
          serverLog(stateOfX.serverLogType.error, processCasesResponse);
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.error, validated);
    }
  });
};


// ### Reset values after Game over
var resetChannelValues = function (params) {
  serverLog(stateOfX.serverLogType.info, "params in resetChannelValues");
  serverLog(stateOfX.serverLogType.info, params);
  // killChannelLevelTimers(params);
};

// sending broadcast to channels when all channels is on break
var sendBroadcastForBreakTimer = function(params) {
  serverLog(stateOfX.serverLogType.info, "in send broadcastForBreakTimer - " + params.allChannels);
  for(var channelIt = 0; channelIt < params.allChannels.length; channelIt++) {
    var channel = params.self.app.get('channelService').getChannel(params.allChannels[channelIt], true);
    ofcBroadcastHandler.sendBroadcastForBreakTimer({channel : channel, breakTime : params.tournamentBreakDuration});
  }
};

// start the game of all the channels after break
var scheduleNextGameStart = function(params) {
  var gameResumeTime = Number(new Date()) + params.tournamentBreakDuration;
  serverLog(stateOfX.serverLogType.info, "game resume time is - " + new Date(gameResumeTime));
  //prepare collection for async operation
  var channelsArray = [];
  for(var channelIt = 0; channelIt < params.allChannels.length; channelIt++) {
    channelsArray.push({
      channelId : params.allChannels[channelIt]
    });
  }
  schedule.scheduleJob(gameResumeTime, function(){
    async.eachSeries(channelsArray, function(channel, callback) {
      imdb.updateSeats(channel.channelId,{isOnBreak : false}, function(err, result) {
        if(err) {
          serverLog(stateOfX.serverLogType.info, "Error in updating isOnBreak key");
        } else {
          var params = {
            tournamentId : params.channelDetails.tournamentId,
            gameVersionCount: params.channelDetails.gameVersionCount,
            self : params.self,
            session : "session"
          };
          startTournamentHandler.process(params, function(tournamentStartResponse){
            serverLog(stateOfX.serverLogType.info, "tournament process response", tournamentStartResponse);
            callback();
          });
        }
      });
    }, function(err) {
      serverLog(stateOfX.serverLogType.info, "error in scheduleNextGameStart is  - " + err);
    });
  });
};

// Intialize params that will be used during calculation
var initializeParams = function(params, cb) {
  params.data                       = {};
  params.removedPlayerList          = [];
  params.data.startGame             = false;
  params.data.deductBlindsResponse  = null;
  params.data.players               = [];
  params.data.tableDetails          = null;
  serverLog(stateOfX.serverLogType.info, "params in  initializeParams - " + _.keys(params));
  cb(null, params);
};

//breakManagement
var breakManagement = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "In breakManagement ", params.channelId);
  params.self.app.rpc.database.breakManagement.process(params.session, {channelId: params.channelId}, function (breakManagementResponse) {
    serverLog(stateOfX.serverLogType.info, "breakManagementResponse is - " + JSON.stringify(breakManagementResponse));
    if(breakManagementResponse.success) {
      //No need to give break
      if(!breakManagementResponse.eligibleForBreak) {
        serverLog(stateOfX.serverLogType.info, "Not eligible for break");
        cb(null, params);
      } else {
        //channel is eligible for break
        // send broadcast to channel for break
        ofcBroadcastHandler.sendBroadcastForBreak(params);
        if(breakManagementResponse.isTimeToStartBreakTimer) {
          //send broadcast to all channels for timer
          // start timer for break;
          params.allChannels = breakManagementResponse.allChannels;
          params.tournamentBreakDuration = breakManagementResponse.tournamentBreakDuration;
          sendBroadcastForBreakTimer(params);
          scheduleNextGameStart(params);
        }
        cb({success: false, info: "Time to break"});
      }
    } else {
      cb(breakManagementResponse);
    }
  });
};

// Shuffle players for tournament
var shuffleTournamentPlayers = function (params, cb) {
  if(params.channel.channelType === stateOfX.gameType.tournament) {
    params.self.app.rpc.database.tableRemote.shufflePlayers(params.session, {channelId: params.channelId}, function (shufflePlayersResponse) {

      serverLog(stateOfX.serverLogType.info, 'shufflePlayersResponse - ' + JSON.stringify(shufflePlayersResponse));

      if(shufflePlayersResponse.success && shufflePlayersResponse.isPlayerShuffled) {
        // TODO: Broadcast player, current table and new table
        // 1. Broadcast Player: {playerId: , channelId: }
        // 2. Broadcast to current table: push this playerId in removed array
        // 3. Broadcast to new table: Get player details (channelId, playerId, chips, seatIndex, playerName, imageAvtar)
        // > and fire sit broadcast in new channel
        serverLog(stateOfX.serverLogType.info, "current channel id is - ",params.channelId);
        params.removedPlayerList = shufflePlayersResponse.outOfMoneyPlayers;

        serverLog(stateOfX.serverLogType.info, "Players to removed from shuffling - " + params.removedPlayerList);

        async.each(shufflePlayersResponse.shiftedPlayersData, function(player, callback) {
          serverLog(stateOfX.serverLogType.info, "player in shuffleTournamentPlayers in ofcStartGameHandler is - ",JSON.stringify(player));
          var broadcastData = {
            self: params.self,
            session: params.session,
            playerId: player.playerId,
            newChannelId: player.channelId,
            channelId : params.channelId
          };
          var data = {
            success     : true,
            channelId   : params.channelId,
            playerId    : player.playerId,
            playerName  : player.playerName
          };
          var channelObject = params.self.app.get('channelService').getChannel(player.channelId, false);

          ofcBroadcastHandler.fireLeaveBroadcast({channel: params.channel, serverType: "connector", data: data});
          params.channel.leave(player.playerId, params.self.app.get('serverId'));

          ofcBroadcastHandler.fireNewChannelBroadcast(broadcastData);
          broadcastData.chips      = player.chips;
          broadcastData.seatIndex  = player.seatIndex;
          broadcastData.playerName = player.playerName;
          broadcastData.imageAvtar = player.imageAvtar;
          broadcastData.channel    = params.self.app.get('channelService').getChannel(player.channelId, false);

          ofcBroadcastHandler.fireSitBroadcastInShuffling(broadcastData);
          if(player.channelId != params.channelId) {
            ofcStartGameHandler.startGame({self: params.self, session: params.session, channelId: player.channelId, channel: params.self.app.get('channelService').getChannel(player.channelId, false)});
          } else {
            serverLog(stateOfX.serverLogType.info, 'Not starting game for current table, skipping!');
          }
          callback();
        }, function(err) {
          if(err) {
            serverLog(stateOfX.serverLogType.info, "Error in player shuffling in shuffle tournament players");
            cb(params);
          } else {
            cb(null, params);
          }
        });
      } else if(shufflePlayersResponse.success && !shufflePlayersResponse.isPlayerShuffled) {
        serverLog(stateOfX.serverLogType.info, "No shuffling required this is not a tournament");
        cb(null, params);
      } else {
        cb(shufflePlayersResponse);
      }
    });
  } else {
    serverLog(stateOfX.serverLogType.info, 'Skipping shuffling as channel is for - ' + params.channel.channelType + ' table game.');
    cb(null, params);
  }
};

var removeWinnerPlayerInTournament = function(params,cb) {
  if(params.channel.channelType === stateOfX.gameType.tournament) {
    serverLog(stateOfX.serverLogType.info, "params is in removeWinnerPlayerInTournament in ofcStartGameHandler - " + JSON.stringify(params.channelId));
    countCurrentPlayers(params, function(response) {
      serverLog(stateOfX.serverLogType.info, "response of countCurrentPlayers is - ",JSON.stringify(response));
      if(response.success && response.playersCount === 1) {
        params.removedPlayerList = params.removedPlayerList.concat(response.playerIds);
        serverLog(stateOfX.serverLogType.info, "removed playersIds in remove winner is - " + JSON.stringify(params.removedPlayerList));
      }
      cb(null, params);
    });
  } else {
    serverLog(stateOfX.serverLogType.info, 'Skipping winner player reward distribution, as channel is for - ' + params.channel.channelType + ' table game.');
    cb(null, params);
  }
};

// Validate if Game is going to start or not

var validateStartGame = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcStartGameHandler function validateStartGame !');
  params.self.app.rpc.database.ofcRequestRemote.ofcShouldStartGame(params.session, {channelId: params.channelId}, function (shouldStartGameResponse) {
    serverLog(stateOfX.serverLogType.info, 'shouldStartGameResponse - ' + JSON.stringify(shouldStartGameResponse));
    params.data.startGame    = shouldStartGameResponse.startGame;
    params.data.players      = shouldStartGameResponse.players;
    params.data.state        = shouldStartGameResponse.state;
    params.data.removed      = shouldStartGameResponse.removed;
    params.data.preGameState = shouldStartGameResponse.preGameState;
    params.data.tableDetails = shouldStartGameResponse.tableDetails;

    if(params.data.startGame) {
      params.data.dealerIndex      = shouldStartGameResponse.dealerIndex;
      params.data.currentMoveIndex = shouldStartGameResponse.currentMoveIndex;
      params.data.roundName        = shouldStartGameResponse.roundName;
      params.data.currentCards     = shouldStartGameResponse.currentCards;
      params.data.currentPlayerId  = shouldStartGameResponse.currentPlayerId;
    }

    if(shouldStartGameResponse.success) {

      params.data.startGame = shouldStartGameResponse.startGame;
      params.data.players   = shouldStartGameResponse.players;
      params.data.state     = shouldStartGameResponse.state;
      params.data.removed   = shouldStartGameResponse.removed;

      if(params.data.state !== stateOfX.gameState.running) {
        ofcChannelTimerHandler.ofcKillChannelTurnTimer(params);
      }
      cb(null, params);
    } else {
      cb(null, params);
    }
  });
};

// Send Game players broadcast

var fireGamePlayersBroadcast = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcStartGameHandler function fireGamePlayersBroadcast from event - ' + params.eventName + ' !');
  serverLog(stateOfX.serverLogType.info, 'Previous Game state - ' + params.data.preGameState + ' !');
  // Broadcast game players with state (Do not send when a game is running)
  if((params.eventName === stateOfX.OFCstartGameEvent.gameOver) || ((params.eventName === stateOfX.OFCstartGameEvent.addPoints || params.eventName === stateOfX.OFCstartGameEvent.sit) && params.data.preGameState !== stateOfX.gameState.running)) {
    serverLog(stateOfX.serverLogType.info, 'Game is not running on this table, sending Game players broadcast! - ' + JSON.stringify(params.data));
    ofcBroadcastHandler.fireOFCgamePlayersBroadcast({self: params.self, channelId: params.channelId, channel: params.channel, players: params.data.players, removed: params.data.removed});
    cb(null, params);
  } else {
    serverLog(stateOfX.serverLogType.info, 'Game is already running so avoiding Game players broadcast!');
    cb(null, params);
  }
};

// Start seat reserve timer for players with OUTOFMONEY state

var setOnBreakAndStartReserveTimer = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcStartGameHandler function setOnBreakAndStartReserveTimer !');
  async.each(params.data.players, function(player, ecb){
    serverLog(stateOfX.serverLogType.info, 'Processing player for bankrupt to onBreak - ' + JSON.stringify(player));
    if(player.state === stateOfX.playerState.outOfMoney) {
      params.self.app.rpc.database.tableRemote.setPlayerAttrib(params.session, {playerId: player.playerId, channelId: params.channelId, key: "state", value: stateOfX.playerState.onBreak}, function (setPlayerAttribResponse) {
        if(setPlayerAttribResponse.success) {
          serverLog(stateOfX.serverLogType.info, player.playerName + ' is bankrupt and onBreak now.');
          ofcBroadcastHandler.firePlayerStateBroadcast({channel: params.channel, self: params.self, playerId: player.playerId, channelId: params.channelId, state: stateOfX.playerState.onBreak});
          ecb();
        } else {
          ecb({success: false, channelId: params.channelId, info: "Setting bankrupt player state as onbreak failed!"});
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.info, player.playerName + ' is not bankrupt - ' + player.state);
      ecb();
    }
  }, function(err) {
    if(err) {
      serverLog(stateOfX.serverLogType.info, 'ON GAME START || Setting bankrupt players state as onbreak - FAILED');
    } else {
      serverLog(stateOfX.serverLogType.info, 'ON GAME START || Setting bankrupt players state as onbreak - SUCCESS');
    }
    cb(null, params);
  });
};

// Continue if Game is going to start or not

var checkGameStart = function(params, cb) {
  if(params.data.startGame) {
    cb(null, params);
  } else {
    cb({success: false, channelId: params.channelId, info: 'No need to start game in this case, reset table and player!'});
  }
};

// Reset table if Game is not going to start

var resetTableOnNoStart = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'resetTableOnNoStart startgame - ' + params.data.startGame + ' && state - ' + params.table.state);
  if(!params.data.startGame && params.table.state === stateOfX.gameState.idle) {
    serverLog(stateOfX.serverLogType.info, 'Resetting table and players as Game is not going to start and state is - ' + params.table.state);

    // Resetting table
    params.table.roundId               = null;
    params.table.deck                  = [];
    params.table.roundName             = null;
    params.table.roundBets             = [];
    params.table.roundMaxBet           = 0;
    params.table.maxBetAllowed         = 0;
    params.table.pot                   = [];
    params.table.contributors          = [];
    params.table.roundContributors     = [];
    params.table.boardCard             = [[], []];
    params.table.preChecks             = [];
    params.table.isAllInOcccured       = false;
    params.table.isOperationOn         = false;
    params.table.actionName            = "";
    params.table.isAllInOcccured       = false;
    params.table._v                    = 1;

    // Resetting players
    for (var i = 0; i < params.table.players.length; i++) {
      if(params.table.players[i].state === stateOfX.playerState.playing) {
        serverLog(stateOfX.serverLogType.info, 'Setting player ' + params.table.players[i].playerName + ' state as waiting and inactive.');
        params.table.players[i].state   = stateOfX.playerState.waiting;
        params.table.players[i].active  = stateOfX.playerState.false;
      }
    }
  }
  cb(null, params);
};

// Set configuration on the table (Dealer, Small Blind, Big Blind and Straddle players)

var setGameConfig = function(params, cb) {
  params.self.app.rpc.database.tableRemote.setGameConfig(params.session, {channelId: params.channelId}, function (setGameConfigResponse) {
    if(setGameConfigResponse.success) {
      cb(null, params);
    } else {
      cb(setGameConfigResponse);
    }
  });
};


// Fire start game broadcast on channel

var fireStartGameBroadcast = function(params, cb) {
  params.self.app.rpc.database.tableRemote.tableConfig(params.session, {channelId: params.channelId}, function (tableConfigResponse) {
    if(tableConfigResponse.success) {
      params.data.tableDetails  = tableConfigResponse;
      params.broadcastData      = tableConfigResponse.config;
      ofcBroadcastHandler.fireStartGameBroadcast(params, function(fireStartGameBroadcastReseponse){
        serverLog(stateOfX.serverLogType.info, 'fireStartGameBroadcastReseponse');
        serverLog(stateOfX.serverLogType.info, fireStartGameBroadcastReseponse);
        if(fireStartGameBroadcastReseponse.success) {
         ofcChannelTimerHandler.startTurnTimeOut(params);
          cb(null, params);
        } else {
          cb(fireStartGameBroadcastReseponse);
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.error, 'startGame broadcast failed !' + JSON.stringify(tableConfigResponse));
      cb(tableConfigResponse);
    }
  });
};

// Fire precheck broadcast to individual players

var firePrecheckBroadcast = function(params, cb) {
  params.self.app.rpc.database.tableRemote.getTableAttrib(params.session, {channelId: params.channelId, key: "preChecks"}, function (getTableAttribResponse) {
    if(getTableAttribResponse.success) {
      getTableAttribResponse.value.self      = params.self;
      getTableAttribResponse.value.session   = params.session;
      getTableAttribResponse.value.channelId = params.channelId;
      ofcBroadcastHandler.firePrecheckBroadcast(getTableAttribResponse.value);
      cb(null, params);
    } else {
      cb(getTableAttribResponse);
    }
  });
};
var killChannel = function (self,channels) {
  serverLog(stateOfX.serverLogType.info, "channels is in killChannel are - ",JSON.stringify(channels));
  async.each(channels, function(channelObject, callback) {
    var channel  = self.app.get('channelService').getChannel(channelObject.channelId, false);
    channel.isTable = false;
    if(channel) {
      channel.destroy();
      serverLog(stateOfX.serverLogType.info, "channel destroy successfully");
      callback();
    } else {
      serverLog(stateOfX.serverLogType.info, "no channel found in pomelo");
      callback();
    }
  }, function(err) {
    if(err) {
      serverLog(stateOfX.serverLogType.info, "error in deleting channel from pomelo");
    } else {
      serverLog(stateOfX.serverLogType.info, "all channel deleted successfully in async");
    }
  });
};


var changeStateOfTournament = function(params) {
  serverLog(stateOfX.serverLogType.info, "channelId is in change state of tornament is  ",params.channelId);
  var channelId = params.channelId.toString();
  countCurrentPlayers(params, function(countPlayersResponse) {
    serverLog(stateOfX.serverLogType.info, "countPlayersResponse is in change state of tournament is - " + JSON.stringify(countPlayersResponse));
    if(countPlayersResponse.success && countPlayersResponse.playersCount === 1) {
      params.self.app.rpc.database.rewardRake.tournamentRakeProcess(params.session,{tournamentId : countPlayersResponse.tournamentId}, function (rakeResponse) {
        serverLog(stateOfX.serverLogType.info, "response from tournament rake - " + JSON.stringify(rakeResponse));
        db.updateTournamentStateAndVersion(countPlayersResponse.tournamentId,stateOfX.tournamentState.finished,function(err, response) {
          if(err || !response) {
            serverLog(stateOfX.serverLogType.info, "Error in state and version update");
          } else {
            serverLog(stateOfX.serverLogType.info, "updated tournament state successfully",JSON.stringify(response));
            serverLog(stateOfX.serverLogType.info, "response._id,response.gameVersionCount-1 -- ",response._id,response.gameVersionCount-1);
            params.self.app.rpc.database.rewardRake.tournamentRakeProcess(params.session,{tournamentId : response._id}, function (rakeResponse) {
              serverLog(stateOfX.serverLogType.info, "response from tournament rake - " + JSON.stringify(rakeResponse));
            });
            killChannel(params.self,countPlayersResponse.channels);
            dynamicRanks.getRegisteredTournamentUsers(response._id,response.gameVersionCount-1);
          }
        });
      });
    } else {
      serverLog(stateOfX.serverLogType.info, "Error in getting current users");
    }
  });
};

// Fire Dealer chat broadcast on Game start

var fireDealerChatGameStart = function(params, cb) {
  ofcActionLogger.createEventLog ({
    self: params.self,
    session: params.session,
    channel: params.channel,
    data: {
      channelId: params.channelId,
      eventName: stateOfX.logEvents.startGame,
      rawData: {players: params.data.players}
    }
  });
  cb(null, params);
};

// Fire dealer chat for table info

var fireDealerChatTableInfo = function(params, cb) {
  console.log(params.data);
  ofcActionLogger.createEventLog ({
    self: params.self,
    session: params.session,
    channel: params.channel,
    data: {
      channelId: params.channelId,
      eventName: stateOfX.logEvents.tableInfo,
      rawData: params.data.tableDetails
    }
  });
  cb(null, params);
};

var handleNoStartGameCase = function(params, cb) {
  if(!params.data.startGame) {
    cb(null, params);
  } else {
    cb(null, params);
  }
};

var fireOFCstartGameBroadcast = function(params, cb){
  ofcBroadcastHandler.fireOFCstartGameBroadcast({self: params.self, channel: params.channel, channelId: params.channelId, dealerIndex: params.data.dealerIndex, currentMoveIndex: params.data.currentMoveIndex, state: params.data.state, roundName: params.data.roundName}, function(startGameBroadcastResponse){
    if(startGameBroadcastResponse.success){
      cb(null, params);
    } else {
      cb(startGameBroadcastResponse);
    }
  });
};

var fireCurrentPlayerCards = function(params, cb){
  ofcBroadcastHandler.fireOFCfirstRoundCards({channel: params.channel, channelId: params.channelId, playerId: params.data.currentPlayerId, cards: params.data.currentCards}, function(ofcPlayerCardsResponse){
    if(ofcPlayerCardsResponse.success){
      cb(null, params);
    } else {
      cb(ofcPlayerCardsResponse);
    }
  });

  // ofcBroadcastHandler.fireOFCplayerCards({self: params.self, channelId: params.channelId, playerId: params.data.currentPlayerId, cards: params.data.currentCards}, function(ofcPlayerCardsResponse){
  //   if(ofcPlayerCardsResponse.success){
  //     cb(null, params);
  //   } else {
  //     cb(ofcPlayerCardsResponse);
  //   }
  // });
};

var startOFCturnTimer = function(params, cb) {
  params.data.currentPlayerCards           = {top: [], middle: [], bottom: []};
  params.data.currentPlayerRoundName       = stateOfX.ofcRound.one;
  params.data.isCurrentPlayerInFantasyLand = params.data.tableDetails.isCurrentPlayerInFantasyLand;
  ofcChannelTimerHandler.ofcStartTurnTimeOut(params);
  cb(null, params);
};

var handleStartGameCase = function(params, cb) {
  if(params.data.startGame) {
    async.waterfall([
      async.apply(fireCurrentPlayerCards, params),
      fireOFCstartGameBroadcast,
      fireDealerChatTableInfo,
      fireDealerChatGameStart,
      startOFCturnTimer
    ], function(err, response){
      if(!err && response) {
        cb(null, params);
      } else {
        cb({success: false, channelId: params.channelId, info: "Unable to process Game start cases."});
      }
    });
  } else {
    cb(null, params);
  }
};

// Handle start game and validate everything before starting a game

ofcStartGameHandler.ofcStartGame = function (params) {
  keyValidator.validateKeySets("Request", "connector", "ofcStartGame", params, function (validated){
    if(validated.success) {
      async.waterfall([
        async.apply(initializeParams, params),
        validateStartGame,
        fireGamePlayersBroadcast,
        handleNoStartGameCase,
        handleStartGameCase
      ], function(err, response){
        if(err && !response) {
          serverLog(stateOfX.serverLogType.error, 'Game will not start, REASON - ' + JSON.stringify(err));
        } else {
          // handleAdditionalCases(params);
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.info, 'Start game key validation response - ' + JSON.stringify(validated));
    }
  });
};

module.exports = ofcStartGameHandler;