/**
 * Author: Gaurav Gupta
 */
/*jshint node: true */
"use strict";

var crypto = require('crypto'),
    algorithm = 'aes-256-ctr',
    privateKey = '37LvDSm4XvjYOh9Y';

// method to decrypt data(password) 
function decrypt(password) {
  try{
    var decipher = crypto.createDecipher(algorithm, privateKey);
    var dec = decipher.update(password, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return {success: true, result: dec};    
  } catch(ex){
    return {success: false, info: "Bad input"};
  }
}

// method to encrypt data(password)
function encrypt(password) {
  try{
    var cipher = crypto.createCipher(algorithm, privateKey);
    var crypted = cipher.update(password, 'utf8', 'hex');
    crypted += cipher.final('hex');
    return {success: true, result: crypted} ;
  } catch(ex){
    return {success: false, info: "Bad input"};
  }
}

exports.decrypt = function(password) {
    return decrypt(password);
};

exports.encrypt = function(password) {
    return encrypt(password);
};
