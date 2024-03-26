/*jshint node: true */
"use strict";


var _ld = require("lodash"),
  _ = require("underscore"),
  async = require("async"),
  stateOfX = require("../../../../shared/stateOfX"),
  zmqPublish = require("../../../../shared/infoPublisher"),
  db = require("../../../../shared/model/dbQuery"),
  adminDb = require("../../../../shared/model/adminDbQuery"),
  financedb = require("../../../../shared/model/financeDbQuery"),
  logDB = require("../../../../shared/model/logDbQuery.js"),
  profileMgmt = require("../../../../shared/model/profileMgmt"),
  winnerMgmt = require("../../../../shared/winnerAlgo/entry"),
  popupTextManager = require("../../../../shared/popupTextManager"),
  keyValidator = require("../../../../shared/keysDictionary"),
  activity = require("../../../../shared/activity.js"),
  async = require('async'),
    { requestDataPayment } = require("../../database/remote/utils/requestData"),
  sharedModule = require("../../../../shared/sharedModule"),
  { refundRealChips } = require("../../database/remote/refundRealChips");


function serverLog(type, log) {
  var logObject = {};
  logObject.fileName = 'withdrawRemote';
  logObject.serverName = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type = type;
  logObject.log = log;
  zmqPublish.sendLogMessage(logObject);
}

var withdrawRemote = function (app) {
  this.app = app;
};

module.exports = function (app) {
  return new withdrawRemote(app);
};


// init params
// validate some keys and
// not less than 100
var initializeParams = function (params, cb) {
  var data = Object.assign({}, params);
  data.amount = params.amount;
  data.userName = params.userName;
  if (params.amount < 20) {
    cb({ success: false, info: "Minimum amount should be 20." });
  } else {
    if (params.userName) {
      cb(null, data);
    } else {
      cb({ success: false, info: "Player not Found" });
    }
  }
};

// fetch player from db
// should be affiliated
// player should have that many chips
var findPlayer = function (params, cb) {
  var filter = {};
  filter.userName = params.userName;
  db.findUser(filter, function (err, playerResult) {
    if (err || playerResult == null || playerResult.isBlocked) {
      cb({ success: false, info: "Player Not Found" });
    } else {
      
        if (playerResult.realChips < params.amount) {
          cb({ success: false, info: "not enough balance" });
        } else {
          params.playerResult = playerResult;
          params.prevAmt = playerResult.realChips + playerResult.instantBonusAmount;
          params.playerAvailableRealChips = playerResult.realChips;
          params.instantBonusAmount = playerResult.instantBonusAmount;
          params.playerVipPoints = playerResult.statistics.megaPoints;
          params.affiliateId = playerResult.parentUser;
          cb(null, params);
        }
    }
  });
};

// is cashout requested valid
// transaction in a day?
var cashOutValid = function (params, cb) {
  if (params.playerResult.chipsManagement.withdrawlCount >= 10) {
    var lastTransactionDate = new Date(params.playerResult.chipsManagement.withdrawlDate).toDateString();
    var todaysDate = new Date().toDateString();
    console.error(lastTransactionDate, " !!!!!&&&&&&&&&&&& ", todaysDate);
    console.error(lastTransactionDate > todaysDate);
    console.error(lastTransactionDate < todaysDate);
    if (convertDateToMidnight(todaysDate) >= convertDateToMidnight(lastTransactionDate)) {
      // if(todaysDate >lastTransactionDate){
      params.playerResult.chipsManagement.withdrawlCount = 0;
      cb(null, params);
    } else {
      cb({ success: false, info: "Number of withdrawl exausted for today", isDisplay: true, playerChips: params.amount });
    }
  } else {
    //             console.error("!!!!!!@@@@@@@############  ");
    params.playerResult.chipsManagement.withdrawlCount += 1;
    cb(null, params);
  }
};

var invoiceIdValid = function (params, cb) {
  if (params.invoiceId && params.invoiceId.length > 0) {
    adminDb.findTransactionHistoryByInvoiceId(params.invoiceId, function(err, transaction){
      if (err) {
        cb({ success: false, info: "Something wrong happened. Please try again later", isDisplay: true});
      } else {
        console.log("transaction INVOICE")
        console.log(transaction);
        if (!!transaction) {
          cb({ success: false, info: "This Invoice Id is already beeing used. Please provide new one.", isDisplay: true});
        } else {
          cb(null, params);
        }
      }
    })
  } else {
    cb({ success: false, info: "Invoice Id must be provided.", isDisplay: true});
  }
}

var invoiceIdValidPendingCashout = function (params, cb) {
  if (params.invoiceId && params.invoiceId.length > 0) {
    adminDb.findPendingCashoutByInvoiceId(params.invoiceId, function(err, transaction){
      if (err) {
        cb({ success: false, info: "Something wrong happened. Please try again later", isDisplay: true});
      } else {
        console.log("transaction INVOICE")
        console.log(transaction);
        if (!!transaction) {
          cb({ success: false, info: "This Invoice Id is already beeing used. Please provide new one.", isDisplay: true});
        } else {
          cb(null, params);
        }
      }
    })
  } else {
    cb({ success: false, info: "Invoice Id must be provided.", isDisplay: true});
  }
}

var invoiceIdValidApproveCashout = function (params, cb) {
  if (params.invoiceId && params.invoiceId.length > 0) {
    adminDb.findApprovedCashoutByInvoiceId(params.invoiceId, function(err, transaction){
      if (err) {
        cb({ success: false, info: "Something wrong happened. Please try again later", isDisplay: true});
      } else {
        console.log("transaction INVOICE")
        console.log(transaction);
        if (!!transaction) {
          cb({ success: false, info: "This Invoice Id is already beeing used. Please provide new one.", isDisplay: true});
        } else {
          cb(null, params);
        }
      }
    })
  } else {
    cb({ success: false, info: "Invoice Id must be provided.", isDisplay: true});
  }
}

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
Date.prototype.sameDay = function (d) {
  return this.getFullYear() === d.getFullYear() && this.getDate() === d.getDate() && this.getMonth() === d.getMonth();
};

// save cashout request related data in user profile
var generateWithdrawlRequest = function (params, cb) {
  var query = {};
  query.userName = params.userName;
  var updateKeys = {};
  if (params.playerResult.chipsManagement.deposit < 0) {
    params.playerResult.chipsManagement.deposit = 0;
  }
  var chipManagement = {};
  chipManagement.deposit = params.playerResult.chipsManagement.deposit;
  chipManagement.WithDrawl = 0;
  chipManagement.withdrawlCount = params.playerResult.chipsManagement.withdrawlCount;
  chipManagement.withdrawlPercent = params.playerResult.chipsManagement.withdrawlPercent;
  chipManagement.withdrawlDate = Number(new Date());
  updateKeys.chipsManagement = chipManagement;
  //  console.error("!!!!!!@@@@@@@############  ",updateKeys);
  db.updateUser(query, updateKeys, function (err, updatedUser) {
    if (err) {
      cb({ success: false, info: "Could Not process request", isDisplay: true });
    }

    if (!!updatedUser) {
      cb(null, params);
    }
  });
};

// fetch affiliate from db
// should be active
var findAffilate = function (params, cb) {
  var filter = {};
  filter.userName = params.playerResult.isParentUserName;
  //    console.error(params.playerResult);
  adminDb.findAffiliates(filter, function (err, affilateResult) {
    //        console.error(affilateResult);
    if (err || affilateResult == null) {
      cb({ success: false, info: "Affilate Not Found" });
    } else {
      if (affilateResult.status != "Active") {
        cb({ success: false, info: "Affilate is Blocked" });
      } else {
        params.affilateResult = affilateResult;
        cb(null, params);
      }
    }
  });
};

// deduct player chips from profile
var deductChips = function (params, cb) {
  var filter = {};
  filter.userName = params.userName;
  db.deductRealChips(filter, params.amount, function (err, resultData) {
    if (err || resultData.value == null) {
      cb({ success: false, info: "Withdraw Request Couldn't Be raised" });
    } else {
      params.playerResult.realChips = resultData.value.realChips + resultData.value.instantBonusAmount;
      if ((params.playerResult.chipsManagement.deposit - params.amount) <= 0) {
        params.currentDepositChips = params.playerResult.chipsManagement.deposit;
      } else {
        params.currentDepositChips = params.playerResult.chipsManagement.deposit - params.amount;
      }
      params.playerResult.chipsManagement.deposit = params.playerResult.chipsManagement.deposit - params.amount;
      params.playerAvailableRealChips = params.playerAvailableRealChips - params.amount;
      cb(null, params);
    }
  });
};

var passbookEntry = function (params) {
  console.log("params in passbook function--", params);
  var query = { playerId: params.playerResult.playerId };
  var data = {
    time: Number(new Date()),
    category: "Withdrawal",
    prevAmt: params.prevAmt,
    newAmt: params.playerResult.realChips,
    amount: params.amount,
    subCategory: "Cashout"
  };
  adminDb.createPassbookEntry(query, data, function (err, result) {
    console.log("Passbook entry created--" + err + " result" + result);
  });
};

// create cashout request in databse in cashoutDirect coll
var createCashOutRequest = function (params, cb) {
  var dataToInsert = {};
  dataToInsert.name = params.playerResult.firstName;
  dataToInsert.userName = params.playerResult.userName;
  dataToInsert.playerId = params.playerResult.playerId;
  dataToInsert.referenceNo = "WDC"+ Math.floor(Math.random()*1000) + Date.now();
  dataToInsert.profile = "Player";
  dataToInsert.currentDepositChips = params.currentDepositChips;
  dataToInsert.playerAvailableRealChips = params.playerAvailableRealChips;
  dataToInsert.amount = params.amount;
  dataToInsert.requestedAmount = params.amount;
  dataToInsert.netAmount = params.amount;
  dataToInsert.userName = params.userName;
  dataToInsert.instantBonusAmount = params.instantBonusAmount;
  dataToInsert.affiliateId = params.affiliateId;
  dataToInsert.type = "Real Chips";
  dataToInsert.tdsType = "Real Chips";
  dataToInsert.invoiceId = params.invoiceId;
  // dataToInsert.affilateId = params.affilateResult.userName;
  dataToInsert.createdAt = Number(new Date());
  dataToInsert.transactionId = params.transactionId
  adminDb.createCashOutRequest(dataToInsert, function (err, resultHistory) {
    passbookEntry(params);
    console.error(err, resultHistory);
  });
  cb(null, params);
};

var getRequestPaymentByInvoiceId = function (params, cb) {
  console.log(`inside getRequestPaymentByInvoiceId ${JSON.stringify(params)}`);
  if (params.invoiceId && params.invoiceId.length > 0) {
    adminDb.findRequestPayment({ invoiceId: params.invoiceId }, function (err, result) {
      if (!err && result) {
        params.paymentRequest = result.paymentRequest
        cb(null, params);
      } else {
        cb({ success: false, err: err });
      }
    })
  } else {
    cb({ success: false, info: "Invoice Id must be provided.", isDisplay: true });
  }
};

var paymentInvoiceCashout = function (params, cb) {
  console.log(`inside paymentInvoiceCashout, ${JSON.stringify(params)}`);
  requestDataPayment("POST", "/api/lnd/PayByInvoiceAndAmount", {
              invoiceId: params.invoiceId,
              amount: params.amount
            }).then((response) => {
    console.log(`response Data==== ${JSON.stringify(response)}`);
    const resultData = JSON.parse(response.result).data;
    if (resultData && resultData.is_confirmed) {
      // params.transactionId = JSON.parse(response.result).data.id;
      params.successPayment = resultData.is_confirmed;
      params.is_confirmed = resultData.is_confirmed;
      params.transactionId = resultData.id;
      cb(null, params);
    }
  }).catch(err => {
    cb({ success: false, err: err });
  })
};

var sendPayment = function (params, cb) {
  console.log(`inside sendPayment ${JSON.stringify(params)}`);
  if (params) {
    paymentInvoiceCashout(params, function (err, result) {
      if (!err&&result&&result.successPayment) {
        cb(null, params);
      } else {
        console.log(JSON.stringify(err));
        cb({ success: false, info: "payment failed" });
      }
    })
  } else {
    cb({ success: false, info: "paymentRequest not found" });
  }
};

var createMailData = function (params) {
  var mailData = {};
  console.log("create mail data params", params);
  mailData.from_email = stateOfX.mailMessages.from_email.toString();
  mailData.to_email = params.toEmail;
  mailData.subject = params.subject;
  mailData.content = params.content;
  mailData.template = params.template;
  console.log("mailData is in createMailData - " + JSON.stringify(mailData));
  return mailData;
};

var insertIntoCashoutHistory = function (params, cb) {
  console.log(`inside insertIntoCashoutHistory ${JSON.stringify(params)}`);
  
  var data = {};
  data.name = params.playerResult.firstName;
  data.userName = params.playerResult.userName;
  data.playerId = params.playerResult.playerId;
  data.referenceNo = "WDC"+ Math.floor(Math.random()*1000) + Date.now();
  data.profile = "Player";
  data.currentDepositChips = params.currentDepositChips;
  data.playerAvailableRealChips = params.playerAvailableRealChips;
  data.amount = params.amount;
  data.requestedAmount = params.amount;
  data.netAmount = params.amount;
  data.userName = params.userName;
  data.instantBonusAmount = params.instantBonusAmount;
  data.affiliateId = params.affiliateId;
  data.type = "Real Chips";
  data.tdsType = "Real Chips";
  data.invoiceId = params.invoiceId;
  // data.affilateId = params.affilateResult.userName;
  data.createdAt = Number(new Date());
  data.transactionId = params.transactionId

  adminDb.insertIntoCashoutHistory(data, function (err, result) {
    if (err) {
      cb({ success: false, err: err });
    } else {
      if (params.is_confirmed) {
        // financedb.updateBalanceSheet(
        //   {
        //     $inc: {
        //       withdrawal: "",
        //       tds: "",
        //     },
        //   },
        //   function (err, result) {
        //     if (!err && !!result) {
        //       console.log(
        //         `the result found in increaseAmountInFinanceDb in fundTransferManagement is,
        //         ${JSON.stringify(result)}`
        //       );
        //     } else {
        //       console.log(
        //         "Could not increaseAmountInFinanceDb History"
        //       );
        //     }
        //   }
        // );
        // var content = {
        //   username: "",
        //   chips: "",
        //   referenceNo: "",
        //   amount: "",
        //   accountNumber: "",
        //   tds: "",
        // };
        // var mailData = createMailData({
        //   content: content,
        //   toEmail: req.body.emailId,
        //   subject: "You cash out request has been processed",
        //   template: "cashoutSuccessful",
        // });
        // sharedModule.sendMailWithHtml(
        //   mailData,
        //   function (result) {
        //     console.log(
        //       `inside sendPasswordMailToPlayer @@@,
        //       ${JSON.stringify(result)}`
        //     );
        //     if (result.success) {
        //       console.log(
        //         "Mail sent successfully"
        //       );
        //     } else {
        //       console.log(
        //         "Mail not sent"
        //       );
        //     }
        //   }
        // );
        cb(null, params);
      } else {
        refundRealChips(params);
        var content = {
          userName: req.body.realName,
          referenceNo:
               req.body.referenceNo,
          unsuccessfulReason:
               req.body.reason,
        };
        var mailData = createMailData({
          content: content,
          toEmail: req.body.emailId,
          subject: "Your cash out request could not be processed",
          template: "cashoutUnsuccessful",
        });
        sharedModule.sendMailWithHtml(
          mailData,
          function (result) {
            console.log(
              `inside sendPasswordMailToPlayer @@@@
              ${JSON.stringify(result)}`
            );
            if (result.success) {
              console.log(
                "Mail sent successfully"
              );
            } else {
              console.log(
                "Mail not sent"
              );
            }
          }
        );
        cb(null, params);
      }

    }
  });
};

// process player cashout - all steps
withdrawRemote.prototype.processWithdraw = function (params, cb) {
  console.log("withdrawRemote.prototype.proccessWithdraw");
  async.waterfall([
    async.apply(initializeParams, params),
    findPlayer,
    cashOutValid,
  invoiceIdValid,
  invoiceIdValidPendingCashout,
  invoiceIdValidApproveCashout,
    // findAffilate,
    deductChips,
    generateWithdrawlRequest,
    createCashOutRequest,
    //createResponse (delete)
    
    // send payment (add)
    getRequestPaymentByInvoiceId,
    sendPayment,
    // create transaction history (add)
    insertIntoCashoutHistory
  ], function (err, data) {
    if (err) {
      console.log("EEEE______________________________________________________")
      console.log(JSON.stringify(err));
      console.log("EEEE______________________________________________________")
      cb(err);
    } else {
      cb({ success: true, info: "CashOut Request Generated Successfully", playerChips: data.playerResult.realChips });
    }
  });
};