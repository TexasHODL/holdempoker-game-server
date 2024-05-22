/*jshint node: true */
"use strict";

var stateOfX = require("./stateOfX"),
  // mongo 				= require("./asyncMongoConnection.js"),
  zmqPublish = require("./infoPublisher"),
  async = require("async"),
  db = require("./model/dbQuery.js");

var table = {};

var initializeParams = function (room, cb) {
  var params = {};
  params.room = room;
  params.enrolledPlayers = 0;
  cb(null, params);
};

function serverLog(type, log) {
  var logObject = {};
  logObject.fileName = "createTournamentTable";
  logObject.serverName = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type = type;
  logObject.log = log;
  zmqPublish.sendLogMessage(logObject);
}

/**
 * this function creates temporary table object
 * @method tableKeys
 * @param  {object}  params request json object
 * @return {object}         tempObj
 */
var tableKeys = function (params) {
  console.log("params is in tableKeys ", JSON.stringify(params));
  var tempObj = {
    isActive: true,
    channelType: stateOfX.gameType.tournament,
    isRealMoney: JSON.parse(params.room.isRealMoney),
    channelName: params.room.channelName,
    turnTime: params.room.turnTime,
    isPotLimit: JSON.parse(params.room.isPotLimit),
    maxPlayers: params.room.maxPlayers,
    minPlayers: params.room.minPlayers,
    smallBlind: params.room.smallBlind,
    bigBlind: params.room.bigBlind,
    ante: params.room.ante,
    isStraddleEnable: false,
    minBuyIn: !!params.room.minBuyIn ? params.room.minBuyIn : null,
    maxBuyIn: !!params.room.maxBuyIn ? params.room.maxBuyIn : null,
    numberOfRebuyAllowed: !!params.room.numberOfRebuyAllowed
      ? params.room.numberOfRebuyAllowed
      : null,
    hourLimitForRebuy: !!params.room.hourLimitForRebuy
      ? params.room.hourLimitForRebuy
      : null,
    rebuyHourFactor: !!params.room.rebuyHourFactor
      ? params.room.rebuyHourFactor
      : null,
    isRebuyAllowed: params.room.isRebuyAllowed,
    gameInfo: params.room.gameInfo,
    gameInterval: params.room.gameInterval,
    blindMissed: params.room.blindMissed,
    channelVariation: params.room.channelVariation,
    noOfChipsAtGameStart: params.room.noOfChipsAtGameStart,
    rakeRule: null,
    tournament: {
      tournamentId: params.room._id.toString(),
      avgFlopPercent: params.room.avgFlopPercent,
      avgPot: params.room.avgPot,
      blindRule: params.room.blindRule.toString(),
      bountyfees: params.room.bountyfees,
      channelType: params.room.channelType,
      entryfees: params.room.entryfees,
      extraTimeAllowed: params.room.extraTimeAllowed,
      housefees: params.room.housefees,
      isBountyEnabled: params.room.isBountyEnabled,
      isActive: params.room.isActive,
      tournamentStartTime: params.room.tournamentStartTime,
      lateRegistrationAllowed: params.room.lateRegistrationAllowed,
      lateRegistrationTime: params.room.lateRegistrationTime,
      maxPlayersForTournament: params.room.maxPlayersForTournament,
      minPlayersForTournament: params.room.minPlayersForTournament,
      totalFlopPlayer: params.room.totalFlopPlayer,
      totalGame: params.room.totalGame,
      totalPlayer: params.room.totalPlayer,
      totalPot: params.room.totalPot,
      tournamentBreakTime: params.room.tournamentBreakTime,
      tournamentBreakDuration: params.room.tournamentBreakDuration,
      tournamentRules: params.room.tournamentRules,
      tournamentTime: params.room.tournamentTime,
      tournamentType: params.room.tournamentType,
      isRebuyAllowed: params.room.isRebuyAllowed,
      winTicketsForTournament: params.room.winTicketsForTournament,
      isRecurring: params.room.isRecurring,
      recurringTime: params.room.recurringTime,
      rebuyTime: params.room.rebuyTime,
      breakRuleId: params.room.breakRuleId,
      breakRuleData: params.breakRuleData.rule,
      blindRuleData: params.blindRuleData.list,
      timeBankRuleData: params.timeBankRuleData.rule,
      addonTime: params.room.addonTime,
      timeBankRule: params.room.timeBankRule,
      addonRule: params.room.addonRule,
      isAddonEnabled: params.room.isAddonEnabled,
    },
  };
  if (params.room.tournamentType === stateOfX.tournamentType.satelite) {
    tempObj.tournament.parentOfSatelliteId = params.room.parentOfSatelliteId;
  }
  return tempObj;
};

/**
 * this function gets the count of enrolled players in tournament
 * @method enrolledPlayers
 * @param  {object}        params json object containing tournament id and gameVersionCount
 * @param  {Function}      cb     callback function
 */
var enrolledPlayers = function (params, cb) {
  console.log("room is in enrolled players - ", JSON.stringify(params.room));
  var filter = {
    tournamentId: params.room._id.toString(),
    gameVersionCount: params.room.gameVersionCount,
  };
  db.countTournamentusers(filter, function (err, result) {
    if (err) {
      cb({ success: false, info: "Error in gettiing tournament users" });
    } else {
      params.enrolledPlayers = result;
      cb(null, params);
    }
  });
};

/**
 * this funciton deletes existing tables
 * @method deleteExistingTables
 * @param  {object}             params reuqst json object
 * @param  {Function}           cb     callback function
 */
var deleteExistingTables = function (params, cb) {
  console.log(
    "room is in deleteExistingTables - ",
    JSON.stringify(params.room)
  );
  db.removeTournamentTable(params.room._id.toString(), function (err, table) {
    if (err) {
      cb({ success: false, info: "Error in deleteExistingTables" });
    } else {
      console.log("Successfully deleteExistingTables");
      cb(null, params);
    }
  });
};

/**
 * this function creates multiple tables according to no. of enrolled players
 * @method createTable
 * @param  {[type]}    params [description]
 * @param  {Function}  cb     [description]
 * @return {[type]}           [description]
 */
var createTable = function (params, cb) {
  console.log("params is in create table is - ", JSON.stringify(params));
  var noOfTables = Math.ceil(params.enrolledPlayers / params.room.maxPlayers);
  var tables = [];
  for (var iterator = 0; iterator < noOfTables; iterator++) {
    tables.push(tableKeys(params));
  }
  console.log("tables are iin create tables are - ", JSON.stringify(tables));
  db.createTournamentTables(tables, function (err, result) {
    if (err) {
      cb({ success: false, info: "Error in inserting tables in database" });
    } else {
      console.log("tables in db created Successfully");
      cb(null, params);
    }
  });
};

/**
 * this function creates a single table
 * @method createOnetable
 * @param  {object}       params request json object
 * @param  {Function}     cb     callback function
 */
var createOnetable = function (params, cb) {
  console.log("params is in createOnetable is - ", JSON.stringify(params));
  var table = tableKeys(params);
  db.createTournamentTables(table, function (err, result) {
    if (err) {
      cb({ success: false, info: "Error in inserting tables in database" });
    } else {
      console.log("tables in db created Successfully");
      params.table = result.ops[0];
      cb(null, params);
    }
  });
};

/**
 * this function gets break rule from breakRuleId
 * @method getBreakRule
 * @param  {object}     params request json object
 * @param  {Function}   cb     callback function
 */
var getBreakRule = function (params, cb) {
  db.findBreakRule(params.room.breakRuleId, function (err, result) {
    //getBreakRule according to the breakRuleId
    if (!err && result) {
      serverLog(
        stateOfX.serverLogType.info,
        "The result in getBreakRule is  - " + JSON.stringify(result)
      );
      params.breakRuleData = result; //send the breakRule Data to the function isEligible for break
      cb(null, params);
    } else {
      serverLog(
        stateOfX.serverLogType.info,
        "Some error occured or break Rule not found"
      );
      cb({ success: false });
    }
  });
};

/**
 * this function gets blind rule using blind id
 * @method getBlindRule
 * @param  {object}        params request json object
 * @param  {Function}      cb     callback function
 */
var getBlindRule = function (params, cb) {
  db.findBlindRule(params.room.blindRule, function (err, result) {
    //getBlindRule according to the BlindRuleId
    if (!err && result) {
      serverLog(
        stateOfX.serverLogType.info,
        "The result in getBlindRule is  - " + JSON.stringify(result)
      );
      params.blindRuleData = result; //send the blindRule Data to the function isEligible for break
      cb(null, params);
    } else {
      serverLog(
        stateOfX.serverLogType.info,
        "Some error occured or break Rule not found"
      );
      cb({ success: false });
    }
  });
};

/**
 * this function gets timebank rule using timebankrule id
 * @method getTimeBankRule
 * @param  {object}        params request json object
 * @param  {Function}      cb     callback function
 */
var getTimeBankRule = function (params, cb) {
  db.findTimeBankRule(params.room.timeBankRule, function (err, result) {
    //getTimeBank according to the TimeBankId
    if (!err && result) {
      serverLog(
        stateOfX.serverLogType.info,
        "The result in getTimeBankRule is  - " + JSON.stringify(result)
      );
      params.timeBankRuleData = result; //send the Timebank Data to the function isEligible for break
      cb(null, params);
    } else {
      serverLog(
        stateOfX.serverLogType.info,
        "Some error occured or break Rule not found"
      );
      cb({ success: false });
    }
  });
};

/**
 * this function creates tables when the game starts
 * @method create
 * @param  {object}   room request json object
 * @param  {Function} cb   callback function
 */
table.create = function (room, cb) {
  console.log("room is in table.create is - ", JSON.stringify(room));
  async.waterfall(
    [
      async.apply(initializeParams, room),
      enrolledPlayers,
      deleteExistingTables,
      getBlindRule,
      getBreakRule,
      getTimeBankRule,
      createTable,
    ],
    function (err, response) {
      console.log("err and response is in waterfall in create ", err, response);
      if (err) {
        cb({ success: false });
      } else {
        cb({ success: true });
      }
    }
  );
};

/**
 * this function gets tounament room on the basis of tournament id
 * @method getTournamentRoom
 * @param  {object}          params request json object
 * @param  {Function}        cb     callback function
 */
var getTournamentRoom = function (params, cb) {
  console.log("params in getTournamentRoom ", JSON.stringify(params));
  db.getTournamentRoom(params.tournamentId, function (err, result) {
    if (err) {
      console.log("Error in getting room in create tournament table");
      cb(params);
    } else {
      console.log(
        "room is in getTournamentRoom is - " + JSON.stringify(result)
      );
      params.room = result;
      cb(null, params);
    }
  });
};

/**
 * this function creates table for late registration player if no table is vacant, using tournament id
 * @method createTableByTournamentId
 * @param  {object}                  tournamentId
 * @param  {Function}                cb           callback function
 */
table.createTableByTournamentId = function (tournamentId, cb) {
  console.log("room is in table.create is - ", JSON.stringify(tournamentId));
  var params = {};
  params.tournamentId = tournamentId;
  async.waterfall(
    [
      async.apply(getTournamentRoom, params),
      enrolledPlayers,
      getBlindRule,
      getBreakRule,
      getTimeBankRule,
      createOnetable,
    ],
    function (err, response) {
      console.log(
        "err and response is in waterfall in create " + err + response
      );
      if (err) {
        cb({ success: false });
      } else {
        cb({ success: true, table: response.table });
      }
    }
  );
};

module.exports = table;
