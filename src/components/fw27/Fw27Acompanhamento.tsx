/**
 * Acompanhamento (só master e admin): o que cada franqueado baixou e o que está montando agora.
 * - Arquivos baixados por loja: a última versão de cada loja + as anteriores; refaz o arquivo do CLICK igual ao baixado.
 * - Baixar todos: .zip com o arquivo do CLICK de cada loja e um Excel único com todas as lojas.
 * - Pedidos em andamento: o pedido salvo de cada login (coleção fw27Pedidos), antes mesmo de baixar.
 * Admin vê só as lojas do seu acesso (mesma regra do resto do app).
 */
import React from "react";
import * as XLSX from "xlsx-js-style";
import { Download, ChevronDown, ChevronUp, RefreshCw, Bell, FileArchive, AlertTriangle, Search, FileSpreadsheet, Lock, Pencil, RotateCcw } from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuth } from "../../context/AuthContext";
import { salvarArquivo } from "../../lib/salvarArquivo";
import { arquivoClickDeItens, zipArquivos, ARTIGOS_NO_CARRINHO } from "../../services/fw27Exportar";
import { listarRegistros, listarPedidosTodos, montarRegistro, excelDoRegistro, Fw27Registro, ItemRegistro, PedidoDeLogin } from "../../services/fw27Historico";
import { lerReset, gravarReset, diferencasDoPadrao, Fw27Reset } from "../../services/fw27Reset";
import { PRODUTOS, precoBase, aplicarVerbas, calcular, totais, lojaNaBase, Fw27Pedido } from "../../services/fw27";

// ---------------- dados ----------------

const PROD = new Map(PRODUTOS.map((p) => [p.artigo, p]));
const custoDe = (artigo: string, precoPdv: number) => { const p = PROD.get(artigo); return p ? precoBase(p) : precoPdv / 2.28; };

/** Uma versão baixada (ou fechada) de uma loja. */
export interface VersaoLoja { id: string; loja: string; cod: string; gestor: string; quando: string; tipo: Fw27Registro["tipo"]; por: string; itens: ItemRegistro[]; pecas: number; custo: number; foraClick: number; refsFora: number; datas?: Record<string, string> }

function versoesDe(regs: Fw27Registro[]): VersaoLoja[] {
  const out: VersaoLoja[] = [];
  regs.filter((r) => r.tipo !== "antes da atualização").forEach((r) => {
    const porLoja = new Map<string, ItemRegistro[]>();
    r.lojas.forEach((l) => porLoja.set(l, []));
    r.itens.forEach((i) => { if (!porLoja.has(i[0])) porLoja.set(i[0], []); porLoja.get(i[0])!.push(i); });
    porLoja.forEach((itens, loja) => {
      const fora = itens.filter((i) => !ARTIGOS_NO_CARRINHO.has(i[2]));
      out.push({
        id: r.id + "|" + loja, loja, cod: itens[0]?.[1] || "", quando: r.quando, tipo: r.tipo, por: r.por, itens, datas: r.datas,
        gestor: lojaNaBase(loja)?.gestor || (r.gestores?.length === 1 ? r.gestores[0] : ""),
        pecas: itens.reduce((a, i) => a + i[6], 0),
        custo: itens.reduce((a, i) => a + i[6] * custoDe(i[2], i[7]), 0),
        foraClick: fora.reduce((a, i) => a + i[6], 0),
        refsFora: new Set(fora.map((i) => i[2])).size,
      });
    });
  });
  return out.sort((a, b) => (a.quando < b.quando ? 1 : -1));
}

const chaveVisto = (uid?: string) => `fw27-acomp-visto-${uid || "x"}`;
const lerVisto = (uid?: string) => { try { return localStorage.getItem(chaveVisto(uid)) || ""; } catch { return ""; } };
const gravarVisto = (uid?: string) => { try { localStorage.setItem(chaveVisto(uid), new Date().toISOString()); } catch { /* sem armazenamento */ } };

/** Carrega histórico e pedidos de todos (master) ou das lojas do admin. Também conta os downloads novos para o selo da aba. */
export function useAcompanhamento(ligado: boolean) {
  const { user, userProfile } = useAuth();
  const [regs, setRegs] = React.useState<Fw27Registro[] | null>(null);
  const [pedidos, setPedidos] = React.useState<PedidoDeLogin[] | null | undefined>(undefined);
  const [versao, setVersao] = React.useState(0);
  const tudo = userProfile?.role === "master" || userProfile?.accessType === "ALL" || user?.email === "hugotjk2@gmail.com";
  // Só recarrega quando muda o login/acesso (texto), não a cada desenho da tela.
  const tipo = userProfile?.accessType;
  const valoresTxt = ((userProfile?.accessValues as string[]) || []).join("|");
  React.useEffect(() => {
    if (!ligado) return;
    let vivo = true;
    listarRegistros({ uid: user?.uid, tudo, tipo, valores: valoresTxt ? valoresTxt.split("|") : [] }).then((r) => vivo && setRegs(r));
    listarPedidosTodos().then((p) => vivo && setPedidos(p));
    return () => { vivo = false; };
  }, [ligado, versao, user?.uid, tipo, valoresTxt, tudo]);
  const visto = lerVisto(user?.uid);
  const novos = (regs || []).filter((r) => r.quando > visto && r.porUid !== user?.uid).length;
  return { regs, pedidos, novos, recarregar: () => setVersao((v) => v + 1), tudo };
}

// ---------------- visual ----------------

const n0 = (v: number) => Math.round(v || 0).toLocaleString("pt-BR");
const brl = (v: number) => "R$ " + Math.round(v || 0).toLocaleString("pt-BR");
const pct0 = (v: number) => Math.round(v || 0) + "%";
const quandoBR = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
function haQuanto(iso?: string) {
  if (!iso) return "—";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 2) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}
const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <div className={cn("bg-white rounded-3xl border border-gray-100 shadow-sm p-4", className)}>{children}</div>
);
const Kpi: React.FC<{ label: string; value: React.ReactNode; sub?: React.ReactNode; destaque?: boolean }> = ({ label, value, sub, destaque }) => (
  <Card className={cn("p-3", destaque && "border-blue-200 bg-blue-50/40")}>
    <div className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider">{label}</div>
    <div className={cn("text-xl font-black mt-1", destaque ? "text-blue-700" : "text-gray-900")}>{value}</div>
    {sub && <div className="text-[10px] font-bold text-gray-400 mt-0.5">{sub}</div>}
  </Card>
);
const Botao: React.FC<{ onClick?: () => void; disabled?: boolean; title?: string; escuro?: boolean; children: React.ReactNode }> = ({ onClick, disabled, title, escuro, children }) => (
  <button onClick={onClick} disabled={disabled} title={title}
    className={cn("h-8 px-2.5 rounded-lg text-[10px] font-black flex items-center gap-1 shrink-0 disabled:opacity-35 disabled:cursor-not-allowed",
      escuro ? "bg-black text-white" : "bg-white border border-gray-200 text-gray-800")}>{children}</button>
);

// ---------------- arquivos ----------------

const lancamentoDe = (a: string) => PROD.get(a)?.lancamento;
const clickDe = (v: VersaoLoja) => arquivoClickDeItens(v.loja, v.cod, v.itens.map((i) => [i[2], i[4], i[5], i[6]] as [string, string, string, number]), v.datas, lancamentoDe);
const excelDe = (v: VersaoLoja) => excelDoRegistro({ id: v.id, quando: v.quando, tipo: v.tipo, por: v.por, lojas: [v.loja], pecas: v.pecas, valor: 0, itens: v.itens });
const carimbo = (iso: string) => iso.slice(0, 16).replace(/[^0-9]/g, "");

function excelConsolidado(vs: VersaoLoja[]): Blob {
  const head = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "000000" } } };
  const itens: any[][] = [["LOJA", "COD ADIDAS", "GESTOR", "ARTIGO", "DESCRIÇÃO", "SUBGRUPO", "ENTREGA", "TAMANHO", "QTD", "PREÇO PDV", "CUSTO APROX.", "VALOR CUSTO APROX.", "SOBE POR", "BAIXADO EM", "POR"]];
  const res: any[][] = [["LOJA", "COD ADIDAS", "GESTOR", "PEÇAS", "VALOR CUSTO APROX.", "PEÇAS CLICK", "PEÇAS ZSOL", "BAIXADO EM", "POR"]];
  vs.forEach((v) => {
    v.itens.forEach(([loja, cod, art, desc, d, t, q, preco]) => {
      const c = custoDe(art, preco);
      itens.push([loja, cod, v.gestor, art, desc, PROD.get(art)?.subgrupo || "", `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`, t, q, preco, Math.round(c * 100) / 100, Math.round(q * c * 100) / 100,
        ARTIGOS_NO_CARRINHO.has(art) ? "CLICK" : "ZSOL", quandoBR(v.quando), v.por]);
    });
    res.push([v.loja, v.cod, v.gestor, v.pecas, Math.round(v.custo), v.pecas - v.foraClick, v.foraClick, quandoBR(v.quando), v.por]);
  });
  const wb = XLSX.utils.book_new();
  [["RESUMO_LOJAS", res, [22, 12, 14, 8, 16, 11, 10, 14, 26]], ["ITENS", itens, [20, 12, 14, 10, 40, 12, 11, 9, 7, 10, 11, 14, 9, 14, 26]]].forEach(([nome, dados, larg]: any) => {
    const ws = XLSX.utils.aoa_to_sheet(dados);
    ws["!cols"] = larg.map((w: number) => ({ wch: w }));
    (dados[0] as any[]).forEach((_: any, c: number) => { const ref = XLSX.utils.encode_cell({ r: 0, c }); if (ws[ref]) ws[ref].s = head; });
    XLSX.utils.book_append_sheet(wb, ws, nome);
  });
  return new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })]);
}

// ---------------- tela ----------------

type Periodo = "tudo" | "hoje" | "7d";

const Fw27Acompanhamento: React.FC<{ dados: ReturnType<typeof useAcompanhamento> }> = ({ dados }) => {
  const { user, userProfile } = useAuth();
  const { regs, pedidos, recarregar, tudo } = dados;
  // "Novo" = chegou depois da última visita; a marca é gravada ao abrir, mas os selos ficam até sair da aba.
  const [vistoAntes] = React.useState(() => lerVisto(user?.uid));
  React.useEffect(() => { gravarVisto(user?.uid); }, [user?.uid]);

  const [busca, setBusca] = React.useState("");
  const [gestor, setGestor] = React.useState("TODOS");
  const [periodo, setPeriodo] = React.useState<Periodo>("tudo");
  const [soNovos, setSoNovos] = React.useState(false);
  const [abertas, setAbertas] = React.useState<Record<string, boolean>>({});
  const [abertosPed, setAbertosPed] = React.useState<Record<string, boolean>>({});
  const [msg, setMsg] = React.useState("");
  const [reset, setReset] = React.useState<Fw27Reset | null>(null);
  React.useEffect(() => { lerReset().then(setReset); }, []);

  const versoes = React.useMemo(() => versoesDe(regs || []), [regs]);
  const porLoja = React.useMemo(() => {
    const m = new Map<string, VersaoLoja[]>();
    versoes.forEach((v) => { if (!m.has(v.loja)) m.set(v.loja, []); m.get(v.loja)!.push(v); });
    return m;
  }, [versoes]);

  // Pedidos em andamento (admin: só os que têm lojas do seu acesso).
  const valores = new Set(((userProfile?.accessValues as string[]) || []).map((x) => String(x).toUpperCase().trim()));
  const daMinhaConta = (gestorLoja?: string, nome?: string) => tudo
    || (userProfile?.accessType === "GESTOR" && valores.has(String(gestorLoja || "").toUpperCase()))
    || (userProfile?.accessType === "LOJA" && valores.has(String(nome || "").toUpperCase()));
  const andamento = React.useMemo(() => (pedidos || [])
    .filter((x) => x.uid !== user?.uid && x.pedido?.lojas?.length)
    .map((x) => {
      const pedido = aplicarVerbas(x.pedido as Fw27Pedido);
      const linhas = calcular(pedido);
      return { ...x, pedido, linhas, tot: totais(pedido, linhas) };
    })
    .filter((x) => x.pedido.lojas.some((l) => daMinhaConta(l.gestor, l.nome)))
    .sort((a, b) => ((a.pedido.atualizadoEm || "") < (b.pedido.atualizadoEm || "") ? 1 : -1)), [pedidos, user?.uid, tudo]);

  const gestores = Array.from(new Set([...versoes.map((v) => v.gestor), ...andamento.flatMap((x) => x.pedido.lojas.map((l) => l.gestor || ""))].filter(Boolean))).sort();
  const desde = periodo === "hoje" ? new Date(new Date().setHours(0, 0, 0, 0)).toISOString() : periodo === "7d" ? new Date(Date.now() - 7 * 864e5).toISOString() : "";
  const lojasFiltradas = Array.from(porLoja.entries())
    .map(([loja, vs]) => ({ loja, vs, ult: vs[0] }))
    .filter(({ loja, ult }) => (!busca || loja.toLowerCase().includes(busca.toLowerCase()) || ult.por.toLowerCase().includes(busca.toLowerCase()))
      && (gestor === "TODOS" || ult.gestor === gestor) && (!desde || ult.quando >= desde) && (!soNovos || ult.quando > vistoAntes))
    .sort((a, b) => (a.ult.quando < b.ult.quando ? 1 : -1));
  const ultimas = lojasFiltradas.map((x) => x.ult);

  const lojasComPedido = new Set(andamento.flatMap((x) => x.pedido.lojas.map((l) => l.nome)));
  const lojasBaixadas = new Set(porLoja.keys());
  const totalLojas = new Set([...lojasComPedido, ...lojasBaixadas]).size;
  const novosAgora = versoes.filter((v) => v.quando > vistoAntes && v.por !== user?.email);

  const baixar = async (nome: string, blob: Blob) => { try { await salvarArquivo(nome, blob); } catch { /* cancelado */ } };
  const baixarTodosClick = async () => {
    if (!ultimas.length) return;
    setMsg("Montando o .zip…");
    const arqs = ultimas.map((v) => { const r = clickDe(v); return { nome: r.nomeArquivo, blob: r.blob }; });
    await baixar(`FW27_CLICK_${ultimas.length}_lojas_${carimbo(new Date().toISOString())}.zip`, await zipArquivos(arqs));
    setMsg(`${ultimas.length} arquivos do CLICK no .zip (a última versão de cada loja da lista).`);
  };

  return (
    <div className="space-y-4">
      <Card className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-base font-extrabold">Acompanhamento dos franqueados</h2>
          <p className="text-[11px] text-gray-500 mt-0.5 max-w-2xl">
            Tudo que os franqueados baixaram, loja por loja, e o que estão montando agora.
            {tudo ? " Você vê todas as lojas." : " Você vê as lojas do seu acesso."}
          </p>
        </div>
        <Botao onClick={recarregar}><RefreshCw size={12} /> Atualizar</Botao>
      </Card>

      {novosAgora.length > 0 && (
        <div className="rounded-2xl bg-blue-600 text-white px-4 py-3 flex items-center gap-3">
          <Bell size={18} className="shrink-0" />
          <div className="text-xs font-bold flex-1 min-w-0">
            {novosAgora.length === 1 ? "1 arquivo novo" : `${novosAgora.length} arquivos novos`} desde a sua última visita ({vistoAntes ? quandoBR(vistoAntes) : "primeira vez"}):{" "}
            <span className="font-extrabold">{Array.from(new Set(novosAgora.map((v) => v.loja))).join(", ")}</span>
          </div>
          <button onClick={() => setSoNovos((s) => !s)} className="h-8 px-3 rounded-lg bg-white text-blue-700 text-[10px] font-black shrink-0">{soNovos ? "Mostrar todos" : "Ver só os novos"}</button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Kpi label="Lojas que já baixaram" value={`${lojasBaixadas.size} de ${totalLojas || "—"}`} sub={totalLojas ? `${pct0((lojasBaixadas.size / totalLojas) * 100)} das lojas com pedido` : undefined} />
        <Kpi label="Peças baixadas" value={n0(versoes.length ? Array.from(porLoja.values()).reduce((a, vs) => a + vs[0].pecas, 0) : 0)} sub="última versão de cada loja" />
        <Kpi label="Valor a custo" value={brl(Array.from(porLoja.values()).reduce((a, vs) => a + vs[0].custo, 0))} sub="aproximado" />
        <Kpi label="Novos desde sua visita" value={novosAgora.length} sub={vistoAntes ? `última visita ${quandoBR(vistoAntes)}` : "primeira visita"} destaque={novosAgora.length > 0} />
      </div>

      {/* ---------------- arquivos baixados ---------------- */}
      <Card>
        <div className="flex items-start justify-between gap-2 flex-wrap mb-3">
          <div>
            <h3 className="text-sm font-extrabold">Arquivos baixados por loja</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">A última versão de cada loja. O arquivo do CLICK sai igual ao que o franqueado baixou.</p>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <Botao escuro onClick={baixarTodosClick} disabled={!ultimas.length}><FileArchive size={12} /> CLICK de todas (.zip)</Botao>
            <Botao disabled title="Aguardando o modelo da planilha ZSOL"><FileArchive size={12} /> ZSOL de todas (.zip)</Botao>
            <Botao onClick={() => baixar(`FW27_todas_as_lojas_${carimbo(new Date().toISOString())}.xlsx`, excelConsolidado(ultimas))} disabled={!ultimas.length}><FileSpreadsheet size={12} /> Excel com todas</Botao>
          </div>
        </div>
        {msg && <p className="text-[10px] font-bold text-gray-500 mb-2">{msg}</p>}

        <div className="flex gap-2 flex-wrap items-center mb-2">
          <div className="flex items-center gap-1.5 bg-gray-50 rounded-xl px-2.5 h-9 flex-1 min-w-[12rem]">
            <Search size={13} className="text-gray-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar loja ou e-mail" className="bg-transparent outline-none text-xs font-semibold flex-1 min-w-0" />
          </div>
          <select value={gestor} onChange={(e) => setGestor(e.target.value)} className="h-9 rounded-xl bg-gray-50 px-2 text-xs font-bold outline-none" aria-label="Gestor">
            <option value="TODOS">Todos os gestores</option>
            {gestores.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {([["tudo", "Tudo"], ["hoje", "Hoje"], ["7d", "7 dias"]] as const).map(([id, r]) => (
              <button key={id} onClick={() => setPeriodo(id)} className={cn("h-7 px-3 rounded-lg text-[10px] font-extrabold", periodo === id ? "bg-black text-white" : "text-gray-500")}>{r}</button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 cursor-pointer">
            <input type="checkbox" className="accent-black" checked={soNovos} onChange={(e) => setSoNovos(e.target.checked)} /> Só novos
          </label>
        </div>

        {regs === null && <div className="text-[11px] text-gray-400 py-3">Carregando…</div>}
        {regs && !lojasFiltradas.length && <div className="text-[11px] text-gray-400 py-3">Nenhum arquivo {versoes.length ? "com esses filtros" : "baixado ainda"}.</div>}
        {lojasFiltradas.map(({ loja, vs, ult }) => {
          const novo = ult.quando > vistoAntes && ult.por !== user?.email;
          const aberto = !!abertas[loja];
          return (
            <div key={loja} className={cn("border-t border-gray-50 py-2.5", novo && "bg-blue-50/40 -mx-4 px-4")}>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex-1 min-w-[14rem]">
                  <div className="text-xs font-extrabold flex items-center gap-1.5 flex-wrap">
                    {novo && <span className="text-[8px] font-black bg-blue-600 text-white rounded px-1.5 py-0.5">NOVO</span>}
                    <span className={cn("text-[8px] font-black rounded px-1.5 py-0.5", ult.tipo === "fechamento" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600")}>{ult.tipo === "fechamento" ? "FECHADO" : "BAIXADO"}</span>
                    {loja} <span className="text-gray-400 font-bold">· {ult.cod || "sem código"}{ult.gestor ? ` · ${ult.gestor}` : ""}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    {quandoBR(ult.quando)} ({haQuanto(ult.quando)}) · {ult.por} · <b className="text-gray-800">{n0(ult.pecas)} pçs</b> · {brl(ult.custo)} a custo
                  </div>
                  {ult.foraClick > 0 && (
                    <div className="text-[10px] font-bold text-amber-700 mt-0.5 flex items-center gap-1"><AlertTriangle size={11} /> {n0(ult.foraClick)} pçs de {ult.refsFora} refs não estão no CLICK: vão pela ZSOL</div>
                  )}
                  {vs.length > 1 && (
                    <button onClick={() => setAbertas((a) => ({ ...a, [loja]: !aberto }))} className="text-[10px] font-black text-blue-700 mt-1 flex items-center gap-0.5">
                      {aberto ? <ChevronUp size={12} /> : <ChevronDown size={12} />} {vs.length - 1} {vs.length === 2 ? "versão anterior" : "versões anteriores"}
                    </button>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <Botao escuro onClick={() => { const r = clickDe(ult); baixar(r.nomeArquivo, r.blob); }}><Download size={12} /> CLICK</Botao>
                  <Botao disabled title={ult.foraClick ? "Aguardando o modelo da planilha ZSOL" : "Nada fora do CLICK nesta loja"}><Download size={12} /> ZSOL</Botao>
                  <Botao onClick={() => baixar(`FW27_${loja.replace(/[^A-Za-z0-9]+/g, "_")}_conferencia_${carimbo(ult.quando)}.xlsx`, excelDe(ult))}><FileSpreadsheet size={12} /> Excel</Botao>
                </div>
              </div>
              {aberto && vs.slice(1).map((v) => {
                const dif = ult.pecas - v.pecas;
                return (
                  <div key={v.id} className="flex items-center gap-2 mt-1.5 ml-4 pl-3 border-l-2 border-gray-100 flex-wrap">
                    <div className="flex-1 min-w-[12rem] text-[10px] text-gray-500">
                      {v.tipo === "fechamento" ? "Fechado" : "Baixado"} {quandoBR(v.quando)} · {v.por} · <b className="text-gray-700">{n0(v.pecas)} pçs</b>
                      {dif !== 0 && <span className={cn("ml-1 font-bold", dif > 0 ? "text-emerald-700" : "text-red-600")}>(a última tem {dif > 0 ? "+" : ""}{n0(dif)})</span>}
                    </div>
                    <Botao onClick={() => { const r = clickDe(v); baixar(r.nomeArquivo.replace(".xlsx", `_${carimbo(v.quando)}.xlsx`), r.blob); }}><Download size={12} /> CLICK</Botao>
                    <Botao onClick={() => baixar(`FW27_${loja.replace(/[^A-Za-z0-9]+/g, "_")}_conferencia_${carimbo(v.quando)}.xlsx`, excelDe(v))}><FileSpreadsheet size={12} /> Excel</Botao>
                  </div>
                );
              })}
            </div>
          );
        })}
      </Card>

      {(userProfile?.role === "master" || user?.email === "hugotjk2@gmail.com") && <ResetCard reset={reset} onFeito={(r) => { setReset(r); recarregar(); }} logins={andamento} />}

      {/* ---------------- pedidos em andamento ---------------- */}
      <Card>
        <h3 className="text-sm font-extrabold">Pedidos em andamento</h3>
        <p className="text-[10px] text-gray-400 mt-0.5 mb-2">O que cada login está montando agora, salvo sozinho a cada alteração, mesmo antes de baixar.</p>
        {pedidos === undefined && <div className="text-[11px] text-gray-400 py-3">Carregando…</div>}
        {pedidos === null && (
          <div className="text-[11px] text-amber-700 bg-amber-50 rounded-xl p-3">
            O Firebase ainda não libera os pedidos dos outros logins para este acesso. Hoje só o master vê; para o admin ver, é preciso publicar a regra nova no console.
          </div>
        )}
        {pedidos && !andamento.length && <div className="text-[11px] text-gray-400 py-3">Nenhum franqueado começou ainda.</div>}
        {andamento.map((x) => {
          const aberto = !!abertosPed[x.uid];
          const baixadas = x.pedido.lojas.filter((l) => lojasBaixadas.has(l.nome)).length;
          const fechado = x.pedido.status === "enviado";
          const pctVerba = x.tot.verba ? (x.tot.valor / x.tot.verba) * 100 : 0;
          const dif = diferencasDoPadrao(x.pedido);
          return (
            <div key={x.uid} className="border-t border-gray-50 py-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setAbertosPed((a) => ({ ...a, [x.uid]: !aberto }))} className="flex-1 min-w-[14rem] text-left">
                  <div className="text-xs font-extrabold flex items-center gap-1.5 flex-wrap">
                    {aberto ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    <span className={cn("text-[8px] font-black rounded px-1.5 py-0.5 flex items-center gap-0.5", fechado ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                      {fechado ? <><Lock size={8} /> FECHADO</> : <><Pencil size={8} /> RASCUNHO</>}
                    </span>
                    {x.pedido.porEmail || "login sem e-mail salvo"}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5 ml-5">
                    {x.pedido.lojas.length} {x.pedido.lojas.length === 1 ? "loja" : "lojas"} · <b className="text-gray-800">{n0(x.tot.pecas)} pçs</b> · {brl(x.tot.valor)} · {pct0(pctVerba)} da verba · mexeu {haQuanto(x.pedido.atualizadoEm)} ·{" "}
                    <span className={cn("font-bold", baixadas === x.pedido.lojas.length ? "text-emerald-700" : baixadas ? "text-blue-700" : "text-gray-400")}>baixou {baixadas} de {x.pedido.lojas.length}</span>
                  </div>
                  <div className="flex gap-1 flex-wrap mt-1 ml-5">
                    {reset && ((x.pedido.resetEm || "") >= reset.em
                      ? <span className="text-[9px] font-black rounded px-1.5 py-0.5 bg-emerald-50 text-emerald-700">recebeu a atualização{x.pedido.resetVisto ? " · viu o aviso" : ""}</span>
                      : <span className="text-[9px] font-black rounded px-1.5 py-0.5 bg-blue-50 text-blue-700">atualização pendente (ainda não abriu)</span>)}
                    {dif.curva && <span className="text-[9px] font-black rounded px-1.5 py-0.5 bg-gray-100 text-gray-600">curva própria</span>}
                    {dif.subgrupos && <span className="text-[9px] font-black rounded px-1.5 py-0.5 bg-gray-100 text-gray-600">% subgrupos próprio</span>}
                    {dif.editados > 0 && <span className="text-[9px] font-black rounded px-1.5 py-0.5 bg-gray-100 text-gray-600">{dif.editados} {dif.editados === 1 ? "produto editado" : "produtos editados"} à mão</span>}
                  </div>
                </button>
                <Botao onClick={() => { const r = montarRegistro("exportação", x.pedido.porEmail || "", x.pedido, x.linhas); baixar(`FW27_pedido_atual_${(x.pedido.porEmail || x.uid).replace(/[^A-Za-z0-9]+/g, "_")}.xlsx`, excelDoRegistro(r)); }}>
                  <FileSpreadsheet size={12} /> Excel do pedido atual
                </Botao>
              </div>
              {aberto && (
                <div className="mt-2 ml-5 rounded-xl border border-gray-100 overflow-hidden">
                  <table className="w-full text-[10px]">
                    <thead className="bg-gray-50 text-gray-400 font-extrabold uppercase">
                      <tr><th className="text-left px-2 py-1.5">Loja</th><th className="text-right px-2">Peças</th><th className="text-right px-2">Valor</th><th className="text-right px-2">Da verba</th><th className="text-left px-2">Download</th></tr>
                    </thead>
                    <tbody>
                      {x.pedido.lojas.map((l, i) => {
                        const t = x.tot.porLoja[l.id];
                        const ult = porLoja.get(l.nome)?.[0];
                        const mudou = ult && (x.pedido.atualizadoEm || "") > ult.quando && t && Math.round(t.pecas) !== Math.round(ult.pecas);
                        return (
                          <tr key={l.id} className={i % 2 ? "bg-gray-50/60" : ""}>
                            <td className="px-2 py-1.5 font-extrabold">{l.nome}</td>
                            <td className="text-right px-2 font-bold">{n0(t?.pecas || 0)}</td>
                            <td className="text-right px-2">{brl(t?.valor || 0)}</td>
                            <td className="text-right px-2">{l.verba ? pct0(((t?.valor || 0) / l.verba) * 100) : "—"}</td>
                            <td className="px-2">
                              {!ult ? <span className="text-gray-400 font-bold">ainda não baixou</span>
                                : mudou ? <span className="text-amber-700 font-bold">baixou {quandoBR(ult.quando)} ({n0(ult.pecas)} pçs) · mudou depois</span>
                                : <span className="text-emerald-700 font-bold">baixou {quandoBR(ult.quando)}</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
};


// ---------------- atualização geral (só master) ----------------

const MSG_PADRAO = "A AMD final chegou e a sugestão foi atualizada (curva dos meses e % dos subgrupos). Confira as quantidades antes de baixar o arquivo para o CLICK.";

const ResetCard: React.FC<{ reset: Fw27Reset | null; onFeito: (r: Fw27Reset) => void; logins: { pedido: Fw27Pedido }[] }> = ({ reset, onFeito, logins }) => {
  const { user } = useAuth();
  const [aberto, setAberto] = React.useState(false);
  const [msg, setMsg] = React.useState(MSG_PADRAO);
  const [armado, setArmado] = React.useState(false);
  const [estado, setEstado] = React.useState("");
  React.useEffect(() => { if (!armado) return; const t = setTimeout(() => setArmado(false), 5000); return () => clearTimeout(t); }, [armado]);
  const recebidos = reset ? logins.filter((x) => (x.pedido.resetEm || "") >= reset.em).length : 0;
  const fazer = async () => {
    if (!armado) { setArmado(true); return; }
    setArmado(false); setEstado("Gravando…");
    try { const r = await gravarReset(msg, user?.email || ""); onFeito(r); setEstado("Pronto! Cada franqueado recebe ao abrir a Sugestão FW27."); setAberto(false); }
    catch { setEstado("Não consegui gravar. Confira se as regras do Firebase (fw27Config) foram publicadas."); }
  };
  return (
    <Card className="border-amber-200">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold flex items-center gap-1.5"><RotateCcw size={14} /> Atualizar todos os pedidos</h3>
          <p className="text-[10px] text-gray-500 mt-0.5 max-w-2xl">
            Depois de mudar a curva, os % dos subgrupos ou a AMD: volta o pedido de todos os franqueados para a sugestão nova, com um aviso na tela deles.
          </p>
          {reset && (
            <p className="text-[10px] font-bold text-gray-700 mt-1">
              Última: {quandoBR(reset.em)} por {reset.por} · <span className={recebidos === logins.length ? "text-emerald-700" : "text-blue-700"}>{recebidos} de {logins.length} logins já receberam</span> (recebe ao abrir o app)
            </p>
          )}
        </div>
        {!aberto && <Botao onClick={() => setAberto(true)}><RotateCcw size={12} /> Preparar atualização</Botao>}
      </div>
      {aberto && (
        <div className="mt-3 grid md:grid-cols-2 gap-3">
          <div className="text-[11px] space-y-1">
            <div className="font-extrabold text-emerald-700">Fica como está</div>
            <div className="text-gray-600">Lojas, verba total, % de cada loja, grades por tamanho e grupos de grade.</div>
            <div className="font-extrabold text-amber-700 pt-1">Volta para a sugestão nova</div>
            <div className="text-gray-600">Curva dos meses, % dos subgrupos, quantidades e entregas editadas à mão, datas trocadas. Pedido fechado volta a rascunho.</div>
            <div className="text-gray-500 pt-1">Antes de mudar, o app guarda uma cópia do pedido de cada um no Histórico (aparece como "Antes da atualização").</div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold text-gray-400 uppercase">Mensagem que o franqueado vai ver</label>
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} className="w-full bg-gray-50 rounded-xl px-3 py-2 text-xs font-semibold outline-none min-h-20" />
            <div className="flex gap-2">
              <button onClick={fazer} className={cn("flex-1 h-9 rounded-xl text-[11px] font-black text-white", armado ? "bg-red-600" : "bg-amber-600")}>
                {armado ? `Toque de novo: atualizar ${logins.length} pedidos` : "Atualizar todos os pedidos"}
              </button>
              <button onClick={() => { setAberto(false); setArmado(false); }} className="h-9 px-3 rounded-xl bg-gray-100 text-[11px] font-black">Cancelar</button>
            </div>
          </div>
        </div>
      )}
      {estado && <p className="text-[10px] font-bold text-gray-600 mt-2">{estado}</p>}
    </Card>
  );
};

export default Fw27Acompanhamento;
