/*
 * File: buddyRemote.js
 * Project: poker-gameserver
 * File Created: Tuesday, 9th February 2021
 * Author: digvijay (rathore.digvijay10@gmail.com)
 * -----
 * Last Modified: Fri Mar 05 2021
 * Modified By: Digvijay
 */

const _ = require("underscore");
const dbQuery = require('../../../../shared/model/dbQuery');
const adminDB = require('../../../../shared/model/adminDbQuery');
const imdb = require("../../../../shared/model/inMemoryDbQuery");
const redisCommands = require("../../../../services/redis-db/redisCommands");
const ObjectID = require("mongodb").ObjectID;

var buddyRemote = function (app) {
    this.app = app;
};

module.exports = function (app) {
    return new buddyRemote(app);
};

function checkIfAlreadyFriends(playerId, friendId, cb) {
    const query = {}
    query.playerId = playerId;
    query["friends"] = { $in: [friendId] };
    console.log("query --." + JSON.stringify(query));
    dbQuery.getFriendsData(query, function (err, result) {
        if (!err && result) {
            return cb({ success: true, result: result });
        } else {
            return cb({ success: false, info: "Not in friends list" });
        }
    })
}


function updatePlayerFriendRequestSent(firstPlayerId, secondPlayerId, updateString, checkReceivedOrSent, cb) {
    const query = {};
    query.playerId = firstPlayerId;
    query[updateString] = { $nin: [secondPlayerId] };

    const updateData = {};
    if (checkReceivedOrSent) {
        const push = {
            requestReceived: secondPlayerId
        }
        updateData['$push'] = push;
    } else {
        const push = {
            requestSent: secondPlayerId
        }
        updateData['$push'] = push;
    }

    dbQuery.updateFriendsData(query, updateData, function (err, result) {
        if (err) {
            return cb({ success: false, info: "Error while sending Friend request" });
        }
        return cb({ success: true, data: "Friend request sent successfully" });
    })

}

buddyRemote.prototype.sendFriendRequest = function (msg, cb) {
    // console.log("in remote file");
    getDataForFriends(msg.playerId, function (friendsResponse) {
        if (!friendsResponse.success) {
            return cb(friendsResponse);
        }
        if (friendsResponse.result.requestSent.includes(msg.friendId)) {
            return cb({ success: false, info: "Invitation already sent . Waiting to respond" });
        }
        if (friendsResponse.result.friends.includes(msg.friendId)) {
            return cb({ success: false, info: `Player is already your buddy` });
        }
        getFriendPlayerProfile([msg.playerId], function (playerResponse) {
            if (!playerResponse.success) {
                return cb({ success: false, info: "Error while finding info from database." });
            }
            const playerInfo = {
                userName: playerResponse.result[0].userName,
                playerId: msg.playerId
            }
            updatePlayerFriendRequestSent(msg.friendId, msg.playerId, "requestReceived", true, function (response1) {
                if (response1.success) {
                    updatePlayerFriendRequestSent(msg.playerId, msg.friendId, "requestSent", false, function (response2) {
                        if (!response2.success) {
                            return cb(response2);
                        }
                        cb({ success: true, data: "Friend request sent successfully", playerInfo });
                    });
                } else {
                    return cb(response1);
                }
            });
        })
    })

    // checkIfAlreadyFriends(msg.playerId, msg.friendId, function (response) {
    //     // console.log("response --> " + JSON.stringify(response));
    //     if (response.success) {
    //         return cb({ success: true, info: "Player is already your friend" });
    //     }
    // })
}

function getFriendPlayerProfile(friendList, cb) {
    const query = { playerId: { $in: friendList } };
    const projection = { projection: { _id: 0, userName: 1, playerId: 1, "statistics.megaPointLevel": 1, profileImage: 1 } };
    dbQuery.findUsersOpts(query, projection, function (err, result) {
        if (err) {
            cb({ success: false, info: "Error while showing friend list" });
        } else {
            cb({ success: true, result });
        }
    });
}

function getDataForFriends(playerId, cb) {
    const query = {
        playerId: playerId
        
    };
    console.log("query"+query.playerId);
    dbQuery.getFriendsData(query, function (err, result) {
        if (err || !result) {
            return cb({ success: false, info: "Error while getting request list" });
        } else {
            console.log("result in getDataForFriends -> " + JSON.stringify(result));
            return cb({ success: true, result: result });
        }
    });
}

buddyRemote.prototype.getFriendRequests = function (msg, cb) {
    getDataForFriends(msg.playerId, function (getFriendsResponse) {
        console.log(" getFriendsResponse " + JSON.stringify(getFriendsResponse));
        if (getFriendsResponse.success) {
            console.log("length -> " + getFriendsResponse.result.requestReceived + '  ' + getFriendsResponse.result.requestReceived.length);
            if (getFriendsResponse.result.requestReceived && getFriendsResponse.result.requestReceived.length > 0) {
                getFriendPlayerProfile(getFriendsResponse.result.requestReceived, function (playerProfilesResponse) {
                    return cb(playerProfilesResponse)
                })
            } else {
                return cb({ success: true, result: [] })
            }
        } else {
            cb(getFriendsResponse);
        }
    })

}

function updatePlayerFriends(playerId, friendId, pullFromRequestReceived, cb) {
    const query = {};
    query.playerId = playerId;
    query.friends = { $nin: [friendId] };

    const updateData = {};
    updateData['$push'] = {
        friends: friendId
    };

    if (pullFromRequestReceived) {
        var pull = {
            requestReceived: friendId,
        };
    } else {
        var pull = {
            requestSent: friendId,
        };
    }
    updateData['$pull'] = pull;

    dbQuery.updateFriendsData(query, updateData, function (err, result) {
        if (err) {
            return cb({ success: false, info: "Error while accepting Friend request" });
        }
        return cb({ success: true, data: "Friend request accepted successfully" });
    })
}

buddyRemote.prototype.acceptFriendRequest = function (msg, cb) {
    updatePlayerFriends(msg.playerId, msg.friendId, true, function (response1) {
        if (response1.success) {
            updatePlayerFriends(msg.friendId, msg.playerId, false, function (response2) {
                return cb(response2);
            })
        } else {
            return cb(response1);
        }
    })
}

function rejectPlayerFriendRequest(firstPlayerId, secondPlayerId, pullFromRequestReceived, cb) {
    const query = {
        playerId: firstPlayerId
    };

    const updateData = {};
    if (pullFromRequestReceived) {
        var pull = {
            requestReceived: secondPlayerId,
        };
    } else {
        var pull = {
            requestSent: secondPlayerId,
        };
    }
    updateData['$pull'] = pull;

    dbQuery.updateFriendsData(query, updateData, function (err, result) {
        if (err) {
            return cb({ success: false, info: "Error while rejecting Friend request" });
        }
        return cb({ success: true, data: "Friend request rejected successfully" });
    })
}

buddyRemote.prototype.rejectFriendRequest = function (msg, cb) {
    rejectPlayerFriendRequest(msg.playerId, msg.friendId, true, function (response1) {
        if (response1.success) {
            rejectPlayerFriendRequest(msg.friendId, msg.playerId, false, function (response2) {
                cb(response2);
            });
        } else {
            cb(response1);
        }
    })
}

function getPlayerDetailsfromDb(userName, cb) {
    dbQuery.findUser({ userName: userName }, function (err, playerResult) {
        if (err || !playerResult) {
            return cb({ success: false, info: "Player details not found." })
        }
        return cb({
            success: true, result: [{
                userName: playerResult.userName,
                playerId: playerResult.playerId,
                profileImage: playerResult.profileImage
            }]
        })
    })
}


buddyRemote.prototype.searchPlayer = function (msg, cb) {
    getPlayerDetailsfromDb(msg.userName, function (response1) {
        if (!response1.success) {
            return cb(response1);
        }
        getDataForFriends(msg.playerId, function (response2) {
            if (!response2.success) {
                return cb(response2);
            }
            if (response2.result.requestSent.includes(response1.result[0].playerId)) {
                return cb({ success: false, info: "Invitation already sent . Waiting to respond" });
            }
            if (response2.result.friends.includes(response1.result[0].playerId)) {
                return cb({ success: false, info: `${msg.userName} is already your buddy` });
            }
            cb(response1);
        })
    })
}

function getLoyalityLevelData(cb) {
    adminDB.findAllMegaPointLevels({}, function (err, res) {
        if (err || !res) {
            return cb({ success: false, info: "Error while finding friends loyality details" });
        } else {
            // userData.statistics.megaPointsPercent = getLevelPercent(userData.statistics.megaPoints, res);
            // userData.statistics.megaPointLevel = getLevelName(userData.statistics.megaPointLevel, res);
            cb({ success: true, loyalityData: res });
        }
    });
}

function getOnlinePlayers(cb) {
    redisCommands.getOnlinePlayers(function (err, result) {
        if (err) {
            return cb({ success: false, info: "Error while getting online players" })
        }
        cb({ success: true, onlinePlayers: result });
    })
}

function getLevelName(levelId, levels) {
    var t = _.findWhere(levels, { levelId: levelId }) || levels[0];
    return t.loyaltyLevel;
}

function assignOtherDataToFriends(friendList, onlinePlayers, loyalityData, cb) {
    for (const friend of friendList) {
        friend.isOnline = false;
        if (onlinePlayers.includes(friend.playerId)) {
            friend.isOnline = true;
        }
        friend.megaPointLevel = getLevelName(friend.statistics.megaPointLevel, loyalityData);
    }
    cb({ success: true, result: friendList });
}

buddyRemote.prototype.getFriendList = function (msg, cb) {
    console.log("Get friend list called");
    getDataForFriends(msg.playerId, function (getFriendsResponse) {
        if (!getFriendsResponse.success) {
            return cb(getFriendsResponse);
        }
        if (getFriendsResponse.result.friends && getFriendsResponse.result.friends.length > 0) {
            getLoyalityLevelData(function (loyalityResponse) {
                if (!loyalityResponse.success) {
                    return cb(loyalityResponse);
                }
                // console.log("loyality --> " + JSON.stringify(loyalityResponse.loyalityData));
                getOnlinePlayers(function (onlinePlayerRes) {
                    if (!onlinePlayerRes.success) {
                        return cb(onlinePlayerRes);
                    }
                    // console.log("onlineplayers --> " + JSON.stringify(onlinePlayerRes.onlinePlayers));
                    getFriendPlayerProfile(getFriendsResponse.result.friends, function (playerProfilesResponse) {
                        if (!playerProfilesResponse.success) {
                            return cb(playerProfilesResponse);
                        }
                        // console.log("friends --> " + JSON.stringify(playerProfilesResponse.result));
                        assignOtherDataToFriends(playerProfilesResponse.result, onlinePlayerRes.onlinePlayers, loyalityResponse.loyalityData, function (overAllResponse) {
                            return cb(overAllResponse);
                        })
                    })
                })
            });
        } else {
            return cb({ success: true, result: [] })
        }
    })
}

function removePlayerFriend(playerId, friendId, cb) {
    const query = {
        playerId: playerId,
        friends: { $in: [friendId] }
    };
    const updateData = {
        $pull: {
            friends: friendId,
        }
    }
    dbQuery.updateFriendsData(query, updateData, function (err, result) {
        if (err) {
            return cb({ success: false, info: "Error while removing Friend" });
        }
        return cb({ success: true, data: "Friend removed successfully" });
    })
}

buddyRemote.prototype.removeFriend = function (msg, cb) {
    const { playerId, friendId } = msg;
    removePlayerFriend(playerId, friendId, function (response1) {
        if (!response1.success) {
            return cb(response1);
        }
        removePlayerFriend(friendId, playerId, function (response2) {
            return cb(response2);
        })
    })
}

function getTableDetails(channelId, cb) {
    dbQuery.findSpecificTable({ _id: ObjectID(channelId) }, function (err, table) {
        if (err) {
            cb({ success: false, info: "Error while finding table" });
        } else if (!table) {
            cb({ success: false, info: "No table found for this Id" });
        } else {
            cb({ success: true, data: table });
        }
    })
}

function checkPlayerAlreadyOnTable(playerId, channelId, cb) {
    const query = { channelId: channelId.toString(), playerId: playerId };
    imdb.isPlayerJoined(query, function (err, result) {
        if (!err && !!result) {
            cb({ success: false, info: "Player is already playing on same table", channelId });
        } else {
            cb({ success: true })
        }
    })
}

buddyRemote.prototype.playWithFriendInvite = async function (msg, cb) {
    const { playerId, friendId, channelId } = msg;
    checkIfAlreadyFriends(playerId, friendId, function (response) {
        if (!response.success) {
            return cb({ success: false, info: "Player is not in your friend list.", channelId });
        }
        getFriendPlayerProfile([playerId], function (friendProfileResponse) {
            if (!friendProfileResponse.success) {
                return cb(friendProfileResponse);
            }
            if (friendProfileResponse.result.length <= 0) {
                return cb({ success: false, info: "Friend details not found", channelId });
            }
            getTableDetails(channelId, function (tableDetailsResponse) {
                if (!tableDetailsResponse.success) {
                    return cb(tableDetailsResponse);
                }
                checkPlayerAlreadyOnTable(friendId, channelId, function (onTableResponse) {
                    if (!onTableResponse.success) {
                        return cb(onTableResponse)
                    }
                    return cb({
                        success: true, data: {
                            tableDetails: {
                                channelId: channelId,
                                tableName: tableDetailsResponse.data.channelName,
                                smallBlind: tableDetailsResponse.data.smallBlind,
                                bigBlind: tableDetailsResponse.data.bigBlind,
                                channelType: tableDetailsResponse.data.channelVariation,
                                maxPlayers: tableDetailsResponse.data.maxPlayers,
                                isPrivateTabel: tableDetailsResponse.data.isPrivateTabel,
                                tableId: tableDetailsResponse.data._id
                            },
                            requesterDetails: {
                                playerName: friendProfileResponse.result[0].userName,
                                playerId: friendProfileResponse.result[0].playerId
                            }
                        }
                    })
                })
            })
        })
    })
}
