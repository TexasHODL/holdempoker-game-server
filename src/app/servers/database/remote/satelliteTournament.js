
/*jshint node: true */
"use strict";

var db              = require('../../../../shared/model/dbQuery.js'),
		async           = require("async"),
    zmqPublish      = require("../../../../shared/infoPublisher.js"),
    stateOfX        = require("../../../../shared/stateOfX.js"),
    messages      = require("../../../../shared/popupTextManager").falseMessages,
    dbMessages    = require("../../../../shared/popupTextManager").dbQyeryInfo;
var satelliteTournament = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'satelliteTournament';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

//getting tournament room
var getTournamentRoom = function(params,cb) {
  serverLog(stateOfX.serverLogType.info, 'params is in getTournamentRoom in satelliteTournament' + JSON.stringify(params));
  db.getTournamentRoom(params.tournamentId, function(err, tournament) {
    if(err || !tournament) {
      // cb({success: false, info: "No tournament room found"});
      cb({success: false, info: dbMessages.DBGETTOURNAMENTROOMFAIL_TOURNAMENT, isRetry: false, isDisplay: true, channelId: ""});
    } else {
    	serverLog(stateOfX.serverLogType.info, 'tournament is in getTournamentRoom in satelliteTournament' + JSON.stringify(tournament));
      params.gameVersionCount = tournament.gameVersionCount;
      cb(null, params);
    }
  });
};

// create tournament user for satellite
var createTournamentUser = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'params is in createTournamentUser in satelliteTournament' + JSON.stringify(params));
	var tournamentUserObj = {
		tournamentId: params.tournamentId,
		isActive: true,
		playerId: params.playerId,
		gameVersionCount: params.gameVersionCount
	};
	serverLog(stateOfX.serverLogType.info, 'tournamentUserObj is in createTournamentUser in satelliteTournament' + JSON.stringify(tournamentUserObj));
	db.createTournamentUsers(tournamentUserObj, function(err, result) {
		if(!err && !!result) {
			cb(null, params);
		} else {
			// cb({success: false, info: "Error in create tournament user"})
			cb({success: false, info: dbMessages.DB_CREATETOURNAMENTUSERS_FAILED_SATELLITETOURNAMENT, isRetry: false, isDisplay: false, channelId: ""})
		}
	});
};

satelliteTournament.register = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'params is in register in satelliteTournament' + JSON.stringify(params));
	async.waterfall([
		async.apply(getTournamentRoom, params),
		createTournamentUser
	], function(err, result) {
		if(err) {
			serverLog(stateOfX.serverLogType.info, 'err registered in tournament via satelliteTournament' + JSON.stringify(err));
			cb(err);
		} else {
			serverLog(stateOfX.serverLogType.info, 'successfully registered in tournament via satelliteTournament' + JSON.stringify(result));
			// cb({success: true, info: "Successfully Registered!!"});
			cb({success: true, info: messages.REGISTER_SUCCESS_SATELLITETOURNAMENT, isRetry: false, isDisplay: true, channelId: ""});
		}
	});
};

module.exports = satelliteTournament;
