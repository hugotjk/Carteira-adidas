import React from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, AreaChart, Area 
} from "recharts";
import { ChevronDown, TrendingUp, DollarSign, Package, PieChart as PieChartIcon, Loader2, SlidersHorizontal, X } from "lucide-react";
import { Order, FilterType, FILTER_LABELS } from "../types";
import { cn, formatCurrency, formatNumber } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useFilters } from "../context/FilterContext";
import { useData } from "../context/DataContext";

const COLORS = ["#000000", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const DashboardPage: React.FC = () => {
  const { filters, updateFilter, clearFilters } = useFilters();
  const { allOrders, loading } = useData();
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = React.useState(false);

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
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3 shadow-sm flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight">Dashboard</h2>
        <button 
          onClick={() => setIsFilterDrawerOpen(true)}
          className={cn(
            "p-2 rounded-full transition-colors relative",
            Object.keys(filters).length > 0 ? "bg-black text-white" : "bg-gray-100 text-gray-600"
          )}
        >
          <SlidersHorizontal size={18} />
          {Object.keys(filters).length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white">
              {Object.keys(filters).length}
            </span>
          )}
        </button>
      </div>

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

      {/* Filter Drawer */}
      <AnimatePresence>
        {isFilterDrawerOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFilterDrawerOpen(false)}
              className="fixed inset-0 bg-black/40 z-40"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-[32px] max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">Filtros</h3>
                  <p className="text-xs text-gray-400">Refine os dados do dashboard</p>
                </div>
                <button onClick={() => setIsFilterDrawerOpen(false)} className="p-2 bg-gray-100 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {Object.entries(FILTER_LABELS).map(([key, label]) => {
                  const options = getFilterOptions(key as FilterType);
                  const selectedValues = (filters[key as FilterType] || []) as string[];
                  
                  return (
                    <div key={key} className="space-y-2">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</label>
                        {selectedValues.length > 0 && (
                          <span className="text-[10px] font-bold text-blue-600">{selectedValues.length} selecionados</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {options.map((opt) => {
                          const isSelected = selectedValues.includes(opt as string);
                          return (
                            <button
                              key={opt as string}
                              onClick={() => toggleFilterValue(key as FilterType, opt as string)}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border",
                                isSelected 
                                  ? "bg-black text-white border-black" 
                                  : "bg-gray-50 text-gray-600 border-gray-100 hover:border-gray-300"
                              )}
                            >
                              {opt as string}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-6 border-t border-gray-100 grid grid-cols-2 gap-4">
                <button onClick={clearFilters} className="py-4 text-sm font-bold text-gray-500 bg-gray-100 rounded-2xl">Limpar</button>
                <button onClick={() => setIsFilterDrawerOpen(false)} className="py-4 text-sm font-bold text-white bg-black rounded-2xl">Aplicar</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DashboardPage;
