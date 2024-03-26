/*jshint node: true */
"use strict";


var zmq          = require('zmq'),
    subscriber   = zmq.socket('sub'),
    stateOfX     = require("./stateOfX"),
    colors       = require('colors'),
    chalk        = require('chalk'),
    setUpConfig  = require('./setUpConfig.json'),
    db           = require('./mongodbConnection').init(),
    inmemoryDb   = require('./model/inMemoryDbQuery.js'),
    detailIp     = {};



// Config IPs and Ports to subscribe log events

detailIp.databaseServerIp   = setUpConfig.databaseServerIp;
detailIp.databaseServerPort = setUpConfig.databaseServerlogPort;
detailIp.connServerIp       = setUpConfig.connectorServerIp;
detailIp.connServerPort     = setUpConfig.connectorServerlogPort;
detailIp.roomServerIp       = setUpConfig.roomServerIp;
detailIp.roomServerlogPort  = setUpConfig.roomServerlogPort;
// detailIp.authServerIp   = 'localhost';
// detailIp.authServerPort = 2222;
// detailIp.gateServerIp   = 'localhost';
// detailIp.gateServerPort = 2224;

// Subscribe to all messages.
subscriber.subscribe('');

// Handle messages from publisher.
subscriber.on('message', function(data) {
  var msg = JSON.parse(data);
  var logText = "";
  // console.log((msg.serverName.toUpperCase() + '::' + msg.logType + " [" + new Date(msg.timestamp) +'] - ' + msg.fileName + " : " + msg.functionName + ' : ' + msg.log).green);
  switch(msg.logType) {
    case stateOfX.serverLogType.info        : logText = (chalk.green('\n[' + msg.timestamp +'] ' + msg.serverName.toUpperCase() + ' - [' + msg.logType + '] - ') + msg.fileName  + ': ' + msg.log) ; console.log(logText); break;
    case stateOfX.serverLogType.warning     : logText = (chalk.yellow('\n[' + msg.timestamp +'] ' + msg.serverName.toUpperCase() + ' - [' + msg.logType + '] - ') + msg.fileName  + ': ' + msg.log) ; console.log(logText); break;
    case stateOfX.serverLogType.error       : logText = (chalk.red('\n[' + msg.timestamp +'] ' + msg.serverName.toUpperCase() + ' - [' + msg.logType + '] - ') + msg.fileName  + ': ' + msg.log) ; console.log(logText); break;
    case stateOfX.serverLogType.request     : logText = (chalk.cyan('\n[' + msg.timestamp +'] ' + msg.serverName.toUpperCase() + ' - [' + msg.logType + '] - ') + msg.fileName  + ': ' + msg.log) ; console.log(logText); break;
    case stateOfX.serverLogType.response    : logText = (chalk.cyan('\n[' + msg.timestamp +'] ' + msg.serverName.toUpperCase() + ' - [' + msg.logType + '] - ') + msg.fileName  + ': ' + msg.log) ; console.log(logText); break;
    case stateOfX.serverLogType.broadcast   : logText = (chalk.yellow('\n[' + msg.timestamp +'] ' + msg.serverName.toUpperCase() + ' - [' + msg.logType + '] - ') + msg.fileName  + ': ' + msg.log) ; console.log(logText); break;
    case stateOfX.serverLogType.dbQuery     : logText = (chalk.magenta('\n[' + msg.timestamp +'] ' + msg.serverName.toUpperCase() + ' - [' + msg.logType + '] - ') + msg.fileName  + ': ' + msg.log) ; console.log(logText); break;
    default                                 : logText = (chalk.green('\n[' + msg.timestamp +'] ' + msg.serverName.toUpperCase() + ' - [' + msg.logType + '] - ') + msg.fileName  + ': ' + msg.log) ; console.log(logText); break;
  }

  // operation for saving data in db should go here
  //inmemoryDb.insertLog({log: logText}, function(err, res){});
});


subscriber.on("connect",function(fd,endpoint){
  console.log("Event subscriber connect");
});

subscriber.on("connect_delay",function(fd,endpoint){
  console.log("Event subscriber connect_delay ");
});
subscriber.on("connect_retry",function(fd,endpoint){
  console.log("Event subscriber connect_retry ");
});
subscriber.on("listen",function(fd,endpoint){
  console.log("Event subscriber listen");
});
subscriber.on("bind_error",function(fd,endpoint){
  console.log("Event subscriber bind_error");
});
subscriber.on("disconnect",function(fd,endpoint){
  console.log("Event subscriber disconnect");
});

// subscriber.connect('tcp://'+detailIp.authServerIp+':'+detailIp.authServerPort = 2222);
// subscriber.connect('tcp://'+detailIp.databaseServerIp+':'+detailIp.databaseServerPort = 2223);
// subscriber.connect('tcp://'+detailIp.gateServerIp+':'+detailIp.gateServerPort = 2224);
subscriber.connect( 'tcp://' + detailIp.connServerIp+ ':' + detailIp.connServerPort);
subscriber.connect( 'tcp://' + detailIp.databaseServerIp+ ':' + detailIp.databaseServerPort);
subscriber.connect( 'tcp://' + detailIp.roomServerIp+ ':' + detailIp.roomServerlogPort);
