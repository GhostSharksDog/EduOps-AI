import React, {useMemo, useState} from 'react';
import {Button, Col, Divider, Form, Input, Row, Select, Space, Steps, Switch, theme, TreeSelect} from 'antd';
import {ArrowLeftOutlined, ArrowRightOutlined, MinusCircleOutlined, PlusOutlined, TagOutlined} from '@ant-design/icons';
import BaseDrawer from '@/shared/ui/BaseDrawer/index';
import {RuleType, TagValueType, UpdateCycle} from '@/shared/enums/index';
import {log} from "@/platform/logger";
import {CreateTagDTO} from "@/modules/tag/contracts/schemas/request/tag/createTagSchema";
import {useDataModels} from '@/modules/data/client';
import {useTargetTables} from '@/modules/tag/ui/tags/target-tables/hooks/useTargetTableManagement';
import {useTargetTableManagementStore} from '@/modules/tag/ui/state/targetTableManagementStore';
import {DataModelStatus} from '@/shared/enums/data-models/DataModelStatus';
import {TargetTableStatus} from '@/modules/tag/domain/entities/TargetTable';
import type {TagCategoryVO} from '@/modules/tag/contracts/schemas/response/tag-category/index';
import dynamic from 'next/dynamic';
import type {TableSchema} from '@/shared/ui/ClickHouseSQLEditor/index';
import styles from './CreateTagDrawer.module.css';
import {useBitmapTables} from '@/modules/tag/ui/tags/bitmap/hooks/useBitmapManagement';

const ClickHouseSQLEditor = dynamic(
    () => import('@/shared/ui/ClickHouseSQLEditor/index'),
    {ssr: false, loading: () => <div>Loading SQL Editor...</div>}
);

interface CreateTagDrawerProps {
    visible: boolean;
    onCancel: () => void;
    onOk: (values: CreateTagDTO) => Promise<void>;
    categories: TagCategoryVO[];
    loading?: boolean;
}

const CreateTagDrawer: React.FC<CreateTagDrawerProps> = ({
    visible,
    onCancel,
    onOk,
    categories,
    loading = false,
}) => {
    const {token} = theme.useToken();
    const [form] = Form.useForm();
    const [currentStep, setCurrentStep] = useState(0);
    const [sqlError, setSqlError] = useState<{message: string} | null>(null);
    const [cascadeSteps, setCascadeSteps] = useState<Array<{order: number; sql: string; targetTableId?: string}>>([]);
    const [cascadeStepErrors, setCascadeStepErrors] = useState<Record<number, string | null>>({});

    const {data: dataModelsData, isLoading: dataModelsLoading} = useDataModels({
        page: 1,
        pageSize: 100,
        status: DataModelStatus.ACTIVE,
    });

    const {data: targetTablesData, isLoading: targetTablesLoading} = useTargetTables({
        page: 1,
        pageSize: 100
    });
    const {openCreateDrawer: openTargetTableCreateDrawer, lastCreatedTargetTableId, setLastCreatedTargetTableId} = useTargetTableManagementStore();

    const {data: bitmapTablesData, isLoading: bitmapTablesLoading} = useBitmapTables({status: 'ACTIVE'});

    const dataModelOptions = useMemo(() => {
        if (!dataModelsData?.items) return [];
        return dataModelsData.items.map((model) => ({
            value: model.id,
            label: model.name,
        }));
    }, [dataModelsData]);

    const selectedDataModelIds = Form.useWatch('dataModelIds', form);
    const selectedRuleType = Form.useWatch('ruleType', form);
    const selectedBitmapTableId = Form.useWatch(['bitConfig', 'bitmapTableId'], form);
    const selectedDataType = Form.useWatch('dataType', form);

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

    const tableSchema = useMemo((): TableSchema[] => {
        if (!selectedDataModelIds?.length || !dataModelsData?.items) {
            return [];
        }
        return dataModelsData.items
            .filter(m => selectedDataModelIds.includes(m.id))
            .map(model => ({
                name: model.tableName || model.name,
                columns: model.columns.map(col => ({
                    name: col.name,
                    type: col.dataType,
                })),
            }));
    }, [selectedDataModelIds, dataModelsData]);

    const filteredTargetTables = useMemo(() => {
        if (!targetTablesData?.items) return [];
        return targetTablesData.items.filter(table =>
            table.status === TargetTableStatus.CREATED || table.status === TargetTableStatus.ACTIVE
        );
    }, [targetTablesData]);

    const filteredTargetTableOptions = useMemo(() => {
        return filteredTargetTables.map(table => ({
            value: table.id,
            label: `${table.tableName} (${table.status})`,
        }));
    }, [filteredTargetTables]);

    React.useEffect(() => {
        if (lastCreatedTargetTableId && filteredTargetTables.some(t => t.id === lastCreatedTargetTableId)) {
            form.setFieldValue('targetTableId', lastCreatedTargetTableId);
            setLastCreatedTargetTableId(null);
        }
    }, [lastCreatedTargetTableId, filteredTargetTables, form, setLastCreatedTargetTableId]);

    React.useEffect(() => {
        if (selectedRuleType !== RuleType.CASCADE) {
            setCascadeSteps([]);
            setCascadeStepErrors({});
        }
    }, [selectedRuleType]);

    const steps = [
        {title: '基础信息', content: '填写标签基本信息'},
        {title: '规则配置', content: '配置标签计算规则'},
        {title: '版本信息', content: '设置版本号及描述'},
        {title: 'Bit 配置', content: '配置 Bit 位置（可选）'},
    ];

    const getCurrentStepFields = (step: number): string[] => {
        switch (step) {
            case 0:
                return ['name', 'dataType', 'updateCycle', 'categoryId'];
            case 1:
                if (selectedRuleType === RuleType.CASCADE) {
                    return ['ruleType', 'dataModelIds'];
                }
                return ['ruleType', 'dataModelIds', 'ruleContent'];
            case 2:
                return ['version'];
            case 3:
                return ['bitConfig'];
            default:
                return [];
        }
    };

    const handlePrev = () => {
        setCurrentStep(prev => prev - 1);
    };

    const handleNext = () => {
        const currentStepFields = getCurrentStepFields(currentStep);
        form.validateFields(currentStepFields).then(() => {
            if (currentStep === 1 && selectedRuleType === RuleType.CASCADE && cascadeSteps.length === 0) {
                log.error('CASCADE 类型需要至少一个步骤');
                return;
            }
            setCurrentStep(prev => prev + 1);
        }).catch((error) => {
            log.error('表单验证失败:', error);
        });
    };

    const handleFinish = () => {
        return form.validateFields().then((values) => {
            if (values.ruleType === RuleType.CASCADE && cascadeSteps.length === 0) {
                log.error('CASCADE 类型需要至少一个步骤');
                return;
            }

            if (values.ruleType === RuleType.SQL && sqlError) {
                log.error('SQL 语法错误，无法提交');
                return;
            }

            if (values.ruleType === RuleType.CASCADE && Object.values(cascadeStepErrors).some(e => e !== null)) {
                log.error('存在步骤语法错误，无法提交');
                return;
            }

            const rule: CreateTagDTO['rule'] = values.ruleType ? {
                ruleType: values.ruleType,
                ruleContent: values.ruleType === RuleType.SQL ? values.ruleContent : undefined,
                steps: values.ruleType === RuleType.CASCADE ? cascadeSteps : undefined,
                dataModelIds: values.dataModelIds,
                feature: {},
            } : undefined;

            const bitConfig = values.bitConfig?.bitmapTableId ? {
                bitmapTableId: values.bitConfig.bitmapTableId,
                bitPosition: values.bitConfig.bitPosition,
            } : undefined;

            const submitData: CreateTagDTO = {
                name: values.name,
                dataType: values.dataType,
                categoryId: values.categoryId,
                description: values.description,
                isPublic: values.isPublic,
                updateCycle: values.updateCycle,
                rule,
                version: values.version,
                feature: values.feature || {},
                targetTableId: values.targetTableId,
                bitConfig,
                enumValues: values.dataType === TagValueType.ENUM ? values.enumValues : undefined,
            };

            return onOk(submitData);
        }).catch((error) => {
            log.error('表单验证失败:', error);
        });
    };

    const handleCancel = () => {
        form.resetFields();
        setCurrentStep(0);
        setSqlError(null);
        setCascadeSteps([]);
        setCascadeStepErrors({});
        onCancel();
    };

    const addCascadeStep = () => {
        const newOrder = cascadeSteps.length + 1;
        setCascadeSteps([...cascadeSteps, {order: newOrder, sql: '', targetTableId: undefined}]);
    };

    const removeCascadeStep = (index: number) => {
        const newSteps = cascadeSteps.filter((_, i) => i !== index);
        setCascadeSteps(newSteps.map((s, i) => ({...s, order: i + 1})));
        const newErrors: Record<number, string | null> = {};
        cascadeSteps.forEach((s, i) => {
            if (i !== index && cascadeStepErrors[s.order]) {
                newErrors[i < index ? s.order : i + 1] = cascadeStepErrors[s.order];
            }
        });
        setCascadeStepErrors(newErrors);
    };

    const updateCascadeStep = (index: number, sql: string) => {
        const newSteps = [...cascadeSteps];
        newSteps[index] = {...newSteps[index], sql};
        setCascadeSteps(newSteps);
    };

    const updateCascadeStepTargetTable = (index: number, targetTableId: string | undefined) => {
        const newSteps = [...cascadeSteps];
        newSteps[index] = {...newSteps[index], targetTableId};
        setCascadeSteps(newSteps);
    };

    const handleCascadeStepError = (order: number, error: { message: string } | null) => {
        setCascadeStepErrors(prev => ({
            ...prev,
            [order]: error?.message || null
        }));
    };

    return (
        <BaseDrawer
            title={<Space><TagOutlined/> 新建标签</Space>}
            open={visible}
            onClose={handleCancel}
            size="lg"
            bodyPadding="compact"
            footerMode="none"
        >
            <Space orientation="vertical" style={{width: '100%'}} size="large">
                <Steps
                    current={currentStep}
                    orientation="horizontal"
                    size="small"
                    items={steps}
                />

                <Form
                    form={form}
                    layout="vertical"
                    initialValues={{
                        dataType: TagValueType.BOOLEAN,
                        updateCycle: UpdateCycle.DAILY,
                        isPublic: false,
                        ruleType: RuleType.SQL,
                        dataModelIds: []
                    }}
                >
                    <div className={currentStep === 0 ? styles.stepContent : styles.stepContentHidden}>
                        <Row gutter={12}>
                            <Col span={16}>
                                <Form.Item
                                    name="name"
                                    label="标签名称"
                                    rules={[{required: true, message: '请输入标签名称'}]}
                                    style={{marginBottom: token.marginXS}}
                                >
                                    <Input placeholder="例如：VIP用户" style={{height: token.controlHeight}}/>
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="isPublic"
                                    label="是否公开"
                                    valuePropName="checked"
                                    style={{marginBottom: token.marginXS}}
                                >
                                    <Switch/>
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={12}>
                            <Col span={8}>
                                <Form.Item
                                    name="dataType"
                                    label="值类型"
                                    rules={[{required: true}]}
                                    style={{marginBottom: token.marginXS}}
                                >
                                    <Select style={{width: '100%', height: token.controlHeight}}>
                                        <Select.Option value={TagValueType.STRING}>
                                            STRING
                                        </Select.Option>
                                        <Select.Option value={TagValueType.NUMBER}>
                                            NUMBER
                                        </Select.Option>
                                        <Select.Option value={TagValueType.BOOLEAN}>
                                            BOOLEAN
                                        </Select.Option>
                                        <Select.Option value={TagValueType.DATE}>
                                            DATE
                                        </Select.Option>
                                        <Select.Option value={TagValueType.DATETIME}>
                                            DATETIME
                                        </Select.Option>
                                        <Select.Option value={TagValueType.ENUM}>
                                            ENUM
                                        </Select.Option>
                                    </Select>
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="updateCycle"
                                    label="更新周期"
                                    rules={[{required: true}]}
                                    style={{marginBottom: token.marginXS}}
                                >
                                    <Select style={{width: '100%', height: token.controlHeight}}>
                                        <Select.Option value={UpdateCycle.REALTIME}>实时更新</Select.Option>
                                        <Select.Option value={UpdateCycle.HOURLY}>每小时更新</Select.Option>
                                        <Select.Option value={UpdateCycle.DAILY}>每日更新</Select.Option>
                                        <Select.Option value={UpdateCycle.WEEKLY}>每周更新</Select.Option>
                                        <Select.Option value={UpdateCycle.MONTHLY}>每月更新</Select.Option>
                                    </Select>
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="categoryId"
                                    label="所属分类"
                                    rules={[{required: true, message: '请选择所属分类'}]}
                                    style={{marginBottom: token.marginXS}}
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
                            </Col>
                        </Row>

                        <Form.Item
                            noStyle
                            shouldUpdate={(prev, cur) => prev.dataType !== cur.dataType}
                        >
                            {({ getFieldValue }) => {
                                const dt = getFieldValue('dataType');
                                const isEnum = dt === TagValueType.ENUM;
                                return (
                                    <Form.Item
                                        name="enumValues"
                                        label="枚举值列表"
                                        rules={isEnum ? [{
                                            required: true,
                                            message: '请输入至少一个枚举值',
                                            type: 'array',
                                            min: 1,
                                        }] : []}
                                        hidden={!isEnum}
                                        style={{marginBottom: token.marginXS}}
                                    >
                                        <Select
                                            mode="tags"
                                            placeholder="输入枚举值后按回车添加（如：低、中、高）"
                                            style={{width: '100%'}}
                                            tokenSeparators={[',', '，', '、']}
                                        />
                                    </Form.Item>
                                );
                            }}
                        </Form.Item>

                        <Form.Item
                            name="description"
                            label="描述"
                            style={{marginBottom: 0}}
                        >
                            <Input.TextArea rows={3} placeholder="请输入标签描述"/>
                        </Form.Item>
                    </div>

                    <div className={currentStep === 1 ? styles.stepContent : styles.stepContentHidden}>
                        <Row gutter={12}>
                            <Col span={12}>
                                <Form.Item
                                    name={'ruleType'}
                                    label="规则类型"
                                    rules={[{required: true, message: '请选择规则类型'}]}
                                    style={{marginBottom: token.marginXS}}
                                >
                                    <Select style={{width: '100%', height: token.controlHeight}}>
                                        {Object.values(RuleType).map(type => (
                                            <Select.Option key={type} value={type}>{type}</Select.Option>
                                        ))}
                                    </Select>
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name={'dataModelIds'}
                                    label="数据模型"
                                    rules={[{required: true, message: '请至少选择一个数据模型'}]}
                                    style={{marginBottom: token.marginXS}}
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
                                        }/>
                                </Form.Item>
                            </Col>
                        </Row>

                        <Form.Item
                            name="targetTableId"
                            label="目标表"
                            tooltip="目标表为可选项。创建标签后可创建目标表，然后在标签编辑中关联。"
                            rules={[{required: false}]}
                            style={{marginBottom: token.marginXS}}
                        >
                            <Select
                                style={{width: '100%', height: token.controlHeight}}
                                placeholder={filteredTargetTableOptions.length === 0 ? '暂无可用目标表' : '选择目标表'}
                                loading={targetTablesLoading}
                                options={filteredTargetTableOptions}
                                allowClear
                                showSearch
                                filterOption={(input, option) =>
                                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                                popupRender={(menu) => (
                                    <>
                                        {menu}
                                        <Divider style={{margin: '8px 0'}}/>
                                        <Button type="link" style={{padding: '0 8px'}}
                                                onClick={openTargetTableCreateDrawer}>
                                            + 新建目标表
                                        </Button>
                                    </>
                                )}
                            />
                        </Form.Item>

                        {selectedRuleType === RuleType.SQL && (
                            <Form.Item
                                name={'ruleContent'}
                                label="规则内容"
                                rules={[{required: true, message: '请输入规则内容'}]}
                                style={{marginBottom: 0}}
                                validateStatus={sqlError ? 'error' : undefined}
                                help={sqlError?.message}
                            >
                                <ClickHouseSQLEditor
                                    tables={tableSchema}
                                    onChange={(value) => form.setFieldValue('ruleContent', value)}
                                    onError={(error) => {
                                        setSqlError(error ? {message: error.message} : null);
                                    }}
                                    placeholder="SELECT column1, column2 FROM table_name WHERE condition"
                                    height={400}
                                />
                            </Form.Item>
                        )}

                        {selectedRuleType === RuleType.CASCADE && (
                            <div style={{marginTop: token.marginSM}}>
                                <div style={{
                                    marginBottom: token.marginSM,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <span style={{fontWeight: 500}}>级联步骤</span>
                                    <Button
                                        type="dashed"
                                        size="small"
                                        icon={<PlusOutlined/>}
                                        onClick={addCascadeStep}
                                    >
                                        添加步骤
                                    </Button>
                                </div>

                                {cascadeSteps.map((step, index) => (
                                    <div key={step.order} style={{marginBottom: token.marginMD}}>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginBottom: token.marginXS
                                        }}>
                                            <span>步骤 {step.order}</span>
                                            <Button
                                                type="text"
                                                size="small"
                                                danger
                                                icon={<MinusCircleOutlined/>}
                                                onClick={() => removeCascadeStep(index)}
                                            >
                                                删除
                                            </Button>
                                        </div>
                                        <div style={{marginBottom: token.marginXS}}>
                                            <Select
                                                placeholder="选择目标表（可选，不选则使用默认表名）"
                                                value={step.targetTableId}
                                                onChange={(value) => updateCascadeStepTargetTable(index, value)}
                                                options={filteredTargetTableOptions}
                                                allowClear
                                                style={{width: '100%'}}
                                                size="small"
                                            />
                                        </div>
                                        <ClickHouseSQLEditor
                                            tables={tableSchema}
                                            value={step.sql}
                                            onChange={(value) => updateCascadeStep(index, value)}
                                            onError={(error) => handleCascadeStepError(step.order, error)}
                                            placeholder={`SELECT entity_id, value FROM source_table WHERE condition`}
                                            height={200}
                                        />
                                        {cascadeStepErrors[step.order] && (
                                            <div style={{color: token.colorError, fontSize: 12, marginTop: 4}}>
                                                {cascadeStepErrors[step.order]}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {cascadeSteps.length === 0 && (
                                    <div style={{
                                        padding: token.paddingLG,
                                        textAlign: 'center',
                                        color: token.colorTextSecondary,
                                        border: `1px dashed ${token.colorBorder}`,
                                        borderRadius: token.borderRadius
                                    }}>
                                        点击「添加步骤」创建级联物化视图
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className={currentStep === 2 ? styles.stepContent : styles.stepContentHidden}>
                        <Row gutter={12}>
                            <Col span={24}>
                                <Form.Item
                                    name={['version', 'version']}
                                    label="版本号"
                                    rules={[{required: true, message: '请输入版本号'}]}
                                    style={{marginBottom: token.marginXS}}
                                >
                                    <Input placeholder="例如：v1.0.0" style={{height: token.controlHeight}}/>
                                </Form.Item>
                            </Col>
                            <Col span={24}>
                                <Form.Item
                                    name={['version', 'description']}
                                    label="版本描述"
                                    style={{marginBottom: 0}}
                                >
                                    <Input.TextArea rows={3} placeholder="请输入版本描述"/>
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>

                    <div className={currentStep === 3 ? styles.stepContent : styles.stepContentHidden}>
                        {selectedDataType === TagValueType.ENUM && (
                            <div style={{
                                padding: `${token.paddingSM}px ${token.paddingMD}px`,
                                marginBottom: token.marginSM,
                                background: token.colorInfoBg,
                                borderRadius: token.borderRadius,
                                color: token.colorInfoText,
                                fontSize: 13,
                            }}>
                                ENUM 类型标签激活时会根据枚举值数量自动分配 Bit 位置，无需手动配置。
                            </div>
                        )}
                        <Row gutter={12}>
                            <Col span={12}>
                                <Form.Item
                                    name={['bitConfig', 'bitmapTableId']}
                                    label="Bitmap 表"
                                    style={{marginBottom: token.marginSM}}
                                >
                                    <Select
                                        style={{width: '100%', height: token.controlHeight}}
                                        placeholder="选择 Bitmap 表（可选）"
                                        loading={bitmapTablesLoading}
                                        options={bitmapTableOptions}
                                        allowClear
                                        showSearch
                                        disabled={selectedDataType === TagValueType.ENUM}
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
                                    style={{marginBottom: token.marginSM}}
                                >
                                    <Select
                                        style={{width: '100%', height: token.controlHeight}}
                                        placeholder="选择 Bit 位置"
                                        options={availableBitOptions}
                                        allowClear
                                        disabled={selectedDataType === TagValueType.ENUM || !selectedBitmapTableId}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>

                        {selectedBitmapTableId && availableBitOptions.length === 0 && (
                            <div style={{color: token.colorWarningText, fontSize: 12}}>
                                该表已无可用 Bit 位置
                            </div>
                        )}

                        {!selectedBitmapTableId && (
                            <div style={{color: token.colorTextSecondary, fontSize: 12}}>
                                提示：Bit 配置为可选项，如不配置可在创建标签后在 Bitmap 管理页面进行分配
                            </div>
                        )}
                    </div>
                </Form>

                <Space className={styles.footer} size="middle">
                    {currentStep > 0 && (
                        <Button icon={<ArrowLeftOutlined/>} onClick={handlePrev}
                                style={{height: token.controlHeight}}>
                            上一步
                        </Button>
                    )}

                    {currentStep < steps.length - 1 && (
                        <Button type="primary" icon={<ArrowRightOutlined/>} onClick={handleNext}
                                style={{height: token.controlHeight}}>
                            下一步
                        </Button>
                    )}

                    {currentStep === steps.length - 1 && (
                        <Button type="primary" loading={loading} onClick={handleFinish}
                                style={{height: token.controlHeight}}>
                            完成
                        </Button>
                    )}

                    <Button onClick={handleCancel} style={{height: token.controlHeight}}>
                        取消
                    </Button>
                </Space>
            </Space>
        </BaseDrawer>
    );
};

export default CreateTagDrawer;
