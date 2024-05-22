/*jshint node: true */
"use strict";

// Created By Sushil on 25th may 2017
// Handles leave handler in tournament

var _               = require('underscore'),
  imdb              = require("../../../../shared/model/inMemoryDbQuery.js"),
  stateOfX          = require("../../../../shared/stateOfX.js"),
  db                = require("../../../../shared/model/dbQuery.js"),
  zmqPublish        = require("../../../../shared/infoPublisher.js"),
  popupTextManager  = require("../../../../shared/popupTextManager");
  // async             = require("async");

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'tournament leave handler';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

var tournamentLeaveHandler = {};

// Request: {playerId: , channelId: }
/**
 * this function deals with leave process in tournament when player is out of money
 *
 * @method leaveProcess
 * @param  {[type]}   params request json object
 * @param  {Function} cb     callback function
 * @return {[type]}          params object
 */
tournamentLeaveHandler.leaveProcess = function(params,cb) {
	serverLog(stateOfX.serverLogType.info,'in tournament handler leave process - ');
	// params for leave tournament function call on tableRemote
  var tempParams = {
		playerId : params.playerId,
		channelId : params.channelId
	};
  // rpc call on database server
	params.self.app.rpc.database.tableRemote.leaveTournament(params.session, tempParams, function (leaveTournamentResponse) {
		serverLog(stateOfX.serverLogType.info, "addChipsOnTableResponse is in leave process - " + JSON.stringify(leaveTournamentResponse));
  	if(leaveTournamentResponse.success) {
      cb({success: true, isRetry: false, channelId: params.channelId || " ", info: "player successfuly leave"});  
  	} else {
  		cb(leaveTournamentResponse);
  	}
  });
};

module.exports = tournamentLeaveHandler;