import {describe,it,expect} from 'vitest';
import {runWithRequestContext,getRequestContext,generateRequestId,type RequestContext} from '@/platform/request-context';
describe('RequestContext',()=>{
 it('生成唯一请求编号',()=>{const a=generateRequestId(),b=generateRequestId();expect(a).not.toBe(b);expect(a).toMatch(/^req_[a-z0-9]+_[a-z0-9]+$/);});
 it('上下文仅在run范围内存在，返回后不污染后续请求',()=>{const ctx:RequestContext={requestId:'req_test',startTime:Date.now(),path:'/api/test',method:'GET'};expect(getRequestContext()).toBeUndefined();runWithRequestContext(ctx,()=>expect(getRequestContext()).toEqual(ctx));expect(getRequestContext()).toBeUndefined();});
 it('异步并发请求各自保留请求上下文',async()=>{const seen=await Promise.all(['a','b'].map(requestId=>runWithRequestContext({requestId,startTime:Date.now(),path:'/api/test',method:'GET'},async()=>{await Promise.resolve();return getRequestContext()?.requestId;})));expect(seen).toEqual(['a','b']);expect(getRequestContext()).toBeUndefined();});
});
