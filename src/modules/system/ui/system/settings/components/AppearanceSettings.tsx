'use client';

import React, {useEffect} from 'react';
import {Card, Form, Select} from 'antd';

export interface AppearanceSettingsValues {
    language: string;
    theme: string;
    pageSize: number;
}

interface AppearanceSettingsProps {
    value: AppearanceSettingsValues;
    onChange: (values: AppearanceSettingsValues) => void;
}

const AppearanceSettings: React.FC<AppearanceSettingsProps> = ({value, onChange}) => {
    const [form] = Form.useForm();

    useEffect(() => {
        form.setFieldsValue(value);
    }, [form, value]);

    const handleValuesChange = (_: unknown, allValues: AppearanceSettingsValues) => {
        onChange(allValues);
    };

    return (
        <Card title="界面设置">
            <Form
                form={form}
                layout="vertical"
                initialValues={value}
                onValuesChange={handleValuesChange}
            >
                <Form.Item name="language" label="系统语言">
                    <Select>
                        <Select.Option value="zh-CN">简体中文</Select.Option>
                        <Select.Option value="en-US">English</Select.Option>
                    </Select>
                </Form.Item>

                <Form.Item name="theme" label="主题风格">
                    <Select>
                        <Select.Option value="light">浅色</Select.Option>
                        <Select.Option value="dark">深色</Select.Option>
                        <Select.Option value="auto">自动</Select.Option>
                    </Select>
                </Form.Item>

                <Form.Item name="pageSize" label="默认分页大小">
                    <Select>
                        <Select.Option value={10}>10</Select.Option>
                        <Select.Option value={20}>20</Select.Option>
                        <Select.Option value={50}>50</Select.Option>
                        <Select.Option value={100}>100</Select.Option>
                    </Select>
                </Form.Item>
            </Form>
        </Card>
    );
};

export default AppearanceSettings;
