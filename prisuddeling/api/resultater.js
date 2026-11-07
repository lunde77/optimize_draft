// GET /api/resultater   (kræver resultatnøglen i headeren "x-noegle"
//                         eller i ?noegle=...)
//   -> { antalStemmer, ugyldige, opdateret, kategorier: [{ id, navn, stemmer: { k01: 3, ... } }] }
//
// Kun til test og vedligehold (også med nøglen):
//   ?test=1            tæl teststemmer i stedet for rigtige stemmer
//   ?test=1&ryd=1      slet alle teststemmer (rører aldrig rigtige stemmer)
//   ?selvtest=1        gem, tæl og slet en teststemme direkte i lageret

import {
  STEM_PREFIX,
  TEST_PREFIX,
  forespoergsel,
  gemStemme,
  hentStier,
  optael,
  sletStier,
  svar,
  tjekNoegle,
} from './_faelles.js';

export default async function handler(req, res) {
  const q = forespoergsel(req);
  const noegle = req.headers['x-noegle'] ?? q.noegle;
  if (!tjekNoegle(typeof noegle === 'string' ? noegle : '')) {
    return svar(res, 401, { fejl: 'noegle', besked: 'Forkert eller manglende resultatnøgle.' });
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return svar(res, 405, { fejl: 'metode', besked: 'Kun GET er tilladt.' });
  }

  try {
    if (q.selvtest === '1') return svar(res, 200, await selvtest());

    const test = q.test === '1';
    if (test && q.ryd === '1') {
      const slettet = await sletStier(await hentStier(TEST_PREFIX));
      return svar(res, 200, { ok: true, slettet });
    }

    const stier = await hentStier(test ? TEST_PREFIX : STEM_PREFIX);
    return svar(res, 200, { test, ...optael(stier) });
  } catch (fejl) {
    console.error('Kunne ikke hente resultater:', fejl?.name || 'ukendt fejl');
    return svar(res, 503, {
      fejl: 'lager',
      besked: 'Resultaterne kunne ikke hentes lige nu. Prøv igen om lidt.',
    });
  }
}

async function selvtest() {
  const valg = { spiller: 'k01', fighter: 'k02', udvikler: 'k03', bidragsyder: 'k04' };
  const foer = (await hentStier(TEST_PREFIX)).length;
  const sti = await gemStemme(TEST_PREFIX, valg);
  const efter = await hentStier(TEST_PREFIX);
  const fundet = efter.includes(sti);
  const optalt = optael(efter.filter((s) => s === sti));
  await sletStier([sti]);
  const tilbage = (await hentStier(TEST_PREFIX)).length;
  const ok =
    fundet &&
    optalt.antalStemmer === 1 &&
    optalt.kategorier.every((k) => k.stemmer[valg[k.id]] === 1) &&
    tilbage === foer;
  return { ok, fundet, optalt: optalt.antalStemmer, foer, tilbage };
}
