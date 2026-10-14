'use client';

import React, {memo, useCallback, useMemo, useState} from 'react';
import type {Rule} from 'antd/es/form';
import {Button, Checkbox, Flex, Form, Input, Popconfirm, Select, Space, Table, theme} from 'antd';
import BaseDrawer from '@/shared/ui/BaseDrawer/index';
import {ClearOutlined, CodeOutlined, DeleteOutlined, PlusOutlined} from '@ant-design/icons';
import {DataType} from '@/modules/data/ui/data/models/constants/index';
import type {CreateDataModelDTO, ModelColumnCreateDTO} from '@/modules/data/contracts/schemas/request/data-model/index';
import {log} from '@/platform/logger';
import {useDataSources} from '@/modules/data/ui/data/sources/hooks/useDataSources';
import {DataSourceStatus} from '@/shared/enums/datasource/index';
import {parseCreateTable, validateCreateTable} from '@/platform/sql-parser/createTableParser';
import SqlImportModal from '@/modules/data/ui/data/models/components/SqlImportModal';
import {globalMessage} from "@/shared/lib/message";
import {MESSAGES} from '@/shared/messages/index';

const {TextArea} = Input;

// ============================================================================
// MEMOIZED CELL COMPONENTS - Each cell is isolated to prevent cascade re-renders
// ============================================================================

interface CellProps {
    rowIndex: number;
}

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

// Number input cell
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

const PrimaryKeyCheckbox = memo(function PrimaryKeyCheckbox({
    rowIndex,
    form,
    checked,
    onChange,
}: CellProps & { form: ReturnType<typeof Form.useForm>[0]; checked?: boolean; onChange?: (e: { target: { checked: boolean } }) => void }) {
    const handleChange = useCallback((e: { target: { checked: boolean } }) => {
        onChange?.(e);
        if (e.target.checked) {
            const columns = form.getFieldValue('columns') || [];
            columns[rowIndex] = {
                ...columns[rowIndex],
                isNullable: false
            };
            form.setFieldsValue({ columns });
        }
    }, [form, rowIndex, onChange]);

    return <Checkbox checked={checked} onChange={handleChange}/>;
});

const IsNullableCheckbox = memo(function IsNullableCheckbox({
    rowIndex,
    form,
    checked,
    onChange,
}: CellProps & { form: ReturnType<typeof Form.useForm>[0]; checked?: boolean; onChange?: (e: { target: { checked: boolean } }) => void }) {
    const isPrimaryKey = Form.useWatch(['columns', rowIndex, 'isPrimaryKey'], form);
    return <Checkbox checked={checked} onChange={onChange} disabled={isPrimaryKey === true}/>;
});

// Delete button with stable reference
const DeleteButton = memo(function DeleteButton({
    rowIndex,
    form,
}: CellProps & { form: ReturnType<typeof Form.useForm>[0] }) {
    const handleDelete = useCallback(() => {
        const columns = form.getFieldValue('columns') as ModelColumnCreateDTO[] | undefined;
        if (!columns) return;
        const newColumns = columns.filter((_: ModelColumnCreateDTO, idx: number) => idx !== rowIndex);
        newColumns.forEach((col: ModelColumnCreateDTO, idx: number) => {
            col.orderIndex = idx;
        });
        form.setFieldsValue({columns: newColumns});
    }, [form, rowIndex]);

    return (
        <Button
            type="text"
            danger
            icon={<DeleteOutlined/>}
            onClick={handleDelete}
        />
    );
});

interface CreateDataModelDrawerProps {
    visible: boolean;
    loading: boolean;
    onSubmit: (values: CreateDataModelDTO) => void;
    onClose: () => void;
}

const CreateDataModelDrawer: React.FC<CreateDataModelDrawerProps> = ({
                                                                         visible,
                                                                         loading,
                                                                         onSubmit,
                                                                         onClose
                                                                     }) => {
    const {token} = theme.useToken();
    const [form] = Form.useForm();
    const [sqlModalVisible, setSqlModalVisible] = useState(false);
    const [sqlInput, setSqlInput] = useState('');
    const [sqlDialect, setSqlDialect] = useState<'mysql' | 'postgresql' | 'clickhouse'>('mysql');
    const [parsing, setParsing] = useState(false);

    const handleSubmit = () => {
        form.validateFields()
            .then(values => {
                onSubmit(values);
                form.resetFields();
            })
            .catch(info => {
                log.info('Validate Failed:', info);
            });
    };

    const validateColumnName = useCallback(async (_: unknown, value: string) => {
        if (!value || value.trim() === '') {
            return Promise.reject(MESSAGES.DATA_MODEL.COLUMN_NAME_REQUIRED);
        }
        if (value.length > 255) {
            return Promise.reject('列名长度不能超过255个字符');
        }
        const columns = form.getFieldValue('columns') || [];
        const duplicateCount = columns.filter((col: ModelColumnCreateDTO) => col.name === value).length;
        if (duplicateCount > 1) {
            return Promise.reject(MESSAGES.DATA_MODEL.COLUMN_NAME_EXISTS);
        }
        return Promise.resolve();
    }, [form]);

    const _validatePrimaryKey = useCallback(async (_: unknown, _value: boolean) => {
        return Promise.resolve();
    }, []);

    const handleSqlImport = async () => {
        if (!sqlInput.trim()) {
            globalMessage.error(MESSAGES.SQL.INPUT_REQUIRED);
            return;
        }

        const cleanSql = sqlInput.trim().replace(/;$/, '').trim();

        setParsing(true);
        try {
            const validationErrors = validateCreateTable(cleanSql, sqlDialect);
            if (validationErrors.length > 0) {
                globalMessage.error(`${MESSAGES.SQL.SYNTAX_ERROR}: ${validationErrors[0]}`);
                setParsing(false);
                return;
            }

            const result = parseCreateTable(cleanSql, sqlDialect);

            const parsedColumns = result.columns.map(col => ({
                name: col.name,
                displayName: '',
                dataType: col.mappedDataType,
                length: col.length,
                precision: col.precision,
                scale: col.scale,
                isNullable: col.isPrimaryKey ? false : col.isNullable,
                isPrimaryKey: col.isPrimaryKey,
                description: col.description || '',
                orderIndex: col.orderIndex,
                defaultValue: undefined,
                feature: undefined
            }));

            form.setFieldsValue({
                tableName: result.tableName,
                description: result.tableComment || '',
                columns: parsedColumns
            });
            

            setSqlModalVisible(false);
            setSqlInput('');
            setParsing(false);
            globalMessage.success(MESSAGES.SQL.PARSE_SUCCESS);
        } catch (error) {
            log.error('SQL解析失败', error);
            globalMessage.error(MESSAGES.SQL.PARSE_FAILED);
            setParsing(false);
        }
    };

    const dataTypeOptions = useMemo(() => [
        {value: DataType.STRING, label: '字符串'},
        {value: DataType.NUMBER, label: '数字'},
        {value: DataType.BOOLEAN, label: '布尔'},
        {value: DataType.DATE, label: '日期'},
        {value: DataType.DATETIME, label: '日期时间'},
        {value: DataType.ARRAY, label: '数组'},
        {value: DataType.OBJECT, label: '对象'},
    ], []);

    const {data: dataSourcesData, isLoading: dataSourcesLoading} = useDataSources({
        status: DataSourceStatus.ACTIVE
    });

    const datasourceOptions = useMemo(() => {
        if (!dataSourcesData?.items) return [];
        return dataSourcesData.items.map((ds) => ({
            value: ds.id,
            label: ds.name,
        }));
    }, [dataSourcesData]);

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
            width: 120,
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
            width: 120,
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
            render: (_: unknown, record: { key: number }) => (
                <Form.Item
                    name={[record.key, 'isNullable']}
                    valuePropName="checked"
                    style={{margin: 0}}
                    dependencies={[[record.key, 'isPrimaryKey']]}
                    rules={[{
                        validator: async (_, value) => {
                            const column = form.getFieldValue(['columns', record.key]) || {};
                            if (column.isPrimaryKey === true && value === true) {
                                return Promise.reject('主键字段不能为空');
                            }
                            return Promise.resolve();
                        }
                    }]}
                >
                    <IsNullableCheckbox rowIndex={record.key} form={form}/>
                </Form.Item>
            )
        },
        {
            title: '主键',
            dataIndex: 'isPrimaryKey',
            render: (_: unknown, record: { key: number }) => (
                <Form.Item
                    name={[record.key, 'isPrimaryKey']}
                    valuePropName="checked"
                    style={{margin: 0}}
                >
                    <PrimaryKeyCheckbox rowIndex={record.key} form={form}/>
                </Form.Item>
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
            width: 70,
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
            title: '',
            width: 40,
            render: (_: unknown, record: { key: number }) => (
                <DeleteButton rowIndex={record.key} form={form}/>
            )
        }
    ], [form, validateColumnName, dataTypeOptions]);

    return (
        <>
            <BaseDrawer
                title={<Space>新建数据模型</Space>}
                onClose={onClose}
                open={visible}
                size="xl"
                onOk={handleSubmit}
                confirmLoading={loading}
                okText={MESSAGES.COMMON.CREATE}
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
                            <Select placeholder="请选择数据源" options={datasourceOptions}
                                    loading={dataSourcesLoading}/>
                        </Form.Item>

                        <Form.Item
                            name="tableName"
                            label="表名"
                            rules={[
                                {max: 255, message: '表名长度不能超过255个字符'}
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

                    <Form.Item>
                        <Flex justify="space-between" align="center" style={{marginBottom: 8}}>
                            <span>列定义</span>
                            <Space>
                                <Popconfirm
                                    title={MESSAGES.DATA_MODEL.CLEAR_COLUMNS_TITLE}
                                    description={MESSAGES.DATA_MODEL.CLEAR_COLUMNS_CONTENT}
                                    onConfirm={() => form.setFieldsValue({columns: []})}
                                    okText={MESSAGES.COMMON.OK}
                                    cancelText={MESSAGES.COMMON.CANCEL}
                                >
                                    <Button type="text" icon={<ClearOutlined/>}>清除全部</Button>
                                </Popconfirm>
                                <Button type="text" icon={<CodeOutlined/>} onClick={() => setSqlModalVisible(true)}>从SQL导入</Button>
                            </Space>
                        </Flex>
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
                                        tableLayout="fixed"
                                        footer={() => (
                                            <Button
                                                type="dashed"
                                                onClick={() => {
                                                    const columns = form.getFieldValue('columns') as ModelColumnCreateDTO[] | undefined;
                                                    const newColumn: ModelColumnCreateDTO = {
                                                        name: '',
                                                        displayName: '',
                                                        dataType: DataType.STRING,
                                                        length: undefined,
                                                        precision: undefined,
                                                        scale: undefined,
                                                        isNullable: true,
                                                        defaultValue: undefined,
                                                        description: '',
                                                        orderIndex: fields.length,
                                                        isPrimaryKey: false,
                                                        feature: undefined
                                                    };
                                                    form.setFieldsValue({
                                                        columns: columns ? [...columns, newColumn] : [newColumn]
                                                    });
                                                }}
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
        
        <SqlImportModal
            open={sqlModalVisible}
            sqlDialect={sqlDialect}
            sqlInput={sqlInput}
            parsing={parsing}
            onSqlDialectChange={setSqlDialect}
            onSqlInputChange={setSqlInput}
            onCancel={() => setSqlModalVisible(false)}
            onImport={handleSqlImport}
        />
    </>
);
}

export default CreateDataModelDrawer;
