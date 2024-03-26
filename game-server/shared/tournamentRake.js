/*jshint node: true */
"use strict";


var db         = require("./model/dbQuery.js"),
    async      = require("async"),
    zmqPublish = require("./infoPublisher.js"),
    _          = require('underscore'),
    stateOfX   = require("./stateOfX.js");

var tournamentRake = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'tournamentRake';
  logObject.serverName    = stateOfX.serverType.shared;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

/**
 * this function gets tournament room details from tournament id
 * @method getTournamentRoom
 * @param  {[type]}          params [description]
 * @param  {Function}        cb     [description]
 * @return {[type]}                 [description]
 */
var getTournamentRoom = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "in get tournament room in tournament rake " + JSON.stringify(params));
  db.getTournamentRoom((params.tournamentId).toString(), function(err, tournamentRoom) {
    serverLog(stateOfX.serverLogType.info, "tournament room is - " + JSON.stringify(tournamentRoom));
    if(err || !tournamentRoom) {
			cb({success : false, info : "Error in getting tournament Room"});
		} else {
      params.rakeAmount       = tournamentRoom.housefees;
      params.rakeRefId        = params.tournamentId;
      params.rakeRefType      = stateOfX.gameType.tournament;
      params.rakeRefVariation = tournamentRoom.channelVariation;
      params.rakeRefSubType   = tournamentRoom.tournamentType;
      cb(null, params);
    }
	});
};

/**
 * this fuction gets tournament users using tournamentId, gameVerisonCount
 * @method getTournamentUsers
 * @param  {object}           params request json object containing tournamentId and gameVerisonCount
 * @param  {Function}         cb     callback function
 */
var getTournamentUsers = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "In get tournament users" + JSON.stringify(params));
  db.findTournamentUser({tournamentId: params.tournamentId, gameVersionCount: params.gameVersionCount},function(err, result) {
    if(err) {
      cb({success: false, info: "Error in getting tournamentUser"});
    } else {
      if(!!result) {
        var playerIds = _.pluck(result,'playerId');
        params.playerIds = playerIds;
        cb(null,params);
      } else {
        cb({success: false, info: "No tournament users for this this tournament"});
      }
    }
  });
};


/**
 * this function creates response for rake [process]
 * @method createResponse
 * @param  {object}       params json object
 * @param  {Function}     cb     callback function
 */
var createResponse = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "In get createResponse " + JSON.stringify(params));
  var tempData = [];
  for(var playerIt=0; playerIt<params.playerIds; playerIt++) {
    tempData.push({
      playerId : params.playerIds[playerIt],
      rakeAmount : params.rakeAmount
    });
  }
  var result = {
    rakeRefId        : params.rakeRefId,
    rakeRefType      : params.rakeRefType,
    rakeRefVariation : params.rakeRefVariation,
    rakeRefSubType   : params.rakeRefSubType,
    players          : tempData
  };
  cb(null, result);
};

//Input - {tournamentId,gameVersionCount}
/**
 * this function deals with the rake process for tournament
 * @method process
 * @param  {object}   params  request json object containing tournamentId and gameVersionCount
 * @param  {Function} cb      callback function
 */
tournamentRake.process = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "in tournament rake process - " + JSON.stringify(params));
  async.waterfall([
    getTournamentRoom,
    getTournamentUsers,
    createResponse,
  ], function(err, response) {
    if(err) {
      serverLog(stateOfX.serverLogType.info, "Error occured in tournament rake process");
      cb(err);
    } else {
      cb({success : true, result : response});
    }
  });
};