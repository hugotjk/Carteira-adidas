import React from "react";
import { useData } from "../context/DataContext";
import { fetchSheetData, saveOrdersLocally } from "../services/dataService";
import { Loader2 } from "lucide-react";
import { cn } from "../lib/utils";

interface PageHeaderProps {
  title: string;
  children?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, children }) => {
  const { refreshData } = useData();
  const [isSyncing, setIsSyncing] = React.useState(false);

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const { orders, dataSourceDate } = await fetchSheetData();
      await saveOrdersLocally(orders, dataSourceDate);
      await refreshData();
    } catch (error) {
      console.error("Sync error:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleSync}
            disabled={isSyncing}
            title="Sincronizar dados"
            className="relative group active:scale-95 transition-transform cursor-pointer"
          >
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Adidas_2022_logo.svg/960px-Adidas_2022_logo.svg.png" 
              alt="Adidas Logo" 
              className={cn("h-8 w-auto object-contain", isSyncing && "opacity-50 grayscale")}
              referrerPolicy="no-referrer"
            />
            {isSyncing && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="animate-spin text-black" size={16} />
              </div>
            )}
          </button>
          <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        </div>
        {children}
      </div>
    </div>
  );
};

export default PageHeader;
