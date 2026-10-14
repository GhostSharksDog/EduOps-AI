'use client';

import React, {useEffect, useMemo, useCallback, memo, useRef} from 'react';
import type {Rule} from 'antd/es/form';
import {Button, Checkbox, Flex, Form, Input, Select, Space, Table, Tag, theme} from 'antd';
import BaseDrawer from '@/shared/ui/BaseDrawer/index';
import {DeleteOutlined, PlusOutlined} from '@ant-design/icons';
import {DataType} from '@/modules/data/ui/data/models/constants/index';
import type {DataModelVO, ModelColumnVO} from '@/modules/data/contracts/schemas/response/data-model/index';
import type {UpdateDataModelDTO} from '@/modules/data/contracts/schemas/request/data-model/index';
import type {DataSourceVO} from '@/modules/data/contracts/schemas/response/datasource/index';
import {log} from '@/platform/logger';
import {useDataSources} from '@/modules/data/ui/data/sources/hooks/useDataSources';
import {DataSourceStatus} from '@/shared/enums/datasource/index';
import {clientConfig} from '@/shared/config/client';
import {MESSAGES} from '@/shared/messages/index';

// 操作类型枚举
type ColumnOperation = 'KEEP' | 'CREATE' | 'DELETE';

// 带操作类型的列数据结构
interface FormColumnValue extends ModelColumnVO {
    _operation?: ColumnOperation;
}

const {TextArea} = Input;

interface EditDataModelDrawerProps {
    visible: boolean;
    loading: boolean;
    editingModel: DataModelVO | null;
    onSubmit: (values: UpdateDataModelDTO) => void;
    onClose: () => void;
}

// ============================================================================
// MEMOIZED CELL COMPONENTS - 性能优化：每个单元格隔离，避免级联重渲染
// ============================================================================

interface CellProps {
    rowIndex: number;
}

// 文本输入单元格
const TextInputCell = memo(function TextInputCell({
    rowIndex,
    field,
    placeholder,
    rules,
}: CellProps & { field: string; placeholder: string; rules?: Rule[] }) {
    return (
        <Form.Item
            name={[rowIndex, field]}
            rules={rules}
            style={{margin: 0}}
        >
            <Input placeholder={placeholder}/>
        </Form.Item>
    );
});

// 数字输入单元格
const NumberInputCell = memo(function NumberInputCell({
    rowIndex,
    field,
    placeholder,
    min,
    max,
}: CellProps & { field: string; placeholder: string; min?: number; max?: number }) {
    return (
        <Form.Item name={[rowIndex, field]} style={{margin: 0}}>
            <Input type="number" placeholder={placeholder} min={min} max={max} style={{width: '100%'}}/>
        </Form.Item>
    );
});

// 下拉选择单元格
const SelectCell = memo(function SelectCell({
    rowIndex,
    field,
    placeholder,
    options,
    rules,
}: CellProps & { field: string; placeholder: string; options: { value: string; label: string }[]; rules?: Rule[] }) {
    return (
        <Form.Item
            name={[rowIndex, field]}
            rules={rules}
            style={{margin: 0}}
        >
            <Select placeholder={placeholder} options={options} style={{width: '100%'}}/>
        </Form.Item>
    );
});

// EditDataModelDrawer 特有组件: 操作状态标签
const OperationTag = memo(function OperationTag({
    rowIndex,
    form,
}: CellProps & { form: ReturnType<typeof Form.useForm>[0] }) {
    const operation = Form.useWatch(['columns', rowIndex, '_operation'], form) as ColumnOperation | undefined;
    const statusMap: Record<ColumnOperation, React.ReactNode> = {
        'KEEP': <Tag color="blue">保留</Tag>,
        'CREATE': <Tag color="green">新增</Tag>,
        'DELETE': <Tag color="red">删除</Tag>
    };
    return statusMap[operation || 'KEEP'] || '-';
});

// EditDataModelDrawer 特有组件: 可空复选框（带主键联动）
const IsNullableCheckbox = memo(function IsNullableCheckbox({
    rowIndex,
    form,
}: CellProps & { form: ReturnType<typeof Form.useForm>[0] }) {
    const isPrimaryKey = Form.useWatch(['columns', rowIndex, 'isPrimaryKey'], form);
    return (
        <Form.Item
            name={[rowIndex, 'isNullable']}
            valuePropName="checked"
            style={{margin: 0}}
            rules={[{
                validator: async (_, value) => {
                    if (isPrimaryKey === true && value === true) {
                        return Promise.reject('主键字段不能为空');
                    }
                    return Promise.resolve();
                }
            }]}
        >
            <Checkbox disabled={isPrimaryKey === true}/>
        </Form.Item>
    );
});

// EditDataModelDrawer 特有组件: 主键复选框（带联动逻辑）
const PrimaryKeyCheckbox = memo(function PrimaryKeyCheckbox({
    rowIndex,
    form,
}: CellProps & { form: ReturnType<typeof Form.useForm>[0] }) {
    const handleChange = useCallback((e: { target: { checked: boolean } }) => {
        if (e.target.checked) {
            const columns = form.getFieldValue('columns') || [];
            columns[rowIndex] = {
                ...columns[rowIndex],
                isNullable: false
            };
            form.setFieldsValue({ columns });
        }
    }, [form, rowIndex]);

    return (
        <Form.Item
            name={[rowIndex, 'isPrimaryKey']}
            valuePropName="checked"
            style={{margin: 0}}
            rules={[{
                validator: async (_, value) => {
            if (value) {
                const columns = form.getFieldValue('columns') as ModelColumnVO[] | undefined;
                const primaryKeys = columns?.filter((col: ModelColumnVO, idx: number) =>
                    col.isPrimaryKey && idx !== rowIndex
                ) ?? [];
                if (primaryKeys.length > 0) {
                    return Promise.reject(MESSAGES.DATA_MODEL.INVALID_PRIMARY_KEY);
                }
            }
            return Promise.resolve();
        }
    }]}
        >
            <Checkbox onChange={handleChange}/>
        </Form.Item>
    );
});

// EditDataModelDrawer 特有组件: 智能删除按钮
const SmartDeleteButton = memo(function SmartDeleteButton({
    rowIndex,
    form,
}: CellProps & { form: ReturnType<typeof Form.useForm>[0] }) {
    const operation = Form.useWatch(['columns', rowIndex, '_operation'], form);
    
    const handleDelete = useCallback(() => {
        const columns = form.getFieldValue('columns') as FormColumnValue[] | undefined;
        if (!columns) return;

        const targetColumn = columns[rowIndex];

        if (targetColumn._operation === 'CREATE') {
            // 新创建的列直接移除
            const newColumns = columns.filter((_, idx) => idx !== rowIndex);
            newColumns.forEach((col: FormColumnValue, idx: number) => {
                col.orderIndex = idx;
            });
            form.setFieldsValue({ columns: newColumns });
        } else {
            // 现有列标记为删除
            const newColumns = columns.map((col: FormColumnValue, idx: number) =>
                idx === rowIndex ? { ...col, _operation: 'DELETE' as ColumnOperation } : col
            );
            form.setFieldsValue({ columns: newColumns });
        }
    }, [form, rowIndex]);

    return (
        <Button
            type="text"
            danger
            icon={<DeleteOutlined/>}
            onClick={handleDelete}
        >
            {operation === 'CREATE' ? '移除' : '删除'}
        </Button>
    );
});

// EditDataModelDrawer 特有组件: 隐藏字段
const HiddenFields = memo(function HiddenFields({
    rowIndex,
}: CellProps) {
    return (
        <>
            <Form.Item name={[rowIndex, 'id']} noStyle hidden>
                <input type="hidden" />
            </Form.Item>
            <Form.Item name={[rowIndex, '_operation']} noStyle hidden>
                <input type="hidden" />
            </Form.Item>
        </>
    );
});

const EditDataModelDrawer: React.FC<EditDataModelDrawerProps> = ({
    visible,
    loading,
    editingModel,
    onSubmit,
    onClose
}) => {
    const {token} = theme.useToken();
    const [form] = Form.useForm();
    
    // 保存初始列数据,用于变更检测
    const initialColumnsRef = useRef<Map<string, ModelColumnVO>>(new Map());

    const {data: dataSourcesData, isLoading: dataSourcesLoading} = useDataSources({
        status: DataSourceStatus.ACTIVE
    });

    const datasourceOptions: { value: string; label: string }[] = dataSourcesData?.items?.map((ds: DataSourceVO) => ({
        value: ds.id,
        label: ds.name,
    })) || [];

    const dataTypeOptions: { value: DataType; label: string }[] = useMemo(() => [
        {value: DataType.STRING, label: '字符串'},
        {value: DataType.NUMBER, label: '数字'},
        {value: DataType.BOOLEAN, label: '布尔'},
        {value: DataType.DATE, label: '日期'},
        {value: DataType.DATETIME, label: '日期时间'},
        {value: DataType.ARRAY, label: '数组'},
        {value: DataType.OBJECT, label: '对象'},
    ], []);

    useEffect(() => {
        if (editingModel && visible) {
            // 保存原始列数据到 ref
            const columnsMap = new Map<string, ModelColumnVO>();
            editingModel.columns?.forEach(col => {
                columnsMap.set(col.id, col);
            });
            initialColumnsRef.current = columnsMap;
            
            const columnList: FormColumnValue[] = editingModel.columns?.map((col) => ({
                ...col,
                id: col.id,
                _operation: 'KEEP' as ColumnOperation,
                ownedBy: clientConfig.system.userId,
                createTime: col.createTime ?? new Date().toISOString(),
                updateTime: col.updateTime ?? new Date().toISOString(),
                createdBy: col.createdBy,
                updatedBy: col.updatedBy,
                isDeleted: false,
                modelId: col.modelId,
                name: col.name,
                displayName: col.displayName ?? '',
                dataType: col.dataType,
                length: col.length,
                precision: col.precision,
                scale: col.scale,
                isNullable: col.isNullable ?? true,
                defaultValue: col.defaultValue,
                description: col.description,
                orderIndex: col.orderIndex ?? 0,
                isPrimaryKey: col.isPrimaryKey ?? false,
                feature: col.feature
            })) || [];
            form.setFieldsValue({
                name: editingModel.name,
                description: editingModel.description,
                datasourceId: editingModel.datasource?.id,
                tableName: editingModel.tableName,
                columns: columnList
            });
        }
    }, [editingModel, visible, form]);

    const handleSubmit = () => {
        form.validateFields()
            .then(values => {
                // 提交时过滤并转换列数据
                const processedColumns = (values.columns || [])
                    .filter((col: FormColumnValue) => col._operation !== 'KEEP') // 只发送有变更的列
                    .map((col: FormColumnValue) => {
                        // 处理删除操作
                        if (col._operation === 'DELETE') {
                            return {
                                columnId: col.id,
                                operation: 'DELETE' as const,
                            };
                        }
                        // 处理创建操作
                        if (col._operation === 'CREATE') {
                            return {
                                columnId: undefined,
                                operation: 'CREATE' as const,
                                name: col.name,
                                displayName: col.displayName,
                                dataType: col.dataType,
                                length: col.length,
                                precision: col.precision,
                                scale: col.scale,
                                isNullable: col.isNullable,
                                defaultValue: col.defaultValue,
                                description: col.description,
                                orderIndex: col.orderIndex,
                                isPrimaryKey: col.isPrimaryKey,
                                feature: col.feature,
                            };
                        }
                        // 处理更新操作 (KEEP)
                        return {
                            columnId: col.id,
                            operation: 'UPDATE' as const,
                            name: col.name,
                            displayName: col.displayName,
                            dataType: col.dataType,
                            length: col.length,
                            precision: col.precision,
                            scale: col.scale,
                            isNullable: col.isNullable,
                            defaultValue: col.defaultValue,
                            description: col.description,
                            orderIndex: col.orderIndex,
                            isPrimaryKey: col.isPrimaryKey,
                            feature: col.feature,
                        };
                    });

                onSubmit({
                    ...values,
                    columns: processedColumns
                } as UpdateDataModelDTO);
            })
            .catch(info => {
                log.info('Validate Failed:', info);
            });
    };

    const validateColumnName = async (_: unknown, value: string) => {
        if (!value || value.trim() === '') {
            return Promise.reject(MESSAGES.DATA_MODEL.COLUMN_NAME_REQUIRED);
        }
        if (value.length > 255) {
            return Promise.reject('列名长度不能超过255个字符');
        }
        const allColumns = form.getFieldValue('columns') as ModelColumnVO[] | undefined;
        const duplicateCount = allColumns?.filter((col) => col && col.name === value).length ?? 0;
        if (duplicateCount > 1) {
            return Promise.reject(MESSAGES.DATA_MODEL.COLUMN_NAME_EXISTS);
        }
        return Promise.resolve();
    };

    // 提取 tableColumns 为 useMemo，避免每次渲染重建
    const tableColumns = useMemo(() => [
        {
            title: '列名',
            dataIndex: 'name',
            width: 100,
            render: (_: unknown, record: { key: number }) => (
                <TextInputCell
                    rowIndex={record.key}
                    field="name"
                    placeholder="列名"
                    rules={[
                        {required: true, message: '请输入列名'},
                        {validator: validateColumnName}
                    ]}
                />
            )
        },
        {
            title: '显示名称',
            dataIndex: 'displayName',
            width: 80,
            render: (_: unknown, record: { key: number }) => (
                <TextInputCell
                    rowIndex={record.key}
                    field="displayName"
                    placeholder="显示名称"
                />
            )
        },
        {
            title: '数据类型',
            dataIndex: 'dataType',
            width: 90,
            render: (_: unknown, record: { key: number }) => (
                <SelectCell
                    rowIndex={record.key}
                    field="dataType"
                    placeholder="数据类型"
                    options={dataTypeOptions}
                    rules={[{required: true, message: '请选择数据类型'}]}
                />
            )
        },
        {
            title: '长度',
            dataIndex: 'length',
            width: 50,
            render: (_: unknown, record: { key: number }) => (
                <NumberInputCell
                    rowIndex={record.key}
                    field="length"
                    placeholder="长度"
                    min={1}
                    max={1000}
                />
            )
        },
        {
            title: '精度',
            dataIndex: 'precision',
            width: 50,
            render: (_: unknown, record: { key: number }) => (
                <NumberInputCell
                    rowIndex={record.key}
                    field="precision"
                    placeholder="精度"
                    min={1}
                    max={38}
                />
            )
        },
        {
            title: '小数位',
            dataIndex: 'scale',
            width: 50,
            render: (_: unknown, record: { key: number }) => (
                <NumberInputCell
                    rowIndex={record.key}
                    field="scale"
                    placeholder="小数位"
                    min={0}
                    max={38}
                />
            )
        },
        {
            title: '可空',
            dataIndex: 'isNullable',
            width: 30,
            render: (_: unknown, record: { key: number }) => (
                <IsNullableCheckbox rowIndex={record.key} form={form} />
            )
        },
        {
            title: '主键',
            dataIndex: 'isPrimaryKey',
            width: 30,
            render: (_: unknown, record: { key: number }) => (
                <PrimaryKeyCheckbox rowIndex={record.key} form={form} />
            )
        },
        {
            title: '列描述',
            dataIndex: 'description',
            width: 80,
            render: (_: unknown, record: { key: number }) => (
                <TextInputCell
                    rowIndex={record.key}
                    field="description"
                    placeholder="列描述"
                />
            )
        },
        {
            title: '排序',
            dataIndex: 'orderIndex',
            width: 50,
            render: (_: unknown, record: { key: number }) => (
                <NumberInputCell
                    rowIndex={record.key}
                    field="orderIndex"
                    placeholder="排序"
                    min={0}
                    max={9999}
                />
            )
        },
        {
            title: '状态',
            dataIndex: '_operation',
            width: 60,
            render: (_: unknown, record: { key: number }) => (
                <>
                    <HiddenFields rowIndex={record.key} />
                    <OperationTag rowIndex={record.key} form={form} />
                </>
            )
        },
        {
            title: '',
            width: 40,
            render: (_: unknown, record: { key: number }) => (
                <SmartDeleteButton rowIndex={record.key} form={form} />
            )
        }
    ], [dataTypeOptions, validateColumnName, form]);

    const handleAddColumn = useCallback(() => {
        const columns = form.getFieldValue('columns') as FormColumnValue[] | undefined;
        const newColumn: FormColumnValue = {
            id: crypto.randomUUID(),
            _operation: 'CREATE' as ColumnOperation,
            ownedBy: clientConfig.system.userId,
            createTime: new Date().toISOString(),
            updateTime: new Date().toISOString(),
            isDeleted: false,
            modelId: editingModel?.id,
            name: '',
            displayName: '',
            dataType: DataType.STRING,
            length: undefined,
            precision: undefined,
            scale: undefined,
            isNullable: true,
            defaultValue: undefined,
            description: '',
            orderIndex: (columns?.length ?? 0),
            isPrimaryKey: false,
            feature: undefined
        };
        form.setFieldsValue({
            columns: columns ? [...columns, newColumn] : [newColumn]
        });
    }, [form, editingModel?.id]);

    return (
        <BaseDrawer
            title={<Space>编辑数据模型</Space>}
            onClose={onClose}
            open={visible}
            size="xl"
            onOk={handleSubmit}
            confirmLoading={loading}
            okText={MESSAGES.COMMON.SAVE}
        >
            <Form
                form={form}
                layout="vertical"
                style={{maxHeight: 700, overflowY: 'auto', paddingInlineEnd: token.marginSM}}
            >
                <Flex gap={token.marginMD} wrap="wrap">
                    <Form.Item
                        name="name"
                        label="模型名称"
                        rules={[
                            {required: true, message: MESSAGES.DATA_MODEL.NAME_REQUIRED},
                            {max: 255, message: MESSAGES.DATA_MODEL.NAME_MAX_LENGTH}
                        ]}
                        style={{flex: 1, minWidth: 200}}
                    >
                        <Input placeholder="请输入模型名称"/>
                    </Form.Item>

                    <Form.Item
                        name="datasourceId"
                        label="数据源"
                        rules={[{required: true, message: MESSAGES.DATA_MODEL.DATASOURCE_NOT_FOUND}]}
                        style={{flex: 1, minWidth: 200}}
                    >
                        <Select placeholder="请选择数据源" options={datasourceOptions} loading={dataSourcesLoading}/>
                    </Form.Item>

                    <Form.Item
                        name="tableName"
                        label="表名"
                        rules={[
                            {max: 255, message: MESSAGES.DATA_MODEL.TABLE_NAME_MAX_LENGTH}
                        ]}
                        style={{flex: 1, minWidth: 200}}
                    >
                        <Input placeholder="请输入映射的物理表名"/>
                    </Form.Item>
                </Flex>

                <Form.Item
                    name="description"
                    label="模型描述"
                >
                    <TextArea rows={2} placeholder="请输入模型描述"/>
                </Form.Item>

                <Form.Item label="列定义">
                    <Form.List name="columns">
                        {(fields) => {
                            const tableData = fields.map(field => ({key: field.name}));
                            return (
                                <Table
                                    dataSource={tableData}
                                    columns={tableColumns}
                                    pagination={false}
                                    size="small"
                                    rowKey="key"
                                    scroll={{y: 400}}
                                    footer={() => (
                                        <Button
                                            type="dashed"
                                            onClick={handleAddColumn}
                                            style={{width: '100%'}}
                                            icon={<PlusOutlined/>}
                                        >
                                            添加列
                                        </Button>
                                    )}
                                />
                            );
                        }}
                    </Form.List>
                </Form.Item>
            </Form>
        </BaseDrawer>
    );
};

export default EditDataModelDrawer;
