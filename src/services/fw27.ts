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
  /** Código adidas da loja (Sold To / Número do Destinatário no site). */
  codAdidas?: string;
  /** Gestor da loja (vem da lista loja → gestor). Usado para filtrar quem vê o quê. */
  gestor?: string;
}

export type Fw27Status = "rascunho" | "enviado";

export interface Fw27Pedido {
  lojas: Fw27Loja[];
  /** % da verba de cada loja que vai para cada subgrupo (PACK). Vazio = padrão. */
  subgrupos: Record<string, number>;
  /** Grade editada: chave "ARTIGO|lojaId" → { tamanho: peças }. */
  itens: Record<string, Record<string, number>>;
  /** Entregas editadas: chave "ARTIGO|lojaId" → { "AAAA-MM-DD": peças }. */
  entregas?: Record<string, Record<string, number>>;
  /** Grade por entrega editada: chave → { data: { tamanho: peças } }. Quando existe, manda em tudo. */
  gradeEntrega?: Record<string, Record<string, Record<string, number>>>;
  /** Curva de compra: peso de cada mês ("05" … "11"). Vazio = todos iguais. */
  curva?: Record<string, number>;
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
  /** Peças por data de entrega. */
  entregas: Record<string, number>;
  /** Peças por data e tamanho (fecha com a grade e com as entregas). */
  gradeEntregas: Record<string, Record<string, number>>;
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
      const k = chaveItem(p.artigo, l.id);
      const matriz = pedido.gradeEntrega?.[k];
      if (matriz) {
        // Grade por entrega editada: as somas saem dela.
        const datas = Array.from(new Set([...datasEntrega(p), ...Object.keys(matriz)])).sort();
        const ge: Record<string, Record<string, number>> = {};
        const g: Record<string, number> = {};
        const ent: Record<string, number> = {};
        p.tamanhos.forEach((t) => { g[t] = 0; });
        datas.forEach((d) => {
          ge[d] = {};
          ent[d] = 0;
          p.tamanhos.forEach((t) => { const q = Number(matriz[d]?.[t] || 0); ge[d][t] = q; g[t] += q; ent[d] += q; });
        });
        const q = somaGrade(g);
        linhas.push({ produto: p, loja: l, sugerido, grade: g, qtd: q, valor: q * p.preco, editado: true, entregas: ent, gradeEntregas: ge });
        return;
      }
      const qtd = somaGrade(grade);
      const entregas = entregasDaLinha(pedido, p, l.id, qtd);
      const editado = !!editada || !!pedido.entregas?.[k];
      linhas.push({ produto: p, loja: l, sugerido, grade, qtd, valor: qtd * p.preco, editado, entregas, gradeEntregas: gradePorEntrega(p, grade, entregas) });
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

/** Datas de lançamento, em ordem. */
export const LANCAMENTOS: string[] = Array.from(new Set(PRODUTOS.map((p) => p.lancamento))).sort();

const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
export const mesDe = (iso: string) => MESES[Number(iso.slice(5, 7)) - 1] || iso;
export const diaMes = (iso: string) => (iso.length >= 10 ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : iso);

// ============================ ENTREGAS ============================
//
// Regras (Hugo, 22/10/2026):
// - A 1ª entrega é sempre no lançamento (ou 01/06, se lançar antes; não existe compra em maio).
// - Depois, dias 01 e 15 de cada mês, até 15/11 (no máx. 2 por mês na sugestão).
// - Qualquer data a partir do lançamento pode ser digitada; antes dele fica bloqueada.
// - Cada entrega cobre as vendas até a próxima; o peso vem da curva de compra por mês.
// - O lançamento leva um peso extra (abastecer a loja).
// - Entrega com menos peças que o nº de tamanhos é pulada e as peças vão para a entrega anterior,
//   para a grade não ficar quebrada.

const PRODUTOS_BASE = PRODUTOS;
export const MESES_CURVA = ["06", "07", "08", "09", "10", "11"];
/** Não existe compra antes de junho: produto que lança antes começa a comprar em 01/06. */
const PRIMEIRO_DIA_COMPRA = "-06-01";
const ANO = (PRODUTOS_BASE[0]?.lancamento || "2027").slice(0, 4);
const ULTIMA_DATA = `${ANO}-11-15`;
/** Dias 01 e 15 de junho a novembro. */
const DATAS_REGULARES: string[] = MESES_CURVA.flatMap((m) => [`${ANO}-${m}-01`, `${ANO}-${m}-15`]);
/** Colunas de entrega: dias 01 e 15 + os lançamentos que caem fora deles (30/07, 06/08…). */
export const CALENDARIO: string[] = Array.from(new Set([
  ...DATAS_REGULARES,
  ...PRODUTOS_BASE.map((p) => (p.lancamento < `${ANO}${PRIMEIRO_DIA_COMPRA}` ? `${ANO}${PRIMEIRO_DIA_COMPRA}` : p.lancamento)).filter((d) => d <= ULTIMA_DATA),
])).sort();
const dataRegular = (d: string) => DATAS_REGULARES.includes(d);

/** Primeira data em que dá para comprar o produto: o lançamento (ou 01/06, se lançar antes). */
export function inicioCompra(p: { lancamento: string }): string {
  const min = p.lancamento.slice(0, 4) + PRIMEIRO_DIA_COMPRA;
  return p.lancamento < min ? min : p.lancamento;
}
/** Pode comprar nesta data? Só bloqueia antes do lançamento. */
export function podeComprar(p: { lancamento: string }, data: string): boolean {
  return data >= inicioCompra(p) && data <= ULTIMA_DATA;
}
const DIAS_MIN_ENTRE_ENTREGAS = 7;
const PESO_EXTRA_LANCAMENTO = 1.5;

const dataUTC = (iso: string) => new Date(iso + "T00:00:00Z");
const isoDe = (d: Date) => d.toISOString().slice(0, 10);
const diasEntre = (a: string, b: string) => Math.round((dataUTC(b).getTime() - dataUTC(a).getTime()) / 86400000);
const diasNoMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();

/** Peso de cada mês na curva de compra (padrão: todos iguais). */
export function curvaDe(pedido: Fw27Pedido): Record<string, number> {
  const salvo = pedido.curva || {};
  const out: Record<string, number> = {};
  const temAlgum = MESES_CURVA.some((m) => salvo[m] !== undefined);
  MESES_CURVA.forEach((m) => { out[m] = temAlgum ? Number(salvo[m] || 0) : 100 / MESES_CURVA.length; });
  return out;
}

/** Datas de entrega sugeridas: a 1ª data a partir do lançamento, depois as datas regulares do site. */
export function datasEntrega(p: Fw27Produto): string[] {
  const limite = [ULTIMA_DATA, p.fim].filter(Boolean).sort()[0];
  const inicio = inicioCompra(p);
  const out = [inicio];
  CALENDARIO.forEach((dt) => {
    if (dt <= inicio || dt > limite || !dataRegular(dt)) return;
    if (diasEntre(out[out.length - 1], dt) < DIAS_MIN_ENTRE_ENTREGAS) return;
    out.push(dt);
  });
  return out;
}

/** Peso de cada entrega: soma da curva diária dos dias que ela cobre (até a próxima entrega). */
export function pesosEntrega(pedido: Fw27Pedido, p: Fw27Produto, datas = datasEntrega(p)): number[] {
  const curva = curvaDe(pedido);
  const fimVenda = p.fim && p.fim > datas[datas.length - 1] ? p.fim : isoDe(new Date(dataUTC(datas[datas.length - 1]).getTime() + 15 * 86400000));
  return datas.map((d, i) => {
    const ate = i + 1 < datas.length ? datas[i + 1] : fimVenda;
    let peso = 0;
    for (let t = dataUTC(d).getTime(); t < dataUTC(ate).getTime(); t += 86400000) {
      const dia = new Date(t);
      const mm = String(dia.getUTCMonth() + 1).padStart(2, "0");
      peso += (curva[mm] || 0) / diasNoMes(dia.getUTCFullYear(), dia.getUTCMonth() + 1);
    }
    if (i === 0) peso *= PESO_EXTRA_LANCAMENTO;
    return peso;
  });
}

/** Junta entregas pequenas demais na entrega anterior (de trás para frente). */
export function juntarPequenas(qs: number[], minimo: number): number[] {
  const out = qs.slice();
  for (let i = out.length - 1; i > 0; i--) {
    if (out[i] > 0 && out[i] < minimo) { out[i - 1] += out[i]; out[i] = 0; }
  }
  return out;
}

/**
 * Divide as peças entre as entregas. Se não der para todas terem o mínimo,
 * fica com menos entregas, espalhadas pela curva (o lançamento sempre fica),
 * e cada uma cobre também as datas puladas depois dela.
 */
export function dividirEntregas(qtd: number, pesos: number[], minimo: number): number[] {
  const n = pesos.length;
  if (!n) return [];
  const min = Math.max(1, minimo);
  const total = pesos.reduce((a, b) => a + b, 0) || 1;
  const espalhar = (k: number) => {
    if (k >= n) return dividir(qtd, pesos);
    const manter = [0];
    let acum = 0;
    for (let i = 0; i < n && manter.length < k; i++) {
      if (i > 0 && acum / total >= manter.length / k) manter.push(i);
      acum += pesos[i];
    }
    const juntos = pesos.map(() => 0);
    manter.forEach((ini, j) => {
      const fim = j + 1 < manter.length ? manter[j + 1] : n;
      for (let i = ini; i < fim; i++) juntos[ini] += pesos[i];
    });
    return dividir(qtd, juntos);
  };
  // Começa com o máximo de entregas possível e vai tirando até todas terem o mínimo.
  for (let k = Math.max(1, Math.min(n, Math.floor(qtd / min))); k >= 1; k--) {
    const qs = espalhar(k);
    if (qs.every((q) => q === 0 || q >= min)) return qs;
  }
  return espalhar(1);
}

/** Entregas de uma loja: as editadas (se batem com o total) ou a divisão automática. */
export function entregasDaLinha(pedido: Fw27Pedido, p: Fw27Produto, lojaId: string, qtd: number): Record<string, number> {
  const datas = datasEntrega(p);
  const editadas = pedido.entregas?.[chaveItem(p.artigo, lojaId)];
  if (editadas) {
    const soma = Object.values(editadas).reduce((a, b) => a + (Number(b) || 0), 0);
    if (soma === qtd) {
      const out: Record<string, number> = {};
      datas.forEach((d) => { out[d] = Number(editadas[d] || 0); });
      Object.keys(editadas).forEach((d) => { if (!(d in out)) out[d] = Number(editadas[d] || 0); });
      return out;
    }
  }
  const qs = dividirEntregas(qtd, pesosEntrega(pedido, p, datas), Math.max(1, p.tamanhos.length));
  const out: Record<string, number> = {};
  datas.forEach((d, i) => { out[d] = qs[i]; });
  return out;
}

/** Divide a grade da loja entre as entregas, fechando exatamente por tamanho e por entrega. */
export function gradePorEntrega(p: Fw27Produto, grade: Record<string, number>, entregas: Record<string, number>): Record<string, Record<string, number>> {
  const datas = Object.keys(entregas).sort();
  const resto = p.tamanhos.map((t) => Number(grade[t] || 0));
  const out: Record<string, Record<string, number>> = {};
  datas.forEach((d, i) => {
    const q = Number(entregas[d] || 0);
    const alvo = i === datas.length - 1 ? resto.slice() : dividir(Math.min(q, resto.reduce((a, b) => a + b, 0)), resto);
    out[d] = {};
    p.tamanhos.forEach((t, k) => { out[d][t] = alvo[k]; resto[k] -= alvo[k]; });
  });
  return out;
}

/** Redistribui um total mantendo o formato de uma grade (editada ou não). */
export function gradeProporcional(p: Fw27Produto, base: Record<string, number>, total: number): Record<string, number> {
  const pesos = p.tamanhos.map((t) => Number(base[t] || 0));
  if (!pesos.some((x) => x > 0)) return gradeDe(p, total);
  const qs = dividir(total, pesos);
  const out: Record<string, number> = {};
  p.tamanhos.forEach((t, i) => { out[t] = qs[i]; });
  return out;
}
