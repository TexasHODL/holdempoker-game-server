/*
* @Author: sushiljainam
* @Date:   2017-07-24 19:43:33
* @Last Modified by:   digvijay
* @Last Modified time: 2018-12-28 17:02:14
*/

/*jshint node: true */
"use strict";


// module.exports = function(app, opts) {
//   var service = {name: 'sPlugin'};
//   return service;
// };
var DevMailerService = require('../service/devMailerService');

// set a mailer servicea in app
module.exports = function(app, opts) {
  var service = new DevMailerService(app, opts);
  app.set('devMailer', service, true);
  service.name = '__devMailer__';
  return service;
};

