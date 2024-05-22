/*jshint node: true */
"use strict";

var db                   = require("../../../../shared/model/dbQuery.js"),
  createTable            = require("../../../../shared/createTournamentTable.js"),
  prizeAlgo              = require("../../../../shared/prizeAlgo.js"),
  stateOfX               = require("../../../../shared/stateOfX.js"),
  profileMgmt            = require("../../../../shared/model/profileMgmt.js"),
  startTournamentHandler = require("./startTournamentHandler"),
  // startGameHandler       = require("./startGameHandler"),
  cancelTournament       = require("./cancelTournament.js"),
  imdb                   = require("../../../../shared/model/inMemoryDbQuery.js"),
  popupTextManager       = require("../../../../shared/popupTextManager"),
  zmqPublish             = require("../../../../shared/infoPublisher.js"),
  async                  = require("async"),
  _                      = require("underscore"),
  schedule               = require('node-schedule');

const configConstants = require('../../../../shared/configConstants');
var tournamentSchedular ={};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'tournament schedular';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

//this function validate whether minimum player available for tournament start
var validateTournamentStart = function(params, callback) {
  serverLog(stateOfX.serverLogType.info,"in validate tournament start is in entryHandler is - " + params);
  var filter = {
    tournamentId: params.room._id.toString(),
    gameVersionCount: params.room.gameVersionCount,
    isActive: true
  };
  serverLog(stateOfX.serverLogType.info,"filter is ",filter);
  db.countTournamentusers(filter, function(err,count) {
    serverLog(stateOfX.serverLogType.info,"count is in countTournamentusers is - " + count);
    if(err || count< params.room.minPlayersForTournament) {
      serverLog(stateOfX.serverLogType.info,"Going to cancel tournament");
      cancelTournament.cancel(params.room);
      broadcastHandler.fireBroadcastToAllSessions({app: params.globalThis, data: {_id: params.room._id, state: stateOfX.tournamentState.cancelled, event: stateOfX.recordChange.tournamentStateChanged}, route: stateOfX.broadcasts.tournamentStateChange});
      _.omit(filter, 'isActive');
      db.findTournamentUser(filter, function(err, result){
        serverLog(stateOfX.serverLogType.info,"count is in findTournamentUser is - " + result);
        if(!err && result){
          for(var i=0; i<result.length; i++){
            broadcastHandler.fireTournamentCancelledBroadcast({self: {app: params.globalThis}, playerId: result[i].playerId, tournamentId: params.room._id, info: "Tournament has been cancelled.", route: stateOfX.broadcasts.tournamentCancelled});
          }
        }
        else{
          callback({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBCOUNTTOURNAMENTUSERSFAIL_TOURNAMENTSCHEDULER});
        }
      });

      callback({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBCOUNTTOURNAMENTUSERSFAIL_TOURNAMENTSCHEDULER});
      //callback({success: false, info:"Error in count tournament players or less enrolled players"});
    } else {
      callback(null, params);
    }
  });
};

var createTableForNormalTournament = function(params, callback) {
  serverLog(stateOfX.serverLogType.info,"In create table in schedular - ");
  createTable.create(params.room, function(result) {
    if(result.success) {
      callback(null, params);
    } else {
      callback({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.falseMessages.CREATETABLEFORNORMALTOURNAMENTFAIL_TOURNAMENTSCHEDULER});
      //callback({success: false, info:"error in creating table"});
    }
  });
};


var getPrizeRuleForNormalTournament = function(params, cb) {
	serverLog(stateOfX.serverLogType.info,"in getPrizeRuleForNormalTournament in calculate ranks - ");
  db.getPrizeRule(params.tournament._id.toString(), function(err, prizeRule) {
    if(err) {
      serverLog(stateOfX.serverLogType.info,"getting prize Error");
      cb(params);
    } else {
      serverLog(stateOfX.serverLogType.info,"prizeRule is ",JSON.stringify(prizeRule));
      params.prizeRule = prizeRule; // Save the prize rule in params for furthur use
      cb(null,params);
    }
  });
};

var updateTournamentRanks = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,"ranks and count is in updateTournamentRanks are - ");
  var lastRank = params.count;
  async.eachSeries(params.ranks, function(rankObject, callback){
    rankObject.chipsWon = params.prizeRule[lastRank-1] || 0;
    rankObject.rank = params.rank;
    var filter = {
      tournamentId      : rankObject.tournamentId,
      playerId          : rankObject.playerId,
      gameVersionCount  : rankObject.gameVersionCount
    };
    db.modifyTournamentRanks(filter, rankObject, function(err, result) {
      if(err) {
        cb(params);
      } else {
        serverLog(stateOfX.serverLogType.info,"modified tournament rank successfully");
        callback();
      }
    });
  }, function(err) {
    if(err) {
      cb(params);
    } else {
      serverLog(stateOfX.serverLogType.info,"async runs successfully in updateTournamentRanks in tournamentSchedular");
      cb(null, params);
    }
  });
};

var countTournamentusers = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,"in count tournament usersin tournament schedular");
  db.countTournamentusers(params.filter, function(err,count) {
    serverLog(stateOfX.serverLogType.info,"count is in countTournamentusers is - ",count);
    if(err) {
      serverLog(stateOfX.serverLogType.info,"error in count tournament users in calculate ranks");
      cb(params);
    } else {
      params.count = count;
      cb(null, params);
    }
  });
};

var getTournamentRanks = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,"in getTournamentRanks");
  db.findTournamentRanks(params.filter, function(err, ranks) {
    if(err) {
      serverLog(stateOfX.serverLogType.info,"Error in find tournament ranks");
      cb(params);
    } else {
      params.ranks = ranks;
      cb(null, params);
    }
  });
};

var calculateRanks = function(tournament) {
  serverLog(stateOfX.serverLogType.info,"in calculateRanks in tournament schedular");
  var params = {};
  params.filter = {
    tournamentId      : tournament._id,
    gameVersionCount  : tournament.gameVersionCount,
  };
  params.tournament = tournament;
  async.waterfall([
    async.apply(countTournamentusers,params),
    getTournamentRanks,
    getPrizeRuleForNormalTournament,
    updateTournamentRanks
  ], function(err, result){
    if(err) {
      serverLog(stateOfX.serverLogType.info,"Error occured in calculateRanks()");
    } else {
      serverLog(stateOfX.serverLogType.info,"ranks updated successfully");
    }
  });
};



/**
 * schedules the calculateRanks function
 * @method scheduleCalculateRanks
 * @param  {[type]}   tournament request json object
 */
var scheduleCalculateRanks = function(tournament) {
  serverLog(stateOfX.serverLogType.info,"In scheduleCalculateRanks in tournament schedular");
  //call after delay of 5 secs because need to be sure that prize rule was created
  var date = new Date(tournament.tournamentStartTime + tournament.lateRegistrationTime + 5000);
	serverLog(stateOfX.serverLogType.info,"schedule time for calculate rank for calculate ranks " + date);
	schedule.scheduleJob(date, function(){
	  serverLog(stateOfX.serverLogType.info,'right time to schedule calculate tournament ranks');
    calculateRanks(tournament);
	});
};

/**
 * function to  decideSatellitePrizeRule
 *
 * @method decideSatellitePrizeRule
 * @param  {Object}       params  request json object
 * @param  {Function}     room      callback function
 * @return {Object}               params/validated object
 */
var decideSatellitePrizeRule = function(count, room) {
  serverLog(stateOfX.serverLogType.info,"In decideSatellitePrizeRule in tournamentSchedular" + count + JSON.stringify(room));
  serverLog(stateOfX.serverLogType.info,"In decideSatellitePrizeRule in tournamentSchedular entry fees is " + room.entryfees);
  serverLog(stateOfX.serverLogType.info,"In decideSatellitePrizeRule in tournamentSchedular parent buy in  is " + room.parentBuyIn);
  var noOfPrizes = Math.floor((count*room.entryfees)/room.parentBuyIn);
  serverLog(stateOfX.serverLogType.info, 'prize calculation is - ' + count*room.entryfees);
  serverLog(stateOfX.serverLogType.info,"noOfPrizes is in decideSatellitePrizeRule is - " + noOfPrizes);
  var lastPrize  = (count*room.entryfees)%room.parentBuyIn;
  serverLog(stateOfX.serverLogType.info,"lastPrize is in decideSatellitePrizeRule is - " + lastPrize);
  var prizeArray = [];
  for(var prizeIt=1; prizeIt<=noOfPrizes; prizeIt++) {
    prizeArray.push({
      "position" : prizeIt,
      "prizeMoney": 1,
      "prizeType" : "ticket"
    });
  }
  if(lastPrize > 0) {
    prizeArray.push({
      "position" : prizeIt,
      "prizeMoney" : lastPrize,
      "prizeType"  : "chips"
    });
  }
  serverLog(stateOfX.serverLogType.info,"prize array created is in decideSatellitePrizeRule - " + JSON.stringify(prizeArray));
  return prizeArray;
};

/**
 * function to  createPrizeRule
 *
 * @method createPrizeRule
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var createPrizeRule = function(room, cb) {
  serverLog(stateOfX.serverLogType.info,"in create prizeRule - " + JSON.stringify(room));
  var filter = {
    tournamentId: room._id.toString(),
    gameVersionCount: room.gameVersionCount,
    // isActive: true
  };
  serverLog(stateOfX.serverLogType.info,"filter is ",filter);
  db.countTournamentusers(filter, function(err,count) {
    serverLog(stateOfX.serverLogType.info,"count is in countTournamentusers is - " + count);
    if(err) {
      serverLog(stateOfX.serverLogType.info,"Error in count tournament users");
      cb({success: false});
    } else {
      db.findAllRebuy({tournamentId: room._id.toString(),gameVersionCount: room.gameVersionCount}, function(err, rebuy){
        if(!err) {
          var rebuySum = 0;
          var prizeRule;
          if(rebuy.length > 0) {
            var rebuyCountArray = _.pluck(rebuy, "rebuyCount");
            serverLog(stateOfX.serverLogType.info,'rebuy count array is - ' + JSON.stringify(rebuyCountArray));
            rebuySum = _.reduce(rebuyCountArray, function(memo, num){ return memo + num; }, 0);
            serverLog(stateOfX.serverLogType.info,'rebuy sum is - ' + rebuySum);
          }
          if(room.tournamentType === stateOfX.tournamentType.satelite) {
            prizeRule = decideSatellitePrizeRule(count, room);
          }
          if(room.tournamentType === stateOfX.tournamentType.normal) {
            serverLog(stateOfX.serverLogType.info,'line 222 in tournament Scheduler - ' + count);
            serverLog(stateOfX.serverLogType.info,'inside tournament Scheduler - ' + rebuySum);
            prizeRule = prizeAlgo.prizeForDb(count,room.minPlayersForTournament,room.entryfees,rebuySum*room.entryfees,0);
          }
          serverLog(stateOfX.serverLogType.info,"prize rule returned from algo is - " + JSON.stringify(prizeRule));
          var prize = {
            tournamentId : room._id.toString(),
            type : "server",
            prize : prizeRule
          };
          serverLog(stateOfX.serverLogType.info,"prize to be inserted is - " + JSON.stringify(prize));
          db.createPrizeRule(prize, function(err, result) {
            serverLog(stateOfX.serverLogType.info,"err and result is - " + err + result);
            if(err) {
              cb({success: false});
            } else {
              cb({success: true, prize: prize});
            }
          });
        } else {
          cb({success: false});
        }
      });
    }
  });
};

/**
 * function to  updateRegistrationOpenedStatus
 *
 * @method updateRegistrationOpenedStatus
 * @param  {Object}       tournamentId  
 * 
 */
var updateRegistrationOpenedStatus = function(tournamentId) {
  serverLog(stateOfX.serverLogType.info,"in updateRegistrationOpenedStatus in tournamentSchedular - " + JSON.stringify(tournamentId));
  db.updateTournamentGeneralize(tournamentId,{isLateRegistrationOpened : false}, function(err, result) {
    if(err) {
      serverLog(stateOfX.serverLogType.info,"Error in updateRegistrationOpenedStatus in tournament schedular");
    } else {
      serverLog(stateOfX.serverLogType.info,"updateRegistrationOpenedStatus success in tournament schedular");
    }
  });
};

/**
 * function to  updateRebuyOpenedStatus
 *
 * @method updateRebuyOpenedStatus
 * @param  {Object}       tournamentId  
 * 
 */
var updateRebuyOpenedStatus = function(tournamentId) {
  serverLog(stateOfX.serverLogType.info,"in updateRebuyOpenedStatus in tournamentSchedular - " + JSON.stringify(tournamentId));
  db.updateTournamentGeneralize(tournamentId,{isRebuyOpened : false}, function(err, result) {
    if(err) {
      serverLog(stateOfX.serverLogType.info,"Error in updateRebuyOpenedStatus in tournament schedular");
    } else {
      serverLog(stateOfX.serverLogType.info,"updateRebuyOpenedStatus success in tournament schedular");
    }
  });
};

/**
 * function to  broadcastForRebuyStatus
 *
 * @method broadcastForRebuyStatus
 * @param  {Object}       params  request json object
 */
var broadcastForRebuyStatus = function(params) {
  serverLog(stateOfX.serverLogType.info,'tournamentroom is - ' + JSON.stringify(params.room));
  var filter = {
    tournamentId: params.room._id.toString(),
    gameVersionCount: params.room.gameVersionCount
  };
  imdb.getAllTableByTournamentId(filter, function(err, channels) {
    serverLog(stateOfX.serverLogType.info,'all channels is in in memory is - ' + JSON.stringify(channels));
    if(err) {
      serverLog(stateOfX.serverLogType.info,"Error in getting tournament users in broadcastForRebuyStatus");
    } else {
        async.each(channels, function(channel, callback) {
          serverLog(stateOfX.serverLogType.info,'globalThis is in broadcastForRebuyStatus ++ ',params.rebuyTimeEnds);
          // serverLog(stateOfX.serverLogType.info,'globalThis is in broadcastForRebuyStatus - ',params.globalThis.app);
          var channelObj = params.globalThis.get('channelService').getChannel(channel.channelId, false);
          if(params.callerFunction == "REBUYABOUTTOEND")
            broadcastHandler.fireBroadcastForRebuyAboutToEnd({channel : channelObj, channelId: channel.channelId, rebuyTimeEnds: params.rebuyTimeEnds});
          else
            broadcastHandler.fireBroadcastForRebuyStatus({channel : channelObj, channelId: channel.channelId, rebuyStatus: params.rebuyStatus});

          callback();
        }, function(err) {
          if(err) {
            serverLog(stateOfX.serverLogType.info,'Error in sending rebuy status broadcast');
          } else {
            serverLog(stateOfX.serverLogType.info,'Successfully send rebuy status broadcast');
          }
        });
    }
  });
};

/**
 * function to  countPlayingPlayers
 *
 * @method countPlayingPlayers
 * @param  {Object}       params  request json object
 */
var countPlayingPlayers = function (params) {
  var filter = {
    tournamentId: params.room._id.toString(),
    gameVersionCount: params.room.gameVersionCount
  };
  serverLog(stateOfX.serverLogType.info,'in countPlayingPlayers - ',params);
  imdb.getAllTableByTournamentId(filter, function(err, channels) {
    serverLog(stateOfX.serverLogType.info,'all channels is in in memory is - ' + JSON.stringify(channels));
    if(err) {
      serverLog(stateOfX.serverLogType.info,"Erro in getting tournament users in broadcastForRebuyStatus");
    } else {
      var playingPlayers = 0, activeChannelId, activePlayerId;
        async.each(channels, function(channel, callback) {
          serverLog(stateOfX.serverLogType.info,'channel is - ' + JSON.stringify(channel));
          for(var i=0;i<channel.players.length;i++) {
            if(channel.players[i].state === stateOfX.playerState.playing || channel.players[i].state === stateOfX.playerState.waiting) {
              playingPlayers++;
              activeChannelId = channel.channelId;
              activePlayerId = channel.players[i].playerId;
            }
          }
          callback();
        }, function(err) {
          if(err) {
            serverLog(stateOfX.serverLogType.info,'Error in sending rebuy status broadcast');
          } else {
            serverLog(stateOfX.serverLogType.info,"playing player and channelId is" + playingPlayers + " " + activeChannelId);
            if(playingPlayers === 1) {
              profileMgmt.addChips({playerId: activePlayerId, chips: params.prize.prize[0].prizeMoney, isRealMoney: params.room.isRealMoney}, function(addChipsResponse) {
                serverLog(stateOfX.serverLogType.info,'add chips response is in tournamentSchedular - ' + JSON.stringify(addChipsResponse));
                if(addChipsResponse.success) {
                  var channelObj = params.globalThis.get('channelService').getChannel(activeChannelId, false);
                  var self = {};
                  self.app = params.globalThis;
                  self.app.rpcInvoke = params.globalThis.rpcInvoke;
                  self.app.rpc = params.globalThis.rpc; // pushing rpc in to app;
                  serverLog(stateOfX.serverLogType.info,'self is ', self);
                  sendPlayerEliminationBroadcast({
                    self: self,
                    playerId: activePlayerId,
                    gameVersionCount: params.room.gameVersionCount,
                    tournamentId: params.room._id.toString(),
                    channelId   : activeChannelId,
                    chipsWon : params.prize.prize[0].prizeMoney,
                  }, function() {
                    startGameHandler.startGame({self: self, session: "session", channelId: activeChannelId, channel: channelObj,eventName: stateOfX.startGameEvent.tournament});
                  });
                } else {
                  serverLog(stateOfX.serverLogType.info,'Add Chips failed');
                }
              });
            } else {
              serverLog(stateOfX.serverLogType.info,'no need to start game again more than one player left on channel');
            }
          }
        });
    }
  });
};

/**
 * function to sendPlayerEliminationBroadcast 
 *
 * @method sendPlayerEliminationBroadcast
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var sendPlayerEliminationBroadcast = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,'params.self in sendPlayerEliminationBroadcast', params.self);
  var broadcastData = {
    self : params.self,
    playerId : params.playerId,
    gameVersionCount : params.gameVersionCount,
    tournamentId : params.tournamentId,
    channelId : params.channelId,
    rank : 1,
    chipsWon : params.chipsWon,
    isGameRunning: false,
    isRebuyOpened: false,
    route: "playerElimination"
  };
  // serverLog(stateOfX.serverLogType.info,"broadcastData is - ",JSON.stringify(broadcastData));
  broadcastHandler.firePlayerEliminateBroadcast(broadcastData, function() {
    serverLog(stateOfX.serverLogType.info,"player elimination broadcast sent successfully tournament schedular");
    cb();
  });
};

/**
 * function to process prizeRule and Ranks 
 *
 * @method processPrizeRuleAndRanks
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var processPrizeRuleAndRanks = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,"params in processPrizeRuleAndRanks - " + JSON.stringify(params.room));
  if(!params.room.lateRegistrationAllowed && !params.room.isRebuyAllowed) {
    //Going to create prize when late registration is allowed
    if(params.room.tournamentType === stateOfX.tournamentType.normal || params.room.tournamentType === stateOfX.tournamentType.satelite) {
      createPrizeRule(params.room, function(result){
        if(result.success) {
          cb(null, params);
        } else {
          cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.falseMessages.PROCESSPRIZERULEANDRANKSFAIL_TOURNAMENTSCHEDULER});
        //  cb({success: false, info: "Error in creating prize rule"});
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.info,'This is not normal tournament so not creating prize rule ');
      cb(null, params);
    }
  } else {
    //Schedule create prize rule for later
    var tempDecisionTime1 = params.room.tournamentStartTime;
    var tempDecisionTime2 = params.room.tournamentStartTime;
    if(params.room.lateRegistrationAllowed) {
      tempDecisionTime1 += params.room.lateRegistrationTime*60000;
      //schedule late registration opened status
      schedule.scheduleJob(tempDecisionTime1, function(){
        updateRegistrationOpenedStatus(params.room._id);
        var self = {
          app: params.globalThis
        };
        tournamentActionHandler.prizePool({self: self, tournamentId: params.room._id.toString(), gameVersionCount: params.room.gameVersionCount});
      });
    }
    if(params.room.isRebuyAllowed) {
      tempDecisionTime2 += params.room.rebuyTime*60000;
      // schedule rebuy opened status
      schedule.scheduleJob(tempDecisionTime2, function(){
        updateRebuyOpenedStatus(params.room._id);
        params.rebuyStatus = false;
        broadcastForRebuyStatus(params);
      });
      // schedule rebuy about to end
      var rebuyTimeEnds = tempDecisionTime2 - (configConstants.rebuyAboutToEndTime*60000);
      console.log(".........................rebuyTimeEnds", rebuyTimeEnds);
      schedule.scheduleJob(rebuyTimeEnds, function(){
        params.callerFunction = "REBUYABOUTTOEND";
        params.rebuyTimeEnds = rebuyTimeEnds;
        serverLog(stateOfX.serverLogType.info,"schedule broadcast for rebuy is - ",prizeRulesDecisionTime);
        broadcastForRebuyStatus(params);
      });   
    }
    if(params.room.tournamentType === stateOfX.tournamentType.normal) {
      var prizeRulesDecisionTime = tempDecisionTime2>tempDecisionTime1 ? tempDecisionTime2 : tempDecisionTime1;
      serverLog(stateOfX.serverLogType.info,"prizeRulesDecisionTime is - ",prizeRulesDecisionTime);
      schedule.scheduleJob(prizeRulesDecisionTime, function(){
        createPrizeRule(params.room, function(result) {
          if(result.success) {
            calculateRanks(params.room);
            params.prize = result.prize;
            //Start Game if only one player left after rebuy and late registration ends
            countPlayingPlayers(params);
          } else {
            serverLog(stateOfX.serverLogType.info,"Error in creating prize rule");
          }
        });
      });
    }
    cb(null, params);
  }
};

/**
 * function to start tournament process
 *
 * @method startTournamentProcess
 * @param  {Object}       params  request json object
 * @param  {Function}     callerFunction      callback function
 * @return {Object}               params/validated object
 */
var startTournamentProcess = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,"in startTournamentProcess - " + params.room);
  var delayInStartTournament = configConstants.delayInNormalTournament*1000;
  serverLog(stateOfX.serverLogType.info,"--------------Going to start tournament------------");
  var self = {
    app: params.globalThis
  };
  var paramsForTournament = {
    tournamentId : params.room._id.toString(),
    gameVersionCount: params.room.gameVersionCount,
    self : self,
    session : "session"
  };
  setTimeout(function(){
    startTournamentHandler.process(paramsForTournament, function(){
      serverLog(stateOfX.serverLogType.info,"Start tournament response - ");
      params.rebuyStatus = params.room.isRebuyOpened;
      broadcastForRebuyStatus(params);
      

    });
    addOnProcess(params);
  },delayInStartTournament);
  cb(null, params);
};

/**
 * function to start tournament
 *
 * @method startTournament
 * @param  {Object}       params  request json object
 * @param  {Function}     callerFunction      callback function
 * @return {Object}               params/validated object
 */
var startTournament = function(room,globalThis) {
  serverLog(stateOfX.serverLogType.info,"in start tournament in tournament schedular" + globalThis);
  var params = {
    room : room,
    globalThis : globalThis
  };
  async.waterfall([
    async.apply(validateTournamentStart, params),
    createTableForNormalTournament,
    processPrizeRuleAndRanks,
    startTournamentProcess
  ], function(err, result) {
    if(err) {
      serverLog(stateOfX.serverLogType.info,"err in startTournament in schedlar is - " + JSON.stringify(err));
    } else {
      serverLog(stateOfX.serverLogType.info,"result in startTournament in schedlar is - " +  result);
    }
  });
};

/**
 * function to check tournament start 
 *
 * @method checkTournamentStart
 * @param  {Object}       params  request json object
 * @param  {Function}     callerFunction      callback function
 * @return {Object}               params/validated object
 */
tournamentSchedular.checkTournamentStart = function(globalThis) {
  serverLog(stateOfX.serverLogType.info,"in checkTournamentStart in tournament schedular");
  schedule.scheduleJob('*/5 * * * * *', function(){
    serverLog(stateOfX.serverLogType.info,'The answer to life, the universe, and everything!' + new Date());
    serverLog(stateOfX.serverLogType.info,"in checkTournamentStart");
    var currentTime = (new Date()).getTime();
    db.findTournamentRoom({tournamentStartTime:{$lte:currentTime,$gte:currentTime-60000},state: stateOfX.tournamentState.register},function(err, rooms) {
      serverLog(stateOfX.serverLogType.info,"all rooms are in scanTournaments are - ",JSON.stringify(rooms));
      async.eachSeries(rooms, function(room, callback) {
        serverLog(stateOfX.serverLogType.info,"going to cange state of tournament - " + JSON.stringify(room));
        db.updateTournamentStateToRunning(room._id, function(err, result){
          if(err) {
            serverLog(stateOfX.serverLogType.info,"Error in change state of tournament in schedular");
            callback();
          } else {
            startTournament(room,globalThis);
            serverLog(stateOfX.serverLogType.info,"Successfully in change state of tournament in schedular");
            callback();
          }
        });
      },function(err) {
        if(err) {
          serverLog(stateOfX.serverLogType.info,"Error in scan tournaments");
        } else {
          serverLog(stateOfX.serverLogType.info,"All tournaments runs successfully");
        }
      });
    });
  });
};

 
/**
 * check whether addon is enabled or disabled in the current tournament room
 *
 * @method checkAddOnEnabled
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var checkAddOnEnabled = function(params, cb){
  serverLog(stateOfX.serverLogType.info, "in checkAddOnEnabled in addOnProcess "+params);
  if(params.room.isAddonEnabled)
    cb(null, params);
  else
    cb({success: false, info: popupTextManager.falseMessages.CHECKADDONENABLED_ADDONPROCESS_TOURNAMENTSCHEDULER});
};


/**
 * get the addon levels
 *
 * @method getAddOnTime
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var getAddOnTime = function(params, cb){
  serverLog(stateOfX.serverLogType.info, "in getAddOnTime in addOnProcess "+ JSON.stringify(params.room));
  if(params.room.isAddonEnabled && params.room.addonTime && params.room.addonTime.length > 0){
    cb(null, params);
  }
  else{
    cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.falseMessages.GETADDONTIME_ADDONPROCESS_TOURNAMENTSCHEDULER});
  }
};


/**
 * this function gets the blind rule using tournamentId from database
 *
 * @method getBlindRule
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var getBlindRule = function(params, cb){
  serverLog(stateOfX.serverLogType.info, "in getBlindRule in addOnProcess "+ JSON.stringify(params.room));
  if(params.room._id && params.room.gameVersionCount && params.room.blindRule){
    db.findBlindRule(params.room.blindRule, function(err, result){
      serverLog(stateOfX.serverLogType.info, "in db result in getBlindRule in addOnProcess "+ JSON.stringify(result));
      serverLog(stateOfX.serverLogType.info, "in db result in getBlindRule in addOnProcess "+ JSON.stringify(result.list));

      if(!err && result){
        params.blindRuleResult = result.list;
        cb(null, params);
      }
      else{
        cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBLASTBLINDRULE_GETBLINDANDPRIZE_TOURNAMENT});
      }
    });

  }
};


/**
 * this function updates the rebuy status and send broadcasts for addon
 *
 * @method updateRebuyAndsendBroadcastForAddOn
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var updateRebuyAndsendBroadcastForAddOn = function(params, cb){
  serverLog(stateOfX.serverLogType.info, "in updateRebuyAndsendBroadcastForAddOn in addOnProcess "+ JSON.stringify(params.room));
  serverLog(stateOfX.serverLogType.info, "in updateRebuyAndsendBroadcastForAddOn in addOnProcess "+ JSON.stringify(params.blindRuleResult));
  serverLog(stateOfX.serverLogType.info, "in addon time in addOnProcess "+ JSON.stringify(params.room.addonTime));

  async.eachSeries(params.room.addonTime, function(addonTimeObject, escb){
    serverLog(stateOfX.serverLogType.info, "in async each series updateRebuyAndsendBroadcastForAddOn in addOnProcess "+ JSON.stringify(addonTimeObject));
    // serverLog(stateOfX.serverLogType.info, "in async each series  time To START in addOnProcess "+ params.blindRuleResult[addonTimeObject.level-1].minutes);
    // serverLog(stateOfX.serverLogType.info, "in async each series  time To End in addOnProcess "+ params.blindRuleResult[addonTimeObject.level].minutes);
    var timeToStart = params.room.tournamentStartTime + ((!!(params.blindRuleResult[addonTimeObject.level-1])?params.blindRuleResult[addonTimeObject.level-1].minutes : 0))*60000 ;
    var timeToEnd = !!(params.blindRuleResult[addonTimeObject.level])?(params.room.tournamentStartTime + (params.blindRuleResult[addonTimeObject.level].minutes)*60000):0; 
    serverLog(stateOfX.serverLogType.info, "in async each series time to start  in addOnProcess "+ timeToStart);
    serverLog(stateOfX.serverLogType.info, "in async each series  time To End in addOnProcess "+ timeToEnd);
    scheduleBroadcastForAddonStart(params, timeToStart+10);
    scheduleBroadcastForAddonEnd(params, timeToEnd);
    escb();

  }, function(err){
    if(err){
      cb(params);
    }
    else{
      cb(null, params);
    }
  });

};

// var scheduleBroadcastForAddon = function(params){
//   schedule.scheduleJob(date, function(){
//     serverLog(stateOfX.serverLogType.info,'right time to schedule addon broadcast');
//      broadcastForAddon(params, function(err, callback){
//        if(err){
//          cb(params)
//        }
//        else{
//          escb();
//        }
//      });
//    });

// }


/**
 * this funtion schedules broadcaast for addon start
 *
 * @method scheduleBroadcastForAddonStart
 * @param  {Object}       params  request json object
 * @param  {Function}     timeToBroadcast      callback function
 * @return {Object}               params/validated object
 */
var scheduleBroadcastForAddonStart = function(params, timeToBroadcast){
  serverLog(stateOfX.serverLogType.info, "in scheduleBroadcastForAddon in addOnProcess "+ JSON.stringify(timeToBroadcast));
  schedule.scheduleJob(timeToBroadcast, function(){
    serverLog(stateOfX.serverLogType.info,'right time to schedule addon broadcast');
     broadcastForAddon(params, "ADDONSTART");
   });

};



/**
 * this funtion schedules broadcaast for addon end
 *
 * @method scheduleBroadcastForAddonEnd
 * @param  {Object}       params  request json object
 * @param  {Function}     timeToBroadcast      callback function
 * @return {Object}               params/validated object
 */
var scheduleBroadcastForAddonEnd = function(params, timeToBroadcast){
  serverLog(stateOfX.serverLogType.info, "in scheduleBroadcastForAddon in addOnProcess "+ JSON.stringify(timeToBroadcast));
  schedule.scheduleJob(timeToBroadcast, function(){
    serverLog(stateOfX.serverLogType.info,'right time to schedule addon broadcast');
     broadcastForAddon(params, "ADDONEND");
   });

};


/**
 * this function sends broadcast for addon start and end
 *
 * @method broadcastForAddon
 * @param  {Object}       params  request json object
 * @param  {Function}     callerFunction      callback function
 * @return {Object}               params/validated object
 */
var broadcastForAddon = function(params, callerFunction) {
  serverLog(stateOfX.serverLogType.info,'tournamentroom is - ' + JSON.stringify(params.room));
  var filter = {
    tournamentId: params.room._id.toString(),
    gameVersionCount: params.room.gameVersionCount
  };
  imdb.getAllTableByTournamentId(filter, function(err, channels) {
    serverLog(stateOfX.serverLogType.info,'all channels is in in memory is - ' + JSON.stringify(channels));
    if(err) {
      serverLog(stateOfX.serverLogType.info,"Error in getting tournament users in broadcastForAddon");
    } else {
        async.each(channels, function(channel, callback) {
        serverLog(stateOfX.serverLogType.info,'in async each all channels is in in memory is - ' + JSON.stringify(channel));


          var channelObj = params.globalThis.get('channelService').getChannel(channel.channelId, false);
          console.log("channelObj-----------", channelObj);
          if(callerFunction == "ADDONEND"){
            console.log("in fireBroadcastForAddon.............end");
            updateAddonEligibility(filter, {isEligibleForAddon: false});
            broadcastHandler.fireBroadcastForAddon({ route: "addonTimeEnds", channel : channelObj, channelId: channel.channelId, info: "Addon time ended"});
          }
          else{
            console.log("in fireBroadcastForAddon.............start");
            updateAddonEligibility(filter, {isEligibleForAddon: true});
            broadcastHandler.fireBroadcastForAddon({ route: "addonTimeStarts", channel : channelObj, channelId: channel.channelId, info: "Addon time started"});
          }

          callback();
        }, function(err) {
          if(err) {
            serverLog(stateOfX.serverLogType.info,'Error in sending addon status broadcast');
          } else {
            serverLog(stateOfX.serverLogType.info,'Successfully send addon status broadcast');
          }
        });
    }
  });
  // if(callerFunction == "ADDONEND"){
  //   updateData = {isEligibleForAddon: true};
  // }
  // else{
  //   updateData = {isEligibleForAddon: false};
  // }

  //updateAddonEligibility(filter, updateData);
};


/**
 * this function updates addon eligibility according to addon start and end 
 *
 * @method updateAddonEligibility
 * @param  {Object}       params  request json object
 * @param  {Function}     callerFunction      callback function
 * @return {Object}               params/validated object
 */
var updateAddonEligibility = function(filter, updateData ){
  serverLog(stateOfX.serverLogType.info,'updateAddonEligibility dbquery- ' + filter + "......" + updateData);
  db.updateRebuyWithoutInsert(filter, updateData, function(err, result){
    if(!err && result){
      serverLog(stateOfX.serverLogType.info,'success in sending addon status broadcast');
    }
    else{
      serverLog(stateOfX.serverLogType.info,'Error in sending addon status broadcast');
    }
  });
};



/**
 * function for addOn process, calculates addOn time and sends broadcast
 *
 * @method addOnProcess
 * @param  {Object}       params  request json object
 * @param  {Function}     callerFunction      callback function
 * @return {Object}               params/validated object
 */
var addOnProcess = function(params, cb){
  serverLog(stateOfX.serverLogType.info, "in addOnProcess in tournament schedular "+params.room);
  async.waterfall([
    async.apply(checkAddOnEnabled, params),
    getAddOnTime,
    getBlindRule,
    updateRebuyAndsendBroadcastForAddOn
    ], function(err, result){
    if(!err && result){
      serverLog(stateOfX.serverLogType.info, "result in addOnProcess in tournament schedular "+result);
    }
    else{
      serverLog(stateOfX.serverLogType.info, "err in addOnProcess in tournament schedular "+JSON.stringify(err));
    }
  });

};



module.exports = tournamentSchedular;
