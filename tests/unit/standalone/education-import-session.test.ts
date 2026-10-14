import {describe,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {EducationImportService} from '@/modules/education/services/import-service';
import {EducationReferenceIndex,validateReferences} from '@/modules/education/domain/references';
import {normalizeRows} from '@/modules/education/domain/normalize';
import type {DatasetVO,EducationStorage,ImportInput,ImportResultVO,RecordKind,StoredEducationRow} from '@/modules/education/contracts';

const dataset:DatasetVO={id:'10000000-0000-4000-8000-000000000099',key:'import-fixture',name:'公开导入测试',origin:'public',analysisType:'learning',license:'CC BY 4.0',schemaVersion:'1',sourceUrl:'https://example.org/fixture',dataCutoff:'2015-12-20T00:00:00Z',description:'测试',createdAt:'2015-12-20T00:00:00Z'};
function stored(kind:RecordKind,input:Record<string,string>[]):StoredEducationRow[]{return normalizeRows(dataset,kind,input,{},kind+'.csv').rows.map(row=>({...row,batchId:'base',hash:'fixture'}));}
function memory(){
    const records:StoredEducationRow[]=[
        ...stored('oulad_course',[{code_module:'AAA',code_presentation:'2013J',module_presentation_length:'200'}]),
        ...stored('oulad_student',[{code_module:'AAA',code_presentation:'2013J',id_student:'1',gender:'F',region:'测试',highest_education:'测试',imd_band:'',age_band:'0-35',num_of_prev_attempts:'0',studied_credits:'60',disability:'N',final_result:'Pass'}]),
        ...stored('oulad_resource',[{id_site:'1',code_module:'AAA',code_presentation:'2013J',activity_type:'forumng',week_from:'',week_to:''}]),
    ];
    const jobs:ImportResultVO[]=[{id:'base',datasetId:dataset.id,kind:'oulad_course',filename:'base.csv',fileHash:'base',status:'completed',inputRows:3,acceptedRows:3,rejectedRows:0,duplicateRows:0,issues:[],error:null,createdAt:dataset.createdAt,completedAt:dataset.createdAt}];
    const readRecords=vi.fn(async(_:string,__:string,kinds?:readonly RecordKind[])=>records.filter(row=>!kinds||kinds.includes(row.kind)));
    const findRecords=vi.fn(async(_:string,__:string,kind:RecordKind,ids:string[],_completed?:readonly string[])=>records.filter(row=>row.kind===kind&&ids.includes(row.sourceId)));
    const assertSourceFiles=vi.fn(async()=>{});
    const storage={
        getDataset:async()=>dataset,listBatches:async()=>jobs,findBatch:async(_:string,__:string,hash:string)=>jobs.find(job=>job.fileHash===hash)??null,
        readRecords,findRecords,assertSourceFiles,
        createBatch:async(_:string,input:ImportInput,fileHash:string)=>{const job:ImportResultVO={id:randomUUID(),datasetId:dataset.id,kind:input.kind,filename:input.filename,fileHash,status:'validating',inputRows:0,acceptedRows:0,rejectedRows:0,duplicateRows:0,issues:[],error:null,createdAt:dataset.createdAt,completedAt:null};jobs.push(job);return job;},
        finishBatch:async(id:string,result:Partial<ImportResultVO>)=>Object.assign(jobs.find(job=>job.id===id)!,result),
        writeRecords:async(_:string,__:string,___:string,rows:StoredEducationRow[])=>{records.push(...rows);},
    } as unknown as EducationStorage;
    return{service:new EducationImportService(storage),records,jobs,readRecords,findRecords,assertSourceFiles};
}
const activity={datasetId:dataset.id,kind:'oulad_activity' as const,filename:'studentVle.csv',csv:'code_module,code_presentation,id_student,id_site,date,sum_click\nAAA,2013J,1,1,-2,3\n',mapping:{},rowOffset:0};

describe('流式公开导入会话',()=>{
    it('不同事件块复用基础引用，不将学习事件纳入缓存',async()=>{
        const fixture=memory(),session=await fixture.service.createImportSession('org',dataset.id,[{kind:'oulad_activity',filename:'studentVle.csv',sha256:'same'}]);
        const first=await fixture.service.importCsv('org',activity,session),second=await fixture.service.importCsv('org',{...activity,rowOffset:1},session);
        expect(first.status).toBe('completed');expect(second.status).toBe('completed');
        expect(fixture.readRecords).toHaveBeenCalledTimes(1);expect(session.references.records.size).toBe(3);
        expect(fixture.records.filter(row=>row.kind==='oulad_activity').map(row=>row.sourceId)).toEqual(['studentVle.csv:1','studentVle.csv:2']);
        expect(fixture.findRecords.mock.calls[1][4]).toEqual([first.id]);expect(fixture.assertSourceFiles).toHaveBeenCalledOnce();
    });
    it('运行进程标识不影响重复分块幂等指纹',async()=>{
        const fixture=memory(),session=await fixture.service.createImportSession('org',dataset.id);
        const first=await fixture.service.importCsv('org',{...activity,mapping:{__sourceFileSHA256:'same',__importRunId:'run-a',__importPID:'1',__importHost:'fixture'}},session);
        const second=await fixture.service.importCsv('org',{...activity,mapping:{__sourceFileSHA256:'same',__importRunId:'run-b',__importPID:'2',__importHost:'fixture'}},session);
        expect(second.id).toBe(first.id);expect(second.reused).toBe(true);expect(fixture.records.filter(row=>row.kind==='oulad_activity')).toHaveLength(1);
    });
    it('已完成分块仍可重新预检，不把预检当作正式成功复用',async()=>{
        const fixture=memory();await fixture.service.importCsv('org',activity);
        const preview=await fixture.service.importCsv('org',{...activity,dryRun:true});
        expect(preview.id).toBe('preview');expect(preview.duplicateRows).toBe(1);expect(preview.reused).toBeUndefined();
    });
    it('失败块不会污染引用；错误保存来源文件行号',async()=>{
        const fixture=memory(),session=await fixture.service.createImportSession('org',dataset.id);
        const result=await fixture.service.importCsv('org',{...activity,rowOffset:100,csv:activity.csv.replace('AAA,2013J,1,1,-2,3','AAA,2013J,999,1,-2,3')},session);
        expect(result.status).toBe('failed');expect(result.issues[0]).toMatchObject({row:102,field:'id_student'});expect(session.references.records.size).toBe(3);
        expect(fixture.records.filter(row=>row.kind==='oulad_activity')).toHaveLength(0);
    });
    it('拒绝跨机构复用会话及未终止运行任务',async()=>{
        const fixture=memory(),session=await fixture.service.createImportSession('org',dataset.id);
        await expect(fixture.service.importCsv('another',activity,session)).rejects.toThrow('机构');
        const result=await fixture.service.importCsv('org',activity);fixture.jobs.find(job=>job.id===result.id)!.status='running';
        await expect(fixture.service.createImportSession('org',dataset.id)).rejects.toThrow('确认原进程');
        await expect(fixture.service.importCsv('org',activity)).rejects.toThrow('不能将运行状态当作');
    });
    it('公开课程目录仅使用课程批次元数据',async()=>{
        const fixture=memory(),result=await fixture.service.inspect('org',dataset.id);
        expect(result.catalog).toEqual([{kind:'learning_course',id:'AAA:2013J',name:'AAA:2013J'}]);
        expect(fixture.readRecords.mock.calls[0][2]).toEqual(['oulad_course']);
    });
    it('已完成基础块更新可复用引用索引',async()=>{
        const fixture=memory(),session=await fixture.service.createImportSession('org',dataset.id);
        const course=await fixture.service.importCsv('org',{datasetId:dataset.id,kind:'oulad_course',filename:'courses.csv',csv:'code_module,code_presentation,module_presentation_length\nBBB,2014J,220\n',mapping:{}},session);
        expect(course.status).toBe('completed');expect(session.references.records.has('oulad_course:BBB:2014J:course')).toBe(true);expect(fixture.readRecords).toHaveBeenCalledOnce();
    });
    it('同块覆盖索引不修改已发布基础索引',()=>{
        const fixture=memory(),index=new EducationReferenceIndex(fixture.records);
        const rows=normalizeRows(dataset,'oulad_activity',[{code_module:'AAA',code_presentation:'2013J',id_student:'1',id_site:'1',date:'-1',sum_click:'4'}],{},'studentVle.csv').rows;
        expect(validateReferences(rows,index)).toEqual([]);expect(index.records.size).toBe(3);
    });
});
