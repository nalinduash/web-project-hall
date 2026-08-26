import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from './db.js';
import keys from './keys.js';
import dotenv from 'dotenv';

dotenv.config();

const JWT_ISSUER = process.env.JWT_ISSUER || 'http://localhost:5000';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'http://localhost:5173';

const PBKDF2_ITERATIONS = 600000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha512';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
  return `${salt}:${PBKDF2_ITERATIONS}:${hash}`;
}

export function verifyPassword(password, storedPasswordHash) {
  if (!storedPasswordHash || typeof storedPasswordHash !== 'string') return false;
  const parts = storedPasswordHash.split(':');

  let salt, iterations, storedHashHex;
  if (parts.length === 3) {
    [salt, iterations, storedHashHex] = parts;
    iterations = parseInt(iterations, 10) || PBKDF2_ITERATIONS;
  } else if (parts.length === 2) {
    // Backward compatibility for legacy 1,000-iteration hashes
    [salt, storedHashHex] = parts;
    iterations = 1000;
  } else {
    return false;
  }

  const verifyHashBuf = crypto.pbkdf2Sync(password, salt, iterations, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  const storedHashBuf = Buffer.from(storedHashHex, 'hex');

  if (verifyHashBuf.length !== storedHashBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(verifyHashBuf, storedHashBuf);
}

export async function sendOTP(email) {
  if (!email || !email.includes('@')) {
    throw new Error('Invalid email address');
  }

  // Cryptographically secure 6-digit OTP generation
  const code = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await db('otps').insert({ email, code, expires_at: expiresAt });

  console.log(`\n🔑 OTP for ${email}: ${code}\n`);

  return { message: 'OTP sent successfully (check backend console)' };
}

export async function verifyOTP(email, code) {
  const otp = await db('otps')
    .where({ email, code })
    .andWhere('expires_at', '>', db.fn.now())
    .andWhere({ used: false })
    .orderBy('created_at', 'desc')
    .first();

  if (!otp) throw new Error('Invalid or expired OTP');

  await db('otps').where({ id: otp.id }).update({ used: true });

  let user = await db('users').where({ email }).first();

  if (!user) {
    [user] = await db('users').insert({ email, role_id: 3 }).returning('*');
  }

  return generateTokenSet(user);
}

export async function signupWithPassword(email, password) {
  if (!email || !email.includes('@')) throw new Error('Invalid email address');
  if (!password || password.length < 6) throw new Error('Password must be at least 6 characters long');

  const normalizedEmail = email.toLowerCase().trim();
  const user = await db('users').where({ email: normalizedEmail }).first();
  
  if (user) {
    throw new Error('Email address is already registered');
  }

  const pHash = hashPassword(password);
  const [newUser] = await db('users').insert({ email: normalizedEmail, password_hash: pHash, role_id: 3 }).returning('*');

  return generateTokenSet(newUser);
}

export async function setPasswordForUser(userId, password) {
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long');
  }

  const user = await db('users').where({ id: userId }).first();
  if (!user) {
    throw new Error('User not found');
  }

  const pHash = hashPassword(password);
  await db('users').where({ id: userId }).update({ password_hash: pHash });

  return { message: 'Password updated successfully' };
}

export async function loginWithPassword(email, password) {
  if (!email || !password) throw new Error('Email and password are required');

  const user = await db('users').where({ email }).first();
  if (!user) throw new Error('Invalid email or password');
  
  if (!user.password_hash) {
    throw new Error('This account was created without a password. Please log in using Magic OTP.');
  }

  const isValid = verifyPassword(password, user.password_hash);
  if (!isValid) throw new Error('Invalid email or password');

  return generateTokenSet(user);
}

export function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function refreshTokens(refreshToken) {
  if (!refreshToken) throw new Error('Refresh token is required');

  const hashedRefreshToken = hashRefreshToken(refreshToken);

  const dbToken = await db('refresh_tokens')
    .where({ token: hashedRefreshToken })
    .andWhere('expires_at', '>', db.fn.now())
    .whereNull('revoked_at')
    .first();

  if (!dbToken) throw new Error('Invalid, expired, or revoked refresh token');

  const user = await db('users').where({ id: dbToken.user_id }).first();
  if (!user) throw new Error('User not found');

  await db('refresh_tokens').where({ id: dbToken.id }).update({ revoked_at: db.fn.now() });

  return generateTokenSet(user);
}

export async function revokeToken(refreshToken) {
  if (!refreshToken) throw new Error('Token is required for revocation');

  const hashedRefreshToken = hashRefreshToken(refreshToken);

  const updatedRows = await db('refresh_tokens')
    .where({ token: hashedRefreshToken })
    .whereNull('revoked_at')
    .update({ revoked_at: db.fn.now() });

  if (updatedRows === 0) return { message: 'Token already revoked or not found' };
  return { message: 'Token successfully revoked' };
}

async function getUserRolesAndPermissions(userId) {
  const result = await db('users as u')
    .leftJoin('roles as r', 'u.role_id', 'r.id')
    .leftJoin('role_permissions as rp', 'r.id', 'rp.role_id')
    .leftJoin('permissions as p', 'rp.permission_id', 'p.id')
    .select('u.email', 'r.name as role_name')
    .select(db.raw(`COALESCE(ARRAY_AGG(p.name) FILTER (WHERE p.name IS NOT NULL), '{}') as permissions`))
    .where('u.id', userId)
    .groupBy('u.id', 'u.email', 'r.name')
    .first();

  return result || null;
}

export async function generateTokenSet(user) {
  const payload = await getUserRolesAndPermissions(user.id);
  const permissions = payload ? payload.permissions : [];
  const role = payload ? payload.role_name : 'student';

  const jwtOptions = {
    algorithm: 'RS256',
    expiresIn: '15m',
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    keyid: 'key-1',
  };

  const accessTokenClaims = {
    sub: String(user.id),
    email: user.email,
    role: role,
    permissions: permissions,
  };
  const accessToken = jwt.sign(accessTokenClaims, keys.privateKey, jwtOptions);

  const idTokenClaims = {
    sub: String(user.id),
    email: user.email,
    email_verified: true,
  };
  const idToken = jwt.sign(idTokenClaims, keys.privateKey, jwtOptions);

  const refreshTokenString = crypto.randomBytes(40).toString('hex');
  const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const hashedRefreshToken = hashRefreshToken(refreshTokenString);

  await db('refresh_tokens').insert({
    token: hashedRefreshToken,
    user_id: user.id,
    expires_at: refreshTokenExpiry
  });

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 900,
    refresh_token: refreshTokenString,
    id_token: idToken,
  };
}
