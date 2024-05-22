/*jshint node: true */
"use strict";


var winnerRanking = {},
	_ 							= require("underscore"),
	cardConfig      = require("./cardConfiguration");


/**
 * this function finds the difference in two arrays
 * @method differenceTwoArray
 * @param  {array}           array1 
 * @param  {array}           array2 
 * @return {array}                  difference in array1 & array2
 */
var differenceTwoArray = function(array1, array2) {
	console.log("\narray1 - " + JSON.stringify(array1));
	console.log("\narray2 - " + JSON.stringify(array2));
	var newArray = Array.from(array1); 
	for(var i=0; i<newArray.length; i++) {
		for(var j=0; j<array2.length; j++) {
			if(newArray[i].playerId === array2[j].playerId) {
				newArray.splice(i,1);
				i--;
				break;
			}
		}
	}
	return newArray;
};


/**
 * this function calculates ranks in royalFlush
 * @method rankInRoyalFlush
 * @param  {array}         winnerArray 
 * @param  {array}         winnerRank  
 * @return {object}                     
 */
var rankInRoyalFlush = function(winnerArray, winnerRank) {
	for(var i=0; i<winnerArray.length; i++) {
		winnerArray[i].winnerRank = winnerRank;
	}
	return {players : winnerArray, winnerRank : ++winnerRank};
};

/**
 * this function calculates ranks in straighFlush
 * @method rankInStraightFlush
 * @param  {array}         winnerArray 
 * @param  {array}         winnerRank  
 * @return {object}                     
 */
var rankInStraightFlush = function(winnerArray, winnerRank) {
	var sortedWinnerArray = [];
	for(var i=0; i<winnerArray.length;i++) {
    var temp = _.sortBy(winnerArray[i].set,'priority').reverse();
   if(temp[0].priority === 14 && temp[1].priority === 5 && temp[2].priority === 4 && temp[3].priority === 3 && temp[4].priority === 2) {
   	temp[0].priority = 1; // Ace priority should always be 14 - sushiljainam - October 2017
   	temp = _.sortBy(winnerArray[i].set,'priority').reverse();
   }
    sortedWinnerArray.push({
    	"playerId" : winnerArray[i].playerId,
			"set"			 : temp,
			"priority" : winnerArray[i].priority,
			"type"     : winnerArray[i].type
    });
  }

  return rankInFlush(sortedWinnerArray,winnerRank);
  // console.log("sortedWinnerArray ----- ",JSON.stringify(sortedWinnerArray));
  // winnerArray.length = 0;
  // var originalArray = Array.from(sortedWinnerArray);
  // while(sortedWinnerArray.length>0) {
  // 	var highSet = sortedWinnerArray[0];
  //   for(var i=1; i<sortedWinnerArray.length; i++) {
  //     if(highSet.set[0].priority < sortedWinnerArray[i].set[0].priority) {
  //       highSet = sortedWinnerArray[i];
  //     }
  //   }
  // 	console.log('highSet is - ' + JSON.stringify(highSet));
  //   for(var i=0; i<sortedWinnerArray.length; i++) {
  //     if(highSet.set[0].priority === sortedWinnerArray[i].set[0].priority) {
  //     	sortedWinnerArray[i].winnerRank = winnerRank;
  //       winnerArray.push(sortedWinnerArray[i]);
  //       sortedWinnerArray = differenceTwoArray(originalArray,winnerArray);
  //       // sortedWinnerArray.shift();
  //       // i--;
  //     }
  //   }
  //   winnerRank++;
  // }
  // return {players: winnerArray, winnerRank: winnerRank};
};

/**
 * this function calculates rank in four of a kind
 * @method rankInFourOfAKind
 * @param  {array}          winnerArray 
 * @param  {array}          winnerRank  
 * @return {object}                      
 */
var rankInFourOfAKind = function(winnerArray,winnerRank) {
	var winnerRankArray = [], tempWinners = [], originalArray = Array.from(winnerArray);
	for(var i=0; i<winnerArray.length;i++) {
    winnerArray[i].set = _.sortBy(winnerArray[i].set,'priority').reverse();
  }
  while(winnerArray.length > 0) {
  	var maxFourofakind = 0;
  	tempWinners.length = 0;
    for(var i=0; i<winnerArray.length;i++) {
      var temp = winnerArray[i].set[0].priority === winnerArray[i].set[1].priority ? winnerArray[i].set[0].priority : winnerArray[i].set[4].priority;
      if(maxFourofakind < temp){
        maxFourofakind = temp;
      }
    }
    console.log("\nwinners after getting maxFourofakind - " + JSON.stringify(winnerArray));
    for(var i=0; i<winnerArray.length;i++) {
      temp = winnerArray[i].set[0].priority === winnerArray[i].set[1].priority ? winnerArray[i].set[0].priority : winnerArray[i].set[1].priority;
      console.log("\ntemp in comparing " + temp);
      if(maxFourofakind === temp){
       tempWinners.push(winnerArray[i]);
      }
    }
    console.log("\ntempWinners after comparing four of a kind card - " + JSON.stringify(tempWinners));
    if(tempWinners.length > 1) {
      var maxFifthCard=0;
      for(var i=0; i<tempWinners.length;i++) {
        var temp = tempWinners[i].set[0].priority === tempWinners[i].set[1].priority ? tempWinners[i].set[4].priority : tempWinners[i].set[0].priority;
        if(maxFifthCard < temp){
          maxFifthCard = temp;
        }
      }
      console.log("\nmax maxFifthCard is - " + maxFifthCard);
      winnerArray.length = 0;
      for(var i=0; i<tempWinners.length;i++) {
        var temp = tempWinners[i].set[0].priority === tempWinners[i].set[1].priority ? tempWinners[i].set[4].priority : tempWinners[i].set[0].priority;
        if(maxFifthCard === temp){
        	winnerArray.push(tempWinners[i]);
        }
      }

      if(winnerArray.length > 1) {
      	for(var i=0; i<winnerArray.length; i++) {
      		winnerArray[i].winnerRank = winnerRank;
    			winnerRankArray.push(winnerArray[i]);		
      	}
      } else {
      	winnerArray[0].winnerRank = winnerRank;
    		winnerRankArray.push(winnerArray[0]);
      }
      winnerRank ++;
      winnerArray = differenceTwoArray(originalArray,winnerRankArray);
      console.log("\nwinners after comparing fifth card - " + JSON.stringify(winnerArray));
      console.log("\nwinnerRankArray after comparing fifth card - " + JSON.stringify(winnerRankArray));
    } else {
    	tempWinners[0].winnerRank = winnerRank++;
    	winnerRankArray.push(tempWinners[0]);
    	winnerArray = differenceTwoArray(originalArray,winnerRankArray);
    	console.log("\nwinner array after getting single winner in rankInFourOfAKind - " + JSON.stringify(winnerArray));
    }
  }
  console.log("\nwinnerRankArray in rankInFourOfAKind is - " + JSON.stringify(winnerRankArray));
  return {players: winnerRankArray, winnerRank: winnerRank};
};

/**
 * this function calculates rank in full house
 * @method rankInFullHouse
 * @param  {array}        winnerArray 
 * @param  {array}        winnerRank  
 * @return {object}                   
 */
var rankInFullHouse = function(winnerArray, winnerRank) {
	var winnerRankArray = [], tempWinners = [],originalArray = Array.from(winnerArray);
	for(var i=0; i<winnerArray.length;i++) {
    winnerArray[i].set = _.sortBy(winnerArray[i].set,'priority').reverse();
  }
  console.log("winnerArray is in rankInFullHouse - " + JSON.stringify(winnerArray));
  while(winnerArray.length > 0) {
  	var max3=0,tempMax3;
  	tempWinners.length = 0; 
  	for(var i=0;i<winnerArray.length;i++) {
  		tempMax3 = winnerArray[i].set[0].priority ^ winnerArray[i].set[1].priority ^ winnerArray[i].set[2].priority ^ winnerArray[i].set[3].priority ^ winnerArray[i].set[4].priority;
  		if(tempMax3 > max3) {
  			max3 = tempMax3;
  		}
  	}
  	console.log("\nmax3 is in rankInFullHouse is - " + max3);
  	for(var i=0;i<winnerArray.length;i++) {
  		tempMax3 = winnerArray[i].set[0].priority ^ winnerArray[i].set[1].priority ^ winnerArray[i].set[2].priority ^ winnerArray[i].set[3].priority ^ winnerArray[i].set[4].priority;
  		if(tempMax3 == max3) {
  			tempWinners.push(winnerArray[i]);
  		}
  	}
  	console.log("tempWinners after calculating tempMax3 - " + JSON.stringify(tempWinners));
  	if(tempWinners.length > 0) {
			var tempMax2 = 0, max2 = 0;
			for(var i=0; i<tempWinners.length; i++) {
				tempMax2 = (tempWinners[i].set[0].priority == tempWinners[i].set[2].priority) ? tempWinners[i].set[3].priority : tempWinners[i].set[0].priority;
				if(tempMax2>max2) {
					max2 = tempMax2;
				}
			}
			console.log("max2 is - " + max2); 
			winnerArray.length = 0;
			for(var i=0; i<tempWinners.length; i++) {
				tempMax2 = (tempWinners[i].set[0].priority == tempWinners[i].set[2].priority) ? tempWinners[i].set[3].priority : tempWinners[i].set[0].priority;
				if(tempMax2 == max2) {
					winnerArray.push(tempWinners[i]);
				}
			}
			console.log("\ntempWinners after calculating tempMax2 - " + JSON.stringify(winnerArray));
			if(winnerArray.length>1) {
				for(i=0; i<winnerArray.length; i++) {
					winnerArray[i].winnerRank = winnerRank;
					winnerRankArray.push(winnerArray[i]);
				}
				winnerRank++;
			} else {
				winnerArray[0].winnerRank = winnerRank++;
				winnerRankArray.push(winnerArray[0]);
			}
			console.log("\n originalArray - " + JSON.stringify(originalArray));
			console.log("\n winnerRankArray - " + JSON.stringify(winnerRankArray));
			winnerArray = differenceTwoArray(originalArray,winnerRankArray);
			console.log("\nwinner array after final calculation - " + JSON.stringify(winnerArray));
  	} else {
    	tempWinners[0].winnerRank = winnerRank++;
    	winnerRankArray.push(tempWinners[0]);
    	winnerArray = differenceTwoArray(originalArray,winnerRankArray);
			console.log("\nwinner array after final calculation in single case - " + JSON.stringify(winnerArray));
  	}
  }
  return {players: winnerRankArray, winnerRank: winnerRank};
};

/**
 * this function calculates rank in flush
 * @method rankInFlush
 * @param  {array}    winnerArray 
 * @param  {array}    winnerRank  
 * @return {object}               
 */
var rankInFlush = function(winnerArray, winnerRank) {
	var winnerRankArray = [], tempWinners = [],originalArray = Array.from(winnerArray);
	for(var i=0; i<winnerArray.length;i++) {
    winnerArray[i].set = _.sortBy(winnerArray[i].set,'priority').reverse();
  }
  console.log("\nwinnerArray after sorting is  - " + JSON.stringify(winnerArray));
  while(winnerArray.length > 0) {
  	var max1=0;
  	tempWinners.length=0;
		for(var i=0; i<winnerArray.length; i++) {
			if(max1<winnerArray[i].set[0].priority) {
				max1 = winnerArray[i].set[0].priority;
			}
		}
		console.log("\n max1 is -- " + max1);
		for(var i=0; i<winnerArray.length; i++) {
			if(max1 == winnerArray[i].set[0].priority) {
				tempWinners.push(winnerArray[i]);
			}
		}
		winnerArray.length=0;
		console.log("\ntempWinners after first comparision - " + JSON.stringify(tempWinners));
		if(tempWinners.length > 1) {
			var max2=0;
			for(var i=0; i<tempWinners.length; i++) {
				if(max2<tempWinners[i].set[1].priority) {
					max2 = tempWinners[i].set[1].priority;
				}
			}
			for(var i=0; i<tempWinners.length; i++) {
				if(max2 == tempWinners[i].set[1].priority) {
					winnerArray.push(tempWinners[i]);
				}
			}
			tempWinners.length=0;
			console.log("\n winnerArray after second comparision - " + JSON.stringify(winnerArray));
			if(winnerArray.length > 1) {
				var max3=0;
				for(var i=0; i<winnerArray.length; i++) {
					if(max3<winnerArray[i].set[2].priority) {
						max3 = winnerArray[i].set[2].priority;
					}
				}
				for(var i=0; i<winnerArray.length; i++) {
					if(max3 == winnerArray[i].set[2].priority) {
						tempWinners.push(winnerArray[i]);
					}
				}
				winnerArray.length=0;
				if(tempWinners.length > 1) {
					var max4=0;
					for(var i=0; i<tempWinners.length; i++) {
						if(max4<tempWinners[i].set[3].priority) {
							max4 = tempWinners[i].set[3].priority;
						}
					}
					for(var i=0; i<tempWinners.length; i++) {
						if(max4 == tempWinners[i].set[3].priority) {
							winnerArray.push(tempWinners[i]);
						}
					}
					tempWinners.length=0;
					console.log("\nwinnerArray length is -- " + JSON.stringify(winnerArray));
					if(winnerArray.length > 1) {
						var max5=0;
						for(var i=0; i<winnerArray.length; i++) {
							if(max5<winnerArray[i].set[4].priority) {
								max5 = winnerArray[i].set[4].priority;
							}
						}
						for(var i=0; i<winnerArray.length; i++) {
							if(max5 == winnerArray[i].set[4].priority) {
								tempWinners.push(winnerArray[i]);
							}
						}
						winnerArray.length=0;
						if(tempWinners.length > 1) {
							for(i=0; i<tempWinners.length; i++) {
								tempWinners[i].winnerRank = winnerRank;
								winnerRankArray.push(tempWinners[i]);
							}
							winnerRank++;
						} else {
							tempWinners[0].winnerRank = winnerRank++;
							winnerRankArray.push(tempWinners[0]);
						}
						console.log("\n originalArray - " + JSON.stringify(originalArray));
						console.log("\n winnerRankArray - " + JSON.stringify(winnerRankArray));
						winnerArray = differenceTwoArray(originalArray,winnerRankArray);
						console.log("\nwinner array after final calculation - " + JSON.stringify(winnerArray));
					} else {
						winnerArray[0].winnerRank = winnerRank++;
			    	winnerRankArray.push(winnerArray[0]);
			    	winnerArray = differenceTwoArray(originalArray,winnerRankArray);
						console.log("\nwinner array after final calculation in single case - " + JSON.stringify(winnerArray));
					}
				} else {
					tempWinners[0].winnerRank = winnerRank++;
			  	winnerRankArray.push(tempWinners[0]);
			  	winnerArray = differenceTwoArray(originalArray,winnerRankArray);
					console.log("\nwinner array after final calculation in single case - " + JSON.stringify(winnerArray));
				}
			} else {
				console.log("\nwinnerArray in else is - " + JSON.stringify(winnerArray));
				winnerArray[0].winnerRank = winnerRank++;
	    	winnerRankArray.push(winnerArray[0]);
	    	winnerArray = differenceTwoArray(originalArray,winnerRankArray);
				console.log("\nwinner array after final calculation in single case - " + JSON.stringify(winnerArray));
			}
		} else {
			tempWinners[0].winnerRank = winnerRank++;
    	winnerRankArray.push(tempWinners[0]);
    	winnerArray = differenceTwoArray(originalArray,winnerRankArray);
			console.log("\nwinner array after final calculation in single case - " + JSON.stringify(winnerArray));
		}
  }
  return {players: winnerRankArray, winnerRank: winnerRank};
};

/**
 * this function calculates rank in three of a kind
 * @method rankInThreeOfAKind
 * @param  {array}           winnerArray 
 * @param  {array}           winnerRank  
 * @return {object}                      
 */
var rankInThreeOfAKind = function(winnerArray, winnerRank) {
	var winnerRankArray = [], tempWinners = [],originalArray = Array.from(winnerArray);
	for(var i=0; i<winnerArray.length;i++) {
    winnerArray[i].set = _.sortBy(winnerArray[i].set,'priority').reverse();
  }
  console.log("\nwinnerArray after sorting is  - " + JSON.stringify(winnerArray));
  while(winnerArray.length > 0) {
  	tempWinners.length = 0;
  	var max3 = 0, tempMax3;
  	for(var i=0; i< winnerArray.length; i++) {
  		tempMax3 = winnerArray[i].set[2].priority;
  		if(tempMax3>max3) {
  			max3 = tempMax3;
  		}
  	}
  	for(var i=0; i< winnerArray.length; i++) {
  		if(max3 == winnerArray[i].set[2].priority) {
  			tempWinners.push(winnerArray[i]);
  		}
  	}

  	console.log("tempWinners after max3 comparision - " + JSON.stringify(winnerArray));
  	if(tempWinners.length > 1) {
  		var max2 = 0, tempMax2 = 0;
  		winnerArray.length = 0;
  		for(var i=0;i<tempWinners.length;i++) {
        if(tempWinners[i].set[0].priority === tempWinners[i].set[1].priority && tempWinners[i].set[1].priority === tempWinners[i].set[2].priority) {
          if(max2 < tempWinners[i].set[3].priority) {
            max2 = tempWinners[i].set[3].priority;
          }
        } else {
          if(max2 < tempWinners[i].set[0].priority) {
            max2 = tempWinners[i].set[0].priority;
          }
        }
      }
      for(var i=0; i<tempWinners.length;i++) {
        if(tempWinners[i].set[0].priority === tempWinners[i].set[1].priority && tempWinners[i].set[1].priority === tempWinners[i].set[2].priority) {
          tempMax2 = tempWinners[i].set[3].priority;
        } else {
          tempMax2 = tempWinners[i].set[0].priority;
        }
        if(tempMax2 === max2) {
          winnerArray.push(tempWinners[i]);
        }
      }

      console.log("tempWinners after max2 comparision - " + JSON.stringify(winnerArray));
      if(winnerArray.length > 1) {
      	tempWinners.length = 0;
      	var max1 = 0, tempMax1 = 0;
        for(var i=0;i<winnerArray.length;i++) {
          if(winnerArray[i].set[0].priority === winnerArray[i].set[1].priority && winnerArray[i].set[1].priority === winnerArray[i].set[2].priority) {
            if(max1 < winnerArray[i].set[4].priority) {
              max1 = winnerArray[i].set[4].priority;
            }
          } else if(winnerArray[i].set[1].priority === winnerArray[i].set[2].priority && winnerArray[i].set[2].priority === winnerArray[i].set[3].priority) {
            if(max1 < winnerArray[i].set[4].priority) {
              max1 = winnerArray[i].set[4].priority;
            }
          } else {
            if(max1 < winnerArray[i].set[1].priority) {
              max1 = winnerArray[i].set[1].priority;
            }
          }
        }
        for(var i=0; i<winnerArray.length;i++) {
          if(winnerArray[i].set[0].priority === winnerArray[i].set[1].priority && winnerArray[i].set[1].priority === winnerArray[i].set[2].priority) {
            tempMax1 = winnerArray[i].set[4].priority;
          } else if(winnerArray[i].set[1].priority === winnerArray[i].set[2].priority && winnerArray[i].set[2].priority === winnerArray[i].set[3].priority) {
            tempMax1 = winnerArray[i].set[4].priority;
          } else {
            tempMax1 = winnerArray[i].set[1].priority;
          }
          if(tempMax1 === max1) {
            tempWinners.push(winnerArray[i]);
          }
        }

        if(tempWinners.length > 1) {
        	for(i=0; i<tempWinners.length; i++) {
						tempWinners[i].winnerRank = winnerRank;
						winnerRankArray.push(tempWinners[i]);
					}
					winnerRank++;
	      } else {
	      	tempWinners[0].winnerRank = winnerRank++;
					winnerRankArray.push(tempWinners[0]);
	      }
	      console.log("\n originalArray - " + JSON.stringify(originalArray));
				console.log("\n winnerRankArray - " + JSON.stringify(winnerRankArray));
				winnerArray = differenceTwoArray(originalArray,winnerRankArray);
				console.log("\nwinner array after final calculation - " + JSON.stringify(winnerArray));
      } else {
      	winnerArray[0].winnerRank = winnerRank++;
	    	winnerRankArray.push(winnerArray[0]);
	    	winnerArray = differenceTwoArray(originalArray,winnerRankArray);
				console.log("\nwinner array after final calculation in single case -- " + JSON.stringify(winnerArray));
      }
  	} else {
  		tempWinners[0].winnerRank = winnerRank++;
    	winnerRankArray.push(tempWinners[0]);
    	winnerArray = differenceTwoArray(originalArray,winnerRankArray);
			console.log("\nwinner array after final calculation in single case - " + JSON.stringify(winnerArray));
  	}
  }
  return {players: winnerRankArray, winnerRank: winnerRank};
};

/**
 * this function calculates rank in two pair
 * @method rankInTwoPair
 * @param  {array}      winnerArray 
 * @param  {array}      winnerRank  
 * @return {object}                 
 */
var rankInTwoPair = function(winnerArray, winnerRank) {
	var winnerRankArray = [], tempWinners = [],originalArray = Array.from(winnerArray);
	for(var i=0; i<winnerArray.length;i++) {
    winnerArray[i].set = _.sortBy(winnerArray[i].set,'priority').reverse();
  }
  // console.log("\n winnerArray after sorting - " + JSON.stringify(winnerArray));
  while(winnerArray.length > 0) {
  	tempWinners.length = 0;
  	var max1 = 0, tempMax1 = 0;
  	for(var i=0; i<winnerArray.length; i++) {
  		if(max1 < winnerArray[i].set[1].priority) {
  			max1 = winnerArray[i].set[1].priority;
  		}
  	}
  	for(var i=0; i<winnerArray.length; i++) {
			if(max1 == winnerArray[i].set[1].priority) {
				tempWinners.push(winnerArray[i]);
			}
  	}
  	// console.log("\n tempWinners after first comparision - " + JSON.stringify(tempWinners));
  	if(tempWinners.length > 1) {
  		winnerArray.length = 0;
  		var max2 = 0;
  		for(var i=0; i<tempWinners.length; i++) {
	  		if(max2 < tempWinners[i].set[3].priority) {
	  			max2 = tempWinners[i].set[3].priority;
	  		}
	  	}
      // console.log("\n max2 is - " + max2)
	  	for(var i=0; i<tempWinners.length; i++) {
				if(max2 == tempWinners[i].set[3].priority) {
					winnerArray.push(tempWinners[i]);
				}
	  	}
      // console.log("winnerArray after second comparision - " + JSON.stringify(winnerArray));
	  	if(winnerArray.length > 1) {
	  		tempWinners.length = 0;
	  		var max3 = 0, tempMax3 = 0;
	  		for(var i=0; i<winnerArray.length; i++) {
	  			tempMax3 = winnerArray[i].set[0].priority ^ winnerArray[i].set[1].priority ^ winnerArray[i].set[2].priority ^ winnerArray[i].set[3].priority ^ winnerArray[i].set[4].priority;
		  		if(max3 < tempMax3) {
		  			max3 = tempMax3;
		  		}
		  	}
		  	for(var i=0; i<winnerArray.length; i++) {
          tempMax3 = winnerArray[i].set[0].priority ^ winnerArray[i].set[1].priority ^ winnerArray[i].set[2].priority ^ winnerArray[i].set[3].priority ^ winnerArray[i].set[4].priority;
					if(max3 == tempMax3) {
						tempWinners.push(winnerArray[i]);
					}
		  	}
        // console.log("\n max3 is - " + max3);
		  	if(tempWinners.length > 1) {
        	for(i=0; i<tempWinners.length; i++) {
						tempWinners[i].winnerRank = winnerRank;
						winnerRankArray.push(tempWinners[i]);
					}
					winnerRank++;
	      } else {
	      	tempWinners[0].winnerRank = winnerRank++;
					winnerRankArray.push(tempWinners[0]);
	      }
	      // console.log("\n originalArray - " + JSON.stringify(originalArray));
				// console.log("\n winnerRankArray - " + JSON.stringify(winnerRankArray));
				winnerArray = differenceTwoArray(originalArray,winnerRankArray);
				// console.log("\nwinner array after final calculation - " + JSON.stringify(winnerArray));
	  	} else {
	  		winnerArray[0].winnerRank = winnerRank++;
	    	winnerRankArray.push(winnerArray[0]);
	    	winnerArray = differenceTwoArray(originalArray,winnerRankArray);
				// console.log("\nwinner array after final calculation in single case -- " + JSON.stringify(winnerArray));
	  	}
  	} else {
  		tempWinners[0].winnerRank = winnerRank++;
    	winnerRankArray.push(tempWinners[0]);
    	winnerArray = differenceTwoArray(originalArray,winnerRankArray);
			// console.log("\nwinner array after final calculation in single case - " + JSON.stringify(winnerArray));
  	}
  }
  return {players: winnerRankArray, winnerRank: winnerRank};
};

/**
 * this function calculates rank in one pair
 * @method rankInOnePair
 * @param  {array}      winnerArray 
 * @param  {array}      winnerRank  
 * @return {object}                 
 */
var rankInOnePair = function(winnerArray, winnerRank) {
	var winnerRankArray = [], tempWinners = [],originalArray = Array.from(winnerArray);
  for (var index = 0; index < winnerArray.length; index++) {
      winnerArray[index].set.map(function(obj){
        if(obj.priority == 1){
          obj.priority = 14;
        }
      });
  }
	for(var i=0; i<winnerArray.length;i++) {
    winnerArray[i].set = _.sortBy(winnerArray[i].set,'priority').reverse();
  }
  console.log("\n winnerArray after sorting - " + JSON.stringify(winnerArray));
  while(winnerArray.length > 0) {
  	tempWinners.length = 0;
  	var maxPair1 = 0;
  	for(var i=0; i<winnerArray.length;i++) {
      if(winnerArray[i].set[0].priority === winnerArray[i].set[1].priority) {
        if(winnerArray[i].set[0].priority > maxPair1) {
          maxPair1 = winnerArray[i].set[0].priority;
        }
      } else if(winnerArray[i].set[1].priority === winnerArray[i].set[2].priority) {
        if(winnerArray[i].set[1].priority > maxPair1) {
          maxPair1 = winnerArray[i].set[1].priority;
        }
      } else if(winnerArray[i].set[2].priority === winnerArray[i].set[3].priority) {
        if(winnerArray[i].set[2].priority > maxPair1) {
          maxPair1 = winnerArray[i].set[2].priority;
        }
      } else if(winnerArray[i].set[3].priority === winnerArray[i].set[4].priority) {
        if(winnerArray[i].set[3].priority > maxPair1) {
          maxPair1 = winnerArray[i].set[3].priority;
        }
      }
    }
    for(var i=0; i<winnerArray.length;i++) {
      if(winnerArray[i].set[0].priority === winnerArray[i].set[1].priority) {
        if(maxPair1 === winnerArray[i].set[0].priority){
          tempWinners.push(winnerArray[i]);
        }
      }else if(winnerArray[i].set[1].priority === winnerArray[i].set[2].priority) {
        if(maxPair1 === winnerArray[i].set[1].priority){
          tempWinners.push(winnerArray[i]);
        }
      } else if(winnerArray[i].set[2].priority === winnerArray[i].set[3].priority) {
        if(maxPair1 === winnerArray[i].set[2].priority){
          tempWinners.push(winnerArray[i]);
        }
      } else if(winnerArray[i].set[3].priority === winnerArray[i].set[4].priority) {
        if(maxPair1 === winnerArray[i].set[3].priority){
          tempWinners.push(winnerArray[i]);
        }
      }
    }

    if(tempWinners.length > 1) {
    	winnerArray.length = 0;
    	var maxInOtherCard1 = 0;
    	for(var i=0; i<tempWinners.length;i++) {
        if(tempWinners[i].set[0].priority === tempWinners[i].set[1].priority) {
          if(tempWinners[i].set[2].priority > maxInOtherCard1) {
            maxInOtherCard1 = tempWinners[i].set[2].priority;
          }
        } else if(tempWinners[i].set[1].priority === tempWinners[i].set[2].priority) {
          if(tempWinners[i].set[0].priority > maxInOtherCard1) {
            maxInOtherCard1 = tempWinners[i].set[0].priority;
          }
        } else if(tempWinners[i].set[2].priority === tempWinners[i].set[3].priority) {
          if(tempWinners[i].set[0].priority > maxInOtherCard1) {
            maxInOtherCard1 = tempWinners[i].set[0].priority;
          }
        } else if(tempWinners[i].set[3].priority === tempWinners[i].set[4].priority) {
            if(tempWinners[i].set[0].priority > maxInOtherCard1) {
              maxInOtherCard1 = tempWinners[i].set[0].priority;
            }
          }
        }
      for(var i=0; i<tempWinners.length;i++) {
        if(tempWinners[i].set[0].priority === tempWinners[i].set[1].priority) {
          if(maxInOtherCard1 === tempWinners[i].set[2].priority){
            winnerArray.push(tempWinners[i]);
          }
        }else if(tempWinners[i].set[1].priority === tempWinners[i].set[2].priority) {
          if(maxInOtherCard1 === tempWinners[i].set[0].priority){
            winnerArray.push(tempWinners[i]);
          }
        } else if(tempWinners[i].set[2].priority === tempWinners[i].set[3].priority) {
          if(maxInOtherCard1 === tempWinners[i].set[0].priority){
            winnerArray.push(tempWinners[i]);
          }
        } else if(tempWinners[i].set[3].priority === tempWinners[i].set[4].priority) {
          if(maxInOtherCard1 === tempWinners[i].set[0].priority){
            winnerArray.push(tempWinners[i]);
          }
        }
      }

      if(winnerArray.length > 1) {
      	tempWinners.length = 0;
      	var maxInOtherCard2 = 0;
      	for(var i=0; i<winnerArray.length;i++) {
          if(winnerArray[i].set[0].priority === winnerArray[i].set[1].priority) {
            if(winnerArray[i].set[3].priority > maxInOtherCard2) {
              maxInOtherCard2 = winnerArray[i].set[3].priority;
            }
          } else if(winnerArray[i].set[1].priority === winnerArray[i].set[2].priority) {
            if(winnerArray[i].set[3].priority > maxInOtherCard2) {
              maxInOtherCard2 = winnerArray[i].set[3].priority;
            }
          } else if(winnerArray[i].set[2].priority === winnerArray[i].set[3].priority) {
            if(winnerArray[i].set[1].priority > maxInOtherCard2) {
              maxInOtherCard2 = winnerArray[i].set[1].priority;
            }
          } else if(winnerArray[i].set[3].priority === winnerArray[i].set[4].priority) {
            if(winnerArray[i].set[1].priority > maxInOtherCard2) {
              maxInOtherCard2 = winnerArray[i].set[1].priority;
            }
          }
        }
        for(var i=0; i<winnerArray.length;i++) {
          if(winnerArray[i].set[0].priority === winnerArray[i].set[1].priority) {
            if(maxInOtherCard2 === winnerArray[i].set[3].priority){
              tempWinners.push(winnerArray[i]);
            }
          } else if(winnerArray[i].set[1].priority === winnerArray[i].set[2].priority) {
            if(maxInOtherCard2 === winnerArray[i].set[3].priority){
              tempWinners.push(winnerArray[i]);
            }
          } else if(winnerArray[i].set[2].priority === winnerArray[i].set[3].priority) {
            if(maxInOtherCard2 === winnerArray[i].set[1].priority){
              tempWinners.push(winnerArray[i]);
            }
          } else if(winnerArray[i].set[3].priority === winnerArray[i].set[4].priority) {
            if(maxInOtherCard2 === winnerArray[i].set[1].priority){
              tempWinners.push(winnerArray[i]);
            }
          }
        }

        if(tempWinners.length > 1) {
        	var maxInOtherCard3 = 0;
        	winnerArray.length = 0;
        	for(var i=0; i<tempWinners.length;i++) {
            if(tempWinners[i].set[0].priority === tempWinners[i].set[1].priority) {
              if(tempWinners[i].set[4].priority > maxInOtherCard3) {
                maxInOtherCard3 = tempWinners[i].set[4].priority;
              }
            } else if(tempWinners[i].set[1].priority === tempWinners[i].set[2].priority) {
              if(tempWinners[i].set[4].priority > maxInOtherCard3) {
                maxInOtherCard3 = tempWinners[i].set[4].priority;
              }
            } else if(tempWinners[i].set[2].priority === tempWinners[i].set[3].priority) {
              if(tempWinners[i].set[4].priority > maxInOtherCard3) {
                maxInOtherCard3 = tempWinners[i].set[4].priority;
              }
            } else if(tempWinners[i].set[3].priority === tempWinners[i].set[4].priority) {
              if(tempWinners[i].set[2].priority > maxInOtherCard3) {
                maxInOtherCard3 = tempWinners[i].set[2].priority;
              }
            }
          }
          for(var i=0; i<tempWinners.length;i++) {
            if(tempWinners[i].set[0].priority === tempWinners[i].set[1].priority) {
              if(maxInOtherCard3 === tempWinners[i].set[4].priority){
                winnerArray.push(tempWinners[i]);
              }
            }else if(tempWinners[i].set[1].priority === tempWinners[i].set[2].priority) {
              if(maxInOtherCard3 === tempWinners[i].set[4].priority){
                winnerArray.push(tempWinners[i]);
              }
            } else if(tempWinners[i].set[2].priority === tempWinners[i].set[3].priority) {
              if(maxInOtherCard3 === tempWinners[i].set[4].priority){
                winnerArray.push(tempWinners[i]);
              }
            } else if(tempWinners[i].set[3].priority === tempWinners[i].set[4].priority) {
              if(maxInOtherCard3 === tempWinners[i].set[2].priority){
                winnerArray.push(tempWinners[i]);
              }
            }
          } 

			  	if(winnerArray.length > 1) {
	        	for(i=0; i<winnerArray.length; i++) {
							winnerArray[i].winnerRank = winnerRank;
							winnerRankArray.push(winnerArray[i]);
						}
						winnerRank++;
		      } else {
		      	winnerArray[0].winnerRank = winnerRank++;
						winnerRankArray.push(winnerArray[0]);
		      }
		      console.log("\n originalArray - " + JSON.stringify(originalArray));
					console.log("\n winnerRankArray - " + JSON.stringify(winnerRankArray));
					winnerArray = differenceTwoArray(originalArray,winnerRankArray);
					console.log("\nwinner array after final calculation - " + JSON.stringify(winnerArray));
        } else {
      		tempWinners[0].winnerRank = winnerRank++;
		    	winnerRankArray.push(tempWinners[0]);
		    	winnerArray = differenceTwoArray(originalArray,winnerRankArray);
					console.log("\nwinner array after final calculation in single case - " + JSON.stringify(winnerArray));  	
        }
      } else {
      	winnerArray[0].winnerRank = winnerRank++;
	    	winnerRankArray.push(winnerArray[0]);
	    	winnerArray = differenceTwoArray(originalArray,winnerRankArray);
				console.log("\nwinner array after final calculation in single case -- " + JSON.stringify(winnerArray));
      }
    } else {
    	tempWinners[0].winnerRank = winnerRank++;
    	winnerRankArray.push(tempWinners[0]);
    	winnerArray = differenceTwoArray(originalArray,winnerRankArray);
			console.log("\nwinner array after final calculation in single case - " + JSON.stringify(winnerArray));
    }
  }
  return {players: winnerRankArray, winnerRank: winnerRank};
};

/**
 * this function finds winner rankings
 * @method findWinnersRanking
 * @param  {array}           winnerArray 
 * @return {array}                       
 */
winnerRanking.findWinnersRanking = function(winnerArray) {
	console.log("winnerArray is - " + JSON.stringify(winnerArray));
	var winnerRank = 1;
	var winnerRankArray = [];
	for(var i=10; i>0; i--) {
		var sameGroup = _.where(winnerArray,{"priority" : i});
		console.log('\nsame group is - '+ JSON.stringify(sameGroup));
		if(sameGroup.length === 1) {
			sameGroup[0].winnerRank = winnerRank++;
			winnerRankArray.push(sameGroup[0]);
		} else if(sameGroup.length > 1) {
			var sameGroupByRank;
			switch (sameGroup[0].type) {
	      case 'Royal Flush'     : sameGroupByRank = rankInRoyalFlush(sameGroup,winnerRank); break;
	      case 'Straight Flush'  : sameGroupByRank = rankInStraightFlush(sameGroup,winnerRank); break;
	      case 'Four Of A Kind'  : sameGroupByRank = rankInFourOfAKind(sameGroup,winnerRank); break;
	      case 'Full House'      : sameGroupByRank = rankInFullHouse(sameGroup,winnerRank); break;
	      case 'Flush'           : sameGroupByRank = rankInFlush(sameGroup,winnerRank); break;
	      case 'Straight'        : sameGroupByRank = rankInStraightFlush(sameGroup,winnerRank); break;
	      case 'Three Of A Kind' : sameGroupByRank = rankInThreeOfAKind(sameGroup,winnerRank); break;
	      case 'Two Pairs'       : sameGroupByRank = rankInTwoPair(sameGroup,winnerRank); break;
	      case 'One Pair'        : sameGroupByRank = rankInOnePair(sameGroup,winnerRank); break;
	      case 'High Card'       : sameGroupByRank = rankInFlush(sameGroup,winnerRank); break;
	      default                : console.log('No case handle for this form!'); break;
	    }
	    console.log('\nsameGroupByRank is - ' + JSON.stringify(sameGroupByRank));
	    winnerRankArray = winnerRankArray.concat(sameGroupByRank.players);
	    winnerRank = sameGroupByRank.winnerRank;
		}
	}
	console.log('winnerRankArray is - ' + JSON.stringify(winnerRankArray));
	for(var i=0; i<winnerRankArray.length; i++) {
		winnerRankArray[i].text = cardConfig.findCardConfig(winnerRankArray[i]);
	}
	return winnerRankArray;
};

//### this function finds the winner in omahaLo
/**
 * this function finds the winner in omahaLo
 * @method findWinnerOmahaLo
 * @param  {array}          sets
 * @return {array}              
 */
winnerRanking.findWinnerOmahaLo = function(sets) {
  return compareHighCardInOmahaLo(sets);
};

  //### function to comapre and find best hands in omaha hi lo
var compareHighCardInOmahaLo = function (winnerArray) {
  var winnerRankArray = [], tempWinners = [],originalArray = Array.from(winnerArray),winnerRank = 1;
  for(var i=0; i<winnerArray.length;i++) {
    winnerArray[i].set = _.sortBy(winnerArray[i].set,'rank').reverse();
  }
  console.log("\n winnerArray after sorting - " + JSON.stringify(winnerArray));
  while(winnerArray.length > 0) {
  	tempWinners = [];
  	var max1 = winnerArray[0].set[0].rank;
    for(var i=0; i<winnerArray.length;i++) {
      if(max1 > winnerArray[i].set[0].rank) {
        max1 = winnerArray[i].set[0].rank;
      }
    }
    for(var i=0; i<winnerArray.length;i++) {
      if(max1 === winnerArray[i].set[0].rank) {
        tempWinners.push(winnerArray[i])
      }
    }

    if(tempWinners.length > 1) {
    	winnerArray = [];
    	var max2 = tempWinners[0].set[1].rank;
      for(var i=0; i<tempWinners.length;i++) {
        if(max2 > tempWinners[i].set[1].rank) {
          max2 = tempWinners[i].set[1].rank;
        }
      }
      for(var i=0; i<tempWinners.length;i++) {
        if(max2 === tempWinners[i].set[1].rank) {
          winnerArray.push(tempWinners[i])
        }
      }

      if(winnerArray.length > 1) {
      	tempWinners = [];
      	var max3 = winnerArray[0].set[2].rank;
        for(var i=0; i<winnerArray.length;i++) {
          if(max3 > winnerArray[i].set[2].rank) {
            max3 = winnerArray[i].set[2].rank;
          }
        }
        for(var i=0; i<winnerArray.length;i++) {
          if(max3 === winnerArray[i].set[2].rank) {
            tempWinners.push(winnerArray[i])
          }
        }

        if(tempWinners.length > 1) {
        	winnerArray = [];
        	var max4 = tempWinners[0].set[3].rank;
          for(var i=0; i<tempWinners.length;i++) {
            if(max4 > tempWinners[i].set[3].rank) {
              max4 = tempWinners[i].set[3].rank;
            }
          }
          for(var i=0; i<tempWinners.length;i++) {
            if(max4 === tempWinners[i].set[3].rank) {
              winnerArray.push(tempWinners[i])
            }
          }

          if(winnerArray.length > 1) {
          	tempWinners = [];
          	var max5 = winnerArray[0].set[4].rank;
            for(var i=0; i<winnerArray.length;i++) {
              if(max5 > winnerArray[i].set[4].rank) {
                max5 = winnerArray[i].set[4].rank;
              }
            }
            for(var i=0; i<winnerArray.length;i++) {
              if(max5 === winnerArray[i].set[4].rank) {
                tempWinners.push(winnerArray[i])
              }
            }

            if(tempWinners.length >= 1) {
              winnerArray = [];
		        	for(i=0; i<tempWinners.length; i++) {
								winnerArray.push(tempWinners[i]);
                winnerArray[i].winnerRank = winnerRank;
                winnerRankArray.push(winnerArray[i]);
							}
							winnerRank++;
			      } else {
			      	winnerArray[0].winnerRank = winnerRank++;
							winnerRankArray.push(winnerArray[0]);
			      }
			      console.log("\n originalArray - " + JSON.stringify(originalArray));
						console.log("\n winnerRankArray - " + JSON.stringify(winnerRankArray));
						winnerArray = differenceTwoArray(originalArray,winnerRankArray);
						console.log("\nwinner array after final calculation - " + JSON.stringify(winnerArray));
          } else {
          	winnerArray[0].winnerRank = winnerRank++;
			    	winnerRankArray.push(winnerArray[0]);
			    	winnerArray = differenceTwoArray(originalArray,winnerRankArray);
						console.log("\nwinner array after final calculation in single case - " + JSON.stringify(winnerArray));
          }
        } else {
        	tempWinners[0].winnerRank = winnerRank++;
		    	winnerRankArray.push(tempWinners[0]);
		    	winnerArray = differenceTwoArray(originalArray,winnerRankArray);
					console.log("\nwinner array after final calculation in single case - " + JSON.stringify(winnerArray));
        }
      } else {
      	winnerArray[0].winnerRank = winnerRank++;
	    	winnerRankArray.push(winnerArray[0]);
	    	winnerArray = differenceTwoArray(originalArray,winnerRankArray);
				console.log("\nwinner array after final calculation in single case - " + JSON.stringify(winnerArray));
      }
    } else {
    	tempWinners[0].winnerRank = winnerRank++;
    	winnerRankArray.push(tempWinners[0]);
    	winnerArray = differenceTwoArray(originalArray,winnerRankArray);
			console.log("\nwinner array after final calculation in single case - " + JSON.stringify(winnerArray));
    }
  }
  for(var i=0; i<winnerRankArray.length; i++) {
		winnerRankArray[i].text = _.pluck(winnerRankArray[i].set, 'name');
	}
  return winnerRankArray;
}

// TODO: omaha lo hand comparison - is WRONG - correct this
//  // Ace's priority should be 1 - may be
var set1 = {
    "set": [ 
    {"type":"diamond","rank":1,"name":"A","priority":14}, 
    {"type":"spade","rank":7,"name":"7","priority":7}, 
    {"type":"heart","rank":2,"name":"2","priority":2}, 
    {"type":"heart","rank":3,"name":"3","priority":3}, 
    {"type":"diamond","rank":4,"name":"4","priority":4}]}
var set2 = {
    "set": [
    {"type":"heart","rank":5,"name":"5","priority":5},
    {"type":"spade","rank":6,"name":"6","priority":6},
    {"type":"spade","rank":3,"name":"3","priority":3},
    {"type":"spade","rank":2,"name":"2","priority":2},
    {"type":"diamond","rank":4,"name":"4","priority":4}]}
var set3 = {
    "set": [ 
    {"type":"diamond","rank":1,"name":"A","priority":14}, 
    {"type":"spade","rank":6,"name":"6","priority":6}, 
    {"type":"heart","rank":2,"name":"2","priority":2}, 
    {"type":"heart","rank":3,"name":"3","priority":3}, 
    {"type":"diamond","rank":8,"name":"8","priority":8}]}


// console.log('-----final --', compareHighCardInOmahaLo([set1, set3 ])) // set1
// console.log('-----final --', compareHighCardInOmahaLo([set1, set2 ])) // set2
// console.log('-----final --', compareHighCardInOmahaLo([set3, set2 ])) // set2

module.exports = winnerRanking;