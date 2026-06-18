import Papa from "papaparse";
import { get, set } from "idb-keyval";
import { Order } from "../types";

const SHEET_URL = "/api/sheet-data";

export async function fetchGitHubImages(): Promise<Record<string, string>> {
  const imageMap: Record<string, string> = {};

  const processFiles = (files: any[], repo: string) => {
    if (Array.isArray(files)) {
      files.forEach((file: any) => {
        if (file.type === "file") {
          const name = file.name.toLowerCase();
          if (name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg")) {
            const material = file.name.split(".")[0];
            const ext = file.name.split(".").pop() || "";
            if (repo === "adidas-fla") {
              if (!imageMap[material] || ext === "png") {
                imageMap[material] = `${ext}:adidas-fla`;
              }
            } else {
              const currentVal = imageMap[material];
              const currentExt = currentVal ? currentVal.split(":")[0] : null;
              if (!currentVal || ext === "png" || (currentExt !== "png" && ext === "png")) {
                imageMap[material] = `${ext}:adidas`;
              }
            }
          }
        }
      });
    }
  };

  // 1. Fetch from adidas-fla proxy
  let fetchedFla = false;
  try {
    const url = typeof window !== "undefined" && window.location ? `${window.location.origin}/api/github-images/adidas-fla` : "/api/github-images/adidas-fla";
    const response = await fetch(url);
    if (response.ok) {
      const files = await response.json();
      processFiles(files, "adidas-fla");
      fetchedFla = true;
    }
  } catch (error) {
    console.warn("Error fetching adidas-fla images from proxy:", error);
  }

  if (!fetchedFla) {
    try {
      const response = await fetch("https://api.github.com/repos/hugotjk/adidas-fla/contents/");
      if (response.ok) {
        const files = await response.json();
        processFiles(files, "adidas-fla");
      }
    } catch (error) {
      console.error("Backup error fetching adidas-fla direct:", error);
    }
  }

  // 2. Fetch from adidas proxy (the second repository)
  let fetchedAdidas = false;
  try {
    const url = typeof window !== "undefined" && window.location ? `${window.location.origin}/api/github-images/adidas` : "/api/github-images/adidas";
    const response = await fetch(url);
    if (response.ok) {
      const files = await response.json();
      processFiles(files, "adidas");
      fetchedAdidas = true;
    }
  } catch (error) {
    console.warn("Error fetching adidas images from proxy:", error);
  }

  if (!fetchedAdidas) {
    try {
      const response = await fetch("https://api.github.com/repos/hugotjk/adidas/contents/");
      if (response.ok) {
        const files = await response.json();
        processFiles(files, "adidas");
      }
    } catch (error) {
      console.error("Backup error fetching adidas direct:", error);
    }
  }

  return imageMap;
}

export async function fetchSheetData(): Promise<{ orders: Order[]; dataSourceDate: string }> {
  let csvText = "";
  let success = false;

  // 1. Try our Absolute Proxy URL
  try {
    const url = typeof window !== "undefined" && window.location ? `${window.location.origin}/api/sheet-data` : SHEET_URL;
    const response = await fetch(url);
    if (response.ok) {
      csvText = await response.text();
      success = true;
    } else {
      console.warn("Proxy sheet fetch returned status:", response.status);
    }
  } catch (error) {
    console.warn("Proxy sheet fetch failed:", error);
  }

  // 2. Fallback to direct client-side spreadsheet URL if Proxy failed
  if (!success) {
    try {
      const DIRECT_SHEET_URL = "https://docs.google.com/spreadsheets/d/16_hCfoGEpicwslIpUzxYZF8GYNVXCYsi/export?format=csv";
      const response = await fetch(DIRECT_SHEET_URL);
      if (response.ok) {
        csvText = await response.text();
        success = true;
      } else {
        throw new Error(`Direct spreadsheet fetch responded with status ${response.status}`);
      }
    } catch (fallbackError) {
      console.error("Direct sheet fetch fallback also failed:", fallbackError);
      throw new Error("Falha ao buscar dados de todas as fontes disponíveis");
    }
  }

  try {
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
          const bbHeader = fields[53]; // Column BB is index 53
          const apHeader = fields[41]; // Column AP is index 41 (AP2 is first data row)
          const qHeader = fields[16];  // Column Q is index 16
          const atHeader = fields[45]; // Column AT is index 45: GESTOR
          const auHeader = fields[46]; // Column AU is index 46: LOJA
          const lHeader = fields[11];  // Column L is index 11: GRUPO
          const gHeader = fields[6];   // Column G is index 6: CUSTOMER

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
            gestor: row[atHeader] || row["Gestor"] || row["GESTOR"] || "",
            loja: row[auHeader] || row["Loja"] || row["LOJA"] || "",
            subGrupo: row["SubGrupo"] || row["SUBGRUPO"] || "",
            colecao: row["Colecao"] || row["COLECAO"] || "",
            status: row["Status"] || row["STATUS"] || "",
            tipoLoja: row[bbHeader] || row["Tipo Loja"] || row["TIPO LOJA"] || "",
            dataLancamento: row[qHeader] || row["Data de Lancamento"] || row["DATA LANCAMENTO"] || "",
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
            grupo: row[lHeader] || row["Grupo"] || row["GRUPO"] || "",
            customer: row[gHeader] || row["Customer"] || row["CUSTOMER"] || row["Cliente"] || row["CLIENTE"] || "",
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

export async function saveOrdersLocally(orders: Order[], dataSourceDate?: string, imageMap?: Record<string, string>) {
  // Use IndexedDB via idb-keyval for larger storage capacity
  await set("orders", orders);
  if (imageMap) {
    await set("imageMap", imageMap);
  }
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

export async function getImageMapLocally(): Promise<Record<string, string>> {
  const saved = await get<Record<string, string>>("imageMap");
  return saved || {};
}

export async function autoSyncIfNecessary() {
  const lastSync = localStorage.getItem("lastSyncTimestamp");
  const twelveHours = 12 * 60 * 60 * 1000;
  
  if (!lastSync || (Date.now() - parseInt(lastSync)) > twelveHours) {
    console.log("Auto-syncing data from Google Sheets and GitHub...");
    try {
      const [{ orders, dataSourceDate }, imageMap] = await Promise.all([
        fetchSheetData(),
        fetchGitHubImages()
      ]);
      await saveOrdersLocally(orders, dataSourceDate, imageMap);
      return orders;
    } catch (error) {
      console.error("Auto-sync failed:", error);
    }
  }
  return null;
}
