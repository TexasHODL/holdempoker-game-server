/*jshint node: true */
"use strict";

var cardsConfig = {};
/*
cardsConfig.card = {
	"1" : "Ace",
	"2" : "2",
	"3" : "3",
	"4" : "4",
	"5" : "5",
	"6" : "6",
	"7" : "7",
	"8" : "8",
	"9" : "9",
	"10": "10",
	"11": "J",
	"12": "Q",
	"13": "K",
	"14": "Ace"
};
*/
cardsConfig.card = {
	"1" : "Ace",
	"2" : "Two",
	"3" : "Three",
	"4" : "Four",
	"5" : "Five",
	"6" : "Six",
	"7" : "Seven",
	"8" : "Eight",
	"9" : "Nine",
	"10": "Ten",
	"11": "Jack",
	"12": "Queen",
	"13": "King",
	"14": "Ace"
};

cardsConfig.cardPlural = {
	"1" : "Aces",
	"2" : "Twos",
	"3" : "Threes",
	"4" : "Fours",
	"5" : "Fives",
	"6" : "Sixes",
	"7" : "Sevens",
	"8" : "Eights",
	"9" : "Nines",
	"10": "Tens",
	"11": "Jacks",
	"12": "Queens",
	"13": "Kings",
	"14": "Aces"
};

cardsConfig.cardChar = {
	"1" : "A",
	"2" : "2",
	"3" : "3",
	"4" : "4",
	"5" : "5",
	"6" : "6",
	"7" : "7",
	"8" : "8",
	"9" : "9",
	"10": "10",
	"11": "J",
	"12": "Q",
	"13": "K",
	"14": "A"
};

/*
cardsConfig.highCard      = "High Card with ";
cardsConfig.onePair       = "One pair of ";
cardsConfig.twoPair       = "Two pair of ";
cardsConfig.threeOfAKind  = "3 of a kind of ";
cardsConfig.straight      = "Straight with ";
cardsConfig.flush         = "Flush with suit ";
cardsConfig.fullHouse     = "Full house full of Three ";
cardsConfig.fourOfAKind   = "4 of a kind with 4 ";
cardsConfig.straightFlush = "Suit of ";
cardsConfig.royalFlush    = "Suit of ";
*/
// 1. High Card with Ace
// 2. One pair of K
// 3. two pair of K and 10
// 4. 3 of a kind of K
// 5. Full house full of Three Aces and 2 jacks
// 6. 4 of a kind with 4 Aces
// 7. straight flush with Ace(High) and 10(low)
// 8. Flush with suit Diamond and Queen (High)
// 9. straight flush : Suit of diamond with Ace(High) and 10(low)
// 10. royal flush : Suit of Diamond. 


cardsConfig.highCard      = "High Card ";
cardsConfig.onePair       = "One Pair ";
cardsConfig.twoPair       = "Two Pairs: ";
cardsConfig.threeOfAKind  = "Three Of A Kind ";
cardsConfig.straight      = "Straight: ";
cardsConfig.flush         = "Flush: ";
cardsConfig.fullHouse     = "Full house: ";
cardsConfig.fourOfAKind   = "Four Of A Kind ";
cardsConfig.straightFlush = "Straight Flush: ";
cardsConfig.royalFlush    = "Royal Flush: Ace to Ten";

// 1. High Card Ace, J Kicker
// 2. One Pair Aces, J Kicker
// 3. Two Pairs: Aces and Tens, J Kicker
// 4. Three Of A Kind Aces
// 5. Full house: Jacks full of Aces
// 6. Four Of A Kind Aces
// 7. Straight: Ten High
// 8. Flush: Ace High
// 9. Straight Flush: Five High
// 10. Royal Flush: Ace to Ten

module.exports = cardsConfig;