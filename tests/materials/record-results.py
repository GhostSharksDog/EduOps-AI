# -*- coding: utf-8 -*-
"""整理已完成的验收证据，不生成主观评分。"""
from pathlib import Path
import json, statistics, shutil
root=Path('tests/artifacts/research-qa')
project=Path(__file__).resolve().parents[2]
materials=project.parent/'论文与答辩材料'
r=json.loads((root/'operations-performance/results.json').read_text(encoding='utf-8'))
lines=['# 本轮实际验收与结果','', '记录日期：2026年10月13日。正常项目只追加两项可空复核字段及索引，已有账号、数据、知识、已发布标签、人群和历史任务保留。','', '| 检查 | 本轮实际结果 |','|---|---|','| 类型、模块与生产构建 | 通过；1058个源码文件；89个客户端JS块未发现密钥变量或数据库仓储标记 |','| 单元与原有领域回归 | 245项单元、2500项回归通过 |','| 专用数据库 | 68项通过，包含SQL与纯计算8范围对照、机构隔离和JSONB分页 |','| 既有API与ClickHouse集成 | 235项通过 |','| 标签与完整页面流程 | 10组通过，两条流程分别46人、38人；20张四尺寸截图，浏览器异常0 |','| 新研究与复核API | 9组研究检查、4组量化复核通过；评分与模型故障注入只在_test |','| 真实云模型 | 两个成功冻结报告及三方案对照已生成；第一次失败报告仍保存，不自动评分 |','| 最终生产页面 | 7组只读检查、28张截图；失败样本入口最终版再次核对 |','', '## 百万级经营计算实测','',f"独立固定种子数据共{r['fixture']['eventRows']:,}条行为事件，1000名模拟学员。扩展方法为同状态签到来源重复和课耗等额细分，不代表真实学员或真实机构规模扩大。16组、80批、240计时请求，全部与小规模独立核验基准一致。",'','| 查询 | 并发1冷组均值ms | 并发1暖组均值ms |','|---|---:|---:|']
labels={'metrics':'八项指标','trend':'六个月趋势','channels':'渠道拆解','admissions':'招生分析'}
for kind,label in labels.items():
    vals=[]
    for cache in ['cold','warm']:
        q=next(x for x in r['records'] if x['query']==kind and x['concurrency']==1 and x['cache']==cache)
        vals.append(statistics.mean(t for s in q['samples'] for t in s['requests']))
    lines.append(f'| {label} | {vals[0]:.2f} | {vals[1]:.2f} |')
peak=max(s['rssPeakBytes'] for x in r['records'] for s in x['samples'])/1024**2
lines.extend(['',f'查询进程RSS采样峰值最高{peak:.2f}MiB，采样间隔20毫秒。冷组使用新应用进程并清除ClickHouse mark/uncompressed缓存，未清操作系统页缓存。资源日志中454.21MiB是单条ClickHouse查询峰值，不是数据库进程总内存峰值。','', '重型行为聚合在ClickHouse，业务关系在PostgreSQL；满班、留存和渠道链仍基于有界元数据计算。不能写成所有业务逻辑均已改成SQL，也不能将重复扫描行数写成数据集规模。','', '## 仍需实际参与者开展的研究','', '五维主观评分、报告洞察深度、预警独立人工标注、实际采纳意愿、真实执行采用率和经营改善仍待实际试用后填写。现有模拟决策反馈仅验证操作流程。完整论文与答辩PPT另行完成。','', '## 证据位置','', str(root), '', '性能逐次CSV、资源日志、模型实际输入与状态、专用测试记录和生产截图保存在上述目录；材料目录中的表图只使用实际记录。'])
journeys=json.loads((root/'final-journeys/verification.json').read_text(encoding='utf-8')) if (root/'final-journeys/verification.json').exists() else None
lines=[line.replace('7组只读检查、28张截图；失败样本入口最终版再次核对','最终版7组只读检查、28张截图通过；失败样本入口已核对') for line in lines]
if journeys:lines.extend(['',f"已有经营流程最终只读复核：{len(journeys['checks'])}组通过，28张四尺寸截图；人群46与38人、原任务与反馈保持不变。",'', '文档交付补录日期：2026年10月14日；上述实验与截图的实际执行日期保留在证据JSON中。'])
(materials/'06_实际验收与结果.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
shutil.copy2(root/'normal/cloud-evaluation-metadata.csv',materials/'表/真实云模型样本_待人工评阅.csv')
shutil.copy2(root/'operations-performance/measurements.csv',materials/'表/性能逐次原始测量.csv')
for doc in ['README.md','docs/architecture.md','docs/api.md','docs/data.md']:
    p=project/doc
    p.write_text(p.read_text(encoding='utf-8').replace('最新流程体验轮集中通过191','此前流程体验轮集中通过191'),encoding='utf-8')
additions={
 'docs/architecture.md':'研究对照允许选择已结束的成功或失败报告。失败工具报告以原错误和失败状态进入同冻结数据比较，不能只汇总成功样本。模板仍明示模板、直接模型仍不纠正正文数字；失败工具项不可评分。原报告永不覆盖。报告正文在剩余六轮上限内最多修正两次，不重执行工具、不放宽数字校验。',
 'docs/api.md':'评价生成接受completed或failed冻结报告，generating拒绝。失败原工具方案保留failed及原因，其余方案明确保存各自生成结果；对失败项评分返回400。名单和评分操作仍按机构及角色隔离。',
 'docs/data.md':'研究统计同时显示成功与失败，原工具失败不能被排除出样本。已验证两组真实云模型链路，人工评分保持空白；固定模型的评分和故障注入只用于_test验收。经营性能实际事件1,899,713条，独立于原第三版及正常库；重复扫描累计不作为规模。'
}
for doc,body in additions.items():
    p=project/doc;s=p.read_text(encoding='utf-8')
    if body not in s:p.write_text(s+'\n\n'+body+'\n',encoding='utf-8')
for name in ['agent','tag','knowledge','help']:
    if (root/f'final-journeys/{name}-1440.png').exists():shutil.copy2(root/f'final-journeys/{name}-1440.png',materials/f'截图/{name}.png')
testing='''## 六轮完善集中验收（2026-10-13；2026-10-14交付补录）

以下来自本轮集中检查，前文为历史记录。先完成代码及说明，再集中测试；故障和评分夹具只使用25432/education_cleanup_test及28123/education_cleanup_test。正常项目保留原账号、模型、原始数据和历史对象，仅追加两个已批准的可空复核字段与索引；追加前后11类记录计数一致。

| 检查 | 实际结果 |
|---|---|
| 类型、模块与生产构建 | 通过；1058个源码文件、99个静态生成项 |
| 单元与领域回归 | 245项单元、2500项既有回归通过 |
| 专用数据库 | 68项通过；8个经营范围SQL/纯计算对照、机构隔离、6项JSONB分页 |
| 既有API/ClickHouse | 235项通过 |
| 研究与决策复核API | 9组研究、4组量化复核通过；角色、版本、批次、幂等及导出覆盖 |
| 两条测试页面流程 | 10组通过；46人和38人，20张四尺寸截图，浏览器异常0 |
| 新功能生产页面 | 7组只读检查通过；7页×4尺寸=28张截图；评分未写入、原人群未改变 |
| 最终既有流程复核 | 9组只读检查通过；任务恢复、标签、人群、画像、指南、财务入口与完整日期；28张截图，原对象不变 |
| 真实云模型 | 两组成功冻结报告、六个三方案结果；首次失败报告另行纳入比较，原工具项仍为失败，主观评分空白 |
| 客户端产物 | 89个JS块未发现数据库连接、模型密钥变量或数据库仓储标记 |

百万基准：固定种子20261013，独立1,899,713条模拟行为事件；16组、80批、240计时请求全部与基准一致。并发1冷/暖均值ms：八指标895.66/745.99、六个月趋势2542.96/2748.05、渠道4309.82/4461.08、招生1062.80/1013.74。应用RSS采样峰值最高484.38MiB；ClickHouse454.21MiB是单条查询峰值。冷组未清OS页缓存；签到重复来源和课耗等额细分不代表真实学员规模增长。扫描量是重复查询累计，不作为独立数据集规模。

集中修复：JSONB键序不应改变锁定复核周期或凭证；“重点人群”的“点”不是经营数量；报告在原六轮和120秒限制内最多两次正文修正，不重复工具或放宽数字校验；研究评价同时纳入成功与失败报告，避免只评价成功子集。第一次真实模型数字校验失败始终保留；新请求成功不覆盖旧失败。

实测证据位于tests/artifacts/research-qa：unit-final.log、database.log、integration.log、final-checks.json、normal-schema-append.json；test目录保存研究/复核API及页面结果；normal保存实际云模型记录；production与final-journeys保存生产复核；operations-performance保存16组JSON、逐次CSV、资源日志和可复用参数。

复现入口：tests/e2e/with-test-environment.mjs显式覆盖测试连接；tests/e2e/research.mjs、decision-review.mjs、ux-workflow.mjs；正常复核为normal-research-ui.mjs及normal-ux.mjs。百万基准在tests/performance/operations-benchmark.ts，只允许_test。测试Compose使用临时存储，重启后若夹具不存在须重新生成，不能将旧检查点当作已导入数据。正常库不得运行整份初始化SQL。

论文材料在项目外“论文与答辩材料”：详细提纲、指标口径、四组SVG/Mermaid图、两组实测性能PNG/SVG、实验空表、模型元信息、实际截图和两条演示脚本。真人五维评分、预警独立人工标注、真实采用率和经营改善仍待实际试用；完整论文和答辩PPT另行撰写。固定模型的评分历史仅为验收夹具，不属于真人研究结果。
'''
p=project/'docs/testing.md';s=p.read_text(encoding='utf-8');marker='## 六轮完善集中验收（2026-10-13，进行中）'
if marker in s:s=s[:s.index(marker)]+testing
elif testing not in s:s+='\n\n'+testing
p.write_text(s,encoding='utf-8')
p=project/'README.md';s=p.read_text(encoding='utf-8');note='''\n\n本轮集中验收已完成：245项单元、2500项回归、68项数据库、235项API/ClickHouse检查通过，两条标签人群流程及四尺寸页面复核通过。独立1,899,713条模拟事件的16组性能结果与核验基准一致。研究评价已纳入失败报告，两组真实云模型对照已保存，人工评分仍空白。启动后从左侧研究评价、渠道分析、决策中心和操作指南查看；详细结果见docs/testing.md（2026-10-14交付补录）。\n'''
if note not in s:p.write_text(s+note,encoding='utf-8')
print('已整理实际验收材料与开发说明；未填写主观评分。')
