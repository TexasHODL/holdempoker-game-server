/*jshint node: true */
"use strict";

// Created by Sushil on  6/2/2017
// this file is for create video logs and update video logs

var _              = require('underscore'),
  keyValidator     = require("../../../../shared/keysDictionary"),
  // imdb             = require("../../../../shared/model/inMemoryDbQuery.js"),
  stateOfX         = require("../../../../shared/stateOfX.js"),
  db               = require("../../../../shared/model/dbQuery.js"),
  logDB           = require("../../../../shared/model/logDbQuery.js"),
  infoMessage      = require("../../../../shared/popupTextManager"),
  zmqPublish       = require("../../../../shared/infoPublisher.js"),
  ObjectID         = require('mongodb').ObjectID,
  async            = require("async");


// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'videoGameRemote';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

// var videoGameRemote = {};
var videoGameRemote = function (app) {
  // this.app = app;
  // this.channelService = app.get('channelService');
};

module.exports = function(app) {
    return new videoGameRemote(app);
};

// this function is for create video logs
// params : {roundId, channelId, type, data}
videoGameRemote.prototype.createVideo = function (params, cb) {
  console.error(stateOfX.serverLogType.info,'params is in createVideo is - ' + JSON.stringify(params));
  var history = {
    type      : params.type,
    data      : params.data,
    createdAt : Number(new Date())
  };
  serverLog(stateOfX.serverLogType.info,'histroy is - ' + JSON.stringify(history));
  var query = {
   roundId   : params.roundId,
   channelId : params.channelId
  };

  serverLog(stateOfX.serverLogType.info,'Search quesry for video log: ' + JSON.stringify(query));
  serverLog(stateOfX.serverLogType.info,'Inserting current event for video: ' + JSON.stringify(history));

  logDB.insertNextVideo(query, history, function(err, updatedVideo) {
    if(!err) {
      // Set current video log as active
      if(params.type === stateOfX.videoLogEventType.broadcast && params.data.route === "gameOver") {
        serverLog(stateOfX.serverLogType.info, 'Setting video log as true!');
        logDB.updateVideo(query, {active: true}, function(err, res) {
          if(err) {
            cb({success: false, info: "Error while setting video as active true.", isDisplay: false,isRetry: false, channelId: ""});
          } else {
            cb({success: true, result: {videoId: updatedVideo._id}});
          }
        });
      }else{
        cb({success: false, info: "Error while setting video as active true.", isDisplay: false,isRetry: false, channelId: ""});
      }
    } else {
      serverLog(stateOfX.serverLogType.info,'Error in insert new video in db');
      cb({success: false, info: "Error in insert new video in db", isDisplay: false,isRetry: false, channelId: ""});
    }
  });
};

// Get video details from video Id passed from video collection
var getVideoByRoundId = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,'In function getVideo.');
  logDB.findOneVideo({roundId: params.roundId}, function(err, video) {
    serverLog(stateOfX.serverLogType.info,'video is in getVideoData is - ' + JSON.stringify(video));
    if(!err) {
      if(!!video) {
        params.video = video;
        cb(null, params);
      } else {
        serverLog(stateOfX.serverLogType.error, infoMessage.dbQyeryInfo.DB_NOVIDEOEXISTS);
        cb({success: false, info: infoMessage.dbQyeryInfo.DB_NOVIDEOEXISTS, isDisplay: false, isRetry: false, channelId: ""});
      }
    } else {
      serverLog(stateOfX.serverLogType.error, infoMessage.dbQyeryInfo.DB_GETVIDEO_FAIL);
      cb({success: false, info: infoMessage.dbQyeryInfo.DB_GETVIDEO_FAIL, isDisplay: false, isRetry: false, channelId: ""});
    }
  });
};

// Get video details from video Id passed from video collection
var getVideo = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,'In function getVideo.');
  logDB.findOneVideo({_id: ObjectID(params.videoId)}, function(err, video) {
    serverLog(stateOfX.serverLogType.info,'video is in getVideoData is - ' + JSON.stringify(video));
    if(!err) {
      if(!!video) {
        params.video = video;
        cb(null, params);
      } else {
        serverLog(stateOfX.serverLogType.error, infoMessage.dbQyeryInfo.DB_NOVIDEOEXISTS);
        cb({success: false, info: infoMessage.dbQyeryInfo.DB_NOVIDEOEXISTS, isDisplay: false, isRetry: false, channelId: ""});
      }
    } else {
      serverLog(stateOfX.serverLogType.error, infoMessage.dbQyeryInfo.DB_GETVIDEO_FAIL);
      cb({success: false, info: infoMessage.dbQyeryInfo.DB_GETVIDEO_FAIL, isDisplay: false, isRetry: false, channelId: ""});
    }
  });
};

// Get hand history id for this video id from handtab collection
var getHandHistory = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,'In function getHandHistory.');
  logDB.getHandHistoryByVideoId(params.videoId, function(err, res){
    if(!err && res) {
      params.handHistoryId = res.handHistoryId;
      cb(null, params);
    } else {
      serverLog(stateOfX.serverLogType.error, infoMessage.dbQyeryInfo.DB_GETHISTORYBYVIDEO_FAIL);
      cb({success: false, info: infoMessage.dbQyeryInfo.DB_GETHISTORYBYVIDEO_FAIL, isDisplay: false, isRetry: false, channelId: ""});
    }
  });
};

// Generate response for video player (as requested by client)
var generateResponse = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,'In function generateResponse.');
  var firstCreation = params.video.createdAt; //find the value of first time the document is created
  var response = {};

  response.success = true;
  response.handHistoryId = params.handHistoryId;
  // params.video.history = params.video.history;
  response.gamePlayers             = _.where(params.video.history,{type:"gamePlayers"})[0].data;   //finding those data where history type is response
  response.joinResponse            = _.where(params.video.history,{type:"joinResponse"})[0].data;   //finding those data where history type is response
  response.joinResponse.playerId   = params.playerId;
  response.joinResponse.playerName = params.playerName;

  response.roundId = params.video.roundId;

  var broadCastType = _.where(params.video.history,{type:"broadcast"}); //finding those data where history type is broadcast
  var responseType  = _.where(params.video.history,{type:"response"});   //finding those data where history type is response
  serverLog(stateOfX.serverLogType.info,'broadCastType is in createVideo is - ' + JSON.stringify(broadCastType));
  serverLog(stateOfX.serverLogType.info,'responseType is in createVideo is - ' + JSON.stringify(responseType));
  var broadcasts = [];
  var responses  = [];
  var duration   = 0;
  var timeStamp  = 0;
  for(var i=0;i<broadCastType.length;i++) {
    timeStamp = (broadCastType[i].createdAt - firstCreation)/1000; //calculating the timestamp in seconds
    if(broadCastType[i].data.route === "preCheck" || broadCastType[i].data.route === "bestHands" || broadCastType[i].data.route === "playerCards") {
      if(params.playerId === broadCastType[i].data.playerId) { // push only if player is authorise for data
        broadcasts.push({timestamp: timeStamp, data: broadCastType[i].data});
      }
    } else {
      broadcasts.push({timestamp: timeStamp, data: broadCastType[i].data});
    }
    if(broadCastType[i].data.route === "gameOver") {
      duration = timeStamp;
    }
  }

  for(var i=0;i<responseType.length;i++){
    var responseTimeStamp = (responseType[i].createdAt - firstCreation)/1000; //calculating the timestamp in seconds
    responses.push({
      timestamp : (responseType[i].createdAt - firstCreation)/1000, //calculating the timestamp in seconds
      data : responseType[i].data
    });
  }

  serverLog(stateOfX.serverLogType.info,'broadcasts after modify - ' + JSON.stringify(broadcasts));
  serverLog(stateOfX.serverLogType.info,'responses after modify is - ' + JSON.stringify(responses));

  response.broadcasts = broadcasts;
  response.duration   = duration;
  response.responses  = responses;
  serverLog(stateOfX.serverLogType.info, 'Total duration: ' + duration);
  serverLog(stateOfX.serverLogType.info,'response before sending in getVideoData is - ' + JSON.stringify(response));

  params.response = response;

  cb(null, response);
};

// this function is for get video data from database and create response
// params : {videoId, playerId}
videoGameRemote.prototype.getVideoData = function (params, cb){
  serverLog(stateOfX.serverLogType.info,'params is in createVideo is - ' + JSON.stringify(params));
  async.waterfall([
    async.apply(getVideo, params),
    getHandHistory,
    generateResponse
  ], function(err, res){
    if(!err && res) {
      cb(res);
    } else {
      serverLog('stateOfX.serverLogType.info',"Error in getting video from db");
      cb({success: false, info: "Error in getting video from db", isDisplay: false,isRetry: false, channelId: ""});
    }
  });
};

videoGameRemote.prototype.getVideoDataByRoundId = function(params, cb) {
  serverLog(stateOfX.serverLogType.info,'params is in getVideoDataByRoundId is - ' + JSON.stringify(params));
  async.waterfall([
    async.apply(getVideoByRoundId, params),
    getHandHistory,
    generateResponse
  ], function(err, res){
    if(!err && res) {
      cb(res);
    } else {
      serverLog('stateOfX.serverLogType.info',"Error in getting video from db");
      cb({success: false, info: "Error in getting video from db", isDisplay: false,isRetry: false, channelId: ""});
    }
  });
};

// find roundId (alpha-numeric unique for game)
// by handId (numeric unique for game, visible to player and admin)
var findRoundIdByHandId = function (params, response, cb) {
  if (params.by == "roundId") {
    params.roundId = params.value;
    return cb(null, params, response);
  } else {
    // db query, set roundId if one
    logDB.findByHandId_handTab({handId: params.value}, function (err, result) {
      if (err || !result || result.length<=0) {
        // db query, gameActivity db.getCollection('gameActivity').find({"subCategory":"GAME OVER","rawResponse.params.table.roundNumber":"775374394597"})
        logDB.findByHandId_gameActivity(params.value, {"roundId": 1, "channelId": 1, "createdAt": 1}, function (err, result) {
          if (err || !result || result.length<=0) {
            return cb({success: false, info: "There are no games with this handId."});
          } else if (result.length > 1) {
            return cb({success: false, info: "There are more than 1 game with this handId, Which is very very rare. Try with provided roundIds one by one.", result: result.map(i => i.roundId)});
          } else {
            params.roundId = result[0].roundId;
            return cb(null, params, response);
          }
        });
      } else if (result.length > 1) {
        return cb({success: false, info: "There are more than 1 game with this handId, Which is very very rare. Try with provided roundIds one by one.", result: result.map(i => i.roundId)});
      } else {
        params.roundId = result[0].roundId;
        return cb(null, params, response);
      }
    });
  }
};

var addPerspective = function (params, response, cb) {
  if (!!params.playerId) {
    response.playerId = params.playerId;
    return cb(null, params, response);
  } else {
    if (!!params.playerName) {
      db.getUserKeyValue({userName: params.playerName}, "playerId", function (err, result) {
        if (err || !result) {
          return cb(null, params, response);
        } else {
          params.playerId = result.playerId;
          response.playerId = params.playerId;
          return cb(null, params, response);
        }
      });
    } else {
      return cb(null, params, response);
    }
  }
};

videoGameRemote.prototype.getVideoAndText = function(params, cb) {
  // params = {by: "roundId"/"handId", value: "r934t854t8", responses: ["video", "text"]}
  var response = {};
  async.waterfall([
    async.apply(findRoundIdByHandId, params, response),
    addPerspective,
    function (params, response, icb) {
      async.eachSeries(params.responses, function (item, ecb) {
        switch(item){
          case "video" :
            videoGameRemote.prototype.getVideoDataByRoundId({roundId: params.roundId, playerId: params.playerId}, function (res) {
              response.video = res;
              response.success = true;
              response.multiple = response.multiple || [];
              response.multiple.push("video");
              ecb(null);
            });
            break;
          case "text" :
            logDB.findOneHandHistory({roundId: params.roundId, playerId: params.playerId}, function  (err, res) {
              if (err || !res) {
                response.text = {success: false, info: "Hand history not found."};
              } else {
                response.text = res;
              }
              response.success = true;
              response.multiple = response.multiple || [];
              response.multiple.push("text");
              ecb(null);
            });
            break;
          default:
            ecb(null);
            break;
        }
      }, function (err) {
        icb(err||response);
      });
    }], function (err, response) {
      cb(err||response);
    });
};

// module.exports = videoGameRemote;