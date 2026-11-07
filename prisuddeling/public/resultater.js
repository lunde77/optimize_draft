import { KANDIDATER, KATEGORIER } from './kandidater.js';

const OPDATERINGS_INTERVAL = 15000;
const $ = (id) => document.getElementById(id);
const navnFor = Object.fromEntries(KANDIDATER.map((k) => [k.id, k.navn]));
const sortering = new Intl.Collator('da', { sensitivity: 'base' });
const procentFormat = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1, minimumFractionDigits: 0 });
const tidFormat = new Intl.DateTimeFormat('da-DK', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

// Nøglen ligger efter # i linket, så den aldrig sendes med i adressen til serveren.
const params = new URLSearchParams(location.search);
const test = params.get('test') === '1';
let noegle = laesHash() || flytNoegleFraAdresse();
let seneste = null;
let timer = null;
const afsloeret = new Set();

function laesHash() {
  try {
    return decodeURIComponent(location.hash.slice(1)).trim();
  } catch {
    return location.hash.slice(1).trim();
  }
}

// Nogle apps fjerner delen efter # i links. Derfor virker ?noegle=... også;
// nøglen flyttes straks tilbage efter #, så den ikke bliver stående i adressen.
function flytNoegleFraAdresse() {
  const fraAdresse = (params.get('noegle') || '').trim();
  if (!fraAdresse) return '';
  params.delete('noegle');
  const rest = params.toString();
  history.replaceState(null, '', `${location.pathname}${rest ? `?${rest}` : ''}#${encodeURIComponent(fraAdresse)}`);
  return fraAdresse;
}

function lavElement(tag, klasse, tekst) {
  const el = document.createElement(tag);
  if (klasse) el.className = klasse;
  if (tekst !== undefined) el.textContent = tekst;
  return el;
}

function laesSkjul() {
  try {
    return sessionStorage.getItem('prisuddeling-skjul') === '1';
  } catch {
    return false;
  }
}

function gemSkjul(vaerdi) {
  try {
    sessionStorage.setItem('prisuddeling-skjul', vaerdi ? '1' : '0');
  } catch {
    /* ikke vigtigt */
  }
}

function visNoegleForm(besked) {
  $('resultat-sektion').hidden = true;
  $('noegle-sektion').hidden = false;
  if (besked) $('noegle-hjaelp').textContent = besked;
  $('noegle-felt').focus();
}

/** Placering med delte pladser ved stemmelighed (1, 2, 2, 4 …). */
function rangeret(stemmer) {
  const liste = Object.entries(stemmer)
    .map(([id, antal]) => ({ id, navn: navnFor[id] ?? id, antal }))
    .sort((a, b) => b.antal - a.antal || sortering.compare(a.navn, b.navn));
  let plads = 0;
  let forrige = null;
  liste.forEach((r, i) => {
    if (r.antal !== forrige) {
      plads = i + 1;
      forrige = r.antal;
    }
    r.plads = plads;
  });
  return liste;
}

function procent(antal, total) {
  return total > 0 ? (antal / total) * 100 : 0;
}

function tegnKategori(kategori, total, skjul) {
  const kort = lavElement('section', 'resultat-kort');
  kort.append(lavElement('h2', '', kategori.navn));

  if (skjul && !afsloeret.has(kategori.id)) {
    const boks = lavElement('div', 'skjult-resultat');
    boks.append(lavElement('p', '', 'Resultatet er skjult.'));
    const knap = lavElement('button', 'knap knap--primaer', `Afslør ${kategori.navn.toLowerCase()}`);
    knap.type = 'button';
    knap.addEventListener('click', () => {
      afsloeret.add(kategori.id);
      tegn();
    });
    boks.append(knap);
    kort.append(boks);
    return kort;
  }

  const liste = rangeret(kategori.stemmer);
  const medStemmer = liste.filter((r) => r.antal > 0);
  const udenStemmer = liste.filter((r) => r.antal === 0);

  if (!medStemmer.length) {
    kort.append(lavElement('p', 'resultat-kort__tom', 'Ingen stemmer endnu.'));
    return kort;
  }

  const vindere = medStemmer.filter((r) => r.plads === 1);
  const vinderBoks = lavElement('div', 'resultat-kort__vinder');
  vinderBoks.append(
    lavElement('span', '', vindere.length > 1 ? 'Delt førsteplads' : 'Vinder'),
    lavElement('strong', '', vindere.map((v) => v.navn).join(' og ')),
  );
  kort.append(vinderBoks);

  const ol = lavElement('ol', 'stolper');
  for (const r of medStemmer) {
    const li = lavElement('li', r.plads === 1 ? 'stolpe stolpe--vinder' : 'stolpe');
    const pct = procent(r.antal, total);
    const tal = lavElement('span', 'stolpe__tal');
    tal.append(
      lavElement('b', '', `${r.antal} ${r.antal === 1 ? 'stemme' : 'stemmer'}`),
      ` · ${procentFormat.format(pct)} %`,
    );
    const bar = lavElement('span', 'stolpe__bar');
    bar.setAttribute('aria-hidden', 'true');
    const fyld = document.createElement('span');
    fyld.style.width = `${pct}%`;
    bar.append(fyld);
    li.append(lavElement('span', 'stolpe__plads', `${r.plads}.`), lavElement('span', 'stolpe__navn', r.navn), tal, bar);
    ol.append(li);
  }
  kort.append(ol);

  if (udenStemmer.length) {
    const detaljer = lavElement('details', 'nuller');
    detaljer.append(
      lavElement('summary', '', `Uden stemmer (${udenStemmer.length})`),
      lavElement('p', '', udenStemmer.map((r) => r.navn).join(', ')),
    );
    kort.append(detaljer);
  }
  return kort;
}

function tegn() {
  if (!seneste) return;
  const skjul = $('skjul').checked;
  const total = seneste.antalStemmer;
  $('antal').textContent = String(total);
  const tid = tidFormat.format(new Date(seneste.opdateret));
  $('opdateret').textContent = `${test ? 'TESTDATA · ' : ''}Opdateret kl. ${tid}`;

  const gitter = $('gitter');
  const aabne = new Set(
    [...gitter.querySelectorAll('details[open]')].map((d) => d.closest('.resultat-kort')?.dataset.kategori),
  );
  gitter.replaceChildren();
  const efterId = Object.fromEntries(seneste.kategorier.map((k) => [k.id, k]));
  for (const k of KATEGORIER) {
    const kategori = efterId[k.id];
    if (!kategori) continue;
    const kort = tegnKategori(kategori, total, skjul);
    kort.dataset.kategori = k.id;
    if (aabne.has(k.id)) kort.querySelector('details')?.setAttribute('open', '');
    gitter.append(kort);
  }
}

async function hent() {
  if (!noegle) return visNoegleForm();
  const fejl = $('hent-fejl');
  try {
    const url = test ? '/api/resultater?test=1' : '/api/resultater';
    const svar = await fetch(url, { headers: { 'x-noegle': noegle }, cache: 'no-store' });
    if (svar.status === 401) {
      stopTimer();
      return visNoegleForm('Nøglen passer ikke. Tjek linket, eller indsæt nøglen igen.');
    }
    const data = await svar.json().catch(() => ({}));
    if (!svar.ok) throw new Error(data.besked || 'Resultaterne kunne ikke hentes.');
    seneste = data;
    fejl.hidden = true;
    $('noegle-sektion').hidden = true;
    $('resultat-sektion').hidden = false;
    tegn();
    startTimer();
  } catch (e) {
    fejl.textContent = `${e.message || 'Resultaterne kunne ikke hentes.'} Siden prøver igen automatisk.`;
    fejl.hidden = false;
    $('resultat-sektion').hidden = false;
    startTimer();
  }
}

function startTimer() {
  if (!timer) timer = setInterval(() => document.visibilityState === 'visible' && hent(), OPDATERINGS_INTERVAL);
}

function stopTimer() {
  clearInterval(timer);
  timer = null;
}

$('noegle-form').addEventListener('submit', (e) => {
  e.preventDefault();
  noegle = $('noegle-felt').value.trim();
  if (!noegle) return;
  history.replaceState(null, '', `${location.pathname}${location.search}#${encodeURIComponent(noegle)}`);
  hent();
});

$('opdater').addEventListener('click', hent);

$('skjul').checked = laesSkjul();
$('skjul').addEventListener('change', (e) => {
  gemSkjul(e.target.checked);
  if (e.target.checked) afsloeret.clear();
  tegn();
});

window.addEventListener('hashchange', () => {
  noegle = laesHash();
  hent();
});

hent();
