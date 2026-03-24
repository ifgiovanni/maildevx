'use strict'

/**
 * MailDev - web.js
 */

const express = require('express')
const cors = require('cors')
const http = require('http')
const https = require('https')
const fs = require('fs')
const socketio = require('socket.io')
const routes = require('./routes')
const auth = require('./auth')
const logger = require('./logger')
const path = require('path')
const filterKeys = require('./filterKeys')

const web = module.exports = {}

/**
 * Keep record of all connections to close them on shutdown
 */
const connections = {}
let io

function handleConnection (socket) {
  const key = `${socket.remoteAddress}:${socket.remotePort}`
  connections[key] = socket
  socket.on('close', function () {
    delete connections[key]
  })
}

function closeConnections () {
  for (const key in connections) {
    connections[key].destroy()
  }
}

/**
 * WebSockets
 */

function emitNewMail (socket) {
  return function (email) {
    socket.emit('newMail', email)
  }
}

function emitDeleteMail (socket) {
  return function (email) {
    socket.emit('deleteMail', email)
  }
}

function webSocketConnection (mailserver) {
  return function onConnection (socket) {
    const queryKey = socket.handshake?.query?.u || socket.handshake?.query?.key || ''
    const queryFilterFrom = socket.handshake?.query?.from || ''
    const queryFilterTo = socket.handshake?.query?.to || ''
    const keyFilters = filterKeys.getFiltersByKey(queryKey)
    const filterFrom = (keyFilters?.from || queryFilterFrom || socket.request.session?.filterFrom || socket.request.cookies?.filterFrom || '').trim()
    const filterTo = (keyFilters?.to || queryFilterTo || socket.request.session?.filterTo || socket.request.cookies?.filterTo || '').trim()

    const newHandlers = function (email) {
      const fromMatches = !filterFrom || (email.from && email.from.some(from => from.address && from.address.toLowerCase() === filterFrom.toLowerCase()))
      const toMatches = !filterTo || (
        (email.to && email.to.some(to => to.address && to.address.toLowerCase() === filterTo.toLowerCase())) ||
        (email.cc && email.cc.some(cc => cc.address && cc.address.toLowerCase() === filterTo.toLowerCase())) ||
        (email.bcc && email.bcc.some(bcc => bcc.address && bcc.address.toLowerCase() === filterTo.toLowerCase()))
      )

      if (fromMatches && toMatches) {
        socket.emit('newMail', email)
      }
    }

    //const newHandlers = emitNewMail(socket)
    const deleteHandler = emitDeleteMail(socket)
    mailserver.on('new', newHandlers)
    mailserver.on('delete', deleteHandler)

    function removeListeners () {
      mailserver.removeListener('new', newHandlers)
      mailserver.removeListener('delete', deleteHandler)
    }

    socket.on('disconnect', removeListeners)
  }
}

web.server = null

/**
 * Start the web server
 */

web.start = function (port, host, mailserver, user, password, basePathname, secure) {
  const app = express()
  if (secure.https) {
    if (fs.existsSync(secure.key) === false) {
      logger.error('Unable to find https secure key. Please specify key file via -https-key argument')
      return
    }
    if (fs.existsSync(secure.cert) === false) {
      logger.error('Unable to find https secure cert. Please specify cert file via -https-cert argument')
      return
    }
    const options = {
      key: fs.readFileSync(secure.key),
      cert: fs.readFileSync(secure.cert)
    }
    web.server = https.createServer(options, app)
  } else {
    web.server = http.createServer(app)
  }

  const cookieParser = require('cookie-parser')  
  app.use(cookieParser())  

  const session = require('express-session')

  const sessionMiddleware = session({  
    secret: 'maildev-filter',  
    resave: false,  
    saveUninitialized: true,  
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 días  
  });  
  
  app.use(sessionMiddleware); 

  if (user && password) {
    app.use(auth(basePathname, user, password))
  }

  if (!basePathname) {
    basePathname = '/'
  }

  io = socketio({ path: path.posix.join(basePathname, '/socket.io') })

  io.use((socket, next) => {  
    sessionMiddleware(socket.request, socket.request.res || {}, next);  
  });

  app.use(function (req, res, next) {
    const fromQuery = (req.query.from || '').trim()
    const toQuery = (req.query.to || '').trim()
    const keyQuery = (req.query.u || req.query.key || '').trim()
    const forceInboxView = req.query.view === 'all'

    if (req.path === '/' && !forceInboxView) {
      if ((fromQuery || toQuery) && !keyQuery) {
        const generatedKey = filterKeys.getOrCreateKey({ from: fromQuery, to: toQuery })
        const newQuery = new URLSearchParams(req.query)
        newQuery.delete('from')
        newQuery.delete('to')
        if (generatedKey) newQuery.set('u', generatedKey)
        return res.redirect('/?' + newQuery.toString())
      }

      const keyFromCookieOrSession = (req.cookies.filterKey || req.session?.filterKey || '').trim()
      if (!keyQuery && keyFromCookieOrSession) {
        const q = new URLSearchParams(req.query)
        q.set('u', keyFromCookieOrSession)
        return res.redirect('/?' + q.toString())
      }

      const resolvedFilters = keyQuery ? filterKeys.getFiltersByKey(keyQuery) : null
      if (keyQuery && !resolvedFilters && !keyFromCookieOrSession) {
        return res.sendFile(path.join(__dirname, '../app/welcome.html'))
      }

      if (keyQuery && resolvedFilters) {
        if (req.session) {
          req.session.filterKey = keyQuery
          req.session.filterFrom = resolvedFilters.from
          req.session.filterTo = resolvedFilters.to
        }
        res.cookie('filterKey', keyQuery, { maxAge: 30 * 24 * 60 * 60 * 1000 })
      }
    }

    const hasFromFilter = Boolean(req.cookies.filterFrom || req.query.from)
    const hasToFilter = Boolean(req.cookies.filterTo || req.query.to)
    const hasKeyFilter = Boolean(req.cookies.filterKey || req.query.u || req.query.key || req.session?.filterKey)

    if (req.path === '/' && !forceInboxView && !hasFromFilter && !hasToFilter && !hasKeyFilter) {
      return res.sendFile(path.join(__dirname, '../app/welcome.html'))
    }
    next()
  })

  app.use(basePathname, express.static(path.join(__dirname, '../app')))

  app.use(cors())

  routes(app, mailserver, basePathname)

  io.attach(web.server)
  io.on('connection', webSocketConnection(mailserver))

  port = port || 1080
  host = host || '::'

  web.server.listen(port, host)

  web.server.on('connection', handleConnection)

  const printHost = host === '::' ? 'localhost' : host
  logger.info('MailDev webapp running at http://%s:%s%s', printHost, port, basePathname)
}

web.close = function (callback) {
  if (!web.server && typeof callback === 'function') {
    return callback()
  }
  closeConnections()
  io.close(callback)
}
