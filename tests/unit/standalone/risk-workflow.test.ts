import {describe,it,expect} from 'vitest';
import {buildAttendanceFacts,completeKinds} from '@/modules/education/contracts';
import type {EducationSnapshot,StoredEducationRow,StudentAttendanceVO} from '@/modules/education/contracts';
import {selectRiskMembers,assertConfirmation,assertPreviewable} from '@/modules/tag/domain/risk';
import {sourceFingerprint,RiskTagService} from '@/modules/tag/services/risk-service';
import type {RiskProposalRepository,RiskEducationPort} from '@/modules/tag/services/risk-service';
import {riskDraftSchema,confirmRiskSchema} from '@/modules/tag/contracts';
import type {RiskProposalVO,RiskPreviewVO,RiskDraftDTO} from '@/modules/tag/contracts';
import {riskCrowdProfile,riskStudentProfile} from '@/modules/profile/domain/risk-profile';
import {RiskSegmentService} from '@/modules/segment/services/risk-snapshot-service';
import {canAccess} from '@/modules/identity/contracts/local';
import {TagQueryDomainServiceImpl} from '@/modules/tag/domain/services/TagQueryDomainServiceImpl';
import {SegmentQueryApplicationServiceImpl} from '@/modules/segment/services/SegmentQueryApplicationServiceImpl';
const org='00000000-0000-4000-8000-000000000001',datasetId='00000000-0000-4000-8000-000000000002',scope={organizationId:org,authorizedCampusIds:[],startDate:'2026-08-01',endDate:'2026-08-31',campusIds:[],courseIds:[],channelIds:[]};
function fixture():EducationSnapshot{
    const records:StoredEducationRow[]=[];
    const add=(kind:StoredEducationRow['kind'],id:string,payload:Record<string,unknown>)=>records.push({kind,sourceId:id,payload:{id,...payload},campusId:'campus',courseId:'course',classId:'class',studentId:String(payload.studentId??''),batchId:'batch-'+kind,hash:id,occurredAt:null,relativeDay:null});
    add('student','s1',{displayName:'学员1',gradeBand:'三年级'});add('student','s2',{displayName:'学员2',gradeBand:'四年级'});add('class','class',{name:'班1',capacity:20,startDate:'2026-08-01',endDate:'2026-08-31'});add('campus','campus',{name:'一校区'});add('course','course',{name:'数学'});
    add('enrollment','e1',{classId:'class',studentId:'s1',startDate:'2026-08-01'});add('enrollment','e1-dup',{classId:'class',studentId:'s1',startDate:'2026-08-01'});add('enrollment','e2',{classId:'class',studentId:'s2',startDate:'2026-08-01',endDate:'2026-08-02'});
    add('lesson','l1',{classId:'class',startsAt:'2026-08-01T01:00:00Z',status:'completed'});add('lesson','l2',{classId:'class',startsAt:'2026-08-02T01:00:00Z',status:'completed'});add('lesson','l3',{classId:'class',startsAt:'2026-08-03T01:00:00Z',status:'cancelled'});
    add('attendance','a1',{lessonId:'l1',studentId:'s1',status:'absent',recordedAt:'2026-08-01T02:00:00Z'});add('attendance','a2',{lessonId:'l1',studentId:'s2',status:'present',recordedAt:'2026-08-01T02:00:00Z'});add('attendance','a3',{lessonId:'l2',studentId:'s1',status:'present',recordedAt:'2026-08-02T02:00:00Z'});
    const dataset={id:datasetId,key:'fixture',name:'核验',origin:'simulated' as const,license:'测试',schemaVersion:'1' as const,dataCutoff:'2026-08-31T15:59:59Z',description:'测试',createdAt:'2026-08-01T00:00:00Z'};
    return{dataset,records,batches:[...new Set(records.map(r=>r.kind))].map(kind=>({id:'batch-'+kind,datasetId,kind,filename:kind+'.csv',status:'completed',inputRows:records.filter(r=>r.kind===kind).length,acceptedRows:records.filter(r=>r.kind===kind).length,rejectedRows:0,duplicateRows:0,issues:[],createdAt:dataset.createdAt,completedAt:dataset.dataCutoff,error:null,fileHash:kind}))};
}
const student=(extra:Partial<StudentAttendanceVO>={}):StudentAttendanceVO=>({studentId:'s',displayName:'学员',gradeBand:'三年级',present:1,due:3,absent:2,leave:0,unknown:0,attendanceRate:33.33,campusIds:['c'],courseIds:['k'],...extra});
const draft={datasetId,name:'风险',scope:{startDate:scope.startDate,endDate:scope.endDate,campusIds:[],courseIds:[],channelIds:[]},rule:{type:'attendance_below' as const,thresholdPercent:80,minimumDue:1}};
describe('标签分批计算与冻结数据边界',()=>{
    async function preview(snapshot:EducationSnapshot,batched:boolean,rule:RiskDraftDTO['rule']=draft.rule,changed=false){
        let proposal:RiskProposalVO={id:'batch-p',datasetId,name:'分批核对',scope,rule,version:1,status:'draft',preview:null,publishedTagId:null,createdAt:'',updatedAt:''};
        const repo={get:async()=>proposal,savePreview:async(_:string,__:string,___:number,p:RiskPreviewVO)=>{proposal={...proposal,preview:p};return proposal;}} as unknown as RiskProposalRepository;
        const edu:RiskEducationPort={snapshot:async()=>{if(batched)throw Error('不得读取完整行为快照');return snapshot;},inspect:async()=>({batches:changed?[...snapshot.batches,{...snapshot.batches[0],id:'changed'}]:snapshot.batches})};
        if(batched)edu.studentSnapshots=async function*(){for(const id of ['s1','s2'])yield{...snapshot,records:snapshot.records.filter(r=>!['student','enrollment','attendance'].includes(r.kind)||(r.kind==='student'?r.sourceId:r.payload.studentId)===id)};};
        return (await new RiskTagService(repo,edu).preview(org,'batch-p',1)).preview!;
    }
    it('按学员批次得到与全量基准相同的名单、未知数及条件依据',async()=>{
        const snapshot=fixture();for(const rule of [draft.rule,{type:'absence_count' as const,minimumAbsences:1,minimumDue:1},{type:'all' as const,conditions:[draft.rule,{type:'absence_count' as const,minimumAbsences:1,minimumDue:1}]}]){
            const full=await preview(snapshot,false,rule),batch=await preview(snapshot,true,rule);
            expect(batch.members).toEqual(full.members);expect(batch.observedCount).toBe(full.observedCount);expect(batch.unknownStudentCount).toBe(full.unknownStudentCount);expect(batch.evaluation).toEqual(full.evaluation);
        }
    });
    it('没有签到的学员在分批后仍为未知，不受另一批学员记录影响',async()=>{const snapshot=fixture();snapshot.records=snapshot.records.filter(r=>r.sourceId!=='a2');const rule={type:'all' as const,conditions:[draft.rule,{...draft.rule,thresholdPercent:90}]};const full=await preview(snapshot,false,rule),batch=await preview(snapshot,true,rule);expect(batch.evaluation).toEqual(full.evaluation);expect(batch.unknownStudentCount).toBe(1);});
    it('计算期间完成新批次时拒绝保存过期预览',async()=>{await expect(preview(fixture(),true,draft.rule,true)).rejects.toThrow('计算期间数据批次已变化');});
});
describe('出勤风险的完整计算口径',()=>{
    it('在班和签到按自然键去重，取消课程和退班后的课次排除',()=>{const facts=buildAttendanceFacts(fixture(),scope);expect(facts.total).toEqual({present:2,due:3,absent:1,leave:0,unknown:0});expect(facts.students.find(s=>s.studentId==='s1')).toMatchObject({due:2,attendanceRate:50});});
    it('未知签到不满足出勤率阈值；已确认缺勤次数可独立匹配',()=>{const s=student({unknown:1,present:0});expect(selectRiskMembers([s],draft.rule)).toHaveLength(0);expect(selectRiskMembers([s],{type:'absence_count',minimumAbsences:2,minimumDue:1})).toHaveLength(1);});
    it('最小应出勤数和严格小于阈值生效，零分母不匹配',()=>{expect(selectRiskMembers([student({due:0,present:0}),student({studentId:'low-sample',due:1}),student({studentId:'boundary',due:5,present:4})],{type:'attendance_below',thresholdPercent:80,minimumDue:4})).toHaveLength(0);});
    it('判断使用原始比率，展示舍入不会改变边界',()=>{expect(selectRiskMembers([student({due:300,present:100,attendanceRate:33.33})],{type:'attendance_below',thresholdPercent:33.33,minimumDue:1})).toHaveLength(0);});
    it('全量预览不受看板100人展示限制',()=>{expect(selectRiskMembers(Array.from({length:150},(_,i)=>student({studentId:'s'+i})),draft.rule)).toHaveLength(150);});
    it('晚于截止时间的签到为未知，课程与校区授权筛选一致',()=>{const s=fixture();expect(buildAttendanceFacts(s,{...scope,dataCutoff:'2026-08-01T01:30:00Z'}).total.unknown).toBe(2);expect(buildAttendanceFacts(s,{...scope,authorizedCampusIds:['other']}).total.due).toBe(0);});
    it('同课冲突签到为未知，不能以另一条签到覆盖',()=>{const s=fixture(),r=s.records.find(r=>r.sourceId==='a1')!;s.records.push({...r,sourceId:'conflict',payload:{...r.payload,status:'present'}});expect(buildAttendanceFacts(s,scope).total.unknown).toBe(1);});
    it('公开数据、未完整导入与导入中不能预览',()=>{const s=fixture();s.dataset.origin='public';expect(()=>assertPreviewable(s,true)).toThrow('不适用');s.dataset.origin='simulated';expect(()=>assertPreviewable(s,false)).toThrow('完整导入');s.batches[0].status='running';expect(()=>assertPreviewable(s,true)).toThrow('进行中');});
    it('文件行数不足不是零覆盖结果',()=>{const s=fixture();s.dataset={...s.dataset,expectedRows:{attendance:100}};expect(completeKinds(s,['attendance'])).toBe(false);});
    it('授权身份、额外SQL和非法阈值不进入结构化规则',()=>{expect(riskDraftSchema.safeParse({...draft,scope:{...draft.scope,organizationId:'forged'}}).success).toBe(false);expect(riskDraftSchema.safeParse({...draft,rule:{...draft.rule,sql:'DROP TABLE'}}).success).toBe(false);expect(riskDraftSchema.safeParse({...draft,rule:{...draft.rule,thresholdPercent:101}}).success).toBe(false);expect(confirmRiskSchema.safeParse({version:1}).success).toBe(false);});
});
describe('版本确认与证据',()=>{
    it('旧人群列表在默认机构和另一机构均传递机构范围',async()=>{const filters:unknown[]=[];const service=new SegmentQueryApplicationServiceImpl({findAll:async(f:unknown)=>{filters.push(f);return{items:[],total:0,page:1,pageSize:10};}} as never,{} as never);await service.listSegments({ownedBy:org});await service.listSegments({ownedBy:'other',tenantFilter:{tenantId:'other'}});expect(filters.map(f=>(f as {ownedBy:string}).ownedBy)).toEqual([org,'other']);});
    it('旧标签列表和计数保留机构范围；公开查询保留公开标记及目录范围',async()=>{const filters:unknown[]=[];const service=new TagQueryDomainServiceImpl({findAll:async(filter:unknown)=>{filters.push(filter);return [];}} as never);await service.searchTags({ownedBy:org});await service.countTagsByCriteria({ownedBy:org});await service.searchTags({isPublic:true,tenantFilter:{tenantId:org}});await service.countTagsByCriteria({isPublic:true,tenantFilter:{tenantId:org}});expect(filters).toEqual([{ownedBy:org},{ownedBy:org},{isPublic:true,tenantFilter:{tenantId:org}},{isPublic:true,tenantFilter:{tenantId:org}}]);});
    it('批次签名对顺序不敏感，新增批次或文件版本会变化',()=>{const s=fixture(),fp=sourceFingerprint(datasetId,s.batches);expect(sourceFingerprint(datasetId,[...s.batches].reverse())).toBe(fp);expect(sourceFingerprint(datasetId,[...s.batches,{...s.batches[0],id:'new'}])).not.toBe(fp);expect(sourceFingerprint(datasetId,s.batches.map((b,i)=>i?b:{...b,fileHash:'changed'}))).not.toBe(fp);});
    it('旧规则版本、旧预览令牌和无预览都不能确认',()=>{const p={version:2,status:'awaiting_confirmation',preview:{ruleVersion:2,token:'new'} as RiskPreviewVO};expect(()=>assertConfirmation(p,1,'new')).toThrow('重新预览');expect(()=>assertConfirmation(p,2,'old')).toThrow('重新预览');expect(()=>assertConfirmation({...p,preview:null},2,'new')).toThrow();});
    it('未发布预览半小时后过期，已发布重复确认保留幂等',()=>{const p={version:1,status:'awaiting_confirmation',preview:{ruleVersion:1,token:'same',createdAt:new Date(Date.now()-31*60000).toISOString()} as RiskPreviewVO};expect(()=>assertConfirmation(p,1,'same')).toThrow('过期');expect(()=>assertConfirmation({...p,status:'published'},1,'same')).not.toThrow();});
    it('用例预览绑定全量事实；确认前的新数据会拒绝发布',async()=>{
        const snapshot=fixture();let p:RiskProposalVO={id:'p',datasetId,name:'风险',scope,rule:draft.rule,version:1,status:'draft',preview:null,publishedTagId:null,createdAt:'',updatedAt:''};
        const repo={get:async()=>p,savePreview:async(_:string,__:string,___:number,preview:RiskPreviewVO)=>{p={...p,status:'awaiting_confirmation',preview};return p;},publish:async(_:string,__:string,___:string,____:number,_____:string,validate:(p:RiskProposalVO)=>Promise<void>)=>{await validate(p);return p;}} as unknown as RiskProposalRepository;
        const edu={snapshot:async()=>snapshot,inspect:async()=>({batches:snapshot.batches})} as RiskEducationPort;
        const service=new RiskTagService(repo,edu),preview=await service.preview(org,'p',1);expect(preview.preview?.members.map(m=>m.studentId)).toEqual(['s1']);snapshot.batches.push({...snapshot.batches[0],id:'new-batch'});await expect(service.confirm(org,'user','p',1,preview.preview!.token)).rejects.toThrow('批次已变化');
    });
    it('人群建立必须绑定已发布标签版本和预览指纹',async()=>{const service=new RiskSegmentService({create:async()=>{throw Error('不得调用');}} as never,{published:async()=>({version:2,preview:{fingerprint:'b'.repeat(64)}})} as never);await expect(service.create(org,'user',{tagId:datasetId,tagVersion:1,previewFingerprint:'a'.repeat(64),name:'人群'})).rejects.toThrow('版本或计算依据');});
    it('只读用户可查询画像，不能预览、确认或建立人群',()=>{expect(canAccess('viewer','POST','/api/profiles/search')).toBe(true);for(const path of ['/api/tags/proposals/preview','/api/tags/proposals/p/confirm','/api/segments/risk-snapshots'])expect(canAccess('viewer','POST',path)).toBe(false);});
});
describe('冻结的人群与学员画像',()=>{
    function snapshot(members:RiskPreviewVO['members']){return{id:'snap',segmentId:'segment',sourceTagId:'tag',tagVersion:1,datasetId,name:'风险人群',memberCount:members.length,createdAt:'',preview:{members,evidence:[],batches:[],catalog:[{id:'c',kind:'campus',name:'一校区'},{id:'k',kind:'course',name:'数学'}],dataset:{name:'模拟数据',origin:'simulated'},scope} as unknown as RiskPreviewVO};}
    it('聚合从快照成员计算，事实、待验证原因和建议分别输出',()=>{const p=riskCrowdProfile(snapshot([{...student(),reason:'缺勤'}]));expect(p.attendance).toMatchObject({present:1,due:3,absent:2,rate:33.33});expect(p.distributions[0].values).toEqual([{label:'一校区',count:1}]);expect(p.hypotheses[0]).toContain('核查');expect(p.actions.length).toBeGreaterThanOrEqual(2);});
    it('零人快照与含未知签到的快照没有虚假零出勤率',()=>{expect(riskCrowdProfile(snapshot([])).attendance.rate).toBeNull();expect(riskCrowdProfile(snapshot([{...student({unknown:1}),reason:'缺勤'}])).attendance.rate).toBeNull();});
    it('学员查询限于选定快照，不返回其他学员资料',()=>{expect(()=>riskStudentProfile(snapshot([]),'s')).toThrow('不属于');expect(riskStudentProfile(snapshot([{...student(),reason:'缺勤'}]),'s')).toMatchObject({snapshotId:'snap',tagVersion:1,reason:'缺勤'});});
});
