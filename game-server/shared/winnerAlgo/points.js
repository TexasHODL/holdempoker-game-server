/*jshint node: true */
"use strict";

var points = {};
points.royality = {};
points.royality.bottomHand = {
  "Straight"        : 2,
  "Flush"           : 4,
  "Full House"      : 6,
  "Four Of A Kind"  : 10,
  "Straight Flush"  : 15,
  "Royal Flush"     : 25
};

points.royality.middleHand = {
  "Three Of A Kind"  : 2,
  "Straight"         : 4,
  "Flush"            : 8,
  "Full House"       : 12,
  "Four Of A Kind"   : 20,
  "Straight Flush"   : 30,
  "Royal Flush"      : 50
};

points.royality.topHand = {
  "66"    : 1,
  "77"    : 2,
  "88"    : 3,
  "99"    : 4,
  "1010"  : 5,
  "JJ"    : 6,
  "QQ"    : 7,
  "KK"    : 8,
  "AA"    : 9,
  "222"   : 10,
  "333"   : 11,
  "444"   : 12,
  "555"   : 13,
  "666"   : 14,
  "777"   : 15,
  "888"   : 16,
  "999"   : 17,
  "101010": 18,
  "JJJ"   : 19,
  "QQQ"   : 20,
  "KKK"   : 21,
  "AAA"   : 22
};

points.handsPriority = {
  "High Card"       : 1,
  "One Pair"        : 2,
  "Two Pairs"       : 3,
  "Three Of A Kind" : 4,
  "Straight"        : 5,
  "Flush"           : 6,
  "Full House"      : 7,
  "Four Of A Kind"  : 8,
  "Straight Flush"  : 9,
  "Royal Flush"     : 10
};

points.fantasyLandCards = {
  "7"  : 14,
  "8"  : 15,
  "9"  : 16,
  "10" : 17,
  "11" : 17,
  "12" : 17,
  "13" : 17,
  "14" : 17,
  "15" : 17,
  "16" : 17,
  "17" : 17,
  "18" : 17,
  "19" : 17,
  "20" : 17,
  "21" : 17,
  "22" : 17
};




points.foulPoints = 6;
points.surrenderPoints = 3;

module.exports = points;
