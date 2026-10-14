'use client';

import React from 'react';
import {Form, InputNumber, Select, Button, Space, Input} from 'antd';
import BaseDrawer from '@/shared/ui/BaseDrawer/index';
import {useBitmapManagementStore} from '@/modules/tag/ui/state/bitmapManagementStore';
import {useCreateBitmapTable} from '@/modules/tag/ui/tags/bitmap/hooks/useBitmapManagement';
import {useEntityTypeEnum} from '@/modules/tag/ui/tags/target-tables/hooks/useEntityTypeEnum';

const CreateBitmapDrawer: React.FC = () => {
    const {
        createDrawerVisible,
        closeCreateDrawer,
    } = useBitmapManagementStore();

    const createTableMutation = useCreateBitmapTable();
    const {entityTypeOptions, isLoading: isLoadingEntityTypes} = useEntityTypeEnum();

    const [form] = Form.useForm();

    const handleSubmit = async (values: {entityTypeId: string; totalBits: number; name?: string; description?: string}) => {
        const selectedOption = entityTypeOptions.find(opt => opt.id === values.entityTypeId);
        if (selectedOption) {
            await createTableMutation.mutateAsync({
                entityType: selectedOption.value,
                entityTypeId: selectedOption.id,
                totalBits: values.totalBits,
                name: values.name,
                description: values.description,
            });
            form.resetFields();
            closeCreateDrawer();
        }
    };

    const handleClose = () => {
        form.resetFields();
        closeCreateDrawer();
    };

    return (
        <BaseDrawer
            title="创建 Bitmap 表"
            open={createDrawerVisible}
            onClose={handleClose}
            size="sm"
            footerMode="none"
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                initialValues={{totalBits: 64}}
            >
                <Form.Item
                    name="entityTypeId"
                    label="实体类型"
                    rules={[{required: true, message: '请选择实体类型'}]}
                >
                    <Select
                        placeholder="选择实体类型"
                        loading={isLoadingEntityTypes}
                        options={entityTypeOptions.map(type => ({
                            label: type.name,
                            value: type.id,
                        }))}
                    />
                </Form.Item>

                <Form.Item
                    name="name"
                    label="显示名称"
                >
                    <Input placeholder="如：VIP用户位图表" maxLength={255} />
                </Form.Item>

                <Form.Item
                    name="description"
                    label="描述"
                >
                    <Input.TextArea rows={3} placeholder="描述此位图表的用途和业务背景" />
                </Form.Item>

                <Form.Item
                    name="totalBits"
                    label="总位数"
                    rules={[{required: true, message: '请输入总位数'}]}
                >
                    <InputNumber min={8} max={256} style={{width: '100%'}} />
                </Form.Item>

                <Form.Item style={{marginTop: 24}}>
                    <Space>
                        <Button onClick={handleClose}>取消</Button>
                        <Button type="primary" htmlType="submit" loading={createTableMutation.isPending}>
                            创建
                        </Button>
                    </Space>
                </Form.Item>
            </Form>
        </BaseDrawer>
    );
};

export default CreateBitmapDrawer;
