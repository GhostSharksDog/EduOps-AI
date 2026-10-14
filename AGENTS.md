# 项目开发约定

项目：基于业务数据与AI智能体的教培机构运营分析辅助系统。开发者：李丞匀。界面、说明和回答使用中文。

先读README及docs中的architecture、api、data、testing。仅保留实际功能，不以模拟成功、虚假零值或占位页面掩盖未实现能力。

- app只保留页面/布局/API入口，业务在modules；模块按需使用ui/domain/services/repositories/contracts。
- 跨模块使用server/client/contracts公开入口，客户端不得引用数据库、Node专用实现或模型密钥；server入口标记server-only。
- PostgreSQL使用platform/database的连接池、参数化SQL和事务；业务仓储明确编写查询，不构造通用ORM或历史迁移层。
- 机构和权限来自服务端验证身份。保留软删除、版本条件更新、唯一约束、事务锁、数据截止及幂等行为。
- 经营数字由程序计算；公开数据和模拟数据不混算。缺失签到为未知，零分母和数据不足留空并说明。
- RAG知识审核且索引成功才检索；来源/版本可追溯；新版本失败时保留旧版。Agent不能发布标签或创建正式人群，确认必须来自页面。
- 不读取、输出、提交真实环境文件、密码、令牌或个人资料；模型与向量配置独立，仅在服务端使用。
- Ant Design使用App.useApp或项目消息服务；不新增静态message/notification/Modal.confirm。Ant Design 6沿用orientation和popupRender。
- 数据库初始化仅用于空库，已有数据库不自动重建、迁移或清空。集成与数据库测试只使用专用*_test库，不复用真实服务连接。
- 先完成本轮全部代码和文档，再集中运行typecheck、check:architecture、相关单元/数据库/API/页面和build；仅阻断开发时做最小局部检查，不反复运行大量单元测试或逐项请求确认。完成后统一提交差异和验收记录，结果更新docs/testing.md，不用历史结果替代当前验证。
- 文档限定四份，日常脚本保持用途清晰；测试工具放tests。保留个人署名和有效开发记录，删除无引用资源前先检查。

