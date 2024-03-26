/*jshint node: true */
"use strict";


var MongoClient = require('mongodb').MongoClient,
    assert = require('assert'),
    ObjectID = require('mongodb').ObjectID,
    stateOfX = require("../stateOfX"),
    zmqPublish = require("../infoPublisher.js"),
    mongodb = require('../mongodbConnection')
var postData = require('../postData.js');
const configConstants = require('./../configConstants')

var pomelo = require('pomelo');
var remote = {};

// Create data for log generation
function serverLog(type, log) {
    var logObject = {};
    logObject.fileName = 'dbQuery';
    logObject.serverName = stateOfX.serverType.shared;
    // logObject.functionName  = arguments.callee.caller.name.toString();
    logObject.type = type;
    logObject.log = log;
    zmqPublish.sendLogMessage(logObject);
}

/*balance sheet query starts here*/

remote.getPlayerTotalRealOrInstantChipsAvailable = function (query, callback) {
    mongodb.db.collection('users').aggregate([{ $match: query }, { $group: { _id: "_id", totalPlayerInstantChips: { $sum: "$instantBonusAmount" }, totalPlayerRealChips: { $sum: "$realChips" } } }]).toArray(function (err, result) {
        callback(err, result);
    });
};
/*balance sheet query ends here*/
remote.updatePlayerInstantChips = function (query, updateDoc, callback) {
    mongodb.db.collection('users').updateOne(query, updateDoc, { upsert: false }, function (err, result) {
        mongodb.db.collection('users').findOne(query, function (err1, result1) {
            callback(err, result1);
        });
        
    });
};

remote.findUser = function (filter, callback) {
    mongodb.db.collection('users').findOne(filter, function (err, result) {
        callback(err, result);
    });
};


remote.findUserDetails = function (filter, callback) {
    mongodb.db.collection('users').findOne(filter, { projection: { playerId: 1, userName: 1, isParentUserName: 1, realChips: 1, instantBonusAmount: 1, claimedInstantBonus: 1 } }, function (err, result) {
        callback(err, result);
    });
};

remote.getPlayerBankDetail = function (filter, callback) {
    mongodb.db.collection('palyerBankDetails').findOne(filter, function (err, result) {
        console.log("Inside getPlayerBankDetails db query err,result", err, result);
        callback(err, result);
    });
};
remote.findUsersOpts = function (filter, opts, callback) {
    mongodb.db.collection('users').find(filter, opts).toArray(function (err, result) {
        callback(err, result);
    });
};

remote.findMobileNumber = function (filter, callback) {
    mongodb.db.collection('mobileOtp').findOne(filter, function (err, result) {
        callback(err, result);
    });
};

remote.createMobileNumber = function (mobileData, callback) {
    mongodb.db.collection('mobileOtp').insert(mobileData, function (err, result) {
        callback(err, result.ops[0]);
    });
};

remote.updateMobileNumberOtp = function (mobileData, callback) {
    console.log("^^^^^^^^^^^^^^^", mobileData.otpObject);
    mongodb.db.collection('mobileOtp').update({ '_id': mobileData.otpObject.id }, {
        $set: {
            otp: mobileData.otpObject.otp,
            createdAt: mobileData.otpObject.createdAt,
            countryCode: mobileData.otpObject.countryCode
        }
    }, function (err, result) {
        console.log(result);
        callback(err, result);
    });
};

remote.findUserArray = function (userIds, callback) {
    console.log("in findUserArray filter is ", userIds);
    mongodb.db.collection('users').find({ playerId: { $in: userIds } }).toArray(function (err, result) {
        console.log("result in findUserArray ", JSON.stringify(result));
        callback(err, result);
    });
};

remote.findPlayerFromBounty = function (playerIds, callback) {
    console.log("in findUserArray filter is ", playerIds);
    mongodb.db.collection('bounty').find({ playerId: { $in: playerIds } }).toArray(function (err, result) {
        console.log("result in findUserArray ", JSON.stringify(result));
        callback(err, result);
    });
};

remote.findUserOrOperation = function (filter, callback) {
    console.log("filter is", filter);
    mongodb.db.collection('users').findOne({ userName: filter.userName }, function (err, result) {
        callback(err, result);
    });
};

remote.createUser = function (userData, callback) {
    mongodb.db.collection('users').insert(userData, function (err, result) {
        if(err) console.log(err)
        callback(err, result?.ops[0]);
    });
};

// Generate query to get any value of a key
remote.getUserKeyValue = function (filter, key, callback) {
    key = key.toString();
    mongodb.db.collection('users').findOne(filter, { [key]: 1 }, function (err, result) {
        callback(err, result);
    });
};

// FIX - play money to real money - DONE // was doubt if chips are negative
remote.deductRealChips = function (filter, chips, callback) {
    var instantBonusAmount = 0;
    if (filter.instantBonusAmount) {
        instantBonusAmount = filter.instantBonusAmount;
        delete filter.instantBonusAmount;
    }
    mongodb.db.collection('users').findOneAndUpdate(filter, { $inc: { realChips: -chips, instantBonusAmount: -instantBonusAmount } }, { new: true, returnOriginal: false }, function (err, result) {
        callback(err, result);
    });
};

remote.deductFreeChips = function (filter, chips, callback) {
    mongodb.db.collection('users').findOneAndUpdate(filter, { $inc: { freeChips: -chips } }, { new: true, returnOriginal: false }, function (err, result) {
        callback(err, result);
    });
};

// FIX - play money to real money - DONE // was doubt - the obvius, MUCH used
remote.addRealChips = function (filter, chips, callback) {
    // console.log("filter--"+ JSON.stringify(filter));
    // console.log("chips--"+ chips);
    var instantIBA = 0;
    if (filter.instantBonusAmount >= 0) {
        instantIBA = filter.instantBonusAmount;
        delete filter.instantBonusAmount;
    }
    console.log("filter--" + JSON.stringify(filter) + "chips--" + chips + "instantbonus-" + instantIBA);
    mongodb.db.collection('users').findOneAndUpdate(filter, { $inc: { realChips: chips, instantBonusAmount: instantIBA } }, { new: true, returnOriginal: false }, function (err, result) {
        callback(err, result);
    });
};

remote.addChipsInPlayerDeposit = function (filter, chips, callback) {
    mongodb.db.collection('users').update(filter, { $inc: { 'chipsManagement.deposit': chips } }, function (err, result) {
        callback(err, result);
    });
};
// FIX - play money to real money - DONE // was doubt - has real chips in name
remote.returnRealChipsToPlayer = function (filter, update, callback) {
    mongodb.db.collection('users').update(filter, update, function (err, result) {
        callback(err, result);
    });
};

remote.addFreeChips = function (filter, chips, callback) {
    serverLog(stateOfX.serverLogType.info, "in addFreeChips dbQuery" + JSON.stringify(filter));
    serverLog(stateOfX.serverLogType.info, "chips" + chips);
    mongodb.db.collection('users').update(filter, { $inc: { freeChips: chips } }, function (err, result) {
        serverLog(stateOfX.serverLogType.error, "err: " + JSON.stringify(err));
        callback(err, result);
    });
};

remote.addFreeChipsToMultiplePlayers = function (playerIds, chips, callback) {
    serverLog(stateOfX.serverLogType.info, "in add free chips to multiple players - ", JSON.stringify(playerIds), chips);
    mongodb.db.collection('users').update({ playerId: { $in: playerIds } }, { $inc: { freeChips: chips } }, function (err, result) {
        callback(err, result);
    });
};

// FIX - play money to real money - DONE // was doubt - a little
remote.addRealChipsToMultiplePlayers = function (playerIds, chips, callback) {
    serverLog(stateOfX.serverLogType.info, "in add real chips to multiple players - ", JSON.stringify(playerIds), chips);
    mongodb.db.collection('users').update({ playerId: { $in: playerIds } }, { $inc: { realChips: chips } }, function (err, result) {
        callback(err, result);
    });
};

remote.addFavourateSeat = function (playerId, favourateSeat, callback) {
    mongodb.db.collection('users').update({ 'playerId': playerId }, {
        $push: {
            favourateSeat: {
                $each: [favourateSeat],
                $sort: { createdAt: -1 }
            }
        }
    }, function (err, result) {
        callback(err, result);
    });
};

remote.removeFavourateSeat = function (playerId, channelId, callback) {
    mongodb.db.collection('users').update({ 'playerId': playerId }, {
        $pull: {
            favourateSeat: {
                channelId: channelId
            }
        }
    }, function (err, result) {
        callback(err, result);
    });
};


remote.addFavourateTable = function (playerId, favTableData, callback) {
    mongodb.db.collection('users').update({ 'playerId': playerId }, {
        $push: {
            favourateTable: {
                $each: [favTableData],
                $sort: { createdAt: -1 }
            }
        }
    }, function (err, result) {
        callback(err, result);
    });
};

remote.removeFavourateTable = function (playerId, channelId, callback) {
    mongodb.db.collection('users').update({ 'playerId': playerId }, {
        $pull: {
            favourateTable: {
                channelId: channelId
            }
        }
    }, function (err, result) {
        callback(err, result);
    });
};


/* Tables for normal games starts here */
remote.createTable = function (database, userData, callback) {
    mongodb.db.collection(database).insert(userData, function (err, result) {
        callback(err, result);
    });
};

remote.createBounty = function (data, callback) {
    mongodb.db.collection("bounty").insert(data, function (err, result) {
        callback(err, result);
    });
};

remote.updateBounty = function (query, bounty, callback) {
    console.log("query and bounty is in updateBounty is - " + JSON.stringify(query) + bounty);
    mongodb.db.collection("bounty").update(query, { $inc: { "bounty": bounty } }, function (err, result) {
        callback(err, result);
    });
};

remote.getTableList = function (query, cb) {
    mongodb.db.collection('tables').find(query, { projection: { channelName: 1, smallBlind: 1, bigBlind: 1 } }).toArray(function (err, result) {
        cb(err, result);
    });
};

remote.findSpecificTable = function (query, cb) {
  mongodb.db.collection('tables').findOne(query, function (err, result) {
    cb(err, result);
  })
}

remote.updateTable = function(id, userData, callback) {
  // console.log("in updateTable == ", id, userData);
    mongodb.db.collection('tables').update({_id: ObjectID(id)},{$set: userData}, function (err, result) {
     /// result.table._id = ObjectID(id);
      callback(err, result);
    });
};

remote.listTable = function (query, callback) {
    console.log("in listTable dbQuery", query);
    var skip = query.skip || 0;
    var limit = query.limit || 0;
    delete query.skip;
    delete query.limit;
    console.log("in listTable dbQuery", query);
    serverLog(stateOfX.serverLogType.dbQuery, ' Query while listing table - ' + JSON.stringify(query));
    if (query.channelType == "TOURNAMENT") {
        mongodb.db.collection('tournamentroom').find(query).skip(skip).limit(limit).toArray(function (err, result) {
            callback(err, result);
        });
    } else {
        mongodb.db.collection('tables').find(query).skip(skip).limit(limit).toArray(function (err, result) {
            callback(err, result);
        });
    }
};

//this will count list table
remote.countlistTable = function (query, callback) {
    console.log("in listTable count dbQuery", query);
    serverLog(stateOfX.serverLogType.dbQuery, ' Query while listing table - ' + JSON.stringify(query));
    if (query.channelType == "TOURNAMENT") {
        mongodb.db.collection('tournamentroom').count(query, function (err, result) {
            callback(err, result);
        });
    } else {
        mongodb.db.collection('tables').count(query, function (err, result) {
            callback(err, result);
        });
    }
};

remote.countTable = function (query, callback) {
    mongodb.db.collection('tables').count(query, function (err, result) {
        callback(err, result);
    });
};

remote.quickSeatTable = function (query, callback) {
    mongodb.db.collection('tables').find(query).sort({ 'minBuyIn': -1 }).limit(30).toArray(function (err, result) {
        callback(err, result);
    });
};

remote.findTableById = function (id, callback) {
    mongodb.db.collection('tables').findOne({ _id: ObjectID(id) }, function (err, result) {
        callback(err, result);
    });
};

remote.findTable = function (query, callback) {
    var skip = query.skip || 0;
    var limit = query.limit || 0;
    delete query.skip;
    delete query.limit;
    mongodb.db.collection('tables').find(query).skip(skip).limit(limit).sort({ '_id': -1 }).toArray(function (err, result) {
        callback(err, result);
    });
};

remote.removeTable = function (id, callback) {
    mongodb.db.collection('tables').remove({ _id: ObjectID(id) }, function (err, result) {
        callback(err, result);
    });
};

remote.removeTournamentTable = function (id, callback) {
    mongodb.db.collection('tables').remove({ "tournament.tournamentId": id.toString() }, function (err, result) {
        callback(err, result);
    });
};

remote.createTournamentTables = function (userDataArray, callback) {
    mongodb.db.collection('tables').insert(userDataArray, { ordered: false }, function (err, result) {
        callback(err, result);
    });
};

remote.getTournamentTables = function (tournamentId, callback) {
    mongodb.db.collection('tables').find({ 'channelType': 'TOURNAMENT', 'tournament.tournamentId': tournamentId.toString() }).toArray(function (err, result) {
        callback(err, result);
    });
};

remote.updateStackTable = function (id, totalGame, totalStack, avgStack, callback) {
    mongodb.db.collection('tables').update({ _id: ObjectID(id) }, { $set: { totalGame: totalGame, totalStack: totalStack, avgStack: avgStack } }, function (err, result) {
        callback(err, result);
    });
};

remote.updateFlopPlayerTable = function (id, totalFlopPlayer, totalPlayer, flopPercent, callback) {
    mongodb.db.collection('tables').update({ _id: ObjectID(id) }, { $set: { totalFlopPlayer: totalFlopPlayer, totalPlayer: totalPlayer, flopPercent: flopPercent } }, function (err, result) {
        callback(err, result);
    });
};

remote.removeTableForTournament = function (tournamentId, callback) {
    mongodb.db.collection('tables').remove({ "tournament.tournamentId": tournamentId }, function (err, result) {
        callback(err, result);
    });
};

/* Tables for normal games ends here */

/* Rooms for tournament starts here */

remote.createTournamentRoom = function (userData, callback) {
    mongodb.db.collection('tournamentroom').insert(userData, function (err, result) {
        callback(err, result);
    });
};

remote.listTournamentRoom = function (query, callback) {
    serverLog(stateOfX.serverLogType.info, JSON.stringify(query));
    mongodb.db.collection('tournamentroom').find(query).toArray(function (err, result) {
        callback(err, result);
    });
};

remote.listTournamentByTimeSpan = function (query, callback) {
    console.log(query);
    mongodb.db.collection('tournamentroom').find({ channelVariation: query.channelVariation, buyIn: query.buyIn, tournamentType: query.tournamentType, $and: [{ tournamentStartTime: { $gte: query.startTime } }, { tournamentStartTime: { $lte: query.endTime } }] }).toArray(function (err, result) {
        callback(err, result);
    });
};

remote.updateTournamentRoom = function (id, userData, callback) {
    mongodb.db.collection('tournamentroom').findAndModify({ _id: ObjectID(id) }, [], { $set: userData }, { new: true }, function (err, result) {
        callback(err, result);
    });
};

remote.updateTournamentGeneralize = function (id, userData, callback) {
    console.log("id and user data is in updateTournamentGeneralize - " + id + " " + userData);
    mongodb.db.collection('tournamentroom').update({ _id: ObjectID(id) }, { $set: userData }, function (err, result) {
        callback(err, result);
    });
};

remote.updateTournamentStateAndVersion = function (id, state, callback) {
    mongodb.db.collection('tournamentroom').findAndModify({ _id: ObjectID(id) }, [], { $set: { state: state }, $inc: { gameVersionCount: 1 } }, { new: true }, function (err, result) {
        console.log("result is in updateTournamentStateAndVersion ", JSON.stringify(result));
        callback(err, result.value);
    });
};

remote.updateTournamentStateAndVersionGenralized = function (filter, updateData, callback) {
    console.log("filer, updateData in updateTournamentStateAndVersionGenralized ", filter, updateData);
    mongodb.db.collection('tournamentroom').update(filter, { $set: updateData, $inc: { gameVersionCount: 1 } }, function (err, result) {
        console.log("result is in updateTournamentStateAndVersion ", JSON.stringify(result));
        callback(err, result.value);
    });
};

remote.getTournamentRoom = function (id, callback) {
    console.log("in getTournamentRoom id is ", id);
    mongodb.db.collection('tournamentroom').findOne({ _id: ObjectID(id) }, function (err, result) {
        callback(err, result);
    });
};

remote.updateStackTournamentRoom = function (id, totalGame, totalStack, callback) {
    mongodb.db.collection('tournamentroom').update({ _id: ObjectID(id) }, { $inc: { totalGame: totalGame, totalStack: totalStack } }, function (err, result) {
        callback(err, result);
    });
};

remote.updateTournamentState = function (id, state, callback) {
    console.log("updateTournamentState is in dbQuery - " + id, state);
    mongodb.db.collection('tournamentroom').update({ _id: ObjectID(id) }, { $set: { state: state } }, function (err, result) {
        console.log(result);
        callback(err, result);
    });
};

remote.updateTournamentStateAndTime = function (id, state, callback) {
    console.log("updateTournamentState is in dbQuery - " + id, state);
    mongodb.db.collection('tournamentroom').update({ _id: ObjectID(id) }, { $set: { state: state, tournamentStartTime: Number(new Date()) } }, function (err, result) {
        console.log(result);
        callback(err, result);
    });
};

remote.countPlayerLoyalityRecord = function (query, callback) {
    mongodb.db.collection('vipAccumulation').count(query, function (err, result) {
        console.log("here in countPlayerLoyalityRecord db query err result", err, result);
        callback(err, result);
    });
};

remote.getInstantBonusHistoryCount = function (query, callback) {
    mongodb.db.collection('instantBonusHistory').count(query, function (err, result) {
        console.log("here in getInstantBonusHistoryCount db query err result", err, result);
        callback(err, result);
    });
};

remote.countPlayerBonusHistoryRecord = function (query, callback) {
    mongodb.db.collection('vipRelease').count(query, function (err, result) {
        console.log("here in countPlayerBonusHistoryRecord db query err result", err, result);
        callback(err, result);
    });
};

remote.countPlayerInfoRecord = function (query, callback) {
    mongodb.db.collection('users').count(query, function (err, result) {
        console.log("here in countPlayerInfoRecord db query err result", err, result);
        callback(err, result);
    });
};


remote.listPlayerBonusHistoryRecord = function (query, callback) {
    var skipdata = query.skip || 0;
    var limitdata = query.limit || 0;
    delete query.skip;
    delete query.limit;
    console.log("Inside  listPlayerLoyalityPointsReport db query ", query);
    var newQuery = query;

    mongodb.db.collection('vipRelease').find(newQuery).skip(skipdata).limit(limitdata).sort({ "date": -1 }).toArray(function (err, result) {
        console.log("here in listPlayerBonusHistoryRecord db query err result", err, result);
        callback(err, result);

    });
};

remote.listInstantBonusHistory = function (query, callback) {
    var skipdata = query.skip || 0;
    var limitdata = query.limit || 0;
    delete query.skip;
    delete query.limit;
    var newQuery = query;
    mongodb.db.collection('instantBonusHistory').find(newQuery).skip(skipdata).limit(limitdata).sort({ "time": -1 }).toArray(function (err, result) {
        console.log("here in listInstantBonusHistory db query err result", err, result);
        callback(err, result);

    });
};

remote.listPlayerInfoReportRecord = function (query, callback) {
    var skipdata = query.skip || 0;
    var limitdata = query.limit || 0;
    delete query.skip;
    delete query.limit;
    console.log("Inside  listPlayerLoyalityPointsReport db query ", query);
    var newQuery = query;

    mongodb.db.collection('users').find(newQuery, { userName: 1, firstName: 1, lastName: 1, emailId: 1, mobileNumber: 1, status: 1, lastLogin: 1 }).skip(skipdata).limit(limitdata).toArray(function (err, result) {
        console.log("here in listPlayerInfoReportRecord db query err result", err, result);
        callback(err, result);

    });
};

remote.listPlayerLoyalityPointsReport = function (query, callback) {
    var skipdata = query.skip || 0;
    var limitdata = query.limit || 0;
    delete query.skip;
    delete query.limit;
    console.log("Inside  listPlayerLoyalityPointsReport db query ", query);
    var newQuery = query;

    mongodb.db.collection('vipAccumulation').find(newQuery).skip(skipdata).limit(limitdata).sort({ "date": -1 }).toArray(function (err, result) {
        console.log("here in listPlayerLoyalityPointsReport db query err result", err, result);
        callback(err, result);

    });
};

remote.calculateTotalVipPoints = function (query, callback) {

    console.log("Inside  listPlayerLoyalityPointsReport db query ", query);
    mongodb.db.collection('vipAccumulation').aggregate([{ $match: query }, { $group: { _id: "$userName", total: { $sum: "$earnedPoints" }, totalRake: { $sum: "$rakeAmount" } } }]).toArray(function (err, result) {
        callback(err, result);
    });
};

remote.findAgentPlayerChips = function (query, callback) {
    mongodb.db.collection('users').aggregate([{ $match: query }, { $group: { _id: "_id", totalReal: { $sum: "$realChips" }, totalInstant: { $sum: "$instantBonusAmount" } } }]).toArray(function (err, result) {
        callback(err, result);
    });
};

remote.getTotalInstantAmountTransferred = function (query, callback) {
    mongodb.db.collection('instantBonusHistory').aggregate([{ $match: query }, { $group: { _id: "_id", totalAmount: { $sum: "$amount" } } }]).toArray(function (err, result) {
        callback(err, result);
    });
};


remote.findTournamentRoom = function (query, callback) {
    // console.log("333333333",JSON.stringify(query));
    mongodb.db.collection('tournamentroom').find(query).toArray(function (err, result) {
        callback(err, result);
    });
};

remote.updateTournamentStateToRunning = function (tournamentId, callback) {
    mongodb.db.collection('tournamentroom').update({ _id: ObjectID(tournamentId) }, { $set: { state: stateOfX.tournamentState.running } }, function (err, result) {
        callback(err, result);
    });
};


remote.quickSeatTournament = function (query, callback) {
    mongodb.db.collection('tournamentroom').find(query).sort({ 'tournamentStartTime': -1 }).limit(30).toArray(function (err, result) {
        callback(err, result);
    });
};

remote.countTournaments = function (query, callback) {
    mongodb.db.collection('tournamentroom').count(query, function (err, result) {
        callback(err, result);
    });
};
/* Rooms for tournament ends here */

/* Blind rules for tournament starts here */

remote.createBlindRule = function (userData, callback) {
    mongodb.db.collection('blindrules').insert(userData, function (err, result) {
        callback(err, result);
    });
};

remote.listBlindRule = function (query, callback) {
    mongodb.db.collection('blindrules').find(query).toArray(function (err, result) {
        callback(err, result);
    });
};

remote.findBlindRule = function (id, callback) {
    mongodb.db.collection('blindrules').findOne({ _id: ObjectID(id) }, function (err, result) {
        callback(err, result);
    });
};

remote.updateBlindRule = function (id, userData, callback) {
    mongodb.db.collection('blindrules').findAndModify({ _id: ObjectID(id) }, [], { $set: userData }, { new: true }, function (err, result) {
        callback(err, result);
    });
};

remote.listBlindRuleWithLimitedData = function (query, callback) {
    mongodb.db.collection('blindrules').find(query).toArray(function (err, result) {
        callback(err, result);
    });
};

/* Blind rules for tournament ends here */


// Time bank rule starts here

remote.findTimeBankRule = function (id, callback) {
    mongodb.db.collection('timeBankRule').findOne({ _id: ObjectID(id) }, function (err, result) {
        callback(err, result);
    });
};

/* Rake rules for normal games starts here */

// remote.createRakeRule = function(userData, callback) {
//     mongodb.db.collection('rakerules').insert(userData, function (err, result) {
//       callback(err, result);
//     });
// };

// remote.listRakeRule = function(query, callback) {
//     mongodb.db.collection('rakerules').find(query).toArray(function (err, result) {
//       callback(err, result);
//     });
// };

// remote.updateRakeRule = function(id, userData, callback) {
//     mongodb.db.collection('rakerules').findAndModify({_id: ObjectID(id)},[],{$set : userData},{new : true}, function(err,result) {
//         callback(err,result);
//     });
// };

// remote.listRakeRuleWithLimitedData = function(query, callback) {
//     mongodb.db.collection('rakerules').find(query, {_id: 1, name: 1}).toArray(function (err, result) {
//       callback(err, result);
//     });
// };

// remote.getRakeRuleById = function(id, callback) {
//   mongodb.db.collection('rakerules').findOne({_id: ObjectID(id)}, function (err, result) {
//     callback(err, result);
//   });
// };
// get rake rules by small & big blind
// remote.getRakeRules = function(req, callback){
//   mongodb.db.collection('rakerules').findOne({"channelVariation" : req.channelVariation, "list.0.minStake" : req.minStake, "list.0.maxStake" : req.maxStake}, function(err, result){
//     callback(err, result);
//   });
// };
/* Rake rules for normal games ends here */

/* Prize rules for tournament games starts here */

remote.createPrizeRule = function (prizeData, callback) {
    console.log("prize data is - " + prizeData);
    mongodb.db.collection('prizerules').insert(prizeData, function (err, result) {
        callback(err, result);
    });
};

remote.getPrizeRule = function (id, callback) {
    console.log("in getPrizeRule id is ", id);
    mongodb.db.collection('prizerules').findOne({ _id: ObjectID(id) }, function (err, result) {
        console.log("list prize rule result is ", result);
        callback(err, result);
    });
};

remote.findNormalPrizeRule = function (id, callback) {
    console.log("in findNormalPrizeRule id is ", id);
    mongodb.db.collection('prizerules').find({ tournamentId: id.toString(), type: "server" }).toArray(function (err, result) {
        console.log("list prize rule result is ", result);
        callback(err, result);
    });
};

// create breakTime starts here breakTime
remote.breakTime = function (param, callback) {
    mongodb.db.collection('breakRules').insert(param, function (err, result) {
        callback(err, result);
    });
};
//list breaktime
remote.listBreakTime = function (param, callback) {
    mongodb.db.collection('breakRules').find(param).toArray(function (err, result) {
        callback(err, result);
    });
};
//update breakTime
remote.updateBreakTime = function (id, paramData, callback) {
    mongodb.db.collection('breakRules').findAndModify({ _id: ObjectID(id) }, [], { $set: paramData }, { new: true }, function (err, result) {
        callback(err, result);
    });
};

// time bank start here
// create breakTime ends here
remote.timeBank = function (param, callback) {
    mongodb.db.collection('timeBankRule').insert(param, function (err, result) {
        callback(err, result);
    });
};
//list time bank
remote.listTimeBank = function (param, callback) {
    mongodb.db.collection('timeBankRule').find(param).toArray(function (err, result) {
        callback(err, result);
    });
};
//update time bank updateTimeBank
remote.updateTimeBank = function (id, paramData, callback) {
    mongodb.db.collection('timeBankRule').findAndModify({ _id: ObjectID(id) }, [], { $set: paramData }, { new: true }, function (err, result) {
        callback(err, result);
    });
};
// time bank ends here

remote.listPrizeRule = function (query, callback) {
    console.log("query in listPrizeRule ", query);
    mongodb.db.collection('prizerules').find(query).toArray(function (err, result) {
        console.log("list prize rule result is ", result);
        callback(err, result);
    });
};

remote.updatePrizeRule = function (id, userData, callback) {
    mongodb.db.collection('prizerules').findAndModify({ _id: ObjectID(id) }, [], { $set: userData }, { new: true }, function (err, result) {
        callback(err, result);
    });
};

remote.listPrizeRuleWithLimitedData = function (query, callback) {
    mongodb.db.collection('prizerules').find(query, { _id: 1, name: 1 }).toArray(function (err, result) {
        callback(err, result);
    });
};

remote.deletePrizeRule = function (tournamentId, callback) {
    mongodb.db.collection('prizerules').remove({ tournamentId: tournamentId }, function (err, response) {
        callback(err, response);
    });
};

/* Prize rules for normal games ends here */

// remote.createOtp = function(userOtp, callback) {
//     mongodb.db.collection('otp').insert(userOtp, function (err, result) {
//         callback(err, result.ops[0]);
//     });
// };

// FIX - play money to real money - DONE // was doubt - difficult to estimate
remote.updateUser = function (query, updateKeys, callback) {
    console.log('in update user in dbQuery - ' + JSON.stringify(query) + JSON.stringify(updateKeys));
    mongodb.db.collection('users').update(query, { $set: updateKeys }, function (err, user) {
        callback(err, user);
    });
};

remote.findUserBonusDetails = function (filter, callback) {
    mongodb.db.collection('bonusdata').findOne(filter, function (err, result) {
        callback(err, result);
    });
};

remote.createBonusData = function (bonusData, callback) {
    //console.log('in update user in dbQuery - ' + JSON.stringify(query) + JSON.stringify(updateKeys));
    mongodb.db.collection('bonusdata').insert(bonusData, function (err, user) {
        callback(err, user);
    });
};

remote.findBounsData = function (query, callback) {
    //  console.log('in update user in dbQuery - ' + JSON.stringify(query) + JSON.stringify(updateKeys));
    // console.log("query == ", query);
    mongodb.db.collection('bonusdata').findOne(query, function (err, user) {
        console.log("bonus data--", user);
        callback(err, user);
    });
};

remote.updateBounsDataSetKeys = function (query, updateKeys, callback) {
    //console.log('in update user in dbQuery - ' + JSON.stringify(query) + JSON.stringify(updateKeys));
    mongodb.db.collection('bonusdata').update(query, { $set: updateKeys }, function (err, user) {
        callback(err, user);
    });
};

// query to update bonus used details of player (mainly used here for bots)
remote.updateBounsData = function (query, updateKeys, callback) {
    mongodb.db.collection('bonusdata').update(query, { $push: updateKeys }, function (err, user) {
        callback(err, user);
    });
};

remote.updateBounsDataForDirectEntry = function (query, updateQuery, callback) {
    mongodb.db.collection('bonusdata').update(query, updateQuery, function (err, user) {
        callback(err, user);
    });
};

remote.findBounsClaimedUnClaimed = function (param, callback) {
    mongodb.db.collection('bonusdata').find(param).toArray(function (err, result) {
        callback(err, result);
    });
};

remote.findBonusCodeUsedByPlayers = function (query, cb) {
    mongodb.db.collection('bonusdata').find({ "bonus.bonusId": query }, { projection: { playerId: 1, "bonus.$": 1 } }).toArray(function (err, result) {
        cb(err, result);
    });
};

remote.findBonusUsedByPlayersDirectEntry = function (query, cb) {
    let skip = query.skip || 0;
    let limit = query.limit || 0;
    delete query.skip;
    delete query.limit;
    mongodb.db.collection('bonusdata').find({ "bonus.bonusId": query.bonusId }, { projection: { playerId: 1, "bonus.$": 1 } }).skip(skip).limit(limit).toArray(function (err, result) {
        cb(err, result);
    });
};

remote.countBonusCodeUsedByPlayers = function (query, cb) {
    mongodb.db.collection('bonusdata').count({ "bonus.bonusId": query }, function (err, result) {
        cb(err, result);
    });
};

remote.findBonusDataWithUniqueId = function (query, cb) {
    mongodb.db.collection('bonusdata').findOne({ "bonus.uniqueId": query.uniqueId, playerId: query.playerId }, { projection: { playerId: 1, "bonus.$": 1 } }, function (err, result) {
        cb(err, result);
    });
};

// FIX - play money to real money - DONE // was doubt - a little
remote.increaseUserStats = function (query, updateKeys, callback) {
    console.log('in increament user stats in dbQuery - ' + JSON.stringify(query) + JSON.stringify(updateKeys));
    mongodb.db.collection('users').updateMany(query, { $inc: updateKeys }, function (err, user) {
        callback(err, user);
    });
};

// FIX - play money to real money - DONE // was doubt - a little
remote.findAndModifyUser = function (query, updateKeys, callback) {
    console.log("query is ", query);
    console.log("updateKeys is ", updateKeys);
    mongodb.db.collection('users').findAndModify(query, [], { '$set': updateKeys }, { new: true }, function (err, users) {
        console.log("users after findAndModify is ", JSON.stringify(users));
        callback(err, users);
    });
};

// FIX - play money to real money - DONE // was doubt - a little
remote.findAndModifyUser2 = function (query, sort, updateKeys, options, callback) {
    console.log("query is ", query);
    console.log("sort is ", sort);
    console.log("updateKeys is ", updateKeys);
    console.log("options is ", options);
    mongodb.db.collection('users').findAndModify(query, sort, updateKeys, options, function (err, users) {
        console.log("users after findAndModify is ", JSON.stringify(users));
        callback(err, users);
    });
};

remote.createNotes = function (notesData, callback) {
    mongodb.db.collection('notes').insert(notesData, function (err, result) {
        callback(err, result.ops[0]);
    });
};

remote.updateNotes = function (query, updateKeys, callback) {
    mongodb.db.collection('notes').update(query, { $set: updateKeys }, function (err, notes) {
        callback(err, notes);
    });
};

remote.deleteNotes = function (query, updateKeys, callback) {
    mongodb.db.collection('notes').remove(query, function (err, notes) {
        callback(err, notes);
    });
};

remote.findNotes = function (filter, callback) {
    console.log("in get notes", filter);
    mongodb.db.collection('notes').findOne(filter, function (err, notes) {
        callback(err, notes);
    });
};


//manage rake
// remote.fundrake = function(userdata, callback){
//     mongodb.db.collection('fundrake').insert(userdata, function(err, result){
//       callback(err, result);
//     });
// };
//mongodb.db.collection('users').update(filter, {$inc: {realChips: -chips}}

//get player balance for loyality point as per rules
// remote.chkPlayerRakeForLoyality = function(data, callback){
//     console.log('chkPlayerRakeForLoyality', JSON.stringify(data));
//     mongodb.db.collection('fundrake').aggregate([
//       {
//         $match  : data
//       },{
//         $lookup : {
//           from            : "users"  ,
//           localField      : "rakeByUserid",
//           foreignField    : "playerId",
//           as              : "userdetails"
//         }
//       },{
//         $group : {
//           _id             : data.rakeByUserid,
//           amount          : {$sum   : "$amount"},
//           "userdetails"   : { "$push": "$userdetails" }
//         }
//       }

//     ]).toArray(function(err, result){
//       //console.log('lines 614', JSON.stringify(result) );
//       callback(err, result);
//     });
//     // mongodb.db.collection('fundrake').find(data, function(err, result){
//     //   callback(err, result);
//     // })
// };

// FIX - play money to real money - DONE // was doubt - a little - may be deprecated
//update loyality level, noofRecurring & user realChips
remote.updateUserForLoyality = function (playerId, userData, callback) {
    console.log('playerId', playerId, 'userData', JSON.stringify(userData));
    mongodb.db.collection('users').update({ 'playerId': playerId }, { $set: userData }, function (err, result) {
        console.log('result', JSON.stringify(result));
        callback(err, result);
    });
};

//update user chips updateUserBalance
remote.updateUserBalance = function (userdata, playerId, callback) {
    mongodb.db.collection('users').update({ 'playerId': playerId }, { $inc: { 'realChips': parseInt(userdata.fundTransferAmount) } }, function (err, result) {
        callback(err, result);
    });
};


//get all the user for list view on chip transfer duration
remote.getPlayerUser = function (query, callback) {
    console.log('@@@@@@@@@@@', JSON.stringify(query));
    mongodb.db.collection('users').find(query).sort({ "userName": 1 }).toArray(function (err, result) {
        callback(err, result);
    });
};
//get playerlit according
//get getUserList data for admin , affiliate & sub affiliate
remote.getUserList = function (query, currentpage, pagelimit, callback) {
    //console.log('get userlist according to logged in user'+JSON.stringify(req));

    mongodb.db.collection('users').find(query).skip(pagelimit * (currentpage - 1)).sort({ "userName": 1 }).limit(pagelimit).toArray(function (err, result) {
        callback(err, result);
    });
};
//count user list for paging
remote.countUserList = function (req, callback) {
    mongodb.db.collection('users').count(req, function (err, result) {
        callback(err, result);
    });
};

// remote.countryList = function(req, callback){
//     console.log('get country list');
//     mongodb.db.collection('country').find(req).toArray(function(err, result){
//       callback(err, result);
//     })
// } // no use this commented code. countries are not in DB now. they are in stateOfX
//manage fund transfer managefundtransfer
// remote.managefundtransfer = function(req, callback){
//     mongodb.db.collection('fundtransfer').insert(req, function(err, result){
//       callback(err, result);
//     });
// };
//partially complete pending fund transfer
// remote.partiallyCompletePendingFundTransfer = function(req,callback){
//   var setdata = {transactionByAmount : (req.amount - req.amountProcess), comment: req.comment};
//   var nowPending = (req.amount - req.amountProcess);
//   var lastUpdateDate = new Date().getTime();
//   mongodb.db.collection('fundtransfer').update({_id: ObjectID(req.pendingfundid)}, {$set : {transactionByAmount : nowPending, comment: req.comment, lastUpdateDate: lastUpdateDate}}, function(err, result){
//       callback(err, result);
//   });
// };
//completependingfundtransfer complete fund transfer
// remote.completePendingFundTransfer = function(req, callback){
//     var setdata = {transactionAction : req.transactionAction, comment: req.comment};
//     mongodb.db.collection('fundtransfer').update({_id: ObjectID(req.pendingfundid)}, {$set : {transactionAction : req.transactionAction}}, function(err, result){
//       callback(err, result);
//     });
// };
//get all the affiliate list
//maanage fund tranfer histroy
// remote.fundtransferhistroy = function(req, callback){
//     console.log('manage fund tranfer '+req);
//     mongodb.db.collection('fundtransactionhistroy').insert(req, function(err, result){
//       callback(err, result);
//     })
// }
//get fund transfer his data getchiphistroy
// remote.getchiphistroy = function(transactionid, currentpage, pagelimit, callback){
//   console.log('transactionid data', JSON.stringify(transactionid));
//     mongodb.db.collection('fundtransfer').find(transactionid).skip(pagelimit*(currentpage - 1)).limit(pagelimit).sort({"addeddate": -1}).toArray(function(err, result){
//       callback(err, result);
//     });
// };
//become affiliate
remote.becomeAffiliate = function (req, callback) {
    mongodb.db.collection('becomeAffiliate').insert(req, function (err, result) {
        callback(err, result);
    });
};
//userSupportRequest
// remote.userSupportRequest = function(req, callback){
//   mongodb.db.collection('userSupportRequest').insert(req, function(err, result){
//     callback(err, result);
//   });
// };
// manage scrate card start
// remote.managescratchCreated = function(req, callback){
//   mongodb.db.collection('scratchcardHistroy').insert(req, function(err, result){
//     callback(err, result);
//   });
// };
//check scratch card is active or not
// remote.chkscratchCard = function(req, callback){
//   mongodb.db.collection('scratchcardHistroy').findOne(req, function(err, result){
//     callback(err, result);
//   });
// };
//update scratch card
// remote.updateScratchCard = function(scratchid, req, callback){
//   mongodb.db.collection('scratchcardHistroy').update({_id:ObjectID(scratchid)}, {$set : req}, function(err, result){
//     callback(err, result);
//   });
// };
//get redeemed scratch card
// remote.redeemedScratch = function(req,currentpage,pagelimit, callback){
//   mongodb.db.collection('scratchcardHistroy').find(req).skip(pagelimit*(currentpage - 1)).limit(pagelimit).sort({"addeddate" : -1}).toArray( function(err, result){
//     callback(err, result);
//   });
// };

// count scratch card with condition countscratch
// remote.countscratch = function(req, callback){
//   console.log('count scrtc on db', JSON.stringify(req));
//   mongodb.db.collection('scratchcardHistroy').count(req, function(err, result){
//     callback(err, result);
//   });
// };
// manage scrate card End


//get player profile payment option
remote.getWithdrawlProfileforPlayer = function (userId, callback) {
    mongodb.db.collection('users').findOne({ playerId: userId }, function (err, result) {
        callback(err, result);
    });
};

//get count chip his countchiphistroy
// remote.countchiphistroy = function(req, callback){
//     console.log('aaaaaaaaaaaaaaaaaaa'+JSON.stringify(req));
//     mongodb.db.collection('fundtransfer').count(req, function(err, result){
//       callback(err, result);
//     });
// };

//manage withdrawl histroy
// remote.fundwithdrawal = function(req, callback){
//     mongodb.db.collection('fundwithdrawal').insert(req, function(err, result){
//         callback(err, result.ops[0]);
//     });
// };


// remote.fundwithdrawallist = function(transactionAction,currentpage, pagelimit ,callback){
//     console.log('transactionAction'+JSON.stringify(transactionAction) +'currentpage'+currentpage+'pagelimit'+pagelimit);
//     //.skip(pagesize*(n-1)).limit(pagesize)
// //mongodb.db.collection('affiliates').find({role: query.role}).skip(0).limit(parseInt(query.limit) ).toArray(function (err, result) {
//     mongodb.db.collection('fundwithdrawal').find(transactionAction).skip(pagelimit*(currentpage - 1)).limit(pagelimit).sort({"addeddate": -1}).toArray(function (err, result) {
//       callback(err, result);
//     });
// };
//count countwithdrawList for fund
// remote.countwithdrawList = function(req, callback){
//     mongodb.db.collection('fundwithdrawal').count(req, function(err, fund){
//         callback(err, fund);
//     });
// };


//approve with balance by admin
// remote.updatependingwithdrawl = function(req, withdrawlid,callback){
//     console.log('req data'+JSON.stringify(req)+'withdrawlid'+withdrawlid);
//     mongodb.db.collection('fundwithdrawal').update({_id:ObjectID(withdrawlid)}, {$set : req}, function(err, result){
//       callback(err, result);
//     });
// };



//find users with Pending Balance
// remote.fundPendingBalanceByUserId = function(req,callback){
//   console.log("fundPendingBalanceByUserId"+JSON.stringify(req));
//   mongodb.db.collection('fundtransfer').find({"transactionAction":"Pending","transactionToUserid":req.userId}).toArray(function(err,result){
//         callback(err,result);
//   });
// };
//find transactions with Chips from history
// remote.getAllChipTranx = function(req,callback){
//   console.log("getAllChipTranx"+JSON.stringify(req));
//   mongodb.db.collection('fundtransactionhistroy').find(req.filter).sort({"addeddate": -1}).skip(req.limit.pagelimit*(req.limit.currentpage-1)).limit(req.limit.pagelimit).toArray(function(err,result){
//         callback(err,result);
//   });
// };
//count All Chip Tranx from history
// remote.countAllChipTranx = function(req,callback){
//   console.log("countAllChipTranx"+JSON.stringify(req));
//   mongodb.db.collection('fundtransactionhistroy').count(req.filter,function(err,result){
//         callback(err,result);
//   });
// };

//get full rake his data for generate excel
// remote.getfullrakehistry = function(req, callback){
//     mongodb.db.collection('fundrake').find(req).sort({"addeddate": -1}).toArray(function(err, result){
//       callback(err, result);
//     });
// };
//get full rake his for gen excel
// remote.getfullRakeWithoutuserhistroy = function(req,selfilter, callback){
//   // console.log(JSON.stringify(selfilter));
//     mongodb.db.collection('fundrake').find(selfilter).toArray(function(err, result){
//       callback(err, result);
//     });
// };

//get rake histroy
// remote.getrakehistroy = function(req,pagelimit , currentpage, callback){
//     console.log('getrakehistroy'+JSON.stringify(req));
//     mongodb.db.collection('fundrake').find(req).sort({"addeddate": -1 }).skip(pagelimit*(currentpage - 1)).limit(pagelimit).toArray(function(err, result){
//       callback(err, result);
//     });
// };
//get rake his without user
// remote.getRakeWithoutuserhistroy = function(req, selfilter,pagelimit , currentpage, callback){
//     mongodb.db.collection('fundrake').find(selfilter).sort({"addeddate": -1 }).skip(pagelimit*(currentpage - 1)).limit(pagelimit).toArray(function(err, result){
//       callback(err, result);
//     });
// };
//get full rake his data for generate excel
// remote.getfullfilterrakehistroywithuser = function(req, callback){
//     mongodb.db.collection('fundrake').aggregate([{$match : req}]).toArray(function(err, result){
//       callback(err, result);
//     });
// };

//get rake histroy according to user
// remote.getfilterrakehistroywithuser = function(req,pagelimit , currentpage, callback){
//     console.log('reqreqreqreqreqreqreq'+JSON.stringify(req));

//     mongodb.db.collection('fundrake').aggregate([{$match : req}]).skip(pagelimit*(currentpage - 1)).limit(pagelimit).toArray(function(err, result){
//       callback(err, result);
//     });
// };

//get rake his according to role


/* For Promocode */
// remote.createPromo = function(promoData, callback) {
//     mongodb.db.collection('promocode').insert(promoData, function (err, result) {
//         callback(err, result.ops[0]);
//     });
// };

// remote.getPromo = function(promocode, callback) {
//     mongodb.db.collection('promocode').findOne({promocode: promocode}, function (err, result) {
//       callback(err, result);
//     });
// };

// remote.getPromoList = function(callback) {
//     mongodb.db.collection('promocode').find({}).sort({"updateAt": -1}).toArray(function(err,result){
//         console.log(result);
//         callback(err,result);
//     });
// };

// remote.updatePromo = function(promocode, updateKeys, callback) {
//     updateKeys.updateAt = new Date().getTime();
//     mongodb.db.collection('promocode').update({promocode: promocode},{$set : updateKeys},function(err, user){
//         callback(err,user);
//     });
// };

// remote.updateUserPromo = function(promocode, userInfo, callback) {
//     mongodb.db.collection('promocode').update({promocode: promocode},{
//         $push: {
//          userArray: {
//             $each: [userInfo],
//         }
//        }
//     },function(err, data){
//         callback(err,data);
//     });
// };

/* For Scratch Card */
// remote.createScratchCard = function(scratchCardData, callback) {
//     mongodb.db.collection('scratchcard').insert(scratchCardData, function (err, result) {
//         callback(err, result.ops[0]);
//     });
// };

// remote.getScratchCard = function(scratchCardCode, callback) {
//     mongodb.db.collection('scratchcard').findOne({scratchCardCode: scratchCardCode}, function (err, result) {
//       callback(err, result);
//     });
// };

// remote.getScratchCardList = function(callback) {
//     mongodb.db.collection('scratchcard').find({}).sort({"updateAt": -1}).toArray(function(err,result){
//         callback(err,result);
//     });
// };

// remote.updateScratchCard = function(scratchCardCode, updateKeys, callback) {
//     updateKeys.updateAt = new Date().getTime();
//     mongodb.db.collection('scratchcard').update({scratchCardCode: scratchCardCode},{$set : updateKeys},function(err, user){
//         callback(err,user);
//     });
// }

// remote.updateUserScratchCard = function(scratchCardCode, userId, callback) {
//     mongodb.db.collection('scratchcard').update({scratchCardCode: scratchCardCode},{$set : {userRedemmed: userId}},function(err, user){
//         callback(err,user);
//     });
// };


/*
{ $group : {
      _id : { debitToAffiliateid: "$debitToAffiliateid"},
      rakeByUsername : { $first: '$rakeByUsername' },
      amount : {$sum : "$amount"},
      debitToCompany : {$sum : "$debitToCompany"},
      debitToAffiliateamount  : {$sum : "$debitToAffiliateamount"},
      debitToSubaffiliateamount : {$sum : "$debitToSubaffiliateamount"}
    }
  }
*/
// decrease affiliate & su
//update user profile by admin for select affiliate & blocked mongodb.db.collection('users').update(filter, {$inc: {realChips: -chips}}
/*
remote.updateUserBalance = function(userdata, playerId, callback){
    mongodb.db.collection('users').update({'playerId':playerId}, {$inc : {'realChips': parseInt(userdata.fundTransferAmount) }}, function(err, result){
      callback(err, result);
    })
}
remote.updateUser = function(userData, callback){
    console.log('update user profile in DB query');
    var data = {};
    data.isParent = userData.isParent;
    data.isBlocked = userData.isBlocked;
    var playerId = userData.playerId;
    mongodb.db.collection('users').update({playerId: playerId}, {$set : data}, function(err, result){
      callback(err, result);
    })
} */
/*Affiliates ends here*/



// Input: {playerId: "String", key: {attrib1: 1, attrib2: 1}}
// Example: db.getCustomUser(params.updateData.playerId,{freeChips: 1, realChips:1}, function(err, user) {});

remote.getCustomUser = function (playerId, keys, callback) {
    mongodb.db.collection('users').findOne({ playerId: playerId }, keys, function (err, result) {
        callback(err, result);
    });
};

// remote.getTransactionHistory = function(filter, callback) {
//     console.log("In getTransactionHistory ",filter);
//     mongodb.db.collection('transactionHistory').find({playerId : filter.playerId}).sort({"createdAt": -1}).skip(filter.skip).limit(filter.limit).toArray(function (err, result) {
//         console.log("transactions : ",result)
//       callback(err, result);
//     });
// };

// remote.getWalletInfo = function(filter, callback) {
//     console.log("In getWalletInfo ",filter);
//     mongodb.db.collection('wallet').findOne(filter,function (err, result) {
//       callback(err, result);
//     });
// };

//-----------------configuration query starts here------------------------
// remote.updateConfiguration = function(query, updateKeys, callback) {
//     mongodb.db.collection('configuration').update(query,{$set : updateKeys},function(err, user){
//         callback(err,user);
//     });
// };

// remote.createConfiguration = function(config, callback) {
//     mongodb.db.collection('configuration').insert(config, function (err, result) {
//         callback(err, result.ops[0]);
//     });
// };

// remote.getConfiguration = function(filter, callback) {
//     mongodb.db.collection('configuration').findOne(filter,function (err, result) {
//       callback(err, result);
//     });
// };
//-----------------configuration query ends here------------------------

//-----------------activity log starts here-----------------------------
// remote.createUserActivity = function(activity,callback) {
//   mongodb.db.collection('userActivity').insert(activity, function (err, result) {
//       // console.log('update profile response from db - ' + result)
//       // console.log(err)
//       // console.log("--------",result)
//       callback(err, result.ops[0]);
//   })
// }
// remote.createUserActivityGame = function(activity,callback) {
//   mongodb.db.collection('gameActivity').insert(activity, function (err, result) {
//       // console.log('update profile response from db - ' + result)
//       // console.log(err)
//       // console.log("--------",result)
//       callback(err, result.ops[0]);
//   })
// }
// //--------------- User activity list here ---------------------------------
// remote.getUserActivityList = function(filterdata,currentpage, pagelimit, callback){
//   console.log('filterdata', JSON.stringify(filterdata));
//   mongodb.db.collection('userActivity').aggregate([
//     {$match: filterdata},
//     { $skip : pagelimit*(currentpage - 1) },
//     { $limit : pagelimit },
//     {
//       $lookup : {
//         from            : "users",
//         localField      : "playerId",
//         foreignField    : "playerId",
//         as              : "userdetails"
//       }
//     },
//     {
//         $unwind: "$userdetails"
//     },
//     // {$group: {"$push": "$userdetails.userName"}}
//     // { $project : { "category": "$userActivity.category","userName" : "$userdetails.userName" } }
//   ]).toArray(function(err, result){
//     console.log('user act', JSON.stringify(result));
//     callback(err, result);
//   })
//   // mongodb.db.collection('userActivity').find(filterdata).sort({createdAt: -1}).skip(pagelimit*(currentpage - 1)).limit(pagelimit).toArray(function(err, result){
//   //   //console.log('result', JSON.stringify(result));
//   //   callback(err, result);
//   // })
// }


// // ]).toArray(function(err, result){
// //   //console.log('lines 614', JSON.stringify(result) );
// //   callback(err, result);
// // })
// //----------------- Count userActivity list ---------------------------
// remote.countUserActivityList = function(filterdata, callback){
//   console.log('countUserActivityList', JSON.stringify(filterdata));
//   mongodb.db.collection('userActivity').count(filterdata, function(err, result){
//     console.log('count result', result);
//     callback(err, result);
//   })
// }

// ----------------- Report Issue Starts -------------------------------
remote.reportIssue = function (issueDetails, callback) {
    mongodb.db.collection('issues').insert(issueDetails, function (err, result) {
        callback(err, result.ops[0]);
    });
};

remote.getIssue = function (filter, callback) {
    console.log("in get issue");
    mongodb.db.collection('issues').find(filter).toArray(function (err, result) {
        console.log("inside query");
        console.log(err);
        console.log(result);
        callback(err, result);
    });
};

remote.changeIssueStatus = function (detail, callback) {

    console.log("detail.filter", detail.filter);
    console.log(detail.new_status);

    mongodb.db.collection('issues').findAndModify({ _id: ObjectID(detail.id) }, {}, { $set: detail.new_status }, { new: true }, function (err, result) {
        console.log("inside query");
        console.log(err);
        console.log(result);
        callback(err, result);
    });
};

//--------------------Version starts here-----------------------
// remote.getVersion=function(callback){
//     console.log("in dbquery getVersion");
//     mongodb.db.collection('versions').find().toArray(function(err,result){
//         console.log(result);
//         console.log(err);
//         callback(err,result);
//     });
// };

// remote.removeVersion=function(versionNo,platform,callback){
//     mongodb.db.collection('versions').remove({'versionNo':versionNo,'platform':platform},function(err,result){
//         console.log("deleted");
//         callback(err,result);
//     });
// };

// remote.updateVersionRequired=function(versionNo,platform,updateRequired,callback){
//     var new_update="true";
//     if(updateRequired=="true") {
//         new_update="false";
//     }

//     mongodb.db.collection('versions').findAndModify({'versionNo':versionNo,'platform':platform},{},{$set:{updateRequired:new_update}},{new:true},function(err,result){
//         callback(err,result);
//     });
//     };

// remote.createOrUpdateVersion=function(req,callback){

//     mongodb.db.collection('versions').findAndModify({versionNo:req.versionNo,platform:req.platform},{},{$set:{versionNo:req.versionNo,platform:req.platform,releaseDate:req.releaseDate,updateRequired:req.updateRequired}},{upsert:true,new:true},function(err,result){
//         callback(err,result);
//     });
// };

// remote.editVersion=function(req,callback){
//     console.log("in editVersion",req);
//         mongodb.db.collection('versions').update({_id:ObjectID(req._id)},{$addToSet:{versionNo:req.versionNo,platform:req.platform,releaseDate:req.releaseDate,updateRequired:req.updateRequired}},{}    ,function(err,result){
//             console.log(result);
//             callback(err,result);
//             });
// };

// remote.getVersionStatus=function(req,callback){
//     console.log("in getVersionStatus");
//     mongodb.db.collection('versions').findOne({versionNo:req.query.versionNo,platform:req.query.platform},function(err,res){
//         console.log("res",res);
//         callback(err,res);
//     });
// };

// query for tournament users
remote.countTournamentusers = function (filter, callback) {
    console.log("filter is in countTournamentusers is - ", JSON.stringify(filter));
    mongodb.db.collection('tournamentusers').count(filter, function (err, users) {
        console.log("err ", err);
        console.log("users are ", users);
        callback(err, users);
    });
};

remote.createTournamentUsers = function (data, callback) {
    mongodb.db.collection('tournamentusers').insert(data, function (err, result) {
        callback(err, result.ops[0]);
    });
};

remote.findTournamentUser = function (filter, callback) {
    console.log("in findTournamentUser filter is ", filter);
    mongodb.db.collection('tournamentusers').find(filter).toArray(function (err, result) {
        console.log("result in findTournamentUser ", JSON.stringify(result));
        callback(err, result);
    });
};

remote.findActiveTournamentUser = function (filter, callback) {
    console.log("in findActiveTournamentUser filter is ", filter);
    mongodb.db.collection('tournamentusers').find(filter, { 'isActive': 1 }).toArray(function (err, result) {
        console.log("result in findActiveTournamentUser ", JSON.stringify(result));
        callback(err, result);
    });
};

remote.updateTournamentUser = function (query, data, callback) {
    mongodb.db.collection('tournamentusers').update(query, { $set: data }, function (err, result) {
        console.log("result -----");
        console.log(result);
        callback(err, result);
    });
};

remote.updateMultipleTournamentUser = function (query, data, callback) {
    mongodb.db.collection('tournamentusers').update(query, { $set: data }, { multi: true }, function (err, result) {
        // console.log("result -----");
        // console.log(result);
        callback(err, result);
    });
};

remote.upsertTournamentUser = function (query, data, callback) {
    console.log("query, data ", query, data);
    mongodb.db.collection('tournamentusers').update(query, { $set: data }, { upsert: true }, function (err, response) {
        console.log("result in upsertTournamentUser ", response.result);
        callback(err, response.result);
    });
};

remote.deleteTournamentUser = function (query, callback) {
    mongodb.db.collection('tournamentusers').remove(query, function (err, response) {
        console.log("response in deleted tournamentusers ", response.result);
        callback(err, response.result);
    });
};

//mongodb.db.collection('tables').update({_id: ObjectID(id)},{$set: userData}, function (err, result) {
//      callback(err, result);
//    })


remote.insertRanks = function (data, callback) {
    console.log("data in insert rank in db query is - ", data);
    mongodb.db.collection('tournamentRanks').insert(data, function (err, result) {
        console.log("result of insert rank in dbquery is - ", result);
        callback(err, result);
    });
};

remote.getTournamentRanks = function (params, callback) {
    mongodb.db.collection('tournamentRanks').find(params).toArray(function (err, result) {
        callback(err, result);
    });
};

remote.findTournamentRanks = function (params, callback) {
    mongodb.db.collection('tournamentRanks').find(params).sort({ createdAt: 1 }).toArray(function (err, result) {
        callback(err, result);
    });
};

remote.updateTournamentRanks = function (filter, callback) {
    mongodb.db.collection('tournamentRanks').update(filter, { $set: { isCollected: true } }, function (err, result) {
        callback(err, result);
    });
};

remote.modifyTournamentRanks = function (filter, updatedValue, callback) {
    mongodb.db.collection('tournamentRanks').update(filter, { $set: updatedValue }, function (err, result) {
        callback(err, result);
    });
};
// remote.InsertInPrize = function(data, callback){
//     mongodb.db.collection("prizes").insert(data, function(err, result) {
//         callback(err, result.ops[0]);
//     });
// };



/* For Admin Activity Log*/

// remote.InsertAdminLog = function(activityByName, activityById,  activity,  action, statement, data) {
//     var data1 = {
//         activityByName  : activityByName,       // person name
//         activityById    : activityById,         // person _id
//         activity        : activity,             // activity name like affiliate account creation, table creation etc
//         action          : action,               // type of action performed - update, create, delete, etc
//         statement       : statement,            // custom statement
//         data            : data,                 // json data at that moment
//         createdAt       : new Date().getTime()
//     };
//     mongodb.db.collection('adminLog').insert(data1);
// };

// remote.insertHandHistory = function(channelId, roundId, roundCount, startedAt, finishedAt, historyLog, callback){
//     serverLog(stateOfX.serverLogType.info, "in insertHandHistory");
//     mongodb.db.collection("handHistory").insert({'channelId': channelId, 'roundId': roundId, 'roundCount': roundCount, 'startedAt': startedAt, 'finishedAt': finishedAt, 'historyLog': historyLog}, function(err, result){
//       callback(err,result);
//     });
// }

// remote.getHandHistory = function(handHistoryId,callback){
//     mongodb.db.collection("handHistory").findOne({'_id':ObjectID(handHistoryId)},function(err,result){
//       serverLog(stateOfX.serverLogType.info, "hand History received",result);
//       callback(err,result);
//     })
// }

// remote.insertVideoLog = function(channelId, roundId, logData, callback){
//   var data = {
//     channelId   : channelId,
//     roundId     : roundId,
//     logData     : logData,
//     createdAt   : new Date().getTime()
//   }
//   mongodb.db.collection("videoLog").insert(data,function(err,response){
//     callback(err,response);
//   })
// }

// remote.getVideo = function(videoLogId,callback){
//   mongodb.db.collection("videoLog").findOne({'_id':ObjectID(videoLogId)},function(err,result){
//     console.log("video received",result);
//     callback(err,result);
//   })
// }

// remote.createHandTab = function(channelId, roundId, callback){
//   var data = {
//     channelId   : channelId,
//     roundId     : roundId,
//     active      : false,
//     createdAt   : new Date().getTime()
//   }
//   mongodb.db.collection("handTab").insert(data,function(err,response){
//     callback(err,response);
//   })
// }

// remote.updateHandTab = function(channelId,roundId,data, callback){
//   mongodb.db.collection('handTab').findAndModify({channelId: channelId, roundId:roundId}, {}, {$set:data}, {new:true}, function(err,response){
//     callback(err, response);
//   })
// }

// remote.getHandTab = function(channelId, callback){
//   mongodb.db.collection('handTab').find({channelId: channelId, active: true}, {"pot": 1, "hands": 1, "handHistoryId": 1, "channelId": 1, "videoId": 1}).sort({_id:-1}).limit(configConstants.handTabRecordCount).toArray(function(err,result){
//     callback(err,result);
//   })
// }

/* ---------------- loyaltypoint for VIP start ------------- */
// remote.findAllLoyaltyLevel=function(callback){
//     mongodb.db.collection('loyaltyLevel').find({}).toArray(function(err,result){
//         callback(err,result);
//     });
// };

// remote.updateLoyaltyLevel=function(req,callback){
//     mongodb.db.collection('loyaltyLevel').findAndModify({levelId:req.levelId},{},{$set:{levelId:req.levelId, level:req.level, rakeLevelAmount:req.rakeLevelAmount, rakeRecurringAmount:req.rakeRecurringAmount, percentReward:req.percentReward, expiryPeriod: req.expiryPeriod}},{upsert:true,new:true},function(err,result){
//         callback(err,result);
//     });
// };

// remote.updatePlayerLevel=function(req,callback){
//     mongodb.db.collection('playerLevel').findAndModify({playerId:req.playerId},{},{$set:{playerId:req.playerId, levelId:req.levelId}},{upsert:true,new:true},function(err,result){
//         callback(err,result);
//     });
// };

// remote.findPlayerLevel=function(req,callback){
//     mongodb.db.collection('playerLevel').findOne({playerId:req.playerId},function(err,result){
//         if(result && !err){
//             if(result){
//                 mongodb.db.collection('loyaltyLevel').findOne({levelId: result.levelId}, function(error,resp){
//                     if(resp && !error){
//                         result.level = resp.level;
//                         result.rakeLevelAmount = resp.rakeLevelAmount;
//                         result.rakeRecurringAmount = resp.rakeRecurringAmount;
//                         result.percentReward = resp.percentReward;
//                         result.expiryPeriod = resp.expiryPeriod;
//                         callback(error,result);
//                     } else{
//                         callback(error,resp);
//                     }
//                 });
//             } else{
//                 callback("No player exist", result);
//             }
//         } else{
//             callback(err,result);
//         }
//     });
// };

// remote.createUserloyaltyPoint = function(req, callback) {
//    mongodb.db.collection('loyaltyPoint').insert({playerId: req.playerId, amount: req.amount, isRedemmed: req.isRedemmed, datetime: req.datetime}, function (err, result) {
//        callback(err, result);
//    });
// };

// remote.getEligibleAmount = function(playerId, expiryPeriod, callback){
//     mongodb.db.collection('loyaltyPoint').aggregate([
//      {
//         $match : {
//             playerId: playerId,
//             datetime : {'$gte' : expiryPeriod},
//             isRedemmed: false
//         }
//     },
//     {
//        $group:
//          {
//            _id: null,
//            totalAmount: { $sum: "$amount" }
//          }
//      }
//    ]).toArray(function(err, result){
//         console.log('err'+err+'result'+result);
//       callback(err, result);
//     });
// };

// remote.updateRedemed = function(expiryPeriod, callback) {
//     mongodb.db.collection('loyaltyPoint').update({datetime : {'$gte' : expiryPeriod}},{$set: {isRedemmed: true}}, {multi: true}, function (err, result) {
//       callback(err, result);
//     });
// };

/* ---------------- loyaltypoint for VIP End ------------- */

/* ---------------dbQuery SpamWords  start -----------------------*/
remote.findAllSpamWords = function (callback) {
    mongodb.db.collection('spamWords').find({}).toArray(function (err, result) {
        callback(err, result);
    });
};

remote.updateSpamWord = function (req, callback) {
    // console.log('@@@@@@@@@@@@', JSON.stringify(req));
    // console.log(typeof req);
    //TODO: insert documents if 0 documents
    mongodb.db.collection('spamWords').update({}, { blockedWords: req }, { upsert: true }, function (err, result) {
        callback(err, result);
    });
};
/* --------------- dbQuery SpamWords  end -----------------------*/


/* --------------- dbQuery rebuy  starts -----------------------*/

remote.updateRebuy = function (query, updatedData, callback) {
    serverLog(stateOfX.serverLogType.info, "query and updated data are in updateRebuy- " + JSON.stringify(query) + JSON.stringify(updatedData));
    mongodb.db.collection('rebuy').update(query, updatedData, { upsert: true }, function (err, result) {
        callback(err, result);
    });
};

remote.updateRebuyWithoutInsert = function (query, updatedData, callback) {
    serverLog(stateOfX.serverLogType.info, "query and updated data are in updateRebuy- " + JSON.stringify(query) + JSON.stringify(updatedData));
    mongodb.db.collection('rebuy').update(query, { $set: updatedData }, function (err, result) {
        callback(err, result);
    });
};

remote.countRebuyOpt = function (query, callback) {
    serverLog(stateOfX.serverLogType.info, "query is in countRebuyOpt - " + JSON.stringify(query));
    mongodb.db.collection('rebuy').findOne(query, function (err, result) {
        serverLog(stateOfX.serverLogType.info, 'rebuy count in db is - ' + JSON.stringify(result));
        callback(err, result);
    });
};

remote.findAllRebuy = function (query, callback) {
    serverLog(stateOfX.serverLogType.info, "query is in findAllRebuy - " + JSON.stringify(query));
    mongodb.db.collection('rebuy').find(query).toArray(function (err, result) {
        serverLog(stateOfX.serverLogType.info, 'rebuy result in db is - ' + JSON.stringify(result));
        callback(err, result);
    });
};

/* --------------- dbQuery rebuy  ends -----------------------*/


/* -----------------dbQuery for videologs start -------------------*/
// remote.insertVideo = function(video, callback) {
//   mongodb.db.collection('videos').insert(video, function (err, result) {
//     callback(err, result.ops[0]);
//   });
// }

// remote.updateVideo = function(query, updatedData, callback) {
//   mongodb.db.collection('videos').update(query, {$set:updatedData}, function (err, result) {
//     callback(err, result);
//   });
// }

// remote.insertNextVideo = function(query, historyContent, callback) {
//   mongodb.db.collection('videos').findAndModify(query, [], {$push:{history: historyContent}}, {new: true}, function (err, result) {
//     callback(err, result);
//   });
// }

// remote.findVideoById = function(id, callback) {
//     mongodb.db.collection('videos').findOne({_id: ObjectID(id)}, function (err, result) {
//       callback(err, result);
//     });
// }

// remote.getHandHistoryByVideoId = function(videoId, callback) {
//   mongodb.db.collection('handTab').findOne({videoId: videoId}, function (err, result) {
//     callback(err, result);
//   });
// }

/* -----------------dbQuery for videologs ends -------------------*/

/* -----------------dbQuery for anti banking start -------------------*/

remote.insertAntiBanking = function (data, callback) {
    mongodb.db.collection('antibanking').insert(data, function (err, result) {
        callback(err, result);
    });
};

remote.removeAntiBankingEntry = function (query, callback) {
    mongodb.db.collection('antibanking').remove(query, function (err, result) {
        callback(err, result);
    });
};

remote.getAntiBanking = function (query, callback) {
    mongodb.db.collection('antibanking').findOne(query, function (err, result) {
        callback(err, result);
    });
};

remote.findBreakRule = function (id, callback) {
    mongodb.db.collection('breakRules').findOne({ _id: ObjectID(id) }, function (err, result) {
        callback(err, result);
    });
};

remote.findTimeBankRule = function (id, callback) {
    mongodb.db.collection('timeBankRule').findOne({ _id: ObjectID(id) }, function (err, result) {
        callback(err, result);
    });
};



/* -----------------dbQuery for anti banking ends -------------------*/
// remote.listModule = function(query,callback){
//   console.log("listModule called",query)
//   mongodb.db.collection('moduleAdmin').find(query).toArray(function (err, result) {
//     serverLog(stateOfX.serverLogType.info,'rebuy result in db is - ' + JSON.stringify(result));
//     callback(err, result);
//   })
// }

// remote.insertModuleList = function(query,callback){
//   console.log("insertModuleList called",query)
//   mongodb.db.collection('moduleAdmin').insert(query,function (err, result) {
//     serverLog(stateOfX.serverLogType.info,'rebuy result in db is - ' + JSON.stringify(result));
//     callback(err, result);
//   })
// }

//   remote.findAffiliates = function(filter, callback) {
//   mongodb.db.collection('affiliates').findOne(filter,function (err, result) {
//     callback(err, result);
//   })
// }

// remote.addRealChipstoAffiliate = function(filter, chips, callback) {
//     mongodb.db.collection('affiliates').update(filter, {$inc: {realChips: chips}}, function (err, result) {
//       callback(err, result);
//     })
// }


// remote.deductRealChipsFromAffiliate = function(filter, chips, callback) {
//   mongodb.db.collection('affiliates').update(filter, {$inc: {realChips: -chips}}, function (err, result) {
//     callback(err, result);
//   });
// }

remote.getPlayersCount = function (query, cb) {
    console.log("inside get getPlayersCount,,, ", query);
    var newQuery = {};
    if (query.parentUserName) {
        newQuery.isParentUserName = eval('/^' + query.parentUserName + '$/i');
        console.log("here in dbquery parentusername-------->", query);
    }

    if (query.userName) {
        newQuery.isParentUserName = query.userName;
    }
    if (query.status) {
        console.log("here 123");
        newQuery.status = query.status;
    }
    if (query.promoBonusAwarded == true) {
        newQuery.promoBonusAwarded = query.promoBonusAwarded;
    }
    if (query.promoBonusAwarded == false) {
        newQuery.promoBonusAwarded = null;
    }
    if (query.userId) {
        newQuery.userName = eval('/^' + query.userId + '$/i');
        // newQuery.userName = eval('/^'+ query.userId +'$/i');
    }
    if (query.emailId) {
        newQuery.emailId = eval('/' + query.emailId + '/i');
        // newQuery.userName = eval('/^'+ query.userId +'$/i');
    }
    if (query.parent) {
        newQuery.isParentUserName = eval('/' + query.parent + '/i');
        // newQuery.userName = eval('/^'+ query.userId +'$/i');
    }


    // if(query.isOrganic == true){
    //   newQuery.isOrganic = true;
    // }

    // else if(query.isOrganic == false){
    //   newQuery.isOrganic = false;
    // }
    if (query.isOrganic) {
        newQuery.isOrganic = query.isOrganic;
    }
    if (newQuery.isOrganic == 'All') {
        delete newQuery.isOrganic;
    }

    console.log("newQuery db query in count player ", newQuery);


    mongodb.db.collection('users').count(newQuery, function (err, result) {
        console.log(" count of number of players.... ", JSON.stringify(result));
        cb(err, result);
    });
};

remote.findAllPlayers = function (query, cb) {
    console.log("inside findAllPlayers ------ ", query);
    var newQuery = {};
    var skip = query.skip || 0;
    var limit = query.limit || 0;

    if (query._id) {
        newQuery._id = ObjectID(query._id);
    }
    if (query.userName && !query._id) {
        newQuery.isParentUserName = eval('/^' + query.userName + '$/i');
    }

    if (query.userId) {
        newQuery.userName = eval('/^' + query.userId + '$/i');
    }
    if (query.promoBonusAwarded == true) {
        newQuery.promoBonusAwarded = query.promoBonusAwarded;
    }
    if (query.promoBonusAwarded == false) {
        newQuery.promoBonusAwarded = null;
    }
    if (query.emailId) {
        newQuery.emailId = eval('/' + query.emailId + '/i');
    }
    if (query.parent) {
        newQuery.isParentUserName = eval('/^' + query.parent + '$/i');
    }

    if (query.isOrganic) {
        newQuery.isOrganic = query.isOrganic;
    }
    if (query.status) {
        newQuery.status = query.status;
    }
    if (newQuery.isOrganic == 'All') {
        delete newQuery.isOrganic;
    }
    // if(query.isOrganic == true){
    // }

    // else if(query.isOrganic == false){
    //   newQuery.isOrganic = false;
    // }

    console.log("newQuery in list player", newQuery);

    mongodb.db.collection('users').find(newQuery).skip(skip).limit(limit).sort({ createdAt: -1 }).toArray(function (err, result) {
        // console.log("result in findAllPlayers---- ",JSON.stringify(result));
        cb(err, result);
    });
};

remote.findAllPlayersCount = function (query, cb) {
    console.log("inside findAllPlayersSelectedData ------ ", query);

    mongodb.db.collection('users').count(query, function (err, count) {
        console.log("count in findAllPlayersSelectedData---- ", JSON.stringify(count));
        cb(err, count);
    });
};

remote.findAllPlayersSelectedData = function (query, projectionData, cb) {
    console.log("inside findAllPlayersSelectedData ------ ", query, projectionData);
    var skip = query.skip;
    var limit = query.limit;
    delete query.skip;
    delete query.limit;
    mongodb.db.collection('users').find(query, projectionData).skip(skip).limit(limit).toArray(function (err, result) {
        // console.log("result in findAllPlayersSelectedData---- ",JSON.stringify(result));
        cb(err, result);
    });
};

remote.findOnePlayer = function (query, cb) {
    console.log("inside findOnePlayer ------ ", query);
    mongodb.db.collection('users').findOne(query, function (err, result) {
        console.log("result in findOnePlayer---- ", JSON.stringify(result));
        cb(err, result);
    });
};

// remote.findOneAffiliate = function(query, cb){
//   console.log("inside findOneAffiliate ------ ", query); 
//   mongodb.db.collection('affiliates').findOne(query, function (err, result) {
//     console.log("result in Affiliate---- ",JSON.stringify(result));
//     cb(err, result);
//     });
// }

// never used
remote.updatePlayer = function (id, userData, callback) {
    console.log("Inside update player dbQuery ---", id);
    mongodb.db.collection('users').update({ _id: ObjectID(id) }, { $set: userData }, function (err, result) {
        callback(err, result);
    });
};

/*------------------- db query for scheduled expiry starts ------------- */

remote.countExpirySlot = function (query, callback) {
    mongodb.db.collection('scheduledExpiry').count(query, function (err, result) {
        callback(err, result);
    });
};


remote.createExpirySlot = function (data, callback) {
    console.log("createExpirySlot data " + JSON.stringify(data));
    mongodb.db.collection('scheduledExpiry').insert(data, function (err, res) {
        callback(err, res);
    });
};

remote.updateExpirySlot = function (query, update, callback) {
    console.log("updateExpirySlot data " + JSON.stringify(query) + JSON.stringify(update));
    mongodb.db.collection('scheduledExpiry').update(query, update, function (err, res) {
        callback(err, res);
    });
};

remote.updateManyExpirySlot = function (query, update, callback) {
    mongodb.db.collection('scheduledExpiry').updateMany(query, update, function (err, result) {
        callback(err, result);
    });
};

remote.findExpirySlots = function (query, callback) {
    console.log(query);
    mongodb.db.collection('scheduledExpiry').find(query).toArray(function (err, res) {
        callback(err, res);
    });
};

remote.findPlayerLockedExpiry = function (query, skip, limit, cb) {
    mongodb.db.collection('scheduledExpiry').find(query).skip(skip).limit(limit).toArray(function (err, res) {
        cb(err, res);
    });
};

remote.findActiveBonusPlayer = function (query, cb) {
    mongodb.db.collection('scheduledExpiry').aggregate([
        { $match: query },
        {
            $group: {
                _id: "$playerId", bonusData: {
                    $push: {
                        lockedBonusAmount: "$lockedBonusAmount",
                        createdAt: "$createdAt",
                        expireAt: "$expireAt"
                    }
                }
            }
        }]).toArray(function (err, result) {
            cb(err, result);
        });
};

/*------------------- db query for scheduled expiry ends --------------- */



/*--------------------- db query for get bot ------------------------*/

/**
 * this will get all existing bot
 * 
 * @method getBots
 * @param  {Function} callback  callback function
 * @return {Object}             err/success object
 */
remote.getBots = function (callback) {
    mongodb.db.collection('users').find({ "isBot": true }).toArray(function (err, result) {
        callback(err, result);
    });
};

/**
 * this for updating bot chips at every 2 hour
 * 
 * @method upDateBotChips
 * @param  {Function} callback  callback function
 * @return {Object}             err/success object
 */
remote.upDateBotChips = function (callback) {
    mongodb.db.collection('users').update({ "isBot": true }, { $inc: { freeChips: 10000, realChips: 10000 } }, { multi: true }, function (err, result) {
        callback(err, result);
    });
};

/*-------------------------------------------- bot query done -------------------------------------------*/


/*------------------------------------------ for user session ----------------------*/

//find user session in db
remote.findUserSessionInDB = function (params, callback) {
    mongodb.db.collection('userSession').findOne({ playerId: params }, function (err, result) {
        callback(err, result);
    });
};

remote.findUserSessionCountInDB = function (params, callback) {
    mongodb.db.collection('userSession').find(params).count(function (err, result) {
        callback(err, result);
    });
};

// insert user session in db
remote.insertUserSessionInDB = function (params, callback) {
    console.log("remote.insertUserSessionInDB", params);
    mongodb.db.collection('userSession').update({ playerId: params.playerId }, { $set: params }, { upsert: true }, function (err, result) {
        console.log("remote.insertUserSessionInDB --res", result);
        callback(err, result && result.ops && result.ops[0]);
        // pomelo.app.rpc.connector.entryRemote.sendMailToDevelopersForGameStart("SESSION",JSON.stringify({title:"insertUserSessionInDB", params: params}), function () {});
    });
};

// remove user session in db
remote.removeUserSessionFromDB = function (params, callback) {
    console.log("remote.removeUserSessionFromDB", params);
    mongodb.db.collection('userSession').remove({ playerId: params }, function (err, result) {
        console.log("removed ", result);
        callback(err, result);
        // pomelo.app.rpc.connector.entryRemote.sendMailToDevelopersForGameStart("SESSION",JSON.stringify({title:"removeUserSessionFromDB", params: params}), function () {});
    });
};

remote.findPlayerWithEmail = function (filter, callback) {
    console.log("Find Player with email");
    mongodb.db.collection('users').findOne(filter, function (err, result) {
        callback(err, result);
    });
};

remote.findPlayerWithId = function (filter, callback) {
    console.log("Inside findPlayerWithId dbQuery");
    mongodb.db.collection('users').findOne(filter, function (err, result) {
        callback(err, result);
    });
};


remote.updatePasswordInDb = function (query, updateKeys, cb) {
    console.log("updatePasswordInDb--- ", query);
    console.log("updateKeys--- ", updateKeys);
    mongodb.db.collection('users').update(query, { $set: updateKeys }, function (err, result) {
        console.log("bQuery result====", err, result);
        cb(err, result);
    });
};

remote.findPasswordResetReqInDb = function (query, cb) {
    console.log("addPasswordResetExpiryKeyInDb ", query);
    mongodb.db.collection('pendingPasswordResets').findOne(query, function (err, result) {
        cb(err, result);
    });
};

remote.deletePasswordResetReqInDb = function (query, cb) {
    mongodb.db.collection('pendingPasswordResets').remove(query, function (err, result) {
        cb(err, result);
    });
};

remote.addPasswordResetExpiryKeyInDb = function (query, cb) {
    console.log("addPasswordResetExpiryKeyInDb ", query);
    mongodb.db.collection('pendingPasswordResets').insert(query, function (err, result) {
        cb(err, result.ops[0]);
    });
};


//count Number of Players for report generation
remote.countPlayers = function (query, cb) {
    console.log("inside  countPlayer dbQuery ", query);
    var newQuery = {};
    if (query.userName) {
        newQuery.userName = query.userName;
    }
    if (query.isParentUserName) {
        newQuery.isParentUserName = query.isParentUserName;
    }
    mongodb.db.collection('users').count(newQuery, function (err, result) {
        console.log(" count in countPlayers... ", JSON.stringify(result));
        cb(err, result);
    });
};

remote.findPlayerReport = function (query, cb) {
    console.log("inside findPlayerReport  dbquery------ ", query);
    // var newQuery = {};
    // if(query.userName){
    //   newQuery.userName = query.userName;
    // }
    // if(query.isParentUserName){
    //   newQuery.isParentUserName = query.isParentUserName;
    // }
    var skip = query.skip || 0;
    var limit = query.limit || 0;
    delete query.skip;
    delete query.limit;
    mongodb.db.collection('users').find(query).skip(skip).limit(limit).toArray(function (err, result) {
        // console.log("result in findAllPlayers---- ",JSON.stringify(result));
        cb(err, result);
    });
};

remote.findPlayerReportDateFilter = function (query, cb) {
    console.log("inside findPlayerReportDateFilter  dbquery------ ", query);
    var newQuery = {};
    var projectionQuery = {};
    if (query.userName) {
        newQuery.userName = query.userName;
    }
    if (query.isParentUserName) {
        newQuery.isParentUserName = query.isParentUserName;
    }
    var skip = query.skip || 0;
    var limit = query.limit || 0;
    mongodb.db.collection('users').find(newQuery).skip(skip).limit(limit).toArray(function (err, result) {
        console.log("result in findAllPlayers---- ", JSON.stringify(result));
        cb(err, result);
    });
};



remote.addRealChipstoPlayerCashout = function (filter, chips, callback) {
    mongodb.db.collection('users').findOneAndUpdate(filter, { $inc: { realChips: chips, 'chipsManagement.deposit': chips } }, { returnOriginal: false }, function (err, result) {
        console.log(err, "!!@@!!@@", result);
        callback(err, result);
    });
};

remote.addInstantBonusAmount = function (query, updateData, callback) {
    mongodb.db.collection('users').findOneAndUpdate(query, updateData, { returnOriginal: true, projection: { isParentUserName: 1, userName: 1, emailId: 1, playerId: 1, instantBonusAmount: 1, realChips: 1, statistics: 1, mobileNumber: 1 } }, function (err, result) {
        callback(err, result);
    });
};



remote.updateScheduleTask = function (query, update, cb) {
    mongodb.db.collection('scheduleTasks').update(query, update, function (err, result) {
        cb(err, result);
    });
};

remote.addScheduleTask = function (query, cb) {
    if (query.type == 'serverDown' || query.type == 'serverUp') {
        mongodb.db.collection('scheduleTasks').find({ type: query.type, status: 'PENDING' }).toArray(function (err, result) {
            if (result && result.length <= 0) {
                mongodb.db.collection('scheduleTasks').insert(query, function (err, result) {
                    cb(err, result);
                });
            } else {
                if (result && result.length >= 1) {
                    cb({ success: false, info: "Already scheduled such task. Cancel that first." });
                } else {
                    cb(err, result);
                }
            }
        });
    } else {
        cb({ success: false, info: "undefined type" });
    }
};
remote.findScheduleTask = function (query, cb) {
    mongodb.db.collection('scheduleTasks').findOne(query, function (err, result) {
        cb(err, result);
    });
};

remote.findMultipleScheduleTasks = function (query, cb) {
    var skip = query.skip;
    var limit = query.limit;
    delete query.skip;
    delete query.limit;

    mongodb.db.collection('scheduleTasks').find(query).skip(skip || 0).limit(limit || 0).sort({ '_id': -1 }).toArray(function (err, result) {
        cb(err, result);
    });
};

remote.countMultipleScheduleTasks = function (query, cb) {
    mongodb.db.collection('scheduleTasks').count(query, function (err, result) {
        cb(err, result);
    });
};

remote.getPlayerListCount = function (query, cb) {
    console.log("line2363", query);
    mongodb.db.collection('users').count(query, function (err, result) {
        console.log("in admin db query-----------", result);
        cb(err, result);
    });
};

remote.insertVIPAccumulation = function (data, cb) {
    mongodb.db.collection('vipAccumulation').insert(data, function (err, result) {
        cb(err, result);
    });
};
remote.saveInstantBonusHistory = function (data, cb) {
    mongodb.db.collection('instantBonusHistory').insert(data, function (err, result) {
        cb(err, result);
    });
};

remote.findVipAccumulation = function (query, cb) {
    mongodb.db.collection('vipAccumulation').find(query).toArray(function (err, result) {
        cb(err, result);
    });
};



remote.insertVIPRelease = function (data, cb) {
    mongodb.db.collection('vipRelease').insert(data, function (err, result) {
        cb(err, result);
    });
};

remote.expireVipPoints = function (data, cb) {
    mongodb.db.collection('users').updateMany({}, { $set: { "statistics.megaPointLevel": 1, "statistics.countPointsForBonus": 0, "statistics.megaPoints": 0 } }, function (err, result) {
        cb(err, result);
    });
};

remote.getLeaderboardWinners = function (query, cb) {
    mongodb.db.collection('vipAccumulation').aggregate([{ $match: query }, { $group: { _id: { userName: "$userName", pId: "$playerId" }, total: { $sum: "$earnedPoints" }, myCount: { $sum: 1 } } }, { $sort: { total: -1, myCount: -1 } }]).toArray(function (err, result) {
        cb(err, result);
    });
};

remote.getHandRaceWinners = function (query, cb) {
    mongodb.db.collection('vipAccumulation').aggregate([{ $match: query }, { $group: { _id: { userName: "$userName", pId: "$playerId" }, myCount: { $sum: 1 }, total: { $sum: "$earnedPoints" } } }, { $sort: { myCount: -1, total: -1 } }]).toArray(function (err, result) {
        cb(err, result);
    });
};

remote.saveLeaderboardWinners = function (query, cb) {
    mongodb.db.collection('leaderboardWinners').insertOne(query, function (err, result) {
        cb(err, result);
    });
};

remote.getLeaderboardData = function (query, skip, limit, cb) {
    mongodb.db.collection('leaderboardWinners').find(query).sort({ 'endTime': -1 }).skip(skip).limit(limit).toArray(function (err, result) {
        cb(err, result);
    });
};

remote.getCountOfleaderboard = function (query, cb) {
    mongodb.db.collection('leaderboardWinners').count(query, function (err, result) {
        cb(err, result);
    });
};

remote.savePlayerChat = function (query, cb) {
    mongodb.db.collection('playerChat').insertOne(query, function (err, result) {
        cb(err, result);
    });
};

remote.getPlayerChat = function (query, cb) {
    mongodb.db.collection('playerChat').find(query).toArray(function (err, result) {
        cb(err, result);
    });
};

remote.countChatHistory = function (query, callback) {
    mongodb.db.collection('playerChat').count(query, function (err, result) {
        console.log("here in countChatHistory db query err result", err, result);
        callback(err, result);
    });
};

remote.listChatHistory = function (query, cb) {
    var skip = query.skip || 0;
    var limit = query.limit || 0;
    delete query.skip;
    delete query.limit;
    console.log("list chat db query -->", query);
    mongodb.db.collection('playerChat').find(query).sort({ time: -1 }).skip(skip).limit(limit).toArray(function (err, result) {
        cb(err, result);
    });
};


remote.getParticipantDocument = function (query, cb) {
    mongodb.db.collection('leaderboardParticipant').find(query, { projection: { "participantArray._id.pId": 1 } }).toArray(function (err, result) {
        cb(err, result);
    });
};

remote.updateParticipantList = function (query, updateData, cb) {
    mongodb.db.collection('leaderboardParticipant').updateOne(query, updateData, { upsert: true }, function (err, result) {
        cb(err, result);
    });
};

remote.getLeaderboardParticipant = function (query, cb) {
    mongodb.db.collection('leaderboardParticipant').findOne(query, function (err, result) {
        cb(err, result);
    });
};

// Friend collection queries start

remote.updateFriendsData = function (query, updateData, cb) {
  mongodb.db.collection('friends').updateOne(query, updateData, { upsert: false }, function (err, result) {
    cb(err, result);
  })
};

remote.getFriendsData = function (query, cb) {
  mongodb.db.collection('friends').findOne(query, function (err, result) {
    cb(err, result);
  })
}

remote.insertFriendsData = function (data, cb) {
  mongodb.db.collection("friends").insertOne(data, function (err, result) {
    cb(err, result);
  })
}

for (var key in remote) {
    // console.log("===length",key, remote[key].length);



    module.exports[key] = function (key) {
        var args = [].slice.call(arguments);
        args.shift();
        var fn = args.pop();

        // console.log("---line 2382", args, key)

        var startTime = Number(new Date());
        args.push(function (err, result) {
            var endTime = Number(new Date());
            var gap = endTime - startTime;
            // console.log("dbQuery----gap", gap, key)
            // post analyticcs
            var data = {};
            data.section = "dbQuery_" + key;
            data.time = gap;
            data.size = 0;
            postData.saveData(data);
            fn(err, result);
        });
        remote[key].apply(null, args);
    }.bind(null, key);
} 