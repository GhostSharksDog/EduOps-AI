import type {Capability} from '@/shared/contracts/analysis';
export const capabilities:Capability[]=[
 {id:'data',name:'数据中心',status:'ready',description:'管理数据源和数据模型；支持教育CSV映射、预检与批次追溯。',href:'/dashboard/data/import'},
 {id:'tag',name:'标签中心',status:'ready',description:'支持出勤风险规则预览、版本确认发布和数据依据；通用标签计算待完善。',href:'/dashboard/tags/risk'},
 {id:'segment',name:'人群管理',status:'ready',description:'依据已发布出勤标签建立去重成员快照；通用条件树计算待接入。',href:'/dashboard/segments/risk'},
 {id:'profile',name:'画像中心',status:'ready',description:'查看风险人群的出勤、校区、课程和年级分布，以及单学员画像。',href:'/dashboard/data/portrait'},
 {id:'analytics',name:'运营分析',status:'ready',description:'八项经营指标、周期对比及校区课程拆解；观察窗口未完成时留空并说明。',href:'/dashboard/analytics'},
 {id:'alerts',name:'异常预警',status:'ready',description:'出勤下降、满班不足及续费偏低规则，支持关注和处理；不自动发布标签。',href:'/dashboard/alerts'},
 {id:'reports',name:'智能运营报告',status:'ready',description:'冻结数据与对比期，结合审核知识生成周报、月报并导出Markdown。',href:'/dashboard/reports'},
 {id:'knowledge',name:'知识库',status:'ready',description:'管理有来源和版本的业务知识，审核后建立索引并检索引用。',href:'/dashboard/knowledge'},
 {id:'agent',name:'Agent助手',status:'ready',description:'查询指标和知识、解释分析结果、提出风险规则并预览；发布由用户确认。',href:'/dashboard/agent'},
];
