import Papa from "papaparse";
import { get, set } from "idb-keyval";
import { Order } from "../types";

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1h302iCGdzxpayOumFfqU0MD-KlukMVWVadpZYy1-RF4/export?format=csv";

export async function fetchSheetData(): Promise<{ orders: Order[]; dataSourceDate: string }> {
  try {
    const response = await fetch(SHEET_URL);
    if (!response.ok) throw new Error("Falha ao buscar dados da planilha");
    const csvText = await response.text();
    
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const fields = results.meta.fields || [];
          const aeHeader = fields[30]; // Column AE is index 30
          const axHeader = fields[49]; // Column AX is index 49
          const ayHeader = fields[50]; // Column AY is index 50
          const azHeader = fields[51]; // Column AZ is index 51
          const baHeader = fields[52]; // Column BA is index 52
          const apHeader = fields[41]; // Column AP is index 41 (AP2 is first data row)

          const dataSourceDate = results.data[0] ? String(results.data[0][apHeader] || "") : "";

          const parseNumber = (val: any) => {
            if (!val) return 0;
            const s = String(val).trim().replace(/[R$\s]/g, "");
            if (s === "" || s === "-") return 0;
            let num;
            if (s.includes(",")) {
              // Brazilian format: 1.234,56 -> 1234.56
              num = parseFloat(s.replace(/\./g, "").replace(",", "."));
            } else {
              num = parseFloat(s);
            }
            return isNaN(num) ? 0 : num;
          };

          const orders: Order[] = results.data.map((row: any) => ({
            gestor: row["Gestor"] || row["GESTOR"] || "",
            loja: row["Loja"] || row["LOJA"] || "",
            subGrupo: row["SubGrupo"] || row["SUBGRUPO"] || "",
            colecao: row["Colecao"] || row["COLECAO"] || "",
            status: row["Status"] || row["STATUS"] || "",
            dataLancamento: row["Data de Lancamento"] || row["DATA LANCAMENTO"] || "",
            mesRecebMaterial: row["Mês Receb do Material"] || row["MES RECEB MATERIAL"] || "",
            material: row["Material"] || row["MATERIAL"] || "",
            materialDescription: row["Material Description"] || row["MATERIAL DESCRIPTION"] || "",
            pedido: row["Pedido"] || row["PEDIDO"] || row["Order"] || row["ORDER"] || "",
            qtdeConfirmada: parseNumber(row["Qtde Confirmada"] || row["QTDE CONFIRMADA"]),
            valorNF: parseNumber(row[aeHeader] || row["valor nf"] || row["VALOR NF"]),
            venda: parseNumber(row[axHeader] || row["venda"] || row["VENDA"]),
            estoque: parseNumber(row[ayHeader] || row["estoque"] || row["ESTOQUE"]),
            mediaVenda: parseNumber(row[azHeader] || row["media venda"] || row["MEDIA VENDA"]),
            estoqueGestor: parseNumber(row[baHeader] || row["estoque gestor"] || row["ESTOQUE GESTOR"]),
            originalRow: row,
          }));
          resolve({ orders, dataSourceDate });
        },
        error: (error) => {
          reject(error);
        },
      });
    });
  } catch (error) {
    console.error("Error fetching sheet data:", error);
    throw error;
  }
}

export async function saveOrdersLocally(orders: Order[], dataSourceDate?: string) {
  // Use IndexedDB via idb-keyval for larger storage capacity
  await set("orders", orders);
  localStorage.setItem("lastSyncTimestamp", Date.now().toString());
  localStorage.setItem("lastSyncDate", new Date().toLocaleString("pt-BR"));
  if (dataSourceDate) {
    localStorage.setItem("dataSourceDate", dataSourceDate);
  }
}

export async function getOrdersLocally(): Promise<Order[]> {
  const saved = await get<Order[]>("orders");
  return saved || [];
}

export async function autoSyncIfNecessary() {
  const lastSync = localStorage.getItem("lastSyncTimestamp");
  const twelveHours = 12 * 60 * 60 * 1000;
  
  if (!lastSync || (Date.now() - parseInt(lastSync)) > twelveHours) {
    console.log("Auto-syncing data from Google Sheets...");
    try {
      const { orders, dataSourceDate } = await fetchSheetData();
      await saveOrdersLocally(orders, dataSourceDate);
      return orders;
    } catch (error) {
      console.error("Auto-sync failed:", error);
    }
  }
  return null;
}
