import express from "express";
import compression from "compression";
import crypto from "crypto";
import path from "path";
import { createServer as createViteServer } from "vite";

const SHEET_URL = "https://docs.google.com/spreadsheets/d/16_hCfoGEpicwslIpUzxYZF8GYNVXCYsi/export?format=csv";
const IMAGE_REPOS = ["adidas-fla", "adidas"];

// Por quanto tempo o servidor reaproveita a planilha/lista de fotos já baixada
// antes de buscar de novo no Google/GitHub.
const SHEET_CACHE_MS = 5 * 60 * 1000;   // 5 minutos
const IMAGES_CACHE_MS = 10 * 60 * 1000; // 10 minutos

interface CacheEntry<T> {
  value: T;
  fetchedAt: number;
}

/**
 * Guarda o último resultado em memória e evita buscas repetidas ao mesmo tempo
 * (vários usuários abrindo o app juntos geram uma única busca).
 */
function createCachedFetcher<T>(maxAgeMs: number, load: () => Promise<T>) {
  let cache: CacheEntry<T> | null = null;
  let inFlight: Promise<T> | null = null;

  return async (force = false): Promise<T> => {
    if (!force && cache && Date.now() - cache.fetchedAt < maxAgeMs) return cache.value;
    if (inFlight) return inFlight;

    inFlight = load()
      .then((value) => {
        cache = { value, fetchedAt: Date.now() };
        return value;
      })
      .finally(() => {
        inFlight = null;
      });

    try {
      return await inFlight;
    } catch (err) {
      // Se a busca falhar mas houver uma versão anterior, usa ela
      if (cache) {
        console.warn("Upstream fetch failed, serving cached copy:", err);
        return cache.value;
      }
      throw err;
    }
  };
}

const getSheet = createCachedFetcher(SHEET_CACHE_MS, async () => {
  const response = await fetch(SHEET_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/csv,text/plain,*/*",
    },
  });
  if (!response.ok) {
    throw new Error(`Google Sheets responded with status ${response.status}`);
  }
  const csv = await response.text();
  // "Assinatura" do conteúdo: muda só quando a planilha muda
  const etag = `"${crypto.createHash("sha1").update(csv).digest("hex")}"`;
  return { csv, etag };
});

const imageFetchers: Record<string, (force?: boolean) => Promise<{ name: string; type: string }[]>> = {};
for (const repo of IMAGE_REPOS) {
  imageFetchers[repo] = createCachedFetcher(IMAGES_CACHE_MS, async () => {
    // A API "git/trees" lista todos os arquivos (a API "contents" para em 1.000).
    const url = `https://api.github.com/repos/hugotjk/${repo}/git/trees/main`;
    const headers: Record<string, string> = {
      "User-Agent": "carteira-adidas",
      "Accept": "application/vnd.github+json",
    };
    // Token opcional para aumentar o limite de consultas do GitHub
    if (process.env.GITHUB_TOKEN) {
      headers["Authorization"] = `token ${process.env.GITHUB_TOKEN}`;
    }
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`GitHub responded with status ${response.status} for repo ${repo}`);
    }
    const json: any = await response.json();
    if (json.truncated) {
      console.warn(`GitHub tree listing for ${repo} was truncated`);
    }
    // Mesmo formato que o app já usava: [{ name, type: "file" }]
    return (json.tree || []).map((item: any) => ({
      name: item.path,
      type: item.type === "blob" ? "file" : item.type,
    }));
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Compacta as respostas: a planilha (~50 MB em texto) cai para poucos MB
  app.use(compression());

  // 1. API: planilha do Google Drive
  app.get("/api/sheet-data", async (req, res) => {
    try {
      const { csv, etag } = await getSheet(req.query.fresh === "1");
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", "no-cache");
      // Se o aparelho já tem esta mesma versão, não manda nada de novo
      if (req.headers["if-none-match"] === etag) {
        return res.status(304).end();
      }
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.send(csv);
    } catch (err: any) {
      console.error("Server proxy error fetching sheet data:", err);
      res.status(500).json({ error: err.message || "Failed to fetch sheet data from upstream" });
    }
  });

  // 2. API: lista de fotos dos repositórios do GitHub
  app.get("/api/github-images/:repo", async (req, res) => {
    const repo = req.params.repo;
    const fetcher = imageFetchers[repo];
    if (!fetcher) {
      return res.status(400).json({ error: "Invalid repository name" });
    }
    try {
      res.json(await fetcher(req.query.fresh === "1"));
    } catch (err: any) {
      console.error(`Server proxy error fetching GitHub images for ${repo}:`, err);
      res.status(500).json({ error: err.message || "Failed to fetch GitHub images from upstream" });
    }
  });

  // 3. API: Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // 4. Vite middleware for asset serving & Single Page App routing
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    // Arquivos com "hash" no nome podem ficar guardados no aparelho por bastante tempo
    app.use("/assets", express.static(path.join(distPath, "assets"), { maxAge: "30d", immutable: true }));
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
