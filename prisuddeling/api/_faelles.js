// Fælles hjælpefunktioner for API'et. Filer der starter med "_" bliver ikke
// til selvstændige endpoints på Vercel.
//
// ANONYMITET: En stemme gemmes som en tom fil i Vercel Blob, hvor filnavnet
// kun indeholder de fire valgte kandidat-id'er og et tilfældigt id, fx
//   stemmer/k03-k17-k22-k01_2f1c....txt
// Der gemmes ingen IP-adresse, ingen cookie-værdi, intet navn og intet
// tidsstempel fra appen selv.

import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { del, list, put } from '@vercel/blob';
import { KANDIDATER, KATEGORIER } from '../public/kandidater.js';

export const STEM_PREFIX = 'stemmer/';
export const TEST_PREFIX = 'test/';
export const COOKIE_NAVN = 'prisuddeling_stemt';

const KANDIDAT_IDER = new Set(KANDIDATER.map((k) => k.id));
const STI_MOENSTER = /^(?:stemmer|test)\/(k\d{2}(?:-k\d{2}){3})_[0-9a-f-]{36}\.txt$/;

// Kun til lokale tests: PRIS_LAGER=hukommelse holder stemmerne i RAM.
const hukommelse = process.env.PRIS_LAGER === 'hukommelse' ? new Set() : null;

export function svar(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

/** Tjekker at der er præcis ét gyldigt valg i hver af de fire kategorier. */
export function validerValg(valg) {
  if (!valg || typeof valg !== 'object' || Array.isArray(valg)) {
    return { ok: false, besked: 'Stemmesedlen mangler.' };
  }
  const noegler = Object.keys(valg);
  const ukendte = noegler.filter((n) => !KATEGORIER.some((k) => k.id === n));
  if (ukendte.length) return { ok: false, besked: 'Stemmesedlen indeholder en ukendt kategori.' };
  const renset = {};
  for (const kategori of KATEGORIER) {
    const id = valg[kategori.id];
    if (typeof id !== 'string' || !id) {
      return { ok: false, besked: `Vælg en kandidat i kategorien "${kategori.navn}".` };
    }
    if (!KANDIDAT_IDER.has(id)) {
      return { ok: false, besked: `Ukendt kandidat i kategorien "${kategori.navn}".` };
    }
    renset[kategori.id] = id;
  }
  return { ok: true, valg: renset };
}

export async function gemStemme(prefix, valg) {
  const sti = `${prefix}${KATEGORIER.map((k) => valg[k.id]).join('-')}_${randomUUID()}.txt`;
  if (hukommelse) {
    hukommelse.add(sti);
    return sti;
  }
  await put(sti, '1', {
    access: 'private',
    addRandomSuffix: false,
    contentType: 'text/plain',
  });
  return sti;
}

export async function hentStier(prefix) {
  if (hukommelse) return [...hukommelse].filter((s) => s.startsWith(prefix));
  const stier = [];
  let cursor;
  do {
    const side = await list({ prefix, cursor, limit: 1000 });
    for (const blob of side.blobs) stier.push(blob.pathname);
    cursor = side.hasMore ? side.cursor : undefined;
  } while (cursor);
  return stier;
}

export async function sletStier(stier) {
  if (!stier.length) return 0;
  if (hukommelse) {
    for (const s of stier) hukommelse.delete(s);
    return stier.length;
  }
  for (let i = 0; i < stier.length; i += 500) {
    await del(stier.slice(i, i + 500));
  }
  return stier.length;
}

/** Tæller stemmerne op ud fra filnavnene. */
export function optael(stier) {
  const kategorier = KATEGORIER.map((k) => ({
    id: k.id,
    navn: k.navn,
    stemmer: Object.fromEntries(KANDIDATER.map((c) => [c.id, 0])),
  }));
  let antalStemmer = 0;
  let ugyldige = 0;
  for (const sti of stier) {
    const match = STI_MOENSTER.exec(sti);
    const ider = match ? match[1].split('-') : null;
    if (!ider || !ider.every((id) => KANDIDAT_IDER.has(id))) {
      ugyldige += 1;
      continue;
    }
    antalStemmer += 1;
    ider.forEach((id, i) => {
      kategorier[i].stemmer[id] += 1;
    });
  }
  return { antalStemmer, ugyldige, opdateret: new Date().toISOString(), kategorier };
}

function hash(vaerdi) {
  return createHash('sha256').update(String(vaerdi)).digest();
}

/** Sammenligner resultatnøglen i konstant tid. */
export function tjekNoegle(givet) {
  const rigtig = process.env.RESULTAT_NOEGLE;
  if (!rigtig || typeof givet !== 'string' || !givet) return false;
  return timingSafeEqual(hash(givet), hash(rigtig));
}

export function laesCookie(req, navn) {
  const header = req.headers?.cookie || '';
  for (const stykke of header.split(';')) {
    const [n, ...rest] = stykke.trim().split('=');
    if (n === navn) return rest.join('=');
  }
  return null;
}

/** Læser JSON-body robust (Vercel parser selv JSON, men kan kaste ved fejl). */
export async function laesBody(req) {
  let body;
  try {
    body = req.body;
  } catch {
    return null;
  }
  if (body === undefined) {
    const dele = [];
    for await (const stykke of req) dele.push(stykke);
    body = Buffer.concat(dele).toString('utf8');
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') {
    if (body.length > 2000) return null;
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  return body && typeof body === 'object' ? body : null;
}

export function forespoergsel(req) {
  if (req.query && typeof req.query === 'object') return req.query;
  const url = new URL(req.url || '/', 'http://lokal');
  return Object.fromEntries(url.searchParams);
}
