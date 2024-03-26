/*
 * File: bonusMailsManager.js
 * Project: PokerSD
 * File Created: Wednesday, 11th September 2019 7:00:47 pm
 * Author: digvijay (digvijay.singh@pokersd.com)
 * -----
 * Last Modified: Wednesday, 11th September 2019 7:00:47 pm
 * Modified By: digvijay (digvijay.singh@pokersd.com)
 */


/*jshint node: true */
"use strict";

const async = require('async');
const db = require('../../../../shared/model/dbQuery.js');
const pomelo = require('pomelo');
const configConstants = require('../../../../shared/configConstants');
module.exports = function (app) {
    return new BonusMailsManager(app);
};

function BonusMailsManager(app) {
    this.app = app;
}


const getPlayerActiveBonus = (params, cb) => {
    console.log("inside getPlayerActiveBonus");
    db.findActiveBonusPlayer({ "expireStatus": 0}, function(err, result){
        if(!err && result != null){
            params.playerBonusData = result;
            cb(null, params);
        }else{
            cb("No daily update mails to send");
        }
    });
};

const getPlayerInfo = (player, cb) => {
    const query = {playerId: player._id};
    db.findUser(query, function(err, result){
        if(!err || result != null){
            player.playerInfo = result;
            cb(null, player);
        }else{
            // Exclude this player in daily report
            cb('Error in finding player Info');
        }
    });
};


const prepareMailDataOfDetails = (player, cb) => {
    let isSendDetails = false;
    var dailyStatusTableForEmail = '<html><body><table style="font-size: 11px; margin: 15px 0; border-collapse: collapse;">  <tr>    <th width="25%" align="center" style="border: 1px solid;">Locked Bonus </th>    <th width="25%" align="center" style="border: 1px solid;">Expiry Date </th>    <th width="25%" align="center" style="border: 1px solid;">Points Remaining </th> </tr> ';
    console.log("inside prepare mail data for player", player);
    for (let i = 0; i < player.bonusData.length; i++){
        let pointsRemaining = 0;
        pointsRemaining = player.bonusData[i].lockedBonusAmount - player.playerInfo.statistics.countPointsForBonus;
        if(pointsRemaining > 0){
            isSendDetails = true;
            dailyStatusTableForEmail = dailyStatusTableForEmail + '<tr><td width="25%" align="center" style="line-height: 20px; border: 1px solid;">' + player.bonusData[i].lockedBonusAmount + '</td> <td width="25%" align="center" style="line-height: 20px; border: 1px solid;">' + new Date(player.bonusData[i].expireAt + (330 * 60 * 1000)).toLocaleString() + ' (IST)</td> <td width="25%" align="center" style="line-height: 20px; border: 1px solid;">' + pointsRemaining.toFixed(4) + '</td> </tr>';
        }
    }
    dailyStatusTableForEmail = dailyStatusTableForEmail + '</table></body></html><br><br>';
    if (isSendDetails){
        const content = {};
        content.name = player.playerInfo.userName;
        content.dailyBonusDetails = dailyStatusTableForEmail;
        const receiverSubject = "Hurry Up!! Pokermoogley Locked Bonus will expire soon.";
        const mailData = createMailData({ content: content, toEmail: player.playerInfo.emailId, from_email: configConstants.from_email, subject: receiverSubject, template: 'dailyUpdateLockedBonus' });
        sendMailToPlayers(mailData, function (mailResponse) {
            console.log("Mail sent successfully");
            cb(null, player);
        });
    }else{
        cb(null, player);
    }
};

const sendMailToPlayers = (mailData) => {
    pomelo.app.rpc.connector.adminManagerRemote.sendMailToPlayers("", mailData, function (sendMailResponse) {
        console.log("Mail sent successfully");
    });
};

var createMailData = function (params) {
    var mailData = {};
    console.log('create mail data params', params);
    mailData.from_email = params.from_email;
    mailData.to_email = params.toEmail;
    mailData.subject = params.subject;
    mailData.content = params.content;
    mailData.template = params.template;
    console.log('mailData is in createMailData - ' + JSON.stringify(mailData));
    return mailData;
};

const prepareMailDataOfClaim = (player, cb) =>{
    let isClaimToSend = false;
    var claimBonusTable = '<html><body><table style="font-size: 11px; margin: 15px 0; border-collapse: collapse;">  <tr>    <th width="25%" align="center" style="border: 1px solid;">Locked Bonus </th>    <th width="25%" align="center" style="border: 1px solid;">Expiry Date </th> </tr> ';
    for(let i = 0; i < player.bonusData.length; i++){
        let pointsRemaining = 0;
        pointsRemaining = player.bonusData[i].lockedBonusAmount - player.playerInfo.statistics.countPointsForBonus;
        if(pointsRemaining <= 0){
            isClaimToSend = true;
            claimBonusTable = claimBonusTable + '<tr><td width="25%" align="center" style="line-height: 20px; border: 1px solid;">' + player.bonusData[i].lockedBonusAmount + '</td> <td width="25%" align="center" style="line-height: 20px; border: 1px solid;">' + new Date(player.bonusData[i].expireAt + (330 * 60 * 1000)).toLocaleString() + ' (IST)</td> </tr>';
        }
    }
    claimBonusTable = claimBonusTable + '</table></body></html><br><br>';
    if (isClaimToSend){
        const content = {};
        content.name = player.playerInfo.userName;
        content.claimBonusTable = claimBonusTable;
        const subject = "Claim your locked bonus now!!";
        const mailData = createMailData({ content: content, to_email: player.playerInfo.emailId, from_email: configConstants.from_email, subject: subject, template: 'claimBonusMails'});
        sendMailToPlayers(mailData, function (mailResponse) {
            console.log("Mail sent successfully");
            cb(null, player);
        });
    }else{
        cb(null, player);
    }
};

const forEveryPlayerDetailsMail = (params, cb) => {
    async.each(params.playerBonusData, function (player, ecb) {
        async.waterfall([
            async.apply(getPlayerInfo, player),
            prepareMailDataOfDetails
        ], function(err, eachResult){
            ecb(null);
        });
    }, function(err, result){
        cb(null, params);
    });
};

BonusMailsManager.prototype.bonusDailyUpdateMails = () => {
    console.log("Cron job inside Daily update of bonus");
    async.waterfall([
        async.apply(getPlayerActiveBonus, {}),
        forEveryPlayerDetailsMail
    ], function (err, result) {
        console.log("Cron Job successfully executed");
    });
};

const forEveryClaimMails = (params, cb) => {
    async.each(params.playerBonusData, function (player, ecb) {
        async.waterfall([
            async.apply(getPlayerInfo, player),
            prepareMailDataOfClaim
        ], function (err, eachResult) {
            ecb(null);
        });
    }, function (err, result) {
        cb(null, params);
    });
};;

BonusMailsManager.prototype.lockedBonusClaimMails = () => {
    console.log("Cron job - locked bonus claim mails");
    async.waterfall([
        async.apply(getPlayerActiveBonus, {}),
        forEveryClaimMails
    ], function (err, result) {
        console.log("Bonus claim mails sent successfully");
    });
};