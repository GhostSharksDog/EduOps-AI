'use client';
import {useEffect,useState} from 'react';
import {Alert,Card,Table,Typography} from 'antd';
import {useAuthStore} from './state/authStore';
import type {LocalUser} from '../contracts/local';
export default function LocalUsersPage(){
 const token=useAuthStore(s=>s.token);const [users,setUsers]=useState<LocalUser[]>([]);const [error,setError]=useState('');
 useEffect(()=>{fetch('/api/auth/users',{headers:{Authorization:'Bearer '+token}}).then(async r=>{const body=await r.json();if(!r.ok)throw new Error(body.error??'查询失败');setUsers(body.users);}).catch(e=>setError(e.message));},[token]);
 return <><Typography.Title level={2}>账号与权限</Typography.Title><Typography.Paragraph>管理员管理系统配置；运营人员管理业务标签与人群；只读用户查看分析结果。</Typography.Paragraph>{error&&<Alert title={error} type="error" showIcon/>}<Card><Table rowKey="id" dataSource={users} columns={[{title:'用户名',dataIndex:'username'},{title:'姓名',dataIndex:'realName'},{title:'角色',dataIndex:'role'},{title:'机构',dataIndex:'ownedBy'}]}/></Card></>;
}
