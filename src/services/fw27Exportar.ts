/**
 * Exportação no formato do carrinho do site da adidas (um arquivo por loja).
 * Mesmo layout do arquivo do site: abas Apparel e Hardware, cabeçalho nas linhas 1–5,
 * uma linha por artigo × data de entrega × tamanho, com a quantidade na coluna K (Qty).
 * Do carrinho do site vêm só nome, EAN, preço, aba e data de lançamento; as datas são as do app.
 */
import { zipSync, strToU8 } from "fflate";
import { MODELO_CARRINHO } from "../data/fw27CarrinhoModelo";
import fornecedor from "../data/fw27Fornecedor.json";
import { Fw27Linha, Fw27Loja, CALENDARIO, podeComprar } from "./fw27";

interface ArtigoFornecedor { nome: string; aba: string; lancamento: string; preco: string; tamanhos: string[]; eans: Record<string, string | null> }
const F = fornecedor as { artigos: Record<string, ArtigoFornecedor> };

export const ARTIGOS_NO_CARRINHO = new Set(Object.keys(F.artigos));

export interface ResultadoExportacao {
  nomeArquivo: string;
  blob: Blob;
  pecas: number;
  /** Artigos com quantidade que não estão no carrinho do site (não vão no arquivo). */
  foraDoCarrinho: { artigo: string; pecas: number }[];
}


const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const COLS = "ABCDEFGHIJK";
const txt = (ref: string, s: number, v: string | null | undefined) =>
  v == null || v === "" ? `<c r="${ref}" s="${s}"></c>` : `<c r="${ref}" s="${s}" t="inlineStr"><is><t>${esc(String(v))}</t></is></c>`;
const num = (ref: string, s: number, v: number | null) => (v == null ? `<c r="${ref}" s="${s}"></c>` : `<c r="${ref}" s="${s}" t="n"><v>${v}</v></c>`);
// Modelo de 11 colunas (com nome, EAN, lançamento e PDV), importado com sucesso no site em 22/10/2026.
// "Size" em inglês: o site exporta "Tamanho", mas na importação só reconhece "Size".
const CABECALHO = ["Sold To", "Article Number", "Article Name", "EAN", "Data de lançamento", "Requested Delivery Date", "Size", "PDV", "Total Qty", "Observações", "Qty"];
const ESTILO_CAB = [1, 1, 2, 2, 2, 1, 1, 2, 2, 1, 2]; // mesmo do arquivo do site
const ESTILO_DATA = [7, 8, 9]; // cor da coluna de data alterna como no site

/** Linha do arquivo: [soldTo, artigo, nome, ean, lançamento, data, tamanho, pdv, qty]. */
type LinhaCarrinho = [string, string, string, string | null, string, string, string, string, number | null];

/** Monta o XML de uma aba no mesmo formato do arquivo exportado pelo site (Apache POI). */
function abaXml(cartNome: string, soldTo: string, linhas: LinhaCarrinho[], primeira: boolean): string {
  const vazias = (r: number) => Array.from({ length: 9 }, (_, i) => `<c r="${COLS[i]}${r}" s="3"></c>`).join("");
  const out: string[] = [primeira ? MODELO_CARRINHO.__sheetHead : MODELO_CARRINHO.__sheetHead.replace(' tabSelected="true"', "")];
  out.push(`\n<row r="1">\n${vazias(1)}${txt("J1", 1, "Nome do carrinho")}${txt("K1", 3, cartNome)}</row>`);
  out.push(`\n<row r="2" hidden="1">\n</row>\n<row r="3" hidden="1">\n</row>`);
  out.push(`\n<row r="4">\n${vazias(4)}${txt("J4", 1, "Número do Destinatário")}${txt("K4", 3, soldTo)}</row>`);
  out.push(`\n<row r="5">\n${CABECALHO.map((h, i) => txt(COLS[i] + "5", ESTILO_CAB[i], h)).join("")}</row>`);
  const datas: string[] = [];
  linhas.forEach(([st, art, nome, ean, lanc, d, t, pdv, q], i) => {
    const r = i + 6;
    if (!datas.includes(d)) datas.push(d);
    const sData = ESTILO_DATA[datas.indexOf(d) % ESTILO_DATA.length];
    out.push(`\n<row r="${r}">\n` + txt(`A${r}`, 3, st) + txt(`B${r}`, 3, art) + txt(`C${r}`, 3, nome) + txt(`D${r}`, 3, ean) + txt(`E${r}`, 3, lanc) +
      txt(`F${r}`, sData, d) + txt(`G${r}`, 3, t) + txt(`H${r}`, 3, pdv) + `<c r="I${r}" s="3" t="n"><v>0.0</v></c><c r="J${r}" s="4"></c>` + num(`K${r}`, 5, q) + `</row>`);
  });
  out.push("\n" + MODELO_CARRINHO.__sheetTail);
  return out.join("").replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:K${linhas.length + 5}"/>`);
}

/** Quantidade de um artigo × data do calendário × tamanho. */
type Qtd = (artigo: string, data: string, tamanho: string) => number;

/**
 * Monta o arquivo do carrinho. Datas: as do calendário do app a partir do lançamento (só compramos de junho em diante)
 * e qualquer data que já tenha peça (para não sumir nada digitado antes de a regra mudar).
 */
function montarCarrinho(soldTo: string, cartNome: string, qtd: Qtd, lancamentoDe: (artigo: string) => string | undefined, datasTrocadas?: Record<string, string>): { blob: Blob; pecas: number } {
  let pecas = 0;
  const porAba: Record<string, LinhaCarrinho[]> = { Apparel: [], Hardware: [] };
  Object.entries(F.artigos).forEach(([art, a]) => {
    const datas = CALENDARIO.filter((d) => podeComprar({ lancamento: lancamentoDe(art) || a.lancamento }, d)
      || a.tamanhos.some((t) => qtd(art, d, t) > 0));
    datas.forEach((d) => {
      a.tamanhos.forEach((t) => {
        const q = qtd(art, d, t);
        pecas += q;
        (porAba[a.aba] = porAba[a.aba] || []).push([soldTo, art, a.nome, a.eans[t] ?? null, a.lancamento, datasTrocadas?.[d] || d, t, a.preco, q > 0 ? q : null]);
      });
    });
  });
  const enc = (s: string) => strToU8(s);
  const zip = zipSync({
    "[Content_Types].xml": enc(MODELO_CARRINHO["[Content_Types].xml"]),
    "_rels/.rels": enc(MODELO_CARRINHO["_rels/.rels"]),
    "docProps/app.xml": enc(MODELO_CARRINHO["docProps/app.xml"]),
    "docProps/core.xml": enc(MODELO_CARRINHO["docProps/core.xml"].replace(/<dcterms:created[^>]*>[^<]*<\/dcterms:created>/, `<dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created>`)),
    "xl/_rels/workbook.xml.rels": enc(MODELO_CARRINHO["xl/_rels/workbook.xml.rels"]),
    "xl/sharedStrings.xml": enc(MODELO_CARRINHO["xl/sharedStrings.xml"]),
    "xl/styles.xml": enc(MODELO_CARRINHO["xl/styles.xml"]),
    "xl/workbook.xml": enc(MODELO_CARRINHO["xl/workbook.xml"]),
    "xl/worksheets/sheet1.xml": enc(abaXml(cartNome, soldTo, porAba.Apparel || [], true)),
    "xl/worksheets/sheet2.xml": enc(abaXml(cartNome, soldTo, porAba.Hardware || [], false)),
  });
  return { blob: new Blob([zip], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), pecas };
}

export const nomeArquivoLoja = (lojaNome: string, soldTo: string) => `FW27_${lojaNome.replace(/[^A-Za-z0-9]+/g, "_")}_${soldTo || "SEM_CODIGO"}.xlsx`;

export function exportarLojaFornecedor(loja: Fw27Loja, linhas: Fw27Linha[], opcoes: { nomeCarrinho?: string; datas?: Record<string, string> } = {}): ResultadoExportacao {
  const soldTo = String(loja.codAdidas || "").trim();
  const daLoja = linhas.filter((x) => x.loja.id === loja.id);
  const porArtigo = new Map(daLoja.map((x) => [x.produto.artigo, x]));
  const { blob, pecas } = montarCarrinho(soldTo, opcoes.nomeCarrinho || `FW27 ${loja.nome}`,
    (art, d, t) => Number(porArtigo.get(art)?.gradeEntregas[d]?.[t] || 0),
    (art) => porArtigo.get(art)?.produto.lancamento, opcoes.datas);
  const foraDoCarrinho = daLoja
    .filter((x) => x.qtd > 0 && !ARTIGOS_NO_CARRINHO.has(x.produto.artigo))
    .map((x) => ({ artigo: x.produto.artigo, pecas: x.qtd }));
  return { nomeArquivo: nomeArquivoLoja(loja.nome, soldTo), blob, pecas, foraDoCarrinho };
}

/**
 * Refaz o arquivo do site a partir do que ficou guardado no histórico (o mesmo que o franqueado baixou).
 * itens: [artigo, data de entrega (já trocada), tamanho, peças].
 */
export function arquivoClickDeItens(lojaNome: string, soldTo: string, itens: [string, string, string, number][], datasTrocadas?: Record<string, string>, lancamentoDe: (artigo: string) => string | undefined = () => undefined): ResultadoExportacao {
  const q = new Map<string, number>();
  itens.forEach(([a, d, t, n]) => q.set(`${a}|${d}|${t}`, (q.get(`${a}|${d}|${t}`) || 0) + n));
  const { blob, pecas } = montarCarrinho(soldTo, `FW27 ${lojaNome}`, (a, d, t) => q.get(`${a}|${datasTrocadas?.[d] || d}|${t}`) || 0, lancamentoDe, datasTrocadas);
  const fora = new Map<string, number>();
  itens.forEach(([a, , , n]) => { if (!ARTIGOS_NO_CARRINHO.has(a)) fora.set(a, (fora.get(a) || 0) + n); });
  return { nomeArquivo: nomeArquivoLoja(lojaNome, soldTo), blob, pecas, foraDoCarrinho: Array.from(fora, ([artigo, pecas]) => ({ artigo, pecas })) };
}

/** Junta vários arquivos num .zip (baixar todas as lojas de uma vez). */
export async function zipArquivos(arquivos: { nome: string; blob: Blob }[]): Promise<Blob> {
  const conteudo: Record<string, Uint8Array> = {};
  for (const a of arquivos) {
    let nome = a.nome, i = 2;
    while (conteudo[nome]) nome = a.nome.replace(/(\.[^.]+)$/, `_${i++}$1`);
    conteudo[nome] = new Uint8Array(await a.blob.arrayBuffer());
  }
  return new Blob([zipSync(conteudo)], { type: "application/zip" });
}
