/*jshint node: true */
"use strict";

/**
 * Created by Amrendra on 14/11/2016.
**/
var async            = require("async"),
    _ld              = require("lodash"),
    _                = require("underscore"),
    setMove          = require("./setMove"),
    adjustIndex      = require("./adjustActiveIndex"),
    cardAlgo         = require("../../../util/model/deck"),
    randy            = require("../../../util/model/randy"),
    stateOfX         = require("../../../../shared/stateOfX"),
    keyValidator     = require("../../../../shared/keysDictionary"),
    mongodb          = require("../../../../shared/mongodbConnection"),
    db               = require("../../../../shared/model/dbQuery"),
    zmqPublish       = require("../../../../shared/infoPublisher"),
    ofcChannelRemote = require("./ofc/ofcChannelRemote"),
    ofcTableManager  = require("./ofc/ofcTableManager"),
    lockTable        = require("./ofc/ofcLockTable");

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'ofcRequestRemote';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

var ofcRequestRemote = function (app) {
  // this.app = app;
  // this.channelService = app.get('channelService');
};

// <<<<<<<<<<<<<<<<<<< RPC CALLS HANDLER Started >>>>>>>>>>>>>>>>>>>>>>>>>

ofcRequestRemote.prototype.setPlayerValueOnTable = function (params, cb) {
  var self = this;
  lockTable.lock({channelId: params.channelId, actionName: "setPlayerValueOnTable", data: params}, function (lockTableResponse){
    if(lockTableResponse.success) {
      keyValidator.validateKeySets("Response", "database", "setPlayerValueOnTable", lockTableResponse.data, function (validated){
        if(validated.success) {
          cb(lockTableResponse.data);
        } else {
          cb(validated);
        }
      });
    } else {
      cb(lockTableResponse);
    }
  });
};

ofcRequestRemote.prototype.getTable = function (params, cb) {
  var self = this;
  keyValidator.validateKeySets("Request", "database", "getTable", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "getTable", data: {}}, function (lockTableResponse){
        if(lockTableResponse.success) {
          keyValidator.validateKeySets("Response", "database", "getTable", {success: true, table: lockTableResponse.table}, function (validated){
            if(validated.success) {
              cb({success: true, table: lockTableResponse.table});
            } else {
              cb(validated);
            }
          });
        } else {
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

ofcRequestRemote.prototype.processChannelSearch = function (params, cb) {
  var self = this;
  keyValidator.validateKeySets("Request", "database", "processChannelSearch", params, function (validated){
    if(validated.success) {
      ofcChannelRemote.processOFCchannelSearch({channelId: params.channelId, channelType: params.channelType}, function (processSearchResponse){
        serverLog(stateOfX.serverLogType.info, 'processSearchResponse - ' + JSON.stringify(processSearchResponse));
        cb(processSearchResponse);
      });
    } else {
      cb(validated);
    }
  });
};


ofcRequestRemote.prototype.createOFCtable = function (params, cb) {
  var self = this;
  keyValidator.validateKeySets("Request", "database", "createOFCtable", params, function (validated){
    if(validated.success) {
      ofcTableManager.createOFCtable(params, function (createOFCtableResponse){
        serverLog(stateOfX.serverLogType.info, 'createOFCtableResponse - ' + JSON.stringify(createOFCtableResponse));
        cb(createOFCtableResponse);
      });
    } else {
      cb(validated);
    }
  });
};

// ### Create player object and sit as waiting player

ofcRequestRemote.prototype.ofcsitplayer = function (params, cb) {
  keyValidator.validateKeySets("Request", "database", "ofcsitplayer", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "ofcsitplayer", data: params}, function (lockTableResponse){
        serverLog(stateOfX.serverLogType.info, 'ofcsitplayer locktable response - ' + JSON.stringify(lockTableResponse));
        if(lockTableResponse.success) {
          keyValidator.validateKeySets("Response", "database", "ofcsitplayer", lockTableResponse.data, function (validated){
            if(validated.success) {
              cb(lockTableResponse.data);
            } else {
              cb(validated);
            }
          });
        } else {
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

// ### Validate start game and set config (dealer, current player etc) if Game is going to start

ofcRequestRemote.prototype.ofcShouldStartGame = function (params, cb) {
  keyValidator.validateKeySets("Request", "database", "ofcShouldStartGame", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "ofcShouldStartGame", data: {}}, function (lockTableResponse){
        keyValidator.validateKeySets("Response", "database", "ofcShouldStartGame", lockTableResponse.data, function (validated){
          serverLog(stateOfX.serverLogType.info, 'in ofcShouldStartGame lockTableResponse - ' + JSON.stringify(lockTableResponse.data));
          if(validated.success){
            cb(lockTableResponse.data);
          } else{
            cb(validated);
          }
        });
      });
    } else {
      cb(validated);
    }
  });
};

// ### Perform player move and handle everything after a player move

ofcRequestRemote.prototype.ofcMakeMove = function(params, cb) {
  keyValidator.validateKeySets("Request", "database", "ofcMakeMove", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "ofcMakeMove", data: {playerId: params.playerId, channelId: params.channelId, cards: params.cards, discarded: params.discarded}}, function (lockTableResponse){
        keyValidator.validateKeySets("Response", "database", "ofcMakeMove", lockTableResponse, function (validated){
          serverLog(stateOfX.serverLogType.info, 'in ofcMakeMove lockTableResponse - ' + JSON.stringify(lockTableResponse));
          if(validated.success){
            cb(_.omit(lockTableResponse, 'table'));
          } else{
            cb(validated);
          }
        });
      });
    } else {
      cb(validated);
    }
  });
};

// ### Perform player leave and handle everything after a player leave

ofcRequestRemote.prototype.ofcLeaveTable = function(params, cb) {
  keyValidator.validateKeySets("Request", "database", "ofcLeaveTable", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "ofcLeaveTable", data: {playerId: params.playerId, channelId: params.channelId, cards: params.cards, discarded: params.discarded}}, function (lockTableResponse){
        keyValidator.validateKeySets("Response", "database", "ofcLeaveTable", lockTableResponse, function (validated){
          serverLog(stateOfX.serverLogType.info, 'in ofcLeaveTable lockTableResponse - ' + JSON.stringify(lockTableResponse));
          if(validated.success){
            cb(_.omit(lockTableResponse, 'table'));
          } else{
            cb(validated);
          }
        });
      });
    } else {
      cb(validated);
    }
  });
};

// ### Process autosit request of a player

ofcRequestRemote.prototype.processOFCautoSit = function(params, cb) {
  keyValidator.validateKeySets("Request", "database", "processOFCautoSit", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "processOFCautoSit", data: {channelId: params.channelId, playerId: params.playerId, seatIndex: params.seatIndex, playerName: params.playerName , imageAvtar: params.imageAvtar, networkIp: params.networkIp, isRequested: params.isRequested}}, function (lockTableResponse){
        keyValidator.validateKeySets("Response", "database", "processOFCautoSit", lockTableResponse, function (validated){
          serverLog(stateOfX.serverLogType.info, 'in processOFCautoSit lockTableResponse - ' + JSON.stringify(lockTableResponse));
          if(validated.success){
            cb(lockTableResponse);
          } else{
            cb(validated);
          }
        });
      });
    } else {
      cb(validated);
    }
  });
};

ofcRequestRemote.prototype.ofcAddPointsOnTable = function (params, cb) {
  keyValidator.validateKeySets("Request", "database", "ofcAddPointsOnTable", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "ofcAddPointsOnTable", data: params}, function (lockTableResponse){
        if(lockTableResponse.success) {
          cb(lockTableResponse.data);
        } else {
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

// Create event log (Dealer chat and hand history storage)

ofcRequestRemote.prototype.createLog = function (params, cb) {
  keyValidator.validateKeySets("Request", "database", "createLog", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "createLog", data: params.data}, function (lockTableResponse){
        if(lockTableResponse.success) {
          cb(lockTableResponse);
        } else {
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

// <<<<<<<<<<<<<<<<<<< RPC CALLS HANDLER FINISHED >>>>>>>>>>>>>>>>>>>>>>>>>

module.exports = function (app) {
  return new ofcRequestRemote(app);
};
