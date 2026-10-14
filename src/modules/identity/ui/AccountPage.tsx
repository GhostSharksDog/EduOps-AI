'use client';
import {Card,Descriptions,Typography} from 'antd';
import {useAuthStore} from './state/authStore';
export default function AccountPage(){const user=useAuthStore(s=>s.user);return <><Typography.Title level={2}>个人账号</Typography.Title><Card><Descriptions column={1} items={[{key:'username',label:'用户名',children:user?.username},{key:'realName',label:'姓名',children:user?.realName},{key:'role',label:'角色',children:user?.role},{key:'org',label:'机构',children:user?.ownedBy}]}/></Card></>;}
