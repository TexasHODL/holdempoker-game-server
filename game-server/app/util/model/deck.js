/*jshint node: true */
"use strict";

var Card = require('./cards');

// class like function for deck
function Deck() {
   
    var deck = [],
        types = {
            'heart': {
                priority: 3
            },
            'spade': {
                priority: 4
            },
            'diamond': {
                priority: 2
            },
            'club': {
                priority: 1
            }
        };

    // make 52 cards
    function makeCards() {
        for (var type in types) {
            for (var a = 1; a <= 13; a++) {
                deck.push(new Card(type, a));
            }
        }
    }
    makeCards();

    function getCards() {
        return deck;
    }

    function getRandomArbitrary(min, max) {
        return parseInt(Math.random() * (max - min) + min, 0);
    }

    // shuffle cards deck 
    function shuffle() {
        var len = deck.length,
            tempVal, randIdx;
        while (0 !== len) {
            randIdx = Math.floor(Math.random() * len);
            len--;
            deck[len].id = Math.random();
            deck[randIdx].id = Math.random();
            tempVal = deck[len];
            deck[len] = deck[randIdx];
            deck[randIdx] = tempVal;
        }
    }

    function getRandomCards(num) {
        var randCards = [];
        var cardInserted = {},
            nCard = null;
        for (var count = 1; count <= num;) {
            nCard = getRandomArbitrary(1, 52);
            if (!cardInserted[nCard]) {
                randCards.push($.extend({
                    id: Math.random()
                }, deck[nCard - 1]));
                cardInserted[nCard] = true;
                count++;
            }
        }
        return randCards;
    }


    return {
        getCards: getCards,
        getRandomCards: getRandomCards,
        shuffle: shuffle
    };
}

module.exports = new Deck();