import 'server-only';
import {queryOne,transaction,execute} from '@/platform/database';
import {WorkflowError} from '@/shared/errors/workflow-error';
import type {AgentActor} from '@/modules/agent/contracts';
import {alertRulesSchema,defaultAlertConfiguration,type AlertRuleConfiguration,type AlertRuleSettings,type AlertRulesUpdateDTO} from '../contracts';

const decode=(value:unknown):AlertRuleSettings=>{
 if(value===undefined||value===null)return {current:defaultAlertConfiguration(),history:[]};
 const object=value as Partial<AlertRuleSettings>;
 if(!object.current||!Array.isArray(object.history))throw new WorkflowError('预警配置格式异常，请管理员核对配置后再评估',503,'ALERT_CONFIGURATION_INVALID');
 const validate=(c:AlertRuleConfiguration)=>Number.isInteger(c.version)&&c.version>0&&alertRulesSchema.safeParse(c.rules).success&&(c.source==='default'||c.source==='published')&&(c.updatedAt===null||typeof c.updatedAt==='string')&&(c.updatedBy===null||typeof c.updatedBy==='string')&&typeof c.note==='string';
 if(!validate(object.current)||!object.history.every(c=>!!c&&validate(c)))throw new WorkflowError('预警配置格式异常，请管理员核对配置后再评估',503,'ALERT_CONFIGURATION_INVALID');
 return {current:object.current,history:object.history};
};

export const alertConfigurationRepository={
 async get(actor:AgentActor):Promise<AlertRuleSettings>{
  const row=await queryOne<{rules:unknown}>('SELECT config->\'alertRules\' AS rules FROM system_config WHERE owned_by=$1',[actor.organizationId]);
  return decode(row?.rules);
 },
 async update(actor:AgentActor,input:AlertRulesUpdateDTO):Promise<AlertRuleSettings>{
  if(actor.role!=='admin')throw new WorkflowError('只有管理员可以发布预警规则配置',403,'ALERT_CONFIGURATION_FORBIDDEN');
  return transaction(async client=>{
   await queryOne('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[actor.organizationId+':alert-rules'],client);
   await execute('INSERT INTO system_config(owned_by,created_by) VALUES ($1,$2) ON CONFLICT (owned_by) DO NOTHING',[actor.organizationId,actor.userId],client);
   const row=await queryOne<{rules:unknown}>('SELECT config->\'alertRules\' AS rules FROM system_config WHERE owned_by=$1 FOR UPDATE',[actor.organizationId],client),old=decode(row?.rules);
   if(old.current.version!==input.expectedVersion)throw new WorkflowError('预警配置已被修改，请刷新版本后重新保存',409,'ALERT_CONFIGURATION_CHANGED');
   const current:AlertRuleConfiguration={version:old.current.version+1,rules:input.rules,note:input.note,source:'published',updatedAt:new Date().toISOString(),updatedBy:actor.userId};
   const settings={current,history:[...old.history,old.current]};
   // 仅更新alertRules，保留会话、主题以及其他模块写入的配置。
   await execute('UPDATE system_config SET config=jsonb_set(config,\'{alertRules}\',$2::jsonb,true),updated_by=$3,update_time=NOW() WHERE owned_by=$1',[actor.organizationId,JSON.stringify(settings),actor.userId],client);
   return settings;
  });
 }
};
