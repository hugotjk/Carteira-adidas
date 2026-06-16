import React from "react";
import Sidebar from "./components/Sidebar";
import DashboardPage from "./pages/DashboardPage";
import AnalysisPage from "./pages/AnalysisPage";
import ReleasePage from "./pages/ReleasePage";
import SyncPage from "./pages/SyncPage";
import LoginPage from "./components/LoginPage";
import PasswordResetPage from "./components/PasswordResetPage";
import { autoSyncIfNecessary } from "./services/dataService";
import { FilterProvider } from "./context/FilterContext";
import { DataProvider } from "./context/DataContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Loader2 } from "lucide-react";

function AppContent() {
  const { userProfile, loading } = useAuth();
  const [activeTab, setActiveTab] = React.useState("dashboard");

  React.useEffect(() => {
    // Check for auto-sync on app load
    autoSyncIfNecessary();
  }, []);

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
              {renderContent()}
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
