import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Order } from "../types";
import { getOrdersLocally } from "../services/dataService";

interface DataContextType {
  allOrders: Order[];
  loading: boolean;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getOrdersLocally();
      setAllOrders(data);
    } catch (error) {
      console.error("Error loading data context:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <DataContext.Provider value={{ allOrders, loading, refreshData: loadData }}>
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
