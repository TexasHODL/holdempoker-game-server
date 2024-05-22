/*jshint node: true */
"use strict";

// Resume handle created by sushil on 1/3/2017

var _                = require('underscore'),
	async            = require("async"),
	_ld              = require("lodash"),
	keyValidator     = require("../../../../shared/keysDictionary"),
	imdb             = require("../../../../shared/model/inMemoryDbQuery.js"),
	stateOfX         = require("../../../../shared/stateOfX.js"),
	activity         = require("../../../../shared/activity.js"),
	zmqPublish       = require("../../../../shared/infoPublisher.js"),
	broadcastHandler = require("./broadcastHandler"),
	startGameHandler = require("./startGameHandler"),
	popupTextManager = require("../../../../shared/popupTextManager");

const configConstants = require('../../../../shared/configConstants');
var resumeHandler = {};
var pomelo = require('pomelo');
// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'resumeHandler';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

//{self,channelId, session}
// process player resume, try start game
// player state becomes WAITING if chips are there
// else broadcast bankrupt
var resumeProcess = function(params, cb) {
 	var channel = pomelo.app.get('channelService').getChannel(params.channelId, false); //Added for channel is already present
  pomelo.app.rpc.database.tableRemote.resume("session",params.request, function (resumeResponse) {
    if(resumeResponse.success) {
      cb(resumeResponse);
      serverLog(stateOfX.serverLogType.response, 'Resume response: ' + JSON.stringify(resumeResponse));
      if(resumeResponse.state !== stateOfX.playerState.playing || (channel.channelType === stateOfX.gameType.tournament && resumeResponse.lastMove !== stateOfX.move.fold)) {
        if(resumeResponse.state === stateOfX.playerState.outOfMoney) {
         // resumeResponse.state = stateOfX.playerState.onBreak;
         console.error(resumeResponse.state);
        }else{
          broadcastHandler.firePlayerStateBroadcast({channel: channel, self: params.self, playerId: params.request.playerId, channelId: params.channelId, state: resumeResponse.state});
        }
      }
      if(resumeResponse.isOutOfMoney && channel.channelType !== stateOfX.gameType.tournament) {
        broadcastHandler.fireBankruptBroadcast({self: params.self, playerId: params.request.playerId, channelId: params.channelId});
      }
      // Timer added if Game is over and calculation is under progress and if Game start request came from here
      // then there is a chance that a new game will try to start and then Game over broadcast
      // fired to client, because of several delays added in Game over, Game Start etc for proper animation
      setTimeout(function(){
        startGameHandler.startGame({self: params.self, session: params.session, channelId: params.channelId, channel: channel, eventName: stateOfX.startGameEvent.resume});
      }, parseInt(configConstants.startGameAfterStartEvent)*1000);
    } else {
      serverLog(stateOfX.serverLogType.response, JSON.stringify(resumeResponse));
      cb(resumeResponse);
    }
  });
};

// API - "SITIN"
// player resumes in a table
resumeHandler.resume = function(params, cb) {
	resumeProcess(params, function(resumeProcessResponse) {
		cb(resumeProcessResponse);
	});
};

// API - "SITIN ALL"
// player resume all tables
resumeHandler.resumeAll = function(params, cb) {
	var sessionChannels = !!params.session.get("channels") ? params.session.get("channels") : [];
	serverLog(stateOfX.serverLogType.response,"session channels are - " + JSON.stringify(sessionChannels));
	async.eachSeries(sessionChannels, function(sessionChannel, ecb){
    serverLog(stateOfX.serverLogType.response,"session channel is - " + sessionChannel);
    params.request.channelId = sessionChannel;
    resumeProcess({self: params.self, channelId: sessionChannel, session: params.session, request: params.request},function(resumeProcessResponse) {
    	serverLog(stateOfX.serverLogType.response,"channel processed" + JSON.stringify(resumeProcessResponse));
    	ecb();	
    });
  }, function(err) {
  	if(!err) {
  		cb({success: true});
  	} else {
  		cb({success: false});
  	}
  });
};

module.exports = resumeHandler;
