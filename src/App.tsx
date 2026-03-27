import React from "react";
import Sidebar from "./components/Sidebar";
import DashboardPage from "./pages/DashboardPage";
import AnalysisPage from "./pages/AnalysisPage";
import SyncPage from "./pages/SyncPage";
import { autoSyncIfNecessary } from "./services/dataService";
import { FilterProvider } from "./context/FilterContext";
import { DataProvider } from "./context/DataContext";

export default function App() {
  const [activeTab, setActiveTab] = React.useState("dashboard");

  React.useEffect(() => {
    // Check for auto-sync on app load
    autoSyncIfNecessary();
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardPage />;
      case "analysis":
        return <AnalysisPage />;
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
          
          <main className="w-full lg:pl-64 min-h-screen transition-all duration-300 pb-20 lg:pb-0">
            <div className="w-full max-w-[1600px] mx-auto">
              {renderContent()}
            </div>
          </main>
        </div>
      </FilterProvider>
    </DataProvider>
  );
}
