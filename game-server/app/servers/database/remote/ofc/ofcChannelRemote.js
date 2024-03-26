  /**
 * Created by Amrendra on 18/07/2016.
**/

/*jshint node: true */
"use strict";


var async            = require("async"),
    _ld              = require("lodash"),
    _                = require('underscore'),
    stateOfX         = require("../../../../../shared/stateOfX"),
    keyValidator     = require("../../../../../shared/keysDictionary"),
    db               = require('../../../../../shared/model/dbQuery'),
    imdb             = require("../../../../../shared/model/inMemoryDbQuery.js"),
    zmqPublish       = require("../../../../../shared/infoPublisher"),
    ofcChannelRemote = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'ofcChannelRemote';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

// ### Add additional params in existing one for calculation

var setSearchChannelParams = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in ofcChannelRemote - setSearchChannelParams');
  params.channelDetails = {};
  params.response       = {};
  cb(null, params);
};

// ### Get this channel details from database

var getChannelDetails = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in ofcChannelRemote - getChannelDetails');
  serverLog(stateOfX.serverLogType.info, 'About to get table form main db');
  db.findTableById(params.channelId, function (err, channel) {
    serverLog(stateOfX.serverLogType.info, 'err and channel');
    serverLog(stateOfX.serverLogType.info, JSON.stringify(err));
    serverLog(stateOfX.serverLogType.info, JSON.stringify(channel));
    if(!err && !!channel) {
      serverLog(stateOfX.serverLogType.info, "channelDetails are -  " + JSON.stringify(channel));
      params.channelDetails = channel;
      cb(null, params);
    } else {
      cb({success: false, channelId: params.channelId, info: 'Channel not found in database!'});
    }
  });
};

// ### Create final response using details from database

var createChannelResponse = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in ofcChannelRemote - createChannelResponse');
  serverLog(stateOfX.serverLogType.info, "channelDetails are - " + JSON.stringify(params.channelDetails));
  cb(null, {
    success         : true,
    channelId       : params.channelId,
    channelType     : params.channelType,
    tableId         : params.tableId,
    channelDetails  : {
      channelId         : params.channelId,
      channelType       : params.channelDetails.channelType,
      channelName       : params.channelDetails.channelName,
      channelVariation  : params.channelDetails.channelVariation,
      turnTime          : params.channelDetails.turnTime,
      maxPlayers        : !!params.channelDetails.maxPlayers ? params.channelDetails.maxPlayers : 3,
      minPlayers        : !!params.channelDetails.minPlayers ? params.channelDetails.minPlayers : 2,
      minBuyIn          : params.channelDetails.minBuyIn,
      maxBuyIn          : params.channelDetails.maxBuyIn,
      gameInfo          : params.channelDetails.gameInfo,
      isRealMoney       : params.channelDetails.isRealMoney,
      chipsPointRatio   : params.channelDetails.chipsPointRatio
    },
  });
};

ofcChannelRemote.processOFCchannelSearch = function (params, cb) {
  keyValidator.validateKeySets("Request", "database", "processOFCchannelSearch", params, function(validated){
    if(validated.success) {
      async.waterfall([

        async.apply(setSearchChannelParams, params),
        getChannelDetails,
        createChannelResponse

      ], function(err, response){
        if(!err) {
          cb(response);
        } else {
          cb(err);
        }
      });
    } else {
      cb(validated);
    }
  });
};

module.exports = ofcChannelRemote;
