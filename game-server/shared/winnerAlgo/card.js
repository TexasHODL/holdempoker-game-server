/*jshint node: true */
"use strict";


// type -> Spade, Heart, Diamond, Club
// rank -> 1,2,3,4,5,6,7,8,9,10,11,12,13
function Card(type, rank) {
  // console.log("type and rank is ",type,rank);
  this.type = type;
  this.rank = rank;
  this.name = this.getName(rank);
  this.priority = this.getPriority(rank);
  // console.log("priority is--------",this.priority);
 }
 Card.prototype.getName = function() {
     switch (this.rank) {
         case 1:
             return "A";
         case 11:
             return "J";
         case 12:
             return "Q";
         case 13:
             return "K";
         default:
             return this.rank.toString();
     }
 };

 Card.prototype.getPriority = function() {
     switch (this.rank) {
         case 1:
             return 14;
         default:
             return this.rank;
     }
 };

 module.exports = Card;


// input -> new Card('spade', 1)

// {
//     type : "spade",
//     rank : 1,
//     name : "A",
//     priority : 14
// }
//Structure of input
/*{
  id: 'p1',
  set: [{
    type : "spade",
    rank : 13,
    name : "K",
    priority : 13
  },
  {
    type : "spade",
    rank : 1,
    name : "A",
    priority : 14
  },
  {
    type : "spade",
    rank : 12,
    name : "Q",
    priority : 12
  },
  {
    type : "diamond",
    rank : 12,
    name : "Q",
    priority : 12
  },
  {
    type : "diamond",
    rank : 12,
    name : "Q",
    priority : 12
  }]
}*/
