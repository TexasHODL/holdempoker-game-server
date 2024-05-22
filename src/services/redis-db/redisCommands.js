/*
 * File: redisCommands.js
 * Project: poker-gameserver
 * File Created: Monday, 1st March 2021
 * Author: digvijay (rathore.digvijay10@gmail.com)
 * -----
 * Last Modified: Wed Mar 03 2021
 * Modified By: digvijay
 */

const { redisClient } = require("./redisConnect");

const redisCommands = {};

redisCommands.setOnlinePlayers = function setOnlinePlayers(playerId, cb) {
  redisClient.sadd("online_players", playerId, function (err, result) {
    console.log("here");
    if (err) {
      console.log("Error while setting online player", err);
      return cb(err);
    }
    cb(null, result);
  });
};

redisCommands.getOnlinePlayers = function getOnlinePlayers(cb) {
  redisClient.smembers("online_players", function (err, result) {
    if (err) {
      return cb(err);
    }
    cb(null, result);
  });
};

redisCommands.removePlayerOnline = function removePlayerOnline(playerId, cb) {
  redisClient.srem("online_players", playerId, function (err, result) {
    if (err) {
      return cb(err);
    }
    cb(null, result);
  });
};

module.exports = redisCommands;
