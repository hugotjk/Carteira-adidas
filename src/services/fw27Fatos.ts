/**
 * Fatos relevantes enviados pelos usuários (aba "Fatos relevantes" da Sugestão FW27).
 * O usuário cria (fica "pendente"); master/admin aceita ou recusa, pode editar o texto e escolhe
 * se aparece para todos os logins ou só para quem criou.
 * Firebase: coleção "fw27Fatos" (regras em firestore.rules).
 */
import { collection, doc, getDocs, setDoc, query, where } from "firebase/firestore";
import { db } from "../firebase";

export type StatusFato = "pendente" | "aprovado" | "recusado";
export type Visibilidade = "todos" | "autor";
export type EfeitoFato = "baixa" | "alta" | "neutro";

export interface Fw27Fato {
  id: string;
  titulo: string;
  quando: string;
  texto: string;
  efeito: EfeitoFato;
  autorUid: string;
  autorEmail: string;
  criadoEm: string;
  status: StatusFato;
  visibilidade: Visibilidade;
  revisadoPor?: string;
  revisadoEm?: string;
}

const COLECAO = "fw27Fatos";
const novoId = () => "F" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export async function criarFato(dados: Pick<Fw27Fato, "titulo" | "quando" | "texto" | "efeito">, autor: { uid: string; email: string }): Promise<Fw27Fato> {
  const f: Fw27Fato = {
    id: novoId(), ...dados, autorUid: autor.uid, autorEmail: autor.email,
    criadoEm: new Date().toISOString(), status: "pendente", visibilidade: "autor",
  };
  await setDoc(doc(db, COLECAO, f.id), f);
  return f;
}

/** Master/admin: muda status, visibilidade ou texto. */
export async function revisarFato(f: Fw27Fato, mud: Partial<Fw27Fato>, por: string): Promise<Fw27Fato> {
  const novo: Fw27Fato = { ...f, ...mud, revisadoPor: por, revisadoEm: new Date().toISOString() };
  await setDoc(doc(db, COLECAO, f.id), novo);
  return novo;
}

/** Master/admin leem todos; os outros leem os aprovados para todos + os que eles mesmos criaram. */
export async function listarFatos(acesso: { uid?: string; admin: boolean }): Promise<Fw27Fato[]> {
  const porId = new Map<string, Fw27Fato>();
  const add = (snap: any) => snap.docs.forEach((d: any) => porId.set(d.id, d.data() as Fw27Fato));
  try {
    if (acesso.admin) add(await getDocs(collection(db, COLECAO)));
    else {
      add(await getDocs(query(collection(db, COLECAO), where("status", "==", "aprovado"), where("visibilidade", "==", "todos"))));
      if (acesso.uid) add(await getDocs(query(collection(db, COLECAO), where("autorUid", "==", acesso.uid))));
    }
  } catch { /* sem acesso / sem conexão */ }
  return Array.from(porId.values()).sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1));
}
