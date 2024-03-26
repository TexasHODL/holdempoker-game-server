/*jshint node: true */
"use strict";

// This file is used to redirect functions to perform
// Different operations after locking table object

var ofcLeaveRemote 			 = require("./ofcLeaveRemote.js"),
		ofcMoveRemote 			 = require("./ofcMoveRemote.js"),
		ofcTableManager      = require("./ofcTableManager"),
		ofcSetTableConfig    = require("./ofcSetTableConfig"),
		ofcValidateGameStart = require("./ofcValidateGameStart"),
		ofcAutoSitRemote     = require("./ofcAutoSitRemote"),
		ofcLogRemote         = require("./ofcLogRemote"),
		ofcDistributeCards   = require("./ofcDistributeCards"),
		ofcSitRemote         = require("./ofcSitRemote"),
		zmqPublish           = require("../../../../../shared/infoPublisher"),
		stateOfX             = require("../../../../../shared/stateOfX"),
		keyValidator         = require("../../../../../shared/keysDictionary");

var ofcPerformAction = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'ofcPerformAction';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

ofcPerformAction.divert = function (params, cb) {
	keyValidator.validateKeySets("Request", "database", "ofcPerformAction", params, function (validated) {
    if(validated.success) {
      switch(params.actionName.toUpperCase()) {

	      case "GETTABLE" 						: ofcTableManager.getTableObject(params, function (response) { cb(response); }); break;
	      case "OFCSITPLAYER" 				: ofcSitRemote.performSit(params, function (response) { cb(response); }); break;
	      case "OFCSHOULDSTARTGAME" 	: ofcValidateGameStart.ofcShouldStartGame(params, function (response) { cb(response); }); break;
	      case "OFCMAKEMOVE" 					: ofcMoveRemote.performMove(params, function (response) { cb(response); }); break;
	      case "OFCLEAVETABLE" 				: ofcLeaveRemote.performLeave(params, function (response) { cb(response); }); break;
	      case "PROCESSOFCAUTOSIT" 		: ofcAutoSitRemote.processOFCAutoSit(params, function (response) { cb(response); }); break;
	      case "OFCADDPOINTSONTABLE" 	: ofcTableManager.ofcAddPointsOnTable(params, function (response) { cb(response); }); break;
	      case "CREATELOG" 						: ofcLogRemote.generateLog(params, function(response) { cb(response); }); break;
	      default 										: serverLog(stateOfX.serverLogType.error, 'No action name found - ' + params.actionName); cb({success: false, info: 'No action name found - ' + params.actionName}); break;
      }
    } else {
      cb(validated);
    }
  });
};

module.exports = ofcPerformAction;
