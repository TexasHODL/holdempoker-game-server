/*jshint node: true */
"use strict";

var db     = require("../../../../shared/model/dbQuery.js"),
zmqPublish = require("../../../../shared/infoPublisher"),
stateOfX = require("../../../../shared/stateOfX"),
messages   = require("../../../../shared/popupTextManager").falseMessages,
dbMessages = require("../../../../shared/popupTextManager").dbQyeryInfo;

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'channelRemote';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}
 serverLog(stateOfX.serverLogType.info, 'in channelRemote - setSearchChannelParams');
var playerNotes = {};

var playerNotes = function (app) {
  this.app = app;
};


/**
 * this function creates new game note
 * saved by player A for player B
 * @method createNotes
 * @param  {object}    params request json object
 * @param  {Function}  cb     callback function
 */
playerNotes.prototype.createNotes = function(params, cb) {
	serverLog(stateOfX.serverLogType.info,"in create notes params is - " + JSON.stringify(params));
	db.findNotes({playerId:params.playerId, forPlayerId:params.forPlayerId}, function(err,notesResponse) {
		serverLog(stateOfX.serverLogType.info,"notes response is in create notes - " + notesResponse);
		if(err) {
			serverLog(stateOfX.serverLogType.info,"error in getNotes in createNotes in playerNotes");
			cb({success: false, info: dbMessages.DB_FINDNOTES_FAILED_PLAYERNOTES, isRetry: false, isDisplay: false, channelId: ""});
		} else if(!!notesResponse) {
			serverLog(stateOfX.serverLogType.info,"notes for this player already exist");
			cb({success: false, info: dbMessages.DB_FINDNOTES_DUPLICATE_PLAYERNOTES, isRetry: false, isDisplay: false, channelId: ""});
		} else {
			var dataToInsert = {
				playerId: params.playerId,
				forPlayerId: params.forPlayerId,
				notes : params.notes,
        color : params.color || null,
				createdAt: Number(new Date())
			};
			db.createNotes(dataToInsert, function(err, notes) {
				if(err || !notes) {
					cb({success: false, info: dbMessages.DB_CREATENOTES_FAILED_PLAYERNOTES, isRetry: false, isDisplay: false, channelId: ""});
				} else {
					cb({success: true, info: dbMessages.DB_CREATENOTES_SUCCESS_PLAYERNOTES, isRetry: false, isDisplay: false, channelId: ""});
				}
			});
		}
	});
};

/**
 * this function updates already existing notes in the game
 * saved by player A for player B
 * @method updateNotes
 * @param  {object}    params request json object
 * @param  {Function}  cb     callback function
 */
playerNotes.prototype.updateNotes = function(params, cb) {
	serverLog(stateOfX.serverLogType.info,"in update notes params is - " + JSON.stringify(params));
	db.updateNotes(params.query, params.updateKeys, function(err, notes) {
		if(err || !notes) {
			cb({success: false, info: dbMessages.DB_UPDATENOTES_FAILED_PLAYERNOTES, isRetry: false, isDisplay: false, channelId: ""});
		} else {
			cb({success: true, info: dbMessages.DB_UPDATENOTES_SUCCESS_PLAYERNOTES, isRetry: false, isDisplay: false, channelId: ""});
		}
	});
};

/**
 * this function delete already existing notes in the game
 * @method deleteNotes
 * @param  {object}    params request json object
 * @param  {Function}  cb     callback function
 */
playerNotes.prototype.deleteNotes = function(params, cb) {
	serverLog(stateOfX.serverLogType.info,"in delete notes params is - " + JSON.stringify(params));
	db.deleteNotes(params.query, params.updateKeys, function(err, notes) {
		if(err || !notes) {
			cb({success: false, info: dbMessages.DB_DELETENOTES_FAILED_PLAYERNOTES, isRetry: false, isDisplay: false, channelId: ""});
		} else {
			cb({success: true, info: dbMessages.DB_DELETENOTES_SUCCESS_PLAYERNOTES, isRetry: false, isDisplay: false, channelId: ""});
		}
	});
};

/**
 * this function gets the already created notes in the game
 * saved by player A for another player B
 * @method getNotes
 * @param  {object}   params request json object, contains both playerIds
 * @param  {Function} cb     callback functions
 */
playerNotes.prototype.getNotes = function(params, cb) {
	serverLog(stateOfX.serverLogType.info,"in get notes params is - " + JSON.stringify(params));
	db.findNotes({playerId: params.playerId, forPlayerId: params.forPlayerId}, function(err, notes) {
		if(err || !notes) {
			cb({success: false, info: dbMessages.DB_FINDNOTES_NOTFOUND_PLAYERNOTES, isRetry: false, isDisplay: false, channelId: ""});
		} else {
			cb({success: true, result: notes});
		}
	});
};



module.exports = function(app) {
    return new playerNotes(app);
};
