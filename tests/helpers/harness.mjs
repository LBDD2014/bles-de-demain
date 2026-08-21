/* ============================================================
   HARNESS — démarre un petit serveur local qui sert l'app,
   ouvre un navigateur Chromium et branche le mock Supabase.
   Aucune requête ne sort vers Internet pendant les tests.
   ============================================================ */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeDB, TEST_NOW_MS } from './fixtures.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const APP_DIR = path.resolve(__dirname, '..', '..');
const MOCK_SUPA = fs.readFileSync(path.join(__dirname, 'mock-supabase.js'), 'utf8');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.css': 'text/css',
};

/** Sert le dossier de l'app en HTTP local. */
export function startServer(port = 8787) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file = path.join(APP_DIR, urlPath === '/' ? 'index-cloud-test.html' : urlPath);
      if (!file.startsWith(APP_DIR)) { res.writeHead(403); res.end(); return; }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(buf);
      });
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

/**
 * Prépare une page de test :
 * - remplace le SDK Supabase du CDN par le mock (base en mémoire)
 * - neutralise xlsx et la météo (réseau coupé)
 * - fige l'horloge au TEST_NOW_MS (mercredi 10h00)
 * - accepte automatiquement les confirm(), enregistre les alert()
 * - injecte le jeu de données fixtures
 */
export async function preparePage(context, { db = makeDB(), nowMs = TEST_NOW_MS, acceptDialogs = true } = {}) {
  const page = await context.newPage();

  await page.route('**/cdn.jsdelivr.net/npm/@supabase/supabase-js**', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: MOCK_SUPA })
  );
  await page.route('**/cdn.jsdelivr.net/npm/xlsx**', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: 'window.XLSX = { utils: {}, read: function(){ return { SheetNames: [], Sheets: {} }; } };' })
  );
  await page.route('**/api.open-meteo.com/**', (route) => route.abort());
  // Toute autre requête sortante (dont la vraie base Supabase) est bloquée :
  const externalRequests = [];
  await page.route(/https?:\/\/(?!127\.0\.0\.1|localhost).*/, (route) => {
    const url = route.request().url();
    if (url.includes('cdn.jsdelivr.net') || url.includes('open-meteo')) return route.fallback();
    externalRequests.push(url);
    return route.abort();
  });
  page.__externalRequests = externalRequests;

  // Horloge figée (l'app dépend beaucoup de "aujourd'hui")
  await page.clock.install({ time: nowMs });

  // Injecter les fixtures AVANT le script de l'app
  await page.addInitScript((data) => { window.__mockDB = data; }, db);

  // Dialogues : accepter les confirm(), garder trace des alert()
  const alerts = [];
  page.on('dialog', async (d) => {
    if (d.type() === 'alert') alerts.push(d.message());
    if (acceptDialogs) await d.accept();
    else await d.dismiss();
  });
  page.__alerts = alerts;

  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.__pageErrors = errors;

  return page;
}

/** Ouvre l'app et attend que le splash soit prêt. */
export async function gotoApp(page, port = 8787) {
  await page.goto(`http://127.0.0.1:${port}/index-cloud-test.html`);
  await page.waitForSelector('#splash', { state: 'visible' });
  // laisser le loadProducts() initial se résoudre
  // NB : les globales de l'app sont déclarées avec `let` → accessibles par identifiant, pas via window.*
  await page.waitForFunction(() => typeof products !== 'undefined' && Array.isArray(products) && products.length > 0);
}

/** Entre dans une boutique et attend que la navigation soit rendue. */
export async function enterBoutique(page, boutique) {
  await page.evaluate((b) => window.enterBoutique(b), boutique);
  await page.waitForSelector('#app', { state: 'visible' });
  await page.waitForFunction(() => document.querySelectorAll('#bottom-nav .bnav-item').length > 0);
}

/* ---------- mini-framework d'assertions ---------- */
export function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion échouée');
}
export function assertEq(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg || 'valeurs différentes'}\n  attendu : ${e}\n  obtenu  : ${a}`);
}
