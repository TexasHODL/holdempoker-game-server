/*jshint node: true */
"use strict";

// This file is used to handle player sit manipulations

// ### External files and packages declaration ###
var keyValidator           = require("../../../../../shared/keysDictionary"),
    profileMgmt            = require("../../../../../shared/model/profileMgmt.js"),
    stateOfX               = require("../../../../../shared/stateOfX"),
    async                  = require('async'),
    _                      = require('underscore'),
    // actionLogger           = require("./ofcActionLogger"),
    ofcBroadcastHandler    = require("./ofcBroadcastHandler"),
    ofcStartGameHandler    = require("./ofcStartGameHandler"),
    ofcChannelTimerHandler = require("./ofcChannelTimerHandler");

var ofcSitHandler = {};

// Check if seat is not already occupied success
var ofcsitplayer = function (params, cb) {
  params.self.app.rpc.database.ofcRequestRemote.ofcsitplayer(params.session, {channelId: params.channelId, playerId: params.playerId, points: params.points, seatIndex: params.seatIndex, playerName: params.playerName , imageAvtar: params.imageAvtar, networkIp: params.networkIp, isAutoReBuy: params.isAutoReBuy, isRequested: params.isRequested}, function (ofcsitplayerResponse) {
    console.log('ofcsitplayerResponse - ' + JSON.stringify(ofcsitplayerResponse));
    if(ofcsitplayerResponse.success) {
      params.player = ofcsitplayerResponse.player;
      params.table  = ofcsitplayerResponse.table;
      cb(null, params);
    } else {
      cb(ofcsitplayerResponse);
    }
  });
};

// Kill reserve seat timer for this player
// > If player sit on a reserve sit
var killReserveSeatTimer = function(params, cb) {
  ofcChannelTimerHandler.ofcKillReserveSeatReferennce({playerId: params.playerId, channel: params.channel});
  cb(null, params);
};

// Set this channel into session of player

var setChannelIntoSession = function(params, cb) {
  var sessionChannels =  !!params.session.get("channels") ? params.session.get("channels") : [];
  sessionChannels.push(params.channelId);

  params.session.set("channels", sessionChannels);
  params.session.push("channels", function (err){
    if(err) {
      console.error(stateOfX.serverLogType.error, 'set playerId for session service failed! error is : %j', err.stack);
      cb({success : false, channelId: params.channelId, info: err});
    } else {
      cb(null, params);
    }
  });
};

var fireSitBroadcast = function(params, cb){
  ofcBroadcastHandler.fireOFCsitBroadcast({self: params.self, channel: params.channel, channelId: params.channelId, player: params.player, table: params.table});
  cb(null, params);
};


var checkAndStartGame = function(params, cb){
  ofcStartGameHandler.ofcStartGame({self: params.self, session: params.session, channelId: params.channelId, channel: params.channel, eventName: stateOfX.OFCstartGameEvent.sit});
  cb(null, params);
};

ofcSitHandler.processOFCsit = function (params, cb) {
  keyValidator.validateKeySets("Request", "connector", "processOFCsit", params, function (validated){
    if(validated.success) {
      async.waterfall([
        async.apply(ofcsitplayer, params),
        setChannelIntoSession,
        fireSitBroadcast,
        checkAndStartGame,
        killReserveSeatTimer
      ], function(err, response) {
        if(!err && response) {
          cb({success: true, channelId: params.channelId, info: "Player sit successfully.", player: params.player});
        } else {
          cb(err);
        }
      });
    } else {
      cb(validated);
    }
  });
};

module.exports = ofcSitHandler;