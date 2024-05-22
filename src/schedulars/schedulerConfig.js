/*jshint node: true */
"use strict";

/**
 * Created by Sushil
 */
var stateOfX = {};

stateOfX.gameType 						= {};
stateOfX.gameType.normal 			= "NORMAL";
stateOfX.gameType.tournament 	= "TOURNAMENT";

stateOfX.tournamentState 					= {};
stateOfX.tournamentState.register = "REGISTER";
stateOfX.tournamentState.running 	= "RUNNING";
stateOfX.tournamentState.finished = "FINISHED";
stateOfX.tournamentState.upcoming = "UPCOMING";

stateOfX.tournamentType 					= {};
stateOfX.tournamentType.sitNGo 		= "SIT N GO";
stateOfX.tournamentType.normal 		= "NORMAL";
stateOfX.tournamentType.satelite 	= "SATELITE";

module.exports = stateOfX;