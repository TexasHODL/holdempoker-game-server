/*jshint node: true */
"use strict";

// This file is used to log user activity of different events into database

var _ = require("underscore"),
  async = require("async"),
  stateOfX = require("./stateOfX.js"),
  db = require("./model/dbQuery.js"),
  customLibrary = require("./customLibrary.js"),
  zmqPublish = require("./infoPublisher.js"),
  userActivity = {};

var logDB = require("./model/logDbQuery.js");

// Create data for log generation
function serverLog(type, log) {
  var logObject = {};
  logObject.fileName = "activity";
  logObject.serverName = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type = type;
  logObject.log = log;
  zmqPublish.sendLogMessage(logObject);
}

// ALL FUNCTIONS in this file
// saves log object in
// gameActivity or gameActivityReductant
// and/or userActivity
// collections in logDb
//
// event is as named in function

var insertInDb = function (activityObject, cb) {
  // console.log("activityObject - ",activityObject);
  // activityObject = customLibrary.convertToJson(activityObject);
  // logDB.createUserActivity(activityObject, function(err, activity) {
  // 	if(err) {
  // 		console.log("db error in creating activities");
  // 	}
  // 	if(!!activity) {
  // 	} else {
  // 		console.log("error in creating activities in db");
  // 	}
  // });
  cb();
};

// saves in given collection
// here used for "winAmount" collection
var logDBGeneral = function (colName, query, data) {
  logDB.genericQuery(colName, query, [data], function (err, res) {
    // console.log(err, res)
  });
};

var insertInDbGame = function (activityObject, cb) {
  // console.log("activityObject - ",activityObject);
  activityObject = customLibrary.convertToJson(activityObject);

  logDB.createUserActivityGame(activityObject, function (err, activity) {
    if (err) {
      console.log("db error in creating activities");
    }
    if (!!activity) {
    } else {
      console.log("error in creating activities in db");
    }
  });
  cb();
};

var init = function (category, subCategory, logType) {
  var activityObject = {};
  activityObject.category = category;
  activityObject.subCategory = subCategory;
  activityObject.logType = logType;
  activityObject.createdAt = Number(new Date());
  return activityObject;
};

userActivity.logUserActivity = function (
  params,
  category,
  subCategory,
  status
) {
  var activityObject = {};
  activityObject.playerId = params.playerId;
  activityObject.category = category;
  activityObject.subCategory = subCategory;
  activityObject.status = status;
  activityObject.comment = params.comment;
  activityObject.createdAt = Number(new Date());
  activityObject.channelId = params.channelId || "";
  if (!!params.rawInput) {
    activityObject.rawInput = params.rawInput;
  }
  if (!!params.rawResponse) {
    activityObject.rawResponse = params.rawResponse;
  }
  if (category === stateOfX.profile.category.profile) {
    activityObject[stateOfX.profile.category.profile] = params.data;
  } else if (category === stateOfX.profile.category.transaction) {
    //set transaction data
  } else if (category === stateOfX.profile.category.game) {
    //set game data
  } else if (category === stateOfX.profile.category.tournament) {
    //set tournament data
  }
  // activityObject = _.omit(activityObject,"self");
  // activityObject = _.omit(activityObject,"session");
  insertInDb(activityObject, function () {});
};

//*** LOBBY ACTIVITIES ***

userActivity.getLobbyTables = function (
  rawInput,
  category,
  subCategory,
  rawResponse,
  logType
) {
  var activityObject = init(category, subCategory, logType);
  activityObject.rawInput = rawInput;
  activityObject.playerId = rawInput.playerId;
  activityObject.channelId = rawInput.channelId || "";
  activityObject.channelType = !!rawInput.channelType
    ? rawInput.channelType
    : "NORMAL";
  activityObject.rawResponse = rawResponse;
  if (rawResponse.success) {
    activityObject.comment =
      "Player fetched lobby tables for " + activityObject.channelType;
    if (
      !!rawResponse.result[0] &&
      !!rawResponse.result[0].channelVariation &&
      !!rawResponse.result[0].channelName
    ) {
      activityObject.comment +=
        " : " +
        rawResponse.result[0].channelVariation +
        " : " +
        rawResponse.result[0].channelName;
    }
  } else {
    activityObject.rawResponse = rawResponse;
    activityObject.comment = rawResponse.info;
  }
  insertInDb(activityObject, function () {});
};
//for first table on page
userActivity.getTable = function (
  rawInput,
  category,
  subCategory,
  rawResponse,
  logType
) {
  var activityObject = init(category, subCategory, logType);
  if (!!rawInput) {
    activityObject.channelType = !!rawInput.channelType
      ? rawInput.channelType
      : "NORMAL";
    activityObject.rawInput = rawInput;
    activityObject.playerId = rawInput.playerId;
  }
  if (rawResponse.success) {
    activityObject.rawResponse = rawResponse;
    if (activityObject.channelType === stateOfX.tournamentType.normal) {
      activityObject.comment =
        "Details of table selected in cash games fetched.";
    } else {
      activityObject.comment =
        "Details of table selected in SitNGo or Tournament fetched";
    }
  } else {
    activityObject.rawResponse = rawResponse;
    activityObject.comment = rawResponse.info;
  }
  activityObject.channelId = rawInput.channelId || "";
  insertInDb(activityObject, function () {});
};

userActivity.updateProfile = function (
  rawInput,
  category,
  subCategory,
  rawResponse,
  logType
) {
  var activityObject = init(category, subCategory, logType);
  activityObject.rawInput = _.omit(rawInput, "session", "self");
  activityObject.rawResponse = rawResponse;
  activityObject.playerId = rawInput.playerId;
  activityObject.channelId = rawInput.channelId || "";
  if (rawResponse.success) {
    activityObject.comment = "Player updated profile successfully";
  } else {
    activityObject.comment = "Player profile update failed";
  }
  insertInDb(activityObject, function () {});
};

userActivity.lobbyRegisterTournament = function (
  rawInput,
  category,
  subCategory,
  rawResponse,
  logType
) {
  var activityObject = init(category, subCategory, logType);
  activityObject.rawInput = rawInput;
  activityObject.rawResponse = rawResponse;
  activityObject.playerId = rawInput.playerId;
  activityObject.channelId = rawInput.channelId || "";
  if (rawResponse.success) {
    activityObject.comment = rawResponse.info + " for tournament."; //+ rawInput.tournamentId;
  } else {
    activityObject.comment = "unable to register since " + rawResponse.info;
  }
  insertInDb(activityObject, function () {});
};

userActivity.lobbyDeRegisterTournament = function (
  rawInput,
  category,
  subCategory,
  rawResponse,
  logType
) {
  var activityObject = init(category, subCategory, logType);
  activityObject.rawInput = rawInput;
  activityObject.rawResponse = rawResponse;
  activityObject.playerId = rawInput.playerId;
  activityObject.channelId = rawInput.channelId || "";
  if (rawResponse.success) {
    activityObject.comment =
      "Player de-registered successfully for tournament."; //+ rawInput.tournamentId;
  } else {
    activityObject.comment = "unable to de-register since " + rawResponse.info;
  }
  insertInDb(activityObject, function () {});
};

//*** PLAYER ACTIVITIES ***

userActivity.leaveGame = function (params, category, subCategory, logType) {
  var activityObject = init(category, subCategory, logType);
  // console.log("leaveGame activity-------------\n"+ JSON.stringify(activityObject));
  activityObject.channelId = params.channelId || "";
  if (!!params.data.playerId) {
    activityObject.playerId = params.data.playerId;
  }
  if (params.table.channelType === stateOfX.gameType.normal) {
    if (logType === stateOfX.logType.success) {
      activityObject.roundId = params.table.roundId;
      activityObject.comment =
        params.data.playerName + " " + params.data.action + " the game ";
      if (!!params.table.roundName) {
        activityObject.comment += "in round " + params.table.roundName;
      }
      if (params.data.isCurrentPlayer) {
        activityObject.comment += ". Player left on his turn";
      } else {
        activityObject.comment += ". Player did not leave on his turn";
      }
    } else {
      activityObject.comment = "Player leave request failed";
    }
    if (!!params.table.players[params.table.currentMoveIndex]) {
      activityObject.comment +=
        ". Next turn - " +
        params.table.players[params.table.currentMoveIndex].playerName;
    }
  } else {
    activityObject.comment =
      "Player cannot leave because it is " + params.table.channelType;
  }
  if (
    !!params.table.channelType &&
    !!params.table.channelVariation &&
    !!params.table.channelName
  ) {
    activityObject.comment +=
      " in " +
      params.table.channelType +
      " : " +
      params.table.channelVariation +
      " : " +
      params.table.channelName;
  }
  if (category === stateOfX.profile.category.gamePlay) {
    insertInDbGame(activityObject, function () {});
  }
  // else{
  insertInDb(activityObject, function () {});
  // }
};

userActivity.playerSit = function (
  rawResponse,
  category,
  subCategory,
  logType
) {
  var activityObject = init(category, subCategory, logType);
  if (!!rawResponse) {
    activityObject.rawResponse = _.omit(
      rawResponse,
      "self",
      "session",
      "channel"
    );
    activityObject.channelId = rawResponse.response.channelId || "";
    if (!!rawResponse.player) {
      activityObject.playerId = rawResponse.player.playerId;
      if (rawResponse.response.success) {
        activityObject.comment =
          rawResponse.player.playerName +
          " sat on seat " +
          rawResponse.player.seatIndex +
          " with " +
          rawResponse.player.chips +
          " chips in " +
          rawResponse.player.state +
          " state ";
        if (
          !!rawResponse.table.channelType &&
          !!rawResponse.table.channelVariation &&
          !!rawResponse.table.channelName
        ) {
          activityObject.comment +=
            "in " +
            rawResponse.table.channelType +
            " : " +
            rawResponse.table.channelVariation +
            " : " +
            rawResponse.table.channelName;
        }
      } else {
        activityObject.comment = " Player could not sit -" + rawResponse.info;
      }
    }
  }
  if (category === stateOfX.profile.category.gamePlay) {
    insertInDbGame(activityObject, function () {});
  }
  // else{
  insertInDb(activityObject, function () {});
  // }
};

userActivity.makeMove = function (
  params,
  category,
  subCategory,
  rawResponse,
  logType
) {
  var activityObject = init(category, subCategory, logType);
  activityObject.channelId = params.channelId || "";
  if (!!rawResponse) {
    // activityObject.rawInput 		= rawInput;
    activityObject.rawResponse = rawResponse;
    if (!!params.data && rawResponse.success) {
      activityObject.playerId = params.data.playerId;
      activityObject.comment =
        params.data.playerName + " made a " + params.data.action;
      var preChips = params.data.amount + params.data.chips;
      if (params.data.amount > 0) {
        activityObject.comment += " with " + params.data.amount + " chips.";
      }
      activityObject.comment +=
        " Pre Chips = " + preChips + ". Post Chips = " + params.data.chips;
      activityObject.comment += " in round " + params.data.roundName;
      if (
        !!params.table.channelType &&
        !!params.table.channelVariation &&
        !!params.table.channelName
      ) {
        activityObject.comment +=
          " of " +
          params.table.channelType +
          " : " +
          params.table.channelVariation +
          " : " +
          params.table.channelName;
      }
      activityObject.comment +=
        ". Next turn - " +
        params.table.players[params.table.currentMoveIndex].playerName;
      if (!!params.data.roundId) {
        activityObject.roundId = params.data.roundId;
      }
    } else {
      activityObject.comment = "Player move request failed-" + rawResponse.info;
    }
  }
  if (category === stateOfX.profile.category.gamePlay) {
    insertInDbGame(activityObject, function () {});
  }
  // else{
  insertInDb(activityObject, function () {});
  // }
};

userActivity.info = function (params, category, subCategory, logType) {
  if (logType === stateOfX.logType.error) {
    var activityObject = init(category, subCategory, logType);
    activityObject.comment = "Could not fetch Details-" + params;
    activityObject.channelId = params.channelId || "";
  } else {
    if (!!params.table.players) {
      async.each(params.table.players, function (player, ecb) {
        var activityObject = init(category, subCategory, logType);
        activityObject.channelId = params.channelId || "";
        activityObject.comment = "";
        activityObject.playerId = player.playerId;
        if (player.seatIndex === params.table.smallBlindSeatIndex) {
          activityObject.comment +=
            player.playerName + " becomes small blind. ";
          activityObject.subCategory =
            stateOfX.game.subCategory.blindsAndStraddle;
        }
        if (player.seatIndex === params.table.bigBlindSeatIndex) {
          activityObject.comment += player.playerName + " becomes big blind. ";
          activityObject.subCategory =
            stateOfX.game.subCategory.blindsAndStraddle;
        }
        if (player.seatIndex === params.table.dealerSeatIndex) {
          activityObject.comment += player.playerName + " becomes dealer. ";
        }
        if (player.seatIndex === params.table.straddleIndex) {
          activityObject.comment += player.playerName + " becomes straddle. ";
          activityObject.subCategory =
            stateOfX.game.subCategory.blindsAndStraddle;
        }
        if (player.seatIndex === params.table.firstActiveIndex) {
          activityObject.comment += player.playerName + "gets first turn. ";
        }
        if (category === stateOfX.profile.category.gamePlay) {
          insertInDbGame(activityObject, function () {});
        }
        // else{
        insertInDb(activityObject, function () {});
        // }
        ecb();
      });
    }
  }
};

userActivity.deductBlinds = function (params, category, subCategory, logType) {
  if (logType === stateOfX.logType.error) {
    var activityObject = init(category, subCategory, logType);
    activityObject.comment = "Could not fetch Details-" + params;
    activityObject.channelId = params.channelId || "";
  } else {
    if (!!params.table.players) {
      async.each(params.table.players, function (player, ecb) {
        var activityObject = init(category, subCategory, logType);
        activityObject.channelId = params.channelId || "";
        activityObject.comment = "";
        activityObject.playerId = player.playerId;
        if (logType === stateOfX.logType.success) {
          if (player.seatIndex === params.table.smallBlindSeatIndex) {
            activityObject.comment +=
              "Amount deducted = " +
              params.table.roundBets[params.table.smallBlindIndex] +
              ".";
          }
          if (player.seatIndex === params.table.bigBlindSeatIndex) {
            activityObject.comment +=
              "Amount deducted = " +
              params.table.roundBets[params.table.bigBlindIndex] +
              ".";
          }
          if (player.seatIndex === params.table.straddleIndex) {
            activityObject.comment +=
              "Amount deducted = " +
              params.table.roundBets[params.table.straddleIndex] +
              ".";
          }
          if (
            !!params.data &&
            !!params.data.playerId &&
            player.playerId === params.data.playerId
          ) {
            activityObject.comment +=
              "Force blind deducted from " + player.playerName;
          }
          if (!!player.cards) {
            activityObject.comment += player.playerName + " has cards ";
            for (var i = 0; i < player.cards.length; i++) {
              activityObject.comment +=
                player.cards[i].name +
                "" +
                player.cards[i].type[0].toUpperCase() +
                " ";
            }
          }
        } else {
          activityObject.comment =
            "Could not fetch player information-" + rawResponse.info;
        }
        if (category === stateOfX.profile.category.gamePlay) {
          // insertInDbGame(activityObject,function(){ecb();});
          insertInDbGame(activityObject, function () {});
        }
        // else{
        // insertInDb(activityObject,function(){ecb();});
        insertInDb(activityObject, function () {});
        // }
        ecb();
      });
    }
  }
};

userActivity.playerState = function (player, category, subCategory, logType) {
  var activityObject = init(category, subCategory, logType);
  activityObject.channelId = player.channelId || "";
  console.log("params activity -------------------");
  console.log(JSON.stringify(player));
  if (!!player) {
    if (!!player.state && !!player.playerId) {
      activityObject.playerId = player.playerId;
      activityObject.comment =
        player.playerName + " is in " + player.state + " state.";
    }
    if (category === stateOfX.profile.category.gamePlay) {
      insertInDbGame(activityObject, function () {});
    }
    // else{
    insertInDb(activityObject, function () {});
    // }
  }
};

// this method is used for setting card player card on game over.
userActivity.playerCards = function (player, category, subCategory, logType) {
  var activityObject = init(category, subCategory, logType);
  // console.log("player is in activity is - "+ JSON.stringify(player));
  activityObject.channelId = player.channelId || "";
  if (!!player) {
    if (!!player.cards[0] && !!player.playerId) {
      activityObject.playerId = player.playerId;
      activityObject.comment =
        player.playerName +
        " has following cards " +
        player.cards[0].name +
        player.cards[0].type[0].toLowerCase() +
        " " +
        player.cards[1].name +
        player.cards[1].type[0].toLowerCase() +
        ".";
    }
    if (category === stateOfX.profile.category.gamePlay) {
      insertInDbGame(activityObject, function () {});
    }
    // else{
    insertInDb(activityObject, function () {});
    // }
  }
};

userActivity.winner = function (
  params,
  category,
  subCategory,
  rawResponse,
  logType
) {
  if (!!params) {
    async.each(params.table.players, function (player, ecb) {
      var activityObject = init(category, subCategory, logType);
      activityObject.rawResponse = rawResponse;
      activityObject.playerId = player.playerId;
      activityObject.channelId = player.channelId || "";
      if (rawResponse.success) {
        var winner = _.findWhere(params.data.winners, {
          playerId: player.playerId,
        });
        if (!!winner) {
          // activityObject.comment			= player.playerName + " won " + winner.amount + " chips by "+winner.type + " ("+winner.typeName + ")."
          activityObject.comment =
            player.playerName +
            " won " +
            winner.amount +
            " chips by " +
            winner.type +
            ".";
        } else {
          activityObject.comment = player.playerName + " lost the game.";
        }
      } else {
        activityObject.comment = "Failed to fetch winners";
      }
      if (category === stateOfX.profile.category.gamePlay) {
        insertInDbGame(activityObject, function () {});
        // insertInDb(activityObject,function(){});
      }
      // else{
      insertInDb(activityObject, function () {});
      // }
      ecb();
    });
  }
};

userActivity.startGame = function (
  params,
  category,
  subCategory,
  rawResponse,
  logType
) {
  var activityObject = init(category, subCategory, logType);

  if (logType === stateOfX.logType.success) {
    activityObject.comment = "Game starts ";
  } else {
    activityObject.comment = "Game did not start " + rawResponse.info;
  }
  if (
    !!params.channel.channelType &&
    !!params.channel.channelName &&
    !!params.channel.channelVariation
  ) {
    activityObject.comment +=
      "in " +
      params.channel.channelType +
      " : " +
      params.channel.channelName +
      " : " +
      params.channel.channelVariation;
  }
  activityObject.rawResponse = _.omit(
    rawResponse,
    "app",
    "session",
    "self",
    "channel"
  );
  insertInDb(activityObject, function () {});
};

//***GAME LOG***
userActivity.startGameInfo = function (params, category, subCategory, logType) {
  var activityObject = init(category, subCategory, logType);
  activityObject.channelId = params.channelId || "";
  activityObject.comment =
    "Game starts at " + new Date().toString().substring(0, 25);
  if (
    !!params.table &&
    !!params.table.channelType &&
    !!params.table.channelName &&
    !!params.table.channelVariation
  ) {
    activityObject.comment +=
      "in " +
      params.table.channelType +
      " : " +
      params.table.channelName +
      " : " +
      params.table.channelVariation;
  }
  // activityObject.rawResponse = params;
  if (params) {
    activityObject.rawResponse = _.omit(
      params,
      "app",
      "session",
      "self",
      "channel"
    );
  }
  insertInDbGame(activityObject, function () {});
  // insertInDb(activityObject,function(){});// for user game play activity
};

userActivity.gameOver = function (
  params,
  category,
  subCategory,
  rawResponse,
  logType
) {
  var activityObject = init(category, subCategory, logType);
  activityObject.rawResponse = rawResponse;
  activityObject.channelId = params.channelId || "";
  activityObject.roundId =
    params.roundId || params.table ? params.table.roundId : "";
  if (logType === stateOfX.logType.success) {
    activityObject.comment = "Game over. ";
    if (
      !!rawResponse.params.table.channelType &&
      !!rawResponse.params.table.channelName &&
      !!rawResponse.params.table.channelVariation
    ) {
      activityObject.comment +=
        "in " +
        rawResponse.params.table.channelType +
        " : " +
        rawResponse.params.table.channelName +
        " : " +
        rawResponse.params.table.channelVariation;
    }
    _.each(params.data.contributors, function (contributor) {
      var player = _.findWhere(params.table.players, {
        playerId: contributor.playerId,
      });
      if (!!player) {
        activityObject.comment +=
          player.playerName + " contributed " + contributor.amount + ". ";
      }
    });
    async.each(params.table.pot, function (pot, ecb) {
      activityObject.comment += "Pot ";
      activityObject.comment +=
        pot.potIndex + 1 + ". Amount " + pot.amount + " contributed by ";
      _.each(
        params.table.pot[pot.potIndex].contributors,
        function (contributor) {
          var player = _.findWhere(params.table.players, {
            playerId: contributor,
          });
          if (!!player) {
            activityObject.comment += player.playerName + ", ";
          }
        }
      );
      activityObject.comment += ". ";
    });
  } else {
    activityObject.comment = "Game over failed " + rawResponse.info;
  }
  activityObject.rawResponse = rawResponse;
  insertInDbGame(activityObject, function () {});
};

userActivity.potWinner = function (params, category, subCategory, logType) {
  var activityObject = init(category, subCategory, logType);
  activityObject.channelId = params.channelId || "";
  activityObject.comment = "Pot winners: ";
  async.each(params.winners, function (winner, ecb) {
    var player = _.where(params.table.players, { playerId: winner.playerId });
    activityObject.comment +=
      " Pot " +
      (winner.potIndex + 1) +
      " of amount " +
      winner.amount +
      " won by " +
      player[0].playerName;
    ecb();
  });
  insertInDbGame(activityObject, function () {});
};

userActivity.rakeDeducted = function (params, category, subCategory, logType) {
  var activityObject = init(category, subCategory, logType);
  if (logType === stateOfX.logType.success) {
    activityObject.channelId = params.data.channelId || "";
    var player = _.where(params.table.players, {
      playerId: Object.keys(params.rakeDetails.playerWins)[0],
    });
    var contribute = _.where(params.table.contributors, {
      playerId: player[0].playerId,
    });
    activityObject.playerId = player[0].playerId;
    activityObject.rawInput = params;
    // activityObject.comment = "Rake deducted from table "+ params.table.channelName + "(" + params.table.channelVariation + ") is " + params.totalRake;
    // if(Object.keys(params.rakeDetails.playerWins)[0].toString() === params.data.playerId.toString()){
    activityObject.comment =
      player[0].playerName +
      ": contribute " +
      contribute[0].amount +
      ", for total pot: " +
      params.rakeDetails.totalPotAmount +
      ", table rake : " +
      params.rakeFromTable +
      ", get: " +
      params.rakeDetails.playerWins[player[0].playerId] +
      ", totalRake " +
      params.rakeDetails.totalRake;
    // }else{
    // activityObject.comment = params.data.player.playerName +": contribute "+ contribute[0].amount + " for total pot: " + params.rakeDetails.totalPotAmount + "table rake : " + params.rakeFromTable +", "+ params.rakeDetails[params.data.playerId];
    // }
  } else {
    activityObject.comment = "Rake was not deducted - " + params.info; //params contains error if logtype is error
  }
  insertInDbGame(activityObject, function () {});
  insertInDb(activityObject, function () {}); // for inserting in user activity
};

userActivity.gameEndInfo = function (params, category, subCategory, logType) {
  var activityObject = init(category, subCategory, logType);
  activityObject.channelId = params.channelId || "";
  activityObject.comment =
    "Game ends at " + new Date().toString().substring(0, 25);
  if (
    !!params.table &&
    !!params.table.channelType &&
    !!params.table.channelName &&
    !!params.table.channelVariation
  ) {
    activityObject.comment +=
      "in " +
      params.table.channelType +
      " : " +
      params.table.channelName +
      " : " +
      params.table.channelVariation;
  }
  insertInDbGame(activityObject, function () {});
};

// this function is used for saving player chat in user activity
userActivity.chat = function (params, category, subCategory, logType) {
  var activityObject = init(category, subCategory, logType);
  if (!!params) {
    activityObject.playerId = params.playerId || "";
    activityObject.channelId = params.channelId || "";
    activityObject.comment = params.playerName + ": " + params.message;
  }
  insertInDb(activityObject, function () {});
  insertInDbGame(activityObject, function () {});
};

//for saving run it twice activity in game
userActivity.runItTwice = function (params, category, subCategory, logType) {
  var activityObject = init(category, subCategory, logType);
  var player = _.where(params.table.players, {
    playerId: params.data.playerId,
  });
  if (!!params) {
    activityObject.playerId = params.data.playerId || "";
    activityObject.channelId = params.data.channelId || "";
    activityObject.rawInput = params;
    if (params.data.value) {
      activityObject.comment =
        player[0].playerName +
        ": enabled run it twice in " +
        params.table.channelName;
    } else {
      activityObject.comment =
        player[0].playerName +
        ": disabled run it twice in " +
        params.table.channelName;
    }
  }
  insertInDb(activityObject, function () {});
  insertInDbGame(activityObject, function () {});
};

//for saving sitOUtNextHand
userActivity.sitoutNextHand = function (
  params,
  category,
  subCategory,
  logType
) {
  var activityObject = init(category, subCategory, logType);
  var player = _.where(params.table.players, {
    playerId: params.data.playerId,
  });
  if (!!params) {
    activityObject.playerId = params.data.playerId || "";
    activityObject.channelId = params.data.channelId || "";
    activityObject.rawInput = params;
    activityObject.comment =
      player[0].playerName +
      ": enabled sitoutNextHand in " +
      params.table.channelName;
  }
  insertInDb(activityObject, function () {});
  insertInDbGame(activityObject, function () {});
};

// for saving sitoutNextBigBlind
userActivity.sitoutNextBigBlind = function (
  params,
  category,
  subCategory,
  logType
) {
  var activityObject = init(category, subCategory, logType);
  var player = _.where(params.table.players, {
    playerId: params.data.playerId,
  });
  if (!!params) {
    activityObject.playerId = params.data.playerId || "";
    activityObject.channelId = params.data.channelId || "";
    activityObject.rawInput = params;
    activityObject.comment =
      player[0].playerName +
      ": enabled sitoutNextBigBlind in " +
      params.table.channelName;
  }
  insertInDb(activityObject, function () {});
  insertInDbGame(activityObject, function () {});
};

// for saving resetSitOut
userActivity.resetSitOut = function (params, category, subCategory, logType) {
  var activityObject = init(category, subCategory, logType);
  var player = _.where(params.table.players, {
    playerId: params.data.playerId,
  });
  if (!!params) {
    activityObject.playerId = params.data.playerId || "";
    activityObject.channelId = params.data.channelId || "";
    activityObject.rawInput = params;
    activityObject.comment =
      player[0].playerName + ": reset sit out in " + params.table.channelName;
  }
  // insertInDb(activityObject,function(){});
  insertInDbGame(activityObject, function () {});
};

// for saving resume
userActivity.resume = function (params, category, subCategory, logType) {
  var activityObject = init(category, subCategory, logType);
  var player = _.where(params.table.players, {
    playerId: params.data.playerId,
  });
  if (!!params) {
    activityObject.playerId = params.data.playerId || "";
    activityObject.channelId = params.data.channelId || "";
    activityObject.rawInput = params;
    activityObject.comment =
      player[0].playerName +
      ": resume in " +
      params.table.channelName +
      " from " +
      params.data.previousState +
      " state to " +
      params.data.state;
  }
  // insertInDb(activityObject,function(){});
  insertInDbGame(activityObject, function () {});
};

// for saving add chip in game
userActivity.addChipsOnTable = function (
  params,
  category,
  subCategory,
  logType,
  playerChipDetails
) {
  var activityObject = init(category, subCategory, logType);
  var player = _.where(params.table.players, {
    playerId: params.data.playerId,
  });
  if (!!params && !!playerChipDetails) {
    activityObject.playerId = params.data.playerId || "";
    activityObject.channelId = params.data.channelId || "";
    activityObject.rawInput = params;
    if (!playerChipDetails.isChipsToUpdate) {
      activityObject.comment =
        player[0].playerName +
        ": addded chip(s) " +
        playerChipDetails.newChips +
        " to " +
        playerChipDetails.chipsInHand +
        " in " +
        params.table.channelName +
        " has " +
        player[0].chips +
        " chips.";
    } else {
      activityObject.comment =
        player[0].playerName +
        ": added chip(s) " +
        playerChipDetails.newChipsToAdd +
        " for next game in " +
        params.table.channelName +
        " will have " +
        player[0].chipsToBeAdded +
        " more chips. and currently has " +
        playerChipDetails.chipsInHand +
        "chips in hand.";
    }
  }
  // insertInDb(activityObject,function(){});
  insertInDbGame(activityObject, function () {});
};

userActivity.updateTableSettings = function (
  params,
  category,
  subCategory,
  logType,
  playerName
) {
  var activityObject = init(category, subCategory, logType);
  if (!!params && params.key === "isMuckHand") {
    activityObject.playerId = params.playerId || "";
    activityObject.channelId = params.channelId || "";
    activityObject.rawInput = params;
    if (params.value) {
      activityObject.comment = playerName + " enabled muck hand.";
    } else {
      activityObject.comment = playerName + " disabled muck hand.";
    }
  }
  insertInDb(activityObject, function () {});
  insertInDbGame(activityObject, function () {});
};

// saves player winnings in logDb-> winAmount
userActivity.logWinnings = function (
  channelType,
  channelVariation,
  channelId,
  timestamp,
  winners,
  contributors
) {
  for (var i = 0; i < winners.length; i++) {
    var winner = winners[i];
    var t = _.findWhere(contributors, { playerId: winner.playerId }) || {
      amount: 0,
    };
    var amount = winner.amount - t.amount;
    var logObject = {
      channelType: channelType,
      channelVariation: channelVariation,
      channelId: channelId,
      timestamp: timestamp,
      playerId: winner.playerId,
      amount: amount,
    };

    // commented on 7 Feb 2019 as not used collection
    // logDBGeneral('winAmount', 'insert', logObject); // colName, query, data
  }
};

module.exports = userActivity;
