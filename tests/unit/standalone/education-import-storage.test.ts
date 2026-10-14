import {beforeEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({read:vi.fn(),queryRows:vi.fn(),queryOne:vi.fn(),execute:vi.fn()}));
vi.mock('@/platform/database',()=>({...mocks,transaction:async(callback:(client:unknown)=>Promise<unknown>)=>callback({})}));
vi.mock('@/platform/database/education-events',()=>({
    EducationEventsClient:class{read=mocks.read;},
    clickHouseArray:(values:string[])=>'['+values.map(value=>"'"+value+"'").join(',')+']',
}));
import {DatabaseEducationStorage} from '@/modules/education/repositories/storage';
beforeEach(()=>{vi.clearAllMocks();mocks.read.mockResolvedValue([]);mocks.queryRows.mockResolvedValue([]);});
describe('导入仓储查询规模与恢复',()=>{
    it('5000来源与2200完成批次不会形成交叉查询',async()=>{
        const storage=new DatabaseEducationStorage(),ids=Array.from({length:5000},(_,index)=>'source:'+index),batches=Array.from({length:2200},(_,index)=>'batch:'+index);
        await storage.findRecords('org','dataset','oulad_activity',ids,batches);
        expect(mocks.read).toHaveBeenCalledTimes(1);expect(mocks.queryRows).not.toHaveBeenCalled();
        expect(mocks.read.mock.calls[0][0].ids).toContain('source:4999');expect(mocks.read.mock.calls[0][0].batches).toContain('batch:2199');
    });
    it('超过单次参数容量时仅按来源集合分块',async()=>{
        const storage=new DatabaseEducationStorage(),ids=Array.from({length:5000},(_,index)=>'x'.repeat(80)+index);
        await storage.findRecords('org','dataset','oulad_activity',ids,['batch:1','batch:2']);
        expect(mocks.read).toHaveBeenCalledTimes(2);
        const combined=mocks.read.mock.calls.map(call=>String(call[0].ids)).join();expect(combined).toContain(ids[0]);expect(combined).toContain(ids[4999]);
    });
    it('同数据集文件hash改变时拒绝从新检查点目录继续',async()=>{
        mocks.queryRows.mockResolvedValue([{kind:'oulad_activity',filename:'studentVle.csv',sha256:'previous'}]);
        const storage=new DatabaseEducationStorage();
        await expect(storage.assertSourceFiles('org','dataset',[{kind:'oulad_activity',filename:'studentVle.csv',sha256:'changed'}])).rejects.toThrow('原文件指纹');
        await expect(storage.assertSourceFiles('org','dataset',[{kind:'oulad_activity',filename:'studentVle.csv',sha256:'previous'}])).resolves.toBeUndefined();
    });
    it('恢复时状态或原进程标识变化必须拒绝，不误改新任务',async()=>{
        const storage=new DatabaseEducationStorage();
        await expect(storage.recoverStoppedBatches('org','dataset',['batch'],{})).rejects.toThrow('原进程标识');
        await expect(storage.recoverStoppedBatches('org','dataset',['batch'],{batch:'old-run'})).rejects.toThrow('发生变化');
        expect(mocks.queryRows.mock.calls[0][0]).toContain("mapping->>'__importRunId'");
        expect(mocks.queryRows.mock.calls[0][1][6]).toBe('{"batch":"old-run"}');
    });
});
