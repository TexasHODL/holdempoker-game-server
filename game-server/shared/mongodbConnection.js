/*jshint node: true */
"use strict";


//  Initialize DB



var mongodb = require('mongodb'),
	async = require('async'),
	MongoClient = mongodb.MongoClient,
	MongoInMemoryClient = mongodb.MongoClient,
	MongoLogClient = mongodb.MongoClient


var localhost = "localhost";

var dbConfigs = [
	{
		key: 'db',
		name: 'pokerdb',
		connUrl: process.env.POKERDB_PATH
	},
	{
		key: 'inMemoryDb',
		name: 'pokerimdb',
		connUrl: process.env.POKERIMDB_PATH
	},
	{
		key: 'logDB',
		name: 'pokerlogadmin',
		connUrl: process.env.LOGDB_PATH
	},
	{
		key: 'financeDB',
		name: 'pokerFinancedb',
		connUrl: process.env.FINANCEDB_PATH
	},
	{
		key: 'adminDb',
		name: 'pokerAdminDb',
		connUrl: process.env.ADMINDB_PATH
	}
]
var dbByReqType = {
	'all': dbConfigs,
	'master': [dbConfigs[0], dbConfigs[1], dbConfigs[4]],
	'room': dbConfigs,
	'bot': [dbConfigs[0], dbConfigs[1]],
	'gate': [dbConfigs[0], dbConfigs[1], dbConfigs[2], dbConfigs[4]]
};

var dbs = {};

// init db connections to all as dbConfigs provided
dbs.init = function (dbReqType, cb) {
	if (cb instanceof Function) {

	} else {
		cb = dbReqType;
		dbReqType = 'all';
	}
	var dbConfigsByReq = dbByReqType[dbReqType] || dbByReqType['all'];
	var connectOneDB = function (db, ecb) {
		
		var url = db.connUrl;
		var key = db.key;
		MongoClient.connect(url, function (err, database) {
			if (err) {
				console.log(err);
				console.log("unable to connect Mongodb database on url: " + url);
			} else {
				dbs[key] = database.db(db.name);
				console.log("Mongodb database connected to server on url: " + url);
			}
			ecb(err);
		});
	};

	async.each(dbConfigsByReq, connectOneDB, function (err) {
		if (!!cb && typeof cb === 'function') {
			cb(err); // pass error or not
		}
	});
};

module.exports = dbs;
