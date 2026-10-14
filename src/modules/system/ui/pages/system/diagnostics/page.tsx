'use client';
import {useCallback,useEffect,useState} from 'react';
import {Alert,Button,Card,Col,Empty,Flex,Row,Tag,Typography} from 'antd';
import {ReloadOutlined,SafetyCertificateOutlined} from '@ant-design/icons';
import {useAuthStore} from '@/modules/identity/client';
import type {RuntimeDiagnostics,DiagnosticState} from '@/modules/system/contracts';

const states:Record<DiagnosticState,{text:string;color:string}>={ready:{text:'已就绪',color:'green'},warning:{text:'需要配置',color:'orange'},failed:{text:'检查失败',color:'red'},blocked:{text:'暂不能判断',color:'default'}};
export default function DiagnosticsPage(){
 const token=useAuthStore(s=>s.token),role=useAuthStore(s=>s.user?.role),allowed=role==='admin'||role==='operator';
 const [result,setResult]=useState<RuntimeDiagnostics|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const check=useCallback(async()=>{
  if(!token||!allowed)return;
  setBusy(true);setError('');
  try{const response=await fetch('/api/system/diagnostics',{headers:{Authorization:'Bearer '+token},cache:'no-store'}),body=await response.json();if(!response.ok)throw new Error(body.message??'运行检查暂不可用');setResult(body.data);}
  catch(e){setError(e instanceof Error?e.message:'运行检查暂不可用，请稍后重试');}
  finally{setBusy(false);}
 },[allowed,token]);
 useEffect(()=>{void check();},[check]);
 if(role&&!allowed)return <Alert type="info" title="当前账号无运行诊断权限" description="运行环境检查由管理员或运营人员使用。"/>;
 return <Flex vertical gap={18}>
  <div className="business-page-header"><div><Typography.Title level={2}><SafetyCertificateOutlined/> 运行诊断</Typography.Title><Typography.Paragraph type="secondary">检查数据连接、必要结构和模型配置，按提示恢复后重新检查。</Typography.Paragraph></div><Button type="primary" icon={<ReloadOutlined/>} loading={busy} disabled={!allowed} onClick={()=>void check()}>重新检查</Button></div>
  <Alert type="info" showIcon title="本页进行只读检查" description="不会修改数据、安装扩展或初始化数据库；模型仅核对配置是否齐全，不发送联网请求。"/>
  {error&&<Alert type="error" showIcon title={error} action={<Button loading={busy} onClick={()=>void check()}>重试检查</Button>}/>}
  {result&&<Flex gap={12} wrap align="center"><Tag color={result.state==='ready'?'green':'orange'}>{result.state==='ready'?'运行基础已就绪':'部分项目需要处理'}</Tag><Typography.Text type="secondary">检查于 {new Date(result.checkedAt).toLocaleString('zh-CN',{hour12:false})} · 用时 {(result.durationMs/1000).toFixed(2)} 秒</Typography.Text>{busy&&<Tag color="processing">正在更新检查结果</Tag>}</Flex>}
  <Row gutter={[16,16]}>{(result?.checks??[]).map(item=><Col xs={24} md={12} xl={8} key={item.id}><Card style={{height:'100%'}} title={item.title} extra={<Tag color={states[item.state].color}>{states[item.state].text}</Tag>}><Flex vertical gap={10}><Typography.Paragraph style={{margin:0}}>{item.description}</Typography.Paragraph>{item.durationMs!==undefined&&<Typography.Text type="secondary">本项耗时 {item.durationMs.toFixed(0)} 毫秒</Typography.Text>}{!!item.details?.length&&<Flex gap={4} wrap>{item.details.map(detail=><Tag style={{whiteSpace:'normal',overflowWrap:'anywhere'}} key={detail}>{detail}</Tag>)}</Flex>}{item.recovery&&<Typography.Paragraph type="secondary" style={{margin:0}}>{item.recovery}</Typography.Paragraph>}{item.href&&<Button href={item.href}>查看恢复入口</Button>}</Flex></Card></Col>)}</Row>
  {!result&&<Card loading={busy}>{!busy&&<Empty description="点击重新检查，查看当前环境实际状态"/>}</Card>}
 </Flex>;
}
