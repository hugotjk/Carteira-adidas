import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 1. API: Fetch sheet data from Google Sheets proxy
  app.get("/api/sheet-data", async (req, res) => {
    try {
      const url = "https://docs.google.com/spreadsheets/d/16_hCfoGEpicwslIpUzxYZF8GYNVXCYsi/export?format=csv";
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
        }
      });
      if (!response.ok) {
        throw new Error(`Google Sheets responded with status ${response.status}`);
      }
      const csvText = await response.text();
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.send(csvText);
    } catch (err: any) {
      console.error("Server proxy error fetching sheet data:", err);
      res.status(500).json({ error: err.message || "Failed to fetch sheet data from upstream" });
    }
  });

  // 2. API: Fetch GitHub images proxy
  app.get("/api/github-images/:repo", async (req, res) => {
    try {
      const repo = req.params.repo;
      if (repo !== "adidas-fla" && repo !== "adidas") {
        return res.status(400).json({ error: "Invalid repository name" });
      }
      const url = `https://api.github.com/repos/hugotjk/${repo}/contents/`;
      const headers: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      };
      
      // Use premium token if declared to bypass GitHub API limits
      if (process.env.GITHUB_TOKEN) {
        headers["Authorization"] = `token ${process.env.GITHUB_TOKEN}`;
      }
      
      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`GitHub responded with status ${response.status} for repo ${repo}`);
      }
      const json = await response.json();
      res.json(json);
    } catch (err: any) {
      console.error(`Server proxy error fetching GitHub images for ${req.params.repo}:`, err);
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
