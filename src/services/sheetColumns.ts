import { Order } from "../types";
import { fixBrokenAccents } from "../lib/utils";

/**
 * Mapa das colunas da planilha "Carteira" → campos do app.
 *
 * A leitura é feita pelo NOME do cabeçalho (sem diferenciar maiúsculas,
 * acentos, espaços, pontos ou "_"), então as colunas podem mudar de posição.
 * Se o nome de uma coluna mudar na planilha, basta ajustar aqui
 * (ou acrescentar o nome novo em "aliases").
 *
 * required: true  → sem essa coluna a sincronização para e mostra um aviso,
 *                   e os dados antigos continuam no app.
 * required: false → a sincronização continua, o campo fica vazio e aparece um aviso.
 */
type NumericField = "qtdeConfirmada" | "valorNF" | "venda" | "estoque" | "mediaVenda" | "estoqueGestor";
type TextField = Exclude<keyof Order, NumericField | "id" | "mesRecebTimestamp" | "syncDate" | "originalRow">;

interface ColumnSpec {
  header: string;
  aliases?: string[];
  required?: boolean;
}

export const TEXT_COLUMNS: Record<TextField, ColumnSpec> = {
  pedido:              { header: "Pedido", aliases: ["Order"] },                    // A
  material:            { header: "Material", required: true },                      // C
  materialDescription: { header: "Material Description" },                          // F
  customer:            { header: "Customer", aliases: ["Cliente"] },                // G
  grupo:               { header: "Grupo" },                                         // L
  dataLancamento:      { header: "Data de Lançamento", aliases: ["Data Lancamento"] }, // Q
  mesRecebMaterial:    { header: "Mês Receb do Material", aliases: ["Mes Receb Material"] }, // W
  status:              { header: "Status" },                                        // X
  gestor:              { header: "Gestor", required: true },                        // AT
  loja:                { header: "Loja", required: true },                          // AU
  subGrupo:            { header: "SubGrupo" },                                      // AV
  colecao:             { header: "Colecao", aliases: ["Coleção"] },                 // AW
  tipoLoja:            { header: "Tipo_Loja", aliases: ["Tipo Loja"] },             // BB
};

export const NUMBER_COLUMNS: Record<NumericField, ColumnSpec> = {
  qtdeConfirmada: { header: "Qtde Confirmada", required: true },                    // AB
  valorNF:        { header: "Valor NF", required: true },                           // AE
  venda:          { header: "Venda" },                                              // AX
  estoque:        { header: "Estoque" },                                            // AY
  mediaVenda:     { header: "Venda G.", aliases: ["Media Venda"] },                 // AZ
  estoqueGestor:  { header: "Estoque G.", aliases: ["Estoque Gestor"] },            // BA
};

/** Coluna com a data/hora em que a planilha foi atualizada (lida na 1ª linha de dados). */
export const UPDATE_DATE_COLUMN: ColumnSpec = { header: "Data de Atualização", aliases: ["Data Atualizacao"] }; // AP

/** "Mês Receb. do Material" → "mesrecebdomaterial" */
export function normalizeHeader(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Procura, entre os cabeçalhos da planilha, o que corresponde à coluna. */
export function findHeader(fields: string[], spec: ColumnSpec): string | undefined {
  const wanted = [spec.header, ...(spec.aliases || [])].map(normalizeHeader);
  for (const name of wanted) {
    const found = fields.find((f) => normalizeHeader(f) === name);
    if (found !== undefined) return found;
  }
  return undefined;
}

export interface ResolvedColumns {
  text: Partial<Record<TextField, string>>;
  numbers: Partial<Record<NumericField, string>>;
  updateDate?: string;
  /** Colunas obrigatórias que não foram encontradas. */
  missingRequired: string[];
  /** Colunas opcionais que não foram encontradas. */
  missingOptional: string[];
}

export function resolveColumns(fields: string[]): ResolvedColumns {
  const result: ResolvedColumns = { text: {}, numbers: {}, missingRequired: [], missingOptional: [] };

  const check = (spec: ColumnSpec, found: string | undefined) => {
    if (found !== undefined) return;
    (spec.required ? result.missingRequired : result.missingOptional).push(spec.header);
  };

  for (const [field, spec] of Object.entries(TEXT_COLUMNS) as [TextField, ColumnSpec][]) {
    const found = findHeader(fields, spec);
    result.text[field] = found;
    check(spec, found);
  }
  for (const [field, spec] of Object.entries(NUMBER_COLUMNS) as [NumericField, ColumnSpec][]) {
    const found = findHeader(fields, spec);
    result.numbers[field] = found;
    check(spec, found);
  }
  result.updateDate = findHeader(fields, UPDATE_DATE_COLUMN);
  check(UPDATE_DATE_COLUMN, result.updateDate);

  return result;
}

/** Converte "1.234,56", "R$ 1.234,56", "1234.56" ou "-" em número. */
export function parseNumber(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  const s = String(val).trim().replace(/[R$\s]/g, "");
  if (s === "" || s === "-") return 0;
  let num;
  if (s.includes(",")) {
    // Formato brasileiro: 1.234,56 -> 1234.56
    num = parseFloat(s.replace(/\./g, "").replace(",", "."));
  } else {
    num = parseFloat(s);
  }
  return isNaN(num) ? 0 : num;
}

/** Transforma uma linha da planilha em um pedido do app. */
export function rowToOrder(row: Record<string, any>, cols: ResolvedColumns): Order {
  const text = (field: TextField) => {
    const header = cols.text[field];
    const v = header !== undefined ? row[header] : undefined;
    // Corrige acentos quebrados da planilha (ex.: "BONÃ‰" → "BONÉ")
    return v === null || v === undefined ? "" : fixBrokenAccents(String(v));
  };
  const num = (field: NumericField) => {
    const header = cols.numbers[field];
    return header !== undefined ? parseNumber(row[header]) : 0;
  };

  return {
    gestor: text("gestor"),
    loja: text("loja"),
    subGrupo: text("subGrupo"),
    colecao: text("colecao"),
    status: text("status"),
    tipoLoja: text("tipoLoja"),
    dataLancamento: text("dataLancamento"),
    mesRecebMaterial: text("mesRecebMaterial"),
    material: text("material"),
    materialDescription: text("materialDescription"),
    pedido: text("pedido"),
    qtdeConfirmada: num("qtdeConfirmada"),
    valorNF: num("valorNF"),
    venda: num("venda"),
    estoque: num("estoque"),
    mediaVenda: num("mediaVenda"),
    estoqueGestor: num("estoqueGestor"),
    originalRow: row,
    grupo: text("grupo"),
    customer: text("customer"),
  };
}
