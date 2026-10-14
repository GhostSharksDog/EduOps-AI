'use client';

import React, {useEffect, useMemo, useState, useCallback} from 'react';
import {useSearchParams} from 'next/navigation';
import {Modal, Space, Button, Switch, Typography, theme, App} from 'antd';
import {MESSAGES} from '@/shared/messages/index';
import {
    CheckCircleOutlined,
    CheckSquareOutlined,
    CloseOutlined,
    DeleteOutlined,
    PlayCircleOutlined,
    StopOutlined,
    TagOutlined
} from '@ant-design/icons';
import {globalMessage} from '@/shared/lib/message';
import {useTagListStore} from '@/modules/tag/ui/state/tagListStore';
import {useTargetTableManagementStore} from '@/modules/tag/ui/state/targetTableManagementStore';
import type {TagVO} from '@/modules/tag/contracts/schemas/response/tag/index';
import {
    useTags,
    useTagCategoriesSimple,
    useCreateTag,
    useUpdateTag,
    useUpdateTagRule,
    useDeleteTag,
    useActivateTag,
    useDeactivateTag,
    useResumeTag,
    useDeprecateTag,
} from '@/modules/tag/ui/tags/hooks/useTags';
import PageHeader from '@/shared/ui/dashboard/PageHeader';
import PageContainer from '@/shared/ui/dashboard/PageContainer';
import TableCard from '@/shared/ui/dashboard/TableCard/index';
import {RefreshButton} from '@/shared/ui/dashboard/RefreshButton/index';
import BatchOperationModal from '@/shared/ui/dashboard/BatchOperationModal/BatchOperationModal';
import FilterBar from '@/modules/tag/ui/tags/components/FilterBar';
import TagTable from '@/modules/tag/ui/tags/components/TagTable';
import CreateTagDrawer from '@/modules/tag/ui/tags/components/CreateTagDrawer';
import EditTagDrawer from '@/modules/tag/ui/tags/components/EditTagDrawer';
import EditTagRuleDrawer from '@/modules/tag/ui/tags/components/EditTagRuleDrawer';
import TagVersionDrawer from '@/modules/tag/ui/tags/components/TagVersionDrawer';
import ValueQueryDrawer from '@/modules/tag/ui/tags/components/ValueQueryDrawer';
import CreateTargetTableDrawer from '@/modules/tag/ui/tags/target-tables/components/CreateTargetTableDrawer';
import {log} from '@/platform/logger';
import type {CreateTagDTO, UpdateTagDTO} from '@/modules/tag/contracts/schemas/request/tag/index';
import {useBatchSelection} from '@/shared/hooks/useBatchSelection';

const TagListView: React.FC = () => {
    const searchParams = useSearchParams();
    const {token} = theme.useToken();
    const createDrawerKey = useTargetTableManagementStore(s => s.createDrawerKey);
    const {modal} = App.useApp();

    const {
        page,
        pageSize,
        isModalVisible,
        isEditModalVisible,
        editingTag,
        isEditRuleModalVisible,
        editingRuleTag,
        versionDrawerVisible,
        selectedTagId,
        selectedTagName,
        searchText,
        statusFilter,
        categoryFilter,
        dataTypeFilter,
        updateCycleFilter,
        isPublicFilter,
        statusConfirmModal,
        setPage,
        setPageSize,
        setSearchText,
        setStatusFilter,
        setCategoryFilter,
        setDataTypeFilter,
        setUpdateCycleFilter,
        setIsPublicFilter,
        openCreateModal,
        closeCreateModal,
        openEditModal,
        closeEditModal,
        openEditRuleModal,
        closeEditRuleModal,
        openVersionDrawer,
        closeVersionDrawer,
        openStatusConfirmModal,
        closeStatusConfirmModal,
        valueQueryDrawerVisible,
        valueQueryTag,
        openValueQueryDrawer,
        closeValueQueryDrawer,
    } = useTagListStore();

    const {data: tagsResponse, isLoading: tagsLoading, refetch: refetchTags} = useTags({
        page,
        pageSize,
        categoryId: categoryFilter,
    });
    const {data: categoriesResponse} = useTagCategoriesSimple();

    const createTagMutation = useCreateTag();
    const updateTagMutation = useUpdateTag();
    const updateTagRuleMutation = useUpdateTagRule();
    const deleteTagMutation = useDeleteTag();
    const activateTagMutation = useActivateTag();
    const deactivateTagMutation = useDeactivateTag();
    const resumeTagMutation = useResumeTag();
    const deprecateTagMutation = useDeprecateTag();

    const data = useMemo(() => tagsResponse?.items ?? [], [tagsResponse?.items]);
    const categoryItems = useMemo(() => categoriesResponse?.items ?? [], [categoriesResponse?.items]);
    const loading = tagsLoading || createTagMutation.isPending || updateTagMutation.isPending || deleteTagMutation.isPending;

    const isRowSelectable = useCallback((record: TagVO) => {
        return record.status === 'DRAFT';
    }, []);

    const batchSelection = useBatchSelection<TagVO>({
        enableBatchMode: true,
        getRowKey: (row) => row.id,
    });

    const [isBatchDeleteModalVisible, setIsBatchDeleteModalVisible] = useState(false);
    const [isBatchDeleting, setIsBatchDeleting] = useState(false);
    const [releaseBit, setReleaseBit] = useState(false);

    const handleBatchSelect = useCallback(() => {
        const selectableRows = data.filter(isRowSelectable);
        batchSelection.enterBatchMode(selectableRows);
    }, [data, isRowSelectable, batchSelection]);

    const handleBatchDelete = useCallback(() => {
        setIsBatchDeleteModalVisible(true);
    }, []);

    const handleBatchDeleteOk = async () => {
        setIsBatchDeleting(true);
        const results = await Promise.allSettled(
            batchSelection.selectedRowKeys.map(id => deleteTagMutation.mutateAsync(id))
        );

        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failCount = results.filter(r => r.status === 'rejected').length;

        if (failCount === 0) {
            globalMessage.success(`成功删除 ${successCount} 个标签`);
        } else {
            globalMessage.warning(`成功删除 ${successCount} 个标签，${failCount} 个失败`);
        }

        setIsBatchDeleting(false);
        setIsBatchDeleteModalVisible(false);
        batchSelection.exitBatchMode();
        refetchTags();
    };

    const hasSelectableRows = useMemo(() => data.some(isRowSelectable), [data, isRowSelectable]);

    useEffect(() => {
        const categoryId = searchParams.get('categoryId');
        if (categoryId) {
            setCategoryFilter(categoryId);
        }
    }, [searchParams, setCategoryFilter]);

    const handleCreate = () => {
        openCreateModal();
    };

    const handleOpenVersionDrawer = (record: TagVO) => {
        openVersionDrawer(record.id, record.name);
    };

    const handleDelete = (id: string) => {
        modal.confirm({
            title: MESSAGES.COMMON.DELETE_CONFIRM_TITLE,
            content: MESSAGES.TAGS.DELETE_CONFIRM_CONTENT,
            okText: MESSAGES.COMMON.OK,
            cancelText: MESSAGES.COMMON.CANCEL,
            onOk: async () => {
                try {
                    await deleteTagMutation.mutateAsync(id);
                } catch (error) {
                    log.error('Failed to delete tag', error);
                }
            },
        });
    };

    const handleEdit = (record: TagVO) => {
        openEditModal(record);
    };

    const handleEditRule = (record: TagVO) => {
        openEditRuleModal(record);
    };

    const handleStatusAction = (action: 'activate' | 'deactivate' | 'resume' | 'deprecate', record: TagVO) => {
        openStatusConfirmModal(action, record);
    };

    const handleValueQuery = (record: TagVO) => {
        openValueQueryDrawer(record);
    };

    const handleCreateTag = async (values: CreateTagDTO) => {
        try {
            await createTagMutation.mutateAsync(values);
            closeCreateModal();
        } catch (error) {
            log.error('Failed to create tag', error);
        }
    };

    const handleUpdateTag = async (values: Record<string, unknown>) => {
        if (!editingTag) return;
        try {
            await updateTagMutation.mutateAsync({
                tagId: editingTag.id,
                tagData: {
                    id: editingTag.id,
                    categoryId: values.categoryId as string,
                    name: values.name as string,
                    dataType: values.dataType as UpdateTagDTO['dataType'],
                    description: values.description as string,
                    isPublic: values.isPublic as boolean,
                    updateCycle: values.updateCycle as UpdateTagDTO['updateCycle'],
                    rule: values.rule as UpdateTagDTO['rule'],
                    bitConfig: values.bitConfig as UpdateTagDTO['bitConfig'],
                    targetTableId: values.targetTableId as string | undefined,
                },
            });
            closeEditModal();
        } catch (error) {
            log.error('Failed to update tag', error);
        }
    };

    const handleUpdateTagRule = async (values: Record<string, unknown>) => {
        if (!editingRuleTag) return;
        try {
            await updateTagRuleMutation.mutateAsync({
                tagId: editingRuleTag.id,
                ruleData: {
                    ruleType: values.ruleType as string,
                    ruleContent: values.ruleContent as string | undefined,
                    dataModelIds: values.dataModelIds as string[] | undefined,
                },
            });
            globalMessage.success('标签规则已更新，将创建新版本');
            closeEditRuleModal();
        } catch (error) {
            log.error('Failed to update tag rule', error);
        }
    };

    const confirmStatusAction = async () => {
        const {action, tag} = statusConfirmModal;
        if (!action || !tag) return;

        try {
            switch (action) {
                case 'activate':
                    await activateTagMutation.mutateAsync(tag.id);
                    break;
                case 'deactivate':
                    await deactivateTagMutation.mutateAsync({tagId: tag.id, releaseBit});
                    break;
                case 'resume':
                    await resumeTagMutation.mutateAsync(tag.id);
                    break;
                case 'deprecate':
                    await deprecateTagMutation.mutateAsync({tagId: tag.id});
                    break;
            }
            closeStatusConfirmModal();
            setReleaseBit(false);
        } catch (error) {
            log.error(`Failed to ${action} tag`, error);
        }
    };

    const getStatusConfirmConfig = () => {
        const {action, tag} = statusConfirmModal;
        if (!action || !tag) return null;

        const configs = {
            activate: {
                title: MESSAGES.TAGS.ACTIVATE_CONFIRM_TITLE,
                icon: <CheckCircleOutlined style={{color: '#52c41a'}} />,
                content: (
                    <div>
                        <p>确定要激活标签「{tag.name}」吗？</p>
                        <p>激活后将：</p>
                        <ul style={{margin: '8px 0', paddingLeft: 20}}>
                            <li>创建 ClickHouse 物化视图</li>
                            <li>开始按 {tag.updateCycle} 周期计算标签值</li>
                            <li>分配 Bitmap 位（如果是 Bitmap 类型）</li>
                        </ul>
                    </div>
                ),
            },
            deactivate: {
                title: MESSAGES.TAGS.DEACTIVATE_CONFIRM_TITLE,
                icon: <StopOutlined style={{color: '#faad14'}} />,
                content: (
                    <div>
                        <p>确定要停用标签「{tag.name}」吗？</p>
                        <p>停用后将：</p>
                        <ul style={{margin: '8px 0', paddingLeft: 20}}>
                            <li>暂停物化视图刷新</li>
                            <li>已计算的标签值保留</li>
                            <li>可随时恢复</li>
                        </ul>
                        {tag.bitConfig && (
                            <div style={{marginTop: 16, padding: '12px', background: token.colorBgContainer, borderRadius: token.borderRadius}}>
                                <Space>
                                    <Switch
                                        checked={releaseBit}
                                        onChange={setReleaseBit}
                                        size="small"
                                    />
                                    <Typography.Text>
                                        同时释放 Bitmap 位（推荐）
                                    </Typography.Text>
                                </Space>
                                <Typography.Text type="secondary" style={{display: 'block', marginTop: 8, fontSize: 12}}>
                                    释放后恢复标签时需要重新分配 Bitmap 位
                                </Typography.Text>
                            </div>
                        )}
                    </div>
                ),
            },
            resume: {
                title: MESSAGES.TAGS.RESUME_CONFIRM_TITLE,
                icon: <PlayCircleOutlined style={{color: '#1890ff'}} />,
                content: (
                    <div>
                        <p>确定要恢复标签「{tag.name}」吗？</p>
                        <p>恢复后将：</p>
                        <ul style={{margin: '8px 0', paddingLeft: 20}}>
                            <li>恢复物化视图刷新</li>
                            <li>继续按 {tag.updateCycle} 周期计算标签值</li>
                        </ul>
                    </div>
                ),
            },
            deprecate: {
                title: '废弃标签',
                icon: <StopOutlined style={{color: '#ff4d4f'}} />,
                content: (
                    <div>
                        <p>确定要废弃标签「{tag.name}」吗？</p>
                        <p>废弃后将：</p>
                        <ul style={{margin: '8px 0', paddingLeft: 20}}>
                            <li>标签状态变为「已废弃」</li>
                            <li>保留所有数据和bitmap配置</li>
                            <li>可随时删除</li>
                        </ul>
                    </div>
                ),
            },
        };

        return configs[action];
    };

    const filteredData = useMemo(() => data.filter(item => {
        const matchName = item.name.toLowerCase().includes(searchText.toLowerCase());
        const matchStatus = statusFilter ? item.status === statusFilter : true;
        const matchDataType = dataTypeFilter ? item.dataType === dataTypeFilter : true;
        const matchUpdateCycle = updateCycleFilter ? item.updateCycle === updateCycleFilter : true;
        const matchIsPublic = isPublicFilter !== undefined ? item.isPublic === isPublicFilter : true;
        return matchName && matchStatus && matchDataType && matchUpdateCycle && matchIsPublic;
    }), [data, searchText, statusFilter, dataTypeFilter, updateCycleFilter, isPublicFilter]);

    return (
        <PageContainer>
            <PageHeader
                title="标签列表"
                description="管理系统中的所有标签定义，支持标签的创建、编辑和批量管理"
                iconComponent={TagOutlined}
                showDefaultCreate
                onCreate={handleCreate}
            />

            <TableCard
                title="标签列表"
                icon={<TagOutlined />}
                actions={
                    <Space>
                        <RefreshButton onClick={() => refetchTags()} loading={loading} />
                        {batchSelection.isBatchMode ? (
                            <>
                                <Button
                                    icon={<CloseOutlined />}
                                    onClick={batchSelection.exitBatchMode}
                                >
                                    取消选择
                                </Button>
                                <Button
                                    type="primary"
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={handleBatchDelete}
                                    disabled={!batchSelection.hasSelection}
                                >
                                    批量删除 ({batchSelection.selectionCount})
                                </Button>
                            </>
                        ) : (
                            <Button
                                icon={<CheckSquareOutlined />}
                                onClick={handleBatchSelect}
                                disabled={!hasSelectableRows}
                            >
                                批量选择
                            </Button>
                        )}
                    </Space>
                }
                filter={
                    <FilterBar
                        searchText={searchText}
                        categoryFilter={categoryFilter}
                        statusFilter={statusFilter}
                        dataTypeFilter={dataTypeFilter}
                        updateCycleFilter={updateCycleFilter}
                        isPublicFilter={isPublicFilter}
                        categories={categoryItems}
                        onSearchTextChange={setSearchText}
                        onCategoryFilterChange={setCategoryFilter}
                        onStatusFilterChange={setStatusFilter}
                        onDataTypeFilterChange={setDataTypeFilter}
                        onUpdateCycleFilterChange={setUpdateCycleFilter}
                        onIsPublicFilterChange={setIsPublicFilter}
                    />
                }
                total={filteredData.length}
                table={
                    <TagTable
                        data={filteredData}
                        loading={loading}
                        page={page}
                        pageSize={pageSize}
                        onEdit={handleEdit}
                        onEditRule={handleEditRule}
                        onDelete={handleDelete}
                        onStatusAction={handleStatusAction}
                        onOpenVersionDrawer={handleOpenVersionDrawer}
                        onValueQuery={handleValueQuery}
                        onPageChange={setPage}
                        onPageSizeChange={setPageSize}
                        selectedRowKeys={batchSelection.computedSelectedRowKeys}
                        onSelectionChange={batchSelection.handleSelectionChange}
                        getCheckboxProps={(record) => ({
                            disabled: !isRowSelectable(record),
                        })}
                    />
                }
            />

            <CreateTagDrawer
                visible={isModalVisible}
                loading={loading}
                categories={categoryItems}
                onOk={handleCreateTag}
                onCancel={closeCreateModal}
            />

            <EditTagDrawer
                visible={isEditModalVisible}
                loading={loading}
                editingTag={editingTag}
                categories={categoryItems}
                onOk={handleUpdateTag}
                onCancel={closeEditModal}
            />

            <EditTagRuleDrawer
                visible={isEditRuleModalVisible}
                loading={updateTagRuleMutation.isPending}
                editingTag={editingRuleTag}
                onOk={handleUpdateTagRule}
                onCancel={closeEditRuleModal}
            />

            <TagVersionDrawer
                key={selectedTagId}
                visible={versionDrawerVisible}
                tagId={selectedTagId}
                tagName={selectedTagName}
                onClose={closeVersionDrawer}
            />

            <ValueQueryDrawer
                visible={valueQueryDrawerVisible}
                tag={valueQueryTag}
                onClose={closeValueQueryDrawer}
            />

            <Modal
                title={getStatusConfirmConfig()?.title}
                open={statusConfirmModal.visible}
                onOk={confirmStatusAction}
                onCancel={closeStatusConfirmModal}
                confirmLoading={loading}
                okText={MESSAGES.COMMON.CONFIRM}
                cancelText={MESSAGES.COMMON.CANCEL}
            >
                {getStatusConfirmConfig()?.content}
            </Modal>

            <BatchOperationModal
                open={isBatchDeleteModalVisible}
                operationType="delete"
                count={batchSelection.selectionCount}
                itemName="个标签"
                loading={isBatchDeleting}
                onConfirm={handleBatchDeleteOk}
                onCancel={() => setIsBatchDeleteModalVisible(false)}
            />

            <CreateTargetTableDrawer key={createDrawerKey} />
        </PageContainer>
    );
};

export default TagListView;
