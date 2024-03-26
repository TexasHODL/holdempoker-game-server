/*
* @Author: sushiljainam
* @Date:   2017-07-14 15:56:47
* @Last Modified by:   digvijay
* @Last Modified time: 2019-03-14 11:16:59
*/

/*jshint node: true */
"use strict";


var db = require("../../../../shared/model/dbQuery");
var zmqPublish = require("../../../../shared/infoPublisher");
var stateOfX = require("../../../../shared/stateOfX");

// Create data for log generation
function serverLog (type, log) {
  var logObject          = {};
  logObject.fileName     = 'userRemote';
  logObject.serverName   = stateOfX.serverType.database;
  // logObject.functionName = arguments.callee.caller.name.toString();
  logObject.type         = type;
  logObject.log          = log;
  zmqPublish.sendLogMessage(logObject);
}

var userRmt = {};
// module.exports = function (app) {
// 	return new UserRemote(app);
// }

// function UserRemote(app) {
// 	this.app = app;
// }

// update player win, lose stats
userRmt.updateStats = function(data, cb) {
	var query = getPlayerIdsQuery(data);
	var updateData = data.data; // verify keys
	serverLog(stateOfX.serverLogType.info, 'query'+ JSON.stringify(query)+ JSON.stringify(updateData));
	if(!query){
		return serverLog(stateOfX.serverLogType.info, 'not doing this query '+ JSON.stringify(query));
	}
	db.increaseUserStats(query, updateData, function (err, res) {
		if (err) {
			return cb({success: false, info: err});
		} else {
			return cb({success: true, result: res});
		}
	});
};

// some tasks done after user first time created  - (Deprectaed) 29Aug Digvj
// register| inorganic player creation
// userRmt.afterUserCreated = function(userData) {
// 	var data = {
// 		playerId: userData.playerId,
// 		createdAt: userData.createdAt,
// 		level: userData.statistics.megaPointLevel
// 	};
// 	var megaPointsManager = require('./megaPointsManager');
// 	megaPointsManager.createFirstExpirySlot(data);
// };

// CASHIER API - get chips related details for a player
userRmt.getCashDetails = function(data, cb) {
	var megaPointsManager = require('./megaPointsManager');
	db.findUser({playerId: data.playerId}, function (err, user) {
		if (err || !user) {
			// failed
			cb({success: false, info: 'failed - find user query'});
		} else {
			db.findBounsData({playerId: data.playerId}, function (err, bonusList){
				if (err || !bonusList) {
					// failed
					cb({success: false, info: 'failed - bonus data query'});
				} else {
					var bonuses = totalBonuses(bonusList.bonus);
					var result = {
						userName: user.userName,
						emailId: user.emailId,
						realChips: user.instantBonusAmount ? user.realChips + user.instantBonusAmount : user.realChips,
						inGameRealChips: 0, // pending - done in entryhandler
						totalRealChips: user.realChips,
						withdrawableChips: user.realChips,
						instantBonusAmount : user.instantBonusAmount,
						tourChips: 0,
						inGAmeTourChips: 0,
						totalTourChips: 0,
						freeChips: user.freeChips,
						inGameFreeChips: 0, // pending - done in entryhandler
						totalFreeChips: user.freeChips,
						unClaimedMegaBonus: bonuses[0] ||0,
						claimedMegaBonus: bonuses[1] ||0,
						megaPoints: parseInt(user.statistics.megaPoints ||0),
						megaPointLevel: user.statistics.megaPointLevel || 'Bronze',
						totalMegaChipsClaimed: user.statistics.megaChipsGainedTotal ||0,
						percentOfLevel: 0
					};
					megaPointsManager.getPercentOfLevel({points: user.statistics.megaPoints}, function (response) {
						if (response) {
							result.percentOfLevel = response.percentOfLevel;
							result.megaPointLevel = response.megaPointLevel;
						}
						cb({success: true, result: result});
					});
				}
			});
		}
	});
};

// --------- local functions are down this line -----------

// prepare a query for one or more players
function getPlayerIdsQuery(obj) {
	// generate {playerId: '123'} OR
	// {playerId: {$in : ['123', '2331', '34234']}}
	if (obj.playerIds instanceof Array) {
		if (obj.playerIds.length<=0) {
			return false;
		}
		return {playerId: {$in: obj.playerIds}};
	}
	if (!obj.playerId) {
		return false;
	}
	return {playerId: obj.playerId};
}

// sum of player bonus amount
function totalBonuses(arr) {
	var u = 0, c = 0;
	if(!(arr instanceof Array)){
		return [u, c];
	}
	for (var i = 0; i < arr.length; i++) {
		u += arr[i].unClaimedBonus || 0;
		c += arr[i].claimedBonus || 0;
	}
	return [u, c];
}

module.exports = userRmt;
