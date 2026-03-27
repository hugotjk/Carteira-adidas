import React from "react";
import { RefreshCw, CheckCircle, AlertCircle, Database, Clock, Cloud, Loader2 } from "lucide-react";
import { fetchSheetData, saveOrdersLocally } from "../services/dataService";
import { cn } from "../lib/utils";
import { motion } from "framer-motion";
import { useData } from "../context/DataContext";

const SyncPage: React.FC = () => {
  const { refreshData } = useData();
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [lastSync, setLastSync] = React.useState<string | null>(
    localStorage.getItem("lastSyncDate")
  );
  const [status, setStatus] = React.useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = React.useState("");

  const handleSync = async () => {
    setIsSyncing(true);
    setStatus("idle");
    setMessage("Conectando à planilha...");

    try {
      const data = await fetchSheetData();
      setMessage(`Processando ${data.length} registros...`);
      
      await saveOrdersLocally(data);
      await refreshData();
      
      const now = new Date().toLocaleString("pt-BR");
      setLastSync(now);
      
      setStatus("success");
      setMessage(`Sincronização concluída! ${data.length} pedidos atualizados.`);
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
      <div className="bg-white border-b border-gray-100 px-6 py-8 shadow-sm">
        <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-black/10">
          <Database className="text-white" size={24} />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Banco de Dados</h2>
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
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">Fonte de Dados</p>
              <p className="text-sm font-bold">Google Sheets (CSV)</p>
            </div>
          </div>
        </div>

        {/* Sync Action Area */}
        <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm flex flex-col items-center text-center">
          <div className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-all duration-500",
            isSyncing ? "bg-black text-white scale-110" : "bg-gray-100 text-gray-400"
          )}>
            <RefreshCw className={cn(isSyncing && "animate-spin")} size={32} />
          </div>
          
          <h3 className="text-lg font-bold mb-2">
            {isSyncing ? "Sincronizando..." : "Atualizar Base"}
          </h3>
          <p className="text-sm text-gray-400 mb-8 max-w-[200px]">
            {isSyncing ? message : "Clique abaixo para buscar os dados mais recentes da planilha."}
          </p>

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className={cn(
              "w-full py-4 bg-black text-white rounded-2xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 shadow-xl shadow-black/10 flex items-center justify-center space-x-2",
              isSyncing && "bg-gray-900"
            )}
          >
            {isSyncing ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                <span>Aguarde...</span>
              </>
            ) : (
              <span>Sincronizar Agora</span>
            )}
          </button>

          {status !== "idle" && !isSyncing && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "mt-6 flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider",
                status === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              )}
            >
              {status === "success" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
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
