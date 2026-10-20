'use client';

import {useCallback,useEffect,useRef, useState} from 'react';
import {Alert, Button, Form, Input,Select} from 'antd';
import {ArrowRightOutlined,BarChartOutlined, EyeInvisibleOutlined, EyeOutlined, LockOutlined, SafetyCertificateOutlined, UserOutlined} from '@ant-design/icons';
import {useRouter} from 'next/navigation';
import VisualArtwork from '@/shared/ui/VisualArtwork';
import {useAuthStore} from './state/authStore';
import styles from './LocalLoginPage.module.css';

type LoginValues = {companyCode:string;username: string; password: string};

export default function LocalLoginPage() {
    const router = useRouter();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [form]=Form.useForm<LoginValues>();
    const [companies,setCompanies]=useState<{code:string;name:string}[]>([]),[companiesLoading,setCompaniesLoading]=useState(true),[companiesError,setCompaniesError]=useState('');
    const inFlight = useRef(false);
    const loadCompanies=useCallback(async(signal?:AbortSignal)=>{
        setCompaniesLoading(true);setCompaniesError('');
        try{
            const response=await fetch('/api/auth/companies',{signal}),body=await response.json();
            if(!response.ok||!Array.isArray(body.companies)||!body.companies.length)throw new Error(body.error??'尚未配置可登录的公司，请联系管理员。');
            if(signal?.aborted)return;setCompanies(body.companies);
            const preferred=localStorage.getItem('education-login-company'),selected=body.companies.find((company:{code:string})=>company.code===preferred)?.code??body.defaultCompanyCode;
            if(selected&&body.companies.some((company:{code:string})=>company.code===selected))form.setFieldValue('companyCode',selected);
        }catch(cause){if(!signal?.aborted)setCompaniesError(cause instanceof Error?cause.message:'公司列表加载失败');}
        finally{if(!signal?.aborted)setCompaniesLoading(false);}
    },[form]);
    useEffect(()=>{const controller=new AbortController();void loadCompanies(controller.signal);return()=>controller.abort();},[loadCompanies]);

    async function login(values: LoginValues) {
        if (inFlight.current||companiesLoading||companiesError) return;
        inFlight.current = true;
        setLoading(true);
        setError('');
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(values),
            });
            const result = await response.json().catch(() => {
                throw new Error('登录服务暂时不可用，请稍后重试。');
            });
            if (!response.ok) throw new Error(result.error ?? '登录失败，请检查用户名和密码。');
            if (!result.user || typeof result.token !== 'string') throw new Error('登录响应不完整，请稍后重试。');
            await useAuthStore.getState().logout();
            localStorage.setItem('education-login-company',values.companyCode);
            useAuthStore.getState().setUser(result.user);
            useAuthStore.getState().setToken(result.token);
            router.replace('/dashboard');
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : '登录失败，请稍后重试。');
        } finally {
            inFlight.current = false;
            setLoading(false);
        }
    }

    return <main className={styles.page} data-spatial-enter="true">
            <div className={styles.shell}>
                <div className={styles.content}>
                    <section className={styles.introduction} aria-labelledby="product-title">
                        <VisualArtwork name="login" className={styles.heroArtwork} priority sizes="(max-width: 840px) 100vw, 60vw"/>
                        <div className={styles.heroShade} aria-hidden="true"/>
                        <header className={styles.brand}><span className={styles.brandSymbol} aria-hidden="true"><BarChartOutlined/></span><div><h1>教培运营分析辅助系统</h1><p>基于业务数据与AI智能体</p></div></header>
                        <div className={styles.heroCopy} data-spatial-reveal="true"><span className={styles.eyebrow}>业务洞察，从这里开始</span><h2 id="product-title" className={styles.productTitle}>让数据，<br/><span>连接下一步。</span></h2><p className={styles.productDescription}>发现变化，理解原因，确认行动。</p></div>
                        <div className={styles.heroFoot}><span>数据 <ArrowRightOutlined aria-hidden/> 分析 <ArrowRightOutlined aria-hidden/> 行动</span><span><SafetyCertificateOutlined aria-hidden/> 关键操作由你确认</span></div>
                    </section>

                    <section className={styles.loginCard} aria-labelledby="login-title">
                        <p className={styles.loginEyebrow}><span/>开始你的分析</p>
                        <h2 id="login-title">欢迎回来</h2>
                        <p className={styles.loginDescription}>选择所属公司，使用本地账号登录。</p>

                        {error && <div className={styles.error} role="alert" aria-live="assertive"><Alert type="error" title="登录未成功" description={error} showIcon/></div>}
                        {companiesError&&<Alert type="warning" title="公司列表未就绪" description={companiesError} action={<Button loading={companiesLoading} onClick={()=>void loadCompanies()}>重试</Button>}/>}
                        <Form form={form} name="local-login" layout="vertical" onFinish={login} requiredMark={false} className={styles.form} aria-busy={loading}>
                            <Form.Item name="companyCode" label="公司" rules={[{required:true,message:'请选择所属公司'}]}>
                                <Select aria-label="登录公司" size="large" placeholder="选择所属公司" loading={companiesLoading} disabled={loading||companiesLoading} options={companies.map(company=>({value:company.code,label:company.name}))} onChange={()=>setError('')}/>
                            </Form.Item>
                            <Form.Item name="username" label="用户名" rules={[{required: true, whitespace: true, message: '请输入用户名'}]}>
                                <Input size="large" prefix={<UserOutlined aria-hidden="true"/>} autoComplete="username" placeholder="请输入本地账号" disabled={loading} autoCapitalize="none" spellCheck={false}/>
                            </Form.Item>
                            <Form.Item name="password" label="密码" rules={[{required: true, message: '请输入密码'}]}>
                                <Input.Password size="large" prefix={<LockOutlined aria-hidden="true"/>} className={styles.passwordInput} autoComplete="current-password" placeholder="请输入密码" disabled={loading} iconRender={visible => <button type="button" aria-label={visible ? '隐藏密码' : '显示密码'} aria-pressed={visible} disabled={loading}>{visible ? <EyeOutlined aria-hidden="true"/> : <EyeInvisibleOutlined aria-hidden="true"/>}</button>}/>
                            </Form.Item>
                            <Button size="large" type="primary" htmlType="submit" loading={loading} disabled={companiesLoading||!!companiesError||!companies.length} block className={styles.loginButton} aria-busy={loading}>登录</Button>
                        </Form>

                        <div className={styles.accountNote}><SafetyCertificateOutlined aria-hidden="true"/><p>账号仅能访问所属公司的数据。<br/>如需开通账号，请联系系统管理员。</p></div>
                        <footer className={styles.footer}>公开教育数据与模拟经营数据分别统计</footer>
                    </section>
                </div>
            </div>
        </main>;
}
