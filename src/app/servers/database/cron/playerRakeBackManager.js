/*
/*
* @Author: sushiljainam
* @Date:   2017-07-27 12:33:48
* @Last Modified by:   digvijay
* @Last Modified time: 2019-05-21 15:35:03
*/

/*jshint node: true */
"use strict";

var async = require("async");
var db = require("../../../../shared/model/dbQuery");
var admindb = require("../../../../shared/model/adminDbQuery");
var financeDB = require("../../../../shared/model/financeDbQuery");
var profileMgmt = require("../../../../shared/model/profileMgmt.js");
var logDB = require("../../../../shared/model/logDbQuery");
console.log("\n\n\n line 15-----------------");

module.exports = function (app) {
  return new RakeBackManager(app);
  // console.log("line 15-----------------", require('pomelo').app);
};

function RakeBackManager(app) {
  this.app = app;
}

/**
 * get Each Player Rake Back record from finance database
 * @method getEachPlayerRakeBack
 */
var getEachPlayerRakeBack = function (params, cb) {
  var query = {};
  query.createdAt = dateToEpoch(Number(new Date())) - 86400000;
  financeDB.playerRakeBackDateData(query, function (err, result) {
    if (err) {
      cb(err);
    } else {
      params.rakeBackData = result;
      cb(null, params);
    }
  });
};

function dateToEpoch(thedate) {
  var time = thedate;
  return time - (time % 86400000);
}

function fixedDecimal(number, precisionValue) {
  let precision = precisionValue ? precisionValue : 2;
  return Number(Number(number).toFixed(precision));
}

/**
 * Update Each Player Real Chips
 * add chips into profile balance
 * @method UpdateEachPlayerRealChips
 */
var UpdateEachPlayerRealChips = function (params, cb) {
  console.log("line 45 ", params);
  if (!params) {
    return cb({ success: false });
  }

  async.each(
    params.rakeBackData,
    function (rakeData, ecb) {
      // save some keys in logDB
      var data = {};
      data.isRealMoney = true;
      data.playerId = rakeData.rakeByUserid;
      // TODO: make the player rake back amount to nearest lower integer value on scale
      // data.chips = rakeData.playerRakeBack;
      // data.chips = parseInt(rakeData.playerRakeBack);
      data.chips = fixedDecimal(rakeData.playerRakeBack, 2);
      data.category = "Rake Back";
      profileMgmt.addChips(data, function (response) {
        if (response.success) {
          var content = {};
          content.playerName =
            rakeData.rakeByName + " (" + rakeData.rakeByUsername + ")";
          content.date =
            new Date(rakeData.addedDate + 330 * 60 * 1000).toLocaleString() +
            "(IST)";
          // content.rakeback = rakeData.playerRakeBack.toFixed(2);
          // content.rakeback = parseInt(rakeData.playerRakeBack);
          content.rakeback = fixedDecimal(rakeData.playerRakeBack, 2);
          content.previousBal = fixedDecimal(response.previousBal, 2);
          content.newBalance = fixedDecimal(response.newBalance, 2);
          var data = {};
          data.content = content;
          data.emailId = rakeData.emailId;
          data.receiverSubject = "Rakeback mail";
          sendRakebackMail(data, function (err) {
            ecb(null);
          });
          var query = {
            id: rakeData._id,
            prevBalance: response.previousBal,
            newBalance: response.newBalance,
          };
          financeDB.addBalanceDetailsInRakeback(
            query,
            function (err, updateResult) {
              console.trace("Balance updated in Player Rake back");
            }
          );
        } else {
          process.emit("forceMail", {
            title: "for rakeback-add-chips-failed",
            data: rakeData,
          });
          ecb(null);
        }
      });
    },
    function (err) {
      console.error(params);
      cb(err, params);
    }
  );
};

// var passbookEntry = function(playerId, data){
// 	console.log("Going to create Passbook entry");
// 	var query = {playerId : playerId};
// 	admindb.createPassbookEntry(query, data, function(err, result){
// 		if(err){
// 			console.error("Error while creating Passbook entry of RakeBack");
// 		}else{
// 			console.log("Successfully created passbook entry");
// 		}
// 	});
// };

/**
 * Update Each Player Hands Played
 * Games count - player has played through out the day whether
 * rake deduction has been happened or not
 * @method UpdateEachPlayerHandsPlayed
 */
var UpdateEachPlayerHandsPlayed = function (params, cb) {
  console.error("::::::::::::::::::::::::::", params);
  if (!params) {
    return cb({ success: false });
  }

  async.each(
    params.rakeBackData,
    function (rakeData, ecb) {
      // save some keys in logDB
      var timestamp1 = convertDate(rakeData.createdAt, false);
      var timestamp2 = convertDate(rakeData.createdAt, true);
      var handsData = { timestamp: { $in: [timestamp1, timestamp2] } };
      handsData.playerId = rakeData.rakeByUserid;
      console.log("!&&********((((^^^^^^^^^^^^^^^", rakeData.rakeByUsername);
      logDB.findPlayerFromPlayerArchive(handsData, function (err, result) {
        console.log("!&&********((((^^^^^^^^^^^^^^^");
        console.error(result);
        var handsPlayeddata = 0;
        if (err) {
          return ecb(null);
        }
        if (result.length > 0 && result.length > 1) {
          handsPlayeddata = result[1].handsPlayed - result[0].handsPlayed;
        } else {
          if (result.length == 1) {
            handsPlayeddata = result[0].handsPlayed;
          }
        }
        var dataToSend = {};
        dataToSend.addedDate = rakeData.addedDate;
        dataToSend.rakeByUsername = rakeData.rakeByUsername;
        dataToSend.handsPlayed = handsPlayeddata;
        financeDB.playerHandsPlayedRakeBack(dataToSend, function (err, result) {
          ecb(null);
        });
        // ecb(null);
      });
    },
    function (err) {
      cb(err, params);
    }
  );
};

/**
 * convert date to seconds after or before
 * @method convertDate
 */
var convertDate = function (date, dayBack) {
  var time = date - (date % 86400000);
  if (dayBack) {
    return time - 1000 + 86400000;
  } else {
    return time - 1000;
  }
  // var t = new Date(date);
  // if(dayBack){
  //  t.setDate(t.getDate()-1);
  // }
  // t.setHours(23);
  // t.setMinutes(59);
  // t.setSeconds(59);
  // var timestamp = parseInt(Number(t)/1000)*1000;
  // return timestamp;
};

/**
 * update RakeBack Status - that this part is paid to player
 * @method updateRakeBackStatus
 */
var updateRakeBackStatus = function (params, cb) {
  if (!params) {
    return cb({ success: false });
  }
  var query = {};
  query.createdAt = dateToEpoch(Number(new Date())) - 86400000;
  financeDB.updateStatusOfManyRakeBackData(query, function (err, result) {
    if (err) {
      cb(err);
    } else {
      cb(null, params);
    }
  });
};

/**
 * cron job - in morning (IST)
 * for awarding rake back to players
 * @method MorningRakeBack
 */
RakeBackManager.prototype.MorningRakeBack = function () {
  console.log("cron job - rake back execution");
  async.waterfall(
    [
      async.apply(getEachPlayerRakeBack, {}),
      UpdateEachPlayerRealChips,
      UpdateEachPlayerHandsPlayed,
      updateRakeBackStatus,
    ],
    function (err, result) {
      if (err) {
        console.log("@@@@@@@@@@@@@@", err);
      } else {
        console.error("&&&&&&&&&&&&", "every thingh works fine");
      }
    }
  );
};

var pomelo = require("pomelo");
/**
 * send mails for rake back to individual players
 * @method sendRakebackMail
 */
var sendRakebackMail = function (params, cb) {
  pomelo.app.rpc.connector.adminManagerRemote.sendRakebackMail(
    "",
    params,
    function (sendRakebackMailResponse) {
      if (sendRakebackMailResponse.success) {
        cb(null, params);
      } else {
        cb(sendRakebackMailResponse);
      }
    }
  );
};
