import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { env } from '../config/env'

function getKey(): Buffer {
  return Buffer.from(env.ENCRYPTION_KEY, 'hex')
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}.${encrypted.toString('hex')}.${tag.toString('hex')}`
}

export function decrypt(ciphertext: string): string {
  const [ivHex, encHex, tagHex] = ciphertext.split('.')
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return decipher.update(Buffer.from(encHex, 'hex')) + decipher.final('utf8')
}
