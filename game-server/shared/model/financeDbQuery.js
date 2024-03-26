/*jshint node: true */
"use strict";

var mongodb         = require('../mongodbConnection');
var ObjectID        = require('mongodb').ObjectID;
var postData = require('../postData.js');
var moment = require("moment");

var remote = {};

/*balance sheet mgmt queries starts here*/

remote.getTotalRakebackReleased = function(query, callback){
  mongodb.financeDB.collection('playerRakeBack').aggregate([{$match : query},{$group :{_id : "_id",totalRakeBackReleased : {$sum : "$playerRakeBack"}}}]).toArray(function(err, result){
      callback(err, result);
    });
};

remote.getAffOrAgentRakeGenerated = function(query,fieldNameToSum,callback){
  mongodb.financeDB.collection('fundrake').aggregate([{$match : query},{$group :{_id : "_id",totalRakeGenerated : {$sum : fieldNameToSum}}}]).toArray(function(err, result){
      callback(err, result);
    });
};

remote.getUserRakeDataForBalanceSheet = function(query, callback){
  mongodb.financeDB.collection('fundrake').aggregate([{$group :{_id : "_id",totalRake : {$sum : "$amount"},totalGST : {$sum : "$GST"},totalRakeToAdmin : {$sum :"$debitToCompany"},totalRakeToAffiliate : {$sum : "$debitToAffiliateamount"},totalRakeToSubAffiliate : {$sum : "$debitToSubaffiliateamount"}, totalPlayerRakeBack:{$sum : "$playerRakeBack"}}}]).toArray(function(err, result){
      callback(err, result);
    });
};

remote.insertDataInDailyBalanceSheet = function(data, callback){
  mongodb.financeDB.collection('dailyBalanceSheet').insert(data, function(err, result){
    callback(err, result);
  });
};

remote.findAllBalanceSheetDataForDashboard = function(query,callback){
  mongodb.financeDB.collection('dailyBalanceSheet').find(query).sort({createdAt: -1}).toArray(function(err, result){
    callback(err, result);
  });
};

/*balance sheet mgmt queries ends here*/

/** rake back monthly report query starts */
remote.listRakeBackMonthlyReport = function(query, callback){
  var skip = query.skip || 0;
  var limit = query.limit || 0;
  delete query.skip;
  delete query.limit;
  console.log("query-->",query); 
  mongodb.financeDB.collection('fundrake').aggregate([{$match : query} ,{$group: { _id: "$rakeByUsername" ,totalAdminRake: {$sum: "$debitToCompany"} , totalGst :{$sum: "$GST"}, totalAffRake : {$sum: "$debitToAffiliateamount"}, totalSubAffRake : {$sum : "$debitToSubaffiliateamount"}}}]).toArray(function(err, result){
      callback(err, result);
    });
};

/*----------------- fund rake query START ---------------------*/

remote.fundrake = function(userdata, callback){
  mongodb.financeDB.collection('fundrake').insert(userdata, function(err, result){
    callback(err, result);
  });
};
/*----------------- fund rake query END ---------------------*/


//__________________ balance sheet query start _______________

remote.updateBalanceSheet = function(query, callback){
  mongodb.financeDB.collection('balanceSheet').update({},query, function(err, result){
    callback(err, result);
  });
};

remote.countBalanceSheet = function(callback){
  mongodb.financeDB.collection('balanceSheet').count({}, function(err, result){
    callback(err, result);
  });
};

remote.createBalanceSheet = function(balanceSheetData,callback){
  mongodb.financeDB.collection('balanceSheet').insert( balanceSheetData, function(err, result){
    callback(err, result);
  });
};

remote.findBalanceSheet = function(callback){
  mongodb.financeDB.collection('balanceSheet').findOne({}, function(err, result){
    callback(err, result);
  });
};

//__________________ balance sheet query end _______________


//Create player Rake back Entry
remote.playerRakeBack = function(params, callback){
  var handsPlayed = 1;
  var playerRakeBack = params.playerRakeBack;
  var amount = params.amount;
  var amountGST = params.amountGST;
  delete params.playerRakeBack;
  delete params.handsPlayed;
  // delete params.amount;
  delete params.amountGST;
  mongodb.financeDB.collection('playerRakeBack').update({createdAt: params.addedDate,rakeByUsername:params.rakeByUsername}, {$set:params,$inc:{playerRakeBack:playerRakeBack,handsPlayed:handsPlayed,amount:amount,amountGST:amountGST}}, {upsert: true}, function(err, result){
    console.trace(result);
    console.trace(err);
    console.trace("i m being the lone wolf");
    callback(err, result);
    // if (!err && result) {
    //   mongodb.adminDb.collection('rakeReport').insertOne({ name: params.rakeByUsername, tableId: params.tableId, handId: params.handId, playerId: params.rakeByUserid, rakeAmount: amount, isBot: params.isBot, timestamp: moment().toISOString(), startTime: params.addedDate }, function (err, result1) {
    //     callback(err, result);
    //   })
    // }
  });
};

remote.playerHandsPlayedRakeBack = function(params, callback){
  var handsPlayed = params.handsPlayed;
  
  delete params.handsPlayed;
  
  mongodb.financeDB.collection('playerRakeBack').update({createdAt: params.addedDate,rakeByUsername:params.rakeByUsername}, {$set:{handsPlayed:handsPlayed}}, function(err, result){
    console.trace(result);
    console.trace(err);
    console.trace("i m being the lone wolf");
    callback(err, result);
  });
};

remote.playerRakeBackDateData = function(params, callback){
 
  mongodb.financeDB.collection('playerRakeBack').find(params).toArray(function(err, result){
    console.trace(result);
    console.trace(err);
    console.trace("i m being the lone wolf");
    callback(err, result);
  });
};
 
remote.updateStatusOfManyRakeBackData = function(params, callback){
 
 var transferAt = Number(new Date());
  mongodb.financeDB.collection('playerRakeBack').updateMany(params,{'$set' : {transfer:true,transferAt:transferAt}},function(err, result){
    console.trace(result);
    console.trace(err);
    console.trace("i m being the lone wolf");
    callback(err, result);
  });
};

remote.addBalanceDetailsInRakeback = function(params, callback){
  mongodb.financeDB.collection('playerRakeBack').updateOne({_id: ObjectID(params.id)}, {$set: {prevBalance: params.prevBalance, newBalance: params.newBalance}}, function(err, result){
    console.log(err);
    console.log(result);
    console.trace("Balance in rake back updated");
    callback(err, result);
  });
};


//___________  fund transaction history ________________
//
remote.fundtransferhistroy = function(req, callback){
    console.log('manage fund tranfer '+req);
    callback();
    // mongodb.financeDB.collection('fundtransactionhistroy').insert(req, function(err, result){
    //   callback(err, result);
    // })
};


remote.getRakeDataCount = function(query, callback){
  console.log('getRakeDataCount ', query);
  mongodb.financeDB.collection('fundrake').count(query, function(err, result){
    callback(err, result);
  });
};

remote.getRakeData = function(query, callback){
  // console.log('getRakeData ', query);
  var skip = query.skip || 0;
  var limit = query.limit || 0;
  delete query.skip;
  delete query.limit;
  mongodb.financeDB.collection('fundrake').find(query).skip(skip).limit(limit).toArray(function(err, result){
    callback(err, result);
  });
};

remote.getRakeDataDescending = function(query, callback){
  // console.log('getRakeDataDescending ', query);
  var skip = query.skip || 0;
  var limit = query.limit || 0;
  var sortValue = query.sortValue;
  // console.log(sortValue);
  delete query.sortValue;
  delete query.skip;
  delete query.limit;
  mongodb.financeDB.collection('fundrake').find(query).skip(skip).limit(limit).sort({[sortValue]: -1}).toArray(function(err, result){
    callback(err, result);
  });
};

remote.findTotalRake = function(query, callback) {
  mongodb.financeDB.collection('fundrake').find(query).toArray(function (err, result) {
    callback(err, result);
  });
};

//unused query (redundant also -- Feb 9 2019 //digvijay)
// remote.findPlayerFromFundRake = function(query, cb){
//   console.log("inside findPlayerFromFundRake  dbquery------ ", query);
//   // var newQuery = {};
//   // var projectionQuery = {};
//   // if(query.userName){
//   //   newQuery.userName = query.userName;
//   // }
//   // var skip = query.skip || 0;
//   // var limit = query.limit || 0;
//   mongodb.financeDB.collection('fundrake').find(query).toArray(function (err, result) {
//     // console.log("result in findPlayerFromFundRake---- ",JSON.stringify(result));
//     cb(err, result);
//   });
// };

remote.findTotalRakeGenerated = function(query, groupBy, aggregateBy, cb){
    // console.log("---line111-----------------===", query, groupBy, aggregateBy);
  mongodb.financeDB.collection('fundrake').aggregate([{ $match: query }, {$group : {_id : groupBy, amount : {$sum : aggregateBy }}}]).toArray(function(err, result){
    // console.log("---line112-----------------===", query, err, result);
    cb(err, result);
  });
};


remote.getRakebackDataCount = function(query, callback){
  console.log('getRakebackDataCount ', query);
  mongodb.financeDB.collection('playerRakeBack').count(query, function(err, result){
    callback(err, result);
  });
};

remote.getRakebackData = function(query, callback) {
  var skip = query.skip || 0;
  var limit = query.limit || 0;
  delete query.skip;
  delete query.limit;
  mongodb.financeDB.collection('playerRakeBack').find(query).skip(skip).limit(limit).sort({transferAt : -1}).toArray(function(err, result){
    callback(err, result);
  });
};

for (var key in remote) {
  // console.log("===length",key, remote[key].length);

  

  module.exports[key] = function(key){
    var args = [].slice.call(arguments);
    args.shift();
    var fn = args.pop();

    // console.log("---line 27", args, key)

    var startTime = Number(new Date());
    args.push(function(err, result){
      var endTime = Number (new Date());
      var gap = endTime - startTime;
      // console.log("financeDB----gap", gap, key)
      // post analyticcs
      var data = {};
      data.section = "financeDb_"+key;
      data.time = gap;
      data.size = 0;
      postData.saveData(data);
      fn(err, result);
    });
    remote[key].apply(null, args);
  }.bind(null, key);
}  

