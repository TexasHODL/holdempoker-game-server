/*
 * @Author: noor
 * @Date:   2017-08-16 17:27:12
 * @Last Modified by:   digvijay
 * @Last Modified time: 2018-12-28 12:58:20
 */

/*jshint node: true */
"use strict";

var _ = require('underscore');
var async = require('async');
var stateOfX = require("../../../../shared/stateOfX");
var tipRemote = module.exports;
const configConstants = require('../../../../shared/configConstants');

/**
 * checks wether the current player has moves now
 * @method isPlayerWithCurrentMove
 * @param  {Object}     data {data, table}
 * @param  {Function}   cb     callback function
 */
var isPlayerWithCurrentMove = function(data, cb) {
    if (data.table.players.length > 0 && data.table.currentMoveIndex < (data.table.players.length) && data.table.currentMoveIndex !== -1) {
        data.isPlayerWithMove = data.table.players[data.table.currentMoveIndex].playerId == data.data.playerId;
        cb(null, data);
    } else {
        cb({ success: false, info: "Invalid Attempt For Tip", channelId: data.data.channelId });
    }
};

/**
 * returns the tip amount based on the conditions
 * @method getTipAmount
 * @param  {Object}     data {data, table}
 * @return {Number}            tip amount
 */
var getTipAmount = function(data) {
    return configConstants.considerChipsForTip ? data.data.chips : data.table.bigBlind;
};

/**
 * checks wether the game has started on this channel
 * @method isGameRunning
 * @param  {Object}      data  {data, table}
 * @param  {Function}   cb     callback function
 */
var isGameRunning = function(data, cb) {
    if (data.table.players.length >= data.table.minPlayers) {
        cb(null, data);
    } else {
        cb({ success: false, info: "Can not Tip as Game is not Running", channelId: data.data.channelId });
    }
};

/**
 * checks whether the user chips to tip is valid or not
 * @method validateUserChips
 * @param  {Object}      data  {data, table}
 * @param  {Function}   cb     callback function
 */
var validateUserChips = function(data, cb) {
    if (configConstants.considerChipsForTip) {
        if (data.data.chips >= configConstants.minimumTipAmount) {
            cb(null, data);
        } else {
            cb({ success: false, info: "Invalid Chips to Tip", channelId: data.data.channelId });
        }
    } else {
        cb(null, data);
    }
};

/**
 * checks whether the game is being played with real money
 * @method isPlayingWithRealMoney
 * @param  {Object}      data  {data, table}
 * @param  {Function}   cb     callback function
 */
var isPlayingWithRealMoney = function(data, cb) {
    if (data.table.isRealMoney) {
        cb(null, data);
    } else {
        cb({ success: false, info: "Only real money can be tip", channelId: data.data.channelId });
    }
};

/**
 * [hasPlayerEnoughChips description]
 * @method hasPlayerEnoughChips
 * @param  {Object}             data [description]
 * @param  {Function}           cb   callback      function
 * @return {Boolean}                 [description]
 */
var hasPlayerEnoughChips = function(data, cb) {
    if (data.player.chips >= data.tipAmount && data.player.chips >= 2 * data.table.bigBlind) {
        cb(null, data);
    } else {
        cb({ success: false, info: "You don't have enough chips to tip", channelId: data.data.channelId });
    }
};

/**
 * checks if the player has current move then after tip will the player have enough chips for call
 * @method checkEnoughCallAmountAfterTip
 * @param  {Object}     data  {data, table}
 * @param  {Function}   cb     callback function
 * @return {Object} 			status object
 */
var checkEnoughCallAmountAfterTip = function(data, cb) {

    if (!data.isPlayerWithMove)
        return cb(null, data);

    if (data.player.moves.includes(stateOfX.moveValue.call)) {
        var callAmount = data.table.roundMaxBet - data.player.totalRoundBet;
        if ((data.player.chips - data.tipAmount) >= callAmount)
            cb(null, data);
        else
            cb({ success: false, info: "You can not tip as low chips", channelId: data.data.channelId });
    } else {
        cb(null, data);
    }
};

/**
 * initializes waterfall params
 * @method initializeParams
 * @param  {Object}         params {data, table}
 * @param  {Function}       cb     callback      function
 */
var initializeParams = function(params, cb) {
    var data = Object.assign({}, params);
    data.tipAmount = getTipAmount(params);
    data.player = params.table.players.find((player) => player.playerId == params.data.playerId);

    if (data.player) {
        cb(null, data);
    } else {
        cb({ success: false, info: "Player Not Found or is Observer", channelId: data.data.channelId });
    }
};

/**
 * creates response for to return
 * @method initializeParams
 * @param  {Object}         data {data, table}
 * @param  {Function}       cb     callback      function
 */
var createResponse = function(data, cb){
    data.response = {
        tipAmount: data.tipAmount,
        playerId: data.player.playerId,
        playerName: data.player.playerName,
        chipsBeforeTip: data.player.chips,
        channelId: data.data.channelId,
    };

    cb(null, data);
};
/**
 * processing of tip starts here
 * @method processTip
 * @param  {Object}         params {data, table}
 * @param  {Function}       cb     callback      function
 */
tipRemote.processTip = function(params, cb) {
    async.waterfall([
        async.apply(initializeParams, params),
        isGameRunning,
        isPlayingWithRealMoney,
        validateUserChips,
        hasPlayerEnoughChips,
        isPlayerWithCurrentMove,
        checkEnoughCallAmountAfterTip,
        createResponse
    ], function(err, data) {
        if (err) {
            cb(err);
        } else {
            data.player.chips -= data.tipAmount;
            data.response.chips = data.player.chips;
            cb({ success: true, info: "Tip deducted successfully", data: data.response, table: params.table });
        }
    });
};