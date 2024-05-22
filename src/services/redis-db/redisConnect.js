const redis = require("redis");
const redisManager = {};

redisManager.dbConnect = function dbConnect(opts, cb) {
  const client = redis.createClient(
    process.env.REDIS_PORT,
    process.env.REDIS_HOST,
    {}
  );

  client.on("error", function (error) {
    console.error(error);
    cb("REDIS-CLIENT ERROR");
  });
  client.on("end", function (error) {
    console.error(error);
    cb("REDIS-CLIENT END");
  });

  client.on("ready", function (error) {
    console.error(error);
    redisManager.redisClient = client;
    cb(null, client);
  });
};

module.exports = redisManager;
