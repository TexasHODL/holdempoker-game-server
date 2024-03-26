/*jshint node: true */
"use strict";

/**
* Created by Nishant on 19/05/2017.
**/
var async             = require("async"),
   _ld                = require("lodash"),
   _                  = require('underscore'),
   stateOfX           = require("../../../../shared/stateOfX"),
   keyValidator       = require("../../../../shared/keysDictionary"),
   imdb               = require("../../../../shared/model/inMemoryDbQuery.js"),
   mongodb            = require('../../../../shared/mongodbConnection'),
   db                 = require("../../../../shared/model/dbQuery.js"),
   zmqPublish         = require("../../../../shared/infoPublisher"),
   profileMgmt        = require("../../../../shared/model/profileMgmt"),
   infoMessage        = require("../../../../shared/popupTextManager").falseMessages,
   dbInfoMessage      = require("../../../../shared/popupTextManager").dbQyeryInfo,
   activity           = require("../../../../shared/activity"),
   deductRake         = require('./utils/deductRake'),
   decideWinner       = require('./utils/decideWinner'),
   summary            = require("./utils/summaryGenerator"),
   setMove            = require('./setMove'),
   adjustIndex        = require('./adjustActiveIndex'),
   calculateRanks     = require('./calculateRanks.js'),
   manageBounty       = require('./manageBounty.js'),
   blindUpdate        = require('./blindUpdate'),
   potsplit           = require('./potsplit'),
   tableManager       = require("./tableManager"),
   winnerRemote       = require("./winnerRemote"),
   tableConfigManager = require("./tableConfigManager");
   // rewardRake         = require("./rewardRake");


// var handleGameOver = {};
var autoAddonRemote = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject          = {};
  logObject.fileName     = 'autoAddonRemote';
  logObject.serverName   = stateOfX.serverType.database;
  // logObject.functionName = arguments.callee.caller.name.toString();
  logObject.type         = type;
  logObject.log          = log;
  zmqPublish.sendLogMessage(logObject);
}


/**
 * get tournament room from tournament id
 * @method getTournamentRoom
 * @param  {[type]}   params request json object
 * @param  {Function} cb     callback function
 * @return {[type]}          validated/params
 */
var getTournamentRoom = function(params, cb){
  serverLog(stateOfX.serverLogType.info, "in getTournamentRoom in autoAddonRemote " + JSON.stringify(params));
  db.getTournamentRoom(params.table.tournamentRules.tournamentId.toString(), function(err, result){
    if(!err && result){
      params.tournamentRoom = result;
      cb(null, params);
    }
    else{
      cb(params);
    }
  });
};


/**
 * get autoAddon for Each Player
 * @method autoAddonForEachPlayer
 * @param  {[type]}   params request json object
 * @param  {Function} cb     callback function
 * @return {[type]}          validated/params
 */
var autoAddonForEachPlayer = function(params, cb){
  serverLog(stateOfX.serverLogType.info, "in autoAddonForEachPlayer in autoAddonRemote " + JSON.stringify(params));
  serverLog(stateOfX.serverLogType.info, "in autoAddonForEachPlayer in autoAddonRemote table " + JSON.stringify(params.table));
  async.eachSeries(params.table.players, function(player, ecb) {
      if(player.isAutoAddOnEnabled){
      var newParams = {};
      newParams.tournamentRoom = params.tournamentRoom;
      newParams.tournamentId = params.table.tournamentRules.tournamentId.toString();
      newParams.gameVersionCount = params.table.tournamentRules.gameVersionCount;
      newParams.player = player;
      newParams.blindLevel = params.table.blindLevel;
      console.log("newParams...........", newParams);
      async.waterfall([
        async.apply(checkForAddonTime, newParams),
        checkAddOnAlreadyOpt,
        updateChips
        ], function(err, result){
          console.log("err result in autoAddonForEachPlayer", err, result);
          if(!err && !!result) {
            player.chips = player.chips + params.tournamentRoom.addonRule.tournamentChips;
            ecb();
          } else {
            ecb();
          }
      });
      
    }
    else{
      ecb();
    }

  }, function(err, result){
    cb(null, params);

  });
};


/**
 * check whether addon time has started
 * @method checkForAddonTime
 * @param  {[type]}   params request json object
 * @param  {Function} cb     callback function
 * @return {[type]}          validated/params
 */
var checkForAddonTime = function(params, cb){
  serverLog(stateOfX.serverLogType.info, "params is in checkForAddonTime in autoAddonRemote "  + JSON.stringify(params) );
  var addonTimeExist = _.where(params.tournamentRoom.addonTime, {level: params.blindLevel});
  if(!!addonTimeExist && !!addonTimeExist[0]) {
    cb(null,params);
  } else {
    cb({success: false, info: "Something went wrong"});
  }
};

/**
 * check if the player is eligible for add on
 * @method checkAddOnAlreadyOpt
 * @param  {[type]}   params request json object
 * @param  {Function} cb     callback function
 * @return {[type]}          validated/params
 */
var checkAddOnAlreadyOpt = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "params is in checkAddOnAlreadyOpt in autoAddonRemote " + JSON.stringify(params) );
  var filter = {
    tournamentId     : params.tournamentId,
    gameVersionCount : params.gameVersionCount,
    playerId         : params.player.playerId
  };
  db.countRebuyOpt(filter, function(err, rebuy) {
    if(!err) {
      var rebuyCount, addOn, isEligibleForRebuy = false;
      if(!rebuy) {
        rebuyCount = 0;
        addOn      = params.tournamentRoom.addonRule.tournamentChips;
        isEligibleForRebuy = true;
      } else {
        addOn = rebuy.addOn + params.tournamentRoom.addonRule.tournamentChips;
        isEligibleForRebuy = rebuy.isEligibleForRebuy;
        rebuyCount = rebuy.rebuyCount;
      }
      if(isEligibleForRebuy) {
        var query = {
          playerId         : params.player.playerId,
          tournamentId     : params.tournamentId,
          gameVersionCount : params.gameVersionCount
        };
        var updatedData = {
          playerId         : params.player.playerId,
          tournamentId     : params.tournamentId,
          gameVersionCount : params.gameVersionCount,
          rebuyCount       : rebuyCount,
          addOn            : addOn,
          isEligibleForAddon : false
        };
        db.updateRebuy(query, updatedData, function(err, result) {
          if(!!result) {
            console.log("err result in updateRebuy autoAddonRemote", err, result);
            cb(null, params);
          } else {
            cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: dbInfoMessage.DBUPDATEREBUY_REBUYHANDLER});
          }
        });
      } else {
        cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: "you are not eligible for rebuy"});
      }
    } else {
      cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: "db Error in getting addon"});
    }
  });
};

/**
 * update chips of player according to add on
 * @method updateChips
 * @param  {[type]}   params request json object
 * @param  {Function} cb     callback function
 * @return {[type]}          validated/params
 */
var updateChips = function(params, cb){
  serverLog(stateOfX.serverLogType.info, "in checkAddonEligibility in autoAddonForEachPlayer autoAddonRemote "+ JSON.stringify(params));
  var deductChipsQuery = {};
  deductChipsQuery.playerId = params.player.playerId;
  deductChipsQuery.chips = params.tournamentRoom.addonRule.mainAccountChips;
  deductChipsQuery.isRealMoney = params.tournamentRoom.isRealMoney;
  profileMgmt.deductChips(deductChipsQuery, function(response){
    console.log("response in updateChips", response);
    if(response){
      cb(null, params);
    }
    else{
      cb(params);    
    }
  });
  
};





/**
 * the complete addon process starts here
 * @method autoAddonProcess
 * @param  {[type]}   params request json object
 * @param  {Function} cb     callback function
 * @return {[type]}          validated/params
 */
autoAddonRemote.autoAddonProcess = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "params is in autoAddonProcess in autoAddonRemote is -- " + JSON.stringify(params));
  async.waterfall([
    async.apply(getTournamentRoom, params),
    autoAddonForEachPlayer,
  ], function(err,result) {
    console.log("err, result in autoAddonProcess", err, result);
    if(!err && result) {
      serverLog(stateOfX.serverLogType.info, "The result in autoAddonProcess is ----- " + result);
      cb({success: true, params:result });
    } else {
      serverLog(stateOfX.serverLogType.info, "There is ERROR in autoAddonProcess ");
      cb({success: false});
    }
  });
};




module.exports = autoAddonRemote;
