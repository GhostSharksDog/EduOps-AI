'use client';
import {Alert,Button,Flex} from 'antd';
export default function EvaluationPanel(){return <Alert type="info" title="研究评价已独立整理" description={<Flex vertical gap={8}><span>并排阅读三种方案、查看冻结依据并完成人工评分。</span><Button href="/dashboard/evaluation">打开研究评价</Button></Flex>}/>;}
