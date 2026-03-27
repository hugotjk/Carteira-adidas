export interface Order {
  id?: string;
  gestor: string;
  loja: string;
  subGrupo: string;
  colecao: string;
  status: string;
  dataLancamento: string;
  mesRecebMaterial: string;
  material: string;
  materialDescription: string;
  qtdeConfirmada: number;
  valorNF: number;
  syncDate?: string;
}

export type FilterType = keyof Pick<
  Order,
  | "gestor"
  | "loja"
  | "subGrupo"
  | "colecao"
  | "status"
  | "dataLancamento"
  | "mesRecebMaterial"
>;

export const FILTER_LABELS: Record<FilterType, string> = {
  gestor: "Gestor",
  loja: "Loja",
  subGrupo: "SubGrupo",
  colecao: "Coleção",
  status: "Status",
  dataLancamento: "Data de Lançamento",
  mesRecebMaterial: "Mês Receb. Material",
};
