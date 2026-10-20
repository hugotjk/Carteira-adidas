import React from "react";
import { CalendarClock, ChevronDown } from "lucide-react";
import { Order } from "../../types";
import { cn, formatNumber, fixBrokenAccents } from "../../lib/utils";
import { parseSheetDate, formatDayMonth } from "../../lib/dates";

const WINDOWS = [30, 60, 90] as const;
type WindowDays = (typeof WINDOWS)[number];
const INITIAL_ROWS = 8;

interface LaunchItem {
  material: string;
  description: string;
  date: Date;
  qty: number;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Bloco "Próximos lançamentos" do Dashboard.
 * Usa os pedidos já filtrados (permissão do login + filtros da tela),
 * ignora cancelados e considera a coluna "Data de Lançamento" a partir de hoje.
 */
const UpcomingLaunches: React.FC<{ orders: Order[] }> = ({ orders }) => {
  const [days, setDays] = React.useState<WindowDays>(30);
  const [showAll, setShowAll] = React.useState(false);

  // Lê as datas uma vez só, mantendo apenas os lançamentos de hoje em diante
  const upcoming = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const list: { order: Order; date: Date }[] = [];
    for (const order of orders) {
      if ((order.status || "").toLowerCase() === "cancelado") continue;
      const date = parseSheetDate(order.dataLancamento);
      if (date && date >= today) list.push({ order, date });
    }
    return { today, list };
  }, [orders]);

  const { totalQty, items, next } = React.useMemo(() => {
    const limit = new Date(upcoming.today.getTime() + days * DAY);
    const byMaterial = new Map<string, LaunchItem>();
    let totalQty = 0;
    let next: Date | null = null;

    for (const { order, date } of upcoming.list) {
      if (!next || date < next) next = date;
      if (date > limit) continue;
      totalQty += order.qtdeConfirmada;
      const item = byMaterial.get(order.material);
      if (!item) {
        byMaterial.set(order.material, {
          material: order.material,
          description: fixBrokenAccents(order.materialDescription || "").toUpperCase(),
          date,
          qty: order.qtdeConfirmada,
        });
      } else {
        item.qty += order.qtdeConfirmada;
        if (date < item.date) item.date = date;
      }
    }

    const items = Array.from(byMaterial.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime() || b.qty - a.qty
    );
    return { totalQty, items, next };
  }, [upcoming, days]);

  // Maior lançamento do período (em peças)
  const top = items.reduce<LaunchItem | null>((best, i) => (!best || i.qty > best.qty ? i : best), null);
  const visible = showAll ? items : items.slice(0, INITIAL_ROWS);

  return (
    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h3 className="text-sm font-bold flex items-center">
          <CalendarClock size={16} className="mr-2 text-gray-400" />
          Próximos lançamentos
        </h3>
        <div className="flex p-1 bg-gray-100 rounded-xl">
          {WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => {
                setDays(w);
                setShowAll(false);
              }}
              className={cn(
                "px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all",
                days === w ? "bg-white text-black shadow-sm" : "text-gray-400"
              )}
            >
              {w} dias
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-gray-50 rounded-2xl p-3">
          <p className="text-[9px] font-bold text-gray-400 uppercase leading-tight">Peças a lançar</p>
          <p className="text-base font-black mt-1">{formatNumber(totalQty)}</p>
        </div>
        <div className="bg-gray-50 rounded-2xl p-3">
          <p className="text-[9px] font-bold text-gray-400 uppercase leading-tight">Materiais novos</p>
          <p className="text-base font-black mt-1">{formatNumber(items.length)}</p>
        </div>
        <div className="bg-gray-50 rounded-2xl p-3">
          <p className="text-[9px] font-bold text-gray-400 uppercase leading-tight">Próximo lançamento</p>
          <p className="text-base font-black mt-1">{next ? formatDayMonth(next) : "—"}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6">
          Nenhum lançamento previsto nos próximos {days} dias.
        </p>
      ) : (
        <>
          {top && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 mb-4 flex items-center gap-3">
              <span className="shrink-0 w-12 text-center text-[10px] font-black rounded-lg py-1 bg-amber-100 text-amber-700">
                {formatDayMonth(top.date)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wider leading-none">
                  Maior lançamento do período <span className="text-amber-600/70">· {top.material}</span>
                </p>
                <p className="text-[11px] font-bold text-gray-900 truncate leading-tight mt-1">{top.description}</p>
              </div>
              <span className="shrink-0 text-[11px] font-black text-right">
                {formatNumber(top.qty)} <span className="text-[9px] font-bold text-gray-400">peças</span>
              </span>
            </div>
          )}

          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Próximos na fila</p>
          <div className="divide-y divide-gray-100">
            {visible.map((item) => {
              const isTop = item === top;
              return (
                <div key={item.material} className="flex items-center gap-3 py-2">
                  <span
                    className={cn(
                      "shrink-0 w-12 text-center text-[10px] font-black rounded-lg py-1",
                      isTop ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-600"
                    )}
                  >
                    {formatDayMonth(item.date)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-bold text-gray-400 leading-none">{item.material}</p>
                    <p className="text-[11px] font-bold text-gray-900 truncate leading-tight mt-0.5">{item.description}</p>
                  </div>
                  <span className={cn("shrink-0 text-[11px] text-right", isTop ? "font-black" : "font-bold text-gray-700")}>
                    {formatNumber(item.qty)} <span className="text-[9px] font-bold text-gray-400">peças</span>
                  </span>
                </div>
              );
            })}
          </div>

          {items.length > INITIAL_ROWS && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full mt-2 py-2 text-[10px] font-black uppercase tracking-wider text-gray-500 hover:text-black flex items-center justify-center gap-1"
            >
              <span>{showAll ? "Mostrar menos" : `Ver todos (${items.length})`}</span>
              <ChevronDown size={12} className={cn("transition-transform", showAll && "rotate-180")} />
            </button>
          )}

        </>
      )}
    </div>
  );
};

export default UpcomingLaunches;
