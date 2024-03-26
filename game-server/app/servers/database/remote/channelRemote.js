/*jshint node: true */
"use strict";


/**
* Created by Amrendra on 18/07/2016.
**/
var async         = require("async"),
  _ld           = require("lodash"),
  _             = require('underscore'),
  stateOfX      = require("../../../../shared/stateOfX"),
  popupTextManager  = require("../../../../shared/popupTextManager"),
  keyValidator  = require("../../../../shared/keysDictionary"),
  db            = require('../../../../shared/model/dbQuery'),
  imdb          = require("../../../../shared/model/inMemoryDbQuery.js"),
  zmqPublish    = require("../../../../shared/infoPublisher"),
  channelRemote = {};

// Create data for log generation
function serverLog (type, log) {
var logObject = {};
logObject.fileName      = 'channelRemote';
logObject.serverName    = stateOfX.serverType.database;
// logObject.functionName  = arguments.callee.caller.name.toString();
logObject.type          = type;
logObject.log           = log;
zmqPublish.sendLogMessage(logObject);
}

// ### Add additional params in existing one for calculation

var setSearchChannelParams = function(params, cb) {
serverLog(stateOfX.serverLogType.info, 'in channelRemote - setSearchChannelParams');
keyValidator.validateKeySets("Request", "database", "setSearchChannelParams", params, function(validated){
  if(validated.success) {
    params.channelDetails = {};
    params.response = {};
    cb(null, params);
  } else {
    cb(validated);
  }
});
};

// ### Get a final channel ID if available

var searchChannel = function(params, cb) {
serverLog(stateOfX.serverLogType.info, 'in channelRemote - searchChannel');
keyValidator.validateKeySets("Request", "database", "searchChannel", params, function(validated){
  if(validated.success) {
    // Check if this is a tournament request then search for an instance
    if(!params.channelId) {
      imdb.findTableByTournamentId(params.channelId, params.playerId, function(err, channel) {
        if(err) {
          cb(params);
        } else {
          serverLog(stateOfX.serverLogType.info, "channel is in seach channel",JSON.strigify(channel));
          params.channelId = channel.channelId;
          cb(null, params);
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.info, "channelRemote-in searchChannel else");
      cb(null, params);
    }
  } else {
    cb(validated);
  }
});
};

// ### Get this channel details from database wired tiger

var getChannelDetails = function(params, cb) {
serverLog(stateOfX.serverLogType.info, 'in channelRemote - getChannelDetails');
keyValidator.validateKeySets("Request", "database", "getChannelDetails", params, function(validated){
  if(validated.success) {
    serverLog(stateOfX.serverLogType.info, 'About to get table form main db');
    db.findTableById(params.channelId, function (err, channel) {
      serverLog(stateOfX.serverLogType.info, 'err and channel');
      serverLog(stateOfX.serverLogType.info, err);
      serverLog(stateOfX.serverLogType.info, channel);
      if(!err && !!channel) {
        serverLog(stateOfX.serverLogType.info, "Channel details from main db: " + JSON.stringify(channel));
        params.channelDetails = channel;
        if(channel.channelType === stateOfX.gameType.tournament) {
          db.getTournamentRoom(channel.tournament.tournamentId, function(err, tournamentRoom) {
            if(err || !tournamentRoom) {
              serverLog(stateOfX.serverLogType.info, "Error in setting gameVersionCount in getChannelDetails");
              cb(params);
            } else {
              serverLog(stateOfX.serverLogType.info, "tournamentRoom is in getChannelDetails - ",JSON.stringify(tournamentRoom));
              params.channelDetails.gameVersionCount = tournamentRoom.gameVersionCount;
              cb(null, params);
            }
          });
        } else {
          cb(null, params);
        }
      } else {
        cb({success: false, channelId: params.channelId, isRetry: false, isDisplay: false, info: popupTextManager.dbQyeryInfo.DB_CHANNEL_NOTFOUND });
      }
    });
  } else {
    cb(validated);
  }
});
};

// ### Get rake rule for this channel

var assignRakeRule = function (params, cb) {
  if(params.channelDetails.channelType === stateOfX.gameType.normal) {
    serverLog(stateOfX.serverLogType.info, 'Getting rake rule for this channel using id - ' + JSON.stringify(params.channelDetails.rakeRule));
    // db.getRakeRuleById(params.channelDetails.rakeRule, function(err, rakeRuleResponse) {
    //   if(err || !rakeRuleResponse) {
    //      cb({success: false, channelId: params.channelId, isRetry: false, isDisplay: false, info: popupTextManager.dbQyeryInfo.DB_ERROR_GETTING_RAKE_RULE });
    //     // cb({success: false, channelId: params.channelId, info:"Unable to get rake rule for this table."});
    //   } else {
    //     serverLog(stateOfX.serverLogType.info, "rakeRuleResponse is " + JSON.stringify(rakeRuleResponse));
    //     // Get proper rake rule for this table
    //     // If blind matches with rake rule from database
    //     for (var i = 0; i < rakeRuleResponse.list.length; i++) {
    //       serverLog(stateOfX.serverLogType.info, rakeRuleResponse.list[i].minStake === params.channelDetails.smallBlind)
    //       if(rakeRuleResponse.list[i].minStake === params.channelDetails.smallBlind && rakeRuleResponse.list[i].maxStake === params.channelDetails.bigBlind) {
    //         serverLog(stateOfX.serverLogType.info, 'Rake rule, Match found !!');
    //         params.channelDetails.rake = rakeRuleResponse.list[0]
    //         break;
    //       }
    //     }
    //   }
    //   serverLog(stateOfX.serverLogType.info, params.channelDetails.rakeRule)
    //   cb(null, params);
    // });
    params.channelDetails.rake = params.channelDetails.rake;
  } else {
    serverLog(stateOfX.serverLogType.info, 'Not assigning rake rule as Game type is - ' + params.channelDetails.channelType);
    cb(null, params);
  }
};

// ### Create final response using details from database

var createChannelResponse = function(params, cb) {
serverLog(stateOfX.serverLogType.info, 'in channelRemote - createChannelResponse' + JSON.stringify(params.channelDetails));
keyValidator.validateKeySets("Request", "database", "createChannelResponse", params, function(validated){
  if(validated.success) {
    cb(null, {
      success         : true,
      channelId       : params.channelId,
      channelType     : params.channelType,
      tableId         : params.tableId,
      channelDetails  : {
        channelId             : params.channelId,
        channelType           : params.channelDetails.channelType,
        channelName           : params.channelDetails.channelName,
        channelVariation      : params.channelDetails.channelVariation,
        turnTime              : params.channelDetails.turnTime,
        maxPlayers            : params.channelDetails.maxPlayers,
        minPlayers            : params.channelDetails.minPlayers,
        smallBlind            : params.channelDetails.smallBlind,
        bigBlind              : params.channelDetails.bigBlind,
        ante                  : params.channelDetails.ante,
        isStraddleEnable      : params.channelDetails.isStraddleEnable,
        runItTwiceEnable      : params.channelDetails.runItTwiceEnable,
        minBuyIn              : params.channelDetails.minBuyIn,
        maxBuyIn              : params.channelDetails.maxBuyIn,
        numberOfRebuyAllowed  : params.channelDetails.numberOfRebuyAllowed,
        hourLimitForRebuy     : params.channelDetails.hourLimitForRebuy,
        gameInfo              : params.channelDetails.gameInfo,
        rakeRule              : params.channelDetails.rakeRule,
        rake                  : params.channelDetails.rake,
        gameInterval          : params.channelDetails.gameInterval,
        isPotLimit            : params.channelDetails.isPotLimit,
        isPrivate             : JSON.parse(params.channelDetails.isPrivateTabel) || false,
        password              : params.channelDetails.passwordForPrivate || '123',
        isRealMoney           : params.channelDetails.isRealMoney,
        rebuyHourFactor       : params.channelDetails.rebuyHourFactor,
        blindMissed           : params.channelDetails.blindMissed,
        tournament            : params.channelDetails.tournament,
        tournamentName        : params.channelDetails.tournamentName || "",
        noOfChipsAtGameStart  : params.channelDetails.noOfChipsAtGameStart,
        isForceRit            : params.channelDetails.isRunItTwice || false,
        gameVersionCount      : params.channelDetails.gameVersionCount || 0
      }
    });
  } else {
    cb(validated);
  }
});
};

/**
 * search for a table in wired tiger DB
 * at time of first join
 * @method processSearch
 * @param  {Object}      params contains channelId mainly
 * @param  {Function}    cb     callback
 */
channelRemote.processSearch = function (params, cb) {
keyValidator.validateKeySets("Request", "database", "processSearch", params, function(validated){
  if(validated.success) {
    async.waterfall([

      async.apply(setSearchChannelParams, params),
      searchChannel,
      getChannelDetails,
      // assignRakeRule,
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

module.exports = channelRemote;
