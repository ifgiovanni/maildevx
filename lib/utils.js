'use strict'

const utils = module.exports = {}

// Create an unique id, length 8 characters
utils.makeId = function () {
  let text = ''
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

  for (let i = 0; i < 8; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}

// Clone object
utils.clone = function (object) {
  return JSON.parse(JSON.stringify(object))
}

// Format bytes
// Source: https://stackoverflow.com/a/18650828/3143704
utils.formatBytes = function (bytes, decimals = 2) {
  if (bytes === 0) return '0 bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

function lookup (obj, path) {
  const parts = path.split('.')
  const base = obj[parts[0]]
  if (!base) return
  if (parts.length === 1) {
    return base
  }
  const next = parts.slice(1).join('.')
  if (Array.isArray(base)) {
    return base.map((el) => {
      return lookup(el, next)
    })
  } else {
    return lookup(base, next)
  }
}

utils.filterEmails = function (emails, query) {
  const queryCopy = { ...query }
  const mailbox = queryCopy.mailbox || undefined
  const from = queryCopy.from || undefined
  const to = queryCopy.to || undefined

  delete queryCopy.key
  delete queryCopy.u
  delete queryCopy.mailbox
  delete queryCopy.from
  delete queryCopy.to

  return emails.filter((email) => {
    const hits = []
    if (mailbox) {
      if (mailbox !== 'all') {
        const to = email.to.map((el) => el.address)
        const cc = email.cc && email.cc.map((el) => el.address)
        const bcc = email.bcc && email.bcc.map((el) => el.address)

        if (to.includes(mailbox) || (cc && cc.includes(mailbox)) || (bcc && bcc.includes(mailbox))) {
          hits.push(true)
        } else {
          hits.push(false)
        }
      }
    }
    if (from) {
      if (from !== 'all') {
        const list = email.from.map((el) => el.address.toLowerCase())
        if (list.includes(from.toLowerCase())) {
          hits.push(true)
        } else {
          hits.push(false)
        }
      }
    }
    if (to) {
      if (to !== 'all') {
        const toList = email.to && email.to.map((el) => el.address.toLowerCase())
        const ccList = email.cc && email.cc.map((el) => el.address.toLowerCase())
        const bccList = email.bcc && email.bcc.map((el) => el.address.toLowerCase())
        const lowerTo = to.toLowerCase()
        const hasMatch = (toList && toList.includes(lowerTo)) || (ccList && ccList.includes(lowerTo)) || (bccList && bccList.includes(lowerTo))
        hits.push(Boolean(hasMatch))
      }
    }
    // Check all other query params
    for (const key in queryCopy) {
      if (Object.hasOwnProperty.call(queryCopy, key)) {
        const element = queryCopy[key]
        const value = lookup(email, key)
        if (Array.isArray(value)) {
          hits.push(value.includes(element))
        } else {
          hits.push(value === element)
        }
      }
    }
    return !hits.includes(false)
  })
}

utils.delay = function (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
