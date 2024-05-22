// var request = require("request");

// var options = { method: 'POST',
//   url: 'https://us16.api.mailchimp.com/3.0/campaigns/6e160bc8a4/actions/test',
//   headers:
//    { 'postman-token': 'd32e6bb2-849f-9bac-1287-c88bcb1577e2',
//      'cache-control': 'no-cache',
//      'content-type': 'application/javascript',
//      authorization: 'Basic YW55c3RyaW5nOmNjZmE5MTlkYTQ1MjMzZTc2NTJkM2I5NjI2Y2M4YWM3' },
//   body: '{"test_emails":["digvijay@creatiosoft.com"],"send_type":"html"}' };

// request(options, function (error, response, body) {
//   if (error) throw new Error(error);

//   console.log(body);
// });

var Mailchimp = require("mailchimp-api-v3");
var mailchimp = new Mailchimp("ccfa919da45233e7652d3b9626cc8ac7-us16");

var calls = [
  {
    method: "post",
    path: "/campaigns/337639/actions/send",
    body: {
      email_address: "digvijay@creatiosoft.com",
      status: "save",
    },
  },
  // {
  //   method : 'post',
  //   path : 'campaigns/337639/actions/send',
  //   body : {
  //     email_address : 'hammaad@creatiosoft.com',
  //     status : 'subscribed'
  //   }
  // }
];

var data = {
  method: "post",
  path: "/campaigns/c18ffb89fa/actions/send",
  body: {
    email_address: "digvijay@creatiosoft.com",
    status: "save",
    userName: "DIgvijay",
  },
};

mailchimp
  .post(data, {
    wait: true,
    interval: 2000,
    unpack: true,
  })
  .then(function (success) {
    console.log(success);
  })
  .catch(function (err) {
    console.log("errr", err);
  });
