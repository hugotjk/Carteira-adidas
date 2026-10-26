/**
 * Guarda o pedido FW27 de cada login.
 * - Firebase: coleção "fw27Pedidos", um documento por login (uid). Abre em qualquer aparelho.
 * - Cópia no aparelho (IndexedDB): segura o pedido se a internet cair ou o Firebase recusar.
 * Cada alteração é salva sozinha, alguns segundos depois de editar.
 */
import React from "react";
import { get, set } from "idb-keyval";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Fw27Pedido, pedidoVazio } from "./fw27";

export type SaveState = "carregando" | "salvo" | "salvando" | "pendente" | "erro";

const COLECAO = "fw27Pedidos";
const ESPERA_MS = 1500;
const chaveLocal = (uid: string) => `fw27-pedido-${uid}`;

function normalizar(d: Partial<Fw27Pedido> | undefined | null): Fw27Pedido {
  const base = pedidoVazio();
  if (!d) return base;
  let lojas: Fw27Pedido["lojas"] = Array.isArray(d.lojas) ? d.lojas : base.lojas;
  let verbaTotal = typeof d.verbaTotal === "number" ? d.verbaTotal : undefined;
  // Pedido antigo (verba digitada por loja, sem verba total): vira verba total + % de cada loja.
  if (verbaTotal === undefined && lojas.some((l) => Number(l.verba) > 0 && l.pct === undefined)) {
    verbaTotal = lojas.reduce((a, l) => a + Number(l.verba || 0), 0);
    lojas = lojas.map((l) => ({ ...l, pct: verbaTotal ? (Number(l.verba || 0) / verbaTotal!) * 100 : 0 }));
  }
  return {
    lojas,
    ...(verbaTotal !== undefined && { verbaTotal }),
    subgrupos: d.subgrupos && typeof d.subgrupos === "object" ? d.subgrupos : {},
    itens: d.itens && typeof d.itens === "object" ? d.itens : {},
    entregas: d.entregas && typeof d.entregas === "object" ? d.entregas : {},
    gradeEntrega: d.gradeEntrega && typeof d.gradeEntrega === "object" ? d.gradeEntrega : {},
    curva: d.curva && typeof d.curva === "object" ? d.curva : {},
    status: d.status === "enviado" ? "enviado" : "rascunho",
    atualizadoEm: d.atualizadoEm,
    enviadoEm: d.enviadoEm,
  };
}

const maisNovo = (a?: string, b?: string) => (a || "") >= (b || "");

export function useFw27Pedido(uid: string | undefined) {
  const [pedido, setPedidoState] = React.useState<Fw27Pedido>(pedidoVazio());
  const [estado, setEstado] = React.useState<SaveState>("carregando");
  const [erro, setErro] = React.useState<string | null>(null);
  const [salvoEm, setSalvoEm] = React.useState<string | null>(null);
  const timer = React.useRef<number | null>(null);
  const ultimo = React.useRef<Fw27Pedido | null>(null);

  // Carrega: o mais recente entre o Firebase e a cópia do aparelho.
  React.useEffect(() => {
    if (!uid) return;
    let vivo = true;
    (async () => {
      let local: Fw27Pedido | null = null;
      try { local = normalizar(await get(chaveLocal(uid))); } catch { /* sem cópia */ }
      let remoto: Fw27Pedido | null = null;
      try {
        const snap = await getDoc(doc(db, COLECAO, uid));
        if (snap.exists()) remoto = normalizar(snap.data() as Fw27Pedido);
      } catch (e: any) {
        setErro(e?.code === "permission-denied" ? "O Firebase ainda não liberou esta tela (regras). Salvando só neste aparelho." : "Sem conexão com o Firebase. Salvando só neste aparelho.");
      }
      if (!vivo) return;
      const escolhido = remoto && local ? (maisNovo(remoto.atualizadoEm, local.atualizadoEm) ? remoto : local) : remoto || local || pedidoVazio();
      setPedidoState(escolhido);
      setSalvoEm(escolhido.atualizadoEm || null);
      setEstado("salvo");
    })();
    return () => { vivo = false; };
  }, [uid]);

  const gravar = React.useCallback(async (p: Fw27Pedido) => {
    if (!uid) return;
    setEstado("salvando");
    try { await set(chaveLocal(uid), p); } catch { /* aparelho sem espaço */ }
    try {
      await setDoc(doc(db, COLECAO, uid), JSON.parse(JSON.stringify(p)));
      setErro(null);
      setSalvoEm(p.atualizadoEm || null);
      setEstado(ultimo.current === p ? "salvo" : "pendente");
    } catch (e: any) {
      setErro(e?.code === "permission-denied" ? "O Firebase ainda não liberou esta tela (regras). Salvo só neste aparelho." : "Sem conexão. Salvo só neste aparelho; tenta de novo na próxima alteração.");
      setSalvoEm(p.atualizadoEm || null);
      setEstado("erro");
    }
  }, [uid]);

  /** Altera o pedido e agenda o salvamento. */
  const atualizar = React.useCallback((fn: (p: Fw27Pedido) => Fw27Pedido) => {
    setPedidoState((atual) => {
      const novo = { ...fn(atual), atualizadoEm: new Date().toISOString() };
      ultimo.current = novo;
      setEstado("pendente");
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => { timer.current = null; if (ultimo.current) gravar(ultimo.current); }, ESPERA_MS);
      return novo;
    });
  }, [gravar]);

  // Ao sair da tela com alteração pendente, salva na hora.
  React.useEffect(() => () => {
    if (timer.current) { window.clearTimeout(timer.current); if (ultimo.current) gravar(ultimo.current); }
  }, [gravar]);

  return { pedido, atualizar, estado, erro, salvoEm };
}
