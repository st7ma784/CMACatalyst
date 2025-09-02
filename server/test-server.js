const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        url: req.url 
    }));
});

const PORT = 5010;
server.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
});
