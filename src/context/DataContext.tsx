import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { Order } from "../types";
import {
  getOrdersLocally,
  getImageMapLocally,
  fetchSheetData,
  saveOrdersLocally,
  saveImageMapLocally,
  fetchGitHubImages,
  getSyncInfo,
  markSynced,
} from "../services/dataService";
import { useAuth } from "./AuthContext";
import { fixBrokenAccents } from "../lib/utils";

export interface SyncResult {
  count: number;
  dataSourceDate: string;
  lastSync: string;
  /** true quando a planilha não tinha mudado (nada novo foi baixado). */
  notModified: boolean;
  warnings: string[];
}

interface DataContextType {
  allOrders: Order[];
  rawOrders: Order[]; // Keep the raw unrestricted orders if needed
  imageMap: Record<string, string>;
  loading: boolean;
  isSyncing: boolean;
  /** Quando o app buscou os dados pela última vez. */
  lastSync: string | null;
  /** Data/hora de atualização que vem da própria planilha (coluna "Data de Atualização"). */
  dataSourceDate: string | null;
  /** Avisos da última sincronização (ex.: coluna não encontrada). */
  syncWarnings: string[];
  refreshData: () => Promise<void>;
  /** force = true busca no Google na hora, sem usar a cópia guardada no servidor. */
  syncDatabase: (force?: boolean) => Promise<SyncResult>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const MONTHS: Record<string, number> = {
  'JAN': 0, 'FEV': 1, 'MAR': 2, 'ABR': 3, 'MAI': 4, 'JUN': 5,
  'JUL': 6, 'AGO': 7, 'SET': 8, 'OUT': 9, 'NOV': 10, 'DEZ': 11
};

const parseMonthYear = (monthYear: string) => {
  if (!monthYear) return 0;
  if (monthYear.includes("-")) {
    const [y, m] = monthYear.split("-");
    return new Date(parseInt(y), parseInt(m) - 1).getTime();
  }
  const parts = monthYear.split('/');
  if (parts.length === 2) {
    const [m, y] = parts;
    return new Date(parseInt(y), MONTHS[m.toUpperCase()] || 0).getTime();
  }
  return 0;
};

const prepareOrders = (data: Order[]): Order[] =>
  data.map((order, index) => ({
    ...order,
    // Dados já guardados no aparelho antes desta correção também saem com acento certo
    materialDescription: fixBrokenAccents(order.materialDescription),
    subGrupo: fixBrokenAccents(order.subGrupo),
    loja: fixBrokenAccents(order.loja),
    id: order.id || `order-${index}`,
    mesRecebTimestamp: parseMonthYear(order.mesRecebMaterial)
  }));

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { userProfile } = useAuth();
  const [rawOrders, setRawOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [imageMap, setImageMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(() => getSyncInfo().lastSync);
  const [dataSourceDate, setDataSourceDate] = useState<string | null>(() => getSyncInfo().dataSourceDate);
  const [syncWarnings, setSyncWarnings] = useState<string[]>([]);
  const syncPromiseRef = useRef<Promise<SyncResult> | null>(null);
  const hasLocalDataRef = useRef(false);
  const orderCountRef = useRef(0);
  const warningsRef = useRef<string[]>([]);
  const localLoadRef = useRef<Promise<void> | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [data, images] = await Promise.all([
        getOrdersLocally(),
        getImageMapLocally()
      ]);
      hasLocalDataRef.current = data.length > 0;
      orderCountRef.current = data.length;
      setRawOrders(prepareOrders(data));
      setImageMap(images);
    } catch (error) {
      console.error("Error loading data context:", error);
    } finally {
      setLoading(false);
    }
  };

  const runSync = async (force: boolean): Promise<SyncResult> => {
    // Espera os dados guardados no aparelho carregarem antes de decidir o que baixar
    if (localLoadRef.current) await localLoadRef.current;

    const etag = hasLocalDataRef.current ? getSyncInfo().etag : null;

    // Fotos e planilha em paralelo; se as fotos falharem, a planilha segue normalmente
    const imagesPromise = fetchGitHubImages()
      .then(async (images) => {
        if (Object.keys(images).length > 0) {
          await saveImageMapLocally(images);
          setImageMap(images);
        }
      })
      .catch((e) => console.warn("Image sync failed:", e));

    const sheet = await fetchSheetData({ force, etag });

    let count = orderCountRef.current;
    let sourceDate = getSyncInfo().dataSourceDate || "";

    if (!sheet.notModified) {
      await saveOrdersLocally(sheet.orders, sheet.dataSourceDate, sheet.etag);
      hasLocalDataRef.current = sheet.orders.length > 0;
      orderCountRef.current = sheet.orders.length;
      warningsRef.current = sheet.warnings;
      setRawOrders(prepareOrders(sheet.orders));
      count = sheet.orders.length;
      sourceDate = sheet.dataSourceDate || sourceDate;
      setDataSourceDate(sourceDate || null);
      setSyncWarnings(sheet.warnings);
    }

    await imagesPromise;
    const now = markSynced();
    setLastSync(now);

    return { count, dataSourceDate: sourceDate, lastSync: now, notModified: sheet.notModified, warnings: warningsRef.current };
  };

  const syncDatabase = (force = false): Promise<SyncResult> => {
    // Se já está sincronizando (ex.: clique no logo durante a sincronização do login), reaproveita
    if (syncPromiseRef.current) return syncPromiseRef.current;

    setIsSyncing(true);
    const promise = runSync(force).finally(() => {
      syncPromiseRef.current = null;
      setIsSyncing(false);
    });
    syncPromiseRef.current = promise;
    return promise;
  };

  // 1. Mostra na hora os dados guardados no aparelho
  // 2. Depois do login, sincroniza uma única vez com a planilha
  useEffect(() => {
    localLoadRef.current = loadData();
  }, []);

  const syncedForUid = useRef<string | null>(null);
  useEffect(() => {
    if (!userProfile?.uid || userProfile.blocked) {
      syncedForUid.current = null;
      return;
    }
    if (syncedForUid.current === userProfile.uid) return;
    syncedForUid.current = userProfile.uid;
    syncDatabase().catch((error) => {
      console.error("Auto-sync database failed on login:", error);
    });
  }, [userProfile?.uid, userProfile?.blocked]);

  // Filter orders based on user permission profile
  useEffect(() => {
    if (!userProfile || userProfile.blocked) {
      setAllOrders([]);
      return;
    }

    if (userProfile.role === "admin" || userProfile.role === "master" || userProfile.accessType === "ALL") {
      setAllOrders(rawOrders);
      return;
    }

    const type = userProfile.accessType;
    const values = userProfile.accessValues.map(v => fixBrokenAccents(v).trim().toLowerCase());

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

  return (
    <DataContext.Provider value={{
      allOrders,
      rawOrders,
      imageMap,
      loading,
      isSyncing,
      lastSync,
      dataSourceDate,
      syncWarnings,
      refreshData: loadData,
      syncDatabase,
    }}>
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
