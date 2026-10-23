/**
 * Histórico da Sugestão FW27: tudo que foi baixado para o site ou fechado no app fica guardado,
 * para comparar depois com a carteira.
 * - Firebase: coleção "fw27Historico" (um documento por registro).
 * - Cópia no aparelho (IndexedDB), caso o Firebase recuse ou a internet caia.
 */
import * as XLSX from "xlsx-js-style";
import { get, set } from "idb-keyval";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Fw27Linha, Fw27Pedido } from "./fw27";

export type TipoRegistro = "exportação" | "fechamento";

/** Item guardado: [loja, código adidas, artigo, descrição, data de entrega, tamanho, peças, preço PDV]. */
export type ItemRegistro = [string, string, string, string, string, string, number, number];

export interface Fw27Registro {
  id: string;
  quando: string; // ISO
  tipo: TipoRegistro;
  por: string; // e-mail de quem fez
  porUid?: string; // login de quem fez
  lojas: string[];
  /** Gestores das lojas do registro: define quem vê (login do gestor, do sócio da loja e o master). */
  gestores?: string[];
  pecas: number;
  valor: number;
  itens: ItemRegistro[];
}

const COLECAO = "fw27Historico";
const CHAVE_LOCAL = "fw27-historico";

/** Monta o registro do que está no pedido agora (todas as lojas, ou só as indicadas). */
export function montarRegistro(tipo: TipoRegistro, por: string, pedido: Fw27Pedido, linhas: Fw27Linha[], lojaIds?: string[], porUid?: string): Fw27Registro {
  const ids = new Set(lojaIds || pedido.lojas.map((l) => l.id));
  const itens: ItemRegistro[] = [];
  linhas.filter((x) => ids.has(x.loja.id)).forEach((x) => {
    Object.keys(x.gradeEntregas).sort().forEach((d) => {
      x.produto.tamanhos.forEach((t) => {
        const q = Number(x.gradeEntregas[d]?.[t] || 0);
        if (q > 0) itens.push([x.loja.nome, x.loja.codAdidas || "", x.produto.artigo, x.produto.descricao, d, t, q, x.produto.preco]);
      });
    });
  });
  const agora = new Date().toISOString();
  return {
    id: agora.replace(/[^0-9]/g, "").slice(0, 14) + "-" + Math.random().toString(36).slice(2, 7),
    quando: agora,
    tipo,
    por,
    porUid: porUid || "",
    lojas: pedido.lojas.filter((l) => ids.has(l.id)).map((l) => l.nome),
    gestores: Array.from(new Set(pedido.lojas.filter((l) => ids.has(l.id)).map((l) => (l.gestor || "").toUpperCase()).filter(Boolean))),
    pecas: itens.reduce((a, i) => a + i[6], 0),
    valor: itens.reduce((a, i) => a + i[6] * i[7], 0),
    itens,
  };
}

async function lerLocal(): Promise<Fw27Registro[]> {
  try { return ((await get(CHAVE_LOCAL)) as Fw27Registro[]) || []; } catch { return []; }
}

/** Guarda o registro no aparelho e no Firebase. Retorna se chegou ao Firebase. */
export async function salvarRegistro(r: Fw27Registro): Promise<boolean> {
  try { await set(CHAVE_LOCAL, [r, ...(await lerLocal())].slice(0, 300)); } catch { /* sem espaço */ }
  try {
    await setDoc(doc(db, COLECAO, r.id), JSON.parse(JSON.stringify(r)));
    return true;
  } catch {
    return false;
  }
}

/** Quem pode ver um registro: master/ALL vê tudo; GESTOR vê os dos seus gestores; LOJA vê os das suas lojas; e sempre os que a própria pessoa fez. */
export interface AcessoHistorico { uid?: string; tudo: boolean; tipo?: string; valores?: string[] }
export function podeVer(r: Fw27Registro, a: AcessoHistorico): boolean {
  if (a.tudo) return true;
  if (a.uid && r.porUid === a.uid) return true;
  const v = new Set((a.valores || []).map((x) => x.toUpperCase().trim()));
  if (a.tipo === "GESTOR") return (r.gestores || []).some((g) => v.has(g.toUpperCase()));
  if (a.tipo === "LOJA") return r.lojas.some((l) => v.has(l.toUpperCase()));
  return false;
}

/** Lista os registros (Firebase + aparelho), mais novos primeiro. */
export async function listarRegistros(acesso: AcessoHistorico = { tudo: true }): Promise<Fw27Registro[]> {
  const porId = new Map<string, Fw27Registro>();
  (await lerLocal()).forEach((r) => porId.set(r.id, r));
  try {
    const snap = await getDocs(collection(db, COLECAO));
    snap.docs.forEach((d: any) => porId.set(d.id, d.data() as Fw27Registro));
  } catch { /* sem acesso ainda: fica só o do aparelho */ }
  return Array.from(porId.values()).filter((r) => podeVer(r, acesso)).sort((a, b) => (a.quando < b.quando ? 1 : -1));
}

/** Excel de um registro: uma linha por loja × artigo × entrega × tamanho (para comparar com a carteira). */
export function excelDoRegistro(r: Fw27Registro): Blob {
  const head = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "000000" } } };
  const quando = new Date(r.quando).toLocaleString("pt-BR");
  const aoa: any[][] = [["LOJA", "COD ADIDAS", "ARTIGO", "DESCRIÇÃO", "ENTREGA", "TAMANHO", "QTD", "PREÇO PDV", "VALOR PDV", "TIPO", "QUANDO", "POR"]];
  r.itens.forEach(([loja, cod, art, desc, d, t, q, preco]) => aoa.push([loja, cod, art, desc, `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`, t, q, preco, q * preco, r.tipo, quando, r.por]));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [18, 12, 10, 40, 12, 9, 7, 11, 12, 12, 18, 26].map((wch) => ({ wch }));
  aoa[0].forEach((_, c) => { const ref = XLSX.utils.encode_cell({ r: 0, c }); if (ws[ref]) ws[ref].s = head; });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "PEDIDO");
  return new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })]);
}
