/*jshint node: true */
"use strict";

// This file is used to handle events for any action performed on table

var _                   = require("underscore"),
    broadcastHandler    = require("./broadcastHandler"),
		zmqPublish          = require("../../../../shared/infoPublisher.js"),
    db                  = require("../../../../shared/model/dbQuery.js"),
		imdb                = require("../../../../shared/model/inMemoryDbQuery.js"),
		stateOfX            = require("../../../../shared/stateOfX"),
    prizePoolHandler    = require("./prizePoolHandler"),
    tournamentActivePlayers = require("./tournamentActivePlayers"),
    calculateDynamicBountyHandler  = require("./calculateDynamicBountyHandler"),
    schedule               = require('node-schedule');

var pomelo = require("pomelo");
const configConstants = require('../../../../shared/configConstants');

function tournamentActionHandler() {}

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'tournamentActionHandler';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

// Handle events after player register in tournament
tournamentActionHandler.handleRegistration = function(params) {
	db.countTournamentusers({tournamentId: params.request.tournamentId, gameVersionCount: params.request.gameVersionCount}, function(err, result) {
    serverLog(stateOfX.serverLogType.info, "result is in getEnrollled players is - " + JSON.stringify(result));
    if(!err) {
      broadcastHandler.fireBroadcastToAllSessions({app: pomelo.app, data: {_id: params.request.tournamentId, updated: {enrolledPlayers: (result || 0)}, event: stateOfX.recordChange.tournamentEnrolledPlayers}, route: stateOfX.broadcasts.tournamentTableUpdate});      
    } else {
      serverLog(stateOfX.serverLogType.info, "error in getting tournament users in getEnrolledPlayersInTounaments: " + JSON.stringify(err));
    }
  });
};

// Handle events after player de-register in tournament
tournamentActionHandler.handleDeRegistration = function(params) {
  db.countTournamentusers({tournamentId: params.request.tournamentId, gameVersionCount: params.request.gameVersionCount}, function(err, result) {
    serverLog(stateOfX.serverLogType.info, "result is in getEnrollled players is - " + JSON.stringify(result));
    if(!err) {
      broadcastHandler.fireBroadcastToAllSessions({app: pomelo.app, data: {_id: params.request.tournamentId, updated: {enrolledPlayers: (result || 0)}, event: stateOfX.recordChange.tournamentEnrolledPlayers}, route: stateOfX.broadcasts.tournamentTableUpdate});
    } else {
      serverLog(stateOfX.serverLogType.info, "error in getting tournament users in getEnrolledPlayersInTounaments: " + JSON.stringify(err));
    }
  });
};

// this method will handle tournament state change broadcast
tournamentActionHandler.handleTournamentState = function(params) {
  broadcastHandler.fireBroadcastToAllSessions({app: pomelo.app, data: {_id: params.tournamentId, updated:{state: params.tournamentState}, event: stateOfX.recordChange.tournamentStateChanged}, route: stateOfX.broadcasts.tournamentStateChange});  
  if(params.tournamentState === stateOfX.tournamentState.finished){
    var date = new Date();
    var seconds = date.getSeconds();
    var timeOutTournamentRegister = configConstants.sitNGoRecurringTimer - (seconds % configConstants.sitNGoRecurringTimer);
    setTimeout(function() {
      broadcastHandler.fireBroadcastToAllSessions({app: pomelo.app, data: {_id: params.tournamentId, state: stateOfX.tournamentState.register, event: stateOfX.recordChange.tournamentStateChanged}, route: stateOfX.broadcasts.tournamentStateChange});
    }, timeOutTournamentRegister * 1000);      
  }
};

// tournamentActionHandler.handleTournamentCancelledState = function(params){
//   broadcastHandler.
// }





// Handle events after player de-register in tournament
tournamentActionHandler.handleDynamicRanks = function(params) {
  serverLog(stateOfX.serverLogType.info, "tournamentId is in tournamentActionHandler in handleDynamicRanks " + params.tournamentId);
  serverLog(stateOfX.serverLogType.info, "gameVersionCount is in tournamentActionHandler in handleDynamicRanks " + params.gameVersionCount);
  imdb.getRanks({tournamentId: params.tournamentId, gameVersionCount: params.gameVersionCount}, function(err, result) {
    serverLog(stateOfX.serverLogType.info, "result is in handleDynamicRanks - " + JSON.stringify(result));
    if(!err) {
      broadcastHandler.fireBroadcastToAllSessions({app: pomelo.app, data: {tournamentId: params.tournamentId, updated: {ranks: result.ranks} , gameVesionCount:result.gameVersionCount, event: stateOfX.recordChange.tournamentRankUpdate}, route: stateOfX.broadcasts.tournamentRankUpdate});
    } else {
      serverLog(stateOfX.serverLogType.info, "error in getting dynamicRanks in handleDynamicRanks " + JSON.stringify(err));
    }
  });
};

// Shuffle player info to players in tournament lobby
tournamentActionHandler.handleShufflePlayers = function(params) {
  serverLog(stateOfX.serverLogType.info, "tournamentId is in tournamentActionHandler in handleShufflePlayers " + params.tournamentId);
  broadcastHandler.fireBroadcastToAllSessions({app: params.app, data: {tournamentId: params.tournamentId, updated: {shiftedPlayers: params.shiftedPlayers}, event: stateOfX.recordChange.shufflePlayers}, route: stateOfX.broadcasts.tournamentLobby});
};

// info about destroy channel during player shuffling in tournament lobby
tournamentActionHandler.handleDestroyChannel = function(params) {
  serverLog(stateOfX.serverLogType.info, "tournamentId is in tournamentActionHandler in handleDestroyChannel " + params.tournamentId);
  broadcastHandler.fireBroadcastToAllSessions({app: params.app, data: {tournamentId: params.tournamentId, updated: {channelId: params.channelId}, event: stateOfX.recordChange.destroyTable}, route: stateOfX.broadcasts.tournamentLobby});
};

tournamentActionHandler.updateChips = function(params) {
  db.getCustomUser(params.playerId, {freeChips: 1, realChips:1}, function(err, user) {
    broadcastHandler.sendMessageToUser({self: params.self, msg: {playerId: params.playerId, updated: {freeChips: user.freeChips, realChips: user.realChips}}, playerId: params.playerId, route: stateOfX.broadcasts.updateProfile});
  });
};
/**
 * info about prizePool change during Gameplay
 * @param  {object} params [JSON object contains required tournament ID and game version]
 * @return [sends broadcast to all connected sessions about prizePool update] 
 */
tournamentActionHandler.prizePool = function(params){
  serverLog(stateOfX.serverLogType.info, "tournamentId is in tournamentActionHandler in prizePool " + params.tournamentId);
  serverLog(stateOfX.serverLogType.info, "gameVersionCount is in tournamentActionHandler in prizePool " + params.gameVersionCount);
  var newParams = {
        tournamentId : params.tournamentId,
        gameVersionCount : params.gameVersionCount 
    };
  prizePoolHandler.calculatePrizePool(newParams, function(err, result){
    serverLog(stateOfX.serverLogType.info, "result is in tournamentActionHandler in prizePool " + result);
    broadcastHandler.fireBroadcastToAllSessions({app: pomelo.app, data: {tournamentId : params.tournamentId, updated: {prizePool: result, channelId: params.channelId}, event: stateOfX.recordChange.prizePool}, route: stateOfX.broadcasts.tournamentLobby});
    
  });
};


/**
 * this function calculates active players in the game and sends bounty broadcast
 * @method calculateActivePlayers
 * @param  {[type]}       self   contains global app
 * @param  {[type]}       params request json object
 * @return {[type]}              sends broadcast
 */
tournamentActionHandler.calculateActivePlayers = function(self, params){
  serverLog(stateOfX.serverLogType.info, "params is in calculatePlayers in tournamentActionHandler " + JSON.stringify(params.tournamentRules));
  var playerPrizeBroadcastArray = _.where(params.tournamentRules.ranks, {isPrizeBroadcastSent: false});
  serverLog(stateOfX.serverLogType.info, "playerPrizeBroadcastArray is in calculatePlayers in tournamentActionHandler " + playerPrizeBroadcastArray);

  if(playerPrizeBroadcastArray.length > 0){
    tournamentActivePlayers.findActivePlayers(self, params);
    
    calculateDynamicBountyHandler.calculateDynamicBounty(params.tournamentRules, function(dynamicBountyResponse) {
        console.log("dynamic bounty response is ",dynamicBountyResponse);
        broadcastHandler.fireBroadcastToAllSessions({app: pomelo.app, data: {tournamentId : params.tournamentRules.tournamentId, updated: dynamicBountyResponse, event: stateOfX.recordChange.bountyChanged}, route: stateOfX.broadcasts.tournamentLobby});
        // next(null, dynamicBountyResponse);
  });
  }

};

/**
 * this function sends broadcast when tournament state changes to 'REGISTER'
 * @method sendBroadcastForTournamentStateRegister
 * @param  {[type]}      app contains global app
 * @param  {[type]}      msg request json object
 * @return {[type]}          sends broadcast
 */
tournamentActionHandler.sendBroadcastForTournamentStateRegister = function(app, msg){
  console.log("in sendBroadcastForTournamentStateRegister--------------------" ,msg) ;
  var registrationStartTime = msg.data.tournamentStartTime - 2*60000;
  serverLog(stateOfX.serverLogType.info,'registrationStartTime IN sendBroadcastForTournamentStateRegister----- '+ new Date(registrationStartTime));

  schedule.scheduleJob(registrationStartTime, function(){
    serverLog(stateOfX.serverLogType.info,'right time to change tournament state to register');
    broadcastHandler.fireBroadcastToAllSessions({app: app, data: {_id: msg.data._id, updated:{state: stateOfX.tournamentState.register}, event: stateOfX.recordChange.tournamentStateChanged}, route: stateOfX.broadcasts.tournamentStateChange});  
    
  });

};
// prize pool broadcast in tournament
// tournamentActionHandler.prizePool = function(params) {
//   serverLog(stateOfX.serverLogType.info, "tournamentId is in tournamentActionHandler in handleDynamicRanks " + params.tournamentId);
//   serverLog(stateOfX.serverLogType.info, "gameVersionCount is in tournamentActionHandler in handleDynamicRanks " + params.gameVersionCount);
//   db.getTournamentRoom(params.tournamentId, function(err, tournamentRoom) {
//     if(!err && tournamentRoom) {
//       if(tournamentRoom.tournamentType === stateOfX.tournamentType.sitNGo) {

//       } else {
//         serverLog(stateOfX.serverLogType.info, "This is normal tournament no need to send broadcast");
//       }
//     } else {
//       serverLog(stateOfX.serverLogType.error, "Error in getting tournament room from db");
//     }
//   })
// };


module.exports = tournamentActionHandler;