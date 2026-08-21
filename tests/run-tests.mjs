#!/usr/bin/env node
/* ============================================================
   LANCEUR DE TESTS — Les Blés de Demain
   Usage :  node tests/run-tests.mjs           (tous les tests)
            node tests/run-tests.mjs 02        (fichiers contenant "02")
   Prérequis sur Mac :  npm install playwright  (une seule fois, dans tests/)
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from './helpers/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPEC_DIR = path.join(__dirname, 'specs');
const filter = process.argv[2] || '';

const specFiles = fs.readdirSync(SPEC_DIR)
  .filter((f) => f.endsWith('.spec.mjs') && f.includes(filter))
  .sort();

const server = await startServer(8787);
const browser = await chromium.launch();

let passed = 0, failed = 0;
const failures = [];

for (const file of specFiles) {
  const mod = await import(path.join(SPEC_DIR, file));
  const tests = mod.tests || [];
  console.log(`\n▶ ${file}`);
  for (const t of tests) {
    const context = await browser.newContext({ viewport: { width: 1024, height: 1366 } }); // iPad portrait
    context.setDefaultTimeout(8000);
    try {
      await Promise.race([
        t.fn(context),
        new Promise((_, rej) => setTimeout(() => rej(new Error('test trop long (>30s)')), 30000)),
      ]);
      console.log(`  ✓ ${t.name}`);
      passed++;
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${String(err.message || err).split('\n').join('\n      ')}`);
      failed++;
      failures.push(`${file} > ${t.name}`);
    } finally {
      await context.close();
    }
  }
}

await browser.close();
server.close();

console.log(`\n============================`);
console.log(`  ${passed} réussi(s), ${failed} échoué(s)`);
if (failures.length) {
  console.log(`\n  Échecs :`);
  failures.forEach((f) => console.log(`   - ${f}`));
}
console.log(`============================`);
process.exit(failed ? 1 : 0);
