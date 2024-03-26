/*jshint node: true */
"use strict";


/**
 * Created by Amrendra on 29/09/2016.
**/

var async           = require("async"),
    _               = require("underscore"),
    _ld             = require("lodash"),
    zmqPublish      = require("../../../../shared/infoPublisher"),
    stateOfX      	= require("../../../../shared/stateOfX"),
    popupTextManager= require("../../../../shared/popupTextManager"),
    setMove         = require("./setMove"),
    tableManager    = require("./tableManager"),
    responseHandler = require("./responseHandler");

var autoSitRemote = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject 					= {};
  logObject.fileName      = 'autoSitRemote';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

// ### Store local variable used for calculations

var initializeParams = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'in autoSitRemote function initializeParams');
	params.data.chips             = 0;
	params.data.isProcessRequired = true;
	params.data.isTableFull       = false;
	serverLog(stateOfX.serverLogType.info, 'Seat index for which autosit is going to process - ' + params.data.seatIndex);
	cb(null, params);
};

// ### Validate the seatIndex requested from client

var isValidSeatRequest = function(params, cb) {
	console.log(params.table);
	if(params.data.seatIndex <= params.table.maxPlayers) {
		cb(null, params);
	} else {
		cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || "") , info:popupTextManager.falseMessages.INVALID_SEAT_INDEX_REQUEST + params.data.seatIndex + " for " + params.table.maxPlayers + " player table."});
	}
};

// ### Check if there is seats available on table

var isSeatAvailable = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'in autoSitRemote function isSeatAvailable');
	if(params.data.isProcessRequired) {
		params.data.isProcessRequired = params.table.maxPlayers !== params.table.players.length;
		params.data.isTableFull = !params.data.isProcessRequired;
		cb(null, params);
	} else {
		params.data.isTableFull = true;
		cb({success: true, data: params.data, isRetry: false, isDisplay: false, channelId:'', info: popupTextManager.falseMessages.TABLEFULL_JOIN_WAITING_LIST});
	}
};

// ### Check if player is already sitting on the table

var isPlayerAlreadySit = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'in autoSitRemote function isPlayerAlreadySit');
	if(params.data.isProcessRequired) {
		params.data.isProcessRequired = _ld.findIndex(params.table.players, {playerId: params.data.playerId}) < 0;
		cb(null, params);
	} else {
		cb(null, params);
	}
};

// ### Check if player's prefered seat is available

var isPreferSeatVacant = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'in autoSitRemote function isPreferSeatVacant');
	if(params.data.isProcessRequired) {
		serverLog(stateOfX.serverLogType.info, 'Prefered seat index occupied if >= 0 => ' + _ld.findIndex(params.table.players, {seatIndex: params.data.seatIndex}));
		if(_ld.findIndex(params.table.players, {seatIndex: params.data.seatIndex}) >= 0) {
			serverLog(stateOfX.serverLogType.warning, 'Prefered seat index of this player is already occupied, resetting to new index.');
			serverLog(stateOfX.serverLogType.info, 'Total seats for this table will be - ' + _.range(1, params.table.maxPlayers+1));
			serverLog(stateOfX.serverLogType.info, 'Occupied seat indexes are - ' + _.pluck(params.table.players, 'seatIndex'));
			serverLog(stateOfX.serverLogType.info, 'Remaining seat indexes as vacant - ' + _.difference(_.range(1, params.table.maxPlayers+1), _.pluck(params.table.players, 'seatIndex')));
			params.data.seatIndex = _.difference(_.range(1, params.table.maxPlayers+1), _.pluck(params.table.players, 'seatIndex'))[0];
			serverLog(stateOfX.serverLogType.info, 'New reset index will be - ' + params.data.seatIndex);
		}
		cb(null, params);
	} else {
		cb(null, params);
	}
};

// ### add player as waiting into table

var addPlayerAsReserved = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'in autoSitRemote function addPlayerAsReserved');
	if(params.data.isProcessRequired) {
		// Generate player object
		params.data.state    = stateOfX.playerState.reserved;
		params.data.maxBuyIn = params.table.maxBuyIn;
		params.data.isForceRit = params.table.isForceRit;
		params.data.player   = tableManager.createPlayer(params.data);

		// Add player as waiting
		tableManager.addPlayerAsWaiting(params, function(addPlayerAsWaitingResponse){
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
	serverLog(stateOfX.serverLogType.info, 'in autoSitRemote function createResponse');
	if(params.data.isProcessRequired) {
		cb(null, params);
	} else {
		cb(null, params);
	}
};

/**
 * process auto sit - from API "JOIN TABLE"
 * this function is executed after locking table
 * @method processAutoSit
 * @param  {Object}       params contains request data - channelId, playerId
 * @param  {Function}     cb     callback
 */
autoSitRemote.processAutoSit = function (params, cb) {
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

module.exports = autoSitRemote;
