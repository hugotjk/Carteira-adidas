import React, { useDeferredValue } from "react";
import { Search, ChevronDown, Loader2, X, Check, Share2, Plus } from "lucide-react";
import { Order, FilterType, FILTER_LABELS } from "../types";
import { cn, formatCurrency, formatNumber } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useFilters } from "../context/FilterContext";
import { useData } from "../context/DataContext";
import Papa from "papaparse";
import PageHeader from "../components/PageHeader";

const PAGE_SIZE = 50;

const ProductImage = ({ material }: { material: string }) => {
  const { imageMap } = useData();
  const extension = imageMap[material];
  
  if (!extension) {
    return (
      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200 flex-shrink-0">
        <span className="text-[6px] font-black text-gray-400 uppercase text-center leading-tight">SEM<br/>FOTO</span>
      </div>
    );
  }

  const imageUrl = `https://raw.githubusercontent.com/hugotjk/adidas-fla/main/${material}.${extension}`;

  return (
    <div className="w-12 h-12 bg-white rounded-lg overflow-hidden border border-gray-100 flex items-center justify-center flex-shrink-0">
      <img 
        src={imageUrl} 
        alt={material}
        className="w-full h-full object-contain"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

interface MaterialGroup {
  material: string;
  materialDescription: string;
  totalQty: number;
  totalValue: number;
  avgVenda: number;
  avgEstoque: number;
  avgMediaVenda: number;
  avgEstoqueGestor: number;
  orders: Order[];
}

const StoreRow = React.memo(({ 
  order, 
  isSelected, 
  onToggle 
}: { 
  order: Order; 
  isSelected: boolean; 
  onToggle: (id: string, e: React.MouseEvent) => void 
}) => (
  <div 
    onClick={(e) => onToggle(order.id!, e)}
    className={cn(
      "bg-white/60 p-2.5 rounded-xl border transition-all flex items-center space-x-3 cursor-pointer",
      isSelected ? "border-black/40 bg-black/[0.01]" : "border-gray-100"
    )}
  >
    <div className={cn(
      "flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-colors",
      isSelected ? "bg-black border-black text-white" : "border-gray-200 text-transparent"
    )}>
      <Check size={12} />
    </div>

    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-start">
        <div className="flex items-center space-x-2">
          <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">{order.pedido}</span>
          <span className="text-[8px] font-bold text-blue-500 uppercase tracking-wider bg-blue-50 px-1 rounded">{order.loja}</span>
        </div>
        <span className="text-[8px] font-bold text-gray-400">{order.mesRecebMaterial}</span>
      </div>
      
      <div className="grid grid-cols-3 gap-x-3 mt-1 pt-1 border-t border-gray-50/50">
        <div className="flex flex-col">
          <p className="text-[6px] font-bold text-gray-400 uppercase leading-none mb-0.5">Qtde | Valor</p>
          <p className="text-[9px] font-black leading-none">
            {formatNumber(order.qtdeConfirmada)} <span className="text-gray-300 mx-0.5">|</span> {formatCurrency(order.valorNF)}
          </p>
        </div>
        <div className="flex flex-col">
          <p className="text-[6px] font-bold text-gray-400 uppercase leading-none mb-0.5">Venda | Estq</p>
          <p className="text-[9px] font-black leading-none">
            {formatNumber(order.venda)} <span className="text-gray-300 mx-0.5">|</span> {formatNumber(order.estoque)}
          </p>
        </div>
        <div className="flex flex-col">
          <p className="text-[6px] font-bold text-gray-400 uppercase leading-none mb-0.5">Venda G. | Estq G.</p>
          <p className="text-[9px] font-black leading-none text-orange-600">
            {formatNumber(order.mediaVenda)} <span className="text-gray-300 mx-0.5">|</span> {formatNumber(order.estoqueGestor)}
          </p>
        </div>
      </div>
    </div>
  </div>
));

const MaterialCard = React.memo(({ 
  group, 
  isExpanded, 
  allSelected, 
  someSelected, 
  onToggleExpansion, 
  onToggleSelection,
  selectedIds,
  onToggleOrderSelection
}: { 
  group: MaterialGroup; 
  isExpanded: boolean; 
  allSelected: boolean; 
  someSelected: boolean; 
  onToggleExpansion: (material: string) => void;
  onToggleSelection: (group: MaterialGroup, e: React.MouseEvent) => void;
  selectedIds: Set<string>;
  onToggleOrderSelection: (id: string, e: React.MouseEvent) => void;
}) => (
  <div className="flex flex-col space-y-2">
    <div 
      onClick={() => onToggleExpansion(group.material)}
      className={cn(
        "bg-white p-3 rounded-xl border transition-all flex items-center space-x-3 cursor-pointer",
        isExpanded ? "border-black shadow-md" : "border-gray-100"
      )}
    >
      <div 
        onClick={(e) => onToggleSelection(group, e)}
        className={cn(
          "flex-shrink-0 w-6 h-6 rounded-lg border flex items-center justify-center transition-colors",
          allSelected ? "bg-black border-black text-white" : someSelected ? "bg-gray-200 border-gray-300 text-black" : "border-gray-200 text-transparent"
        )}
      >
        {allSelected ? <Check size={14} /> : someSelected ? <div className="w-2 h-0.5 bg-black" /> : null}
      </div>

      <div className="flex-1 min-w-0 flex gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{group.material}</span>
            <h3 className="text-xs font-bold text-gray-900 leading-tight truncate">{group.materialDescription}</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1.5 pt-1.5 border-t border-gray-50">
            <div className="flex flex-col">
              <p className="text-[7px] font-bold text-gray-400 uppercase leading-none mb-0.5">Qtde | Valor</p>
              <p className="text-[10px] font-black leading-none">
                {formatNumber(group.totalQty)} <span className="text-gray-300 mx-1">|</span> {formatCurrency(group.totalValue)}
              </p>
            </div>
            <div className="flex flex-col">
              <p className="text-[7px] font-bold text-gray-400 uppercase leading-none mb-0.5">Venda G. | Estq G.</p>
              <p className="text-[10px] font-black leading-none text-orange-600">
                {formatNumber(group.avgMediaVenda)} <span className="text-gray-300 mx-1">|</span> {formatNumber(group.avgEstoqueGestor)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end justify-between self-stretch">
          <ChevronDown size={14} className={cn("text-gray-400 transition-transform", isExpanded && "rotate-180")} />
          <ProductImage material={group.material} />
        </div>
      </div>
    </div>

    <AnimatePresence>
      {isExpanded && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden flex flex-col space-y-1.5 pl-4"
        >
          {group.orders.map((order) => (
            <StoreRow 
              key={order.id} 
              order={order} 
              isSelected={selectedIds.has(order.id!)}
              onToggle={onToggleOrderSelection}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
));

const ReleasePage: React.FC = () => {
  const { filters, updateFilter, clearFilters } = useFilters();
  const { allOrders, loading } = useData();
  const [searchTerm, setSearchTerm] = React.useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [activeFilter, setActiveFilter] = React.useState<FilterType | null>(null);
  const [filterSearch, setFilterSearch] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  const [isSummaryOpen, setIsSummaryOpen] = React.useState(false);
  const [summaryGroupBy, setSummaryGroupBy] = React.useState<'material' | 'subGrupo' | 'loja'>('material');
  const [expandedMaterials, setExpandedMaterials] = React.useState<Set<string>>(new Set());

  const filterOptions = React.useMemo(() => {
    if (!activeFilter) return [];
    
    const otherFilters = { ...filters };
    delete otherFilters[activeFilter];
    let filteredForOptions = allOrders;
    
    const activeOtherFilters = Object.entries(otherFilters).filter(([_, v]) => (v as string[]).length > 0);
    
    if (activeOtherFilters.length > 0) {
      filteredForOptions = filteredForOptions.filter(order => 
        activeOtherFilters.every(([key, values]) => (values as string[]).includes(order[key as FilterType]))
      );
    }
    
    return Array.from(new Set(filteredForOptions.map((order) => order[activeFilter]))).filter(Boolean).sort();
  }, [allOrders, filters, activeFilter]);

  const groupedMaterials = React.useMemo(() => {
    const lowerSearch = deferredSearchTerm.toLowerCase();
    const activeFilters = Object.entries(filters).filter(([_, v]) => (v as string[]).length > 0);

    // Filter and Group in one pass
    const groups: Record<string, MaterialGroup> = {};
    
    for (const order of allOrders) {
      // Apply Filters
      let matchesFilters = true;
      for (const [key, values] of activeFilters) {
        if (!(values as string[]).includes(order[key as FilterType])) {
          matchesFilters = false;
          break;
        }
      }
      if (!matchesFilters) continue;

      // Apply Search
      if (lowerSearch) {
        if (!(order.material.toLowerCase().includes(lowerSearch) ||
            order.materialDescription.toLowerCase().includes(lowerSearch) ||
            order.pedido.toLowerCase().includes(lowerSearch))) {
          continue;
        }
      }

      // Grouping
      if (!groups[order.material]) {
        groups[order.material] = {
          material: order.material,
          materialDescription: order.materialDescription,
          totalQty: 0,
          totalValue: 0,
          avgVenda: 0,
          avgEstoque: 0,
          avgMediaVenda: 0,
          avgEstoqueGestor: 0,
          orders: []
        };
      }
      const g = groups[order.material];
      g.totalQty += order.qtdeConfirmada;
      g.totalValue += order.valorNF;
      g.avgVenda += order.venda;
      g.avgEstoque += order.estoque;
      g.avgMediaVenda += order.mediaVenda;
      g.avgEstoqueGestor += order.estoqueGestor;
      g.orders.push(order);
    }

    // Calculate averages and sort internal orders
    const finalGroups = Object.values(groups).map(group => {
      const count = group.orders.length;
      group.avgVenda /= count;
      group.avgEstoque /= count;
      group.avgMediaVenda /= count;
      group.avgEstoqueGestor /= count;

      // Calculate store totals for this material
      const storeTotals: Record<string, number> = {};
      group.orders.forEach(o => {
        storeTotals[o.loja] = (storeTotals[o.loja] || 0) + o.valorNF;
      });

      // Sort internal orders: Store total value (DESC), Store Name (ASC), Mes Receb (ASC)
      group.orders.sort((a, b) => {
        const totalA = storeTotals[a.loja];
        const totalB = storeTotals[b.loja];
        if (totalB !== totalA) return totalB - totalA;
        if (a.loja !== b.loja) return a.loja.localeCompare(b.loja);
        return (a.mesRecebTimestamp || 0) - (b.mesRecebTimestamp || 0);
      });

      return group;
    });

    // Sort groups by total value DESC
    finalGroups.sort((a, b) => b.totalValue - a.totalValue);

    return finalGroups;
  }, [filters, deferredSearchTerm, allOrders]);

  const allFilteredIds = React.useMemo(() => {
    return groupedMaterials.flatMap(g => g.orders.map(o => o.id!));
  }, [groupedMaterials]);

  // Reset visible count when filters or search change
  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters, deferredSearchTerm]);

  const toggleMaterialExpansion = React.useCallback((material: string) => {
    setExpandedMaterials(prev => {
      const next = new Set(prev);
      if (next.has(material)) next.delete(material);
      else next.add(material);
      return next;
    });
  }, []);

  const toggleSelection = React.useCallback((id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleMaterialSelection = React.useCallback((group: MaterialGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    const groupIds = group.orders.map(o => o.id!);
    const allSelected = groupIds.every(id => selectedIds.has(id));
    
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        groupIds.forEach(id => next.delete(id));
      } else {
        groupIds.forEach(id => next.add(id));
      }
      return next;
    });
  }, [selectedIds]);

  const toggleSelectAllPage = React.useCallback(() => {
    if (selectedIds.size === allFilteredIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allFilteredIds));
    }
  }, [selectedIds.size, allFilteredIds]);

  const clearSelection = () => {
    setSelectedIds(new Set());
    setIsSummaryOpen(false);
  };

  const selectedOrders = React.useMemo(() => {
    if (selectedIds.size === 0) return [];
    return allOrders.filter((o) => selectedIds.has(o.id!));
  }, [allOrders, selectedIds]);

  const totals = React.useMemo(() => {
    let qty = 0;
    let value = 0;
    for (const order of selectedOrders) {
      qty += order.qtdeConfirmada;
      value += order.valorNF;
    }
    return { qty, value };
  }, [selectedOrders]);

  const groupedSummary = React.useMemo(() => {
    const summary: Record<string, { label: string; description: string; qty: number; value: number }> = {};
    for (const order of selectedOrders) {
      const key = order[summaryGroupBy];
      if (!summary[key]) {
        summary[key] = { 
          label: key, 
          description: summaryGroupBy === 'material' ? order.materialDescription : '', 
          qty: 0, 
          value: 0 
        };
      }
      const s = summary[key];
      s.qty += order.qtdeConfirmada;
      s.value += order.valorNF;
    }
    return Object.values(summary).sort((a, b) => b.value - a.value);
  }, [selectedOrders, summaryGroupBy]);

  const handleExport = async () => {
    if (selectedIds.size === 0) return;

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

  const visibleGroups = groupedMaterials.slice(0, visibleCount);

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
            {selectedIds.size === allFilteredIds.length ? "Desmarcar" : "Marcar Todos"}
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
                  onClick={() => toggleSelectAllFilter(activeFilter, filterOptions as string[])}
                  className="w-full flex items-center space-x-3 px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors group"
                >
                  <div className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                    (filters[activeFilter] || []).length === filterOptions.length
                      ? "bg-black border-black"
                      : "border-gray-300 group-hover:border-gray-400"
                  )}>
                    <Check size={10} className="text-white" />
                  </div>
                  <span className="text-xs font-bold text-gray-700">(Selecionar Tudo)</span>
                </button>

                {filterOptions
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

      {/* List of Materials */}
      <div className="px-4 space-y-3 mt-4">
        {visibleGroups.length > 0 ? (
          <>
            {visibleGroups.map((group) => {
              const isExpanded = expandedMaterials.has(group.material);
              const allSelected = group.orders.every(o => selectedIds.has(o.id!));
              const someSelected = group.orders.some(o => selectedIds.has(o.id!));

              return (
                <MaterialCard 
                  key={group.material}
                  group={group}
                  isExpanded={isExpanded}
                  allSelected={allSelected}
                  someSelected={someSelected}
                  onToggleExpansion={toggleMaterialExpansion}
                  onToggleSelection={toggleMaterialSelection}
                  selectedIds={selectedIds}
                  onToggleOrderSelection={toggleSelection}
                />
              );
            })}

            {visibleCount < groupedMaterials.length && (
              <button 
                onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                className="w-full py-4 bg-white border border-gray-100 rounded-xl text-xs font-bold text-gray-400 flex items-center justify-center space-x-2 active:bg-gray-50"
              >
                <Plus size={14} />
                <span>Carregar mais ({groupedMaterials.length - visibleCount} restantes)</span>
              </button>
            )}
          </>
        ) : (
          <div className="py-20 text-center">
            <Search className="text-gray-300 mx-auto mb-4" size={24} />
            <p className="text-gray-500 font-medium">Nenhum material encontrado</p>
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
                          <div key={m.label} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
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
