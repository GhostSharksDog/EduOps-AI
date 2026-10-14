# 教育数据与教培模拟数据

本目录用于数据准备、复现实验和导入核验。原始文件与生成CSV较大，已从Git跟踪中排除；来源、数量、SHA-256及异常场景保存在 `manifests`。

## OULAD 公开数据

来源：[UCI OULAD发布页](https://archive.ics.uci.edu/dataset/349/open+university+learning+analytics+dataset)，DOI：10.24432/C5KK69，许可CC BY 4.0。按原发布者要求署名。作者为Jakub Kuzilek、Martin Hlosta和Zdenek Zdrahal；公开数据对应英国开放大学2013—2014年的课程批次。

下载地址：`https://archive.ics.uci.edu/static/public/349/open%2Buniversity%2Blearning%2Banalytics%2Bdataset.zip`。本地位于 `raw/oulad/oulad.zip` 和解压后的七张CSV。归档全量审计结果保存在`manifests/oulad.json`，实际文件计数不以网页概述替代。

| 文件 | 实际数据行数 |
|---|---:|
| courses.csv | 22 |
| assessments.csv | 206 |
| studentInfo.csv | 32,593 |
| studentRegistration.csv | 32,593 |
| studentAssessment.csv | 173,912 |
| vle.csv | 6,364 |
| studentVle.csv | 10,655,280 |

完整文件审计的关联错误数均为0，具体缺失值与文件指纹见 `manifests/oulad.json`。32,593是学员与课程批次的组合记录数，不能直接作为去重后的自然人数。活动表按原文件行号保存记录身份，保留原始重复行。注册、退出、测评与学习活动使用原始相对日期；不人为转换为教培签到或付费经营流水。

本轮专用测试库接入六张完整关联表和原活动文件前20,000行；样本数据集名称、描述和导入清单均标注范围。完整原始文件已下载并审计，完整行为导入可按下方命令执行。样本不能用于全量活跃度结论。

## 独立教培模拟数据

默认种子20261009，1,000名学员、3个校区、6类课程、50个班级；业务演示期2026年4—9月。招生及首批签约发生在3月，是演示期的前置业务事件。生成数据为本项目模拟内容，无真实个人信息；稳定内部编号使用`sim:`前缀，学员、线索分别建模，不使用手机号合并身份。

15类CSV覆盖校区、课程、学员、班级、在班关系、合约、线索、试听、课表、签到、课耗、续费、转介绍、客诉及退款，共104,955行；其中2,600个课次、50,154条签到、46,127条课耗。行数与SHA-256见 `manifests/training-sim-20261009.json`。

异常配置保留出勤下降、缺失签到、取消课次和退班退款。相同种子与参数产生相同内容。缺失签到场景保留一条未记录签到的应出勤，课耗流水仍可能存在，不能据此补造签到。

```powershell
npm run education:generate
# 已配置独立运行环境并初始化数据库后：
npm run education:import -- --mode simulation
npm run education:import -- --mode oulad --activity-limit 20000
# 完整活动表导入（大文件，按5000行分块）：
npm run education:import -- --mode oulad
```

两类数据分别建数据集、保存来源与许可、独立统计。查询必须指定一个数据集。字段字典见 `docs/data.md`，导入与指标规则见 `docs/data.md`。

