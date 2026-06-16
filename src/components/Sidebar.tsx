import React from "react";
import { LayoutDashboard, Table, Database, Menu, X, CheckSquare, XSquare, LogOut, User } from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { userProfile, logout, dbConnected } = useAuth();
  const { syncDatabase, isSyncing } = useData();

  const handleLogoClick = async () => {
    if (isSyncing) return;
    try {
      await syncDatabase();
    } catch (e) {
      console.error("Error during logo click sync:", e);
    }
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "analysis", label: "Análise", icon: Table },
    { id: "release", label: "Liberar & Cancelar", icon: CheckSquare },
    { id: "sync", label: "Banco", icon: Database },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-100 flex-col">
        <div className="p-8 flex items-center space-x-3 select-none">
          <img
            src="https://images.seeklogo.com/logo-png/26/1/adidas-logo-png_seeklogo-263852.png"
            alt="Adidas Logo"
            onClick={handleLogoClick}
            referrerPolicy="no-referrer"
            title="Clique para sincronizar o banco de dados"
            className={cn(
              "h-8 w-auto object-contain cursor-pointer transition-all duration-300",
              isSyncing ? "animate-spin opacity-45 pointer-events-none" : "hover:scale-110 active:scale-95"
            )}
          />
          <h1 className="text-xl font-bold tracking-tight">Carteira adidas</h1>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all duration-200",
                activeTab === item.id
                  ? "bg-black text-white shadow-lg shadow-black/10 scale-[1.02]"
                  : "text-gray-500 hover:bg-gray-50 hover:text-black"
              )}
            >
              <item.icon size={20} />
              <span className="font-bold text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* User Info & Logout Button */}
        {userProfile && (
          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50 m-4 rounded-3xl space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-black/5 rounded-xl flex items-center justify-center shrink-0 relative">
                <User size={16} className="text-gray-600" />
                <span 
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white",
                    dbConnected ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
                  )} 
                  title={dbConnected ? "Conectado ao Firestore" : "Modo Offline / Sem Conexão local"}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-gray-800 truncate">{userProfile.email}</p>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider truncate">
                  {userProfile.role === "master" ? "Master" : userProfile.role === "admin" ? "Administrador" : `Limitação: ${userProfile.accessType}`}
                </p>
                <p className="text-[8px] font-bold text-gray-400 mt-0.5 flex items-center">
                  <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1", dbConnected ? "bg-emerald-500" : "bg-custom-amber bg-amber-500")} />
                  {dbConnected ? "Conectado" : "Offline / Cache"}
                </p>
              </div>
            </div>
            
            <button
              onClick={logout}
              className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-red-50 hover:bg-red-100 active:scale-95 text-red-600 rounded-xl text-xs font-bold transition-all"
            >
              <LogOut size={14} />
              <span>Sair da Conta</span>
            </button>
          </div>
        )}

        <div className="p-8 pt-0 border-t border-gray-50 space-y-1">
          <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">© 2026 Adidas Analyzer</p>
          <p className="text-[9px] font-medium text-gray-400 italic">by Hugo Alves</p>
        </div>
      </aside>

      {/* Mobile Bottom Navigation with Floating User/Logout */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur shadow-sm border-b border-gray-100 py-3 px-4 flex items-center justify-between select-none">
        <div className="flex items-center space-x-2">
          <img
            src="https://images.seeklogo.com/logo-png/26/1/adidas-logo-png_seeklogo-263852.png"
            alt="Adidas Logo"
            onClick={handleLogoClick}
            referrerPolicy="no-referrer"
            className={cn(
              "h-6 w-auto object-contain cursor-pointer transition-all duration-350",
              isSyncing ? "animate-spin opacity-45 pointer-events-none" : "hover:scale-110 active:scale-95"
            )}
          />
          <h1 className="text-sm font-bold tracking-tight text-gray-950">Carteira adidas</h1>
        </div>
        {userProfile && (
          <button 
            onClick={logout} 
            className="flex items-center space-x-1 py-1 px-3 bg-red-50 text-red-600 rounded-lg text-[9px] font-bold tracking-wider uppercase active:scale-95 transition-all"
          >
            <LogOut size={10} />
            <span>Sair</span>
          </button>
        )}
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-t border-gray-100 px-4 py-3 pb-8 flex items-center justify-around w-full max-w-full overflow-hidden">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "flex flex-col items-center space-y-1 transition-all duration-200",
              activeTab === item.id ? "text-black scale-110" : "text-gray-400"
            )}
          >
            <div className={cn(
              "p-2 rounded-xl transition-colors",
              activeTab === item.id ? "bg-black text-white shadow-md" : "bg-transparent"
            )}>
              <item.icon size={20} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-tighter">
              {item.id === 'release' ? 'LIB. | CANC.' : item.label}
            </span>
          </button>
        ))}
      </nav>
    </>
  );
};

export default Sidebar;
