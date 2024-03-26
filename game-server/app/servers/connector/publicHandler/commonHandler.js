/*jshint node: true */
"use strict";

// This file is used to handle channel join manipulations

var _                = require('underscore'),
    _ld              = require("lodash"),
    // async            = require("async"),
    sharedModule     = require("../../../../shared/sharedModule"),
    keyValidator     = require("../../../../shared/keysDictionary"),
    imdb             = require("../../../../shared/model/inMemoryDbQuery.js"),
    db             = require("../../../../shared/model/dbQuery.js"),
    stateOfX         = require("../../../../shared/stateOfX.js"),
    zmqPublish       = require("../../../../shared/infoPublisher.js"),
    popupTextManager = require("../../../../shared/popupTextManager"),
    broadcastHandler = require("./broadcastHandler");
    // joinRequestUtil  = require("./joinRequestUtil"),
    // responseHandler  = require("./responseHandler");
const configConstants = require('../../../../shared/configConstants');
var commonHandler = {};
// console.trace("dfcsdfvcsdfv",broadcastHandler);

// Assign player settings while joining table
// for tournament, for open table and for autosit (join) table
// // > Save table level settings as well
// a) Sound
// b) Player Chat
// c) Dealer Chat
// d) Table Color
// e) Muck Winning Hand
// f) 4 Card Color Deck
// 
// Request: {playerId: , channelId: , tableId: (optional), data: {}, playerName: }
commonHandler.assignTableSettings = function(params, cb) {
	imdb.findPlayerAsSpectator({playerId: params.playerId, channelId: params.channelId}, function(err, result){
    if(err){
      cb({success: false, isRetry: false, tableId: params.tableId, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.dbQyeryInfo.DB_GETSPACTATOR_SETTING_FAIL});
    } else {
      if (!!result){
        params.data.settings = result.settings;
        cb(null, params);
      } else {
        // Get player setting details from database and assign as default setting for this table
        db.getCustomUser(params.playerId, {settings: 1, prefrences:1, isMuckHand: 1}, function(err, user) {
          if(err) {
            cb({success: false, isRetry: false, tableId: params.tableId, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.dbQyeryInfo.DB_GETUSERSETTINGS_FAIL});
          } else {
            var data = {playerId: params.playerId, channelId: params.channelId, playerName: params.playerName, createdAt: new Date(), settings: {}};
            data.settings.muteGameSound = user.settings.muteGameSound;
            data.settings.dealerChat    = user.settings.dealerChat;
            data.settings.playerChat    = user.settings.playerChat;
            data.settings.tableColor    = user.settings.tableColor;
            data.settings.cardColor     = user.prefrences.cardColor;
            data.settings.isMuckHand    = user.isMuckHand;
            imdb.addPlayerAsSpectator(data, function(err, response){
              if(err) {
                cb({success: false, isRetry: false, tableId: params.tableId, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.dbQyeryInfo.DB_SAVETABLESPECTATOR_FAIL});
              } else {
                params.data.settings = response.settings;
                cb(null, params);
              }
            });
          }
        });
      }
    }
  });
};

// Fire chips broadcast to individual player
// Request {playerId: , self}
commonHandler.broadcastChips = function(params) {
  db.getCustomUser(params.playerId, {freeChips: 1, realChips:1}, function(err, user) {
    broadcastHandler.sendMessageToUser({ msg: {playerId: params.playerId, updated: {freeChips: user.freeChips, realChips: user.realChips+user.instantBonusAmount, instantBonusAmount: user.instantBonusAmount}}, playerId: params.playerId, route: stateOfX.broadcasts.updateProfile});
  });
};

// send sms to affiliate mobile
commonHandler.sendCashoutSms = function(params){
  console.log(".......line 78 ", params);
  var data = {};
  data.msg = params.userName + ", has made cashout request of " + params.cashOutAmount + ".Please take necessary action.Contact player for balance adjustment. "+configConstants.gameNameText;
  // data.msg = "" +params.userName + " " + params.cashOutAmount + "";
  data.mobileNumber = "91" +params.mobileNumber;
  sharedModule.sendOtp(data, function(response){

  });

};

module.exports = commonHandler;