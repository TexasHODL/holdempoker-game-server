const devType = "dev"; // please set dev or prod here for the protocol used
const https = devType === "prod" ? require('http') : require('https'); //"dev" | "prod" development | production
//If the protocol is https please set devType="prod" in /config/keys
const authService = {
    host: process.env.AUTH_HOST,
    port: process.env.AUTH_PORT
};

/**
 * method used to call a REST Web Service API
 * @method requestData
 * @author MX1
 * @date   2022-10-25
 * @param  {String}     method GET, POST, PUT, DELETE... Default: "GET"
 * @param  {String}     path URN. Ex: /api/foo
 * @param  {Object}     data   body
 * @param  {Object}     headersEx   Add or overwrite headers
 * @return {[type]}     Promise<any>
 */

async function requestData(method, path, data = {}, headersEx = {}) {
    console.log("DDDDDDDDDDDDDDDDDDDDDDDDDDDDDD")
    console.log(authService.host);
    console.log(authService.port);
    if (!['GET', 'POST', 'PUT', 'DELETE', 'CONNECT', 'TRACE', 'PATCH'].includes(method)) {
        return new Promise((resolve, reject) => {
            reject({ status: 400, result: "invalid method" });
        });
    }
    const temp = JSON.stringify(data);
    const options = {
        hostname: authService.host,
        port: authService.port,
        path,
        method,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(temp)
        }
    };

    // ovwerwrite header 
    if (!isEmpty(headersEx)) {
        console.log("overwrite header");
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

function isValidHost(host = "") {
    const regex = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\\-]*[A-Za-z0-9](\.?))$/g;
    return regex.test(host);
}

module.exports = requestData;