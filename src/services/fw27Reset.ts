/**
 * Atualização geral dos pedidos FW27 (o master "reseta" todos de uma vez).
 * Firebase: documento fw27Config/reset { em, mensagem, por }. Só o master grava; todo login lê.
 * O master grava direto no pedido de cada login (com cópia no Histórico). Quem estiver com o app aberto
 * recebe ao abrir de novo ou voltar para a aba (o app confere a data e refaz no aparelho).
 * Mantém: lojas, verba total, % de cada loja, grades por tamanho e grupos de grade.
 * Volta ao padrão: curva dos meses, % dos subgrupos, quantidades e entregas editadas, datas trocadas. Pedido fechado reabre.
 */
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Fw27Pedido, aplicarVerbas, calcular } from "./fw27";
import { montarRegistro, salvarRegistro, PedidoDeLogin } from "./fw27Historico";

export interface Fw27Reset { em: string; mensagem: string; por: string }

const REF = () => doc(db, "fw27Config", "reset");

export async function lerReset(): Promise<Fw27Reset | null> {
  try {
    const s = await getDoc(REF());
    return s.exists() ? (s.data() as Fw27Reset) : null;
  } catch {
    return null;
  }
}

export async function gravarReset(mensagem: string, por: string): Promise<Fw27Reset> {
  const r: Fw27Reset = { em: new Date().toISOString(), mensagem: mensagem.trim(), por };
  await setDoc(REF(), r);
  return r;
}

/** O pedido ainda não recebeu esta atualização (e já existia antes dela). */
export const precisaReset = (p: Fw27Pedido, r: Fw27Reset | null) =>
  !!r && !!p.atualizadoEm && p.atualizadoEm < r.em && (p.resetEm || "") < r.em;

/** Pedido com o que segue o padrão limpo. */
export function aplicarReset(p: Fw27Pedido, r: Fw27Reset): Fw27Pedido {
  return {
    ...p,
    curva: {},
    subgrupos: {},
    itens: {},
    entregas: {},
    gradeEntrega: {},
    datas: {},
    status: "rascunho",
    resetEm: r.em,
  };
}

/** O que fica diferente do padrão num pedido (para o Acompanhamento). */
export function diferencasDoPadrao(p: Fw27Pedido) {
  const n = (o?: object) => Object.keys(o || {}).length;
  return {
    curva: n(p.curva) > 0,
    subgrupos: n(p.subgrupos) > 0,
    editados: new Set([...Object.keys(p.itens || {}), ...Object.keys(p.entregas || {}), ...Object.keys(p.gradeEntrega || {})]).size,
  };
}

/** Reseta o pedido de todos os logins de uma vez (só o master). Retorna quantos pedidos foram resetados. */
export async function resetarTodos(pedidos: PedidoDeLogin[], por: string): Promise<{ r: Fw27Reset; feitos: number; falhas: number }> {
  const r = await gravarReset("", por);
  let feitos = 0, falhas = 0;
  for (const { uid, pedido } of pedidos) {
    if (!pedido?.lojas?.length) continue;
    try {
      const antes = aplicarVerbas(pedido);
      await salvarRegistro(montarRegistro("antes da atualização", pedido.porEmail || "", antes, calcular(antes), undefined, uid));
      await setDoc(doc(db, "fw27Pedidos", uid), JSON.parse(JSON.stringify({ ...aplicarReset(pedido, r), atualizadoEm: r.em })));
      feitos++;
    } catch { falhas++; }
  }
  return { r, feitos, falhas };
}

/**
 * Reset de um login só, ou de uma loja dele (master, no Acompanhamento).
 * Login: volta curva, % subgrupos, quantidades/entregas editadas e datas trocadas (como o reset geral).
 * Loja: volta só as quantidades/entregas editadas daquela loja (curva, subgrupos e datas valem para o pedido todo e ficam).
 * Lojas, verba, % de cada loja e grades ficam. Pedido fechado volta a rascunho. Guarda uma cópia no Histórico antes.
 */
export function aplicarResetIndividual(p: Fw27Pedido, em: string, lojaId?: string): Fw27Pedido {
  if (!lojaId) return { ...p, curva: {}, subgrupos: {}, itens: {}, entregas: {}, gradeEntrega: {}, datas: {}, status: "rascunho", resetIndEm: em };
  const fora = <T,>(o?: Record<string, T>) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !k.endsWith(`|${lojaId}`))) as Record<string, T>;
  return { ...p, itens: fora(p.itens), entregas: fora(p.entregas), gradeEntrega: fora(p.gradeEntrega), status: "rascunho", resetIndEm: em };
}

/** Editados à mão de uma loja (para mostrar no Acompanhamento). */
export function editadosDaLoja(p: Fw27Pedido, lojaId: string) {
  const ks = new Set([...Object.keys(p.itens || {}), ...Object.keys(p.entregas || {}), ...Object.keys(p.gradeEntrega || {})]);
  return Array.from(ks).filter((k) => k.endsWith(`|${lojaId}`)).length;
}

export async function resetarUm(x: PedidoDeLogin, por: string, lojaId?: string): Promise<string> {
  const em = new Date().toISOString();
  const pedido = x.pedido;
  const antes = aplicarVerbas(pedido);
  await salvarRegistro(montarRegistro("antes da atualização", pedido.porEmail || "", antes, calcular(antes), lojaId ? [lojaId] : undefined, x.uid));
  await setDoc(doc(db, "fw27Pedidos", x.uid), JSON.parse(JSON.stringify({ ...aplicarResetIndividual(pedido, em, lojaId), atualizadoEm: em })));
  return em;
}
