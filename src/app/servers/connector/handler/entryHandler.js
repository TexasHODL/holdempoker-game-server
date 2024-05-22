/*jshint node: true */
"use strict";

// > This file is used to control following things -
// 1. Handle client request
// 2. Response to client
// 3. Perform db operation before sending response (if required)
// 4. Internal functions are also used to manipulate data before response (if required)


// ### External files and packages declaration ###
var _                       = require("underscore"),
    // schedule                = require("node-schedule"),
    // async                   = require("async"),
    _ld                     = require("lodash"),
    // appmetrics           = require("appmetrics"),
    // monitoring           = appmetrics.monitor(),
    keyValidator            = require("../../../../shared/keysDictionary"),
    imdb                    = require("../../../../shared/model/inMemoryDbQuery.js"),
    db                      = require("../../../../shared/model/dbQuery.js"),
    adminDBquery            = require("../../../../shared/model/adminDbQuery"),
    logDB                   = require("../../../../shared/model/logDbQuery.js"),
    encryptDecrypt          = require("../../../../shared/passwordencrytpdecrypt.js"),
    activity                = require("../../../../shared/activity.js"),
    stateOfX                = require("../../../../shared/stateOfX.js"),
    profileMgmt             = require("../../../../shared/model/profileMgmt.js"),
    zmqPublish              = require("../../../../shared/infoPublisher.js"),
    // filterChat              = require("../../../../shared/filterChat"),
    configMsg               = require("../../../../shared/popupTextManager").falseMessages,
    dbConfigMsg             = require("../../../../shared/popupTextManager").dbQyeryInfo,
    broadcastHandler        = require("../publicHandler/broadcastHandler"),
    sessionHandler          = require("../publicHandler/sessionHandler"),
    // joinChannelHandler      = require("./joinChannelHandler"),
    // startGameHandler        = require("./startGameHandler"),
    // startTournamentHandler  = require("./startTournamentHandler"),
    // sitHereHandler          = require("./sitHereHandler"),
    updateProfileHandler    = require("../publicHandler/updateProfileHandler"),
    // actionHandler           = require("./actionHandler"),
    // actionLogger            = require("./actionLogger"),
    // autoSitHandler          = require("./autoSitHandler"),
    lateRegistrationHandler = require("../publicHandler/lateRegistrationHandler"),
    logoutHandler           = require("../publicHandler/logoutHandler"),
    // tournamentSchedular     = require("./tournamentSchedular.js"),
    // channelTimerHandler     = require("./channelTimerHandler"),
    retryHandler            = require("../publicHandler/retryHandler"),
    rebuyHandler            = require("../publicHandler/rebuyHandler"),
    addOnHandler            = require("../publicHandler/addOnHandler"),
    // autoLogOutSchedular     = require("./autoLogOutSchedular.js"),
    getFiltersFromDb        = require("../publicHandler/getFiltersFromDb"),
    onlinePlayers           = require("../publicHandler/onlinePlayers"),
    disconnectionHandler    = require("../publicHandler/disconnectionHandler"),
    commonHandler           = require("../publicHandler/commonHandler"),
    // videoHandler            = require("./videoHandler"),
    // idlePlayersHandler      = require("./idlePlayersHandler"),
    // resumeHandler           = require("./resumeHandler"),
    tournamentLeaveHandler  = require("../publicHandler/tournamentLeaveHandler"),
    tournamentActionHandler = require("../publicHandler/tournamentActionHandler"),
    sharedModule            = require("../../../../shared/sharedModule.js"),
    ObjectID                = require("mongodb").ObjectID,
    calculateDynamicBountyHandler  = require("../publicHandler/calculateDynamicBountyHandler");

const moment = require("moment");
const redisCommands = require("../../../../services/redis-db/redisCommands");
const configConstants = require('../../../../shared/configConstants');
const { requestData } = require("../../database/remote/utils/requestData");
const addTableConfig = require("../../../../shared/addTableConfig");
const tablePrivateRemote = require("../../database/remote/tablePrivateRemote"); 
    // var schedular   = {};
// Start zmq publisher
// zmqPublish.startPublisher(7001);
// zmqPublish.sendLogMessage({functionName:"sendServerLog",type:"print",log:"checking", fileName: "entryHandler"});

// monitoring.on('cpu', function (cpu) {
// });


// Create data for log generation
function serverLog (type, log) {
  var logObject          = {};
  logObject.fileName     = 'entryHandler';
  logObject.serverName   = stateOfX.serverType.connector;
  // logObject.functionName = arguments.callee.caller.name.toString();
  logObject.type         = type;
  logObject.log          = log;
  zmqPublish.sendLogMessage(logObject);
}

var globalThis = require('pomelo');

// var schedularObj = [];

var Handler = function (app) {
  this.app = app;
 // globalThis = this;
  this.registerCounter = null;
};

module.exports = function (app) {
  // myNewApp = app;
  return new Handler(app);
};

// broadcastHandler.fireBroadcastToAllSessions({app: globalThis.app, data: {fname: "amrendra", event: "TABLECHANGE"}, route: "test"})

var handler = Handler.prototype;

// ### Global variables used in this file ###


/*
 * All the request functions in this file will have three default params -
 *
 * @param  {Object}   msg     request message
 * @param  {Object}   session current session object
 * @param  {Function} next    next stemp callback
 *
 * All these function contains a callback for client requests as next
 */

// ### <<<<<<<<<<<<<<<<<<< INTERNAL FUNCTIONS STARTS >>>>>>>>>>>>>>>>>>>>>>

// ### Handle app close or session kill event
var onUserLeave = function (self, session) {
// console.trace("i m being called");
// console.error(session);

  if(!session || !session.uid) {
    return;
  }

console.error("\n\
██████╗ ██╗███████╗ ██████╗ ██████╗ ███╗   ██╗███╗   ██╗███████╗ ██████╗████████╗\n\
██╔══██╗██║██╔════╝██╔════╝██╔═══██╗████╗  ██║████╗  ██║██╔════╝██╔════╝╚══██╔══╝\n\
██║  ██║██║███████╗██║     ██║   ██║██╔██╗ ██║██╔██╗ ██║█████╗  ██║        ██║   \n\
██║  ██║██║╚════██║██║     ██║   ██║██║╚██╗██║██║╚██╗██║██╔══╝  ██║        ██║   \n\
██████╔╝██║███████║╚██████╗╚██████╔╝██║ ╚████║██║ ╚████║███████╗╚██████╗   ██║   \n\
╚═════╝ ╚═╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═══╝╚══════╝ ╚═════╝   ╚═╝   \n\
                                                                                 \n\
");

// var params = {};
// params.from_email = "support@creatiosoft.com";
// params.to_email = "support@creatiosoft.com";
// params.userName = session.settings.playerName ;
// params.linkTitle = "User " + session.settings.playerName + " is disconnected";
// params.content    = "User " + session.settings.playerName + " is disconnected";
// params.subject = "User " + session.settings.playerName + " is disconnected";
// sharedModule.sendEmail(params, function(mailSentResponse){
//   console.log("mail sent successfully", mailSentResponse)

// });
 session.set("isDisconnectedForce",true);
    session.push("isDisconnectedForce",function (err){
      if(err) {
        serverLog(stateOfX.serverLogType.error, 'set disconnected for session service failed! error is : %j', err.stack);
        // cb({success : false}); // cb is undefined
        return false;
      }
    });

  redisCommands.removePlayerOnline(session.uid, function (err, result) {
    console.log("Player removed from online player");
  });

  disconnectionHandler.handle({self: self, session: session});

  onlinePlayers.processOnlinePlayers({self: self});
};

// ### This function is for bind user session
var bindUserSession = function (msg, cb) {
  keyValidator.validateKeySets("Request", msg.self.app.serverType, "bindUserSession", msg, function (validated){
    if(validated.success) {
      var session = msg.session;
      session.bind(msg.playerId);
      session.on('closed', onUserLeave.bind(null, msg.self));
      // Set all session values
      session.push("waitingChannels",function (err){
        if(err) {
          serverLog(stateOfX.serverLogType.error, 'set waitingChannels for session service failed! error is : %j', err.stack);
          cb({success : false});
          return false;
        }
      });
      session.set("playerId",msg.playerId);
      var clientAddress = msg.self.app.get('sessionService').getClientAddressBySessionId(session.id);
      // { ip: '::ffff:192.168.2.77', port: 56844 } clientAddress - in this format
      session.set("networkIp", clientAddress.ip);
      session.push("networkIp",function (err){
        if(err) {
          serverLog(stateOfX.serverLogType.error, 'set networkIp for session service failed! error is : %j', err.stack);
          cb({success : false});
          return false;
        }
      });
      console.log('bindUserSession', session.get("networkIp"));
      session.push("playerId",function (err){
        if(err) {
          serverLog(stateOfX.serverLogType.error, 'set playerId for session service failed! error is : %j', err.stack);
          cb({success : false});
          return false;
        }
      });
      session.set("channels",[]);
      session.push("channels",function (err){
        if(err) {
          serverLog(stateOfX.serverLogType.error, 'set channels for session service failed! error is : %j', err.stack);
          cb({success : false});
          return false;
        }
      });
      session.set("playerName",msg.playerName);
      session.push("playerName",function (err){
        if(err) {
          serverLog(stateOfX.serverLogType.error, 'set playerName for session service failed! error is : %j', err.stack);
          cb({success : false});
          return false;
        }
      });
      session.set("deviceType",msg.deviceType||'cell');
      session.push("deviceType",function (err){
        if(err) {
          serverLog(stateOfX.serverLogType.error, 'set deviceType for session service failed! error is : %j', err.stack);
          cb({success : false});
          return false;
        }
      });
      session.set("lastActiveTime",Number(new Date()));
      session.push("lastActiveTime",function (err){
        if(err) {
          serverLog(stateOfX.serverLogType.error, 'set lastActiveTime for session service failed! error is : %j', err.stack);
          cb({success : false});
          return false;
        }
      });
        //set access_token in message to use msg.access_token
      session.set("accessToken",msg.access_token);
      session.push("accessToken",function (err){
        if(err) {
          serverLog(stateOfX.serverLogType.error, 'set accessToken for session service failed! error is : %j', err.stack);
          cb({success : false});
          return false;
        }
      });
      onlinePlayers.processOnlinePlayers({self: msg.self});
      // cb({success: true, info: "Session has been binded and session values has been also set."});
      cb({success: true, info: configMsg.BINDUSERSESSION_TRUE_ENTRYHANDLER, isRetry: false, isDisplay: false, channelId: ""});
    } else {
      cb(validated);
    }
  });
};

// ### validate tournament whether it is ready to start of not

var validateTournamentStart = function(params,cb){
  serverLog(stateOfX.serverLogType.info, "in validate start tournament");
  keyValidator.validateKeySets("Request", params.serverType, "validateTournamentStart", params, function(validated) {
    if(validated.success) {
      var tournamentId = params.tournamentId;
      db.getTournamentRoom(tournamentId,function(err, tournamentRoom){
        if(err) {
          serverLog(stateOfX.serverLogType.info, "error in getting tournament room");
          serverLog(stateOfX.serverLogType.info, err);
          cb({success:false});
        } else {
          if(!!tournamentRoom) {
            serverLog(stateOfX.serverLogType.info, "tournamentRoom is in validate tournament start is - "+JSON.stringify(tournamentRoom));
            var playerRequired = tournamentRoom.maxPlayersForTournament;
            db.countTournamentusers({isActive: true, tournamentId: tournamentId,gameVersionCount:tournamentRoom.gameVersionCount}, function(err, noOfUsers) {
              if(err) {
                serverLog(stateOfX.serverLogType.info +  "error in getting count of toirnament user");
                serverLog(stateOfX.serverLogType.info +  err);
                cb({success:false});
              } else{
                serverLog(stateOfX.serverLogType.info, "noOfUsers and playerRequired are - "+noOfUsers+playerRequired);
                if(noOfUsers === playerRequired) {
                  serverLog(stateOfX.serverLogType.info, "tournament is going to start");
                  params.self.startTournament({tournamentId: tournamentId,gameVersionCount : tournamentRoom.gameVersionCount},"session", function(){
                    //needs to be complete this part;
                    // chnage the state of tournament room to RUNNING
                    // serverLog(stateOfX.serverLogType.info, "tournamentRoom._id,stateOfX.tournamentState.running ----",tournamentRoom._id,stateOfX.tournamentState.running);
                    // changeStateOfTournament(tournamentRoom._id,stateOfX.tournamentState.running);
                    cb({success:true, result:{tournamentId: tournamentRoom._id}});
                  });
                } else {
                  serverLog(stateOfX.serverLogType.info, "tournament not eligible to start");
                  serverLog(stateOfX.serverLogType.info, "in validateTournamentStart");
                  cb({success:false});
                }
              }
            });
          } else {
            serverLog(stateOfX.serverLogType.info, "this is not a tournament room");
            serverLog(stateOfX.serverLogType.info, "in validateTournamentStart");
            cb({success:false});
          }
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.info, "more key required in validateTournamentStart");
      serverLog(stateOfX.serverLogType.info, "in validateTournamentStart");
      cb({success:false});
    }
  });
};

// ### <<<<<<<<<<<<<<<<<<< INTERNAL FUNCTIONS FINISHED >>>>>>>>>>>>>>>>>>>>>>

// <<<<<<<<<<<<<<<<<<<<<<<< HANDLER REQUEST FROM CLIENT >>>>>>>>>>>>>>>>>>>>>

// ### Test function to destroy channel
// deprecated here
handler.killChannel = function (msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self     = this,
      channel  = self.app.get('channelService').getChannel(msg.channelId, false);
  if(channel) {
    channel.destroy();
    var success = {success: true};
    serverLog(stateOfX.serverLogType.response, JSON.stringify(success));
    next(null, success);
  } else {
    // var fail = {success: false, info: "Chennl not found!"};
    var fail = {success: false, info: configMsg.KILLCHANNELFAIL_ENTRYHANDLER, isRetry: false, isDisplay: false, channelId: ""};
    serverLog(stateOfX.serverLogType.response, JSON.stringify(fail));
    next(null, fail);
  }
};

function setOnlinePlayerInRedis(playerId) {
  redisCommands.setOnlinePlayers(playerId, function (err, result) {
    console.log("redis value set");
  })
}

// ### Create session for this player with server ###
// kill old session if found
// find player's joined channels - return array of object containing channelId
handler.enter = function (msg, session, next) {
  // console.log("printing client info", session.__session__.__socket__.socket.upgradeReq.headers["user-agent"]);
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  self.session = session;
  // msg.playerName = !!msg.playerName ? msg.playerName : "Player";
  keyValidator.validateKeySets("Request", "connector", "enter", msg, function (validated){
    if(validated.success) {
      // get user session
      self.app.rpc.connector.entryRemote.getUserSession(self.session, msg, function (sessionExist) {
        // if user session already exist on the server
        if(sessionExist.success) {
          var prevSession = self.app.sessionService.get(sessionExist.sessionId);
          prevSession.set("isConnected",false); // set isConnected false
          // IMPORTANT - set setting from old session to new session
          // ISSUE - player remains in waiting list forever; Error in waiting list
          // TRACE - join waiting list from a session; create a new session; close that too; be in waiting list for more than 20 minutes after that; make some empty seat; 
          // waiting player cannot come inside; also does not get removed forever
          // RESOLVED AS - set old session values in new session; such as - waitingChannels
          self.session.set("waitingChannels", prevSession.get("waitingChannels"));
          self.app.sessionService.kickBySessionId(sessionExist.sessionId, ('elseWhere-'+(msg.deviceType||"another device")));
          // fire broadcast to player whether he is connected to server or not
          // broadcastHandler.fireAckBroadcastOnLogin({self: self, sessionId: sessionExist.sessionId, playerId: msg.playerId, data: {}});
          // setTimeout(function(){
          //   prevSession = self.app.sessionService.get(sessionExist.sessionId);
          //   if(!!prevSession && prevSession.get("isConnected")) { // if player is connected to server
              // next(null, {success: false, info: "You are signed from other computer. Please log out from there and try again.", multipleLogin: true});
            //   next(null, {success: false, info: configMsg.CHECKMULTIPLESIGNUPFAIL_ENTRYHANDLER, isRetry: false, isDisplay: true, channelId: "", multipleLogin: true});
            // } else { // If player is not connected to the server
              // kill user previous sesison of server
              self.app.rpc.connector.entryRemote.killUserSession(self.session, sessionExist.sessionId, function (killUserSessionResponse) {
                // bind this user session to server
                bindUserSession({playerId: msg.playerId, playerName: msg.playerName, deviceType: msg.deviceType, session: session, self: self}, function (userSession) {
                  retryHandler.getJoinedChannles({playerId: msg.playerId}, function(joinChannelResponse) {
                    if(joinChannelResponse.success) {
                      // serverLog(stateOfX.serverLogType.request," get user table on resume-----------" + JSON.stringify(msg));
                      // var success = {success  : userSession.success, joinChannels: []};
                      var success = {success  : userSession.success, joinChannels: joinChannelResponse.joinedChannels};
                      serverLog(stateOfX.serverLogType.response, JSON.stringify(success));
                      next(null, success);
                      if (success.success) {
                        self.app.rpc.database.dbRemote.insertUserSessionInDB(self.session, {playerId : msg.playerId, serverId : self.app.serverId}, function (resUserSession) {
                          if (resUserSession.success) {
                            setOnlinePlayerInRedis(msg.playerId);
                            next(null, success);
                          } else {
                            next(null, {success: false, info: "Login Failed - user session"});
                          }
                        });
                      }
                      
                      // this event is to be modified
                      // if(success.success){
                      //   self.app.event.emit("entrySuccess", {});
                      // }
                    } else {
                      // next(null, {success: false, isDisplay: false, isRetry: false, info: "Error in getting joined channels"});
                      next(null, {success: false, info: configMsg.GETJOINEDCHANNELSFAIL_ENTRYHANDLER, isRetry: false, isDisplay: true, channelId: ""});
                    }
                  });
                });
              });
          //   }
          // },configConstants.isConnectedCheckTime*1000);
        } else { // If player session not exist on the server
          bindUserSession({playerId: msg.playerId, playerName: msg.playerName, deviceType: msg.deviceType, session: session, self: self}, function (userSession) {
            retryHandler.getJoinedChannles({playerId: msg.playerId}, function(joinChannelResponse) {
              if(joinChannelResponse.success) {
                // serverLog(stateOfX.serverLogType.request," get user table on resume-----------" + JSON.stringify(msg));
                var success = {success  : userSession.success, joinChannels: joinChannelResponse.joinedChannels};
                serverLog(stateOfX.serverLogType.response, JSON.stringify(success));
                next(null, success);
                if (success.success) {
                  self.app.rpc.database.dbRemote.insertUserSessionInDB(self.session, {playerId : msg.playerId, serverId : self.app.serverId}, function (resUserSession) {
                    if (resUserSession.success) {
                      setOnlinePlayerInRedis(msg.playerId);
                      next(null, success);
                    } else {
                      next(null, {success: false, info: "Login Failed - user session"});
                    }
                  });
                }
                // this is to be modified
                // if(success.success){
                //   self.app.event.emit("entrySuccess", {});
                // }
              } else {
                // next(null, {success: false, isDisplay: false, isRetry: false, info: "Error in getting joined channels"});
                next(null, {success: false, channelId: "", isDisplay: true, isRetry: false, info: configMsg.GETJOINEDCHANNELSFAIL_ENTRYHANDLER});
              }
            });
          });
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

var fixedDecimal = function (number, precisionValue) {
  let precision = precisionValue ? precisionValue : 2;
  return Number(Number(number).toFixed(precision));
}

/**
 * method for updating the mega points
 * @method updateMegaPointsPercent
 * @author Naman Jain
 * @date   2019-01-11
 * @param  {[type]}                userData [description]
 * @param  {Function}              cb       [description]
 * @return {[type]}                         [description]
 */
function updateMegaPointsPercent(userData, cb) {
  adminDBquery.findAllLoyaltyPoints({}, function (err, res) {
     
      if (err || !res) {
          // cb({success: false, info: "db - query failed.- findAllMegaPointLevels"}); 
          cb(null,userData);
          return;
      } else {
          userData.statistics.megaPointsPercent = getLevelPercent(userData.statistics.megaPoints, res);
          userData.statistics.megaPointLevel = getLevelName(userData.statistics.megaPointLevel, res);
          userData.tournamentsPlayed        =  0;//user.statistics.handsPlayed;
          userData.tournamentsEarnings      =  0;//user.statistics.handsWon;
          userData.unclamedBonus            =  userData.unclamedBonus || 0;
          userData.password                 = "";
          // console.log('result in getUserData - ' ,(userData));
          cb(null,userData);
      }
  });
  function getLevelName(levelId, levels) {
      var t = _.findWhere(levels, {levelId: levelId}) || levels[0];
      return t.loyaltyLevel;
  }

  function getLevelPercent (points, levels) {
    if (points <= 0) {
      return 0;
    }
    if (levels.length <= 0) {
      return 0;
    }
    if (levels.length > 0) {
      function calculator (arr, value) {
        for (var i = 0; i < arr.length; i++) {
          if (arr[i].levelThreshold > value) { // levelThreshold is min value of range
            break;
          }
        }
        if (i >= arr.length) {
          return 101 ; // any value > 100 to represent highest level
        }
        return (100 * (value - arr[i - 1].levelThreshold) / (arr[i].levelThreshold - arr[i - 1].levelThreshold));
      }
      var c = calculator(levels, points);
      c = Math.floor(c * 100) / 100 ;// limiting decimal places
      return (c || 0);
    }
  }
};

var assignPlayerLockedBonus = function(playerData, cb){
  console.log("inside asign Bonus--"+JSON.stringify(playerData));
  var query = {};
  query.playerId = playerData.playerId;
  db.findUserBonusDetails(query, function (err, result) {
    if (!err && result) {
      playerData.claimedLockedBonus = 0;
      playerData.lockedBonus = 0 ;
      for(var i =0 ; i<result.bonus.length ; i++){
        playerData.claimedLockedBonus = playerData.claimedLockedBonus + result.bonus[i].claimedBonus;
        playerData.lockedBonus = playerData.lockedBonus + result.bonus[i].unClaimedBonus;
      }
      cb(null,playerData);
    } else {
      cb(null, playerData);
    }
  });
};

handler.getSharableLink = function (msg, session, next) {
  console.log("inside getSharableLink");
  // var data = req.body;
  db.findUser({playerId: msg.playerId}, function (err, result) {
    if (err || result == null) {
      // return res.json({success: false, info: err});
      next(null, { success: false, info: err })
    } else {
      if (result.panNumber != '') {
        result.panNumber = encryptDecrypt.decrypt(result.panNumber).result;
      }
      if (result.isParentUserName == '') {
        result.isParentUserName = result.isParent;
      }
      result.realChips = fixedDecimal(result.realChips, 2);
      result.instantBonusAmount = fixedDecimal(result.instantBonusAmount, 2);
      result.totalAvailableChips = fixedDecimal((result.realChips + result.instantBonusAmount), 2);
      updateMegaPointsPercent(result, function (err, response) {
        assignPlayerLockedBonus(response, function(err, playerData){
          // return res.json({ success: true, user: response });
          next(null, { success: true, user: response })
        });
      });
    }
  });
};

// this api is to set isconnected true in session for player
// and update player state if needed - to playing
handler.acknowledgeIsConnected = function(msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "acknowledgeIsConnected", msg, function (validated){
    if(validated.success) {
      var playerSession = !!self.app.sessionService.getByUid(msg.playerId) ? self.app.sessionService.getByUid(msg.playerId)[0] : null;
      playerSession.set("isConnected", true); // setting is connected true in session.
      // next(null, {success: true});
      // next(); // this is a notify - 
      // Set player state if channelId and setState passed
      if(!!msg.data && !!msg.data.channelId && !!msg.data.setState && !!session.uid) {
        self.app.rpc.database.tableRemote.setPlayerAttrib(session, {playerId: session.uid, channelId: msg.data.channelId, key: "state", value: stateOfX.playerState.playing, ifLastState : stateOfX.playerState.disconnected}, function (setPlayerAttribResponse) {
          if(setPlayerAttribResponse.success) {
            keyValidator.validateKeySets("Response", self.app.serverType, "isConnected", setPlayerAttribResponse, function (validated){
              if(validated.success) {
                serverLog(stateOfX.serverLogType.response, JSON.stringify(setPlayerAttribResponse));
                // next(null, setPlayerAttribResponse);
                next(); // this is a notify
              } else {
                serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
                // next(null, validated);
                next(); // this is a notify
              }
            });
          } else {
            serverLog(stateOfX.serverLogType.response, JSON.stringify(setPlayerAttribResponse));
            // next(null, setPlayerAttribResponse);
            next(); // this is a notify
          }
        });
      }

    } else {
      // next(null, validated);
      next(); // this is a notify
    }
  });
};

// ### Single Login
// deprecated
var singleLoginDep = function (msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "singleLogin", msg, function (validated){
    if(validated.success) {
      self.app.rpc.connector.entryRemote.getUserSession(self.session, msg, function (sessionExist) {
        self.app.rpc.connector.entryRemote.killUserSession(self.session, sessionExist.sessionId, function (killUserSessionResponse) {
          serverLog(stateOfX.serverLogType.request,"kill user session response is - " + JSON.stringify(killUserSessionResponse));
          var params = {
            playerId  : msg.playerId,
            session   : session,
            self      : self
          };
          bindUserSession(params, function (userSession) {
            var success = {success  : userSession.success};
            serverLog(stateOfX.serverLogType.response, JSON.stringify(success));
            next(null, success);
          });
        });
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

// ### Create session with server after disconnection ###
// Currently not killing the session of previous user some problem with session current session killed
// TODO - We have to kill the previous session of user
// deprecated
var reconnectDep = function (msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self             = this,
  playerId           = msg.playerId;

  self.app.rpc.connector.entryRemote.getUserSession(session, msg, function (sessionExist) {
    var params;
    if(sessionExist.success) {
      broadcastHandler.sendMessageToUser({self: self, playerId: playerId, msg: {info: "you are going to be logged out multiple login detected"}, route: "multipleLogin"});
      params = {playerId : msg.playerId, session : session, self : self};
      sessionHandler.bindUserSession(params, function (userSession) {
        var success = {success  : userSession.success};
        serverLog(stateOfX.serverLogType.response, JSON.stringify(success));
        next(null, success);
      });
    } else {
      params = {playerId : msg.playerId, session : session, self : self};
      sessionHandler.bindUserSession(params, function (userSession) {
        var success = {success  : userSession.success};
        serverLog(stateOfX.serverLogType.response, JSON.stringify(success));
        next(null, success);
      });
    }
  });
};

// ### Get list of tables
// TODO: Modify as used for test only
handler.getTables = function (msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  db.listTable({}, function (err, result){
    if(err){
      // var fail = {success: false, info: "Something went wrong!! unable to get table!"};
      var fail = {success: false, info: dbConfigMsg.DBLISTTABLESFAIL_ENTRYHANDLER, isRetry: false, isDisplay: true, channelId: ""};
      serverLog(stateOfX.serverLogType.response, JSON.stringify(fail));
      next(null, fail);
    } else{
      var success = {success: true, result: result};
      serverLog(stateOfX.serverLogType.response, JSON.stringify(success));
      next(null, success);
    }
  });
};

// ### Join player to a channel or table ###
// Join channel
// - Join only if not in channel
// - create channel if not already exists
// - create table structure here

// handler.joinChannel = function (msg, session, next) {
//   sessionHandler.recordLastActivityTime({session: session, msg: msg});
//   serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
//   var self = this;
//   keyValidator.validateKeySets("Request", "connector", "joinChannel", msg, function (validated){
//     if(validated.success) {
//       var channel = self.app.get('channelService').getChannel(msg.channelId, true);
//       joinChannelHandler.processJoin({self: self, session: session, channel: channel, channelId: msg.channelId, channelType: msg.channelType, tableId: msg.tableId, playerId: msg.playerId, playerName: msg.playerName}, function(processJoinResponse){
//         serverLog(stateOfX.serverLogType.response, JSON.stringify(processJoinResponse));
//         next(null, processJoinResponse);
//       });
//     } else {
//       serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
//       next(null, validated);
//     }
//   })
// };


// ### Auto join and sit player into a table request handler
// > Sit player based on different conditions
// > Broadcast this player sit and check for Game start as well

// handler.autoSit = function (msg, session, next) {
//   sessionHandler.recordLastActivityTime({session: session, msg: msg});
//   serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
//   var self = this;
//   keyValidator.validateKeySets("Request", "connector", "autoSit", msg, function (validated){
//     if(validated.success) {
//       var channel   = self.app.get('channelService').getChannel(msg.channelId, true),
//           seatIndex = !!parseInt(msg.seatIndex) ? parseInt(msg.seatIndex) : 1;
//       autoSitHandler.processAutoSit({self: self, session: session, channel: channel, channelId: msg.channelId, playerId: msg.playerId, playerName: msg.playerName, seatIndex: seatIndex, networkIp: msg.networkIp, imageAvtar: msg.imageAvtar, isRequested: msg.isRequested}, function(processAutoSitResponse){
//         serverLog(stateOfX.serverLogType.info, 'processAutoSitResponse response - ' + JSON.stringify(processAutoSitResponse));
//         if(!!processAutoSitResponse.isPlayerSit) {
//           next(null, processAutoSitResponse.response);
//           actionLogger.createEventLog ({self: self, session: session, channel: channel, data: {channelId: msg.channelId, eventName: stateOfX.logEvents.reserved, rawData: {playerName: processAutoSitResponse.player.playerName, chips: processAutoSitResponse.player.chips, seatIndex: processAutoSitResponse.data.seatIndex}}});
//           broadcastHandler.fireSitBroadcast({self: self, channel: channel, player: processAutoSitResponse.player, table: processAutoSitResponse.table});
//           channelTimerHandler.vacantReserveSeat({self: self, channel: channel, session: session, channelId: msg.channelId, playerId: msg.playerId});
//           broadcastHandler.sendMessageToUser({self: self, playerId: msg.playerId, msg: {playerId: msg.playerId, channelId: msg.channelId, event : stateOfX.recordChange.playerJoinTable }, route: stateOfX.broadcasts.joinTableList});
//         } else {
//           if(!!processAutoSitResponse.data && !!processAutoSitResponse.data.isTableFull) {
//             serverLog(stateOfX.serverLogType.response, JSON.stringify({success: false, channelId: msg.channelId, info: 'The table you want to join is already full, choose another.'}));
//             // next(null, {success: false, channelId: msg.channelId, info: 'The table is already full, you can observe or please choose another.'})
//             next(null, {success: false, channelId: (msg.channelId || ""), info: configMsg.AUTOSITFAIL_ENTRYHANDLER, isRetry: false, isDisplay: true})
//           } else {
//             serverLog(stateOfX.serverLogType.response, JSON.stringify(processAutoSitResponse));
//             next(null, processAutoSitResponse);
//           }
//         }
//       });
//     } else {
//       serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
//       next(null, validated);
//     }
//   })
// };

// ### Sit a player ###
// - Create player structure and push in waiting players
// - Validate if game start condition matched

// handler.sitHere = function (msg, session, next) {
//   sessionHandler.recordLastActivityTime({session: session, msg: msg});
//   serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
//   var self = this;
//   keyValidator.validateKeySets("Request", "connector", "sitHere", msg, function (validated){
//     if(validated.success) {

//       var channelId = msg.channelId,
//           playerId  = msg.playerId,
//           chips     = parseInt(msg.chips),
//           seatIndex = parseInt(msg.seatIndex),
//           networkIp = msg.networkIp,
//           channel   = self.app.get('channelService').getChannel(channelId, true);

//       sitHereHandler.processSit({self: self, session: session, channelId: channelId, channel: channel, playerId: playerId, playerName: msg.playerName, imageAvtar: msg.imageAvtar, chips: chips, seatIndex: seatIndex, networkIp: networkIp, isAutoReBuy: msg.isAutoReBuy}, function(processSitResponse) {
//         if(processSitResponse.success) {
//           serverLog(stateOfX.serverLogType.response, JSON.stringify(processSitResponse.response));
//           next(null, processSitResponse.response);
//         } else {
//           serverLog(stateOfX.serverLogType.response, JSON.stringify(processSitResponse));
//           next(null, processSitResponse);
//         }
//       });
//     } else {
//       serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
//       next(null, validated);
//     }
//   })
// };

// ### Player move or actions controller

// handler.makeMove = function (msg, session, next) {
//   if(msg.isRequested === true) {
//     sessionHandler.recordLastActivityTime({session: session, msg: msg});
//   }
//   serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
//   var self            = this,
//     successResponse = {};
//   keyValidator.validateKeySets("Request", self.app.serverType, "makeMove", msg, function (validated){
//     if(validated.success) {

//       var channelId = msg.channelId,
//           channel   = self.app.get('channelService').getChannel(channelId, true);

//       self.app.rpc.database.tableRemote.makeMove(session, msg, function (makeMoveResponse) {
//         if(makeMoveResponse.success) {
//           serverLog(stateOfX.serverLogType.info, 'makeMoveResponse - ' + JSON.stringify(makeMoveResponse))
//           if(channel.channelType === stateOfX.gameType.tournament) {
//             tournamentActionHandler.calculateActivePlayers(self,makeMoveResponse);
//             startTournamentHandler.eliminationProcess(self,makeMoveResponse);
//             startTournamentHandler.sendBountyBroadcast(self,makeMoveResponse);
//             if(!!makeMoveResponse.isBlindUpdated && makeMoveResponse.isBlindUpdated){
//               serverLog(stateOfX.serverLogType.info, 'inside broadcast for makeMoveResponse - ' + makeMoveResponse.isBlindUpdated);
//               var blindUpdateObjectForBroadcast  = {};
//               blindUpdateObjectForBroadcast.data = {
//                 blindTimeRemaining :makeMoveResponse.newBlinds.nextBlindUpdateTime ,
//                 nextBigBlind :makeMoveResponse.newBlinds.bigBlind , 
//                 nextSmallBlind :makeMoveResponse.newBlinds.smallBlind ,
//                 nextAnte :makeMoveResponse.newBlinds.ante,
//                 nextBlindLevel :makeMoveResponse.newBlinds.blindLevel
//               }
//               blindUpdateObjectForBroadcast.data.channelId = channelId;
//               blindUpdateObjectForBroadcast.channel = channel;
//               serverLog(stateOfX.serverLogType.info, 'data in updateBlind Broadcast is ' + blindUpdateObjectForBroadcast);
//               broadcastHandler.updateBlind(blindUpdateObjectForBroadcast); //send broadcast for updateBlind
//             }
//           }
//           // Send broadcast to user if it is tournament
//           successResponse = {success: true, channelId: channelId};

//           keyValidator.validateKeySets("Response", self.app.serverType, "makeMove", successResponse, function (validated){
//             if(validated.success) {
//               // Log this event in Hand history and create dealer chat
//               actionLogger.createEventLog ({self: self, session: session, channel: channel,
//                 data: {channelId: channelId, eventName: stateOfX.logEvents.playerTurn,
//                 rawData: {playerName: makeMoveResponse.turn.playerName, actionName: makeMoveResponse.turn.action, amount: makeMoveResponse.turn.amount}
//               }});

//               actionHandler.handle({self: self, session: session, channel: channel, channelId: channelId, response: makeMoveResponse, request: msg});
//               // broadcastHandler.fireLeaveBroadcast({channel: channel, serverType: "connector", data: {playerId: msg.playerId, channelId: msg.channelId, playerName: "amey", success: true}});
//               serverLog(stateOfX.serverLogType.info, "success response in make move - " + JSON.stringify(successResponse));
//               next(null, successResponse);
//             } else {
//               serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
//               next(null, validated);
//             }
//           });
//         } else {
//           serverLog(stateOfX.serverLogType.response, 'Make move response error - ' + JSON.stringify(makeMoveResponse));
//           if(configConstants.validateGameToPreventLock) {
//             broadcastHandler.fireDealerChat({channel: channel, channelId: channelId, message: ' Error while making move  - ' + JSON.stringify(makeMoveResponse)});
//           }
//           next(null, makeMoveResponse);
//         }
//       });
//     } else {
//       serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
//       next(null, validated);
//     }
//   })
// };

// ### Client-server acknowledgement handler
// MAJOR doubt
// deprecated
var isConnectedDep = function (msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "isConnected", msg, function (validated){
    if(validated.success) {
      self.app.rpc.database.tableRemote.setPlayerAttrib(session, {playerId: msg.playerId, channelId: msg.channelId, key: "state", value: stateOfX.playerState.playing}, function (setPlayerAttribResponse) {
        if(setPlayerAttribResponse.success) {
          keyValidator.validateKeySets("Response", self.app.serverType, "isConnected", setPlayerAttribResponse, function (validated){
            if(validated.success) {
              serverLog(stateOfX.serverLogType.response, JSON.stringify(setPlayerAttribResponse));
              next(null, setPlayerAttribResponse);
            } else {
              serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
              next(null, validated);
            }
          });
        } else {
          serverLog(stateOfX.serverLogType.response, JSON.stringify(setPlayerAttribResponse));
          next(null, setPlayerAttribResponse);
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

// ### Update user profile
// Request : query,updateKeys
// Response : {success: true, info: "user successfully updated"}
handler.updateProfile = function (msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  msg.serverType  = "connector";
  msg.session = session;
  msg.self = this;
  keyValidator.validateKeySets("Request", "connector", "updateProfile", msg, function (validated){
    if(validated.success) {
      updateProfileHandler.updateProfile(msg, function(updateProfileResponse){
        activity.updateProfile(msg,stateOfX.profile.category.profile,stateOfX.profile.subCategory.update,updateProfileResponse,stateOfX.logType.success);
        next(null, updateProfileResponse);
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      activity.updateProfile(msg,stateOfX.profile.category.profile,stateOfX.profile.subCategory.update,validated,stateOfX.logType.error);
      next(null, validated);
    }
  });
};

//### Get player profile
// Request : playerId,keys
// Response : user profile with above keys
handler.getProfile = function(msg, session,next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  keyValidator.validateKeySets("Request", "connector", "getProfile", msg, function (validated){
    if(validated.success) {
      updateProfileHandler.getProfile(msg, function(getProfileResponse) {
        serverLog(stateOfX.serverLogType.response, JSON.stringify(getProfileResponse));
        next(null, getProfileResponse);
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

// ### Leave and Standup handler ###
// Request: {playerId: , channelId: , isStandup: , isRequested: }
// Response: {success: , playerId: , channelId: }
// handler.leaveTable = function (msg, session, next) {
//   if(!!msg.isRequested && msg.isRequested) {
//     sessionHandler.recordLastActivityTime({session: session, msg: msg});
//   }
//   var self            = !!msg.self && msg.self.keepThisApp ? msg.self : this, // keepThisApp: false, if not sure while calling leave
//       app             = !!msg.self && !!msg.self.app ? msg.self.app : globalThis.app,
//       serverId        = app.get('serverId'),
//       msg             = _.omit(msg, 'self'),
//       successResponse = {};

//       self.app        = app; // Assign app to make RPC calls further

//   msg.playerName  = msg.playerName ? msg.playerName : "A player",
//   keyValidator.validateKeySets("Request", app.serverType, "leaveTable", msg, function (validated){
//     if(validated.success) {

//       var playerId  = msg.playerId,
//           channelId = msg.channelId,
//           channel   = app.get('channelService').getChannel(channelId, true);

//       serverLog(stateOfX.serverLogType.info, 'in leaveRemote - ' + JSON.stringify(msg))

//       app.rpc.database.tableRemote.leave(session, msg, function (leaveResponse) {
//         serverLog(stateOfX.serverLogType.info, 'leaveResponse -------> ' + JSON.stringify(leaveResponse))
//         if(leaveResponse.success) {
//           if(!msg.isStandup) {
//             broadcastHandler.sendMessageToUser({self: self, playerId: playerId, msg: {playerId: playerId, channelId: channelId, event : stateOfX.recordChange.playerLeaveTable}, route: stateOfX.broadcasts.joinTableList});
//           }
//           // sent broadcast if player eliminate and it is tournament
//           if(!!leaveResponse.channelType && (leaveResponse.channelType).toUpperCase() === stateOfX.gameType.tournament) {
//             for(var playerIt = 0; playerIt < leaveResponse.tournamentRules.ranks.length; playerIt++) {
//               if(!leaveResponse.tournamentRules.ranks[playerIt].isPrizeBroadcastSent) {
//                 serverLog(stateOfX.serverLogType.info, "creating broadcast data for playerEliminationBroadcast");
//                 var broadcastData = {
//                   self          : self,
//                   playerId      : leaveResponse.tournamentRules.ranks[playerIt].playerId,
//                   tournamentId  : leaveResponse.tournamentRules.ranks[playerIt].tournamentId,
//                   channelId     : leaveResponse.tournamentRules.ranks[playerIt].channelId,
//                   rank          : leaveResponse.tournamentRules.ranks[playerIt].rank,
//                   chipsWon      : leaveResponse.tournamentRules.ranks[playerIt].chipsWon,
//                   route         : "playerElimination"
//                 }
//                 leaveResponse.tournamentRules.ranks[playerIt].isPrizeBroadcastSent = true;
//                 broadcastHandler.firePlayerEliminateBroadcast(broadcastData, function() {
//                   //update values in db of isbroadcastsent and isgiftdistributed
//                   serverLog(stateOfX.serverLogType.info, "`broadcast sent for player elimination in leave`");
//                 });
//               }
//             }
//           }

//           successResponse = {success: true, channelId: channelId};
//           keyValidator.validateKeySets("Response", app.serverType, "leaveTable", successResponse, function (validated){
//             if(validated.success) {
//               channelTimerHandler.killReserveSeatReferennce({playerId: playerId, channel: channel});
//               serverLog(stateOfX.serverLogType.response, JSON.stringify(successResponse));
//               next(null, successResponse);
//               serverLog(stateOfX.serverLogType.info, '------ Leave response sent to requester ' + JSON.stringify(leaveResponse) + ' -------');

//               // Handle this leave event and perform actions after this leave
//               actionLogger.createEventLog ({self: self, session: session, channel: channel, data: {channelId: channelId, eventName: stateOfX.logEvents.leave, rawData: {playerName: msg.playerName}}});
//               actionHandler.handle({self: self, session: session, channel: channel, channelId: channelId, response: leaveResponse, request: msg});

//               // Leave player from channel (not in standup case)
//               if(!msg.isStandup) {
//                 channel.leave(playerId, serverId);
//               }


//               // TODO: Make sure cases before destroying channel, such as player might be in waiting list
//               // for this channel as well


//               var waitingPlayerInChannel = !!channel.waitingPlayers ? channel.waitingPlayers : 0;
//               if(channel.getMembers().length + waitingPlayerInChannel === 0) {
//                 serverLog(stateOfX.serverLogType.error, 'CHANNEL ' + channel.channelName + ' IS GOING TO BE DESTROYED!');
//                 channel.destroy();
//                 serverLog(stateOfX.serverLogType.error, 'CHANNEL HAS BEEN DESTROYED!');
//               }

//             } else {
//               serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
//               next(null, validated);
//             }
//           });
//         } else {
//           serverLog(stateOfX.serverLogType.response, JSON.stringify(leaveResponse));
//           next(null, leaveResponse);
//         }
//       });
//     } else {
//       serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
//       next(null, validated);
//     }
//   })
// };

// ### Handle player chat
// handler.chat = function (msg, session, next) {
//   sessionHandler.recordLastActivityTime({session: session, msg: msg});
//   serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
//   var self = this;
//   keyValidator.validateKeySets("Request", "connector", "chat", msg, function (validated){
//     if(validated.success) {
//       var channel = self.app.get('channelService').getChannel(msg.channelId, true);
//       activity.chat(msg,stateOfX.profile.category.game,stateOfX.game.subCategory.playerChat,stateOfX.logType.info);

//       // TODO: Record last activity of a player through RPC call
//       // params.table.players[params.data.index].activityRecord.lastActivityTime = Number(new Date()); // Record last activity of player

//       //FEATURE: If all in occured on table then do not process chat
//       if(channel.allInOccuredOnChannel) {
//         next(null, {success: true, channelId: msg.channelId, info: "All in occured on table, cannot process player chat at this moment!", isRetry: false, isDisplay: false});
//         return false;
//       }

//       serverLog(stateOfX.serverLogType.info, 'input chat message - ' + msg.message);
//       filterChat.filter(msg.message,function(err,response){
//         if(err){
//           next(null,err);
//         } else{
//           serverLog(stateOfX.serverLogType.info, 'filter chat message - ' + response);
//           broadcastHandler.fireChatBroadcast({channel: channel, channelId: msg.channelId, playerId: msg.playerId, playerName: msg.playerName, message: response});
//           var success = {success: true, channelId: msg.channelId};
//           serverLog(stateOfX.serverLogType.response, JSON.stringify(success));
//           next(null, success);
//         }
//       });
//     } else {
//       serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
//       next(null, validated);
//     }
//   })
// };

// ### Handle sitout in next hand option

// handler.sitoutNextHand = function (msg, session, next) {
//   sessionHandler.recordLastActivityTime({session: session, msg: msg});
//   serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
//   var self = this;
//   keyValidator.validateKeySets("Request", "database", "sitoutNextHand", msg, function (validated){
//     if(validated.success) {
//       var channel   = app.get('channelService').getChannel(msg.channelId, true);
//       self.app.rpc.database.tableRemote.sitoutNextHand(session, msg, function (sitoutNextHandResponse) {
//         serverLog(stateOfX.serverLogType.info, 'Sitout Next Hand response from remote: ' + JSON.stringify(sitoutNextHandResponse));
//         if(sitoutNextHandResponse.success) {
//           keyValidator.validateKeySets("Response", "database", "sitoutNextHand", sitoutNextHandResponse, function (validated){
//             if(validated.success) {
//               serverLog(stateOfX.serverLogType.response, JSON.stringify(sitoutNextHandResponse));
//               next(null, sitoutNextHandResponse);
//               if(sitoutNextHandResponse.state !== stateOfX.playerState.playing)  {
//                 broadcastHandler.firePlayerStateBroadcast({channel: channel, self: self, playerId: msg.playerId, channelId: msg.channelId, state: sitoutNextHandResponse.state});
//               }
//               if(sitoutNextHandResponse.state === stateOfX.playerState.playing && sitoutNextHandResponse.lastMove === stateOfX.move.fold ) {
//                 broadcastHandler.firePlayerStateBroadcast({channel: channel, self: self, playerId: msg.playerId, channelId: msg.channelId, state: sitoutNextHandResponse.state});
//               }
//             } else {
//               serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
//               next(null, validated);
//             }
//           });
//         } else {
//           serverLog(stateOfX.serverLogType.response, JSON.stringify(sitoutNextHandResponse));
//           next(null, sitoutNextHandResponse);
//         }
//       });
//     } else {
//       serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
//       next(null, validated);
//     }
//   })
// };

// ### Handle sitout on next big blind option
// feature removed
var sitoutNextBigBlind = function (msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "database", "sitoutNextBigBlind", msg, function (validated){
    if(validated.success) {
      self.app.rpc.database.tableRemote.sitoutNextBigBlind(session, msg, function (sitoutNextBigBlindResponse) {
        if(sitoutNextBigBlindResponse.success) {
          keyValidator.validateKeySets("Response", "database", "sitoutNextBigBlind", sitoutNextBigBlindResponse, function (validated){
            if(validated.success) {
              serverLog(stateOfX.serverLogType.response, JSON.stringify(sitoutNextBigBlindResponse));
              next(null, sitoutNextBigBlindResponse);
            } else {
              serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
              next(null, validated);
            }
          });
        } else {
          serverLog(stateOfX.serverLogType.response, JSON.stringify(sitoutNextBigBlindResponse));
          next(null, sitoutNextBigBlindResponse);
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

// ### Handle resume player option

// handler.resume = function (msg, session, next) {
//   sessionHandler.recordLastActivityTime({session: session, msg: msg});
//   serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
//   var self = this;
//   keyValidator.validateKeySets("Request", "connector", "resume", msg, function (validated){
//     if(validated.success) {
//       resumeHandler.resume({self: self, channelId: msg.channelId, session: session, request: msg}, function(resumeResponse) {
//         next(null, resumeResponse);
//       });
//     } else {
//       serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
//       next(null, validated);
//     }
//   })
// };

// handler.resumeAll = function(msg, session, next) {
//   sessionHandler.recordLastActivityTime({session: session, msg: msg});
//   serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
//   var self = this;
//   keyValidator.validateKeySets("Request", "connector", "resumeAll", msg, function (validated){
//     if(validated.success) {
//       resumeHandler.resumeAll({self: self, session: session, request: msg}, function(resumeResponse) {
//         next(null, resumeResponse);
//       });
//     } else {
//       serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
//       next(null, validated);
//     }
//   })
// }

// ### Handler to get list of tables on lobby

handler.getLobbyTables = function (msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "getLobbyTables", msg, function (validated){
    if(validated.success) {
      var tempObj = {};
      if(msg.channelVariation == 'All'){
        tempObj = {isActive: true, channelType: !!msg.channelType ? msg.channelType : "NORMAL", isRealMoney: JSON.parse(msg.isRealMoney), playerId : msg.playerId};
      }else{
        tempObj = {isActive: true, channelType: !!msg.channelType ? msg.channelType : "NORMAL", isRealMoney: JSON.parse(msg.isRealMoney), channelVariation : msg.channelVariation, playerId : msg.playerId};
      }
      serverLog(stateOfX.serverLogType.info, "tempObj is in getLobbyTables is in entryHandler is - " + JSON.stringify(tempObj));
      self.app.rpc.database.dbRemote.getTablesForGames(session, tempObj, function (lobbyResponse) {
        serverLog(stateOfX.serverLogType.response, "RESPONSE in getLobbyTables is" + JSON.stringify(lobbyResponse));
        next(null, lobbyResponse);
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

// deprecated
handler.getLobbyTablesForBot = function (msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  var tempObj = {isActive: true, channelType: !!msg.channelType ? msg.channelType : "NORMAL",isRealMoney: {$in : [true,false]}, channelVariation : {$in : ["Texas Hold’em","Omaha Hi-Lo","Omaha"]}, playerId : msg.playerId};
  serverLog(stateOfX.serverLogType.info, "tempObj is in getLobbyTables is in entryHandler is - " + JSON.stringify(tempObj));
  self.app.rpc.database.dbRemote.getTablesForGames(session, tempObj, function (lobbyResponse) {
    serverLog(stateOfX.serverLogType.response, "RESPONSE in getLobbyTables is" + JSON.stringify(lobbyResponse));
    next(null, lobbyResponse);
  });
};

// ### Handler to create tournament table
// tournament
var createTournamentTables = function (msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "createTournamentTables", msg, function (validated){
    if(validated.success) {
      self.app.rpc.database.dbRemote.createTablesForTournament(session, msg, function (lobbyResponse) {
        serverLog(stateOfX.serverLogType.response, JSON.stringify(lobbyResponse));
        next(null, lobbyResponse);
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

// ### Handler to report issue from player
// internally uses feedback function
handler.reportIssue = function (msg, session, next) {
  handler.feedback.call(this, msg, session, next);
  return;
  // sessionHandler.recordLastActivityTime({session: session, msg: msg});
  // serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  // var self = this;
  // keyValidator.validateKeySets("Request", "connector", "reportIssue", msg, function (validated){
  //   if(validated.success) {

  //     msg        = _.omit(msg, '__route__');
  //     msg.token  = Date.now();
  //     msg.status = stateOfX.issueStatus.open;

  //     self.app.rpc.database.dbRemote.reportIssue(session, msg, function (reportIssueResponse) {
  //       serverLog(stateOfX.serverLogType.response, JSON.stringify(reportIssueResponse));
  //       next(null, reportIssueResponse);
  //     });
  //   } else {
  //     serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
  //     next(null, validated);
  //   }
  // })
};

// ### Handler to get issue for player
// deprecated
handler.getIssue = function (msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "getIssue", msg, function (validated){
    if(validated.success) {
      msg = _.omit(msg, '__route__');
      self.app.rpc.database.dbRemote.getIssue(session, msg, function (getIssueResponse) {
        serverLog(stateOfX.serverLogType.response, JSON.stringify(getIssueResponse));
        next(null, getIssueResponse);
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

// ### Join player to similar table
handler.joinSimilarTable = function (msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "joinSimilarTable", msg, function (validated){
    if(validated.success) {
      msg.searchParams.channelType = stateOfX.gameType.normal; // Only get table with NORMAL game
      msg.searchParams.isActive    = true; // Only get tables that are active from dashboard
      self.app.rpc.database.similarTable.searchTable(session, {playerId: msg.playerId, searchParams: msg.searchParams, channelId : msg.channelId}, function (searchTableResponse) {
        serverLog(stateOfX.serverLogType.response, JSON.stringify(searchTableResponse));
        next(null, searchTableResponse);
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

// ### Join a channel as waiting player

// handler.joinWaitingList = function (msg, session, next) {
//   sessionHandler.recordLastActivityTime({session: session, msg: msg});
//   serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
//   var self = this;
//   msg.playerName = !!msg.playerName ? msg.playerName : "Player";
//   keyValidator.validateKeySets("Request", "connector", "joinWaitingList", msg, function (validated){
//     if(validated.success) {
//       var channel = self.app.get('channelService').getChannel(msg.channelId, false);
//       if(!!channel) {
//         self.app.rpc.database.tableRemote.joinQueue(session, {playerId: msg.playerId, channelId: msg.channelId, playerName: msg.playerName}, function (joinQueueResponse) {
//           serverLog(stateOfX.serverLogType.response, JSON.stringify(joinQueueResponse));
//           next(null, joinQueueResponse);
//           if(joinQueueResponse.success) {
//             actionHandler.handleWaitingList({self: self, channel: channel, session: session, channelId: msg.channelId, response: joinQueueResponse, request: msg});
//           }
//         });
//       } else {
//         // var fail = {success: false, channelId: msg.channelId, info: "The table has been never played, cannot join as waiting."}
//         var fail = {success: false, channelId: msg.channelId, info: configMsg.JOINWAITINGLISTFAIL_ENTRYHANDLER, isRetry: false, isDisplay: true}
//         serverLog(stateOfX.serverLogType.response, JSON.stringify(fail));
//         next(null, fail)
//       }
//     } else {
//       serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
//       next(null, validated);
//     }
//   });
// };

// ### Register user for tournament
// tournament
var registerTournament = function(msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg)) ;
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "registerTournament", msg, function (validated) {
    if(validated.success) {
      self.app.rpc.database.tournament.registerTournament(session, {playerId: msg.playerId, tournamentId: msg.tournamentId}, function(registerTournamentResponse) {
        if(registerTournamentResponse.success) {
          serverLog(stateOfX.serverLogType.info, "registerTournamentResponse   --- ",registerTournamentResponse);
          setTimeout(function() {
            tournamentActionHandler.handleRegistration({self: self, session: session, request: msg, response: registerTournamentResponse});
            tournamentActionHandler.handleDynamicRanks ({self: self, session: session, tournamentId: msg.tournamentId, gameVersionCount: msg.gameVersionCount});
            tournamentActionHandler.prizePool({self: self, session: session, tournamentId: msg.tournamentId, gameVersionCount: msg.gameVersionCount});
          },1000);
          tournamentActionHandler.updateChips({self: self, playerId: msg.playerId});
          if(!!registerTournamentResponse.tournamentType && (registerTournamentResponse.tournamentType).toUpperCase() === "SIT N GO") {
            var params = {
              tournamentId: msg.tournamentId,
              serverType: self.app.serverType,
              self : self
            };
            validateTournamentStart(params, function(validateTournamentStartResponse) {
              if(validateTournamentStartResponse.success) {
                tournamentActionHandler.handleTournamentState({self: self, session: session, tournamentId: msg.tournamentId, tournamentState: stateOfX.tournamentState.running });
                serverLog(stateOfX.serverLogType.info+ "tournament is validated now going to changin g its state");
                self.app.rpc.database.tournament.changeStateOfTournament(session, {tournamentId: validateTournamentStartResponse.result.tournamentId, state: stateOfX.tournamentState.running}, function(changeStateOfTournamentResponse) {
                  serverLog(stateOfX.serverLogType.info, "TOURNAMENT State changed response is - " + changeStateOfTournamentResponse);
                  if(changeStateOfTournamentResponse.success){
                    serverLog(stateOfX.serverLogType.info +"state of tournament changed to running");
                  } else {
                    serverLog(stateOfX.serverLogType.info +"unable to change the state of tournament");
                  }
                });
              } else {
                serverLog(stateOfX.serverLogType.info, "tournament is not valid to start");
              }
            });
          }
          var success = {success: true, info: "user registered successfully"};
          serverLog(stateOfX.serverLogType.response, JSON.stringify(success));
          activity.lobbyRegisterTournament(msg,stateOfX.profile.category.lobby,stateOfX.lobby.subCategory.register,success,stateOfX.logType.success);
          next(null, success);
        } else {
          serverLog(stateOfX.serverLogType.response, JSON.stringify(registerTournamentResponse));
          activity.lobbyRegisterTournament(msg,stateOfX.profile.category.lobby,stateOfX.lobby.subCategory.register,registerTournamentResponse,stateOfX.logType.error);
          next(null, registerTournamentResponse);
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      activity.lobbyRegisterTournament(msg,stateOfX.profile.category.lobby,stateOfX.lobby.subCategory.register,validated,stateOfX.logType.error);
      next(null, validated);
    }
  });
};

// ### deRegister user for tournament
// tournament
var deRegisterTournament = function(msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  serverLog(stateOfX.serverLogType.info, "msg is in deRegisterTournament is in entryHandler is - ",JSON.stringify(msg));
  keyValidator.validateKeySets("Request", "connector", "deRegisterTournament", msg, function (validated) {
    if(validated.success) {
      self.app.rpc.database.tournament.deRegisterTournament(session, {playerId: msg.playerId, tournamentId: msg.tournamentId, gameVersionCount: msg.gameVersionCount}, function(deRegisterTournamentResponse) {
        serverLog(stateOfX.serverLogType.response, JSON.stringify(deRegisterTournamentResponse));
        if(deRegisterTournamentResponse.success) {
          setTimeout(function(){
            tournamentActionHandler.handleDeRegistration({self: self, session: session, request: msg, response: deRegisterTournamentResponse});
            tournamentActionHandler.handleDynamicRanks ({self: self, session: session, tournamentId: msg.tournamentId, gameVersionCount: msg.gameVersionCount});
            tournamentActionHandler.prizePool({self: self, session: session, tournamentId: msg.tournamentId, gameVersionCount: msg.gameVersionCount});
          },1000);
          tournamentActionHandler.updateChips({self: self, playerId: msg.playerId});
        }
        activity.lobbyDeRegisterTournament(msg,stateOfX.profile.category.lobby,stateOfX.tournament.subCategory.deRegister,deRegisterTournamentResponse,stateOfX.logType.success);
        next(null, deRegisterTournamentResponse);
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      activity.lobbyDeRegisterTournament(msg,stateOfX.profile.category.lobby,stateOfX.tournament.subCategory.deRegister,validated,stateOfX.logType.error);
      next(null, validated);
    }
  });
};

//### check whether user is registered in tournament or not
//tournament
var isRegisteredUserInTournament = function(msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  serverLog(stateOfX.serverLogType.info, "in isRegisteredUserInTournament in entryHandler","connector");
  keyValidator.validateKeySets("Request", "connector", "isRegisteredUserInTournament", msg, function (validated) {
    if(validated.success) {
      self.app.rpc.database.tournament.isRegisteredUserInTournament(session, {playerId: msg.playerId, tournamentId: msg.tournamentId, gameVersionCount: msg.gameVersionCount}, function(registeredUserResponse) {
        serverLog(stateOfX.serverLogType.response, JSON.stringify(registeredUserResponse));
        next(null, registeredUserResponse);
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

//### handler for start tournament
//tournament
var startTournament = function(msg,session,next) {
  // sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "startTournament", msg, function (validated) {
    if(validated) {
      var params = {tournamentId : msg.tournamentId, gameVersionCount: msg.gameVersionCount, self : self, session : session};
      startTournamentHandler.process(params, function(tournamentStartResponse){
        serverLog(stateOfX.serverLogType.info, "tournament process response" + JSON.stringify(_.keys(tournamentStartResponse)));
        if(tournamentStartResponse.success) {
          // serverLog(stateOfX.serverLogType.response + "tournamnet start response" + JSON.stringify(tournamentStartResponse.result));
          next(null, tournamentStartResponse.result);
        } else {
          serverLog(stateOfX.serverLogType.response, JSON.stringify(tournamentStartResponse));
          next(null, tournamentStartResponse);
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

//### handler for quick seat management for cash games
// msg contains various filters - minBuyIn maxPlayers isRealMoney channelVariation maxPlayers
var quickSeat = function(msg,session,next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "quickSeat", msg, function (validated) {
    if(validated) {
      if(typeof(msg.minBuyIn) !== "number" || typeof(msg.maxPlayers) !== "number"){
        serverLog(stateOfX.serverLogType.response,"invalid big blind or max player type");
        next(null, "invalid big blind or max player type");
      } else{
        var params = {
          isRealMoney: JSON.parse(msg.isRealMoney),
          channelVariation: msg.channelVariation,
          minBuyIn: Number(msg.minBuyIn),
          maxPlayers: Number(msg.maxPlayers),
          channelType: "NORMAL"
        };

        self.app.rpc.database.dbRemote.getQuickSeatTable(session, params, function (quickSeatResponse) {
          serverLog(stateOfX.serverLogType.response, JSON.stringify(quickSeatResponse));
          next(null, quickSeatResponse);
        });
      }
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

//### handler for quick seat management for SIT N GO Tournament
//tournament
var getQuickSeatSitNGo = function(msg,session,next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "quickSeatSitNGo", msg, function (validated) {
    if(validated) {
      if(typeof(msg.minBuyIn) !== "number" || typeof(msg.maxPlayers) !== "number"){
        serverLog(stateOfX.serverLogType.response,"invalid big blind or max player type");
        next(null, "invalid big blind or max player type");
      } else{
        var params = {
          isRealMoney: JSON.parse(msg.isRealMoney),
          channelVariation: msg.channelVariation,
          buyIn: Number(msg.buyIn),
          maxPlayersForTournament: Number(msg.maxPlayersForTournament),
          tournamentType: "SIT N GO"
        };

        self.app.rpc.database.dbRemote.getQuickSeatSitNGo(session, params, function (quickSeatResponse) {
          serverLog(stateOfX.serverLogType.response, JSON.stringify(quickSeatResponse));
          next(null, quickSeatResponse);
        });
      }
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

//### handler for quick seat management for Tournament
//tournament
var getQuickSeatTournament = function(msg,session,next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "quickSeatTournament", msg, function (validated) {
    if(validated) {
      if(typeof(msg.minBuyIn) !== "number" || typeof(msg.maxPlayers) !== "number"){
        serverLog(stateOfX.serverLogType.response,"invalid big blind or max player type");
        next(null, "invalid big blind or max player type");
      } else{
        var params = {
          isRealMoney: JSON.parse(msg.isRealMoney),
          channelVariation: msg.channelVariation,
          buyIn: Number(msg.buyIn),
          maxPlayersForTournament: Number(msg.maxPlayersForTournament),
          tournamentType: msg.tournamentType
        };

        self.app.rpc.database.dbRemote.getQuickSeatSitNGo(session, params, function (quickSeatResponse) {
          serverLog(stateOfX.serverLogType.response, JSON.stringify(quickSeatResponse));
          next(null, quickSeatResponse);
        });
      }
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

// get various filters for quick seat inputs
// for like - turnTime smallBlind bigBlind channelVariation maxPlayers
handler.getFilters = function(msg,session,next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "getFilters", msg, function (validated){
    if(validated.success) {
      getFiltersFromDb.generateResponse(function(result){
        serverLog(stateOfX.serverLogType.response, JSON.stringify(result));
        next(null,result);
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

//### handler for add favourate seat management (Not applicable for any kind of tournament, as in tournament no seat is fixed)
//deprecated
var addFavourateSeat = function(msg,session,next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "addFavourateSeat", msg, function (validated) {
    if(validated) {
      if(msg.favourateSeat.channelId === undefined){
        serverLog(stateOfX.serverLogType.response,"missing channelId");
        // next(null, {success: false, info: "missing channelId"});
        next(null, {success: false, info: configMsg.ADDFAVOURATESEATFAIL_MISSINGCHANNELID_ENTRYHANDLER, isRetry: false, isDisplay: false, channelId: ""});
      } else if(msg.favourateSeat.position === undefined){
        serverLog(stateOfX.serverLogType.response,"missing position");
        // next(null, {success: false, info: "missing position"});
        next(null, {success: false, info: configMsg.ADDFAVOURATESEATFAIL_MISSINGPOSITION_ENTRYHANDLER, isRetry: false, isDisplay: false, channelId: ""});
      } else if(typeof(msg.favourateSeat.position) !== "number"){
        serverLog(stateOfX.serverLogType.response,"invalid position");
        // next(null, {success: false, info: "invalid position"});
        next(null, {success: false, info: configMsg.ADDFAVOURATESEATFAIL_MISSINGPOSITION_ENTRYHANDLER, isRetry: false, isDisplay: false, channelId: "" });
      } else{
        var params = {
          playerId: msg.playerId,
          favourateSeat: {
            channelName: msg.favourateSeat.channelName,
            channelVariation: msg.favourateSeat.channelVariation,
            channelId: msg.favourateSeat.channelId,
            position: JSON.parse(msg.favourateSeat.position)
          }
        };

        self.app.rpc.database.dbRemote.addFavourateSeat(session, params, function (quickSeatResponse) {
          serverLog(stateOfX.serverLogType.response, JSON.stringify(quickSeatResponse));
          next(null, quickSeatResponse);
        });
      }
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

//### handler to remove favourate seat (Not applicable for any kind of tournament, as in tournament no seat is fixed)
//deprecated
var removeFavourateSeat = function(msg,session,next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "removeFavourateSeat", msg, function (validated) {
    if(validated) {
      var params = {
        playerId: msg.playerId,
        channelId: msg.channelId
      };

      self.app.rpc.database.dbRemote.removeFavourateSeat(session, params, function (removeFavourateSeatResponse) {
        serverLog(stateOfX.serverLogType.response, JSON.stringify(removeFavourateSeatResponse));
        next(null, removeFavourateSeatResponse);
      });

    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

//### handler for add favourate table management (records for both normal game or tournament, diffrenciated by type)
handler.addFavourateTable = function(msg,session,next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "addFavourateTable", msg, function (validated) {
    if(validated) {
      if(msg.favourateTable.channelId == undefined){
        // var fail = {success: false, channelId: msg.channelId, info: "missing channelId"}
        var fail = {success: false, channelId: (msg.channelId || ""), info: configMsg.ADDFAVOURATETABLEFAIL_MISSINGCHANNELID_ENTRYHANDLER, isRetry: false, isDisplay: false};
        serverLog(stateOfX.serverLogType.response, JSON.stringify(fail));
        next(null, fail);
      } else if(msg.favourateTable.type == undefined){
        // var fail = {success: false, channelId: msg.channelId, info: "missing position"}
        var fail = {success: false, channelId: (msg.channelId || ""), info: configMsg.ADDFAVOURATESEATFAIL_MISSINGPOSITION_ENTRYHANDLER, isRetry: false, isDisplay: false};
        serverLog(stateOfX.serverLogType.response, JSON.stringify(fail));
        next(null, fail);
      } else if(msg.favourateTable.type == 'TOURNAMENT' || msg.favourateTable.type == 'NORMAL'){
        var params = {
          playerId        : msg.playerId,
          favourateTable  : { type: msg.favourateTable.type, channelId: msg.favourateTable.channelId}
        };

        self.app.rpc.database.dbRemote.addFavourateTable(session, params, function (quickSeatResponse) {
          serverLog(stateOfX.serverLogType.response, JSON.stringify(quickSeatResponse));
          next(null, quickSeatResponse);
        });
      } else{
        serverLog(stateOfX.serverLogType.response,"invalid table type");
        next(null, "invalid table type");
      }
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

//### handler to remove favourate table
handler.removeFavourateTable = function(msg,session,next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "removeFavourateTable", msg, function (validated) {
    if(validated) {
      var params = { playerId: msg.playerId, channelId: msg.channelId};
      self.app.rpc.database.dbRemote.removeFavourateTable(session, params, function (removeFavourateTableResponse) {
        serverLog(stateOfX.serverLogType.response, JSON.stringify(removeFavourateTableResponse));
        next(null, removeFavourateTableResponse);
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

//### handler to update Avg Stack for a table (Not applicable for tournament)
//deprecated - not used from here
var updateStackTable = function(msg,session,next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "updateStackTable", msg, function (validated) {
    if(validated) {
      var params = { id: msg.id, stack: JSON.parse(msg.stack)};
      self.app.rpc.database.dbRemote.updateStackTable(session, params, function (removeFavourateTableResponse) {
        serverLog(stateOfX.serverLogType.response, JSON.stringify(removeFavourateTableResponse));
        next(null, removeFavourateTableResponse);
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

//### handler to update Avg Stack for a tournament room
//tournament
var updateStackTournamentRoom = function(msg,session,next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "updateStackTournamentRoom", msg, function (validated) {
    if(validated) {
      var params = { id: msg.id, stack: JSON.parse(msg.stack)};
      self.app.rpc.database.dbRemote.updateStackTournamentRoom(session, params, function (removeFavourateTableResponse) {
        serverLog(stateOfX.serverLogType.response, JSON.stringify(removeFavourateTableResponse));
        next(null, removeFavourateTableResponse);
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

//### get tournament registered users
//tournament
var getRegisteredTournamentUsers = function (msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "getRegisteredTournamentUsers", msg, function (validated){
    if(validated.success) {
      self.app.rpc.database.tournament.getRegisteredTournamentUsers(session, {playerId: msg.playerId, tournamentId: msg.tournamentId, gameVersionCount: msg.gameVersionCount}, function(tournamentUserResponse) {
        serverLog(stateOfX.serverLogType.response, JSON.stringify(tournamentUserResponse));
        next(null, tournamentUserResponse);
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(validated);
    }
  });
};

//### Add buy in for player on table

// handler.addChipsOnTable = function(msg,session,next) {
//   sessionHandler.recordLastActivityTime({session: session, msg: msg});
//   serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
//   var self = this;
//   keyValidator.validateKeySets("Request", "connector", "addChipsOnTable", msg, function (validated) {
//     if(validated) {
//       var channel = self.app.get('channelService').getChannel(msg.channelId, false);
//       self.app.rpc.database.tableRemote.addChipsOnTable(session, msg, function (addChipsOnTableResponse) {
//         serverLog(stateOfX.serverLogType.response, JSON.stringify(addChipsOnTableResponse));
//         next(null, addChipsOnTableResponse);
//         actionHandler.handleAddChipsEvent({self: self, channel: channel, session: session, channelId: msg.channelId, request: msg, response: addChipsOnTableResponse})
//       });
//     } else {
//       serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
//       next(null, validated);
//     }
//   })
// }

// ### Handle request to get inside table structure to be displayed on lobby
handler.getTable = function (msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "getTable", msg, function (validated){
    if(validated.success) {
      self.app.rpc.database.tableRemote.getTableView(session, {channelId: msg.channelId, playerId: msg.playerId}, function (getTableViewResponse) {
        serverLog(stateOfX.serverLogType.response, JSON.stringify(getTableViewResponse));
        next(null, getTableViewResponse);
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};


// ### Reset sitout options handler
// > When player uncheck any sitout option

// handler.resetSitout = function (msg, session, next) {
//   sessionHandler.recordLastActivityTime({session: session, msg: msg});
//   serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
//   var self = this;
//   keyValidator.validateKeySets("Request", "connector", "resetSitout", msg, function (validated){
//     if(validated.success) {
//       var channel   = app.get('channelService').getChannel(msg.channelId, true);
//       self.app.rpc.database.tableRemote.resetSitout(session, {playerId: msg.playerId, channelId: msg.channelId}, function (resetSitoutResponse) {
//         if(resetSitoutResponse.success) {
//           keyValidator.validateKeySets("Response", self.app.serverType, "resetSitout", resetSitoutResponse.data, function (validated){
//             if(validated.success) {
//               serverLog(stateOfX.serverLogType.response, JSON.stringify(resetSitoutResponse.data));
//               next(null, resetSitoutResponse.data);
//               broadcastHandler.firePlayerStateBroadcast({channel: channel, self: self, playerId: msg.playerId, channelId: msg.channelId, state: resetSitoutResponse.data.state});
//             } else {
//               serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
//               next(null, validated);
//             }
//           });
//         } else {
//           serverLog(stateOfX.serverLogType.info, 'Add player chips broadcast will not be sent !')
//         }
//       });
//     } else {
//       serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
//       next(null, validated);
//     }
//   })
// };

var getTableStructure = function (msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "getTableStructure", msg, function (validated){
    if(validated.success) {
      self.app.rpc.database.tournament.getChannelStructure(session, {tournamentId: msg.tournamentId, gameVersionCount:msg.gameVersionCount}, function (getChannelStructureResponse) {
        serverLog(stateOfX.serverLogType.response, JSON.stringify(getChannelStructureResponse));
        next(null, getChannelStructureResponse);
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

// Update player entities directly from client request
// like - runItTwice
handler.setPlayerValueOnTable = function (msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "setPlayerValueOnTable", msg, function (validated){
    if(validated.success) {
      self.app.rpc.database.requestRemote.setPlayerValueOnTable(session, {channelId: msg.channelId, playerId: msg.playerId, key: msg.key, value: msg.value}, function (setPlayerValueOnTableResponse) {
        serverLog(stateOfX.serverLogType.response, JSON.stringify(setPlayerValueOnTableResponse));
        next(null, setPlayerValueOnTableResponse);
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

// Get Blind Structure
// tournament
var getBlindAndPrize = function (msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "getBlindAndPrize", msg, function (validated){
    if(validated.success) {
      self.app.rpc.database.tournament.getBlindAndPrize(session, {blindRule: msg.blindRule, gameVersionCount: msg.gameVersionCount,prizeRule: msg.prizeRule}, function (response) {
        serverLog(stateOfX.serverLogType.info, "response in getBlindAndPrize is in entryHandler is - ",JSON.stringify(response));
      serverLog(stateOfX.serverLogType.response, JSON.stringify(response));
        next(null, response);
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

// tournament
var getBlindAndPrizeForNormalTournament = function(msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "getBlindAndPrizeForNormalTournament",msg , function (validated){
    if(validated.success) {
      self.app.rpc.database.tournament.getBlindAndPrizeForNormalTournament(session,{tournamentId: msg.tournamentId, noOfPlayers: msg.noOfPlayers},function(response){
      serverLog(stateOfX.serverLogType.response, JSON.stringify(response));
      next(null,response);
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null,validated);
    }
  });
};

// ### Get prize for satellite tournament
// tournament
var getBlindAndPrizeForSatelliteTournament = function(msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "getBlindAndPrizeForSatelliteTournament", msg, function(validated) {
    if(validated.success) {
      self.app.rpc.database.tournament.getBlindAndPrizeForSatelliteTournament(session,{tournamentId: msg.tournamentId, noOfPlayers: msg.noOfPlayers},function(response){
      serverLog(stateOfX.serverLogType.response, JSON.stringify(response));
      next(null,response);
      });
    } else {
      next(null, validated);
    }
  });
};

// Get prize list won by user
// tournament
handler.getPlayerPrize = function(msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "getPlayerPrize", msg, function (validated){
    if(validated.success) {
      self.app.rpc.database.tournament.getPlayerPrize(session, {playerId: msg.playerId}, function (response) {
        serverLog(stateOfX.serverLogType.info, "response in getPlayerPrize is in entryHandler is - ",JSON.stringify(response));
        serverLog(stateOfX.serverLogType.response, JSON.stringify(response));
        next(null, response);
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

// tournament
var collectPrize = function(msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "collectPrize", msg, function (validated){
    if(validated.success) {
      self.app.rpc.database.tournament.collectPrize(session, {playerId: msg.playerId, gameVersionCount: msg.gameVersionCount,tournamentId: msg.tournamentId}, function (response) {
        serverLog(stateOfX.serverLogType.info, "response in collectPrize is in entryHandler is - ",JSON.stringify(response));
        serverLog(stateOfX.serverLogType.response, JSON.stringify(response));
        next(null, response);
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};


// save player notes for other players
// independent of table
//{playerId : "String" ,forPlayerId : "String" ,notes: "String", color: "Object"}
handler.createNotes = function(msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "createNotes", msg, function (validated){
    if(validated.success) {
      self.app.rpc.database.playerNotes.createNotes(session, msg, function (response) {
        serverLog(stateOfX.serverLogType.info, "response in createNotes is in entryHandler is - ",JSON.stringify(response));
        serverLog(stateOfX.serverLogType.response, JSON.stringify(response));
        next(null, response);
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

// update player notes for other players
handler.updateNotes = function(msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "updateNotes", msg, function (validated){
    if(validated.success) {
      self.app.rpc.database.playerNotes.updateNotes(session, msg, function (response) {
        serverLog(stateOfX.serverLogType.info, "response in updateNotes is in entryHandler is - ",JSON.stringify(response));
        serverLog(stateOfX.serverLogType.response, JSON.stringify(response));
        next(null, response);
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

// delete player notes
handler.deleteNotes = function(msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "deleteNotes", msg, function (validated){
    if(validated.success) {
      self.app.rpc.database.playerNotes.deleteNotes(session, msg, function (response) {
        serverLog(stateOfX.serverLogType.info, "response in deleteNotes is in entryHandler is - ",JSON.stringify(response));
        serverLog(stateOfX.serverLogType.response, JSON.stringify(response));
        next(null, response);
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

// fetch player's notes for other players sitting in the room
handler.getNotes = function(msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "getNotes", msg, function (validated){
    if(validated.success) {
      self.app.rpc.database.playerNotes.getNotes(session, msg, function (response) {
        serverLog(stateOfX.serverLogType.info, "response in getNotes is in entryHandler is - ",JSON.stringify(response));
        serverLog(stateOfX.serverLogType.response, JSON.stringify(response));
        next(null, response);
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};

// tournament
var lateRegistration = function(msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "registerTournament", msg, function (validated) {
    if(validated.success) {
      lateRegistrationHandler.process({self: self, session: session, playerId: msg.playerId, tournamentId: msg.tournamentId, gameVersionCount: msg.gameVersionCount}, function(lateRegistrationResponse) {
        tournamentActionHandler.prizePool({self: self, session: session, tournamentId: msg.tournamentId, gameVersionCount: msg.gameVersionCount});
        next(null, lateRegistrationResponse);
      });
    } else {
      next(null, validated);
    }
  });
};

///////////////////////////////////////////////////////////////
// Quick seat in sitNGo                                      //
//{gameVariation, buyIn, turnTime, maxPlayersForTournament } //
///////////////////////////////////////////////////////////////
// tournament
var quickSeatInSitNGo = function(msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "quickSeatInSitNGo", msg, function(validated) {
    if(validated.success) {
      self.app.rpc.database.quickSeat.quickSeatInSitNGo(session, msg, function(response) {
        next(null, response);
      });
    } else {
      next(null, validated);
    }
  });
};

// fetch hand history - from hand tab
// msg contains handHistoryId i.e. unique to every game as well as roundId
handler.getHandHistory = function(msg,session,next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "getHandHistory", msg, function(validated) {
    if(validated.success) {
//      console.error(msg.handHistoryId);
      ///msg.handHistoryId = "59ba7fd4b3ee87a86c39faaf";
      logDB.findOneHandHistory({_id: ObjectID(msg.handHistoryId)}, function(err, handHistoryResponse){
        if(err){
          handHistoryResponse.channelId = msg.channelId;
          next(null, handHistoryResponse);
        } else{
          next(null, {success: true, handHistory: handHistoryResponse, channelId: msg.channelId});
        }
      });
    } else {
      next(null, validated);
    }
  });
};

//////////////////////////////////////////////////////////////////////
// Get hand tab details for hand history, video and community cards //
//////////////////////////////////////////////////////////////////////
handler.getHandTab = function(msg,session,next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "getHandTab", msg, function(validated) {
    if(validated.success) {
      logDB.getHandTab(msg.channelId, function(err, handTabResponse){
        if(err){
          handTabResponse.channelId = msg.channelId;
          next(null, handTabResponse);
        } else{
          _.map(handTabResponse, function(elem){ 
            elem._id = elem._id.toString(); 
            return elem;
          });
          next(null, {success: true, handHistory: handTabResponse.reverse(), channelId: msg.channelId});
        }
      });
    } else {
      next(null, validated);
    }
  });
};

// handler.insertVideoLog = function(msg,session,next) {
//   sessionHandler.recordLastActivityTime({session: session, msg: msg});
//   serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
//   var channel  = this.app.get('channelService').getChannel(msg.channelId, true);
//   keyValidator.validateKeySets("Request", "connector", "insertVideoLog", msg, function(validated) {
//     if(validated.success) {
//       db.insertVideoLog(msg.channelId,msg.roundId,msg.logData, function(err, videoLogResponse){
//         if(err){
//           next(null, videoLogResponse);
//         } else{
//           db.updateHandTab(msg.channelId,msg.roundId,{videoLogId: videoLogResponse.ops[0]._id.toString(),active:true},function(err,response){
//             if(err){
//               // next(null, {success: false, channelId: msg.channelId, info:"video insertion failed"});
//               next(null, {success: false, channelId: msg.channelId, info: configMsg.INSERTVIDEOLOGFAIL_ENTRYHANDLER, isRetry: false, isDisplay: false});
//             } else{
//               broadcastHandler.fireHandtabBroadcast({channel: channel, channelId: msg.channelId, handTab: response.value});
//               next(null, {success: true, channelId: msg.channelId, info:"video added successfully", isRetry: false, isDisplay: false});
//             }
//           });
//         }
//       })
//     } else {
//       next(null, validated);
//     }
//   })
// }

// Quick seat in tournament
//{gameVariation, buyIn, tournamentType, tournamentStartTime }
//tournament
var quickSeatInTournament = function(msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  // msg.timeSpan = 200;
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "quickSeatInTournament", msg, function(validated) {
    if(validated.success) {
      self.app.rpc.database.quickSeat.quickSeatInTournament(session, msg, function(response) {
        next(null, response);
      });
    } else {
      next(null, validated);
    }
  });
};

// getOnlinePlayer - API for first time use to fetch count of online players
handler.getOnlinePlayer = function(msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  onlinePlayers.getOnlinePlayer({self: this}, function(getOnlinePlayerResponse) {
    next(null,getOnlinePlayerResponse);
  });
};

//////////////////////////////////////////////////////////
// ### Send broadcast to any player from client request //
// > Dashboard data change for player                   //
//////////////////////////////////////////////////////////
// this API is used by dashboard
handler.broadcastPlayer = function(msg, session, next) {
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "broadcastPlayer", msg, function (validated){
    if(validated.success) {
      var sessionOnCurrServer = self.app.get('sessionService').getByUid(msg.playerId);
      if(sessionOnCurrServer){
      broadcastHandler.sendMessageToUser({self: self, msg: msg.data, playerId: msg.playerId, route: msg.route});
      } else {
        self.app.rpc.database.dbRemote.findUserSessionInDB(session, msg.playerId, function (response) {
          if(response.success && !!response.result){
            var targetConnServerId = response.result.serverId;
            self.app.rpc.connector.sessionRemote.broadcastPlayer({frontendId: targetConnServerId}, msg, function (result) {
              serverLog(stateOfX.serverLogType.info, 'broadcast to player redirected - '+ JSON.stringify(result));
            });
          }
        });
      }
      next(null, {success: true});
    } else {
      next(null, validated);
    }
  });
};

//////////////////////////////////////////////////////////
// ### Send broadcast to all player from client request //
// > Dashboard data change for table                    //
//////////////////////////////////////////////////////////
// this API is used by dashboard
handler.broadcastPlayers = function(msg, session, next) {
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  serverLog(stateOfX.serverType.info, "in broadcastPlayers in entryHandler "+ JSON.stringify(msg));

  msg = !!msg.__route__ ?  _.omit(msg,"__route__") : msg ;
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "broadcastPlayers", msg, function (validated){
    if(validated.success) {
      broadcastHandler.fireBroadcastToAllSessions({app: self.app, data: msg.data, route: msg.route});
      tournamentActionHandler.sendBroadcastForTournamentStateRegister(self.app, msg);
      next(null, {success: true, data: msg.data});
    } else {
      next(null, validated);
    }
  });
};

//////////////////////////////////////////////////
// Broadcast on channel level at client request //
// > Used for show/hide cards on winning        //
//////////////////////////////////////////////////
// deprecated
handler.channelBroadcastto = function(msg, session, next) {
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  msg = !!msg.__route__ ?  _.omit(msg,"__route__") : msg ;
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "channelBroadcast", msg, function (validated){
    if(validated.success) {
      var channel  = self.app.get('channelService').getChannel(msg.channelId, true);
      msg.data.route = msg.route;
      msg.data.channelId = msg.channelId;
      broadcastHandler.fireChannelBroadcast({channel: channel, data: msg.data, route: msg.route});
      next(null, {success: true, channelId: msg.channelId});
    } else {
      next(null, validated);
    }
  });
};

/////////////////////////////
// Rebuy in tournament     //
//{playerId, tournamentId} //
/////////////////////////////
var rebuyInTournament = function(msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  msg.session = session;
  msg.self    = self;
  keyValidator.validateKeySets("Request", "connector", "rebuyInTournament", msg, function(validated) {
    if(validated.success) {
      rebuyHandler.rebuy(msg, function(rebuyResponse) {
        tournamentActionHandler.prizePool({self: self, session: session, tournamentId: msg.tournamentId, gameVersionCount: msg.gameVersionCount});
        next(null, rebuyResponse);
      });
    } else {
      next(null, validated);
    }
  });
};

/////////////////////////////
// double Rebuy in tournament     //
//{playerId, tournamentId} //
/////////////////////////////
var doubleRebuyInTournament = function(msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  msg.session = session;
  msg.self    = self;
  keyValidator.validateKeySets("Request", "connector", "rebuyInTournament", msg, function(validated) {
    if(validated.success) {
      rebuyHandler.doubleRebuy(msg, function(rebuyResponse) {
        tournamentActionHandler.prizePool({self: self, session: session, tournamentId: msg.tournamentId, gameVersionCount: msg.gameVersionCount});
        next(null, rebuyResponse);
      });
    } else {
      next(null, validated);
    }
  });
};

/////////////////////////////
// Addon in tournament     //
//{playerId, tournamentId, channelId} //
/////////////////////////////
var addOnInTournament = function(msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  msg.session = session;
  msg.self    = self;
  keyValidator.validateKeySets("Request", "connector", "rebuyInTournament", msg, function(validated) {
    if(validated.success) {
      addOnHandler.addOn(msg, function(addOnResponse) {
        serverLog(stateOfX.serverLogType.request, "addon response in entryHandler is - "+ JSON.stringify(addOnResponse));
        next(null, addOnResponse);
      });
    } else {
      next(null, validated);
    }
  });
};

/////////////////////////////
// update auto rebuy in tournament     //
//{playerId, channelId, isAutoRebuy} //
/////////////////////////////
var updateAutoRebuy = function(msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  msg.session = session;
  msg.self    = self;
  keyValidator.validateKeySets("Request", "connector", "updateAutoRebuy", msg, function(validated) {
    if(validated.success) {
      rebuyHandler.updateAutoRebuy(msg, function(updateAutoRebuyResponse) {
        serverLog(stateOfX.serverLogType.request, "updateAutoRebuyin entryHandler is - "+ JSON.stringify(updateAutoRebuyResponse));
        next(null, updateAutoRebuyResponse);
      });
    } else {
      next(null, validated);
    }
  });
};


///////////////////////////
//update auto rebuy in tournament     //
//{playerId, channelId, isAutoAddOn} //
///////////////////////////
var updateAutoAddon = function(msg, session, next) {
  console.log("Inside updateAutoAddon");
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  msg.session = session;
  msg.self    = self;
  keyValidator.validateKeySets("Request", "connector", "updateAutoAddon", msg, function(validated) { //validate keys in file keyConfig file
    if(validated.success) {
      addOnHandler.updateAutoAddon(msg, function(updateAutoAddonResponse) {
        serverLog(stateOfX.serverLogType.request, "updateAutoAddonin entryHandler is - "+ JSON.stringify(updateAutoAddonResponse));
        next(null, updateAutoAddonResponse);
      });
    } else {
      next(null, validated);
    }
  });
};





/////////////////////////////////////////
// ### Log out player from the game:   //
// - Remove from all tables and        //
// - kill player's session from pomelo //
// Request: {playerId: }               //
/////////////////////////////////////////

handler.logout = function(msg, session, next) {
  // sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request,JSON.stringify(msg));
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  serverLog(stateOfX.serverLogType.request,'msg in entryHandler in logout is - ' + JSON.stringify(msg));
  var self = this;
  msg.session = session;
  msg.self    = self;
  keyValidator.validateKeySets("Request", "connector", "logout", msg, function(validated) {
    if(validated.success) {
      logoutHandler.logout(msg, function(logoutResponse) {
        next(null, logoutResponse);
        onlinePlayers.processOnlinePlayers({self: self});
      });
    } else {
      next(null, validated);
    }
  });
};

// // get video
// //{videoId, playerId}
// handler.getVideo = function(msg, session, next) {
//   sessionHandler.recordLastActivityTime({session: session, msg: msg});
//   serverLog(stateOfX.serverLogType.request,JSON.stringify(msg));
//   serverLog(stateOfX.serverLogType.request,'msg in entryHandler in getVideo is - ' + JSON.stringify(msg));
//   keyValidator.validateKeySets("Request", "connector", "getVideo", msg, function(validated) {
//     if(validated.success) {
//       videoHandler.getVideoData(msg, function(videoResponse) {
//         next(null, videoResponse);
//       })
//     } else {
//       next(null, validated);
//     }
//   })
// }


// leave tournament
// Request: {playerId: , channelId: }
// Response: {success: , playerId: , channelId: }
var leaveTournament = function(msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request,JSON.stringify(msg));
  serverLog(stateOfX.serverLogType.request,'msg in entryHandler in leaveTournament is - ' + JSON.stringify(msg));
  msg.self = this;
  keyValidator.validateKeySets("Request", "connector", "leaveTournament", msg, function(validated) {
    if(validated.success) {
      tournamentLeaveHandler.leaveProcess(msg, function(leaveResponse) {
        next(null, leaveResponse);
      });
    } else {
      next(null, validated);
    }
  });
};



// ### Unjoin waiting list: Remove player from queue

// handler.leaveWaitingList = function(msg, session, next) {
//   sessionHandler.recordLastActivityTime({session: session, msg: msg});
//   serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
//   var self = this;
//   keyValidator.validateKeySets("Request", "connector", "leaveWaitingList", msg, function (validated){
//     if(validated.success) {
//       var channel = self.app.get('channelService').getChannel(msg.channelId, false);
//       if(!!channel) {
//         self.app.rpc.database.requestRemote.removeWaitingPlayer(session, {playerId: msg.playerId, channelId: msg.channelId, playerName: msg.playerName}, function (leaveWaitingResponse) {
//             serverLog(stateOfX.serverLogType.response, 'leaveWaitingResponse - ' + JSON.stringify(leaveWaitingResponse));
//             if(!!leaveWaitingResponse.data) {
//               next(null, leaveWaitingResponse.data);
//             } else {
//               next(null, leaveWaitingResponse);
//             }
//             if(leaveWaitingResponse.success) {
//               actionHandler.handleLeaveWaitingList({self: self, channel: channel, session: session, channelId: msg.channelId, request: msg, response: leaveWaitingResponse});
//             }
//         });
//       } else {
//         // var fail = {success: false, channelId: msg.channelId, info: "The table has been never played, cannot remove from waiting."}
//         var fail = {success: false, channelId: msg.channelId, info: configMsg.LEAVEWAITINGLISTFAIL_ENTRYHANDLER, isRetry: false, isDisplay: true}
//         serverLog(stateOfX.serverLogType.response, JSON.stringify(fail));
//         next(null, fail)
//       }
//     } else {
//       serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
//       next(null, validated);
//     }
//   });
// }

// API - for cashier button from game lobby
// fetch various details about player's account details
handler.getCashDetails = function (msg, session, next) {
  var self = this;
  self.app.rpc.database.userRemote.getCashDetails(session, {playerId: msg.playerId}, function (response) {
    var channels = session.get('channels');
    if (channels.length <=0) {
      next(null, response);
    } else {
      self.app.rpc.database.tableRemote.getTotalGameChips(session, {playerId: msg.playerId, channels: channels}, function (res) {
        response.result.inGameRealChips = (res ? res.realChips : 0)||0;
        response.result.totalRealChips = response.result.inGameRealChips + response.result.realChips;
        response.result.inGameFreeChips = (res ? res.playChips : 0)||0;
        response.result.totalFreeChips = response.result.inGameFreeChips + response.result.freeChips;
        next(null, response);
      });
    }
  });
};

// API - used in website, called via dashboard
// fetch bonus data details for player
handler.getBonusHistory = function (msg, session, next) {
  var self = this;
  db.findBounsData({playerId: msg.playerId}, function (err, user) {
    if (err || !user) {
      next(null, {success: false, info:'db query failed'});
    } else {
      next(null, {success: true, result: user.bonus});
    }
  });
};

// drops a mail to support staff - at configConstants.feedbackMail
// used from feedback inside game - option near by dealer chat
handler.feedback = function (msg, session, next) {
  var self = this;
  self.app.get('devMailer').sendToAdmin(Object.assign({}, (msg ? msg.data && {data: msg.data} : {}), (msg ? msg.issue && {issue: msg.issue} : {}), {playerId: msg.playerId, timestamp: new Date()}), configConstants.feedbackMail || 'support@creatiosoft.com', 'Feedback from user');
  next(null, {success: true, info: 'feedback received succefully.'});
};


// ### Set table level settings by players
// > Get key: value from client and save in settings.key: value
// > in spectator collection of inMemory databse
// > response true/false to client as response

handler.updateTableSettings = function(msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var settings = {};
  try {
    msg.value = JSON.parse(msg.value);
  } catch (e) {
    // do nothing
    msg.value = msg.value;
  }
  settings["settings."+msg.key]  =  msg.value;

  imdb.updatePlayerSetting({channelId : msg.channelId, playerId : msg.playerId}, {$set : settings}, function (err, result){
    if(err){
      serverLog(stateOfX.serverLogType.response, JSON.stringify(err));
      next(null, {success: false, info: dbConfigMsg.dbQyeryInfo.DB_PLAYER_TABLESETTING_UPDATE_FAIL, isRetry: false, isDisplay: false, channelId: (msg.channelId || "")});
    } else{
      if(msg.key == 'tableColor'){
        handler.updateProfile({"query":{"playerId":msg.playerId},"updateKeys":{"settings.tableColor":msg.value}}, session, function (err, res) {
          // also tableColor changed for global
        });
      }
      serverLog(stateOfX.serverLogType.response, JSON.stringify(result));
      next(null, {success: true, channelId : msg.channelId});
    }
  });
};

// cashout request by player from game build
// msg contains playerId, realChips
handler.cashOutForPlayerAffilate = function(msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "cashOutForPlayerAffilate", msg, function(validated) {
    if(validated.success) {
       self.app.rpc.database.cashOutForPlayer.processCashout(session, msg, function (res) {
        //console.error(res);
        //broadcastHandler.sendMessageToUser({self: self, playerId: msg.playerId, msg: {realChips:res.playerChips}, route: "updateProfile"});
          commonHandler.broadcastChips({self: self, playerId: msg.playerId});
          // commonHandler.sendCashoutSms({userName: res.affUsername, mobileNumber: res.affMobileNo, cashOutAmount: res.cashOutAmount})
          next(null, {success: res.success, info: res.info, isRetry: false, isDisplay: true});
        });
    } else {
      next(null, validated);
    }
  });
  // imdb.updatePlayerSetting({channelId : msg.channelId, playerId : msg.playerId}, {$set : settings}, function (err, result){
  //   if(err){
  //     serverLog(stateOfX.serverLogType.response, JSON.stringify(err));
  //     next(null, {success: false, info: dbConfigMsg.dbQyeryInfo.DB_PLAYER_TABLESETTING_UPDATE_FAIL, isRetry: false, isDisplay: false, channelId: (params.channelId || "")});
  //   } else{
  //     serverLog(stateOfX.serverLogType.response, JSON.stringify(result));
  //     activity.updateTableSettings(msg,stateOfX.profile.category.game,stateOfX.game.subCategory.updateTableSettings,stateOfX.logType.success,session.settings.playerName);
  //     next(null, {success: true, channelId : msg.channelId});
  //   }
  // });
};

// hanlder request refresh token
handler.updateAccessTokenForSession = function(msg, session, next) {
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "acessToken", msg, function(validated) {
    if(validated.success) {
        //set access_token in message to use msg.access_token
      self.session.set("accessToken",msg.access_token);
      self.session.push("accessToken",function (err){
        if(err) {
          serverLog(stateOfX.serverLogType.error, 'set accessToken for session service failed! error is : %j', err.stack);
          next(null, {success: false, info:'set accessToken for session service failed. Please check server log!', stack: JSON.stringify(err.stack)});
          return false;
        } else {
          serverLog(stateOfX.serverLogType.error, 'set accessToken for session service successfully');
          next(null, {success: true, info:'set accessToken for session service successfully'});
          return true;
        }
      });
    } else {
      next(null, validated);
    }
  });  
};

// ### <<<<<<<<<<<<<<<<<<< HANDLERS DEPOSIT >>>>>>>>>>>>>>>>>>>>>>
var processDeposit = function (msg, session, next) {
  console.log("handler.processDeposit was called 0000");
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;

  console.log("handler.processDeposit was called");
  keyValidator.validateKeySets("Request", "connector", "depositInfo", msg, async function(validated) {
    if(validated.success) { 
      console.log("passed validateKeySets");
      const transactionId= msg.transactionId;
      
      
      // const walletTransactions_id = transactionData.tx_hash;
      const userName = msg.userName;
      
        // transactionId, user id, AdaAmount, c4Amount
      const txData = {
        transactionId: "",
        userId: "",
        amount: "",
        userName: "",
        name: "",
        date:"",
        referenceNo: "",
        transferMode: "",
        amount: msg.amount,
        invoiceId: "",
      };
      db.findUser({userName}, function (err, user) {
        if (err || !user) {
          next(null, {success: false, info:'db query failed'});
        } else {
          // console.log(JSON.stringify(user));
          txData.userId = user._id;
          txData.userName = user.userName;
          txData.name = `${user.firstName} ${user.lastName}`;
          txData.transactionId = transactionId;
          txData.date = Number(new Date());
          txData.transferMode = 'Lightning Deposit';
          txData.invoiceId = msg.id;
          txData.Name= `${user.firstName} ${user.lastName}`;
          txData.loginId= user.userName;
          txData.date= Number(new Date());
          txData.referenceNumber= transactionId;
          txData.paymentId= 'N/A';
          txData.bonusCode= 'N/A';
          txData.bonusAmount= 'N/A';
          txData.approvedBy= 'N/A';
          txData.transactionType= 'Deposit';
          txData.loginType= user.userName+"/PLAYER";
          txData.status= 'SUCCESS';
          txData.megaPointLevel= user.megaPointLevel;
          txData.megaPoints= user.megaPoints;           
          
          adminDBquery.getTransactionHistoryCount( { transactionId }, function (err, count) {
            if (err || isNaN(count) ) {
              console.log("Failed to count");
              next(null, {success: false, info:'db query failed 1'});
            } 
            else {
              if (count > 0) {
                console.log("Already exists");
                // db.findTransaction( {transactionId}, function (err, tx) {
                //   if (err || !tx) {
                //     // next(null, {success: false, info:'db query failed'});
                //     console.log('db query failed');
                //   } else {
                //     console.log(JSON.stringify(tx));
                //   }
                // });
                // next(null, {success: true, result: `TransactionHistory with this ${transactionId} already exists`});
              }
              else {
                db.updatePlayerInstantChips( { userName },
                  { $inc: { "realChips" : txData.amount } }, function (err, newUser) {
                    if (err || !newUser) {
                      next(null, {success: false, info:'db query failed'});
                    } else {
                      
                      console.log("update realChips successfully");
                      //create passbook
                      const query = { playerId: newUser.playerId };
                      const passbookData = {};
                      passbookData.time= Number(new Date());
                      passbookData.prevAmt = user.realChips;
                      passbookData.amount = txData.amount;
                      passbookData.newAmt = newUser.realChips;
                      passbookData.category= "Deposit";
                      passbookData.subCategory= "";
                      adminDBquery.createPassbookEntry(query, passbookData, function (err, result) {
                        if (err || !result) {
                          console.log("createPassbookEntry failed");
                          // next(null, {success: false, info:'db query failed'});
                          
                        } 
                        else {
                          console.log("createPassbookEntry successfully");
                          
                          // next(null, {success: true, result});
                        }
                      });
                      adminDBquery.createDepositHistory( txData, function (err, transaction) {
                        if (err || !transaction) {
                          next(null, {success: false, info:'db query failed'});
                        } else {
                          console.log(JSON.stringify(transaction));
                          console.log("update transaction successfully");
                          // db.findTransaction( {transactionId}, function (err, tx) {
                          //   if (err || !tx) {
                          //     // next(null, {success: false, info:'db query failed'});
                          //     console.log('db query failed');
                          //   } else {
                          //     console.log(JSON.stringify(tx));
                          //   }
                          // });
                          console.log(JSON.stringify(newUser))
                          broadcastHandler.sendMessageToUser({self: self, msg: {playerId: newUser.playerId, updated:{realChips:newUser.realChips}}, playerId: newUser.playerId, route: 'updateProfile'});
                          // next(null, {success: true, result: transaction});
                        }
                      });
                    }
                  });

                console.log("No exist");
                
                next(null, {success: true, result: "No exist"});
              }   
            }
          });          
          next(null, {success: true, result: user.realChips});
        }
      });
    
     
    }
    else {
      next(null, validated);
    }
  });
 
  //update userchips 

};

handler.depositInfo = function (msg, session, next) {
  console.log("in depositInfo");
  sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;

  console.log("handler.depositInfo was called");
  keyValidator.validateKeySets("Request", "connector", "depositInfo", msg, async function(validated) {
    if (validated.success) { 
      console.log("passed validateKeySets");
      const transactionId = msg.transactionId;
      // next(null, {success: true, info:'We are processing your deposit transaction'})
      // username, amount
      // create invoice

      let invoiceRequest;

      const dataToSend = {
        amount: msg.amount
      }

      console.log("qua day create Invoice")

      requestData("POST", "/api/lnd/CreateInvoice", dataToSend).then((response) => {
        console.log(`response: , ${JSON.parse(response.result).data.id}`);
        invoiceRequest = JSON.parse(response.result).data;
        //createInvoice
        db.findUser({ userName: msg.userName }, function (err, user) {
          if (!err && user) {
            adminDBquery.createInvoice({
              userId: user._id,
              userName: user.userName,
              amount: msg.amount,
              date: invoiceRequest.date,
              invoiceId: invoiceRequest.id,
              paymentRequest: invoiceRequest.request,
              status: "pending",
              createdAt: Number(new Date())
            }, function (err, result) {
              console.log("result ==> ", result);
              
            })
            let intervalId;

            console.log(`idInvoice: ${invoiceRequest}`);

            intervalId = setInterval(() => {
              requestData("GET", `/api/lnd/GetInvoiceById/${invoiceRequest.id}`, {}).then((response) => {
                console.log(`response getInvoice , ${JSON.parse(response.result).data.is_confirmed}`);
                
                let isInvoiceId = JSON.parse(response.result).data.is_confirmed;
                if (isInvoiceId == true) {
                  adminDBquery.updateInvoiceStatus({ invoiceId: invoiceRequest.id }, { status: "confirmed" }, function (err, result) {
                    console.log(`resultUpdateInvoiceStatusConfirm: ${result}`);
                    if (!err) {
                      //process Deposit
                      invoiceRequest.userName = user.userName;
                      invoiceRequest.transactionId = invoiceRequest.id;
                      invoiceRequest.amount = msg.amount;
                      processDeposit(invoiceRequest, session, next);
                    }
                  });
                  clearInterval(intervalId);
                }
                let isCancelled = JSON.parse(response.result).data.is_canceled;
                if (isCancelled) {
                  adminDBquery.updateInvoiceStatus({ invoiceId: invoiceRequest.id }, { status: "cancelled" }, function (err, result) {
                    console.log(`resultUpdateInvoiceStatusCancel: ${result}`);
                    if (!err) {
                      //process Deposit
                      invoiceRequest.userName = user.userName;
                      invoiceRequest.transactionId = transactionId;
                      // processDeposit(invoiceRequest, session, next);
                    }
                  });
                  clearInterval(intervalId);
                }
              }).catch((error) => {
                console.error(error);
                next(null, {
                  success: false
                });
              })
              
            }, 10 * 1000);
          }
        })
        next(null, {
          success: true, result: {
            chain_address: invoiceRequest.chain_address,
            created_at: invoiceRequest.created_at,
            description: invoiceRequest.description,
            id: invoiceRequest.id,
            mtokens: invoiceRequest.mtokens,
            payment: invoiceRequest.payment,
            request: invoiceRequest.request,
            secret: invoiceRequest.secret,
            tokens: invoiceRequest.tokens
          },
          message: "Create invoice successfully"
        });
      }).catch((error) => {
        console.error(error);
      })

      

    }
    else {
      next(null, validated);
    }
  });
 
  //update userchips 

};

handler.processWithdraw = function (msg, session, next) {
  // sessionHandler.recordLastActivityTime({session: session, msg: msg});
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  var self = this;
  
  keyValidator.validateKeySets("Request", "connector", "processWithdraw", msg, function(validated) {
    if(validated.success) {
     self.app.rpc.database.withdrawRemote.processWithdraw(session, msg, function (res) {
      //console.error(res);
      //broadcastHandler.sendMessageToUser({self: self, playerId: msg.playerId, msg: {realChips:res.playerChips}, route: "updateProfile"});
       db.findUser({ userName: msg.userName }, function (err, user) {
         if (err || !user) {
           next(null, { success: false, info: 'db query failed' });
         } else {
           if (res.success) {
            commonHandler.broadcastWithdrawChips({ self: self, playerId: user.playerId, withdrawAmount: msg.amount });
           }
           
           console.log("-----------------------------------------processWithdraw-------------------------------------");
           console.log(JSON.stringify({ success: res.success, info: res.info, isRetry: false, isDisplay: true }))
           console.log("-----------------------------------------processWithdraw-------------------------------------");
          next(null, { success: res.success, info: res.info, isRetry: false, isDisplay: true });  
            
          //  commonHandler.broadcastChips({ self: self, playerId: user.playerId });
           // commonHandler.sendCashoutSms({userName: res.affUsername, mobileNumber: res.affMobileNo, cashOutAmount: res.cashOutAmount})
           
         }
       });
      });
    } else {
    next(null, validated);
    }
  });
};

// ### <<<<<<<<<<<<<<<<<<< HANDLERS CASHGAME PRIVATE TABLE >>>>>>>>>>>>>>>>>>>>>>

handler.createPrivateTable = function (msg, session, next) {
  console.log("inside createPrivateTable");
  console.log(`=============Data========== ${JSON.stringify(msg)}`);

  var self = this;
  const antiBankingTime = 900;
  var buyInStr = "\nBuy In : (" + msg.minBuyIn + "/" + msg.maxBuyIn + ")";
  var potLimitInfo = (msg.isPotLimit == "true") ? ("Pot Limit") : ("No Limit");
  let rakeStr1 = "";
  let rakeStr2 = "";
  let rakeStr3 = "";
  var rakeToDisplay = "";

  if (msg.maxPlayers >= 2) {
    rakeStr1 = "Rake                      : " + addTableConfig.rakePercentMoreThanFive + '%';
    rakeStr3 = "\nRake (3-4 Players)        : " + addTableConfig.rakePercentThreeFour + '%';
    rakeToDisplay = addTableConfig.rakePercentMoreThanFive;
  } else {
    next(null, { success: false });
  }

  rakeStr2 = "Rake(Heads Up)   : " + addTableConfig.rakePercentTwo;

  db.findUser({ userName: msg.userName }, function (err, result) {
    if (!err) {
      db.countTable({ userId: ObjectID (result._id) }, function (err, response) {
        console.log(`response: , ${JSON.stringify(response)}`);
        if (response >= 5) {
          next(null, { success: false, info: 'you can\'t create table anynore as you have reached your limit' });
        } else {
          var tableData = {
          isActive: addTableConfig.isActive,
          channelType: 'NORMAL',
          isPotLimit: true, //----
          isRealMoney: true,
          totalGame: 0,
          totalPot: 0,
          avgPot: 0,
          totalPlayer: 0,
          totalFlopPlayer: 0,
          avgFlopPercent: 0,
          totalStack: 0,
          createdAt: new Date(),
          rake: {
            rakePercentTwo: addTableConfig.rakePercentTwo,
            rakePercentThreeFour: addTableConfig.rakePercentThreeFour,
            rakePercentMoreThanFive: addTableConfig.rakePercentMoreThanFive,
            capTwo: addTableConfig.capTwo,
            capThreeFour: addTableConfig.capThreeFour,
            capMoreThanFive: addTableConfig.capMoreThanFive,
            minStake: JSON.parse(msg.smallBlind),
            maxStake: JSON.parse(msg.bigBlind)
          },
          smallBlind: JSON.parse(msg.smallBlind),
          bigBlind: JSON.parse(msg.bigBlind),
          channelVariation: msg.gameVariation,
          maxPlayers: JSON.parse(msg.maxPlayers),
          minBuyIn: JSON.parse(msg.minBuyIn),
          maxBuyIn: JSON.parse(msg.maxBuyIn),
          isStraddleEnable: msg.isStraddleEnable,
          turnTime: addTableConfig.turnTime,
          isPrivateTabel: true,
          isRunItTwice: addTableConfig.isRunItTwice,
          passwordForPrivate: msg.passwordForPrivate,
          gameInfoString: "Table Name : " + msg.tableName + '\nGame Variation : ' + msg.gameVariation + '\nChips Type : ' + ((addTableConfig.isRealMoney === true) ? ("Real Money") : ("Play Money")) + buyInStr + '\nStakes : ' + potLimitInfo + '(' + msg.smallBlind + '/' + msg.bigBlind + ')\n' + rakeStr1 + '\n' + rakeStr2 + rakeStr3 + '\nMax. Players : ' + msg.maxPlayers + '\nStraddle : ' + ((addTableConfig.isStraddleEnable === true) ? ("Straddle Mandatory") : ("Straddle Optional")) + '\nTurn Time : ' + addTableConfig.turnTime,
          gameInfo: {
            TableName: msg.tableName,
            GameVariation: msg.gameVariation,
            ChipsType: addTableConfig.ChipsType,
            BuyIn: `${msg.maxBuyIn}/${msg.maxBuyIn}`,
            Stakes: msg.Stakes,
            Rake: new Date(),
            'Rake(3-4Players)': `${addTableConfig.rakePercentThreeFour}%`,
            'Rake(HeadsUp)': `${addTableConfig.rakePercentTwo}%`,
            CapAmount: Math.max(addTableConfig.capTwo, addTableConfig.capThreeFour, addTableConfig.capMoreThanFive),
            MaxPlayers: JSON.parse(msg.maxPlayers),
            Straddle: addTableConfig.Straddle,
            TurnTime: addTableConfig.turnTime,
            'Anti-Banking': `${antiBankingTime / 60} min.`
          },
          numberOfRebuyAllowed: addTableConfig.numberOfRebuyAllowed,
          rebuyHourFactor: addTableConfig.rebuyHourFactor,
          hourLimitForRebuy: addTableConfig.hourLimitForRebuy,
          gameInterval: addTableConfig.gameInterval,
          minPlayers: addTableConfig.minPlayers,
          favourite: addTableConfig.favourite,
          createdBy: result.userName || "",
          userId: result._id || "",
          blindMissed: addTableConfig.blindMissed,
          channelName: msg.tableName,
        };
      
        db.createTable('tables', tableData, function (err, result) {
          if (!err && result) {
            tablePrivateRemote.informPlayer(result,self.app, function (err, response) {
              console.log(`result=====11----, ${JSON.stringify(response)}`);
              if (response.success === true) {
                next(null, { success: true, info: 'create new table successfully' });
              } else {
                next(null, { success: false, info: 'create new table failed' });
              }
            })
          } else {
            next(null, { success: false, info: 'create new table failed' });
          }
        });
        }
     
        
      })
    } else {
      next(null, { success: false });
    }
  })


};

handler.updatePrivateTable = function (msg, session, next) {
  console.log("inside updatePrivatetable");
  console.log(`=============Data========== ${JSON.stringify(msg)}`);

  let params = { ...msg };
  var tableData = {};

  db.findSpecificTable({ createdBy: msg.userName, _id: ObjectID(msg._id) }, function (err, result) {
    if (!err && result) {
      tablePrivateRemote.updateTable(params, tableData, function (err, response) {
        if (response.success) {
          next(null, { success: true, info: 'update table successfully' });
        } else {
          next(null, { success: false, info: 'update table failed' });
        }
      })
    } else {
      next(null, { success: false, info: 'update table failed' });
    }
  })

};

handler.deletePrivateTable = function (msg, session, next) {
  console.log("inside deletePrivateTable");
  console.log(`=============Data========== ${JSON.stringify(msg)}`);

  db.findSpecificTabl({ createdBy: msg.userName, _id: ObjectID(msg.tableId) }, function (err, result) {
    if (!err && result) {
      db.removeTable(msg._id, function (err, result) {
        if (!err && result) {
          next(null, { success: true, info: 'delete table successfully' });
        } else {
          next(null, { success: false, info: 'delete table failed' });
        }
      });
    } else {
      next(null, { success: false, info: 'delete table failed' });
    }
  })
}

handler.getAllPrivateTable = function (msg, session, next) {
  console.log("inside getAllPrivateTable");
  console.log(`=============Data========== ${JSON.stringify(msg)}`);

  db.findTable({ userId: ObjectID(msg.userId), skip: msg.skip, limit: msg.limit }, function (err, result) {
    if (!err && result) {

      tablePrivateRemote.checkActionTable(result, function (err, response) {
        if (response.length > 0) {
          next(null, { success: true, data: response });
        }
      })

    } else {
      next(null, { success: false });
    }
  });
}

handler.getPrivateTableWithUserId = function (msg, session, next) {
  console.log("inside getPrivateTableWithUserId");
  console.log(`=============Data========== ${JSON.stringify(msg)}`);

  db.findSpecificTable({ userId: ObjectID(msg.userId), _id: ObjectID(msg.tableId) }, function (err, result) {
    if (!err && result) {
      next(null, { success: true, data: result });
    } else {
      next(null, { success: false });
    }
  });
}

// ### <<<<<<<<<<<<<<<<<<< HANDLERS BLOCK FINISHED >>>>>>>>>>>>>>>>>>>>>>


// ### <<<<<<<<<<<<<<<<<<< START SCHEDULER SERVICES BEGINS >>>>>>>>>>>>>>>>>>>>>>

// var schStartedTimerReference = null;
// function startScheduledWatchers() {
//   schStartedTimerReference = setTimeout(function(){
//     if(!!globalThis && globalThis.app.get("serverType") === "connector") {
//       console.log("Starting scheduler for auto logout watchers.");
//       clearTimeout(schStartedTimerReference);
//       schStartedTimerReference = null
      

//       // Start checking idle sessions on pomelo and clear after a pre-defined time
//       if(!app.get('autologoutWatcher')) {
//         app.set('autologoutWatcher', true);
//         serverLog(stateOfX.serverLogType.info, 'Starting auto logout watcher!');
//         autoLogOutSchedular.checkAutoLogOut({handler: handler, globalThis: globalThis});
//       } else {
//         serverLog(stateOfX.serverLogType.info, 'Auto logout watcher has been already started!');
//       }

//       // Start checking idle player removal from table
//       // if(!app.get('idlePlayerWatcherStarted')) {
//       //   serverLog(stateOfX.serverLogType.info, 'Starting idle players watcher!');
//       //   app.set('idlePlayerWatcherStarted', true);
//       //   if(configConstants.removeIdleGamePlayers) {
//       //     idlePlayersHandler.process({handler: handler, globalThis: globalThis})
//       //   }
//       // } else {
//       //   serverLog(stateOfX.serverLogType.info, 'Idle players watcher has been already started!');
//       // }

//     }
//   }, parseInt(configConstants.startSchedulerServices)*1000);
// }

// handler.dynamicBounty = function(msg, session, next) {
//   console.log("Inside calculateDynamicBounty the msg is ", msg);
//   //serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
//   //var self = this;
//   //msg.session = session;
//   // msg.self    = self;
//   calculateDynamicBountyHandler.calculateDynamicBounty(msg, function(dynamicBountyResponse) {
//         console.log("dynamic bounty response is ",dynamicBountyResponse);
//         next(null, dynamicBountyResponse);
//   })

// }

// ### <<<<<<<<<<<<<<<<<<< START SCHEDULER SERVICES ENDS >>>>>>>>>>>>>>>>>>>>>>

// startScheduledWatchers();
