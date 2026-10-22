// Converte a planilha AMD (FW27) para src/data/fw27Amd.json.
// Uso: node scripts/amd-para-json.mjs caminho/AMD_FW27.xlsx
import fs from "node:fs";
import XLSX from "xlsx-js-style";

const arquivo = process.argv[2];
if (!arquivo) { console.error("Informe o arquivo: node scripts/amd-para-json.mjs AMD_FW27.xlsx"); process.exit(1); }
const wb = XLSX.read(fs.readFileSync(arquivo), { cellDates: true });
const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
const norm = (k) => String(k).replace(/\s+/g, " ").trim().toUpperCase();
const col = (r, nome) => { const k = Object.keys(r).find((x) => norm(x) === nome); return k === undefined ? "" : r[k]; };
const iso = (v) => {
  if (v instanceof Date) return new Date(v.getTime() - v.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const m = String(v).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : String(v).slice(0, 10);
};
const produtos = linhas
  .filter((r) => String(col(r, "ARTICLE")).trim())
  .map((r) => ({
    artigo: String(col(r, "ARTICLE")).trim().toUpperCase(),
    descricao: String(col(r, "LOCAL DESCRIPTION")).trim().toUpperCase(),
    pack: String(col(r, "PACK")).trim().toUpperCase() || "SEM PACK",
    tipo: String(col(r, "PROD TYPE")).trim().toUpperCase(),
    genero: String(col(r, "GENDER")).trim().toUpperCase(),
    idade: String(col(r, "AGE GROUP")).trim().toUpperCase(),
    tamanhos: String(col(r, "LOCAL SIZE")).split(",").map((t) => t.trim()).filter(Boolean),
    lancamento: iso(col(r, "LOCAL RID")),
    fim: iso(col(r, "LOCAL RED")),
    preco: Number(col(r, "RRP")) || 0,
    carryOver: String(col(r, "CARRY OVER")).trim().toUpperCase(),
  }));
fs.writeFileSync(new URL("../src/data/fw27Amd.json", import.meta.url), JSON.stringify(produtos, null, 1) + "\n");
console.log(produtos.length + " produtos gravados em src/data/fw27Amd.json");
