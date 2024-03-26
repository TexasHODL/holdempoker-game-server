/*
* @Author: sushiljainam
* @Date:   2017-10-24 18:46:31
* @Last Modified by:   digvijay
* @Last Modified time: 2018-12-28 12:58:19
*/

/*jshint node: true */
"use strict";

var async = require('async');
var _ = require('underscore');
var validateGameStart = require("./validateGameStart");
var setTableConfig = require("./setTableConfig");
var deductBlinds = require("./deductBlinds");
var distributeCards = require("./distributeCards");
var activity           = require("../../../../shared/activity");
var stateOfX           = require("../../../../shared/stateOfX");

var serverLog = console.error;

var initializeParams = function (params, cb) {
	cb(null, params);
};

// validate if game can be started
// see detail in corresponding file
var validateStartGame = function (params, cb) {
	validateGameStart.validate(params, function (response) {
		// cb(response);
		params.data.startGame = response.data.startGame;
		params.data.vgsResponse = response.data;
		params.vgsResponse = response.data;
		params.table = response.table;
		cb(null, params);
	});
};

// broadcast game players to channel
// RPC - becoz this is backend server
var rpcGamePlayersBroadcast = function (params, cb) {
	params.dataPlayers = JSON.parse(JSON.stringify(_.map(params.data.vgsResponse.players, function (player) { return _.pick(player,'playerId','playerName','chips','state','moves'); })));
	// params.self.app.rpc.room.roomRemote.sg_gamePlayersBrd({forceFrontendId: params.table.serverId}, {channelId: params.channelId, data: params.data.vgsResponse}, function (err, res) {
	cb(null, params);
	// })
};

// return if game not to start
var checkGameStart = function (params, cb) {
	serverLog("in checkGameStart in startGameRemote"+ JSON.stringify(_.omit(params, 'self')));
	if (params.data.startGame) {
		cb(null, params);
	} else {
		cb(_.omit(params, 'self'), params);
	}
};

// set game dealer and other marked players
// see detail in corresponding file
var setGameConfig = function (params, cb) {
	setTableConfig.setConfig(params, function (response) {
		// cb(response);
		// params.data.sgcResponse = response.data;
		cb(null, params);
	});
};

// deduct blinds for various players
// see detail in corresponding file
var deductBlindsFn = function (params, cb) {
	deductBlinds.deduct(params, function (response) {
		// cb(response);
		params.data.dbResponse = response.data;
		cb(null, params);
	});
};

// distribute cards to all players acc to game variation
// see detail in corresponding file
var distributecards = function (params, cb) {
	distributeCards.distribute(params, function (response) {
		// cb(response);
		 // activity.startGameInfo(params,stateOfX.profile.category.gamePlay,stateOfX.gamePlay.subCategory.startGame,stateOfX.logType.info);
		params.data.dcResponse = response.data;
		cb(null, params);
	});
};

// flow position like moveRemote or leaveRemote
// check and process start game
module.exports.processStartGame = function (params, cb) {
	async.waterfall([
		async.apply(initializeParams, params),
		validateStartGame,
		rpcGamePlayersBroadcast,
		checkGameStart,
		setGameConfig,
		deductBlindsFn,
		distributecards
		], function (err, params) {
			if (err || !params) {
				params.data.dataPlayers = params.dataPlayers;
				serverLog("err in processStartGame" +JSON.stringify(err));
				activity.startGameInfo(params,stateOfX.profile.category.gamePlay,stateOfX.gamePlay.subCategory.startGame,stateOfX.logType.info);
				cb(Object.assign({success: true}, err));
			} else {
				params.data.dataPlayers = params.dataPlayers;
				params.data.vgsResponse = params.vgsResponse;
				console.error("response in processStartGame" ,(_.omit(params, 'self')));
				serverLog("response in processStartGame" +JSON.stringify(_.omit(params, 'self')));
				activity.startGameInfo(params,stateOfX.profile.category.gamePlay,stateOfX.gamePlay.subCategory.startGame,stateOfX.logType.info);
				cb(Object.assign({success: true}, _.omit(params, 'self')));
				
			}
		});
};
