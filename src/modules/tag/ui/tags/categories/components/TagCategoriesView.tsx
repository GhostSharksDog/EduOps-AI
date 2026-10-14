'use client';

import React, {useState, useCallback, useMemo} from 'react';
import {useRouter} from 'next/navigation';
import PageContainer from '@/shared/ui/dashboard/PageContainer';
import {Button, Space} from 'antd';
import axios from 'axios';
import {AppstoreOutlined, CheckSquareOutlined, CloseOutlined, DeleteOutlined} from '@ant-design/icons';
import {globalMessage} from '@/shared/lib/message';
import {MESSAGES} from '@/shared/messages/index';

import {
    useBatchDeleteTagCategories,
    useCreateTagCategory,
    useDeleteTagCategory,
    useTagCategories,
    useUpdateTagCategory
} from '@/modules/tag/ui/tags/categories/hooks/useTagCategories';
import CategoryTable from '@/modules/tag/ui/tags/categories/components/CategoryTable';
import CategoryFilter from '@/modules/tag/ui/tags/categories/components/CategoryFilter';
import PageHeader from '@/shared/ui/dashboard/PageHeader';
import CategoryDrawer from '@/modules/tag/ui/tags/categories/components/CategoryDrawer';
import type {TagCategoryListVO, TagCategoryVO} from '@/modules/tag/contracts/schemas/response/tag-category/index';
import type {CreateTagCategoryDTO} from '@/modules/tag/contracts/schemas/request/tag-category/index';
import {usePageSize} from '@/shared/ui/dashboard/pagination/index';
import {useBatchSelection} from '@/shared/hooks/useBatchSelection';
import BatchOperationModal from '@/shared/ui/dashboard/BatchOperationModal/BatchOperationModal';

const TagCategoriesView: React.FC = () => {
    const router = useRouter();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingRecord, setEditingRecord] = useState<TagCategoryVO | null>(null);
    const [parentCategory, setParentCategory] = useState<string | undefined>(undefined);

    const {pageSize, setPageSize} = usePageSize();
    const [page, setPage] = useState(1);
    const [keyword, setKeyword] = useState('');
    const [tableRefreshKey, setTableRefreshKey] = useState(0);

    const isRowSelectable = useCallback((record: TagCategoryVO) => {
        return record.childrenCount === 0 && record.tagCount === 0;
    }, []);

    const batchSelection = useBatchSelection<TagCategoryVO>({
        enableBatchMode: true,
        getRowKey: (row) => row.id,
    });

    const {
        data: categoriesData,
        isLoading,
        refetch,
    } = useTagCategories({page, pageSize, keyword, parentId: null}) as {
        data: TagCategoryListVO | undefined;
        isLoading: boolean;
        refetch: () => Promise<unknown>;
    };

    const {data: allCategoriesData, refetch: refetchAllCategories} = useTagCategories({page: 1, pageSize: 9999, parentId: null}) as {
        data: TagCategoryListVO | undefined;
        refetch: () => Promise<unknown>;
    };

    const createMutation = useCreateTagCategory();
    const updateMutation = useUpdateTagCategory();
    const deleteMutation = useDeleteTagCategory();
    const batchDeleteMutation = useBatchDeleteTagCategories();

    const handleCreate = () => {
        setEditingId(null);
        setParentCategory(undefined);
        setIsModalVisible(true);
    };

    const handleAddSubCategory = (id: string) => {
        setEditingId(null);
        setParentCategory(id);
        setIsModalVisible(true);
    };

    const handleEdit = (record: TagCategoryVO) => {
        setEditingId(record.id);
        setParentCategory(record.parent?.id);
        setEditingRecord(record);
        setIsModalVisible(true);
    };

    const handleCloseModal = () => {
        setIsModalVisible(false);
        setEditingId(null);
        setParentCategory(undefined);
        setEditingRecord(null);
    };

    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleDelete = (id: string) => {
        setDeletingId(id);
        setIsDeleteModalVisible(true);
    };

    const handleViewTags = (categoryId: string, categoryName: string) => {
        router.push(`/dashboard/tags?categoryId=${encodeURIComponent(categoryId)}&categoryName=${encodeURIComponent(categoryName)}`);
    };

    const handleDeleteOk = async () => {
        if (!deletingId) return;
        try {
            await deleteMutation.mutateAsync(deletingId);
            globalMessage.success(MESSAGES.TAG_CATEGORY.DELETE_SUCCESS);
            const {data: newData} = await refetch() as {data: TagCategoryListVO | undefined};
            if (newData?.items?.length === 0 && page > 1) {
                setPage(1);
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                globalMessage.error(error?.response?.data?.message || error?.message || MESSAGES.TAG_CATEGORY.DELETE_FAILED);
            } else {
                globalMessage.error(MESSAGES.TAG_CATEGORY.DELETE_FAILED);
            }
        } finally {
            setIsDeleteModalVisible(false);
            setDeletingId(null);
        }
    };

    const handleOk = async (values: {parentId?: string; name: string; orderIndex?: number; description?: string; entityTypeCode?: string}) => {
        try {
            const categoryData: CreateTagCategoryDTO = {
                name: values.name,
                parentId: values.parentId || undefined,
                description: values.description,
                orderIndex: values.orderIndex ?? 0,
                feature: values.entityTypeCode ? {entityTypeCode: values.entityTypeCode} : {},
            };
            if (editingId) {
                await updateMutation.mutateAsync({categoryId: editingId, categoryData: {...categoryData, id: editingId}});
                globalMessage.success(MESSAGES.TAG_CATEGORY.UPDATE_SUCCESS);
            } else {
                await createMutation.mutateAsync(categoryData);
                globalMessage.success(MESSAGES.TAG_CATEGORY.CREATE_SUCCESS);
            }
            await refetch();
            await refetchAllCategories();
            setTableRefreshKey(prev => prev + 1);
            setIsModalVisible(false);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                globalMessage.error(error?.response?.data?.message || error?.message || MESSAGES.TAG_CATEGORY.OPERATION_FAILED);
            } else {
                globalMessage.error(MESSAGES.TAG_CATEGORY.OPERATION_FAILED);
            }
        }
    };

    const handleKeywordChange = useCallback((newKeyword: string) => {
        setKeyword(newKeyword);
        setPage(1);
    }, []);

    const handlePageChange = useCallback((newPage: number, newPageSize: number) => {
        setPage(newPage);
        setPageSize(newPageSize);
    }, [setPageSize]);

    const categories = useMemo(() => categoriesData?.items || [], [categoriesData?.items]);

    const handleBatchSelect = useCallback(() => {
        const selectableRows = categories.filter(isRowSelectable);
        batchSelection.enterBatchMode(selectableRows);
    }, [categories, isRowSelectable, batchSelection]);

    const [isBatchDeleteModalVisible, setIsBatchDeleteModalVisible] = useState(false);

    const handleBatchDelete = useCallback(() => {
        setIsBatchDeleteModalVisible(true);
    }, []);

    const handleBatchDeleteOk = async () => {
        try {
            const result = await batchDeleteMutation.mutateAsync({ids: batchSelection.selectedRowKeys});
            if (result.success) {
                globalMessage.success(result.message || `成功删除 ${result.deletedCount} 个分类`);
            } else {
                globalMessage.warning(result.message || `成功删除 ${result.deletedCount} 个分类，部分失败`);
            }
            const {data: newData} = await refetch() as {data: TagCategoryListVO | undefined};
            if (newData?.items?.length === 0 && page > 1) {
                setPage(1);
            }
            batchSelection.exitBatchMode();
        } catch (error) {
            if (axios.isAxiosError(error)) {
                globalMessage.error(error?.response?.data?.message || error?.message || MESSAGES.TAG_CATEGORY.BATCH_DELETE_FAILED);
            } else {
                globalMessage.error(MESSAGES.TAG_CATEGORY.BATCH_DELETE_FAILED);
            }
        } finally {
            setIsBatchDeleteModalVisible(false);
        }
    };

    const pagination = {
        current: page,
        pageSize,
        total: categoriesData?.totalCount ?? 0,
    };

    const hasSelectableRows = categories.some(isRowSelectable);

    return (
        <PageContainer>
            <PageHeader
                title="标签分类管理"
                description="管理标签的层级分类结构，支持多级分类、拖拽排序和批量操作，让标签组织更加清晰高效。"
                iconComponent={AppstoreOutlined}
                showDefaultCreate
                onCreate={handleCreate}
            />

            <CategoryTable
                data={categories}
                loading={isLoading}
                pagination={pagination}
                onAddSubCategory={handleAddSubCategory}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onPageChange={handlePageChange}
                refreshKey={tableRefreshKey}
                filterComponent={<CategoryFilter keyword={keyword} onKeywordChange={handleKeywordChange} />}
                actionButtons={
                    batchSelection.isBatchMode ? (
                        <Space>
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
                        </Space>
                    ) : (
                        <Button
                            icon={<CheckSquareOutlined />}
                            onClick={handleBatchSelect}
                            disabled={!hasSelectableRows}
                        >
                            批量选择
                        </Button>
                    )
                }
                selectedRowKeys={batchSelection.computedSelectedRowKeys}
                onSelectionChange={batchSelection.handleSelectionChange}
                onViewTags={handleViewTags}
                getCheckboxProps={(record) => ({
                    disabled: !isRowSelectable(record),
                })}
            />

            <CategoryDrawer
                visible={isModalVisible}
                loading={createMutation.isPending || updateMutation.isPending}
                editingId={editingId}
                editingRecord={editingRecord ?? undefined}
                parentCategory={parentCategory}
                data={allCategoriesData?.items || []}
                onOk={handleOk}
                onCancel={handleCloseModal}
            />

            <BatchOperationModal
                open={isDeleteModalVisible}
                operationType="delete"
                count={1}
                itemName="分类"
                loading={deleteMutation.isPending}
                onConfirm={handleDeleteOk}
                onCancel={() => {
                    setIsDeleteModalVisible(false);
                    setDeletingId(null);
                }}
                config={{
                    warningMessage: '只有空的分类（没有子分类和标签）才能被删除。',
                }}
            />

            <BatchOperationModal
                open={isBatchDeleteModalVisible}
                operationType="delete"
                count={batchSelection.selectionCount}
                itemName="个分类"
                loading={batchDeleteMutation.isPending}
                onConfirm={handleBatchDeleteOk}
                onCancel={() => setIsBatchDeleteModalVisible(false)}
                config={{
                    warningMessage: '只有空的分类（没有子分类和标签）才能被删除。包含子分类或标签的分类将被跳过。',
                }}
            />
        </PageContainer>
    );
};

export default TagCategoriesView;
