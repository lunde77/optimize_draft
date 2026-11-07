// Kør med: npm test   (bruger et lager i hukommelsen – rører ikke Vercel)
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

process.env.PRIS_LAGER = 'hukommelse';
process.env.RESULTAT_NOEGLE = 'test-noegle-123';

const { lavServer } = await import('./server.mjs');
const { KANDIDATER, KATEGORIER } = await import('../public/kandidater.js');

let server;
let base;

before(async () => {
  server = lavServer();
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const gyldigt = { spiller: 'k01', fighter: 'k05', udvikler: 'k22', bidragsyder: 'k10' };

function stem(valg, { cookie, headers = {} } = {}) {
  return fetch(`${base}/api/stem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}), ...headers },
    body: JSON.stringify({ valg }),
  });
}

async function resultater(query = '') {
  const svar = await fetch(`${base}/api/resultater${query}`, { headers: { 'x-noegle': 'test-noegle-123' } });
  assert.equal(svar.status, 200);
  return svar.json();
}

test('kandidatlisten har 22 unikke navne og 4 kategorier', () => {
  assert.equal(KANDIDATER.length, 22);
  assert.equal(new Set(KANDIDATER.map((k) => k.id)).size, 22);
  assert.equal(new Set(KANDIDATER.map((k) => k.navn)).size, 22);
  assert.deepEqual(
    KATEGORIER.map((k) => k.navn),
    ['Årets spiller', 'Årets fighter', 'Årets udvikler', 'Årets bidragsyder'],
  );
});

test('status før man har stemt', async () => {
  const svar = await fetch(`${base}/api/stem`);
  assert.equal(svar.status, 200);
  assert.deepEqual(await svar.json(), { aaben: true, harStemt: false });
});

test('ufuldstændige og ugyldige stemmesedler afvises', async () => {
  const mangler = await stem({ spiller: 'k01', fighter: 'k02', udvikler: 'k03' });
  assert.equal(mangler.status, 400);
  assert.match((await mangler.json()).besked, /Årets bidragsyder/);

  const ukendt = await stem({ ...gyldigt, fighter: 'k99' });
  assert.equal(ukendt.status, 400);

  const ekstra = await stem({ ...gyldigt, hacker: 'k01' });
  assert.equal(ekstra.status, 400);

  const liste = await stem(['k01']);
  assert.equal(liste.status, 400);

  const ikkeJson = await fetch(`${base}/api/stem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'spiller=k01',
  });
  assert.equal(ikkeJson.status, 415);

  const daarligJson = await fetch(`${base}/api/stem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"valg":',
  });
  assert.equal(daarligJson.status, 400);

  assert.equal((await resultater()).antalStemmer, 0);
});

test('en gyldig stemme gemmes, sætter cookie og tælles i alle fire kategorier', async () => {
  const svar = await stem(gyldigt);
  assert.equal(svar.status, 201);
  const cookie = svar.headers.get('set-cookie');
  assert.match(cookie, /^prisuddeling_stemt=1;/);
  assert.match(cookie, /HttpOnly/);

  const r = await resultater();
  assert.equal(r.antalStemmer, 1);
  for (const k of r.kategorier) {
    const total = Object.values(k.stemmer).reduce((a, b) => a + b, 0);
    assert.equal(total, 1, k.id);
    assert.equal(k.stemmer[gyldigt[k.id]], 1, k.id);
  }
});

test('anden stemme fra samme browser (cookie) afvises', async () => {
  const svar = await stem(gyldigt, { cookie: 'prisuddeling_stemt=1' });
  assert.equal(svar.status, 409);
  const status = await fetch(`${base}/api/stem`, { headers: { cookie: 'prisuddeling_stemt=1' } });
  assert.equal((await status.json()).harStemt, true);
  assert.equal((await resultater()).antalStemmer, 1);
});

test('flere deltagere – optælling og fordeling er korrekt', async () => {
  await stem({ spiller: 'k01', fighter: 'k05', udvikler: 'k03', bidragsyder: 'k10' });
  await stem({ spiller: 'k02', fighter: 'k05', udvikler: 'k22', bidragsyder: 'k11' });
  const r = await resultater();
  assert.equal(r.antalStemmer, 3);
  const [spiller, fighter, udvikler, bidragsyder] = r.kategorier;
  assert.equal(spiller.stemmer.k01, 2);
  assert.equal(spiller.stemmer.k02, 1);
  assert.equal(fighter.stemmer.k05, 3);
  assert.equal(udvikler.stemmer.k22, 2);
  assert.equal(udvikler.stemmer.k03, 1);
  assert.equal(bidragsyder.stemmer.k10, 2);
  assert.equal(bidragsyder.stemmer.k11, 1);
});

test('resultater kræver den rigtige nøgle', async () => {
  assert.equal((await fetch(`${base}/api/resultater`)).status, 401);
  assert.equal((await fetch(`${base}/api/resultater`, { headers: { 'x-noegle': 'forkert' } })).status, 401);
  assert.equal((await fetch(`${base}/api/resultater?noegle=test-noegle-123`)).status, 200);
});

test('resultatet indeholder ingen identificerende data', async () => {
  const r = await resultater();
  const tekst = JSON.stringify(r);
  assert.doesNotMatch(tekst, /ip|cookie|user-agent|email/i);
  assert.deepEqual(Object.keys(r).sort(), ['antalStemmer', 'kategorier', 'opdateret', 'test', 'ugyldige']);
});

test('teststemmer holdes adskilt og kan ryddes uden at røre rigtige stemmer', async () => {
  const forkert = await stem(gyldigt, { headers: { 'x-test-noegle': 'forkert' } });
  assert.equal(forkert.status, 401);

  const svar = await stem(gyldigt, { headers: { 'x-test-noegle': 'test-noegle-123' } });
  assert.equal(svar.status, 201);
  assert.equal(svar.headers.get('set-cookie'), null);
  assert.equal((await resultater('?test=1')).antalStemmer, 1);
  assert.equal((await resultater()).antalStemmer, 3);

  const ryd = await resultater('?test=1&ryd=1');
  assert.equal(ryd.slettet, 1);
  assert.equal((await resultater('?test=1')).antalStemmer, 0);
  assert.equal((await resultater()).antalStemmer, 3);
});

test('selvtest i lageret lykkes', async () => {
  const r = await resultater('?selvtest=1');
  assert.equal(r.ok, true);
  assert.equal((await resultater()).antalStemmer, 3);
});

test('lukket afstemning afviser nye stemmer', async () => {
  process.env.AFSTEMNING_LUKKET = '1';
  try {
    const svar = await stem(gyldigt);
    assert.equal(svar.status, 403);
    assert.equal((await (await fetch(`${base}/api/stem`)).json()).aaben, false);
  } finally {
    delete process.env.AFSTEMNING_LUKKET;
  }
});
