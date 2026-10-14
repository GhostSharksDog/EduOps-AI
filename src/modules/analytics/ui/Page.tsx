'use client';
import {Typography,Flex,Button} from 'antd';
import Link from 'next/link';
import OperationsPanel from './OperationsPanel';
export default function Page(){return <Flex vertical gap={16}><Flex justify="space-between" wrap gap={12}><Typography.Title level={2}>运营分析</Typography.Title><Link href="/dashboard/channels"><Button>查看渠道分析</Button></Link></Flex><Typography.Text type="secondary">查看招生、续费、出勤、满班、课耗、留存、客诉与退款，按周期、校区、课程与来源渠道核查依据。</Typography.Text><OperationsPanel/></Flex>;}
