/*
* @Author: unknown
* @Date:   2018-10-05 15:28:10
* @Last Modified by:   naman jain
* @Last Modified time: 2019-08-13 14:51:52
*/

/*jshint node: true */
"use strict";

// Variables to be used in this file
var _ = require('underscore');
var responseSet				= {};
var keySets 					= {};
var optnlKeySets 			= {};
var internalFunctions = {};
var handlerFunctions 	= {};
var responsibleText 	= "No prediction";


// Store all the dictionary for table
keySets["table"] = {
	//  totalGame: "Number", totalPot: "Number", avgPot: "Number", totalPlayer: "Number", totalFlopPlayer: "Number", avgFlopPercent: "Number"
	//createtable : isPotLimit: "Boolean",minPlayers: "Number",blindMissed: "Number", channelVariation: "String",
	createTable		: {	isRealMoney: "Boolean",	channelName: "String", turnTime: "String",
										isPotLimit: "Boolean", maxPlayers: "Number",  smallBlind: "Number", bigBlind: "Number",
										isStraddleEnable: "Boolean", minBuyIn: "Number",
										maxBuyIn: "Number", numberOfRebuyAllowed: "Number", hourLimitForRebuy: "Number",
										rebuyHourFactor: "Number", gameInfo: "Object", gameInterval: "Number", createdBy: "String",
										 rake : "Object", channelVariation: "String", minPlayers: "Number"

									},
	//updateTable: minPlayers: "Number",blindMissed: "Number",channelVariation: "String",
	updateTable		: {	_id: "String", isRealMoney: "Boolean", channelName: "String", turnTime: "String",
										isPotLimit: "Boolean", maxPlayers: "Number",  smallBlind: "Number",
										bigBlind: "Number", isStraddleEnable: "Boolean",
										minBuyIn: "Number", maxBuyIn: "Number", numberOfRebuyAllowed: "Number",
										hourLimitForRebuy: "Number", rebuyHourFactor: "Number", gameInfo: "Object", updatedBy: "String",
										gameInterval: "Number", rake : "Object", channelVariation: "String", minPlayers: "Number"

									},
	listTable				: { channelType: "String"},
	getTable				: { isRealMoney: "Boolean" },
	disableTable		: { isActive: "Boolean", id: "String" },
	createRakeRule	: { name: "String", description: "String",channelVariation: "String", list: "Array"},
	listRakeRule 		: {},
	updateRakeRules	: {_id:"String" ,name: "String", description: "String",channelVariation: "String", list: "Array"},
	disableRakeRules: { isActive: "Boolean", id: "String" },
	listRakeRuleName: { isActive: "Boolean" }
	
};
internalFunctions["table"] 	= [];
handlerFunctions["table"] 	= ["createTable", "listTable", "updateTable", "disableTable", "getTable",
																"createRakeRule", "listRakeRule", "updateRakeRules", "disableRakeRules",
																"listRakeRuleName", "createScratchCard"];

optnlKeySets['table'] = {
 createTable    : {chipsPointRatio: "Number", isPrivateTabel: "Boolean",passwordForPrivate: "String",
 										favourite: "Boolean",  isRunItTwice : "Boolean"},
    listTable        : {channelVariation: "String"},
    updateTable    : {chipsPointRatio: "Number",isPrivateTabel: "Boolean" ,passwordForPrivate: "String",
										favourite: "Boolean", isRunItTwice : "Boolean"},
    disableTable: {},
    getTable        : { channelVariation: "String" },
    createRakeRule    : {},
    listRakeRule         : {},
    updateRakeRules    : {},
    disableRakeRules: {},
    listRakeRuleName: {}
};

// Store all the dictionary for tournament room
keySets["tournamentRoom"] = {
//, isRecurring: "String",noOfChipsAtGameStart : "Number" (should be add later)
//createTournamentRoom: minPlayers: "Number",gameInterval: "Number",,gameInfo: "String",
//updateTournamentRoom: minPlayers: "Number",gameInterval: "Number",tournamentStartTime: "Number",gameInfo: "String",
	createTournamentRoom: {	isRealMoney: "Boolean",    tournamentType: "String", channelName: "String",
                          channelVariation: "String",turnTime: "String", extraTimeAllowed: "Number",
                          maxPlayers: "Number",minPlayersForTournament : "Number", maxPlayersForTournament: "Number",
                          blindRule: "String",isPotLimit: "Boolean",entryfees: "Number", housefees: "Number",
                          bountyfees: "Number", tournamentTime: "Number",rebuyTime: "Number", tournamentRules: "String",
                          lateRegistrationAllowed: "Boolean", lateRegistrationTime: "Number", isRebuyAllowed: "Boolean",
                          numberOfRebuy: "Number",smallBlind: "Number", bigBlind: "Number", ante: "Number",
                          isRecurring: "Boolean", recurringTime: "Number",tournamentStartTime: "Number",
                          noOfChipsAtGameStart : "Number",registrationBeforeStarttime: "Number", isSchedule: "Boolean",
                          isLateRegistrationOpened: "Boolean",isRebuyOpened: "Boolean",favourite: "Boolean",
                          tournamentName: "String",    isAddonEnabled: "Boolean", isPrivateTabel: "Boolean",
                          breakRuleId: "String",timeBankRule: "String",
                          addonRule: "Array",isAddonOpened: "Boolean",
                          isGtdEnabled: "Boolean", addonTime: "Array"
									},
	updateTournamentRoom: {	_id: "String", isRealMoney: "Boolean",    tournamentType: "String", channelName: "String",
                           channelVariation: "String",    turnTime: "String", extraTimeAllowed: "Number",
                          maxPlayers: "Number",minPlayersForTournament : "Number", maxPlayersForTournament: "Number",
                          blindRule: "String",isPotLimit: "Boolean",entryfees: "Number", housefees: "Number",
                          bountyfees: "Number", tournamentTime: "Number",rebuyTime: "Number", tournamentRules: "String",
                          lateRegistrationAllowed: "Boolean", lateRegistrationTime: "Number", isRebuyAllowed: "Boolean",
                          numberOfRebuy: "Number",smallBlind: "Number", bigBlind: "Number", ante: "Number",
                          isRecurring: "Boolean", recurringTime: "Number",tournamentStartTime: "Number",
                          noOfChipsAtGameStart : "Number",registrationBeforeStarttime: "Number", isSchedule: "Boolean",
                          isLateRegistrationOpened: "Boolean",isRebuyOpened: "Boolean",favourite: "Boolean",
                          tournamentName: "String",    isAddonEnabled: "Boolean", isPrivateTabel: "Boolean",
                          breakRuleId: "String",timeBankRule: "String",
                          addonRule: "Array",isAddonOpened: "Boolean",
                          isGtdEnabled: "Boolean", addonTime: "Array"
									},
	createSITNGOTournamentRoom: {	isRealMoney: "Boolean",	channelName: "String", tournamentType: "String", turnTime: "String",
																maxPlayers: "Number", smallBlind: "Number", bigBlind: "Number", ante: "Number",
																channelVariation: "String", entryfees: "Number", housefees: "Number", bountyfees: "Number",
																tournamentRules: "String", blindRule: "String", prizeRule: "String", isRecurring: "Boolean",
																maxPlayersForTournament: "Number", noOfChipsAtGameStart: "Number", extraTimeAllowed: "Number",
																isPotLimit: "Boolean", favourite: "Boolean", tournamentStartTime: "Number",
																tournamentName: "String"
									},
	updateSITNGOTournamentRoom: {	_id: "String", isRealMoney: "Boolean",	channelName: "String", tournamentType: "String",
															turnTime: "String", maxPlayers: "Number",smallBlind: "Number", bigBlind: "Number", ante: "Number",
															channelVariation: "String", entryfees: "Number", housefees: "Number", bountyfees: "Number",
															tournamentRules: "String", blindRule: "String", prizeRule: "String", isRecurring: "Boolean",
															maxPlayersForTournament: "Number", noOfChipsAtGameStart: "Number", extraTimeAllowed: "Number",
															isPotLimit: "Boolean", favourite: "Boolean", tournamentStartTime: "Number",
															tournamentName: "String"
									},
	listTournamentRoom: 	{},
	disableTournamentRoom:{ isActive: "Boolean", id: "String" },
	createBlindRule: { name: "String", description: "String", list: "Array"},
	listBlindRule: {},
	updateBlindRules: {_id:"String" ,name: "String", description: "String", list: "Array"},
	disableBlindRules: { isActive: "Boolean", id: "String" },
	listBlindRuleName: { isActive: "Boolean" },
	createPrizeRule: { name: "String", description: "String", list: "Array"},
	listPrizeRule: {},
	updatePrizeRules: {_id:"String" ,name: "String", description: "String", list: "Array"},
	disablePrizeRules: { isActive: "Boolean", id: "String" },
	listPrizeRuleName: { isActive: "Boolean" },

	breakTime: {name: "String", description: "String", rule: "Array"},
  listBreakTime : {},
  updateBreakTime : {_id: "String", name: "String", description: "String", rule: "Array"},
  disableBreakTime : {isActive: "Boolean", id: "String"},

  timeBank: {name: "String", description: "String", rule: "Array"},
  listTimeBank : {},
  updateTimeBank : {_id: "String", name: "String", description: "String", rule: "Array"},
  disableTimeBank : {isActive: "Boolean", id: "String"}

};
internalFunctions["tournamentRoom"] 	= [];
handlerFunctions["tournamentRoom"] 	= ["createTournamentRoom", "listTournamentRoom", "updateTournamentRoom", "disableTournamentRoom",
																			"createBlindRule", "listBlindRule", "updateBlindRules", "disableBlindRules", "listBlindRuleName",
																			"createPrizeRule", "listPrizeRule", "updatePrizeRules", "disablePrizeRules", "listPrizeRuleName",
																			"createSITNGOTournamentRoom", "updateSITNGOTournamentRoom",
                                        "breakTime", "listBreakTime", "updateBreakTime", "disableBreakTime",
                                        "timeBank", "listTimeBank", "updateTimeBank", "disableTimeBank"
																			];

optnlKeySets['tournamentRoom'] = {
	createTournamentRoom	: {isPrivateTabel: "Boolean" ,passwordForPrivate: "String",bigBreakDuration: "Number", parentOfSatelliteId: "String",
														rebuyMaxLimitForChips: "Number", parentBuyIn: "Number", isTournamentRunning: "Boolean",
													gtdAmount: "Number"},
	updateTournamentRoom	: {isPrivateTabel: "Boolean" ,passwordForPrivate: "String",bigBreakDuration: "Number", parentOfSatelliteId: "String",
													rebuyMaxLimitForChips: "Number", parentBuyIn: "Number", isTournamentRunning: "Boolean",
													gtdAmount: "Number"},
	listTournamentRoom		: { channelVariation: "String", tournamentType: "String"},
	createSITNGOTournamentRoom : {isPrivateTabel: "Boolean" ,passwordForPrivate: "String"},
	updateSITNGOTournamentRoom : {isPrivateTabel: "Boolean" ,passwordForPrivate: "String"},
	disableTournamentRoom : {},
	createBlindRule: {},
	listBlindRule: {},
	updateBlindRules: {},
	disableBlindRules: {},
	listBlindRuleName: {},
	createPrizeRule: {},
	listPrizeRule: {},
	updatePrizeRules: {},
	disablePrizeRules: {},
	listPrizeRuleName: {},
  breakTime: {},
  listBreakTime: {},
  updateBreakTime: {},
  disableBreakTime: {},
  timeBank: {},
  listTimeBank: {},
  updateTimeBank: {},
  disableTimeBank: {}
};

// Store all the dictionary for table
keySets["user"] = {
	forgotPasword		: {userName : "String",emailId : "String"},
	resetPassword   : {passwordResetToken: "String", password: "String"},
	resendEmailVerificationLink : {playerId : "String"},
	updatePrefences : {playerId : "String",letter : 'Object',offers : 'Object',tournaments : 'Object',anouncement :'Object'},
	verifyEmail     : {token : "String"},
	sendOtp 				: {playerId : "String"},
	sendOtpSignUP 	: {mobileNumber : "Number"},
	verifyOtp 			: {playerId : "String",mobileNumber : "Number",otp : "String"},
	getTransactionHistory : {playerId : "String",lowerLimit : "Number", upperLimit : "Number"},
	getWalletInfo 	: {playerId : "String"},
	changePassword 	: {playerId : "String", oldPassword: "String", newPassword: "String"},
	updateUser 	    : {query:"Object", updateKeys: "Object"},
	createConfiguration : {type : "String"},
	updateConfiguration : {query : "String", updateKeys : "String"},
	getConfiguration : {type : "String"},
	collectFreeChips : {playerId :  "String"},
	maintainanceAndUpdate : {appVersion : "String", deviceType: "String"},
	transactionByScratchCard 	: {playerId : "String",scratchCardId : "String"},
	bonusCode 	: {code : "String",chips : "Number"},
	transactionByOnlinePayment 	: {playerId : "String",chips : "Number",code : "String", referenceNo : "String",transactionFirstName: "String", transactionLastName: 'String', transactionEmail: 'String',transactionMobile: 'Number' }
};
internalFunctions["user"] 	= [];
handlerFunctions["user"] 		= ["forgotPasword","resetPassword", "resendEmailVerificationLink","verifyEmail","sendOtp","verifyOtp","getTransactionHistory","getWalletInfo","updateConfiguration","getConfiguration","createConfiguration","collectFreeChips","maintainanceAndUpdate","changePassword",
"updateUser","updatePrefences","changePancard","selfVerifyPancard","transactionByScratchCard","bonusCode","sendOtpSignUP","transactionByOnlinePayment"];

optnlKeySets['user'] = {
	forgotPasword								: {},
	resetPassword   						: {},
	resendEmailVerificationLink : {},
	verifyEmail     						: {},
	sendOtp											: {},
	verifyOtp										: {},
	getTransactionHistory 			: {}
};

// Store all the dictionary for affiliate
keySets["affiliate"] = {
	createAdmin	: {name: "String", userName: "String", email: "String", gender: "String",
									dob: "Number", mobile: "Number", address: "String",
									city: "String", state: "String", country: "String", role:"String", roles:"String", status: "String"},

	createAffiliate: {name: "String", userName: "String", email: "String",
						mobileNumber: "String", rakeCommision:"Number",role:"String",
						password:"String", createdby:"String",
						country:"String", city : "String",
						isStatus:"String", isBlocked:"String", dob: "String", status: "String"},
	completePeningChip: {transactionAction: "String", pendingfundid: "String",
							amount: "String",amountProcess: "Number", role: "String", loggedinUserid: "String"},
	fundTransfer		: {userrole: "String", fundTransferToName: "String",
							 fundTransferAmount: "Number",transactionAction: "String"},
	forgot : {userName: "String"}
	/*	createAdmin	: {name: "String", userName: "String", email: "String",
						mobileNumber: "Number", rakeCommision:"Number",
						role:"String", password:"String", panCard:"String", createdby:"String",
						isParent:"Number", balance:"String",
						isStatus:"Number", isBlocked:"Number", createdDate: "String" },
	login				: {userName: "String", password: "String"} */

};

internalFunctions["affiliate"] 	= [];
handlerFunctions["affiliate"] 	= ["createAdmin", "login", "createAffiliate", "completePeningChip",
									"fundTransfer", "forgot"];

optnlKeySets['affiliate'] = {
	createAdmin	: {pincode: "Number"},
	login				:{userName: "String", password:"String"},
	createAffiliate : { panCard:"String",isParent:"String", userid : "String", adminRoles: "Array", maximumChipsAllowed: "Number", balance: "String"},
	completePeningChip : {comment: "String"},
	fundTransfer : {comment: "String",mobileNumber: "String"},
	forgot : {}
};

//scratch card start
keySets["scratch"] = {
	createscratchcard		: {scratchcardToName: "String", scratchcardAmount: "Number", scratchcardByRole: "String",
												 scratchcardByName: "String", scratchcardByUserid: "String", amount: "Number",
											 scratchcardToUserid: "String", scratchCardCode: "String"	},
 	redeemscratch 			: {redeemscratchCardCode: "String", userName: "String", userrole : "String",
												loggedinUserid: "loggedinUserid"}
};

internalFunctions["scratch"] 	= [];
handlerFunctions["scratch"] 	= ["createscratchcard", "redeemscratch"];

optnlKeySets['scratch'] = {
	createscratchcard : {comment: "String"},
	redeemscratch 		: {}
};
//scratch card End

// Store all the dictionary for auth
keySets["auth"] = {
	registerDHKeyFromClient	: {key: "String", clientId: "String", dHid: "String"}
};

internalFunctions["auth"] = [];
handlerFunctions["auth"] 	= ["registerDHKeyFromClient"];

optnlKeySets['auth'] = {
	registerDHKeyFromClient	:{}
};

// Store all the dictionary for promotion
keySets["promotions"] = {
	createPromoCode: { promocode: "String", startDateTime: "Number", endDateTime: "Number", totalLimit: "Number",
										perUserLimit: "Number", percentDiscount: "Number", maxCashback: "Number"},
	listPromoCode: {},
	updatePromoCode: { promocode: "String", startDateTime: "Number", endDateTime: "Number", totalLimit: "Number",
										perUserLimit: "Number", percentDiscount: "Number", maxCashback: "Number"},
	createScratchCard: { scratchCardCode: "String", startDateTime: "Number", endDateTime: "Number", amount: "Number"},
	listScratchCard: {},
	updateScratchCard: { scratchCardCode: "String", startDateTime: "Number", endDateTime: "Number", amount: "Number"}
};

internalFunctions["promotions"] 	= [];
handlerFunctions["promotions"] 	= ["createPromoCode", "listPromoCode", "updatePromoCode", "createScratchCard", "listScratchCard", "updateScratchCard"];

optnlKeySets['promotions'] = {
	createPromoCode	: {},
	listPromoCode: {},
	updatePromoCode: {},
	createScratchCard: {},
	listScratchCard: {},
	updateScratchCard: {}
};


// New dictionary for loyaltyPoints

keySets["loyaltyPoint"] = {
	createLoyaltyLevel: { loyaltyLevel: "String", levelThreshold: "Number", percentReward: "Number", levelId: "Number"},
	updateLoyaltyLevel: { _id : "String", loyaltyLevel: "String", levelThreshold: "Number", percentReward: "Number", levelId: "Number"},
	listLoyaltyLevel: {},
	playerLoyaltyLevel: {playerId: "String"}
};

internalFunctions["loyaltyPoint"] 	= [];
handlerFunctions["loyaltyPoint"] 	= ["createLoyaltyLevel", "updateLoyaltyLevel", "listLoyaltyLevel", "playerLoyaltyLevel"];

optnlKeySets['loyaltyPoint'] = {
	createScratchCard: {}
};



// Store all the dictionary for spamwords
keySets["spamWords"] = {
	updateSpamWord: { wordBlocked: "String"},
	listSpamWords: {},
};
internalFunctions["spamWords"] 	= [];
handlerFunctions["spamWords"] 	= ["updateSpamWord", "listSpamWords"];

optnlKeySets['spamWords'] = {
	updateSpamWord: {},
	listSpamWords: {},
};

keySets["scratchcards"] = {
	createScratchCardEmergency : { scratchCardType: "String", scratchCardDetails: "Array", totalAmount: "Number", isActive: "Boolean",
											 expiresOn: "Number", playerId: "String", createdBy: "Object", transactionType: "String" },
	createScratchCardAffiliate : { scratchCardType: "String", scratchCardDetails: "Array", totalAmount: "Number", isActive: "Boolean",
											 expiresOn: "Number", affiliateId: "String", createdBy: "Object", transactionType: "String" },
	createScratchCardHighRollers : { playerId: "String", scratchCardType: "String", totalAmount: "Number", comment: "String", isActive: "Boolean",
											 expiresOn: "Number", createdBy: "Object", transactionType: "String" },
	createScratchCardPromotions : { scratchCardType: "String", scratchCardDetails: "Array", totalAmount: "Number", isActive: "Boolean",
											 expiresOn: "Number", promoCode: "String", createdBy: "Object", transactionType: "String" }
};

internalFunctions["scratchcards"] 	= [];
handlerFunctions["scratchcards"] 	= ["createScratchCardAffiliate", "createScratchCardEmergency", "createScratchCardHighRollers", "createScratchCardPromotions"];

optnlKeySets['scratchcards'] = {
	createScratchCard: {}
};


// Key validation sets for leaderboard
keySets["leaderboard"] = {
	createLeaderboard : {leaderboardName: "String", leaderboardType: "String", minVipPoints : "Number",
		noOfWinners: "Number", createdBy: "Object", payout: "Array", tables: "Array", totalPrizePool : "Number", 
		startTime : "Number", endTime : "Number"},
	deleteLeaderboard : {id: "String"},
	editLeaderboard : {id: "String", minVipPoints : "Number", noOfWinners: "Number", payout: "Array", tables: "Array", 
		totalPrizePool : "Number", updatedBy: "Object", updatedAt: "Number"},
	getCurrentLeaderboardParticipants : {leaderboardId : "String" }
};

internalFunctions["leaderboard"] = [];
handlerFunctions["leaderboard"] = ["createLeaderboard", "deleteLeaderboard", "editLeaderboard","getCurrentLeaderboardParticipants"];

optnlKeySets["leaderboard"] = {
	createLeaderboard : {description: "String", bonusCode : "String"},
	editLeaderboard : {},
	deleteLeaderboard : {}
};

//Key validation for promotions website
keySets["promotionsWebsite"] = {
	createPromotions: { description: "String", header: "String", imageLink: "String", pageLink: "String", promotionName: "String"}
};

internalFunctions["promotionsWebsite"] = [];
handlerFunctions["promotionsWebsite"] = ["createPromotions"];
optnlKeySets["promotionsWebsite"] = {};

// Validate keys and generate proper response
keySets.validate = function (type, serverType, methodName, clientKeys, cb){
	if(!!!type || !!!serverType || !!!methodName || !!! clientKeys){
		return cb({success: false, info: "Missing serverType | methodName | clientKeys"});
	}

	if(type.toUpperCase() == "REQUEST") {
		var routeFromDict = keySets[serverType][methodName];
		responsibleText = " in request ";
	} else {
		var routeFromDict = responseSet[serverType][methodName];
		responsibleText = " in response ";
	}

	var optnlrouteFromDict	=  optnlKeySets[serverType][methodName];
	var missingKeys = [];
	var validateRespJson = {};
	if(internalFunctions[serverType].indexOf(methodName) >= 0) {
		responsibleText = " on server !";
	} else if (handlerFunctions[serverType].indexOf(methodName) >= 0) {
		responsibleText = " from client !";
	} else {
		return cb({success: false, info: 'No dictionary defined for function - ' + methodName + ' on '+ serverType + ' server!'});
		console.error('No dictionary defined for function - ' + methodName + ' on '+ serverType + ' server!');
	}
	for(var key in routeFromDict){
		if(!clientKeys[key]){ // intentionally setting true for missing key for pushing key
			if(clientKeys[key] != false && clientKeys[key] != "") {
				missingKeys.push(key);
			} else{
				validateRespJson[key] = clientKeys[key];
			}
		} else{
				validateRespJson[key] = clientKeys[key];
		}
	}

	for(var key in optnlrouteFromDict){
		if(!clientKeys[key]){ // intentionally setting true for missing key for pushing key
			if(clientKeys[key] != false && clientKeys[key] != "") {
				// do nothing
			} else{
				validateRespJson[key] = clientKeys[key];
			}
		} else{
				validateRespJson[key] = clientKeys[key];
		}
	}

	if(missingKeys.length > 0){
		console.error("Missing keys - [" + (missingKeys).toString() + "] in function - " + methodName + " " + responsibleText);
		return cb({success: false, info: "Missing keys - [" + (missingKeys).toString() + "] in function - " + methodName + " " + responsibleText});
	} else {
		return cb({success: true, result: validateRespJson});
	}
};

module.exports = keySets;
