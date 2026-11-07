# Prisuddeling – anonym afstemning

Én samlet stemmeside med fire kategorier (Årets spiller, Årets fighter, Årets udvikler og Årets bidragsyder) og 22 kandidater i hver.

- **Stemmeside:** `https://prisuddeling-afstemning.vercel.app/`
- **Resultatside:** `https://prisuddeling-afstemning.vercel.app/resultater?noegle=<resultatnøgle>` (eller `/resultater#<resultatnøgle>`)

Resultatnøglen ligger som miljøvariablen `RESULTAT_NOEGLE` i Vercel-projektet *prisuddeling-afstemning* (Settings → Environment Variables).

## Sådan virker det

| Del | Teknologi |
| --- | --- |
| Sider (`public/`) | Statisk HTML, CSS og JavaScript uden byggetrin |
| API (`api/`) | Vercel Functions (Node.js) |
| Lager | Vercel Blob (privat store `prisuddeling-stemmer`) |
| Hosting | Vercel, gratis Hobby-plan |

- `POST /api/stem` gemmer en stemme. Der kræves præcis ét gyldigt valg i hver kategori.
- `GET /api/stem` fortæller siden, om afstemningen er åben, og om browseren allerede har stemt.
- `GET /api/resultater` (kræver nøglen i headeren `x-noegle`) tæller stemmerne op.

Hver stemme gemmes som en tom fil, hvor filnavnet kun indeholder de fire kandidat-id'er og et tilfældigt id, fx `stemmer/k22-k05-k08-k18_<uuid>.txt`.

## Anonymitet og begrænsninger

- Der gemmes **ikke** navn, e-mail, IP-adresse, browseroplysninger eller cookie-værdier sammen med stemmerne.
- Resultatsiden viser kun antal og procent pr. kandidat.
- Beskyttelsen mod dobbeltstemmer er en cookie plus en markering i browserens `localStorage`. Den stopper almindelige gentagne stemmer, men kan omgås med en anden browser, en anden enhed eller et privat vindue. Den kræver ingen login og kobler ikke stemmen til en person.
- Vercel registrerer som alle hostingudbydere tekniske data (tidspunkt, IP-adresse) i sine egne logs, og lageret har et upload-tidspunkt for hver fil. Den, der har adgang til Vercel-kontoen, kan i teorien sammenholde tidspunkter. Appen selv logger intet om den, der stemmer.

## Luk afstemningen

Sæt miljøvariablen `AFSTEMNING_LUKKET=1` i Vercel-projektet og deploy igen. Så afvises nye stemmer, og stemmesiden viser "Afstemningen er lukket".

## Test lokalt

```bash
cd prisuddeling
npm install
npm test            # API-tests med et lager i hukommelsen
npm run dev         # http://localhost:8787  (resultater: /resultater#lokal-test-noegle)
```

## Test i produktion uden at påvirke resultatet

Med resultatnøglen kan man sende teststemmer, der gemmes under `test/` og aldrig tælles med:

- `POST /api/stem` med headeren `x-test-noegle: <nøgle>`
- `GET /api/resultater?test=1` viser teststemmerne, `?test=1&ryd=1` sletter dem
- `GET /api/resultater?selvtest=1` gemmer, tæller og sletter én teststemme direkte i lageret
