/*jshint node: true */
"use strict";

// var appmetrics    = require('appmetrics'),
// 		monitoring    = appmetrics.monitor();

		// monitoring.on('cpu', function (cpu) {
		//     console.log('[' + new Date(cpu.time) + '] CPU: ' + cpu.process+' server: database ');
		// });

module.exports = function (app) {
    return new Handler(app);
};

var Handler = function (app) {
    this.app = app;
};

var handler = Handler.prototype;

/*handler.testDB = function(user,message){
 customLog.logToFile("*************************************");
 customLog.logToFile("INTO DB HANDLER !!");
 customLog.logToFile("*************************************");
 customLog.logToFile("I was called " + " User " + user + " message " + message);
 }*/

var registerUser = function (msg, session, next) {
    
};

