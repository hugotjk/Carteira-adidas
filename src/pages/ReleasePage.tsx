import React from "react";
import { Search, ChevronDown, Loader2, X, Check, Share2, Plus } from "lucide-react";
import { Order, FilterType, FILTER_LABELS } from "../types";
import { cn, formatCurrency, formatNumber } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useFilters } from "../context/FilterContext";
import { useData } from "../context/DataContext";
import Papa from "papaparse";
import PageHeader from "../components/PageHeader";

const PAGE_SIZE = 50;

const ReleasePage: React.FC = () => {
  const { filters, updateFilter, clearFilters } = useFilters();
  const { allOrders, loading } = useData();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [activeFilter, setActiveFilter] = React.useState<FilterType | null>(null);
  const [filterSearch, setFilterSearch] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  const [isSummaryOpen, setIsSummaryOpen] = React.useState(false);
  const [summaryGroupBy, setSummaryGroupBy] = React.useState<'material' | 'subGrupo' | 'loja'>('material');

  const parseMonthYear = (monthYear: string) => {
    if (monthYear.includes("-")) {
      const [y, m] = monthYear.split("-");
      return new Date(parseInt(y), parseInt(m) - 1);
    }
    const months: Record<string, number> = {
      'JAN': 0, 'FEV': 1, 'MAR': 2, 'ABR': 3, 'MAI': 4, 'JUN': 5,
      'JUL': 6, 'AGO': 7, 'SET': 8, 'OUT': 9, 'NOV': 10, 'DEZ': 11
    };
    const parts = monthYear.split('/');
    if (parts.length === 2) {
      const [m, y] = parts;
      return new Date(parseInt(y), months[m.toUpperCase()] || 0);
    }
    return new Date(0);
  };

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

    // Sort: Material (by material's total value DESC), then Mes Receb (ASC)
    const materialTotals: Record<string, number> = {};
    result.forEach(o => {
      materialTotals[o.material] = (materialTotals[o.material] || 0) + o.valorNF;
    });

    result.sort((a, b) => {
      const totalA = materialTotals[a.material];
      const totalB = materialTotals[b.material];
      if (totalA !== totalB) return totalB - totalA;
      if (a.material !== b.material) return a.material.localeCompare(b.material);
      const dateA = parseMonthYear(a.mesRecebMaterial).getTime();
      const dateB = parseMonthYear(b.mesRecebMaterial).getTime();
      return dateA - dateB;
    });

    return result;
  }, [filters, searchTerm, allOrders]);

  // Reset visible count when filters or search change
  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters, searchTerm]);

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllPage = () => {
    if (selectedIds.size === filteredOrders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOrders.map(o => o._internalId)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setIsSummaryOpen(false);
  };

  const selectedOrders = React.useMemo(() => {
    return allOrders.filter((_, idx) => selectedIds.has(idx));
  }, [allOrders, selectedIds]);

  const totals = React.useMemo(() => {
    return selectedOrders.reduce(
      (acc, order) => {
        acc.qty += order.qtdeConfirmada;
        acc.value += order.valorNF;
        return acc;
      },
      { qty: 0, value: 0 }
    );
  }, [selectedOrders]);

  const groupedSummary = React.useMemo(() => {
    const summary: Record<string, { label: string; description: string; qty: number; value: number }> = {};
    selectedOrders.forEach((order) => {
      const key = order[summaryGroupBy];
      if (!summary[key]) {
        summary[key] = { 
          label: key, 
          description: summaryGroupBy === 'material' ? order.materialDescription : '', 
          qty: 0, 
          value: 0 
        };
      }
      summary[key].qty += order.qtdeConfirmada;
      summary[key].value += order.valorNF;
    });
    return Object.entries(summary)
      .map(([key, data]) => ({
        key,
        ...data,
      }))
      .sort((a, b) => b.value - a.value);
  }, [selectedOrders, summaryGroupBy]);

  const handleExport = async () => {
    if (selectedIds.size === 0) return;

    const selectedOrders = allOrders.filter((_, idx) => selectedIds.has(idx));
    const rowsToExport = selectedOrders.map(o => o.originalRow || o);
    
    const csv = Papa.unparse(rowsToExport);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const filename = `lib_canc_${new Date().toISOString().split('T')[0]}.csv`;

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

  const visibleOrders = filteredOrders.slice(0, visibleCount);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-32">
      {/* Sticky Header */}
      <PageHeader title="Liberar & Cancelar">
        <div className="flex items-center space-x-2">
          {selectedIds.size > 0 && (
            <button 
              onClick={clearSelection}
              className="text-[10px] font-bold text-orange-600 uppercase tracking-wider bg-orange-50 px-2 py-1 rounded-md"
            >
              Limpar Seleção
            </button>
          )}
          {Object.keys(filters).length > 0 && (
            <button 
              onClick={clearFilters}
              className="text-[10px] font-bold text-red-500 uppercase tracking-wider bg-red-50 px-2 py-1 rounded-md"
            >
              Limpar Filtros
            </button>
          )}
          <button 
            onClick={toggleSelectAllPage}
            className="text-[10px] font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-2 py-1 rounded-md"
          >
            {selectedIds.size === filteredOrders.length ? "Desmarcar" : "Marcar Todos"}
          </button>
        </div>
      </PageHeader>
      
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="px-4 py-3">
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

        {/* Filter Bar */}
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

      {/* Filter Overlay */}
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
        {visibleOrders.length > 0 ? (
          <>
            {visibleOrders.map((order) => {
              const isSelected = selectedIds.has(order._internalId);
              return (
                <div 
                  key={`${order.pedido}-${order.material}-${order._internalId}`} 
                  onClick={() => toggleSelection(order._internalId)}
                  className={cn(
                    "bg-white p-3 rounded-xl border transition-all flex items-center space-x-3 cursor-pointer",
                    isSelected ? "border-black bg-black/[0.02]" : "border-gray-100"
                  )}
                >
                  <div className={cn(
                    "flex-shrink-0 w-6 h-6 rounded-lg border flex items-center justify-center transition-colors",
                    isSelected ? "bg-black border-black text-white" : "border-gray-200 text-transparent"
                  )}>
                    <Check size={14} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{order.material} | {order.pedido}</span>
                          <span className="text-[9px] font-bold text-blue-500 uppercase tracking-wider bg-blue-50 px-1 rounded">{order.loja}</span>
                        </div>
                        <h3 className="text-xs font-bold text-gray-900 leading-tight truncate">{order.materialDescription}</h3>
                      </div>
                      <span className="text-[9px] font-bold text-gray-400">{order.mesRecebMaterial}</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-x-4 gap-y-1 mt-1.5 pt-1.5 border-t border-gray-50">
                      <div className="flex flex-col">
                        <p className="text-[7px] font-bold text-gray-400 uppercase leading-none mb-0.5">Qtde | Valor</p>
                        <p className="text-[10px] font-black leading-none">
                          {formatNumber(order.qtdeConfirmada)} <span className="text-gray-300 mx-1">|</span> {formatCurrency(order.valorNF)}
                        </p>
                      </div>
                      <div className="flex flex-col">
                        <p className="text-[7px] font-bold text-gray-400 uppercase leading-none mb-0.5">Venda | Estq</p>
                        <p className="text-[10px] font-black leading-none">
                          {formatNumber(order.venda)} <span className="text-gray-300 mx-1">|</span> {formatNumber(order.estoque)}
                        </p>
                      </div>
                      <div className="flex flex-col">
                        <p className="text-[7px] font-bold text-gray-400 uppercase leading-none mb-0.5">Venda G. | Estq G.</p>
                        <p className="text-[10px] font-black leading-none text-orange-600">
                          {formatNumber(order.mediaVenda)} <span className="text-gray-300 mx-1">|</span> {formatNumber(order.estoqueGestor)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {visibleCount < filteredOrders.length && (
              <button 
                onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                className="w-full py-4 bg-white border border-gray-100 rounded-xl text-xs font-bold text-gray-400 flex items-center justify-center space-x-2 active:bg-gray-50"
              >
                <Plus size={14} />
                <span>Carregar mais ({filteredOrders.length - visibleCount} restantes)</span>
              </button>
            )}
          </>
        ) : (
          <div className="py-20 text-center">
            <Search className="text-gray-300 mx-auto mb-4" size={24} />
            <p className="text-gray-500 font-medium">Nenhum pedido encontrado</p>
          </div>
        )}
      </div>

      {/* Floating Action Button & Summary */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-24 lg:bottom-8 left-4 right-4 lg:left-auto lg:right-8 lg:w-80 z-40"
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
              {/* Summary Header (Clickable) */}
              <button 
                onClick={() => setIsSummaryOpen(!isSummaryOpen)}
                className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between border-b border-gray-100"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex flex-col items-start">
                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Qtde Total</span>
                    <span className="text-sm font-black">{formatNumber(totals.qty)}</span>
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Valor Total</span>
                    <span className="text-sm font-black">{formatCurrency(totals.value)}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">{selectedIds.size} itens</span>
                  <ChevronDown 
                    size={16} 
                    className={cn("text-gray-400 transition-transform", isSummaryOpen && "rotate-180")} 
                  />
                </div>
              </button>

              {/* Material Summary (Expandable) */}
              <AnimatePresence>
                {isSummaryOpen && (
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    className="overflow-hidden bg-white max-h-[50vh] overflow-y-auto"
                  >
                    <div className="p-3">
                      {/* Grouping Toggle */}
                      <div className="flex p-1 bg-gray-100 rounded-xl mb-3">
                        {(['material', 'subGrupo', 'loja'] as const).map((mode) => (
                          <button
                            key={mode}
                            onClick={() => setSummaryGroupBy(mode)}
                            className={cn(
                              "flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                              summaryGroupBy === mode ? "bg-white text-black shadow-sm" : "text-gray-400"
                            )}
                          >
                            {mode === 'subGrupo' ? 'Subgrupo' : mode}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-2">
                        {groupedSummary.map((m) => (
                          <div key={m.key} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{m.label}</span>
                              <span className="text-[11px] font-black text-gray-900">{formatCurrency(m.value)}</span>
                            </div>
                            
                            <div className="flex justify-between items-end">
                              <h4 className="text-[10px] font-bold text-gray-700 leading-tight flex-1 pr-4 truncate">
                                {m.description || m.label}
                              </h4>
                              <div className="flex items-center space-x-1 whitespace-nowrap">
                                <span className="text-[8px] font-bold text-gray-400 uppercase">QTDE:</span>
                                <span className="text-[10px] font-black text-gray-900">{formatNumber(m.qty)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Export Button */}
              <button 
                onClick={handleExport}
                className="w-full bg-black text-white py-4 flex items-center justify-center space-x-3 active:scale-[0.98] transition-transform"
              >
                <Share2 size={18} />
                <span className="text-xs font-black uppercase tracking-wider">Exportar CSV</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReleasePage;
