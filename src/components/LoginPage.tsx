import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Database, Lock, Mail, Loader2, AlertCircle, ArrowLeft, CheckCircle } from "lucide-react";

export default function LoginPage() {
  const { login, resetPasswordEmail } = useAuth();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || (mode === "login" && !password)) {
      setError("Preencha todos os campos do formulário.");
      return;
    }
    setError(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    if (mode === "login") {
      try {
        await login(email.trim(), password);
      } catch (err: any) {
        console.error(err);
        let errMsg = "Falha ao realizar login. Verifique as credenciais.";
        if (err?.code === "auth/invalid-credential" || err?.code === "auth/wrong-password" || err?.code === "auth/user-not-found") {
          errMsg = "E-mail ou senha incorretos.";
        } else if (err?.code === "auth/invalid-email") {
          errMsg = "E-mail informado é inválido.";
        } else if (err?.code === "auth/network-request-failed") {
          errMsg = "Erro de conexão de rede. Tente novamente.";
        }
        setError(errMsg);
        setIsSubmitting(false);
      }
    } else {
      // Forgot Password flow
      try {
        await resetPasswordEmail(email.trim());
        setSuccessMsg("Link para redefinição enviado com sucesso! Verifique seu e-mail.");
        setEmail("");
      } catch (err: any) {
        console.error(err);
        let errMsg = "Ocorreu um erro ao enviar e-mail de redefinição.";
        if (err?.code === "auth/user-not-found") {
          errMsg = "Nenhum usuário cadastrado com este e-mail.";
        } else if (err?.code === "auth/invalid-email") {
          errMsg = "E-mail informado é inválido.";
        }
        setError(errMsg);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
        {/* Top Header */}
        <div className="px-8 pt-10 pb-6 text-center border-b border-gray-50 bg-gray-50/50">
          <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-black/10">
            <Database className="text-white" size={26} />
          </div>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight leading-none">Carteira adidas</h2>
          <p className="text-xs text-gray-400 mt-2 font-medium uppercase tracking-wider">
            Gestão de Pedidos & Logística
          </p>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          <div className="flex items-center justify-between pb-1">
            <h3 className="text-xs font-black uppercase text-gray-800 tracking-wider">
              {mode === "login" ? "Acessar Plataforma" : "Recuperar Senha"}
            </h3>
            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-[10px] font-black text-gray-400 hover:text-black uppercase tracking-wider flex items-center space-x-1 transition-colors"
              >
                <ArrowLeft size={10} />
                <span>Voltar</span>
              </button>
            )}
          </div>

          {error && (
            <div className="flex items-center space-x-2 bg-red-50 text-red-700 p-3.5 rounded-xl text-xs font-bold border border-red-100 transition-all">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center space-x-2 bg-green-50 text-green-700 p-3.5 rounded-xl text-xs font-bold border border-green-100 transition-all">
              <CheckCircle size={16} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              Endereço de E-mail
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="email"
                required
                disabled={isSubmitting}
                placeholder="exemplo@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-black/10 focus:bg-white outline-none transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {mode === "login" && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Senha de Acesso
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="text-[10px] font-bold text-amber-600 hover:text-amber-700 uppercase tracking-wider transition-colors outline-none"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="password"
                  required
                  disabled={isSubmitting}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-black/10 focus:bg-white outline-none transition-all disabled:opacity-50"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-black hover:bg-gray-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center space-x-2 shadow-lg shadow-black/10 mt-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                <span>{mode === "login" ? "Autenticando..." : "Enviando..."}</span>
              </>
            ) : (
              <span>{mode === "login" ? "Entrar no Sistema" : "Enviar link de recuperação"}</span>
            )}
          </button>

          <p className="text-[10px] text-gray-400 text-center font-medium leading-relaxed pt-2">
            Caso não possua um login ou tenha esquecido sua senha, por favor entre em contato com o administrador do sistema.
          </p>
        </form>
      </div>
    </div>
  );
}
