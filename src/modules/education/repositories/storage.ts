import 'server-only';
import {randomUUID} from 'node:crypto';
import {execute,queryOne,queryRows,transaction} from '@/platform/database';
import {EducationEventsClient,clickHouseArray} from '@/platform/database/education-events';
import {metadataKinds} from '../contracts';
import {WorkflowError} from '@/shared/errors/workflow-error';
import type {DatasetDTO,DatasetVO,EducationStorage,ImportInput,ImportResultVO,RecordKind,StoredEducationRow} from '../contracts';

interface DatasetRow {
    id:string;organizationId:string;key:string;name:string;origin:string;sourceUrl:string|null;license:string;
    analysisType?:DatasetVO['analysisType'];schemaVersion:string;dataCutoff:Date;description:string;expectedRows:Record<string,number>;createdAt:Date;
}
interface BatchRow {
    id:string;organizationId:string;datasetId:string;kind:string;filename:string;fileHash:string;mapping:Record<string,string>;
    status:string;inputRows:number;acceptedRows:number;rejectedRows:number;duplicateRows:number;
    issues:ImportResultVO['issues'];error:string|null;createdAt:Date;completedAt:Date|null;
}
interface RecordRow extends Omit<StoredEducationRow,'occurredAt'> {occurredAt:Date|null;}
const datasetVO=(d:DatasetRow):DatasetVO=>({...d,origin:d.origin as DatasetVO['origin'],analysisType:d.analysisType??undefined,schemaVersion:d.schemaVersion as DatasetVO['schemaVersion'],sourceUrl:d.sourceUrl??undefined,dataCutoff:d.dataCutoff.toISOString(),createdAt:d.createdAt.toISOString()});
const batchVO=(b:BatchRow):ImportResultVO=>({...b,kind:b.kind as RecordKind,status:b.status as ImportResultVO['status'],createdAt:b.createdAt.toISOString(),completedAt:b.completedAt?.toISOString()??null,...(b.mapping.__importRunId&&Number.isSafeInteger(Number(b.mapping.__importPID))&&Number(b.mapping.__importPID)>0?{importProcess:{pid:Number(b.mapping.__importPID),host:b.mapping.__importHost,runId:b.mapping.__importRunId}}:{})});
const recordVO=(r:RecordRow):StoredEducationRow=>({...r,occurredAt:r.occurredAt?.toISOString()??null});
const meta=(kind:RecordKind)=>metadataKinds.includes(kind);

export class DatabaseEducationStorage implements EducationStorage {
    private events=new EducationEventsClient();
    async createDataset(org:string,input:DatasetDTO){
        return transaction(async client=>{
            await execute('SELECT pg_advisory_xact_lock(hashtext($1))',[org+':'+input.key],client);
            const existing=await queryOne<DatasetRow>('SELECT * FROM education_dataset WHERE "organizationId"=$1::uuid AND key=$2',[org,input.key],client);
            if(existing){
                const current=datasetVO(existing);
                if(input.analysisType&&current.analysisType&&input.analysisType!==current.analysisType)throw new Error('分析类型不同，请使用新数据集');
                if(['name','origin','sourceUrl','license','schemaVersion','dataCutoff','description'].some(k=>current[k as keyof DatasetDTO]!==input[k as keyof DatasetDTO]))throw new Error('数据集标识已存在且来源配置不同，请使用新的标识');
                if(input.expectedRows&&JSON.stringify(Object.entries(current.expectedRows??{}).sort())!==JSON.stringify(Object.entries(input.expectedRows).sort())){
                    if(Object.keys(current.expectedRows??{}).length)throw new Error('数据集预期规模不同，请另建数据版本');
                    const updated=await queryOne<DatasetRow>('UPDATE education_dataset SET "expectedRows"=$3::jsonb WHERE id=$1::uuid AND "organizationId"=$2::uuid RETURNING *',[existing.id,org,JSON.stringify(input.expectedRows)],client);
                    return datasetVO(updated!);
                }
                return current;
            }
            const row=await queryOne<DatasetRow>('INSERT INTO education_dataset (id,"organizationId",key,name,origin,"sourceUrl",license,"schemaVersion","dataCutoff",description,"expectedRows","analysisType","createdAt") VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,NOW()) RETURNING *',[randomUUID(),org,input.key,input.name,input.origin,input.sourceUrl??null,input.license,input.schemaVersion,new Date(input.dataCutoff),input.description,JSON.stringify(input.expectedRows??{}),input.analysisType??(input.origin==='simulated'?'operations':input.key.startsWith('oulad')?'learning':null)],client);
            return datasetVO(row!);
        });
    }
    async listDatasets(org:string){return(await queryRows<DatasetRow>('SELECT * FROM education_dataset WHERE "organizationId"=$1::uuid ORDER BY "createdAt" DESC',[org])).map(datasetVO);}
    async getDataset(org:string,id:string){const row=await queryOne<DatasetRow>('SELECT * FROM education_dataset WHERE id=$1::uuid AND "organizationId"=$2::uuid',[id,org]);if(!row)throw new WorkflowError('数据集不存在或无权访问',404);return datasetVO(row);}
    async listBatches(org:string,datasetId:string){return(await queryRows<BatchRow>('SELECT * FROM education_import_batch WHERE "organizationId"=$1::uuid AND "datasetId"=$2::uuid ORDER BY "createdAt" ASC',[org,datasetId])).map(batchVO);}
    async findBatch(org:string,datasetId:string,fileHash:string){const row=await queryOne<BatchRow>('SELECT * FROM education_import_batch WHERE "organizationId"=$1::uuid AND "datasetId"=$2::uuid AND "fileHash"=$3',[org,datasetId,fileHash]);return row?batchVO(row):null;}
    async assertSourceFiles(org:string,datasetId:string,files:readonly {kind:RecordKind;filename:string;sha256:string}[]){
        const rows=await queryRows<{kind:RecordKind;filename:string;sha256:string}>(`SELECT DISTINCT kind,filename,mapping->>'__sourceFileSHA256' AS sha256 FROM education_import_batch WHERE "organizationId"=$1::uuid AND "datasetId"=$2::uuid AND mapping ? '__sourceFileSHA256'`,[org,datasetId]);
        for(const file of files)if(rows.some(row=>row.kind===file.kind&&row.filename===file.filename&&row.sha256!==file.sha256))throw new Error(file.filename+'原文件指纹与历史导入不同，请使用新的数据集版本；禁止继续原数据版本');
    }
    async createBatch(org:string,input:ImportInput,fileHash:string){
        return transaction(async client=>{
            await execute('SELECT pg_advisory_xact_lock(hashtext($1))',[input.datasetId],client);
            const prior=await queryOne<BatchRow>('SELECT * FROM education_import_batch WHERE "organizationId"=$1::uuid AND "datasetId"=$2::uuid AND "fileHash"=$3',[org,input.datasetId,fileHash],client);
            if(prior?.status==='completed')return batchVO(prior);
            const busy=await queryOne<{id:string}>('SELECT id FROM education_import_batch WHERE "organizationId"=$1::uuid AND "datasetId"=$2::uuid AND status=ANY($3::text[]) LIMIT 1',[org,input.datasetId,['validating','running']],client);
            if(busy)throw new Error('数据集已有导入任务运行，请等待完成后再试');
            const failed=await queryOne<BatchRow>('SELECT * FROM education_import_batch WHERE "organizationId"=$1::uuid AND "datasetId"=$2::uuid AND "fileHash"=$3',[org,input.datasetId,fileHash],client);
            if(failed?.status==='failed'){
                const row=await queryOne<BatchRow>('UPDATE education_import_batch SET status=$3,error=NULL,"completedAt"=NULL,mapping=$4::jsonb WHERE id=$1::uuid AND "organizationId"=$2::uuid RETURNING *',[failed.id,org,'validating',JSON.stringify(input.mapping)],client);return batchVO(row!);
            }
            const row=await queryOne<BatchRow>('INSERT INTO education_import_batch (id,"organizationId","datasetId",kind,filename,"fileHash",mapping,status,"inputRows","acceptedRows","rejectedRows","duplicateRows",issues,"createdAt") VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7::jsonb,$8,0,0,0,0,$9::jsonb,NOW()) RETURNING *',[randomUUID(),org,input.datasetId,input.kind,input.filename,fileHash,JSON.stringify(input.mapping),'validating','[]'],client);return batchVO(row!);
        });
    }
    async recoverStoppedBatches(org:string,datasetId:string,batchIds:readonly string[],expectedOwners:Record<string,string>){
        if(!batchIds.length)return [];
        if(batchIds.some(id=>!expectedOwners[id]))throw new Error('恢复任务缺少经核验的原进程标识');
        return transaction(async client=>{
            await execute('SELECT pg_advisory_xact_lock(hashtext($1))',[datasetId],client);
            const rows=await queryRows<BatchRow>(`UPDATE education_import_batch SET status=$4,error=$5,"completedAt"=NOW() WHERE "organizationId"=$1::uuid AND "datasetId"=$2::uuid AND id=ANY($3::uuid[]) AND status=ANY($6::text[]) AND mapping->>'__importRunId'=($7::jsonb ->> id::text) RETURNING *`,[org,datasetId,[...batchIds],'failed','已显式确认原导入进程终止；等待原分块重试',['validating','running'],JSON.stringify(expectedOwners)],client);
            if(rows.length!==batchIds.length)throw new Error('原任务状态或进程标识发生变化，拒绝恢复');
            return rows.map(batchVO);
        });
    }
    async finishBatch(id:string,result:Parameters<EducationStorage['finishBatch']>[1]){
        const columns:Record<string,string>={status:'status',inputRows:'"inputRows"',acceptedRows:'"acceptedRows"',rejectedRows:'"rejectedRows"',duplicateRows:'"duplicateRows"',issues:'issues',error:'error'};
        const parameters:unknown[]=[id],updates:string[]=[];
        for(const [key,value] of Object.entries(result)){if(value===undefined||!columns[key])continue;parameters.push(key==='issues'?JSON.stringify(value):value);updates.push(`${columns[key]}=$${parameters.length}${key==='issues'?'::jsonb':''}`);}
        parameters.push(['completed','failed'].includes(result.status)?new Date():null);updates.push(`"completedAt"=$${parameters.length}`);
        const row=await queryOne<BatchRow>(`UPDATE education_import_batch SET ${updates.join(',')} WHERE id=$1::uuid RETURNING *`,parameters);
        if(!row)throw new Error('导入批次不存在');return batchVO(row);
    }
    async readRecords(org:string,datasetId:string,kinds?:readonly RecordKind[],batchIds?:readonly string[]){
        const batches=(await this.listBatches(org,datasetId)).filter(b=>b.status==='completed'&&(!batchIds||batchIds.includes(b.id))).map(b=>b.id);
        if(!batches.length)return [];
        const parameters:unknown[]=[org,datasetId,batches];if(kinds)parameters.push([...kinds]);
        const pg=await queryRows<RecordRow>(`SELECT * FROM education_record WHERE "organizationId"=$1::uuid AND "datasetId"=$2::uuid AND "batchId"=ANY($3::uuid[])${kinds?' AND kind=ANY($4::text[])':''}`,parameters);
        const records=pg.map(recordVO),eventKinds=kinds?.filter(k=>!meta(k));if(eventKinds?.length===0)return records;
        const ch=await this.events.read({org,dataset:datasetId,batches:clickHouseArray(batches),...(eventKinds?{kinds:clickHouseArray(eventKinds)}:{})},eventKinds?'AND kind IN {kinds:Array(String)}':'');records.push(...ch.map(r=>this.eventRow(r)));
        return records;
    }
    async *studentBatches(org:string,datasetId:string,kinds:readonly RecordKind[],batchIds:readonly string[],pageSize:number){
        if(!batchIds.length)return;
        if(!Number.isInteger(pageSize)||pageSize<1||pageSize>500)throw new Error('学员批次大小无效');
        const catalog=await this.readRecords(org,datasetId,kinds.filter(k=>['campus','course','class'].includes(k)),batchIds);
        let cursor='';
        while(true){
            const students=await queryRows<RecordRow>(`SELECT * FROM education_record WHERE "organizationId"=$1::uuid AND "datasetId"=$2::uuid AND "batchId"=ANY($3::uuid[]) AND kind='student' AND "sourceId">$4 ORDER BY "sourceId" LIMIT $5`,[org,datasetId,[...batchIds],cursor,pageSize]);
            if(!students.length)return;
            const ids=students.map(r=>r.sourceId);cursor=ids.at(-1)!;
            const metaKinds=kinds.filter(k=>meta(k)&&!['campus','course','class','student'].includes(k));
            const metadata=metaKinds.length?await queryRows<RecordRow>(`SELECT * FROM education_record WHERE "organizationId"=$1::uuid AND "datasetId"=$2::uuid AND "batchId"=ANY($3::uuid[]) AND kind=ANY($4::text[]) AND "studentId"=ANY($5::text[])`,[org,datasetId,[...batchIds],metaKinds,ids]):[];
            const classIds=[...new Set(metadata.filter(r=>r.kind==='enrollment').map(r=>String(r.payload.classId)))];
            const leadIds=[...new Set(metadata.filter(r=>r.kind==='contract'&&r.payload.leadId).map(r=>String(r.payload.leadId)))];
            const eventKinds=kinds.filter(k=>!meta(k)&&!['lesson','lead'].includes(k));
            const conditions=[eventKinds.length?'(kind IN {kinds:Array(String)} AND student_id IN {students:Array(String)})':'',kinds.includes('lesson')&&classIds.length?'(kind=\'lesson\' AND class_id IN {classes:Array(String)})':'',kinds.includes('lead')&&leadIds.length?'(kind=\'lead\' AND source_id IN {leads:Array(String)})':''].filter(Boolean);
            const events=conditions.length?await this.events.read({org,dataset:datasetId,batches:clickHouseArray([...batchIds]),kinds:clickHouseArray(eventKinds),students:clickHouseArray(ids),classes:clickHouseArray(classIds),leads:clickHouseArray(leadIds)},'AND ('+conditions.join(' OR ')+')'):[];
            // 同一学员的所有校区、课程及续费链进入同一批，组合条件不会跨批遗漏。
            yield[...catalog,...students.map(recordVO),...metadata.map(recordVO),...events.map(r=>this.eventRow(r))];
        }
    }
    async findRecords(org:string,datasetId:string,kind:RecordKind,ids:string[],completedBatchIds?:readonly string[]){
        if(!ids.length)return [];
        if(meta(kind))return(await queryRows<RecordRow>('SELECT r.* FROM education_record r JOIN education_import_batch b ON b.id=r."batchId" AND b."organizationId"=r."organizationId" WHERE r."organizationId"=$1::uuid AND r."datasetId"=$2::uuid AND r.kind=$3 AND r."sourceId"=ANY($4::text[]) AND b.status=$5',[org,datasetId,kind,ids,'completed'])).map(recordVO);
        const batches=completedBatchIds?[...completedBatchIds]:(await this.listBatches(org,datasetId)).filter(b=>b.status==='completed'&&b.kind===kind).map(b=>b.id);if(!batches.length)return [];
        const rows:StoredEducationRow[]=[];
        // 分块只取决于本次来源编号大小，不与全部历史批次数相乘。
        // 来源集合按约256KB分组；客户端再把单字段拆至32KB，批次仍一次绑定。
        let part:string[]=[],bytes=0;
        const flush=async()=>{if(!part.length)return;const result=await this.events.read({org,dataset:datasetId,batches:clickHouseArray(batches),kind,ids:clickHouseArray(part)},'AND kind={kind:String} AND source_id IN {ids:Array(String)}');rows.push(...result.map(r=>this.eventRow(r)));part=[];bytes=0;};
        for(const id of new Set(ids)){const size=Buffer.byteLength(id,'utf8')+8;if(part.length&&(bytes+size>256*1024||part.length>=10000))await flush();part.push(id);bytes+=size;}await flush();return rows;
    }
    private eventRow(r:Record<string,unknown>):StoredEducationRow{return{sourceId:String(r.source_id),kind:r.kind as RecordKind,payload:JSON.parse(String(r.payload)),hash:String(r.hash),batchId:String(r.batch_id),studentId:String(r.student_id),campusId:String(r.campus_id),courseId:String(r.course_id),classId:String(r.class_id),occurredAt:r.occurred_at?String(r.occurred_at).replace(' ','T')+'Z':null,relativeDay:r.relative_day===null?null:Number(r.relative_day)};}
    async writeRecords(org:string,datasetId:string,batchId:string,rows:StoredEducationRow[]){
        const pg=rows.filter(r=>meta(r.kind));
        if(pg.length)await transaction(async client=>{
            await execute('DELETE FROM education_record r USING education_import_batch b WHERE r."batchId"=b.id AND r."organizationId"=$1::uuid AND b."organizationId"=$1::uuid AND r."datasetId"=$2::uuid AND r.kind=$3 AND r."sourceId"=ANY($4::text[]) AND b.status=$5',[org,datasetId,pg[0].kind,pg.map(r=>r.sourceId),'failed'],client);
            for(let i=0;i<pg.length;i+=1000){
                const parameters:unknown[]=[],values=pg.slice(i,i+1000).map(r=>{
                    const offset=parameters.length;parameters.push(randomUUID(),org,datasetId,batchId,r.kind,r.sourceId,r.hash,JSON.stringify(r.payload),r.studentId,r.campusId,r.courseId,r.classId,r.occurredAt?new Date(r.occurredAt):null,r.relativeDay);
                    return `($${offset+1}::uuid,$${offset+2}::uuid,$${offset+3}::uuid,$${offset+4}::uuid,$${offset+5},$${offset+6},$${offset+7},$${offset+8}::jsonb,$${offset+9},$${offset+10},$${offset+11},$${offset+12},$${offset+13},$${offset+14})`;
                });
                await execute(`INSERT INTO education_record (id,"organizationId","datasetId","batchId",kind,"sourceId",hash,payload,"studentId","campusId","courseId","classId","occurredAt","relativeDay") VALUES ${values.join(',')} ON CONFLICT ("datasetId",kind,"sourceId") DO NOTHING`,parameters,client);
            }
        },{timeoutMs:60000});
        const ch=rows.filter(r=>!meta(r.kind));
        for(let i=0;i<ch.length;i+=5000)await this.events.insert(ch.slice(i,i+5000).map(r=>({organization_id:org,dataset_id:datasetId,batch_id:batchId,kind:r.kind,source_id:r.sourceId,hash:r.hash,payload:JSON.stringify(r.payload),student_id:r.studentId,campus_id:r.campusId,course_id:r.courseId,class_id:r.classId,occurred_at:r.occurredAt?new Date(r.occurredAt).toISOString().replace('T',' ').replace('Z',''):null,relative_day:r.relativeDay,version:Date.now()})));
    }
}

