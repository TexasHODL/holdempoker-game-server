/*jshint node: true */
"use strict";

var mongodb = require('../mongodbConnection');
var ObjectID = require('mongodb').ObjectID;
var shortid = require('shortid');
var postData = require('../postData.js');


// remote.customFunction = function(query, cb){
// 	console.log("inside customFunction,,, ", query);
// 	mongodb.adminDb.collection('newCollection').insert({query: query},function(err, result) {
// 		console.log("err, result====", err, result);
// 		cb(err, result);
// 	});
// }

var remote = {};

remote.findTransactionHistoryByInvoiceId = function(invoiceId, cb) {
	mongodb.adminDb.collection('transactionHistory').findOne({invoiceId}, function(err, result){
		console.log("err, result====", err, result);
		cb(err, result);
	})
}

remote.getUserCashoutPending = function (query, cb) {
	console.log("Inside getUserCashoutPending db query -->", query);
	mongodb.adminDb.collection('pendingCashOutRequest').aggregate([{ $match: query }, { $group: { _id: "_id", netAmountPending: { $sum: "$netAmount" } } }]).toArray(function (err, result) {
		console.log("Inside getUserCashoutPending err,result-->\n", err, result);
		cb(err, result);
	});
};

/*---Balance sheet mgmt queries starts here--*/

remote.getTotalChipsPulledSubAgentByAdminApproved = function (query, cb) {
	console.log("Inside getTotalChipsPulledSubAgentByAdminApproved db query -->", query);
	mongodb.adminDb.collection('cashoutHistory').aggregate([{ $match: query }, { $group: { _id: "$tdsType", requestedAmount: { $sum: "$requestedAmount" } } }]).toArray(function (err, result) {
		console.log("Inside getTotalChipsPulledSubAgentByAdminApproved err,result-->\n", err, result);
		cb(err, result);
	});
};

remote.getTotalChipsPulledSubAgentByAdminInPending = function (query, cb) {
	console.log("Inside getTotalChipsPulledSubAgentByAdminInPending db query -->", query);
	mongodb.adminDb.collection('pendingCashOutRequest').aggregate([{ $match: query }, { $group: { _id: "$tdsType", requestedAmount: { $sum: "$requestedAmount" } } }]).toArray(function (err, result) {
		console.log("Inside getTotalChipsPulledSubAgentByAdminInPending err,result-->\n", err, result);
		cb(err, result);
	});
};

remote.getTotalChipsPulledSubAgentByAdminInApproved = function (query, cb) {
	console.log("Inside getTotalChipsPulledSubAgentByAdminInApproved db query -->", query);
	mongodb.adminDb.collection('approveCashOutRequest').aggregate([{ $match: query }, { $group: { _id: "$tdsType", requestedAmount: { $sum: "$requestedAmount" } } }]).toArray(function (err, result) {
		console.log("Inside getTotalChipsPulledSubAgentByAdminInApproved err,result-->\n", err, result);
		cb(err, result);
	});
};

remote.getAllCashoutDetailsToAdminInApproved = function (query, cb) {
	console.log("Inside getAllCashoutDetailsToAdminInApproved db query -->", query);
	mongodb.adminDb.collection('approveCashOutRequest').aggregate([{ $match: query }, { $group: { _id: "$profile", amountRequested: { $sum: "$requestedAmount" }, totalTDS: { $sum: "$tds" }, totalProcessingFees: { $sum: "$processingFees" }, totalNetAmount: { $sum: "$netAmount" } } }]).toArray(function (err, result) {
		console.log("Inside getAllCashoutDetailsToAdminInApproved err,result-->\n", err, result);
		cb(err, result);
	});
};

remote.getAllCashoutDetailsToAdminInPending = function (query, cb) {
	console.log("Inside getAllCashoutDetailsToAdminInPending db query -->", query);
	mongodb.adminDb.collection('pendingCashOutRequest').aggregate([{ $match: query }, { $group: { _id: "$profile", amountRequested: { $sum: "$requestedAmount" }, totalTDS: { $sum: "$tds" }, totalProcessingFees: { $sum: "$processingFees" }, totalNetAmount: { $sum: "$netAmount" } } }]).toArray(function (err, result) {
		console.log("Inside getAllCashoutDetailsToAdminInPending err,result-->\n", err, result);
		cb(err, result);
	});
};

remote.getAffCashoutSuccessDetails = function (query, cb) {
	console.log("Inside getAffCashoutSuccessDetails db query -->", query);
	mongodb.adminDb.collection('cashoutHistory').aggregate([{ $match: query }, { $group: { _id: "_id", totalRequestedAmount: { $sum: "$requestedAmount" }, totalTDS: { $sum: "$tds" }, totalProcessingFees: { $sum: "$processingFees" }, totalNetAmount: { $sum: "$netAmount" } } }]).toArray(function (err, result) {
		console.log("Inside getAffCashoutSuccessDetails err,result-->\n", err, result);
		cb(err, result);
	});
};

remote.getUserCashoutSuccessDetails = function (query, groupBy, cb) {
	console.log("Inside getPlayerCashoutSuccessDetails db query -->", query);
	mongodb.adminDb.collection('cashoutHistory').aggregate([{ $match: query }, { $group: { _id: groupBy, totalRequestedAmount: { $sum: "$requestedAmount" }, totalTDS: { $sum: "$tds" }, totalProcessingFees: { $sum: "$processingFees" }, totalNetAmount: { $sum: "$netAmount" } } }]).toArray(function (err, result) {
		console.log("Inside getPlayerCashoutSuccessDetails err,result-->\n", err, result);
		cb(err, result);
	});
};


remote.getTotalOnlineTransfer = function (query, cb) {
	console.log("Inside getTotalOnlineTransfer db query -->", query);
	mongodb.adminDb.collection('transactionHistory').aggregate([{ $match: query }, { $group: { _id: "_id", totalOnlineTransfer: { $sum: "$amount" } } }]).toArray(function (err, result) {
		console.log("Inside getTotalOnlineTransfer err,result-->\n", err, result);
		cb(err, result);
	});
};

remote.getPlayerSucessCashoutsToAgent = function (query, cb) {
	console.log("Inside getPlayerSucessCashoutsToAgent db query -->", query);
	mongodb.adminDb.collection('directCashoutHistory').aggregate([{ $match: query }, { $group: { _id: "_id", amount: { $sum: "$amount" }, requestedAmount: { $sum: "$requestedAmount" } } }]).toArray(function (err, result) {
		console.log("Inside getPlayerSucessCashoutsToAgent err,result-->\n", err, result);
		cb(err, result);
	});
};

remote.getSubAgentApprovedCashoutsToAgent = function (query, cb) {
	console.log("Inside getSubAgentApprovedCashoutsToAgent db query -->", query);
	mongodb.adminDb.collection('directCashoutHistory').aggregate([{ $match: query }, { $group: { _id: "$type", amount: { $sum: "$amount" } } }]).toArray(function (err, result) {
		console.log("Inside getSubAgentApprovedCashoutsToAgent err,result-->\n", err, result);
		cb(err, result);
	});
};

remote.getPlayerPendingCashoutsToAgent = function (query, cb) {
	console.log("Inside getPlayerPendingCashoutsToAgent db query -->", query);
	mongodb.adminDb.collection('cashoutDirect').aggregate([{ $match: query }, { $group: { _id: "_id", requestedAmount: { $sum: '$requestedAmount' }, amount: { $sum: "$amount" } } }]).toArray(function (err, result) {
		console.log("Inside getPlayerPendingCashoutsToAgent err,result-->\n", err, result);
		cb(err, result);
	});
};

remote.getSubAgentPendingCashoutsToAgent = function (query, cb) {
	console.log("Inside getSubAgentPendingCashoutsToAgent db query -->", query);
	mongodb.adminDb.collection('cashoutDirect').aggregate([{ $match: query }, { $group: { _id: "$type", amount: { $sum: '$amount' } } }]).toArray(function (err, result) {
		console.log("Inside getSubAgentPendingCashoutsToAgent err,result-->\n", err, result);
		cb(err, result);
	});
};

remote.getUsersForRakeGeneratedData = function (query, cb) {
	console.log("Inside getUsersForRakeGeneratedData db query -->", query);
	mongodb.adminDb.collection('affiliates').aggregate([{ $match: { $and: [{ "role.name": { $ne: "admin" } }, { "role.name": { $ne: "General Manager" } }, { "role.name": { $ne: "Director" } }] } }, { $group: { _id: "$role.name", userDetails: { $push: '$userName' } } }]).toArray(function (err, result) {
		console.log("Inside getUsersForRakeGeneratedData err,result-->\n", err, result);
		cb(err, result);
	});
};

remote.getUserAvailableRakeData = function (query, cb) {
	console.log("Inside getUserAvailableRakeData db query -->", query);
	mongodb.adminDb.collection('affiliates').aggregate([{ $match: { $and: [{ "role.name": { $ne: "admin" } }, { "role.name": { $ne: "General Manager" } }, { "role.name": { $ne: "Director" } }] } }, { $group: { _id: "$role.name", totalAvailableRake: { $sum: '$profit' } } }]).toArray(function (err, result) {
		console.log("Inside getUserAvailableRakeData err,result-->\n", err, result);
		cb(err, result);
	});
};

remote.findFundTransferToPlayerByAgent = function (query, cb) {
	console.log("Inside findFundTransferToPlayerByAgent db query -->", query);
	mongodb.adminDb.collection('chipstransferToPlayerHistory').aggregate([{ $match: query }, { $group: { _id: "_id", amountTransferredToPlayer: { $sum: '$amount' } } }]).toArray(function (err, result) {
		cb(err, result);
	});
};

remote.findFundTransferToPlayerByLevel = function (query, cb) {
	mongodb.adminDb.collection('chipstransferToPlayerHistory').aggregate([{ $group: { "_id": "$role.level", "amount": { $sum: "$amount" } } }]).toArray(function (err, result) {
		console.log("Lone wolf", result);
		cb(err, result);
	});
};


remote.findTotalFundTransferToAgent = function (query, cb) {
	console.log("Inside findTotalFundTransferToAgent db query -->", query);
	mongodb.adminDb.collection('chipsTransferToAffiliateHistory').aggregate([{ $match: query }, { $group: { _id: "_id", totalAmountTransferredToAgent: { $sum: '$amount' } } }]).toArray(function (err, result) {
		console.log("Inside findTotalFundTransferToAgent err,result-->\n", err, result);
		cb(err, result);
	});
};

/*---Balance sheet mgmt queries ends here--*/

remote.createInstantChipsPulledHistory = function (query, cb) {
	mongodb.adminDb.collection('instantChipsPulledHistory').insert(query, function (err, result) {
		console.log("err, result====", err, result);
		cb(err, result);
	});
};

remote.getInstantChipsPulledHistoryCount = function (query, cb) {
	console.log("inside getInstantChipsPulledHistoryCount,,, ", query);
	mongodb.adminDb.collection('instantChipsPulledHistory').count(query, function (err, result) {
		cb(err, result);
	});
};

remote.listInstantChipsPulledHistory = function (query, cb) {
	console.log("inside listInstantChipsPulledHistory ", query);
	var skip = query.skip || 0;
	var limit = query.limit || 0;
	delete query.skip;
	delete query.limit;
	mongodb.adminDb.collection('instantChipsPulledHistory').find(query).sort({ pulledAt: -1 }).skip(skip).limit(limit).toArray(function (err, result) {
		console.log("result in listInstantChipsPulledHistory ", JSON.stringify(result));
		cb(err, result);
	});
};

remote.createScratchCard = function (query, cb) {
	mongodb.adminDb.collection('scratchCardPending').insert(query, function (err, result) {
		console.log("err, result====", err, result);
		cb(err, result);
	});
};

remote.insertPlayerParentHistory = function (query, cb) {
	mongodb.adminDb.collection('playerParentHistory').insert(query, function (err, result) {
		console.log("err, result====", err, result);
		cb(err, result);
	});
};

remote.countDataInPlayerParentHistory = function (query, cb) {
	console.log("inside countDataInPlayerParentHistory,,, ", query);
	mongodb.adminDb.collection('playerParentHistory').count(query, function (err, result) {
		cb(err, result);
	});
};

remote.listDataInPlayerParentHistory = function (query, cb) {
	console.log("inside listDataInPlayerParentHistory ", query);
	mongodb.adminDb.collection('playerParentHistory').find(query).sort({ updatedAt: -1 }).toArray(function (err, result) {
		console.log("result in listDataInPlayerParentHistory ", JSON.stringify(result));
		cb(err, result);
	});
};

remote.getPlayerPassbookCount = function (query, cb) {
	mongodb.adminDb.collection('passbook').aggregate([{
		$match: { "playerId": query.playerId }
	},
	{
		$project: {
			history: {
				$filter: {
					input: "$history",
					as: "item",
					cond: {
						$and: query.queryCond
					}
				}
			},
			"playerId": 1
		}
	}
	]).toArray(function (err, result) {
		console.log("Inside getPlayerPassbookCount err,result-->\n", err, result);
		cb(err, result);
	});
};

// query to create passbook entry of particular player
remote.createPassbookEntry = function (query, data, cb) {
	mongodb.adminDb.collection('passbook').update(query, { $push: { "history": data } }, { upsert: true }, function (err, result) {
		console.log("Inside createPassbookEntry db query err,res-->", err, result);
		cb(err, result);
	});
};

// // query get data from pending cashout history
// remote.findFromPendingCashout = function(query, cb){
//   mongodb.adminDb.collection('pendingCashOutRequest').find(query).toArray(function(err,result){
//     if(err){
//       cb(err,result);
//     }else{
//       cb(null,result[0]);
//     }
//   });
// };

remote.createPromoCode = function (query, cb) {
	mongodb.adminDb.collection('promoCodes').insert(query, function (err, result) {
		console.log("err, result====", err, result);
		cb(err, result);
	});
};

remote.findPromoCode = function (query, cb) {
	mongodb.adminDb.collection('promoCodes').findOne(query, function (err, result) {
		console.log("err, result====", err, result);
		cb(err, result);
	});
};

// get list of scratch cards count to approve
remote.getScratchCardListCount = function (query, cb) {
	console.log("inside get getScratchCardList,,, ", query);
	mongodb.adminDb.collection('scratchCardPending').count(query, function (err, result) {
		console.log(" count of scard to approve.............. ", JSON.stringify(result));
		cb(err, result);
	});
};

// get list of scratch cards
remote.getScratchCardList = function (query, cb) {
	console.log("inside get getScratchCardList,,, ", query);
	var skip = query.skip;
	var limit = query.limit;
	delete query.skip;
	delete query.limit;
	mongodb.adminDb.collection('scratchCardPending').find(query).skip(skip).limit(limit).sort({ createdAt: -1 }).toArray(function (err, result) {
		console.log("result in findUserArray ", JSON.stringify(result));
		cb(err, result);
	});
};

remote.getPendingScratchCards = function (query, cb) {
	console.log("inside get getPendingScratchCards,,, ", query);
	mongodb.adminDb.collection('scratchCardPending').find(query).toArray(function (err, result) {
		console.log("result in findUserArray ", JSON.stringify(result));
		cb(err, result);
	});
};

// remote.insertInHistory = function(query, cb){
// 	mongodb.adminDb.collection('scratchCardHistory').insert(query,function(err, result) {
// 		console.log("err, result====", err, result);
// 		cb(err, result);
// 	});
// }

remote.insertInHistory = function (query, cb) {
	// console.log("line 58 insertInHistory== ", query);
	mongodb.adminDb.collection('scratchCardHistory').insert(query, cb);
	// mongodb.adminDb.collection('scratchCardHistory').count({}, function(err, result){
	// 	console.log("line 61 adminDbQuery ", err, result);
	// 	if(!err){
	// 	}
	// 	else{
	// 		cb(err, result);
	// 	}
	// })
};

remote.removeScratchCard = function (query, cb) {
	console.log("line 73 adminDbQuery ", query);
	mongodb.adminDb.collection('scratchCardPending').deleteOne({ _id: ObjectID(query._id) }, function (err, result) {
		// console.log("line 76 err, result====", err, result);
		cb(err, result);
	});
};



remote.updateMultipleScratchCardHistory = function (query, updateKeys, cb) {
	// console.log("line 99 adminDbQuery ", query, updateKeys);
	mongodb.adminDb.collection('scratchCardHistory').update(query, { $set: updateKeys }, { multi: true }, function (err, result) {
		// console.log("line 76 err, result====", err, result);
		cb(err, result);
	});
};

// remote.createDepositHistory = function(query, cb){
//   console.log("inside createBonusHistory ", query);
//   mongodb.adminDb.collection('transactionHistory').insert(query, function(err, result) {
//     console.log("err, result====", err, result);
//     cb(err, result);
//   });
// }


// get scratch card history
remote.getScratchCardHistory = function (query, cb) {
	console.log("++++++++++++++++++++", query);
	var skip = query.skip || 0;
	var limit = query.limit || 0;
	var sortValue = query.sortValue;
	delete query.sortValue;
	delete query.skip;
	delete query.limit;
	console.log("++++++++++++++++++++", query);
	mongodb.adminDb.collection('scratchCardHistory').find(query).skip(skip).limit(limit).sort({ [sortValue]: -1 }).toArray(function (err, result) {
		// console.log("err, result====", err, result);
		cb(err, result);
	});
};

// get count of scratch card history
remote.getScratchCardHistoryCount = function (query, cb) {
	console.log("++++++++++++++++++++ count", query);
	mongodb.adminDb.collection('scratchCardHistory').count(query, function (err, result) {
		console.log("err, result scratch card count ====", err, result);
		cb(err, result);
	});
};

remote.countLeaderboardSets = function (query, cb) {
	if (query.leaderboardSetName) {
		query.leaderboardSetName = eval('/^' + query.leaderboardSetName + '$/i');
	}
	mongodb.adminDb.collection('leaderboardSet').count(query, function (err, result) {
		cb(err, result);
	});
};

remote.getLeaderboardSets = function (query, cb) {
	var skip = query.skip || 0;
	var limit = query.limit || 0;
	delete query.skip;
	delete query.limit;
	if (query.leaderboardSetName) {
		query.leaderboardSetName = eval('/^' + query.leaderboardSetName + '$/i');
	}
	mongodb.adminDb.collection('leaderboardSet').find(query).skip(skip).limit(limit).toArray(function (err, result) {
		cb(err, result);
	});
};

remote.createBonus = function (query, cb) {
	console.log("inside createBonus ", query);
	mongodb.adminDb.collection('bonusCollection').insert(query, function (err, result) {
		console.log("err, result====", err, result);
		cb(err, result);
	});
};

remote.updateBonus = function (query, updateKeys, cb) {
	console.log("inside updateBonus ", query);
	mongodb.adminDb.collection('bonusCollection').update(query, { $set: updateKeys }, function (err, result) {
		// console.log("err, result====", err, result);
		cb(err, result);
	});
};


remote.countBonus = function (query, cb) {
	console.log("inside find bounus ", query);
	mongodb.adminDb.collection('bonusCollection').count(query, function (err, result) {
		console.log("result in find bounus ", JSON.stringify(result));
		cb(err, result);
	});
};

remote.findBonus = function (query, cb) {
	console.log("inside findAll ", query);
	var newQuery = {};
	if (query.profile) {
		newQuery.profile = query.profile;
	}
	if (query.codeName) {
		newQuery.codeName = query.codeName;
	}
	if (query.bonusPercent) {
		newQuery.bonusPercent = query.bonusPercent;
	}
	if (query.bonusCodeType) {
		newQuery['bonusCodeType.type'] = query.bonusCodeType.type;
	}
	if (query.bonusCodeCategoryType) {
		newQuery['bonusCodeCategory.type'] = query.bonusCodeCategoryType;
	}
	if (query.status) {
		newQuery.status = query.status;
	}
	if (query.createdBy) {
		newQuery.createdBy = query.createdBy;
	}
	if (query._id) {
		newQuery._id = ObjectID(query._id);
	}
	var skip = query.skip || 0;
	var limit = query.limit || 20;
	console.log("inside findAll2 ", newQuery);
	mongodb.adminDb.collection('bonusCollection').find(newQuery).skip(skip).limit(limit).sort({ createdAt: -1 }).toArray(function (err, result) {
		console.log("result in findUserArray ", (result));
		cb(err, result);
	});
};

remote.updateMultipleBonusHistory = function (query, updateKey, cb) {
	console.log("inside updateBonusHistory ", updateKey);
	mongodb.adminDb.collection('bonusCollection').update(query, { $set: updateKey }, { multi: true }, function (err, result) {
		cb(err, result);
	});
};

remote.findBonusHistoryCollection = function (query, cb) {
	console.log("inside findBonusHistoryCollection ", query);
	mongodb.adminDb.collection('bonusHistoryCollection').find(query).toArray(function (err, result) {
		console.log("result in findBonusHistoryCollection ", JSON.stringify(result));
		cb(err, result);
	});
};



/*Affiliates queries begin here*/

/*Affiliates starts here*/
//check affiliate & sub affiliate user name and email that previously activated or not
remote.chkUsername = function (req, callback) {
	mongodb.adminDb.collection('affiliates').count(req, function (err, result) {
		callback(err, result);
	});
};

//Find user with email or mobile or username
remote.findUserOrOperation = function (filter, callback) {
	console.log("filter is", filter);
	mongodb.adminDb.collection('affiliates').findOne({ userName: filter.userName }, function (err, result) {
		console.log("filter is", result, err);
		callback(err, result);
	});
};

//insert affiliate data
remote.createAffiliate = function (userData, callback) {
	console.log("createAffiliate called", userData);
	mongodb.adminDb.collection('affiliates').insert(userData, function (err, result) {
		callback(err, result);
	});
};


remote.updateteAffiliate = function (userData, userid, callback) {
	// console.log('update Affiliate data into dbquery'+JSON.stringify(userData));
	// console.log("updateteAffiliate == ", userid);
	mongodb.adminDb.collection('affiliates').update({ _id: ObjectID(userid) }, { $set: userData }, function (err, result) {
		callback(err, result);
	});
};

remote.updateteAffiliateCashout = function (userData, query, callback) {
	//console.log('#@#@#@#@#@#@#@#@#@@#@update Affiliate data into dbquery'+JSON.stringify(userData));
	// console.log("updateteAffiliate == ", userid);
	mongodb.adminDb.collection('affiliates').findOneAndUpdate(query, { $set: userData }, { new: true }, function (err, result) {
		callback(err, result);
	});
};

//update increment balance to affiliate & subaffiliates
remote.updateteAffiliateBalance = function (userdata, userid, callback) {
	mongodb.adminDb.collection('affiliates').update({ _id: ObjectID(userid) }, { $inc: { balance: parseInt(userdata.fundTransferAmount) } }, function (err, result) {
		callback(err, result);
	});
};
//update affiliate rake balANCE
remote.updateteAffiliateRakeBalance = function (userdata, userid, callback) {
	console.log('updateteAffiliateRakeBalance' + JSON.stringify(userdata) + 'userid' + userid);
	mongodb.adminDb.collection('affiliates').update({ _id: ObjectID(userid) }, { $inc: userdata }, function (err, result) {
		callback(err, result);
	});
};
//decrease bal from comapny
remote.companyRakeBalance = function (balance, callback) {
	mongodb.adminDb.collection('affiliates').update({ "role": "company" }, { $inc: balance }, function (err, result) {
		callback(err, result);
	});
};
//update decrement bal to affiliate & sub affiliates
remote.decreaseAffiliateBalance = function (userdata, userid, callback) {
	console.log('decreaseAffiliateBalance in dbquery' + JSON.stringify(userdata) + 'userid' + userid);
	var balance = parseInt(userdata.fundTransferAmount);
	mongodb.adminDb.collection('affiliates').update({ _id: ObjectID(userid) }, { $inc: { balance: -balance } }, function (err, result) {
		callback(err, result);
	});
};





// get sub affiliate listing under affiliate
remote.getAffiliateUser = function (userData, callback) {

	mongodb.adminDb.collection('affiliates').find(userData).toArray(function (err, result) {
		callback(err, result);
	});
};
//get sub affiliate for admin & paging
remote.getSubAffiliate = function (role, pagelimit, currentpage, callback) {
	console.log('in db query role' + JSON.stringify(role) + 'pagelimit' + pagelimit + 'currentpage' + currentpage);
	mongodb.adminDb.collection('affiliates').find(role).skip(pagelimit * (currentpage - 1)).limit(pagelimit).toArray(function (err, result) {
		callback(err, result);
	});
};

//get admin listing getAdminList
remote.getAdminList = function (query, callback) {
	console.log('get admin list' + JSON.stringify(query));
	mongodb.adminDb.collection('affiliates').find(query).toArray(function (err, result) {
		callback(err, result);
	});
};

// //get affiliate list
remote.getAffiliateList = function (query, callback) {
	mongodb.adminDb.collection('affiliates').find(query).toArray(function (err, result) {
		console.log(err, result);
		callback(err, result);
	});
};

remote.getAffiliateListSelectedData = function (query, projectionData, callback) {
	var skip = query.skip;
	var limit = query.limit;
	delete query.skip;
	delete query.limit;
	if (query.userName) {
		skip = 0;
		limit = 0;
	}
	mongodb.adminDb.collection('affiliates').find(query, projectionData).skip(skip).limit(limit).toArray(function (err, result) {
		callback(err, result);
	});
};

//get affiliate count
// remote.getAffiliateCount = function(query, callback){
//     // console.log("line 312 getAffiliateCount== ", query);
//     mongodb.adminDb.collection('affiliates').count(query, function (err, result) {
//           callback(err, result);
//         });
// }

//deleteAffiliate
remote.deleteAffiliate = function (query, callback) {
	console.log('data has been going to delete in dbquery' + JSON.stringify(query));
	mongodb.adminDb.collection('affiliates').deleteOne({ _id: ObjectID(query._id) }, function (err, result) {
		callback(err, result);
	});
};
//chk isValidAffiliate affiliate is valid or not

remote.isValidAffiliate = function (query, callback) {
	mongodb.adminDb.collection('affiliates').find({ userName: query }, { _id: 1, userName: 1 }).toArray(function (err, result) {
		callback(err, result);
	});
	// mongodb.adminDb.collection('affiliates').find({_id:ObjectID(query.isParent)} ).toArray(function(err, result){
	// // mongodb.adminDb.collection('affiliates').find({userName:query.isParent}).toArray(function(err, result){
	//   console.log('err', err, 'result', result);
	//   callback(err, result);
	// })
};




// get getaffiliatesubaffiliate for admin edit in user list
remote.getaffiliatesubaffiliate = function (req, callback) {
	console.log('get getaffiliatesubaffiliate in dbquery' + JSON.stringify(req));

	mongodb.adminDb.collection('affiliates').find({ role: { $in: ["affiliate", "sub-affiliate"] } }).toArray(function (err, result) {
		callback(err, result);
	});
};

//get affiliate & sub affiliate payment option
remote.getWithdrawlProfileforAffiliate = function (userId, callback) {
	mongodb.adminDb.collection('affiliates').findOne({ _id: ObjectID(userId) }, function (err, result) {
		callback(err, result);
	});
};


//get affiliate & sub affiliate balance
remote.getaffandsubaffbalance = function (req, callback) {
	console.log('getaffandsubaffbalance in db query lines 385' + JSON.stringify(req));
	mongodb.adminDb.collection('affiliates').find({ _id: ObjectID(req.fundTransferByUserid) }).toArray(function (err, result) {
		callback(err, result);
	});
};

//get affiliate & sub affiliate balance - scratch card
remote.getaffandsubaffbalanceScratch = function (req, callback) {
	console.log('getaffandsubaffbalanceScratch in db query lines 385' + JSON.stringify(req));
	mongodb.adminDb.collection('affiliates').findOne({ _id: ObjectID(req.scratchcardByUserid) }, function (err, result) {
		callback(err, result);
	});
};
//find affiliate & sub affiliate details
remote.findaffiliate = function (req, callback) {
	console.error(req)
	mongodb.adminDb.collection('affiliates').find({ _id: ObjectID(req.affiliateid) }).toArray(function (err, result) {
		callback(err, result);
	});
};
//find company balance & details
remote.findcompany = function (req, callback) {
	mongodb.adminDb.collection('affiliates').find(req).toArray(function (err, result) {
		callback(err, result);
	});
};



remote.getUser = function (query, callback) {
	mongodb.adminDb.collection('affiliates').findOne(query, function (err, result) {
		// console.log("getUser called == ",query, err, result);
		callback(err, result);
	});
};

remote.getAllAffiliates = function (query, callback) {
	var skipValue = query.skip || 0;
	var limitValue = query.limit || 0;
	delete query.skip;
	delete query.limit;
	mongodb.adminDb.collection('affiliates').find(query).skip(skipValue).limit(limitValue).sort({ createdAt: -1 }).toArray(function (err, result) {
		for (var i = 0; i < result.length; i++) {
			if (result[i].profit) {
				result[i].profit = parseFloat(result[i].profit.toFixed(2));
			}
		}
		callback(err, result);
	});
};


remote.getAllAffiliatesCashout = function (query, callback) {
	var skipValue = query.skip || 0;
	var limitValue = query.limit || 0;
	delete query.skip;
	delete query.limit;
	mongodb.adminDb.collection('affiliates').find(query).skip(skipValue).limit(limitValue).sort({ createdAt: -1 }).toArray(function (err, result) {
		for (var i = 0; i < result.length; i++) {
			if (result[i].profit) {
				result[i].profit = parseFloat(result[i].profit.toFixed(2));
			}
		}
		callback(err, result);
	});
};

// remote.getAllAffiliates = function(query, callback) {
//   var skipValue = query.skip ||0;
//   var limitValue = query.limit ||0;
//   delete query.skip;
//   delete query.limit;
//   mongodb.adminDb.collection('affiliates').find(query).skip(skipValue).limit(limitValue).toArray(function (err, result) {
//    callback(err, result);
//   });
// }


remote.getAffiliateCount = function (query, callback) {
	mongodb.adminDb.collection('affiliates').count(query, function (err, result) {
		callback(err, result);
	});
};

remote.getAffiliate = function (query, callback) {
	mongodb.adminDb.collection('affiliates').find(query).skip(0).limit(parseInt(query.limit)).toArray(function (err, result) {
		// console.log('in dbquery'+JSON.stringify(result));
		callback(err, result);
	});
};

// remote.saveWithdrawHistory = function(query, cb){
// 	console.log("inside saveWithdrawHistory ", query);
// 	mongodb.adminDb.collection('withdrawChipsHistory').insert(query, function(err, result) {
// 		console.log("err, result====", err, result);
// 		cb(err, result);
// 	});
// };

// remote.countWithdrawHistory = function(query, cb){
// 	console.log("inside countWithdrawHistory db query -- ", query);
// 	mongodb.adminDb.collection('withdrawChipsHistory').count(query,function (err, result) {
// 		console.log("result in withdrawChipsHistory  ",JSON.stringify(result));
// 		cb(err, result);
// 	});
// };

// remote.findWithdrawHistory = function(query, cb){
// 	console.log("inside findWithdrawHistory ", query);
// 	var skip = query.skip;
// 	var limit = query.limit;
// 	var filter = {};
// 	if(query.userName){
// 		filter = {
// 			userName : query.userName
// 		};
// 	}
// 	if(!!query.Affiliate && query.Affiliate != ""){
// 		filter.Affiliate = query.Affiliate;
// 	}
// 	if(!!query.withdrawFrom && query.withdrawFrom != ""){
// 		filter.withdrawFrom = query.withdrawFrom;
// 	}
// 	if(!!query.transactionType && query.transactionType != ""){
// 		filter.transactionType = query.transactionType;
// 	}
// 	console.log("the value of filter in adminDbQuery findWithdrawHistory is ",filter);
// 	mongodb.adminDb.collection('withdrawChipsHistory').find(filter).skip(skip).limit(limit).sort({date : -1}).toArray(function (err, result) {
// 		console.log("result in withdrawChipsHistory ",JSON.stringify(result));
// 		cb(err, result);
// 	});
// };



remote.saveTransferChipsAffiliateHistory = function (query, cb) {
	console.log("inside saveTransferChipsAffiliateHistory db query --", query);
	mongodb.adminDb.collection('chipsTransferToAffiliateHistory').insert(query, function (err, result) {
		console.log("err, result====", err, result);
		cb(err, result);
	});
};

remote.countAffiliatesHistory = function (query, cb) {
	console.log("inside countAffiliatesHistory db query -- ", query);
	var filter = {};
	if (!!query.transferTo && query.transferTo != "") {
		filter.transferTo = query.transferTo;
	}
	if (!!query.transferBy && query.transferBy != "") {
		filter.transferBy = query.transferBy;
	}
	if (!!query.transactionType && query.transactionType != "") {
		filter.transactionType = query.transactionType;
	}
	if (query.startDate && query.endDate) {
		filter.date = { $gte: query.startDate, $lte: query.endDate };
	}
	if (query.startDate && !query.endDate) {
		filter.date = { $gte: query.startDate };
	}
	if (!query.startDate && query.endDate) {
		filter.date = { $lte: query.endDate };
	}
	if (query.usersType && query.usersType == "Affiliates") {
		filter['loginType.level'] = 0;
	}
	if (query.usersType && query.usersType == "Sub-affiliates") {
		filter['loginType.level'] = -1;
	}
	if (query.role.level > 0) {
		mongodb.adminDb.collection('chipsTransferToAffiliateHistory').count(filter, function (err, result) {
			console.log("result in chipsTransferToAffiliateHistory   ", JSON.stringify(result));
			cb(err, result);
		});
	}


	else {
		var query2 = {
			$or: [
				{ transferTo: query.userName },
				{ transferBy: query.userName }
			]
		};
		if (!!query.transferTo && query.transferTo != "") {
			query2.transferTo = query.transferTo;
		}
		if (!!query.transferBy && query.transferBy != "") {
			query2.transferBy = query.transferBy;
		}
		if (!!query.transactionType && query.transactionType != "") {
			query2.transactionType = query.transactionType;
		}
		if (query.startDate && query.endDate) {
			query2.date = { $gte: query.startDate, $lte: query.endDate };
		}
		if (query.startDate && !query.endDate) {
			query2.date = { $gte: query.startDate };
		}
		if (!query.startDate && query.endDate) {
			query2.date = { $lte: query.endDate };
		}
		if (query.usersType && query.usersType == "Affiliates") {
			query2['loginType.level'] = 0;
		}
		if (query.usersType && query.usersType == "Sub-affiliates") {
			query2['loginType.level'] = -1;
		}
		mongodb.adminDb.collection('chipsTransferToAffiliateHistory').count(query2, function (err, result) {
			console.log("result in chipsTransferToAffiliateHistory ***********####  ", err, result);
			cb(err, result);
		});
	}
};

remote.findTransferToAffiliateHistory = function (query, cb) {
	console.log("inside findTransferToAffiliateHistory db query -- ", query);
	var skip = query.skip;
	var limit = query.limit;
	console.log("inside findTransferToAffiliateHistory db query ");
	var filter = {};
	if (!!query.transferTo && query.transferTo != "") {
		filter.transferTo = query.transferTo;
	}
	if (!!query.transferBy && query.transferBy != "") {
		filter.transferBy = query.transferBy;
	}
	if (!!query.transactionType && query.transactionType != "") {
		filter.transactionType = query.transactionType;
	}
	if (query.startDate && query.endDate) {
		filter.date = { $gte: query.startDate, $lte: query.endDate };
	}
	if (query.startDate && !query.endDate) {
		filter.date = { $gte: query.startDate };
	}
	if (!query.startDate && query.endDate) {
		filter.date = { $lte: query.endDate };
	}
	if (query.usersType && query.usersType == "Affiliates") {
		filter['loginType.level'] = 0;
	}
	if (query.usersType && query.usersType == "Sub-affiliates") {
		filter['loginType.level'] = -1;
	}
	if (query.role.level > 0) {
		mongodb.adminDb.collection('chipsTransferToAffiliateHistory').find(filter).skip(skip).limit(limit).sort({ date: -1 }).toArray(function (err, result) {
			console.log("result in chipsTransferToAffiliateHistory  ", JSON.stringify(result));
			cb(err, result);
		});
	}
	else {
		var query2 = {
			$or: [
				{ transferTo: query.userName },
				{ transferBy: query.userName }
			]
		};
		if (!!query.transferTo && query.transferTo != "") {
			query2.transferTo = query.transferTo;
		}
		if (!!query.transferBy && query.transferBy != "") {
			query2.transferBy = query.transferBy;
		}
		if (!!query.transactionType && query.transactionType != "") {
			query2.transactionType = query.transactionType;
		}
		if (query.startDate && query.endDate) {
			query2.date = { $gte: query.startDate, $lte: query.endDate };
		}
		if (query.startDate && !query.endDate) {
			query2.date = { $gte: query.startDate };
		}
		if (!query.startDate && query.endDate) {
			query2.date = { $lte: query.endDate };
		}
		if (query.usersType && query.usersType == "Affiliates") {
			query2['loginType.level'] = 0;
		}
		if (query.usersType && query.usersType == "Sub-affiliates") {
			query2['loginType.level'] = -1;
		}
		mongodb.adminDb.collection('chipsTransferToAffiliateHistory').find(query2).skip(skip).limit(limit).sort({ date: -1 }).toArray(function (err, result) {
			console.log("result in chipsTransferToAffiliateHistory  ", JSON.stringify(result));
			cb(err, result);
		});
	}
};


remote.saveTransferChipsPlayerHistory = function (query, cb) {
	console.log("inside saveTransferChipsPlayerHistory db query --", query);
	mongodb.adminDb.collection('chipstransferToPlayerHistory').insert(query, function (err, result) {
		console.log("err, result====", err, result);
		cb(err, result);
	});
};

remote.countPlayerHistory = function (query, cb) {
	console.log("inside countPlayerHistory db query -- ", query);
	var filter = {};
	if (!!query.transferTo && query.transferTo != "") {
		filter.transferTo = query.transferTo;
	}
	if (!!query.transferBy && query.transferBy != "") {
		filter.transferBy = query.transferBy;
	}
	if (!!query.transactionType && query.transactionType != "") {
		filter.transactionType = query.transactionType;
	}
	if (query.startDate && query.endDate) {
		filter.date = { $gte: query.startDate, $lte: query.endDate };
	}
	if (query.startDate && !query.endDate) {
		filter.date = { $gte: query.startDate };
	}
	if (!query.startDate && query.endDate) {
		filter.date = { $lte: query.endDate };
	}
	if (query.role.level > 0) {
		mongodb.adminDb.collection('chipstransferToPlayerHistory').count(filter, function (err, result) {
			console.log("result in countPlayerHistory  ", JSON.stringify(result));
			cb(err, result);
		});
	}
	else {
		var query2 = {
			transferBy: query.userName
		};
		if (!!query.transferTo && query.transferTo != "") {
			query2.transferTo = query.transferTo;
		}
		if (!!query.transferBy && query.transferBy != "") {
			query2.transferBy = query.transferBy;
		}
		if (!!query.transactionType && query.transactionType != "") {
			query2.transactionType = query.transactionType;
		}
		if (query.startDate && query.endDate) {
			query2.date = { $gte: query.startDate, $lte: query.endDate };
		}
		if (query.startDate && !query.endDate) {
			query2.date = { $gte: query.startDate };
		}
		if (!query.startDate && query.endDate) {
			query2.date = { $lte: query.endDate };
		}
		mongodb.adminDb.collection('chipstransferToPlayerHistory').count(query2, function (err, result) {
			console.log("result in countPlayerHistory  ", JSON.stringify(result));
			cb(err, result);
		});
	}
};

remote.findTransferToPlayerHistory = function (query, cb) {
	console.log("inside findTransferToPlayerHistory db query -- ", query);
	var skip = query.skip;
	var limit = query.limit;
	var filter = {};
	if (query.transferTo && query.transferTo != "") {
		filter.transferTo = query.transferTo;
	}
	if (query.transferBy && query.transferBy != "") {
		filter.transferBy = query.transferBy;
	}
	if (query.transactionType && query.transactionType != "") {
		filter.transactionType = query.transactionType;
	}
	if (query.startDate && query.endDate) {
		filter.date = { $gte: query.startDate, $lte: query.endDate };
	}
	if (query.startDate && !query.endDate) {
		filter.date = { $gte: query.startDate };
	}
	if (!query.startDate && query.endDate) {
		filter.date = { $lte: query.endDate };
	}
	if (query.role.level > 0) {
		console.log("line 686 ", filter);
		mongodb.adminDb.collection('chipstransferToPlayerHistory').find(filter).skip(skip).limit(limit).sort({ date: -1 }).toArray(function (err, result) {
			console.log("result in chipstransferToPlayerHistory  ", JSON.stringify(result));
			cb(err, result);
		});
	}
	else {
		var query2 = {
			transferBy: query.userName
		};
		if (!!query.transferTo && query.transferTo != "") {
			query2.transferTo = query.transferTo;
		}
		if (!!query.transferBy && query.transferBy != "") {
			query2.transferBy = query.transferBy;
		}
		if (!!query.transactionType && query.transactionType != "") {
			query2.transactionType = query.transactionType;
		}
		if (query.startDate && query.endDate) {
			query2.date = { $gte: query.startDate, $lte: query.endDate };
		}
		if (query.startDate && !query.endDate) {
			query2.date = { $gte: query.startDate };
		}
		if (!query.startDate && query.endDate) {
			query2.date = { $lte: query.endDate };
		}

		console.log("line 706 ", query2);
		mongodb.adminDb.collection('chipstransferToPlayerHistory').find(query2).skip(skip).limit(limit).sort({ date: -1 }).toArray(function (err, result) {
			console.log("result in chipstransferToPlayerHistory  ", JSON.stringify(result));
			cb(err, result);
		});
	}
};

/*Affiliates queries end here*/


/*Loyalty points queries start here*/

remote.findLoyaltyPoints = function (query, callback) {
	mongodb.adminDb.collection('loyaltyPoints').findOne(query, function (err, result) {
		callback(err, result);
	});
};

remote.findAllLoyaltyPoints = function (query, callback) {
	// console.log("query in findAllLoyaltyPoints== ", query);
	mongodb.adminDb.collection('loyaltyPoints').find(query).sort({ levelId: 1 }).toArray(function (err, result) {
		callback(err, result);
	});
};
remote.findAllMegaPointLevels = remote.findAllLoyaltyPoints;

remote.createLoyaltyLevel = function (query, callback) {
	mongodb.adminDb.collection('loyaltyPoints').insert(query, function (err, result) {
		callback(err, result);
	});
};

remote.updateLoyaltyLevel = function (query, callback) {
	console.log("query in updateLoyaltyLevel== ", query);
	var id = query._id;
	delete query._id;
	mongodb.adminDb.collection('loyaltyPoints').update({ _id: ObjectID(id) }, query, function (err, result) {
		callback(err, result);
	});
};


/*Loyalty points queries end here*/


remote.deleteLeaderboardSets = function (query, cb) {
	mongodb.adminDb.collection('leaderboardSet').remove({ leaderboardSetId: query.leaderboardSetId }, { single: true }, function (err, result) {
		console.log("here err,result in deleteLeaderboardSets", err, result);
		cb(err, result);
	});
};


//_____________________________ pan card mangement query END ___________________________

remote.listModule = function (query, callback) {
	// console.log("listModule called",query)
	mongodb.adminDb.collection('moduleAdmin').find(query).toArray(function (err, result) {
		callback(err, result);
	});
};

remote.insertModuleList = function (query, callback) {
	console.log("insertModuleList called", query)
	mongodb.adminDb.collection('moduleAdmin').insert(query, function (err, result) {
		callback(err, result);
	});
};

remote.removeAdminModules = function (query, callback) {
	// console.log("listModule called",query)
	mongodb.adminDb.collection('moduleAdmin').remove({}, function (err, result) {
		callback(err, result);
	});
};

remote.listModuleAff = function (query, callback) {
	// console.log("listModule called",query)
	mongodb.adminDb.collection('moduleAffiliates').find(query).toArray(function (err, result) {
		callback(err, result);
	});
};

remote.insertModuleListAff = function (query, callback) {
	console.log("insertModuleList called", query)
	mongodb.adminDb.collection('moduleAffiliates').insert(query, function (err, result) {
		callback(err, result);
	});
};

remote.removeAffiliateModules = function (query, callback) {
	// console.log("listModule called",query)
	mongodb.adminDb.collection('moduleAffiliates').remove({}, function (err, result) {
		callback(err, result);
	});
};



remote.createDepositHistory = function (query, cb) {
	console.log("inside createBonusHistory ", query);
	mongodb.adminDb.collection('transactionHistory').insert(query, function (err, result) {
		console.log("err, result====", err, result);
		cb(err, result);
	});
};

remote.getTransactionHistoryCount = function (query, cb) {
	console.log("inside getTransactionHistoryCount the query is ", query);
	mongodb.adminDb.collection('transactionHistory').count(query, function (err, result) {
		console.log(" count of transaction History.............. ", JSON.stringify(result));
		cb(err, result);
	});
};

remote.findTransactionHistory = function (query, cb) {
	console.log("inside findTransactionHistory ------ ", query);
	var skip = query.skip || 0;
	var limit = query.limit || 1000000;
	var sortValue = query.sortValue;
	// console.log(sortValue);
	delete query.sortValue;
	delete query.skip;
	delete query.limit;
	mongodb.adminDb.collection('transactionHistory').find(query).skip(skip).limit(limit).sort({ [sortValue]: -1 }).toArray(function (err, result) {
		cb(err, result);
	});
};

remote.listMonthlyBonusChipsReport = function (query, cb) {
	console.log("inside listMonthlyBonusChipsReport dbQuery------ ", query);
	mongodb.adminDb.collection('transactionHistory').find(query).toArray(function (err, result) {
		console.log("here err,result", err, result)
		cb(err, result);
	});
};

remote.assignTotalDebitTotalCredit = function (query, cb) {
	console.log("Inside assignTotalDebitTotalCredit db query -->", query);
	mongodb.adminDb.collection('transactionHistory').aggregate([{ $match: query }, { $group: { _id: "$transactionType", totalAmount: { $sum: '$amount' } } }]).toArray(function (err, result) {
		console.log("Inside assignTotalDebitTotalCredit err,result-->\n", err, result);
		cb(err, result);
	});
};

remote.calculateTransferAmount = function (query, cb) {
	console.log("inside calculateTransferAmount", query);
	var filter = {};
	if (query.transferTo && query.transferTo != "") {
		filter.transferTo = query.transferTo;
	}
	if (query.transferBy && query.transferBy != "") {
		filter.transferBy = query.transferBy;
	}
	if (query.transactionType && query.transactionType != "") {
		filter.transactionType = query.transactionType;
	}
	if (query.startDate && query.endDate) {
		filter.date = { $gte: query.startDate, $lte: query.endDate };
	}
	if (query.startDate && !query.endDate) {
		filter.date = { $gte: query.startDate };
	}
	if (!query.startDate && query.endDate) {
		filter.date = { $lte: query.endDate };
	}
	console.log("db query1 calculateTransferAmount", filter);
	if (query.role.level > 0) {
		mongodb.adminDb.collection('chipstransferToPlayerHistory').aggregate([{ $match: filter }, { $group: { _id: "_id", totalAmount: { $sum: '$amount' } } }]).toArray(function (err, result) {
			console.log("Inside calculateTransferredAmount err,result1-->\n", err, result);
			cb(err, result);
		});
	}
	else {
		var query2 = {
			transferBy: query.userName
		};
		if (!!query.transferTo && query.transferTo != "") {
			query2.transferTo = query.transferTo;
		}
		if (!!query.transferBy && query.transferBy != "") {
			query2.transferBy = query.transferBy;
		}
		if (!!query.transactionType && query.transactionType != "") {
			query2.transactionType = query.transactionType;
		}
		if (query.startDate && query.endDate) {
			query2.date = { $gte: query.startDate, $lte: query.endDate };
		}
		if (query.startDate && !query.endDate) {
			query2.date = { $gte: query.startDate };
		}
		if (!query.startDate && query.endDate) {
			query2.date = { $lte: query.endDate };
		}
		console.log("db query2 calculateTransferAmount", query2);
		mongodb.adminDb.collection('chipstransferToPlayerHistory').aggregate([{ $match: query2 }, { $group: { _id: "_id", totalAmount: { $sum: '$amount' } } }]).toArray(function (err, result) {
			console.log("Inside calculateTransferredAmount err,result2-->\n", err, result);
			cb(err, result);
		});
	}
};

remote.calculateTransferAmountAgent = function (query, cb) {
	console.log("inside calculateTransferAmount", query);
	var filter = {};
	if (!!query.transferTo && query.transferTo != "") {
		filter.transferTo = query.transferTo;
	}
	if (!!query.transferBy && query.transferBy != "") {
		filter.transferBy = query.transferBy;
	}
	if (!!query.transactionType && query.transactionType != "") {
		filter.transactionType = query.transactionType;
	}
	if (query.startDate && query.endDate) {
		filter.date = { $gte: query.startDate, $lte: query.endDate };
	}
	if (query.startDate && !query.endDate) {
		filter.date = { $gte: query.startDate };
	}
	if (!query.startDate && query.endDate) {
		filter.date = { $lte: query.endDate };
	}
	if (query.usersType && query.usersType == "Affiliates") {
		filter['loginType.level'] = 0;
	}
	if (query.usersType && query.usersType == "Sub-affiliates") {
		filter['loginType.level'] = -1;
	}
	console.log("db query1 calculateTransferAmount", filter);
	if (query.role.level > 0) {
		mongodb.adminDb.collection('chipsTransferToAffiliateHistory').aggregate([{ $match: filter }, { $group: { _id: "_id", totalAmount: { $sum: '$amount' } } }]).toArray(function (err, result) {
			console.log("Inside chipsTransferToAffiliateHistory err,result1-->\n", err, result);
			cb(err, result);
		});
	}
	else {
		var query2 = {
			$or: [
				{ transferTo: query.userName },
				{ transferBy: query.userName }
			]
		};
		if (!!query.transferTo && query.transferTo != "") {
			query2.transferTo = query.transferTo;
		}
		if (!!query.transferBy && query.transferBy != "") {
			query2.transferBy = query.transferBy;
		}
		if (!!query.transactionType && query.transactionType != "") {
			query2.transactionType = query.transactionType;
		}
		if (query.startDate && query.endDate) {
			query2.date = { $gte: query.startDate, $lte: query.endDate };
		}
		if (query.startDate && !query.endDate) {
			query2.date = { $gte: query.startDate };
		}
		if (!query.startDate && query.endDate) {
			query2.date = { $lte: query.endDate };
		}
		if (query.usersType && query.usersType == "Affiliates") {
			query2['loginType.level'] = 0;
		}
		if (query.usersType && query.usersType == "Sub-affiliates") {
			query2['loginType.level'] = -1;
		}
		console.log("db query2 chipsTransferToAffiliateHistory", query2);
		mongodb.adminDb.collection('chipsTransferToAffiliateHistory').aggregate([{ $match: query2 }, { $group: { _id: "_id", totalAmount: { $sum: '$amount' } } }]).toArray(function (err, result) {
			console.log("Inside chipsTransferToAffiliateHistory err,result2-->\n", err, result);
			cb(err, result);
		});
	}
};

remote.assignTotalApprovedTotalRejectedAmount = function (query, cb) {
	console.log("Inside assignTotalApprovedTotalRejectedAmount db query -->", query);
	mongodb.adminDb.collection('directCashoutHistory').aggregate([{ $match: query }, { $group: { _id: "$status", totalAmount: { $sum: '$amount' }, totalRequestedAmount: { $sum: '$requestedAmount' } } }]).toArray(function (err, result) {
		console.log("Inside assignTotalApprovedTotalRejectedAmount err,result-->\n", err, result);
		cb(err, result);
	});
};

remote.deductRealChipsFromAffiliateFundTransfer = function (filter, chips, callback) {
	console.log("filter chips", filter, chips);
	mongodb.adminDb.collection('affiliates').update(filter, { $inc: { realChips: -chips } }, function (err, result) {
		console.log("result ------", result);
		callback(err, result);
	});
};

remote.deductRealChipsFromAffiliate = function (filter, chips, callback) {
	console.log("filter chips", filter, chips);
	mongodb.adminDb.collection('affiliates').update(filter, { $inc: { realChips: -chips/*,"chipsManagement.deposit": -chips*/ } }, function (err, result) {
		console.log("result ------", result);
		callback(err, result);
	});
};

remote.deductProfitChipsFromAffiliate = function (filter, chips, callback) {
	console.log("filter chips in deductProfitChips from affiliate", filter, chips);
	mongodb.adminDb.collection('affiliates').update(filter, { $inc: { profit: -chips } }, function (err, result) {
		console.log("result ------", result);
		callback(err, result);
	});
};

remote.addRealChipstoAffiliate = function (filter, chips, callback) {
	mongodb.adminDb.collection('affiliates').update(filter, { $inc: { realChips: chips } }, function (err, result) {
		callback(err, result);
	});
};

remote.returnRealChipstoAffiliate = function (filter, update, callback) {
	mongodb.adminDb.collection('affiliates').update(filter, update, function (err, result) {
		callback(err, result);
	});
};

remote.findAffiliates = function (filter, callback) {
	mongodb.adminDb.collection('affiliates').findOne(filter, function (err, result) {
		callback(err, result);
	});
};

remote.findOneAffiliate = function (query, cb) {
	console.log("inside findOneAffiliate ------ ", query);
	mongodb.adminDb.collection('affiliates').findOne(query, function (err, result) {
		console.log("result in Affiliate---- ", JSON.stringify(result));
		cb(err, result);
	});
};

//______________ CASH OUT QUERIES START _________________

remote.createCashOutRequest = function (data, callback) {
	mongodb.adminDb.collection('pendingCashOutRequest').insert(data, function (err, result) {
		console.log("err, result====", err, result);
		callback(err, result);
	});
};

remote.getCashOutRequestCount = function (query, callback) {
	if (query.userName) {
		query.userName = eval('/^' + query.userName + '$/i');
	}
	if (query.profile) {
		query.profile = { '$regex': query.profile, "$options": 'i' }
	}
	mongodb.adminDb.collection('pendingCashOutRequest').count(query, function (err, result) {
		console.log("err, result====", err, result);
		callback(err, result);
	});
};

remote.listPendingCashOutRequest = function (query, callback) {
	console.log("listPendingCashOutRequest ", query);
	if (query.userName) {
		query.userName = eval('/^' + query.userName + '$/i');
	}
	if (query.profile) {
		query.profile = { '$regex': query.profile, "$options": 'i' }
	}
	var skip = query.skip || 0;
	var limit = query.limit || 0;
	delete query.skip;
	delete query.limit;
	// mongodb.adminDb.collection('pendingCashOutRequest').find({}).skip(query.skip).limit(query.limit).sort({requestedAt : -1}).toArray(function(err, result) {
	mongodb.adminDb.collection('pendingCashOutRequest').find(query).skip(skip).limit(limit).sort({ requestedAt: -1 }).toArray(function (err, result) {
		console.log("err, result====", err, result);
		callback(err, result);
	});
};

remote.removeCashoutRequestOnAction = function (requestId, callback) {
	mongodb.adminDb.collection('pendingCashOutRequest').remove({ _id: ObjectID(requestId) }, function (err, result) {
		console.log("removeCashoutRequestOnAction ---------- err, result====", err, result);
		callback(err, result);
	});
};

remote.processApproveCashout = function (data, callback) {
	mongodb.adminDb.collection('approveCashOutRequest').insert(data, function (err, result) {
		console.log("err, result====", err, result);
		callback(err, result);
	});
};

remote.approveCashoutCount = function (query, callback) {
	mongodb.adminDb.collection('approveCashOutRequest').count(query, function (err, result) {
		console.log("err, result====", err, result);
		callback(err, result);
	});
};

remote.listApproveCashOutRequest = function (query, callback) {
	if (query.profile) {
		query.profile = { '$regex': query.profile, "$options": 'i' }
	}
	var skip = query.skip;
	var limit = query.limit;
	delete query.skip;
	delete query.limit;
	// mongodb.adminDb.collection('approveCashOutRequest').find({}).skip(query.skip).limit(query.limit).sort({requestedAt : -1}).toArray(function(err, result) {
	mongodb.adminDb.collection('approveCashOutRequest').find(query).skip(skip).limit(limit).sort({ requestedAt: -1 }).toArray(function (err, result) {
		console.log("listApproveCashOutRequest---------------err, result====", err, result);
		callback(err, result);
	});
};

remote.insertIntoCashoutHistory = function (data, callback) {
	mongodb.adminDb.collection('cashoutHistory').insert(data, function (err, result) {
		console.log("err, result====", err, result);
		callback(err, result);
	});
};

remote.removeFromCashsoutApprovel = function (requestId, callback) {
	mongodb.adminDb.collection('approveCashOutRequest').remove({ _id: ObjectID(requestId) }, function (err, result) {
		console.log("err, result====", err, result);
		callback(err, result);
	});
};

remote.getCashoutHistoryCount = function (data, callback) {
	if (data.userName) {
		data.userName = eval('/^' + data.userName + '$/i');
	}
	if (data.bankTransactionId) {
		data.transactionId = data.bankTransactionId.toString();
	}
	delete data.bankTransactionId;
	console.log("count cashout history db query------------>", data);
	mongodb.adminDb.collection('cashoutHistory').count(data, function (err, result) {
		// console.log("err, result====", err, result);
		callback(err, result);
	});
};

remote.listCashOutHistory = function (query, callback) {
	var query1 = {};
	if (query.userName) {
		query1.userName = eval('/^' + query.userName + '$/i');
	}
	if (query.referenceNo) {
		query1.referenceNo = query.referenceNo;
	}
	if (query.bankTransactionId) {
		query1.transactionId = query.bankTransactionId.toString();
	}
	if (query.createdAt) {
		query1.createdAt = query.createdAt;
	}
	if (query.status) {
		query1.status = query.status;
	}

	console.trace("i am here alone.db query..................--------->", query1);
	mongodb.adminDb.collection('cashoutHistory').find(query1).skip(query.skip).limit(query.limit).sort({ createdAt: -1 }).toArray(function (err, result) {
		// console.log("listCashOutHistory---------------err, result====", err, result);
		callback(err, result);
	});
};

remote.updateDeposit = function (params, query, callback) {
	console.log("The params in updateDeposit is------ ", params);
	mongodb.adminDb.collection('affiliates').update(params, query, function (err, result) {
		callback(err, result);
	});
};

remote.findUserWithEmail = function (filter, callback) {
	mongodb.adminDb.collection('affiliates').findOne(filter, function (err, result) {
		callback(err, result);
	});
};

remote.updatePasswordInDb = function (query, updateKeys, cb) {
	console.log("updatePasswordInDb--- ", query);
	mongodb.adminDb.collection('affiliates').update(query, { $set: updateKeys }, function (err, result) {
		console.log("admindbQuery result====", err, result);
		cb(err, result);
	});
};


remote.findUserWithId = function (filter, callback) {
	mongodb.adminDb.collection('affiliates').findOne(filter, function (err, result) {
		callback(err, result);
	});
};

remote.findSubAffiliates = function (filter, callback) {
	mongodb.adminDb.collection('affiliates').findOne(filter, function (err, result) {
		callback(err, result);
	});
};

remote.findTotalCashout = function (filter, callback) {
	mongodb.adminDb.collection('cashoutHistory').find(filter).toArray(function (err, result) {
		callback(err, result);
	});
};
remote.findTotalCashoutForAgentPlayer = function (filter, callback) {
	mongodb.adminDb.collection('directCashoutHistory').find(filter).toArray(function (err, result) {
		callback(err, result);
	});
};

remote.findCashoutHistory = function (query, cb) {
	console.log("inside findCashoutHistory ------ ", query);
	var skip = query.skip || 0;
	var limit = query.limit || 0;
	delete query.skip;
	delete query.limit;
	mongodb.adminDb.collection('cashoutHistory').find(query).skip(skip).limit(limit).sort({ date: -1 }).toArray(function (err, result) {
		// console.log("result in findCashoutHistory ",JSON.stringify(result));
		cb(err, result);
	});
};


remote.craeteCashoutRequestForPlayerThroughGame = function (query, cb) {
	mongodb.adminDb.collection('cashoutDirect').insert(query, function (err, result) {
		// console.log("result in findCashoutHistory ",JSON.stringify(result));
		cb(err, result);
	});
};

remote.getCountAllRecordsDirectCashout = function (query, cb) {
	console.log("inside getCountAllRecordsDirectCashout ------ ", query);
	mongodb.adminDb.collection('cashoutDirect').count(query, function (err, result) {
		console.log("result in getCountAllRecordsDirectCashout ", JSON.stringify(result));
		cb(err, result);
	});

};

remote.getAllRecordsDirectCashout = function (query, cb) {
	console.log("inside getAllRecordsDirectCashout ------ ", query);
	var skip = query.skip || 0;
	var limit = query.limit || 0;
	delete query.skip;
	delete query.limit;
	mongodb.adminDb.collection('cashoutDirect').find(query).skip(skip).limit(limit).toArray(function (err, result) {
		// console.log("result in getAllRecordsDirectCashout ",JSON.stringify(result));
		cb(err, result);
	});
};


remote.addRealChipstoAffiliateCashout = function (filter, chips, callback) {
	console.log("inside addRealChipstoAffiliateCashout dbquery", filter)
	mongodb.adminDb.collection('affiliates').update(filter, { $inc: { realChips: chips, 'withdrawal': chips } }, function (err, result) {
		callback(err, result);
	});
};

remote.addRealChipstoSubAffiliateCashout = function (filter, chips, callback) {
	mongodb.adminDb.collection('affiliates').update(filter, { $inc: { realChips: chips/*, 'chipsManagement.deposit':chips*/ } }, function (err, result) {
		callback(err, result);
	});
};

remote.deleteCashoutData = function (query, cb) {
	console.log("line 1022 deleteCashoutData ", query);
	mongodb.adminDb.collection('cashoutDirect').deleteOne({ _id: ObjectID(query._id) }, function (err, result) {
		// console.log("line 76 err, result====", err, result);
		cb(err, result);
	});
};


remote.checkCashoutRequestExists = function (query, callback) {
	mongodb.adminDb.collection('cashoutDirect').findOne({ _id: ObjectID(query._id) }, function (err, result) {
		callback(err, result);
	});
};

remote.insertInDirectCashoutHistory = function (query, cb) {
	mongodb.adminDb.collection('directCashoutHistory').insert(query, function (err, result) {
		console.log("in insertInDirectCashoutHistoy admindb", err, result);
		cb(err, result);
	});
};

remote.getCountFromDirectCashoutHistory = function (query, cb) {
	console.log("inside getCountFromDirectCashoutHistory ------ ", query);
	mongodb.adminDb.collection('directCashoutHistory').count(query, function (err, result) {
		console.log("result in getCountFromDirectCashoutHistory ", JSON.stringify(result));
		cb(err, result);
	});

};


remote.getAllFromDirectCashoutHistory = function (query, cb) {
	console.log("inside getAllFromDirectCashoutHistory ------ ", query);
	var skip = query.skip || 0;
	var limit = query.limit || 0;
	delete query.skip;
	delete query.limit;
	mongodb.adminDb.collection('directCashoutHistory').find(query).skip(skip).limit(limit).sort({ actionTakenAt: -1 }).toArray(function (err, result) {
		// console.log("result in getAllRecordsDirectCashout ",JSON.stringify(result));
		cb(err, result);
	});

};

// remote.findFromCashoutHistory = function(query, cb){
//   mongodb.adminDb.collection('cashoutHistory').find(query).toArray(function(err, result) {
//     //console.log("err, result====", err, result);
//     cb(err, result);
//   });
// }


remote.findFromDirectCashoutHistory = function (query, cb) {
	mongodb.adminDb.collection('directCashoutHistory').find(query).toArray(function (err, result) {
		//console.log("err, result====", err, result);
		cb(err, result);
	});
};

remote.saveDataInCashoutDirect = function (data, callback) {
	mongodb.adminDb.collection('cashoutDirect').insert(data, function (err, result) {
		//console.log("err, result====", err, result);
		callback(err, result);
	});
};

remote.addProfitChipsToAffiliate = function (filter, chips, callback) {
	console.log("filter chips in addProfitChips to affiliate", filter, chips);
	mongodb.adminDb.collection('affiliates').update(filter, { $inc: { profit: chips } }, function (err, result) {
		console.log("result ------", result);
		callback(err, result);
	});
};

remote.findFromCashoutHistory = function (query, cb) {
	mongodb.adminDb.collection('cashoutHistory').find(query, { userName: 1, requestedAt: 1, status: 1, requestedAmount: 1, tds: 1, processingFees: 1, netAmount: 1, referenceNo: 1, affiliateId: 1, transactionId: 1, createdAt: 1 }).toArray(function (err, result) {
		cb(err, result);
	});
};

remote.calculateTotalApprovedAmount = function (query, cb) {
	mongodb.adminDb.collection('cashoutHistory').aggregate([{ $match: query }, { $group: { _id: "_id", amount: { $sum: '$requestedAmount' } } }]).toArray(function (err, result) {
		console.log("line 1206 calculateTotalApprovedAmount", err, result);
		cb(err, result);
	});
};

remote.findTotalChipsAddedAggregate = function (query, cb) {
	mongodb.adminDb.collection('transactionHistory').aggregate([{ $match: query }, { $group: { _id: "$transferMode", amount: { $sum: '$amount' } } }]).toArray(function (err, result) {
		console.log("line 1205 findTotalChipsAddedAggregate", err, result);
		cb(err, result);
	});
};

// remote.findTotalChipsAddedAggregate = function(query, cb){
// 	mongodb.adminDb.collection('transactionHistory').aggregate([{ $match: query }, {$group : {_id : "$transferMode", amount : {$sum : '$amount'}}}]).forEach(function(result){
// 		console.log("findTotalChipsAddedAggregate",result)
// 			cb(null,result);
// 		})
// }

remote.createSessionForLoggedInUser = function (query, data, callback) {
	mongodb.adminDb.collection('loggedInAffiliates').update(query, data, { upsert: true }, function (err, result) {
		//console.log("err, result====", err, result);
		callback(err, result);
	});
};

remote.findSessionForLoggedInUser = function (query, callback) {
	mongodb.adminDb.collection('loggedInAffiliates').findOne(query, function (err, result) {
		//console.log("err, result====", err, result);
		callback(err, result);
	});
};

remote.removeUserSessionsAtServerStart = function (query, callback) {
	mongodb.adminDb.collection('loggedInAffiliates').deleteMany({}, function (err, result) {
		//console.log("err, result====", err, result);
		callback(err, result);
	});
};


remote.createGameVersionDb = function (data, cb) {
	// console.log("Inside createGameVersionDb DB Query ", query)
	mongodb.adminDb.collection('gameVersions').insert(data, function (err, result) {
		// console.log("err, result====", err, result);
		cb(err, result);
	});
};

remote.updateGameVersionDb = function (query, updateKeys, cb) {
	// console.log("Inside updateGameVersionDb DB Query ", query, updateKeys)
	mongodb.adminDb.collection('gameVersions').update(query, { $set: updateKeys }, function (err, result) {
		// console.log("admindbQuery result====", err, result);
		cb(err, result);
	});
};

remote.countGameVersions = function (query, cb) {
	// console.log("Inside countGameVersions DB Query ", query)
	mongodb.adminDb.collection('gameVersions').count(query, function (err, result) {
		// console.log("err, result====", err, result);
		cb(err, result);
	});
};


remote.findGameVersions = function (query, cb) {
	// console.log("Inside findGameVersions DB Query ", query)
	var skip, limit;
	if (query.skip) {
		skip = query.skip;
	}
	else {
		skip = 0;
	}
	if (query.limit) {
		limit = query.limit;
	}
	else {
		limit = 0;
	}
	delete query.skip;
	delete query.limit;
	mongodb.adminDb.collection('gameVersions').find(query).skip(skip).limit(limit).sort({ '_id': -1 }).toArray(function (err, result) {
		// console.log("err, result====", err, result);
		cb(err, result);
	});
};

remote.updateServerStates = function (query, update, cb) {
	mongodb.adminDb.collection('serverStates').update(query, update, { upsert: true }, function (err, result) {
		cb(err, result);
	});
};

remote.findServerStates = function (query, cb) {
	mongodb.adminDb.collection('serverStates').findOne(query, function (err, result) {
		cb(err, result);
	});
};

remote.findAllServerStates = function (query, cb) {
	mongodb.adminDb.collection('serverStates').find(query).toArray(function (err, result) {
		cb(err, result);
	});
};


remote.getSubaffiliateListCount = function (query, cb) {
	mongodb.adminDb.collection('affiliates').count(query, function (err, result) {
		console.log("in admin db query-----------", result);
		cb(err, result);
	});
};

remote.createBonusPromo = function (query, data, cb) {
	mongodb.adminDb.collection('promoBonus').updateOne(query, { $set: data }, { upsert: true }, function (err, result) {
		cb(err, result);
	});
};

remote.deletePromoBonus = function (query, cb) {
	mongodb.adminDb.collection('promoBonus').deleteOne(query, function (err, result) {
		cb(err, result);
	});
};

remote.listPromoBonus = function (query, cb) {
	mongodb.adminDb.collection('promoBonus').find(query).toArray(function (err, result) {
		cb(err, result);
	});
};

remote.findLeaderboard = function (query, cb) {
	mongodb.adminDb.collection('leaderboard').findOne(query, function (err, result) {
		cb(err, result);
	});
};

remote.insertLeaderboard = function (query, cb) {
	mongodb.adminDb.collection('leaderboard').insertOne(query, function (err, result) {
		cb(err, result);
	});
};

remote.listLeaderboard = function (query, cb) {
	mongodb.adminDb.collection('leaderboard').find(query).toArray(function (err, result) {
		cb(err, result);
	});
};
remote.listLeaderboardOpts = function (query, projectFields, cb) {
	mongodb.adminDb.collection('leaderboard').find(query, { projection: projectFields }).toArray(function (err, result) {
		cb(err, result);
	});
};

remote.updateLeaderboard = function (query, updateData, cb) {
	mongodb.adminDb.collection('leaderboard').updateOne(query, { $set: updateData }, function (err, result) {
		cb(err, result);
	});
};

remote.updateLeaderboardSet = function (query, updateData, cb) {
	mongodb.adminDb.collection('leaderboardSet').updateOne(query, { $set: updateData }, function (err, result) {
		cb(err, result);
	});
};

remote.changeStatusLeaderboard = function (query, updateData, cb) {
	mongodb.adminDb.collection('leaderboard').updateMany(query, { $set: updateData }, function (err, result) {
		cb(err, result);
	});
};

remote.removeLeaderboard = function (query, cb) {
	mongodb.adminDb.collection('leaderboard').deleteOne(query, function (err, result) {
		cb(err, result);
	});
};

remote.getOneLeaderboardSet = function (query, cb) {
	mongodb.adminDb.collection('leaderboardSet').findOne(query, function (err, result) {
		cb(err, result);
	});
};

remote.updateLeaderboardSet = function (query, updateData, cb) {
	mongodb.adminDb.collection('leaderboardSet').updateOne(query, { $set: updateData }, function (err, result) {
		cb(err, result);
	});
};

remote.insertLeaderboardSet = function (query, cb) {
	mongodb.adminDb.collection('leaderboardSet').insertOne(query, function (err, result) {
		cb(err, result);
	});
};

remote.updateLeaderboardViewInSet = function (query, updateData, cb) {
	mongodb.adminDb.collection('leaderboardSet').updateOne(query, { $set: { "leaderboardList.$.onView": updateData } }, function (err, result) {
		cb(err, result);
	});
};

remote.createRegisterRake = function (query, cb) {
	mongodb.adminDb.collection(' rakeRegister').insertOne(query, function (err, result) {
		cb(err, result);
	});
};

remote.getRakebackConfig = function (cb) {
	mongodb.adminDb.collection('rakebackConfiguration').findOne({}, function (err, result) {
		cb(err, result);
	});
};

remote.createRakeReport = function (params, cb) {
	mongodb.adminDb.collection('rakeReport').insertOne(params, function (err, result) {
		cb(err, result);
	});
};

remote.createInvoice = function (params, cb) {
	mongodb.adminDb.collection('deposit').insertOne(params, function (err, result) {
		cb(err, result);
	});
}

for (var key in remote) {
	// console.log("===length",key, remote[key].length);



	module.exports[key] = function (key) {
		var args = [].slice.call(arguments);
		args.shift();
		var fn = args.pop();

		// console.log("---line 2382", args, key)

		var startTime = Number(new Date());
		args.push(function (err, result) {
			var endTime = Number(new Date());
			var gap = endTime - startTime;
			// console.log("adminDbQuery----gap", gap, key)
			// post analyticcs
			var data = {};
			data.section = "adminDbQuery_" + key;
			data.time = gap;
			data.size = 0;
			postData.saveData(data);
			fn(err, result);
		});
		remote[key].apply(null, args);
	}.bind(null, key);
} 