"""
Gera src/data/fw27Vendas.json a partir das vendas do DBSleek (aba VENDAS_MES, PRODUTOS)
e da lista loja → gestor → código adidas (fw27/loja-gestor.csv do projeto).

Uso:
  python3 scripts/vendas-para-json.py <pasta com VENDAS_MES_DBSLEEK.csv, PRODUTOS_DBSLEEK.csv, loja-gestor.csv>

O arquivo sai com percentuais e, por loja, o R$ vendido jun–out/2026 (base da verba sugerida):
  lojas      → por loja: gestor, código adidas, % nas vendas jun–out/2026 (pct), % nos últimos 90 dias
               ago–out/2026 (pct90) e R$ vendido jun–out/2026 (venda)
  subgrupos  → % de cada subgrupo da AMD nas vendas de jun–out/2026 (referência)
  curva      → peso de cada mês (jun–nov) pelas vendas de 2026 (ano de Copa, como 2027)
  grade      → peso de cada tamanho por perfil (MASC, FEM, KIDS, MINI, MEIAO) e por loja (2025+2026)
"""
import json, re, sys, unicodedata, calendar
from datetime import date
from pathlib import Path
import pandas as pd

pasta = Path(sys.argv[1])
saida = Path(__file__).resolve().parent.parent / "src" / "data" / "fw27Vendas.json"

def canon(n):
    """Mesma regra de src/services/fw27Lojas.ts (lojaCanonica)."""
    n = unicodedata.normalize("NFD", str(n).upper())
    n = "".join(c for c in n if not unicodedata.combining(c))
    n = re.sub(r"[-_.]", " ", n)
    n = re.sub(r"\bNAO\s*USAR\b", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    if re.search(r"\bECOMM\b", n):
        n = re.sub(r"\s+", " ", re.sub(r"(\D)2\b", r"\1", n)).strip()
    return n

# GAVEA FLA e ADIDAS FLA são uma loja só (mesmo código).
JUNTAR = {"ADIDAS FLA": "GAVEA FLA"}
lojaApp = lambda n: JUNTAR.get(canon(n), canon(n))

# Tamanho do PDV → tamanho da AMD
TAM = {"PPP": "2XS", "PP": "XS", "P": "S", "G": "L", "GG": "XL", "2G": "2XL", "XXL": "2XL", "3G": "3XL", "4G": "4XL", "7-8": "7-8A"}
tam = lambda t: TAM.get(str(t).strip().upper(), str(t).strip().upper())
MINI = {"1824", "2-3A", "3-4A", "4-5A", "6-7A"}
KIDS = {"5-6A", "7-8A", "910A", "1112", "1314", "1516"}
ADULTO = {"2XS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"}

v = pd.read_csv(pasta / "VENDAS_MES_DBSLEEK.csv", dtype={"TAMANHO": str})
p = pd.read_csv(pasta / "PRODUTOS_DBSLEEK.csv")
lg = pd.read_csv(pasta / "loja-gestor.csv", dtype=str).fillna("")

v["LOJA_APP"] = v.LOJA.map(lojaApp)
v["TAM"] = v.TAMANHO.map(tam)
v = v.merge(p, on="REFERENCIA_FORNECEDOR", how="left")

# ---------- lojas ----------
lg["LOJA_APP"] = lg.LOJA.map(lojaApp)
lista = lg.drop_duplicates("LOJA_APP")
v26 = v[(v.MES >= "2026-06") & (v.MES <= "2026-10")]
venda = v26[v26.LOJA_APP.isin(set(lista.LOJA_APP))].groupby("LOJA_APP").VENDA.sum()
tot = venda.sum()
# últimos 90 dias: ago, set e out/2026
v90 = v[(v.MES >= "2026-08") & (v.MES <= "2026-10")]
venda90 = v90[v90.LOJA_APP.isin(set(lista.LOJA_APP))].groupby("LOJA_APP").VENDA.sum()
tot90 = venda90.sum()
lojas = []
for _, r in lista.iterrows():
    lojas.append({
        "nome": r.LOJA_APP, "gestor": r.GESTOR.strip(), "codAdidas": r.COD_ADIDAS.strip(),
        "pct": round(float(venda.get(r.LOJA_APP, 0)) / tot * 100, 4),
        "pct90": round(float(venda90.get(r.LOJA_APP, 0)) / tot90 * 100, 4),
        # R$ vendido jun–out/2026 (base da verba sugerida: + 10%)
        "venda": round(float(venda.get(r.LOJA_APP, 0)), 2),
    })
lojas.sort(key=lambda x: -x["pct"])

# ---------- subgrupos (referência) ----------
SUBS = ["HOME", "AWAY", "THIRD", "FANSHIRT", "SPECIAL", "TIROTECH", "POLIAMIDAS", "ICON", "ORIGINALS", "GRAPHIC", "BASQUETE"]
sg = v26.groupby("SUBGRUPO").VENDA.sum()
sgTot = sum(float(sg.get(s, 0)) for s in SUBS)
subgrupos = {s: round(float(sg.get(s, 0)) / sgTot * 100, 2) for s in SUBS}

# ---------- curva ----------
pecas = v.groupby("MES").PECAS.sum()
ultimoDia = 23  # vendas de out/2026 vão até 23/10
out26 = float(pecas["2026-10"]) * 31 / ultimoDia
meses = {"06": float(pecas["2026-06"]), "07": float(pecas["2026-07"]), "08": float(pecas["2026-08"]),
         "09": float(pecas["2026-09"]), "10": out26,
         # nov/2026 ainda não aconteceu: outubro de 2026 × (nov/out de 2025)
         "11": out26 * float(pecas["2025-11"]) / float(pecas["2025-10"])}
s = sum(meses.values())
curva = {m: round(q / s * 100, 1) for m, q in meses.items()}

# ---------- grade ----------
def perfil(row):
    t, g, d, l = row.TAM, str(row.GRUPO), str(row.DESCRICAO), str(row.LINHA)
    if g in ("MEIAO", "MEIA") or "MEIAO" in d: return "MEIAO"
    if t in MINI or g == "MINI": return "MINI"
    if t in KIDS or l == "INFANTO": return "KIDS"
    if t not in ADULTO: return None  # boné, bola, chuteira…
    return "FEM" if l == "FEMININA" else "MASC"

base = v.groupby(["LOJA_APP", "REFERENCIA_FORNECEDOR", "TAM", "GRUPO", "DESCRICAO", "LINHA"], dropna=False).PECAS.sum().reset_index()
base["PERFIL"] = base.apply(perfil, axis=1)
base = base[base.PERFIL.notna() & (base.PECAS > 0)]
grade = {}
for pf, d in base.groupby("PERFIL"):
    geral = d.groupby("TAM").PECAS.sum()
    geral = geral[geral >= geral.sum() * 0.001]
    g = {"_todas": {t: int(round(q / geral.sum() * 1000)) for t, q in geral.items()}}
    for loja, dl in d[d.LOJA_APP.isin(set(lista.LOJA_APP))].groupby("LOJA_APP"):
        q = dl.groupby("TAM").PECAS.sum().reindex(geral.index).fillna(0)
        # Loja com pouca venda puxa para a grade geral (30 peças "emprestadas").
        K = 30
        mix = (q + K * geral / geral.sum())
        g[loja] = {t: int(round(x / mix.sum() * 1000)) for t, x in mix.items()}
    grade[pf] = g

json.dump({
    "fonte": "DBSleek · vendas ativas (sem tipo 6) · lojas jun–out/2026 · grade jun–nov/2025 + jun–out/2026",
    "geradoEm": date.today().isoformat(),
    "lojas": lojas, "subgrupos": subgrupos, "curva": curva, "grade": grade,
}, open(saida, "w"), ensure_ascii=False, separators=(",", ":"))
print("lojas", len(lojas), "com venda", sum(1 for l in lojas if l["pct"] > 0))
print("subgrupos", subgrupos)
print("curva", curva)
print({k: len(x) for k, x in grade.items()}, {k: x["_todas"] for k, x in grade.items()})
print(saida, saida.stat().st_size, "bytes")
