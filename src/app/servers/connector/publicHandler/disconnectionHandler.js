/*
* @Author: sushiljainam
* @Date:   2017-10-24 12:24:33
* @Last Modified by:   digvijay
* @Last Modified time: 2018-12-26 18:31:01
*/

/*jshint node: true */
"use strict";

var imdb = require("../../../../shared/model/inMemoryDbQuery.js");
var async = require('async');

module.exports.handle = function (params) {
	// find playerId from params.session
	// find tables where player is joined
	// EACH TABLE call room.handleDisconnection (playerId, channelId)
	if (!params.session) {
		// console.error(' disconnectionHandler returned from 1')
		return;
	}
	var playerId = params.session.get('playerId');
	if (!playerId) {
		// console.error(' disconnectionHandler returned from 2')
		return;
	}
	imdb.playerJoinedRecord({playerId: playerId}, function (err, res) {
		if (err || !res) {
			// console.error(' disconnectionHandler returned from 3')
			return;
		}
		if(res.length <= 0){
			// console.error(' disconnectionHandler returned from 4')
			return;
		}
		async.each(res, function (record, ecb) {
			params.self.app.rpc.room.roomRemote.handleDisconnection(params.session, {channelId: record.channelId, playerId: playerId}, function (err, result) {
				ecb();
			});
		}, function () {
			// done
			return;
		});
	});

};