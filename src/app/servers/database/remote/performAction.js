/*jshint node: true */
"use strict";


// This file is used to redirect functions to perform
// Different operations after locking table object

var leaveRemote 				= require("./leaveRemote.js"),
		tableManager 			= require("./tableManager"),
		startGameRemote    = require("./startGameRemote"),
		// setTableConfig 			= require("./setTableConfig"),
		// validateGameStart 		= require("./validateGameStart"),
		handleGameStartCase 	= require("./handleGameStartCase"),
		moveRemote 				= require("./moveRemote"),
		precheckRemote 			= require("./precheckRemote"),
		logRemote 				= require("./logRemote"),
		// deductBlinds 			= require("./deductBlinds"),
		// distributeCards 		= require("./distributeCards"),
		playerShuffling 		= require("./playerShuffling"),
		autoSitRemote 			= require("./autoSitRemote"),
		zmqPublish    			= require("../../../../shared/infoPublisher"),
		stateOfX    			  = require("../../../../shared/stateOfX"),
		keyValidator  			= require("../../../../shared/keysDictionary"),
		tipRemote 				= require('./tipRemote'),
		messages 	  			= require("../../../../shared/popupTextManager").falseMessages;

var performAction = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'performAction';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

// To diivert tasks, which are done after locking table object
// executed either by lockTable or requestRemote
performAction.divert = function (params, cb) {

	keyValidator.validateKeySets("Request", "database", "performAction", params, function (validated) {
    if(validated.success) {
      switch(params.actionName.toUpperCase()) {

	      case "LEAVE" 											: leaveRemote.leavePlayer(params, function(response) { cb(response); }); break;
	      case "GETTABLE" 										: tableManager.getTableObject(params, function (response) { cb(response); }); break;
	      case "ADDWAITINGPLAYER" 								: tableManager.addPlayerAsWaiting(params, function (response) { cb(response); }); break;
	      case "ADDWAITINGPLAYERFORTOURNAMENT" 					: tableManager.addPlayerAsWaiting(params, function (response) { cb(response); }); break;
	      case "TABLEBUYIN" 									: tableManager.getTableBuyIn(params, function (response) { cb(response); }); break;
	      case "SEATOCCUPIED" 									: tableManager.getSeatOccupied(params, function (response) { cb(response); }); break;
	      case "RESUME" 										: tableManager.resumePlayer(params, function (response) { cb(response); }); break;
	      case "SITOUTNEXTHAND" 								: tableManager.processSitoutNextHand(params, function (response) { cb(response); }); break;
	      case "SITOUTNEXTBIGBLIND" 							: tableManager.processSitoutNextBigBlind(params, function (response) { cb(response); }); break;
	      case "JOINQUEUE" 										: tableManager.joinPlayerInQueue(params, function (response) { cb(response); }); break;
	      case "SETPLAYERATTRIB" 								: tableManager.setPlayerValue(params, function (response) { cb(response); }); break;
	      case "GETTABLEATTRIB" 								: tableManager.getTableValue(params, function (response) { cb(response); }); break;
	      case "SETCURRENTPLAYERDISCONN" 						: tableManager.disconnectCurrentPlayer(params, function (response) { cb(response); }); break;
	      case "GETPLAYERATTRIBUTE" 							: tableManager.getPlayerValue(params, function (response) { cb(response); }); break;
	      case "AUTOSITOUT" 									: tableManager.performAutoSitout(params, function (response) { cb(response); }); break;
	      case "ISPLAYERNOTONTABLE" 							: tableManager.seatsFullOrPlayerNotOnTable(params, function (response) { cb(response); }); break;
	      case "ADDCHIPSONTABLE" 								: tableManager.addChipsOnTable(params, function (response) { cb(response); }); break;
	      case "ADDCHIPSONTABLEINTOURNAMENT" 					: tableManager.addChipsOnTableInTournament(params, function (response) { cb(response); }); break;
	      case "RESETSITOUT" 									: tableManager.resetSitOut(params, function (response) { cb(response); }); break;
	      case "ISSAMENETWORKSIT" 								: tableManager.isSameNetworkSit(params, function (response) { cb(response); }); break;
	      case "SETPLAYERVALUEONTABLE"							: tableManager.setPlayerValueOnTable(params, function (response) { cb(response); }); break;
	      case "GETCURRENTPLAYER" 								: tableManager.getCurrentPlayer(params, function (response) { cb(response); }); break;
	      case "REMOVEWAITINGPLAYER"							: tableManager.removeWaitingPlayer(params, function (response) { cb(response); }); break;
	      case "CHANGEDISCONNPLAYERSTATE"						: tableManager.changeDisconnPlayerState(params, function (response) { cb(response); }); break;
	      case "SETTIMEBANKDETAILS" 							: tableManager.setTimeBankDetails(params, function (response) { cb(response); }); break;
	      case "UPDATETOURNAMENTRULES" 							: tableManager.updateTournamentRules(params, function(response) { cb(response); }); break;
	      case "UPDATEAUTOREBUY" 								: tableManager.updateAutoRebuy(params, function(response) { cb(response); }); break;
	      case  "UPDATEAUTOADDON"               				: tableManager.updateAutoAddon(params,function(response) { cb(response); }); break;
	      case "SHUFFLEPLAYERS" 								: playerShuffling.shuffle(params, function (response) { cb(response); }); break;
	      case "STARTGAMEPROCESS" 								: startGameRemote.processStartGame(params, function (response) { cb(response); }); break;
	      // case "SHOULDSTARTGAME" 								: validateGameStart.validate(params, function (response) { cb(response); }); break;
	      // case "SETGAMECONFIG" 									: setTableConfig.setConfig(params, function (response) { cb(response); }); break;
	      case "MAKEMOVE" 										: console.log("from make move params"+JSON.stringify(params)); moveRemote.takeAction(params, function (response) { cb(response); }); break;
	      case "UPDATEPRECHECKORMAKEMOVE" 						: precheckRemote.updatePrecheckOrMakeMoveAfterLock(params, function (response) { cb(response); }); break;
	      case "PROCESSCASES" 									: handleGameStartCase.processGameStartCases(params, function (response) { cb(response); }); break;
	      // case "DEDUCTBLINDS" 									: deductBlinds.deduct(params, function (response) { cb(response); }); break;
	      // case "DISTRIBUTECARDS" 								: distributeCards.distribute(params, function (response) { cb(response); }); break;
	      case "CREATELOG" 										: logRemote.generateLog(params, function(response) { cb(response); }); break;
	      case "LEAVETOURNAMENT" 								: tableManager.leaveTournamentPlayer(params, function(response) { cb(response); }); break;
	      case "AUTOSIT" 										: autoSitRemote.processAutoSit(params, function(response) { cb(response); }); break;
	      case "GETPLAYERCHIPSWITHFILTER" 						: tableManager.getPlayerChipsWithFilter(params, function(response) { cb(response); }); break;
		  case "TIPDEALER"										: tipRemote.processTip(params, function(response) { cb(response); }); break;
		  case "HANDLEDISCONNECTION" 							: tableManager.handleDisconnection(params, function(response) { cb(response); }); break;
		  case "AUTOFOLDCOUNT"									: tableManager.handleAutoFoldCount(params, function(response){ cb(response); }); break;
		  case "SETAUTOFOLDRESETVALUE"							: tableManager.setAutoFoldResetValue(params, function(response){ cb(response); }); break;

	      default 												: serverLog(stateOfX.serverLogType.error, 'No action name found - ' + params.actionName); cb({success: false, info: messages.VALIDATEKEYSETS_FAILED_PERFORMACTION + params.actionName, isRetry: false, isDiplay:true, channelId:(params.channelId||"")}); break;
      }
    } else {
      cb(validated);
    }
  });
};

module.exports = performAction;
