import React from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, AreaChart, Area 
} from "recharts";
import { ChevronDown, TrendingUp, DollarSign, Package, PieChart as PieChartIcon, Loader2, SlidersHorizontal, X, Search, Check } from "lucide-react";
import { Order, FilterType, FILTER_LABELS } from "../types";
import { cn, formatCurrency, formatNumber } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useFilters } from "../context/FilterContext";
import { useData } from "../context/DataContext";

const COLORS = ["#000000", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const DashboardPage: React.FC = () => {
  const { filters, updateFilter, clearFilters } = useFilters();
  const { allOrders, loading } = useData();
  const [activeFilter, setActiveFilter] = React.useState<FilterType | null>(null);
  const [filterSearch, setFilterSearch] = React.useState("");

  const getFilterOptions = (filterType: FilterType) => {
    const otherFilters = { ...filters };
    delete otherFilters[filterType];
    let filteredForOptions = allOrders;
    Object.entries(otherFilters).forEach(([key, values]) => {
      const filterValues = values as string[] | undefined;
      if (filterValues && filterValues.length > 0) {
        filteredForOptions = filteredForOptions.filter(
          (order) => filterValues.includes(order[key as FilterType])
        );
      }
    });
    return Array.from(new Set(filteredForOptions.map((order) => order[filterType]))).filter(Boolean).sort();
  };

  const filteredOrders = React.useMemo(() => {
    let result = [...allOrders];
    Object.entries(filters).forEach(([key, values]) => {
      const filterValues = values as string[] | undefined;
      if (filterValues && filterValues.length > 0) {
        result = result.filter((order) => filterValues.includes(order[key as FilterType]));
      }
    });
    return result;
  }, [filters, allOrders]);

  const toggleFilterValue = (type: FilterType, value: string) => {
    const currentValues = filters[type] || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter((v) => v !== value)
      : [...currentValues, value];
    updateFilter(type, newValues);
  };

  const toggleSelectAll = (type: FilterType, options: string[]) => {
    const currentValues = filters[type] || [];
    if (currentValues.length === options.length) {
      updateFilter(type, []);
    } else {
      updateFilter(type, options);
    }
  };

  // Data Aggregations
  const totalValue = React.useMemo(() => filteredOrders.reduce((sum, order) => sum + order.valorNF, 0), [filteredOrders]);
  const totalQty = React.useMemo(() => filteredOrders.reduce((sum, order) => sum + order.qtdeConfirmada, 0), [filteredOrders]);
  
  const dataByStatus = React.useMemo(() => {
    const agg: Record<string, number> = {};
    filteredOrders.forEach((o) => {
      agg[o.status] = (agg[o.status] || 0) + o.valorNF;
    });
    return Object.entries(agg).map(([name, value]) => ({ name, value }));
  }, [filteredOrders]);

  const dataByGestor = React.useMemo(() => {
    const agg: Record<string, number> = {};
    filteredOrders.forEach((o) => {
      agg[o.gestor] = (agg[o.gestor] || 0) + o.valorNF;
    });
    return Object.entries(agg)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredOrders]);

  const dataByMonth = React.useMemo(() => {
    const agg: Record<string, number> = {};
    filteredOrders.forEach((o) => {
      agg[o.mesRecebMaterial] = (agg[o.mesRecebMaterial] || 0) + o.valorNF;
    });
    return Object.entries(agg).map(([name, value]) => ({ name, value }));
  }, [filteredOrders]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-4">
        <Loader2 className="animate-spin text-black" size={40} />
        <p className="text-gray-500 font-medium text-sm">Carregando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Dashboard</h2>
          {Object.keys(filters).length > 0 && (
            <button 
              onClick={clearFilters}
              className="text-[10px] font-bold text-red-500 uppercase tracking-wider bg-red-50 px-2 py-1 rounded-md"
            >
              Limpar Filtros
            </button>
          )}
        </div>

        {/* Excel-like Filter Bar */}
        <div className="flex overflow-x-auto no-scrollbar px-4 pb-3 space-x-2">
          {Object.entries(FILTER_LABELS).map(([key, label]) => {
            const type = key as FilterType;
            const isSelected = (filters[type] || []).length > 0;
            return (
              <button
                key={key}
                onClick={() => {
                  setActiveFilter(activeFilter === type ? null : type);
                  setFilterSearch("");
                }}
                className={cn(
                  "flex-shrink-0 flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all whitespace-nowrap",
                  isSelected 
                    ? "bg-black text-white border-black" 
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                )}
              >
                <span>{label}</span>
                <ChevronDown size={12} className={cn("transition-transform", activeFilter === type && "rotate-180")} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Dropdown Overlay */}
      <AnimatePresence>
        {activeFilter && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveFilter(null)}
              className="fixed inset-0 bg-black/20 z-40"
            />
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="fixed top-[100px] left-4 right-4 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[60vh]"
            >
              <div className="p-3 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Filtrar {FILTER_LABELS[activeFilter]}
                </span>
                <button onClick={() => setActiveFilter(null)} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                  <X size={14} />
                </button>
              </div>

              <div className="p-3 border-b border-gray-50">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                  <input
                    type="text"
                    placeholder="Pesquisar..."
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    className="w-full bg-gray-100 border-none rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-1">
                {/* Select All */}
                <button
                  onClick={() => toggleSelectAll(activeFilter, getFilterOptions(activeFilter) as string[])}
                  className="w-full flex items-center space-x-3 px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors group"
                >
                  <div className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                    (filters[activeFilter] || []).length === getFilterOptions(activeFilter).length
                      ? "bg-black border-black"
                      : "border-gray-300 group-hover:border-gray-400"
                  )}>
                    <Check size={10} className="text-white" />
                  </div>
                  <span className="text-xs font-bold text-gray-700">(Selecionar Tudo)</span>
                </button>

                {getFilterOptions(activeFilter)
                  .filter(opt => String(opt).toLowerCase().includes(filterSearch.toLowerCase()))
                  .map((opt) => {
                    const isSelected = (filters[activeFilter] || []).includes(opt as string);
                    return (
                      <button
                        key={opt as string}
                        onClick={() => toggleFilterValue(activeFilter, opt as string)}
                        className="w-full flex items-center space-x-3 px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors group"
                      >
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                          isSelected 
                            ? "bg-black border-black" 
                            : "border-gray-300 group-hover:border-gray-400"
                        )}>
                          <Check size={10} className="text-white" />
                        </div>
                        <span className="text-xs text-gray-600 truncate">{opt as string}</span>
                      </button>
                    );
                  })}
              </div>

              <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-end">
                <button 
                  onClick={() => setActiveFilter(null)}
                  className="px-4 py-2 bg-black text-white text-[10px] font-bold rounded-lg uppercase tracking-wider"
                >
                  Ok
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* KPI Grid */}
      <div className="p-4 grid grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-3">
            <DollarSign size={18} />
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase">Valor Total</p>
          <p className="text-lg font-bold truncate">{formatCurrency(totalValue)}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-8 h-8 bg-green-50 text-green-600 rounded-lg flex items-center justify-center mb-3">
            <Package size={18} />
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase">Qtde Total</p>
          <p className="text-lg font-bold">{formatNumber(totalQty)}</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="px-4 space-y-4 pb-20">
        {/* Status Chart */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-sm font-bold mb-4 flex items-center">
            <PieChartIcon size={16} className="mr-2 text-gray-400" />
            Distribuição por Status
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dataByStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {dataByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Manager Chart */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-sm font-bold mb-4 flex items-center">
            <TrendingUp size={16} className="mr-2 text-gray-400" />
            Top 5 Gestores (Valor)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataByGestor} layout="vertical" margin={{ left: 0, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={80} 
                  tick={{ fontSize: 10, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  cursor={{ fill: '#f9fafb' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill="#000000" radius={[0, 10, 10, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Trend */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-sm font-bold mb-4 flex items-center">
            <TrendingUp size={16} className="mr-2 text-gray-400" />
            Tendência Mensal
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dataByMonth}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#000000" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#000000" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="value" stroke="#000000" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  );
};

export default DashboardPage;
