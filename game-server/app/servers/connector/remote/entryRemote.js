/*jshint node: true */
"use strict";


// > This file is used to control following things -
// 1. Broadcast single player
// 2. Get user server session
// 3. Kill user existing session

var logger = require('pomelo-logger').getLogger('pomelo', __filename);
var nodeMailers = require("nodemailer");
const configConstants = require('../../../../shared/configConstants');
module.exports = function(app) {
	return new EntryRemote(app);
};

var EntryRemote = function(app) {
	this.app = app;
	this.sessionService = app.get('sessionService');
};

EntryRemote.prototype = {

	// ### Broadcast a single user through session with server ###
	sendMessageToUser: function(uid, msg, route, cb) {
		var connector = this.app.components.__connector__;
		if(!!this.sessionService.getByUid(uid) && this.sessionService.getByUid(uid).length > 0) {
			connector.send(null, route, msg, [this.sessionService.getByUid(uid)[this.sessionService.getByUid(uid).length-1].id], {}, function(err) {
				cb(true);
		  });
		} else {
			console.error('Session not found for this player in entryremote - route - ' + route + ' playerId - ' + uid);
			cb(false);
		}
	},

	// ### Get user session with server ###
	getUserSession: function(msg, cb) {
		var that 	= this,
			session = !!that.sessionService.getByUid(msg.playerId) ? that.sessionService.getByUid(msg.playerId)[0] : null;
		if(!!session) {
			var disonnectedStatus = false;
			//if(!!session.get("isDisconnectedForce")){
			 	disonnectedStatus = session.get("isDisconnectedForce") || false;
			//}
			console.error(disonnectedStatus);
			cb({success: true, sessionId: session.id, isDisconnectedForce: disonnectedStatus});
		} else {
			cb({success: false, info: "user session not found", isRetry: false, isDisplay: false, channelId: ""});
		}
	},

	// ### Get/Set user session settings key-value with server ###
	// value is optional
	sessionKeyValue: function(msg, cb) {
		var that = this;
		var session = !!that.sessionService.getByUid(msg.playerId) ? that.sessionService.getByUid(msg.playerId)[0] : null;
		if (session) {
			if(msg.value !== undefined){
				session.set(msg.key, msg.value);
			}
			cb({success: true, value: session.get(msg.key)});
		} else {
			cb({success: false, info: "user session not found - keyValue", isRetry: false, isDisplay: false, channelId: ""});
		}
	},

	// ### Kill a user's session with server WHEN uid is given ###
	killUserSessionByUid: function (session_uid, cb) {
		console.error('Kick user for this session forcefully!! by UID - ' + session_uid);
		var that 	= this,
			session = !!that.sessionService.getByUid(session_uid) ? that.sessionService.getByUid(session_uid)[0] : null;
		if(!!session) {
			that.sessionService.kickBySessionId(session.id, function(data) {
				cb({success: true});
			});
		} else {
			cb({success: false, info: "Error in kill user session by uid", isRetry: false, isDisplay: false, channelId: ""});
		}
	},

	// ### Kill a user's session with server ###
	killUserSession: function(session_id, cb) {
		console.error('Kick user for this session forcefully!! - ' + session_id);
		var that 	= this,
			session = that.sessionService.get(session_id);
		if(!!session) {
			that.sessionService.kickBySessionId(session.id, function(data) {
				cb({success: true});
			});
		} else {
			cb({success: false, info: "Error in kill user session", isRetry: false, isDisplay: false, channelId: ""});
		}
	},

	// ### send message to user by his sessionId
	sendMessageBySessionId : function(sessionId, cb) {
		console.log("in sendMessageBySessionId in EntryRemote ",sessionId);
		console.log("going to send message");
		var msg = "you going to be logged out because of multiple login";
		if(!!sessionId) {
			this.sessionService.sendMessage(sessionId, msg);
			cb();
		} else {
			console.log("error in sending message to user");
			cb();
		}
	},

	// ### send message to user by his sessionId
	sendMailToDevelopers : function(msg, cb) {
		//nodeMailers.createTestAccount((err, account) => {

	    //create reusable transporter object using the default SMTP transport
	    let transporter = nodeMailers.createTransport({
	        host: 'smtp.gmail.com',
	        port: 587,
	        secure: false, // true for 465, false for other ports
	        auth: {
	            user: "support@creatiosoft.com", // generated ethereal user
	            pass: "@creatiosoft"  // generated ethereal password
	        }
	    });

	    let currentTime = new Date();
	    let createdAt = Number(new Date());
	    let subjects = 'Error From '+configConstants.mailFromAppName+' ' + currentTime + "  " + createdAt;
	    // setup email data with unicode symbols
	    let mailOptions = {
	        from: '"support@creatiosoft.com" <foo@example.com>', // sender address
	        to: 'rishabh@creatiosoft.com,nishank@creatiosoft.com', // list of receivers
	        subject: subjects, // Subject line
	        text: msg // plain text body
	    };

	   // send mail with defined transport object
	    transporter.sendMail(mailOptions, (error, info) => {
	        if (error) {
	            return console.log(error);
	        }
	        console.log('Message sent: %s', info.messageId);
	        // Preview only available when sending through an Ethereal account
	        // console.log('Preview URL: %s', nodeMailers.getTestMessageUrl(info));

	        // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>
	        // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...
	    });
	//});
		cb("respose");
	},

	// ### send message to user by his sessionId
	sendMailToDevelopersForGameStart : function(msg, cb) {
		//nodeMailers.createTestAccount((err, account) => {

	    //create reusable transporter object using the default SMTP transport
	    let transporter = nodeMailers.createTransport({
	        host: 'smtp.gmail.com',
	        port: 587,
	        secure: false, // true for 465, false for other ports
	        auth: {
	            user: "support@creatiosoft.com", // generated ethereal user
	            pass: "@creatiosoft"  // generated ethereal password
	        }
	    });

	    let currentTime = new Date();
	    let createdAt = Number(new Date());
	    let subjects = 'Error From '+configConstants.mailFromAppName+' Game Start ' + currentTime + "  " + createdAt;
	    // setup email data with unicode symbols
	    let mailOptions = {
	        from: '"support@creatiosoft.com" <foo@example.com>', // sender address
	        to: 'digvijay.singh@playmoogley.com,nishank@playmoogley.com', // list of receivers
	        subject: subjects, // Subject line
	        text: msg // plain text body
	    };

	   // send mail with defined transport object
	    transporter.sendMail(mailOptions, (error, info) => {
	        if (error) {
	            return console.log(error);
	        }
	        console.log('Message sent: %s', info.messageId);
	        // Preview only available when sending through an Ethereal account
	        // console.log('Preview URL: %s', nodeMailers.getTestMessageUrl(info));

	        // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>
	        // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...
	    });
	//});
		cb("respose");
	}

};
