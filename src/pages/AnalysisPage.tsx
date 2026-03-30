import React from "react";
import { Search, ChevronDown, Table as TableIcon, Loader2, X, ArrowUpDown, Check } from "lucide-react";
import { Order, FilterType, FILTER_LABELS, GroupedOrder } from "../types";
import { cn, formatCurrency, formatNumber } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useFilters } from "../context/FilterContext";
import { useData } from "../context/DataContext";
import PageHeader from "../components/PageHeader";

const ProductImage = ({ material }: { material: string }) => {
  const [extension, setExtension] = React.useState<'png' | 'jpg' | 'error'>('png');
  const imageUrl = `https://github.com/hugotjk/adidas-fla/blob/main/${material}.${extension === 'error' ? 'png' : extension}?raw=true`;

  if (extension === 'error') {
    return (
      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200 flex-shrink-0">
        <span className="text-[8px] font-black text-gray-400 uppercase text-center leading-tight">SEM<br/>FOTO</span>
      </div>
    );
  }

  return (
    <div className="w-16 h-16 bg-white rounded-lg overflow-hidden border border-gray-100 flex items-center justify-center flex-shrink-0">
      <img 
        src={imageUrl} 
        alt={material}
        onError={() => {
          if (extension === 'png') {
            setExtension('jpg');
          } else {
            setExtension('error');
          }
        }}
        className="w-full h-full object-contain"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

const AnalysisPage: React.FC = () => {
  const { filters, updateFilter, clearFilters } = useFilters();
  const { allOrders, loading } = useData();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [activeFilter, setActiveFilter] = React.useState<FilterType | null>(null);
  const [filterSearch, setFilterSearch] = React.useState("");
  const [sortBy, setSortBy] = React.useState<keyof GroupedOrder>("valorNF");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");
  const [expandedMaterial, setExpandedMaterial] = React.useState<string | null>(null);
  const [expandedStatus, setExpandedStatus] = React.useState<string | null>(null);

  const parseMonthYear = (monthYear: string) => {
    if (monthYear.includes("-")) {
      const [y, m] = monthYear.split("-");
      return new Date(parseInt(y), parseInt(m) - 1);
    }
    const months: Record<string, number> = {
      'JAN': 0, 'FEV': 1, 'MAR': 2, 'ABR': 3, 'MAI': 4, 'JUN': 5,
      'JUL': 6, 'AGO': 7, 'SET': 8, 'OUT': 9, 'NOV': 10, 'DEZ': 11
    };
    const [m, y] = monthYear.split('/');
    return new Date(parseInt(y), months[m.toUpperCase()] || 0);
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

  const toggleSelectAll = (type: FilterType, options: string[]) => {
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
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <PageHeader title="Análise">
        {Object.keys(filters).length > 0 && (
          <button 
            onClick={clearFilters}
            className="text-[10px] font-bold text-red-500 uppercase tracking-wider bg-red-50 px-2 py-1 rounded-md"
          >
            Limpar Filtros
          </button>
        )}
      </PageHeader>
      
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="px-4 py-3">
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
              onClick={() => {
                const isExpanding = expandedMaterial !== group.material;
                setExpandedMaterial(isExpanding ? group.material : null);
                setExpandedStatus(null); // Reset nested accordion
              }}
              className={cn(
                "bg-white rounded-xl border border-gray-100 shadow-sm active:scale-[0.99] transition-all overflow-hidden",
                expandedMaterial === group.material ? "ring-1 ring-black/5" : ""
              )}
            >
              <div className="p-3 flex gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{group.material}</span>
                      <h3 className="text-xs font-bold text-gray-900 leading-tight truncate">{group.materialDescription}</h3>
                    </div>
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
                  </div>
                </div>

                <div className="flex flex-col items-end justify-between">
                  <ChevronDown 
                    size={14} 
                    className={cn(
                      "text-gray-300 transition-transform duration-300",
                      expandedMaterial === group.material && "rotate-180 text-black"
                    )} 
                  />
                  <ProductImage material={group.material} />
                </div>
              </div>

              <AnimatePresence>
                {expandedMaterial === group.material && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="bg-gray-50/50 border-t border-gray-100"
                  >
                    <div className="p-3 space-y-2">
                      <div className="grid grid-cols-3 gap-2 text-[8px] font-black text-gray-400 uppercase tracking-widest pb-1 border-b border-gray-200/50">
                        <span>Status</span>
                        <span className="text-right">Qtde</span>
                        <span className="text-right">Valor</span>
                      </div>
                      {Object.entries(
                        group.items.reduce((acc, item) => {
                          if (!acc[item.status]) {
                            acc[item.status] = { qtde: 0, valor: 0, items: [] };
                          }
                          acc[item.status].qtde += item.qtdeConfirmada;
                          acc[item.status].valor += item.valorNF;
                          acc[item.status].items.push(item);
                          return acc;
                        }, {} as Record<string, { qtde: number; valor: number; items: Order[] }>)
                      )
                      .sort((a: [string, any], b: [string, any]) => b[1].valor - a[1].valor) // Sort by value DESC
                      .map(([status, data]: [string, any]) => (
                        <div key={status} className="flex flex-col border-b border-gray-100 last:border-0">
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedStatus(expandedStatus === status ? null : status);
                            }}
                            className="grid grid-cols-3 gap-2 items-center py-2 active:bg-gray-100 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center space-x-1 min-w-0">
                              <ChevronDown 
                                size={10} 
                                className={cn(
                                  "text-gray-400 transition-transform flex-shrink-0",
                                  expandedStatus === status && "rotate-180 text-black"
                                )} 
                              />
                              <span className={cn(
                                "text-[9px] font-bold truncate px-1.5 py-0.5 rounded-md",
                                status.toLowerCase().includes("pendente") ? "bg-amber-100 text-amber-700" :
                                status.toLowerCase().includes("cancelado") ? "bg-red-100 text-red-700" :
                                "bg-green-100 text-green-700"
                              )}>
                                {status}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-right text-gray-600">{formatNumber(data.qtde)}</span>
                            <span className="text-[10px] font-black text-right">{formatCurrency(data.valor)}</span>
                          </div>

                          <AnimatePresence>
                            {expandedStatus === status && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="bg-white/50 rounded-lg mb-2 overflow-hidden"
                              >
                                <div className="p-2 space-y-1.5">
                                  <div className="grid grid-cols-3 gap-2 text-[7px] font-black text-gray-400 uppercase tracking-tighter pb-1 border-b border-gray-100">
                                    <span>Mês Receb.</span>
                                    <span className="text-right">Qtde</span>
                                    <span className="text-right">Valor</span>
                                  </div>
                                  {Object.entries(
                                    data.items.reduce((acc: any, item: Order) => {
                                      const key = item.mesRecebMaterial;
                                      if (!acc[key]) acc[key] = { qtde: 0, valor: 0 };
                                      acc[key].qtde += item.qtdeConfirmada;
                                      acc[key].valor += item.valorNF;
                                      return acc;
                                    }, {} as Record<string, { qtde: number; valor: number }>)
                                  )
                                  .sort((a, b) => parseMonthYear(a[0]).getTime() - parseMonthYear(b[0]).getTime()) // Oldest first
                                  .map(([month, mData]: [string, any]) => (
                                    <div key={month} className="grid grid-cols-3 gap-2 text-[9px]">
                                      <span className="text-gray-500 font-medium">{month}</span>
                                      <span className="text-right font-bold text-gray-700">{formatNumber(mData.qtde)}</span>
                                      <span className="text-right font-black">{formatCurrency(mData.valor)}</span>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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

    </div>
  );
};

export default AnalysisPage;
