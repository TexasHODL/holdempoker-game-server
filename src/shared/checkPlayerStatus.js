/*
 * @Author: namanjain
 * @Date:   2019-12-06 17:12:00
 * @Last Modified by:   namanjain
 * @Last Modified time: 2019-12-06 20:14:09
 */
var db = require("./model/dbQuery.js");
var checkPlayerStatus = {};

/**
 * method used to check the player status for sending mails,if player is blocked it returns false
 * and if not or not exist then it returns true
 * @method
 * @author Naman Jain
 * @date    2019-12-06
 * @email   naman.jain@pokersd.com
 * @project pokerSd
 * @param   {[type]}               playerEmail [description]
 * @return  {[type]}                           [description]
 */
checkPlayerStatus.checkPlayerStateWithEmail = (playerEmail, cb) => {
  console.log("dwadada", playerEmail);
  const query = {};
  // query.emailId = eval('/'+ playerEmail +'/i');
  query.emailId = playerEmail;
  console.log("query -->", query);
  db.findUser(query, function (err, player) {
    if (!err && !!player) {
      console.log("here success");
      return cb({ success: player.isBlocked });
    } else {
      console.log("here fail", err, player);
      return cb({ success: false });
    }
  });
};

checkPlayerStatus.checkPlayerStateWithMobile = (playerMobile, cb) => {
  console.log("inside", playerMobile);
  const query = {};
  if (playerMobile.length == 10) query.mobileNumber = playerMobile;
  else query.mobileNumber = playerMobile.substring(2);
  db.findUser(query, function (err, player) {
    if (!err && !!player) {
      return cb({ success: player.isBlocked });
    } else {
      return cb({ success: false });
    }
  });
};

module.exports = checkPlayerStatus;
