/**
 * Leitor do Boletim de Urna (BU) do TSE: arquivo .bu, em ASN.1 DER (especificação pública "bu.asn1").
 * Só extrai o que a Botilde usa: eleitores aptos, comparecimento e votos por candidato de um cargo.
 */

/** Lê os elementos TLV (DER) de um buffer. */
function ler(buf) {
  const nos = [];
  let i = 0;
  while (i < buf.length) {
    const t = buf[i++];
    const classe = t >> 6;
    const construido = (t & 0x20) !== 0;
    let numero = t & 0x1f;
    if (numero === 0x1f) {
      numero = 0;
      let b;
      do {
        b = buf[i++];
        numero = (numero << 7) | (b & 0x7f);
      } while (b & 0x80);
    }
    let len = buf[i++];
    if (len & 0x80) {
      const n = len & 0x7f;
      len = 0;
      for (let k = 0; k < n; k++) len = len * 256 + buf[i++];
    }
    const valor = buf.subarray(i, i + len);
    i += len;
    nos.push({ classe, construido, numero, valor, filhos: construido ? ler(valor) : [] });
  }
  return nos;
}

const inteiro = (n) => {
  let v = 0;
  for (const b of n.valor) v = v * 256 + b;
  return v;
};

/**
 * Extrai os votos de um cargo constitucional (1 = presidente, 3 = governador...) de um BU.
 * Retorna null se o arquivo não tiver o cargo (ou estiver em formato inesperado).
 */
export function lerBU(arquivo, cargo) {
  const [envelope] = ler(arquivo);
  if (!envelope) return null;
  // O conteúdo do envelope é o último OCTET STRING (universal 4): é o EntidadeBoletimUrna.
  const conteudo = [...envelope.filhos].reverse().find((n) => n.classe === 0 && n.numero === 4);
  if (!conteudo) return null;
  const [bu] = ler(conteudo.valor);
  if (!bu) return null;
  // Formato 2026: resultadosVotacaoPorEleicao é um SEQUENCE OF sem tag, cujos itens começam por
  // idEleicao, aptos, aptosSecao, aptosTTE (INTEGERs) seguidos da lista de resultados.
  const ehInteiro = (n) => !!n && n.classe === 0 && !n.construido && n.numero === 2;
  const seq = (n) => !!n && n.classe === 0 && n.construido && n.numero === 16;
  const porEleicao = bu.filhos.find((n) => seq(n) && n.filhos.length > 0 && n.filhos.every((r) => seq(r) && ehInteiro(r.filhos[0]) && ehInteiro(r.filhos[1])));
  if (!porEleicao) return null;
  for (const rve of porEleicao.filhos) {
    const idEleicao = rve.filhos[0];
    const aptos = rve.filhos[1];
    const lista = rve.filhos.find(seq);
    for (const rv of lista?.filhos ?? []) {
      const comparecimento = rv.filhos[1];
      const totais = rv.filhos.find(seq);
      for (const tvc of totais?.filhos ?? []) {
        const codigoCargo = tvc.filhos[0];
        const votaveis = tvc.filhos.find(seq);
        // CodigoCargoConsulta: [1] cargoConstitucional (ENUM implícito)
        if (!(codigoCargo && codigoCargo.classe === 2 && codigoCargo.numero === 1 && inteiro(codigoCargo) === cargo)) continue;
        const r = { idEleicao: inteiro(idEleicao), aptos: inteiro(aptos), comparecimento: inteiro(comparecimento), nominais: new Map(), brancos: 0, nulos: 0 };
        for (const tvv of votaveis?.filhos ?? []) {
          const tipo = tvv.filhos.find((n) => n.classe === 2 && n.numero === 1);
          const qtd = tvv.filhos.find((n) => n.classe === 2 && n.numero === 2);
          const id = tvv.filhos.find((n) => n.classe === 2 && n.numero === 3);
          if (!tipo || !qtd) continue;
          const t = inteiro(tipo);
          const q = inteiro(qtd);
          if (t === 2) r.brancos += q;
          else if (t === 3) r.nulos += q;
          else if (id) {
            const codigo = inteiro(id.filhos[1]);
            r.nominais.set(codigo, (r.nominais.get(codigo) ?? 0) + q);
          }
        }
        return r;
      }
    }
  }
  return null;
}
