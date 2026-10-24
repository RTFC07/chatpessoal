# Botilde Eleições

Apuração ao vivo da eleição para **presidente** (2º turno de 2026, com o 1º turno para consulta):

- **Brasil:** % de cada candidato, votos e % de urnas apuradas.
- **Mapa por estado:** cor de quem lidera; toque num estado para ver o % de urnas e de cada candidato.
- **Municípios:** São Félix do Coribe e Santa Maria da Vitória, colégio por colégio (zona, nome, endereço) e seção por seção, lidos direto dos boletins de urna.

Feito primeiro para celular (Android e iOS), com modo escuro automático.

## Como funciona

O TSE recusa pedidos feitos direto de outro site, então o navegador nunca fala com o TSE. Quem busca são duas funções da Vercel:

| Rota | O que devolve | Cache na CDN |
|---|---|---|
| `/api/resumo?t=2` | Brasil e os 27 estados | 30 s |
| `/api/municipio?mun=38822&t=2` | colégios e seções do município (lê os boletins de urna) | 60 s |

`t=1` mostra o 1º turno. Os colégios e seções vêm de `data/locais.json` (tabela "locais de votação" dos dados abertos do TSE) e o mapa de `data/mapa-estados.json` (malha do IBGE).

## Rodar no computador

```bash
npm run dev   # http://localhost:3000
```
