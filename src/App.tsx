import React, { Suspense, lazy } from "react";
import Sidebar from "./components/Sidebar";
import LoginPage from "./components/LoginPage";
import PasswordResetPage from "./components/PasswordResetPage";
import AccessBlockedPage from "./components/AccessBlockedPage";
import { FilterProvider } from "./context/FilterContext";
import { DataProvider } from "./context/DataContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Loader2 } from "lucide-react";

// Cada tela é carregada só quando é aberta, para o app abrir mais rápido.
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const AnalysisPage = lazy(() => import("./pages/AnalysisPage"));
const ReleasePage = lazy(() => import("./pages/ReleasePage"));
const SyncPage = lazy(() => import("./pages/SyncPage"));
const SugestaoFW27Page = lazy(() => import("./pages/SugestaoFW27Page"));

const PageLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-4">
    <Loader2 className="animate-spin text-black" size={32} />
  </div>
);

/** Tela de espera do login. Se passar de 25 s, mostra o que fazer em vez de ficar girando para sempre. */
function ValidandoSessao() {
  const { logout } = useAuth();
  const [demorou, setDemorou] = React.useState(false);
  React.useEffect(() => { const t = setTimeout(() => setDemorou(true), 25000); return () => clearTimeout(t); }, []);
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 space-y-4 px-6">
      <Loader2 className="animate-spin text-black" size={40} />
      <p className="text-gray-500 font-medium text-sm text-center">Validando sessão...</p>
      {demorou && (
        <div className="max-w-sm text-center space-y-3">
          <p className="text-xs text-gray-500">Está demorando mais que o normal. Pode ser a internet ou a rede bloqueando o acesso ao servidor. Tente de novo; se continuar, abra em outro navegador ou na rede do celular.</p>
          <div className="flex gap-2 justify-center">
            <button onClick={() => location.reload()} className="h-9 px-4 rounded-xl bg-black text-white text-xs font-bold">Tentar de novo</button>
            <button onClick={() => { logout().finally(() => location.reload()); }} className="h-9 px-4 rounded-xl bg-white border border-gray-200 text-xs font-bold">Sair e entrar de novo</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AppContent() {
  const { userProfile, loading } = useAuth();
  const [activeTab, setActiveTab] = React.useState("dashboard");

  if (loading) return <ValidandoSessao />;

  if (!userProfile) {
    return <LoginPage />;
  }

  if (userProfile.blocked) {
    return <AccessBlockedPage />;
  }

  if (userProfile.needsPasswordReset) {
    return <PasswordResetPage />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardPage />;
      case "analysis":
        return <AnalysisPage />;
      case "release":
        return <ReleasePage />;
      case "fw27":
        return <SugestaoFW27Page />;
      case "sync":
        return <SyncPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <DataProvider>
      <FilterProvider>
        <div className="min-h-screen bg-gray-50 overflow-x-hidden relative">
          <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

          <main className="w-full md:pl-64 min-h-screen transition-all duration-300 pb-20 md:pb-0 pt-[50px] md:pt-0">
            <div className="w-full max-w-[1600px] mx-auto">
              <Suspense fallback={<PageLoader />}>
                {renderContent()}
              </Suspense>
            </div>
          </main>
        </div>
      </FilterProvider>
    </DataProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
