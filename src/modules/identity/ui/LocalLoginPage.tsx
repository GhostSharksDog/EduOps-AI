'use client';

import {useRef, useState} from 'react';
import {Alert, Button, ConfigProvider, Form, Input, theme} from 'antd';
import {ArrowRightOutlined, BarChartOutlined, CheckOutlined, DatabaseOutlined, EyeInvisibleOutlined, EyeOutlined, LockOutlined, RobotOutlined, SafetyCertificateOutlined, TagsOutlined, UserOutlined} from '@ant-design/icons';
import {useRouter} from 'next/navigation';
import {useAuthStore} from './state/authStore';
import styles from './LocalLoginPage.module.css';

const workflow = [
    {title: '数据分析', detail: '来源清晰 · 指标可查', icon: <DatabaseOutlined/>, tone: 'blue'},
    {title: 'Agent解释', detail: '检索口径 · 引用证据', icon: <RobotOutlined/>, tone: 'purple'},
    {title: '标签人群', detail: '规则预览 · 人工确认', icon: <TagsOutlined/>, tone: 'teal'},
    {title: '行动建议', detail: '画像洞察 · 智能报告', icon: <BarChartOutlined/>, tone: 'blue'},
] as const;

type LoginValues = {username: string; password: string};

export default function LocalLoginPage() {
    const router = useRouter();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const inFlight = useRef(false);

    async function login(values: LoginValues) {
        if (inFlight.current) return;
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

    return <ConfigProvider theme={{inherit: false, algorithm: theme.defaultAlgorithm, token: {colorPrimary: '#3478f6', colorText: '#172b4d', colorTextSecondary: '#63758c', colorBgBase: '#ffffff', colorBgContainer: '#ffffff', borderRadius: 10, controlHeightLG: 48, fontSize: 15}}}>
        <main className={styles.page}>
            <div className={styles.shell}>
                <header className={styles.brand}>
                    <span className={styles.brandSymbol} aria-hidden="true"><BarChartOutlined/></span>
                    <div><h1>教培运营分析辅助系统</h1><p>基于业务数据与AI智能体</p></div>
                </header>

                <div className={styles.content}>
                    <section className={styles.introduction} aria-labelledby="product-title">
                        <span className={styles.eyebrow}><span aria-hidden="true"/>业务数据与智能分析</span>
                        <h2 id="product-title" className={styles.productTitle}>看清业务变化，<br/><span>让决策有据可依。</span></h2>
                        <p className={styles.productDescription}>连接业务数据、运营指标与智能分析，<br className={styles.desktopBreak}/>从发现问题，到理解原因，再到确认行动。</p>

                        <section className={styles.workflow} aria-labelledby="workflow-title">
                            <div className={styles.workflowHeading}><h3 id="workflow-title">从数据到行动</h3><span>有依据的分析闭环</span></div>
                            <ol className={styles.workflowList}>
                                {workflow.map((step, index) => <li key={step.title} className={styles.workflowStep} data-tone={step.tone}>
                                    <span className={styles.stepIcon} aria-hidden="true">{step.icon}</span>
                                    <strong>{step.title}</strong>
                                    <small>{step.detail}</small>
                                    {index < workflow.length - 1 && <ArrowRightOutlined className={styles.stepArrow} aria-hidden="true"/>}
                                </li>)}
                            </ol>
                            <p className={styles.workflowNote}><SafetyCertificateOutlined aria-hidden="true"/>Agent生成方案，关键操作由你确认</p>
                        </section>

                        <ul className={styles.principles} aria-label="分析原则">
                            {['数据有来源', '结论有依据', '操作需确认'].map(item => <li key={item}><CheckOutlined aria-hidden="true"/>{item}</li>)}
                        </ul>
                    </section>

                    <section className={styles.loginCard} aria-labelledby="login-title">
                        <span className={styles.loginSymbol} aria-hidden="true"><UserOutlined/></span>
                        <p className={styles.loginEyebrow}>你的运营工作台</p>
                        <h2 id="login-title">欢迎回来</h2>
                        <p className={styles.loginDescription}>使用机构账号登录，查看运营数据与分析建议。</p>

                        {error && <div className={styles.error} role="alert" aria-live="assertive"><Alert type="error" title="登录未成功" description={error} showIcon/></div>}
                        <Form name="local-login" layout="vertical" onFinish={login} requiredMark={false} className={styles.form} aria-busy={loading}>
                            <Form.Item name="username" label="用户名" rules={[{required: true, whitespace: true, message: '请输入用户名'}]}>
                                <Input size="large" prefix={<UserOutlined aria-hidden="true"/>} autoComplete="username" placeholder="请输入本地账号" disabled={loading} autoCapitalize="none" spellCheck={false}/>
                            </Form.Item>
                            <Form.Item name="password" label="密码" rules={[{required: true, message: '请输入密码'}]}>
                                <Input.Password size="large" prefix={<LockOutlined aria-hidden="true"/>} className={styles.passwordInput} autoComplete="current-password" placeholder="请输入密码" disabled={loading} iconRender={visible => <button type="button" aria-label={visible ? '隐藏密码' : '显示密码'} aria-pressed={visible} disabled={loading}>{visible ? <EyeOutlined aria-hidden="true"/> : <EyeInvisibleOutlined aria-hidden="true"/>}</button>}/>
                            </Form.Item>
                            <Button size="large" type="primary" htmlType="submit" loading={loading} block className={styles.loginButton} aria-busy={loading}>登录</Button>
                        </Form>

                        <div className={styles.accountNote}><SafetyCertificateOutlined aria-hidden="true"/><p>使用本项目的本地账号。<br/>如需开通账号，请联系系统管理员。</p></div>
                    </section>
                </div>

                <footer className={styles.footer}><span>基于业务数据与AI智能体的教培机构运营分析辅助系统</span><span>公开教育数据与模拟经营数据分别统计</span></footer>
            </div>
        </main>
    </ConfigProvider>;
}
