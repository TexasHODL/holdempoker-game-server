/*jshint node: true */
"use strict";

/* Created by Amrendra 24/10/2016 */

var _ld = require("lodash"),
	_ = require('underscore'),
	async = require('async'),
	uuid = require('uuid'),
	stateOfX = require("../../../../shared/stateOfX"),
	zmqPublish = require("../../../../shared/infoPublisher"),
	keyValidator = require("../../../../shared/keysDictionary"),
	db = require("../../../../shared/model/dbQuery"),
	admindb = require("../../../../shared/model/adminDbQuery"),
	financeDB = require("../../../../shared/model/financeDbQuery"),
	rewardRake = {},
	messages = require("../../../../shared/popupTextManager").falseMessages,
	dbMessages = require("../../../../shared/popupTextManager").dbQyeryInfo,
	rakeRegister = require("../../database/remote/rakeBack"),
	shortid = require('shortid32');

shortid.characters('QWERTYUIOPASDFGHJKLZXCVBNM012345');
// Create data for log generation

function serverLog(type, log) {
	var logObject = {};
	logObject.fileName = 'rewardRake';
	logObject.serverName = stateOfX.serverType.database;
	// logObject.functionName  = arguments.callee.caller.name.toString();
	logObject.type = type;
	logObject.log = log;
	// zmqPublish.sendLogMessage(logObject);
	console.log(JSON.stringify(logObject));
}

// round off to two decimal places
function roundOff(n) {
	return Math.round(n * 100) / 100;
}

function fixedDecimal(number, precisionValue) {
	let precision = precisionValue ? precisionValue : 4;
	return Number(Number(number).toFixed(precision));
}

// this is the function
// which distributes rake to affiliates or
// sub-affiliates if needed
// - process rake to affiliate or sub affiliate
var processRaketoAffiliate = function (params, callback) {
	serverLog(stateOfX.serverLogType.info, 'processRaketoAffiliate' + JSON.stringify(params));
	//if player has no any parenets;
	if (!params.isParentUserName) { //if user has been directly under admin
		callback(null, params);
		return;
	}
	var affdata = {};
	if (!!params.rakeBack) {
		console.error(params.rakeBack);
	} else {
		params.rakeBack = 0;
	}
	affdata.userName = params.isParentUserName;

	admindb.getUser(affdata, function (err, subAffUserData) {
		//console.error(subAffUserData);
		if (err) {
			serverLog(stateOfX.serverLogType.info, 'error on rakeCommision' + JSON.stringify(err));
			return callback({ success: false, info: messages.DISTRIBUTERAKE_FAILED_REWARDRAKE, isRetry: false, isDisplay: false, channelId: "" });
		}
		var transactiondata = {}, affAmount = 0, subaffAmount = 0, adminAmount = 0, admindata = {};
		serverLog(stateOfX.serverLogType.info, "subaffuserdata" + JSON.stringify(subAffUserData));
		if (subAffUserData.parentUser) {
			//previous user is sub affiliate needs to process previosly aff
			affdata.userName = subAffUserData.parentUser;
			admindb.getUser(affdata, function (err, affUserData) {
				if (err) {
					callback({ success: false, info: dbMessages.DB_FINDAFFILIATE_FAILED_REWARDRAKE, isRetry: false, isDisplay: true, channelId: "" });
				} else {
					var subaffuserdata = affUserData;
					var affuserdata = subAffUserData;
					//manage affiliate data
					var playerRakeBackTemp = 0;
					if (params.rakeBack > 0) {
						playerRakeBackTemp = (params.playerRake * params.rakeBack) / 100;
						params.playerRakeBack = fixedDecimal(playerRakeBackTemp);
					} else {
						params.playerRakeBack = 0;
					}
					var affAmount1 = Number((params.playerRake * subaffuserdata.rakeCommision) / 100);
					affAmount = fixedDecimal(affAmount1);
					console.error(params.playerRake, " %%%%%%%%%%&&&&&&&&&&&&&&&&&&& ", subaffAmount, " @@@@@@@@@@@@@@@@@@@@@@@@@@@ ", affAmount);
					var subaffAmount1 = Number((params.playerRake * affuserdata.rakeCommision) / 100);//Number((affAmount * affuserdata.rakeCommision)/100) ;
					subaffAmount = fixedDecimal(subaffAmount1);
					subaffAmount = subaffAmount - params.playerRakeBack;
					affAmount = Number(affAmount - subaffAmount - params.playerRakeBack);
					transactiondata.transactionid = params.transactionid;
					transactiondata.transactionByUserid = params.playerId;
					transactiondata.transactionByName = params.userName;
					transactiondata.transactionByRole = 'Player';

					transactiondata.transactionToUserid = affuserdata._id;
					transactiondata.transactionToName = affuserdata.name;
					transactiondata.transactionToRole = affuserdata.role;
					transactiondata.transactionToAmount = subaffAmount;
					transactiondata.fundtransactionType = 'Debit';
					transactiondata.transactionReason = 'Rake';
					transactiondata.transactionAction = 'Completed';
					transactiondata.transactionStatus = "Completed";
					transactiondata.addeddate = new Date().getTime();
					transactionhistroy(transactiondata, function (res) {
						//process to balance on affiliate
						manageaffandsubaffrakebal(affuserdata._id, subaffAmount, function (res) {
							//decrease comp bal
							managecompanyrakebal(subaffAmount, function (res) {
								//process transaction histroy to admin
								admindata.transactionid = params.transactionid;
								admindata.transactionByUserid = params.playerId;
								admindata.transactionByName = params.userName;
								admindata.transactionByRole = 'Player';
								admindata.transactionByName = 'Company';
								admindata.transactionByRole = 'admin';
								admindata.transactionByAmount = subaffAmount;
								admindata.fundtransactionType = 'Credit';
								admindata.transactionReason = 'Rake';
								admindata.transactionAction = 'Completed';
								admindata.transactionStatus = "Completed";
								admindata.addeddate = new Date().getTime();
								transactionhistroy(admindata, function (res) {

								});
							});

						});
					});
					// process to sub affiliate data
					var subaffdata = {};
					subaffdata.transactionid = params.transactionid;
					subaffdata.transactionByUserid = params.playerId;
					subaffdata.transactionByName = params.userName;
					subaffdata.transactionByRole = 'Player';

					subaffdata.transactionToUserid = subaffuserdata._id;
					subaffdata.transactionToName = subaffuserdata.name;
					subaffdata.transactionToRole = subaffuserdata.role;
					subaffdata.transactionToAmount = affAmount;
					subaffdata.fundtransactionType = 'Debit';
					subaffdata.transactionReason = 'Rake';
					subaffdata.transactionAction = 'Completed';
					subaffdata.transactionStatus = "Completed";
					subaffdata.addeddate = new Date().getTime();
					transactionhistroy(subaffdata, function (res) {
						//process to balance on affiliate
						manageaffandsubaffrakebal(subaffuserdata._id, affAmount, function (res) {
							//decrease comp bal
							managecompanyrakebal(affAmount, function (res) {
								//process transaction histroy to admin
								var subadmindata = {};
								subadmindata.transactionid = params.transactionid;
								subadmindata.transactionByUserid = params.playerId;
								subadmindata.transactionByName = params.userName;
								subadmindata.transactionByRole = 'Player';
								subadmindata.transactionToName = 'Company';
								subadmindata.transactionToRole = 'admin';
								subadmindata.transactionToAmount = affAmount;
								subadmindata.fundtransactionType = 'Credit';
								subadmindata.transactionReason = 'Rake';
								subadmindata.transactionAction = 'Completed';
								subadmindata.transactionStatus = "Completed";
								subadmindata.addeddate = new Date().getTime();
								transactionhistroy(subadmindata, function (res) {

								});
							});


						});
					});
					//fund rate date entry
					serverLog(stateOfX.serverLogType.info, 'paramsparamsparamsparams', JSON.stringify(params));
					var fundrake = {};
					fundrake.rakeRefType = params.rakeRefType;
					fundrake.rakeRefVariation = params.rakeRefVariation;
					fundrake.channelId = params.channelId;
					fundrake.channelName = params.channelName;
					fundrake.rakeRefSubType = params.rakeRefSubType;
					fundrake.rakeRefId = params.rakeRefId;
					fundrake.transactionid = params.transactionid;
					fundrake.rakeByUserid = params.playerId;
					fundrake.rakeByName = params.firstName + " " + params.lastName;
					fundrake.megaCircle = params.statistics.megaPointLevel;
					fundrake.megaPoints = params.statistics.megaPoints;
					fundrake.rakeByUsername = params.userName;
					fundrake.amount = params.playerRakeOriginalBeforGST;
					fundrake.amountGST = params.playerRakeOriginal;
					var tempAmount = Number(params.playerRakeOriginal - (affAmount + subaffAmount + params.playerRakeBack));
					fundrake.debitToCompany = tempAmount;
					fundrake.debitToSubaffiliateid = (affuserdata._id).toString();
					fundrake.debitToSubaffiliatename = affuserdata.userName;
					fundrake.debitToSubaffiliateamount = subaffAmount;
					fundrake.debitToAffiliateid = (subaffuserdata._id).toString();
					fundrake.debitToAffiliatename = subaffuserdata.userName;
					fundrake.debitToAffiliateamount = affAmount;
					if (params.playerRakeBack > 0) {
						fundrake.playerRakeBack = params.playerRakeBack;
						fundrake.playerRakeBackPercent = params.rakeBack;
						params.parentUserType = "Sub-Affiliate";
					}
					fundrake.addeddate = new Date().getTime();
					managerakefund(fundrake, function (res) { });
					callback(null, params);
				}
			});
		} else {
			var subaffuserdata = subAffUserData;
			var playerRakeBackTemp = 0;
			if (params.rakeBack > 0) {
				playerRakeBackTemp = (params.playerRake * params.rakeBack) / 100;
				params.playerRakeBack = fixedDecimal(playerRakeBackTemp);
			} else {
				params.playerRakeBack = 0;
			}
			//previous user is affiliate direly process to aff & admin
			var affAmount1 = Number((params.playerRake * subaffuserdata.rakeCommision) / 100);

			// affAmount = (Math.ceil(affAmount1)-affAmount1==0.5 && Math.ceil(affAmount1)%2 != 0) ? Math.floor(affAmount1) : Math.round(affAmount1);
			affAmount = fixedDecimal(affAmount1);
			console.error(params.playerRake, " @@@@@@@@@@@@@@@@@@@@@@ ", affAmount);
			affAmount = affAmount - params.playerRakeBack;
			//console.error(params.playerRake," @@@@@@@@@@@@@@@@@@@@@@ ", subaffuserdata.rakeCommision);
			transactiondata.transactionid = params.transactionid;
			transactiondata.transactionByUserid = params.playerId;
			transactiondata.transactionByName = params.userName;
			transactiondata.transactionByRole = 'Player';
			transactiondata.transactionToUserid = subaffuserdata._id;
			transactiondata.transactionToName = subaffuserdata.name;
			transactiondata.transactionToRole = subaffuserdata.role;
			transactiondata.transactionByAmount = affAmount;
			transactiondata.fundtransactionType = 'Debit';
			transactiondata.transactionReason = 'Rake';
			transactiondata.transactionAction = 'Completed';
			transactiondata.transactionStatus = "Completed";
			transactiondata.addeddate = new Date().getTime();

			transactionhistroy(transactiondata, function (res) {
				//process to balance on affiliate
				manageaffandsubaffrakebal(subaffuserdata._id, affAmount, function (res) {
					//	serverLog(stateOfX.serverLogType.info, 'get after rake update'+res)
					//drcrease company bal
					managecompanyrakebal(affAmount, function (res) {
						//manage admin transaction histroy
						admindata.transactionid = params.transactionid;
						admindata.transactionByUserid = params.playerId;
						admindata.transactionByName = params.userName;
						admindata.transactionByRole = 'Player';
						admindata.transactionToName = 'Company';
						admindata.transactionToRole = 'admin';
						admindata.transactionToAmount = affAmount;
						admindata.fundtransactionType = 'Credit';
						admindata.transactionReason = 'Rake';
						admindata.transactionAction = 'Completed';
						admindata.transactionStatus = "Completed";
						admindata.addeddate = new Date().getTime();
						transactionhistroy(admindata, function (res) {

						});
					});
					//manage fund rake from table
					serverLog(stateOfX.serverLogType.info, 'paramsparamsparamsparams', JSON.stringify(params));
					var fundrake = {};
					fundrake.rakeRefType = params.rakeRefType;
					fundrake.rakeRefVariation = params.rakeRefVariation;
					fundrake.channelId = params.channelId;
					fundrake.channelName = params.channelName;
					fundrake.rakeRefSubType = params.rakeRefSubType;
					fundrake.rakeRefId = params.rakeRefId;
					fundrake.transactionid = params.transactionid;
					fundrake.rakeByUserid = params.playerId;
					fundrake.rakeByName = params.firstName + " " + params.lastName;
					fundrake.megaCircle = params.statistics.megaPointLevel;
					fundrake.megaPoints = params.statistics.megaPoints;
					fundrake.rakeByUsername = params.userName;
					fundrake.amount = params.playerRakeOriginalBeforGST;
					fundrake.amountGST = params.playerRakeOriginal;
					var tempAmount = Number(params.playerRakeOriginal - affAmount - params.playerRakeBack);
					fundrake.debitToCompany = tempAmount;
					fundrake.debitToAffiliateid = (subaffuserdata._id).toString();
					fundrake.debitToAffiliatename = subaffuserdata.userName;
					fundrake.debitToAffiliateamount = affAmount;
					if (params.playerRakeBack > 0) {
						fundrake.playerRakeBack = params.playerRakeBack;
						fundrake.playerRakeBackPercent = params.rakeBack;
						params.parentUserType = "Affiliate";
					}
					fundrake.addeddate = new Date().getTime();
					managerakefund(fundrake, function (res) { });
					callback(null, params);
				});

			});

		}
	});
};

// create Player RakeBack For Player
// insert record
var processPlayerRakeBack = function (params, cb) {
	serverLog(stateOfX.serverLogType.info, 'processPlayerRakeBack', JSON.stringify(params));
	var playerRakeBackData = {};
	playerRakeBackData.rakeByUserid = params.playerId;
	playerRakeBackData.rakeByName = params.firstName + " " + params.lastName;
	playerRakeBackData.rakeByUsername = params.userName;
	playerRakeBackData.amount = params.playerRakeOriginalBeforGST;
	playerRakeBackData.amountGST = params.playerRakeOriginal;
	playerRakeBackData.rakeBack = params.rakeBack;
	playerRakeBackData.playerRakeBack = params.playerRakeBack;
	playerRakeBackData.addedDate = dateToEpoch(Number(new Date())); //+ 21600000;
	playerRakeBackData.parentUser = params.isParentUserName;
	playerRakeBackData.handsPlayed = 1;
	playerRakeBackData.emailId = params.emailId;
	playerRakeBackData.referenceNumber = shortid.generate().toUpperCase();
	playerRakeBackData.isBot = params.isBot;
	playerRakeBackData.tableId = params.channelId;
	playerRakeBackData.handId = params.handId;
	playerRakeBackData.GameType = params.GameType;
	playerRakeBackData.TableName = params.TableName;

	if (params.playerRakeBack > 0) {
		playerRakeBackData.playerRakeBack = params.playerRakeBack;
		managecompanyrakebal(params.playerRakeBack, function (res) {
			financeDB.playerRakeBack(playerRakeBackData, function (err, result) {
				// cb(null, params);
				if (!err && result) {
					
				}

			});
		});
		
	} else { 
		// cb(null, params);
	}
	if(playerRakeBackData.amount > 0) {
		rakeRegister.registerRakeback(playerRakeBackData, function (rakeData) {
			cb(null, params);
		}) 
	} else {
		cb(null, params)
	}
};

// convert date to seconds
function dateToEpoch(thedate) {
	var time = thedate;
	return time - (time % 86400000);
}



// distribute rake - main function
// process GST, player rake back,
// rake to sub affiliate
// rake to affiliate
// rake to admin
var distributeRake = function (params, cb) {
	serverLog(stateOfX.serverLogType.info, 'params.rakeToAffiliates - ' + JSON.stringify(params.rakeToAffiliates));
	//console.error("1111111111111111!!!!!!!!!!!!!!!!!!!!!!@@@@@@@@@@@@@@@",params.table);
	params.loyalityList = [];
	var playerdata = params.rakeToAffiliates.players;
	serverLog(stateOfX.serverLogType.info, 'player length' + playerdata.length);
	if (playerdata.length > 0) {
		async.eachSeries(playerdata, function (playerdetails, callback) {
			playerdetails.rakeRefType = params.rakeToAffiliates.rakeRefType;
			playerdetails.rakeRefVariation = params.rakeToAffiliates.rakeRefVariation;
			playerdetails.rakeRefSubType = params.rakeToAffiliates.rakeRefSubType;
			playerdetails.rakeRefId = params.rakeToAffiliates.rakeRefId;
			playerdetails.channelId = params.table.channelId;
			playerdetails.channelName = params.table.channelName;
			playerdetails.rakeAmount1 = playerdetails.rakeAmount;
			playerdetails.rakeAmountOriginal1 = playerdetails.rakeAmountOriginal;
			playerdetails.handId = params.table.roundNumber;
			playerdetails.GameType = params.table.gameInfo.GameVariation;
			playerdetails.TableName = params.table.gameInfo.TableName;

			serverLog(stateOfX.serverLogType.info, 'transactionid transactionidtransactionid' + JSON.stringify(playerdetails));
			async.waterfall([

				async.apply(findPlayerParentforRake, playerdetails),
				chkProcessforRake,
				processRaketoAffiliate,

				processPlayerRakeBack,
				// chkLoyalityPointOfPlayer
			], function (err, rakeResult) {

				serverLog(stateOfX.serverLogType.info, 'err and result in waterfall');
				serverLog(stateOfX.serverLogType.error, JSON.stringify(err));
				serverLog(stateOfX.serverLogType.info, "loyalityListAmount is - " + JSON.stringify(rakeResult));
				if (err) {
					if (err.success) {
						// callback(null, {status: true, info: "Commission Distributed !!"});
						callback(null, { status: true, info: messages.COMMISIONDISTRIBUTION_SUCCESS_REWARDRAKE, isRetry: false, isDisplay: false, channelId: "" });
					} else {
						// callback({status: false, info:"Commission Distribution failed !! - " + JSON.stringify(err)});
						callback({ status: false, info: messages.COMMISIONDISTRIBUTION_FAILED_REWARDRAKE + JSON.stringify(err), isRetry: false, isDisplay: false, channelId: "" });
					}
				} else {
					// cb(result);
					var loyalityPlayer = !!rakeResult.result && rakeResult.result.loyalityListAmount && rakeResult.result.loyalityListAmount.length > 0 ? rakeResult.result.loyalityListAmount[0] : {};
					serverLog(stateOfX.serverLogType.info, "loyality player is -" + JSON.stringify(loyalityPlayer));
					if (!!loyalityPlayer && Object.keys(loyalityPlayer).length > 0) {
						params.loyalityList.push(loyalityPlayer);
					}
					// callback(null, {status: true, info: "Commission Distributed !!"});
					callback(null, { status: true, info: messages.COMMISIONDISTRIBUTION_SUCCESS_REWARDRAKE, isRetry: false, isDisplay: false, channelId: "" });
				}
			});


		}, function (err) {
			if (err) {
				serverLog(stateOfX.serverLogType.info, 'error on rakeCommision' + JSON.stringify(err));
				// cb({status:false, info:"Error occurred while commission distribution !!"})
				cb({ status: false, info: messages.DISTRIBUTERAKE_FAILED_REWARDRAKE, isRetry: false, isDisplay: false, channelId: "" });
			} else {
				serverLog(stateOfX.serverLogType.info, 'commission updated & manage transaction histroy for admin');
				//transaction histroy for admin bal
				cb(null, params);
			}
		});
	} else {
		serverLog(stateOfX.serverLogType.info, 'No players passed for rake calculation, skipping.');
		cb(null, params);
	}
};

// find player parent
// may be sub affiliate
// may be affiliate
// if none then admin
var findPlayerParentforRake = function (params, callback) {
	serverLog(stateOfX.serverLogType.info, 'Player info' + JSON.stringify(params));
	var player = {};
	player.playerId = params.playerId;
	db.findUser(player, function (err, result) {
		if (err) {
			callback({ success: false, info: dbMessages.DB_FINDUSER_FAILED_REWARDRAKE, isRetry: false, isDisplay: true, channelId: "" });
		} else {
			result.playerRake = params.rakeAmount1;
			result.playerRakeBeforGST = params.rakeAmount;
			result.playerRakeOriginal = params.rakeAmountOriginal1;
			result.playerRakeOriginalBeforGST = params.rakeAmountOriginal;
			result.transactionid = uuid.v4();
			result.rakeRefType = params.rakeRefType;
			result.rakeRefVariation = params.rakeRefVariation;
			result.rakeRefSubType = params.rakeRefSubType;
			result.rakeRefId = params.rakeRefId;
			result.channelId = params.channelId;
			result.channelName = params.channelName;
			result.handId = params.handId;
			result.GameType = params.GameType;
			result.TableName = params.TableName;
			serverLog(stateOfX.serverLogType.info, 'params result', JSON.stringify(result));
			params.result = result;
			//console.log(params.result);
			//console.log(result);
			callback(null, params);
		}
	});
};

// check process for rake, admin, affiliate or sub affiliate needs to process
var chkProcessforRake = function (params, callback) {
	serverLog(stateOfX.serverLogType.info, 'chkProcessforRake    ', JSON.stringify(params));
	//if user has parent then rake will be distributed on affiliate & sub aff also
	//if (params.isParent) {
	//	callback(null, params);
	//	} else {
	//process to directly to admin on transaction histroy
	//console.error("!!!!!!!!!!!!!!!!!!!!!!@@@@@@@@@@@@@@@",params);
	var admindata = {};
	var params = params.result;
	var adminAmount = params.playerRake;
	var adminAmountOriginal = params.playerRakeOriginal;
	admindata.transactionid = params.transactionid;
	admindata.transactionByUserid = params.playerId;
	admindata.transactionByName = params.userName;
	admindata.transactionByRole = 'Player';

	admindata.transactionToName = 'admin';
	admindata.transactionToRole = 'admin';
	admindata.transactionToAmount = adminAmount;
	admindata.fundtransactionType = 'Debit';
	admindata.transactionReason = 'Rake';
	admindata.transactionAction = 'Completed';
	admindata.transactionStatus = "Completed";
	admindata.addeddate = new Date().getTime();
	transactionhistroy(admindata, function (res) {
		//serverLog(stateOfX.serverLogType.info, '!!!!!!!!!!!!!!!!!!!!!'+JSON.stringify('res'))
		//process to balance on Company account
		//var CompanyId = '57bfcebef29de70c75a30659';
		//	serverLog(stateOfX.serverLogType.info, '@@@@@@@@@@@@@@@@@@@@@'+JSON.stringify(res));
		//console.error(params);
		if (!!params.rakeBack) {
			console.error("!!!!!!!!!!!@@@@@@@@@@##########$$$$$$$$$$$$$$$$$$$$");
			console.error(params.rakeBack);

		} else {
			params.rakeBack = 0;
			console.error("################################################");

		}
		if (params.isParentUserName) {
			var compbal = {};
			compbal.balance = adminAmountOriginal;
			managecompanybal(compbal, function (res) {
				callback(null, params);
			});
		} else {
			//manage fund rake for admin
			if (params.rakeBack > 0) {
				var playerRakeBackTemp = (adminAmountOriginal * params.rakeBack) / 100;
				params.playerRakeBack = fixedDecimal(playerRakeBackTemp);
			} else {
				params.playerRakeBack = 0;
			}
			var compbal = {};
			compbal.balance = adminAmountOriginal;
			managecompanybal(compbal, function (res) {
				var fundrake = {};
				fundrake.rakeRefType = params.rakeRefType;
				fundrake.rakeRefVariation = params.rakeRefVariation;
				fundrake.rakeRefSubType = params.rakeRefSubType;
				fundrake.channelId = params.channelId;
				fundrake.channelName = params.channelName;
				fundrake.transactionid = params.transactionid;
				fundrake.rakeByUserid = params.playerId;
				fundrake.rakeByName = params.firstName + " " + params.lastName;
				fundrake.megaCircle = params.statistics.megaPointLevel;
				fundrake.megaPoints = params.statistics.megaPoints;
				fundrake.rakeByUsername = params.userName;
				if (params.playerRakeBack > 0) {
					fundrake.playerRakeBack = params.playerRakeBack;
					fundrake.playerRakeBackPercent = params.rakeBack;
					params.parentUserType = "N/A";
				}
				fundrake.amount = params.playerRakeOriginalBeforGST;
				fundrake.amountGST = params.playerRakeOriginal;
				fundrake.debitToCompany = adminAmountOriginal - params.playerRakeBack;
				fundrake.addeddate = new Date().getTime();
				managerakefund(fundrake, function (res) {
					//callback(res);
					callback(null, params);
				});
			});
		}
	});
	//}
};

// insert recod transaction history
var transactionhistroy = function (data, callback) {
	serverLog(stateOfX.serverLogType.info, 'transactionhistroy data' + JSON.stringify(data));
	financeDB.fundtransferhistroy(data, function (err, result) {
		if (err) {
			// callback({success: false, info: "Something went wrong"})
			callback({ success: false, info: dbMessages.DB_FUNDTRANSFERHISTROY_FAILED_REWARDRAKE, isRetry: false, isDisplay: true, channelId: "" });
		} else {
			// callback({success: true, info: "fund successfully transfered"});
			callback({ success: true, info: dbMessages.DB_FUNDTRANSFERHISTROY_SUCCESS_REWARDRAKE, isRetry: false, isDisplay: true, channelId: "" });
		}
	});
};

// insert record fund rake for company, affiliate & sub affiliate to manage report
var managerakefund = function (data, callback) {
	financeDB.fundrake(data, function (err, result) {
		if (err) {
			// callback({success: false, info: "Something went wrong"});
			callback({ success: false, info: dbMessages.DB_FUNDRAKE_FAILED_REWARDRAKE, isRetry: false, isDisplay: true, channelId: "" });
		} else {
			// callback({success: true, info: "Rake fund submitted successfully"});
			callback({ success: true, info: dbMessages.DB_FUNDRAKE_SUCCESS_REWARDRAKE, isRetry: false, isDisplay: false, channelId: "" });
		}
	});
};

// manage affiliate & sub-affiliate rake balance
var manageaffandsubaffrakebal = function (userid, balance, callback) {
	//serverLog(stateOfX.serverLogType.info, 'manageaffandsubaffbal'+JSON.stringify(userid)+'balance'+balance);
	var userbal = {};
	// userbal.balance = balance;         // old value
	// userbal.rakebalance = balance;	 // old value

	userbal.profit = balance;
	manageaffiliatebal(userid, userbal, function (res) {
		callback(null, res);
	});

};

// update balance of affiliate
var manageaffiliatebal = function (userid, data, callback) {
	admindb.updateteAffiliateRakeBalance(data, userid, function (err, result) {
		if (err) {
			// callback({success: false, info:"Something went wrong"});
			callback({ success: false, info: dbMessages.DB_UPDATETEAFFILIATERAKEBALANCE_FAILED_REWARDRAKE, isRetry: false, isDisplay: true, channelId: "" });
		} else {
			callback({ success: true, info: dbMessages.DB_UPDATETEAFFILIATERAKEBALANCE_SUCCESS_REWARDRAKE, isRetry: false, isDisplay: false, channelId: "" });
		}
	});
};

// decrease company rake balance after process rake commision of affiliate or sub affiliate
var managecompanyrakebal = function (balance, callback) {
	var bal = {};
	bal.balance = -balance;
	bal.rakebalance = -balance;
	managecompanybalNegative(bal, function (res) {
		callback(res);
	});
};

// decrease company chips
var managecompanychipsbal = function (balance, callback) {
	var bal = {};
	bal.balance = -balance;
	bal.chipsbalance = -balance;
	managecompanybalNegative(bal, function (res) {
		callback(res);
	});
};

// update company balance 
var managecompanybal = function (balancedata, callback) {
	var data = { $inc: { "profit": balancedata.balance } };
	financeDB.updateBalanceSheet(data, function (err, result) {
		if (err) {
			callback({ success: false, info: dbMessages.DB_COMPANYRAKEBALANCE_FAILED_REWARDRAKE, isRetry: false, isDisplay: true, channelId: "" });
		} else {
			callback({ success: true, info: dbMessages.DB_COMPANYRAKEBALANCE_SUCCESS_REWARDRAKE, isRetry: false, isDisplay: false, channelId: "" });
		}
	});
};

// update company balance
// decrease
var managecompanybalNegative = function (balancedata, callback) {
	var data = { $inc: { "profit": balancedata.balance } };
	financeDB.updateBalanceSheet(data, function (err, result) {
		if (err) {
			callback({ success: false, info: dbMessages.DB_COMPANYRAKEBALANCE_FAILED_REWARDRAKE, isRetry: false, isDisplay: true, channelId: "" });
		} else {
			callback({ success: true, info: dbMessages.DB_COMPANYRAKEBALANCE_SUCCESS_REWARDRAKE, isRetry: false, isDisplay: false, channelId: "" });
		}
	});
};

// set input keys
// find refund amount if any
// find rake-able amount
var setInputKeysNormal = function (params, cb) {
	params.rakeToAffiliates.rakeRefId = params.channelId;
	params.rakeToAffiliates.rakeRefType = stateOfX.gameType.normal;
	params.rakeToAffiliates.rakeRefVariation = params.table.channelVariation;
	params.rakeToAffiliates.rakeRefSubType = "";
	params.rakeToAffiliates.players = [];
	params.rakeToAffiliates.players1 = [];
	serverLog(stateOfX.serverLogType.info, 'Rake details - ' + JSON.stringify(params));
	// EXPECTED ISSUE: Here the totalRake in rakedetails is the sum of rake actually deducted from each pot and rakeFromTable is 
	// the rake which is to be deducted in the game. So if rake deducted from pot is greater than rakeFromTable then we are using rakeFromTable whose 
	// amount is less
	// FIX: Removed this condition of game
	// Digvijay Rathore 20 Dec 2019
	// if (params.rakeDetails.totalRake > params.rakeFromTable) {
	// 	params.rakeDetails.totalRake = params.rakeFromTable;
	// }
	var playerContribution = 0;
	console.error("@!@!@!@!@!@!@!@!@!@!@"+ JSON.stringify(params));
	var contributions = JSON.parse(JSON.stringify(params.table.contributors));
	var maxCont = -1, secondMaxCont = -1, maxPlayerId = null;
	if (contributions[0].amount > contributions[1].amount) {
		secondMaxCont = contributions[1].amount;
		maxCont = contributions[0].amount;
		maxPlayerId = contributions[0].playerId;
	} else {
		secondMaxCont = contributions[0].amount;
		maxCont = contributions[1].amount;
		maxPlayerId = contributions[1].playerId;
	}
	for (var i = 0; i < contributions.length; i++) {
		if (i >= 2 && contributions[i].amount >= maxCont) {
			secondMaxCont = maxCont;
			maxCont = contributions[i].amount;
			maxPlayerId = contributions[i].playerId;
		} else if (i >= 2 && contributions[i].amount >= secondMaxCont) {
			secondMaxCont = contributions[i].amount;
		}
	}
	var refundedAmt = (maxCont - secondMaxCont);
	_.findWhere(contributions, { playerId: maxPlayerId }).amount -= refundedAmt;
	console.error("--------WWWWWWWWW"+ contributions);
	// for(var alpha = 0 ; alpha < params.data.decisionParams.length; alpha++){
	let rakeFromPlayersForAnalytics = 0; // temp for checking rake is correctly distributed
	for (var beta = 0; beta < contributions.length; beta++) {
		console.log("params.rakeDetails.totalRake "+params.rakeDetails.totalRake);
		console.log("params.potAmount "+params.potAmount);
		var playerRakeTemp = params.rakeDetails.totalRake * (contributions[beta].amount / params.potAmount);
		// var tempAmount1 = (Math.ceil(playerRakeTemp)-playerRakeTemp==0.5 && Math.ceil(playerRakeTemp)%2 != 0) ? Math.floor(playerRakeTemp) : Math.round(playerRakeTemp);
		var tempAmount1 = fixedDecimal(playerRakeTemp);
		params.rakeToAffiliates.players.push({
			playerId: contributions[beta].playerId,
			rakeAmount: tempAmount1,
			rakeAmountOriginal: playerRakeTemp
		});
		rakeFromPlayersForAnalytics += tempAmount1;
	}
	// temp for checking rake is correctly distributed
	// Digvijay Rathore 20 Dec 2019
	var difference = Math.round((params.rakeDetails.totalRake - Math.round(rakeFromPlayersForAnalytics * 100) / 100) * 100) / 100;
	if (difference <= 0.01){
		console.log("Rake amount same both dedcuted on table and going to distribute in analytics");
	}else{
		console.log("Rake amount not same for dedcuted on table and going to distribute n analytics");
		var data = { params: params, difference: difference};
		process.emit('forceMail', { title: "for rakeDistribution in Analytics", data: data });
	}

	// }

	/*console.error("@!@!@!@!@@!^&^&^&^&^&^",JSON.stringify(params));*/
	cb(null, params);
	// async.each(params.table.contributors, function(contributor, ecb) {
	// 	serverLog(stateOfX.serverLogType.info, 'Processing contributor - ' + JSON.stringify(contributor));
	// 		params.rakeToAffiliates.players.push({
	// 			playerId		: contributor.playerId,
	// 			rakeAmount	: params.rakeDetails.totalRake * ( contributor.amount / params.potAmount)
	// 		});
	// 	ecb()
	// }, function(err) {
	// 	if(!err) {
	// 		cb(null, params);
	// 	} else {
	// 		cb(err);
	// 	}
	// });
};

// process rake distribution from table pots
// awarded to parents of players
// affiliates and/or sub-affiliates and admin
rewardRake.processRakeDistribution = function (params, cb) {
	serverLog(stateOfX.serverLogType.info, 'In rewardRake function processRakeDistribution');
	serverLog(stateOfX.serverLogType.info, "=========== RAKE DISTRIBUTION STARTED ===========");
	params.rakeToAffiliates = {};
	async.waterfall([

		async.apply(setInputKeysNormal, params),
		distributeRake

	], function (err, response) {
		serverLog(stateOfX.serverLogType.info, "=========== RAKE DISTRIBUTION FINISHED ===========");
		cb(err, response);
	});
};

// tournament
var getTournamentRoom = function (params, cb) {
	serverLog(stateOfX.serverLogType.info, "in get tournament room in tournament rake " + JSON.stringify(params));
	db.getTournamentRoom((params.tournamentId).toString(), function (err, tournamentRoom) {
		serverLog(stateOfX.serverLogType.info, "tournament room is - " + JSON.stringify(tournamentRoom));
		if (err || !tournamentRoom) {
			// cb({success : false, info: "Error in getting tournament Room"});
			cb({ success: false, info: dbMessages.DB_GETTOURNAMENTROOM_FAILED_REWARDRAKE, isRetry: false, isDisplay: false, channelId: "" });
		} else {
			params.rakeAmount = tournamentRoom.housefees;
			params.rakeRefId = params.tournamentId;
			params.rakeRefType = stateOfX.gameType.tournament;
			params.rakeRefVariation = tournamentRoom.channelVariation;
			params.rakeRefSubType = tournamentRoom.tournamentType;
			params.gameVersionCount = tournamentRoom.gameVersionCount;
			cb(null, params);
		}
	});
};

// tournament
var getTournamentUsers = function (params, cb) {
	serverLog(stateOfX.serverLogType.info, " in get tournament users" + JSON.stringify(params));
	db.findTournamentUser({ tournamentId: params.tournamentId, gameVersionCount: params.gameVersionCount }, function (err, result) {
		if (err) {
			// cb({success: false, info: "Error in getting tournamentUser"});
			cb({ success: false, info: dbMessages.DB_FINDTOURNAMENTUSER_FAILED_REWARDRAKE, isRetry: false, isDisplay: false, channelId: "" });
		} else {
			if (!!result) {
				var playerIds = _.pluck(result, 'playerId');
				params.playerIds = playerIds;
				cb(null, params);
			} else {
				// cb({success: false, info: "No tournament users for this this tournament"});
				cb({ success: false, info: dbMessages.DB_FINDTOURNAMENTUSER_NOUSER_REWARDRAKE, isRetry: false, isDisplay: true, channelId: "" });
			}
		}
	});
};

// tournament
var createResponse = function (params, cb) {
	serverLog(stateOfX.serverLogType.info, " in get createResponse " + JSON.stringify(params));
	serverLog(stateOfX.serverLogType.info, " playerIds in get createResponse " + JSON.stringify(params.playerIds.length));
	var tempData = [];
	for (var playerIt = 0; playerIt < params.playerIds.length; playerIt++) {
		tempData.push({
			playerId: params.playerIds[playerIt],
			rakeAmount: params.rakeAmount
		});
	}
	serverLog(stateOfX.serverLogType.info, "temp data in create response in tournamentRake is - " + JSON.stringify(tempData));
	var result = {};
	result.rakeToAffiliates = {
		rakeRefId: params.rakeRefId,
		rakeRefType: params.rakeRefType,
		rakeRefVariation: params.rakeRefVariation,
		rakeRefSubType: params.rakeRefSubType,
		players: tempData
	};
	serverLog(stateOfX.serverLogType.info, "create response in tournament rake process - " + JSON.stringify(result));
	cb(null, result);
};

// tournament
rewardRake.tournamentRakeProcess = function (params, cb) {
	serverLog(stateOfX.serverLogType.info, "in tournament rake process - ", JSON.stringify(params));
	async.waterfall([
		async.apply(getTournamentRoom, params),
		getTournamentUsers,
		createResponse,
		distributeRake
	], function (err, response) {
		if (err) {
			serverLog(stateOfX.serverLogType.info, "Error occured in tournament rake process");
			cb(err);
		} else {
			cb({ success: true, result: response });
		}
	});
};

module.exports = rewardRake;
