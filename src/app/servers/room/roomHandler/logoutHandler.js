/*jshint node: true */
"use strict";

var //entryRemote  = require("../remote/entryRemote.js"),
	sessionHandler = require("./sessionHandler"),
	stateOfX          = require("../../../../../shared/stateOfX.js"),
	zmqPublish        = require("../../../../../shared/infoPublisher.js"),
	popupTextManager  = require("../../../../../shared/popupTextManager"),
	logoutHandler = {};


// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'logout Handler';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

 	// ### Get user session with server ###

/**
 * this function gets user session from server
 * @method getUserSession
 * @param  {object}       params request json object
 * @param  {Function}     cb     callback function
 * @return               callback
 */
var	getUserSession =  function(params, cb) {
	var session = !!params.self.app.sessionService.getByUid(params.playerId) ? params.self.app.sessionService.getByUid(params.playerId)[0] : null;
	serverLog(stateOfX.serverLogType.info,"uid is " + params.playerId);
	if(!!session) {
		cb({success: true, sessionId: session.id});
	} else {
		cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.falseMessages.GETUSERSESSIONFAIL_LOGOUTHANDLER});
		//cb({success: false, info: "user session not found"});
	}
};

// ### Kill a user's session with server ###
/**
 * this function kills a user's session on server
 * @method killUserSession
 * @param  {object}        params request json object
 * @param  {Function}      cb     callback function
 * @return               callback
 */
var killUserSession = function(params, cb) {
	serverLog(stateOfX.serverLogType.error,'Kick user for this session forcefully!! - ' + params.sessionId);
	var session = params.self.app.sessionService.get(params.sessionId);
	if(!!session) {
		params.self.app.sessionService.kickBySessionId(params.sessionId, function(data) {
			cb({success: true});
		});
	} else {
		cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.falseMessages.KILLUSERSESSIONFAIL_LOGOUTHANDLER});
		//cb({success: false, info: "Error in kill user session"});
	}
};


/**
 * this fucntion deals with the complete logout process
 * @method logout
 * @param  {object}   params   		request json object
 * @param  {Function} callback 		callback function
 * @return             		callback
 */
logoutHandler.logout = function(params, callback) {
	serverLog(stateOfX.serverLogType.info,'in logoutHandler.logout' + params);
	getUserSession(params, function(playerSession){
		serverLog(stateOfX.serverLogType.info, 'playerSession - ' + playerSession);
		if(playerSession.success) {
			sessionHandler.leaveUserFromAllChannels(params.self,params.self.app, params.session, function(leaveResponse){
				serverLog(stateOfX.serverLogType.info,'Player has been removed from all channels!');
			});
			// params.sessionId = playerSession.sessionId;
			callback({success: true,isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.falseMessages.GETUSERSESSION_TRUE_LOGOUTHANDLER});
			//callback({success: true, info: "user logged out successfully"})
			// killUserSession(params, function(killUserSessionResponse) {
			// 	serverLog(stateOfX.serverLogType.info,'killUserSessionResponse - ', killUserSessionResponse);
			// })
		} else {
			callback(playerSession);
		}
	});
};

module.exports = logoutHandler;
