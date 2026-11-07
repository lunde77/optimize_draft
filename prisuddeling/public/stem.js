import { KANDIDATER, KATEGORIER } from './kandidater.js';

const LAGER_NOEGLE = 'prisuddeling-har-stemt';
const sortering = new Intl.Collator('da', { sensitivity: 'base' });
const kandidater = [...KANDIDATER].sort((a, b) => sortering.compare(a.navn, b.navn));
const navnFor = Object.fromEntries(KANDIDATER.map((k) => [k.id, k.navn]));

const $ = (id) => document.getElementById(id);
const formular = $('stemmeseddel');
const kategorierEl = $('kategorier');
const prikker = $('prikker');
const fremskridt = $('fremskridt');
const afgiv = $('afgiv');
const dialog = $('bekraeft');
const sendKnap = $('send');
const sendFejl = $('send-fejl');

let sender = false;

function initialer(navn) {
  const dele = navn.split(/\s+/).filter(Boolean);
  const foerste = dele[0]?.[0] ?? '';
  const sidste = dele.length > 1 ? dele[dele.length - 1][0] : '';
  return (foerste + sidste).toUpperCase();
}

function lavElement(tag, klasse, tekst) {
  const el = document.createElement(tag);
  if (klasse) el.className = klasse;
  if (tekst !== undefined) el.textContent = tekst;
  return el;
}

function byggSeddel() {
  KATEGORIER.forEach((kategori, i) => {
    const sektion = lavElement('section', 'kategori');
    sektion.id = `kategori-${kategori.id}`;
    sektion.dataset.kategori = kategori.id;

    const hoved = lavElement('div', 'kategori__hoved');
    const nr = lavElement('span', 'kategori__nr', String(i + 1));
    nr.setAttribute('aria-hidden', 'true');
    const titel = lavElement('div', 'kategori__titel');
    const h2 = lavElement('h2', '', kategori.navn);
    h2.id = `titel-${kategori.id}`;
    const status = lavElement('p', 'kategori__status', 'Vælg én kandidat');
    status.id = `status-${kategori.id}`;
    titel.append(h2, status);
    hoved.append(nr, titel);

    const feltsaet = document.createElement('fieldset');
    feltsaet.setAttribute('aria-labelledby', h2.id);
    feltsaet.setAttribute('aria-describedby', status.id);
    const gitter = lavElement('div', 'valg-gitter');
    for (const kandidat of kandidater) {
      const label = lavElement('label', 'valg');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = kategori.id;
      input.value = kandidat.id;
      input.id = `${kategori.id}-${kandidat.id}`;
      const maerke = lavElement('span', 'valg__maerke', initialer(kandidat.navn));
      maerke.setAttribute('aria-hidden', 'true');
      label.append(input, maerke, lavElement('span', 'valg__navn', kandidat.navn));
      gitter.append(label);
    }
    feltsaet.append(gitter);
    sektion.append(hoved, feltsaet);
    kategorierEl.append(sektion);

    prikker.append(document.createElement('li'));
  });
}

function hentValg() {
  const data = new FormData(formular);
  const valg = {};
  for (const kategori of KATEGORIER) {
    const vaerdi = data.get(kategori.id);
    if (vaerdi) valg[kategori.id] = String(vaerdi);
  }
  return valg;
}

function opdater() {
  const valg = hentValg();
  let antal = 0;
  KATEGORIER.forEach((kategori, i) => {
    const sektion = $(`kategori-${kategori.id}`);
    const status = $(`status-${kategori.id}`);
    const valgt = valg[kategori.id];
    sektion.classList.toggle('kategori--udfyldt', Boolean(valgt));
    if (valgt) sektion.classList.remove('kategori--mangler');
    status.textContent = valgt ? `Valgt: ${navnFor[valgt]}` : 'Vælg én kandidat';
    prikker.children[i].classList.toggle('fyldt', Boolean(valgt));
    if (valgt) antal += 1;
    for (const label of sektion.querySelectorAll('.valg')) {
      label.classList.toggle('valgt', label.querySelector('input').checked);
    }
  });
  fremskridt.innerHTML = '';
  fremskridt.append(lavElement('strong', '', `${antal} af ${KATEGORIER.length}`), ' kategorier valgt');
  afgiv.classList.toggle('knap--ufaerdig', antal < KATEGORIER.length);
  return antal;
}

function udfyldOpsummering(dl, valg) {
  dl.replaceChildren();
  for (const kategori of KATEGORIER) {
    const raekke = document.createElement('div');
    raekke.append(lavElement('dt', '', kategori.navn), lavElement('dd', '', navnFor[valg[kategori.id]] ?? '–'));
    dl.append(raekke);
  }
}

function visPanel(id) {
  for (const panel of ['lukket', 'allerede', 'tak']) $(panel).hidden = panel !== id;
  formular.hidden = true;
}

function huskStemt() {
  try {
    localStorage.setItem(LAGER_NOEGLE, '1');
  } catch {
    /* privat vindue e.l. – cookien fra serveren gælder stadig */
  }
}

function harStemtLokalt() {
  try {
    return localStorage.getItem(LAGER_NOEGLE) === '1';
  } catch {
    return false;
  }
}

formular.addEventListener('change', opdater);

formular.addEventListener('submit', (haendelse) => {
  haendelse.preventDefault();
  const valg = hentValg();
  const mangler = KATEGORIER.filter((k) => !valg[k.id]);
  if (mangler.length) {
    for (const k of mangler) {
      $(`kategori-${k.id}`).classList.add('kategori--mangler');
      $(`status-${k.id}`).textContent = 'Mangler: vælg én kandidat';
    }
    const foerste = $(`kategori-${mangler[0].id}`);
    foerste.scrollIntoView({ behavior: 'smooth', block: 'start' });
    foerste.querySelector('input')?.focus({ preventScroll: true });
    return;
  }
  udfyldOpsummering($('bekraeft-opsummering'), valg);
  sendFejl.hidden = true;
  dialog.showModal();
});

$('ret').addEventListener('click', () => dialog.close());

sendKnap.addEventListener('click', async () => {
  if (sender) return;
  const valg = hentValg();
  sender = true;
  sendKnap.disabled = true;
  sendKnap.textContent = 'Sender …';
  sendFejl.hidden = true;
  try {
    const svar = await fetch('/api/stem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ valg }),
    });
    const data = await svar.json().catch(() => ({}));
    if (svar.ok) {
      huskStemt();
      dialog.close();
      udfyldOpsummering($('tak-opsummering'), valg);
      visPanel('tak');
      window.scrollTo({ top: 0 });
      $('tak').focus({ preventScroll: true });
      return;
    }
    if (svar.status === 409) {
      huskStemt();
      dialog.close();
      visPanel('allerede');
      return;
    }
    if (svar.status === 403) {
      dialog.close();
      visPanel('lukket');
      return;
    }
    sendFejl.textContent = data.besked || 'Stemmen blev ikke sendt. Prøv igen om lidt.';
    sendFejl.hidden = false;
  } catch {
    sendFejl.textContent = 'Stemmen blev ikke sendt. Tjek din internetforbindelse, og prøv igen.';
    sendFejl.hidden = false;
  } finally {
    sender = false;
    sendKnap.disabled = false;
    sendKnap.textContent = 'Send stemme';
  }
});

async function tjekStatus() {
  if (harStemtLokalt()) {
    visPanel('allerede');
    return;
  }
  try {
    const svar = await fetch('/api/stem', { credentials: 'same-origin', cache: 'no-store' });
    if (!svar.ok) return;
    const status = await svar.json();
    if (status.harStemt) {
      huskStemt();
      visPanel('allerede');
    } else if (status.aaben === false) {
      visPanel('lukket');
    }
  } catch {
    /* Ingen forbindelse lige nu – vis stemmesedlen alligevel. */
  }
}

byggSeddel();
opdater();
tjekStatus();
