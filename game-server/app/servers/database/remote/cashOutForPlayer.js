/*jshint node: true */
"use strict";


var _ld          = require("lodash"),
    _            = require("underscore"),
    async        = require("async"),
    stateOfX     = require("../../../../shared/stateOfX"),
    zmqPublish   = require("../../../../shared/infoPublisher"),
    db           = require("../../../../shared/model/dbQuery"),
    adminDb           = require("../../../../shared/model/adminDbQuery"),
    logDB           = require("../../../../shared/model/logDbQuery.js"),
    profileMgmt  = require("../../../../shared/model/profileMgmt"),
    winnerMgmt   = require("../../../../shared/winnerAlgo/entry"),
    popupTextManager  = require("../../../../shared/popupTextManager"),
    keyValidator = require("../../../../shared/keysDictionary"),
    activity     = require("../../../../shared/activity.js"),
    async       = require('async');


function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'cashOutForPlayer';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

var cashOutForPlayer = function(app) {
    this.app = app;
};

module.exports = function(app) {
    return new cashOutForPlayer(app);
};


// init params
// validate some keys and
// not less than 100
var initializeParams = function(params, cb) {
    var data = Object.assign({}, params);
    data.cashOutAmount = params.realChips;
    data.playerId = params.playerId;
    if(params.realChips < 20){
       cb({ success: false, info: "Minimum amount should be 20." });
    }else{
      if (params.playerId) {
          cb(null, data);
      } else {
          cb({ success: false, info: "Player not Found" });
      }
    }
};

// fetch player from db
// should be affiliated
// player should have that many chips
var findPlayer = function(params, cb) {
    var filter ={};
    filter.playerId = params.playerId;
    db.findUser(filter,function(err,playerResult){
        if(err || playerResult == null || playerResult.isBlocked){
            cb({ success: false, info: "Player Not Found"});
        }else{
            if(playerResult.isParentUserName == ""){
                cb({ success: false, info: "Player Affilate Not Found"});                
            }else{
                if(playerResult.realChips < params.realChips){
                    cb({ success: false, info: "Player Chips Are less"});
                }else{
                    params.playerResult = playerResult;
                    params.prevAmt = playerResult.realChips + playerResult.instantBonusAmount;
                    cb(null, params);
                }
            }
        }
    });
};

// is cashout requested valid
// transaction in a day?
var cashOutValid = function(params,cb){
     if(params.playerResult.chipsManagement.withdrawlCount >= 10){
          var lastTransactionDate = new Date(params.playerResult.chipsManagement.withdrawlDate).toDateString();
          var todaysDate = new Date().toDateString();
          console.error(lastTransactionDate," !!!!!&&&&&&&&&&&& ",todaysDate);
          console.error(lastTransactionDate > todaysDate);
          console.error(lastTransactionDate < todaysDate);
          if (convertDateToMidnight(todaysDate) >= convertDateToMidnight(lastTransactionDate)) {
          // if(todaysDate >lastTransactionDate){
            params.playerResult.chipsManagement.withdrawlCount = 0;
            cb(null,params);
          }else{
            cb({success: false, info: "Number of withdrawl exausted for today", isDisplay: true, playerChips:params.realChips});
          }
        }else{
//             console.error("!!!!!!@@@@@@@############  ");
             params.playerResult.chipsManagement.withdrawlCount += 1;
           cb(null,params);
        }
};

// convert timestamp to timestamp
// modified -> acc to midnight time
var convertDateToMidnight = function (dateToConvert) {
  dateToConvert = new Date(dateToConvert);
  dateToConvert.setHours(0);
  dateToConvert.setMinutes(0);
  dateToConvert.setSeconds(0);
  dateToConvert.setMilliseconds(0);
  return Number(dateToConvert);
};

// check if given date is of today
Date.prototype.sameDay = function(d) {
  return this.getFullYear() === d.getFullYear() && this.getDate() === d.getDate() && this.getMonth() === d.getMonth();
};

// save cashout request related data in user profile
var generateWithdrawlRequest = function(params,cb){
  var query = {};
  query.playerId = params.playerId;
  var updateKeys = {};
  if(params.playerResult.chipsManagement.deposit < 0){
    params.playerResult.chipsManagement.deposit = 0;
  }
  var chipManagement = {};
  chipManagement.deposit = params.playerResult.chipsManagement.deposit;
  chipManagement.WithDrawl = 0;
  chipManagement.withdrawlCount = params.playerResult.chipsManagement.withdrawlCount;
  chipManagement.withdrawlPercent = params.playerResult.chipsManagement.withdrawlPercent;
  chipManagement.withdrawlDate =  Number(new Date());
  updateKeys.chipsManagement = chipManagement;
//  console.error("!!!!!!@@@@@@@############  ",updateKeys);
  db.updateUser(query, updateKeys, function(err, updatedUser) {
    if(err){
      cb({success: false, info: "Could Not process request", isDisplay: true});
    }

    if(!!updatedUser){
      cb(null,params);
    }
  });
};

// fetch affiliate from db
// should be active
var findAffilate = function(params, cb) {
    var filter ={};
    filter.userName = params.playerResult.isParentUserName;
//    console.error(params.playerResult);
    adminDb.findAffiliates(filter,function(err,affilateResult){
//        console.error(affilateResult);
        if(err || affilateResult == null){
            cb({ success: false, info: "Affilate Not Found"});
        }else{
           if(affilateResult.status != "Active"){
             cb({ success: false, info: "Affilate is Blocked"});
           }else{
            params.affilateResult = affilateResult;
            cb(null, params);
           }
        }
    });
};

// deduct player chips from profile
var deductChips = function(params, cb) {
    var filter = {};
    filter.playerId = params.playerId;
    db.deductRealChips(filter,params.realChips,function(err,resultData){
        if(err || resultData.value == null){
            cb({ success: false, info: "Cashout Request Couldn't Be raised"});
        }else{
            params.playerResult.realChips = resultData.value.realChips + resultData.value.instantBonusAmount;
            if((params.playerResult.chipsManagement.deposit - params.realChips) <= 0){
                params.currentDepositChips = params.playerResult.chipsManagement.deposit;
            }else{
                params.currentDepositChips = params.playerResult.chipsManagement.deposit -params.realChips;
            }
            params.playerResult.chipsManagement.deposit = params.playerResult.chipsManagement.deposit - params.realChips;
            cb(null,params);
        }
    });
};

var passbookEntry = function(params) {
  console.log("params in passbook function--", params);
  var query = {playerId: params.playerId};
  var data = {
    time: Number(new Date()),
    category : "Withdrawal",
    prevAmt : params.prevAmt,
    newAmt : params.playerResult.realChips,
    amount: params.realChips,
    subCategory : "Cashout"
  };
  adminDb.createPassbookEntry(query, data, function(err, result){
    console.log("Passbook entry created--"+err+" result"+ result);
  });
};

// create cashout request in databse in cashoutDirect coll
var createCashOutRequest = function(params, cb) {
    var dataToInsert={};
    dataToInsert.name = params.playerResult.firstName;
    dataToInsert.userName = params.playerResult.userName;
    dataToInsert.playerId = params.playerResult.playerId;
    dataToInsert.profile = "Player";
    dataToInsert.currentDepositChips = params.currentDepositChips;
    dataToInsert.amount = params.realChips;
    dataToInsert.type = "Real Chips";
    dataToInsert.affilateId = params.affilateResult.userName;
    dataToInsert.createdAt = Number(new Date());
    adminDb.craeteCashoutRequestForPlayerThroughGame(dataToInsert,function(err,resultHistory){
        passbookEntry(params);
        console.error(err,resultHistory);
    });
    cb(null,params);
};

// process player cashout - all steps
cashOutForPlayer.prototype.processCashout = function(params, cb) {
    async.waterfall([
        async.apply(initializeParams, params),
        findPlayer,
        cashOutValid,
        findAffilate,
        deductChips,
        generateWithdrawlRequest,
        createCashOutRequest
        //createResponse
    ], function(err, data) {
        if (err) {
            cb(err);
        } else {
          console.log(data);
            cb({ success: true, info: "CashOut Request Generated Successfully",playerChips:data.playerResult.realChips});
        }
    });
};