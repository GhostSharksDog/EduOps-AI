"""生成项目外的论文图表框架；未评阅的实验数据保持空白。"""
from pathlib import Path
from html import escape
import csv

project = Path(__file__).resolve().parents[2]
output = project.parent / '论文与答辩材料'
figures = output / '图'
tables = output / '表'
figures.mkdir(parents=True, exist_ok=True)
tables.mkdir(parents=True, exist_ok=True)

def diagram(name, title, columns, footnote, mermaid):
    width, box_w, gap = 1560, 326, 42
    height = 188 + max(len(c[1]) for c in columns) * 130
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img"><title>{escape(title)}</title>', '<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#3c66a3"/></marker></defs>', '<rect width="100%" height="100%" fill="#f6f9ff"/>', f'<text x="52" y="50" font-family="Microsoft YaHei,Arial" font-size="29" font-weight="bold" fill="#163354">{escape(title)}</text>']
    for col, (label, boxes) in enumerate(columns):
        x = 50 + col * (box_w + gap)
        svg.append(f'<text x="{x}" y="98" font-family="Microsoft YaHei,Arial" font-size="20" font-weight="bold" fill="#526788">{escape(label)}</text>')
        for row, lines in enumerate(boxes):
            y = 117 + row * 130
            fill = '#eef0ff' if col == 2 else '#ffffff'
            svg.append(f'<rect x="{x}" y="{y}" width="{box_w}" height="102" rx="12" fill="{fill}" stroke="#becfe4"/>')
            for index, line in enumerate(lines):
                svg.append(f'<text x="{x+18}" y="{y+29+index*26}" font-family="Microsoft YaHei,Arial" font-size="{18 if index==0 else 16}" fill="#163354">{escape(line)}</text>')
            if col < len(columns) - 1 and row < len(columns[col+1][1]):
                svg.append(f'<path d="M {x+box_w+4},{y+51} L {x+box_w+gap-6},{y+51}" stroke="#3c66a3" stroke-width="2" marker-end="url(#arrow)"/>')
    svg.append(f'<text x="52" y="{height-30}" font-family="Microsoft YaHei,Arial" font-size="17" fill="#526788">{escape(footnote)}</text></svg>')
    (figures / (name + '.svg')).write_text('\n'.join(svg), encoding='utf-8')
    (figures / (name + '.mmd')).write_text(mermaid + '\n', encoding='utf-8')

diagram('01_系统架构', '系统架构：数据计算、知识解释与人工执行', [
    ('数据与运行基础', [['PostgreSQL', '身份、业务关联、版本与任务'], ['ClickHouse', '学习与经营行为数据库聚合'], ['独立模型配置', '对话模型 / 向量模型']]),
    ('核心业务服务', [['指标与渠道分析', '来源归属、范围、分子分母'], ['标签、人群与画像', '规则预览、冻结名单与分页'], ['知识管理', '版本审核、索引与引用']]),
    ('智能分析与治理', [['受控 Agent / 智能报告', '调用工具，输出事实与待核查原因'], ['规则预警 / 决策复核', '配置版本、执行前目标与冻结对比'], ['研究评价', '三方案实际输入、人工评分历史']]),
    ('应用与边界', [['运营 / 学习 / 财务总览', '三种数据模式独立显示'], ['页面人工确认', '发布标签、建人群、采纳任务'], ['操作指南 / 安全诊断', '只读检查与明确恢复入口']]),
], '机构与权限来自服务端；模型不能发布标签、采纳建议或改变任务状态。', '''flowchart LR
PG[(PostgreSQL)] --> B[业务关联与版本]
CH[(ClickHouse)] --> M[指标与渠道数据库聚合]
B --> M
B --> T[标签预览 / 冻结人群 / 画像]
K[知识版本审核 / pgvector] --> A[受控 Agent]
M --> A
M --> R[智能报告与规则预警]
A --> H[页面人工确认]
T --> H
R --> H
H --> D[决策任务 / 执行记录 / 冻结复核]
R --> E[研究评价三方案]
E --> U[实际人工评阅与导出]
M --> V[总览：经营 / 学习 / 财务分别展示]
''')
diagram('02_业务流程', '业务范围与决策闭环', [
    ('招生与签约', [['线索获取', '独立渠道与30日观察窗口'], ['试听 / 有效首购', '明确关联线索及合约']]),
    ('在读服务', [['排课 / 出勤 / 课耗', '未知签到不认定为缺勤'], ['到期 / 续费 / 转介绍', '资格、合约链与历史截止']]),
    ('风险与分析', [['正常结课 / 退班 / 客诉 / 退款', '分别说明原因与净额'], ['指标 → 预警 → Agent分析', '事实、待验证原因、可执行建议']]),
    ('人工行动与复核', [['标签预览 → 发布 → 保存人群', '同校区同课程条件，未知单列'], ['任务采纳 → 执行 → 复核', '前后对比是观察，不自动认定因果']]),
], '模拟经营用于流程验证；公开学习与年度集团财务不与模拟学员拼接。', '''flowchart LR
L[线索获取] --> T[试听]
L --> C[有效首购签约]
T --> C
C --> S[排课 / 出勤 / 课耗]
S --> N[到期续费]
N --> S
S --> F[转介绍]
F --> L
S --> X[正常结课 / 退班]
S --> Q[客诉 / 退款]
S --> M[指标 / 预警 / Agent分析]
Q --> M
M --> D[标签草稿与覆盖预览]
D --> H[页面发布 / 保存人群]
H --> P[画像与行动建议]
P --> E[任务采纳 / 执行 / 量化复核]
''')
diagram('03_数据流', '数据与知识流：来源可追溯，数字由程序计算', [
    ('独立数据来源', [['OULAD 匿名公开学习数据', '课程批次与相对日'], ['教培模拟经营数据', '固定种子与场景文件指纹'], ['昂立教育公开年度财务', '原始金额、年份、披露来源页码']]),
    ('数据准备与存储', [['字段映射 / 质量报告', '保留原始语义与来源编号'], ['完成导入批次', '失败或运行批次不参与分析'], ['元数据 PG / 行为 CH', '参数化查询与机构过滤']]),
    ('程序计算与知识', [['来源适配的指标查询', '经营日期 / 相对日 / 年度互斥'], ['经审核的知识版本', '口径、字典、制度、历史摘要'], ['有限聚合结果与证据', '时间范围、截止与批次版本']]),
    ('展示与验证', [['看板 / Agent / 报告', '事实与原因假设分开展示'], ['标签 / 人群 / 决策任务', '明确页面确认与版本校验'], ['实验 / 复核 / 人工评阅', '冻结结果与实际反馈分开记录']]),
], 'RAG 提供解释知识；历史摘要不能替代当前经营数字。', '''flowchart LR
O[OULAD] --> I[字段映射 / 质量检查 / 导入批次]
S[教培模拟数据] --> I
F[集团年度财务] --> I
I --> PG[(PG元数据)]
I --> CH[(CH行为事件)]
PG --> M[按来源适配的程序计算]
CH --> M
K[口径 / 字典 / 制度 / 已审核摘要] --> V[知识版本 / 向量检索]
M --> A[Agent：聚合事实与证据]
V --> A
A --> H[人工确认草稿 / 决策任务]
M --> UI[看板与冻结报告]
UI --> E[对照评价 / 冻结复核]
H --> E
''')
diagram('04_Agent与人工确认', 'Agent 调用与人工确认：两个独立边界', [
    ('用户与服务端', [['选择数据与范围 / 提问', '机构、角色与授权来自身份'], ['页面核对具体草稿版本', '可修改，但必须重新预览'], ['点击确认发布 / 保存人群', '聊天中的“确认”不能发布']]),
    ('Agent 只调用受控工具', [['查询指标与维度 / 检索口径', '只接收聚合数字与证据'], ['创建草稿 / 预览规则', '命中、未知及范围依据'], ['生成解释和行动建议', '不能更改执行任务状态']]),
    ('业务服务校验', [['持久化运行与真实工具步骤', '范围绑定、幂等与时间限制'], ['冻结规则与数据批次', '发布校验版本、令牌与有效期'], ['复核任务与前后数据', '目标执行前设置，确认再冻结']]),
    ('可追溯输出', [['事实卡 / 知识引用 / 步骤', '工具结果与证据对应'], ['发布标签 / 成员快照', '后续数据不自动更改名单'], ['任务反馈 / 指标观察结果', '不自动认定经营改善或因果']]),
], '请求内执行，没有新增后台队列；写操作不自动重试。', '''sequenceDiagram
participant U as 用户页面
participant API as 身份与范围服务
participant A as 单Agent
participant T as 受控工具
participant B as 业务发布服务
U->>API: 数据集、范围、问题、请求幂等键
API->>A: 绑定身份与范围
loop 最多6轮模型调用、8次工具执行
A->>T: 结构化工具参数
T->>T: 参数、机构、权限和范围校验
T-->>A: 聚合事实、证据、草稿或预览
end
A-->>U: 事实、待验证原因、建议、待确认草稿
U->>B: 页面确认具体版本与预览凭证
B->>B: 版本、30分钟有效期、批次、幂等校验
B-->>U: 已发布标签
U->>B: 页面确认保存人群
B-->>U: 冻结名单与画像入口
''')

templates = {
    '三方案人工评阅_待填写.csv': ['样本编号','报告编号','方案','冻结输入版本','模型','评分账号','评分时间','数字一致性1至5','证据支持1至5','洞察深度1至5','建议可执行性1至5','表述清晰度1至5','评阅依据','记录性质'],
    '预警独立标注_待填写.csv': ['场景编号','数据集','范围','规则版本','人工预先标注异常','系统是否命中','跳过原因','计算毫秒','人工触发等待毫秒','标注说明'],
    '采用与执行_待真实试用.csv': ['参与者匿名编号','建议编号','采纳意愿','是否实际采纳','执行记录','复核结果','数据性质','评阅或执行时间'],
    '指标核对记录_待填写.csv': ['案例','数据集','范围','指标','人工分子','人工分母','程序分子','程序分母','一致性','核对人','核对时间','来源'],
}
for filename, headers in templates.items():
    target = tables / filename
    if target.exists():
        continue
    with target.open('w',encoding='utf-8-sig',newline='') as stream:
        csv.writer(stream).writerow(headers)
(figures / '图的使用说明.md').write_text('SVG可插入论文并缩放；同名Mermaid源可按论文排版重新导出。图描述当前设计，不表示全部研究评价已经开展。性能图仅在实际基准结束后由测量值生成。\n',encoding='utf-8')
print('论文材料图4组及空白评阅表已生成；未填入主观评分或经营改善。')
