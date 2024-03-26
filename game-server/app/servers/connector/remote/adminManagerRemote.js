/*
* @Author: sushiljainam
* @Date:   2017-12-02 18:00:14
* @Last Modified by:   digvijay
* @Last Modified time: 2019-08-19 13:12:40
*/

/*jshint node: true */
"use strict";

var appDir = "../../../../../";
// var keyValidator = require(appDir+ "shared/keysDictionary");
var serverDownManager = require(appDir+ "game-server/app/util/serverDownManager");
var pomelo = require('pomelo');
var sharedModule = require("../../../../shared/sharedModule");
const configConstants = require('../../../../shared/configConstants');

/**
 * used in maintenance APIs communication part
 * @method inform
 * @param  {Object}   message message object
 * @param  {Function} cb      callback
 */
module.exports.inform = function (message, cb) {
	serverDownManager.msgRcvd(pomelo.app, message, cb);
};

/**
 * send Rakeback Mail when cron job runs
 * @method sendRakebackMail
 * @param  {Object}         params contains mail content, mail id, subject
 * @param  {Function}       cb     callback
 */
module.exports.sendRakebackMail = function(params, cb){
	console.log("line 19.........adminmanagerremote", params);
	sharedModule.sendMailWithHtml({content: params.content, to_email: params.emailId, from_email: configConstants.from_email ,subject: params.receiverSubject, template: 'rakeback'}, function(response){
		cb(response);
	});
};

/**
 * This is used to send mail to leaderboard Winners
 * @method sendLeaderboardWinnerMail
 * @author Digvijay Rathore
 * @date   2019-08-19
 * @param  {Object}                  params mail Data
 * @param  {Function}                cb     [description]
 */
module.exports.sendLeaderboardWinnerMail = function(params, cb){
	console.log("send mail to leaderboard winners");
	sharedModule.sendMailWithHtml(params, function(response){
		cb(response);
	});
};

/**
 * This is used to send msg to Leaderboard Winners
 * @method sendMsgToLeaderboardWinners
 * @author Digvijay Rathore
 * @date   2019-08-19
 * @param  {Object}                    params  msg Data
 * @param  {Function}                  cb     [description]
 */
module.exports.sendMsgToLeaderboardWinners = function(params, cb){
	let msgObject = {
		mobileNumber: params.mobileNumber,
		msg : params.msg
	};
  sharedModule.sendOtp(msgObject, function (otpApiResponse) {
    cb(null, otpApiResponse);
  });
};

module.exports.sendMailToPlayers = function (params, cb) {
	sharedModule.sendMailWithHtml(params, function(mailResponse){
		cb(mailResponse);
	});
};

module.exports.sendMsgToPlayers = function (params, cb) {
	let msgObject = {
		mobileNumber: params.mobileNumber,
		msg: params.msg
	};
	sharedModule.sendOtp(msgObject, function (otpApiResponse) {
		cb(null, otpApiResponse);
	});
};