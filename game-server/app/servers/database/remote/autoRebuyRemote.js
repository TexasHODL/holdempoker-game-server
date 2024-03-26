/*jshint node: true */
"use strict";


/**
* Created by Abhishek on 25/05/2017.
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
var autoRebuyRemote = {};


/**
 * this function is used to Create data for log generation
 *
 * @method logJoinChannel
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
function serverLog (type, log) {
  var logObject          = {};
  logObject.fileName     = 'autoRebuyRemote';
  logObject.serverName   = stateOfX.serverType.database;
  // logObject.functionName = arguments.callee.caller.name.toString();
  logObject.type         = type;
  logObject.log          = log;
  zmqPublish.sendLogMessage(logObject);
}






/**
 * this function is used to getTournamentRoom
 *
 * @method logJoinChannel
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var getTournamentRoom = function(params,cb){
  serverLog(stateOfX.serverLogType.info, "params is in getTournamentRoom in autoRebuyRemote is -- " + JSON.stringify(params));
  params.temp = {};
  db.getTournamentRoom((params.table.tournamentRules.tournamentId).toString(), function(err, tournamentRoom) { //getTournamment Room according to tournament id
		if(!err && tournamentRoom) {
			serverLog(stateOfX.serverLogType.info, "params is in dbQuery getTournamentRoom in autoRebuyRemote  -- " + JSON.stringify(tournamentRoom));
      if(tournamentRoom.isRebuyOpened === false){
        serverLog(stateOfX.serverLogType.info, "Rebuy is not open now " );
        cb(params);
      }
      else{
        params.temp.tournamentRoom = tournamentRoom;
			  cb(null,params);
      }
		} else {
			serverLog(stateOfX.serverLogType.info, "Error in getting tournament room  -- " );
			cb(params);
		}
	});
};

  
/**
 * this function is used to update the value of chips and rebuy count for every player through a series of async calls
 *
 * @method logJoinChannel
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var autoRebuyProcess = function(params,cb){
  serverLog(stateOfX.serverLogType.info, "params is in autoRebuyProcess in autoRebuyRemote is -- " + JSON.stringify(params));
  async.eachSeries(params.table.players, function(player, callback) {
    if(player.isAutoReBuyEnabled){ // if autoRebuy for any player is allowed then on
      var tempParams = {};
      tempParams.playerId = player.playerId;
      tempParams.gameVersionCount = params.table.gameVersionCount;
      tempParams.noOfChipsAtGameStart = params.table.noOfChipsAtGameStart;
      tempParams.tournamentId = params.table.tournamentRules.tournamentId;
      tempParams.tournamentRoom = params.temp.tournamentRoom;
      tempParams.chips        = player.chips;

      console.log("Temp params in autoRebuyRemote is ", tempParams);
      console.log("current player in players is  ",player);
      async.waterfall([
        async.apply(countRebuyAlreadyOpt,tempParams),
        isEligibleForRebuy,
        deductChips,
        updateRebuyCount
      ], function(err,result) {
        if(err) {
          callback();
        } else {
          player.chips = player.chips + params.temp.tournamentRoom.noOfChipsAtGameStart;
          callback();
        }
     });
    }else{
      console.log("current player in players is ----- ", player);
      callback();
    }
  }, function(err) {
    if(err) {
      console.log("ERROR IN AUTOREBUY REMOTE");
      cb(err);
    } else {
      console.log("NO ERROR IN AUTOREBUY REMOTE",params);
      cb(null,params);
    }
  });
  
};

/**
 * this function is used to check if rebuy is already opted
 *
 * @method countRebuyAlreadyOpt
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var countRebuyAlreadyOpt = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, "params is in countRebuyAlreadyOpt in autoRebuyRemote  " + JSON.stringify(params));
  var filter = {
    tournamentId     : params.tournamentId,
    gameVersionCount : params.gameVersionCount,
    playerId         : params.playerId
  };
	db.countRebuyOpt(filter, function(err, rebuy) {
		serverLog(stateOfX.serverLogType.info, "rebuy is in countRebuyAlreadyOpt in autoRebuy handler " +rebuy);
		if(!err) {
			params.rebuyCount = (!!rebuy && !!rebuy.rebuyCount) ? rebuy.rebuyCount : 0;
      params.rebuyObj = !!rebuy ? rebuy : null;
			cb(null, params);
		} else {
      cb({success: false});
		}
	});
};

/**
 * this function is used to check player is eligible for rebuy
 *
 * @method logJoinChannel
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var isEligibleForRebuy = function(params,cb) {
  serverLog(stateOfX.serverLogType.info, "params is in isEligibleForRebuy in autoRebuyHandler " + JSON.stringify(params));
  serverLog(stateOfX.serverLogType.info,'in isEligibleForRebuy - ' + JSON.stringify(params.tournamentRoom));
  var rebuyTime = params.tournamentRoom.tournamentStartTime + params.tournamentRoom.rebuyTime*60000;
  var currentTime = Number(new Date());
  serverLog(stateOfX.serverLogType.info, "rebuy and currentTime is in isEligibleForRebuy is - " + rebuyTime + "  " + currentTime + " "+params.rebuyCount );
  serverLog(stateOfX.serverLogType.info, "user current chips is in isEligibleForRebuy is - " + params.chips );
  
  if(params.tournamentRoom.state === stateOfX.tournamentState.running && params.rebuyCount < params.tournamentRoom.numberOfRebuy && params.chips < params.tournamentRoom.rebuyMaxLimitForChips && rebuyTime>currentTime) {
    serverLog(stateOfX.serverLogType.info, "state is running and rebuyCount <  in isEligibleForRebuy");
    cb(null, params);

  } else {
    serverLog(stateOfX.serverLogType.info, "player is not eligible for rebuy in isEligibleForRebuy in autoRebuy");
    cb({success: false});
  }
};

/**
 * this function is used to deduct player chips
 *
 * @method logJoinChannel
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var deductChips = function(params,cb){
  serverLog(stateOfX.serverLogType.info, "params is in deductChips in autoRebuyRemote " + JSON.stringify(params));
  profileMgmt.deductChips({playerId:params.playerId, chips: params.tournamentRoom.buyIn, isRealMoney : params.tournamentRoom.isRealMoney}, function(deductChipsResponse) {
    serverLog(stateOfX.serverLogType.info, "deduct chips response is - " + JSON.stringify(deductChipsResponse));
    if(deductChipsResponse.success) {
      cb(null, params);
    } else {
      cb({success: false});
    }
  });
};


/**
 * this function is used to update the rebuy count
 *
 * @method updateRebuyCount
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var updateRebuyCount = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, "params.rebuyCount is in updateRebuyCount in autoRebuyRemote  " + params.rebuyCount);
	var query = {
		playerId     		 : params.playerId,
		tournamentId 		 : params.tournamentId,
		gameVersionCount : params.tournamentRoom.gameVersionCount
	};
	var updatedData = {
		playerId     		 : params.playerId,
		tournamentId 		 : params.tournamentId,
		gameVersionCount : params.tournamentRoom.gameVersionCount,
		rebuyCount       : params.rebuyCount + 1,
    addOn            : (!!params.rebuyObj && !!params.rebuyObj.addOn) ? params.rebuyObj.addOn : 0,
		isEligibleForAddon: (!!params.rebuyObj && !!params.rebuyObj.isEligibleForAddon) ? params.rebuyObj.isEligibleForAddon : false
	};
	db.updateRebuy(query, updatedData, function(err, result) {
		if(!!result) {
			cb(null, {success: true});
		} else {
      cb({success: false});
		}
	});
};

/**
 * this function is used to update the rebuy count
 *
 * @method updateAutoRebuy
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
autoRebuyRemote.updateAutoRebuy = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "params is in updateAutoRebuy in autoRebuyRemote is -- " + JSON.stringify(params));
  async.waterfall([
    async.apply(getTournamentRoom,params),
    autoRebuyProcess
  ], function(err,result) {
    console.log("in updateAutoRebuy - ",err,result);
    if(err) {
      serverLog(stateOfX.serverLogType.info, "There is ERROR in updateAutoRebuy ");
      cb({success: true,params:params});
    } else {
      serverLog(stateOfX.serverLogType.info, "The result in updateAutoRebuy is ----- "+ JSON.stringify(result));
      // delete result.params.temp;
      if(!!result.temp){
        delete result.temp ;
      }
      cb({success: true,params:result});
    }
  });
};





module.exports = autoRebuyRemote;

