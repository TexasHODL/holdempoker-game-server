/*jshint node: true */
"use strict";

// This file is used to handle cases if player didn't make any move

// ### External files and packages declaration ###
var _                 = require('underscore'),
    async             = require("async"),
    schedule          = require('node-schedule'),
    keyValidator      = require("../../../../shared/keysDictionary"),
    db                = require("../../../../shared/model/dbQuery.js"),
    stateOfX          = require("../../../../shared/stateOfX.js"),
    zmqPublish        = require("../../../../shared/infoPublisher.js"),
    broadcastHandler  = require("./broadcastHandler"),
    configMsg         = require('../../../../shared/popupTextManager').falseMessages,
    dbConfigMsg       = require('../../../../shared/popupTextManager').dbQyeryInfo;

const configConstants = require('../../../../shared/configConstants');    
// var channelTimerHandler = {};
var pomelo = require('pomelo');
function channelTimerHandler() {}

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'channelTimerHandler';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  // zmqPublish.sendLogMessage(logObject);
  console.log(JSON.stringify(logObject));
}

// ### Kill channel timers for moves and other tasks
var killChannelLevelTimers = function (params) {
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function killChannelLevelTimers');
  // Kill previous timer if exists
  if(!!params.channel.turnTimeReference) {
    clearTimeout(params.channel.turnTimeReference);
    params.channel.turnTimeReference = null;
  } else {
    serverLog(stateOfX.serverLogType.error, 'TURN TIMER NOT EXISTS, while restarting auto turn timer !!');
  }

  if(!!params.channel.extraTurnTimeReference) {
    clearTimeout(params.channel.extraTurnTimeReference);
    params.channel.extraTurnTimeReference = null;
  } else {
    serverLog(stateOfX.serverLogType.error, 'EXTRA TURN TIMER NOT EXISTS, while restarting auto turn timer !!');
  }

  if(!!params.channel.timeBankTurnTimeReference) {
    clearTimeout(params.channel.timeBankTurnTimeReference);
    params.channel.timeBankTurnTimeReference = null;
  } else {
    serverLog(stateOfX.serverLogType.error, 'TIMEBANK TURN TIMER NOT EXISTS, while restarting auto turn timer !!');
  }

  // Reset delay timer while checking client connection
  if(!!params.channel.clientConnAckReference) {
    clearTimeout(params.channel.clientConnAckReference);
    params.channel.clientConnAckReference = null;
  }

  if(!!params.channel.playerSimpleMoveWithTimeBank) {
    clearTimeout(params.channel.playerSimpleMoveWithTimeBank);
    params.channel.playerSimpleMoveWithTimeBank = null;
  }

   if(!!params.channel.performAutoSitout) {
    clearTimeout(params.channel.performAutoSitout);
    params.channel.performAutoSitout = null;
  }
};

// decide action move by player's selected precheck value
// if possible, do it
var decideMoveAccToPrecheck = function (precheckValue, moves) {
  switch (precheckValue) {
    case stateOfX.playerPrecheckValue.CALL :
      if (moves.indexOf(stateOfX.moveValue.call)>=0) {
        return stateOfX.move.call;
      }
      break;
    case stateOfX.playerPrecheckValue.CALL_ANY :
      if (moves.indexOf(stateOfX.moveValue.call)>=0) {
        return stateOfX.move.call;
      } else if (moves.indexOf(stateOfX.moveValue.check)>=0) {
        return stateOfX.move.check;
      } else if (moves.indexOf(stateOfX.moveValue.allin)>=0) {
        return stateOfX.move.allin;
      }
      break;
    case stateOfX.playerPrecheckValue.FOLD :
      if (moves.indexOf(stateOfX.moveValue.fold)>=0) {
        return stateOfX.move.fold;
      }
      break;
    case stateOfX.playerPrecheckValue.CHECK :
      if (moves.indexOf(stateOfX.moveValue.check)>=0) {
        return stateOfX.move.check;
      }
      break;
    case stateOfX.playerPrecheckValue.ALLIN :
      if (moves.indexOf(stateOfX.moveValue.allin)>=0) {
        return stateOfX.move.allin;
      }
      break;
    case stateOfX.playerPrecheckValue.CHECK_FOLD :
      if (moves.indexOf(stateOfX.moveValue.check)>=0) {
        return stateOfX.move.check;
      } else if (moves.indexOf(stateOfX.moveValue.fold)>=0) {
        return stateOfX.move.fold;
      }
      break;
    case stateOfX.playerPrecheckValue.CALL_ANY_CHECK :
      if (moves.indexOf(stateOfX.moveValue.call)>=0) {
        return stateOfX.move.call;
      } else if (moves.indexOf(stateOfX.moveValue.check)>=0) {
        return stateOfX.move.check;
      } else if (moves.indexOf(stateOfX.moveValue.allin)>=0) {
        return stateOfX.move.allin;
      }
      break;
    case stateOfX.playerPrecheckValue.NONE :
      return false;
    default: 
      return false;
  }
  return false;
};

// ### Perform any move on behalf of player from server
var perfromPlayerMove = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Processing for channel id: ' + params.channel.channelId);
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function perfromPlayerMove');
  serverLog(stateOfX.serverLogType.info, "params.self is in performPlayerMove ---- ");
  // serverLog(stateOfX.serverLogType.info, _.keys(params.self));
  keyValidator.validateKeySets("Request", "connector", "perfromPlayerMove", params, function (validated){
    if(validated.success) {
      console.error("!!!!!!!@@@@@@@@@#########################");
      console.error(pomelo.app.channelhandler);
      var moveDataParams ={
        playerId    : params.playerId,
        channelId   : params.channelId,
        amount      : params.amount,
        action      : params.action,
        runBy       : params.runBy || "none",
        isRequested : false
      };
      params.session.forceFrontendId = params.sessionNew.frontendId;
      // var moveData = {};
      // moveData.msg = moveDataParams;
      // moveData.session = params.session;
      //pomelo.app.event.emit('makeMove',moveData);

      // params.self.makeMove({
      //   playerId    : params.playerId,
      //   channelId   : params.channelId,
      //   amount      : params.amount,
      //   action      : params.action,
      //   isRequested : false
      // }, params.session, function (err, makeMoveResponse) {
      //   cb(makeMoveResponse);
      // });

      pomelo.app.rpc.connector.sessionRemote.hitAutoMove(params.session, moveDataParams, function (makeMoveResponse) {
      // serverLog(stateOfX.serverLogType.info, 'response of rpc-hitAutoMove' + JSON.stringify(makeMoveResponse));
        cb(makeMoveResponse);
    });
    } else {
      cb(validated);
    }
  });
};

// ### Perform CHECK or FOLD - acc to availability
// after player has not acted in enough time
var performCheckOrFold = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Processing for channel id: ' + params.channel.channelId);
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function performCheckOrFold');
  pomelo.app.rpc.database.tableRemote.getPlayerAttribute(params.session, {channelId: params.channelId, playerId: params.playerId, key: "moves"}, function (getPlayerMoves) {
    if(getPlayerMoves.success) {
      params.amount = 0;

      // <<<<< Commented as verified from PokerStars, perform CHECK if check available
      // <<<<< Uncommented as Sitout player cannot play CHECK

      // Set player action

      params.action = getPlayerMoves.value.indexOf(1) >= 0 ? stateOfX.move.check : stateOfX.move.fold;
      params.action = params.channel.channelType === stateOfX.gameType.tournament && params.isTournamentSitout ? stateOfX.move.fold : params.action;

      perfromPlayerMove(params, function (perfromPlayerMoveResponse) {
        cb(perfromPlayerMoveResponse);
      });

      // if(params.channel.channelType === stateOfX.gameType.tournament) {
      //   serverLog(stateOfX.serverLogType.info, 'About to fold player for tournament.');
      //   params.action = params.isTournamentSitout ? stateOfX.move.fold;
      //   perfromPlayerMove(params, function (perfromPlayerMoveResponse) {
      //     cb(perfromPlayerMoveResponse)
      //   });
      // } else if(getPlayerMoves.value.indexOf(1) >= 0) {
      //   params.action = stateOfX.move.check;
      //   perfromPlayerMove(params, function (perfromPlayerMoveResponse) {
      //     cb(perfromPlayerMoveResponse)
      //   });
      // } else {
      //   params.action = stateOfX.move.fold;
      //   perfromPlayerMove(params, function (perfromPlayerMoveResponse) {
      //     cb(perfromPlayerMoveResponse)
      //   });
      // }
    } else {
      serverLog(stateOfX.serverLogType.error, "Get player moves from key failed - " + JSON.stringify(getPlayerMoves));
    }
  });
};


// Perform auto sitout for any player
var performAutoSitout = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Processing for channel id: ' + params.channel.channelId);
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function performAutoSitout');
  keyValidator.validateKeySets("Request", "connector", "performAutoSitout", params, function (validated){
    if(validated.success) {
      params.channel.performAutoSitout =  setTimeout(function(){
        pomelo.app.rpc.database.tableRemote.autoSitout(params.session, {playerId: params.playerId, channelId: params.channelId, isRequested: false, isConnected: (params.playerState === stateOfX.playerState.disconnected)}, function (autoSitoutResponse) {
          cb(autoSitoutResponse);
          broadcastHandler.firePlayerStateBroadcast({channel: params.channel,  playerId: params.playerId, channelId: params.channelId, state: stateOfX.playerState.onBreak});
        });
      }, parseInt(configConstants.autositoutDelayGameOver)*1000);
    } else {
      serverLog(stateOfX.serverLogType.error, 'Error while sending ack broadcast - ' + JSON.stringify(validated));
    }
  });
};

// ### Handle when player is disconnected
// provide extra time bank 10 seconds or remaining as available
var playerSimpleMoveWithTimeBank = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function playerSimpleMoveWithTimeBank');
  // params.self.app.rpc.database.tableRemote.getPlayerAttribute(params.session, {channelId: params.channelId, playerId: params.playerId, key: "timeBankSec"}, function (getPlayerTimeBank) {
  //   serverLog(stateOfX.serverLogType.info, ' response of tableRemote.getPlayerAttribute '+ JSON.stringify(getPlayerTimeBank));
  //   if (getPlayerTimeBank.success) { 
      if (params.player.timeBankSec && params.player.timeBankSec > 0 && params.player.totalGameBet > 0) {
        pomelo.app.rpc.database.requestRemote.setTimeBankDetails(params.session, {playerId: params.playerId, channelId: params.channelId}, function (setTimeBankResp) {
          if (setTimeBankResp.success) {
            broadcastHandler.startTimeBank({channel: params.channel, channelId: params.channelId, playerId: params.playerId, totalTimeBank: (params.player.timeBankSec||1), timeBankLeft: (params.player.timeBankSec||1)});
            params.channel.playerSimpleMoveWithTimeBank = setTimeout(cb, (params.player.timeBankSec||1)*1000, params);
          }
        });
      } else {
        cb(params);
      }
  //   } else {
  //     cb(params)
  //     // nothing
  //   }
  // })
};

// perform auto move and then sitout if FOLDed
var playerSimpleMoveAndSitout = function (params) {
  console.trace("I am lone wolf");
  performCheckOrFold(params, function(performCheckOrFoldResponse) {
    serverLog(stateOfX.serverLogType.info, 'Player auto turn performed !');
    if(performCheckOrFoldResponse.success && params.action === stateOfX.move.fold) {
      //previously on autoFold player state goes to sit out
      // performAutoSitout(params, function(performAutoSitoutResponse) {
      //   serverLog(stateOfX.serverLogType.info, 'Player went to auto sitout after autoActDisconnected !!');
      // });

      // now increase auto fold count here
      // TODO: increase auto fold count
      incrementAutoFoldCount(params, true, function(incrementAutoFoldCountResponse){
        serverLog(stateOfX.serverLogType.info, 'Player autoincrement updated' + incrementAutoFoldCountResponse.data.autoFoldCount);
        if (incrementAutoFoldCountResponse.data.autoFoldCount == 2){
          serverLog(stateOfX.serverLogType.info, "autoFoldCount is "+incrementAutoFoldCountResponse.data.autoFoldCount);
          // TODO: here make the player go in observer state
          makePlayerObserver(params, function(makePlayerObserverResponse){
            serverLog(stateOfX.serverLogType.info, "the reponse in make player observer"+makePlayerObserverResponse.success);
          });
          // performAutoSitout(params, function (performAutoSitoutResponse) {
          //   serverLog(stateOfX.serverLogType.info, 'Player went to auto sitout after autoActDisconnected !!');
          // });
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.info, 'Not sitting out player as ' + params.action + ' performed as auto action.');
    }
  });
};

var incrementAutoFoldCount = function(params, incrementValue, cb){
  serverLog(stateOfX.serverLogType.info, "inside increment autoFold count of player!!");
  keyValidator.validateKeySets("Request", "connector", "incrementAutoFold", params, function (validated) {
    if (validated.success) {
      // rpc to add count
      pomelo.app.rpc.database.tableRemote.autoFoldCount(params.session, { channelId: params.channelId, playerId: params.playerId, increment: incrementValue }, function (autoFoldCountResponse) {
        serverLog(stateOfX.serverLogType.info, "in autoFoldResponse value of autoFold " + autoFoldCountResponse.data.autoFoldCount);
        cb(autoFoldCountResponse);
      });
    }else{
      serverLog(stateOfX.serverLogType.error, 'Error while incrementing autoFoldCount - ' + JSON.stringify(validated));
    }
  });
};

var getHitLeaveForAutoFold = function (player, params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler in getHitLeave');
  if (player.serverId) {
    pomelo.app.rpc.connector.sessionRemote.hitLeave({ frontendId: player.serverId }, { playerId: player.playerId, isStandup: true, channelId: params.channelId, isRequested: false, origin: 'autoFoldCount' }, function (hitLeaveResponse) {
      serverLog(stateOfX.serverLogType.info, 'response of rpc-hitLeave' + JSON.stringify(hitLeaveResponse));
      cb(null, player);
    });
  } else {
    cb(null, player);
  }
};


var makePlayerObserver = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "inside makePlayerObserver method!!");
  keyValidator.validateKeySets("Request", "connector", "makePlayerObserver", params, function(validated){
    if(validated.success){
      const removedPlayer = {};
      removedPlayer.playerId = params.playerId;
      getPlayerSessionServer(removedPlayer, params, function (err, responsePlayer) {
        console.error(responsePlayer);
        getHitLeaveForAutoFold(responsePlayer, params, function (err, leaveResponse) {
          console.log(leaveResponse);
          fireRemoveBlindMissedPlayersBroadCast(params, responsePlayer, params.channelId);
        });
      });
    }else{
      cb(validated);
    }
  });
};

// auto move flow for disconnected player
var autoActDisconnected = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function autoActDisconnected');
  keyValidator.validateKeySets("Request", "connector", "autoActDisconnected", params, function (validated){
    if(validated.success) {
      serverLog(stateOfX.serverLogType.info, 'Turn time for this table - ' + parseInt(params.channel.turnTime));
      serverLog(stateOfX.serverLogType.info, 'Player will performe move after extra time - ' + parseInt(stateOfX.extraTimeBank[params.channel.turnTime]||stateOfX.extraTimeBank['default']));
      broadcastHandler.firePlayerStateBroadcast({channel: params.channel, channelId: params.channelId, state: stateOfX.playerState.disconnected, resetTimer: true, playerId: params.playerId});
      params.channel.extraTurnTimeReference = setTimeout(function() {
        // check for state again
        // playing >> broadcast timebank >> timer - ((move.success ? subtract timer OR do it in moveRemote) + following code)
        // disconnected >> (following code)
        pomelo.app.rpc.database.tableRemote.getCurrentPlayer(params.session, {channelId: params.channelId, playerId: params.playerId, key: "state"}, function (getCurrentPlayerResponse) {
          if(getCurrentPlayerResponse.success) {
            params.playerState = getCurrentPlayerResponse.player.state;
            params.player = getCurrentPlayerResponse.player;
            // if (params.playerState === stateOfX.playerState.playing) {
            //   playerSimpleMoveWithTimeBank(params, playerSimpleMoveAndSitout);
            //   // setTimeout(playerSimpleMoveAndSitout, 1000, params);
            // } else {
              playerSimpleMoveAndSitout(params);
            // }
            // serverLog(stateOfX.serverLogType.info, 'Current player state before performing move - ' + params.playerState);
            // cb(null, params);
            cb(null);
          } else {
            // cb(getCurrentPlayerResponse); //previous response when cb is not present
            cb(null);
          }
        });
        // performCheckOrFold(params, function(performCheckOrFoldResponse) {
        //   serverLog(stateOfX.serverLogType.info, 'Player auto turn performed !');
        //   if(performCheckOrFoldResponse.success && params.action === stateOfX.move.fold) {
        //     performAutoSitout(params, function(performAutoSitoutResponse) {
        //       serverLog(stateOfX.serverLogType.info, 'Player went to auto sitout after autoActDisconnected !!')
        //     });
        //   } else {
        //     serverLog(stateOfX.serverLogType.info, 'Not sitting out player as ' + params.action + ' performed as auto action.');
        //   }
        // });
      }, parseInt(stateOfX.extraTimeBank[params.channel.turnTime] || stateOfX.extraTimeBank['default'])*1000);
    } else {
      serverLog(stateOfX.serverLogType.error, 'Error while sending ack broadcast - ' + JSON.stringify(validated));
      cb(null);
    }
  });
};

// ### Handle when player is connected and not making any move
// provide him timbank as available
var autoActConnected = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function autoActConnected');
  keyValidator.validateKeySets("Request", "connector", "autoActConnected", params, function (validated){
    if(validated.success) {
      // broadcast timebank >> timer - ((move.success ? subtract timer OR do it in moveRemote) + following code)
      playerSimpleMoveWithTimeBank(params, playerSimpleMoveAndSitout);
      // performCheckOrFold(params, function(performCheckOrFoldResponse) {
      //   console.error(stateOfX.serverLogType.info, 'Player auto turn performed !', performCheckOrFoldResponse);
      //   if(performCheckOrFoldResponse.success && params.action === stateOfX.move.fold) {
      //     performAutoSitout(params, function(performAutoSitoutResponse) {
      //       serverLog(stateOfX.serverLogType.info, 'Player went to auto sitout after autoActConnected !!')
      //     });
      //   } else {
      //     serverLog(stateOfX.serverLogType.info, 'Not sitting out player as ' + params.action + ' performed as auto action.');
      //   }
      // });
      cb(null);
    } else {
      serverLog(stateOfX.serverLogType.error, 'Error while sending ack broadcast - ' + JSON.stringify(validated));
      cb(null);
    }
  });
};

// tournament
var tournamentAutoActsitout = function (params) {
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function tournamentAutoActsitout');
  keyValidator.validateKeySets("Request", "connector", "autoActDisconnected", params, function (validated){
    if(validated.success) {
      performCheckOrFold(params, function(performCheckOrFoldResponse) {
        serverLog(stateOfX.serverLogType.info, 'Player auto turn performed for tournament == tournamentAutoActsitout!');
        if(performCheckOrFoldResponse.success && params.action === stateOfX.move.fold) {
          performAutoSitout(params, function(performAutoSitoutResponse) {
            serverLog(stateOfX.serverLogType.info, 'Player went to auto sitout after tournamentAutoActsitout !!');
          });
        } else {
          serverLog(stateOfX.serverLogType.info, 'Not sitting out player as ' + params.action + ' performed as auto action.');
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.error, 'Error while sending ack broadcast - ' + JSON.stringify(validated));
    }
  });
};

// ### Handle when player is disconnected
// tournament
var tournamentAutoActDisconnected = function (params) {
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function tournamentAutoActDisconnected');
  keyValidator.validateKeySets("Request", "connector", "autoActDisconnected", params, function (validated){
    if(validated.success) {
      serverLog(stateOfX.serverLogType.info, 'Player will performe move after extra time - ' + parseInt(stateOfX.extraTimeBank[params.channel.turnTime]||stateOfX.extraTimeBank['default']));
      broadcastHandler.firePlayerStateBroadcast({channel: params.channel, channelId: params.channelId, state: stateOfX.playerState.disconnected, resetTimer: true, playerId: params.playerId});
      params.channel.extraTurnTimeReference = setTimeout(function() {
        performCheckOrFold(params, function(performCheckOrFoldResponse) {
          serverLog(stateOfX.serverLogType.info, 'Player auto turn performed for tournament == validateKeySets!');
          if(performCheckOrFoldResponse.success && params.action === stateOfX.move.fold) {
          performAutoSitout(params, function(performAutoSitoutResponse) {
            serverLog(stateOfX.serverLogType.info, 'Player went to auto sitout after tournamentAutoActDisconnected !!');
          });
        } else {
          serverLog(stateOfX.serverLogType.info, 'Not sitting out player as ' + params.action + ' performed as auto action.');
        }
        });
      }, parseInt(stateOfX.extraTimeBank[params.channel.turnTime] || stateOfX.extraTimeBank['default'])*1000);
    } else {
      serverLog(stateOfX.serverLogType.error, 'Error while sending ack broadcast - ' + JSON.stringify(validated));
    }
  });
};

// Check if player has time bank left in account
// tournament
var checkTimeBankLeft = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Processing for channel id: ' + params.channel.channelId);
  // params.timeBankFinished = true;
  // cb(null, params);
  // return true;

  serverLog(stateOfX.serverLogType.info, 'In function checkTimeBankLeft');
  if(params.timeBankLeft > 0) {
    serverLog(stateOfX.serverLogType.info, 'Available time bank for this player: ' + params.timeBankLeft);
    cb(null, params);
  } else {
    serverLog(stateOfX.serverLogType.info, 'No time bank is available for this player, skip further check and perform move!');
    params.timeBankFinished = true;
    cb(null, params);
  }
};

// Start time bank for tournament player
// tournament
var startTimeBank = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Processing for channel id: ' + params.channel.channelId);
  serverLog(stateOfX.serverLogType.info, 'In function startTimeBank');
  // params.timeBankFinished = true;
  // cb(null, params);
  // return true;

  if(!params.timeBankFinished) {
    // Set time bank used and start time for this player
    pomelo.app.rpc.database.requestRemote.setTimeBankDetails(params.session, {playerId: params.playerId, channelId: params.channelId}, function (setTimeBankDetailsResponse) {
      serverLog(stateOfX.serverLogType.info, "Response from remote for setting time bank details: " + JSON.stringify(setTimeBankDetailsResponse));
      if(setTimeBankDetailsResponse.success) {
        broadcastHandler.startTimeBank({channel: params.channel, channelId: params.channelId, playerId: params.playerId, totalTimeBank: params.timeBankLeft, timeBankLeft: params.timeBankLeft});
        serverLog(stateOfX.serverLogType.info, 'Start time bank broadcast fired, starting time bank for ' + params.timeBankLeft + ' seconds!');
        params.isTimeBankUsed = true;
        params.channel.timeBankTurnTimeReference = setTimeout(function(){
          params.timeBankFinished = true;
          cb(null, params);
        }, parseInt(params.timeBankLeft)*1000);
      } else {
        cb({setTimeBankDetailsResponse});
      }
    });
  } else {
    serverLog(stateOfX.serverLogType.info, 'No time bank available for this player, skipping time bank start!');
    cb(null, params);
  }
};

// Perform player move in case of connected player in tournament
// tournament
var performMove = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Processing for channel id: ' + params.channel.channelId);
  if(params.timeBankFinished) {
    performCheckOrFold(params, function(performCheckOrFoldResponse) {
      serverLog(stateOfX.serverLogType.info, 'Player auto turn performed for tournament == tournamentAutoActConnected!');
      serverLog(stateOfX.serverLogType.info, 'Action performed: ' + params.action + ' and player state: ' + params.playerState);
      // if(params.action === stateOfX.move.fold && params.playerState !== stateOfX.playerState.playing) {
      // // Removed as playing player after FOLD is not going on sitout because PLAYING state condition
      if(performCheckOrFoldResponse.success && params.action === stateOfX.move.fold) {
        performAutoSitout(params, function(performAutoSitoutResponse) {
          serverLog(stateOfX.serverLogType.info, 'Player went to auto sitout after tournamentAutoActConnected !!');
          cb(null, params);
        });
      } else {
        serverLog(stateOfX.serverLogType.info, 'Not sitting out player as ' + params.action + ' performed as auto action.');
        cb(null, params);
      }
    });
  } else {
    // cb({success: false, channelId: params.channelId, info: "Time bank check not finished properly!"});
    cb({success: false, channelId: params.channelId, info: configMsg.PERFORMMOVEFAIL_CHANNELTIMERHANDLER, isRetry: false, isDisplay: false});
    serverLog(stateOfX.serverLogType.error, 'Time bank check not finished properly!');
  }
};

// ### Handle when player is connected and not making any move
// tournament
var tournamentAutoActConnected = function (params) {
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function tournamentAutoActConnected');
  keyValidator.validateKeySets("Request", "connector", "autoActConnected", params, function (validated){
    if(validated.success) {
      async.waterfall([
        async.apply(checkTimeBankLeft, params),
        startTimeBank,
        performMove
      ], function(err, response) {
        if(err) {
          serverLog(stateOfX.serverLogType.error, 'Error while performing tournament auto move in connected state player: ' + JSON.stringify(validated));
        } else {
          serverLog(stateOfX.serverLogType.info, 'Auto move in tournament from a connected player has been processed successfully !!');
        }
      });

    } else {
      serverLog(stateOfX.serverLogType.error, 'Error while sending ack broadcast - ' + JSON.stringify(validated));
    }
  });
};

// validate req keys acc to req title
var validateRequestKeys = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Processing for channel id: ' + params.channel.channelId);
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function validateRequestKeys');
  keyValidator.validateKeySets("Request", "connector", "startTurnTimeOut", params, function (validated){
    if(validated.success) {
      cb(null, params);
    } else{
      cb(validated);
    }
  });
};

// fetch table turn time
var getTableTurnTIme = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Processing for channel id: ' + params.channel.channelId);
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function getTableTurnTIme');
  pomelo.app.rpc.database.tableRemote.getTableAttrib(params.session, {channelId: params.channelId, key: "turnTime"}, function (getTableAttribResponse) {
    serverLog(stateOfX.serverLogType.info, "getTableAttribResponse - " + JSON.stringify(getTableAttribResponse));
    if(getTableAttribResponse.success) {
      params.turnTime = getTableAttribResponse.value;
      cb(null, params);
    } else {
      cb(getTableAttribResponse);
    }
  });
};

// kill timers for channel
var killChannelTimers = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Processing for channel id: ' + params.channel.channelId);
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function killChannelTimers');
  killChannelLevelTimers(params);
  cb(null, params);
};

// check for disconnected player, if done precheck - act automove-by-precheck
// UPDATE - also for connected players
var checkForDisconnectedPlayerAndPrecheck = function (params, cb) {
  pomelo.app.rpc.database.tableRemote.getCurrentPlayer(params.session, {channelId: params.channelId, playerId: params.playerId, key: "state"}, function (getCurrentPlayerResponse) {
    serverLog(stateOfX.serverLogType.info, 'getCurrentPlayerResponse - ' + JSON.stringify(getCurrentPlayerResponse));
    if(getCurrentPlayerResponse.success) {
      params.player = getCurrentPlayerResponse.player;
      params.playerId = params.player.playerId;
      // params.playerState = getCurrentPlayerResponse.player.precheckValue;
      // params.playerState = getCurrentPlayerResponse.player.moves;
      // if (params.player.state === stateOfX.playerState.disconnected) {
        serverLog(stateOfX.serverLogType.info, 'Current player-s precheckValue is '+ params.player.precheckValue);
        if (!!params.player.precheckValue /*&& params.player.precheckValue !== stateOfX.playerPrecheckValue.NONE*/) {
          // decide move according to precheck
          serverLog(stateOfX.serverLogType.info, 'Current player-s precheckValue is '+ params.player.precheckValue + ', ' + JSON.stringify(params.player.moves));
          var decidedMove = decideMoveAccToPrecheck(params.player.precheckValue, params.player.moves);
          // make move according to precheck
          if (!!decidedMove) {
            serverLog(stateOfX.serverLogType.info, 'Current player-s decided move is '+ decidedMove);
            // perform move
            getCurrentPlayerSession(params, function (err, params) {
              serverLog(stateOfX.serverLogType.info, 'Current player-s session is '+JSON.stringify(err));
              serverLog(stateOfX.serverLogType.info, 'Current player-s session is '+ JSON.stringify(params.sessionNew));
              if (!err) {
                params.amount = 0;
                params.action = decidedMove;
                params.runBy = "precheck";
                setTimeout(function () {
                perfromPlayerMove(params, function (moveResponse) {
                  serverLog(stateOfX.serverLogType.info, 'Current player-s autoMove response is '+ JSON.stringify(moveResponse));
                  if (!moveResponse.success) {
                    cb(null, params);
                  } else {
                    cb({info: "auto move done already."});
                  }
                });
                }, 500);
              }
            });
          } else {
            serverLog(stateOfX.serverLogType.info, 'Current player precheckValue is not valid anymore - ' + params.player.precheckValue + ', '+ JSON.stringify(params.player.moves));
            cb(null, params);
          }
        } else {
          serverLog(stateOfX.serverLogType.info, 'Current player has not selected precheckValue - ' + params.player.precheckValue);
          cb(null, params);
        }
      ////// PLAYER PRECHECK MOVE IN CONNECTED OR DISCONNECTED STATE - BOTH
      // } else {
      //   serverLog(stateOfX.serverLogType.info, 'Current player state before performing move - ' + params.playerState);
      //   cb(null, params);
      // }
    } else {
      cb(getCurrentPlayerResponse);
    }
  });
};

// set current player as disconnected after waiting for FULL turn time (the main one)
var setCurrentPlayerDisconnected = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Processing for channel id: ' + params.channel.channelId);
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function setCurrentPlayerDisconnected');
  var currentTurnTime = params.turnTime;
  console.error("!!!!!!!!!!!!!!!!",new Date());
  if(!!params.response && (params.response.turn.roundName == stateOfX.round.flop || params.response.turn.roundName == stateOfX.round.turn || params.response.turn.roundName == stateOfX.round.river)){
    currentTurnTime +=2;
  }
  params.channel.turnTimeReference = setTimeout(function() {
    pomelo.app.rpc.database.tableRemote.setCurrentPlayerDisconn(params.session, {channelId: params.channelId}, function (setCurrentPlayerDisconnResponse) {
      serverLog(stateOfX.serverLogType.info, 'Response of player disconnected - ' + JSON.stringify(setCurrentPlayerDisconnResponse));
      if(setCurrentPlayerDisconnResponse.success) {
        params.playerId   = setCurrentPlayerDisconnResponse.playerId;
        params.playerName = setCurrentPlayerDisconnResponse.playerName;
        console.error("@@@@@@@@@@@@",new Date());
        cb(null, params);
      } else {
        cb(setCurrentPlayerDisconnResponse);
      }
    });
  }, parseInt(currentTurnTime)*1000);
};

// fire a broadcast, so player can ack if he is online
var fireConnectionAckBroadcast = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Processing for channel id: ' + params.channel.channelId);
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function fireConnectionAckBroadcast');
  var record = params.channel.getMember(params.playerId)|| {};
  broadcastHandler.fireAckBroadcastOnLogin({ playerId: params.playerId, serverId: record.sid, data: {channelId: params.channelId, setState: true}});
  cb(null, params);
};

// see after ack if player state changed
var getPlayerCurrentState = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Processing for channel id: ' + params.channel.channelId);
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function getPlayerCurrentState');
  params.channel.clientConnAckReference = setTimeout(function() {
    pomelo.app.rpc.database.tableRemote.getCurrentPlayer(params.session, {channelId: params.channelId, playerId: params.playerId, key: "state"}, function (getCurrentPlayerResponse) {
      serverLog(stateOfX.serverLogType.info, 'getCurrentPlayerResponse - ' + JSON.stringify(getCurrentPlayerResponse));
      if(getCurrentPlayerResponse.success) {
        params.playerState = getCurrentPlayerResponse.player.state;
        params.player = getCurrentPlayerResponse.player;
        serverLog(stateOfX.serverLogType.info, 'Current player state before performing move - ' + params.playerState);
        cb(null, params);
      } else {
        cb(getCurrentPlayerResponse);
      }
    });
  }, parseInt(configConstants.isConnectedCheckTime)*1000);
};

// find in db - user session object
// to get server id he is connected to
var getCurrentPlayerSession = function (params, cb) {
  // params.playerId
  // params.session = {} // neew
  pomelo.app.rpc.database.dbRemote.findUserSessionInDB(params.session, params.playerId, function (response) {
    if(response.success && !!response.result){
      // response.result.serverId;
      params.sessionNew = {frontendId: response.result.serverId};
      cb(null, params);
    } else {
      cb({success: false, info: "User session not found in DB."});
    }
  });
};

// Perform operation based on player current state
var performNormalTableAction = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Processing for channel id: ' + params.channel.channelId);
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function performNormalTableAction');
  serverLog(stateOfX.serverLogType.info, 'About to perform for player state - ' + params.playerState);
  if(params.playerState === stateOfX.playerState.disconnected) {
    console.log("Raavan connected");
    autoActDisconnected(params, function (responseAutoActDisconnected){
      cb(null, params);
    });
  } else {
    console.log("Raavan disconnected");
    autoActConnected(params, function (responseAutoActConnected) {
      cb(null, params);
    });
  }
  // cb(null, params);
};


// Get current player object from inmem table
var getCurrentPlayerObject = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Processing for channel id: ' + params.channel.channelId);
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function getCurrentPlayerObject');
  pomelo.app.rpc.database.tableRemote.getCurrentPlayer(params.session, {channelId: params.channelId, playerId: params.playerId}, function (getCurrentPlayerResponse) {
    serverLog(stateOfX.serverLogType.info, 'Get current player from remote response: ' + JSON.stringify(getCurrentPlayerResponse));
    if(getCurrentPlayerResponse.success) {
      params.playerId           = getCurrentPlayerResponse.player.playerId;
      params.playerName         = getCurrentPlayerResponse.player.playerName;
      params.isTournamentSitout = getCurrentPlayerResponse.player.tournamentData.isTournamentSitout;
      params.timeBankLeft       = getCurrentPlayerResponse.player.tournamentData.timeBankLeft;
      params.totalTimeBank      = getCurrentPlayerResponse.player.tournamentData.totalTimeBank;
      params.playerState        = getCurrentPlayerResponse.player.state;
      serverLog(stateOfX.serverLogType.info, 'getCurrentPlayerObject params', params);
      cb(null, params);
    } else {
      cb(getCurrentPlayerResponse);
    }
  });
};

// get player state from inmem table
var getCurrentPlayerSitoutValue = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Processing for channel id: ' + params.channel.channelId);
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function getCurrentPlayerSitoutValue');
  params.channel.clientConnAckReference = setTimeout(function() {
    pomelo.app.rpc.database.tableRemote.getCurrentPlayer(params.session, {channelId: params.channelId, playerId: params.playerId}, function (getCurrentPlayerResponse) {
      serverLog(stateOfX.serverLogType.info, 'getCurrentPlayerResponse - ' + JSON.stringify(getCurrentPlayerResponse));
      if(getCurrentPlayerResponse.success) {
        params.isTournamentSitout = getCurrentPlayerResponse.player.tournamentData.isTournamentSitout;
        params.playerState        = getCurrentPlayerResponse.player.state;
      } else {
        serverLog(stateOfX.serverLogType.error, "Get player state from key failed - " + JSON.stringify(getCurrentPlayerResponse));
      }
      cb(null, params);
    });
  }, 1000);
};

// Perform operation based on player current state
// tournament
var performTournamentTableAction = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Processing for channel id: ' + params.channel.channelId);
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function performTournamentTableAction');
  serverLog(stateOfX.serverLogType.info, '1. Player state - ' + params.playerState + ' and sitout - ' + params.isTournamentSitout);
  if(params.isTournamentSitout) {
    tournamentAutoActsitout(params);
  } else if(params.playerState === stateOfX.playerState.disconnected) {
    tournamentAutoActDisconnected(params);
  } else {
    tournamentAutoActConnected(params);
  }
  cb(null, params);
};

// Perform operation based on player current state
// tournament
var performTournamentSitout = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Processing for channel id: ' + params.channel.channelId);
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function performTournamentSitout');
  serverLog(stateOfX.serverLogType.info, 'Player state - ' + params.playerState + ' and sitout - ' + params.isTournamentSitout);
  if(params.isTournamentSitout) {
    tournamentAutoActsitout(params);
  } else {
    serverLog(stateOfX.serverLogType.info, 'The player might have resume in game!');
    tournamentAutoActConnected(params);
  }
  cb(null, params);
};

// Perform actions for player in sitout mode
// tournament
var performSitoutAction = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Processing for channel id: ' + params.channel.channelId);
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function performSitoutAction');
  async.waterfall([
    async.apply(killChannelTimers, params),
    fireConnectionAckBroadcast,
    getCurrentPlayerSitoutValue,
    performTournamentSitout
  ], function(err, params) {
    if(err) {
      serverLog(stateOfX.serverLogType.error, '========== performSitoutAction failed =========> ' + JSON.stringify(err));
      serverLog(stateOfX.serverLogType.error, err);
      cb(err);
    } else {
      serverLog(stateOfX.serverLogType.info, '========== performSitoutAction success =========');
      cb(null, params);
    }
  });
};

// Perform action for players in normal mode
// tournament
var performNoSitoutAction = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Processing for channel id: ' + params.channel.channelId);
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function performNoSitoutAction');
  if(params.isTournamentSitout) {
    serverLog(stateOfX.serverLogType.info, "Player is in sitout mode so skipping auto sitout turn handling!");
    cb(null, params);
  } else {
    async.waterfall([
      async.apply(killChannelTimers, params),
      getTableTurnTIme,
      setCurrentPlayerDisconnected,
      fireConnectionAckBroadcast,
      getCurrentPlayerSitoutValue,
      performTournamentTableAction
    ], function(err, response) {
      if(err) {
        serverLog(stateOfX.serverLogType.error, 'err in performNoSitoutAction - ' +  JSON.stringify(err));
      } else {
        serverLog(stateOfX.serverLogType.info, 'response in performNoSitoutAction - ' +  JSON.stringify(_.keys(response)));
      }
    });
  }
};

// fetch inmem table
var getTable = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler in getTable');
  pomelo.app.rpc.database.tableRemote.getTable('', {channelId: params.channelId}, function (res) {
    if (res.success) {
      params.table = res.table;
      cb(null, params);
    } else {
      cb(res);
    }
  });
};

// get user session from db
var getPlayerSessionServer = function (player, params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler in getPlayerSessionServer');
  pomelo.app.rpc.database.dbRemote.findUserSessionInDB('', player.playerId, function (res) {
    serverLog(stateOfX.serverLogType.info, 'response of findUserSessionInDB' + JSON.stringify(res));
    //console.error(res.result);
    if (res.success  &&!!res.result.serverId) {
      player.serverId = res.result.serverId;
      cb(null, player, params);
    } else {
      cb(null, player, params);
    }
  });
};

// get hit for autoLeave from connector
// WHY - because leave starts from room but redirects by connector WITH PLAYER SESSION OBJECT SETTINGS
var getHitLeave = function (player, params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler in getHitLeave');
  if(player.serverId){
    pomelo.app.rpc.connector.sessionRemote.hitLeave({frontendId: player.serverId}, { playerId: player.playerId, isStandup: true, channelId: params.channelId, isRequested: false, origin: 'tableIdleTimer'}, function (hitLeaveResponse) {
      serverLog(stateOfX.serverLogType.info, 'response of rpc-hitLeave' + JSON.stringify(hitLeaveResponse));
      fireRemoveBlindMissedPlayersBroadCast(params,player);
      cb(null, player, params);
    });
  } else{
    serverLog(stateOfX.serverLogType.info, 'No serverId found');
    cb(null, player, params);
  }
};

// fire player removed broadcast on channel with antibanking data
var fireRemoveBlindMissedPlayersBroadCast = function(params,player){
  var filter = {};
  filter.playerId = player.playerId;
  filter.channelId = player.channelId;
//  console.error("!!!!!!!!!!!!!!!!!!!1",filter);
  db.getAntiBanking(filter,function(err,response){
    if(!err && response){
      var isAntiBanking = false;
      if(response != null){
      var timeToNumber = parseInt(configConstants.expireAntiBankingSeconds) + parseInt(configConstants.antiBankingBuffer) - (Number (new Date()) -  Number(response.createdAt))/1000 ;
        if(timeToNumber > 0 && response.amount > 0){
          isAntiBanking = true;
        }

      }
       broadcastHandler.sendMessageToUser({ playerId: player.playerId, serverId: player.serverId, msg: {playerId: player.playerId, channelId: params.channelId, isAntiBanking: isAntiBanking, timeRemains:timeToNumber, amount: response.amount, event : stateOfX.recordChange.playerLeaveTable }, route: stateOfX.broadcasts.antiBankingUpdatedData});
        //console.error(isAntiBanking,"!!!!!!!@@@@@@@@@@@@Anti banking",timeToNumber);
    }else{
      broadcastHandler.sendMessageToUser({ playerId: player.playerId, serverId: player.serverId, msg: {playerId: player.playerId, channelId: params.channelId, isAntiBanking: isAntiBanking, timeRemains:-1, amount: -1, event : stateOfX.recordChange.playerLeaveTable }, route: stateOfX.broadcasts.antiBankingUpdatedData});
        //console.error(isAntiBanking,"!!!!!!!@@@@@@@@@@@@Anti banking",timeToNumber);
    }
  });  
};

// run autoLeave for every sitout player
// after game not started from some time - 2 minutes
var forEverySitoutPlayer = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler in forEverySitoutPlayer');
  var sitoutPlayers = _.where(params.table.players, {state: stateOfX.playerState.onBreak});
  if(sitoutPlayers.length <= 0){
    cb(null, params); return;
  }
  async.each(sitoutPlayers, function (player, ecb) {
    async.waterfall([
      async.apply(getPlayerSessionServer, player, params),
      getHitLeave
      ], function (err, player, response) {
        ecb(err, player, response);
      });
  }, function (err, player, params) {
    cb(null, params);
  });
};



// ### Start timeout to handle events after
// after turn broadcast fired
channelTimerHandler.startTurnTimeOut = function (params) {
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function startTurnTimeOut');
  if(configConstants.playerAutoMoveRequired) {
    var channel             = pomelo.app.get('channelService').getChannel(params.channelId, false);
    params.channel          = channel;
    params.timeBankFinished = false;
    params.isTimeBankUsed   = false;
    serverLog(stateOfX.serverLogType.info, "AUTO TURN STARTED FOR " + channel.channelType + " TABLE !");
    if(channel.channelType === stateOfX.gameType.normal) {
      console.log("inside normal case of channel type");
      async.waterfall([
        async.apply(validateRequestKeys, params),
        getTableTurnTIme,
        killChannelTimers,
        checkForDisconnectedPlayerAndPrecheck,
        setCurrentPlayerDisconnected,
        fireConnectionAckBroadcast,
        getPlayerCurrentState,
        getCurrentPlayerSession,
        performNormalTableAction
      ], function(err, response) {
        serverLog(stateOfX.serverLogType.error, 'Error startimeout ' + JSON.stringify(err) + '\nResponse keys - ' + JSON.stringify(_.keys(response)));
      });
    } else {
      console.log("inside else case of channel type");
       async.waterfall([
        async.apply(validateRequestKeys, params),
        getCurrentPlayerObject,
        performNoSitoutAction,
        performSitoutAction
      ], function(err, response) {
        serverLog(stateOfX.serverLogType.error, 'Error startimeout ' + JSON.stringify(err) + '\nResponse keys - ' + JSON.stringify(_.keys(response)));
      });
    }
  } else {
    serverLog(stateOfX.serverLogType.warning, 'Player auto move feature disable from system configuration.');
  }
};


// timer for idle table
// if no game starts in a time
// remove sitout players
channelTimerHandler.tableIdleTimer = function (params) {
 
  // check for conditions, if any
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function tableIdleTimer');
  serverLog(stateOfX.serverLogType.info, 'setting timer for idle table');
  params.channel.idleTableTimer = setTimeout(function () {
    async.waterfall([
      async.apply(function (params, cb) { cb(null, params) ;}, params),
      getTable,
      forEverySitoutPlayer
      ], function (err, response) {
        serverLog(stateOfX.serverLogType.info, 'err and response of tableIdleTimer');
      });
  }, configConstants.tableIdleTimerSeconds*1000);
};

// kill table idle timer
// some game has been started
channelTimerHandler.killTableIdleTimer = function (params) {
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function killTableIdleTimer');
  if(params.channel.idleTableTimer){
    serverLog(stateOfX.serverLogType.info, 'killed idleTableTimer for channelId '+ params.channel.channelId);
    clearTimeout(params.channel.idleTableTimer);
    params.channel.idleTableTimer = null;
  }
};

// Schedule timer to standup player after a time crossed for reserved seat - 10 seconds
channelTimerHandler.vacantReserveSeat = function (params, cb) {
  console.error("reserver sit fired");
  serverLog(stateOfX.serverLogType.info, 'Processing for channel id: ' + params.channel.channelId);
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function vacantReserveSeat');
  var currentTime = new Date();
  var scheduleTime = null;
  if(params.channel.reserveSeatTimeReference[params.playerId]){
    params.channel.reserveSeatTimeReference[params.playerId].cancel();
    params.channel.reserveSeatTimeReference[params.playerId] = null;
  }
  scheduleTime = currentTime.setSeconds(currentTime.getSeconds()+parseInt(configConstants.vacantReserveSeatTime));
  params.channel.reserveSeatTimeReference[params.playerId] = schedule.scheduleJob(currentTime, function(){
    serverLog(stateOfX.serverLogType.info, 'Player will sitout auto now');
    pomelo.app.sysrpc['room'].msgRemote.forwardMessage(
      {forceFrontendId: pomelo.app.serverId},
      {body: {playerId: params.playerId, isStandup: true, channelId: params.channelId, isRequested: false, origin: 'vacantSeat'},
        route: "room.channelHandler.leaveTable"},
      params.session.export(), function () {
        setTimeout(function () {
          broadcastHandler.fireInfoBroadcastToPlayer({ playerId: params.playerId, buttonCode: 1,serverId : params.session.frontendId, channelId: params.channelId, heading: "Standup", info: "You did not act in time (" + configConstants.vacantReserveSeatTime + " seconds), seat in " + params.channel.channelName + " is no longer reserved."});
        },100);
    });
  });
};

// Schedule timer to leave player from room is spectator time crossed - 10 minutes
channelTimerHandler.kickPlayerToLobby = function (params) {
//  console.trace("kick to loby fired");
  console.error(params);
  serverLog(stateOfX.serverLogType.info, 'Processing for channel id: ' + params.channel.channelId);
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function kickPlayerToLobby');
  var currentTime = new Date();
  var scheduleTime = null;
  if(params.channel.kickPlayerToLobby[params.playerId]){
    params.channel.kickPlayerToLobby[params.playerId].cancel();
    params.channel.kickPlayerToLobby[params.playerId] = null;
  }
  console.error(currentTime);
  scheduleTime = currentTime.setSeconds(currentTime.getSeconds()+parseInt(configConstants.playerSpectateLimit));
  console.error(scheduleTime);
  params.channel.kickPlayerToLobby[params.playerId] = schedule.scheduleJob(currentTime, function(){
//  console.trace("kick to loby fired ---- actually");
    serverLog(stateOfX.serverLogType.info, 'Player should kick to lobby now!');
    pomelo.app.rpc.connector.sessionRemote.hitLeave(params.session, { playerId: params.playerId, isStandup: false, channelId: params.channelId, isRequested: false, origin: 'kickToLobby'}, function(){
      // broadcastHandler.fireInfoBroadcastToPlayer({self: params.self, playerId: params.playerId, buttonCode: 1, channelId: params.channelId, heading: "Standup", info: "You did not act in time (" + configConstants.playerSpectateLimit + " seconds), seat in " + params.channel.channelName + " is no longer reserved."})
    });
    var playerObject = {};
    playerObject.playerId = params.playerId;
    playerObject.channelId = params.channelId; 
    // getPlayerSessionServer(playerObject,params,function(cbResult){
    //   console.error(cbResult);
    // })
  });
};

// Kill existing timer for reserve seat
channelTimerHandler.killReserveSeatReferennce = function (params, cb) {
console.error("reserver kill sit fired");
  if(!params.channel){
     console.error("if u get a error i m responsible",params);
     channelTimerHandler.killKickToLobbyTimer(params);
     //return;
   }
  //console.error("@@@@@@@@@@@@@@@@@@@@@@@@@@!!!!!!!!!!!!!!!!!!@@@@@@@@@@@@@@@@@@@@@###############",params);
  serverLog(stateOfX.serverLogType.info, 'Processing for channel id: ' + params.channel.channelId);
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function killReserveSeatReferennce');
  if(params.channel.channelType === stateOfX.gameType.normal && !!params.channel.reserveSeatTimeReference[params.playerId]) {
    serverLog(stateOfX.serverLogType.info, 'Reserve seat timer exists for this player - ' + params.playerId + ', killing schedule!');
    params.channel.reserveSeatTimeReference[params.playerId].cancel();
    params.channel.reserveSeatTimeReference[params.playerId] = null;
  } else {
    serverLog(stateOfX.serverLogType.info, 'No reserve seat timer exists for player id - ' + params.playerId);
  }
  channelTimerHandler.killKickToLobbyTimer(params);

  // Also kill timer to kick player on lobby if player taken a seat
};


// Kill existing timer for any player to kick on lobby
channelTimerHandler.killKickToLobbyTimer = function (params, cb) {
 // console.trace("kill kick to loby fired");
 console.error();
  serverLog(stateOfX.serverLogType.info, 'Processing for channel id: ' + params.channel.channelId);
  serverLog(stateOfX.serverLogType.info, 'In channelTimerHandler function killKickToLobbyTimer');
  if(params.channel.channelType === stateOfX.gameType.normal && !!params.channel.kickPlayerToLobby[params.playerId]) {
    serverLog(stateOfX.serverLogType.info, 'Kick to lobby timer exists for this player - ' + params.playerId + ', killing schedule!');
    params.channel.kickPlayerToLobby[params.playerId].cancel();
    params.channel.kickPlayerToLobby[params.playerId] = null;
  } else {
    serverLog(stateOfX.serverLogType.info, 'No Kick to lobby timer exists for player id - ' + params.playerId);
  }
};

// kill channel timers
channelTimerHandler.killChannelTurnTimer = function(params){
  killChannelLevelTimers(params);
};

module.exports = channelTimerHandler;
