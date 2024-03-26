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
        "threeofakind": {
          type: 'Three Of A Kind',
          displayName: 'Three Of A Kind',
          priority: 4
        }
      }
    }
  };

  //### Check whether hand is of threeOfAKind
  function isThreeOfAKind(cardSet) {
    console.log("in isThreeOfAKind" + cardSet[0].rank === cardSet[1].rank) && (cardSet[1].rank === cardSet[2].rank);
    return (cardSet[0].rank === cardSet[1].rank) && (cardSet[1].rank === cardSet[2].rank);
  }

  //### Check whether hand is of onePair
  function isOnePair(cardSet) {
    var sortedRank = _.sortBy(cardSet, 'rank');
    return (sortedRank[0].rank === sortedRank[1].rank) || (sortedRank[0].rank === sortedRank[2].rank) || (sortedRank[1].rank === sortedRank[2].rank);
  }

  // ### function is used set the type of hands
  function getSetType (cardSet) {
    if (isThreeOfAKind(cardSet)) {
      return _options.wininingPriority.setType.threeofakind;
    }
    if (isOnePair(cardSet)) {
      return _options.wininingPriority.setType.onepair;
    }
    return _options.wininingPriority.setType.highcard;
  }

  //### This function is used to compare hands if hands priority are same
  function getGreatestFromType(type, sets, setProp) {
    var setProp = setProp || 'set';
    switch (type) {
      case 'threeofakind'   : return compareThreeOfAKind(sets, setProp);
      case 'onepair'        : return compareOnePair(sets, setProp);
      case 'highcard'       : return compareHighcard(sets, setProp);
      default               : console.log('No case handle for this form!'); break;
    }
    return sets[0];
  }

  //### This function is used to find the greatest from the hands if their priority are same
  this.getGreatest = function(sets, setProp) {
      var arrNew = [],
        sorted,
        setProp = setProp || 'set',
        maxP = -1;
      var len = sets.length;
      for (var count = 0;count < len; count++) {
        var setType = getSetType(sets[count][setProp]);
        sets[count].type=setType.type;
        sets[count].typeName=setType.displayName;
        arrNew.push({
          type: setType.type,
          typeName: setType.displayName,
          priority: getSetType(sets[count][setProp]).priority,
          set: sets[count]
        });
      }
      sorted = _.sortBy(arrNew, 'priority').reverse();
      maxP = sorted[0].priority;
      typeLeft = _.where(sorted, {
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

  //### Compare hand with in compareThreeOfAKind
  function compareThreeOfAKind(sets, setProp) {
    var sortedSet = [],winnerSets = [],tempWinnerSets = [];
    var max1,max2,max3;
    for(var i=0; i<sets.length;i++) {
      var setObj = {};
      var temp = _.sortBy(sets[i].set,'priority').reverse();
      setObj.set = temp;
      setObj.playerId = sets[i].playerId;
      setObj.type = sets[i].type;
      setObj.typeName = sets[i].typeName;
      sortedSet.push(setObj);
    }
    max1 = sortedSet[0].set[0].priority;
    max3 = sortedSet[0].set[2].priority;
    //getting the first highest card
    for(var i=0;i<sortedSet.length;i++) {
      if(sortedSet[i].set[0].priority > max1) {
        max1 = sortedSet[i].set[0].priority;
      }
    }
    for(var i=0; i<sortedSet.length;i++) {
      if(sortedSet[i].set[0].priority === max1) {
        tempWinnerSets.push(sortedSet[i]);
      }
    }

    // console.log("temp winner sets after first comparision are ",JSON.stringify(tempWinnerSets));
    if(tempWinnerSets.length > 1) {
      //getting second highest cards
      max2 = tempWinnerSets[0].set[1].priority;
      for(var i=0;i<tempWinnerSets.length;i++) {
        if(tempWinnerSets[i].set[1].priority > max2) {
          max2 = tempWinnerSets[i].set[1].priority;
        }
      }
      // console.log("max2 is in compareThreeOfAKind - " + max2);
      for(var i=0;i<tempWinnerSets.length;i++) {
        if(tempWinnerSets[i].set[1].priority === max2) {
          winnerSets.push(sortedSet[i]);
        }
      }
      // console.log("winner sets after 2nd comaprison ",JSON.stringify(winnerSets));
      if(winnerSets.length > 1) {
        tempWinnerSets = [];
        max3 = winnerSets[0].set[2].priority;
        for(var i=0;i<winnerSets.length;i++) {
          if(winnerSets[i].set[2].priority > max2) {
            max3 = winnerSets[i].set[2].priority;
          }
        }
        for(var i=0;i<winnerSets.length;i++) {
          if(winnerSets[i].set[2].priority === max3) {
            tempWinnerSets.push(sortedSet[i]);
          }
        }
        // console.log("final winner is ----",JSON.stringify(tempWinnerSets));
        return tempWinnerSets;
      }
      return winnerSets;
    } else {
      return tempWinnerSets;
    }
  }

  //### Compare hand with in compareOnePair
  function compareOnePair(sets, setProp) {
    var sortedSet = [],winnerSets = [],tempWinnerSets = [],sum,tempMaxPair;
    var maxPair,maxInOtherCard;
    for(var i=0; i<sets.length;i++) {
      var setObj = {};
      var temp = _.sortBy(sets[i].set,'priority').reverse();
      setObj.set = temp;
      setObj.playerId = sets[i].playerId;
      setObj.type = sets[i].type;
      setObj.typeName = sets[i].typeName;
      sortedSet.push(setObj);
    }
    // console.log("-----After sorting cards are-----" + JSON.stringify(sortedSet));
    sum = sortedSet[0].set[0].priority + sortedSet[0].set[1].priority + sortedSet[0].set[2].priority;
    maxPair = (sum - (sortedSet[0].set[0].priority ^ sortedSet[0].set[1].priority ^ sortedSet[0].set[2].priority))/2;
    // console.log("max in maxPair before compare " + maxPair);
    // finding the value of max Pair
    for(var i=0; i<sortedSet.length;i++) {
      sum = sortedSet[i].set[0].priority + sortedSet[i].set[1].priority + sortedSet[i].set[2].priority;
      tempMaxPair = (sum - (sortedSet[i].set[0].priority ^ sortedSet[i].set[1].priority ^ sortedSet[i].set[2].priority))/2;
      if(tempMaxPair > maxPair) {
        maxPair = tempMaxPair;
      }
    }
    // console.log("max in maxPair after comapre ",maxPair);
    // decision based on maxpair i.e reject those players who are not maxpair cards
    for(var i=0; i<sortedSet.length;i++) {
      sum = sortedSet[i].set[0].priority + sortedSet[i].set[1].priority + sortedSet[i].set[2].priority;
      tempMaxPair = (sum - (sortedSet[i].set[0].priority ^ sortedSet[i].set[1].priority ^ sortedSet[i].set[2].priority))/2;
      if(maxPair === tempMaxPair){
        tempWinnerSets.push(sortedSet[i]);
      }
    }
    //If some more players left then compare according to maxInOtherCard
    if(tempWinnerSets.length > 1) {
      // console.log("tempWinnerSets are " + JSON.stringify(tempWinnerSets),tempWinnerSets.length);
      maxInOtherCard = tempWinnerSets[0].set[0].priority ^ tempWinnerSets[0].set[1].priority ^ tempWinnerSets[0].set[2].priority;
      // console.log("max in maxInOtherCard before comapre ",maxInOtherCard);
      // finding max in other cards
      for(var i=0; i<tempWinnerSets.length;i++) {
        tempMaxInOtherCard = tempWinnerSets[i].set[0].priority ^ tempWinnerSets[i].set[1].priority ^ tempWinnerSets[i].set[2].priority;
        if(tempMaxInOtherCard > maxInOtherCard) {
          maxInOtherCard = tempMaxInOtherCard;
        }
      }
      // console.log("max in maxInOtherCard after comapre ",maxInOtherCard);
      for(var i=0; i<tempWinnerSets.length;i++) {
        tempMaxInOtherCard = tempWinnerSets[0].set[0].priority ^ tempWinnerSets[0].set[1].priority ^ tempWinnerSets[0].set[2].priority;
        if(maxInOtherCard === tempMaxInOtherCard){
          winnerSets.push(tempWinnerSets[i]);
        }
      }
      return winnerSets;
    } else {
      return tempWinnerSets;
    }
  }

  //### Compare hand with in compareOnePair
  function compareHighcard(sets, setProp) {
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
    // console.log("sortedSet in compare flush" + JSON.stringify(sortedSet));
    var max1 = sortedSet[0].set[0].priority;
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
        return tempWinnerSets;
      } else {
        return winnerSets;
      }
    } else {
      return winnerSets;
    }
  }
}

module.exports = new CardComparer();
