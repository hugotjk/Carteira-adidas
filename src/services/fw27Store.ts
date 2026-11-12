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
// Espera 8 s sem edição para gravar no Firebase (cada gravação conta na cota diária de escrita).
const ESPERA_MS = 8000;
const TEMPO_MAX_MS = 15000;

/** Tira os zeros da grade por entrega antes de gravar (o documento fica menor; zero = sem chave). */
function compactar(p: Fw27Pedido): Fw27Pedido {
  if (!p.gradeEntrega) return p;
  const ge: Fw27Pedido["gradeEntrega"] = {};
  Object.entries(p.gradeEntrega).forEach(([k, porData]) => {
    const m: Record<string, Record<string, number>> = {};
    Object.entries(porData || {}).forEach(([d, porTam]) => {
      const t: Record<string, number> = {};
      Object.entries(porTam || {}).forEach(([tam, q]) => { if (Number(q)) t[tam] = Number(q); });
      if (Object.keys(t).length) m[d] = t;
    });
    ge[k] = m; // mantém a chave mesmo vazia: produto editado para zero
  });
  return { ...p, gradeEntrega: ge };
}
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
    ...(d.grade && typeof d.grade === "object" && { grade: d.grade }),
    ...(typeof d.gradeUnica === "boolean" && { gradeUnica: d.gradeUnica }),
    ...(d.datas && typeof d.datas === "object" && { datas: d.datas }),
    ...(Array.isArray(d.gradePropria) && { gradePropria: d.gradePropria }),
    ...(d.gradeLoja && typeof d.gradeLoja === "object" && { gradeLoja: d.gradeLoja }),
    ...(Array.isArray(d.gradeGrupos) && { gradeGrupos: d.gradeGrupos.filter((g) => g && Array.isArray(g.lojas)) }),
    ...(d.lojasAuto && { lojasAuto: true }),
    ...(d.porEmail && { porEmail: d.porEmail }),
    ...(d.resetEm && { resetEm: d.resetEm }),
    ...(Array.isArray(d.ordemFixa) && d.ordemFixa.length && { ordemFixa: d.ordemFixa }),
    status: d.status === "enviado" ? "enviado" : "rascunho",
    atualizadoEm: d.atualizadoEm,
    enviadoEm: d.enviadoEm,
  };
}

const maisNovo = (a?: string, b?: string) => (a || "") >= (b || "");

export function useFw27Pedido(uid: string | undefined, email?: string) {
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
      // Sem resposta em 15 s (cota do Firebase esgotada ou sem conexão): fica a cópia do aparelho e tenta na próxima alteração.
      await Promise.race([
        setDoc(doc(db, COLECAO, uid), JSON.parse(JSON.stringify(compactar(p)))),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("tempo esgotado")), TEMPO_MAX_MS)),
      ]);
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
      const novo = { ...fn(atual), atualizadoEm: new Date().toISOString(), ...(email && { porEmail: email }) };
      ultimo.current = novo;
      setEstado("pendente");
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => { timer.current = null; if (ultimo.current) gravar(ultimo.current); }, ESPERA_MS);
      return novo;
    });
  }, [gravar, email]);

  // Ao trocar de aba do navegador ou fechar a página com alteração pendente, grava na hora.
  React.useEffect(() => {
    const agora = () => { if (timer.current && ultimo.current) { window.clearTimeout(timer.current); timer.current = null; gravar(ultimo.current); } };
    const aoEsconder = () => { if (document.visibilityState === "hidden") agora(); };
    document.addEventListener("visibilitychange", aoEsconder);
    window.addEventListener("pagehide", agora);
    return () => { document.removeEventListener("visibilitychange", aoEsconder); window.removeEventListener("pagehide", agora); };
  }, [gravar]);

  // Ao sair da tela com alteração pendente, salva na hora.
  React.useEffect(() => () => {
    if (timer.current) { window.clearTimeout(timer.current); if (ultimo.current) gravar(ultimo.current); }
  }, [gravar]);

  return { pedido, atualizar, estado, erro, salvoEm };
}
