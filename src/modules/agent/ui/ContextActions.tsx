'use client';
import {useEffect,useState} from 'react';
import {Button,Input} from 'antd';
import type {AgentQuestionVO} from '../contracts';
import {buildClarificationReply,canSendClarificationImmediately,type AgentContextAction,type AgentScopeStatus} from '../domain/context-actions';
import styles from './ContextActions.module.css';

export interface ContextActionsProps {
 runId:string;actions:readonly AgentContextAction[];questions?:readonly AgentQuestionVO[];
 busy:boolean;canContinue:boolean;scopeStatus:AgentScopeStatus;
 /** The parent protects unsent text and applies the selected answer's frozen scope before sending. */
 onAction:(action:AgentContextAction)=>void|Promise<void>;
}
export default function ContextActions({runId,actions,questions=[],busy,canContinue,scopeStatus,onAction}:ContextActionsProps){
 const [answers,setAnswers]=useState<Record<string,string>>({});
 const questionKey=JSON.stringify(questions);
 useEffect(()=>setAnswers({}),[runId,questionKey]);
 const canClarify=canContinue&&scopeStatus==='current',reply=buildClarificationReply(questions,Object.entries(answers).map(([questionId,value])=>({questionId,value})));
 const singleChoice=questions.length===1&&!!questions[0].options?.length;
 const submit=(message:string,sendImmediately:boolean)=>void onAction({id:'clarification-reply',kind:'message',runId,label:'补充并继续',message,sendImmediately});
 const choose=(question:AgentQuestionVO,value:string)=>{
  const next={...answers,[question.id]:value};setAnswers(next);
  if(singleChoice){const text=buildClarificationReply(questions,[{questionId:question.id,value}]);if(text)submit(text,canSendClarificationImmediately(value));}
 };
 const shownActions=actions.slice(0,2);
 if(!questions.length&&!shownActions.length)return null;
 return <section className={styles.panel} data-testid="agent-context-actions" aria-label="继续处理本轮结果">
  {!!questions.length&&<div className={styles.questions} data-testid="agent-clarification">
   {questions.map(question=><div className={styles.question} key={question.id}>
    <p className={styles.questionTitle}>{question.prompt}</p>
    {question.options?.length?<div className={styles.choices}>{question.options.map(option=><Button className={styles.choice} key={option.value} data-selected={answers[question.id]===option.value} aria-pressed={answers[question.id]===option.value} disabled={busy||!canClarify} onClick={()=>choose(question,option.value)}>{option.label}</Button>)}</div>:<Input.TextArea aria-label={question.prompt} autoSize={{minRows:1,maxRows:3}} maxLength={1000} value={answers[question.id]??''} disabled={busy||!canClarify} onChange={event=>setAnswers(previous=>({...previous,[question.id]:event.target.value}))}/>}
   </div>)}
   {!singleChoice&&<Button className={styles.submit} type="primary" disabled={busy||!canClarify||!reply} onClick={()=>{if(reply)submit(reply,Object.values(answers).every(canSendClarificationImmediately));}}>补充并继续</Button>}
   <p className={styles.hint}>{scopeStatus!=='current'?'这是另一范围的历史问题。先选择“按该回答范围继续”，再补充信息。':!canContinue?'此会话仅可查看。':singleChoice?'普通补参可直接继续；涉及操作的选项先放入输入区，正式操作仍需页面确认。':'选齐或填写后统一提交；涉及操作的回复先放入输入区，这些选项不是已计算的经营结果。'}</p>
  </div>}
  {!!shownActions.length&&<div className={styles.actions}>{shownActions.map((action,index)=><Button key={action.id} type={index===0?'primary':'default'} title={action.description} disabled={busy&&action.kind!=='open_operations'&&action.kind!=='open_evidence'&&action.kind!=='open_saved_result'||!canContinue&&['message','continue_scope','retry_interpretation'].includes(action.kind)} onClick={()=>void onAction(action)}>{action.label}</Button>)}</div>}
  {scopeStatus!=='current'&&!shownActions.some(action=>action.kind==='continue_scope')&&<p className={styles.hint}>保留这条回答的原始范围，未自动切换下一轮查询。</p>}
 </section>;
}
