import React, {useEffect} from 'react';
import {Form, Input, InputNumber, Select, TreeSelect} from 'antd';
import BaseDrawer from '@/shared/ui/BaseDrawer/index';
import type {TagCategoryVO} from '@/modules/tag/contracts/schemas/response/tag-category/index';
import {useEntityTypeEnum} from '@/modules/tag/ui/tags/target-tables/hooks/useEntityTypeEnum';

interface CategoryDrawerProps {
    visible: boolean;
    loading: boolean;
    editingId: string | null;
    editingRecord?: TagCategoryVO;
    parentCategory: string | undefined;
    data: TagCategoryVO[];
    onOk: (values: FormValues) => Promise<void>;
    onCancel: () => void;
}

interface FormValues {
    parentId?: string;
    name: string;
    orderIndex?: number;
    description?: string;
    entityTypeCode?: string;
}

const CategoryDrawer: React.FC<CategoryDrawerProps> = ({
                                                            visible,
                                                            loading,
                                                            editingId,
                                                            editingRecord,
                                                            parentCategory,
                                                            data,
                                                            onOk,
                                                            onCancel,
                                                        }) => {
    const [form] = Form.useForm();
    const {entityTypeOptions, isLoading: isLoadingEntityTypes} = useEntityTypeEnum();

    useEffect(() => {
        if (visible) {
            if (!editingId) {
                form.resetFields();
            } else if (editingRecord) {
                const existingEntityTypeCode = (editingRecord.feature as Record<string, unknown> | undefined)?.entityTypeCode as string | undefined;
                form.setFieldsValue({
                    parentId: parentCategory,
                    name: editingRecord.name,
                    orderIndex: editingRecord.orderIndex,
                    description: editingRecord.description,
                    entityTypeCode: existingEntityTypeCode,
                });
            }
            form.setFieldsValue({parentId: parentCategory});
        }
    }, [visible, parentCategory, form, editingId, editingRecord]);

    const handleOk = () => {
        return form.validateFields().then((values: FormValues) => {
            return onOk(values);
        });
    };

    const handleCancel = () => {
        form.resetFields();
        onCancel();
    };

    return (
        <BaseDrawer
            title={editingId ? '编辑分类' : '新建分类'}
            open={visible}
            onClose={handleCancel}
            size="md"
            onOk={handleOk}
            confirmLoading={loading}
            okText={editingId ? '保存' : '创建'}
        >
            <Form
                form={form}
                layout="vertical"
            >
                <Form.Item
                    name="parentId"
                    label={editingId ? '移动到上级分类' : '上级分类'}
                    initialValue={parentCategory}
                    tooltip={editingId ? '更改上级分类将移动此分类' : undefined}
                >
                    <TreeSelect
                        treeData={data}
                        fieldNames={{label: 'name', value: 'id', children: 'children'}}
                        placeholder="无（作为顶级分类）"
                        allowClear
                        showSearch
                        treeNodeFilterProp="name"
                        disabled={false}
                        style={{width: '100%'}}
                    />
                </Form.Item>

                <Form.Item
                    name="name"
                    label="分类名称"
                    rules={[
                        {required: true, message: '请输入分类名称'},
                        {min: 2, max: 50, message: '分类名称长度应在 2-50 个字符之间'}
                    ]}
                >
                    <Input placeholder="例如：用户标签"/>
                </Form.Item>

                <Form.Item
                    name="orderIndex"
                    label="排序索引"
                    tooltip="数值范围 0-9999，默认为 0"
                >
                    <InputNumber
                        min={0}
                        max={9999}
                        placeholder="请输入排序索引"
                        style={{width: '100%'}}
                    />
                </Form.Item>

                <Form.Item
                    name="description"
                    label="描述"
                >
                    <Input.TextArea
                        rows={3}
                        placeholder="请输入分类描述"
                        maxLength={200}
                        showCount
                    />
                </Form.Item>

                <Form.Item
                    name="entityTypeCode"
                    label="实体类型"
                    tooltip="绑定此分类到特定实体类型，用于目标表创建时过滤标签"
                >
                    <Select
                        placeholder="选择实体类型（可选）"
                        loading={isLoadingEntityTypes}
                        allowClear
                        options={entityTypeOptions.map(type => ({label: type.name, value: type.value}))}
                    />
                </Form.Item>
            </Form>
        </BaseDrawer>
    );
};

export default CategoryDrawer;
