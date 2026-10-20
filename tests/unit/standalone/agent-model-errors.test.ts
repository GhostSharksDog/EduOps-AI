import {describe,expect,it} from 'vitest';
import {ModelServiceError} from '@/platform/ai/client';
import {safeAgentError} from '@/modules/agent/services/service';

describe('Agent模型错误的安全恢复提示',()=>{
 it.each([
  ['ENOTFOUND','DNS'],['EAI_AGAIN','DNS'],
  ['EPERM','系统拦截'],['EACCES','系统拦截'],
  ['ENETUNREACH','网络或代理'],['EHOSTUNREACH','网络或代理'],
  ['ECONNREFUSED','连接被拒绝'],['ECONNRESET','连接中断'],['UND_ERR_SOCKET','连接中断'],
  ['ETIMEDOUT','超时'],['UND_ERR_CONNECT_TIMEOUT','超时'],
  ['ERR_INVALID_URL','地址格式'],
  ['ERR_TLS_CERT_ALTNAME_INVALID','证书校验'],['UNABLE_TO_VERIFY_LEAF_SIGNATURE','证书校验'],
  ['CERT_HAS_EXPIRED','证书校验'],['DEPTH_ZERO_SELF_SIGNED_CERT','证书校验'],
 ])('网络%s返回具体恢复提示且保持原错误码', (networkReason,expected)=>{
  const error=safeAgentError(new ModelServiceError('private-key https://private-provider/response','MODEL_NETWORK',{networkReason}));
  expect(error).toMatchObject({code:'MODEL_NETWORK',status:502});
  expect(error.message).toContain(expected);
  expect(JSON.stringify(error)).not.toContain('private');
  expect(error).not.toHaveProperty('diagnostics');
 });
 it.each([
  [401,'密钥验证失败'],[403,'访问被拒绝'],[402,'额度或余额'],[429,'请求受限'],
  [404,'模型或接口不存在'],[500,'服务暂时异常'],[503,'服务暂时异常'],[599,'服务暂时异常'],
 ])('HTTP%s提供对应恢复建议，HTTP状态不冒充用户身份错误',(httpStatus,expected)=>{
  const error=safeAgentError(new ModelServiceError('private-provider-body-and-key','MODEL_HTTP',{httpStatus}));
  expect(error).toMatchObject({code:'MODEL_HTTP',status:502});
  expect(error.message).toContain(expected);
  expect(error.message).not.toContain('private');
 });
 it('未知网络原因及HTTP错误不回显未受信任诊断',()=>{
  for(const modelError of [new ModelServiceError('private-message','MODEL_NETWORK',{networkReason:'private-code'}),new ModelServiceError('private-message','MODEL_HTTP',{httpStatus:418})]){
   const error=safeAgentError(modelError);expect(error.message).not.toContain('private');
   expect(error.message).not.toContain('418');expect(error.status).toBe(502);
  }
 });
 it('未配置与调用超时继续保留原错误码及状态',()=>{
  expect(safeAgentError(new ModelServiceError('private','UNCONFIGURED'))).toMatchObject({code:'UNCONFIGURED',status:503,message:'对话模型尚未配置'});
  const timeout=safeAgentError(new ModelServiceError('private','MODEL_TIMEOUT'));
  expect(timeout).toMatchObject({code:'MODEL_TIMEOUT',status:502});expect(timeout.message).toContain('超时');
 });
});
