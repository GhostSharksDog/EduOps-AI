'use client';
import {useEffect,useState} from 'react';
import {Alert,App,Button,DatePicker,Flex,Form,Input,Modal,Select} from 'antd';
import dayjs from 'dayjs';
import {useUnsavedChanges} from '@/shared/ui/use-unsaved-changes';
import type {DecisionTask} from '../contracts';

interface Props{
 task:DecisionTask;owners:{id:string;name:string}[];user?:{id:string;role?:string}|null;
 request:(path:string,method?:string,body?:unknown)=>Promise<DecisionTask>;
 onSaved:(task:DecisionTask)=>void;inline?:boolean;
}
/** Arrangement edits stay separate from task execution and frozen analysis. */
export default function TaskArrangementEditor({task,owners,user,request,onSaved,inline=false}:Props){
 const {message}=App.useApp(),[form]=Form.useForm(),[open,setOpen]=useState(false),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const allowed=['admin','operator'].includes(user?.role??'')&&(user?.role==='admin'||task.ownerId===user?.id||task.createdBy===user?.id)&&['accepted','deferred'].includes(task.state);
 useEffect(()=>{setOpen(false);setDirty(false);setError('');},[task.id,task.version]);
 const save=async()=>{
  if(busy||!allowed)return false;
  try{const values=await form.validateFields();setBusy(true);setError('');const result=await request('/api/decisions/'+task.id,'PATCH',{requestKey:crypto.randomUUID(),expectedVersion:task.version,kind:'adoption',note:'页面确认修改待执行安排',arrangement:{action:values.action,ownerId:values.ownerId,priority:values.priority,dueDate:values.dueDate.format('YYYY-MM-DD'),reviewMethod:values.reviewMethod}});setDirty(false);setOpen(false);onSaved(result);message.success('安排已更新，原始分析与任务状态保持不变。');return true;}catch(cause){if(cause instanceof Error)setError(cause.message);return false;}finally{setBusy(false);}
 };
 const protect=useUnsavedChanges(open&&dirty,save,'任务安排',()=>{setDirty(false);form.resetFields();});
 if(!allowed)return null;
 if(inline)return <section aria-label="修改任务安排"><Button disabled={open||busy} onClick={()=>{form.setFieldsValue({action:task.action,ownerId:task.ownerId,priority:task.priority,dueDate:dayjs(task.dueDate),reviewMethod:task.reviewMethod});setDirty(false);setError('');setOpen(true);}}>修改待执行安排</Button>{open&&<div style={{marginTop:16,padding:16,border:'1px solid var(--edu-border)',borderRadius:10}}>  <Alert type="info" title="保存修改记录，不重复创建任务" description="仅调整动作、责任人、期限及复核方法；不改变分析依据、人群或执行状态。已开始执行的任务不能改写原安排。" style={{marginBottom:16}}/>
  {error&&<Alert type="error" title={error} style={{marginBottom:16}}/>}
  <Form form={form} layout="vertical" onValuesChange={()=>setDirty(true)}>
   <Form.Item name="action" label="执行动作" rules={[{required:true},{max:4000}]}><Input.TextArea rows={3}/></Form.Item>
   <Form.Item name="ownerId" label="责任人" rules={[{required:true}]}><Select options={owners.map(owner=>({value:owner.id,label:owner.name}))}/></Form.Item>
   <Flex gap={12} wrap><Form.Item name="priority" label="优先级" rules={[{required:true}]} style={{flex:'1 1 160px'}}><Select options={[{value:'high',label:'高'},{value:'normal',label:'普通'},{value:'low',label:'低'}]}/></Form.Item><Form.Item name="dueDate" label="截止日期" rules={[{required:true}]} style={{flex:'1 1 160px'}}><DatePicker format="YYYY-MM-DD" style={{width:'100%'}}/></Form.Item></Flex>
   <Form.Item name="reviewMethod" label="复核方法" rules={[{required:true},{max:2000}]}><Input.TextArea rows={2}/></Form.Item>
  </Form><Flex gap={8} justify="end"><Button disabled={busy} onClick={()=>protect(()=>setOpen(false))}>取消修改</Button><Button type="primary" disabled={!dirty||!allowed} loading={busy} onClick={()=>void save()}>确认保存新安排</Button></Flex></div>}</section>;
 return <><Button onClick={()=>{form.setFieldsValue({action:task.action,ownerId:task.ownerId,priority:task.priority,dueDate:dayjs(task.dueDate),reviewMethod:task.reviewMethod});setDirty(false);setError('');setOpen(true);}}>修改待执行安排</Button>
 <Modal title="修改待执行安排" open={open} onCancel={()=>{if(!busy)protect(()=>setOpen(false));}} okText="确认保存新安排" cancelText="返回" confirmLoading={busy} okButtonProps={{disabled:!dirty||!allowed}} onOk={()=>void save()}>
  <Alert type="info" title="保存修改记录，不重复创建任务" description="仅调整动作、责任人、期限及复核方法；不改变分析依据、人群或执行状态。已开始执行的任务不能改写原安排。" style={{marginBottom:16}}/>
  {error&&<Alert type="error" title={error} style={{marginBottom:16}}/>}
  <Form form={form} layout="vertical" onValuesChange={()=>setDirty(true)}>
   <Form.Item name="action" label="执行动作" rules={[{required:true},{max:4000}]}><Input.TextArea rows={3}/></Form.Item>
   <Form.Item name="ownerId" label="责任人" rules={[{required:true}]}><Select options={owners.map(owner=>({value:owner.id,label:owner.name}))}/></Form.Item>
   <Flex gap={12} wrap><Form.Item name="priority" label="优先级" rules={[{required:true}]} style={{flex:'1 1 160px'}}><Select options={[{value:'high',label:'高'},{value:'normal',label:'普通'},{value:'low',label:'低'}]}/></Form.Item><Form.Item name="dueDate" label="截止日期" rules={[{required:true}]} style={{flex:'1 1 160px'}}><DatePicker format="YYYY-MM-DD" style={{width:'100%'}}/></Form.Item></Flex>
   <Form.Item name="reviewMethod" label="复核方法" rules={[{required:true},{max:2000}]}><Input.TextArea rows={2}/></Form.Item>
  </Form>
 </Modal></>;
}
