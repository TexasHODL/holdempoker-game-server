/*jshint node: true */
"use strict";

var prizeAlgo = require("./prizeAlgo.js");
var db = require("./model/dbQuery.js");

var prizeStructure = {};


/**
 * this function createDefaultPrizeStructure
 * @method rankInRoyalFlush
 * @param  {array}         params 
 * @return {object}                     
 */
prizeStructure.createDefaultPrizeStructure = function(params) {
  console.log("in createDefaultPrizeStructure",JSON.stringify(params));
  // var playerIt = params.minPlayers;
  // var prize = {};
  // while(playerIt <= params.maxPlayers) {
  //   console.log("playerIt is-",playerIt);
  //   var prizeStruct = prizeAlgo.prizeForDb(playerIt,params.minPlayers,params.entryFees);
  //   var key = playerIt.toString();
  //   console.log("key --",key);
  //   console.log(prizeStruct);
  //   prize[playerIt.toString()] = prizeStruct;
  //   playerIt++;
  // }
  var prizeObject = {
    "tournamentId": params.tournamentId,
    "prize": prizeAlgo.generalizePrizeStructure(params.maxPlayers,params.minPlayers,params.entryFees,0,0)
  };
  console.log(JSON.stringify(prizeObject));
  db.createPrizeRule(prizeObject,function(err,response){
    if(err){
      console.log(err);
    } else{
      console.log(response);
    }
  });
};
/**
 * this function deleteAndCreatePrizeRule
 * @method deleteAndCreatePrizeRule
 * @param  {array}         params 
 * @return {object}                     
 */
prizeStructure.deleteAndCreatePrizeRule = function(params){
  console.log("in deleteAndCreatePrizeRule",JSON.stringify(params));
  db.deletePrizeRule(params.tournamentId,function(err,response){
    if(err){
      console.log(err);
    } else{
      prizeStructure.createDefaultPrizeStructure(params);
    }
  });
};

module.exports = prizeStructure;

// prizeStructure.createDefaultPrizeStructure({"tournamentId":"abcd","minPlayers":5, "maxPlayers":30,"entryFees":100});
