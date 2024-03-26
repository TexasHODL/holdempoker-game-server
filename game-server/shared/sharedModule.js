/*jshint node: true */
'use strict';


var utilMethods = {};
var request   = require('request');
var helper    = require('sendgrid').mail;
var stateOfX = require("./stateOfX.js");
var checkStatePlayer = require("./checkPlayerStatus.js");
const configConstants = require('./configConstants');

var sm = require('@sendgrid/mail'); //for sendgrid mail

var client = sm.client;
var templateIds = {
  'default': '7ee59c06-bb58-4e31-a8c3-1e1530095931', //for sendgrid mail template
  'welcome': '7ee59c06-bb58-4e31-a8c3-1e1530095931', //for sendgrid mail welcome template
  'forgot': '2d136c5b-bda1-480f-b694-511a47aa51ef', // for forgot password mail
  'scratchCardPlayer': '91f32e0f-c64b-42c2-9d98-1b45cd72f183',
  'scratchCardAffiliate': '89a4abf0-d152-4552-b6d5-826f68e28c43',
  'cashoutApproved': '92dec987-8db8-4595-b2a9-eaaf5da09d33',
  'cashoutRejected' : 'fe0f266e-f32b-4988-ad80-4510770e8638',
  'fundTransferPlayerFail' : '100634e8-4609-4c4e-b77d-2d57832a0066',
  'cashoutSuccessful' : 'e611c594-cbc5-401e-948c-f431853ffd03',
  'cashoutUnsuccessful' : 'afb29f45-1246-4f02-96db-114990cec83d',
  'fundTransferPlayer' : 'dca420da-0619-45fe-978d-16efea8145da',
  'scratchCardExpiration' : 'd8337f8e-6f92-4884-ab1f-5becf3b4face',
  'updatePlayerMail': '57349884-1b41-4c31-ac7d-7262ac7fab78',
  'rakeback' : '928ba70b-3b10-4fe3-871f-3e22c37bf00f',
  'affiliateSignUp' : 'afaf4e3e-f23e-48cd-9dee-32748104ece2',
  'signUpBonus': 'dbe3520b-a916-4931-9451-659fcf4ef5cb',
  'inactivePlayer' : 'b2e1afac-b8c5-4656-96b1-5bbb00fa5e84',
  'instantBonusTransfer' : '274bb06f-a9cc-4970-a5b8-586958a9db7b',
  'leaderboardWinner' : 'e9f1fd5e-cebe-4f77-b9c2-25ab532ca198',
  'leaderboardRegistration' : 'adcc60a9-edd1-4030-ada4-45b11d10c813',
  'lockedBonusCredit' : '3a977179-edeb-403b-a68d-c0d972a75034',
  'lockedBonusClaimed' : 'd97f6d7d-7369-4d55-b45b-e049fe951403',
  'lockedBonusExpired' : '755058a3-9420-40b9-8268-24d9ea8cad28',
  'dailyUpdateLockedBonus': '62535636-ad76-4278-8d91-2da85f53182b',
  'claimBonusMails': '10793f25-35c0-4756-957a-2b9d75dea2f1',
  'leaderboardWinnerHand': '4f16c46f-a49f-4025-a75c-ed540b9d7b4e'

  // add more send-grid template ids here
};

// send simple mail
// using sendgrid
utilMethods.sendEmail = function(data, callback){
  checkStatePlayer.checkPlayerStateWithEmail(data.to_email,function(res){
    console.log("send email res ",res);
    if(!res.success){
      console.log('send mail');
      var from_email  = new helper.Email(data.from_email);
      var to_email    = new helper.Email(data.to_email);
      var subject     = data.subject;
      var content     = new helper.Content("text/html", data.content);
      var mail        = new helper.Mail(from_email, subject, to_email, content);
      var key = stateOfX.SendGridApiKey;
      console.log(key);
      // console.log(stateOfX.SendGridApiKey, from_email, to_email, subject, content, mail);
      var sg = require('sendgrid')(key);

      var request = sg.emptyRequest({
        method: 'POST',
        path: '/v3/mail/send',
        body: mail.toJSON()
      });

      console.log("going to send email in shared module",data);
      sg.API(request, function(error, response) {
        console.log("sent mail in shared module");
        console.log('response.statusCode',response.statusCode);
        console.log('response.body',response.body);
        console.log('response.headers',response.headers);
        return callback({success: true});
      });
    } else {
      console.log("mail not sent");
      return callback({success: true});
    }
  });
};

//Request - {msg,mobileNumber}
utilMethods.sendOtp = function(data, callback){
  checkStatePlayer.checkPlayerStateWithMobile(data.mobileNumber,function(res){
    if(!res.success){
      console.log("Inside sharedModule sendOtp"+JSON.stringify(data));
      // var data = {msg : "Test Message", mobileNumber: '919555859576'}
      // callback({success : true})
      var reqObject = {
        // "authentication": {
        //   "username": systemConfig.sendSmsUsername,
        //   "password": systemConfig.sendSmsPassword
        // },
        // "messages": [{
        //   "sender": systemConfig.sendSmsSender,
        //   "text": data.msg,
        //   "recipients": [{
        //     "gsm": data.mobileNumber
        //   }]
        // }]
      };
      console.log("request reqObject in sendOtp - " + JSON.stringify(reqObject)); 
      var sendUrl= "https://japi.instaalerts.zone/httpapi/QueryStringReceiver?ver=1.0&key=ZHVhZ2FtaW5nOlBva2Vyc2RAMTIz&encrpt=0&dest="+data.mobileNumber+"&send=POKRSD&text="+data.msg; //URL to hit
      var request = require('request');
      request({
          url: sendUrl, //URL to hit
          method: 'POST', //Specify the method
          json : reqObject
      }, function(error, response, body){
        console.log("in the mail send api--"+error+'\n-->'+JSON.stringify(response)+'\n-->'+body);
          if(error) {
          // console.log(error, response.statusCode, body);
              console.log(error);
              callback({success : false});
          } else {
            console.log(response,"body.result in sharedModule sendOtp", body);
            if(response.statusCode == 200) {
              callback({success : true});
            } else {
              callback({success : false, result:"Error in sending message"});
            }
          }
      });
    }else{
      console.log("msg not sent");
      callback({success : true});
    }
  }); 
  
  
};

// not used
var createUniqueId = function (){
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for( var i=0; i < 10; i++ ) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

// var params = {};
// var data = {};
// data.code = "8BCFEA9E-73CE-4AC6-8263-3F9E9FDE0BC5";
// data.generationId = "CKTVIZPAO";
// var req = {};
// req.body = {};
// req.body.totalAmount = 501;
// req.body.expiresOn =  "Thu Nov 30 2017 23:59:59 GMT+0530 (IST)";
// req.body.playerDetail = {};
// req.body.playerDetail.firstName = "Nishant";
// req.body.playerDetail.userName = "NishantKS";
// params.content = 'Hi '+req.body.playerDetail.firstName+' ('+req.body.playerDetail.userName+'),<br><br>Please find the scratch card details below.<br><br>Email us at '+configConstants.from_email+' or call +91-XXXXXXXXXX for any assistance.<br><br><html><body><table><thead>  <tr>    <th width="120px"> Scratch Card Code </th>    <th width="100px"> Reference No. </th>    <th width="90px"> Amount </th>   <th width="100px"> Expiry </th> </tr></thead><tbody>  <tr>    <td>' + data.code +'</td>   <td>' + data.generationId + '</td>   <td>' +req.body.totalAmount+ '</td>   <td>' + new Date(req.body.expiresOn) + '</td> </tr></tbody></table></body></html>';
// params.from_email = stateOfX.mailMessages.from_emailLogin.toString();
// params.to_email = "nishantkumar@creatiosoft.com";
// params.subject = stateOfX.mailMessages.mail_subjectEmailVerification.toString();
// utilMethods.sendEmail(params, function(err, result){
//   console.log("\n\n\n\n\n\n\n", params, err, result, "\n\n\n\n\n");
// })

// SEND HTML TEMPLATE MAILS
// using sendgrid
utilMethods.sendMailWithHtml = function(data, callback){
  checkStatePlayer.checkPlayerStateWithEmail(data.to_email,function(res){
    console.log("res in send mail",res);
    if(!res.success){
      console.log('line 118 inside sendmailwith html', data);
      //var sm = s.mail;
      var s = client;
      s.setApiKey(stateOfX.SendGridApiKey);
      // console.log(s)
      var request = {};
      var msg = {
      to : data.to_email,
      from : data.from_email || configConstants.from_email,
      subject: data.subject || "Welcome to"+configConstants.gameNameText,
      text: 'is fun',
      html: '<p></p>',
      // html:'<strong>this mail has three variables. :)<br/> and button do',
      templateId: templateIds[(data.template||'default')],
      substitutions: getSubstitutions(data)
      };
      var r = sm.send(msg);
      r.then(([response, body]) => {
       console.log(response.statusCode);
       console.log(response);
       callback({success: true});
      }).catch((error) => {
       console.error(error.toString());
       callback({success: false});
      });
    }else{
      console.log("mail not sent");
      callback({success: true});
    }
  });
};

// substitute variables according to template type
function getSubstitutions(data) {
  console.log("line 150 ", data);
  switch(data.template){
    case 'forgot' : return {
      player_name: data.userName || "Poker-User",
      player_forgot_link: data.resetPasswordLink
    };
    break;
    case 'fundTransferPlayer' : return {
      player_name: data.content.userName || "Poker-User",
      player_referenceNo: data.content.referenceNo,
      player_amount: data.content.amount,
      player_totalAmount: data.content.totalAmount
    };
    break;
    case 'scratchCardAffiliate' : return {
      affiliate_name: data.content.name || "Poker-User",
      affiliate_userName: data.content.userName,
      affiliate_scratchCardDetails: data.content.scratchCardDetails
    };
    break;
    case 'scratchCardPlayer' : return {
      player_name: data.content.name || "Poker-User",
      player_userName: data.content.userName,
      player_scratchCardDetails: data.content.scratchCardDetails
    };
    break;
    case 'cashoutRejected': return {
      player_name: data.userName,
      player_referenceNo: data.transactionid,
      reject_reason: data.rejectReason
    };
    break;
    
    case 'fundTransferPlayerFail': return {
      player_name: data.content.userName
    };
    break;
    
    
    case 'cashoutApproved': return {
      player_name: data.content.userName,
      player_chips: data.content.chips,
      player_referenceNo: data.content.referenceNo
    };
    break;
    
    
    case 'cashoutUnsuccessful': return {
      player_name: data.content.userName,
      player_referenceNo: data.content.referenceNo,
      unsuccessful_reason: data.content.unsuccessfulReason
    };
    break;
    
    case 'cashoutSuccessful': return {
      player_name: data.content.userName,
      player_chips: data.content.chips,
      player_referenceNo: data.content.referenceNo,
      player_amount: data.content.amount,
      player_accountNumber: data.content.accountNumber,
      player_tds: data.content.tds,
      player_panNumber: data.content.panNumber
    };
    break;

    case 'scratchCardExpiration': return {
      player_name: data.content.name,
      player_userName: data.content.userName,
      player_scratchCardId: data.content.scratchCardId,
      player_date: data.content.date
    };
    break;

    case 'updatePlayerMail': return { 
      affiliate_name : data.content.parentName,
      player_name : data.content.playerName
    };
    break;

    case 'rakeback': return { 
      player_name : data.content.playerName,
      date : data.content.date,
      rakeBack_amount : data.content.rakeback,
      previous_bal : data.content.previousBal,
      new_Balance : data.content.newBalance
    };
    break;
    
    case 'affiliateSignUp': return { 
      affiliate_name : data.content.affiliateName,
      affiliate_userName : data.content.userName,
      link : data.content.link
    };
    break;

    case 'signUpBonus': return { 
      player_name : data.content.playerName,
      bonus_percent : data.content.bonusPercent,
      bonus_code : data.content.bonusCode,
      date : data.content.date
    };
    break;

    case 'instantBonusTransfer': return { 
      player_name : data.userName,
      player_amount: data.amount,
      player_text : data.mailText
    };

    break;
    
    case 'lockedBonusCredit': return { 
      player_name: data.content.userName,
      player_lockedAmount: data.content.lockedBonusAmount,
      player_currentVipLevel: data.content.playerCurrentVipLevel,
      player_bonusCreditedAt: data.content.bonusCreditedAt,
      player_bonusExpiredAt: data.content.bonusExpiredAt,
      player_vipPointsNeeded: data.content.vipPointsNeeded,
      player_depositAmount: data.content.depositAmount
    };

    break;

    case 'lockedBonusClaimed': return { 
      player_name: data.userName,
      player_claimedAmount: data.claimedAmount,
      player_playerPrevVipPoints: data.playerPrevVipPoints,
      player_playerNewVipPoints: data.playerNewVipPoints,
      player_playerPrevVipLevel: data.playerPrevVipLevel,
      player_playerNewVipLevel: data.playerNewVipLevel,
      player_previousChips: data.previousChips,
      player_updatedChips: data.updatedChips,
      player_vipPointsDeducted: data.vipPointsDeducted
    };

    break;

    case 'lockedBonusExpired': return { 
      player_name: data.userName,
      player_lockedBonus: data.lockedBonus,
      player_creditedDate: data.creditedDate,
      player_expiredDate: data.expiredDate
    };

    break;

    case 'inactivePlayer': return { 
    };
    break;

    case 'leaderboardWinner': return {
      player_name : data.content.userName,
      player_rank : data.content.rank,
      leaderboard_name : data.content.leaderboardName,
      leaderboard_stakes : data.content.stakes,
      leaderboard_startTime: data.content.startTime,
      leaderboard_endTime : data.content.endTime,
      player_VipPoints : data.content.vipPoints,
      player_amountWon : data.content.amountWon,
      leaderboard_prizePool: data.content.prizePool,
      leaderboard_text: data.content.text
    };
    break;

    case 'leaderboardWinnerHand': return {
      player_name : data.content.userName,
      player_rank : data.content.rank,
      leaderboard_name : data.content.leaderboardName,
      leaderboard_stakes : data.content.stakes,
      leaderboard_startTime: data.content.startTime,
      leaderboard_endTime : data.content.endTime,
      player_VipPoints : data.content.vipPoints,
      player_amountWon : data.content.amountWon,
      leaderboard_prizePool: data.content.prizePool,
      leaderboard_text: data.content.text
    };
    break;
    case 'leaderboardRegistration' : return {
      player_name : data.content.userName,
      leaderboard_name : data.content.leaderboardName,
      leaderboard_prizePool : data.content.prizePool,
      leaderboard_stakes : data.content.stakes,
      leaderboard_minVipPoints : data.content.minVipPoints,
      leaderboard_noOfWinners : data.content.noOfWinners
    };
    break;

    case 'dailyUpdateLockedBonus': return {
      player_name: data.content.name,
      player_lockedDataTable: data.content.dailyBonusDetails
    };
    break;

    case 'claimBonusMails': return {
      player_name: data.content.name,
      player_lockedClaimAvailble: data.content.claimBonusTable
    };
    break;

    // add more cases here
    case 'welcome' : // dont use break here
    default : return {
      player_name: data.userName || "Poker-Player",
      player_verify_link : data.verifyLink,
      player_link_title : data.linkTitle || "Click here to verify your mail"
    };
  }
}




module.exports = utilMethods;
