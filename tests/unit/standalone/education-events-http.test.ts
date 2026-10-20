import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {runWithCompany} from '@/platform/company/context';
import {EducationEventsClient,clickHouseArray,bindEducationHttpParameters} from '@/platform/database/education-events';
beforeEach(()=>{vi.stubEnv('COMPANY_REGISTRY_JSON','');vi.stubEnv('DEFAULT_COMPANY_CODE','main');vi.stubEnv('SYSTEM_USER_ID','11111111-1111-4111-8111-111111111111');vi.stubEnv('CLICKHOUSE_HOST','http://fixture.invalid:8123');vi.stubEnv('CLICKHOUSE_PORT','8123');vi.stubEnv('CLICKHOUSE_DATABASE','fixture_test');vi.stubEnv('CLICKHOUSE_USER','fixture');vi.stubEnv('CLICKHOUSE_PASSWORD','fixture-only');});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('教育事件参数化HTTP',()=>{
    it('大来源数组经POST multipart提交，URL不包含数据参数',async()=>{
        const fetchMock=vi.fn().mockResolvedValueOnce(new Response('')).mockResolvedValueOnce(new Response('{"value":3}\n'));
        vi.stubGlobal('fetch',fetchMock);
        const client=new EducationEventsClient(),ids=clickHouseArray(Array.from({length:6000},(_,index)=>'source-'+index));
        const result=await runWithCompany('main',()=>client.queryRows('SELECT count() AS value FROM education_events_v1 FINAL WHERE source_id IN {ids:Array(String)}',{ids}));
        expect(result).toEqual([{value:3}]);
        const [url,options]=fetchMock.mock.calls[1];expect(String(url).length).toBeLessThan(200);expect(String(url)).not.toContain('param_ids');
        expect(options.method).toBe('POST');expect(options.body).toBeInstanceOf(FormData);
        const parts=[...options.body.entries()].filter(([key])=>key.startsWith('param_ids__http')).map(([,value])=>String(value));
        expect(parts.length).toBeGreaterThan(1);expect(parts.every(value=>Buffer.byteLength(value,'utf8')<=32768)).toBe(true);
        expect('['+parts.map(value=>value.slice(1,-1)).join(',')+']').toBe(ids);
        expect(options.body.get('query')).toContain('arrayConcat(');expect(options.body.get('query')).toContain('FINAL');expect(options.body.get('query')).toMatch(/FORMAT JSONEachRow$/);
        expect(options.headers['Content-Type']).toBeUndefined();
    });
    it('插入仍使用JSONEachRow原始正文，不混入查询参数',async()=>{
        const fetchMock=vi.fn().mockImplementation(async()=>new Response(''));vi.stubGlobal('fetch',fetchMock);
        const client=new EducationEventsClient();await runWithCompany('main',()=>client.insert([{kind:'oulad_activity',source_id:'row:1'}]));
        const [,options]=fetchMock.mock.calls[1];expect(options.headers['Content-Type']).toBe('text/plain');
        expect(options.body).toBe('{"kind":"oulad_activity","source_id":"row:1"}');
        await expect(runWithCompany('main',()=>client.execute('SELECT 1',{key:'value'},'raw'))).rejects.toThrow('不能同时');
    });
    it('大UUID批次数组保持类型，多个占位符复用同一组绑定',()=>{
        const batches=clickHouseArray(Array.from({length:2200},(_,index)=>'00000000-0000-4000-8000-'+String(index).padStart(12,'0')));
        const result=bindEducationHttpParameters('SELECT {batches:Array(UUID)} AS a, {batches:Array(UUID)} AS b',{batches});
        expect(result.query.match(/arrayConcat\(/g)).toHaveLength(2);expect(result.query).toContain(':Array(UUID)}');expect(result.parameters.batches).toBeUndefined();
        expect('['+Object.values(result.parameters).map(value=>value.slice(1,-1)).join(',')+']').toBe(batches);
        expect(Object.values(result.parameters).every(value=>Buffer.byteLength(value,'utf8')<=32768)).toBe(true);
    });
    it('中文、引号、斜线和逗号按UTF8字节拆分，成员内容完整',()=>{
        const values=Array.from({length:3000},(_,index)=>'中文,引号\'斜线\\'+index),ids=clickHouseArray(values);
        const result=bindEducationHttpParameters('SELECT {ids:Array(String)} AS ids, {id:String} AS id',{ids,id:'small'});
        const parts=Object.entries(result.parameters).filter(([key])=>key.startsWith('ids__http')).map(([,value])=>value);
        expect(parts.length).toBeGreaterThan(2);expect(parts.every(value=>Buffer.byteLength(value,'utf8')<=32768)).toBe(true);
        expect('['+parts.map(value=>value.slice(1,-1)).join(',')+']').toBe(ids);expect(result.query).toContain('{id:String}');expect(result.parameters.id).toBe('small');
    });
    it('产品错误只显示编号及安全原因，不泄露原始记录',async()=>{
        const fetchMock=vi.fn().mockResolvedValue(new Response('Code: 1000. DB::Exception: Field value too long; private-record',{status:500,headers:{'X-ClickHouse-Exception-Code':'1000'}}));vi.stubGlobal('fetch',fetchMock);
        await expect(runWithCompany('main',()=>new EducationEventsClient().execute('SELECT 1'))).rejects.toThrow('单字段限制（HTTP 500，ClickHouse 1000）');
    });
});
