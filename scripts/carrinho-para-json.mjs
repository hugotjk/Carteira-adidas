// Lê um carrinho exportado do site adidas (abas Apparel/Hardware) e gera src/data/fw27Fornecedor.json:
// datas de entrega aceitas, e para cada artigo: nome, aba, data de lançamento, preço e EAN de cada tamanho.
// Uso: node scripts/carrinho-para-json.mjs caminho/con_xxx.xlsx
import fs from "node:fs";
import XLSX from "xlsx-js-style";

const arq = process.argv[2];
if (!arq) { console.error("Informe o arquivo do carrinho."); process.exit(1); }
const wb = XLSX.read(fs.readFileSync(arq));
const datas = new Set();
const artigos = {};
for (const aba of wb.SheetNames) {
  const linhas = XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, defval: null, raw: false });
  const h = linhas.findIndex((r) => r && r[0] === "Sold To");
  if (h < 0) continue;
  for (const r of linhas.slice(h + 1)) {
    if (!r || !r[1]) continue;
    const [, art, nome, ean, lanc, data, tam, pdv] = r;
    datas.add(String(data));
    const a = (artigos[art] = artigos[art] || { nome, aba, lancamento: String(lanc), preco: String(pdv), tamanhos: [], eans: {} });
    if (!a.tamanhos.includes(tam)) a.tamanhos.push(tam);
    a.eans[tam] = ean == null || ean === "" ? null : String(ean);
  }
}
const out = { datas: [...datas].sort(), artigos };
fs.writeFileSync(new URL("../src/data/fw27Fornecedor.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
console.log(out.datas.length + " datas, " + Object.keys(artigos).length + " artigos gravados em src/data/fw27Fornecedor.json");
