/*jshint node: true */
"use strict";

/*Created by Abhishek Gupta on 30-May-2017*/
var _                     = require('underscore'),
    keyValidator          = require("../../../../shared/keysDictionary"),
    popupTextManager  = require("../../../../shared/popupTextManager"),
    imdb                  = require("../../../../shared/model/inMemoryDbQuery.js"),
    stateOfX              = require("../../../../shared/stateOfX.js"),
    db                    = require("../../../../shared/model/dbQuery.js"),
    createtable           = require("../../../../shared/createTournamentTable.js"),
    zmqPublish            = require("../../../../shared/infoPublisher.js"),
    async                 = require("async");

var calculateDynamicBountyHandler = {};
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'calculateDynamicBountyHandler';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

/**
 *  this function is used to getTournamentUsers.
 *
 * @method getTournamentUsers
 * @param  {Object}       params  request json object(tournamentId,gameVersionCount,isActive)
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var getTournamentUsers = function(params, cb) {
  console.log("Inside getTournamentUsers the params is ", params);
  var filter = {
    tournamentId : params.tournamentId,
    gameVersionCount : params.gameVersionCount,
    isActive : true
  };
  db.findTournamentUser(filter, function(err, tournamentUsers) {
    if(!err && tournamentUsers && tournamentUsers.length>0){
        console.log("the tournament users in calculate dynamic bounty are", tournamentUsers);
        params.tournamentUsers = tournamentUsers;
        cb(null,params);
    }
    else{
        console.log("No tournament user found for the given tournament id"); //if there are no tournament user return max,min and average bounty as 0
        var bountyObject = {};
        bountyObject.maxBounty = 0;
        bountyObject.minBounty = 0;
        bountyObject.averageBounty = 0;
        params.bountyObject = bountyObject;
        cb(bountyObject);
    }
  });

};
/**
 *  this function is used to pluckPlayers(extract playerIds from tournamentUsers).
 *
 * @method pluckPlayers
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var pluckPlayers = function(params, cb) {
 console.log("before plucking the params is ", JSON.stringify(params));
 params.playerIds = _.pluck(params.tournamentUsers,"playerId");     //extract playerIds from tournamentUsers
 console.log("After plucking the params is",JSON.stringify(params));
 cb(null,params);


};
/**
 *  this function is used to filterPlayersFromBounty(find all those players who are in current tournament from bounty).
 *
 * @method filterPlayersFromBounty
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var filterPlayersFromBounty = function(params, cb) {
 console.log("In filterPlayersFromBounty the params is ", params);
 
 db.findPlayerFromBounty(params.playerIds, function(err, findPlayerFromBountyResponse) {
    if(!err && findPlayerFromBountyResponse){
        console.log("the findPlayerFromBountyResponse is", JSON.stringify(findPlayerFromBountyResponse));
        params.filterPlayers = findPlayerFromBountyResponse;
        cb(null,params);
    }
    else{
        console.log("Some error in finding data from findPlayerFromBounty");
        cb(params);
    }
  });

};
/**
 *  this function is used to getPlayersAccording to gameVersion count and calculate their min,max,and average bounty.
 *
 * @method getActivePlayers
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var getActivePlayers = function(params, cb) {
 console.log("In getPlayerAccToGameVersion the params is ", JSON.stringify(params));
 var getActivePlayers = _.where(params.filterPlayers,{gameVersionCount : params.gameVersionCount,tournamentId : params.tournamentId});
 console.log(JSON.stringify(getActivePlayers));
 var bountyObject = {};
  if(getActivePlayers.length > 0){
      var maxBounty = getActivePlayers[0].bounty;
      var minBounty = getActivePlayers[0].bounty;
      var sum = getActivePlayers[0].bounty;
      var numberOfActivePlayers = getActivePlayers.length;
      for(var i = 1; i<getActivePlayers.length; i++){
          if(getActivePlayers[i].bounty>maxBounty){
              maxBounty = getActivePlayers[i].bounty;
          }
          if(getActivePlayers[i].bounty<minBounty){
              minBounty = getActivePlayers[i].bounty;
          }
          sum = sum + getActivePlayers[i].bounty;
      }
      var averageBounty = Math.round(sum/numberOfActivePlayers);
      console.log("maxBounty-- ",maxBounty );
      console.log("minBounty-- ",minBounty );
      console.log("averageBounty--",averageBounty );
      bountyObject.maxBounty = maxBounty;
      bountyObject.minBounty = minBounty;
      bountyObject.averageBounty = averageBounty;
      params.bountyObject = bountyObject;
      cb(null,bountyObject);
  }
  else{
      bountyObject.maxBounty = 0;
      bountyObject.minBounty = 0;
      bountyObject.averageBounty = 0;
      cb(bountyObject);
  }


};

/**
 *  this function is used to calculateDynamicBounty which contains a series of async functions.
 *
 * @method calculateDynamicBounty
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
calculateDynamicBountyHandler.calculateDynamicBounty = function(params, cb) {
  // serverLog(stateOfX.serverLogType.info,"params is in breakManagement process - " + JSON.stringify(params));
  console.log("Inside calculateDynamicBounty handler ---------",JSON.stringify(params));
  async.waterfall([
    async.apply(getTournamentUsers,params),
    pluckPlayers,
    filterPlayersFromBounty,
    getActivePlayers
  ], function(err, result) {
    if(err) {
      cb(err);
    } else {
      result.success = true;
      console.log("the final result is ",JSON.stringify(result));
      cb(result);
    }
  });
};
module.exports = calculateDynamicBountyHandler;