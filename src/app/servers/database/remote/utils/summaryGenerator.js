/*jshint node: true */
"use strict";

var async 	 	 = require('async'),
		_          = require("underscore"),
		zmqPublish = require("../../../../../shared/infoPublisher"),
		winnerMgmt = require('../../../../../shared/winnerAlgo/entry'),
		stateOfX   = require("../../../../../shared/stateOfX");

	var summaryRemote = {};

/**
 * This file helps in handHistory text (only the part after game over) creation.
 * including pots, some player settings,
 * player cards details, comparison details,
 * winners, loosers, rake, when fold, when leave info
 * Function names are self-explanatory
 */

var cardImg = {
	'd' : " <img src = 'img_red_diamond'/>",
	's' : " <img src = 'img_black_spade'/>",
	'h' : " <img src = 'img_red_heart'/>",
	'c' : " <img src = 'img_black_club'/>"
};

var upperBranchText = "FLOP1";
var lowerBranchText = "FLOP2";

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'summaryGenerator';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

function fixedDecimal(number, precisionValue) {
	let precision = precisionValue ? precisionValue : 2;
	return Number(Number(number).toFixed(precision));
}

summaryRemote.onFold = function(params){
	if(!!params && params.table.players.length>0){
		var player = _.where(params.table.players,{'playerId':params.data.playerId});
		var string  = "Seat "+player[0].seatIndex+" :"+player[0].playerName;
		if(player[0].seatIndex === params.table.smallBlindSeatIndex){
			string+=" (small blind)";
		} else if(player[0].seatIndex === params.table.bigBlindSeatIndex){
			string+=" (big blind)";
		}
		string+=" folded before "+ stateOfX.nextRoundOf[params.data.roundName];
		params.table.summaryOfAllPlayers[player[0].seatIndex] = string;
		return;
	} else{
		serverLog(stateOfX.serverLogType.error, 'summary onFold failed');
	}
};

summaryRemote.onLeave = function(params){
	if(!!params && params.table.players.length>0){
		var player = _.where(params.table.players,{'playerId':params.data.playerId});
		var string  = "Seat "+player[0].seatIndex+" :"+player[0].playerName;

		if(player[0].seatIndex==params.table.smallBlindSeatIndex){
			string+=" (small blind)";
		} else if(player[0].seatIndex==params.table.bigBlindSeatIndex){
			string+=" (big blind)";
		}
		string+=" left before "+ stateOfX.nextRoundOf[params.table.roundName];
		params.table.summaryOfAllPlayers[player[0].seatIndex] = string;
		return;
	} else{
		serverLog(stateOfX.serverLogType.error, 'summary onLeave failed');
	}
};

summaryRemote.generateSummary = function(params,cb){
	serverLog(stateOfX.serverLogType.info, "generateSummary -"+ JSON.stringify(params));
	params.table.summaryOfAllPlayers.summary = "";
	serverLog(stateOfX.serverLogType.info, " Previous summary " + JSON.stringify(params.table.summaryOfAllPlayers));
	serverLog(stateOfX.serverLogType.info, " Pot while updting summary " + JSON.stringify(params.table.pot));
	if(!!params.table.pot && params.table.pot.length >0){
		var totalPot = _.reduce(_.pluck(params.table.pot,"amount"), function(memo, num){ return memo + num; }, 0);
		params.table.summaryOfAllPlayers.summary += "Total pot " + fixedDecimal(totalPot, 2) + ".";
		var mainPotContributors = "";
		//console.error(params.table.pot[0].contributors);
		for(var alpha =0 ; alpha < params.table.pot[0].contributors.length; alpha++){
			var playerNameIndex = _.where(params.table.players,{'playerId': params.table.pot[0].contributors[alpha]});
			//console.error(playerNameIndex);
			if(playerNameIndex.length > 0){
				mainPotContributors += playerNameIndex[0].playerName+",";
			}
		}
		//console.error(mainPotContributors);
		mainPotContributors = mainPotContributors.slice(0,mainPotContributors.length-1);
		//console.error(mainPotContributors);
		params.table.summaryOfAllPlayers.summary+= "\n Main pot "+ params.table.pot[0].amount + "("+mainPotContributors+")";
		if(params.table.pot.length>1){
			for(var i = 1;i<params.table.pot.length;i++){
				var sidePotContributors = "";
				for(var alpha =0 ; alpha < params.table.pot[i].contributors.length; alpha++){
					var playerNameIndex = _.where(params.table.players,{'playerId': params.table.pot[i].contributors[alpha]});
					//console.error(playerNameIndex);
					if(playerNameIndex.length > 0){
						sidePotContributors += playerNameIndex[0].playerName+",";
					}
				}
				sidePotContributors = sidePotContributors.slice(0,sidePotContributors.length-1);
				params.table.summaryOfAllPlayers.summary+= "\n Side pot-"+params.table.pot[i].potIndex + " "+ params.table.pot[i].amount+"("+sidePotContributors +")";


			}
		}
	}
	if(!!params.table.summaryOfAllPlayers.rake){
		params.table.summaryOfAllPlayers.summary +=" \n Rake "+params.table.summaryOfAllPlayers.rake;
	}

	var runItTwiceEnabledFor = "";
	for(var runIt = 0;runIt < params.table.pot[0].contributors.length;runIt++){
		var playerNameIndexRunItTwice = _.where(params.table.players,{'playerId': params.table.pot[0].contributors[runIt]});
		//console.error(runIt ," !******&&&&&&&&&&&&^^^^^^^^^^^^^ ",playerNameIndexRunItTwice);
		//console.error(playerNameIndexRunItTwice[0].isRunItTwice);
		console.error(playerNameIndexRunItTwice.length);
		if(playerNameIndexRunItTwice.length > 0 && playerNameIndexRunItTwice[0].isRunItTwice){
			runItTwiceEnabledFor += playerNameIndexRunItTwice[0].playerName+",";
		}
	}
	runItTwiceEnabledFor = runItTwiceEnabledFor.slice(0,runItTwiceEnabledFor.length-1);
	if(runItTwiceEnabledFor == ""){
		runItTwiceEnabledFor = "No one enabled run it twice";
		params.table.summaryOfAllPlayers.summary +="\n"+runItTwiceEnabledFor+"\n";
	} else {
		params.table.summaryOfAllPlayers.summary +="\nRun It Twice Enabled by ("+runItTwiceEnabledFor+")\n";
	}
	if (params.table.isStraddleEnable) {
		params.table.summaryOfAllPlayers.summary += "Straddle is mandatory.\n";
	} else {
		var straddleOptedByNames = "";
		for (var i = 0; i < params.table.pot[0].contributors.length; i++) {
			var playerObj = _.findWhere(params.table.gamePlayers, {'playerId': params.table.pot[0].contributors[i]});
			if (playerObj && playerObj.isStraddleOpted) {
				straddleOptedByNames += playerObj.playerName+', ';
			}
		}
		straddleOptedByNames = straddleOptedByNames.slice(0, straddleOptedByNames.length-2);
		if (straddleOptedByNames) {
			params.table.summaryOfAllPlayers.summary += "Straddle enabled by "+straddleOptedByNames+".\n";
		} else {
			params.table.summaryOfAllPlayers.summary += "No one enabled Straddle.\n";
		}
	}
	var boardCards1="";
	var boardCards2="";

	if(!!params.table.summaryOfAllPlayers.boardCard && !!params.table.summaryOfAllPlayers.boardCard[0] && !!params.table.summaryOfAllPlayers.boardCard[0][0]){
		for(var i=0;i<params.table.summaryOfAllPlayers.boardCard[0].length;i++){
			boardCards1+= params.table.summaryOfAllPlayers.boardCard[0][i].name + "" + cardImg[params.table.summaryOfAllPlayers.boardCard[0][i].type[0].toLowerCase()]+" ";
		}
	}
	if(!!params.table.summaryOfAllPlayers.boardCard && !!params.table.summaryOfAllPlayers.boardCard[1]){
		var nullCount = 0;
		for(var i=0;i<params.table.summaryOfAllPlayers.boardCard[1].length;i++){
			if (params.table.summaryOfAllPlayers.boardCard[1][i] == null) {
				boardCards2+= params.table.summaryOfAllPlayers.boardCard[0][i].name + "" + cardImg[params.table.summaryOfAllPlayers.boardCard[0][i].type[0].toLowerCase()]+" ";
				nullCount++;
			} else {
				boardCards2+= params.table.summaryOfAllPlayers.boardCard[1][i].name + "" + cardImg[params.table.summaryOfAllPlayers.boardCard[1][i].type[0].toLowerCase()]+" ";
			}
		}
		if (nullCount >= params.table.summaryOfAllPlayers.boardCard[1].length) {
			boardCards2 = "";
		}
	}
	if(!!boardCards1){
		if(!!boardCards2){
			params.table.summaryOfAllPlayers.summary +="\nBoard " + upperBranchText + " ["+boardCards1+"]\n";
		} else {
			params.table.summaryOfAllPlayers.summary +="\nBoard ["+boardCards1+"]\n";
		}
	}
	// if(params.table.onStartPlayers.length>0){
		// for(var i=0;i<params.table.onStartPlayers.length;i++){
			params.table.summaryOfAllPlayers.summary+= "\n" + (params.table.summaryOfAllPlayers["hands1"] || "");
		// }
	// }
	if(!!boardCards2){
		params.table.summaryOfAllPlayers.summary += "\n\nand " + lowerBranchText + " ["+boardCards2+"]";
	}
	params.table.summaryOfAllPlayers.summary+= "\n" + (params.table.summaryOfAllPlayers["hands2"] || "");
	params.table.summaryOfAllPlayers.summary+= "\n" + (params.table.summaryOfAllPlayers["winners"] || "");

	serverLog(stateOfX.serverLogType.info, " Updated summary " + JSON.stringify(params.table.summaryOfAllPlayers));
		
	cb(params.table.summaryOfAllPlayers.summary);
};


// Sub function to generate summary for each players

var getCurrentPlayer = function(params, cb) {
	params.summary.currentPlayer = _.where(params.table.players,{'seatIndex': params.summary.seatIndex});
	serverLog(stateOfX.serverLogType.info, 'Going to create summary for player: ' + JSON.stringify(params.summary.currentPlayer));
	cb(null, params);
};

var generateSeatLevelText = function(params, cb) {
	if(!params.summary.currentPlayer) return cb(null, params);
	params.summary.seatLevelText  = "Seat " + parseInt(params.summary.seatIndex) + " :" + params.summary.currentPlayer[0].playerName;
	serverLog(stateOfX.serverLogType.info, 'Summary after adding seat text: ' + JSON.stringify(params.summary.seatLevelText));
	cb(null, params);
};

var assignConfigDetails = function(params, cb) {
	if(!params.summary.currentPlayer) return cb(null, params);
	if(params.summary.seatIndex==params.table.smallBlindSeatIndex && !!params.table.smallBlindSeatIndex){
		params.summary.seatLevelText += " (small blind)";
	} else if(params.summary.seatIndex==params.table.bigBlindSeatIndex && !!params.table.bigBlindSeatIndex){
		params.summary.seatLevelText += " (big blind)";
	}
	serverLog(stateOfX.serverLogType.info, 'Summary after adding config (SB/BB) text: ' + JSON.stringify(params.summary.seatLevelText));
	cb(null, params);
};

var getWinnerDetails = function(params, cb) {
	if(!params.summary.currentPlayer) return cb(null, params);
	console.log("DIGVIJAY winners array "+JSON.stringify(params.data.winners));
	params.summary.currentWinner = _.where(params.data.winners,{"playerId": params.summary.currentPlayer[0].playerId});
	console.log("DIGVIJAY current winner "+JSON.stringify(params.summary.currentWinner));
	if(!!params.summary.currentWinner && params.summary.currentWinner.length > 0) {
		params.summary.winAmount = params.summary.currentWinner.length > 0 ? _.reduce(_.pluck(params.summary.currentWinner, 'amount'), function(memo, num){ return memo + num; }, 0) : 0;
	}
	cb(null, params);
};

var assignPlayerCardsAndText = function(params, cb) {
	if(!params.summary.currentPlayer) return cb(null, params);
	if(!!params.summary.currentPlayer[0] && !!params.summary.currentPlayer[0].cards[0]){
		params.summary.playerCards = "";
		for (var i = 0; i < params.summary.currentPlayer[0].cards.length; i++) {
			params.summary.playerCards += params.summary.currentPlayer[0].cards[i].name + cardImg[params.summary.currentPlayer[0].cards[i].type[0].toLowerCase()] + " ";
		}
	  if((params.summary.currentWinner.length>0 && params.summary.currentWinner[0].type == stateOfX.dealerChatReason[stateOfX.endingType.everybodyPacked]) || (params.data.isSingleWinner)){
	  	// params.summary.seatLevelText+=" showed ";
				if(params.summary.currentPlayer[0].lastMove != stateOfX.move.fold.toString()){
					temp = " collected "+ params.summary.currentWinner[0].winningAmount;
	  		}else{
	  			temp = " folded at "+ params.summary.currentPlayer[0].lastRoundPlayed;
	  		}
	  } else{
	  		var temp = "";
	  		// console.error(stateOfX.move.fold," !!!!!!!!!!!!!!!!!!!bitubitu "+JSON.stringify(params.summary.currentPlayer), "&&&&&&&&&&&&&&&&&&&", params.summary.currentPlayer.lastMove);
	  		if(params.summary.currentPlayer[0].lastMove != stateOfX.move.fold.toString()){
					temp = " showed ["+params.summary.playerCards+"] and";
	  		}else{
	  			temp += " folded at "+ params.summary.currentPlayer[0].lastRoundPlayed;
	  		}
	  }
	  		params.summary.seatLevelText +=temp;
	  		params.summary.seatLevelText2 = params.summary.seatLevelText;
  }
	serverLog(stateOfX.serverLogType.info, 'Summary after adding card text: ' + JSON.stringify(params.summary.seatLevelText));
	cb(null, params);
};

var assignPlayerHands = function (params, cb) {
	// console.error('assignPlayerHands ', JSON.stringify(params.data.winnerRanking), JSON.stringify(params.data.ritWinnerRanking), JSON.stringify(params.data));
	// loop thorogh - params.data.winnerRanking
	// check table.isRunItTwiceApplied
	// if true -> loop thorogh - params.data.ritWinnerRanking
	if(!params.summary.currentPlayer) return cb(null, params);
	if(!!params.summary.currentPlayer[0] && !!params.summary.currentPlayer[0].cards[0]){
	  if((params.summary.currentWinner.length>0 && params.summary.currentWinner[0].type == stateOfX.dealerChatReason[stateOfX.endingType.everybodyPacked]) || (params.data.isSingleWinner)){
	  	// params.summary.seatLevelText+=" showed ";
	  } else{
	  		var temp = "";
	  		// console.error(stateOfX.move.fold," !!!!!!!!!!!!!!!!!!!bitubitu "+JSON.stringify(params.summary.currentPlayer), "&&&&&&&&&&&&&&&&&&&", params.summary.currentPlayer.lastMove);
	  		if(params.summary.currentPlayer[0].lastMove != stateOfX.move.fold.toString()){
	  			if (params.data.winnerRanking.winnerHigh) {
		  			var t = _.findWhere(params.data.winnerRanking.winnerHigh, {playerId: params.summary.currentPlayer[0].playerId});
						temp += " has HI- "+ (t.text || t.type);
						if (params.data.winnerRanking.winnerLo) {
		  				var t = _.findWhere(params.data.winnerRanking.winnerLo, {playerId: params.summary.currentPlayer[0].playerId});
		  				if (t) {
								temp += ", LO- "+ (t.text || t.type);
		  				}
						}
	  			} else {
		  			var t = _.findWhere(params.data.winnerRanking, {playerId: params.summary.currentPlayer[0].playerId});
						temp = " has "+ (t.text || t.type);
	  			}
	  		}else{
	  			temp += "";
	  		}
	  		params.summary.seatLevelText +=temp;
	  }
  }
	console.error(stateOfX.serverLogType.info, 'Summary after adding card text: ' + JSON.stringify(params.summary.seatLevelText));
	cb(null, params);
};

var assignPlayerHands2 = function (params, cb) {
	// console.error('assignPlayerHands ', JSON.stringify(params.data.winnerRanking), JSON.stringify(params.data.ritWinnerRanking), JSON.stringify(params.data));
	// loop thorogh - params.data.winnerRanking
	// check table.isRunItTwiceApplied
	// if true -> loop thorogh - params.data.ritWinnerRanking
	if(!params.summary.currentPlayer) return cb(null, params);
	if(!params.data.ritWinnerRanking) {
		params.summary.seatLevelText2 = "";
		return cb(null, params);
	}
	if(!!params.summary.currentPlayer[0] && !!params.summary.currentPlayer[0].cards[0]){
		if (!params.summary.currentPlayer[0].isRunItTwice) {
			params.summary.seatLevelText2 = "";
			return cb(null, params);
		}
	  if((params.summary.currentWinner.length>0 && params.summary.currentWinner[0].type == stateOfX.dealerChatReason[stateOfX.endingType.everybodyPacked]) || (params.data.isSingleWinner)){
	  	// params.summary.seatLevelText+=" showed ";
	  } else{
	  		var temp = "";
	  		// console.error(stateOfX.move.fold," !!!!!!!!!!!!!!!!!!!bitubitu "+JSON.stringify(params.summary.currentPlayer), "&&&&&&&&&&&&&&&&&&&", params.summary.currentPlayer.lastMove);
	  		if(params.summary.currentPlayer[0].lastMove != stateOfX.move.fold.toString()){
	  			if (params.data.ritWinnerRanking.winnerHigh) {
		  			var t = _.findWhere(params.data.ritWinnerRanking.winnerHigh, {playerId: params.summary.currentPlayer[0].playerId});
						temp += " has HI- "+ (t.text || t.type);
						if (params.data.ritWinnerRanking.winnerLo) {
		  				var t = _.findWhere(params.data.ritWinnerRanking.winnerLo, {playerId: params.summary.currentPlayer[0].playerId});
		  				if (t) {
								temp += ", LO- "+ (t.text || t.type);
		  				}
						}
	  			} else {
		  			var t = _.findWhere(params.data.ritWinnerRanking, {playerId: params.summary.currentPlayer[0].playerId});
						temp = " has "+ (t.text || t.type);
	  			}
	  		}else{
	  			temp += "";
	  		}
	  		params.summary.seatLevelText2 +=temp;
	  }
  }
	console.error(stateOfX.serverLogType.info, 'Summary after adding card text: ' + JSON.stringify(params.summary.seatLevelText));
	cb(null, params);
};

var assignWinningText = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, "assignWinningText ------------------ "+JSON.stringify(params));
	var winnerDetails = [], winnerDetailsOmahaHiLo = [{}];
	if(!params.summary.currentPlayer) return cb(null, params);

	if(params.summary.currentWinner.length > 0){
		var winnerText = "";
		if(params.summary.currentWinner[0].type != stateOfX.dealerChatReason[stateOfX.endingType.everybodyPacked]) {
			var dataSet       = {boardCards: params.table.boardCard[0], playerCards: [{playerId: params.summary.currentPlayer[0].playerId, cards: params.summary.currentPlayer[0].cards}]};
			// var winnerDetails = winnerMgmt.findCardsConfiguration(dataSet, params.table.channelVariation);
			var winnerDetails = _.where(params.data.winnerRanking, {playerId: params.summary.currentPlayer[0].playerId});
			if(params.table.channelVariation !== stateOfX.channelVariation.omahahilo){
			 winnerDetails = _.where(params.data.winnerRanking, {playerId: params.summary.currentPlayer[0].playerId});
			 serverLog(stateOfX.serverLogType.info, "winnerDetails----------- "+ JSON.stringify(winnerDetails));
			}
			else{
				winnerDetailsOmahaHiLo[0].winnerHigh = _.where(params.data.winnerRanking.winnerHigh, {playerId: params.summary.currentPlayer[0].playerId});
				winnerDetailsOmahaHiLo[0].winnerLo = _.where(params.data.winnerRanking.winnerLo, {playerId: params.summary.currentPlayer[0].playerId});
				serverLog(stateOfX.serverLogType.info, "winnerDetails----------- "+ JSON.stringify(winnerDetailsOmahaHiLo));
			}
			if(!!winnerDetails && params.table.channelVariation !== stateOfX.channelVariation.omahahilo) {
				winnerText += winnerDetails[0].text;
			} else {
				if(!!winnerDetailsOmahaHiLo && winnerDetailsOmahaHiLo[0].winnerHigh.length > 0) {
          winnerText += "HI: " + winnerDetailsOmahaHiLo[0].winnerHigh[0].text;
        }
        if(!!winnerDetailsOmahaHiLo && winnerDetailsOmahaHiLo[0].winnerLo.length > 0) {
          winnerText += ", LO: " + _.pluck(winnerDetailsOmahaHiLo[0].winnerLo[0].set, 'name');
        }
			}
		} else {
			winnerText = params.summary.currentWinner[0].type;
		}
		params.summary.seatLevelText += " won " + params.summary.winAmount + " with " + winnerText + ".";
	} else {
		serverLog(stateOfX.serverLogType.info, 'This is not a winner player, not adding texts here!');
	}
	serverLog(stateOfX.serverLogType.info, 'Summary after adding winner text: ' + JSON.stringify(params.summary.seatLevelText));

	cb(null, params);
};

var assignLooserText = function(params, cb) {

	var looserDetails = [], looserDetailsOmahaHiLo = [{}];
	if(!params.summary.currentPlayer) return cb(null, params);

	if(params.summary.currentWinner.length <= 0) {
		
		if(params.data.isSingleWinner) {
			params.summary.seatLevelText += " lost.";
		} else {
			var dataSet       = {boardCards: params.table.boardCard[0], playerCards: [{playerId: params.summary.currentPlayer[0].playerId, cards: params.summary.currentPlayer[0].cards}]};
			var looserText    = "";
			// var looserDetails = winnerMgmt.findCardsConfiguration(dataSet, params.table.channelVariation);
			if(params.table.channelVariation !== stateOfX.channelVariation.omahahilo){
			 looserDetails = _.where(params.data.winnerRanking, {playerId: params.summary.currentPlayer[0].playerId});
			 serverLog(stateOfX.serverLogType.info, "looserDetails----------- "+ JSON.stringify(looserDetails));
			}
			else{
				looserDetailsOmahaHiLo[0].winnerHigh = _.where(params.data.winnerRanking.winnerHigh, {playerId: params.summary.currentPlayer[0].playerId});
				looserDetailsOmahaHiLo[0].winnerLo = _.where(params.data.winnerRanking.winnerLo, {playerId: params.summary.currentPlayer[0].playerId});
				serverLog(stateOfX.serverLogType.info, "looserDetails----------- "+ JSON.stringify(looserDetailsOmahaHiLo));
			}
			if(!!looserDetails  && params.table.channelVariation !== stateOfX.channelVariation.omahahilo) {
				if(looserDetails.length > 0){
					looserText += looserDetails[0].text;
				}
			} else {
				if(!!looserDetailsOmahaHiLo && looserDetailsOmahaHiLo[0].winnerHigh.length > 0) {
          looserText += "HI: " + looserDetailsOmahaHiLo[0].winnerHigh[0].text;
        }
        if(!!looserDetailsOmahaHiLo && looserDetailsOmahaHiLo[0].winnerLo.length > 0) {
          looserText += ", LO: " + _.pluck(looserDetailsOmahaHiLo[0].winnerLo[0].set, 'name');
        }
			}
			if(params.summary.currentPlayer[0].lastMove != stateOfX.move.fold.toString()){	
				params.summary.seatLevelText += " lost with " + looserText;
			}
		}
	} else {
		serverLog(stateOfX.serverLogType.info, 'This is not a looser player, text already added as a winner player!');
	}
	serverLog(stateOfX.serverLogType.info, 'Summary after adding looser text: ' + JSON.stringify(params.summary.seatLevelText));

	cb(null, params);
};

var refundText = function (params, cb) {
	var refundTotal = 0;
	var refundPlayerId;
	for (var i = 0; i < params.data.winners.length; i++) {
		if(params.data.winners[i].isRefund){
			refundTotal += (params.data.winners[i].winningAmount || 0);
			refundPlayerId = params.data.winners[i].playerId;
		}
	}
	if (refundTotal > 0) {
		var t = _.findWhere(params.table.players, {playerId: refundPlayerId});
		var refundPlayerName = (t ? t.playerName : 'a player');
		params.table.summaryOfAllPlayers["winners"] = params.table.summaryOfAllPlayers["winners"] || "";
		params.table.summaryOfAllPlayers["winners"] += "\n" + refundTotal + " returned to " + refundPlayerName + ".";
	}
	cb(null, params);
};

var winnerText = function (params, cb) {

	async.eachSeries(_.where(params.data.winners, {isRefund: false}), function (winner, ecb) {
		var text = "\n";
		// format: // playerName won (Hi/Lo/'') pot potAmount (with handText) (- FLOP1/ FLOP2)
		var t = _.findWhere(params.table.players, {playerId: winner.playerId});
		var name = (t ? t.playerName : 'a player');
		text += name + " won";
		var ifHiLo = (params.table.channelVariation === stateOfX.channelVariation.omahahilo);
		var ifTableRIT = params.table.isRunItTwiceApplied;
		var ifRIT = winner.isRit; // per winner object
		if (winner.internalPotSplitIndex) {
			// text += ".";
			// ecb(null);
		var arrPotSplit = Array.from(winner.internalPotSplitIndex);
		if (ifHiLo && ifRIT) {
			if (arrPotSplit[2]==0) {
				// text += ((winner.text instanceof Array)? " Lo-pot (" :" Hi-pot (")+ Math.round(winner.winningAmount) +") with " + winner.text;
				text += ((winner.text instanceof Array)? " Lo-pot (" :" Hi-pot (")+ fixedDecimal(winner.winningAmount, 2) +") with " + winner.text;
				if (arrPotSplit[1]==1) {
					text += " - " + lowerBranchText;
				} else {
					text += " - " + upperBranchText;
				}
			} else {
				// text += ((winner.text instanceof Array)? " Lo-pot (" :" Hi-pot (")+ Math.round(winner.winningAmount) +") with " + winner.text;
				text += ((winner.text instanceof Array)? " Lo-pot (" :" Hi-pot (")+ fixedDecimal(winner.winningAmount, 2) +") with " + winner.text;
				if (arrPotSplit[1]==1) {
					text += " - " + lowerBranchText;
				} else {
					text += " - " + upperBranchText;
				}
			}
		} else if (ifHiLo) {
			if (arrPotSplit[1]==0) {
				// text += ((winner.text instanceof Array)? " Lo-pot (" :" Hi-pot (")+ Math.round(winner.winningAmount) +") with " + winner.text;
				text += ((winner.text instanceof Array)? " Lo-pot (" :" Hi-pot (")+ fixedDecimal(winner.winningAmount, 2) +") with " + winner.text;
			} else {
				// text += ((winner.text instanceof Array)? " Lo-pot (" :" Hi-pot (")+ Math.round(winner.winningAmount) +") with " + winner.text;
				text += ((winner.text instanceof Array)? " Lo-pot (" :" Hi-pot (")+ fixedDecimal(winner.winningAmount, 2) +") with " + winner.text;
			}
			if (ifTableRIT) {
				text += " - " + upperBranchText;
			}
		} else {
			// text += " pot ("+ Math.round(winner.winningAmount) +") with " + winner.text;
			text += " pot ("+ fixedDecimal(winner.winningAmount, 2) +") with " + winner.text;
			if (ifRIT) {
				if (arrPotSplit[1]==1) {
					text += " - " + lowerBranchText;
				} else {
					text += " - " + upperBranchText;
				}
			} else if (ifTableRIT) {
				text += " - " + upperBranchText;
			}
		}
		}
		text += ".";
		params.table.summaryOfAllPlayers["winners"] = params.table.summaryOfAllPlayers["winners"] || "";
		params.table.summaryOfAllPlayers["winners"] += text;
		ecb(null);
	}, function (err, response) {
		cb(null, params);
	});
};

var assignWinnersText = function (params, cb) {
	if (params.data.winners && params.data.winners.length) {
		async.waterfall([
			async.apply(refundText, params),
			winnerText
			], function (err, response) {
				cb(params);
			});
	}
};

// update summary (for hand history) of each player at game over
summaryRemote.updateSummaryOfEachPlayer = function(params, cb){
	if(!!params && params.table.players.length>0){
		// var seatIndexArray = _.pluck(_.filter(params.table.players,function(player){if(player.lastMove!==stateOfX.move.fold && (player.state === stateOfX.playerState.playing || player.state === stateOfX.playerState.disconnected) ){return player}}),"seatIndex");
		// disconnected player might not be part of game
		var playedPlayers = [];
		for (var i = 0; i < params.table.players.length; i++) {
			if(params.table.onStartPlayers.indexOf(params.table.players[i].playerId)>=0){
				playedPlayers.push(params.table.players[i]);
			}
		}
		var seatIndexArray = _.pluck(playedPlayers ,"seatIndex");
		serverLog(stateOfX.serverLogType.info, 'Array of seat indexes: ' + JSON.stringify(seatIndexArray));
		

		async.eachSeries(seatIndexArray, function(seatIndex, ecb){
			params.summary = {};
			params.summary.seatIndex = seatIndex;
			async.waterfall([
				async.apply(getCurrentPlayer, params),
				generateSeatLevelText,
				assignConfigDetails,
				getWinnerDetails,
				assignPlayerCardsAndText,
				assignPlayerHands,
				assignPlayerHands2
				// assignWinningText,
				// assignLooserText
			], function(err, response){
				if(err) {
					serverLog(stateOfX.serverLogType.error, 'Error while generating summary for current players: ' + JSON.stringify(err));
					cb({success: false, channelId: params.channelId, isRetry: false, isDisplay: false, info: 'Error while generating summary for current players: ' + JSON.stringify(err)});
				} else {
					serverLog(stateOfX.serverLogType.info, 'Summary for current player: ' + params.summary.seatLevelText);
					params.table.summaryOfAllPlayers[seatIndex] = params.summary.seatLevelText;
					params.table.summaryOfAllPlayers["hands1"] = params.table.summaryOfAllPlayers["hands1"] || "";
					params.table.summaryOfAllPlayers["hands1"] += (params.summary.seatLevelText ? ("\n"+ params.summary.seatLevelText) : "");
					params.table.summaryOfAllPlayers["hands2"] = params.table.summaryOfAllPlayers["hands2"] || "";
					params.table.summaryOfAllPlayers["hands2"] += (params.summary.seatLevelText2 ? ("\n"+ params.summary.seatLevelText2) : "");
					serverLog(stateOfX.serverLogType.info, 'Summary has been generated successfully for current player!');
					ecb();
				}
			});
		}, function(err){
			if(err) {
				serverLog(stateOfX.serverLogType.error, 'Error while generating summary for each players: ' + JSON.stringify(err));
				cb({success: false, channelId: params.channelId, isRetry: false, isDisplay: false, info: 'Error while generating summary for each players: ' + JSON.stringify(err)});
			} else {
				// console.error(JSON.stringify(params), '45t77384v2389475v293484123974')
				if(params.data.winnerRanking && params.data.winnerRanking.winnerHigh && !params.data.winnerRanking.winnerLo.length){
					params.table.summaryOfAllPlayers["hands1"] += "\nThere is no low hand.";
				}
				if(params.data.ritWinnerRanking && params.data.ritWinnerRanking.winnerHigh && !params.data.ritWinnerRanking.winnerLo.length){
					params.table.summaryOfAllPlayers["hands2"] += "\nThere is no low hand.";
				}
				assignWinnersText(params, function (response) {
					
				delete params.summary;
				serverLog(stateOfX.serverLogType.info, 'Summary has been generated successfully for each players: ' + JSON.stringify(params.table.summaryOfAllPlayers));
				cb(null, params);
				});
			}
		});
	}
};

module.exports = summaryRemote;