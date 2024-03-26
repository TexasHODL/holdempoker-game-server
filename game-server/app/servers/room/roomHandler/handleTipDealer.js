/*
 * @Author: noor
 * @Date:   2017-08-17 17:09:17
 * @Last Modified by:   digvijay
 * @Last Modified time: 2018-12-28 16:48:30
 */

/*jshint node: true */
"use strict";

var financeDB = require("../../../../shared/model/financeDbQuery");
// var lobDb = require("../../../../../shared/model/logDbQuery");
var handleTipDealer = module.exports;

// award tip amount to host
// PENDING
handleTipDealer.handle = function(params) {
    financeDB.updateBalanceSheet({ $inc: { "tip": params.tipAmount } }, function(err, res) {
        console.log(" from handleTipDealer.handle updateBalanceSheet", err, res);
    });

    var tipHistory = {
        tipAmount: params.tipAmount,
        playerId: params.playerId,
        channelId: params.channelId,
        playerName: params.playerName,
        createdAt: new Date(),
        chipsBeforeTip: params.chipsBeforeTip,
        chipsAfterTip: params.chips
    };
    // lobDb.createTipLog(tipHistory, function(err, res) {
    //     console.log("handleTipDealer.handle lobDb.createTipLog", err, res);
    // });
};