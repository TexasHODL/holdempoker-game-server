/*jshint node: true */
"use strict";

var stateOfX        = require("../../../../shared/stateOfX"),
    keyValidator    = require("../../../../shared/keysDictionary"),
    db              = require('../../../../shared/model/dbQuery.js'),
    profileMgmt     = require('../../../../shared/model/profileMgmt.js'),
    dynamicRanks    = require("./dynamicRanks.js"),
    zmqPublish    	= require("../../../../shared/infoPublisher"),
    popupTextManager  = require("../../../../shared/popupTextManager"),
    _ 							= require("underscore");


var tournamentRegistration = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'tournamentRegistration';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

var createTournamentUserCallback = function(deductChipsResponse,params,cb) {
	if(deductChipsResponse.success) {
		// Save records to inmemory db
		dynamicRanks.getRegisteredTournamentUsers(params.tournamentId,params.gameVersionCount);
		serverLog(stateOfX.serverLogType.info,"deductChipsResponse is - ",JSON.stringify(deductChipsResponse));
		cb({success: true, info: "user registered successfully", isRetry: false, isDisplay: false, channelId: ""});
	} else {
		cb(deductChipsResponse);
	}
};


/**
 * this function is used to prepare quey for TournamentUser (buildQueryForTournamentUser)
 * @method buildQueryForTournamentUser
 * @param  {[type]}   params request json object reqObject {tournamentId, playerId}
 * @return {[type]}          query/params
 */
var buildQueryForTournamentUser = function(params) {
	serverLog(stateOfX.serverLogType.info,"params in buildQueryForTournamentUser ",JSON.stringify(params));
	var query = {
		tournamentId: params.tournamentId,
		// isActive: true,
		playerId: params.playerId,
		gameVersionCount: params.gameVersionCount
	};
	var updateData = _.clone(query);
	updateData.isActive = true;
	updateData.registrationTime = Number(new Date());
	return {query: query, updateData: updateData,isRealMoney:params.isRealMoney, entryFees:params.entryFees};
};
/**
 * this function is used to prepare quey for buildArgForvalidateAndCreateTournamentUsers (buildArgForvalidateAndCreateTournamentUsers)
 * @method buildArgForvalidateAndCreateTournamentUsers
 * @param  {[type]}   params request json object reqObject {tournamentId, playerId,isRealMoney,entryFees,maxPlayersForTournament,gameVersionCount}
 * @return {[type]}          query/params
 */
var buildArgForvalidateAndCreateTournamentUsers = function(tournamentId, playerId, isRealMoney, entryFees, maxPlayersForTournament, gameVersionCount) {
	serverLog(stateOfX.serverLogType.info,"gameVersionCount in buildArgForvalidateAndCreateTournamentUsers ",gameVersionCount);
	return {
		tournamentId: tournamentId,
		playerId: playerId,
		maxPlayersForTournament: maxPlayersForTournament,
		isRealMoney: isRealMoney,
		entryFees: entryFees,
		gameVersionCount: gameVersionCount
	};
};
/**
 * this function is used to updatePlayerChips
 * @method updatePlayerChips
 * @param  {[type]}   params request json object reqObject {tournamentId, playerId,isRealMoney,entryFees,maxPlayersForTournament,gameVersionCount}
 * @return {[type]}          query/params
 */
var updatePlayerChips = function(params,cb) {
	serverLog(stateOfX.serverLogType.info,"params in updatePlayerChips ",JSON.stringify(params));
	db.deleteTournamentUser({tournamentId: params.tournamentId, playerId: params.playerId, isActive:true}, function(err, response) {
		if(err || !response) {
			//cb({success: false, info: "unable to register"});
      cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBDELETETOURNAMENTUSERFAIL_TOURNAMENTREGISTRATION});
		} else {
			var paramsForAddChips = {
				playerId: params.playerId,
				isRealMoney: params.isRealMoney,
				chips: params.entryFees
			};
			serverLog(stateOfX.serverLogType.info,"params for AddChips ",paramsForAddChips);
			profileMgmt.addChips(paramsForAddChips, function(){
				dynamicRanks.getRegisteredTournamentUsers(params.tournamentId,params.gameVersionCount);
				cb({success: true, info: "deRegister successfully", isRetry: false, isDisplay: false, channelId: ""});
			});
		}
	});
};
/**
 * this function is used to checkUserBalance
 * @method checkUserBalance
 * @param  {[type]}   params request json object 
 * @cb      callbackFunction
 * @return {[type]}          validated/params
 */
var checkUserBalance = function(params,cb) {
	db.getCustomUser(params.updateData.playerId,{freeChips: 1, realChips:1}, function(err, user) {
		serverLog(stateOfX.serverLogType.info,"user is ",user);
		if(err || !user) {
			//cb({success:false, info:"unable to get user data"});
      cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBGETCUSTOMUSER_DBERRORCHECKUSERBALANCE_TOURNAMENTREGISTRATION});
		} else {
			if(params.isRealMoney) {
				if(params.entryFees > user.realChips) {
					//cb({success: false, info:"Insufficient real chips"});
          cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBGETCUSTOMER_CHECKUSERBALANCENOREALMONEY_TOURNAMENTREGISTRATION});
				} else {
					cb({success: true});
				}
			} else {
				if(params.entryFees > user.freeChips) {
					//cb({success: false, info:"Insufficient play chips"});
          cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBGETCUSTOMER_CHECKUSERBALANCENOSUFFICIENTPLAYCHIPS_TOURNAMENTREGISTRATION});
				} else {
					cb({success: true});
				}
			}
		}
	});
};


/**
 * this function is used to createTournamentUser
 * @method createTournamentUser
 * @param  {[type]}   params request json object 
 * @param  {[type]}   isEligibleForRebuy request json object 
 * @cb      callbackFunction
 */
var createTournamentUser = function(isEligibleForRebuy, params,cb) {
	serverLog(stateOfX.serverLogType.info,"params in createTournamentUser in tournamentRegistration- ",params);
	checkUserBalance(params, function(balanceResponse) {
		if(balanceResponse.success) {
			if(isEligibleForRebuy) {
				serverLog(stateOfX.serverLogType.info,'Registration called from rebuy');
				var paramsForDeductChips = {
					playerId: params.updateData.playerId,
					isRealMoney: params.isRealMoney,
					chips: params.entryFees
				};
				serverLog(stateOfX.serverLogType.info,"params for deductChips ",paramsForDeductChips);
				profileMgmt.deductChips(paramsForDeductChips, function(deductChipsResponse){
				 createTournamentUserCallback(deductChipsResponse, params.query, cb);
				});
			} else {
				db.upsertTournamentUser(params.query,params.updateData,function(err, result) {
					if(err || !result) {
						serverLog(stateOfX.serverLogType.info,"error in getting tournament users");
						//cb({success:false, info:"unable to get tournament data"})
            cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBUPSERTTOURNAMENTUSER_DBERROR_TOURNAMENTREGISTRATION});
					}
					if(result.nModified) {
						serverLog(stateOfX.serverLogType.info,"user already registered in this tournament",result);
						//cb({success: false, info: "user already registered in this tournament"});
            cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBUPSERTTOURNAMENTUSER_USERALREADYEXIST_TOURNAMENTREGISTRATION});
					}
					serverLog(stateOfX.serverLogType.info,"params for entryFees is ",params.entryFees);
					if(!!result.upserted) {
						var paramsForDeductChips = {
							playerId: params.updateData.playerId,
							isRealMoney: params.isRealMoney,
							chips: params.entryFees
						};
						serverLog(stateOfX.serverLogType.info,"params for deductChips ",paramsForDeductChips);
						profileMgmt.deductChips(paramsForDeductChips, function(deductChipsResponse){
						 createTournamentUserCallback(deductChipsResponse, params.query, cb);
						});
					}
				});
			}
		} else {
			cb(balanceResponse);
		}
	});
};


/**
 * this function is used to validateAndCreateTournamentUsers
 * @method validateAndCreateTournamentUsers
 * @param  {[type]}   params request json object - {tournamentId, playerId, maxPlayersForTournament, isRealMoney, entryFees}
 * @cb      callbackFunction
 */
var validateAndCreateTournamentUsers = function(params,cb) {
	serverLog(stateOfX.serverLogType.info,"params is in validateAndCreateTournamentUsers is - ",JSON.stringify(params));
	var filterForTournamentUser = {
		tournamentId: params.tournamentId,
		isActive: true,
		gameVersionCount: params.gameVersionCount
	};
	db.countTournamentusers(filterForTournamentUser, function(err, noOfUsers) {
		if(err) {
			serverLog(stateOfX.serverLogType.info,"Error in getting number of users in tournament");
			//cb({success: false, info: "Error in getting number of users in tournament"});
      cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBCOUNTTOURNAMENTUSERS_VALIDATENCREATEDBERROR_TOURNAMENTREGISTRATION});
		} else{
			serverLog(stateOfX.serverLogType.info,"noOfUsers is in validateAndCreateTournamentUsers ",noOfUsers);
			serverLog(stateOfX.serverLogType.info,"maxPlayersForTournament is  in validateAndCreateTournamentUsers",params.maxPlayersForTournament);
			if(noOfUsers < params.maxPlayersForTournament) {
				serverLog(stateOfX.serverLogType.info,"params.tournamentId, params.playerId in validateAndCreateTournamentUsers is ",params);
				// var queryObject = buildQueryForTournamentUser({tournamentId: params.tournamentId, playerId: params.playerId});
				createTournamentUser(params.isEligibleForRebuy,buildQueryForTournamentUser({tournamentId: params.tournamentId, playerId: params.playerId,isRealMoney: params.isRealMoney,entryFees: params.entryFees,gameVersionCount: params.gameVersionCount}), function(result) {
					cb(result);
				});
			} else {
				serverLog(stateOfX.serverLogType.info,"seats are fulled no more registration allowed");
				//cb({success: false, info: "seats are fulled no more registration allowed"});
        cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBCOUNTTOURNAMENTUSERS_VALIDATENCREATE_TOURNAMENTREGISTRATION});
			}
		}
	});
};




/**
 * this function is for Registration in sitNgo
 * @method sitNGoRegistration
 * @param  {[type]}   params request json object 
 * @cb      callbackFunction
 */
tournamentRegistration.sitNGoRegistration = function(params,cb) {
	serverLog(stateOfX.serverLogType.info,"params in sitNgo reg ",JSON.stringify(params));
	if(params.tournamentState === stateOfX.tournamentState.register) {
		var query = buildArgForvalidateAndCreateTournamentUsers(params.tournamentId, params.playerId,params.isRealMoney,params.entryFees,params.maxPlayersForTournament,params.gameVersionCount);
		serverLog(stateOfX.serverLogType.info,"query is in sitNGoRegistration",query);
		validateAndCreateTournamentUsers(query, function(result) {
			serverLog(stateOfX.serverLogType.info,"result of validateAndCreateTournamentUsers", JSON.stringify(result));
			cb(result);
		});
	} else {
		//cb({success: false, info: "tournament already started"});
    cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.falseMessages.SITNGOREGISTRATIONFAIL_TOURNAMENTREGISTRATION});
	}
};


/**
 * this function is for Registration in normal Tounament
 * @method normalTournamentReg
 * @param  {[type]}   params request json object 
 * @cb      callbackFunction
 */
tournamentRegistration.normalTournamentReg = function(params,cb) {
	console.log("in tournamentRegistration line 209", JSON.stringify(params));
	serverLog(stateOfX.serverLogType.info,"params is in normalTournamentReg is in tournamentRegistration is - ",JSON.stringify(params));
	var currentTime = Number(new Date());
	var startTime = params.tournamentStartTime;
	if(params.lateRegistrationAllowed) {
		startTime = startTime + params.lateRegistrationTime*60000;
		//lateRegistrationTime is in minute
	}
	var regTimeStarts = params.tournamentStartTime - params.registrationBeforeStarttime*60000;
	serverLog(stateOfX.serverLogType.info,'regTimeStarts - ' + regTimeStarts);
	serverLog(stateOfX.serverLogType.info,'startTime - ' + startTime);
	serverLog(stateOfX.serverLogType.info,'currentTime - ' + currentTime);
	var info;
	if((currentTime <= startTime))  {
		info = "Tournament is upcoming. You can register once registration starts";
	}
	if(currentTime > regTimeStarts) {
		info = "Tournament join time is over";
	}
	serverLog(stateOfX.serverLogType.info,"startTime and currentTime is in normalTournamentReg -",new Date(startTime) , new Date(currentTime));
	if((currentTime <= startTime) || params.isEligibleForRebuy) { // check valid time to enter in registration
		//var query = buildArgForvalidateAndCreateTournamentUsers(params.tournamentId, params.playerId,params.isRealMoney,params.entryfees,params.maxPlayersForTournament,params.gameVersionCount);
		//serverLog(stateOfX.serverLogType.info,"query is in normal tournament reg is - ",query);
		if(currentTime <= regTimeStarts) {
		serverLog(stateOfX.serverLogType.info,"tournament registration has not started");
    	cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.falseMessages.NORMALTOURNAMENTREGISTRATIONFAIL_REGISTRATIONNOTSTARTED});

		}
		else{
		validateAndCreateTournamentUsers(params, function(result) {
			serverLog(stateOfX.serverLogType.info,"result of validateAndCreateTournamentUsers", JSON.stringify(result));
			cb(result);
		});
	}
	} else {
		serverLog(stateOfX.serverLogType.info,"tournament join time is over");
		//cb({success: false, info: info});
    cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.falseMessages.NORMALTOURNAMENTREGISTRATIONFAIL_TOURNAMENTREGISTRATION});
	}
};




/**
 * this function is for SitNGo Deregistration
 * @method deRegisteration
 * @param  {[type]}   params request json object 
 * @cb      callbackFunction
 */
tournamentRegistration.deRegisteration = function(params, cb) {
	serverLog(stateOfX.serverLogType.info,"params in deRegisteration in tournamentRegistration");
	updatePlayerChips(params, function(updatePlayerChipsResponse) {
		serverLog(stateOfX.serverLogType.info,"--------------");
		dynamicRanks.getRegisteredTournamentUsers(params.tournamentId,params.gameVersionCount);
		serverLog(stateOfX.serverLogType.info,"updatePlayerChips response is "+updatePlayerChipsResponse);
		cb(updatePlayerChipsResponse);
	});
};


module.exports = tournamentRegistration;
