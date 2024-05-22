/*jshint node: true */
"use strict";

// Created by Nishant on 29/05/2017
// This file handles the tournament players of tournament

var async 			        = require('async'),
		_                   = require("underscore"),
    broadcastHandler    = require("./broadcastHandler"),
		// startGameHandler    = require("./startGameHandler"),
		actionLogger        = require("./actionLogger"),
		zmqPublish          = require("../../../../shared/infoPublisher.js"),
    db                  = require("../../../../shared/model/dbQuery.js"),
		imdb                = require("../../../../shared/model/inMemoryDbQuery.js"),
    ObjectID     				= require('mongodb').ObjectID,
  	popupTextManager    = require("../../../../shared/popupTextManager"),
		stateOfX            = require("../../../../shared/stateOfX");


var tournamentActivePlayers = {};

function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'tournamentActivePlayers';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

/**
 * this function finds active players of tournament and sends broadcast about total players and active players in  tournament
 * @method findActivePlayers
 * @param  {[type]}          self   contains information about app, helps in sending broadcast
 * @param  {[type]}          params request JSON object
 * @return {[type]}                 broadcast to all sessions
 */
tournamentActivePlayers.findActivePlayers = function(self, params){
  serverLog(stateOfX.serverLogType.info, "self is in findActivePlayers in tournamentActivePlayers " + self);
  serverLog(stateOfX.serverLogType.info, "params is in findActivePlayers in tournamentActivePlayers " + JSON.stringify(params));

  db.findActiveTournamentUser({tournamentId: params.tournamentRules.tournamentId, gameVersionCount: params.tournamentRules.gameVersionCount}, function(err, result){
    if(!err && result){
      var tournamentPlayersCount  = result.length;
      var activePlayersCount = _.where(result, {'isActive': true}).length;
      console.log("tournamentPlayersCount, activePlayersCount", tournamentPlayersCount, activePlayersCount);
      broadcastHandler.fireBroadcastToAllSessions({app: self.app, data: {_id: params.tournamentRules.tournamentId, updated: {totalPlayers: tournamentPlayersCount , activePlayers: activePlayersCount}, event: stateOfX.recordChange.tournamentActivePlayers}, route: stateOfX.broadcasts.tournamentTableUpdate});      

    }
    else{
      serverLog(stateOfX.serverLogType.info, "error in getting tournament users in getEnrolledPlayersInTounaments: " + JSON.stringify(err));
    }

  });
};



module.exports = tournamentActivePlayers;