'use client';

import React, {useEffect} from 'react';
import {Col, Divider, Flex, Form, Input, Row, Select, theme} from 'antd';
import {DatabaseOutlined} from '@ant-design/icons';
import BaseDrawer from '@/shared/ui/BaseDrawer/index';
import {DataSourceStatus, DataSourceTypeOptions} from '@/shared/enums/index';
import {DataSourceVO} from '@/modules/data/contracts/schemas/response/datasource/index';
import {UpdateDataSourceDTO, hostRegex} from '@/modules/data/contracts/schemas/request/datasource/index';
import {MESSAGES} from '@/shared/messages/index';

interface EditDataSourceDrawerProps {
    open: boolean;
    loading: boolean;
    editingDataSource: DataSourceVO | null;
    onSubmit: (values: UpdateDataSourceDTO) => void;
    onClose: () => void;
}

const EditDataSourceDrawer: React.FC<EditDataSourceDrawerProps> = ({
                                                                       open,
                                                                       loading,
                                                                       editingDataSource,
                                                                       onSubmit,
                                                                       onClose
                                                                   }) => {
    const {token} = theme.useToken();
    const [form] = Form.useForm();

    useEffect(() => {
        if (editingDataSource) {
            form.setFieldsValue({
                id: editingDataSource.id,
                name: editingDataSource.name,
                type: editingDataSource.type,
                description: editingDataSource.description,
                host: editingDataSource.host,
                port: editingDataSource.port,
                databaseName: editingDataSource.databaseName,
                username: editingDataSource.username,
                password: '',
                status: editingDataSource.status,
                feature: editingDataSource.feature ? JSON.stringify(editingDataSource.feature, null, 2) : ''
            });
        }
    }, [editingDataSource, form]);

    const handleSubmit = () => {
        form.validateFields().then(values => {
            onSubmit(values);
        });
    };

    const handleCancel = () => {
        form.resetFields();
        onClose();
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
            title={<Flex align="center" gap={8}><DatabaseOutlined/> 编辑数据源</Flex>}
            onClose={handleCancel}
            open={open}
            size="lg"
            onOk={handleSubmit}
            confirmLoading={loading}
            okText={MESSAGES.COMMON.SAVE}
        >
            <Form
                form={form}
                layout="vertical"
                size="small"
            >
                <Form.Item name="id" hidden>
                    <Input/>
                </Form.Item>

                <Row gutter={16}>
                    <Col span={16}>
                        <Form.Item
                            name="name"
                            label="数据源名称"
                            rules={[
                                {required: true, message: '请输入数据源名称'},
                                {min: 1, max: 255, message: '名称长度必须在1-255个字符之间'}
                            ]}
                            style={{marginBottom: token.marginSM}}
                        >
                            <Input placeholder="请输入数据源名称"/>
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item
                            name="type"
                            label="数据源类型"
                            rules={[{required: true, message: '请选择数据源类型'}]}
                            style={{marginBottom: token.marginSM}}
                        >
                            <Select placeholder="请选择" disabled>
                                {DataSourceTypeOptions.map((item) => (
                                    <Select.Option key={item.value} value={item.value}>
                                        {item.label}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item
                    name="description"
                    label="描述"
                    rules={[{max: 500, message: '描述不能超过500个字符'}]}
                    style={{marginBottom: token.marginSM}}
                >
                    <Input.TextArea rows={2} placeholder="请输入数据源描述"/>
                </Form.Item>

                <Divider style={{margin: `${token.marginSM}px 0`}}/>

                <Row gutter={12}>
                    <Col span={14}>
                        <Form.Item
                            name="host"
                            label="主机地址"
                            rules={[
                                {required: true, message: '请输入主机地址'},
                                {validator: validateHost}
                            ]}
                            style={{marginBottom: token.marginXS}}
                        >
                            <Input placeholder="IP地址或域名"/>
                        </Form.Item>
                    </Col>
                    <Col span={10}>
                        <Form.Item
                            name="port"
                            label="端口"
                            rules={[
                                {required: true, message: '请输入端口'},
                                {validator: validatePort}
                            ]}
                            style={{marginBottom: token.marginXS}}
                        >
                            <Input type="number" placeholder="1-65535"/>
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item
                    name="databaseName"
                    label="数据库名称"
                    rules={[
                        {required: true, message: '请输入数据库名称'},
                        {min: 1, max: 255, message: '数据库名称长度必须在1-255个字符之间'}
                    ]}
                    style={{marginBottom: token.marginSM}}
                >
                    <Input placeholder="请输入数据库名称"/>
                </Form.Item>

                <Divider style={{margin: `${token.marginSM}px 0`}}/>

                <Row gutter={12}>
                    <Col span={12}>
                        <Form.Item
                            name="username"
                            label="用户名"
                            rules={[
                                {required: true, message: '请输入用户名'},
                                {min: 1, max: 255, message: '用户名长度必须在1-255个字符之间'}
                            ]}
                            style={{marginBottom: token.marginXS}}
                        >
                            <Input placeholder="请输入用户名"/>
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name="password"
                            label="密码"
                            rules={[
                                {min: 0, max: 255, message: '密码长度不能超过255个字符'}
                            ]}
                            style={{marginBottom: token.marginXS}}
                        >
                            <Input.Password placeholder="留空则不修改"/>
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item
                    name="status"
                    label="状态"
                    rules={[{required: true, message: '请选择状态'}]}
                    style={{marginBottom: token.marginSM}}
                >
                    <Select placeholder="请选择状态">
                        <Select.Option value={DataSourceStatus.ACTIVE}>已启用</Select.Option>
                        <Select.Option value={DataSourceStatus.DISABLED}>已禁用</Select.Option>
                    </Select>
                </Form.Item>

                <Divider style={{margin: `${token.marginSM}px 0`}}/>

                <Form.Item
                    name="feature"
                    label="扩展属性 (JSON)"
                    rules={[
                        {validator: validateFeature}
                    ]}
                >
                    <Input.TextArea rows={3}
                                    placeholder='例如：{"readonly": "0"}'
                                    style={{fontFamily: 'monospace'}}
                    />
                </Form.Item>
            </Form>
        </BaseDrawer>
    );
};

export default EditDataSourceDrawer;
