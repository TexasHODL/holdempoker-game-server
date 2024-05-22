/*jshint node: true */
"use strict";

/**
 * Created by Amrendra on 13/07/2016.
**/
var async           = require("async"),
    _ld             = require("lodash"),
    _               = require('underscore'),
    stateOfX        = require("../../../../../shared/stateOfX"),
    keyValidator    = require("../../../../../shared/keysDictionary"),
    imdb            = require("../../../../../shared/model/inMemoryDbQuery.js"),
    zmqPublish      = require("../../../../../shared/infoPublisher"),
    mongodb         = require('../../../../../shared/mongodbConnection'),
    ofcTableManager = require('./ofcTableManager');

var ofcLogRemote = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'ofcLogRemote';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}


var eventObj = {
  text: null
};
var text = "";

// ### Generate event log for Join Channel
var logJoinChannel = function (params, cb) {
  text = params.data.rawData.playerName + " joins the table as spectator.\n";
  eventObj.text = text;
  params.table.handHistory.push(eventObj);
  cb(eventObj);
};

// ### Generate event log for player Sit
var logSit = function (params, cb) {
  text = params.data.rawData.playerName + " sit on table with " + params.data.rawData.points + " points.\n";
  eventObj.text = text;
  params.table.handHistory.push(eventObj);
  cb(eventObj);
};

// ### Generate event log for player seat reserved
var logReserved = function (params, cb) {
  text = params.data.rawData.playerName + " Reserved seat number " + params.data.rawData.seatIndex + ".\n";
  eventObj.text = text;
  params.table.handHistory.push(eventObj);
  cb(eventObj);
};

var logTableinfo = function(params, cb) {
  text = stateOfX.gameDetails.name + ": " + params.data.rawData.channelVariation + " " + new Date().toString().substring(0,25);
  text = text + "\n " + params.data.rawData.channelName + "(" + (params.data.rawData.isRealMoney ? "Real Money" : "Play Money") + ") \nSeat #" + params.data.rawData.dealerSeatIndex + " is the button.\n";
  eventObj.text = text;
  params.table.handHistory.push(eventObj);
  cb(eventObj);
};

// ### Generate event log for Start Game
var logStartGame = function (params, cb) {
  for(var i=0; i<params.data.rawData.players.length; i++){
    text = text + "Seat " + params.data.rawData.players[i].seatIndex + ": " + params.data.rawData.players[i].playerName + " with points " + params.data.rawData.players[i].points+".\n";
  }
  eventObj.text = text;
  params.table.handHistory.push(eventObj);
  cb(eventObj);
};

// ### Generate event log for Player Turn
var logPlayerTurn = function (params, cb) {
  text = params.data.rawData.playerName + " sets cards ";
  var cardsText = "";
  if (params.data.rawData.cards.bottom.length > 0) {
    for (var i = 0; i < params.data.rawData.cards.bottom.length; i++) {
      cardsText =  cardsText + params.data.rawData.cards.bottom[i].name + params.data.rawData.cards.bottom[i].type[0].toUpperCase();
      if(i < params.data.rawData.cards.bottom.length-1) {
        cardsText = cardsText + ', ';
      }
    }
    text = text + '[ ' + cardsText + ' ] in bottom row';
  }

  if (params.data.rawData.cards.middle.length > 0) {
    text = text + ' and ';
    cardsText = "";
    for (var i = 0; i < params.data.rawData.cards.middle.length; i++) {
      cardsText =  cardsText + params.data.rawData.cards.middle[i].name + params.data.rawData.cards.middle[i].type[0].toUpperCase();
      if(i < params.data.rawData.cards.middle.length-1) {
        cardsText = cardsText + ', ';
      }
    }
    text = text + '[ ' + cardsText + ' ] in middle row';
  }
  if (params.data.rawData.cards.top.length > 0) {
    text = text + ' and ';
    cardsText = "";
    for (var i = 0; i < params.data.rawData.cards.top.length; i++) {
      cardsText =  cardsText + params.data.rawData.cards.top[i].name + params.data.rawData.cards.top[i].type[0].toUpperCase();
      if(i < params.data.rawData.cards.top.length-1) {
        cardsText = cardsText + ', ';
      }
    }
    text = text + '[ ' + cardsText + ' ] in top row';
  }

  text = text + '.';
  eventObj.text = text;
  params.table.handHistory.push(eventObj);
  cb(eventObj);
};

var logPlayerRoyality = function (params, cb) {
  var playerIndex = _ld.findIndex(params.table.players, {playerId: params.data.rawData.playerId});
  if (!params.data.rawData.royalitiesSet.bottom && params.data.rawData.royalities.bottom >= 0) {
    params.table.players[playerIndex].royalitiesSet.bottom = true;
    text = params.data.rawData.playerName + " has royality points " + params.data.rawData.royalities.bottom + ' in bottom row.';
  }

  if (!params.data.rawData.royalitiesSet.middle && params.data.rawData.royalities.middle >= 0) {
    params.table.players[playerIndex].royalitiesSet.middle = true;
    text = params.data.rawData.playerName + " has royality points " + params.data.rawData.royalities.middle + ' in middle row.';
  }

  if (!params.data.rawData.royalitiesSet.top && params.data.rawData.royalities.top >= 0) {
    params.table.players[playerIndex].royalitiesSet.top = true;
    text = params.data.rawData.playerName + " has royality points " + params.data.rawData.royalities.top + ' in top row.';
  }

  eventObj.text = text;
  params.table.handHistory.push(eventObj);
  cb(eventObj);
};

// ### Generate event log for Leave player
var logLeave = function (params, cb) {
  text = params.data.rawData.playerName  + " left the table and game.\n";
  eventObj.text = text;
  params.table.handHistory.push(eventObj);
  cb(eventObj);
};

// ### Generate event log for Game Over
var logGameOver = function (params, cb) {
  var playerIndex = -1;
  async.each(params.data.rawData.winners, function(winner, ecb){
    playerIndex = _ld.findIndex(params.table.players, {playerId: winner.playerId});
    if(playerIndex >= 0) {
      text = text + params.table.players[playerIndex].playerName + (winner.winningPoints>=0 ? ' won ' : ' lost ') + winner.winningPoints + ' point.\n';
    } else {
      serverLog(stateOfX.serverLogType.error, 'Winner not found while generating Game Over dealer chat.');
      text = text + ' Another player ' + (winner.winningPoints>=0 ? ' won ' : ' lost ') + winner.winningPoints + ' point.\n';
    }
    ecb();
  }, function(err){
    if(err) {
      cb(err);
    } else {
      eventObj.text = text;
      params.table.handHistory.push(eventObj);
      cb(eventObj);
    }
  });

};

// ### Generate event log for Summary 
var logSummary = function (params, cb) {
  var text    = _.reduce(_.pluck(params.table.handHistory,'text'),function(memo, num){ return memo + num; });
  var summary = text + "\n Summary of the game is as follows - \n";
  serverLog(stateOfX.serverLogType.info, "text in summary - " + summary);
  testSummary.generateSummary(params,function(seatSummaryResponse){
    serverLog(stateOfX.serverLogType.info, "summary in logSummary - " + seatSummaryResponse);
    summary+= seatSummaryResponse;
    serverLog(stateOfX.serverLogType.info, "final summary generated is - " + summary);
    tableManager.insertHandHistory(params, summary, function(err, result){
      if(err){
        cb({success: false, channelId: params.channelId, info: "Inserting hand history failed !"});
      } else{
        eventObj.handTab = result.value;
        serverLog(stateOfX.serverLogType.info, "eventObj in summary - " + summary);
        eventObj.text = text + seatSummaryResponse;
        cb(eventObj);
      }
    });
  });
};

var createLogOnEvent = function(params, cb){
  switch(params.data.eventName)
  {
    case stateOfX.logEvents.joinChannel     : logJoinChannel    (params, function (eventResponse){cb(eventResponse);}); break;
    case stateOfX.logEvents.reserved        : logReserved       (params, function (eventResponse){cb(eventResponse);}); break;
    case stateOfX.logEvents.sit             : logSit            (params, function (eventResponse){cb(eventResponse);}); break;
    case stateOfX.logEvents.tableInfo       : logTableinfo      (params, function (eventResponse){cb(eventResponse);}); break;
    case stateOfX.logEvents.startGame       : logStartGame      (params, function (eventResponse){cb(eventResponse);}); break;
    case stateOfX.logEvents.playerTurn      : logPlayerTurn     (params, function (eventResponse){cb(eventResponse);}); break;
    case stateOfX.logEvents.playerRoyality  : logPlayerRoyality (params, function (eventResponse){cb(eventResponse);}); break;
    case stateOfX.logEvents.leave           : logLeave          (params, function (eventResponse){cb(eventResponse);}); break;
    case stateOfX.logEvents.gameOver        : logGameOver       (params, function (eventResponse){cb(eventResponse);}); break;
    case stateOfX.logEvents.summary         : logSummary        (params, function (eventResponse){cb(eventResponse);}); break;
    default                                 : serverLog(stateOfX.serverLogType.info, 'No event log for this event.'); cb({success: false, info: 'No event log for this event.'}); break;
  }
};

// ### Handle all cases required to handle an action
// > Params: {self, channelId, table, data {channelId, playerId, amount, action, isRequested}, table}

ofcLogRemote.generateLog = function (params, cb) {
  params = _.omit(params, 'self');
  params.rawData = "";
  createLogOnEvent(params, function (createLogOnEventResponse){
    text = "";
    serverLog(stateOfX.serverLogType.info, 'createLogOnEventResponse - ' + JSON.stringify(createLogOnEventResponse));
    params.data.text    = createLogOnEventResponse.text;
    params.data.handTab = createLogOnEventResponse.handTab;
    cb({success: true, table: params.table, data: params.data});
  });
};

module.exports = ofcLogRemote;