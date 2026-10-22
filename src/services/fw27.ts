/**
 * Sugestão FW27 — cálculo.
 *
 * Como a sugestão sai:
 *   verba da loja × % do subgrupo (HOME, AWAY, THIRD…)  → dinheiro da loja naquele subgrupo
 *   ÷ produtos do subgrupo                → dinheiro por produto
 *   ÷ preço PDV (RRP)                     → peças sugeridas da loja
 *   peças × peso de cada tamanho          → grade
 * A entrega é a data de lançamento (LOCAL RID). Um mês pode ter mais de uma entrega.
 *
 * O que o franqueado mexe fica salvo como grade final (loja × produto → tamanho → peças).
 * O que não foi mexido continua sendo a sugestão, então muda se a verba mudar.
 */
import amd from "../data/fw27Amd.json";
import subgruposPorArtigo from "../data/fw27Subgrupos.json";

export interface Fw27Produto {
  artigo: string;
  descricao: string;
  pack: string;
  /** Subgrupo de vocês (HOME, AWAY, THIRD…). Vem de src/data/fw27Subgrupos.json; sem cadastro, usa o PACK. */
  subgrupo: string;
  tipo: string;
  genero: string;
  idade: string;
  tamanhos: string[];
  lancamento: string; // AAAA-MM-DD
  fim: string;
  preco: number;
  carryOver: string;
}

export interface Fw27Loja {
  id: string;
  nome: string;
  verba: number; // R$ a preço PDV
}

export type Fw27Status = "rascunho" | "enviado";

export interface Fw27Pedido {
  lojas: Fw27Loja[];
  /** % da verba de cada loja que vai para cada subgrupo (PACK). Vazio = padrão. */
  subgrupos: Record<string, number>;
  /** Grade editada: chave "ARTIGO|lojaId" → { tamanho: peças }. */
  itens: Record<string, Record<string, number>>;
  status: Fw27Status;
  atualizadoEm?: string;
  enviadoEm?: string;
}

const MAPA_SUBGRUPO = subgruposPorArtigo as Record<string, string>;
export const PRODUTOS: Fw27Produto[] = (amd as Omit<Fw27Produto, "subgrupo">[]).map((p) => ({
  ...p,
  subgrupo: (MAPA_SUBGRUPO[p.artigo] || p.pack || "OUTROS").toUpperCase(),
}));

/** Ordem de exibição dos subgrupos; os que não estiverem aqui vão no fim. */
const ORDEM_SUBGRUPOS = ["HOME", "AWAY", "THIRD", "SPECIAL", "TIROTECH", "POLIAMIDAS", "ICON", "ORIGINALS", "GRAPHIC", "BASQUETE"];

export const SUBGRUPOS: string[] = (() => {
  const out: string[] = [];
  PRODUTOS.forEach((p) => { if (!out.includes(p.subgrupo)) out.push(p.subgrupo); });
  const pos = (s: string) => { const i = ORDEM_SUBGRUPOS.indexOf(s); return i < 0 ? 99 : i; };
  return out.sort((a, b) => pos(a) - pos(b) || a.localeCompare(b));
})();

export function pedidoVazio(): Fw27Pedido {
  return { lojas: [], subgrupos: {}, itens: {}, status: "rascunho" };
}

export const chaveItem = (artigo: string, lojaId: string) => `${artigo}|${lojaId}`;

/** % padrão de cada subgrupo: proporcional a quantas referências ele tem na AMD. */
export function subgruposPadrao(): Record<string, number> {
  const out: Record<string, number> = {};
  const total = PRODUTOS.length || 1;
  SUBGRUPOS.forEach((sg) => { out[sg] = (PRODUTOS.filter((p) => p.subgrupo === sg).length / total) * 100; });
  return out;
}

/** % de cada subgrupo em uso (o salvo, ou o padrão quando ainda não foi definido). */
export function pctSubgrupos(pedido: Fw27Pedido): Record<string, number> {
  const salvo = pedido.subgrupos || {};
  // Nada salvo, ou salvo com nomes antigos (PACK): usa o padrão.
  if (!SUBGRUPOS.some((sg) => salvo[sg] !== undefined)) return subgruposPadrao();
  const out: Record<string, number> = {};
  SUBGRUPOS.forEach((sg) => { out[sg] = Number(salvo[sg] || 0); });
  return out;
}

/** Divide um total inteiro pelos pesos, sem perder peças no arredondamento. */
export function dividir(total: number, pesos: number[]): number[] {
  const n = Math.max(0, Math.round(total));
  const soma = pesos.reduce((a, b) => a + b, 0);
  if (!pesos.length) return [];
  if (soma <= 0) return dividir(n, pesos.map(() => 1));
  const bruto = pesos.map((w) => (n * w) / soma);
  const out = bruto.map(Math.floor);
  let resto = n - out.reduce((a, b) => a + b, 0);
  bruto
    .map((r, i) => [r - Math.floor(r), i] as const)
    .sort((a, b) => b[0] - a[0] || a[1] - b[1])
    .forEach(([, i]) => { if (resto > 0) { out[i] += 1; resto -= 1; } });
  return out;
}

/**
 * Peso de cada tamanho. Até termos a grade vendida no PDV, usa mais peças no meio
 * da grade e menos nas pontas.
 */
export function pesosGrade(p: Fw27Produto): number[] {
  const n = p.tamanhos.length;
  return p.tamanhos.map((_, i) => {
    const d = Math.abs(i - (n - 1) / 2);
    return Math.max(4, Math.round(30 - d * 9));
  });
}

export function gradeDe(p: Fw27Produto, total: number): Record<string, number> {
  const qs = dividir(total, pesosGrade(p));
  const out: Record<string, number> = {};
  p.tamanhos.forEach((t, i) => { out[t] = qs[i]; });
  return out;
}

const somaGrade = (g: Record<string, number>) => Object.values(g).reduce((a, b) => a + (Number(b) || 0), 0);

/** Peças sugeridas (sem edição) de um produto numa loja. */
export function sugeridoLoja(pedido: Fw27Pedido, p: Fw27Produto, loja: Fw27Loja, pct = pctSubgrupos(pedido)): number {
  const nPack = PRODUTOS.filter((x) => x.subgrupo === p.subgrupo).length || 1;
  const dinheiro = (Number(loja.verba || 0) * (pct[p.subgrupo] || 0)) / 100 / nPack;
  return p.preco > 0 ? Math.round(dinheiro / p.preco) : 0;
}

export interface Fw27Linha {
  produto: Fw27Produto;
  loja: Fw27Loja;
  sugerido: number;
  grade: Record<string, number>;
  qtd: number;
  valor: number;
  editado: boolean;
}

/** Todas as linhas loja × produto com a quantidade final (editada ou sugerida). */
export function calcular(pedido: Fw27Pedido): Fw27Linha[] {
  const pct = pctSubgrupos(pedido);
  const linhas: Fw27Linha[] = [];
  PRODUTOS.forEach((p) => {
    pedido.lojas.forEach((l) => {
      const sugerido = sugeridoLoja(pedido, p, l, pct);
      const editada = pedido.itens[chaveItem(p.artigo, l.id)];
      const grade = editada ? { ...gradeDe(p, 0), ...editada } : gradeDe(p, sugerido);
      const qtd = somaGrade(grade);
      linhas.push({ produto: p, loja: l, sugerido, grade, qtd, valor: qtd * p.preco, editado: !!editada });
    });
  });
  return linhas;
}

export interface Fw27Totais {
  pecas: number;
  valor: number;
  verba: number;
  porLoja: Record<string, { pecas: number; valor: number; pctSugerido: number; pctAtual: number }>;
  porPack: Record<string, { pecas: number; valor: number; pctSugerido: number; pctAtual: number }>;
}

export function totais(pedido: Fw27Pedido, linhas: Fw27Linha[]): Fw27Totais {
  const pct = pctSubgrupos(pedido);
  const verba = pedido.lojas.reduce((a, l) => a + Number(l.verba || 0), 0);
  const pecas = linhas.reduce((a, x) => a + x.qtd, 0);
  const valor = linhas.reduce((a, x) => a + x.valor, 0);
  const porLoja: Fw27Totais["porLoja"] = {};
  pedido.lojas.forEach((l) => {
    const ls = linhas.filter((x) => x.loja.id === l.id);
    const v = ls.reduce((a, x) => a + x.valor, 0);
    porLoja[l.id] = {
      pecas: ls.reduce((a, x) => a + x.qtd, 0),
      valor: v,
      pctSugerido: verba ? (Number(l.verba || 0) / verba) * 100 : 0,
      pctAtual: valor ? (v / valor) * 100 : 0,
    };
  });
  const somaPct = SUBGRUPOS.reduce((a, sg) => a + (pct[sg] || 0), 0) || 1;
  const porPack: Fw27Totais["porPack"] = {};
  SUBGRUPOS.forEach((sg) => {
    const ls = linhas.filter((x) => x.produto.subgrupo === sg);
    const v = ls.reduce((a, x) => a + x.valor, 0);
    porPack[sg] = {
      pecas: ls.reduce((a, x) => a + x.qtd, 0),
      valor: v,
      pctSugerido: ((pct[sg] || 0) / somaPct) * 100,
      pctAtual: valor ? (v / valor) * 100 : 0,
    };
  });
  return { pecas, valor, verba, porLoja, porPack };
}

/** Datas de entrega (lançamentos), em ordem. */
export const ENTREGAS: string[] = Array.from(new Set(PRODUTOS.map((p) => p.lancamento))).sort();

const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
export const mesDe = (iso: string) => MESES[Number(iso.slice(5, 7)) - 1] || iso;
export const diaMes = (iso: string) => (iso.length >= 10 ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : iso);
