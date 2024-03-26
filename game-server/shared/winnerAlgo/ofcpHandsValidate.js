/*jshint node: true */
"use strict";


var Card 							            = require("./card.js"),
    cardComparer 			            = require("./cardComparer.js"),
    points                        = require("./points.js"),
    _                             = require("underscore"),
    threeCardsHandComparision			= require("./threeCardsHandComparision.js");

var ofcpHandsValidate = {};

var isRemainInFantasyLand = function(player) {
  console.log("player is in isRemainInFantasyLand - " + JSON.stringify(player));
  console.log(player.royalities.top >=10 && player.royalities.middle >=10 && player.royalities.bottom >=10);
  return (player.royalities.top >=10 && player.royalities.middle >=10 && player.royalities.bottom >=10);
};

var isEligibleForFantasyLand = function(player) {
  console.log("player is in isEligibleForFantasyLand " + JSON.stringify(player));
  console.log(player.royalities.top >=7);
  return (player.royalities.top >=7);
};

var decideFantasyLand = function(player) {
  console.log("player is in decide fantasy land - " + JSON.stringify(player));
  if(player.isInFantasyLand) {
    player.isInFantasyLand = isRemainInFantasyLand(player);
  } else {
    player.isInFantasyLand = isEligibleForFantasyLand(player);
  }
  // if player is in fantasy land decide his number of cards
  if(player.isInFantasyLand) {
    console.log("number of cards in decideFantasyLand - " + points.fantasyLandCards[player.topHand[0].name + player.topHand[1].name + player.topHand[2].name]);
    player.fantasyLandCards = points.fantasyLandCards[player.royalities.top] || 0;
  } else {
    console.log("not again eligible for fantasy land");
    player.fantasyLandCards = 0;
  }
  return player;
};

var compareUnEvenHighCards = function(threeCards, fiveCards) {
  console.log("in compareUnEvenHighCards - " + JSON.stringify(threeCards) + JSON.stringify(fiveCards));
  threeCards.set = _.sortBy(threeCards.set,"priority").reverse();
  fiveCards.set = _.sortBy(fiveCards.set,"priority").reverse();
  console.log("in compareUnEvenHighCards - after sort " + JSON.stringify(threeCards) + JSON.stringify(fiveCards));

  var winner = [];
  if(threeCards.set[0].priority === fiveCards.set[0].priority) {
    console.log("first priority matched in compareUnEvenHighCards");
    if(threeCards.set[1].priority === fiveCards.set[1].priority) {
      console.log("2nd priority matched in compareUnEvenHighCards");
      if(threeCards.set[2].priority === fiveCards.set[2].priority) {
        winner.push(threeCards);
        winner.push(fiveCards);
      } else {
        if(threeCards.set[2].priority > fiveCards.set[2].priority) {
          winner.push(threeCards);
        } else {
          winner.push(fiveCards);
        }
      }
    } else {
      if(threeCards.set[1].priority > fiveCards.set[1].priority) {
        winner.push(threeCards);
      } else {
        winner.push(fiveCards);
      }
    }
  } else {
    if(threeCards.set[0].priority > fiveCards.set[0].priority) {
      winner.push(threeCards);
    } else {
      winner.push(fiveCards);
    }
  }
  console.log("winner in compareUnEvenHighCards - " + JSON.stringify(winner));
  return winner;
};

var compareUnEvenThreeOfAKindCards = function(threeCards, fiveCards) {
  console.log("in compareUnEvenThreeOfAKindCards - " + JSON.stringify(threeCards) + JSON.stringify(fiveCards));
  var winner = [];
  var commonCards = _.sortBy(fiveCards.set,"priority")[2].priority;
  console.log("common in five cards - " + commonCards);
  if(commonCards === threeCards.set[0].priority) {
    winner.push(threeCards);
    winner.push(fiveCards);
  } else {
    if(commonCards > threeCards.set[0].priority) {
      winner.push(fiveCards);
    } else {
      winner.push(threeCards);
    }
  }
  return winner;
};

var compareUnEvenPairCards = function(threeCards, fiveCards) {
  console.log("in compareUnEvenPairCards - " + JSON.stringify(threeCards) + JSON.stringify(fiveCards));
  // find pair in cards in five cards
  var winner = [];
  for(var i=0;i<5;i++) {
    var pairCardsInFive = _.where(fiveCards.set,{"priority": fiveCards.set[i].priority});
    console.log("pairCardsInFive is - " + JSON.stringify(pairCardsInFive));
    if(pairCardsInFive.length > 1) {
      var pairCards5 = fiveCards.set[i].priority;
      break;
    }
  }
  console.log("pairCards5 is - " + pairCards5);

  // find pair cards in threeCards
  for(var i=0;i<3;i++) {
    var pairCardsInThree = _.where(threeCards.set,{"priority": threeCards.set[i].priority});
    console.log("pairCardsInThree is - " + JSON.stringify(pairCardsInThree));
    if(pairCardsInThree.length > 1) {
      var pairCards3 = threeCards.set[i].priority;
      break;
    }
  }
  console.log("pairCards3 is - " + pairCards3);

  if(pairCards3 === pairCards5) {
    console.log("pair cards are equal in compareUnEvenPairCards");
    var remainingFiveCards = _.difference(fiveCards,pairCardsInFive);
    var remainingThreeCards = _.difference(threeCards,pairCardsInThree);
    remainingThreeCards = _.sortBy(remainingThreeCards,"priority").reverse();
    remainingFiveCards = _.sortBy(remainingFiveCards,"priority").reverse();
    console.log("remainingFiveCards and remainingThreeCards are -");
    console.log(remainingFiveCards);
    console.log(remainingThreeCards);
    if(remainingFiveCards[0].priority === remainingThreeCards[0].priority) {
      winner.push(threeCards);
      winner.push(fiveCards);
    } else {
      if(remainingFiveCards[0].priority > remainingThreeCards[0].priority) {
        winner.push(fiveCards);
      } else {
        winner.push(threeCards);
      }
    }
  } else {
    if(pairCards3 > pairCards5) {
      winner.push(threeCards);
    } else {
      winner.push(fiveCards);
    }
  }
  console.log("winner in compareUnEvenPairCards - " + JSON.stringify(winner));
  return winner;
};

var decideWinnerInUnEvenCase = function(threeCards, fiveCards, priority) {
  console.log("params is in decideWinnerInUnEven - ");
  console.log(JSON.stringify(threeCards));
  console.log(JSON.stringify(fiveCards));
  console.log(priority);
  var winner = [];
  if(priority === 1) {
    winner = compareUnEvenHighCards(threeCards, fiveCards);
  }
  if(priority === 2) {
    winner = compareUnEvenPairCards(threeCards, fiveCards);
  }
  if(priority === 4) {
    winner = compareUnEvenThreeOfAKindCards(threeCards, fiveCards);
  }

  return winner;
};


var makeCards = function(playersData) {
  var bottomCards = [], middleCards = [], topCards = [];
  for(var cardsIt=0; cardsIt<5; cardsIt++) {
    bottomCards.push(new Card(playersData.bottomHand[cardsIt].type,playersData.bottomHand[cardsIt].rank));
    middleCards.push(new Card(playersData.middleHand[cardsIt].type,playersData.middleHand[cardsIt].rank));
    if(cardsIt<3) {
      topCards.push(new Card(playersData.topHand[cardsIt].type,playersData.topHand[cardsIt].rank));
    }
  }
  playersData.bottomHand = bottomCards;
  playersData.middleHand = middleCards;
  playersData.topHand    = topCards;
  return playersData;
};

// checking player is foul or not and set foul value to true if any
ofcpHandsValidate.validate = function(playersData) {
  console.log("\nplayersData in ofcpHandsValidate is - " + JSON.stringify(playersData));
  for(playerIt=0; playerIt<playersData.length; playerIt++) {
    if(!playersData[playerIt].isSurrendered) {
      var tempArray = [];
      var isTempFoul = false;
      playersData[playerIt] = makeCards(playersData[playerIt]);
      
      tempArray.push({set : playersData[playerIt].topHand,playerId:"topHand"});
      console.log("tempArray in topHand is - "+JSON.stringify(tempArray));
      console.log(threeCardsHandComparision.getGreatest(tempArray));
      var winnerTop = points.handsPriority[threeCardsHandComparision.getGreatest(tempArray)[0].type];
      console.log("\nwinner top is - " + JSON.stringify(winnerTop));
      
      tempArray = [];
      tempArray.push({set : playersData[playerIt].middleHand,playerId:"middleHand"});
      console.log("tempArray in middleHand is - "+JSON.stringify(tempArray));
      console.log(cardComparer.getGreatest(tempArray));
      var winnerMiddle = points.handsPriority[cardComparer.getGreatest(tempArray)[0].type];
      console.log("\nwinner middle is - " + JSON.stringify(winnerMiddle));
      
      tempArray = [];
      tempArray.push({set : playersData[playerIt].bottomHand,playerId:"bottomHand"});
      var winnerBottom = points.handsPriority[cardComparer.getGreatest(tempArray)[0].type];
      console.log("\nwinner bottom is - " + JSON.stringify(winnerBottom));
      var winner;
      console.log("playerData[playerIt] is in validate - " + JSON.stringify(playersData[playerIt]));
      if(winnerTop === winnerMiddle && winnerMiddle === winnerBottom) {
        winner = decideWinnerInUnEvenCase({set:playersData[playerIt].topHand, cardId:"top"},{set:playersData[playerIt].middleHand, cardId:"middle"},winnerTop);
        console.log("winner is in validate winnerTop === winnerMiddle - " + JSON.stringify(winner));
        if(winner.length === 1 && winner[0].cardId === "top") {
          isTempFoul = true;
        }

        var tempWinner = cardComparer.getGreatest([{set: playersData[playerIt].bottomHand, playerId: "bottom"},{set: playersData[playerIt].middleHand, playerId: "middle"}]);
        console.log("temp winner when winnerMiddle === winnerBottom"  + JSON.stringify(tempWinner));
        if(tempWinner[0].playerId === "middle" && tempWinner.length ===1) {
          isTempFoul = true;
        }

        winner = decideWinnerInUnEvenCase({set:playersData[playerIt].topHand, cardId:"top"},{set:playersData[playerIt].middleHand, cardId:"middle"},winnerTop);
        console.log("winner is in validate winnerTop === winnerBottom - " + JSON.stringify(winner));
        if(winner.length === 1 && winner[0].cardId === "top") {
          isTempFoul = true;
        }

      } else if(winnerTop === winnerMiddle) {
        winner = decideWinnerInUnEvenCase({set:playersData[playerIt].topHand, cardId:"top"},{set:playersData[playerIt].middleHand, cardId:"middle"},winnerTop);
        console.log("winner is in validate winnerTop === winnerMiddle - " + JSON.stringify(winner));
        if(winner.length === 1 && winner[0].cardId === "top") {
          isTempFoul = true;
        }
      } else if(winnerMiddle === winnerBottom) {
        var tempWinner = cardComparer.getGreatest([{set: playersData[playerIt].bottomHand, playerId: "bottom"},{set: playersData[playerIt].middleHand, playerId: "middle"}]);
        console.log("isTempFoul is before compare- " + isTempFoul);
        console.log("temp winner when winnerMiddle === winnerBottom"  + JSON.stringify(tempWinner));
        if(tempWinner[0].playerId === "middle" && tempWinner.length ===1) {
          isTempFoul = true;
        }
      } else if(winnerTop === winnerBottom){
        winner = decideWinnerInUnEvenCase({set:playersData[playerIt].topHand, cardId:"top"},{set:playersData[playerIt].middleHand, cardId:"middle"},winnerTop);
        console.log("winner is in validate winnerTop === winnerBottom - " + JSON.stringify(winner));
        if(winner.length === 1 && winner[0].cardId === "top") {
          isTempFoul = true;
        }
      }
      if(winnerTop>winnerMiddle || winnerTop>winnerBottom || winnerMiddle>winnerBottom) {
        isTempFoul = true;
      }
      console.log("isTempFoul is - " + isTempFoul);
      if(isTempFoul) {
        playersData[playerIt].isInFantasyLand = false;
        playersData[playerIt].fantasyLandCards = 0;
      }
      playersData[playerIt].isFoul = isTempFoul;
    }
  }
  return playersData;
};

// compare two players bottom and middleHand
var compareHands = function(player1, player2) {
  console.log("\nin compareHands player1 are - " + JSON.stringify(player1)+" and player2 "+JSON.stringify(player2));
  var bottomHandWinner = cardComparer.getGreatest([{set: player1.bottomHand, playerId: player1.playerId},{set: player2.bottomHand, playerId: player2.playerId}]);
  console.log("\nbottomHandWinner is in compare cards is - " + JSON.stringify(bottomHandWinner));
  if(player1.playerId === bottomHandWinner[0].playerId) {
    player1.handsWon++;
    player1.pointDetails.bottom++;
    player2.pointDetails.bottom--;
  } else {
    player2.handsWon++;
    player2.pointDetails.bottom++;
    player1.pointDetails.bottom--;
  }
  var middleHandWinner = cardComparer.getGreatest([{set: player1.middleHand, playerId: player1.playerId},{set: player2.middleHand, playerId: player2.playerId}]);
  console.log("\nmiddleHandWinner is in compare cards is - " + JSON.stringify(middleHandWinner));
  // console.log("middleHandWinner"+middleHandWinner.playerId+"player1"+player1.playerId+"player2"+player2.playerId)
  if(player1.playerId === middleHandWinner[0].playerId) {
    player1.pointDetails.middle++;
    player1.handsWon++;
    player2.pointDetails.middle--;
  } else {
    player2.pointDetails.middle++;
    player2.handsWon++;
    player1.pointDetails.middle--;
  }
  console.log("\nafter compare cards player1 are - " + JSON.stringify(player1)+" and player2 "+JSON.stringify(player2));
  return {
    player1 : player1,
    player2 : player2
  };
};

var compareTopHands = function(player1, player2) {
  console.log("\nin compareTopHands player1 are - " + JSON.stringify(player1)+" and player2 "+JSON.stringify(player2));
  var topHandWinner = threeCardsHandComparision.getGreatest([{set: player1.topHand, playerId: player1.playerId},{set: player2.topHand, playerId: player2.playerId}]);
  console.log("\ntop hand winner is in compare top hand - " + JSON.stringify(topHandWinner));
  if(player1.playerId === topHandWinner[0].playerId) {
    player1.handsWon++;
    player1.pointDetails.top++;
    player2.pointDetails.top--;
  } else {
    player2.handsWon++;
    player2.pointDetails.top++;
    player1.pointDetails.top--;
  }
  console.log("\nafter compare top hands player1 are - " + JSON.stringify(player1)+" and player2 "+JSON.stringify(player2));
  return {
    player1 : player1,
    player2 : player2
  };
};

// manage foul points of players who fouled
var manageFoulPoints = function(playersData) {
  for(var playerIt=0; playerIt<playersData.length; playerIt++) {
    if(playersData[playerIt].isFoul) {
      // playersData[playerIt].points -= points.foulPoints;
      var count = 0;
      for(var i=0; i<playerData.length; i++) {
        if(!playersData[i].isFoul) {
          playersData[i].points += points.foulPoints;
          playersData[i].wonFoulPoints += points.foulPoints;
          count++;
        }
      }
      playersData[playerIt].points -= points.foulPoints*count;
    }
  }
  return playersData;
};

ofcpHandsValidate.findRoyalityForHand = function(hand) {
  console.log("\nhand is in findRoyalityForHand " + JSON.stringify(hand));
  var royality = 0;
  var cardSet = [];
  for(var cardsIt=0; cardsIt<5 && cardsIt<hand.cards.length; cardsIt++) {
    cardSet.push(new Card(hand.cards[cardsIt].type,hand.cards[cardsIt].rank));
  }
  console.log("\ncard set is - " + JSON.stringify(cardSet));
  if(hand.handType === "bottomHand") {
    royality = points.royality.bottomHand[cardComparer.getGreatest([{set : cardSet}])[0].type] || 0;
  } else if(hand.handType === "middleHand") {
    royality = points.royality.middleHand[cardComparer.getGreatest([{set : cardSet}])[0].type] || 0;
  } else {
    console.log("top hand");
    if(cardSet[0].rank === cardSet[1].rank && cardSet[1].rank === cardSet[2].rank){
      royality = points.royality.topHand[cardSet[0].name+cardSet[1].name+cardSet[2].name] || 0;
    } else if(cardSet[0].rank == cardSet[1].rank) {
      royality = points.royality.topHand[cardSet[0].name+cardSet[1].name] || 0;
    } else if(cardSet[0].rank == cardSet[2].rank){
      royality = points.royality.topHand[cardSet[0].name+cardSet[2].name] || 0;
    } else if(cardSet[1].rank == cardSet[2].rank){
      royality = points.royality.topHand[cardSet[1].name+cardSet[2].name] || 0;
    } else {
      royality = 0;
    }
  }
  console.log("\nroyality value is - " + royality);
  return royality;
};

// calculate royalities
var calculateRoyality = function(player) {
  console.log("\nplayer is in calculate royality - " + JSON.stringify(player));
  var royalityBottomHand = points.royality.bottomHand[cardComparer.getGreatest([{set : player.bottomHand}])[0].type] || 0;
  var royalityMiddleHand = points.royality.middleHand[cardComparer.getGreatest([{set : player.middleHand}])[0].type] || 0;
  var royalityTopHand = 0;
  var topHand = threeCardsHandComparision.getGreatest([{set : player.topHand}])[0].type;
  console.log("\ntopHand is - " + JSON.stringify(topHand));
  if(topHand === "threeofakind") {
    royalityTopHand = points.royality.topHand[player.topHand[0].name+player.topHand[1].name+player.topHand[2].name];
  } else if(topHand === "onepair") {
    console.log("\nin one pair");
    if(player.topHand[0].rank == player.topHand[1].rank) {
      royalityTopHand = points.royality.topHand[player.topHand[0].name+player.topHand[1].name];
    } else if(player.topHand[0].rank == player.topHand[2].rank){
      royalityTopHand = points.royality.topHand[player.topHand[0].name+player.topHand[2].name];
    } else {
      royalityTopHand = points.royality.topHand[player.topHand[2].name+player.topHand[2].name];
    }
  }
  var royalities = {
    top : royalityTopHand,
    bottom : royalityBottomHand,
    middle : royalityMiddleHand
  };
  console.log("\nroyalities is - " + JSON.stringify(royalities));
  return royalities;
};

var compareRoyalities = function(playerData) {
  console.log("\nplayerData are in compare royalities - " + JSON.stringify(playerData));
  for(var playerIt=0; playerIt<playerData.length; playerIt++) {
    for(var i=playerIt+1; i<playerData.length; i++) {
      var temp1  = playerData[playerIt].royalities.top + playerData[playerIt].royalities.bottom + playerData[playerIt].royalities.middle;
      var temp2  = playerData[i].royalities.top + playerData[i].royalities.bottom + playerData[i].royalities.middle;
      console.log("\ntemp1 and temp2 is - " + temp1 + "  "+ temp2);
      if(temp1 > temp2) {
        playerData[playerIt].points += temp1 - temp2;
        playerData[i].points -= temp1 - temp2;
      } else {
        playerData[playerIt].points -= temp2 - temp1;
        playerData[i].points += temp2 - temp1;
      }
      // Calculation for point details
      if(playerData[playerIt].royalities.top > playerData[i].royalities.top) {
        playerData[playerIt].pointDetails.top += playerData[playerIt].royalities.top - playerData[i].royalities.top;
        playerData[i].pointDetails.top -= playerData[playerIt].royalities.top - playerData[i].royalities.top;
      } else {
        playerData[playerIt].pointDetails.top -= playerData[i].royalities.top - playerData[playerIt].royalities.top;
        playerData[i].pointDetails.top += playerData[i].royalities.top - playerData[playerIt].royalities.top;
      }
      if(playerData[playerIt].royalities.bottom > playerData[i].royalities.bottom) {
        playerData[playerIt].pointDetails.bottom += playerData[playerIt].royalities.bottom - playerData[i].royalities.bottom;
        playerData[i].pointDetails.bottom -= playerData[playerIt].royalities.bottom - playerData[i].royalities.bottom;
      } else {
        playerData[playerIt].pointDetails.bottom -= playerData[i].royalities.bottom - playerData[playerIt].royalities.bottom;
        playerData[i].pointDetails.bottom += playerData[i].royalities.bottom - playerData[playerIt].royalities.bottom;
      }
      if(playerData[playerIt].royalities.middle > playerData[i].royalities.middle) {
        playerData[playerIt].pointDetails.middle += playerData[playerIt].royalities.middle - playerData[i].royalities.middle;
        playerData[i].pointDetails.middle -= playerData[playerIt].royalities.middle - playerData[i].royalities.middle;
      } else {
        playerData[playerIt].pointDetails.middle -= playerData[i].royalities.middle - playerData[playerIt].royalities.middle;
        playerData[i].pointDetails.middle += playerData[i].royalities.middle - playerData[playerIt].royalities.middle;
      }
    }
  }

  console.log("\nplayer data after comparing royalities - " + JSON.stringify(playerData));
  return playerData;
};

var manageHandsPoints = function(player1, player2) {
  console.log("\nplayer is in manageHandsPoints - " + JSON.stringify(player1) + "player2 - "+ JSON.stringify(player2));
  if(player1.handsWon === 3) {
    player1.points +=6;
    player2.points -=6;
    player1.isScoop = true;
  } else if(player2.handsWon === 3){
    player2.points +=6;
    player1.points -=6;
    player2.isScoop = true;
  } else if(player1.handsWon > player2.handsWon) {
    player1.points += (player1.handsWon - player2.handsWon);
    player2.points -= (player1.handsWon - player2.handsWon);
  } else {
    player2.points += (player2.handsWon - player1.handsWon);
    player1.points -= (player2.handsWon - player1.handsWon);
  }
  player1.handsWon = 0;
  player2.handsWon = 0;
  console.log("\nplayers after manageHandsPoints - " + JSON.stringify(player1) + "player2 - "+ JSON.stringify(player2));
  return {
    player1 : player1,
    player2 : player2
  };
};

var distributePoints = function(playersData) {
  console.log('\nplayersData in distributePoints points - ' + JSON.stringify(playersData));
  // iterating player for distribute points
  for(var playerIt=0; playerIt<playersData.length; playerIt++) {
    console.log('\ncurrent player points are - ' + playersData[playerIt].points);

    if(playersData[playerIt].points > 0) { // check whether current player have sufficient points or not to distribute
     
      for(var j=playerIt+1; j<playersData.length; j++) {
        
        // Surrender Calculation Starts ------------------
        if(playersData[playerIt].isSurrendered && playersData[j].points>0 && !playersData[j].isSurrendered && playersData[playerIt].points > 0) { // check wheteher not surrender player have sufficient points or not
          console.log('\nplayer is surrender in distribute points');
          var maxPointsToDistribute = (playersData[playerIt].points > playersData[j].points) ? playersData[j].points : playersData[playerIt].points;
          maxPointsToDistribute = maxPointsToDistribute > points.surrenderPoints ? points.surrenderPoints : maxPointsToDistribute;
          console.log('\nmax point to distribute is - ' + maxPointsToDistribute);
          playersData[j].points += maxPointsToDistribute; // adding points to non surrender player
          playersData[playerIt].points -= maxPointsToDistribute; // deducting point from surrender player
        }
        console.log('\nplayersData after surrenderPoints calculation' + JSON.stringify(playersData));
        // Surrender Calculation Ends ------------------
        
        // Foul Calculation Starts --------------------
        if(!playersData[playerIt].isSurrendered && playersData[playerIt].isFoul && playersData[playerIt].points>0 && !playersData[j].isSurrendered && !playersData[j].isFoul && playersData[j].points>0) {
          console.log('\nplayer is foul in distribute points');
          var maxPointsToDistribute = (playersData[playerIt].points > playersData[j].points) ? playersData[j].points : playersData[playerIt].points;
          maxPointsToDistribute = maxPointsToDistribute > points.foulPoints ? points.foulPoints : maxPointsToDistribute;
          console.log('\nmax point to distribute is - ' + maxPointsToDistribute);
          playersData[j].points += maxPointsToDistribute; // adding points to non foul player
          playersData[playerIt].points -= maxPointsToDistribute; // deducting point from foul player
        }
        console.log('\nplayersData after foulPoints calculation' + JSON.stringify(playersData));
        // Foul Calculation Ends -----------------------

        // Royality Calculation starts
        if(!playersData[playerIt].isSurrendered && !playersData[playerIt].isFoul && playersData[playerIt].points>0 && !playersData[j].isSurrendered && !playersData[j].isFoul && playersData[j].points>0) {
          for(var royalityIt=0; royalityIt<playersData[j].royalities.length; royalityIt++) {
            if(playersData[playerIt].top > playersData[j].royalities[royalityIt].top) {
              var diff = playersData[playerIt].top - playersData[j].royalities[royalityIt].top;
              var maxPointsToDistribute = (playersData[playerIt].points > playersData[j].points) ? playersData[j].points : playersData[playerIt].points;
              maxPointsToDistribute = maxPointsToDistribute > points.foulPoints ? points.foulPoints : maxPointsToDistribute;
              console.log('\nmax point to distribute is - ' + maxPointsToDistribute);
              playersData[j].points += maxPointsToDistribute; // adding points to non foul player
              playersData[playerIt].points -= maxPointsToDistribute; // deducting point from foul player
            } else {
              var diff = playersData[j].royalities[royalityIt].top - playersData[playerIt].top;
            }
          }
        }
      }

    } 
  }
  console.log('\nplayerData after distributePoints points - ' + JSON.stringify(playersData));
};

ofcpHandsValidate.winningAlgo = function(playersData) {
  console.log("\nIn winnerAlgo in ofcp " + JSON.stringify(playersData));
  
  // check for player foul
  // playerData = ofcpHandsValidate.validate(playersData);
  // console.log("\nplayerData is in winningAlgo after validate - " + JSON.stringify(playerData));
  // var playerIt=0;
  
  // Insert royalities in player structure;
  for(playerIt=0; playerIt<playersData.length; playerIt++) {
    if(!playersData[playerIt].isFoul) {
      playersData[playerIt].personalRoyalities = calculateRoyality(playersData[playerIt]);
    }
  }
  console.log("\nplayerData after inserting royalities - " + JSON.stringify(playersData));

  distributePoints(playersData);


  // //Compare royalities
  // playerData = compareRoyalities(playerData);
  // console.log("\nplayerData after compareRoyalities - " + JSON.stringify(playerData));

  // // Mange Foul Points
  // playersData = manageFoulPoints(playersData);
  // console.log("\nplayers data after foul points in winner algo " + JSON.stringify(playersData));

  // // compare Hands
  // // remove foul players
  // var validPlayers = _.where(playerData,{isFoul: false});
  // var foulPlayers  = _.where(playerData,{isFoul: true});
  // console.log("\nvalid players are -" + JSON.stringify(validPlayers));
  // console.log("\nfoul players are -" + JSON.stringify(foulPlayers));
  // for(var playerIt=0; playerIt<validPlayers.length; playerIt++) {
  //   validPlayers[playerIt] = decideFantasyLand(validPlayers[playerIt]);
  //   console.log("player after decide fantasy land " + JSON.stringify(validPlayers[playerIt]));
  //   for(var temp=playerIt+1; temp<validPlayers.length; temp++) {
  //     //compare bottom hands and middle hands
  //     var tempCompareHands = compareHands(validPlayers[playerIt], validPlayers[temp]);
  //     validPlayers[playerIt] = tempCompareHands.player1;
  //     validPlayers[temp] = tempCompareHands.player2;

  //     //compare top hands
  //     var tempCompareTopHands = compareTopHands(validPlayers[playerIt], validPlayers[temp]);
  //     validPlayers[playerIt] = tempCompareTopHands.player1;
  //     validPlayers[temp] = tempCompareTopHands.player2;

  //     // Manage Points of hands
  //     var tempManageFoulPoints = manageHandsPoints(validPlayers[playerIt], validPlayers[temp]);
  //     validPlayers[playerIt] = tempManageFoulPoints.player1;
  //     validPlayers[temp] = tempManageFoulPoints.player2;
  //   }
  // }
  // var finalWinner = _.union(validPlayers,foulPlayers);
  // console.log("\nfinal winner in ofcpHandsValidate is - " + JSON.stringify(finalWinner));
  // return finalWinner;
};

module.exports = ofcpHandsValidate;
