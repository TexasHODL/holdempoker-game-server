/*jshint node: true */
"use strict";

/**
 * Created by Amrendra on 07/07/2016.
**/
var async         = require("async"),
    _ld       		= require("lodash"),
    _             = require('underscore'),
    stateOfX      = require("../../../../shared/stateOfX"),
    keyValidator  = require("../../../../shared/keysDictionary"),
    zmqPublish    = require("../../../../shared/infoPublisher"),
    potsplit 			= {};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'potsplit';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  // zmqPublish.sendLogMessage(logObject);
  console.log(JSON.stringify(logObject));
}

function fixedDecimal(number, precisionValue) {
  let precision = precisionValue ? precisionValue : 2;
  return Number(Number(number).toFixed(precision));
}

// ### Add additional params in existing one for calculation
var initializeParams = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'splitting pot function initializeParams');
  keyValidator.validateKeySets("Request", params.serverType, "initializeParams", params, function(validated){
    if(validated.success) {

      params.data.player              = params.table.players[params.data.index];
      // params.table.roundContributors.sort(function(a, b) { return b.amount - a.amount; });
      params.table.roundContributors.sort(function (a, b) { return fixedDecimal(b.amount, 2) - fixedDecimal(a.amount, 2); });
      params.data.contributors        = params.table.roundContributors;
      serverLog(stateOfX.serverLogType.info, 'Sorted amount with contributors - ' + JSON.stringify(params.data.contributors));
      serverLog(stateOfX.serverLogType.info, 'Actual contributors - ' + JSON.stringify(params.table.contributors));
      params.data.considerPlayer      = params.data.contributors.length-1;
      params.data.isPotsplitRequired  = false;
      params.data.currentPot          = params.table.pot;
      params.data.sidePots            = [];

      cb(null, params);
    } else {
      cb(validated);
    }
  });
};

// check if pot split is required or not
// if atleast a player has done allin and cotributed unequal
var isPotsplitRequired = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, ' splitting pot function isPotsplitRequired');
  serverLog(stateOfX.serverLogType.info, 'Players while spliting pot - ' + JSON.stringify(params.table.players));
  var playingPlayers = [];
  for (var i = 0; i < params.table.players.length; i++) {
    if(params.table.onStartPlayers.indexOf(params.table.players[i].playerId) >= 0) {
      playingPlayers.push(params.table.players[i]);
    }
  }
  // var playingPlayers    = _.where(params.table.players, {state: stateOfX.playerState.playing});
  var foldedPlayers    = _.where(playingPlayers, {lastMove: stateOfX.move.fold});
  // var playingPlayers    = _.where(params.table.players, {state: stateOfX.playerState.playing});
  var inActivePlayers   = _.where(playingPlayers, {active: false});
  var playedinRound     = _.where(playingPlayers, {isPlayed: true});
/*
  var playingPlayers    = _.where(params.table.players, {state: stateOfX.playerState.playing});
  var foldedPlayers    = _.where(params.table.players, {state: stateOfX.playerState.playing, lastMove: stateOfX.move.fold});
  // var playingPlayers    = _.where(params.table.players, {state: stateOfX.playerState.playing});
  var inActivePlayers   = _.where(params.table.players, {state: stateOfX.playerState.playing, active: false});
  var playedinRound     = _.where(params.table.players, {state: stateOfX.playerState.playing, isPlayed: true});
*/

  serverLog(stateOfX.serverLogType.info, 'Players moves so far');
  serverLog(stateOfX.serverLogType.info, 'ALL IN occured on table - ' +  params.table.isAllInOcccured);
  serverLog(stateOfX.serverLogType.info, 'Total player played in this round - ' + JSON.stringify(playedinRound));
  serverLog(stateOfX.serverLogType.info, 'Total playing players in the game - ' + playingPlayers.length);
//console.error(inActivePlayers.length ,"!@#@@@@@#####@@@@@@#$%^^^^^^^^^^^^", playedinRound.length, "!@@@@@@@@@@" ,playingPlayers.length);
    
  // If pot is already splitted then do not check any condition
  if(params.table.pot.length > 1) {
    // serverLog(stateOfX.serverLogType.info, 'Pot is already splitted, no need to check cases.');
    params.data.isPotsplitRequired = true;
  }

  // if(inActivePlayers.length == playingPlayers.length-1){
  //   return cb(null, params);
  // }
  // If pot is not splitted yet then check if it can split
  if(!params.data.isPotsplitRequired && params.table.isAllInOcccured) {
    // serverLog(stateOfX.serverLogType.info, 'ALLIN occured on the table.');
    //console.error(inActivePlayers.length ,"!@#$%^^^^^^^^^^^^", playedinRound.length, "!@@@@@@@@@@" ,playingPlayers.length);
    if(inActivePlayers.length + playedinRound.length >= playingPlayers.length ) {
      // serverLog(stateOfX.serverLogType.info, 'All players have made their move with bets - ');
      // serverLog(stateOfX.serverLogType.info, _.pluck(playingPlayers, 'totalRoundBet'));
      // serverLog(stateOfX.serverLogType.info, 'Max bet placed by playing players in this round - ' + _.max(_.pluck(playingPlayers, 'totalRoundBet')));
      // serverLog(stateOfX.serverLogType.info, 'Min bet placed by playing players in this round - ' + _.min(_.pluck(playingPlayers, 'totalRoundBet')));

      // TODO: ADD this case below if required
      // _.min(_.pluck(playingPlayers, 'totalRoundBet')) != 0 &&
      // Removing as - 3 player, ALLIN/CALL/CALL, BET/CALL [62, 0, 62], 0 is for all in player and will fail the pot split case

      if( _.max(_.pluck(playingPlayers, 'totalRoundBet')) != _.min(_.pluck(playingPlayers, 'totalRoundBet'))) {
        params.data.isPotsplitRequired = true;
      }
    }
  } else {
    // serverLog(stateOfX.serverLogType.info, 'No ALLIN occured on table yet!');
  }
  // IN CASE OF SINGLE COMPETETOR WINNER - sushiljainam
  // pot split is not required
  if(playingPlayers.length - foldedPlayers.length <= 1){
    params.data.isPotsplitRequired = false;
  }
  cb(null, params);
};

// Add amount to pot directly if splitting is not required
var addAmountToPot = function(params, cb) {
  // serverLog(stateOfX.serverLogType.info, ' splitting pot function addAmountToPot');
  if(!params.data.isPotsplitRequired) {
    serverLog(stateOfX.serverLogType.info, "========== POT WILL NOT SPLIT IN THIS CASE ============");
    params.table.pot = [];
    params.table.pot.push({
      amount: 0,
      contributors: []
    });
    for (var i = 0; i < params.table.contributors.length; i++) {
      params.table.pot[0].amount = params.table.pot[0].amount + params.table.contributors[i].amount;
      params.table.pot[0].contributors.push(params.table.contributors[i].playerId);
    }
  }
  cb(null, params);
};

// create side pots
var createPot = function (params, cb) {
  var sidepot = {
    amount: 0,
    contributors: [],
    processed: false
  };
  for (var i = 0; i < params.data.contributors.length; i++) {
    if(params.data.contributors[i].tempAmount > 0) {
      // Check if player still on the table
      // Otherwise remove from contribution list
      var playerIndexOnTable = _ld.findIndex(params.table.players, {playerId: params.data.contributors[i].playerId});
      // This line is commented as previously who played and contributed in round but folded in another round then they are not considered for pot contribution
      // and hence making the pot splitting incoreectly.
      // Also the refund pot is not splitted in the side pot correctly
      // Changes By Digvijay Rathore (17 Dec 2019)
      // if(playerIndexOnTable >= 0 && params.table.players[playerIndexOnTable].lastMove !== stateOfX.move.fold) {
        sidepot.contributors.push(params.data.contributors[i].playerId);
      // } else {
        // serverLog(stateOfX.serverLogType.info, 'This player ' + params.data.contributors[i].playerId + '  has left the table.');
      // }
      // sidepot.amount = parseInt(sidepot.amount) + parseInt(params.data.contributors[params.data.considerPlayer].tempAmount);
      sidepot.amount = fixedDecimal(sidepot.amount, 2) + fixedDecimal(params.data.contributors[params.data.considerPlayer].tempAmount, 2);
      // params.data.contributors[i].tempAmount = parseInt(params.data.contributors[i].tempAmount) - parseInt(params.data.contributors[params.data.considerPlayer].tempAmount);
      params.data.contributors[i].tempAmount = fixedDecimal(params.data.contributors[i].tempAmount, 2) - fixedDecimal(params.data.contributors[params.data.considerPlayer].tempAmount, 2);
    }
  }

  // params.contributors.splice(params.contributors.length-1, 1);
  if(sidepot.amount > 0) {
    // serverLog(stateOfX.serverLogType.info, "New sidepot - " + JSON.stringify(sidepot));
  }
  cb({success: true, sidepot: sidepot});
};

// process pot split according to unequal contribution
var splitPot = function(params, cb) {
  // serverLog(stateOfX.serverLogType.info, ' splitting pot function splitPot');
  keyValidator.validateKeySets("Request", params.serverType, "splitPot", params, function(validated){
    if(validated.success) {
      if(params.data.isPotsplitRequired) {
        // Check if amount needs to be added
        serverLog(stateOfX.serverLogType.info, "==== POT MIGHT SPLIT IN THIS CASE =====");
        // if(params.data.amount <= 0) {
        //   cb({success: true, params: params});
        //   return;
        // }

        var totalContribution = 0; // temp value for testing
        // var contributrsArray = Object.assign({}, params.data.contributors);
        // console.log("Contributory array "+contributrsArray);
        // for (let i = 0; i < params.data.contributors; i++){
        //   totalContribution += params.data.contributors[i].amount;
        //   console.log("Total Contributin "+totalContribution);
        // }
        console.log("Total Contributin "+totalContribution);
        
        // Start spliting pot
        // params.table.pot = [];
        serverLog(stateOfX.serverLogType.info, "======1 CONTRIBUTORS =============" + JSON.stringify(params.data.contributors));
        serverLog(stateOfX.serverLogType.info, "======2 CONTRIBUTORS =============" + JSON.stringify(params.data.sidePots));
        async.each(params.data.contributors, function (contributor, ecb) {
          totalContribution += contributor.amount;
          console.log("Total Contributin in loop "+totalContribution);
          createPot(params , function (createPotResponse){
            if(createPotResponse.success) {
              // serverLog(stateOfX.serverLogType.info, '====== Sidepot created ========');
              serverLog(stateOfX.serverLogType.info, 'Create pot response: ' + JSON.stringify(createPotResponse.sidepot));

              var newSidepots = [];

              if(createPotResponse.sidepot.amount > 0) {
                if(params.data.sidePots.length > 0) {
                  for (var i = 0; i < params.data.sidePots.length; i++) {

                    serverLog(stateOfX.serverLogType.info, 'Processing sidepot - ' + JSON.stringify(params.data.sidePots[i]));

                    serverLog(stateOfX.serverLogType.info, params.data.sidePots[i].contributors.length + "< Contri  && New contri>" + createPotResponse.sidepot.contributors.length);

                    if(params.data.sidePots[i].contributors.length === createPotResponse.sidepot.contributors.length) {
                      serverLog(stateOfX.serverLogType.info, 'Similar sidepot exists, adding amount only');
                      serverLog(stateOfX.serverLogType.info, 'Previous sidepot amount - ' + params.data.sidePots[i].amount);
                      params.data.sidePots[i].amount = params.data.sidePots[i].amount + createPotResponse.sidepot.amount;
                      serverLog(stateOfX.serverLogType.info, 'After sidepot amount - ' + params.data.sidePots[i].amount);
                      newSidepots = [];
                    } else {
                      if(newSidepots.length <= 0) {
                        serverLog(stateOfX.serverLogType.info, 'No newsidepot exists, insert new one!');
                        newSidepots.push(createPotResponse.sidepot);
                      } else {
                        for (var j = 0; j < newSidepots.length; j++) {
                          serverLog(stateOfX.serverLogType.info, params.data.sidePots[j].contributors.length + "< NContri  && NNew Ncontri>" + createPotResponse.sidepot.contributors.length);
                          if(newSidepots[j].contributors.length !== createPotResponse.sidepot.contributors.length) {
                            serverLog(stateOfX.serverLogType.info, 'A new sidepot will be inserted later on - ' + JSON.stringify(newSidepots[j]));
                            newSidepots.push(createPotResponse.sidepot);
                          }
                        }
                      }
                    }
                  }

                  // Insert new sidepots
                  serverLog(stateOfX.serverLogType.info, 'newSidepots');
                  serverLog(stateOfX.serverLogType.info, 'New side pots: ' + JSON.stringify(newSidepots));

                  for (var k = 0; k < newSidepots.length; k++) {
                    serverLog(stateOfX.serverLogType.info, 'Inserting new sidepots - ' + JSON.stringify(newSidepots[k]));
                    params.data.sidePots.push(newSidepots[k]);
                  }
                } else {
                  serverLog(stateOfX.serverLogType.info, 'No side pot exists, pushing new one');
                  params.data.sidePots.push(createPotResponse.sidepot);
                  // params.data.sidePots[params.data.sidePots.length-1].processed = true;
                }
              }
              params.data.considerPlayer = params.data.considerPlayer - 1;
              ecb();
            } else {
              ecb(createPotResponse);
            }
          });
        }, function(err){
          if(err){
            cb(err);
          } else {
            // serverLog(stateOfX.serverLogType.info, 'Resetting contributors of table');
            for (var i = 0; i < params.data.contributors.length; i++) {
              // params.table.roundContributors[i].playerId   = params.data.contributors[i].playerId;
              params.table.roundContributors[i].amount = params.data.contributors[i].amount;
              params.table.roundContributors[i].tempAmount = params.data.contributors[i].amount;
            }
            serverLog(stateOfX.serverLogType.info, '============FINAL POT AND CONTRI===========');
            serverLog(stateOfX.serverLogType.info, 'Pot - ' + JSON.stringify(params.table.pot));
            serverLog(stateOfX.serverLogType.info, 'Contributors - ' + JSON.stringify(params.table.roundContributors));


            // For testing that pot that are made is correct or not
            //By Digvijay
            console.log("Total contribution "+totalContribution);
            let totalPotAmount = 0;
            for (let i = 0; i < params.data.sidePots.length ; i++){
              console.log("Digvijay Pot amount "+params.data.sidePots[i].amount);
              totalPotAmount += params.data.sidePots[i].amount;
            }
            console.log("Total pot amount "+totalPotAmount);

            if(fixedDecimal(totalContribution, 2) == fixedDecimal(totalPotAmount, 2)){
              console.log("==============Pot successfully and equally created========");
            }else{
              console.log("==============Pot successfully and equally not created========");
              process.emit('forceMail', { title: "for potSplit", data: params });
            }

            // delete params.data.sidePots;
            // delete params.data.considerPlayer;

            cb({success: true, params: params});
          }
        });
      } else {
        cb({success: true, params: params});
      }
    } else {
      cb(validated);
    }
  });
};

// process all steps of pot split
// check if needed
// then split pot
potsplit.processSplit = function (params, cb) {
	keyValidator.validateKeySets("Request", "database", "processSplit", params, function(validated){
    if(validated.success) {
      // serverLog(stateOfX.serverLogType.info, '======== POT SPLIT STARTED ========');

    	async.waterfall([

        async.apply(initializeParams, params),
        isPotsplitRequired,
        addAmountToPot,
        splitPot

      ], function(err, response){
        if(!err) {
          // serverLog(stateOfX.serverLogType.info, '======== POT SPLIT FINISHED (ERROR) ========');
          cb(response);
        } else {
          // serverLog(stateOfX.serverLogType.info, '======== POT SPLIT FINISHED (NO ERROR) ========');
          cb(err);
        }
      });
    } else {
      cb(validated);
    }
  });
};

module.exports = potsplit;
