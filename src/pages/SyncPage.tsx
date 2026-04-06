import React from "react";
import { RefreshCw, CheckCircle, AlertCircle, Database, Clock, Cloud, Loader2, FileText, Download } from "lucide-react";
import { fetchSheetData, saveOrdersLocally } from "../services/dataService";
import { cn } from "../lib/utils";
import { motion } from "framer-motion";
import { useData } from "../context/DataContext";
import PageHeader from "../components/PageHeader";
import { jsPDF } from "jspdf";

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

  const generateManualPDF = () => {
    const doc = new jsPDF();
    let y = 20;

    const checkPage = (needed: number) => {
      if (y + needed > 280) {
        doc.addPage();
        y = 20;
      }
    };

    const addTitle = (text: string) => {
      checkPage(15);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(text, 20, y);
      y += 12;
    };

    const addSubtitle = (text: string) => {
      checkPage(10);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(60, 60, 60);
      doc.text(text, 20, y);
      y += 8;
    };

    const addText = (text: string, isBullet = false) => {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      const splitText = doc.splitTextToSize(isBullet ? `• ${text}` : text, 170);
      checkPage(splitText.length * 6);
      doc.text(splitText, isBullet ? 25 : 20, y);
      y += (splitText.length * 6);
    };

    const addSpace = (amount = 5) => {
      y += amount;
    };

    // --- COVER ---
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, 210, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text("MANUAL DO USUÁRIO", 20, 25);
    doc.setFontSize(12);
    doc.text("Sistema de Gestão de Pedidos Adidas", 20, 33);
    
    y = 55;
    addText("Este documento fornece uma explicação detalhada de todas as funcionalidades, campos e interações disponíveis no aplicativo.");
    addSpace(10);

    // --- FILTROS ---
    addTitle("1. Sistema de Filtros Inteligentes");
    addText("O aplicativo utiliza um sistema de filtros inspirado no Excel, localizado no topo das telas de 'Análise' e 'LIB. | CANC.'.");
    addSpace();
    addText("Como utilizar:", true);
    addText("Clique em qualquer botão de filtro (Cliente, Coleção, Mês, etc.) para abrir o menu de opções.", true);
    addText("Use a barra de pesquisa dentro do filtro para encontrar itens específicos rapidamente.", true);
    addText("Você pode selecionar múltiplos itens em cada categoria. O app atualizará os dados instantaneamente.", true);
    addText("O botão 'Limpar Filtros' no cabeçalho remove todas as seleções de uma só vez.", true);
    addSpace(10);

    // --- ANALISE ---
    addTitle("2. Tela de Análise");
    addText("Esta tela é focada na exploração profunda da carteira de pedidos agrupada por material.");
    addSpace();
    addSubtitle("Campos Principais:");
    addText("Código do Material: Identificador único do produto (ex: IG1234).", true);
    addText("Descrição: Nome comercial do material.", true);
    addText("Qtde Total: Soma de todas as unidades confirmadas para este material.", true);
    addText("Valor Total: Soma financeira de todas as NFs deste material.", true);
    addSpace();
    addSubtitle("Interações (O que acontece ao clicar?):");
    addText("Clique no Material: Expande o card para mostrar a distribuição por STATUS (Pendente, Cancelado, Atendido).", true);
    addText("Clique no Status: Expande novamente para mostrar a distribuição por MÊS DE RECEBIMENTO.", true);
    addText("Foto do Produto: Clique na miniatura para visualizar a imagem do material (se disponível).", true);
    addSpace(10);

    // --- LIB CANC ---
    addTitle("3. Tela LIB. | CANC.");
    addText("Tela operacional para gestão individual de pedidos e exportação de dados.");
    addSpace();
    addSubtitle("Campos de Performance (Cores e Significados):");
    addText("Venda | Estq: Dados atuais de venda e estoque da loja específica.", true);
    addText("Venda G. | Estq G. (Laranja): Metas e médias definidas pelo gestor. Se os números estiverem em destaque, requerem atenção.", true);
    addSpace();
    addSubtitle("Gestão de Seleção:");
    addText("Seleção por Material: Clique no quadrado à esquerda do material para selecionar todos os pedidos vinculados a ele.", true);
    addText("Seleção Individual: Expanda o material e selecione apenas as lojas/pedidos desejados.", true);
    addText("Resumo Flutuante: Uma barra inferior aparece ao selecionar itens, mostrando o Valor e Qtde Total da sua seleção atual.", true);
    addText("Exportar XLSX: Gera um arquivo Excel formatado especificamente para importação no banco de dados, removendo separadores de milhar e garantindo tipos numéricos puros.", true);
    addSpace(10);

    // --- BANCO ---
    addTitle("4. Banco de Dados (Sincronização)");
    addText("Gerenciamento da integridade e atualização dos dados.");
    addSpace();
    addText("Última Atualização: Indica o momento exato em que o app baixou dados da nuvem.", true);
    addText("Sincronizar Agora: Use este botão se houver alterações recentes na planilha mestre que ainda não aparecem no app.", true);
    addText("Modo Offline: O app salva os dados no seu dispositivo. Você pode consultar a carteira mesmo sem internet.", true);

    doc.save("manual_detalhado_adidas_app.pdf");
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
              <p className="text-sm font-bold truncate">Google Sheets {dataSourceDate ? `(${dataSourceDate})` : ""}</p>
            </div>
          </div>
        </div>

        {/* Sync Action Area - Standardized Height */}
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
