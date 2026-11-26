// Espera a que DynamoDB Local, el emulador de AWS y su CA estén listos (sin dependencias).
import { existsSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { homedir } from 'node:os';
import { join } from 'node:path';

const TIMEOUT_MS = 60_000;
const ca = join(process.env.HOME ?? homedir(), '.aws/emulator/9297/ca.pem');

const probe = (url, insecure) =>
  new Promise((resolve) => {
    const request = url.startsWith('https') ? httpsRequest : httpRequest;
    const req = request(url, { rejectUnauthorized: !insecure, timeout: 2000 }, (res) => {
      res.resume();
      // DynamoDB Local answers 400 on "/": any HTTP response means it is up.
      resolve(res.statusCode !== undefined && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => req.destroy());
    req.end();
  });

const checks = [
  ['AWS Emulator (https://127.0.0.1:9297)', () => probe('https://127.0.0.1:9297/__admin/health', true)],
  ['DynamoDB Local (http://127.0.0.1:8000)', () => probe('http://127.0.0.1:8000', false)],
  [`CA del emulador (${ca})`, async () => existsSync(ca)],
];

const deadline = Date.now() + TIMEOUT_MS;
let missing = [];
for (;;) {
  missing = [];
  for (const [name, check] of checks) if (!(await check())) missing.push(name);
  if (missing.length === 0) break;
  if (Date.now() > deadline) {
    console.error(`Timeout: faltan después de 60 s:\n  - ${missing.join('\n  - ')}\nCorré "pnpm dev:services" y reintentá.`);
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 1000));
}
console.log('servicios listos (services ready)');
