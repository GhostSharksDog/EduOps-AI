'use client';

import {useEffect,useState} from 'react';
import {Alert,App,Button,Flex,Form,Input,Modal,Tag,Typography} from 'antd';
import {EditOutlined,DeleteOutlined} from '@ant-design/icons';
import type {AgentSessionVO} from '../contracts';
import type {TaskStateSaveResult} from './useAgentWorkspace';
import {useUnsavedChanges,readEditBuffer,writeEditBuffer,clearEditBuffer} from '@/shared/ui/use-unsaved-changes';
import styles from './AgentEditorial.module.css';

type TaskState=NonNullable<AgentSessionVO['taskState']>;
interface Fields {goal:string;conditions:string;}
interface BufferedTask {values:Fields;revision:number;}
interface Props {sessionId:string;state?:TaskState|null;editable:boolean;busy:boolean;saving:boolean;datasetName?:string;onSave:(input:{action:'update'|'clear';expectedRevision:number;goal?:string;userConditions?:string[]})=>Promise<TaskStateSaveResult>;}
export default function TaskMemoryPanel({sessionId,state,editable,busy,saving,datasetName,onSave}:Props){
 const {modal}=App.useApp(),[form]=Form.useForm<Fields>();
 const [open,setOpen]=useState(false),[dirty,setDirty]=useState(false),[baseRevision,setBaseRevision]=useState(state?.revision??0),[error,setError]=useState(''),[conflict,setConflict]=useState(false);
 const bufferKey='agent-task:'+sessionId;
 useEffect(()=>{const buffer=readEditBuffer<BufferedTask>(bufferKey);if(buffer&&editable){form.setFieldsValue(buffer.values);setBaseRevision(buffer.revision);setDirty(true);setOpen(true);}},[bufferKey,form,editable]);
 const close=()=>{setOpen(false);setDirty(false);setError('');setConflict(false);clearEditBuffer(bufferKey);};
 const save=async()=>{
  if(saving||busy||!editable||conflict)return false;
  let values:Fields;try{values=await form.validateFields();}catch{return false;}
  const result=await onSave({action:'update',expectedRevision:baseRevision,goal:values.goal.trim(),userConditions:values.conditions.split('\n').map(value=>value.trim()).filter(Boolean)});
  if(result.saved){close();return true;}
  setError(result.message??'当前任务未保存，请重试。');setConflict(!!result.conflict);return false;
 };
 const protect=useUnsavedChanges(open&&dirty,save,'任务目标与条件',close);
 const edit=()=>{setError('');setConflict(false);setBaseRevision(state?.revision??0);form.setFieldsValue({goal:state?.goal??'',conditions:state?.userConditions.join('\n')??''});setDirty(false);setOpen(true);};
 const change=()=>{setDirty(true);writeEditBuffer(bufferKey,{values:form.getFieldsValue(true),revision:baseRevision});};
 const clear=()=>modal.confirm({title:'清除当前任务记忆？',content:'仅清除目标、条件和待补充问题，已有对话与业务记录会保留。',okText:'清除任务记忆',cancelText:'保留',okButtonProps:{danger:true},onOk:async()=>{const result=await onSave({action:'clear',expectedRevision:state?.revision??0});if(!result.saved){setError(result.message??'暂时无法清除，请重试。');throw new Error('任务未清除');}setError('');}});
 const hasMemory=!!(state?.goal||state?.userConditions.length||state?.selectedObjects.length||state?.pendingQuestions.length);
 return <>
  <details className={styles.taskMemory} data-testid="agent-task-memory">
   <summary><span>当前任务</span><strong title={state?.goal??'尚未设置目标'}>{state?.goal??'尚未设置目标'}</strong>{state?.needsReview&&<Tag color="orange">待核对</Tag>}<span className={styles.taskMemoryHint}>详情</span></summary>
   <div className={styles.taskMemoryBody}>
    {state?.needsReview&&<Alert type="warning" showIcon title="数据范围已有变化，请核对任务条件"/>}
    {state?.goal&&<Typography.Paragraph ellipsis={{rows:2,expandable:true,symbol:'展开目标'}}>{state.goal}</Typography.Paragraph>}
    {!!state?.userConditions.length&&<ul>{state.userConditions.map((condition,index)=><li key={index}>{condition}</li>)}</ul>}
    {!!state?.selectedObjects.length&&<Flex gap={5} wrap>{state.selectedObjects.map(object=><Tag key={object.kind+':'+object.id}>{object.name}{object.version!==undefined?' · v'+object.version:''}</Tag>)}</Flex>}
    {!!state?.pendingQuestions.length&&<div><Typography.Text type="secondary">待补充</Typography.Text><ul>{state.pendingQuestions.map((question,index)=><li key={index}>{question}</li>)}</ul></div>}
    <Flex gap={8} wrap align="center"><Typography.Text type="secondary">{datasetName??'会话当前来源'} · 任务版本 {state?.revision??0}</Typography.Text>{editable&&<><Button size="small" icon={<EditOutlined/>} disabled={busy||saving} onClick={edit}>修改任务</Button><Button size="small" icon={<DeleteOutlined/>} disabled={busy||saving||!hasMemory} loading={saving} onClick={clear}>清除</Button></>}</Flex>
    {error&&!open&&<Alert type="error" title={error}/>}
   </div>
  </details>
  <Modal title="修改当前任务" open={open} onCancel={()=>{if(!saving)protect(close);}} onOk={()=>void save()} okText="保存任务" cancelText="返回" confirmLoading={saving} okButtonProps={{disabled:busy||conflict}} destroyOnHidden={false} className={styles.taskMemoryModal}>
   {error&&<Alert showIcon type={conflict?'warning':'error'} title={error} style={{marginBottom:12}}/>}
   {conflict&&<div className={styles.taskConflict}><Typography.Text strong>最新任务 · v{state?.revision??0}</Typography.Text><Typography.Paragraph>{state?.goal??'未设置目标'}</Typography.Paragraph>{!!state?.userConditions.length&&<ul>{state.userConditions.map((condition,index)=><li key={index}>{condition}</li>)}</ul>}<Button size="small" onClick={()=>{setBaseRevision(state?.revision??0);setConflict(false);setError('');writeEditBuffer(bufferKey,{values:form.getFieldsValue(true),revision:state?.revision??0});}}>使用最新版本继续编辑</Button></div>}
   <Form form={form} layout="vertical" onValuesChange={change} disabled={saving}>
    <Form.Item label="任务目标" name="goal" rules={[{required:true,whitespace:true,message:'请填写任务目标'},{max:500,message:'目标最多500个字符'}]}><Input.TextArea aria-label="任务目标" autoSize={{minRows:2,maxRows:4}} maxLength={500} placeholder="这次希望分析或完成什么？"/></Form.Item>
    <Form.Item label="用户条件" name="conditions" extra="每行一项，最多8项，每项最多200个字符。" rules={[{validator:async(_,value:string)=>{const rows=(value??'').split('\n').map(row=>row.trim()).filter(Boolean);if(rows.length>8)throw new Error('最多保留8项条件');if(rows.some(row=>row.length>200))throw new Error('每项条件最多200个字符');}}]}><Input.TextArea aria-label="任务条件" autoSize={{minRows:3,maxRows:7}} placeholder="例如：只查看某一课程；先预览名单，再确认发布。"/></Form.Item>
   </Form>
  </Modal>
 </>;
}
