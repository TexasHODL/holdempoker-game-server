/*jshint node: true */
"use strict";

// Variables to be used in this file
var _ = require("underscore");
var keySets 					= {};
var responseSet 			= {};
var internalFunctions = {};
var handlerFunctions 	= {};
var responsibleText 	= "No prediction";


// Store all the dictionary for CONNECTOR server
keySets["connector"] = {
	enter: { playerId: "String", playerName: "String", isRequested: "Boolean" },
	singleLogin: { playerId: "String", isRequested: "Boolean" },
	joinChannel: { channelId: "String", playerId: "String", isRequested: "Boolean", playerName: "String", channelType: "String", tableId: "String" },
	sendSticker: { channelId: "String", senderId: "String", sendToAll: "Boolean", stickerId: "String", receiverId: "String" },
	autoSit: { channelId: "String", playerId: "String", isRequested: "Boolean", playerName: "String", seatIndex: "Integer", networkIp: "String", imageAvtar: "String" },
	joinPlayerToChannel: {/*selfi: "Object",*/ playerId: "String", playerName: "String", channel: "Object" },
	bindChannelInSession: {/*selfi: "Object",*/ channelId: "String", session: "Object" },
	createChannel: {/*selfi: "Object",*/ channel: "Object", channelId: "String", session: "Object" },
	joinChannelKeys: { table: "Object" },
	sitHere: { channelId: "String", playerId: "String", chips: "", seatIndex: "", playerName: "String", imageAvtar: "", isAutoReBuy: "", isRequested: "Boolean" },
	processSit: {/*selfi: "Object",*/ session: "Object", playerId: "String", chips: "Integer", seatIndex: "" },
	validateProfileAmount: {/*selfi: "Object",*/ session: "Object", playerId: "String" },
	validateSeatOccupancy: {/*selfi: "Object",*/ session: "Object", channelId: "String", seatIndex: "" },
	validateBuyInAllowed: {/*selfi: "Object",*/ session: "Object", channelId: "String", chips: "" },
	startGame: {/*selfi: "Object",*/ session: "Object", channelId: "String", channel: "String" },
	handleAdditionalCases: {/*selfi: "Object",*/ session: "Object", channelId: "String" },
	sendMessageToUser: {/*selfi: "Object",*/ msg: "Object", playerId: "String", route: "String" },
	depositInfo: { amount: "Number", userName: "String" },
	broadcastPlayer: { data: "Object", playerId: "String", route: "String" },
	broadcastPlayers: { data: "Object", route: "String" },
	fireCardDistributeBroadcast: {/*selfi: "Object",*/ players: "Array", channelId: "String" },
	updateProfile: { query: "", updateKeys: "" },
	getProfile: { playerId: "String", keys: "Object" },
	makeUnverified: {/*selfi: "Object",*/query: "", mobileNumber: "", emailId: "" },
	makeMove: { channelId: "String", playerId: "String", amount: "Integer", action: "String", isRequested: "Boolean" },
	bindUserSession: { playerId: "String", session: "String", /*selfi : ""*/ },
	isPlayerNotOnTable: {/*selfi: "Object",*/ session: "Object", channelId: "String", playerId: "String" },
	cashOutForPlayerAffilate: { playerId: "String", realChips: "" },
	acessToken: { access_token: "String" },
	processWithdraw: { walletAddress: "String", withdrawAmount: "Number"},
	fireSitBroadcast: {/*selfi: "Object",*/ channel: "Object", player: "", table: "Object" },
	fireSitBroadcastInShuffling: {/*selfi: "Object",*/ channelId: "String", playerId: "", playerName: "String", imageAvtar: "String" },
	fireTablePlayersBroadcast: {/*selfi: "Object",*/ channel: "Object", players: "Array", removed: "Array" },
	fireStartGameBroadcast: {/*selfi: "Object",*/ channel: "Object", session: "Object" },
	fireOnTurnBroadcast: {/*selfi: "Object",*/ channel: "Object", channelId: "String", playerId: "String", amount: "String", action: "String", chips: "", currentMoveIndex: "", moves: "", totalRoundBet: "", roundMaxBet: "", totalPot: "" },
	fireGameOverBroadcast: {/*selfi: "Object",*/ channel: "Object", session: "Object", channelId: "String", endingType: "String", winners: "Array" },
	fireDeductBlindBroadcast: { success: "String", channelId: "String", smallBlindChips: "String", bigBlindChips: "String", straddleChips: "String", smallBlindIndex: "String", bigBlindIndex: "String", straddleIndex: "String", smallBlind: "String", bigBlind: "String", pot: "String", totalPot: "String", moves: "String", forceBlind: "String" },
	fireRoundOverBroadcast: {/*selfi: "Object",*/ channel: "Object", roundName: "String", boardCard: "Array" },
	firePlayerStateBroadcast: { playerId: "String", channelId: "String", state: "String", channel: "Object" },
	fireBankruptBroadcast: {/*selfi: "Object",*/ playerId: "String", channelId: "String" },
	firePlayerEliminateBroadcast: {/*selfi: "Object",*/ playerId: "String", channelId: "String", tournamentId: "String" },
	firePlayerCoinBroadcast: { channelId: "channelId", playerId: "String", amount: "Integer", channel: "Object" },
	fireNewChannelBroadcast: { channelId: "channelId", playerId: "String" },
	autoJoinBroadcast: { channelId: "channelId", playerId: "String", /*selfi: "Object",*/ channelType: "String", tableId: "String", info: "String", forceJoin: "Boolean" },
	fireBroadcastOnSession: { session: "Object", broadcastName: "String", /*selfi: "Object",*/ broadcastData: "Object" },
	fireInfoBroadcastToPlayer: {/*selfi: "Object",*/ playerId: "String", heading: "String", info: "String", buttonCode: "Integer", channelId: "String" },
	fireInfoBroadcastToChannel: { channel: "Object", heading: "String", info: "String", channelId: "String" },
	fireChatBroadcast: { channel: "Object", channelId: "String", playerId: "String", playerName: "String", message: "String" },
	fireHandtabBroadcast: { channel: "Object", channelId: "String", handTab: "Object" },
	sendBroadcastForBreak: {/*selfi: "Object"*/ },
	sendBroadcastForBreakTimer: { channel: "Object", breakTime: "Number" },
	fireBroadcastForRebuyStatus: { channel: "Object", rebuyStatus: "Boolean" },
	fireBroadcastForRebuyAboutToEnd: { channel: "Object", rebuyTimeEnds: "Integer" },
	fireBroadcastForAddon: { route: "String", channel: "Object", info: "String" },
	fireAckBroadcastOnLogin: {/*selfi: "Object",*/ playerId: "String" },
	sendCustomMessageToUser: {/*selfi: "Object",*/ playerId: "String" },
	fireChatDisabled: { channelId: "String", channel: "Object" },
	fireStartTimeBank: { channel: "Object", channelId: "String", playerId: "String", timeBankLeft: "Integer", totalTimeBank: "Integer" },
	fireChannelBroadcast: { channel: "Object", data: "Object", route: "String" },
	updateBlind: { channel: "Object", data: "Object" },
	fireTournamentCancelledBroadcast: {/*selfi: "Object",*/ playerId: "String", tournamentId: "String", info: "String" },
	startTurnTimeOut: {/*selfi: "Object",*/ session: "Object", channel: "Object", channelId: "String" },
	autoActConnected: {/*selfi: "Object",*/ session: "Object", channel: "Object", channelId: "String" },
	autoActDisconnected: {/*selfi: "Object",*/ session: "Object", channel: "Object", channelId: "String" },
	performAutoSitout: {/*selfi: "Object",*/ session: "Object", channel: "Object", channelId: "String" },
	incrementAutoFold: {/*selfi: "Object",*/ session: "Object", channel: "Object", channelId: "String" },
	makePlayerObserver: {/*selfi: "Object",*/ session: "Object", channel: "Object", channelId: "String" },
	performCheckOrFold: {/*selfi: "Object",*/ session: "Object", channel: "Object", channelId: "String" },
	perfromPlayerMove: {/*selfi: "Object",*/ session: "Object", channel: "Object", channelId: "String", action: "String", amount: "Integer" },
	updateUser: { query: "Object", updateKeys: "Object" },
	leaveTable: { playerId: "String", channelId: "String", isStandup: "Boolean", isRequested: "Boolean", playerName: "String" },
	fireLeaveBroadcast: { data: "Object" },
	chat: { channelId: "String", playerName: "String", message: "String", isRequested: "Boolean" },
	sitoutNextHand: { channelId: "String", playerId: "String", isRequested: "Boolean" },
	sitoutNextBigBlind: { channelId: "String", playerId: "String", isRequested: "Boolean" },
	resume: { channelId: "String", playerId: "String", isRequested: "Boolean" },
	resumeAll: { playerId: "String", isRequested: "Boolean" },
	getLobbyTables: { isRealMoney: "Boolean", playerId: "String" },
	createTournamentTables: { tournamentId: "String" },
	reportIssue: { playerId: "String", issue: "String" },
	getIssue: { playerId: "String" },
	joinSimilarTable: { searchParams: "Object", playerId: "String", isRequested: "Boolean" },
	joinWaitingList: { playerId: "String", channelId: "String", playerName: "String", isRequested: "Boolean" },
	updatePrecheck: { playerId: "String", channelId: "String", precheckValue: "Number", isRequested: "Boolean" },
	registerTournament: { playerId: "String", tournamentId: "String", gameVersionCount: "String" },
	deRegisterTournament: { playerId: "String", tournamentId: "String", gameVersionCount: "String" },
	isRegisteredUserInTournament: { playerId: "String", tournamentId: "String", gameVersionCount: "String" },
	getRegisteredTournamentUsers: { tournamentId: "String", playerId: "String", gameVersionCount: "String" },
	getBlindAndPrize: { blindRule: "String", gameVersionCount: "Number", prizeRule: "String" },
	getBlindAndPrizeForNormalTournament: { tournamentId: "String" },
	getBlindAndPrizeForSatelliteTournament: { tournamentId: "String", gameVersionCount: "Number" },
	getPlayerPrize: { playerId: "String" },
	collectPrize: { playerId: "String", gameVersionCount: "Number", tournamentId: "String" },
	isConnected: { playerId: "String", channelId: "String" },
	fireAckBroadcast: {/*selfi: "Object",*/ channel: "Object", session: "Object" },
	validateTournamentStart: { tournamentId: "String", serverType: "String" },
	startTournament: { tournamentId: "String" },
	fetchTournamentTables: { tournamentId: "String", /*selfi:"Object",*/ session: "Object" },
	createChannelForTournament: { tournamentId: "String", /*selfi:"Object",*/ session: "Object", tables: "Object" },
	getTournamentUsers: { tournamentId: "String", /*selfi:"Object"*/ },
	joinChannelForTournament: { tournamentId: "String", /*selfi:"Object",*/ session: "Object", tables: "Object", channels: "Object", playerIds: "Array" },
	joinPlayerToChannelForTournament: { tournamentId: "String", /*selfi:"Object",*/ session: "Object", tables: "Object", channels: "Object", playerIds: "Array" },
	fireBroadcastForStartTournament: {/*selfi:"Object",*/ playerId: "String", channelId: "String", route: "String" },
	getBlindRules: { tournamentId: "String", /*selfi: "Object",*/ session: "Object" },
	quickSeat: { isRealMoney: "Boolean", channelVariation: "String", minBuyIn: "Number", maxPlayers: "Number" },
	quickSeatSitNGo: { isRealMoney: "Boolean", channelVariation: "String", buyIn: "Number", maxPlayersForTournament: "Number" },
	quickSeatTournament: { isRealMoney: "Boolean", channelVariation: "String", buyIn: "Number", maxPlayersForTournament: "Number", tournamentType: "String", timeSpan: "Number" },
	getFilters: {},
	addFavourateSeat: { playerId: "String", favourateSeat: "Object" },
	addFavourateTable: { playerId: "String", favourateTable: "Object" },
	removeFavourateSeat: { playerId: "String", channelId: "String" },
	removeFavourateTable: { playerId: "String", channelId: "String" },
	updateStackTable: { id: "String", stack: "Number" },
	updateStackTournamentRoom: { id: "String", stack: "Number" },
	addChipsOnTable: { channelId: "String", playerId: "String", amount: "Integer", isRequested: "Boolean" },
	disableForceBlind: { channelId: "String", playerId: "String", isRequested: "Boolean" },
	getTableStructure: { tournamentId: "String", gameVersionCount: "Number" },
	resetSitout: { channelId: "String", playerId: "String", isRequested: "Boolean" },
	setPlayerValueOnTable: { channelId: "String", playerId: "String", key: "String", value: "String", isRequested: "Boolean" },
	createNotes: { playerId: "String", forPlayerId: "String", notes: "String" },
	updateNotes: { query: "Object", updateKeys: "Object" },
	deleteNotes: { query: "Object" },
	getNotes: { playerId: "String", forPlayerId: "String" },
	processAutoSit: {/*selfi: "Object",*/ session: "Object", playerId: "String", channelId: "String" },
	// quickSeatInSitNGo 	 					: {gameVariation: "String", buyIn: "Number", turnTime: "Number", maxPlayersForTournament: "Number"},
	// quickSeatInTournament 	 			: {gameVariation: "String", buyIn: "Number", tournamentStartTime : "Number", tournamentType: "String"},
	getHandHistory								: {handHistoryId:"String"},
	getHandTab										: {channelId:"String"},
	insertVideoLog								: {channelId:"String", roundId:"String",logData: "Object"},
	processNextQueuedPlayer 			: {/*selfi: "Object",*/ session: "Object", channel: "Object", channelId: "String"},
	rebuyInTournament 			      : {playerId: "String", tournamentId: "String"},
	logout 			                  : {playerId: "String"},

	ofcJoinChannel 								: {channelId: "String", channelType: "String", playerId: "String", playerName: "String", isRequested: "Boolean"},
	ofcSit 												: {channelId: "String", playerId: "String", points: "Integer", seatIndex: "Integer", playerName: "String", imageAvtar: "String", isAutoReBuy: "Boolean", isRequested: "Boolean", networkIp: "String"},
	processOFCsit									: {/*selfi: "Object",*/ session: "Object", channel: "Object", channelId: "String", playerId: "String", points: "Integer", seatIndex: "Integer", playerName: "String", imageAvtar: "String", isAutoReBuy: "Boolean", isRequested: "Boolean", networkIp: "String"},
	
	fireOFCsitBroadcast 					: {channelId: "String", channel: "Object", player: "Object"},
	fireOFCgamePlayersBroadcast 	: {/*selfi: "Object",*/ channel: "Object", players: "Array", removed: "Array"},
	fireOFCstartGameBroadcast 		: {/*selfi: "Object",*/ channel: "Object", channelId: "String", dealerIndex: "Integer", currentMoveIndex: "Integer", state: "String", roundName: "String"},
	fireOFCplayerCards						: {/*selfi: "Object",*/ channelId: "String", playerId: "String", cards: "Object"},
	fireOFCplayerCardForView 			: {/*selfi: "Object",*/ channelId: "String", playerId: "String", cards: "Object", discarded: "Array"},
	fireOFCTurnBroadcast					: {channel: "Object", channelId: "String", playerId: "String", action: "String", currentMoveIndex: "Integer", playerName: "String", cards: "Array"},
	fireOFCgameOverBroadcast 			: {channel: "Object", channelId: "String", endingType: "String", winners: "Array", rakeDeducted: "Integer"},
	fireOFCleaveBroadcast 				: {data: "Object"},
	ofcFirePlayerPointsBroadcast 	: {channelId: "String", playerId: "String", amount: "Integer", channel: "Object"},
	ofcFirePlayerStateBroadcast 	: {channelId: "String", playerId: "String", state: "Integer"},
	fireOFCfirstRoundCards 				: {channelId: "String", playerId: "String", cards: "Array", channel: "Object"},

	ofcStartGame 									: {/*selfi: "Object",*/ channel: "Object", session: "Object", channelId: "String", eventName: "String"},
	ofcMakeMove 									: {channelId: "String", playerId: "String", cards: "Object", discarded: "Array", isRequested: "Boolean"},
	ofcLeaveTable 								: {playerId: "String", channelId: "String", isStandup: "Boolean", isRequested: "Boolean", playerName: "String"},
	ofcStartTurnTimeOut 					: {/*selfi: "Object",*/ session: "Object", channel: "Object", channelId: "String"},
	deductChipsInOfc 							: {playerId: "String", points: "Number", table: "Object"},
	addChipsInOfc 							  : {playerId: "String", points: "Number", table: "Object"},
	ofcAutoSit 										: {channelId: "String", playerId: "String", isRequested: "Boolean", playerName: "String", seatIndex: "Integer", networkIp: "String", imageAvtar: "String"},
	processOFCautoSit 						: {/*selfi: "Object",*/ session: "Object", channel: "Object", channelId: "String", playerId: "String", isRequested: "Boolean", playerName: "String", seatIndex: "Integer", networkIp: "String", imageAvtar: "String"},
	ofcAddPointsOnTable 				  : {channelId: "String", playerId: "String", amount: "Integer", isRequested: "Boolean"},
	ofcJoinWaitingList 						: {channelId: "String", playerId: "String", isRequested: "Boolean"},
	ofcJoinSimilar 								: {searchParams: "Object", playerId: "String", isRequested: "Boolean"},

	acknowledgeIsConnected 				: {playerId: "String", data: "Object"},
	leaveWaitingList 							: {playerId: "String", channelId: "String", playerName: "String", isRequested: "Boolean"},
	sendMessageToSessions         : {/*selfi: "Object",*/ data: "Object"},
	processOnlinePlayers          : {/*selfi: "Object"*/},
	getOnlinePlayer               : {/*selfi: "Object"*/},
	getVideo 											: {videoId: "String", playerId: "String", playerName : "String", isRequested: "Boolean"},
	fireBroadcastToAllSessions 		: {app: "Object", data: "Object", route: "String"},
	channelBroadcast							: {channelId: "String", data: "Object", route: "String"},

	updateAutoRebuy								: {playerId: "String",isAutoRebuy: "Boolean",channelId: "String"},
	updateAutoAddon								: {playerId: "String",isAutoAddOn: "Boolean",channelId: "String"},
	leaveTournament               : {playerId: "String", channelId: "String"},

 addScheduleServerDown					: {serverDownTime: "Number", serverUpTime: "Number"}
};

responseSet["connector"] = {
	enter													: {success: "Boolean"},
	updateProfile 								: {success: "Boolean"},
	joinChannel 									: {success: "Boolean", channelId: "String", playerId: "String", tableDetails: "Object"},
	sitHere 											: {success: "Boolean", channelId: "String"},
	setPlayerValueOnTable 				: {success: "Boolean", channelId: "String"},
	makeMove 											: {success: "Boolean", channelId: "String"},
	leaveTable 										: {success: "Boolean", channelId: "String"},
	sitoutNextHand 								: {success: "Boolean", channelId: "String"},
	sitoutNextBigBlind 						: {success: "Boolean", channelId: "String"},
	resetSitout 									: {success: "Boolean", channelId: "String"},
	isConnected 									: {success: "Boolean", channelId: "String"},
	resume 												: {success: "Boolean", channelId: "String"},
	removeWaitingPlayer 					: {success: "Boolean", channelId: "String"}
};
internalFunctions["connector"] 	= [	"joinPlayerToChannel", "createChannel", "joinChannelKeys",
																		"fireSitBroadcast", "validateProfileAmount", "validateSeatOccupancy", "validateBuyInAllowed",
																		"startGame", "fireTablePlayersBroadcast", "fireStartGameBroadcast", "fireCardDistributeBroadcast",
																		"sendMessageToUser","makeUnverified","bindUserSession", "fireOnTurnBroadcast", "isPlayerNotOnTable","cashOutForPlayerAffilate","acessToken",
																		"fireDeductBlindBroadcast", "fireRoundOverBroadcast","updateUser", "fireLeaveBroadcast", "fireGameOverBroadcast",
																		"handleAdditionalCases", "startTurnTimeOut", "fireAckBroadcast", "validateTournamentStart", "autoActConnected",
																		"autoActDisconnected","fetchTournamentTables","createChannelForTournament","getTournamentUsers","joinChannelForTournament",
																		"joinPlayerToChannelForTournament", "fireBroadcastForStartTournament","getBlindRules", "firePlayerStateBroadcast",
																		"autoActDisconnected", "performAutoSitout", "incrementAutoFold","makePlayerObserver", "performCheckOrFold", "perfromPlayerMove", "bindChannelInSession","firePlayerEliminateBroadcast", "fireTournamentCancelledBroadcast",
																		"firePlayerCoinBroadcast", "addChipsOnTable", "disableForceBlind", "resetSitout", "processSit", "setPlayerValueOnTable",
																		"fireSitBroadcastInShuffling","getPlayerPrize","collectPrize","fireNewChannelBroadcast", "fireBankruptBroadcast",
																		"fireInfoBroadcastToPlayer", "fireInfoBroadcastToChannel","fireBroadcastOnSession", "fireChatBroadcast","autoJoinBroadcast",
																		"fireHandtabBroadcast", "sendBroadcastForBreak", "processNextQueuedPlayer","sendBroadcastForBreakTimer","fireBroadcastForRebuyStatus", "fireBroadcastForRebuyAboutToEnd", "fireBroadcastForAddon",
																		"fireAckBroadcastOnLogin", "leaveWaitingList", "fireChatDisabled", "fireStartTimeBank","sendMessageToSessions","sendCustomMessageToUser",
																		"processOnlinePlayers", "fireBroadcastToAllSessions", "fireChannelBroadcast","updateBlind",

																		"fireOFCsitBroadcast", "fireOFCgamePlayersBroadcast", "fireOFCstartGameBroadcast", "fireOFCplayerCards", "fireOFCTurnBroadcast",
																		"fireOFCgameOverBroadcast", "fireOFCplayerCardForView","ofcLeaveTable", "fireOFCleaveBroadcast", "ofcFirePlayerPointsBroadcast",
																		"ofcFirePlayerStateBroadcast", "fireOFCfirstRoundCards"
																	];

handlerFunctions["connector"] = ["enter", "joinChannel", "sendSticker", "sitHere", "updateProfile", "makeMove", "leaveTable", "chat", "singleLogin",
	"sitoutNextHand", "sitoutNextBigBlind", "resume", "resumeAll", "getLobbyTables", "reportIssue", "getIssue",
	"createTournamentTables", "joinSimilarTable", "joinWaitingList", "registerTournament", "deRegisterTournament",
	"isConnected", "startTournament", "quickSeat", "quickSeatSitNGo", "quickSeatTournament", "getFilters", "addFavourateSeat", "addFavourateTable", "removeFavourateSeat", "getProfile",
	"removeFavourateTable", "updateStackTable", "updateStackTournamentRoom", "isRegisteredUserInTournament", "getRegisteredTournamentUsers",
	"getTableStructure", "getBlindAndPrize", "getBlindAndPrizeForNormalTournament", "getBlindAndPrizeForSatelliteTournament", "quickSeatInSitNGo", "quickSeatInTournament", "getHandHistory", "getVideo",
	"getHandTab", "insertVideoLog", "autoSit", "createNotes", "getNotes", "updateNotes", "deleteNotes", "getTable", "processAutoSit", "rebuyInTournament", "logout",
	"acknowledgeIsConnected", "getOnlinePlayer", "depositInfo", "broadcastPlayer", "broadcastPlayers", "channelBroadcast", "updateAutoRebuy", "updateAutoAddon",
	"leaveTournament", "ofcJoinChannel", "ofcSit", "processOFCsit", "ofcStartGame", "ofcMakeMove", "ofcStartTurnTimeOut", "deductChipsInOfc", "addChipsInOfc",
	"ofcAutoSit", "processOFCautoSit", "ofcAddPointsOnTable", "ofcJoinChannel", "ofcSit", "processOFCsit", "ofcStartGame", "ofcMakeMove", "ofcStartTurnTimeOut",
	"deductChipsInOfc", "addChipsInOfc", "ofcJoinWaitingList", "ofcJoinSimilar", "addScheduleServerDown", "updatePrecheck"
];

// Store all the dictionary for DATABASE server
keySets["database"] = {
	createTable 									: {channelId: "String", channelName: "", channelType: "", channelVariation: "", turnTime: "", maxPlayers: "", minPlayers: "", smallBlind: "", bigBlind: "", isStraddleEnable: "", minBuyIn: "", maxBuyIn: "", numberOfRebuyAllowed: "", gameInfo: "", /*rakeRule: "",*/ gameInterval: ""},
	getTable 											: {channelId: "String"},
	getPlayers 										: {channelId: "String"},
	addWaitingPlayer 							: {channelId: "String", playerId: "String", chips: "", seatIndex: "", playerName: "String", imageAvtar: ""},
	generatePlayer 								: {channelId: "String", playerId: "String", chips: "", seatIndex: "", playerName: "String", imageAvtar: ""},
	deductChipsOnSit 							: {channelId: "String", playerId: "String", chips: "", seatIndex: "", playerName: "String", imageAvtar: ""},
	tableBuyIn	 									: {channelId: "String"},
	isPlayerNotOnTable 						: {channelId: "String", playerId: "String"},
	seatOccupied 									: {channelId: "String"},
	shuffleDeck 									: {channelId: "String"},
	popCard 											: {count: "Integer", table: "Object"},
	shouldStartGame 							: {channelId: "String"},
	refreshTable   								: {channelId: "String", table: "Object"},
	sortPlayerIndexes 						: {channelId: "String", table: "Object"},
	isEnoughPlayingPlayers 				: {channelId: "String", table: "Object"},
	removeSitoutPlayer 						: {channelId: "String", table: "Object"},
	removeTournamentPlayers 			: {channelId: "String", table: "Object"},
	totalActivePlayers 						: {channelId: "String", table: "Object"},
	totalWaitingPlayers 					: {channelId: "String", table: "Object"},
	distributecards 							: {channelId: "String"},
	totalCardToBeDistributed			: {channelId: "String", table: "Object"},
	setCurrentPlayer 							: {channelId: "String", table: "Object"},
	setStraddlePlayer 						: {channelId: "String", table: "Object"},
	setBigBlindPlayer 						: {channelId: "String", table: "Object"},
	setSmallBlindPlayer 					: {channelId: "String", table: "Object"},
	getActivePlayersForDealer 		: {channelId: "String", table: "Object"},
	setGameStateRunning 					: {channelId: "String", table: "Object"},
	getNextActiveIndex 						: {channelId: "String", index: "Integer", table: "Object"},
	getPreActiveIndex 						: {channelId: "String", index: "Integer", table: "Object"},
	tableConfig 									: {channelId: "String"},
	deductBlinds 									: {channelId: "String"},

	makeMove 											: {channelId: "String", playerId: "String", amount: "Integer", action: "String", isRequested: "Boolean"},

	getTableObject 								: {channelId: "String", table: "Object", data: "Object"},
	getSeatOccupied								: {channelId: "String", table: "Object", data: "Object"},
	getTableBuyIn 								: {channelId: "String", table: "Object", data: "Object"},
	addPlayerAsWaiting						: {channelId: "String", table: "Object", data: "Object"},
	checkItShouldStartGame 				: {channelId: "String", table: "Object", data: "Object"},
	setTableConfig 								: {channelId: "String", table: "Object", data: "Object"},
	distributeCardsToPlayers 			: {channelId: "String", table: "Object", data: "Object"},
	seatsFullOrPlayerNotOnTable 		: {channelId: "String", table: "Object", data: "Object"},
	deductBlindsOnTable 					: {channelId: "String", table: "Object", data: "Object"},

	initializeParams							: {channelId: "String", table: "Object"},
	validatePlayer 								: {channelId: "String", table: "Object"},
	isMoveExists 									: {channelId: "String", table: "Object"},
	setBetAmount 									: {channelId: "String", table: "Object"},
	validateBetAmount 						: {channelId: "String", table: "Object"},
	validateMoveAllowed 					: {channelId: "String", table: "Object"},
	performMove 									: {channelId: "String", table: "Object"},
	updatePlayer 									: {channelId: "String", table: "Object"},
	updateTable 									: {channelId: "String", table: "Object"},
	isRoundOver 									: {channelId: "String", table: "Object"},
	resetPlayer 									: {channelId: "String", table: "Object"},
	resetTable 										: {channelId: "String", table: "Object"},
	setNextPlayer 								: {channelId: "String", table: "Object"},
	getMoves 											: {channelId: "String", table: "Object"},
	burnCards 										: {channelId: "String", table: "Object"},
	isGameOver 										: {channelId: "String", table: "Object"},
	decideWinner 									: {channelId: "String", table: "Object"},
	createTurnResponse 						: {channelId: "String", table: "Object"},
	popCardFromDeck 							: {count: "Integer", table: "Object"},
	isGameProgress 								: {table: "Object"},

	takeAction 										: {channelId: "String", table: "Object", data: "Object"},

	lockTableObject 							: {channelId: "String", actionName: "String", data: "Object"},
	performAction 								: {channelId: "String", table: "Object", actionName: "String", data: "Object"},
	getMove 											: {table: "Object"},

	leave 												: {channelId: "String", playerId: "String", isStandup: "Boolean", isRequested: "Boolean"},
	leavePlayer 									: {channelId: "String", table: "Object", data: "Object"},
	setfirstActiveIndex 					: {channelId: "String", table: "Object"},
	isCurrentPlayer 							: {channelId: "String", table: "Object"},
	refundAmountOnLeave 					: {channelId: "String", table: "Object"},
	removeFromTable  							: {channelId: "String", table: "Object"},
	createLeaveResponse 					: {channelId: "String", table: "Object"},
	setLeaveParams 								: {channelId: "String", table: "Object"},
	removePlayer									: {channelId: "String", table: "Object"},
	generateResponse							: {channelId: "String", table: "Object"},

	processGameOver 							: {channelId: "String", table: "Object", data: "Object"},
	isSingleWinner 								: {channelId: "String", table: "Object", data: "Object"},
	storeCardSets									: {channelId: "String", table: "Object", data: "Object"},
	generateDecisionParams 				: {channelId: "String", table: "Object", data: "Object"},
	decidewinner 									: {channelId: "String", table: "Object", data: "Object"},
	deductRakeOnTable							: {channelId: "String", table: "Object", data: "Object"},
	rewardWinningAmount 					: {channelId: "String", table: "Object", data: "Object"},
	addWinAmountToProfile 				: {channelId: "String", table: "Object", data: "Object"},
	resetTableOnGameOver 					: {channelId: "String", table: "Object"},
	manageRanks 									: {channelId: "String", table: "Object"},
	distributePrizeInTournament   : {channelId: "String", table: "Object"},
	setStatePlaying 							: {channelId: "String", table: "Object"},
	resetPlayersOnGameOver 				: {channelId: "String", table: "Object"},
	setTableStateIdle 						: {channelId: "String", table: "Object", data: "Object"},
	createGameOverResponse 				: {channelId: "String", table: "Object", data: "Object"},

	processSplit									: {channelId: "String", table: "Object", data: "Object"},
	isPotsplitRequired 						: {channelId: "String", table: "Object", data: "Object"},
	addAmountToPot								: {channelId: "String", table: "Object", data: "Object"},
	splitPot 											: {channelId: "String", table: "Object", data: "Object"},

	sitoutNextHand 								: {channelId: "String", playerId: "String", isRequested: "Boolean"},
	sitoutNextBigBlind 						: {channelId: "String", playerId: "String", isRequested: "Boolean"},
	processSitoutNextHand 				: {channelId: "String", table: "Object", data: "Object"},
	processSitoutNextBigBlind 		: {channelId: "String", table: "Object", data: "Object"},
	resume 												: {channelId: "String", playerId: "String", isRequested: "Boolean"},
	resumePlayer 									: {channelId: "String", table: "Object", data: "Object"},

	incrementBlindMissedPlayed		: {channelId: "String"},
	reportIssue										: {playerId: "String", issue: "String", status: "String", token: "String"},
	getIssue											: {playerId: "String"},
	getTablesForGames				: {isActive: "Boolean", channelType: "String", isRealMoney: "Boolean"},

	createSearchFilter 						: {channelId: "String", table: "Object", data: "Object"},
	searchInCacheTables  					: {channelId: "String", table: "Object", data: "Object"},
	searchInPrimaryTables 				: {channelId: "String", table: "Object", data: "Object"},
	createSimilarTableResponse		: {channelId: "String", table: "Object", data: "Object"},
	createLog 										: {channelId: "String", eventName: "String", rawData: "Object"},
	generateLog 									: {channelId: "String", table: "Object", data: "Object"},

	processSearch 								: {channelId: "String", channelType: "String", tableId: "String"},
	setSearchChannelParams 				: {channelId: "String", channelType: "String", tableId: "String"},
	searchChannel 								: {channelId: "String", channelType: "String", tableId: "String", channelDetails: "Object", response: "Object"},
	getChannelDetails 						: {channelId: "String", channelType: "String", tableId: "String", channelDetails: "Object", response: "Object"},
	createChannelResponse 				: {channelId: "String", channelType: "String", tableId: "String", channelDetails: "Object", response: "Object"},
	createTournamentTables				: {tournamentId: "String"},
	distributePrize 							: {channelId: "String", table: "Object"},
	getPrizeList 						    	: {channelId: "String", table: "Object"},
	InsertInPrize 						    : {channelId: "String", table: "Object"},
	updateChipsInPlayerProfile 	  : {channelId: "String", table: "Object"},
	updateTournamentUsers 	      : {channelId: "String", table: "Object"},

	searchTable 									: {playerId: "String"},
	searchTableParams							: {playerId: "String"},
	setSearchCriteria 						: {channelId: "String", playerId: "String"},
	searchSimilarTable						: {playerId: "String", searchParams: "Object", similarChannels: "Array", channelDetails: "Object", response: "Object", channelFound: "Boolean"},
	validateSuitableTable					: {playerId: "String", searchParams: "Object", similarChannels: "Array", channelDetails: "Object", response: "Object", channelFound: "Boolean"},
	createSimilarTbaleResponse 		: {playerId: "String", searchParams: "Object", similarChannels: "Array", channelDetails: "Object", response: "Object", channelFound: "Boolean"},

	processCases 									: {channelId: "String"},
	processGameStartCases 				: {channelId: "String"},
	isAllInOccured 								: {channelId: "String", data: "Object", table: "Object"},
	setAllInPlayerAttributes 			: {channelId: "String", data: "Object", table: "Object"},
	setTableEntitiesOnStart 			: {channelId: "String", data: "Object", table: "Object"},
	adjustActiveIndexes 					: {channelId: "String", data: "Object", table: "Object"},
	createGameStartCaseResponse 	: {channelId: "String", data: "Object", table: "Object"},

	joinQueue 										: {channelId: "String", playerId: "String"},
	leaveWaiting 									: {channelId: "String", playerId: "String"},
	joinPlayerInQueue 						: {channelId: "String", playerId: "String", playerName: "String"},

	deductSmallBlind 							: {channelId: "String", table: "Object", data: "Object"},
	deductBigBlind 								: {channelId: "String", table: "Object", data: "Object"},
	deductStraddle 								: {channelId: "String", table: "Object", data: "Object"},
	updateTableEntities 					: {channelId: "String", table: "Object", data: "Object"},
	setFirstPlayerMove 						: {channelId: "String", table: "Object", data: "Object"},
	createDeductBlindResponse 		: {channelId: "String", table: "Object", data: "Object"},

	registerTournament 						: {playerId: "String", tournamentId: "String"},
	deRegisterTournament 					: {playerId: "String", tournamentId: "String"},
	isRegisteredUserInTournament 	: {playerId: "String", tournamentId: "String", gameVersionCount: "String"},
	getTournamentUsers 						: {gameVersionCount: "Number", tournamentId: "String"},
	changeStateOfTournament 	    : {state: "String", tournamentId: "String"},
	deductChips 									: {playerId: "String", chips: "Number", isRealMoney: "Boolean"},
	addChips 											: {playerId: "String", chips: "Number", isRealMoney: "Boolean"},

	setPlayerAttrib 							: {channelId: "String", playerId: "String"},
	setPlayerValue 								: {channelId: "String", table: "Object", data: "Object"},
	getTableAttrib 								: {channelId: "String"},
	getTableValue 								: {channelId: "String", table: "Object", data: "Object"},
	setCurrentPlayerDisconn 			: {channelId: "String"},
	disconnectCurrentPlayer 			: {channelId: "String", table: "Object", data: "Object"},
	getPlayerAttribute						: {channelId: "String", playerId: "String"},
	getPlayerValue 								: {channelId: "String", table: "Object", data: "Object"},

	autoSitout 										: {playerId: "String", channelId: "String", isRequested: "Boolean", isConnected: "Boolean"},
	performAutoSitout 						: {channelId: "String", table: "Object", data: "Object"},
	autoFoldCount 						: {channelId: "String", playerId: "String", increment: "Boolean"},
	playerObserverCase 						: {channelId: "String", playerId: "String"},

	getQuickSeatTable 						: {isRealMoney: "String", channelVariation: "String", minBuyIn: "Number", channelType: "String", maxPlayers: "Number"},
	getQuickSeatSitNGo						: {isRealMoney: "Boolean", channelVariation: "String", buyIn: "Number", maxPlayersForTournament: "Number", tournamentType: "String"},
	addFavourateSeat  						: {playerId: "String", favourateSeat: "Object"},
	addFavourateTable  						: {playerId: "String", favourateTable: "Object"},
	removeFavourateSeat						: {playerId: "String", channelId: "String"},
	removeFavourateTable					: {playerId: "String", channelId: "String"},
	updateStackTable							: {id: "String", stack: "Number"},
	updateStackTournamentRoom			: {id: "String", stack: "Number"},

	addChipsOnTable 							: {channelId: "String", playerId: "String", amount: "Boolean", isRequested: "Boolean"},
	addChipsOnTableInTournament 	: {channelId: "String", playerId: "String", amount: "Boolean", isRequested: "Boolean"},
	resetSitout 									: {channelId: "String", playerId: "String"},
	isSameNetworkSit 							: {channelId: "String", networkIp: "String"},
	shufflePlayers								: {channelId: "String"},
	createLog 										: {channelId: "String", data: "Object"},
	getCurrentPlayer 							: {channelId: "String"},


	processChannelSearch 					: {channelId: "String"},
	processOFCchannelSearch 			: {channelId: "String", channelType: "String"},
	createOFCtable 								: {channelId: "String", channelType: "String", channelName: "String", channelVariation: "String", turnTime: "Integer", maxPlayers: "Integer", minPlayers: "Integer", minBuyIn: "Integer", maxBuyIn: "Integer", gameInfo: "String", isRealMoney: "Boolean"},
	ofcsitplayer 									: {channelId: "String", playerId: "String", points: "Integer", seatIndex: "Integer", playerName: "String", imageAvtar: "String", isAutoReBuy: "Boolean", isRequested: "Boolean", networkIp: "String"},
	ofcLockTableObject 						: {channelId: "String", actionName: "String", data: "Object"},
	ofcPerformAction 							: {channelId: "String", table: "Object", actionName: "String", data: "Object"},
	ofcShouldStartGame 						: {channelId: "String"},
	ofcMakeMove 									: {channelId: "String", playerId: "String", cards: "Object", discarded: "Array", playerName: "String", isRequested: "Boolean"},
	ofcLeaveTable 								: {playerId: "String", channelId: "String", isStandup: "Boolean", isRequested: "Boolean", playerName: "String"},
	deductChipsInOfc 							: {playerId: "String", points: "Number", table: "Object"},
	addChipsInOfc 							  : {playerId: "String", points: "Number", table: "Object"},
	processOFCautoSit 						: {channelId: "String", playerId: "String", seatIndex: "Integer", playerName: "String", imageAvtar: "Integer", networkIp: "String", isRequested: "Boolean"},
	ofcAddPointsOnTable 				  : {channelId: "String", playerId: "String", amount: "Integer", isRequested: "Boolean"}
};

responseSet["database"] = {
	createTable 									: {success: "Boolean", table: "Object"},
	getTable 											: {success: "Boolean", table: "Object"},
	addWaitingPlayer 							: {success: "Boolean", table: "Object", player: "Object"},
	addWaitingPlayerForTournament : {success: "Boolean", table: "Object", player: "Object"},
	tableBuyIn	 									: {success: "Boolean", tableMinBuyIn: "Integer", tableMaxBuyIn: "Integer"},
	seatOccupied 									: {success: "Boolean", indexOccupied: "Array"},
	shouldStartGame 							: {success: "Boolean", players: "Array", startGame: "Boolean", state: "String", preGameState: "String"},
	distributecards 							: {success: "Boolean", players: "Array"},
	setGameConfig 								: {success: "Boolean"},
	tableConfig 									: {success: "Boolean", config: "Object"},
	makeMove 											: {success: "Boolean"},
	isPlayerNotOnTable 						: {success: "Boolean"},
	deductBlinds 									: {success: "Boolean", channelId: "String", smallBlindIndex: "Integer", bigBlindIndex: "Integer", pot: "Integer"},

	sitoutNextHand 								: {success: "Boolean", channelId: "String"},
	sitoutNextBigBlind 						: {success: "Boolean", channelId: "String"},
	resume 												: {success: "Boolean", channelId: "String"},
	leave 												: {success: "Boolean", channelId: "String"},
	setPlayerValueOnTable 				: {success: "Boolean", channelId: "String", playerId: "String", key: "String", value: "String"},
	processAutoSit 								: {success: "Boolean", data: "Object", table: "Object"},
	joinSimilarTable 							: {success: "Boolean", playerId: "String", tableDetails: "Object", similarChannelId: "String"},

	ofcsitplayer 									: {success: "Boolean", table: "Object", player: "Object"},
	ofcShouldStartGame 						: {success: "Boolean", startGame: "Boolean", players: "String", state: "String", removed: "Array"}
};

internalFunctions["database"] 	= [	"generatePlayer", "shuffleDeck", "popCard", "refreshTable", "isEnoughPlayingPlayers", "totalActivePlayers", "totalWaitingPlayers",
																		"totalCardToBeDistributed", "adjustActiveIndexes", "getNextActiveIndex", "getPreActiveIndex", "updateDatabaseTable", "setCurrentPlayer",
																		"setBigBlindPlayer", "setSmallBlindPlayer", "getActivePlayersForDealer", "lockTableObject", "performAction", "getTableObject",
																		"addPlayerAsWaiting", "getSeatOccupied", "getTableBuyIn", "checkItShouldStartGame", "setTableConfig", "distributeCardsToPlayers",
																		"takeAction", "isMoveExists", "getMoveToPerform", "setBetAmount", "validateBetAmount", "updatePlayer", "updateTable", "isRoundOver",
																		"setNextPlayer", "getMoves", "burnCards", "isGameOver", "decideWinner", "createTurnResponse", "isGameProgress", "resetTableOnGameOver",
																		"setGameStateRunning", "initializeParams", "validatePlayer", "isPlayerNotOnTable", "seatsFullOrPlayerNotOnTable", "deductBlinds",
																		"deductBlindsOnTable", "resetPlayer", "resetTable", "popCardFromDeck", "performMove", "validateMoveAllowed", "setFirstPlayerMove",
																		"leavePlayer", "setfirstActiveIndex", "adjustActiveIndexes", "removeFromTable", "createLeaveResponse",
																		"setLeaveParams", "removePlayer", "generateResponse", "isCurrentPlayer", "decidewinner", "setTableStateIdle", "createGameOverResponse",
																		"processSplit", "isPotsplitRequired", "splitPot", "resetPlayersOnGameOver", "addAmountToPot", "processSitoutNextHand", "processSitoutNextBigBlind",
																		"resumePlayer", "incrementBlindMissedPlayed", "removeSitoutPlayer", "createSearchFilter", "searchInCacheTables", "searchInPrimaryTables",
																		"createSimilarTableResponse", "generateLog", "storeCardSets", "generateDecisionParams", "isSingleWinner", "setSearchChannelParams",
																		"searchChannel",	"getChannelDetails",	"createChannelResponse", "createTournamentTables", "searchTableParams", "searchSimilarTable",
																		"validateSuitableTable", "createSimilarTbaleResponse", "setSearchCriteria", "joinPlayerInQueue", "setStraddlePlayer", "deductSmallBlind",
																		"deductBigBlind", "deductStraddle", "updateTableEntities", "setFirstPlayerMove", "createDeductBlindResponse", "rewardWinningAmount",
																		"isAllInOccured", "setAllInPlayerAttributes", "setTableEntitiesOnStart", "adjustActiveIndexes", "createGameStartCaseResponse", "processGameStartCases",
																		"registerTournament", "deductChipsOnSit", "refundAmountOnLeave","deductChips","deRegisterTournament","addChips", "getTableValue",
																	 	"disconnectCurrentPlayer", "getPlayerValue", "setPlayerValue", "autoSitout", "performAutoSitout","autoFoldCount","playerObserverCase","manageRanks","removeTournamentPlayers","setStatePlaying",
																		"deductRakeOnTable", "distributePrize", "getPrizeList","distributePrizeInTournament","InsertInPrize", "updateChipsInPlayerProfile", "updateTournamentUsers",
																		"sortPlayerIndexes", "getQuickSeatTable", "getQuickSeatSitNGo", "addFavourateSeat", "addFavourateTable", "removeFavourateSeat", "removeFavourateTable",
																		"updateStackTable", "updateStackTournamentRoom","isRegisteredUserInTournament","changeStateOfTournament","getTournamentUsers", "resetSitout", "isSameNetworkSit",
																		"shufflePlayers", "createLog", "setPlayerValueOnTable","deductChipsInOfc","addChipsInOfc", "removeWaitingPlayer"
																	];
handlerFunctions["database"] 		= [	"createTable", "getTable", "getPlayers", "addWaitingPlayer", "tableBuyIn", "seatOccupied", "shouldStartGame",
																		"distributecards", "tableConfig", "setGameConfig", "makeMove", "getMove", "leave", "processGameOver", "sitoutNextHand", "sitoutNextBigBlind",
																		"resume", "getTablesForGames", "reportIssue", "getIssue", "createLog", "processSearch", "searchTable", "joinQueue", "processCases",
																		"getTableAttrib", "setCurrentPlayerDisconn", "getPlayerAttribute", "setPlayerAttrib","addWaitingPlayerForTournament","isRegisteredUserInTournament","changeStateOfTournament",
																		"getTournamentUsers", "addChipsOnTable", "addChipsOnTableInTournament", "processAutoSit", "getTableView", "getCurrentPlayer",

																		"processChannelSearch", "processOFCchannelSearch", "createOFCtable", "ofcsitplayer", "ofcLockTableObject", "ofcPerformAction", "ofcShouldStartGame",
																		"ofcMakeMove", "ofcLeaveTable", "processOFCautoSit","ofcAddPointsOnTable"
																	];


// Store all the dictionary for GATE server
keySets["gate"] = {
	getConnector 		: {loginType: "", deviceType: "", userName: "", password: "", ipV4Address: "", ipV6Address: ""},
	getHostAndPort 	: {/*selfi : "",*/connector : "",playerId: "String"}
};
internalFunctions["gate"] = ["getHostAndPort"];
handlerFunctions["gate"]  = ["getConnector"];

// Store all the dictionary for Auth server
keySets["auth"] = {
	getDecryptedData	: {encoded: "String", clientId: "String"},
	unSignData				: {token: "String" ,clientId: "String"}
};
internalFunctions["auth"] = ["unSignData"];
handlerFunctions["auth"]  = ["getDecryptedData"];

// Store all the dictionary for web server
keySets["web"] = {
	forgotPassword : {emailId: "",playerId: "String"},
	verifyEmail    : {token : ""}
};
internalFunctions["auth"] = [];
handlerFunctions["auth"] = ["forgotPassword", "verifyEmail"];

//-------- Buddy server-----//

keySets["buddy"] = {
	sendFriendRequest: { playerId: "String", friendId: "String" },
	getFriendRequests: { playerId: "String" },
	acceptFriendRequest: { playerId: "String", friendId: "String" },
	rejectFriendRequest: { playerId: "String", friendId: "String" },
	searchPlayer: { userName: "String", playerId: "String" },
	getFriendList: { playerId: "String" },
	removeFriend: { playerId: "String", friendId: "String" },
	playWithFriend: { playerId: "String", friendId: "String", channelId: "" },
};

responseSet["buddy"] = {

};

handlerFunctions["buddy"] = [
	"sendFriendRequest",
	"getFriendRequests",
	"acceptFriendRequest",
	"rejectFriendRequest",
	"searchPlayer",
	"getFriendList",
	"removeFriend",
	"playWithFriend",
];

internalFunctions["buddy"] = [

];


// Validate keys and generate proper response
keySets.validate = function (type, serverType, methodName, clientKeys, cb) {
	var routeFromDict = null;
	if(type.toUpperCase() === "REQUEST") {
		routeFromDict = keySets[serverType][methodName];
		responsibleText = " in request ";
	} else {
		routeFromDict   = responseSet[serverType][methodName];
		responsibleText = " in response ";
	}
	var missingKeys = [];
	if(internalFunctions[serverType].indexOf(methodName) >= 0) {
		responsibleText = responsibleText+" on server !";
	} else if (handlerFunctions[serverType].indexOf(methodName) >= 0) {
		responsibleText = (responsibleText === " in request ") ? responsibleText+" from client !" : responsibleText+" on server !";
	} else {
		console.error('No dictionary defined for function - ' + methodName + ' on '+ serverType + ' server!');
		cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: 'No dictionary defined for function - ' + methodName + ' on '+ serverType + ' server!'});
		return ;
	}
	
	for(var key in routeFromDict){
		if(!clientKeys[key]){ // intentionally setting true for missing key for pushing key
			// if(clientKeys[key] != false && clientKeys[key] != "" && clientKeys[key] != null && clientKeys[key] != "undefined") {
			// 	missingKeys.push(key);
			// }
			if(clientKeys[key] === undefined) {
				missingKeys.push(key);
			}

		}
	}
	if(missingKeys.length > 0){
		console.error(serverType.toUpperCase() + ": Missing keys in " + type + " - [" + (missingKeys).toString() + "] for function - " + methodName + " " + responsibleText);
		cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: serverType.toUpperCase() + ": Missing keys - [" + (missingKeys).toString() + "] for function - " + methodName + " " + responsibleText});
	} else {
		cb({success: true});
	}
};

// ### Validate client keys from dictionary first ###
keySets.validateKeySets = function (type, serverType, methodName, clientKeys, cb) {
  clientKeys = _.omit(clientKeys, 'timestamp', '__route__');
  if(serverType=='room'){
  	serverType='connector';
  }
  this.validate(type, serverType, methodName, clientKeys, function (validateResponse){
    cb(validateResponse);
  });
};

module.exports = keySets;
