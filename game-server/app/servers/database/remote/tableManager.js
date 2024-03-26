/*jshint node: true */
"use strict";

// This file is used to manipulate table operations
var _ld          = require("lodash"),
    _            = require("underscore"),
    async        = require("async"),
    stateOfX     = require("../../../../shared/stateOfX"),
    zmqPublish   = require("../../../../shared/infoPublisher"),
    db           = require("../../../../shared/model/dbQuery"),
    imdb         = require("../../../../shared/model/inMemoryDbQuery"),
    logDB           = require("../../../../shared/model/logDbQuery.js"),
    profileMgmt  = require("../../../../shared/model/profileMgmt"),
    winnerMgmt   = require("../../../../shared/winnerAlgo/entry"),
    popupTextManager  = require("../../../../shared/popupTextManager"),
    keyValidator = require("../../../../shared/keysDictionary"),
    activity     = require("../../../../shared/activity.js");
const configConstants = require('../../../../shared/configConstants')
var tableManager = {};

// ALL FUNCTION HERE
// WORK AFTER TABLE IS LOCKED
// BE CAUTION for any delays
// AND REMEBER TO RETURN TABLE OBJECT

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'tableManager';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  // zmqPublish.sendLogMessage(logObject);
  console.log(JSON.stringify(logObject));
}

function fixedDecimal(number, upto) {
  number = Number(number);
  return Number(number.toFixed(upto));
}

// ### Get table from database
tableManager.getTableObject = function (params, cb) {
  cb({success: true, table: params.table});
};

// ### Push player as waiting in player array
tableManager.addPlayerAsWaiting = function (params, cb) {
  tableManager.seatsFullOrPlayerNotOnTable(params, function (res) {
    if(res.success){
      var indexOccupied = _.uniq(_.pluck(params.table.players, 'seatIndex'));
      if(indexOccupied.indexOf(params.data.player.seatIndex) >= 0){
        // TODO: Refund chips from here as chips is deducted till now and also sit is not available
        // ISSUE: When two player try to sit on same table and same seatIndex then one get the seat and 
        // other doesn't get the seat and chips also gets deducted which is not refunded also.
        // Resolve: Refund chips.
        // BY Digvijay Rathore (3 Jan 2020)
        tableManager.refundChips(params, function(refundChipsResponse){
          console.trace("Error from here");
          cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.VALIDATESEATOCCUPANCYFAIL_SITHEREHANDLER});
        });
      } else {
        params.table.players.push(params.data.player);
        serverLog(stateOfX.serverLogType.info, 'Total players after this playerd added - ' + JSON.stringify(params.table.players));
        cb({success: true, table: params.table, data: {player: params.data.player}});      
      }
    } else{
      cb(res);
    }
  });
};

tableManager.refundChips = (params, cb) => {
  var chipsToRefund = fixedDecimal(params.data.player.chips, 2);
  var instantBonusAmount = fixedDecimal(params.data.player.instantBonusAmount, 2);
  profileMgmt.addChips({ playerId: params.data.player.playerId, chips: chipsToRefund, isRealMoney: params.table.isRealMoney, instantBonusAmount: instantBonusAmount, category: "Table Actions Refund", tableName: params.table.channelName }, function (addChipsResponse) {
    serverLog(stateOfX.serverLogType.info, 'Add chips response from db - ' + JSON.stringify(addChipsResponse));
    if (addChipsResponse.success) {
      cb(null, params);
    } else {
      //cb({success: false, channelId: params.channelId, info: "Refund money to player account failed on - " + params.data.action});
      cb({ success: false, channelId: (params.channelId || ""), info: popupTextManager.PROFILEMGMTADDCHIPS_REFUNDAMOUNTONLEAVE_LEAVEREMOTE, isRetry: false, isDisplay: true });
    }
  });
};

// ### Get buy in amount of table
tableManager.getTableBuyIn = function (params, cb) {
  cb({success: true, data: {tableMinBuyIn: params.table.minBuyIn, tableMaxBuyIn: params.table.maxBuyIn}, table: params.table});
};

// ### Get total seat occupied on table

tableManager.getSeatOccupied = function (params, cb) {
  cb({success: true, data: {indexOccupied: _.uniq(_.pluck(params.table.players, 'seatIndex'))}, table: params.table});
};

// Get current player object with move
tableManager.getCurrentPlayer = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Getting current player for ' + params.table.channelType + ' > ' + JSON.stringify(params.table.players));
  if(params.table.players.length > 0 && params.table.currentMoveIndex < (params.table.players.length) && params.table.currentMoveIndex !== -1) {
    params.data.player = params.table.players[params.table.currentMoveIndex];
    params.data.success = true;
    cb({success: true, data: params.data, table: params.table});
  } else {
     cb({success: false, isRetry: true, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.GETCURRENTPLAYERFAIL_TABLEMANAGER});
    //cb({success: false, channelId: params.channelId, info: "Invalid attempt tp get current player."})
  }
};

// ### Set Game state as Running
// NO USE of this function
// deprecated
tableManager.updateTableEntitiesOnGameStart = function (params, cb) {
  keyValidator.validateKeySets("Request", "database", "updateTableEntitiesOnGameStart", params, function (validated){
    if(validated.success) {
      params.table.state = stateOfX.gameState.running;
      cb({success: true});
    } else {
      cb(validated);
    }
  });
};

// ### Get total active players on table
tableManager.totalActivePlayers = function (params, cb) {
   keyValidator.validateKeySets("Request", "database", "totalActivePlayers", params, function (validated){
    if(validated.success) {
      // THIS LINE ADDED BECUSE DISCONNECTED PLAYE AUTO MOVE WAS NOT PERFORMING NEW CODE START
      // var tempDisconnectedPlayers =  _.where(params.table.players, {state: stateOfX.playerState.disconnected, active: true});
      // var tempPlayingPlayers =  _.where(params.table.players, {state: stateOfX.playerState.playing, active: true});
      // for(var i=0;i< tempDisconnectedPlayers.length;i++){
      //   if(params.table.onStartPlayers.indexOf(tempDisconnectedPlayers[i].playerId) >= 0){
      //     tempPlayingPlayers = tempPlayingPlayers.concat(tempDisconnectedPlayers[i])
      //   }
      // }
      // cb({success: true, players:tempPlayingPlayers});
      // END HERE
      //cb({success: true, players: _.where(params.table.players, {state: stateOfX.playerState.playing, active: true})});
      // FIX FIXED CORRECTLY - concating players up and down - changes index - THAT
      // created severe problems
      cb({success: true, players: _.filter(params.table.players, function (p) {
        // change - onStartPlayers - MAY BE we do not need
        return ((p.state == stateOfX.playerState.playing || p.state == stateOfX.playerState.disconnected) && p.active == true);
      })});
    } else {
      cb(validated);
    }
  });
};

// ### Get total playing players on table
tableManager.totalPlayingPlayers = function (params, cb) {
   keyValidator.validateKeySets("Request", "database", "totalActivePlayers", params, function (validated){
    if(validated.success) {
      cb({success: true, players: _.where(params.table.players, {state: stateOfX.playerState.playing})});
    } else {
      cb(validated);
    }
  });
};

// ### Get total waiting players on table
tableManager.totalWaitingPlayers = function (params, cb) {
   keyValidator.validateKeySets("Request", "database", "totalWaitingPlayers", params, function (validated){
    if(validated.success) {
      cb({success: true, players: _.where(params.table.players, {state: stateOfX.playerState.waiting})});
    } else {
      cb(validated);
    }
  });
};

// ### Perform resume after locking table object
tableManager.resumePlayer = function (params, cb) {
  // Return if player is not sitting on the table
  serverLog(stateOfX.serverLogType.info, 'Processing to resume player: ' + JSON.stringify(_.where(params.table.players, {playerId: params.data.playerId})));
  if(_.where(params.table.players, {playerId: params.data.playerId}).length < 0) {
    cb({success: false, code: 401, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.RESUMEPLAYER_NOTSITTING_TABLEMANAGER});
    return false;
  }

  var player = _.where(params.table.players, {playerId: params.data.playerId})[0];
  serverLog(stateOfX.serverLogType.info, 'About to resume player: ' + JSON.stringify(player));

  // Added as found in log that player variable become undefined, not found again to adding this additional check
  if(!player) {
    cb({success: false, code: 402, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.RESUMEPLAYER_NOTSITTING_TABLEMANAGER});
    return false;
  }

  player.activityRecord.lastActivityTime = Number(new Date()); // Record last activity of player

  // Return if not in sitout mode
  var normalGameSitout = params.table.channelType === stateOfX.gameType.normal && (player.state === stateOfX.playerState.onBreak || player.state === stateOfX.playerState.outOfMoney);
  var tournamentSitout = params.table.channelType === stateOfX.gameType.tournament && !player.tournamentData.isTournamentSitout;

  if(!normalGameSitout || tournamentSitout) {
    cb({success: false, code: 403, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.RESUMEPLAYER_NOTSITTING_TABLEMANAGER});
    return false;
  }

  // Resume player and reset all sitout options as false
  params.data.success         = true;
  params.data.channelId       = params.table.channelId;
  params.data.isOutOfMoney    = false;
  params.data.lastMove        = player.lastMove;
  
  player.sitoutNextHand       = false;
  player.sitoutNextBigBlind   = false;
  player.autoSitout           = false;
  // player.hasPlayedOnceOnTable = false; // player has played some games, then sitout, then sit in - so why resetting this flag
  player.bigBlindMissed       = 0;
  player.disconnectedMissed   = 0;
  player.sitoutGameMissed     = 0;
  player.autoFoldCount        = 0;

  params.data.previousState = player.state;
  // Handle if player is OUTOFMONEY case
  if(params.table.channelType !== stateOfX.gameType.tournament) {
    if(parseInt(player.chips) === 0) {
      params.data.isOutOfMoney = true;
      player.state = stateOfX.playerState.outOfMoney;
    } else {
      // Add as waiting so that not considers as playing player verifications
      player.state = stateOfX.playerState.waiting;
    }
    params.data.state = player.state;
    serverLog(stateOfX.serverLogType.info, 'Player resume set - ' + JSON.stringify(player));
    activity.resume(params,stateOfX.profile.category.game,stateOfX.game.subCategory.resume,stateOfX.logType.success);
    // activity.playerState(params,stateOfX.profile.category.game,stateOfX.game.subCategory.playerState,stateOfX.logType.info);
    cb({success: true, data: params.data, table: params.table});
    return true;
  } else {
    player.tournamentData.isTournamentSitout = false;
    params.data.state = player.state;
    cb({success: true, data: params.data, table: params.table});
    return true;
  }
};

// ### Perform sitout in Next Hand after locking table object
tableManager.processSitoutNextHand = function (params, cb) {
  // Return if this is tournament
  // if(params.table.channelType === stateOfX.gameType.tournament) {
  //   cb({success: false, channelId: params.channelId, info: "Cannot use this feature in tournament"})
  //   return
  // }

  if(_.where(params.table.players, {playerId: params.data.playerId}).length > 0) {
    var player                             = _.where(params.table.players, {playerId: params.data.playerId})[0];
    player.activityRecord.lastActivityTime = Number(new Date()); // Record last activity of player
    player.sitoutNextBigBlind              = false;
    player.sitoutNextHand                  = true;

    // <<< Commenting as player opt sitout and when gets turn, gets FOLDED instantely
    // if(params.table.channelType === stateOfX.gameType.tournament) {
    //   player.tournamentData.isTournamentSitout = true;
    // }


    if(params.table.channelType !== stateOfX.gameType.tournament && player.state === stateOfX.playerState.waiting) {
      player.state = stateOfX.playerState.onBreak;
    }
    if(params.table.channelType !== stateOfX.gameType.tournament && player.state === stateOfX.playerState.playing && player.lastMove === stateOfX.move.fold) {
      player.state = stateOfX.playerState.onBreak;
    }
    serverLog(stateOfX.serverLogType.info, 'Player siout next hand set - ' + JSON.stringify(player));
    params.data.success   = true;
    params.data.state     = player.state;
    params.data.lastMove  = player.lastMove;
    params.data.channelId = params.table.channelId;
    activity.sitoutNextHand(params,stateOfX.profile.category.game,stateOfX.game.subCategory.sitoutNextHand,stateOfX.logType.success);
    cb({success: true, data: params.data, table: params.table});
  } else {
    cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.PROCESSSITOUTNEXTHANDFAIL_TABLEMANAGER});
    //cb({success: false, channelId: params.channelId, info: 'You are not sitting on the table, cannot sitout in next hand!'});
  }
};

// ### Perform sitout in Next Big Bling after locking table object
// deprecated
tableManager.processSitoutNextBigBlind = function (params, cb) {
  // Return if this is tournament
  if(params.table.channelType === stateOfX.gameType.tournament) {
    cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.PROCESSSITOUTNEXTBIGBLINDFAIL_TABLEMANAGER});
    //cb({success: false, channelId: params.channelId, info: "Cannot use this feature in tournament"})
    return;
  }

  if(_.where(params.table.players, {playerId: params.data.playerId}).length > 0) {
    var player                             = _.where(params.table.players, {playerId: params.data.playerId})[0];
    player.activityRecord.lastActivityTime = Number(new Date()); // Record last activity of player
    player.sitoutNextHand                  = false;
    player.sitoutNextBigBlind              = true;
    params.data.success                    = true;
    params.data.channelId                  = params.table.channelId;
    params.data.state                      = player.state;
    serverLog(stateOfX.serverLogType.info, 'Player sitout next big blind set - ' + JSON.stringify(player));
    // activity.sitoutNextBigBlind(params,stateOfX.profile.category.game,stateOfX.game.subCategory.sitoutNextBigBlind,stateOfX.logType.success);
    cb({success: true, data: params.data, table: params.table});
  } else {
    cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.PROCESSSITOUTNEXTBIGBLIND_NOTSITTING_TABLEMANAGER});
    //cb({success: false, channelId: params.channelId, info: 'You are not sitting on the table, cannot sitout in next BB!'});
  }
};

// ### Reset sitout options if player uncheck any sitout option
tableManager.resetSitOut = function (params, cb) {
  if(_.where(params.table.players, {playerId: params.data.playerId}).length > 0) {
    _.where(params.table.players, {playerId: params.data.playerId})[0].sitoutNextHand     = false;
    _.where(params.table.players, {playerId: params.data.playerId})[0].sitoutNextBigBlind = false;
    params.data.success = true;
    params.data.state   = _.where(params.table.players, {playerId: params.data.playerId})[0].state;
    params.data.channelId = params.table.channelId;
    serverLog(stateOfX.serverLogType.info, 'Player sitout next big blind set - ' + JSON.stringify(_.where(params.table.players, {playerId: params.data.playerId})[0]));
    activity.resetSitOut(params,stateOfX.profile.category.game,stateOfX.game.subCategory.resetSitOut,stateOfX.logType.success);
    cb({success: true, data: params.data, table: params.table});
  } else {
    cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.RESETSITOUTFAIL_TABLEMANAGER});
    //cb({success: false, channelId: params.channelId, info: 'You are not sitting on the table, cannot reset sitout!'});
  }
};

// ### Perform add in waiting queue of table
tableManager.joinPlayerInQueue = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "In function joinPlayerInQueue.");
  rejectIfPassword(params, function (reject) {
    if (reject) {
      cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.TABLEPASSWORDFAIL_JOINCHANNELHANDLER});
      return;
    }
  
  if(params.table.players.length >= params.table.maxPlayers) { // If there are empty seats
    if(_ld.findIndex(params.table.queueList, {playerId: params.data.playerId}) < 0) { // Player not already in queue
      tableManager.isSameNetworkSit(params, function (result) {
        if (result.success) {
          if (configConstants.allowSameNetworkPlay||_ld.findIndex(params.table.queueList, {networkIp: params.data.networkIp}) < 0) {
            var typeofChips = params.table.isRealMoney ? {"realChips": 1} : {"freeChips": 1};
            db.getCustomUser(params.data.playerId, typeofChips, function(err, response) { // Player have insufficient amount to join table
              serverLog(stateOfX.serverLogType.info, 'err and response for join player in queue - ');
              serverLog(stateOfX.serverLogType.info, 'err for join player in queue - ' + JSON.stringify(err));
              serverLog(stateOfX.serverLogType.info, 'response for join player in queue - ' + JSON.stringify(response));
              if(!err && ((typeof response.realChips == 'number') || (typeof response.freeChips == 'number'))) {
                var chips = params.table.isRealMoney ? (response.realChips||0) : (response.freeChips||0);
                serverLog(stateOfX.serverLogType.info, 'About to check min buyin and player profile chips condition');
                if(parseInt(chips) >= parseInt(params.table.minBuyIn)) {
                  params.table.queueList.push({playerId: params.data.playerId, playerName: params.data.playerName, networkIp: params.data.networkIp});
                  params.data.success = true;
                  params.data.info    = params.data.playerName + ", you have been queued at no " + params.table.queueList.length + ".";
                  cb({success: true, data: params.data, table: params.table});
                } else {
                  serverLog(stateOfX.serverLogType.info, popupTextManager.dbQyeryInfo.DBGETCUSTOMERUSER_JOINPLAYERINQUEUE_INSUFFICIENTAMOUNT_TABLEMANAGER);
                  cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.dbQyeryInfo.DBGETCUSTOMERUSER_JOINPLAYERINQUEUE_INSUFFICIENTAMOUNT_TABLEMANAGER});
                  //cb({success: false, channelId: params.channelId, info: params.data.playerName + ", you have insufficient amount to join this table, try again later."});
                }
              } else {
                serverLog(stateOfX.serverLogType.info, popupTextManager.dbQyeryInfo.DBGETCUSTOMERUSER_JOINPLAYERINQUEUEFAIL_TABLEMANAGER);
                cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.dbQyeryInfo.DBGETCUSTOMERUSER_JOINPLAYERINQUEUEFAIL_TABLEMANAGER});
                //cb({success: false, channelId: params.channelId, info: params.data.playerName + ", there is some error while getting your chips details, try again later."});
              }
            });
          } else {
            cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.ISSAMENETWORKSITFAIL_TABLEMANAGER});
          }
        } else {
          cb(result);
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.info, popupTextManager.dbQyeryInfo.DBGETCUSTOMERUSER_JOINPLAYERINQUEUEALREADYINWAITINGLIST_TABLEMANAGER);
      cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: params.data.playerName + ", " + popupTextManager.dbQyeryInfo.DBGETCUSTOMERUSER_JOINPLAYERINQUEUEALREADYINWAITINGLIST_TABLEMANAGER});
      //cb({success: false, channelId: params.channelId, info: params.data.playerName + ", you are already in waiting list at number - " + (_ld.findIndex(params.table.queueList, {playerId: params.data.playerId}) + 1) + "."})
    }
  } else {
    serverLog(stateOfX.serverLogType.info, popupTextManager.dbQyeryInfo.DBGETCUSTOMERUSER_JOINPLAYERINQUEUEEMPTYSEATS_TABLEMANAGER);
    cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: params.data.playerName + popupTextManager.dbQyeryInfo.DBGETCUSTOMERUSER_JOINPLAYERINQUEUEEMPTYSEATS_TABLEMANAGER});
    //cb({success: false, channelId: params.channelId, info: params.data.playerName + ", there are empty seats on table, try normal join instead."});
  }
  });
};

// ### Set player attribute after locking table object ISCONNECTED API call
tableManager.setPlayerValue = function (params, cb) {
  var playerIndex = _ld.findIndex(params.table.players, {playerId: params.data.playerId});
  if(playerIndex >= 0) {
    serverLog(stateOfX.serverLogType.info, 'Initial value of ' + params.data.key + ' for player - ' + params.table.players[playerIndex].playerName + ', ' + params.table.players[playerIndex][params.data.key]);

    params.data.success = true;
    params.data.channelId = params.table.channelId;
    params.table.players[playerIndex].activityRecord.lastActivityTime = Number(new Date()); // Record last activity of player


    if (params.data.key === "state") {
      if (params.data.value == stateOfX.playerState.playing) {
        if (params.table.onStartPlayers.indexOf(params.data.playerId)>=0) {
          if (params.table.players[playerIndex].roundId == params.table.roundId) {
            // if ifLastState is provided & player's state is that
            // then change it
            if(!!params.data.ifLastState && params.table.players[playerIndex].state == params.data.ifLastState) {
              params.table.players[playerIndex][params.data.key] = params.data.value;
              serverLog(stateOfX.serverLogType.info,  'Changing player state from: ' + params.table.players[playerIndex][params.data.key] +' to: '+ params.data.value);
              cb({success: true, table: params.table, data: params.data});
              return true;
            // Do not change player state PLAYING if OUTOFMONEY
            // if(params.data.key === "state" && params.table.players[playerIndex][params.data.key] !== stateOfX.playerState.outOfMoney) {
            } else if (params.table.players[playerIndex][params.data.key] !== stateOfX.playerState.outOfMoney) {
              serverLog(stateOfX.serverLogType.info,  'Changing player state from: ' + params.table.players[playerIndex][params.data.key]);
              params.table.players[playerIndex][params.data.key] = params.data.value;
              cb({success: true, table: params.table, data: params.data});
              return true;
            } else {
              serverLog(stateOfX.serverLogType.info,  '**NOT** Changing player state from: ' + params.table.players[playerIndex][params.data.key] +' to: '+ params.data.value);
              cb({success: true, table: params.table, data: params.data});
              return true;
            }
          } else {
            cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.SETPLAYERVALUEFAIL_TABLEMANAGER});
            return true;
          }
        } else {
          cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.SETPLAYERVALUEFAIL_TABLEMANAGER});
          return true;
        }
      } else {
        params.table.players[playerIndex][params.data.key] = params.data.value;
        cb({success: true, table: params.table, data: params.data});
        return true;
      }
    }

    if (params.data.keyValues) {
      Object.assign(params.table.players[playerIndex], params.data.keyValues);
    } else {
      params.table.players[playerIndex][params.data.key] = params.data.value;
    }

    serverLog(stateOfX.serverLogType.info, 'Updated value of ' + params.data.key + ' for player - ' + params.table.players[playerIndex].playerName + ', ' + params.table.players[playerIndex][params.data.key]);
    cb({success: true, table: params.table, data: params.data});
  } else {
    cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.SETPLAYERVALUEFAIL_TABLEMANAGER});
    //cb({success: false, channelId: params.channelId, info: "Setting player attribute failed, player not on table!"})
  }
};

// ### Set player attribute after locking table object
tableManager.getTableValue = function (params, cb) {
  cb({success: true, table: params.table, data: {success: true, value: params.table[params.data.key], tableName: params.table["channelName"]}});
};

// ### Set current player state as DISCONNECTED after locking table object
tableManager.disconnectCurrentPlayer = function (params, cb) {
  if(params.table.players.length > 0 && params.table.currentMoveIndex < (params.table.players.length) && params.table.currentMoveIndex !== -1) {
    params.data.success                                                               = true;
    params.table.players[params.table.currentMoveIndex].state                         = stateOfX.playerState.disconnected;
    params.table.players[params.table.currentMoveIndex].activityRecord.disconnectedAt = new Date();
    serverLog(stateOfX.serverLogType.info, 'Player after setting state disconnecting - ' + JSON.stringify(params.table.players[params.table.currentMoveIndex]));
    cb({success: true, table: params.table, data: {success: true, playerId: params.table.players[params.table.currentMoveIndex].playerId, playerName: params.table.players[params.table.currentMoveIndex].playerName}});
  } else {
    cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.DISCONNECTCURRENTPLAYERFAIL_TABLEMANAGER});
    //cb({success: false, channelId: params.channelId, info: "Invalid attempt to get current player."})
  }
};

// ### Get attribute of any player on table after locking table object
tableManager.getPlayerValue = function (params, cb) {
  var playerIndex = _ld.findIndex(params.table.players, {playerId: params.data.playerId});
  if(playerIndex >= 0) {
    cb({success: true, table: params.table, data: {success: true, value: params.table.players[playerIndex][params.data.key]}});
  } else {
    cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.GETPLAYERVALUEFAIL_TABLEMANAGER});
    //cb({success: false, channelId: params.channelId, info: "Get player value from key " + params.data.key + " failed, player not on table!"})
  }
};

// get player chips balance on table
tableManager.getPlayerChipsWithFilter = function (params, cb) {
  var playerIndex = _ld.findIndex(params.table.players, {playerId: params.data.playerId});
  // if(params.table.isRealMoney == true){
    if (params.table.channelType == stateOfX.gameType.normal) {
      // if(params.table.channelVariation == ??)
      if(playerIndex>=0){
        cb({success: true, table: params.table, data: {success: true, isRealMoney: params.table.isRealMoney, value: params.table.players[playerIndex][params.data.key]}});
        return;
      }
    }
  // }
  cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: " filter failed or player not there"});
};


// ### Perform sitout in Next Big Bling after locking table object
tableManager.performAutoSitout = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "In tableManager performAutoSitout ! ");
  if(_.where(params.table.players, {playerId: params.data.playerId}).length > 0) {
    serverLog(stateOfX.serverLogType.info, 'Player while performing autositout - ' + JSON.stringify(_.where(params.table.players, {playerId: params.data.playerId})));
    if(_.where(params.table.players, {playerId: params.data.playerId})[0].state === stateOfX.playerState.playing) {
      serverLog(stateOfX.serverLogType.info, '1. Player is in ' + _.where(params.table.players, {playerId: params.data.playerId})[0].state  + ' state.');
      if(params.table.channelType === stateOfX.gameType.tournament) {
        _.where(params.table.players, {playerId: params.data.playerId})[0].tournamentData.isTournamentSitout = true;
      } else {
        // if(!params.isConnected) { //  Removing this as above condition check if player is playing
          // serverLog(stateOfX.serverLogType.info, 'Player is not connected so setting autoSitout as true.');
        // }
        _.where(params.table.players, {playerId: params.data.playerId})[0].state = stateOfX.playerState.onBreak;
      }
      cb({success: true, data: params.data, table: params.table});
    } else {
      serverLog(stateOfX.serverLogType.info, '2. Player is in ' + _.where(params.table.players, {playerId: params.data.playerId})[0].state  + ' state.');
      _.where(params.table.players, {playerId: params.data.playerId})[0].autoSitout = true;
      _.where(params.table.players, {playerId: params.data.playerId})[0].state = stateOfX.playerState.onBreak;
      cb({success: true, data: params.data, table: params.table});
      // cb({success: false, channelId: params.channelId, info: 'Player is not playing!'})
    }
  } else {
    cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.PERFORMAUTOSITFAIL_TABLEMANAGER});
    //cb({success: false, channelId: params.channelId, info: "Perform auto sitout in next big blind failed, player not on table!"})
  }
};

tableManager.handleAutoFoldCount = function (params, cb) {
  console.log("in tableManager handleAutoFoldCount method " + params.data.increment);
  if(_.where(params.table.players, {playerId: params.data.playerId}).length > 0){
    serverLog(stateOfX.serverLogType.info, "Player on table proceed furthers" + params.data.increment);
    if (params.data.increment){
      serverLog(stateOfX.serverLogType.info, "While going to increment autofold count");
      //TODO: add here condition for two players
      // if (params.table.players.length === 2){
      //   _.where(params.table.players, { playerId: params.data.playerId })[0].autoFoldCount += 1;
      //   _.where(params.table.players, { playerId: params.data.playerId })[0].resetAutoFoldCount = true;
      // }else{
        _.where(params.table.players, { playerId: params.data.playerId })[0].autoFoldCount += 1;
        _.where(params.table.players, { playerId: params.data.playerId })[0].resetAutoFoldCount = false;
      // }
    }else{
      serverLog(stateOfX.serverLogType.info, "While going to reset autofold count");
      _.where(params.table.players, { playerId: params.data.playerId })[0].autoFoldCount = 0;
    }
    params.data.autoFoldCount = _.where(params.table.players, { playerId: params.data.playerId })[0].autoFoldCount;
    cb({success: true, data: params.data, table: params.table});
  }else{
    serverLog(stateOfX.serverLogType.error, "Player not on table so Could not increment AutoFold Count");
    cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: "Player not on table so Could not increment AutoFold Count"});
  }
};

tableManager.setAutoFoldResetValue = function (params, cb) {
  console.log("inside tableManager setAutoFoldResetCount to true for count greater than 1");
  for (let i = 0; i < params.table.players.length; i++){
    if (params.table.players[i].resetAutoFoldCount && params.table.players[i].state === stateOfX.playerState.playing) {
      params.table.players[i].autoFoldCount = 0;
    }else if (params.table.players[i].autoFoldCount > 0){
      params.table.players[i].resetAutoFoldCount = true;
    }
  }
  cb({success: true, data: params.data, table: params.table});
};


// ### Get IF total seat occupied on table OR player not already sitting on table
tableManager.seatsFullOrPlayerNotOnTable = function (params, cb) {
  if(params.table.players.length !== params.table.maxPlayers) {
    if(_ld.findIndex(params.table.players, {playerId: params.data.playerId}) < 0) {
      cb({success: true, table: params.table});
    } else {
      cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.PLAYERONTABLEFAIL_TABLEMANAGER});
      //cb({success: false, channelId: params.channelId, info: "Player already on table!"})
    }
  } else {
    cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.SEATSFULLONTABLEFAIL_TABLEMANAGER});
    //cb({success: false, channelId: params.channelId, info: "All seats are full on the table !"})
  }
};

// ### pop some card from deck on table
tableManager.popCard = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in tableManager - popCard');
  keyValidator.validateKeySets("Request", "database", "popCard", params, function (validated){
    if(validated.success) {
      var cards = params.table.deck.slice(0, params.count);
      params.table.deck.splice(0, params.count);
      cb({success: true, cards: cards});
    } else {
      cb(validated);
    }
  });
};

// ### Get next suitable index from array
// > Includes condition to handle array limits management
tableManager.getNextSuitableIndex = function (index, length) {
  if(index+1 > length-1) {
    return 0;
  } else {
    return (index+1);
  }
};

// ### Get previous suitable index from array
// > Includes condition to handle array limits management
tableManager.getPreSuitableIndex = function (index, length) {
  if(index-1 < 0) {
    return (length-1);
  } else {
    return (index-1);
  }
};

// tournament
tableManager.getTournamentSitoutPlayers = function(table) {
  var totalTournamentSitoutPlayers = [];
  if(table.channelType === stateOfX.gameType.tournament) {
    for (var i = 0; i < table.players.length; i++) {
      if(table.players[i].tournamentData.isTournamentSitout) {
        totalTournamentSitoutPlayers.push(table.players[i]);
      }
    }
    serverLog(stateOfX.serverLogType.info, 'Tournament sitout players - ' + JSON.stringify(totalTournamentSitoutPlayers));
  }
  return totalTournamentSitoutPlayers;
};

// ### Check if there is player to make a move
// > used to validate Game over conditions
tableManager.isPlayerWithMove = function (params) {
  serverLog(stateOfX.serverLogType.info, 'In tableManager function isPlayerWithMove.');
  // Only if there is 1 active player with playing state
  var totalTournamentSitoutPlayers = tableManager.getTournamentSitoutPlayers(params.table);

  var playingPlayers            = _.where(params.table.players, {state: stateOfX.playerState.playing});
  // var totalPlayingPlayers       = _.difference(playingPlayers, totalTournamentSitoutPlayers); // Enable to consider tournament sitout players as inactive (Player leave game over case)
  var totalPlayingPlayers       = playingPlayers;
  var foldedPlayers             = _.where(params.table.players, {state: stateOfX.playerState.playing, lastMove: stateOfX.move.fold});
  var disconnectedPlayers       = _.where(params.table.players, {state: stateOfX.playerState.disconnected});
  var disconnectedActivePlayers = [];
  // Disconnectd but active players: (state: Disconnected && lastMove !== FOLD && playerId is in onstartGamePlayers)
  for (var i = 0; i < disconnectedPlayers.length; i++) {
    // if(disconnectedPlayers[i].lastMove !== stateOfX.move.fold) {
    if(disconnectedPlayers[i].lastMove !== stateOfX.move.fold && disconnectedPlayers[i].lastMove !== stateOfX.move.allin) {
      if(params.table.onStartPlayers.indexOf(disconnectedPlayers[i].playerId) >= 0) {
        disconnectedActivePlayers.push(disconnectedPlayers[i]);
      }
    }
  }
  var totalActivePlayers        = _.where(totalPlayingPlayers, {active: true}).concat(disconnectedActivePlayers);
  serverLog(stateOfX.serverLogType.info, 'Total active players - ' + JSON.stringify(totalActivePlayers));
  totalPlayingPlayers = totalPlayingPlayers.concat(disconnectedActivePlayers);
  serverLog(stateOfX.serverLogType.info, 'Updated active players after adding disconnected active players - ' + JSON.stringify(totalActivePlayers));
  serverLog(stateOfX.serverLogType.info, 'Total Disconnected but active players - ' + JSON.stringify(disconnectedActivePlayers));
  serverLog(stateOfX.serverLogType.info, 'Total Playing players - ' + JSON.stringify(playingPlayers));
  serverLog(stateOfX.serverLogType.info, 'Active Playing players - ' + JSON.stringify(totalPlayingPlayers));
  serverLog(stateOfX.serverLogType.info, 'Total Disconnected players - ' + JSON.stringify(disconnectedPlayers));


  if(totalPlayingPlayers.length <= 1 || totalActivePlayers.length === 0) { // In case of leave/standup player Game Over
    serverLog(stateOfX.serverLogType.info, 'There is no active player left in the Game - GAME OVER!');
    return false;
  }

  // Only one active player and all other folded
  if(totalPlayingPlayers.length - foldedPlayers.length === 1) {
    serverLog(stateOfX.serverLogType.info, 'Total players - folded players equals 1');
    return false;
  }

  if(totalActivePlayers.length === 1) {
    serverLog(stateOfX.serverLogType.info, 'There is only one active player in the game, check if move left !');
    var indexOfActivePlayer = _ld.findIndex(params.table.players, {playerId: totalActivePlayers[0].playerId});
    serverLog(stateOfX.serverLogType.info, 'Index of this active player on table - ' + indexOfActivePlayer);
    serverLog(stateOfX.serverLogType.info, 'Roundbets', params.table.roundBets);
    serverLog(stateOfX.serverLogType.info, 'Last active player placed - ' + params.table.roundBets[indexOfActivePlayer]);
    serverLog(stateOfX.serverLogType.info, 'Round max bet - ' + params.table.roundMaxBet);
    serverLog(stateOfX.serverLogType.info, 'Player chips - ' + params.table.players[indexOfActivePlayer].chips);
    return (fixedDecimal(params.table.roundBets[indexOfActivePlayer], 2) != fixedDecimal(params.table.roundMaxBet, 2) && fixedDecimal(params.table.players[indexOfActivePlayer].chips, 2) > 0);
  } else {
    serverLog(stateOfX.serverLogType.info, 'There are more than 2 active and playing players, no game over!');
    return true;
  }
};

// ### Deduct chips from player profile (in add chips request)
var deductChips = function(params, player, cb, doNotDeduct) {
  var playerChipDetails = {};
  // Deduct amount from profile and then add chips on table amount
  console.trace("player--"+ JSON.stringify(player));
  var fn;
  if (doNotDeduct) {
    fn = profileMgmt.getUserChips;
  } else {
    fn = profileMgmt.deductChips;
  }

  fn({playerId: player.playerId,isRealMoney: params.table.isRealMoney, chips: params.data.amount, channelId: params.channelId, subCategory: "Add Chips", tableName: params.table.channelName},function(deductChipsResponse){
    console.trace("!!!!!!!!!!@@@@@@@@@@@ deduct chips response"+JSON.stringify(deductChipsResponse));
    if(deductChipsResponse.success){

      playerChipDetails.chipsInHand = player.chips;
      playerChipDetails.isChipsToUpdate = false;
      // Set player state waiting if in reserved after successfull addition of chips
      if(player.state === stateOfX.playerState.reserved) {
        console.log("reserver");
        player.state                     = stateOfX.playerState.waiting;
        player.chips                     = fixedDecimal(player.chips, 2) + fixedDecimal(params.data.amount, 2);
        player.instantBonusAmount        = fixedDecimal(player.instantBonusAmount, 2) + fixedDecimal(deductChipsResponse.instantBonusAmount, 2);
        player.activityRecord.sitTableAt = new Date();
        playerChipDetails.newChips = params.data.amount;
      } else if(player.state === stateOfX.playerState.playing) {
        if (doNotDeduct) {
          console.log("playing doNotDeduct");
          player.chipsToBeAdded = player.chipsToBeAdded + fixedDecimal(params.data.amount, 2);
          playerChipDetails.isChipsToUpdate = true;
          playerChipDetails.newChipsToAdd = fixedDecimal(params.data.amount, 2);
        } else {
          console.log("playing else");
          player.chips = fixedDecimal(player.chips, 2) + fixedDecimal(params.data.amount, 2);
          player.instantBonusAmount        = fixedDecimal(player.instantBonusAmount, 2) + fixedDecimal(deductChipsResponse.instantBonusAmount, 2);
          playerChipDetails.newChips = fixedDecimal(params.data.amount, 2);
        }
      } else {
          console.log("overall else");
        player.chips = fixedDecimal(player.chips, 2) + fixedDecimal(params.data.amount, 2);
        player.instantBonusAmount        = fixedDecimal(player.instantBonusAmount, 2) + fixedDecimal(deductChipsResponse.instantBonusAmount, 2);
        playerChipDetails.newChips = fixedDecimal(params.data.amount, 2);
      }

      params.data.success    = true;
      // player.chips        = parseInt(player.chips) + parseInt(params.data.amount); // Commented to modify add chips to be reflected after Game Over
      player.onSitBuyIn      = fixedDecimal((player.chips + player.chipsToBeAdded), 2);
      params.data.amount     = fixedDecimal(player.chips, 2);
      params.data.chipsAdded = fixedDecimal(player.chipsToBeAdded, 2);
      params.data.state      = player.state;
      params.data.playerName = player.playerName;
      params.data.realChips  = fixedDecimal(deductChipsResponse.realChips, 2);
      params.data.freeChips  = deductChipsResponse.freeChips;

      serverLog(stateOfX.serverLogType.info, "updated player details after addchips: " + JSON.stringify(player));
      activity.addChipsOnTable(params,stateOfX.profile.category.game,stateOfX.game.subCategory.addChips,stateOfX.logType.success,playerChipDetails);
      cb({success: true, data: params.data, table: params.table});
    } else{
      deductChipsResponse.state = player.state;
      cb(deductChipsResponse);
    }
  });
};

// add chips in game
// WHEN PLAYER IS PART OF GAME
tableManager.addChipsOnTableInGame = function (params, player, cb) {
  serverLog(stateOfX.serverLogType.info, "in function addChipsOnTableInGame");

  var totalChipsAfterAdd    = fixedDecimal(player.chips, 2) + fixedDecimal(params.data.amount, 2) + fixedDecimal(player.chipsToBeAdded, 2);
  params.data.previousState = player.state;

  serverLog(stateOfX.serverLogType.info, 'Player details for whome add chips requested - ' + JSON.stringify(player));
  serverLog(stateOfX.serverLogType.info, 'Player chips on table - ' + player.chips);
  serverLog(stateOfX.serverLogType.info, 'Amount to be added - ' + params.data.amount);
  serverLog(stateOfX.serverLogType.info, 'Total chips after add - ' + totalChipsAfterAdd);
  serverLog(stateOfX.serverLogType.info, 'Table Min Buyin - ' + params.table.minBuyIn);
  serverLog(stateOfX.serverLogType.info, 'Table Max Buyin - ' + params.table.maxBuyIn);
//console.error();
  // Validate adding chips exceed table maxbuy in, which is not allowed
  if(totalChipsAfterAdd > fixedDecimal(params.table.maxBuyIn, 2) && player.state !== stateOfX.playerState.reserved) {
    var t = (parseInt(params.table.maxBuyIn)-(totalChipsAfterAdd-fixedDecimal(params.data.amount, 2)));
      cb({success: false, channelId: params.channelId,isRetry: false, isDisplay: true, info: (t>0?("You can now add "+fixedDecimal(t, 2)+" more chips."):("You cannot add more chips."))+" Max buyin for table is "+parseInt(params.table.maxBuyIn)+"."});
      // cb({success: false, channelId: params.channelId,isRetry: false, isDisplay: true, info: popupTextManager.falseMessages.ADDCHIPSONTABLE_TOTALEXCEEDTABLEMAXBUY_TABLEMANAGER + parseInt(params.table.maxBuyIn)})
   // cb({success: false, channelId: params.channelId, info: "Adding chips cannot exceed table maxbuyin ie. " + parseInt(params.table.maxBuyIn)})
    return false;
  }

  if (totalChipsAfterAdd < parseInt(params.table.minBuyIn)) {
    cb({success: false, channelId: params.channelId, isRetry: false, isDisplay: true, info: "You cannot add "+fixedDecimal(params.data.amount, 2)+ " chips. Min Buyin for table is "+parseInt(params.table.minBuyIn)+"."});
    return;
  }

  // If player seat is reserved then check anti banking
  // If player is not in RESERVED then do not check anti banking

  deductChips(params, player, function(deductChipsResponse){
    cb(deductChipsResponse);
  }, true);
};

// ### Add additional amount on players in game chips, on player request
// > Validate if player is on the table
// > Sitout, Bakrupt and Playing player with FOLD can add chips
// > Validate if player is trying to add chips, but not more than max buyin allowed
tableManager.addChipsOnTable = function (params, cb) {
  params.data.channelId = params.table.channelId;

  // Check if request is for TOURNAMENT only
  if(params.table.channelType === stateOfX.gameType.tournament) {
    cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.ADDCHIPSONTABLEFAIL_TABLEMANAGER});
    //cb({success: false, channelId: params.channelId, info: "Cannot add chips in tournament table."});
    return false;
  }

  // Check if adding amount is valid
  if(fixedDecimal(params.data.amount, 2) <= 0) {
    cb({success: false, isRetry: false, isDisplay: true, channelId: params.channelId, info: "Cannot add " + params.data.amount + " chips, provide a value greater than 0."});
    return false;
  }

  var playerIndexOnTable  = _ld.findIndex(params.table.players, {playerId: params.data.playerId});

  // Vlidate if player have taken a seat
  if(playerIndexOnTable < 0) {
    cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.ADDCHIPSONTABLEINTOURNAMENT_TABLEMANAGER});
    //cb({success: false, channelId: params.channelId, info: "Invalid attempt to add chips, Please take a seat first!"})
    return false;
  }

  var player                = params.table.players[playerIndexOnTable];
  player.activityRecord.lastActivityTime = Number(new Date()); // Record last activity of player

  // if game is in running state and player is in game then do not deduct chips here 
  // just add the amount in chips to be added in next game and on gameover for next hand chips are added
  // in handleGameOver file
  if (params.table.state == stateOfX.gameState.running) {
    if (params.table.onStartPlayers.indexOf(player.playerId) >= 0 && (player.roundId == params.table.roundId)) {
      tableManager.addChipsOnTableInGame(params, player, cb);
      return;
    }
  }

  // var totalChipsAfterAdd    = player.state === stateOfX.playerState.reserved ? parseInt(player.chips) + parseInt(params.data.amount) : parseInt(player.chips) + parseInt(params.data.amount) + parseInt(player.chipsToBeAdded);
  var totalChipsAfterAdd = player.state === stateOfX.playerState.reserved ? fixedDecimal(player.chips, 2) + fixedDecimal(params.data.amount, 2) : fixedDecimal(player.chips, 2) + fixedDecimal(params.data.amount, 2) + fixedDecimal(player.chipsToBeAdded, 2);

  params.data.previousState = player.state;
  if (player.state == stateOfX.playerState.outOfMoney) {
    player.state = stateOfX.playerState.waiting;
  }

  serverLog(stateOfX.serverLogType.info, 'Player details for whome add chips requested - ' + JSON.stringify(player));
  serverLog(stateOfX.serverLogType.info, 'Player chips on table - ' + player.chips);
  serverLog(stateOfX.serverLogType.info, 'Amount to be added - ' + params.data.amount);
  serverLog(stateOfX.serverLogType.info, 'Total chips after add - ' + totalChipsAfterAdd);
  serverLog(stateOfX.serverLogType.info, 'Table Min Buyin - ' + params.table.minBuyIn);
  serverLog(stateOfX.serverLogType.info, 'Table Max Buyin - ' + params.table.maxBuyIn);
//console.error();
  // Validate adding chips exceed table maxbuy in, which is not allowed
  //commented by digvijay
  // if(totalChipsAfterAdd > parseInt(params.table.maxBuyIn) && player.state !== stateOfX.playerState.reserved) {
  //   var t = (parseInt(params.table.maxBuyIn)-(totalChipsAfterAdd-parseInt(params.data.amount)));
  //     cb({success: false, channelId: params.channelId,isRetry: false, isDisplay: true, info: (t>0?("You can now add "+t+" more chips."):("You cannot add more chips."))+" Max buyin for table is "+parseInt(params.table.maxBuyIn)+"."});
    if (totalChipsAfterAdd > fixedDecimal(params.table.maxBuyIn, 2) && player.state !== stateOfX.playerState.reserved) {
      var t = (fixedDecimal(params.table.maxBuyIn, 2) - (totalChipsAfterAdd - fixedDecimal(params.data.amount, 2)));
      cb({ success: false, channelId: params.channelId, isRetry: false, isDisplay: true, info: (t > 0 ? ("You can now add " + fixedDecimal(t, 2) + " more chips.") : ("You cannot add more chips.")) + " Max buyin for table is " + fixedDecimal(params.table.maxBuyIn, 2) + "." });
      // cb({success: false, channelId: params.channelId,isRetry: false, isDisplay: true, info: popupTextManager.falseMessages.ADDCHIPSONTABLE_TOTALEXCEEDTABLEMAXBUY_TABLEMANAGER + parseInt(params.table.maxBuyIn)})
   // cb({success: false, channelId: params.channelId, info: "Adding chips cannot exceed table maxbuyin ie. " + parseInt(params.table.maxBuyIn)})
    return false;
  }

  if (totalChipsAfterAdd < parseInt(params.table.minBuyIn)) {
    // cb({success: false, channelId: params.channelId, isRetry: false, isDisplay: true, info: "You cannot add "+parseInt(params.data.amount)+ " chips. Min Buyin for table is "+parseInt(params.table.minBuyIn)+"."});
    cb({success: false, channelId: params.channelId, isRetry: false, isDisplay: true, info: "You cannot add "+fixedDecimal(params.data.amount, 2)+ " chips. Min Buyin for table is "+fixedDecimal(params.table.minBuyIn, 2)+"."});
    return;
  }

  // // Playing and folded player can add chips from 1 to maxbuyin
  // if(player.state === stateOfX.playerState.playing && player.lastMove !== stateOfX.move.fold) {
  //     cb({success: false, channelId: params.channelId, isRetry: false, isDisplay: true,info: popupTextManager.falseMessages.ADDCHIPSONTABLE_FOLDEDPLAYERFAIL_TABLEMANAGER})
  //   //cb({success: false, channelId: params.channelId, info: "You are not able to rebuy chips while still involved in a hand."});
  //   return false;
  // }

  // // Reserved/Waiting/OutOfMoney/Sitout player can only add from minbuyin to maxbuyin
  // if((player.state === stateOfX.playerState.reserved || player.state === stateOfX.playerState.outOfMoney || player.state === stateOfX.playerState.waiting || player.state === stateOfX.playerState.onBreak) && (totalChipsAfterAdd < parseInt(params.table.minBuyIn)) || (totalChipsAfterAdd > parseInt(params.table.maxBuyIn))) {
  //   cb({success: false, channelId: params.channelId, info: "Adding chips must between range:  [" + params.table.minBuyIn + " - " + params.table.maxBuyIn + "].", isRetry: false, isDisplay: false})
  //   return false;
  // }


  // If player seat is reserved then check anti banking
  // If player is not in RESERVED then do not check anti banking

  if(player.state === stateOfX.playerState.reserved) {
    serverLog(stateOfX.serverLogType.info, 'Going to check antibanking as RESERVE state player tried to add chips!');
    db.getAntiBanking({playerId: player.playerId, channelId: params.channelId}, function(err, res){
      serverLog(stateOfX.serverLogType.info, 'Anti banking details for this player: ' + JSON.stringify(res));
      if(!err) {
        if(!res || fixedDecimal(params.data.amount) >= parseInt(res.amount)) {
          deductChips(params, player, function(deductChipsResponse){
            cb(deductChipsResponse);
          });
        } else {
          cb({success: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.ANTIBANKINGPREVENT + parseInt(res.amount), isRetry : false, isDisplay : true});  
        }
      } else {
        serverLog(stateOfX.serverLogType.error, 'Unable to get anti banking details from database.');
        cb({success: false, channelId: (params.channelId || ""), info: popupTextManager.dbQyeryInfo.DB_GETANTIBANKING_FAIL, isRetry : false, isDisplay : false});
      }
    });

  } else {
    deductChips(params, player, function(deductChipsResponse){
      cb(deductChipsResponse);
    });
  }
};

// add chips on table directly in tournaments
tableManager.addChipsOnTableInTournament = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'addChipsOnTableInTournament params are -  ' + JSON.stringify(params));
  var playerIndexOnTable  = _ld.findIndex(params.table.players, {playerId: params.data.playerId});
  params.data.channelId = params.table.channelId;
  if(playerIndexOnTable >= 0) {
    var player = params.table.players[playerIndexOnTable];
    profileMgmt.deductChips({playerId: player.playerId,isRealMoney: params.table.isRealMoney, chips: params.data.amount, channelId: params.channelId},function(deductChipsResponse){
      if(deductChipsResponse.success){
        params.data.success              = true;
        player.chips                     = parseInt(player.chips);
        player.tournamentData.rebuyChips = player.tournamentData.rebuyChips + parseInt(params.data.chips);
        player.onSitBuyIn                = player.chips;
        params.data.amount               = player.chips;
        params.data.state                = player.state;
        params.data.playerName           = player.playerName;

        cb({success: true, data: params.data, table: params.table});
      } else{
        deductChipsResponse.state = player.state;
        cb(deductChipsResponse);
      }
    });
  } else {
    cb({success: false, channelId: params.channelId, info: "Invalid attempt to add chips, Please take a seat first!", isRetry: false, isDisplay: false});
  }
};

// update isAutoRebuyEnabled in inMemoryTable
tableManager.updateAutoRebuy = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'updateAutoRebuy params are -  ' + JSON.stringify(params));
  var playerIndexOnTable  = _ld.findIndex(params.table.players, {playerId: params.data.playerId});
  serverLog(stateOfX.serverLogType.info, 'index of player is -  ' + JSON.stringify(playerIndexOnTable));
  if(playerIndexOnTable >= 0) {
    serverLog(stateOfX.serverLogType.info, 'before update player is -  -  ' + JSON.stringify(params.table.players[playerIndexOnTable]));
    params.table.players[playerIndexOnTable].isAutoReBuyEnabled = params.data.isAutoRebuyEnabled;
    serverLog(stateOfX.serverLogType.info, 'after update player is -  -  ' + JSON.stringify(params.table.players[playerIndexOnTable]));
    cb({success: true, data: params.data, table: params.table});
  } else {
    cb({success: false, channelId: params.channelId, info: "Invalid attempt to add chips, Please take a seat first!", isRetry: false, isDisplay: false});
  }
};

//tournament
tableManager.updateAutoAddon = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'updateAutoAddon params are -  ' + JSON.stringify(params));
  var playerIndexOnTable  = _ld.findIndex(params.table.players, {playerId: params.data.playerId});
  serverLog(stateOfX.serverLogType.info, 'index of player is -  ' + JSON.stringify(playerIndexOnTable));
  if(playerIndexOnTable >= 0) {
    serverLog(stateOfX.serverLogType.info, 'before update player in updateAutoAddon is -  -  ' + JSON.stringify(params.table.players[playerIndexOnTable]));
    params.table.players[playerIndexOnTable].isAutoAddOnEnabled = params.data.isAutoAddOnEnabled;
    serverLog(stateOfX.serverLogType.info, 'after update player in updateAutoAddon is -  -  ' + JSON.stringify(params.table.players[playerIndexOnTable]));
    cb({success: true, data: params.data, table: params.table});
  } else {
    cb({success: false, channelId: params.channelId, info: "Invalid attempt !", isRetry: false, isDisplay: false});
  }
};


// Validate if ru it twice enable due to
// > No further betting allowed, all or except last player ALLIN
// > Active players have run-it-twice enabled
tableManager.isRunItTwice = function (params, contributors, cb) {
  // Do not check run it twice in case of tournament table
  if(params.table.channelType === stateOfX.gameType.tournament){
    serverLog(stateOfX.serverLogType.info, 'Not checking run it twice as table is for tournament: ' + params.table.channelType);
    return cb(false);
  }
//  console.error("!@@@@#####$$$$$$$",JSON.stringify(params.table));

  if(params.table.boardCard[0].length == 5){
    console.error(stateOfX.serverLogType.info, 'Not checking run it twice as all the board Cards have opened in river Round table: ' + params.table.channelType);
    return cb(false);
  }
  serverLog(stateOfX.serverLogType.info, 'About to decide run it twice for contributors: - ' + JSON.stringify(contributors));

  var playerIndexOnTable = -1;
  var contributorIndex   = -1;
  var playerToDecideRIT  = [];
  var tempPlayers = JSON.parse(JSON.stringify(contributors));
  // Start checking run it twice condition for each player
  async.eachSeries(tempPlayers, function(playerId, ecb){
    serverLog(stateOfX.serverLogType.info, 'Processing player Id: ' + playerId);
    playerIndexOnTable = _ld.findIndex(params.table.players, {playerId: playerId});
    contributorIndex   = _ld.indexOf(contributors, playerId);
    if(!!playerId) {
      if(playerIndexOnTable < 0) {
        serverLog(stateOfX.serverLogType.info, 'Contributor is not present on table anymore, removing from contributor list!');
        //contributors.splice(contributorIndex, 1);
        serverLog(stateOfX.serverLogType.info, 'Updated contributor: ' + JSON.stringify(contributors));
      } else {
        playerToDecideRIT.push(params.table.players[playerIndexOnTable]);
      }
    } else {
      serverLog(stateOfX.serverLogType.info, 'Player Id not found while iterating for RIT check!');
    }
    ecb();
  }, function(err){
    if(!err) {
      serverLog(stateOfX.serverLogType.info, 'Players for which RIT will be checked: ' + JSON.stringify(playerToDecideRIT));
      serverLog(stateOfX.serverLogType.info, 'Players for params.table.onStartPlayers: ' + JSON.stringify(params.table.onStartPlayers));
      var playingPlayers = [];
      for (var i = 0; i < playerToDecideRIT.length; i++) {
        if (params.table.onStartPlayers.indexOf(playerToDecideRIT[i].playerId)>=0) {
          playingPlayers.push(playerToDecideRIT[i]);
        }
      }
      // var playingPlayers = _.where(playerToDecideRIT, {state: stateOfX.playerState.playing});
      var onBreakPlayers = _.where(playerToDecideRIT, {state: stateOfX.playerState.onBreak});
      var foldedPlayers  = _.where(playerToDecideRIT, {state: stateOfX.playerState.playing, lastMove: stateOfX.move.fold});
      var allInPlayers   = _.where(playerToDecideRIT, {state: stateOfX.playerState.playing, lastMove: stateOfX.move.allin});
      var activePlayers  = _.difference(playingPlayers, foldedPlayers);

      serverLog(stateOfX.serverLogType.info, 'Active players after refining foldedPlayers - ' + JSON.stringify(activePlayers));

      activePlayers         = _.difference(activePlayers, onBreakPlayers);

      serverLog(stateOfX.serverLogType.info, 'Final Active players after refining onBreakPlayers - ' + JSON.stringify(activePlayers));

      var runItTwiceEnabled = _.where(activePlayers, {isRunItTwice: true});

      serverLog(stateOfX.serverLogType.info, 'Run it twice enabled by players: ' + JSON.stringify(runItTwiceEnabled));

      if(activePlayers.length > 1 && allInPlayers.length > 0 && allInPlayers.length + 1 >= activePlayers.length)  { // No further bet allowed
        serverLog(stateOfX.serverLogType.info, 'No furhter bet allowed condition fulfil!');
        if(runItTwiceEnabled.length >= activePlayers.length) { // Active players enables run-it-twice
          serverLog(stateOfX.serverLogType.info, 'Run it twice applicable for this game.');
          params.table.isRunItTwiceApplied = true;
          cb(true); // No further bet allowed
        } else {
          cb(false);
        }
      } else {
        cb(false);
      }
    } else {
      serverLog(stateOfX.serverLogType.error, "Run it twice check failed for contributors " + JSON.stringify(err));
      cb({success: false, channelId: params.channelId, info: "Run it twice check failed for contributors " + JSON.stringify(err),isRetry: false, isDisplay: false});
    }
  });
};

// Call amount for current player
tableManager.callAmount = function(table) {
  serverLog(stateOfX.serverLogType.info, 'In deciding call amount roundMaxBet - ' + table.roundMaxBet);
  serverLog(stateOfX.serverLogType.info, 'In deciding call amount Player bet placed - ' + table.roundBets[table.currentMoveIndex]);
  return (fixedDecimal(table.roundMaxBet, 2) - fixedDecimal(table.roundBets[table.currentMoveIndex], 2));
};

// Get sum of total amount
tableManager.getTotalPot = function(pot) {
  var totalPot = 0;
  for (var i = 0; i < pot.length; i++) {
    totalPot = fixedDecimal(totalPot, 2) + fixedDecimal(pot[i].amount, 2);
  }
  return totalPot;
};

// Get sum of total pots but excluding refund pot(s)
tableManager.getTotalCompetitionPot = function (pot) {
  var totalPot = 0;
  for (var i = 0; i < pot.length; i++) {
    if(typeof pot[i].isRefund == 'boolean'){
      totalPot += pot[i].isRefund ? 0 : fixedDecimal(pot[i].amount, 2);
    } else {
      totalPot += (pot[i].contributors.length > 1) ? fixedDecimal(pot[i].amount, 2) : 0;
    }
  }
  return totalPot;
};

// Get sum of total dead bets
tableManager.getTotalBet = function(bets) {
  var totalBets = 0;
  for (var i = 0; i < bets.length; i++) {
    totalBets = fixedDecimal(totalBets, 2) + fixedDecimal(bets[i], 2);
  }
  return totalBets;
};

// get total contribution
tableManager.getTotalGameContribution = function (table) {
  var sum = 0;
  for (var i = 0; i < table.contributors.length; i++) {
    sum += table.contributors[i].amount;
  }
  return sum;
};

// Get max raise amount for player with move
tableManager.maxRaise = function (table) {
  var expectedMaxRaise = 0;
  serverLog(stateOfX.serverLogType.info, 'moveRemote Updating max raise value from - ' + table.maxRaiseAmount);
  serverLog(stateOfX.serverLogType.info, 'Table while setting max raise - ' + JSON.stringify(table));
  serverLog(stateOfX.serverLogType.info, 'Current move index at this point - ' + table.currentMoveIndex);
  serverLog(stateOfX.serverLogType.info, '1 Getting max bet  for potlimit - ' + table.isPotLimit);
  if(!table.isPotLimit && table.channelVariation != stateOfX.channelVariation.omaha) {
    serverLog(stateOfX.serverLogType.info, 'This is not a pot limit table, max raise to player chips - ' + table.players[table.currentMoveIndex].chips);
    // return table.players[table.currentMoveIndex].chips; // Return max raise equal to player chips amount (ALLIN)
    return (fixedDecimal(table.players[table.currentMoveIndex].chips, 2) + fixedDecimal((table.players[table.currentMoveIndex].totalRoundBet||0), 2)); // Return max raise equal to player chips amount (ALLIN)
  }

  serverLog(stateOfX.serverLogType.info, '2 Getting max bet  for potlimit - ' + table.isPotLimit);

  // maximum raise is the amount of the pot. To do this, add up the pot + the bet + your call ($15 + $10 + $10 = $35).
  // You are allowed to bet that total amount in addition to your call, meaning your total bet is $45
  // ($10 for the call + $35 for the size of the pot).
  if(_.where(table.players, {isPlayed: true}).length >= 0 || table.roundName === stateOfX.round.preflop) {
    serverLog(stateOfX.serverLogType.info, 'Player have acted in this round, calculate max raise!');
    serverLog(stateOfX.serverLogType.info, 'Updating max raise, pot amount  - ' + tableManager.getTotalPot(table.pot));
    serverLog(stateOfX.serverLogType.info, 'Updating max raise, previous bets - ' + tableManager.getTotalBet(table.roundBets));
    serverLog(stateOfX.serverLogType.info, 'Updating max raise, call amount for next player - ' + tableManager.callAmount(table));
    serverLog(stateOfX.serverLogType.info, 'Raise difference on table at this time: ' + table.raiseDifference);
    serverLog(stateOfX.serverLogType.info, 'Raise to consider for setting max on table at this time: ' + table.considerRaiseToMax);
    
    if(table.players[table.currentMoveIndex].seatIndex === table.smallBlindSeatIndex) {
      serverLog(stateOfX.serverLogType.info, "Getting max raise for small blind player.");
      // var expectedMaxRaise = tableManager.getTotalPot(table.pot) + tableManager.getTotalBet(table.roundBets) + parseInt(tableManager.callAmount(table)*3)
      // var expectedMaxRaise = tableManager.getTotalPot(table.pot) + tableManager.getTotalBet(table.roundBets) + table.considerRaiseToMax + tableManager.callAmount(table);
      expectedMaxRaise = 2 * fixedDecimal(table.roundMaxBet, 2) + tableManager.getTotalGameContribution(table) - fixedDecimal((table.players[table.currentMoveIndex].totalRoundBet || 0), 2);
    } else {
      serverLog(stateOfX.serverLogType.info, "Getting max raise for a player who is not a small blind.");
      // var expectedMaxRaise = tableManager.getTotalPot(table.pot) + tableManager.getTotalBet(table.roundBets) + parseInt(tableManager.callAmount(table)*2);
      // var expectedMaxRaise = tableManager.getTotalPot(table.pot) + tableManager.getTotalBet(table.roundBets) + table.considerRaiseToMax + parseInt(tableManager.callAmount(table));
      expectedMaxRaise = 2*fixedDecimal(table.roundMaxBet, 2) + tableManager.getTotalGameContribution(table) - fixedDecimal((table.players[table.currentMoveIndex].totalRoundBet || 0), 2);
    }

    // ISSUE: sometimes table min raise amount becomes greater than expected maxraise amount
    // Resolve: initialize max raise with the max amount between minRaise and maxRaise
    // By: Digvijay Rathore
    var tableObject = {table: table};
    expectedMaxRaise = _.max([expectedMaxRaise, tableManager.minRaise(tableObject)]);
    serverLog(stateOfX.serverLogType.info, 'Expected max raise will be - ' + expectedMaxRaise);
    // return expectedMaxRaise <= table.players[table.currentMoveIndex].chips ? expectedMaxRaise : table.players[table.currentMoveIndex].chips;
    return expectedMaxRaise <= (table.players[table.currentMoveIndex].chips + (table.players[table.currentMoveIndex].totalRoundBet || 0)) ? fixedDecimal(expectedMaxRaise, 2) : fixedDecimal((table.players[table.currentMoveIndex].chips + (table.players[table.currentMoveIndex].totalRoundBet||0)), 2);
  } else {
    serverLog(stateOfX.serverLogType.info, 'No player acted so far, set max raise to BB');
    return table.bigBlind;
  }
};

// Check if any index on table is SB or BB blind
tableManager.isPlayerAblind = function(index, table) {
  if(index == -1) {
    return false;
  }
  var player       = table.players[index];
  var blindIndexes = [table.smallBlindSeatIndex, table.bigBlindSeatIndex];
  return blindIndexes.indexOf(player.seatIndex) >= 0 ;
};

// Get min raise amount for player with move
// Raise Difference + Player call value (do not consider values already posted by blinds on table)
tableManager.minRaise = function (params) {
  serverLog(stateOfX.serverLogType.info, 'Updating min raise value from: ' + params.table.minRaiseAmount);
  // serverLog(stateOfX.serverLogType.info, 'Current move value: ' + params.data.amount);
  serverLog(stateOfX.serverLogType.info, 'Raise difference this point: ' + params.table.raiseDifference);
  serverLog(stateOfX.serverLogType.info, 'Last bet placed on table: ' + params.table.lastRaiseAmount);
  return params.table.raiseDifference + params.table.lastRaiseAmount;
};

// check, a player has joined how many tables
var checkTableCountForPlayer = function (params, cb) {
  imdb.playerJoinedRecord({playerId: params.data.playerId}, function (err, result) {
    console.error('--------======',configConstants.tableCountAllowed[params.data.deviceType], result, params.data);
    if (result) {
      if ((result.length||0)< (configConstants.tableCountAllowed[params.data.deviceType]||2)) {
        cb({success: true, table: params.table, data: params.data});
      } else {
        for (var i = 0; i < result.length; i++) {
          if(result[i].channelId == params.table.channelId){
            return cb({success: true, table: params.table, data: params.data});
          }
        }
        return cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.CHECKTABLECOUNTFORPLAYERFAIL_TABLEMANAGER});
      }
    } else {
      cb({success: true, table: params.table, data: params.data});
    }
  });
};

// Check if player with same network IP exists in table
tableManager.isSameNetworkSit = function (params, cb) {
  // console.error("--- params.data", params.data)
  if (configConstants.allowSameNetworkPlay) {
    checkTableCountForPlayer(params, cb);
    return;
  }
  imdb.isPlayerJoined({channelId: params.table.channelId, networkIp: params.data.networkIp}, function (err, result) {
    if (!err && result >= 1) {
        imdb.playerJoinedRecord({channelId: params.table.channelId, playerId: params.data.playerId/*, networkIp: params.data.networkIp*/}, function (err, myResult) {
          // console.error("---- result, myResult", result, myResult)
          if (!err) {
            if (myResult.length>0) {
              if (params.data.networkIp == myResult[0].networkIp) {
                // cb({success: true, table: params.table, data: params.data});
                /*also*/ checkTableCountForPlayer(params, cb); // it is a bad practice, though; some how it is good too.
              } else {
                cb({success: false, isRetry: false, isDisplay: true, isInside: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.ISSAMENETWORKSITFAIL_TABLEMANAGER});
              }
            } else {
              cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.ISSAMENETWORKSITFAIL_TABLEMANAGER});
            }
          } else {
            cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.ISSAMENETWORKSITFAIL_TABLEMANAGER});
          }
        });
    } else {
      if (_ld.findIndex(params.table.queueList, {networkIp: params.data.networkIp}) < 0) {
        // cb({success: true, table: params.table, data: params.data});
        /*also*/ checkTableCountForPlayer(params, cb); // it is a bad practice, though; some how it is good too.
      } else {
        if (_ld.findIndex(params.table.queueList, {networkIp: params.data.networkIp, playerId: params.data.playerId}) < 0) {
          cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.ISSAMENETWORKSITFAIL_TABLEMANAGER});
        } else {
          // cb({success: true, table: params.table, data: params.data});
          /*also*/ checkTableCountForPlayer(params, cb); // it is a bad practice, though; some how it is good too.
        }
      }
    }
  });
  // if(_.pluck(params.table.players, 'networkIp').indexOf(params.data.networkIp) < 0) {
  //   cb({success: true, table: params.table, data: params.data});
  // } else {
  //   cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.ISSAMENETWORKSITFAIL_TABLEMANAGER});
  //   //cb({success: false, channelId: params.channelId, info: "A player with same network is already playing on this table!"});
  // }
};

// Set player value into any table
tableManager.setPlayerValueOnTable = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'params in setPlayerValueOnTable - ' + JSON.stringify(params.data));
  if(_ld.findIndex(params.table.players, {playerId: params.data.playerId}) >= 0) {
    if(_.keys(params.table.players[0]).indexOf(params.data.key) >= 0) {
      serverLog(stateOfX.serverLogType.info, 'About to set value for player: ' + JSON.stringify(params.table.players[_ld.findIndex(params.table.players, {playerId: params.data.playerId})]));
      serverLog(stateOfX.serverLogType.info, 'Previous value of ' + params.data.key + ' is ' + params.table.players[_ld.findIndex(params.table.players, {playerId: params.data.playerId})][params.data.key]);
      params.table.players[_ld.findIndex(params.table.players, {playerId: params.data.playerId})][params.data.key] = params.data.value;
      params.data.success = true;
      serverLog(stateOfX.serverLogType.info, 'Updated value of ' + params.data.key + ' is ' + params.table.players[_ld.findIndex(params.table.players, {playerId: params.data.playerId})][params.data.key]);
      // activity.runItTwice(params,stateOfX.profile.category.game,stateOfX.game.subCategory.runItTwice,stateOfX.logType.success);
      cb({success: true, data: params.data, table: params.table});
    } else {
      cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.SETPLAYERVALUEONTABLE_KEYNOTPRESENT_TABLEMANAGER});
      //cb({success: false, channelId: params.channelId, info: "This key " + params.data.key + " is not present in the players attribute!"});
    }
  } else {
    cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.SETPLAYERVALUEONTABLE_PLAYERNOTSIT_TABLEMANAGER});
    //cb({success: false, channelId: params.channelId, info: "Player is not sitting on the table!"})
  }
};

// check how many seats are between SB and BB
tableManager.indexBetweenSBandBB = function (params) {
  var totalIndexes = _.range(1, params.table.maxPlayers+1);

  serverLog(stateOfX.serverLogType.info, 'Total indexes - ' + totalIndexes);
  serverLog(stateOfX.serverLogType.info, 'SB index - ' + params.table.smallBlindSeatIndex);
  serverLog(stateOfX.serverLogType.info, 'BB index - ' + params.table.bigBlindSeatIndex);

  if(params.table.smallBlindSeatIndex === -1 || params.table.bigBlindSeatIndex === -1) {
    return [];
  }

  if(params.table.bigBlindSeatIndex > params.table.smallBlindSeatIndex) {
    serverLog(stateOfX.serverLogType.info, '1. Indexes between SB and BB - ' + _.range(params.table.smallBlindSeatIndex+1, params.table.bigBlindSeatIndex));
    return _.range(params.table.smallBlindSeatIndex+1, params.table.bigBlindSeatIndex);
  } else {
    serverLog(stateOfX.serverLogType.info, '2. Indexes between SB and BB - ' + _.difference(totalIndexes, _.range(params.table.bigBlindSeatIndex, params.table.smallBlindSeatIndex+1)));
    return _.difference(totalIndexes, _.range(params.table.bigBlindSeatIndex, params.table.smallBlindSeatIndex+1));
  }
};

// check state of player between SB and BB
tableManager.stateOfSBandBB = function (params) {
  var totalIndexes = _.range(1, params.table.maxPlayers+1);

  console.error(stateOfX.serverLogType.info, 'Total indexes - ' + totalIndexes);
  console.error(stateOfX.serverLogType.info, 'SB index - ' + params.table.smallBlindSeatIndex);
  console.error(stateOfX.serverLogType.info, 'BB index - ' + params.table.bigBlindSeatIndex);

  if(params.table.smallBlindSeatIndex === -1 || params.table.bigBlindSeatIndex === -1 ) {
    return true;
  }
  var smallBlindPlayer = _.findWhere(params.table.players,{seatIndex:params.table.smallBlindSeatIndex});
  var bigBlindPlayer = _.findWhere(params.table.players,{seatIndex:params.table.bigBlindSeatIndex});
  if(!smallBlindPlayer){
    return true;
  }
  if(!bigBlindPlayer){
    return true;
  }
  var bigBlindState = bigBlindPlayer.state ;
  var smallBlindState = smallBlindPlayer.state ;
  if( bigBlindState == stateOfX.playerState.onBreak || smallBlindState == stateOfX.playerState.onBreak){
    return true;
  }else{
    return false;
  }
};


// Generate a player object using default values plus given values
tableManager.createPlayer = function(params) {
  var player =  {
    playerId             : params.playerId,
    channelId            : params.channelId,
    playerName           : params.playerName || params.userName,
    networkIp            : params.networkIp,
    deviceType           : params.deviceType,
    active               : false,
    chips                : fixedDecimal(params.chips, 2),
    instantBonusAmount   : fixedDecimal(params.instantBonusAmount, 2) || 0,
    chipsToBeAdded       : 0,
    seatIndex            : params.seatIndex,
    imageAvtar           : params.imageAvtar,
    cards                : [],
    moves                : [],
    preCheck             : -1,
    bestHands            : "",
    state                : params.state || stateOfX.playerState.waiting,
    lastBet              : 0,
    lastMove             : null,
    totalRoundBet        : 0,
    totalGameBet         : 0,
    isMuckHand           : false,
    lastRoundPlayed      : "",
    preActiveIndex       : -1,
    nextActiveIndex      : -1,
    isDisconnected       : false,
    bigBlindMissed       : 0,
    isAutoReBuy          : false,
    // isRunItTwice         : false, //previously used before RIT
    isRunItTwice         : params.isForceRit,
    autoReBuyAmount      : 0,
    isPlayed             : false,
    sitoutNextHand       : false,
    sitoutNextBigBlind   : false,
    autoSitout           : false,
    sitoutGameMissed     : 0,
    disconnectedMissed   : 0,
    hasPlayedOnceOnTable : false,
    isForceBlindEnable   : true,
    isWaitingPlayer      : true,
    isStraddleOpted      : false,
    isJoinedOnce         : false,
    isAutoReBuyEnabled   : false,
    isAutoAddOnEnabled   : false,
    onGameStartBuyIn     : fixedDecimal(params.chips, 2),
    onSitBuyIn           : fixedDecimal(params.chips, 2) <= fixedDecimal(params.maxBuyIn, 2) ? fixedDecimal(params.chips, 2) : fixedDecimal(params.maxBuyIn, 2),
    roundId              : null,
    totalGames           : 0,
    timeBankSec          : configConstants.timebank.initialSec,
    autoFoldCount        : 0,
    activityRecord: {
      seatReservedAt     : !!params.state && params.state === stateOfX.playerState.reserved ? new Date(): null,
      lastMovePlayerAt   : null,
      disconnectedAt     : null,
      lastActivityAction : "",
      lastActivityTime   : Number(new Date())
    },
    tournamentData: {
      userName           : params.userName,
      isTournamentSitout : false,
      isTimeBankUsed     : false,
      timeBankStartedAt  : null,
      totalTimeBank      : params.timeBank,
      timeBankLeft       : params.timeBankLeft || params.timeBank
    }
  };
  return player;
};

// Get next active player seat index (Used to decide SB/BB/STraddle in sequence)
tableManager.nextActiveSeatIndex = function (params, cb) {

  serverLog(stateOfX.serverLogType.info, 'Getting next active seat index after - ' + params.seatIndex);

  var totalPlayingPlayers        = _.where(params.table.players, {state: stateOfX.playerState.playing});
  var totalSeatOccupied          = _.pluck(totalPlayingPlayers, 'seatIndex').sort((a, b) => a - b);
  serverLog(stateOfX.serverLogType.info, 'nextActiveSeatIndex Total seat occupied for consider next seatInex - ' + totalSeatOccupied);
  var indexOfSeatIndexInOccupied = totalSeatOccupied.indexOf(params.seatIndex);
  serverLog(stateOfX.serverLogType.info, 'Index of input seat index in occupied seats - ' + indexOfSeatIndexInOccupied);
  var nextActivePlayerSeatIndex  = totalSeatOccupied[tableManager.getNextSuitableIndex(indexOfSeatIndexInOccupied, totalSeatOccupied.length)];
  serverLog(stateOfX.serverLogType.info, 'Next active seat index will be - ' + nextActivePlayerSeatIndex);
  var seatIndexFound             = false;

  if(indexOfSeatIndexInOccupied >= 0) {
    if(nextActivePlayerSeatIndex >= 0) {
      cb({success: true, seatIndex: nextActivePlayerSeatIndex});
    } else {
      cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.NEXTACTIVESEATINDEXFAIL_TABLEMANAGER});
      //cb({success: false, channelId: params.channelId, info: "Get next active seat index failed!"})
    }
  } else {
    // Get dealer from higher values of seats than current dealer seat index
    for (var i = 0; i < totalSeatOccupied.length; i++) {
      if(!seatIndexFound && totalSeatOccupied[i] > params.seatIndex) {
        serverLog(stateOfX.serverLogType.info, 'Next active seatIndex found at higher index - ' + totalSeatOccupied[i]);
        seatIndexFound = true;
        params.data.currentDealerSeatIndex = totalSeatOccupied[i];
        cb({success: true, seatIndex: totalSeatOccupied[i]});
        return;
      }
    }

    // Get dealer from intial values of seats from beginning to dealer
    if(!seatIndexFound) {
      serverLog(stateOfX.serverLogType.info, 'Next active seatIndex not found at higher index, start from lower - ' + totalSeatOccupied);
      for (var i = 0; i < totalSeatOccupied.length; i++) {
        if(!seatIndexFound && totalSeatOccupied[i] < params.seatIndex) {
          serverLog(stateOfX.serverLogType.info, 'Next active seatIndex found from initial index - ' + totalSeatOccupied[i]);
          seatIndexFound = true;
          params.data.currentDealerSeatIndex = totalSeatOccupied[i];
          cb({success: true, seatIndex: totalSeatOccupied[i]});
          return;
        }
      }
    }
  }
};

// Get next consider player seat index (Used to decide SB/BB/STraddle in sequence)
tableManager.nextConsiderSeatIndex = function (params, cb) {
  var totalPlayingPlayers = _.where(params.table.players, {state: stateOfX.playerState.playing});
  var totalWaitingPlayers = _.where(params.table.players, {state: stateOfX.playerState.waiting});
  var totalSeatOccupied = _.pluck(totalPlayingPlayers.concat(totalWaitingPlayers), 'seatIndex').sort((a, b) => a - b);
  serverLog(stateOfX.serverLogType.info, 'nextActiveSeatIndex Total seat occupied for consider next seatInex - ' + totalSeatOccupied);
  var indexOfSeatIndexInOccupied = totalSeatOccupied.indexOf(params.seatIndex);
  var nextActivePlayerSeatIndex = totalSeatOccupied[tableManager.getNextSuitableIndex(indexOfSeatIndexInOccupied, totalSeatOccupied.length)];

  if(nextActivePlayerSeatIndex >= 0) {
    cb({success: true, seatIndex: nextActivePlayerSeatIndex});
  } else {
    cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.NEXTCONSIDERSEATINDEXFAIL_TABLEMANAGER});
    //cb({success: false, channelId: params.channelId, info: "Get next active seat index failed!"})
  }
};

// insert record - hand history in db
tableManager.insertHandHistory = function (params, handId, eventObj, cb){
  var time = new Date().getTime();
  var players = _.pluck(params.table.players, 'playerName');
  var playerInfo = [];
  for (let i = 0; i < params.table.players.length; i++){
    playerInfo.push({ playerName: params.table.players[i].playerName, ip: params.table.players[i].networkIp});
  }
  logDB.insertHandHistory(params.channelId, handId, params.table.channelName, params.table.channelVariation, params.table.gameInfo.Stakes, players, playerInfo, params.table.roundId, params.table.roundCount, params.table.gameStartTime, time, eventObj,function(err,result){
    if(err){
      cb(err);
    } else{
      logDB.updateHandTab(result.ops[0].channelId, result.ops[0].roundId,{handHistoryId: result.ops[0]._id.toString(), videoId: params.table.videoLogId.toString(), active: true},function(err,response){
        if(err){
          cb(err);
        } else{
          params.table.handHistory = [];
          params.table.videoLogId  = null;
          cb(null,response);
        }
      });
    }
  });
};

// Not used anywhere
tableManager.nextExpectedBBseatIndex = function(params, cb){
  serverLog(stateOfX.serverLogType.info, 'Players while getting next expected BB - ' + JSON.stringify(params.table.players));
  serverLog(stateOfX.serverLogType.info, 'Pre decided SB for this game - ' + params.table.nextSmallBlindSeatIndex);
  var expectedSBIndex = params.table.nextSmallBlindSeatIndex;
  serverLog(stateOfX.serverLogType.info, 'Expected seat index of SB - ' + expectedSBIndex);
  var expectedBBIndex = -1;
  var thisSmallBlindIndex = _ld.findIndex(params.table.players, {seatIndex: expectedSBIndex});
  serverLog(stateOfX.serverLogType.info, 'Expected index of SB in players - ' + thisSmallBlindIndex);

  params.seatIndex = expectedSBIndex;
  tableManager.nextConsiderSeatIndex(params, function(nextConsiderSeatIndexResponse){
    if(nextConsiderSeatIndexResponse.success) {
      serverLog(stateOfX.serverLogType.info, 'nextConsiderSeatIndexResponse - ' + JSON.stringify(nextConsiderSeatIndexResponse));
      // expectedBBIndex = params.table.players[thisSmallBlindIndex].nextActiveIndex;
      // serverLog(stateOfX.serverLogType.info, 'Expected index of BB in players - ' + expectedBBIndex);
      cb({success: true, bigBlindSeatIndex: nextConsiderSeatIndexResponse.seatIndex});
    } else {
      cb(nextConsiderSeatIndexResponse);
    }
  });
};

// Remove player from waiting QUEUE list from table
tableManager.removeWaitingPlayer = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'About to remove waiting player from players. - ' + JSON.stringify(params.table.queueList));
  if(params.data.playerId) {
    serverLog(stateOfX.serverLogType.info, 'Player id passed -  ' + params.data.playerId + ' .');
    if(_ld.findIndex(params.table.queueList, {playerId: params.data.playerId}) >= 0) {
      serverLog(stateOfX.serverLogType.info, 'Player found in waiting player list.');
      params.data.success = true;
      params.data.info = params.data.playerName + ", you have been removed from waiting list successfully!";
      if(_ld.findIndex(params.table.players, {playerId: params.data.playerId}) < 0) {
        serverLog(stateOfX.serverLogType.info, 'Removing from waiting player list.');
        params.table.queueList.splice(_ld.findIndex(params.table.queueList, {playerId: params.data.playerId}), 1);
        cb({success: true, data: params.data, table: params.table});
      } else {
        serverLog(stateOfX.serverLogType.info, 'Removing from table players player list.');
        params.table.queueList.splice(_ld.findIndex(params.table.queueList, {playerId: params.data.playerId}), 1);
        cb({success: true, channelId: params.channelId, table: params.table, info: "Player is already playing the game, removed form waiting list.", isRetry: false, isDisplay: false});
      }
      serverLog(stateOfX.serverLogType.info, 'Updated waiting players. - ' + JSON.stringify(params.table.queueList));
    } else {
      params.data.success = false;
      cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.REMOVEWAITINGPLAYERINDEX_NOTINWAITINGLIST_TABLEMANAGER});
      //cb({success: false, channelId: params.channelId, info: "You are not in waiting list anymore!"})
    }
  } else {
    params.data.success = false;
    cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.REMOVEWAITINGPLAYERFAIL_TABLEMANAGER});
    //cb({success: false, channelId: params.channelId, info: "There is an error while leaving waiting list."})
  }
};

// Get previous occupied seat index from seat index
// Request {seatIndex: , table: }
tableManager.getPreviousOccupiedSeatIndex = function(params) {
  serverLog(stateOfX.serverLogType.info, 'Getting previous seat index for seat - ' + parseInt(params.seatIndex));
  if(parseInt(params.seatIndex) < 1 || parseInt(params.seatIndex) > parseInt(params.table.maxPlayers)) {
    serverLog(stateOfX.serverLogType.info, 'Invalid seat index passed!');
    return -1;
  }

  var totalSeatOccupied = _.pluck(params.table.players, 'seatIndex').sort(function(a, b){return a-b;});
  var indexOfRequestedSeat = totalSeatOccupied.indexOf(parseInt(params.seatIndex));
  serverLog(stateOfX.serverLogType.info, 'Seat occpied - ' + JSON.stringify(totalSeatOccupied));
  if(indexOfRequestedSeat >= 0) {
    serverLog(stateOfX.serverLogType.info, 'The seat index is occupied!');
    if(indexOfRequestedSeat === 0) {
      serverLog(stateOfX.serverLogType.info, 'Seat occupied at first index, returning last seat index!');
      return totalSeatOccupied[totalSeatOccupied.length-1];
    } else {
      serverLog(stateOfX.serverLogType.info, 'Returning occupied seat -1 from array!');
      return totalSeatOccupied[indexOfRequestedSeat-1];
    }
  } else {
    return -1;
  }
};

// Get next active player By SeatIndex, eg: for setting first player move after PREFLOP round
tableManager.getNextActivePlayerBySeatIndex = function(params) {
  serverLog(stateOfX.serverLogType.info, 'Getting next active seat index for seat - ' + parseInt(params.seatIndex));
  if(parseInt(params.seatIndex) < 1 || parseInt(params.seatIndex) > parseInt(params.table.maxPlayers)) {
    serverLog(stateOfX.serverLogType.info, 'Invalid seat index passed!');
    return -1;
  }

  var totalSeatOccupied = _.pluck(_.where(params.table.players, {state: stateOfX.playerState.playing}), 'seatIndex').sort(function(a, b){return a-b;});
  var indexOfRequestedSeat = totalSeatOccupied.indexOf(parseInt(params.seatIndex));
  serverLog(stateOfX.serverLogType.info, 'Seat occpied by playing players - ' + JSON.stringify(totalSeatOccupied));

  var nextIndexWithHigherSeat = -1;

  var i = totalSeatOccupied.length;
  while (totalSeatOccupied[--i] > parseInt(params.seatIndex));
  nextIndexWithHigherSeat = ++i;

  nextIndexWithHigherSeat = !!nextIndexWithHigherSeat ? nextIndexWithHigherSeat : 0;
  nextIndexWithHigherSeat = !!nextIndexWithHigherSeat && nextIndexWithHigherSeat < totalSeatOccupied.length ? nextIndexWithHigherSeat : 0;
  return totalSeatOccupied[nextIndexWithHigherSeat];
};

// Assign players best hand only after a round end
tableManager.getBestHand = function(params, cb) {
  params.table.bestHands = [] ;// Initiate with resetting best hands for players on table
  var bestHandForPlayer = null;
  async.each(_.where(params.table.players, {state: stateOfX.playerState.playing}), function(player, ecb){
    // Do not set best hand cards for FOLD player
    if(player.lastMove === stateOfX.move.fold) {
      serverLog(stateOfX.serverLogType.info, player.playerName + ' has last move ' + player.lastMove + ', skipping best hand setting!');
      ecb();
    } else {
      // Get best hand for this player
      bestHandForPlayer =  winnerMgmt.findCardsConfiguration({boardCards: params.table.boardCard[0], playerCards: [{playerId: player.playerId, cards: player.cards}]}, params.table.channelVariation);
      serverLog(stateOfX.serverLogType.info, 'Best hand for player ' + player.playerName + ' from algo - ', JSON.stringify(bestHandForPlayer));
      var bestHandText = "";
      if(!!bestHandForPlayer && params.table.channelVariation !== stateOfX.channelVariation.omahahilo) {
        bestHandText = bestHandForPlayer[0].text;
      } else {
        if(!!bestHandForPlayer && bestHandForPlayer[0].winnerHigh.length > 0) {
          bestHandText += " " + bestHandForPlayer[0].winnerHigh[0].text;
        }
        if(!!bestHandForPlayer && bestHandForPlayer[0].winnerLo.length > 0) {
          bestHandText += "\n " + _.pluck(bestHandForPlayer[0].winnerLo[0].set, 'name');
        }
      }
      // Push players best hand on table data
      params.table.bestHands.push({
        playerId: player.playerId,
        bestHand: bestHandText
      });

      // Set besh hand in player object as well (response on join request)
      player.bestHands = bestHandText;

      serverLog(stateOfX.serverLogType.info, 'Updated best hand on table - ' + JSON.stringify(params.table.bestHands));
      ecb();
    }
  }, function(err){
    if(!err) {
      cb({success: true, params: params});
    } else {
      cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.GETBESTHANDFAIL_TABLEMANAGER});
      //cb({success: false, channelId: params.channelId, info: "Setting players best hands failed !"})
    }
  });
};

// ### Validate if the table entities set properly to start this game
tableManager.validateEntities = function(params, cb) {

  if(!configConstants.validateGameToPreventLock) {
    serverLog(stateOfX.serverLogType.info, 'Validate game entities to prevent lock table disabled from config.');
    cb(null, params);
    return true;
  }

  // Current player set
  if(params.table.currentMoveIndex === -1 && params.table.currentMoveIndex < (params.table.players.length - 1)) {
    cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.VALIDATEENTITIES_CURRENTPLAYERSETFAIL_TABLEMANAGER});
    //cb({success: false, channelId: params.channelId, info: "Current player who has the move unable to set, will lock table !"});
    return false;
  }

  // Next player to dealer set for FLOP round begin
  if(params.table.firstActiveIndex === -1 && params.table.firstActiveIndex < (params.table.players.length - 1)) {
    cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.VALIDATEENTITIES_NEXTPLAYERSETFAIL_TABLEMANAGER});
    //cb({success: false, channelId: params.channelId, info: "Player next to dealer not set, will lock table!"});
    return false;
  }

  // Big blind player set at index
  if(params.table.bigBlindIndex === -1 && params.table.bigBlindIndex < (params.table.players.length - 1)) {
    cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.VALIDATEENTITIES_BIGBLINDPLAYERSETFAIL_TABLEMANAGER});
    //cb({success: false, channelId: params.channelId, info: "Unable to set Big Blind player index, will lock table !"});
    return false;
  }

  if(params.table.players[params.table.currentMoveIndex].nextActiveIndex === -1) {
    cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.VALIDATEENTITIES_NEXTACTIVEINDEXFAIL_TABLEMANAGER});
    //cb({success: false, channelId: params.channelId, info: "Unable to set next player with move index, will lock table !"});
    return false;
  }

  cb(null, params);
};


// ### Change player state from DISCONNECTED (On join)
// Change PLAYING if player is in same game from where disconnected
// Change ONBREAK if player is not in same game from where disconnected
tableManager.changeDisconnPlayerState = function(params, cb) {
  var playerIndexOnTable    = _ld.findIndex(params.table.players, {playerId: params.data.playerId});
  params.data.previousState = null;
  params.data.currentState  = null;
  params.data.isJoinedOnce  = false;

  if(playerIndexOnTable < 0) {
    serverLog(stateOfX.serverLogType.info, 'Player hasnt on table so skipping player state update!');
    cb({success: true, data: params.data, table: params.table, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.CHANGEDISCONNPLAYERSTATE_PLAYERNOTINTABLE_TABLEMANAGER});
    //cb({success: true, data: params.data, table: params.table, channelId: params.channelId, info: "Player hasnt on table so skipping player state update!"})
    return true;
  }

  var player = params.table.players[playerIndexOnTable];

  serverLog(stateOfX.serverLogType.info, 'players deviceType was '+ player.deviceType);
  player.deviceType = params.data.deviceType;
  serverLog(stateOfX.serverLogType.info, 'players deviceType is  '+ player.deviceType);

  // Handle join and rejoin text
  serverLog(stateOfX.serverLogType.info, 'Data: ' + JSON.stringify(params.data));
  params.data.isJoinedOnce = player.isJoinedOnce;
  player.isJoinedOnce = true;
  serverLog(stateOfX.serverLogType.info, 'Data: ' + JSON.stringify(params.data));

  if(player.state !== stateOfX.playerState.disconnected) {
    serverLog(stateOfX.serverLogType.info, 'Player is not in DISCONNECTED state, so skipping player state update!');
    cb({success: true,table: params.table,data: params.data,isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.CHANGEDISSCONNPLAYERSTATE_PLAYERNOTDISCONNECTED_TABLEMANAGER});
    //cb({success: true, data: params.data, table: params.table, channelId: params.channelId, info: "Player is not in DISCONNECTED state, so skipping player state update!"})
    return true;
  }

  // Change ONBREAK if player is not in same game from where disconnected

  if(player.roundId !== params.table.roundId) {
    serverLog(stateOfX.serverLogType.info, 'Player is in DISCONNECTED state, but not in current game, setting state ONBREAK!');
    params.data.previousState = params.table.players[playerIndexOnTable].state;
    params.table.players[playerIndexOnTable].state = stateOfX.playerState.onBreak;
    params.data.currentState = params.table.players[playerIndexOnTable].state;
    params.data.success = true;
    cb({success: true, data:params.data, table: params.table, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.CHANGEDISSCONNPLAYERSTATE_PLAYERINDISCONNECTEDSTATE_TABLEMANAGER});
    //cb({success: true, data: params.data, table: params.table, channelId: params.channelId, info: "Player is in DISCONNECTED state, but not in current game, setting state ONBREAK!"})
    return true;
  }

  // Change PLAYING if player is in same game from where disconnected

  serverLog(stateOfX.serverLogType.info, 'Player is in DISCONNECTED state, and in current game, setting state PLAYING!');
  params.data.previousState = params.table.players[playerIndexOnTable].state;
  params.table.players[playerIndexOnTable].state = stateOfX.playerState.playing;
  params.data.currentState = params.table.players[playerIndexOnTable].state;
  params.data.success = true;
  cb({success: true, data: params.data, table: params.table, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.CHANGEDISSCONNPLAYERSTATE_PLAYERINDISCONNECTEDSTATE_CURRENTGAME_TABLEMANAGER});
  //cb({success: true, data: params.data, table: params.table, channelId: params.channelId, info: "Player is in DISCONNECTED state, and in current game, setting state PLAYING!"})
  return true;

};

// update player time bank details
tableManager.setTimeBankDetails = function(params, cb) {
  var playerIndexOnTable = _ld.findIndex(params.table.players, {playerId: params.data.playerId});
  if(playerIndexOnTable < 0) {
    serverLog(stateOfX.serverLogType.info, 'Player hasnt on table so skipping time bank setting!');
    cb({success: false, isRetry: false,data : params.data, table: params.table ,isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.SETTIMEBANKDETAILSFAIL_TABLEMANAGER});
    //cb({success: false, data: params.data, table: params.table, channelId: params.channelId, info: "Player hasnt on table so skipping time bank setting!"})
    return true;
  }

  var player = params.table.players[playerIndexOnTable];
  if (params.table.channelType !== stateOfX.gameType.tournament) {
    params.table.players[playerIndexOnTable].isTimeBankUsed = true;
    params.table.players[playerIndexOnTable].timeBankStartedAt = Number(new Date()); // Record time bank start value for this player
  } else {
    params.table.players[playerIndexOnTable].tournamentData.isTimeBankUsed    = true;
    params.table.players[playerIndexOnTable].tournamentData.timeBankStartedAt = Number(new Date()); // Record time bank start value for this player
  }
  params.table.timeBankStartedAt                                            = Number(new Date()); // Record time bank started on table at
  cb({success: true, data: params.data, table: params.table, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.SETTIMEBANKDETAILSTRUE_TABLEMANAGER});
  //cb({success: true, data: params.data, table: params.table, channelId: params.channelId, info: "Time bank details set successfully!"});
};

// to handle when sitting player gets disconnected
// update player state mainly
tableManager.handleDisconnection = function (params, cb) {
  var playerIndex = _ld.findIndex(params.table.players, {playerId: params.data.playerId});
  if (playerIndex < 0) {
    cb({success: false, data: params.data, table: params.table, channelId: (params.channelId || ""), info: "Player is not sitting."});
    return;
  } else {
    if(params.table.state === stateOfX.gameState.running){
    if (params.table.players[playerIndex].state === stateOfX.playerState.waiting) {
      params.table.players[playerIndex].state = stateOfX.playerState.onBreak;
    }
    if (params.table.players[playerIndex].state === stateOfX.playerState.playing) {
      params.table.players[playerIndex].state = stateOfX.playerState.disconnected;
    } 
    } else {
      params.table.players[playerIndex].state = stateOfX.playerState.onBreak;
    }
    params.data.success = true;
    params.data.state = params.table.players[playerIndex].state;
    cb({success: true, data: params.data, table: params.table, channelId: (params.channelId||"")});
  }
};

// tournament
tableManager.updateTournamentRules = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "in table manager in update tournament rules - " + JSON.stringify(params));
  for(var i=0;i<params.table.tournamentRules.ranks.length;i++) {
    if(params.data.playerId === params.table.tournamentRules.ranks[i].playerId) {
      serverLog(stateOfX.serverLogType.info, 'playerId matched in updateTournamentRules in tableManager');
      params.table.tournamentRules.ranks[i].isPrizeBroadcastSent = true;
      break;
    }
  }
  cb({success: true,data: {},table: params.table,isRetry: false, isDisplay: false, channelId: params.data.channelId || " ",info: popupTextManager.falseMessages.UPDATETOURNAMENTRULESTRUE_TABLEMANAGER});
  //cb({success: true, data: {}, table: params.table, channelId: params.data.channelId, info: "tournamentRules updated successfully!"});
};

// array1 > array2
var differenceByPlayerId = function(array1, array2) {
  var res = [];
  for(var i=0; i< array1.length; i++) {
    for(var j=0; j< array2.length; j++) {
      if(array1[i].playerId != array2[j].playerId) {
        res.push(array2[j]);
      }
    }
  }
  serverLog(stateOfX.serverLogType.info, "res is in differenceByPlayerId is  - " + JSON.stringify(res));
  return res;
};

/**
 * this function removes player from tournament
 * @method leaveTournamentPlayer
 * @param  {[type]}              params request json object
 * @param  {Function}            cb     callback function
 */
tableManager.leaveTournamentPlayer = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "in table manager in leave Tournament Player - " + JSON.stringify(params));
  var player = _.where(params.table.players, {playerId : params.data.playerId});
  serverLog(stateOfX.serverLogType.info, "player is in leave tournament players - " + JSON.stringify(player));
  if(!!player && !!player[0] && player[0].chips<=0) {
    params.table.players = differenceByPlayerId(params.table.players, [player[0]]);
    serverLog(stateOfX.serverLogType.info, "player array after difference in leave tournament players - " + JSON.stringify(params.table.players));

    // deactive players from tournament users
    var query = {
      playerId: player[0].playerId, 
      tournamentId: params.table.tournamentRules.tournamentId, 
      gameVersionCount: params.table.gameVersionCount
    };
    serverLog(stateOfX.serverLogType.info, "query is in leave Tournament Player - " + JSON.stringify(query));
    db.updateTournamentUser(query, {isActive: false}, function(err, updatedTournamentUser){
      if(!!updatedTournamentUser && !err) {
        cb({success: true, isRetry: false, data: {},table: params.table, channelId: params.data.channelId || " "});  
      } else {
        cb({success: false, isRetry: false, data: {},table: params.table, channelId: params.data.channelId || " ", info: "something went wrong try after some time"});  
      }
    });
  } else {
    cb({success: false, isRetry: false, data: {},table: params.table, channelId: params.data.channelId || " ", info: "player have enough chips to play no leave option available"});  
  }
};

// Get total active players for single winner case
tableManager.activePlayersForWinner = function(params) {
  serverLog(stateOfX.serverLogType.info, "In function activePlayersForWinner, players: " + JSON.stringify(params.table.players));
  
  // var activePlayers       = []
  // var playingPlayers      = _.where(params.table.players, {state: stateOfX.playerState.playing});
  // activePlayers = playingPlayers;
  // var disconnectedPlayers = _.where(params.table.players, {state: stateOfX.playerState.disconnected});
  // var inactiveAllInPlayer = _.where(params.table.players, {lastMove: stateOfX.move.allin, active: false});
  // var foldedPlayers       = _.where(params.table.players, {lastMove: stateOfX.move.fold});

  // // Set activePlayers so far 
  // serverLog(stateOfX.serverLogType.info, 'Playing Players: ' + JSON.stringify(_.pluck(playingPlayers, 'playerName')));
  // serverLog(stateOfX.serverLogType.info, 'Inactive but allin Players: ' + JSON.stringify(_.pluck(inactiveAllInPlayer, 'playerName')));
  // activePlayers.concat(playingPlayers, inactiveAllInPlayer);
  // serverLog(stateOfX.serverLogType.info, 'Active Players: ' + JSON.stringify(_.pluck(activePlayers, 'playerName')));
  // activePlayers = _.unique(activePlayers);

  // serverLog(stateOfX.serverLogType.info, 'Playing + ALLIN active players: ' + JSON.stringify(_.pluck(activePlayers, 'playerName')));

  // // Remove all folded players on table
  // // var allNotFoldedPlayers = playingButNotFolded.concat(disconnectedButNotFolded);
  // serverLog(stateOfX.serverLogType.info, 'All FOLDED players: ' + JSON.stringify(_.pluck(foldedPlayers, 'playerName')));

  // activePlayers = _.difference(activePlayers, foldedPlayers);
  // activePlayers = _.unique(activePlayers);

  // // activePlayers = _.difference(activePlayers, allFoldedPlayers);
  // // activePlayers = _.unique(activePlayers);

  // serverLog(stateOfX.serverLogType.info, 'After removing folded players, active players are: ' + JSON.stringify(_.pluck(activePlayers, 'playerName')));

  // // Remove all players that are not in RIVER round
  // // var length = activePlayers.length;
  // // for (var i = 0; i < length; i++) {
  // //   if(!!activePlayers[i]) {
  // //     serverLog(stateOfX.serverLogType.info, 'Processing player at for RIVER round check: ' + JSON.stringify(activePlayers[i]));
  // //     if(stateOfX.roundToValue[activePlayers[i].lastRoundPlayed] < stateOfX.roundToValue[stateOfX.round.river]) {
  // //       serverLog(stateOfX.serverLogType.info, 'Player ' + activePlayers[i].playerName + ' played till ' + activePlayers[i].lastRoundPlayed + ', removing from active player list.');
  // //       activePlayers.splice(i, 1);
  // //       serverLog(stateOfX.serverLogType.info, 'Active players after removing a player: ' + JSON.stringify(activePlayers));
  // //       i=i-1;
  // //     }
  // //   } else {
  // //     serverLog(stateOfX.serverLogType.info, 'Processing player at wrong index: ' + i);
  // //   }
  // // }
  
  // serverLog(stateOfX.serverLogType.info, 'changed by sushiljain - CAUTION');
  // serverLog(stateOfX.serverLogType.info, 'NOT Removing player not played till RIVER round, active players are: ' + JSON.stringify(_.pluck(activePlayers, 'playerName')));

  var activePlayers = [];
  serverLog(stateOfX.serverLogType.info, '=-=-=-=-=-== '+ JSON.stringify(params.table.onStartPlayers)+  params.table.players.length);
  for (var i = 0; i < params.table.players.length; i++) {
    if (params.table.onStartPlayers.indexOf(params.table.players[i].playerId)>=0) {
      activePlayers.push(params.table.players[i]);
    }
  }
  serverLog(stateOfX.serverLogType.info, 'Active Players: ' + JSON.stringify(_.pluck(activePlayers, 'playerName')));

  var foldedPlayers       = _.where(params.table.players, {lastMove: stateOfX.move.fold});
  serverLog(stateOfX.serverLogType.info, 'All FOLDED players: ' + JSON.stringify(_.pluck(foldedPlayers, 'playerName')));

  activePlayers = _.difference(activePlayers, foldedPlayers);
  activePlayers = _.unique(activePlayers);
  
  serverLog(stateOfX.serverLogType.info, 'After removing folded players, active players are: ' + JSON.stringify(_.pluck(activePlayers, 'playerName')));

  return activePlayers;

};

module.exports = tableManager;

// function to check if password needed
// and correct one is provided
function rejectIfPassword (params, cb) {
  // in such code style, these returns are MUST due to more code
  if(!params.table.isPrivate){
    return cb(false); //Do not reject, table is not protected
  }
  imdb.isPlayerJoined({channelId: params.channelId, playerId: params.data.playerId}, function (err, result) {
    if (!err && result>=1) {
      return cb(false); // Do not reject, player already inside
    } else {
      // match with input password;
      if(params.table.password === params.data.password){
        return cb(false); // Do not reject, user knows correct password
      } else {
        return cb(true); // Reject this
      }
    }
  });
}
