import React from "react";
import * as XLSX from "xlsx-js-style";
import {
  Sparkles, LayoutList, Store, Lightbulb, ClipboardList, Plus, Minus, Trash2, ChevronDown, ChevronUp,
  Download, Lock, Unlock, RotateCcw, Cloud, CloudOff, Loader2, Search, EyeOff,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import ProductImage from "../ProductImage";
import {
  PRODUTOS, SUBGRUPOS, LANCAMENTOS, MESES_CURVA, curvaDe, gradePorEntrega, gradeProporcional, Fw27Pedido, Fw27Loja, Fw27Linha, Fw27Produto,
  calcular, totais, pctSubgrupos, subgruposPadrao, chaveItem, gradeDe, mesDe, diaMes,
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
  : p.carryOver === "NEW COLOR" ? { label: "NOVA COR", cls: "bg-violet-50 text-violet-700" }
  : { label: "NOVO", cls: "bg-emerald-50 text-emerald-700" };

/** Campo numérico que só grava ao sair do campo ou apertar Enter. */
const NumInput: React.FC<{
  value: number; onCommit: (v: number) => void; disabled?: boolean; className?: string; decimals?: number; ariaLabel: string;
}> = ({ value, onCommit, disabled, className, decimals = 0, ariaLabel }) => {
  const fmt = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: decimals });
  const [txt, setTxt] = React.useState(fmt(value));
  const [foco, setFoco] = React.useState(false);
  React.useEffect(() => { if (!foco) setTxt(fmt(value)); }, [value, foco]);
  const commit = () => {
    const v = Number(String(txt).replace(/\./g, "").replace(",", "."));
    if (!isNaN(v) && v >= 0) onCommit(v); else setTxt(fmt(value));
  };
  return (
    <input
      inputMode="decimal" aria-label={ariaLabel} disabled={disabled} value={txt}
      onFocus={(e) => { setFoco(true); e.target.select(); }}
      onBlur={() => { setFoco(false); commit(); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
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
  const { pedido, atualizar, estado, erro, salvoEm } = useFw27Pedido(user?.uid);
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
            <EyeOff size={11} /> Só master
          </span>
        </div>
        {erro && <p className="text-[10px] text-amber-700 mt-3">{erro}</p>}
      </div>

      <div className="p-4 md:p-6 space-y-4 max-w-5xl w-full mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
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
  const novos = PRODUTOS.filter((p) => p.carryOver === "TOTALLY NEW").length;
  const co = PRODUTOS.filter((p) => p.carryOver === "CARRY OVER").length;
  const nc = PRODUTOS.length - novos - co;
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
        <Kpi label="Referências" value={PRODUTOS.length} sub={`${novos} novas · ${co} carry over · ${nc} nova cor`} />
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
    atualizar((p) => ({ ...p, lojas: [...p.lojas, { id: novoId(), nome: nm, verba: 0 }] }));
    setNome("");
  };
  const delLoja = (l: Fw27Loja) => {
    if (!window.confirm(`Tirar a loja ${l.nome} do pedido? O que foi editado nela se perde.`)) return;
    atualizar((p) => {
      const itens = { ...p.itens };
      Object.keys(itens).forEach((k) => { if (k.endsWith("|" + l.id)) delete itens[k]; });
      return { ...p, lojas: p.lojas.filter((x) => x.id !== l.id), itens };
    });
  };
  const setPctLoja = (l: Fw27Loja, v: number) => {
    // muda o % mantendo a verba total: a verba da loja vira v% do total
    const total = tot.verba || 0;
    if (!total) return;
    const alvo = Math.min(total, Math.round((total * Math.min(v, 100)) / 100));
    atualizar((p) => {
      const outras = p.lojas.filter((x) => x.id !== l.id);
      const somaOutras = outras.reduce((a, x) => a + Number(x.verba || 0), 0);
      const resto = total - alvo;
      return {
        ...p,
        lojas: p.lojas.map((x) => x.id === l.id ? { ...x, verba: alvo }
          : { ...x, verba: Math.round(somaOutras ? (Number(x.verba || 0) / somaOutras) * resto : resto / (outras.length || 1)) }),
      };
    });
  };
  const setPack = (pk: string, v: number) =>
    atualizar((p) => ({ ...p, subgrupos: { ...pctSubgrupos(p), [pk]: v } }));

  return (
    <div className="space-y-4">
      <Card className="bg-black text-white border-black">
        <div className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider">Verba FW27 total (a preço PDV)</div>
        <div className="text-3xl font-black mt-1">{brl(tot.verba)}</div>
        <div className="text-[11px] text-gray-400 mt-1">Soma das verbas das lojas. No pedido: {brl(tot.valor)} ({tot.verba ? pct1((tot.valor / tot.verba) * 100) : "—"} da verba).</div>
      </Card>

      <Card className="px-4 py-2">
        <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_7rem_2rem] gap-2 py-2 text-[9px] font-extrabold text-gray-400 uppercase tracking-wider">
          <span>Loja</span><span className="text-center">%</span><span className="text-right">Verba R$</span><span />
        </div>
        {pedido.lojas.map((l) => {
          const t = tot.porLoja[l.id];
          return (
            <div key={l.id} className="grid grid-cols-[minmax(0,1fr)_4.5rem_7rem_2rem] gap-2 items-center py-2.5 border-t border-gray-50">
              <div className="min-w-0">
                <div className="text-xs font-extrabold truncate">{l.nome}</div>
                <div className="text-[10px] font-semibold text-gray-400 mt-0.5">
                  No pedido: {pct1(t?.pctAtual || 0)} · {brl(t?.valor || 0)} {t && t.valor > 0 && <>· <Desvio atual={t.pctAtual} sugerido={t.pctSugerido} /></>}
                </div>
              </div>
              <NumInput ariaLabel={`% da loja ${l.nome}`} decimals={1} value={t?.pctSugerido || 0} disabled={travado || !tot.verba} onCommit={(v) => setPctLoja(l, v)} className="w-full" />
              <NumInput ariaLabel={`Verba da loja ${l.nome}`} value={l.verba} disabled={travado} onCommit={(v) => setLoja(l.id, { verba: v })} className="w-full" />
              <button aria-label={`Tirar ${l.nome}`} disabled={travado} onClick={() => delLoja(l)} className="h-9 w-8 flex items-center justify-center text-gray-300 hover:text-red-500 disabled:opacity-30"><Trash2 size={15} /></button>
            </div>
          );
        })}
        {!travado && (
          <div className="flex gap-2 py-3 border-t border-gray-100">
            <input
              value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLoja()}
              placeholder="Nome da loja (ex.: AERO FLA)" aria-label="Nome da nova loja"
              className="flex-1 min-w-0 bg-gray-50 rounded-xl px-3 h-10 text-sm font-bold outline-none focus:ring-2 focus:ring-black/10 uppercase"
            />
            <button onClick={addLoja} className="h-10 px-3 rounded-xl bg-black text-white text-xs font-black flex items-center gap-1"><Plus size={14} /> Loja</button>
          </div>
        )}
      </Card>
      <p className="text-[10px] text-gray-400 px-2">Mudar o % de uma loja mantém a verba total e recalcula a verba dela. A lista de lojas e gestores vai ser carregada da planilha quando chegar.</p>

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
                <div className="text-[10px] font-semibold text-gray-400">{PRODUTOS.filter((p) => p.subgrupo === pk).length} refs · {brl((tot.verba * (pct[pk] || 0)) / 100)}</div>
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
        Padrão: proporcional ao número de referências de cada subgrupo. Quando as vendas do PDV chegarem, o padrão passa a ser o peso de cada subgrupo (comprador) nas vendas de jun–nov.
        Padrão atual: {SUBGRUPOS.slice(0, 3).map((pk) => `${pk} ${pct1(subgruposPadrao()[pk])}`).join(", ")}…
      </p>
    </div>
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
        Padrão: meses iguais. Quando as vendas do PDV chegarem, o padrão passa a ser 2026 (ano de Copa, como 2027), e não 2025, que vendeu mais em jun/jul.
      </p>
    </Card>
  );
};

// ============================== SUGESTÃO ==============================

const SugestaoTab: React.FC<EditProps & { linhas: Fw27Linha[]; imageMap: Record<string, string> }> = ({ pedido, atualizar, linhas, tot, travado, imageMap }) => {
  const [filtro, setFiltro] = React.useState("TODOS");
  const [busca, setBusca] = React.useState("");
  const [aberto, setAberto] = React.useState<string | null>(null);
  const [lojaAberta, setLojaAberta] = React.useState<string | null>(null);

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
  const setTotal = (p: Fw27Produto, x: Fw27Linha, total: number) => setGrade(p, x.loja.id, gradeProporcional(p, x.grade, total));
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
    m[d] = gradeProporcional(p, base, Math.round(v));
    salvarMatriz(p, x, m);
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

      {grupos.map(({ pk, ps }) => (
        <div key={pk} className="space-y-2">
          <div className="flex justify-between items-baseline px-1">
            <div className="text-[11px] font-black uppercase tracking-widest">{pk}</div>
            <div className="text-[10px] font-bold text-gray-400">{n0(tot.porPack[pk]?.pecas || 0)} peças · {brl(tot.porPack[pk]?.valor || 0)}</div>
          </div>
          {ps.map((p) => {
            const ls = linhas.filter((x) => x.produto.artigo === p.artigo);
            const total = ls.reduce((a, x) => a + x.qtd, 0);
            const sug = ls.reduce((a, x) => a + x.sugerido, 0);
            const editado = ls.some((x) => x.editado);
            const open = aberto === p.artigo;
            const tag = tagDe(p);
            const mesesProd = somaPorMes(somaPorData(ls));
            return (
              <div key={p.artigo} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <button onClick={() => { setAberto(open ? null : p.artigo); setLojaAberta(null); }} className="w-full text-left p-3 flex gap-3">
                  <ProductImage material={p.artigo} imageMap={imageMap} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-extrabold text-gray-400">{p.artigo}</span>
                      <span className={cn("text-[8px] font-black rounded px-1.5 py-0.5", tag.cls)}>{tag.label}</span>
                      {editado && <span className="text-[8px] font-black rounded px-1.5 py-0.5 bg-amber-50 text-amber-700">EDITADO</span>}
                    </div>
                    <div className="text-xs font-extrabold leading-tight mt-0.5">{p.descricao}</div>
                    <div className="text-[10px] font-bold text-blue-700 mt-1">Lança {diaMes(p.lancamento)} · finaliza {diaMes(p.fim)} · PDV R$ {p.preco.toFixed(2).replace(".", ",")}</div>
                    {mesesProd.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {mesesProd.map((m) => (
                          <span key={m.mes} className="text-[9px] font-bold bg-gray-50 rounded-md px-1.5 py-0.5">{(NOME_MES[m.mes] || m.mes).slice(0, 3).toUpperCase()} <b>{n0(m.q)}</b>{m.n > 1 ? ` · ${m.n}x` : ""}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-black leading-none">{n0(total)}</div>
                    <div className="text-[9px] font-bold text-gray-400">peças</div>
                    {editado && <div className="text-[9px] font-bold text-gray-400">sug. {n0(sug)}</div>}
                    <div className="text-gray-300 mt-1 flex justify-end">{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                  </div>
                </button>
                {open && (
                  <div className="bg-gray-50/70 border-t border-gray-100 px-3 pb-3">
                    {ls.map((x) => {
                      const lopen = lojaAberta === x.loja.id;
                      return (
                        <div key={x.loja.id} className="border-b border-gray-100 last:border-0">
                          <div className="flex items-center gap-2 py-2">
                            <button onClick={() => setLojaAberta(lopen ? null : x.loja.id)} className="flex-1 min-w-0 text-left">
                              <div className="text-[11px] font-extrabold truncate">{x.loja.nome}</div>
                              <div className="text-[10px] font-semibold text-gray-400">sugerido {n0(x.sugerido)} · {brl(x.valor)} · {(() => { const ne = Object.values(x.entregas).filter((q) => q > 0).length; return ne === 1 ? "1 entrega" : `${ne} entregas`; })()} {lopen ? "▲" : "▼"}</div>
                            </button>
                            <button aria-label="Menos" disabled={travado || x.qtd <= 0} onClick={() => setTotal(p, x, x.qtd - 1)} className="h-9 w-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center disabled:opacity-30"><Minus size={14} /></button>
                            <NumInput ariaLabel={`Peças de ${p.artigo} na loja ${x.loja.nome}`} value={x.qtd} disabled={travado} onCommit={(v) => setTotal(p, x, v)} className="w-16 text-center bg-white border border-gray-200" />
                            <button aria-label="Mais" disabled={travado} onClick={() => setTotal(p, x, x.qtd + 1)} className="h-9 w-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center disabled:opacity-30"><Plus size={14} /></button>
                          </div>
                          {lopen && (
                            <div className="bg-white rounded-2xl border border-gray-100 p-3 mb-2">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider">Grade por entrega · {n0(x.qtd)} peças</span>
                                {x.editado && !travado && (
                                  <button onClick={() => voltar(p, x.loja.id)} className="text-[10px] font-bold text-gray-400 hover:text-black flex items-center gap-1"><RotateCcw size={11} /> Voltar à sugestão</button>
                                )}
                              </div>
                              <div className="overflow-x-auto no-scrollbar">
                                <table className="w-full table-fixed text-[10px] border-separate" style={{ borderSpacing: "2px", minWidth: `${2.6 + (p.tamanhos.length + 1) * 2.1}rem` }}>
                                  <thead>
                                    <tr className="text-gray-400">
                                      <th className="text-left font-extrabold pr-1 w-[2.6rem]">Entr.</th>
                                      {p.tamanhos.map((t) => <th key={t} className="font-extrabold">{t}</th>)}
                                      <th className="font-extrabold">Tot.</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {Object.keys(x.gradeEntregas).sort().map((d) => {
                                      const vazio = !x.entregas[d];
                                      return (
                                        <tr key={d}>
                                          <td className={cn("pr-1 font-extrabold whitespace-nowrap", d === p.lancamento ? "text-blue-700" : vazio ? "text-gray-300" : "")}>{diaMes(d)}</td>
                                          {p.tamanhos.map((t) => (
                                            <td key={t}>
                                              <NumInput ariaLabel={`${diaMes(d)} tamanho ${t}`} value={x.gradeEntregas[d]?.[t] || 0} disabled={travado} onCommit={(v) => setCelula(p, x, d, t, v)} className={cn("w-full h-8 text-center px-0 text-xs rounded-lg", vazio && "text-gray-300")} />
                                            </td>
                                          ))}
                                          <td>
                                            <NumInput ariaLabel={`Total da entrega ${diaMes(d)}`} value={x.entregas[d] || 0} disabled={travado} onCommit={(v) => setTotalEntrega(p, x, d, v)} className={cn("w-full h-8 text-center px-0 text-xs rounded-lg bg-gray-100", vazio && "text-gray-300")} />
                                          </td>
                                        </tr>
                                      );
                                    })}
                                    <tr className="text-gray-500">
                                      <td className="pr-1 font-black">Total</td>
                                      {p.tamanhos.map((t) => <td key={t} className="text-center font-black">{n0(x.grade[t] || 0)}</td>)}
                                      <td className="text-center font-black text-gray-900">{n0(x.qtd)}</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                              <div className="text-[9px] text-gray-400 mt-2">
                                Azul = lançamento; depois dias 01 e 15. Linhas em cinza foram puladas para a grade não ficar pequena (mínimo {p.tamanhos.length} peças por entrega). Mudar o total da entrega redistribui os tamanhos dela.
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {editado && !travado && (
                      <button onClick={() => voltar(p)} className="mt-2 text-[10px] font-bold text-gray-500 hover:text-black flex items-center gap-1"><RotateCcw size={11} /> Voltar este produto à sugestão em todas as lojas</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
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
  XLSX.writeFile(wb, `Pedido_FW27_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

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
      <div className="grid md:grid-cols-2 gap-2">
        <button onClick={() => exportarExcel(pedido, linhas)} className="h-12 rounded-2xl bg-black text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2">
          <Download size={16} /> Exportar Excel
        </button>
        {travado ? (
          <button onClick={() => window.confirm("Reabrir o pedido para edição?") && atualizar((p) => ({ ...p, status: "rascunho" }))} className="h-12 rounded-2xl bg-white border border-gray-200 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2">
            <Unlock size={16} /> Reabrir pedido
          </button>
        ) : (
          <button onClick={() => window.confirm("Fechar o pedido? Ele fica travado até ser reaberto.") && atualizar((p) => ({ ...p, status: "enviado", enviadoEm: new Date().toISOString() }))} className="h-12 rounded-2xl bg-emerald-600 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2">
            <Lock size={16} /> Fechar pedido
          </button>
        )}
      </div>
      <p className="text-[10px] text-gray-400 px-2">O Excel sai num formato simples (loja, artigo, tamanho, quantidade). Troco pelo modelo de importação do fornecedor quando você me mandar.</p>
    </div>
  );
};

export default Fw27Master;
