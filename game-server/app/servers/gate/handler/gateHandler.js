/*jshint node: true */
"use strict";

var dispatcher = require('../../../util/dispatcher'),
	_ = require('underscore'),
	// appmetrics       = require('appmetrics'),
	// monitoring       = appmetrics.monitor(),
	keyValidator = require("../../../../shared/keysDictionary.js"),
	db = require("../../../../shared/model/dbQuery.js"),
	activity = require("../../../../shared/activity.js"),
	popupTextManager = require("../../../../shared/popupTextManager"),
	stateOfX = require("../../../../shared/stateOfX.js"),
	authService = require("../../../../services/auth/authService.js");
var serverDownManager = require("../../../util/serverDownManager");
const configConstants = require('../../../../shared/configConstants');
// monitoring.on('cpu', function (cpu) {
// console.log('[' + new Date(cpu.time) + '] CPU: ' + cpu.process+' server: gate ');
// });

module.exports = function (app) {
	return new Handler(app);
};

var Handler = function (app) {
	this.app = app;
};

var handler = Handler.prototype;



/**
 * this function is for signUp and Login handler for both normal and fb/google
 * @method process
 * @param  {Object}       msg       request json object loginType, deviceType, playerId, password, ipV4Address, ipV6Address
 * @param  {Function}     next      callback function  Response : User object including host and port of connector
 */
handler.getConnector = function (msg, session, next) {
	var self = this;
	console.log("In loginMode normal in getConnector in gateHandler authtkauthtkauthtkauthtkauthtkauthtkauthtkauthtkauthtkauthtkauthtkauthtkauthtkauthtkauthtk");
	if (serverDownManager.checkServerState('login', self.app)) {
		db.findMultipleScheduleTasks({ limit: 1, type: 'serverDown', status: { $in: ["STARTED", "PENDING"] } }, function (err, result) {
			// console.log("err, result ", err, result);
			var ct = new Date().getTime();
			var infoServerUpTime = 0;
			if (!err && result) {
				if (result[0] && result[0].serverUpTime) {
					infoServerUpTime = result[0].serverUpTime;
				}
			}
			var minutes = 0;
			if (infoServerUpTime) {
				minutes = (infoServerUpTime - ct) / (60000);
			}
			if (minutes <= 0) {
				minutes = 30;
			}
			var timeString = "";
			if (minutes >= 60) {
				timeString = parseInt(minutes / 60) + " hour(s) and " + parseInt(minutes % 60) + " minute(s)";
			} else {
				timeString = minutes + " minute(s)";
			}
			next(null, { success: false, info: "Server is under maintainence. Please try again after " + timeString + ". We appreciate your support." });
		});
		return; // very mandatory
	}
	serverDownManager.checkClientStatus('login', msg, self.app, function (err, result) {
		if (err || !result) {
			next(null, { success: false, info: (err.info || "This installation is corrupted. Please try again."), errorType: (err.errorType || "5012") });
		} else {
			// normal old flow
			var connectors = self.app.getServersByType('connector');
			// console.log("in getConnector in gateHandler msg is ", JSON.stringify(msg));
			var activityParams = {};
			activityParams.data = {};
			var activityCategory = stateOfX.profile.category.profile;
			// var activitySubCategory = stateOfX.profile.subCategory.signUp;
			var activitySubCategory = stateOfX.profile.subCategory.login;
			activityParams.rawInput = msg;
			keyValidator.validateKeySets("Request", self.app.serverType, "getConnector", msg, function (value) {
				// required keys are missing from the client end
				if (!value.success) {
					// console.log("key mismatched in getConnector in gateHandler sending report to client");
					next(null, value);
				} else {
					// All the required keys are given by client
					// console.log("keys matched now proceed your logic in getConnector in gateHandler ",JSON.stringify(msg));
					var filterForUser = {};
					msg.userName = msg.userName.trim();

					var patt = /^[a-zA-Z0-9_]*$/;
					if (!msg.userName || (!patt.test(msg.userName))) {
						return next(null, { success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.falseMessages.GETCONNECTOR_USERNAMEERROR_GATEHANDLER });
					}


					// if the login type is login
					if ((msg.loginType).toLowerCase() === 'login') {
						// console.log("loginType is login in getConnector in gateHandler");
						if ((msg.loginMode).toLowerCase() === 'normal') {
							// console.log("In loginMode normal in getConnector in gateHandler");
							if (!!msg.userName) {
								filterForUser.userName = msg.userName;
							}
							filterForUser.password = msg.password;
							self.app.rpc.database.dbRemote.validateUser(self.session, msg, function (validateUserResponse) {
								// console.log("validateUserResponse is in createProfile in gateConnector is ",JSON.stringify(validateUserResponse));
								if (!!validateUserResponse) {
									if (validateUserResponse.success) {
										// calling getHostAndPort function for getting host and port of connector server
										getHostAndPort({ self: self, deviceType: msg.deviceType, connector: connectors, playerId: validateUserResponse.user.playerId }, function (data) {
											if (data.success) {
												activityParams.playerId = validateUserResponse.user.playerId;
												// console.log('getting getHostAndPort from ',data);
												validateUserResponse.user.host = data.host;
												validateUserResponse.user.port = data.port;
												activityParams.comment = "user login successfully";
												activityParams.rawResponse = { success: true, user: validateUserResponse.user };
												activityParams.playerId = validateUserResponse.user.playerId;
												activityParams.data = validateUserResponse.user;
												activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.completed);
												next(null, { success: true, serverVersion: configConstants.serverVersion, user: validateUserResponse.user });
											} else {
												activityParams.comment = "user not found";
												activityParams.rawResponse = data;
												activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
												next(null, data);
											}
										});
									} else {
										activityParams.comment = validateUserResponse.info;
										activityParams.rawResponse = validateUserResponse.info;
										activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
										next(null, { success: false, isDisplay: false, info: validateUserResponse.info });
									}
								} else {
									// console.log("not able to get data from db in get connector in gateHandler in normal login");
									activityParams.comment = "not able to find data from db";
									activityParams.rawResponse = { success: false, info: "not able to find data from db" };
									activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
									next(null, { success: false, info: "not able to find data from db" });
								}
							});
						}  else if ((msg.loginMode).toLowerCase() === 'authtk') {
							console.log("In loginMode normal in getConnector in gateHandler authtkauthtkauthtkauthtkauthtkauthtkauthtkauthtkauthtkauthtkauthtkauthtkauthtkauthtkauthtk");
							if (!!msg.access_token) {
								//validate device & user

								//verify token
								authService.handleTokenData(msg.access_token).then((resultHandleTokenData) => {
									if (resultHandleTokenData.status === "session_expired") {
										activityParams.comment = "session_expired";
										activityParams.rawResponse = { success: false, info: "session_expired" };
										activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
										next(null, { success: false, info: "session_expired" });
									}
									else if (resultHandleTokenData.status === "redis_went_wrong") {
										activityParams.comment = "redis_went_wrong";
										activityParams.rawResponse = { success: false, info: "redis_went_wrong" };
										activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
										next(null, { success: false, info: "session_expired" });
									}
									else if (resultHandleTokenData.status === "invalid_session") {
										activityParams.comment = "invalid_session";
										activityParams.rawResponse = { success: false, info: "invalid_session" };
										activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
										next(null, { success: false, info: "invalid_session" });
									}
									else {
										// accepted
										// more logic here
										msg.userName = resultHandleTokenData.data.userName;
										const playerId = resultHandleTokenData.data._id;
										self.app.rpc.database.dbRemote.validateUser(self.session, msg, function (validateUserResponse) {
											// console.log("validateUserResponse is in createProfile in gateConnector is ",JSON.stringify(validateUserResponse));
											if (!!validateUserResponse) {
												if (validateUserResponse.success) {
													// continue 

													// calling getHostAndPort function for getting host and port of connector server
													getHostAndPort({ self: self, deviceType: msg.deviceType, connector: connectors, playerId }, function (data) {
														if (data.success) {
															activityParams.playerId = playerId;
															// console.log('getting getHostAndPort from ',data);
															validateUserResponse.user.host = data.host;
															validateUserResponse.user.port = data.port;
															activityParams.comment = "user login successfully";
															activityParams.rawResponse = { success: true, user: validateUserResponse.user };
															activityParams.playerId = playerId;
															activityParams.data = validateUserResponse.user;
															activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.completed);
															next(null, { success: true, serverVersion: configConstants.serverVersion, user: validateUserResponse.user });
														} else {
															activityParams.comment = "user not found";
															activityParams.rawResponse = data;
															activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
															next(null, data);
														}
													});
												}
												else {
													activityParams.comment = validateUserResponse.info;
													activityParams.rawResponse = validateUserResponse.info;
													activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
													next(null, { success: false, isDisplay: false, info: validateUserResponse.info });
												}
											}
											else {
												// console.log("not able to get data from db in get connector in gateHandler in normal login");
												activityParams.comment = "not able to find data from db";
												activityParams.rawResponse = { success: false, info: "not able to find data from db" };
												activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
												next(null, { success: false, info: "not able to find data from db" });
											}


										});
									}
								}).catch(error => {
									const response = { success: false, isDisplay: true, info: error.message };
									console.log(`Response sent: ${JSON.stringify(response)}`);
									next(null, response);
								});
							}
							else {
								// invalid token
								activityParams.comment = "invalid token";
								activityParams.rawResponse = { success: false, info: "invalid token" };
								activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
								next(null, { success: false, info: "invalid token" });
							}	
							} else if ((msg.loginMode).toLowerCase() === 'facebook' || (msg.loginMode).toLowerCase() === 'google') {
							self.app.rpc.database.dbRemote.createProfile(self.session, msg, function (profile) {
								// console.log("user while login in getConnector in socialLogin is ",JSON.stringify(profile));
								if (!!profile) {
									if (profile.success) {
										// calling getHostAndPort function for getting host and port of connector server
										getHostAndPort({ self: self, deviceType: msg.deviceType, connector: connectors, playerId: profile.user.playerId }, function (data) {
											if (data.success) {
												// console.log('getting getHostAndPort from ',data);
												profile.user.host = data.host;
												profile.user.port = data.port;
												activityParams.comment = "user login successfully";
												activityParams.rawResponse = { success: true, user: profile.user };
												activityParams.playerId = profile.user.playerId;
												activityParams.data = profile.user;
												activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.completed);
												next(null, { success: true, serverVersion: configConstants.serverVersion, user: profile.user });
											} else {
												activityParams.comment = "eror in creating user";
												activityParams.rawResponse = data;
												activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
												next(null, data);
											}
										});
									} else {
										activityParams.comment = "eror in creating user";
										activityParams.rawResponse = profile;
										activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
										next(null, { success: false, info: profile.info });
									}
								} else {
									// console.log("not able to get data from db in get connector in gateHandler in social login");
									activityParams.comment = "not able to find data from db for socialLogin";
									activityParams.rawResponse = { success: false, info: "not able to find data from db for socialLogin" };
									activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
									next(null, { success: false, info: "not able to find data from db for socialLogin" });
								}
							});
						} else {
							// console.log("unknown loginMode in getConnector in gateHandler");
							activityParams.comment = "unknown loginMode";
							activityParams.rawResponse = { success: false, info: "unknown loginMode" };
							activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
							next(null, { success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.falseMessages.GETCONNECTOR_UNKNOWNLOGIN_GATEHANDLER });
							//next(null,{success : false, info: "unknown loginMode"});
						}
					} else if ((msg.loginType).toLowerCase() === 'registration') {
						if (!!msg.userName && !!msg.password) {
							// console.log("msg in registration is ",msg);
							if (validatePassword(msg.password)) {
								if (validateUserName(msg.userName)) {
										self.app.rpc.database.dbRemote.createProfile(self.session, msg, function (createdProfile) {
											// console.log("user login type registration in getConnector in gateHandler ",JSON.stringify(createdProfile));
											if (!!createdProfile) {
												if (createdProfile.success) {
													console.trace(createdProfile);
													// calling getHostAndPort function for getting host and port of connector server
													getHostAndPort({ self: self, deviceType: msg.deviceType, connector: connectors, playerId: createdProfile.user.playerId }, function (data) {
														if (data.success) {
															// console.log('getting getHostAndPort from ',data);
															createdProfile.user.host = data.host;
															createdProfile.user.port = data.port;
															activityParams.comment = "profile created successfully";
															activityParams.rawResponse = { success: true, info: createdProfile.user };
															activityParams.playerId = createdProfile.user.playerId;
															activityParams.data = createdProfile.user;
															// activity.logUserActivity(activityParams,activityCategory,activitySubCategory,stateOfX.profile.activityStatus.completed);
															activity.logUserActivity(activityParams, activityCategory, stateOfX.profile.subCategory.signUp, stateOfX.profile.activityStatus.completed);
															next(null, { success: true, serverVersion: configConstants.serverVersion, user: createdProfile.user });
														} else {
															activityParams.comment = "not able to find suitable connector";
															activityParams.rawResponse = { success: false, info: data };
															activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
															next(null, data);
														}
													});
												} else {
													activityParams.comment = createdProfile.info;
													activityParams.rawResponse = { success: false, info: createdProfile.info };
													activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
													next(null, { success: false, info: createdProfile.info, suggestions: createdProfile.suggestions, code: 409 });
												}
											} else {
												activityParams.comment = "not able to create user in db";
												activityParams.rawResponse = { success: false, info: "not able to create user in db" };
												activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
												next({ success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.falseMessages.GETCONNECTOR_UNABLETOCREATEUSER_GATEHANDLER });
												//next(null,{success : false, info: "not able to create user in db"});
											}
										});
								} else {
									next(null, { success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.falseMessages.GETCONNECTOR_USERNAMEERROR_GATEHANDLER });
									//next(null,{success : false, info: "username should be alphanumeric"});
								}
							} else {
								next(null, { success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.falseMessages.GETCONNECTOR_INVALIDPASSWORD_GATEHANDLER });
								//	next(null,{success : false, info: "password should contain atleast one capital letter and one number"});
							}
						} else {
							next(null, { success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.falseMessages.GETCONNECTOR_MINREQFIELDERROR_GATEHANDLER });
							//next(null,{success : false, info: "playerId,password and email is required"});
						}
					} else {
						// console.log("unknown loginType in gateConnector in gateHandler");
						next(null, { success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.falseMessages.GETCONNECTOR_UNKOWNLOGINTYPEERROR_GATEHANDLER });
						//next(null, {success : false, info: "unknown loginType"});
					}
				}
			});
		}
	});
};


// Response : connectHost,connectPort
/**
 * This internal function is for getting host and port of connector calculated by dispatcher
 * @method getHostAndPort
 * @param  {Object} params : connectorServers,playerId
 * @param  {cb}     next      callback function 
 */
var getHostAndPort = function (params, next) {
	// console.log("msg in getHostAndPort in gateHandler ",JSON.stringify(params.connector));
	// console.log("in gate-------------",params.playerId);
	if (params.deviceType == "website") {
		return next({ success: true, host: "", port: "" });
	}
	keyValidator.validateKeySets("Request", params.self.app.serverType, "getHostAndPort", params, function (validated) {
		if (validated.success) {
			params.self.app.rpc.database.dbRemote.findUserSessionInDB(params.self.session, params.playerId, function (response) {
				// console.log("-------------response----------------",response);
				var res;
				if (response.success && !!response.result) {
					res = _.findWhere(params.connector, { id: response.result.serverId });
					if (typeof res == 'object') {
						next({
							success: true,
							host: res.connectHost,
							port: res.clientPort
						});
					} else {
						res = dispatcher.dispatch(params.playerId, params.connector);
						// console.log("server name --------------",res);
						params.self.app.rpc.database.dbRemote.insertUserSessionInDB(params.self.session, { playerId: params.playerId, serverId: res.id }, function () { });
						next({
							success: true,
							host: res.connectHost,
							port: res.clientPort
						});
					}
				} else {
					res = dispatcher.dispatch(params.playerId, params.connector);
					// console.log("server name --------------",res);
					params.self.app.rpc.database.dbRemote.insertUserSessionInDB(params.self.session, { playerId: params.playerId, serverId: res.id }, function () { });
					next({
						success: true,
						host: res.connectHost,
						port: res.clientPort
					});
				}
			});
		} else {
			next(validated);
		}
	});
};


handler.getConnectorWebsite = function (msg, session, next) {
	console.log("in game server");
	var self = this;
	if (serverDownManager.checkServerState('login', self.app)) {
		db.findMultipleScheduleTasks({ limit: 1, type: 'serverDown', status: { $in: ["STARTED", "PENDING"] } }, function (err, result) {
			// console.log("err, result ", err, result);
			var ct = new Date().getTime();
			var infoServerUpTime = 0;
			if (!err && result) {
				if (result[0] && result[0].serverUpTime) {
					infoServerUpTime = result[0].serverUpTime;
				}
			}
			var minutes = 0;
			if (infoServerUpTime) {
				minutes = (infoServerUpTime - ct) / (60000);
			}
			if (minutes <= 0) {
				minutes = 30;
			}
			var timeString = "";
			if (minutes >= 60) {
				timeString = parseInt(minutes / 60) + " hour(s) and " + parseInt(minutes % 60) + " minute(s)";
			} else {
				timeString = minutes + " minute(s)";
			}
			next(null, { success: false, info: "Server is under maintainence. Please try again after " + timeString + ". We appreciate your support." });
		});
		return; // very mandatory
	}
	serverDownManager.checkClientStatus('login', msg, self.app, function (err, result) {
		if (err || !result) {
			next(null, { success: false, info: (err.info || "This installation is corrupted. Please try again."), errorType: (err.errorType || "5012") });
		} else {
			// normal old flow
			var connectors = self.app.getServersByType('connector');
			// console.log("in getConnector in gateHandler msg is ", JSON.stringify(msg));
			var activityParams = {};
			activityParams.data = {};
			var activityCategory = stateOfX.profile.category.profile;
			// var activitySubCategory = stateOfX.profile.subCategory.signUp;
			var activitySubCategory = stateOfX.profile.subCategory.login;
			activityParams.rawInput = msg;
			keyValidator.validateKeySets("Request", self.app.serverType, "getConnector", msg, function (value) {
				// required keys are missing from the client end
				if (!value.success) {
					// console.log("key mismatched in getConnector in gateHandler sending report to client");
					next(null, value);
				} else {
					// All the required keys are given by client
					// console.log("keys matched now proceed your logic in getConnector in gateHandler ",JSON.stringify(msg));
					var filterForUser = {};
					msg.userName = msg.userName.trim();

					var patt = /^[a-zA-Z0-9_]*$/;
					if (!msg.userName || (!patt.test(msg.userName))) {
						return next(null, { success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.falseMessages.GETCONNECTOR_USERNAMEERROR_GATEHANDLER });
					}


					// if the login type is login
					if ((msg.loginType).toLowerCase() === 'login') {
						// console.log("loginType is login in getConnector in gateHandler");
						if ((msg.loginMode).toLowerCase() === 'normal') {
							// console.log("In loginMode normal in getConnector in gateHandler");
							if (!!msg.userName) {
								filterForUser.userName = msg.userName;
							}
							filterForUser.password = msg.password;
							self.app.rpc.database.dbRemote.validateUser(self.session, msg, function (validateUserResponse) {
								// console.log("validateUserResponse is in createProfile in gateConnector is ",JSON.stringify(validateUserResponse));
								if (!!validateUserResponse) {
									if (validateUserResponse.success) {
										// calling getHostAndPort function for getting host and port of connector server
										getHostAndPort({ self: self, deviceType: msg.deviceType, connector: connectors, playerId: validateUserResponse.user.playerId }, function (data) {
											if (data.success) {
												activityParams.playerId = validateUserResponse.user.playerId;
												// console.log('getting getHostAndPort from ',data);
												validateUserResponse.user.host = data.host;
												validateUserResponse.user.port = data.port;
												activityParams.comment = "user login successfully";
												activityParams.rawResponse = { success: true, user: validateUserResponse.user };
												activityParams.playerId = validateUserResponse.user.playerId;
												activityParams.data = validateUserResponse.user;
												activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.completed);
												next(null, { success: true, serverVersion: configConstants.serverVersion, user: validateUserResponse.user });
											} else {
												activityParams.comment = "user not found";
												activityParams.rawResponse = data;
												activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
												next(null, data);
											}
										});
									} else {
										activityParams.comment = validateUserResponse.info;
										activityParams.rawResponse = validateUserResponse.info;
										activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
										next(null, { success: false, isDisplay: false, info: validateUserResponse.info });
									}
								} else {
									// console.log("not able to get data from db in get connector in gateHandler in normal login");
									activityParams.comment = "not able to find data from db";
									activityParams.rawResponse = { success: false, info: "not able to find data from db" };
									activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
									next(null, { success: false, info: "not able to find data from db" });
								}
							});
						}  else if ((msg.loginMode).toLowerCase() === 'authtk') {
							console.log("In loginMode normal in getConnector in gateHandler authtkauthtkauthtkauthtkauthtkauthtkauthtkauthtkauthtkauthtkauthtkauthtkauthtkauthtkauthtk");
							if (!!msg.access_token) {
								//validate device & user

								//verify token
								authService.handleTokenData(msg.access_token).then((resultHandleTokenData) => {
									if (resultHandleTokenData.status === "session_expired") {
										activityParams.comment = "session_expired";
										activityParams.rawResponse = { success: false, info: "session_expired" };
										activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
										next(null, { success: false, info: "session_expired" });
									}
									else if (resultHandleTokenData.status === "redis_went_wrong") {
										activityParams.comment = "redis_went_wrong";
										activityParams.rawResponse = { success: false, info: "redis_went_wrong" };
										activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
										next(null, { success: false, info: "session_expired" });
									}
									else if (resultHandleTokenData.status === "invalid_session") {
										activityParams.comment = "invalid_session";
										activityParams.rawResponse = { success: false, info: "invalid_session" };
										activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
										next(null, { success: false, info: "invalid_session" });
									}
									else {
										// accepted
										// more logic here
										msg.userName = resultHandleTokenData.data.userName;
										const playerId = resultHandleTokenData.data._id;
										self.app.rpc.database.dbRemote.validateUser(self.session, msg, function (validateUserResponse) {
											// console.log("validateUserResponse is in createProfile in gateConnector is ",JSON.stringify(validateUserResponse));
											if (!!validateUserResponse) {
												if (validateUserResponse.success) {
													// continue 

													// calling getHostAndPort function for getting host and port of connector server
													getHostAndPort({ self: self, deviceType: msg.deviceType, connector: connectors, playerId }, function (data) {
														if (data.success) {
															activityParams.playerId = playerId;
															// console.log('getting getHostAndPort from ',data);
															validateUserResponse.user.host = data.host;
															validateUserResponse.user.port = data.port;
															activityParams.comment = "user login successfully";
															activityParams.rawResponse = { success: true, user: validateUserResponse.user };
															activityParams.playerId = playerId;
															activityParams.data = validateUserResponse.user;
															activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.completed);
															next(null, { success: true, serverVersion: configConstants.serverVersion, user: validateUserResponse.user });
														} else {
															activityParams.comment = "user not found";
															activityParams.rawResponse = data;
															activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
															next(null, data);
														}
													});
												}
												else {
													activityParams.comment = validateUserResponse.info;
													activityParams.rawResponse = validateUserResponse.info;
													activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
													next(null, { success: false, isDisplay: false, info: validateUserResponse.info });
												}
											}
											else {
												// console.log("not able to get data from db in get connector in gateHandler in normal login");
												activityParams.comment = "not able to find data from db";
												activityParams.rawResponse = { success: false, info: "not able to find data from db" };
												activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
												next(null, { success: false, info: "not able to find data from db" });
											}


										});
									}
								}).catch(error => {
									const response = { success: false, isDisplay: true, info: error.message };
									console.log(`Response sent: ${JSON.stringify(response)}`);
									next(null, response);
								});
							}
							else {
								// invalid token
								activityParams.comment = "invalid token";
								activityParams.rawResponse = { success: false, info: "invalid token" };
								activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
								next(null, { success: false, info: "invalid token" });
							}	
							} else if ((msg.loginMode).toLowerCase() === 'facebook' || (msg.loginMode).toLowerCase() === 'google') {
							self.app.rpc.database.dbRemote.createProfile(self.session, msg, function (profile) {
								// console.log("user while login in getConnector in socialLogin is ",JSON.stringify(profile));
								if (!!profile) {
									if (profile.success) {
										// calling getHostAndPort function for getting host and port of connector server
										getHostAndPort({ self: self, deviceType: msg.deviceType, connector: connectors, playerId: profile.user.playerId }, function (data) {
											if (data.success) {
												// console.log('getting getHostAndPort from ',data);
												profile.user.host = data.host;
												profile.user.port = data.port;
												activityParams.comment = "user login successfully";
												activityParams.rawResponse = { success: true, user: profile.user };
												activityParams.playerId = profile.user.playerId;
												activityParams.data = profile.user;
												activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.completed);
												next(null, { success: true, serverVersion: configConstants.serverVersion, user: profile.user });
											} else {
												activityParams.comment = "eror in creating user";
												activityParams.rawResponse = data;
												activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
												next(null, data);
											}
										});
									} else {
										activityParams.comment = "eror in creating user";
										activityParams.rawResponse = profile;
										activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
										next(null, { success: false, info: profile.info });
									}
								} else {
									// console.log("not able to get data from db in get connector in gateHandler in social login");
									activityParams.comment = "not able to find data from db for socialLogin";
									activityParams.rawResponse = { success: false, info: "not able to find data from db for socialLogin" };
									activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
									next(null, { success: false, info: "not able to find data from db for socialLogin" });
								}
							});
						} else {
							// console.log("unknown loginMode in getConnector in gateHandler");
							activityParams.comment = "unknown loginMode";
							activityParams.rawResponse = { success: false, info: "unknown loginMode" };
							activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
							next(null, { success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.falseMessages.GETCONNECTOR_UNKNOWNLOGIN_GATEHANDLER });
							//next(null,{success : false, info: "unknown loginMode"});
						}
					} else if ((msg.loginType).toLowerCase() === 'registration') {
						if (!!msg.userName && !!msg.password) {
							// console.log("msg in registration is ",msg);
							if (validatePassword(msg.password)) {
								if (validateUserName(msg.userName)) {
										self.app.rpc.database.dbRemote.createProfile(self.session, msg, function (createdProfile) {
											// console.log("user login type registration in getConnector in gateHandler ",JSON.stringify(createdProfile));
											if (!!createdProfile) {
												if (createdProfile.success) {
													console.trace(createdProfile);
													// calling getHostAndPort function for getting host and port of connector server
													getHostAndPort({ self: self, deviceType: msg.deviceType, connector: connectors, playerId: createdProfile.user.playerId }, function (data) {
														if (data.success) {
															// console.log('getting getHostAndPort from ',data);
															createdProfile.user.host = data.host;
															createdProfile.user.port = data.port;
															activityParams.comment = "profile created successfully";
															activityParams.rawResponse = { success: true, info: createdProfile.user };
															activityParams.playerId = createdProfile.user.playerId;
															activityParams.data = createdProfile.user;
															// activity.logUserActivity(activityParams,activityCategory,activitySubCategory,stateOfX.profile.activityStatus.completed);
															activity.logUserActivity(activityParams, activityCategory, stateOfX.profile.subCategory.signUp, stateOfX.profile.activityStatus.completed);
															next(null, { success: true, serverVersion: configConstants.serverVersion, user: createdProfile.user });
														} else {
															activityParams.comment = "not able to find suitable connector";
															activityParams.rawResponse = { success: false, info: data };
															activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
															next(null, data);
														}
													});
												} else {
													activityParams.comment = createdProfile.info;
													activityParams.rawResponse = { success: false, info: createdProfile.info };
													activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
													next(null, { success: false, info: createdProfile.info, suggestions: createdProfile.suggestions, code: 409 });
												}
											} else {
												activityParams.comment = "not able to create user in db";
												activityParams.rawResponse = { success: false, info: "not able to create user in db" };
												activity.logUserActivity(activityParams, activityCategory, activitySubCategory, stateOfX.profile.activityStatus.error);
												next({ success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.falseMessages.GETCONNECTOR_UNABLETOCREATEUSER_GATEHANDLER });
												//next(null,{success : false, info: "not able to create user in db"});
											}
										});
									
								} else {
									next(null, { success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.falseMessages.GETCONNECTOR_USERNAMEERROR_GATEHANDLER });
									//next(null,{success : false, info: "username should be alphanumeric"});
								}
							} else {
								next(null, { success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.falseMessages.GETCONNECTOR_INVALIDPASSWORD_GATEHANDLER });
								//	next(null,{success : false, info: "password should contain atleast one capital letter and one number"});
							}
						} else {
							next(null, { success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.falseMessages.GETCONNECTOR_MINREQFIELDERROR_GATEHANDLER });
							//next(null,{success : false, info: "playerId,password and email is required"});
						}
					} else {
						// console.log("unknown loginType in gateConnector in gateHandler");
						next(null, { success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.falseMessages.GETCONNECTOR_UNKOWNLOGINTYPEERROR_GATEHANDLER });
						//next(null, {success : false, info: "unknown loginType"});
					}
				}
			});
		}
	});

};


/**
 * This function is for validate password
 * @method validatePassword
 * @param  {Object} password should be of length 8 at least
 */
var validatePassword = function (password) {
	return password.length >= 6 && password.length <= 25;
};


/**
 * validate userName only alphanumeric allowed
 * @method validateUserName
 * @param  userName should contain atleast one digit and caps letter
 */
var validateUserName = function (userName) {
	var patt = /^[a-zA-Z0-9_]*$/;
	return patt.test(userName);
};

