# 接口约定

## 空间感界面兼容（2026-10-19）

本轮仅改前端构图、公共主题、图片与动效；业务API和契约不变，图片优化为本地next/image资源请求。进场不通过重挂载业务页实现，不额外触发查询、模型或正式写操作。Agent的真实进度、12px输入区、原确认入口及权限沿用。

## Agent输入区兼容（2026-10-19）

本轮仅调整输入及对话区域布局，接口、请求参数与返回契约不变。发送、轮询、防重复及正式操作确认沿用现有服务，页面截图和输入测试使用受控API，不向正常库或云模型提交问题。

## 分析完整性与facts_only兼容（2026-10-19）

AgentAnswerVO增加可选partial:{kind:'facts_only',reasonCode:string,missingTools?:string[]}，存既有answer JSONB；运行status和返回status不变，部分结果仍failed/error，不伪装completed。原历史没有该标记继续按原状态展示。INCOMPLETE_ANALYSIS表示明确要求的维度查询缺失，原恢复入口拒绝仅解读，需重新查询。query_metric_breakdown内部工具增加可选metricCodes，不改变HTTP接口；模型只见fact映射，页面仍取得完整程序事实、样本、图表及来源。

## 解读数字校验兼容（2026-10-19）

接口地址、输入、运行状态及原事实编号不变。fN和labelN仅为内部生成阶段的本轮绑定，客户端仍取得实际facts、evidence和程序图表，不接收未解析的短编号。没有证据的比例、人数、金额和规则参数继续返回UNVERIFIED_NUMBER；已核验日历用语与建议次数单独处理。内部answerValidation仅保存失败码及字段路径，沿用runtime公开响应脱敏，不暴露模型原文或连接信息。旧失败记录保留，满足冻结条件的记录可通过既有retry-interpretation接口重新解读。

## Agent辅助操作与图表（2026-10-19）

- 不新增业务接口。AgentStepVO增加可选visualizations，旧记录无此字段继续兼容；每图包含kind、分类、系列数值／状态、单位、指标code、数据来源与公共范围、evidenceIds。模型不能提交ECharts配置，图表只由受控服务返回，HTTP不额外暴露模型输入。
- 最多8图、30类、3系列，非有效数值不绘制，旧无图记录不读取当前数据补图。恢复解读只复制原冻结范围且引用完整的图表至restore_frozen_facts。
- 下一步与澄清仍提交POST /api/agent/runs并使用原请求幂等键。单项普通澄清可直接发问，正式操作没有新增快捷执行API。历史范围继续由明确按钮选择，权限和可用数据仍服务端检查。
- GET /api/settings改为纯读取：原响应格式不变，缺记录返回默认配置，不INSERT或UPDATE。PUT继续局部保存、按身份机构过滤并记录SystemConfig审计；客户端身份头不参与机构选择。

## Agent第三版体验接口（2026-10-18）

- GET /api/agent/sessions/:id的session增加可选taskState；旧空值返回空任务状态，历史回答不改写。当前目标、条件与对象只来自用户明确输入和服务端核验结果。
- PATCH /api/agent/sessions/:id/task-state：`{action:"update",expectedRevision,goal?,userConditions?}`或`{action:"clear",expectedRevision}`。目标最多500字符；条件最多8项，每项200字符。返回CapabilityResult<AgentTaskState>。公司来自身份，会话需本人可继续或管理员；只读账号可管理自己的问答记忆，不能准备业务草稿。并发版本或运行冲突返回409及可恢复错误码。
- POST /api/agent/runs/:id/retry-interpretation：严格接收`{requestKey:UUID}`。服务端加载源事实、证据及冻结范围，新建关联运行；同键复用，换来源拒绝。缺少依据、数据批次／业务状态变化、知识不可核查或会话不可继续时明确拒绝，不偷偷重新查询或重放工具。
- 运行增加recoveryOf与可选recoveryEligibility；失败显示是否能仅重试解读及具体原因。新解读沿用现有进度入口和运行契约，不修改下一轮来源与范围。进度查询继续只读。
- 工具网关内部select_task_tools接收唯一任务组集合及可选简短原因，最多两次。它不执行正式操作；未知组、模式越界、未提供工具或只读写工具均拒绝。内部切组也计入原8次工具预算。
- 研究比较支持v3及executionKind，单独计toolSelectionCalls；解读恢复不能用于证明完整业务任务成功。模型输入仍只在服务端审计记录中读取，公开响应剥离完整输入。

## 个人工作台只读接口（2026-10-18）

GET /api/workbench接收type=all|task|plan|material（默认all）、page（默认1，1—1000），每页固定10条。只允许这两个参数，重复参数或客户端提供用户、公司、数据集、scope均返回400；身份来自withCompanyRoute与认证账号，GET对本地三种有效角色开放。

响应外层为{status:'ready',data:WorkbenchResult}，Cache-Control:no-store。data包含generatedAt、counts（all/task/plan/material，读取失败为null）、todos（items/page/pageSize/total/status/message）、recent（最多6项及status/message）、sources分区读取状态。分区状态ready／partial／error与HTTP身份／参数错误独立，不把局部读取失败显示成空待办。

事项仅返回id、kind、title、status/statusLabel、updatedAt、href、actionLabel/canAct及必要的期限、版本、来源、周期说明；不返回原始分析正文、完整快照、内部模型参数或知识正文。href由服务端使用对象自身范围构造，经营／学习／年度财务参数互斥。首页按钮只导航，正式操作仍在既有页面确认。

原17个目录入口和业务详情地址兼容；工作台页面视图参数view/q/type/page/mobilePane为前端状态，不参与业务计算或改变账号授权范围。无新增写入接口。

## 分区工作台兼容说明（2026-10-17）

不新增或变更后端接口。总览一次查询结果仍用于指标、图表和事项；图表切换及指标选择只改变前端视图，口径弹窗独立打开。对话历史与右侧结果共享已有会话和执行记录，选中执行的context为结果依据，下一轮编辑范围不能覆盖历史记录。

原proposalId、snapshotId、runId、taskId、sourceId及报告详情URL继续有效；页面目录选择将对象编号同步地址，返回及刷新恢复。资料、成员和详情继续使用现有读取与分页接口；过时请求取消不等同于重试写操作。新增公共布局组件与可选AbortSignal仅为前端接口，服务端契约、确认参数及角色校验保持。

## 视觉升级兼容说明（2026-10-15）

本轮仅重排前端，没有新增或修改业务接口、存储、鉴权与模型参数。总览、分析、标签、人群、预警、报告和任务继续使用原契约；收起的内容仍来自完整返回数据。切换数据集、应用范围、查看事实和确认操作沿用原请求边界，页面加载不新增模型调用或自动写入。旧URL、查询参数、冻结范围、确认版本和恢复入口继续有效。

## 连续交流、公司身份与操作计划（2026-10-14）

- GET /api/auth/companies：公开返回公司code/name及defaultCompanyCode，不返回机构编号、数据库地址或环境变量引用。
- POST /api/auth/login：原username/password兼容，增加可选companyCode；缺省仅选明确的默认公司。不同公司可使用同名账号。token及user包含公司信息，后续身份以服务端重新加载的账号为准。
- 全部受保护API运行在已验证公司上下文。旧/api/public/tags和/api/public/tags/values保留地址，要求登录；x-tenant-id不能作为鉴权凭证。
- POST /api/agent/runs：原message/requestKey/sessionId兼容；已有会话可提交datasetId和互斥scope/learningScope/financeScope调整本轮范围。切换数据集必须带范围并由页面明确选择，模型只能在当前数据集内调整条件。
- 回答保留summary/facts/hypotheses/recommendations/limitations，增加可选kind和questions。kind为conversation/clarification/analysis/action，旧记录按analysis阅读。运行增加context和actionPlan，均从已有steps JSONB恢复。
- 数据集目录与范围选项、指标、拆解、标签、人群、知识、预警、报告和任务查询是读取工具；草稿编辑、预览和操作计划准备是propose工具。只读用户可创建自己的问答会话，不能使用propose工具或确认接口。
- POST /api/agent/actions/confirm：{runId,planId,version,requestKey}，页面明确确认后执行。PATCH /api/agent/actions：{runId,planId,version,...可编辑内容}，保存后递增版本，旧确认拒绝。
- 通用确认/编辑返回CapabilityResult<AgentRunVO>，步骤结果包含业务对象编号及跳转地址；部分失败与失效有独立状态。重复提交复用实际完成对象。
- POST /api/agent/proposals/confirm仍兼容原标签确认参数，接入相同正式操作校验，不隐式执行额外人群或任务。
- 进度接口继续只读，每2秒串行轮询；不借进度查询修改执行状态或重试写入。确认工具不出现在模型工具列表。
- 模型暂时性502／503／504在单次运行原预算内最多恢复一次。HTTP返回的context步骤runtime.recovery仅包含status、httpStatus、round、retryAt；内部重发引用和模型输入仍不返回前端。失败时run.answer可保留已取得事实，不等同于智能解读成功。
- GET /api/agent/research/runs：返回本公司最近执行的安全候选目录；POST /api/agent/research/compare：{oldRunId,newRunId}，只读比较问题、冻结范围、工具、引用和实际操作记录。只读账号可查询，不自动填写人工评价。
- 新执行在原steps JSONB记录引擎、提示版本、模型名称及实际模型请求的增量审计。执行、会话、进度与确认接口剥离原始messages/tools，仅返回版本及输入摘要；研究服务在服务器读取内部轨迹，缺失的历史信息不按当前配置补写。
- PATCH /api/decisions/:id增加可选arrangement，修改待执行或暂缓任务的动作、负责人、期限、优先级和复核方法；仍校验expectedVersion、公司、角色及责任人状态，不改来源、人群、目标或执行状态。不能与状态改变、量化复核同时提交。

模型输出的{{fact:完整id}}由服务端使用本轮工具事实填入数字、单位或已核验文本displayValue；无效引用与未经核验的经营数字拒绝。任务期限、报告周期及状态也从真实记录绑定，不由模型猜测。scope与rule引用分别绑定实际统计范围和规则参数，RAG原文不能覆盖这些事实或权限。操作列表序号、确实存在的建议序号及澄清中的候选周期不视为已计算经营数字。

query_metrics工具同时返回当前指标、分子分母、对比期、程序计算的变化及两期证据；未知变化仍为空。query_decision_tasks、query_reports、query_alerts支持可选taskId、reportId、alertId精确读取，继续严格匹配数据集和冻结范围；返回目录到达服务上限时明确标为部分记录。

操作准备时固定实际负责人。相同来源已有任务且安排一致时明确复用；安排冲突在发布标签前拒绝，提供已有任务入口。人群复用显示实际名称。失败报告保留原记录，须准备新的报告计划，原失败计划不能循环恢复或冒充成功。

以下历史章节保留旧接口背景；公司身份、viewer问答及会话范围调整以本节为准。


## 页面精简兼容约定（2026-10-14）

本轮复用现有HTTP契约，不新增业务表。菜单变化不改变URL。摘要折叠、只显示前三项事实与建议只发生在阅读层，原响应、完整详情及导出保留。

经营范围仍通过AnalysisScope传递；抽屉编辑仅查询目录，应用后才查询新范围。Agent新范围进入新会话，历史会话仍锁定来源。发布及保存人群明确调用原接口，版本、批次、预览时效、幂等和知识审核哈希校验保持。

请求以对应模块contracts中的DTO和严格Zod校验为准，响应使用VO。所有受保护接口校验本地JWT，机构/角色由服务端注入，不接受客户端自报权限。原公开标签URL同样要求登录并限定所属公司。

## 身份、范围与结果

角色admin管理本机构业务与账号，可继续本机构任意Agent会话；operator可业务读写、知识审核及确认，只能继续自己创建的会话；viewer可读取本机构结果并使用只读Agent问答，不能准备或确认写操作。当前未配置按账号细分的校区权限。

AnalysisScope：startDate、endDate、campusIds、courseIds、channelIds、可选dataCutoff。首尾日包含，日期有序，维度数组默认为空；organizationId和authorizedCampusIds只能由服务器提供。

CapabilityResult使用status、message、data，状态ready/unconfigured/not_implemented/error。业务数值未计算或不适用为null，真实零值与未知分别表达。EvidenceReference包含id、kind、sourceId、version、summary、updatedAt及可选scope，指标版本包含实际范围与完成批次指纹。

## 主要接口

公开学习新增 `POST /api/analytics/learning/query`：`{datasetId,learningScope:{courseKeys:[],relativeDayStart?,relativeDayEnd?}}`。返回八项聚合指标、相对周趋势、课程、资源、分数与最终结果分布、导入完整性、批次和证据。相对日允许负数；默认覆盖已完成批次的活动、测评、注册和退出日期范围，不能只用活动日期截断其他记录，也不能套用自然日期。

`POST /api/overview/query` 与 `/api/agent/runs` 支持可选learningScope，必须与原scope互斥；旧模拟经营请求和响应保持兼容。公开总览返回analysisType=learning及LearningAnalysis，模拟继续原DashboardResult。服务端按来源拒绝错误模式和不存在的课程批次；已保存Agent会话只提交sessionId，不能扩展范围。新学习会话scope保存AuthorizedLearningScope至原JSONB，证据learningScope记录课程及相对日，不填写虚构经营日期。学习工具仅query_learning_metrics与search_knowledge，参数不允许SQL、机构或任意范围。

| 接口 | 行为 |
|---|---|
| POST /api/auth/login；GET /api/auth/me、/api/auth/users | 本地登录、当前身份、管理员账号列表 |
| GET /api/overview | 运营聚合与资源/模型配置状态 |
| GET/POST /api/education/datasets；GET /api/education/datasets/:id | 数据集来源、许可、目录和批次 |
| POST /api/data/import-jobs；GET /api/data/import-jobs?datasetId=... | 预检/正式导入、质量报告 |
| POST /api/analytics/query | datasetId、scope、metricCodes，兼容单个metricCode |
| GET/POST /api/tags/proposals；GET/PUT /api/tags/proposals/:id | 风险草稿查询、创建、版本编辑 |
| POST /api/tags/proposals/preview；POST /api/tags/proposals/:id/confirm | 覆盖计算、人工确认发布 |
| GET /api/tags/risk-published/:tagId | 已发布版本及冻结事实 |
| GET/POST /api/segments/risk-snapshots；GET /api/segments/risk-snapshots/:id | 已确认标签建立人群、读取成员快照 |
| GET /api/profiles；POST /api/profiles/search | 画像可选人群；snapshotId及可选entityId |
| GET/POST /api/knowledge/sources；GET/PATCH /api/knowledge/sources/:id | 知识版本列表、新来源/新版本、追溯与编辑 |
| POST /api/knowledge/sources/:id/approve；POST /api/knowledge/search | 审核索引/重试、授权检索 |
| POST /api/agent/runs；GET /api/agent/runs/:id | 受控执行及保存结果 |
| GET /api/agent/sessions、/api/agent/sessions/:id | 本机构会话与历史 |
| POST /api/agent/proposals/confirm | 页面确认已关联的风险标签版本 |

原有数据源、数据模型、标签分类/版本、目标表、位图、人群及系统资源接口保留实际实现。已移除功能不再提供空成功或占位接口。

## 导入与风险确认

导入输入datasetId、kind、filename、csv、mapping、rowOffset、dryRun。网页单批8MiB/20,000行，大文件CLI按5,000行分块；dryRun仅校验，不产生正式批次。来源编号内容相同去重，内容变化拒绝静默覆盖，另建数据版本。

风险创建：datasetId、name、scope、rule；PUT增加version，编辑递增版本并清除预览。rule保留absence_count（minimumAbsences、minimumDue）和attendance_below（thresholdPercent、minimumDue）；本轮扩展规则见后文。预览输入proposalId、version，发布输入version、previewToken。

人群创建输入tagId、tagVersion、previewFingerprint、name。确认绑定确切预览和数据批次；旧版本、过期token、批次变化拒绝。未发布预览有效期30分钟，过期返回409；已发布对象的同凭证重复确认继续幂等。重复发布或创建相同标签版本的人群返回既有对象。未知签到不会直接成为缺勤。

## 知识版本与检索

创建输入title（1–160字符）、kind、content（1–20,000字符）、可选period/dataCutoff/evidence。类型definition/procedure/analysis_snapshot/reviewed_case；新版本同时提交logicalSourceId和正整数expectedVersion。分析摘要必须有周期、截止时间及至少一条依据，evidence最多20条。

草稿编辑提交title、content、expectedContentHash；已审核正文不能直接修改。审核/重试提交expectedVersion、expectedContentHash，正文与标题共同计算hash。审核状态draft/approved/superseded，索引pending/indexing/ready/failed，当前版本由isCurrent表示；尝试编号CAS保护超时重试。

检索输入query（1–1,000字符）、可选scope/limit（1–5）/includeSnapshots。普通检索默认排除分析摘要；显式包含摘要仅限完整同周期、未缩小维度/授权范围，摘要截止不晚于请求截止。命中返回原文、来源、具体版本、相关度和证据。

## Agent执行与确认

新执行提交message（1–4,000字符）、UUID requestKey、datasetId、scope；续会话只提交message、requestKey、sessionId，不可重设范围。服务器冻结数据集和有效截止时间。

| 工具 | 模式 | 输入 |
|---|---|---|
| query_metrics | read | 可选metricCodes，限全部八项经营指标 |
| query_tags | read | 可选proposalId，同数据集/范围 |
| query_profile | read | 可选snapshotId，同数据集/范围的聚合画像 |
| search_knowledge | read | query、可选limit，不检索历史摘要 |
| propose_tag | propose | name、rule，身份及范围由服务器补充 |
| preview_tag_rule | propose | proposalId、version，仅本次执行创建的草稿 |

执行状态queued/running/awaiting_confirmation/completed/failed；结果包含事实卡、步骤、草稿、证据、回答和安全错误。模型最终JSON仅summary/factIds/hypotheses/recommendations/limitations，事实卡数字由程序填入；未知事实引用和叙述重写数字拒绝。

requestKey按机构/用户唯一并绑定内容hash；同编号同内容复用，换内容409。草稿使用服务器生成的运行/工具来源键防重。失败保留已完成步骤和草稿，写工具不自动重试。

页面确认输入runId、proposalId、version、previewToken；核对运行关联后调用既有风险发布服务。此端点不开放给模型，建立人群还需页面另行确认。

## 公开标签与管理接口

GET /api/public/tags与/api/public/tags/values使用有效UUID格式的x-tenant-id选择公开目录；该头只用于查询公开标签，不能建立用户身份。目录及值仅限指定机构、已设为公开的标签，响应不含内部权限、规则配置与操作人字段。未公开标签不可读取，跨机构或不存在返回404。普通受保护接口始终丢弃客户端自报身份和机构头，使用JWT验证后的身份。

账号列表、系统设置、审计、回收站与/api/admin管理操作限管理员。位图创建使用当前机构；详情、分配、释放与状态变更核对机构。监控错误查询和已解决状态更新也限定当前机构，处理不存在或跨机构对象时不改记录。

## 错误

格式400、未登录401、角色禁止403、无对象或跨机构404、版本/token/批次/幂等冲突409。知识配置或索引/检索失败503。Agent缺配置503且不创建运行；准备后失败502并带保存的运行结果。详细失败用安全错误码表达，不回显密钥、认证头或供应商原文。


## 八项指标、预警和报告

analytics/query默认返回八项指标，metricCodes最多八项；兼容单metricCode。结果增加unit（percent/count/currency）、observationCutoff、details.pending以及comparison（范围、指标、变化与原因）。比率变化单位为百分点，客诉为条、退款为元；不足时change=null。用户dataCutoff限制所有观察，未指定时招生/续费可观察至数据集截止，出勤等仍以统计期末为界。

| 接口 | 权限及输入 |
| --- | --- |
| GET /api/alerts；GET /api/alerts/:id | 本机构只读；active=true仅列有效未处理项 |
| POST /api/alerts/evaluate | 管理员/运营；datasetId、scope；返回命中和未评估原因 |
| PATCH /api/alerts/:id | 管理员/运营；version、state（acknowledged/resolved）、note最多1000字符 |
| GET /api/reports；GET /api/reports/:id | 本机构只读，包含冻结依据和生成失败状态 |
| POST /api/reports | 管理员/运营；datasetId、kind（weekly/monthly）、anchorDate、campusIds、courseIds、可选dataCutoff、UUID requestKey |
| GET /api/reports/:id/export | 本机构只读；已完成报告的Markdown文件，未完成返回409 |

报告日期由服务器归属至周一—周日或自然月，比较前一周/自然月。生成响应data.status为generating/completed/failed；生成失败响应保留记录及快照，外层status=error，不声称成功。生成后连接中断可在列表核对已保存任务。重试失败报告须使用新幂等键，原记录保留。

预警open→acknowledged/resolved；resolved不能原地重开。旧版本、失效记录不能操作；重复评估同批数据不会重开已处理项。报告/预警查询、处理及导出均按JWT机构过滤，不接受自报组织或授权范围。

数据集创建与正式导入同样限制管理员/运营人员；只读账号不能改变后续分析所用的数据。

## 运营标签规则与统一总览

保留/api/tags/proposals、/api/tags/proposals/preview、/:id/confirm、/api/segments/risk-snapshots及Agent原地址。

rule新增：
- renewal_due：withinDays整数1—90，默认界面30天。
- hours_remaining：maximumHours大于0且不超过100，默认界面8课时。
- recent_complaint：lookbackDays整数1—90，minimumCount整数1—100，默认界面30天至少1条。
- all/any：conditions为2—5个上述或旧出勤单条件，不允许嵌套；条件在同校区同课程成立。

预览members改为基础学员信息、reason、可选出勤统计、business事实和matches。未计算的出勤字段缺省，不能强制补0。calculatorVersion区分旧出勤/业务计算；evaluation返回matched/unmatched/unknown及逐条件去重人数。修改未发布草稿递增版本并清除预览，旧token、旧版本或批次变化继续409。AgentProposal增加rule/ruleSummary/observedCount/unknownCount，模型工具结果不包含成员明细或确认token。

经营模式POST /api/overview/query输入严格datasetId＋scope，本机构任一登录角色可读，拒绝自报机构与授权字段。返回analysis（八项与对比）、definitions、history（六个月）、dimensions（校区/课程各自八项）、admission（同获取批次线索/有效试听/试听后签约/直接签约）、balances（在班学员余额区间）、completeness、resources和sourceFingerprint。不足保留null或明确状态，试听未完整导入时招生分项不能冒充真实0。

总览不自动评估预警、不调用模型、不发布对象。resources只返回同数据集和分析范围记录；historical/historicalBatch指示与本次批次差异。保留旧GET /api/overview兼容。

跨页面URL保存datasetId和公共scope，省略服务器身份。Agent会话改变范围需新建；sessionId/runId可继续查看保存结果。review=attendance/combination只启用展示引导，不授予执行或发布权限。

Agent收尾明确要求JSON对象；出现结构或自编数字问题时最多一次只读纠正，计入原6轮与120秒预算。失败仍返回明确状态并保留工具事实和草稿；不新增自动发布接口，也不通过纠正重新执行写工具。周报/月报页面根据所选日期及类型同步规范化范围，返回页面链接与服务器冻结的周一—周日或自然月一致。

## 决策与财务接口（2026-10-12）

- POST /api/analytics/finance/query：{datasetId,financeScope:{years:[]}}，空年度数组表示全部完成导入年度；返回八项最新年度指标、上一年度比较、原始金额、来源页码／版本、完整性与证据。
- POST /api/overview/query 与 /api/agent/runs 新会话增加financeScope；与scope、learningScope互斥。旧经营请求保持兼容。已有会话只提交sessionId，不允许重新设定范围。
- 经营工具新增query_metric_breakdown，参数仅dimension=campus/course，由会话数据集、周期与授权确定范围；财务注册表仅query_financial_metrics、search_knowledge，不提供发布工具。
- GET /api/decisions/recommendations：本机构有效建议及已有任务编号。GET /api/decisions：任务列表；GET /api/decisions/owners：可分配的本地操作账号。
- POST /api/decisions：source={kind:agent/report,id,index}、requestKey、disposition=accepted/deferred/rejected、action、ownerId可选、priority=high/normal/low、dueDate、reviewMethod、segmentSnapshotId可选、recordType=demonstration/actual；成功来源由服务端加载，客户端不能提交伪造事实。
- GET /api/decisions/[id]：详情及反馈；PATCH同地址：requestKey、expectedVersion、可选state、kind=adoption/execution/review、note、可选reviewResult/adoptionIntention。完成复核必须提交结论。重复相同请求复用结果，旧版本或非法状态409，越权403／404。
- GET /api/decisions/evaluations：评价列表；POST：{reportId}，对同一冻结报告生成三方案；PATCH /api/decisions/evaluations/[id]：scores五项1—5整数与ratingNote。评分历史保留服务器身份；前端CSV导出不包含成员明细或密钥。

所有身份与机构从服务端账号确定；只读用户只可查询，模型工具未注册任何决策修改操作。正常演示中标签与人群发布仍通过既有页面人工确认。

决策页面对建议来源同时应用数据集与URL经营范围筛选，任务列表及数量保持同范围。财务建议使用年度范围，不能选择模拟人群。人群从同范围已确认快照下拉选择，不要求输入UUID。GET /api/decisions/{id}返回冻结来源及按版本排列反馈；页面可导出采纳意愿、执行、复核CSV，与研究评分CSV分开。未发布标签预览有效期30分钟，已发布同版本同令牌重复确认保持幂等。

## 完整流程体验接口

- 风险预览增加可选expiresAt，旧记录按createdAt加30分钟兼容；明确到期不超过服务端默认有效期。旧版本、过期或批次变化分别返回可选errorCode（VERSION_CONFLICT/PREVIEW_EXPIRED/BATCH_CHANGED）。原状态码及message保留。
- GET /api/segments/risk-snapshots、GET /api/profiles增加可选datasetId、scope(JSON)、sourceTagId、tagVersion筛选。无参数保持原响应；scope仍不能提供服务端身份。
- POST /api/knowledge/sources增加可选reportId，只能用于analysis_snapshot。服务端读取本机构成功经营报告，覆盖周期、截止和证据；旧手工材料接口兼容。列表/详情增加可选needsReindex状态，不返回配置指纹。
- GET /api/agent/runs/progress接收requestKey或runId（二选一）。requestKey限制当前机构和当前用户；已知runId按机构查询，沿用保存结果查看权限。返回prepared、run、deadlineAt、expired。未准备返回prepared=false；查询只读，Cache-Control:no-store。
- POST /api/overview/journey/query输入datasetId、经营scope及可选runId/proposalId/snapshotId/reportId/taskId。返回ready、已核验records、同范围报告候选、blockers和warnings。各节点按机构、数据集、范围与版本关系核验，冲突409，缺失404；该接口不计算标签、不调用模型、不评估预警、不改变业务状态。


## 研究评价、渠道、决策复核与预警配置接口

- `GET /api/decisions/evaluations`：可选reportId、method、status，返回生成状态、可追溯输入上下文和评分历史。`POST`接收reportId与可选caseId，幂等生成三个方案。历史报告输入不全时标有限制；失败保留，不替换成模板。
- `GET /api/decisions/evaluations/summary`：样本数、严格/受限样本、实际评分人数、各方案完成/失败数与五维均分。均分只包含输入完整样本、每账号最新评分。`PATCH /api/decisions/evaluations/:id`沿用五维1—5分和实际核对说明，追加评分历史。
- `POST /api/analytics/channels/catalog`和`/query`：接收datasetId＋经营scope；返回渠道目录，或八指标/同批次漏斗/未知归属/版本及证据。未知来源标识`__unknown__`。查询不建立标签或人群。
- `POST /api/decisions/:id/review/preview`：expectedVersion和可选period，经营period含mode/startDate/endDate，财务period含mode/year。返回前后数值、目标达成（可空）、样本、完整性、证据和previewToken。只读账号可查询。
- 原任务创建增加可选goals：targets最多三项（code、operator=at_least/at_most、target），及可选reviewPeriod。反馈PATCH增加quantitativeReview（period、previewToken），仅用于页面完成复核；服务端重算冻结，不能提交自编结果。重复请求幂等，旧版本/变化批次拒绝。
- `GET /api/alerts/configuration`：当前规则及历史。`PUT`仅管理员，expectedVersion、三规则rules（enabled、threshold、minimumSample）及note；使用局部JSONB更新。
- `POST /api/alerts/replay`：datasetId、scope、1—12个cases（id、name、startDate、endDate、可选expected布尔/null与labelNote）。不写正式预警；返回规则状态、版本、数据批次、独立标注误报/漏报及加载/计算耗时。人工触发等待时间未测定时为空。
- `GET /api/system/diagnostics`：管理员与运营人员的只读状态检查；返回数据库、必要表/字段、vector及模型配置。不能返回密钥、连接字符串或驱动原始错误，不联网调用模型，不初始化数据库。

经营报告创建增加可选channelIds（默认空数组），旧请求保持兼容。Agent维度拆解增加channel。身份与机构由服务端注入，模型不能评分、采纳建议、改变任务状态或发布标签。


### 名单分页与安全诊断

GET /api/segments/risk-snapshots?summary=true返回不含成员的摘要；GET /api/segments/risk-snapshots/:id?page=1&pageSize=20返回snapshot和pagination，页大小1至100。POST /api/profiles/search支持pagination，个人查询仍以entityId精确定位。GET /api/segments/risk-snapshots/:id/export按批读取CSV。旧接口不传分页时保持兼容。

GET /api/system/diagnostics仅管理员与运营角色可访问，返回固定状态、耗时、安全恢复建议；不能作为模型连通性或洞察质量的证明。模型状态就绪只表示配置齐全。


评价生成接受completed或failed冻结报告，generating拒绝。失败原工具方案保留failed及原因，其余方案明确保存各自生成结果；对失败项评分返回400。名单和评分操作仍按机构及角色隔离。
