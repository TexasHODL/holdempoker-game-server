/*
 * File: scheduleExpiryManager.js
 * Project: PokerSD
 * File Created: 2017-07-27 12:33:48
 * Author: sushiljainam
 * -----
 * Last Modified: Friday, 30th August 2019 1:39:47 pm
 * Modified By: digvijay (digvijay.singh@pokersd.com)
 */

/*jshint node: true */
"use strict";

var async = require("async");
var db = require("../../../../shared/model/dbQuery");
var logDB = require("../../../../shared/model/logDbQuery");
var financeDb = require("../../../../shared/model/financeDbQuery.js");
const adminDB = require('../../../../shared/model/adminDbQuery.js');
var _ = require('underscore');
var ObjectID = require('mongodb').ObjectID;
const randomize = require('randomatic');
const pomelo = require('pomelo');
const configConstants = require('../../../../shared/configConstants');
module.exports = function (app) {
	return new ExpiryManager(app);
};

function ExpiryManager(app) {
	this.app = app;
}

function fixedDecimal(number, precisionValue) {
	let precision = precisionValue ? precisionValue : 2;
	return Number(Number(number).toFixed(precision));
}

/**
 * get list of users registered from db
 * @method getUsers
 */
var getUsers = function (params, cb) {
	db.findUsersOpts({ isBot: false }, { fields: { 'playerId': 1, 'userName': 1, 'realChips': 1, 'statistics.megaPoints': 1, 'statistics.megaPointLevel': 1, 'statistics.handsWonRM': 1, 'statistics.handsPlayedRM': 1 } }, function (err, result) {
		if (err) {
			cb(err);
		} else {
			params.users = result;
			cb(null, params);
		}
	});
};

/**
 * run for each user - save keys from profile to logdb - as snapshot
 * @method forEveryUser
 */
var forEveryUser = function (params, cb) {
	async.each(params.users, function (user, ecb) {
		// save some keys in logDB
		logDB.genericQuery('playerArchive', 'insert', [{ timestamp: params.timestamp, playerId: user.playerId, userName: user.userName, realChips: user.realChips, megaPoints: user.statistics.megaPoints, megaPointLevel: user.statistics.megaPointLevel, handsWon: user.statistics.handsWonRM, handsPlayed: user.statistics.handsPlayedRM }], function (err, res) {
			// console.log("savePlayerKeys-forEveryUser-playerArchive-insert", err, res);
			ecb(null, params);
		});
	}, function (err, params) {
		cb(err, params);
	});
};

/**
 * create specially formatted timestamp
 * and save some keys from player profile
 * @method savePlayerKeys
 */
var savePlayerKeys = function () {
	var t = new Date();
	t.setDate(t.getDate() - 1);
	t.setHours(23);
	t.setMinutes(59);
	t.setSeconds(59);
	var timestamp = parseInt(Number(t) / 1000) * 1000;

	async.waterfall([
		async.apply(getUsers, { timestamp: timestamp }),
		forEveryUser], function (err, params) {
			// console.log('done - savePlayerKeys - midnight')
		});
};


/**
 * execute list of midnight works - cron job
 * @method midnightWorks
 */
ExpiryManager.prototype.midnightWorks = function () {
	console.log("cron job - midnightWorks");
	savePlayerKeys();
};

/**
 * This method gets the expired slots whose expire time is less than the current Time of execution.
 * 
 * @method getExpiryCrossedSlots
 * @param {Object} params Empty Object
 * @param {Function} cb Callback as reponse to other function
 */
const getExpiryCrossedSlots = (params, cb) => {
	var currentTime = Number(new Date());
	db.findExpirySlots({ expireStatus: 0, expireAt: { $lt: currentTime } }, function (err, res) {
		console.log(err);
		console.log(res);
		if (err || !res) {
			cb("Error while fetching expiry slots");
		} else {
			if (res instanceof Array && res.length > 0) {
				// there are some who need new counting slots
				params.slotsList = res;
				cb(null, params);
				return;
			} else {
				cb(null, { success: true, info: 'No one is going to loose Locked bonus tonight, so yes WORK DONE!' });
				return;
			}
		}
	});
};

const getAllLoyalityLevels = (params, cb) => {
	adminDB.findAllMegaPointLevels({}, function (err, res) {
		console.log('response of findAllMegaPointLevels' + err + " " + res);
		if (err || !res || res.length <= 0) {
			cb("megaPoints list not found");
			return;
		} else {
			params.allLevels = res;
			cb(null, params);
			return;
		}
	});
};

/**
 * This method gets the specific bonus data of the player from bonus collection.
 * 
 * @mathod getPlayerBonusData
 * @param {Object} slot Slot data of bonus which is in processing
 * @param {Object} params Slot data array and other
 * @param {Function} cb Callback as reponse to other function
 */
const getPlayerBonusData = (slot, params, cb) => {
	console.log("Inside get player bonus data for this slot");
	const query = {};
	query.playerId = slot.playerId;
	query.uniqueId = slot.uniqueId;
	db.findBonusDataWithUniqueId(query, function (err, result) {
		if (err) {
			cb('Error occurred while fetching bonus details');
		} else {
			if (!!result) {
				// bonus Data found to process
				console.log("bonus data" + JSON.stringify(result));
				slot.bonusData = (_.where(result.bonus, { uniqueId: slot.uniqueId }))[0];
				console.log("slot bonus" + JSON.stringify(slot.bonusData));
				cb(null, slot, params);
			} else {
				// No bonus Data to process
				cb("No Bonus Data to process");
			}
		}
	});
};

/**
 * This method gets the player info and attach it with the slot. Main keys and value we need further are
 * vip points, vip level and count for vip.
 * 
 * @param {Object} slot slot data of bonus
 * @param {Object} params Slots array and other info
 * @param {Function} cb Callback Function
 */
const getPlayerDetails = (slot, params, cb) => {
	console.log("inside get player details");
	const query = {};
	query.playerId = slot.playerId;
	db.findUser(query, function (err, player) {
		if (err) {
			slot.playerInfo = false;
			cb(null, slot, params);
		} else {
			slot.playerInfo = player;
			cb(null, slot, params);
		}
	});
};

/**
 * This method return either the boolean value false or the Object containing value of the new levelId.
 * When level is not going to change return false, Otherwise new level.
 * 
 * @param {Object} levels Array of Objects of vip level
 * @param {Number} levelId Level Id of the player
 * @param {Number} oldPoints Old VIP Points of the player
 * @param {Number} subPoints The points which is going to be subtracted
 */
function checkThresholdCrossed(levels, levelId, oldPoints, subPoints) { // Boolean
	// levels are / should be - SORTED by threshold
	console.log("here check threshold crossed for level change");
	var tmp = oldPoints - subPoints;
	var tmpLevelId = calculateLevelIdForPoints(levels, tmp);
	console.log("levelTemp Id--", tmpLevelId, levelId);
	if (levelId == tmpLevelId) {
		return false;   // level not changed
	}
	return { value: tmpLevelId }; // new level
}

/**
 * This method returns the Vip level on the basis of the Vip points.
 * 
 * @param {Array} levels Array of object of vip level
 * @param {Number} p vip points
 */
function calculateLevelIdForPoints(levels, p) {
	for (var i = 0; i < levels.length; i++) {
		if (p < levels[i].levelThreshold) {
			return (levels[i - 1] || levels[0]).levelId;
		}
	}
	return levels[levels.length - 1].levelId;
}

/**
 * This method is used to check if bonus amount will be released or expired.
 * Check player count of vip is greter or equal to lockedBonusAmount.
 * 
 * @param {Object} slot Slot data and playerInfo
 * @param {Object} params Slots array and other data
 * @param {Function} cb Callback function
 */
const checkIfAvailableToClaim = (slot, params, cb) => {
	console.log("inside the method check claim/release possible");
	if (slot.playerInfo && slot.playerInfo.statistics.countPointsForBonus >= slot.lockedBonusAmount) {
		slot.isClaim = true; // Release
		slot.levelChange = checkThresholdCrossed(params.allLevels, slot.playerInfo.statistics.megaPointLevel, slot.playerInfo.statistics.megaPoints, slot.lockedBonusAmount); // Boolean
		cb(null, slot, params);
	} else {
		slot.isClaim = false; // Expire
		cb(null, slot, params);
	}
};

const addChipsPlayerRelease = (slot, params, cb) => {
	console.log("inside add chips in player account");
	if (slot.isClaim) {
		const chipsData = { fundTransferAmount: slot.bonusData.unClaimedBonus };
		db.updateUserBalance(chipsData, slot.playerId, function (err, playerUpdateResult) {
			if (err) {
				cb('Player account updation failed');
			} else {
				//create passbook entry
				createPassbookEntry(slot);
				cb(null, slot, params);
			}
		});
	} else {
		cb(null, slot, params);
	}
};

const createPassbookEntry = (params) => {
	const query = { playerId: params.playerId };
	const passbookData = {};
	passbookData.time = Number(new Date());
	passbookData.prevAmt = params.playerInfo.realChips + params.playerInfo.instantBonusAmount;
	passbookData.amount = params.lockedBonusAmount;
	passbookData.newAmt = params.playerInfo.realChips + params.playerInfo.instantBonusAmount + params.lockedBonusAmount;
	passbookData.category = "Bonus Released";
	passbookData.subCategory = "Locked Bonus";
	adminDB.createPassbookEntry(query, passbookData, function (err, result) {
		console.log("Passbook entry created for claimed locked bonus");
	});
};

/**
 * This method update the bonus data to expired.
 * 
 * @method updatePlayerBonusData
 * @param {Object} slot currently procesibg slot object
 * @param {Object} params Slot data object and other
 * @param {Function} cb Callback as reponse to other function
 */
const updatePlayerBonusData = (slot, params, cb) => {
	console.log("Inside expire bonus data");
	const query = {};
	query["bonus.uniqueId"] = slot.uniqueId;
	query.playerId = slot.playerId;
	const updateData = {};
	updateData["bonus.$.expireStatus"] = slot.isClaim ? 2 : 1;
	updateData["bonus.$.unClaimedBonus"] = 0;
	updateData["bonus.$.expiredAmt"] = slot.isClaim ? 0 : slot.bonusData.unClaimedBonus;
	updateData["bonus.$.claimedBonus"] = slot.isClaim ? slot.bonusData.unClaimedBonus : 0;
	db.updateBounsDataSetKeys(query, updateData, function (err, result) {
		if (err) {
			//fr se error
			console.error("Slot data not expired" + JSON.stringify(slot));
			cb("Error while expiring this Slot");
		} else {
			//expire ho gye bhai
			slot.prevUnclaimed = 0;
			db.findUserBonusDetails({ playerId: slot.playerInfo.playerId }, function (err, bonusResult) {
				if (!err && bonusResult != null) {
					for (let i = 0; i < bonusResult.bonus.length; i++) {
						slot.prevUnclaimed += bonusResult.bonus[i].unClaimedBonus;
					}
					cb(null, slot, params);
				} else {
					cb(null, slot, params);
				}
			});
		}
	});
};

/**
 * This method add the expired amount in balance sheet visible in accounts.
 * 
 * @method updateBalanceSheet
 * @param {Object} slot currently procesibg slot object
 * @param {Object} params Slot data object and other
 * @param {Function} cb Callback as reponse to other function
 */
const updateBalanceSheet = (slot, params, cb) => {
	console.log("add amount in balance sheet lockedBonusExpiredAmt");
	let query = {};
	if (slot.isClaim) { // Release or claim
		query = { $inc: { lockedBonusReleased: slot.bonusData.unClaimedBonus } };
	} else {	//Expired
		query = { $inc: { lockedBonusExpiredAmt: slot.bonusData.unClaimedBonus } };
	}
	financeDb.updateBalanceSheet(query, function (err, result) {
		if (err) {
			cb("Error while updating balance sheet");
		} else {
			cb(null, slot, params);
		}
	});
};

const updatePlayerStats = (slot, params, cb) => {
	if(slot.isClaim){
		const query = { playerId: slot.playerId };
		const updateData = {};
		updateData['statistics.megaPoints'] = slot.playerInfo.statistics.megaPoints - slot.bonusData.unClaimedBonus;
		updateData['statistics.countPointsForBonus'] = slot.playerInfo.statistics.countPointsForBonus - slot.bonusData.unClaimedBonus;
		if (slot.levelChange) {
			updateData['statistics.megaPointLevel'] = slot.levelChange.value;
		}
		db.findAndModifyUser(query, updateData, function (err, updatedStats) {
			if (err) {
				cb('Error in updating vip points');
			} else {
				cb(null, slot, params);
			}
		});
	} else{
		cb(null, slot, params);
	}
};

function getLevelName(levelId, levels) {
	var t = _.findWhere(levels, { levelId: levelId }) || levels[0];
	return t.loyaltyLevel;
}

/**
 * This method update the status of expiration in schedule Expiry collection.
 * 
 * @method updateSlotStatusExpired
 * @param {Object} slot currently procesibg slot object
 * @param {Object} params Slot data object and other
 * @param {Function} cb Callback as reponse to other function
 */
const updateSlotStatusExpired = (slot, params, cb) => {
	console.log("inside update slot status" + JSON.stringify(slot));
	const query = { _id: ObjectID(slot._id) };
	let dataToUpdate = {};
	if (slot.isClaim) {
		dataToUpdate.expireStatus = 2;
		dataToUpdate.prevVipPoints = slot.playerInfo.statistics.megaPoints;
		dataToUpdate.newVipPoints = slot.playerInfo.statistics.megaPoints - slot.bonusData.unClaimedBonus;
		dataToUpdate.prevVipLevel = getLevelName(slot.playerInfo.statistics.megaPointLevel, params.allLevels);
		dataToUpdate.releasedTime = Number(new Date());
		dataToUpdate.refrenceNumber = randomize('A0', 8);
		if (slot.levelChange) {
			dataToUpdate.newVipLevel = getLevelName(slot.levelChange.value, params.allLevels);
		} else {
			dataToUpdate.newVipLevel = getLevelName(slot.playerInfo.statistics.megaPointLevel, params.allLevels);
		}
	} else {
		dataToUpdate.expireStatus = 1;
	}
	db.updateExpirySlot(query, { $set: dataToUpdate }, function (err, result) {
		if (err) {
			cb("Slot updation failed");
		} else {
			cb(null, slot, params);
		}
	});
};

const broadcastPlayerData = (slot, params, cb) => {
	console.log("slot data"+ JSON.stringify(slot));
	const broadcastData = {};
	broadcastData.playerId = slot.playerInfo.playerId;
	if(slot.isClaim){
		broadcastData.realChips = slot.playerInfo.realChips + slot.playerInfo.instantBonusAmount + slot.bonusData.unClaimedBonus;
		broadcastData.unclamedBonus = slot.prevUnclaimed;
		broadcastData.megaPoints = slot.playerInfo.statistics.megaPoints - slot.bonusData.unClaimedBonus;
		if (slot.levelChange) {
			broadcastData.megaPointLevel = getLevelName(slot.levelChange.value, params.allLevels);
		}
		broadcastData.megaPointsPercent = getLevelPercent((slot.playerInfo.statistics.megaPoints - slot.bonusData.unClaimedBonus), params.allLevels);
	}else{
		broadcastData.unclamedBonus = slot.prevUnclaimed;
	}
	const playerData = cashGamesChangedData(broadcastData);
	pomelo.app.rpc.connector.sessionRemote.broadcastPlayer("",{data: playerData, route: 'updateProfile', playerId: slot.playerInfo.playerId}, function(responseBroadcast){
		console.log("responseBroadcast");
	});
	cb(null, slot, params);
};

const sendMailMessagesToPlayer = (slot, params, cb) => {
	console.log("inside sendMailMessagesToPlayer slot data "+ JSON.stringify(slot));
	var mailData,msg,messageData;
	if(slot.isClaim){
		console.log("locked Bonus has released going to send mail");
		mailData = {};
		mailData.userName = slot.playerInfo.userName;
        mailData.claimedAmount = slot.bonusData.unClaimedBonus;
        mailData.vipPointsDeducted = slot.bonusData.unClaimedBonus;
        mailData.previousChips = fixedDecimal((slot.playerInfo.realChips + slot.playerInfo.instantBonusAmount), 2);
        mailData.updatedChips = fixedDecimal((slot.playerInfo.realChips + slot.playerInfo.instantBonusAmount + slot.bonusData.unClaimedBonus), 2);
        mailData.playerPrevVipPoints = fixedDecimal(slot.playerInfo.statistics.megaPoints, 4);
        mailData.playerNewVipPoints = fixedDecimal((slot.playerInfo.statistics.megaPoints - slot.bonusData.unClaimedBonus), 4);
        mailData.to_email = slot.playerInfo.emailId;
        mailData.from_email = configConstants.from_email;
        mailData.subject = 'Congratulations , PokerSD Locked Bonus Claimed';
        mailData.template = 'lockedBonusClaimed';
        mailData.playerPrevVipLevel = getLevelName(slot.playerInfo.statistics.megaPointLevel, params.allLevels);
        if (slot.levelChange) {
			mailData.playerNewVipLevel = getLevelName(slot.levelChange.value, params.allLevels);
		}else{
        mailData.playerNewVipLevel = mailData.playerPrevVipLevel;
		}
		msg = "Dear " +slot.playerInfo.userName + ",\n"+ "Congratulations!! You have unlocked " + slot.bonusData.unClaimedBonus +" real chips and the chips has been credited to your PokerSD account.";
		messageData = {
        	mobileNumber: '91' + slot.playerInfo.mobileNumber,
        	msg: msg
    	};
	}else{
		console.log("locked Bonus has expired going to send mail");
		mailData = {
			userName : slot.playerInfo.userName,
			lockedBonus : slot.bonusData.unClaimedBonus,
			creditedDate : new Date(slot.createdAt + (330 * 60 * 1000)).toLocaleString(),
			expiredDate : new Date(slot.expireAt + (330 * 60 * 1000)).toLocaleString(),
			to_email : slot.playerInfo.emailId,
			from_email : configConstants.from_email,
			subject : 'PokerMoogley Locked Bonus Expired',
			template : 'lockedBonusExpired'
		};
		msg = "Dear " +slot.playerInfo.userName + ",\n"+ "Your locked bonus of " + slot.bonusData.unClaimedBonus +" credited on " + new Date(slot.createdAt + (330 * 60 * 1000)).toLocaleString() + " has expired due to insufficient VIP points, the last date to accumulate the required VIP points was " + new Date(slot.expireAt + (330 * 60 * 1000)).toLocaleString();
		messageData = {
        	mobileNumber: '91' + slot.playerInfo.mobileNumber,
        	msg: msg
    	};	
	}

	sendBonusExpiredOrReleaseMail(mailData);
	sendBonusExpiredOrReleaseMessage(messageData);
	cb(null, slot, params);
};

/**
 * method used to send mail to player while locked bonus released or transfer
 * @method sendBonusExpiredOrReleaseMail
 * @author Naman Jain(naman.jain@pokersd.com)
 * @date   2019-09-12
 * @param  {Object}                      params [description]
 * @param  {Function}                    cb     [description]
 * @return {[type]}                             [description]
 */
const sendBonusExpiredOrReleaseMail = function(params){
	pomelo.app.rpc.connector.adminManagerRemote.sendMailToPlayers("", params, function (bonusMailResponse) {
		console.log("mail response-->", bonusMailResponse);
    });
};

/**
 * method used to send locked bonus release or expired message to players
 * @method sendBonusExpiredOrReleaseMessage
 * @author Naman Jain(naman.jain@pokersd.com)
 * @date   2019-09-12
 * @param  {Object}                         params [description]
 * @return {[type]}                                [description]
 */
const sendBonusExpiredOrReleaseMessage = function(params){
	pomelo.app.rpc.connector.adminManagerRemote.sendMsgToPlayers("", params, function (bonusMessageResponse) {
		console.log("message response-->", bonusMessageResponse);
    });
};

const cashGamesChangedData = (data) => {
	if (data.realChips && data.megaPointLevel){
		return {
			'updated': {
				'realChips': data.realChips,
				'unclamedBonus': data.unclamedBonus,
				'megaPoints': data.megaPoints,
				'megaPointsPercent': data.megaPointsPercent,
				'megaPointLevel': data.megaPointLevel
			},
			'playerId': data.playerId,
			'event': 'REALCHIPSUPDATE'
		};
	}else if(data.realChips){
		return {
			'updated': {
				'realChips': data.realChips,
				'unclamedBonus': data.unclamedBonus,
				'megaPoints': data.megaPoints,
				'megaPointsPercent': data.megaPointsPercent
			},
			'playerId': data.playerId,
			'event': 'REALCHIPSUPDATE'
		};
	}else{
		return {
			'updated': {
				'unclamedBonus': data.unclamedBonus
			},
			'playerId': data.playerId,
			'event': 'REALCHIPSUPDATE'
		};
	}
};

function getLevelPercent(points, levels) {
	if (points <= 0) {
		return 0;
	}
	if (levels.length <= 0) {
		return 0;
	}
	if (levels.length > 0) {
		function calculator(arr, value) {
			for (var i = 0; i < arr.length; i++) {
				if (arr[i].levelThreshold > value) { // levelThreshold is min value of range
					break;
				}
			}
			if (i >= arr.length) {
				return 101; // any value > 100 to represent highest level
			}
			return (100 * (value - arr[i - 1].levelThreshold) / (arr[i].levelThreshold - arr[i - 1].levelThreshold));
		}
		var c = calculator(levels, points);
		c = Math.floor(c * 100) / 100; // limiting decimal places
		return (c || 0);
	}
}

/**
 * This method process every slot which i sin the list for expiring the Locked bonus
 * 
 * @method forEverySlot
 * @author Digvijay Singh
 * @param {Object} params The parameters contains the slot list array which are going to expire
 * @param {Function} cb Callback as reponse to other function
 */
const forEverySlot = (params, cb) => {
	console.log("params-" + JSON.stringify(params));
	if (params.success) {
		// kaam pura hua, no slots to process
		cb(null, params);
	} else {
		// process further to expire slots
		async.eachSeries(params.slotsList, function (slot, ecb) {
			async.waterfall([
				async.apply(getPlayerBonusData, slot, params),
				getPlayerDetails,
				checkIfAvailableToClaim,
				addChipsPlayerRelease,
				updatePlayerBonusData,
				updateBalanceSheet,
				updatePlayerStats,
				updateSlotStatusExpired,
				broadcastPlayerData,
				sendMailMessagesToPlayer
			], function (err, slot, params) {
				// body...
				ecb(err, params);
			});
		}, function (err, params) {
			// body...
			cb(err, params);
		});
	}
};

/**
 * This method process the expiry of Locked Bonus
 * @method processBonusExpiry
 * @author Digvijay Singh
 */
const processBonusExpiry = () => {
	console.log("Bonus Expiry process started");
	async.waterfall([
		async.apply(getExpiryCrossedSlots, {}),
		getAllLoyalityLevels,
		forEverySlot
	], function (err, result) {
		if (err) {
			console.trace(err);
		} else {
			console.log("Bonus Expiration successfully completed");
		}
	});
};

/**
 * This method is used to expire the locked bonus Amount
 * @method	expireBonus
 * @author Digvijay Singh
 */
ExpiryManager.prototype.scheduledBonusExpiry = function () {
	console.log("cron job - to expire locked bonus");
	processBonusExpiry();
};