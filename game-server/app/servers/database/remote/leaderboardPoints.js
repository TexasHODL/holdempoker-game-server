/*
 * File: leaderboardPoints.js
 * Project: PokerSD
 * File Created: Tuesday, 24th September 2019 12:48:01 pm
 * Author: digvijay (digvijay.singh@pokersd.com)
 * -----
 * Last Modified: Tuesday, 24th September 2019 12:48:02 pm
 * Modified By: digvijay (digvijay.singh@pokersd.com)
 */

/*jshint node: true */
"use strict";

const async = require('async');
const _ = require('underscore');
const db = require('../../../../shared/model/dbQuery.js');
const configConstants = require('../../../../shared/configConstants');
const leaderboardPoints = {};

/**
 * This method is sed to find the list of the player used bonus code if leaderboard type is closed.
 * @param {Object} leaderboard leaderboard detail
 * @param {Object} player player info Object
 * @param {Function} cb Callback function
 */
const findPlayerBonusList = (leaderboard, player, cb) => {
    console.log("inside find player bonus list" + leaderboard.leaderboardType);
    if((leaderboard.leaderboardType == "closedVip" || leaderboard.leaderboardType == "closedHand")){
        // need player used bonus code list
        console.log("leaderboard is of Closed type" + leaderboard.leaderboardType);
        db.findBonusCodeUsedByPlayers(leaderboard.bonusId, function (err, bonusResult) {	//find players who have used bonus code
            console.log("player bonus list"+ bonusResult);
            if (err || bonusResult.length == 0) {
                // no player used bonus code
                leaderboard.playerBonusList = [];
                cb(null, leaderboard, player);
            } else {
                // players used bonus code in list
                leaderboard.playerBonusList = _.pluck(bonusResult, 'playerId');
                cb(null, leaderboard, player);
            }
        });
    }else{
        // Donot need player used bonus list
        console.log("Leaderboard is of open type" + leaderboard.leaderboardType);
        cb(null, leaderboard, player);
    }
};

/**
 * This method finds the participant array of the specific leaderboard with leaderboardId.
 * @param {Object} leaderboard leaderboard details
 * @param {Object} player player Object
 * @param {Function} cb Callback function
 */
const findParticipantArrayOfLeaderboard = (leaderboard, player, cb) =>{
    console.log("inside fidnd participnat array" + leaderboard.leaderboardType);
    db.getParticipantDocument({ leaderboardId: leaderboard.leaderboardId }, function (err, participantResult) {
        console.log("inside get participant array " + err + " participantResult " + JSON.stringify(participantResult));
        if (err || participantResult.length == 0) {
            leaderboard.participantArray = [];
            cb(null, leaderboard, player);
        } else {
            leaderboard.participantArray = _.pluck(_.pluck(participantResult[0].participantArray, '_id'), "pId");
            console.log("leaderboard.participantArray" + JSON.stringify(leaderboard.participantArray));
            cb(null, leaderboard, player);
        }
    });
};

/**
 * This method increment player data in specific leaderboard on basis of hand and Vip race.
 * @param {Object} leaderboard leaderboard Object
 * @param {Object} player Player object
 * @param {Function} cb Callback function
 */
const incrementPlayerLeaderboardData = (leaderboard, player, cb) => {
    console.log("inside updateplayer data" + leaderboard.leaderboardType);
    const query = { leaderboardId: leaderboard.leaderboardId, "participantArray._id.pId": player.playerId };
    let updateData = {};
    if (leaderboard.leaderboardType == "closedVip" || leaderboard.leaderboardType == "openVip") {
        console.log("inside increment vip data");
        updateData = { $inc: { "participantArray.$.total": player.addleaderboardPoint, "participantArray.$.myCount": 1 }, $set: { "participantArray.$.parentName": player.parentName } };
    } else if ((leaderboard.leaderboardType == "closedHand" || leaderboard.leaderboardType == "openHand") && (leaderboard.minRake < player.rakeAmount1)){
        console.log("inside increment hand data");
        if (leaderboard.totalPlayers == 2 && configConstants.isHeadsUpLeaderboard) {
            //heads up
            updateData = { $inc: { "participantArray.$.headsUP": 1, "participantArray.$.myCount": 1 }, $set: { "participantArray.$.parentName": player.parentName } };
        } else {
            // not headsup case
            updateData = { $inc: { "participantArray.$.total": 1, "participantArray.$.myCount": 1 }, $set: { "participantArray.$.parentName": player.parentName } };
        }
    }else{
        console.log("Don't update player data as minRake greater than player rake.");
        cb(null, leaderboard, player);
        return true;    // mandatory return
    }
    console.log("for player" + player.userName + "data is" + JSON.stringify(updateData));
    db.updateParticipantList(query, updateData, function (err, result) {
        if (err) {
            console.error("Participant data not updated");
        } else {
            console.log("Participant data updated ");
        }
        cb(null, leaderboard, player);
    });
};

/**
 * This method insert the first data of the player in the leaderboard.
 * @param {Object} leaderboard leaderboard Object
 * @param {Object} player player info Object
 * @param {Function} cb Callback function
 */
const insertPlayerLeaderboardData = (leaderboard, player, cb) =>{ 
    console.log("inside insertPlayer data" + leaderboard.leaderboardType);
    let playerObject = {};
    if (leaderboard.leaderboardType == "closedVip" || leaderboard.leaderboardType == "openVip") {
        console.log("inside insert vip data");
        playerObject = {
            _id: {
                userName: player.userName,
                pId: player.playerId
            },
            total: player.addleaderboardPoint,
            myCount: 1,
            parentName: player.parentName
        };
    } else if ((leaderboard.leaderboardType == "closedHand" || leaderboard.leaderboardType == "openHand") && (leaderboard.minRake < player.rakeAmount1)) {
        console.log("inside insert hand data");
        playerObject._id = { userName: player.userName, pId: player.playerId };
        playerObject.myCount = 1;
        playerObject.parentName = player.parentName;
        if (leaderboard.totalPlayers == 2 && configConstants.isHeadsUpLeaderboard) {
            // if heads up true i.e. to be checked
            playerObject.total = 0;
            playerObject.headsUP = 1;
        } else {
            // if heads up false
            playerObject.total = 1;
            playerObject.headsUP = 0;
        }
    }else{
        console.log("Donot update player data as min Rake greater than player actual rake generated");
        cb(null, leaderboard, player);
        return true;  // mandatory return
    }
    const query = { leaderboardId: leaderboard.leaderboardId };
    console.log("for player" + player.userName + "data is" + JSON.stringify(playerObject));
    db.updateParticipantList(query, { $push: { participantArray: playerObject }, $setOnInsert: { leaderboardName: leaderboard.leaderboardName } }, function (err, result) {
        if (err) {
            console.error("Participant data not updated" + err);
        } else {
            console.log("Participant data updated" + result);
        }
        cb(null, leaderboard, player);
    });
};

/**
 * This method update the player data in leaderboard if going to on basis of certain condition.
 * @param {Object} leaderboard leaderboard details
 * @param {Object} player player info
 * @param {Function} cb Callback function
 */
const updatePlayerLeaderboardData = (leaderboard, player, cb) => {
    console.log("inside check if player used bonus code or not"+ leaderboard.leaderboardType);
    player.addleaderboardPoint = (player.rakeAmount1 * leaderboard.percentAccumulation) / 100;
    if ((leaderboard.leaderboardType == "closedVip" || leaderboard.leaderboardType == "closedHand") && (leaderboard.playerBonusList.length > 0) && (player.addleaderboardPoint > 0)){
        // for Closed VIP and Closed Hand Race
        console.log("for Closed VIP and Closed Hand Race");
        if (leaderboard.playerBonusList.indexOf(player.playerId) > -1) {
            //player used leaderboard entry bonus code
            console.log("player used leaderboard entry bonus code");
            if (leaderboard.participantArray.length > 0 && leaderboard.participantArray.indexOf(player.playerId) > -1) {
                // player already present in the array, increment the value
                console.log("player already present in the array, increment the value");
                incrementPlayerLeaderboardData(leaderboard, player, function (err, leaderboard, player){
                    console.log("increment player points in leaderboard successfull");
                    cb(null, leaderboard, player);
                });
            }else{
                // player not present in the array, set its data
                console.log("player not present in the array, set its data");
                insertPlayerLeaderboardData(leaderboard, player, function(err, leaderboard, player){
                    console.log("insertion of the player successful");
                    cb(null, leaderboard, player);
                });
            }
        }else{
            // player not used leaderboard entry bonus code, nothing to process
            console.log("player not used leaderboard entry bonus code, nothing to process");
            cb(null, leaderboard, player);
        }
    } else if ((leaderboard.leaderboardType == "openVip" || leaderboard.leaderboardType == "openHand") && (player.addleaderboardPoint > 0)){
        // for Open VIP and Open Hand Race
        console.log("for Open VIP and Open Hand Race");
        if (leaderboard.participantArray.length > 0 && leaderboard.participantArray.indexOf(player.playerId) > -1) {
            // player already present in the array, increment the value
            console.log("player already present in the array, increment the value");
            incrementPlayerLeaderboardData(leaderboard, player, function (err, leaderboard, player) {
                console.log("increment player points in leaderboard successfull");
                cb(null, leaderboard, player);
            });
        }else{
            // player not present in the array, set its data
            console.log("player not present in the array, set its data");
            insertPlayerLeaderboardData(leaderboard, player, function (err, leaderboard, player) {
                console.log("insertion of the player successful");
                cb(null, leaderboard, player);
            });
        }
    }else{
        cb(null, leaderboard, player);
    }
};

/**
 * This method is used to add leadeboard points of the specific player in various leaderboard which are associated 
 * with the current channel (Table).
 */
leaderboardPoints.addPlayerLeaderboardPoints = (player, params, cb) => {
    console.log("inside addPlayerLeaderboardPOints"+ player + params);
    async.eachSeries(params.leaderboardData, function(leaderboard, ecb){
        leaderboard.totalPlayers = params.players.length;
        async.waterfall([
            async.apply(findPlayerBonusList, leaderboard, player),  // for closed
            findParticipantArrayOfLeaderboard,      // for all
            updatePlayerLeaderboardData
        ], function (err, result) {
            ecb(null);
        });
    }, function (err, resultSeries) {
        cb(null, player, params);
    });
};

module.exports = leaderboardPoints;