/*jshint node: true */
"use strict";

// This file is used to handle all session values

// ### External files and packages declaration ###

var keyValidator      = require("../../../../shared/keysDictionary"),
  zmqPublish          = require("../../../../shared/infoPublisher.js"),
  stateOfX            = require("../../../../shared/stateOfX.js"),
  imdb                = require("../../../../shared/model/inMemoryDbQuery.js"),
  db                = require("../../../../shared/model/dbQuery.js"),
  async               = require("async"),
  popupTextManager  = require("../../../../shared/popupTextManager"),
  sessionHandler      = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'sessionHandler';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

// ### This function is for bind user session
sessionHandler.bindUserSession = function (msg, cb) {
  keyValidator.validateKeySets("Request", msg.self.app.serverType, "bindUserSession", msg, function (validated){
    if(validated.success) {
      var session = msg.session;
      session.bind(msg.playerId);
      session.on('closed', onUserLeave.bind(null, msg.self.app));
      // Set all session values
      session.set("playerId", msg.playerId);
      session.push("playerId",function (err){
        if(err) {
          console.error('set playerId for session service failed! error is : %j', err.stack);
          cb({success : false});
          return false;
        }
        cb({success : true});
        return true;
      });

      session.set("playerName", msg.playerName);
      session.push("playerName",function (err){
        if(err) {
          console.error('set playerName for session service failed! error is : %j', err.stack);
          cb({success : false});
          return false;
        }
        cb({success : true});
        return true;
      });
    } else {
      cb(validated);
    }
  });
};

// ### Store channel with player's session
// > When player session gets closed then handle event
// > Remove player from all associated channels

sessionHandler.bindChannelInSession = function (params, cb) {
  keyValidator.validateKeySets("Request", params.self.app.serverType, "bindChannelInSession", params, function (validated){
    if(validated.success) {
      // Get channels from session of this player
      var sessionChannels =  !!params.session.get("channels") ? params.session.get("channels") : [];
      if(sessionChannels.indexOf(params.channelId) < 0) {
        sessionChannels.push(params.channelId);
        params.session.set("channels", sessionChannels);
        params.session.push("channels", function(err){
          if(err) {
            console.error('set channels for session service failed! error is : %j', err.stack);
          }
        });
      } else {
        console.error('This channel already exists in player sessions');
      }
      cb({success: true});
    } else {
      cb(validated);
    }
  });
};

// record last activity time in user session
// as a key value in session.settings
sessionHandler.recordLastActivityTime = function (params) {
  if ((params && params.session && params.session.set && params.session.push)) {
  if((params.msg.isRequested && params.msg.isRequested === true) || !params.msg.isRequested) {
    params.session.set("lastActiveTime" , Number(new Date()));
    params.session.push("lastActiveTime",function (err){
      if(err) {
        serverLog(stateOfX.serverLogType.error, 'set lastActiveTime for session service failed! error is : %j', err.stack);
      } else {
        serverLog(stateOfX.serverLogType.info, 'set lastActiveTime for session service success');
      }
    });
    serverLog(stateOfX.serverLogType.info, 'Last active time recorded for - ' + params.session.uid + ' => ' + params.session.get("lastActiveTime"));
  } else {
    serverLog(stateOfX.serverLogType.info, 'No need to record time this api is called from server');
  }
  }
};


/**
 * this function removes player from all tables
 * @method removefromChannels
 * @param  {object}           self     
 * @param  {object}           app      
 * @param  {object}           session  contains session
 * @param  {Function}         callback callback function
 * @return {callback}           callback
 */
var removefromChannels = function(self, app, session, callback) {
  serverLog(stateOfX.serverLogType.info, 'in function removefromChannels.');
  var sessionChannels = !!session.get("channels") ? session.get("channels") : [];
  var query ={};
  query.playerId = session.uid;
  imdb.findRunningTable(query,function(err,joinRecords){
    if(!err && joinRecords){
      async.each(joinRecords, function(joinRecord, ecb){
        var sessionChannel = joinRecord.channelId;
      console.error(stateOfX.serverLogType.info, 'Removing from channel - ' + JSON.stringify(sessionChannel));
      db.findTableById(sessionChannel, function(err, table){
        if(!err && table) {
          if(table.channelVariation === stateOfX.channelVariation.ofc) {
            serverLog(stateOfX.serverLogType.info, 'Player left from session close event OFC table.');
            ecb();
          } else {
            app.rpc.room.roomRemote.leaveRoom(session, {self: {app: null, keepThisApp: false}, playerId: session.uid, isStandup: false, channelId: sessionChannel, isRequested: false}, function(err, leaveResponse){
                console.error("leaveResponse in removefromChannels", leaveResponse);
              serverLog(stateOfX.serverLogType.error, 'Player left, session killed !');
              if (leaveResponse && !leaveResponse.success) {
                app.rpc.room.roomRemote.handleDisconnection(session, {channelId: sessionChannel, playerId: session.uid}, function (err, result) {
                  ecb();
                });
              } else {
              ecb();
              }
            });
          }
        } else {
          serverLog(stateOfX.serverLogType.error, 'Error while leaving player from channel - ' + sessionChannel + ' ! DB error - ' + JSON.stringify(err));
          ecb();
        }
      });
    }, function(err){
      if(err) {
        serverLog(stateOfX.serverLogType.error, 'Removing player from channels failed!');
        callback(null, self, app, session);
      } else {
        serverLog(stateOfX.serverLogType.info, 'Player has been left form all the channels joined');
        callback(null, self, app, session);
      }
    });
    }
  });
  console.error(stateOfX.serverLogType.info, 'session channels are - ' + JSON.stringify(sessionChannels));
  // if(sessionChannels.length > 0) {
  //   serverLog(stateOfX.serverLogType.info, 'Channels joined in this session - ' + JSON.stringify(sessionChannels));
  //   async.each(sessionChannels, function(sessionChannel, ecb){
  //     console.error(stateOfX.serverLogType.info, 'Removing from channel - ' + JSON.stringify(sessionChannel));
  //     db.findTableById(sessionChannel, function(err, table){
  //       if(!err && table) {
  //         if(table.channelVariation === stateOfX.channelVariation.ofc) {
  //           serverLog(stateOfX.serverLogType.info, 'Player left from session close event OFC table.');
  //           ecb();
  //         } else {
  //           app.rpc.room.roomRemote.leaveRoom(session, {self: {app: null, keepThisApp: false}, playerId: session.uid, isStandup: false, channelId: sessionChannel, isRequested: false}, function(err, leaveResponse){
  //               console.error("leaveResponse in removefromChannels", leaveResponse);
  //             serverLog(stateOfX.serverLogType.error, 'Player left, session killed !');
  //             if (leaveResponse && !leaveResponse.success) {
  //               app.rpc.room.roomRemote.handleDisconnection(session, {channelId: sessionChannel, playerId: session.uid}, function (err, result) {
  //                 ecb();
  //               })
  //             } else {
  //             ecb();
  //             }
  //           });
  //         }
  //       } else {
  //         serverLog(stateOfX.serverLogType.error, 'Error while leaving player from channel - ' + sessionChannel + ' ! DB error - ' + JSON.stringify(err))
  //         ecb()
  //       }
  //     })
  //   }, function(err){
  //     if(err) {
  //       serverLog(stateOfX.serverLogType.error, 'Removing player from channels failed!')
  //       callback(null, self, app, session);
  //     } else {
  //       serverLog(stateOfX.serverLogType.info, 'Player has been left form all the channels joined');
  //       callback(null, self, app, session);
  //     }
  //   });
  // } else {
  //   serverLog(stateOfX.serverLogType.info, 'Player was not joined into any channel!');
  //   callback(null, self, app, session);
  // }
};

/**
 * this function removes player from waiting
 * @method removeFromWaiting
 * @param  {object}           self     
 * @param  {object}           app      
 * @param  {object}           session  contains session
 * @param  {Function}         callback callback function
 * @return {callback}           callback
 */
var removeFromWaiting = function(self, app, session, callback) {
  serverLog(stateOfX.serverLogType.info, 'in function removeFromWaiting.');
  var waitingChannels = !!session.get("waitingChannels") ? session.get("waitingChannels") : [];
  serverLog(stateOfX.serverLogType.info, 'waiting channels are - ' + JSON.stringify(waitingChannels));
  if(waitingChannels.length > 0) {
    serverLog(stateOfX.serverLogType.info, 'Channels joined in this session - ' + JSON.stringify(waitingChannels));
    async.each(waitingChannels, function(waitingChannel, ecb){
      serverLog(stateOfX.serverLogType.info, 'Removing from channel - ' + JSON.stringify(waitingChannel));
      db.findTableById(waitingChannel, function(err, table){
        if(!err && table) {
          if(table.channelVariation === stateOfX.channelVariation.ofc) {
            serverLog(stateOfX.serverLogType.info, 'Player left from session close event OFC table.');
            ecb();
          } else {
            console.log(session.frontendId, Object.keys(session), session.uid);
            app.rpc.room.roomRemote.leaveWaitingList(session, {playerId: session.uid, channelId: waitingChannel, playerName: session.playerName}, function (err, leaveWaitingResponse) {
             if(leaveWaitingResponse.success){
                var waitingChannels = !!session.get("waitingChannels") ? session.get("waitingChannels") : [];
                if(waitingChannels.indexOf(waitingChannel) >= 0) {
                  console.trace(session.settings);
                  waitingChannels.splice(waitingChannels.indexOf(waitingChannel), 1);
                  session.set("waitingChannels", waitingChannels);
                  console.trace(session.settings);
                  session.push("waitingChannels", function (err){
                    if(err) {
                      serverLog(stateOfX.serverLogType.error, 'set new waiting channel for session service failed! error is : %j', err.stack);
                    }
                  });
                }
             }
              console.log(session.frontendId, Object.keys(session), session.uid, err);
              ecb();
            });
            // app.rpc.database.requestRemote.removeWaitingPlayer(session, {playerId: session.uid, channelId: waitingChannel, playerName: session.playerName}, function (leaveWaitingResponse) {
            //   serverLog(stateOfX.serverLogType.info, 'Player removed from waiting list!');
            //   ecb();
            // });
          }
        } else {
          serverLog(stateOfX.serverLogType.error, 'Error while leaving player from channel - ' + waitingChannel + ' ! DB error - ' + JSON.stringify(err));
          ecb();
        }
      });
    }, function(err){
      if(err) {
        serverLog(stateOfX.serverLogType.error, 'Removing player from channels failed!');
        callback(null, self, app, session);
      } else {
        serverLog(stateOfX.serverLogType.info, 'Player has been left form all the channels joined');
        callback(null, self, app, session);
      }
    });
  } else {
    serverLog(stateOfX.serverLogType.info, 'Player was not joined any waiting list!');
    callback(null, self, app, session);
  }
};

/**
 * this function removes player's join record
 * @method removeJoinRecord
 * @param  {object}           self     
 * @param  {object}           app      
 * @param  {object}           session  contains session
 * @param  {Function}         callback callback function
 * @return {callback}           callback
 */
var removeJoinRecord = function(self, app, session, callback) {
  imdb.removePlayerJoin({playerId: session.uid}, function(err, result) {
    if(!err) {
      serverLog(stateOfX.serverLogType.info, 'All join record successfully removed');
    } else {
      serverLog(stateOfX.serverLogType.info, 'err in remove join record');
    }
    callback(null, self, app, session);
  });
};


/**
 * this function removes player's activity
 * @method removePlayerActivity
 * @param  {object}           self     
 * @param  {object}           app      
 * @param  {object}           session  contains session
 * @param  {Function}         callback callback function
 * @return {callback}           callback
 */
var removePlayerActivity = function(self, app, session, callback) {
  imdb.removeActivity({playerId: session.uid}, function(err, result) {
    if(!err) {
      serverLog(stateOfX.serverLogType.info, 'Allplayer activity record successfully removed');
    } else {
      serverLog(stateOfX.serverLogType.info, 'err in remove player activity');
    }
    callback(null, self, app, session);
  });
};

/**
 * this function removes user from all tables in series of functions
 * @method leaveUserFromAllChannels
 * @param  {object}                 self     
 * @param  {object}                 app      
 * @param  {object}                 session  contains session
 * @param  {Function}               callback callback function
 * @return {callback}                 callback
 */
sessionHandler.leaveUserFromAllChannels = function (self, app, session, callback) {
  serverLog(stateOfX.serverLogType.info, 'in function leaveUserFromAllChannels.');
  async.waterfall([
    async.apply(removefromChannels, self, app, session),
    removeFromWaiting,
    //removePlayerActivity,
    //removeJoinRecord
    // async.apply(removeFromWaiting, self, app, session)
  ], function(err, response){
    if(err) {
      serverLog(stateOfX.serverLogType.error, 'Leave player from channel and waiting list failed!');
      callback({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.falseMessages.LEAVEUSERFROMALLCHANNEL_SESSIONHANDLER});
      //callback({success: false, info: "Unable to process leave from channels !"});
    } else {
      serverLog(stateOfX.serverLogType.info, 'Leave player from channel and waiting list processed successfully!');
      callback({success: true});
    }
  });
};

module.exports = sessionHandler;
