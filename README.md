# 教培机构运营分析辅助系统

毕设题目：**基于业务数据与AI智能体的教培机构运营分析辅助系统**。开发者：李丞匀。

源码仓库：[GhostSharksDog/EduOps-AI](https://github.com/GhostSharksDog/EduOps-AI)。仓库包含源码、初始化SQL、配置模板、测试和数据来源说明；本地环境文件、原始/生成数据、导入运行记录及测试产物不上传。新环境按下文准备配置、生成模拟数据并导入。测试工具默认产物目录为tests/artifacts，可通过相应环境变量调整；历史验收文件仅在本地保存。

项目在前期标签管理项目基础上继续开发，提供业务数据接入、经营分析、风险标签、人群画像及有证据的智能辅助。公开教育数据与独立教培模拟数据分开存储和统计。

## 开始使用

常用导航为 **运营总览、智能分析、标签与人群、行动中心**。数据、业务知识、研究评价和系统配置在“工作台”，操作说明在右上角“帮助”。原有页面地址继续可用。

1. 总览默认查看出勤、招生转化、续费和留存；点击“全部指标”展开八项。修改范围后点击“应用范围”，再进入智能分析。
2. 分析先显示结论、关键数字和建议，“查看完整分析”保留原文、原因假设、口径及证据。标签按设置、预览、发布、保存人群四步操作，发布与保存分别确认。
3. 在行动中心安排和复核任务。已保存人群的名单不会随新数据自动变化；未知、失败和模拟来源均保留标识。

## 已实现功能

- 本地账号登录，管理员、运营人员和只读角色；账号、系统设置、审计与回收站。
- 数据源、数据模型、CSV字段映射、校验、导入批次与质量报告。
- 标签分类、版本、目标表、位图和物化视图中的有效能力。
- 蓝白运营总览、四项重点指标及可展开的八项指标、重点事项、六个月趋势与校区对比；课程、渠道、招生和课耗按需展开，观察不足留空。
- 出勤下降、满班不足及续费偏低规则预警，支持关注与人工处理。
- 冻结数据和审核知识支持的智能周报/月报、历史详情、证据引用与Markdown导出。
- 五类运营标签及同校区同课程组合规则，覆盖/未知预览、人工发布、冻结人群与学员业务画像。
- 文本/Markdown知识管理、版本审核、向量索引、语义检索与来源引用。
- 单Agent按来源选择受控工具、会话和执行记录；经营模式六工具与人工确认，公开模式两只读工具；两条经营页面评审引导。
- OULAD真实公开学习分析：八项学习指标、相对周趋势、课程批次/资源/测评/最终结果分布；总览按数据集切换来源，公开Agent仅查询学习汇总和口径。

经营数字由业务服务计算；知识库提供定义与制度。Agent只生成草稿，标签发布和人群创建由页面确认。缺失签到单列为未知，未计算值保留为空，模拟结果不会标作真实经营数据。

## 技术与目录

Next.js、React、TypeScript、Ant Design、ECharts、PostgreSQL/pgvector、ClickHouse；PostgreSQL使用pg参数化SQL，Redis为可选缓存。对话模型与向量模型使用独立的OpenAI兼容配置。

```text
src/
├── app/          # 页面、布局与API
├── modules/      # 按功能组织
├── platform/     # 数据库、模型客户端、日志
└── shared/       # 通用组件、类型、工具
database/         # 一个空库初始化SQL
scripts/          # 日常运行工具
tests/            # 单元、数据库、完整流程测试
docs/             # 架构、接口、数据、测试四份说明
datasets/         # 原始/模拟数据与来源清单
docker/           # 一个Dockerfile
```

业务模块按需使用ui、domain、services、repositories、contracts；服务端和客户端入口分开。架构与当前边界见[架构说明](docs/architecture.md)。

## 本地启动

需要Node.js 22、npm及Docker。已有`.env.local`时保留配置；没有时复制模板：

```powershell
if (-not (Test-Path -LiteralPath '.env.local')) {
    Copy-Item .env.example .env.local
}
npm ci
docker compose --env-file .env.local up -d postgres clickhouse
```

将模板里的JWT_SECRET替换为至少32字符的随机密钥，数据库密码与Compose保持一致。**仅空数据库**执行：

```powershell
npm run db:init
```

初始化只执行`database/init.sql`，包含vector扩展、业务表和索引；非空库拒绝初始化。已有数据库沿用现有结构，启动不会自动迁移、重建或删除数据。

已有本地账号直接登录；仅新环境需要创建管理员：

```powershell
$env:LOCAL_USER_NAME = 'admin'
$env:LOCAL_USER_PASSWORD = '替换为自己的密码，至少10个字符'
$env:LOCAL_USER_ROLE = 'admin'
npm run user:create
Remove-Item Env:LOCAL_USER_PASSWORD
Remove-Item Env:LOCAL_USER_NAME
Remove-Item Env:LOCAL_USER_ROLE
npm run dev
```

打开[本地应用](http://localhost:3000)。开发CLI先加载`.env.local`、再加载`.env`，已存在的进程环境变量优先。根Compose保留原命名卷，PostgreSQL端口15434、ClickHouse HTTP18123/Native19000；可选Redis为16379。

## 准备数据与模型

```powershell
npm run education:generate
npm run education:import -- --mode simulation
npm run education:import -- --mode oulad --activity-limit 20000
npm run models:check
```

全量公开数据使用 `npm.cmd run education:import -- --mode oulad`，默认每块5,000行，共七表10,900,970条，其中学习活动10,655,280条。首次扫描逐行核对SHA-256和预期行数，然后分块串行导入；进度与全文件指纹保存至清单目录的机构专属检查点。重跑复用完成分块；旧进程已退出而残留运行任务时，才使用 `--recover-stopped` 恢复。更改分块大小须使用新的 `--manifest-directory`，同来源行号查重继续生效；文件内容变化要求新版本。

总览选择OULAD查看真实学习行为，课程批次与相对日起止筛选，日期留空代表已导入完整相对日范围（包含测评、注册及退出）。选择第三版模拟数据查看经营指标、标签及人群闭环。两类数据不混算，千万条活动不是千万名学员，点击不代表签到。知识库提供OULAD口径示例，需保存并人工审核索引后用于RAG。登录界面使用蓝白产品介绍与本地账号表单；Agent经营范围分别显示完整起止日期，公开范围显示相对日。

默认第三版评审模拟数据为1,000名学员、3个校区、6类课程，固定种子20261009。生成到独立-v3目录，已有目录拒绝覆盖，可直接使用已提供CSV导入；以前版本保留。OULAD来源、CC BY 4.0许可、实际行数、字段与八项指标口径见[数据说明](docs/data.md)。

在`.env.local`填写CHAT_API_BASE_URL、CHAT_API_KEY、CHAT_MODEL，以及EMBEDDING_API_BASE_URL、EMBEDDING_API_KEY、EMBEDDING_MODEL。DeepSeek使用`https://api.deepseek.com`；阿里云百炼使用与密钥地域一致的OpenAI兼容前缀，如`https://dashscope.aliyuncs.com/compatible-mode/v1`。地址不追加具体聊天或向量路径，模型名按账户可用配置填写，密钥仅用于服务端。

`models:check`只检查配置，不联网；`npm run models:check -- --connect`使用通用测试文本检查工具协议和向量接口。变更模型配置后重启应用；更换向量接口或模型需重新索引知识。

完整演示：选定统计范围 → 查询指标 → Agent检索口径并解释 → 生成并预览风险草稿 → 页面确认发布 → 确认建立人群 → 查看画像。知识材料需先人工保存、审核并索引。

## 检查与部署

```powershell
npm run typecheck
npm run check:architecture
npm run test
npm run test:regression
npm run test:database
$env:NEXT_TELEMETRY_DISABLED = '1'
npm run build
```

数据库、API和完整流程测试限定专用`*_test`库，并先启动独立测试应用。此前流程体验轮集中通过191项单元、2,500项领域回归、53项真实数据库和235项API/ClickHouse用例；新流程浏览器十组通过。公开模式页面、经营生产流程与真实DeepSeek＋阿里云只读闭环的历史及本轮实际结果，见[测试说明](docs/testing.md)。

容器构建使用公开镜像和`docker/Dockerfile`。根Compose的app profile启动应用，tools profile提供显式初始化/账号工具，服务启动不会执行初始化：

```powershell
docker compose --env-file .env.local --profile tools build tools
# 仅新空库：
docker compose --env-file .env.local --profile tools run --rm tools npm run db:init
# 初始账号仍通过LOCAL_USER_*环境变量传入：
docker compose --env-file .env.local --profile tools run --rm -e LOCAL_USER_NAME -e LOCAL_USER_PASSWORD -e LOCAL_USER_ROLE tools npm run user:create
docker compose --env-file .env.local --profile app up -d --build app
```

已有数据库跳过初始化；此前报告/预警阶段的两张表如尚未准备，按docs/architecture.md中的补表说明手动处理。此次运营标签与评审升级不新增表，应用不会自动改库。模型配置变更后用相同env-file重新创建app容器。所有数据卷保持原名，不运行删除卷的命令。

## 开发说明与后续事项

[架构](docs/architecture.md) · [接口](docs/api.md) · [数据与指标](docs/data.md) · [测试](docs/testing.md)

后续完善通用标签/人群计算和真人评价；经营改善、检索准确率、洞察质量和实际建议采用率需完成实验后据实填写。


## 评审演示与本轮改动

第三版模拟数据位于 `datasets/generated/training-sim-20261009-v3`，15类CSV共68,750条，附场景配置和文件指纹。默认生成/导入第三版；第一、二版与已发布快照保留，生成器拒绝覆盖已有输出目录。

```powershell
npm run education:generate -- --version 3 --output datasets/generated/my-new-simulation
npm run education:import -- --mode simulation --directory datasets/generated/training-sim-20261009-v3
```

正常项目库已接入全量OULAD七表10,900,970条，以及第三版模拟数据68,750条，分别统计。登录后默认第三版模拟经营总览；明确选择过的数据集与链接范围优先保留，可切换公开学习或真实年度财务案例。正常环境已通过页面审核并索引11份知识，包含OULAD口径、运营标签、模拟流程及年度财务口径；新录入或修改的材料仍须审核具体版本。经营演示选择第三版、2026年8月和少儿编程课程。

从总览页尾的“出勤异常闭环”或“同课程组合标签闭环”进入，引导仅预填问题与范围；提交后核对指标、口径、规则、覆盖与未知人数，再从页面确认发布、建立人群、查看个人画像、生成同范围月报。引导按真实记录显示进度，可退出或继续已有会话。宽屏首屏展示八项指标，全屏展示隐藏导航并保留范围和模拟标识。

改动入口：总览聚合在`modules/overview/services/dashboard-service.ts`，业务事实在`modules/education/domain/business-facts.ts`，规则在`modules/tag/domain/business-risk.ts`，Agent执行在`modules/agent/services/service.ts`，共享图表在`shared/ui/BusinessChart.tsx`，范围传递在`shared/lib/analysis-navigation.ts`。均位于src下，页面与API原URL保持兼容。

已有账号、模型配置、原始文件和历史记录保留，本轮新增两类独立数据集和知识草稿。云模型验收使用匿名公开学习聚合事实及通用知识，不发送成员明细；成功调用不等于已验证洞察质量、实际经营改善或建议采用率。

## 决策闭环与操作指南（2026-10-12）

左侧新增“决策中心”和“操作指南”。首次使用请进入 `/dashboard/help`，查看数据选择、知识审核、Agent、标签发布、人群、预警、报告及复核的分步说明。运营标签与人群作为主入口；通用标签、分类、Bitmap等放入折叠的高级配置，原URL保留。

决策中心汇总成功Agent分析与智能报告的有效建议。用户核对依据后填写动作、责任人、优先级、期限、复核方法，选择采纳／暂缓／不采纳；采纳后开始执行、记录过程、提交复核并保存结论。模型不能采纳建议或改变状态。原始回答、范围与证据保持冻结。模拟任务必须标为演示；真实采纳意愿、执行情况、复核结果分别记录。

昂立教育2023—2025公开集团年度财务案例在 `datasets/raw/angli-finance`；年报必要金额事实与页码经过核对，保留新旧披露出处。导入命令：

```powershell
npm.cmd run education:import -- --mode finance
```

财务总览显示收入、营业成本、毛利、毛利率、销售及管理费用与费用率；年度Agent只读，不关联模拟学员、不生成月度数据。公开学习继续按相对日查询，模拟经营保留完整业务操作，三种范围互斥。

已有数据库只执行 `database/init.sql` 中 `BEGIN DECISION_APPEND_ONLY` 与 `END DECISION_APPEND_ONLY` 标记之间的追加区块；不得运行整份初始化文件。区块增加分析类型字段、决策任务／反馈和评价表，不修改已有业务记录。空库仍只初始化一次。详细说明见四份开发文档。

在决策中心展开“研究评价”，选择成功冻结报告，生成固定模板、直接模型、工具辅助Agent的同数据对照。直接模型不做数字纠正；失败保留失败。评分需实际评阅、注明评分者与依据，支持CSV导出。页面提供记录能力不表示真人评价或毕业论文已经完成。本轮验收记录在 `docs/testing.md`，未实际执行的检查不填写通过。

本轮正常项目已保留两个模拟闭环：出勤关注人群46人、同课程出勤偏低且即将到期人群38人，均有已发布标签、画像、真实云模型月报和已复核的演示决策任务。另有真实年度财务Agent问答、运营周报和同一冻结报告的三方案对照。可从操作指南进入已有标签、人群、报告和决策记录，不必从空白开始。

决策页面可选择同范围的已确认人群，按页查看建议，并导出采纳、执行与复核CSV。未发布标签预览有效期30分钟；过期须重新预览，已发布对象仍支持重复确认。研究对照正文已生成，人工评分、真人试用与采用率保持待开展。

## 完整流程与使用体验（2026-10-12）

从操作指南选择“分析问题”“创建标签与人群”“处理决策任务”，或选择已保存记录继续。标签工作台提供设置、预览、发布、保存人群四步；预览有效期30分钟，正式名单保留当时的版本。页面跨跳转携带数据来源和范围，画像不会在指定人群查询失败时自动选择其他记录。

知识按来源组织，历史版本展开；支持标题、类型、使用状态筛选、Markdown阅读预览、成功经营报告生成历史摘要草稿。保存后核对并审核，准备成功才能用于Agent问答。检索匹配度不是答案准确率。

首次Agent请求期间每2秒读取真实工具步骤；原分析请求继续执行。决策任务增加本人、未来7天到期、逾期筛选。编辑保护提供保存、放弃、继续编辑；浏览器刷新/关闭提示离开，未提交内容仅应用内存保存，正式业务记录仍由页面人工确认。

本轮正常环境已只读复核两条保存流程，操作指南可以从既有任务恢复分析、标签和人群；七个页面在1920、1440、1366与390像素宽度完成截图检查，已有对象的编号、版本、状态和人数保持不变。打开[操作指南](http://localhost:3000/dashboard/help)可选择任务开始或继续已有记录。


## 研究评价与执行后复核

常驻研究评价支持三方案并排阅读、冻结输入和知识版本、五维人工评分、历史与汇总CSV导出。无评分时显示待评阅；历史缺输入样本不计入严格对照。渠道分析覆盖全部八指标，来源归属按同校区同课程首次有效首购，续费继承；未知来源单列。渠道席位贡献率不套用满班不足阈值。

决策建立时可设最多三个执行前目标和复核周期；复核先查看服务端前后对比，再从页面确认冻结。预警页面提供管理员规则版本配置及只读历史回放，运行诊断检查连接、结构和配置并给出恢复入口。具体操作在常驻操作指南中。

已有库仅追加database/init.sql中RESEARCH_APPEND_ONLY区块的两个可空字段与索引，原数据不重建。集中验收的当前记录以docs/testing.md最新章节为准，未经实测不填写通过。论文材料保存到项目外“论文与答辩材料”；完整论文、答辩PPT及真人采用评价另行开展。


本轮集中验收已完成：245项单元、2500项回归、68项数据库、235项API/ClickHouse检查通过，两条标签人群流程及四尺寸页面复核通过。独立1,899,713条模拟事件的16组性能结果与核验基准一致。研究评价已纳入失败报告，两组真实云模型对照已保存，人工评分仍空白。启动后从左侧研究评价、渠道分析、决策中心和操作指南查看；详细结果见docs/testing.md（2026-10-14交付补录）。
