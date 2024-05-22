/*
 * File: bonusReleaseManager.js
 * Project: PokerSD
 * File Created: Saturday, 31st August 2019 10:12:48 am
 * Author: digvijay (digvijay.singh@pokersd.com)
 * -----
 * Last Modified: Saturday, 31st August 2019 10:12:48 am
 * Modified By: digvijay (digvijay.singh@pokersd.com)
 */

/*jshint node: true */
"use strict";

const async = require("async");
const db = require("../../../../shared/model/dbQuery.js");
const financeDb = require("../../../../shared/model/financeDbQuery.js");
const adminDB = require("../../../../shared/model/adminDbQuery.js");
const _ = require("lodash");
const configConstants = require("../../../../shared/configConstants");
module.exports = function (app) {
  return new ReleaseManager(app);
};

function ReleaseManager(app) {
  this.app = app;
}

ReleaseManager.prototype.scheduleReleaseBonus = () => {
  console.log("cron job - bonus Release Procedure");
  startProcessingBonusRelease();
};

const prepareDateRangeForToday = (params, cb) => {
  console.log("in PrepareDateRange method");
  var t = new Date();
  t.setDate(t.getDate() - 1);
  t.setHours(23);
  t.setMinutes(59);
  t.setSeconds(59);
  var timestamp1 = parseInt(Number(t) / 1000) * 1000;
  t.setHours(0);
  t.setMinutes(0);
  t.setSeconds(0);
  var timestamp2 = parseInt(Number(t) / 1000) * 1000;
  params.startTime = timestamp2;
  params.endTime = timestamp1;
  cb(null, params);
};

const getPlayersLoginToday = (params, cb) => {
  console.log("inside get players login today");
  // const query = { lastLogin: { $gte: params.startTime, $lte: params.endTime } };
  const query = { lastLogin: { $lte: Number(new Date()) } }; // for local testing
  const projection = { projection: { _id: 0 } };
  db.findUsersOpts(query, projection, function (err, result) {
    if (err) {
      //error while getting players, possible nhi h aana
      cb("Error while getting player logged in today");
    } else {
      if (result.length !== 0) {
        //player found to process, ab kaam kro
        params.playerList = result;
        cb(null, params);
      } else {
        // No players found to process release, kaam khtm
        cb(null, {
          success: true,
          info: "No one is getting Vip points released, so yes WORK DONE!",
        });
      }
    }
  });
};

const findBonusDataOfPlayer = (player, params, cb) => {
  const query = {};
  query.playerId = player.playerId;
  db.findUserBonusDetails(query, function (err, result) {
    if (err) {
      cb("Error while getting player bonus data");
    } else {
      if (result.bonus.length !== 0) {
        // player have used bonus code
        const x = _.find(result.bonus, function (object) {
          return object.unClaimedBonus > 0 && object.expireStatus == 0;
        });
        if (x) {
          //player have at lease one unclaimed bonus present
          console.log(
            "player have at lease one unclaimed bonus present" + player.userName
          );
          player.bonusUsedList = result.bonus;
          cb(null, player, params);
        } else {
          //player have no unclaimed locked bonus present.
          console.log(
            "This player has no Unclaimed locked Bonus to release." +
              player.userName
          );
          cb(
            null,
            {
              success: true,
              info: "This player has no Unclaimed locked Bonus to release.",
            },
            params
          );
        }
      } else {
        //player haven't used any bonus code till now
        console.log(
          "This player has not used any bonus till nw." + player.userName
        );
        cb(
          null,
          {
            success: true,
            info: "This player has not used any bonus till nw.",
          },
          params
        );
      }
    }
  });
};

const processBonusRelease = (player, params, cb) => {
  if (player.success) {
    // player have no bonus to release
    cb(null, player, params);
  } else {
    player.amountReleased = 0;
    player.uniqueIdArray = [];
    player.exit = false;
    //     for (let i = 0; i < player.bonusUsedList.length; i++) {
    //         if (player.bonusUsedList[i].unClaimedBonus > 0 && player.bonusUsedList[i].expireStatus == 0) {
    //             var tempAmt = (configConstants.percentForBonusRelease * player.bonusUsedList[i].unClaimedBonus) / 100;
    //             if (tempAmt <= player.statistics.countPointsForBonus) {
    //                 player.statistics.countPointsForBonus = player.statistics.countPointsForBonus - tempAmt;
    //                 player.bonusUsedList[i].claimedBonus = player.bonusUsedList[i].unClaimedBonus;
    //                 player.bonusUsedList[i].expireStatus = 2;
    //                 player.bonusUsedList[i].unClaimedBonus = 0;
    //                 player.uniqueIdArray.push(player.bonusUsedList[i].uniqueId);
    //                 player.amountReleased = player.amountReleased + player.bonusUsedList[i].claimedBonus;
    //                 createPassbookEntry(player, player.bonusUsedList[i].claimedBonus, player.amountReleased-player.bonusUsedList[i].claimedBonus);
    //             }else{
    //                 return cb(null, player, params);
    //             }
    //         }
    //     }
    // }
    console.log("player");
    async.eachSeries(
      player.bonusUsedList,
      function (bonus, ecb) {
        // async.waterfall([
        //     async.apply(processBonus, bonus, player, params),
        //     createPassbook
        // ], function (err, bonus, player, params) {
        //     console.log("player11"+JSON.stringify(err));
        //     console.log("player12"+JSON.stringify(bonus));
        //     console.log("player13"+JSON.stringify(player));
        //     console.log("player14"+JSON.stringify(params));
        //     ecb(null);
        // });
        if (
          bonus.unClaimedBonus > 0 &&
          bonus.expireStatus == 0 &&
          !player.exit
        ) {
          var tempAmt =
            (configConstants.percentForBonusRelease * bonus.unClaimedBonus) /
            100;
          if (player.statistics.countPointsForBonus >= tempAmt) {
            player.statistics.countPointsForBonus =
              player.statistics.countPointsForBonus - tempAmt;
            bonus.claimedBonus = bonus.unClaimedBonus;
            bonus.expireStatus = 2;
            bonus.unClaimedBonus = 0;
            player.uniqueIdArray.push(bonus.uniqueId);
            player.amountReleased = player.amountReleased + bonus.claimedBonus;
            console.log("here processed" + player.userName);
            const query = { playerId: player.playerId };
            const passbookData = {};
            passbookData.time = Number(new Date());
            passbookData.prevAmt =
              player.realChips +
              player.instantBonusAmount +
              player.amountReleased -
              bonus.claimedBonus;
            passbookData.amount = bonus.claimedBonus;
            passbookData.newAmt =
              player.realChips +
              bonus.claimedBonus +
              player.instantBonusAmount +
              player.amountReleased -
              bonus.claimedBonus;
            passbookData.category = "Bonus Released";
            passbookData.subCategory = "Locked Bonus";
            adminDB.createPassbookEntry(
              query,
              passbookData,
              function (err, result) {
                ecb(null);
                // cb(null, bonus, player, params);
              }
            );
            // cb(null, bonus, player, params);
          } else {
            player.exit = true;
            console.log("here exit" + player.userName);
            ecb(null);
            // cb('Do not process', bonus, player, params);
          }
        } else {
          console.log("here dont" + player.userName);
          ecb(null);
          // cb('Donot process', bonus, player, params);
        }
      },
      function (err, result) {
        console.log("player1" + JSON.stringify(err));
        // console.log("player2"+JSON.stringify(bonus));
        console.log("player3" + JSON.stringify(player));
        console.log("player4" + JSON.stringify(params));
        cb(null, player, params);
      }
    );
  }
};

const processBonus = (bonus, player, params, cb) => {
  if (bonus.unClaimedBonus > 0 && bonus.expireStatus == 0 && !player.exit) {
    var tempAmt =
      (configConstants.percentForBonusRelease * bonus.unClaimedBonus) / 100;
    if (player.statistics.countPointsForBonus >= tempAmt) {
      player.statistics.countPointsForBonus =
        player.statistics.countPointsForBonus - tempAmt;
      bonus.claimedBonus = bonus.unClaimedBonus;
      bonus.expireStatus = 2;
      bonus.unClaimedBonus = 0;
      player.uniqueIdArray.push(bonus.uniqueId);
      player.amountReleased = player.amountReleased + bonus.claimedBonus;
      console.log("here processed" + player.userName);
      cb(null, bonus, player, params);
    } else {
      player.exit = true;
      console.log("here exit" + player.userName);
      cb("Do not process", bonus, player, params);
    }
  } else {
    console.log("here dont" + player.userName);
    cb("Donot process", bonus, player, params);
  }
};

const createPassbook = (bonus, player, params, cb) => {
  const query = { playerId: player.playerId };
  const passbookData = {};
  passbookData.time = Number(new Date());
  passbookData.prevAmt =
    player.realChips +
    player.instantBonusAmount +
    player.amountReleased -
    bonus.claimedBonus;
  passbookData.amount = bonus.claimedBonus;
  passbookData.newAmt =
    player.realChips +
    bonus.claimedBonus +
    player.instantBonusAmount +
    player.amountReleased -
    bonus.claimedBonus;
  passbookData.category = "Bonus Released";
  passbookData.subCategory = "Locked Bonus";
  adminDB.createPassbookEntry(query, passbookData, function (err, result) {
    cb(null, bonus, player, params);
  });
};

// const createPassbookEntry = (player, currentAmount, addAmount) => {
//     const query = { playerId: player.playerId };
//     const passbookData = {};
//     passbookData.time= Number(new Date());
//     passbookData.prevAmt = player.realChips + player.instantBonusAmount + addAmount;
//     passbookData.amount = currentAmount;
//     passbookData.newAmt = player.realChips + currentAmount + player.instantBonusAmount + addAmount;
//     passbookData.category= "Bonus Released";
//     passbookData.subCategory= "Locked Bonus";
//     adminDB.createPassbookEntry(query, passbookData, function (err, result) {
//         console.log("Passbook entry for Bonus Released");
//     });
// };

const updatePlayerAccountAndBonus = (player, params, cb) => {
  console.log("updated plAYER" + JSON.stringify(player));
  console.log("player" + player.userName);
  if (player.success) {
    // player have no bonus to release
    cb(null, player, params);
    return;
  }
  const query = { playerId: player.playerId };
  const updateData = {
    $inc: { realChips: player.amountReleased },
    $set: { statistics: player.statistics },
  };
  db.returnRealChipsToPlayer(query, updateData, function (err, result) {
    if (err) {
      cb("Error while updating player account balance");
    } else {
      //update bonus data now
      db.updateBounsDataSetKeys(
        query,
        { bonus: player.bonusUsedList },
        function (err, result) {
          if (err) {
            cb("Error while updating bonus data");
          } else {
            cb(null, player, params);
          }
        }
      );
    }
  });
};

const updateBalanceSheet = (player, params, cb) => {
  if (player.success) {
    // player have no bonus to release
    cb(null, player, params);
    return;
  }
  var query = { $inc: { lockedBonusReleased: player.amountReleased } };
  financeDb.updateBalanceSheet(query, function (err, result) {
    if (err) {
      cb("Balance sheet updation failed");
    } else {
      cb(null, player, params);
    }
  });
};

const updateExpiryDocuments = (player, params, cb) => {
  if (player.success) {
    // player have no bonus to release
    cb(null, player, params);
    return;
  }
  const query = {
    playerId: player.playerId,
    uniqueId: { $in: player.uniqueIdArray },
  };
  console.log("query" + query + "playername" + player.userName);
  const update = { $set: { expireStatus: 2 } };
  db.updateManyExpirySlot(query, update, function (err, result) {
    if (err) {
      cb("Expiry slot updation failed");
    } else {
      console.log("updated expiry doc" + JSON.stringify(player));
      console.log("expiry doc resut" + JSON.stringify(result));
      cb(null, player, params);
    }
  });
};

const processEveryPlayer = (params, cb) => {
  console.log("inside process every player" + params);
  console.log(params);
  console.log(JSON.stringify(params));
  if (params.success) {
    cb(null, params);
  } else {
    //process to release bonus if criteria met
    async.eachSeries(
      params.playerList,
      function (player, ecb) {
        async.waterfall(
          [
            async.apply(findBonusDataOfPlayer, player, params),
            processBonusRelease,
            updatePlayerAccountAndBonus,
            updateBalanceSheet,
            updateExpiryDocuments,
          ],
          function (err, player, params) {
            // body...
            console.log("player info final" + JSON.stringify(player));
            ecb(err, params);
          }
        );
      },
      function (err, params) {
        // body...
        cb(err, params);
      }
    );
  }
};

/**
 * This is used for processing the release of locked bonus of players.
 */
const startProcessingBonusRelease = () => {
  async.waterfall(
    [
      async.apply(prepareDateRangeForToday, {}),
      getPlayersLoginToday,
      processEveryPlayer,
    ],
    function (err, result) {
      if (err) {
        console.error(err);
      } else {
        console.log(result);
      }
    }
  );
};
