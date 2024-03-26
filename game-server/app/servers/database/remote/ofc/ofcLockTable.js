/*jshint node: true */
"use strict";

// This file is used to lock table opject
// > NEccessary to perform atomic operation
// > table will be released after completion of relevant operation

var _             = require('underscore'),
    async         = require('async'),
    performAction = require('./ofcPerformAction'),
    keyValidator  = require('../../../../../shared/keysDictionary'),
    mongodb       = require('../../../../../shared/mongodbConnection'),
    zmqPublish    = require('../../../../../shared/infoPublisher'),
    stateOfX      = require('../../../../../shared/stateOfX')

const configConstants = require('../../../../../shared/configConstants');

var ofcLockTable = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'ofcLockTable';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

// ### Lock database to perform node operation and then unlock
// > Lock table object in order to perform any action
// > Update table object values and return table object to function
// > Release the collection after all the activity finished

ofcLockTable.lock = function (params, cb) {
  // serverLog(stateOfX.serverLogType.info, 'Locking table - ' + JSON.stringify(params));
  params.serverType = "database";
  keyValidator.validateKeySets("Request", "database", "ofcLockTableObject", params, function (validated){
    if(validated.success) {
      async.waterfall([
        function (wCB){
          async.retry({times: configConstants.ofcLockTableRetryAttempts, interval: configConstants.ofcLockTableRetryInterval},function (rcb, table){
            // Uncomment to check the table from inmemory db
            // mongodb.inMemoryDb.collection("tables").findOne({channelId: params.channelId}, function (err, data){});
            mongodb.inMemoryDb.collection("tables").findAndModify(
              {channelId: params.channelId, isOperationOn: false},
              [],
              {$set: {isOperationOn : true, actionName : params.actionName, operationStartTime: (new Date())}, $inc : {_v: 1}},
              {upsert: false, new: true }, function (err, table){
                if(!err){
                  // serverLog(stateOfX.serverLogType.info, 'A table has been found from inmemory for action - ' + params.actionName + ' --> ' + JSON.stringify(table));

                  if(table.value){ // A table is found to perform operation

                    // serverLog(stateOfX.serverLogType.info, 'In memory table found for action - ' + params.actionName + ' ----> ' + JSON.stringify(_.omit(table.value, 'deck')));

                    // Perfom operation as table object has been locked
                    params.table = table.value;
                    // serverLog(stateOfX.serverLogType.info, 'About to divert request for action - ' + params.actionName);
                    performAction.divert(params, function (performActionResponse){
                      // serverLog(stateOfX.serverLogType.info, 'Response after performing operation  - ' + JSON.stringify(performActionResponse));
                      if(performActionResponse.success) {
                        if(performActionResponse.table) {
                          performActionResponse.table.isOperationOn     = false;
                          performActionResponse.table._v                = performActionResponse.table._v + 1;
                          performActionResponse.table.operationEndTime  = (new Date());
                          rcb(null, performActionResponse);
                        } else {
                          // serverLog(stateOfX.serverLogType.error, 'Table object missing after response from - ' + params.actionName)
                          cb({success: false, info: 'Table object missing after response from - ' + params.actionName});
                        }
                      } else {
                        // Release table object in case of failure responses as well
                        // serverLog(stateOfX.serverLogType.info, '==== FALSE RESPONSE AFTER TABLE LOCK || RELEASE TABLE =====')
                        mongodb.inMemoryDb.collection("tables").findAndModify(
                          {channelId: params.channelId, isOperationOn:true, actionName: params.actionName},
                          [],
                          {$set: {isOperationOn: false, operationEndTime: (new Date())}, $inc: {_v: 1}},
                          {upsert: false, new: true}, function (err, table){
                            if(!err && table){
                              // serverLog(stateOfX.serverLogType.info, 'Table successfully released !! - ' + JSON.stringify(performActionResponse))
                              // performActionResponse.table = _.omit(performActionResponse.table, 'deck');
                              cb(performActionResponse);
                            } else{
                              cb("Error while releasing table update, false response for - " + params.methodName + " err - " + err);
                            }
                          }
                        );
                      }
                    });
                  } else {
                    // serverLog(stateOfX.serverLogType.error, 'Value from table request missing - ' + params.actionName + ' --> ' + JSON.stringify(table));
                    rcb({success: false, channelId: params.channelId, info: "No table found for operation or might locked!"}, null);
                  }
                } else {
                  // serverLog(stateOfX.serverLogType.error, 'Error while getting table for ' + params.actionName + ' from inmemory !! - ' + JSON.stringify(err));
                  rcb(err, null);
                }
              }
            );
          }, function (err, actionResponse){
            if(!err && actionResponse){
              wCB(null, actionResponse);
            } else {
              wCB(err,null);
            }
          });
        },

        function (actionResponse, wCB){ // Update current values of table inmemory database
          // serverLog(stateOfX.serverLogType.info, 'About to update table in memory - ' + JSON.stringify(actionResponse.table))

          mongodb.inMemoryDb.collection("tables").findAndModify(
            // {channelId: params.channelId, isOperationOn:true, actionName: params.actionName},
            {channelId: params.channelId, isOperationOn:true, actionName: params.actionName},
            [],
            {$set: actionResponse.table},
            {upsert: false, new: true}, function (err, table){
              if(!err && table){
                wCB(null, {table: table, data: actionResponse.data});
              } else{
                wCB(err,null);
              }
            }
          );
        }],

        function (err, wcbRes){ // All the above operations performed
        if(!err && wcbRes){
          wcbRes.table.value = _.omit(wcbRes.table.value, 'deck');
          // serverLog(stateOfX.serverLogType.info, 'After updating table object - ' + JSON.stringify(wcbRes.table.value));

          cb({success: true, table: wcbRes.table.value, data: wcbRes.data});
        } else {
          cb(err);
        }
      });
    } else {
      cb(validated);
    }
  });
};

module.exports = ofcLockTable;
