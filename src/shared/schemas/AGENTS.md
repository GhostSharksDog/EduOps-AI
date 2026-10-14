# 共享Schema约定

本目录提供Zod通用校验及历史契约兼容聚合入口。业务Schema已经按功能迁移到`src/modules/*/contracts/schemas`；不要在这里重新建立一套业务实现。所有说明和校验提示使用中文，并遵循根目录AGENTS约定。

## 当前组织

- `common/`：分页、基础实体、统一校验消息等通用Schema。
- `request/`、`response/`：尚属共享的审计、权限、位图等契约。
- `index.ts`：聚合并兼容原公开Schema导出，引用各模块的纯契约。
- 模块Schema：`identity`负责身份，`data`负责数据源/模型，`tag`负责标签及导出，`segment`负责人群，`profile`负责画像，`system`负责回收站等管理契约。

新增分析、知识、Agent、报告和教培业务契约放入所属模块`contracts`，纯共享基础类型才放入`src/shared`。

## 校验与兼容

- 请求名沿用`{action}{Entity}Schema`，类型通过`z.infer`生成DTO；响应名沿用`{entity}Schema`并生成VO。
- 使用通用分页Schema和分页响应包装；限制字符串长度、数值范围与枚举等实际业务约束。
- 对需要拒绝未知字段的输入使用`z.strictObject`；不要无差别改变旧接口的额外字段处理方式。
- `.describe()`用于说明字段含义，校验失败提示通过Zod对应错误配置实现。
- 修改总索引时保留已有命名空间导出（如`RequestTag/RequestSegment`）和直接导出名称，避免重复命名和请求/响应符号冲突。
- Schema与模块契约必须保持浏览器可引用，不引入数据库、服务端配置、应用服务或模型密钥。
- `z.lazy`仅用于确有递归关系的契约；增加递归Schema时检查循环初始化及序列化行为。
- 迁移测试按当前模块契约入口引用，并验证非法输入和边界条件，不能只镜像Schema实现。

## 新能力的数据约定

`AnalysisScope`仅表达客户端可选筛选范围，机构和授权校区由服务端补充。`EvidenceReference`绑定来源及版本；草稿绑定规则版本与验证结果；未预览人数使用`null`。能力不可用、缺失数据、零分母和真实零值分别表达，保持与`docs/api.md和docs/data.md`一致。
