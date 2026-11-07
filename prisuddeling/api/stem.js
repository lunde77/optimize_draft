// GET  /api/stem  -> { aaben, harStemt }  (status for denne enhed)
// POST /api/stem  -> afgiv stemme: { valg: { spiller, fighter, udvikler, bidragsyder } }
//
// Beskyttelse mod dobbeltstemmer: efter en stemme sætter serveren en cookie
// ("prisuddeling_stemt=1"). Cookien indeholder ingen id og gemmes ikke
// sammen med stemmen. Siden husker det også i browserens localStorage.

import {
  COOKIE_NAVN,
  STEM_PREFIX,
  TEST_PREFIX,
  gemStemme,
  laesBody,
  laesCookie,
  svar,
  tjekNoegle,
  validerValg,
} from './_faelles.js';

const ET_HALVT_AAR = 60 * 60 * 24 * 182;

export default async function handler(req, res) {
  const lukket = process.env.AFSTEMNING_LUKKET === '1';
  const harStemt = laesCookie(req, COOKIE_NAVN) === '1';

  if (req.method === 'GET') {
    return svar(res, 200, { aaben: !lukket, harStemt });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return svar(res, 405, { fejl: 'metode', besked: 'Brug POST for at stemme.' });
  }

  // Kræv JSON. Det forhindrer også, at andre hjemmesider kan sende stemmer
  // via en almindelig HTML-formular.
  const indholdstype = String(req.headers['content-type'] || '');
  if (!indholdstype.toLowerCase().startsWith('application/json')) {
    return svar(res, 415, { fejl: 'format', besked: 'Stemmen skal sendes som JSON.' });
  }

  // Testtilstand (kun med resultatnøglen): stemmen gemmes under "test/" og
  // tælles ikke med i det rigtige resultat.
  const testNoegle = req.headers['x-test-noegle'];
  const test = testNoegle !== undefined && tjekNoegle(String(testNoegle));
  if (testNoegle !== undefined && !test) {
    return svar(res, 401, { fejl: 'noegle', besked: 'Forkert testnøgle.' });
  }

  if (lukket && !test) {
    return svar(res, 403, { fejl: 'lukket', besked: 'Afstemningen er lukket.' });
  }
  if (harStemt && !test) {
    return svar(res, 409, {
      fejl: 'allerede',
      besked: 'Der er allerede afgivet en stemme fra denne browser.',
    });
  }

  const body = await laesBody(req);
  const resultat = validerValg(body?.valg);
  if (!resultat.ok) {
    return svar(res, 400, { fejl: 'ugyldig', besked: resultat.besked });
  }

  try {
    await gemStemme(test ? TEST_PREFIX : STEM_PREFIX, resultat.valg);
  } catch (fejl) {
    // Log kun fejltypen – aldrig noget om den, der stemte.
    console.error('Kunne ikke gemme stemme:', fejl?.name || 'ukendt fejl');
    return svar(res, 503, {
      fejl: 'lager',
      besked: 'Stemmen kunne ikke gemmes lige nu. Prøv igen om lidt.',
    });
  }

  if (!test) {
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAVN}=1; Max-Age=${ET_HALVT_AAR}; Path=/; HttpOnly; Secure; SameSite=Lax`,
    );
  }
  return svar(res, 201, { ok: true, test });
}
