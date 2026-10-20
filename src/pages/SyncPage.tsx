import React, { useState } from "react";
import {
  RefreshCw,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Database,
  Clock,
  Cloud,
  FileText,
  Download,
  ImageOff,
} from "lucide-react";
import { cn } from "../lib/utils";
import { motion } from "framer-motion";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { formatSourceDate } from "../services/dataService";
import UserManagement from "../components/admin/UserManagement";

const SyncPage: React.FC = () => {
  const { allOrders, isSyncing, syncDatabase, lastSync, dataSourceDate, syncWarnings, refreshImages } = useData();
  const [isCheckingPhotos, setIsCheckingPhotos] = useState(false);
  const { userProfile } = useAuth();

  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSync = async () => {
    setStatus("idle");
    setMessage("Sincronizando...");

    try {
      const res = await syncDatabase(true);
      setStatus("success");
      setMessage(res.notModified
        ? `Tudo certo! A planilha não mudou (${res.count} itens).`
        : `Sucesso! ${res.count} itens.`);
    } catch (error: any) {
      console.error("Sync error:", error);
      setStatus("error");
      const msg = error?.message || "";
      setMessage(msg.includes("coluna") ? msg : "Falha na sincronização. Verifique sua conexão.");
    }
  };

  // PDF e Excel só são carregados quando o botão é clicado (deixa o app mais leve)
  const generateManualPDF = async () => {
    const { generateManualPDF } = await import("../services/userManual");
    generateManualPDF();
  };

  const exportMaterialsWithoutPhotos = async () => {
    // Confere as fotos no GitHub na hora, para o relatório já considerar as que acabaram de subir
    setIsCheckingPhotos(true);
    let imageMap: Record<string, string>;
    try {
      imageMap = await refreshImages();
    } finally {
      setIsCheckingPhotos(false);
    }

    const uniqueMaterials = new Map<string, string>();
    allOrders.forEach(order => {
      if (!imageMap[order.material]) {
        uniqueMaterials.set(order.material, order.materialDescription);
      }
    });

    const data = Array.from(uniqueMaterials.entries()).map(([material, materialDescription]) => ({
      "Material": material,
      "Material Description": materialDescription
    }));

    if (data.length === 0) {
      alert("Todos os materiais possuem fotos!");
      return;
    }

    const XLSX = await import("xlsx-js-style");
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sem Fotos");
    XLSX.writeFile(wb, `materiais_sem_fotos_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 overflow-x-hidden pb-12">
      <div className="bg-white border-b border-gray-100 px-6 py-8 shadow-sm">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center shadow-lg shadow-black/10">
            <Database className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-gray-900 tracking-tight leading-none">Banco de Dados</h1>
            <p className="text-xs text-gray-400 mt-1">Sincronize os dados com a planilha mestre da Adidas.</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4 min-h-[90px]">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">Última Atualização</p>
              <p className="text-sm font-bold">{lastSync || "Nunca sincronizado"}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4 min-h-[90px]">
            <div className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center shrink-0">
              <Cloud size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Fonte de Dados</p>
              <p className="text-sm font-bold truncate">Google Drive {dataSourceDate ? `(${formatSourceDate(dataSourceDate)})` : ""}</p>
            </div>
          </div>
        </div>

        {/* Sync Action Area */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm min-h-[90px] flex flex-col justify-center">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 shrink-0",
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
                "mt-3 flex items-center space-x-2 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider",
                status === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              )}
            >
              {status === "success" ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
              <span>{message}</span>
            </motion.div>
          )}
        </div>

        {/* Avisos da leitura da planilha (ex.: coluna não encontrada) */}
        {syncWarnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-100 text-amber-800 p-4 rounded-3xl flex items-start space-x-3">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <div className="space-y-1">
              {syncWarnings.map((w) => (
                <p key={w} className="text-xs font-bold leading-relaxed">{w}</p>
              ))}
            </div>
          </div>
        )}

        {/* Action Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* PDF Manual Generation Card */}
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm min-h-[90px] flex flex-col justify-center">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center shrink-0">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Manual de Instruções</h3>
                  <p className="text-[10px] text-gray-400">Gere um PDF com o passo a passo do app</p>
                </div>
              </div>
              
              <button
                onClick={generateManualPDF}
                className="px-4 py-2 bg-orange-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-orange-600/10 flex items-center space-x-2"
              >
                <Download size={12} />
                <span>Gerar PDF</span>
              </button>
            </div>
          </div>

          {/* Materials Without Photos Export Card */}
          {(userProfile?.role === "admin" || userProfile?.role === "master") && (
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm min-h-[90px] flex flex-col justify-center">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-red-50 text-red-600 rounded-full flex items-center justify-center shrink-0">
                    <ImageOff size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Itens Sem Foto</h3>
                    <p className="text-[10px] text-gray-400">Baixe a lista de materiais sem imagem</p>
                  </div>
                </div>
                
                <button
                  onClick={exportMaterialsWithoutPhotos}
                  disabled={isCheckingPhotos}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-red-600/10 flex items-center space-x-2"
                >
                  <Download size={12} />
                  <span>{isCheckingPhotos ? "Conferindo fotos..." : "Baixar XLSX"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
        {(userProfile?.role === "admin" || userProfile?.role === "master") && <UserManagement />}

        {/* Info Box */}
        <div className="bg-black p-6 rounded-[32px] text-white shadow-xl shadow-black/10">
          <div className="flex items-center space-x-2 mb-3">
            <RefreshCw size={16} className="text-gray-400" />
            <h4 className="text-xs font-bold uppercase tracking-widest">Auto-Sync</h4>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            O app confere a planilha toda vez que é aberto e só baixa os dados quando ela mudou. Os dados ficam salvos no aparelho para abrir rápido, mesmo com internet fraca.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SyncPage;
