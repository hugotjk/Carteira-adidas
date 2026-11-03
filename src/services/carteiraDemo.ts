/**
 * Carteira de DEMONSTRAÇÃO (login com acesso GESTOR = DEMONSTRACAO).
 * Copia a carteira de lojas medianas da rede, trocando nome, gestor, grupo, customer e nº do pedido,
 * e sem a linha original da planilha (nada de razão social, NF ou referência do cliente).
 * São as mesmas lojas que as DEMO da Sugestão FW27 usam. Só o login de demonstração enxerga.
 */
import { Order } from "../types";
import { lojaCanonica } from "./fw27Lojas";

export const GESTOR_DEMO = "DEMONSTRACAO";

const DEMO: { loja: string; customer: string; origem: string[] }[] = [
  { loja: "DEMO FLA 01", customer: "7000000001", origem: ["NRN FRIBURGO GARRA"] },
  { loja: "DEMO FLA 02", customer: "7000000002", origem: ["NRN RESENDE"] },
  // A NIG CAL tem código novo com quase nada na carteira: usa os dois cadastros.
  { loja: "DEMO FLA 03", customer: "7000000003", origem: ["NIG CAL FLA", "NIG CAL FLA INATIVA"] },
];

export const ehLoginDemo = (accessType: string | undefined, valores: string[]) =>
  accessType === "GESTOR" && valores.some((v) => v.trim().toUpperCase() === GESTOR_DEMO);

export function carteiraDemo(raw: Order[]): Order[] {
  const destino = new Map<string, (typeof DEMO)[number]>();
  DEMO.forEach((d) => d.origem.forEach((o) => destino.set(o, d)));
  const numPedido = new Map<string, string>();
  const out: Order[] = [];
  raw.forEach((o, i) => {
    const d = destino.get(lojaCanonica(o.loja));
    if (!d) return;
    const chave = d.loja + "|" + o.pedido;
    if (!numPedido.has(chave)) numPedido.set(chave, `DEMO${String(numPedido.size + 1).padStart(5, "0")}`);
    const { originalRow: _sem, ...resto } = o;
    out.push({
      ...resto,
      id: `demo-${i}`,
      loja: d.loja,
      gestor: GESTOR_DEMO,
      grupo: GESTOR_DEMO,
      customer: d.customer,
      pedido: numPedido.get(chave)!,
    });
  });
  return out;
}
