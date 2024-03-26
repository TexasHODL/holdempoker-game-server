/*jshint node: true */
"use strict";

// require('/usr/local/lib/node_modules/nocycle').detect();
require('dotenv').config();
var pomelo              = require('pomelo'),
    // cors                = require('cors'),
    // nodeSchedule        = require('node-schedule'),
    // db                  = require('../shared/mongodbConnection').init(),
    stateOfX            = require('./shared/stateOfX'),
    setUpConfig         = require('./shared/setUpConfig'),
    // tournamentSchedular = require('./app/servers/connector/handler/tournamentSchedular.js'),
    zmqPublish          = require('./shared/infoPublisher.js');

    // autoLogOutSchedular = require('./app/servers/connector/handler/autoLogOutSchedular.js'),
    // appmetrics = require('appmetrics'),
    // monitoring = appmetrics.monitor(),
    // routeUtil  = require('./app/util/routeUtil'),
    var routeUtil  = require('./app/util/routeUtil');
    var serverDownManager  = require('./app/util/serverDownManager');
    var channelStore  = require('./app/util/channelStoreDB')('channelStoreColl', 'db');
    var sharedModule            = require("./shared/sharedModule.js");
    // schedular  = require("./app/servers/connector/handler/entryHandler.js");
var db = require('./shared/mongodbConnection');
var logger = require('pomelo-logger').getLogger('pomelo', __filename);
var fs = require('fs');
const redisManager = require('./services/redis-db/redisConnect');
const configConstants = require('./shared/configConstants');
// var nodeMailers = require("nodemailer");
/**
 * Init app for client.
 */
var app = pomelo.createApp();
app.set('name', 'Poker-Gameserver');
app.set('frontendType', 'connector');

db.init(app.serverType, function (dbError) {
    if (dbError) {
        process.exit();
        return;
    }

    redisManager.dbConnect({}, (connectFailed, client) => {
        if (connectFailed) {
            process.exit();
        }
        app.set('redis', client);


        // all further code is in this callback /////////

        // if(process.env.NODE_ENV == "test"){
        console.log = function (data) {
            logger.debug(data);
        };
        // console.tra = function(){}; 
        console.error = function (data) {
            logger.debug(data);
        };
        // }

// Server and Database details

console.log('=============================================================');
console.log('========= Starting ' + (app.serverType) + ' Server =========');
console.log('Host: ' + (app.get("curServer").host) + ' & Port: ' + (app.get("curServer").port || app.get("curServer").clientPort));
console.log('Server Instance:  ' + (app.get("curServer").id));
console.log('=============================================================');

// app configuration
app.configure('production|development', 'connector', function(){
  app.set('connectorConfig', {
    
    connector   : pomelo.connectors.hybridconnector,
    heartbeat   : 30,
    disconnectOnTimeout : true,
    timeout : 60, //defaultValues.disconnectionTimeout, //default: 2*heartbeat
    useDict     : true,
    useProtobuf : true,
    ssl: {
      type: 'wss',
       key: fs.readFileSync('./shared/poker.key'),
       cert: fs.readFileSync('./shared/poker.crt')
      // ca: [fs.readFileSync('../shared/creatiosoftstudio_01.crt', 'utf8'),
          //  fs.readFileSync('../shared/creatiosoftstudio_02.crt', 'utf8')]
    }
  });

  app.set('idlePlayerWatcherStarted', false);
  app.set('autologoutWatcher', false);
 
  // app.filter(pomelo.serial(2000));

  // setTimeout(function(){
  //   console.log("======== STARTING TOURNAMENT SCHEDULER ========");
  //   tournamentSchedular.checkTournamentStart(app);
  // }, parseInt(configConstants.startSchedularOnServerStart)*1000);

});

// app configuration
app.configure('production|development', 'database', function(){
  setTimeout(function(){
  }, parseInt(configConstants.resetDatabaseOnServerStart)*1000);
});


// app configuration
app.configure('production|development', 'gate', function(){
  app.set('connectorConfig',
    {
      
      connector   : pomelo.connectors.hybridconnector,
      heartbeat   : 5,
      useDict     : true,
      useProtobuf : true,
    ssl: {
      type: 'wss',
       key: fs.readFileSync('./shared/poker.key'),
       cert: fs.readFileSync('./shared/poker.crt')
      // ca: [fs.readFileSync('../shared/creatiosoftstudio_01.crt', 'utf8'),
          //  fs.readFileSync('../shared/creatiosoftstudio_02.crt', 'utf8')]
    }
    });
});

// config for room server
app.configure('production|development', 'room', function(){
  // needed following - for crash recovery
  // app.set('channelConfig', {
  //   prefix: 'MP_ch',
  //   store: channelStore })
  setTimeout(function(){
  }, parseInt(configConstants.resetDatabaseOnServerStart)*1000);
});

// // app configuration
// app.configure('production|development', 'connector', function(){
//     app.set('connectorConfig',
//         {
//             connector : pomelo.connectors.hybridconnector,
//             // transports : ['websocket'],
//             heartbeats : true,
//             closeTimeout : 80,
//             heartbeatTimeout : 80,
//             heartbeatInterval : 25
//         });
// });


// app configure
app.configure('production|development', function() {
    // route configures
    //app.route('chat', routeUtil.chat);
    app.route('room', routeUtil.redirect);
    app.route('connector', routeUtil.redirConn);
    // filter configures
    app.filter(pomelo.timeout());
    // app.use(require('./splugin'));
    app.use(require('./plugins/mailer'), {devMailer: {key: stateOfX.SendGridApiKey, prefix: 'Dev', fromName: configConstants.mailFromAppName}});
});

// monitoring.on('http', function (http) {
//  console.log("------HTTP-------");
//     console.log(http);
// });

// monitoring.on('mongo', function (mongo) {
//  console.log("------Mongo-------");
//     console.log(mongo);
// });


// start app
//app.start();

app.start(function () {
  app.event.on("TestServerException",function(datas){
     logger.debug('Caught exception: ' + datas);
     app.rpc.connector.entryRemote.sendMailToDevelopers("SESSION", datas, function (response) {
       logger.debug(response);
     });
    });
  app.configure('production|development', 'database', function(){

    console.log("====== RESETTING DATABASES =======");
    var resetDatabase = require('./resetDatabase');
    resetDatabase.reset();

    // Starting log publisher
    zmqPublish.startPublisher(setUpConfig.databaseServerlogPort);
  });

  app.configure('production|development', 'room', function () {
    // Starting log publisher
    zmqPublish.startPublisher(setUpConfig.roomServerlogPort);
  });

  app.configure('production|development', 'connector', function () {
    // Starting log publisher
    zmqPublish.startPublisher(setUpConfig.connectorServerlogPort);
   
    app.event.on("HeatBeatTimeOutFromServer",function(data){
      
    });

    
    // this event is to be modified 
    // app.event.on("entrySuccess", function(data){
    //   // add logdb query here
    // })

  });

  // serverDownManager.recoverServerStatesFromDB(app); // cb optional
});

    })

    // db init - callback - ends in next line //
});


process.on('forceMail', function (data) {
  console.error('Force Mail: ' + JSON.stringify(data));
   app.rpc.connector.entryRemote.sendMailToDevelopers("SESSION", JSON.stringify(data), function (response) {
     logger.debug(response);
   });
  // app.get('devMailer').sendToDev(err);
});

process.on('uncaughtException', function (err) {
  console.error('Caught exception: ' + err.stack);
   app.rpc.connector.entryRemote.sendMailToDevelopers("SESSION", err.stack, function (response) {
     logger.debug(response);
   });
  // app.get('devMailer').sendToDev(err);
});