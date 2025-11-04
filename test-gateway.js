#!/usr/bin/env node

// Simple test script to verify the gateway path issue is fixed
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3101,
  path: '/lego/health',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`Response: ${data}`);
  });
});

req.on('error', (err) => {
  console.error(`Request error: ${err.message}`);
});

req.end();