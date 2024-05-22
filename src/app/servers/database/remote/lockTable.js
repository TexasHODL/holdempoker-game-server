/*jshint node: true */
"use strict";

// This file is used to lock table opject
// > NEccessary to perform atomic operation
// > table will be released after completion of relevant operation

var _             = require("underscore"),
    async         = require("async"),
    performAction = require("./performAction"),
    keyValidator  = require("../../../../shared/keysDictionary"),
    mongodb       = require('../../../../shared/mongodbConnection'),
    zmqPublish    = require("../../../../shared/infoPublisher"),
    popupTextManager= require("../../../../shared/popupTextManager").falseMessages,
    popupTextManagerFromdb = require("../../../../shared/popupTextManager").dbQyeryInfo,
    stateOfX        = require("../../../../shared/stateOfX")
const configConstants = require('../../../../shared/configConstants');
var TaskList = require("../../../util/linkedList.js");
var taskLists = {};

var lockTable = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'lockTable';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

/**
 * The actual work that needs to be done
 * for every request that comes to this file
 * @method actualTask
 * @param  {Object}   params request params; normally channelId, playerId, actionName, other args if needed
 * @param  {Function} cb     callback of list
 */
function actualTask(params, cb) {
  
      async.waterfall([
        function (wCB){
          async.retry({times: parseInt(configConstants.lockTableRetryAttempts), interval: parseInt(configConstants.lockTableRetryInterval)},function (rcb, table){
            // Uncomment to check the table from inmemory db
            // mongodb.inMemoryDb.collection("tables").findOne({channelId: params.channelId}, function (err, data){});
            mongodb.inMemoryDb.collection("tables").findAndModify(
              {channelId: params.channelId, isOperationOn: false},
              [],
              {$set: {isOperationOn : true, actionName : params.actionName, operationStartTime: (new Date())}, $inc : {_v: 1}},
              {upsert: false, new: true }, function (err, table){
                if(!err){
                  serverLog(stateOfX.serverLogType.info, 'A table has been found from inmemory for action - ' + params.actionName + ' --> ' + JSON.stringify(table));

                  if(!table.value) {
                    rcb({success: false, channelId: params.channelId, info: "No table found in cache database!", isRetry: false, isDisplay: false}, null);
                    return false;
                  }

                  if(table.value){ // A table is found to perform operation

                    // serverLog(stateOfX.serverLogType.info, 'In memory table found for action - ' + params.actionName + ' ----> ' + JSON.stringify(_.omit(table.value, 'deck')));

                    // Perfom operation as table object has been locked
                    params.table = table.value;
                    // serverLog(stateOfX.serverLogType.info, 'About to divert request for action - ' + params.actionName);
                    performAction.divert(params, function (performActionResponse){
                      serverLog(stateOfX.serverLogType.info, 'Response after performing operation  - ' + JSON.stringify(performActionResponse));
                      if(performActionResponse.success) {
                        if(performActionResponse.table) {
                          performActionResponse.table.isOperationOn     = false;
                          performActionResponse.table._v                = performActionResponse.table._v + 1;
                          performActionResponse.table.operationEndTime  = (new Date());
                          rcb(null, performActionResponse);
                        } else {
                          serverLog(stateOfX.serverLogType.error, 'Table object missing after response from - ' + params.actionName);
                          mongodb.inMemoryDb.collection("tables").findOne({channelId: params.channelId}, function(err, table){
                            if(!err && table) {
                              mongodb.db.collection("lockTableRecord").insert({table: table, createdAt: new Date(), channelId: params.channelId, type: "TABLEOBJECTMISSING", response: performActionResponse, request: _.omit(params, 'self', 'session', 'channel')}, function(err, res){
                                if(!err && res) {
                                  serverLog(stateOfX.serverLogType.info, 'Lock table record inserted successfully in main memory!');
                                } else {
                                  serverLog(stateOfX.serverLogType.error, 'Unable to store lock table record in main memory!');
                                }
                              });
                            } else {
                              serverLog(stateOfX.serverLogType.error, 'Unable to get lock table from inMemory!');
                            }
                          });
                          cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManagerFromdb.DBFINDONE_PERFORMACTIONDIVERT_DBFINDANDMODIFY_ASYNCRETRY_ASYNCWATERFALL_KEYVALIDATORS_VALIDATEKEYSETS_LOCKTABLELOCK_LOCKTABLE + params.actionName});
                          //cb({success: false, info: 'Table object missing after response from - ' + params.actionName});
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
                              serverLog(stateOfX.serverLogType.info, 'Table successfully released !! - ' + JSON.stringify(performActionResponse));
                              performActionResponse.table = _.omit(performActionResponse.table, 'deck');
                              cb(performActionResponse);
                            } else{
                              serverLog(stateOfX.serverLogType.info, 'UNABLE TO RELESE TABLE!! - ' + JSON.stringify(performActionResponse));
                              cb("Error while releasing table update, false response for - " + params.methodName + " err - " + err);
                            }
                          }
                        );
                      }
                    });
                  } else {
                    // serverLog(stateOfX.serverLogType.error, 'Value from table request missing - ' + params.actionName + ' --> ' + JSON.stringify(table));
                    mongodb.inMemoryDb.collection("tables").findOne({channelId: params.channelId, isOperationOn:true}, function(err, table){
                      if(!err && table) {
                        mongodb.db.collection('lockTableRecord').findOne({channelId: params.channelId}, function(err, response) {
                          if(!err) {
                            if(!response) {
                              mongodb.db.collection("lockTableRecord").insert({table: table, createdAt: new Date(), channelId: params.channelId, type: "NOTFOUND", request: JSON.stringify(_.omit(params, 'self', 'session', 'channel'))}, function(err, res){
                                if(!err && res) {
                                  serverLog(stateOfX.serverLogType.info, 'Lock table record inserted successfully in main memory!');
                                } else {
                                  serverLog(stateOfX.serverLogType.error, 'Unable to store lock table record in main memory!');
                                }
                              });
                            } else {
                              serverLog(stateOfX.serverLogType.error, 'A lock table record already exists in main memory, skipping multiple insertion!');
                            }
                          } else {
                            serverLog(stateOfX.serverLogType.error, 'Unable to get lock table existing record from main memory!');
                          }
                        });
                      } else {
                        serverLog(stateOfX.serverLogType.error, 'Unable to get lock table from inMemory!');
                      }
                    });
                    rcb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManagerFromdb.DBFINDANDMODIFY_ASYNCRETRY_ASYNCWATERFALL_KEYVALIDATORS_VALIDATEKEYSETS_LOCKTABLELOCK_LOCKTABLE}, null);
                    //rcb({success: false, channelId: params.channelId, info: "The table in cache has been locked!"}, null);
                  }
                } else {
                  // serverLog(stateOfX.serverLogType.error, 'Error while getting table for ' + params.actionName + ' from inmemory !! - ' + JSON.stringify(err));
                  rcb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || "") ,info: popupTextManagerFromdb.DBFINDANDMODIFY_ASYNCRETRY_ASYNCWATERFALL_KEYVALIDATORS_VALIDATEKEYSETS_LOCKTABLELOCK_LOCKTABLE2 + JSON.stringify(err) },null);
                  //rcb({success: false, channelId: params.channelId, info: "Error while fetching cache table from database!" + JSON.stringify(err)}, null)
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
    
}

// ### Lock database to perform node operation and then unlock
// > Lock table object in order to perform any action
// > Update table object values and return table object to function
// > Release the collection after all the activity finished

/**
 * this function locks database to perform operation and then unlocks it
 * @method lock
 * @param  {Object}   params request json object
 * @param  {Function} cb     callback function
 */
lockTable.lock = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Locking table keys: - ' + JSON.stringify(_.keys(params)));
  params.serverType = "database";
  keyValidator.validateKeySets("Request", "database", "lockTableObject", params, function (validated){

    serverLog(stateOfX.serverLogType.error, 'Going to lock channel Id:  - ' + params.channelId + ' for action: ' + params.actionName);

    // Return function if there is no channelId passed while locking table
    if(!params.channelId) {
      serverLog(stateOfX.serverLogType.error, 'No channelId passed while locking table - ' + (params.channelId || ""));
      cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.KEYVALIDATORS_VALIDATEKEYSETS_LOCKTABLELOCK_LOCKTABLE});
      // cb({success: false, channelId: (params.channelId || ""), info: "No channelId passed while locking table!"});
      return false;
    }

    if(validated.success) {
      taskLists[params.channelId] = taskLists[params.channelId] || new TaskList();
      taskLists[params.channelId].push({params: params, cb: cb});
      if (taskLists[params.channelId].length <= 1) {
        doFirstTask(taskLists[params.channelId]);
      }
    } else {
      cb(validated);
    }
  });
};

/**
 * as the list of channelId gets a task
 * execute the first request
 * recursively calls for next request if found
 * @method doFirstTask
 * @param  {Object}    list linked list to store request task for each channelId
 */
var doFirstTask = function (list) {
  var task = list.firstElm();
  if (task) {
    actualTask(task.params, function (res) {
      task.cb(res);
      list.shift();
      if (list.length > 0) {
        doFirstTask(list);
      }
    });
  }
};

module.exports = lockTable;
