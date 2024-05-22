/*jshint node: true */
"use strict";

// This file is used to handle cases in order to start tournament

// ### External files and packages declaration ###
var _                     = require('underscore'),
    async                 = require("async"),
    keyValidator          = require("../../../../shared/keysDictionary"),
    imdb                  = require("../../../../shared/model/inMemoryDbQuery.js"),
    db                    = require("../../../../shared/model/dbQuery.js"),
    stateOfX              = require("../../../../shared/stateOfX.js"),
    zmqPublish            = require("../../../../shared/infoPublisher.js"),
    popupTextManager      = require("../../../../shared/popupTextManager"),
    tournamentJoinHandler = require('./tournamentJoinHandler'),
    responseHandler       = require("./responseHandler"),
    commonHandler         = require("./commonHandler"),
    broadcastHandler      = require('./broadcastHandler');

const configConstants = require('../../../../shared/configConstants');

var startTournamentHandler = {};


/**
 * // Create data for log generation
 *
 * @method serverLog
 * @param  {Object}       type,log  request json object
 * @return {Object}               params/validated object
 */
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'startTournamentHandler';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}



/**
 * This functioin is used to fetch tournament tables
 *
 * @method fetchTournamentTables
 * @param  {Object}       params  request json object
 * @param  {Function}     callback      callback function
 * @return {Object}               params/validated object
 */
var fetchTournamentTables = function(params, callback) {
  keyValidator.validateKeySets("Request", params.self.app.serverType, "fetchTournamentTables", params, function (validated) {
    if(validated.success) {
      serverLog(stateOfX.serverLogType.info, "params is in fetchTournamentTables - " + _.keys(params));
      db.findTable({"tournament.tournamentId": params.tournamentId}, function(err, tables) {
        if(err) {
          callback({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBFINDTABLE_DBERROR_STARTTOURNAMENTHANDLER});
          //callback({success: false, info: "error in getting table for db"});
        } else {
          serverLog(stateOfX.serverLogType.info, "tables are in fetchTournamentTables " + JSON.stringify(tables));
          if(!!tables && tables.length > 0) {
            params.tables = tables;
            serverLog(stateOfX.serverLogType.info, "params.tables is in fetch tournament tables is " + JSON.stringify(params.tables));
            callback(null,params);
          } else {
            callback({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBFINDTABLE_TABLENOTEXIST_STARTTOURNAMENTHANDLER});
            //callback({success: false, info: "table doesnot exist for this tournamentId"});
          }
        }
      });
    } else {
      callback(validated);
    }
  });
};


/**
 * This function is used to create channel for tournament
 * @method fetchTournamentTables
 * @param  {Object}       params  request json object
 * @param  {Function}     callback      callback function
 * @return {Object}               params/validated object
 */
var createChannelForTournament = function(params, callback) {
  keyValidator.validateKeySets("Request", params.self.app.serverType, "createChannelForTournament", params, function (validated) {
    if(validated.success) {
      var createdChannel = [];
      // Iterate through tables
      serverLog(stateOfX.serverLogType.info, "params.tables are in createChannelForTournament " ,JSON.stringify(params.tables));
      async.each(params.tables, function(table, cb){
        serverLog(stateOfX.serverLogType.info, "control current processing tabble - " + JSON.stringify(table));
        var channelId = table._id;
        var channel   = params.self.app.get('channelService').getChannel(channelId, true);
        // create channel
        serverLog(stateOfX.serverLogType.info, "pomelo channel while creating table in inMemory");
        tournamentJoinHandler.createChannel({self: params.self, session: params.session, channel: channel, channelId: channelId, channelType: table.channelType, tableId: "",playerId: "",gameVersionCount: params.gameVersionCount}, function (createTableResponse){
          createdChannel.push(createTableResponse.table);
          if(createTableResponse.success) {
            serverLog(stateOfX.serverLogType.info, "channel created successfully");
            serverLog(stateOfX.serverLogType.info, "createTableResponse: " + JSON.stringify(createTableResponse));
          } else {
            callback(createTableResponse);
          }
          cb();
        });
      },function(err){
        if(err) {
          callback({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBCREATECHANNELFORTOURNAMENTFAIL_STARTTOURNAMENTHANDLER});
          //next({success: false, info: "Error in channelCreate"});
        } else {
          params.channels = createdChannel;
          callback(null,params);
        }
      });
    } else {
      callback(validated);
    }
  });
};


/**
 * this functioin is for getting users for tournament who are registered
 * @method getTournamentUsers
 * @param  {Object}       params  request json object
 * @param  {Function}     callback      callback function
 * @return {Object}               params/validated object
 */
var getTournamentUsers = function(params, callback) {
  // serverLog(stateOfX.serverLogType.info, "params is in getTournamentUsers in startTournamentHandler is - ",params);
  keyValidator.validateKeySets("Request", params.self.app.serverType, "getTournamentUsers", params, function (validated) {
    if(validated.success) {
      db.findTournamentUser({isActive: true,tournamentId: params.tournamentId, gameVersionCount: params.gameVersionCount},function(err, result) {
        if(err) {
          callback({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBFINDTOURNAMENTUSER_DBERROR_STARTTOURNAMENTHANDLER});
          //cb({success: false, info: "Error in getting tournamentUser"});
        } else {
          if(!!result) {
            var playerIds = _.pluck(result,'playerId');
            params.playerIds = playerIds;
            callback(null,params);
          } else {
            callback({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBFINDTOURNAMENTUSER_NOUSER_STARTTOURNAMENTHANDLER});
            //cb({success: false, info: "No tournament users for this this tournament"});
          }
        }
      });
    } else {
      callback(validated);
    }
  });
};


/**
 * This function is used to get number of rebuy opt
 *
 * @method isRebuyOpt
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var isRebuyOpt = function(params, cb) {
  // serverLog(stateOfX.serverLogType.info, "params is in countRebuyOpt in start tournament handler " + JSON.stringify(params));
  var filter = {
    tournamentId     : params.tournamentId,
    gameVersionCount : params.gameVersionCount,
    playerId         : params.playerId
  };
  db.countRebuyOpt(filter, function(err, rebuy) {
    if(!err) {
      var rebuyCount = (!!rebuy && !!rebuy.rebuyCount) ? rebuy.rebuyCount : 0;
      if(rebuyCount === 0){
        cb({success: true, rebuyOpt: false});
      } else {
        cb({success: true, rebuyOpt: true});
      }
    } else {
      cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBCOUNTREBUYOPTFAIL_STARTTOURNAMENTHANDLER});
      //cb({success: false, info: "Error in rebuy count"});
    }
  });
};


/**
 * Save this record for disconnection handling
 *
 * @method saveActivityRecord
 * @param  {Object}       params  request json object
 * 
 * @return {Object}               params/validated object
 */
var saveActivityRecord = function(params) {
  // serverLog(stateOfX.serverLogType.info, "in startTournamentHandler for function saveActivityRecord");
  serverLog(stateOfX.serverLogType.info, 'params is in saveActivityRecord' + JSON.stringify(params));
  var dataToInsert = {
    channelId:  params.channelId,
    playerId:   params.playerId,
    isRequested:true,
    playerName: params.playerName,
    channelType:stateOfX.gameType.tournament,
    tableId:    params.tableId
  };
  imdb.upsertActivity({channelId: params.channel, playerId: params.playerId}, dataToInsert, function(err, result) {
    if(!err && !!result) {
      serverLog(stateOfX.serverLogType.info, 'successfully saved ActivityRecord');
    } else {
      serverLog(stateOfX.serverLogType.info, "Error in saving activity");
    }
  });
};



/**
 * This function is used to  join channel for tournamnt
 *
 * @method joinChannelForTournament
 * @param  {Object}       params  request json object
 * @param  {Function}     callback      callback function
 * @return {Object}               params/validated object
 */
var joinChannelForTournament = function(params, callback) {
  keyValidator.validateKeySets("Request", params.self.app.serverType, "joinChannelForTournament", params, function (validated) {
    if(validated.success) {
      serverLog(stateOfX.serverLogType.info, "playerIds are in joinChannelForTournament ",JSON.stringify(params.playerIds));
      //getting users from db
      db.findUserArray(params.playerIds,function(err,players) {
        if(err) {
          callback({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBFINDUSERARRAYFAIL_DBERROR_STARTTOURNAMENTHANDLER});
          //callback({success: false, info: "Error in getting players"});
        } else {
          if(!!players && players.length > 0) {
            var channelIndex = 0, tableIndex = 1;
            var maxPlayerOnChannel = params.tables[0].maxPlayers;
            serverLog(stateOfX.serverLogType.info, "max players on the channel is - " + maxPlayerOnChannel);
            //Iterate over players and add to waiting players for tournament
            async.eachSeries(players, function(player,cb) {
              serverLog(stateOfX.serverLogType.info, "playerId and tableIndex is in joinChannelForTournament is " + player.playerId,tableIndex);
              serverLog(stateOfX.serverLogType.info, "channels - " + JSON.stringify(params.channels));
              serverLog(stateOfX.serverLogType.info, "chips at game start is " + params.tables[0]);
              var startingChips = params.tables[0].noOfChipsAtGameStart;
              isRebuyOpt({tournamentId: params.tables[0].tournament.tournamentId, gameVersionCount: params.gameVersionCount, playerId: player.playerId}, function(isRebuyOpt) {
                if(isRebuyOpt.success) {
                  var startingChips = isRebuyOpt.rebuyOpt ? 2*params.tables[0].noOfChipsAtGameStart : params.tables[0].noOfChipsAtGameStart;
                  params.self.app.rpc.database.tableRemote.addWaitingPlayerForTournament(params.session, {channelId: params.channels[channelIndex].channelId , playerId: player.playerId , seatIndex: tableIndex++ , playerName: player.firstName || player.userName , imageAvtar: player.profileImage, chips: startingChips,userName: player.userName, timeBank: params.channels[channelIndex].tournamentRules.timeBank}, function (addWaitingPlayerResponse) {
                    console.log("addWaitingPlayerForTournament response is - " + JSON.stringify(addWaitingPlayerResponse));
                    saveActivityRecord({tableId: params.tables[0].tournament.tournamentId, channelId: params.channels[channelIndex].channelId, playerId: player.playerId, playerName: player.firstName || player.userName });
                    for(var i=0;i<params.channels.length;i++) {
                      if(params.channels[i].channelId === params.channels[channelIndex].channelId) {
                        params.channels[i].players.push(addWaitingPlayerResponse.player);
                      }
                    }
                    if((tableIndex-1) === maxPlayerOnChannel) {
                      serverLog(stateOfX.serverLogType.info, 'In memory table: ' + JSON.stringify(params.channels[channelIndex]));
                      channelIndex++;
                      tableIndex = 1;
                    }
                    cb();
                  });
                } else {
                  serverLog(stateOfX.serverLogType.info, 'Error in Rebuy opt count');
                  callback(isRebuyOpt);
                }
              });
            }, function(err) {
              if(err) {
                callback({success:false, info:"Error in async in sit player", isRetry: false, isDisplay: false, channelId: ""});
              }
              serverLog(stateOfX.serverLogType.info, "channels in result in async.series - " + JSON.stringify(params.channels));
              callback(null, params);
            });
          } else {
            callback({success: false, isRetry: false, isDisplay: true, channelId: "", info: popupTextManager.dbQyeryInfo.DBFINDUSERARRAYFAIL_NOPLAYERS_STARTTOURNAMENTHANDLER});
            //callback({success: false, info: "players not found"});
          }
        }
      });
    } else {
      callback(validated);
    }
  });
};


/**
 *  This function is used to join players channel in tournament
 *
 * @method joinPlayerToChannelForTournament
 * @param  {Object}       params  request json object
 * @param  {Function}     callback      callback function
 * @return {Object}               params/validated object
 */
var joinPlayerToChannelForTournament = function(params, callback) {
  keyValidator.validateKeySets("Request", params.self.app.serverType, "joinPlayerToChannelForTournament", params, function (validated) {
    if(validated.success) {
      // iterate through channels
      async.eachSeries(params.channels, function(channel, cb) {
        serverLog(stateOfX.serverLogType.info, 'Processing channel - ' + JSON.stringify(channel));
        var tempChannel;
        async.eachSeries(channel.players, function(player, cbe) {
          tempChannel = params.self.app.get('channelService').getChannel(channel.channelId, true);
          //create object to join channels
          var temp = {
            channel : tempChannel,
            self    : params.self,
            playerId: player.playerId,
            playerName: player.playerName
          };
          // call join player to channel function
          tournamentJoinHandler.joinPlayerToChannel(temp, function(joinPlayerToChannelResponse) {
            if(joinPlayerToChannelResponse.success) {
              commonHandler.assignTableSettings({playerId: player.playerId, channelId: channel.channelId, tableId: "", data: {}, playerName: player.playerName || "A player"}, function(err, assignTableSettingsResponse){
                if(!err) {
                  assignTableSettingsResponse.self  = params.self;
                  assignTableSettingsResponse.table = channel;
                  responseHandler.setJoinChannelKeys(assignTableSettingsResponse, function(keysResponse) {
                    if(keysResponse.success) {
                      //create data for braodast
                      console.log("key response is - " + JSON.stringify(keysResponse));
                      keysResponse.table                    = channel;
                      keysResponse.table.roomConfig         = {};
                      keysResponse.table.roomConfig.tableId = channel.tournamentRules.tournamentId;

                      var broadcastData = {
                        self: params.self,
                        playerId: player.playerId,
                        channelId: channel.channelId,
                        tableId : channel.tournamentRules.tournamentId,
                        msg: {
                          timer : configConstants.delayInSitNGoTimer,
                          table : keysResponse
                        },
                        route : "tournamentGameStart"
                      };
                      serverLog(stateOfX.serverLogType.info, 'About to send tournament start broadcast -  ' + JSON.stringify(broadcastData.msg.table));
                      //fire braodcast ot users
                      broadcastHandler.fireBroadcastForStartTournament(broadcastData, function(fireBroadcastForStartTournamentResponse) {
                        serverLog(stateOfX.serverLogType.info, "tournament room broadcast sent successfully",fireBroadcastForStartTournamentResponse);
                      });
                    } else {
                      callback(keysResponse);
                    }
                  });
                } else {
                  callback(assignTableSettingsResponse);
                }
              });
            } else {
              callback(joinPlayerToChannelResponse);
            }
          });
          cbe();
        }, function(err) {
          if(err) {
            cb();
          }
          var paramsForStartGame = {
            self: params.self,
            session: params.session,
            channelId: channel.channelId,
            channel: tempChannel,
            eventName: stateOfX.startGameEvent.tournament
          };
          setTimeout( function() {
            // var startGameHandler      = require('./startGameHandler');
            startGameHandler.startGame(paramsForStartGame);
          }, parseInt(configConstants.delayInSitNGoTimer)*1000);
          cb();
        });
      }, function(err) {
        if(err) {
          callback(err);
        }
        callback(null,params);
      });
    } else {
      callback(validated);
    }
  });
};
/**
 *  This function is used to process a series of async functions 
 *
 * @method process
 * @param  {Object}       params  request json object
 * @param  {Function}     callback      callback function
 * @return {Object}               params/validated object
 */
startTournamentHandler.process = function(params, cb) {
  // serverLog(stateOfX.serverLogType.info, "params is in startTournamentHandler ",params);
	async.waterfall([

    async.apply(fetchTournamentTables,params),
    createChannelForTournament,
    getTournamentUsers,
    joinChannelForTournament,
    joinPlayerToChannelForTournament

  ], function(err, result){
    serverLog(stateOfX.serverLogType.info, "result is in start tournament --- " + err + result);
    if(err) {
      cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.falseMessages.STARTTOURNAMENTFAIL_STARTTOURNAMENTHANDLER});
      //cb({success: false, info: "Error while starting tournament."});
    } else {
    	cb({success: true, result: result});
    }
  });
};
/**
 *  This function is used to saveTournamentRanks
 *
 * @method saveTournamentRanks
 * @param  {Object}       data  request json object
 */
var saveTournamentRanks = function(params) {
  var data = {
    playerId          : params.playerId,
    tournamentId      : params.tournamentId,
    gameVersionCount  : params.gameVersionCount,
    tournamentName    : params.tournamentName,
    channelId         : params.channelId,
    chipsWon          : params.chipsWon,
    rank              : params.rank,
    ticketsWon        : params.ticketsWon,
    userName          : params.userName,
    isCollected       : false
  };
  serverLog(stateOfX.serverLogType.info, 'going to save ranks for satellite - ' + JSON.stringify(data));
  db.insertRanks(data, function(err, ranks) {
    serverLog(stateOfX.serverLogType.info, "in insert ranks result is - " + ranks);
    if(err) {
      serverLog(stateOfX.serverLogType.info, 'Error in insert rank in db in save tournamentRank of satellite');
    } else {
      serverLog(stateOfX.serverLogType.info, 'successfully inserted ranks for satellite');
      // For autoRegistration
      if(data.ticketsWon === 1) {
        satelliteTournament.register({
          playerId : data.playerId,
          gameVersionCount : data.gameVersionCount,
          parentId : data.parentId
        }, function(registerResponse) {
          serverLog(stateOfX.serverLogType.info, 'satellite register response is - ' + JSON.stringify(registerResponse));
        });
      }
    }
  });
};
/**
 *  This function is used for eliminationProcess 
 *
 * @method process
 * @param  {Object}       self , channel request json object
 * @return {Object}               params/validated object
 */
startTournamentHandler.eliminationProcess = function(self,channel) {
  serverLog(stateOfX.serverLogType.info, "channel is in elimination process is - " + JSON.stringify(channel));
  db.getTournamentRoom(channel.tournamentRules.tournamentId, function(err, result) {
    serverLog(stateOfX.serverLogType.info, 'result is-'+ JSON.stringify(result));
    if(!!result) {
      serverLog(stateOfX.serverLogType.info, 'in result');
      if(!!channel.channelType && (channel.channelType).toUpperCase() === stateOfX.gameType.tournament) {
        serverLog(stateOfX.serverLogType.info, 'in channelType');
        async.eachSeries(channel.tournamentRules.ranks, function(player, callback) {
          serverLog(stateOfX.serverLogType.info, "creating broadcast data for playerEliminationBroadcast ---" + JSON.stringify(player));
          if(!player.isPrizeBroadcastSent) {
            var broadcastData = {
              self : self,
              playerId : player.playerId,
              gameVersionCount : player.gameVersionCount,
              tournamentId : player.tournamentId,
              channelId : player.channelId,
              rank : player.rank,
              chipsWon : player.chipsWon,
              isGameRunning : channel.tournamentRules.isGameRunning,
              tournamentName : player.tournamentName,
              isRebuyOpened : !!result.isRebuyOpened ? result.isRebuyOpened : false,
              route: "playerElimination",
              tournamentType : channel.tournamentType,
              ticketsWon     : player.ticketsWon || 0,
              parentId       : channel.tournamentRules.parentId
            };
            // serverLog(stateOfX.serverLogType.info, "broadcastData is - ",JSON.stringify(broadcastData));
            if(channel.tournamentType === stateOfX.tournamentType.satelite) {
              saveTournamentRanks(broadcastData);
            }
            player.isPrizeBroadcastSent = true;
            broadcastHandler.firePlayerEliminateBroadcast(broadcastData, function() {
              serverLog(stateOfX.serverLogType.info, "player elimination broadcast sent successfully in make move");
              //update values in db of isbroadcastsent and isgiftdistributed
              self.app.rpc.database.requestRemote.updateTournamentRules("session",{channelId:player.channelId, playerId: player.playerId}, function (updateTournamentRulesResponse) {
                serverLog(stateOfX.serverLogType.info, 'response from updateTournamentRules - ' + JSON.stringify(updateTournamentRulesResponse));
              });
              // imdb.setPrizeBroadcast(player.channelId, player.playerId, function(err, result) {
              //   serverLog(stateOfX.serverLogType.info, "err result " + err + result);
              // });
              // remove player record activity from imdb
              imdb.removeActivity({tableId: player.tournamentId, playerId: player.playerId}, function(err, result) {
                serverLog(stateOfX.serverLogType.info, "err result - " + err + result);
              });
              callback();
            });
          } else {
            callback();
          }
        }, function(error) {
          if(error) {
            serverLog(stateOfX.serverLogType.info, 'Error in sending broadcast for rank');
          } else {
            serverLog(stateOfX.serverLogType.info, 'Broadcast for ranks send successfully');
          }
        });
      }
    } else {
      serverLog(stateOfX.serverLogType.info, 'Error in getting tournament room');
    }
  });
};


/**
 *  This method is used for sending broadcast with updated chip with bounty. 
 *
 * @method process
 * @param  {Object}       self,bountyPlayers  request json object
 * @return {Object}               params/validated object
 */
var sendChipsUpdateBroadcast = function(self, bountyPlayers){
  async.each(bountyPlayers, function(player, callback){
    db.getCustomUser(player.winnerPlayerId, {freeChips: 1, realChips:1}, function(err, user) {
      broadcastHandler.sendMessageToUser({self: self, msg: {playerId: player.winnerPlayerId, updated: {freeChips: user.freeChips, realChips: user.realChips}}, playerId: player.winnerPlayerId, route: stateOfX.broadcasts.updateProfile});
      callback();
    });
  },function(err){
      serverLog(stateOfX.serverLogType.info, "sendChipsUpdateBroadcast sent successfully.");
  });
};

/**
 *  This method is used for sending bounty Broadcast. 
 *
 * @method process
 * @param  {Object}       self,channel  request json object
 */
startTournamentHandler.sendBountyBroadcast = function(self,channel) {
  serverLog(stateOfX.serverLogType.info, "channel is in sendBountyBroadcast is - " + JSON.stringify(channel));
  var bountyPlayers = channel.bountyWinner || [];
  serverLog(stateOfX.serverLogType.info, "bountyPlayers are in send bounty broadcast - " + JSON.stringify(bountyPlayers));
  sendChipsUpdateBroadcast(self,bountyPlayers);
  for(var playerIt=0; playerIt<bountyPlayers.length; playerIt++) {
    var info = "You won bounty of "+bountyPlayers[playerIt].bountyMoney + " from ";
    serverLog(stateOfX.serverLogType.info, "bounty info is - " + info);
    for(var bountyIt=0; bountyIt<bountyPlayers[playerIt].looserPlayers.length; bountyIt++) {
      info = info + bountyPlayers[playerIt].looserPlayers[bountyIt].playerName + " ";
    }
    var broadcastData = {
      self      : self,
      playerId  : bountyPlayers[playerIt].winnerPlayerId,
      heading   : "Bounty Winner",
      info      : info,
      channelId : channel.channelId,
      buttonCode: 1
    };
    serverLog(stateOfX.serverLogType.info, "going to send bounty broad cast");
    broadcastHandler.fireInfoBroadcastToPlayer(broadcastData);
  }
};

module.exports = startTournamentHandler;
