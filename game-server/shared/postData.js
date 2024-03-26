/*
* @Author: digvijay
* @Date:   2018-09-20 11:11:03
* @Last Modified by:   digvijay
* @Last Modified time: 2018-12-31 11:39:24
*/

/*jshint node: true */
'use strict';


/**
 * This file was used for monitoring the time of the request and response.
 */


var request = require('request');

var  ip ="192.168.2.145";
var port = "3002";

var url = "http://"+ip+":"+port+"/saveEntry" ;

module.exports.saveData = function(data){
  return;
  data.dbName = "donaldLocal";
	request.post({url: url, form: data}, function(err,httpResponse,body){ 
		console.log("created", err, body);
	 });
};

