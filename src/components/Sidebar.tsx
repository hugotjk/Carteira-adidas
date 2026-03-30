import React from "react";
import { LayoutDashboard, Table, Database, Menu, X, CheckSquare } from "lucide-react";
import { cn } from "../lib/utils";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "analysis", label: "Análise", icon: Table },
    { id: "release", label: "Liberação", icon: CheckSquare },
    { id: "sync", label: "Banco", icon: Database },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-100 flex-col">
        <div className="p-8 flex items-center space-x-3">
          <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-xl italic">a</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Adidas Orders</h1>
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

        <div className="p-8 border-t border-gray-50">
          <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">© 2026 Adidas Analyzer</p>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-t border-gray-100 px-4 py-3 pb-8 flex items-center justify-around w-full max-w-full overflow-hidden">
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
            <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
};

export default Sidebar;
