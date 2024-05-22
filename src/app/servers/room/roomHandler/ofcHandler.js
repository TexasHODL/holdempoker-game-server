/*jshint node: true */
"use strict";

// > This file is used to control following things -
// 1. Handle client request
// 2. Response to client
// 3. Perform db operation before sending response (if required)
// 4. Internal functions are also used to manipulate data before response (if required)
// 5. All these management is only for OFC poker variation


// ### External files and packages declaration ###
var _                 = require('underscore'),
    schedule          = require('node-schedule'),
    async             = require("async"),
    _ld               = require("lodash"),
    // appmetrics     = require('appmetrics'),
    // monitoring     = appmetrics.monitor(),
    keyValidator      = require("../../../../../shared/keysDictionary"),
    imdb              = require("../../../../../shared/model/inMemoryDbQuery.js"),
    db                = require("../../../../../shared/model/dbQuery.js"),
    stateOfX          = require("../../../../../shared/stateOfX.js"),
    profileMgmt       = require("../../../../../shared/model/profileMgmt.js"),
    zmqPublish        = require("../../../../../shared/infoPublisher.js"),
    ofcJoinHandler    = require("./ofc/ofcJoinHandler"),
    ofcSitHandler     = require("./ofc/ofcSitHandler"),
    ofcAutoSitHandler = require("./ofc/ofcAutoSitHandler"),
    popupTextManager  = require("../../../../../shared/popupTextManager"),
    ofcActionHandler  = require("./ofc/ofcActionHandler");
var pomelo = require('pomelo');
// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'ofcHandler';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

var Handler = function (app) {
  this.app = app;
};

module.exports = function (app) {
  // myNewApp = app;
  return new Handler(app);
};

var ofcHandler = Handler.prototype;

// Join player into any table

ofcHandler.ofcJoinChannel = function (msg, session, next) {
  var self = this;
  serverLog(stateOfX.serverLogType.request,JSON.stringify(msg));
  keyValidator.validateKeySets("Request", "connector", "ofcJoinChannel", msg, function (validated){
    if(validated.success){
      var channel = self.app.get('channelService').getChannel(msg.channelId, true);
      ofcJoinHandler.processJoin ({self: self, session: session, channel: channel, channelId: msg.channelId, channelType: msg.channelType, playerId: msg.playerId, playerName: msg.playerName}, function(processJoinResponse){
        serverLog(stateOfX.serverLogType.response, JSON.stringify(processJoinResponse));
        next(null, processJoinResponse);
      });
    } else {
      next(null, validated);
    }
  });
};

// Join as a waiting list

ofcHandler.ofcJoinWaitingList = function (msg, session, next) {
  serverLog(stateOfX.serverLogType.request,JSON.stringify(msg));
  keyValidator.validateKeySets("Request", "connector", "ofcJoinWaitingList", msg, function (validated){
    if(validated.success){
      next(null, {success: false, isRetry: false, isDisplay: false, channelId: msg.channelId,info: popupTextManager.falseMessages.OFCJOINWAITINGLISTFAIL_OFCHANDLER});
      //next(null, {success: false, channelId: msg.channelId, info: "Waiting list feature is not implemented yet.."});
    } else {
      next(null, validated);
    }
  });
};

// Sit player into table

ofcHandler.ofcSit = function (msg, session, next) {
  var self = this;
  serverLog(stateOfX.serverLogType.request,JSON.stringify(msg));
  keyValidator.validateKeySets("Request", "connector", "ofcSit", msg, function (validated){
    if(validated.success){
      var channel = self.app.get('channelService').getChannel(msg.channelId, false);
      ofcSitHandler.processOFCsit({self: self, session: session, channelId: msg.channelId, channel: channel, playerId: msg.playerId, playerName: msg.playerName, imageAvtar: msg.imageAvtar, points: msg.points, seatIndex: msg.seatIndex, networkIp: msg.networkIp, isRequested: msg.isRequested, isAutoReBuy: msg.isAutoReBuy}, function(processSitResponse) {
        next(null, processSitResponse);
        if(processSitResponse.success) {
          ofcActionHandler.handleAction({self: self, session: session, channel: channel, request: msg, response: processSitResponse, eventName: stateOfX.OFCevents.sitSuccess}, function(handleActionResponse){});
        }
      });
    } else {
      next(null, validated);
    }
  });
};

// Auto sit player into table

ofcHandler.ofcAutoSit = function (msg, session, next) {
  var self = this;
  serverLog(stateOfX.serverLogType.request,JSON.stringify(msg));
  keyValidator.validateKeySets("Request", "connector", "ofcAutoSit", msg, function (validated){
    if(validated.success){
      var channel = self.app.get('channelService').getChannel(msg.channelId, true);
      ofcAutoSitHandler.processOFCautoSit({self: self, channel: channel, session: session, channelId: msg.channelId, playerId: msg.playerId, isRequested: msg.isRequested, playerName: msg.playerName, seatIndex: msg.seatIndex, networkIp: msg.networkIp, imageAvtar: msg.imageAvtar}, function(processOFCautoSitResponse){
        next(null, processOFCautoSitResponse.response);
        if(processOFCautoSitResponse.success) {
          ofcActionHandler.handleAction({self: self, session: session, channel: channel, request: msg, response: processOFCautoSitResponse, eventName: stateOfX.OFCevents.autositSuccess}, function(handleActionResponse){});
        }
      });
    } else {
      next(null, validated);
    }
  });
};

// Submit player move (turn transfer handling)

ofcHandler.ofcMakeMove = function (msg, session, next) {
  var self = this;
  serverLog(stateOfX.serverLogType.request, JSON.stringify(msg));
  keyValidator.validateKeySets("Request", "connector", "ofcMakeMove", msg, function (validated){
    if(validated.success){
      var channel = self.app.get('channelService').getChannel(msg.channelId, true);
      self.app.rpc.database.ofcRequestRemote.ofcMakeMove(session, msg, function (makeMoveResponse) {
        serverLog(stateOfX.serverLogType.response, 'Response from move process in remote - ' + JSON.stringify(makeMoveResponse));
        if(makeMoveResponse.success) {
          next(null, {success: true, channelId: msg.channelId, playerId: msg.playerId});
          ofcActionHandler.handleAction({self: self, session: session, channel: channel, request: msg, response: makeMoveResponse, eventName: stateOfX.OFCevents.makeMoveSuccess}, function(handleActionResponse){});
        } else {
          next(null, _.omit(makeMoveResponse, 'data'));
          ofcActionHandler.handleAction({self: self, session: session, channel: channel, request: msg, response: makeMoveResponse, eventName: stateOfX.OFCevents.makeMoveSuccessFail}, function(handleActionResponse){});
        }
      });
    } else {
      next(null, validated);
    }
  });
};

// Leave player from table
ofcHandler.ofcLeaveTable = function (msg, session, next) {
  var self     = !!msg.self ? msg.self : this,
      app      = !!msg.self ? msg.self.app : self.app,
      serverId = app.get('serverId');
      msg      = _.omit(msg, 'self');

  serverLog(stateOfX.serverLogType.request,JSON.stringify(msg));
  keyValidator.validateKeySets("Request", "connector", "ofcLeaveTable", msg, function (validated){
    if(validated.success){
      var channel = self.app.get('channelService').getChannel(msg.channelId, true);
      self.app.rpc.database.ofcRequestRemote.ofcLeaveTable(session, msg, function (ofcLeaveTableResponse) {
        serverLog(stateOfX.serverLogType.response, 'Response from leave process in remote - ' + JSON.stringify(ofcLeaveTableResponse));
        if(ofcLeaveTableResponse.success) {
          next(null, {success: true, channelId: msg.channelId, playerId: msg.playerId});
          // Leave player from channel (not in standup case)
          if(!msg.isStandup) {
            channel.leave(msg.playerId, serverId);
          }
          ofcActionHandler.handleAction({self: self, session: session, channel: channel, request: msg, response: ofcLeaveTableResponse, eventName: stateOfX.OFCevents.leaveSuccess}, function(handleActionResponse){});
        } else {
          next(null, ofcLeaveTableResponse);
        }
      });
    } else {
      next(null, validated);
    }
  });
};

// Sitout player in next turn

ofcHandler.ofcJoinSimilar = function (msg, session, next) {
  serverLog(stateOfX.serverLogType.request,JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "ofcJoinSimilar", msg, function (validated){
    if(validated.success){
      self.app.rpc.database.similarTable.searchTable(session, {playerId: msg.playerId, searchParams: msg.searchParams}, function (searchTableResponse) {
        serverLog(stateOfX.serverLogType.response, '' + JSON.stringify(searchTableResponse));
        next(null, searchTableResponse);
      });
    } else {
      next(null, validated);
    }
  });
};

// Resume player after sitout

ofcHandler.testHandler = function (msg, session, next) {
  serverLog(stateOfX.serverLogType.request,JSON.stringify(msg));
  keyValidator.validateKeySets("Request", "connector", "testHandler", msg, function (validated){
    if(validated.success){
      next(null, {success: true});
    } else {
      next(null, validated);
    }
  });
};

// Join similar ofc table for player

ofcHandler.testHandler = function (msg, session, next) {
  serverLog(stateOfX.serverLogType.request,JSON.stringify(msg));
  keyValidator.validateKeySets("Request", "connector", "testHandler", msg, function (validated){
    if(validated.success){
      next(null, {success: true});
    } else {
      next(null, validated);
    }
  });
};

// Get filter for ofc tables

ofcHandler.testHandler = function (msg, session, next) {
  serverLog(stateOfX.serverLogType.request,JSON.stringify(msg));
  keyValidator.validateKeySets("Request", "connector", "testHandler", msg, function (validated){
    if(validated.success){
      next(null, {success: true});
    } else {
      next(null, validated);
    }
  });
};

// Quick set join to a table

ofcHandler.testHandler = function (msg, session, next) {
  serverLog(stateOfX.serverLogType.request,JSON.stringify(msg));
  keyValidator.validateKeySets("Request", "connector", "testHandler", msg, function (validated){
    if(validated.success){
      next(null, {success: true});
    } else {
      next(null, validated);
    }
  });
};

// Add points on table

//input - {channelId: "String", playerId: "String", amount: "Boolean", isRequested: "Boolean"}
ofcHandler.ofcAddPointsOnTable = function(msg,session,next) {
  serverLog(stateOfX.serverLogType.request,JSON.stringify(msg));
  var self = this;
  keyValidator.validateKeySets("Request", "connector", "ofcAddPointsOnTable", msg, function (validated) {
    if(validated) {
      var channel = self.app.get('channelService').getChannel(msg.channelId, false);
      self.app.rpc.database.ofcRequestRemote.ofcAddPointsOnTable(session, msg, function (ofcAddPointsOnTableResponse) {
        serverLog(stateOfX.serverLogType.info, 'After adding chips in ofcHandler response - ' + JSON.stringify(ofcAddPointsOnTableResponse));
        next(null, ofcAddPointsOnTableResponse);
        if(ofcAddPointsOnTableResponse.success) {
          ofcActionHandler.handleAction({self: self, session: session, channel: channel, request: msg, response: ofcAddPointsOnTableResponse, eventName: stateOfX.OFCevents.addpointSuccess}, function(handleActionResponse){});
        } else {

        }
      });
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(validated));
      next(null, validated);
    }
  });
};


// Get table details from lobby

ofcHandler.testHandler = function (msg, session, next) {
  serverLog(stateOfX.serverLogType.request,JSON.stringify(msg));
  keyValidator.validateKeySets("Request", "connector", "testHandler", msg, function (validated){
    if(validated.success){
      next(null, {success: true});
    } else {
      next(null, validated);
    }
  });
};

// Set player attribute on table

ofcHandler.testHandler = function (msg, session, next) {
  serverLog(stateOfX.serverLogType.request,JSON.stringify(msg));
  keyValidator.validateKeySets("Request", "connector", "testHandler", msg, function (validated){
    if(validated.success){
      next(null, {success: true});
    } else {
      next(null, validated);
    }
  });
};
