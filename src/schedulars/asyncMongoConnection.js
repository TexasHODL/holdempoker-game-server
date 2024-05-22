/*jshint node: true */
"use strict";

//  Initialize DB

var mongodb 					= require('mongodb'), 
	MongoClient 				= mongodb.MongoClient,
	MongoInMemoryClient = mongodb.MongoClient;




// Connection URL 
//var url = 'mongodb://gaurav:mongodba@localhost:27002/pokerdb';
//var inMemoryUrl = 'mongodb://gaurav:mongodba@localhost:27001/pokerimdb';

var url 		  = process.env.POKERDB_PATH;
var inMemoryUrl   = process.env.POKERIMDB_PATH;

var db = '',  inMemoryDb = '';

exports.init = function(cb){
	MongoClient.connect(url, function(err, database) {
		if(err){
			console.log(err);
			console.log("unable to connect Mongodb database on port 27002");
			cb({success: false});			
		} else{
			
			exports.db = database;
			console.log("Mongodb database connected to server on host: "= process.env.POKERDB_PATH);			
			MongoInMemoryClient.connect(inMemoryUrl, function(err, database) {
				if(err){
					console.log(err);
					console.log("unable to connect Mongodb database on port 27001");
					cb({success: false});			
				} else{
					exports.inMemoryDb = database;
					console.log("Mongodb database connected to server on host: " + process.env.POKERIMDB_PATH);			
					cb({success: true});			
				}
			});
		}
	});

};

// Document to setup/start mongodb server in auth mode

//kill running mongodb instance

//ps -ef | grep mongo

//kill -9 process_id

//mongod --storageEngine wiredTiger --dbpath "./pokerdb" --port 27002

//mongod --storageEngine inMemory --dbpath "./pokerimdb" --port 27001

//mongo --port 27002

//use pokerdb

// var userDBA = { 
 
// "user": "gaurav", 
 
// "pwd": "mongodba", 
 
// "roles": ["dbOwner"] 

// } 

//db.createUser(userDBA)

//mongo --port 27001

//use pokerimdb 

// var userDBA = { 
 
// "user": "gaurav", 
 
// "pwd": "mongodba", 
 
// "roles": ["dbOwner"] 

// } 

//db.createUser(userDBA)

//Restart Mongodb Service

//mongod --storageEngine wiredTiger --auth --dbpath "./pokerdb" --port 27002

//mongod --storageEngine inMemory --auth --dbpath "./pokerimdb" --port 27001
