/*jshint node: true */
"use strict";

/* Created by Amrendra 24/10/2016 */

var _ld           = require("lodash"),
    _             = require('underscore'),
		async        	= require('async'),
		uuid 					= require('uuid'),
		stateOfX     	= require("../../../../../shared/stateOfX"),
		zmqPublish   	= require("../../../../../shared/infoPublisher"),
		keyValidator 	= require("../../../../../shared/keysDictionary"),
		db           	= require("../../../../../shared/model/dbQuery"),
		rewardRake   	= {};

//process rake to affiliate or sub affiliate
var processRaketoAffiliate = function(params, callback){
	console.log('processRaketoAffiliate'+JSON.stringify(params));
	var affdata = {};
	affdata.affiliateid = params.isParent;
	db.findaffiliate(affdata, function(err, subaffuserdata){
		var transactiondata = {}, affAmount = 0, subaffAmount = 0, adminAmount = 0, admindata = {};
		console.log("subaffuserdata"+JSON.stringify(subaffuserdata));
		if (!!subaffuserdata[0].isParent) {
			//previous user is sub affiliate needs to process previosly aff
			affdata.affiliateid = subaffuserdata[0].isParent;
			db.findaffiliate(affdata, function(err, affuserdata){
					if (err) {
						callback({success: false, info: "Something thing wrong"});
					} else {
					//manage affiliate data
					affAmount 		= Number((params.playerRake * affuserdata[0].rakeCommision)/100) ;
					//adminAmount 	= Number(params.playerRake - affAmount);
					subaffAmount 	= Number((affAmount * subaffuserdata[0].rakeCommision)/100) ;
					affAmount 		= Number(affAmount - subaffAmount);

					transactiondata.transactionid 		= params.transactionid;
					transactiondata.transactionByUserid = params.playerId;
					transactiondata.transactionByName 	= params.userName;
					transactiondata.transactionByRole 	= 'Player';

					transactiondata.transactionToUserid = affuserdata[0]._id;
					transactiondata.transactionToName 	= affuserdata[0].name;
					transactiondata.transactionToRole 	= affuserdata[0].role;
					transactiondata.transactionToAmount = affAmount;
					transactiondata.fundtransactionType = 'Debit';
					transactiondata.transactionReason	= 'Rake';
					transactiondata.transactionAction 	= 'Completed';
					transactiondata.transactionStatus	= "Completed";
					transactiondata.addeddate 			= new Date().getTime();
					transactionhistroy(transactiondata, function(res){
						//process to balance on affiliate
						manageaffandsubaffrakebal(affuserdata[0]._id, affAmount, function(res){
							//decrease comp bal
							managecompanyrakebal(affAmount, function(res){
								//process transaction histroy to admin
								admindata.transactionid 		= params.transactionid;
								admindata.transactionByUserid 	= params.playerId;
								admindata.transactionByName 	= params.userName;
								admindata.transactionByRole 	= 'Player';
								admindata.transactionByName 	= 'Company';
								admindata.transactionByRole 	= 'admin';
								admindata.transactionByAmount 	= affAmount;
								admindata.fundtransactionType 	= 'Credit';
								admindata.transactionReason		= 'Rake';
								admindata.transactionAction 	= 'Completed';
								admindata.transactionStatus		= "Completed";
								admindata.addeddate 			= new Date().getTime();
									transactionhistroy(admindata, function(res){

									});
							});

						});
					});
					// process to sub affiliate data
					var subaffdata = {};
					subaffdata.transactionid 		= params.transactionid;
					subaffdata.transactionByUserid = params.playerId;
					subaffdata.transactionByName 	= params.userName;
					subaffdata.transactionByRole 	= 'Player';

					subaffdata.transactionToUserid = subaffuserdata[0]._id;
					subaffdata.transactionToName 	= subaffuserdata[0].name;
					subaffdata.transactionToRole 	= subaffuserdata[0].role;
					subaffdata.transactionToAmount = subaffAmount;
					subaffdata.fundtransactionType = 'Debit';
					subaffdata.transactionReason	= 'Rake';
					subaffdata.transactionAction 	= 'Completed';
					subaffdata.transactionStatus	= "Completed";
					subaffdata.addeddate 			= new Date().getTime();
					transactionhistroy(subaffdata, function(res){
						//process to balance on affiliate
						manageaffandsubaffrakebal(subaffuserdata[0]._id, subaffAmount, function(res){
							//decrease comp bal
							managecompanyrakebal(subaffAmount, function(res){
								//process transaction histroy to admin
								var subadmindata = {};
								subadmindata.transactionid 		= params.transactionid;
								subadmindata.transactionByUserid 	= params.playerId;
								subadmindata.transactionByName 	= params.userName;
								subadmindata.transactionByRole 	= 'Player';
								subadmindata.transactionToName 	= 'Company';
								subadmindata.transactionToRole 	= 'admin';
								subadmindata.transactionToAmount 	= subaffAmount;
								subadmindata.fundtransactionType 	= 'Credit';
								subadmindata.transactionReason		= 'Rake';
								subadmindata.transactionAction 	= 'Completed';
								subadmindata.transactionStatus		= "Completed";
								subadmindata.addeddate 			= new Date().getTime();
									transactionhistroy(subadmindata, function(res){

									});
							});


						});
					});
					//fund rate date entry
          console.log('paramsparamsparamsparams', JSON.stringify(params));
					var fundrake = {};
        fundrake.rakeRefType        = params.rakeRefType;
        fundrake.rakeRefVariation   = params.rakeRefVariation;
        fundrake.rakeRefSubType     = params.rakeRefSubType;
        fundrake.rakeRefId          = params.rakeRefId;
				fundrake.transactionid 			=  params.transactionid;
				fundrake.rakeByUserid			= params.playerId;
				fundrake.rakeByUsername 		= params.userName;
				fundrake.amount 				= params.playerRake;
				fundrake.debitToCompany 		= Number(params.playerRake - ( affAmount + subaffAmount));
				fundrake.debitToAffiliateid 	= (affuserdata[0]._id).toString();
				fundrake.debitToAffiliatename 	= affuserdata[0].userName;
				fundrake.debitToAffiliateamount	= affAmount;
				fundrake.debitToSubaffiliateid  = (subaffuserdata[0]._id).toString();
				fundrake.debitToSubaffiliatename = subaffuserdata[0].userName;
				fundrake.debitToSubaffiliateamount = subaffAmount;
				fundrake.addeddate 				= new Date().getTime();
				// managerakefund(fundrake, function(res){});

					}
				});
		} else {
			//previous user is affiliate direly process to aff & admin
			affAmount = Number((params.playerRake * subaffuserdata[0].rakeCommision)/100) ;

			transactiondata.transactionid 		= params.transactionid;
			transactiondata.transactionByUserid = params.playerId;
			transactiondata.transactionByName 	= params.userName;
			transactiondata.transactionByRole 	= 'Player';
			transactiondata.transactionToUserid = subaffuserdata[0]._id;
			transactiondata.transactionToName 	= subaffuserdata[0].name;
			transactiondata.transactionToRole 	= subaffuserdata[0].role;
			transactiondata.transactionByAmount = affAmount;
			transactiondata.fundtransactionType = 'Debit';
			transactiondata.transactionReason	= 'Rake';
			transactiondata.transactionAction 	= 'Completed';
			transactiondata.transactionStatus	= "Completed";
			transactiondata.addeddate 			= new Date().getTime();

			transactionhistroy(transactiondata, function(res){
				//process to balance on affiliate
				manageaffandsubaffrakebal(subaffuserdata[0]._id, affAmount, function(res){
				//	console.log('get after rake update'+res)
				//drcrease company bal
					managecompanyrakebal(affAmount, function(res){
						//manage admin transaction histroy
						admindata.transactionid 		= params.transactionid;
						admindata.transactionByUserid = params.playerId;
						admindata.transactionByName 	= params.userName;
						admindata.transactionByRole 	= 'Player';
						admindata.transactionToName 	= 'Company';
						admindata.transactionToRole 	= 'admin';
						admindata.transactionToAmount 	= affAmount;
						admindata.fundtransactionType 	= 'Credit';
						admindata.transactionReason		= 'Rake';
						admindata.transactionAction 	= 'Completed';
						admindata.transactionStatus		= "Completed";
						admindata.addeddate 			= new Date().getTime();
						transactionhistroy(admindata, function(res){

						});
					});
				//manage fund rake from table
        console.log('paramsparamsparamsparams', JSON.stringify(params));
				var fundrake = {};
        fundrake.rakeRefType        = params.rakeRefType;
        fundrake.rakeRefVariation   = params.rakeRefVariation;
        fundrake.rakeRefSubType     = params.rakeRefSubType;
        fundrake.rakeRefId          = params.rakeRefId;
				fundrake.transactionid 			=  params.transactionid;
				fundrake.rakeByUserid			= params.playerId;
				fundrake.rakeByUsername 		= params.userName;
				fundrake.amount 				= params.playerRake;
				fundrake.debitToCompany 		= Number(params.playerRake - affAmount);
				fundrake.debitToAffiliateid 	= (subaffuserdata[0]._id).toString();
				fundrake.debitToAffiliatename 	= subaffuserdata[0].userName;
				fundrake.debitToAffiliateamount	= affAmount;
				fundrake.addeddate 				= new Date().getTime();
				// managerakefund(fundrake, function(res){});

				});

			});

		}
	});
};
//distribute rake
 var distributeRake = function(params, cb){
	console.log('params.rakeToAffiliates - ' + JSON.stringify(params.rakeToAffiliates));

	var playerdata = params.rakeToAffiliates.players;
	console.log('player length'+ playerdata.length);
	if (playerdata.length > 0) {
		async.eachSeries(playerdata, function(playerdetails, callback){
      playerdetails.rakeRefType         = params.rakeToAffiliates.rakeRefType;
      playerdetails.rakeRefVariation    = params.rakeToAffiliates.rakeRefVariation;
      playerdetails.rakeRefSubType      = params.rakeToAffiliates.rakeRefSubType;
      playerdetails.rakeRefId           = params.rakeToAffiliates.rakeRefId;
		console.log('transactionid transactionidtransactionid'+JSON.stringify(playerdetails));
		async.waterfall([

			async.apply(findPlayerParentforRake, playerdetails),
			chkProcessforRake,
			processRaketoAffiliate

			], function(err, result){
				console.log('err and result in waterfall');
				console.log(err);
				console.log(result);
				if (err) {
					if(err.success) {
						callback(null, {status: true, info: "Commission Distributed !!"});
					} else {
						callback({status: false, info:"Commission Distribution failed !! - " + JSON.stringify(err)});
					}
				} else {
					// cb(result);
					callback(null, {status: true, info: "Commission Distributed !!"});
				}
			});


		}, function(err){
			if (err) {
				console.log('error on rakeCommision'+JSON.stringify(err));
				cb({status:false, info:"Error occurred while commission distribution !!"});
			} else {
				console.log('commission updated & manage transaction histroy for admin');
				//transaction histroy for admin bal
				cb(null, params);
			}
		});
	} else {
		console.log('No players passed for rake calculation, skipping.');
		cb(null, params);
	}
};
//find player parent
var findPlayerParentforRake = function(params, callback){
	console.log('Player info'+JSON.stringify(params) );
	var player = {};
	player.playerId = params.playerId;
	db.findUser(player, function(err, result){
		if (err) {
			callback({success: false, info: "Something went wrong lines 264"});
		} else {
			result.playerRake 		     = params.rakeAmount;
			result.transactionid 	     = uuid.v4();
      result.rakeRefType         = params.rakeRefType;
      result.rakeRefVariation    = params.rakeRefVariation;
      result.rakeRefSubType      = params.rakeRefSubType;
      result.rakeRefId           = params.rakeRefId;
      console.log('params result', JSON.stringify(result));
      params.result = result;
			callback(null, params);
		}
	});
};
//check process for rake , admin, affiliate or sub affiliate needs to process
var chkProcessforRake = function(params, callback){
	console.log('chkProcessforRake'+JSON.stringify(params));
	//if user has parent then rake will be distributed on affiliate & sub aff also
	//if (params.isParent) {
	//	callback(null, params);
//	} else {
		//process to directly to admin on transaction histroy
		var admindata = {};
    var params = params.result;
		var adminAmount = params.playerRake;
		admindata.transactionid 		= params.transactionid;
		admindata.transactionByUserid = params.playerId;
		admindata.transactionByName 	= params.userName;
		admindata.transactionByRole 	= 'Player';

		admindata.transactionToName 	= 'admin';
		admindata.transactionToRole 	= 'admin';
		admindata.transactionToAmount 	= adminAmount;
		admindata.fundtransactionType 	= 'Debit';
		admindata.transactionReason		= 'Rake';
		admindata.transactionAction 	= 'Completed';
		admindata.transactionStatus		= "Completed";
		admindata.addeddate 			= new Date().getTime();
		transactionhistroy(admindata, function(res){
			//console.log('!!!!!!!!!!!!!!!!!!!!!'+JSON.stringify('res'))
			//process to balance on Company account
			var CompanyId = '57bfcebef29de70c75a30659';
			manageaffandsubaffrakebal(CompanyId, adminAmount, function(res){
			//	console.log('@@@@@@@@@@@@@@@@@@@@@'+JSON.stringify(res));
				if (params.isParent) {
					callback(null, params);
				} else {
					//manage fund rake for admin
					var fundrake = {};
					fundrake.transactionid 	= params.transactionid;
					fundrake.rakeByUserid 	= params.playerId;
					fundrake.rakeByUsername = params.userName;
					fundrake.amount 		= adminAmount;
					fundrake.debitToCompany	= adminAmount;
					fundrake.addeddate		= new Date().getTime();

						// managerakefund(fundrake, function(res){
							callback(res);
						// });
				}

			});
		});
	//}

};

//manage transaction his
var transactionhistroy = function(data, callback){
console.log('transactionhistroy data'+JSON.stringify(data));
	db.fundtransferhistroy(data, function(err, result){
		if (err) {
			callback({success: false, info: "Something went wrong"});
		} else {
			callback({success: true, info: "fund successfully transfered"});
		}
	});
};
//manage fund rake for company , affiliate & sub affiliate to manage report
// var managerakefund = function(data, callback){
// 	db.fundrake(data, function(err, result){
// 		if (err) {
// 			callback({success: false, info: "Something went wrong"});
// 		} else {
// 			callback({success: true, info: "Rake fund submitted successfully"});
// 		}
// 	});
// };
//manage aff & sub aff rake bal
var manageaffandsubaffrakebal = function(userid, balance, callback){
	//console.log('manageaffandsubaffbal'+JSON.stringify(userid)+'balance'+balance);
	var userbal = {};
	userbal.balance = balance;
	userbal.rakebalance = balance;
	manageaffiliatebal( userid, userbal, function(res){
		callback(null, res);
	});

};

var manageaffiliatebal = function(userid, data, callback){
	db.updateteAffiliateRakeBalance(data, userid, function(err, result){
		if (err) {
			callback({success: false, info:"Something went wrong"});
		} else {
			callback({success: true, info: "You amount has been transfred to selected user"});
		}
	});
};
//decrease company bal after process rake commision affiliate or sub affiliate
var managecompanyrakebal = function(balance, callback){
	var bal = {};
	bal.balance = -balance;
	bal.rakebalance = -balance;
	managecompanybal(bal, function(res){
		callback(res) ;
	});
};
//decrease comp chips
var managecompanychipsbal = function(balance, callback){
	var bal = {};
	bal.balance = -balance;
	bal.chipsbalance = -balance;
	managecompanybal(bal, function(res){
		callback(res) ;
	});
};

//manage comp bal
var managecompanybal = function(balancedata, callback){
	db.companyRakeBalance(balancedata, function(err, result){
		if (err) {
			callback({success: false, info: "Something went wrong"});
		} else {
			callback({success: true, info: "Company bal is going to decrease after rake commision"});
		}
	});
};

var setInputKeysNormal = function (params, cb) {
	params.rakeToAffiliates.rakeRefId        = params.channelId;
	params.rakeToAffiliates.rakeRefType      = stateOfX.gameType.normal;
	params.rakeToAffiliates.rakeRefVariation = params.table.channelVariation;
	params.rakeToAffiliates.rakeRefSubType   = "";
	params.rakeToAffiliates.players          = [];
	console.log('Rake details - ' + JSON.stringify(params.rakeDetails));
	var playerContribution = 0;
	async.each(params.table.contributors, function(contributor, ecb) {
		console.log('Processing contributor - ' + JSON.stringify(contributor));
		params.rakeToAffiliates.players.push({
			playerId		: contributor.playerId,
			rakeAmount	: params.rakeDetails.totalRake * ( contributor.amount / params.rakeDetails.totalPotAmount)
		});
		ecb();
	}, function(err) {
		if(!err) {
			cb(null, params);
		} else {
			cb(err);
		}
	});
};

rewardRake.processRakeDistribution = function (params, cb) {
  console.log('In rewardRake function processRakeDistribution');
  console.log("=========== RAKE DISTRIBUTION STARTED ===========");
	params.rakeToAffiliates = {};
  async.waterfall([

    async.apply(setInputKeysNormal, params),
    distributeRake

  ], function(err, response){
  	console.log("=========== RAKE DISTRIBUTION FINISHED ===========");
    cb(err, response);
  });
};

var getTournamentRoom = function(params, cb) {
  console.log("in get tournament room in tournament rake " + JSON.stringify(params));
  db.getTournamentRoom((params.tournamentId).toString(), function(err, tournamentRoom) {
    console.log("tournament room is - " + JSON.stringify(tournamentRoom));
    if(err || !tournamentRoom) {
			cb({success : false, info: "Error in getting tournament Room"});
		} else {
      params.rakeAmount       = tournamentRoom.housefees;
      params.rakeRefId        = params.tournamentId;
      params.rakeRefType      = stateOfX.gameType.tournament;
      params.rakeRefVariation = tournamentRoom.channelVariation;
      params.rakeRefSubType   = tournamentRoom.tournamentType;
      params.gameVersionCount = tournamentRoom.gameVersionCount;
      cb(null, params);
    }
	});
};

var getTournamentUsers = function(params, cb) {
  console.log(" in get tournament users" + JSON.stringify(params));
  db.findTournamentUser({tournamentId: params.tournamentId, gameVersionCount: params.gameVersionCount},function(err, result) {
    if(err) {
      cb({success: false, info: "Error in getting tournamentUser"});
    } else {
      if(!!result) {
        var playerIds = _.pluck(result,'playerId');
        params.playerIds = playerIds;
        cb(null,params);
      } else {
        cb({success: false, info: "No tournament users for this this tournament"});
      }
    }
  });
};

var createResponse = function(params, cb) {
  console.log(" in get createResponse " + JSON.stringify(params));
  console.log(" playerIds in get createResponse " + JSON.stringify(params.playerIds.length));
  var tempData = [];
  for(var playerIt=0; playerIt<params.playerIds.length; playerIt++) {
    tempData.push({
      playerId : params.playerIds[playerIt],
      rakeAmount : params.rakeAmount
    });
  }
  console.log("temp data in create response in tournamentRake is - " + JSON.stringify(tempData));
  var result = {};
  result.rakeToAffiliates = {
    rakeRefId        : params.rakeRefId,
    rakeRefType      : params.rakeRefType,
    rakeRefVariation : params.rakeRefVariation,
    rakeRefSubType   : params.rakeRefSubType,
    players          : tempData
  };
  console.log("create response in tournament rake process - " + JSON.stringify(result));
  cb(null, result);
};

//Input - {tournamentId}
rewardRake.tournamentRakeProcess = function(params, cb) {
  console.log("in tournament rake process - ", JSON.stringify(params));
  async.waterfall([
    async.apply(getTournamentRoom,params),
    getTournamentUsers,
    createResponse,
    distributeRake
  ], function(err, response) {
    if(err) {
      console.log("Error occured in tournament rake process");
      cb(err);
    } else {
      cb({success : true, result : response});
    }
  });
};

module.exports = rewardRake;
