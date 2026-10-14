'use client';

import React, {useState} from 'react';
import {Button, Form, Input, Select, Space, Steps} from 'antd';
import {ArrowLeftOutlined, ArrowRightOutlined, DatabaseOutlined} from '@ant-design/icons';
import BaseDrawer from '@/shared/ui/BaseDrawer/index';
import {DataSourceStatus, DataSourceTypeOptions} from '@/shared/enums/index';
import {CreateDataSourceDTO, hostRegex} from '@/modules/data/contracts/schemas/request/datasource/index';
import {log} from '@/platform/logger';

interface CreateDataSourceModalProps {
    visible: boolean;
    loading: boolean;
    onOk: (values: CreateDataSourceDTO) => Promise<void>;
    onCancel: () => void;
}

const CreateDataSourceDrawer: React.FC<CreateDataSourceModalProps> = ({
                                                                          visible,
                                                                          loading,
                                                                          onOk,
                                                                          onCancel
                                                                      }) => {
    const [form] = Form.useForm();
    const [currentStep, setCurrentStep] = useState(0);

    const steps = [
        {title: '基本信息', content: '填写数据源基本信息'},
        {title: '连接配置', content: '配置数据库连接信息'},
        {title: '认证信息', content: '设置认证账号密码'},
        {title: '高级设置', content: '配置高级选项'}
    ];

    const handleCancel = () => {
        form.resetFields();
        setCurrentStep(0);
        onCancel();
    };

    const handlePrev = () => {
        setCurrentStep(prev => prev - 1);
    };

    const getCurrentStepFields = (step: number) => {
        switch (step) {
            case 0:
                return ['name', 'type', 'description'];
            case 1:
                return ['host', 'port', 'databaseName'];
            case 2:
                return ['username', 'password'];
            case 3:
                return ['status', 'feature'];
            default:
                return [];
        }
    };

    const handleNext = () => {
        // 验证当前步骤的字段
        const currentStepFields = getCurrentStepFields(currentStep);
        form.validateFields(currentStepFields).then(() => {
            setCurrentStep(prev => prev + 1);
        });
    };

    const handleFinish = () => {
        return form.validateFields().then(values => {
            log.info('Form values:', values);
            // 添加 ownedBy 字段
            const finalValues = {
                ...values
            };
            return onOk(finalValues).then(() => {
                form.resetFields();
                setCurrentStep(0);
            });
        });
    };

    const validateHost = (_: unknown, value: string) => {
        if (!value) {
            return Promise.resolve();
        }
        if (!hostRegex.test(value)) {
            return Promise.reject(new Error('主机地址必须是有效的IP地址或域名'));
        }
        return Promise.resolve();
    };

    const validatePort = (_: unknown, value: string) => {
        if (!value) {
            return Promise.resolve();
        }
        const port = Number(value);
        if (isNaN(port) || port < 1 || port > 65535) {
            return Promise.reject(new Error('端口号必须在1-65535范围内'));
        }
        return Promise.resolve();
    };

    const validateFeature = (_: unknown, value: string) => {
        if (!value) {
            return Promise.resolve();
        }
        try {
            JSON.parse(value);
            return Promise.resolve();
        } catch {
            return Promise.reject(new Error('扩展属性必须是有效的JSON格式'));
        }
    };

    return (
        <BaseDrawer
            title={<Space><DatabaseOutlined/> 新建数据源</Space>}
            onClose={handleCancel}
            open={visible}
            size="lg"
            footerMode="none"
        >
            <Space orientation="vertical" style={{width: '100%'}} size="large">
                <Steps
                    current={currentStep}
                    orientation="vertical"
                    size="small"
                    items={steps}
                />

                <Form
                    form={form}
                    layout="vertical"
                    initialValues={{
                        status: DataSourceStatus.DISABLED
                    }}
                >
                    {/* 基本信息 */}
                    <div style={{display: currentStep === 0 ? 'block' : 'none'}}>
                        <Form.Item
                            name="name"
                            label="数据源名称"
                            rules={[
                                {required: true, message: '请输入数据源名称'},
                                {min: 1, max: 255, message: '名称长度必须在1-255个字符之间'}
                            ]}
                        >
                            <Input placeholder="请输入数据源名称"/>
                        </Form.Item>

                        <Form.Item
                            name="type"
                            label="数据源类型"
                            rules={[{required: true, message: '请选择数据源类型'}]}
                        >
                            <Select placeholder="请选择数据源类型">
                                {DataSourceTypeOptions.map((item) => (
                                    <Select.Option key={item.value} value={item.value}>
                                        {item.label}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item
                            name="description"
                            label="数据源描述"
                            rules={[{max: 500, message: '描述不能超过500个字符'}]}
                        >
                            <Input.TextArea rows={3} placeholder="请输入数据源描述"/>
                        </Form.Item>
                    </div>

                    {/* 连接配置 */}
                    <div style={{display: currentStep === 1 ? 'block' : 'none'}}>
                        <Form.Item
                            name="host"
                            label="主机地址"
                            rules={[
                                {required: true, message: '请输入主机地址'},
                                {validator: validateHost}
                            ]}
                        >
                            <Input placeholder="请输入主机地址（IP地址或域名）"/>
                        </Form.Item>

                        <Form.Item
                            name="port"
                            label="端口"
                            rules={[
                                {required: true, message: '请输入端口'},
                                {validator: validatePort}
                            ]}
                        >
                            <Input type="number" placeholder="请输入端口（1-65535）"/>
                        </Form.Item>

                        <Form.Item
                            name="databaseName"
                            label="数据库名称"
                            rules={[
                                {required: true, message: '请输入数据库名称'},
                                {min: 1, max: 255, message: '数据库名称长度必须在1-255个字符之间'}
                            ]}
                        >
                            <Input placeholder="请输入数据库名称"/>
                        </Form.Item>
                    </div>

                    {/* 认证信息 */}
                    <div style={{display: currentStep === 2 ? 'block' : 'none'}}>
                        <Form.Item
                            name="username"
                            label="用户名"
                            rules={[
                                {required: true, message: '请输入用户名'},
                                {min: 1, max: 255, message: '用户名长度必须在1-255个字符之间'}
                            ]}
                        >
                            <Input placeholder="请输入用户名"/>
                        </Form.Item>

                        <Form.Item
                            name="password"
                            label="密码"
                            rules={[
                                {required: true, message: '请输入密码'},
                                {min: 1, max: 255, message: '密码长度必须在1-255个字符之间'}
                            ]}
                        >
                            <Input.Password placeholder="请输入密码"/>
                        </Form.Item>
                    </div>

                    {/* 高级设置 */}
                    <div style={{display: currentStep === 3 ? 'block' : 'none'}}>
                        <Form.Item
                            name="status"
                            label="状态"
                            rules={[{required: true, message: '请选择状态'}]}
                        >
                            <Select placeholder="请选择状态">
                                <Select.Option value={DataSourceStatus.ACTIVE}>已启用</Select.Option>
                                <Select.Option value={DataSourceStatus.DISABLED}>已禁用</Select.Option>
                            </Select>
                        </Form.Item>

                        <Form.Item
                            name="ownedBy"
                            label="所有者"
                            style={{display: 'none'}}
                        >
                            <Input type="hidden"/>
                        </Form.Item>

                        <Form.Item
                            name="feature"
                            label="扩展属性"
                            rules={[
                                {validator: validateFeature}
                            ]}
                        >
                            <Input.TextArea rows={4}
                                            placeholder="请输入JSON格式的扩展属性，例如：{&quot;readonly&quot;: &quot;0&quot;}"/>
                        </Form.Item>
                    </div>
                </Form>

                <Space orientation="horizontal" style={{display: 'flex', justifyContent: 'flex-end', marginTop: 'auto'}}
                       size="middle">
                    {currentStep > 0 && (
                        <Button icon={<ArrowLeftOutlined/>} onClick={handlePrev}>
                            上一步
                        </Button>
                    )}

                    {currentStep < steps.length - 1 && (
                        <Button type="primary" icon={<ArrowRightOutlined/>} onClick={handleNext}>
                            下一步
                        </Button>
                    )}

                    {currentStep === steps.length - 1 && (
                        <Button type="primary" loading={loading} onClick={handleFinish}>
                            完成
                        </Button>
                    )}

                    <Button onClick={handleCancel}>
                        取消
                    </Button>
                </Space>
            </Space>
        </BaseDrawer>
    );
};

export default CreateDataSourceDrawer;
