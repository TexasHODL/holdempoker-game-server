/*
 * @Author: digvijay
 * @Date:   2019-06-13 12:06:25
 * @Last Modified by:   naman jain
 * @Last Modified time: 2019-09-27 12:44:43
 */

/*jshint node: true */
"use strict";

var async = require("async");
var _ = require("underscore");
var adminDb = require("../../../../shared/model/adminDbQuery");
var db = require("../../../../shared/model/dbQuery");
var logDb = require("../../../../shared/model/logDbQuery");
var financeDb = require("../../../../shared/model/financeDbQuery");
var profileMgmt = require("../../../../shared/model/profileMgmt.js");
const pomelo = require("pomelo");
const configConstants = require("../../../../shared/configConstants");

module.exports = function (app) {
  return new LeaderboardManager(app);
};

function LeaderboardManager(app) {
  this.app = app;
}

function IndianFormat(timestamp) {
  timestamp = timestamp + 5.5 * (60 * 60 * 1000);
  var D = new Date(timestamp);
  var monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return (
    "" +
    monthNames[D.getMonth()] +
    " " +
    D.getDate() +
    " " +
    D.getFullYear() +
    ", " +
    D.getHours() +
    ":" +
    D.getMinutes() +
    ":" +
    D.getSeconds()
  );
}

/**
 * This method is used to send mail to the winners of the leaderboard
 * @method
 * @author Digvijay Rathore
 * @date   2019-07-25
 * @param  {Object}   player          player information in object
 * @param  {String}   leaderboardName leaderboardName
 */
var sendMailAndMessageToWinners = (player, leaderboard) => {
  let text = "";
  let msgText = "";
  let mailTemplate = "";
  if (
    leaderboard.leaderboardType == "openVip" ||
    leaderboard.leaderboardType == "closedVip"
  ) {
    text = "LEADERBOARD POINTS";
    msgText = "VIP";
    mailTemplate = "leaderboardWinner";
  } else {
    text = "HANDS";
    msgText = "HAND";
    mailTemplate = "leaderboardWinnerHand";
  }
  // if (leaderboard.leaderboardType == 'openVip' || leaderboard.leaderboardType == 'closedVip') {
  const rank = [
    "1st",
    "2nd",
    "3rd",
    "4th",
    "5th",
    "6th",
    "7th",
    "8th",
    "9th",
    "10th",
    "11th",
    "12th",
    "13th",
    "14th",
    "15th",
    "16th",
    "17th",
    "18th",
    "19th",
    "20th",
  ];
  console.log("send mail to winners" + JSON.stringify(player));
  let blindsArray = [];
  for (let i = 0; i < leaderboard.tables.length; i++) {
    var blinds =
      leaderboard.tables[i].smallBlind + "/" + leaderboard.tables[i].bigBlind;
    if (blindsArray.indexOf(blinds) < 0) {
      blindsArray.push(blinds);
    }
  }
  let startTime = IndianFormat(leaderboard.startTime);
  let endTime = IndianFormat(leaderboard.endTime);
  var mailData = {
    to_email: player.email,
    from_email: configConstants.from_email,
    subject: "CONGRATULATIONS !! YOU ARE THE WINNER",
    template: mailTemplate,
    content: {
      userName: player._id.userName,
      amountWon: player.amountWon,
      rank: rank[player.rank - 1],
      leaderboardName: leaderboard.leaderboardName,
      stakes: blindsArray.toString(),
      startTime: startTime,
      endTime: endTime,
      vipPoints: player.total,
      prizePool: leaderboard.totalPrizePool,
      text: text,
    },
  };
  pomelo.app.rpc.connector.adminManagerRemote.sendLeaderboardWinnerMail(
    "",
    mailData,
    function (response) {
      console.log("response in send mail", response);
    }
  );
  var msgData = {};
  msgData.mobileNumber = player.mobile;
  msgData.msg =
    "Dear " +
    player._id.userName +
    ", The result of the " +
    msgText +
    " RACE has been announced. Kindly check your email to see the result or visit at www.pokermoogley.com";
  pomelo.app.rpc.connector.adminManagerRemote.sendMsgToLeaderboardWinners(
    "",
    msgData,
    function (response) {
      console.log("msg response", response);
    }
  );
  // }
};

var getListOfActiveLeaderboards = (params, cb) => {
  let query = { status: "Running", endTime: { $lte: Number(new Date()) } };
  adminDb.listLeaderboard(query, function (err, result) {
    if (err) {
      cb("Error in getting leaderboard list");
    } else if (result.length == 0) {
      params.leaderboardList = [];
      cb(null, params);
    } else {
      params.leaderboardList = result;
      cb(null, params);
    }
  });
};

var addAmountInPlayerAccount = (player) => {
  var data = {};
  data.isRealMoney = true;
  data.playerId = player._id.pId;
  data.chips = player.amountWon;
  data.category = "Leaderboard Winnning";
  //update real chips in player profile
  profileMgmt.addChips(data, function (response) {
    if (response.success) {
      console.log("player chips added");
      //update balance sheet leaderboard winnings amount
      financeDb.updateBalanceSheet(
        { $inc: { leaderboardWinning: player.amountWon || 0 } },
        function (err, result) {
          console.log("Balance sheet updated");
        }
      );
      //update total leaderboard winnings of the player
      db.returnRealChipsToPlayer(
        { playerId: player._id.pId },
        { $inc: { totalLeaderboardWinnings: player.amountWon } },
        function (err, result1) {
          console.log("if errr " + err);
        }
      );
    } else {
      process.emit("forceMail", {
        title: "for leaderboard-winnings",
        data: player,
      });
    }
  });
};

var getPlayersCrossedVipCriteria = (leaderboard, params, cb) => {
  if (
    leaderboard.leaderboardType == "openVip" ||
    leaderboard.leaderboardType == "closedVip"
  ) {
    if (leaderboard.participantsArray.length > 0) {
      console.log("participants array-" + leaderboard.participantsArray);
      // leaderboard.expectedWinners = _.filter(leaderboard.participantsArray, function (obj) {
      // console.log("onj" + obj);
      // return obj.total >= leaderboard.minVipPoints;
      // });
      // changed vip crossed criteria no check during winner declaration
      leaderboard.expectedWinners = leaderboard.participantsArray;
    }
  } else {
    if (leaderboard.participantsArray.length > 0) {
      console.log("participants array-" + leaderboard.participantsArray);
      // leaderboard.expectedWinners = _.filter(leaderboard.participantsArray, function (obj) {
      // console.log("onj" + obj);
      // return obj.myCount >= leaderboard.minHands;
      // });
      //changed criteria
      leaderboard.expectedWinners = leaderboard.participantsArray;
    }
  }
  cb(null, leaderboard, params);
};

var checkParticipantsAndAssignRank = (leaderboard, params, cb) => {
  console.log(
    "Inside filter player min vip points" + JSON.stringify(leaderboard)
  );
  console.log("params" + JSON.stringify(params));
  // if (!!leaderboard.expectedWinners && (leaderboard.expectedWinners.length >= leaderboard.noOfWinners)) {
  // 	leaderboard.winnerDeclared = true;
  // } else if(leaderboard.leaderboardType == "openVip" || leaderboard.leaderboardType == 'openHand'){
  // 	leaderboard.winnerDeclared = true;
  // }else{
  // 	console.log('Player not sufficient to announce leaderboard winners');
  // 	leaderboard.winnerDeclared = false;
  // 	process.emit('forceMail', { title: "for leaderboard", data: 'Player not sufficient to announce leaderboard winners for ' + leaderboard.leaderboardId });
  // }
  leaderboard.winnerDeclared = true; // always declare winners
  let i = 1;
  async.eachSeries(
    leaderboard.participantsArray,
    function (player, ecb) {
      console.log("player " + i);
      console.log(JSON.stringify(player));
      if (leaderboard.winnerDeclared) {
        if (
          (leaderboard.leaderboardType == "openVip" ||
            leaderboard.leaderboardType == "closedVip") &&
          player.total >= leaderboard.minVipPoints
        ) {
          player.amountWon = leaderboard.payout[i - 1] || 0;
          player.rank = i <= leaderboard.noOfWinners ? i : "N/A";
        } else if (
          (leaderboard.leaderboardType == "openHand" ||
            leaderboard.leaderboardType == "closedHand") &&
          player.total >= leaderboard.minHands
        ) {
          player.amountWon = leaderboard.payout[i - 1] || 0;
          player.rank = i <= leaderboard.noOfWinners ? i : "N/A";
        } else {
          player.amountWon = 0;
          player.rank = "N/A";
        }
      } else {
        player.amountWon = 0;
        player.rank = "N/A";
      }
      db.findUser({ playerId: player._id.pId }, function (err, result) {
        if (err || !result) {
          console.log("No data for player found");
          ecb(null);
        } else {
          console.log("dbQuery find " + result);
          player._id.userName = result.userName;
          player.email = result.emailId;
          player.mobile = result.mobileNumber;
          player.parentName = result.isParentUserName;
          ecb(null);
        }
      });
      i++;
    },
    function (err1, result1) {
      console.log("here in async end" + JSON.stringify(leaderboard));
      cb(null, leaderboard, params);
    }
  );
};

var saveWinnerAndParticipants = (leaderboard, params, cb) => {
  console.log("data goiong to save in leaderboard");
  console.log(JSON.stringify(leaderboard));
  var data = {};
  data.leaderboardId = leaderboard.leaderboardId;
  data.leaderboardName = leaderboard.leaderboardName;
  data.leaderboardType = leaderboard.leaderboardType;
  data.minVipPoints = leaderboard.minVipPoints;
  data.minHands = leaderboard.minHands;
  data.noOfWinners = leaderboard.noOfWinners;
  data.totalPrizePool = leaderboard.totalPrizePool;
  data.tables = leaderboard.tables;
  data.payout = leaderboard.payout;
  data.startTime = leaderboard.startTime;
  data.endTime = leaderboard.endTime;
  data.participantsArray = leaderboard.participantsArray;
  data.expectedWinners = leaderboard.expectedWinners || [];
  data.winnerDeclared = leaderboard.winnerDeclared;
  db.saveLeaderboardWinners(data, function (err, result) {
    if (err) {
      cb("Error while saving leaderboard winnner data");
    } else {
      cb(null, leaderboard, params);
    }
  });
};

/**
 * Update Each player amount won and inform them  by mail and message.
 * @method updatePlayerBalanceAndInform
 * @author Digvijay Rathore
 * @date   2019-07-17
 * @param  {Object}   leaderboard curent leaderboard processing object
 * @param  {Object}   params      whole object of the requset
 * @param  {Function} cb          callback as a function
 */
var updatePlayerBalanceAndInform = (leaderboard, params, cb) => {
  async.each(
    leaderboard.participantsArray,
    function (player, ecb) {
      if (player.amountWon > 0) {
        //send mail and message over here
        sendMailAndMessageToWinners(player, leaderboard);
        addAmountInPlayerAccount(player);
      } else {
        // other mail content
        // sendMailAndMsgToParticipants(player, leaderboard.leaderboardName);
        console.log("Donot send mail to other");
      }
      ecb(null);
    },
    function (err, result) {
      cb(null, leaderboard, params);
    }
  );
};

/**
 * Set the status of the leaderboard which are going to expire.
 * @method setLeaderboardToExpired
 * @author Digvijay Rathore
 * @date   2019-07-17
 * @param  {Object}   leaderboard curent leaderboard processing object
 * @param  {Object}   params      whole object of the requset
 * @param  {Function} cb          callback as a function
 */
var setLeaderboardToExpired = (leaderboard, params, cb) => {
  var query = { leaderboardId: leaderboard.leaderboardId };
  var updateData = { status: "Expired" };
  adminDb.updateLeaderboard(query, updateData, function (err, result) {
    if (err) {
      console.log(
        "Error while updating leaderboard status to Expired" +
          leaderboard.leaderboardId
      );
      cb(
        "Error while updating leaderboard status to Expired" +
          leaderboard.leaderboardId
      );
    } else {
      cb(null, leaderboard, params);
    }
  });
};

var sortParticipantsData = (leaderboard, params, cb) => {
  // if (leaderboard.leaderboardType == 'openHand' || leaderboard.leaderboardType == 'closedHand') {
  // 	leaderboard.participantsArray.sort(function (a, b) {
  // 		if (a.myCount == b.myCount)
  // 			return a.prev - b.prev;
  // 		return b.myCount - a.myCount;
  // 	});
  // 	cb(null, leaderboard, params);
  // } else {
  leaderboard.participantsArray.sort(function (a, b) {
    if (a.total == b.total) return b.myCount - a.myCount;
    return b.total - a.total;
  });
  cb(null, leaderboard, params);
  // }
};

var getPlayerUsedCodeForClosedRace = (leaderboard, params, cb) => {
  console.log("method 3", params);
  if (
    leaderboard.leaderboardType == "closedVip" ||
    leaderboard.leaderboardType == "closedHand"
  ) {
    let query = leaderboard.bonusId;
    db.findBonusCodeUsedByPlayers(query, function (err, result) {
      if (err) {
        cb("Error while getting players bonus data");
      } else {
        leaderboard.playerBonusList = result;
        cb(null, leaderboard, params);
      }
    });
  } else {
    cb(null, leaderboard, params);
  }
};

var forEveryLeaderboard = (params, cb) => {
  console.log("For every leaderboard");
  if (params.leaderboardList.length > 0) {
    async.eachSeries(
      params.leaderboardList,
      function (leaderboard, ecb) {
        console.log("Leaderboard going to process" + leaderboard);
        if (
          leaderboard.leaderboardType == "openVip" ||
          leaderboard.leaderboardType == "openHand"
        ) {
          async.waterfall(
            [
              async.apply(findParticipantOfLeaderboard, leaderboard, params),
              sortParticipantsData,
              getPlayersCrossedVipCriteria,
              checkParticipantsAndAssignRank,
              saveWinnerAndParticipants,
              updatePlayerBalanceAndInform,
              setLeaderboardToExpired,
            ],
            function (err, result) {
              if (err) {
                console.log("force mail");
                process.emit("forceMail", {
                  title: "for leaderboard",
                  data: err,
                });
              }
              ecb(null);
            }
          );
        } else if (
          leaderboard.leaderboardType == "closedVip" ||
          leaderboard.leaderboardType == "closedHand"
        ) {
          async.waterfall(
            [
              async.apply(getPlayerUsedCodeForClosedRace, leaderboard, params),
              findParticipantOfLeaderboard,
              assignBonusPlayerInParticipants,
              sortParticipantsData,
              getPlayersCrossedVipCriteria,
              checkParticipantsAndAssignRank,
              saveWinnerAndParticipants,
              updatePlayerBalanceAndInform,
              setLeaderboardToExpired,
            ],
            function (err, result) {
              if (err) {
                console.log("force mail");
                process.emit("forceMail", {
                  title: "for leaderboard",
                  data: err,
                });
              }
              ecb(null);
            }
          );
        } else {
          ecb(null);
        }
      },
      function (err) {
        cb(err, params);
      }
    );
  } else {
    cb(null, params);
  }
};

const findParticipantOfLeaderboard = (leaderboard, params, cb) => {
  console.log("the params in findParticipantOfLeaderboard", leaderboard);
  const query = {};
  query.leaderboardId = leaderboard.leaderboardId;
  db.getLeaderboardParticipant(query, function (err, result) {
    if (err) {
      cb("Error while fetching participants");
    } else if (!!result) {
      var tempArray = _.map(result.participantArray, function (obj) {
        obj.total = Number(obj.total.toFixed(4));
        return obj;
      });
      leaderboard.participantsArray = tempArray;
      cb(null, leaderboard, params);
    } else {
      leaderboard.participantsArray = [];
      cb(null, leaderboard, params);
    }
  });
};

const assignBonusPlayerInParticipants = (leaderboard, params, cb) => {
  const remainingPlayers = _.difference(
    _.pluck(leaderboard.playerBonusList, "playerId"),
    _.pluck(_.pluck(leaderboard.participantsArray, "_id"), "pId")
  );
  if (remainingPlayers.length > 0) {
    async.each(
      remainingPlayers,
      function (playerId, ecb) {
        db.findUser({ playerId: playerId }, function (err, result) {
          if (err) {
            console.log("No data for player found");
            ecb(null);
          } else if (!!result) {
            const playerObject = {};
            playerObject._id = {
              userName: result.userName,
              pId: result.playerId,
            };
            playerObject.total = 0;
            playerObject.myCount = 0;
            leaderboard.participantsArray.push(playerObject);
            ecb(null);
          } else {
            // ignore this case (mostly for bots)
            const playerObject = {};
            playerObject._id = {
              userName: "Player",
              pId: "1",
            };
            playerObject.total = 0;
            playerObject.myCount = 0;
            leaderboard.participantsArray.push(playerObject);
            ecb(null);
          }
        });
      },
      function (err, result) {
        cb(null, leaderboard, params);
      }
    );
  } else {
    cb(null, leaderboard, params);
  }
};

var changeStatusofUpcomingLeaderboard = (params, cb) => {
  let time = Number(new Date());
  var query = { status: "Waiting", startTime: { $lte: time } };
  var updateData = { status: "Running" };
  adminDb.changeStatusLeaderboard(query, updateData, function (err, result) {
    if (err) {
      cb("The status for upcoming leaderboard is not changed.");
      process.emit("forceMail", {
        title: "for leaderboard",
        data: "The status for upcoming leaderboard is not changed.",
      });
    } else {
      cb(null, params);
    }
  });
};

LeaderboardManager.prototype.processLeaderboard = function () {
  console.log("cron job - for saving leaderboard data");
  async.waterfall(
    [
      async.apply(getListOfActiveLeaderboards, {}),
      forEveryLeaderboard,
      changeStatusofUpcomingLeaderboard,
    ],
    function (err, result) {
      if (err) {
        console.error("Error in leaderboard processing " + err);
      } else {
        console.trace("Leaderboard processing successfull");
      }
    }
  );
};
