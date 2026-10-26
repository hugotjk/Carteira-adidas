import React from "react";
import * as XLSX from "xlsx-js-style";
import {
  Sparkles, LayoutList, Store, Lightbulb, ClipboardList, Plus, Trash2, ChevronDown, ChevronUp,
  Download, Lock, Unlock, RotateCcw, X, Cloud, CloudOff, Loader2, Search, EyeOff,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import ProductImage from "../ProductImage";
import { salvarArquivo } from "../../lib/salvarArquivo";
import { exportarLojaFornecedor, ARTIGOS_NO_CARRINHO } from "../../services/fw27Exportar";
import { montarRegistro, salvarRegistro, listarRegistros, excelDoRegistro, Fw27Registro } from "../../services/fw27Historico";
import {
  aplicarVerbas, verbaTotalDe, verbaSugerida, pctLojas, pctLojasSugerido, AUMENTO_VERBA,
  dividir, PRODUTOS, SUBGRUPOS, LANCAMENTOS, CALENDARIO, datasEntrega, podeComprar, inicioCompra, MESES_CURVA, curvaDe, gradePorEntrega, gradeProporcional, Fw27Pedido, Fw27Loja, Fw27Linha, Fw27Produto,
  calcular, totais, pctSubgrupos, subgruposPadrao, chaveItem, gradeDe, mesDe, diaMes, VENDAS, lojaNaBase, nomeBase,
} from "../../services/fw27";
import { useFw27Pedido, SaveState } from "../../services/fw27Store";

const SECTIONS = [
  { id: "resumos", label: "Resumos FW27", icon: LayoutList },
  { id: "representatividade", label: "Representatividade por Loja", icon: Store },
  { id: "sugestao", label: "Sugestão", icon: Lightbulb },
  { id: "resumo", label: "Resumo", icon: ClipboardList },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

const n0 = (v: number) => Math.round(v || 0).toLocaleString("pt-BR");
const brl = (v: number) => "R$ " + Math.round(v || 0).toLocaleString("pt-BR");
const pct1 = (v: number) => (Math.round((v || 0) * 10) / 10).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const NOME_MES: Record<string, string> = { "05": "Maio", "06": "Junho", "07": "Julho", "08": "Agosto", "09": "Setembro", "10": "Outubro", "11": "Novembro" };
/** Soma as entregas de várias linhas por data. */
function somaPorData(ls: Fw27Linha[]): Record<string, number> {
  const out: Record<string, number> = {};
  ls.forEach((x) => Object.entries(x.entregas).forEach(([d, q]) => { if (q) out[d] = (out[d] || 0) + q; }));
  return out;
}
/** Soma por mês (a partir das datas). */
function somaPorMes(porData: Record<string, number>): { mes: string; q: number; n: number }[] {
  const m: Record<string, { q: number; n: number }> = {};
  Object.entries(porData).forEach(([d, q]) => { const k = d.slice(5, 7); m[k] = m[k] || { q: 0, n: 0 }; m[k].q += q; m[k].n += 1; });
  return Object.keys(m).sort().map((k) => ({ mes: k, ...m[k] }));
}
const novoId = () => "L" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const tagDe = (p: Fw27Produto) =>
  p.carryOver === "CARRY OVER" ? { label: "CARRY OVER", cls: "bg-blue-50 text-blue-700" }
  : { label: "NOVO", cls: "bg-emerald-50 text-emerald-700" };

type Direcao = "cima" | "baixo" | "esq" | "dir";
const SETAS: Record<string, Direcao> = { ArrowUp: "cima", ArrowDown: "baixo", ArrowLeft: "esq", ArrowRight: "dir" };

/** Coluna (contando colSpan) de cada célula de uma linha. */
function colunasDaLinha(tr: HTMLTableRowElement): { td: HTMLTableCellElement; ini: number; fim: number }[] {
  let c = 0;
  return Array.from(tr.cells).map((td) => { const ini = c; c += td.colSpan || 1; return { td, ini, fim: c - 1 }; });
}
const campoDa = (td?: HTMLTableCellElement | null) => td?.querySelector<HTMLInputElement>("input:not([disabled])") || null;

/** Vai para a célula editável vizinha (como no Excel). Devolve false se não houver para onde ir. */
function navegar(el: HTMLInputElement, dir: Direcao): boolean {
  const td = el.closest("td");
  const tr = td?.parentElement as HTMLTableRowElement | null;
  const tabela = el.closest("table");
  if (!td || !tr || !tabela) return false;
  const minha = colunasDaLinha(tr).find((x) => x.td === td);
  if (!minha) return false;
  let alvo: HTMLInputElement | null = null;
  if (dir === "esq" || dir === "dir") {
    const cels = colunasDaLinha(tr);
    const i = cels.findIndex((x) => x.td === td);
    for (let j = dir === "dir" ? i + 1 : i - 1; j >= 0 && j < cels.length && !alvo; j += dir === "dir" ? 1 : -1) alvo = campoDa(cels[j].td);
  } else {
    const linhas = Array.from(tabela.rows);
    const i = linhas.indexOf(tr);
    for (let j = dir === "baixo" ? i + 1 : i - 1; j >= 0 && j < linhas.length && !alvo; j += dir === "baixo" ? 1 : -1) {
      const cel = colunasDaLinha(linhas[j]).find((x) => x.ini <= minha.ini && x.fim >= minha.ini);
      alvo = campoDa(cel?.td);
    }
  }
  if (!alvo) return false;
  alvo.focus();
  return true;
}

/** Campo numérico que só grava ao sair do campo ou apertar Enter. */
const NumInput: React.FC<{
  value: number; onCommit: (v: number) => void; disabled?: boolean; className?: string; decimals?: number; ariaLabel: string; zeroVazio?: boolean;
}> = ({ value, onCommit, disabled, className, decimals = 0, ariaLabel, zeroVazio }) => {
  const fmt = (v: number) => (zeroVazio && !Number(v) ? "" : (Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: decimals }));
  const [txt, setTxt] = React.useState(fmt(value));
  const [foco, setFoco] = React.useState(false);
  React.useEffect(() => { if (!foco) setTxt(fmt(value)); }, [value, foco]);
  const commit = () => {
    const v = String(txt).trim() === "" ? 0 : Number(String(txt).replace(/\./g, "").replace(",", "."));
    if (!isNaN(v) && v >= 0) onCommit(v); else setTxt(fmt(value));
  };
  return (
    <input
      inputMode="decimal" aria-label={ariaLabel} disabled={disabled} value={txt}
      onFocus={(e) => { setFoco(true); e.target.select(); }}
      onBlur={() => { setFoco(false); commit(); }}
      onKeyDown={(e) => {
        const el = e.target as HTMLInputElement;
        const dir = SETAS[e.key] || (e.key === "Enter" ? (e.shiftKey ? "cima" : "baixo") : null);
        if (dir && el.closest("table")) {
          // Na tabela, setas e Enter andam como no Excel (o valor grava ao sair da célula).
          e.preventDefault();
          if (!navegar(el, dir) && e.key === "Enter") el.blur();
        } else if (e.key === "Enter") el.blur();
      }}
      onChange={(e) => setTxt(e.target.value)}
      className={cn("bg-gray-50 rounded-xl px-2 h-9 text-right font-extrabold text-sm outline-none focus:ring-2 focus:ring-black/10 disabled:text-gray-400 min-w-0", className)}
    />
  );
};

/** Diferença entre o % atual e o sugerido, com cor. */
const Desvio: React.FC<{ atual: number; sugerido: number }> = ({ atual, sugerido }) => {
  const d = atual - sugerido;
  const cls = Math.abs(d) < 1 ? "text-emerald-600" : Math.abs(d) < 3 ? "text-amber-600" : "text-red-600";
  return <span className={cn("font-extrabold", cls)}>{d >= 0 ? "+" : "−"}{pct1(Math.abs(d)).replace("%", "")} p.p.</span>;
};

const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <div className={cn("bg-white rounded-3xl border border-gray-100 shadow-sm p-4", className)}>{children}</div>
);

const Kpi: React.FC<{ label: string; value: React.ReactNode; sub?: React.ReactNode }> = ({ label, value, sub }) => (
  <Card className="p-3">
    <div className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider">{label}</div>
    <div className="text-xl font-black mt-1 text-gray-900">{value}</div>
    {sub && <div className="text-[10px] font-bold text-gray-400 mt-0.5">{sub}</div>}
  </Card>
);

const SaveBadge: React.FC<{ estado: SaveState; salvoEm: string | null; erro: string | null }> = ({ estado, salvoEm, erro }) => {
  const hora = salvoEm ? new Date(salvoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
  if (estado === "carregando") return <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400"><Loader2 size={12} className="animate-spin" /> Abrindo…</span>;
  if (estado === "salvando" || estado === "pendente") return <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400"><Loader2 size={12} className="animate-spin" /> Salvando…</span>;
  if (estado === "erro" || erro) return <span title={erro || ""} className="flex items-center gap-1 text-[10px] font-bold text-amber-600"><CloudOff size={12} /> Salvo só neste aparelho {hora && "· " + hora}</span>;
  return <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600"><Cloud size={12} /> Salvo {hora && "às " + hora}</span>;
};

// =====================================================================

const Fw27Master: React.FC = () => {
  const { user } = useAuth();
  const { imageMap } = useData();
  const { pedido: pedidoSalvo, atualizar, estado, erro, salvoEm } = useFw27Pedido(user?.uid);
  // Verba de cada loja = verba total × % da loja (sugeridos quando não digitados).
  const pedido = React.useMemo(() => aplicarVerbas(pedidoSalvo), [pedidoSalvo]);
  const [active, setActive] = React.useState<SectionId>("representatividade");
  const linhas = React.useMemo(() => calcular(pedido), [pedido]);
  const tot = React.useMemo(() => totais(pedido, linhas), [pedido, linhas]);
  const travado = pedido.status === "enviado";
  const semLojas = pedido.lojas.length === 0;

  React.useEffect(() => { if (estado === "salvo" && semLojas) setActive("representatividade"); }, [estado, semLojas]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 overflow-x-hidden pb-12">
      <div className="bg-white border-b border-gray-100 px-4 md:px-6 py-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center shadow-lg shadow-black/10 shrink-0">
              <Sparkles className="text-white" size={24} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold text-gray-900 tracking-tight leading-none">Sugestão FW27</h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                <SaveBadge estado={estado} salvoEm={salvoEm} erro={erro} />
                <span className={cn("text-[9px] font-black uppercase tracking-wider rounded-md px-1.5 py-0.5", travado ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500")}>
                  {travado ? "Enviado" : "Rascunho"}
                </span>
              </div>
            </div>
          </div>
          <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 rounded-lg px-2 py-1 shrink-0">
            <EyeOff size={11} /> Master e admins
          </span>
        </div>
        {erro && <p className="text-[10px] text-amber-700 mt-3">{erro}</p>}
      </div>

      <div className={cn("p-4 md:p-6 space-y-4 w-full mx-auto", active === "sugestao" ? "max-w-[112rem]" : "max-w-5xl")}>
        <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-2", active === "sugestao" && "max-w-5xl mx-auto")}>
          {SECTIONS.map((s) => (
            <button
              key={s.id} onClick={() => setActive(s.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-3 rounded-2xl border text-left transition-all",
                active === s.id ? "bg-black text-white border-black shadow-lg shadow-black/10" : "bg-white text-gray-600 border-gray-100 hover:border-gray-300"
              )}
            >
              <s.icon size={16} className="shrink-0" />
              <span className="text-[11px] font-bold leading-tight">{s.label}</span>
            </button>
          ))}
        </div>

        {estado === "carregando" ? (
          <Card className="py-16 flex justify-center"><Loader2 className="animate-spin text-gray-300" /></Card>
        ) : (
          <>
            {active === "resumos" && <ResumosTab linhas={linhas} tot={tot} />}
            {active === "representatividade" && <ReprTab pedido={pedido} atualizar={atualizar} tot={tot} travado={travado} />}
            {active === "sugestao" && (semLojas
              ? <SemLojas onIr={() => setActive("representatividade")} />
              : <SugestaoTab pedido={pedido} atualizar={atualizar} linhas={linhas} tot={tot} travado={travado} imageMap={imageMap} />)}
            {active === "resumo" && (semLojas
              ? <SemLojas onIr={() => setActive("representatividade")} />
              : <ResumoTab pedido={pedido} atualizar={atualizar} linhas={linhas} tot={tot} />)}
          </>
        )}
      </div>
    </div>
  );
};

const SemLojas: React.FC<{ onIr: () => void }> = ({ onIr }) => (
  <Card className="py-12 text-center">
    <Store className="mx-auto text-gray-300" />
    <p className="text-sm font-bold text-gray-700 mt-3">Cadastre as lojas e a verba de cada uma primeiro.</p>
    <button onClick={onIr} className="mt-4 h-10 px-4 rounded-xl bg-black text-white text-xs font-black uppercase tracking-wider">Ir para Representatividade</button>
  </Card>
);

// ============================ RESUMOS FW27 ============================

const ResumosTab: React.FC<{ linhas: Fw27Linha[]; tot: ReturnType<typeof totais> }> = ({ linhas, tot }) => {
  // CARRY OVER = já comprado no SS27; o resto (TOTALLY NEW e NEW COLOR da AMD) é novo.
  const co = PRODUTOS.filter((p) => p.carryOver === "CARRY OVER").length;
  const novos = PRODUTOS.length - co;
  const porEntrega = LANCAMENTOS.map((d) => {
    const ps = PRODUTOS.filter((p) => p.lancamento === d);
    const ls = linhas.filter((x) => x.produto.lancamento === d);
    return { d, ps, pecas: ls.reduce((a, x) => a + x.qtd, 0) };
  });
  const datasComPeca = Object.keys(somaPorData(linhas)).sort();
  const meses = somaPorMes(somaPorData(linhas));
  const maxMes = Math.max(1, ...meses.map((m) => m.q));
  const maxPack = Math.max(1, ...SUBGRUPOS.map((pk) => tot.porPack[pk]?.pecas || 0));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Kpi label="Referências" value={PRODUTOS.length} sub={`${novos} novas · ${co} carry over (SS27)`} />
        <Kpi label="Peças no pedido" value={n0(tot.pecas)} />
        <Kpi label="Valor a PDV" value={brl(tot.valor)} sub={tot.verba ? `verba ${brl(tot.verba)}` : "sem verba ainda"} />
        <Kpi label="Datas de entrega" value={datasComPeca.length || "—"} sub={datasComPeca.length ? `${diaMes(datasComPeca[0])} a ${diaMes(datasComPeca[datasComPeca.length - 1])}` : "lançamento, 01 e 15"} />
      </div>
      {meses.length > 0 && (
        <Card>
          <h3 className="text-sm font-extrabold mb-3">Peças por mês de entrega</h3>
          {meses.map((m) => (
            <div key={m.mes} className="grid grid-cols-[5.5rem_1fr_4.5rem] gap-2 items-center py-1">
              <div className="text-[11px] font-extrabold">{NOME_MES[m.mes] || m.mes}</div>
              <div className="h-2 bg-gray-100 rounded"><div className="h-2 bg-black rounded" style={{ width: `${(m.q / maxMes) * 100}%` }} /></div>
              <div className="text-[11px] font-extrabold text-right">{n0(m.q)}</div>
            </div>
          ))}
        </Card>
      )}
      <Card>
        <h3 className="text-sm font-extrabold mb-3">Calendário de lançamentos</h3>
        <div className="space-y-3">
          {porEntrega.map(({ d, ps, pecas }) => (
            <div key={d} className="flex gap-3">
              <div className="w-16 shrink-0">
                <div className="text-xs font-black">{diaMes(d)}</div>
                <div className="text-[10px] font-bold text-gray-400">{mesDe(d)} · {ps.length} refs</div>
                <div className="text-[10px] font-bold text-gray-500">{n0(pecas)} pçs</div>
              </div>
              <div className="flex flex-wrap gap-1.5 min-w-0">
                {ps.map((p) => (
                  <span key={p.artigo} title={p.descricao} className="text-[10px] font-bold bg-gray-50 rounded-lg px-2 py-1">
                    {p.artigo} <span className="text-gray-400 font-semibold">{p.subgrupo}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <h3 className="text-sm font-extrabold mb-3">Por subgrupo</h3>
        {SUBGRUPOS.map((pk) => {
          const refs = PRODUTOS.filter((p) => p.subgrupo === pk).length;
          const pc = tot.porPack[pk]?.pecas || 0;
          return (
            <div key={pk} className="grid grid-cols-[minmax(0,10rem)_1fr_4rem] gap-2 items-center py-1.5">
              <div className="text-[10px] font-extrabold uppercase truncate">{pk} <span className="text-gray-400">· {refs}</span></div>
              <div className="h-2 bg-gray-100 rounded"><div className="h-2 bg-black rounded" style={{ width: `${(pc / maxPack) * 100}%` }} /></div>
              <div className="text-[11px] font-extrabold text-right">{n0(pc)}</div>
            </div>
          );
        })}
      </Card>
    </div>
  );
};

// ======================== REPRESENTATIVIDADE ========================

interface EditProps {
  pedido: Fw27Pedido;
  atualizar: (fn: (p: Fw27Pedido) => Fw27Pedido) => void;
  tot: ReturnType<typeof totais>;
  travado: boolean;
}

const ReprTab: React.FC<EditProps> = ({ pedido, atualizar, tot, travado }) => {
  const [nome, setNome] = React.useState("");
  const pct = pctSubgrupos(pedido);
  const somaPct = SUBGRUPOS.reduce((a, pk) => a + (pct[pk] || 0), 0);
  const okSoma = Math.abs(somaPct - 100) < 0.05;

  const setLoja = (id: string, mud: Partial<Fw27Loja>) =>
    atualizar((p) => ({ ...p, lojas: p.lojas.map((l) => (l.id === id ? { ...l, ...mud } : l)) }));
  const addLoja = () => {
    const nm = nome.trim().toUpperCase();
    if (!nm) return;
    const b = lojaNaBase(nm);
    atualizar((p) => ({ ...p, lojas: [...p.lojas, { id: novoId(), nome: b ? b.nome : nm, verba: 0, ...(b && { gestor: b.gestor, codAdidas: b.codAdidas }) }] }));
    setNome("");
  };
  const delLoja = (l: Fw27Loja) => {
    atualizar((p) => {
      const itens = { ...p.itens };
      const entregas = { ...(p.entregas || {}) };
      const gradeEntrega = { ...(p.gradeEntrega || {}) };
      [itens, entregas, gradeEntrega].forEach((o: Record<string, unknown>) => Object.keys(o).forEach((k) => { if (k.endsWith("|" + l.id)) delete o[k]; }));
      return { ...p, lojas: p.lojas.filter((x) => x.id !== l.id), itens, entregas, gradeEntrega };
    });
  };
  // % e verba de cada loja: mexer numa loja não mexe nas outras; o que falta ou sobra aparece na soma.
  const verbaTotal = verbaTotalDe(pedido);
  const sugTotal = verbaSugerida(pedido);
  const pctL = pctLojas(pedido);
  const pctSugL = pctLojasSugerido(pedido);
  const somaPctL = pedido.lojas.reduce((a, l) => a + (pctL[l.id] || 0), 0);
  const okSomaL = Math.abs(somaPctL - 100) < 0.05;
  const congelarPcts = (p: Fw27Pedido) => {
    // Na 1ª edição, as lojas que estavam no sugerido ficam com o número que estava na tela.
    const atual = pctLojas(p);
    return p.lojas.map((x) => (x.pct === undefined ? { ...x, pct: atual[x.id] } : x));
  };
  const setPctLoja = (l: Fw27Loja, v: number) =>
    atualizar((p) => ({ ...p, lojas: congelarPcts(p).map((x) => (x.id === l.id ? { ...x, pct: Math.min(v, 100) } : x)) }));
  const setVerbaLoja = (l: Fw27Loja, v: number) =>
    atualizar((p) => { const t = verbaTotalDe(p); return { ...p, lojas: congelarPcts(p).map((x) => (x.id === l.id ? { ...x, pct: t ? (v / t) * 100 : 0 } : x)) }; });
  const setVerbaTotal = (v: number) => atualizar((p) => ({ ...p, verbaTotal: v }));
  const lojasSugeridas = () => atualizar((p) => ({ ...p, lojas: p.lojas.map(({ pct: _p, ...x }) => x) }));
  const setPack = (pk: string, v: number) =>
    atualizar((p) => ({ ...p, subgrupos: { ...pctSubgrupos(p), [pk]: v } }));

  return (
    <div className="space-y-4">
      <Card className="bg-black text-white border-black">
        <div className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider">Verba FW27 total (a preço PDV)</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-2xl font-black">R$</span>
          <NumInput ariaLabel="Verba total" value={verbaTotal} disabled={travado} onCommit={setVerbaTotal}
            className="flex-1 bg-white/10 text-white text-2xl md:text-3xl h-12 text-left px-3 focus:ring-white/30" />
        </div>
        <div className="text-[11px] text-gray-400 mt-2">
          Sugerida: {brl(sugTotal)} = vendido pelas lojas do pedido em jun–out/2026 + {Math.round(AUMENTO_VERBA * 100)}%.
          {!travado && Math.abs(verbaTotal - sugTotal) >= 1 && (
            <button onClick={() => atualizar((p) => { const { verbaTotal: _v, ...r } = p; return r as Fw27Pedido; })} className="ml-2 font-black text-white underline">Usar a sugerida</button>
          )}
        </div>
        <div className="text-[11px] text-gray-400 mt-1">No pedido: {brl(tot.valor)} ({verbaTotal ? pct1((tot.valor / verbaTotal) * 100) : "—"} da verba).</div>
      </Card>

      {!travado && <BaseLojasCard pedido={pedido} atualizar={atualizar} />}

      <Card className="px-4 py-2">
        <div className="flex items-center justify-between py-2">
          <h3 className="text-sm font-extrabold">% da verba por loja</h3>
          {!travado && (
            <button onClick={lojasSugeridas} className="text-[10px] font-bold text-gray-400 hover:text-black flex items-center gap-1">
              <RotateCcw size={11} /> Sugerido
            </button>
          )}
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_7rem_2rem] gap-2 pb-2 text-[9px] font-extrabold text-gray-400 uppercase tracking-wider">
          <span>Loja</span><span className="text-center">%</span><span className="text-right">Verba R$</span><span />
        </div>
        {pedido.lojas.map((l) => {
          const t = tot.porLoja[l.id];
          return (
            <div key={l.id} className="grid grid-cols-[minmax(0,1fr)_4.5rem_7rem_2rem] gap-2 items-center py-2.5 border-t border-gray-50">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                  <span className="text-xs font-extrabold truncate max-w-full">{l.nome}</span>
                  <input aria-label={`Código adidas da loja ${l.nome}`} disabled={travado} defaultValue={l.codAdidas || ""} placeholder="cód. adidas"
                    onBlur={(e) => { const v = e.target.value.replace(/\D/g, ""); if (v !== (l.codAdidas || "")) setLoja(l.id, { codAdidas: v }); }}
                    className="w-24 shrink-0 bg-gray-50 rounded-md px-1.5 h-6 text-[10px] font-bold text-gray-600 outline-none focus:ring-2 focus:ring-black/10" />
                </div>
                <div className="text-[10px] font-semibold text-gray-400 mt-0.5">
                  {l.gestor && <>{l.gestor} · </>}{lojaNaBase(l.nome) && <>sugerido {pct1(pctSugL[l.id] || 0)} · </>}No pedido: {pct1(t?.pctAtual || 0)} · {brl(t?.valor || 0)} {t && t.valor > 0 && <>· <Desvio atual={t.pctAtual} sugerido={t.pctSugerido} /></>}
                </div>
              </div>
              <NumInput ariaLabel={`% da loja ${l.nome}`} decimals={1} value={pctL[l.id] || 0} disabled={travado} onCommit={(v) => setPctLoja(l, v)} className="w-full" />
              <NumInput ariaLabel={`Verba da loja ${l.nome}`} value={l.verba} disabled={travado || !verbaTotal} onCommit={(v) => setVerbaLoja(l, v)} className="w-full" />
              {travado ? <span /> : (
                <BotaoConfirmar rotulo={<Trash2 size={15} />} confirmar="Tirar?" onConfirm={() => delLoja(l)}
                  className="h-9 min-w-8 px-1 rounded-lg flex items-center justify-center text-[9px] font-black text-gray-300 hover:text-red-500" />
              )}
            </div>
          );
        })}
        {pedido.lojas.length > 0 && (
          <div className={cn("flex justify-between py-3 border-t border-gray-200 text-xs font-black", okSomaL ? "text-emerald-700" : "text-amber-700")}>
            <span>Soma</span>
            <span>{okSomaL ? "100% ✓" : `${pct1(somaPctL)} · ${somaPctL < 100 ? "faltam" : "sobram"} ${pct1(Math.abs(100 - somaPctL))} (${brl((Math.abs(100 - somaPctL) * verbaTotal) / 100)})`}</span>
          </div>
        )}
        {!travado && (
          <div className="flex gap-2 py-3 border-t border-gray-100">
            <input
              value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLoja()}
              placeholder="Nome da loja (ex.: LOJA 01)" aria-label="Nome da nova loja"
              className="flex-1 min-w-0 bg-gray-50 rounded-xl px-3 h-10 text-sm font-bold outline-none focus:ring-2 focus:ring-black/10 uppercase"
            />
            <button onClick={addLoja} className="h-10 px-3 rounded-xl bg-black text-white text-xs font-black flex items-center gap-1"><Plus size={14} /> Loja</button>
          </div>
        )}
      </Card>
      <p className="text-[10px] text-gray-400 px-2">Sugerido = peso da loja nas vendas dos últimos 90 dias (ago–out/2026), entre as lojas deste pedido. Mudar o % (ou a verba) de uma loja não mexe nas outras: o que falta ou sobra aparece na soma.</p>

      <Card className="px-4 py-2">
        <div className="flex items-center justify-between py-2">
          <h3 className="text-sm font-extrabold">% da verba por subgrupo</h3>
          {!travado && (
            <button onClick={() => atualizar((p) => ({ ...p, subgrupos: {} }))} className="text-[10px] font-bold text-gray-400 hover:text-black flex items-center gap-1">
              <RotateCcw size={11} /> Padrão
            </button>
          )}
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_6.5rem] gap-2 pb-2 text-[9px] font-extrabold text-gray-400 uppercase tracking-wider">
          <span>Subgrupo</span><span className="text-center">%</span><span className="text-right">No pedido</span>
        </div>
        {SUBGRUPOS.map((pk) => {
          const t = tot.porPack[pk];
          return (
            <div key={pk} className="grid grid-cols-[minmax(0,1fr)_4.5rem_6.5rem] gap-2 items-center py-2 border-t border-gray-50">
              <div className="min-w-0">
                <div className="text-[11px] font-extrabold uppercase truncate">{pk}</div>
                <div className="text-[10px] font-semibold text-gray-400">{PRODUTOS.filter((p) => p.subgrupo === pk).length} refs · {brl((tot.verba * (pct[pk] || 0)) / 100)}{VENDAS.subgrupos[pk] !== undefined && <> · vendas 2026 {pct1(VENDAS.subgrupos[pk])}</>}</div>
              </div>
              <NumInput ariaLabel={`% do subgrupo ${pk}`} decimals={1} value={pct[pk] || 0} disabled={travado} onCommit={(v) => setPack(pk, v)} className="w-full" />
              <div className="text-right text-[10px] font-bold text-gray-500">
                {pct1(t?.pctAtual || 0)}{t && t.valor > 0 && <div><Desvio atual={t.pctAtual} sugerido={t.pctSugerido} /></div>}
              </div>
            </div>
          );
        })}
        <div className={cn("flex justify-between py-3 border-t border-gray-200 text-xs font-black", okSoma ? "text-emerald-700" : "text-amber-700")}>
          <span>Soma</span>
          <span>{okSoma ? "100% ✓" : `${pct1(somaPct)} · ${somaPct < 100 ? "faltam" : "sobram"} ${pct1(Math.abs(100 - somaPct))}`}</span>
        </div>
      </Card>
      <CurvaCard pedido={pedido} atualizar={atualizar} travado={travado} />

      <p className="text-[10px] text-gray-400 px-2">
        Padrão: cada produto da AMD comparado com o equivalente vendido em 2026 (masc com masc, fem com fem, inf com inf; com e sem Betano juntas).
        TIROTECH = Tiro Travel; ICON = Icon 2025 no lançamento; SPECIAL = camisa WC Brasil depois da Copa; FANSHIRT = camisa torcedor de cada kit × peso do Fanshirt na Home em 2026.
        Dentro do subgrupo, cada produto recebe a verba pelo peso do seu comparável (a Pro recebe menos que a torcedor).
        Padrão atual: {SUBGRUPOS.slice(0, 3).map((pk) => `${pk} ${pct1(subgruposPadrao()[pk])}`).join(", ")}…
      </p>
    </div>
  );
};

/** Puxa as lojas da base de vendas (com gestor e código) e divide a verba pelo peso nas vendas. */
const BaseLojasCard: React.FC<{ pedido: Fw27Pedido; atualizar: EditProps["atualizar"] }> = ({ pedido, atualizar }) => {
  // Mesmo acesso do resto do app: master/ALL vê todas; GESTOR vê as lojas dos seus gestores; LOJA só as suas lojas.
  const { user, userProfile } = useAuth();
  const visiveis = React.useMemo(() => {
    const tudo = userProfile?.role === "master" || userProfile?.accessType === "ALL" || user?.email === "hugotjk2@gmail.com";
    if (tudo) return VENDAS.lojas;
    const v = new Set(((userProfile?.accessValues as string[]) || []).map((x) => String(x).toUpperCase().trim()));
    if (userProfile?.accessType === "GESTOR") return VENDAS.lojas.filter((l) => v.has(l.gestor.toUpperCase()));
    if (userProfile?.accessType === "LOJA") { const ns = new Set(Array.from(v).map(nomeBase)); return VENDAS.lojas.filter((l) => ns.has(l.nome)); }
    return [];
  }, [user?.email, userProfile]);
  const gestores = React.useMemo(() => Array.from(new Set(visiveis.map((l) => l.gestor).filter(Boolean))).sort(), [visiveis]);
  const [gestor, setGestor] = React.useState("TODOS");
  const noPedido = new Set(pedido.lojas.map((l) => nomeBase(l.nome)));
  const faltam = visiveis.filter((l) => (gestor === "TODOS" || l.gestor === gestor) && !noPedido.has(l.nome));
  const adicionar = () => atualizar((p) => ({
    ...p,
    lojas: [...p.lojas, ...faltam.map((b) => ({ id: novoId(), nome: b.nome, verba: 0, gestor: b.gestor, codAdidas: b.codAdidas }))],
  }));
  return (
    <Card className="px-4 py-3 space-y-3">
      <div>
        <h3 className="text-sm font-extrabold">Lojas da base de vendas</h3>
        <p className="text-[10px] text-gray-400 mt-0.5">{visiveis.length} lojas do seu acesso, com gestor e código adidas. Cada loja entra com o % sugerido pelas vendas dos últimos 90 dias.</p>
      </div>
      <div className="flex gap-2">
        <select aria-label="Gestor" value={gestor} onChange={(e) => setGestor(e.target.value)}
          className="flex-1 min-w-0 bg-gray-50 rounded-xl px-2 h-10 text-xs font-bold outline-none focus:ring-2 focus:ring-black/10">
          <option value="TODOS">Todos os gestores</option>
          {gestores.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <button onClick={adicionar} disabled={!faltam.length}
          className="h-10 px-3 rounded-xl bg-black text-white text-xs font-black flex items-center gap-1 disabled:bg-gray-200 disabled:text-gray-400 shrink-0">
          <Plus size={14} /> {faltam.length ? `${faltam.length} loja${faltam.length > 1 ? "s" : ""}` : "Todas já estão"}
        </button>
      </div>
    </Card>
  );
};

/** Curva de compra: quanto de cada mês (divide as peças entre as entregas). */
const CurvaCard: React.FC<{ pedido: Fw27Pedido; atualizar: EditProps["atualizar"]; travado: boolean }> = ({ pedido, atualizar, travado }) => {
  const curva = curvaDe(pedido);
  const soma = MESES_CURVA.reduce((a, m) => a + (curva[m] || 0), 0);
  const ok = Math.abs(soma - 100) < 0.05;
  const setMes = (m: string, v: number) => atualizar((p) => ({ ...p, curva: { ...curvaDe(p), [m]: v } }));
  return (
    <Card className="px-4 py-2">
      <div className="flex items-center justify-between py-2">
        <h3 className="text-sm font-extrabold">Curva de compra por mês</h3>
        {!travado && (
          <button onClick={() => atualizar((p) => ({ ...p, curva: {} }))} className="text-[10px] font-bold text-gray-400 hover:text-black flex items-center gap-1">
            <RotateCcw size={11} /> Padrão
          </button>
        )}
      </div>
      <div className="grid grid-cols-4 md:grid-cols-7 gap-2 pb-2">
        {MESES_CURVA.map((m) => (
          <div key={m} className="text-center">
            <div className="text-[9px] font-extrabold text-gray-400 uppercase mb-1">{(NOME_MES[m] || m).slice(0, 3)}</div>
            <NumInput ariaLabel={`Peso de ${NOME_MES[m]}`} decimals={1} value={curva[m] || 0} disabled={travado} onCommit={(v) => setMes(m, v)} className="w-full text-center" />
          </div>
        ))}
      </div>
      <div className={cn("flex justify-between py-3 border-t border-gray-200 text-xs font-black", ok ? "text-emerald-700" : "text-amber-700")}>
        <span>Soma</span><span>{ok ? "100% ✓" : `${pct1(soma)} (o app ajusta na proporção)`}</span>
      </div>
      <p className="text-[10px] text-gray-400 pb-2">
        Cada entrega cobre as vendas até a próxima, pesadas por esta curva; o lançamento leva 50% a mais.
        Padrão: peças vendidas por mês em 2026 (ano de Copa, como 2027). Outubro completado até o fim do mês; novembro estimado por out/2026 × (nov ÷ out de 2025).
      </p>
    </Card>
  );
};

// ============================== SUGESTÃO ==============================

const SugestaoTab: React.FC<EditProps & { linhas: Fw27Linha[]; imageMap: Record<string, string> }> = ({ pedido, atualizar, linhas, tot, travado, imageMap }) => {
  const [filtro, setFiltro] = React.useState("TODOS");
  const [busca, setBusca] = React.useState("");
  const [aberto, setAberto] = React.useState<string | null>(null);
  const [gradeAberta, setGradeAberta] = React.useState<string | null>(null);

  // Mudou a grade ou o total: as entregas voltam a ser divididas sozinhas.
  const setGrade = (p: Fw27Produto, lojaId: string, grade: Record<string, number>) =>
    atualizar((pd) => {
      const k = chaveItem(p.artigo, lojaId);
      const entregas = { ...(pd.entregas || {}) };
      const gradeEntrega = { ...(pd.gradeEntrega || {}) };
      delete entregas[k];
      delete gradeEntrega[k];
      return { ...pd, itens: { ...pd.itens, [k]: grade }, entregas, gradeEntrega };
    });
  const setTotal = (p: Fw27Produto, x: Fw27Linha, total: number) => setGrade(p, x.loja.id, gradeProporcional(p, x.grade, total, x.loja.nome));
  // Grade por entrega: mexeu numa célula, o resto (totais da loja, do tamanho e da entrega) acompanha.
  const salvarMatriz = (p: Fw27Produto, x: Fw27Linha, m: Record<string, Record<string, number>>) =>
    atualizar((pd) => ({ ...pd, gradeEntrega: { ...(pd.gradeEntrega || {}), [chaveItem(p.artigo, x.loja.id)]: m } }));
  const copiaMatriz = (x: Fw27Linha) => JSON.parse(JSON.stringify(x.gradeEntregas)) as Record<string, Record<string, number>>;
  const setCelula = (p: Fw27Produto, x: Fw27Linha, d: string, t: string, v: number) => {
    const m = copiaMatriz(x);
    m[d] = m[d] || {};
    m[d][t] = Math.round(v);
    salvarMatriz(p, x, m);
  };
  // Mudou o total de uma entrega: redistribui os tamanhos daquela entrega no formato da grade da loja.
  const setTotalEntrega = (p: Fw27Produto, x: Fw27Linha, d: string, v: number) => {
    const m = copiaMatriz(x);
    const atual = m[d] || {};
    const base = p.tamanhos.some((t) => atual[t] > 0) ? atual : x.grade;
    m[d] = gradeProporcional(p, base, Math.round(v), x.loja.nome);
    salvarMatriz(p, x, m);
  };
  // Mudou o total de um tamanho na loja: espalha pelas entregas como esse tamanho já estava (ou como as entregas estão).
  const setTamanhoTotal = (p: Fw27Produto, x: Fw27Linha, t: string, v: number) => {
    const datas = Object.keys(x.gradeEntregas).sort().filter((d) => podeComprar(p, d) || (x.entregas[d] || 0) > 0);
    let pesos = datas.map((d) => Number(x.gradeEntregas[d]?.[t] || 0));
    if (!pesos.some((w) => w > 0)) pesos = datas.map((d) => Number(x.entregas[d] || 0));
    if (!pesos.some((w) => w > 0)) pesos = datas.map((_, i) => (i === 0 ? 1 : 0));
    const qs = dividir(Math.round(v), pesos);
    const m = JSON.parse(JSON.stringify(x.gradeEntregas)) as Record<string, Record<string, number>>;
    datas.forEach((d, i) => { m[d] = m[d] || {}; m[d][t] = qs[i]; });
    salvarMatriz(p, x, m);
  };
  // Peso de cada loja ao redistribuir uma quantidade do produto: o que já tem, senão a sugestão, senão a verba.
  const pesosLojas = (ls: Fw27Linha[], atual: (x: Fw27Linha) => number) => {
    const a = ls.map(atual);
    if (a.some((v) => v > 0)) return a;
    const s = ls.map((x) => x.sugerido);
    if (s.some((v) => v > 0)) return s;
    return ls.map((x) => Number(x.loja.verba || 0) || 1);
  };
  // Mudou o total do produto: divide entre as lojas pelo % da sugestão.
  const setTotalProduto = (p: Fw27Produto, ls: Fw27Linha[], v: number) => {
    const qs = dividir(Math.round(v), pesosLojas(ls, (x) => x.sugerido));
    atualizar((pd) => {
      const itens = { ...pd.itens }; const entregas = { ...(pd.entregas || {}) }; const gradeEntrega = { ...(pd.gradeEntrega || {}) };
      ls.forEach((x, i) => { const k = chaveItem(p.artigo, x.loja.id); itens[k] = gradeProporcional(p, x.grade, qs[i], x.loja.nome); delete entregas[k]; delete gradeEntrega[k]; });
      return { ...pd, itens, entregas, gradeEntrega };
    });
  };
  // Mudou uma data do produto: divide entre as lojas pelo que cada uma já tem nela (ou pela sugestão).
  const setDataProduto = (p: Fw27Produto, ls: Fw27Linha[], d: string, v: number) => {
    const qs = dividir(Math.round(v), pesosLojas(ls, (x) => x.entregas[d] || 0));
    atualizar((pd) => {
      const gradeEntrega = { ...(pd.gradeEntrega || {}) };
      ls.forEach((x, i) => {
        const m = JSON.parse(JSON.stringify(x.gradeEntregas)) as Record<string, Record<string, number>>;
        const atual = m[d] || {};
        m[d] = gradeProporcional(p, p.tamanhos.some((t) => atual[t] > 0) ? atual : x.grade, qs[i], x.loja.nome);
        gradeEntrega[chaveItem(p.artigo, x.loja.id)] = m;
      });
      return { ...pd, gradeEntrega };
    });
  };
  const voltar = (p: Fw27Produto, lojaId?: string) =>
    atualizar((pd) => {
      const itens = { ...pd.itens };
      const entregas = { ...(pd.entregas || {}) };
      const gradeEntrega = { ...(pd.gradeEntrega || {}) };
      const bate = (k: string) => k.startsWith(p.artigo + "|") && (!lojaId || k === chaveItem(p.artigo, lojaId));
      Object.keys(itens).forEach((k) => { if (bate(k)) delete itens[k]; });
      Object.keys(entregas).forEach((k) => { if (bate(k)) delete entregas[k]; });
      Object.keys(gradeEntrega).forEach((k) => { if (bate(k)) delete gradeEntrega[k]; });
      return { ...pd, itens, entregas, gradeEntrega };
    });

  const q = busca.trim().toUpperCase();
  const visiveis = PRODUTOS.filter((p) => (filtro === "TODOS" || p.subgrupo === filtro) && (!q || p.artigo.includes(q) || p.descricao.includes(q)));
  const grupos = SUBGRUPOS.map((pk) => ({ pk, ps: visiveis.filter((p) => p.subgrupo === pk) })).filter((g) => g.ps.length);

  return (
    <div className="space-y-4">
      {/* Placar das lojas: sugerido × atual */}
      <Card className="p-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {pedido.lojas.map((l) => {
            const t = tot.porLoja[l.id];
            return (
              <div key={l.id} className="shrink-0 bg-gray-50 rounded-2xl px-3 py-2 min-w-[8.5rem]">
                <div className="text-[10px] font-extrabold truncate">{l.nome}</div>
                <div className="text-sm font-black">{pct1(t?.pctAtual || 0)} <span className="text-[10px] font-bold text-gray-400">/ {pct1(t?.pctSugerido || 0)}</span></div>
                <div className="text-[10px] font-semibold text-gray-500">{n0(t?.pecas || 0)} pçs · <Desvio atual={t?.pctAtual || 0} sugerido={t?.pctSugerido || 0} /></div>
              </div>
            );
          })}
        </div>
        <div className="text-[10px] text-gray-400 mt-2 px-1">% atual no pedido / % sugerido pela verba. Muda a cada peça editada.</div>
      </Card>

      <div className="flex items-center gap-2 bg-white rounded-2xl border border-gray-100 px-3 h-11">
        <Search size={15} className="text-gray-400" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar referência ou descrição" aria-label="Buscar produto" className="flex-1 min-w-0 bg-transparent outline-none text-sm font-semibold" />
      </div>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {["TODOS", ...SUBGRUPOS].map((f) => (
          <button key={f} onClick={() => setFiltro(f)} className={cn("shrink-0 h-9 px-3 rounded-xl text-[10px] font-extrabold border", filtro === f ? "bg-black text-white border-black" : "bg-white text-gray-600 border-gray-200")}>{f}</button>
        ))}
      </div>

      {(() => {
        // Colunas: dias 01 e 15 de jun a nov + lançamentos fora dessas datas.
        // Num subgrupo, só as datas em que algum produto dele pode comprar; em TODOS, todas.
        const colunas = filtro === "TODOS" ? CALENDARIO : CALENDARIO.filter((d) => visiveis.some((p) => podeComprar(p, d) || linhas.some((x) => x.produto.artigo === p.artigo && x.entregas[d] > 0)));
        const nCol = colunas.length + 3;
        const stickyCls = "sticky left-0 z-10";
        const celW = "min-w-[3rem] w-[3rem]";
        // Linha vertical mais forte quando muda o mês.
        const sepMes = (i: number) => (i === 0 || colunas[i - 1].slice(5, 7) !== colunas[i].slice(5, 7) ? "border-l-2 border-l-gray-300" : "border-l border-l-gray-100");
        // Caixa de digitação: tracejada quando vazia, para ver onde clicar.
        const caixa = (vazio: boolean) => (vazio ? "border border-dashed border-gray-300 bg-white/70 hover:border-gray-500" : "border border-gray-200 bg-white hover:border-gray-400");
        return (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="text-[11px] border-separate w-full" style={{ borderSpacing: 0 }}>
                <thead>
                  <tr className="text-[10px] text-gray-400">
                    <th className={cn(stickyCls, "bg-white text-left font-extrabold px-3 py-2 min-w-[11rem] w-[11rem] md:min-w-[18rem] md:w-[18rem] border-b border-gray-100")}>Produto / loja</th>
                    <th className={cn("font-extrabold px-1 py-2 border-b border-gray-100", celW)}>Total</th>
                    <th className={cn("font-extrabold px-1 py-2 border-b border-gray-100", celW)}>Sug.</th>
                    {colunas.map((d, i) => (
                      <th key={d} className={cn("font-extrabold px-1 py-2 border-b border-gray-100", sepMes(i), celW)}>
                        <div className="text-gray-600">{d.slice(8, 10)}</div>
                        <div className="text-[9px]">{mesDe(d)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grupos.map(({ pk, ps }) => (
                    <React.Fragment key={pk}>
                      <tr>
                        <td className={cn(stickyCls, "bg-gray-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest")}>{pk}</td>
                        <td colSpan={nCol - 1} className="bg-gray-50 px-2 py-1.5 text-[10px] font-bold text-gray-400">{n0(tot.porPack[pk]?.pecas || 0)} peças · {brl(tot.porPack[pk]?.valor || 0)}</td>
                      </tr>
                      {ps.map((p, pi) => {
                        const zebra = pi % 2 ? "bg-gray-50" : "bg-white";
                        const ls = linhas.filter((x) => x.produto.artigo === p.artigo);
                        const total = ls.reduce((a, x) => a + x.qtd, 0);
                        const sug = ls.reduce((a, x) => a + x.sugerido, 0);
                        const editado = ls.some((x) => x.editado);
                        const open = aberto === p.artigo;
                        const tag = tagDe(p);
                        // Data fora da regra que já tem peça (digitada antes) continua editável para poder zerar.
                        const pode = (d: string) => podeComprar(p, d) || ls.some((x) => (x.entregas[d] || 0) > 0);
                        const ini = inicioCompra(p);
                        const porData = somaPorData(ls);
                        return (
                          <React.Fragment key={p.artigo}>
                            <tr className={cn("cursor-pointer", open ? "bg-blue-50/60" : cn(zebra, "hover:bg-blue-50/30"))} onClick={() => { setAberto(open ? null : p.artigo); setGradeAberta(null); }}>
                              <td className={cn(stickyCls, open ? "bg-blue-50" : zebra, "px-3 py-2 border-b border-gray-100 border-t-2 border-t-gray-200")}>
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="hidden md:block shrink-0"><ProductImage material={p.artigo} imageMap={imageMap} size="sm" /></div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span className="text-[10px] font-extrabold text-gray-500">{p.artigo}</span>
                                      <span className={cn("text-[8px] font-black rounded px-1 py-0.5", tag.cls)}>{tag.label}</span>
                                      {editado && <span className="text-[8px] font-black rounded px-1 py-0.5 bg-amber-50 text-amber-700">EDIT.</span>}
                                    </div>
                                    <div className="text-[10px] md:text-[11px] font-extrabold leading-tight line-clamp-2">{p.descricao}</div>
                                    <div className="text-[9px] font-bold text-blue-700">R$ {p.preco.toFixed(2).replace(".", ",")} {open ? "▲" : "▼"}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-0.5 py-1 border-b border-gray-100 border-t-2 border-t-gray-200" onClick={(e) => e.stopPropagation()}>
                                <NumInput ariaLabel={`Total de ${p.artigo}`} value={total} disabled={travado} onCommit={(v) => setTotalProduto(p, ls, v)} className="w-full h-8 text-center px-0 text-xs rounded-lg bg-gray-100 font-black" />
                              </td>
                              <td className="text-center font-bold text-gray-400 border-b border-gray-100 border-t-2 border-t-gray-200">{n0(sug)}</td>
                              {colunas.map((d, i) => (
                                <td key={d} className={cn("px-0.5 py-1 text-center border-b border-gray-100 border-t-2 border-t-gray-200", sepMes(i), !pode(d) && "bg-gray-100/70")} onClick={(e) => pode(d) && e.stopPropagation()}>
                                  {pode(d) ? (
                                    <NumInput ariaLabel={`${p.artigo} entrega ${diaMes(d)}`} zeroVazio value={porData[d] || 0} disabled={travado} onCommit={(v) => setDataProduto(p, ls, d, v)}
                                      className={cn("w-full h-8 text-center px-0 text-xs rounded-lg font-black", caixa(!porData[d]), d === ini && "text-blue-700")} />
                                  ) : <span className="text-gray-300 font-bold">–</span>}
                                </td>
                              ))}
                            </tr>
                            {open && ls.map((x) => {
                              const lojaKey = p.artigo + "|" + x.loja.id;
                              const gOpen = gradeAberta === lojaKey;
                              return (
                              <React.Fragment key={x.loja.id}>
                                <tr className="bg-gray-50/50">
                                  <td className={cn(stickyCls, gOpen ? "bg-gray-100" : "bg-gray-50", "pl-6 pr-2 py-1 border-b border-gray-100")}>
                                    <button onClick={() => setGradeAberta(gOpen ? null : lojaKey)} className="w-full text-left" aria-expanded={gOpen}>
                                      <div className="text-[10px] font-extrabold truncate">{x.loja.nome}</div>
                                      <div className="text-[9px] font-semibold text-gray-400">{brl(x.valor)} · <span className="text-blue-700 font-bold">{gOpen ? "▲ fechar grade" : "▼ ver grade"}</span></div>
                                    </button>
                                  </td>
                                  <td className="px-0.5 py-1 border-b border-gray-100">
                                    <NumInput ariaLabel={`Total de ${p.artigo} na loja ${x.loja.nome}`} value={x.qtd} disabled={travado} onCommit={(v) => setTotal(p, x, v)} className="w-full h-8 text-center px-0 text-xs rounded-lg bg-gray-100 font-black" />
                                  </td>
                                  <td className="text-center font-bold text-gray-400 border-b border-gray-100">{n0(x.sugerido)}</td>
                                  {colunas.map((d, i) => (
                                    <td key={d} className={cn("px-0.5 py-1 text-center border-b border-gray-100", sepMes(i), !pode(d) && "bg-gray-100/70")}>
                                      {pode(d) ? (
                                        <NumInput ariaLabel={`${x.loja.nome} entrega ${diaMes(d)}`} zeroVazio value={x.entregas[d] || 0} disabled={travado} onCommit={(v) => setTotalEntrega(p, x, d, v)}
                                          className={cn("w-full h-8 text-center px-0 text-xs rounded-lg font-bold", caixa(!x.entregas[d]), d === ini && "text-blue-700")} />
                                      ) : <span className="text-gray-300 font-bold">–</span>}
                                    </td>
                                  ))}
                                </tr>
                                {gOpen && p.tamanhos.map((t, ti) => {
                                  const totT = Number(x.grade[t] || 0);
                                  const ultima = ti === p.tamanhos.length - 1;
                                  return (
                                    <tr key={t} className="bg-white">
                                      <td className={cn(stickyCls, "bg-white pl-10 pr-2 py-0.5", ultima && "border-b border-gray-200")}>
                                        <span className="text-[10px] font-extrabold text-gray-500">{t}</span>
                                        {ti === 0 && x.editado && !travado && (
                                          <button onClick={() => voltar(p, x.loja.id)} className="ml-2 text-[9px] font-bold text-gray-400 hover:text-black inline-flex items-center gap-0.5"><RotateCcw size={9} /> sugestão</button>
                                        )}
                                      </td>
                                      <td className={cn("px-0.5 py-0.5", ultima && "border-b border-gray-200")}>
                                        <NumInput ariaLabel={`${x.loja.nome} total tamanho ${t}`} value={totT} disabled={travado} onCommit={(v) => setTamanhoTotal(p, x, t, v)} className={cn("w-full h-7 text-center px-0 text-[11px] rounded-md bg-gray-50 font-bold", !totT && "text-gray-300")} />
                                      </td>
                                      <td className={cn(ultima && "border-b border-gray-200")} />
                                      {colunas.map((d, i) => {
                                        const q = Number(x.gradeEntregas[d]?.[t] || 0);
                                        return (
                                          <td key={d} className={cn("px-0.5 py-0.5 text-center", sepMes(i), !pode(d) && "bg-gray-100/70", ultima && "border-b border-gray-200")}>
                                            {pode(d) ? (
                                              <NumInput ariaLabel={`${x.loja.nome} ${diaMes(d)} tamanho ${t}`} zeroVazio value={q} disabled={travado} onCommit={(v) => setCelula(p, x, d, t, v)}
                                                className={cn("w-full h-7 text-center px-0 text-[11px] rounded-md", caixa(!q))} />
                                            ) : null}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  );
                                })}
                              </React.Fragment>
                              );
                            })}
                            {open && editado && !travado && (
                              <tr>
                                <td className={cn(stickyCls, "bg-white pl-6 py-2 border-b border-gray-100")}>
                                  <button onClick={() => voltar(p)} className="text-[10px] font-bold text-gray-500 hover:text-black flex items-center gap-1"><RotateCcw size={11} /> Voltar produto à sugestão</button>
                                </td>
                                <td colSpan={nCol - 1} className="border-b border-gray-100" />
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-[10px] text-gray-400 px-3 py-2 border-t border-gray-100">
              Clique no produto para abrir as lojas; clique no nome da loja para abrir a grade (um tamanho por linha, embaixo de cada entrega). Datas: lançamento, depois dias 01 e 15 até 15/11. Azul = 1ª entrega (lançamento, ou 01/06). Caixa tracejada = vazia, dá para digitar. – = antes do lançamento, não dá para comprar.
              Tudo é editável: mudar o total ou uma data do produto redistribui entre as lojas pelo % da sugestão.
            </div>
          </div>
        );
      })()}
      {!grupos.length && <Card className="text-center text-sm text-gray-400 py-10">Nenhum produto encontrado.</Card>}
    </div>
  );
};

// ============================== RESUMO ==============================

function exportarExcel(pedido: Fw27Pedido, linhas: Fw27Linha[]) {
  const head = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "000000" } } };
  const itens: any[][] = [["LOJA", "ARTIGO", "DESCRIÇÃO", "SUBGRUPO", "ENTREGA", "TAMANHO", "QTD", "PREÇO PDV", "VALOR PDV"]];
  linhas.forEach((x) => {
    if (!x.qtd) return;
    const ge = gradePorEntrega(x.produto, x.grade, x.entregas);
    Object.keys(ge).sort().forEach((d) => {
      x.produto.tamanhos.forEach((t) => {
        const q = Number(ge[d][t] || 0);
        if (q > 0) itens.push([x.loja.nome, x.produto.artigo, x.produto.descricao, x.produto.subgrupo, dataBR(d), t, q, x.produto.preco, q * x.produto.preco]);
      });
    });
  });
  const res: any[][] = [["LOJA", "VERBA", "PEÇAS", "VALOR PDV", "% NO PEDIDO"]];
  const tot = totais(pedido, linhas);
  pedido.lojas.forEach((l) => { const t = tot.porLoja[l.id]; res.push([l.nome, l.verba, t.pecas, t.valor, Math.round(t.pctAtual * 10) / 10]); });
  res.push(["TOTAL", tot.verba, tot.pecas, tot.valor, 100]);

  const wb = XLSX.utils.book_new();
  [["ITENS", itens, [16, 10, 44, 22, 12, 9, 7, 11, 12]], ["RESUMO_LOJAS", res, [20, 14, 10, 14, 12]]].forEach(([nome, dados, larg]: any) => {
    const ws = XLSX.utils.aoa_to_sheet(dados);
    ws["!cols"] = larg.map((w: number) => ({ wch: w }));
    (dados[0] as any[]).forEach((_: any, c: number) => { const ref = XLSX.utils.encode_cell({ r: 0, c }); if (ws[ref]) ws[ref].s = head; });
    XLSX.utils.book_append_sheet(wb, ws, nome);
  });
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  salvarArquivo(`Pedido_FW27_conferencia_${new Date().toISOString().slice(0, 10)}.xlsx`, new Blob([buf])).catch(() => {});
}

/** Botão com confirmação no próprio botão (o navegador do protótipo não mostra janelas de confirmação). */
const BotaoConfirmar: React.FC<{ rotulo: React.ReactNode; confirmar: string | null; onConfirm: () => void; className?: string }> = ({ rotulo, confirmar, onConfirm, className }) => {
  const [armado, setArmado] = React.useState(false);
  React.useEffect(() => { if (!armado) return; const t = setTimeout(() => setArmado(false), 4000); return () => clearTimeout(t); }, [armado]);
  return (
    <button
      onClick={() => { if (!confirmar || armado) { setArmado(false); onConfirm(); } else setArmado(true); }}
      className={cn(className, armado && "ring-2 ring-offset-2 ring-black")}
    >
      {armado ? confirmar : rotulo}
    </button>
  );
};

/** Exportar para o site da adidas: um arquivo por loja, no formato do carrinho. */
const ExportarCard: React.FC<{ pedido: Fw27Pedido; linhas: Fw27Linha[]; onRegistro: () => void }> = ({ pedido, linhas, onRegistro }) => {
  const { user } = useAuth();
  const [msg, setMsg] = React.useState<Record<string, string>>({});
  const baixar = async (l: Fw27Loja) => {
    try {
      const r = exportarLojaFornecedor(l, linhas);
      const st = await salvarArquivo(r.nomeArquivo, r.blob);
      if (st === "salvo") { await salvarRegistro(montarRegistro("exportação", user?.email || "", pedido, linhas, [l.id], user?.uid)); onRegistro(); }
      const fora = r.foraDoCarrinho.length ? ` · ${r.foraDoCarrinho.length} refs não estão no carrinho do site` : "";
      setMsg((m) => ({ ...m, [l.id]: st === "salvo" ? `Baixado: ${n0(r.pecas)} peças${fora}` : "Download cancelado" }));
    } catch (e: any) {
      setMsg((m) => ({ ...m, [l.id]: "Não deu para gerar: " + (e?.message || e) }));
    }
  };
  return (
    <Card>
      <h3 className="text-sm font-extrabold">Exportar para o site adidas</h3>
      <p className="text-[10px] text-gray-400 mt-0.5 mb-2">Um arquivo por loja, no formato de importação do site (abas Apparel e Hardware). No site, crie um carrinho para a loja e importe nele o arquivo dela: a loja é a do carrinho.</p>
      {pedido.lojas.map((l) => {
        const sem = !String(l.codAdidas || "").trim();
        const pc = linhas.filter((x) => x.loja.id === l.id).reduce((a, x) => a + (ARTIGOS_NO_CARRINHO.has(x.produto.artigo) ? x.qtd : 0), 0);
        return (
          <div key={l.id} className="flex items-center gap-2 py-2 border-t border-gray-50">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-extrabold truncate">{l.nome} <span className="text-gray-400 font-bold">· {sem ? "sem código adidas (Sold To em branco)" : l.codAdidas}</span></div>
              <div className="text-[10px] text-gray-500">{msg[l.id] || `${n0(pc)} peças de artigos do carrinho`}</div>
            </div>
            <button onClick={() => baixar(l)} className="h-9 px-3 rounded-xl bg-black text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <Download size={13} /> Baixar
            </button>
          </div>
        );
      })}
    </Card>
  );
};

/** Histórico: tudo que foi baixado ou fechado, para comparar com a carteira. */
const HistoricoCard: React.FC<{ versao: number }> = ({ versao }) => {
  const { user, userProfile } = useAuth();
  const [regs, setRegs] = React.useState<Fw27Registro[] | null>(null);
  React.useEffect(() => {
    let vivo = true;
    // Mesmo filtro de acesso do login (cadastrado no Banco): master/ALL vê tudo.
    const tudo = userProfile?.role === "master" || userProfile?.accessType === "ALL" || user?.email === "hugotjk2@gmail.com";
    listarRegistros({ uid: user?.uid, tudo, tipo: userProfile?.accessType, valores: userProfile?.accessValues }).then((r) => vivo && setRegs(r));
    return () => { vivo = false; };
  }, [versao, user?.uid, userProfile]);
  return (
    <Card>
      <h3 className="text-sm font-extrabold">Histórico de pedidos</h3>
      <p className="text-[10px] text-gray-400 mt-0.5 mb-2">Cada arquivo baixado e cada pedido fechado fica guardado aqui, com as quantidades daquele momento, para comparar com a carteira.</p>
      {regs === null && <div className="text-[11px] text-gray-400 py-2">Carregando…</div>}
      {regs && !regs.length && <div className="text-[11px] text-gray-400 py-2">Nada guardado ainda. Ao baixar um arquivo ou fechar o pedido, ele aparece aqui.</div>}
      {regs && regs.slice(0, 50).map((r) => (
        <div key={r.id} className="flex items-center gap-2 py-2 border-t border-gray-50">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-extrabold truncate">
              <span className={cn("text-[8px] font-black rounded px-1.5 py-0.5 mr-1.5", r.tipo === "fechamento" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700")}>{r.tipo === "fechamento" ? "FECHADO" : "BAIXADO"}</span>
              {r.lojas.join(", ")}
            </div>
            <div className="text-[10px] text-gray-500">{new Date(r.quando).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} · {n0(r.pecas)} pçs · {brl(r.valor)}{r.por ? ` · ${r.por}` : ""}</div>
          </div>
          <button onClick={() => salvarArquivo(`FW27_${r.tipo === "fechamento" ? "fechado" : "baixado"}_${r.quando.slice(0, 16).replace(/[^0-9]/g, "")}.xlsx`, excelDoRegistro(r)).catch(() => {})}
            className="h-8 px-2.5 rounded-lg bg-white border border-gray-200 text-[10px] font-black flex items-center gap-1"><Download size={12} /> Excel</button>
        </div>
      ))}
    </Card>
  );
};

const ResumoTab: React.FC<{ pedido: Fw27Pedido; atualizar: EditProps["atualizar"]; linhas: Fw27Linha[]; tot: ReturnType<typeof totais> }> = ({ pedido, atualizar, linhas, tot }) => {
  const [loja, setLoja] = React.useState("TODAS");
  const ls = loja === "TODAS" ? linhas : linhas.filter((x) => x.loja.id === loja);
  const pecas = ls.reduce((a, x) => a + x.qtd, 0);
  const valor = ls.reduce((a, x) => a + x.valor, 0);
  const verba = loja === "TODAS" ? tot.verba : pedido.lojas.find((l) => l.id === loja)?.verba || 0;
  const somaD = somaPorData(ls);
  const porEntrega = Object.keys(somaD).sort().map((d) => ({ d, q: somaD[d] }));
  const maxE = Math.max(1, ...porEntrega.map((e) => e.q));
  const travado = pedido.status === "enviado";
  const { user } = useAuth();
  const [versaoHist, setVersaoHist] = React.useState(0);
  const fechar = async () => {
    atualizar((p) => ({ ...p, status: "enviado", enviadoEm: new Date().toISOString() }));
    await salvarRegistro(montarRegistro("fechamento", user?.email || "", pedido, linhas, undefined, user?.uid));
    setVersaoHist((v) => v + 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {[{ id: "TODAS", nome: "TODAS" }, ...pedido.lojas].map((l) => (
          <button key={l.id} onClick={() => setLoja(l.id)} className={cn("shrink-0 h-9 px-3 rounded-xl text-[10px] font-extrabold border", loja === l.id ? "bg-black text-white border-black" : "bg-white text-gray-600 border-gray-200")}>{l.nome}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <Kpi label="Peças" value={n0(pecas)} />
        <Kpi label="Valor a PDV" value={brl(valor)} />
        <Kpi label="Da verba" value={verba ? pct1((valor / verba) * 100) : "—"} sub={`verba ${brl(verba)}`} />
      </div>
      <Card>
        <h3 className="text-sm font-extrabold mb-3">Por entrega</h3>
        <div className="flex items-end gap-1.5 h-32 overflow-x-auto no-scrollbar">
          {porEntrega.map(({ d, q }) => (
            <div key={d} className="flex-1 min-w-[2.25rem] flex flex-col items-center justify-end h-full gap-1">
              <div className="text-[9px] font-extrabold">{n0(q)}</div>
              <div className="w-full bg-black rounded-t" style={{ height: `${(q / maxE) * 70}%`, minHeight: q ? 2 : 0 }} />
              <div className="text-[8px] font-extrabold text-gray-400">{diaMes(d)}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <h3 className="text-sm font-extrabold mb-2">Por subgrupo e referência</h3>
        {SUBGRUPOS.map((pk) => {
          const lp = ls.filter((x) => x.produto.subgrupo === pk);
          const q = lp.reduce((a, x) => a + x.qtd, 0);
          if (!q) return null;
          const refs = PRODUTOS.filter((p) => p.subgrupo === pk).map((p) => ({ p, q: lp.filter((x) => x.produto.artigo === p.artigo).reduce((a, x) => a + x.qtd, 0) })).filter((r) => r.q);
          return (
            <div key={pk} className="py-2 border-t border-gray-50">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-wide">
                <span>{pk}</span><span>{n0(q)} pçs · {brl(lp.reduce((a, x) => a + x.valor, 0))}</span>
              </div>
              {refs.map(({ p, q: rq }) => (
                <div key={p.artigo} className="flex justify-between gap-2 text-[10px] font-semibold text-gray-500 mt-1">
                  <span className="truncate">{p.artigo} · {p.descricao}</span><span className="font-extrabold text-gray-900">{n0(rq)}</span>
                </div>
              ))}
            </div>
          );
        })}
      </Card>
      <ExportarCard pedido={pedido} linhas={linhas} onRegistro={() => setVersaoHist((v) => v + 1)} />
      <div className="grid md:grid-cols-2 gap-2">
        <BotaoConfirmar
          rotulo={<><Download size={16} /> Excel de conferência</>}
          confirmar={null}
          onConfirm={() => exportarExcel(pedido, linhas)}
          className="h-12 rounded-2xl bg-white border border-gray-200 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2"
        />
        {travado ? (
          <BotaoConfirmar
            rotulo={<><Unlock size={16} /> Reabrir pedido</>}
            confirmar="Toque de novo para reabrir"
            onConfirm={() => atualizar((p) => ({ ...p, status: "rascunho" }))}
            className="h-12 rounded-2xl bg-white border border-gray-200 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2"
          />
        ) : (
          <BotaoConfirmar
            rotulo={<><Lock size={16} /> Fechar pedido</>}
            confirmar="Toque de novo para fechar"
            onConfirm={fechar}
            className="h-12 rounded-2xl bg-emerald-600 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2"
          />
        )}
      </div>
      <p className="text-[10px] text-gray-400 px-2">Fechar trava o pedido para edição (só o master reabre) e guarda uma cópia no histórico. O Excel de conferência traz loja, artigo, entrega, tamanho e quantidade, para conferir antes de subir no site.</p>
      <HistoricoCard versao={versaoHist} />
    </div>
  );
};

export default Fw27Master;
