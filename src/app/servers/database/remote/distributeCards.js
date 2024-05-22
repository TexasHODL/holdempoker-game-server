/*jshint node: true */
"use strict";

// This file is used to distribute cards to players on table

var async         = require("async"),
    stateOfX      = require("../../../../shared/stateOfX"),
    popupTextManager= require("../../../../shared/popupTextManager").falseMessages,
    popupTextManagerFromdb = require("../../../../shared/popupTextManager").dbQyeryInfo,
    zmqPublish    = require("../../../../shared/infoPublisher"),
    keyValidator  = require("../../../../shared/keysDictionary");

var tableManager = require("./tableManager");
// var distributeCards = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'distributeCards';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

function distributeCards() {}

// ### Get total cards to be distributed based on Game Variation and Types
var totalCardToBeDistributed = function (params, cb) {
  keyValidator.validateKeySets("Request", params.serverType, "totalCardToBeDistributed", params, function (validated){
    if(validated.success) {
      cb({success: true, count: stateOfX.totalPlayerCards[params.table.channelVariation]});
    } else {
      cb(validated);
    }
  });
};

// Distribute card to players after locking table object
distributeCards.distribute = function (params, cb) {
  tableManager.totalActivePlayers(params, function (totalActivePlayersResponse){
    if(totalActivePlayersResponse.success) {
      // Iterate over player to distribute card
      async.each(totalActivePlayersResponse.players, function (player, ecb){
        // Get total cards to be distributed
        totalCardToBeDistributed(params, function (totalCardToBeDistributedResponse){
          if(totalCardToBeDistributedResponse.success) {
            params.count = totalCardToBeDistributedResponse.count;
            tableManager.popCard(params, function (popCardResponse){
              if(popCardResponse.success) {
                //Distribute cards to each player here
                player.cards = popCardResponse.cards;
                ecb();
              } else {
                ecb(popCardResponse);
              }
            });
          } else {
            serverLog(stateOfX.serverLogType.error, 'Missing keys in distributecards - ' + JSON.stringify(totalCardToBeDistributedResponse));
            ecb(totalCardToBeDistributedResponse);
          }
        });
      }, function (err){
        if(err) {
          serverLog(stateOfX.serverLogType.error, err);
          cb({success: false, channelId: (params.channelId || ""), info: popupTextManager.DISTRIBUTE_DISTRIBUTECARDS + JSON.stringify(err), isRetry : false, isDisplay : true});
        } else {
          cb({success: true, data: {players: totalActivePlayersResponse.players}, table: params.table});
        }
      });
    } else {
      cb(totalActivePlayersResponse);
    }
  });
};

module.exports = distributeCards;
