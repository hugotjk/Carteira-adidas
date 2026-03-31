export interface Order {
  id?: string;
  gestor: string;
  loja: string;
  subGrupo: string;
  colecao: string;
  status: string;
  tipoLoja: string;
  dataLancamento: string;
  mesRecebMaterial: string;
  material: string;
  materialDescription: string;
  pedido: string;
  qtdeConfirmada: number;
  valorNF: number;
  venda: number;
  estoque: number;
  mediaVenda: number;
  estoqueGestor: number;
  mesRecebTimestamp?: number;
  syncDate?: string;
  originalRow?: any;
}

export interface GroupedOrder {
  material: string;
  materialDescription: string;
  status: string;
  colecao: string;
  qtdeConfirmada: number;
  valorNF: number;
  items: Order[];
}

export type FilterType = keyof Pick<
  Order,
  | "gestor"
  | "loja"
  | "subGrupo"
  | "colecao"
  | "status"
  | "tipoLoja"
  | "mesRecebMaterial"
>;

export type Filters = Partial<Record<FilterType, string[]>>;

export const FILTER_LABELS: Record<FilterType, string> = {
  gestor: "Gestor",
  loja: "Loja",
  subGrupo: "SubGrupo",
  colecao: "Coleção",
  status: "Status",
  tipoLoja: "Tipo Loja",
  mesRecebMaterial: "Mês Receb. Material",
};
