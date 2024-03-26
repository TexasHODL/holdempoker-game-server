const https = require('http')
//If the protocol is https please set devType="prod" in /config/keys

/**
 * method used to call a REST Web Service API
 * @method requestData
 * @author MX1
 * @date   2023-09-27
 * @param  {String}     method GET, POST, PUT, DELETE... Default: "GET"
 * @param  {String}     path URN. Ex: /api/foo
 * @param  {Object}     data   body
 * @param  {Object}     headersEx   Add or overwrite headers
 * @return {[type]}     Promise<any>
 */

async function requestData(method = "GET", path = '', data = {}, headersEx = {}) {
    const temp = JSON.stringify(data);
    const options = {
        hostname: "192.168.1.14",
        port: 7500,
        path,
        method,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(temp)
        }
    };
    // ovwerwrite header 
    if (!isEmpty(headersEx)) {
        Object.assign(options.headers, headersEx);
    }

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            console.log(`STATUS: ${res.statusCode}`);
            console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                console.log(`BODY: ${chunk}`);
                resolve({ status: res.statusCode, result: chunk });

            });
            res.on('end', () => {
                console.log('No more data in response.');
            });
        });

        req.on('error', (e) => {
            console.error(`problem with request: ${e.message}`);
            reject({ status: 500, result: e.message });
        });

        // Write data to request body
        req.write(temp);
        req.end();
    });
}

function isEmpty(obj = {}) {
    for (var prop in obj) {
        if (obj.hasOwnProperty(prop))
            return false;
    }
    return true;
}

module.exports = { requestData };