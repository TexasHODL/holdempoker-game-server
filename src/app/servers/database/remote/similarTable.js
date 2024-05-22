/*jshint node: true */
"use strict";

/**
 * Created by Amrendra on 19/07/2016.
**/
var async         = require("async"),
    _ld       		= require("lodash"),
    _         		= require('underscore'),
    stateOfX 			= require("../../../../shared/stateOfX"),
    keyValidator  = require("../../../../shared/keysDictionary"),
    zmqPublish    = require("../../../../shared/infoPublisher"),
    db            = require('../../../../shared/model/dbQuery'),
    imdb       		= require('../../../../shared/model/inMemoryDbQuery'),
    popupTextManager  = require("../../../../shared/popupTextManager"),
    similarTable  = {};

// Create data for log generation

function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'similarTable';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}


// Add additional params for further calculation
// initialise
var searchTableParams = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in similarTable function searchTableParams');
  keyValidator.validateKeySets("Request", "database", "searchTableParams", params, function(validated){
    if(validated.success) {

      // params.searchParams     = {};
      params.similarChannels  = [];
      params.channelDetails   = {};
      params.response         = {};
      params.channelFound     = false;

      cb(null, params);
    } else {
      cb(validated);
    }
  });
};

// Search for similar tables in db
// based on given searchParams
var searchSimilarTable = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in similarTable function searchSimilarTable');
  keyValidator.validateKeySets("Request", "database", "searchSimilarTable", params, function(validated){
    if(validated.success) {
      serverLog(stateOfX.serverLogType.info, 'Search parameters - ' + JSON.stringify(params.searchParams));
      db.findTable(params.searchParams, function (err, channels) {
        serverLog(stateOfX.serverLogType.error, 'Error while searching similar table db query - ' + JSON.stringify(err));
        serverLog(stateOfX.serverLogType.info, 'Channels while searching similar table db query - ' + JSON.stringify(channels));
        if(err) {
          cb({success: false, isRetry: false, isDisplay: true, channelId: params.channelId || "", info: popupTextManager.falseMessages.SEARCHSIMILARTABLE_TABLEEXISTFAIL_SIMILARTABLE});
          //cb({success: false, info: 'Search similar table failed!'});
        } else {
          if(channels.length <= 0) {
            cb({success: false, isRetry: false, isDisplay: true, channelId: params.channelId || "", info: popupTextManager.falseMessages.SEARCHSIMILARTABLE_TABLENOTEXISTFAIL_SIMILARTABLE});
            //cb({success: false, info: 'No similar table found!'})
          } else {
            params.similarChannels = _.pluck(channels, '_id');
            cb(null, params);
          }
        }
      });
    } else {
      cb(validated);
    }
  });
};

// Get inmemory table details
// Check if player is not already playing into table
// Check if table is not already full (all seats occupied)
// Check if player is not already joined into table (as observer mode)
var assignPlayersToChannel = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In function assignPlayersToChannel');
  params.channelStrength = [];
  async.eachSeries(params.similarChannels, function (channelId, ecb) {
    serverLog(stateOfX.serverLogType.info, 'Processing channel - ' + channelId);
    imdb.getTable(channelId, function(err, table){ // Get inmemory table details
      if(!err && table) {
        serverLog(stateOfX.serverLogType.info, 'In memory channel data - ' + JSON.stringify(table));
        if(_ld.findIndex(table.players, {playerId: params.playerId}) < 0) { // Check if player is not already playing into table
          serverLog(stateOfX.serverLogType.info, 'Player is not playing into this table!');
          if((table.players.length + table.queueList.length) < table.maxPlayers) { // Check if table is not already full (all seats occupied)
            serverLog(stateOfX.serverLogType.info, 'This table is not full!');
            imdb.isPlayerJoined({channelId: channelId.toString(), playerId: params.playerId}, function(err, response){ // Check if player is not already joined into table (as observer mode)
              if(!err) {
                if(!!response) {
                  serverLog(stateOfX.serverLogType.info, 'Player already joined this channel - ' + channelId + ', skipping!');
                  ecb();
                } else {
                  serverLog(stateOfX.serverLogType.info, 'Player is not joined into this table!');
                  params.channelStrength.push({
                    channelId : channelId,
                    tableName : table.channelName,
                    players   : _.where(table.players, {state: stateOfX.playerState.playing}).length + _.where(table.players, {state: stateOfX.playerState.waiting}).length
                  });
                  ecb();
                  // params.channelFound     = true;
                  // params.similarChannelId = channelId;
                  // serverLog(stateOfX.serverLogType.info, 'Assigned channel id - ' + channelId);
                  // ecb();
                }
              } else {
                cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBGETTABLE_ASSIGNPLAYERSTOCHANNELFAIL_SIMILARTABLE + JSON.stringify(err)});
                //cb({success: false, info: 'Error while fetching details of player joined - ' + JSON.stringify(err)});
              }
            });
          } else {
            serverLog(stateOfX.serverLogType.info, 'Player ' + table.players.length + ' and queued length ' + table.queueList.length + ' for this table is full ' + table.maxPlayers + ' !');
            ecb();
          }
        } else {
          serverLog(stateOfX.serverLogType.info, 'Player is already sitting in this channel - ' + channelId + ', skipping!');
          ecb();
        }
      } else {
        params.channelStrength.push({
          channelId : channelId,
          tableName : "No Table Name",
          players   : 0
        });
        ecb();
        // cb({success: false, info: 'No details found for this table in inMemory!' err});
      }
    });
  }, function(err) {
    if(!err) {
      serverLog(stateOfX.serverLogType.info, 'Channel strength so far : ' + JSON.stringify(params.channelStrength));
      cb(null, params);
    } else {
      serverLog(stateOfX.serverLogType.error, 'Error while setting channel strength : ' + JSON.stringify(err));
      cb(err);
    }
  });
};

// sort tables (if found mroe than 1) by channel strength -
// count of playing + waiting player
var sortChannelStrength = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In function sortChannelStrength');
  if(params.channelStrength.length >= 1) {
    params.channelStrength.sort(function(a, b) { return parseInt(a.players) - parseInt(b.players); });
    serverLog(stateOfX.serverLogType.info, 'Sorted Channel strength so far : ' + JSON.stringify(params.channelStrength));
    cb(null, params);
  } else {
    cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.SORTCHANNELSTRENGTH_FAIL_SIMILARTABLE});
    //cb({success: false, info: 'All tables with selected criteria are full, please try after sometime!'})
  }
};

// validate channel and finally select ONE channel
var validateAndAssignChannel = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In function validateAndAssignChannel');
  // Remove channels with 0 players strength
  // Get last index of channel with player count 0 as array is sorted
  var lastIndexOfZero = _.lastIndexOf(_.pluck(params.channelStrength, 'players'), 0);
  if(lastIndexOfZero >= 0) {
    var channelsWithZeroPlayers = params.channelStrength.slice(params.channelStrength, lastIndexOfZero+1);
    serverLog(stateOfX.serverLogType.info, 'Similar tables with 0 players are available! - ' + JSON.stringify(channelsWithZeroPlayers));
    params.channelStrength.splice(0, lastIndexOfZero+1);
    serverLog(stateOfX.serverLogType.info, 'Remaining tables with players are  - ' + JSON.stringify(params.channelStrength));
    if(params.channelStrength.length >= 1) {
      serverLog(stateOfX.serverLogType.info, 'Assiging table with less players (PLAYING OR WAITING) into it.');
      params.similarChannelId = params.channelStrength[0].channelId;
      serverLog(stateOfX.serverLogType.info, '1. Assigned channel id - ' + params.similarChannelId);
      cb(null, params);
    } else {
      serverLog(stateOfX.serverLogType.info, 'No table availabe who has players in it, assigning from 0 players table list.');
      params.similarChannelId = channelsWithZeroPlayers[0].channelId;
      serverLog(stateOfX.serverLogType.info, '2. Assigned channel id - ' + params.similarChannelId);
      cb(null, params);
    }
  } else {
    serverLog(stateOfX.serverLogType.info, 'No table availabe with 0 players, assiging table with less players (PLAYING OR WAITING) into it.');
    params.similarChannelId = params.channelStrength[0].channelId;
    serverLog(stateOfX.serverLogType.info, '3. Assigned channel id - ' + params.similarChannelId);
    cb(null, params);
  }
};


// Get all similar tables
// Get total playing players of that particular table and assign to channel
// Sort channel based on playing players
// Iterate over sorted channels and make sure if player is not joined into that particular channel
var assignChannelToPlayer = function(params, cb) {
  async.waterfall([

    async.apply(assignPlayersToChannel, params),
    sortChannelStrength,
    validateAndAssignChannel

  ], function(err, response){
    if(!err) {
      response.success = true;
      cb(response);
    } else {
      err.success = false;
      cb(err);
    }
  });
};

// Validated all the channels if any of it is suitable for request
var validateSuitableTable = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in similarTable function validateSuitableTable');
  keyValidator.validateKeySets("Request", "database", "validateSuitableTable", params, function(validated){
    if(validated.success) {
      serverLog(stateOfX.serverLogType.info, 'List of channel ids similar to query - ' + JSON.stringify(params.similarChannels));
      assignChannelToPlayer(params, function(assignChannelResponse){
        serverLog(stateOfX.serverLogType.info, 'Assign player response: ' + JSON.stringify(assignChannelResponse));
        if(assignChannelResponse.success) {
          cb(null, assignChannelResponse);
        } else {
          cb(assignChannelResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

// ### Create final response - just add similarChannelId
var createSimilarTbaleResponse = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in similarTable function createSimilarTbaleResponse');
  keyValidator.validateKeySets("Request", "database", "createSimilarTbaleResponse", params, function(validated){
    if(validated.success) {
      params.response = {
        success         : true,
        channelType     : params.channelType,
        similarChannelId: params.similarChannelId,
        channelId       : params.channelId 
      };
      cb(null, params.response);
    } else {
      cb(validated);
    }
  });
};

// deprecated
var validateResponse = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in similarTable function validateResponse');
  keyValidator.validateKeySets("Response", "database", "joinSimilarTable", params.response, function (validated){
    if(validated.success) {
      cb(null, params.response);
    } else {
      cb(validated);
    }
  });
};

// find similar configuration table
// for API - JOIN SIMILAR TABLE
similarTable.searchTable = function (params, cb) {
	keyValidator.validateKeySets("Request", "database", "searchTable", params, function(validated){
    if(validated.success) {
    	async.waterfall([

        async.apply(searchTableParams, params),
        searchSimilarTable,
        validateSuitableTable,
        createSimilarTbaleResponse

      ], function(err, response){
        if(!err) {
          serverLog(stateOfX.serverLogType.info, 'Response in search table - ' + JSON.stringify(response));
          cb(response);
        } else {
          serverLog(stateOfX.serverLogType.error, 'Error while searching table - ' + JSON.stringify(err));
          cb(err);
        }
      });
    } else {
      cb(validated);
    }
  });
};

module.exports = similarTable;
