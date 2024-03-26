/*jshint node: true */
"use strict";


var async         = require("async"),
    stateOfX      = require("../../../../shared/stateOfX"),
    db            = require("../../../../shared/model/dbQuery.js"),
    imdb          = require("../../../../shared/model/inMemoryDbQuery.js"),
    zmqPublish    = require("../../../../shared/infoPublisher"),
    keyValidator  = require("../../../../shared/keysDictionary");

var blindUpdate = {};

/**
 * This function creates data for log generation
 * @method serverLog
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
function serverLog (type, log) {
	var logObject          = {};
	logObject.fileName     = 'blindUpdate';
	logObject.serverName   = stateOfX.serverType.database;
	// logObject.functionName = arguments.callee.caller.name.toString();
	logObject.type         = type;
	logObject.log          = log;
	zmqPublish.sendLogMessage(logObject);
}


/**
 * Getting blind rule fron db corresponding to tournamentId
 * @method getBlindRule
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
var getBlindRule = function(params, cb) {
	serverLog(stateOfX.serverLogType.info,"in getBlindRule in blindUpdate" + JSON.stringify(params));
	db.getTournamentRoom((params.table.tournamentRules.tournamentId).toString(), function(err, tournamentRoom) {
		if(err || !tournamentRoom) {
			cb(params);
		} else {
			db.findBlindRule(tournamentRoom.blindRule, function(err, blindRuleResponse) {
				if(err || !blindRuleResponse) {
					cb(params);
				} else {
					serverLog(stateOfX.serverLogType.info, "blindRule is in getBlindRule in blindUpdate is -- " + JSON.stringify(blindRuleResponse));
					params.blindRule = blindRuleResponse.list; 
					cb(null, params); 
				}
			});
		}
	});
};


/**
 * Process blind rule if it is time to update
 * @method getBlindRule
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */

var processBlind = function(params, cb) {
	if(params.blindRule.length === params.table.blindLevel) {
		cb(null, params);
	} else {
		serverLog(stateOfX.serverLogType.info, "params in processBlind is in blindUpdate is - - " + JSON.stringify(params));
		serverLog(stateOfX.serverLogType.info, "params.table.tournamentStartTime is " + params.table.tournamentStartTime);
		serverLog(stateOfX.serverLogType.info, "params.blindRule[params.table.blindLevel].minutes*60000 - " + (params.blindRule[params.table.blindLevel].minutes)*60000);
		var nextBlindUpdateTime = params.table.tournamentStartTime + (params.blindRule[params.table.blindLevel].minutes)*60000;
		serverLog(stateOfX.serverLogType.info, "nextBlindUpdateTime is in processBlind is - " + nextBlindUpdateTime);
		var blindObject = params.blindRule[params.table.blindLevel + 1] || params.blindRule[params.table.blindLevel];
		if(Number(new Date()) >= nextBlindUpdateTime) {
			serverLog(stateOfX.serverLogType.info, "It is right time to update blind in blindupdate");
			params.data.isBlindUpdated   = true; // Used to broadcast client for new blind details
			params.table.lastBlindUpdate = Number(new Date());
			params.table.smallBlind      = blindObject.smallBlind;
			params.table.bigBlind        = blindObject.bigBlind;
			params.table.ante            = blindObject.ante ;
			params.table.blindLevel      = params.table.blindLevel + 1;
			serverLog(stateOfX.serverLogType.info, "params.table.tournamentStartTime in processBlind is - " + params.table.tournamentStartTime);
			var nextBlindUpdateTime2 = Math.ceil( (params.table.tournamentStartTime + (blindObject.minutes)*60000) - (Number(new Date())) ) ;
			serverLog(stateOfX.serverLogType.info, "nextBlindUpdateTime2 in processBlind in milliseconds is - " + params.table.nextBlindUpdateTime2);
			//params.table.nextBlindUpdateTime2 =  parseInt(params.table.nextBlindUpdateTime2/60000);
			serverLog(stateOfX.serverLogType.info, "nextBlindUpdateTime2 in processBlind is - " + params.table.nextBlindUpdateTime2);
			params.data.newBlinds        = {
				smallBlind : params.table.smallBlind,
				bigBlind 	 : params.table.bigBlind,
				ante 			 : params.table.ante,
				blindLevel : params.table.blindLevel,
				nextBlindUpdateTime :nextBlindUpdateTime2 < 0 ? 0 : nextBlindUpdateTime2
			};
			params.table.nextBlindInfo = {
				smallBlind : !!params.blindRule[params.table.blindLevel+1] ? params.blindRule[params.table.blindLevel+1].smallBlind : -1,
				bigBlind 	 : !!params.blindRule[params.table.blindLevel+1] ? params.blindRule[params.table.blindLevel+1].bigBlind : -1,
				ante 			 : !!params.blindRule[params.table.blindLevel+1] ? params.blindRule[params.table.blindLevel+1].ante : -1,
				blindLevel : !!params.blindRule[params.table.blindLevel+1] ? params.table.blindLevel +1 :-1
			};
			if(!!params.blindRule[params.table.blindLevel+1]) {
				params.table.nextBlindInfo.nextBlindUpdateTime = params.table.tournamentStartTime + (params.blindRule[params.table.blindLevel+1].minutes)*60000;
			} else {
				params.table.nextBlindInfo.nextBlindUpdateTime = -1;
			}
			serverLog(stateOfX.serverLogType.info, "params.table.nextBlindInfo processBlind is --- " + JSON.stringify(params.table.nextBlindInfo));
			serverLog(stateOfX.serverLogType.info, "The updated params in processBlind is --- " + JSON.stringify(params));
			cb(null, params);
		} else {
			serverLog(stateOfX.serverLogType.info, "There is no need to update Blind  at - " + new Date());
			cb(null, params);
		}
	}
};

/**
 * This function contains a series of async functions that have been defined above 
 * @method updateBlind
 * @param  {Object}       params  request json object
 * @param  {Function}     cb      callback function
 * @return {Object}               params/validated object
 */
blindUpdate.updateBlind = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, "params is in updateBlind is " + JSON.stringify(params));
	async.waterfall([
		async.apply(getBlindRule,params),
		processBlind
	], function(err,result) {
		if(err) {
			serverLog(stateOfX.serverLogType.info, "ERROR in updatting blind in blind update");
			cb({success: false});
		} else {
			serverLog(stateOfX.serverLogType.info, "The result in updateBlind is ----- ", result);
			cb({success: true,params:result });
		}
	});
};

module.exports = blindUpdate;
