'use strict'

const filterKeyStore = module.exports = {}

const keyToFilters = new Map()
const canonicalToKey = new Map()

const ENCODING = '0123456789abcdefghjkmnpqrstvwxyz'

function randomInt (max) {
  return Math.floor(Math.random() * max)
}

function encodeTime (time, length) {
  let out = ''
  for (let i = length - 1; i >= 0; i--) {
    const mod = time % 32
    out = ENCODING[mod] + out
    time = Math.floor(time / 32)
  }
  return out
}

function encodeRandom (length) {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += ENCODING[randomInt(32)]
  }
  return out
}

function generateUlid () {
  const timestamp = Date.now()
  return encodeTime(timestamp, 10) + encodeRandom(16)
}

function normalize (filters) {
  return {
    from: (filters.from || '').trim().toLowerCase(),
    to: (filters.to || '').trim().toLowerCase()
  }
}

function canonicalize (filters) {
  const normalized = normalize(filters)
  return `${normalized.from}|${normalized.to}`
}

filterKeyStore.getOrCreateKey = function (filters) {
  const normalized = normalize(filters)
  if (!normalized.from && !normalized.to) return ''

  const canonical = canonicalize(normalized)
  const existingKey = canonicalToKey.get(canonical)
  if (existingKey) return existingKey

  const key = generateUlid()
  canonicalToKey.set(canonical, key)
  keyToFilters.set(key, normalized)
  return key
}

filterKeyStore.getFiltersByKey = function (key) {
  if (!key) return null
  return keyToFilters.get(String(key)) || null
}
