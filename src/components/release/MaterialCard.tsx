import React from "react";
import { ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Order } from "../../types";
import { cn, formatCurrency, formatNumber } from "../../lib/utils";
import ProductImage from "../ProductImage";

export interface MaterialGroup {
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

export default MaterialCard;
