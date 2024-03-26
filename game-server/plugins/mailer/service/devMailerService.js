/*
* @Author: sushiljainam
* @Date:   2017-09-06 14:58:32
* @Last Modified by:   digvijay
* @Last Modified time: 2018-12-28 17:03:25
*/

/*jshint node: true */
"use strict";

var DevMailerService = function(app, opts) {
  this.app = app;
  this.opts = opts || {key: ""};
};

module.exports = DevMailerService;

// send a mail to dev
// if this is backend server
// route this to frontend server
DevMailerService.prototype.sendToDev = function(body, toEmail, subject) {
  if (!this.app.isFrontend()) {
    this.app.rpc.connector.sessionRemote.mailer({}, {fnName: "sendToDev", bodyString: errorToString(body) + ' server: '+ this.app.serverId, toEmail: toEmail, subject: subject}, function (err, res) {
      
    });
    return;
  }
  this.sendgrid = require('sendgrid');
  this.helper = this.sendgrid.mail;
	// if (typeof body != 'string') {
	// 	var body = JSON.stringify(body.stack);
	// }
	var toName = toName || '';
	var helper = this.helper;
  var toMail = new helper.Email((toEmail || "support@creatiosoft.com"), (toName || "Support Creatiosoft"));
  var fromMail = new helper.Email("support@creatiosoft.com", "Developers Creatiosoft");
  var subject = (this.opts.prefix || 'Dev') + ' - '+ (subject || "A mail for Server Developers - "+this.opts.fromName);
  var content = new helper.Content("text/html", errorToString(body) + ' server: '+ this.app.serverId);
  // var content = new helper.Content("text/html", "sushiljainam");

  var mailObject = new helper.Mail(fromMail, subject, toMail, content);

  sendEmail(mailObject, this.sendgrid(this.opts.key) ); // jsonData, client
};

// send mail to admin
// if this is backend server
// route this to frontend server
DevMailerService.prototype.sendToAdmin = function(body, toEmail, subject) {
  if (!this.app.isFrontend()) {
    this.app.rpc.connector.sessionRemote.mailer({}, {fnName: "sendToAdmin", bodyString: JSON.stringify(body) + ' server: '+ this.app.serverId, toEmail: toEmail, subject: subject}, function (err, res) {
      
    });
    return;
  }
  this.sendgrid = require('sendgrid');
  this.helper = this.sendgrid.mail;
	// if (typeof body != 'string') {
	// 	var body = JSON.stringify(body.stack);
	// }
	var toName = toName || '';
	var helper = this.helper;
  var toMail = new helper.Email((toEmail || "support@creatiosoft.com"), (toName || "Support Creatiosoft"));
  var fromMail = new helper.Email("support@creatiosoft.com", "Developers Creatiosoft");
  var subject = (subject || "A mail for Server Developers - "+this.opts.fromName);
  var content = new helper.Content("text/html", JSON.stringify(body) + ' server: '+ this.app.serverId);
  // var content = new helper.Content("text/html", "sushiljainam");

  var mailObject = new helper.Mail(fromMail, subject, toMail, content);

  sendEmail(mailObject, this.sendgrid(this.opts.key) ); // jsonData, client
};

// send to multiple emails
// if this is backend server
// route this to frontend server
DevMailerService.prototype.sendToAdminMulti = function(body, toEmail, subject) {
  if (!this.app.isFrontend()) {
    this.app.rpc.connector.sessionRemote.mailer({}, {fnName: "sendToAdminMulti", bodyString: JSON.stringify(body) + ' server: '+ this.app.serverId, toEmail: toEmail, subject: subject}, function (err, res) {
      
    });
    return;
  }
  this.sendgrid = require('sendgrid');
  this.helper = this.sendgrid.mail;

  var toName = toName || '';
  var helper = this.helper;
  var fromMail = new helper.Email("support@creatiosoft.com", "Developers Creatiosoft");
  var subject = (subject || "A mail for Server Developers - "+this.opts.fromName);
  var content = new helper.Content("text/html", JSON.stringify(body) + ' server: '+ this.app.serverId);
  // var content = new helper.Content("text/html", "sushiljainam");

  var mailObject = new helper.Mail();
  mailObject.setFrom(fromMail);
  mailObject.setSubject(subject);
  mailObject.addContent(content);
  if ((toEmail instanceof Array) && toEmail.length > 0 ) {
    for (var i = 0; i < toEmail.length; i++) {
      var toMail = new helper.Email(toEmail[i], toEmail[i]);
      var personalization = new helper.Personalization();
      personalization.addTo(toMail);
      mailObject.addPersonalization(personalization);
      // console.error(mailObject.personalizations[i].tos)
    }
  } else {
    var toMail = new helper.Email("support@creatiosoft.com", "Support Creatiosoft");
    var personalization = new helper.Personalization();
    personalization.addTo(toMail);
    mailObject.addPersonalization(personalization);
    // mailObject = new helper.Mail(fromMail, subject, toMail, content);
  }

  // console.error(Object.keys(mailObject))
  // console.error(mailObject)
  // console.error(mailObject.personalizations[0].tos)
  sendEmail(mailObject, this.sendgrid(this.opts.key)); // jsonData, client
};

// used by all
DevMailerService.prototype.finalSend = function(params) {
  // console.error('finalSend called');
  // this.sendgrid = require('sendgrid');
  //sendEmail(mailObj, this.sendgrid(this.opts.key));
  if (this[params.fnName] instanceof Function) {
    this[params.fnName](params.bodyString, params.toEmail, params.subject);
  }
};

// used by all
// send mail
function sendEmail(jsonData, client, cb) {
  // console.error('sendEmail called');
	var req = client.emptyRequest({method: 'POST', path: '/v3/mail/send', body: jsonData.toJSON()});
	client.API(req, function (err, res) {
    // console.log(err, res)
		if (cb instanceof Function) {
			cb(err, res);
		}
	});
}

// convert error to string
function errorToString(e) {
  if (typeof e === 'string') {
    return e;
  }
	return '' + '; message: ' + (e.message || "No message") + "; name: "  + (e.name || "No name") + "; stack: " + (e.stack ? JSON.stringify(e.stack): "No stack");
}
