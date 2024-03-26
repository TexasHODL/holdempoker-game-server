/*jshint node: true */
"use strict";


var db = require("../../../../shared/model/dbQuery.js");
var logDB = require("../../../../shared/model/logDbQuery.js");
var imdb = require("../../../../shared/model/inMemoryDbQuery.js");
var adminDB = require("../../../../shared/model/adminDbQuery.js");
var financeDB = require("../../../../shared/model/financeDbQuery.js");
var async = require('async');
var _ = require('underscore');
var _ld = require('lodash');
var uuid = require('uuid');
var stateOfX = require("../../../../shared/stateOfX");
var zmqPublish = require("../../../../shared/infoPublisher");
var sharedModule = require("../../../../shared/sharedModule.js");
var keyValidator = require("../../../../shared/keysDictionary");
var encryptDecrypt = require("../../../../shared/passwordencrytpdecrypt.js");
var popupTextManager = require("../../../../shared/popupTextManager");
var userRemote = require("./userRemote");
var responseHandler = require('./responseHandler');
// var botLeaderboardParticipation = require("../../../../../shared/botLeaderboardParticipation.js");
const configConstants = require('../../../../shared/configConstants');

// Create data for log generation
function serverLog(type, log) {
  var logObject = {};
  logObject.fileName = 'dbRemote';
  logObject.serverName = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type = type;
  logObject.log = log;
  zmqPublish.sendLogMessage(logObject);
}

var dbRemote = function (app) {
  this.app = app;
};

module.exports = function (app) {
  return new dbRemote(app);
};

function fixedDecimal(number, precisionValue) {
  let precision = precisionValue ? precisionValue : 2;
  return Number(Number(number).toFixed(precision));
}

/**
 * create unique id of given length
 * @method createUniqueId
 * @param  {Number}       length required length of string
 * @return {String}              random string
 */
var createUniqueId = function (length) {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

/**
 * create suggestions for user ids
 * @deprecated old feature
 * @method generateUserIds
 * @param  {String}        playerId username opted by user
 * @param  {Function}      cb       callback
 */
var generateUserIds = function (playerId, cb) {
  var userIds = [];
  var uniqueUserIds = [];
  serverLog(stateOfX.serverLogType.info, "in generateUserIds in dbRemote");
  for (var i = 0; i < 50; i++) {
    var tempUserId = {
      playerId: playerId + createUniqueId(4)
    };
    userIds.push(tempUserId);
  }
  async.each(userIds, function (userIdObject, callback) {
    db.findUser({ playerId: userIdObject.playerId }, function (err, user) {
      if (err) {
        serverLog(stateOfX.serverLogType.info, "error in finding playerId in db");
        callback();
      }
      if (!!user) {
        callback();
      } else {
        if (uniqueUserIds.length < 6) {
          uniqueUserIds.push(userIdObject.playerId);
        }
        callback();
      }
    });
  }, function (err) {
    serverLog(stateOfX.serverLogType.info, err);
    cb(uniqueUserIds);
  });
};

// ### This function is for format user response at the time of login/signUp
var formatUser = function (user, cb) {
  var userData = {};
  userData.firstName = !!user.firstName ? user.firstName : "";
  userData.lastName = !!user.lastName ? user.lastName : "";
  userData.emailId = !!user.emailId ? user.emailId : "";
  userData.playerId = user.playerId;
  userData.userName = !!user.userName ? user.userName : "";
  userData.profileImage = !!user.profileImage ? user.profileImage : "6";
  userData.prefrences = !!user.prefrences ? user.prefrences : "";
  userData.settings = !!user.settings ? user.settings : "";
  userData.isEmailVerified = user.isEmailVerified;
  userData.isMobileNumberVerified = user.isMobileNumberVerified;
  userData.dailyBonusCollectionTime = user.dailyBonusCollectionTime;
  userData.freeChips = user.freeChips;
  userData.withdrawableChips = fixedDecimal(user.realChips, 2);
  userData.realChips = fixedDecimal((user.realChips + user.instantBonusAmount), 2);
  userData.instantBonusAmount = fixedDecimal(user.instantBonusAmount, 2);
  userData.isMuckHand = user.isMuckHand;
  userData.ipV4Address = user.ipV4Address;
  userData.address = user.address;
  userData.gender = user.gender;
  userData.dateOfBirth = user.dateOfBirth;
  userData.mobileNumber = !!user.mobileNumber ? user.mobileNumber : "";
  userData.isParentUserName = user.isParentUserName;
  userData.isParent = user.isParent;
  userData.loyalityRakeLevel = user.loyalityRakeLevel || 0;
  userData.letter = user.letter || [false, false];
  userData.offers = user.offers || [false, false];
  userData.tournaments = user.tournaments || [false, false];
  userData.anouncement = user.anouncement || [false, false];
  userData.createdAt = user.createdAt;
  userData.lastLogin = user.lastLogin;
  userData.statistics = user.statistics; // need to add megapoint percent - done
  userData.tournamentsPlayed = 0;//user.statistics.handsPlayed;
  userData.tournamentsEarnings = 0;//user.statistics.handsWon;
  userData.unclamedBonus = user.unclamedBonus || 0;
  userData.emailVerificationToken = user.emailVerificationToken || 0;
  userData.cashoutGamePlay = checkParentType(user);
  userData.totalLeaderboardWinnings = user.totalLeaderboardWinnings || 0;
  updateMegaPointsPercent(userData, function (userData) {
    unclaimedBonusData(userData, function (userData) {
      cb(userData);
    });
  });
  // cb(userData);
};


var checkParentType = function (data) {
  if (data.parentType.toUpperCase() == 'AGENT' || data.parentType.toUpperCase() == 'SUB-AGENT') {
    return true;
  } else {
    return false;
  }
};

/**
 * update players megapoint percent acc to new/old user
 * may be start with 0 megapoints, hence first level bronze
 * @method updateMegaPointsPercent
 * @param  {Object}                userData user object
 * @param  {Function}              cb       callback
 */
function updateMegaPointsPercent(userData, cb) {
  adminDB.findAllMegaPointLevels({}, function (err, res) {
    serverLog(stateOfX.serverLogType.info, 'response of findAllMegaPointLevels', err, res);
    if (err || !res) {
      // cb({success: false, info: "db - query failed.- findAllMegaPointLevels"}); 
      cb(userData);
      return;
    } else {
      userData.statistics.megaPointsPercent = getLevelPercent(userData.statistics.megaPoints, res);
      userData.statistics.megaPointLevel = getLevelName(userData.statistics.megaPointLevel, res);
      cb(userData);
    }
  });
  function getLevelName(levelId, levels) {
    var t = _.findWhere(levels, { levelId: levelId }) || levels[0];
    return t.loyaltyLevel;
  }
  function getLevelPercent(points, levels) {
    if (points <= 0) {
      return 0;
    }
    if (levels.length <= 0) {
      return 0;
    }
    if (levels.length > 0) {
      function calculator(arr, value) {
        for (var i = 0; i < arr.length; i++) {
          if (arr[i].levelThreshold > value) { // levelThreshold is min value of range
            break;
          }
        }
        if (i >= arr.length) {
          return 101; // any value > 100 to represent highest level
        }
        return (100 * (value - arr[i - 1].levelThreshold) / (arr[i].levelThreshold - arr[i - 1].levelThreshold));
      }
      var c = calculator(levels, points);
      c = Math.floor(c * 100) / 100; // limiting decimal places
      return (c || 0);
    }
  }
}

/**
 * get total unclaimed bonus data
 * @method unclaimedBonusData
 * @param  {Object}           userData user object
 * @param  {Function}         cb       callback
 */
function unclaimedBonusData(userData, cb) {
  var query = {};
  query.playerId = userData.playerId;
  db.findBounsData(query, function (err, res) {
    if (err || res == null) {
      userData.unclamedBonus = 0;
      cb(userData);
      return;
    } else {
      for (var i = 0; i < res.bonus.length; i++) {
        userData.unclamedBonus += res.bonus[i].unClaimedBonus;
      }
      cb(userData);
    }

  });
}

/**
 * find user, check if banned or email not verified,
 * decrypt password, if same password in request then able to login
 * @method findAndModifyUserForValidateUser
 * @param  {Object}                         msg            request data for login
 * @param  {Object}                         filterForUser  various key combinations to find user
 * @param  {Object}                         userUpdateKeys keys to update - lastlogin, ip etcetra
 * @param  {Function}                       cb             callback
 */
var findAndModifyUserForValidateUser = function (msg, filterForUser, userUpdateKeys, cb) {
  db.findAndModifyUser(filterForUser, userUpdateKeys, function (err, result) {
    if (err) {
      cb({ success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DB_ERROR_FINDING_USER });
      return;
      //cb({success : false, info : "error in finding user from db"});
    }
    if (!!result.value) {
      serverLog(stateOfX.serverLogType.info, "result of users are ", JSON.stringify(result.value));
      if (!!result.value.isBlocked && result.value.isBlocked) {
        if (!result.value.isEmailVerified) {
          cb({ success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DB_PLAYER_EMAIL_NOT_VERIFIED });
          return;
        }
        cb({ success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DB_BLOCK_USER_BY_ADMIN });
        //cb({success : false, info : "User is blocked by admin"});
      } else {
        formatUser(result.value, function (user) {
            cb({ success: true, user: user });
          });
      }
    } else {
      cb({ success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DB_USERNAME_PASSWORD_INCORRECT });
      //cb({success : false, info : "userName or password Incorrect"});
    }
  });
};

// This function will called only when normal users are trying to logged in not for social login
dbRemote.prototype.validateUser = function (msg, cb) {
  serverLog(stateOfX.serverLogType.info, "in validate user in dbRemote is ", JSON.stringify(msg));
  if (!!msg) {
    var userUpdateKeys = {};
    var filterForUser = {};
    userUpdateKeys.ipV4Address = msg.ipV4Address;
    userUpdateKeys.ipV6Address = msg.ipV6Address;
    userUpdateKeys.lastLogin = Number(new Date());
    if (!!msg.userName) {
      filterForUser.userName = eval('/^' + msg.userName + '$/i');// msg.userName; //for ignore case; db.stuff.find( { foo: /^bar$/i } );
    }
    db.findUser({ userName: eval('/^' + msg.userName + '$/i') }, function (err, resp) {
      if (!err && !!resp) {
        console.log("plaayer response" + resp.buildAccess[msg.deviceType]);
        if (resp.buildAccess[msg.deviceType]) {
          console.log("Player can play with this build");
          playerLoginCount(resp);
          findAndModifyUserForValidateUser(msg, filterForUser, userUpdateKeys, function (result) {
            cb(result);
          });
        } else {
          cb({ success: false, info: "You have been blocked from playing with this build" });
        }
      } else {
        cb({ success: false, info: "Invalid user" });
      }
    });
  }
};

var setFirstName = function (dataOfUser) {
  return !!dataOfUser && dataOfUser.firstName ? dataOfUser.firstName : "";
};

var setLastName = function (dataOfUser) {
  return !!dataOfUser && dataOfUser.lastName ? dataOfUser.lastName : "";
};

var setGender = function (dataOfUser) {
  return !!dataOfUser && dataOfUser.gender ? dataOfUser.gender : "";
};

var setDateOfBirth = function (dataOfUser) {
  return !!dataOfUser && dataOfUser.dateOfBirth ? dataOfUser.dateOfBirth : "";
};

var setEmailId = function (dataOfUser) {
  return !!dataOfUser && dataOfUser.emailId ? dataOfUser.emailId : "";
};

var setMobileNumber = function (dataOfUser) {
  return !!dataOfUser && dataOfUser.mobileNumber ? dataOfUser.mobileNumber : "";
};

var setCountryCode = function (dataOfUser) {
  return !!dataOfUser && dataOfUser.countryCode ? dataOfUser.countryCode : "";
};

var setUserName = function (dataOfUser) {
  return !!dataOfUser && dataOfUser.userName ? dataOfUser.userName : "";
};

var setIpV4Address = function (dataOfUser) {
  return !!dataOfUser && dataOfUser.ipV4Address ? dataOfUser.ipV4Address : "";
};

var setIpV6Address = function (dataOfUser) {
  return !!dataOfUser && dataOfUser.ipV6Address ? dataOfUser.ipV6Address : "";
};

var setProfileImage = function (dataOfUser) {
  return !!dataOfUser && dataOfUser.profileImage ? dataOfUser.profileImage : "18";
};

var setDeviceType = function (dataOfUser) {
  return !!dataOfUser && dataOfUser.deviceType ? dataOfUser.deviceType : "";
};

var setLoginMode = function (dataOfUser) {
  return !!dataOfUser && dataOfUser.loginMode ? dataOfUser.loginMode : "";
};

var setGoogleObject = function (dataOfUser) {
  return !!dataOfUser && dataOfUser.googleObject ? dataOfUser.googleObject : "";
};

var setFacebookObject = function (dataOfUser) {
  return !!dataOfUser && dataOfUser.facebookObject ? dataOfUser.facebookObject : "";
};

// ### This internal function is for setting up the keys of user at the time of sign up of user
var createDataForUser = function (dataOfUser, cb) {
  serverLog(stateOfX.serverLogType.info, "data of user in createDataForUser from client - " + JSON.stringify(dataOfUser));
  var userObject = {};
  var address = {
    pincode: "",
    city: "",
    state: "",
    address2: "",
    address1: ""
  };
  var statistics = {
    bestHand: "",
    handsPlayedRM: 0,
    handsPlayedPM: 0,
    handsWonRM: 0,
    handsWonPM: 0,
    handsLost: 0,
    megaPoints: 0,
    megaPointLevel: 1,
    countPointsToChips: 0,
    countPointsForBonus: 0
  };
  var prefrences = {
    tableLayout: "",
    autoBuyIn: "",
    autoBuyInAmountInPercent: "",
    cardColor: false
  };
  var settings = {
    seatPrefrence: 1,
    seatPrefrenceTwo: 1,
    seatPrefrenceSix: 1,
    muteGameSound: false,
    dealerChat: true,
    playerChat: true,
    adminChat: true,
    runItTwice: false,
    avatarId: 1,
    tableColor: 3
  };
  var chipsManagement = {
    deposit: 0,
    withdrawl: 0,
    withdrawlPercent: 5,
    withdrawlCount: 0,
    withdrawlDate: Number(new Date())
  };
  var buildAccess = {
    androidApp: true,
    iosApp: true,
    mac: true,
    browser: true,
    windows: true,
    website: true
  };
  var encryptPass = encryptDecrypt.encrypt(dataOfUser.password);
  if (encryptPass.success) {
    userObject.password = encryptPass.result;
  } else {
    cb({ success: false });
  }
  userObject.sponserId = dataOfUser.isParentUserName;
  userObject.walletAddress = dataOfUser.walletAddress || "";
  userObject.firstName = setFirstName(dataOfUser);
  userObject.lastName = setLastName(dataOfUser);
  userObject.gender = setGender(dataOfUser);
  userObject.dateOfBirth = setDateOfBirth(dataOfUser);
  userObject.emailId = setEmailId(dataOfUser);
  userObject.countryCode = setCountryCode(dataOfUser);
  userObject.mobileNumber = setMobileNumber(dataOfUser);
  userObject.userName = setUserName(dataOfUser);
  userObject.ipV4Address = setIpV4Address(dataOfUser);
  userObject.ipV6Address = setIpV6Address(dataOfUser);
  userObject.profileImage = setProfileImage(dataOfUser);
  userObject.deviceType = setDeviceType(dataOfUser);
  userObject.loginMode = setLoginMode(dataOfUser);
  userObject.googleObject = setGoogleObject(dataOfUser);
  userObject.facebookObject = setFacebookObject(dataOfUser);
  userObject.isParent = dataOfUser.isParent || "";
  userObject.isParentUserName = dataOfUser.isParentUserName || "";
  userObject.affiliateEmail = dataOfUser.affiliateEmail || "";
  userObject.affiliateMobile = dataOfUser.affiliateMobile || "";
  userObject.userRole = dataOfUser.isParentUserName ? dataOfUser.userRole : "";
  userObject.parentType = dataOfUser.isParentUserName ? dataOfUser.parentType : "";
  userObject.playerId = uuid.v4();
  userObject.createdAt = Number(new Date());
  userObject.address = address;
  userObject.statistics = statistics;
  userObject.prefrences = prefrences;
  userObject.settings = settings;
  userObject.buildAccess = buildAccess;
  userObject.isEmailVerified = false;
  userObject.isMobileNumberVerified = true;
  userObject.isNewUser = true;
  userObject.isBlocked = false;
  userObject.isMuckHand = false;
  userObject.dailyBonusCollectionTime = Number(new Date());
  userObject.previousBonusCollectedTime = 0;
  userObject.lastLogin = Number(new Date());
  userObject.profilelastUpdated = "";
  userObject.sponserId = dataOfUser.sponserId || null;
  // userObject.freeChips                      =  10000000000;
  userObject.freeChips = 5000;
  userObject.realChips = 0;
  userObject.instantBonusAmount = dataOfUser.instantBonusAmount;
  userObject.instaCashBonusRewarded = false;  //make it to false if real chips is 0
  // userObject.realChips                      =  100000;//(dataOfUser.isBot ? 50000 : 100000);
  userObject.passwordResetToken = "";
  userObject.isResetPasswordTokenExpire = "";
  userObject.emailVerificationToken = "";
  userObject.isEmailVerificationTokenExpire = "";
  userObject.loyalityRakeLevel = 0;
  userObject.isBot = (dataOfUser.isBot ? true : false);
  userObject.offers = [false, false];
  userObject.tournaments = [false, false];
  userObject.letter = [false, false];
  userObject.anouncement = [false, false];
  userObject.chipsManagement = chipsManagement;
  userObject.claimedInstantBonus = 0;
  userObject.isOrganic = true;
  userObject.rakeBack = 0;
  userObject.status = 'Active';
  userObject.promoBonusAwarded = dataOfUser.promoBonusAwarded;
  userObject.totalLeaderboardWinnings = 0;
  serverLog(stateOfX.serverLogType.info, "format data for userObject is ", JSON.stringify(userObject));
  cb({ success: true, result: userObject });
};

/**
 * check if there is alrady a user  with given data - email, mobile, username
 * @method existingUser
 * @param  {Object}     filter        request data
 * @param  {Object}     filterForUser some keys from request data - as available
 * @param  {Object}     user          found user object - the already user with request data
 * @param  {Function}   cb            callback
 */
var existingUser = function (filter, filterForUser, user, cb) {
  var infoMessage;
  serverLog(stateOfX.serverLogType.info, "existing user in create profile in dbRemote - " + JSON.stringify(user));
  if ((filter.loginType).toLowerCase() === 'registration' && (filter.loginMode).toLowerCase() === 'normal') {
    infoMessage = "UserName already exists try with different username.";
    serverLog(stateOfX.serverLogType.info, "existing user for login type registration in dbRemote");
    if (!!user.userName && !!filterForUser.userName && user.userName === filterForUser.userName) {
      generateUserIds(filter.userName, function (userIds) {
        serverLog(stateOfX.serverLogType.info, "generated userIds are in create profile ", JSON.stringify(userIds));
        cb({ success: false, info: infoMessage, suggestions: userIds });
      });
    } else {
      cb({ success: false, info: infoMessage });
    }
  } else {
    if (!!user && user.isBlocked) {
      if (!user.isEmailVerified) {
        cb({ success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DB_PLAYER_EMAIL_NOT_VERIFIED });
        return;
      }
      cb({ success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DB_BLOCK_USER_BY_ADMIN });
      //cb({success : false, info : "User is blocked by admin"});
    } else {
      playerLoginCount(user);
      var userUpdateKeys = {};
      userUpdateKeys.ipV4Address = filter.ipV4Address;
      userUpdateKeys.ipV6Address = filter.ipV6Address;
      userUpdateKeys.lastLogin = Number(new Date());
      serverLog(stateOfX.serverLogType.info, "existing google/fb user in create profile in dbRemote - " + JSON.stringify(user));
      db.findAndModifyUser({ userName: filter.userName }, userUpdateKeys, function (err, updatedUser) {
        if (err) {
          cb({ success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DB_ERROR_UPDATE_FAILED_USER });
          //cb({success : false, info :"failed to update user due to db error"});
        }
        if (!!updatedUser) {
          serverLog(stateOfX.serverLogType.info, "in updated fb/google user in create profile - " + JSON.stringify(updatedUser.value));
          formatUser(updatedUser.value, function (user) {
            cb({ success: true, user: user });
          });
        } else {
          cb({ success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DB_ERROR_UPDATE_FAILED_USER });
          //cb({success : false, info :"failed to update user"});
        }
      });
      //cb({success : true, user :user});
    }
  }
};


var addInBalanceSheet = function (user) {
  console.log("in add balance sheet--");
  var query = { $inc: { instaCashBonus: user.realChips } };
  financeDB.updateBalanceSheet(query, function (err, result) {
    console.log("inside update instaCashBonus in balance sheet--", err, result);
  });
};

var updatebalanceInstaAmount = function (chips) {
  var query = { $inc: { instantBonusAmount: chips } };
  financeDB.updateBalanceSheet(query, function (err, result) {
    console.trace("inside update instantBonusAMount in balance sheet--");
  });
};

function insertDefaultdataInFriens(playerId) {
  const data = {
    playerId,
    requestReceived: [],
    friends: [],
    requestSent: []
  }
  db.insertFriendsData(data, function (err, result) {
    console.log("friends data inserted -> ", err, result);
  })
}

/**
 * create new user, initialize its bonus data, megapoints slot etc.
 * @method newUser
 * @param  {Object}   filter        user data acc to request
 * @param  {Object}   filterForUser filterkeys - not used in this function
 * @param  {[type]}   user          user object - not used in this function
 * @param  {Function} cb            callback
*/

var newUser = function(filter, filterForUser,user,cb) {
    createDataForUser(filter, function(dataOfUser) {
        if(dataOfUser.success) {
            dataOfUser = dataOfUser.result;
            var emailVerificationToken = createUniqueId(10);
            dataOfUser.emailVerificationToken = emailVerificationToken;
          insertDefaultdataInFriens(dataOfUser.playerId);
            db.createUser(dataOfUser, function(err, user) {
                if(err) {
                    serverLog(stateOfX.serverLogType.info, "error in creating user document in db");
          cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DB_ERROR_CREATE_USERDOCUMENT});
          //cb({success : false, info : "error in creating user document in db"});
        }
        if (!!user) {
          serverLog(stateOfX.serverLogType.info, "new user created is in createProfile in dbRemote is - " + JSON.stringify(user));
          /**for updating balance sheet **/
          if (user.instaCashBonusRewarded) {
            addInBalanceSheet(user);
          }
          if (user.instantBonusAmount) {
            updatebalanceInstaAmount(user.instantBonusAmount);
          }
          var bonusDataofThisUser = {};
          bonusDataofThisUser.playerId = dataOfUser.playerId;
          bonusDataofThisUser.bonus = [];
          db.createBonusData(bonusDataofThisUser, function (err, resultBonusData) {
            console.error(err, resultBonusData);
          });
          let data = {};
          data.userName = user.userName;
          data.amount = user.instantBonusAmount;
          data.type = 'signUp';
          data.time = Number(new Date());
          data.parentUserName = user.isParentUserName;
          data.promoCode = user.isParentUserName;
          data.sponserId = filter.sponserId;
          data.bonusChipsType = "instant";
          data.lockedBonusAmount = 0;
          if (data.amount > 0) {
            db.saveInstantBonusHistory(data, function (err, result) {
              console.log("instant bonus History created");
            });
            var passbookData = {
              amount: user.instantBonusAmount,
              time: Number(new Date()),
              category: "Deposit",
              subCategory: "Signup Bonus",
              prevAmt: 0,
              newAmt: user.instantBonusAmount
            };
            adminDB.createPassbookEntry({ playerId: user.playerId }, passbookData, function (err, result) {
              console.log(err, result);
            });
          }
          formatUser(user, function (user) {
            cb({ success: true, user: user });
          });
          // Previously used No need Now (Deprectaed) 29Aug Digvj
          // if(userRemote.afterUserCreated instanceof Function){
          //     userRemote.afterUserCreated(user);
          // }
        } else {
          cb({ success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DB_ERROR_CREATE_USERDOCUMENT });
          //cb({success : false, info : "error in creating user document in db"});
        }
      });
    } else {
      cb({ success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.falseMessages.ERROR_DECRYPTING_PASSWORD });
      //cb({success : false, info : "error in decrypt password"});
    }
  });
};

/**
 * find user details in db, whether already existing or it is new
 * @method findUserOrOperation
 * @param  {Object}            filter        user request data
 * @param  {Object}            filterForUser query object to find users with
 * @param  {Function}          cb            callback
 */
var findUserOrOperation = function (filter, filterForUser, cb) {
  console.error(filter);
  db.findUserOrOperation(filterForUser, function (err, user) {
    serverLog(stateOfX.serverLogType.info, "user is in create user in dbremote - " + JSON.stringify(user));
    if (err) {
      serverLog(stateOfX.serverLogType.info, "error in finding user from db in validateUser in dbRemote");
      cb({ success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBFINDUSER_VALIDATEKEYSETS_SENDOTP_USERCONTROLLER_USER });
      return;
      //cb({success : false, info : "error in find user from db"});
    }
    // If userName exists
    if (!!user) {
      existingUser(filter, filterForUser, user, function (result) {
        cb(result);
      });
    } else { // If new user
      newUser(filter, filterForUser, user, function (result) {
        cb(result);
      });
    }
  });
};


// creation of a profile for normal/facebook/goole users
dbRemote.prototype.createProfile = function (filter, cb) {
  console.error(stateOfX.serverLogType.info, "data of user getting from client in create profile in dbRemote - " + JSON.stringify(filter));
  if (!!filter.userName) {
    var filterForUser = {};
    if (!!filter.userName) {
      filterForUser.userName = eval('/^' + filter.userName + '$/i');// filter.userName;; //for ignore case; db.stuff.find( { foo: /^bar$/i } );
    }
    var queryForAdmin = {};
    if (!!filter.userName) {
      queryForAdmin.userName = eval('/^' + filter.userName + '$/i');// filter.userName;; //for ignore case; db.stuff.find( { foo: /^bar$/i } );
    }

    adminDB.findUserOrOperation(queryForAdmin, function (err, user) {
      if (err) {
        cb({ success: false, info: "Please try again!!" });
      }
      if (!!user) {
        cb({ success: false, info: "User With same Details Exists" });

      } else {
        var filterForParent = {};
        filterForParent.affiliateId = filter.isParentUserName;
        checkParentAffiliateExists(filterForParent, function (responseForAff) {
          if (responseForAff.success) {
            if (responseForAff.result) {
              filter.isParentUserName = responseForAff.result.userName;
              filter.userRole = responseForAff.result.role;
              filter.promoBonusAwarded = responseForAff.result.promoBonusAwarded;
              filter.instantBonusAmount = responseForAff.result.instantBonusAmount || 0;
              filter.affiliateEmail = responseForAff.result.email;
              filter.affiliateMobile = responseForAff.result.mobile;
              if (responseForAff.result.role.level == 0) {
                filter.parentType = (responseForAff.result.role.name == 'newaffiliate' ? 'AFFILIATE' : 'AGENT');
              } else {
                filter.parentType = (responseForAff.result.role.name == 'newsubAffiliate' ? 'SUB-AFFILIATE' : 'SUB-AGENT');
              }
              // updatebalanceInstaAmount(responseForAff.result.instantBonusAmount); // moved after creation successfull
            } else {
              filter.instantBonusAmount = 0;
            }
            findUserOrOperation(filter, filterForUser, function (response) {
              cb(response);
            });
          } else {
            filter.sponserId = filter.isParentUserName;
            delete filter.isParentUserName;
            if (filter.sponserId && filter.sponserId.length > 0) {
              db.findUserOrOperation({userName:filter.sponserId }, function(err, user){
                if (err) {
                  serverLog(stateOfX.serverLogType.info, "error in finding user from db in validateUser in dbRemote");
                  cb({ success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBFINDUSER_VALIDATEKEYSETS_SENDOTP_USERCONTROLLER_USER });
                  return;
                  //cb({success : false, info : "error in find user from db"});
                }
                // If userName exists
                if (!!user) {
                  if (user.isParentUserName && user.isParentUserName.length > 0) {
                    cb({ success: false, isRetry: false, isDisplay: false, channelId: "", info: "Sponsor isn't valid." });
                  } else {
                    findUserOrOperation(filter, filterForUser, function (response) {
                      cb(response);
                    });
                  }
                } else {
                  cb({ success: false, isRetry: false, isDisplay: false, channelId: "", info: "Sponsor doesn't exist." });
                }
              });
            } else {
              findUserOrOperation(filter, filterForUser, function (response) {
                cb(response);
              });
            }
            
            
            // cb(responseForAff);
          }
        });
      }
    });
    serverLog(stateOfX.serverLogType.info, "filter in create user is ", filterForUser);
  } else {
    cb({ success: false, info: "username or emailId is required" });
  }
};

var isInstantBonusAwarded = function (params, cb) {
  var query = { promoCode: params.userName };
  adminDB.listPromoBonus(query, function (err, result) {
    if (result.length > 0) {
      params.instantBonusAmount = result[0].amount;
      params.promoBonusAwarded = true;
      cb(null, params);
    } else {
      params.instantBonusAmount = 0;
      params.promoBonusAwarded = false;
      cb(null, params);
    }
  });
};

var checkParentAffiliateExists = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "params is in checkParentAffiliateExists is - " + JSON.stringify(params));
  console.log("..............line 658 ", params, "..........over");
  if (!params.affiliateId) {
    return cb({ success: true });
  }
  var query = {};
  params.affiliateId = params.affiliateId.trim();
  if (!validateUserName(params.affiliateId)) {
    console.log("here");
    cb({ success: false, info: "Promocode does not exist" });
    return;
  }
  query = { userName: eval('/^' + params.affiliateId + '$/i'), "role.level": { $lte: 0 }, status: "Active" };
  adminDB.getUser(query, function (err, result) {
    if (!err) {
      if (result) {
        isInstantBonusAwarded(result, function (err, bonusResult) {
          cb({ success: true, result: bonusResult });
        });
      } else {
        cb({ success: false, info: "PromoCode does not exist." });
      }
    }
    else {
      cb({ success: false, info: "Something went wrong. Unable to get PromoCode details." });
    }
  });
};

var validateUserName = function (userName) {
  var patt = /^[a-zA-Z0-9_]*$/;
  return patt.test(userName);
};


/**
 * Get Tables list For Normal Games With Count of players sitting and in queue
 * @method getTablesForNormalGamesWithCount
 */
var getTablesForNormalGamesWithCount = function (params, callback) {
  serverLog(stateOfX.serverLogType.info, "params is in getTablesForNormalGamesWithCount is - " + JSON.stringify(params));
  if (!!params.allTables[0] && params.allTables[0].channelType === "NORMAL") {
    async.forEachOf(params.allTables, function (value, key, cb) {
      imdb.getTable(value._id, function (err, result) {
        if (err) {
          callback({ success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DB_ERROR_GETTING_MEMORY });
          //callback({success: false, info: "Error in getting in Memory tables"});
        } else {
          if (result) {
            params.allTables[key].playingPlayers = result.players.length;
            params.allTables[key].queuePlayers = result.queueList.length;
          } else {
            params.allTables[key].playingPlayers = 0;
            params.allTables[key].queuePlayers = 0;
          }
          cb();
        }
      });

    }, function (err) {
      if (err) {
        callback({ success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DB_ERROR_PROCESSING_TABLE });
        //callback({success: false, info: "Error in processing tables"});
      } else {
        callback(null, params);
      }
    });
  } else {
    serverLog(stateOfX.serverLogType.info, "This is not a tournament");
    callback(null, params);
  }
};

// tournament
var getEnrolledPlayersInTounaments = function (params, callback) {
  serverLog(stateOfX.serverLogType.info, "inr getEnrolledPlayersInTounament");
  if (!!params.allTables[0] && params.allTables[0].channelType === "TOURNAMENT") {
    async.eachOfSeries(params.allTables, function (room, index, cb) {
      var filter = {
        gameVersionCount: room.gameVersionCount,
        tournamentId: room._id.toString()
      };
      db.countTournamentusers(filter, function (err, result) {
        serverLog(stateOfX.serverLogType.info, "result is in getEnrollled players is - " + JSON.stringify(result));
        if (err) {
          serverLog(stateOfX.serverLogType.info, "error in getting tournament users in getEnrolledPlayersInTounaments");
          callback({ success: false, info: "Error in count tournament users", isRetry: false, isDisplay: false, channelId: "" });
        } else {
          params.allTables[index]["enrolledPlayers"] = result;
          if (result <= params.allTables[index]["minPlayersForTournament"]) {
            params.allTables[index]["prizePool"] = params.allTables[index]["entryfees"] * params.allTables[index]["minPlayersForTournament"];
          } else {
            params.allTables[index]["prizePool"] = params.allTables[index]["entryfees"] * result;
          }
          if (params.allTables[index]["state"] === stateOfX.gameState.running) {
            params.allTables[index]["runningFor"] = Number(new Date()) - params.allTables[index]["tournamentStartTime"];
          } else {
            params.allTables[index]["runningFor"] = 0;
          }
          cb();
        }
      });
    }, function (err) {
      if (err) {
        callback({ success: false, info: "Error in getting enrolled players", isRetry: false, isDisplay: false, channelId: "" });
      } else {
        callback(null, params);
      }
    });
  } else {
    callback(null, params);
  }
};

/**
 * fetch tables list from wiredTiger db
 * @method listTable
 */
var listTable = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "in list table in dbRemote" + JSON.stringify(params));
  db.listTable(_.omit(params, "playerId"), function (err, result) {
    if (err) {
      cb({ success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DB_ERROR_SOMETHING_WRONG_TABLE });
      //cb({success: false, info: "Something went wrong!! unable to get table!"});
    } else {
      serverLog(stateOfX.serverLogType.info, "list table response is - " + JSON.stringify(result));
      params.allTables = result;
      cb(null, params);
    }
  });
};

/**
 * adjust some keys in table
 * @method resetAvgPotandFlopPercentValues
 */
var resetAvgPotandFlopPercentValues = function (params, cb) {
  async.each(params.allTables, function (table, ecb) {
    table.avgStack = !!table.avgStack ? table.avgStack : 0;
    table.flopPercent = !!table.flopPercent ? table.flopPercent : 0;
    ecb();
  }, function (err) {
    if (err) {
      cb({ success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DB_ERROR_RESETTING_AVGPOT_FLOPPERCENT_FAILED + JSON.stringify(err) });
      //cb({success: false, info: "Resetting avg-pot and flop-percent failed - " + JSON.stringify(err)});
    } else {
      cb(null, params);
    }
  });
};

/**
 * remove extra Keys in table object
 * @method removeExtraKeys
 */
var removeExtraKeys = function (params, cb) {
  async.each(params.allTables, function (table, ecb) {
    var tableIndex = _ld.findIndex(params.allTables, table);
    if (table.channelVariation !== stateOfX.channelVariation.ofc) { // Remove for non-OFC tables
      table = _.omit(table, "isStraddleEnable", "numberOfRebuyAllowed", "hourLimitForRebuy", "rebuyHourFactor", "gameInfo", "gameInterval", "blindMissed", "rakeRule", "isActive", "totalGame", "totalPot", "avgPot", "totalPlayer", "totalFlopPlayer", "avgFlopPercent", "totalStack", "gameInfoString", "createdAt", "updatedBy", "updatedAt", "rake", "createdBy");
      table.registrationStartTime = table.tournamentStartTime - table.registrationBeforeStarttime * 60000;
    } else { // Remove keys for OFC games
      table = _.omit(table, "smallBlind", "bigBlind", "flopPercent", "avgStack", "minPlayers", "isStraddleEnable", "numberOfRebuyAllowed", "hourLimitForRebuy", "rebuyHourFactor", "gameInfo", "gameInterval", "blindMissed", "rakeRule", "isActive", "totalGame", "totalPot", "avgPot", "totalPlayer", "totalFlopPlayer", "avgFlopPercent", "totalStack", "gameInfoString", "createdAt", "updatedBy", "updatedAt", "rake", "createdBy");
    }
    table.isPrivateTabel = String(table.isPrivateTabel || false);
    params.allTables[tableIndex] = table;
    ecb();
  }, function (err) {
    if (err) {
      cb({ success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DB_ERROR_RESETTING_AVGPOT_FLOPPERCENT_FAILED + JSON.stringify(err) });
      //cb({success: false, info: "Resetting avg-pot and flop-percent failed - " + JSON.stringify(err)});
    } else {
      cb(null, params);
    }
  });
};

/**
 * fetch list of fav tables of player
 * @method getPlayerFavouriteTables
 */
var getPlayerFavouriteTables = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "in getPlayerFavouriteTables params is - " + JSON.stringify(params));
  // console.trace(params);
  db.findUser({ playerId: params.playerId }, function (err, player) {
    console.log("player is - " + JSON.stringify(player));
    if (err || !player) {
      cb({ success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DB_ERROR_GETTING_FAVOURITE_SEAT_PLAYER });
      //cb({success : false, info: "Error in getting favourite seats of players"});
    } else {
      serverLog(stateOfX.serverLogType.info, "player is - " + JSON.stringify(player));
      params.favouriteTables = !!player.favourateTable ? player.favourateTable : [];
      cb(null, params);
    }
  });
};

/**
 * mark table object fav acc to player's settings
 * @method processingFavouriteTables
 */
var processingFavouriteTables = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "in processingFavouriteTables - " + JSON.stringify(params));
  for (var favIt = 0; favIt < params.favouriteTables.length; favIt++) {
    for (var tableIt = 0; tableIt < params.allTables.length; tableIt++) {
      if (params.favouriteTables[favIt].channelId == params.allTables[tableIt]._id) {
        params.allTables[tableIt].favourite = true;
        break;
      }
    }
  }
  cb(null, params);
};

/**
 * get table password for the person who created the table
 */
var getPasswordForUser = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "in getPasswordForUser - " + JSON.stringify(params));
  db.findUser({ playerId: params.playerId }, function (err, player) {
    console.log(`playerData , ${JSON.stringify(player.userName)}`);
    if (err || !player) {
      cb(null, params);
    } else {
      var updatedTables = [];

      params.allTables.map(function (table) {
          if (table.createdBy === player.userName) {
            // table.passwordForPrivate = result.passwordForPrivate;
          } else {
            delete table.passwordForPrivate;
          }

        updatedTables.push(table);

        
      });
      params.allTables = updatedTables;
      cb(null, params);
    }  
  });
};

/**
 * get table from inmem or wiredTiger db, create response
 * @deprecated not used here
 * @method getTableData
 */
var getTableData = function (params, cb) {
  keyValidator.validateKeySets("Request", "database", "getTableView", params, function (validated) {
    if (validated.success) {
      imdb.getTable(params.channelId, function (err, table) {
        if (err || !table) {
          db.findTableById(params.channelId, function (err, table) {
            if (err || !table) {
              cb({ success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.dbQyeryInfo.DBGETTABLE_GETTABLEVIEW_TABLEREMOTE });
            } else {
              responseHandler.setTableViewKeys({ table: table, channelId: params.channelId, playerId: params.playerId }, function (response) {
                cb(response);
              });
            }
          });
        } else {
          responseHandler.setTableViewKeys({ table: table, channelId: params.channelId, playerId: params.playerId }, function (response) {
            cb(response);
          });
        }
      });
    } else {
      cb(validated);
    }
  });
};

// Get inside table players details for each table
// @deprecated
var insideLobbyData = function (params, cb) {
  params.insideData = {};
  async.each(params.allTables, function (table, ecb) {
    getTableData({ channelId: table._id, playerId: params.playerId }, function (tableViewResponse) {
      delete tableViewResponse.success;
      params.insideData[table._id] = tableViewResponse;
      ecb();
    });
  }, function (err) {
    if (err) {
      cb({ success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBGETTABLE_GETTABLEVIEW_TABLEREMOTE + JSON.stringify(err) });
    } else {
      cb(null, params);
    }
  });
};

/**
 * fetch tables list on lobby
 * @method getTablesForGames
 * @param  {Object}          msg request data - filters for tables
 * @param  {Function}        cb  callback
 */
dbRemote.prototype.getTablesForGames = function (msg, cb) {
  keyValidator.validateKeySets("Request", "database", "getTablesForGames", msg, function (validated) {
    if (validated.success) {
      async.waterfall([
        async.apply(listTable, msg),
        getTablesForNormalGamesWithCount,
        getEnrolledPlayersInTounaments,
        resetAvgPotandFlopPercentValues,
        removeExtraKeys,
        getPlayerFavouriteTables,
        processingFavouriteTables,
        // insideLobbyData
        getPasswordForUser
      ], function (err, result) {
        serverLog(stateOfX.serverLogType.info, "err and result is - " + JSON.stringify(err) + " and result - " + JSON.stringify(result));
        if (err) {
          cb(err);
        } else {
          cb({ success: true, result: result.allTables, tableData: result.insideData });
        }
      });

    } else {
      cb(validated);
    }
  });
};

// This function will get Quick Seat Tables For Normal Games
dbRemote.prototype.getQuickSeatTable = function (msg, cb) {
  keyValidator.validateKeySets("Request", "database", "getQuickSeatTable", msg, function (validated) {
    if (validated.success) {
      var query = {
        isRealMoney: msg.isRealMoney,
        channelVariation: msg.channelVariation,
        minBuyIn: { $lte: msg.minBuyIn },
        maxPlayers: msg.maxPlayers,
        channelType: msg.channelType
      };
      db.quickSeatTable(query, function (err, result) {
        if (err) {
          cb({ success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DB_ERROR_SOMETHING_WRONG_TABLE });
          //cb({success: false, info: "Something went wrong!! unable to get table!"});
        } else {
          cb({ success: true, result: result });
        }
      });
    } else {
      cb(validated);
    }
  });
};

// This function will get Quick Seat Rooms For SIT N GO Tournament
dbRemote.prototype.getQuickSeatSitNGo = function (msg, cb) {
  keyValidator.validateKeySets("Request", "database", "getQuickSeatSitNGo", msg, function (validated) {
    if (validated.success) {
      var query = {
        isRealMoney: msg.isRealMoney,
        channelVariation: msg.channelVariation,
        buyIn: { $lte: msg.buyIn },
        maxPlayersForTournament: { $lte: msg.maxPlayersForTournament },
        tournamentType: msg.tournamentType
      };
      db.quickSeatTournament(query, function (err, result) {
        if (err) {
          cb({ success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DB_ERROR_SOMETHING_WRONG_GETTING_TOURNAMENT });
          //cb({success: false, info: "Something went wrong!! unable to get tournament!"});
        } else {
          cb({ success: true, result: result });
        }
      });
    } else {
      cb(validated);
    }
  });
};

//supporting logic to add to favourate list
function addtoFav(playerId, channelId, favdata, cb) {
  db.addFavourateSeat(playerId, favdata, function (err, result) {
    serverLog(stateOfX.serverLogType.info, "result in addtoFav");
    serverLog(stateOfX.serverLogType.info, JSON.stringify(result));
    if (err) {
      serverLog(stateOfX.serverLogType.info, err);
      cb({ success: false, isRetry: false, isDisplay: false, channelId: channelId || " ", info: popupTextManager.dbQyeryInfo.DB_ERROR_SOMETHING_WRONG_GET_LIST });
      //cb({success: false, channelId: channelId, info: "Something went wrong!! unable to get list"});
    } else {
      cb({ success: true, isRetry: false, isDisplay: false, channelId: channelId || "", info: popupTextManager.falseMessages.SUCCESS_ADD_FAVOURATELIST });
      //cb({success: true, channelId: channelId, info: "Successfully added to favourate list"});
    }
  });
}

// This function will add favourate Seat to user profile For Normal Games (Not applicable for any kind of tournament, as in tournament no seat is fixed)
dbRemote.prototype.addFavourateSeat = function (msg, cb) {
  keyValidator.validateKeySets("Request", "database", "addFavourateSeat", msg, function (validated) {
    if (validated.success) {
      var favdata = msg.favourateSeat;
      favdata.createdAt = new Date().getTime();
      db.findUser({ 'playerId': msg.playerId }, function (err, result) {
        if (result.favourateSeat) {
          if (result.favourateSeat.length >= configConstants.favourateSeatCap) {
            cb({ success: true, channelId: (msg.channelId || ""), info: "You have exceeded the favourite list limit. Please delete some from list.", isRetry: false, isDisplay: false });
          } else {
            addtoFav(msg.playerId, favdata, function (finalResult) {
              cb(finalResult);
            });
          }
        } else {
          addtoFav(msg.playerId, favdata, function (finalResult) {
            cb(finalResult);
          });
        }
      });
    } else {
      cb(validated);
    }
  });
};

// This function will remove favourate Seat to user profile For Normal Games (Not applicable for any kind of tournament, as in tournament no seat is fixed)
dbRemote.prototype.removeFavourateSeat = function (msg, cb) {
  keyValidator.validateKeySets("Request", "database", "removeFavourateSeat", msg, function (validated) {
    if (validated.success) {
      db.removeFavourateSeat(msg.playerId, msg.channelId, function (err, result) {
        serverLog(stateOfX.serverLogType.info, "result in removeFavourateSeat");
        serverLog(stateOfX.serverLogType.info, JSON.stringify(result));
        if (err) {
          cb({ success: false, channelId: msg.channelId, info: "Something went wrong!! unable to get list", isRetry: false, isDisplay: false });
        } else {
          cb({ success: true, channelId: msg.channelId, info: "Successfully removed from list", isRetry: false, isDisplay: false });
        }
      });
    } else {
      cb(validated);
    }
  });
};


//supporting logic to add to favourate list for table
function addtoFavTable(playerId, channelId, favTableData, cb) {
  db.addFavourateTable(playerId, favTableData, function (err, result) {
    serverLog(stateOfX.serverLogType.info, "result in addtoFavTable" + JSON.stringify(result));
    if (err) {
      serverLog(stateOfX.serverLogType.info, err);
      cb({ success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DB_ERROR_SOMETHING_WRONG_GET_LIST });
      //cb({success: false, info: "Something went wrong!! unable to get list"});
    } else {
      cb({ success: true, isRetry: false, isDisplay: false, channelId: channelId || "", info: popupTextManager.falseMessages.SUCCESS_ADD_FAVOURATELIST });
      //cb({success: true, info: "Successfully added to favourate list"});
    }
  });
}

// This function will add favourate Seat to user profile For Normal Games (Not applicable for any kind of tournament, as in tournament no seat is fixed)
dbRemote.prototype.addFavourateTable = function (msg, cb) {
  keyValidator.validateKeySets("Request", "database", "addFavourateTable", msg, function (validated) {
    if (validated.success) {
      var favTableData = msg.favourateTable;
      favTableData.createdAt = new Date().getTime();
      db.findUser({ 'playerId': msg.playerId }, function (err, result) {
        if (result.favourateTable) {
          if (result.favourateTable.length >= configConstants.favourateTableCap) {
            cb({ success: false, isRetry: false, isDisplay: true, channelId: (msg.channelId || ""), info: popupTextManager.falseMessages.EXCEED_FAVOURATELIST_LIMITS });
            //cb({success: true, channelId: msg.channelId, info: "You have exceeded the favourate list limit. Please delete some from list"});
          } else {
            addtoFavTable(msg.playerId, msg.channelId, favTableData, function (finalResult) {
              cb(finalResult);
            });
          }
        } else {
          addtoFavTable(msg.playerId, msg.channelId, favTableData, function (finalResult) {
            cb(finalResult);
          });
        }
      });
    } else {
      cb(validated);
    }
  });
};


// This function will remove favourate Seat to user profile For Normal Games (Not applicable for any kind of tournament, as in tournament no seat is fixed)
dbRemote.prototype.removeFavourateTable = function (msg, cb) {
  keyValidator.validateKeySets("Request", "database", "removeFavourateTable", msg, function (validated) {
    if (validated.success) {
      db.removeFavourateTable(msg.playerId, msg.channelId, function (err, result) {
        serverLog(stateOfX.serverLogType.info, "result in removeFavourateTable");
        serverLog(stateOfX.serverLogType.info, JSON.stringify(result));
        if (err) {
          cb({ success: false, isRetry: false, isDisplay: false, channelId: (msg.channelId || ""), info: popupTextManager.dbQyeryInfo.DB_ERROR_SOMETHING_WRONG_GET_LIST });
          //cb({success: false, channelId: msg.channelId, info: "Something went wrong!! unable to get list"});
        } else {
          cb({ success: true, isRetry: false, isDisplay: false, channelId: (msg.channelId || ""), info: popupTextManager.falseMessages.SUCCESS_REMOVE });
          //cb({success: true, channelId: msg.channelId, info: "Successfully removed from list"});
        }
      });
    } else {
      cb(validated);
    }
  });
};

// This function will update Avg Stack for a table (Not applicable for tournament)
dbRemote.prototype.updateStackTable = function (msg, cb) {
  keyValidator.validateKeySets("Request", "database", "updateStackTable", msg, function (validated) {
    if (validated.success) {
      db.updateStackTable(msg.id, 1, msg.stack, function (err, result) {
        serverLog(stateOfX.serverLogType.info, "result in updateStackTable");
        serverLog(stateOfX.serverLogType.info, JSON.stringify(result));
        if (err) {
          cb({ success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DB_ERROR_SOMETHING_WRONG_UPDATE });
          //cb({success: false, info: "Something went wrong!! unable to update"});
        } else {
          cb({ success: true, info: "Successfully updated", isRetry: false, isDisplay: false, channelId: "" });
        }
      });
    } else {
      cb(validated);
    }
  });
};

// This function will update Avg Stack for a tournament room
dbRemote.prototype.updateStackTournamentRoom = function (msg, cb) {
  keyValidator.validateKeySets("Request", "database", "updateStackTournamentRoom", msg, function (validated) {
    if (validated.success) {
      db.updateStackTournamentRoom(msg.id, 1, msg.stack, function (err, result) {
        serverLog(stateOfX.serverLogType.info, "result in updateStackTournamentRoom");
        serverLog(stateOfX.serverLogType.info, JSON.stringify(result));
        if (err) {
          cb({ success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DB_ERROR_SOMETHING_WRONG_UPDATE });
          //cb({success: false, info: "Something went wrong!! unable to update"});
        } else {
          cb({ success: true, info: "Successfully updated", isRetry: false, isDisplay: false, channelId: "" });
        }
      });
    } else {
      cb(validated);
    }
  });
};

// tournament
var createTableStructureForTournament = function (result) {
  var tempObj = {
    'isActive': true,
    'channelType': 'TOURNAMENT',
    'isRealMoney': JSON.parse(result.isRealMoney),
    'channelName': result.channelName,
    'turnTime': result.turnTime,
    'isPotLimit': JSON.parse(result.isPotLimit),
    'maxPlayers': result.maxPlayers,
    'minPlayers': result.minPlayers,
    'smallBlind': result.smallBlind,
    'bigBlind': result.bigBlind,
    'isStraddleEnable': JSON.parse(result.isStraddleEnable),
    'runItTwiceEnable': JSON.parse(result.runItTwiceEnable),
    'minBuyIn': null,
    'maxBuyIn': null,
    'numberOfRebuyAllowed': null,
    'hourLimitForRebuy': null,
    'rebuyHourFactor': null,
    'gameInfo': result.gameInfo,
    'gameInterval': result.gameInterval,
    'blindMissed': result.blindMissed,
    'channelVariation': result.channelVariation,
    'rakeRule': null,
    'tournament': {
      'tournamentId': result._id,
      'avgFlopPercent': result.avgFlopPercent,
      'avgPot': result.avgPot,
      'blindRule': result.blindRule,
      'bountyfees': result.bountyfees,
      'channelType': result.channelType,
      'entryfees': result.entryfees,
      'extraTimeAllowed': result.extraTimeAllowed,
      'housefees': result.housefees,
      'isActive': result.isActive,
      'totalFlopPlayer': result.totalFlopPlayer,
      'totalGame': result.totalGame,
      'totalStack': result.totalStack,
      'totalPlayer': result.totalPlayer,
      'totalPot': result.totalPot,
      'tournamentBreakTime': result.tournamentBreakTime,
      'tournamentRules': result.tournamentRules,
      'tournamentRunningTime': result.tournamentRunningTime,
      'tournamentTime': result.tournamentTime,
      'tournamentType': result.tournamentType,
      'winTicketsForTournament': result.winTicketsForTournament,
      'prizeRule': result.prizeRule
    }
  };

  if (result.lateRegistrationAllowed)
    tempObj.tournament.lateRegistrationAllowed = result.lateRegistrationAllowed;

  if (result.lateRegistrationTime)
    tempObj.tournament.lateRegistrationTime = result.lateRegistrationTime;

  if (result.maxPlayersForTournament)
    tempObj.tournament.maxPlayersForTournament = result.maxPlayersForTournament;

  if (result.minPlayersForTournament)
    tempObj.tournament.minPlayersForTournament = result.minPlayersForTournament;

  return tempObj;
};



//This function will create tables/channels For Tournament
dbRemote.prototype.createTablesForTournament = function (msg, cb) {
  serverLog(stateOfX.serverLogType.info, "in createTablesForTournament ", JSON.stringify(msg));
  keyValidator.validateKeySets("Request", "database", "createTablesForTournament", msg, function (validated) {
    if (validated.success) {
      db.getTournamentRoom(msg.tournamentId, function (err, result) {
        if (err) {
          cb({ success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DB_ERROR_SOMETHING_WRONG_GETTING_TOURNAMENT });
          //cb({success: false, info: "Something went wrong!! unable to get tournament details!"});
        } else {
          if (result) {
            var totalChannellRequired = Math.ceil((result.maxPlayersForTournament) / (result.maxPlayers));
            var obj = [];
            for (var i = 1; i <= totalChannellRequired; i++) {
              var temp = createTableStructureForTournament(result);
              temp.channelName = (temp.channelName) + i;
              obj.push(temp);
            }

            db.createTournamentTables(obj, function (err, result) {
              if (err) {
                cb({ success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DB_ERROR_SOMETHING_WRONG_CREATE_TABLE_TOURNAMENT });
                //cb({success: false, info: "Something went wrong!! unable to create tables for tournament!"});
              } else {
                cb({ success: true, result: result });
              }
            });
          } else {
            cb({ success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DB_INVALID_TOURNAMENT });
            //cb({success: false, info: "Invalid Tournament"});
          }
        }
      });
    } else {
      cb(validated);
    }
  });
};

// ### Store issue in database
// @deprecated
dbRemote.prototype.reportIssue = function (params, cb) {
  keyValidator.validateKeySets("Request", "database", "reportIssue", params, function (validated) {
    if (validated.success) {
      db.reportIssue(params, function (err, result) {
        if (err) {
          cb({ success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DB_ERROR_REPORT_ISSUE_FAIL });
          //cb({success: false, info: "Report issue failed !"});
        } else {
          cb({ success: true, result: result });
        }
      });
    } else {
      cb(validated);
    }
  });
};

// ### Get issue from database
// @deprecated
dbRemote.prototype.getIssue = function (params, cb) {
  keyValidator.validateKeySets("Request", "database", "getIssue", params, function (validated) {
    if (validated.success) {
      db.getIssue(params, function (err, result) {
        if (err) {
          cb({ success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DB_ERROR_GET_ISSUE_FAIL });
          //cb({success: false, info: "Get issue failed!"});
        } else {
          cb({ success: true, result: result });
        }
      });
    } else {
      cb(validated);
    }
  });
};


//find user session in db
dbRemote.prototype.findUserSessionInDB = function (params, cb) {
  console.log(")))))))))))))))))))))(((((((((((((", params);
  db.findUserSessionInDB(params, function (err, result) {
    if (err) {
      cb({ success: false, info: "Get issue failed!" });
    } else {
      cb({ success: true, result: result });
    }
  });
  // cb("done");
};

// insert user session in db
dbRemote.prototype.insertUserSessionInDB = function (params, cb) {
  console.log(")))))))))))))))))))))insert(((((((((((((", params);
  db.insertUserSessionInDB(params, function (err, result) {
    if (err) {
      cb({ success: false, info: "Get issue failed!" });
    } else {
      cb({ success: true, result: result });
    }
  });
};


var checkUserLogin = function (params, cb) {
  console.log("inside this", params);
  var startDate = Number(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 0, 0, 0, 0));
  var endDate = startDate + 1 * 24 * 60 * 60 * 1000;
  if (params.lastLogin < startDate) {
    params.increment = true;
    params.startDate = startDate;
    params.endDate = endDate;
    cb(null, params);
  } else {
    cb({ success: false, info: "Don't update login count" });
  }

};


var incrementLoginCount = function (params, cb) {
  console.log("inside increment count");
  var query = { startDate: params.startDate, endDate: params.endDate };
  var update = { $inc: { playerCount: 1 } };
  logDB.insertPlayerLoginData(query, update, function (err, result) {
    if (err) {
      console.error("--", err);
      cb({ success: false, info: err.info });
    } else {
      cb({ success: true, res: "Inserted successfully" });
    }
  });
};


var playerLoginCount = function (user) {
  console.log("in playerLoginCount--", user);
  var data = {
    playerId: user.playerId,
    lastLogin: user.lastLogin
  };
  async.waterfall([
    async.apply(checkUserLogin, data),
    incrementLoginCount
  ], function (err, res) {
    if (err) {
      console.log("inside error after playerlogincount inssertion\n", err.info);
    } else {
      console.log("Successfully inserted player count");
    }
  });
};