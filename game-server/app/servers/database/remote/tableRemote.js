/*jshint node: true */
"use strict";

/**
 * Created by Amrendra on 14/06/2016.
**/
var async            = require("async"),
    _ld              = require("lodash"),
    _                = require("underscore"),
    setMove          = require("./setMove"),
    adjustIndex      = require("./adjustActiveIndex"),
    cardAlgo         = require("../../../util/model/deck"),
    randy            = require("../../../util/model/randy"),
    stateOfX         = require("../../../../shared/stateOfX"),
    keyValidator     = require("../../../../shared/keysDictionary"),
    mongodb          = require("../../../../shared/mongodbConnection"),
    db               = require("../../../../shared/model/dbQuery"),
    imdb             = require("../../../../shared/model/inMemoryDbQuery.js"),
    zmqPublish       = require("../../../../shared/infoPublisher"),
    lockTable        = require("./lockTable"),
    responseHandler  = require('./responseHandler'),
    popupTextManager = require("../../../../shared/popupTextManager"),
    tableManager     = require("./tableManager");
const configConstants = require('../../../../shared/configConstants');
// Create data for log generation
function serverLog (type, log) {
  var logObject          = {};
  logObject.fileName     = 'tableRemote';
  logObject.serverName   = stateOfX.serverType.database;
  // logObject.functionName = arguments.callee.caller.name.toString();
  logObject.type         = type;
  logObject.log          = log;
  // zmqPublish.sendLogMessage(logObject);
  console.log(JSON.stringify(logObject));
}

// Start zmq publisher
// zmqPublish.startPublisher(7002);

var tableRemote = function (app) {
  // this.app = app;
  // this.channelService = app.get('channelService');
};

// MOST OF FUNCTIONS ARE SIMILAR
// IN LOOK, SYNTAX and PURPOSE
// They try to lock table for some action
// action happens and return to callback
// 
// CALLED by rpc.database.tableRemote.'FunctionName'
// 


// ### Deduct amount from player profile

// never used
var deductChipsOnSit = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "deduct chips in deductChipsOnSit tableRemote");
  keyValidator.validateKeySets("Request", params.serverType, "deductChipsOnSit", params, function (validated){
    if(validated.success) {
      db.deductRealChips({playerId: params.playerId}, params.chips, function (err, response) {
        serverLog(stateOfX.serverLogType.info, "response in deductChipsOnSit");
        serverLog(stateOfX.serverLogType.info, JSON.stringify(response));
        if(err) {
          cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.dbQyeryInfo.DBDEDUCTREALCHIPS_DEDUCTCHIPSONSIT_TABLEREMOTE});
          //cb({success: false, info: "Deduct chips on sit failed!"});
        } else {
          cb({success: true});
        }
      });
    } else {
      cb(validated);
    }
  });
};

// Generate waiting player structure
// uses - tableManager.createPlayer - synchronous operation
var generatePlayer = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "params in generatePlayer - "+JSON.stringify(params));
  serverLog(stateOfX.serverLogType.info, "params is in generate players is in tableRemote is - ",JSON.stringify(params));
  keyValidator.validateKeySets("Request", params.serverType, "generatePlayer", params, function (validated){
    if(validated.success) {
      cb({success: true, player: tableManager.createPlayer(params)});
    } else {
      cb(validated);
    }
  });
};

// <<<<<<<<<<<<<<<<<<< RPC CALLS HANDLER STARTS >>>>>>>>>>>>>>>>>>>>>>>>>

// ### Distribute cards to players
tableRemote.prototype.distributecards = function (params, cb) {
  var self = this;
  keyValidator.validateKeySets("Request", "database", "distributecards", params, function (validated){
    if(validated.success) {
      params.self = self;
      lockTable.lock({channelId: params.channelId, actionName: "distributecards", data: {}}, function (lockTableResponse){
        if(lockTableResponse.success) {
          var successResponse = {success: true, players: lockTableResponse.data.players};
          keyValidator.validateKeySets("Response", "database", "distributecards", successResponse, function (validated){
            if(validated.success) {
              cb(successResponse);
            } else {
              cb(validated);
            }
          });
        } else {
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};
// ### Get table config details
tableRemote.prototype.tableConfig = function (params, cb) {
  var self = this;
  keyValidator.validateKeySets("Request", "database", "tableConfig", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "getTable", data: {}}, function (lockTableResponse){
        if(lockTableResponse.success) {
          responseHandler.setGameStartKeys({channelId: params.channelId, table: lockTableResponse.table}, function(setGameStartKeysResponse){
            keyValidator.validateKeySets("Response", "database", "tableConfig", setGameStartKeysResponse, function (validated){
              if(validated.success) {
                cb(setGameStartKeysResponse);
              } else {
                cb(validated);
              }
            });
          });
        } else {
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

// ### Handle sit out in next hand

tableRemote.prototype.sitoutNextHand = function (params, cb) {
  var self = this;
  keyValidator.validateKeySets("Request", "database", "sitoutNextHand", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "sitoutNextHand", data: params}, function (lockTableResponse){
        if(lockTableResponse.success) {
          keyValidator.validateKeySets("Response", "database", "sitoutNextHand", lockTableResponse.data, function (validated){
            if(validated.success) {
              cb(lockTableResponse.data);
            } else {
              cb(validated);
            }
          });
        } else {
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

// ### Handle sit out in next big blind

tableRemote.prototype.sitoutNextBigBlind = function (params, cb) {
  var self = this;
  keyValidator.validateKeySets("Request", "database", "sitoutNextBigBlind", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "sitoutNextBigBlind", data: params}, function (lockTableResponse){
        if(lockTableResponse.success) {
          keyValidator.validateKeySets("Response", "database", "sitoutNextBigBlind", lockTableResponse.data, function (validated){
            if(validated.success) {
              cb(lockTableResponse.data);
            } else {
              cb(validated);
            }
          });
        } else {
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

// Handle player action move

tableRemote.prototype.makeMove = function (params, cb) {
  var successResponse = {};
  keyValidator.validateKeySets("Request", "database", "makeMove", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "makeMove", data: params}, function (lockTableResponse){
        // serverLog(stateOfX.serverLogType.info, 'makeMove lockTableResponse - ' + JSON.stringify(lockTableResponse));
        if(lockTableResponse.success) {
          successResponse = lockTableResponse.data.response;
          serverLog(stateOfX.serverLogType.info, 'successResponse - ' + JSON.stringify(successResponse));
          keyValidator.validateKeySets("Response", "database", "makeMove", successResponse, function (validated){
            if(validated.success) {
              cb(successResponse);
            } else {
              cb(validated);
            }
          });
        } else {
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

tableRemote.prototype.updatePrecheckOrMakeMove = function(params, cb) {
  lockTable.lock({channelId: params.channelId, actionName: "updatePrecheckOrMakeMove", data: params}, function (lockTableResponse) {
    if (lockTableResponse.success) {
      console.error('----======== lockTableResponse', JSON.stringify(lockTableResponse));
      if (lockTableResponse.data && lockTableResponse.data.moveResponse) {
        cb({success: true, msg: lockTableResponse.data.msg||{}, makeMoveResponse: lockTableResponse.data.moveResponse});
      } else {
        cb({success: true});
      }
    } else {
      cb(lockTableResponse);
    }
  });
};


// Leave or standup a player

tableRemote.prototype.leave = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "tableRemote leave - " + JSON.stringify(params));
  // var successResponse = {};
  keyValidator.validateKeySets("Request", "database", "leave", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "leave", data: params}, function (lockTableResponse){
        serverLog(stateOfX.serverLogType.info, "LEAVE DATA - " + JSON.stringify(lockTableResponse));
        serverLog(stateOfX.serverLogType.info, 'leave lockTableResponse - ' + JSON.stringify(lockTableResponse));
        if(lockTableResponse.success) {
          // cb(lockTableResponse.data.response);
          var successResponse = lockTableResponse.data.response;
          serverLog(stateOfX.serverLogType.info, 'successResponse - ' + JSON.stringify(successResponse));
          keyValidator.validateKeySets("Response", "database", "leave", successResponse, function (validated){
            if(validated.success) {
              cb(successResponse);
            } else {
              cb(validated);
            }
          });
        } else {
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};


// Handle additional game start cases (Auto ALLIN or GAME OVER)
tableRemote.prototype.processCases = function (params, cb) {
  keyValidator.validateKeySets("Request", "database", "processCases", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "processCases", data: params}, function (lockTableResponse){
        serverLog(stateOfX.serverLogType.info, 'processCases lockTableResponse - ' + JSON.stringify(lockTableResponse));
        cb(lockTableResponse);
      });
    } else {
      cb(validated);
    }
  });
};

// ### Auto sitout (mainly when no action taken)

tableRemote.prototype.autoSitout = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "In tableRemote autoSitout.");
  var self = this;
  keyValidator.validateKeySets("Request", "database", "autoSitout", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "autoSitout", data: params}, function (lockTableResponse){
        if(lockTableResponse.success) {
          cb(lockTableResponse);
        } else {
          serverLog(stateOfX.serverLogType.info, "tableRemote-autoSitOut()");
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

tableRemote.prototype.autoFoldCount = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "Inside tableRemote autofold count");
  var self = this;
  keyValidator.validateKeySets("Request", "database", "autoFoldCount", params, function(validated){
    if(validated.success){
      lockTable.lock({ channelId: params.channelId, actionName: "autoFoldCount", data: params }, function (lockTableResponse) {
        if (lockTableResponse.success) {
          console.log("success inside lockTable response in incrementing autoFold Count" + lockTableResponse);
          cb(lockTableResponse);
        } else {
          console.log("inside error of lockTable response in incrementing autoFold Count" + lockTableResponse);
          cb(lockTableResponse);
        }
      });
    }else{
      cb(validated);
    }
  });
};

tableRemote.prototype.setAutoFoldResetValue = function (params, cb) {
  var self = this;
  lockTable.lock({channelId: params.channelId, actionName: "setAutoFoldResetValue", data: params}, function(lockTableResponse){
    if (lockTableResponse.success) {
      console.log("success inside lockTable response in incrementing autoFold Count" + lockTableResponse);
      cb(lockTableResponse);
    } else {
      console.log("inside error of lockTable response in incrementing autoFold Count" + lockTableResponse);
      cb(lockTableResponse);
    }
  });
};


// ### Resume player from sitout mode

tableRemote.prototype.resume = function (params, cb) {
  var self = this;
  keyValidator.validateKeySets("Request", "database", "resume", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "resume", data: params}, function (lockTableResponse){
        if(lockTableResponse.success) {
          keyValidator.validateKeySets("Response", "database", "resume", lockTableResponse.data, function (validated){
            if(validated.success) {
              cb(lockTableResponse.data);
            } else {
              cb(validated);
            }
          });
        } else {
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

// ### Join player in waiting list for this channel

tableRemote.prototype.joinQueue = function (params, cb) {
  var self = this;
  keyValidator.validateKeySets("Request", "database", "joinQueue", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "joinQueue", data: params}, function (lockTableResponse){
        if(lockTableResponse.success) {
          keyValidator.validateKeySets("Response", "database", "joinQueue", lockTableResponse, function (validated){
            if(validated.success) {
              cb(lockTableResponse.data);
            } else {
              cb(validated);
            }
          });
        } else {
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

// ### Set player attribute

tableRemote.prototype.setPlayerAttrib = function (params, cb) {
  var self = this;
  keyValidator.validateKeySets("Request", "database", "setPlayerAttrib", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "setPlayerAttrib", data: params}, function (lockTableResponse){
        if(lockTableResponse.success) {
          cb(lockTableResponse.data);
        } else {
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};


// ### Set player attribute

tableRemote.prototype.getTableAttrib = function (params, cb) {
  var self = this;
  keyValidator.validateKeySets("Request", "database", "getTableAttrib", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "getTableAttrib", data: params}, function (lockTableResponse){
        if(lockTableResponse.success) {
          cb(lockTableResponse.data);
        } else {
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

// ### Set current player state as DISCONNECTED

tableRemote.prototype.setCurrentPlayerDisconn = function (params, cb) {
  var self = this;
  keyValidator.validateKeySets("Request", "database", "setCurrentPlayerDisconn", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "setCurrentPlayerDisconn", data: params}, function (lockTableResponse){
        if(lockTableResponse.success) {
          cb(lockTableResponse.data);
        } else {
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};


// ### Get attribute of any player on table

tableRemote.prototype.getPlayerAttribute = function (params, cb) {
  var self = this;
  keyValidator.validateKeySets("Request", "database", "getPlayerAttribute", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "getPlayerAttribute", data: params}, function (lockTableResponse){
        if(lockTableResponse.success) {
          cb(lockTableResponse.data);
        } else {
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

// ### Get attribute of any player on table

tableRemote.prototype.getCurrentPlayer = function (params, cb) {
  var self = this;
  keyValidator.validateKeySets("Request", "database", "getCurrentPlayer", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "getCurrentPlayer", data: params}, function (lockTableResponse){
        if(lockTableResponse.success) {
          cb(lockTableResponse.data);
        } else {
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};


//### Add playes to table when tournament
tableRemote.prototype.addWaitingPlayerForTournament = function (params, cb) {
  var self            = this,
      successResponse = {};
  keyValidator.validateKeySets("Request", "database", "addWaitingPlayerForTournament", params, function (validated){
    if(validated.success) {
      params.serverType = "database";
      console.log("params.table is in addWaitingPlayerForTournament - " + JSON.stringify(params.table));
      // params.maxBuyIn = params.table.maxBuyIn;
      generatePlayer(params, function (generatePlayerResponse){
        if(generatePlayerResponse.success) {
          lockTable.lock({channelId: params.channelId, actionName: "addWaitingPlayerForTournament", data: {player: generatePlayerResponse.player}}, function (lockTableResponse){
            if(lockTableResponse.success) {
              successResponse = {success: true, player: generatePlayerResponse.player, table: lockTableResponse.table};
              keyValidator.validateKeySets("Response", "database", "addWaitingPlayerForTournament", successResponse, function (validated){
                if(validated.success) {
                  cb(successResponse);
                } else {
                  cb(validated);
                }
              });
            } else {
              cb(lockTableResponse);
            }
          });
        } else {
          cb(generatePlayerResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

// try starting a game on a channelId
tableRemote.prototype.startGameProcess = function(params, cb) {
  var self = this; //STARTGAMEPROCESS
  keyValidator.validateKeySets("Request", "database", "shouldStartGame", params, function (validated){
    if (validated.success) {
      params.self = self;
      lockTable.lock({channelId: params.channelId, actionName:"startGameProcess", data: {}, self: self}, function (lockTableResponse) {
        if (lockTableResponse.success) {
          var successResponse = {success: true, data: lockTableResponse.data, table: lockTableResponse.table};
          cb(successResponse);
        } else {
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

// ### Validate game condition to start or not
// Reset complete table
// Check total active players count
  // Set game state as running
  // Send game players broadcast data and game will start
// Do not start game send players with state
  // Set game state as IDLE
tableRemote.prototype.shouldStartGame = function (params, cb) {
  var self            = this,
      successResponse = {};
  keyValidator.validateKeySets("Request", "database", "shouldStartGame", params, function (validated){
    if(validated.success) {
      params.self = self;
      lockTable.lock({channelId: params.channelId, actionName: "shouldStartGame", data: {}}, function (lockTableResponse){
        if(lockTableResponse.success) {
          successResponse = {success: true, players: lockTableResponse.data.players, removed: lockTableResponse.data.removed, startGame: lockTableResponse.data.startGame, table: lockTableResponse.table, state: lockTableResponse.data.state, preGameState: lockTableResponse.data.preGameState};
          keyValidator.validateKeySets("Response", "database", "shouldStartGame", successResponse, function (validated){
            if(validated.success) {
              cb(successResponse);
            } else {
              cb(validated);
            }
          });
        } else {
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

// delete inmemory table
tableRemote.prototype.removeTable = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In memory cache table is going to be deleted: ' + JSON.stringify(params.channelId));
      
      imdb.removeTable({channelId: params.channelId}, function (err, data) {
        serverLog(stateOfX.serverLogType.info, "data in removeTable: " + JSON.stringify(data));
        if(err) {
          cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.dbQyeryInfo.DBREMOVETABLEFAIL_TABLEREMOTE});
          //cb({success: false, channelId: params.channelId, info: 'Error while removing table in db - ' + err});
        } else {
          cb({success: true, info: "Table removed successfully"});
        }
      });
};


// ### Create table object for a channel
// Create table using database parameters
// Store table into in memory database
// Response after a complete success
tableRemote.prototype.createTable = function (params, cb) {
  var self            = this,
      successResponse = {};
  keyValidator.validateKeySets("Request", "database", "createTable", params, function (validated){
    if(validated.success) {
      serverLog(stateOfX.serverLogType.info, "params before create table - " + JSON.stringify(params));
      var table = {
        channelId               : params.channelId,
        channelType             : (params.channelType).toUpperCase(),
        channelName             : params.channelName,
        serverId                : params.serverId,
        channelVariation        : params.channelVariation,
        turnTime                : params.turnTime,
        isPotLimit              : params.isPotLimit || false,
        maxPlayers              : params.maxPlayers,
        minPlayers              : params.minPlayers ,
        smallBlind              : params.smallBlind ,
        bigBlind                : params.bigBlind,
        isStraddleEnable        : params.isStraddleEnable,
        minBuyIn                : params.minBuyIn,
        maxBuyIn                : params.maxBuyIn,
        numberOfRebuyAllowed    : params.numberOfRebuyAllowed,
        hourLimitForRebuy       : params.hourLimitForRebuy,
        gameInfo                : params.gameInfo,
        rakeRules               : params.rakeRule,
        rake                    : params.rake,
        gameInterval            : params.gameInterval,
        isRealMoney             : params.isRealMoney,
        rebuyHourFactor         : params.rebuyHourFactor,

        isPrivate               : params.isPrivate,
        password                : params.password,

        blindMissed             : parseInt(configConstants.blindMissed),
        tournamentRules         : {},
        roundId                 : null,
        videoLogId              : null,
        state                   : stateOfX.gameState.idle,
        stateInternal           : stateOfX.gameState.starting,
        roundCount              : 1,
        deck                    : cardAlgo.getCards(),
        players                 : [],
        onStartPlayers          : [],
        queueList               : [],
        handHistory             : [],
        roundName               : null,
        roundBets               : [],
        roundMaxBet             : 0,
        lastBetOnTable          : 0,
        minRaiseAmount          : 0,
        maxRaiseAmount          : 0,
        raiseDifference         : 0,
        considerRaiseToMax : 0,
        lastRaiseAmount         : 0,
        isBettingRoundLocked    : false,
        isRunItTwiceApplied     : false,
        isForceRit              : params.isForceRit,
        maxBetAllowed           : 0,
        pot                     : [],
        contributors            : [],
        roundContributors       : [],
        boardCard               : [[], []],
        preChecks               : [],
        bestHands               : [],

        dealerSeatIndex         : -1,
        nextDealerSeatIndex     : -1,
        smallBlindSeatIndex     : -1,
        nextSmallBlindSeatIndex : -1,
        bigBlindSeatIndex       : -1,
        dealerIndex             : -1,
        smallBlindIndex         : -1,
        bigBlindIndex           : -1,
        straddleIndex           : -1,
        currentMoveIndex        : -1,
        firstActiveIndex        : -1,

        turnTimeStartAt         : null,
        timeBankStartedAt       : null,
        isAllInOcccured         : false,
        isOperationOn           : false,
        actionName              : "",
        operationStartTime      : null,
        operationEndTime        : null,
        createdAt               : Number(new Date()),
        gameStartTime           : Number(new Date()),
        lastBlindUpdate         : Number(new Date()),
        blindLevel              : 1,
        vacantSeats             : 0,
        occupiedSeats           : 0,
        _v                      : 1
      };

      if(table.channelType === stateOfX.gameType.tournament) {
        table.tournamentType                = params.tournament.tournamentType;
        table.tournamentName                = params.tournamentName;
        table.shuffleTableId                = "";
        table.gameVersionCount              = params.gameVersionCount;
        table.noOfChipsAtGameStart          = params.noOfChipsAtGameStart;
        table.tournamentRules.ranks         = [];
        table.tournamentRules.timeBank      = params.tournament.extraTimeAllowed;
        table.tournamentRules.entryFees     = params.tournament.entryfees;
        table.tournamentRules.isGameRunning = true;
        table.tournamentRules.houseFees     = params.tournament.housefees;
        table.tournamentRules.isBountyEnabled = params.tournament.isBountyEnabled;
        table.tournamentRules.bountyFees    = params.tournament.bountyfees;
        table.tournamentRules.totalPlayer   = params.tournament.maxPlayersForTournament;
        table.tournamentRules.tournamentId  = params.tournament.tournamentId;
        table.tournamentRules.gameVersionCount  = params.gameVersionCount;
        table.ante                          = params.ante;
        table.tournamentRules.winner        = [];
      }
      if(!!params.tournament && params.tournament.tournamentType === stateOfX.tournamentType.sitNGo) {
        table.tournamentRules.prizeId      = params.tournament.prizeRule;
      }
      if(!!params.tournament && (params.tournament.tournamentType === stateOfX.tournamentType.normal || params.tournament.tournamentType === stateOfX.tournamentType.satelite)) {
          table.lateRegistrationAllowed   = params.tournament.lateRegistrationAllowed;
          table.tournamentBreakDuration   = params.tournament.tournamentBreakDuration;
          table.tournamentBreakTime       = params.tournament.tournamentBreakTime;
          table.tournamentStartTime       = params.tournament.tournamentStartTime;
          table.lateRegistrationTime      = params.tournament.lateRegistrationTime || 0;
          table.isRebuyAllowed            = params.tournament.isRebuyAllowed;
          table.rebuyTime                 = params.tournament.rebuyTime;
          table.isOnBreak                 = false;
          table.isTournamentRunning       = true;
          table.addonTime                 = params.tournament.addonTime;
          table.addonRule                 = params.tournament.addonRule;
          table.breakRuleId               = params.tournament.breakRuleId;
          table.breakLevel                = 0;
          table.breakRuleData             = params.tournament.breakRuleData || {};
          table.blindRuleData             = params.tournament.blindRuleData || {};
          table.timeBankRuleData          = params.tournament.timeBankRuleData || {};
          table.timeBankLevel             = params.tournament.timeBankRuleData[0].blindLevel ;
          table.timeBankRule              = params.tournament.timeBankRule;
          table.isAddonEnabled            = params.tournament.isAddonEnabled;
          table.isBreakTimerStart         = false;
          table.timerStarted              = "";
      }

      if(!!params.tournament && params.tournament.tournamentType === stateOfX.tournamentType.satelite) {
        table.tournamentRules.parentId = params.tournament.parentOfSatelliteId;
      }
      serverLog(stateOfX.serverLogType.info, 'In memory cache table is going to be created: ' + JSON.stringify(table));

      imdb.saveTable(table, function (err, data) {
        serverLog(stateOfX.serverLogType.info, "data in createTable: " + JSON.stringify(data));
        if(err) {
          cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.dbQyeryInfo.DBSAVETABLEFAIL_TABLEREMOTE});
          //cb({success: false, channelId: params.channelId, info: 'Error while saving table in db - ' + err});
        } else {
          successResponse = {success: true, table: table};
          keyValidator.validateKeySets("Response", "database", "createTable", successResponse, function (validated){
            if(validated.success) {
              cb(successResponse);
            } else {
              cb(validated);
            }
          });
        }
      });
    } else {
      cb(validated);
    }
  });
};

// ### Get complete table object from in memory database
tableRemote.prototype.getTable = function (params, cb) {
  var self            = this,
      successResponse = {};
  keyValidator.validateKeySets("Request", "database", "getTable", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "getTable", data: {}}, function (lockTableResponse){
        if(lockTableResponse.success) {
          successResponse = {success: true, table: lockTableResponse.table};
          keyValidator.validateKeySets("Response", "database", "getTable", successResponse, function (validated){
            if(validated.success) {
              cb(successResponse);
            } else {
              cb(validated);
            }
          });
        } else {
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};


// ### Sit a player into table
tableRemote.prototype.addWaitingPlayer = function (params, cb) {
  var self            = this,
      successResponse = {};
  keyValidator.validateKeySets("Request", "database", "addWaitingPlayer", params, function (validated){
    if(validated.success) {
      params.serverType = "database";
      console.trace("generate player--",params);
      generatePlayer(params, function (generatePlayerResponse){
        if(generatePlayerResponse.success) {
          lockTable.lock({channelId: params.channelId, actionName: "addWaitingPlayer", data: {player: generatePlayerResponse.player}}, function (lockTableResponse){
            serverLog(stateOfX.serverLogType.info, "Inside add waiting player response lockTable"+ JSON.stringify(lockTableResponse));
            if(lockTableResponse.success) {
              successResponse = {success: true, player: generatePlayerResponse.player, table: lockTableResponse.table};
              keyValidator.validateKeySets("Response", "database", "addWaitingPlayer", successResponse, function (validated){
                if(validated.success) {
                  console.log("Add waiting player validation success");
                  cb(successResponse);
                } else {
                  console.log("Add waiting player validation failed");
                  cb(validated);
                }
              });
            } else {
              cb(lockTableResponse);
            }
          });
        } else {
          cb(generatePlayerResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

// fetch buy in details of table
tableRemote.prototype.tableBuyIn = function (params, cb) {
  var self            = this,
      successResponse = {};
  keyValidator.validateKeySets("Request", "database", "tableBuyIn", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "tableBuyIn", data: {}}, function (lockTableResponse){
        if(lockTableResponse.success) {
          successResponse = {success: true, tableMinBuyIn: lockTableResponse.data.tableMinBuyIn, tableMaxBuyIn: lockTableResponse.data.tableMaxBuyIn};
          keyValidator.validateKeySets("Response", "database", "tableBuyIn", successResponse, function (validated){
            if(validated.success) {
              cb(successResponse);
            } else {
              cb(validated);
            }
          });
        } else {
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

// Add chips into player table buyin direct from table
tableRemote.prototype.addChipsOnTable = function (params, cb) {
  keyValidator.validateKeySets("Request", "database", "addChipsOnTable", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "addChipsOnTable", data: params}, function (lockTableResponse){
        if(lockTableResponse.success) {
          cb(lockTableResponse.data);
        } else {
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

// Add chips into player directly in tournament in rebuy option
//{channelId: "String", playerId: "String", amount: "Boolean", isRequested: "Boolean"},
tableRemote.prototype.addChipsOnTableInTournament = function (params, cb) {
  keyValidator.validateKeySets("Request", "database", "addChipsOnTable", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "addChipsOnTableInTournament", data: params}, function (lockTableResponse){
        if(lockTableResponse.success) {
          cb(lockTableResponse.data);
        } else {
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};


// toggle autoRebuy enabled key in player object in  inmemory
//{channelId: "String", playerId: "String", isAutoRebuyEnabled: "Boolean"},
tableRemote.prototype.updateAutoRebuy = function (params, cb) {
  lockTable.lock({channelId: params.channelId, actionName: "updateAutoRebuy", data: params}, function (lockTableResponse){
    if(lockTableResponse.success) {
      lockTableResponse.data.success = true;
      cb(lockTableResponse.data);
    } else {
      cb(lockTableResponse);
    }
  });
};

// toggle isAutoAddOn enabled key in player object in  inmemory
//{channelId: "String", playerId: "String", isAutAddOnEnabled: "Boolean"},
tableRemote.prototype.updateAutoAddon = function (params, cb) {
  lockTable.lock({channelId: params.channelId, actionName: "updateAutoAddon", data: params}, function (lockTableResponse){
    if(lockTableResponse.success) {
      lockTableResponse.data.success = true;
      cb(lockTableResponse.data);
    } else {
      cb(lockTableResponse);
    }
  });
};

// ### Reset player sitout option if player uncheck sitout options
tableRemote.prototype.resetSitout = function (params, cb) {
  keyValidator.validateKeySets("Request", "database", "resetSitout", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "resetSitout", data: params}, function (lockTableResponse){
        cb(lockTableResponse);
      });
    } else {
      cb(validated);
    }
  });
};

// ### Check if any player with same IP
// > already sitted on table
tableRemote.prototype.isSameNetworkSit = function (params, cb) {
  keyValidator.validateKeySets("Request", "database", "isSameNetworkSit", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "isSameNetworkSit", data: params}, function (lockTableResponse){
        cb(lockTableResponse);
      });
    } else {
      cb(validated);
    }
  });
};

// Get table details for client request
// > for the player who just want to take a look of game
// > without even joining into the game (from lobby)
tableRemote.prototype.getTableView = function (params, cb) {
  keyValidator.validateKeySets("Request", "database", "getTableView", params, function (validated){
    if(validated.success) {
      imdb.getTable(params.channelId, function(err, table) {
        if(err || !table) {
          // console.log("in the first console")
          db.findTableById(params.channelId, function(err, table) {
            if(err || !table) {
              cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.dbQyeryInfo.DBGETTABLE_GETTABLEVIEW_TABLEREMOTE});
              //cb({success: false, channelId: params.channelId, info: "Table details not found or tournament view request!"});
            } else {
              // console.log("in the second console")
              responseHandler.setTableViewKeys({table: table, channelId: params.channelId, playerId: params.playerId}, function(response){
                cb(response);
              });
            }
          });
        } else {
          // console.log("in the third console")
          db.findTableById(params.channelId, function(err, table2){
            if(err || !table2){
              cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.dbQyeryInfo.DBGETTABLE_GETTABLEVIEW_TABLEREMOTE});
            } else{
              table.avgStack = table2.avgStack;
              responseHandler.setTableViewKeys({table: table, channelId: params.channelId, playerId: params.playerId}, function(response){
              cb(response);
              });
            }
          });
        }
      });
    } else {
      cb(validated);
    }
  });
};

// ### Shuffle players for tournament, lock table here
tableRemote.prototype.shufflePlayers = function (params, cb) {
  keyValidator.validateKeySets("Request", "database", "shufflePlayers", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "shufflePlayers", data: params}, function (lockTableResponse){
        if(lockTableResponse.success ){
          cb(lockTableResponse.data);
        } else {
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

// Create event log (Dealer chat and hand history storage)
tableRemote.prototype.createLog = function (params, cb) {
  keyValidator.validateKeySets("Request", "database", "createLog", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "createLog", data: params.data}, function (lockTableResponse){
        if(lockTableResponse.success) {
          cb(lockTableResponse);
        } else {
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

// ### Get all the occupied seats
tableRemote.prototype.seatOccupied = function (params, cb) {
  var self            = this,
      successResponse = {};
  keyValidator.validateKeySets("Request", "database", "seatOccupied", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "seatOccupied", data: {}}, function (lockTableResponse){
        if(lockTableResponse.success) {
          successResponse = {success: true, indexOccupied: lockTableResponse.data.indexOccupied};
          keyValidator.validateKeySets("Response", "database", "seatOccupied", successResponse, function (validated){
            if(validated.success) {
              cb(successResponse);
            } else {
              cb(validated);
            }
          });
        } else {
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};


// ### Check if player is not already playing on table
tableRemote.prototype.isPlayerNotOnTable = function (params, cb) {
  var self            = this,
      successResponse = {};
  keyValidator.validateKeySets("Request", "database", "isPlayerNotOnTable", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "isPlayerNotOnTable", data: {playerId: params.playerId}}, function (lockTableResponse){
        if(lockTableResponse.success) {
          successResponse = {success: true, table: lockTableResponse.table};
          keyValidator.validateKeySets("Response", "database", "isPlayerNotOnTable", successResponse, function (validated){
            if(validated.success) {
              cb(successResponse);
            } else {
              cb(validated);
            }
          });
        } else {
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};


// ### Deduct blind amount from Blind players
tableRemote.prototype.deductBlinds = function (params, cb) {
  var self            = this;
  keyValidator.validateKeySets("Request", "database", "deductBlinds", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "deductBlinds", data: {playerId: params.playerId}}, function (lockTableResponse){
        if(lockTableResponse.success) {
          keyValidator.validateKeySets("Response", "database", "deductBlinds", lockTableResponse.data, function (validated){
            if(validated.success) {
              serverLog(stateOfX.serverLogType.info, 'lockTableResponse data');
              serverLog(stateOfX.serverLogType.info, lockTableResponse.data);
              cb(lockTableResponse.data);
            } else {
              cb(validated);
            }
          });
        } else {
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

// ### Set game start variables - dealer, blind etc.
// Check total active players count
  // Send start game broadcast data
// Do not start game send players with state
  // Set game state as IDLE
tableRemote.prototype.setGameConfig = function (params, cb) {
  var self            = this,
      successResponse = {};
  keyValidator.validateKeySets("Request", "database", "setGameConfig", params, function (validated){
    if(validated.success) {
      lockTable.lock({channelId: params.channelId, actionName: "setGameConfig", data: {}}, function (lockTableResponse){
        if(lockTableResponse.success) {
          successResponse = {success: true};
          keyValidator.validateKeySets("Response", "database", "setGameConfig", successResponse, function (validated){
            if(validated.success) {
              cb(successResponse);
            } else {
              cb(validated);
            }
          });
        } else {
          cb(lockTableResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

// leave tournament
// {channelId:params.channelId, playerId: params.playerId}
/**
 * this functions deals with leave tournament process
 * @method leaveTournament
 * @param  {object}        params request json object
 * @param  {Function}      cb     callback function
 */
tableRemote.prototype.leaveTournament = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'leaveTournament params');
  lockTable.lock({channelId: params.channelId, actionName: "leaveTournament", data: {channelId:params.channelId, playerId: params.playerId}}, function (lockTableResponse){
    serverLog(stateOfX.serverLogType.info, 'lockTableResponse are - ' + JSON.stringify(lockTableResponse));
    if(lockTableResponse.success) {
      cb(lockTableResponse);
    } else {
      cb(lockTableResponse);
    }
  });
};

// get player chips balance
tableRemote.prototype.getPlayerChipsWithFilter = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'getPlayerChipsWithFilter - ');
  lockTable.lock({channelId: params.channelId, actionName: "getPlayerChipsWithFilter", data: {channelId: params.channelId, playerId: params.playerId, key: params.key}}, function (lockTableResponse) {
    if (lockTableResponse.success) {
      cb(lockTableResponse);
    } else {
      cb(lockTableResponse);
    }
  });
};

// handle sitting player disconnections
tableRemote.prototype.handleDisconnection = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'handleDisconnection - ');
  lockTable.lock({channelId: params.channelId, actionName: "handleDisconnection", data: {channelId: params.channelId, playerId: params.playerId }}, function (lockTableResponse) {
    if (lockTableResponse.success) {
      cb(lockTableResponse);
    } else {
      cb(lockTableResponse);
    }
  });
};

// get chips total a player has on various tables
// filter: NORMAL channelType
// filter: holdem/omaha/hi-lo channelVariation --> NOT NOW
// filter: true isRealMoney
tableRemote.prototype.getTotalGameChips = function(params, cb) {
  var totalRealChips = 0;
  var totalPlayChips = 0;
  async.each(params.channels, function (channelId, ecb) {
    tableRemote.prototype.getPlayerChipsWithFilter({channelId: channelId, playerId: params.playerId, key: 'chips'}, function (result) {
      totalRealChips += result.success ? (result.data ?  (result.data.isRealMoney ? result.data.value : 0) : 0) : 0;
      totalPlayChips += result.success ? (result.data ?  (result.data.isRealMoney ? 0 : result.data.value) : 0) : 0;
      ecb(null);
    });
  }, function (err) {
    cb({success: true, realChips: totalRealChips, playChips: totalPlayChips});
  });
};

//handles tip to dealer
// pending feature
tableRemote.prototype.processTip = function(params, cb){
  lockTable.lock({channelId: params.channelId, actionName: "TIPDEALER", data: {channelId: params.channelId, playerId: params.playerId, chips: params.chips }}, function (lockTableResponse) {
    if (lockTableResponse.success) {
      cb(lockTableResponse);
    } else {
      cb(lockTableResponse);
    }
  });
};


// <<<<<<<<<<<<<<<<<<< RPC CALLS HANDLER FINISHED >>>>>>>>>>>>>>>>>>>>>>>>>

module.exports = function (app) {
  return new tableRemote(app);
};
