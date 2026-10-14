import type {EducationSnapshot, StoredEducationRow} from '../contracts/data';
import type {AuthorizedScope} from '@/shared/contracts/analysis';

/** 版本随归属规则变化递增；历史证据与快照保留原版本。 */
export const channelAttributionVersion = 'first-purchase-context-v1';
export const unknownChannelId = '__unknown__';
const names:Record<string,string> = {referral:'转介绍',online:'线上渠道',walk_in:'到店咨询',[unknownChannelId]:'未知来源'};
export const channelName = (id:string) => names[id] ?? id;
export const channelContextKey = (studentId:string,campusId:string,courseId:string) => JSON.stringify([studentId,campusId,courseId]);
export const effectiveChannelId = (value:unknown) => typeof value === 'string' && value.trim() && value !== unknownChannelId ? value.trim() : unknownChannelId;
export interface ChannelAttribution {
    studentId:string;campusId:string;courseId:string;channelId:string;
    status:'known'|'unknown';reason:string;firstContractId:string|null;leadId:string|null;
}
export interface ChannelAttributionIndex {
    version:string;dataCutoff:string;contexts:ChannelAttribution[];
    get(studentId:string,campusId:string,courseId:string):ChannelAttribution;
    matches(studentId:string,campusId:string,courseId:string,channelIds:readonly string[]):boolean;
}
export const validOperationalContract = (r:StoredEducationRow) => !['cancelled','revoked','void','invalid'].includes(String(r.payload.status ?? '')) && Number(r.payload.purchasedHours)>0;
const signedAt = (r:StoredEducationRow) => Date.parse(String(r.payload.signedAt));
const sameContext = (a:StoredEducationRow,b:StoredEducationRow) => String(a.payload.studentId)===String(b.payload.studentId) && a.campusId===b.campusId && a.courseId===b.courseId;

/** 仅依据截止前明确的合约和续费链归属，不使用姓名、手机号或后续线索推测来源。 */
export function buildChannelAttribution(snapshot:EducationSnapshot,dataCutoff:string):ChannelAttributionIndex {
    const cutoff=Date.parse(dataCutoff);
    const contracts=snapshot.records.filter(r=>r.kind==='contract'&&validOperationalContract(r)&&Number.isFinite(signedAt(r))&&signedAt(r)<=cutoff);
    const contractMap=new Map(contracts.map(r=>[r.sourceId,r]));
    const leads=new Map(snapshot.records.filter(r=>r.kind==='lead'&&Date.parse(String(r.payload.acquiredAt))<=cutoff).map(r=>[r.sourceId,r]));
    const parents=new Map<string,Set<string>>(),invalidChildren=new Set<string>();
    for(const renewal of snapshot.records.filter(r=>r.kind==='renewal'&&r.occurredAt&&Date.parse(r.occurredAt)<=cutoff)) {
        const old=contractMap.get(String(renewal.payload.contractId)),next=contractMap.get(String(renewal.payload.newContractId));
        if(!next)continue;
        if(!old||!sameContext(old,next)||String(renewal.payload.studentId)!==String(next.payload.studentId)||signedAt(next)<signedAt(old)||signedAt(next)>Date.parse(renewal.occurredAt!)) {invalidChildren.add(next.sourceId);continue;}
        const p=parents.get(next.sourceId)??new Set<string>();p.add(old.sourceId);parents.set(next.sourceId,p);
    }
    const roots=(c:StoredEducationRow):{root:StoredEducationRow|null;error:string}=>{
        const visited=new Set<string>();let current=c;
        while(true) {
            if(visited.has(current.sourceId))return {root:null,error:'续费合约链存在循环'};
            visited.add(current.sourceId);
            if(invalidChildren.has(current.sourceId))return {root:null,error:'续费合约关联缺失或学员、校区、课程不一致'};
            const p=parents.get(current.sourceId);
            if(!p?.size)return {root:current,error:''};
            if(p.size!==1)return {root:null,error:'续费合约具有冲突的首购关联'};
            current=contractMap.get([...p][0])!;
        }
    };
    const grouped=new Map<string,StoredEducationRow[]>();
    for(const c of contracts){const key=channelContextKey(String(c.payload.studentId),c.campusId,c.courseId);grouped.set(key,[...(grouped.get(key)??[]),c]);}
    const index=new Map<string,ChannelAttribution>();
    for(const [key,list] of grouped) {
        list.sort((a,b)=>signedAt(a)-signedAt(b)||a.sourceId.localeCompare(b.sourceId));
        const first=list[0],base={studentId:String(first.payload.studentId),campusId:first.campusId,courseId:first.courseId};
        // 同时存在多个首购不能按记录编号挑选渠道；明确关联相同渠道时才可认定。
        const candidates=list.filter(c=>signedAt(c)===signedAt(first));
        let reason='',leadId:string|null=null,firstContractId:string|null=null;const channels=new Set<string>();
        for(const c of candidates) {
            const resolved=roots(c);if(!resolved.root){reason=resolved.error;break;}
            const root=resolved.root,id=typeof root.payload.leadId==='string'?root.payload.leadId:null,lead=id?leads.get(id):undefined;
            if(!lead){reason='首次有效首购缺少截止前可核验的来源线索';break;}
            if(lead.campusId!==base.campusId||lead.courseId!==base.courseId||Date.parse(String(lead.payload.acquiredAt))>signedAt(root)) {reason='首购线索与校区、课程或签约时间不一致';break;}
            const channel=effectiveChannelId(lead.payload.channelId);
            if(channel===unknownChannelId){reason='首购线索缺少明确渠道';break;}
            channels.add(channel);leadId=id;firstContractId=root.sourceId;
        }
        // 后续有效续费若关联到错误上下文或多个根，不静默当成同一渠道。
        for(const c of list){const result=roots(c);if(result.error){reason=result.error;break;}}
        if(channels.size>1)reason='同一校区课程的首次首购渠道冲突';
        index.set(key,{...base,status:reason?'unknown':'known',channelId:reason?unknownChannelId:[...channels][0]??unknownChannelId,reason:reason||'由同校区同课程首次有效首购明确关联线索，续费沿用',firstContractId:reason?null:firstContractId,leadId:reason?null:leadId});
    }
    const get=(studentId:string,campusId:string,courseId:string):ChannelAttribution=>index.get(channelContextKey(studentId,campusId,courseId))??{studentId,campusId,courseId,channelId:unknownChannelId,status:'unknown',reason:'截止前没有可核验的同校区同课程首购合约',firstContractId:null,leadId:null};
    return {version:channelAttributionVersion,dataCutoff,contexts:[...index.values()],get,matches:(studentId,campusId,courseId,ids)=>!ids.length||ids.includes(get(studentId,campusId,courseId).channelId)};
}

export function selectedChannelContext(index:ChannelAttributionIndex,scope:AuthorizedScope,row:StoredEducationRow,studentId=String(row.payload.studentId??row.studentId)) {
    return index.matches(studentId,row.campusId,row.courseId,scope.channelIds);
}
export function channelCatalog(snapshot:EducationSnapshot,scope:AuthorizedScope) {
    const cutoff=Math.min(Date.parse(snapshot.dataset.dataCutoff),scope.dataCutoff?Date.parse(scope.dataCutoff):Infinity,Date.parse(scope.endDate+'T23:59:59.999+08:00'));
    const ids=new Set(snapshot.records.filter(r=>r.kind==='lead'&&Date.parse(String(r.payload.acquiredAt))<=cutoff&&(!scope.campusIds.length||scope.campusIds.includes(r.campusId))&&(!scope.courseIds.length||scope.courseIds.includes(r.courseId))&&(!scope.authorizedCampusIds.length||scope.authorizedCampusIds.includes(r.campusId))).map(r=>effectiveChannelId(r.payload.channelId)));
    ids.add(unknownChannelId);
    return [...ids].sort((a,b)=>a===unknownChannelId?1:b===unknownChannelId?-1:a.localeCompare(b)).map(id=>({id,name:channelName(id)}));
}
