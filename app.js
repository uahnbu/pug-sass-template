const fs = require('fs')
const os = require('os')
const http = require('http')
const path = require('path')
const sass = require('sass')
const pug = require('pug')

const URL_MAP = {
  '/': 'public/index.html',
  '/index.html': 'public/index.html',
  '/style.css': 'public/style.css'
}

const SRC_FILES = {
  '.pug': ['index.pug'],
  '.sass': ['style.sass']
}

const SRC_EXT_MAP = {
  '.pug': '.html',
  '.sass': '.css'
}

const SRC_RENDERER = {
  '.pug': fileName => pug.renderFile(fileName, { pretty: true }),
  '.sass': fileName => sass.compile(fileName).css
}

/** @type {Set.<http.ServerResponse>} */
const clients = new Set

const server = http.createServer((req, res) => {
  if (req.method !== 'GET') {
    res.writeHead(405)
    res.end('Method not allowed')
    return
  }
  if (req.url === '/reload-status') {
    console.log('New client connected.')
    clients.add(res)
    res.writeHead(200, {
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Content-Type': 'text/event-stream'
    })
  } else handleGetRequest(res, req.url)
})

server.listen(5050, () => {
  const { port } = server.address()
  const nets = os.networkInterfaces()['Wi-Fi']
  const ip = nets.find(net => net.family === 'IPv4').address
  console.log(`Server is running on http://${ip}:${port}`)
})

let isObservable = true

fs.watch('src', (_eventType, fileName) => {
  if (!isObservable) return 
  setTimeout(() => isObservable = true, 100)
  isObservable = render(fileName)
  clients.forEach(client => client.write('data: \n\n'))
})

/**
 * @param {string} [fileName]
 */
function render(fileName) {
  if (!fileName) return Object.values(SRC_FILES).flat().forEach(render)
  const ext = path.extname(fileName)
  const targetExt = SRC_EXT_MAP[ext]
  const newFileName = fileName.slice(0, -ext.length) + targetExt
  const source = path.join(__dirname, 'src', fileName)
  const target = path.join(__dirname, 'public', newFileName)
  try {
    const content = SRC_RENDERER[ext](source)
    fs.writeFileSync(target, content)
    console.log('File updated:', fileName, '->', newFileName)
  } catch (err) { console.error(err) }
}

/**
 * @param {http.ServerResponse} res
 * @param {string} url
 */
function handleGetRequest(res, url) {
  if (!URL_MAP.hasOwnProperty(url)) {
    res.writeHead(404)
    res.end('Not found')
    return
  }
  const filePath = path.join(__dirname, URL_MAP[url])
  let content = fs.readFileSync(filePath)
  if (URL_MAP[url] === 'public/index.html') {
    const injectHTML = fs.readFileSync('inject.html')
    content += injectHTML
  }
  res.write(content)
  res.end()
}