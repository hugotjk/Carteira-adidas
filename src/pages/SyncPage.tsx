import React from "react";
import { RefreshCw, CheckCircle, AlertCircle, Database, Clock, Cloud, Loader2 } from "lucide-react";
import { fetchSheetData, saveOrdersLocally } from "../services/dataService";
import { cn } from "../lib/utils";
import { motion } from "framer-motion";
import { useData } from "../context/DataContext";
import PageHeader from "../components/PageHeader";

const SyncPage: React.FC = () => {
  const { refreshData } = useData();
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [lastSync, setLastSync] = React.useState<string | null>(
    localStorage.getItem("lastSyncDate")
  );
  const [dataSourceDate, setDataSourceDate] = React.useState<string | null>(
    localStorage.getItem("dataSourceDate")
  );
  const [status, setStatus] = React.useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = React.useState("");

  const handleSync = async () => {
    setIsSyncing(true);
    setStatus("idle");
    setMessage("Conectando...");

    try {
      const { orders, dataSourceDate: dateFromSheet } = await fetchSheetData();
      setMessage(`Processando...`);
      
      await saveOrdersLocally(orders, dateFromSheet);
      await refreshData();
      
      const now = new Date().toLocaleString("pt-BR");
      setLastSync(now);
      setDataSourceDate(dateFromSheet);
      
      setStatus("success");
      setMessage(`Sucesso! ${orders.length} itens.`);
    } catch (error) {
      console.error("Sync error:", error);
      setStatus("error");
      setMessage("Falha na sincronização. Verifique sua conexão.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Header */}
      <PageHeader title="Banco de Dados" />
      
      <div className="bg-white border-b border-gray-100 px-6 py-8 shadow-sm">
        <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-black/10">
          <Database className="text-white" size={24} />
        </div>
        <p className="text-gray-400 text-sm mt-1">Sincronize os dados com a planilha mestre da Adidas.</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Status Cards */}
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">Última Atualização</p>
              <p className="text-sm font-bold">{lastSync || "Nunca sincronizado"}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
            <div className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
              <Cloud size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Fonte de Dados</p>
              <p className="text-sm font-bold truncate">Google Sheets {dataSourceDate ? `(${dataSourceDate})` : ""}</p>
            </div>
          </div>
        </div>

        {/* Sync Action Area - Reduced Size */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500",
                isSyncing ? "bg-black text-white" : "bg-gray-100 text-gray-400"
              )}>
                <RefreshCw className={cn(isSyncing && "animate-spin")} size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold">
                  {isSyncing ? "Sincronizando..." : "Sincronizar Agora"}
                </h3>
                <p className="text-[10px] text-gray-400">
                  {isSyncing ? message : "Clique para atualizar os dados"}
                </p>
              </div>
            </div>
            
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className={cn(
                "px-4 py-2 bg-black text-white rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 shadow-lg shadow-black/10",
                isSyncing && "bg-gray-900"
              )}
            >
              {isSyncing ? "Aguarde" : "Atualizar"}
            </button>
          </div>

          {status !== "idle" && !isSyncing && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex items-center space-x-2 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider",
                status === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              )}
            >
              {status === "success" ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
              <span>{message}</span>
            </motion.div>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-black p-6 rounded-[32px] text-white shadow-xl shadow-black/10">
          <div className="flex items-center space-x-2 mb-3">
            <RefreshCw size={16} className="text-gray-400" />
            <h4 className="text-xs font-bold uppercase tracking-widest">Auto-Sync</h4>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            O sistema atualiza automaticamente a cada 12 horas. Seus dados são salvos localmente no dispositivo para acesso offline rápido.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SyncPage;
