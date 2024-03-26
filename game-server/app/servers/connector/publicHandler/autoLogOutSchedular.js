/*jshint node: true */
"use strict";

var schedule       = require('node-schedule'),
	sessionHandler   = require("./sessionHandler"),
	broadcastHandler = require('./broadcastHandler'),
	zmqPublish       = require("../../../../shared/infoPublisher.js"),
	stateOfX         = require("../../../../shared/stateOfX.js"),
	imdb              = require("../../../../shared/model/inMemoryDbQuery.js"),
	db              = require("../../../../shared/model/dbQuery.js"),
	// async            = require('async'),
	onlinePlayers    = require("./onlinePlayers");
const configConstants = require('../../../../shared/configConstants');

var  autoLogOutSchedular = {};

var pomelo = require('pomelo');

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'auto logout Schedular';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

/**
 * this function kills the session specified with a session id
 * @method autoLogout
 * @param  {object}   params  contains global app
 * @param  {object}   session contains session
 */
var autoLogout = function(params, session) {
	// serverLog(stateOfX.serverLogType.info,'session is in autoLogout ', session);
	var sessionId = session.id;
	serverLog(stateOfX.serverLogType.info,'session is is - ' + sessionId);
	// var self = {
	// 	app: params.globalThis
	// } 
	serverLog(stateOfX.serverLogType.info,'serverId in autoLogOutSchedular - ' + pomelo.app.get("serverId"));
	// sessionHandler.leaveUserFromAllChannels(params.handler, pomelo.app, session, function() {
		pomelo.app.sessionService.kickBySessionId(session.id, ("elseWhere-expired"));

		// pomelo.app.rpc.connector.entryRemote.killUserSession(session, sessionId, function (killUserSessionResponse) {
	    removeUserSessionFromDB(session.get("playerId"));
	    // serverLog(stateOfX.serverLogType.info,'killUserSessionResponse - '+ JSON.stringify(killUserSessionResponse));
	  // })
	// });
};

/**
 * removes user session entry from userSession collection of pokerdb
 * @method removeUserSessionFromDB
 * @param  {String}                playerId playerId
 */
var removeUserSessionFromDB = function(playerId){
	db.removeUserSessionFromDB(playerId,function(err, res){
		if(err){
			serverLog(stateOfX.serverLogType.info,'error while removing player session details from db');
		}else{
			serverLog(stateOfX.serverLogType.info,'player session details removed from db.');
		}
		onlinePlayers.processOnlinePlayers({});
	});
};

/**
 * to check if player last active time has been crossed or not, from his session
 * @method lastActiveCrossed
 * @param  {Object}          session player session object
 * @return {Boolean}                 true if crossed
 */
var lastActiveCrossed = function (session) {
	var lastActiveSince = (new Date()).getTime() - session.get("lastActiveTime");
	serverLog(stateOfX.serverLogType.info,'last active sice is - ' + lastActiveSince/1000);
	return (lastActiveSince > configConstants.logOutTime*60000);
};

/**
 * this function checks for inactive sessions after a specifed inactivity time
 * @method killInActiveSessions
 * @param  {object}             params  contain global app
 * @param  {object}             session contains session service
 */
var killInActiveSessions = function(params, session) {
	serverLog(stateOfX.serverLogType.info,'session id of player is - ' + session.id);
	if(lastActiveCrossed(session)) {
		serverLog(stateOfX.serverLogType.info,"player has to be logout automatically");
		// auto logout player
		autoLogout(params,session);
	} else {
		// player is connected
		serverLog(stateOfX.serverLogType.info,'player is connected no need to logout');
	}
};



/**
 * this function checks for autoLogout repeatedly at a specified time interval
 * @method checkAutoLogOut
 * @param  {[type]}        params  request json objetct containing global app, session
 */
autoLogOutSchedular.checkAutoLogOut = function(params) {
	serverLog(stateOfX.serverLogType.info,'in checkAutoLogOut ------------');
  // var interval = "*/" + configConstants.autoLogOutCheckTime+ " * * * * *" //Make string to to call schedular
  // schedule.scheduleJob(interval, function(){
  	// setInterval(function(){
	  	serverLog(stateOfX.serverLogType.info,'in schedular---------------------------');
	  	var sessionCount = 0;
	  	pomelo.app.sessionService.forEachBindedSession(function(session) {
	  		var isPlayerDisconnected = session.get("isDisconnectedForce") || false;
			serverLog(stateOfX.serverLogType.info,'for iteration - '+ isPlayerDisconnected);
				if (!lastActiveCrossed(session)) {
					// skip all queries and calculations, if lastActive-NOT-Crossed
					return;
				}
	  		var playerId = session.get("playerId");
	  		if(isPlayerDisconnected && (session.get('waitingChannels') ? (session.get('waitingChannels').length == 0) : true)){
				serverLog(stateOfX.serverLogType.info,'yha tak pahucha');
	  			imdb.isPlayerJoined({playerId:playerId}, function(error, result) {
					serverLog(stateOfX.serverLogType.info,'yha tak bhi pahucha');
	  				if(!error && result <=0){
//			  			console.error(session);
				  		serverLog(stateOfX.serverLogType.info,'sessionCount is - ', ++sessionCount);
				  		broadcastHandler.fireAckBroadcastOnLogin({self: {"app":pomelo.app}, playerId: session.get("playerId"), data: {}}); // Sending broadcast to all players.
				  		var timer =  Number(new Date()) + configConstants.isConnectedCheckTime*1000; //timer after all broadcast send
				  		serverLog(stateOfX.serverLogType.info,'timer is - ' + new Date(timer));
				  		schedule.scheduleJob(timer, function(){
						  serverLog(stateOfX.serverLogType.info,'The answer to life, the universe, and everything!');
						  killInActiveSessions(params,session);
						 // removeUserSessionFromDB(playerId);
						  onlinePlayers.processOnlinePlayers({self: params.globalThis});
						});
	  					
	  				}else{
	  					console.error(stateOfX.serverLogType.info,'The answer to life, the universe, and everything!');
	  				}
	  			});
	  		}else{
	  			console.error(stateOfX.serverLogType.info,'The answer to life, the universe, and everything!');
	  		}

	  	});
  	// },configConstants.autoLogOutCheckTime*1000)
  // });
};

module.exports = autoLogOutSchedular;
