import {createHash} from 'node:crypto';
import {parse} from 'csv-parse/sync';
import {normalizeRows} from '../domain/normalize';
import {EducationReferenceIndex,validateReferences} from '../domain/references';
import {datasetSchema,importInputSchema,metadataKinds,fields,datasetAnalysisType} from '../contracts';
import type {DatasetDTO,DatasetVO,EducationStorage,ImportInput,ImportResultVO,RecordKind,StoredEducationRow} from '../contracts';
const hash=(value:unknown)=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const referenceKindsFor=(publicData:boolean):RecordKind[]=>publicData?['oulad_course','oulad_student','oulad_assessment','oulad_resource']:[...metadataKinds.filter(k=>!k.startsWith('oulad_')),'lesson','lead'];
export interface EducationImportSession {
    organizationId:string;dataset:DatasetVO;references:EducationReferenceIndex;referenceKinds:readonly RecordKind[];
    batches:Map<string,ImportResultVO>;completedBatchIds:Map<RecordKind,string[]>;
}
export class EducationImportService {
    constructor(private storage:EducationStorage){}
    createDataset(org:string,input:DatasetDTO){return this.storage.createDataset(org,datasetSchema.parse(input));}
    listDatasets(org:string){return this.storage.listDatasets(org);}
    async inspect(org:string,id:string){const dataset=await this.storage.getDataset(org,id);const mode=datasetAnalysisType(dataset);const catalog=await this.storage.readRecords(org,id,mode==='operations'?['campus','course']:mode==='learning'?['oulad_course']:['finance_annual']);return{dataset,batches:await this.storage.listBatches(org,id),catalog:catalog.map(r=>mode==='operations'?{id:r.sourceId,kind:r.kind,name:String(r.payload.name)}:mode==='learning'?{id:r.courseId,kind:'learning_course',name:r.courseId}:{id:String(r.payload.year),kind:'finance_year',name:String(r.payload.year)})};}
    async snapshot(org:string,id:string,kinds:readonly RecordKind[]){const dataset=await this.storage.getDataset(org,id),batches=await this.storage.listBatches(org,id);return{dataset,batches,records:await this.storage.readRecords(org,id,kinds,batches.filter(b=>b.status==='completed').map(b=>b.id))};}
    async *studentSnapshots(org:string,id:string,kinds:readonly RecordKind[]){
        const dataset=await this.storage.getDataset(org,id),batches=await this.storage.listBatches(org,id);
        const completed=batches.filter(b=>b.status==='completed').map(b=>b.id);
        if(!this.storage.studentBatches){yield{dataset,batches,records:await this.storage.readRecords(org,id,kinds,completed)};return;}
        let yielded=false;
        for await(const records of this.storage.studentBatches(org,id,kinds,completed,100)){yielded=true;yield{dataset,batches,records};}
        if(!yielded)yield{dataset,batches,records:[]};
    }
    async createImportSession(org:string,datasetId:string,sourceFiles:readonly {kind:RecordKind;filename:string;sha256:string}[]=[]):Promise<EducationImportSession>{
        const dataset=await this.storage.getDataset(org,datasetId),batches=await this.storage.listBatches(org,datasetId);
        if(batches.some(batch=>['validating','running'].includes(batch.status)))throw new Error('发现运行中的导入任务。请先确认原进程已终止，再使用 --recover-stopped 显式恢复');
        if(sourceFiles.length)await this.storage.assertSourceFiles?.(org,datasetId,sourceFiles);
        const referenceKinds=datasetAnalysisType(dataset)==='finance'?['finance_annual'] as RecordKind[]:referenceKindsFor(dataset.origin==='public');
        const references=new EducationReferenceIndex(await this.storage.readRecords(org,datasetId,referenceKinds,batches.filter(batch=>batch.status==='completed').map(batch=>batch.id)));
        const completedBatchIds=new Map<RecordKind,string[]>();
        for(const batch of batches)if(batch.status==='completed'){const ids=completedBatchIds.get(batch.kind)??[];ids.push(batch.id);completedBatchIds.set(batch.kind,ids);}
        return{organizationId:org,dataset,references,referenceKinds,batches:new Map(batches.map(batch=>[batch.fileHash,batch])),completedBatchIds};
    }
    async recoverStoppedImports(org:string,datasetId:string,batchIds:readonly string[],expectedOwners:Record<string,string>){
        if(!this.storage.recoverStoppedBatches)throw new Error('当前仓储不支持显式恢复');
        return this.storage.recoverStoppedBatches(org,datasetId,batchIds,expectedOwners);
    }
    async importCsv(org:string,raw:ImportInput,session?:EducationImportSession):Promise<ImportResultVO>{
        const input=importInputSchema.parse(raw);
        if(session&&(session.organizationId!==org||session.dataset.id!==input.datasetId))throw new Error('导入会话不属于当前机构或数据集');
        const dataset=session?.dataset??await this.storage.getDataset(org,input.datasetId);
        const fingerprint=hash({kind:input.kind,csv:input.csv,mapping:Object.fromEntries(Object.entries(input.mapping).filter(([key])=>!['__importRunId','__importPID','__importHost'].includes(key)).sort()),filename:input.filename,rowOffset:input.rowOffset,schemaVersion:dataset.schemaVersion});
        const prior=session?session.batches.get(fingerprint):await this.storage.findBatch(org,dataset.id,fingerprint);
        if(prior?.status==='completed'&&!input.dryRun)return {...prior,reused:true};
        if(prior&&['validating','running'].includes(prior.status))throw new Error('原分块仍在运行，请确认原进程终止并显式恢复，不能将运行状态当作导入成功');
        let batch:ImportResultVO|null=null,referenceRows:StoredEducationRow[]=[];
        const result={status:'failed' as ImportResultVO['status'],inputRows:0,acceptedRows:0,rejectedRows:0,duplicateRows:0,issues:[] as ImportResultVO['issues'],error:null as string|null};
        try{
            // 预检也产生质量报告，但不预约或写入正式任务。
            if(!input.dryRun){batch=await this.storage.createBatch(org,input,fingerprint);if(batch.status==='completed')return{...batch,reused:true};}
            const parsed=parse(input.csv,{columns:(header:string[])=>{if(new Set(header).size!==header.length)throw new Error('CSV含重复列名');for(const f of fields[input.kind])if(f.required&&!header.includes(input.mapping[f.name]??f.name))throw new Error('CSV缺少必填列：'+f.name);return header;},bom:true,skip_empty_lines:true,relax_column_count:false,cast:false,max_record_size:65536}) as Record<string,string>[];
            if(parsed.length>20000)throw new Error('单批最多20000行，大文件请使用分块导入脚本');
            result.inputRows=parsed.length;
            const normalized=normalizeRows(dataset,input.kind,parsed,input.mapping,input.filename,input.rowOffset);
            result.rejectedRows=normalized.rejectedRows;result.issues=normalized.issues;
            const existing=session?.references??await this.storage.readRecords(org,dataset.id,datasetAnalysisType(dataset)==='finance'?['finance_annual']:referenceKindsFor(dataset.origin==='public'));
            const referenceIssues=validateReferences(normalized.rows,existing).map(i=>({...i,row:normalized.sourceRows[i.row-2]}));
            result.issues.push(...referenceIssues);
            result.rejectedRows+=new Set(referenceIssues.map(i=>i.row)).size;
            const previous=await this.storage.findRecords(org,dataset.id,input.kind,normalized.rows.map(r=>r.sourceId),session?[...(session.completedBatchIds.get(input.kind)??[])]:undefined);
            const known=new Map(previous.map(r=>[r.sourceId,r.hash])),fresh:StoredEducationRow[]=[];
            for(const [index,row]of normalized.rows.entries()){
                const rowHash=hash(row),old=known.get(row.sourceId);
                if(old===rowHash){result.duplicateRows++;continue;}
                if(old){result.rejectedRows++;result.issues.push({row:normalized.sourceRows[index],field:'id',reason:'相同来源编号存在不同内容，请使用新数据版本，禁止静默覆盖'});continue;}
                known.set(row.sourceId,rowHash);fresh.push({...row,hash:rowHash,batchId:batch?.id??'preview'});
            }
            result.rejectedRows=new Set(result.issues.map(issue=>issue.row)).size;
            result.issues=result.issues.slice(0,200);
            if(result.rejectedRows){result.error='存在校验错误，本批未发布任何记录';}
            else{
                if(!input.dryRun){await this.storage.finishBatch(batch!.id,{...result,status:'running'});await this.storage.writeRecords(org,dataset.id,batch!.id,fresh);referenceRows=fresh;}
                result.acceptedRows=fresh.length;result.status='completed';
            }
        }catch(error){result.status='failed';result.acceptedRows=0;result.error=error instanceof Error?error.message:'导入失败';}
        if(batch){
            const completed=await this.storage.finishBatch(batch.id,result);
            if(session){
                session.batches.set(fingerprint,completed);
                if(completed.status==='completed'){
                    const ids=session.completedBatchIds.get(completed.kind)??[];if(!ids.includes(completed.id))ids.push(completed.id);session.completedBatchIds.set(completed.kind,ids);
                    // 仅基础引用进入缓存；千万条学习事件不保存在应用内存。
                    if(session.referenceKinds.includes(completed.kind))session.references.add(referenceRows);
                }
            }
            return completed;
        }
        if(!input.dryRun)throw new Error(result.error??'无法创建导入任务');
        return{id:'preview',datasetId:dataset.id,kind:input.kind,filename:input.filename,createdAt:new Date().toISOString(),completedAt:null,fileHash:fingerprint,...result};
    }
}
