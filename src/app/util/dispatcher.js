/*jshint node: true */
"use strict";

const crc = require("crc");

// select an item from list based on key
module.exports.dispatch = function (key, list) {
  let index = 0;
  if (!!list) {
    index = Math.abs(crc.crc32(key)) % list.length;
  }
  return list[index];
};
