import React, { useDeferredValue } from "react";
import { Search, ChevronDown, Loader2, X, Check, Share2, Plus } from "lucide-react";
import { Order, FilterType, FILTER_LABELS } from "../types";
import { cn, formatCurrency, formatNumber } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useFilters } from "../context/FilterContext";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import * as XLSX from "xlsx-js-style";

const PAGE_SIZE = 50;

const ProductImage = React.memo(({ material, imageMap }: { material: string; imageMap: Record<string, string> }) => {
  const extension = imageMap[material];
  
  if (!extension) {
    return (
      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200 flex-shrink-0">
        <span className="text-[6px] font-black text-gray-400 uppercase text-center leading-tight">SEM<br/>FOTO</span>
      </div>
    );
  }

  let ext = extension;
  let repo = "adidas-fla";
  if (extension.includes(":")) {
    const parts = extension.split(":");
    ext = parts[0];
    repo = parts[1];
  }

  const imageUrl = repo === "adidas"
    ? `https://raw.githubusercontent.com/hugotjk/adidas/main/${material}.${ext}`
    : `https://raw.githubusercontent.com/hugotjk/adidas-fla/main/${material}.${ext}`;

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
});

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
  onToggleOrderSelection,
  imageMap
}: { 
  group: MaterialGroup; 
  isExpanded: boolean; 
  allSelected: boolean; 
  someSelected: boolean; 
  onToggleExpansion: (material: string) => void;
  onToggleSelection: (group: MaterialGroup, e: React.MouseEvent) => void;
  selectedIds: Set<string>;
  onToggleOrderSelection: (id: string, e: React.MouseEvent) => void;
  imageMap: Record<string, string>;
}) => {
  const sortedOrders = React.useMemo(() => {
    if (!isExpanded) return [];
    
    const storeTotals: Record<string, number> = {};
    group.orders.forEach(o => {
      storeTotals[o.loja] = (storeTotals[o.loja] || 0) + o.valorNF;
    });

    return [...group.orders].sort((a, b) => {
      const totalA = storeTotals[a.loja];
      const totalB = storeTotals[b.loja];
      if (totalB !== totalA) return totalB - totalA;
      if (a.loja !== b.loja) return a.loja.localeCompare(b.loja);
      return (a.mesRecebTimestamp || 0) - (b.mesRecebTimestamp || 0);
    });
  }, [group.orders, isExpanded]);

  return (
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
          <ProductImage material={group.material} imageMap={imageMap} />
        </div>
      </div>
    </div>

    <AnimatePresence initial={false}>
      {isExpanded && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="overflow-hidden flex flex-col space-y-1.5 pl-4"
        >
          {sortedOrders.map((order) => (
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
);
}, (prev, next) => {
  // Only re-render if:
  // 1. Expansion state changed
  // 2. It is expanded and selectedIds changed
  // 3. Selection summary (all/some) changed
  // 4. Group or imageMap changed
  return prev.isExpanded === next.isExpanded &&
         prev.allSelected === next.allSelected &&
         prev.someSelected === next.someSelected &&
         prev.group === next.group &&
         prev.imageMap === next.imageMap &&
         (!next.isExpanded || prev.selectedIds === next.selectedIds);
});

const ReleasePage: React.FC = () => {
  const { filters, updateFilter, clearFilters } = useFilters();
  const { allOrders, loading, imageMap } = useData();
  const { userProfile } = useAuth();
  const [searchTerm, setSearchTerm] = React.useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [activeFilter, setActiveFilter] = React.useState<FilterType | null>(null);
  const [filterSearch, setFilterSearch] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  const [isSummaryOpen, setIsSummaryOpen] = React.useState(false);
  const [summaryGroupBy, setSummaryGroupBy] = React.useState<'material' | 'subGrupo' | 'loja'>('material');
  const [expandedMaterial, setExpandedMaterial] = React.useState<string | null>(null);

  const filterOptions = React.useMemo(() => {
    if (!activeFilter) return [];
    
    const otherFilters = { ...filters };
    delete otherFilters[activeFilter];
    let filteredForOptions = allOrders;
    
    const activeOtherFilters = Object.entries(otherFilters).filter(([_, v]) => v && (v as string[]).length > 0);
    
    if (activeOtherFilters.length > 0) {
      filteredForOptions = filteredForOptions.filter(order => 
        activeOtherFilters.every(([key, values]) => (values as string[]).includes(order[key as FilterType]))
      );
    }
    
    return Array.from(new Set(filteredForOptions.map((order) => order[activeFilter]))).filter(Boolean).sort();
  }, [allOrders, filters, activeFilter]);

  const groupedMaterials = React.useMemo(() => {
    const lowerSearch = deferredSearchTerm.toLowerCase();
    const activeFilters = Object.entries(filters).filter(([_, v]) => v && (v as string[]).length > 0);

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

    // Calculate averages and sort internal orders only for expanded or visible groups
    const finalGroups = Object.values(groups).map(group => {
      const count = group.orders.length;
      group.avgVenda /= count;
      group.avgEstoque /= count;
      group.avgMediaVenda /= count;
      group.avgEstoqueGestor /= count;
      
      return group;
    });

    // Sort groups by total value DESC
    finalGroups.sort((a, b) => b.totalValue - a.totalValue);

    return finalGroups;
  }, [filters, deferredSearchTerm, allOrders]);

  const allFilteredIds = React.useMemo(() => {
    const ids: string[] = [];
    for (const g of groupedMaterials) {
      for (const o of g.orders) {
        ids.push(o.id!);
      }
    }
    return ids;
  }, [groupedMaterials]);

  // Reset visible count when filters or search change
  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters, deferredSearchTerm]);

  const toggleMaterialExpansion = React.useCallback((material: string) => {
    setExpandedMaterial(prev => prev === material ? null : material);
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
    
    setSelectedIds(prev => {
      const allSelected = groupIds.every(id => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        groupIds.forEach(id => next.delete(id));
      } else {
        groupIds.forEach(id => next.add(id));
      }
      return next;
    });
  }, []);

  const toggleSelectAllPage = React.useCallback(() => {
    setSelectedIds(prev => {
      if (prev.size === allFilteredIds.length) {
        return new Set();
      } else {
        return new Set(allFilteredIds);
      }
    });
  }, [allFilteredIds]);

  const clearSelection = () => {
    setSelectedIds(new Set());
    setIsSummaryOpen(false);
  };

  const allOrdersMap = React.useMemo(() => {
    const map = new Map<string, Order>();
    for (const o of allOrders) {
      map.set(o.id!, o);
    }
    return map;
  }, [allOrders]);

  const selectedOrders = React.useMemo(() => {
    if (selectedIds.size === 0) return [];
    const orders: Order[] = [];
    selectedIds.forEach(id => {
      const o = allOrdersMap.get(id);
      if (o) orders.push(o);
    });
    return orders;
  }, [allOrdersMap, selectedIds]);

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

    const rowsToExport = selectedOrders.map(o => {
      const row = { ...(o.originalRow || o) };
      // Process all values to convert numeric strings to actual numbers
      Object.keys(row).forEach(key => {
        const val = row[key];
        if (typeof val === 'string') {
          const trimmed = val.trim();
          if (trimmed === '') return;

          // 1. Brazilian format: "1.234,56" or "123,45"
          if (/^-?[\d.]+,[\d]+$/.test(trimmed)) {
            const num = parseFloat(trimmed.replace(/\./g, '').replace(',', '.'));
            if (!isNaN(num)) row[key] = num;
          }
          // 2. Standard numeric or integer: "1234" or "1234.56"
          else if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
            // Avoid converting codes with leading zeros (e.g. "00123")
            const isCode = trimmed.length > 1 && trimmed.startsWith('0') && !trimmed.startsWith('0.');
            if (!isCode) {
              const num = parseFloat(trimmed);
              if (!isNaN(num)) row[key] = num;
            }
          }
        }
      });
      return row;
    });
    
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rowsToExport);
    
    // High-precision column configurations for A to BC (columns 1 to 55)
    const colConfigs = [
      // A (0)
      { wch: 10.29, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // B (1)
      { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // C (2)
      { wch: 7, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // D (3)
      { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // E (4)
      { wch: 4.57, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // F (5)
      { wch: 22.86, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // G (6)
      { wch: 10.29, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // H (7)
      { wch: 31.29, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // I (8)
      { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // J (9)
      { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // K (10)
      { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // L (11)
      { wch: 20.86, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // M (12)
      { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // N (13)
      { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // O (14)
      { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // P (15)
      { wch: 9.71, format: "dd/mm/yyyy", align: "center", headerColor: "000000", headerTextColor: "FFFFFF" },
      // Q (16)
      { wch: 9.71, format: "dd/mm/yyyy", align: "center", headerColor: "000000", headerTextColor: "FFFFFF" },
      // R (17)
      { wch: 9.71, format: "dd/mm/yyyy", align: "center", headerColor: "000000", headerTextColor: "FFFFFF" },
      // S (18)
      { wch: 10.29, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // T (19)
      { wch: 9.71, format: "dd/mm/yyyy", align: "center", headerColor: "000000", headerTextColor: "FFFFFF" },
      // U (20)
      { wch: 10.86, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // V (21)
      { wch: 9.71, format: "dd/mm/yyyy", align: "center", headerColor: "000000", headerTextColor: "FFFFFF" },
      // W (22)
      { wch: 7.57, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // X (23)
      { wch: 23.43, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // Y (24)
      { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // Z (25)
      { wch: 15.43, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // AA (26)
      { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // AB (27)
      { wch: 13.86, format: "General", align: "center", headerColor: "000000", headerTextColor: "FFFFFF" },
      // AC (28)
      { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // AD (29)
      { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // AE (30)
      { wch: 10.29, format: '_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)', align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // AF (31)
      { wch: 7.29, format: '_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)', align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // AG (32)
      { wch: 4, format: "General", align: "left", headerColor: "90EE90", headerTextColor: "000000" }, // Verde-claro
      // AH (33)
      { wch: 10.29, format: "General", align: "left", headerColor: "90EE90", headerTextColor: "000000" }, // Verde-claro
      // AI (34)
      { wch: 9.71, format: "General", align: "left", headerColor: "90EE90", headerTextColor: "000000" }, // Verde-claro
      // AJ (35)
      { wch: 7.43, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // AK (36)
      { wch: 7.43, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // AL (37)
      { wch: 7.43, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // AM (38)
      { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // AN (39)
      { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // AO (40)
      { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // AP (41)
      { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // AQ (42)
      { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // AR (43)
      { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // AS (44)
      { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // AT (45)
      { wch: 11, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // AU (46)
      { wch: 27.14, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // AV (47)
      { wch: 16.29, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // AW (48)
      { wch: 10.57, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // AX (49)
      { wch: 6.86, format: "General", align: "center", headerColor: "000000", headerTextColor: "FFFFFF" },
      // AY (50)
      { wch: 6.86, format: "General", align: "center", headerColor: "000000", headerTextColor: "FFFFFF" },
      // AZ (51)
      { wch: 9, format: "General", align: "center", headerColor: "000000", headerTextColor: "FFFFFF" },
      // BA (52)
      { wch: 9, format: "General", align: "center", headerColor: "000000", headerTextColor: "FFFFFF" },
      // BB (53)
      { wch: 12.71, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
      // BC (54)
      { wch: 7.86, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" }
    ];

    // Set column widths
    ws['!cols'] = colConfigs.map(c => ({ wch: c.wch }));

    // Define all-border style (black thin borders)
    const borderStyle = {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    };

    let maxRow = 0;
    if (ws['!ref']) {
      const range = XLSX.utils.decode_range(ws['!ref']);
      maxRow = range.e.r;
    }

    // Traverse all rows and columns from A (0) to BC (54)
    for (let r = 0; r <= maxRow; r++) {
      for (let c = 0; c <= 54; c++) {
        const cellId = XLSX.utils.encode_cell({ r, c });
        let cell = ws[cellId];
        
        // If cell is empty/not present, create it so we can style/border it
        if (!cell) {
          cell = { t: 's', v: '' };
          ws[cellId] = cell;
        }

        const colStyle = colConfigs[c];
        if (!colStyle) continue;

        const isHeader = r === 0;

        if (isHeader) {
          // First Row Header Style (custom fill pattern + Calibri size 10 font + alignment + borders)
          cell.s = {
            fill: {
              patternType: "solid",
              fgColor: { rgb: colStyle.headerColor }
            },
            font: {
              name: "Calibri",
              sz: 10,
              bold: true,
              color: { rgb: colStyle.headerTextColor }
            },
            alignment: {
              vertical: "center",
              horizontal: colStyle.align
            },
            border: borderStyle
          };
        } else {
          // Data Row Style (Sem cor background, font preta Calibri size 10, vertical alignment center + horizontal alignment + borders)
          cell.s = {
            font: {
              name: "Calibri",
              sz: 10,
              color: { rgb: "000000" }
            },
            alignment: {
              vertical: "center",
              horizontal: colStyle.align
            },
            border: borderStyle
          };

          // Format dates in Brazilian dd/mm/yyyy format (string value so Excel never flips it to American format based on regional OS locales)
          if (colStyle.format === "dd/mm/yyyy") {
            const val = cell.v;
            let dateStr = "";
            if (val instanceof Date) {
              const d = val.getDate().toString().padStart(2, '0');
              const m = (val.getMonth() + 1).toString().padStart(2, '0');
              const y = val.getFullYear();
              dateStr = `${d}/${m}/${y}`;
            } else if (val) {
              const trimmed = String(val).trim();
              if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                const parts = trimmed.split('-');
                dateStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
              } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
                dateStr = trimmed;
              } else if (trimmed !== '') {
                const parsed = new Date(trimmed);
                if (parsed && !isNaN(parsed.getTime())) {
                  const d = parsed.getDate().toString().padStart(2, '0');
                  const m = (parsed.getMonth() + 1).toString().padStart(2, '0');
                  const y = parsed.getFullYear();
                  dateStr = `${d}/${m}/${y}`;
                } else {
                  dateStr = trimmed;
                }
              }
            }
            if (dateStr) {
              cell.t = 's';
              cell.v = dateStr;
            }
          }
          // Financial R$ currency format or custom Accounting format
          else if (colStyle.format === "R$ #,##0.00" || colStyle.format.includes("#,##0.00")) {
            if (typeof cell.v === 'string') {
              const num = parseFloat(cell.v.replace(/[^\d.-]/g, ''));
              if (!isNaN(num)) {
                cell.t = 'n';
                cell.v = num;
              }
            }
            cell.z = colStyle.format;
          }
          // Other custom format
          else if (colStyle.format !== "General") {
            cell.z = colStyle.format;
          }
          // Default numeric logic for summability
          else if (cell.t === 'n') {
            const val = cell.v;
            if (typeof val === 'number') {
              if (Number.isInteger(val)) {
                cell.z = '0';
              } else {
                cell.z = '0.00';
              }
            }
          }
        }
      }
    }
    
    XLSX.utils.book_append_sheet(wb, ws, "Liberação");
    
    // Generate buffer
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    
    // Construct filename containing user's name (lowercase) and current date
    const username = userProfile?.name 
      ? userProfile.name.trim().toLowerCase() 
      : (userProfile?.email ? userProfile.email.split("@")[0].trim().toLowerCase() : "usuario");
    const currentDate = new Date().toISOString().split('T')[0];
    const filename = `lib_canc_${username}_${currentDate}.xlsx`;

    const mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const file = new File([blob], filename, { type: mimeType });

    const isIframe = typeof window !== "undefined" && window.self !== window.top;

    if (!isIframe && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Exportação Liberação',
          text: 'Arquivo de liberação de pedidos'
        });
      } catch (error) {
        console.warn("Sharing not supported or permission denied, downloading file instead:", error);
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
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Buscar material, descrição ou pedido..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-100 border-none rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-black/5 outline-none"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 shrink-0">
            <button 
              onClick={clearSelection}
              disabled={selectedIds.size === 0}
              className={cn(
                "text-[10px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all active:scale-95 duration-200 whitespace-nowrap",
                selectedIds.size > 0 
                  ? "bg-[#FFF0EB] text-[#FF5A2B] hover:bg-[#FFE3D9] cursor-pointer" 
                  : "bg-gray-100/50 text-gray-300 cursor-not-allowed"
              )}
            >
              Limpar Seleção
            </button>
            <button 
              onClick={clearFilters}
              disabled={Object.keys(filters).length === 0}
              className={cn(
                "text-[10px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all active:scale-95 duration-200 whitespace-nowrap",
                Object.keys(filters).length > 0 
                  ? "bg-[#FFEBEB] text-[#FF4D4D] hover:bg-[#FFD6D6] cursor-pointer" 
                  : "bg-gray-100/50 text-gray-300 cursor-not-allowed"
              )}
            >
              Limpar Filtros
            </button>
            <button 
              onClick={toggleSelectAllPage}
              disabled={allFilteredIds.length === 0}
              className={cn(
                "text-[10px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all active:scale-95 duration-200 whitespace-nowrap",
                allFilteredIds.length > 0
                  ? "bg-[#EBF3FF] text-[#1A73E8] hover:bg-[#D6E7FF] cursor-pointer"
                  : "bg-gray-100/50 text-gray-300 cursor-not-allowed"
              )}
            >
              {selectedIds.size === allFilteredIds.length && allFilteredIds.length > 0 ? "Desmarcar Todos" : "Marcar Todos"}
            </button>
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
              const isExpanded = expandedMaterial === group.material;
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
                  imageMap={imageMap}
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
                <span className="text-xs font-black uppercase tracking-wider">Exportar XLSX</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReleasePage;
