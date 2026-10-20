import React, { useState, useEffect, useMemo } from "react";
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  UserPlus,
  UserX,
  UserCheck,
  Users,
  Shield,
  Pencil,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import firebaseConfig from "@/firebase-applet-config.json";
import { UserProfile } from "../../types";
import AccessValuesPicker from "./AccessValuesPicker";

/**
 * Painel "Controle de Logins & Acessos" da tela Banco (só para admin/master):
 * cadastro, edição, desativação e reativação de logins.
 */
const UserManagement: React.FC = () => {
  const { rawOrders } = useData();
  const { userProfile } = useAuth();

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
            needsPasswordReset: data.needsPasswordReset ?? false,
            disabled: data.disabled === true
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
        // Logins desativados vão para o fim da lista
        if (!!a.disabled !== !!b.disabled) return a.disabled ? 1 : -1;
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

  /**
   * O e-mail já tem login criado (ex.: perfil apagado antes desta versão).
   * Se a senha digitada for a senha atual da pessoa, recria o perfil com as
   * permissões do formulário. Retorna a mensagem de erro, ou null se deu certo.
   */
  const recoverExistingLogin = async (tempAuth: ReturnType<typeof getAuth>): Promise<string | null> => {
    const email = newEmail.trim();
    const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing?.disabled) {
      return `O login "${email}" está desativado. Use o botão "Reativar" na lista abaixo.`;
    }
    if (existing) {
      return "Este endereço de e-mail já está cadastrado na lista abaixo.";
    }

    try {
      const cred = await signInWithEmailAndPassword(tempAuth, email, newPassword);
      await setDoc(doc(db, "users", cred.user.uid), {
        email,
        name: newName.trim(),
        role: newRole,
        accessType: newAccessType,
        accessValues: newAccessType === "ALL" ? [] : selectedValues,
        createdAt: new Date().toISOString(),
        rawPassword: newPassword,
        loginCount: 0,
        needsPasswordReset: false,
        disabled: false
      });
      setUserManageSuccess(`O login "${email}" já existia e foi liberado novamente com as permissões escolhidas.`);
      setNewName("");
      setNewEmail("");
      setNewPassword("123456");
      setNewRole("user");
      setNewAccessType("ALL");
      setSelectedValues([]);
      setShowAddForm(false);
      fetchUsers();
      return null;
    } catch (e) {
      console.error("Error recovering existing login:", e);
      return `O e-mail "${email}" já tem login criado. Para liberar de novo, digite no campo Senha a senha atual dessa pessoa e confirme.`;
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
        errorMsg = await recoverExistingLogin(tempAuth) ?? "";
        if (!errorMsg) return;
      } else if (error?.code === "auth/invalid-email") {
        errorMsg = "Endereço de e-mail inválido.";
      }
      setUserManageError(errorMsg);
    } finally {
      setIsCreatingUser(false);
      await deleteApp(tempApp);
    }
  };

  const handleSetUserDisabled = async (u: UserProfile, disabled: boolean) => {
    setUserManageError(null);
    setUserManageSuccess(null);

    // Bloqueio: o MASTER não pode ser desativado por outro administrador
    const isMaster = u.role === "master" || u.email === "hugotjk2@gmail.com";
    if (disabled && isMaster) {
      setUserManageError("O usuário MASTER não pode ser desativado.");
      return;
    }

    const question = disabled
      ? `Desativar o acesso de "${u.email}"? A pessoa não verá mais nenhum dado. Você pode reativar depois.`
      : `Reativar o acesso de "${u.email}" com as mesmas permissões de antes?`;
    if (!confirm(question)) return;

    try {
      try {
        await setDoc(doc(db, "users", u.uid), { disabled }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${u.uid}`);
      }
      setUserManageSuccess(disabled ? "Login desativado com sucesso!" : "Login reativado com sucesso!");
      fetchUsers();
    } catch (error) {
      console.error("Error updating user status:", error);
      setUserManageError("Erro ao alterar o status do login no Firestore.");
    }
  };

  return (
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
                    <AccessValuesPicker
                      variant="full"
                      accessType={newAccessType}
                      options={availableOptionsForSelectedType}
                      selected={selectedValues}
                      search={filterOptionSearch}
                      onSearchChange={setFilterOptionSearch}
                      onToggle={handleToggleValueSelection}
                      onSelectAll={handleSelectAllOptions}
                      onClear={handleClearAllOptions}
                    />
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
                <span>Logins Ativos Cadastrados ({users.filter(u => !u.disabled).length})</span>
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
                          (isUserExpanded || isEditingThisUser) && "border-gray-200 bg-white shadow-sm",
                          u.disabled && !isEditingThisUser && "opacity-60"
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
                                <AccessValuesPicker
                                  variant="compact"
                                  accessType={editAccessType}
                                  options={availableOptionsForEditSelectedType}
                                  selected={editSelectedValues}
                                  search={editFilterOptionSearch}
                                  onSearchChange={setEditFilterOptionSearch}
                                  onToggle={handleToggleEditValueSelection}
                                  onSelectAll={handleSelectAllEditOptions}
                                  onClear={handleClearAllEditOptions}
                                />
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
                                    {u.disabled && (
                                      <span className="inline-block rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-gray-200 text-gray-600">
                                        Desativado
                                      </span>
                                    )}
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
                                    {!isThisMaster && (u.disabled ? (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSetUserDisabled(u, false);
                                        }}
                                        className="text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 active:scale-95 transition-all shrink-0 flex items-center space-x-1 text-[9px] font-black uppercase"
                                        title="Reativar login"
                                      >
                                        <UserCheck size={12} />
                                        <span>Reativar</span>
                                      </button>
                                    ) : (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSetUserDisabled(u, true);
                                        }}
                                        className="text-gray-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 active:scale-95 transition-all shrink-0"
                                        title="Desativar login"
                                      >
                                        <UserX size={13} />
                                      </button>
                                    ))}
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
  );
};

export default UserManagement;
