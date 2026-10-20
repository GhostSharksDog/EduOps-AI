# 项目开发约定

项目：基于业务数据与AI智能体的教培机构运营分析辅助系统。开发者：李丞匀。界面、说明和回答使用中文。

先读README及docs中的architecture、api、data、testing。仅保留实际功能，不以模拟成功、虚假零值或占位页面掩盖未实现能力。

- app只保留页面/布局/API入口，业务在modules；模块按需使用ui/domain/services/repositories/contracts。
- 跨模块使用server/client/contracts公开入口，客户端不得引用数据库、Node专用实现或模型密钥；server入口标记server-only。
- PostgreSQL使用platform/database的连接池、参数化SQL和事务；业务仓储明确编写查询，不构造通用ORM或历史迁移层。
- 机构和权限来自服务端验证身份。保留软删除、版本条件更新、唯一约束、事务锁、数据截止及幂等行为。
- 经营数字由程序计算；公开数据和模拟数据不混算。缺失签到为未知，零分母和数据不足留空并说明。
- RAG知识审核且索引成功才检索；来源/版本可追溯；新版本失败时保留旧版。Agent可以准备业务操作计划，正式发布、保存人群、生成报告和建立任务只能通过页面明确确认；确认不得注册为模型工具。
- 不读取、输出、提交真实环境文件、密码、令牌或个人资料；模型与向量配置独立，仅在服务端使用。
- Ant Design使用App.useApp或项目消息服务；不新增静态message/notification/Modal.confirm。Ant Design 6沿用orientation和popupRender。
- 颜色、字体与主题取shared/theme/palette.ts；公共布局放globals，专属构图放模块CSS Module，图表沿用BusinessChart。视觉调整不改变数值、空值、来源及人工确认含义。
- 分区界面复用shared/ui/Workspace；业务请求仍在模块，读取可用useBusinessApi第四signal取消。目录切换保留URL、编辑保护与明确错误，布局不得重复挂载同一业务读取或自动执行正式操作。
- 页面使用原生history同步对象/范围时传null，不复用window.history.state中的Next内部标记；同地址不重复入栈。移动分区须核对内部文字和固定操作区，不能只检查整页无溢出。
- 数据库初始化仅用于空库，已有数据库不自动重建、迁移或清空。集成与数据库测试只使用专用*_test库，不复用真实服务连接。
- 先完成本轮全部代码和文档，再集中运行typecheck、check:architecture、相关单元/数据库/API/页面和build；仅阻断开发时做最小局部检查，不反复运行大量单元测试或逐项请求确认。完成后统一提交差异和验收记录，结果更新docs/testing.md，不用历史结果替代当前验证。
- 文档限定四份，日常脚本保持用途清晰；测试工具放tests。保留个人署名和有效开发记录，删除无引用资源前先检查。


- 每家公司使用独立PostgreSQL/ClickHouse数据库，API经withCompanyRoute绑定已验证上下文，脚本明确选择公司；禁止回退数据库、请求头选机构及模型提供连接。会话可调范围，历史执行使用自身冻结context。
