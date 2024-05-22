/*jshint node: true */
"use strict";

var imdb              = require("../../../../shared/model/inMemoryDbQuery.js"),
	async								= require("async"),
	_ 									= require("underscore"),
	_ld                 = require("lodash"),
	lib          				= require("../../../../shared/customLibrary.js"),
	db                  = require('../../../../shared/model/dbQuery.js'),
	database          	= require("../../../../shared/mongodbConnection.js"),
	stateOfX          	= require("../../../../shared/stateOfX.js"),
	tableManager        = require("./tableManager"),
	zmqPublish          = require("../../../../shared/infoPublisher"),
	dynamicRanks 				= require("./dynamicRanks.js"),
	playerShuffling 		= {},
	messages      = require("../../../../shared/popupTextManager").falseMessages,
	dbMessages    = require("../../../../shared/popupTextManager").dbQyeryInfo;

//database.init();

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'playerShuffling';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

/**
 * this function gets tournament room using tournament ID
 * @method getTournamentRoom
 * @param  {string}          tournamentId 
 * @param  {Function}        cb           callback function
 */
var getTournamentRoom = function(tournamentId,cb) {
	serverLog(stateOfX.serverLogType.info,"in getTournamentRoom in playerShuffling" + tournamentId);
  db.getTournamentRoom(tournamentId, function(err, tournament) {
    if(err || !tournament) {
      cb({success: false, info: dbMessages.DB_GETTOURNAMENTROOM_FAILED_PLAYERSHUFFLING, isRetry: false, isDisplay: false, channelId: ""});
    } else {
      serverLog(stateOfX.serverLogType.info,"tournament is in player shuffling" + JSON.stringify(tournament));
      if(tournament.isTournamentRunning === undefined || tournament.isTournamentRunning === true) {
      	cb({success: true, isTournamentRunning: true});
      } else {
				cb({success: true, isTournamentRunning: false});      	
      }
    }
  });
};

/**
 * this funciton gets all tables using tournament id and gameVersionCount
 * @method getAllChannels
 * @param  {string}       tournamentId     
 * @param  {integer}       gameVersionCount 
 * @param  {Function}     cb               callback function
 * @return {[type]}                        [description]
 */
var getAllChannels = function(tournamentId, gameVersionCount, cb) {
	serverLog(stateOfX.serverLogType.info,"tournamentId and gameVersionCount is in getAllChannels in playerShuffling - ",tournamentId, gameVersionCount);
	var filter = {
		tournamentId 		  : tournamentId,
		gameVersionCount	: gameVersionCount
	};
	imdb.getAllTableByTournamentId(filter, function(err, channels){
		if(err || !channels) {
			cb({success: false, info: dbMessages.IMDB_GETALLTABLEBYTOURNAMENTID__FAILED_PLAYERSHUFFLING, isRetry: false, isDisplay: false, channelId: ""});
		} else {
			serverLog(stateOfX.serverLogType.info,"channels in getAllChannels in playerShuffling is ",JSON.stringify(channels));
			channels = _.filter(channels, function(channel){
				 return channel.players.length>0;
			});
			cb({success: true, result: channels});
		}
	});
};

/**
 * this function initializes params
 * @method initializeParams
 * @param  {object}         params request json object
 * @param  {Function}       cb     callback function
 */
var initializeParams = function(params, cb) {
	serverLog(stateOfX.serverLogType.info,"params in initializeParams in playerShuffling - ",JSON.stringify(params));
	var tempParams = {
		table 					 						: params.table,
		maxPlayerOnTable 						: params.table.maxPlayers,
		isChannelReductionPossible 	: false,
		allChannels 								: [],
		shiftedPlayers 							: [],
		shiftedPlayersData          : [],
		outOfMoneyPlayers           : []
	};
	serverLog(stateOfX.serverLogType.info,"temp params is in initializeParams in playerShuffling is - ",JSON.stringify(tempParams));
	cb(null, tempParams);
};

// update seats while going for shuffling
/**
 * this function updates seats while going for shuffling
 * @method updateSeats
 * @param  {object}    params request json object
 * @param  {Function}  cb     callback function
 */
var updateSeats = function(params, cb) {
	serverLog(stateOfX.serverLogType.info,"in update seats in player shuffling - ",JSON.stringify(params));
	getAllChannels(params.table.tournamentRules.tournamentId, params.table.gameVersionCount,function(channelsResponse) {
		if(channelsResponse.success) {
			async.eachSeries(channelsResponse.result, function(channel, callback) {
				var updateFields = {};
				updateFields.vacantSeats = channel.maxPlayers - channel.players.length;
				updateFields.occupiedSeats = channel.players.length;
				imdb.updateSeats(channel.channelId, updateFields, function(err, response) {
					if(err || !response) {
						cb({success: false, info: dbMessages.IMDBUPDATESEATS_UPDATESEATSANDSHUFFLEID_FAILED_PLAYERSHUFFLING, isRetry: false, isDisplay: false, channelId: ""});
					} else {
						callback();
					}
				});
			}, function(err) {
				if(err) {
					cb({success: false, info: messages.ASYNCEACHSERIES_UPDATESEATS_FAILED_PLAYERSHUFFLING, isRetry: false, isDisplay: false, channelId: ""});
				} else {
					serverLog(stateOfX.serverLogType.info,"params is in updateSeats - ",JSON.stringify(params));
					cb(null, params);
				}
			});
		} else {
			cb({success: false, info: messages.GETALLCHANNELS_UPDATESEATS_FAILED_PLAYERSHUFFLING, isRetry: false, isDisplay: false, channelId: ""});
		}
	});
};


// Remove out of money players from params
/**
 * this function removes out of money players from params
 * @method removeOutOfMoneyPlayers
 * @param  {object}                params request json object
 * @param  {Function}              cb     callback funcion
 */
var removeOutOfMoneyPlayers = function(params, cb) {
	serverLog(stateOfX.serverLogType.info,"parmas is in removeOutOfMoneyPlayers are - ",JSON.stringify(params));
	var outOfMoneyPlayers = _.where(params.table.players,{state: stateOfX.playerState.outOfMoney});
	params.table.players = _.difference(params.table.players,outOfMoneyPlayers);
	serverLog(stateOfX.serverLogType.info,"params.players are in removeOutOfMoneyPlayers" + JSON.stringify(params.table.players));
	params.outOfMoneyPlayers = _.pluck(outOfMoneyPlayers,"playerId");
	serverLog(stateOfX.serverLogType.info,"outOfMoney players are in removeOutOfMoneyPlayers in playerShuffling are - ",JSON.stringify(params.outOfMoneyPlayers));
	cb(null, params);
};

/**
 * this function checks whether channel reduction is possible or not
 * @method checkChannelReduction
 * @param  {object}              params request json object
 * @param  {Function}            cb     callback function
 */
var checkChannelReduction = function(params, cb) {
	serverLog(stateOfX.serverLogType.info,"params in checkTableReduction in playerShuffling - ",JSON.stringify(params));
	getAllChannels(params.table.tournamentRules.tournamentId, params.table.gameVersionCount, function(channelsResponse) {
		if(channelsResponse.success) {
			serverLog(stateOfX.serverLogType.info,"channels are is in checktablereduction in playerShuffling - ",JSON.stringify(channelsResponse.result));
			var allPlayingPlayers = 0;
			// params.totalChannels = channelsResponse.result;
			params.allChannels = lib.pluckKeys(channelsResponse.result,["channelId","occupiedSeats","vacantSeats","players"]);
			serverLog(stateOfX.serverLogType.info,"params.allChannels in check channel reduction in playerShuffling - ",JSON.stringify(params.allChannels));
			var currentChannelIndex = _ld.findIndex(params.allChannels, {"channelId": (params.table.channelId).toString()});
			serverLog(stateOfX.serverLogType.info,"currentChannelIndex is in checkChannelReduction is - ",currentChannelIndex);
			params.allChannels.splice(currentChannelIndex,1);
			serverLog(stateOfX.serverLogType.info,"params.allChannels after removing current channel",JSON.stringify(params.allChannels));
			channelsResponse.result.forEach(function(channel) {
				allPlayingPlayers += channel.occupiedSeats;
			});
			var totalChannels = 0;
			for(var i=0;i<channelsResponse.result.length;i++) {
				if(channelsResponse.result[i].occupiedSeats > 0) {
					totalChannels++;
				}
			}
			allPlayingPlayers  = allPlayingPlayers - params.outOfMoneyPlayers.length;
			// var currentTotalChannels = channelsResponse.result.length;
			var totalChannelsRequired = Math.ceil(allPlayingPlayers/params.maxPlayerOnTable);
			serverLog(stateOfX.serverLogType.info,"all player playing is in checktablereduction is in playerShuffling is - ",allPlayingPlayers);
			serverLog(stateOfX.serverLogType.info,"totalChannels is in checktablereduction is in playerShuffling is - ",totalChannels);
			serverLog(stateOfX.serverLogType.info,"totalChannelsRequired is in checktablereduction is in playerShuffling is - ",totalChannelsRequired);
			params.isChannelReductionPossible = totalChannelsRequired < totalChannels ? true:false;
			cb(null, params);
		} else {
			cb(channelsResponse);
		}
	});
};

/**
 * this function pushes players into new channels 
 * @method pushPlayersInToNewChannel
 * @param  {array}                  players   players array
 * @param  {string}                  channelId 
 * @param  {Function}                cb        callback function
 */
var pushPlayersInToNewChannel = function(players, channelId, cb) {
	serverLog(stateOfX.serverLogType.info,"players and channelId id is in pushPlayersInToNewChannel in playerShuffling is - ",JSON.stringify(players),channelId);
	// players = _.filter(players, function(player) {return player.state = stateOfX.playerState.waiting});
	// players = _.filter(players, function(player) {return player.channelId = channelId});
	// serverLog(stateOfX.serverLogType.info,"players after changing keys channelID and state in pushPlayersInToNewChannel in playerShuffling is - ",JSON.stringify(players));
	preparePlayers(players,channelId, function(response) {
		serverLog(stateOfX.serverLogType.info,"response of preparePlayers is in  pushPlayersInToNewChannel is - ",JSON.stringify(response));
		if(response.success) {
			players = response.result;
			imdb.pushPlayersInTable(players, channelId, function(err, result) {
				if(err || !result) {
					cb({success: false, info: messages.IMDB_PUSHPLAYERSINTABLE_FAILED_PLAYERSHUFFLING, isRetry: false, isDisplay: false, channelId:(channelId || "")});
				}
				cb({success: true, result: players});
			});
		} else {
			cb(response);
		}
	});
};

/**
 * this function prepares players to push into new channels
 * @method preparePlayersToPush
 * @param  {object}             allChannels    object containing allChannels
 * @param  {string}             currentChannel 
 * @return {array}              playersToPush              array containing players to push
 */
var preparePlayersToPush = function(allChannels, currentChannel) {
	serverLog(stateOfX.serverLogType.info,"allChannels and currentChannel in preparePlayersToPush in playerShuffling is -",JSON.stringify(allChannels),JSON.stringify(currentChannel));
	var playersToPush = [], players = [], allChannelsIterartor=0;
	for(var currentChannelIterator = 0; currentChannelIterator<currentChannel.players.length; ) {
		serverLog(stateOfX.serverLogType.info,players.length ,allChannels[allChannelsIterartor].vacantSeats);
		if(players.length < allChannels[allChannelsIterartor].vacantSeats) {
			players.push(currentChannel.players[currentChannelIterator]);
			currentChannelIterator++;
		} else {
			playersToPush.push({
				players: players,
				channelId: allChannels[allChannelsIterartor].channelId
			});
			allChannelsIterartor++;
			players = [];
		}
	}
	if(players.length) {
		playersToPush.push({
			players: players,
			channelId: allChannels[allChannelsIterartor].channelId
		});
	}
	return playersToPush;
};

/**
 * this function checks whether is shuufling required or not
 * @method isShufflingRequired
 * @param  {string}            channel1 
 * @param  {string}            channel2 
 * @return {Boolean}           true or false whether shuffling is required or not
 */
var isShufflingRequired = function(channel1 , channel2) {
	// serverLog(stateOfX.serverLogType.info,"channel 1 is - ",JSON.stringify(_.omit(channel1,"players")));
	// serverLog(stateOfX.serverLogType.info,"channel 2 is - ",JSON.stringify(_.omit(channel2,"players")));
	serverLog(stateOfX.serverLogType.info,"channel1 - ",channel1.players.length);
	serverLog(stateOfX.serverLogType.info,"channel2 - ",channel2.players.length);
	if(Math.abs(channel1.players.length - channel2.players.length) > 1) {
		return true;
	} else {
		serverLog(stateOfX.serverLogType.info,"******** NO SHUFFLING REQUIRED ************");
		return false;
	}
};

/**
 * this function gets no. of players shifted
 * @method getNoOfPlayerShifted
 * @param  {integer}             totalPlayers  
 * @param  {integer}             occupiedSeats 
 */
var getNoOfPlayerShifted = function(totalPlayers, occupiedSeats) {
	return (totalPlayers & 1) === 0 ? Math.abs(occupiedSeats - totalPlayers/2) : Math.abs(occupiedSeats - Math.ceil(totalPlayers/2));
};

/**
 * this function finds free seat index
 * @method findFreeSeatIndex
 * @param  {string}          channelId 
 * @param  {Function}        cb        callback funciton
 */
var findFreeSeatIndex = function(channelId, cb) {
	serverLog(stateOfX.serverLogType.info,"channelId is in findFreeSeatIndex is in playerShuffling is - ",channelId);
	imdb.getTable(channelId, function(err, channel) {
		if(err || !channel) {
			cb({success: false, info: messages.IMDB_GETTABLE_FINDFREESEATINDEX_FAILED_PLAYERSHUFFLING, isRetry: false, isDisplay: false, channelId:(channelId || "")});
		}
		var freeIndex = _.difference(_.range(1,channel.maxPlayers+1), _.pluck(channel.players, "seatIndex"));
		cb({success: true, result: freeIndex});
	});
};

/**
 * this function prepares the players to be shifted
 * @method preparePlayers
 * @param  {array}       players   array of players
 * @param  {string}       channelId 
 * @param  {Function}     cb        callback function
 */
var preparePlayers = function(players, channelId, cb) {
	serverLog(stateOfX.serverLogType.info,"players and channelId is in preparePlayers are in playerShuffling is - ",JSON.stringify(players),channelId);
	var playersToBeShifted = [];
	findFreeSeatIndex(channelId, function(seatIndexResponse){
		var index = 0;
		var seatIndexArray = seatIndexResponse.result;
		serverLog(stateOfX.serverLogType.info,"response is in prepare player is in playerShuffling is - ",JSON.stringify(seatIndexArray));
		async.eachSeries(players, function(player, callback) {
			serverLog(stateOfX.serverLogType.info,"seat index is - ",seatIndexArray[index]);

			var newPlayer =  tableManager.createPlayer({
				playerId          : player.playerId,
    		channelId         : channelId,
    		playerName        : player.playerName,
    		userName          : player.playerName,
    		networkIp         : "",
    		maxBuyIn 					: player.chips,
    		chips             : player.chips,
    		seatIndex         : seatIndexArray[index++],
    		imageAvtar        : player.imageAvtar,
    		state             : stateOfX.playerState.waiting,
    		onGameStartBuyIn  : parseInt(player.chips),
    		onSitBuyIn        : parseInt(player.chips),
    		timeBankLeft 			: parseInt(player.tournamentData.totalTimeBank),
    		roundId           : null,
			});
	    serverLog(stateOfX.serverLogType.info,"new player is in preparePlayers in playerShuffling is - ",JSON.stringify(newPlayer));
	    playersToBeShifted.push(newPlayer);
	    callback();
		}, function(err) {
			if(err) {
				serverLog(stateOfX.serverLogType.info,"Error in async in preparePlayers");
				cb({success: false, info: messages.ASYNC_PREPAREPLAYERS_FAILED_PLAYERSHUFFLING, isRetry: false, isDisplay: false, channelId:(channelId || "")});
//				cb({success: false, info: "Error in async in preparePlayers"});
			} else {
				serverLog(stateOfX.serverLogType.info,"plyaer shifted successfully prepared");
				cb({success: true, result: playersToBeShifted});
			}
		});
	});
};

/**
 * this function merges two tables
 * @method mergeTwoTables
 * @param  {object}       channelToBeFilled 
 * @param  {object}       params            request json object
 * @param  {Function}     cb                callback function
 */
var mergeTwoTables = function(channelToBeFilled, params,cb) {
	serverLog(stateOfX.serverLogType.info,"channelToBeFilled and params are in mergeTwoTables in playerShuffling is ",JSON.stringify(channelToBeFilled), JSON.stringify(params));
	var totalPlayers = channelToBeFilled.players.length + params.table.players.length;
	serverLog(stateOfX.serverLogType.info,"totalPlayers are in mergeTwoTables is in playerShuffling is - ",totalPlayers);
	var noOfPlayerShifted = getNoOfPlayerShifted(totalPlayers,params.table.players.length);
	serverLog(stateOfX.serverLogType.info,"number of player shifted in mergeTwoTables are in playerShuffling is - ", noOfPlayerShifted);
	var playersToBeShifted = params.table.players.splice(0,noOfPlayerShifted);
	serverLog(stateOfX.serverLogType.info,"players to be shifted in mergeTwoTables in playerShuffling is - ",JSON.stringify(playersToBeShifted));
	// playersToBeShifted = _.filter(playersToBeShifted, function(player) {return player.state = stateOfX.playerState.waiting});
	// playersToBeShifted = _.filter(playersToBeShifted, function(player) {return player.channelId = channelToBeFilled.channelId});
	// serverLog(stateOfX.serverLogType.info,"players to be shifted in mergeTwoTables after filter in playerShuffling is - ",JSON.stringify(playersToBeShifted));
	// serverLog(stateOfX.serverLogType.info,"channelToBeFilled is in mergeTwoTables is in playerShuffling - ",JSON.stringify(channelToBeFilled.channelId));
	preparePlayers(playersToBeShifted, channelToBeFilled.channelId, function(response) {
		 serverLog(stateOfX.serverLogType.info,"response is in merge mergeTwoTables - ",response);
		if(response.success) {
			playersToBeShifted = response.result;
			imdb.pushPlayersInTable(playersToBeShifted, channelToBeFilled.channelId, function(err, result) {
				if(err || !result) {
					cb({success: false, info: messages.IMDB_PUSHPLAYERSINTABLE_FAILED_PLAYERSHUFFLING, isRetry: false, isDisplay: false, channelId:(channelToBeFilled.channelId || "")});
				}
				cb({success: true, result: playersToBeShifted});
			});
		} else {
			cb(response);
		}
	});
};

/**
 * this function shuffles with shuffle table id
 * @method shufflingWithShuffleTableId
 * @param  {object}                       channelToBeFilled 
 * @param  {object}                       params            
 * @param  {Function}                     cb                callback function
 */
var shufflingWithShuffleTableId = function(channelToBeFilled, params, cb) {
	// serverLog(stateOfX.serverLogType.info,"parmas is in shufflingWithShuffleTableId is in playerShuffling is - ",JSON.stringify(params.table));
	// serverLog(stateOfX.serverLogType.info,"channelToBeFilled is in shufflingWithShuffleTableId is in playerShuffling is - ",JSON.stringify(_.omit(channelToBeFilled,"players")));
	// serverLog(stateOfX.serverLogType.info,"parmas.occupiedseats is in shufflingWithShuffleTableId is in playerShuffling is - ",params.table.occupiedSeats);
	// Check if shuffling required
	if(isShufflingRequired(channelToBeFilled[0],params.table)) { //If shuffling required
		serverLog(stateOfX.serverLogType.info,"shuffling is required is in shufflingWithShuffleTableId is -",params.table.occupiedSeats ,channelToBeFilled[0].occupiedSeats);
		if(params.table.occupiedSeats > channelToBeFilled[0].occupiedSeats) { // If current channel have more occupiedseats
			mergeTwoTables(channelToBeFilled[0], params, function(response) { //merge two tables
				if(response.success) {
					serverLog(stateOfX.serverLogType.info,"channel merge successfully in shufflingWithShuffleTableId in playerShuffling");
					cb({success: true, isShuffleByTableId: true, playerShuffled: response.result});
				} else {
					cb({success: false});
				}
			});
		} else { // If current channel have less occupied seats
			cb({success: true, isShuffleByTableId: false});
		}
	} else { //No shuffling required
		serverLog(stateOfX.serverLogType.info,"NO SHUFFLING REQUIRED IN shufflingWithShuffleTableId IN playerShuffling");
		cb({success: true});
	}
};

//update table shuffle id
/**
 * this function updates table shuffle id
 * @method updateTableShuffleId
 * @param  {object}             channelToBeFilledId 
 * @param  {string}             channelId           
 * @param  {Function}           cb                  callback function
 */
var updateTableShuffleId = function(channelToBeFilledId,channelId, cb) {
	serverLog(stateOfX.serverLogType.info,"channelToBeFilled and channelId is in updateTableShuffleId is in playerShuffling is - ",channelToBeFilledId,channelId);
	imdb.updateTableShuffleId(channelToBeFilledId,channelId, function(err, result) {
		if(err || !result) {
			serverLog(stateOfX.serverLogType.info,"Error in updateTableShuffleId in playerShuffling");
			cb({success:false});
		}
		cb({success:true});
	});

};

/**
 * this function shuffles without shuffle table id
 * @method shufflingWithoutShuffleTableId
 * @param  {object}                       channelToBeFilled 
 * @param  {object}                       params            
 * @param  {Function}                     cb                callback function
 */
var shufflingWithoutShuffleTableId = function(channelToBeFilled, params, cb) {
	serverLog(stateOfX.serverLogType.info,"channelToBeFilled is in shufflingWithoutShuffleTableId in playerShuffling is - ",JSON.stringify(channelToBeFilled));
	serverLog(stateOfX.serverLogType.info,"table is in shuflingWithoutShuffleTableId in playerShuffling is - ",JSON.stringify(params));
	if(isShufflingRequired(channelToBeFilled, params.table)) {
		serverLog(stateOfX.serverLogType.info,"Shuffling is required in shufflingWithoutShuffleTableId",params.table.players.length,channelToBeFilled.players.length);
		if(params.table.players.length > channelToBeFilled.players.length) { // If current channel have more occupiedseats
			mergeTwoTables(channelToBeFilled, params, function(response) { //merge two tables
				if(response.success) {
					serverLog(stateOfX.serverLogType.info,"channel merge successfully in shufflingWithShuffleTableId in playerShuffling",response);
					var playerShuffled = !!response.result ? response.result : [];
					cb({success: true, playerShuffled: playerShuffled});
				} else {
					cb({success: false});
				}
			});
		} else {
			updateTableShuffleId(channelToBeFilled.channelId, params.table.channelId, function(response) {
				serverLog(stateOfX.serverLogType.info,"response is in shufflingWithoutShuffleTableId is in playerShuffling is ",response);
				if(response.success) {
					cb({success: true,playerShuffled: []});
				} else {
					cb({success: false});
				}
			});
		}
	} else {
		cb({success: true,playerShuffled: []});
	}
};

var prepareShiftedPlayersForChannelWithoutReduction = function(players) {
	serverLog(stateOfX.serverLogType.info,"players is in prepareShiftedPlayersForChannelWithoutReduction is in playerShuffling is - ",JSON.stringify(players));
	var shiftedPlayers = [];
	for(var playerIterator=0; playerIterator<players.length;playerIterator++) {
		shiftedPlayers.push({
			playerId : players[playerIterator].playerId,
			newChannelId : players[playerIterator].channelId
		});
	}
	serverLog(stateOfX.serverLogType.info,"shifted players is in prepareShiftedPlayersForChannelWithoutReduction is in playerShuffling is - ",shiftedPlayers);
	return shiftedPlayers;
};

/**
 * this funciton performs shuffling without channel reduction
 * @method shufflingWithoutChannelReduction
 * @param  {object}                      params request json object
 * @param  {Function}                    cb     callback function
 */
var shufflingWithoutChannelReduction = function(params, cb) {
	serverLog(stateOfX.serverLogType.info,"params is in shufflingWithoutChannelReduction is in players shuffling - ",JSON.stringify(params.table));
	params.allChannels = _.sortBy(params.allChannels, "vacantSeats").reverse();
	serverLog(stateOfX.serverLogType.info,"allChannels after sorting by occupiedSeats is in shufflingWithoutChannelReduction in playerShuffling is - ",JSON.stringify(params.allChannels));
	//If table shuffle id is available
	if(!!params.table.shuffleTableId) {
		serverLog(stateOfX.serverLogType.info,"shuffle Id is available in shufflingWithoutChannelReduction in playerShuffling");
		// get the channel by which it is shuffled
		var channelToBeFilled = _.where(params.allChannels, {channelId: params.table.shuffleTableId});
		serverLog(stateOfX.serverLogType.info,"channel to be filled in shufflingWithoutChannelReduction in playerShuffling is - ",JSON.stringify(channelToBeFilled));
		// check that channel is still availble
		if(channelToBeFilled.length > 0) {
			//shuffle these two tables
			shufflingWithShuffleTableId(channelToBeFilled, params, function(response) {
				if(response.success) {
					serverLog(stateOfX.serverLogType.info,"response is in shufflingWithoutChannelReduction in playerShuffling is - ",JSON.stringify(response));
					if(!!response.isShuffleByTableId) { // Shuffle by table Id success just resturn table
						params.outOfMoneyPlayers = _.pluck(response.playerShuffled,"playerId");
						serverLog(stateOfX.serverLogType.info,"params.outOfMoneyPlayers are in shufflingWithShuffleTableId() is -"+params.outOfMoneyPlayers);
						params.table.shuffleTableId = "";
						cb(response);
					} else { //Shuffle by tableId not happen
						//try to shuffle by sort players
						shufflingWithoutShuffleTableId(params.allChannels[0], params, function(response) {
							if(response.success) {
								serverLog(stateOfX.serverLogType.info,"response is in shuffling without channel reduction - ",response);
								cb(response);
							} else {
								cb(response);
							}
						});
					}
				} else {
					cb(response);
				}
			});
		} else {// that channel is not availble
			serverLog(stateOfX.serverLogType.info,"TABLE TO BE FILLED MAY BE REMOVE IN shufflingWithoutChannelReduction IN playerShuffling");
			cb({success:true});
		}
	} else { // if table shuffle id is not availabe available
		serverLog(stateOfX.serverLogType.info,"shuffle id is not available in shufflingWithChannelReduction is in playerShuffling");
		shufflingWithoutShuffleTableId(params.allChannels[0],params, function(response) {
			serverLog(stateOfX.serverLogType.info,"response of shufflingWithoutShuffleTableId in playerShuffling is - ",response);
			cb(response);
		});
	}
};

// preparing array for sending broadcast later
/**
 * this function prepares array for sending broadcast later
 * @method prepareShiftedPlayers
 * @param  {array}              players players array
 */
var prepareShiftedPlayers = function(players) {
	serverLog(stateOfX.serverLogType.info,"players is in prepareShiftedPlayers in players shuffling is - ",JSON.stringify(players));
	var shiftPlayers = [];
	var shiftedPlayersData = [];
	for(var channelIterator=0; channelIterator<players.length; channelIterator++) {
		var playersArray = players[channelIterator].players;
		serverLog(stateOfX.serverLogType.info,"playersArray - ",JSON.stringify(players[channelIterator]));
		for(var playerIterator=0; playerIterator<playersArray.length; playerIterator++) {
			playersArray[playerIterator].channelId = players[channelIterator].channelId;
			shiftedPlayersData.push(playersArray[playerIterator]);
			shiftPlayers.push({
				playerId: playersArray[playerIterator].playerId,
				newChannelId : players[channelIterator].channelId
			});
		}
	}
	serverLog(stateOfX.serverLogType.info,"shiftPlayers is in prepareShiftedPlayers are - ",shiftPlayers);
	return {
		shiftPlayers: shiftPlayers,
		shiftedPlayersData: shiftedPlayersData
	};
};


/**
 * this funciton performs shuffling with channel reduction
 * @method shufflingWithChannelReduction
 * @param  {object}                      params request json object
 * @param  {Function}                    cb     callback function
 */
var shufflingWithChannelReduction = function(params, cb) {
	serverLog(stateOfX.serverLogType.info,"params is in shufflingWithChannelReduction is in playerShuffling is - ",JSON.stringify(params));
	params.allChannels = _.sortBy(params.allChannels, "vacantSeats");
	serverLog(stateOfX.serverLogType.info,"params.allChannels after sorting by vacant seats in shufflingWithChannelReduction in playerShuffling is -  ",JSON.stringify(params.allChannels));
	var playersToPush = preparePlayersToPush(params.allChannels,params.table);
	serverLog(stateOfX.serverLogType.info,"player to push in shuffling with channel reduction in playerShuffling",JSON.stringify(playersToPush));
	params.shiftedPlayers = (prepareShiftedPlayers(playersToPush)).shiftPlayers;
	//params.shiftedPlayersData = (prepareShiftedPlayers(playersToPush)).shiftedPlayersData;
	//serverLog(stateOfX.serverLogType.info,"prepare shiftedPlayersData is in shufflingWithChannelReduction is - ",JSON.stringify(params.shiftedPlayersData));
	async.eachSeries(playersToPush, function(player, callback) {
		pushPlayersInToNewChannel(player.players, player.channelId, function(response) {
			if(response.success) {
				serverLog(stateOfX.serverLogType.info,"players pushed in to new channel successfully partial",JSON.stringify(response));
				params.shiftedPlayersData = _.union(params.shiftedPlayersData,response.result);
				callback();
			} else {
				serverLog(stateOfX.serverLogType.info,"failed to push new player into channel");
				cb(response);
			}
		});
	}, function(err) {
		if(err) {
			cb(params);
		} else {
			serverLog(stateOfX.serverLogType.info,"all player shuffled successfully in shuffling with channelReduction",JSON.stringify(params));
			cb({success: true, result:params});
		}
	});
};

/**
 * this function process shuffling both with or without channelReduction
 * @method processShuffling
 * @param  {[type]}         params [description]
 * @param  {Function}       cb     [description]
 * @return {[type]}                [description]
 */
var processShuffling = function(params, cb) {
	serverLog(stateOfX.serverLogType.info,"params is in processShuffling in playerShuffling is - ",JSON.stringify(params));
	if(params.isChannelReductionPossible) {
		shufflingWithChannelReduction(params, function(shufflingWithChannelReductionResponse) {
			serverLog(stateOfX.serverLogType.info,"shufflingWithChannelReductionResponse is in process shuffling is in playerShuffling is - ",JSON.stringify(shufflingWithChannelReductionResponse));
			serverLog(stateOfX.serverLogType.info,"shufflingWithChannelReductionResponse is in processShuffling is - ",shufflingWithChannelReductionResponse.success);
			if(shufflingWithChannelReductionResponse.success) {
				cb(null,shufflingWithChannelReductionResponse.result);
			} else {
				cb(shufflingWithChannelReductionResponse);
			}
		});
	} else {
		shufflingWithoutChannelReduction(params, function(shufflingWithoutChannelReductionResponse) {
			serverLog(stateOfX.serverLogType.info,"shufflingWithoutChannelReductionResponse is in processShuffling is in playerShuffling is - ",JSON.stringify(shufflingWithoutChannelReductionResponse));
			if(shufflingWithoutChannelReductionResponse.success) {
				params.shiftedPlayers = prepareShiftedPlayersForChannelWithoutReduction(shufflingWithoutChannelReductionResponse.playerShuffled);
				params.shiftedPlayersData = shufflingWithoutChannelReductionResponse.playerShuffled;
				serverLog(stateOfX.serverLogType.info,"shifted players are in process shuffling-------", params.shiftedPlayersData);
				cb(null, params);
			} else {
				cb(shufflingWithoutChannelReductionResponse);
			}
		});
	}
};

// remove shifted players from current channel
/**
 * this function removes shifted players from current chaanel
 * @method removeShiftedPlayers
 * @param  {object}             params request json object
 * @param  {Function}           cb     callback function
 */
var removeShiftedPlayers = function(params,cb) {
	serverLog(stateOfX.serverLogType.info,"params is in remove shifted players are in playerShuffling is - ",JSON.stringify(params.shiftedPlayers));
	serverLog(stateOfX.serverLogType.info,"params is in remove shifted players -  ",JSON.stringify(params));
	serverLog(stateOfX.serverLogType.info,"shiftedPlayers.length",params.shiftedPlayers.length);
	if(params.shiftedPlayers.length>0) {
		serverLog(stateOfX.serverLogType.info,"in params.shiftedPlayers.length is ----------------");
		// var playerIds = _.pluck(params.shiftedPlayers,"playerId");
		// serverLog(stateOfX.serverLogType.info,"playerIds to be remove from current channel in removeShiftedPlayers in playerShuffling is - ",JSON.stringify(playerIds));
		// imdb.pullPlayersFromTable(playerIds,params.table.channelId, function(err, result) {
		// 	if(err) {
		// 		serverLog(stateOfX.serverLogType.info,"Error in remove shift players from inMemoryDb db");
		// 		cb(params);
		// 	}
		// 	serverLog(stateOfX.serverLogType.info,"successfully remove players from db");
		// 	cb(null,params);
		// })
		// params.shiftedPlayers =
		var newPlayers = [];
		for(var playerIterator=0; playerIterator<params.table.players.length; playerIterator++) {
			var countPlayers = 0;
			for(var shiftedPlayersIterator=0; shiftedPlayersIterator< params.shiftedPlayers.length; shiftedPlayersIterator++) {
				if(params.table.players[playerIterator].playerId === params.shiftedPlayers[shiftedPlayersIterator].playerId) {
					countPlayers++;
				}
			}
			if(countPlayers === 0) {
				serverLog(stateOfX.serverLogType.info,"new player is in removeShiftedPlayers is - ",params.table.players[playerIterator]);
				newPlayers.push(params.table.players[playerIterator]);
			}
		}
		serverLog(stateOfX.serverLogType.info,"new players is in removeShiftedPlayers is - ", JSON.stringify(newPlayers));
		params.table.players = newPlayers;
		cb(null, params);
	} else {
		cb(null,params);
	}
};

/**
 * this function updates seats and shuufle id
 * @method updateSeatsAndShuffleId
 * @param  {object}                params request json object
 * @param  {Function}              cb     callback function
 */
var updateSeatsAndShuffleId = function(params,cb) {
	serverLog(stateOfX.serverLogType.info,"params is in updateSeatsAndShuffleId is in playerShuffling is - ",JSON.stringify(params));
	params.table.occupiedSeats = params.table.occupiedSeats - params.outOfMoneyPlayers.length;
	params.table.vacantSeats = params.table.vacantSeats + params.outOfMoneyPlayers.length;
	async.eachSeries(params.shiftedPlayers, function(players, callback) {
		serverLog(stateOfX.serverLogType.info,"players is in updateSeatsAndShuffleId is - ",players);
		imdb.getTable(players.newChannelId, function(err, result) {
			if(err || !result) {
				cb({success: false, info: messages.IMDB_GETTABLE_UPDATESEATSANDSHUFFLEID_FAILED_PLAYERSHUFFLING, isRetry: false, isDisplay: false, channelId:(players.newChannelId || "")});
			} else {
				var updateFields = {};
				if(result.channelId != params.table.channelId) {
					updateFields.vacantSeats = result.maxPlayers - result.players.length;
					updateFields.occupiedSeats = result.players.length;
				} else {
					updateFields.shuffleTableId = "";
				}
				imdb.updateSeats(params.table.channelId, updateFields, function(err, response) {
					if(err || !response) {
						cb({success: false, info: dbMessages.IMDBUPDATESEATS_UPDATESEATSANDSHUFFLEID_FAILED_PLAYERSHUFFLING, isRetry: false, isDisplay: false, channelId:(params.table.channelId || "")});
					} else {
						callback();
					}
				});
			}
		});
	}, function(err) {
		if(err) {
			cb(params);
		}	else {
			cb(null,params);
		}
	});
};

/**
 * this function contains the entire shuffle processs in series of steps
 * @method shuffle
 * @param  {object}   params requst json object
 * @param  {Function} cb     callback function
 */
playerShuffling.shuffle = function(params, cb) {
	serverLog(stateOfX.serverLogType.info,"params in shuffle in playerShuffling is - " + JSON.stringify(params));
	getTournamentRoom(params.table.tournamentRules.tournamentId, function(tournamentResponse) {
		if(tournamentResponse.success) {
			if(params.table.roundCount === 1 || !tournamentResponse.isTournamentRunning) {
				serverLog(stateOfX.serverLogType.info,"This is first round no need to shuffle or may be tournament is not running rigth now satellite case !!!");
				params.data.isPlayerShuffled = false;
				params.data.success 			= true;
				cb({success: true, table: params.table, data: params.data});
				return;
			} 
			dynamicRanks.getRegisteredTournamentUsers(params.table.tournamentRules.tournamentId,params.table.gameVersionCount);
			if(params.table.channelType === stateOfX.gameType.tournament) {
				getAllChannels(params.table.tournamentRules.tournamentId, params.table.gameVersionCount, function(channelsResponse) {
					// check whether more than one channel available
					if(channelsResponse.success && channelsResponse.result.length > 1) {
						serverLog(stateOfX.serverLogType.info,"going for async operation in shuffle in playerShuffling---------------");
						async.waterfall([
							async.apply(initializeParams,params),
							removeOutOfMoneyPlayers,
							updateSeats,
							checkChannelReduction,
							processShuffling,
							removeShiftedPlayers,
							updateSeatsAndShuffleId
						], function(err, response) {
							if(!err && !!response) {
								serverLog(stateOfX.serverLogType.info,"async end successfully in shuffle",JSON.stringify(response));
								response.isPlayerShuffled = true;
								response.success 			= true;
								response.tournamentId = response.table.tournamentRules.tournamentId;
								cb({success: true, table: response.table, data: _.omit(response, 'table')});
							} else {
								serverLog(stateOfX.serverLogType.info,"Error in async in shuffle");
								cb(err);
							}
						});
					} else {
						serverLog(stateOfX.serverLogType.info,"*********** NO NEED TO SHUFFLE CHANNEL ONLY ONE CHANNEL AVAILABLE *************" + JSON.stringify(channelsResponse));
						params.data.isPlayerShuffled = false;
						params.data.success 			= true;
						cb({success: true, table: params.table, data: params.data});
					}
				});
			} else {
				serverLog(stateOfX.serverLogType.info,"No need to shuffling this is not a tournament");
				params.data.isPlayerShuffled = false;
				params.data.success 			= true;
				cb({success:true, table: params.table, data: params.data});
			}
		} else {
			cb(tournamentResponse);			
		}
	});
};

module.exports = playerShuffling;
