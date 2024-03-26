/*jshint node: true */
"use strict";


// var zmq = require('zmq'),
//     stateOfX = require('./stateOfX.js'),
//     publisher = zmq.socket('pub');

var publisherObj = {};

publisherObj.startPublisher = function (port){
  return;
  // console.log("***********************");
  // console.log("*** ZMQ TO START AT ***");
  // console.log("***********************");
  // console.log("*** Changed 1 ***");
  publisher.bind('tcp://*:'+port, function(err) {
    console.log('Listening for zmq subscribers  '+port+' ...');
  });
};

publisherObj.getTimeFormat = function () {
  var ft = null;
};

publisherObj.sendLogMessage = function (params){
  return;
  // console.log("***********************");
  // console.log("*** ZMQ TO SEND MSG ***");
  // console.log("***********************");
  var date = new Date();
  // console.log(date);
  // console.log(date.getFullYear())
  var time = date.getFullYear() + '-' + + date.getMonth() + '-' + + date.getDate() + ' ' + date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds() + '.' + date.getMilliseconds();
  // console.log(time)
  var msg={
    functionName  : !!params.functionName ? params.functionName : "No function name",
    logType       : !!params.type ? params.type : stateOfX.serverLogType.anonymous,
    log           : !!params.log ? params.log : "No log passed",
    fileName      : !!params.fileName ? params.fileName : "No fileName",
    timestamp     : time,
    serverName    : !!params.serverName ? params.serverName : "UNDEFINED",
  };
  // console.log(JSON.stringify(msg));
  publisher.send(JSON.stringify(msg));
};

// schedule tournaments on tournament create, update;
publisherObj.scheduleNormalTournament = function(params) {
  return;
  // console.log("params is in scheduleNormalTournament is in infoPublisher.js - ",JSON.stringify(params));
  var msg = {
    msgkey: "scheduleNormalTournament",
    data : params
  };
  // console.log("msg is in scheduleNormalTournament is in infoPublisher is - ",JSON.stringify(msg));
  console.log(JSON.stringify(msg));
  // publisher.send(JSON.stringify(msg));
};

// kill tournament scheduler on disable on tournament
publisherObj.killSchedularForNormalTournament = function(params) {
  return;
  // console.log("params is in scheduleNormalTournament is in infoPublisher.js - ",JSON.stringify(params));
  var msg = {
    msgkey: "killSchedularForNormalTournament",
    data : params
  };
  // console.log("msg is in killSchedularForNormalTournament is in infoPublisher is - ",JSON.stringify(msg));
  publisher.send(JSON.stringify(msg));
};

// Start schedular on server Start
publisherObj.scheduleTournamentOnServerStart = function() {
  return;
  var msg = {
    msgKey: "scheduleTournamentOnServerStart",
  };
  // console.log("msg is in scheduleTournamentOnServerStart is in infoPublisher is - ",JSON.stringify(msg));
  publisher.send(JSON.stringify(msg));
};

module.exports = publisherObj;