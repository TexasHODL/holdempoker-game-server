/*jshint node: true */
"use strict";

/**
* Created by Abhishek on 19/05/2017.
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
var timeBankRemote = {};
// FILE related to tournament

/**
 * create data for log generation  
 *
 * @method serverLog
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
function serverLog (type, log) {
  var logObject          = {};
  logObject.fileName     = 'timeBankRemote';
  logObject.serverName   = stateOfX.serverType.database;
  // logObject.functionName = arguments.callee.caller.name.toString();
  logObject.type         = type;
  logObject.log          = log;
  zmqPublish.sendLogMessage(logObject);
}


// var getTimeBank = function(params, cb) {
//   serverLog(stateOfX.serverLogType.info,"in getTimeBank in timeBankRemote" + JSON.stringify(params));
//   // db.getTournamentRoom((params.table.tournamentRules.tournamentId).toString(), function(err, tournamentRoom) {
//   //   if(err || !tournamentRoom) {
//   //     cb(params);
//   //   } else {
//   //     db.findBlindRule(tournamentRoom.blindRule, function(err, blindRuleResponse) {
//   //       if(err || !blindRuleResponse) {
//   //         cb(params);
//   //       } else {
//   //         serverLog(stateOfX.serverLogType.info, "blindRule is in getBlindRule in blindUpdate is -- " + JSON.stringify(blindRuleResponse));
//   //         params.blindRule = blindRuleResponse.list; 
//   //         cb(null, params); 
//   //       }
//   //     })
//   //   }
//   // })
//   cb(null,params);
// }



/**
 * this function is used to update time bank 
 *
 * @method processTimeBank
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var processTimeBank = function(params,cb){
  serverLog(stateOfX.serverLogType.info,"in processTimeBank in timeBankRemote" + JSON.stringify(params));
  var timeBankLevelForUpdate = params.table.timeBankLevel;       //get the timeBankLevel for which update is required 
  var timeBankRule = params.table.timeBankRuleData;
  var timeBankValue ;
  serverLog(stateOfX.serverLogType.info,"in processTimeBank in timeBankRemote timeBankRule is" + JSON.stringify(timeBankRule));
  serverLog(stateOfX.serverLogType.info,"in processTimeBank in timeBankRemote timeBankLevelForUpdate is" + JSON.stringify(timeBankLevelForUpdate));
  for(var i = 0 ; i<timeBankRule.length;i++){
      if(timeBankRule[i].blindLevel == timeBankLevelForUpdate){    //if the timeBankRule blindlevel is equal to timeBankLevel for update
        timeBankValue = timeBankRule[i].time;               // get the first timeBankValue
        break;
      }
  }
  serverLog(stateOfX.serverLogType.info,"in processTimeBank in timeBankRemote timeBankValue is" + timeBankValue);
  serverLog(stateOfX.serverLogType.info,"in processTimeBank in timeBankRemote timeBankValue is" + timeBankRule[i + 1],i);
  serverLog(stateOfX.serverLogType.info,"in processTimeBank in timeBankRemote timeBankValue is" + timeBankRule[i]);
  params.table.timeBankLevel = !!timeBankRule[i + 1]?timeBankRule[i + 1].blindLevel : timeBankRule[i].blindLevel;
  serverLog(stateOfX.serverLogType.info,"in processTimeBank in timeBankRemote params.table.timeBankLevel is" + params.table.timeBankLevel); 
  for(var i = 0 ; i < params.table.players.length ; i++){                            
      if(params.table.players[i].tournamentData.timeBankLeft === -1){    //if the time bank left is equal to -1 then 1 extra value needs to be added
        params.table.players[i].tournamentData.totalTimeBank = params.table.players[i].tournamentData.totalTimeBank + timeBankValue ;
        params.table.players[i].tournamentData.timeBankLeft = params.table.players[i].tournamentData.timeBankLeft + timeBankValue + 1 ;
      }
      else{             //for each player add the timeBankValue in totalTimeBank and Time bank left 
        params.table.players[i].tournamentData.totalTimeBank = params.table.players[i].tournamentData.totalTimeBank + timeBankValue ;
        params.table.players[i].tournamentData.timeBankLeft = params.table.players[i].tournamentData.timeBankLeft + timeBankValue ;
      }
  }
  serverLog(stateOfX.serverLogType.info,"in processTimeBank in timeBankRemote players are " + JSON.stringify(params.table.players));
  cb(null,params);

};



/**
 * This function consists of a series of async functions to update time bank
 *
 * @method updateTimeBank
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
timeBankRemote.updateTimeBank = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "params is in updateTimeBank in timeBank Remote is -- " + JSON.stringify(params));
  async.waterfall([
    async.apply(processTimeBank,params)
  ], function(err,result) {
    if(err) {
      serverLog(stateOfX.serverLogType.info, "There is ERROR in updateTimeBank ");
      cb({success: false});
    } else {
      serverLog(stateOfX.serverLogType.info, "The result in updateTimeBank is ----- ", result);
      //delete result.params.temp
      cb({success: true,params:result });
    }
  });
};





module.exports = timeBankRemote;
