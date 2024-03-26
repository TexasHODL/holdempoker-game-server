/*jshint node: true */
"use strict";

const Redis = require('ioredis');
const config = {
    host: 'localhost',//'redis-10185.c252.ap-southeast-1-1.ec2.cloud.redislabs.com',
                port: '6379',
//    password: '72oYtHC0lIj0DnXBRtSj4sIJjY4KbNck'
    // username: "default", // needs Redis >= 6
    // password: "my-top-secret",
    // db: 0, // Defaults to 0
};
const redisClient = new Redis(config);

module.exports.getData = async function (key) {
    try {
        const result = await redisClient.get(key);
        return result;
    } catch (error) {
        console.error(error);
        return { error: "Can't get data" };
    }
};

module.exports.setData = async function (key, value) {
    try {
        const result = await redisClient.set(key, value);
        return result;
    } catch (error) {
        console.error(error);
        return { error: "Can't set data" };
    }
};
