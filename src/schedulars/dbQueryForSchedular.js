/*jshint node: true */
"use strict";

const MongoClient = require("mongodb").MongoClient,
  assert = require("assert"),
  ObjectID = require("mongodb").ObjectID,
  schedulerConfig = require("./schedulerConfig.js"),
  mongodb = require("./asyncMongoConnection.js");

exports.findTournamentRoom = function (query, callback) {
  mongodb.db
    .collection("tournamentroom")
    .find(query)
    .toArray(function (err, result) {
      callback(err, result);
    });
};

exports.findAllTournamentRoom = function (callback) {
  mongodb.db
    .collection("tournamentroom")
    .find({
      $or: [
        { tournamentType: schedulerConfig.tournamentType.normal },
        { tournamentType: schedulerConfig.tournamentType.satelite },
      ],
    })
    .toArray(function (err, result) {
      callback(err, result);
    });
};

exports.updateTournament = function (tournamentIds, callback) {
  mongodb.db.collection("tournamentroom").update(
    { _id: { $in: tournamentIds } },
    {
      $set: {
        state: schedulerConfig.tournamentState.register,
        tournamentStartTime: 0,
      },
      $inc: { gameVersionCount: 1 },
    },
    { multi: true },
    function (err, result) {
      callback(err, result);
    }
  );
};

exports.updateTournamentRoom = function (query, updatedKeys, callback) {
  mongodb.db
    .collection("tournamentroom")
    .findAndModify(
      query,
      [],
      { $set: updatedKeys },
      { new: true },
      function (err, result) {
        callback(err, result);
      }
    );
};

exports.updateSingleTournament = function (tournamentId, callback) {
  mongodb.db.collection("tournamentroom").update(
    { _id: ObjectID(tournamentId) },
    {
      $set: { state: schedulerConfig.tournamentState.register },
      $inc: { gameVersionCount: 1 },
    },
    function (err, result) {
      callback(err, result);
    }
  );
};

exports.updateTournamentStateToRunning = function (tournamentId, callback) {
  mongodb.db
    .collection("tournamentroom")
    .update(
      { _id: ObjectID(tournamentId) },
      { $set: { state: schedulerConfig.tournamentState.running } },
      function (err, result) {
        callback(err, result);
      }
    );
};

exports.saveJob = function (job, callback) {
  mongodb.db
    .collection("jobs")
    .insert({ tournamentId: 1, job: job }, function (err, result) {
      console.log(result);
      callback(err, result);
    });
};

exports.createTournamentTables = function (userDataArray, callback) {
  mongodb.db
    .collection("tables")
    .insert(userDataArray, { ordered: false }, function (err, result) {
      callback(err, result);
    });
};

exports.removeTables = function (tournamentId, cb) {
  mongodb.db
    .collection("tables")
    .remove(
      { "tournament.tournamentId": tournamentId.toString() },
      function (err, result) {
        cb(err, result);
      }
    );
};

exports.deletePrize = function (tournamentId, cb) {
  mongodb.db
    .collection("prizerules")
    .remove(
      { tournamentId: tournamentId.toString(), type: "server" },
      function (err, result) {
        cb(err, result);
      }
    );
};

exports.countTournamentusers = function (filter, callback) {
  console.log(
    "filter is in countTournamentusers is - ",
    JSON.stringify(filter)
  );
  mongodb.db.collection("tournamentusers").count(filter, function (err, users) {
    console.log("users are ", users);
    callback(err, users);
  });
};

exports.findBlindRule = function (id, callback) {
  mongodb.db
    .collection("blindrules")
    .findOne({ _id: ObjectID(id) }, function (err, result) {
      callback(err, result);
    });
};

exports.updateTournamentGeneralize = function (id, userData, callback) {
  console.log(
    "id and user data is in updateTournamentGeneralize - " + id + " " + userData
  );
  mongodb.db
    .collection("tournamentroom")
    .update({ _id: ObjectID(id) }, { $set: userData }, function (err, result) {
      callback(err, result);
    });
};

exports.getTournamentRoom = function (id, callback) {
  console.log("in getTournamentRoom id is ", id);
  mongodb.db
    .collection("tournamentroom")
    .findOne({ _id: ObjectID(id) }, function (err, result) {
      callback(err, result);
    });
};

exports.updateTournamentState = function (id, state, callback) {
  console.log("updateTournamentState is in dbQuery - " + id, state);
  mongodb.db
    .collection("tournamentroom")
    .update(
      { _id: ObjectID(id) },
      { $set: { state: state } },
      function (err, result) {
        console.log(result);
        callback(err, result);
      }
    );
};
