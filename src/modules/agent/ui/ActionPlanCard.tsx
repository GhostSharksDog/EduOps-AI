'use client';

import {useEffect,useState} from 'react';
import {Alert,App,Button,Card,DatePicker,Flex,Form,Input,Modal,Select,Tag,Typography} from 'antd';
import {CheckCircleOutlined,EditOutlined} from '@ant-design/icons';
import dayjs from 'dayjs';
import {isFinanceScope,isLearningScope} from '@/shared/contracts/analysis';
import type {OperationalTagRuleDTO} from '@/modules/tag/contracts';
import {useAuthStore} from '@/modules/identity/client';
import {useUnsavedChanges} from '@/shared/ui/use-unsaved-changes';
import {actionKindLabels} from '../contracts/actions';
import type {ActionPlanVO,EditActionPlanInput} from '../contracts/actions';
import styles from './AgentEditorial.module.css';

const planLabels={prepared:'待你确认',executing:'执行中',partially_failed:'部分未完成',completed:'全部完成',invalid:'需要重新准备'};
const stepLabels={pending:'待执行',running:'执行中',completed:'已完成',failed:'未完成'};
function ruleText(rule:OperationalTagRuleDTO):string {
 if(rule.type==='all'||rule.type==='any')return rule.conditions.map(ruleText).join(rule.type==='all'?' 且 ':' 或 ');
 if(rule.type==='attendance_below')return '出勤率低于'+rule.thresholdPercent+'%，应出勤至少'+rule.minimumDue+'次';
 if(rule.type==='absence_count')return '缺勤至少'+rule.minimumAbsences+'次，应出勤至少'+rule.minimumDue+'次';
 if(rule.type==='renewal_due')return '未来'+rule.withinDays+'天到期且尚未有效续费';
 if(rule.type==='hours_remaining')return '有效课时余额大于0且不超过'+rule.maximumHours+'课时';
 return '近'+rule.lookbackDays+'天至少'+rule.minimumCount+'次客诉';
}
function scopeText(plan:ActionPlanVO){const scope=plan.scope;if(isFinanceScope(scope))return scope.years.length?scope.years.join('、')+'年度':'全部已导入年度';if(isLearningScope(scope))return (scope.courseKeys.length?'限定'+scope.courseKeys.length+'个课程批次':'全部课程批次')+' · 相对日 '+(scope.relativeDayStart??'起点')+' 至 '+(scope.relativeDayEnd??'终点');return scope.startDate+' 至 '+scope.endDate+' · '+(scope.campusIds.length?'限定'+scope.campusIds.length+'个校区':'全部校区')+' · '+(scope.courseIds.length?'限定'+scope.courseIds.length+'个课程':'全部课程')+(scope.channelIds.length?' · 限定'+scope.channelIds.length+'个渠道':'');}

export interface ActionPlanCardProps {plan:ActionPlanVO;writable:boolean;busy:boolean;onConfirm:(plan:ActionPlanVO)=>Promise<boolean>;onEdit:(input:EditActionPlanInput)=>Promise<boolean>;onFollowUp?:(message:string)=>void;}
export default function ActionPlanCard({plan,writable,busy,onConfirm,onEdit,onFollowUp}:ActionPlanCardProps){
 const {message}=App.useApp(),user=useAuthStore(state=>state.user),token=useAuthStore(state=>state.token);
 const [confirmOpen,setConfirmOpen]=useState(false),[editOpen,setEditOpen]=useState(false),[changed,setChanged]=useState(false),[time,setTime]=useState(Date.now());
 const [form]=Form.useForm();
 const [owners,setOwners]=useState<{id:string;name:string}[]>([]),[ownersLoading,setOwnersLoading]=useState(false),[ownersError,setOwnersError]=useState('');
 const segment=plan.steps.find(step=>step.input.kind==='save_segment'&&step.status==='pending'),task=plan.steps.find(step=>step.input.kind==='create_decision_task'&&step.status==='pending'),report=plan.steps.find(step=>step.input.kind==='generate_report'&&step.status==='pending');
 const taskInput=task?.input.kind==='create_decision_task'?task.input.task:undefined;
 const hasCompleted=plan.steps.some(step=>step.status==='completed'&&!step.result?.reused),needsPublish=plan.steps.some(step=>step.kind==='publish_tag'&&step.status!=='completed');
 const derivedExpiry=Date.parse(plan.createdAt)+30*60*1000,explicitExpiry=Date.parse(plan.expiresAt??'');
 const planExpiry=Number.isFinite(explicitExpiry)?Math.min(derivedExpiry,explicitExpiry):derivedExpiry;
 const expired=plan.status!=='completed'&&(!Number.isFinite(planExpiry)||time>=planExpiry||needsPublish&&!!plan.preview&&time>=Date.parse(plan.preview.expiresAt));
 const failedReport=plan.errorCode==='REPORT_FAILED'||plan.steps.some(step=>step.kind==='generate_report'&&step.errorCode==='REPORT_FAILED');
 const actionable=writable&&!busy&&!expired&&!failedReport&&['prepared','partially_failed'].includes(plan.status);
 const editable=writable&&!busy&&plan.status==='prepared'&&!hasCompleted&&!!(segment||task||report)&&plan.steps.every(step=>step.status==='pending'||step.status==='completed'&&step.result?.reused);
 const protect=useUnsavedChanges(editOpen&&changed,undefined,'尚未保存的操作计划',()=>{setChanged(false);form.resetFields();});
 useEffect(()=>{const timer=setInterval(()=>setTime(Date.now()),15000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{if(!editOpen)return;form.setFieldsValue({segmentName:segment?.input.kind==='save_segment'?segment.input.name:undefined,action:taskInput?.action,ownerId:taskInput?.ownerId??user?.id,priority:taskInput?.priority??'normal',dueDate:taskInput?dayjs(taskInput.dueDate):undefined,reviewMethod:taskInput?.reviewMethod,kind:report?.input.kind==='generate_report'?report.input.kindOfReport:undefined,anchorDate:report?.input.kind==='generate_report'?dayjs(report.input.anchorDate):undefined});setChanged(false);},[editOpen,plan.id,plan.version,form,user?.id]);
 useEffect(()=>{
  if(!editOpen||!taskInput)return;const controller=new AbortController();setOwnersLoading(true);setOwnersError('');setOwners([]);
  void fetch('/api/decisions/owners',{headers:{Authorization:'Bearer '+token},signal:controller.signal}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.message??body.error??'责任人列表加载失败');if(!controller.signal.aborted)setOwners(body.data??[]);}).catch(error=>{if(!controller.signal.aborted)setOwnersError(error instanceof Error?error.message:'责任人列表加载失败');}).finally(()=>{if(!controller.signal.aborted)setOwnersLoading(false);});
  return()=>controller.abort();
 },[editOpen,plan.id,token]);
 const save=async()=>{
  const values=await form.validateFields();
  const input:EditActionPlanInput={runId:plan.runId,planId:plan.id,version:plan.version,...(segment?{segmentName:values.segmentName}:{}),...(taskInput?{task:{...taskInput,action:values.action,ownerId:values.ownerId,priority:values.priority,dueDate:values.dueDate.format('YYYY-MM-DD'),reviewMethod:values.reviewMethod}}:{}),...(report?{report:{kind:values.kind,anchorDate:values.anchorDate.format('YYYY-MM-DD')}}:{})};
  if(await onEdit(input)){setChanged(false);setEditOpen(false);message.success('计划已更新，请按新版本核对。');}
 };
 const details=<Flex className={styles.planDetails} vertical gap={16}>
  <Typography.Text type="secondary" data-testid="action-plan-scope">{scopeText(plan)}</Typography.Text>
  {!isFinanceScope(plan.scope)&&!isLearningScope(plan.scope)&&plan.scope.dataCutoff&&<Typography.Text type="secondary" style={{fontSize:12}}>数据截止：{dayjs(plan.scope.dataCutoff).format('YYYY-MM-DD HH:mm:ss')}</Typography.Text>}
  {plan.preview&&<div className={styles.planPreview}><Typography.Text strong>{plan.preview.name} · 标签 v{plan.preview.version}</Typography.Text><Typography.Paragraph className={styles.planRule}>{ruleText(plan.preview.rule)}</Typography.Paragraph><Flex gap={8} wrap><Tag color="blue">覆盖 <strong>{plan.preview.memberCount}</strong> 人</Tag><Tag color={plan.preview.unknownCount?'orange':'default'}>未知 <strong>{plan.preview.unknownCount}</strong> 人</Tag></Flex>{needsPublish&&<Typography.Text type={expired?'danger':'secondary'} className={styles.previewExpiry}>预览有效至 {dayjs(plan.preview.expiresAt).format('YYYY-MM-DD HH:mm:ss')}</Typography.Text>}</div>}
  {plan.steps.map((step,index)=><div key={step.id} className={styles.planStep} data-testid={'action-step-'+step.kind}>
   <Flex justify="space-between" gap={8} wrap><Typography.Text strong className={styles.planStepTitle}><span className={styles.stepNumber}>{String(index+1).padStart(2,'0')}</span>{step.title||actionKindLabels[step.kind]}</Typography.Text><Tag color={step.status==='completed'?'green':step.status==='failed'?'red':step.status==='running'?'blue':'default'}>{stepLabels[step.status]}</Tag></Flex>
   {step.input.kind==='save_segment'&&<><Typography.Paragraph style={{margin:'6px 0 0'}}>人群名称：{step.input.name}</Typography.Paragraph><Typography.Text type="secondary" style={{fontSize:12}}>同一标签版本已有名单时复用原名单及名称，不重复保存。</Typography.Text></>}
   {step.input.kind==='create_decision_task'&&<Flex vertical gap={6} style={{marginTop:6}}><Typography.Text>{step.input.task.action}</Typography.Text><Typography.Text type="secondary" style={{fontSize:12}}>责任人：{step.input.ownerName||(!step.input.task.ownerId?'计划创建者，执行时核验':step.input.task.ownerId===user?.id?(user?.realName||user?.username||'当前账号'):'已指定账号')} · 截止 {step.input.task.dueDate} · {step.input.task.priority==='high'?'高':step.input.task.priority==='low'?'低':'普通'}优先级</Typography.Text><Typography.Text type="secondary" style={{fontSize:12}}>复核：{step.input.task.reviewMethod}</Typography.Text></Flex>}
   {step.input.kind==='generate_report'&&<Typography.Text type="secondary">{step.input.kindOfReport==='monthly'?'月报':'周报'} · 周期锚点 {step.input.anchorDate}</Typography.Text>}
   {step.errorMessage&&<Typography.Paragraph type="danger" style={{margin:'6px 0 0'}}>{step.errorMessage}</Typography.Paragraph>}
   {step.result?.reused&&<Tag color="blue" style={{marginTop:8}}>复用已有记录</Tag>}
   {step.result?.url.startsWith('/dashboard')&&<Button style={{marginTop:8}} size="small" href={step.result.url}>{step.result.label||'查看结果'}</Button>}
  </div>)}
 </Flex>;
 return <Card className={styles.actionPlan} data-testid="agent-action-plan" title={<Flex align="center" gap={8} wrap><CheckCircleOutlined className={styles.planIcon} aria-hidden/><span>下一步操作</span><Tag>v{plan.version}</Tag><Tag color={plan.status==='completed'?'green':plan.status==='partially_failed'||plan.status==='invalid'?'orange':'purple'}>{planLabels[plan.status]}</Tag></Flex>}>
  <div className={styles.planIntro}><span>{plan.status==='completed'?'已保留执行结果':'先核对，再执行'}</span><Typography.Text type="secondary">{plan.status==='completed'?'可以打开已完成的业务记录。':'正式操作仅在页面确认后开始。'}</Typography.Text></div>
  {details}
  {plan.errorMessage&&<Alert style={{marginTop:12}} type="error" title={plan.errorMessage}/>}
  {failedReport&&<Alert style={{marginTop:12}} type="warning" title="原报告失败记录已保留" description="不会重试或改写这份报告。需要再次生成时，请准备并确认新的报告计划。"/>}
  {expired&&<Alert style={{marginTop:12}} type="warning" title="计划或预览已过期，请重新准备" description="已完成的步骤不会重复创建。"/>}
  {!writable&&plan.status!=='completed'&&<Typography.Paragraph type="secondary" style={{marginTop:12}}>只读账号可以查看计划；正式执行需要运营或管理员账号。</Typography.Paragraph>}
  <Flex className={styles.planActions} gap={8} wrap>
   {!failedReport&&['prepared','partially_failed','executing'].includes(plan.status)&&<Button type="primary" aria-label={plan.status==='partially_failed'?'核对并恢复未完成步骤':'核对并执行'} icon={<CheckCircleOutlined aria-hidden/>} disabled={!actionable} loading={busy&&confirmOpen} onClick={()=>setConfirmOpen(true)}>{plan.status==='partially_failed'?'核对并恢复未完成步骤':'核对并执行'}</Button>}
   {failedReport&&writable&&onFollowUp&&<Button type="primary" disabled={busy} onClick={()=>onFollowUp('保留上一份报告的失败记录，请按它的统计范围重新准备一个新的报告计划；先展示确认卡，不自动执行，也不要重试原报告。')}>重新准备报告计划</Button>}
   {editable&&<Button aria-label="修改计划" icon={<EditOutlined aria-hidden/>} onClick={()=>setEditOpen(true)}>修改计划</Button>}
   {!failedReport&&(expired||plan.status==='invalid')&&writable&&onFollowUp&&<Button onClick={()=>onFollowUp(plan.errorCode==='DECISION_SOURCE_CONFLICT'?'请查询该建议已经保存的任务，说明当前安排及进入任务页面修改待执行安排的步骤，不要重复创建。':'请重新核对上一项操作计划，重新预览覆盖范围，并保留已经完成的对象。')}>{plan.errorCode==='DECISION_SOURCE_CONFLICT'?'查看已有安排':'重新准备计划'}</Button>}
   {plan.status==='completed'&&onFollowUp&&<Button onClick={()=>onFollowUp('查看刚才操作的结果，告诉我接下来应该关注什么。')}>继续分析结果</Button>}
  </Flex>
  <Modal className={styles.planModal} title={'确认执行操作计划 · v'+plan.version} open={confirmOpen} onCancel={()=>{if(!busy)setConfirmOpen(false);}} okText={plan.status==='partially_failed'?'确认恢复未完成步骤':'确认执行以上操作'} cancelText="返回核对" confirmLoading={busy} okButtonProps={{disabled:!actionable}} onOk={async()=>{if(!actionable)return;const ok=await onConfirm(plan);setConfirmOpen(false);if(ok)message.success('操作已完成，可以查看结果或继续提问。');}}>
   <Alert type="info" showIcon title="按此版本执行，不会执行其他操作" description="将依次执行上面的业务动作；每一步会保留结果和记录。" style={{marginBottom:14}}/>{details}
  </Modal>
  <Modal className={styles.planModal} title="修改操作计划" open={editOpen} onCancel={()=>{if(!busy)protect(()=>setEditOpen(false));}} okText="保存新版本" cancelText="取消" confirmLoading={busy} okButtonProps={{disabled:!editable||!changed}} onOk={()=>void save()}>
   <Form form={form} layout="vertical" onValuesChange={()=>setChanged(true)}>
    {ownersError&&<Alert type="warning" title={ownersError} description="原责任人保留；关闭后重新打开可重试。" style={{marginBottom:12}}/>}
    {segment&&<Form.Item name="segmentName" label="人群名称" rules={[{required:true,whitespace:true,message:'请输入人群名称'},{max:120,message:'名称最多120字'}]}><Input aria-label="人群名称" maxLength={120}/></Form.Item>}
    {taskInput&&<Form.Item name="ownerId" label="责任人" rules={[{required:true,message:'请选择责任人'}]}><Select loading={ownersLoading} disabled={user?.role!=='admin'} options={owners.length?owners.map(owner=>({value:owner.id,label:owner.name})):[{value:taskInput.ownerId??user?.id,label:!taskInput.ownerId||taskInput.ownerId===user?.id?(user?.realName||user?.username||'当前账号'):'已指定账号'}]}/></Form.Item>}
    {taskInput&&<><Form.Item name="action" label="执行动作" rules={[{required:true,whitespace:true,message:'请填写具体执行动作'}]}><Input.TextArea autoSize={{minRows:2,maxRows:5}} maxLength={4000}/></Form.Item><Form.Item name="priority" label="优先级"><Select options={[{value:'high',label:'高'},{value:'normal',label:'普通'},{value:'low',label:'低'}]}/></Form.Item><Form.Item name="dueDate" label="完成期限" rules={[{required:true,message:'请选择完成期限'}]}><DatePicker format="YYYY-MM-DD" style={{width:'100%'}}/></Form.Item><Form.Item name="reviewMethod" label="如何复核" rules={[{required:true,whitespace:true,message:'请填写复核方法'}]}><Input.TextArea autoSize={{minRows:2,maxRows:4}} maxLength={2000}/></Form.Item></>}
    {report&&<><Form.Item name="kind" label="报告类型" rules={[{required:true,message:'请选择报告类型'}]}><Select options={[{value:'weekly',label:'周报'},{value:'monthly',label:'月报'}]}/></Form.Item><Form.Item name="anchorDate" label="报告周期锚点" rules={[{required:true,message:'请选择日期'}]}><DatePicker format="YYYY-MM-DD" style={{width:'100%'}}/></Form.Item></>}
   </Form>
  </Modal>
 </Card>;
}
