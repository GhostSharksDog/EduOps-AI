import React, {useMemo} from 'react';
import {Form, Input, Select, Tabs} from 'antd';
import BaseDrawer from '@/shared/ui/BaseDrawer/index';
import {RuleType} from '@/shared/enums/index';
import {type CreateTagVersionDTO} from '@/modules/tag/contracts/schemas/request/tag/index';
import {useDataModels} from '@/modules/data/client';
import {DataModelStatus} from '@/shared/enums/data-models/DataModelStatus';
import {MESSAGES} from '@/shared/messages/index';

interface CreateTagVersionDrawerProps {
    visible: boolean;
    loading: boolean;
    tagId: string;
    tagName: string;
    onOk: (values: CreateTagVersionDTO) => Promise<void>;
    onCancel: () => void;
}

const CreateTagVersionDrawer: React.FC<CreateTagVersionDrawerProps> = ({
                                                                           visible,
                                                                           loading,
                                                                           tagId,
                                                                           tagName,
                                                                           onOk,
                                                                           onCancel,
                                                                       }) => {
    const [form] = Form.useForm();

    const {data: dataModelsData, isLoading: dataModelsLoading} = useDataModels({
        page: 1,
        pageSize: 100,
        status: DataModelStatus.ACTIVE
    });

    const dataModelOptions = useMemo(() => {
        if (!dataModelsData?.items) return [];
        return dataModelsData.items.map((model) => ({
            value: model.id,
            label: model.name,
        }));
    }, [dataModelsData]);

    const handleOk = () => {
        return form.validateFields().then((values) => {
            return onOk(values);
        });
    };

    const handleCancel = () => {
        form.resetFields();
        onCancel();
    };

    return (
        <BaseDrawer
            title={`创建标签版本 - ${tagName}`}
            onClose={handleCancel}
            open={visible}
            size="lg"
            onOk={handleOk}
            confirmLoading={loading}
            okText={MESSAGES.COMMON.OK}
        >
            <Form
                form={form}
                layout="vertical"
                initialValues={{
                    ruleType: RuleType.SQL,
                }}
            >
                <Form.Item
                    name="version"
                    label="版本号"
                    rules={[{required: true, message: '请输入版本号'}]}
                >
                    <Input placeholder="例如：v1.0.0"/>
                </Form.Item>

                <Form.Item
                    name="name"
                    label="版本名称"
                    rules={[{required: true, message: '请输入版本名称'}]}
                >
                    <Input placeholder="请输入版本名称"/>
                </Form.Item>

                <Form.Item
                    name="description"
                    label="版本描述"
                >
                    <Input.TextArea rows={3} placeholder="请输入版本描述"/>
                </Form.Item>

                <Tabs
                    defaultActiveKey="1"
                    items={[
                        {
                            key: '1',
                            label: '规则配置',
                            children: (
                                <>
                                    <Form.Item
                                        name="ruleType"
                                        label="规则类型"
                                        rules={[{required: true, message: '请选择规则类型'}]}
                                    >
                                        <Select style={{width: '100%'}}>
                                            {Object.values(RuleType).map(type => (
                                                <Select.Option key={type} value={type}>{type}</Select.Option>
                                            ))}
                                        </Select>
                                    </Form.Item>

                                    <Form.Item
                                        name="dataModelId"
                                        label="数据模型"
                                        rules={[{required: true, message: '请选择数据模型'}]}
                                    >
                                        <Select
                                            style={{width: '100%'}}
                                            placeholder="选择数据模型"
                                            loading={dataModelsLoading}
                                            options={dataModelOptions}
                                            showSearch
                                            filterOption={(input, option) =>
                                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                            }
                                        />
                                    </Form.Item>

                                    <Form.Item
                                        name="ruleContent"
                                        label="规则内容"
                                        rules={[{required: true, message: '请输入规则内容'}]}
                                    >
                                        <Input.TextArea rows={10} placeholder="请输入规则内容"/>
                                    </Form.Item>
                                </>
                            )
                        }
                    ]}
                />
            </Form>
        </BaseDrawer>
    );
};

export default CreateTagVersionDrawer;
