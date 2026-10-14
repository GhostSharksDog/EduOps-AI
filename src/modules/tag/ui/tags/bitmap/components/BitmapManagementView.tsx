'use client';

import React, {useMemo, useState} from 'react';
import {Select, Space, Input, Modal, Button} from 'antd';
import {AppstoreOutlined} from '@ant-design/icons';
import {useBitmapManagementStore} from '@/modules/tag/ui/state/bitmapManagementStore';
import {useBitmapTables, useBitmapTableDetail, useToggleBitmapTableStatus, useDeleteBitmapTable, useReleaseUnusedBits} from '@/modules/tag/ui/tags/bitmap/hooks/useBitmapManagement';
import type {BitmapTableVO} from '@/shared/schemas/response/bitmap-table/index';
import PageHeader from '@/shared/ui/dashboard/PageHeader';
import TableCard from '@/shared/ui/dashboard/TableCard/index';
import {RefreshButton} from '@/shared/ui/dashboard/RefreshButton/index';
import BitmapTable from '@/modules/tag/ui/tags/bitmap/components/BitmapTable';
import CreateBitmapDrawer from '@/modules/tag/ui/tags/bitmap/components/CreateBitmapDrawer';
import BitDetailDrawer from '@/modules/tag/ui/tags/bitmap/components/BitDetailDrawer';

const BitmapManagementView: React.FC = () => {
    const {
        entityTypeIdFilter,
        statusFilter,
        searchText,
        selectedTableId,
        setEntityTypeIdFilter,
        setStatusFilter,
        setSearchText,
        openCreateDrawer,
        openDrawer
    } = useBitmapManagementStore();

    const {data: tablesData, isLoading, refetch} = useBitmapTables();
    const {data: tableDetail} = useBitmapTableDetail(selectedTableId || undefined);
    const toggleStatusMutation = useToggleBitmapTableStatus();
    const deleteMutation = useDeleteBitmapTable();
    const releaseUnusedBitsMutation = useReleaseUnusedBits();
    const [releasingTableId, setReleasingTableId] = useState<string | null>(null);

    const tables = useMemo(() => tablesData?.items || [], [tablesData?.items]);

    const filteredTables = useMemo(() => {
        return tables.filter(table => {
            if (entityTypeIdFilter && table.entityTypeId !== entityTypeIdFilter) return false;
            if (statusFilter && table.status !== statusFilter) return false;
            if (searchText && 
                !table.tableName.toLowerCase().includes(searchText.toLowerCase()) &&
                !table.entityType.toLowerCase().includes(searchText.toLowerCase())) return false;
            return true;
        });
    }, [tables, entityTypeIdFilter, statusFilter, searchText]);

    const entityTypes = useMemo(() => {
        const typeMap = new Map<string, string>();
        tables.forEach(t => {
            if (!typeMap.has(t.entityTypeId)) {
                typeMap.set(t.entityTypeId, t.entityType);
            }
        });
        return Array.from(typeMap.entries())
            .map(([id, name]) => ({id, name}))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [tables]);

    const handleViewDetail = (table: BitmapTableVO) => {
        openDrawer(table.id);
    };

    const handleToggleStatus = async (table: BitmapTableVO) => {
        const newStatus = table.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        
        try {
            await toggleStatusMutation.mutateAsync({ 
                tableId: table.id, 
                newStatus 
            });
        } catch (error: unknown) {
            const apiError = error as { code?: string; details?: { usedBitCount?: number } };
            if (apiError.code === 'TAG_BITMAP_TABLE_HAS_USED_BITS') {
                const { usedBitCount } = apiError.details || {};
                Modal.confirm({
                    title: '无法停用',
                    content: (
                        <div>
                            <p>该bitmap表还有 {usedBitCount || 0} 个位未被释放，请先释放这些位后再停用</p>
                            <Space style={{ marginTop: 16 }}>
                                <Button 
                                    type="link" 
                                    onClick={() => {
                                        Modal.destroyAll();
                                        openDrawer(table.id);
                                    }}
                                >
                                    查看详情
                                </Button>
                                <Button 
                                    type="primary" 
                                    loading={releasingTableId === table.id}
                                    onClick={async () => {
                                        setReleasingTableId(table.id);
                                        try {
                                            await releaseUnusedBitsMutation.mutateAsync({ tableId: table.id });
                                            Modal.destroyAll();
                                            Modal.success({
                                                title: '释放成功',
                                                content: '已释放未使用位，请重新尝试停用',
                                            });
                                        } catch (releaseError) {
                                            Modal.error({
                                                title: '释放失败',
                                                content: releaseError instanceof Error ? releaseError.message : '释放未使用位失败',
                                            });
                                        } finally {
                                            setReleasingTableId(null);
                                        }
                                    }}
                                >
                                    一键释放未使用位
                                </Button>
                            </Space>
                        </div>
                    ),
                    footer: null,
                });
            } else {
                throw error;
            }
        }
    };

    const handleEntityTypeClick = (entityTypeId: string) => {
        setEntityTypeIdFilter(entityTypeId);
    };

    const handleDelete = async (table: BitmapTableVO) => {
        await deleteMutation.mutateAsync(table.id);
    };

    const filterComponent = (
        <Space>
            <Select
                placeholder="实体类型"
                allowClear
                style={{width: 150}}
                value={entityTypeIdFilter}
                onChange={setEntityTypeIdFilter}
                options={entityTypes.map(type => ({label: type.name, value: type.id}))}
            />
            <Select
                placeholder="状态"
                allowClear
                style={{width: 120}}
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                    {label: '活跃', value: 'ACTIVE'},
                    {label: '已停用', value: 'INACTIVE'},
                ]}
            />
            <Input.Search
                placeholder="搜索表名..."
                allowClear
                style={{width: 200}}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
            />
        </Space>
    );

    return (
        <div style={{padding: 24}}>
            <PageHeader
                title="Bitmap 管理"
                description="管理各实体类型的位分配，监控位使用情况"
                showDefaultCreate
                onCreate={openCreateDrawer}
                createButtonText="创建新表"
            />

            <TableCard
                title="Bitmap 表"
                icon={<AppstoreOutlined />}
                actions={<RefreshButton onClick={() => refetch()} loading={isLoading} />}
                filter={filterComponent}
                total={filteredTables.length}
                totalLabel="张表"
                table={
                    <BitmapTable
                        tables={filteredTables}
                        loading={isLoading}
                        onViewDetail={handleViewDetail}
                        onToggleStatus={handleToggleStatus}
                        onEntityTypeClick={handleEntityTypeClick}
                        onDelete={handleDelete}
                    />
                }
                loading={false}
            />

            <CreateBitmapDrawer />
            <BitDetailDrawer selectedTable={tableDetail || null} />
        </div>
    );
};

export default BitmapManagementView;
