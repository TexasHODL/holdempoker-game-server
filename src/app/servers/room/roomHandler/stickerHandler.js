const _ = require("underscore");
var pomelo = require('pomelo');

const stickers = require('../../../../shared/stickerMgmt');
const broadcastHandler = require("./broadcastHandler");
const db = require('../../../../shared/model/dbQuery.js');

const stickerHandler = {};

/**
   * This method is used for validating the sticker through sticker id.
   * @author naman jain
   * @method validateSickers
   * @date   2020-01-11 3:10:00 PM
   * @return {Object}      [resovle and reject accordingly]
  */
function validateSickers(stickerId) {
    return new Promise((resolve, reject) => {
        if (_.findWhere(stickers, { stickerId: stickerId })) {
            resolve(true);
        } else {
            reject("Requested sticker not found on server");
        }
    });
}

/**
   * This method is used for gettting the player details for broadcast.
   * @author naman jain
   * @method getPlayerDetailsForBroadcast
   * @date   2020-01-11 3:10:00 PM
   * @return {Object}      [resovle and reject accordingly]
  */
function getPlayerDetailsForBroadcast(playerId) {
    const query = { playerId: playerId };
    return new Promise((resolve, reject) => {
        console.log("query --> " + query);
        db.findUser(query, function (err, result) {
            if (!err && result) {
                console.log("result --> " + result);
                resolve(result);
            } else {
                console.error("error in find player details");
                reject("Player details not found");
            }
        });
    });
}

function generateTextForBroadcast(msg, senderInfo, receiverInfo) {
    return new Promise((resolve) => {
        let textForChannel = senderInfo.userName + " has sent sticker to ";
        let textForReceiver = "";
        if (msg.sendToAll) {
            textForChannel += "all";
        } else {
            textForChannel += receiverInfo.userName;
            textForReceiver = senderInfo.userName + " has sent you a sticker."
        }
        resolve({
            textForChannel,
            textForReceiver
        });
    });
}

/**
   * This method is used for sending the broadcast on channel for sticker
   * @author naman jain
   * @method broadcastToChannelForSticker
   * @date   2020-01-11 3:10:00 PM
   * @return {Object}      [resovle and reject accordingly]
  */
function broadcastToChannelForSticker(msg) {
    console.log("1 broadcast");
    let channel = pomelo.app.get('channelService').getChannel(msg.channelId, false);
    console.log("2 broadcast");
    let broadcastData = {
        channelId: msg.channelId,
        stickerId: msg.stickerId,
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        sendToAll: msg.sendToAll,
    };
    console.log("3 broadcast" + JSON.stringify(broadcastData));
    broadcastHandler.fireBroadcastForSendStickerToChannel({
        channel,
        channelId: msg.channelId,
        broadcastData
    });
}

/**
   * This method is used for processing the send sticker request.
   * @author naman jain
   * @method sendStickerProcess
   * @date   2020-01-11 3:10:00 PM
   * @return {Object}      [resovle and reject accordingly]
  */
stickerHandler.sendStickerProcess = async function sendStickerProcess(msg, cb) {
    try {
        console.log(" sticker 1 " + msg.stickerId)
        await validateSickers(msg.stickerId)
        // console.log(" sticker 2 " + msg.senderId)
        // const senderData = await getPlayerDetailsForBroadcast(msg.senderId);
        // let receiverData = {};
        // console.log(" sticker 3 " + JSON.stringify(senderData))
        // if (!msg.sendToAll) {
        // console.log(" sticker 4 ")
        // receiverData = await getPlayerDetailsForBroadcast(msg.receiverId);
        // console.log(" sticker 5 " + JSON.stringify(receiverData))
        // };
        // console.log(" sticker 6 ");
        // const infoText = await generateTextForBroadcast(msg, senderData, receiverData);
        // console.log(" sticker 7 " + JSON.stringify(infoText));
        broadcastToChannelForSticker(msg);
        // console.log(" sticker 8 ")
        return cb({
            success: true,
            result: "Sticker sent successfully",
            channelId: msg.channelId,
            stickerId: msg.stickerId,
            senderId: msg.senderId,
            receiverId: msg.receiverId
        });
    } catch (err) {
        console.error("here in error while sending the sticker");
        return cb({ success: false, info: "Error while sending sticker", channelId: msg.channelId });
    }
}

module.exports = stickerHandler;