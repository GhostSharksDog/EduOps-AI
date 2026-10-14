import {metricCodes} from '../contracts';
import {metricDefinitions} from './metrics';
import {businessMetrics} from './business-metrics';
import {buildAttendanceFacts,buildChannelAttribution,channelAttributionVersion,validOperationalContract} from '@/modules/education/contracts';
import type {EducationSnapshot,StoredEducationRow} from '@/modules/education/contracts';
import type {AuthorizedScope,EvidenceReference} from '@/shared/contracts/analysis';
import type {OperationalAnalysis,OperationalMetric} from '../contracts';
export const operationalKinds=['campus','course','student','class','enrollment','contract','lesson','attendance','hours','refund','lead','trial','renewal','complaint'] as const;
/** 数据库仅提供已按相同范围汇总的数字；纯计算路径继续用于独立对照。 */
export interface OperationalAggregateInput {
 attendance:ReturnType<typeof buildAttendanceFacts>;
 metrics:Partial<Record<string,{numerator:number|null;denominator:number|null;unknown:number;reason:string;details:Record<string,number>}>>;
}
const localDay=(value:unknown)=>new Date(new Date(String(value)).getTime()+8*3600000).toISOString().slice(0,10);
const active=(r:StoredEducationRow,day:string)=>String(r.payload.startDate)<=day&&(!r.payload.endDate||String(r.payload.endDate)>day);
const percent=(n:number,d:number)=>d>0?Math.round(n/d*10000)/100:null;
export function calculateOperations(snapshot:EducationSnapshot,requested:AuthorizedScope,codes:string[]=[...metricCodes],aggregate?:OperationalAggregateInput):OperationalAnalysis{
    const observationCutoff=new Date(Math.min(Date.parse(snapshot.dataset.dataCutoff),requested.observationCutoff?Date.parse(requested.observationCutoff):requested.dataCutoff?Date.parse(requested.dataCutoff):Infinity)).toISOString();
    const dataset=snapshot.dataset,cutoff=new Date(Math.min(Date.parse(dataset.dataCutoff),requested.dataCutoff?Date.parse(requested.dataCutoff):Infinity,Date.parse(requested.endDate+'T23:59:59.999+08:00'))).toISOString(),scope={...requested,dataCutoff:cutoff};
    const batches=snapshot.batches.filter(b=>b.status==='completed');
    const evidence:EvidenceReference[]=[{id:dataset.id,kind:'metric',sourceId:dataset.id,version:'operations-v3/'+channelAttributionVersion+'/schema-'+dataset.schemaVersion,summary:`${dataset.origin==='simulated'?'模拟':'公开'}数据；关联${batches.length}个已完成批次；渠道按同校区同课程首次有效首购归属`,scope,updatedAt:cutoff}];
    const output:OperationalAnalysis={dataset:{id:dataset.id,name:dataset.name,origin:dataset.origin,sourceUrl:dataset.sourceUrl},scope,metrics:[],trend:[],breakdown:[],riskStudents:[],batches:batches.map(b=>({id:b.id,kind:b.kind,rows:b.acceptedRows,hash:b.fileHash}))};
    const metric=(code:string,n:number|null,d:number|null,unknown=0,reason='',details:Record<string,number>={},status?:OperationalMetric['status']):OperationalMetric=>{
      const unit=metricDefinitions.find(m=>m.code===code)?.unit??'percent',ratio=unit==='percent',valid=n!==null&&!unknown&&(!ratio||d!==null&&d>0);
      return {code,unit,numerator:n,denominator:d,value:valid?(ratio?percent(n!,d!):n):null,unknownCount:unknown,reason:reason||(!valid&&ratio?'分母为零或数据不足，无法计算':''),status:status??(valid?'ready':'insufficient_data'),scope,evidence,details};
    };
    if(dataset.origin==='public'){output.metrics=codes.map(c=>metric(c,null,null,0,'OULAD缺少逐课签到、班额及购课流水，无法计算教培经营指标',{},'not_applicable'));return output;}
    const byKind=(kind:string)=>snapshot.records.filter(r=>r.kind===kind);
    const channels=buildChannelAttribution(snapshot,cutoff);
    const selected=(r:StoredEducationRow)=>(!scope.campusIds.length||scope.campusIds.includes(r.campusId))&&(!scope.authorizedCampusIds.length||scope.authorizedCampusIds.includes(r.campusId))&&(!scope.courseIds.length||scope.courseIds.includes(r.courseId));
    const classes=byKind('class').filter(selected),classMap=new Map(classes.map(r=>[r.sourceId,r])),members=new Map<string,StoredEducationRow[]>();
    for(const r of byKind('enrollment')){const id=String(r.payload.classId);if(classMap.has(id))members.set(id,[...(members.get(id)??[]),r]);}
    const facts=aggregate?.attendance??buildAttendanceFacts(snapshot,scope),total=facts.total;
    output.trend=facts.periods.map(({period,counts:t})=>({period,value:t.unknown?null:percent(t.present,t.due),present:t.present,due:t.due,unknown:t.unknown}));
    output.breakdown=facts.groups.map(t=>({...t,value:t.unknown?null:percent(t.present,t.due)}));
    output.riskStudents=facts.students.filter(t=>t.absent||t.leave||t.unknown).sort((a,b)=>b.absent-a.absent||b.unknown-a.unknown).slice(0,100);
    const asOf=localDay(cutoff);let occupied=0,capacity=0,over=0;
    for(const cls of classes){if(String(cls.payload.startDate)>asOf||(cls.payload.endDate&&String(cls.payload.endDate)<asOf))continue;const activeMembers=(members.get(cls.sourceId)??[]).filter(r=>active(r,asOf));const all=new Set(activeMembers.map(r=>String(r.payload.studentId))).size;const n=new Set(activeMembers.filter(r=>channels.matches(String(r.payload.studentId),cls.campusId,cls.courseId,scope.channelIds)).map(r=>String(r.payload.studentId))).size;occupied+=n;capacity+=Number(cls.payload.capacity);if(all>Number(cls.payload.capacity))over++;}
    const contracts=byKind('contract').filter(r=>selected(r)&&validOperationalContract(r)&&channels.matches(String(r.payload.studentId),r.campusId,r.courseId,scope.channelIds)&&Date.parse(String(r.payload.signedAt))<=Date.parse(cutoff)&&String(r.payload.endDate)>=scope.startDate),ids=new Set(contracts.map(r=>r.sourceId));let purchased=0,consumed=0,refunded=0;
    for(const c of contracts)purchased+=Number(c.payload.purchasedHours);
    for(const r of byKind('hours'))if(ids.has(String(r.payload.contractId))&&r.occurredAt&&Date.parse(r.occurredAt)<=Date.parse(cutoff))consumed+=Number(r.payload.hours)*(r.payload.status==='reversed'?-1:1);
    for(const r of byKind('refund'))if(ids.has(String(r.payload.contractId))&&r.payload.status==='completed'&&r.occurredAt&&Date.parse(r.occurredAt)<=Date.parse(cutoff))refunded+=Number(r.payload.refundedHours);
    const available=purchased-refunded,has=(k:string[])=>k.every(kind=>batches.some(b=>b.kind===kind)&&(dataset.expectedRows?.[kind]===undefined||batches.filter(b=>b.kind===kind).reduce((n,b)=>n+b.acceptedRows,0)===dataset.expectedRows[kind]));
    const known:Record<string,OperationalMetric>={attendance_rate:has(['class','enrollment','lesson','attendance'])?metric('attendance_rate',total.present,total.due,total.unknown,total.unknown?'存在缺失、未知或冲突签到，补齐后才显示完整出勤率':'请假计入应出勤，取消课程及退班后课次排除',{absent:total.absent,leave:total.leave,known:total.due-total.unknown}):metric('attendance_rate',null,null,0,'尚未完成班级、在班、课表及签到导入'),class_fill_rate:has(['class','enrollment'])?metric('class_fill_rate',occupied,capacity,over,over?'存在超额班级，请检查班额或在班记录':'期末有效在班席位／有效班额',{classes:classes.length}):metric('class_fill_rate',null,null,0,'尚未完成班级及在班导入'),hours_progress:has(['contract','hours','refund'])?metric('hours_progress',consumed,available,consumed<0||available<0||consumed>available?1:0,consumed<0||available<0||consumed>available?'净课耗与净购课时不一致，请核对流水':'与统计期相交的合约：累计净课耗／扣除退款后的净购课时',{purchased,refunded}):metric('hours_progress',null,null,0,'尚未完成合约、课耗及退款导入')};
    if(scope.channelIds.length){known.class_fill_rate.displayName='渠道席位贡献率';known.class_fill_rate.reason=over?'存在超额班级，请检查班额或在班记录':'所选渠道有效在班席位／所选班级总班额；不表示渠道自身满班率';known.class_fill_rate.details.channelContribution=1;}
    Object.assign(known,businessMetrics(snapshot,scope,observationCutoff,metric,has,channels));
    if(aggregate)for(const [code,value] of Object.entries(aggregate.metrics))if(value&&known[code]&&known[code].numerator!==null){known[code]={...metric(code,value.numerator,value.denominator,value.unknown,value.reason,value.details),...(known[code].observationCutoff?{observationCutoff:known[code].observationCutoff}:{})};}
    if(scope.channelIds.length&&!has(['lead','contract','renewal']))for(const code of metricCodes.filter(c=>c!=='admission_conversion')){known[code]={...known[code],value:null,status:'insufficient_data',reason:'渠道归属所需线索、合约或续费数据尚未完整导入，不能将缺失来源当作零结果'};}
    output.metrics=codes.map(c=>known[c]??metric(c,null,null,0,'该指标仍待实现',{},'not_implemented'));return output;
}
