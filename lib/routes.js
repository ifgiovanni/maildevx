'use strict'

/**
 * MailDev - routes.js
 */
const express = require('express')
const compression = require('compression')
const pkg = require('../package.json')
const path = require('path')
const filterKeys = require('./filterKeys')
const { filterEmails } = require('./utils')

const emailRegexp = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

module.exports = function (app, mailserver, basePathname) {
  const router = express.Router()

  router.use(express.urlencoded({ extended: true }));  

  function resolveFilters (req) {
    const from = (req.query.from || req.session?.filterFrom || req.cookies?.filterFrom || '').trim()
    const to = (req.query.to || req.session?.filterTo || req.cookies?.filterTo || '').trim()
    let key = (req.query.u || req.query.key || req.session?.filterKey || req.cookies?.filterKey || '').trim()

    if (key) {
      const byKey = filterKeys.getFiltersByKey(key)
      if (byKey) {
        return { key, from: byKey.from, to: byKey.to }
      }
      key = ''
    }

    if (from || to) {
      key = filterKeys.getOrCreateKey({ from, to })
      return { key, from, to }
    }

    return { key: '', from: '', to: '' }
  }

  // Middleware para verificar la sesión de filtrado  
  router.use(function (req, res, next) {
    if (req.path.startsWith('/email') && req.method === 'GET') {
      const resolved = resolveFilters(req)
      if (!req.query.u && !req.query.key && resolved.key) {
        const newQuery = { ...req.query }
        delete newQuery.from
        delete newQuery.to
        newQuery.u = resolved.key
        const url = req.path + '?' + new URLSearchParams(newQuery).toString()
        return res.redirect(url)
      }

      if ((req.query.u || req.query.key) && resolved.from && !req.query.from) req.query.from = resolved.from
      if ((req.query.u || req.query.key) && resolved.to && !req.query.to) req.query.to = resolved.to
    }
    next()
  })
    
  // Ruta para la página de bienvenida y configuración del filtro  
  router.get('/welcome', function(req, res) {  
    res.sendFile(path.join(__dirname, '../app/welcome.html'));  
  });  
    
  // Ruta para establecer el filtro  
  router.post('/set-filter', function (req, res) {
    const mode = req.body.mode
    let filterFrom = (req.body.from || '').trim()
    let filterTo = (req.body.to || '').trim()

    if (mode === 'all') {
      filterFrom = ''
      filterTo = ''
    }

    const key = filterKeys.getOrCreateKey({ from: filterFrom, to: filterTo })

    if (req.session) {
      req.session.filterFrom = filterFrom
      req.session.filterTo = filterTo
      req.session.filterKey = key
    }

    if (filterFrom) res.cookie('filterFrom', filterFrom, { maxAge: 30 * 24 * 60 * 60 * 1000 })
    else res.clearCookie('filterFrom')

    if (filterTo) res.cookie('filterTo', filterTo, { maxAge: 30 * 24 * 60 * 60 * 1000 })
    else res.clearCookie('filterTo')

    if (key) res.cookie('filterKey', key, { maxAge: 30 * 24 * 60 * 60 * 1000 })
    else res.clearCookie('filterKey')

    const query = new URLSearchParams()
    if (mode === 'all') {
      query.set('view', 'all')
    } else {
      if (key) query.set('u', key)
    }

    const queryString = query.toString()
    res.redirect('/' + (queryString ? '?' + queryString : ''))
  })
  
  // Route to clear the filter
  router.post('/clear-filter', function (req, res) {
    if (req.session) {
      req.session.filterFrom = ''
      req.session.filterTo = ''
      req.session.filterKey = ''
    }
    res.clearCookie('filterFrom')
    res.clearCookie('filterTo')
    res.clearCookie('filterKey')
    return res.json({ success: true })
  })

  // Get all emails
  // Optional
  // - skip - number of email offset for pagination
  // - limit - number of emails to return
  // - *any* - query using dot notation for any param, ex. from.address=hello@yes.com
  router.get('/email', compression(), function (req, res) {
    mailserver.getAllEmail(function (err, emailList) {
      if (err) return res.status(404).json([])
      const { skip, limit, ...query } = req.query
      const skipCount = Number.isInteger(parseInt(skip, 10)) ? Math.max(0, parseInt(skip, 10)) : 0
      const parsedLimit = parseInt(limit, 10)
      const limitCount = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : null
      const applyWindow = function (list) {
        if (!limitCount) return list.slice(skipCount)
        return list.slice(skipCount, skipCount + limitCount)
      }
      if (Object.keys(query).length) {
        const filteredEmails = filterEmails(emailList, query)
        console.log('Filtered Emails:', filteredEmails.length)
        res.json(applyWindow(filteredEmails))
      } else {
        res.json(applyWindow(emailList))
      }
    })
  })

  // Get single email
  router.get('/email/:id', function (req, res) {
    mailserver.getEmail(req.params.id, function (err, email) {
      if (err) return res.status(404).json({ error: err.message })

      email.read = true // Mark the email as 'read'

      res.json(email)
    })
  })

  // Read email
  // router.patch('/email/:id/read', function (req, res) {
  //  mailserver.readEmail(req.params.id, function (err, email) {
  //    if (err) return res.status(500).json({ error: err.message })
  //    res.json(true)
  //  })
  // })

  // Read all emails
  router.patch('/email/read-all', function (req, res) {
    mailserver.readAllEmail(function (err, count) {
      if (err) return res.status(500).json({ error: err.message })
      res.json(count)
    })
  })

  // Delete all emails
  router.delete('/email/all', function (req, res) {
    mailserver.deleteAllEmail(function (err) {
      if (err) return res.status(500).json({ error: err.message })

      res.json(true)
    })
  })

  // Delete email by id
  router.delete('/email/:id', function (req, res) {
    mailserver.deleteEmail(req.params.id, function (err) {
      if (err) return res.status(500).json({ error: err.message })

      res.json(true)
    })
  })

  // Get Email HTML
  router.get('/email/:id/html', function (req, res) {
    // Use the headers over hostname to include any port
    const baseUrl = req.headers.host + (req.baseUrl || '')

    mailserver.getEmailHTML(req.params.id, baseUrl, function (err, html) {
      if (err) return res.status(404).json({ error: err.message })

      res.send(html)
    })
  })

  // Serve Attachments
  router.get('/email/:id/attachment/:filename', function (req, res) {
    mailserver.getEmailAttachment(req.params.id, req.params.filename, function (err, contentType, readStream) {
      if (err) return res.status(404).json('File not found')

      res.contentType(contentType)
      readStream.pipe(res)
    })
  })

  // Serve email.eml
  router.get('/email/:id/download', function (req, res) {
    mailserver.getEmailEml(req.params.id, function (err, contentType, filename, readStream) {
      if (err) return res.status(404).json('File not found')

      res.setHeader('Content-disposition', 'attachment; filename=' + filename)
      res.contentType(contentType)
      readStream.pipe(res)
    })
  })

  // Get email source from .eml file
  router.get('/email/:id/source', function (req, res) {
    mailserver.getRawEmail(req.params.id, function (err, readStream) {
      if (err) return res.status(404).json('File not found')
      readStream.pipe(res)
    })
  })

  // Get any config settings for display
  router.get('/config', function (req, res) {
    const resolved = resolveFilters(req)
    res.json({
      version: pkg.version,
      smtpPort: mailserver.port,
      isOutgoingEnabled: mailserver.isOutgoingEnabled(),
      outgoingHost: mailserver.getOutgoingHost(),
      filterFrom: resolved.from,
      filterTo: resolved.to,
      filterKey: resolved.key
    })
  })

  router.get('/metrics', function (req, res) {
    const resolved = resolveFilters(req)
    mailserver.getAllEmail(function (err, emailList) {
      if (err) return res.status(500).json({ error: err.message })

      const query = {}
      if (resolved.from) query.from = resolved.from
      if (resolved.to) query.to = resolved.to
      const inboxEmails = Object.keys(query).length ? filterEmails(emailList, query) : emailList
      const inboxUnread = inboxEmails.filter(function (email) { return !email.read }).length

      res.json({
        totalReceived: emailList.length,
        inboxCount: inboxEmails.length,
        inboxUnread,
        inboxRead: inboxEmails.length - inboxUnread
      })
    })
  })

  router.get('/filter-key', function (req, res) {
    const from = (req.query.from || '').trim()
    const to = (req.query.to || '').trim()
    const key = filterKeys.getOrCreateKey({ from, to })
    res.json({ key })
  })

  // Relay the email
  router.post('/email/:id/relay/:relayTo?', function (req, res) {
    mailserver.getEmail(req.params.id, function (err, email) {
      if (err) return res.status(404).json({ error: err.message })

      if (req.params.relayTo) {
        if (emailRegexp.test(req.params.relayTo)) {
          email.to = [{ address: req.params.relayTo }]
          email.envelope.to = [{ address: req.params.relayTo, args: false }]
        } else {
          return res.status(400).json({ error: 'Incorrect email address provided :' + req.params.relayTo })
        }
      }

      mailserver.relayMail(email, function (err) {
        if (err) return res.status(500).json({ error: err.message })

        res.json(true)
      })
    })
  })

  // Health check
  router.get('/healthz', function (req, res) {
    res.json(true)
  })

  router.get('/reloadMailsFromDirectory', function (req, res) {
    mailserver.loadMailsFromDirectory()
    res.json(true)
  })
  app.use(basePathname, router)
}
