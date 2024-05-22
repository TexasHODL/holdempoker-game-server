/*jshint node: true */
"use strict";

// This file is used to handle profile updated by user

// ### External files and packages declaration ###
var keyValidator      = require("../../../../shared/keysDictionary"),
    db                = require("../../../../shared/model/dbQuery.js"),
    stateOfX          = require("../../../../shared/stateOfX.js"),
    async             = require("async"),
    activity          = require("../../../../shared/activity.js"),
    broadcastHandler  = require("./broadcastHandler.js"),
    _                 = require("underscore"),
    zmqPublish        = require("../../../../shared/infoPublisher.js"),
    popupTextManager  = require("../../../../shared/popupTextManager"),
    encryptDecrypt    = require("../../../../shared/passwordencrytpdecrypt.js"),
    constants         = require("../../../../shared/stateOfX.js");

var stateOfX = constants;
// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'update profile handler';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

var updateProfileHandler = {};


/**
 *  This function is used to validate EmailId
 *
 * @method process
 * @param  {Object}       msg  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var validateEmail = function (msg,cb) {
  serverLog(stateOfX.serverLogType.info,"going for avatar broadcast");
  if(!!msg.updateKeys.emailId) {
    db.findUser({emailId: msg.updateKeys.emailId}, function (err, user) {
      if(err) {
        cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBFINDUSERFAIL_DBERROR_UPDATEPROFILEHANDLER});
        //cb({success: false, info: "Error in find user db error occured"});
      }
      if(!!user) {
        cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBFINDUSEREMAILERROR_UPDATEPROFILEHANDLER});
        //cb({success: false, info: "emailId already exists"});
      } else {
        cb(null,msg);
      }
    });
  } else {
    cb(null, msg);
  }
};
/**
 *  This function is used to checkIfAvatar
 *
 * @method checkIfAvatar
 * @param  {Object}       msg  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var checkIfAvatar = function(msg,cb){
 if(!!msg.updateKeys.profileImage){
   serverLog(stateOfX.serverLogType.info,"going for avatar broadcast");
   msg.broadcastName = "avatarChanged";
   msg.broadcastData = {playerId: msg.query.playerId, avtarImage: msg.updateKeys.profileImage};
   broadcastHandler.fireBroadcastOnSession(msg);
 }
 msg = _.omit(msg,"session");
 msg = _.omit(msg,"self");
 cb(null,msg);
};

/**
 *  This function is used to validateMobileNumber
 *
 * @method validateMobileNumber
 * @param  {Object}       msg  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var validateMobileNumber = function (msg, cb) {
  if(!!msg.updateKeys.mobileNumber) {
    if(Number.isInteger(msg.updateKeys.mobileNumber) && msg.updateKeys.mobileNumber > 0) {
      db.findUser({mobileNumber: msg.updateKeys.mobileNumber}, function (err, user) {
        if(err) {
          cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBVALIDATEMOBILENUMBER_DBERROR_UPDATEPROFILEHANDLER});
        //  cb({success: false, info: "Error in find user db error occured"});
        }
        if(!!user) {
          cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBVALIDATEMOBILENUMBER_EXISTINGMOBILENUMBER_UPDATEPROFILEHANDLER});
          //cb({success: false, info: "mobileNumber already exists"});
        } else {
          cb(null,msg);
        }
      });
    } else {
      cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBVALIDATEMOBILENUMBER_INVALIDMOBILENUMBER_UPDATEPROFILEHANDLER});
      //cb({success: false, info: "mobileNumber is not valid"});
    }
  } else {
    cb(null, msg);
  }
};


/**
 *  This function is used to updateUser
 *
 * @method update user
 * @param  {Object}       msg  request json object(pancard number,isMobileVerified)
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var updateUser = function (msg,cb) {
  var successResponse = {};
  keyValidator.validateKeySets("Request", msg.serverType, "updateUser", msg, function (validated){
    if(validated.success) {
      if(!!msg.updateKeys.emailId) {
        msg.updateKeys.isEmailVerified = false;
      }
      if(!!msg.updateKeys.mobileNumber) {
        msg.updateKeys.isMobileNumberVerified = false;
      }
      db.updateUser(msg.query,msg.updateKeys, function (err, response) {
        // serverLog(stateOfX.serverLogType.info,"response in upadate User",response);
        if(err) {
          cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBUPDATEUSER_DBERROR_UPDATEPROFILEHANDLER});
          return;
          //cb(null,{success: false, info: "error in updating user in db"});
        }
        if(!!response && !!response.result) {
          successResponse = {success: true, info:"user updated successfully", isRetry: false, isDisplay: false, channelId: ""};
          // keyValidator.validateKeySets("Response", msg.serverType, "updateProfile", successResponse, function (validated){
          //   if(validated.success) {
          //     cb(null, successResponse);
          //   } else {
          //     cb(null, validated);
          //   }
          // });
          cb(null, {success: true, info:"user updated successfully", isRetry: false, isDisplay: false, channelId: ""});
        } else {
          cb(null,{success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBUPDATEUSER_NOUSERERROR_UPDATEPROFILEHANDLER});
          //cb(null,{success: false, info: "error in updating user collection in db"});
        }
      });
    } else {
      cb(validated);
    }
  });
};
/**
 *  This function is used to updateProfile through a series of async functions defined above
 *
 * @method updateProfile
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
updateProfileHandler.updateProfile = function(params, cb) {
  var activityParams = {};
  activityParams.data = {};
  var activityCategory = constants.profile.category.profile;
  var activitySubCategory = constants.profile.subCategory.update;
  activityParams.rawInput = _.omit(params,"self");
  activityParams.rawInput = _.omit(activityParams.rawInput,"session");
  activityParams.playerId = params.query.playerId;

	async.waterfall([
	  async.apply(validateEmail, params),
	  validateMobileNumber,
    checkIfAvatar,
	  updateUser
	], function (err, response){
    serverLog(stateOfX.serverLogType.info,"response is in updateProfileHandler " + JSON.stringify(err) + JSON.stringify(response));
	  if(err) {
      cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.falseMessages.UPDATEPROFILEFAIL_UPDATEPROFILEHANDLER});
      //cb({success: false, info: "Profile update failed - " + err});
	  	//cb({success: false, info: "Profile update failed - " + JSON.stringify(err)});
	  } else {
	    activityParams.rawResponse = response;
	    if(response.success) {
	      activityParams.comment = "profile updated successfully";
	      activity.logUserActivity(activityParams,activityCategory,activitySubCategory,constants.profile.activityStatus.completed);
	    } else {
	      activityParams.comment = "Error in profile update";
	      activity.logUserActivity(activityParams,activityCategory,activitySubCategory,constants.profile.activityStatus.error);
	    }
	    cb({success: true, info: "Profile details updated successfully!"});
	  }
	});
};
/**
 *  This function is used to getProfile of a player
 *
 * @method getProfile
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
updateProfileHandler.getProfile = function(params, cb) {
  var onesArray = [];
  for(var itr=0;itr<params.keys.length;itr++) {
    onesArray.push(1);
  }
  serverLog(stateOfX.serverLogType.info,"ones onesArray is " + JSON.stringify(onesArray));
  var keys = _.object(params.keys,onesArray);
  serverLog(stateOfX.serverLogType.info,"tem is " + keys);
  db.getCustomUser(params.playerId, keys, function(err, profile) {
    if(err || !profile) {
      cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBGETCUSTOMUSERFAIL_UPDATEPROFILEHANDLER});
      //cb({success: false, info:"user not available"});
    } else {
      profile.playerId = params.playerId;
      profile._id = (profile._id).toString();
      cb({success:true, result:profile});
    }
  });
};

module.exports = updateProfileHandler;
