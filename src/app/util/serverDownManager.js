/*
 * @Author: sushiljainam
 * @Date:   2017-12-02 17:12:45
 * @Last Modified by:   digvijay
 * @Last Modified time: 2018-12-28 17:01:29
 */

/*jshint node: true */
"use strict";

const configConstants = require("../../shared/configConstants");
var logger = console.error;
var adminDb = require("../../shared/model/adminDbQuery.js");
var imdb = require("../../shared/model/inMemoryDbQuery.js");
var confServerDown = configConstants.serverDown || {};

var pomelo = require("pomelo");

// generic function to drop mail
// to some people
// about maintenance
var dropMail = function (data) {
  data.mailCreatedBy = {
    serverId: pomelo.app.serverId,
    timestamp: Number(new Date()),
  };
  var mailTo = confServerDown.reportTos;
  pomelo.app
    .get("devMailer")
    .sendToAdminMulti(
      data,
      mailTo,
      data.subject ||
        "from " + configConstants.mailFromAppName + " - Server Down Code"
    );
};

// enable all services
// save in app and db
function enableAll(app, message) {
  var stateOfServer = app.get("serverStates") || {};

  stateOfServer.disableLogin = {};
  stateOfServer.disableLogin.status = false;
  stateOfServer.disableLogin.byScheduleId =
    message.meta && message.meta.scheduleId;
  stateOfServer.disableLogin.timestamp = new Date().getTime();

  stateOfServer.disableGameStart = {};
  stateOfServer.disableGameStart.status = false;
  stateOfServer.disableGameStart.byScheduleId =
    message.meta && message.meta.scheduleId;
  stateOfServer.disableGameStart.timestamp = new Date().getTime();

  stateOfServer.disableJoin = {};
  stateOfServer.disableJoin.status = false;
  stateOfServer.disableJoin.byScheduleId =
    message.meta && message.meta.scheduleId;
  stateOfServer.disableJoin.timestamp = new Date().getTime();

  stateOfServer.disableSit = {};
  stateOfServer.disableSit.status = false;
  stateOfServer.disableSit.byScheduleId =
    message.meta && message.meta.scheduleId;
  stateOfServer.disableSit.timestamp = new Date().getTime();

  app.set("serverStates", stateOfServer);

  dropMail({
    subject: "Server Up Process: " + configConstants.mailFromAppName,
    msg: "Reporting from different server instances. This server has enabled all blocked tasks- login, join, sit, gamestart. Check if any server(s) have not reported in near time same message.",
  });

  var query = { type: "serverStates", serverId: app.serverId };
  adminDb.updateServerStates(
    query,
    { $set: stateOfServer, $setOnInsert: query },
    function (err, result) {
      // updated in db - recover when awake back
    }
  );
}

// disable a service
// disable login
// save in app and db
function disableLogin(app, message) {
  var stateOfServer = app.get("serverStates") || {};
  stateOfServer.disableLogin = {};
  stateOfServer.disableLogin.status = true;
  stateOfServer.disableLogin.byScheduleId =
    message.meta && message.meta.scheduleId;
  stateOfServer.disableLogin.timestamp = new Date().getTime();

  app.set("serverStates", stateOfServer);
  var query = { type: "serverStates", serverId: app.serverId };
  adminDb.updateServerStates(
    query,
    { $set: stateOfServer, $setOnInsert: query },
    function (err, result) {
      // updated in db - recover when awake back
    }
  );

  // acknoledge if needed
  if (message.from.ackTaskDone) {
    // TODO - low priority
  }
}

// disable a service
// disable new game start
// save in app and db
function disableGameStart(app, message) {
  var stateOfServer = app.get("serverStates") || {};
  stateOfServer.disableGameStart = {};
  stateOfServer.disableGameStart.status = true;
  stateOfServer.disableGameStart.byScheduleId =
    message.meta && message.meta.scheduleId;
  stateOfServer.disableGameStart.timestamp = new Date().getTime();

  app.set("serverStates", stateOfServer);
  var query = { type: "serverStates", serverId: app.serverId };
  adminDb.updateServerStates(
    query,
    { $set: stateOfServer, $setOnInsert: query },
    function (err, result) {
      // updated in db - recover when awake back
    }
  );
  // acknoledge if needed
  if (message.from.ackTaskDone) {
    // TODO - low priority
  }
}

// disable a service
// disable join
// save in app and db
function disableJoin(app, message) {
  var stateOfServer = app.get("serverStates") || {};
  stateOfServer.disableJoin = {};
  stateOfServer.disableJoin.status = true;
  stateOfServer.disableJoin.byScheduleId =
    message.meta && message.meta.scheduleId;
  stateOfServer.disableJoin.timestamp = new Date().getTime();

  app.set("serverStates", stateOfServer);
  var query = { type: "serverStates", serverId: app.serverId };
  adminDb.updateServerStates(
    query,
    { $set: stateOfServer, $setOnInsert: query },
    function (err, result) {
      // updated in db - recover when awake back
    }
  );
  // acknoledge if needed
  if (message.from.ackTaskDone) {
    // TODO - low priority
  }
}

// disable a service
// disable sit
// save in app and db
function disableSit(app, message) {
  var stateOfServer = app.get("serverStates") || {};
  stateOfServer.disableSit = {};
  stateOfServer.disableSit.status = true;
  stateOfServer.disableSit.byScheduleId =
    message.meta && message.meta.scheduleId;
  stateOfServer.disableSit.timestamp = new Date().getTime();

  app.set("serverStates", stateOfServer);
  var query = { type: "serverStates", serverId: app.serverId };
  adminDb.updateServerStates(
    query,
    { $set: stateOfServer, $setOnInsert: query },
    function (err, result) {
      // updated in db - recover when awake back
    }
  );
  // acknoledge if needed
  if (message.from.ackTaskDone) {
    // TODO - low priority
  }
}

// prepare receivers
// inform a message to all receivers
// using RPC in loop
function informServers(app, message, cb) {
  var receiverServerIds = [];
  var namespace = "user";
  var service = "adminManagerRemote";
  var method = "inform";

  // find all receiver servers
  if (message.to.all === true) {
    var servers = app.servers; // is an object -
    for (var key of Object.keys(servers)) {
      receiverServerIds.push(servers[key].id);
    }
  } else {
    if (
      message.to &&
      message.to.serverType &&
      message.to.serverType instanceof Array
    ) {
      for (var i = 0; i < message.to.serverType.length; i++) {
        var servers = app.getServersByType(message.to.serverType[i]);
        for (var j = 0; j < servers.length; j++) {
          receiverServerIds.push(servers[j].id);
        }
      }
    }
    if (
      message.to &&
      message.to.serverId &&
      message.to.serverId instanceof Array
    ) {
      for (var i = 0; i < message.to.serverId.length; i++) {
        receiverServerIds.push(message.to.serverId[i]);
      }
    }
  }

  // send message
  if (receiverServerIds.length > 0) {
    var count = receiverServerIds.length;
    for (var i = 0; i < receiverServerIds.length; i++) {
      app.rpcInvoke(
        receiverServerIds[i],
        {
          namespace: namespace,
          service: service,
          method: method,
          args: [message],
        },
        function (argument) {
          count--;

          // invoke cb when all rpc are done
          if (count <= 0) {
            logger("all messages sent, rpcInvoke all done.");
            if (cb instanceof Function) {
              cb();
            }
          }
        }
      );
    }
  }
}

// fetch services disable states from db and update in app
module.exports.recoverServerStatesFromDB = function (app, cb) {
  var query = { type: "serverStates", serverId: app.serverId };
  adminDb.findServerStates(query, function (err, result) {
    if (err) {
      logger("db query failed - findServerStates");
      process.exit();
    } else {
      var stateOfServer = app.get("serverStates") || {};
      if (result instanceof Object) {
        stateOfServer.disableLogin = result.disableLogin;
        stateOfServer.disableGameStart = result.disableGameStart;
        stateOfServer.disableJoin = result.disableJoin;
        stateOfServer.disableSit = result.disableSit;
      }

      app.set("serverStates", stateOfServer);
      if (cb instanceof Function) {
        cb({ success: true, info: "server states recovered." });
      }
    }
  });
};

// fetch server states - for dashboard
module.exports.fetchServerState = function (cb) {
  adminDb.findAllServerStates({ type: "serverStates" }, function (err, result) {
    if (err || !result) {
      cb({ success: false, info: "db query failed - findAllServerStates" });
    } else {
      if (result.length < 0) {
        cb({
          success: true,
          status: true,
          info: "Everything is up and running.",
        });
      } else {
        var status = true;
        for (var i = 0; i < result.length; i++) {
          // if(result[i].disableLogin.status == true || result[i].disableGameStart.status == true){
          if (result[i].disableSit && result[i].disableSit.status == true) {
            status = false;
            break;
          }
          if (result[i].disableLogin && result[i].disableLogin.status == true) {
            status = false;
            break;
          }
        }
        if (status) {
          cb({
            success: true,
            status: true,
            info: "Everything is up and running.",
          });
        } else {
          cb({
            success: true,
            status: false,
            info: "Some/all servers are under maintenance, and has disabled some features. Click 'Switch to running' to make all servers up and running. By clicking on this, you understand its risks and all impacts.",
          });
        }
      }
    }
  });
};

// start enabling all services
// prepare message
// set receivers to 'all'
module.exports.startEnablingAll = function (app, scheduleId, cb) {
  var message = {
    from: {
      serverType: app.serverType,
      serverId: app.serverId,
      ackRcv: false,
      ackTaskDone: false,
      timestamp: new Date().getTime(),
    },
    to: {
      all: true,
    },
    title: "enableAll",
    meta: {
      scheduleId: scheduleId || "",
    },
  };
  informServers(app, message, function (response) {
    logger("all messages sent, for enable all");
  });
};

// start disabling a service - login
// prepare message
// set receivers to 'gate connector'
module.exports.startDisablingLogin = function (app, scheduleId) {
  var message = {
    from: {
      serverType: app.serverType,
      serverId: app.serverId,
      ackRcv: false,
      ackTaskDone: false,
      timestamp: new Date().getTime(),
    },
    to: {
      serverType: ["gate", "connector"],
    },
    title: "disableLogin",
    meta: {
      scheduleId: scheduleId,
    },
  };
  informServers(app, message, function (response) {
    logger("all messages sent, for login disable");
  });
};

// start disabling a service - game start
// prepare message
// set receivers to 'all'
module.exports.startDisablingGameStart = function (app, scheduleId) {
  var message = {
    from: {
      serverType: app.serverType,
      serverId: app.serverId,
      ackRcv: false,
      ackTaskDone: true,
      timestamp: new Date().getTime(),
    },
    to: {
      all: true,
    },
    title: "disableGameStart",
    meta: {
      scheduleId: scheduleId,
    },
  };
  informServers(app, message, function (response) {
    logger("all messages sent, for game start disable");
  });
};

// render all players leave
// altogether
var renderLeaveOnClient = function (actionHandler, params, item) {
  // error in channelId
  setTimeout(
    function (actionHandler, params, item) {
      actionHandler.handleLeave({
        session: {},
        channel: params.channel,
        channelId: params.channelId,
        response: {
          playerLength: 0,
          isSeatsAvailable: false,
          broadcast: {
            success: true,
            channelId: params.channelId,
            playerId: item.playerId,
            playerName: item.playerName,
            isStandup: false,
          },
        },
        request: { playerId: item.playerId, isStandup: false },
      });
    },
    100,
    actionHandler,
    params,
    item
  );
  setTimeout(
    function (actionHandler, params, item) {
      actionHandler.handleLeave({
        self: params,
        session: {},
        channel: params.channel,
        channelId: params.channelId,
        response: {
          playerLength: 0,
          isSeatsAvailable: false,
          broadcast: {
            success: true,
            channelId: params.channelId,
            playerId: item.playerId,
            playerName: item.playerName,
            isStandup: false,
          },
        },
        request: { playerId: item.playerId, isStandup: false },
      }); // loop
    },
    200,
    actionHandler,
    params,
    item
  );
};

// start auto leave for all players
// internal leave
// only affects database
// inform client sepearately
var startForcedLeave = function (app, scheduleId) {
  logger("---------", app.serverId);
  if (app.serverType == "room") {
    var params = {};
    imdb.getAllTable({ serverId: app.serverId }, function (err, tables) {
      if (err) {
        logger(err);
        return;
      }
      ////////////////
      params.tables = tables;
      params.totalSittingPlayers = 0;
      logger("---------", params.tables.length);
      for (var i = 0; i < params.tables.length; i++) {
        params.totalSittingPlayers += params.tables[i].players.length;
        var channel = app
          .get("channelService")
          .getChannel(params.tables[i].channelId);
        if (channel) {
          setTimeout(
            function (channel) {
              channel.pushMessage(/*'channelInfo'*/ "playerInfo", {
                channelId: channel.name,
                heading: "Server down",
                info: "Everybody will be made leave his/her seat, forcefully. Server is going under maintenance.",
                buttonCode: 1,
              });
            },
            50,
            channel
          );
        }
      }
      params.totalLeaveSuccess = 0;
      params.totalLeavefail = 0;
      var async = require("async");
      var actionHandler = require("../servers/room/roomHandler/actionHandler.js");
      ////////////////
      async.eachSeries(
        params.tables,
        function (table, ecb) {
          async.eachSeries(
            table.players,
            function (player, eccb) {
              app.rpc.database.tableRemote.leave(
                {},
                {
                  isRequested: false,
                  playerId: player.playerId,
                  channelId: table.channelId,
                  isStandup: false,
                  playerName: player.playerName,
                },
                function (leaveResponse) {
                  if (leaveResponse.success) {
                    params.totalLeaveSuccess += 1;
                    var channel = app
                      .get("channelService")
                      .getChannel(table.channelId);
                    if (channel) {
                      renderLeaveOnClient(
                        actionHandler,
                        { channel: channel, channelId: table.channelId },
                        {
                          playerId: player.playerId,
                          playerName: player.playerName,
                        }
                      );
                    }
                  } else {
                    params.totalLeavefail += 1;
                  }
                }
              );
              eccb();
            },
            function () {
              ecb();
            }
          );
        },
        function () {
          //////////////
          if (
            params.totalSittingPlayers ==
            params.totalLeaveSuccess + params.totalLeavefail
          ) {
            logger(
              "serverId: " + app.serverId + ", all leave requests completed."
            );
            if (params.totalSittingPlayers == params.totalLeaveSuccess) {
              logger(
                "serverId: " +
                  app.serverId +
                  ", all leave requests were successful."
              );
            }
            if (params.totalLeavefail > 0) {
              logger(
                "serverId: " + app.serverId + ", some leave were failed - ",
                params.totalLeavefail
              );
              logger(
                "serverId: " +
                  app.serverId +
                  ", trying again in few minutes - ",
                params.totalLeavefail
              );
              ///////////////
              setTimeout(
                startForcedLeave.bind(null, app, scheduleId),
                (confServerDown.iterativeForceLeaveAfter_Minutes || 2) *
                  60 *
                  1000
              );
            }
          }
        }
      );
    });
  } else {
    logger("--------- this is not room server", app.serverId);
  }
};

// kick sessions with reason
// logout for everybody
// runs at every connector
var kickSessions = function (app, data) {
  dropMail({
    subject:
      "Scheduling Server Down - " +
      configConstants.mailFromAppName +
      ": Kicking Users Started",
    msg: "Players will be made force LOG-OUT now. Reporting from different (connector) server instances. This is last step of SERVER DOWN PROCESS. Check for a clean cluster and PUT IT DOWN.",
  });
  app.sessionService.forEachSession(function (session) {
    app.sessionService.kickBySessionId(session.id, "elseWhere-ServerDown");
  });
};

// start a service - force logout
// prepare message
// set receivers to 'connector'
var startKickingSessions = function (app, data) {
  var message = {
    from: {
      serverType: app.serverType,
      serverId: app.serverId,
      ackRcv: false,
      ackTaskDone: false,
      timestamp: new Date().getTime(),
    },
    to: {
      serverType: ["connector"],
    },
    title: "kickSessions",
    meta: {
      scheduleId: data.meta && data.meta.scheduleId,
    },
  };
  informServers(app, message, function (response) {
    logger("all messages sent, for kicking sessions");
  });
};

// start a service - force leave
// prepare message
// set receivers to 'room'
module.exports.startForcedLeave = function (app, scheduleId) {
  var message = {
    from: {
      serverType: app.serverType,
      serverId: app.serverId,
      ackRcv: false,
      ackTaskDone: false,
      timestamp: new Date().getTime(),
    },
    to: {
      serverType: ["room"],
    },
    title: "forceLeave",
    meta: {
      scheduleId: scheduleId,
    },
  };
  informServers(app, message, function (response) {
    logger("all messages sent, for login disable");
    setTimeout(
      function (app, message) {
        startKickingSessions(app, message);
      },
      (confServerDown.startKickSessionAfterStartForceLeave_Minutes || 2) *
        60 *
        1000,
      app,
      message
    );
  });
};

// message received on this server
// sent by any server
module.exports.msgRcvd = function (app, message, cb) {
  if (!(message && message.title)) {
    logger("no message title!", message);
    cb("message title is mandatory.");
    return;
  }
  switch (message.title) {
    case "enableAll":
      enableAll(app, message);
      break;
    case "disableLogin":
      disableLogin(app, message);
      break;
    case "disableGameStart":
      disableGameStart(app, message);
      break;
    case "forceLeave":
      startForcedLeave(app, message);
      disableJoin(app, message);
      disableSit(app, message);
      break;
    case "kickSessions":
      kickSessions(app, message);
      break;
    // case 'disableJoin' : disableJoin(app, message); break;
    // case 'disableSit' : disableSit(app, message); break;
    // case 'disableJoinSit' : disableJoin(app, message); disableSit(app, message); break;
    default:
      return cb("message title is invalid");
  }
  cb(null);

  if (message.from.ackRcv) {
    // TODO - low priority
  }
};

// check service state in app context
module.exports.checkServerState = function (event, app) {
  var stateOfServer;
  switch (event) {
    case "login":
      stateOfServer = app.get("serverStates") || {};
      if (stateOfServer.disableLogin && stateOfServer.disableLogin.status) {
        return true;
      }
      return false;
      break;
    case "gameStart":
      stateOfServer = app.get("serverStates") || {};
      if (
        stateOfServer.disableGameStart &&
        stateOfServer.disableGameStart.status
      ) {
        return true;
      }
      return false;
      break;
    case "joinReq":
    case "autoSitReq":
    case "sitReq":
    case "joinWaitReq":
    case "addChipsReq":
      stateOfServer = app.get("serverStates") || {};
      if (stateOfServer.disableJoin && stateOfServer.disableJoin.status) {
        return true;
      }
      if (stateOfServer.disableSit && stateOfServer.disableSit.status) {
        return true;
      }
      return false;
    default:
      return false;
      break;
  }
};

// check client version status by db
module.exports.checkClientStatus = function (event, msg, app, cb) {
  // if (!!msg.byServerDirect) {
  // 	return cb(null, {success: true});
  // }
  if (!msg.deviceType || !msg.appVersion) {
    return cb({ success: false });
  }
  adminDb.findGameVersions(
    { deviceType: msg.deviceType, appVersion: msg.appVersion },
    function (err, result) {
      if (err || !result) {
        return cb({ success: false });
      } else {
        if (result.length > 0) {
          result = result[0];
          if (!!result.isUpdateRequired) {
            var infoUpdateNeeded = "";
            if (msg.deviceType == "website" || msg.deviceType == "browser") {
              infoUpdateNeeded =
                "An updated version is required to continue playing the game. Kindly reload the game.";
            } else if (
              msg.deviceType == "iosApp" ||
              msg.deviceType == "androidApp"
            ) {
              infoUpdateNeeded =
                "An updated version is required to continue playing the game. Kindly download the updated build.";
            } else {
              infoUpdateNeeded =
                "An updated version is required to continue playing the game. Kindly download/reload the game.";
            }
            return cb({
              success: false,
              info: infoUpdateNeeded,
              errorType: "5011" /*update game code*/,
            });
          } else if (!!result.isInMaintainance) {
            return cb({
              success: false,
              info: "Server is under maintenance. Please try again later.",
            });
          } else {
            return cb(null, { success: true });
          }
        } else {
          return cb({ success: false });
        }
      }
    }
  );
};
