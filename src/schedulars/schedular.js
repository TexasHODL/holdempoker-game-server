/*jshint node: true */
"use strict";

/*
	---- Created by Sushil on 3/9/2016
	---- This file contains schedular and should be run independently
*/

var mongo  	        = require("./asyncMongoConnection.js"),
		db              = require("./dbQueryForSchedular.js"),
		imdb            = require("./inMemoryQueryForSchedular.js"),
		schedulerConfig = require("./schedulerConfig.js"),
		_               = require("underscore"),
		schedule        = require('node-schedule'),
		async           = require("async");

//Reset in memory channels of tournament
var resetChannels = function(params) {
	console.log("params is in resetChannels are ",JSON.stringify(params));
	async.eachSeries(params, function(tournamentRoom, callback) {
		console.log("tournament Id is ",tournamentRoom._id);
		removeTableFromInMemory(tournamentRoom._id);
		callback();
	}, function(err) {
		if(err) {
			console.log("ERROR IN DELETING TABLE FROM MEMORY");
		} else {
			console.log("TABLE SUCCESSFULLY DELETED FROM DB");
		}
	});
};
/**
 * this function is used to deleteNormalTournamentTables 
 * @method deleteNormalTournamentTables
 * @param  {tournamentId}  
 */
var deleteNormalTournamentTables = function(tournamentId) {
	console.log("in deleteNormalTournamentTables in schedular - " + JSON.stringify(tournamentId));
	db.removeTables(tournamentId, function(err, result) {
		if(err) {
			console.log("Erorr in deleting tables from persistent db");
		} else {
			console.log("successfully deleted tables from persistent db");
		}
	});
};
/**
 * this function is used to deletePrizeRules 
 * @method deletePrizeRules
 * @param  {tournamentId}  
 */
var deletePrizeRules = function(tournamentId) {
	console.log("in deletePrizeRules in schedular - " + JSON.stringify(tournamentId));
	db.deletePrize(tournamentId, function(err, result) {
		if(err) {
			console.log("Error in deleting prize rules from persistent db");
		} else {
			console.log("successfully deleted prize rules from db");
		}
	});

};

/**
 * this function is used to remove table from in memory 
 * @method removeTableFromInMemory
 * @param  {tournamentId}  
 */
var removeTableFromInMemory = function(tournamentId) {
	console.log("tournamentId is ",tournamentId);
	imdb.getTables(tournamentId, function(err, allChannels) {
		if(err || !allChannels) {
			console.log("Error in getting channels from inmemory");
		} else {
			console.log('all channels are - ' + JSON.stringify(allChannels));
			var allInMemoryChannels = [];
			allInMemoryChannels = _.pluck(allChannels,"channelId");
			console.log('all channels are - ' + JSON.stringify(allInMemoryChannels));
			imdb.removeTables(tournamentId, function(err, result) {
				if(err || !result) {
					console.log("Error in removing tables from inmemory");
				} else {
					console.log("tables removed successfully");
					imdb.removeActivity({tableId: tournamentId.toString()}, function(err, result) {
						console.log('err and result is ',err,result);
						console.log('activity record deleted successfully');
						if(err) {
							console.log('Error in removing player record from in memory');
						} else {
							console.log('In MEMORY record successfully deleted from memory');
							// delete record by channel id
							imdb.removeTablesByChannelId(allInMemoryChannels, function(err, result) {
								console.log('err and result is ',err,result);
								console.log('activity record deleted successfully');
								if(err) {
									console.log('Error in removing player record from in memory by channelId');
								} else {
									console.log('In MEMORY record successfully deleted from memory by channelId');
								}
							});
						}
					});
				}
			});
		}
	});
};

/**
 * setScheduled 
 * @method setScheduled  
 * @param  {room}  
 */
var setScheduled = function(room) {
	console.log("in setScheduled in schedular - " + JSON.stringify(room));
	var newTournamentStartTime = room.tournamentStartTime + room.recurringTime*3600000;
	console.log("newTournamentStartTime is in set Schedule - " + newTournamentStartTime);
	db.updateTournamentRoom({_id:room._id},{isSchedule: true, tournamentStartTime: newTournamentStartTime, state:schedulerConfig.tournamentState.upcoming},function(err, result) {
		if(err) {
			console.log("Eror in update tournaments is in setScheduled");
		} else {
			console.log("tournament updated",JSON.stringify(result.value));
		}
	});
};

/**
 * Change upateNormalTournament 
 * @method upateNormalTournament
 * @param  {room}  
 */
var upateNormalTournament = function(room) {
	console.log("in updateTournament is - " + JSON.stringify(room));
	var query = {
		_id: room._id,
	};
	var newTournamentStartTime = room.tournamentStartTime + room.recurringTime*3600000;
	var updatedKeys = {
		tournamentStartTime	: newTournamentStartTime,
		gameVersionCount		: ++room.gameVersionCount,
		state								: schedulerConfig.tournamentState.register,
		isSchedule					: false
	};
	console.log("query and updatedKeys isi in modifyNormal is - ",query, updatedKeys);
	db.updateTournamentRoom(query,updatedKeys,function(err, result) {
		if(err) {
			console.log("Eror in update tournaments is in modifyNormal");
		} else {
			console.log("tournament updated",JSON.stringify(result.value));
		}
	});
};


/**
 * Change tournament state to finished and schedule this tournamnet
 * @method modifyNormal
 * @param  {list}  
 */
var modifyNormal = function(list) {
	console.log("tournaments are in modifyNormal ",JSON.stringify(list));
	async.eachSeries(list,function(room, callback) {
		var registrationTime = room.tournamentStartTime + room.recurringTime*3600000 - room.registrationBeforeStarttime*60000;
		console.log("registration time is in modifyNormal is - " + registrationTime);
		schedule.scheduleJob(registrationTime, function(){
		  console.log('Schedular is going to change the state to regiser of normal tournamant' + new Date());
		  upateNormalTournament(room);
			removeTableFromInMemory(room._id);
			deleteNormalTournamentTables(room._id);
			deletePrizeRules(room._id);
		});
		setScheduled(room, function(){
			callback();
		});
	},function(err) {
		if(err) {
			console.log("Erorr occured in async in modify normal tournament");
		} else {
			console.log("tournaments successfully modified");
			// resetNormalTournament(list);
		}
	});
};

/**
 * Function for modifySitNGo
 * @method modifySitNGo
 * @param  {list}  
 */
var modifySitNGo = function(list) {
	var tournamentIds = _.pluck(list,"_id");
	console.log("tournament ids are",tournamentIds);
	db.updateTournament(tournamentIds,function(err) {
		if(err) {
			console.log("error in updating state");
		} else {
			console.log("successfully changed the state");
			resetChannels(list);
		}
	});
};



/**
 * Function for tournamentStart
 * @method tournamentStart
 * @param  {Object}  
 * cb callback function
 */
var tournamentStart = function() {
	var filterForRoom = {
		channelType: schedulerConfig.gameType.tournament,
		state: schedulerConfig.tournamentState.finished,
		isRecurring: true
	};
	db.findTournamentRoom(filterForRoom, function(err, rooms) {
		if(err || !rooms) {
			console.log("no room found in tournamentStart schedular");
		} else {
			console.log("room is in tournamentStart is", JSON.stringify(rooms));
			var sitNGo = _.where(rooms,{tournamentType: schedulerConfig.tournamentType.sitNGo});
			var normal = _.where(rooms,{tournamentType: schedulerConfig.tournamentType.normal,isSchedule:false});
			console.log("sitNGo tournament is --",JSON.stringify(sitNGo));
			console.log("normal tournament is --",JSON.stringify(normal));
			if(sitNGo.length > 0) {
				modifySitNGo(sitNGo);
			}
			if(normal.length > 0) {
				modifyNormal(normal);
			}
		}
	});
};


/**
 * Function for getting tournament that are upcoming
 * @method getTournamentRooms
 * @param  {Object} password should contain atleast one digit and caps letter
 */
var getTournamentRooms = function(params, cb) {
	console.log("Inside get tournament rooms");
	var filterForRoom = {
		channelType: schedulerConfig.gameType.tournament,
		state: schedulerConfig.tournamentState.upcoming,
		isRegistrationScheduled: false,
		tournamentType: schedulerConfig.tournamentType.normal
	};
	console.log("filterForRoom in getTournamentRooms is",JSON.stringify(filterForRoom));
	db.findTournamentRoom(filterForRoom, function(err, rooms) { //find tournament rooms for which registration is not scheduled and which are  upcoming
		if(err || rooms.length < 1 || !rooms) {
			console.log("no room found in tournamentStart schedular getTournamentRooms");
			cb({ success: false});
		} else {
			console.log("room in getTournamentRooms is", JSON.stringify(rooms));
			params.tournamentRoomData = rooms;
			cb(null,params);
		}
	});

};


/**
 * function to update late Registration time
 * @method getBlindLevelTime
 * @param  {Object} params
 * cb callback function
 */
var getBlindLevelTime = function(params,cb){
	console.log("Inside get BlindLevelTime ");
	var rooms = params.tournamentRoomData;
	console.log(rooms);
	var levelToUpdate,toSeconds,levelToUpdateOfRebuy;  
	async.eachSeries(rooms, function(tournamentRoom, callback) { //for each room find the lateRegistration Time and update in db 
		console.log("tournament Id is ",tournamentRoom._id);
		console.log("Blind Rule is", tournamentRoom.blindRule);
		console.log("The lateRegistraionUptoBlindlevel is ",tournamentRoom.lateRegistrationUptoBlindLevel);
		levelToUpdate = tournamentRoom.lateRegistrationUptoBlindLevel;
		levelToUpdateOfRebuy = tournamentRoom.rebuyUptoBlindLevel;
		db.findBlindRule(tournamentRoom.blindRule,function(err,result){  //according to the blindRule find the level to update from the collection blindRules
			if(!err && result){
				console.log("The blindRule details are ",result);
				console.log("The value of level to update is ", result.list[levelToUpdate - 1]);
				var userData = {};
				userData.lateRegistrationTime =  result.list[levelToUpdate - 1].minutes; //find lateRegistrationTime according to the blindRules collection
				userData.isRegistrationScheduled = true; 
				userData.rebuyTime = result.list[levelToUpdateOfRebuy - 1].minutes ; //find rebuyTime according to the blindRules collection
				db.updateTournamentGeneralize(tournamentRoom._id,userData,function(err,result){ //update the lateRegistrationTime,isRegistrationScheduled and rebuyTime according to the blind level
					if(!err && result){
						console.log("The updated data is",result);
						callback();
					}else{
						console.log("Error Occured in updating data in getBlindLevelTime");
						callback();
					}
				});
			}else{
				console.log("Some Error Occured");
				callback();
			}
		});
	}, function(err) {
		if(err) {
			console.log("ERROR IN GETTING BLIND LEVEL");
			cb(err);
		} else {
			console.log("NO ERROR IN GETTING BLIND LEVEL");
			cb(null,params);
		}
	});
	

};


/**
 * function to start scheduler and update the tournament state to register
 * @method startScheduler
 * @param  {Object} params 
 * cb callback function
 */
var startScheduler = function(params,cb){
	console.log("Inside startScheduler");
	console.log(params);
	if(params.tournamentRoomData){
		var rooms = params.tournamentRoomData;
	}
	var schedularStartTime ;
	async.eachSeries(rooms, function(tournamentRoom, callback) { 
		console.log("tournament room in startScheduler is ",tournamentRoom);
		schedularStartTime = (tournamentRoom.tournamentStartTime - tournamentRoom.registrationBeforeStarttime * 60000); //schedular will start at tournamentStartTime - registrationBeforeStarttime
		console.log("The schedularStartTime for the room is ", schedularStartTime);
		schedule.scheduleJob(schedularStartTime, function(){ //start the scheduler and update the value of tournament state to register
		  console.log('Schedular is going to start scheduler at ' + new Date());
		  db.updateTournamentState(tournamentRoom._id,schedulerConfig.tournamentState.register,function(err,result){ //set the tournament state to register after scheduler start
		  	console.log("Result after updating the scheduler is ", result);
		  	if(!err){
		  		console.log("Tournament state has been changed to register");
		  		callback();
		  	}else{
		  		console.log("Tournament state is not changed");
		  		callback();
		  	}
		  });
		  
		});

	}, function(err) {
		if(err) {
			console.log("ERROR IN STARTING THE SCHEDULAR");
			cb(err);
		} else {
			console.log("NO ERROR IN STARTING THE SCHEDULAR");
			cb(null,params);
		}
	});

};


/**
 * function to Implement late updateDataForLateRegistration with the 
 * @method updateDataForLateRegistration 
 */
var updateDataForLateRegistration = function(){
	var params = {};
  async.waterfall([
      async.apply(getTournamentRooms, params),
      getBlindLevelTime,
      startScheduler
      ], function(err, result){
      if(err){
          console.log("Some error occured",err);
      }
      else{
          console.log("No error occured");
      }
  });


};





/**
 * All schedular functions are called in this block after connection with mongo established
 * @method init
 * @param  {Object} response 
 */
mongo.init(function(response) {
	if(response.success) {
		console.log("response of mongo connection",response);
		schedule.scheduleJob('*/20 * * * * *', function(){
		  console.log('The answer to life, the universe, and everything!',new Date());
		  tournamentStart();
		  updateDataForLateRegistration();
		});
	} else {
		console.log("Error in mongo connection");
	}
});

// '* * * * * *' - runs every second
// '*/5 * * * * *' - runs every 5 seconds
// '10,20,30 * * * * *' - run at 10th, 20th and 30th second of every minute
// '0 * * * * *' - runs every minute
// '0 0 * * * *' - runs every hour (at 0 minutes and 0 seconds)
