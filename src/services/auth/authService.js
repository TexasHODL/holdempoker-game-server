const jwt = require("jsonwebtoken");
const redisUtil = require("../../app/util/redisUtil");
const requestData = require("../../shared/requestData.js");
const bcrypt = require("bcryptjs");
require("dotenv").config();
const apiKey = process.env.API_KEY;

const verifyJwt = (token) => {
  const publicKey = Buffer.from(
    process.env.ACCESS_TOKEN_PUBLIC_KEY,
    "base64"
  ).toString("ascii");
  return jwt.verify(token, publicKey);
};

const tryParseJSONObject = (jsonString) => {
  try {
    const o = JSON.parse(jsonString);
    if (o && typeof o === "object") {
      return o;
    }
  } catch (e) {}

  return false;
};

module.exports.handleTokenData = async (token) => {
  const decoded = verifyJwt(token);
  if (!decoded) {
    return { status: "session_expired" };
  }
  const userProfile = await redisUtil.getData(token);
  if (userProfile && userProfile.error) {
    //Something went wrong with redis
    console.error(userProfile);
    return { status: "redis_went_wrong" };
  } else if (!userProfile) {
    //access_token does not exists in redis
    return { status: "invalid_session" };
  } else {
    const parsedData = tryParseJSONObject(userProfile);
    return { status: "accepted", data: parsedData };
  }
};
//request AccessTk and RefreshTk
module.exports.requestToken = async (data) => {
  try {
    console.log("))))))))))))))))((((((((((((((((");
    console.log(apiKey);
    
    const code = await bcrypt.hashSync(apiKey, 12);
    const base64Code = Buffer.from(code).toString("base64");
    const dt = await requestData("POST", "/api/auth/wallet", data, {
      apikeycode: base64Code,
    });

    if (!!dt && dt.status == 200) {
      const result = JSON.parse(dt.result);
      return { success: true, result };
    } else {
      const result = JSON.parse(dt.result);
      return { success: true, result };
    }
  } catch (error) {
    return { success: false, error };
  }
};
