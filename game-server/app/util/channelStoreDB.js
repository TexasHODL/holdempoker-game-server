/*
* @Author: sushiljainam
* @Date:   2017-06-28 11:25:50
* @Last Modified by:   digvijay
* @Last Modified time: 2018-12-28 17:01:33
*/

/*jshint node: true */
"use strict";


var mongodb             = require("../../shared/mongodbConnection");
var channelTimerHandler = require("../servers/room/roomHandler/channelTimerHandler");

module.exports = function (collName, dbName){
	return new channelStoreDB(collName, dbName);
};

function channelStoreDB(collName, dbName) {
	Object.assign(this, {db: mongodb});
	this.col = collName || 'channelStoreColl';
	this.dbName = dbName || 'db';
}

// EXPERIMENTAL USE

channelStoreDB.prototype.add = function(key, value, cb) {
	var query = {};
	query[key] = {$exists: true};
	var update = {};
	update[key] = value;
	this.db[this.dbName].collection(this.col).update(query, { $addToSet: update}, {upsert: true}, function (err, res) {
		// console.log('channelStoreDB.prototype.add - response', err, res)
		cb(err);
	});
};


channelStoreDB.prototype.remove = function(key, value, cb) {
	var query = {};
	query[key] = {$exists: true};
	var update = {};
	update[key] = value;
	this.db[this.dbName].collection(this.col).update(query, { $pull: update}, function (err, res) {
		// console.log('channelStoreDB.prototype.add - response', err, res)
		cb(err);
	});
};

channelStoreDB.prototype.removeAll = function(key, cb) {
	var query = {};
	query[key] = {$exists: true};
	this.db[this.dbName].collection(this.col).remove(query, function (err, res) {
		// console.log('channelStoreDB.prototype.add - response', err, res)
		cb(err);
	});
};

channelStoreDB.prototype.load = function(key, cb) {
	var query = {};
	query[key] = {$exists: true};
	// console.error('--------!! ', this.db[this.dbName])
	setTimeout(function (self, key) {
	self.db[self.dbName].collection(self.col).findOne(query, function (err, res) {
	// console.error('--------!! ', !!self.db[self.dbName])
		console.log('channelStoreDB.prototype.load - response', err, res);
		if(err){
			return cb(err, []);
		}
		if(!res){
			return cb(null, []);
		}
		return cb(null, res[key]);
	});
		
	}, 2000, this, key);
};


channelStoreDB.prototype.updateKeys = function(app, channel) {
	if(!app || !channel){
		return;
	}
	var table;
	channel.channelId = channel.name;

	var setChannelKeys = function (channel, table) {
		channel.kickPlayerToLobby = [];
		channel.reserveSeatTimeReference = [];
		if(channel.isTable){
			channel.channelName = table.channelName;
			channel.channelType = table.channelType;
			channel.waitingPlayers = (table.queueList instanceof Array) ? table.queueList.length : 0;
			channel.roundId = table.roundId || "";
			channel.channelVariation = table.channelVariation;
			channel.tournamentId = table.tournamentId || "";
			channel.gameStartEventSet = null;
			channel.gameStartEventName = null;
			channel.allInOccuredOnChannel = table.isAllInOcccured;
			channel.turnTime = table.turnTime;

			var selfa = require("../servers/room/handler/channelHandler")(app);
			console.error('observation -- ', table.state, table.players.length);
			if(table.state == "RUNNING"){
				console.error('observation 2-- ', table.state, table.currentMoveIndex);
				channelTimerHandler.startTurnTimeOut({event:'afterCrash', self: selfa, channelId: channel.name, session: 'session'});
			} else if (table.state == "IDLE") {
				console.error('observation 21-- ', table.state, table.currentMoveIndex);
				// not executing this.. try console - table state and other
				var startGameHandler = require("../servers/room/handler/startGameHandler");
				channel.gameStartEventSet = "IDLE";
				startGameHandler.startGame({eventName:'afterCrash', self: selfa, channel: channel, channelId: channel.name, session: 'session'});
			}
			for (var i = 0; i < table.players.length; i++) {
				console.error('observation 3-- ', i, table.players[i].state);
				if (table.players[i].state == "RESERVED") {
					channelTimerHandler.vacantReserveSeat({event: 'afterCrash', self: selfa, channel: channel, channelId: channel.name, playerId: table.players[i].playerId, session: 'session'});
				}
			}
			for (var i = 0, list = channel.getMembers(); i < list.length; i++) {
				console.error('observation 4-- ', list[i]);
				var flag = true;
				for (var j = 0; j < table.players.length; j++) {
					if (table.players[j].playerId == list[i]) {
						flag = false;
						break;
					}
				}
				if(flag){
					// this member is not sitting, only observing
					channelTimerHandler.kickPlayerToLobby({event: 'afterCrash', self: selfa, channel: channel, channelId: channel.name, playerId: list[i], session: 'session'});
				}
			}
		}
	};

	var getTable = function (app, channel, table) {
		app.rpc.database.tableRemote.getTable('session', {channelId: channel.name}, function (getTableResponse) {
			if (getTableResponse.success) {
				table = getTableResponse.table;
				channel.isTable = true;
			} else {
				channel.isTable = false;
			}
			setChannelKeys(channel, table);
			console.error('reloaded - channel is ', channel);
		});
	};

	setTimeout(getTable, 2000, app, channel, table);
};