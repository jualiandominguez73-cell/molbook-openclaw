const https = require('https');

const body = require('fs').readFileSync('PR_BODY.txt', 'utf8');
const data = JSON.stringify({ body });

const options = {
  hostname: 'api.github.com',
  path: '/repos/openclaw/openclaw/pulls/7480',
  method: 'PATCH',
  headers: {
    'User-Agent': 'OpenClaw-PR-Update',
    'Authorization': `token ${process.env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = https.request(options, (res) => {
  let responseData = '';
  res.on('data', (chunk) => responseData += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', responseData);
    process.exit(res.statusCode === 200 ? 0 : 1);
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
  process.exit(1);
});

req.write(data);
req.end();
