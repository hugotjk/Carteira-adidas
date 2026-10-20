import React from "react";
import { useAuth } from "../context/AuthContext";
import { ShieldOff, LogOut } from "lucide-react";

/**
 * Exibida quando o login existe, mas não tem perfil liberado
 * (perfil apagado/desativado pelo administrador ou nunca cadastrado).
 */
export default function AccessBlockedPage() {
  const { userProfile, logout } = useAuth();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
        <div className="px-8 pt-10 pb-6 text-center border-b border-gray-50 bg-gray-50/50">
          <div className="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-black/10">
            <ShieldOff className="text-white" size={26} />
          </div>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight leading-none">Acesso não liberado</h2>
          <p className="text-xs text-gray-400 mt-2 font-medium uppercase tracking-wider">Carteira adidas</p>
        </div>

        <div className="p-8 space-y-5 text-center">
          <p className="text-sm text-gray-600 leading-relaxed">
            O login <span className="font-bold text-gray-900 break-all">{userProfile?.email}</span> ainda não tem acesso
            liberado ou foi desativado.
          </p>
          <p className="text-xs text-gray-400 leading-relaxed">
            Fale com o administrador do sistema para liberar seu acesso.
          </p>

          <button
            type="button"
            onClick={logout}
            className="w-full py-3 bg-black hover:bg-gray-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-2"
          >
            <LogOut size={14} />
            <span>Sair</span>
          </button>
        </div>
      </div>
    </div>
  );
}
