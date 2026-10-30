"""
Peso de cada subgrupo e de cada produto da AMD FW27, pelo produto equivalente vendido em 2026.
Uso: python3 scripts/comparaveis-para-json.py <pasta com VENDAS_MES_DBSLEEK.csv>
"""
import pandas as pd, json
import sys
v=pd.read_csv(sys.argv[1]+'/VENDAS_MES_DBSLEEK.csv',dtype={'TAMANHO':str})
def sh(refs,a='2026-06',b='2026-10',fator=1.0):
    x=v[(v.MES>=a)&(v.MES<=b)]
    return x[x.REFERENCIA_FORNECEDOR.isin(refs)].VENDA.sum()/x.VENDA.sum()*100*fator
FEM_CAM=sh(['JZ2377'])/sh(['JZ2374','KB1849']); INF_CAM=sh(['JZ2373'])/sh(['JZ2374','KB1849'])
FEM_SH=sh(['JZ6365'])/sh(['JZ6367']); FEM_JAQ=sh(['JN0883'],'2025-08','2025-11')/sh(['JN0880'],'2025-08','2025-11')
print('fatores fem camisa %.2f inf camisa %.2f fem short %.2f fem jaqueta %.2f'%(FEM_CAM,INF_CAM,FEM_SH,FEM_JAQ))
fan={'M':sh(['JZ8886','JG8781']),'F':sh(['JZ8873']),'I':sh(['JZ8876'])}
kit={'HOME':sh(['JM5651','LH8017']),'AWAY':sh(['JM5653','LH8018']),'THIRD':sh(['JZ3141'])}
RAZ={'M':sh(['JZ8886'])/sh(['JM5651','LH8017']),'F':sh(['JZ8873'])/sh(['JZ8871']),'I':sh(['JZ8876'])/sh(['JZ8872'])}
TORC={'HOME':{'M':sh(['JM5651','LH8017']),'F':sh(['JZ8871']),'I':sh(['JZ8872'])},'AWAY':{'M':sh(['JM5653','LH8018']),'F':sh(['JZ8882']),'I':sh(['JZ8883'])},'THIRD':{'M':sh(['JZ3141']),'F':sh(['JZ3144']),'I':sh(['JZ3145'])}}
TORC_TOT={k:sum(v.values()) for k,v in TORC.items()}
# Acessórios do kit: mesma lógica do fanshirt — peso na Home 2026 (sobre a torcedor masc+fem+inf) × torcedor do kit
RAZ_MEIAO=sh(['JM5649'])/TORC_TOT['HOME']; RAZ_MINI=sh(['JZ8869'])/TORC_TOT['HOME']
# Jaqueta fem Tirotech: média fem/masc da própria linha (camisa e short); short inf: mesma proporção da camisa inf
FEM_JAQ_TT=(FEM_CAM+FEM_SH)/2
# Short SH7 Poliamidas: short/camisa do treino 2026, sobre a média das 2 camisas M
SHORT_CAM_TREINO=sh(['JZ6367'])/sh(['JZ2374','KB1849'])
print('meião/home %.3f mini/home %.3f jaq fem TT %.2f short/camisa treino %.2f'%(RAZ_MEIAO,RAZ_MINI,FEM_JAQ_TT,SHORT_CAM_TREINO))
arq=lambda s,g: TORC[s][g]*RAZ[g]
print('fanshirt/home 2026', {k:round(x,3) for k,x in RAZ.items()})
TT=('2026-07','2026-10'); IC=('2025-08','2025-11'); POS=('2026-08','2026-10')
M={
'HOME':[('KG4974','Pro (masc)','Authentic I 2026',sh(['JM5652'])),('LH9131','Torcedor masc','Manto I 2026 + c/ Betano',sh(['JM5651','LH8017'])),
 ('KG4983','Torcedor fem','Manto I fem 2026',sh(['JZ8871'])),('KG4984','Torcedor inf','Manto I inf 2026',sh(['JZ8872']))],
'AWAY':[('LH9134','Torcedor masc','Manto II 2026 + c/ Betano',sh(['JM5653','LH8018'])),('KG4990','Torcedor fem','Manto II fem 2026',sh(['JZ8882'])),('KG4992','Torcedor inf','Manto II inf 2026',sh(['JZ8883']))],
'THIRD':[('LY3629','Pro (masc)','Authentic III 2026',sh(['JZ3143'])),('LY3627','Torcedor masc','Manto III 2026 c/ Betano',sh(['JZ3141'])),('LK9161','Feminina V','Manto III fem 2026',sh(['JZ3144'])),
 ('KG0063','Cropped','Cropped III 2026',sh(['JZ3148'])),('KG0064','Infantil','Manto III inf 2026',sh(['JZ3145'])),('LY3628','Short torcedor','Shorts III 2026',sh(['JZ3142'])),
 ('LY3673','Meião','Torcedor III × meião/home 2026',TORC_TOT['THIRD']*RAZ_MEIAO),('KS4902','Meião Pro','Torcedor III × meião/home 2026',TORC_TOT['THIRD']*RAZ_MEIAO),('KS7469','Mini kit','Torcedor III × mini kit/home 2026',TORC_TOT['THIRD']*RAZ_MINI)],
'FANSHIRT':[('KG4994','Fanshirt masc','Fanshirt masc torcedor I × fanshirt/home 2026',arq('HOME','M')),('KG4985','Fanshirt fem','Fanshirt fem torcedor I × fanshirt/home 2026',arq('HOME','F')),('KG4988','Fanshirt inf','Fanshirt inf torcedor I × fanshirt/home 2026',arq('HOME','I')),('LL0651','Fanshirt masc','Fanshirt masc torcedor II × fanshirt/home 2026',arq('AWAY','M')),('LL0649','Fanshirt fem','Fanshirt fem torcedor II × fanshirt/home 2026',arq('AWAY','F')),('LL0650','Fanshirt inf','Fanshirt inf torcedor II × fanshirt/home 2026',arq('AWAY','I')),('MA3762','Fanshirt masc','Fanshirt masc torcedor III × fanshirt/home 2026',arq('THIRD','M')),('MA3763','Fanshirt fem','Fanshirt fem torcedor III × fanshirt/home 2026',arq('THIRD','F')),('MA3764','Fanshirt inf','Fanshirt inf torcedor III × fanshirt/home 2026',arq('THIRD','I'))],
'SPECIAL':[('MA3766','Masc','Fanshirt WC Brasil masc (ago–out/26, depois da Copa)',sh(['KZ3128'],*POS)),('MA3765','Fem','Fanshirt WC Brasil fem (ago–out/26)',sh(['KX3399'],*POS)),('MA3767','Inf','Fanshirt WC Brasil inf (ago–out/26)',sh(['KX3406'],*POS))],
'TIROTECH':[('KT7307','Camisa masc','Camiseta TT 2026 (jul–out)',sh(['KG9688'],*TT)),('KT7316','Camisa fem','Camiseta TT × %.0f%% (fem/masc do treino)'%(FEM_CAM*100),sh(['KG9688'],*TT)*FEM_CAM),
 ('KT7313','Camisa inf','Camiseta TT × %.0f%% (inf/masc do treino)'%(INF_CAM*100),sh(['KG9688'],*TT)*INF_CAM),('LH0471','Jaqueta masc','Jaqueta corta-vento TT 2026',sh(['KG9687'],*TT)),
 ('KT7308','Jaqueta fem','Jaqueta TT × %.0f%% (fem/masc média da Tirotech: camisa e short)'%(FEM_JAQ_TT*100),sh(['KG9687'],*TT)*FEM_JAQ_TT),('KT7314','Short masc','Shorts TT 2026',sh(['KG9689'],*TT)),
 ('KT7310','Short fem','Shorts TT × %.0f%% (fem/masc do short treino)'%(FEM_SH*100),sh(['KG9689'],*TT)*FEM_SH),('KT7311','Short inf','Shorts TT × %.0f%% (mesma proporção da camisa inf)'%(INF_CAM*100),sh(['KG9689'],*TT)*INF_CAM),
 ('KT7315','Calça masc','Calça TT 2026',sh(['KG9686'],*TT))],
'ICON':[('LE6198','Camisa masc','½ Tirotech (camiseta TT) + ½ DNA (camiseta)',0.5*sh(['KG9688'],*TT)+0.5*sh(['JZ2806'])),
 ('LE6196','Camisa inf','½ Tirotech inf + ½ DNA camiseta inf',0.5*sh(['KG9688'],*TT)*INF_CAM+0.5*sh(['KG9695'])),
 ('LK1779','Jaqueta masc','½ Tirotech (jaqueta TT) + ½ DNA (jaqueta)',0.5*sh(['KG9687'],*TT)+0.5*sh(['KG9707'])),
 ('MF9669','Short masc','½ Tirotech (shorts TT) + ½ DNA (shorts)',0.5*sh(['KG9689'],*TT)+0.5*sh(['JZ2808'])),
 ('LE6197','Vestido fem','½ Tirotech camisa fem + ½ DNA camiseta fem',0.5*sh(['KG9688'],*TT)*FEM_CAM+0.5*sh(['JZ2809']))],
'ORIGINALS':[('LE6195','Camisa RMX (jersey)','Camiseta Originals 2026',sh(['JZ2742'])),('LE6194','Jaqueta RMX','Jaqueta Originals 2026',sh(['JZ2745'])),('LE6191','Calça RMX','Calça Originals 2026',sh(['JZ2741'])),
 ('LE6192','Short RMX','Shorts Originals 2026',sh(['JZ2744'])),('LD3710','Camisa OG GR masc','Média das camisetas Graphic 2026',sh(['KG9690','JZ2748','JZ2747'])/3),('LG5433','Camisa OG GR inf','Graphic média × %.0f%%'%(INF_CAM*100),sh(['KG9690','JZ2748','JZ2747'])/3*INF_CAM)],
'GRAPHIC':[('LD3711','Camisa GR masc','Camiseta SZN GR 2026',sh(['KG9690'])),('LD3715','Camisa GR inf','Camiseta SZN GR × %.0f%%'%(INF_CAM*100),sh(['KG9690'])*INF_CAM)],
'POLIAMIDAS':[('ME2493','Camisa M cor 1','Tshirt Poliamidas M ruby',sh(['KU4586'])),('ME2494','Camisa M cor 2','Tshirt Poliamidas M black',sh(['KU4592'])),
 ('ME2495','Camisa W cor 1','Camiseta fem Poliamidas ruby',sh(['KU4581'])),('ME2496','Camisa W cor 2','Camiseta fem Poliamidas black',sh(['KU4591'])),
 ('ME2491','Regata M cor 1','Regata Poliamidas ruby',sh(['KU4589'])),('ME2492','Regata M cor 2','Regata Poliamidas black',sh(['KU4596'])),
 ('LI1199','Short SH7 cor 1','Média camisas M × %.0f%% (short/camisa do treino 2026)'%(SHORT_CAM_TREINO*100),sh(['KU4586','KU4592'])/2*SHORT_CAM_TREINO),('LI1207','Short SH7 cor 2','Média camisas M × %.0f%% (short/camisa do treino 2026)'%(SHORT_CAM_TREINO*100),sh(['KU4586','KU4592'])/2*SHORT_CAM_TREINO)],
'BUCKET':[('KY3172','Bucket','Bucket SS26 (KD5141)',sh(['KD5141']))],
'BASQUETE':[('LY7247','Regata I','Regata basquete I 2026',sh(['KT8968'])),('LZ6527','Regata II','Regata basquete II 2026',sh(['KT8971'])),('LY7249','Bermuda I','Short basquete I 2026',sh(['KT8969'])),('LZ6525','Bermuda II','Short basquete II 2026',sh(['KT8970']))],
}
tot=sum(x[3] for l in M.values() for x in l)
out={}
for s,l in M.items():
    st=sum(x[3] for x in l); out[s]={'pct':st/tot*100,'base':st,'itens':[{'artigo':a,'item':i,'comparavel':c,'base':b,'pctSub':b/st*100} for a,i,c,b in l]}
    print(f'{s:11s} base {st:6.3f}  sugerido {st/tot*100:5.1f}%')
    for a,i,c,b in l: print(f'    {a} {i:22s} {b:6.3f} ({b/st*100:4.1f}% do subgrupo)  ← {c}')
import sys
from pathlib import Path
destino=Path(__file__).resolve().parent.parent/'src'/'data'/'fw27Comparaveis.json'
json.dump({'fonte':'DBSleek: produto FW27 × equivalente 2026 (jun–out/26); Tiro Travel jul–out/26; Icon ago–nov/25; Special = WC Brasil ago–out/26; Fanshirt = torcedor do kit × (fanshirt/home 2026)',
  'subgrupos':{k:round(x['pct'],2) for k,x in out.items()},
  'produtos':{i['artigo']:round(i['base'],4) for x in out.values() for i in x['itens']}},open(destino,'w'),ensure_ascii=False,indent=1)
print(destino)
