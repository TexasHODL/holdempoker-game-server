/*
* @Author: sushiljainam
* @Date:   2017-12-02 19:00:34
* @Last Modified by:   digvijay
* @Last Modified time: 2018-12-27 11:59:04
*/

/*jshint node: true */
"use strict";

var appDir = "../../../../../";
// var keyValidator = require(appDir+ "shared/keysDictionary");
var serverDownManager = require(appDir+ "game-server/app/util/serverDownManager");
var pomelo = require('pomelo');

/**
 * used in maintenance APIs communication part
 * @method inform
 * @param  {Object}   message message object
 * @param  {Function} cb      callback
 */
module.exports.inform = function (message, cb) {
	serverDownManager.msgRcvd(pomelo.app, message, cb);
};

