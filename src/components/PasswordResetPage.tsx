import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Key, AlertCircle, CheckCircle, Loader2, LogOut } from "lucide-react";

export default function PasswordResetPage() {
  const { changePassword, logout } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password || !confirmPassword) {
      setError("Por favor, preencha todos os campos.");
      return;
    }

    if (password.length < 6) {
      setError("A nova senha deve conter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas informadas não coincidem.");
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword(password);
      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      let errMsg = "Erro ao alterar a senha. Tente novamente.";
      if (err?.code === "auth/requires-recent-login") {
        errMsg = "Sessão expirada. Faça login novamente para atualizar sua senha.";
      }
      setError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
        {/* Top Header */}
        <div className="px-8 pt-10 pb-6 text-center border-b border-gray-50 bg-amber-50/40">
          <div className="w-14 h-14 bg-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-600/10">
            <Key className="text-white" size={26} />
          </div>
          <h2 className="text-xl font-black text-gray-900 tracking-tight leading-none">Primeiro Acesso</h2>
          <p className="text-xs text-amber-700 mt-2 font-bold uppercase tracking-wider">
            Defina sua senha definitiva
          </p>
        </div>

        {success ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto text-white shadow-lg shadow-green-500/20">
              <CheckCircle size={24} />
            </div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Senha Atualizada!</h3>
            <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
              Sua senha definitiva foi configurada e salva com sucesso. Você já está liberado para acessar o sistema.
            </p>
            <div className="pt-2">
              <p className="text-[10px] font-bold text-gray-400 animate-pulse uppercase tracking-wider">
                Carregando painel principal...
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              Para garantir a segurança dos seus dados, é necessário alterar sua senha temporária no primeiro acesso ao sistema.
            </p>

            {error && (
              <div className="flex items-center space-x-2 bg-red-50 text-red-700 p-3.5 rounded-xl text-xs font-bold border border-red-100">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Nova Senha
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="password"
                  required
                  disabled={isSubmitting}
                  placeholder="Min. 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-amber-600/15 focus:bg-white outline-none transition-all disabled:opacity-50"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Confirmar Nova Senha
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="password"
                  required
                  disabled={isSubmitting}
                  placeholder="Repita a nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-amber-600/15 focus:bg-white outline-none transition-all disabled:opacity-50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center space-x-2 shadow-lg shadow-amber-600/15"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  <span>Salvando nova senha...</span>
                </>
              ) : (
                <span>Confirmar Nova Senha</span>
              )}
            </button>

            <button
              type="button"
              onClick={logout}
              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-2"
            >
              <LogOut size={14} />
              <span>Sair</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
