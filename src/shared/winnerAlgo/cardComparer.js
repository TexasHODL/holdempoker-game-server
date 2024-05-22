/*jshint node: true */
"use strict";

var _ = require('underscore');


function CardComparer() {
  var _options = {
    // winning priority of suits are not in action now this is for future use
    wininingPriority: {
      cardType: {
        "spade": {
          priority: 4
        },
        "heart": {
          priority: 3
        },
        "diamond": {
          priority: 2
        },
        "club": {
          priority: 1
        }
      },
      // for setting the hands priority
      setType: {
        "highcard": {
          type: 'High Card',
          displayName: 'High Card',
          priority: 1
        },
        "onepair": {
          type: 'One Pair',
          displayName: 'One Pair',
          priority: 2
        },
        "twopair": {
          type: 'Two Pairs',
          displayName: 'Two Pairs',
          priority: 3
        },
        "threeofakind": {
          type: 'Three Of A Kind',
          displayName: 'Three Of A Kind',
          priority: 4
        },
        "straight": {
          type: 'Straight',
          displayName: 'Straight',
          priority: 5
        },
        "flush": {
          type: 'Flush',
          displayName: 'Flush',
          priority: 6
        },
        "fullhouse": {
          type: 'Full House',
          displayName: 'Full House',
          priority: 7
        },
        "fourofakind": {
          type: 'Four Of A Kind',
          displayName: 'Four Of A Kind',
          priority: 8
        },
        "straightflush": {
          type: 'Straight Flush',
          displayName: 'Straight Flush',
          priority: 9
        },
        "royalflush": {
          type: 'Royal Flush',
          displayName: 'Royal Flush',
          priority: 10
        }
      }
    }
  };

  
  /**
 * Check whether hand is royal flush 
 *
 * @method isRoyalFlush
 * @param  {Object}       cardSet  request json object
 * @return {bool}              true/false
 */
  function isRoyalFlush(cardSet) {
    if(isSameSuit(cardSet)) {
      var sortedPriority = _.sortBy(cardSet, 'priority');
            return isSameSuit(cardSet) && (sortedPriority[0].priority === 10) && (sortedPriority[1].priority === 11) && (sortedPriority[2].priority === 12) && (sortedPriority[3].priority === 13) && (sortedPriority[4].priority === 14);
    } else {
      return false;
    }
  }

  
  /**
 *  Check whether hand is of same suit 
 *
 * @method isSameSuit
 * @param  {Object}       cardSet  request json object
 * @return {bool}              true/false
 */
  function isSameSuit(cardSet) {
    var suit;
    var sameCards = _.countBy(cardSet, function(num) {
      suit = num.type;
      return num.type;
    });
    return (cardSet.length === sameCards[suit]);
  }

  
   /**
 *   Check whether hand is of straight flush 
 *
 * @method isStraightFlush
 * @param  {Object}       cardSet  request json object
 * @return {bool}              true/false
 */
  function isStraightFlush(cardSet) {
    if(isSameSuit(cardSet)) {
      var sortedPriority = _.sortBy(cardSet, 'priority');
      var sortedRank = _.sortBy(cardSet, 'rank');
      var checkingPriority = (sortedPriority[0].priority + 1 === sortedPriority[1].priority) && (sortedPriority[1].priority + 1 === sortedPriority[2].priority) && (sortedPriority[2].priority + 1 === sortedPriority[3].priority) && (sortedPriority[3].priority + 1 === sortedPriority[4].priority);
      var checkingRank = (sortedRank[0].rank + 1 === sortedRank[1].rank) && (sortedRank[1].rank + 1 === sortedRank[2].rank) && (sortedRank[2].rank + 1 === sortedRank[3].rank) && (sortedRank[3].rank + 1 === sortedRank[4].rank);
      return checkingPriority || checkingRank;
    } else {
      return false;
    }
  }

  
    /**
 * Check whether hand is of fourof a kind
 *
 * @method isStraightFlush
 * @param  {Object}       cardSet  request json object
 * @return {bool}              true/false
 */
  function isFourOfAKind(cardSet) {
    var firstCardCount = _.where(cardSet, {rank : cardSet[0].rank});
    var secondCardCount = _.where(cardSet, {rank : cardSet[1].rank});
    return (firstCardCount.length === 4 || secondCardCount.length === 4);
  }

  
     /**
 * Check whether hand is of fullHouse
 *
 * @method fullHouse
 * @param  {Object}       cardSet  request json object
 * @return {bool}              true/false
 */
  function isFullHouse(cardSet) {
    var sortedRank = _.sortBy(cardSet, 'rank').reverse();
    var firstCardCount = _.where(sortedRank, {rank : sortedRank[0].rank});
    var remainingTwoCards;
    if(firstCardCount.length === 3) {
      remainingTwoCards = _.where(sortedRank, {rank : sortedRank[3].rank});
      if(remainingTwoCards.length === 2) {
        return true;
      } else {
        return false;
      }
    } else if(firstCardCount.length === 2){
      var remainingThreeCards =  _.where(sortedRank, {rank : sortedRank[2].rank});
      if(remainingThreeCards.length === 3) {
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
    // return false;
  }

  
      /**
 * Check whether hand is of flush
 *
 * @method isFlush
 * @param  {Object}       cardSet  request json object
 * @return {bool}              true/false
 */
  function isFlush(cardSet) {
    if(isSameSuit(cardSet)) {
      return true;
    } else {
      return false;
    }
  }

  
      /**
 * Check whether hand is of straight
 *
 * @method isStraight
 * @param  {Object}       cardSet  request json object
 * @return {bool}              true/false
 */
  function isStraight(cardSet) {
    var sortedPriority = _.sortBy(cardSet, 'priority');
    var sortedRank = _.sortBy(cardSet, 'rank');
    var checkingPriority = (sortedPriority[0].priority + 1 === sortedPriority[1].priority) && (sortedPriority[1].priority + 1 === sortedPriority[2].priority) && (sortedPriority[2].priority + 1 === sortedPriority[3].priority) && (sortedPriority[3].priority + 1 === sortedPriority[4].priority);
    var checkingRank = (sortedRank[0].rank + 1 === sortedRank[1].rank) && (sortedRank[1].rank + 1 === sortedRank[2].rank) && (sortedRank[2].rank + 1 === sortedRank[3].rank) && (sortedRank[3].rank + 1 === sortedRank[4].rank);
    return checkingPriority || checkingRank;
  }

  
       /**
 *  Check whether hand is of threeOfAKind
 *
 * @method isThreeOfAKind
 * @param  {Object}       cardSet  request json object
 * @return {bool}              true/false
 */
  function isThreeOfAKind(cardSet) {
    var firstCardCount = _.where(cardSet, {rank : cardSet[0].rank});
    var secondCardCount = _.where(cardSet, {rank : cardSet[1].rank});
    var thirdCardCount = _.where(cardSet, {rank : cardSet[2].rank});
    return firstCardCount.length === 3 || secondCardCount.length === 3 || thirdCardCount.length === 3;
  }

  

       /**
 * Check whether hand is of isTwoPair
 *
 * @method isTwoPair
 * @param  {Object}       cardSet  request json object
 * @return {bool}              true/false
 */
  function isTwoPair(cardSet) {
    var sortedRank = _.sortBy(cardSet, 'rank');
    var count = 0;
    for(var i=0; i<sortedRank.length -1; i++) {
      if(sortedRank[i].rank === sortedRank[i+1].rank) {
        count ++;
      }
    }
    if(count === 2) {
      return true;
    } else {
      return false;
    }
  }

  
        /**
 * Check whether hand is of onePair
 *
 * @method isOnePair
 * @param  {Object}       cardSet  request json object
 * @return {bool}              true/false
 */
  function isOnePair(cardSet) {
    var sortedRank = _.sortBy(cardSet, 'rank');
    for(var i=0; i<sortedRank.length-1; i++) {
      if(sortedRank[i].rank === sortedRank[i+1].rank) {
        return true;
      }
    }
    return false;
  }

  
         /**
 * this function is used to set the type of hands
 *
 * @method isOnePair
 * @param  {Object}       cardSet  request json object
 * @return {bool}              true/false
 */
  function getSetType (cardSet) {
    if (isRoyalFlush(cardSet)) {
      return _options.wininingPriority.setType.royalflush;
    }
    if (isStraightFlush(cardSet)) {
      return _options.wininingPriority.setType.straightflush;
    }
    if (isFourOfAKind(cardSet)) {
      return _options.wininingPriority.setType.fourofakind;
    }
    if (isFullHouse(cardSet)) {
      return _options.wininingPriority.setType.fullhouse;
    }
    if (isFlush(cardSet)) {
      return _options.wininingPriority.setType.flush;
    }
    if (isStraight(cardSet)) {
      return _options.wininingPriority.setType.straight;
    }
    if (isThreeOfAKind(cardSet)) {
      return _options.wininingPriority.setType.threeofakind;
    }
    if (isTwoPair(cardSet)) {
      return _options.wininingPriority.setType.twopair;
    }
    if (isOnePair(cardSet)) {
      return _options.wininingPriority.setType.onepair;
    }
    return _options.wininingPriority.setType.highcard;
  }

 
          /**
 *  This function is used to compare hands if hands priority are same
 *
 * @method getGreatestFromType
 * @param  {Object}       type,sets,setProp  request json object
 * @return {bool}              true/false
 */
  function getGreatestFromType(type, sets, setProp) {
    var setProp = setProp || 'set';
    switch (type) {
      case 'Royal Flush'     : return compareRoyalflush(sets, setProp);
      case 'Straight Flush'  : return compareStraightFlush(sets, setProp);
      case 'Four Of A Kind'  : return compareFourOfAKind(sets, setProp);
      case 'Full House'      : return compareFullHouse(sets, setProp);
      case 'Flush'           : return compareFlush(sets, setProp);
      case 'Straight'        : return compareStraight(sets, setProp);
      case 'Three Of A Kind' : return compareThreeOfAKind(sets, setProp);
      case 'Two Pairs'       : return compareTwoPair(sets, setProp);
      case 'One Pair'        : return compareOnePair(sets, setProp);
      case 'High Card'       : return compareHighcard(sets, setProp);
      default                : console.log('No case handle for this form!'); break;
    }
    return sets[0];
  }

  
 /**
 * This function is used to find the greatest from the hands 
 *
 * @method getGreatest
 * @param  {Object}       type,sets,setProp  request json object
 * @return {bool}              true/false
 */
  this.getGreatest = function(sets, setProp) {
      // console.log("sets in getGreatest is ----",JSON.stringify(sets));
      var arrNew = [],
        sorted,
        setProp = setProp || 'set',
        maxP = -1;
      var len = sets.length;
      for (var count = 0;count < len; count++) {
        var setType = getSetType(sets[count][setProp]);
        // console.log("calculated setType is --- ",setType);
        sets[count].type=setType.type;
        sets[count].typeName=setType.displayName;
        arrNew.push({
          type: setType.type,
          typeName: setType.displayName,
          priority: getSetType(sets[count][setProp]).priority,
          set: sets[count]
        });
      }
      // console.log("arrNew is   ",JSON.stringify(arrNew));
      sorted = _.sortBy(arrNew, 'priority').reverse();
      // console.log("sortedSet is in getGreatest ",JSON.stringify(sorted));
      maxP = sorted[0].priority;
      var typeLeft = _.where(sorted, {
          priority: maxP
      });
      if (typeLeft.length > 1) {
        return getGreatestFromType(typeLeft[0].type, _.map(typeLeft, function(a) {
            return a.set;
        }));
      }
      var tempArray = [];
      tempArray.push(sorted[0].set);
      return tempArray;
  };

  
           /**
 * Compare hand with in royalFlush
 *
 * @method getGreatestFromType
 * @param  {Object}       type,sets,setProp  request json object
 * @return {bool}              true/false
 */
  function compareRoyalflush(sets, setProp) {
    return sets;
  }

  
  /**
 *  Compare hand with in staraightFlush
 *
 * @method compareStraightFlush
 * @param  {Object}       sets,setProp  request json object
 * @return {bool}              true/false
 */
  function compareStraightFlush(sets, setProp) {
    var winnerSets = [];
    var sortedSet = [];
    for(var i=0; i<sets.length;i++) {
      var setObj = {};
      var temp = _.sortBy(sets[i].set,'priority').reverse();
      setObj.set = temp;
      setObj.playerId = sets[i].playerId;
      setObj.type = sets[i].type;
      setObj.typeName = sets[i].typeName;
      sortedSet.push(setObj);
    }
    for(var i=0; i<sortedSet.length; i++) {
      if(sortedSet[i].set[0].priority === 14 && sortedSet[i].set[1].priority === 5 && sortedSet[i].set[2].priority === 4 && sortedSet[i].set[3].priority === 3 && sortedSet[i].set[4].priority === 2) {
        var obj = {
          "type":sortedSet[i].set[0].type,
          "rank":sortedSet[i].set[0].rank,
          "name":sortedSet[i].set[0].name,
          "priority":1 // Ace priority should always be 14 - sushiljainam - October 2017
        };
        sortedSet[i].set.shift();
        sortedSet[i].set.push(obj);
        // sortedSet[i].set[0].priority = 1000;
        sortedSet[i].set = _.sortBy(sortedSet[i].set, 'priority').reverse();
      } else {
      }
    }
    var highSet = sortedSet[0];
    for(var i=1; i<sortedSet.length; i++) {
      if(highSet.set[0].priority < sortedSet[i].set[0].priority) {
        highSet = sortedSet[i];
      }
    }
    for(var i=0; i<sortedSet.length; i++) {
      if(highSet.set[0].priority === sortedSet[i].set[0].priority) {
        winnerSets.push(sortedSet[i]);
      }
    }
    return winnerSets;
  }

  
/**
 * Compare hand with in FourOfAKind
 *
 * @method compareFourOfAKind
 * @param  {Object}       type,sets,setProp  request json object
 * @return {bool}              true/false
 */
  function compareFourOfAKind(sets, setProp) {
    var sortedSet = [];
    var winnerSets = [];
    var tempWinner = [];
    for(var i=0; i<sets.length;i++) {
      var setObj = {};
      var temp = _.sortBy(sets[i].set,'priority').reverse();
      setObj.set = temp;
      setObj.playerId = sets[i].playerId;
      setObj.type = sets[i].type;
      setObj.typeName = sets[i].typeName;
      sortedSet.push(setObj);
    }
    var maxFourofakind = 0;
    for(var i=0; i<sortedSet.length;i++) {
      // var temp = sortedSet[i].set[0].priority === sortedSet[i].set[1].priority ? sortedSet[i].set[0].priority : sortedSet[i].set[4].priority;
      if(maxFourofakind < sortedSet[i].set[2].priority){
        maxFourofakind = sortedSet[i].set[2].priority;
      }
    }
    for(var i=0; i<sortedSet.length;i++) {
      // var temp = sortedSet[i].set[0].priority === sortedSet[i].set[1].priority ? sortedSet[i].set[0].priority : sortedSet[i].set[1].priority;
      if(maxFourofakind === sortedSet[i].set[2].priority){
        tempWinner.push(sortedSet[i]);
      }
    }
    if(tempWinner.length > 1) {
      var maxFifthCard=0;
      for(var i=0; i<tempWinner.length;i++) {
        var temp = tempWinner[i].set[0].priority === tempWinner[i].set[1].priority ? tempWinner[i].set[4].priority : tempWinner[i].set[0].priority;
        if(maxFifthCard < temp){
          maxFifthCard = temp;
        }
      }
      for(var i=0; i<tempWinner.length;i++) {
        var temp = tempWinner[i].set[0].priority === tempWinner[i].set[1].priority ? tempWinner[i].set[4].priority : tempWinner[i].set[0].priority;
        if(maxFifthCard === temp){
          winnerSets.push(tempWinner[i]);
        }
      }
      return winnerSets;
    } else {
      return tempWinner;
    }
  }

  
  /**
 * Compare hand with in compareFullHouse
 *
 * @method compareFullHouse
 * @param  {Object}       type,sets,setProp  request json object
 * @return {bool}              true/false
 */
  function compareFullHouse(sets, setProp) {
    var sortedSet = [],winnerSets = [],tempWinnerSets = [];
    var count3=0, count2=0,max2 = 0,max3 = 0;
    for(var i=0; i<sets.length;i++) {
      var setObj = {};
      var temp = _.sortBy(sets[i].set,'priority').reverse();
      setObj.set = temp;
      setObj.playerId = sets[i].playerId;
      setObj.type = sets[i].type;
      setObj.typeName = sets[i].typeName;
      sortedSet.push(setObj);
    }
    // if(sortedSet[0].set[0].priority === sortedSet[0].set[1].priority && sortedSet[0].set[1].priority === sortedSet[0].set[2].priority) {
    //   max3 = sortedSet[0].set[0].priority;
    // } else {
    //   max3 = sortedSet[0].set[4].priority;
    // }
    var tempMax2,tempMax3;
    for(var i=0;i<sortedSet.length;i++) {
      if(sortedSet[i].set[0].priority === sortedSet[i].set[1].priority && sortedSet[i].set[1].priority === sortedSet[i].set[2].priority) {
      tempMax3 = sortedSet[i].set[0].priority;
    } else {
      tempMax3 = sortedSet[i].set[4].priority;
    }
      if(tempMax3 > max3) {
        max3 = tempMax3;
      }
    }
    for(var i=0; i<sortedSet.length;i++) {
      if(sortedSet[i].set[0].priority === sortedSet[i].set[1].priority && sortedSet[i].set[1].priority === sortedSet[i].set[2].priority) {
        tempMax3 = sortedSet[i].set[0].priority;
      } else {
        tempMax3 = sortedSet[i].set[4].priority;
      }
      if(tempMax3 === max3) {
        tempWinnerSets.push(sortedSet[i]);
      }
    }
    if(tempWinnerSets.length > 1) {
      // if(tempWinnerSets[0].set[0].priority === tempWinnerSets[0].set[1].priority && tempWinnerSets[0].set[1].priority === tempWinnerSets[0].set[2].priority) {
      //   max2 = tempWinnerSets[0].set[4].priority;
      // } else {
      //   max2 = tempWinnerSets[0].set[0].priority;
      // }
      for(var i=0;i<tempWinnerSets.length;i++) {
        if(tempWinnerSets[i].set[0].priority === tempWinnerSets[i].set[1].priority && tempWinnerSets[i].set[1].priority === tempWinnerSets[i].set[2].priority) {
        tempMax2 = tempWinnerSets[i].set[4].priority;
      } else {
        tempMax2 = tempWinnerSets[i].set[0].priority;
      }
        if(tempMax2 > max2) {
          max2 = tempMax2;
        }
      }
      for(var i=0; i<tempWinnerSets.length;i++) {
        if(tempWinnerSets[i].set[0].priority === tempWinnerSets[i].set[1].priority && tempWinnerSets[i].set[1].priority === tempWinnerSets[i].set[2].priority) {
          tempMax2 = tempWinnerSets[i].set[4].priority;
        } else {
          tempMax2 = tempWinnerSets[i].set[0].priority;
        }
        if(tempMax2 === max2) {
          winnerSets.push(tempWinnerSets[i]);
        }
      }
    } else {
      winnerSets = tempWinnerSets;
    }
    return winnerSets;
  }

  
  /**
 * Compare hand with in compareFlush
 *
 * @method compareFlush
 * @param  {Object}       type,sets,setProp  request json object
 * @return {bool}              true/false
 */
  function compareFlush(sets, setProp) {
    var sortedSet = [],winnerSets = [],tempWinnerSets = [];
    for(var i=0; i<sets.length;i++) {
      var setObj = {};
      var temp = _.sortBy(sets[i].set,'priority').reverse();
      setObj.set = temp;
      setObj.playerId = sets[i].playerId;
      setObj.type = sets[i].type;
      setObj.typeName = sets[i].typeName;
      sortedSet.push(setObj);
    }
    var max1 = sortedSet[0].set[0].priority;
    // console.log("max1 is in compareFlush - " + max1);
    for(var i=0; i<sortedSet.length;i++) {
      if(max1 < sortedSet[i].set[0].priority) {
        max1 = sortedSet[i].set[0].priority;
      }
    }
    for(var i=0; i<sortedSet.length;i++) {
      if(max1 === sortedSet[i].set[0].priority) {
        tempWinnerSets.push(sortedSet[i]);
      }
    }
    // console.log("tempWinnerSets after first comparision - " + JSON.stringify(tempWinnerSets));
    winnerSets = tempWinnerSets;
    tempWinnerSets = [];
    if(winnerSets.length > 1) {
      var max2 = winnerSets[0].set[1].priority;
      // console.log("max2 is in compareFlush - " + max2);
      for(var i=0; i<winnerSets.length;i++) {
        if(max2 < winnerSets[i].set[1].priority) {
          max2 = winnerSets[i].set[1].priority;
        }
      }
      for(var i=0; i<winnerSets.length;i++) {
        if(max2 === winnerSets[i].set[1].priority) {
          tempWinnerSets.push(winnerSets[i]);
        }
      }
      // console.log("WinnerSets after 2nd comparision - " + JSON.stringify(winnerSets));
      winnerSets = tempWinnerSets;
      tempWinnerSets = [];
      if(winnerSets.length > 1) {
        var max3 = winnerSets[0].set[2].priority;
        // console.log("max3 is in compareFlush - " + max3);
        for(var i=0; i<winnerSets.length;i++) {
          if(max3 < winnerSets[i].set[2].priority) {
            max3 = winnerSets[i].set[2].priority;
          }
        }
        for(var i=0; i<winnerSets.length;i++) {
          if(max3 === winnerSets[i].set[2].priority) {
            tempWinnerSets.push(winnerSets[i]);
          }
        }
        // console.log("tempWinnerSets after 3rd comparision - " + JSON.stringify(tempWinnerSets));
        winnerSets = tempWinnerSets;
        tempWinnerSets = [];
        if(winnerSets.length > 1) {
          var max4 = winnerSets[0].set[3].priority;
          // console.log("max4 is in compareFlush - " + max4);
          for(var i=0; i<winnerSets.length;i++) {
            if(max4 < winnerSets[i].set[3].priority) {
              max4 = winnerSets[i].set[3].priority;
            }
          }
          for(var i=0; i<winnerSets.length;i++) {
            if(max4 === winnerSets[i].set[3].priority) {
              tempWinnerSets.push(winnerSets[i]);
            }
          }
          // console.log("tempWinnerSets after 4th comparision - " + JSON.stringify(tempWinnerSets));
          winnerSets = tempWinnerSets;
          tempWinnerSets = [];
          if(winnerSets.length > 1) {
            var max5 = winnerSets[0].set[4].priority;
            // console.log("max5 is in compareFlush - " + max5);
            for(var i=0; i<winnerSets.length;i++) {
              if(max5 < winnerSets[i].set[4].priority) {
                max5 = winnerSets[i].set[4].priority;
              }
            }
            for(var i=0; i<winnerSets.length;i++) {
              if(max5 === winnerSets[i].set[4].priority) {
                tempWinnerSets.push(winnerSets[i]);
              }
            }
            // console.log("tempWinnerSets after 5th comparision - " + JSON.stringify(tempWinnerSets));
            winnerSets = tempWinnerSets;
            tempWinnerSets = [];
            return winnerSets;
          } else {
            return winnerSets;
          }
        } else {
          return winnerSets;
        }
      } else {
        return winnerSets;
      }
    } else {
      return winnerSets;
    }
    return winnerSets;
  }

  
/**
 * Compare hand with in compareStraight
 *
 * @method compareStraight
 * @param  {Object}       type,sets,setProp  request json object
 * @return {bool}              true/false
 */
  function compareStraight(sets, setProp) {
    var sortedSet = [],winnerSets = [],tempWinnerSets = [];
    for(var i=0; i<sets.length;i++) {
      var setObj = {};
      var temp = _.sortBy(sets[i].set,'priority').reverse();
      setObj.set = temp;
      setObj.playerId = sets[i].playerId;
      setObj.type = sets[i].type;
      setObj.typeName = sets[i].typeName;
      sortedSet.push(setObj);
    }
    for(var i=0; i<sortedSet.length; i++) {
      if(sortedSet[i].set[0].priority === 14 && sortedSet[i].set[1].priority === 5 && sortedSet[i].set[2].priority === 4 && sortedSet[i].set[3].priority === 3 && sortedSet[i].set[4].priority === 2) {
        var obj = {
          "type":sortedSet[i].set[0].type,
          "rank":sortedSet[i].set[0].rank,
          "name":sortedSet[i].set[0].name,
          "priority":1 // Ace priority should always be 14 - sushiljainam - October 2017
        };
        sortedSet[i].set.shift();
        sortedSet[i].set.push(obj);
        // sortedSet[i].set[0].priority = 1000;
        sortedSet[i].set = _.sortBy(sortedSet[i].set, 'priority').reverse();
      } else {
      }
    }
    var max1 = 0, max2 = 0, max3 = 0, max4 = 0, max5 = 0;
    for(var i=0; i<sortedSet.length;i++) {
      if(max1 < sortedSet[i].set[0].priority) {
        max1 = sortedSet[i].set[0].priority;
      }
      // if(max2 < sortedSet[i].set[1].priority) {
      //   max2 = sortedSet[i].set[1].priority;
      // }
      // if(max3 < sortedSet[i].set[2].priority) {
      //   max3 = sortedSet[i].set[2].priority;
      // }
      // if(max4 < sortedSet[i].set[3].priority) {
      //   max4 = sortedSet[i].set[3].priority;
      // }
      // if(max5 < sortedSet[i].set[4].priority) {
      //   max5 = sortedSet[i].set[4].priority;
      // }
    }
    for(var i=0; i<sortedSet.length;i++) {
      if(max1 === sortedSet[i].set[0].priority) {
        tempWinnerSets.push(sortedSet[i]);
      }
    }
    winnerSets = tempWinnerSets;
    tempWinnerSets = [];
    if(winnerSets.length > 1) {
      var max2 = winnerSets[0].set[1].priority;
      for(var i=0; i<winnerSets.length;i++) {
        if(max2 < winnerSets[i].set[1].priority) {
          max2 = winnerSets[i].set[1].priority;
        }
      }
      for(var i=0; i<winnerSets.length;i++) {
        if(max2 === winnerSets[i].set[1].priority) {
          tempWinnerSets.push(winnerSets[i]);
        }
      }
      winnerSets = tempWinnerSets;
      tempWinnerSets = [];
      if(winnerSets.length > 1) {
        var max3 = winnerSets[0].set[2].priority;
        for(var i=0; i<winnerSets.length;i++) {
          if(max3 < winnerSets[i].set[2].priority) {
            max3 = winnerSets[i].set[2].priority;
          }
        }
        for(var i=0; i<winnerSets.length;i++) {
          if(max3 === winnerSets[i].set[2].priority) {
            tempWinnerSets.push(winnerSets[i]);
          }
        }
        winnerSets = tempWinnerSets;
        tempWinnerSets = [];
        if(winnerSets.length > 1) {
          var max4 = winnerSets[0].set[3].priority;
          for(var i=0; i<winnerSets.length;i++) {
            if(max4 < winnerSets[i].set[3].priority) {
              max4 = winnerSets[i].set[3].priority;
            }
          }
          for(var i=0; i<winnerSets.length;i++) {
            if(max4 === winnerSets[i].set[3].priority) {
              tempWinnerSets.push(winnerSets[i])
            }
          }
          winnerSets = tempWinnerSets;
          tempWinnerSets = [];
          if(winnerSets.length > 1) {
            var max5 = winnerSets[0].set[4].priority;
            for(var i=0; i<winnerSets.length;i++) {
              if(max5 < winnerSets[i].set[4].priority) {
                max5 = winnerSets[i].set[4].priority;
              }
            }
            for(var i=0; i<winnerSets.length;i++) {
              if(max5 === winnerSets[i].set[4].priority) {
                tempWinnerSets.push(winnerSets[i]);
              }
            }
            winnerSets = tempWinnerSets;
            tempWinnerSets = [];
            return winnerSets;
          } else {
            return winnerSets;
          }
        } else {
          return winnerSets;
        }
      } else {
        return winnerSets;
      }
    } else {
      return winnerSets;
    }
    return winnerSets;
  }

 
  /**
 * Compare hand with in compareThreeOfAKind
 *
 * @method compareThreeOfAKind
 * @param  {Object}       type,sets,setProp  request json object
 * @return {bool}              true/false
 */
  function compareThreeOfAKind(sets, setProp) {
    var sortedSet = [],winnerSets = [],tempWinnerSets = [];
    var count3=0, count2=0,max1=0,max2=0,max3=0;
    for(var i=0; i<sets.length;i++) {
      var setObj = {};
      var temp = _.sortBy(sets[i].set,'priority').reverse();
      setObj.set = temp;
      setObj.playerId = sets[i].playerId;
      setObj.type = sets[i].type;
      setObj.typeName = sets[i].typeName;
      sortedSet.push(setObj);
    }
    // if(sortedSet[0].set[0].priority === sortedSet[0].set[1].priority && sortedSet[0].set[1].priority === sortedSet[0].set[2].priority) {
    //   max3 = sortedSet[0].set[0].priority;
    // } else if(sortedSet[0].set[1].priority === sortedSet[0].set[2].priority && sortedSet[0].set[2].priority === sortedSet[0].set[3].priority){
    //   max3 = sortedSet[0].set[1].priority;
    // } else {
    //   max3 = sortedSet[0].set[3].priority;
    // }
    var tempMax2,tempMax3,tempMax1;
    for(var i=0;i<sortedSet.length;i++) {
      if(sortedSet[i].set[0].priority === sortedSet[i].set[1].priority && sortedSet[i].set[1].priority === sortedSet[i].set[2].priority) {
        if(max3 < sortedSet[i].set[0].priority) {
          max3 = sortedSet[i].set[0].priority;
        }
      } else if(sortedSet[i].set[1].priority === sortedSet[i].set[2].priority && sortedSet[i].set[2].priority === sortedSet[i].set[3].priority){
        if(max3 < sortedSet[i].set[1].priority) {
          max3 = sortedSet[i].set[1].priority;
        }
      } else {
        if(max3 < sortedSet[i].set[3].priority) {
          max3 = sortedSet[i].set[3].priority;
        }
      }
    }
    for(var i=0; i<sortedSet.length;i++) {
      if(sortedSet[i].set[0].priority === sortedSet[i].set[1].priority && sortedSet[i].set[1].priority === sortedSet[i].set[2].priority) {
        tempMax3 = sortedSet[i].set[0].priority;
      } else if(sortedSet[i].set[1].priority === sortedSet[i].set[2].priority && sortedSet[i].set[2].priority === sortedSet[i].set[3].priority)  {
        tempMax3 = sortedSet[i].set[2].priority;
      } else {
        tempMax3 = sortedSet[i].set[3].priority;
      }
      if(tempMax3 === max3) {
        tempWinnerSets.push(sortedSet[i]);
      }
    }
    if(tempWinnerSets.length > 1) {
      // if(tempWinnerSets[0].set[0].priority === tempWinnerSets[0].set[1].priority && tempWinnerSets[0].set[1].priority === tempWinnerSets[0].set[2].priority) {
      //   max2 = tempWinnerSets[0].set[3].priority;
      // } else {
      //   max2 = tempWinnerSets[0].set[0].priority;
      // }
      for(var i=0;i<tempWinnerSets.length;i++) {
        if(tempWinnerSets[i].set[0].priority === tempWinnerSets[i].set[1].priority && tempWinnerSets[i].set[1].priority === tempWinnerSets[i].set[2].priority) {
          if(max2 < tempWinnerSets[i].set[3].priority) {
            max2 = tempWinnerSets[i].set[3].priority;
          }
        } else {
          if(max2 < tempWinnerSets[i].set[0].priority) {
            max2 = tempWinnerSets[i].set[0].priority;
          }
        }
      }
      for(var i=0; i<tempWinnerSets.length;i++) {
        if(tempWinnerSets[i].set[0].priority === tempWinnerSets[i].set[1].priority && tempWinnerSets[i].set[1].priority === tempWinnerSets[i].set[2].priority) {
          tempMax2 = tempWinnerSets[i].set[3].priority;
        } else {
          tempMax2 = tempWinnerSets[i].set[0].priority;
        }
        if(tempMax2 === max2) {
          winnerSets.push(tempWinnerSets[i]);
        }
      }
      tempWinnerSets = [];
      if(winnerSets.length > 1) {
        // if(winnerSets[0].set[0].priority === winnerSets[0].set[1].priority && winnerSets[0].set[1].priority === winnerSets[0].set[2].priority) {
        //   max1 = winnerSets[0].set[4].priority;
        // } else if(winnerSets[0].set[1].priority === winnerSets[0].set[2].priority && winnerSets[0].set[2].priority === winnerSets[0].set[3].priority) {
        //   max1 = winnerSets[0].set[4].priority;
        // } else {
        //   max1 = winnerSets[0].set[1].priority;
        // }
        for(var i=0;i<winnerSets.length;i++) {
          if(winnerSets[i].set[0].priority === winnerSets[i].set[1].priority && winnerSets[i].set[1].priority === winnerSets[i].set[2].priority) {
            if(max1 < winnerSets[i].set[4].priority) {
              max1 = winnerSets[i].set[4].priority;
            }
          } else if(winnerSets[i].set[1].priority === winnerSets[i].set[2].priority && winnerSets[i].set[2].priority === winnerSets[i].set[3].priority) {
            if(max1 < winnerSets[i].set[4].priority) {
              max1 = winnerSets[i].set[4].priority;
            }
          } else {
            if(max1 < winnerSets[i].set[1].priority) {
              max1 = winnerSets[i].set[1].priority;
            }
          }
        }
        for(var i=0; i<winnerSets.length;i++) {
          if(winnerSets[i].set[0].priority === winnerSets[i].set[1].priority && winnerSets[i].set[1].priority === winnerSets[i].set[2].priority) {
            tempMax1 = winnerSets[i].set[4].priority;
          } else if(winnerSets[i].set[1].priority === winnerSets[i].set[2].priority && winnerSets[i].set[2].priority === winnerSets[i].set[3].priority) {
            tempMax1 = winnerSets[i].set[4].priority;
          } else {
            tempMax1 = winnerSets[i].set[1].priority;
          }
          if(tempMax1 === max1) {
            tempWinnerSets.push(winnerSets[i]);
          }
        }
        return tempWinnerSets;
      }
      return winnerSets;
    } else {
      return tempWinnerSets;
    }
  }

  
/**
 * Compare hand with in compareTwoPair
 *
 * @method compareTwoPair
 * @param  {Object}       type,sets,setProp  request json object
 * @return {bool}              true/false
 */
  function compareTwoPair(sets, setProp) {
    var sortedSet = [],winnerSets = [],tempWinnerSets = [];
    var maxPair1=0,maxPair2=0,maxFifthCard=0;
    var tempMaxPair1, tempMaxPair2;
    for(var i=0; i<sets.length;i++) {
      var setObj = {};
      var temp = _.sortBy(sets[i].set,'priority').reverse();
      setObj.set = temp;
      setObj.playerId = sets[i].playerId;
      setObj.type = sets[i].type;
      setObj.typeName = sets[i].typeName;
      sortedSet.push(setObj);
    }
    for(var i=0;i<sortedSet.length;i++) {
      for(var j=0;j<4;j++) {
        if(sortedSet[i].set[j].priority === sortedSet[i].set[j+1].priority) {
          if(maxPair1 < sortedSet[i].set[j].priority) {
            maxPair1 = sortedSet[i].set[j].priority;
          }
          break;
        }
      }
    }
    for(var i=0; i<sortedSet.length; i++) {
      for(var j=0;j<4;j++) {
        if(sortedSet[i].set[j].priority === sortedSet[i].set[j+1].priority) {
          tempMaxPair1 = sortedSet[i].set[j].priority;
          break;
        }
      }
      if(tempMaxPair1 === maxPair1) {
        tempWinnerSets.push(sortedSet[i]);
      }
    }
    if(tempWinnerSets.length > 1) {
      // for(var i=0; i<tempWinnerSets.length; i++) {
      //   if(tempWinnerSets[i].set[2].priority === maxPair2) {
      //     winnerSets.push(sortedSet[i]);
      //   }
      // }
      for(var i=0;i<tempWinnerSets.length;i++) {
        for(var j=4;j>0;j--) {
          if(tempWinnerSets[i].set[j].priority === tempWinnerSets[i].set[j-1].priority) {
            if(maxPair2 < tempWinnerSets[i].set[j].priority) {
              maxPair2 = tempWinnerSets[i].set[j].priority;
            }
            break;
          }
        }
      }
      for(var i=0; i<tempWinnerSets.length; i++) {
        for(var j=4;j>0;j--) {
          if(tempWinnerSets[i].set[j].priority === tempWinnerSets[i].set[j-1].priority) {
            tempMaxPair2 = tempWinnerSets[i].set[j].priority;
            break;
          }
        }
        if(tempMaxPair2 === maxPair2) {
          winnerSets.push(tempWinnerSets[i]);
        }
      }
      if(winnerSets.length > 1) {
        tempWinnerSets = [];
        for(var i=0;i<winnerSets.length;i++) {
          var xorFifthCard = 0;
          for(var j=0;j<5;j++) {
            xorFifthCard = xorFifthCard ^ winnerSets[i].set[j].priority;
          }
          if(maxFifthCard < xorFifthCard) {
            maxFifthCard = xorFifthCard;
          }
        }
        for(var i=0; i<winnerSets.length; i++) {
          var tempMaxFifthCard = 0;
          for(var j=0;j<5;j++) {
            tempMaxFifthCard = tempMaxFifthCard ^ winnerSets[i].set[j].priority;
          }
          if(tempMaxFifthCard === maxFifthCard) {
            tempWinnerSets.push(winnerSets[i]);
          }
        }
        return tempWinnerSets;
      } else {
        return winnerSets;
      }
    } else {
      return tempWinnerSets;
    }
  }

  
/**
 *  Compare hand with in compareOnePair
 *
 * @method compareOnePair
 * @param  {Object}       type,sets,setProp  request json object
 * @return {bool}              true/false
 */
  function compareOnePair(sets, setProp) {
    var sortedSet = [],winnerSets = [],tempWinnerSets = [];
    var maxPair1=0,maxInOtherCard1=0,maxInOtherCard2=0,maxInOtherCard3=0;
    for(var i=0; i<sets.length;i++) {
      var setObj = {};
      var temp = _.sortBy(sets[i].set,'priority').reverse();
      setObj.set = temp;
      setObj.playerId = sets[i].playerId;
      setObj.type = sets[i].type;
      setObj.typeName = sets[i].typeName;
      sortedSet.push(setObj);
    }
    // if(sortedSet[0].set[0].priority === sortedSet[0].set[1].priority) {
    //   maxPair1 = sortedSet[0].set[0].priority;
    // } else if(sortedSet[0].set[1].priority === sortedSet[0].set[2].priority) {
    //   maxPair1 = sortedSet[0].set[1].priority;
    // } else if(sortedSet[0].set[2].priority === sortedSet[0].set[3].priority) {
    //   maxPair1 = sortedSet[0].set[2].priority;
    // } else if(sortedSet[0].set[3].priority === sortedSet[0].set[4].priority) {
    //   maxPair1 = sortedSet[0].set[3].priority;
    // }
    for(var i=0; i<sortedSet.length;i++) {
      if(sortedSet[i].set[0].priority === sortedSet[i].set[1].priority) {
        if(sortedSet[i].set[0].priority > maxPair1) {
          maxPair1 = sortedSet[i].set[0].priority;
        }
      } else if(sortedSet[i].set[1].priority === sortedSet[i].set[2].priority) {
        if(sortedSet[i].set[1].priority > maxPair1) {
          maxPair1 = sortedSet[i].set[1].priority;
        }
      } else if(sortedSet[i].set[2].priority === sortedSet[i].set[3].priority) {
        if(sortedSet[i].set[2].priority > maxPair1) {
          maxPair1 = sortedSet[i].set[2].priority;
        }
      } else if(sortedSet[i].set[3].priority === sortedSet[i].set[4].priority) {
        if(sortedSet[i].set[3].priority > maxPair1) {
          maxPair1 = sortedSet[i].set[3].priority;
        }
      }
    }
    for(var i=0; i<sortedSet.length;i++) {
      if(sortedSet[i].set[0].priority === sortedSet[i].set[1].priority) {
        if(maxPair1 === sortedSet[i].set[0].priority){
          tempWinnerSets.push(sortedSet[i]);
        }
      }else if(sortedSet[i].set[1].priority === sortedSet[i].set[2].priority) {
        if(maxPair1 === sortedSet[i].set[1].priority){
          tempWinnerSets.push(sortedSet[i]);
        }
      } else if(sortedSet[i].set[2].priority === sortedSet[i].set[3].priority) {
        if(maxPair1 === sortedSet[i].set[2].priority){
          tempWinnerSets.push(sortedSet[i]);
        }
      } else if(sortedSet[i].set[3].priority === sortedSet[i].set[4].priority) {
        if(maxPair1 === sortedSet[i].set[3].priority){
          tempWinnerSets.push(sortedSet[i]);
        }
      }
    }
    if(tempWinnerSets.length > 1) {
      // if(tempWinnerSets[0].set[0].priority === tempWinnerSets[0].set[1].priority) {
      //   maxInOtherCard1 = tempWinnerSets[0].set[2].priority;
      // } else if(tempWinnerSets[0].set[1].priority === tempWinnerSets[0].set[2].priority) {
      //   maxInOtherCard1 = tempWinnerSets[0].set[0].priority;
      // } else if(tempWinnerSets[0].set[2].priority === tempWinnerSets[0].set[3].priority) {
      //   maxInOtherCard1 = tempWinnerSets[0].set[0].priority;
      // } else if(tempWinnerSets[0].set[3].priority === tempWinnerSets[0].set[4].priority) {
      //   maxInOtherCard1 = tempWinnerSets[0].set[0].priority;
      // }
      for(var i=0; i<tempWinnerSets.length;i++) {
        if(tempWinnerSets[i].set[0].priority === tempWinnerSets[i].set[1].priority) {
          if(tempWinnerSets[i].set[2].priority > maxInOtherCard1) {
            maxInOtherCard1 = tempWinnerSets[i].set[2].priority;
          }
        } else if(tempWinnerSets[i].set[1].priority === tempWinnerSets[i].set[2].priority) {
          if(tempWinnerSets[i].set[0].priority > maxInOtherCard1) {
            maxInOtherCard1 = tempWinnerSets[i].set[0].priority;
          }
        } else if(tempWinnerSets[i].set[2].priority === tempWinnerSets[i].set[3].priority) {
          if(tempWinnerSets[i].set[0].priority > maxInOtherCard1) {
            maxInOtherCard1 = tempWinnerSets[i].set[0].priority;
          }
        } else if(tempWinnerSets[i].set[3].priority === tempWinnerSets[i].set[4].priority) {
            if(tempWinnerSets[i].set[0].priority > maxInOtherCard1) {
              maxInOtherCard1 = tempWinnerSets[i].set[0].priority;
            }
          }
        }
      for(var i=0; i<tempWinnerSets.length;i++) {
        if(tempWinnerSets[i].set[0].priority === tempWinnerSets[i].set[1].priority) {
          if(maxInOtherCard1 === tempWinnerSets[i].set[2].priority){
            winnerSets.push(tempWinnerSets[i]);
          }
        }else if(tempWinnerSets[i].set[1].priority === tempWinnerSets[i].set[2].priority) {
          if(maxInOtherCard1 === tempWinnerSets[i].set[0].priority){
            winnerSets.push(tempWinnerSets[i]);
          }
        } else if(tempWinnerSets[i].set[2].priority === tempWinnerSets[i].set[3].priority) {
          if(maxInOtherCard1 === tempWinnerSets[i].set[0].priority){
            winnerSets.push(tempWinnerSets[i]);
          }
        } else if(tempWinnerSets[i].set[3].priority === tempWinnerSets[i].set[4].priority) {
          if(maxInOtherCard1 === tempWinnerSets[i].set[0].priority){
            winnerSets.push(tempWinnerSets[i]);
          }
        }
      }
      if(winnerSets.length > 1) {
        tempWinnerSets = [];
        // if(winnerSets[0].set[0].priority === winnerSets[0].set[1].priority) {
        //   maxInOtherCard2 = winnerSets[0].set[3].priority;
        // } else if(winnerSets[0].set[1].priority === winnerSets[0].set[2].priority) {
        //   maxInOtherCard2 = winnerSets[0].set[3].priority;
        // } else if(winnerSets[0].set[2].priority === winnerSets[0].set[3].priority) {
        //   maxInOtherCard2 = winnerSets[0].set[1].priority;
        // } else if(winnerSets[0].set[3].priority === winnerSets[0].set[4].priority) {
        //   maxInOtherCard2 = winnerSets[0].set[1].priority;
        // }
        for(var i=0; i<winnerSets.length;i++) {
          if(winnerSets[i].set[0].priority === winnerSets[i].set[1].priority) {
            if(winnerSets[i].set[3].priority > maxInOtherCard2) {
              maxInOtherCard2 = winnerSets[i].set[3].priority;
            }
          } else if(winnerSets[i].set[1].priority === winnerSets[i].set[2].priority) {
            if(winnerSets[i].set[3].priority > maxInOtherCard2) {
              maxInOtherCard2 = winnerSets[i].set[3].priority;
            }
          } else if(winnerSets[i].set[2].priority === winnerSets[i].set[3].priority) {
            if(winnerSets[i].set[1].priority > maxInOtherCard2) {
              maxInOtherCard2 = winnerSets[i].set[1].priority;
            }
          } else if(winnerSets[i].set[3].priority === winnerSets[i].set[4].priority) {
            if(winnerSets[i].set[1].priority > maxInOtherCard2) {
              maxInOtherCard2 = winnerSets[i].set[1].priority;
            }
          }
        }
        for(var i=0; i<winnerSets.length;i++) {
          if(winnerSets[i].set[0].priority === winnerSets[i].set[1].priority) {
            if(maxInOtherCard2 === winnerSets[i].set[3].priority){
              tempWinnerSets.push(winnerSets[i]);
            }
          }else if(winnerSets[i].set[1].priority === winnerSets[i].set[2].priority) {
            if(maxInOtherCard2 === winnerSets[i].set[3].priority){
              tempWinnerSets.push(winnerSets[i]);
            }
          } else if(winnerSets[i].set[2].priority === winnerSets[i].set[3].priority) {
            if(maxInOtherCard2 === winnerSets[i].set[1].priority){
              tempWinnerSets.push(winnerSets[i]);
            }
          } else if(winnerSets[i].set[3].priority === winnerSets[i].set[4].priority) {
            if(maxInOtherCard2 === winnerSets[i].set[1].priority){
              tempWinnerSets.push(winnerSets[i]);
            }
          }
        }
        if(tempWinnerSets.length > 1) {
          winnerSets = [];
          // if(tempWinnerSets[0].set[0].priority === tempWinnerSets[0].set[1].priority) {
          //   maxInOtherCard3 = tempWinnerSets[0].set[4].priority;
          // } else if(tempWinnerSets[0].set[1].priority === tempWinnerSets[0].set[2].priority) {
          //   maxInOtherCard3 = tempWinnerSets[0].set[4].priority;
          // } else if(tempWinnerSets[0].set[2].priority === tempWinnerSets[0].set[3].priority) {
          //   maxInOtherCard3 = tempWinnerSets[0].set[4].priority;
          // } else if(tempWinnerSets[0].set[3].priority === tempWinnerSets[0].set[4].priority) {
          //   maxInOtherCard3 = tempWinnerSets[0].set[2].priority;
          // }
          for(var i=0; i<tempWinnerSets.length;i++) {
            if(tempWinnerSets[i].set[0].priority === tempWinnerSets[i].set[1].priority) {
              if(tempWinnerSets[i].set[4].priority > maxInOtherCard3) {
                maxInOtherCard3 = tempWinnerSets[i].set[4].priority;
              }
            } else if(tempWinnerSets[i].set[1].priority === tempWinnerSets[i].set[2].priority) {
              if(tempWinnerSets[i].set[4].priority > maxInOtherCard3) {
                maxInOtherCard3 = tempWinnerSets[i].set[4].priority;
              }
            } else if(tempWinnerSets[i].set[2].priority === tempWinnerSets[i].set[3].priority) {
              if(tempWinnerSets[i].set[4].priority > maxInOtherCard3) {
                maxInOtherCard3 = tempWinnerSets[i].set[4].priority;
              }
            } else if(tempWinnerSets[i].set[3].priority === tempWinnerSets[i].set[4].priority) {
              if(tempWinnerSets[i].set[2].priority > maxInOtherCard3) {
                maxInOtherCard3 = tempWinnerSets[i].set[2].priority;
              }
            }
          }
          for(var i=0; i<tempWinnerSets.length;i++) {
            if(tempWinnerSets[i].set[0].priority === tempWinnerSets[i].set[1].priority) {
              if(maxInOtherCard3 === tempWinnerSets[i].set[4].priority){
                winnerSets.push(tempWinnerSets[i]);
              }
            }else if(tempWinnerSets[i].set[1].priority === tempWinnerSets[i].set[2].priority) {
              if(maxInOtherCard3 === tempWinnerSets[i].set[4].priority){
                winnerSets.push(tempWinnerSets[i]);
              }
            } else if(tempWinnerSets[i].set[2].priority === tempWinnerSets[i].set[3].priority) {
              if(maxInOtherCard3 === tempWinnerSets[i].set[4].priority){
                winnerSets.push(tempWinnerSets[i]);
              }
            } else if(tempWinnerSets[i].set[3].priority === tempWinnerSets[i].set[4].priority) {
              if(maxInOtherCard3 === tempWinnerSets[i].set[2].priority){
                winnerSets.push(tempWinnerSets[i]);
              }
            }
          }
          return winnerSets;
        } else {
          return tempWinnerSets;
        }
      } else {
        return winnerSets;
      }
    } else {
      return tempWinnerSets;
    }
  }

  
  /**
 * Compare hand with in high cards
 *
 * @method compareHighcard
 * @param  {Object}       type,sets,setProp  request json object
 * @return {bool}              true/false
 */
  function compareHighcard(sets, setProp) {
    // console.log("in compare high card"); 
    return compareFlush(sets, setProp);
  }

  
  /**
 * This function is used to find the greatest from the hands of omaha lo if their priority are same
 *
 * @method getGreatestOmahaLo
 * @param  {Object}       type,sets,setProp  request json object
 * @return {bool}              true/false
 */
  this.getGreatestOmahaLo = function(sets, setProp) {
    var validSets = [];
    for(var i=0;i<sets.length;i++) {
      if(!isRankHighThan8(sets[i].set) && !isOnePair(sets[i].set)) {
        validSets.push(sets[i])
      }
    }
    if(validSets.length > 0) {
     var bestLo =  compareHighCardInOmahaLo(validSets);
     return bestLo[0];
    } else {
      return null;
    }
  }

  //### this function finds the winner in omahaLo
  this.findWinnerOmahaLo = function(sets) {
    return compareHighCardInOmahaLo(sets);
  }

  //### function to check any cards rank are not greator than 8
  function isRankHighThan8(sets) {
    var tempSets = _.filter(sets, function(set) {
      return (set.rank > 8)
    });
    return tempSets.length > 0 ? true:false;
  }

  //### function to comapre and find best hands in omaha hi lo
  function compareHighCardInOmahaLo(sets) {
    var sortedSet = [],winnerSets = [],tempWinnerSets = [];
    for(var i=0; i<sets.length;i++) {
      var setObj = {};
      var temp = _.sortBy(sets[i].set,'rank').reverse();
      setObj.set = temp;
      setObj.playerId = sets[i].playerId;
      sortedSet.push(setObj);
    }
    var max1 = sortedSet[0].set[0].rank;
    for(var i=0; i<sortedSet.length;i++) {
      if(max1 > sortedSet[i].set[0].rank) {
        max1 = sortedSet[i].set[0].rank;
      }
    }
    for(var i=0; i<sortedSet.length;i++) {
      if(max1 === sortedSet[i].set[0].rank) {
        tempWinnerSets.push(sortedSet[i])
      }
    }
    winnerSets = tempWinnerSets;
    tempWinnerSets = [];
    if(winnerSets.length > 1) {
      var max2 = winnerSets[0].set[1].rank;
      for(var i=0; i<winnerSets.length;i++) {
        if(max2 > winnerSets[i].set[1].rank) {
          max2 = winnerSets[i].set[1].rank;
        }
      }
      for(var i=0; i<winnerSets.length;i++) {
        if(max2 === winnerSets[i].set[1].rank) {
          tempWinnerSets.push(winnerSets[i])
        }
      }
      winnerSets = tempWinnerSets;
      tempWinnerSets = [];
      if(winnerSets.length > 1) {
        var max3 = winnerSets[0].set[2].rank;
        for(var i=0; i<winnerSets.length;i++) {
          if(max3 > winnerSets[i].set[2].rank) {
            max3 = winnerSets[i].set[2].rank;
          }
        }
        for(var i=0; i<winnerSets.length;i++) {
          if(max3 === winnerSets[i].set[2].rank) {
            tempWinnerSets.push(winnerSets[i])
          }
        }
        winnerSets = tempWinnerSets;
        tempWinnerSets = [];
        if(winnerSets.length > 1) {
          var max4 = winnerSets[0].set[3].rank;
          for(var i=0; i<winnerSets.length;i++) {
            if(max4 > winnerSets[i].set[3].rank) {
              max4 = winnerSets[i].set[3].rank;
            }
          }
          for(var i=0; i<winnerSets.length;i++) {
            if(max4 === winnerSets[i].set[3].rank) {
              tempWinnerSets.push(winnerSets[i])
            }
          }
          winnerSets = tempWinnerSets;
          tempWinnerSets = [];
          if(winnerSets.length > 1) {
            var max5 = winnerSets[0].set[4].rank;
            for(var i=0; i<winnerSets.length;i++) {
              if(max5 > winnerSets[i].set[4].rank) {
                max5 = winnerSets[i].set[4].rank;
              }
            }
            for(var i=0; i<winnerSets.length;i++) {
              if(max5 === winnerSets[i].set[4].rank) {
                tempWinnerSets.push(winnerSets[i])
              }
            }
            winnerSets = tempWinnerSets;
            tempWinnerSets = [];
            return winnerSets;
          } else {
            return winnerSets;
          }
        } else {
          return winnerSets;
        }
      } else {
        return winnerSets;
      }
    } else {
      return winnerSets;
    }
    return winnerSets;
  }
}


module.exports = new CardComparer();
