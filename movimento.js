// "Que horas ir votar?" — movimento de cada colégio no 1º turno, lido do registro das urnas (TSE).

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const titulo = (s) => s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Dos|Das|E)\b/g, (w) => w.toLowerCase());
const guardado = (k, p) => {
  try {
    return localStorage.getItem(k) ?? p;
  } catch {
    return p;
  }
};
const guardar = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};

/** Horas mostradas: das 8h até a última hora em que alguém votou (vem nos dados). Meias horas a partir das 8h. */
let HORAS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
/** Níveis em palavras (para quem não gosta de número) — rampa de uma cor só, clara → escura. */
const NIVEIS = [
  { nome: 'Tranquilo', cor: 'var(--n1)' },
  { nome: 'Movimentado', cor: 'var(--n2)' },
  { nome: 'Cheio', cor: 'var(--n3)' },
];

let dados = null;
const estado = { mun: guardado('movMun', '38822'), local: null };

const porHora = (h) => HORAS.map((hora) => (h[(hora - 8) * 2] ?? 0) + (h[(hora - 8) * 2 + 1] ?? 0));
const secoesComDados = (c) => c.secoes.filter((s) => s.h);
/** Média de eleitores por seção (sala) em cada hora — compara colégios grandes e pequenos. */
const mediaPorHora = (c) => {
  const ss = secoesComDados(c);
  return HORAS.map((_, i) => (ss.length ? ss.reduce((t, s) => t + porHora(s.h)[i], 0) / ss.length : 0));
};

/** Limites de "tranquilo/movimentado/cheio" a partir de como foi a cidade toda (8h às 17h). */
function limites(cidade) {
  const v = [];
  for (const c of cidade.colegios) for (const s of secoesComDados(c)) porHora(s.h).slice(0, 10).forEach((x) => v.push(x));
  v.sort((a, b) => a - b);
  return [v[Math.floor(v.length / 3)], v[Math.floor((2 * v.length) / 3)]];
}
const nivel = (x, [l1, l2]) => (x <= l1 ? 0 : x <= l2 ? 1 : 2);

/** Melhor janela (1h30, entre 8h e 16h30) e pior janela, a partir das meias horas somadas do colégio. */
function janelas(c) {
  const ss = secoesComDados(c);
  const meia = Array.from({ length: 22 }, (_, k) => ss.reduce((t, s) => t + (s.h[k] ?? 0), 0));
  const hm = (k) => {
    const m = 8 * 60 + k * 30;
    return `${Math.floor(m / 60)}h${m % 60 ? '30' : ''}`;
  };
  let melhor = null, pior = null;
  for (let k = 0; k + 3 <= 17; k++) {
    const soma = meia[k] + meia[k + 1] + meia[k + 2];
    if (!melhor || soma < melhor.soma) melhor = { k, soma };
    if (!pior || soma > pior.soma) pior = { k, soma };
  }
  return { melhor: `${hm(melhor.k)} às ${hm(melhor.k + 3)}`, pior: `${hm(pior.k)} às ${hm(pior.k + 3)}` };
}

const celula = (n, lim, rotulo) => `<td title="${esc(rotulo)}" style="background:${NIVEIS[nivel(n, lim)].cor}"><span>${Math.round(n)}</span></td>`;

function renderColegio() {
  const cidade = dados.cidades[estado.mun];
  const c = cidade.colegios.find((x) => x.local === estado.local) ?? cidade.colegios[0];
  estado.local = c.local;
  $('#escolha').value = String(c.local);
  const lim = limites(cidade);
  const ss = secoesComDados(c);
  const { melhor, pior } = janelas(c);
  const media = mediaPorHora(c);
  const maior = Math.max(...media, 1);
  const cabines = ss.map((s) => s.cabine).filter(Boolean).sort((a, b) => a - b);
  const cabine = cabines.length ? cabines[Math.floor(cabines.length / 2)] : null;
  const votos = ss.reduce((t, s) => t + s.votos, 0);
  // Soma todas as seções do colégio, inclusive as agregadas (votam na urna de outra seção).
  const aptos = c.secoes.reduce((t, s) => t + (s.aptos ?? 0), 0);
  const avisos = [];
  for (const s of ss) {
    if (s.abriu && s.abriu > '08:05') avisos.push(`A seção ${s.s} começou atrasada (às ${s.abriu}).`);
    if (s.ultimo && s.ultimo >= '17:45') avisos.push(`Na seção ${s.s}, a última pessoa votou às ${s.ultimo}.`);
  }
  const maisTarde = ss.reduce((m, s) => (s.ultimo && s.ultimo > m ? s.ultimo : m), '');
  const filaNoite = maisTarde >= '18:30';

  const barras = HORAS.map((h, i) => {
    const n = media[i];
    const lv = nivel(n, lim);
    return `<div class="barra-hora" role="img" aria-label="${h}h: ${NIVEIS[lv].nome}">
      <div class="barra-col"><i style="height:${(100 * n) / maior}%;background:${NIVEIS[lv].cor}"></i></div>
      <span class="barra-h">${h}h</span></div>`;
  }).join('');

  const linhas = ss
    .map((s) => `<tr><th scope="row">Seção ${s.s}</th>${porHora(s.h).map((n, i) => celula(n, lim, `Seção ${s.s}, ${HORAS[i]}h: ${n} eleitores votaram (${NIVEIS[nivel(n, lim)].nome.toLowerCase()})`)).join('')}</tr>`)
    .join('');

  $('#colegio').innerHTML = `
    <div class="zona-tag">Zona ${c.zona}</div>
    <h3 class="col-nome">${esc(titulo(c.nome))}</h3>
    <p class="col-end">${esc(c.endereco)}</p>
    ${filaNoite ? `<div class="alerta-fila"><strong>⚠️ Chegue cedo!</strong> No 1º turno este colégio teve fila até a noite: a última pessoa votou às <strong>${maisTarde}</strong>.</div>` : ''}
    <div class="respostas">
      <div class="resp boa"><span class="resp-ico" aria-hidden="true">😌</span><div><small>Melhor horário para ir</small><strong>${melhor}</strong></div></div>
      <div class="resp ruim"><span class="resp-ico" aria-hidden="true">🧍‍♂️🧍‍♀️🧍</span><div><small>Mais cheio (evite)</small><strong>${pior}</strong></div></div>
    </div>
    <p class="col-resumo">No 1º turno votaram <strong>${votos.toLocaleString('pt-BR')}</strong> das ${aptos.toLocaleString('pt-BR')} pessoas deste colégio, em ${ss.length} ${ss.length === 1 ? 'sala' : 'salas'}.${cabine ? ` Cada eleitor levou <strong>cerca de ${Math.round(cabine / 60) <= 1 ? '1 minuto' : `${Math.round(cabine / 60)} minutos`}</strong> na cabine.` : ''}</p>
    <h4>Hora a hora</h4>
    <div class="barras" style="grid-template-columns:repeat(${HORAS.length},1fr)" aria-label="Movimento por hora">${barras}</div>
    ${avisos.length ? `<ul class="avisos">${avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
    <h4>Cada sala (seção), hora a hora</h4>
    <p class="explica">Cada quadradinho é uma hora. O número é quantas pessoas votaram naquela sala naquela hora.</p>
    <div class="calor-rolagem"><table class="calor"><thead><tr><th></th>${HORAS.map((h) => `<th>${h}h</th>`).join('')}</tr></thead><tbody>${linhas}</tbody></table></div>`;
}

function renderCidade() {
  const cidade = dados.cidades[estado.mun];
  const lim = limites(cidade);
  $('#escolha').innerHTML = cidade.colegios.map((c) => `<option value="${c.local}">Zona ${c.zona} · ${esc(titulo(c.nome))}</option>`).join('');
  const linhas = cidade.colegios
    .filter((c) => secoesComDados(c).length)
    .map((c) => {
      const media = mediaPorHora(c);
      return `<tr data-local="${c.local}" tabindex="0"><th scope="row">${esc(titulo(c.nome))}</th>${media.map((n, i) => celula(n, lim, `${titulo(c.nome)}, ${HORAS[i]}h: ${NIVEIS[nivel(n, lim)].nome.toLowerCase()}`)).join('')}</tr>`;
    })
    .join('');
  $('#calor-cidade').innerHTML = `<table class="calor calor-cidade"><thead><tr><th>Colégio</th>${HORAS.map((h) => `<th>${h}h</th>`).join('')}</tr></thead><tbody>${linhas}</tbody></table>`;
  $('#calor-cidade').querySelectorAll('tr[data-local]').forEach((tr) => {
    const abrir = () => {
      estado.local = Number(tr.dataset.local);
      renderColegio();
      $('#t-colegio').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    tr.addEventListener('click', abrir);
    tr.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), abrir()));
  });
  document.querySelectorAll('[data-mun]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mun === estado.mun)));
  renderColegio();
}

document.querySelectorAll('[data-mun]').forEach((b) =>
  b.addEventListener('click', () => {
    estado.mun = b.dataset.mun;
    estado.local = null;
    guardar('movMun', estado.mun);
    renderCidade();
  }),
);
$('#escolha').addEventListener('change', (e) => {
  estado.local = Number(e.target.value);
  renderColegio();
});

dados = await (await fetch('data/movimento-t1.json')).json();
HORAS = Array.from({ length: (dados.ultimaHora ?? 18) - 7 }, (_, i) => 8 + i);
$('#legenda-niveis').innerHTML = NIVEIS.map((n) => `<span><i style="background:${n.cor}"></i>${n.nome}</span>`).join('');
renderCidade();
