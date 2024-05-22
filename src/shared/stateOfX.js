/**
 * Created by Amrendra on 15/06/16.
 */

/*jshint node: true */
"use strict";

var stateOfX = {};
const configConstants = require("./configConstants");

stateOfX.gameDetails = {};
stateOfX.gameDetails.name = configConstants.gameNameText;

// Events to start OFC game
stateOfX.OFCstartGameEvent = {};
stateOfX.OFCstartGameEvent.sit = "PLAYERSIT";
stateOfX.OFCstartGameEvent.gameOver = "GAMEOVER";
stateOfX.OFCstartGameEvent.addPoints = "ADDPINTS";

// Events to start normal game
stateOfX.startGameEvent = {};
stateOfX.startGameEvent.sit = "PLAYERSIT";
stateOfX.startGameEvent.gameOver = "GAMEOVER";
stateOfX.startGameEvent.resume = "RESUME";
stateOfX.startGameEvent.addChips = "ADDCHIPS";
stateOfX.startGameEvent.tournament = "TOURNAMENT";
stateOfX.startGameEvent.tournamentAfterBreak = "TOURNAMENTAFTERBREAK";

// Events to start normal game on channel level
stateOfX.startGameEventOnChannel = {};
stateOfX.startGameEventOnChannel.idle = "IDLE";
stateOfX.startGameEventOnChannel.starting = "STARTING";
stateOfX.startGameEventOnChannel.running = "RUNNING";

// Game states
stateOfX.gameState = {};
stateOfX.gameState.idle = "IDLE";
stateOfX.gameState.starting = "STARTING";
stateOfX.gameState.running = "RUNNING";
stateOfX.gameState.gameOver = "GAMEOVER";

// OFC Game states
stateOfX.ofcGameState = {};
stateOfX.ofcGameState.idle = "IDLE";
stateOfX.ofcGameState.starting = "STARTING";
stateOfX.ofcGameState.running = "RUNNING";
stateOfX.ofcGameState.gameOver = "GAMEOVER";

// Player states
// WAITING, PLAYING, CALL, FOLD, ALLIN, CHECK, ONBREAK, ONLEAVE, OUTOFMONEY
stateOfX.playerState = {};
stateOfX.playerState.waiting = "WAITING";
stateOfX.playerState.playing = "PLAYING";
stateOfX.playerState.outOfMoney = "OUTOFMONEY";
stateOfX.playerState.onBreak = "ONBREAK";
stateOfX.playerState.disconnected = "DISCONNECTED";
stateOfX.playerState.onleave = "ONLEAVE";
stateOfX.playerState.reserved = "RESERVED";
stateOfX.playerState.surrender = "SURRENDER"; // In case of OFC leave player

// Table speed
stateOfX.tableSpeed = {};
stateOfX.tableSpeed.hyperturbo = "HYPERTURBO";
stateOfX.tableSpeed.turbo = "TURBO";
stateOfX.tableSpeed.medium = "MEDIUM";
stateOfX.tableSpeed.standard = "STANDARD";

// Table speed text based on turntime
stateOfX.tableSpeedFromTurnTime = {};
stateOfX.tableSpeedFromTurnTime[stateOfX.tableSpeed.hyperturbo] = 10;
stateOfX.tableSpeedFromTurnTime[stateOfX.tableSpeed.turbo] = 15;
stateOfX.tableSpeedFromTurnTime[stateOfX.tableSpeed.medium] = 20;
stateOfX.tableSpeedFromTurnTime[stateOfX.tableSpeed.standard] = 30;

// Table turntime based on speed text
stateOfX.turnTimeFromSpeed = {};
stateOfX.turnTimeFromSpeed[
  stateOfX.tableSpeedFromTurnTime[stateOfX.tableSpeed.hyperturbo]
] = "HYPERTURBO";
stateOfX.turnTimeFromSpeed[
  stateOfX.tableSpeedFromTurnTime[stateOfX.tableSpeed.turbo]
] = "TURBO";
stateOfX.turnTimeFromSpeed[
  stateOfX.tableSpeedFromTurnTime[stateOfX.tableSpeed.medium]
] = "MEDIUM";
stateOfX.turnTimeFromSpeed[
  stateOfX.tableSpeedFromTurnTime[stateOfX.tableSpeed.standard]
] = "STANDARD";

// Extra time bank for disconnected player
stateOfX.extraTimeBank = {};
stateOfX.extraTimeBank[
  stateOfX.tableSpeedFromTurnTime[stateOfX.tableSpeed.hyperturbo]
] = 10;
stateOfX.extraTimeBank[
  stateOfX.tableSpeedFromTurnTime[stateOfX.tableSpeed.turbo]
] = 15;
stateOfX.extraTimeBank[
  stateOfX.tableSpeedFromTurnTime[stateOfX.tableSpeed.medium]
] = 20;
stateOfX.extraTimeBank[
  stateOfX.tableSpeedFromTurnTime[stateOfX.tableSpeed.standard]
] = 30;
stateOfX.extraTimeBank["default"] = 20;

// Round names
stateOfX.round = {};
stateOfX.round.holeCard = "HOLE CARDS";
stateOfX.round.preflop = "PREFLOP";
stateOfX.round.flop = "FLOP";
stateOfX.round.turn = "TURN";
stateOfX.round.river = "RIVER";
stateOfX.round.showdown = "SHOWDOWN";

// Round to value
stateOfX.roundToValue = {};
stateOfX.roundToValue[stateOfX.round.holeCard] = 0;
stateOfX.roundToValue[stateOfX.round.preflop] = 1;
stateOfX.roundToValue[stateOfX.round.flop] = 2;
stateOfX.roundToValue[stateOfX.round.turn] = 3;
stateOfX.roundToValue[stateOfX.round.river] = 4;
stateOfX.roundToValue[stateOfX.round.showdown] = 5;

// Round names OFC
stateOfX.ofcRound = {};
stateOfX.ofcRound.one = "ONE";
stateOfX.ofcRound.two = "TWO";
stateOfX.ofcRound.three = "THREE";
stateOfX.ofcRound.four = "FOUR";
stateOfX.ofcRound.five = "FIVE";
stateOfX.ofcRound.finished = "FINISHED";

// Total round count in OFC
stateOfX.totalOFCround = 5;

// Card to be distribute to OFC player
stateOfX.OFCplayerCards = {};
stateOfX.OFCplayerCards[stateOfX.ofcRound.one] = 5;
stateOfX.OFCplayerCards[stateOfX.ofcRound.two] = 3;
stateOfX.OFCplayerCards[stateOfX.ofcRound.three] = 3;
stateOfX.OFCplayerCards[stateOfX.ofcRound.four] = 3;
stateOfX.OFCplayerCards[stateOfX.ofcRound.five] = 3;

// Card in player hand in round OFC player
stateOfX.OFCplayerCardsInRound = {};
stateOfX.OFCplayerCardsInRound[stateOfX.ofcRound.one] = 5;
stateOfX.OFCplayerCardsInRound[stateOfX.ofcRound.two] = 7;
stateOfX.OFCplayerCardsInRound[stateOfX.ofcRound.three] = 9;
stateOfX.OFCplayerCardsInRound[stateOfX.ofcRound.four] = 11;
stateOfX.OFCplayerCardsInRound[stateOfX.ofcRound.five] = 13;

// Next Round OFC
stateOfX.nextOFCroundOf = {};
stateOfX.nextOFCroundOf[stateOfX.ofcRound.one] = stateOfX.ofcRound.two;
stateOfX.nextOFCroundOf[stateOfX.ofcRound.two] = stateOfX.ofcRound.three;
stateOfX.nextOFCroundOf[stateOfX.ofcRound.three] = stateOfX.ofcRound.four;
stateOfX.nextOFCroundOf[stateOfX.ofcRound.four] = stateOfX.ofcRound.five;
stateOfX.nextOFCroundOf[stateOfX.ofcRound.five] = stateOfX.ofcRound.finished;

// Table speed
stateOfX.ofcTableSpeed = {};
stateOfX.ofcTableSpeed.hyperturbo = "HYPERTURBO";
stateOfX.ofcTableSpeed.turbo = "TURBO";
stateOfX.ofcTableSpeed.medium = "MEDIUM";
stateOfX.ofcTableSpeed.standard = "STANDARD";

// Table speed text based on turntime OFC
stateOfX.ofcTableSpeedFromTurnTime = {};
stateOfX.ofcTableSpeedFromTurnTime[stateOfX.ofcTableSpeed.hyperturbo] = 10;
stateOfX.ofcTableSpeedFromTurnTime[stateOfX.ofcTableSpeed.turbo] = 15;
stateOfX.ofcTableSpeedFromTurnTime[stateOfX.ofcTableSpeed.medium] = 20;
stateOfX.ofcTableSpeedFromTurnTime[stateOfX.ofcTableSpeed.standard] = 30;

// Table turntime based on speed text OFC
// stateOfX.turnTimeFromSpeed                                                                  = {}
// stateOfX.turnTimeFromSpeed[stateOfX.ofcTableSpeedFromTurnTime[stateOfX.ofcTableSpeed.hyperturbo]] = "HYPERTURBO";
// stateOfX.turnTimeFromSpeed[stateOfX.ofcTableSpeedFromTurnTime[stateOfX.ofcTableSpeed.turbo]]      = "TURBO";
// stateOfX.turnTimeFromSpeed[stateOfX.ofcTableSpeedFromTurnTime[stateOfX.ofcTableSpeed.medium]]     = "MEDIUM";
// stateOfX.turnTimeFromSpeed[stateOfX.ofcTableSpeedFromTurnTime[stateOfX.ofcTableSpeed.standard]]   = "STANDARD";

// Extra time bank for disconnected player OFC
// stateOfX.extraTimeBank                                                                        = {}
// stateOfX.extraTimeBank[stateOfX.ofcTableSpeedFromTurnTime[stateOfX.ofcTableSpeed.hyperturbo]] = 20;
// stateOfX.extraTimeBank[stateOfX.ofcTableSpeedFromTurnTime[stateOfX.ofcTableSpeed.turbo]]      = 30;
// stateOfX.extraTimeBank[stateOfX.ofcTableSpeedFromTurnTime[stateOfX.ofcTableSpeed.medium]]     = 40;
// stateOfX.extraTimeBank[stateOfX.ofcTableSpeedFromTurnTime[stateOfX.ofcTableSpeed.standard]]   = 60;

// Plyers to decide configuration of blinds and dealer
stateOfX.playerType = {};
stateOfX.playerType.dealer = "DEALER";
stateOfX.playerType.smallBlind = "SMALLBLIND";
stateOfX.playerType.bigBlind = "BIGBLIND";
stateOfX.playerType.straddle = "STRADDLE";

// Game ending type cases
stateOfX.endingType = {};
stateOfX.endingType.gameComplete = "GAMECOMPLETED";
stateOfX.endingType.everybodyPacked = "EVERYBODYPACKED";
stateOfX.endingType.onlyOnePlayerLeft = "ONLYONEPLAYERLEFT";

// Ending type text for dealer chat and hand history
stateOfX.dealerChatReason = {};
stateOfX.dealerChatReason[stateOfX.endingType.gameComplete] = "GAMECOMPLETED";
stateOfX.dealerChatReason[stateOfX.endingType.everybodyPacked] =
  "Every Body Else Folded";
stateOfX.dealerChatReason[stateOfX.endingType.onlyOnePlayerLeft] =
  "Every One Else Left";

// Ending type reasons for OFC
stateOfX.ofcEndingType = {};
stateOfX.ofcEndingType.gameComplete = "GAMECOMPLETED";
stateOfX.ofcEndingType.allPlayerFouled = "ALLPLAYERFOULED";

// Total moves allowed in Game
stateOfX.moves = ["CHECK", "CALL", "BET", "RAISE", "ALLIN", "FOLD"];

// Total moves in the game
stateOfX.move = {};
stateOfX.move.check = "CHECK";
stateOfX.move.call = "CALL";
stateOfX.move.bet = "BET";
stateOfX.move.raise = "RAISE";
stateOfX.move.allin = "ALLIN";
stateOfX.move.fold = "FOLD";

stateOfX.move.standup = "STANDUP";
stateOfX.move.leave = "LEAVE";

// Player precheck values in the game
stateOfX.playerPrecheckValue = {};
stateOfX.playerPrecheckValue.CALL = "Call";
stateOfX.playerPrecheckValue.CALL_ANY = "CallAny";
stateOfX.playerPrecheckValue.FOLD = "Fold";
stateOfX.playerPrecheckValue.CHECK = "Check";
stateOfX.playerPrecheckValue.ALLIN = "AllIn";
stateOfX.playerPrecheckValue.CHECK_FOLD = "Check_Fold";
stateOfX.playerPrecheckValue.CALL_ANY_CHECK = "CallAny_Check";
stateOfX.playerPrecheckValue.NONE = "NONE";

// OFC move types
stateOfX.OFCmove = {};
stateOfX.OFCmove.submit = "SUBMIT";
stateOfX.OFCmove.discard = "DISCARD";
stateOfX.OFCmove.standup = "STANDUP";
stateOfX.OFCmove.leave = "LEAVE";

// Total moves in the game
stateOfX.delaerChatMove = {};
stateOfX.delaerChatMove[stateOfX.move.check] = "Checks";
stateOfX.delaerChatMove[stateOfX.move.call] = "Calls";
stateOfX.delaerChatMove[stateOfX.move.bet] = "Bets";
stateOfX.delaerChatMove[stateOfX.move.raise] = "Raises";
stateOfX.delaerChatMove[stateOfX.move.allin] = "All In";
stateOfX.delaerChatMove[stateOfX.move.fold] = "Folds";

// Assign move values to moves
stateOfX.moveValue = {};
stateOfX.moveValue.check = 1;
stateOfX.moveValue.call = 2;
stateOfX.moveValue.bet = 3;
stateOfX.moveValue.raise = 4;
stateOfX.moveValue.allin = 5;
stateOfX.moveValue.fold = 6;

// Precheck sets for players
stateOfX.preCheck = {};
stateOfX.preCheck.setOne = 1;
stateOfX.preCheck.setTwo = 2;
stateOfX.preCheck.setThree = 3; //AllIn/Fold only

// Channel variations (Game variations)
stateOfX.channelVariation = {};
stateOfX.channelVariation.holdem = "Texas Hold’em";
stateOfX.channelVariation.omaha = "Omaha";
stateOfX.channelVariation.omahahilo = "Omaha Hi-Lo";
stateOfX.channelVariation.ofc = "Open Face Chinese Poker";

// Channel variations (Game variations)
stateOfX.nextRoundOf = {};
stateOfX.nextRoundOf[stateOfX.round.preflop] = stateOfX.round.flop;
stateOfX.nextRoundOf[stateOfX.round.flop] = stateOfX.round.turn;
stateOfX.nextRoundOf[stateOfX.round.turn] = stateOfX.round.river;
stateOfX.nextRoundOf[stateOfX.round.river] = stateOfX.round.showdown;

// Channel variations (Game variations)
stateOfX.previousRoundOf = {};
stateOfX.previousRoundOf[stateOfX.round.preflop] = null;
stateOfX.previousRoundOf[stateOfX.round.flop] = stateOfX.round.preflop;
stateOfX.previousRoundOf[stateOfX.round.turn] = stateOfX.round.flop;
stateOfX.previousRoundOf[stateOfX.round.river] = stateOfX.round.turn;
stateOfX.previousRoundOf[stateOfX.round.showdown] = stateOfX.round.river;

// Cards to distribute based on Game variation
stateOfX.totalPlayerCards = {};
stateOfX.totalPlayerCards[stateOfX.channelVariation.holdem] = 2;
stateOfX.totalPlayerCards[stateOfX.channelVariation.omaha] = 4;
stateOfX.totalPlayerCards[stateOfX.channelVariation.omahahilo] = 4;

// Total cards poped out on board
stateOfX.totalCommunityCard = {};
stateOfX.totalCommunityCard[stateOfX.round.preflop] = 0;
stateOfX.totalCommunityCard[stateOfX.round.flop] = 3;
stateOfX.totalCommunityCard[stateOfX.round.turn] = 4;
stateOfX.totalCommunityCard[stateOfX.round.river] = 5;
stateOfX.totalCommunityCard[stateOfX.round.showdown] = 5;

// Status of issues raised by player
stateOfX.issueStatus = {};
stateOfX.issueStatus.open = "OPEN";
stateOfX.issueStatus.close = "CLOSE";
stateOfX.issueStatus.process = "PROCESS";

// Log type for distributed server log management
stateOfX.serverLogType = {};
stateOfX.serverLogType.info = "INFO";
stateOfX.serverLogType.warning = "WARNING";
stateOfX.serverLogType.error = "ERROR";
stateOfX.serverLogType.anonymous = "ANONYMOUS";
stateOfX.serverLogType.request = "REQUEST";
stateOfX.serverLogType.response = "RESPONSE";
stateOfX.serverLogType.broadcast = "BROADCAST";
stateOfX.serverLogType.dbQuery = "DBQUERY";

// Server type used in system and for logs
stateOfX.serverType = {};
stateOfX.serverType.database = "DATABASE";
stateOfX.serverType.connector = "CONNECTOR";
stateOfX.serverType.gate = "GATE";
stateOfX.serverType.auth = "AUTH";
stateOfX.serverType.shared = "SHARED";

// Event types for game log
stateOfX.logEvents = {};
stateOfX.logEvents.joinChannel = "JOINCHANNEL";
stateOfX.logEvents.reserved = "RESERVED";
stateOfX.logEvents.sit = "SIT";
stateOfX.logEvents.tableInfo = "TABLEINFO";
stateOfX.logEvents.startGame = "STARTGAME";
stateOfX.logEvents.playerTurn = "PLAYERTURN";
stateOfX.logEvents.leave = "LEAVE";
stateOfX.logEvents.roundOver = "ROUNDOVER";
stateOfX.logEvents.gameOver = "GAMEOVER";
stateOfX.logEvents.summary = "SUMMARY";
stateOfX.logEvents.playerRoyality = "OFCROYALITY";

// Allowed move sets
// CALL, FOLD, ALLIN, CHECK

// profile activity variables
stateOfX.profile = {};
stateOfX.profile.category = {};
stateOfX.profile.subCategory = {};
stateOfX.profile.activityStatus = {};
stateOfX.profile.category.profile = "PROFILE";
stateOfX.profile.category.transaction = "TRANSACTION";
stateOfX.profile.category.game = "GAME";
stateOfX.profile.category.tournament = "TOURNAMENT";
stateOfX.profile.category.lobby = "LOBBY";
stateOfX.profile.category.gamePlay = "GAMEPLAY"; //GAME PLAY
// stateOfX.profile.category.tournament  = "TOURNAMENT";
stateOfX.profile.category.lobby = "LOBBY";
// stateOfX.profile.category.gamePlay    = "GAME PLAY";

// for game activity logs in db
stateOfX.gameActivity = {};
stateOfX.gameActivity.category = {};
stateOfX.gameActivity.category.game = "GAME";
stateOfX.gameActivity.category.tournament = "TOURNAMENT";
// stateOfX.gameActivity.category.lobby      = "LOBBY";
stateOfX.gameActivity.category.gamePlay = "GAMEPLAY";

stateOfX.profile.subCategory.login = "LOGIN";
stateOfX.profile.subCategory.signUp = "SIGNUP";
stateOfX.profile.subCategory.update = "UPDATE";
stateOfX.profile.subCategory.emailVerify = "EMAILVERIFY";
stateOfX.profile.subCategory.password = "PASSWORD";
stateOfX.profile.subCategory.otp = "OTP";
stateOfX.profile.subCategory.freeChips = "FREECHIPS";
stateOfX.profile.subCategory.withdraw = "WITHDRAW";
stateOfX.profile.subCategory.recharge = "RECHARGE";
stateOfX.profile.subCategory.action = "ACTION";
stateOfX.profile.subCategory.winner = "WINNER";
stateOfX.profile.subCategory.participated = "PARTICIPATED";

stateOfX.transaction = {};
stateOfX.transaction.subCategory = {};
stateOfX.transaction.subCategory.transaction1 = "TRANSACTION1";

stateOfX.gamePlay = {};
stateOfX.gamePlay.subCategory = {};
stateOfX.gamePlay.subCategory.startGame = "START GAME";
stateOfX.gamePlay.subCategory.leave = "PLAYER LEFT";
stateOfX.gamePlay.subCategory.sit = "PLAYER SIT"; // NOT IN USE ..
stateOfX.gamePlay.subCategory.move = "PLAYER MOVE";
stateOfX.gamePlay.subCategory.info = "INFO";
stateOfX.gamePlay.subCategory.gameOver = "GAME OVER";

stateOfX.gameplay = {};
stateOfX.gameplay.subCategory = {};
stateOfX.gameplay.subCategory.startGame = "START GAME";
stateOfX.gameplay.subCategory.leave = "PLAYER LEFT";
stateOfX.gameplay.subCategory.sit = "PLAYER SIT"; // NOT IN USE ..
stateOfX.gameplay.subCategory.move = "PLAYER MOVE";
stateOfX.gameplay.subCategory.info = "INFO";
stateOfX.gameplay.subCategory.gameOver = "GAME OVER";

stateOfX.game = {};
stateOfX.game.subCategory = {};
stateOfX.game.subCategory.startGame = "START GAME";
stateOfX.game.subCategory.join = "JOIN";
stateOfX.game.subCategory.sit = "SIT";
stateOfX.game.subCategory.leave = "LEAVE";
stateOfX.game.subCategory.move = "MOVE";
stateOfX.game.subCategory.info = "INFO";
stateOfX.game.subCategory.blindsAndStraddle = "BLINDS AND STRADDLE";
stateOfX.game.subCategory.winner = "WINNER";
stateOfX.game.subCategory.playerCards = "PLAYER CARDS";
stateOfX.game.subCategory.playerState = "PLAYER STATUS";
stateOfX.game.subCategory.playerChat = "PLAYER CHAT";
stateOfX.game.subCategory.rakeDeduct = "RAKE DEDUCT";
stateOfX.game.subCategory.runItTwice = "RUN IT TWICE";
stateOfX.game.subCategory.sitoutNextHand = "SIT OUT NEXT HAND";
stateOfX.game.subCategory.sitoutNextBigBlind = "SIT OUT NEXT BIG BLIND";
stateOfX.game.subCategory.resetSitOut = "RESET SIT OUT";
stateOfX.game.subCategory.resume = "RESUME";
stateOfX.game.subCategory.addChips = "ADD CHIPS";
stateOfX.game.subCategory.updateTableSettings =
  "UPDATE TABLE SETTINGS(MUCK HAND)";

stateOfX.tournament = {};
stateOfX.tournament.subCategory = {};
stateOfX.tournament.subCategory.register = "REGISTER";
stateOfX.tournament.subCategory.deRegister = "DE-REGISTER";

stateOfX.logType = {};
stateOfX.logType.success = "SUCCESS";
stateOfX.logType.error = "ERROR";
stateOfX.logType.info = "INFO";
stateOfX.logType.warning = "WARNING";

stateOfX.profile.activityStatus.progress = "PROGRESS";
stateOfX.profile.activityStatus.completed = "COMPLETED";
stateOfX.profile.activityStatus.error = "ERROR";

stateOfX.gameType = {};
stateOfX.gameType.normal = "NORMAL";
stateOfX.gameType.tournament = "TOURNAMENT";

stateOfX.tournamentState = {};
stateOfX.tournamentState.register = "REGISTER";
stateOfX.tournamentState.running = "RUNNING";
stateOfX.tournamentState.finished = "FINISHED";
stateOfX.tournamentState.upcoming = "UPCOMING";
stateOfX.tournamentState.cancelled = "CANCELLED";

stateOfX.tournamentType = {};
stateOfX.tournamentType.sitNGo = "SIT N GO";
stateOfX.tournamentType.normal = "NORMAL";
stateOfX.tournamentType.satelite = "SATELLITE";

//admin role with admin,
stateOfX.role = {};
stateOfX.role.admin = "admin";
stateOfX.role.affiliate = "affiliate";
stateOfX.role.subaffiliate = "sub-affiliate";
stateOfX.role.user = "user";

// Event name for handling OFC event additional tasks
stateOfX.OFCevents = {};
stateOfX.OFCevents.makeMoveSuccess = "MAKEMOVESUCCESS";
stateOfX.OFCevents.makeMoveSuccessFail = "MAKEMOVEFAIL";
stateOfX.OFCevents.leaveSuccess = "LEAVESUCCESS";
stateOfX.OFCevents.autositSuccess = "AUTOSITSUCCESS";
stateOfX.OFCevents.addpointSuccess = "ADDPOINTSUCCESS";
stateOfX.OFCevents.sitSuccess = "SITSUCCESS";

// lobby activity variables
stateOfX.lobby = {};
stateOfX.lobby.subCategory = {};
stateOfX.lobby.subCategory.fetchTables = "FETCH TABLES";
stateOfX.lobby.subCategory.register = "TOURNAMENT REGISTERATION";

// Video log event type
stateOfX.videoLogEventType = {};
stateOfX.videoLogEventType.broadcast = "broadcast";
stateOfX.videoLogEventType.response = "response";
stateOfX.videoLogEventType.gamePlayers = "gamePlayers";
stateOfX.videoLogEventType.joinResponse = "joinResponse";

// countries for users
stateOfX.country = [];
stateOfX.country = [
  { name: "India" },
  { name: "Nepal" },
  { name: "Bangladesh" },
];

stateOfX.MantisApi = "http://192.168.2.35/mantis_api/mantisconnect_json.php";

//SENDGRID_API_KEY
//stateOfX.SendGridApiKey = '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';
// stateOfX.SendGridApiKey = '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';
stateOfX.SendGridApiKey =
  "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";

//Mail Related Messages
stateOfX.mailMessages = {};

//mail to affiliate
stateOfX.mailMessages.from_email = configConstants.from_email;
stateOfX.mailMessages.mail_subjectAffiliate =
  "your affiliate request is processed";
stateOfX.mailMessages.mail_contentAffiliate =
  "Hello,Your request has been proceed. Admin will contact ASAP";
stateOfX.mailMessages.mail_subjectAffiliateEdit = "Affiliate profile update";
stateOfX.mailMessages.mail_contentAffiliateEdit =
  "Affiliate your profile has been updated";

//mail forgotPassworduser
stateOfX.mailMessages.mail_subjectForgotPassword = "Forgot Password Link";
stateOfX.mailMessages.mail_contentForgotPassword =
  "Click on given link to find your password";

//mail forgotPasswordDashboard
stateOfX.mailMessages.mail_subjectForgotPasswordDashboard =
  "Resetting dashboard password";
stateOfX.mailMessages.mail_contentForgotPasswordDashboard =
  "Click on given link to find your password";
//mail resendEmailVerificationLink
stateOfX.mailMessages.mail_subjectEmailVerification = "Email Verification Link";
stateOfX.mailMessages.mail_contentEmailVerification =
  "Click on the given link to verify your email ";
stateOfX.mailMessages.mail_subjectDownloadApp = "Download Poker SD App";
stateOfX.mailMessages.mail_contentDownloadApp =
  "Hi, Thank you for chosing PokerMoogley to play poker. Please download Android build from below link " +
  process.env.WEBSITE_REFERENCE_TEXT +
  " . Download our app now. ";
stateOfX.mailMessages.mail_subjectScratchCardAffiliate =
  "Scratch card (affiliate) of " + process.env.WEBSITE_REFERENCE_TEXT;
stateOfX.mailMessages.mail_subjectScratchCardPlayer =
  "Scratch card for " + process.env.WEBSITE_REFERENCE_TEXT;
stateOfX.mailMessages.mail_scratchCardSender = "rishabh@pokerMoogley.com";

//mail scratchcardLink
stateOfX.mailMessages.mail_subjectScratchcard = "Create ScratchCard Link";

//mail to admin when affiliate is created
stateOfX.mailMessages.from_emailAdmin = configConstants.from_email; //this mail for the support user
stateOfX.mailMessages.to_emailAdmin = configConstants.from_email; //this mail is for the admin
stateOfX.mailMessages.mail_subjectAdmin = "Affiliate Registration";
stateOfX.mailMessages.mail_contentAdmin =
  "An affiliate has been registered under you";

//mail to userSupport
stateOfX.mailMessages.from_emailUserSupport = configConstants.from_email;
stateOfX.mailMessages.mail_subjectAffiliateUserSupportSubject =
  "User Support Desk";
stateOfX.mailMessages.mail_contentAffiliateUserSupportContent =
  "User Support Desk Content";

//mail from gateHandler while user login
stateOfX.mailMessages.from_emailLogin = configConstants.from_email;
stateOfX.mailMessages.subjectLogin = "User Login";
stateOfX.mailMessages.contentLogin = "User Successfully logged in";

//Sending message to the user when scratchcard is generated
stateOfX.phoneMessages = {};
stateOfX.phoneMessages.isSmsAllowedForScratch = false; //set this value to false if you don't want to send message for scratch card generation
stateOfX.phoneMessages.sms_contentDownloadApp =
  "Hi, Thank you for chosing PokerSD to play poker. Please download Android build from below link " +
  process.env.WEBSITE_REFERENCE_TEXT +
  " . Download our app now. ";
// Events to fire broadcast for lobby
stateOfX.recordChange = {};
stateOfX.recordChange.player = "PLAYER";
stateOfX.recordChange.table = "TABLE";
stateOfX.recordChange.tableNewValues = "TABLENEWVALUES";
stateOfX.recordChange.tableViewNewPlayer = "TABLEVIEWNEWPLAYER";
stateOfX.recordChange.tableViewLeftPlayer = "TABLEVIEWLEFTPLAYER";
stateOfX.recordChange.tablePlayingPlayer = "TABLEPLAYINGPLAYER";
stateOfX.recordChange.tableAvgPot = "TABLEAVGPOT";
stateOfX.recordChange.tableFlopPercent = "TABLEFLOPPERCENT";
stateOfX.recordChange.tableWaitingPlayer = "TABLEWAITINGPLAYER";
stateOfX.recordChange.tableViewNewWaitingPlayer = "TABLEVIEWNEWWAITINGPLAYER";
stateOfX.recordChange.tableViewChipsUpdate = "TABLEVIEWCHIPSUPDATE";
stateOfX.recordChange.playerJoinTable = "PLAYERJOINTABLE";
stateOfX.recordChange.sendStickerToPlayer = "SENDSTICKERTOPLAYER";
stateOfX.recordChange.playerLeaveTable = "PLAYERLEAVETABLE";
stateOfX.recordChange.onlinePlayers = "ONLINEPLAYERS";
stateOfX.recordChange.tournamentEnrolledPlayers = "TOURNAMENTTABLEENROLLED";
stateOfX.recordChange.tournamentStateChanged = "TOURNAMENTSTATECHANGED";
stateOfX.recordChange.tournamentRankUpdate = "TOURNAMENTRANKUPDATE";
stateOfX.recordChange.destroyTable = "DESTROYTABLE";
stateOfX.recordChange.shufflePlayers = "SHUFFLEPLAYERS";
stateOfX.recordChange.loyalityUpdate = "LOYALITYUPDATE";
stateOfX.recordChange.tableViewLeftWaitingPlayer = "TABLEVIEWLEFTWAITINGPLAYER";
stateOfX.recordChange.tournamentBlindChange = "TOURNAMENTBLINDCHANGE";
stateOfX.recordChange.prizePool = "PRIZEPOOL";
stateOfX.recordChange.tournamentActivePlayers = "TOURNAMENTACTIVEPLAYERS";
stateOfX.recordChange.tournamentCancelled = "TOURNAMENTCANCELLED";
stateOfX.recordChange.bountyChanged = "BOUNTYCHANGED";

// Routes for lobby broadcast
stateOfX.broadcasts = {};
stateOfX.broadcasts.tableUpdate = "tableUpdate";
stateOfX.broadcasts.updateProfile = "updateProfile";
stateOfX.broadcasts.tournamentTableUpdate = "tableUpdate";
stateOfX.broadcasts.playerUpdate = "playerUpdate";
stateOfX.broadcasts.tableView = "tableView";
stateOfX.broadcasts.joinTableList = "joinTableList";
stateOfX.broadcasts.sendStickerToPlayer = "SENDSTICKERTOPLAYER";
stateOfX.broadcasts.onlinePlayers = "onlinePlayers";
stateOfX.broadcasts.tournamentStateChange = "tableUpdate";
stateOfX.broadcasts.tournamentRankUpdate = "tableView";
stateOfX.broadcasts.tournamentLobby = "tournamentLobby";
stateOfX.broadcasts.updateProfile = "updateProfile";
stateOfX.broadcasts.tournamentCancelled = "tournamentCancelled";
stateOfX.broadcasts.antiBankingUpdatedData = "antiBankingUpdatedData";

//Link for app download

stateOfX.linkForAppDownload = "http://www.example.com";

module.exports = stateOfX;
