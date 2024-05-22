/*jshint node: true */
"use strict";


// Created by sushil on 3/11/2016
// This file handles the breakManagement part of tournament

var async         = require('async'),
  stateOfX        = require("../../../../shared/stateOfX"),
  db              = require('../../../../shared/model/dbQuery.js'),
  zmqPublish      = require("../../../../shared/infoPublisher"),
  _               = require("underscore"),
  popupTextManager= require("../../../../shared/popupTextManager"),
  imdb            = require('../../../../shared/model/inMemoryDbQuery.js');

var breakManagement = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'breakManagement';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

/**
 * function to getChannel 
 *
 * @method getChannel
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var getChannel = function(params, cb) {
  // serverLog(stateOfX.serverLogType.info,"in getchannel in breakManagement - " + JSON.stringify(params));
  imdb.getTable(params.channelId, function(err, channel) {
    if(err) {
      cb({success : false, isRetry: false, isDisplay: false, channelId: (params.channelId || "") ,  info:popupTextManager.dbQyeryInfo.DB_ERROR_GETTING_CHANNEL_MEMORYDB});
    } else {
      // serverLog(stateOfX.serverLogType.info,"channel is in break management" + JSON.stringify(channel));
      //break is only allowed in normal tournaments
      params.breakLevel = channel.breakLevel;
      if(channel.channelType === stateOfX.gameType.tournament && channel.tournamentType === stateOfX.tournamentType.normal) {
        params.channelDetails = channel;
        cb(null, params);
      } else {
        serverLog(stateOfX.serverLogType.info,"this is not a normal tournament");
        // return this and handle it in ot error part
        cb({success: true, eligibleForBreak : false});
      }
    }
  });

};

/**
 * this function is to check whether the current time is suitable for break or not according to the breakLevel 
 *
 * @method isEligibleForBreak
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var isEligibleForBreak = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,"params is in isItTimeToBreak is - " + JSON.stringify(params));
  //var breakTime = params.channelDetails.tournamentStartTime + params.channelDetails.tournamentBreakTime*60000;
  //var endBreakTime = breakTime + params.channelDetails.tournamentBreakDuration*60000;
  var levelForBreakTime = params.channelDetails.breakLevel; //find the current level so that the value of breakTime and breakDuration can be fetched
  serverLog(stateOfX.serverLogType.info,"levelForBreakTime is " + levelForBreakTime);
  if(params.breakRuleData.rule[levelForBreakTime] == undefined){  //if level does not exist in the collection breakRules then break can't be done
    return cb({success : true , eligibleForBreak : false});
  }
  
  var breakTime = params.channelDetails.tournamentStartTime + params.breakRuleData.rule[levelForBreakTime].timeAfterTournamentStart*60000;
  var endBreakTime = breakTime + params.breakRuleData.rule[levelForBreakTime].breakDuration*60000;  //computes when the breakTime for the current breakLevel will end
  serverLog(stateOfX.serverLogType.info,"breakTime  is ---- " + breakTime + "endBreakTime is - " + endBreakTime);
  var currentTime = Number(new Date());
  serverLog(stateOfX.serverLogType.info,'breakTime ' + breakTime + " endBreakTime " + endBreakTime + " currentTime " + currentTime);
  if(currentTime >= breakTime && currentTime <= endBreakTime) {
    serverLog(stateOfX.serverLogType.info,"it is right time for break");
    params.eligibleForBreak = true;
    //update isOnBreak in inMemoryDb
    imdb.updateSeats(params.channelId,{isOnBreak : true}, function(err, result) {    //set the isOnBreak key to true to ensure that break is started
      if(err) {
        serverLog(stateOfX.serverLogType.info,"Error in updating isOnBreak key");
        // cb({success : false, info: "Error in updating isOnBreak key"})
        cb({success : false, isRetry: false, isDisplay: false, channelId: (params.channelId || "") ,  info: popupTextManager.dbQyeryInfo.DB_ERROR_UPDATE_KEY});
      } else {
        cb(null, params);
      }
    });
  } else {
    cb({success : true , eligibleForBreak : false});
  }
};


/**
 * function to getBreakRule according to the breakRuleId 
 *
 * @method getBreakRule
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var getBreakRule = function(params,cb){
  serverLog(stateOfX.serverLogType.info,"params inside getBreakRule is  - " + JSON.stringify(params));
  db.findBreakRule(params.channelDetails.breakRuleId,function(err,result){  //getBreakRule according to the breakRuleId
      if(!err && result){
        serverLog(stateOfX.serverLogType.info,"The result in findBreakRule is  - " + JSON.stringify(result));
        params.breakRuleData = result;     //send the breakRule Data to the function isEligible for break
        cb(null,params);
      }else{
        serverLog(stateOfX.serverLogType.info,"Some error occured or blind Rule not found" );
        cb({ success: false});
      }
    });
};

/**
 * function isTimeToStartBreakTimer  
 *
 * @method isTimeToStartBreakTimer
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var isTimeToStartBreakTimer = function(params, cb) {
  var filter = {
    tournamentId : params.channelDetails.tournamentRules.tournamentId,
    gameVersionCount : params.channelDetails.gameVersionCount
  };
  imdb.getAllTableByTournamentId(filter, function(err, channels) {
    if(err) {
      cb({success : false, isRetry: false, isDisplay: false, channelId:'',  info:popupTextManager.dbQyeryInfo.DB_ERROR_GETTING_CHANNEL_MEMORY});
    } else {
      var runningChannels = 0;
      var onBreakChannels = 0;
      params.allChannels  = _.pluck(channels, "channelId");
      for(var channelIt = 0; channelIt < channels.length; channelIt++) {
        if(channels[channelIt].players.length > 0) {
          runningChannels++;
        }
        if(channels[channelIt].isOnBreak) {
          onBreakChannels++;
        }
      }
      serverLog(stateOfX.serverLogType.info,"runningChannels - " + runningChannels + "onBreakChannels are - " + onBreakChannels);
      if(runningChannels === onBreakChannels) {
        params.isTimeToStartBreakTimer = true;
        params.gameResumeTime = Number(new Date()) + params.breakRuleData.rule[params.channelDetails.breakLevel].breakDuration*60000;
        serverLog(stateOfX.serverLogType.info,"the  gameResumeTime is " + params.gameResumeTime);
        params.breakDuration = params.breakRuleData.rule[params.channelDetails.breakLevel].breakDuration;
      } else {
        params.isTimeToStartBreakTimer = false;
      }
      cb(null, params);
    }
  });
};


/**
 * this function updates break timer status and the time at which break timer started
 *
 * @method updateBreakTimer
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var updateBreakTimer = function(params, cb) {
  var filter = {
    'tournamentRules.tournamentId' : params.channelDetails.tournamentRules.tournamentId.toString(),
    gameVersionCount : params.channelDetails.gameVersionCount
  };
  imdb.updateAllTable(filter,{isBreakTimerStart: true, timerStarted: Number(new Date())}, function(err, tables) {
    if(!err) {
      cb(null, params);
    } else {
      cb({success: false, info: "Error in updating break timer in db"});
    }
  });
};

/**
 * function to process all the async functions written above 
 *
 * @method process
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
breakManagement.process = function(params, cb) {
  // serverLog(stateOfX.serverLogType.info,"params is in breakManagement process - " + JSON.stringify(params));
  async.waterfall([
    async.apply(getChannel,params),
    getBreakRule,
    isEligibleForBreak,
    isTimeToStartBreakTimer,
    updateBreakTimer
  ], function(err, result) {
    if(err) {
      cb(err);
    } else {
      result.success = true;
      cb(result);
    }
  });
};

module.exports = breakManagement;
