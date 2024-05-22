/*jshint node: true */
"use strict";

// This file is used to validate if game is going to start or noe.

var async              = require("async"),
    _ld                = require("lodash"),
    _                  = require("underscore"),
    uuid               = require("uuid"),
    cardAlgo           = require("../../../util/model/deck"),
    randy              = require("../../../util/model/randy"),
    stateOfX           = require("../../../../shared/stateOfX"),
    keyValidator       = require("../../../../shared/keysDictionary"),
    db                 = require("../../../../shared/model/dbQuery"),
    imdb               = require("../../../../shared/model/inMemoryDbQuery.js"),
    logDB              = require("../../../../shared/model/logDbQuery.js"),
    zmqPublish         = require("../../../../shared/infoPublisher"),
    videoRemote        = require("./videoRemote"),
    tableManager       = require("./tableManager"),
    popupTextManager   = require("../../../../shared/popupTextManager"),
    tableConfigManager = require("./tableConfigManager");
const configConstants = require('../../../../shared/configConstants');
var pomelo = require("pomelo");
// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'validateGameStart';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

function validateGameStart() {}

// ### Reset player state (Specially for tournament)
var resetPlayerState = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In function resetPlayerState!');

  for (var i = 0; i < params.table.players.length; i++) {
    var player = params.table.players[i];
    if (player.state == stateOfX.playerState.disconnected) {
      player.state = stateOfX.playerState.onBreak;
    }
    if (player.chips <= 0) {
      if (player.state == stateOfX.playerState.waiting || player.state == stateOfX.playerState.playing) {
        player.state = stateOfX.playerState.outOfMoney;
      }
    }
    if(player.chips > 0 && player.state == stateOfX.playerState.outOfMoney) {
      player.state = stateOfX.playerState.waiting;
    }
    player.precheckValue = stateOfX.playerPrecheckValue.NONE;
    player.onGameStartBuyIn = player.chips;
  }

  if(params.table.channelType !== stateOfX.gameType.tournament) {
    cb(null, params);
    return;
  }

  async.each(params.table.players, function(player, ecb){
    // Set out of money if player have  0 chips
    if (player.state == stateOfX.playerState.disconnected) {
      player.state = stateOfX.playerState.onBreak;
    }
    if(player.chips === 0) {
      serverLog(stateOfX.serverLogType.info, player.playerName + ' has ' + player.chips + ', setting outOfMoney state!');
      player.state = stateOfX.playerState.outOfMoney;
    }
    if(player.chips > 0 && player.state == stateOfX.playerState.outOfMoney) {
      player.state = stateOfX.playerState.waiting;
    }
    // Set selected precheck as NONE for every player at game start - so that old value from previous game
    // not be there to perform moves
    player.precheckValue = stateOfX.playerPrecheckValue.NONE;
    player.onGameStartBuyIn = player.chips; // DOES NOT work from here - this is tournament code
    ecb();
  }, function(err){
    if(err) {
      cb({success: false, channelId: params.channelId, isRetry: false, isDisplay: false, info: "Reset player on start game failed: " + JSON.stringify(err)});
    } else {
      cb(null, params);
    }
  });
};

// Validate if Game is going to start or not
// Start considering players only if true
var isGameGoingToStart = function (params, cb) {
  // Do not check condition if this is a tournament
  // as tournament will start if there are less playerto min players for table
  serverLog(stateOfX.serverLogType.info, 'state of players on table while start game check - ' + _.pluck(params.table.players, 'state'));
  var waitingPlayers = _.where(params.table.players, {state: stateOfX.playerState.waiting});
  serverLog(stateOfX.serverLogType.info, 'waiting player is in isGameGoingToStart - ' + JSON.stringify(waitingPlayers));
  // In case o ftournament set all waiting players state as Playing and return
  if(params.table.channelType === stateOfX.gameType.tournament) {
    params.tempData.startConsiderPlayer = false;
    serverLog(stateOfX.serverLogType.info, 'This is tournament so setting all waiting players as PLAYING!');
    for (var i = 0; i < params.table.players.length; i++) {
      if(params.table.players[i].state === stateOfX.playerState.waiting) {
        params.table.players[i].state           = stateOfX.playerState.playing;
        params.table.players[i].active          = true;
        params.table.players[i].isWaitingPlayer = false;
      } else {
        serverLog(stateOfX.serverLogType.info, 'Skipping player ' + params.table.players[i].playerName + ', as already in state - ' + params.table.players[i].state);
      }
    }
    cb(null, params);
    return;
  }

  var playingPlayers = _.where(params.table.players, {state: stateOfX.playerState.playing});
  serverLog(stateOfX.serverLogType.info, 'Round ' + params.table.roundCount + '. Sum of playing ' + playingPlayers.length + ' and waiting ' + waitingPlayers.length + ' - ' + (waitingPlayers.length+playingPlayers.length) + ' min players to start game - ' + params.table.minPlayers);

  // If less than 2 players then do not start game
  // Do nto perform consider player logic
  // Return function from here
  if(waitingPlayers.length+playingPlayers.length < params.table.minPlayers) {
    cb({success: true, channelId: params.channelId, isRetry: false, isDisplay: false, info: 'Less players than to start game - ' + params.table.minPlayers});
    return;
  }

  // If there are only min players going to play
  // Consider all players without performing any
  // additional logic, return the function
  if(playingPlayers.length+waitingPlayers.length === params.table.minPlayers) {
    params.tempData.startConsiderPlayer = false;
    serverLog(stateOfX.serverLogType.info, 'There will be only min players , make all waiting as active!');
    for (var i = 0; i < waitingPlayers.length; i++) {
      waitingPlayers[i].state           = stateOfX.playerState.playing;
      waitingPlayers[i].active          = true;
      waitingPlayers[i].isWaitingPlayer = false;
    }
    cb(null, params);
    return;
  }

  // If there are more players than min players
  // and playing players are also more than 1
  // then start logic to consider player or skip player
  if(waitingPlayers.length+playingPlayers.length !== params.table.minPlayers && playingPlayers.length >= 1) {
    params.tempData.startConsiderPlayer = true;
  }
  cb(null, params);
};

// start consider players
// SPECIAL CAUTION - player sitting between D,SB,BB may not become part of game even if they are ready to play
var startConsiderPlayers = function (params, cb) {
  // Return function in case of tournament
  if(params.table.channelType === stateOfX.gameType.tournament) {
    serverLog(stateOfX.serverLogType.info, 'This is tournament so skipping dead delaer, and sit/consider player on BB case!');
    cb(null, params);
    return true;
  }

  if(params.tempData.startConsiderPlayer) {
    // var waitingPlayers = _.where(params.table.players, {state: stateOfX.playerState.waiting});
    serverLog(stateOfX.serverLogType.info, 'Total waiting players for new round - ' + _.pluck(_.where(params.table.players, {state: stateOfX.playerState.waiting}), 'playerName'));

    var indexBetweenSBandBB = tableManager.indexBetweenSBandBB(params);
    var stateBetweenSBandBB = tableManager.stateOfSBandBB(params);
    serverLog(stateOfX.serverLogType.info,'validateGameStart - Indexes between SB and BB - ' + indexBetweenSBandBB);
  //  console.error("!!!!!!!@@@@@@@@@#########$$$$$$$$$%%%%%%%%^^^^^^^^^^^^^ ",_.where(params.table.players, {state: stateOfX.playerState.playing}));
    var playingPlayer = _.where(params.table.players, {state: stateOfX.playerState.playing}).length;
    async.eachSeries(_.where(params.table.players, {state: stateOfX.playerState.waiting}), function(player, ecb){

      var playerIndexInPlayers = _ld.findIndex(params.table.players, {playerId: player.playerId});
     serverLog(stateOfX.serverLogType.info, 'Considering player ' + JSON.stringify(params.table.players[playerIndexInPlayers]));
     serverLog(stateOfX.serverLogType.info, 'Considering player ', indexBetweenSBandBB.indexOf(player.seatIndex));
       if(indexBetweenSBandBB.indexOf(player.seatIndex) < 0 || stateBetweenSBandBB || params.table.players.length === 3) { // 1st change - sushiljainam Aug
        serverLog(stateOfX.serverLogType.info, player.playerName + ' is not in between SB and BB!');
        // Consider player as PLAYING if
        // Player already played on table OR
        // Player is about to play first time and enabled force blind to deduct
        // Player havent opted to deduct force blind and become BB in next game

        if((player.hasPlayedOnceOnTable) || (!player.hasPlayedOnceOnTable && player.isForceBlindEnable)) {
          serverLog(stateOfX.serverLogType.info, 'Sitting player ' + player.playerName + ' forcefully, as force BB enabled!');
          serverLog(stateOfX.serverLogType.info, '1. Before updating values player ' + JSON.stringify(params.table.players[playerIndexInPlayers]));
          params.table.players[playerIndexInPlayers].state                = stateOfX.playerState.playing;
          params.table.players[playerIndexInPlayers].active               = true;
          if(!player.hasPlayedOnceOnTable && player.isForceBlindEnable) {
            serverLog(stateOfX.serverLogType.info, 'Force blind will be deducted for this player - ' + player.playerName);
            params.table.players[playerIndexInPlayers].isWaitingPlayer = true;
          } else {
            serverLog(stateOfX.serverLogType.info, 'Force blind will not be deducted for this player - ' + player.playerName);
            params.table.players[playerIndexInPlayers].isWaitingPlayer = false;
          }
          params.table.players[playerIndexInPlayers].hasPlayedOnceOnTable = true;
          serverLog(stateOfX.serverLogType.info, '2. After updating values player ' + JSON.stringify(params.table.players[playerIndexInPlayers]));
          ecb();
        } else {
          serverLog(stateOfX.serverLogType.info, 'Player ' + player.playerName + ' opted not to sit forcefully!');
          serverLog(stateOfX.serverLogType.info, 'Check if player will be going to BB');

          tableConfigManager.nextGameConfig(params, function(getNextDealerSeatIndexResponse){
            serverLog(stateOfX.serverLogType.info, 'getNextDealerSeatIndexResponse - ' + JSON.stringify(getNextDealerSeatIndexResponse.params.tempConfigPlayers));
            serverLog(stateOfX.serverLogType.info, 'comparing players - ' + JSON.stringify(player));
            if(getNextDealerSeatIndexResponse.success && !!getNextDealerSeatIndexResponse.params.tempConfigPlayers.bigBlindSeatIndex && getNextDealerSeatIndexResponse.params.tempConfigPlayers.bigBlindSeatIndex >= 0) {
              params = getNextDealerSeatIndexResponse.params;
              playerIndexInPlayers = _ld.findIndex(params.table.players, {playerId: player.playerId}); // Update player index as it might get changed while getting response ob above operation
              if(player.seatIndex === getNextDealerSeatIndexResponse.params.tempConfigPlayers.bigBlindSeatIndex) {
                serverLog(stateOfX.serverLogType.info, player.playerName + ' will become next BB, sitting forcefully!');
                serverLog(stateOfX.serverLogType.info, '3. Before updating values player ' + JSON.stringify(params.table.players[playerIndexInPlayers]));
                params.table.players[playerIndexInPlayers].state                = stateOfX.playerState.playing;
                params.table.players[playerIndexInPlayers].active               = true;
                params.table.players[playerIndexInPlayers].isWaitingPlayer      = true;
                params.table.players[playerIndexInPlayers].hasPlayedOnceOnTable = true;
                serverLog(stateOfX.serverLogType.info, '4. After updating values player ' + JSON.stringify(params.table.players[playerIndexInPlayers]));
                ecb();
              } else {
                serverLog(stateOfX.serverLogType.info, player.playerName + ' will not become next BB, skipping to sit forcefully!');
                ecb();
              }
            } else{
              serverLog(stateOfX.serverLogType.error, 'Error while Getting next expected BB response.');
              ecb();
            }
          });
        }
      } else {
        serverLog(stateOfX.serverLogType.info, 'Player sitted in between smallblind and bigblind, skipping player!');
        ecb();
      }
    }, function(err){
      if(err) {
        serverLog(stateOfX.serverLogType.info, 'Player refresh failed !');
        //cb({success: false, channelId: params.channelId, info: "Player consider and skip failed !"})
        cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.STARTCONSIDERPLAYERSFAIL_VALIDATEGAMESTART});
      } else {
        serverLog(stateOfX.serverLogType.info, 'Playing player final for this game! - ' + JSON.stringify(params.table.players));
        cb(null, params);
      }
    });
  } else {
    serverLog(stateOfX.serverLogType.info, 'Skipping logic to consider or skip players');
    cb(null, params);
  }
};

// ### Sort players indexes
// > (NOTE: Keep non-playng players at the end of players array list)
var sortPlayerIndexes = function (params, cb) {
  keyValidator.validateKeySets("Request", params.serverType, "sortPlayerIndexes", params, function (validated){
    if(validated.success) {
      // Refresh player list sorted as seatIndex
      // serverLog(stateOfX.serverLogType.info, 'players before sort based on seat - ' + JSON.stringify(params.table.players));
      // serverLog(stateOfX.serverLogType.info, 'Current dealer index - ' + params.table.dealerIndex);
      params.table.players.sort(function(a, b) { return parseInt(a.seatIndex) - parseInt(b.seatIndex); });
      // serverLog(stateOfX.serverLogType.info, 'players after sort based on seat - ' + JSON.stringify(params.table.players));
      var playingPlayers = [];
      var inactivePlayer = [];
      async.each(params.table.players, function(player, ecb){
        if(player.state !== stateOfX.playerState.playing) {
          serverLog(stateOfX.serverLogType.info, player.playerName + ' is not playing, add at last place!');
          inactivePlayer.push(player);
        } else {
          playingPlayers.push(player);
          serverLog(stateOfX.serverLogType.info, player.playerName + ' is already playing, add at first place!');
        }
        ecb();
      }, function(err){
        if(err) {
          //cb({success: false, channelId: channelId, info: "Sorting players on game start failed."})
          cb({success: false, isRetry: false, isDisplay: false, channelId: params.channelId || " ",info: popupTextManager.falseMessages.SORTPLAYERINDEXESFAIL_VALIDATEGAMESTART});

        } else {
          params.table.players = playingPlayers.concat(inactivePlayer); // Directly store sorted players into table players array
          serverLog(stateOfX.serverLogType.info, 'Final sorted players - ' + JSON.stringify(params.table.players));
          cb(null, params);
        }
      });
    } else {
      cb(validated);
    }
  });
};

// If enough players to start the game
var isEnoughPlayingPlayers = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Players while checking isEnoughPlayingPlayers - ' + JSON.stringify(params.table.players));
   keyValidator.validateKeySets("Request", params.serverType, "isEnoughPlayingPlayers", params, function (validated){
    if(validated.success) {
    tableManager.totalActivePlayers(params, function (totalActivePlayersResponse){
      serverLog(stateOfX.serverLogType.info, 'totalActivePlayersResponse - ' + JSON.stringify(totalActivePlayersResponse));
      serverLog(stateOfX.serverLogType.info, 'Channel type - ' +  params.table.channelType);

        if(totalActivePlayersResponse.success) {
          if(params.table.channelType === stateOfX.gameType.tournament ) {
            if(totalActivePlayersResponse.players.length > 1) {
              cb(null, params);
            } else {
              cb({success: true, channelId: params.channelId, isRetry: false, isDisplay: false, info: params.table.channelType + "There are less active players to start the game!"});
            }
          } else {
            if(totalActivePlayersResponse.players.length >= params.table.minPlayers && totalActivePlayersResponse.players.length <= params.table.maxPlayers) {
              cb(null, params);
            } else {
              cb({success: true, channelId: params.channelId, isRetry: false, isDisplay: false, info: params.table.channelType + "There are less active players to start the game!"});
            }
          }
        } else {
          cb(totalActivePlayersResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

// Shuffle deck using RNG algo -
var shuffleDeck = function (params, cb) {
  keyValidator.validateKeySets("Request", params.serverType, "shuffleDeck", params, function (validated){
    if(validated.success) {
      params.table.deck = cardAlgo.getCards();
      params.table.deck = randy.shuffle(params.table.deck);
      cb(null, params);
    } else {
      cb(validated);
    }
  });
};

// Create roundId for current round
var inserRoundId = function (params, cb) {
  params.table.raiseBy = '';
  params.table.roundId = uuid.v4();
  params.table.gameStartTime = Number(new Date());
  params.table.roundNumber = '';
  for (var i = 0; i < 12; i++) {
    params.table.roundNumber += Math.floor(Math.random()*10);
  }
  cb(null, params);
};

// ### Remove sitout players if
// > player missed the pre-defined big blinds during sitout
// > If player auto sitout then after 2 game missed

// var refundPlayerChips = function(params, cb) {
//   db.addRealChips({playerId: params.player.playerId}, parseInt(params.player.chips), function (err, response) {
//     serverLog(stateOfX.serverLogType.info, "response in removeSitoutPlayer - " + JSON.stringify(response));
//     if(err && !response) {
//       //cb({success: false, channelId: params.channelId, info: "Refund on sitout standup failed! - " + err});
//       cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.dbQyeryInfo.DBADDREALCHIPSFAIL_VALIDATEGAMESTART});

//     } else {
//       serverLog(stateOfX.serverLogType.info, "going  to splice");
//       params.response.data.removed.push(params.player.playerId);
//       params.table.players.splice(_ld.findIndex(params.table.players, params.player), 1);
//       serverLog(stateOfX.serverLogType.info, "params.table.player" + JSON.stringify(params.table.players));
//       cb(null, params);
//     }
//   });
// }

// var removeRecordActivity = function(params, cb) {
//   imdb.removeActivity({channelId: params.channelId, playerId: params.player.playerId}, function(err, response){
//     if(!err && !!response) {
//       serverLog(stateOfX.serverLogType.info, 'succefully remove activity from in memory for leave in disconnectin handling');
//       cb(null, params);
//     } else {
//       cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.dbQyeryInfo.DBREMOVEACTIVITYFAIL_VALIDATEGAMESTART});
//       //cb({success: false, isDisplay: false, isRetry: false, channelId: params.channelId, tableId: params.tableId, info: 'Unable to remove player activity from in memory'});
//     }
//   })
// }

// remove sitout player
// after checking conditions
// blinds missed
// sitout game missed
// etcetra
var removeSitoutPlayer = function (params, cb) {
  keyValidator.validateKeySets("Request", params.serverType, "removeSitoutPlayer", params, function (validated){
    if(validated.success) {
      if(params.table.channelType !== stateOfX.gameType.tournament) {
        var playerIds = _.pluck(params.table.players, 'playerId');
        async.eachSeries(playerIds, function (playerId, ecb) {
          var player = params.table.players[_ld.findIndex(params.table.players, {playerId: playerId})] ;
          serverLog(stateOfX.serverLogType.info, 'Processing player Id to remove on game start: ' + playerId);
          if(!player) {
            serverLog(stateOfX.serverLogType.info, 'Player is missing here!');
            ecb();          
          } else {
            serverLog(stateOfX.serverLogType.info, 'Processing player while checking to remove from table or not - ' + JSON.stringify(player));
            serverLog(stateOfX.serverLogType.info, 'Total big blind missed for player - ' + player.playerName + ' -> ' + player.bigBlindMissed + ', allowed BB miss - ' + params.table.blindMissed);
            serverLog(stateOfX.serverLogType.info, 'Allowed blind missed on table - ' + params.table.blindMissed);
            serverLog(stateOfX.serverLogType.info, 'Is blind missed exceed - ' + (player.bigBlindMissed >= params.table.blindMissed));
            serverLog(stateOfX.serverLogType.info, 'Allowed sitout game play - ' + configConstants.removeAfterSitoutGameMissed);
            serverLog(stateOfX.serverLogType.info, 'Is sitout game play missed exceed - ' + (player.bigBlindMissed >= params.table.blindMissed));

            var isPlayerGoingToLeave = false;
            
            isPlayerGoingToLeave = parseInt(player.disconnectedMissed) > parseInt(configConstants.removeAfterDisconnectedGame);
            serverLog(stateOfX.serverLogType.info, 'Is player going to leave due to diconnected game crossed? - ' + (parseInt(player.disconnectedMissed) > parseInt(configConstants.removeAfterDisconnectedGame)));

            if(!isPlayerGoingToLeave) {
              isPlayerGoingToLeave = parseInt(player.bigBlindMissed) >= parseInt(params.table.blindMissed);
              serverLog(stateOfX.serverLogType.info, 'Is player going to leave due to BB missed game? - ' + (parseInt(player.bigBlindMissed) >= parseInt(params.table.blindMissed)));
            }

            if(!isPlayerGoingToLeave) {
              isPlayerGoingToLeave = parseInt(player.sitoutGameMissed) >= parseInt(configConstants.removeAfterSitoutGameMissed);
              serverLog(stateOfX.serverLogType.info, 'Is player going to leave due to sitout game missed? - ' + (parseInt(player.sitoutGameMissed) >= parseInt(configConstants.removeAfterSitoutGameMissed)));
            }

            if(isPlayerGoingToLeave) {
              serverLog(stateOfX.serverLogType.info, player.playerName + " is going to leave current game, from server!");
              // params.player = player
              // params.response.data.removed.push(params.player.playerId);
              ecb();
              //// READ A STORY ////
              //// ISSUE - play money was producing real money;
              //// CASE - play in play-money table, let a player get disconnected, auto fold, auto sitout, then auto standup - you get both real money and play money in profile;
              //// ALSO - we are executing leave (main flow) from startGameHandler so don't do these two functions here.
              //// STORY FINISHED - sushiljainam ////
              // async.waterfall([
              //   async.apply(refundPlayerChips, params),
              //   removeRecordActivity
              // ], function(err, response) {
              //   if(err) {
              //     ecb({success: false, channelId: params.channelId, isRetry: false, isDisplay: false, info: "Unable to remove blind missed player or sitout game missed player! - " + JSON.stringify(err)});
              //   } else {
              //     delete params.player;
              //     ecb(null);
              //   }
              // });
            } else {
              ecb();
            }
          }
        }, function (err) {
          if(err) {
            //cb({success: false, channelId: params.channelId, info: "Removing sitout player failed !"});
            cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.REMOVESITOUTPLAYERFAIL_VALIDATEGAMESTART});
          } else {
            cb(null, params);
          }
        });
      } else {
        serverLog(stateOfX.serverLogType.info, "This is tournament so skipping sitout option");
        cb(null, params);
      }
    } else {
      cb(validated);
    }
  });
};

// Remove player from tournament who is out of funds
var removeTournamentPlayers = function (params, cb) {
  keyValidator.validateKeySets("Request", params.serverType, "removeTournamentPlayers", params, function (validated){
    if(validated.success) {
      if(params.table.channelType === stateOfX.gameType.tournament) {
        var playersWithNoChips    = _.where(params.table.players, {state: stateOfX.playerState.outOfMoney});
        params.table.players      = _.difference(params.table.players, playersWithNoChips);
        var playerIdsWithNoChips  = _.pluck(playersWithNoChips, 'playerId');
        serverLog(stateOfX.serverLogType.info, 'playerIdsWithNoChips, '+ playerIdsWithNoChips);
      }
      params.response.data.removed = _.union(params.response.data.removed, playerIdsWithNoChips);
      serverLog(stateOfX.serverLogType.info, "params.response.data.removed is in removeTournamentPlayers is -"+JSON.stringify(params.response.data.removed));
      cb(null, params);
    } else {
      cb(validated);
    }
  });
};

// ### Initialize video log in database for current game
// > also insert base data for gamePlayers and joinResponse
var insertVideoInDB = function(params, cb) {
  
  // Create game players data
  var gamePlayers = videoRemote.createGamePlyersResponse(params);

  // Create join response data
  var joinResponse = videoRemote.createJoinResponse(params);

  var history = [];
  history.push({type: "gamePlayers", data: gamePlayers, createdAt : Number(new Date()) });
  history.push({type: "joinResponse", data: joinResponse, createdAt : Number(new Date()) });

  var video = {
    roundId    : params.table.roundId,
    channelId  : params.table.channelId,
    history    : history,
    active     : false,
    createdAt  : Number(new Date())
  };

  // Insert details in database
  logDB.insertVideo(video, function(err, result) {
    if(err){
      serverLog(stateOfX.serverLogType.err, "Unable to initialize video log: " + JSON.stringify(err));
      cb({success: false, channelId: params.channelId, isRetry: false, isDisplay: false, info: "Unable to initialize video log: " + JSON.stringify(err)});
    } else{
      console.log('videoLogId', result);
      params.table.videoLogId = result._id;
      cb(null, params);
    }
  });
};

// init params to try start a game
var initializeParams = function (params, cb) {
  params.response                     = {};
  params.response.data                = {};
  params.response.data.removed        = params.removedPlayerList || [];
  params.response.data.players        = params.table.players;
  params.response.state               = params.table.state;
  params.response.data.startGame      = false;
  params.response.success             = false;
  params.tempData                     = {};
  params.tempData.startConsiderPlayer = true;
  params.tempData.allowedIndexes      = true;
  params.tempData.skipIndexes         = true;
  params.tempData.preGameState        = params.table.state;
  params.table.removedPlayers         = [];
  params.table.gamePlayers            = [];
  serverLog(stateOfX.serverLogType.info, "tempData set to - "+ JSON.stringify(params.tempData));
  cb(null, params);
};

// reset table settings if game not able to start
var resetTableOnNoGameStart = function(params, cb) {
  params.table.roundId             = null;
  params.table.deck                = [];
  params.table.roundName           = null;
  params.table.roundBets           = [];
  params.table.roundMaxBet         = 0;
  params.table.maxBetAllowed       = 0;
  params.table.pot                 = [];
  params.table.contributors        = [];
  params.table.roundContributors   = [];
  params.table.boardCard           = [[], []];
  params.table.preChecks           = [];
  params.table.summaryOfAllPlayers = {};
  params.table.handHistory         = [];
  params.table.isAllInOcccured     = false;
  params.table.currentMoveIndex    = -1;
  params.table._v                  = 0;

  // Resetting players
  for (var i = 0; i < params.table.players.length; i++) {
    if(params.table.players[i].state === stateOfX.playerState.playing) {
      serverLog(stateOfX.serverLogType.info, 'Setting player ' + params.table.players[i].playerName + ' state as waiting and inactive.');
      params.table.players[i].state   = stateOfX.playerState.waiting;
      params.table.players[i].active  = false;
    }

    // Consider PLAYING and WAITING players has played game once
    // if(params.table.players[i].state === stateOfX.playerState.playing || params.table.players[i].state === stateOfX.playerState.waiting) {
    if(params.table.players[i].state === stateOfX.playerState.playing) { // Removing waiting player condition as antibanking gets applied because of waiting player consideration
      serverLog(stateOfX.serverLogType.info, 'Setting player ' + params.table.players[i].playerName + ' has played on this table.');
      params.table.players[i].hasPlayedOnceOnTable = true;
    }
  }

  cb({success: true, table: params.table});
};

// try if game could be started
validateGameStart.validate = function (params, cb) {
  if(params.table.state === stateOfX.gameState.idle) {
    async.waterfall([

      async.apply(initializeParams, params),
      resetPlayerState,
      isGameGoingToStart,
      startConsiderPlayers,
      sortPlayerIndexes,
      removeSitoutPlayer,
      removeTournamentPlayers,
      isEnoughPlayingPlayers,
      inserRoundId,
      shuffleDeck,
      insertVideoInDB

    ], function(noStartGameResponse, response){
      // console.warn(JSON.stringify(params));
      serverLog(stateOfX.serverLogType.info, 'params keys after procesing Game start logic - ' + JSON.stringify(params.tempData));
      if(noStartGameResponse && !response) {
        noStartGameResponse.data              = {};
        noStartGameResponse.success           = true;
        noStartGameResponse.data.preGameState = params.tempData.preGameState;
        noStartGameResponse.data.startGame    = false;
        noStartGameResponse.data.removed      = [];
        serverLog(stateOfX.serverLogType.info, 'noStartGameResponse');
        serverLog(stateOfX.serverLogType.info, 'Game start validation case failed - ' + JSON.stringify(noStartGameResponse));
        // console.log("!@#$%^&&&&&&&&&&&&&&&&&&&&&&",mailerdate);
        // if(params.table.players.length >=2){
        //   var mailerdate = JSON.stringify(params);
        //   pomelo.app.rpc.connector.entryRemote.sendMailToDevelopersForGameStart("SESSION",mailerdate, function (response) {
        //      console.log(response);
        //    });
        // }
        resetTableOnNoGameStart(params, function(resetResponse){
          noStartGameResponse.table        = resetResponse.table;
          noStartGameResponse.data.state   = resetResponse.table.state;
          noStartGameResponse.data.players = resetResponse.table.players;
          noStartGameResponse.table.stateInternal = stateOfX.gameState.idle;
          cb(noStartGameResponse);
        });
      } else {
        params.response.success           = true;
        params.response.data.startGame    = true;
        params.response.data.state        = params.table.state;
        params.response.table             = params.table;
        params.response.data.players      = params.table.players;
        params.response.data.preGameState = params.tempData.preGameState;
        serverLog(stateOfX.serverLogType.info, '===== Validae Game Response ====');
        serverLog(stateOfX.serverLogType.info, _.keys(params.response));
        serverLog(stateOfX.serverLogType.info, 'data in start game final response - ' + JSON.stringify(params.response.data));
        cb(params.response);
      }
    });
  } else{
      // console.warn(JSON.stringify(params));
    serverLog(stateOfX.serverLogType.info, 'Trying to start a Game with state - ' + params.table.state);
    cb({success: true, data: {players: params.table.players, removed: [], startGame: false, state: params.table.state, preGameState: params.table.state}, table: params.table});
  }
};

module.exports = validateGameStart;
