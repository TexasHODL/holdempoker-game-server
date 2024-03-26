// For testing purpose only

var winner = require("./entry.js");
// var paramsObject = {
// 	playerCards : [
// 	{
// 		playerId : 101,
// 		cards : [{
// 			type : "diamond",
// 			rank : 6
// 		},
// 		{
// 			type : "diamond",
// 			rank : 7
// 		}
// 		,
// 		{
// 			type : "club",
// 			rank : 8
// 		},
// 		{
// 			type : "diamond",
// 			rank : 9
// 		}
// 		]
// 	}
// 	,
// 	{
// 		playerId : 102,
// 		cards : [{
// 			type : "diamond",
// 			rank : 6
// 		},
// 		{
// 			type : "diamond",
// 			rank : 8
// 		}
// 		,
// 		{
// 			type : "club",
// 			rank : 9
// 		},
// 		{
// 			type : "diamond",
// 			rank : 6
// 		}
// 		]
// 	}
// 	// ,
// 	// {
// 	// 	playerId : 103,
// 	// 	cards : [{
// 	// 		type : "diamond",
// 	// 		rank : 3
// 	// 	},
// 	// 	{
// 	// 		type : "diamond",
// 	// 		rank : 3
// 	// 	}
// 	// 	,
// 	// 	{
// 	// 		type : "club",
// 	// 		rank : 12
// 	// 	},
// 	// 	{
// 	// 		type : "diamond",
// 	// 		rank : 1
// 	// 	}]
// 	// }
// 	],
// 	boardCards : [
// 	 {
// 	 		type : "club",
// 	 		rank : 1
// 	 	}
// 	 	,
// 		{
// 			type : "club",
// 			rank : 12
// 		},
// 		{
// 			type : "spade",
// 			rank : 13
// 		}
// 		 ,
// 		 {
// 		 	type : "spade",
// 		 	rank : 10
// 		 }
// 		,
// 		{
// 			type : "diamond",
// 			rank : 11
// 		}]
// };
// console.log("final winner in controller is",JSON.stringify(winner.findWinnerOmahaHiLo(paramsObject)));
// // console.log("final winner in controller is",JSON.stringify(winner.findCardsConfiguration(paramsObject,"Omaha Hi-Lo")));
// var paramsObject = {
// 	playerCards : [
// 	{
// 		playerId : 101,
// 		cards : [{
// 			type : "spade",
// 			rank : 12
// 		},
// 		{
// 			type : "club",
// 			rank : 11
// 		}
// 		]
// 	}
// 	,
// 	{
// 		playerId : 102,
// 		cards : [{
// 			type : "club",
// 			rank : 1
// 		},
// 		{
// 			type : "spade",
// 			rank : 1
// 		}
// 		]
// 	}
// 	,
// 	{
// 		playerId : 103,
// 		cards : [{
// 			type : "club",
// 			rank : 1
// 		},
// 		{
// 			type : "club",
// 			rank : 12
// 		}
// 		]
// 	},
// 	{
// 		playerId : 104,
// 		cards : [{
// 			type : "club",
// 			rank : 14
// 		},
// 		{
// 			type : "club",
// 			rank : 11
// 		}
// 		]
// 	}
// 	// ,
// 	// {
// 	// 	playerId : 105,
// 	// 	cards : [{
// 	// 		type : "diamond",
// 	// 		rank : 3
// 	// 	},
// 	// 	{
// 	// 		type : "diamond",
// 	// 		rank : 3
// 	// 	}
// 	// 	]
// 	// },
// 	// {
// 	// 	playerId : 106,
// 	// 	cards : [{
// 	// 		type : "diamond",
// 	// 		rank : 3
// 	// 	},
// 	// 	{
// 	// 		type : "diamond",
// 	// 		rank : 3
// 	// 	}
// 	// 	]
// 	// },
// 	// {
// 	// 	playerId : 107,
// 	// 	cards : [{
// 	// 		type : "diamond",
// 	// 		rank : 3
// 	// 	},
// 	// 	{
// 	// 		type : "diamond",
// 	// 		rank : 3
// 	// 	}]
// 	// },
// 	// {
// 	// 	playerId : 108,
// 	// 	cards : [{
// 	// 		type : "diamond",
// 	// 		rank : 3
// 	// 	},
// 	// 	{
// 	// 		type : "diamond",
// 	// 		rank : 3
// 	// 	}]
// 	// },
// 	// {
// 	// 	playerId : 109,
// 	// 	cards : [{
// 	// 		type : "diamond",
// 	// 		rank : 3
// 	// 	},
// 	// 	{
// 	// 		type : "diamond",
// 	// 		rank : 3
// 	// 	}]
// 	// }
// 	],
// 	boardCards : [
// 	 {
// 	 		type : "spade",
// 	 		rank : 12
// 	 	}
// 	 	,
// 		{
// 			type : "spade",
// 			rank : 13
// 		},
// 		{
// 			type : "club",
// 			rank : 10
// 		}
// 		 ,
// 		 {
// 		 	type : "diamond",
// 		 	rank : 9
// 		 }
// 		,
// 		{
// 			type : "spade",
// 			rank : 4
// 		}]
// };
// // console.log("\nstart time is - " + Number(new Date()));
// 	console.log("\nfinal winner in controller is",JSON.stringify(winner.findWinner(paramsObject)));
// for(var i=0; i<10; i++) {
// 	var startTime = Number(new Date());
// 	winner.findWinner(paramsObject);
// 	var endTime = Number(new Date());
// 	console.log("\ntotal time taken - " + (endTime - startTime));
// }

// var sampleInput = [{
// playerId : "101",
// 	points   : 1,
// 	isFoul   : false,
// 	handsWon : 0,
// 	currentPoints : 20,
// 	personalRoyalities : {
// 		top: 0 ,
// 		middle: 0,
// 		bottom: 0
// 	},
// 	wonFoulPoints : 0,
// 	isScoop       : false,
// 	isSurrendered : false,
// 	pointDetails : [{
// 		playerId : 102,
// 		top : 0,
// 		middle : 0,
// 		bottom : 0
// 	},{
// 		playerId : 103,
// 		top : 0,
// 		middle : 0,
// 		bottom : 0
// 	}],
// 	royalities : [{
// 		playerId : 102,
// 		top : 0,
// 		middle : 0,
// 		bottom : 0
// 	},{
// 		playerId : 103,
// 		top : 0,
// 		middle : 0,
// 		bottom : 0
// 	}],
// 	bottomHand : [{
// 			type : "club",
// 			rank : 7
// 		},
// 		{
// 			type : "club",
// 			rank : 8
// 		},
// 		{
// 			type : "club",
// 			rank : 9
// 		},
// 		{
// 			type : "club",
// 			rank : 10
// 		},
// 		{
// 			type : "club",
// 			rank : 11
// 		}],
// 	middleHand : [{
// 			type : "heart",
// 			rank : 2
// 		},
// 		{
// 			type : "heart",
// 			rank : 6
// 		},
// 		{
// 			type : "spade",
// 			rank : 3
// 		},
// 		{
// 			type : "diamond",
// 			rank : 5
// 		},
// 		{
// 			type : "club",
// 			rank : 1
// 		}],
// 	topHand : [{
// 			type : "diamond",
// 			rank : 10
// 		},
// 		{
// 			type : "club",
// 			rank : 10
// 		},
// 		{
// 			type : "diamond",
// 			rank : 10
// 		}]
// }
// 	,
// {
// 	playerId : "102",
// 	points   : 2,
// 	isFoul   : false,
// 	handsWon : 0,
// 	isInFantasyLand : false,
// 	fantasyLandCards: 0,
// 	currentPoints : 20,
// 	personalRoyalities : {
// 		top: 0 ,
// 		middle: 0,
// 		bottom: 0
// 	},
// 	isSurrendered : false,
// 	wonFoulPoints : 0,
// 	isScoop       : false,
// 	pointDetails : [{
// 		playerId: 103,
// 		top : 0,
// 		middle : 0,
// 		bottom : 0
// 	}],
// 	royalities : [{
// 		playerId: 103,
// 		top : 0,
// 		middle : 0,
// 		bottom : 0
// 	}],
// 	bottomHand : [{
// 			type : "spade",
// 			rank : 1
// 		},
// 		{
// 			type : "diamond",
// 			rank : 12
// 		},
// 		{
// 			type : "diamond",
// 			rank : 12
// 		},
// 		{
// 			type : "diamond",
// 			rank : 12

// 		},
// 		{
// 			type : "spade",
// 			rank : 7
// 		}],
// 	middleHand : [{
// 			type : "heart",
// 			rank : 2
// 		},
// 		{
// 			type : "heart",
// 			rank : 6
// 		},
// 		{
// 			type : "spade",
// 			rank : 3
// 		},
// 		{
// 			type : "diamond",
// 			rank : 5
// 		},
// 		{
// 			type : "club",
// 			rank : 1
// 		}],
// 	topHand : [{
// 			type : "diamond",
// 			rank : 4
// 		},
// 		{
// 			type : "club",
// 			rank : 8
// 		},
// 		{
// 			type : "diamond",
// 			rank : 7
// 		}]
// 		},
// 		{
// 	playerId : "103",
// 	points   : 5,
// 	isFoul   : false,
// 	handsWon : 0,
// 	currentPoints : 20,
// 	personalRoyalities : {
// 		top: 0 ,
// 		middle: 0,
// 		bottom: 0
// 	},
// 	wonFoulPoints : 0,
// 	isSurrendered : false,
// 	isScoop       : false,
// 	bottomHand : [{
// 			type : "heart",
// 			rank : 1
// 		},
// 		{
// 			type : "heart",
// 			rank : 12
// 		},
// 		{
// 			type : "diamond",
// 			rank : 11
// 		},
// 		{
// 			type : "diamond",
// 			rank : 10
// 		},
// 		{
// 			type : "diamond",
// 			rank : 13
// 		}],
// 	middleHand : [{
// 			type : "heart",
// 			rank : 2
// 		},
// 		{
// 			type : "heart",
// 			rank : 6
// 		},
// 		{
// 			type : "spade",
// 			rank : 3
// 		},
// 		{
// 			type : "diamond",
// 			rank : 5
// 		},
// 		{
// 			type : "club",
// 			rank : 1
// 		}],
// 	topHand : [{
// 			type : "diamond",
// 			rank : 4
// 		},
// 		{
// 			type : "club",
// 			rank : 8
// 		},
// 		{
// 			type : "diamond",
// 			rank : 7
// 		}]
// 		}
// ]

// // var royalityInput = {
// // 	handType : "topHand",
// // 	cards    : [{
// // 			type : "club",
// // 			rank : 6
// // 		},
// // 		{
// // 			type : "spade",
// // 			rank : 8
// // 		},
// // 		{
// // 			type : "heart",
// // 			rank : 8
// // 		}
// // 		// {
// // 		// 	type : "spade",
// // 		// 	rank : 1
// // 		// },
// // 		// {
// // 		// 	type : "heart",
// // 		// 	rank : 13
// // 		// }
// // 	]
// // }

// // console.log("final winner in controller is",JSON.stringify(winner.findRoyalityForHand(royalityInput)));
// // console.log("final winner in controller is",JSON.stringify(winner.findOfcpWinner(sampleInput)));
