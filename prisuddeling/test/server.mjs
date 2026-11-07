// Lokal udviklingsserver, der efterligner Vercel: statiske filer fra public/
// (med "clean URLs") og funktionerne i api/. Stemmer holdes i hukommelsen.
//   PRIS_LAGER=hukommelse RESULTAT_NOEGLE=hemmelig node test/server.mjs

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.PRIS_LAGER ??= 'hukommelse';
process.env.RESULTAT_NOEGLE ??= 'lokal-test-noegle';

const rod = fileURLToPath(new URL('..', import.meta.url));
const offentlig = join(rod, 'public');
const typer = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};

const funktioner = {
  '/api/stem': () => import('../api/stem.js'),
  '/api/resultater': () => import('../api/resultater.js'),
};

async function laesRaaBody(req) {
  const dele = [];
  for await (const d of req) dele.push(d);
  return Buffer.concat(dele).toString('utf8');
}

export function lavServer() {
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://lokal');
    try {
      if (funktioner[url.pathname]) {
        const raa = await laesRaaBody(req);
        req.query = Object.fromEntries(url.searchParams);
        const erJson = String(req.headers['content-type'] || '').startsWith('application/json');
        Object.defineProperty(req, 'body', {
          get() {
            if (!raa) return undefined;
            if (!erJson) return raa;
            return JSON.parse(raa); // kaster ved ugyldig JSON – ligesom Vercel
          },
        });
        const { default: handler } = await funktioner[url.pathname]();
        return await handler(req, res);
      }
      let sti = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
      if (sti.endsWith('/')) sti += 'index.html';
      let fil = join(offentlig, sti);
      if (!fil.startsWith(offentlig)) throw Object.assign(new Error('forbudt'), { code: 'ENOENT' });
      const info = await stat(fil).catch(() => null);
      if (!info && !extname(fil)) fil += '.html';
      const indhold = await readFile(fil);
      res.writeHead(200, { 'Content-Type': typer[extname(fil)] || 'application/octet-stream' });
      res.end(indhold);
    } catch (e) {
      if (e.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Ikke fundet');
      }
      console.error(e);
      res.writeHead(500);
      res.end('Serverfejl');
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || 8787);
  lavServer().listen(port, () => console.log(`Kører på http://localhost:${port}`));
}
