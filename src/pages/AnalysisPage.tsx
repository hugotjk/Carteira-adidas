import React from "react";
import { Search, ChevronDown, Table as TableIcon, Loader2, X, SlidersHorizontal, ArrowUpDown, Check } from "lucide-react";
import { Order, FilterType, FILTER_LABELS, GroupedOrder } from "../types";
import { cn, formatCurrency, formatNumber } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useFilters } from "../context/FilterContext";
import { useData } from "../context/DataContext";

const AnalysisPage: React.FC = () => {
  const { filters, updateFilter, clearFilters } = useFilters();
  const { allOrders, loading } = useData();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = React.useState(false);
  const [sortBy, setSortBy] = React.useState<keyof GroupedOrder>("valorNF");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");

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

  const filteredAndGroupedOrders = React.useMemo(() => {
    let result = [...allOrders];

    // Apply Filters
    Object.entries(filters).forEach(([key, values]) => {
      const filterValues = values as string[] | undefined;
      if (filterValues && filterValues.length > 0) {
        result = result.filter((order) => filterValues.includes(order[key as FilterType]));
      }
    });

    // Apply Search
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(
        (order) =>
          order.material.toLowerCase().includes(lowerSearch) ||
          order.materialDescription.toLowerCase().includes(lowerSearch)
      );
    }

    // Group by Material
    const groups: Record<string, GroupedOrder> = {};
    result.forEach((order) => {
      if (!groups[order.material]) {
        groups[order.material] = {
          material: order.material,
          materialDescription: order.materialDescription,
          status: order.status,
          colecao: order.colecao,
          qtdeConfirmada: 0,
          valorNF: 0,
          items: [],
        };
      }
      groups[order.material].qtdeConfirmada += order.qtdeConfirmada;
      groups[order.material].valorNF += order.valorNF;
      groups[order.material].items.push(order);
    });

    const groupedArray = Object.values(groups);

    // Sort
    groupedArray.sort((a, b) => {
      const valA = a[sortBy];
      const valB = b[sortBy];
      if (typeof valA === "number" && typeof valB === "number") {
        return sortOrder === "desc" ? valB - valA : valA - valB;
      }
      return 0;
    });

    return groupedArray;
  }, [filters, searchTerm, allOrders, sortBy, sortOrder]);

  const totalQty = React.useMemo(() => 
    filteredAndGroupedOrders.reduce((sum, g) => sum + g.qtdeConfirmada, 0), 
  [filteredAndGroupedOrders]);

  const totalValue = React.useMemo(() => 
    filteredAndGroupedOrders.reduce((sum, g) => sum + g.valorNF, 0), 
  [filteredAndGroupedOrders]);

  const toggleFilterValue = (type: FilterType, value: string) => {
    const currentValues = filters[type] || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter((v) => v !== value)
      : [...currentValues, value];
    updateFilter(type, newValues);
  };

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
          <p className="text-[10px] font-bold text-gray-400 uppercase">Valor Total</p>
          <p className="text-lg font-bold text-blue-600">{formatCurrency(totalValue)}</p>
        </div>
        <div className="flex-shrink-0 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm min-w-[140px]">
          <p className="text-[10px] font-bold text-gray-400 uppercase">Qtde Total</p>
          <p className="text-lg font-bold text-green-600">{formatNumber(totalQty)}</p>
        </div>
      </div>

      {/* Sorting Controls */}
      <div className="px-4 py-2 flex items-center justify-between text-[10px] text-gray-500 font-bold uppercase tracking-wider">
        <span>{filteredAndGroupedOrders.length} materiais</span>
        <button 
          onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
          className="flex items-center space-x-1 bg-white px-2 py-1 rounded-md border border-gray-200"
        >
          <ArrowUpDown size={10} />
          <span>{sortOrder === "desc" ? "Maior Valor" : "Menor Valor"}</span>
        </button>
      </div>

      {/* Mobile Card List */}
      <div className="px-4 space-y-2 mt-1 pb-4">
        {filteredAndGroupedOrders.length > 0 ? (
          filteredAndGroupedOrders.map((group, idx) => (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.01, 0.2) }}
              key={group.material} 
              className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm active:scale-[0.99] transition-transform"
            >
              <div className="flex justify-between items-start gap-2">
                <div className="flex flex-col min-w-0">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{group.material}</span>
                  <h3 className="text-xs font-bold text-gray-900 leading-tight truncate">{group.materialDescription}</h3>
                </div>
                <span className={cn(
                  "flex-shrink-0 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter",
                  group.status.toLowerCase().includes("pendente") ? "bg-amber-100 text-amber-700" :
                  group.status.toLowerCase().includes("cancelado") ? "bg-red-100 text-red-700" :
                  "bg-green-100 text-green-700"
                )}>
                  {group.status}
                </span>
              </div>
              
              <div className="flex justify-between items-end mt-2 pt-2 border-t border-gray-50">
                <div className="flex space-x-4">
                  <div>
                    <p className="text-[8px] font-bold text-gray-400 uppercase leading-none mb-0.5">Qtde</p>
                    <p className="text-xs font-black">{formatNumber(group.qtdeConfirmada)}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-bold text-gray-400 uppercase leading-none mb-0.5">Valor</p>
                    <p className="text-xs font-black text-black">{formatCurrency(group.valorNF)}</p>
                  </div>
                </div>
                <span className="text-[8px] font-bold text-gray-300 uppercase">{group.colecao}</span>
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
              className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-[32px] max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">Filtros</h3>
                  <p className="text-xs text-gray-400">Selecione uma ou mais opções</p>
                </div>
                <button 
                  onClick={() => setIsFilterDrawerOpen(false)}
                  className="p-2 bg-gray-100 rounded-full"
                >
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
