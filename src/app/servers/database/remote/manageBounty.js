/*jshint node: true */
"use strict";

var async       = require("async"),
    stateOfX    = require("../../../../shared/stateOfX"),
    popupTextManager= require("../../../../shared/popupTextManager").falseMessages,
    popupTextManagerFromdb = require("../../../../shared/popupTextManager").dbQyeryInfo,
    profileMgmt = require("../../../../shared/model/profileMgmt"),
    zmqPublish  = require("../../../../shared/infoPublisher"),
    db          = require("../../../../shared/model/dbQuery.js"),
    _           = require("underscore");
var manageBounty = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'manageBounty';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}
/**
 * this function is used to prepareCurrentPotLosers
 * @method prepareCurrentPotLosers
 * @param  {Object}       currentPotLosers  request json object
 * @param  {Object}     players      callback function
 */
var prepareCurrentPotLosers = function(currentPotLosers, players) {
  serverLog(stateOfX.serverLogType.info,"currentPotLosers and players are - " + JSON.stringify(currentPotLosers) + JSON.stringify(players));
  var losers = [];
  for(var loserIt=0; loserIt<currentPotLosers.length; loserIt++) {
    losers.push({
      playerId: currentPotLosers[loserIt],
      playerName: (_.where(players, {playerId: currentPotLosers[loserIt]}))[0].playerName
    });
  }
  serverLog(stateOfX.serverLogType.info,"losers are in prepareCurrentPotLosers are - " + JSON.stringify(losers));
  return losers;
};

/**
 * this function is used to findBountyWinners
 * @method findBountyWinners
 * @param  {Object}       params  request json object
 * @param  {cb}     cb      callback function
 */
var findBountyWinners = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,"in find bounty winners - " + JSON.stringify(params));
  var outOfMoneyPlayers = _.pluck(_.where(params.table.players, {state: stateOfX.playerState.outOfMoney}),"playerId");
  serverLog(stateOfX.serverLogType.info,"out of money players are in findBountyWinners - " + JSON.stringify(outOfMoneyPlayers));
  if(outOfMoneyPlayers.length > 0) {
    for(var potIt=0; potIt<params.data.decisionParams.length; potIt++) {
      //participated players is in current pot
      var participatePlayers = _.pluck(params.data.decisionParams[potIt].playerCards,"playerId");
      serverLog(stateOfX.serverLogType.info,"participatePlayers are in findBountyWinners are - " + JSON.stringify(participatePlayers));
      // find current pot out of money
      var currentPotLosers = _.intersection(outOfMoneyPlayers,participatePlayers);
      serverLog(stateOfX.serverLogType.info,"currentPotLosers are in findBountyWinners are - " + JSON.stringify(currentPotLosers));
      // If this is not last pot remove that players
      if(potIt !== (params.data.decisionParams.length -1)) {
        // players who not all in this pot
        var notAllInPlayers = _.intersection(currentPotLosers, _.pluck(params.data.decisionParams[potIt+1].playerCards,"playerId"));
        serverLog(stateOfX.serverLogType.info,"not all in players are - " + JSON.stringify(notAllInPlayers));
        if(notAllInPlayers.length > 0) {
          currentPotLosers = _.difference(currentPotLosers,notAllInPlayers);
        }
      }
      serverLog(stateOfX.serverLogType.info,"currentPotLosers after removing not all in players - " + JSON.stringify(currentPotLosers));
      if(currentPotLosers.length > 0) {
        //calculate bounty money
        var bountyMoney = parseInt(params.table.tournamentRules.bountyFees*currentPotLosers.length/params.data.decisionParams[potIt].winners.length);
        serverLog(stateOfX.serverLogType.info,"bountyMoney is - " + bountyMoney);
        currentPotLosers = prepareCurrentPotLosers(currentPotLosers, params.table.players);
        serverLog(stateOfX.serverLogType.info,"currentPotLosers are after inserting player name - " + JSON.stringify(currentPotLosers));
        for(var winnerIt=0; winnerIt<params.data.decisionParams[potIt].winners.length; winnerIt++) {
          params.data.bountyWinner.push({
            winnerPlayerId     : params.data.decisionParams[potIt].winners[winnerIt].playerId,
            looserPlayers      : currentPotLosers,
            bountyMoney        : bountyMoney,
          });
        }
      }
    }
    cb(null, params);
  } else {
    serverLog(stateOfX.serverLogType.info,"No need to distribute bounty there are no loosers");
    cb(null, params);
  }
};


/**
 * this function is used to add money to bounty winner players profile
 * @method addMoneyToProfile
 * @param  {Object}       params  request json object
 * @param  {cb}     cb      callback function
 */
var addMoneyToProfile = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,"tournament rules is in addMoneyToProfile is - " + JSON.stringify(params.data));
  var bountyWinner = params.data.bountyWinner;
  serverLog(stateOfX.serverLogType.info,"bountyWinner are in addMoneyToProfile is - " + JSON.stringify(bountyWinner));
  if(bountyWinner.length > 0) {
    async.eachSeries(params.data.bountyWinner, function(winner, callback) {
      if(!winner.isBountyAdded) {
        profileMgmt.addChips({isRealMoney: params.table.isRealMoney, playerId: winner.winnerPlayerId, chips: winner.bountyMoney}, function(addChipsResponse) {
          serverLog(stateOfX.serverLogType.info,"add chips Response are - " + JSON.stringify(addChipsResponse));
          callback();
        });
      } else {
        callback();
      }
    }, function(err) {
      serverLog(stateOfX.serverLogType.info,"player chips added succesfully");
      cb(null, params);
    });
  } else {
    serverLog(stateOfX.serverLogType.info,"there are no bounty winners in addMoneyToProfile");
    cb(null, params);
  }
};

/**
 * this function is used to updateBounty 
 * @method updateBounty
 * @param  {Object}       params  request json object
 * @param  {cb}     cb      callback function
 */
var updateBounty = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,"in saveBounty - " + JSON.stringify(params));
  if(params.data.bountyWinner.length > 0) {
    async.eachSeries(params.data.bountyWinner, function(bountyWinner, callback) {
      var query = {
        tournamentId : params.table.tournamentRules.tournamentId,
        gameVersionCount : params.table.gameVersionCount,
        playerId : bountyWinner.winnerPlayerId
      };
      db.updateBounty(query, bountyWinner.bountyMoney, function(err, result) {
        serverLog(stateOfX.serverLogType.info,"successfully updated bounty");
        if(err) {
          cb({success : false});
        } else {
          callback();
        }
      });
    }, function(err) {
      if(err) {
        cb({success : false});
      } else {
        cb(null, params);
      }
    });
  } else {
    cb(null, params);
  }
};

/**
 * this function is used to manageBounty through a series of async functions  defined above
 * @method process
 * @param  {Object}       params  request json object
 * @param  {cb}     cb      callback function
 */
manageBounty.process = function(params,cb) {
  params.data.bountyWinner = [];
  serverLog(stateOfX.serverLogType.info,"params.data is - " + JSON.stringify(params.data));
  async.waterfall([
    async.apply(findBountyWinners, params),
    addMoneyToProfile,
    updateBounty
  ], function(err,response) {
    serverLog(stateOfX.serverLogType.info,"err and response is in manageBounty process - " + err + JSON.stringify(response));
    if(err) {
      cb({success: false, channelId: (params.channelId || ""), info: popupTextManager.MANAGEBOUNTYPROCESS_MANAGEBOUNTY, isRetry : false, isDisplay : true});
      //cb({success: false, info: "Error in distributeBounty"});
    } else {
      cb({success: true, result: params});
    }
  });
};

module.exports = manageBounty;
