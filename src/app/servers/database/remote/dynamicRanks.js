/*jshint node: true */
"use strict";

var async           = require("async"),
    _               = require('underscore'),
    stateOfX        = require("../../../../shared/stateOfX"),
    popupTextManager= require("../../../../shared/popupTextManager").falseMessages,
    popupTextManagerFromdb = require("../../../../shared/popupTextManager").dbQyeryInfo,
    keyValidator    = require("../../../../shared/keysDictionary"),
    db              = require('../../../../shared/model/dbQuery.js'),
    zmqPublish      = require("../../../../shared/infoPublisher"),
    imdb            = require("../../../../shared/model/inMemoryDbQuery.js");

var dynamicRanks = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'dynamicRanks';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

//Getting tables of tournament from  memorydb
/**
 * this function gets tables from inMemoryDb
 * @method gettingTables
 * @param  {object}      params request json object
 * @param  {Function}    cb     callback function
 */
var gettingTables = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,"params in getting ranks are " + JSON.stringify(params));
  imdb.findTableByTournamentId(params.tournamentId,params.playerId, function(err,tables) {
    if(err || !tables) {
      cb({success: false, channelId: (params.channelId || ""), info: popupTextManager.GETTINGTABLES_DYNAMICRANKS, isRetry : false, isDisplay : true});
    } else {
      serverLog(stateOfX.serverLogType.info,"tables are --" + JSON.stringify(tables));
      params.tables = tables;
      cb({success: true, result: params});
    }
  });
};

/**
 * this function removes duplicate entries from ranks
 * @method removeDuplicate
 * @param  {object}        inGameUserRank         ranks of users in game
 * @param  {object}        eliminatedUserRanks    ranks of eliminated users
 * @return {object}        unique                 object with duplicate ranks removed
 */
var removeDuplicate = function(inGameUserRank,eliminatedUserRanks) {
  serverLog(stateOfX.serverLogType.info,"in find unique in dynamicRanks - "+JSON.stringify(inGameUserRank),eliminatedUserRanks);
  var unique = [];
  for(var i=0;i<inGameUserRank.length;i++) {
    var commonUserCount = 0;
    for(var j=0;j<eliminatedUserRanks.length;j++) {
      if(eliminatedUserRanks[j].playerId === inGameUserRank[i].playerId) {
        commonUserCount++;
      }
    }
    // serverLog(stateOfX.serverLogType.info,"ttttttttttttttttttt",commonUserCount);
    if(commonUserCount === 0) {
      unique.push(inGameUserRank[i]);
    }
  }
  // serverLog(stateOfX.serverLogType.info,"unique - ",unique);
  unique = unique.concat(eliminatedUserRanks);
  // serverLog(stateOfX.serverLogType.info,"final unique - ",unique);
  return unique;
};
// Calculating ranks on run time on basis of ranks
/**
 * this function calculates ranks on basis of ranks
 * @method calculateRanksForRunningState
 * @param  {object}                      params   request json object
 * @param  {Function}                    cb       callback function
 */
var calculateRanksForRunningState = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,"params in calculating rank in tournament.js" + JSON.stringify(params));
  gettingTables(params, function(gettingTablesResponse) {
    if(gettingTablesResponse.success) {
      var eliminatedUserRanks = [], inGameUserRank = [];
      var tables = gettingTablesResponse.result.tables;
      serverLog(stateOfX.serverLogType.info,"tables is in calculateRanksForRunningStateResponse " + JSON.stringify(tables));
      for(var tableIt=0; tableIt<tables.length; tableIt++) {
        inGameUserRank = inGameUserRank.concat(tables[tableIt].players);
        eliminatedUserRanks = eliminatedUserRanks.concat(tables[tableIt].tournamentRules.ranks);
      }
      serverLog(stateOfX.serverLogType.info,"eliminatedUserRanks -- " + JSON.stringify(eliminatedUserRanks));
      serverLog(stateOfX.serverLogType.info,"inGameUserRank -- " + JSON.stringify(inGameUserRank));
      inGameUserRank = _.sortBy(inGameUserRank, 'chips').reverse();
      eliminatedUserRanks = _.sortBy(eliminatedUserRanks, 'rank');
      params.ranks = removeDuplicate(inGameUserRank,eliminatedUserRanks);
      serverLog(stateOfX.serverLogType.info,"params.ranks are - " + JSON.stringify(params.ranks));
      // params.ranks = inGameUserRank.concat(eliminatedUserRanks);
      params = _.omit(params, "tables","players");
      cb({success: true, result:params});
    } else {
      cb(gettingTablesResponse);
    }
  });
};

/**
 * this function creates response when tournament state is finished
 * @method createResponseForFinishedState
 * @param  {object}                         params request json object
 * @param  {Function}                       cb     callback function
 */
var createResponseForFinishedState = function(params,cb) {
  for(var userIt=0; userIt<params.players.length;userIt++) {
    var tempPlayer = _.where(params.playerRanks, {playerId:params.players[userIt].playerId});
    serverLog(stateOfX.serverLogType.info,"tempPlayer is" + tempPlayer,params.players[userIt]);
    params.players[userIt].rank = tempPlayer[0].rank;
    params.players[userIt].chipsWon = tempPlayer[0].chipsWon;
  }
  serverLog(stateOfX.serverLogType.info,"players is in createResponseForFinishedState is - " + JSON.stringify(params.players));
  cb(params.players);
};

/**
 * this function finds unique players from player ids
 * @method filterUniquePlayerRanks
 * @param  {object}          players    json object containing players
 * @return {object}          uniquePlayers    json object containing unique players
 */
var filterUniquePlayerRanks = function(players) {
  serverLog(stateOfX.serverLogType.info,'players are in filterUniquePlayerRanks -' + JSON.stringify(players));
  var playerIds = _.pluck(players, "playerId");
  playerIds = _.uniq(playerIds);
  serverLog(stateOfX.serverLogType.info,'playerIds are in ranks - ' + JSON.stringify(playerIds));
  var uniquePlayers = [];
  for(var i=0; i<playerIds.length; i++) {
    uniquePlayers.push(_.where(players,{playerId: playerIds[i]})[0]);
  }
  serverLog(stateOfX.serverLogType.info,'unique players are - ' + JSON.stringify(uniquePlayers));
  return uniquePlayers;
};

// Response when state is running
/**
 * this function creates response when tournament state is running
 * @method createResponseForRunningState
 * @param  {object}                         params request json object
 * @param  {Function}                       cb     callback function
 */
var createResponseForRunningState = function(params,cb) {
  serverLog(stateOfX.serverLogType.info,"in createResponseForRunningState in dynamicRanks are" + JSON.stringify(params));
  var players = [];
  for(var playerIt=0; playerIt<params.ranks.length;playerIt++) {
    serverLog(stateOfX.serverLogType.info,'params.ranks[playerIt] ' + JSON.stringify(params.ranks[playerIt]));
    if(!_.isArray(params.ranks[playerIt])) {
      var temp = {};
      temp.playerId = params.ranks[playerIt].playerId;
      if(!!params.ranks[playerIt].tournamentData) {
        temp.userName = params.ranks[playerIt].tournamentData.userName || params.ranks[playerIt].playerName;
      } else {
        temp.userName = params.ranks[playerIt].userName;
      }
      temp.userName = params.ranks[playerIt].userName || params.ranks[playerIt].playerName;
      temp.eliminated = !!params.ranks[playerIt].rank ? true : false;
      temp.rank = params.ranks[playerIt].rank || playerIt+1;
      temp.chipsWon = params.ranks[playerIt].chipsWon || params.ranks[playerIt].chips || 0;
      players.push(temp);
    }
  }
  serverLog(stateOfX.serverLogType.info,"createResponseForRunningState is - " + JSON.stringify(players));
  // In some case player player ranks are duplicate so make them unique.
  players = filterUniquePlayerRanks(players);
  cb(players);
};

// Create response for tournament users

/**
 * this function creates response for tournament users
 * @method createResponseForTournamentUsers
 * @param  {object}                         params request json object
 * @param  {Function}                       cb     callback function
 */
var createResponseForTournamentUsers = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,"tournament state is in createResponse -- " + JSON.stringify(params));
  if((!!params.userIds && params.userIds.length > 0) || (!!params.players && params.players.length > 0) || (!!params.ranks && params.ranks.length > 0)) {
    switch(params.tournamentState) {

      case stateOfX.tournamentState.register :
        serverLog(stateOfX.serverLogType.info,"---state is register---");
        cb(null,params.players);
        break;

      case stateOfX.tournamentState.running :
        serverLog(stateOfX.serverLogType.info,"---state is running---");
        createResponseForRunningState(params,function(players){
          serverLog(stateOfX.serverLogType.info,"createResponseForTournamentUsers response in running state - " + JSON.stringify(players));
          cb(null, players);
        });
        break;

      case  stateOfX.tournamentState.finished :
        serverLog(stateOfX.serverLogType.info,"---state is finished---");
        createResponseForFinishedState(params, function(players) {
          serverLog(stateOfX.serverLogType.info,"players are - " + JSON.stringify(players));
          cb(null, players);
        });
        break;

      default :
        serverLog(stateOfX.serverLogType.info,"---state is invalid---");
        cb({success: false, channelId: (params.channelId || ""), info: popupTextManager.CREATERESPONSEFORTOURNAMENTUSERS_DYNAMICRANKS, isRetry : false, isDisplay : true});
    }
  } else {
    cb(null, []);
  }
};



/**
 * this function calculates rank when tournament finishes
 * @method calculateRanksForFinishedState
 * @param  {object}                       params request json object
 * @param  {Function}                     cb     callback function
 */
var calculateRanksForFinishedState = function(params,cb) {
  var filterForPrizes = {
    tournamentId: (params.tournamentId).toString(),
    gameVersionCount: params.gameVersionCount
  };
  serverLog(stateOfX.serverLogType.info,"filter for calcculateRank for finished state in dynamic ranks " + filterForPrizes);
  db.getTournamentRanks(filterForPrizes, function(err, tournamentRanks) {
    if(err || !tournamentRanks) {
      cb({success: false, channelId: (params.channelId || ""), info: popupTextManager.CALCULATERANKSFORFINISHEDSTATE_DB_DYNAMICRANKS, isRetry : false, isDisplay : true});
    } else {
      serverLog(stateOfX.serverLogType.info,"ranks is in calculateRanksForFinishedState in dynamicRanks " + JSON.stringify(tournamentRanks));
      params.playerRanks = tournamentRanks;
      serverLog(stateOfX.serverLogType.info,"tournament ranks is in calculateRanksForFinishedState" + JSON.stringify(params));
      cb({success:true, result:params});
    }
  });
};


//Get Tournament State
/**
 * this function processes registered users and calculate ranks
 * @method processRegisteredUser
 * @param  {object}              params request json object
 * @param  {Function}            cb     callback function
 */
var processRegisteredUser = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,"params is in processRegisteredUser is - ",JSON.stringify(params));
  if((!!params.userIds && params.userIds.length > 0) || (!!params.players && params.players.length > 0)) {
    if(params.tournamentState === stateOfX.tournamentState.register) {
      cb(null, params);
    } else if (params.tournamentState === stateOfX.tournamentState.running){
      calculateRanksForRunningState(params, function(ranks) {
        serverLog(stateOfX.serverLogType.info,"response of calculateRanksForRunningState in processRegisteredUser is - " + JSON.stringify(ranks));
        if(ranks.success) {
          cb(null, ranks.result);
        } else {
          cb(ranks);
        }
      });
    } else if(params.tournamentState === stateOfX.tournamentState.finished) {
      calculateRanksForFinishedState(params,function(calculateRanksForFinishedStateResponse) {
        if(calculateRanksForFinishedStateResponse.success) {
          cb(null,calculateRanksForFinishedStateResponse.result);
        } else {
          cb(calculateRanksForFinishedStateResponse);
        }
      });
    } else {
      cb({success: false, channelId: (params.channelId || ""), info: popupTextManager.PROCESSREGISTEREDUSER_DYNAMICRANKS, isRetry : false, isDisplay : true})
    }
  } else {
    cb(null, params);
  }
};

//get userInfo
/**
 * this function gets user info using userId
 * @method getUserInfo
 * @param  {object}    params request json object
 * @param  {Function}  cb     callback function
 */
var getUserInfo = function(params,cb) {
  if(params.userIds.length > 0 ) {
    db.findUserArray(params.userIds, function(err, users) {
      if(err) {
        cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManagerFromdb.GETUSERINFO_DB_DYNAMICRANKS});
        //cb({success: false, info: "Error in getting users"});
      } else {
        if(!!users && users.length > 0) {
          var players = [];
          for(var userIt = 0; userIt<users.length; userIt++) {
            players.push({playerId: users[userIt].playerId, userName: users[userIt].userName,rank:0,chipsWon:params.startingChips});
          }
          params = _.omit(params, 'userIds');
          params.players = players;
          serverLog(stateOfX.serverLogType.info,"params in getUserInfo - " + JSON.stringify(params));
          cb(null, params);
        } else {
          cb({success: false, channelId: (params.channelId || ""), info: popupTextManager.GETUSERINFO_DYNAMICRANKS, isRetry : false, isDisplay : true});
        }
      }
    });
  } else {
    cb(null, params);
  }
};

//getting tournament registerd users
/**
 * this function gets all registered tournament users in a given tournament
 * @method getAllRegisteredTournamentUsers
 * @param  {object}                        params request json object
 * @param  {Function}                      cb     callback function
 */
var  getAllRegisteredTournamentUsers = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,"params are in getAllRegisteredTournamentUsers " + params);
  db.findTournamentUser({tournamentId: (params.tournamentId).toString(),gameVersionCount:params.gameVersionCount}, function(err, users) {
    if(err) {
      cb({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManagerFromdb.GETREGISTEREDTOURNAMENTUSERS_DB_DYNAMICRANKS});
      //cb({success: false, info: "Error in getAllRegisteredTournamentUsers"});
    } else {
      if(!!users) {
        params.userIds = _.pluck(users,"playerId");
        serverLog(stateOfX.serverLogType.info,"params.userId in getAllRegisteredTournamentUsers in tournament.js" + params.userIds);
        cb(null, params);
      } else {
        cb({success: false, channelId: (params.channelId || ""), info: popupTextManager.GETREGISTEREDTOURNAMENTUSERS_DYNAMICRANKS, isRetry : false, isDisplay : true});
      }
    }
  });
};

/**
 * this function gets tournament room using tournamentId
 * @method getTournamentRoom
 * @param  {object}          params reuqest json object
 * @param  {Function}        cb     callback function
 */
var getTournamentRoom = function(params,cb) {
  db.getTournamentRoom(params.tournamentId, function(err, tournament) {
    if(err || !tournament) {
      cb({success: false, channelId: (params.channelId || ""), info: popupTextManager.GETTOURNAMENTROOM_DYNAMICRANKS, isRetry : false, isDisplay : true});
    } else {
      params.tournamentState = tournament.state;
      params.startingChips = tournament.noOfChipsAtGameStart;
      //params.gameVersionCount = tournament.gameVersionCount;
      cb(null, params);
    }
  });
};


// Get TournamentUser and ranks dynamically
/**
 * this function gets tournamentUsers and ranks dynamically in a series of steps
 * @method getRegisteredTournamentUsers
 * @param  {string}                     tournamentId     
 * @param  {string}                     gameVersionCount 
 */
dynamicRanks.getRegisteredTournamentUsers = function(tournamentId,gameVersionCount) {
  serverLog(stateOfX.serverLogType.info,"in getTournamentUsers in tournament.js - "+ tournamentId,gameVersionCount);
  var params = {
    tournamentId: tournamentId,
    gameVersionCount : gameVersionCount
  };
  async.waterfall([
    async.apply(getTournamentRoom, params),
    getAllRegisteredTournamentUsers,
    getUserInfo,
    processRegisteredUser,
    createResponseForTournamentUsers
  ], function(err, response){
    if(err) {
      serverLog(stateOfX.serverLogType.info,"Error in calculating get getRegisteredTournamentUsersfsaveRanks");
    } else {
      serverLog(stateOfX.serverLogType.info,"final response in getRegisteredTournamentUsers" + JSON.stringify(response));
      var updatedData = {
        ranks: response,
        tournamentId : (params.tournamentId).toString(),
        gameVersionCount : params.gameVersionCount
      };
      var query = {
        tournamentId : (params.tournamentId).toString(),
        gameVersionCount : params.gameVersionCount
      };
      imdb.upsertRanks(query,updatedData,function(err,result) {
        if(err || !result) {
          serverLog(stateOfX.serverLogType.info,"error in saving ranks in imdb");
        } else {
          serverLog(stateOfX.serverLogType.info,"ranks saved successfully in imdb");
        }
      });
    }
  });
};

module.exports = dynamicRanks;
