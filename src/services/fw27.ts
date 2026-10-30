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
import vendasPdv from "../data/fw27Vendas.json";
import comparaveis from "../data/fw27Comparaveis.json";
import vendaEstoque from "../data/fw27VendaEstoque.json";
import { lojaCanonica } from "./fw27Lojas";

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
  verba: number; // R$ a preço PDV (sai de verba total × pct; ver aplicarVerbas)
  /** % da verba total para esta loja. Vazio = sugerido (peso nas vendas dos últimos 90 dias). */
  pct?: number;
  /** Código adidas da loja (Sold To / Número do Destinatário no site). */
  codAdidas?: string;
  /** Gestor da loja (vem da lista loja → gestor). Usado para filtrar quem vê o quê. */
  gestor?: string;
}

export type Fw27Status = "rascunho" | "enviado";

export interface Fw27Pedido {
  lojas: Fw27Loja[];
  /** Verba total do pedido (R$ a preço PDV). Vazio = sugerida (vendido jun–out/2026 + 10%). */
  verbaTotal?: number;
  /** % da verba de cada loja que vai para cada subgrupo (PACK). Vazio = padrão. */
  subgrupos: Record<string, number>;
  /** Grade editada: chave "ARTIGO|lojaId" → { tamanho: peças }. */
  itens: Record<string, Record<string, number>>;
  /** Entregas editadas: chave "ARTIGO|lojaId" → { "AAAA-MM-DD": peças }. */
  entregas?: Record<string, Record<string, number>>;
  /** Grade por entrega editada: chave → { data: { tamanho: peças } }. Quando existe, manda em tudo. */
  gradeEntrega?: Record<string, Record<string, Record<string, number>>>;
  /** Grade única: todas as lojas seguem a grade de "todas as lojas" (menos as marcadas em gradePropria). */
  gradeUnica?: boolean;
  /** Lojas que, com grade única ligada, continuam com a grade própria (vendas dela ou o que foi mexido nela). */
  gradePropria?: string[];
  /** Grade única: % de cada tamanho por perfil (MASC, FEM, KIDS…). Vazio = média das lojas pela verba. */
  grade?: Record<string, Record<string, number>>;
  /** % de cada tamanho por perfil só para uma loja: lojaId → perfil → tamanho → %. Manda sobre o de todas. */
  gradeLoja?: Record<string, Record<string, Record<string, number>>>;
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

/** Linha do produto (como no PDV): MASCULINA, FEMININA, INFANTO ou ACESSORIOS. */
export function linhaDe(p: Pick<Fw27Produto, "tipo" | "genero" | "idade">): string {
  if (/SOCK|BAG|CAP|BALL|BUCKET|HEADWEAR|TOWEL/i.test(p.tipo)) return "ACESSORIOS";
  if (p.idade !== "ADULT" || /MINIKIT/i.test(p.tipo)) return "INFANTO";
  return p.genero === "FEMALE" ? "FEMININA" : "MASCULINA";
}

/**
 * Grupo do produto, pela descrição e pelo tipo da AMD: CAMISA TORCEDOR, CAMISA TORCEDOR FEM, CAMISA TORCEDOR INF,
 * CAMISA PRO, FANSHIRT, CAMISETA, SHORT, JAQUETA… (fem/inf no fim, para comparar igual com igual).
 */
export function grupoDe(p: Pick<Fw27Produto, "descricao" | "tipo" | "genero" | "idade">): string {
  const d = p.descricao.toUpperCase();
  const t = p.tipo.toUpperCase();
  let g: string;
  if (/MINIKIT/.test(t) || /MINI KIT/.test(d)) return "MINI KIT";
  if (/SOCK/.test(t) || /MEI[AÃ]O/.test(d)) g = / PRO\b/.test(d) ? "MEIÃO PRO" : "MEIÃO";
  else if (/ARQUIBANCADA|FANSHIRT/.test(d)) g = "FANSHIRT";
  else if (/CROPPED/.test(d)) g = "CROPPED";
  else if (/JERSEY \(SHORT/.test(t) && / PRO\b/.test(d)) g = "CAMISA PRO";
  else if (/JERSEY \(SHORT/.test(t) && /SPECIAL/.test(d)) g = "CAMISA SPECIAL";
  else if (/JERSEY \(SHORT/.test(t) && /\b(RMX|OG)\b/.test(d)) g = "CAMISA ORIGINALS";
  else if (/JERSEY \(SHORT/.test(t)) g = "CAMISA TORCEDOR";
  else if (/SLEEVELESS|TANK/.test(t)) g = "REGATA";
  else if (/T-SHIRT/.test(t)) g = "CAMISETA";
  else if (/SHORTS/.test(t)) g = /BERMUDA/.test(d) ? "BERMUDA" : "SHORT";
  else if (/JACKET/.test(t)) g = "JAQUETA";
  else if (/PANTS/.test(t)) g = "CALÇA";
  else if (/DRESS/.test(t)) g = "VESTIDO";
  else g = t.split(" (")[0] || "OUTROS";
  const l = linhaDe(p);
  return l === "FEMININA" ? `${g} FEM` : l === "INFANTO" ? `${g} INF` : g;
}

// ---------------- Venda × estoque do produto equivalente de 2026 ----------------
const VE = vendaEstoque as { periodo: string; refs: Record<string, string[]>; venda: Record<string, Record<string, Record<string, number>>>; estoque?: Record<string, Record<string, Record<string, number>>> };
export const PERIODO_VENDA_ESTOQUE = VE.periodo;
export const TEM_ESTOQUE = !!VE.estoque;
/** Referências de 2026 usadas como comparação do artigo. */
export const refsComparaveis = (artigo: string) => VE.refs?.[artigo] || [];
const TAM_VE: Record<string, string> = { SM: "S", MD: "M", LG: "L", XXL: "2XL" };
/** Venda e estoque (peças) do equivalente 2026 numa loja (ou na soma das lojas), num tamanho ou em todos. */
export function vendaEstoqueDe(artigo: string, lojas: string[], tamanho?: string): { venda: number; estoque: number | null } {
  const soma = (tab?: Record<string, Record<string, Record<string, number>>>) => {
    let q = 0;
    lojas.forEach((n) => {
      const porTam = tab?.[artigo]?.[nomeBase(n)];
      if (!porTam) return;
      if (tamanho) q += porTam[TAM_VE[tamanho] || tamanho] || 0;
      else Object.values(porTam).forEach((x) => { q += x; });
    });
    return q;
  };
  return { venda: soma(VE.venda), estoque: VE.estoque ? soma(VE.estoque) : null };
}

/** Ordem de exibição dos subgrupos; os que não estiverem aqui vão no fim. */
const ORDEM_SUBGRUPOS = ["HOME", "AWAY", "THIRD", "FANSHIRT", "SPECIAL", "TIROTECH", "POLIAMIDAS", "ICON", "ORIGINALS", "GRAPHIC", "BASQUETE", "BUCKET"];

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

/**
 * Comparáveis (scripts/comparaveis-para-json.py): cada produto da AMD × o equivalente vendido em 2026
 * (masc × masc, fem × fem, inf × inf). Dá o % padrão de cada subgrupo e o peso de cada produto dentro dele.
 */
const COMP = comparaveis as { fonte: string; subgrupos: Record<string, number>; produtos: Record<string, number> };

/** % padrão de cada subgrupo: pelos comparáveis; subgrupo sem comparável, pelo nº de referências. */
export function subgruposPadrao(): Record<string, number> {
  const out: Record<string, number> = {};
  const total = PRODUTOS.length || 1;
  const porRefs = (sg: string) => (PRODUTOS.filter((p) => p.subgrupo === sg).length / total) * 100;
  const comComp = SUBGRUPOS.filter((sg) => Number(COMP.subgrupos?.[sg]) > 0);
  if (!comComp.length) { SUBGRUPOS.forEach((sg) => { out[sg] = porRefs(sg); }); return out; }
  // Subgrupo novo sem comparável entra pelo nº de refs; o resto divide o que sobra pelos comparáveis.
  const semComp = SUBGRUPOS.filter((sg) => !comComp.includes(sg));
  const reservado = semComp.reduce((a, sg) => a + porRefs(sg), 0);
  const somaComp = comComp.reduce((a, sg) => a + Number(COMP.subgrupos[sg]), 0);
  semComp.forEach((sg) => { out[sg] = porRefs(sg); });
  comComp.forEach((sg) => { out[sg] = (Number(COMP.subgrupos[sg]) / somaComp) * (100 - reservado); });
  return out;
}

/** Peso do produto dentro do subgrupo (soma 1). Produto sem comparável recebe a média dos outros. */
export function pesoNoSubgrupo(p: Fw27Produto): number {
  const ps = PRODUTOS.filter((x) => x.subgrupo === p.subgrupo);
  const conhecidos = ps.map((x) => Number(COMP.produtos?.[x.artigo]) || 0).filter((v) => v > 0);
  if (!conhecidos.length) return 1 / (ps.length || 1);
  const media = conhecidos.reduce((a, b) => a + b, 0) / conhecidos.length;
  const peso = (x: Fw27Produto) => Number(COMP.produtos?.[x.artigo]) || media;
  return peso(p) / ps.reduce((a, x) => a + peso(x), 0);
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

// ---------------- Vendas do PDV (DBSleek) ----------------
// src/data/fw27Vendas.json sai de scripts/vendas-para-json.py. Só percentuais, sem R$.

export interface Fw27LojaBase { nome: string; gestor: string; codAdidas: string; pct: number; pct90: number; venda: number }
export const VENDAS = vendasPdv as {
  fonte: string; geradoEm: string;
  lojas: Fw27LojaBase[];
  subgrupos: Record<string, number>;
  curva: Record<string, number>;
  grade: Record<string, Record<string, Record<string, number>>>;
};

/** GAVEA FLA e ADIDAS FLA são a mesma loja. */
const JUNTAR_LOJA: Record<string, string> = { "ADIDAS FLA": "GAVEA FLA" };
export const nomeBase = (nome: string) => { const c = lojaCanonica(nome); return JUNTAR_LOJA[c] || c; };
const LOJA_BASE = new Map(VENDAS.lojas.map((l) => [l.nome, l]));
/** A loja na base de vendas (gestor, código, % das vendas), pelo nome. */
export const lojaNaBase = (nome: string) => LOJA_BASE.get(nomeBase(nome));

// ---------------- Verba ----------------
/** Quanto a verba sugerida passa do vendido (jun–out/2026). */
export const AUMENTO_VERBA = 0.1;

/** Verba total sugerida: o que as lojas do pedido venderam em jun–out/2026 + 10%. */
export function verbaSugerida(pedido: Fw27Pedido): number {
  const vendido = pedido.lojas.reduce((a, l) => a + (lojaNaBase(l.nome)?.venda || 0), 0);
  return Math.round(vendido * (1 + AUMENTO_VERBA));
}
/** Verba total em uso: a digitada ou a sugerida. */
export const verbaTotalDe = (pedido: Fw27Pedido) => (pedido.verbaTotal !== undefined && pedido.verbaTotal !== null ? Number(pedido.verbaTotal) : verbaSugerida(pedido));

/** % sugerido de cada loja: o peso dela nas vendas de ago–out/2026, entre as lojas do pedido (soma 100). */
export function pctLojasSugerido(pedido: Fw27Pedido): Record<string, number> {
  const pesos = pedido.lojas.map((l) => lojaNaBase(l.nome)?.pct90 || 0);
  const soma = pesos.reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  pedido.lojas.forEach((l, i) => { out[l.id] = soma ? (pesos[i] / soma) * 100 : 0; });
  return out;
}
/** % de cada loja em uso: o digitado ou o sugerido. */
export function pctLojas(pedido: Fw27Pedido): Record<string, number> {
  const sug = pctLojasSugerido(pedido);
  const out: Record<string, number> = {};
  pedido.lojas.forEach((l) => { out[l.id] = l.pct !== undefined && l.pct !== null ? Number(l.pct) : sug[l.id]; });
  return out;
}
/** Pedido com a verba de cada loja = verba total × % da loja (o resto do app lê loja.verba). */
export function aplicarVerbas(pedido: Fw27Pedido): Fw27Pedido {
  const total = verbaTotalDe(pedido);
  const pct = pctLojas(pedido);
  return { ...pedido, lojas: pedido.lojas.map((l) => ({ ...l, verba: Math.round((total * (pct[l.id] || 0)) / 100) })) };
}

/** Perfil de grade do produto: masculino, feminino, infantil, mini ou meião. */
export function perfilGrade(p: Fw27Produto): string {
  if (p.tamanhos.length && p.tamanhos.every((t) => /^OSF/.test(t))) return "CABECA";
  if (/MEI[AÃ]O/i.test(p.descricao)) return "MEIAO";
  if (p.tamanhos.some((t) => ["1824", "2-3A", "3-4A", "4-5A", "6-7A"].includes(t))) return "MINI";
  if (p.idade !== "ADULT" || p.tamanhos.some((t) => ["7-8A", "910A", "1112", "1314", "1516"].includes(t))) return "KIDS";
  return p.genero === "FEMALE" ? "FEM" : "MASC";
}
/** Tamanho da AMD no nome usado nas vendas (SM → S, XXL → 2XL…). */
const TAM_VENDA: Record<string, string> = { SM: "S", MD: "M", LG: "L", XXL: "2XL" };

/** Peso de cada tamanho, no meio da grade mais e nas pontas menos (quando não há venda). */
function pesosMeio(p: Fw27Produto): number[] {
  const n = p.tamanhos.length;
  return p.tamanhos.map((_, i) => {
    const d = Math.abs(i - (n - 1) / 2);
    return Math.max(4, Math.round(30 - d * 9));
  });
}

// ---------------- Grade por tamanho ----------------
export const PERFIS_GRADE: { id: string; nome: string }[] = [
  { id: "MASC", nome: "Masculina" }, { id: "FEM", nome: "Feminina" }, { id: "KIDS", nome: "Infantil" },
  { id: "MINI", nome: "Mini kit" }, { id: "MEIAO", nome: "Meião" }, { id: "CABECA", nome: "Boné / bucket" },
];
const ORDEM_TAM = ["1824", "2-3A", "3-4A", "4-5A", "5-6A", "6-7A", "7-8A", "910A", "1112", "1314", "1516", "KXL", "2XS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "OSFC", "OSFY", "OSFW", "OSFM", "OSFL"];
const tamVenda = (t: string) => TAM_VENDA[t] || t;
/** Tamanhos de cada perfil (os que existem nos produtos da AMD), em ordem. */
export const TAMANHOS_PERFIL: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  PRODUTOS.forEach((p) => { const k = perfilGrade(p); out[k] = Array.from(new Set([...(out[k] || []), ...p.tamanhos.map(tamVenda)])); });
  Object.keys(out).forEach((k) => out[k].sort((a, b) => (ORDEM_TAM.indexOf(a) + 1 || 99) - (ORDEM_TAM.indexOf(b) + 1 || 99)));
  return out;
})();

/** % de cada tamanho pelas vendas da loja (2025–2026); loja com pouca venda puxa para a geral. Soma 100. */
export function gradeVendida(perfil: string, lojaNome?: string): Record<string, number> {
  const tab = VENDAS.grade[perfil];
  const t = tab && ((lojaNome && tab[nomeBase(lojaNome)]) || tab._todas);
  const tams = TAMANHOS_PERFIL[perfil] || [];
  const pesos = tams.map((x) => Number(t?.[x] || 0));
  const soma = pesos.reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  tams.forEach((x, i) => { out[x] = soma ? (pesos[i] / soma) * 100 : 100 / (tams.length || 1); });
  return out;
}

/** Loja e pedido, para a grade levar em conta o que foi mexido na Representatividade. */
export interface GradeCtx { pedido?: Fw27Pedido; loja?: Pick<Fw27Loja, "id" | "nome"> }

/** Grade própria da loja: a mexida nela ou, se não, o que ela vendeu. */
export function gradePropriaDaLoja(perfil: string, ctx: GradeCtx = {}): Record<string, number> {
  return (ctx.loja && ctx.pedido?.gradeLoja?.[ctx.loja.id]?.[perfil]) || gradeVendida(perfil, ctx.loja?.nome);
}
/** Média das grades próprias das lojas do pedido, pesada pela verba. */
export function gradeMedia(perfil: string, pedido?: Fw27Pedido): Record<string, number> {
  const lojas = pedido?.lojas || [];
  if (!lojas.length) return gradeVendida(perfil);
  const tams = TAMANHOS_PERFIL[perfil] || [];
  const somaV = lojas.reduce((a, l) => a + (Number(l.verba) || 0), 0);
  const out: Record<string, number> = {};
  tams.forEach((t) => { out[t] = 0; });
  lojas.forEach((l) => {
    const g = gradePropriaDaLoja(perfil, { pedido, loja: l });
    const w = somaV ? (Number(l.verba) || 0) / somaV : 1 / lojas.length;
    tams.forEach((t) => { out[t] += (g[t] || 0) * w; });
  });
  return out;
}
/** Grade única ligada? (pedido antigo com grade de todas mexida conta como ligada) */
export const gradeUnicaLigada = (pedido?: Fw27Pedido) => (pedido?.gradeUnica ?? !!(pedido?.grade && Object.keys(pedido.grade).length));
/** Grade de "todas as lojas": a digitada ou a média. */
const cacheMedia = new WeakMap<Fw27Pedido, Record<string, Record<string, number>>>();
export function gradeTodas(perfil: string, pedido?: Fw27Pedido): Record<string, number> {
  if (pedido?.grade?.[perfil]) return pedido.grade[perfil];
  if (!pedido) return gradeMedia(perfil);
  // Média calculada uma vez por versão do pedido (o cálculo passa por ela para cada produto × loja).
  let c = cacheMedia.get(pedido);
  if (!c) { c = {}; cacheMedia.set(pedido, c); }
  return (c[perfil] = c[perfil] || gradeMedia(perfil, pedido));
}
/** A loja segue a grade única? */
export const segueGradeUnica = (pedido: Fw27Pedido | undefined, lojaId?: string) => gradeUnicaLigada(pedido) && !(lojaId && pedido?.gradePropria?.includes(lojaId));

/** % de cada tamanho em uso na loja: a grade única (se ligada e a loja segue) ou a própria. */
export function gradeDaLoja(perfil: string, ctx: GradeCtx = {}): Record<string, number> {
  if (segueGradeUnica(ctx.pedido, ctx.loja?.id)) return gradeTodas(perfil, ctx.pedido);
  return gradePropriaDaLoja(perfil, ctx);
}

/** Peso de cada tamanho do produto, pela grade da loja naquele perfil (masc, fem, infantil…). */
export function pesosGrade(p: Fw27Produto, ctx: GradeCtx = {}): number[] {
  const t = gradeDaLoja(perfilGrade(p), ctx);
  const pesos = p.tamanhos.map((x) => Number(t[tamVenda(x)] || 0));
  return pesos.some((x) => x > 0) ? pesos : pesosMeio(p);
}

export function gradeDe(p: Fw27Produto, total: number, ctx: GradeCtx = {}): Record<string, number> {
  const qs = dividir(total, pesosGrade(p, ctx));
  const out: Record<string, number> = {};
  p.tamanhos.forEach((t, i) => { out[t] = qs[i]; });
  return out;
}

const somaGrade = (g: Record<string, number>) => Object.values(g).reduce((a, b) => a + (Number(b) || 0), 0);

/** Peças sugeridas (sem edição) de um produto numa loja. */
export function sugeridoLoja(pedido: Fw27Pedido, p: Fw27Produto, loja: Fw27Loja, pct = pctSubgrupos(pedido)): number {
  const dinheiro = ((Number(loja.verba || 0) * (pct[p.subgrupo] || 0)) / 100) * pesoNoSubgrupo(p);
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
      const grade = editada ? { ...gradeDe(p, 0), ...editada } : gradeDe(p, sugerido, { pedido, loja: l });
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
/**
 * Pode comprar nesta data? No lançamento (ou 01/06) e depois só nos dias 01 e 15,
 * com pelo menos 14 dias do lançamento — no máximo 2 entregas por mês.
 * Ex.: lança 30/07 → 30/07, 15/08, 01/09…; lança 01/08 → 01/08, 15/08…
 */
export function podeComprar(p: { lancamento: string }, data: string): boolean {
  const inicio = inicioCompra(p);
  if (data > ULTIMA_DATA || data < inicio) return false;
  if (data === inicio) return true;
  return dataRegular(data) && diasEntre(inicio, data) >= DIAS_MIN_ENTRE_ENTREGAS;
}
const DIAS_MIN_ENTRE_ENTREGAS = 14;
const PESO_EXTRA_LANCAMENTO = 1.5;

const dataUTC = (iso: string) => new Date(iso + "T00:00:00Z");
const isoDe = (d: Date) => d.toISOString().slice(0, 10);
const diasEntre = (a: string, b: string) => Math.round((dataUTC(b).getTime() - dataUTC(a).getTime()) / 86400000);
const diasNoMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();

/** Curva padrão: vendas de 2026 (ano de Copa, parecido com 2027). Nov/2026 estimado. */
/**
 * Curva padrão de compra por mês, definida pelo Hugo (30/10) olhando venda × recebimento de 2026:
 * venda jun 13 · jul 12 · ago 28 · set 20 · out 16 · nov 10 | recebimento 26 · 38 · 14 · 9 · 3 · 10.
 */
export const CURVA_SUGERIDA: Record<string, number> = { "06": 12, "07": 33, "08": 20, "09": 15, "10": 10, "11": 10 };
export const curvaPadrao = (): Record<string, number> => {
  const out: Record<string, number> = {};
  MESES_CURVA.forEach((m) => { out[m] = CURVA_SUGERIDA[m] ?? 0; });
  return out;
};

/** Peso de cada mês na curva de compra (o salvo, ou o padrão das vendas de 2026). */
export function curvaDe(pedido: Fw27Pedido): Record<string, number> {
  const salvo = pedido.curva || {};
  const out: Record<string, number> = {};
  if (!MESES_CURVA.some((m) => salvo[m] !== undefined)) return curvaPadrao();
  MESES_CURVA.forEach((m) => { out[m] = Number(salvo[m] || 0); });
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
export function gradeProporcional(p: Fw27Produto, base: Record<string, number>, total: number, ctx: GradeCtx = {}): Record<string, number> {
  const pesos = p.tamanhos.map((t) => Number(base[t] || 0));
  if (!pesos.some((x) => x > 0)) return gradeDe(p, total, ctx);
  const qs = dividir(total, pesos);
  const out: Record<string, number> = {};
  p.tamanhos.forEach((t, i) => { out[t] = qs[i]; });
  return out;
}
