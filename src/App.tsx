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

function AppContent() {
  const { userProfile, loading } = useAuth();
  const [activeTab, setActiveTab] = React.useState("dashboard");

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 space-y-4">
        <Loader2 className="animate-spin text-black" size={40} />
        <p className="text-gray-500 font-medium text-sm text-center">Validando sessão...</p>
      </div>
    );
  }

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
