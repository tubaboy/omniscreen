const http = require('http');

const data = JSON.stringify({
  image: 'data:image/jpeg;base64,' + Buffer.from('dummy image content').toString('base64')
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/screens/cmmsipx5t00027k6cipxdr1ug/snapshot',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Screen-Id': 'cmmsipx5t00027k6cipxdr1ug',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`Problem: ${e.message}`);
});

req.write(data);
req.end();
