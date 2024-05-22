/*jshint node: true */
"use strict";

 // This file is used to process join request calculation
// As join can be called from multiple events
// Normal Join, Join similar table, Join players on tournament start, auto sit player after join

var _                 = require('underscore'),
    _ld               = require("lodash"),
    // async             = require("async"),
    keyValidator      = require("../../../../../shared/keysDictionary"),
    imdb              = require("../../../../../shared/model/inMemoryDbQuery.js"),
    stateOfX          = require("../../../../../shared/stateOfX.js"),
    zmqPublish        = require("../../../../../shared/infoPublisher.js");
    // actionLogger      = require("./ofcActionLogger");

var ofcJoinRequestUtil = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'ofcJoinRequestUtil';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

ofcJoinRequestUtil.getInMemoryTable = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "in ofcJoinRequestUtil function getInMemoryTable");
  if(!!params.channelId) {
    if(params.channel.isTable) {
      serverLog(stateOfX.serverLogType.info, 'Table for this channel is already in database!');
      params.self.app.rpc.database.ofcRequestRemote.getTable(params.session, {channelId: params.channelId}, function (getTableResponse) {
        serverLog(stateOfX.serverLogType.info, "in ofcJoinRequestUtil function getInMemoryTable getTable response - " + JSON.stringify(getTableResponse));
        if(getTableResponse.success) {
          params.data.tableFound = true;
          params.table           = getTableResponse.table;
          cb(params);
        } else {
          cb(getTableResponse);
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.info, 'No table is created for this channel, create one in next step!');
      cb(params);
    }
  } else {
    serverLog(stateOfX.serverLogType.info, 'No channel passed to process request in OFC getInMemoryTable!');
    cb(params);
  }
};

ofcJoinRequestUtil.createChannelInDatabase = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "in ofcJoinRequestUtil function createChannelInDatabase");
  if(!!params.channelId) {
    if(!params.data.tableFound) {
      serverLog(stateOfX.serverLogType.info, 'Creating new table into database for this channel!');
      params.self.app.rpc.database.ofcRequestRemote.processChannelSearch(params.session, {channelId: params.channelId, channelType: params.channelType, tableId: params.tableId, playerId: params.playerId,gameVersionCount: params.gameVersionCount}, function (channelRemoteResponse) {
        serverLog(stateOfX.serverLogType.info, 'channelRemoteResponse - ' + JSON.stringify(channelRemoteResponse));
        if(channelRemoteResponse.success) {
          params.self.app.rpc.database.ofcRequestRemote.createOFCtable(params.session, channelRemoteResponse.channelDetails, function (createTableResponse) {
            if(createTableResponse.success) {
              params.data.tableFound                   = true;
              params.table                             = createTableResponse.table;
              
              // Set channel level variables
              params.channel.isTable                   = true;
              params.channel.channelName               = params.table.channelName;
              params.channel.channelType               = stateOfX.gameType.normal;
              params.channel.channelVariation          = params.table.channelVariation;
              params.channel.tournamentId              = "";
              params.channel.turnTimeReference         = null;
              params.channel.extraTurnTimeReference    = null;
              params.channel.clientConnAckReference    = null;
              params.channel.timeBankTurnTimeReference = null;
              params.channel.gameStartEventSet         = stateOfX.startGameEventOnChannel.idle;
              params.channel.gameStartEventName        = null;
              params.channel.allInOccuredOnChannel     = false;
              params.channel.turnTime                  =  params.table.turnTime;
              params.channel.reserveSeatTimeReference  = [];
              params.channel.kickPlayerToLobby         = [];
              
              cb(params);
            } else {
              console.error('Error while generating table!');
              cb(createTableResponse);
            }
          });
        } else {
          cb(channelRemoteResponse);
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.info, 'Table from inmemory database already found for this request!');
      cb(params);
    }
  } else {
    serverLog(stateOfX.serverLogType.info, 'This request is for tournament table join !');
    cb(params);
  }
};

ofcJoinRequestUtil.joinPlayerToChannel = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "in ofcJoinRequestUtil function joinPlayerToChannel");
  keyValidator.validateKeySets("Request", "connector", "joinPlayerToChannel", params, function (validated){
    if(validated.success) {
      // Check if player doesn't exists in the channel already
      var channelMembers = params.channel.getMembers();
      serverLog(stateOfX.serverLogType.info, "Channel members are  previous- " + JSON.stringify(params.channel.getMembers()));
      if(channelMembers.indexOf(params.playerId) < 0) {
        params.channel.add(params.playerId, params.self.app.get('serverId'));
      } else { // can be removed if log not important
        serverLog(stateOfX.serverLogType.info, "Player is already inside channel (pomelo level) .");
      }
      serverLog(stateOfX.serverLogType.info, "Channel members are  after- " + JSON.stringify(params.channel.getMembers()));
      cb(params);
    } else {
      cb(validated);
    }
  });
};

module.exports = ofcJoinRequestUtil;