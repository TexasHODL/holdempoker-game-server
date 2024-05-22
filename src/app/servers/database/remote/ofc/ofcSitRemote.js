/*jshint node: true */
"use strict";

  /**
 * Created by Amrendra on 14/06/2016.
**/
var async              = require("async"),
    _ld                = require("lodash"),
    _                  = require('underscore'),
    stateOfX           = require("../../../../../shared/stateOfX"),
    keyValidator       = require("../../../../../shared/keysDictionary"),
    db                 = require("../../../../../shared/model/dbQuery.js"),
    imdb               = require("../../../../../shared/model/inMemoryDbQuery.js"),
    mongodb            = require('../../../../../shared/mongodbConnection'),
    zmqPublish         = require("../../../../../shared/infoPublisher"),
    profileMgmt        = require("../../../../../shared/model/profileMgmt.js"),
    ofcAdjustIndex     = require('./ofcAdjustActiveIndex'),
    roundOver          = require('./ofcRoundOver'),
    ofcHandleGameOver  = require('./ofcHandleGameOver'),
    decideWinner       = require("../../../../../shared/winnerAlgo/entry.js"),
    ofcResponseHandler = require('./ofcResponseHandler'),
    ofcTableManager    = require("./ofcTableManager");

var ofcSitRemote = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject          = {};
  logObject.fileName     = 'ofcSitRemote';
  logObject.serverName   = stateOfX.serverType.database;
  // logObject.functionName = arguments.callee.caller.name.toString();
  logObject.type         = type;
  logObject.log          = log;
  zmqPublish.sendLogMessage(logObject);
}

// Validate if player is from same network
var validateSameNetwork = function(params, cb) {
  // if(_ld.findIndex(params.table.players, {networkIp: params.data.networkIp}) < 0){
  //   cb(null, params);
  // } else {
  //   cb({success: false, channelId: params.channelId, info: "A player is with same network already sitting on this table, try another table to play."})
  // }
  cb(null, params);
};

// Validate if player is already on table
function isPlayerNotOnTable (params, cb) {
	if(_ld.findIndex(params.table.players, {playerId: params.data.playerId}) < 0){
		cb(null, params);
	} else {
		cb({success: false, channelId: params.channelId, info: "You are already sitting on table."});
	}
}

// Validate if buy in is in range decided for table
function validateBuyInAllowed (params, cb) {
	if(params.data.points >= params.table.minBuyIn && params.data.points <= params.table.maxBuyIn){
		cb(null, params);
	} else {
		cb({success: false, channelId: params.channelId, info: "Invalid buyin purchase of " + params.data.points + " points. (Min - " + params.table.minBuyIn + " and Max - " + params.table.maxBuyIn + ")"});
	}
}

// Validate if seat is already occupied by other player
function validateSeatOccupancy (params, cb) {
	if(_ld.findIndex(params.table.players, {seatIndex: params.data.seatIndex}) < 0){
		cb(null, params);
	} else {
		cb({success: false, channelId: params.channelId, info: "This seat is already occupied, try another one."});
	}
}

// Validate if profile amount is enough to sit on table (calcuate from chip-point ratio)
function validateProfileAmount (params, cb) {
  console.log("params is in validateProfileAmount in remote - " + JSON.stringify(params));
  ofcTableManager.deductChipsInOfc({table: params.table, playerId: params.data.playerId, points: params.data.points}, function(deductChipsInOfcResponse){
    console.log("deductChipsInOfcResponse is in ofcSitRemote - " + JSON.stringify(deductChipsInOfcResponse));
    if(deductChipsInOfcResponse.success) {
      cb(null, params);
    } else {
      cb(deductChipsInOfcResponse);
    }
  });
}

// Add player as waiting on table
function addPlayerAsWaiting (params, cb) {
	ofcTableManager.addPlayerAsWaiting(params, function(addPlayerAsWaitingResponse){
		if(addPlayerAsWaitingResponse.success) {
			cb(null, addPlayerAsWaitingResponse);
		} else {
			cb(addPlayerAsWaitingResponse);
		}
	});
}

ofcSitRemote.performSit = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcSitRemote function performSit');
  params = _.omit(params, 'self');
  serverLog(stateOfX.serverLogType.info, 'Action perform params - ' + JSON.stringify(params));
  async.waterfall([

    async.apply(validateSameNetwork, params),
    isPlayerNotOnTable,
		validateBuyInAllowed,
		validateSeatOccupancy,
		validateProfileAmount,
		addPlayerAsWaiting

  ], function (err, response){
    console.log('err, response');
    console.log(JSON.stringify(err));
    console.log(JSON.stringify(response));
    if(err && !response) {
      cb(err);
    } else {
      cb(response);
    }
  });
};

module.exports = ofcSitRemote;
