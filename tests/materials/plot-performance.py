"""只根据已完成实测记录生成论文性能表图，不填入推测结果。"""
from pathlib import Path
import argparse, json, csv, statistics
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.font_manager import FontProperties

parser=argparse.ArgumentParser()
parser.add_argument('results')
args=parser.parse_args()
source=Path(args.results).resolve()
data=json.loads(source.read_text(encoding='utf-8'))
if not data.get('complete') or len(data.get('records',[]))!=16:
    raise SystemExit('基准尚未完成16组，不生成最终性能图')
out=Path(__file__).resolve().parents[3]/'论文与答辩材料'
font=FontProperties(fname='C:/Windows/Fonts/msyh.ttc')
plt.rcParams['font.family']=font.get_name()
plt.rcParams['axes.unicode_minus']=False
labels={'metrics':'八项指标','trend':'六个月趋势','channels':'渠道拆解','admissions':'招生分析'}
records=data['records']
summary=[]
for record in records:
    times=[x for s in record['samples'] for x in s['requests']]
    ordered=sorted(times)
    summary.append({'query':record['query'],'并发':record['concurrency'],'缓存':record['cache'],'重复轮数':len(record['samples']),'请求数':len(times),'平均毫秒':round(statistics.mean(times),2),'中位毫秒':round(statistics.median(times),2),'P95毫秒':ordered[max(0,__import__('math').ceil(.95*len(times))-1)],'应用采样峰值MiB':round(max(s['rssPeakBytes'] for s in record['samples'])/1024**2,2),'与基准一致':record['matchesBaseline']})
with (out/'表'/'经营查询性能_实际测量.csv').open('w',encoding='utf-8-sig',newline='') as f:
    writer=csv.DictWriter(f,fieldnames=list(summary[0]));writer.writeheader();writer.writerows(summary)
fig,axes=plt.subplots(2,2,figsize=(13,8),layout='constrained')
for ax,(kind,title) in zip(axes.flat,labels.items()):
    rows=[r for r in records if r['query']==kind]
    values=[[x for s in r['samples'] for x in s['requests']] for r in rows]
    ax.boxplot(values,tick_labels=[('冷组' if r['cache']=='cold' else '暖组')+'\n并发'+str(r['concurrency']) for r in rows],patch_artist=True,boxprops={'facecolor':'#d8e8ff'},medianprops={'color':'#264e9b'})
    ax.set_title(title,fontweight='bold');ax.set_ylabel('单请求耗时（毫秒）');ax.grid(axis='y',alpha=.2)
fig.suptitle('独立模拟经营事件 '+format(data['fixture']['eventRows'],',')+' 条：数据库聚合实测',fontsize=16)
fig.savefig(out/'图'/'05_经营查询耗时.png',dpi=200)
fig.savefig(out/'图'/'05_经营查询耗时.svg')
plt.close(fig)
fig,ax=plt.subplots(figsize=(10,5),layout='constrained')
for i,concurrency in enumerate([1,5]):
    values=[max(s['rssPeakBytes'] for r in records if r['query']==k and r['concurrency']==concurrency for s in r['samples'])/1024**2 for k in labels]
    ax.bar([x+(i-.5)*.34 for x in range(4)],values,width=.34,label='并发'+str(concurrency),color=['#3478f6','#8561db'][i])
ax.set_xticks(range(4),list(labels.values()));ax.set_ylabel('查询进程采样峰值 RSS（MiB）');ax.set_title('应用内存实测（独立查询进程，20毫秒采样）');ax.legend();ax.grid(axis='y',alpha=.2)
fig.savefig(out/'图'/'06_应用查询内存.png',dpi=200)
fig.savefig(out/'图'/'06_应用查询内存.svg')
plt.close(fig)
notes=['# 性能实测说明','',f"固定种子20261013，独立_test数据集，实际行为事件{data['fixture']['eventRows']:,}条。16组，每组5轮；并发1组有5次请求，并发5组有25次请求。",'',*data.get('notes',[]),'','冷组清除ClickHouse mark/uncompressed缓存并使用新应用进程，没有清空操作系统页缓存。暖组先预热。箱线图反映实测分布，P95采用排序后向上取位。没有推测生产机构容量或服务保障值。',f"全部组与独立核验基准一致：{data.get('passed')}。",'', '真人评分、采用率及经营改善不在性能实验中产生。']
(out/'表'/'性能实测说明.md').write_text('\n'.join(notes)+'\n',encoding='utf-8')
print('已依据实际16组测量生成性能CSV与两组PNG/SVG图')
