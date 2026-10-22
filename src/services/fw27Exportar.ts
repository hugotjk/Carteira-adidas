/**
 * Exportação no formato do carrinho do site da adidas (um arquivo por loja).
 * Mesmo layout do arquivo baixado do site: abas Apparel e Hardware, cabeçalho nas linhas 1–5,
 * uma linha por artigo × data de entrega × tamanho, com a quantidade na coluna K (Qty).
 */
import * as XLSX from "xlsx-js-style";
import fornecedor from "../data/fw27Fornecedor.json";
import { Fw27Linha, Fw27Loja } from "./fw27";

interface ArtigoFornecedor { nome: string; aba: string; lancamento: string; preco: string; tamanhos: string[]; eans: Record<string, string | null> }
const F = fornecedor as { datas: string[]; artigos: Record<string, ArtigoFornecedor> };

export const ARTIGOS_NO_CARRINHO = new Set(Object.keys(F.artigos));

export interface ResultadoExportacao {
  nomeArquivo: string;
  blob: Blob;
  pecas: number;
  /** Artigos com quantidade que não estão no carrinho do site (não vão no arquivo). */
  foraDoCarrinho: { artigo: string; pecas: number }[];
}

const CABECALHO = ["Sold To", "Article Number", "Article Name", "EAN", "Data de lançamento", "Requested Delivery Date", "Tamanho", "PDV", "Total Qty", "Observações", "Qty"];

export function exportarLojaFornecedor(loja: Fw27Loja, linhas: Fw27Linha[]): ResultadoExportacao {
  const soldTo = String(loja.codAdidas || "").trim();
  const daLoja = linhas.filter((x) => x.loja.id === loja.id);
  const porArtigo = new Map(daLoja.map((x) => [x.produto.artigo, x]));
  const wb = XLSX.utils.book_new();
  let pecas = 0;
  const abas = Array.from(new Set(Object.values(F.artigos).map((a) => a.aba)));
  abas.forEach((aba) => {
    const aoa: any[][] = [
      [null, null, null, null, null, null, null, null, null, "Nome do carrinho", `FW27 ${loja.nome}`],
      [], [],
      [null, null, null, null, null, null, null, null, null, "Número do Destinatário", soldTo],
      CABECALHO,
    ];
    Object.entries(F.artigos).filter(([, a]) => a.aba === aba).forEach(([art, a]) => {
      const x = porArtigo.get(art);
      F.datas.forEach((d) => {
        a.tamanhos.forEach((t) => {
          const q = Number(x?.gradeEntregas[d]?.[t] || 0);
          pecas += q;
          aoa.push([soldTo, art, a.nome, a.eans[t] ?? null, a.lancamento, d, t, a.preco, 0, null, q > 0 ? q : null]);
        });
      });
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [12, 14, 34, 16, 18, 22, 10, 9, 9, 22, 28].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, aba);
  });
  const foraDoCarrinho = daLoja
    .filter((x) => x.qtd > 0 && !ARTIGOS_NO_CARRINHO.has(x.produto.artigo))
    .map((x) => ({ artigo: x.produto.artigo, pecas: x.qtd }));
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const nomeArquivo = `FW27_${loja.nome.replace(/[^A-Za-z0-9]+/g, "_")}_${soldTo || "SEM_CODIGO"}.xlsx`;
  return { nomeArquivo, blob, pecas, foraDoCarrinho };
}
