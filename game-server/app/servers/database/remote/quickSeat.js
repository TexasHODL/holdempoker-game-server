/*jshint node: true */
"use strict";

var db          = require("../../../../shared/model/dbQuery.js"),
  zmqPublish    = require("../../../../shared/infoPublisher"),
  async           = require("async"),
  stateOfX      = require("../../../../shared/stateOfX"),
  messages      = require("../../../../shared/popupTextManager").falseMessages,
  dbMessages    = require("../../../../shared/popupTextManager").dbQyeryInfo;
var quickSeat   = {};



// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'quickSeat';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

var getTournamentRoom = function(filter, cb) {
  db.listTournamentRoom(filter, function(err, result) {
    serverLog(stateOfX.serverLogType.info,'result is in listTournamentRoom -' + JSON.stringify(result));
    if(err || !result || result.length < 1) {
      cb({success: false, info: dbMessages.DB_LISTTOURNAMENTROOM_NOTFOUND_QUICKSEAT, isRetry: false, isDisplay: true, channelId: ""});
    } else {
      cb({success: true, result: result[0]});
    }
  });
};

quickSeat.quickSeatInSitNGo = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,'in quick seat n go -' + JSON.stringify(params));
  var filter = {
    channelVariation        : params.gameVariation,
    buyIn                   : params.buyIn,
    turnTime                : params.turnTime,
    maxPlayersForTournament : params.maxPlayersForTournament,
    tournamentType          : stateOfX.tournamentType.sitNGo,
    state                   : stateOfX.tournamentState.register
  };
  serverLog(stateOfX.serverLogType.info,'filter for quickSeat is ' + JSON.stringify(filter));
  getTournamentRoom(filter, function(response) {
    if(response.success) {
      response.result.prizePool = response.result.entryfees * response.result.maxPlayersForTournament;
    }
    serverLog(stateOfX.serverLogType.info,'response is in getTournamentRoom ' + JSON.stringify(response));
    cb(response);
  });
};

var listTournament = function(params, cb) {
  var filter = {
    channelVariation        : params.gameVariation,
    buyIn                   : params.buyIn,
    tournamentType          : params.tournamentType,
    startTime               : Number(new Date()),
    endTime                 : Number(new Date()) + params.timeSpan*60000
  };
  serverLog(stateOfX.serverLogType.info,'filter for quickSeat is ' + JSON.stringify(filter));
  db.listTournamentByTimeSpan(filter, function(err, result) {
    if(!err) {
      serverLog(stateOfX.serverLogType.info,'result is in quick seat tournament' + JSON.stringify(result));
      if(result.length>0) {
        params.tournaments = result;
        cb(null, params);
      } else {
        cb({success: false, info: dbMessages.DB_LISTTOURNAMENTBYTIMESPAN_NOTFOUND_QUICKSEAT, isRetry: false, isDisplay: true, channelId: ""});
      }
    } else {
      cb({success: false, info: dbMessages.DB_LISTTOURNAMENTBYTIMESPAN_FAILED_QUICKSEAT, isRetry: false, isDisplay: false, channelId: ""});
    }
  });
};

var getEnrolledPlayers = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,'in getEnrolledPlayers  ');
  async.eachSeries(params.tournaments, function(tournament, callback) {
    db.countTournamentusers({tournamentId: tournament._id.toString()}, function(err, result) {
      if(!err) {
        tournament.enrolledPlayers = result;
        callback();
      } else {
        cb({success: false, info: dbMessages.DB_COUNTTOURNAMENTUSERS_FAILED_QUICKSEAT, isRetry: false, isDisplay: true, channelId: ""});
        return;
      }
    });
  }, function(err) {
    if(err) {
      cb({success: false, info: messages.ASYNC_EACHSERIES_GETENROLLEDPLAYERS_FAILED_QUICKSEAT, isRetry: false, isDisplay: true, channelId: ""});
    } else {
      cb({success: true, result:params.tournaments});
    }
  });
};

quickSeat.quickSeatInTournament = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,'in quick seat tournament  ' + JSON.stringify(params));
  params.response = {};
  async.waterfall([
    async.apply(listTournament, params),
    getEnrolledPlayers
    ], function(err, result) {
      if(!!err) {
        cb(err);
      } else {
        cb(result);
      }
  });
};

module.exports = quickSeat;
