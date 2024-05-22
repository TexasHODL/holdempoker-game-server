/*jshint node: true */
'use strict';

var _ = require("underscore");
var prize = {};

function prizeDistributionAlgo(totalplayers, minplayers, entryFees, rebuys, addons){
	console.log("totalplayers, minplayers, entryFees, rebuys, addons",totalplayers, minplayers, entryFees, rebuys, addons);
	if(minplayers>totalplayers){
		console.log("minplayers can't be greater than totalplayers");
		return;
	}

	//total number of player who will receive prize.
	var prize_to_be_distributed = Math.ceil(totalplayers/4);

	var minimum_prize_pool = minplayers*entryFees + rebuys + addons;

	var total_prize_pool = totalplayers*entryFees + rebuys + addons;

	if(prize_to_be_distributed === 1){
		var result = [[{'position': 1, prizeMoney: total_prize_pool, increment_ratio: 1}]];
		return result;
	}

	var player1st_from_minimum_prize_pool = Math.round(minimum_prize_pool*0.20);

	var player2nd_from_minimum_prize_pool = Math.round(minimum_prize_pool*0.10);

	var remaining_prize_pool = Math.round(total_prize_pool - (minimum_prize_pool*0.30));

	//For Group Distribution Logic
	// 11-40 :- Group 0f 3
	// 41-100 :- Group of 5
	// 101-200 :- Group of 7
	// 201- ~  :- Group of 10

	console.log("total player: ", totalplayers);
	console.log("minimum player: ", minplayers);
	console.log("entry fees: ", entryFees);
	console.log("total number of player who will receive prize: ", prize_to_be_distributed);
	console.log("minimum_prize_pool: ", minimum_prize_pool);
	console.log("total_prize_pool: ", total_prize_pool);
	console.log("player1st_from_minimum_prize_pool: ", player1st_from_minimum_prize_pool);
	console.log("player2nd_from_minimum_prize_pool: ", player2nd_from_minimum_prize_pool);
	console.log("remaining_prize_pool: ", remaining_prize_pool);

	var group = formGroup(prize_to_be_distributed);

	var groupLength = group.length;
	// console.log("Group Length: ", groupLength);

	var initial_percentage_to_start = Math.round(100/groupLength);
	// console.log("initial_percentage_to_start 100/groupLength: ", initial_percentage_to_start);

	var increment_ratio = 1;
	var sum =0;
	for(var i=groupLength-1; i>=0; i--){
		if(i!= groupLength-1){
			increment_ratio = increment_ratio+(initial_percentage_to_start/100)*increment_ratio;
			// console.log("increment ratio is - " + increment_ratio);
		}
		for(var j=0; j<group[i].length; j++){
			group[i][j].increment_ratio = increment_ratio;
			var outstanding_amount = increment_ratio*100;
			sum = sum+outstanding_amount;
		}
	}
	// console.log("Total prize to be distributed if initial (x) is 100: ", sum);

	// console.log("Total prize to be distributed if entry fees is: "+entryFees+" and total player is: "+totalplayers+" -> ", (sum/100)*remaining_prize_pool);

	var x = Math.round((100*remaining_prize_pool)/sum);
	var totalAmountToBeDistributed = 0;
	for(var i=groupLength-1; i>=0; i--){
		for(var j=0; j<group[i].length; j++){
			var amount = Math.round(group[i][j].increment_ratio*x);
			totalAmountToBeDistributed = totalAmountToBeDistributed + amount;
			group[i][j].prizeMoney = amount;
		}
	}

	group[0][0].prizeMoney = Math.round(group[0][0].prizeMoney+player1st_from_minimum_prize_pool);
	group[1][0].prizeMoney = Math.round(group[1][0].prizeMoney+player2nd_from_minimum_prize_pool);


	// console.log("value of x: ", x);
	// console.log("totalAmountToBeDistributed: ",totalAmountToBeDistributed);
	// console.log("remaining_prize_pool: ", remaining_prize_pool);
	return group;

}

function formGroup(totalPlayer){
	// console.log("total player is - " + totalPlayer); 
	var group = [];
	//upto 10player
	if(totalPlayer>10){
		for(var i=1; i<=10; i++){
			group.push([{'position': i}]);
		}
	} else {
		for(var i=1; i<=totalPlayer; i++){
			group.push([{'position': i}]);
		}
		return group;
	}

	// 10-40 :- Group 0f 3
	if(totalPlayer>40){
		var obj =[];
		for(var i=11; i<=40; i++){
			obj.push({'position': i});
			if((i-10)%3 === 0){
				group.push(obj);
				obj = [];
			}
			if(i===40){
				if(obj.length)
					group.push(obj);
			}
		}
	} else{
		var obj =[];
		for(var i=11; i<=totalPlayer; i++){
			obj.push({'position': i});
			if((i-10)%3 === 0){
				group.push(obj);
				obj = [];
			}
			if(i===totalPlayer){
				if(obj.length)
					group.push(obj);
			}
		}
		return group;
	}

	// 41-100 :- Group 0f 5
	if(totalPlayer>100){
		var obj =[];
		for(var i=41; i<=100; i++){
			obj.push({'position': i});
			if((i-40)%5 === 0){
				group.push(obj);
				obj = [];
			}
			if(i===100){
				if(obj.length)
					group.push(obj);
			}
		}
	} else{
		var obj =[];
		for(var i=41; i<=totalPlayer; i++){
			obj.push({'position': i});
			if((i-40)%5 === 0){
				group.push(obj);
				obj = [];
			}
			if(i===totalPlayer){
				if(obj.length)
					group.push(obj);
			}
		}
		return group;
	}

	// 101-200 :- Group 0f 7
	if(totalPlayer>200){
		var obj =[];
		for(var i=101; i<=200; i++){
			obj.push({'position': i});
			if((i-100)%7 === 0){
				group.push(obj);
				obj = [];
			}
			if(i===200){
				if(obj.length)
					group.push(obj);
			}
		}
	} else{
		var obj =[];
		for(var i=101; i<=totalPlayer; i++){
			obj.push({'position': i});
			if((i-100)%7 === 0){
				group.push(obj);
				obj = [];
			}
			if(i===totalPlayer){
				if(obj.length)
					group.push(obj);
			}
		}
		return group;
	}

	// 201- ~ :- Group 0f 10
	if(totalPlayer>200){
		var obj =[];
		for(var i=201; i<=totalPlayer; i++){
			obj.push({'position': i});
			if((i-200)%10 === 0){
				group.push(obj);
				obj = [];
			}
			if(i===totalPlayer){
				if(obj.length)
					group.push(obj);
			}
		}
	}

	return group;
}
//dustributePrize();


prize.prizeForDb = function(totalPlayers, minPlayers, entryFees, rebuys, addons) {
  // console.log("in prizeForDb in prize algo ",totalPlayers, minPlayers, entryFees);
  var result = prizeDistributionAlgo(totalPlayers, minPlayers, entryFees, rebuys, addons);
  //console.log(JSON.stringify(result));
  var res = [];
  for(var i=0;i<result.length;i++) {
    for(var j=0;j<result[i].length;j++) {
      res.push(_.omit(result[i][j],"increment_ratio"));
    }
  }
	console.log("response is in prizeForDb is - ");
  console.log(JSON.stringify(res));
	for(var i=0; i<res.length;i++) {
		res[i].prizeMoney = Math.round(res[i].prizeMoney);
	}
	// console.log("\n----------------",JSON.stringify(res));
	return res;
};
// prize.prizeForDb(100,100,100);
prize.generalizePrizeStructure = function(totalPlayers, minPlayers, entryFees, rebuys, addons) {
	var prizeArray = [];
	for(var i=minPlayers;i<totalPlayers;i+=4) {
		var prizes = prize.prizeForDb(i+4,i,entryFees,rebuys, addons);
		prizeArray.push({
			lowerLimit : i,
			upperlimit : i+4,
			noOfPrizes : prizes.length,
			prizes : prizes
		});
	}
	// console.log('prize arryay is - ' + JSON.stringify(prizeArray));
	return prizeArray;
};

// console.log(JSON.stringify(prize.generalizePrizeStructure(50,3,10,30,40)));

module.exports = prize;
