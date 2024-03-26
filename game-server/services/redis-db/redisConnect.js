/*
 * File: redisConnect.js
 * Project: poker-gameserver
 * File Created: Monday, 1st March 2021
 * Author: digvijay (rathore.digvijay10@gmail.com)
 * -----
 * Last Modified: Mon Mar 01 2021
 * Modified By: digvijay
 */


const redis = require("redis");

const redisManager = {};

redisManager.dbConnect = function dbConnect(opts, cb) {

    const client = redis.createClient(process.env.REDIS_PORT, process.env.REDIS_HOST, {});

    client.on("error", function (error) {
        console.error(error);
        cb('REDIS-CLIENT ERROR');
    });
    client.on("end", function (error) {
        console.error(error);
        cb('REDIS-CLIENT END');
    });

    client.on("ready", function (error) {
        console.error(error);
        redisManager.redisClient = client;
        cb(null, client);
    });
}

module.exports = redisManager;