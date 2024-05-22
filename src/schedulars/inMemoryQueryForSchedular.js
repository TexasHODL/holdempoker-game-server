/*jshint node: true */
"use strict";


var mongodb  = require('./asyncMongoConnection');
var ObjectID = require('mongodb').ObjectID;

// > Update a key on table
exports.updateChannels = function(channelIds,callback) {
	console.log("channelIds are ",JSON.stringify(channelIds));
	mongodb.db.collection('tables').update({_id: {$in: channelIds}},{$set: {tournamentRules:null}},{multi : true}, function(err, result) {
		console.log(result);
		callback(err, result);
	});
};

exports.getTables = function(tournamentId, cb){
	mongodb.inMemoryDb.collection('tables').find({"tournamentRules.tournamentId": tournamentId.toString()}).toArray(function(err, result) {
		cb(err, result);
	});
};

exports.removeTables = function(tournamentId, cb){
	mongodb.inMemoryDb.collection('tables').remove({"tournamentRules.tournamentId": tournamentId.toString()},function(err, result) {
		cb(err, result);
	});
};

exports.updateTables = function(tournamentId,callback) {
	console.log("tournamentId is ",JSON.stringify(tournamentId));
	mongodb.inMemoryDb.collection('tables').update({"tournamentRules.tournamentId": tournamentId.toString()},{$pull: {"tournamentRules.ranks":{}}},{multi : true}, function(err, result) {
		console.log(result);
		callback(err, result);
	});
};

exports.getJobs = function(tournamentId,callback) {
	console.log("tournamentId is ",JSON.stringify(tournamentId));
	mongodb.inMemoryDb.collection('jobs').find({tournamentId: tournamentId.toString()}).toArray(function(err, result) {
		console.log(result);
		callback(err, result);
	});
};

exports.createJob = function(jobData, callback) {
	console.log("jobData is in createJob is  ",JSON.stringify(jobData));
	mongodb.inMemoryDb.collection('jobs').insert(jobData,function(err, result) {
		console.log(result);
		callback(err, result);
	});
};

exports.deleteJob = function(tournamentId, callback) {
	// console.log("jobData is in deleteJob is  ",JSON.stringify(jobData));
	mongodb.inMemoryDb.collection('jobs').remove({tournamentId: tournamentId.toString()},function(err, result) {
		console.log(result);
		callback(err, result);
	});
};

exports.saveJob = function(job,callback) {
	mongodb.inMemoryDb.collection('jobs').insert(job, function(err, result) {
		console.log(result);
		callback(err, result);
	});
};

// Deleting all the activity of a user by his player id
exports.removeActivity = function(filter, cb){
	mongodb.inMemoryDb.collection('userActivity').remove(filter, function(err,result){
		cb(err,result);
	});
};

exports.removeTablesByChannelId = function(allChannels, cb){
	console.log("all channels are - " + JSON.stringify(allChannels));
	mongodb.inMemoryDb.collection('userActivity').remove({channelId: { $in: allChannels } },function(err, result) {
		cb(err, result);
	});
};