/*jshint node: true */
"use strict";

/**
 * Created by Sushil on 25/07/2016.
 * This file is for tournament related opertions
 * Like tournament Registration, Tournament deregistration
 * deduct chips and add chips in tournament
**/
var async               = require("async"),
    _                   = require('underscore'),
    ObjectID            = require('mongodb').ObjectID,
    stateOfX            = require("../../../../shared/stateOfX"),
    keyValidator        = require("../../../../shared/keysDictionary"),
    db                  = require('../../../../shared/model/dbQuery.js'),
    imdb                = require("../../../../shared/model/inMemoryDbQuery.js"),
    profileMgmt         = require('../../../../shared/model/profileMgmt.js'),
    zmqPublish          = require("../../../../shared/infoPublisher"),
    popupTextManager    = require("../../../../shared/popupTextManager"),
    tournamentReg       = require('./tournamentRegistration.js'),
    satelliteTournament = require('./satelliteTournament.js'),
    channelDetails      = require('./calculateChannelDetails.js');

var pomelo = require('pomelo');

/**
 * Function to create data for log generation
 * @method serverLog
 * @param  {[type]}   type request json object
 * @param  {[type]}   log request json object
 */
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'tournament';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

var tournament = function(app) {
    // this.app = app;
    // this.channelService = app.get('channelService');
};


/**
 * Function for getting tournament room
 * @method getTournamentRoom
 * @param  {[type]}   params request json object
 * @param  {Function} cb     callback function
 */
var getTournamentRoom = function(params,cb) {
  db.getTournamentRoom(params.tournamentId, function(err, tournament) {
    if(err || !tournament) {
      cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.falseMessages.GETTOURNAMENTROOMCALLBACK_NOTOURNAMENTROOM_TOURNAMENT});
      //cb({success: false, info: "No tournament room found"});
    } else {
      params.tournamentState = tournament.state;
      params.gameVersionCount = tournament.gameVersionCount;
      params.isRebuyAllowed = !!tournament && tournament.isRebuyAllowed ? true : false;
      if(params.isRebuyAllowed) {
        params.rebuyTime = tournament.rebuyTime;
        params.numberOfRebuy = tournament.numberOfRebuy;
        params.tournamentStartTime = tournament.tournamentStartTime;
      }
      cb(null, params);
    }
  });
};
/**
 * Function to insertBounty (to create Bounty data and insert into the database)
 * @method insertBounty
 * @param  {[type]}   tournamentId         
 * @param  {[type]}   gameVersionCount     
 * @param   {[type]}   playerId            
 */
var insertBounty = function(tournamentId, gameVersionCount, playerId) {
  var bountyData = {
    tournamentId : tournamentId,
    gameVersionCount : gameVersionCount,
    playerId : playerId,
    bounty : 0
  };
  db.createBounty(bountyData, function(err, result) {
    if(err) {
      serverLog(stateOfX.serverLogType.info,"Error in creating bounty")
    } else {
      serverLog(stateOfX.serverLogType.info,"successfully inserted bounty");
    }
  });
};
/**
 * Function for register user for tournament on the basis of sitNGo or on the basis of normalTournament Registration
 * @method getTournamentRoomCallBack
 * @param  {[type]}   params request json object
 * @param  {[type]}   params request json object
 * @param  {[type]}   tournamentRoom request json object
 * @param  {Function} cb     callback function
 * @return {[type]}          validated/params
 */
var getTournamentRoomCallBack = function (err, params, tournamentRoom, cb) {
    if (err || !tournamentRoom) {
        serverLog(stateOfX.serverLogType.info,"Error in getting tournament room in registerTournament");
        // cb({
        //     success: false,
        //     info: "Error in getting tournament room in registerTournament"
        // });
        cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.GETTOURNAMENTROOMCALLBACK_NOTOURNAMENTROOM_TOURNAMENT});
    }
    serverLog(stateOfX.serverLogType.info,"tournament room is in registerTournament is "+ JSON.stringify(tournamentRoom));
    if (!!tournamentRoom || tournamentRoom.isActive) {
        params.tournamentStartTime     = tournamentRoom.tournamentStartTime;
        params.lateRegistrationTime    = tournamentRoom.lateRegistrationTime;
        params.lateRegistrationAllowed = tournamentRoom.lateRegistrationAllowed;
        params.entryFees               = tournamentRoom.entryfees + tournamentRoom.housefees + tournamentRoom.bountyfees;
        params.maxPlayersForTournament = tournamentRoom.maxPlayersForTournament;
        params.isRealMoney             = tournamentRoom.isRealMoney;
        params.tournamentType          = tournamentRoom.tournamentType;
        params.gameVersionCount        = tournamentRoom.gameVersionCount;
        if ((tournamentRoom.tournamentType).toUpperCase() === stateOfX.tournamentType.sitNGo) {
            serverLog(stateOfX.serverLogType.info,"this is sit n go tournament",JSON.stringify(params));
            params.tournamentState = tournamentRoom.state;
            tournamentReg.sitNGoRegistration(params, function(sitNgoResponse) {
              serverLog(stateOfX.serverLogType.info,"sitNgoResponse ---",sitNgoResponse);
              if(sitNgoResponse.success && tournamentRoom.bountyfees > 0) {
                  insertBounty(tournamentRoom._id.toString(), tournamentRoom.gameVersionCount,params.playerId);
              }
              sitNgoResponse.tournamentType = tournamentRoom.tournamentType;
                cb(sitNgoResponse);
            });
        } else {
            serverLog(stateOfX.serverLogType.info,"this is not sit n go tournament" + JSON.stringify(params));
            params.registrationBeforeStarttime = tournamentRoom.registrationBeforeStarttime;
            tournamentReg.normalTournamentReg(params, function(normalTournamentRegResponse) {
              if(normalTournamentRegResponse.success && tournamentRoom.bountyfees > 0) {
                  insertBounty(tournamentRoom._id.toString(), tournamentRoom.gameVersionCount,params.playerId);
              }
              cb(normalTournamentRegResponse);
            });
        }
    } else {
        serverLog(stateOfX.serverLogType.info,"no rooms found for this tournament or inActive tournament");
        // cb({
        //     success: false,
        //     info: "no rooms found for this tournament or inActive tournament"
        // });
        cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.falseMessages.GETTOURNAMENTROOMCALLBACK_TOURNAMENT});
    }
};


/**
 * Function for register user for tournament
 * @method registerTournament
 * @param  {[type]}   params request json object
 * @param  {Function} cb     callback function
 * @return {[type]}          validated/params
 */
tournament.prototype.registerTournament = function(params, cb) {
  var self = this;
  serverLog(stateOfX.serverLogType.info,"params of register tournament ",params);
  keyValidator.validateKeySets("Request", pomelo.app.serverType, "registerTournament", params, function (validated){
    if(validated.success) {
    	// getting tournament room
    	db.getTournamentRoom(params.tournamentId,function(err, tournamentRoom){
        serverLog(stateOfX.serverLogType.info,"tournamentRoom is in registerTournament is - ",JSON.stringify(tournamentRoom));
        if(err || !tournamentRoom) {
          cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.falseMessages.REGISTERTOURNAMENTFAIL_TOURNAMENT});
          //cb({success: false, info: "turnament configuration not found"});
        } else {
          getTournamentRoomCallBack(err, params, tournamentRoom, cb);
        }
    	});
    } else {
    	cb(validated);
    }
  });
};
/**
 * Function to getTournamentUsers
 * @method getTournamentUsers
 * @param  {[type]}   params request json object
 * @param  {Function} cb     callback function
 * @return {[type]}          validated/params
 */
var getTournamentUsers = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in getTournamentUsers in tournament.js' + JSON.stringify(params));
  db.findTournamentUser({tournamentId: params.tournamentId, playerId: params.playerId,gameVersionCount: params.gameVersionCount},function(err, result) {
    if(err) {
      serverLog(stateOfX.serverLogType.info, 'Error in getting tournamentUser');
      cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.falseMessages.FINDTOURNAMENTUSERFAIL_TOURNAMENT});
      //cb({success: false, info: "Error in getting tournamentUser", isDisplay: false, isRetry: false});
    } else {
      if(!!result  && result.length>0) {
        serverLog(stateOfX.serverLogType.info, 'user already registered in this tournament in isRegisteredUserInTournament'+ JSON.stringify(result));
        if(result[0].isActive) {
          params.isEliminated = false;
        }
        params.isRegistered = true;
        cb(null, params);
      } else {
        serverLog(stateOfX.serverLogType.info, 'user not registerd for tournament' + result);
        cb(null, params);
      }
    }
  });
};
/**
 * Function to getRebuyStatus  (checks if rebuyTime is left or not)
 * @method getRebuyStatus
 * @param  {[type]}   params request json object
 * @param  {Function} cb     callback function
 * @return {[type]}          validated/params
 */
var getRebuyStatus = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in getRebuyStatus in tournament.js'+ JSON.stringify(params));
  if(params.isRebuyAllowed && params.isRegistered) {
    db.countRebuyOpt({playerId: params.playerId, tournamentId: params.tournamentId, gameVersionCount: params.gameVersionCount}, function(err, result) {
      if(!err) {
        if(!!result) {
          var isRebuyTimeLeft = (params.tournamentStartTime + params.rebuyTime*60000) > Number(new Date());
          serverLog(stateOfX.serverLogType.info, 'isRebuyTimeLeft - ' + isRebuyTimeLeft);
          if(isRebuyTimeLeft && result.rebuyCount < params.numberOfRebuy) {
            params.isRebuyLeft = true;
          }
          cb(null, params);
        } else {
          params.isRebuyLeft = true;
          cb(null, params);
        }
      } else {
        cb({success: false, info: "Error in getting rebuy status", isDisplay: false, isRetry: false,channelId: ""});
      }
    });
  } else {
    cb(null, params);
  }
};
/**
 * Function to createResponseInRegisteredUsers
 * @method createResponseInRegisteredUsers
 * @param  {[type]}   params request json object
 * @param  {Function} cb     callback function
 * @return {[type]}          validated/params
 */
var createResponseInRegisteredUsers = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in createResponse in tournament.js'+ JSON.stringify(params));
  var response = {
    success: true,
    result : {
      isRegistered : params.isRegistered,
      isEliminated : params.isEliminated,
      isRebuyLeft  : params.isRebuyLeft,
      tournamentState : params.tournamentState
    }
  };
  serverLog(stateOfX.serverLogType.info, 'response is in createResponse - ' + JSON.stringify(response));
  cb(null, response);
};


/**
 * Function to check user is registered in particluar tournament or not
 * @method isRegisteredUserInTournament
 * @param  {[type]}   params request json object
 * @param  {Function} cb     callback function
 * @return {[type]}          validated/params
 */
tournament.prototype.isRegisteredUserInTournament = function(params, cb) {
	var self = this;
  serverLog(stateOfX.serverLogType.info,"params is in isRegisteredUserInTournament is in tournament is - ", JSON.stringify(params));
	serverLog(stateOfX.serverLogType.info,"in isRegisteredUserInTournament in tournament.js");
	keyValidator.validateKeySets("Request", pomelo.app.serverType, "isRegisteredUserInTournament", params, function (validated){
    if(validated.success) {
      params.isEliminated = true;
      params.isRegistered = false;
      params.isRebuyLeft = false;
      async.waterfall([
        async.apply(getTournamentRoom, params),
        getTournamentUsers,
        getRebuyStatus,
        createResponseInRegisteredUsers
      ], function(err, result) {
        if(err) {
          serverLog(stateOfX.serverLogType.info,'in err');
          cb(err);
        } else {
          serverLog(stateOfX.serverLogType.info,'in success');
          cb(result);
        }
      });
    } else {
    	cb(validated);
    }
  });
};
/**
 * Function to validateAndDeRegisterTournament
 * @method validateAndDeRegisterTournament
 * @param  {[type]}   params request json object
 * @param  {Function} cb     callback function
 * @return {[type]}          validated/params
 */
var validateAndDeRegisterTournament = function(params, cb) {
	var validTimeForRegistration = params.tournamentStartTime;
	var currentTime = Number(new Date());
	if(params.lateRegistrationAllowed) {
		validTimeForRegistration += params.lateRegistrationTime;
	}
  var conditonForSitNGoTournament = (params.tournamentType).toUpperCase() === stateOfX.tournamentType.sitNGo && (params.tournamentState).toUpperCase() === stateOfX.tournamentState.register;
	var conditonForNormalTournament = (params.tournamentType).toUpperCase() === stateOfX.tournamentType.normal && currentTime < validTimeForRegistration;
  serverLog(stateOfX.serverLogType.info,conditonForNormalTournament,conditonForSitNGoTournament);
  if(conditonForSitNGoTournament || conditonForNormalTournament) {
		tournamentReg.deRegisteration(params, function(deRegisterationResponse) {
			cb(deRegisterationResponse);
		});
	} else {
    cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.falseMessages.VALIDATEANDREGISTERTOURNAMENTFAIL_TOURNAMENT});
		//cb({success: false, info: "deRegistration time is over"});
	}
};
/**
 * Function to createParamsForDegisterTournament
 * @method createParamsForDeregisterTournament
 * @param  {[type]}   params request json object
 * @param  {Function} cb     callback function
 * @return {[type]}          validated/params
 */
var createParamsForDeregisterTournament = function(tournamentRoom,params) {
  serverLog(stateOfX.serverLogType.info,"tournamentRoom is - ",JSON.stringify(tournamentRoom));
	params.tournamentType = tournamentRoom.tournamentType;
	params.tournamentState = tournamentRoom.state;
	params.tournamentStartTime = tournamentRoom.tournamentStartTime;
	params.lateRegistrationAllowed = tournamentRoom.lateRegistrationAllowed;
	params.lateRegistrationTime = tournamentRoom.lateRegistrationTime;
	params.isRealMoney = tournamentRoom.isRealMoney;
	params.entryFees = tournamentRoom.entryfees + tournamentRoom.housefees + tournamentRoom.bountyfees;
  params.gameVersionCount = tournamentRoom.gameVersionCount;
	return params;
};


/**
 * Function for deRegister user from tournament two things are mainly checked here i.e. if the player is registered and the deregistration time is valid or not
 * @method deRegisterTournament
 * @param  {[type]}   params request json object
 * @param  {Function} cb     callback function
 * @return {[type]}          validated/params
 */
tournament.prototype.deRegisterTournament = function(params, cb) {
	var self = this;
  serverLog(stateOfX.serverLogType.info,"params of deregister tournament "+JSON.stringify(params));
  keyValidator.validateKeySets("Request", pomelo.app.serverType, "deRegisterTournament", params, function (validated){
    if(validated.success) {
    	//find user
    	self.isRegisteredUserInTournament({isActive: true,tournamentId: params.tournamentId, playerId: params.playerId, gameVersionCount: params.gameVersionCount}, function(isRegisteredUserInTournamentResponse) {
    		console.log("isRegisteredUserInTournamentResponse in deRegister - " + JSON.stringify(isRegisteredUserInTournamentResponse));
        if(isRegisteredUserInTournamentResponse.success && isRegisteredUserInTournamentResponse.result.isRegistered) {
    			db.getTournamentRoom(params.tournamentId,function(err, tournamentRoom){
		    		if(err || !tournamentRoom) {
		    			serverLog(stateOfX.serverLogType.info,"Error in getting tournament room in deregisterTournament");
		    			// cb({success: false, info: "Error in getting tournament room in deregisterTournament"});
              cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBGETTOURNAMENTROOM_DEREGISTERTOURNAMENTDBERROR_TOURNAMENT});
		    		} else {
		    			validateAndDeRegisterTournament(createParamsForDeregisterTournament(tournamentRoom,params), function(response) {
		    				cb(response);
		    			});
		    		}
		    	});
    		} else {
    			// cb({success: false, info: "player not joined this tournament"});
          cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBGETTOURNAMENTROOM_DEREGISTERTOURNAMENT_TOURNAMENT});
    		}
    	});
    } else {
    	cb(validated);
    }
  });
};



/**
 * Change the state of tournament
 * @method changeStateOfTournament
 * @param  {[type]}   params request json object
 * @param  {Function} cb     callback function
 * @return {[type]}          validated/params
 */
tournament.prototype.changeStateOfTournament = function(params, cb) {
	var self = this;
	serverLog(stateOfX.serverLogType.info,"in changeStateOfTournament in tournament.js" + JSON.stringify(params));
	keyValidator.validateKeySets("Request", pomelo.app.serverType, "changeStateOfTournament", params, function (validated){
    if(validated.success) {
    	serverLog(stateOfX.serverLogType.info,"params.tournamentId, params.state is in changeStateOfTournament in tournament.js",params.tournamentId, params.state);
    	db.updateTournamentStateAndTime(params.tournamentId.toString(), params.state, function(err,result) {
    		if(err) {
    			serverLog(stateOfX.serverLogType.info,"error occured in update tournament state", err);
    			cb({success: false});
    		} else {
    			serverLog(stateOfX.serverLogType.info,"updated tournament state successfully",JSON.stringify(result));
    			cb({success: true});
    		}
    	});
    } else {
      serverLog(stateOfX.serverLogType.info,"tournament change starte failed");
    	cb(validated);
   	}
  });
};



/**
 * Get TournamentUser and ranks dynamically
 * @method getRegisteredTournamentUsers
 * @param  {[type]}   params request json object
 * @param  {Function} cb     callback function
 * @return {[type]}          validated/params
 */
tournament.prototype.getRegisteredTournamentUsers = function(params, cb) {
	var self = this;
	serverLog(stateOfX.serverLogType.info,"in getTournamentUsers in tournament.js", JSON.stringify(params));
	keyValidator.validateKeySets("Request", pomelo.app.serverType, "getTournamentUsers", params, function (validated){
    if(validated.success) {
      db.getTournamentRoom(params.tournamentId, function(err, tournament) {
        serverLog(stateOfX.serverLogType.info,"tournament is in getRegisteredTournamentUsers is - " + JSON.stringify(tournament));
        if(err || !tournament) {
          // cb({success: false, info: "No tournament room found"});
          cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBGETTOURNAMENTROOMFAIL_TOURNAMENT});
        } else {
          if(tournament.state === stateOfX.tournamentState.finished) {
            params.gameVersionCount = tournament.gameVersionCount - 1;
          }
        	imdb.getRanks(params, function(err, userRanks) {
            if(err) {
              // cb({success: false, info: "tournament users info not available at this moment"});
              cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBGETRANKSFAIL_TOURNAMENT});
            }
            if(!!userRanks) {
              serverLog(stateOfX.serverLogType.info,"ranks are - " + JSON.stringify(userRanks));
              userRanks.ranks = _.sortBy(userRanks.ranks,"rank");
              serverLog(stateOfX.serverLogType.info,"ranks are after sorting - " + JSON.stringify(userRanks));
              serverLog(stateOfX.serverLogType.info,"ranks is in getRegisteredTournamentUsers ",JSON.stringify(userRanks));
              cb({success: true, result:userRanks});
            } else {
              cb({success: true, result: {}});
            }
          });
        }
      });
    } else {
    	cb(validated);
    }
  });
};

// Get every table structure at run time
tournament.prototype.getChannelStructure = function(params, cb) {
  channelDetails.getChannelDetails(params, function(channelDetailsResponse) {
    serverLog(stateOfX.serverLogType.info,"channelDetails response is ",JSON.stringify(channelDetailsResponse));
    cb(channelDetailsResponse);
  });
};

// Get blind structure
tournament.prototype.getBlindAndPrize = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,"params is in getBlindAndPrize in tournament.js is - ", JSON.stringify(params));
  var response = {};
  db.listBlindRule({_id: ObjectID(params.blindRule)}, function(err, blindRule) {
    if(err || !blindRule) {
      serverLog(stateOfX.serverLogType.info,"Error in getting blind from db");
      cb({success: false, info: "Error in getting blind structure from db", isRetry: false, isDisplay: false, channelId: ""});
    } else {
      serverLog(stateOfX.serverLogType.info,"blind rule is in getBlindAndPrize is in tournament.js is - ",JSON.stringify(blindRule));
      response.blindRule = blindRule;
      db.listPrizeRule({_id: ObjectID(params.prizeRule)}, function(err, prizeRule) {
        if(err || !prizeRule) {
          serverLog(stateOfX.serverLogType.info,"Error in getting prize from db");
          cb({success: false, info: "Error in getting prize structure from db", isRetry: false, isDisplay: false, channelId: ""});
        } else {
          serverLog(stateOfX.serverLogType.info,"prize rule is in getBlindAndPrize is in tournament.js is - ",JSON.stringify(prizeRule));
          response.prizeRule = prizeRule;
          cb({success: true, result:response});
        }
      });
    }
  });
};

/**
 * gets blind id for blind rule on current tournament
 * @method getBlindId
 * @param  {[type]}   params request json object
 * @param  {Function} cb     callback function
 * @return {[type]}          validated/params
 */
var getBlindId = function(params,cb){
  serverLog(stateOfX.serverLogType.info,"params is in getBlindId - " + JSON.stringify(params));
  db.getTournamentRoom(params.tournamentId,function(err,response){
    if(err){
      cb({success: false, info:"Error in getting blindId", isRetry: false, isDisplay: false, channelId: ""});
    } else{
      serverLog(stateOfX.serverLogType.info,"response in getBlindId" + JSON.stringify(response));
      if(!!response) {
        params.blindId = response.blindRule;
        params.breakRuleId = response.breakRuleId;
        params.timeBankRuleId = response.timeBankRule;
        params.addonRule = response.addonRule;
        cb(null,params);
      } else {
        // cb({success: false, info:"tournament not found", isDisplay: false});
        cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBTOURNAMENTROOMFAIL_TOURNAMENT});
      }
    }
  });
};

/**
 * gets blind rule on current tournament
 * @method getBlindRule
 * @param  {[type]}   params request json object
 * @param  {Function} cb     callback function
 * @return {[type]}          validated/params
 */
var getBlindRule = function(params,cb){
  serverLog(stateOfX.serverLogType.info,"params is in getBlindRule - " + JSON.stringify(params));
  db.findBlindRule(params.blindId,function(err,response){
    if(err){
      // cb({success: false, info:"Error in getting blindRule"});
      cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBFINDBLINDRULE_GETBLINDRULEDBERROR_TOURNAMENT});
    } else{
      serverLog(stateOfX.serverLogType.info,"blindRule ",response);
      params.blindRule = response;
      cb(null,params);
    }
  });
};


/**
 * gets timeBank rule on current tournament
 * @method getBlindRule
 * @param  {[type]}   params request json object
 * @param  {Function} cb     callback function
 * @return {[type]}          validated/params
 */
var getTimeBankRule = function(params,cb){
  serverLog(stateOfX.serverLogType.info,"params is in getTimeBankRule - " + JSON.stringify(params));
  db.findTimeBankRule(params.timeBankRuleId,function(err,response){
    if(err){
      cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBFINDTIMEBANKRULE_GETTIMEBANKRULEDBERROR_TOURNAMENT});
    } else{
      serverLog(stateOfX.serverLogType.info,"timeBankRule ",response);
      params.timeBankRule = response;
      cb(null,params);
    }
  });
};

/**
 * gets getBreakRule rule on current tournament
 * @method getBlindRule
 * @param  {[type]}   params request json object
 * @param  {Function} cb     callback function
 * @return {[type]}          validated/params
 */
var getBreakRule = function(params,cb){
  serverLog(stateOfX.serverLogType.info,"params is in getBreakRule - " + JSON.stringify(params));
  db.findBreakRule(params.breakRuleId,function(err,response){
    if(err){
      cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBFINDBREAKRULE_GETBREAKRULEDBERROR_TOURNAMENT});
    } else{
      serverLog(stateOfX.serverLogType.info,"breakRule ",response);
      params.breakRule = response;
      cb(null,params);
    }
  });
};



var findTournamentRoom = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,"params is in findTournamentRoom - " + JSON.stringify(params));
  db.getTournamentRoom(params.tournamentId, function(err, tournament) {
    if(!err) {
      params.isLateRegistrationOpened = tournament.isLateRegistrationOpened;
      params.isRebuyOpened = tournament.isRebuyOpened;
      params.state = tournament.state;
      cb(null, params);
    } else {
      // cb({success: false, isDisplay: false, info: "Error in getting rooms"})
      cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBGETTOURNAMENTROOM_FINDTOURNAMENTROOM_TOURNAMENT});
    }
  });
};


var getPrizeStructure = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,"params is in getPrizeStructure - " + JSON.stringify(params));
  var noOfPlayers = params.noOfPlayers.toString();
  serverLog(stateOfX.serverLogType.info,"noOfPlayers" + noOfPlayers);
  params.isPrizeDecided = false;
  var query = {};
  query.tournamentId = params.tournamentId;
  if(!params.isLateRegistrationOpened && !params.isRebuyOpened && (params.state === stateOfX.tournamentState.running || params.state === stateOfX.tournamentState.finished)) {
    params.isPrizeDecided = true;
    query.type = "server";
  }
  serverLog(stateOfX.serverLogType.info,"queryFor prize rule - " + JSON.stringify(query));
  db.listPrizeRule(query,function(err,response){
    if(err){
      //  cb({success: false, info:"Error in getting getPrizeStructure"});
      cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBLISTPRIZERULE_GETPRIZESTRUCTUREDBERROR_TOURNAMENT});
    } else{
      serverLog(stateOfX.serverLogType.info,"response in getPrizeStructure" + JSON.stringify(response[0].prize));
      params.prizeRule = response[0].prize;
      // serverLog(stateOfX.serverLogType.info,response[0]);
      // params.prizeRule= response[0];
      cb(null,params);
    }
  });
};

/**
 * creates the response for the client
 * @method createResponse
 * @param  {[params]}   params request json object
 * @param  {Function} cb     callback function
 */
var createResponse = function(params,cb){
  cb(null,{
    success: true,
    result: {
      blindRule:params.blindRule,
      prizeRule: params.prizeRule,
      timeBankRule: params.timeBankRule,
      breakRule: params.breakRule,
      addonRule: params.addonRule,
      isPrizeDecided: params.isPrizeDecided
    }
  });
};

/**
 * getBlindAndPrizeForNormalTournament contains a series of async functions that have been defined above
 * @method getBlindAndPrizeForNormalTournament
 * @param  {[params]}   params request json object
 * @param  {Function} cb     callback function
 */
tournament.prototype.getBlindAndPrizeForNormalTournament = function(params,cb){
  serverLog(stateOfX.serverLogType.info,"params is in getBlindAndPrizeForNormalTournament - " + JSON.stringify(params));
  var noOfPlayers = params.noOfPlayers.toString();
  async.waterfall([
    async.apply(getBlindId,params),
    getBlindRule,
    getTimeBankRule,
    getBreakRule,
    findTournamentRoom,
    getPrizeStructure,
    createResponse
  ],function(err,response){
    if(err){
      cb(err);
    } else{
      cb(response);
    }
  });
};

// {tournamentId,gameVersionCount}
var getEnrolledPlayersInTournament = function(params, cb) {
  db.countTournamentusers({tournamentId: params.tournamentId, gameVersionCount: params.gameVersionCount}, function(err, count) {
    if(!err) {
      serverLog(stateOfX.serverLogType.info,'enrolled players are - ' + count);
      cb({success:true, count: count});
    } else {
      cb({success:false});
    }
  });
};

var getEnrollPlayersChildTournament = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,'params is in getEnrollPlayersChildTournament -  ' + JSON.stringify(params));
  getEnrolledPlayersInTournament({tournamentId: params.tournamentId, gameVersionCount: params.gameVersionCount}, function(enrolledPlayerResponse) {
    if(enrolledPlayerResponse.success) {
      params.enrolledPlayers = enrolledPlayerResponse.count;
      cb(null, params);
    } else {
      cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.falseMessages.GETENROLLEDPLAYERSCHILDTOURNAMENTFAIL_TOURNAMENT});
      //cb({success: false, info: "Error in getting enrolled players of child", isDisplay: false});
    }
  });
};

var getParentTournament = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,'params is in getParentTournament - ' + JSON.stringify(params));
  db.getTournamentRoom(params.tournamentId, function(err, result) {
    if(!err) {
      if(!!result) {
        serverLog(stateOfX.serverLogType.info,'current tournament is - ' + JSON.stringify(result));
        params.tournament = result;
        db.getTournamentRoom(result.parentOfSatelliteId, function(err, parentTournament) {
          if(!err) {
            if(!!parentTournament) {
              params.parentTournament = parentTournament;
              cb(null, params);
            } else {
              //cb({success: false, info: "parent tournament not found", isDisplay: false})
              cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBGETTOURNAMENTROOM_GETPARENTTOURNAMENT_NOPARENTTOURNAMENT_TOURNAMENT});
            }
          } else {
            cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBGETTOURNAMENTROOM_GETPARENTTOURNAMENT_DBERROR_TOURNAMENT});
            //cb({success: false, info: "getting parent tournament db error", isDisplay: false})
          }
        });
      } else {
        //cb({success: false, info: "tournament not found", isDisplay: false})
        cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBGETTOURNAMENTROOM_GETPARENTTOURNAMENT_NOTOURNAMENT_TOURNAMENT});
      }
    } else {
      cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBGETTOURNAMENTROOM_GETPARENTTOURNAMENT_CANTGETTOURNAMENT_TOURNAMENT});
      //cb({success: false, info: "getting tournament db error", isDisplay: false})
    }
  });
};

var getEnrollPlayersParentTournament = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,'params is in getEnrollPlayersParentTournament -  ' + JSON.stringify(params));
  getEnrolledPlayersInTournament({tournamentId: params.parentTournament._id.toString(), gameVersionCount: params.parentTournament.gameVersionCount}, function(enrolledPlayerResponse) {
    if(enrolledPlayerResponse.success) {
      params.parentTournament.enrolledPlayer = enrolledPlayerResponse.count;
      cb(null, params);
    } else {
      cb({success: false, info: "Error in getting enrolled players of child", isDisplay: false,isRetry: false,channelId: ""});
    }
  });
};

var createResponseForSatellite = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,'params is in createResponseForSatellite - ' + JSON.stringify(params));
  var response = {
    blindRule: params.blindRule,
    addonRule: params.addonRule,
    timeBankRule: params.timeBankRule,
    breakRule: params.breakRule,
    usersPerPrize: Math.round(params.parentTournament.buyIn/params.tournament.buyIn),
    parentTournament: params.parentTournament,
    enrolledPlayers : params.enrolledPlayers,
  };
  serverLog(stateOfX.serverLogType.info,'response is in createResponseForSatellite - ' + JSON.stringify(response));
  cb(null, {success: true, result: response});
};

tournament.prototype.getBlindAndPrizeForSatelliteTournament = function(params,cb){
  serverLog(stateOfX.serverLogType.info,"params is in getBlindAndPrizeForSatelliteTournament - " + JSON.stringify(params));
  async.waterfall([
    async.apply(getBlindId,params),
    getEnrollPlayersChildTournament,
    getBlindRule,
    getTimeBankRule,
    getBreakRule,
    getParentTournament,
    getEnrollPlayersParentTournament,
    createResponseForSatellite
  ],function(err,response){
    if(err){
      cb(err);
    } else{
      cb(response);
    }
  });
};

/**
 * this function is to  getPlayerPrize which is called on login to get those players whose chipsWon is more than 0 and who have not clicked on Ok i.e. their isCollected is false 
 * @method getPlayerPrize
 * @param  {Object} params  request json object 
 * @param  {cb}     cb      callback function  
 */
tournament.prototype.getPlayerPrize = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,"params is in getPlayerPrize is in tournament.js - ",JSON.stringify(params));
  var filter = {
    playerId          : params.playerId,
    isCollected       : false,
    chipsWon          : { $gt: 0 }
  };
  db.getTournamentRanks(filter, function(err, prize) {
    serverLog(stateOfX.serverLogType.info,"get player prizes are - " + JSON.stringify(prize));
    if(err || !prize) {
      serverLog(stateOfX.serverLogType.info,"Error in getting prize in tournament.js");
      cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBGETTOURNAMENTRANKS_GETPLAYERPRIZE_TOURNAMENT});
      //cb({success:false, info: "Error in getting prize"});
    } else {
      cb({success: true, result: prize});
    }
  });
};

/**
 * this function is for updating the value of isCollected key if a players has seen his rank,prize and clicked Ok
 * @method process
 * @param  {Object} params  request json object 
 * @param  {cb}     cb      callback function  
 */
tournament.prototype.collectPrize = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,"params is in collectPrize is in tournament.js- ",JSON.stringify(params));
  var filter = {
    playerId          : params.playerId,
    gameVersionCount  : params.gameVersionCount,
    tournamentId      : params.tournamentId,
    isCollected       : false
  };
  db.updateTournamentRanks(filter, function(err, prize) {
    // serverLog(stateOfX.serverLogType.info,"prize is in collectPrize is in tournament.js is - ",prize);
    if(err || !prize) {
      serverLog(stateOfX.serverLogType.info,"Error in updating prize in tournament.js");
      //cb({success:false, info: "Error in updating prize"});
      cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBUPDATETOURNAMENTRANKS_COLLECTPRIZE_TOURNAMENT});
    } else {
      cb({success: true, result: "prize updated successfully"});
    }
  });
};



/**
 * this function is for registration in satellite tournaments
 * @method registrationInSatelliteTournament 
 * @param  {Object} params  request json object - {tournamentId,playerId}
 * @param  {cb}     cb      callback function  
 */
tournament.prototype.registrationInSatelliteTournament = function(params, cb){
  serverLog(stateOfX.serverLogType.info, 'params is in registrationInSatelliteTournament' + JSON.stringify(params));
  satelliteTournament.register(params, function(registerResponse) {
    serverLog(stateOfX.serverLogType.info, 'register response  is in registrationInSatelliteTournament' + JSON.stringify(registerResponse));
    cb(registerResponse);
  });
};

module.exports = function(app) {
    return new tournament(app);
};
