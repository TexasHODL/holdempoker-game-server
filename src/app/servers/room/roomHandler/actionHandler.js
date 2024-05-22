/*jshint node: true */
"use strict";

// This file is used to handle events for any action performed on table

var _                       = require("underscore"),
    broadcastHandler        = require("./broadcastHandler"),
    startGameHandler        = require("./startGameHandler"),
    actionLogger            = require("./actionLogger"),
    channelTimerHandler     = require("./channelTimerHandler"),
    waitingListHandler      = require("./waitingListHandler"),
    tournamentActionHandler = require("./tournamentActionHandler"),
    commonHandler           = require("./commonHandler"),
    imdb                    = require("../../../../shared/model/inMemoryDbQuery.js"),
    db                      = require("../../../../shared/model/dbQuery.js"),
    zmqPublish              = require("../../../../shared/infoPublisher.js"),
    stateOfX                = require("../../../../shared/stateOfX");
const configConstants = require('../../../../shared/configConstants');
var pomelo = require('pomelo');

function actionHandler() {}

// Create data for log generation
function serverLog (type, log) {
  var logObject          = {};
  logObject.fileName     = 'actionHandler';
  logObject.serverName   = stateOfX.serverType.connector;
  // logObject.functionName = arguments.callee.caller.name.toString();
  logObject.type         = type;
  logObject.log          = log;
  zmqPublish.sendLogMessage(logObject);
}

// Inputs:
// {self: , session: , channel: , channelId: , response: {
// 	isCurrentPlayer, turn, isRoundOver, round, isGameOver, over, preChecks, broadcast
// }}
// handle events after some player left
// send or schedule broadcast
// handle waiting queue
// start or kill some timers
var handleLeaveEvents = function(params) {
  broadcastHandler.fireLeaveBroadcast({channel: params.channel, serverType: pomelo.app.serverType, data: params.response.broadcast});
  // Broadcast next queued player for this channel
  if(params.response.isSeatsAvailable) {
    waitingListHandler.processNextQueuedPlayer({channelId: params.channelId,  session: params.session, channel: params.channel});
  }
  // broadcast for lobby
  broadcastHandler.fireBroadcastToAllSessions({app: pomelo.app, data: {_id: params.channelId, updated : {playingPlayers: params.response.playerLength}, event: stateOfX.recordChange.tablePlayingPlayer}, route: stateOfX.broadcasts.tableUpdate});
  broadcastHandler.fireBroadcastToAllSessions({app: pomelo.app, data: {_id: params.channelId, channelType: params.channel.channelType, playerId: params.response.broadcast.playerId, event: stateOfX.recordChange.tableViewLeftPlayer}, route: stateOfX.broadcasts.tableView});

  // Get player profile chips and broadcast to client, on leave player amount get refunded
  commonHandler.broadcastChips({serverId: params.session.frontendId, playerId: params.response.broadcast.playerId });
  // db.getCustomUser(params.response.broadcast.playerId, {freeChips: 1, realChips:1}, function(err, user) {
  //   broadcastHandler.sendMessageToUser({self: params.self, msg: {playerId: params.response.broadcast.playerId, updated: {freeChips: user.freeChips, realChips: user.realChips}}, playerId: params.response.broadcast.playerId, route: stateOfX.broadcasts.updateProfile})
  // });
  
  // Start timer for this player is standup from any case or kill existing timer on leave
  if(params.request.isStandup) {
    channelTimerHandler.kickPlayerToLobby({ session: params.session, channel: params.channel, channelId: params.channelId, playerId: params.request.playerId});
  } else {
    broadcastHandler.sendMessageToUser({ playerId: params.request.playerId, serverId: params.session.frontendId, msg: {playerId: params.request.playerId, channelId: params.channelId, event : stateOfX.recordChange.playerLeaveTable}, route: stateOfX.broadcasts.joinTableList});
    channelTimerHandler.killKickToLobbyTimer({channel: params.channel, playerId: params.request.playerId});
  }
};
actionHandler.handleLeave = handleLeaveEvents; // exporting


// handle after move or leave
// for broadcast
// and timers
actionHandler.handle = function(params) {
	// Broadcast precheck
  if(!params.response.isGameOver && params.response.preChecks.length > 0) {
    // params.response.preChecks.self      = params.self;
    params.response.preChecks.session   = params.session;
    params.response.preChecks.channel   = params.channel;
    params.response.preChecks.channelId = params.channelId;
    broadcastHandler.firePrecheckBroadcast(params.response.preChecks);
  }

  if(params.response.isCurrentPlayer) {
    // params.response.turn.self 		= params.self;
    params.response.turn.channel 	= params.channel;
    params.response.turn.session 	= params.session;

    // Send player turn broadcast to channel level
    broadcastHandler.fireOnTurnBroadcast(params.response.turn, function(fireOnTurnBroadcastResponse){
      if(fireOnTurnBroadcastResponse.success) {
        if(!params.response.isGameOver) {
          //console.error("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@");
          // channelTimerHandler.killChannelTurnTimer({channel: params.channel});
          // setTimeout(function () {
            channelTimerHandler.startTurnTimeOut(params);
          //}, 500);
        } else {
          serverLog(stateOfX.serverLogType.error, 'Not starting channel turn timer and resetting previous ones as Game is over now!');
          channelTimerHandler.killChannelTurnTimer({channel: params.channel});
        }
      } else {
        serverLog(stateOfX.serverLogType.error, 'Unable to broadcast turn, in Game start auto turn condition!');
      }
    });
  }

  // Broadcast for lobby details
  if(!!params.response.turn.playerId) {
    var broadcastData = {_id: params.channelId, playerId: params.response.turn.playerId, updated: {playerName: params.response.turn.playerName, chips: params.response.turn.chips}, channelType: params.channel.channelType, event: stateOfX.recordChange.tableViewChipsUpdate};
    if(params.channel.channelType === stateOfX.gameType.tournament) {
      broadcastData.updated.largestStack  = params.response.largestStack;
      broadcastData.updated.smallestStack = params.response.smallestStack;
    }
    broadcastHandler.fireBroadcastToAllSessions({app: pomelo.app, data: broadcastData, route: stateOfX.broadcasts.tableView});
    
    // Broadcast if blind has been updated
    if(params.channel.channelType === stateOfX.gameType.tournament && params.response.isBlindUpdated) {
      broadcastData = _.omit(broadcastData, 'playerId');
      broadcastData.event   = stateOfX.recordChange.tournamentBlindChange;
      broadcastData.updated = params.response.newBlinds;
      broadcastHandler.fireBroadcastToAllSessions({app: pomelo.app, data: broadcastData, route: stateOfX.broadcasts.tournamentLobby});
    }
  }

  // If leave broadcast is prsent then handle leave additional events
  if(!!params.response.broadcast) {
  	handleLeaveEvents(params);
  }

  // Fire round over broadcast
  if(params.response.isRoundOver) {
    if(params.response.flopPercent >= 0) {
      broadcastHandler.fireBroadcastToAllSessions({app: pomelo.app, data: {_id: params.channelId, updated: {flopPercent: params.response.flopPercent}, event: stateOfX.recordChange.tableFlopPercent}, route: stateOfX.broadcasts.tableUpdate});
    }
    if(params.response.round.roundName !== stateOfX.round.showdown) {
      actionLogger.createEventLog ({ session: params.session, channel: params.channel, data: {channelId: params.channelId, eventName: stateOfX.logEvents.roundOver, rawData: params.response.round}});
    }
    // params.response.round.self 		= params.self;
    params.response.round.channel = params.channel;
    setTimeout(function () {
      
    broadcastHandler.fireRoundOverBroadcast(params.response.round);
    }, 500);

    // Broadcast players best hand individually
    if(!params.response.isGameOver && params.response.bestHands.length > 0) {
      // params.response.bestHands.self      = params.self;
      params.response.bestHands.session   = params.session;
      params.response.bestHands.channelId = params.channelId;
      params.response.bestHands.channel   = params.channel;
      broadcastHandler.fireBestHandBroadcast(params.response.bestHands);
    }
  }

  // Fire game over broadcast
  if(params.response.isGameOver) {
    if(params.response.avgPot >= 0) {
      broadcastHandler.fireBroadcastToAllSessions({app: pomelo.app, data: {_id: params.channelId, updated: {avgPot: params.response.avgPot}, event: stateOfX.recordChange.tableAvgPot}, route: stateOfX.broadcasts.tableUpdate});
    }
    // Fire Broadcast for change ranks of user
    if(params.response.channelType === stateOfX.gameType.tournament) {
      tournamentActionHandler.handleDynamicRanks ({ session: params.session, tournamentId: params.response.tournamentRules.tournamentId, gameVersionCount: params.response.tournamentRules.gameVersionCount});
    }
    setTimeout(function(){
      actionLogger.createEventLog ({ session: params.session, channel: params.channel, data: {channelId: params.channelId, eventName: stateOfX.logEvents.summary, rawData: _.omit(params.response.over, 'self', 'session', 'channel')}});
    }, parseInt(configConstants.recordSummaryAfterGameOver) * 1000);
    
    // params.response.over.self     = params.self;
    params.response.over.channel  = params.channel;
    params.response.over.session  = params.session;
    var cardAnim = (params.response.round.boardCard[0].length + params.response.round.boardCard[1].length)*360  + 650;
    var extraDelay = params.response.round.boardCard[0].length > 0 ? 2000 : 0;
    if (params.response.round.boardCard[1].length > 0 && params.response.round.boardCard[1].length < 3) {
      cardAnim += 400;
    }
    setTimeout(function () {
      broadcastHandler.fireGameOverBroadcast(params.response.over);
    }, (cardAnim));

    megaPointsBroadcaster(params.response.megaPointsResult, params);

    var broadcastForChips = params.response.over.chipsBroadcast || [];

    for (var i = 0; i < broadcastForChips.length; i++) {
      commonHandler.broadcastChips({serverId: params.channel.getMember(broadcastForChips[i]).sid, playerId: broadcastForChips[i]});
    }

    var broadcastForAddChipsFailed = params.response.over.addChipsFailed || [];
    var msgsPlayer = {};
    for (var i = 0; i < broadcastForAddChipsFailed.length; i++) {
      msgsPlayer[broadcastForAddChipsFailed[i]] = {heading: "Add Chips Failed", info: "Unable to add chips since enough chips not available in account.", channelId: params.channelId, playerId: broadcastForAddChipsFailed[i], buttonCode: 1};
    }
    if (broadcastForAddChipsFailed.length) {
      params.channel.pushPrivateMessages('playerInfo', msgsPlayer);
    }

    // loyalityPointBroadcast(params);

    // animation depends on number of winners instead of pots
    // animation depends on intenal pot split count
    var wl = params.response.over.winners.length;
    var wr = _.where(params.response.over.winners, {isRefund: false});
    var wrl = wr.length;
    var uwrl = _.uniq(_.pluck(wr, "internalPotSplitIndex")).length;
    var dc =  ((wl==1?1:0) + 3*parseInt(uwrl+(wl>wrl?1:0)) + 1)*1000 + (cardAnim) + extraDelay;
    setTimeout(function(){
      serverLog(stateOfX.serverLogType.info, 'About to start a new game after ' + configConstants.deleayInGames + ' seconds of delay.');
      startGameHandler.startGame({ session: params.session, channelId: params.channelId, channel: params.channel, eventName: stateOfX.startGameEvent.gameOver});
    }, dc);
    // }, (2.2*parseInt(params.response.turn.pot.length))*1000 + (cardAnim));

    channelTimerHandler.tableIdleTimer({ channelId: params.channelId, channel: params.channel});
  }
};

// broadcast players their megapoints after game over
function megaPointsBroadcaster(megaPointsResult, params) {
  if(!megaPointsResult || !megaPointsResult.players){
    return;
  }
  var broadcastData = {};
  for (var i = 0; i < megaPointsResult.players.length; i++) {
    var player = megaPointsResult.players[i];
    broadcastData[player.playerId] = {
      megaPointLevel : getLevelName((player.levelChange ? player.levelChange.value : player.megaPointLevel), megaPointsResult.allLevels),
      megaPoints: (player.megaPoints + player.addMegaPoints),
      megaPointsPercent: getLevelPercent((player.megaPoints + player.addMegaPoints), megaPointsResult.allLevels)
    };
    if (player.chipsBroadcast) {
      commonHandler.broadcastChips({serverId: params.channel.getMember(player.playerId).sid, playerId: player.playerId });
    }
  }
  serverLog(stateOfX.serverLogType.info, 'broadcasting megapoints '+ JSON.stringify(broadcastData));
  broadcastHandler.pushMegaPoints({channel: params.channel, data: broadcastData});

  function getLevelName(levelId, levels) {
    var t = _.findWhere(levels, {levelId: levelId});
    return t.loyaltyLevel || 'Bronze';
  }
  function getLevelPercent(points, levels) {
    if(points <= 0 ){
      return 0;
    }
    if(levels.length<=0){
      return 0;
    }
    if (levels.length>0) {
      function calculator(arr, value) {
        for (var i = 0; i < arr.length; i++) {
          if(arr[i].levelThreshold > value){ // levelThreshold is min value of range
            break;
          }
        }
        if (i>=arr.length) {
          return 101; // any value > 100 to represent highest level
        }
        return (100*(value-arr[i-1].levelThreshold)/(arr[i].levelThreshold-arr[i-1].levelThreshold));
      }
      var c = calculator(levels, points);
      c = Math.floor(c*100)/100; // limiting decimal places
      return (c ||0);
    }
  }
}

//loyality point broadcast

// var loyalityPointBroadcast = function(params){
//   serverLog(stateOfX.serverLogType.info, "params is in loyalilty broadcast - " + JSON.stringify(params.response.loyalityList));
//   if(!!params.response.loyalityList && params.response.loyalityList.length > 0) {
//     for(var loyalityIt=0; loyalityIt<params.response.loyalityList.length; loyalityIt++) {
//       var broadcastData = {
//         self      : params.self,
//         playerId  : params.response.loyalityList[loyalityIt].playerId,
//         heading   : "Loyality Reward",
//         info      : "You won " + params.response.loyalityList[loyalityIt].loyalityPoint + " loyality points.",
//         channelId : params.channelId,
//         buttonCode: 1
//       }
//       // broadcastHandler.sendMessageToUser({self: self, msg: msg.data, playerId: msg.playerId, route: msg.route})
//       broadcastHandler.fireInfoBroadcastToPlayer(broadcastData);
//       serverLog(stateOfX.serverLogType.info, "levwl changes - " + JSON.stringify(params.response.loyalityList[loyalityIt].isLevelChanges));
//       if(params.response.loyalityList[loyalityIt].isLevelChanges){
//         broadcastHandler.sendMessageToUser({
//           self      : params.self,
//           playerId  : params.response.loyalityList[loyalityIt].playerId,
//           msg       : {
//             updated : {loyalityRakeLevel: params.response.loyalityList[loyalityIt].loyalityRakeLevel},
//             event: stateOfX.recordChange.loyalityUpdate,
//             playerId  : params.response.loyalityList[loyalityIt].playerId
//           },
//           route: stateOfX.broadcasts.updateProfile
//         });
//       }
//     }
//   } else {
//     serverLog(stateOfX.serverLogType.error, 'No loyality points to distribute.');
//   }
// }

// Handle events after join waiting list
actionHandler.handleWaitingList = function(params) {
  // Increment waiting player length on channel
  console.error("I have to be fired fro here always");
  params.channel.waitingPlayers = !!params.channel.waitingPlayers ? params.channel.waitingPlayers + 1 : 1;
  broadcastHandler.fireInfoBroadcastToPlayer({ playerId: params.request.playerId, serverId : params.session.frontendId,  heading: "Waiting List Info", info: params.response.info, buttonCode: 1, channelId: params.channelId});
  var waitingChannels =  !!params.session.get("waitingChannels") ? params.session.get("waitingChannels") : [];
  waitingChannels.push(params.channelId);
  params.session.set("waitingChannels", waitingChannels);
  params.session.push("waitingChannels", function (err){
    if(err) {
      serverLog(stateOfX.serverLogType.error, 'set new waiting channel for session service failed! error is : %j', err.stack);
    }
  });
  // Fire broadcast to update details on lobby table and inside table view
  broadcastHandler.fireBroadcastToAllSessions({app: pomelo.app, data: {_id: params.channelId, updated : {queuePlayers: params.channel.waitingPlayers}, event: stateOfX.recordChange.tableWaitingPlayer}, route: stateOfX.broadcasts.tableUpdate});
  broadcastHandler.fireBroadcastToAllSessions({app: pomelo.app, data: {_id: params.channelId, channelType: params.channel.channelType, playerId: params.request.playerId,updated: {playerName: params.request.playerName, chips: 0}, event: stateOfX.recordChange.tableViewNewWaitingPlayer}, route: stateOfX.broadcasts.tableView});
};


// update isSitHere in record user activity
// not used anymore
var updateObserverRecord = function(playerId, channelId) {
  serverLog(stateOfX.serverLogType.info,"going to update isSit in actionHandler");
  imdb.updateIsSit({playerId: playerId, channelId: channelId}, function(err, result) {
    serverLog(stateOfX.serverLogType.info,'result is in updateIsSitHere - ',result);
    if(!!result) {
      serverLog(stateOfX.serverLogType.info,'udate observer record success');
    } else {
      serverLog(stateOfX.serverLogType.info,'udate observer record fail');
    }
  });
};

// Handle events after adding chips on table
actionHandler.handleAddChipsEvent = function(params) {
//  console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!",params);
  if(params.response.success) {
    params.response.channel = params.channel;

    channelTimerHandler.killReserveSeatReferennce({playerId: params.request.playerId, channel: params.channel});
    channelTimerHandler.killKickToLobbyTimer({playerId: params.request.playerId, channel: params.channel});
    
    if(params.response.previousState === stateOfX.playerState.reserved) {
      updateObserverRecord(params.request.playerId, params.channelId);
      actionLogger.createEventLog ({ session: params.session, channel: params.channel, data: {channelId: params.channelId, eventName: stateOfX.logEvents.sit, rawData: {playerName: params.response.playerName, chips: params.response.amount}}});
      broadcastHandler.fireBroadcastToAllSessions({app: pomelo.app, data: {_id: params.channelId, channelType: params.channel.channelType, playerId: params.request.playerId,updated: {playerName: params.response.playerName, chips: params.response.amount}, event: stateOfX.recordChange.tableViewChipsUpdate}, route: stateOfX.broadcasts.tournamentLobby});
      broadcastHandler.fireBroadcastToAllSessions({app: pomelo.app, data: {_id: params.channelId, channelType: params.channel.channelType, playerId: params.request.playerId,updated: {playerName: params.response.playerName, chips: params.response.amount}, event: stateOfX.recordChange.tableViewChipsUpdate}, route: stateOfX.broadcasts.tableView});
      // Get player profile chips and broadcast to client, on add chips player amount deduct from profile
      commonHandler.broadcastChips({serverId: params.session.frontendId, playerId: params.request.playerId });
    }
      db.getCustomUser(params.request.playerId, function(err, user) {
        params.serverId = params.session.frontendId;
        //console.error("@@@@@@@@#########^^^^^^^^^^&&&&&&&&&&&", params.serverId);
        params.route = "updateProfile";
        broadcastHandler.sendMessageToUser({ msg: {playerId: params.request.playerId, updated: {freeChips: user.freeChips, realChips: user.realChips+ user.instantBonusAmount, instantBonusAmount: user.instantBonusAmount}}, playerId: params.request.playerId, serverId:params.serverId, route: stateOfX.broadcasts.updateProfile});
      });

    // Inform player about chips for next game

    if(params.response.previousState === stateOfX.playerState.playing && (params.response.chipsAdded > 0)) {
      setTimeout(function () {
        broadcastHandler.fireInfoBroadcastToPlayer({ playerId: params.request.playerId, heading: "Chips Info", info: params.response.chipsAdded + " more chips will be added in next hand.", buttonCode: 1, channelId: params.channelId});
      },100);
    }

     if(params.response.previousState === stateOfX.playerState.outOfMoney) {
      broadcastHandler.firePlayerStateBroadcast({ channel: params.channel, playerId: params.request.playerId, channelId: params.channelId, state: stateOfX.playerState.waiting});
    }
//    console.error("!!!!!@@@#########$$$$$$$$$$$ ",params.response);


    broadcastHandler.firePlayerCoinBroadcast(params.response);
    setTimeout(function(){
      startGameHandler.startGame({ session: params.session, channelId: params.channelId, channel: params.channel, eventName: stateOfX.startGameEvent.addChips});
    }, parseInt(configConstants.startGameAfterStartEvent)*1000);
    broadcastHandler.firePlayerStateBroadcast({ channel: params.channel, playerId: params.request.playerId, channelId: params.channelId, state: params.response.state});
  } else {
    serverLog(stateOfX.serverLogType.error, 'Add chips request failed for playerId - ' + params.request.playerId + ' - ' + JSON.stringify(params.response));
    if(!!params.response.state && params.response.state === stateOfX.playerState.reserved){
    pomelo.app.sysrpc['room'].msgRemote.forwardMessage(
      {forceFrontendId: pomelo.app.serverId},
      {body: { playerId: params.request.playerId, isStandup: true, channelId: params.channelId, isRequested: false, origin: 'addChipsFail'},
        route: "room.channelHandler.leaveTable"},
      params.session.export(), function () {
        setTimeout(function(){
          broadcastHandler.fireInfoBroadcastToPlayer({ playerId: params.request.playerId, buttonCode: 1, channelId: params.channelId, heading: "Standup", info: "you do not have sufficient chips"});
        }, 2000);
    });
    }
  }
};

// Handle events after player leave waiting list successfully
actionHandler.handleLeaveWaitingList = function(params) {
  // Fire broadcast to update details on lobby table and inside table view
  params.channel.waitingPlayers = !!params.channel.waitingPlayers ? params.channel.waitingPlayers - 1 : 0;
  broadcastHandler.fireBroadcastToAllSessions({app: pomelo.app, data: {_id: params.channelId, updated : {queuePlayers: params.channel.waitingPlayers}, event: stateOfX.recordChange.tableWaitingPlayer}, route: stateOfX.broadcasts.tableUpdate});
  broadcastHandler.fireBroadcastToAllSessions({app: pomelo.app, data: {_id: params.channelId, channelType: params.channel.channelType, playerId: params.request.playerId, event: stateOfX.recordChange.tableViewLeftWaitingPlayer}, route: stateOfX.broadcasts.tableView});
  if (params.session && params.session.frontendId) {
  broadcastHandler.fireInfoBroadcastToPlayer({ playerId: params.request.playerId,serverId : params.session.frontendId, heading: "Waiting List Info", info: params.response.data.info, buttonCode: 1, channelId: params.channelId});
  }
  // pass sesson here  - TODO
  if (params.session && params.session.get) {
  var waitingChannels = !!params.session.get("waitingChannels") ? params.session.get("waitingChannels") : [];
  if(waitingChannels.indexOf(params.request.channelId) >= 0) {
    waitingChannels.splice(waitingChannels.indexOf(params.request.channelId), 1);
    params.session.set("waitingChannels", waitingChannels);
    params.session.push("waitingChannels", function (err){
      if(err) {
        serverLog(stateOfX.serverLogType.error, 'set new waiting channel for session service failed! error is : %j', err.stack);
      }
    });
  }
  }
};

module.exports = actionHandler;
