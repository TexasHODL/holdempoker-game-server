/*jshint node: true */
"use strict";


var Card 						= require("./card.js"),
	cardComparer 			= require("./cardComparer.js"),
  comb 							= require("./combination.js"),
  stateOfX 					= require("../stateOfX.js"),
  ofcpHandsValidate = require("./ofcpHandsValidate.js"),
  cardConfiguration = require("./cardConfiguration.js"),
  points            = require("./points.js"),
  winnerRanking     = require("./winnerRanking.js"),
  _ 								= require("underscore"),
  winner = {};

//### This function is used to make player cards using player cards and board cards

/**
 * This function is used to make player cards using player cards and board cards
 * @method makeCards
 * @param  {object}  params contains required player cards and board cards
 * @return {object}         players containing playerObject
 */
function makeCards(params) {
	var playerCards = params.playerCards;
	var boardCards = params.boardCards;
	var players = [];
	var boardCardsArray = makeBoardCards(boardCards);
	for(var i=0; i<playerCards.length; i++) {
		var playerObject = {};
		playerObject.cards = [];
		playerObject.playerId = playerCards[i].playerId;
		var playerObjectCards = playerCards[i].cards;
		var cardObject;
		for(var j=0; j<playerObjectCards.length; j++) {
			cardObject = new Card(playerObjectCards[j].type,playerObjectCards[j].rank);
			playerObject.cards.push(cardObject);
		}
		for(var k=0; k<boardCardsArray.length; k++) {
			playerObject.cards.push(boardCardsArray[k]);
		}
		players.push(playerObject);
	}
	return players;
}

//### This functin is used to make board cards
/**
 * this function is used to make board cards
 * @method makeBoardCards
 * @param  {[type]}       params [description]
 * @return {[type]}              [description]
 */
function makeBoardCards(params) {
	var boardCards = [];
	var cardObject;
	for(var i=0; i<params.length; i++) {
		cardObject = new Card(params[i].type,params[i].rank);
		boardCards.push(cardObject);
	}
	return boardCards;
}

// This function finds the best hand combination of cards among cards array
function makeBestCombination(paramsObject) {
	// console.log("params object in makeBestCombination - " + JSON.stringify(paramsObject));
	var players = makeCards(paramsObject);
	// console.log("players is in makeBestCombination - "  + JSON.stringify(players));
	var tempWinner = [],winners;
	for(var i=0; i<players.length; i++) {
		var tempObject = {};
		var allCombos = comb(players[i].cards,5);
		var tempArray = [];
		for(var j = 0; j<allCombos.length; j++) {
			var obj = {};
			obj.set = allCombos[j];
			tempArray.push(obj);
		}
		// console.log("temp array is in bestCombinaiton is - " + JSON.stringify(tempArray));
		var bestComb = cardComparer.getGreatest(tempArray);
		// console.log("best comb is - " + JSON.stringify(bestComb));
		tempObject.playerId = players[i].playerId;
		tempObject.set = bestComb;
		// console.log("temp object is - " + JSON.stringify(tempObject));
		tempWinner.push(tempObject);
	}
	//winners = cardComparer.getGreatest(tempWinner);
	// console.log("temp winne is - " + JSON.stringify(tempWinner));
	return tempWinner;
}

//### This function is used to decide winner for texas hold em and main function called by client who using algo
winner.findWinner = function(paramsObject) {
	// console.log("paramsObject in findWinner " + JSON.stringify(paramsObject));
	var tempWinners = makeBestCombination(paramsObject);
	var tempArray = [];
	// console.log("temp winner is in find winnr is - " + JSON.stringify(tempWinners));
	for(var j = 0; j<tempWinners.length; j++) {
		var obj = {};
		if(!!tempWinners[j].set[0]) {
			obj.set = tempWinners[j].set[0].set;
			obj.type = tempWinners[j].set[0].type;
		} else {
			obj.set = tempWinners[j].set.set;
			obj.type = tempWinners[j].set.type;
		}
		obj.playerId = tempWinners[j].playerId;
		obj.priority = points.handsPriority[obj.type];
		tempArray.push(obj);
	}
	// console.log("tempArray is - " + JSON.stringify(tempArray));
	var finalWinners = winnerRanking.findWinnersRanking(tempArray);
	// console.log("finalWinners are --- " + JSON.stringify(finalWinners));
	return finalWinners;
};

//### This function is used to decide winner for OMAHA game and main function called by client who using algo
winner.findWinnerOmaha = function(paramsObject) {
	var tempWinners = makeBestCombinationOmaha(paramsObject);
	// console.log("tempWinners are in omaha - " + JSON.stringify(tempWinners));
	var finalWinners = winnerRanking.findWinnersRanking(tempWinners);
	// console.log("finalWinners are - " + JSON.stringify(finalWinners));
	return finalWinners;
};

//### This function is used to make cards for omaha
var makeBestCombinationOmaha = function(paramsObject) {
	var allCombos = comb(paramsObject.boardCards,3);
	var tempWinners = [];
	for(var i=0; i<paramsObject.playerCards.length; i++) {
		// var allCombosPlayer = comb(paramsObject.playerCards[i].cards,2);
		var allCombos5 = makeCardsOmaha(allCombos,comb(paramsObject.playerCards[i].cards,2));
		// console.log('tempArray length is - ',allCombos5.length);
		var paramsArray = [];
		for(var k = 0; k<allCombos5.length; k++) {
			paramsArray.push({
				set : allCombos5[k]
			});
		}
		var bestComb = cardComparer.getGreatest(paramsArray);
		// console.log("bestComb is in makeBestCombinationOmaha - " + JSON.stringify(bestComb));
		tempWinners.push({
			playerId : paramsObject.playerCards[i].playerId,
			set      : bestComb[0].set,
			priority : points.handsPriority[bestComb[0].type],
			type     : bestComb[0].type
		});
	}
	// console.log('tempWinners are - ' + JSON.stringify(tempWinners))
	return tempWinners;
};

//### This function is used to make best combination cards for omaha hi lo
var makeBestCombinationOmahaHiLo = function(paramsObject) {
	var allCombos = comb(paramsObject.boardCards,3);
	var tempWinnersFinal = [];
	for(var i=0; i<paramsObject.playerCards.length; i++) {
		var allCombosPlayer = comb(paramsObject.playerCards[i].cards,2);
		var tempArray = makeCardsOmaha(allCombos,allCombosPlayer);
		var paramsArray = [];
		for(var k = 0; k<tempArray.length; k++) {
			var obj = {};
			obj.set = tempArray[k];
			obj.playerId = paramsObject.playerCards[i].playerId;
			paramsArray.push(obj);
		}
		var bestComb = cardComparer.getGreatestOmahaLo(paramsArray);
		if(!!bestComb) {
			tempWinnersFinal.push(bestComb);
		}
	}
	return tempWinnersFinal;
};

//### This function is used to make cards for omaha
var makeCardsOmaha = function(boardCardsCombos, playerCardsCombos) {
	var tempArray = [];
	for(var i=0;i<boardCardsCombos.length;i++) {
		for(var j=0;j<playerCardsCombos.length;j++) {
			var playerCardsObject = makeBoardCards(playerCardsCombos[j]);
			var boardCardsArray = makeBoardCards(boardCardsCombos[i]);
			tempArray.push(playerCardsObject.concat(boardCardsArray));
		}
	}
	return tempArray;
};

var createResponseForBestHand = function(params) {
	// console.log('in createResponseForBestHand is - ' + JSON.stringify(params));
	for(var i=0; i<params.length; i++) {
		var tempSet = params[i].set[0]; 
		params[i] = _.omit(params[i],"set");
		params[i].set = tempSet.set;
		params[i].type = tempSet.type;
		params[i].typeName = tempSet.typeName;
	}
	// console.log('params tto return  - ' + JSON.stringify(params));
	return params;
};

//### This function is used to decide winner for OMAHA HI LO game and main function called by client who using algo
winner.findWinnerOmahaHiLo = function(paramsObject) {
	var finalWinnerForLo = [];
	var tempWinnersForHi = makeBestCombinationOmaha(paramsObject);
	var finalWinnerForHi = winnerRanking.findWinnersRanking(tempWinnersForHi);
	var tempWinnersForLo = makeBestCombinationOmahaHiLo(paramsObject);
	if(tempWinnersForLo.length > 0) {
		finalWinnerForLo = winnerRanking.findWinnerOmahaLo(tempWinnersForLo);
		// console.log("finalWinnerForLo is - " + finalWinnerForLo);
	}
	if(!finalWinnerForHi[0]) {
		finalWinnerForHi = [finalWinnerForHi];	
	}
	if(!finalWinnerForLo[0] && Object.keys(finalWinnerForLo).length>0) {
		finalWinnerForLo = [finalWinnerForLo];	
	}
	return {
		winnerHigh : finalWinnerForHi,
		winnerLo   : finalWinnerForLo
	};
};

winner.ofcpHandsValidate = function(playersData) {
	// console.log("players data in ofcpHandsValidate are - " + JSON.stringify(playersData));
	return ofcpHandsValidate.validate(playersData);
};

winner.findOfcpWinner = function(playersData) {
	// console.log("players data in findOfcpWinner are - " + JSON.stringify(playersData));
	var winnner = ofcpHandsValidate.winningAlgo(playersData);
	// console.log("players data in findOfcpWinner are after decision- " + JSON.stringify(winnner));
	return winnner;
};

winner.findRoyalityForHand = function(hand) {
	// console.log("hand is in findRoyalityForHand is - " + JSON.stringify(hand) + ofcpHandsValidate.findRoyalityForHand(hand));
	return ofcpHandsValidate.findRoyalityForHand(hand);
};

winner.findBestHand = function(params) {
	// console.log('cards is in entry.js - ' + JSON.stringify(params));
	if(params.playerCards[0].cards.length === 2) {
		return createResponseForBestHand(makeBestCombination(params));
	}
	if(params.playerCards[0].cards.length === 4) {
		return winner.findWinnerOmaha(params);
	}
	return -1;
};

winner.findBestHand = function(params) {
	// console.log('cards is in entry.js - ' + JSON.stringify(params));
	if(params.playerCards[0].cards.length === 2) {
		return createResponseForBestHand(makeBestCombination(params));
	}
	if(params.playerCards[0].cards.length === 4) {
		return winner.findWinnerOmaha(params);
	}
	return -1;
};


winner.findCardsConfiguration = function(params,gameType) {
	var bestHand = [];
	var result = [];
	// console.log('params is in findCardsConfiguration - ' + JSON.stringify(params));
	if(params.playerCards[0].cards.length === 2) {
		for(var i=0; i<params.playerCards.length; i++) {
			var tempParams = {
				boardCards: params.boardCards,
				playerCards: [params.playerCards[i]]
			};
			// console.log('temp params is - ' + JSON.stringify(tempParams));
			var bestHand = createResponseForBestHand(makeBestCombination(tempParams));
			// console.log('bestHand is - ' + JSON.stringify(bestHand));
			var text = cardConfiguration.findCardConfig(bestHand[0]);
			// console.log('returned text is - ' + text)
			bestHand[0].text = text;
			result.push(bestHand[0]);
		}
		return result;
	}
	if(params.playerCards[0].cards.length === 4 && gameType === stateOfX.channelVariation.omaha) {
		for(var i=0; i<params.playerCards.length; i++) {
			var tempParams = {
				boardCards: params.boardCards,
				playerCards: [params.playerCards[i]]
			};
			// console.log('temp params is - ' + JSON.stringify(tempParams));
			var bestHand = winner.findWinnerOmaha(tempParams);
			// console.log('bestHand is - ' + JSON.stringify(bestHand));
			var text = cardConfiguration.findCardConfig(bestHand[0]);
			// console.log('returned text is - ' + text)
			bestHand[0].text = text;
			result.push(bestHand[0]);
		}
		return result;
	}

	if(params.playerCards[0].cards.length === 4 && gameType === stateOfX.channelVariation.omahahilo) {
		// console.log('----------------in omahahilo-----------------');
		for(var i=0; i<params.playerCards.length; i++) {
			var tempResponse = {
				winnerHigh : [],
				winnerLo   : []
			};
			var tempParams = {
				boardCards: params.boardCards,
				playerCards: [params.playerCards[i]]
			};
			// console.log('temp params is - ' + JSON.stringify(tempParams));
			var tempWinners = winner.findWinnerOmahaHiLo(tempParams);
			// console.log('tempWinners is in findCardsConfiguration - ' + JSON.stringify(tempWinners));
			// console.log('bestHand is - ' + JSON.stringify(tempWinners.winnerHigh[0]));
			// console.log('winner lo is ------- ' + JSON.stringify(tempWinners.winnerLo))
			var textForHigh = cardConfiguration.findCardConfig(tempWinners.winnerHigh[0]);
			// console.log('returned text for textForHigh is - ' + textForHigh)
			tempWinners.winnerHigh[0].text = textForHigh;
			tempResponse.winnerHigh = tempWinners.winnerHigh;
			tempResponse.winnerLo = tempWinners.winnerLo;
			result.push(tempResponse);
		}
		return result;
	}
};

module.exports = winner;
