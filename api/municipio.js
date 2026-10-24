// GET /api/municipio?mun=38822&t=2 → apuração do município, colégio por colégio e seção por seção.
import fs from 'node:fs';
import path from 'node:path';
import { emLotes, presidente, turnoDe, votosDaSecao } from '../lib/tse.js';

/** Municípios acompanhados (código do TSE → nome). */
export const MUNICIPIOS = { '38822': 'São Félix do Coribe', '38636': 'Santa Maria da Vitória' };

let locais = null;
const carregarLocais = () => (locais ??= JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'locais.json'), 'utf8')));

export default async function handler(req, res) {
  const turno = turnoDe(req.query.t);
  const mun = String(req.query.mun ?? '');
  if (!MUNICIPIOS[mun]) return res.status(400).json({ erro: 'Município não acompanhado.' });

  const secoes = Object.entries(carregarLocais()[`${turno}:${mun}`] ?? {}).map(([s, info]) => ({ secao: Number(s), ...info }));
  const principais = secoes.filter((s) => !(s.principal > 0));
  const votos = new Map();
  const [cidade] = await Promise.all([
    presidente(turno, 'ba', mun),
    emLotes(principais, 12, async (s) => votos.set(s.secao, await votosDaSecao(turno, 'ba', mun, s.zona, s.secao))),
  ]);

  const porLocal = new Map();
  for (const s of secoes.sort((a, b) => a.secao - b.secao)) {
    if (!porLocal.has(s.local)) porLocal.set(s.local, { local: s.local, zona: s.zona, nome: s.nome, endereco: s.endereco, secoes: [] });
    const agregadaA = s.principal > 0 ? s.principal : null;
    porLocal.get(s.local).secoes.push({ secao: s.secao, aptos: s.aptos, agregadaA, resultado: agregadaA ? null : (votos.get(s.secao) ?? null) });
  }
  const colegios = [...porLocal.values()].sort((a, b) => a.zona - b.zona || a.local - b.local);
  const apuradas = [...votos.values()].filter(Boolean).length;

  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=180');
  res.status(200).json({ turno, mun, nome: MUNICIPIOS[mun], cidade, urnas: { total: principais.length, apuradas }, colegios });
}
