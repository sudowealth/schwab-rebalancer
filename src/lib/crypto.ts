import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';

const algorithm = 'aes-256-gcm';
const scryptAsync = promisify(scrypt);

/**
 * Encrypt plaintext using AES-256-GCM
 * Returns a base64 string containing: salt(16) + iv(16) + authTag(16) + encrypted
 */
export async function encrypt(plaintext: string): Promise<string> {
  const password = process.env.DB_ENCRYPTION_KEY;

  // Fallback to base64 for development if no key is set
  if (!password) {
    console.warn('⚠️ DB_ENCRYPTION_KEY not set - using weak encoding for development only');
    return Buffer.from(plaintext, 'utf-8').toString('base64');
  }

  // Generate salt and derive key
  const salt = randomBytes(16);
  const key = (await scryptAsync(password, salt, 32)) as Buffer;

  // Generate initialization vector
  const iv = randomBytes(16);

  // Create cipher
  const cipher = createCipheriv(algorithm, key, iv);

  // Encrypt the plaintext
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  // Get the authentication tag
  const authTag = cipher.getAuthTag();

  // Combine salt + iv + authTag + encrypted data
  const combined = Buffer.concat([salt, iv, authTag, encrypted]);

  // Return as base64
  return combined.toString('base64');
}

/**
 * Decrypt data encrypted with encrypt()
 * Expects a base64 string containing: salt(16) + iv(16) + authTag(16) + encrypted
 */
export async function decrypt(encryptedData: string): Promise<string> {
  const password = process.env.DB_ENCRYPTION_KEY;

  // Fallback to base64 for development if no key is set
  if (!password) {
    console.warn('⚠️ DB_ENCRYPTION_KEY not set - using weak decoding for development only');
    return Buffer.from(encryptedData, 'base64').toString('utf-8');
  }

  // Decode from base64
  const combined = Buffer.from(encryptedData, 'base64');

  // Check minimum size (salt + iv + authTag = 48 bytes)
  if (combined.length < 48) {
    // Might be old base64-only data, try to decode it
    try {
      return combined.toString('utf-8');
    } catch {
      throw new Error('Invalid encrypted data format');
    }
  }

  // Extract components
  const salt = combined.subarray(0, 16);
  const iv = combined.subarray(16, 32);
  const authTag = combined.subarray(32, 48);
  const encrypted = combined.subarray(48);

  // Derive key from password and salt
  const key = (await scryptAsync(password, salt, 32)) as Buffer;

  // Create decipher
  const decipher = createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);

  // Decrypt
  try {
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return decrypted.toString('utf8');
  } catch {
    // If decryption fails, might be old base64 data
    // Try to decode the original as base64 (backward compatibility)
    try {
      const decoded = Buffer.from(encryptedData, 'base64').toString('utf-8');
      // Check if it looks like valid text (has printable characters)
      if (/^[\x20-\x7E\r\n\t]+$/.test(decoded)) {
        console.warn('⚠️ Decrypted legacy base64-encoded data - please re-encrypt');
        return decoded;
      }
    } catch {
      // Ignore and throw original error
    }
    throw new Error('Decryption failed - invalid key or corrupted data');
  }
}

/**
 * Generate a cryptographically secure secret of specified byte length
 * Returns base64url-encoded string suitable for environment variables
 */
export async function generateSecret(bytes: number = 32): Promise<string> {
  const key = randomBytes(bytes);
  return key.toString('base64url');
}
