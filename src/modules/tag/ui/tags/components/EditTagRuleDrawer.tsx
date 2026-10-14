import React, {useEffect, useMemo} from 'react';
import {Alert, Button, Form, Input, Select, theme} from 'antd';
import BaseDrawer from '@/shared/ui/BaseDrawer/index';
import {RuleType} from '@/shared/enums/index';
import type {TagVO} from '@/modules/tag/contracts/schemas/response/tag/index';
import {useDataModels} from '@/modules/data/client';
import {DataModelStatus} from '@/shared/enums/data-models/DataModelStatus';
import {log} from '@/platform/logger';
import {MESSAGES} from '@/shared/messages/index';

interface EditTagRuleDrawerProps {
    visible: boolean;
    loading: boolean;
    editingTag: TagVO | null;
    onOk: (values: Record<string, unknown>) => Promise<void>;
    onCancel: () => void;
}

const EditTagRuleDrawer: React.FC<EditTagRuleDrawerProps> = ({
    visible,
    loading,
    editingTag,
    onOk,
    onCancel,
}) => {
    const [form] = Form.useForm();
    const {token} = theme.useToken();

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

    useEffect(() => {
        if (editingTag && visible) {
            if (editingTag.currentVersion) {
                try {
                    const ruleObj = typeof editingTag.currentVersion.calculationRule === 'string'
                        ? JSON.parse(editingTag.currentVersion.calculationRule)
                        : editingTag.currentVersion.calculationRule;
                    form.setFieldsValue({
                        ruleType: ruleObj?.ruleType || 'SQL',
                        ruleContent: ruleObj?.ruleContent || '',
                        dataModelIds: ruleObj?.dataModelIds || [],
                    });
                } catch (e) {
                    log.error('Failed to parse calculation rule', e);
                }
            }
        }
    }, [editingTag, visible, form]);

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
            title={`编辑标签规则 - ${editingTag?.name || ''}`}
            open={visible}
            onClose={handleCancel}
            size="lg"
            onOk={handleOk}
            confirmLoading={loading}
            okText={MESSAGES.COMMON.OK}
        >
            <div style={{marginBottom: token.margin, color: token.colorTextSecondary}}>
                修改规则将创建新版本，版本号自动递增。
            </div>
            <Form
                form={form}
                layout="vertical"
            >
                <Form.Item
                    name="ruleType"
                    label="规则类型"
                    rules={[{required: true, message: '请选择规则类型'}]}
                    style={{marginBottom: token.marginSM}}
                >
                    <Select style={{width: '100%', height: token.controlHeight}}>
                        {(Object.values(RuleType) as string[]).map(type => (
                            <Select.Option key={type} value={type}>{type}</Select.Option>
                        ))}
                    </Select>
                </Form.Item>

                <Form.Item
                    name="dataModelIds"
                    label="数据模型"
                    style={{marginBottom: token.marginSM}}
                >
                    <Select
                        mode="multiple"
                        style={{width: '100%', height: token.controlHeight}}
                        placeholder="选择数据模型（可多选）"
                        options={dataModelOptions}
                        loading={dataModelsLoading}
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
                    style={{marginBottom: token.marginSM}}
                >
                    <Input.TextArea rows={10} placeholder="请输入规则内容"/>
                </Form.Item>

                <Alert
                    type="warning"
                    showIcon
                    style={{marginBottom: token.margin}}
                    title="更改规则的影响"
                    description={
                        <ul style={{margin: '4px 0 0 0', paddingLeft: 20}}>
                            <li>保存后自动创建新版本，版本号递增</li>
                            <li>系统会用新规则创建新的物化视图，旧的物化视图会被删除</li>
                            <li>目标表名不变时，仅替换物化视图，目标表中的历史数据保留，新数据由新物化视图写入</li>
                            <li>目标表名改变时，旧目标表会被删除并重建，历史数据丢失</li>
                            <li>物化视图为触发式（trigger-based），仅处理新写入的源数据，不会回填历史数据</li>
                            <li>如需刷新历史数据，可清空目标表后重新插入源数据</li>
                        </ul>
                    }
                />
            </Form>
        </BaseDrawer>
    );
};

export default EditTagRuleDrawer;
