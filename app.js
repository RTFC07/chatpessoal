// Botilde Eleições — apuração ao vivo (presidente). Sem framework: busca /api/* e desenha.

const NOME_UF = {
  ac: 'Acre', al: 'Alagoas', am: 'Amazonas', ap: 'Amapá', ba: 'Bahia', ce: 'Ceará', df: 'Distrito Federal', es: 'Espírito Santo',
  go: 'Goiás', ma: 'Maranhão', mg: 'Minas Gerais', ms: 'Mato Grosso do Sul', mt: 'Mato Grosso', pa: 'Pará', pb: 'Paraíba',
  pe: 'Pernambuco', pi: 'Piauí', pr: 'Paraná', rj: 'Rio de Janeiro', rn: 'Rio Grande do Norte', ro: 'Rondônia', rr: 'Roraima',
  rs: 'Rio Grande do Sul', sc: 'Santa Catarina', se: 'Sergipe', sp: 'São Paulo', to: 'Tocantins',
};
/** Estados pequenos demais para rótulo dentro do mapa (aparecem ao tocar). */
const SEM_ROTULO = new Set(['rn', 'pb', 'pe', 'al', 'se', 'df', 'es', 'rj']);

/** Cor fixa por candidato (número de urna); quem não está aqui usa a sequência de reserva. */
const COR = { '22': '#1546c9', '13': '#d7191c', '14': '#e0a800', '55': '#1a9850', '30': '#f07c00', '70': '#8e3fb0' };
const RESERVA = ['#0fa3b1', '#8c5a2b', '#c51b8a', '#5c6b7a', '#6a51a3', '#2ca25f'];
const corDe = (n) => COR[n] ?? RESERVA[Number(n) % RESERVA.length];

const fmt = (n) => Math.round(n).toLocaleString('pt-BR');
const pct = (n, casas = 2) => `${n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const $ = (s) => document.querySelector(s);

const guardado = (k, padrao) => {
  try {
    return localStorage.getItem(k) ?? padrao;
  } catch {
    return padrao;
  }
};
const guardar = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};

const params = new URLSearchParams(location.search);
const estado = {
  turno: params.get('t') ?? guardado('turno', '2'),
  mun: guardado('mun', '38822'),
  uf: null,
  resumo: null,
  municipio: null,
};

async function api(caminho) {
  const r = await fetch(caminho, { cache: 'no-store' });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro ?? `Erro ${r.status}`);
  return r.json();
}

// ------------------------------------------------------------------ Brasil

function candidatosInfo() {
  const m = new Map();
  // Nomes vêm do Brasil e da própria cidade (o que chegar primeiro).
  for (const c of [...(estado.municipio?.cidade?.cands ?? []), ...(estado.resumo?.br?.cands ?? [])]) m.set(c.n, c);
  return m;
}

function blocoApurado(pst, rotulo = 'das urnas apuradas') {
  return `<div class="apurado"><span><strong>${pct(pst)}</strong> ${rotulo}</span></div>
    <div class="progresso" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pst}" aria-label="${pct(pst)} ${rotulo}"><i style="width:${pst}%"></i></div>`;
}

function listaCandidatos(cands, max = 6) {
  const lista = cands.slice(0, max);
  const maior = Math.max(...lista.map((c) => c.pct), 1);
  return `<ul class="cands">${lista
    .map(
      (c) => `<li>
        <div class="cand-topo">
          <span class="cand-nome"><span class="ponto" style="background:${corDe(c.n)}"></span><span>${esc(c.nome)} <span class="partido">${esc(c.partido)}</span></span></span>
          <span class="cand-pct">${pct(c.pct)}</span>
        </div>
        <div class="trilho"><i style="width:${(100 * c.pct) / maior}%;background:${corDe(c.n)}"></i></div>
        <div class="cand-votos">${fmt(c.votos)} votos</div>
      </li>`,
    )
    .join('')}</ul>`;
}

function duelo(a, b) {
  const total = a.votos + b.votos;
  const pa = total ? (100 * a.votos) / total : 50;
  const dif = Math.abs(a.votos - b.votos);
  const lider = a.votos === b.votos ? null : a.votos > b.votos ? a : b;
  return `<div class="duelo">
    <div class="duelo-nomes">
      <div><div class="duelo-nome"><span class="ponto" style="background:${corDe(a.n)}"></span>${esc(a.nome)}</div>
        <div class="duelo-pct" style="color:${corDe(a.n)}">${pct(a.pct)}</div><div class="duelo-votos">${fmt(a.votos)} votos</div></div>
      <div><div class="duelo-nome">${esc(b.nome)}<span class="ponto" style="background:${corDe(b.n)}"></span></div>
        <div class="duelo-pct" style="color:${corDe(b.n)}">${pct(b.pct)}</div><div class="duelo-votos">${fmt(b.votos)} votos</div></div>
    </div>
    <div class="duelo-barra" role="img" aria-label="${esc(a.nome)} ${pct(a.pct)}, ${esc(b.nome)} ${pct(b.pct)}">
      <i style="width:${pa}%;background:${corDe(a.n)}"></i><i style="width:${100 - pa}%;background:${corDe(b.n)}"></i>
    </div>
    <div class="diferenca">${total ? (lider ? `<strong>${esc(lider.nome)}</strong> à frente por <strong>${fmt(dif)}</strong> votos` : 'Empate') : 'Ainda sem votos apurados'}</div>
  </div>`;
}

function renderBrasil() {
  const br = estado.resumo.br;
  const segundoTurno = String(estado.resumo.turno) === '2' && br.cands.length >= 2;
  const [a, b] = br.cands;
  // No duelo, quem está à esquerda é fixo (ordem do número), para a barra não "pular" de lado.
  const esquerda = segundoTurno ? [a, b].sort((x, y) => Number(y.n) - Number(x.n)) : [];
  $('#brasil').innerHTML = blocoApurado(br.pst) + (segundoTurno ? duelo(esquerda[0], esquerda[1]) : listaCandidatos(br.cands));
}

// ------------------------------------------------------------------ mapa

let geo = null;
async function montarMapa() {
  geo ??= await (await fetch('data/mapa-estados.json')).json();
  if ($('#mapa svg')) return;
  const paths = Object.entries(geo.estados)
    .map(([uf, e]) => `<path data-uf="${uf}" d="${e.d}" tabindex="0" role="button" aria-label="${NOME_UF[uf]}"></path>`)
    .join('');
  const rotulos = Object.entries(geo.estados)
    .filter(([uf]) => !SEM_ROTULO.has(uf))
    .map(([uf, e]) => `<text data-rot="${uf}" x="${e.cx}" y="${e.cy}" text-anchor="middle"></text>`)
    .join('');
  $('#mapa').innerHTML = `<svg viewBox="${geo.viewBox}" xmlns="http://www.w3.org/2000/svg">${paths}${rotulos}</svg>`;

  const svg = $('#mapa svg');
  svg.addEventListener('click', (ev) => {
    const uf = ev.target.closest('path')?.dataset.uf;
    if (uf) selecionarUF(uf);
  });
  svg.addEventListener('keydown', (ev) => {
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.dataset.uf) {
      ev.preventDefault();
      selecionarUF(ev.target.dataset.uf);
    }
  });
  // Balão no computador (no celular o toque já abre o painel do estado).
  const balao = $('#dica-mapa');
  svg.addEventListener('pointermove', (ev) => {
    const uf = ev.target.closest('path')?.dataset.uf;
    if (!uf || ev.pointerType !== 'mouse') return (balao.hidden = true);
    const r = estado.resumo?.estados?.[uf];
    const [l1, l2] = r?.cands ?? [];
    balao.innerHTML = `<strong>${NOME_UF[uf]}</strong><br>${r ? `${pct(r.pst, 1)} das urnas` : 'sem dados'}${
      l1 && l1.votos ? `<br>${esc(l1.nome)} ${pct(l1.pct)}${l2 ? `<br>${esc(l2.nome)} ${pct(l2.pct)}` : ''}` : ''
    }`;
    balao.hidden = false;
    balao.style.left = `${Math.min(ev.clientX + 14, innerWidth - 230)}px`;
    balao.style.top = `${ev.clientY + 14}px`;
  });
  svg.addEventListener('pointerleave', () => (balao.hidden = true));
}

function pintarMapa() {
  const usados = new Map();
  for (const [uf] of Object.entries(geo.estados)) {
    const r = estado.resumo.estados?.[uf];
    const lider = r?.cands?.[0];
    const path = $(`#mapa path[data-uf="${uf}"]`);
    const rot = $(`#mapa text[data-rot="${uf}"]`);
    if (!lider || !lider.votos) {
      path.style.fill = 'var(--sem-dados)';
      path.style.fillOpacity = 1;
      if (rot) {
        rot.textContent = uf.toUpperCase();
        rot.classList.add('escuro');
      }
      continue;
    }
    usados.set(lider.n, lider);
    path.style.fill = corDe(lider.n);
    // Mais forte = vantagem maior sobre o segundo colocado.
    const margem = lider.pct - (r.cands[1]?.pct ?? 0);
    path.style.fillOpacity = Math.min(1, 0.5 + margem / 40);
    if (rot) {
      rot.classList.remove('escuro');
      rot.innerHTML = `<tspan x="${rot.getAttribute('x')}" dy="-0.15em">${uf.toUpperCase()}</tspan><tspan class="pct" x="${rot.getAttribute('x')}" dy="1.05em">${Math.round(lider.pct)}%</tspan>`;
    }
    path.classList.toggle('sel', uf === estado.uf);
  }
  const itens = [...usados.values()].map((c) => `<span><i class="ponto" style="background:${corDe(c.n)}"></i>${esc(c.nome)} lidera</span>`);
  itens.push(`<span><i class="ponto" style="background:var(--sem-dados)"></i>sem urnas ainda</span>`);
  $('#legenda').innerHTML = itens.join('') + `<span>cor mais forte = vantagem maior</span>`;
}

function selecionarUF(uf) {
  estado.uf = uf;
  document.querySelectorAll('#mapa path').forEach((p) => p.classList.toggle('sel', p.dataset.uf === uf));
  renderEstado();
}

function renderEstado() {
  const alvo = $('#estado');
  if (!estado.uf) {
    alvo.innerHTML = `<p class="vazio">Toque num estado para ver o % de urnas apuradas e de cada candidato.</p>`;
    return;
  }
  const r = estado.resumo.estados?.[estado.uf];
  if (!r) {
    alvo.innerHTML = `<h3>${NOME_UF[estado.uf]}</h3><p class="vazio">Sem dados do TSE para este estado agora.</p>`;
    return;
  }
  alvo.innerHTML = `<h3>${NOME_UF[estado.uf]}</h3>${blocoApurado(r.pst)}${listaCandidatos(r.cands, 4)}`;
}

function renderTabela() {
  const topo = estado.resumo.br.cands.slice(0, String(estado.resumo.turno) === '2' ? 2 : 4);
  const linhas = Object.keys(NOME_UF)
    .map((uf) => {
      const r = estado.resumo.estados?.[uf];
      const lider = r?.cands?.[0]?.votos ? r.cands[0].n : null;
      const cel = topo
        .map((c) => {
          const x = r?.cands.find((k) => k.n === c.n);
          return `<td class="${x && x.n === lider ? 'lider' : ''}">${x ? pct(x.pct) : '—'}</td>`;
        })
        .join('');
      return `<tr><td>${uf.toUpperCase()}</td><td>${r ? pct(r.pst, 1) : '—'}</td>${cel}</tr>`;
    })
    .join('');
  $('#tabela').innerHTML = `<table><thead><tr><th>UF</th><th>Urnas</th>${topo.map((c) => `<th>${esc(c.nome)}</th>`).join('')}</tr></thead><tbody>${linhas}</tbody></table>`;
}

// ------------------------------------------------------------------ municípios

function somaVotos(resultados) {
  const t = {};
  for (const r of resultados) if (r) for (const [n, v] of Object.entries(r.votos)) t[n] = (t[n] ?? 0) + v;
  return t;
}

/** Barra + legenda com os dois primeiros (% sobre os votos válidos daquele recorte). */
function placar(votos) {
  const info = candidatosInfo();
  const total = Object.values(votos).reduce((a, b) => a + b, 0);
  if (!total) return `<div class="aguardando">Aguardando urnas</div>`;
  const ord = Object.entries(votos).sort((a, b) => b[1] - a[1]);
  const barra = ord.map(([n, v]) => `<i style="width:${(100 * v) / total}%;background:${corDe(n)}" title="${esc(info.get(n)?.nome ?? n)}"></i>`).join('');
  const [p1, p2] = ord;
  const nome = (n) => esc(info.get(n)?.nome ?? `Nº ${n}`);
  return `<div class="mini-barra">${barra}</div>
    <div class="mini-legenda"><span><b style="color:${corDe(p1[0])}">${pct((100 * p1[1]) / total, 1)}</b> ${nome(p1[0])}</span>${
      p2 ? `<span>${nome(p2[0])} <b style="color:${corDe(p2[0])}">${pct((100 * p2[1]) / total, 1)}</b></span>` : ''
    }</div>`;
}

function renderMunicipio() {
  const m = estado.municipio;
  const pctUrnas = m.urnas.total ? (100 * m.urnas.apuradas) / m.urnas.total : 0;
  const cidadeVotos = Object.fromEntries((m.cidade?.cands ?? []).map((c) => [c.n, c.votos]));
  const colegios = m.colegios
    .map((c) => {
      const principais = c.secoes.filter((s) => !s.agregadaA);
      const prontas = principais.filter((s) => s.resultado).length;
      const pc = principais.length ? (100 * prontas) / principais.length : 0;
      const secoes = c.secoes
        .map((s) => {
          if (s.agregadaA) return `<li class="secao"><div class="secao-topo"><span>Seção ${s.secao}</span><span>votou junto com a seção ${s.agregadaA}</span></div></li>`;
          if (!s.resultado) return `<li class="secao"><div class="secao-topo"><span>Seção ${s.secao}</span><span>${fmt(s.aptos)} eleitores</span></div><div class="aguardando">⏳ aguardando apuração</div></li>`;
          const validos = Object.values(s.resultado.votos).reduce((a, b) => a + b, 0);
          return `<li class="secao"><div class="secao-topo"><span>Seção ${s.secao}</span><span>${fmt(validos)} válidos · ${fmt(s.resultado.comparecimento)} de ${fmt(s.resultado.aptos)} votaram</span></div>${placar(s.resultado.votos)}</li>`;
        })
        .join('');
      return `<details class="colegio">
        <summary>
          <div class="colegio-zona">Zona ${c.zona}</div>
          <div class="colegio-nome">${esc(c.nome)}</div>
          <div class="colegio-end">${esc(c.endereco)}</div>
          ${placar(somaVotos(principais.map((s) => s.resultado)))}
          <div class="colegio-meta"><span>${pct(pc, 0)} apurado · ${prontas} de ${principais.length} seções</span><span class="abrir">Seções</span></div>
        </summary>
        <ul class="secoes">${secoes}</ul>
      </details>`;
    })
    .join('');
  $('#municipio').innerHTML = `<div class="cartao cidade-resumo">
      <h3>${esc(m.nome)}</h3>
      ${blocoApurado(m.cidade?.pst ?? pctUrnas, `das urnas apuradas (${m.urnas.apuradas} de ${m.urnas.total})`)}
      <div style="margin-top:12px">${placar(cidadeVotos)}</div>
    </div>
    <div class="colegios">${colegios}</div>`;
}

// ------------------------------------------------------------------ ciclo

function status(texto, erro = false) {
  $('#status').innerHTML = erro ? `<span class="erro">${esc(texto)}</span>` : texto;
}

async function atualizarResumo() {
  try {
    estado.resumo = await api(`/api/resumo?t=${estado.turno}`);
    await montarMapa();
    renderBrasil();
    pintarMapa();
    renderEstado();
    renderTabela();
    if (estado.municipio) renderMunicipio();
    const br = estado.resumo.br;
    const vivo = br.pst > 0 && br.pst < 100;
    status(`${vivo ? '<span class="ao-vivo"></span>Ao vivo · ' : ''}TSE: ${esc(br.atualizado)} · ${pct(br.pst)} das urnas do Brasil`);
  } catch (e) {
    status(`Não consegui falar com o TSE agora (${e.message}). Tento de novo em 1 minuto.`, true);
  }
}

async function atualizarMunicipio() {
  const pedido = `${estado.turno}:${estado.mun}`;
  try {
    const m = await api(`/api/municipio?mun=${estado.mun}&t=${estado.turno}`);
    if (pedido !== `${estado.turno}:${estado.mun}`) return; // trocou de aba no meio do caminho
    // Mantém abertos os colégios que a pessoa abriu.
    const abertos = new Set([...document.querySelectorAll('.colegio[open] .colegio-nome')].map((e) => e.textContent));
    estado.municipio = m;
    renderMunicipio();
    document.querySelectorAll('.colegio').forEach((d) => {
      if (abertos.has(d.querySelector('.colegio-nome').textContent)) d.open = true;
    });
  } catch (e) {
    $('#municipio').innerHTML = `<div class="cartao"><p class="erro">Não consegui carregar o município (${esc(e.message)}).</p></div>`;
  }
}

function marcarAbas() {
  document.querySelectorAll('[data-turno]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.turno === estado.turno)));
  document.querySelectorAll('[data-mun]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mun === estado.mun)));
}

document.querySelectorAll('[data-turno]').forEach((b) =>
  b.addEventListener('click', () => {
    if (estado.turno === b.dataset.turno) return;
    estado.turno = b.dataset.turno;
    guardar('turno', estado.turno);
    const u = new URL(location.href);
    u.searchParams.set('t', estado.turno);
    history.replaceState(null, '', u);
    marcarAbas();
    $('#municipio').innerHTML = '<div class="cartao"><div class="esqueleto"></div></div>';
    atualizarResumo();
    atualizarMunicipio();
  }),
);
document.querySelectorAll('[data-mun]').forEach((b) =>
  b.addEventListener('click', () => {
    if (estado.mun === b.dataset.mun) return;
    estado.mun = b.dataset.mun;
    guardar('mun', estado.mun);
    marcarAbas();
    $('#municipio').innerHTML = '<div class="cartao"><div class="esqueleto"></div></div>';
    atualizarMunicipio();
  }),
);

marcarAbas();
atualizarResumo();
atualizarMunicipio();
// Atualiza sozinho; pausa quando a aba/app está em segundo plano (economiza bateria e dados no celular).
setInterval(() => document.visibilityState === 'visible' && atualizarResumo(), 60_000);
setInterval(() => document.visibilityState === 'visible' && atualizarMunicipio(), 90_000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    atualizarResumo();
    atualizarMunicipio();
  }
});
