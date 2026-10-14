import type {ReportVO} from '../contracts';
import {metricLabels} from '@/modules/analytics/contracts';
const cell=(v:unknown)=>String(v??'—').replace(/\|/g,'\\|').replace(/[\r\n]/g,' ');
const number=(v:number|null,unit?:string)=>v===null?'—':String(v)+(unit==='percent'?'%':unit==='currency'?'元':unit==='count'?'条':'');
export function reportMarkdown(report:ReportVO){
 const s=report.snapshot,a=report.answer;
 const lines=[`# ${report.kind==='weekly'?'运营周报':'运营月报'}`,``,`${s.scope.startDate} 至 ${s.scope.endDate}；对比期 ${s.comparison?.scope.startDate??'—'} 至 ${s.comparison?.scope.endDate??'—'}`,``,`数据来源：${cell(s.dataset.name)}（${s.dataset.origin==='simulated'?'模拟数据，仅用于测试':'公开数据'}）`, `统计截止：${s.scope.dataCutoff}；观察截止：${s.metrics.find(m=>m.observationCutoff)?.observationCutoff??s.scope.dataCutoff}`,`校区：${s.scope.campusIds.join('、')||'全部'}；课程：${s.scope.courseIds.join('、')||'全部'}`,`报告状态：${report.status}`,``, '| 指标 | 本期 | 对比期 | 分子/分母 | 状态和口径 |','| --- | --- | --- | --- | --- |'];
 for(const m of s.metrics){const p=s.comparison?.metrics.find(v=>v.code===m.code);lines.push(`| ${cell(metricLabels[m.code]??m.code)} | ${number(m.value,m.unit)} | ${number(p?.value??null,m.unit)} | ${m.numerator??'—'} / ${m.denominator??'—'} | ${cell(m.status+'；'+m.reason)} |`);}
 for(const [title,values] of [['解读',a?[a.summary]:[report.errorMessage??'尚未生成']],['待验证原因',a?.hypotheses??[]],['行动建议',a?.recommendations??[]],['限制',a?.limitations??[]]] as [string,string[]][]){lines.push('',`## ${title}`,'',...values.map(v=>'- '+cell(v)));}
 lines.push('','## 数据及知识依据','');for(const e of report.evidence)lines.push(`- ${cell(e.kind)}：${cell(e.sourceId)}；版本 ${cell(e.version)}；${cell(e.summary)}`);
 lines.push('','## 导入批次','',...s.batches.map(b=>`- ${b.id} / ${b.kind} / ${b.rows} 条 / ${b.hash}`));return lines.join('\n');
}
