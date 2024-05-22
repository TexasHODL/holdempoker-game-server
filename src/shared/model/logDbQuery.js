/*jshint node: true */
"use strict";

var mongodb = require("../mongodbConnection.js");
var ObjectID = require("mongodb").ObjectID;
var postData = require("../postData.js");
const configConstants = require("../configConstants.js");

var remote = {};

//not used anywhere (extra code) Feb 9 2019 //digvijay
// remote.insertVideoLog = function(channelId, roundId, logData, callback){
//   var data = {
//     channelId   : channelId,
//     roundId     : roundId,
//     logData     : logData,
//     createdAt   : new Date().getTime()
//   };
//   mongodb.logDB.collection("videoLog").insert(data,function(err,response){
//     callback(err,response);
//   });
// };

// query used to list player hand history records
remote.listDataInPlayerHandHistory = function (query, callback) {
     console.log(
          "listDataInPlayerHandHistory log query",
          JSON.stringify(query)
     );
     var skip = query.skip || 0;
     var limit = query.limit || 0;
     delete query.skip;
     delete query.limit;
     mongodb.logDB
          .collection("handHistory")
          .find(query)
          .skip(skip)
          .limit(limit)
          .toArray(function (err, result) {
               callback(err, result);
          });
};

// query used to count the player hand History records
remote.countDataInPlayerHandHistory = function (query, callback) {
     console.log(
          "countDataInPlayerHandHistory log query",
          JSON.stringify(query)
     );
     mongodb.logDB
          .collection("handHistory")
          .count(query, function (err, result) {
               callback(err, result);
          });
};
/*-------------------------- video query start ----------------------*/

remote.insertNextVideo = function (query, historyContent, callback) {
     mongodb.logDB
          .collection("videos")
          .findAndModify(
               query,
               [],
               { $push: { history: historyContent } },
               { new: true },
               function (err, result) {
                    callback(err, result);
               }
          );
};

remote.updateVideo = function (query, updatedData, callback) {
     mongodb.logDB
          .collection("videos")
          .update(query, { $set: updatedData }, function (err, result) {
               callback(err, result);
          });
};

//deprecated (redundant query) Feb 9 2019 //digvijay
// remote.findVideoById = function(id, callback) {
//   mongodb.logDB.collection('videos').findOne({_id: ObjectID(id)}, function (err, result) {
//     callback(err, result);
//   });
// };

remote.findOneVideo = function (query, callback) {
     mongodb.logDB.collection("videos").findOne(query, function (err, result) {
          callback(err, result);
     });
};

remote.insertVideo = function (video, callback) {
     mongodb.logDB.collection("videos").insert(video, function (err, result) {
          callback(err, result.ops[0]);
     });
};

/*--------------------------- video query end -------------------------------*/

/*--------------------------- handtab query start -------------------------------*/

remote.createHandTab = function (channelId, roundId, handId, callback) {
     var data = {
          channelId: channelId,
          roundId: roundId,
          handId: handId,
          active: false,
          createdAt: new Date().getTime(),
     };
     mongodb.logDB.collection("handTab").insert(data, function (err, response) {
          callback(err, response);
     });
};

remote.updateHandTab = function (channelId, roundId, data, callback) {
     mongodb.logDB
          .collection("handTab")
          .findAndModify(
               { channelId: channelId, roundId: roundId },
               {},
               { $set: data },
               { new: true },
               function (err, response) {
                    callback(err, response);
               }
          );
};

remote.getHandTab = function (channelId, callback) {
     mongodb.logDB
          .collection("handTab")
          .find(
               { channelId: channelId, active: true },
               { pot: 1, hands: 1, handHistoryId: 1, channelId: 1, videoId: 1 }
          )
          .sort({ _id: -1 })
          .limit(configConstants.handTabRecordCount)
          .toArray(function (err, result) {
               callback(err, result);
          });
};

remote.findByHandId_handTab = function (query, callback) {
     mongodb.logDB
          .collection("handTab")
          .find(Object.assign(query, { active: true }))
          .toArray(function (err, result) {
               callback(err, result);
          });
};

remote.getHandHistoryByVideoId = function (videoId, callback) {
     mongodb.logDB
          .collection("handTab")
          .findOne({ videoId: videoId }, function (err, result) {
               callback(err, result);
          });
};

/*--------------------------- handtab query end -------------------------------*/

/*--------------------------- hand history query start -----------------------*/

remote.insertHandHistory = function (
     channelId,
     handId,
     tableName,
     tableVariation,
     stakes,
     players,
     playerInfo,
     roundId,
     roundCount,
     startedAt,
     finishedAt,
     historyLog,
     callback
) {
     mongodb.logDB
          .collection("handHistory")
          .insert(
               {
                    channelId: channelId,
                    handId: handId,
                    tableName: tableName,
                    tableVariation: tableVariation,
                    stakes: stakes,
                    players: players,
                    playerInfo: playerInfo,
                    roundId: roundId,
                    roundCount: roundCount,
                    startedAt: startedAt,
                    finishedAt: finishedAt,
                    historyLog: historyLog,
               },
               function (err, result) {
                    callback(err, result);
               }
          );
};

//deprecated (redundant query) Feb 9 2019 //digvijay
// remote.getHandHistory = function(handHistoryId,callback){
//     mongodb.logDB.collection("handHistory").findOne({'_id':ObjectID(handHistoryId)},function(err,result){
//       callback(err,result);
//     });
// };

remote.findOneHandHistory = function (query, callback) {
     mongodb.logDB
          .collection("handHistory")
          .findOne(query, function (err, result) {
               callback(err, result);
          });
};

/*--------------------- hand history query end -----------------------*/

/*------------------- game activity query start -----------------------*/

remote.createUserActivityGame = function (activity, callback) {
     // if(activity.subCategory == "START GAME" || activityObject.subCategory == "GAME OVER"){
     //   mongodb.logDB.collection('test').insert(activity, function (err, result) {
     //   callback(err, result.ops[0]);
     // });
     // }

     if (
          activity.subCategory == "START GAME" ||
          activity.subCategory == "GAME OVER"
     ) {
          console.trace("game over");
          console.log(activity);
          mongodb.logDB
               .collection("gameActivity")
               .insert(activity, function (err, result) {
                    callback(err, result.ops[0]);
               });
     } else {
          // mongodb.logDB.collection('gameActivityReductant').insert(activity, function (err, result) {
          //     callback(err, result.ops[0]);
          //   });
     }
};

/*------------------- game activity query end -----------------------*/

/**
 * this is a generic query function for logDB
 * @method genericQuery
 * @param  {String}     col      collection name
 * @param  {String}     query    query name
 * @param  {Object}     data     array of inputs for query function
 * @param  {Function}   callback callback - function(err, res){...}
 */
remote.genericQuery = function (col, query, data, callback) {
     if (!(typeof col === "string")) {
          return callback(new Error("wrong collection name"));
     }
     if (!(mongodb.logDB.collection(col)[query] instanceof Function)) {
          return callback(new Error("wrong query name"));
     }
     if (!(typeof data === "object")) {
          return callback(new Error("data should be array object"));
     }
     mongodb.logDB
          .collection(col)
          [query].apply(mongodb.logDB.collection(col), data.concat([callback]));
};

/*------------------- user activity query start -----------------------*/

// remote.createUserActivity = function(activity,callback) {
//   mongodb.logDB.collection('userActivity').insert(activity, function (err, result) {
//       callback(err, result && result.ops && result.ops[0]); // error - result may be null
//   });
// };

// remote.getUserActivityList = function(filterdata,currentpage, pagelimit, callback){
//   console.log('filterdata', JSON.stringify(filterdata));
//   mongodb.logDB.collection('userActivity').aggregate([
//     {$match: filterdata},
//     { $skip : pagelimit*(currentpage - 1) },
//     { $limit : pagelimit },
//     {
//       $lookup : {
//         from            : "users",
//         localField      : "playerId",
//         foreignField    : "playerId",
//         as              : "userdetails"
//       }
//     },
//     {
//         $unwind: "$userdetails"
//     }
//   ]).toArray(function(err, result){
//     console.log('user act', JSON.stringify(result));
//     callback(err, result);
//   });
// };

// remote.countUserActivityList = function(filterdata, callback){
//   console.log('countUserActivityList', JSON.stringify(filterdata));
//   mongodb.logDB.collection('userActivity').count(filterdata, function(err, result){
//     console.log('count result', result);
//     callback(err, result);
//   });
// };

remote.createTipLog = function (data, callback) {
     console.log("createTipLog", JSON.stringify(data));
     mongodb.logDB.collection("usersTipHistory").insert(data, callback);
};

remote.calculateChipsMegaCircle = function (filter, callback) {
     console.log(
          "calculateChipsMegaCircleDb log query",
          JSON.stringify(filter)
     );
     mongodb.logDB
          .collection("playerArchive")
          .findOne(filter, function (err, result) {
               callback(err, result);
          });
};

remote.findPlayerFromPlayerArchive = function (filter, callback) {
     console.log(
          "findPlayerFromPlayerArchive log query",
          JSON.stringify(filter)
     );
     mongodb.logDB
          .collection("playerArchive")
          .find(filter)
          .toArray(function (err, result) {
               callback(err, result);
          });
};

remote.findByHandId_gameActivity = function (
     roundNumber,
     projection,
     callback
) {
     mongodb.logDB
          .collection("gameActivity")
          .find(
               {
                    subCategory: "GAME OVER",
                    "rawResponse.params.table.roundNumber": roundNumber,
               },
               projection
          )
          .toArray(function (err, result) {
               callback(err, result);
          });
};

remote.findDataForRoundIdChannelId = function (filter, projection, callback) {
     console.log(
          "findDataForRoundIdChannelId log query",
          JSON.stringify(filter)
     );
     mongodb.logDB
          .collection("gameActivity")
          .find(filter, projection)
          .toArray(function (err, result) {
               callback(err, result);
          });
};

remote.findDataFromGameActivity = function (
     filter,
     projection,
     skip,
     limit,
     callback
) {
     // console.log('findDataFromGameActivity log query', JSON.stringify(filter));
     mongodb.logDB
          .collection("gameActivity")
          .find(filter, projection)
          .skip(skip)
          .limit(limit)
          .sort({ createdAt: -1 })
          .toArray(function (err, result) {
               callback(err, result);
          });
};

remote.countDataFromGameActivity = function (filter, callback) {
     // console.log('countDataFromGameActivity log query', JSON.stringify(filter));
     mongodb.logDB
          .collection("gameActivity")
          .count(filter, function (err, result) {
               callback(err, result);
          });
};

/*------------------- user activity query end -----------------------*/

remote.saveTableUpdateRecord = function (data, cb) {
     mongodb.logDB
          .collection("tableUpdateRecords")
          .insert(data, function (err, result) {
               console.log("err, result====", err, result);
               cb(err, result);
          });
};

remote.getTableUpdateRecordsCount = function (query, cb) {
     console.log("Inside getTableUpdateRecordsCount DB Query ", query);
     mongodb.logDB
          .collection("tableUpdateRecords")
          .count(query, function (err, result) {
               // console.log("err, result====", err, result);
               cb(err, result);
          });
};

remote.getTableUpdateRecords = function (query, cb) {
     // console.log("Inside getTableUpdateRecords DB Query ", query)
     var skip = query.skip;
     var limit = query.limit;
     delete query.skip;
     delete query.limit;
     mongodb.logDB
          .collection("tableUpdateRecords")
          .find(query)
          .skip(skip)
          .limit(limit)
          .sort({ _id: -1 })
          .toArray(function (err, result) {
               // console.log("err, result====", err, result);
               cb(err, result);
          });
};

remote.insertBlockedPlayerData = function (data, cb) {
     mongodb.logDB
          .collection("playerBlockedRecords")
          .insert(data, function (err, result) {
               console.log("err, result====", err, result);
               cb(err, result);
          });
};

remote.countPlayerBannedData = function (query, cb) {
     console.log("querty----------------", query);
     mongodb.logDB
          .collection("playerBlockedRecords")
          .count(query, function (err, result) {
               console.log("result", result);
               cb(err, result);
          });
};

remote.listPlayerBannedData = function (query, cb) {
     console.log("query---------", query);
     var skip = query.skip;
     var limit = query.limit;
     delete query.skip;
     delete query.limit;
     mongodb.logDB
          .collection("playerBlockedRecords")
          .find(query)
          .skip(skip)
          .limit(limit)
          .toArray(function (err, result) {
               console.log("result", result);
               cb(err, result);
          });
};

remote.insertPlayerLoginData = function (query, update, cb) {
     mongodb.logDB
          .collection("playerLoginData")
          .update(query, update, { upsert: true }, function (err, result) {
               console.log(
                    "inside query to insert player logindata-",
                    err,
                    result
               );
               cb(err, result);
          });
};

remote.findPlayerLoginData = function (query, cb) {
     mongodb.logDB
          .collection("playerLoginData")
          .findOne(query, function (err, result) {
               cb(err, result);
          });
};

remote.getHandsPlayedInSpecificRound = function (query, cb) {
     mongodb.logDB
          .collection("gameActivity")
          .count(
               {
                    createdAt: { $gte: query.startTime, $lte: query.endTime },
                    subCategory: "GAME OVER",
                    "rawResponse.params.table.players": {
                         $elemMatch: {
                              lastRoundPlayed: "PREFLOP",
                              playerName: query.playerName,
                              state: "PLAYING",
                         },
                    },
                    channelId: { $in: query.channelId },
               },
               function (err, result) {
                    cb(err, result);
               }
          );
};

remote.getHandRaceWinners = function (query, cb) {
     mongodb.logDB
          .collection("gameActivity")
          .aggregate([
               { $match: query },
               {
                    $project: {
                         "rawResponse.params.table.players": {
                              $filter: {
                                   input: "$rawResponse.params.table.players",
                                   as: "item",
                                   cond: {
                                        $and: [
                                             {
                                                  $eq: [
                                                       "$$item.state",
                                                       "PLAYING",
                                                  ],
                                             },
                                        ],
                                   },
                              },
                         },
                    },
               },
               { $unwind: "$rawResponse.params.table.players" },
               {
                    $group: {
                         _id: {
                              userName:
                                   "$rawResponse.params.table.players.playerName",
                              pId: "$rawResponse.params.table.players.playerId",
                         },
                         myCount: { $sum: 1 },
                    },
               },
               { $sort: { myCount: -1 } },
          ])
          .toArray(function (err, result) {
               cb(err, result);
          });
};

remote.getSpecificPlayerHands = function (query, playerId, cb) {
     mongodb.logDB
          .collection("gameActivity")
          .aggregate([
               { $match: query },
               {
                    $project: {
                         "rawResponse.params.table.players": {
                              $filter: {
                                   input: "$rawResponse.params.table.players",
                                   as: "item",
                                   cond: {
                                        $and: [
                                             {
                                                  $eq: [
                                                       "$$item.state",
                                                       "PLAYING",
                                                  ],
                                             },
                                             {
                                                  $eq: [
                                                       "$$item.playerId",
                                                       playerId,
                                                  ],
                                             },
                                        ],
                                   },
                              },
                         },
                    },
               },
               { $unwind: "$rawResponse.params.table.players" },
               {
                    $group: {
                         _id: {
                              userName:
                                   "$rawResponse.params.table.players.playerName",
                              pId: "$rawResponse.params.table.players.playerId",
                         },
                         myCount: { $sum: 1 },
                    },
               },
               { $sort: { myCount: -1 } },
          ])
          .toArray(function (err, result) {
               cb(err, result);
          });
};

remote.saveApiLog = function (data, cb) {
     mongodb.logDB.collection("webApiLog").insert(data, function (err, result) {
          cb(err, result);
          console.log("save api log call");
     });
};

for (var key in remote) {
     // console.log("===length",key, remote[key].length);

     module.exports[key] = function (key) {
          var args = [].slice.call(arguments);
          args.shift();
          var fn = args.pop();

          // console.log("---line 2382", args, key)

          var startTime = Number(new Date());
          args.push(function (err, result) {
               var endTime = Number(new Date());
               var gap = endTime - startTime;
               // console.log("logDbQuery----gap", gap, key)
               // post analyticcs
               var data = {};
               data.section = "logDbQuery_" + key;
               data.time = gap;
               data.size = 0;
               postData.saveData(data);
               fn(err, result);
          });
          remote[key].apply(null, args);
     }.bind(null, key);
}
