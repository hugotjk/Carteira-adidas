import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Order } from "../types";
import { getOrdersLocally, getImageMapLocally } from "../services/dataService";

interface DataContextType {
  allOrders: Order[];
  imageMap: Record<string, string>;
  loading: boolean;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [imageMap, setImageMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

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
      setAllOrders(dataWithIds);
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

  return (
    <DataContext.Provider value={{ allOrders, imageMap, loading, refreshData: loadData }}>
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
