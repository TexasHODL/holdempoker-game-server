/*jshint node: true */
"use strict";


var async        = require('async'),
	db             = require("../../../../shared/model/dbQuery.js"),
	profileMgmt    = require("../../../../shared/model/profileMgmt.js"),
  zmqPublish     = require("../../../../shared/infoPublisher"),
	stateOfX       = require("../../../../shared/stateOfX"),
	popupTextManager  = require("../../../../shared/popupTextManager"),
  dynamicRanks   = require("./dynamicRanks.js"),
  imdb           = require("../../../../shared/model/inMemoryDbQuery.js"),
  _              = require("underscore"),
	calculateRanks = {};


/**
 * this function is used to Create data for log generation
 * @method serverLog
 */
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'calculateRanks';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

/**
 * this function is used to getPrizeRuleForNormalTournament
 * @method getPrizeRuleForNormalTournament
 * @param  {Object}       args  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var getPrizeRuleForNormalTournament = function(args, cb) {
	serverLog(stateOfX.serverLogType.info,"in getPrizeRuleForNormalTournament in calculate ranks - "+JSON.stringify(args));
  db.findNormalPrizeRule(args.params.table.tournamentRules.tournamentId, function(err, prizeRule) {
    if(err || prizeRule.length<1) {
      serverLog(stateOfX.serverLogType.info,"getting prize Error");
      cb({success: false, isRetry: false, isDisplay: false, channelId:'', info: popupTextManager.dbQyeryInfo.DB_ERROR_GETTING_PRIZE});
    } else {
      serverLog(stateOfX.serverLogType.info,"prizeRule is "+JSON.stringify(prizeRule));
      args.params.table.tournamentRules.prizeRule = prizeRule[0].prize; // Save the prize rule in params for furthur use
      cb(null,args);
    }
  });
};
/**
 * this function is used to findPlayersWhoGotRanks i.e. those players who have been eliminated
 * @method findPlayersWhoGotRanks
 * @param  {Object}       args  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var findPlayersWhoGotRanks = function(args, cb) {
	serverLog(stateOfX.serverLogType.info,"in findPlayersWhoGotRanks  ----------"+JSON.stringify(args));
	var filter = {
		tournamentId: args.params.table.tournamentRules.tournamentId,
		gameVersionCount: args.params.table.gameVersionCount,
	};
	db.countTournamentusers(filter, function(err,enrolledPlayers) {
		if(err) {
			cb({success: false, isRetry: false, isDisplay: false, channelId:'', info: popupTextManager.dbQyeryInfo.DB_ERROR_COUNT_ENROLLED_USERS});
		} else {
			args.enrolledPlayers = enrolledPlayers;
			filter.isActive = false;
			serverLog(stateOfX.serverLogType.info,"filter in findPlayersWhoGotRanks in calculateRanks is  "+filter);
			db.countTournamentusers(filter, function(err,count) {
				serverLog(stateOfX.serverLogType.info,"playerWho got ranks are - "+count);
				if(err) {
					cb({success: false, isRetry: false, isDisplay: false, channelId:'', info: popupTextManager.dbQyeryInfo.DB_ERROR_COUNT_TOURNAMENT_USERS});
				} else {
					args.playersWhoGotRanks = count;
					cb(null, args);
				}
			});
		}
	});
};
/**
 * this function is used to getPrizeRule 
 * @method getPrizeRule
 * @param  {Object}       args  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var getPrizeRule = function(args,cb) {
	serverLog(stateOfX.serverLogType.info,"in get prize rule in calculate ranks - "+JSON.stringify(args));
  db.getPrizeRule(args.params.table.tournamentRules.prizeId, function(err, prizeRule) {
    if(err || !prizeRule) {
      serverLog(stateOfX.serverLogType.info,"getting prize Error");
      cb({success: false, isRetry: false, isDisplay: false, channelId:'', info: popupTextManager.dbQyeryInfo.DB_ERROR_GETTING_PRIZE});
    } else {
      serverLog(stateOfX.serverLogType.info,"prizeRule is "+JSON.stringify(prizeRule));
      serverLog(stateOfX.serverLogType.info,"playerprizepercent is "+prizeRule.list[0].playerprizepercent);
      args.params.table.tournamentRules.prizeRule = prizeRule.list[0].playerprizepercent; // Save the prize rule in params for furthur use
      cb(null,args);
    }
  });
};
/**
 * this function is used to findPlayersWhoHaveEqualChips 
 * @method findPlayersWhoHaveEqualChips
 * @param  {Object}       args  request json object
 * @param  {Function}     playerIt      callback function
 * @return {Object}               params/validated object
 */
var findPlayersWhoHaveEqualChips = function(args,playerIt) {
	serverLog(stateOfX.serverLogType.info,"in findPlayersWhoHaveEqualChips in calculateRanks ----------"+JSON.stringify(args));
	serverLog(stateOfX.serverLogType.info,"playerIt in findPlayersWhoHaveEqualChips in calculateRanks ----------"+playerIt);
	// Itereate over player array and find how many have successive same onStartBuyIn Value
	var equalChipsCount = 1;
	//Checking how many player have equal ranks
	while((playerIt+1) < args.playerWithNoChips.length && args.playerWithNoChips[playerIt].onGameStartBuyIn === args.playerWithNoChips[playerIt+1].onGameStartBuyIn) {
		equalChipsCount++;//contains how many onStartBuyIn are same
		playerIt++;
	}
	serverLog(stateOfX.serverLogType.info,"equal chips count is in findPlayersWhoHaveEqualChips - "+equalChipsCount);
	return {
		equalChipsCount: equalChipsCount,
		playerIt: playerIt
	};
};
/**
 * this function is used to calculatePrizeWhoHaveEqualChips 
 * @method calculatePrizeWhoHaveEqualChips
 * @param  {interger}     tempFirstRank,tempLastRank  request integer,args()
 * @param  {Function}     playerIt      callback function
 * @return {Object}               params/validated object
 */
var calculatePrizeWhoHaveEqualChips = function(tempFirstRank,tempLastRank,args,prizeMoney) {
	serverLog(stateOfX.serverLogType.info,"in calculatePrize ----------tempFirstRank,tempLastRank,prizeMoney"+tempFirstRank+tempLastRank+prizeMoney);
	var prize=0;
	while(tempFirstRank <= tempLastRank && tempFirstRank <= args.params.table.tournamentRules.prizeRule.length) {
    serverLog(stateOfX.serverLogType.info,args.params.table.tournamentRules.prizeRule);
		serverLog(stateOfX.serverLogType.info,tempFirstRank);
    serverLog(stateOfX.serverLogType.info+JSON.stringify(args.params.table.tournamentRules.prizeRule[tempFirstRank-1]));
    serverLog(stateOfX.serverLogType.info,"*********************************"+JSON.stringify(args.params.table.tournamentRules.prizeRule[tempFirstRank-1].value*prizeMoney)/100);
    prize += Math.round(args.params.table.tournamentRules.prizeRule[tempFirstRank++ - 1].value*prizeMoney)/100;
	}
	serverLog(stateOfX.serverLogType.info,"prize is in calculatePrizeWhoHaveEqualChips is - ",prize);
	return prize;
};
/**
 * this function is used to prepareListWhoHaveEqualRanks 
 * @method prepareListWhoHaveEqualRanks
 * @param  {Object}       args,prize,equalChipsCount,prize,lastRank,tempPlayerIt request json object
 */
var prepareListWhoHaveEqualRanks = function(args,equalChipsCount,prize,lastRank,tempPlayerIt){
	serverLog(stateOfX.serverLogType.info,"in prepareListWho equalChipsCount,prize,lastRank,tempPlayerIt----------"+equalChipsCount+prize,+lastRank+tempPlayerIt);
	var tempCount = 0;
	while(tempCount++ < equalChipsCount) {
		serverLog(stateOfX.serverLogType.info,"in rank to insert push while");
		args.ranksToInsert.push({
			playerId 						: args.playerWithNoChips[tempPlayerIt].playerId,
			tournamentId 				: args.params.table.tournamentRules.tournamentId,
      gameVersionCount 		: args.params.table.gameVersionCount,
      tournamentName 			: args.params.table.tournamentName,
      channelId    				: args.playerWithNoChips[tempPlayerIt].channelId,
      chipsWon 					  : prize,
      rank         				: lastRank,
      userName 						: args.playerWithNoChips[tempPlayerIt].tournamentData.userName || args.playerWithNoChips[tempPlayerIt].playerName,
      isPrizeBroadcastSent: false,
      isCollected         : false

		});
		tempPlayerIt++;
	}
	serverLog(stateOfX.serverLogType.info,"ranks to insert is in prepareListWhoHaveEqualRanks in calculate ranks is - "+JSON.stringify(args.ranksToInsert));
};
/**
 * this function is used to prepareListForNormalRanks 
 * @method prepareListForNormalRanks
 * @param  {Object}       args,playerIt,prize
 */
var prepareListForNormalRanks = function(args,playerIt,prize,lastRank) {
	serverLog(stateOfX.serverLogType.info,"in prepareListFor playerIt,prize,lastRank----------"+playerIt+prize+lastRank);
	args.ranksToInsert.push({
		playerId 						: args.playerWithNoChips[playerIt].playerId,
		tournamentId 				: args.params.table.tournamentRules.tournamentId,
    gameVersionCount 		: args.params.table.gameVersionCount,
    tournamentName 			: args.params.table.tournamentName,
    channelId    				: args.playerWithNoChips[playerIt].channelId,
    chipsWon   				  : prize,
    rank         				: lastRank--,
    isPrizeBroadcastSent: false,
    userName 						: args.playerWithNoChips[playerIt].tournamentData.userName ||args.playerWithNoChips[playerIt].playerName,
    isCollected         : false
	});
	serverLog(stateOfX.serverLogType.info,"arg.rank to insert in prepareListForNormalRanks in calculateRanks is -"+args.ranksToInsert);
};
/**
 * this function is used to pushWinner i.e. form a list of all winners and push it into the ranks array
 * @method pushWinner
 * @param  {Object}       args,winner,prize
 */
var pushWinner = function(args,winner,prize) {
  serverLog(stateOfX.serverLogType.info,"in pushWinner in calculateRanks is - ");
  serverLog(stateOfX.serverLogType.info,args,winner[0],prize);
  args.ranksToInsert.push({
    playerId            : winner[0].playerId,
    tournamentId        : args.params.table.tournamentRules.tournamentId,
    gameVersionCount    : args.params.table.gameVersionCount,
    tournamentName 			: args.params.table.tournamentName,
    channelId           : winner[0].channelId,
    chipsWon            : prize,
    rank                : 1,
    isPrizeBroadcastSent: false,
    userName            : winner[0].tournamentData.userName || winner[0].playerName,
    isCollected         : false
  });
  serverLog(stateOfX.serverLogType.info,"winner is in pushWinner is - "+args.ranksToInsert);
};
/**
 * this function is used to processRanks
 * @method processRanks
 * @param  {Object}       args  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var processRanks = function(args, cb) {
	serverLog(stateOfX.serverLogType.info,"in processRanks in calculateRanks ----------"+JSON.stringify(args));
	var playerIt = 0;
	var lastRank = args.params.table.tournamentRules.totalPlayer - args.playersWhoGotRanks;
	var prizeMoney = args.params.table.tournamentRules.totalPlayer*args.params.table.tournamentRules.entryFees;
	var prize = 0;
	serverLog(stateOfX.serverLogType.info,"last rank is in process ranks in calculateRanks is - " + lastRank);
	serverLog(stateOfX.serverLogType.info,"prizeMoney is in process ranks in calculateRanks is - " + prizeMoney);
	while(playerIt < args.playerWithNoChips.length) {
		var ranksObject = {},equalChipsCount = 1;
		//check if same onGameStartBuyIn value
		if((playerIt+1) < args.playerWithNoChips.length && args.playerWithNoChips[playerIt].onGameStartBuyIn === args.playerWithNoChips[playerIt+1].onGameStartBuyIn) {
			serverLog(stateOfX.serverLogType.info,"players chips are same is in process ranks identified");
			var tempPlayerIt = playerIt;
			var playerHavingEqualChips = findPlayersWhoHaveEqualChips(args,playerIt);
			serverLog(stateOfX.serverLogType.info,"player having equalChipsCount is in processRanks in calculateRanks is - "+JSON.stringify(playerHavingEqualChips));
			equalChipsCount = playerHavingEqualChips.equalChipsCount;
			playerIt = playerHavingEqualChips.playerIt;
			serverLog(stateOfX.serverLogType.info,"Equal chipa count and player it is in processRanks rank in calculateRanks is  - "+equalChipsCount+playerIt);
			var tempLastRank = lastRank;
			lastRank = lastRank - equalChipsCount +1;//Skip worst ranks is onStartBuyIn value are same;
			var tempFirstRank = lastRank;
			serverLog(stateOfX.serverLogType.info,"last ranks is in while in calculateRanks is -" + tempFirstRank + tempLastRank);
			//Decide prizes indexes
			prize = calculatePrizeWhoHaveEqualChips(tempFirstRank,tempLastRank,args,prizeMoney);
			prize = Math.round(prize/equalChipsCount);
			serverLog(stateOfX.serverLogType.info,"calculated prize is - " + prize);
			prepareListWhoHaveEqualRanks(args,equalChipsCount,prize,lastRank,tempPlayerIt);
			// prepare ranks array
			lastRank--;
		} else {
			//This part execute when consecutive onStartBuy in are not same
			serverLog(stateOfX.serverLogType.info,"lastRank is in else in processRanks in calculateRanks is - " + lastRank);
			if(lastRank <= args.params.table.tournamentRules.prizeRule.length) {
				prize = args.params.table.tournamentRules.prizeRule[lastRank - 1].value*prizeMoney* 0.01;
			}
			prepareListForNormalRanks(args,playerIt,prize,lastRank);
			lastRank--;
		}
		playerIt++;
		serverLog(stateOfX.serverLogType.info,"last rank and playerit in end in while in processRanks in calculateRanks is - "+lastRank,playerIt);
	}
  if(!args.params.table.tournamentRules.isGameRunning) {
    serverLog(stateOfX.serverLogType.info,"this is rank no. one--------------");
    var winnerPrize = args.params.table.tournamentRules.prizeRule[0].value*prizeMoney* 0.01;
    serverLog(stateOfX.serverLogType.info,winnerPrize);
    pushWinner(args,args.params.table.tournamentRules.winner,winnerPrize);
  }
	cb(null, args);
};

// var createResponse = function(args,cb) {
// 	serverLog(stateOfX.serverLogType.info,"in createResponse ----------");
// 	serverLog(stateOfX.serverLogType.info,"args.params.table in createResponse is ", JSON.stringify(args));

// }
/**
 * this function is used to updateTournamentRules
 * @method updateTournamentRules
 * @param  {Object}       args  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var updateTournamentRules = function(args, cb) {
	serverLog(stateOfX.serverLogType.info,"update tournament ranks is in calculateRanks is - " + JSON.stringify(args));
	args.params.table.tournamentRules.ranks = args.params.table.tournamentRules.ranks.concat(args.ranksToInsert);
	serverLog(stateOfX.serverLogType.info,"updated tournament rules is in calculateRanks is - " + JSON.stringify(args.params.table.tournamentRules.ranks));
	cb(null, args);
};
/**
 * this function is used to updateTournamentUsers i.e. players in the current game and whose rank has been assigned
 * @method updateTournamentUsers
 * @param  {Object}       args  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var updateTournamentUsers = function(args, cb) {
  serverLog(stateOfX.serverLogType.info,"params in updateTournamentUsers is in calculateRanks is -  " + args.params);
  var tournamentId = args.params.table.tournamentRules.tournamentId;
  var gameVersionCount = args.params.table.gameVersionCount;
  serverLog(stateOfX.serverLogType.info,"tournamentId is in updateTournamentUsers in calculateRanks is -" + tournamentId);
  serverLog(stateOfX.serverLogType.info,"params.table.gameVersionCount is in updateTournamentUsers is in calculateRanks is -"+gameVersionCount);
  async.eachSeries(args.ranksToInsert, function(player, callback) {
    db.updateTournamentUser({playerId: player.playerId.toString(), tournamentId: tournamentId.toString(),gameVersionCount: gameVersionCount},{isActive: false}, function(err) {
      if(err) {
        cb({success: false, isRetry: false, isDisplay: false, channelId:'', info: popupTextManager.dbQyeryInfo.DB_ERROR_UPDATE_TOURNAMENTSTATE});
      }
      serverLog(stateOfX.serverLogType.info,"set successfully isActive false");
      callback();
    });
  }, function() {
    cb(null, args);
  });
};
/**
 * this function is used to insertRanksInDb 
 * @method insertRanksInDb
 * @param  {Object}       args  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var insertRanksInDb = function(args,cb) {
	serverLog(stateOfX.serverLogType.info,"in insertRanksInDb in calculateRanks is - "+JSON.stringify(args.ranksToInsert));
	// args.ranksToInsert.tournamentName = args.params.table.tournamentName;
	if(args.params.table.tournamentType != stateOfX.tournamentType.satelite) {
		db.insertRanks(args.ranksToInsert, function(err, ranks) {
			serverLog(stateOfX.serverLogType.info,"in insert ranks result is - " + ranks);
			if(err) {
				cb({success:false, isRetry: false, isDisplay: false, channelId:'', info: popupTextManager.dbQyeryInfo.DB_ERROR_INSERT_RANKS});
				//cb({success:false, info:"Error in insert ranks"});
			} else {
				serverLog(stateOfX.serverLogType.info,"rank inserted successfully");
				cb(null,args);
			}
		});
	} else {
		serverLog(stateOfX.serverLogType.info,"this is satellite tournament so not going to insert ranks here");
		cb(null, args);
	}
};
/**
 * this function is used to updateUserChips 
 * @method updateUserChips
 * @param  {Object}       args  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var updateUserChips = function(args,cb) {
  serverLog(stateOfX.serverLogType.info,"ranksToInsert is in updateUserChips is in calculateRanks is - "+JSON.stringify(args.ranksToInsert));
	serverLog(stateOfX.serverLogType.info,"args is in updateUserChips is in calculateRanks is - "+JSON.stringify(args));
  if(!args.params.table.tournamentRules.isGameRunning) {
    serverLog(stateOfX.serverLogType.info,"condition for first rank prize is in updateUserChips");
    args.params.table.tournamentRules.ranks.push(args.params.table.tournamentRules.winner);
  }
	var isRealMoney = args.params.table.isRealMoney;
	async.each(args.ranksToInsert, function(player, callback) {
		if(player.chipsWon > 0) {
			profileMgmt.addChips({isRealMoney: isRealMoney, playerId: player.playerId, chips:player.chipsWon}, function(result) {
				if(result.success) {
					serverLog(stateOfX.serverLogType.info,"player chips updated success - ");
					callback();
				} else {
					cb(result);
				}
			});
		} else {
			callback();
		}
	}, function(err) {
		if(err) {
			cb({success:false, isRetry: false, isDisplay: false, channelId:'', info: popupTextManager.dbQyeryInfo.DB_ERROR_UPDATE_PLAYER_CHIPS});
		} else {
			serverLog(stateOfX.serverLogType.info,"Exiting from updateUserChips successfully args is "+JSON.stringify(args));
			cb(null, args);
		}
	});
};
/**
 * this function is used to manageRanks
 * @method manageRanks
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
calculateRanks.manageRanks = function(params,playerWithNoChips, cb) {
	serverLog(stateOfX.serverLogType.info,"params are in manageRanks in calculateRanks are - "+JSON.stringify(params.table));
	serverLog(stateOfX.serverLogType.info,"playerWithNoChips are in manageRanks in calculateRanks are - "+JSON.stringify(playerWithNoChips));
	var args = {
		params 						: params,
		playerWithNoChips	: playerWithNoChips
	};
	args.ranksToInsert = [];
	args.playersWhoGotRanks = 0;
	async.waterfall([
		async.apply(findPlayersWhoGotRanks, args),
		getPrizeRule,
		processRanks,
		updateTournamentRules,
    updateTournamentUsers,
		insertRanksInDb,
		updateUserChips
		], function(err, result) {
			if(err) {
				serverLog(stateOfX.serverLogType.info,"In Error in async in manageRanksis in calculateRanks");
				cb(err);
			}
      serverLog(stateOfX.serverLogType.info,"In success in async in manageRanks in calculateRanks is result is - "+JSON.stringify(result));
      dynamicRanks.getRegisteredTournamentUsers(result.params.table.tournamentRules.tournamentId, result.params.table.gameVersionCount);
			cb({success:true, result: result.params});
	});
};
/**
 * this function is used to processRanksForNormalTournament
 * @method processRanksForNormalTournament
 * @param  {Object}       args  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var processRanksForNormalTournament = function(args, cb) {
	serverLog(stateOfX.serverLogType.info,"in processRanks in calculateRanks ----------"+JSON.stringify(args));
	var playerIt	 = 0;
	var prize 		 = 0;
	var lastRank   = args.enrolledPlayers - args.playersWhoGotRanks;
	var prizeMoney = args.params.table.tournamentRules.totalPlayer*args.params.table.tournamentRules.entryFees;
	serverLog(stateOfX.serverLogType.info,"last rank is in process ranks in calculateRanks is - ",lastRank);
	while(playerIt < args.playerWithNoChips.length) {
		var ranksObject = {},equalChipsCount = 1;
		//check if same onGameStartBuyIn value
		if((playerIt+1) < args.playerWithNoChips.length && args.playerWithNoChips[playerIt].onGameStartBuyIn === args.playerWithNoChips[playerIt+1].onGameStartBuyIn) {
			serverLog(stateOfX.serverLogType.info,"players chips are same is in process ranks identified");
			var tempPlayerIt = playerIt;
			var playerHavingEqualChips = findPlayersWhoHaveEqualChips(args,playerIt);
			serverLog(stateOfX.serverLogType.info,"player having equalChipsCount is in processRanks in calculateRanks is - "+JSON.stringify(playerHavingEqualChips));
			equalChipsCount = playerHavingEqualChips.equalChipsCount;
			playerIt = playerHavingEqualChips.playerIt;
			serverLog(stateOfX.serverLogType.info,"Equal chipa count and player it is in processRanks rank in calculateRanks is  - ",equalChipsCount,playerIt);
			var tempLastRank = lastRank;
			lastRank = lastRank - equalChipsCount +1;//Skip worst ranks is onStartBuyIn value are same;
			var tempFirstRank = lastRank;
			serverLog(stateOfX.serverLogType.info,"last ranks is in while in calculateRanks is -",tempFirstRank,tempLastRank);
			//Decide prizes indexes
			prize = calculatePrizeWhoHaveEqualChips(tempFirstRank,tempLastRank,args,prizeMoney);
			prize = Math.round(prize/equalChipsCount);
			serverLog(stateOfX.serverLogType.info,"calculated prize is - ",prize);
			prepareListWhoHaveEqualRanks(args,equalChipsCount,prize,lastRank,tempPlayerIt);
			// prepare ranks array
			lastRank--;
		} else {
			//This part execute when consecutive onStartBuy in are not same
			serverLog(stateOfX.serverLogType.info,"lastRank is in else in processRanks in calculateRanks is - ",lastRank);
			if(lastRank <= args.params.table.tournamentRules.prizeRule.length) {
				prize = args.params.table.tournamentRules.prizeRule[lastRank - 1].prizeMoney;
			}
			prepareListForNormalRanks(args,playerIt,prize,lastRank);
			lastRank--;
		}
		playerIt++;
		serverLog(stateOfX.serverLogType.info,"last rank and playerit in end in while in processRanks in calculateRanks is - ",lastRank,playerIt);
	}
  if(!args.params.table.tournamentRules.isGameRunning) {
    serverLog(stateOfX.serverLogType.info,"this is rank no. one--------------");
    var winnerPrize = args.params.table.tournamentRules.prizeRule[0].prizeMoney;
    serverLog(stateOfX.serverLogType.info,winnerPrize);
    pushWinner(args,args.params.table.tournamentRules.winner,winnerPrize);
  }
	cb(null, args);
};

/**
 * this function is used to process ranks if late registration is not allowed
 * @method playerWithNoChips
 * @param  {Object}       params,playerWithNoChips  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var ranksInWithoutLateRegistration = function(params, playerWithNoChips, cb) {
	serverLog(stateOfX.serverLogType.info,"in ranksInWithoutLateRegistration in calculateRanks");
	var args = {
		params 						: params,
		playerWithNoChips	: playerWithNoChips,
		ranksToInsert     : [],
		playersWhoGotRanks: 0
	};
	async.waterfall([
		async.apply(findPlayersWhoGotRanks,args),
		getPrizeRuleForNormalTournament,
		processRanksForNormalTournament,
		updateTournamentRules,
		updateTournamentUsers,
		insertRanksInDb,
		updateUserChips
	], function(err, result) {
		if(err) {
			serverLog(stateOfX.serverLogType.info,"In Error in async in manageRanksis in calculateRanks");
			cb(err);
		}
		serverLog(stateOfX.serverLogType.info,"In success in async in manageRanks in calculateRanks is result is - "+JSON.stringify(result));
		serverLog(stateOfX.serverLogType.info, "in ranksInWithoutLateRegistration inb console - " + JSON.stringify(result));
		dynamicRanks.getRegisteredTournamentUsers(result.params.table.tournamentRules.tournamentId, result.params.table.gameVersionCount);
		cb({success:true, result: result.params});
	});
};
/**
 * this function is used to processRanksForLateRegistration i.e. if late registration is allowed
 * @method playerWithNoChips
 * @param  {Object}       params,playerWithNoChips  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var processRanksForLateRegistration = function(args, cb) {
	serverLog(stateOfX.serverLogType.info,"in processRanksForLateRegistration");
	for(var playerIt=0; playerIt<args.playerWithNoChips.length;playerIt++) {
		args.ranksToInsert.push({
			playerId 						: args.playerWithNoChips[playerIt].playerId,
			tournamentId 				: args.params.table.tournamentRules.tournamentId,
			tournamentName 			: args.params.table.tournamentName,
	    gameVersionCount 		: args.params.table.gameVersionCount,
	    channelId    				: args.playerWithNoChips[playerIt].channelId,
	    chipsWon   				  : 0,
	    rank         				: 0,
	    isPrizeBroadcastSent: false,
	    userName 						: args.playerWithNoChips[playerIt].tournamentData.userName || args.playerWithNoChips[playerIt].playerName,
	    isCollected         : false,
			createdAt           : Number(new Date())
		});
	}
	cb(null,args);
};
/**
 * this function is used to find ranks , if late registration is allowed
 * @method playerWithNoChips
 * @param  {Object}       params,playerWithNoChips  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var ranksInWithLateRegistration = function(params, playerWithNoChips, cb) {
	serverLog(stateOfX.serverLogType.info,"in ranks with late registration");
	var args = {
		params 						: params,
		playerWithNoChips	: playerWithNoChips
	};
	args.ranksToInsert = [];
	async.waterfall([
		async.apply(processRanksForLateRegistration, args),
		updateTournamentRules,
    updateTournamentUsers,
		insertRanksInDb,
		], function(err, result) {
			if(err) {
				serverLog(stateOfX.serverLogType.info,"In Error in async in ranksInWithLateRegistration in calculateRanks");
				cb(err);
			}
      serverLog(stateOfX.serverLogType.info,"In success in async in ranksInWithLateRegistration in calculateRanks is result is - "+JSON.stringify(result));
      dynamicRanks.getRegisteredTournamentUsers(result.params.table.tournamentRules.tournamentId, result.params.table.gameVersionCount);
			cb({success:true, result: result.params});
	});
};


/**
 * this function is used for updating tournament room
 * @method updateTournamentRoom
 * @param  {Object}       data
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var updateTournamentRoom = function(data,cb) {
	if(!data.isGameRunning) {
		serverLog(stateOfX.serverLogType.info,"tournament is not running going to update tournament status");
	  db.updateTournamentGeneralize(data.params.table.tournamentRules.tournamentId,{isTournamentRunning: false,state: stateOfX.tournamentState.finished}, function(err, tournament) {
	    if(err || !tournament) {
	      cb({success: false, isRetry: false, isDisplay: true, channelId:'', info: popupTextManager.dbQyeryInfo.DB_TOURNAMENT_ROOM_NOTFOUND, isProcessNext: false});
//	      cb({success: false, info: "No tournament room found", isProcessNext: false});
	    } else {
	      data.tournamentRoom = tournament;
	      cb(null, data);
	    }
	  });
	} else {
		serverLog(stateOfX.serverLogType.info,"there is no need to update tournamentRoom");
		cb(null,data);
	}
};


/**
 * this function is used for getting tournament room
 * @method getTournamentRoom
 * @param  {Object}       data
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var getTournamentRoom = function(data,cb) {
	serverLog(stateOfX.serverLogType.info,"in getTournamentRoom for satellite tournament");
  db.getTournamentRoom(data.params.table.tournamentRules.tournamentId, function(err, tournament) {
    if(err || !tournament) {
      cb({success: false, isRetry: false, isDisplay: true, channelId:'', info: popupTextManager.dbQyeryInfo.DB_TOURNAMENT_ROOM_NOTFOUND, isProcessNext: false});
//      cb({success: false, info: "No tournament room found", isProcessNext: false});
    } else {
      data.tournamentRoom = tournament;
      if(!tournament.isTournamentRunning) {
      	serverLog(stateOfX.serverLogType.info,"tournament is not running from before");
      	data.playerWithNoChips = data.params.table.players; // calculate all player rank;
      	cb({success: false, isRetry: false, isDisplay: true, channelId:'', info: popupTextManager.dbQyeryInfo.DB_TOURNAMENT_NOT_RUNING, isProcessNext: true, playerWithNoChips: data.playerWithNoChips});
//      	cb({success: false, info:"tournament is not running",isProcessNext: true, playerWithNoChips: data.playerWithNoChips})
      } else {
      	serverLog(stateOfX.serverLogType.info,"tournament is running from before");
      	cb(null, data);
      }
    }
  });
};


/**
 * this function is used for counting the enrolled players
 * @method countEnrolledPlayers
 * @param  {Object}       data
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var countEnrolledPlayers = function(data, cb) {
	serverLog(stateOfX.serverLogType.info,"in countEnrolledPlayers for satellite tournament");
	db.countTournamentusers({gameVersionCount: data.params.table.gameVersionCount, tournamentId: data.params.table.tournamentRules.tournamentId}, function(err,count) {
    serverLog(stateOfX.serverLogType.info,"count is in countTournamentusers is - " + count);
    if(!err) {
    	data.enrolledPlayers = count;
			db.countTournamentusers({gameVersionCount: data.params.table.gameVersionCount, tournamentId: data.params.table.tournamentRules.tournamentId, isActive:false}, function(err,countInActivePlayers) {
    		if(!err) {
    			data.inActivePlayers = data.enrolledPlayers - countInActivePlayers;
    			cb(null,data);
    		} else {
    			cb({success: false, isRetry: false, isDisplay: true, channelId:'', info: popupTextManager.dbQyeryInfo.DB_ERROR_GETTING_INACTIVE_PLAYERS_TOURNAMENT, isProcessNext: false});
//    			cb({success: false, info: "Error in getting inActive players in tournament in calculate ranks",isProcessNext: false})
    		}
    	});
    	cb(null, data);
    } else {
    	cb({success: false, isRetry: false, isDisplay: true, channelId:'', info: popupTextManager.dbQyeryInfo.DB_ERROR_GETTING_ENROLLED_PLAYERS_TOURNAMENT, isProcessNext: false});
//    	cb({success: false, info: "Error in getting enrolled players in tournament in calculate ranks",isProcessNext: false})
    }
  });
};

// get prize rules from satellite
var getPrizeRuleForSatellite = function(data, cb) {
	serverLog(stateOfX.serverLogType.info,"in getPrizeRuleForSatellite for satellite tournament");
	serverLog(stateOfX.serverLogType.info,"tournamentId is in getPrizeRuleForSatellite is -  " + JSON.stringify(data.params.table.tournamentRules.tournamentId));
	db.findNormalPrizeRule(data.params.table.tournamentRules.tournamentId	, function(err,prizes) {
    serverLog(stateOfX.serverLogType.info,"prizes is in getPrizeRuleForSatellite is -  " + JSON.stringify(prizes));
    if(!err) {
    	data.prizeRule = prizes[0].prize;
    	data.prizeCount = prizes[0].prize.length;
    	cb(null, data);
    } else {
    	cb({success: false, isRetry: false, isDisplay: true, channelId:'', info: popupTextManager.dbQyeryInfo.DB_ERROR_GETTING_ENROLLED_PLAYERS_TOURNAMENT, isProcessNext: false});
//    	cb({success: false, info: "Error in getting enrolled players in tournament in calculate ranks",isProcessNext: false})
    }
  });
};

// get getAllActivePlayers
var getAllActivePlayers = function(data, cb) {
	serverLog(stateOfX.serverLogType.info,"in getAllActivePlayers for satellite tournament");
	imdb.findChannels({tournamentId: data.params.table.tournamentRules.tournamentId}, function(err, channels) {
   	serverLog(stateOfX.serverLogType.info,"channels is getting players for satelite tournament is - " + JSON.stringify(channels));
   	if(err) {
     cb({success: false, isRetry: false, isDisplay: false, channelId:'', info: popupTextManager.dbQyeryInfo.DB_ERROR_GETTING_TOURNAMENT_CHANNELS, isProcessNext: false});
//     cb({success: false, info: "Error in getting tournament channels",isProcessNext: false});
   	} else {
     	var playingPlayers = 0;
     	for(var i=0; i<channels.length; i++) {
     		serverLog(stateOfX.serverLogType.info,"players in current channle is " + JSON.stringify(channels[i].players));
     		playingPlayers += channels[i].players.length;
     	}
     	serverLog(stateOfX.serverLogType.info,"playingPlayers is in getPlayingPlayers on handleGameOver is before" + playingPlayers);
     	playingPlayers -= data.playerWithNoChips.length;
     	serverLog(stateOfX.serverLogType.info,"playerWithNoChips is in getPlayingPlayers on handleGameOver is before" + JSON.stringify(data.playerWithNoChips));
     	serverLog(stateOfX.serverLogType.info,"playingPlayers is in getPlayingPlayers on handleGameOver is after " + playingPlayers);
     	data.playingPlayers = playingPlayers;
     	cb(null, data);
   	}
 	});
};

var decideTournamentStatus = function(data, cb) {
	serverLog(stateOfX.serverLogType.info,"in processRanks for satellite tournament" + JSON.stringify(data));
	if(data.playingPlayers < data.prizeCount) {
		data.isGameRunning = false;
		data.params.table.isTournamentRunning = false;
		data.playerWithNoChips = data.params.table.players; // calculate all players ranks
	} else {
		data.isGameRunning = true;
	}
	cb(null, data);
};

var processRanksForSatellite = function(params, playerWithNoChips, cb) {
	serverLog(stateOfX.serverLogType.info,"in processRanks for satellite tournament");
	var data = {
		params : params,
		playerWithNoChips : playerWithNoChips
	};
	async.waterfall([
		async.apply(getTournamentRoom, data),
		countEnrolledPlayers,
		getPrizeRuleForSatellite,
		getAllActivePlayers,
		decideTournamentStatus,
		updateTournamentRoom
	], function(err, response) {
		if(err) {
			if(err.isProcessNext) {
				cb({success: true, params : params, isGameRunning : data.isGameRunning,isGameEndFromBefore: true, playerWithNoChips: err.playerWithNoChips});
			} else {
				cb(err);
			}
		} else {
			serverLog(stateOfX.serverLogType.info,"in processRanks for satellite tournament response is - " + JSON.stringify(response));
			cb({
				success: true,
				params : response.params,
				isGameRunning : response.isGameRunning,
				isGameEndFromBefore: false,
				prizeRule: response.prizeRule,
				enrolledPlayers : response.enrolledPlayers,
				playingPlayers : response.playingPlayers,
				playersWhoGotRanks : response.inActivePlayers,
				playerWithNoChips: response.playerWithNoChips
			});
		}
	});
};

var preparePrizeListInSatellite = function(table) {
	serverLog(stateOfX.serverLogType.info,"table is in preparePrizeListInSatellite " + JSON.stringify(table));
	var prizeArray = [];
	for(var playerIt=0; playerIt<table.players.length;playerIt++) {
		prizeArray.push({
			playerId 						: table.players[playerIt].playerId,
			tournamentId 				: table.tournamentRules.tournamentId,
			tournamentName 			: table.tournamentName,
	    gameVersionCount 		: table.gameVersionCount,
	    channelId    				: table.channelId,
	    chipsWon   				  : 0,
	    ticketsWon          : 1,
	    isPrizeBroadcastSent: false,
	    userName 						: table.players[playerIt].tournamentData.userName || table.players[playerIt].playerName,
	    isCollected         : false,
			createdAt           : Number(new Date())
		});
	}
	serverLog(stateOfX.serverLogType.info,"prizeArray is in preparePrizeListInSatellite " + JSON.stringify(prizeArray));
	return prizeArray;
};

var decideRankBasedOnDealer = function(tempPlayers, currentRank, table, prizeRule) {
	var ranks = [];
	var playersBasedOnDealer = table.players;
	serverLog(stateOfX.serverLogType.info,"playersBasedOnDealer is - " + JSON.stringify(playersBasedOnDealer));
	serverLog(stateOfX.serverLogType.info,"dealer indexe is - " + JSON.stringify(table.dealerIndex));
	var playersBeforeDealer = playersBasedOnDealer.slice(0,table.dealerIndex+1);
	serverLog(stateOfX.serverLogType.info,"playersBeforeDealer is - " + JSON.stringify(playersBeforeDealer));
	var playerAfterDealer = playersBasedOnDealer.slice(table.dealerIndex+1);
	serverLog(stateOfX.serverLogType.info,"playerAfterDealer is - " + JSON.stringify(playerAfterDealer));
	playerAfterDealer = playerAfterDealer.concat(playersBeforeDealer);
	// playersBeforeDealer.concat(playersBasedOnDealer);
	playersBasedOnDealer = playerAfterDealer;
	serverLog(stateOfX.serverLogType.info,"playersBasedOnDealer is - " + JSON.stringify(playersBasedOnDealer));
	// insert indexForRank is in tempPlayers
	for(var i=0; i<tempPlayers.length; i++) {
		for(var j=0;j<playersBasedOnDealer.length;j++) {
			if(tempPlayers[i].playerId === playersBasedOnDealer[j].playerId) {
				serverLog(stateOfX.serverLogType.info,"player id found and index is - " + j);
				tempPlayers[i].indexForRank = j;
				break;
			}
		}
	}
	serverLog(stateOfX.serverLogType.info,"tempPlayers after inserting index is - " + JSON.stringify(tempPlayers));
	tempPlayers = _.sortBy(tempPlayers,"indexForRank");
	for(var i=0; i<tempPlayers.length; i++) {
		var rank = currentRank--;
		ranks.push({
			playerId 						: tempPlayers[i].playerId,
			tournamentId 				: table.tournamentRules.tournamentId,
			tournamentName 			: table.tournamentName,
	    gameVersionCount 		: table.gameVersionCount,
	    channelId    				: table.channelId,
	    chipsWon   				  : (!!prizeRule[rank-1] && prizeRule[rank-1].prizeType === "chips") ? prizeRule[rank-1].prizeMoney : 0,
	    rank                : rank,
	    ticketsWon          : (!!prizeRule[rank-1] && prizeRule[rank-1].prizeType === "ticket") ? 1 : -1 ,
	    isPrizeBroadcastSent: false,
	    userName 						: tempPlayers[i].tournamentData.userName || tempPlayers[i].playerName,
	    isCollected         : false,
			createdAt           : Number(new Date())
		});
	}
	serverLog(stateOfX.serverLogType.info,"ranks is in decideRankBasedOnDealer - " + JSON.stringify(ranks));
	return ranks;
};

var calculateRanksForFirstTimeInSatellite = function(data) {
	serverLog(stateOfX.serverLogType.info,"table is in calculateRanksForFirtTimeInSatellite " + JSON.stringify(data));
	var outOfMoneyPlayers = [];
	var activePlayers = [];
	for(var i=0;i<data.playerWithNoChips.length;i++) {
		if(data.playerWithNoChips[i].state === stateOfX.playerState.outOfMoney) {
			outOfMoneyPlayers.push(data.playerWithNoChips[i]);
		} else {
			activePlayers.push(data.playerWithNoChips[i]);
		}
	}
	outOfMoneyPlayers = _.sortBy(outOfMoneyPlayers,"onGameStartBuyIn");
	activePlayers     = _.sortBy(activePlayers,"onGameStartBuyIn");

	serverLog(stateOfX.serverLogType.info,"outOfMoneyPlayers after sorting onGameStartBuyIn is - " + JSON.stringify(outOfMoneyPlayers));
	serverLog(stateOfX.serverLogType.info,"activePlayers after sorting onGameStartBuyIn is - " + JSON.stringify(activePlayers));

	serverLog(stateOfX.serverLogType.info,"playerWithNoChips after sorting onGameStartBuyIn is - " + JSON.stringify(data.playerWithNoChips));
	var currentRank = data.playersWhoGotRanks;
	var calculatedRanks = [];
	for(var k=0;k<2;k++) {
		serverLog(stateOfX.serverLogType.info,"calculatedRanks is in calculateRanksForFirtTimeInSatellite " + k + JSON.stringify(calculatedRanks));
		if(k==0) {
			data.playerWithNoChips = outOfMoneyPlayers;
			serverLog(stateOfX.serverLogType.info,"playerWithNoChips after sorting onGameStartBuyIn is in loop k==0- " + JSON.stringify(data.playerWithNoChips));
		}
		if(k==1) {

			data.playerWithNoChips = activePlayers;
			serverLog(stateOfX.serverLogType.info,"playerWithNoChips after sorting onGameStartBuyIn is in loop k==1- " + JSON.stringify(data.playerWithNoChips));
		}
		if(data.playerWithNoChips.length>1) {
			serverLog(stateOfX.serverLogType.info,"player with no chips length is greater than 1");
			for(var i=0; i<data.playerWithNoChips.length;) {
				if(i<data.playerWithNoChips.length-1 && data.playerWithNoChips[i].onGameStartBuyIn ===  data.playerWithNoChips[i+1].onGameStartBuyIn) {
					var tempPlayers = [];
					while (data.playerWithNoChips[i].onGameStartBuyIn === data.playerWithNoChips[i+1].onGameStartBuyIn) {
						console.log('iiiiiiiiiiiiiiiiiiiiiiiiiii');
						tempPlayers.push(data.playerWithNoChips[i]);
						i++;
						console.log('i ',i);
						console.log('data.playerWithNoChips-1',data.playerWithNoChips.length-1);
						if(i>=data.playerWithNoChips.length-1) {
							console.log('break from loop');
							tempPlayers.push(data.playerWithNoChips[i]);
							i++;
							break;
						}
					}
					serverLog(stateOfX.serverLogType.info,"tempPlayers is in calculateRanksForFirtTimeInSatellite " + JSON.stringify(tempPlayers));
					calculatedRanks = calculatedRanks.concat(decideRankBasedOnDealer(tempPlayers,currentRank,data.params.table,data.prizeRule));
					currentRank -= tempPlayers.length;
					serverLog(stateOfX.serverLogType.info,"calculatedRanks is in calculateRanksForFirtTimeInSatellite " + JSON.stringify(calculatedRanks));
				} else {
					var rank = currentRank--;
					serverLog(stateOfX.serverLogType.info,"calculatedRanks when calculating ranks alone " + JSON.stringify(calculatedRanks));
					calculatedRanks.push({
						playerId 						: data.playerWithNoChips[i].playerId,
						tournamentId 				: data.params.table.tournamentRules.tournamentId,
						tournamentName 			: data.params.table.tournamentName,
				    gameVersionCount 		: data.params.table.gameVersionCount,
				    channelId    				: data.params.table.channelId,
				    chipsWon   				  : (!!data.prizeRule[rank-1] && data.prizeRule[rank-1].prizeType === "chips") ? data.prizeRule[rank-1].prizeMoney : 0,
				    rank                : rank,
				    ticketsWon          : (!!data.prizeRule[rank-1] && data.prizeRule[rank-1].prizeType === "ticket") ? 1 : -1 ,
				    isPrizeBroadcastSent: false,
				    userName 						: data.playerWithNoChips[i].tournamentData.userName || data.playerWithNoChips[i].playerName,
				    isCollected         : false,
						createdAt           : Number(new Date())
					});
					i++;
				}
			}
		} else {
			serverLog(stateOfX.serverLogType.info,"data.playerWithNoChips.length === 1");
			var rank = currentRank--;
			calculatedRanks.push({
				playerId 						: data.playerWithNoChips[0].playerId,
				tournamentId 				: data.params.table.tournamentRules.tournamentId,
				tournamentName 			: data.params.table.tournamentName,
		    gameVersionCount 		: data.params.table.gameVersionCount,
		    channelId    				: data.params.table.channelId,
		    chipsWon   				  : (!!data.prizeRule[rank-1] && data.prizeRule[rank-1].prizeType === "chips") ? data.prizeRule[rank-1].prizeMoney : 0,
		    rank                : rank,
		    ticketsWon          : (!!data.prizeRule[rank-1] && data.prizeRule[rank-1].prizeType === "ticket") ? 1 : -1 ,
		    isPrizeBroadcastSent: false,
		    userName 						: data.playerWithNoChips[0].tournamentData.userName || data.playerWithNoChips[0].playerName,
		    isCollected         : false,
				createdAt           : Number(new Date())
			});
		}
	}

	data.playerWithNoChips = outOfMoneyPlayers.concat(activePlayers);
	serverLog(stateOfX.serverLogType.info,"calculatedRanks is in calculateRanksForFirtTimeInSatellite " + JSON.stringify(calculatedRanks));
	return calculatedRanks;
};

var splitArrayForTicketAndChips = function(prizeArray, prizeRule) {
	serverLog(stateOfX.serverLogType.info,"prize array and prize rule is in splitArrayForTicketAndChips are -  " + JSON.stringify(prizeArray) + JSON.stringify(prizeRule));
	var i=0;
	if(prizeArray[i].rank === prizeRule.length) {
		prizeArray[i].chipsWon = prizeRule[rank-1].prizeMoney;
		i++;
	}

	serverLog(stateOfX.serverLogType.info,"tempPrize in calculateRanks is before - " + JSON.stringify(prizeArray) + i);
	// tempPrize[i-1].chipsWon = prizeRule[i-1].prizeMoney;
	for(;i<prizeArray.length;i++) {
		prizeArray[i].ticketsWon = 1;
		// tempPrize.push(prizeArray[i]);
	}
	serverLog(stateOfX.serverLogType.info,"tempPrize in calculateRanks is after " + JSON.stringify(prizeArray));
	return prizeArray;
};

var decideRankInSatellite = function(data ,cb) {
	serverLog(stateOfX.serverLogType.info,"params is in decideRankInSatellite in calculateRanks is " + JSON.stringify(data));
	var prizeArray;
	if(data.isGameEndFromBefore) {
		prizeArray = preparePrizeListInSatellite(data.params.table);
		data.params.table.tournamentRules.ranks = data.params.table.tournamentRules.ranks.concat(prizeArray);
	} else {
		prizeArray = calculateRanksForFirstTimeInSatellite(data);
		serverLog(stateOfX.serverLogType.info,"prizeArray is in decideRankInSatellite in calculateRanks is " + JSON.stringify(prizeArray));
		//var tempPrize = splitArrayForTicketAndChips(prizeArray,data.prizeRule);
		//serverLog(stateOfX.serverLogType.info,"tempPrize is in decideRankInSatellite in calculateRanks is " + JSON.stringify(tempPrize));
		data.params.table.tournamentRules.ranks = data.params.table.tournamentRules.ranks.concat(prizeArray);
	}
	serverLog(stateOfX.serverLogType.info,"return data is in decideRankInSatellite in calculateRanks is " + JSON.stringify(data));
	cb(data);
};
/**
 * this function is used to manageRanksForNormalTournament
 * @method manageRanksForNormalTournament
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
calculateRanks.manageRanksForNormalTournament = function(params, playerWithNoChips,cb) {
	serverLog(stateOfX.serverLogType.info,"table is in manageRanksForNormalTournament in calculateRanks is " + JSON.stringify(params.table));
	serverLog(stateOfX.serverLogType.info,"playerWithNoChips is in manageRanksForNormalTournament in calculateRanks is "+JSON.stringify(playerWithNoChips));
	var tempDecisionTime1 = params.table.tournamentStartTime;
  var tempDecisionTime2 = params.table.tournamentStartTime;
  serverLog(stateOfX.serverLogType.info,'lateRegistrationAllowed - ' + params.table.lateRegistrationAllowed);
  serverLog(stateOfX.serverLogType.info,'lateRegistrationTime - ' + params.table.lateRegistrationTime);
  if(params.table.lateRegistrationAllowed) {
  	serverLog(stateOfX.serverLogType.info,'late registeration is allowed');
    tempDecisionTime1 += params.table.lateRegistrationTime*60000;
  }
  if(params.table.isRebuyAllowed) {
  	serverLog(stateOfX.serverLogType.info,'rebuy is allowed');
    tempDecisionTime2 += params.table.rebuyTime*60000;
  }
  serverLog(stateOfX.serverLogType.info,'tempDecisionTime1 - ' + tempDecisionTime1);
  serverLog(stateOfX.serverLogType.info,'tempDecisionTime2 - ' + tempDecisionTime2);
	var timeForHoldRanks =(tempDecisionTime2>tempDecisionTime1) ? tempDecisionTime2: tempDecisionTime1;
	serverLog(stateOfX.serverLogType.info,"time for hold rank is - " + timeForHoldRanks);
	var lateRegistrationTimeOver = Number(new Date()) > timeForHoldRanks;
	serverLog(stateOfX.serverLogType.info,"time for hold rank is in console is - " + timeForHoldRanks);
	serverLog(stateOfX.serverLogType.info,"lateRegistrationTimeOver - " + lateRegistrationTimeOver);
	if(!lateRegistrationTimeOver) {
		ranksInWithLateRegistration(params,playerWithNoChips,function(response) {
			cb(response);
		});
	} else {
		if(params.table.tournamentType === stateOfX.tournamentType.satelite) { // If tournament is satellite
			processRanksForSatellite(params, playerWithNoChips, function(processRanksForSatelliteResponse) {
				serverLog(stateOfX.serverLogType.info,"reponse of processRanksForSatellite - " + JSON.stringify(processRanksForSatelliteResponse));
				if(processRanksForSatelliteResponse.success) {
					if(processRanksForSatelliteResponse.isGameRunning) { // If game is in running mode call normal rank rule
						ranksInWithoutLateRegistration(params, playerWithNoChips,function(response){
							cb(response);
						});
					} else {
						var data = {
							params 							: processRanksForSatelliteResponse.params,
							playerWithNoChips 	: processRanksForSatelliteResponse.playerWithNoChips,
							isGameEndFromBefore : processRanksForSatelliteResponse.isGameEndFromBefore,
							prizeRule 					: processRanksForSatelliteResponse.prizeRule || [],
							enrolledPlayers 		: processRanksForSatelliteResponse.enrolledPlayers,
							playingPlayers      : processRanksForSatelliteResponse.playingPlayers || 0,
							playersWhoGotRanks  : processRanksForSatelliteResponse.playersWhoGotRanks
						};
						decideRankInSatellite(data, function(decideRankInSatelliteResponse) {
							serverLog(stateOfX.serverLogType.info,"response of decideRankInSatelliteResponse - " + JSON.stringify(decideRankInSatelliteResponse));
							cb({success: true, result: decideRankInSatelliteResponse.params});
						});
					}
				} else {
					cb(processRanksForSatelliteResponse);
				}
			});
		} else {
			ranksInWithoutLateRegistration(params, playerWithNoChips,function(response){
				cb(response);
			});
		}
	}
};

module.exports = calculateRanks;
