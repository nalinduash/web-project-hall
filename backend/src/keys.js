import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KEYS_DIR = path.join(__dirname, '../.keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'private.pem');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'public.pem');

// Load or generate keys
export function loadKeys() {
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }

  let privateKeyPem;
  let publicKeyPem;

  if (fs.existsSync(PRIVATE_KEY_PATH) && fs.existsSync(PUBLIC_KEY_PATH)) {
    privateKeyPem = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
    publicKeyPem = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
  } else {
    console.log('Generating new RS256 RSA-2048 keypair for OIDC signing...');
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    fs.writeFileSync(PRIVATE_KEY_PATH, privateKey);
    fs.writeFileSync(PUBLIC_KEY_PATH, publicKey);

    privateKeyPem = privateKey;
    publicKeyPem = publicKey;
    console.log('Keys generated and stored in backend/.keys/');
  }

  // Export JWK structure for the OIDC JWKS endpoint
  const pubKeyObject = crypto.createPublicKey(publicKeyPem);
  const jwk = pubKeyObject.export({ format: 'jwk' });

  // Add standard OIDC parameters to JWK
  const formattedJwk = {
    kty: jwk.kty,
    n: jwk.n,
    e: jwk.e,
    use: 'sig',
    alg: 'RS256',
    kid: 'key-1', // Fixed Key ID for simple OIDC setup
  };

  return {
    privateKey: privateKeyPem,
    publicKey: publicKeyPem,
    jwk: formattedJwk,
  };
}

const keys = loadKeys();
export default keys;
