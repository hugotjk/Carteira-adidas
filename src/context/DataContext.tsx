import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Order } from "../types";
import { getOrdersLocally, getImageMapLocally, fetchSheetData, saveOrdersLocally, fetchGitHubImages } from "../services/dataService";
import { useAuth } from "./AuthContext";

interface DataContextType {
  allOrders: Order[];
  rawOrders: Order[]; // Keep the raw unrestricted orders if needed
  imageMap: Record<string, string>;
  loading: boolean;
  isSyncing: boolean;
  refreshData: () => Promise<void>;
  syncDatabase: () => Promise<{ count: number; dataSourceDate: string; lastSync: string }>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { userProfile } = useAuth();
  const [rawOrders, setRawOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [imageMap, setImageMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasSyncedOnLogin, setHasSyncedOnLogin] = useState<string | null>(null);

  // Auto-sync once on login / app start if authenticated
  useEffect(() => {
    if (userProfile?.uid) {
      if (hasSyncedOnLogin !== userProfile.uid) {
        setHasSyncedOnLogin(userProfile.uid);
        syncDatabase().catch((error) => {
          console.error("Auto-sync database failed on login:", error);
        });
      }
    } else {
      setHasSyncedOnLogin(null);
    }
  }, [userProfile, hasSyncedOnLogin]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [data, images] = await Promise.all([
        getOrdersLocally(),
        getImageMapLocally()
      ]);

      const parseMonthYear = (monthYear: string) => {
        if (!monthYear) return 0;
        if (monthYear.includes("-")) {
          const [y, m] = monthYear.split("-");
          return new Date(parseInt(y), parseInt(m) - 1).getTime();
        }
        const months: Record<string, number> = {
          'JAN': 0, 'FEV': 1, 'MAR': 2, 'ABR': 3, 'MAI': 4, 'JUN': 5,
          'JUL': 6, 'AGO': 7, 'SET': 8, 'OUT': 9, 'NOV': 10, 'DEZ': 11
        };
        const parts = monthYear.split('/');
        if (parts.length === 2) {
          const [m, y] = parts;
          return new Date(parseInt(y), months[m.toUpperCase()] || 0).getTime();
        }
        return 0;
      };

      const dataWithIds = data.map((order, index) => ({ 
        ...order, 
        id: order.id || `order-${index}`,
        mesRecebTimestamp: parseMonthYear(order.mesRecebMaterial)
      }));
      setRawOrders(dataWithIds);
      setImageMap(images);
    } catch (error) {
      console.error("Error loading data context:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter orders based on user permission profile
  useEffect(() => {
    if (!userProfile) {
      setAllOrders([]);
      return;
    }

    if (userProfile.role === "admin" || userProfile.role === "master" || userProfile.accessType === "ALL") {
      setAllOrders(rawOrders);
      return;
    }

    const type = userProfile.accessType;
    const values = userProfile.accessValues.map(v => v.trim().toLowerCase());

    const filtered = rawOrders.filter(order => {
      if (type === "GESTOR") {
        return values.includes((order.gestor || "").toLowerCase().trim());
      }
      if (type === "LOJA") {
        return values.includes((order.loja || "").toLowerCase().trim());
      }
      if (type === "GRUPO") {
        return values.includes((order.grupo || "").toLowerCase().trim());
      }
      if (type === "CUSTOMER") {
        return values.includes((order.customer || "").toLowerCase().trim());
      }
      return false;
    });

    setAllOrders(filtered);
  }, [rawOrders, userProfile]);

  const syncDatabase = async () => {
    setIsSyncing(true);
    try {
      const [{ orders, dataSourceDate: dateFromSheet }, gitHubImages] = await Promise.all([
        fetchSheetData(),
        fetchGitHubImages()
      ]);
      await saveOrdersLocally(orders, dateFromSheet, gitHubImages);
      await loadData();
      const now = new Date().toLocaleString("pt-BR");
      return { count: orders.length, dataSourceDate: dateFromSheet || "", lastSync: now };
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <DataContext.Provider value={{ allOrders, rawOrders, imageMap, loading, isSyncing, refreshData: loadData, syncDatabase }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
};
