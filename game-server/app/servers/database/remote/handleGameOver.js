/*jshint node: true */
"use strict";

/**
* Created by Amrendra on 05/07/2016.
**/
var async             = require("async"),
   _ld                = require("lodash"),
   _                  = require('underscore'),
   stateOfX           = require("../../../../shared/stateOfX"),
   keyValidator       = require("../../../../shared/keysDictionary"),
   imdb               = require("../../../../shared/model/inMemoryDbQuery.js"),
   mongodb            = require('../../../../shared/mongodbConnection'),
   db                 = require("../../../../shared/model/dbQuery.js"),
   logDB              = require("../../../../shared/model/logDbQuery.js"),
   zmqPublish         = require("../../../../shared/infoPublisher"),
   profileMgmt        = require("../../../../shared/model/profileMgmt"),
   infoMessage        = require("../../../../shared/popupTextManager").falseMessages,
   dbInfoMessage      = require("../../../../shared/popupTextManager").dbQyeryInfo,
   activity           = require("../../../../shared/activity"),
   deductRake         = require('./utils/deductRake'),
   decideWinner       = require('./utils/decideWinner'),
   megaPointsManager  = require("./megaPointsManager"),
   userRemote         = require("./userRemote"),
   summary            = require("./utils/summaryGenerator"),
   setMove            = require('./setMove'),
   adjustIndex        = require('./adjustActiveIndex'),
   calculateRanks     = require('./calculateRanks.js'),
   manageBounty       = require('./manageBounty.js'),
   blindUpdate        = require('./blindUpdate'),
   timeBankRemote     = require('./timeBankRemote'),
   autoAddonRemote    = require('./autoAddonRemote'),
   potsplit           = require('./potsplit'),
   tableManager       = require("./tableManager"),
   winnerRemote       = require("./winnerRemote"),
   tableConfigManager = require("./tableConfigManager"),
   rewardRake         = require("./rewardRake"),
   autoRebuyRemote    = require('./autoRebuyRemote');


// var handleGameOver = {};
function handleGameOver() {}

// Create data for log generation
function serverLog (type, log) {
  var logObject          = {};
  logObject.fileName     = 'handleGameOver';
  logObject.serverName   = stateOfX.serverType.database;
  // logObject.functionName = arguments.callee.caller.name.toString();
  logObject.type         = type;
  logObject.log          = log;
  // zmqPublish.sendLogMessage(logObject);
  console.log(JSON.stringify(logObject));
}

function fixedDecimal(number, precisionValue) {
  let precision = precisionValue ? precisionValue : 2;
  return Number(Number(number).toFixed(precision));
}

// ### Validate if Game State remains same throughout calculation of Game Over
var isGameProgress = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Game state while handling game over - ' + params.table.state);
  if(params.table.state === stateOfX.gameState.gameOver) {
    cb({success: true, isSingleWinner: params.data.isSingleWinner, winners: params.data.winners, endingType: params.data.endingType, params: params});
  } else {
    cb({success: false, channelId: (params.channelId || "") , info: infoMessage.ISGAMEPROGRESS_HANDLEGAMEOVER, isRetry : false, isDisplay : true});
  }
};

// ### Add additional params in existing one for calculation
var initializeParams = function(params, cb) {
 isGameProgress(params, function(isGameProgressResponse){
   if(isGameProgressResponse.success) {

     params.data                     = _.omit(params.data, '__route__');
     params.data.isBlindUpdated      = false;
     params.data.decisionParams      = [];
     params.data.cardSets            = null;
     params.data.winners             = [];
     params.data.isSingleWinner      = false;
     params.data.endingType          = stateOfX.endingType.gameComplete;
     params.data.rakeDeducted        = 0;
     params.data.remainingBoardCards = [[], []];
     params.data.pot                 = [];
     params.data.cardsToShow         = {};
     params.data.rewardDistributed   = false;
     params.data.rakeShouldDeduct    = false;

     cb(null, params);
   } else {
     cb(isGameProgressResponse);
   }
 });
};

// get single winner that means - 
// no one else is available to compete
// either all other players have folded or left
var isSingleWinner = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in handleGameOver function isSingleWinner');
  serverLog(stateOfX.serverLogType.info, 'params.table: ' + JSON.stringify(params.table));
  serverLog(stateOfX.serverLogType.info, 'params.data: ' + JSON.stringify(params.data));
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success) {
      winnerRemote.getSingleWinner(params, function(err, getSingleWinnerResponse){
        serverLog(stateOfX.serverLogType.info, 'getSingleWinnerResponse' + JSON.stringify(getSingleWinnerResponse));
        cb(err, getSingleWinnerResponse);
      });
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// assign pot index to each pot
var assignPotIndexAndBoard = function(params, cb) {
 serverLog(stateOfX.serverLogType.info, 'in handleGameOver function assignPotIndexAndBoard');
 isGameProgress(params, function(isGameProgressResponse){
   if(isGameProgressResponse.success) {
    console.error(stateOfX.serverLogType.info, 'Normal pot division - Pot index for this pot - ',JSON.stringify(params.table.pot));
     async.eachSeries(params.table.pot, function (pot, escb) {
       serverLog(stateOfX.serverLogType.info, 'Normal pot division - Current pot to be divided - ' + JSON.stringify(pot));
       var potIndex      = _ld.indexOf(params.table.pot, pot);
       console.error(stateOfX.serverLogType.info, 'Normal pot division - Pot index for this pot - ' + potIndex);
      //  pot.amount    = Math.round(pot.amount);
       pot.amount    = fixedDecimal(pot.amount, 2);
       pot.potIndex  = potIndex;
       pot.borardSet = 0;
       escb();
     }, function(err) {
       if(err) {
         cb({success: false, channelId: (params.channelId || ""), info: infoMessage.ASSIGNPOTINDEXANDBOARD_HANDLEGAMEOVER, isRetry : false, isDisplay : true});
       } else {
        //console.error("@!@!@!@!@@!^&^&^&^&^&^11111111111111111111111111",JSON.stringify(params));
        serverLog(stateOfX.serverLogType.info, 'Pot after assigning index and boardset: ' + JSON.stringify(params.table.pot));
         cb(null, params);
       }
     });
   } else {
     cb(isGameProgressResponse);
   }
 });
};

// ### Unique contributor for pots
var refinePotContributors = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in handleGameOvers function refinePotContributors');
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success) {
      async.eachSeries(params.table.pot, function (pot, ecb) {
        serverLog(stateOfX.serverLogType.info, 'Processing pot while refining contributors: ' + JSON.stringify(pot));
        pot.contributors = _.unique(pot.contributors);
        serverLog(stateOfX.serverLogType.info, 'After refining pot contributors: ' + JSON.stringify(pot));
      }, function(err){
        if(err) {
          cb({success: false, channelId: (params.channelId || ""), info: infoMessage.REFINEPOTCONTRIBUTORS_HANDLEGAMEOVER, isRetry : false, isDisplay : true});
        } else {
          cb(null, params);
        }
      });
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// create pots in params.data for further calculations and decisionParams
var assignBoardAndAmount = function(params, pot, amount, potIndex, boardSet, isRefund,internalPotSplitIndex) {
  params.data.pot.push({
    // amount                : parseInt(amount),
    amount                : fixedDecimal(amount, 2),
    contributors          : pot.contributors,
    potIndex              : potIndex,
    borardSet             : boardSet,
    isRefund              : isRefund,
    internalPotSplitIndex : internalPotSplitIndex
  });
};

// divide pot and if run it twice, assign board cards
var dividePotAndAssignBoardSet = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in handleGameOvers function dividePotAndAssignBoardSet');
  var potIndex = -1, tempPotAmount = -1;
  //console.error("@!@!@!@!@@!^&^&^&^&^&^11111111111111111111111112222222222222222222222222",JSON.stringify(params));
//  console.error("!!!!!!!@@@@@@@###########",JSON.stringify(params.table.pot));
  async.eachSeries(params.table.pot, function(pot, ecb){
    serverLog(stateOfX.serverLogType.info, 'Processing pot for RIT and board: ' + JSON.stringify(pot));
    if(pot.contributors.length === 1) {
      var internalPotSplitIndex = pot.potIndex.toString();
      serverLog(stateOfX.serverLogType.info, 'There is only one contributor for this pot, might be refund, do not check RIT and do not divide pot!');
      assignBoardAndAmount(params, pot, pot.amount, pot.potIndex, 0, true,internalPotSplitIndex);
      ecb();
    } else {
      tableManager.isRunItTwice(params, pot.contributors, function(isRITapplied){
        if (isRITapplied && !params.data.isSingleWinner) { // for single winner do not split pot for RIT
          serverLog(stateOfX.serverLogType.info, 'RIT applied for this pot, divide this pot into two set!');
          // tempPotAmount = Math.round(pot.amount/2);
          tempPotAmount = fixedDecimal(pot.amount/2, 2);
          serverLog(stateOfX.serverLogType.info, 'Total amount: ' + pot.amount + ', each pot amount: ' + tempPotAmount);
          var internalPotSplitIndexHigh = pot.potIndex.toString() + "0";
          var internalPotSplitIndexLow = pot.potIndex.toString() + "1";
         // console.error(" @@@@@@@@@@@@@@((((((((((((((((((((((((((( ",internalPotSplitIndex);
         // console.error(" @@@@@@@@@@@@@@)))))))))))))))))))))))))))))) ",internalPotSplitIndex);
          assignBoardAndAmount(params, pot, tempPotAmount, pot.potIndex, 0, false,internalPotSplitIndexHigh);
          assignBoardAndAmount(params, pot, tempPotAmount, pot.potIndex, 1, false,internalPotSplitIndexLow);
          params.data.rakeShouldDeduct = true;
        } else {
          serverLog(stateOfX.serverLogType.info, 'RIT not applied for this pot, do not divide, assign board at 0th index!');
          var internalPotSplitIndex = pot.potIndex.toString();
          var potter = JSON.stringify(pot);
          var potters =  JSON.parse(potter);
          assignBoardAndAmount(params, potters, potters.amount, potters.potIndex, 0, false,internalPotSplitIndex);
        }
        ecb();
      });
    }
  }, function(err){
    if(!err) {
       //console.error("@!@!@!@!@@!^&^&^&^&^&^2222222222222222222222222",JSON.stringify(params));
      serverLog(stateOfX.serverLogType.info,'Pots for this table: ' + JSON.stringify(params.table.pot));
      serverLog(stateOfX.serverLogType.info,'Pots created for generating decision params: ' + JSON.stringify(params.data.pot));
      cb(null, params);
    } else {

      cb(null, params);
    }
  });
};

// ### Validate pot amount
// > in case of all other players folded in PRECHECK round
// > Insert amount in pot from player bet
var validatePotAmount = function (params, cb) {
 serverLog(stateOfX.serverLogType.info, 'In handleGameOver function validatePotAmount');
 serverLog(stateOfX.serverLogType.info, 'Validating pot on Game over !');
 potsplit.processSplit(params, function (processSplitResponse) {
   serverLog(stateOfX.serverLogType.info, 'Game over - processSplitResponse - ' + _.keys(processSplitResponse.params));
   if(processSplitResponse.success) {
     params = processSplitResponse.params;
     serverLog(stateOfX.serverLogType.info, 'Pre pot: ' + JSON.stringify(params.table.pot));
     serverLog(stateOfX.serverLogType.info, 'DATA for handling pot: ' + JSON.stringify(params.data));
     if(!!params.data.sidePots && params.data.sidePots.length > 0) {

       // Add if similar pot with same contributor exists
       for (var i = 0; i < params.data.sidePots.length; i++) {
         for (var j = 0; j < params.table.pot.length; j++) {
           if(params.table.pot[j].contributors.length === params.data.sidePots[i].contributors.length) {
             serverLog(stateOfX.serverLogType.info, '---------- Similar pot found -------------');
             serverLog(stateOfX.serverLogType.info, 'Previous pot amount - ' + params.table.pot[j].amount);
             serverLog(stateOfX.serverLogType.info, 'Adding in existing pot - ' + JSON.stringify(params.data.sidePots[i]));
             params.table.pot[j].amount = params.table.pot[j].amount + params.data.sidePots[i].amount;
             serverLog(stateOfX.serverLogType.info, 'After pot amount - ' + params.table.pot[j].amount);
             params.data.sidePots[i].processed = true;
           }
         }
       }

       // Insert newly created pot due to pot split
       for (var k = 0; k < params.data.sidePots.length; k++) {
         if(params.data.sidePots[k].processed === false) {
           serverLog(stateOfX.serverLogType.info, 'Inserting new pot - ' + JSON.stringify(params.data.sidePots[k]));
           params.table.pot.push(params.data.sidePots[k]);
         }
       }
     }

     serverLog(stateOfX.serverLogType.info, 'Post pot - ' + JSON.stringify(params.table.pot));
     cb(null, params);
   } else {
     cb(processSplitResponse);
   }
 });
};

// Set average pot value for this table
// statistical feature - shown on lobby for each row
// represents - average of pots made in all games played on this table
var updateAvgPot = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In handleGameOver function updateAvgPot');
  // Do not calculate average pot in case of tournament table
  if(params.table.channelType === stateOfX.gameType.tournament) {
    serverLog(stateOfX.serverLogType.info, 'Not updating avg pot as this is tournament table!');
    cb(null, params);
    return true;
  }

 db.findTableById(params.channelId, function(err, result){
   if(err){
     cb({success: false, channelId: params.channelId, info: "Something went wrong!! unable to update avgpot on Game Over !", isRetry: false, isDisplay: false});
   } else{
     serverLog(stateOfX.serverLogType.info, 'post avgStack - ' + result.avgStack);
     var totalStack = result.totalStack+tableManager.getTotalPot(params.table.pot);
     var totalGame = result.totalGame+1;
     var avgStack = parseInt(totalStack/totalGame);
     params.data.avgPot = avgStack;
     serverLog(stateOfX.serverLogType.info, 'totalStack - ' + totalStack);
     serverLog(stateOfX.serverLogType.info, 'totalGame - ' + totalGame);
     serverLog(stateOfX.serverLogType.info, 'post avgStack - ' + avgStack);
     db.updateStackTable(params.channelId, totalGame, totalStack, avgStack, function(err, result){
       if(err){
         cb({success: false, channelId: params.channelId, info: "Something went wrong!! unable to update avgpot on Game Over !", isRetry: false, isDisplay: false});
       } else{
        params.table.totalPotForRound = tableManager.getTotalPot(params.table.pot);
         cb(null, params);
       }
     });
   }
 });
};

// ### Reset table values on game over
var resetTableOnGameOver = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In handleGameOver function resetTableOnGameOver');
  isGameProgress(params, function(isGameProgressResponse){
   if(isGameProgressResponse.success) {
     // serverLog(stateOfX.serverLogType.info, 'Resetting table on Game Over - ' + JSON.stringify(params.table));

     params.table.state                = stateOfX.gameState.idle;
     params.table.stateInternal        = stateOfX.gameState.starting;
     params.table.roundCount           = params.table.roundCount+1;
     params.table.roundName            = null;
     params.table.roundBets            = [];
     params.table.roundMaxBet          = 0;
     params.table.maxBetAllowed        = 0;
     params.table.minRaiseAmount       = 0;
     params.table.maxRaiseAmount       = 0;
     params.table.lastBetOnTable       = 0;
     params.table.contributors         = [];
     params.table.roundContributors    = [];
     params.table.boardCard            = [[], []];
     params.table.preChecks            = [];
     params.table.isAllInOcccured      = false;
     params.table.isOperationOn        = false;
     params.table.isBettingRoundLocked = false;
     params.table.isRunItTwiceApplied  = false;
     params.table.actionName           = "";
     params.table._v                   = 1;
     cb(null, params);
   } else {
     cb(isGameProgressResponse);
   }
 });
};

// tournament
var getPlayingPlayers = function(tournamentId, gameVersionCount, channelId, cb) {
 serverLog(stateOfX.serverLogType.info, "tournamentId is in getPlayingPlayers is - ",tournamentId,channelId);
 imdb.findChannels({tournamentId: tournamentId}, function(err, channels) {
   serverLog(stateOfX.serverLogType.info, "channels is getting players in handleGameOver is - " + JSON.stringify(channels));
   if(err) {
     cb({success: false, channelId: (params.channelId || ""), info: infoMessage.GETPLAYINGPLAYERS_HANDLEGAMEOVER, isRetry : false, isDisplay : true});
   } else {
     var playingPlayers = 0;
     for(var i=0; i<channels.length; i++) {
       if(channels[i].channelId.toString() != channelId.toString()) {
         for(var j=0; j<channels[i].players.length; j++) {
          serverLog(stateOfX.serverLogType.info, 'player state is - '  + channels[i].players[j].state);
           if(channels[i].players[j].state === stateOfX.playerState.playing || channels[i].players[j].state === stateOfX.playerState.waiting) {
             playingPlayers++;
           }
         }
       }
     }
     serverLog(stateOfX.serverLogType.info, "playingPlayers is in getPlayingPlayers on handleGameOver is " + JSON.stringify(playingPlayers));
     cb({success: true, playingPlayers: playingPlayers});
   }
 });
};

// tournament
var deleteUserActivity = function(playersWithNoChips, tournamentId) {
  serverLog(stateOfX.serverLogType.info, "in deleteUserActivity" + JSON.stringify(playersWithNoChips) + tournamentId);
  async.eachSeries(playersWithNoChips, function(player, cb) {
    imdb.removeActivity({playerId: player.playerId, tableId: tournamentId}, function(err, result) {
      if(!err) {
        serverLog(stateOfX.serverLogType.info, "successfully deleted user activity");
      } else {
        serverLog(stateOfX.serverLogType.info, "Error in deleting user activity");
      }
    });
  }, function(err) {
    serverLog(stateOfX.serverLogType.info, "all user activity deleted successfully");
  });
};

// ### Manage ranks if game is tournament
var manageRanks = function(params,cb) {
 if(params.table.channelType === stateOfX.gameType.tournament) {
   serverLog(stateOfX.serverLogType.info, "params.table is in manageRanks in gameOver " + JSON.stringify(params.table));
   var playersWithNoChips = _.where(params.table.players, {state: stateOfX.playerState.outOfMoney});
   var playerWithChips = _.difference(params.table.players,playersWithNoChips);
   deleteUserActivity(playersWithNoChips,params.table.tournamentRules.tournamentId);
   if(playersWithNoChips.length > 0 || playerWithChips.length === 1) {
     getPlayingPlayers(params.table.tournamentRules.tournamentId, params.table.gameVersionCount,params.table.channelId, function(playingPlayerResponse) {
       serverLog(stateOfX.serverLogType.info,"response of plaing player in manageRanks are - " + JSON.stringify(playingPlayerResponse));
       if(playingPlayerResponse.success) {
         playingPlayerResponse.playingPlayers = playingPlayerResponse.playingPlayers + playerWithChips.length;
         serverLog(stateOfX.serverLogType.info,"playingPlayerResponse.playingPlayers - " + playingPlayerResponse.playingPlayers);
         if(playingPlayerResponse.playingPlayers === 1){
           params.table.tournamentRules .isGameRunning= false;
           params.table.tournamentRules.winner = playerWithChips;
           serverLog(stateOfX.serverLogType.info,"player with no chips are in manageRanks are " + JSON.stringify(playersWithNoChips));
         }
         //Ranks for normal tournaments
         if(params.table.tournamentType === stateOfX.tournamentType.normal || params.table.tournamentType === stateOfX.tournamentType.satelite) {
           serverLog(stateOfX.serverLogType.info,"tournament is normal in manageRanks in handleGameOver ");
           calculateRanks.manageRanksForNormalTournament(params,playersWithNoChips, function(response) {
             serverLog(stateOfX.serverLogType.info,"response in manageRanks in handle game over is -  " + JSON.stringify(response));
             if(response.success) {
               cb(null, response.result);
             } else {
               cb(response);
             }
           });
         } else {
           serverLog(stateOfX.serverLogType.info,"tournament is sitNGo in manageRanks in handleGameOver ");
           calculateRanks.manageRanks(params,playersWithNoChips, function(response) {
             serverLog(stateOfX.serverLogType.info,"response in manageRanks in handle game over is -  " + JSON.stringify(response));
             if(response.success) {
               cb(null, response.result);
             } else {
               cb(response);
             }
           });
         }
       } else {
         cb(playingPlayerResponse);
       }
     });
   } else {
     cb(null, params);
   }
 } else {
   cb(null, params);
 }
};

// tournament
var distributeBounty = function(params,cb){
  //check whether bounty is enabled or not
 if(params.table.channelType === stateOfX.gameType.tournament && params.table.tournamentRules.isBountyEnabled) {
    serverLog(stateOfX.serverLogType.info, "params in distribute bounty is - " + JSON.stringify(params));
    manageBounty.process(params,function(bountyResponse) {
     serverLog(stateOfX.serverLogType.info, "bountyResponse is in manage bounty is - " + JSON.stringify(bountyResponse));
     if(bountyResponse.success) {
       params = bountyResponse.result;
       cb(null, params);
     } else {
       cb(bountyResponse);
     }
   });
 } else {
  serverLog(stateOfX.serverLogType.info, "This is not a tournament table so skipping bounty distribution!");
   cb(null, params);
 }
};

//### update blind rule in tournament
var updateBlindRule = function(params,cb) {
 if(params.table.channelType === stateOfX.gameType.tournament ) {
   blindUpdate.updateBlind(params, function(updateBlindResponse){
     serverLog(stateOfX.serverLogType.info, "response in updateBlindResponse " + JSON.stringify(updateBlindResponse));
     if(updateBlindResponse.success) {
      //params.table = updateBlindResponse.table;
       cb(null, params);
     } else {
      console.log("updated Blind Response in handleGameOver is ",JSON.stringify(updateBlindResponse));
       cb(updateBlindResponse);
     }
   });
 } else {
  serverLog(stateOfX.serverLogType.info, "This is not a tournament table so skipping blind rule update!");
   cb(null, params);
 }
};

//this function is used to update the timebank if blind level is equal to the timebank level 
var updateTimeBank = function(params,cb) {
 console.log("Inside update Time bank of handleGameOver", JSON.stringify(params));
 if(params.table.channelType === stateOfX.gameType.tournament && params.table.blindLevel === params.table.timeBankLevel){ 
   timeBankRemote.updateTimeBank(params, function(updateTimeBankResponse){  //update Time bank function from timeBankRemote file is called
     serverLog(stateOfX.serverLogType.info, "response in updateTimeBank " + JSON.stringify(updateTimeBankResponse));
     if(updateTimeBankResponse.success) {
        params = updateTimeBankResponse.params;    //send the updated timebank Response to params

       cb(null, params);
     } else {
      console.log("updated Blind Response in handleGameOver is ",JSON.stringify(updateTimeBankResponse));
       cb(updateTimeBankResponse);
     }
   });
 } else {
  serverLog(stateOfX.serverLogType.info, "This is not a tournament table so skipping updateTimeBank!");
   cb(null, params);
 }
};

// update hand tab - the row which shows history and video in game
var updateHandTab = function(params,cb){
  var totalPot = tableManager.getTotalCompetitionPot(params.table.pot);
  params.table.summaryOfAllPlayers["boardCard"] = params.table.boardCard;
  logDB.updateHandTab(params.channelId, params.table.roundId, {pot: totalPot, hands: params.table.boardCard,active: true},function(err,response){
    if(err){
      cb({success: false, channelId: params.channelId, info: "Error while updating handtab: " + JSON.stringify(err),isRetry: false, isDisplay: false});
    } else{
      cb(null, params);
    }
  });
};

/**
 *
 * 
 * @method autoRebuy
 * @param  {[type]}   params request json object
 * @param  {Function} cb     callback function
 * @return {[type]}          validated/params
 */
var autoRebuy = function(params,cb) {
 console.log("Inside autoRebuy of handleGameOver", JSON.stringify(params));
 if(params.table.channelType === stateOfX.gameType.tournament && params.table.isRebuyAllowed ){ 
   autoRebuyRemote.updateAutoRebuy(params, function(updateAutoRebuyResponse){  //update Time bank function from timeBankRemote file is called
     serverLog(stateOfX.serverLogType.info, "response in updateAutoRebuy " + JSON.stringify(updateAutoRebuyResponse));
     if(updateAutoRebuyResponse.success) {
        params = updateAutoRebuyResponse.params;    //send the updated autoRebuy Response to params

       cb(null, params);
     } else {
      console.log("updateAutoRebuyResponse in handleGameOver is ",JSON.stringify(updateAutoRebuyResponse));
       cb(updateAutoRebuyResponse);
     }
   });
 } else {
  serverLog(stateOfX.serverLogType.info, "This is not a tournament table so skipping updateAutoRebuyResponse!");
  cb(null, params);
 }
};


/**
 * this function deals with auto addon for each player according to blind level
 *
 * @method autoAddonProcess
 * @param  {[type]}   params request json object
 * @param  {Function} cb     callback function
 * @return {[type]}          validated/params
 */
var autoAddonProcess = function(params,cb) {
 console.log("Inside autoAddonProcess of handleGameOver", JSON.stringify(params));
 if(params.table.channelType === stateOfX.gameType.tournament && params.table.isAddonEnabled){ 
   autoAddonRemote.autoAddonProcess(params, function(autoAddonProcessResponse){  //autoAddonProcess function from autoAddonRemote file is called
     serverLog(stateOfX.serverLogType.info, "response in autoAddonProcessResponse " + JSON.stringify(autoAddonProcessResponse));
     if(autoAddonProcessResponse.success) {
        params = autoAddonProcessResponse.params;    //send the autoAddonProcessResponse  to params
        cb(null, params);
     } else {
      console.log("autoAddonProcessResponse in handleGameOver is ",JSON.stringify(autoAddonProcessResponse));
       cb(autoAddonProcessResponse);
     }
   });
 } else {
  serverLog(stateOfX.serverLogType.info, "This is not a tournament table so skipping autoAddonProcess!");
   cb(null, params);
 }
};

// update every player stats about win(real/play money)/lose
var updateEveryPlayerStats = function (params, cb) {
  var playerIds = getWinnerPlayerIds(params);
  if (params.table && params.table.isRealMoney) {
    var keyName = "statistics.handsWonRM";
  } else {
    var keyName = "statistics.handsWonPM";
  }
  userRemote.updateStats( {playerIds: playerIds, data: {[keyName]: 1}, bySystem: true}, function (res) {
    serverLog(stateOfX.serverLogType.info, 'done handsWon count--- userRemote.updateStats'+ JSON.stringify(res));
  });
  var playerIds = getLosserPlayerIds(params);
  userRemote.updateStats( {playerIds: playerIds, data: {"statistics.handsLost": 1}, bySystem: true}, function (res) {
    serverLog(stateOfX.serverLogType.info, 'done handsLost count --- userRemote.updateStats'+ JSON.stringify(res));
  });
  activity.logWinnings(params.table.channelType, params.table.channelVariation, params.table.channelId, Number(new Date()), params.data.winners, params.table.contributors);
  cb(null, params);
};

// return array of playerIds who won
function getWinnerPlayerIds(params) {
  return _.uniq(_.pluck(params.data.winners, 'playerId'));
}

// return array of playerIds who did not win
function getLosserPlayerIds(params) {
  return _.difference(params.table.onStartPlayers, _.uniq(_.pluck(params.data.winners, 'playerId')));
}

// update summary of each player on game over, 
// seat wise, pot wise, winner wise
var summaryOnGameOver = function(params,cb){
  params.table.gamePlayers = params.table.players.concat(params.table.removedPlayers || []);
  summary.updateSummaryOfEachPlayer(params, function(err, response){
    serverLog(stateOfX.serverLogType.info, '3. Summary generated in Game Over!');
    let resp = {
     success       : true,
     winners       : response.data.winners,
     rakeDetails   : response.rakeDetails,
     boardCard     : response.data.boardCard,
     endingType    : response.data.endingType,
     rakeDeducted  : response.data.rakeDeducted,
     cardsToShow   : response.data.cardsToShow,
     params        : response
    };
    activity.gameOver(response,stateOfX.profile.category.gamePlay,stateOfX.gamePlay.subCategory.gameOver,resp, stateOfX.logType.success);
    cb(err, response);
    return;
  });
};

// ### Set state of player as playing if state is not playing
var setStatePlaying = function(params, cb) {
 serverLog(stateOfX.serverLogType.info, "in setStatePlaying in handleGameOver");
 // serverLog(stateOfX.serverLogType.info, "in setStatePlaying in handleGameOver");
 if(params.table.channelType === stateOfX.gameType.tournament) {
   //var playersWithNoChips = _.where(params.table.players, {state: stateOfX.playerState.outOfMoney});
   for(var i=0; i<(params.table.players).length;i++) {
     if(params.table.players[i].state !== stateOfX.playerState.outOfMoney) {
       params.table.players[i].state = stateOfX.playerState.playing;
     }
   }
   cb(null, params);
   // serverLog(stateOfX.serverLogType.info, "player state in setStatePlaying ",JSON.stringify(params.table.players));
 } else {
   cb(null, params);
 }
};

// Change state for bankrupt players
var setBankruptPlayerState = function(player) {
  if(player.state === stateOfX.playerState.onBreak) {
    return true;
  }

  player.state = player.chips <= 0 ? stateOfX.playerState.outOfMoney : player.state;
  serverLog(stateOfX.serverLogType.info, player.playerName +  ' player state after checking chips - ' + player.state);

  player.state = player.chips > 0 && player.state === stateOfX.playerState.outOfMoney ? stateOfX.playerState.playing : player.state;
  serverLog(stateOfX.serverLogType.info, player.playerName +  ' player state after checking chips and OUTOFMONEY state - ' + player.state);
  return true;
};


// ### Add chips in players on-table amount
// > If player have opted auto rebuy option
var deductAutoBuyIn = function(params,cb){
 console.trace("in deductAutoBuyIn in handleGameOver");
 if(params.table.channelType === stateOfX.gameType.normal) {
   isGameProgress(params, function(isGameProgressResponse){
     if(isGameProgressResponse.success) {
       async.each(params.table.players,function(player,ecb){
         console.log(player.playerName + " has total chips " + player.chips + ". Is opted auto rebuy? " + player.isAutoReBuy + ", amount will be: " + player.onSitBuyIn);
         console.log(params.table.maxBuyIn + "maxbuyin"+ params.table.minBuyIn);
        //  console.log(player.chips <= 0 && player.isAutoReBuy && (parseInt(player.onSitBuyIn) >= params.table.minBuyIn && parseInt(player.onSitBuyIn) <= params.table.maxBuyIn));
         console.log(player.chips <= 0 && player.isAutoReBuy && (fixedDecimal(player.onSitBuyIn, 2) >= params.table.minBuyIn && fixedDecimal(player.onSitBuyIn, 2) <= params.table.maxBuyIn));
         if(player.chips <= 0 && player.isAutoReBuy && (fixedDecimal(player.onSitBuyIn, 2) >= params.table.minBuyIn && fixedDecimal(player.onSitBuyIn, 2) <= params.table.maxBuyIn)){
          console.log("player data-- "+ JSON.stringify(player));
          //  profileMgmt.deductChips({playerId:player.playerId,isRealMoney: params.table.isRealMoney, chips: parseInt(player.onSitBuyIn), channelId: params.channelId, subCategory : "Auto BuyIn", tableName : params.table.channelName}, function(deductChipsResponse){
           profileMgmt.deductChips({playerId:player.playerId,isRealMoney: params.table.isRealMoney, chips: fixedDecimal(player.onSitBuyIn, 2), channelId: params.channelId, subCategory : "Auto BuyIn", tableName : params.table.channelName}, function(deductChipsResponse){
             console.trace("deductChipsResponse response in deductAutoBuyIn - " + JSON.stringify(deductChipsResponse));
             if(deductChipsResponse.success){
              //  player.chips = parseInt(player.onSitBuyIn);
               player.chips = fixedDecimal(player.onSitBuyIn, 2);
               player.instantBonusAmount = player.instantBonusAmount + deductChipsResponse.instantBonusAmount;
               player.onGameStartBuyIn = player.chips;
               setBankruptPlayerState(player);
               ecb();
             } else{
               ecb();
             }
           });
         } else{
             ecb();
         }
       },function(err){
         if(err) {
           cb({success: false, channelId: (params.channelId || ""), info: infoMessage.ASYNCEACH_DEDUCTAUTOBYIN_HANDLEGAMEOVER, isRetry : false, isDisplay : true});
         } else {
           cb(null, params);
         }
       });
     } else{
       cb(isGameProgressResponse);
     }
   });
 } else{
   cb(null,params);
 }
};

// ### Set player state based on different conditions
var setPlayerState = function(params, player, cb) {
  // If player is diconnected then only increment disconnected Game missed player
  if(player.state === stateOfX.playerState.disconnected) {
    player.disconnectedMissed = player.disconnectedMissed + 1;
    serverLog(stateOfX.serverLogType.info, player.playerName +  ' player state is - ' + player.state + ', incremented disconnected game missed: ' + player.disconnectedMissed);
    cb(null, params);
    return;
  }

  // If player is reserved then skip changing player state
  if(player.state === stateOfX.playerState.reserved) {
    serverLog(stateOfX.serverLogType.info, player.playerName +  ' player state is - ' + player.state + ', not processing state change for this player.');
    cb(null, params);
    return;
  }

  // Change state for bankrupt players
  setBankruptPlayerState(player);

  // Set player state SITOUT for those players who have opted
  // > to sit out in next hand
  // > In tournament if only two player left and player state is OUTOFMONEY then do not reset it to ONBREAK otherwise Game will never end
  if(params.table.channelType === stateOfX.gameType.tournament) {
    // Do not change state ONBREAK if this is the last game of tournament
    if(player.state !== stateOfX.playerState.outOfMoney) {
      if(player.sitoutNextHand) {
        player.tournamentData.isTournamentSitout = true;
      }
    } else {
      serverLog(stateOfX.serverLogType.info, 'Tournament: Condition does not allow to reset player state from OUTOFMONEY to ONBREAK');
    }
  } else {
    player.state = (player.sitoutNextHand) ? stateOfX.playerState.onBreak : player.state;
  }
  serverLog(stateOfX.serverLogType.info, player.playerName +  ' player state after checking sitout next hand - ' + player.state);

  // Check if player has opted sitout next BB and player is going to become BB
  if(!player.sitoutNextBigBlind) {
    cb(null, params);
    return true;
  }

  // params.index = _ld.findIndex(params.table.players, player);
  // serverLog(stateOfX.serverLogType.info, 'About to decide sitout next BB for ' + player.playerName);
  // tableConfigManager.nextGameConfig(params, function(nextConfigResponse){
  //   console.log(nextConfigResponse, 'nextConfigResponse')
  //   if(nextConfigResponse.success && !!nextConfigResponse.params.tempConfigPlayers.bigBlindSeatIndex && nextConfigResponse.params.tempConfigPlayers.bigBlindSeatIndex >= 0) {
  //     if(player.seatIndex === nextConfigResponse.params.tempConfigPlayers.bigBlindSeatIndex) {
  //       serverLog(stateOfX.serverLogType.info, player.playerName + ' will become next BB, sitting out this player!');
  //       player.state = stateOfX.playerState.onBreak;
  //     }
  //   }
  //   cb()
  // });
  // if(_.where(params.table.players, {state: stateOfX.playerState.playing}).length > 2) {
  //   adjustIndex.getPrePlayingByIndex(params, function(getPrePlayingByIndexResponse){
  //     serverLog(stateOfX.serverLogType.info, 'Previous playing players index response - ' + JSON.stringify(getPrePlayingByIndexResponse));
  //     serverLog(stateOfX.serverLogType.info, 'Big blind player index - ' + JSON.stringify(params.data.tempBBIndex));
  //     if(getPrePlayingByIndexResponse.index === params.data.tempBBIndex) {
  //       serverLog(stateOfX.serverLogType.info, player.playerName + ' is going into sitout as opted for sitout next BB.');
  //       player.state = stateOfX.playerState.onBreak;
  //     }
  //     serverLog(stateOfX.serverLogType.info, player.playerName + ' player state after checking sitout next BB - ' + player.state);
  //     cb();
  //   });
  // } else {
  //   if(params.index === params.data.tempBBIndex) {
  //     serverLog(stateOfX.serverLogType.info, player.playerName + ' is going into sitout as opted for sitout next BB.');
  //     player.state = stateOfX.playerState.onBreak;
  //   }
  //   serverLog(stateOfX.serverLogType.info, player.playerName + ' player state after checking sitout next BB - ' + player.state);
  //   cb();
  // }
 // activity.playerState(player, stateOfX.profile.category.game, stateOfX.game.subCategory.info, stateOfX.logType.info);
 activity.playerState(player,stateOfX.profile.category.game,stateOfX.game.subCategory.playerState,stateOfX.logType.info);
};

// ### Reset players attributes on game over
// update player chips (if he opted some feature for that) + deduct from profile balance
var resetPlayersOnGameOver = function(params, cb) {
 serverLog(stateOfX.serverLogType.info, "in resetPlayersOnGameOver in handleGameOver");
 isGameProgress(params, function(isGameProgressResponse){
   if(isGameProgressResponse.success) {
    params.data.tempBBIndex = params.table.bigBlindIndex;

    if(_.where(params.table.players, {state: stateOfX.playerState.playing}).length > 2) {
      var playerAfter         = params.table.players.slice(params.table.bigBlindIndex);
      var playerBefore        = params.table.players.slice(0,params.table.bigBlindIndex);
      params.table.players    = playerAfter.concat(playerBefore);
      serverLog(stateOfX.serverLogType.info, "Players adjusted for deciding BB sitout: " + _.pluck(params.table.players, 'playerName'));
      serverLog(stateOfX.serverLogType.info, "Players state adjusted for deciding BB sitout: " + _.pluck(params.table.players, 'state'));
      params.data.tempBBIndex = 0;
    }

     async.eachSeries(params.table.players, function (player, ecb){
       // activity.playerCards(player,stateOfX.profile.category.game,stateOfX.game.subCategory.playerCards,stateOfX.logType.info);
       serverLog(stateOfX.serverLogType.info, 'Resetting Player on Game Over  - ' + JSON.stringify(_.omit(player, 'cards')));
       setPlayerState(params, player, function(setPlayerResponse){
         // Increment Game missed count for autositout players (Only in case of normal Games)
         player.sitoutGameMissed = player.autoSitout && params.table.channelType === stateOfX.gameType.normal ? player.sitoutGameMissed + 1 : player.sitoutGameMissed;
         serverLog(stateOfX.serverLogType.info, player.playerName +  ' player sitout game missed count set to - ' + player.sitoutGameMissed);

        //  player.chips = parseInt(player.chips) + (!!player.tournamentData && !!player.tournamentData.rebuyChips ? player.tournamentData.rebuyChips : 0);
         player.chips = fixedDecimal(player.chips, 2) + (!!player.tournamentData && !!player.tournamentData.rebuyChips ? player.tournamentData.rebuyChips : 0);

         // Add player chips if player added some chips for next game
         serverLog(stateOfX.serverLogType.info, 'Player chips to be added for next game: ' + player.chipsToBeAdded);
         serverLog(stateOfX.serverLogType.info, 'Total player chips will be for next game: ' + (player.chips + player.chipsToBeAdded));
         
         var chipsAddedActually = 0;
         var playerOldChips = player.chips;
        // Add chips on player table amount if only amount to be added exists
        if(fixedDecimal(player.chipsToBeAdded, 2) > 0) { // If player have some chips to add for next game
          if(player.chips + player.chipsToBeAdded >= params.table.maxBuyIn && player.chips < params.table.maxBuyIn) { // If player additional chips crossed maxbuyin then set player chips as maxbuyin
            chipsAddedActually = fixedDecimal((params.table.maxBuyIn - player.chips), 2);
            // player.chips = parseInt(params.table.maxBuyIn);
            player.chips = fixedDecimal(params.table.maxBuyIn, 2);
            // Update onsitbuyin for this player (adding here after addchips feature update)
            // Update only if chips are changing due to adding additional chips on player's ontable amount
            player.onSitBuyIn = fixedDecimal(player.chips, 2);
          } else if (player.chips + player.chipsToBeAdded <= params.table.maxBuyIn && player.chips + player.chipsToBeAdded >= params.table.minBuyIn) { // If player chips will become inside min-max buyin range then add all additional chips
            chipsAddedActually = fixedDecimal(player.chipsToBeAdded, 2);
            // player.chips = parseInt(player.chips) + parseInt(player.chipsToBeAdded);
            player.chips = fixedDecimal(player.chips, 2) + fixedDecimal(player.chipsToBeAdded, 2);
            // Update onsitbuyin for this player (adding here after addchips feature update)
            // Update only if chips are changing due to adding additional chips on player's ontable amount
            player.onSitBuyIn = fixedDecimal(player.chips, 2);
          } else { // If player total chips will become less than minbuyin then do not add any chips
            chipsAddedActually = 0;
            serverLog(stateOfX.serverLogType.info, 'Not adding chips for ' + player.playerName + ', as it will not match min-max buyin range of table.');
          }
        } else {
          serverLog(stateOfX.serverLogType.info, 'No additional chips is going to be added for ' + player.playerName + '.');
        }


        serverLog(stateOfX.serverLogType.info, player.playerName +  ' player new chips are -' + player.chips);
         // Reset player state if chips are greater than 0 and state if OUTOFMONEY
        //  if(parseInt(player.chips) > 0 && player.state === stateOfX.playerState.outOfMoney) {
         if(fixedDecimal(player.chips, 2) > 0 && player.state === stateOfX.playerState.outOfMoney) {
            player.state = stateOfX.playerState.waiting;
          }
          // THIS LINE ADDED TO CHANGE DISCONNECTED PLAYER STAE TO SITOUT STATE NEW CODE START
         if(player.state === stateOfX.playerState.disconnected){
            player.state = stateOfX.playerState.onBreak;
          }
          // NEW CODE END
        // player.onGameStartBuyIn = parseInt(player.chips); // Reset on game start buyin
        player.onGameStartBuyIn = fixedDecimal(player.chips, 2); // Reset on game start buyin
        player.isPlayed                  = false;
        player.active                    = true;
        player.lastMove                  = null;
        player.lastBet                   = 0;
        player.chipsToBeAdded            = 0;
        player.cards                     = [];
        player.moves                     = [];
        player.lastRoundPlayed           = "";
        player.preCheck                  = -1;
        player.bestHands                 = "";
        player.totalRoundBet             = 0;
        player.totalGameBet              = 0;
        player.preActiveIndex            = -1;
        player.nextActiveIndex           = -1;
        player.tournamentData.rebuyChips = 0;
        if (chipsAddedActually>0) {
          profileMgmt.deductChips({playerId:player.playerId, isRealMoney: params.table.isRealMoney, chips: fixedDecimal(chipsAddedActually, 2), channelId: params.channelId, subCategory : "Add Chips", tableName : params.table.channelName}, function(deductChipsResponse){
            serverLog(stateOfX.serverLogType.info, "deductChipsResponse response in resetPlayersOnGameOver - " + JSON.stringify(deductChipsResponse));
            if(deductChipsResponse.success){
              console.trace("on gameover chips deduct success--"+JSON.stringify(deductChipsResponse));
              player.instantBonusAmount = fixedDecimal((player.instantBonusAmount + deductChipsResponse.instantBonusAmount), 2);
              params.data.chipsBroadcast = params.data.chipsBroadcast || [];
              params.data.chipsBroadcast.push(player.playerId);
              ecb();
            } else{
              player.chips = fixedDecimal(playerOldChips, 2);
              player.onSitBuyIn = player.chips;
              player.onGameStartBuyIn = player.chips; // Reset on game start buyin
              if (fixedDecimal(player.chips, 2)<=0) {
                player.state = stateOfX.playerState.outOfMoney;
              }
              if(fixedDecimal(player.chips, 2) > 0 && player.state === stateOfX.playerState.outOfMoney) {
                player.state = stateOfX.playerState.waiting;
              }
              params.data.addChipsFailed = params.data.addChipsFailed || [];
              params.data.addChipsFailed.push(player.playerId);
              ecb(); // MAJOR
              // ecb(deductChipsResponse);
            }
          });
        } else {
          ecb();
        }
       });
     }, function(err){
       if(err) {
         cb({success: false, channelId: (params.channelId || ""), info: infoMessage.ASYNCEACH_RESETPLAYERSONGAMEOVER_HANDLEGAMEOVER, isRetry : false, isDisplay : true});
       } else {
          if(_.where(params.table.players, {state: stateOfX.playerState.playing}).length > 2 && playerAfter) {
            var newPlayerAfter  = params.table.players.slice(playerAfter.length);
            var newPlayerBefore = params.table.players.slice(0, playerAfter.length);
            params.table.players = newPlayerAfter.concat(newPlayerBefore);
          }
          cb(null, params);
       }
     });
   } else {
     cb(isGameProgressResponse);
   }
 });
};

/**
 * ALL new implementation of loyalty/loyality points is named as MegaPoints (its business name)<br>
 * TO AVOID CONFUSION
 * 
 * @method rewardMegaPoints
 * @param  {Object}         params [description]
 * @param  {Function}       cb     callback
 */
var rewardMegaPoints = function (params, cb) {
 serverLog(stateOfX.serverLogType.info, 'In handleGameOver function rewardMegaPoints'+JSON.stringify(params.table));
 // check for should rake duduct
 deductRake.shouldRakeDeduct(params, function (err, res) {
  if (err) {
    serverLog(stateOfX.serverLogType.info, 'Rake should not deduct - HENCE megaPoints should not be awarded');
    cb(null, params);
  } else {
    serverLog(stateOfX.serverLogType.info, 'Rake should deduct - HENCE megaPoints should be awarded');
    megaPointsManager.incMegaPoints({event:'gameOver', subEvent:'beforeDecideWinner', players: params.table.contributors}, function (err, result) {
      // rpc to broadcast about MP and MPlevel and chips
      if (result) {
        params.data.megaPointsResult = result;
      }
      cb(null, params);
    });
  }
 });
};

// update flop players percent - 
// a statistical feature shown on lobby for each table
// - represents how many players have played rounds later than FLOP (including flop) on this table
var updateFlopPlayers = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In handleGameOver function updateFlopPlayers');
  if (!params.data.isSingleWinner && params.table.roundName === stateOfX.round.preflop) {
    // update player per flop percent
    serverLog(stateOfX.serverLogType.info, 'This game is bypassing flop round so updating flop player percent');
    db.findTableById(params.channelId, function(err, result){
      if(err){
        cb({success: false, channelId: params.channelId, info: "Something went wrong!! unable to update", isRetry: false, isDisplay: false});
      } else{
        serverLog(stateOfX.serverLogType.info, 'Pre total players - ' + result.totalPlayer);
        serverLog(stateOfX.serverLogType.info, 'Pre flop players - ' + result.totalFlopPlayer);
        serverLog(stateOfX.serverLogType.info, 'Pre percent - ' + result.flopPercent);
        var totalFlopPlayer = result.totalFlopPlayer+_.where(params.table.players, {state: stateOfX.playerState.playing}).length;
        var totalPlayer     = result.totalPlayer+params.table.onStartPlayers.length;
        var flopPercent     = (totalFlopPlayer/totalPlayer)*100;
        params.data.flopPercent = flopPercent;

        serverLog(stateOfX.serverLogType.info, 'totalFlopPlayer - ' + totalFlopPlayer);
        serverLog(stateOfX.serverLogType.info, 'totalPlayer - ' + totalPlayer);
        serverLog(stateOfX.serverLogType.info, 'flopPercent - ' + flopPercent);

        // serverLog(stateOfX.serverLogType.info, 'roundOver, Current board card - ' + JSON.stringify(params.data.currentBoardCard));
        db.updateFlopPlayerTable(params.channelId, totalFlopPlayer, totalPlayer, flopPercent, function(err, result){
          if(err){
            cb({success: false, channelId: params.channelId, info: "Something went wrong!! unable to update", isRetry: false, isDisplay: false});
          } else{
            cb(null, params);
          }
        });
      }
    });
  } else {
    serverLog(stateOfX.serverLogType.info, 'This game is not over in preflop OR This game is jumping flop round so not updating flop player percent');
    cb(null, params);
  }
};


// ### Decide winner using algos for different variations
var decideTableWinner = function (params, cb) {
 serverLog(stateOfX.serverLogType.info, 'In handleGameOver function decideTableWinner');
 if(!params.data.isSingleWinner){
   decideWinner.processWinnerDecision(params, function(decideWinnerResponse) {
    console.log("decideWinnerResponse - "+ JSON.stringify(decideWinnerResponse));
     if(decideWinnerResponse.success) {
      //console.error("@!@!@!@!@@!^&^&^&^&^&^333333333333333333333333",JSON.stringify(decideWinnerResponse.params));
       cb(null, decideWinnerResponse.params);
     } else {
       cb(decideWinnerResponse);
     }
   });
 } else {
   cb(null, params);
 }
};

// Set decision params only if single winner case
var setDecisionParamsSingleWinner = function (params, cb) {
//  console.error(" ^^^^^^^^^&&&&&&&&&&&&&&&&&&&& " ,params.data);
  serverLog(stateOfX.serverLogType.info, 'In handleGameOver function setDecisionParamsSingleWinner');
  if(params.data.isSingleWinner) {
    serverLog(stateOfX.serverLogType.info, '--------- Pot while generating decision params for single winner case ------------');
    serverLog(stateOfX.serverLogType.info, JSON.stringify(params.data.pot));

    async.eachSeries(params.data.pot, function (pot, escb) {
      serverLog(stateOfX.serverLogType.info, 'Generating decision params for pot - ' + JSON.stringify(pot));
      params.data.winners[pot.potIndex].amount        += pot.amount;
      params.data.winners[pot.potIndex].winningAmount += pot.amount;
      params.data.winners[pot.potIndex].isRefund = pot.isRefund;
      params.data.decisionParams.push({
        boardCards      : params.table.boardCard[pot.borardSet],
        playerCards     : [],
        winners         : [{
          playerId      : params.data.winnerPlayerId,
          typeName      : stateOfX.dealerChatReason[stateOfX.endingType.everybodyPacked],
          amount        : params.data.winners[pot.potIndex].amount,
          potIndex      : pot.potIndex,
          winningAmount : params.data.winners[pot.potIndex].winningAmount,
          isRefund      : pot.isRefund
        }],
        contributors  : pot.contributors,
        amount        : pot.amount,
        isRefund      : pot.isRefund, // This Key is needed for further calculations, like: deductRake etc. // e.g. ALL IN & FOLD case
        winningAmount : 0,
        internalPotSplitIndex : pot.potIndex.toString()
      });
      escb();
    }, function (err) {
      if(err) {
        cb({success: false, channelId: (params.channelId || ""), info: infoMessage.ASYNCEACHSERIES_SETDECISIONPARAMSSINGLEWINNER_HANDLEGAMEOVER, isRetry : false, isDisplay : true});
      } else {
        serverLog(stateOfX.serverLogType.info, 'Generated decision params for single winner case - ' + JSON.stringify(params.data.decisionParams));
//        console.error(" ^^^^^^^^^&&&&&&&&&&&&&&&&&&&& " ,params.data);
        cb(null, params);
      }
    });
  } else {
    cb(null, params);
  }
};

// Decide rake in case of single winner on table (Due to fold or leave by all other players except one)
var deductRakeSingleWinnerCase = function(params, cb) {
 serverLog(stateOfX.serverLogType.info, 'In handleGameOver function deductRakeSingleWinnerCase');
 if(params.data.isSingleWinner) {
   serverLog(stateOfX.serverLogType.info, 'Deducting rake for single winner case.');
   deductRake.deductRakeOnTableSingleWinner(params, function(deductRakeOnTableResponse) {
     serverLog(stateOfX.serverLogType.info, 'handleGameOver deductRakeOnTableResponse - ' + JSON.stringify(deductRakeOnTableResponse));
     if(deductRakeOnTableResponse.success) {
        if(params.data.winners.length > 0 && Object.keys(params.rakeDetails.playerWins).length > 0) {
          //console.error("@@@@@@@@@@",JSON.stringify(deductRakeOnTableResponse));
          serverLog(stateOfX.serverLogType.info, 'Rake details for this case - ' + JSON.stringify(params.rakeDetails.playerWins));
          serverLog(stateOfX.serverLogType.info, 'Setting single player winning amount for client response.');
          params.data.winners[0].amount = params.rakeDetails.playerWins[params.data.winners[0].playerId];
          // ISSUE: When In RIT the winning amount in Hand History is not correct, it is Half of the total amount cause of RIT pots
          // Resolve: add the total winning amount for single winner of every pot
          // By Digvijay Rathore
          // params.data.winners[0].winningAmount = deductRakeOnTableResponse.params.winners[0].winningAmount;
          params.data.winners[0].winningAmount = _.reduce(deductRakeOnTableResponse.params.winners, function (memo, obj) { return memo + obj.winningAmount; }, 0);
        }
        cb(null, deductRakeOnTableResponse.params);
     } else {
       cb(deductRakeOnTableResponse);
     }
   });
 } else {
   serverLog(stateOfX.serverLogType.info, 'This is not a single winner case so skipping rake deduction from here.');
   cb(null, params);
 }
};

// distribute rake to refer-parents of players
// sub-affiliates, affiliates and/or admin
var awardRakeToAffiliates = function (params, cb) {
 serverLog(stateOfX.serverLogType.info, 'In handleGameOver function awardRakeToAffiliates');
 if(params.rakeDetails.rakeDeducted) {
   serverLog(stateOfX.serverLogType.info, 'About to reward rake to affiliates');
   rewardRake.processRakeDistribution(params, function(err, params){
     serverLog(stateOfX.serverLogType.info, 'response of processRakeDistribution' + JSON.stringify(params));
     if(err) {
       cb({success: false, channelId: (params.channelId || ""), info: infoMessage.PROCESSRAKEDISTRIBUTION_REWARDRAKE_AWARDRAKETOAFFILATES_HANDLEGAMEOVER, isRetry : false, isDisplay : true});
     } else {

         params.data.loyalityList = params.loyalityList;
       cb(null, params);
     }
   });
 } else {
   serverLog(stateOfX.serverLogType.info, 'Not rewarding rake to affiliate as no rake deducted in this Game');
   cb(null, params);
 }
};

// ### Add winning chips into player's chips on table
var awardWinningChips = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In handleGameOver function awardWinningChips');
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success) {
      winnerRemote.awardWinningChips(params, function(err, awardWinningChipsResponse){
        cb(err, awardWinningChipsResponse);
      });
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// ### Reward winning amount to players chips
var createWinningResponse = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In handleGameOver function createWinningResponse');
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success) {
      winnerRemote.createWinnersForResponse(params, function(err, winnerResponse){
        cb(err, winnerResponse);
      });
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// ### Adjust active player indexes among each other
// > Set preActiveIndex and nextActiveIndex values for each player
// > Used for turn transfer importantly
var adjustActiveIndexes = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In handleGameOver function adjustActiveIndexes');
 adjustIndex.perform(params, function(performResponse) {
   cb(null, performResponse.params);
 });
};

// ### Assign player cards based on conditions (muckhand feature)
// > Get player's muck hand details for this table from cache database
// > If this is a single winner case without card comparison then check muckhand for winner player
// > If there is a winner with card comparision then show cards of all players (except FOLDed ones)

var assignPlayercards = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In function assignPlayercards');
  serverLog(stateOfX.serverLogType.info, 'Winners for this game while setting player cards on game over - ' + JSON.stringify(params.data.winners));
  var isMuckHand     = false;
  // var playingPlayers = _.where(params.table.players, {state: stateOfX.playerState.playing});
  var playingPlayers = tableManager.activePlayersForWinner(params);
  var player         = null;
  if(params.data.isSingleWinner) {
    var playerIndexOnTable = _ld.findIndex(params.table.players, {playerId: params.data.winners[0].playerId});
    if(playerIndexOnTable >= 0) {
      player = params.table.players[playerIndexOnTable];
      imdb.findPlayerAsSpectator({playerId: player.playerId, channelId: params.channelId}, function(err, result){
        if(!err) {
          isMuckHand = !!result && !!result.settings ? result.settings.isMuckHand : false;
          player.isMuckHand = isMuckHand;
          // Show cards if players hasn't opted muckhand
          if(!isMuckHand) {
            serverLog(stateOfX.serverLogType.info, 'Muck hand is disable for this player, show cards!');
            params.data.cardsToShow[player.playerId] = player.cards;
          }
          serverLog(stateOfX.serverLogType.info, 'Updated cardsToShow values - ' + JSON.stringify(params.data.cardsToShow));
          cb(null, params);
        } else {
          cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: dbInfoMessage.DB_GETSPACTATOR_SETTING_FAIL});
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.info, 'Winner is not present on table, skipping show cards on game over!');
      cb(null, params);
    }
  }

  if(!params.data.isSingleWinner) {
    async.eachSeries(playingPlayers, function(player, ecb) {
      serverLog(stateOfX.serverLogType.info, 'Processing player while setting to show cards on Game over - ' + JSON.stringify(player));
      if(player.lastMove !== stateOfX.move.fold) {
        params.data.cardsToShow[player.playerId] = player.cards;
      } else {
        serverLog(stateOfX.serverLogType.info, 'Player ' + player.playerName + ' has last move ' + player.lastMove + ', skipping display cards !');
      }
      serverLog(stateOfX.serverLogType.info, 'Updated cardsToShow values - ' + JSON.stringify(params.data.cardsToShow));
      ecb();
    }, function(err){
      if(!err) {
        serverLog(stateOfX.serverLogType.info, 'Player cards assigned successully !');
        cb(null, params);
      } else {
        serverLog(stateOfX.serverLogType.error, 'Assigning player cards after game over failed - ' + JSON.stringify(err));
        cb(err);
      }
    });
  }
};

// ### Generate game over response

var createGameOverResponse = function(params, cb) {
 serverLog(stateOfX.serverLogType.info, "in createGameOverResponse in game over - " + JSON.stringify(params));
 params.data.success = true;
 cb(null, {
   success       : true,
   winners       : params.data.winners,
   rakeDetails   : params.rakeDetails,
   boardCard     : params.data.boardCard,
   endingType    : params.data.endingType,
   rakeDeducted  : params.data.rakeDeducted,
   cardsToShow   : params.data.cardsToShow,
   chipsBroadcast: params.data.chipsBroadcast,
   addChipsFailed: params.data.addChipsFailed,
   params        : params
 });
};


var rewardVipPoints = function(params, cb){
  console.log("\n-----------here---------\n");
  console.log("params---", params);
  console.log(JSON.stringify(params));
  if(params.rakeDetails.rakeDeducted && params.rakeDetails.totalRake){
    console.log("Rake deducted on table so process megaPoints");
    megaPointsManager.incMegaPoints({event:'gameOver', subEvent:'beforeDecideWinner', players: params.rakeToAffiliates.players}, function (err, result) {
      // rpc to broadcast about MP and MPlevel and chips
      if (result) {
        params.data.megaPointsResult = result;
        cb(null, params);
      }
    });
  }else{
    console.log("No rake deducted so do not process megaPoints");
    cb(null, params);
  }
  // return false;
};

/**
 * process game over after no player has moves,
 * check pots and pot split, update stats
 * find winners, reward pot distibutions
 * deduct rake
 * add to summary object
 * update hand tab and other tasks
 * @method processGameOver
 */
handleGameOver.processGameOver = function (params, cb) {

  console.trace('In handleGameOver function processGameOver '+params);
  console.log(stateOfX.serverLogType.info, "=========== GAME OVER CALCULATION STARTED ===========");
  keyValidator.validateKeySets("Request", "database", "processGameOver", params, function(validated){
    if(validated.success) {
      async.waterfall([

        async.apply(initializeParams, params),
        validatePotAmount,
        updateAvgPot,
        isSingleWinner,
        assignPotIndexAndBoard,
        dividePotAndAssignBoardSet,
        updateFlopPlayers,
        decideTableWinner,
        // rewardMegaPoints,
        assignPlayercards,
        setDecisionParamsSingleWinner,
        deductRakeSingleWinnerCase,
        
        awardRakeToAffiliates,
        awardWinningChips,
        rewardVipPoints,
        createWinningResponse,
        updateHandTab,
        updateEveryPlayerStats,
        summaryOnGameOver,
        autoRebuy,
        autoAddonProcess,
        resetPlayersOnGameOver,
        deductAutoBuyIn,
        resetTableOnGameOver,
        manageRanks,
        distributeBounty,
        updateBlindRule,
        updateTimeBank,
        setStatePlaying,
        adjustActiveIndexes,
        createGameOverResponse

      ], function(err, response){
        if(err) {
          activity.gameOver(params,stateOfX.profile.category.gamePlay,stateOfX.gamePlay.subCategory.gameOver,err,stateOfX.logType.error);
          cb(err);
        } else {
          activity.winner(params,stateOfX.profile.category.game,stateOfX.game.subCategory.info,response,stateOfX.logType.success);
          // activity.winner(params,stateOfX.profile.category.gamePlay,stateOfX.gamePlay.subCategory.info,response,stateOfX.logType.success);
          // activity.gameOver(params,stateOfX.profile.category.gamePlay,stateOfX.gamePlay.subCategory.gameOver,response,stateOfX.logType.success);
          // activity.gameEndInfo(params,stateOfX.profile.category.gamePlay,stateOfX.gamePlay.subCategory.gameOver,stateOfX.logType.success);
          activity.winner(params,stateOfX.profile.category.game,stateOfX.game.subCategory.winner,response,stateOfX.logType.success);
          cb(response);
        }
      });
    } else {
      activity.gameOver(params,stateOfX.profile.category.gamePlay,stateOfX.gamePlay.subCategory.gameOver,validated,stateOfX.logType.error);
      cb(validated);
    }
  });
};


module.exports = handleGameOver;
