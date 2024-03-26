/*jshint node: true */
"use strict";

// This file is used to handle start game manipulation

// ### External files and packages declaration ###
var _                       = require("underscore"),
    async                   = require("async"),
    schedule                = require('node-schedule'),
    keyValidator            = require("../../../../shared/keysDictionary"),
    stateOfX                = require("../../../../shared/stateOfX.js"),
    db                      = require("../../../../shared/model/dbQuery.js"),
    imdb                    = require("../../../../shared/model/inMemoryDbQuery.js"),
    activity                = require("../../../../shared/activity.js"),
    zmqPublish              = require("../../../../shared/infoPublisher.js"),
    popupTextManager        = require("../../../../shared/popupTextManager"),
    // dynamicRanks            = require("../../database/remote/dynamicRanks.js"),
    // calculateRanks          = require("../../database/remote/calculateRanks.js"),
    channelTimerHandler     = require("./channelTimerHandler"),
    startTournamentHandler  = require("./startTournamentHandler"),
    broadcastHandler        = require('./broadcastHandler'),
    // channelTimerHandler     = require("./channelTimerHandler"),
    tournamentActionHandler = require("./tournamentActionHandler"),
    actionLogger            = require("./actionLogger");

var serverDownManager = require("../../../util/serverDownManager");
const configConstants = require('../../../../shared/configConstants');
function startGameHandler() {}
var pomelo = require('pomelo');
// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'startGameHandler';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

// handleAdditionalCases - game start - blinds allin cases - SPECIAL in file

// Fire turn broadcast if required after Game start cases
var fireGameStartTurnBroadcast = function (params, handleGameStartResponse) {
  if(handleGameStartResponse.turns.length > 0) {

    // kill first turn timer, if turns are there in this case
    clearTimeout(params.channel.firstTurnTimer);

    for (var i = 0; i < handleGameStartResponse.turns.length; i++) {
      // handleGameStartResponse.turns[i].self = params.self;
      handleGameStartResponse.turns[i].channel = params.channel;
      broadcastHandler.fireOnTurnBroadcast(handleGameStartResponse.turns[i], function(fireOnTurnBroadcastResponse){
        if(fireOnTurnBroadcastResponse.success) {
         ///////////////////////////////////////////////////
         channelTimerHandler.startTurnTimeOut(params); //
         console.error("@@@@@@@@@@!!!!!!!!!!!@@@@@@@@@@@!!!!!!!!!!!!!");
         ///////////////////////////////////////////////////
         // Commenting this out in order to prevent multiple timer start for 
         // first player with move as a timer might have been started
         // on normal game start broadcast fire event
        } else {
          serverLog(stateOfX.serverLogType.error, 'Unable to broadcast turn, in Game start auto turn condition!');
        }
      });
    }
  }
};

// tournament
var getTournamentRoom = function(tournamentId, cb) {
  serverLog(stateOfX.serverLogType.info, "tournamentId is in getTournamentRoom is  ",tournamentId);
  db.getTournamentRoom(tournamentId, function(err, tournament) {
    if(err || !tournament) {
      // cb({success: false, info: "No tournament room found"});
      cb({success: false, isRetry: false, isDisplay: true, info: popupTextManager.falseMessages.DBGETTOURNAMENTROOMFAIL_TOURNAMENT,channelId: ""});
    } else {
      cb({success: true, isTournamentRunning : tournament.isTournamentRunning});
    }
  });
};

// tournament
var countCurrentPlayers = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "channelId is in change state of tornament is  ",params.channelId);
  channelId = params.channelId.toString();
  db.findTableById(channelId, function(err,channel) {
    if(err || !channel || channel.channelType === stateOfX.gameType.normal) {
      serverLog(stateOfX.serverLogType.info, "Change Tournament state failed,  No channel found or NORMAL game is running !", err);
      cb({success: false});
    } else {
      serverLog(stateOfX.serverLogType.info, "channel in changeStateOfTournament is - ",JSON.stringify(channel));
      var tournamentId = (channel.tournament.tournamentId).toString();
      serverLog(stateOfX.serverLogType.info, "tournament ID is in changeStateOfTournament -",tournamentId);
      imdb.findChannels({tournamentId: tournamentId}, function(err, channels) {
        serverLog(stateOfX.serverLogType.info, "channels is getting players in changeStateOfTournament is - " + JSON.stringify(channels));
        if(err) {
         serverLog(stateOfX.serverLogType.info, "Error in getting channels from db in changeStateOfTournament in changeStateOfTournament");
         cb({success: false});
        } else {
          var playingPlayers = 0;
          var playerIds = [];
          var allPlayers = [];
          for(var i=0; i<channels.length; i++) {

            serverLog(stateOfX.serverLogType.info, "current channel is - " + JSON.stringify(channels[i]));
            allPlayers            = allPlayers.concat(channels[i].players);
            var playingPlayerList = _.where(channels[i].players,{state: stateOfX.playerState.playing});
            var waitingPlayerList = _.where(channels[i].players,{state: stateOfX.playerState.waiting});
            serverLog(stateOfX.serverLogType.info, "waiting playerList - " + JSON.stringify(waitingPlayerList));
            serverLog(stateOfX.serverLogType.info, "playingPlayerList playerList - " + JSON.stringify(playingPlayerList));
            playingPlayers        = playingPlayers + playingPlayerList.length + waitingPlayerList.length;

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
    // handleGameStartResponse.round.self = params.self;
    handleGameStartResponse.round.channel = params.channel;
    broadcastHandler.fireRoundOverBroadcast(handleGameStartResponse.round);
    // channelTimerHandler.killChannelTurnTimer({channel: params.channel});
  }
};

// Fire Game over broadcast if required after Game start cases
var fireGameStartGameOverBroadcast = function (params, handleGameStartResponse, table) {
  if(handleGameStartResponse.isGameOver) {
    serverLog(stateOfX.serverLogType.info, 'About to fire Game over broadcast on Game start');
    if(params.channel.channelType === stateOfX.gameType.tournament) {
      startTournamentHandler.eliminationProcess(params.self, table);
    }

    // Kill chennel level timer for player turn as Game is over
    if(!handleGameStartResponse.isGameOver) {
      channelTimerHandler.startTurnTimeOut(params);
    } else {
      serverLog(stateOfX.serverLogType.error,'Not starting channel turn timer and resetting previous ones as Game is over now, ON GAME START OVER!');
      channelTimerHandler.killChannelTurnTimer({channel: params.channel});
    }

    serverLog(stateOfX.serverLogType.info, 'Keys in Game over initial level over - ' + JSON.stringify(_.keys(handleGameStartResponse.over)));
    serverLog(stateOfX.serverLogType.info, 'Keys in Game over initial level over.data - ' + JSON.stringify(_.keys(handleGameStartResponse.over.data)));
    actionLogger.createEventLog ({ session: params.session, channel: params.channel, data: {channelId: params.channelId, eventName: stateOfX.logEvents.gameOver, rawData: _.omit(handleGameStartResponse.over, 'self', 'session', 'channel')}});
    setTimeout(function() {
      actionLogger.createEventLog ({ session: params.session, channel: params.channel, data: {channelId: params.channelId, eventName: stateOfX.logEvents.summary, rawData: _.omit(handleGameStartResponse.over, 'self', 'session', 'channel')}});
    }, parseInt(configConstants.recordSummaryAfterGameOver) * 1000);

    // handleGameStartResponse.over.self    = params.self;
    handleGameStartResponse.over.channel = params.channel;
    handleGameStartResponse.over.session = params.session;
    var extraDelay = 2;
    setTimeout(function () {
      broadcastHandler.fireGameOverBroadcast(handleGameStartResponse.over);
    }, extraDelay*1000);
    setTimeout(function(){
      startGameHandler.startGame({ session: params.session, channelId: params.channelId, channel: params.channel, eventName: stateOfX.startGameEvent.gameOver});
    }, (configConstants.deleayInGames+extraDelay)*1000);
  }
};

// ### Handle exceptional behavior - check for blinds allin
var handleAdditionalCases = function (params) {
  keyValidator.validateKeySets("Request", "connector", "handleAdditionalCases", params, function (validated){
    if(validated.success) {
      pomelo.app.rpc.database.tableRemote.processCases(params.session, {serverType: "connector", channelId: params.channelId}, function (processCasesResponse) {
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
          serverLog(stateOfX.serverLogType.error, 'processCasesResponse . ' + JSON.stringify(processCasesResponse));
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.error, 'Key validation failed in handleAdditionalCases - ' + JSON.stringify(validated));
    }
  });
};

// ### Reset values after Game over
// deprecated
var resetChannelValues = function (params) {
  serverLog(stateOfX.serverLogType.info, "params in resetChannelValues");
  serverLog(stateOfX.serverLogType.info, params);
  // killChannelLevelTimers(params);
};

// sending broadcast to channels when all channels is on break
// tournament
var sendBroadcastForBreakTimer = function(params,breakDuration) {
  serverLog(stateOfX.serverLogType.info, "in send broadcastForBreakTimer - " + params.allChannels);
  for(var channelIt = 0; channelIt < params.allChannels.length; channelIt++) {
    var channel = pomelo.app.get('channelService').getChannel(params.allChannels[channelIt], false);//Added for channel is already present
    broadcastHandler.sendBroadcastForBreakTimer({channel : channel, breakTime : breakDuration, channelId: params.allChannels[channelIt]});
  }
};

// start the game of all the channels after break
// tournament
var scheduleNextGameStart = function(params,gameResumeTime,breakLevel) {
  serverLog(stateOfX.serverLogType.info, "params.tournamentId is in scheduleNextGameStart - " + params.tournamentId);
  serverLog(stateOfX.serverLogType.info, "params.gameVersionCount is in scheduleNextGameStart - " + params.gameVersionCount);
  serverLog(stateOfX.serverLogType.info, "breakLevel is in scheduleNextGameStart - " +breakLevel);
  serverLog(stateOfX.serverLogType.info, "game resume time is - " + new Date(gameResumeTime));
  //prepare collection for async operation
  var channelsArray = [];
  for(var channelIt = 0; channelIt < params.allChannels.length; channelIt++) {
    channelsArray.push({
      channelId : params.allChannels[channelIt]
    });
  }
  serverLog(stateOfX.serverLogType.info, "allChannels is in scheduleNextGameStart - " + JSON.stringify(channelsArray));
  schedule.scheduleJob(gameResumeTime, function(){
    async.eachSeries(channelsArray, function(channel, callback) {
      //update the breakLevel and set the isOnBreak key to false after the current break is over
      imdb.updateSeats(channel.channelId,{isOnBreak : false,breakLevel : (breakLevel + 1),isBreakTimerStart: false}, function(err, result) {
        // console.log("in updateSeats of scheduleNextGameStart",err,result);
        if(err) {
          serverLog(stateOfX.serverLogType.info + "Error in updating isOnBreak key");
        } else {
          var paramsData = {
            // self: params.self,
            session: "session",
            channelId: channel.channelId,
            channel: pomelo.app.get('channelService').getChannel(channel.channelId, false),
            eventName: stateOfX.startGameEvent.tournamentAfterBreak
          };
          serverLog(stateOfX.serverLogType.info, "GOING TO START GAME --------");
          startGameHandler.startGame(paramsData);
          callback();
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
  serverLog(stateOfX.serverLogType.info, "params keys in  initializeParams - " + _.keys(params));
  cb(null, params);
};

// check if server maintenance has put game start DISABLED
var checkServerState = function (params, cb) {
  if(serverDownManager.checkServerState('gameStart', pomelo.app)){
    if (params.channel) {
      var bplayers = params.tablePlayersForBroadcast.map(function ({playerId, chips, state}) {
        return {playerId, chips, state};
      });
      broadcastHandler.fireTablePlayersBroadcast({channelId: params.channelId, channel: params.channel, players: bplayers, removed: []});
      delete params.tablePlayersForBroadcast;
      params.channel.pushMessage(/*'channelInfo'*/ 'playerInfo', {serverDown: true, channelId: params.channelId, heading: 'Server Down', info: 'Server is going under maintenance. No new game will be started now.'});
    }
    cb({success: false, info: "Server is going under maintenance. No new game will start now."});
    return;
  } else {
    delete params.tablePlayersForBroadcast;
    cb(null, params);
  }
};

// ### Validate if a game start event is already set on channel leve
// If yes then skip start game process from current event
// If not then set start event on channel level
// If Game will not start then reset start event on channel level

var checkGameStartOnChannelLevel = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "params keys in  checkGameStartOnChannelLevel - " + _.keys(params));
  //  serverLog(stateOfX.serverLogType.info,'startGameHandler params.channel', params.channel)
  if(!params.channel) {
    cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.CHECKGAMESTARTONCHANNELLEVEL_CHANNELMISSINGFAIL_STARTGAMEHANDLER});
    //cb({success: false, channelId: params.channelId, info: "Channel missing while starting game!"});
    return false;
  }

  // Validate if game start event not already set for this channel
  if((params.eventName !== stateOfX.startGameEvent.gameOver) && params.channel.gameStartEventSet !== stateOfX.startGameEventOnChannel.idle) {
    cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.CHECKGAMESTARTONCHANNELLEVEL_GAMEALREADYSETFAIL_STARTGAMEHANDLER});
    //cb({success: false, channelId: params.channelId, info: "A game start event already set for this channel!"});
    return false;
  }
  // DOUBT

  params.channel.gameStartEventSet  = stateOfX.startGameEventOnChannel.starting;
  params.channel.gameStartEventName = params.eventName;

  cb(null, params);
};

//breakManagement
// tournament
var breakManagement = function(params, cb) {
  if(params.channel.channelType === stateOfX.gameType.tournament) {
    serverLog(stateOfX.serverLogType.info, "In breakManagement " + params.channelId);
    pomelo.app.rpc.database.breakManagement.process(params.session, {channelId: params.channelId}, function (breakManagementResponse) {
      serverLog(stateOfX.serverLogType.info, "breakManagementResponse is - " + JSON.stringify(breakManagementResponse));
      if(breakManagementResponse.success) {
        //No need to give break
        if(!breakManagementResponse.eligibleForBreak) {
          serverLog(stateOfX.serverLogType.info, "Not eligible for break");
          cb(null, params);
        } else {
          //channel is eligible for break
          // send broadcast to channel for break
          serverLog(stateOfX.serverLogType.info, "Channel is eligible for break");
          broadcastHandler.sendBroadcastForBreak(params);

          // set channel status as idle for again game start after break;
          params.channel.gameStartEventSet  = stateOfX.startGameEventOnChannel.idle;
          params.channel.gameStartEventName = null;

          if(breakManagementResponse.isTimeToStartBreakTimer) {
            //send broadcast to all channels for timertournament
            // start timer for break;
            serverLog(stateOfX.serverLogType.info, "All Channels are eligible for break");
            params.allChannels             = breakManagementResponse.allChannels;
            params.tournamentBreakDuration = breakManagementResponse.channelDetails.tournamentBreakDuration;
            serverLog(stateOfX.serverLogType.info, "Tournament break duration: " + JSON.stringify(params.tournamentBreakDuration));
            sendBroadcastForBreakTimer(params,breakManagementResponse.breakDuration);
            params.tournamentId            = breakManagementResponse.channelDetails.tournamentRules.tournamentId;
            params.gameVersionCount        = breakManagementResponse.channelDetails.gameVersionCount;
            scheduleNextGameStart(params,breakManagementResponse.gameResumeTime,breakManagementResponse.breakLevel);
          }
          cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.CHECKBREAKMANAGEMENTFAIL_STARTGAMEHANDLER});
          //cb({success: false, channelId: params.channelId, info: "Time to take a break for this tournament."});
        }
      } else {
        cb(breakManagementResponse);
      }
    });
  } else {
    serverLog(stateOfX.serverLogType.info, 'Skipping break management as channel is for - ' + params.channel.channelType + ' table game.');
    cb(null, params);
  }
};

// Decides next game starts for satellite management
// tournament
var satelliteManagement = function(params, cb) {
  if(params.channel.channelType === stateOfX.gameType.tournament && params.table.tournamentType === stateOfX.tournamentType.satelite) {
    serverLog(stateOfX.serverLogType.info, "In satelliteManagement table is - " + JSON.stringify(params.table));
    serverLog(stateOfX.serverLogType.info, "In satelliteManagement channelId is - " + params.channelId);
    serverLog(stateOfX.serverLogType.info, "In satelliteManagement channelType is - " + params.channel.channelType);
    serverLog(stateOfX.serverLogType.info, "In satelliteManagement tournamentType is - " + params.table.tournamentType);
    serverLog(stateOfX.serverLogType.info, "In satelliteManagement isTournamentRunning is  - " + params.table.tournamentRules.tournamentId);
    getTournamentRoom(params.table.tournamentRules.tournamentId, function(getTournamentRoomResponse) {
      serverLog(stateOfX.serverLogType.info, "getTournamentRoomResponse is - " + JSON.stringify(getTournamentRoomResponse));
      if(getTournamentRoomResponse.success) {
        if(params.channel.channelType === stateOfX.gameType.tournament && params.table.tournamentType === stateOfX.tournamentType.satelite && !getTournamentRoomResponse.isTournamentRunning) {
          if(params.table.isTournamentRunning) {
            //calling calculateRanks
            calculateRanks.manageRanksForNormalTournament({table:params.table},params.table.players, function(calculateRanksResponse) {
              serverLog(stateOfX.serverLogType.info, "calculateRanks response at game start - " + JSON.stringify(calculateRanksResponse));
              if(calculateRanksResponse.success) {
                startTournamentHandler.eliminationProcess(params.self,calculateRanksResponse.result.table);
                cb({success: false, info: "Satellite tournament for this channel is over", isRetry: false, isDisplay: false, channelId: ""});
              } else {
                cb({success: false, info: "error in calculateRanksResponse in satelliteManagement", isRetry: false, isDisplay: false, channelId: ""});
              }
           });
          }
        } else {
         serverLog(stateOfX.serverLogType.info, 'Skipping satellite management as channel is for - ' + params.channel.channelType + ' table game.');
          cb(null, params);
        }
      } else {
        cb(getTournamentRoomResponse);
      }
    });
  } else {
    serverLog(stateOfX.serverLogType.info, 'This is not a satellite tournament so skipping sateelite management');
    cb(null, params);
  }
};

// Save this record for disconnection handling
// not used anymore
var upateActivityRecord = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "in joinChannelHandler function saveActivityRecord");
  var dataToInsert = {
    channelId:  params.newChannelId,
    playerId:   params.playerId,
    isRequested:true,
    playerName: params.playerName,
    channelType:stateOfX.gameType.tournament,
    tableId:    params.tableId
  };
  imdb.upsertActivity({tableId: params.tableId, playerId: params.playerId}, dataToInsert, function(err, result) {
    if(!err && !!result) {
      cb({success: true});
    } else {
      cb({success: false, isRetry: true, isDisplay: false,channelId: (params.channelId || ""), info: popupTextManager.dbQyeryInfo.DBUPSERTACTIVITYFAIL_STARTGAMEHANDLER});
      //cb({success: false, isDisplay: false, isRetry: true, channelId: params.channelId, tableId: params.tableId, info: 'Unable to store player activity record for disconnection handling'});
    }
  });
};

// Shuffle players for tournament
var shuffleTournamentPlayers = function (params, cb) {
  if(params.channel.channelType === stateOfX.gameType.tournament) {
    serverLog(stateOfX.serverLogType.info, 'current channelId is  - ' + params.channelId);    
    pomelo.app.rpc.database.tableRemote.shufflePlayers(params.session, {channelId: params.channelId}, function (shufflePlayersResponse) {

      serverLog(stateOfX.serverLogType.info, 'shufflePlayersResponse - ' + JSON.stringify(shufflePlayersResponse));

      if(shufflePlayersResponse.success && shufflePlayersResponse.isPlayerShuffled) {
        // TODO: Broadcast player, current table and new table
        // 1. Broadcast Player: {playerId: , channelId: }
        // 2. Broadcast to current table: push this playerId in removed array
        // 3. Broadcast to new table: Get player details (channelId, playerId, chips, seatIndex, playerName, imageAvtar)
        // > and fire sit broadcast in new channel
        serverLog(stateOfX.serverLogType.info, "current channel id is - ",params.channelId);

        // broadcast for lobby optimization
        tournamentActionHandler.handleShufflePlayers({app: pomelo.app, tournamentId: shufflePlayersResponse.tournamentId, shiftedPlayers: shufflePlayersResponse.shiftedPlayers});
        if(shufflePlayersResponse.isChannelReductionPossible) {
          tournamentActionHandler.handleDestroyChannel({app: pomelo.app, tournamentId: shufflePlayersResponse.tournamentId, channelId: params.channelId});          
        }

        params.removedPlayerList = shufflePlayersResponse.outOfMoneyPlayers;

        serverLog(stateOfX.serverLogType.info, "Players to removed from shuffling - " + params.removedPlayerList);

        async.each(shufflePlayersResponse.shiftedPlayersData, function(player, callback) {
          serverLog(stateOfX.serverLogType.info, "player in shuffleTournamentPlayers in startGameHandler is - ",JSON.stringify(player));
          upateActivityRecord({playerName  : player.playerName, playerId: player.playerId,newChannelId: player.channelId,channelId : params.channelId, tableId: shufflePlayersResponse.tournamentId},function(response) {
            if(response.success) {
              var broadcastData = {
                // self: params.self,
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
              var channelObject = pomelo.app.get('channelService').getChannel(player.channelId, false);

              broadcastHandler.fireLeaveBroadcast({channel: params.channel, serverType: "connector", data: data});
              params.channel.leave(player.playerId);

              broadcastHandler.fireNewChannelBroadcast(broadcastData);
              broadcastData.chips      = player.chips;
              broadcastData.seatIndex  = player.seatIndex;
              broadcastData.playerName = player.playerName;
              broadcastData.imageAvtar = player.imageAvtar;
              broadcastData.channel    = pomelo.app.get('channelService').getChannel(player.channelId, false);

              broadcastHandler.fireSitBroadcastInShuffling(broadcastData);
              if(player.channelId != params.channelId) {
                startGameHandler.startGame({ session: params.session, channelId: player.channelId, channel: pomelo.app.get('channelService').getChannel(player.channelId, false),eventName: stateOfX.startGameEvent.tournament});
              } else {
                serverLog(stateOfX.serverLogType.info, 'Not starting game for current table, skipping!');
              }
              callback();
            } else {
              cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.SHUFFLETOURNAMENTPLAYERSFAIL_STARTGAMEHANDLER});
              //cb({success: false, isDisplay: false, isRetry: false, channelId: params.channelId, info:"Unable to save record of user in player shuffling"})
            }
          });
        }, function(err) {
          if(err) {
            serverLog(stateOfX.serverLogType.info, "Error in player shuffling in shuffle tournament players");
            cb(params);
          } else {
            cb(null, params);
          }
        });
      } else if(shufflePlayersResponse.success && !shufflePlayersResponse.isPlayerShuffled) {
        serverLog(stateOfX.serverLogType.info, "No shuffling required in this case!");
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

// tournament
var removeWinnerPlayerInTournament = function(params,cb) {
  if(params.channel.channelType === stateOfX.gameType.tournament) {
    serverLog(stateOfX.serverLogType.info, "params is in removeWinnerPlayerInTournament in startGameHandler - " + JSON.stringify(params.channelId));
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

// NEW: wait for bankrupt players for little time
// they can add chips and become part of game
var waitForOutOfMoney = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In startGameHandler function waitForOutOfMoney !');
  if (params.channel.channelType === stateOfX.gameType.tournament) {
    return cb(null, params);
  } else {
    pomelo.app.rpc.database.tableRemote.getTableAttrib(params.session, {channelId: params.channelId, key: "players"}, function (getPlayersRes) {
      if (getPlayersRes.success) {
        var players = getPlayersRes.value;
        params.tablePlayersForBroadcast = players; // for server down thing
        var bankruptCount = _.where(players, {state: stateOfX.playerState.outOfMoney}).length;
        // console.error('========-------------===========', bankruptCount, _.where(players, {state: stateOfX.playerState.onBreak}).length)
        if (bankruptCount>0) {
          var bplayers = players.map(function ({playerId, chips, state}) {
            return {playerId, chips, state};
          });
          // console.error('=========', bplayers)
          broadcastHandler.fireTablePlayersBroadcast({ channelId: params.channelId, channel: params.channel, players: bplayers, removed: []});
          setTimeout(cb.bind(null, null, params), configConstants.waitForOutOfMoneySeconds*1000);
        } else {
          return cb(null, params);
        }
      } else {
        return cb(null, params);
      }
    });
  }
};

// db operation with table lock
// to check if game can start
// if yes, start, decide marked players, deduct blinds, give hole cards
var startGameProcess = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In startGameHandler function startGameProcess!');
  pomelo.app.rpc.database.tableRemote.startGameProcess(params.session, {channelId: params.channelId}, function (startGameProcessRes) {
    console.log('startGameProcessRes - ' + JSON.stringify(startGameProcessRes));
    if (!(startGameProcessRes.success && startGameProcessRes.data)) {
      process.emit('forceMail', {title:"for vgsResponse", data: startGameProcessRes});
      return cb(startGameProcessRes);
    }
    params.data = startGameProcessRes.data;
    params.data.players = startGameProcessRes.data.vgsResponse.players;
    params.data.preGameState = startGameProcessRes.data.vgsResponse.preGameState;
    params.table = startGameProcessRes.table;
    if(params.channel.channelType === stateOfX.gameType.tournament) {
      tournamentActionHandler.handleDynamicRanks ({ session: params.session, tournamentId: params.table.tournamentRules.tournamentId, gameVersionCount: params.table.tournamentRules.gameVersionCount});
    }
    if (startGameProcessRes.data.vgsResponse.startGame) {
      serverLog(stateOfX.serverLogType.info,'table round id: ' + JSON.stringify(params.table));
      params.channel.roundId = params.table.roundId; // Set current roundId to channel level
      serverLog(stateOfX.serverLogType.info,'channel round id: ', params.channel);
      channelTimerHandler.killChannelTurnTimer({channel: params.channel});
      channelTimerHandler.killTableIdleTimer({channel: params.channel});
    }
    if(params.table.state !== stateOfX.gameState.running) {
      channelTimerHandler.killChannelTurnTimer(params);
    }
    cb(null, params);
  });
};

// Validate if Game is going to start or not
// deprecated
var validateStartGame = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In startGameHandler function validateStartGame !');
  pomelo.app.rpc.database.tableRemote.shouldStartGame(params.session, {channelId: params.channelId}, function (shouldStartGameResponse) {
    serverLog(stateOfX.serverLogType.info, 'shouldStartGameResponse - ' + JSON.stringify(shouldStartGameResponse));
    serverLog(stateOfX.serverLogType.info, "2. Players to be removed in this game - " + params.removedPlayerList);
    if(shouldStartGameResponse.success) {

      params.table             = shouldStartGameResponse.table;
      params.data.startGame    = shouldStartGameResponse.startGame;
      params.data.players      = shouldStartGameResponse.players;
      params.data.state        = shouldStartGameResponse.state;
      params.data.preGameState = shouldStartGameResponse.preGameState;
      params.data.removed      = _.unique(shouldStartGameResponse.removed.concat(params.removedPlayerList));
      // for rank update lobby broadcast
      if(params.channel.channelType === stateOfX.gameType.tournament) {
        tournamentActionHandler.handleDynamicRanks ({ session: params.session, tournamentId: params.table.tournamentRules.tournamentId, gameVersionCount: params.table.tournamentRules.gameVersionCount});
      }
      if(params.data.startGame) {
        serverLog(stateOfX.serverLogType.info,'table round id: ' + JSON.stringify(params.table));
        params.channel.roundId = params.table.roundId; // Set current roundId to channel level
        serverLog(stateOfX.serverLogType.info,'channel round id: ', params.channel);
        channelTimerHandler.killChannelTurnTimer({channel: params.channel});
        channelTimerHandler.killTableIdleTimer({channel: params.channel});
      }

      if(params.table.state !== stateOfX.gameState.running) {
        channelTimerHandler.killChannelTurnTimer(params);
      }
      cb(null, params);
    } else {
      cb(shouldStartGameResponse);
    }
  });
};

// Broadcast player chips for right panel view (inside table view) for lobby
var firePlayerChipsLobbyBroadcast = function(app, channelId, channelType, players) {
  for (var i = 0; i < players.length; i++) {
    console.log("Broadcast chips digvijay name " + players[i].playerName + " chips " + players[i].chips);
    broadcastHandler.fireBroadcastToAllSessions({app: app, data: {_id: channelId, playerId: players[i].playerId, updated: {playerName: players[i].playerName, chips: players[i].chips}, channelType: channelType, event: stateOfX.recordChange.tableViewChipsUpdate}, route: stateOfX.broadcasts.tournamentLobby});
  }
};

// broadcast game players
// game start or not
// states and chips - mainly
var fireGamePlayersBroadcast = function (params, cb) {
  if (!params.eventName) {
    cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.FIREGAMEPLAYERSBROADCASTFAIL_STARTGAMEHANDLER});
    return false;
  }
  if (params.data.preGameState !== stateOfX.gameState.idle) {
    cb(null, params);
    return false;
  }
  if (params.data.vgsResponse.startGame) {
    params.channel.gameStartEventSet = stateOfX.startGameEventOnChannel.running;
    if (params.channel.channelType === stateOfX.gameType.tournament) {
      for (var i = 0; i < params.data.dataPlayers.length; i++) {
        if(params.data.dataPlayers[i].tournamentData.isTournamentSitout) {
          params.data.dataPlayers[i].state = stateOfX.playerState.onBreak;
        }
      }
    }
    // console.error('====+++++++', params.data, params.data.dataPlayers, Object.keys(params))
    broadcastHandler.fireTablePlayersBroadcast({ channelId: params.channelId, channel: params.channel, players: params.data.dataPlayers, removed: params.data.vgsResponse.removed});
    firePlayerChipsLobbyBroadcast(pomelo.app, params.channelId, params.channel.channelType, params.data.dataPlayers);
    cb(null, params);
    return true;
  }

  params.channel.gameStartEventSet  = stateOfX.startGameEventOnChannel.idle;
  params.channel.gameStartEventName = null;
  params.channel.roundId            = "";
  broadcastHandler.fireTablePlayersBroadcast({ channelId: params.channelId, channel: params.channel, players: params.data.dataPlayers, removed: params.data.vgsResponse.removed});
  firePlayerChipsLobbyBroadcast(pomelo.app, params.channelId, params.channel.channelType, params.data.dataPlayers);
  cb(null, params);
  return true;
};

// Send Game players broadcast
// not used
// var fireGamePlayersBroadcast = function(params, cb) {
//   serverLog(stateOfX.serverLogType.info, 'In startGameHandler function fireGamePlayersBroadcast ! - ' + _.keys(params));
//   // Broadcast game players with state (Do not send when a game is running)
//   if(!params.eventName) {
//     cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.FIREGAMEPLAYERSBROADCASTFAIL_STARTGAMEHANDLER});
//     //cb({success: false, channelId: params.channelId, info: "Missing event name while starting Game!"});
//     return false;
//   }

//   serverLog(stateOfX.serverLogType.info, 'The game will start from event - ' + params.eventName);
//   serverLog(stateOfX.serverLogType.info, 'Previous Game state of this table - ' + params.data.preGameState);


//   // Do not process Game player broadcast if Game is already running on this table
//   if(params.data.preGameState !== stateOfX.gameState.idle) {
//     serverLog(stateOfX.serverLogType.info, 'Previous Game state is not IDLE so avoiding Game Players broadcast to be fired!')
//     cb(null, params);
//     return false;
//   }

//   // Process if game is going to start
//   if(params.data.startGame) {
//     params.channel.gameStartEventSet = stateOfX.startGameEventOnChannel.running;
//     serverLog(stateOfX.serverLogType.info, 'Sending Game Players: Game is not running on this table, and Game is going to start!');
//     if(params.channel.channelType === stateOfX.gameType.tournament) {
//       serverLog(stateOfX.serverLogType.info, 'About to set ONBREAK for tournament sitout players');
//       for (var i = 0; i < params.data.players.length; i++) {
//         if(params.data.players[i].tournamentData.isTournamentSitout) {
//           serverLog(stateOfX.serverLogType.info, 'Setting player ' + params.data.players[i].playerName + ' as ONBREAK.')
//           params.data.players[i].state   = stateOfX.playerState.onBreak;
//         }
//       }
//     }
//     broadcastHandler.fireTablePlayersBroadcast({self: params.self, channelId: params.channelId, channel: params.channel, players: params.data.players, removed: params.data.removed})
//     firePlayerChipsLobbyBroadcast(params.self.app, params.channelId, params.channel.channelType, params.data.players);
//     //  serverLog(stateOfX.serverLogType.info,'params.channel in fireGamePlayersBroadcast - ', params.channel);
//     cb(null, params);
//     return true;
//   }

//   // Process if game is not going to start
//   serverLog(stateOfX.serverLogType.info, 'Sending Game Players: Game is not running on this table, and Game is not going to start!');
//   params.channel.gameStartEventSet  = stateOfX.startGameEventOnChannel.idle;
//   params.channel.gameStartEventName = null;
//   params.channel.roundId            = "";
//   broadcastHandler.fireTablePlayersBroadcast({self: params.self, channelId: params.channelId, channel: params.channel, players: params.data.players, removed: params.data.removed})
//   firePlayerChipsLobbyBroadcast(params.self.app, params.channelId, params.channel.channelType, params.data.players);
//   //  serverLog(stateOfX.serverLogType.info,'params.channel in fireGamePlayersBroadcast - ', params.channel);
//   cb(null, params);
//   return true;
// }

// Start seat reserve timer for players with OUTOFMONEY state
// wait has been done
var setOnBreakAndStartReserveTimer = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In startGameHandler function setOnBreakAndStartReserveTimer !');

  if(params.channel.channelType === stateOfX.gameType.tournament) {
    serverLog(stateOfX.serverLogType.info, 'This is a tournament so skipping bankrupt player to SITOUT and start seat reserve timer!');
    cb(null, params);
    return true;
  }

  async.each(params.data.players, function(player, ecb){
    serverLog(stateOfX.serverLogType.info, 'Processing player for bankrupt to onBreak - ' + JSON.stringify(player));
    if(player.state === stateOfX.playerState.outOfMoney) {
        pomelo.app.rpc.database.tableRemote.setPlayerAttrib(params.session, {playerId: player.playerId, channelId: params.channelId, key: "state", value: stateOfX.playerState.onBreak}, function (setPlayerAttribResponse) {
        if(setPlayerAttribResponse.success) {
          serverLog(stateOfX.serverLogType.info, player.playerName + ' is bankrupt and onBreak now.');
          broadcastHandler.firePlayerStateBroadcast({channel: params.channel,  playerId: player.playerId, channelId: params.channelId, state: stateOfX.playerState.onBreak});
          ecb();
        } else {
          ecb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.SETONBREAKANDSTARTRESERVETIMERFAIL_STARTGAMEHANDLER});
          //ecb({success: false, channelId: params.channelId, info: "Setting bankrupt player state as onbreak failed!"});
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.info, player.playerName + ' is not bankrupt and in state - ' + player.state);
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
  console.error(Object.keys(params));
  console.error(Object.keys(params.data));
  if(params.data.vgsResponse.startGame) {
    params.data.players = params.data.dcResponse.players;
    cb(null, params);
  } else {
    cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.CHECKGAMESTARTFAIL_STARTGAMEHANDLER});
    //cb({success: false, channelId: params.channelId, info: 'No need to start game in this case!'});
  }
};

var setAutoFoldResetValue = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'inside setAutoFoldCount value');
  pomelo.app.rpc.database.tableRemote.setAutoFoldResetValue(params.session, {channelId: params.channelId}, function (setAutoFoldResponse) {
    cb(null, params);
  });
};

// Set configuration on the table (Dealer, Small Blind, Big Blind and Straddle players)
// deprecated
var setGameConfig = function(params, cb) {
  pomelo.app.rpc.database.tableRemote.setGameConfig(params.session, {channelId: params.channelId}, function (setGameConfigResponse) {
     serverLog(stateOfX.serverLogType.info,'setGameConfigResponse', setGameConfigResponse);
    if(setGameConfigResponse.success) {
      cb(null, params);
    } else {
      serverLog(stateOfX.serverLogType.error, ' Error while setting table config  - ' + JSON.stringify(setGameConfigResponse));
      if(configConstants.playerAutoMoveRequired) {
        broadcastHandler.fireDealerChat({channel: params.channel, channelId: params.channelId, message: ' Error while setting table config  - ' + JSON.stringify(setGameConfigResponse)});
      }
      cb(setGameConfigResponse);
    }
  });
};

// Distribute cards to players
// deprecated
var distributecards = function(params, cb) {
  pomelo.app.rpc.database.tableRemote.distributecards(params.session, {channelId: params.channelId}, function (distributecardsResponse) {
    if(distributecardsResponse.success) {
      params.data.players = distributecardsResponse.players;
      cb(null, params);
    } else {
      cb(distributecardsResponse);
    }
  });
};

// Fire broadcast for card distribution
var fireCardDistributeBroadcast = function(params, cb) {
  broadcastHandler.fireCardDistributeBroadcast({ channel: params.channel, players: params.data.players,channelId: params.channelId}, function (fireCardDistributeBroadcastResponse) {
    if(fireCardDistributeBroadcastResponse.success) {
      cb(null, params);
    } else {
      cb(fireCardDistributeBroadcastResponse);
    }
  });
};

/**
 * increment hands played count for the player(in profile.statistics)
 * @method updateEveryPlayerStats
 * @param  {Object}          params   data from waterfall
 * @param  {Function}        cb       callback function
 */
var updateEveryPlayerStats = function (params, cb) {
  var playerIds = _.pluck(params.data.players, 'playerId');
  var keyName = "";
  if (params.table && params.table.isRealMoney) {
    keyName = "statistics.handsPlayedRM";
  } else {
    keyName = "statistics.handsPlayedPM";
  }
  pomelo.app.rpc.database.userRemote.updateStats('session', {playerIds: playerIds, data: {[keyName]: 1}, bySystem: true}, function (res) {
    serverLog(stateOfX.serverLogType.info, 'done --- app.rpc.logic.userRemote.incrementInProfile'+ JSON.stringify(res));
  });
  cb(null, params);
};

// Deduct blinds on table (includes straddle if required)
// deprecated
var deductBlinds = function(params, cb) {
  pomelo.app.rpc.database.tableRemote.deductBlinds(params.session, {channelId: params.channelId}, function (deductBlindsResponse) {
    if(deductBlindsResponse.success) {
      params.data.deductBlindsResponse = deductBlindsResponse;
      cb(null, params);
    } else {
      cb(deductBlindsResponse);
    }

  });
};

// Fire deduct blind broadcast
var fireDeductBlindBroadcast = function(params, cb) {
     broadcastHandler.fireDeductBlindBroadcast({ channel: params.channel, data: params.data.dbResponse}, function (fireDeductBlindBroadcastResponse){
      if(fireDeductBlindBroadcastResponse.success) {
        cb(null, params);
      } else {
        cb(fireDeductBlindBroadcastResponse);
      }
    });
};

// Fire start game broadcast on channel
var fireStartGameBroadcast = function(params, cb) {
    pomelo.app.rpc.database.tableRemote.tableConfig(params.session, {channelId: params.channelId}, function (tableConfigResponse) {

      serverLog(stateOfX.serverLogType.info, 'Start game response from remote - ' + JSON.stringify(tableConfigResponse));

      if(tableConfigResponse.success) {
        params.data.tableDetails  = tableConfigResponse;
        params.broadcastData      = tableConfigResponse.config;
        broadcastHandler.fireStartGameBroadcast(params, function(fireStartGameBroadcastReseponse){
          serverLog(stateOfX.serverLogType.info, 'fireStartGameBroadcastReseponse');
          serverLog(stateOfX.serverLogType.info, fireStartGameBroadcastReseponse);
          if(fireStartGameBroadcastReseponse.success) {
            params.channel.firstTurnTimer = setTimeout(function (params) {
              // only if move is needed : currentMoveIndex >= 1 (for seatIndex) : TODO maybe
              // Send player turn broadcast to channel level
              broadcastHandler.fireOnTurnBroadcast(Object.assign({}, params.broadcastData, { channel: params.channel, playerId: '', amount: 0, action: 'CHECK', chips: 0, totalRoundBet: 0}), function(fireOnTurnBroadcastResponse){
                if(fireOnTurnBroadcastResponse.success) {
                  channelTimerHandler.startTurnTimeOut(params);
                } else {
                  serverLog(stateOfX.serverLogType.error, 'Unable to broadcast turn, in Game start auto turn condition!');
                }
              });
            }, (params.table.onStartPlayers.length*(stateOfX.totalPlayerCards[params.table.channelVariation]*0.25) + 0.3)*1000, params);
           // channelTimerHandler.startTurnTimeOut(params);
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

// Remove big blind missed players from table
var removeBlindMissedPlayers = function(params, cb) {
  if(params.channel.channelType === stateOfX.gameType.tournament) {
    serverLog(stateOfX.serverLogType.info, 'This is a tournament so skipping standup player after BB missed case!');
    cb(null, params);
    return true;
  }

  if(!!params.data.tableDetails.removed && params.data.tableDetails.removed.length >= 1) {
    serverLog(stateOfX.serverLogType.info, 'There are players to be removed from table because of BB missed ! - ' + JSON.stringify(params.data.tableDetails.removed));
    async.each(params.data.tableDetails.removed, function(removedPlayer, ecb){
      serverLog(stateOfX.serverLogType.info, 'Processing player to remove after BB missed ! - ' + JSON.stringify(removedPlayer));
      getPlayerSessionServer(removedPlayer,params,function(err,responsePlayer){
        console.error(responsePlayer);
        getHitLeave(responsePlayer,params,function(err,leaveResponse){
          console.log(leaveResponse);
          fireRemoveBlindMissedPlayersBroadCast(params,responsePlayer,params.broadcastData.channelId);
         ecb();
        });
      });
      // params.self.leaveTable(removedPlayer, params.session, function(leaveTableResponse){
      //   console.error(params,"!!!!!!@@@@@@@@@@@#########$$$$$$$$$$$",leaveTableResponse);
      //   serverLog(stateOfX.serverLogType.info, 'Player has been removed successfully after BB missed');
      //   fireRemoveBlindMissedPlayersBroadCast(params,removedPlayer.playerId,params.broadcastData.channelId);
      // });
    }, function(err){
      if(err) {
        serverLog(stateOfX.serverLogType.error, 'Error while removing player after BB missed ! - ' + JSON.stringify(err));
      } else {
        serverLog(stateOfX.serverLogType.info, 'All players has been removed successfully after BB missed !');
      }
    });
  } else {
    serverLog(stateOfX.serverLogType.info, 'No player found to be removed after BB missed !');
  }
  cb(null, params);
};

// get db player session object
var getPlayerSessionServer = function (player, params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler in getPlayerSessionServer');
  pomelo.app.rpc.database.dbRemote.findUserSessionInDB('', player.playerId, function (res) {
    if (res.success) {
      player.serverId = res.result.serverId;
      cb(null, player);
    } else {
      cb(null, player);
    }
  });
};

// hit autoLeave for player
var getHitLeave = function (player, params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler in getHitLeave');
  if(player.serverId){
    pomelo.app.rpc.connector.sessionRemote.hitLeave({frontendId: player.serverId}, { playerId: player.playerId, isStandup: true, channelId: params.channelId, isRequested: false, origin: 'blindMissed'}, function (hitLeaveResponse) {
      serverLog(stateOfX.serverLogType.info, 'response of rpc-hitLeave' + JSON.stringify(hitLeaveResponse));
      cb(null, player);
    });
  } else{
    cb(null, player);
  }
};

// fire removed plaayers broadcast
var fireRemoveBlindMissedPlayersBroadCast = function(params,player,channelId){
  var filter = {};
  filter.playerId = player.playerId;
  filter.channelId = channelId;
  //console.error("!!!!!!!!!!!!!!!!!!!1",params);
  db.getAntiBanking(filter,function(err,response){
    if(!err && response){
      if(response != null){
      var timeToNumber = parseInt(configConstants.expireAntiBankingSeconds) + parseInt(configConstants.antiBankingBuffer) - (Number (new Date()) -  Number(response.createdAt))/1000;
      var isAntiBankingStatus = (timeToNumber>0);
       broadcastHandler.sendMessageToUser({ playerId: player.playerId, serverId: player.serverId, msg: {playerId: player.playerId, channelId: channelId, isAntiBanking:isAntiBankingStatus, timeRemains:timeToNumber, amount: response.amount, event : stateOfX.recordChange.playerLeaveTable }, route: stateOfX.broadcasts.antiBankingUpdatedData});
        console.error(isAntiBankingStatus,"!!!!!!!@@@@@@@@@@@@Anti banking",timeToNumber);
      }
    }
  });
};


// Fire precheck broadcast to individual players
var firePrecheckBroadcast = function(params, cb) {
  pomelo.app.rpc.database.tableRemote.getTableAttrib(params.session, {channelId: params.channelId, key: "preChecks"}, function (getTableAttribResponse) {
    if(getTableAttribResponse.success) {
      // getTableAttribResponse.value.self      = params.self;
      getTableAttribResponse.value.session   = params.session;
      getTableAttribResponse.value.channelId = params.channelId;
      getTableAttribResponse.value.channel   = params.channel;

      broadcastHandler.firePrecheckBroadcast(getTableAttribResponse.value);
      cb(null, params);
    } else {
      cb(getTableAttribResponse);
    }
  });
};

// tournament
var killChannel = function (self,channels) {
  serverLog(stateOfX.serverLogType.info, "channels is in killChannel are - ",JSON.stringify(channels));
  async.each(channels, function(channelObject, callback) {
    //  serverLog(stateOfX.serverLogType.info,'===============');
    //  serverLog(stateOfX.serverLogType.info,"self",self);
    //  serverLog(stateOfX.serverLogType.info,"self.app",self.app);
    var channel  = pomelo.app.get('channelService').getChannel(channelObject.channelId, false);
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

//decide tournament finished or not
var decideTournamentFinished = function(tournamentId,cb) {
  db.getTournamentRoom(tournamentId, function(err, tournament) {
    if(err || !tournament) {
      cb({success: false, isRetry: false, isDisplay: true, info: popupTextManager.falseMessages.DBGETTOURNAMENTROOMFAIL_TOURNAMENT,channelId: ""});
      //cb({success: false, info: "No tournament room found"});
    } else {
      var decideTournamentFinished = tournament.isRebuyOpened || tournament.isLateRegistrationOpened;
       serverLog(stateOfX.serverLogType.info,'decideTournamentFinished - ' + decideTournamentFinished);
      cb(!decideTournamentFinished);
    }
  });
};

// tournament
var changeStateOfTournament = function(params) {
  serverLog(stateOfX.serverLogType.info, "channelId is in change state of tornament is  " + params.channelId);
  //  serverLog(stateOfX.serverLogType.info,'params is in change state of tournament - ',params);
  var channelId = params.channelId.toString();
  countCurrentPlayers(params, function(countPlayersResponse) {
    serverLog(stateOfX.serverLogType.info, "countPlayersResponse is in change state of tournament is - " + JSON.stringify(countPlayersResponse));
    if(countPlayersResponse.success && countPlayersResponse.playersCount === 1) {
      decideTournamentFinished(countPlayersResponse.tournamentId, function(decideTournamentFinishedResponse) {
        if(decideTournamentFinishedResponse) {
          tournamentActionHandler.handleTournamentState({ session: params.session, tournamentId : countPlayersResponse.tournamentId , tournamentState: stateOfX.tournamentState.finished });
          pomelo.app.rpc.database.rewardRake.tournamentRakeProcess(params.session,{tournamentId : countPlayersResponse.tournamentId}, function (rakeResponse) {
            serverLog(stateOfX.serverLogType.info, "response from tournament rake - " + JSON.stringify(rakeResponse));
            db.updateTournamentStateAndVersion(countPlayersResponse.tournamentId,stateOfX.tournamentState.finished,function(err, response) {
              if(err || !response) {
                serverLog(stateOfX.serverLogType.info , "Error in state and version update");
              } else {
                serverLog(stateOfX.serverLogType.info, "updated tournament state successfully" + JSON.stringify(response));
                serverLog(stateOfX.serverLogType.info, "response._id,response.gameVersionCount-1 -- "+response._id+response.gameVersionCount-1);
                pomelo.app.rpc.database.rewardRake.tournamentRakeProcess(params.session,{tournamentId : response._id}, function (rakeResponse) {
                  serverLog(stateOfX.serverLogType.info, "response from tournament rake - " + JSON.stringify(rakeResponse));
                });
                killChannel(params.self,countPlayersResponse.channels);
                if(params.table.tournamentType === stateOfX.tournamentType.sitNGo) {
                  serverLog(stateOfX.serverLogType.info, "this is sitNGo tournament going to calculate dynamicRanks");
                  dynamicRanks.getRegisteredTournamentUsers(response._id,response.gameVersionCount-1);
                  tournamentActionHandler.handleDynamicRanks ({ session: params.session, tournamentId: countPlayersResponse.tournamentId, gameVersionCount: response.gameVersionCount-1});
                }
              }
            });
          });
        } else {
           serverLog(stateOfX.serverLogType.info,'Rebuy or Late registrtion is opened no need to finish tournament');
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.info, "Error in getting current users");
    }
  });
};

// Fire Dealer chat broadcast on Game start
var fireDealerChatGameStart = function(params, cb) {
  actionLogger.createEventLog ({
    // self: params.self,
    session: params.session,
    channel: params.channel,
    data: {
      channelId: params.channelId,
      eventName: stateOfX.logEvents.startGame,
      rawData: params.data.tableDetails.eventDetails
    }
  });
  cb(null, params);
};

// Fire dealer chat for table info
var fireDealerChatTableInfo = function(params, cb) {
  actionLogger.createEventLog ({
    // self: params.self,
    session: params.session,
    channel: params.channel,
    data: {
      channelId: params.channelId,
      eventName: stateOfX.logEvents.tableInfo,
      rawData: params.data.tableDetails.eventDetails.tableDetails
    }
  });
  cb(null, params);
};

// Handle start game and validate everything before starting a game
startGameHandler.startGame = function (params) {
  serverLog(stateOfX.serverLogType.info, 'Keys while starting Game request - ' +  JSON.stringify(_.keys(params)));
  serverLog(stateOfX.serverLogType.info, 'Starting game from event - ' +  params.eventName);

  // Reset all in occured value in channel
  params.channel.allInOccuredOnChannel = false;

  keyValidator.validateKeySets("Request", "connector", "startGame", params, function (validated){
    if(validated.success) {
      async.waterfall([

        async.apply(initializeParams, params),
        checkGameStartOnChannelLevel,
        shuffleTournamentPlayers,
        removeWinnerPlayerInTournament,
        waitForOutOfMoney,
        checkServerState,
        startGameProcess,
        // validateStartGame,
        // fireGamePlayersBroadcast,
        fireGamePlayersBroadcast,
        breakManagement,
        // satelliteManagement,
        setOnBreakAndStartReserveTimer,
        checkGameStart,
        setAutoFoldResetValue,
        // setGameConfig,
        // deductBlinds,
        // distributecards,
        fireCardDistributeBroadcast,
        fireDeductBlindBroadcast,
        updateEveryPlayerStats,
        fireStartGameBroadcast,
        removeBlindMissedPlayers,
        firePrecheckBroadcast,
        fireDealerChatTableInfo,
        fireDealerChatGameStart

      ], function(err, response){
        if(err && !response) {
          serverLog(stateOfX.serverLogType.error, 'Game will not start, REASON - ' + JSON.stringify(err));
          serverLog(stateOfX.serverLogType.info, "channelId when game not able to start",JSON.stringify(params.channelId));
          // activity.startGame(params,stateOfX.profile.category.game,stateOfX.game.subCategory.info,err,stateOfX.logType.error);
          if(params.channel.channelType === stateOfX.gameType.tournament) {
            // changeStateOfTournament(params);
          }
        } else {
          handleAdditionalCases(params);
          // activity.startGame(params,stateOfX.profile.category.game,stateOfX.game.subCategory.info,response,stateOfX.logType.success);
        }
      });
    } else {
        // activity.startGame(params,stateOfX.profile.category.game,stateOfX.game.subCategory.info,validated,stateOfX.logType.error);
        serverLog(stateOfX.serverLogType.info, 'Start game key validation response - ' + JSON.stringify(validated));
    }
  });
};

module.exports = startGameHandler;
