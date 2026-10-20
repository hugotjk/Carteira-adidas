import Papa from "papaparse";
import { get, set } from "idb-keyval";
import { Order } from "../types";
import { resolveColumns, rowToOrder } from "./sheetColumns";
import { parseSheetDate, formatDate, formatDateTime } from "../lib/dates";

const DIRECT_SHEET_URL = "https://docs.google.com/spreadsheets/d/16_hCfoGEpicwslIpUzxYZF8GYNVXCYsi/export?format=csv";
const IMAGE_REPOS = ["adidas-fla", "adidas"] as const;

// Chaves do armazenamento local (localStorage)
const LS_LAST_SYNC = "lastSyncDate";
const LS_LAST_SYNC_TS = "lastSyncTimestamp";
const LS_SOURCE_DATE = "dataSourceDate";
const LS_SHEET_ETAG = "sheetEtag";

const apiUrl = (path: string) =>
  typeof window !== "undefined" && window.location ? `${window.location.origin}${path}` : path;

// ---------------------------------------------------------------------------
// Fotos (repositórios hugotjk/adidas-fla e hugotjk/adidas no GitHub)
// ---------------------------------------------------------------------------

/** Lista os arquivos da raiz de um repositório de fotos (via servidor, com plano B direto no GitHub). */
async function listRepoFiles(repo: string): Promise<{ name: string; type: string }[]> {
  try {
    const response = await fetch(apiUrl(`/api/github-images/${repo}`));
    if (response.ok) return await response.json();
    console.warn(`Proxy de fotos (${repo}) respondeu ${response.status}`);
  } catch (error) {
    console.warn(`Erro ao buscar fotos de ${repo} pelo servidor:`, error);
  }

  // Plano B: direto do navegador. A API "git/trees" não tem o limite de 1.000 arquivos.
  try {
    const response = await fetch(`https://api.github.com/repos/hugotjk/${repo}/git/trees/main`);
    if (response.ok) {
      const json = await response.json();
      return (json.tree || []).map((item: any) => ({ name: item.path, type: item.type === "blob" ? "file" : item.type }));
    }
  } catch (error) {
    console.error(`Erro ao buscar fotos de ${repo} direto no GitHub:`, error);
  }
  return [];
}

export async function fetchGitHubImages(): Promise<Record<string, string>> {
  const imageMap: Record<string, string> = {};
  const lists = await Promise.all(IMAGE_REPOS.map((repo) => listRepoFiles(repo)));

  // Mesma regra de antes: lê adidas-fla e depois adidas; uma foto .png sempre
  // substitui a anterior, e .jpg/.jpeg só entra se o material ainda não tiver foto.
  IMAGE_REPOS.forEach((repo, i) => {
    for (const file of lists[i]) {
      if (file.type !== "file") continue;
      const name = file.name.toLowerCase();
      if (!(name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg"))) continue;

      const material = file.name.split(".")[0];
      const ext = file.name.split(".").pop() || "";
      if (!imageMap[material] || ext === "png") {
        imageMap[material] = `${ext}:${repo}`;
      }
    }
  });

  return imageMap;
}

// ---------------------------------------------------------------------------
// Planilha (Google Drive)
// ---------------------------------------------------------------------------

export interface SheetResult {
  /** true quando a planilha não mudou desde a última sincronização (nada foi baixado). */
  notModified: boolean;
  orders: Order[];
  dataSourceDate: string;
  etag: string | null;
  /** Avisos sobre colunas opcionais que não foram encontradas. */
  warnings: string[];
}

function parseCsv(csvText: string): Promise<Omit<SheetResult, "notModified" | "etag">> {
  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const fields = (results.meta.fields || []) as string[];
        const cols = resolveColumns(fields);

        if (cols.missingRequired.length > 0) {
          reject(new Error(
            `A planilha está sem a(s) coluna(s) obrigatória(s): ${cols.missingRequired.join(", ")}. ` +
            `Confira se o nome do cabeçalho mudou. Os dados anteriores foram mantidos.`
          ));
          return;
        }

        const rows = results.data as Record<string, any>[];
        const dataSourceDate = rows[0] && cols.updateDate ? String(rows[0][cols.updateDate] || "") : "";
        const orders = rows.map((row) => rowToOrder(row, cols));
        const warnings = cols.missingOptional.length > 0
          ? [`Coluna(s) não encontrada(s) na planilha: ${cols.missingOptional.join(", ")}. Esses campos ficarão vazios.`]
          : [];

        resolve({ orders, dataSourceDate, warnings });
      },
      error: (error: Error) => reject(error),
    });
  });
}

/**
 * Busca a planilha. Envia a "assinatura" (etag) da versão que já está salva no aparelho:
 * se a planilha não mudou, o servidor responde "sem alterações" e nada é baixado.
 * force = true pede ao servidor para buscar no Google na hora (botão "Atualizar").
 */
export async function fetchSheetData(options: { force?: boolean; etag?: string | null } = {}): Promise<SheetResult> {
  let csvText = "";
  let etag: string | null = null;
  let success = false;

  // 1. Pelo servidor do app (compactado e com verificação de alteração)
  try {
    const headers: Record<string, string> = {};
    if (options.etag) headers["If-None-Match"] = options.etag;
    const response = await fetch(apiUrl(`/api/sheet-data${options.force ? "?fresh=1" : ""}`), {
      headers,
      cache: "no-store",
    });
    if (response.status === 304) {
      return { notModified: true, orders: [], dataSourceDate: "", etag: options.etag || null, warnings: [] };
    }
    if (response.ok) {
      csvText = await response.text();
      etag = response.headers.get("ETag");
      success = true;
    } else {
      console.warn("Proxy sheet fetch returned status:", response.status);
    }
  } catch (error) {
    console.warn("Proxy sheet fetch failed:", error);
  }

  // 2. Plano B: direto do Google, se o servidor falhar
  if (!success) {
    try {
      const response = await fetch(DIRECT_SHEET_URL);
      if (!response.ok) throw new Error(`Direct spreadsheet fetch responded with status ${response.status}`);
      csvText = await response.text();
    } catch (fallbackError) {
      console.error("Direct sheet fetch fallback also failed:", fallbackError);
      throw new Error("Falha ao buscar dados de todas as fontes disponíveis");
    }
  }

  const parsed = await parseCsv(csvText);
  return { notModified: false, etag, ...parsed };
}

// ---------------------------------------------------------------------------
// Armazenamento no aparelho (IndexedDB + localStorage)
// ---------------------------------------------------------------------------

export interface SyncInfo {
  lastSync: string | null;
  dataSourceDate: string | null;
  etag: string | null;
}

export function getSyncInfo(): SyncInfo {
  return {
    lastSync: localStorage.getItem(LS_LAST_SYNC),
    dataSourceDate: localStorage.getItem(LS_SOURCE_DATE),
    etag: localStorage.getItem(LS_SHEET_ETAG),
  };
}

/** Registra que a sincronização terminou agora (mesmo quando a planilha não mudou). */
export function markSynced(): string {
  const now = new Date().toLocaleString("pt-BR");
  localStorage.setItem(LS_LAST_SYNC_TS, Date.now().toString());
  localStorage.setItem(LS_LAST_SYNC, now);
  return now;
}

export async function saveOrdersLocally(orders: Order[], dataSourceDate?: string, etag?: string | null) {
  // IndexedDB (via idb-keyval) aguenta bem mais dados que o localStorage
  await set("orders", orders);
  if (dataSourceDate) {
    localStorage.setItem(LS_SOURCE_DATE, dataSourceDate);
  }
  if (etag) {
    localStorage.setItem(LS_SHEET_ETAG, etag);
  } else {
    localStorage.removeItem(LS_SHEET_ETAG);
  }
}

export async function saveImageMapLocally(imageMap: Record<string, string>) {
  await set("imageMap", imageMap);
}

export async function getOrdersLocally(): Promise<Order[]> {
  const saved = await get<Order[]>("orders");
  return saved || [];
}

export async function getImageMapLocally(): Promise<Record<string, string>> {
  const saved = await get<Record<string, string>>("imageMap");
  return saved || {};
}

/** "10/19/26 5:06" (formato do Google) ou "2026-10-19 05:06:33" → "19/10/2026 às 05:06" */
export function formatSourceDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = parseSheetDate(value);
  if (!d) return value.trim();
  const hasTime = /\d:\d{2}/.test(value);
  return hasTime ? formatDateTime(d) : formatDate(d);
}
