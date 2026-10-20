import 'server-only';
import {requireCompanyContext} from '@/platform/company/context';
import {companyClickHouse} from '@/platform/company/registry';
export const clickHouseArray=(values:string[])=>'['+values.map(v=>"'"+v.replaceAll('\\','\\\\').replaceAll("'","\\'")+"'").join(',')+']';
const formFieldLimit=32*1024;
// Poco HTMLForm限制单字段大小；拆成类型相同的绑定参数并在数据库内拼接。
// 只识别服务端显式Array(String/UUID)占位符，不解析或改写用户SQL。
export function bindEducationHttpParameters(query:string,parameters:Record<string,string>){
    const bound={...parameters},replacements=new Map<string,string>();
    for(const match of query.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*):Array\((String|UUID)\)\}/g)){
        const [placeholder,name,type]=match,value=parameters[name];
        if(value===undefined||Buffer.byteLength(value,'utf8')<=formFieldLimit||replacements.has(placeholder))continue;
        const text=value.trim();if(!text.startsWith('[')||!text.endsWith(']'))throw new Error('大型数组参数格式不正确');
        const tokens:string[]=[];let quoted=false,escaped=false,start=1;
        for(let index=1;index<text.length-1;index++){
            const char=text[index];
            if(escaped){escaped=false;continue;}
            if(quoted&&char==='\\'){escaped=true;continue;}
            if(char==="'"){quoted=!quoted;continue;}
            if(!quoted&&char===','){tokens.push(text.slice(start,index).trim());start=index+1;}
        }
        if(quoted||escaped)throw new Error('大型数组参数引号不完整');
        const tail=text.slice(start,-1).trim();if(tail)tokens.push(tail);
        const parts:string[]=[];let current:string[]=[],bytes=2;
        const flush=()=>{if(current.length){parts.push('['+current.join(',')+']');current=[];bytes=2;}};
        for(const token of tokens){
            const size=Buffer.byteLength(token,'utf8');if(size+2>formFieldLimit)throw new Error('单个来源编号超出查询字段限制');
            if(current.length&&bytes+size+1>formFieldLimit)flush();current.push(token);bytes+=size+(current.length>1?1:0);
        }
        flush();if(!parts.length)throw new Error('大型数组参数缺少有效成员');
        let prefix=name+'__http';while(parts.some((_,index)=>Object.hasOwn(bound,prefix+index)))prefix+='_';
        const placeholders=parts.map((part,index)=>{const key=prefix+index;bound[key]=part;return'{'+key+':Array('+type+')}';});
        delete bound[name];replacements.set(placeholder,'arrayConcat('+placeholders.join(',')+')');
    }
    const rewritten=query.replace(/\{([A-Za-z_][A-Za-z0-9_]*):Array\((String|UUID)\)\}/g,placeholder=>replacements.get(placeholder)??placeholder);
    return{query:rewritten,parameters:bound};
}

// 独立教育事件表。只接收参数化查询，不接受浏览器或模型提供的SQL。
export class EducationEventsClient {
    private readonly ready=new Map<string,Promise<void>>();
    async execute(query:string,parameters:Record<string,string>={},body?:string,options:{timeoutMs?:number;signal?:AbortSignal}={}):Promise<string>{
        const c=companyClickHouse(requireCompanyContext().company);
        const url=new URL(/^https?:\/\//.test(c.host)?c.host:`http://${c.host}:${c.port}`);
        url.searchParams.set('database',c.database);
        // 参数放入请求正文，避免数千来源编号/批次使URL超过HTTP限制。
        // INSERT使用原始JSONEachRow正文；它没有外部查询参数。
        let requestBody:BodyInit;
        const headers:Record<string,string>={'X-ClickHouse-User':c.user,'X-ClickHouse-Key':c.password};
        if(body!==undefined){
            if(Object.keys(parameters).length)throw new Error('事件写入不能同时携带查询参数');
            url.searchParams.set('query',query);headers['Content-Type']='text/plain';requestBody=body;
        }else{
            const binding=bindEducationHttpParameters(query,parameters),form=new FormData();form.set('query',binding.query);
            for(const [key,value]of Object.entries(binding.parameters))form.set('param_'+key,value);
            requestBody=form;
        }
        const timeout=AbortSignal.timeout(options.timeoutMs??60000);
        const response=await fetch(url,{method:'POST',headers,body:requestBody,signal:options.signal?AbortSignal.any([options.signal,timeout]):timeout});
        if(!response.ok){
            // 只保留安全编号/已知技术原因，不返回包含SQL、记录或路径的原始错误。
            const detail=await response.text(),header=response.headers.get('x-clickhouse-exception-code');
            const code=(header&&/^\d{1,8}$/.test(header)?header:detail.match(/^Code:\s*(\d{1,8})\./)?.[1])??'unknown';
            const reason=code==='1000'&&detail.includes('Field value too long')?'查询参数超过ClickHouse单字段限制':'行为事件存储暂不可用，请检查ClickHouse连接或表权限';
            throw new Error(reason+'（HTTP '+response.status+'，ClickHouse '+code+'）');
        }
        return response.text();
    }
    async ensureTable(){
        const company=requireCompanyContext().company,c=companyClickHouse(company),key=company.code+':'+c.host+':'+c.port+':'+c.database;
        if(!this.ready.has(key))this.ready.set(key,this.execute(`CREATE TABLE IF NOT EXISTS education_events_v1 (
            organization_id UUID, dataset_id UUID, batch_id UUID, kind LowCardinality(String), source_id String,
            hash String, payload String, student_id String, campus_id String, course_id String, class_id String,
            occurred_at Nullable(DateTime64(3,'UTC')), relative_day Nullable(Int32), version UInt64
        ) ENGINE=ReplacingMergeTree(version) ORDER BY (organization_id,dataset_id,kind,source_id,batch_id)`).then(()=>{}).catch(error=>{this.ready.delete(key);throw error;}));
        return this.ready.get(key)!;
    }
    async read(parameters:Record<string,string>,extra:string=''){
        await this.ensureTable();
        return this.queryRows(`SELECT * FROM education_events_v1 FINAL WHERE organization_id={org:UUID} AND dataset_id={dataset:UUID} AND batch_id IN {batches:Array(UUID)} ${extra}`,parameters);
    }
    // SQL只能由服务端业务代码提供；学习分析使用有限规模的数据库聚合结果。
    async queryRows<T extends Record<string,unknown>=Record<string,unknown>>(query:string,parameters:Record<string,string>={}):Promise<T[]>{
        await this.ensureTable();
        const text=await this.execute(query+' FORMAT JSONEachRow',parameters);
        return text.trim()?text.trim().split('\n').map(line=>JSON.parse(line) as T):[];
    }
    async insert(rows:Record<string,unknown>[]){
        if(!rows.length)return;
        await this.ensureTable();
        await this.execute('INSERT INTO education_events_v1 FORMAT JSONEachRow',{},rows.map(row=>JSON.stringify(row)).join('\n'));
    }
}
