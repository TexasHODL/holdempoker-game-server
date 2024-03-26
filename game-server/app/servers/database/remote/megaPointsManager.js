/*
* @Author: sushiljainam
* @Date:   2017-07-26 12:45:24
* @Last Modified by:   digvijay
* @Last Modified time: 2019-08-28 13:39:58
*/

/*jshint node: true */
"use strict";

var async = require("async");
var _ = require("underscore");
var stateOfX = require("../../../../shared/stateOfX");
var adminDB = require("../../../../shared/model/adminDbQuery");
var db = require("../../../../shared/model/dbQuery");
var userRemote = require("./userRemote");
var leaderboardPoints = require("./leaderboardPoints.js");
const configConstants = require('../../../../shared/configConstants');
var accumulationFactor = 1;


// Create data for log generation
function serverLog(type, log) {
	var logObject = {};
	logObject.fileName = 'megaPointsManager';
	logObject.serverName = stateOfX.serverType.database;
	logObject.type = type;
	logObject.log = log;
	console.log(logObject);
}

var megaPointsMngr = {};

/**
 * fetch VIP/loyality levels from db
 * @method getLevels
 * @author Digvijay Singh
 * @date   2019-03-14
 * @param  {Object}   params [description]
 * @param  {Function} cb     [description]
 */
var getLevels = function (params, cb) {
	serverLog(stateOfX.serverLogType.info, 'in megaPointsManager in getLevels');
	// one of two methods - 
	/// somewhere in app variable
	/// db query to adminDB
	adminDB.findAllMegaPointLevels({}, function (err, res) {
		serverLog(stateOfX.serverLogType.info, 'response of findAllMegaPointLevels' + err + " " + res);
		if (err || !res) {
			cb({ success: false, info: "db - query failed.- findAllMegaPointLevels" });
			return;
		} else {
			if (res.length <= 0) {
				params.allLevels = [];
				cb(null, params);
				return;
			} else {
				params.allLevels = res;
				cb(null, params);
				return;
			}
		}
	});
};

/**
 * Find the leaderboard specific data needed to process further.
 * @param {Object} params Object containing data of loyality levels and player game data
 * @param {Function} cb callback as response to next function
 */
const getRespectiveLeaderboardData = (params, cb) => {
	console.log("get leaderboard " + JSON.stringify(params));
	const query = {};
	query.status = "Running";
	query.endTime = {$gte: Number(new Date())};
	query["tables._id"] = params.players[0].channelId;
	query.leaderboardType = { $in: ["closedVip", "closedHand", "openHand", "openVip"] };
	console.log("query" + JSON.stringify(query));
	//find leaderboard which is closed VIP , in Running state and this table is in that leaderboard
	adminDB.listLeaderboard(query, function (err, leaderboardResult) {
		console.trace("leaderboard found data", err, leaderboardResult);
		if (!err && leaderboardResult.length > 0) {	// if leaderboard Found
			params.leaderboardFound = true;
			params.leaderboardData = leaderboardResult;
			cb(null, params);
		} else {
			params.leaderboardFound = false;
			cb(null, params);
		}
	});
};

// fetch user profile
// some keys related to megapoints
var getProfileData = function (player, params, cb) {
	console.log("Inside megaPointsManager getProfileData function");
	db.findUser({ playerId: player.playerId }, function (err, user) {
		if (err || !user) {
			cb({ info: 'find user failed' });
		} else {
			player.userName = user.userName;
			player.instantBonusAmount = user.instantBonusAmount;
			player.megaPointLevel = user.statistics.megaPointLevel || 1; // 1-Bronze
			player.megaPoints = user.statistics.megaPoints || 0;
			player.countPointsToChips = user.statistics.countPointsToChips || 0;
			player.countPointsForBonus = user.statistics.countPointsForBonus || 0;
			player.createdAt = user.createdAt || Number(new Date());
			player.realChipsPrev = user.realChips + user.instantBonusAmount;
			player.parentName = user.isParentUserName;
			cb(null, player, params);
		}
	});
};

// calculate megapoints in this game
// and accordingly, check if various threshold crossed
// - megapoint level change
// - award chips 1000 crossed
// - award bonus 100 crossed
var calculateMegaPoints = function (player, params, cb) {
	console.log("inside calculateMegaPoints function in MegaPointsManager");
	player.addMegaPoints = (player.rakeAmount1 * getPercent(params.allLevels, player.megaPointLevel) * accumulationFactor) / 100;
	player.levelChange = checkThresholdCrossed(params.allLevels, player.megaPointLevel, player.megaPoints, player.addMegaPoints); // Boolean
	console.log("inside calculate MegaPoints--" + player);
	cb(null, player, params);
};

/**
 * This method stores the data of the Vip points accumulated by the player.
 * @method storeAccumulationData
 * @author Digvijay Singh
 * @date   2019-05-09
 * @param  {Object}              player player data in the object
 * @param  {Object}              params other request data
 * @param  {Function}            cb     callback to next function
 */
var storeAccumulationData = function (player, params, cb) {
	// console.log("Going to store accumulation Data of VIP points player "+ player);
	var data = {
		date: Number(new Date()),
		userName: player.userName,
		playerId: player.playerId,
		rakeAmount: player.rakeAmount1,
		megaPointLevel: player.megaPointLevel,
		megaPoints: player.megaPoints,
		earnedPoints: player.addMegaPoints,
		channelName: player.channelName,
		channelId: player.channelId
	};
	db.insertVIPAccumulation(data, function (err, result) {
		console.log("Error and Result while storing VIP accumulation data", err, result);
		cb(null, player, params);
	});
};

/**
 * Increase megaPoints accumulated in megaPoints and countForBonus by addMegaPoints amount.
 * @method awardPointsInProfile
 * @author Digvijay Singh
 * @date   2019-03-14
 * @param  {[type]}             player player specific data
 * @param  {Object}             params query object
 * @param  {Function}           cb     callback function as response
 */
var awardPointsInProfile = function (player, params, cb) {
	console.log("inside award megapointsin player profile");
	userRemote.updateStats({ playerId: player.playerId, data: { "statistics.megaPoints": player.addMegaPoints, "statistics.countPointsForBonus": player.addMegaPoints }, bySystem: true }, function (res) {
		serverLog(stateOfX.serverLogType.info, 'done megaPoints count--- userRemote.updateStats' + JSON.stringify(res));
		cb(null, player, params);
	});
};


/**
 * update megapoint level in user profile if changed
 * @method updateLevelInProfile
 * @author Digvijay Singh
 * @date   2019-03-14
 * @param  {[type]}             player [description]
 * @param  {Object}             params [description]
 * @param  {Function}           cb     [description]
 */
var updateLevelInProfile = function (player, params, cb) {
	console.log("inside update loyality/ vip level in player profile" + player.levelChange);
	var t = player.levelChange;
	if (t) {
		var newLevelId = t.value;
		db.findAndModifyUser({ playerId: player.playerId }, { "statistics.megaPointLevel": newLevelId }, function (err, doc) {
			//			console.log('======---===---==--==', err, doc);
			cb(null, player, params);
			return; // mandatory return
		});
	} else {
		cb(null, player, params);
	}
};



/**
 * addLeaderboardDataForPlayer
 * This method add the leaderboard data of the player in the participant collection if necessary(condition fulfilled).
 * @param {Object} player Player data for which we are going to process
 * @param {Object} params Whole Object containing all the data like leaderboardData, playerBonusList, participantDoc
 * @param {Function} cb Callback as response to next function
 */
const addLeaderboardDataForPlayer = (player, params, cb) => {
	if(params.leaderboardFound){
		// if leaderboards found process further
		console.log("leaderboard data for player"+ player.userName);
		leaderboardPoints.addPlayerLeaderboardPoints(player, params, function(err, player, params){
			cb(null, player, params);
		});
	}else{
		cb(null, player, params);
	}
};

// update megapoints for every contributor in game
// and update other counter and values
var forEveryPlayer = function (params, cb) {
	console.log("here in forEveryPlayer function--" + JSON.stringify(params));
	// return false;
	async.each(params.players, function (player, ecb) {
		console.log("Rewarding megaPoints for player--" + player);
		async.waterfall([
			async.apply(getProfileData, player, params),
			calculateMegaPoints,
			storeAccumulationData,
			awardPointsInProfile,
			updateLevelInProfile,
			addLeaderboardDataForPlayer
		], function (err, player) {
			ecb(null);
		});
	}, function (err) {
		cb(err, params);
	});
};


/**
 * [incMegaPoints description]
 * @method incMegaPoints
 * @param  {Object}      params [description]
 * @param  {Function}    cb     callback, optional
 */
megaPointsMngr.incMegaPoints = function (params, cb) {
	console.error("here inmegapoints inc");
	console.trace("\nin increase megaPoints--", params);
	console.log("\n\nStringify" + JSON.parse(JSON.stringify(params)));
	params.players = JSON.parse(JSON.stringify(params.players));
	async.waterfall([
		async.apply(getLevels, params),
		getRespectiveLeaderboardData,
		forEveryPlayer
	], function (err, params) {
		serverLog(stateOfX.serverLogType.info, 'in megaPointsManager in incMegaPoints- response');
		// pass data in cb for broadcast
		if (cb instanceof Function) {
			cb(err, params);
		}
	});
};


// get percent completion of megapoint level according to player's megapoints
megaPointsMngr.getPercentOfLevel = function (data, cb) {
	if (data.points <= 0) {
		return cb({ percentOfLevel: 0, megaPointLevel: 'Bronze' });
	}

	getLevels({}, function (err, params) {
		if (err || !params) {
			// return cb(err);
			return cb(null);
		}
		if (params.allLevels.length <= 0) {
			return cb({ percentOfLevel: 0, megaPointLevel: 'Bronze' });
		}
		if (params.allLevels.length > 0) {
			function calculator(arr, value) {
				for (var i = 0; i < arr.length; i++) {
					if (arr[i].levelThreshold > value) { // levelThreshold is min value of range
						break;
					}
				}
				if (i >= arr.length) {
					return [101, 'Platinum']; // any value > 100 to represent highest level
				}
				return [(100 * (value - arr[i - 1].levelThreshold) / (arr[i].levelThreshold - arr[i - 1].levelThreshold)), arr[i - 1].loyaltyLevel];
			}
			var c = calculator(params.allLevels, data.points);
			var label = c[1];
			c = Math.floor(c[0] * 100) / 100; // limiting decimal places
			return cb({ percentOfLevel: c || 0, megaPointLevel: label || 'Bronze' });
		}
	});
};

//---------------
//get percent reward of megapoint level by levelId
function getPercent(arr, levelId) {
	console.log('getPercent of the level', arr, levelId, _.findWhere(arr, { levelId: levelId }));
	var t = _.findWhere(arr, { levelId: levelId }) || arr[0];
	return t.percentReward || 4;
}

/**
 * generic function to check if particular threshold crossed
 * @method checkThresholdCrossed
 * @param  {Array }              levels    list of megapoint levels
 * @param  {Number}              levelId   old level id
 * @param  {Number}              oldPoints old megapoints
 * @param  {Number}              addPoints megapoints to be added
 * @return {Number}                        new levelId
 */
function checkThresholdCrossed(levels, levelId, oldPoints, addPoints) { // Boolean
	// levels are / should be - SORTED by threshold
	console.log("here check threshold crossed for level change");
	var tmp = oldPoints + addPoints;
	var tmpLevelId = calculateLevelIdForPoints(levels, tmp);
	console.log("levelTemp Id--", tmpLevelId, levelId);
	if (levelId == tmpLevelId) {
		return false;
	}
	return { value: tmpLevelId }; // new level
}

/**
 * to check if some limit crossed
 * e.g. 
 * 100, 75, 175
 * - limit will be crossed 2 times (250)
 * @method checkCountCrossed
 * @param  {Number}          limit     limit, imagine like b of (a modulus b)
 * @param  {Number}          oldPoints old value
 * @param  {Number}          addPoints value to add
 * @return {Number}                    how many times the new sum has crossed the limit
 */
function checkCountCrossed(limit, oldPoints, addPoints) {
	// count of 'how many times this limit has been crossed by Sum'
	console.log("Check count crossed for bonus", Math.floor((oldPoints + addPoints) / limit));
	return Math.floor((oldPoints + addPoints) / limit);
}


// calculate LevelId For megapoints
// @method calculateLevelIdForPoints
function calculateLevelIdForPoints(levels, p) {
	for (var i = 0; i < levels.length; i++) {
		if (p < levels[i].levelThreshold) {
			return (levels[i - 1] || levels[0]).levelId;
		}
	}
	return levels[levels.length - 1].levelId;
}

/**
 * addTimeStamp 
 * this function also round off to midnight time
 * @method addTimeStamp
 * @param  {Number}     start    time in milliseconds
 * @param  {Object}     duration duration object - {unit: 'string', value: number}
 */
function addTimeStamp(start, duration) {
	var d = new Date(start);
	d.setHours(0);
	d.setMinutes(0);
	d.setSeconds(0);
	d.setMilliseconds(0);
	return Number(d) + (1000 * durationToSeconds(duration));
}

/**
 * convert duration to seconds
 *
 * @private
 * @method durationToSeconds
 * @param  {Object}        durObj   contains unit, value: {unit: 'day', value: 2}
 * @return {Number}                 seconds in that duration : 5154655615
 */
function durationToSeconds(durObj) {
	// suggestion: convert to lowercase
	switch (durObj.unit) {
		case 'day':
		case 'days':
			return durObj.value * 86400;
			break;
		case 'month':
		case 'months':
			return durObj.value * 86400 * 30;
			break;
		case 'year':
		case 'years':
			return durObj.value * 86400 * 30 * 12;
			break;
		default:
			return durObj.value * 86400;
			break;
	}
}

/**
 * adjust bonus from unClaimedBonus to claimedBonus if available
 * @method updateBonus
 * @param  {Object}    data list of bonuses for player
 * @param  {Number}    amt  bonus amount that is claimed
 * @return {Number}         remaining bonus amount which could not be claimed due to low bonus
 */
function updateBonus(data, amt) {
	if (data.bonus instanceof Array) {
		if (data.bonus.length > 0) {
			for (var i = 0; i < data.bonus.length; i++) {
				if (data.bonus[i].unClaimedBonus > 0) {
					if (data.bonus[i].unClaimedBonus > amt) {
						data.bonus[i].unClaimedBonus -= amt;
						data.bonus[i].claimedBonus += amt;
						amt -= amt;
					} else {
						var t = data.bonus[i].unClaimedBonus;
						data.bonus[i].unClaimedBonus -= t;
						data.bonus[i].claimedBonus += t;
						amt -= t;
					}
				}
			}
		}
	}
	return amt;
}

// prepare next/new slot data
// when previous slot ends counting
function createSlotData(player, levels) {
	var bt = player.createdAt; // begin time
	var d = new Date(bt);
	d.setHours(0);
	d.setMinutes(0);
	d.setSeconds(0);
	d.setMilliseconds(0);
	bt = Number(d);
	var ct = Number(new Date()); // current time
	var msMonth = 2592000000; // 1000*60*60*24*30 - milliseconds in a 30 days (day of 24 hours)
	var et = bt + msMonth * (Math.floor((ct - bt) / msMonth));
	// et will be the starting of current counting month for this player

	// now create slot data
	var t = _.findWhere(levels, { levelId: player.megaPointLevel }) || levels[0];
	var slotData = {
		playerId: player.playerId,
		points: 0,
		countingEndsAt: addTimeStamp(et, configConstants.mp.countingTime),
		expiresAt: addTimeStamp(et, { 'value': t.expiryPeriod || configConstants.mp.expireTime, 'unit': 'months' }),
		expireStatus: 0 // 0-scheduled; 1-expired; 2-cancelled
	};
	return slotData;
}

module.exports = megaPointsMngr;
