require('dotenv').config();
const https = require('https');

const dbConfig = {
    hostname: process.env.HOST_NAME,
    headers: {
        'Authorization': `${process.env.ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
    }
};

// Utility function to make HTTP requests
const makeRequest = (method, path, data) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: dbConfig.hostname,
            path,
            method,
            headers: dbConfig.headers
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(body));
                } else {
                    reject(JSON.parse(body));
                }
            });
        });

        req.on('error', (e) => reject(e));
        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
};

function fetchTableContent(userEmail, instanceName, tableName) {
    const options = {
        hostname: dbConfig.hostname,
        path: `/instances/${userEmail}/${instanceName}/${tableName}`,
        method: 'GET',
        headers: dbConfig.headers
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';

            res.on('data', chunk => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`Failed to fetch table content: ${data}`));
                }
            });
        });

        req.on('error', error => {
            reject(error);
        });

        req.end();
    });
}

function addUser(userEmail, instanceName, tableName, newUser) {
    const options = {
        hostname: dbConfig.hostname,
        path: `/instances/${userEmail}/${instanceName}/${tableName}`,
        method: 'POST',
        headers: dbConfig.headers
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';

            res.on('data', chunk => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`Failed to add user: ${data}`));
                }
            });
        });

        req.on('error', error => {
            reject(error);
        });

        req.write(JSON.stringify(newUser));
        req.end();
    });
}

// Function to check if email exists
const checkEmailExists = async (email) => {
    try {
        const users = await makeRequest('GET', '/instances/mmaaced@gmail.com/links/ice_users.db');
        return users.some(user => user.email === email);
    } catch (error) {
        console.error('Error checking if email exists:', error);
        throw error;
    }
};


async function fetchUserByEmail(userEmail, instanceName, tableName, email) {
    const users = await fetchTableContent(userEmail, instanceName, tableName);
    return users.find(user => user.email === email);
}

module.exports = {
    fetchTableContent,
    addUser,
    fetchUserByEmail,
    makeRequest, 
    checkEmailExists
};
