/*
* @Author: sushiljainam
* @Date:   2017-09-22 13:13:34
* @Last Modified by:   digvijay
* @Last Modified time: 2018-12-28 15:13:03
*/

/*jshint node: true */
"use strict";

var async = require("async");
var imdb = require("../../../../shared/model/inMemoryDbQuery.js");
var profileMgmt = require("../../../../shared/model/profileMgmt");
var actionHandler = require("../roomHandler/actionHandler");
var broadcastHandler = require("../roomHandler/broadcastHandler");
var channelTimerHandler = require("../roomHandler/channelTimerHandler");
var mongodb = require('../../../../shared/mongodbConnection');
var stateOfX = require("../../../../shared/stateOfX");
var pomelo = require('pomelo');

// fetch inMemoryDb table
var getDBTable = function (params, cb) {
	imdb.getTable(params.channelId, function (err, result) {
		if(!err && result){
			params.table = result;
			cb(null, params);
			return;
		}
		cb({success: false, info: 'No game is running on this table.'});
	});
};

// fetch all inMemoryDb tables list
var getAllTables = function (params, cb) {
	imdb.getAllTable({}, function (err, tables) {
		if(err){
			cb(err);
			return;
		}
		params.tables = tables;
		cb(null, params);
	});
};

// find table locked duration
// check if allowed
var lockedSince = function (params, cb) {
	if (params.force) {
		cb(null, params);
		return;
	} else {
		if (params.table.isOperationOn) {
			var ct = Number(new Date());
			var lt = Number(new Date(params.table.operationStartTime));
			if(ct-lt > (params.allowedLockedTime*1000)){
				cb(null, params);
				return;
			} else {
				cb({success: false, info: 'This is not enough time to revert it.', data: {isOperationOn: params.table.isOperationOn, operationStartTime: params.table.operationStartTime}});
				return;
			}
		} else {
			// cb({success: false, info: 'This table is not locked, FORCE is also disabled'});
			cb({success: false, info: 'This table is not locked, So REVERT is disabled.'});
			return;
		}
	}
};

// now lock the table to perform operations
var getTableLocked = function (params, cb) {
	if (params.table.isOperationOn) {
		cb(null, params);
	} else {
		params.channelId = params.channelId || params.table.channelId;
		mongodb.inMemoryDb.collection("tables").findAndModify(
			{channelId: params.channelId, isOperationOn: false},
			[],
			{$set: {isOperationOn : true, actionName : 'revertLockedTable', operationStartTime: (new Date())}, $inc : {_v: 1}},
			{upsert: false, new: true }, function (err, result) {
				params.table = result.value;
				cb(null, params);
			});
	}
};

// player only game refunds
// money is in three places - add all three
// players[$].chips
// players[$].chipsToBeAdded
// contributors[$].amount
var calculateRefunds = function (params, cb) {
	var refunds = {};
	// for (var i = 0; i < params.table.players.length; i++) {
	// 	refunds[params.table.players[i].playerId] = {playerId: params.table.players[i].playerId, chips: ((params.table.players[i].chips||0) + (params.table.players[i].chipsToBeAdded||0))};
	// }
	for (var i = 0; i < params.table.contributors.length; i++) {
		if (refunds[params.table.contributors[i].playerId]) {
			refunds[params.table.contributors[i].playerId].chips += (params.table.contributors[i].amount||0);
		} else {
			refunds[params.table.contributors[i].playerId] = {playerId: params.table.contributors[i].playerId, chips: (params.table.contributors[i].amount||0)};
		}
	}
	params.isRealMoney = params.table.isRealMoney;
	params.refunds = refunds;
	cb(null, params);
};

// refund player chips and inform
var refundChipsAndBroadcast = function (params, cb) {
	for (var i = 0; i < params.table.players.length; i++) {
		// params.table.players[i].state = stateOfX.playerState.onBreak;
		if(params.refunds[params.table.players[i].playerId]){
			params.table.players[i].chips += (params.refunds[params.table.players[i].playerId].chips || 0);
			params.refunds[params.table.players[i].playerId].refunded = true;
		}
	}
	async.each(params.refunds, function (item, ecb) {
		if (item.refunded) {
			ecb(null);
		} else {
			profileMgmt.addChips({playerId: item.playerId, chips: (item.chips||0), isRealMoney: params.isRealMoney}, function (addChipsResponse) {
				if (addChipsResponse.success) {
					item.refunded = true;
					ecb(null);
				} else {
					item.refunded = false;
					ecb(null);
				}
			});
		}
	}, function (err) {
		cb(null, params);
	});
};

// player game and table refunds
// also add player chips
// award in player profile
var calculateRefundsAndReturnToPlayer = function (params, cb) {
	var refunds = {};
	for (var i = 0; i < params.table.players.length; i++) {
		// TODO
		refunds[params.table.players[i].playerId] = {playerId: params.table.players[i].playerId, chips: (params.table.players[i].chips||0) };
	}
	for (var i = 0; i < params.table.contributors.length; i++) {
		if (refunds[params.table.contributors[i].playerId]) {
			refunds[params.table.contributors[i].playerId].chips += (params.table.contributors[i].amount||0);
		} else {
			refunds[params.table.contributors[i].playerId] = {playerId: params.table.contributors[i].playerId, chips: (params.table.contributors[i].amount||0)};
		}
	}
	async.each(refunds, function (item, ecb) {
		profileMgmt.addChips({playerId: item.playerId, chips: (item.chips||0), isRealMoney: params.table.isRealMoney}, function (addChipsResponse) {
			if (addChipsResponse.success) {
				item.refunded = true;
				ecb(null);
			} else {
				item.refunded = false;
				ecb(null); // should it pass error?
			}
		});
	}, function (err) {
		cb(null, params);
	});
};

// reset table settings
var resetTableAndPlayers = function (params, cb) {
  params.table.state               = "IDLE";
  params.table.roundId             = null;
  params.table.deck                = [];
  params.table.roundName           = null;
  params.table.roundBets           = [];
  params.table.roundMaxBet         = 0;
  params.table.maxBetAllowed       = 0;
  params.table.pot                 = [];
  params.table.contributors        = [];
  params.table.roundContributors   = [];
  params.table.boardCard           = [[], []];
  params.table.preChecks           = [];
  params.table.summaryOfAllPlayers = {};
  params.table.handHistory         = [];
  params.table.isAllInOcccured     = false;
  params.table.currentMoveIndex    = -1;
  params.table._v                  = 0;

  // Resetting players
  for (var i = 0; i < params.table.players.length; i++) {
    // if(params.table.players[i].state === stateOfX.playerState.playing) {
      console.log(stateOfX.serverLogType.info, 'Setting player ' + params.table.players[i].playerName + ' state as onbreak.');
      params.table.players[i].state   = stateOfX.playerState.onBreak;
      params.table.players[i].totalRoundBet   = 0;
      params.table.players[i].lastMove   = null;
      // params.table.players[i].active  = false;
    // }

  }

  cb(null, params);
};

// broadcsat to inform about
// table revert happened
var broadcastEventInfo = function (params, cb) {
	params.channel = params.app.get('channelService').getChannel(params.channelId);
	setTimeout(function () {
		params.channel.pushMessage(/*'channelInfo'*/ 'playerInfo', {channelId: params.channelId, heading: 'table reset',
		info: 'Current Hand is reverted due to some technical issue. All the money has been refunded for this hand, Kindly SitIn again to play the next hand.'});
	}, 100);
	// params.channel.pushMessage(/*'channelInfo'*/ 'playerInfo', {channelId: params.channelId, heading: 'table reset',
		// info: 'please leave* and join again, chips has been refunded'});
	cb(null, params);
};

// broadcast to reset game view
var broadcastGamePlayers = function (params, cb) {
	params.channel.pushMessage('gameOver', {channelId: params.channelId, winners: []});
	broadcastHandler.fireTablePlayersBroadcast({self: params.self, channelId: params.channelId, channel: params.channel, players: params.table.players, removed: []});
	channelTimerHandler.tableIdleTimer({channelId: params.channelId, channel: params.channel});
	cb(null, params);
};

// now unlock the table
var unlockTable = function (params, cb) {
	params.channel.gameStartEventSet = "IDLE";
	params.table.isOperationOn = false;
	params.table.operationEndTime = (new Date());
	mongodb.inMemoryDb.collection("tables").findAndModify(
	{channelId: params.channelId, isOperationOn: true},
	[],
	{$set: params.table},
	{upsert: false, new: true }, function (err, result) {
		if (!err && result) {
			params.table = result.value;
		}
		cb(null, params);
	});
};

// render all players leave
// altogether
// not used now
var broadcastLeave = function (params, cb) {
	async.each(params.table.players, function (item, ecb) {
		actionHandler.handleLeave({self: params, session: {}, channel: params.channel,
			channelId: params.channelId,
			response: { 
				playerLength: 0,
				isSeatsAvailable: false,
				broadcast: {
					success : true,
					channelId : params.channelId,
					playerId : item.playerId,
					playerName : item.playerName,
					isStandup : false
			}},
			request: {playerId : item.playerId, isStandup : false}}); // loop
		ecb();
	}, function () {
		// cb(null, params);
	async.each(params.channel.getMembers(), function (item, ecb) {
		actionHandler.handleLeave({self: params, session: {}, channel: params.channel,
			channelId: params.channelId,
			response: { 
				playerLength: 0,
				isSeatsAvailable: false,
				broadcast: {
					success : true,
					channelId : params.channelId,
					playerId : item,
					playerName : item,
					isStandup : false
			}},
			request: {playerId : item, isStandup : false}}); // loop
		ecb();
	}, function () {
		cb(null, params);
	});
	});
};

// delete table from inMemoryDb
// and remove channel object
// not used now
var destroyTable = function (params, cb) {
	pomelo.app.rpc.database.tableRemote.removeTable({},{channelId: params.channelId}, function (removeTableResp) {
		// serverLog(stateOfX.serverLogType.error, removeTableResp);
		// serverLog(stateOfX.serverLogType.error, 'CHANNEL ' + channel.channelName + ' IS GOING TO BE DESTROYED!');
		params.channel.isTable = false;
		// params.channel.destroy();
		params.app.get('channelService').destroyChannel(params.channelId);
		// serverLog(stateOfX.serverLogType.error, 'CHANNEL HAS BEEN DESTROYED!');
		cb(null, params);
	});
};

// delete table from inMemoryDb
var deleteTable = function (params, cb) {
	imdb.removeTable({channelId: params.channelId||params.table.channelId}, function (err, result) {
		if (err) {
			return cb(err);
		}
		cb(null, params);
	});
};

// do tasks for every table from inMemoryDb
var forEveryTable = function (params, cb) {
	async.eachSeries(params.tables, function (table, ecb) {
		params.table = table;
		async.waterfall([
			async.apply(function (params, cb) { cb(null, params);}, params),
			calculateRefundsAndReturnToPlayer,
			deleteTable
			], function (err, res) {
				ecb(err, res);
			});
	}, function (err, result) {
		cb(err, result);
	});
};

// revert a table from dashboard
// put all players sitout
// refunds of game
module.exports.revertLockedTable = function (params, cb) {
  // msg = {channelId: '', lockedTime: 'numberSeconds'}
  // get imdb table - 
  // check if locked
  // check locked time
  // save this table
  // calculate refund (pocket amt + pot contributions)
  // process refund -> add chips -> broadcast
  // channel -> leave broadcast
  // channel -> info 'what just happened' brd
  // destroy channel
  // delete table
  // return saved table object, success, players refund amt
  async.waterfall([
  	async.apply(getDBTable, params),
  	lockedSince,
  	getTableLocked,
  	calculateRefunds,
  	refundChipsAndBroadcast,
  	resetTableAndPlayers,
  	broadcastEventInfo,
  	broadcastGamePlayers,
  	unlockTable
  	// broadcastLeave,
  	// destroyTable
  	], function (err, res) {
  		if (err) {
  			cb(err);
  		} else {
  			cb({success: true, info: "table has been reverted, refunds done."});
  		}
  		// cb(err || res);
  	});
};

module.exports.revertLockedTableAndRemove = function (params, cb) {
  // msg = {channelId: '', lockedTime: 'numberSeconds'}
  // get imdb table - 
  // check if locked
  // check locked time
  // save this table
  // calculate refund (pocket amt + pot contributions)
  // process refund -> add chips -> broadcast
  // channel -> leave broadcast
  // channel -> info 'what just happened' brd
  // destroy channel
  // delete table
  // return saved table object, success, players refund amt
	async.waterfall([
		async.apply(getDBTable, params),
		lockedSince,
		getTableLocked,
		calculateRefundsAndReturnToPlayer,
		// calculateRefunds,
		// refundChipsAndBroadcast,
		// resetTableAndPlayers,
		broadcastEventInfo,
		broadcastGamePlayers,
		// unlockTable,
		broadcastLeave,
		destroyTable
		], function (err, res) {
			if (err) {
				cb(err);
			} else {
				cb({success: true, info: "table has been reverted, refunds done."});
			}
			// cb(err || res);
		});
};

module.exports.revertAllTables = function (params, cb) {
	params = params || {};
	console.log('--- revertAllTables -- ');
	async.waterfall([
		async.apply(getAllTables, params),
		forEveryTable
		], function (err, res) {
			if (err) {
				return cb(err);
			}
			cb({success: true, info: "All tables has been deleted, refunds done."});
		});
};

  // msg = {channelId: '', lockedTime: 'numberSeconds', force : 'bool'}
  // get imdb table - 
  // check if locked OR force enabled
  // check locked time OR force enabled
  // save this table
  // calculate refund (pot contributions)
  // add refunds to player* - pocket chips
  // if player left - add to his profile - broadcast
  // update all players state sitout
  // update pot, contributions acc to NO-GAME-START
  // channel -> info 'what just happened' brd
  // channel -> gamePlayers broadcast
  // return saved table object, success, players refund amt

