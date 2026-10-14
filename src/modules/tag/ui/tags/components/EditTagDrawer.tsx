import React, {useEffect, useMemo} from 'react';
import {Divider, Form, Input, Row, Col, Select, Space, Switch, theme, TreeSelect} from 'antd';
import BaseDrawer from '@/shared/ui/BaseDrawer/index';
import {TagStatus, TagValueType, UpdateCycle} from '@/shared/enums/index';
import type {TagVO} from '@/modules/tag/contracts/schemas/response/tag/index';
import type {TagCategoryVO} from '@/modules/tag/contracts/schemas/response/tag-category/index';
import {MESSAGES} from '@/shared/messages/index';
import {useBitmapTables} from '@/modules/tag/ui/tags/bitmap/hooks/useBitmapManagement';
import {useTargetTables} from '@/modules/tag/ui/tags/target-tables/hooks/useTargetTableManagement';
import {TargetTableStatus} from '@/modules/tag/domain/entities/TargetTable';

interface EditTagDrawerProps {
    visible: boolean;
    loading: boolean;
    editingTag: TagVO | null;
    categories: TagCategoryVO[];
    onOk: (values: Record<string, unknown>) => Promise<void>;
    onCancel: () => void;
}

const EditTagDrawer: React.FC<EditTagDrawerProps> = ({
    visible,
    loading,
    editingTag,
    categories,
    onOk,
    onCancel,
}) => {
    const [form] = Form.useForm();
    const {token} = theme.useToken();

    const {data: bitmapTablesData, isLoading: bitmapTablesLoading} = useBitmapTables({status: 'ACTIVE'});
    const selectedBitmapTableId = Form.useWatch(['bitConfig', 'bitmapTableId'], form);
    const selectedBitPosition = Form.useWatch(['bitConfig', 'bitPosition'], form);

    const bitmapTableOptions = useMemo(() => {
        if (!bitmapTablesData?.items) return [];
        return bitmapTablesData.items.map((table) => ({
            value: table.id,
            label: `${table.tableName} (${(table.usedBits || []).length}/${table.totalBits} 已用)`,
        }));
    }, [bitmapTablesData]);

    const availableBitOptions = useMemo(() => {
        if (!selectedBitmapTableId || !bitmapTablesData?.items) return [];
        const table = bitmapTablesData.items.find(t => t.id === selectedBitmapTableId);
        if (!table) return [];
        const usedBits = new Set(table.usedBits || []);
        const options: {value: number; label: string; disabled?: boolean}[] = [];
        for (let i = 0; i < table.totalBits; i++) {
            const isUsed = usedBits.has(i);
            options.push({
                value: i,
                label: `Bit ${i}${isUsed ? ' (已占用)' : ''}`,
                disabled: isUsed,
            });
        }
        return options;
    }, [selectedBitmapTableId, bitmapTablesData]);

    const {data: targetTablesData, isLoading: targetTablesLoading} = useTargetTables({
        page: 1,
        pageSize: 100
    });

    const filteredTargetTableOptions = useMemo(() => {
        if (!targetTablesData?.items) return [];
        return targetTablesData.items
            .filter(table => table.status === TargetTableStatus.CREATED || table.status === TargetTableStatus.ACTIVE)
            .map(table => ({
                value: table.id,
                label: `${table.tableName} (${table.status})`,
            }));
    }, [targetTablesData]);

    useEffect(() => {
        if (editingTag && visible) {
            form.setFieldsValue({
                name: editingTag.name,
                dataType: editingTag.dataType,
                updateCycle: editingTag.updateCycle,
                isPublic: editingTag.isPublic,
                categoryId: editingTag.category?.id,
                description: editingTag.description,
                targetTableId: editingTag.targetTableId,
                bitConfig: editingTag.bitConfig ? {
                    bitmapTableId: editingTag.bitConfig.bitmapTableId,
                    bitPosition: editingTag.bitConfig.bitPosition
                } : {}
            });
        }
    }, [editingTag, visible, form]);

    const handleOk = () => {
        return form.validateFields().then((values) => {
            // 非 DRAFT 标签不允许修改 bit 配置（bit 分配在激活时设定，应通过 Bitmap 管理页面操作）
            const isDraft = editingTag?.status === TagStatus.DRAFT;
            const bitConfig = isDraft && values.bitConfig?.bitmapTableId && values.bitConfig?.bitPosition !== undefined ? {
                bitmapTableId: values.bitConfig.bitmapTableId,
                bitPosition: values.bitConfig.bitPosition,
            } : undefined;
            return onOk({...values, bitConfig});
        });
    };

    const handleCancel = () => {
        form.resetFields();
        onCancel();
    };

    return (
        <BaseDrawer
            title="编辑标签"
            open={visible}
            onClose={handleCancel}
            size="md"
            onOk={handleOk}
            confirmLoading={loading}
            okText={MESSAGES.COMMON.SAVE}
        >
            <Form
                form={form}
                layout="vertical"
            >
                <Form.Item
                    name="name"
                    label="标签名称"
                    rules={[{required: true, message: '请输入标签名称'}]}
                    style={{marginBottom: token.marginSM}}
                >
                    <Input placeholder="例如：VIP用户" style={{height: token.controlHeight}}/>
                </Form.Item>
                <Space size={token.marginSM}>
                    <Form.Item
                        name="dataType"
                        label="值类型"
                        rules={[{required: true}]}
                        style={{marginBottom: token.marginSM}}
                    >
                        <Select style={{minWidth: 150, height: token.controlHeight}}>
                            {(Object.values(TagValueType) as string[]).map(type => (
                                <Select.Option key={type} value={type}>{type}</Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="updateCycle"
                        label="更新周期"
                        rules={[{required: true}]}
                        style={{marginBottom: token.marginSM}}
                    >
                        <Select style={{minWidth: 150, height: token.controlHeight}}>
                            {(Object.values(UpdateCycle) as string[]).map(cycle => (
                                <Select.Option key={cycle} value={cycle}>{cycle}</Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Space>
                <Form.Item
                    name="isPublic"
                    label="是否公开"
                    valuePropName="checked"
                >
                    <Switch/>
                </Form.Item>
                <Form.Item
                    name="categoryId"
                    label="所属分类"
                    rules={[{required: true, message: '请选择所属分类'}]}
                    style={{marginBottom: token.marginSM}}
                >
                    <TreeSelect
                        placeholder="选择分类"
                        treeData={categories}
                        fieldNames={{label: 'name', value: 'id', children: 'children'}}
                        showSearch
                        filterTreeNode={(input, node) => {
                            const label = node.name || '';
                            return label.toLowerCase().includes(input.toLowerCase());
                        }}
                        style={{width: '100%', height: token.controlHeight}}
                    />
                </Form.Item>
                <Form.Item
                    name="description"
                    label="描述"
                    style={{marginBottom: token.marginSM}}
                >
                    <Input.TextArea rows={4} placeholder="请输入标签描述"/>
                </Form.Item>
                <Form.Item
                    name="targetTableId"
                    label="目标表"
                    tooltip="修改关联的目标表。置空可取消关联。"
                    rules={[{required: false}]}
                    style={{marginBottom: token.marginSM}}
                >
                    <Select
                        placeholder="不关联目标表"
                        options={filteredTargetTableOptions}
                        allowClear
                        showSearch
                        loading={targetTablesLoading}
                        filterOption={(input, option) =>
                            String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                    />
                </Form.Item>
                {editingTag?.status === TagStatus.DRAFT ? (
                    <>
                        <Divider>Bit 配置（可选）</Divider>
                        <Row gutter={12}>
                            <Col span={12}>
                                <Form.Item
                                    name={['bitConfig', 'bitmapTableId']}
                                    label="Bitmap 表"
                                    rules={[{required: false, message: '请选择 Bitmap 表'}]}
                                    style={{marginBottom: token.marginSM}}
                                >
                                    <Select
                                        style={{width: '100%', height: token.controlHeight}}
                                        placeholder={bitmapTableOptions.length === 0 ? '暂无可用 Bitmap 表' : '选择 Bitmap 表'}
                                        loading={bitmapTablesLoading}
                                        options={bitmapTableOptions}
                                        value={selectedBitmapTableId}
                                        allowClear
                                        showSearch
                                        filterOption={(input, option) =>
                                            String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                        }
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name={['bitConfig', 'bitPosition']}
                                    label="Bit 位置"
                                    rules={[{required: false, message: '请选择 Bit 位置'}]}
                                    style={{marginBottom: token.marginSM}}
                                >
                                    <Select
                                        style={{width: '100%', height: token.controlHeight}}
                                        placeholder="选择 Bit 位置"
                                        options={availableBitOptions}
                                        value={selectedBitPosition}
                                        allowClear
                                        disabled={!selectedBitmapTableId}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                        {selectedBitmapTableId && availableBitOptions.length === 0 && (
                            <div style={{color: token.colorWarningText, fontSize: 12, marginBottom: token.marginSM}}>
                                该表已无可用 Bit 位置
                            </div>
                        )}
                        {!selectedBitmapTableId && (
                            <div style={{color: token.colorTextSecondary, fontSize: 12, marginBottom: token.marginSM}}>
                                提示：Bit 配置为可选项，如不配置可在创建标签后在 Bitmap 管理
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <Divider>Bit 配置</Divider>
                        <div style={{color: token.colorTextSecondary, fontSize: 12, marginBottom: token.marginSM}}>
                            已激活标签的 Bit 配置在激活时设定，如需修改请通过 Bitmap 管理页面操作
                        </div>
                    </>
                )}
            </Form>
        </BaseDrawer>
    );
};

export default EditTagDrawer;