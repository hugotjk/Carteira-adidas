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
const COLS = "ABCDEF";
const txt = (ref: string, s: number, v: string | null | undefined) =>
  v == null || v === "" ? `<c r="${ref}" s="${s}"></c>` : `<c r="${ref}" s="${s}" t="inlineStr"><is><t>${esc(String(v))}</t></is></c>`;
const num = (ref: string, s: number, v: number | null) => (v == null ? `<c r="${ref}" s="${s}"></c>` : `<c r="${ref}" s="${s}" t="n"><v>${v}</v></c>`);
// "Size" em inglês: o site exporta "Tamanho", mas na importação só reconhece "Size" (testado em 22/10/2026).
const CAB6 = ["Sold To", "Article Number", "Requested Delivery Date", "Size", "Observações", "Qty"];
const ESTILO_CAB = [1, 1, 1, 1, 1, 2]; // mesmo do arquivo do site
const ESTILO_DATA = [7, 8, 9]; // cor da coluna de data alterna como no site

/** Linha do arquivo: [soldTo, artigo, data, tamanho, qty]. */
type LinhaCarrinho = [string, string, string, string, number | null];

/** Monta o XML de uma aba no mesmo formato do arquivo exportado pelo site (modelo de 6 colunas, Apache POI). */
function abaXml(cartNome: string, soldTo: string, linhas: LinhaCarrinho[]): string {
  const vazias = (r: number) => ["A", "B", "C", "D"].map((c) => `<c r="${c}${r}" s="3"></c>`).join("");
  const out: string[] = [MODELO_CARRINHO.__sheetHead];
  out.push(`\n<row r="1">\n${vazias(1)}${txt("E1", 1, "Nome do carrinho")}${txt("F1", 3, cartNome)}</row>`);
  out.push(`\n<row r="2" hidden="1">\n</row>\n<row r="3" hidden="1">\n</row>`);
  out.push(`\n<row r="4">\n${vazias(4)}${txt("E4", 1, "Número do Destinatário")}${txt("F4", 3, soldTo)}</row>`);
  out.push(`\n<row r="5">\n${CAB6.map((h, i) => txt(COLS[i] + "5", ESTILO_CAB[i], h)).join("")}</row>`);
  const datas: string[] = [];
  linhas.forEach(([st, art, d, t, q], i) => {
    const r = i + 6;
    if (!datas.includes(d)) datas.push(d);
    const sData = ESTILO_DATA[datas.indexOf(d) % ESTILO_DATA.length];
    out.push(`\n<row r="${r}">\n` + txt(`A${r}`, 3, st) + txt(`B${r}`, 3, art) + txt(`C${r}`, sData, d) + txt(`D${r}`, 3, t) + `<c r="E${r}" s="4"></c>` + num(`F${r}`, 5, q) + `</row>`);
  });
  out.push("\n" + MODELO_CARRINHO.__sheetTail);
  return out.join("").replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:F${linhas.length + 5}"/>`);
}

export function exportarLojaFornecedor(loja: Fw27Loja, linhas: Fw27Linha[], opcoes: { nomeCarrinho?: string } = {}): ResultadoExportacao {
  const soldTo = String(loja.codAdidas || "").trim();
  const daLoja = linhas.filter((x) => x.loja.id === loja.id);
  const porArtigo = new Map(daLoja.map((x) => [x.produto.artigo, x]));
  let pecas = 0;
  const cartNome = opcoes.nomeCarrinho || `FW27 ${loja.nome}`;
  const porAba: Record<string, LinhaCarrinho[]> = { Apparel: [], Hardware: [] };
  Object.entries(F.artigos).forEach(([art, a]) => {
    const x = porArtigo.get(art);
    // Datas: as do calendário do app a partir do lançamento (só compramos de junho em diante).
    const datas = CALENDARIO.filter((d) => podeComprar({ lancamento: x?.produto.lancamento || a.lancamento }, d));
    datas.forEach((d) => {
      a.tamanhos.forEach((t) => {
        const q = Number(x?.gradeEntregas[d]?.[t] || 0);
        pecas += q;
        (porAba[a.aba] = porAba[a.aba] || []).push([soldTo, art, d, t, q > 0 ? q : null]);
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
    "xl/worksheets/sheet1.xml": enc(abaXml(cartNome, soldTo, porAba.Apparel || [])),
    "xl/worksheets/sheet2.xml": enc(abaXml(cartNome, soldTo, porAba.Hardware || [])),
  });
  const foraDoCarrinho = daLoja
    .filter((x) => x.qtd > 0 && !ARTIGOS_NO_CARRINHO.has(x.produto.artigo))
    .map((x) => ({ artigo: x.produto.artigo, pecas: x.qtd }));
  const blob = new Blob([zip], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const nomeArquivo = `FW27_${loja.nome.replace(/[^A-Za-z0-9]+/g, "_")}_${soldTo || "SEM_CODIGO"}.xlsx`;
  return { nomeArquivo, blob, pecas, foraDoCarrinho };
}
