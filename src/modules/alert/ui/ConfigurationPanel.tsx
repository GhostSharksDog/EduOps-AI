'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Alert,App,Button,Flex,Form,Input,InputNumber,Switch,Table,Tag,Typography} from 'antd';
import {useAuthStore} from '@/modules/identity/client';
import {useUnsavedChanges} from '@/shared/ui/use-unsaved-changes';
import {alertRuleIds,alertRuleLabels,type AlertRuleSettings,type AlertRules} from '../contracts';

export default function ConfigurationPanel(){
 const token=useAuthStore(s=>s.token),admin=useAuthStore(s=>s.user?.role)==='admin',{message}=App.useApp(),[form]=Form.useForm<{rules:AlertRules;note:string}>();
 const [settings,setSettings]=useState<AlertRuleSettings|null>(null),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[dirty,setDirty]=useState(false),[error,setError]=useState(''),busy=useRef(false);
 const load=useCallback(async()=>{setLoading(true);try{const response=await fetch('/api/alerts/configuration',{headers:{Authorization:'Bearer '+token}}),body=await response.json();if(!response.ok)throw Error(body.message??'预警配置读取失败');setSettings(body.data);form.setFieldsValue({rules:structuredClone(body.data.current.rules),note:''});setDirty(false);setError('');}catch(e){setError((e as Error).message);}finally{setLoading(false);}},[token,form]);
 useEffect(()=>{void load();},[load]);
 async function save():Promise<boolean>{
  if(!admin||!settings||busy.current)return false;
  let values:{rules:AlertRules;note:string};try{values=await form.validateFields();}catch{return false;}
  busy.current=true;setSaving(true);try{const response=await fetch('/api/alerts/configuration',{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({expectedVersion:settings.current.version,...values})}),body=await response.json();if(!response.ok)throw Error(body.message??'规则发布失败');setSettings(body.data);form.setFieldValue('note','');setDirty(false);setError('');message.success('已发布新规则版本，历史预警保持原样；需明确评估才生成新结果。');return true;}catch(e){setError((e as Error).message);return false;}finally{busy.current=false;setSaving(false);}
 }
 const protect=useUnsavedChanges(dirty,save,'预警规则设置',()=>{setDirty(false);if(settings)form.setFieldsValue({rules:structuredClone(settings.current.rules),note:''});});
 return <Flex vertical gap={14}>
  <Flex gap={8} wrap align="center"><Tag color="blue">{settings?'当前 v'+settings.current.version:'读取配置中'}</Tag><Typography.Text type="secondary">{settings?.current.source==='default'?'初始模拟配置':settings?.current.updatedAt?'发布于 '+new Date(settings.current.updatedAt).toLocaleString('zh-CN'):''}</Typography.Text><Button loading={loading} onClick={()=>protect(()=>void load())}>刷新版本</Button></Flex>
  <Alert type="info" showIcon title="配置只影响之后明确触发的评估" description="历史预警保留当时配置。渠道席位贡献率不适用满班不足规则；数据未知或样本不足时跳过，不当成正常。"/>
  {error&&<Alert type="error" showIcon title={error} action={<Button onClick={()=>protect(()=>void load())}>重新读取</Button>}/>}
  {settings&&<Form form={form} layout="vertical" disabled={!admin||loading||saving} onValuesChange={()=>setDirty(true)}>
   <div style={{overflowX:'auto'}}><Table rowKey="id" pagination={false} dataSource={alertRuleIds.map(id=>({id}))} scroll={{x:680}} columns={[
    {title:'规则',render:(_,r)=><Typography.Text strong>{alertRuleLabels[r.id]}</Typography.Text>},
    {title:'启用',render:(_,r)=><Form.Item name={['rules',r.id,'enabled']} valuePropName="checked" style={{margin:0}}><Switch aria-label={alertRuleLabels[r.id]+'启用'}/></Form.Item>},
    {title:'阈值',render:(_,r)=><Form.Item name={['rules',r.id,'threshold']} rules={[{required:true}]} style={{margin:0}}><InputNumber aria-label={alertRuleLabels[r.id]+'阈值'} min={0} max={100} step={1} suffix={r.id==='attendance_drop'?'个百分点':'%'} style={{width:155}}/></Form.Item>},
    {title:'最小样本量',render:(_,r)=><Form.Item name={['rules',r.id,'minimumSample']} rules={[{required:true}]} style={{margin:0}}><InputNumber aria-label={alertRuleLabels[r.id]+'最小样本量'} min={1} max={10000000} precision={0} style={{width:140}}/></Form.Item>},
    {title:'样本含义',render:(_,r)=>r.id==='attendance_drop'?'本期和对比期各自应出勤次数':r.id==='low_fill'?'所选班级总班额':'具备续费资格的到期对象'}
   ]}/></div>
   <Typography.Paragraph type="secondary" style={{marginTop:12}}>出勤下降为“至少达到阈值”，满班和续费为“严格低于阈值”；判断使用未舍入的分子分母。</Typography.Paragraph>
   {admin&&<><Form.Item name="note" label="修改说明" rules={[{required:true,message:'请记录调整原因'},{max:1000}]}><Input.TextArea aria-label="预警配置修改说明" maxLength={1000} rows={2} placeholder="记录调整原因、适用场景及拟核对的样本"/></Form.Item><Button type="primary" disabled={!dirty} loading={saving} onClick={()=>void save()}>发布新版本</Button></>}
  </Form>}
  {!admin&&<Typography.Text type="secondary">仅管理员可修改。运营人员使用当前已发布规则，只读账号查看配置与结果。</Typography.Text>}
  {settings&&<details><summary>配置历史（不改写旧预警）</summary><Table rowKey="version" size="small" scroll={{x:680}} dataSource={[settings.current,...[...settings.history].reverse()]} pagination={{pageSize:5}} columns={[{title:'版本',dataIndex:'version',render:v=>'v'+v},{title:'发布时间',dataIndex:'updatedAt',render:v=>v?new Date(v).toLocaleString('zh-CN'):'系统初始配置'},{title:'修改说明',dataIndex:'note'},{title:'冻结阈值',render:(_,c)=>alertRuleIds.map(id=>`${alertRuleLabels[id]}：${c.rules[id].enabled?c.rules[id].threshold+(id==='attendance_drop'?'个百分点':'%')+' / 样本≥'+c.rules[id].minimumSample:'停用'}`).join('；')}]} /></details>}
 </Flex>;
}
