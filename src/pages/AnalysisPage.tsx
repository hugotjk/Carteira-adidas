import React from "react";
import { Search, Filter, ChevronDown, Download, Table as TableIcon, RefreshCw, Database, Loader2, X, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import { fetchSheetData, getOrdersLocally } from "../services/dataService";
import { Order, FilterType, FILTER_LABELS } from "../types";
import { cn, formatCurrency, formatNumber } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const AnalysisPage: React.FC = () => {
  const [allOrders, setAllOrders] = React.useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = React.useState<Order[]>([]);
  const [filters, setFilters] = React.useState<Partial<Record<FilterType, string>>>({});
  const [searchTerm, setSearchTerm] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = React.useState(false);
  const [sortBy, setSortBy] = React.useState<keyof Order>("valorNF");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");

  React.useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await getOrdersLocally();
        setAllOrders(data);
        setFilteredOrders(data);
      } catch (error) {
        console.error("Error loading orders:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const getFilterOptions = (filterType: FilterType) => {
    const otherFilters = { ...filters };
    delete otherFilters[filterType];
    let filteredForOptions = allOrders;
    Object.entries(otherFilters).forEach(([key, value]) => {
      if (value) {
        filteredForOptions = filteredForOptions.filter(
          (order) => order[key as FilterType] === value
        );
      }
    });
    return Array.from(new Set(filteredForOptions.map((order) => order[filterType]))).filter(Boolean).sort();
  };

  React.useEffect(() => {
    let result = [...allOrders];

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        result = result.filter((order) => order[key as FilterType] === value);
      }
    });

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(
        (order) =>
          order.material.toLowerCase().includes(lowerSearch) ||
          order.materialDescription.toLowerCase().includes(lowerSearch)
      );
    }

    result.sort((a, b) => {
      const valA = a[sortBy];
      const valB = b[sortBy];
      if (typeof valA === "number" && typeof valB === "number") {
        return sortOrder === "desc" ? valB - valA : valA - valB;
      }
      return 0;
    });

    setFilteredOrders(result);
  }, [filters, searchTerm, allOrders, sortBy, sortOrder]);

  const handleFilterChange = (type: FilterType, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [type]: value === "" ? undefined : value,
    }));
  };

  const clearFilters = () => {
    setFilters({});
    setSearchTerm("");
  };

  const totalQty = filteredOrders.reduce((sum, order) => sum + order.qtdeConfirmada, 0);
  const totalValue = filteredOrders.reduce((sum, order) => sum + order.valorNF, 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-4">
        <Loader2 className="animate-spin text-black" size={40} />
        <p className="text-gray-500 font-medium text-sm">Carregando carteira...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold tracking-tight">Análise</h2>
          <div className="flex items-center space-x-2">
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
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Buscar material ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-100 border-none rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-black/5 outline-none"
          />
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="w-full max-w-full px-4 py-3 flex overflow-x-auto space-x-3 no-scrollbar">
        <div className="flex-shrink-0 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm min-w-[140px]">
          <p className="text-[10px] font-bold text-gray-400 uppercase">Total Pedidos</p>
          <p className="text-lg font-bold">{formatNumber(filteredOrders.length)}</p>
        </div>
        <div className="flex-shrink-0 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm min-w-[140px]">
          <p className="text-[10px] font-bold text-gray-400 uppercase">Valor Total</p>
          <p className="text-lg font-bold text-blue-600">{formatCurrency(totalValue)}</p>
        </div>
        <div className="flex-shrink-0 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm min-w-[140px]">
          <p className="text-[10px] font-bold text-gray-400 uppercase">Qtde Total</p>
          <p className="text-lg font-bold text-green-600">{formatNumber(totalQty)}</p>
        </div>
      </div>

      {/* Sorting Controls */}
      <div className="px-4 py-2 flex items-center justify-between text-xs text-gray-500 font-medium">
        <span>{filteredOrders.length} resultados</span>
        <button 
          onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
          className="flex items-center space-x-1 bg-white px-2 py-1 rounded-md border border-gray-200"
        >
          <ArrowUpDown size={12} />
          <span>{sortOrder === "desc" ? "Maior Valor" : "Menor Valor"}</span>
        </button>
      </div>

      {/* Mobile Card List */}
      <div className="px-4 space-y-3 mt-2">
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order, idx) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.03, 0.3) }}
              key={idx} 
              className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm active:scale-[0.98] transition-transform"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{order.material}</span>
                  <h3 className="text-sm font-bold text-gray-900 leading-tight line-clamp-2">{order.materialDescription}</h3>
                </div>
                <span className={cn(
                  "flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                  order.status.toLowerCase().includes("pendente") ? "bg-amber-100 text-amber-700" :
                  order.status.toLowerCase().includes("cancelado") ? "bg-red-100 text-red-700" :
                  "bg-green-100 text-green-700"
                )}>
                  {order.status}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-50">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Quantidade</p>
                  <p className="text-sm font-bold">{formatNumber(order.qtdeConfirmada)} un</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Valor NF</p>
                  <p className="text-sm font-bold text-black">{formatCurrency(order.valorNF)}</p>
                </div>
              </div>
              
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[9px] rounded-md font-medium">{order.loja}</span>
                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[9px] rounded-md font-medium">{order.gestor}</span>
                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[9px] rounded-md font-medium">{order.mesRecebMaterial}</span>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="py-20 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="text-gray-300" size={24} />
            </div>
            <p className="text-gray-500 font-medium">Nenhum resultado encontrado</p>
            <button onClick={clearFilters} className="mt-2 text-blue-600 text-sm font-bold">Limpar filtros</button>
          </div>
        )}
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
              className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-[32px] max-h-[85vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">Filtros</h3>
                  <p className="text-xs text-gray-400">Refine sua busca na carteira</p>
                </div>
                <button 
                  onClick={() => setIsFilterDrawerOpen(false)}
                  className="p-2 bg-gray-100 rounded-full"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {Object.entries(FILTER_LABELS).map(([key, label]) => (
                  <div key={key} className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">{label}</label>
                    <div className="relative">
                      <select
                        value={filters[key as FilterType] || ""}
                        onChange={(e) => handleFilterChange(key as FilterType, e.target.value)}
                        className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-black/5 outline-none transition-all"
                      >
                        <option value="">Todos</option>
                        {getFilterOptions(key as FilterType).map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-6 border-t border-gray-100 grid grid-cols-2 gap-4">
                <button 
                  onClick={clearFilters}
                  className="py-4 text-sm font-bold text-gray-500 bg-gray-100 rounded-2xl"
                >
                  Limpar
                </button>
                <button 
                  onClick={() => setIsFilterDrawerOpen(false)}
                  className="py-4 text-sm font-bold text-white bg-black rounded-2xl"
                >
                  Aplicar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AnalysisPage;
