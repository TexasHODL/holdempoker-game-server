/*jshint node: true */
"use strict";


var _ 							= require("underscore"),
	cardsConfig        = require("./cardConfig"),
	cardConfiguration = {};

var kickerText = " Kicker";

// High Card Ace, J Kicker
var makeHighCardText = function(cards) {
	// console.log('cards is in makeHighCardText is - ' + JSON.stringify(cards));
	var cards = _.sortBy(cards, 'priority').reverse();
	// console.log('cards is - ' + JSON.stringify(cards));
	// console.log('text is - ' + cardsConfig.card[cards[0].priority])
	return cardsConfig.highCard + cardsConfig.card[cards[0].priority] + ', ' + cardsConfig.cardChar[cards[1].priority] + kickerText;
};

// One Pair Aces, J Kicker
var makeOnePairText = function(cards) {
	var cards = _.sortBy(cards, 'priority');
	if(cards[0].priority === cards[1].priority) {
		var tmp = cardsConfig.onePair + cardsConfig.cardPlural[cards[0].priority];
	}
	if(cards[1].priority === cards[2].priority) {
		var tmp = cardsConfig.onePair + cardsConfig.cardPlural[cards[1].priority];
	}
	if(cards[2].priority === cards[3].priority) {
		var tmp = cardsConfig.onePair + cardsConfig.cardPlural[cards[2].priority];
	}
	if(cards[3].priority === cards[4].priority) {
		var tmp = cardsConfig.onePair + cardsConfig.cardPlural[cards[3].priority];
		var kickerIndex = 2;
	} else {
		var kickerIndex = 4;
	}
	return tmp + ', ' + cardsConfig.cardChar[cards[kickerIndex].priority] + kickerText;
};

// Two Pairs: Aces and Tens, J Kicker
var makeTwoPairText = function(cards) {
	var tempArray = _.pluck(cards, "priority");
	// console.log('tempArray is - ' + JSON.stringify(tempArray));
	var single;
	for(var i = 0;i<tempArray.length;i++) {
		single = single^tempArray[i];
	}
	// console.log('single is - ' + single);
	var diff = _.difference(tempArray,[single]);
	// console.log('diff is - ' + JSON.stringify(diff));
	var uniq = _.unique(diff);
	// console.log('uniq is - ' + JSON.stringify(uniq));
	return cardsConfig.twoPair + cardsConfig.cardPlural[uniq[0]] + " and " + cardsConfig.cardPlural[uniq[1]] + ", " + cardsConfig.cardChar[single] + kickerText;
};

// Three Of A Kind Aces
var makeThreeOfAKindText = function(cards) {
	var cards = _.sortBy(cards, 'priority');
	return cardsConfig.threeOfAKind + cardsConfig.cardPlural[cards[2].priority];
};

// Straight: Ten High
var makeStraightText = function(cards) {
	var cards = _.sortBy(cards, 'priority');
	// console.log('cards is in makeStraightText - ' + JSON.stringify(cards));
	if (cards[4].priority==14 && cards[3].priority==5) {
		return cardsConfig.straight + cardsConfig.card[cards[3].priority] + " High";
	} else {
	return cardsConfig.straight + cardsConfig.card[cards[4].priority] + " High";
	}
};

// Flush: Ace High
var makeFlushText = function(cards) {
	var cards = _.sortBy(cards, 'priority');
	// console.log('cards is in makeStraightText - ' + JSON.stringify(cards));
	return cardsConfig.flush + cardsConfig.card[cards[4].priority] + " High";
};

// Full house: Jacks full of Aces
var makeFullHouseText = function(cards) {
	// console.log('cards is in makeFullHouseText - ' + JSON.stringify(cards));
	var cards = _.sortBy(cards, 'priority');
	var three = cards[2].priority;
	var tempArray = _.pluck(cards, "priority");
	// console.log('tempArray is - ' + JSON.stringify(tempArray));
	var two = (_.difference(tempArray,[three]))[0];
	// console.log('two is - ' + two);
	return cardsConfig.fullHouse + cardsConfig.cardPlural[three] + " full of " + cardsConfig.cardPlural[two]; 
};

// Four Of A Kind Aces
var makeFourOfAKindText = function(cards) {
	var cards = _.sortBy(cards, 'priority');
	return cardsConfig.fourOfAKind + cardsConfig.cardPlural[cards[2].priority]; 
};

// Straight Flush: Five High
var makeStraightFlushText = function(cards) {
	var cards = _.sortBy(cards, 'priority');
	if (cards[4].priority==14 && cards[3].priority==5) {
		return cardsConfig.straightFlush + cardsConfig.card[cards[3].priority] + " High";
	} else {
	return cardsConfig.straightFlush + cardsConfig.card[cards[4].priority] + " High";
	}
};

// Royal Flush: Ace to Ten
var makeRoyalFlushText = function(cards) {
	return cardsConfig.royalFlush;
};



cardConfiguration.findCardConfig = function(params) {
	// console.log('in findCardConfig params are - ' + JSON.stringify(params));
	switch(params.type) {
		case  'High Card' 			: return makeHighCardText(params.set); 
    case  'One Pair' 				: return makeOnePairText(params.set); 
    case  'Two Pairs' 			: return makeTwoPairText(params.set); 
    case  'Three Of A Kind' : return makeThreeOfAKindText(params.set); 
    case  'Straight' 				: return makeStraightText(params.set); 
    case  'Flush' 					: return makeFlushText(params.set); 
    case  'Full House' 			: return makeFullHouseText(params.set); 
    case  'Four Of A Kind' 	: return makeFourOfAKindText(params.set); 
    case  'Straight Flush' 	: return makeStraightFlushText(params.set); 
    case  'Royal Flush' 		: return makeRoyalFlushText(params.set); 
    default 								: console.log("this case is exceptional"); break;
	}
};


module.exports = cardConfiguration;


           