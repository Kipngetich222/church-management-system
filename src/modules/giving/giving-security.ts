import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'
import { GivingError, type GivingCredentials } from './giving.types'

function encryptionKey(key: string | undefined): Buffer {
  if (!key || !/^[a-f0-9]{64}$/i.test(key))
    throw new GivingError(
      'Giving credentials encryption is not configured. Set GIVING_CREDENTIALS_KEY on the server.',
      503
    )
  return Buffer.from(key, 'hex')
}
export function hasGivingEncryption(key?: string) {
  return !!key && /^[a-f0-9]{64}$/i.test(key)
}
export function encryptGivingCredentials(
  credentials: GivingCredentials,
  key?: string
) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(key), iv)
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(credentials), 'utf8'),
    cipher.final(),
  ])
  return [
    'v1',
    iv.toString('hex'),
    cipher.getAuthTag().toString('hex'),
    encrypted.toString('hex'),
  ].join('.')
}
export function decryptGivingCredentials(
  value: string,
  key?: string
): GivingCredentials {
  const secret = encryptionKey(key)
  try {
    const [version, iv, tag, ciphertext] = value.split('.')
    if (version !== 'v1') throw new Error('Unknown encryption format')
    const decipher = createDecipheriv(
      'aes-256-gcm',
      secret,
      Buffer.from(iv, 'hex')
    )
    decipher.setAuthTag(Buffer.from(tag, 'hex'))
    return JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(ciphertext, 'hex')),
        decipher.final(),
      ]).toString('utf8')
    )
  } catch {
    throw new GivingError(
      'The saved M-Pesa credentials could not be opened. Contact the platform administrator.',
      503
    )
  }
}
export function createCallbackToken() {
  return randomBytes(32).toString('hex')
}
export function callbackTokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}
export function validCallbackToken(token: string, hash: string) {
  return (
    /^[a-f0-9]{64}$/.test(token) &&
    /^[a-f0-9]{64}$/.test(hash) &&
    timingSafeEqual(
      Buffer.from(callbackTokenHash(token), 'hex'),
      Buffer.from(hash, 'hex')
    )
  )
}
export function givingCallbackBase(value: string): string | null {
  try {
    const url = new URL(value)
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/' ||
      !url.hostname.includes('.') ||
      /(^|\.)(localhost|local|internal)$/.test(url.hostname) ||
      /^(0\.|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
        url.hostname
      )
    )
      return null
    return url.origin
  } catch {
    return null
  }
}
