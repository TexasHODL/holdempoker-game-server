/*
* @Author: sushiljainam
* @Date:   2018-03-12 16:00:55
* @Last Modified by:   digvijay
* @Last Modified time: 2018-12-28 17:01:33
*/

/*jshint node: true */
"use strict";

/**
 * local implementation of linkedlist
 * to store list of task
 * for lock table module per channel
 * COST EFFECTIVE - due to saves ref to head and last both
 * @method LinkedList
 */
var LinkedList = function () {
  this.head = null;
  this.last = this.head;
  this.length = 0;
};

/**
 * add an item at the end of list
 * @method push
 * @param  {Object} obj item object to add to list
 * @return {Object}     ref of list (can be chained)
 */
LinkedList.prototype.push = function (obj) {
  var elm = {
    data: obj,
    nextElm: null
  };
  if (!!this.last) {
    this.last.nextElm = elm;
    this.last = elm;
  } else {
    this.head = this.last = elm;
  }
  this.length++;
  return this;
};

/**
 * fetch first item of list and remove it from list
 * @method shift
 * @return {Object} item if available
 */
LinkedList.prototype.shift = function () {
  var p;
  if (!!this.head) {
    p = this.head.data;
    this.head = this.head.nextElm;
    if (!this.head) {
      this.last = this.head;
    }
    this.length--;
  }
  return p;
};

/**
 * fetch first item of list
 * @method firstElm
 * @return {Object} item if available
 */
LinkedList.prototype.firstElm = function () {
  var p;
  if (!!this.head) {
    p = this.head.data;
  }
  return p;
};

/**
 * print items of list on console
 * @method print
 */
LinkedList.prototype.print = function () {
  for (var c = this.head&&this.head; console.log(c&&c.data), c&&c.nextElm; c=c.nextElm) {}
  return;
};

/**
 * export list to array format
 * @method toArray
 * @return {Array} array of items in seq from head
 */
LinkedList.prototype.toArray = function() {
	var r = [];
  for (var c = this.head&&this.head; c&&c.data&&r.push(c.data), c&&c.nextElm; c=c.nextElm) {}
  return r;
};

module.exports = LinkedList;
