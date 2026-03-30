import React from "react";
import { Search, ChevronDown, Loader2, X, Check, Download, Share2, Square, CheckSquare } from "lucide-react";
import { Order, FilterType, FILTER_LABELS } from "../types";
import { cn, formatCurrency, formatNumber } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useFilters } from "../context/FilterContext";
import { useData } from "../context/DataContext";
import Papa from "papaparse";

const ReleasePage: React.FC = () => {
  const { filters, updateFilter, clearFilters } = useFilters();
  const { allOrders, loading } = useData();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [activeFilter, setActiveFilter] = React.useState<FilterType | null>(null);
  const [filterSearch, setFilterSearch] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());

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
    let result = allOrders.map((order, index) => ({ ...order, _internalId: index }));

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
          order.materialDescription.toLowerCase().includes(lowerSearch) ||
          order.pedido.toLowerCase().includes(lowerSearch)
      );
    }

    // Sort by value DESC
    result.sort((a, b) => b.valorNF - a.valorNF);

    return result;
  }, [filters, searchTerm, allOrders]);

  const toggleSelection = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAllPage = () => {
    if (selectedIds.size === filteredOrders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOrders.map(o => o._internalId)));
    }
  };

  const handleExport = async () => {
    if (selectedIds.size === 0) return;

    const selectedOrders = allOrders.filter((_, idx) => selectedIds.has(idx));
    const rowsToExport = selectedOrders.map(o => o.originalRow || o);
    
    const csv = Papa.unparse(rowsToExport);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const filename = `liberacao_${new Date().toISOString().split('T')[0]}.csv`;

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: "text/csv" })] })) {
      try {
        const file = new File([blob], filename, { type: "text/csv" });
        await navigator.share({
          files: [file],
          title: 'Exportação Liberação',
          text: 'Arquivo de liberação de pedidos'
        });
      } catch (error) {
        console.error("Error sharing:", error);
        // Fallback to download
        downloadFile(blob, filename);
      }
    } else {
      downloadFile(blob, filename);
    }
  };

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleFilterValue = (type: FilterType, value: string) => {
    const currentValues = filters[type] || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter((v) => v !== value)
      : [...currentValues, value];
    updateFilter(type, newValues);
  };

  const toggleSelectAllFilter = (type: FilterType, options: string[]) => {
    const currentValues = filters[type] || [];
    if (currentValues.length === options.length) {
      updateFilter(type, []);
    } else {
      updateFilter(type, options);
    }
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
    <div className="flex flex-col min-h-screen bg-gray-50 pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Liberação</h2>
          <div className="flex items-center space-x-2">
            {Object.keys(filters).length > 0 && (
              <button 
                onClick={clearFilters}
                className="text-[10px] font-bold text-red-500 uppercase tracking-wider bg-red-50 px-2 py-1 rounded-md"
              >
                Limpar
              </button>
            )}
            <button 
              onClick={toggleSelectAllPage}
              className="text-[10px] font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-2 py-1 rounded-md"
            >
              {selectedIds.size === filteredOrders.length ? "Desmarcar" : "Marcar Todos"}
            </button>
          </div>
        </div>
        
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Buscar material, descrição ou pedido..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-100 border-none rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-black/5 outline-none"
            />
          </div>
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
              className="fixed top-[150px] left-4 right-4 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[60vh]"
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
                <button
                  onClick={() => toggleSelectAllFilter(activeFilter, getFilterOptions(activeFilter) as string[])}
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
                <button onClick={() => setActiveFilter(null)} className="px-4 py-2 bg-black text-white text-[10px] font-bold rounded-lg uppercase tracking-wider">Ok</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* List of Orders */}
      <div className="px-4 space-y-2 mt-4">
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order, idx) => (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.005, 0.1) }}
              key={`${order.pedido}-${order.material}-${idx}`} 
              onClick={() => toggleSelection(order._internalId)}
              className={cn(
                "bg-white p-3 rounded-xl border transition-all flex items-center space-x-3",
                selectedIds.has(order._internalId) ? "border-black bg-black/[0.02]" : "border-gray-100"
              )}
            >
              <div className={cn(
                "flex-shrink-0 w-6 h-6 rounded-lg border flex items-center justify-center transition-colors",
                selectedIds.has(order._internalId) ? "bg-black border-black text-white" : "border-gray-200 text-transparent"
              )}>
                <Check size={14} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{order.material} | {order.pedido}</span>
                    <h3 className="text-xs font-bold text-gray-900 leading-tight truncate">{order.materialDescription}</h3>
                  </div>
                  <span className="text-[9px] font-bold text-gray-400">{order.mesRecebMaterial}</span>
                </div>
                
                <div className="flex justify-between items-end mt-2">
                  <div className="flex space-x-4">
                    <div>
                      <p className="text-[8px] font-bold text-gray-400 uppercase leading-none mb-0.5">Qtde</p>
                      <p className="text-xs font-black">{formatNumber(order.qtdeConfirmada)}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-bold text-gray-400 uppercase leading-none mb-0.5">Valor</p>
                      <p className="text-xs font-black text-black">{formatCurrency(order.valorNF)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="py-20 text-center">
            <Search className="text-gray-300 mx-auto mb-4" size={24} />
            <p className="text-gray-500 font-medium">Nenhum pedido encontrado</p>
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-24 lg:bottom-8 left-4 right-4 lg:left-auto lg:right-8 lg:w-64 z-40"
          >
            <button 
              onClick={handleExport}
              className="w-full bg-black text-white py-4 rounded-2xl shadow-2xl flex items-center justify-center space-x-3 active:scale-95 transition-transform"
            >
              <Share2 size={20} />
              <div className="text-left">
                <p className="text-xs font-black leading-none">Exportar CSV</p>
                <p className="text-[10px] font-medium text-gray-400">{selectedIds.size} itens selecionados</p>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReleasePage;
