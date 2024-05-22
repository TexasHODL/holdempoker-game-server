/*jshint node: true */
"use strict";

/* Created by Amrendra 02/08/2016 */

var _ld           = require("lodash"),
    _             = require('underscore'),
    async         = require('async'),
    stateOfX  = require("../../../../../shared/stateOfX"),
    zmqPublish      = require("../../../../../shared/infoPublisher"),
    keyValidator  = require("../../../../../shared/keysDictionary"),
    db            = require("../../../../../shared/model/dbQuery.js"),
    profileMgmt   = require("../../../../../shared/model/profileMgmt.js"),
    dynamicRanks  = require('../dynamicRanks.js'),
    prizeDistribution = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'prizeDistribution';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

serverLog(stateOfX.serverLogType.info, "dynamicRanks is in  prize distribution ",dynamicRanks);

var getPrizeRule = function(prizeId,params,callback) {
  db.getPrizeRule(prizeId, function(err, prizeRule) {
    if(err || !prizeRule) {
      serverLog(stateOfX.serverLogType.info, "getting prize Error");
      callback({success: false, info:"getting prize db Error !!!", isRetry: false, isDisplay: false, channelId: ""});
    } else {
      serverLog(stateOfX.serverLogType.info, "prizeRule is ",JSON.stringify(prizeRule));
      var prizePercent = prizeRule.list[0].playerprizepercent;//This is the prize percent for to be distributed
      serverLog(stateOfX.serverLogType.info, "playerprizepercent is ",prizePercent);
      params.table.tournamentRules.prizeRule = prizePercent; // Save the prize rule in params for furthur use
      callback({success: true, params: params});
    }
  });
};

//### Get prizeList from db and calculate prize to distribute
var getPrizeList = function(params, callback) {
  keyValidator.validateKeySets("Request", "database", "getPrizeList", params, function(validated){
    if(validated.success) {
      var tournamentId = params.table.tournamentRules.tournamentId;
      //Get the prizeId from room configuration
      db.getTournamentRoom(tournamentId, function(err, tournamentRoom) {
        if(err || !tournamentRoom) {
          serverLog(stateOfX.serverLogType.info, "getting tournamentRoom Error");
          callback({success: false, info:"getting tournamentRoom db Error !!!", isRetry: false, isDisplay: false, channelId: ""});
        } else {
          serverLog(stateOfX.serverLogType.info, "tournamentRoom is in getPrizeList is ",tournamentRoom);
          var prizeId = tournamentRoom.prizeRule;//This is the prize Id
          serverLog(stateOfX.serverLogType.info, "prizeId is ",prizeId);
          // By prizeId get the prize rule from prizerule table
          getPrizeRule(prizeId,params, function(response) {
            if(response.success) {
              callback(null,response.params);
            } else {
              callback(response);
            }
          });
        }
      });
    } else {
      callback(validated);
    }
  });
};

// var insertPrizeInDb = function(prizeArrayToInsert, params, prizes, totalPrize,callback) {
//   serverLog(stateOfX.serverLogType.info, "prizeArrayToInsert are - ",JSON.stringify(prizeArrayToInsert),JSON.stringify(prizes),totalPrize);
//   db.InsertInPrize(prizeArrayToInsert, function(err,prizeResponse) {
//     if(err) {
//       callback({success: false, info: "err in insertPrize", isRetry: false, isDisplay: false, channelId: ""});
//     } else {
//       // update the ranks object in params which can be used later for gift broadcast
//       serverLog(stateOfX.serverLogType.info, "prize response is",prizeResponse);
//       for(var i=0;i<params.table.tournamentRules.ranks.length; i++) {
//         if(!params.table.tournamentRules.ranks[i].isPrizeDistributed) {
//           var tempChips = 0;
//           var rank = params.table.tournamentRules.ranks[i].rank;
//           serverLog(stateOfX.serverLogType.info, "prizes[player.rank] ---",prizes[rank]);
//           serverLog(stateOfX.serverLogType.info, "prizes[player.rank].value--- ",prizes[rank-1].value);
//           if(params.table.tournamentRules.ranks[i].rank < prizes.length) {
//             tempChips = parseInt(totalPrize*prizes[rank-1].value * 0.01);
//           }
//           params.table.tournamentRules.ranks[i].isPrizeDistributed = true;
//           params.table.tournamentRules.ranks[i].isPrizeBroadcastSent = false;
//           params.table.tournamentRules.ranks[i].chipsWon = tempChips;
//         }
//       }
//       serverLog(stateOfX.serverLogType.info, "params.table.tournamentRules --" ,JSON.stringify(params.table.tournamentRules.ranks));
//       callback({success: true, params: params});
//     }
//   });
// };

//### Insert the prize record in prize table
var InsertInPrize = function(params, callback) {
  serverLog(stateOfX.serverLogType.info, "params in insertPrize is ",params);
  keyValidator.validateKeySets("Request", "database", "InsertInPrize", params, function(validated){
    if(validated.success) {
      var tournamentIdForDynamicRank,gameVersionCountForDynamicRank;
      //get the record of users who did not got prize
      var playerToDistribute = _.where(params.table.tournamentRules.ranks, {"isPrizeDistributed": false});
      serverLog(stateOfX.serverLogType.info, "player to distribute are ",JSON.stringify(playerToDistribute));
      // getting prize rule from params
      var prizes = params.table.tournamentRules.prizeRule;
      serverLog(stateOfX.serverLogType.info, "prizes is in InsertInPrize ",JSON.stringify(prizes));
      // Total prize which is to be distributed
      var totalPrize = (params.table.tournamentRules.entryFees - params.table.tournamentRules.houseFees)*params.table.tournamentRules.totalPlayer;
      serverLog(stateOfX.serverLogType.info, "totalPrize is ",totalPrize);
      var prizeArrayToInsert = [];
      //Iterate through the player array who did not got prize
      async.eachSeries(playerToDistribute, function(player, cb) {
        var chipsWon = 0;
        var tempObject = {};
        serverLog(stateOfX.serverLogType.info, "player is in async in insert in prize ",JSON.stringify(player));
        //If player is qualify for getting prize more than 0;
        if(player.rank < prizes.length) {
          // Calculate chips won using percent of prize on total prize
          chipsWon = parseInt(totalPrize*prizes[player.rank-1].value* 0.01);
        }
        Object.assign(tempObject,player);//copy player object to tempObject
        tempObject.chipsWon = chipsWon;
        tempObject.isPrizeDistributed = true;
        tempObject.gameVersionCount = params.table.gameVersionCount;
        tournamentIdForDynamicRank = player.tournamentId;
        gameVersionCountForDynamicRank = params.table.gameVersionCount;
        tempObject = _.omit(tempObject,'isPrizeDistributed','isPrizeBroadcastSent');
        serverLog(stateOfX.serverLogType.info, "temp Object in insertPrize in distributePrize ",tempObject);
        prizeArrayToInsert.push(tempObject);
        cb();
      }, function(err) {
        // This part will execute when prizeArrayToInsert array is filled
        if(err) {
          serverLog(stateOfX.serverLogType.info, "Error in async.Each in InsertInPrize");
          callback({success: false});
        } else {
          //Insert in prize collections
          callback(null,params);
          
          // insertPrizeInDb(prizeArrayToInsert, params, prizes,totalPrize, function(response) {
          //   if(response.success) {
          //     serverLog(stateOfX.serverLogType.info, "successfully prize insetred in db",JSON.stringify(response));
          //     serverLog(stateOfX.serverLogType.info, "tournamentIdForDynamicRank,gameVersionCountForDynamicRank  ",tournamentIdForDynamicRank,gameVersionCountForDynamicRank);
          //     dynamicRanks.getRegisteredTournamentUsers(tournamentIdForDynamicRank,gameVersionCountForDynamicRank);
          //     callback(null,params);
          //   } else {
          //     serverLog(stateOfX.serverLogType.info, "Error in prize insert");
          //     callback({success: false, info: "err in insertPrize", isRetry: false, isDisplay: false, channelId: ""});
          //   }
          // });
        }
      });
    } else {
      callback(validated);
    }
  });
};

//### update winning chips in user profile
var updateChipsInPlayerProfile = function(params, callback) {
  serverLog(stateOfX.serverLogType.info, "params in updateChipsInPlayerProfile is ",params);
  keyValidator.validateKeySets("Request", "database", "updateChipsInPlayerProfile", params, function(validated){
    if(validated.success) {
      //get users one by one from params
      var playerToUpdate = _.where(params.table.tournamentRules.ranks, {"isPrizeBroadcastSent": false});
      async.eachSeries(playerToUpdate, function(player, cb) {
      // update chips value in profile
      profileMgmt.addChips({playerId: player.playerId, chips: player.chipsWon, isRealMoney: player.isRealMoney}, function(addChipsResponse) {
        serverLog(stateOfX.serverLogType.info, "addChipsResponse is -",addChipsResponse);
        if(!addChipsResponse.success) {
          cb(addChipsResponse);
        }
        cb();
      });
     }, function() {
      callback(null, params);
     });
    } else {
      callback(validated);
    }
  });
};

var updateTournamentUsers = function(params, callback) {
  serverLog(stateOfX.serverLogType.info, "params in updateTournamentUsers is ",params);
  keyValidator.validateKeySets("Request", "database", "updateTournamentUsers", params, function(validated){
    if(validated.success) {
      var tournamentId = params.table.tournamentRules.tournamentId;
      var gameVersionCount = params.table.gameVersionCount;
      serverLog(stateOfX.serverLogType.info, "tournamentId is",tournamentId);
      serverLog(stateOfX.serverLogType.info, "params.table.gameVersionCount is ",gameVersionCount);
      var playerToUpdate = _.where(params.table.tournamentRules.ranks, {"isPrizeBroadcastSent": false});
      async.eachSeries(playerToUpdate, function(player, cb) {
        db.updateTournamentUser({playerId: player.playerId, tournamentId: tournamentId,gameVersionCount: gameVersionCount},{isActive: false}, function(err) {
          if(err) {
            cb(err);
          }
          serverLog(stateOfX.serverLogType.info, "set successfully isActive false");
          cb();
        });
      }, function() {
        callback(null, params);
      });
    } else {
      callback(validated);
    }
  });
};

// ### Distribute prize for tournament winners or player who participated
prizeDistribution.distributePrize = function (params,cb){
  keyValidator.validateKeySets("Request", "database", "distributePrize", params, function(validated){
    if(validated.success) {
      serverLog(stateOfX.serverLogType.info, "params in distributePrize ",JSON.stringify(params));
      async.waterfall([
        async.apply(getPrizeList, params),
        InsertInPrize,
        updateChipsInPlayerProfile,
        updateTournamentUsers
        //fireBroadcastForPrizeAndRank,
      ],function(err, response){
        if(err) {
          cb(err);
        } else {
          serverLog(stateOfX.serverLogType.info, "final response is in distributePrize is ",JSON.stringify(response));
          cb({success:true ,params:response});
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.info, "distributePrize function key match failed ",JSON.stringify(validated));
      cb({success:false});
    }
  });
};



module.exports = prizeDistribution;
