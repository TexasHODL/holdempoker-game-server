/*jshint node: true */
"use strict";

var getFiltersFromDb = {},
    stateOfX         = require("../../../../shared/stateOfX.js"),
    _                = require("underscore"),
    db               = require("../../../../shared/model/dbQuery.js");


// fetch all kinds of tables 
// and generate filters
getFiltersFromDb.generateResponse = function(cb){
  db.listTable({channelType: stateOfX.gameType.normal},function(err,normalResponse){
    if(err){
      cb({success: false, info: 'db query failed - normalResponse'}, normalResponse);
    } else{
      db.listTournamentRoom({tournamentType: stateOfX.tournamentType.sitNGo,state: stateOfX.tournamentState.register},function(err,sitngoResponse){
        if(err){
          cb({success: false, info: 'db query failed - sitngoResponse'}, sitngoResponse);
        } else{ 
          db.listTournamentRoom({tournamentType: {$ne: stateOfX.tournamentType.sitNGo},state: stateOfX.tournamentState.register},function(err,tournamentResponse){
            if(err){
              cb({success: false, info: 'db query failed - tournamentResponse'}, tournamentResponse);
            } else{
                cb({success:true,
                  normal:{
                    speed           : _.uniq(_.pluck(normalResponse,'turnTime').sort(function(a, b){return a-b;})),
                    smallBlind      : _.reject(_.uniq(_.pluck(normalResponse,'smallBlind').sort(function(a, b){return a-b;})), function(num){ return num == -1; }),
                    bigBlind        : _.reject(_.uniq(_.pluck(normalResponse,'bigBlind').sort(function(a, b){return a-b;})), function(num){ return num == -1; }),
                    game            : _.reject(_.uniq(_.pluck(normalResponse,'channelVariation').sort(function(a, b){return a-b;})), function(variation){ return variation == stateOfX.channelVariation.ofc; }),
                    playersRequired : _.uniq(_.pluck(normalResponse,'maxPlayers').sort(function(a, b){return a-b;}))
                  },
                  sitNGo:{
                    speed           : _.uniq(_.pluck(sitngoResponse,'turnTime').sort(function(a, b){return a-b;})),
                    playersRequired : _.uniq(_.pluck(sitngoResponse,'maxPlayersForTournament').sort(function(a, b){return a-b;})),
                    game            : _.uniq(_.pluck(sitngoResponse,'channelVariation').sort(function(a, b){return a-b;})),
                    buyIn           : _.uniq(_.pluck(sitngoResponse,'buyIn').sort(function(a, b){return a-b;}))
                  },
                  tournament:{
                    game      : _.uniq(_.pluck(tournamentResponse,'channelVariation').sort(function(a, b){return a-b;})),
                    buyIn     : _.uniq(_.pluck(tournamentResponse,'buyIn').sort(function(a, b){return a-b;})),
                    type      : _.uniq(_.pluck(tournamentResponse,'tournamentType').sort(function(a, b){return a-b;})),
                    starting  : _.uniq(_.pluck(tournamentResponse,'tournamentStartTime').sort(function(a, b){return a-b;}))
                  }
              });
            }
          });
        }
      });
    }
  });
};

module.exports = getFiltersFromDb;