const http = require('http')

const server = http.createServer((req, res) => {
  // Log incoming traffic for debugging CI logs
  console.log(`[MOCK] ${req.method} ${req.url}`)

  // Always return 200 OK to simulate a healthy K8s API
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ status: 'OK', items: [] }))
})

// Listen on port 3000 (The default Hawtio Gateway port)
server.listen(3000, () => {
  console.log('Mock Backend listening on port 3000')
})
