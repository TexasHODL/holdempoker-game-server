/*jshint node: true */
"use strict";

const Redis = require("ioredis");
const config = {
  host: "localhost",
  port: "6379",
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
