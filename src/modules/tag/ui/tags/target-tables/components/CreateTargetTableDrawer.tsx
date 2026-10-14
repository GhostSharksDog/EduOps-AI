'use client';

import React, {useState, useEffect} from 'react';
import {Form, Input, Select, Button, Space, Radio, Alert} from 'antd';
import {useGlobalMessage} from '@/shared/lib/message-service';
import {useTargetTableManagementStore} from '@/modules/tag/ui/state/targetTableManagementStore';
import {useCreateTargetTable, useCreateTable} from '@/modules/tag/ui/tags/target-tables/hooks/useTargetTableManagement';
import {useEntityTypeEnum} from '@/modules/tag/ui/tags/target-tables/hooks/useEntityTypeEnum';
import {useDDLPreview} from '@/modules/tag/ui/tags/target-tables/hooks/useDDLPreview';
import {TableType} from '@/modules/tag/domain/entities/TargetTable';
import {TagValueType} from '@/shared/enums/tag/TagValueType';
import {serializeDDLResult} from '@/platform/ddl/index';
import {getAllAggregateFunctionNames} from '@/platform/ddl/aggregateFunctionMappings';
import BaseDrawer from '@/shared/ui/BaseDrawer/index';
import TagSelector from '@/modules/tag/ui/tags/target-tables/components/TagSelector';
import DDLPreview from '@/modules/tag/ui/tags/target-tables/components/DDLPreview';
import DimensionColumnEditor from '@/modules/tag/ui/tags/target-tables/components/DimensionColumnEditor';
import type {DimensionColumn} from '@/modules/tag/domain/value-objects/DimensionColumn';

const extractErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        const apiError = error as Error & {response?: {data?: {error?: string; message?: string}}};
        if (apiError.response?.data?.error) return apiError.response.data.error;
        if (apiError.response?.data?.message) return apiError.response.data.message;
        return error.message;
    }
    return '未知错误';
};

const TAG_VALUE_TYPE_OPTIONS = [
    {label: '字符串 (STRING)', value: TagValueType.STRING},
    {label: '数值 (NUMBER)', value: TagValueType.NUMBER},
    {label: '布尔 (BOOLEAN)', value: TagValueType.BOOLEAN},
    {label: '日期 (DATE)', value: TagValueType.DATE},
    {label: '日期时间 (DATETIME)', value: TagValueType.DATETIME},
];

const AGGREGATE_FUNCTION_OPTIONS = getAllAggregateFunctionNames().map(name => ({
    label: name,
    value: name,
}));

const CreateTargetTableDrawer: React.FC = () => {
    const {success, error: showError} = useGlobalMessage();
    const {createDrawerVisible, closeCreateDrawer, setLastCreatedTargetTableId} = useTargetTableManagementStore();
    const createMutation = useCreateTargetTable();
    const createTableMutation = useCreateTable();
    const {entityTypeOptions, isLoading: isLoadingEntityTypes} = useEntityTypeEnum();
    const {mutateDDLPreview, data: rawDDLData, isPending: ddlPreviewLoading} = useDDLPreview();
    const [form] = Form.useForm();

    const [newEntityType, setNewEntityType] = useState(false);
    const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
    const [selectedTagValueType, setSelectedTagValueType] = useState<TagValueType | null>(null);
    const [selectedEntityTypeCode, setSelectedEntityTypeCode] = useState<string>('');
    const [dimensionColumns, setDimensionColumns] = useState<DimensionColumn[]>([]);
    const [aggregateFunctionName, setAggregateFunctionName] = useState<string | null>(null);

    const watchedEntityTypeId = Form.useWatch('entityTypeId', form);
    const watchedCustomEntityType = Form.useWatch('customEntityType', form);
    const tableName = Form.useWatch('tableName', form);
    const watchedTableType = Form.useWatch('tableType', form);
    const isIntermediate = watchedTableType === TableType.INTERMEDIATE;

    const selectedEntityTypeOption = entityTypeOptions.find(t => t.id === watchedEntityTypeId);
    const entityTypeCode = newEntityType ? watchedCustomEntityType : (selectedEntityTypeOption?.value ?? '');

    const ddlPreviewData = rawDDLData;

    useEffect(() => {
        if (!tableName || !entityTypeCode || !watchedEntityTypeId) return;

        // INTERMEDIATE needs dimensionColumns + aggregateFunctionName
        if (isIntermediate) {
            if (dimensionColumns.length === 0 || !aggregateFunctionName) return;
            const timer = setTimeout(() => {
                mutateDDLPreview({
                    tableName,
                    entityTypeCode,
                    entityTypeId: watchedEntityTypeId,
                    tableType: 'INTERMEDIATE' as const,
                    dimensionColumns,
                    aggregateFunctionName,
                });
            }, 500);
            return () => clearTimeout(timer);
        }

        // PHYSICAL_TABLE / VIEW need tagValueType
        if (!selectedTagValueType) return;
        const timer = setTimeout(() => {
            mutateDDLPreview({
                tableName,
                entityTypeCode,
                entityTypeId: watchedEntityTypeId,
                tagValueType: selectedTagValueType,
                tableType: watchedTableType === TableType.VIEW ? 'VIEW' : 'PHYSICAL_TABLE',
            });
        }, 500);
        return () => clearTimeout(timer);
    }, [tableName, entityTypeCode, watchedEntityTypeId, selectedTagValueType, isIntermediate, watchedTableType, dimensionColumns, aggregateFunctionName, mutateDDLPreview]);

    const handleTagChange = (tagId: string, tagValueType: TagValueType, entityTypeCode: string) => {
        setSelectedTagId(tagId);
        setSelectedTagValueType(tagValueType);
        if (entityTypeCode && entityTypeCode !== 'UNKNOWN') {
            setSelectedEntityTypeCode(entityTypeCode);
        }
    };

    const buildPayload = async () => {
        const fieldsToValidate = newEntityType
            ? ['tableName', 'customEntityType', 'customEntityTypeId', 'tableType']
            : ['tableName', 'entityTypeId', 'tableType'];
        const values = await form.validateFields(fieldsToValidate);

        if (!selectedTagId) {
            throw new Error('请选择一个标签');
        }

        const entityType = newEntityType
            ? values.customEntityType
            : (entityTypeOptions.find(t => t.id === values.entityTypeId)?.value ?? '');
        const entityTypeId = newEntityType ? values.customEntityTypeId : values.entityTypeId;

        if (!entityType) {
            throw new Error('无法找到对应的实体类型');
        }

        const tableType = values.tableType || TableType.PHYSICAL_TABLE;

        if (tableType === TableType.INTERMEDIATE) {
            if (dimensionColumns.length === 0) throw new Error('请添加至少一个维度列');
            if (!aggregateFunctionName) throw new Error('请选择聚合函数');

            return {
                tableName: values.tableName,
                entityType,
                entityTypeId,
                createTableSql: '',
                tableType,
                tagId: selectedTagId,
                dimensionColumns: JSON.stringify(dimensionColumns),
                aggregateFunctionName,
            };
        }

        const ddlData = ddlPreviewData;
        if (!ddlData) {
            throw new Error('请先选择标签以生成 DDL');
        }

        const createTableSql = serializeDDLResult(ddlData);

        return {
            tableName: values.tableName,
            entityType,
            entityTypeId,
            createTableSql,
            tableType,
            tagId: selectedTagId,
        };
    };

    const handleCreate = async () => {
        try {
            const payload = await buildPayload();
            const result = await createMutation.mutateAsync(payload);
            success('目标表创建成功');
            cleanupAndClose(result.id);
        } catch (error) {
            const errorMsg = extractErrorMessage(error);
            showError(`创建失败: ${errorMsg}`);
        }
    };

    const handleCreateAndBuild = async () => {
        let payload;
        try {
            payload = await buildPayload();
        } catch (error) {
            const errorMsg = extractErrorMessage(error);
            showError(errorMsg);
            return;
        }

        let createdTable;
        try {
            createdTable = await createMutation.mutateAsync(payload);
        } catch (err) {
            showError(`创建失败: ${extractErrorMessage(err)}`);
            return;
        }

        try {
            await createTableMutation.mutateAsync(createdTable.id);
            success('目标表创建并构建成功');
            cleanupAndClose(createdTable.id);
        } catch (err) {
            success('目标表已创建（构建失败，可稍后重试）');
            showError(`构建失败: ${extractErrorMessage(err)}`);
            cleanupAndClose(createdTable.id);
        }
    };

    const cleanupAndClose = (createdId?: string) => {
        form.resetFields();
        setNewEntityType(false);
        setSelectedTagId(null);
        setSelectedTagValueType(null);
        setDimensionColumns([]);
        setAggregateFunctionName(null);
        if (createdId) setLastCreatedTargetTableId(createdId);
        closeCreateDrawer();
    };

    const handleClose = () => {
        cleanupAndClose();
    };

    return (
        <BaseDrawer
            title="创建目标表"
            size="lg"
            open={createDrawerVisible}
            onClose={handleClose}
            destroyOnClose
            footerMode="custom"
            footer={
                <Space style={{display: 'flex', justifyContent: 'flex-end'}}>
                    <Button onClick={handleClose}>取消</Button>
                    <Button onClick={handleCreate} loading={createMutation.isPending}>
                        创建
                    </Button>
                    <Button
                        type="primary"
                        onClick={handleCreateAndBuild}
                        loading={createMutation.isPending || createTableMutation.isPending}
                        disabled={!ddlPreviewData && !isIntermediate}
                    >
                        创建并构建
                    </Button>
                </Space>
            }
        >
            <Form
                form={form}
                layout="vertical"
                initialValues={{tableType: TableType.PHYSICAL_TABLE}}
            >
                <Form.Item
                    name="tableName"
                    label="表名"
                    rules={[
                        {required: true, message: '请输入表名'},
                        {
                            pattern: /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/,
                            message: '表名格式无效，支持 schema.table 或 table 格式',
                        },
                    ]}
                >
                    <Input placeholder="my_target_table"/>
                </Form.Item>

                {!newEntityType && (
                    <Form.Item
                        name="entityTypeId"
                        label="实体类型"
                        rules={[{required: !newEntityType, message: '请选择实体类型'}]}
                    >
                        <Select
                            placeholder={isLoadingEntityTypes ? "加载中..." : "选择已有实体类型"}
                            loading={isLoadingEntityTypes}
                            options={entityTypeOptions.map(type => ({label: type.name, value: type.id}))}
                        />
                    </Form.Item>
                )}

                {newEntityType && (
                    <>
                        <Form.Item
                            name="customEntityType"
                            label="新实体类型名称"
                            rules={[
                                {required: newEntityType, message: '请输入实体类型名称'},
                                {
                                    pattern: /^[A-Z][A-Z0-9_]*$/,
                                    message: '必须以大写字母开头，仅支持大写字母、数字和下划线',
                                },
                            ]}
                        >
                            <Input placeholder="例如: ORDER, PRODUCT"/>
                        </Form.Item>
                        <Form.Item
                            name="customEntityTypeId"
                            label="实体类型ID (UUID)"
                            rules={[
                                {required: newEntityType, message: '请输入实体类型ID'},
                                {
                                    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
                                    message: '请输入有效的UUID格式',
                                },
                            ]}
                        >
                            <Input placeholder="例如: 550e8400-e29b-41d4-a716-446655440000"/>
                        </Form.Item>
                    </>
                )}

                <Button
                    type="link"
                    style={{padding: 0, marginBottom: 16}}
                    onClick={() => setNewEntityType(!newEntityType)}
                >
                    {newEntityType ? '选择已有类型' : '+ 新建实体类型'}
                </Button>

                <Form.Item
                    name="tableType"
                    label="表类型"
                    rules={[{required: true, message: '请选择表类型'}]}
                >
                    <Radio.Group>
                        <Radio value={TableType.PHYSICAL_TABLE}>物理表</Radio>
                        <Radio value={TableType.VIEW}>视图</Radio>
                        <Radio value={TableType.INTERMEDIATE}>中间表</Radio>
                    </Radio.Group>
                </Form.Item>

                {isIntermediate && (
                    <>
                        <Form.Item label="聚合函数" required rules={[{required: true, message: '请选择聚合函数'}]}>
                            <Select
                                placeholder="选择聚合函数"
                                options={AGGREGATE_FUNCTION_OPTIONS}
                                value={aggregateFunctionName}
                                onChange={setAggregateFunctionName}
                            />
                        </Form.Item>
                        <Form.Item label="维度列配置" required>
                            <DimensionColumnEditor
                                value={dimensionColumns}
                                onChange={setDimensionColumns}
                            />
                        </Form.Item>
                    </>
                )}

                {(entityTypeCode) ? (
                    <Form.Item label="关联标签">
                        <TagSelector
                            value={selectedTagId ?? undefined}
                            onChange={handleTagChange}
                            entityTypeCode={entityTypeCode}
                        />
                    </Form.Item>
                ) : (
                    <Form.Item label="关联标签">
                        <Select disabled placeholder="请先选择实体类型"/>
                    </Form.Item>
                )}

                <Form.Item label="DDL 预览">
                    <DDLPreview ddlResult={ddlPreviewData} isLoading={ddlPreviewLoading}/>
                </Form.Item>
            </Form>
        </BaseDrawer>
    );
};

export default CreateTargetTableDrawer;
