/*jshint node: true */
"use strict";

/**
 * Created by Amrendra on 13/07/2016.
**/
var async          = require("async"),
    _ld            = require("lodash"),
    _              = require('underscore'),
    setMove        = require('./setMove'),
    handleGameOver = require('./handleGameOver'),
    stateOfX       = require("../../../../shared/stateOfX"),
    keyValidator   = require("../../../../shared/keysDictionary"),
    imdb           = require("../../../../shared/model/inMemoryDbQuery.js"),
    popupTextManager= require("../../../../shared/popupTextManager").falseMessages,
    popupTextManagerFromdb = require("../../../../shared/popupTextManager").dbQyeryInfo,
    zmqPublish     = require("../../../../shared/infoPublisher"),
    mongodb        = require('../../../../shared/mongodbConnection'),
    summaryRemote  = require('./utils/summaryGenerator'),
    tableManager   = require('./tableManager');

var logRemote = {};

var cardImg = {
  'd' : " <img src = 'img_red_diamond'/>",
  's' : " <img src = 'img_black_spade'/>",
  'h' : " <img src = 'img_red_heart'/>",
  'c' : " <img src = 'img_black_club'/>"
};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'logRemote';
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

var eventObj = {
  text: null
};
var text = "";

// ### Generate event log for Join Channel
var logJoinChannel = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in logRemote function logJoinChannel: ' + JSON.stringify(params.data.rawData));
  var playerIndexOnTable = _ld.findIndex(params.data.rawData.tableDetails.players, {playerId: params.data.rawData.playerId});
  var reJoinText      = "";
  var spectatorText   = params.data.rawData.tableDetails.channelType === stateOfX.gameType.tournament ? "" : " as spectator";
  if(params.data.rawData.isJoinedOnce) {
    reJoinText    = "re-";
    spectatorText = "";
  }
  text = params.data.rawData.playerName + " " + reJoinText + "joins the table" + spectatorText + ".";
  eventObj.text = text;
  params.table.handHistory.push(eventObj);
  cb(eventObj);
};

// ### Generate event log for player Sit
var logSit = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in logRemote function logSit');
  text = params.data.rawData.playerName + " sit on table with " + params.data.rawData.chips + " chips.";
  eventObj.text = text;
  params.table.handHistory.push(eventObj);
  cb(eventObj);
};

// ### Generate event log for player seat reserved
var logReserved = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in logRemote function logReserved');
  text = params.data.rawData.playerName + " Reserved seat number " + params.data.rawData.seatIndex + ".";
  eventObj.text = text;
  params.table.handHistory.push(eventObj);
  cb(eventObj);
};

// Generate event log for table info when game starts
var logTableinfo = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in logRemote function logTableinfo');
  text = stateOfX.gameDetails.name + ": " + params.data.rawData.channelVariation + " " + (params.data.rawData.isPotLimit ? "Pot Limit" : "No Limit") + " (" + params.data.rawData.smallBlind + "/" + params.data.rawData.bigBlind + ") - " + new Date(Number(new Date()) + 5.5 * 60 * 60 * 1000).toString().substring(0, 25); //new Date().toString().substring(0,25); // put gameStartTime
  text = text + "\n----------------Hand: # "+ params.table.roundNumber + "----------------\n";
  text = text + "\n" + params.data.rawData.channelName + "(" + (params.data.rawData.isRealMoney ? "Real Money" : "Play Money") + ") \nSeat #" + params.data.rawData.dealerSeatIndex + " is the button.";
  eventObj.text = text;
  params.table.handHistory.push(eventObj);
  cb(eventObj);
};

// ### Generate event log for Start Game
var logStartGame = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in logRemote function logStartGame - ' + JSON.stringify(params.data.rawData));
  var forceBlindText = "";
  async.each(params.data.rawData.players, function(player, ecb){
    serverLog(stateOfX.serverLogType.info, 'Processing player while creating game start dealer chat - ' + JSON.stringify(player));
    var playerIndexOnTable = _ld.findIndex(params.table.players, {playerId: player.playerId});
    serverLog(stateOfX.serverLogType.info, 'Player index on table - ' + playerIndexOnTable);
    if(playerIndexOnTable>=0){
      serverLog(stateOfX.serverLogType.info, 'Previous chips of this player - ' + player.chips);
      serverLog(stateOfX.serverLogType.info, 'Bets posted on Game start - ' + params.table.roundBets);
      // player.chips = parseInt(player.chips) + parseInt(params.table.roundBets[playerIndexOnTable]);
      player.chips = fixedDecimal(player.chips, 2) + fixedDecimal(params.table.roundBets[playerIndexOnTable], 2);
      serverLog(stateOfX.serverLogType.info, 'Updated chips of this player - ' + player.chips);
      // Set force blind text if player is not SB/BB/STRADDLE
      if(playerIndexOnTable !== params.table.smallBlindIndex && playerIndexOnTable !== params.table.bigBlindIndex && playerIndexOnTable !== params.table.straddleIndex) {
        serverLog(stateOfX.serverLogType.info, 'Bets posted by this player - ' + params.table.roundBets[playerIndexOnTable]);
        if(parseInt(params.table.roundBets[playerIndexOnTable]) > 0) {
          // forceBlindText = forceBlindText + player.playerName + " posted force blind " + parseInt(params.table.roundBets[playerIndexOnTable]) + ' and become part of the game.' + "\n";
          forceBlindText = forceBlindText + player.playerName + " posted force blind " + fixedDecimal(params.table.roundBets[playerIndexOnTable], 2) + ' and become part of the game.' + "\n";
        } else {
          serverLog(stateOfX.serverLogType.info, player.playerName + ' hasnt posted anything in pot yet, skipping force blind chat.');
        }
      } else {
        serverLog(stateOfX.serverLogType.info, player.playerName + ' is either SB/BB/STRADDLE, skipping force blind chat.');
      }
    }
    text = text + "Seat " + player.seatIndex + ": " + player.playerName + " with chips " + player.chips+".\n";

    ecb();
  }, function(err) {
    if(!err) {
      if(params.table.smallBlindIndex >= 0) {
        if (params.data.rawData.blindDetails.smallBlind <= params.table.smallBlind) {
          text = text + params.data.rawData.blindDetails.smallBlindPlayerName + ": posts small blind " + params.data.rawData.blindDetails.smallBlind + ".\n";
        } else {
          text = text + params.data.rawData.blindDetails.smallBlindPlayerName + " posted force blind " + params.data.rawData.blindDetails.smallBlind + " and become part of the game.\nNo player posted small blind in this game.\n";
        }
      } else {
        text = text + "No player posted small blind in this game.";
      }
      text = text + params.data.rawData.blindDetails.bigBlindPlayerName + ": posts big blind " + params.data.rawData.blindDetails.bigBlind + ".\n";
      if(params.data.rawData.blindDetails.isStraddle) {
        text = text + params.data.rawData.blindDetails.straddlePlayerName + ": posts straddle amount " + params.data.rawData.blindDetails.straddle + ".\n";
      }
      if(!!forceBlindText) {
        text = text + forceBlindText + "\n";
      }
      text = text + '***' + stateOfX.round.holeCard + '***';
      eventObj.text = text;

      params.table.handHistory.push(eventObj);
      cb(eventObj);
    } else {
      cb({success: false, channelId: (params.channelId || ""), info: popupTextManager.ASYNCEACH_LOGSTARTGAME_LOGREMOTE, isRetry : false, isDisplay : true});
      //cb({success: false, channelId: params.channelId, info: "Error while creating dealer chat on game start."})
    }
  });
};

// ### Generate event log for Round Over
var logRoundOver = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in logRemote function logRoundOver');
  var cardText = "";
  for (var i = 0; i < params.table.boardCard[0].length; i++) {
    if(i>=0 && i<3) {
      if(i==0) {
        cardText += "[";
      }
      cardText += params.table.boardCard[0][i].name + cardImg[params.table.boardCard[0][i].type[0].toLowerCase()];

      if(i<2) {
        cardText += ", ";
      }
      if(i==2) {
        cardText += "]";
      }
    }

    if(i>=3 && i<4) {
      cardText += " [" + params.table.boardCard[0][i].name + cardImg[params.table.boardCard[0][i].type[0].toLowerCase()] + "]";
    }

    if(i>=4 && i<5) {
      cardText += " [" + params.table.boardCard[0][i].name + cardImg[params.table.boardCard[0][i].type[0].toLowerCase()] + "]";
    }
  }

  text = "*** " + params.data.rawData.roundName + "*** Round starts " + cardText + ".";
  eventObj.text = text;

  params.table.handHistory.push(eventObj);
  cb(eventObj);
};

// ### Generate event log for Player Turn
var logPlayerTurn = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in logRemote function logPlayerTurn');
  text = params.data.rawData.playerName + " " + stateOfX.delaerChatMove[params.data.rawData.actionName];
  switch (params.data.rawData.actionName) {
    case stateOfX.move.check:
    case stateOfX.move.fold:
      text = text + ".";
      break;
    default : text = text + " " + fixedDecimal(params.data.rawData.amount, 2) + ".";
  }
  eventObj.text = text;
  params.table.handHistory.push(eventObj);
  cb(eventObj);
};

// ### Generate event log for Leave player
var logLeave = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in logRemote function logLeave');
  text = params.data.rawData.playerName  + " left the table and game.";
  eventObj.text = text;
  params.table.handHistory.push(eventObj);
  cb(eventObj);
};

// ### Generate event log for Game Over
var logGameOver = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in logRemote function logGameOver - ' + JSON.stringify(params.data.rawData));
  params.data.rawData.winners = _.sortBy(params.data.rawData.winners, 'potIndex').reverse();
  var playerIndex = -1;
  var playerCards = null;
  var counter = 0;
  text = text + '*** ' + stateOfX.round.showdown + ' ***\n';
  async.each(params.data.rawData.winners, function(winner, ecb){
    serverLog(stateOfX.serverLogType.info, 'Processing winner while generating SHOWDOWN dealer chat: ' + JSON.stringify(winner));
    playerIndex = _ld.findIndex(params.table.players, {playerId: winner.playerId});
    if(playerIndex >= 0) {
      serverLog(stateOfX.serverLogType.info, "params.data.rawData.cardsToShow - "  + JSON.stringify(params.data.rawData.cardsToShow));
      playerCards = !!params.data.rawData.cardsToShow ? params.data.rawData.cardsToShow[winner.playerId][0].name + "" + cardImg[params.data.rawData.cardsToShow[winner.playerId][0].type[0].toLowerCase()] + " " + params.data.rawData.cardsToShow[winner.playerId][1].name + "" + cardImg[params.data.rawData.cardsToShow[winner.playerId][1].type[0].toLowerCase()] : null;
      if(counter !=0 ) {
        text = !!playerCards ? text + "\n" : text;
      }
      text = !!playerCards ? text + params.table.players[playerIndex].playerName + ': shows [' + playerCards + '] ( ' + winner.type + ' ).' : text;
      // text = text + params.table.players[playerIndex].playerName + ' collected ' + (parseInt(winner.amount) || 0) + ' from pot -> ' + (winner.potIndex+1);
      text = text + params.table.players[playerIndex].playerName + ' collected ' + (fixedDecimal(winner.amount, 2) || 0) + ' from pot -> ' + (winner.potIndex+1);
    } else {
      serverLog(stateOfX.serverLogType.info, 'Winner not found while generating Game Over / SHOWDOWN dealer chat.');
    }
    counter++;
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
  serverLog(stateOfX.serverLogType.info, 'in logRemote function logSummary');
  serverLog(stateOfX.serverLogType.info, "in logSummary params is" + params);
  serverLog(stateOfX.serverLogType.info, "in logSummary params.table.pot is" + params.table.pot);
  serverLog(stateOfX.serverLogType.info, "handHistory is" + params.table.handHistory);
  var summaryHeadLine = "\nSummary of the game is as follows -";
  var text = "";
  var previousTexts = _.pluck(params.table.handHistory,'text');
  var handId = previousTexts[0].slice(previousTexts[0].indexOf('#') + 2, previousTexts[0].indexOf('#') + 14);
  if(previousTexts.length > 0) {
    for (var i = 0; i < previousTexts.length; i++) {
      serverLog(stateOfX.serverLogType.info, 'Processing text: ' + previousTexts[i]);
      text += "\n" + previousTexts[i];
    }
  }
  serverLog(stateOfX.serverLogType.info, 'Updated text: ' + previousTexts[i]);
  var summary = text + summaryHeadLine;
  serverLog(stateOfX.serverLogType.info, "text in summary - " + summary);
  // console.log("params in logRemote logSummary function "+ JSON.stringify(params));
  summaryRemote.generateSummary(params, function(seatSummaryResponse){
    serverLog(stateOfX.serverLogType.info, "summary in logSummary - " + seatSummaryResponse);
    summary+= seatSummaryResponse;
    serverLog(stateOfX.serverLogType.info, "final summary generated is - " + summary);
    tableManager.insertHandHistory(params, handId, summary, function(err, result){
      if(err){
        cb({success: false, channelId: (params.channelId || ""), info: popupTextManager.TABLEMANAGERINSERTHANDHISTORY_SUMMARYREMOTEGENERATESUMMARY_LOGSUMMARY_LOGREMOTE, isRetry : false, isDisplay : true});
      } else{
        eventObj.handTab = result.value;
        serverLog(stateOfX.serverLogType.info, "eventObj in summary - " + summary);
        eventObj.text = summaryHeadLine + seatSummaryResponse;
        cb(eventObj);
      }
    });
  });
};

// Generate log text acc to event
var createLogOnEvent = function(params, cb){
  switch(params.data.eventName)
  {
    case stateOfX.logEvents.joinChannel : logJoinChannel  (params, function (eventResponse){cb(eventResponse);}); break;
    case stateOfX.logEvents.reserved    : logReserved     (params, function (eventResponse){cb(eventResponse);}); break;
    case stateOfX.logEvents.sit         : logSit          (params, function (eventResponse){cb(eventResponse);}); break;
    case stateOfX.logEvents.tableInfo   : logTableinfo    (params, function (eventResponse){cb(eventResponse);}); break;
    case stateOfX.logEvents.startGame   : logStartGame    (params, function (eventResponse){cb(eventResponse);}); break;
    case stateOfX.logEvents.playerTurn  : logPlayerTurn   (params, function (eventResponse){cb(eventResponse);}); break;
    case stateOfX.logEvents.leave       : logLeave        (params, function (eventResponse){cb(eventResponse);}); break;
    case stateOfX.logEvents.roundOver   : logRoundOver    (params, function (eventResponse){cb(eventResponse);}); break;
    case stateOfX.logEvents.gameOver    : logGameOver     (params, function (eventResponse){cb(eventResponse);}); break;
    case stateOfX.logEvents.summary     : logSummary      (params, function (eventResponse){cb(eventResponse);}); break;
    default                             : serverLog(stateOfX.serverLogType.info, 'No event log for this event.');
    cb({success: false, channelId: (params.channelId || ""), info: popupTextManager.CREATELOGONEVENT_LOGREMOTE, isRetry : false, isDisplay : true}); break;
  }
};

// ### Handle all cases to generate log text
// used in hand history
// > Params: {self, channelId, table, data {channelId, playerId, amount, action, isRequested}, table}
logRemote.generateLog = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in logRemote function generateLog');
  params = _.omit(params, 'self');
  params.rawData = "";
  createLogOnEvent(params, function (createLogOnEventResponse){
    text = "";
    params.data.text    = createLogOnEventResponse.text;
    params.data.handTab = createLogOnEventResponse.handTab;
    cb({success: true, table: params.table, data: params.data});
  });
};

module.exports = logRemote;
