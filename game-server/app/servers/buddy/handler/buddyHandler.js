/*
 * File: buddyHandler.js
 * Project: poker-gameserver
 * File Created: Sunday, 7th February 2021
 * Author: Digvijay (rathore.digvijay10@gmail.com)
 * -----
 * Last Modified: Fri Mar 05 2021
 * Modified By: Digvijay
 */

const keyValidator = require('../../../../shared/keysDictionary');

const Handler = function (app) {
    this.app = app;
}

module.exports = function (app) {
    return new Handler(app);
}

var handler = Handler.prototype;

/**
 * To send friend request.
 * @param {Object} msg playerId, friendId
 * @param {Object} session session object
 * @param {Function} next callback function
 */
handler.sendFriendRequest = function (msg, session, next) {
    console.log("inside send friend request -> ", msg);
    const self = this;
    keyValidator.validateKeySets("Request", "buddy", "sendFriendRequest", msg, function (validated) {
        if (validated.success) {
            self.app.rpc.buddy.buddyRemote.sendFriendRequest(session, msg, function (sendRequestResponse) {
                if (sendRequestResponse.success) {
                    // broadcast
                    self.app.rpc.connector.entryRemote.sendMessageToUser(session, msg.friendId, sendRequestResponse.playerInfo, 'friendRequestReceived', function (info) {
                        console.log("broadcast info " + info);
                    })
                }
                next(null, sendRequestResponse);
            })
        } else {
            next(null, validated);
        }
    });
}


/**
 * get friend request received
 * @param {Object} msg playerId
 * @param {Object} session 
 * @param {Function} next 
 */
handler.getFriendRequests = function (msg, session, next) {
    const self = this;
    keyValidator.validateKeySets("Request", "buddy", "getFriendRequests", msg, function (validated) {
        if (validated.success) {
            self.app.rpc.buddy.buddyRemote.getFriendRequests(session, msg, function (getFriendRequestResponse) {
                next(null, getFriendRequestResponse);
            })
        } else {
            next(null, validated);
        }
    });
}


/**
 * Accept friend request
 * @param {Object} msg playerId, friendId
 * @param {Object} session 
 * @param {Function} next 
 */
handler.acceptFriendRequest = function (msg, session, next) {
    const self = this;
    keyValidator.validateKeySets("Request", "buddy", "acceptFriendRequest", msg, function (validated) {
        if (validated.success) {
            self.app.rpc.buddy.buddyRemote.acceptFriendRequest(session, msg, function (acceptFriendRequestResponse) {
                next(null, acceptFriendRequestResponse);
            })
        } else {
            next(null, validated);
        }
    });
}

/**
 * reject friend request
 * @param {Object} msg playerId, friendId
 * @param {Object} session
 * @param {Function} next
 */
handler.rejectFriendRequest = function (msg, session, next) {
    const self = this;
    keyValidator.validateKeySets("Request", "buddy", "rejectFriendRequest", msg, function (validated) {
        if (validated.success) {
            self.app.rpc.buddy.buddyRemote.rejectFriendRequest(session, msg, function (rejectFriendResponse) {
                next(null, rejectFriendResponse);
            })
        } else {
            next(null, validated);
        }
    });
}

/**
 * search player with username
 * @param {Object} msg userName, playerId
 * @param {Object} session
 * @param {Function} next
 */
handler.searchPlayer = function (msg, session, next) {
    const self = this;
    keyValidator.validateKeySets("Request", "buddy", "searchPlayer", msg, function (validated) {
        if (validated.success) {
            self.app.rpc.buddy.buddyRemote.searchPlayer(session, msg, function (searchPlayerResponse) {
                next(null, searchPlayerResponse);
            })
        } else {
            next(null, validated);
        }
    })
}

/**
 * Get friend list
 * @param {Object} msg playerId
 * @param {Object} session
 * @param {Function} next
 */
handler.getFriendList = function (msg, session, next) {
    const self = this;
    keyValidator.validateKeySets("Request", "buddy", "getFriendList", msg, function (validated) {
        if (validated.success) {
            self.app.rpc.buddy.buddyRemote.getFriendList(session, msg, function (friendListResponse) {
                next(null, friendListResponse);
            })
        } else {
            next(null, validated);
        }
    })
}

/**
 * Remove friend
 * @param {Object} msg playerId, friendId
 * @param {Object} session 
 * @param {Function} next 
 */
handler.removeFriend = function (msg, session, next) {
    const self = this;
    keyValidator.validateKeySets("Request", "buddy", "removeFriend", msg, function (validated) {
        if (validated.success) {
            self.app.rpc.buddy.buddyRemote.removeFriend(session, msg, function (removeFriendResponse) {
                next(null, removeFriendResponse);
            })
        } else {
            next(null, validated);
        }
    })
}

/**
 * Request to Play with friend
 * @param {Object} msg playerId, friendId, channelId
 * @param {Object} session 
 * @param {Function} next 
 */
handler.playWithFriend = function (msg, session, next) {
    const self = this;
    keyValidator.validateKeySets("Request", "buddy", "playWithFriend", msg, function (validated) {
        if (validated.success) {
            self.app.rpc.buddy.buddyRemote.playWithFriendInvite(session, msg, function (playRequestResponse) {
                if (playRequestResponse.success) {
                    // broadcast
                    const msgObj = {
                        tableDetails: playRequestResponse.data.tableDetails,
                        friendDetails: playRequestResponse.data.requesterDetails,
                        playerId: msg.friendId
                    }
                    self.app.rpc.connector.entryRemote.sendMessageToUser(session, msg.friendId, msgObj, 'playRequestReceived', function (info) {
                        console.log("broadcast info " + info);
                    })
                    next(null, { success: true, data: "Play request sent successfully", channelId: msg.channelId });
                } else {
                    next(null, playRequestResponse);
                }
            })
        } else {
            next(null, validated);
        }
    })
}