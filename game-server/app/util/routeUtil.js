/*
* @Author: sushiljainam
* @Date:   2017-06-21 18:30:15
* @Last Modified by:   digvijay
* @Last Modified time: 2018-12-28 17:01:33
*/

/*jshint node: true */
"use strict";


/**
 * import in memory db query object
 * @type {Object}
 */
var imDB = require("../../shared/model/inMemoryDbQuery.js");
const authService = require("../../services/auth/authService.js");

var dispatcher = require("./dispatcher");

// HEAVY CAUTION - below

// router for connector requests or RPC
// VERY USEFUL
module.exports.redirConn = function (session, msg, app, cb) {
	var servers = app.getServersByType('connector');
	if (!servers || servers.length === 0) {
		cb(new Error('can not find redirect (connector) servers.'));
		return;
	}
	if (session.forceFrontendId) {
		console.log('allotted connector server by 2', session.forceFrontendId);
		return cb(null, session.forceFrontendId);
	}
	if (msg.namespace == 'user') {
		if (['entryRemote', 'sessionRemote', 'adminManagerRemote'].indexOf(msg.service) >= 0) {
			console.log('allotted connector server by 1', session.frontendId);
			if (session.frontendId) {
				cb(null, session.frontendId);
				return;
			} else {
				cb(null, servers[Math.floor(Math.random() * servers.length)].id);
				return;
			}
		}
	}
	var server = dispatcher.dispatch(session.uid, servers);
	cb(null, server.id);
};

/**
 * Redirect to api
 * router for room APIs or RPC
 * VERY USEFUL
 * 
 * @method redirect
 * @param  {Object}        session   current back end session object
 * @param  {Object}        msg       wrapper message containing actual payload
 * @param  {Object}        app       current connector server instance
 * @param  {Function}      cb        callback function
 * @return {Object}                  error/success object
 */
module.exports.redirect = function (session, msg, app, cb) {
	var servers = app.getServersByType('room');
	if (!servers || servers.length === 0) {
		cb(new Error('can not find redirect (room) servers.'));
		return;
	}
	console.log(JSON.stringify(msg));
	let access_token = "";
	let isAutoMove = false;
	let isAutoLeave = false;
	if (msg.namespace == 'sys' && msg.method == 'forwardMessage') {
		access_token = msg.args[0].body.access_token ? msg.args[0].body.access_token : " ";
		isAutoMove = msg.args[0].body.isAutoMove;
		isAutoLeave = msg.args[0].body.isHitLeavel
	} else {
		access_token =msg.access_token ? msg.access_access : " ";
		isAutoMove = msg.isAutoMove;
		isAutoLeave = msg.isHitLeavel
	}
	if (isAutoMove||isAutoLeave) {
		var serverId;//= servers[Math.floor(Math.random()*servers.length)].id;
		// var serverId = dispatcher.dispatch(params.playerId, params.servers);
		if (dispatcherNeeded(msg)) {
			if (session.forceFrontendId) {
				console.log('allotted room server by 7', session.forceFrontendId);
				return cb(null, session.forceFrontendId);
			}
			addNetworkIpInMsg(session, msg, app);
			var channelId = fetchChannelId(msg);
			if (isFirstRoute(msg)) {
				getRedirectFromDB(channelId, function (sserverId) {
					if (sserverId) {
						console.log('selected redirected actually');
						serverId = sserverId;
						setRedirectInSession(session, channelId, serverId);
						console.log('allotted room server by 5', serverId);
						cb(null, serverId); return;
					} else {
						var server;
						if (channelId) {
							server = dispatcher.dispatch(channelId, servers);
						} else {
							server = servers[Math.floor(Math.random() * servers.length)];
						}
						//servers[Math.floor(Math.random()*servers.length)].id;
						// assign a new one, BTW it must be a join request (the first person's join)
						console.log('allotted room server by 6', server.id);
						cb(null, server.id); return; // its random it needs to be changed
					}
				});
			} else {
				var sserverId = getRedirectFromSession(session, channelId);
				if (sserverId) {
					serverId = sserverId;
					console.log('allotted room server by 1', serverId);
					cb(null, serverId);
					if (isLastRoute(msg)) {
						removeRedirectFromSession(session, channelId);
					}
					return;
				} else {
					getRedirectFromDB(channelId, function (sserverId) {
						if (sserverId) {
							console.log('selected redirected actually');
							serverId = sserverId;
							setRedirectInSession(session, channelId, serverId);
							console.log('allotted room server by 2', serverId);
							cb(null, serverId);
							if (isLastRoute(msg)) {
								removeRedirectFromSession(session, channelId);
							}
							return;
						} else {
							var server;
							if (channelId) {
								server = dispatcher.dispatch(channelId, servers);
							} else {
								server = servers[Math.floor(Math.random() * servers.length)];
							}
							//servers[Math.floor(Math.random()*servers.length)].id;
							// assign a new one, BTW it must be a join request (the first person's join)
							console.log('allotted room server by 3', server.id);
							cb(null, server.id); // its random it needs to be changed
							if (isLastRoute(msg)) {
								removeRedirectFromSession(session, channelId);
							}
							return;
						}
					});
				}
			}
		} else {
			serverId = servers[Math.floor(Math.random() * servers.length)].id;
			console.log('allotted room server by 4', serverId);
			cb(null, serverId); return;
		}
	} else {
		authService.handleTokenData(access_token).then((resultHandleTokenData) => {
			if (resultHandleTokenData.status === "session_expired") {
				cb(new Error('session_expired'));
				return;
			}
			else if (resultHandleTokenData.status === "redis_went_wrong") {
				cb(new Error('redis_went_wrong'));
				return;
			}
			else if (resultHandleTokenData.status === "invalid_session") {
				cb(new Error('invalid_session'));
				return;
			}
			else {
				//continue 			
	
				var serverId;//= servers[Math.floor(Math.random()*servers.length)].id;
				// var serverId = dispatcher.dispatch(params.playerId, params.servers);
				if (dispatcherNeeded(msg)) {
					if (session.forceFrontendId) {
						console.log('allotted room server by 7', session.forceFrontendId);
						return cb(null, session.forceFrontendId);
					}
					addNetworkIpInMsg(session, msg, app);
					var channelId = fetchChannelId(msg);
					if (isFirstRoute(msg)) {
						getRedirectFromDB(channelId, function (sserverId) {
							if (sserverId) {
								console.log('selected redirected actually');
								serverId = sserverId;
								setRedirectInSession(session, channelId, serverId);
								console.log('allotted room server by 5', serverId);
								cb(null, serverId); return;
							} else {
								var server;
								if (channelId) {
									server = dispatcher.dispatch(channelId, servers);
								} else {
									server = servers[Math.floor(Math.random() * servers.length)];
								}
								//servers[Math.floor(Math.random()*servers.length)].id;
								// assign a new one, BTW it must be a join request (the first person's join)
								console.log('allotted room server by 6', server.id);
								cb(null, server.id); return; // its random it needs to be changed
							}
						});
					} else {
						var sserverId = getRedirectFromSession(session, channelId);
						if (sserverId) {
							serverId = sserverId;
							console.log('allotted room server by 1', serverId);
							cb(null, serverId);
							if (isLastRoute(msg)) {
								removeRedirectFromSession(session, channelId);
							}
							return;
						} else {
							getRedirectFromDB(channelId, function (sserverId) {
								if (sserverId) {
									console.log('selected redirected actually');
									serverId = sserverId;
									setRedirectInSession(session, channelId, serverId);
									console.log('allotted room server by 2', serverId);
									cb(null, serverId);
									if (isLastRoute(msg)) {
										removeRedirectFromSession(session, channelId);
									}
									return;
								} else {
									var server;
									if (channelId) {
										server = dispatcher.dispatch(channelId, servers);
									} else {
										server = servers[Math.floor(Math.random() * servers.length)];
									}
									//servers[Math.floor(Math.random()*servers.length)].id;
									// assign a new one, BTW it must be a join request (the first person's join)
									console.log('allotted room server by 3', server.id);
									cb(null, server.id); // its random it needs to be changed
									if (isLastRoute(msg)) {
										removeRedirectFromSession(session, channelId);
									}
									return;
								}
							});
						}
					}
				} else {
					serverId = servers[Math.floor(Math.random() * servers.length)].id;
					console.log('allotted room server by 4', serverId);
					cb(null, serverId); return;
				}
			}
		});
	}
	
};



/**
 * check weather dispatcher needed or not
 * 
 * @method dispatcherNeeded
 * @param  {Object}        msg  wrapper message containing actual payload
 * @return {Boolean}            true/false value
 */
function dispatcherNeeded(msg) {
	console.log(JSON.stringify(msg));
	if (msg.namespace == 'sys' && msg.method == 'forwardMessage') {
		var actualMsg = msg.args[0];
		return (isChannelsRoute(actualMsg.route));
	} else if (msg.namespace == 'user') {
		return (['broadcastRemote', 'logoutRemote', 'roomRemote'].indexOf(msg.service) >= 0);
	}
}

// is this first API like join and autoSit for player to enter in table
function isFirstRoute(msg) {
	console.log(JSON.stringify(msg));
	if (msg.namespace == 'sys' && msg.method == 'forwardMessage') {
		var actualMsg = msg.args[0];
		return (("room.channelHandler.joinChannel" === actualMsg.route) || ("room.channelHandler.autoSit" === actualMsg.route));
	} else if (msg.namespace == 'user') {
		return ((['broadcastRemote', 'logoutRemote', 'roomRemote'].indexOf(msg.service) >= 0) && ['joinChannel', 'autoSit'].indexOf(msg.method) >= 0);
	}
}

// is this last API like leave for player to exit from table
function isLastRoute(msg) {
	console.log(JSON.stringify(msg));
	if (msg.namespace == 'sys' && msg.method == 'forwardMessage') {
		var actualMsg = msg.args[0];
		return ("room.channelHandler.leaveTable" === actualMsg.route);
	} else if (msg.namespace == 'user') {
		return ((['broadcastRemote', 'roomRemote'].indexOf(msg.service) >= 0) && ['leaveRoom'].indexOf(msg.method) >= 0);
	}
}

// add actual network ip in msg
// got from socket
function addNetworkIpInMsg(session, msg, app) {
	console.log("addNetworkIpInMsg ", session.get("networkIp"));
	if (msg.namespace == 'sys' && msg.method == 'forwardMessage') {
		var actualMsg = msg.args[0];
		actualMsg.body.networkIp = session.get("networkIp");
	}
	if (msg.namespace == 'user') {
		var msgBody = msg.args[0];
		msgBody.networkIp = session.get("networkIp");
	}
}

// saved redirection from session settings
function removeRedirectFromSession(session, channelId) {
	if (typeof session != 'object') {
		return false;
	}
	var actualConnSession = session;//msg.args[1];
	var channelsMap = actualConnSession.get('channelsMap'); // both can work, needs testing
	console.log('getRedirectFromSession-1', channelId, actualConnSession.settings);
	if (!channelsMap) {
		return false;
	}
	if (!channelsMap[channelId]) {
		return false;
	}
	delete channelsMap[channelId]; // this is a room server id, e.g. room-server-2
	return true;
}

/**
 * get redirection server info from session if availbale in session
 * 
 * @method getRedirectFromSession
 * @param  {Object}           session     current back end session object
 * @param  {String}           channelId   channel id to connect
 * @return {String/Boolean}               channelId/false 
 */
function getRedirectFromSession(session, channelId) {
	if (typeof session != 'object') {
		return false;
	}
	var actualConnSession = session;//msg.args[1];
	var channelsMap = actualConnSession.get('channelsMap'); // both can work, needs testing
	console.log('getRedirectFromSession-1', channelId, actualConnSession.settings);
	if (!channelsMap) {
		return false;
	}
	if (!channelsMap[channelId]) {
		return false;
	}
	return channelsMap[channelId]; // this is a room server id, e.g. room-server-2
}

/**
 * set redirect record in session
 * 
 * @method setRedirectInSession
 * @param  {Object}         session     current back end session object
 * @param  {String}         channelId   channel id to connect
 * @param  {String}         sId         server id to connect to channel 
 */
function setRedirectInSession(session, channelId, sId) {
	if (typeof session != 'object') {
		return false;
	}
	var actualConnSession = session;//msg.args[1];
	var channelsMap = actualConnSession.get('channelsMap'); // both can work, needs testing
	console.log('setRedirectInSession-1', channelId, actualConnSession.settings);

	if (!channelsMap) {
		channelsMap = {};
	}

	if (channelId) {
		channelsMap[channelId] = sId; // this is a room server id, e.g. room-server-2
		actualConnSession.set('channelsMap', channelsMap);
		console.log('pushall', session.frontendId, session.id, session.settings);

		if (actualConnSession.pushAll instanceof Function) {
			actualConnSession.pushAll(session.frontendId, session.id, session.settings, function (err, res) {
				console.log('pushed session changes');
			});
		}
	}
}

/**
 * fatch channel id from msg
 * 
 * @method fetchChannelId
 * @param  {Object}       msg   wrapper message containing actual payload
 * @return {String}             channel id
 */
function fetchChannelId(msg) {
	// the channel id, for which hit is done.
	if (msg && msg.args && msg.args[0]) {
		if (msg.args[0].body) {
			return msg.args[0].body.channelId;
		} else {
			return msg.args[0].channelId;
		}
	}
}

/**
 * array to check valid route
 * HEAVY CAUTION - whenever new api is added in channelHandler or elsewhere
 * that needs routing; MUST BE MENTIONED here
 * IF MISSED; bugs tracing can take many days
 * 
 * @method isChannelsRoute
 * @param  {String}        route   name of api route
 * @return {Boolean}               true/false
 */
function isChannelsRoute(route) {
	var t = 'room.channelHandler.';
	return ([
		'room.adminActionsHandler.informUsers',
		t + 'joinChannel',
		t + 'autoSit',
		t + 'sitHere',
		t + 'makeMove',
		t + 'leaveTable',
		t + 'chat',
		t + 'addChipsOnTable',
		t + 'sitoutNextHand',
		t + 'resume',
		t + 'joinWaitingList',
		t + 'resetSitout',
		t + 'channelBroadcast',
		t + 'leaveWaitingList',
		t + 'insertVideoLog',
		t + 'revertLockedTable',
		t + 'revertLockedTableAndRemove',
		t + 'updatePrecheck'
		// t+'killChannel'
		/*, all such routes*/].indexOf(route) >= 0);
}

/**
 * get server id from db 
 * 
 * @method getRedirectFromDB
 * @param  {[type]}          channelId [description]
 * @param  {Function}        cb        [description]
 * @return {[type]}                    [description]
 */
function getRedirectFromDB(channelId, cb) {
	if (!channelId) {
		cb(false); return;
	}
	imDB.getTable(channelId, function (err, tableResponse) {
		if (err || !tableResponse) {
			cb(false); return;
		} else {
			cb(tableResponse.serverId); return;
		}
	});
}