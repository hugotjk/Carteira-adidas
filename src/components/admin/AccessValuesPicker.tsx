import React from "react";
import { Search, CheckSquare as CheckedIcon, Square as UncheckedIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface AccessValuesPickerProps {
  /** "full" = formulário de novo login; "compact" = edição dentro do cartão do login. */
  variant: "full" | "compact";
  accessType: string;
  options: string[];
  selected: string[];
  search: string;
  onSearchChange: (value: string) => void;
  onToggle: (value: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}

/**
 * Lista de marcação dos valores liberados para um login
 * (ex.: quais gestores, lojas, grupos ou customers ele pode ver).
 */
export default function AccessValuesPicker({
  variant,
  accessType,
  options,
  selected,
  search,
  onSearchChange,
  onToggle,
  onSelectAll,
  onClear,
}: AccessValuesPickerProps) {
  const full = variant === "full";

  const list = (
    <>
      <div className={cn(
        "flex gap-2 border-b",
        full ? "flex-col sm:flex-row sm:items-center sm:justify-between border-gray-100 pb-3" : "items-center justify-between border-gray-50 pb-2"
      )}>
        <div>
          {full ? (
            <>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Filtrar Filtros Disponíveis</p>
              <p className="text-[9px] text-gray-400">Marque apenas os itens que este usuário possui permissão de visualizar</p>
            </>
          ) : (
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Limitações Disponíveis</p>
          )}
        </div>
        <div className={cn("flex", full ? "space-x-2 pb-1" : "space-x-1.5")}>
          <button
            type="button"
            onClick={onSelectAll}
            className={cn(
              "bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg uppercase transition-all",
              full ? "px-2.5 py-1 text-[9px] font-bold" : "px-2 py-0.5 text-[8px] font-black"
            )}
          >
            {full ? "Marcar Todos" : "Todos"}
          </button>
          <button
            type="button"
            onClick={onClear}
            className={cn(
              "bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg uppercase transition-all",
              full ? "px-2.5 py-1 text-[9px] font-bold" : "px-2 py-0.5 text-[8px] font-black"
            )}
          >
            {full ? "Limpar Seleção" : "Limpar"}
          </button>
        </div>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className={cn("absolute top-1/2 -translate-y-1/2 text-gray-400", full ? "left-3" : "left-2.5")} size={full ? 13 : 11} />
        <input
          type="text"
          placeholder={`Buscar por ${accessType.toLowerCase()}...`}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn(
            "w-full bg-gray-50 border border-gray-100 rounded-xl text-xs outline-none focus:bg-white focus:ring-1 focus:ring-black/10 transition-all",
            full ? "pl-9 pr-4 py-2" : "pl-8 pr-3 py-1.5 font-medium"
          )}
        />
      </div>

      {/* Itens para marcar */}
      <div className={cn(
        "overflow-y-auto border border-gray-50 rounded-xl grid grid-cols-1 sm:grid-cols-2 bg-gray-50/20",
        full ? "max-h-48 p-3 md:grid-cols-3 gap-2" : "max-h-36 p-2 gap-1.5"
      )}>
        {options.length === 0 ? (
          <div className={cn("col-span-full text-center font-bold text-gray-400 uppercase italic", full ? "py-4 text-[10px]" : "py-2 text-[9px]")}>
            Nenhum item localizado
          </div>
        ) : (
          options.map((opt) => {
            const isChecked = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onToggle(opt)}
                className={cn(
                  "flex items-center border text-left transition-all outline-none",
                  full ? "space-x-2 p-2 rounded-xl text-xs" : "space-x-1.5 p-1.5 rounded-lg text-[11px]",
                  isChecked
                    ? "bg-black text-white border-black"
                    : cn("bg-white text-gray-700 border-gray-100 hover:bg-gray-50", full && "hover:text-black")
                )}
              >
                {isChecked
                  ? <CheckedIcon size={full ? 14 : 12} className="shrink-0" />
                  : <UncheckedIcon size={full ? 14 : 12} className="shrink-0 text-gray-400" />}
                <span className={cn("truncate", full ? "font-medium" : "font-semibold")}>{opt}</span>
              </button>
            );
          })
        )}
      </div>

      {selected.length > 0 && (
        <div className={cn(
          "font-black text-gray-500 uppercase tracking-widest flex items-center justify-between",
          full ? "text-[10px] pt-1" : "text-[9px] pt-0.5 font-mono"
        )}>
          <span>{full ? "Registros selecionados:" : "Valores selecionados:"}</span>
          <span className="bg-black/5 px-2 py-0.5 rounded-full text-black font-black">{selected.length}</span>
        </div>
      )}
    </>
  );

  if (full) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="border border-gray-200 rounded-2xl bg-white p-4 space-y-3"
      >
        {list}
      </motion.div>
    );
  }

  return <div className="border border-gray-200 rounded-xl bg-white p-3 space-y-2">{list}</div>;
}
