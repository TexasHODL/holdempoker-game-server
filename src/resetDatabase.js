/*jshint node: true */
"use strict";

/*
	Created by Amrendra 18/07/2016
*/

var async = require("async"),
  mongodb = require("./shared/mongodbConnection.js"),
  db = require("./shared/model/dbQuery.js"),
  logDB = require("./shared/model/logDbQuery.js"),
  inmemoryDb = require("./shared/model/inMemoryDbQuery.js"),
  newTable = require("./shared/newTableConfig.js"),
  newTournamentTables = require("./shared/newTournamentTableConfig.js"),
  resetDatabase = {};

const configConstants = require("./shared/configConstants.js");

// ### Reset database on server start
resetDatabase.reset = function () {
  // console.log("line 16 resetDatabase", mongodb.inMemoryDb)

  // Create collection for infoListner logs and expire after a time delay
  mongodb.inMemoryDb.collection("infoLogs").remove({});
  inmemoryDb.insertLog(
    {
      log:
        "This is a test log and will be deleted after " +
        parseInt(configConstants.expireLogSeconds) +
        " seconds.",
    },
    function (err, res) {
      console.log("Test log has been inserted properly!");
      setTimeout(function () {
        mongodb.inMemoryDb
          .collection("infoLogs")
          .createIndex(
            { createdAt: 1 },
            { expireAfterSeconds: parseInt(configConstants.expireLogSeconds) }
          );
        console.log("TTL saved for infoLogs collection !");
      }, 3 * 1000);
    }
  );

  // Remove inMemory tables
  // mongodb.inMemoryDb.collection('tables').remove({}, function(err, res){
  // 	console.log('DATABASE: In memory (cache) tables have been removed successfully!')
  // });

  // Remove inMemory spectator record
  mongodb.inMemoryDb.collection("spectators").remove({}, function (err, res) {
    console.log(
      "DATABASE: In memory (cache) spectators record have been removed successfully!"
    );
  });

  // Reset player join record as false to previous records
  mongodb.inMemoryDb
    .collection("tableJoinRecord")
    .remove({}, function (err, res) {
      console.log(
        "DATABASE: Player records of table joined have been removed successfully!"
      );
    });

  // Delete inmemory tournament rank collection
  mongodb.inMemoryDb.collection("ranks").remove({}, function (err, res) {
    console.log(
      "DATABASE: Dynamic rank for tournament records have been removed successfully!"
    );
  });

  // reset online players count
  mongodb.inMemoryDb
    .collection("onlinePlayers")
    .update({}, { onlinePlayers: 0 }, { upsert: true }, function (err, result) {
      console.log("DATABASE: Online players count reset zero.");
    });

  // Delete inmemory userActivity collection
  mongodb.inMemoryDb.collection("userActivity").remove({}, function (err, res) {
    console.log(
      "DATABASE: User activity of joined table been removed successfully!"
    );
  });

  // update any key in users collections
  // mongodb.db.collection('users').update({},{$set:{'prefrences.cardColor' : false}},{multi:true})

  // Resetting values of tournament tables
  mongodb.db
    .collection("tournamentroom")
    .update(
      {},
      { $set: { state: "REGISTER" } },
      { multi: true },
      function (err, res) {
        console.log(
          "DATABASE: Tables for tournament have been removed successfully!"
        );
      }
    );

  // Remove existing tournament users
  mongodb.db.collection("antibanking").remove({}, function (err, res) {
    console.log(
      "DATABASE: Anti bankign details for users have been removed successfully!"
    );
  });

  // Remove existing antibanking details for users
  // mongodb.db.collection('tournamentusers').remove({}, function(err, res){
  // 	console.log('DATABASE: Users registeration records for tournament have been removed successfully!')
  // });

  // Resetting values of rebuy
  mongodb.db.collection("rebuy").remove({}, function (err, res) {
    console.log(
      "DATABASE: rebuy for tournament have been removed successfully!"
    );
  });

  // Remove existing tournament ranks
  mongodb.db.collection("tournamentRanks").remove({}, function (err, res) {
    console.log(
      "DATABASE: Users rank records for tournament  been removed successfully!"
    );
  });

  // Reset database tables attributes
  // mongodb.db.collection('tables').update({}, {$set: {"totalGame":0,"totalPot":0,"avgPot":0,"totalPlayer":0,"totalFlopPlayer":0,"avgFlopPercent":0,"totalStack":0,"avgStack":0}}, {multi: true});
  // mongodb.db.collection('tables').update({}, {$set: {"totalPlayer":0,"totalFlopPlayer":0,"avgFlopPercent":0, "flopPercent": 0}}, {multi: true});

  // Update player chips
  // mongodb.db.collection('users').update({}, {$set: {freeChips: 5000000, realChips: 5000000}}, {multi: true});

  // mongodb.db.collection('users').update({}, {$set: {'prefrences.cardColor': false, freeChips: 5000000, realChips: 5000000, settings: {seatPrefrence: 1, seatPrefrenceTwo: 1, seatPrefrenceSix: 1, muteGameSound: false, dealerChat: true, playerChat: true, runItTwice: false, avatarId: 1, tableColor: 3}}}, {multi: true})
  mongodb.db.collection("antibanking").dropIndexes();
  mongodb.db
    .collection("antibanking")
    .createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: configConstants.expireAntiBankingSeconds }
    );

  mongodb.db.collection("userSession").remove({});

  mongodb.db
    .collection("scheduleTasks")
    .updateMany(
      { type: "serverDown", status: "PENDING" },
      {
        $set: { status: "CANCELLED" },
        $push: { logs: "schedule cancelled, server started, " + new Date() },
      },
      function (err, result) {}
    );
  mongodb.db
    .collection("scheduleTasks")
    .updateMany(
      { type: "serverUp", status: "PENDING" },
      {
        $set: { status: "CANCELLED" },
        $push: { logs: "schedule cancelled, server started, " + new Date() },
      },
      function (err, result) {}
    );

  //indexing on gameActivity for hand history on dashboard
  // mongodb.logDB.collection('gameActivity').createIndex({'rawResponse.params.table.onStartPlayers' : 1},{background: true}, function(err, result){
  //     	console.log("Create index on gameActivity success");
  //  });

  // mongodb.logDB.collection('gameActivity').dropIndexes()
  // mongodb.logDB.collection('handTab').dropIndexes()
  // mongodb.financeDB.collection('fundrake').dropIndexes()
  // mongodb.logDB.collection('gameActivityReductant').createIndex({"subCategory" : 1, "createdAt" : 1, "channelId" : 1 }, { expireAfterSeconds: configConstants.expireGameActivityReductantSeconds },function(err,result){
  // 	console.log("!!!!!!!!!!!!!!!!!!!");
  // 	console.log(err,result);
  // 	console.log("@@@@@@@@@@@@@@@@@@@");
  // })
  // mongodb.financeDB.collection('fundrake').createIndex({"addeddate" : 1, "debitToCompany" : 1, "debitToAffiliatename" : 1, "debitToSubaffiliatename" : 1 },{background: true})
  // mongodb.logDB.collection('handTab').createIndex({"channelId" : 1, "roundId" : 1, "createdAt" : 1, "handHistoryId" : 1 , "videoId": 1 ,"pot": 1, "active": 1},{background: true})
  mongodb.logDB
    .collection("videos")
    .createIndex(
      { roundId: 1, channelId: 1 },
      { background: true },
      function (err, result) {
        console.log(
          JSON.stringify(err) +
            " Create Index on videos " +
            JSON.stringify(result)
        );
      }
    );
};

module.exports = resetDatabase;
