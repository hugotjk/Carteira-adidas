"""
Venda (e estoque, quando chegar) dos produtos de 2026 equivalentes a cada artigo FW27, por loja e tamanho.
Gera src/data/fw27VendaEstoque.json, usado na Sugestão (coluna "Venda × Estoque").

Uso:
  python3 scripts/vendaestoque-para-json.py <pasta com VENDAS_MES_DBSLEEK.csv> [ESTOQUE.csv]

ESTOQUE.csv (opcional): colunas LOJA, REFERENCIA_FORNECEDOR, TAMANHO, ESTOQUE (peças hoje).
Venda = peças vendidas jun–out/2026 (o que temos no banco).
"""
import json, re, sys, unicodedata
from pathlib import Path
import pandas as pd

# Artigo FW27 → referências reais de 2026 que servem de comparação (mesma linha: masc, fem, inf).
REFS = {
    # HOME (torcedor masc = com e sem Betano)
    "KG4974": ["JM5652"], "LH9131": ["JM5651", "LH8017"], "KG4983": ["JZ8871"], "KG4984": ["JZ8872"],
    # AWAY
    "LH9134": ["JM5653", "LH8018"], "KG4990": ["JZ8882"], "KG4992": ["JZ8883"],
    # THIRD
    "LY3629": ["JZ3143"], "LY3627": ["JZ3141"], "LK9161": ["JZ3144"], "KG0063": ["JZ3148"], "KG0064": ["JZ3145"],
    "LY3628": ["JZ3142"], "LY3673": ["JM5649", "JM5650"], "KS4902": ["JM5649", "JM5650"], "KS7469": ["JZ8869", "JZ8884"],
    # FANSHIRT (em 2026 só existiu o Fanshirt I)
    "KG4994": ["JZ8886"], "KG4985": ["JZ8873"], "KG4988": ["JZ8876"],
    "LL0651": ["JZ8886"], "LL0649": ["JZ8873"], "LL0650": ["JZ8876"],
    "MA3762": ["JZ8886"], "MA3763": ["JZ8873"], "MA3764": ["JZ8876"],
    # TIROTECH = Tiro Travel 2026 (fem/inf: treino 2026)
    "KT7307": ["KG9688"], "KT7316": ["JZ2377"], "KT7313": ["JZ2373"], "LH0471": ["KG9687"], "KT7308": [],
    "KT7314": ["KG9689"], "KT7310": ["JZ6365"], "KT7311": [], "KT7315": ["KG9686"],
    # ICON = metade Tirotech (Tiro Travel) + metade DNA 2026
    "LE6198": ["KG9688", "JZ2806"], "LE6196": ["KG9695"], "LK1779": ["KG9687", "KG9707"], "MF9669": ["KG9689", "JZ2808"], "LE6197": ["JZ2809"],
    # ORIGINALS RMX = Originals 2026; OG GR = Graphic 2026
    "LE6195": ["JZ2742"], "LE6194": ["JZ2745"], "LE6191": ["JZ2741"], "LE6192": ["JZ2744"], "LD3710": ["KG9690", "JZ2748", "JZ2747"], "LG5433": [],
    # GRAPHIC
    "LD3711": ["KG9690"], "LD3715": [],
    # POLIAMIDAS
    "ME2493": ["KU4586"], "ME2494": ["KU4592"], "ME2495": ["KU4581"], "ME2496": ["KU4591"],
    "ME2491": ["KU4589"], "ME2492": ["KU4596"], "LI1199": [], "LI1207": [],
    # BASQUETE
    "LY7247": ["KT8968"], "LZ6527": ["KT8971"], "LY7249": ["KT8969"], "LZ6525": ["KT8970"],
    # BUCKET
    "KY3172": ["KD5141"],
    # SPECIAL (fora da AMD 30/10; fica para se voltar)
    "MA3766": ["KZ3128"], "MA3765": ["KX3399"], "MA3767": ["KX3406"],
}

def canon(n):
    n = unicodedata.normalize("NFD", str(n).upper()); n = "".join(c for c in n if not unicodedata.combining(c))
    n = re.sub(r"[-_.]", " ", n); n = re.sub(r"\bNAO\s*USAR\b", " ", n); n = re.sub(r"\s+", " ", n).strip()
    if re.search(r"\bECOMM\b", n): n = re.sub(r"\s+", " ", re.sub(r"(\D)2\b", r"\1", n)).strip()
    return {"ADIDAS FLA": "GAVEA FLA"}.get(n, n)
TAM = {"PPP": "2XS", "PP": "XS", "P": "S", "G": "L", "GG": "XL", "2G": "2XL", "XXL": "2XL", "3G": "3XL", "4G": "4XL", "7-8": "7-8A"}
def tam(t):
    t = str(t).strip().upper()
    if re.match(r"^OPF", t): t = "OSF" + t[3:]
    return TAM.get(t, t)

def tabela(df, col):
    out = {}
    ref2art = {}
    for art, refs in REFS.items():
        for r in refs: ref2art.setdefault(r, []).append(art)
    df = df[df.REFERENCIA_FORNECEDOR.isin(ref2art)].copy()
    df["LOJA_APP"] = df.LOJA.map(canon); df["TAM"] = df.TAMANHO.map(tam)
    g = df.groupby(["REFERENCIA_FORNECEDOR", "LOJA_APP", "TAM"])[col].sum().reset_index()
    for _, r in g.iterrows():
        q = int(round(r[col]))
        if not q: continue
        for art in ref2art[r.REFERENCIA_FORNECEDOR]:
            d = out.setdefault(art, {}).setdefault(r.LOJA_APP, {})
            d[r.TAM] = d.get(r.TAM, 0) + q
    return out

pasta = Path(sys.argv[1])
v = pd.read_csv(pasta / "VENDAS_MES_DBSLEEK.csv", dtype={"TAMANHO": str})
v = v[(v.MES >= "2026-06") & (v.MES <= "2026-10")]
saida = {"periodo": "venda jun–out/2026", "refs": REFS, "venda": tabela(v, "PECAS")}
if len(sys.argv) > 2:
    e = pd.read_csv(sys.argv[2], dtype={"TAMANHO": str})
    saida["estoque"] = tabela(e, "ESTOQUE")
    saida["periodo"] += " · estoque " + Path(sys.argv[2]).stem
destino = Path(__file__).resolve().parent.parent / "src" / "data" / "fw27VendaEstoque.json"
json.dump(saida, open(destino, "w"), ensure_ascii=False, separators=(",", ":"))
print(destino, destino.stat().st_size, "bytes;", len(saida["venda"]), "artigos com venda")
