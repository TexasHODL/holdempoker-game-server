/*jshint node: true */
"use strict";

/* Created by Amrendra 28/09/2016 */

    var _ld             = require("lodash"),
    _                   = require('underscore'),
    stateOfX            = require("../../../../../shared/stateOfX"),
    zmqPublish          = require("../../../../../shared/infoPublisher"),
    async               = require('async'),
    keyValidator        = require("../../../../../shared/keysDictionary"),
    deductRakefromTable = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'deductRakefromTable';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

// Initialize page level params used for rake deduction calculations

var initializeParams = function(params, cb) {
	cb(null, params);
};

// Get total rake to be deducted from this table

// Start deducting rake for decision params
// Each decision params inclide end level pot and its winners as well
// 

// 

// deprecated
deductRakefromTable.processRakeDeduction = function(params, cb) {
	async.waterfall([
		async.apply(initializeParams, params)

	], function(err, response){
		if(err) {
			serverLog(stateOfX.serverLogType.info, 'Rake deduction failed! - ' + JSON.stringify(err));
			cb(err);
		} else {
			serverLog(stateOfX.serverLogType.info, 'Response in rake deduction - ' + JSON.stringify(response));
			cb(response);
		}
	});
};

module.exports = deductRakefromTable;