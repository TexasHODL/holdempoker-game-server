/*jshint node: true */
"use strict";

var mongodb  = require('../mongodbConnection.js');
var ObjectID = require('mongodb').ObjectID;
var postData        = require('../postData.js');


var remote = {};

/*balance sheet mgmt query start here*/

remote.getPlayerTotalChipsOnTable = function(query,cb){
	console.log("Inside getPlayerTotalChipsOnTable db query -->", query);
	mongodb.inMemoryDb.collection('tables').aggregate([{$unwind : "$players"},{$group : {_id : "_id", totalChips: {$sum : "$players.chips"}, totalInstantChips:{$sum : "$players.instantBonusAmount"}}}]).toArray(function(err, result){
		console.log("Inside getPlayerTotalChipsOnTable err,result-->\n",err, result);
		cb(err, result);
	});
};

remote.getPotAmountOnAllTables = function(query,cb){
	console.log("Inside getPotAmountOnAllTables db query -->", query);
	mongodb.inMemoryDb.collection('tables').aggregate([{$unwind : "$pot"},{$group : {_id : "_id", totalPotAmountOnAllTables: {$sum : "$pot.amount"}}}]).toArray(function(err, result){
		console.log("Inside getPotAmountOnAllTables err,result-->\n",err, result);
		cb(err, result);
	});
};

remote.getTotalRoundBetAmountInGame = function(query,cb){
	console.log("Inside getTotalRoundBetAmountInGame db query -->", query);
	mongodb.inMemoryDb.collection('tables').aggregate([{$unwind : "$roundBets"},{$group : {_id : "_id", totalRoundBets: {$sum : "$roundBets"}}}]).toArray(function(err, result){
		console.log("Inside getTotalRoundBetAmountInGame err,result-->\n",err, result);
		cb(err, result);
	});
};

/*balance sheet mgmt query ends here*/

// remote.saveDHClientSecretKey = function(secret, clientId, cb){
// 	mongodb.inMemoryDb.collection('clientSecret').update({'clientId': clientId},{'clientId': clientId, 'secret': secret}, {upsert: true},function(err, result) {
// 		cb(err, result);
// 	});
// };

// remote.getDHClientSecretKey = function(clientId, cb){
// 	mongodb.inMemoryDb.collection('clientSecret').findOne({'clientId': clientId}, function(err, result) {
// 		cb(err, result);
// 	});
// };

// remote.saveServerPublicPrivateKey = function(publickey, privatekey, cb){
// 	mongodb.inMemoryDb.collection('serverkey').update({'whome': 'server'},{'whome': 'server', 'public': publickey, 'private': privatekey}, {upsert: true},function(err, result) {
// 		cb(err, result);
// 	});
// };

// remote.getPublicKey = function(cb){
// 	mongodb.inMemoryDb.collection('serverkey').findOne({},{public: 1, _id:0},function(err, result) {
// 		cb(err, result);
// 	});
// };

// remote.getPrivateKey = function(cb){
// 	mongodb.inMemoryDb.collection('serverkey').findOne({},{private: 1},function(err, result) {
// 		cb(err, result);
// 	});
// };


// ### Handle queries related to in game table data

// > Save table object
// remote.saveTable = function(params, cb){
// 	mongodb.inMemoryDb.collection('tables').insert(params, function(err, result) {
// 		cb(err, result);
// 	});
// };

remote.removeTable = function(params, cb){
	mongodb.inMemoryDb.collection('tables').remove({channelId: params.channelId}, function(err, result) {
		cb(err, result);
	});
};

remote.saveTable = function(params, cb){
	mongodb.inMemoryDb.collection('tables').update({channelId: params.channelId},params, {upsert: true}, function(err, result) {
		cb(err, result);
	});
};

// get players on the table
remote.getPlayers = function(cb){
	mongodb.inMemoryDb.collection('tables').aggregate([{$project :{channelId: 1, onlinePlayers: {$size: "$players"}}}], function(err, result) {
		cb(err, result);
	});
};

// > Get all in memory tables
remote.getAllTable = function(filter, cb){
	mongodb.inMemoryDb.collection('tables').find(filter).toArray(function(err, result) {
		cb(err, result);
	});
};

// find running table
remote.findRunningTable = function(filter, cb){
	mongodb.inMemoryDb.collection('tableJoinRecord').find(filter).toArray(function(err, result) {
		cb(err, result);
	});
};

// > Get table object
remote.getTable = function(channelId, cb){
	mongodb.inMemoryDb.collection('tables').findOne({"channelId": channelId.toString()}, function(err, result) {
		cb(err, result);
	});
};

// updates multiple tables
remote.updateAllTable = function(filter, fieldUpdate, cb){
	mongodb.inMemoryDb.collection('tables').update(filter, {$set:fieldUpdate}, {multi: true}, function(err, result) {
		console.log("err, result in inMemoryDb", err, result);
		cb(err, result);
	});
};

remote.updateSeats = function(channelId, fieldUpdate, cb){
	console.log(channelId, fieldUpdate);
	mongodb.inMemoryDb.collection('tables').update({"channelId": channelId}, {$set: fieldUpdate}, function(err, result) {
		cb(err, result);
	});
};
// push new players in player array in tables
remote.pushPlayersInTable = function(players, channelId, cb) {
	console.log("players and channelId is in pushPlayersInTable is in inMemoryDbQuery- ",JSON.stringify(players),channelId);
	mongodb.inMemoryDb.collection('tables').update({"channelId": channelId.toString()}, {$push: {players: {$each: players}}}, function(err, result) {
		// console.log("result is - ",result);
		mongodb.inMemoryDb.collection('tables').findOne({"channelId": channelId.toString()}, function(err, result1) {
			console.log("result1 is - ",JSON.stringify(result1));
			cb(err, result);
		});
	});
};

remote.updateTableShuffleId = function(channelToBeFilledId, channelId, cb) {
	console.log("channelToBeFilledId and channelId is in updateTableShuffleId is in inMemoryDb-", channelToBeFilledId, channelId);
	mongodb.inMemoryDb.collection('tables').update({channelId: (channelToBeFilledId).toString()},{$set:{shuffleTableId : (channelId).toString()}}, function(err, result) {
		//console.log("result is in updateTableShuffleId is in inMemoryDb- ",result);
		cb(err, result);
	});
};

// > Find tables by tournamentId
remote.findTableByTournamentId = function(tournamentId, playerId, cb) {
	console.log("params in findTableByTournamentId ",tournamentId,playerId);
	mongodb.inMemoryDb.collection('tables').find({"tournamentRules.tournamentId": tournamentId},{tournamentRules: 1,players: 1}).toArray(function(err, result) {
		cb(err, result);
	});
};

// > Find tables by tournamentId
remote.getAllTableByTournamentId = function(params, cb) {
	console.log("params in findTableByTournamentId in inMemoryDbQuery - ",params);
	mongodb.inMemoryDb.collection('tables').find({"tournamentRules.tournamentId": params.tournamentId, gameVersionCount: params.gameVersionCount}).toArray(function(err, result) {
		// console.log(result);
		cb(err, result);
	});
};



remote.findChannels = function(params, cb) {
	console.log("params in findTableByTournamentId in inMemoryDbQuery - ",params);
	mongodb.inMemoryDb.collection('tables').find({"tournamentRules.tournamentId": params.tournamentId}).toArray(function(err, result) {
		cb(err, result);
	});
};

remote.getPlayerChannel = function(tournamentId,playerId, cb) {
	console.log("params in getPlayerChannel ",tournamentId,playerId);
	mongodb.inMemoryDb.collection('tables').findOne({"tournamentRules.tournamentId": tournamentId.toString(), "players.playerId": playerId.toString()}, function(err, result) {
//		console.log("result from getPlayerChannel ",result);
		cb(err, result);
	});
};

remote.upsertRanks = function(query, data, callback) {
	console.log("query, data ",query, data);
	mongodb.inMemoryDb.collection('ranks').update(query,{$set: data},{upsert: true}, function (err, response) {
		// console.log("result in upsertTournamentUser ",response.result);
		callback(err, response.result);
	});
};

remote.getRanks = function(query,callback) {
	console.log("query -- in getRanks ",query);
	mongodb.inMemoryDb.collection('ranks').findOne({tournamentId:query.tournamentId, gameVersionCount: query.gameVersionCount}, function (err, response) {
		console.log("result in getRanks ",response);
		callback(err, response);
	});
};

// Store join player records, a player joins a table record
remote.savePlayerJoin = function(params, cb){
	mongodb.inMemoryDb.collection('tableJoinRecord').insert(params, function(err, result) {
		cb(err, result);
	});
};

// Store join player records, if found already then update it
remote.upsertPlayerJoin = function (query, update, cb) {
	mongodb.inMemoryDb.collection('tableJoinRecord').update(query, update, {upsert: true}, function (err, result) {
		cb(err, result);
	});
};

// Remove player record from join channel
remote.removePlayerJoin = function(filter, cb){
	mongodb.inMemoryDb.collection('tableJoinRecord').remove(filter, function(err, result) {
		cb(err, result);
	});
};

// Check if record exists and player alredy joined channel
remote.isPlayerJoined = function(filter, cb){
	mongodb.inMemoryDb.collection('tableJoinRecord').count(filter, function(err, result){
		cb(err, result);
	});
};

remote.playerJoinedRecord = function(filter, cb){
	mongodb.inMemoryDb.collection('tableJoinRecord').find(filter,{_id:0}).toArray(function(err, result){
		cb(err, result);
	});
};

// remote.insertSpamWords = function(spamWords,cb){
// 	mongodb.inMemoryDb.collection('chatFilter').update({},{$set:{"spamWords":spamWords}},{upsert:true},function(err,result){
// 		console.log("inserted");
// 		cb(err,result);
// 	});
// };

// Stores userActivity of join tables
remote.upsertActivity = function(query, data, cb){
	data.updatedAt = Number(new Date());
	console.log('query - ',query);
	console.log('data - ',data);
	mongodb.inMemoryDb.collection('userActivity').update(query, data, {upsert: true}, function(err,result){
		cb(err,result);
	});
};

remote.updateIsSit = function(query, cb){
	mongodb.inMemoryDb.collection('userActivity').update(query, {$set:{isSit: true}}, function(err,result){
		cb(err,result);
	});
};

// Deleting all the activity of a user by his player id
remote.removeActivity = function(filter, cb){
	mongodb.inMemoryDb.collection('userActivity').remove(filter, function(err,result){
		cb(err,result);
	});
};

/* --------------- Logging record starts -----------------------*/
remote.insertLog = function(params, callback) {
   mongodb.inMemoryDb.collection('infoLogs').insert({"createdAt": new Date(), log: params.log}, function (err, result) {
       callback(err, result);
   });
};
/* --------------- Logging record ends -----------------------*/

remote.updateOnlinePlayers = function(onlinePlayers) {
	mongodb.inMemoryDb.collection('onlinePlayers').update({},{"onlinePlayers" : onlinePlayers}, {upsert: true}, function(err, result) {
	});
};

remote.addPlayerAsSpectator = function(data, callback) {
	mongodb.inMemoryDb.collection('spectators').insert(data, function(err, result) {
		callback(err, result.ops[0]);
	});
};

remote.removePlayerAsSpectator = function(query, callback) {
	mongodb.inMemoryDb.collection('spectators').remove(query, function(err, result) {
		callback(err, result);
	});
};

remote.updatePlayerSetting = function(query, updateKeys, callback) {
	mongodb.inMemoryDb.collection('spectators').update(query, updateKeys, function(err, result){
    callback(err, result);
  });
};

remote.findPlayerAsSpectator = function(query, callback) {
	mongodb.inMemoryDb.collection('spectators').findOne(query, function(err, result) {
		callback(err,result);
	});
};


for (var key in remote) {
  // console.log("===length",key, remote[key].length);

  

  module.exports[key] = function(key){
    var args = [].slice.call(arguments);
    args.shift();
    var fn = args.pop();

    // console.log("---line 2382", args, key)

    var startTime = Number(new Date());
    args.push(function(err, result){
      var endTime = Number (new Date());
      var gap = endTime - startTime;
      // console.log("imDbQuery----gap", gap, key)
      // post analyticcs
      var data = {};
      data.section = "inMemoryDbQuery_"+key;
      data.time = gap;
      data.size = 0;
      postData.saveData(data);
      fn(err, result);
    });
    remote[key].apply(null, args);
  }.bind(null, key);
} 