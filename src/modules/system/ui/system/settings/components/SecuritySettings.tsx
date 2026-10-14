'use client';

import React, {useEffect} from 'react';
import {Alert, Card, Form, InputNumber, theme} from 'antd';

interface SecuritySettingsValues {
    sessionTimeout: number;
}

interface SecuritySettingsProps {
    value: SecuritySettingsValues;
    onChange: (values: SecuritySettingsValues) => void;
}

const SecuritySettings: React.FC<SecuritySettingsProps> = ({value, onChange}) => {
    const [form] = Form.useForm();
    const {token} = theme.useToken();

    useEffect(() => {
        form.setFieldsValue(value);
    }, [form, value]);

    const handleValuesChange = (_: unknown, allValues: SecuritySettingsValues) => {
        onChange(allValues);
    };

    return (
        <Card title="安全策略">
            <Alert
                title="安全提示"
                description="修改安全设置可能会影响系统访问，请谨慎操作"
                type="warning"
                showIcon
                style={{marginBottom: token.marginLG}}
            />
            <Form
                form={form}
                layout="vertical"
                initialValues={value}
                onValuesChange={handleValuesChange}
            >
                <Form.Item
                    name="sessionTimeout"
                    label="会话超时时间（分钟）"
                    tooltip="用户无操作后自动登出的时间"
                >
                    <InputNumber min={5} max={1440} style={{width: '100%'}}/>
                </Form.Item>
            </Form>
        </Card>
    );
};

export type {SecuritySettingsValues};
export default SecuritySettings;
