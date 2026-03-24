const https = require('https');
const fs = require('fs');
https.get('https://munsinca.vercel.app/js/db.js', res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    data = data.replace('onclick="openAuth(\\"delegate\\")"', 'onclick="window.openAuth(\'delegate\')"');
    fs.writeFileSync('c:/Users/home/Desktop/camuns/js/db.js', data, 'utf8');
    console.log('db.js recovered and fixed!');
  });
});
