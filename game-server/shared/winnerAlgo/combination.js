/*jshint node: true */
"use strict";


// ### this function is used to find combination of cards 
// set is set of cards and k is combination size
var combination = function(set, k) {
	//console.log(JSON.stringify(set));
	var i, j, combs, head, tailcombs;
  if (k > set.length || k <= 0) {
      return [];
  }
  if (k === set.length) {
      return [set];
  }
  if (k === 1) {
      combs = [];
      for (i = 0; i < set.length; i++) {
          combs.push([set[i]]);
      }
      return combs;
  }
  
  
  combs = [];
 // console.log("sets are ------",set);
  for (i = 0; i < set.length - k + 1; i++) {
      head = set.slice(i, i + 1);
      tailcombs = combination(set.slice(i + 1), k - 1);
      for (j = 0; j < tailcombs.length; j++) {
          combs.push(head.concat(tailcombs[j]));
      }
  }
  //console.log("return combs are ----------",combs)
  return combs;
};
module.exports = combination;