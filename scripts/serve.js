'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', 'dist');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const port = Number(process.env.PORT || 4173);
http.createServer((req,res) => {
  let filename;
  try { filename = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  filename = path.resolve(root, '.' + (filename === '/' ? '/index.html' : filename));
  if (!filename.startsWith(root + path.sep)) {res.writeHead(403).end();return;}
  fs.readFile(filename, (err, data) => {
    if (err) {res.writeHead(404).end('Not found');return;}
    res.writeHead(200, {'Content-Type':types[path.extname(filename)] || 'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}`));
