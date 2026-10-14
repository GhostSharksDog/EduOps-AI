'use client';
import {Flex,Tag,Typography} from 'antd';
import dayjs from 'dayjs';
import type {AnalysisScope} from '@/shared/contracts/analysis';
import {channelName} from '@/modules/education/contracts';
export default function AnalysisRangeSummary({name,origin,scope,catalog=[],frozen=false}:{name:string;origin?:string;scope:AnalysisScope;catalog?:{id:string;name:string}[];frozen?:boolean}){
 const names=(ids:string[])=>ids.length?ids.map(id=>catalog.find(c=>c.id===id)?.name??id).join('、'):'全部';
 return <div className="analysis-range-summary compact-range-summary"><Flex gap={8} wrap align="center"><Tag color={origin==='simulated'?'orange':'blue'}>{origin==='simulated'?'模拟经营':origin==='public'?'公开数据':'分析范围'}</Tag><Typography.Text strong>{name}</Typography.Text>{frozen&&<Tag>历史已保存结果</Tag>}<Typography.Text className="scope-period">{scope.startDate} 至 {scope.endDate}</Typography.Text><Typography.Text type="secondary">校区：{names(scope.campusIds)} · 课程：{names(scope.courseIds)}</Typography.Text>{!!scope.channelIds.length&&<Typography.Text type="secondary">渠道：{scope.channelIds.map(id=>catalog.find(c=>c.id===id)?.name??channelName(id)).join('、')}</Typography.Text>}</Flex>{scope.dataCutoff&&<details><summary>数据依据</summary><Typography.Text type="secondary">截止：{dayjs(scope.dataCutoff).format('YYYY-MM-DD HH:mm:ss')} · {frozen?'当时的名单及统计范围保持不变':'当前分析范围'}</Typography.Text></details>}</div>;
}
