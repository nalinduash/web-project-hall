import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_CERTS_DIR = path.join(__dirname, '../.certs');
const DEFAULT_KEY_PATH = path.join(DEFAULT_CERTS_DIR, 'key.pem');
const DEFAULT_CERT_PATH = path.join(DEFAULT_CERTS_DIR, 'cert.pem');

/**
 * Ensures SSL certificates exist (generating self-signed certificates for localhost if needed)
 * and returns the SSL options required by https.createServer.
 */
export function loadSSLOptions() {
  const rawKeyPath = process.env.SSL_KEY_PATH?.trim();
  const rawCertPath = process.env.SSL_CERT_PATH?.trim();

  // If custom paths are explicitly provided, resolve and verify them
  if (rawKeyPath && rawCertPath) {
    // Try resolving directly, relative to cwd, or relative to backend directory
    const candidatesKey = [
      rawKeyPath,
      path.resolve(process.cwd(), rawKeyPath),
      path.resolve(__dirname, '..', rawKeyPath.replace(/^\//, '')),
      path.join(DEFAULT_CERTS_DIR, path.basename(rawKeyPath)),
    ];
    const candidatesCert = [
      rawCertPath,
      path.resolve(process.cwd(), rawCertPath),
      path.resolve(__dirname, '..', rawCertPath.replace(/^\//, '')),
      path.join(DEFAULT_CERTS_DIR, path.basename(rawCertPath)),
    ];

    const resolvedKey = candidatesKey.find((p) => fs.existsSync(p));
    const resolvedCert = candidatesCert.find((p) => fs.existsSync(p));

    if (resolvedKey && resolvedCert) {
      return {
        key: fs.readFileSync(resolvedKey, 'utf8'),
        cert: fs.readFileSync(resolvedCert, 'utf8'),
      };
    }

    console.warn(`⚠️ Configured SSL paths not found (key="${rawKeyPath}", cert="${rawCertPath}"). Falling back to auto-generated certs.`);
  }

  // Ensure default certs directory exists
  if (!fs.existsSync(DEFAULT_CERTS_DIR)) {
    fs.mkdirSync(DEFAULT_CERTS_DIR, { recursive: true });
  }

  // If default certificates do not exist, auto-generate self-signed certs for localhost
  if (!fs.existsSync(DEFAULT_KEY_PATH) || !fs.existsSync(DEFAULT_CERT_PATH)) {
    console.log('🔒 Generating self-signed SSL/TLS certificate for localhost HTTPS...');
    try {
      execFileSync('openssl', [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-keyout',
        DEFAULT_KEY_PATH,
        '-out',
        DEFAULT_CERT_PATH,
        '-days',
        '365',
        '-nodes',
        '-subj',
        '/C=US/ST=Dev/L=Local/O=ProjectHall/CN=localhost',
        '-addext',
        'subjectAltName=DNS:localhost,IP:127.0.0.1,IP:0.0.0.0',
      ]);
      console.log(`✅ Self-signed SSL certificate generated at: ${DEFAULT_CERTS_DIR}`);
    } catch (err) {
      throw new Error(`Failed to automatically generate self-signed certificate: ${err.message}`);
    }
  }

  return {
    key: fs.readFileSync(DEFAULT_KEY_PATH, 'utf8'),
    cert: fs.readFileSync(DEFAULT_CERT_PATH, 'utf8'),
  };
}

export default loadSSLOptions;
