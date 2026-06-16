import React, { useState, useEffect, useMemo } from "react";
import { 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Database, 
  Clock, 
  Cloud, 
  Loader2, 
  FileText, 
  Download, 
  ImageOff,
  UserPlus,
  Users,
  Trash2,
  Shield,
  Search,
  Pencil,
  CheckSquare as CheckedIcon,
  Square as UncheckedIcon
} from "lucide-react";
import { fetchSheetData, saveOrdersLocally } from "../services/dataService";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useData } from "../context/DataContext";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import { useAuth } from "../context/AuthContext";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import firebaseConfig from "@/firebase-applet-config.json";
import { UserProfile } from "../types";

const SyncPage: React.FC = () => {
  const { refreshData, allOrders, rawOrders, imageMap, isSyncing, syncDatabase } = useData();
  const { userProfile } = useAuth();
  
  const [lastSync, setLastSync] = useState<string | null>(
    localStorage.getItem("lastSyncDate")
  );
  const [dataSourceDate, setDataSourceDate] = useState<string | null>(
    localStorage.getItem("dataSourceDate")
  );
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const [isLoginsExpanded, setIsLoginsExpanded] = useState(false);
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});

  const toggleUserExpand = (uid: string) => {
    setExpandedUsers(prev => {
      const isCurrentlyExpanded = prev[uid];
      if (isCurrentlyExpanded) {
        return {};
      } else {
        return { [uid]: true };
      }
    });
    setEditingUserId(null);
  };

  // User Management State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // New User Form State
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("123456");
  const [newRole, setNewRole] = useState<"master" | "admin" | "user">("user");
  const [newAccessType, setNewAccessType] = useState<"GESTOR" | "LOJA" | "GRUPO" | "CUSTOMER" | "ALL">("ALL");
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [filterOptionSearch, setFilterOptionSearch] = useState("");
  const [userManageError, setUserManageError] = useState<string | null>(null);
  const [userManageSuccess, setUserManageSuccess] = useState<string | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // User Edit State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"master" | "admin" | "user">("user");
  const [editAccessType, setEditAccessType] = useState<"GESTOR" | "LOJA" | "GRUPO" | "CUSTOMER" | "ALL">("ALL");
  const [editSelectedValues, setEditSelectedValues] = useState<string[]>([]);
  const [editFilterOptionSearch, setEditFilterOptionSearch] = useState("");
  const [isSavingUser, setIsSavingUser] = useState(false);

  const startEditing = (u: UserProfile) => {
    setEditingUserId(u.uid);
    setEditName(u.name || "");
    setEditRole(u.role);
    setEditAccessType(u.accessType);
    setEditSelectedValues([...(u.accessValues || [])]);
    setEditFilterOptionSearch("");
  };

  const cancelEditing = () => {
    setEditingUserId(null);
  };

  // Fetch users from Firestore on mount if admin or master
  const fetchUsers = async () => {
    if (userProfile?.role !== "admin" && userProfile?.role !== "master") return;
    setLoadingUsers(true);
    try {
      let querySnapshot;
      try {
        querySnapshot = await getDocs(collection(db, "users"));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, "users");
      }
      const list: UserProfile[] = [];
      if (querySnapshot) {
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            uid: docSnap.id,
            email: data.email || "",
            name: data.name || "",
            role: data.role || "user",
            accessType: data.accessType || "ALL",
            accessValues: data.accessValues || [],
            rawPassword: data.rawPassword || "",
            loginCount: data.loginCount || 0,
            needsPasswordReset: data.needsPasswordReset ?? false
          });
        });
      }

      // Sort by category (Master, Admin, User/Padrao) first, then alphabetically by Name
      const rolePriority: Record<string, number> = {
        master: 1,
        admin: 2,
        user: 3,
      };
      
      list.sort((a, b) => {
        const pA = rolePriority[a.role] || 3;
        const pB = rolePriority[b.role] || 3;
        if (pA !== pB) {
          return pA - pB;
        }
        const nameA = (a.name || a.email || "").toLowerCase().trim();
        const nameB = (b.name || b.email || "").toLowerCase().trim();
        return nameA.localeCompare(nameB);
      });

      setUsers(list);
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [userProfile]);

  // Extract unique data categories dynamically from the loaded database (rawOrders)
  const uniqueManagers = useMemo(() => {
    return Array.from(new Set(rawOrders.map(o => o.gestor).filter(Boolean))).sort();
  }, [rawOrders]);

  const uniqueStores = useMemo(() => {
    return Array.from(new Set(rawOrders.map(o => o.loja).filter(Boolean))).sort();
  }, [rawOrders]);

  const uniqueGroups = useMemo(() => {
    return Array.from(new Set(rawOrders.map(o => o.grupo).filter(Boolean))).sort();
  }, [rawOrders]);

  const uniqueCustomers = useMemo(() => {
    return Array.from(new Set(rawOrders.map(o => o.customer).filter(Boolean))).sort();
  }, [rawOrders]);

  // Options checklist depending on selected newAccessType
  const availableOptionsForSelectedType = useMemo(() => {
    let options: string[] = [];
    if (newAccessType === "GESTOR") options = uniqueManagers;
    else if (newAccessType === "LOJA") options = uniqueStores;
    else if (newAccessType === "GRUPO") options = uniqueGroups;
    else if (newAccessType === "CUSTOMER") options = uniqueCustomers;

    if (!filterOptionSearch) return options;
    return options.filter(opt => opt.toLowerCase().includes(filterOptionSearch.toLowerCase()));
  }, [newAccessType, uniqueManagers, uniqueStores, uniqueGroups, uniqueCustomers, filterOptionSearch]);

  const handleToggleValueSelection = (val: string) => {
    if (selectedValues.includes(val)) {
      setSelectedValues(selectedValues.filter(v => v !== val));
    } else {
      setSelectedValues([...selectedValues, val]);
    }
  };

  const handleSelectAllOptions = () => {
    setSelectedValues(availableOptionsForSelectedType);
  };

  const handleClearAllOptions = () => {
    setSelectedValues([]);
  };

  // Options checklist depending on selected editAccessType
  const availableOptionsForEditSelectedType = useMemo(() => {
    let options: string[] = [];
    if (editAccessType === "GESTOR") options = uniqueManagers;
    else if (editAccessType === "LOJA") options = uniqueStores;
    else if (editAccessType === "GRUPO") options = uniqueGroups;
    else if (editAccessType === "CUSTOMER") options = uniqueCustomers;

    if (!editFilterOptionSearch) return options;
    return options.filter(opt => opt.toLowerCase().includes(editFilterOptionSearch.toLowerCase()));
  }, [editAccessType, uniqueManagers, uniqueStores, uniqueGroups, uniqueCustomers, editFilterOptionSearch]);

  const handleToggleEditValueSelection = (val: string) => {
    if (editSelectedValues.includes(val)) {
      setEditSelectedValues(editSelectedValues.filter(v => v !== val));
    } else {
      setEditSelectedValues([...editSelectedValues, val]);
    }
  };

  const handleSelectAllEditOptions = () => {
    setEditSelectedValues(availableOptionsForEditSelectedType);
  };

  const handleClearAllEditOptions = () => {
    setEditSelectedValues([]);
  };

  const handleSaveUser = async (uid: string) => {
    setUserManageError(null);
    setUserManageSuccess(null);

    const targetUser = users.find(u => u.uid === uid);
    if (targetUser && (targetUser.role === "master" || targetUser.email === "hugotjk2@gmail.com")) {
      if (userProfile?.uid !== uid) {
        setUserManageError("O usuário MASTER só pode ser alterado por ele mesmo.");
        return;
      }
    }

    if (editRole === "master" && userProfile?.role !== "master") {
      setUserManageError("Apenas o usuário MASTER pode atribuir ou atualizar novos cargos MASTER.");
      return;
    }

    if (!editName.trim()) {
      setUserManageError("Por favor, defina um nome para o usuário.");
      return;
    }

    if (editAccessType !== "ALL" && editSelectedValues.length === 0) {
      setUserManageError("Defina ao menos 1 valor de acesso permitido para a limitação escolhida.");
      return;
    }

    setIsSavingUser(true);
    try {
      const userProfileRef = doc(db, "users", uid);
      const updatedData = {
        name: editName.trim(),
        role: editRole,
        accessType: editAccessType,
        accessValues: editAccessType === "ALL" ? [] : editSelectedValues,
      };

      try {
        await setDoc(userProfileRef, updatedData, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
        return;
      }

      setUserManageSuccess("Acesso do login atualizado com sucesso!");
      setEditingUserId(null);
      fetchUsers();
    } catch (error) {
      console.error("Error saving user permissions:", error);
      setUserManageError("Erro ao salvar as configurações de acesso no Firestore.");
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserManageError(null);
    setUserManageSuccess(null);

    if (newRole === "master" && userProfile?.role !== "master") {
      setUserManageError("Apenas o usuário MASTER pode atribuir ou cadastrar novos perfis MASTER.");
      return;
    }

    if (!newName.trim()) {
      setUserManageError("Por favor preencha o nome do usuário.");
      return;
    }

    if (!newEmail || !newPassword) {
      setUserManageError("Por favor preencha o e-mail e a senha.");
      return;
    }

    if (newPassword.length < 6) {
      setUserManageError("A senha deve possuir no mínimo 6 caracteres.");
      return;
    }

    if (newAccessType !== "ALL" && selectedValues.length === 0) {
      setUserManageError("Defina ao menos 1 valor de acesso permitido para a limitação escolhida.");
      return;
    }

    setIsCreatingUser(true);

    // Create the Auth user account using a secondary client-side APP instance
    // to strictly prevent logging the current administrator out!
    const tempAppName = `TempApp-${Date.now()}`;
    const tempApp = initializeApp(firebaseConfig, tempAppName);
    const tempAuth = getAuth(tempApp);

    try {
      const userCredential = await createUserWithEmailAndPassword(tempAuth, newEmail.trim(), newPassword);
      const newUid = userCredential.user.uid;

      // Create profile document in main Firestore
      const userProfileRef = doc(db, "users", newUid);
      try {
        await setDoc(userProfileRef, {
          email: newEmail.trim(),
          name: newName.trim(),
          role: newRole,
          accessType: newAccessType,
          accessValues: newAccessType === "ALL" ? [] : selectedValues,
          createdAt: new Date().toISOString(),
          rawPassword: newPassword,
          loginCount: 0,
          needsPasswordReset: true
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${newUid}`);
      }

      setUserManageSuccess(`Login "${newEmail}" cadastrado e configurado com sucesso!`);
      setNewName("");
      setNewEmail("");
      setNewPassword("123456");
      setNewRole("user");
      setNewAccessType("ALL");
      setSelectedValues([]);
      setShowAddForm(false);
      fetchUsers();
    } catch (error: any) {
      console.error(error);
      let errorMsg = "Ocorreu um erro ao registrar o login.";
      if (error?.code === "auth/email-already-in-use") {
        errorMsg = "Este endereço de e-mail já está em uso.";
      } else if (error?.code === "auth/invalid-email") {
        errorMsg = "Endereço de e-mail inválido.";
      }
      setUserManageError(errorMsg);
    } finally {
      setIsCreatingUser(false);
      await deleteApp(tempApp);
    }
  };

  const handleDeleteUser = async (uidToDelete: string, emailToDelete: string) => {
    // Zero-trust check: block deleting a MASTER account
    const targetUser = users.find(u => u.uid === uidToDelete);
    const isMaster = targetUser?.role === "master" || emailToDelete === "hugotjk2@gmail.com";
    if (isMaster && userProfile?.uid !== uidToDelete) {
      setUserManageError("O usuário MASTER não pode ser excluído por nenhum outro administrador.");
      return;
    }

    if (confirm(`Tem certeza que deseja apagar o acesso de "${emailToDelete}"?`)) {
      try {
        try {
          await deleteDoc(doc(db, "users", uidToDelete));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `users/${uidToDelete}`);
        }
        setUserManageSuccess("Acesso apagado com sucesso do banco de dados!");
        fetchUsers();
      } catch (error) {
        console.error("Error deleting user:", error);
        setUserManageError("Erro ao apagar o perfil de acesso no Firestore.");
      }
    }
  };

  const handleSync = async () => {
    setStatus("idle");
    setMessage("Sincronizando...");

    try {
      const res = await syncDatabase();
      setLastSync(res.lastSync);
      setDataSourceDate(res.dataSourceDate);
      setStatus("success");
      setMessage(`Sucesso! ${res.count} itens.`);
    } catch (error) {
      console.error("Sync error:", error);
      setStatus("error");
      setMessage("Falha na sincronização. Verifique sua conexão.");
    }
  };

  const generateManualPDF = () => {
    const docPdf = new jsPDF();
    let y = 20;

    const checkPage = (needed: number) => {
      if (y + needed > 280) {
        docPdf.addPage();
        y = 20;
      }
    };

    const addTitle = (text: string) => {
      checkPage(15);
      docPdf.setFontSize(18);
      docPdf.setFont("helvetica", "bold");
      docPdf.setTextColor(0, 0, 0);
      docPdf.text(text, 20, y);
      y += 12;
    };

    const addSubtitle = (text: string) => {
      checkPage(10);
      docPdf.setFontSize(14);
      docPdf.setFont("helvetica", "bold");
      docPdf.setTextColor(60, 60, 60);
      docPdf.text(text, 20, y);
      y += 8;
    };

    const addText = (text: string, isBullet = false) => {
      docPdf.setFontSize(10);
      docPdf.setFont("helvetica", "normal");
      docPdf.setTextColor(80, 80, 80);
      const splitText = docPdf.splitTextToSize(isBullet ? `• ${text}` : text, 170);
      checkPage(splitText.length * 6);
      docPdf.text(splitText, isBullet ? 25 : 20, y);
      y += (splitText.length * 6);
    };

    const addSpace = (amount = 5) => {
      y += amount;
    };

    // --- COVER ---
    docPdf.setFillColor(0, 0, 0);
    docPdf.rect(0, 0, 210, 40, "F");
    docPdf.setTextColor(255, 255, 255);
    docPdf.setFontSize(24);
    docPdf.text("MANUAL DO USUÁRIO", 20, 25);
    docPdf.setFontSize(12);
    docPdf.text("Sistema de Gestão de Pedidos Adidas", 20, 33);
    
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

    docPdf.save("manual_detalhado_adidas_app.pdf");
  };

  const exportMaterialsWithoutPhotos = () => {
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
              <p className="text-sm font-bold truncate">Google Sheets {dataSourceDate ? `(${dataSourceDate})` : ""}</p>
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
                  className="px-4 py-2 bg-red-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-red-600/10 flex items-center space-x-2"
                >
                  <Download size={12} />
                  <span>Baixar XLSX</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* =============================================================== */}
        {/* ADMIN SYSTEM ACCESS CONTROL - (PRECISE LEVEL CRAFTSMANSHIP)    */}
        {/* =============================================================== */}
        {(userProfile?.role === "admin" || userProfile?.role === "master") && (
          <div className="space-y-4">
            {/* Main Toggle Card modeled exactly like the ones above */}
            <div 
              onClick={() => {
                setIsLoginsExpanded(!isLoginsExpanded);
                if (!isLoginsExpanded) {
                  fetchUsers();
                }
              }}
              className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm min-h-[90px] flex flex-col justify-center cursor-pointer hover:border-gray-200 transition-all select-none"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center shrink-0 shadow-lg">
                    <Shield size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Controle de Logins & Acessos</h3>
                    <p className="text-[10px] text-gray-400 font-medium">Defina limitações geográficas e operacionais para cada usuário</p>
                  </div>
                </div>
                
                <button
                  type="button"
                  className={cn(
                    "px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all shadow-md flex items-center space-x-1 shrink-0",
                    isLoginsExpanded ? "bg-gray-100 text-gray-700 hover:bg-gray-200 shadow-none border border-gray-200/50" : "bg-black text-white hover:bg-gray-900"
                  )}
                >
                  <span>{isLoginsExpanded ? "Recolher" : "Novo Cadastro / Logins"}</span>
                </button>
              </div>
            </div>

            {/* Collapsible logins list & administration form */}
            <AnimatePresence>
              {isLoginsExpanded && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm space-y-6 overflow-hidden"
                >
                  <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Painel Administrativo</h4>
                    <button
                      onClick={() => {
                        setShowAddForm(!showAddForm);
                        setUserManageError(null);
                        setUserManageSuccess(null);
                      }}
                      className={cn(
                        "px-3.5 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all active:scale-95 flex items-center space-x-1.5 shadow-sm",
                        showAddForm ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-black text-white hover:bg-gray-900"
                      )}
                    >
                      <UserPlus size={12} />
                      <span>{showAddForm ? "Cancelar" : "Novo Cadastro"}</span>
                    </button>
                  </div>

                  {/* Error & Success Messages inside Admin section */}
                  {userManageError && (
                    <div className="flex items-center space-x-2 bg-red-50 text-red-700 p-4 rounded-2xl text-xs font-bold border border-red-100">
                      <AlertCircle size={16} className="shrink-0" />
                      <span>{userManageError}</span>
                    </div>
                  )}
                  {userManageSuccess && (
                    <div className="flex items-center space-x-2 bg-green-50 text-green-700 p-4 rounded-2xl text-xs font-bold border border-green-100">
                      <CheckCircle size={16} className="shrink-0" />
                      <span>{userManageSuccess}</span>
                    </div>
                  )}

                  {/* Add User Form Wrapper */}
                  <AnimatePresence>
                    {showAddForm && (
                      <motion.form
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        onSubmit={handleCreateUser}
                        className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100 space-y-4 overflow-hidden"
                      >
                        <h5 className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center space-x-1.5">
                          <UserPlus size={14} />
                          <span>Dados do Novo Login</span>
                        </h5>

                        {users.length > 0 && (
                          <div className="bg-white p-4 rounded-xl border border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
                            <div className="space-y-0.5">
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Copiar de outro login (Opcional)</label>
                              <span className="text-[9px] text-gray-400 font-medium block leading-tight">Escolha um login cadastrado para copiar cargo, limitações e valores.</span>
                            </div>
                            <select
                              onChange={(e) => {
                                const val = e.target.value;
                                if (!val) return;
                                const donor = users.find(u => u.uid === val);
                                if (donor) {
                                  setNewRole(donor.role);
                                  setNewAccessType(donor.accessType);
                                  setSelectedValues([...(donor.accessValues || [])]);
                                }
                                e.target.value = ""; // Reset selection behavior
                              }}
                              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-black font-semibold text-gray-700 w-full sm:w-auto min-w-[200px]"
                              defaultValue=""
                            >
                              <option value="">-- Selecione para copiar --</option>
                              {users.map((u) => (
                                <option key={u.uid} value={u.uid}>
                                  {u.email} ({u.role === "master" ? "Master" : u.role === "admin" ? "Admin" : u.accessType})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block font-bold">Nome Completo</label>
                            <input
                              type="text"
                              required
                              placeholder="Ex: João da Silva"
                              value={newName}
                              onChange={(e) => setNewName(e.target.value)}
                              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all font-medium text-gray-800"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block font-bold">E-mail de Login</label>
                            <input
                              type="email"
                              required
                              placeholder="exemplo@empresa.com"
                              value={newEmail}
                              onChange={(e) => setNewEmail(e.target.value)}
                              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all font-medium text-gray-800"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block font-bold">Senha de Acesso (Mín. 6 dígitos)</label>
                            <input
                              type="text"
                              required
                              placeholder="123456"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all font-mono font-bold text-gray-800"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block font-bold">Cargo / Nível de Perfil</label>
                            <select
                              value={newRole}
                              onChange={(e) => setNewRole(e.target.value as any)}
                              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all font-medium"
                            >
                              <option value="user">Usuário Padrão</option>
                              <option value="admin">Administrador Geral</option>
                              {userProfile?.role === "master" && (
                                <option value="master">Master</option>
                              )}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block font-bold">Limitação de Acesso (Coluna)</label>
                            <select
                              value={newAccessType}
                              onChange={(e) => {
                                setNewAccessType(e.target.value as any);
                                setSelectedValues([]);
                                setFilterOptionSearch("");
                              }}
                              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all font-medium"
                            >
                              <option value="ALL">ALL (Ver banco inteiro)</option>
                              <option value="GESTOR">GESTOR (Coluna AT da base)</option>
                              <option value="LOJA">LOJA (Coluna AU da base)</option>
                              <option value="GRUPO">GRUPO (Coluna L da base)</option>
                              <option value="CUSTOMER">CUSTOMER (Coluna G da base)</option>
                            </select>
                          </div>
                        </div>

                        {/* Accessible Values Checklist - Active conditionally */}
                        {newAccessType !== "ALL" && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="border border-gray-200 rounded-2xl bg-white p-4 space-y-3"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 pb-3">
                              <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Filtrar Filtros Disponíveis</p>
                                <p className="text-[9px] text-gray-400">Marque apenas os itens que este usuário possui permissão de visualizar</p>
                              </div>
                              <div className="flex space-x-2 pb-1">
                                <button
                                  type="button"
                                  onClick={handleSelectAllOptions}
                                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase transition-all"
                                >
                                  Marcar Todos
                                </button>
                                <button
                                  type="button"
                                  onClick={handleClearAllOptions}
                                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase transition-all"
                                >
                                  Limpar Seleção
                                </button>
                              </div>
                            </div>

                            {/* Search in checklists */}
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                              <input
                                type="text"
                                placeholder={`Buscar por ${newAccessType.toLowerCase()}...`}
                                value={filterOptionSearch}
                                onChange={(e) => setFilterOptionSearch(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-9 pr-4 py-2 text-xs outline-none focus:bg-white focus:ring-1 focus:ring-black/10 transition-all"
                              />
                            </div>

                            {/* Checkbox box selection list */}
                            <div className="max-h-48 overflow-y-auto border border-gray-50 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 bg-gray-50/20">
                              {availableOptionsForSelectedType.length === 0 ? (
                                <div className="col-span-full py-4 text-center text-[10px] font-bold text-gray-400 uppercase italic">
                                  Nenhum item localizado
                                </div>
                              ) : (
                                availableOptionsForSelectedType.map((opt) => {
                                  const isChecked = selectedValues.includes(opt);
                                  return (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => handleToggleValueSelection(opt)}
                                      className={cn(
                                        "flex items-center space-x-2 p-2 rounded-xl border text-left transition-all text-xs outline-none",
                                        isChecked 
                                          ? "bg-black text-white border-black" 
                                          : "bg-white text-gray-700 border-gray-100 hover:bg-gray-50 hover:text-black"
                                      )}
                                    >
                                      {isChecked ? <CheckedIcon size={14} className="shrink-0" /> : <UncheckedIcon size={14} className="shrink-0 text-gray-400" />}
                                      <span className="font-medium truncate">{opt}</span>
                                    </button>
                                  );
                                })
                              )}
                            </div>

                            {selectedValues.length > 0 && (
                              <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest pt-1 flex items-center justify-between">
                                <span>Registros selecionados:</span>
                                <span className="bg-black/5 px-2 py-0.5 rounded-full text-black font-black">{selectedValues.length}</span>
                              </div>
                            )}
                          </motion.div>
                        )}

                        <button
                          type="submit"
                          disabled={isCreatingUser}
                          className="w-full py-3 bg-black hover:bg-gray-900 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all flex items-center justify-center space-x-2 shadow-lg shadow-black/15 disabled:opacity-50"
                        >
                          {isCreatingUser ? (
                            <>
                              <Loader2 className="animate-spin" size={13} />
                              <span>Sincronizando com Auth Cloud...</span>
                            </>
                          ) : (
                            <>
                              <UserPlus size={14} />
                              <span>Confirmar e Registrar Usuário</span>
                            </>
                          )}
                        </button>
                      </motion.form>
                    )}
                  </AnimatePresence>

                  {/* Existing Logins List */}
                  <div className="space-y-3">
                    <h5 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center space-x-2">
                      <Users size={14} />
                      <span>Logins Ativos Cadastrados ({users.length})</span>
                    </h5>

                    {loadingUsers ? (
                      <div className="flex flex-col items-center justify-center py-8 space-y-2">
                        <Loader2 className="animate-spin text-gray-400" size={24} />
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Carregando acessos...</p>
                      </div>
                    ) : users.length === 0 ? (
                      <div className="text-center py-8 border border-dashed border-gray-200 rounded-2xl">
                        <p className="text-xs font-bold text-gray-400 uppercase italic">Nenhum login cadastrado no banco</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {users.map((u) => {
                          const isUserExpanded = expandedUsers[u.uid] || false;
                          const isEditingThisUser = editingUserId === u.uid;
                          const isThisMaster = u.role === "master" || u.email === "hugotjk2@gmail.com";
                          return (
                            <div 
                              key={u.uid}
                              onClick={() => {
                                if (!isEditingThisUser) {
                                  toggleUserExpand(u.uid);
                                }
                              }}
                              className={cn(
                                "border border-gray-100 rounded-2xl p-4 bg-gray-50/50 flex flex-col justify-between hover:border-gray-300 hover:bg-white transition-all cursor-pointer select-none",
                                (isUserExpanded || isEditingThisUser) && "border-gray-200 bg-white shadow-sm"
                              )}
                            >
                              <div className="space-y-1.5 w-full">
                                {isEditingThisUser ? (
                                  /* Inline Edit Mode */
                                  <div className="space-y-4 w-full" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                      <div>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Editando Acesso</p>
                                        <p className="text-xs font-black text-gray-900 truncate max-w-[200px] sm:max-w-xs">{u.email}</p>
                                      </div>
                                      <button
                                        onClick={cancelEditing}
                                        className="text-[10px] text-gray-500 hover:text-black font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-xl bg-gray-100 hover:bg-gray-200 transition-all"
                                      >
                                        Cancelar
                                      </button>
                                    </div>

                                    {/* Edit controls */}
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block font-bold">Nome do Usuário</label>
                                      <input
                                        type="text"
                                        placeholder="Ex: João da Silva"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-black transition-all font-semibold text-gray-700"
                                      />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block font-bold">Cargo / Perfil</label>
                                        <select
                                          value={editRole}
                                          onChange={(e) => setEditRole(e.target.value as any)}
                                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-black transition-all font-semibold text-gray-700"
                                        >
                                          <option value="user">Usuário Padrão</option>
                                          <option value="admin">Administrador Geral</option>
                                          {userProfile?.role === "master" && (
                                            <option value="master">Master</option>
                                          )}
                                        </select>
                                      </div>

                                      <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block font-bold">Limitação de Acesso</label>
                                        <select
                                          value={editAccessType}
                                          onChange={(e) => {
                                            setEditAccessType(e.target.value as any);
                                            setEditSelectedValues([]);
                                            setEditFilterOptionSearch("");
                                          }}
                                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-black transition-all font-semibold text-gray-700"
                                        >
                                          <option value="ALL">ALL (Ver banco inteiro)</option>
                                          <option value="GESTOR">GESTOR (Coluna AT)</option>
                                          <option value="LOJA">LOJA (Coluna AU)</option>
                                          <option value="GRUPO">GRUPO (Coluna L)</option>
                                          <option value="CUSTOMER">CUSTOMER (Coluna G)</option>
                                        </select>
                                      </div>
                                    </div>

                                    {/* Options Selection Box if not ALL */}
                                    {editAccessType !== "ALL" && (
                                      <div className="border border-gray-200 rounded-xl bg-white p-3 space-y-2">
                                        <div className="flex items-center justify-between gap-2 border-b border-gray-50 pb-2">
                                          <div>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Limitações Disponíveis</p>
                                          </div>
                                          <div className="flex space-x-1.5">
                                            <button
                                              type="button"
                                              onClick={handleSelectAllEditOptions}
                                              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase transition-all"
                                            >
                                              Todos
                                            </button>
                                            <button
                                              type="button"
                                              onClick={handleClearAllEditOptions}
                                              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase transition-all"
                                            >
                                              Limpar
                                            </button>
                                          </div>
                                        </div>

                                        {/* Search */}
                                        <div className="relative">
                                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={11} />
                                          <input
                                            type="text"
                                            placeholder={`Buscar por ${editAccessType.toLowerCase()}...`}
                                            value={editFilterOptionSearch}
                                            onChange={(e) => setEditFilterOptionSearch(e.target.value)}
                                            className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-8 pr-3 py-1.5 text-xs outline-none focus:bg-white focus:ring-1 focus:ring-black/10 transition-all font-medium"
                                          />
                                        </div>

                                        {/* Grid selection */}
                                        <div className="max-h-36 overflow-y-auto border border-gray-50 rounded-xl p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-gray-50/20">
                                          {availableOptionsForEditSelectedType.length === 0 ? (
                                            <div className="col-span-full py-2 text-center text-[9px] font-bold text-gray-400 uppercase italic">
                                              Nenhum item localizado
                                            </div>
                                          ) : (
                                            availableOptionsForEditSelectedType.map((opt) => {
                                              const isChecked = editSelectedValues.includes(opt);
                                              return (
                                                <button
                                                  key={opt}
                                                  type="button"
                                                  onClick={() => handleToggleEditValueSelection(opt)}
                                                  className={cn(
                                                    "flex items-center space-x-1.5 p-1.5 rounded-lg border text-left transition-all text-[11px] outline-none",
                                                    isChecked 
                                                      ? "bg-black text-white border-black" 
                                                      : "bg-white text-gray-700 border-gray-100 hover:bg-gray-50"
                                                  )}
                                                >
                                                  {isChecked ? <CheckedIcon size={12} className="shrink-0" /> : <UncheckedIcon size={12} className="shrink-0 text-gray-400" />}
                                                  <span className="font-semibold truncate">{opt}</span>
                                                </button>
                                              );
                                            })
                                          )}
                                        </div>

                                        {editSelectedValues.length > 0 && (
                                          <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest pt-0.5 flex items-center justify-between font-mono">
                                            <span>Valores selecionados:</span>
                                            <span className="bg-black/5 px-2 py-0.2 rounded-full text-black font-black">{editSelectedValues.length}</span>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    <button
                                      type="button"
                                      disabled={isSavingUser}
                                      onClick={() => handleSaveUser(u.uid)}
                                      className="w-full py-2.5 bg-black hover:bg-gray-900 text-white font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50"
                                    >
                                      {isSavingUser ? (
                                        <>
                                          <Loader2 className="animate-spin" size={11} />
                                          <span>Salvando...</span>
                                        </>
                                      ) : (
                                        <>
                                          <span>Salvar Alterações de Acesso</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                ) : (
                                  /* Display Mode Card */
                                  <>
                                    <div className="flex items-start justify-between">
                                      <div className="min-w-0 flex-1">
                                        <p className="text-xs font-black text-gray-900 truncate">{u.name || "Sem Nome"}</p>
                                        <p className="text-[10px] text-gray-500 font-semibold truncate">{u.email}</p>
                                        <div className="flex flex-wrap gap-1.5 mt-1 items-center">
                                          <span className={cn(
                                            "inline-block rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider",
                                            u.role === "master" ? "bg-amber-100 text-amber-700 border border-amber-200" : u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                                          )}>
                                            {u.role === "master" ? "Master" : u.role === "admin" ? "Admin" : "Usuário"}
                                          </span>
                                          <span className="text-[9px] text-gray-400 font-bold uppercase">
                                            Limitação: <span className="font-extrabold text-black">{u.accessType}</span>
                                          </span>
                                        </div>
                                      </div>

                                      {(!isThisMaster || userProfile?.uid === u.uid) && (
                                        <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              // Limit expanding only to the styled edit card, closing other panels
                                              setExpandedUsers({ [u.uid]: true });
                                              startEditing(u);
                                            }}
                                            className="text-gray-400 hover:text-black p-1 rounded-lg hover:bg-gray-100 active:scale-95 transition-all shrink-0"
                                            title="Editar permissões"
                                          >
                                            <Pencil size={13} />
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteUser(u.uid, u.email);
                                            }}
                                            className="text-gray-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 active:scale-95 transition-all shrink-0"
                                            title="Apagar login"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        </div>
                                      )}
                                    </div>

                                    {/* Expandable contents for individual User Login Card */}
                                    <AnimatePresence>
                                      {isUserExpanded && (
                                        <motion.div
                                          initial={{ opacity: 0, height: 0 }}
                                          animate={{ opacity: 1, height: "auto" }}
                                          exit={{ opacity: 0, height: 0 }}
                                          className="pt-2 border-t border-gray-100 mt-2 text-[10px] text-gray-500 space-y-2 overflow-hidden"
                                        >
                                          {u.accessType !== "ALL" && (
                                            <p className="line-clamp-2">
                                              <span className="font-bold text-gray-400 uppercase">Liberado para:</span>{" "}
                                              <span className="font-semibold text-gray-800 uppercase italic">{u.accessValues.join(", ") || "(Nenhum valor)"}</span>
                                            </p>
                                          )}
                                          
                                          <div className="mt-2 pt-2 border-t border-gray-100/60 grid grid-cols-2 gap-2 text-[9px]">
                                            <div>
                                              <span className="font-bold text-gray-400 uppercase block">Senha Atual</span>
                                              <span 
                                                onClick={(e) => e.stopPropagation()} 
                                                className="font-mono text-gray-800 font-bold bg-gray-100 px-1.5 py-0.5 rounded inline-block mt-0.5 select-all"
                                              >
                                                {u.rawPassword || "N/A"}
                                              </span>
                                            </div>
                                            <div>
                                              <span className="font-bold text-gray-400 uppercase block">Acessos registrados</span>
                                              <span className="font-extrabold text-gray-800 mt-0.5 inline-block">{u.loginCount || 0} acessos</span>
                                            </div>
                                            {u.needsPasswordReset && (
                                              <div className="col-span-2 mt-1">
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-50 text-amber-700 border border-amber-100 uppercase tracking-wide animate-pulse">
                                                  Requer alteração de senha
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>

                                    {!isUserExpanded && (
                                      <div className="text-[8px] text-gray-300 font-bold uppercase tracking-wider text-right pt-1 flex justify-end">
                                        Clique para ver senha e acessos
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

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
