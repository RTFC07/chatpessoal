// Acesso aos resultados do TSE (arquivo "unificado" de 2026) e aos boletins de urna.
import { lerBU } from './bu.js';

export const BASE = 'https://resultados.tse.jus.br/oficial/ele2026';

/** Eleição federal e pleito de cada turno de 2026. */
export const TURNOS = {
  1: { eleicao: '6257', pleito: '3220' },
  2: { eleicao: '6258', pleito: '3221' },
};
export const turnoDe = (q) => (String(q) === '1' ? 1 : 2);

export const UFS = ['ac', 'al', 'am', 'ap', 'ba', 'ce', 'df', 'es', 'go', 'ma', 'mg', 'ms', 'mt', 'pa', 'pb', 'pe', 'pi', 'pr', 'rj', 'rn', 'ro', 'rr', 'rs', 'sc', 'se', 'sp', 'to'];

/** Nomes com acento que o TSE grava sem. */
const NOMES = { '22': 'Flávio Bolsonaro', '13': 'Lula', '70': 'Augusto Cury', '55': 'Ronaldo Caiado', '14': 'Renan Santos', '30': 'Romeu Zema' };
const titulo = (s) =>
  s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, sp, l) => sp + l.toUpperCase()).replace(/\b(De|Da|Do|Dos|Das|E)\b/g, (w) => w.toLowerCase());

const num = (v) => {
  const n = Number(String(v ?? '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

export async function baixar(url, binario = false) {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'cache-control': 'no-cache' } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return binario ? Buffer.from(await res.arrayBuffer()) : await res.json();
    } catch (err) {
      if (tentativa === 2) return null;
      await new Promise((r) => setTimeout(r, 800 * (tentativa + 1)));
    }
  }
  return null;
}

/** Resultado de presidente de uma abrangência (br, uf ou município) em formato enxuto. */
export async function presidente(turno, uf, municipio = '') {
  const { eleicao } = TURNOS[turno];
  const j = await baixar(`${BASE}/${eleicao}/dados/${uf}/${uf}${municipio}-c0001-e${eleicao.padStart(6, '0')}-u.json`);
  if (!j) return null;
  const cands = [];
  for (const a of j.carg?.[0]?.agr ?? [])
    for (const p of a.par ?? [])
      for (const c of p.cand ?? []) cands.push({ n: String(c.n), nome: NOMES[String(c.n)] ?? titulo(String(c.nmu ?? c.nm)), partido: p.sg, votos: num(c.vap), pct: num(c.pvap) });
  cands.sort((x, y) => y.votos - x.votos || x.nome.localeCompare(y.nome));
  return {
    pst: num(j.s?.pst),
    atualizado: `${j.dt || j.dg || ''} ${j.ht || j.hg || ''}`.trim(),
    secoes: { total: num(j.s?.ts), totalizadas: num(j.s?.st) },
    eleitorado: num(j.e?.te),
    comparecimento: num(j.e?.c),
    validos: num(j.v?.vv),
    brancos: num(j.v?.vb),
    nulos: num(j.v?.tvn),
    cands,
  };
}

/** Executa com no máximo n tarefas em paralelo. */
export async function emLotes(itens, n, fn) {
  const out = new Array(itens.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, itens.length) }, async () => {
      while (i < itens.length) {
        const k = i++;
        out[k] = await fn(itens[k]);
      }
    }),
  );
  return out;
}

const p4 = (n) => String(n).padStart(4, '0');
/** Boletins já lidos (não mudam depois de totalizados) — vale enquanto a função estiver quente. */
const cacheBU = new Map();

/** Votos de presidente de uma seção (do Boletim de Urna), ou null se ainda não foi totalizada. */
export async function votosDaSecao(turno, uf, mun, zona, secao) {
  const { eleicao, pleito } = TURNOS[turno];
  const chave = `${turno}-${mun}-${zona}-${secao}`;
  if (cacheBU.has(chave)) return cacheBU.get(chave);
  const base = `${BASE}/arquivo-urna/${pleito}/dados/${uf}/${mun}/${p4(zona)}/${p4(secao)}`;
  const aux = await baixar(`${base}/p${pleito.padStart(6, '0')}-${uf}-m${mun}-z${p4(zona)}-s${p4(secao)}-aux.json`);
  for (const h of aux?.hashes ?? []) {
    const bu = (h.arq ?? []).find((a) => a.tp === 'bu');
    if (!bu || !/totaliz/i.test(String(h.st ?? ''))) continue;
    const arquivo = await baixar(`${base}/${h.hash}/${bu.nm}`, true);
    if (!arquivo) continue;
    const v = lerBU(arquivo, 1);
    if (v && String(v.idEleicao) === eleicao) {
      const r = { aptos: v.aptos, comparecimento: v.comparecimento, brancos: v.brancos, nulos: v.nulos, votos: Object.fromEntries(v.nominais) };
      cacheBU.set(chave, r);
      return r;
    }
  }
  return null;
}
