/*jshint node: true */
"use strict";

var filterChat = {};
var db = require("./model/dbQuery.js");

var filters = {};

// find spam words
// filter chat message
// put stars in it
filterChat.filter = function (chatString, cb) {
  //console.error(chatString);
  // chatString = chatString.toLowerCase(); // REMOVED - as why change people's messages
  // var strarr = chatString.split(" ");
  db.findAllSpamWords(function (err, response) {
    console.log("abusive words on server", response);
    if (err) {
      cb(err);
    } else {
      filters =
        !!response && response.length > 0 ? response[0].blockedWords : [];
      ////console.log(chatString,'filters', filters)
      // forEach (var bWord in filters) {
      // console.log(bWord)
      // 	chatString = chatString.replace(bWord, "***");
      // }
      for (var i = 0; i < filters.length; i++) {
        var word = new RegExp("\\b" + filters[i] + "\\b", "ig");

        chatString = chatString.replace(word, "***");
      }
      // chatString = strarr.join(" ");
      // chatString = chatString.charAt(0).toUpperCase() + chatString.slice(1)
      cb(null, chatString);
    }
  });
};

module.exports = filterChat;
