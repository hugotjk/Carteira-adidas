import React from "react";
import { Sparkles, LayoutList, Store, Lightbulb, ClipboardList, Wrench } from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../context/AuthContext";

// Só master e admins carregam a tela de verdade; os outros logins nem baixam esse código.
const Fw27Master = React.lazy(() => import("../components/fw27/Fw27Master"));
const MASTER_EMAIL = "hugotjk2@gmail.com";

const SECTIONS = [
  { id: "resumos", label: "Resumos FW27", icon: LayoutList },
  { id: "representatividade", label: "Representatividade por Loja", icon: Store },
  { id: "sugestao", label: "Sugestão", icon: Lightbulb },
  { id: "resumo", label: "Resumo", icon: ClipboardList },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

/**
 * Tela "Sugestão FW27".
 * - Master e admins: tela completa (em preparação, até sair a versão oficial).
 * - Demais logins: "Em manutenção".
 */
const SugestaoFW27Page: React.FC = () => {
  const { user, userProfile } = useAuth();
  const podeVer = userProfile?.role === "master" || userProfile?.role === "admin" || user?.email === MASTER_EMAIL;
  if (podeVer) {
    return (
      <React.Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
        <Fw27Master />
      </React.Suspense>
    );
  }
  return <EmManutencao />;
};

const EmManutencao: React.FC = () => {
  const [active, setActive] = React.useState<SectionId>("resumos");
  const current = SECTIONS.find((s) => s.id === active)!;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 overflow-x-hidden pb-12">
      <div className="bg-white border-b border-gray-100 px-6 py-8 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center shadow-lg shadow-black/10">
            <Sparkles className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-gray-900 tracking-tight leading-none">Sugestão FW27</h1>
            <p className="text-xs text-gray-400 mt-1">Planejamento da coleção FW27.</p>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-4">
        {/* Opções */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-3 rounded-2xl border text-left transition-all",
                active === s.id
                  ? "bg-black text-white border-black shadow-lg shadow-black/10"
                  : "bg-white text-gray-600 border-gray-100 hover:border-gray-300"
              )}
            >
              <s.icon size={16} className="shrink-0" />
              <span className="text-[11px] font-bold leading-tight">{s.label}</span>
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm px-6 py-16 flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mb-4">
            <Wrench size={22} />
          </div>
          <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">{current.label}</h2>
          <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mt-2">Em manutenção</p>
          <p className="text-xs text-gray-400 mt-2 max-w-xs">Esta tela está sendo preparada e estará disponível em breve.</p>
        </div>
      </div>
    </div>
  );
};

export default SugestaoFW27Page;
