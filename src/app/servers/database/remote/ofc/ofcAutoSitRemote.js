/**
 * Created by Amrendra on 29/09/2016.
**/

/*jshint node: true */
"use strict";

var async           	 = require("async"),
		_                  = require("underscore"),
		_ld                = require("lodash"),
		zmqPublish         = require("../../../../../shared/infoPublisher"),
		stateOfX           = require("../../../../../shared/stateOfX"),
		ofcTableManager    = require("./ofcTableManager"),
		ofcResponseHandler = require("./ofcResponseHandler");

var ofcAutoSitRemote = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject 					= {};
  logObject.fileName      = 'ofcAutoSitRemote';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

// ### Store local variable used for calculations

var initializeParams = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'in ofcAutoSitRemote function initializeParams');
	params.data.points 						= 0;
	params.data.isProcessRequired = true;
	params.data.isTableFull 			= false;
	serverLog(stateOfX.serverLogType.info, 'Seat index for which autosit is going to process - ' + parseInt(params.data.seatIndex));
	cb(null, params);
};

// ### Validate the seatIndex requested from client

var isValidSeatRequest = function(params, cb) {
	if(parseInt(params.data.seatIndex) <= params.table.maxPlayers) {
		cb(null, params);
	} else {
		cb({success: false, channelId: params.channelId, info: "Invalid seat index request " + parseInt(params.data.seatIndex) + " for " + params.table.maxPlayers + " player table."});
	}
};

// ### Check if there is seats available on table

var isSeatAvailable = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'in ofcAutoSitRemote function isSeatAvailable');
	if(params.data.isProcessRequired) {
		params.data.isProcessRequired = params.table.maxPlayers !== params.table.players.length;
		params.data.isTableFull = !params.data.isProcessRequired;
		cb(null, params);
	} else {
		params.data.isTableFull = true;
		cb({success: true, data: params.data, info: "Table is full kindly join waiting list."});
	}
};

// ### Check if player is already sitting on the table

var isPlayerAlreadySit = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'in ofcAutoSitRemote function isPlayerAlreadySit');
	if(params.data.isProcessRequired) {
		params.data.isProcessRequired = _ld.findIndex(params.table.players, {playerId: params.data.playerId}) < 0;
		cb(null, params);
	} else {
		cb(null, params);
	}
};

// ### Check if player's prefered seat is available

var isPreferSeatVacant = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'in ofcAutoSitRemote function isPreferSeatVacant players - ' + JSON.stringify(params.table.players));
	serverLog(stateOfX.serverLogType.info, 'Seatindex to check - ' + parseInt(params.data.seatIndex));
	if(params.data.isProcessRequired) {
		serverLog(stateOfX.serverLogType.info, 'Prefered seat index occupied if >= 0 => ' + _ld.findIndex(params.table.players, {seatIndex: parseInt(params.data.seatIndex)}));
		if(_ld.findIndex(params.table.players, {seatIndex: parseInt(params.data.seatIndex)}) >= 0) {
			serverLog(stateOfX.serverLogType.warning, 'Prefered seat index of this player is already occupied, resetting to new index.');
			serverLog(stateOfX.serverLogType.info, 'Total seats for this table will be - ' + _.range(1, params.table.maxPlayers+1));
			serverLog(stateOfX.serverLogType.info, 'Occupied seat indexes are - ' + _.pluck(params.table.players, 'seatIndex'));
			serverLog(stateOfX.serverLogType.info, 'Remaining seat indexes as vacant - ' + _.difference(_.range(1, params.table.maxPlayers+1), _.pluck(params.table.players, 'seatIndex')));
			params.data.seatIndex = _.difference(_.range(1, params.table.maxPlayers+1), _.pluck(params.table.players, 'seatIndex'))[0];
			serverLog(stateOfX.serverLogType.info, 'New reset index will be - ' + parseInt(params.data.seatIndex));
		}
		cb(null, params);
	} else {
		cb(null, params);
	}
};

// ### add player as waiting into table

var addPlayerAsReserved = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'in ofcAutoSitRemote function addPlayerAsReserved');
	if(params.data.isProcessRequired) {
		params.data.state 	= stateOfX.playerState.reserved;
		ofcTableManager.addPlayerAsWaiting(params, function(addPlayerAsWaitingResponse){
			serverLog(stateOfX.serverLogType.info, 'addPlayerAsWaitingResponse - ' + JSON.stringify(addPlayerAsWaitingResponse));
			params.data.player      = addPlayerAsWaitingResponse.data.player;
			params.data.isPlayerSit = true;
			serverLog(stateOfX.serverLogType.info, 'Player sit set to true');
			cb(null, params);
		});
	} else {
		cb(null, params);
	}
};

// ### create response for handler request

var createResponse = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'in ofcAutoSitRemote function createResponse');
	if(params.data.isProcessRequired) {
		cb(null, params);
	} else {
		cb(null, params);
	}
};


ofcAutoSitRemote.processOFCAutoSit = function (params, cb) {
  async.waterfall([
    async.apply(initializeParams, params),
    isValidSeatRequest,
    isSeatAvailable,
    isPlayerAlreadySit,
    isPreferSeatVacant,
    addPlayerAsReserved,
    createResponse
  ], function(err, response){
  	serverLog(stateOfX.serverLogType.info, 'remote processAutoSit err ' + JSON.stringify(err));
  	serverLog(stateOfX.serverLogType.info, 'remote processAutoSit response ' + JSON.stringify(response));
    if(err && !response) {
      cb(err);
    } else {
      cb({success: true, table: response.table, data: response.data});
    }
  });
};

module.exports = ofcAutoSitRemote;