// GET /api/resumo?t=2 → presidente no Brasil e em cada estado (uma chamada só para o site).
import { emLotes, presidente, turnoDe, UFS } from '../lib/tse.js';

export default async function handler(req, res) {
  const turno = turnoDe(req.query.t);
  const br = await presidente(turno, 'br');
  if (!br) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ erro: 'O TSE não respondeu. Tentando de novo em instantes.' });
  }
  const estados = {};
  await emLotes(UFS, 8, async (uf) => {
    estados[uf] = await presidente(turno, uf);
  });
  // A CDN da Vercel guarda por 30s: todo mundo que abrir o site no mesmo minuto usa a mesma resposta.
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
  res.status(200).json({ turno, br, estados });
}
