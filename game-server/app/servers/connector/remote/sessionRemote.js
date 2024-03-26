/*jshint node: true */
"use strict";

const configConstants = require('../../../../shared/configConstants');

module.exports = function(app) {
	return new SessionRemote(app);
};

var SessionRemote = function(app) {
	this.app = app;
	this.sessionService   = app.get('sessionService');
	this.broadcastHandler = require("../publicHandler/broadcastHandler");
};

/**
 * helper redirect of mailer plugin
 * @method mailer
 * @param  {Object}   params contains data, should pass as it is
 * @param  {Function} cb     callback
 */
SessionRemote.prototype.mailer = function(params, cb) {
  // console.log("sessionRemote mailer called");
  this.app.get('devMailer').finalSend(params);
  cb(null);
};

/**
 * helper redirect for auto autoSit - when waiting list player gets his turn
 * @method hitAutoSit
 * @param  {Object}   params contains request data
 * @param  {Function} cb     callback
 */
SessionRemote.prototype.hitAutoSit = function(params,cb) {
	var self = this;
	var msg = {};
	// console.log("<<<<<<<<<<<<<<<<>>>>>>>>>>>>>>>>>>>>>>",params);
	// cb("hello ----------session remote.");
	var  session = !!self.app.sessionService.getByUid(params.playerId) ? self.app.sessionService.getByUid(params.playerId)[0] : undefined;
	// console.log("session in session remote-----------",session,self.app.sysrpc, self.app.rpcInvoke);
	if(!session){
    cb({success: true, nextToNext: true, info: 'do not process this player, may be next'});
    return;
  }
  msg.body  = params;
  msg.body.networkIp = session.get("networkIp");
  msg.route = "room.channelHandler.autoSit";
  self.app.sysrpc['room'].msgRemote.forwardMessage(
      session,
      msg,
      // session.export(),
      sessionExport(session),
      function(err, hitAutoSitResponse, opts) {
       // console.log("<<<<<<<<<<<<<<<<>>>>>>>>>>>>>>>>>>>>>>", err, hitAutoSitResponse);
       if (hitAutoSitResponse.success) {
        self.broadcastHandler.autoJoinBroadcast({channelId: params.channelId, playerId: params.playerId, self: self, channelType: params.channel.channelType, tableId: "", heading: 'Seat Reserved', info: 'A seat is reserved for you in table ' + params.channel.channelName + ', Please join within ' + configConstants.vacantReserveSeatTime + ' seconds or seat will be no longer reserved for you.', forceJoin: false});
			  cb(hitAutoSitResponse);
       } else {
        self.broadcastHandler.fireInfoBroadcastToPlayer({self: self, playerId: params.playerId, heading: 'Information', info: hitAutoSitResponse.info, channelId: params.channelId, buttonCode: 1});
        cb({success: true, nextToNext: true, info: 'processed this player, now next'});
       }
      }
    );
};

/**
 * helper redirect for auto leave - various occasions
 * @method hitLeave
 * @param  {Object}   params contains request data
 * @param  {Function} cb     callback
 */
SessionRemote.prototype.hitLeave = function(params, cb) {
  var self = this;
  var msg = {};
	// console.log("<<<<<<<<<<<<<<<<>>>>>>>>>>>>>>>>>>>>>>",params);
  var session = !!self.app.sessionService.getByUid(params.playerId) ? self.app.sessionService.getByUid(params.playerId)[0] : undefined;

  if (!session) {
    cb({success: true, info: 'session not found'});
    return;
  }
//  console.trace("The Ninja's way of life is this");
  console.error(params);
  msg.body = params; // channelId, playerId, isRequested, origin, standup
  msg.body.isHitLeave = true;
  msg.route = "room.channelHandler.leaveTable";
  self.app.sysrpc['room'].msgRemote.forwardMessage(
    session,
    msg,
    sessionExport(session),
    function (err, hitLeaveResponse) {
      // console.error(session.get('channelsMap'));
      cb(hitLeaveResponse);
    }
  );
};

/**
 * helper redirect for auto move
 * @method hitAutoMove
 * @param  {Object}    params contains request data
 * @param  {Function}  cb     callback
 */
SessionRemote.prototype.hitAutoMove= function(params, cb) {
  var self = this;
  var msg = {};
  // console.log("<<<<<<<<<<<<<<<<>>>>>>>>>>>>>>>>>>>>>>",params);
  var session = !!self.app.sessionService.getByUid(params.playerId) ? self.app.sessionService.getByUid(params.playerId)[0] : undefined;

  if (!session) {
    cb({success: true, info: 'session not found'});
    return;
  }
//  console.trace("The Ninja's way of life is this");
  console.error(params);
  msg.body = params; // channelId, playerId, isRequested, origin, standup
  msg.body.isAutoMove = true;
  msg.route = "room.channelHandler.makeMove";
  self.app.sysrpc['room'].msgRemote.forwardMessage(
    session,
    msg,
    sessionExport(session),
    function (err, makeMoveResponse) {
      // console.error(session.get('channelsMap'));
      cb(makeMoveResponse);
    }
  );
};

// ### Kill a user's session with server WHEN uid is given ###
  SessionRemote.prototype.killUserSessionByUid = function (session_uid, cb) {
    // console.error('Kick user for this session forcefully!! by UID - ' + session_uid);
    var that  = this,
      session = !!that.sessionService.getByUid(session_uid) ? that.sessionService.getByUid(session_uid)[0] : null;
    if(!!session ) {
      that.sessionService.kickBySessionId(session.id, function(data) {
        cb({success: true});
      });
    } else {
      cb({success: false, info: "Error in kill user session by uid", isRetry: false, isDisplay: false, channelId: ""});
    }
  },


/**
 * broadcast Player redirect when broadcast triggered from another server
 * @method broadcastPlayer
 * @param  {Object}        msg data
 * @param  {Function}      cb  callback
 */
SessionRemote.prototype.broadcastPlayer = function(msg, cb) {
  var self = this;
  self.broadcastHandler.sendMessageToUser({self: self, msg: msg.data, playerId: msg.playerId, route: msg.route});
  if (cb instanceof Function) {
    cb({success: true, info: "broadcastPlayer - sent"});
  }
};

/**
 * clone session keys
 * @method sessionExport
 * @param  {Object}      session player session
 * @return {Object}              object with some keys from session
 */
function sessionExport (session) {
	var EXPORTED_SESSION_FIELDS = ['id', 'frontendId', 'uid', 'settings'];
  var res = {};
  clone(session, res, EXPORTED_SESSION_FIELDS);
  return res;
}

/**
 * clone object keys
 * @method clone
 * @param  {Object} src      source of keys
 * @param  {Object} dest     destination for keys
 * @param  {Array}  includes list of keys - array of Strings
 */
function clone(src, dest, includes) {
  var f;
  for(var i=0, l=includes.length; i<l; i++) {
    f = includes[i];
    dest[f] = src[f];
  }
}
