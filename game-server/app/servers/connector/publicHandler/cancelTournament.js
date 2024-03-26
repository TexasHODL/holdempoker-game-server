var async       = require("async"),
    stateOfX    = require("../../../../shared/stateOfX.js"),
    dbConfigMsg  = require('../../../../shared/popupTextManager').dbQyeryInfo,
    configMsg = require('../../../../shared/popupTextManager').falseMessages,
    zmqPublish  = require("../../../../shared/infoPublisher.js"),
    ObjectID     = require('mongodb').ObjectID,
    db          = require("../../../../shared/model/dbQuery.js"),
    _           = require("underscore");

  function serverLog (type, log) {
    var logObject = {};
    logObject.fileName      = 'cancelTournament';
    logObject.serverName    = stateOfX.serverType.connector;
    // logObject.functionName  = arguments.callee.caller.name.toString();
    logObject.type          = type;
    logObject.log           = log;
    zmqPublish.sendLogMessage(logObject);
  }
var cancelTournament = {};
/**
 * function initializeParams is used to initialise data for the tournament which needs to be cancelled 
 *
 * @method initializeParams
 * @param  {Object}       tournament  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var initializeParams = function(tournament, cb) {
  serverLog(stateOfX.serverLogType.info,"in initializeParams in cancelTournament is - "+JSON.stringify(tournament));
  var params = {};
  params.tournament = tournament;
  params.tournamentFees = tournament.entryfees + tournament.housefees + tournament.bountyfees;
  params.playerIds = [];
  params.enrolledPlayers = 0;
  var filter = {
    gameVersionCount  : params.tournament.gameVersionCount,
    tournamentId      : params.tournament._id,
    isActive          : true
  };
  db.countTournamentusers(filter, function(err, count) {
    if(err) {
      cb({success: false, info:"Error in count enrolled players", isRetry: false, isDisplay: false,channelId : ""});
    } else {
      serverLog(stateOfX.serverLogType.info,"enrolled players are in initializeParams are - " + params.enrolledPlayers);
      params.enrolledPlayers = count;
      cb(null, params);
    }
  });
};
/**
 * function deActivateTournamentUsers is used to deActivate TournamentUsers  for the tournament which needs to be cancelled 
 *
 * @method deActivateTournamentUsers
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var deActivateTournamentUsers = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,"in deActivateTournamentUsers in cancelTournament is - " +  JSON.stringify(params));
  if(params.enrolledPlayers > 0) {
    var filter = {
      gameVersionCount  : params.tournament.gameVersionCount,
      tournamentId      : params.tournament._id
    };
    db.updateMultipleTournamentUser(filter,{isActive: false}, function(err, result) {
    if(err) {
      // cb({success: false, info:"Error in modifyTournamentUsers in deActivateTournamentUsers"});
      serverLog(stateOfX.serverLogType.info,"Error in modifyTournamentUsers in deActivateTournamentUsers");
      cb({success: false, info: dbConfigMsg.DBUPDATEMULTIPLETOURNAMENTUSERFAIL_CANCELTOURNAMENT, isRetry: false, isDisplay: false, channelId: ""});
//      cb({success: false, info:"Error in modifyTournamentUsers in deActivateTournamentUsers"});
    } else {
      serverLog(stateOfX.serverLogType.info,"result is in modifyTournamentUsers is in deActivateTournamentUsers is - "+JSON.stringify(result));
      filter.isActive = false;
      db.findTournamentUser(filter, function(err, response) {
        serverLog(stateOfX.serverLogType.info,response);
        if(err || !response) {
          // cb({success: false, info:"Error in findTournamentUser in deActivateTournamentUsers"});
          cb({success: false, info: dbConfigMsg.DBFINDTOURNAMENTUSERFAIL_CANCELTOURNAMENT, isRetry: false, isDisplay: false, channelId: ""});
        } else {
          params.playerIds = _.pluck(response,"playerId");
          cb(null, params);
        }
      });
    }
  });
  } else {
    cb(null, params);
  }
};

/**
 * this function credits real money chips to user
 * @method addRealChips
 * @param  {array}     playerIds array of player ids
 * @param  {int}     chips     chips to be added
 * @param  {Function}   cb        callback function
 */
var addRealChips = function(playerIds,chips,cb) {
  serverLog(stateOfX.serverLogType.info,"in addRealChips()"+playerIds + chips);
  db.addRealChipsToMultiplePlayers(playerIds,chips, function(err, result) {
    if(err) {
      // cb({success: false, info: "Error in addRealChips"});
      serverLog(stateOfX.serverLogType.info,"Error in addRealchips in cancelTournament");
      cb({success: false, info: dbConfigMsg.DBADDREALCHIPSTOMULTIPLEPLAYERSFAIL_CANCELTOURNAMENT, isRetry: false, isDisplay: false, channelId: ""});
//      cb({success: false, info: "Error in addRealChips"});
    } else {
      serverLog(stateOfX.serverLogType.info,"add realChips successfully");
      cb({success: true});
    }
  });
};

/**
 * this function credits play money chips to user
 * @method addFreeChips
 * @param  {array}     playerIds array of player ids
 * @param  {int}     chips     chips to be added
 * @param  {Function}   cb        callback function
 */
var addFreeChips = function(playerIds,chips,cb) {
  serverLog(stateOfX.serverLogType.info,"in addFreeChips()"+playerIds + chips);
  db.addFreeChipsToMultiplePlayers(playerIds,chips, function(err, result) {
    if(err) {
      serverLog(stateOfX.serverLogType.info,"Error in addFreechips in cancelTournament");
      cb({success: false, info: dbConfigMsg.DBADDFREECHIPSTOMULTIPLEPLAYERSFAIL_CANCELTOURNAMENT, isRetry: false, isDisplay: true, channelId: ""});
//      cb({success: false, info:"Error in addFreChips"});
    } else {
      serverLog(stateOfX.serverLogType.info,"add freeChips successfully");
      cb({success: true});
    }
  });
};
/**
 * function creditChipsToPlayers is used to credit Chips To Players if tournament is real money then add Real Chips else add Free chips
 *
 * @method creditChipsToPlayers
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var creditChipsToPlayers = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,"params is in creditChipsToPlayers is - " + JSON.stringify(params));
  if(params.enrolledPlayers > 0) {
    if(params.tournament.isRealMoney) {
      addRealChips(params.playerIds, params.tournamentFees, function(response) {
        if(response.success) {
          cb(null, params);
        } else {
          cb(response);
        }
      });
    } else {
      addFreeChips(params.playerIds, params.tournamentFees, function(response) {
        if(response.success) {
          cb(null, params);
        } else {
          cb(response);
        }
      });
    }
  } else {
      cb(null, params);
  }
};
/**
 * function changeTournamentState is used to change tournament state from running to cancelled
 *
 * @method changeTournamentState
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var changeTournamentState = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,"params is in changeTournamentState in cancelTournament is - " + JSON.stringify(params));
  var query = {};
  query._id = ObjectID(params.tournament._id);
  var updateData = {};
  updateData.state = stateOfX.tournamentState.cancelled;
  if(params.tournament.isRecurring){
    query.isRecurring = params.tournament.isRecurring;
    updateData.tournamentStartTime = params.tournament.tournamentStartTime + params.tournament.recurringTime*60*60000;  
  }
  db.updateTournamentStateAndVersionGenralized(query, updateData, function(err, result) {
    if(err) {
      // cb({success: false, info: "Error in change tournament state"});
      serverLog(stateOfX.serverLogType.info,"Error in changeTournamentState in cancelTournament");
      cb({success: false, info: dbConfigMsg.DBUPDATETOURNAMENTSTATEANDVERSIONFAIL_CANCELTOURNAMENT, isRetry: false, isDisplay: false, channelId: ""});
    } else {
      serverLog(stateOfX.serverLogType.info,"successfully changed state of tournament");
      cb(null, params);
    }
  });
};
/**
 * function cancelTournament is used to cancelTournament  through a series of async funtions defined above
 *
 * @method cancelTournament
 * @param  {Object}       params  request json object
 */
cancelTournament.cancel = function(tournament) {
  serverLog(stateOfX.serverLogType.info,"in cancel tournament, tournament is - " + JSON.stringify(tournament));
  async.waterfall([
    async.apply(initializeParams,tournament),
    deActivateTournamentUsers,
    creditChipsToPlayers,
    changeTournamentState,
  ], function(err, result) {
    if(err) {
      serverLog(stateOfX.serverLogType.info,"err in cancel tournament"+err);
    } else {
      serverLog(stateOfX.serverLogType.info,"tournament cancelled successfully");
    }
  });
};

module.exports = cancelTournament;
