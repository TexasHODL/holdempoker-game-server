/*jshint node: true */
"use strict";

/* Created by Amrendra 29/07/2016 */

var _ld          = require("lodash"),
    _            = require('underscore'),
    stateOfX     = require("../stateOfX"),
    keyValidator = require("../keysDictionary"),
    db           = require("./dbQuery"),
    adminDb      = require("./adminDbQuery"),
    profileMgmt  = {};


function fixedDecimal(number, precisionValue) {
  let precision = precisionValue ? precisionValue : 2;
  return Number(Number(number).toFixed(precision));
}

var passbookEntry = function(params, newAmt/*, instantBonusAmt*/){
  console.log("In PassboookEntry");
  var query = {
    playerId: params.playerId
  };
  var data = {};
  // if(instantBonusAmt > 0){
    // data.amount = params.realChips;
  // }else{
    data.amount = params.chips;
  // }
  data.time = Number(new Date());
  data.category = 'Table Actions';
  data.subCategory = params.subCategory;
  data.prevAmt = params.realChips + params.instantBonusAmount;
  data.newAmt = newAmt;
  if(params.tableName){
    data.tableName = params.tableName;
  }
  adminDb.createPassbookEntry(query, data, function(err, result){
    console.log("Passbook entry Result for sit iN--"+ err + " "+ result);
  });
};



/**
 * this function deducts real chips to player
 * @method deductRealChips
 * @param  {object}     params request json object containaing desired player id 
 * @param  {Function}   cb     callback function
 */
var deductRealChips = function(params,cb) {
  if(params.realChips >= params.chips){
    //deduct from real chips
    db.deductRealChips({playerId: params.playerId}, params.chips, function (err,result) {
      if(err) {
        cb({success: false, channelId: params.channelId, info: "Deduct chips failed!"});
      } else {
        var newAmtBal = result.value.realChips + result.value.instantBonusAmount;
        passbookEntry(params, newAmtBal);
        cb({success: true, realChips:result.value.realChips, freeChips:result.value.freeChips, instantBonusAmount: 0});
      }
    });
  }else {
    if(params.instantBonusAmount >= fixedDecimal((params.chips - params.realChips), 2)){
      //deduct full real chips and partial bonus
      var bonusDeduct = fixedDecimal((params.chips - params.realChips), 2);
      db.deductRealChips({playerId: params.playerId, instantBonusAmount: bonusDeduct}, params.realChips, function (err,result) {
        if(err) {
          cb({success: false, channelId: params.channelId, info: "Deduct chips failed!"});
        } else {
          var newAmtBal = result.value.realChips + result.value.instantBonusAmount;
          passbookEntry(params, newAmtBal);
          cb({success: true, realChips:result.value.realChips, freeChips:result.value.freeChips, instantBonusAmount: bonusDeduct});
        }
      });
    }else{
      cb({success: false, channelId: params.channelId, info: "You have insufficient chips to process request."});
    }
  }
};

/**
 * this function deducts free chips to player
 * @method deductFreeChips
 * @param  {object}     params request json object containaing desired player id 
 * @param  {Function}   cb     callback function
 */
var deductFreeChips = function(params, cb) {
	if(params.freeChips >= params.chips) {
		db.deductFreeChips({playerId: params.playerId}, params.chips, function (err,result) {
      if(err) {
        cb({success: false, channelId: params.channelId, info: "Deduct chips on registration failed!"});
      } else {
        cb({success: true, realChips:result.value.realChips, freeChips:result.value.freeChips});
      }
    });
	} else {
		// console.log("Player have insufficient chips to process request.");
		cb({success: false, channelId: params.channelId, info: "You have insufficient chips to process request."});
	}
};

var passBookEntryLeave = function(params, newAmount){
  var query = {playerId : params.playerId};
  var data = {};
    data.time = Number(new Date());
    data.category  = params.category;
    data.prevAmt = params.prevBalForPassbook;
    if(params.instantBonusAmount){
      data.amount = params.chips + params.instantBonusAmount;
    }else{
      data.amount = params.chips;
    }
    data.newAmt = newAmount;
    if(params.tableName){
      data.subCategory = "Leave";
      data.tableName = params.tableName;
    }
  adminDb.createPassbookEntry(query, data, function(err, result){
    console.log("Result in create passbok entry while leave--"+ err+ "  "+ result);
  });
};


/**
 * this function adds real chips to player
 * @method addRealChips
 * @param  {object}     params request json object containaing desired player id 
 * @param  {Function}   cb     callback function
 */
var addRealChips = function(params, cb) {
  // console.log("params in add real chips--"+ JSON.stringify(params));
	db.addRealChips({playerId: params.playerId, instantBonusAmount: params.instantBonusAmount || 0}, params.chips, function (err, result) {
    // console.log("error--"+ err);
    // console.log("result--"+ JSON.stringify(result));
    if(err) {
      cb({success: false, channelId: params.channelId, info: "addChips chips failed!"});
    } else {
      var newBalance = result.value.realChips + result.value.instantBonusAmount ;
      passBookEntryLeave(params, newBalance);
      cb({success: true, newBalance : newBalance});
    }
  });
};


/**
 * this fucntion adds free chips to plyer
 * @method addFreeChips
 * @param  {object}     params request json object containing desired player id
 * @param  {Function}   cb     callback function
 */
var addFreeChips = function(params, cb) {
	db.addFreeChips({playerId: params.playerId}, params.chips, function (err) {
    if(err) {
      cb({success: false, channelId: params.channelId, info: "addChips chips on registration failed!"});
    } else {
      cb({success: true});
    }
  });
};


profileMgmt.getUserChips = function (params, cb) {
  console.log("params in getUserChips profileMgmt " +JSON.stringify(params));
  params.channelId = !!params.channelId ? params.channelId : "";
  // params.chips = Math.round(params.chips);
  params.chips = params.chips;
  db.findUser({playerId: params.playerId}, function(err, user) {
    if(err || !user) {
      // console.log("Error in find user for deduct chips")
      cb({success: false, channelId: params.channelId, info: "Unable to deduct chips, user not found. Player id - " + params.playerId});
    } else {
      cb({success: true, realChips:user.realChips, freeChips:user.freeChips});
      return;
    }
  });
};

/**
 * Deduct free and real chips in player profile
 * @param {Object}   params {playerId: "", chips: "", isRealMoney: ""}
 * @param {Function} cb     [description]
 */

profileMgmt.deductChips = function (params, cb) {
  console.log("params in deductchips profileMgmt " +JSON.stringify(params));
  params.channelId = !!params.channelId ? params.channelId : "";
  params.chips = fixedDecimal(params.chips, 2);
  db.findUser({playerId: params.playerId}, function(err, user) {
    if(err || !user) {
      // console.log("Error in find user for deduct chips")
      cb({success: false, channelId: params.channelId, info: "Unable to deduct chips, user not found. Player id - " + params.playerId});
    } else {
      if(params.isRealMoney) {
        params.realChips = user.realChips;
        params.instantBonusAmount = user.instantBonusAmount;
    		deductRealChips(params, function(response) {
    			cb(response);
    		});
    	} else {
    		params.freeChips = user.freeChips;
    		deductFreeChips(params, function(response) {
    			cb(response);
    		});
    	}
		}
	});
};

/**
 * Add free and real chips in player profile
 * @param {Object}   params {playerId: "", chips: "", isRealMoney: ""}
 * @param {Function} cb     [description]
 */

profileMgmt.addChips = function (params, cb) {
  console.log("params are in addChips - " + JSON.stringify(params));
  params.channelId = !!params.channelId ? params.channelId : "";
  // params.chips = Math.round(params.chips);
  if(params.instantBonusAmount > 0){
    if(params.chips >= params.instantBonusAmount){
        // params.chips = Math.round(params.chips - params.instantBonusAmount);
        params.chips = fixedDecimal((params.chips - params.instantBonusAmount), 2);
        params.instantBonusAmount = fixedDecimal(params.instantBonusAmount, 2);
    }else{
      params.instantBonusAmount = fixedDecimal(params.chips, 2);
      params.chips = 0;
    }
  }
	db.findUser({playerId: params.playerId}, function(err, user) {
		if(err || !user) {
			// console.log("Error in find user for addChips chips")
			cb({success: false, channelId: params.channelId, info: "Unable to add chips, user not found. Player id - " + params.playerId});
		} else {
    	if(params.isRealMoney) {
        params.prevBalForPassbook = user.realChips + user.instantBonusAmount;
	      addRealChips(params, function(response){
          response.previousBal = user.realChips + user.instantBonusAmount;
	      	cb(response);
	      });
    	} else {
    		addFreeChips(params, function(response) {
    			cb(response);
    		});
    	}
		}
	});
};

module.exports = profileMgmt;
