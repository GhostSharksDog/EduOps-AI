'use client';

import React, {useState, useMemo} from 'react';
import {Table, Button, Tag, Empty, Popconfirm, Input, Space, theme, Modal, Select, Spin} from 'antd';
import {DeleteOutlined, SearchOutlined, UserSwitchOutlined} from '@ant-design/icons';
import {useGlobalMessage} from '@/shared/lib/message-service';
import {MESSAGES} from '@/shared/messages/index';
import BaseDrawer from '@/shared/ui/BaseDrawer/index';
import type {BitInfoVO, BitmapTableDetailVO} from '@/shared/schemas/response/bitmap-table/index';
import {useReleaseBitmapBit, useReleaseUnusedBits, useAssignBitToTag, useUnassignBit} from '@/modules/tag/ui/tags/bitmap/hooks/useBitmapManagement';
import {useBitmapManagementStore} from '@/modules/tag/ui/state/bitmapManagementStore';

import {useQuery} from '@tanstack/react-query';
import {ApiClient} from '@/shared/lib/api-client';
import styles from './BitDetailDrawer.module.css';

interface TagOption {
    id: string;
    name: string;
    status: string;
}

interface BitDetailDrawerProps {
    selectedTable: BitmapTableDetailVO | null;
}

const BitDetailDrawer: React.FC<BitDetailDrawerProps> = ({selectedTable}) => {
    const {token} = theme.useToken();
    const {success, error, info} = useGlobalMessage();
    const [searchText, setSearchText] = useState('');
    const [assignModalVisible, setAssignModalVisible] = useState(false);
    const [selectedBitIndex, setSelectedBitIndex] = useState<number | null>(null);
    const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
    const [tagSearchText, setTagSearchText] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const {
        drawerVisible,
        closeDrawer,
    } = useBitmapManagementStore();

    const releaseBitMutation = useReleaseBitmapBit();
    const releaseUnusedBitsMutation = useReleaseUnusedBits();
    const assignBitMutation = useAssignBitToTag();
    const unassignBitMutation = useUnassignBit();

    const {data: tagsData, isLoading: tagsLoading} = useQuery<TagOption[]>({
        queryKey: ['tags-for-assign', tagSearchText],
        queryFn: async () => {
            const params: Record<string, string> = {page: '1', pageSize: '50'};
            if (tagSearchText) {
                params.name = tagSearchText;
            }
            const result = await ApiClient.get<{items: TagOption[]}>('/tags', params);
            return result.items || [];
        },
        enabled: assignModalVisible,
    });

    const assignedTagIds = useMemo(() => {
        if (!selectedTable) return new Set<string>();
        return new Set(selectedTable.bits.filter(b => b.tagId).map(b => b.tagId as string));
    }, [selectedTable]);

    const availableTags = useMemo(() => {
        if (!tagsData) return [];
        return tagsData.filter(tag => !assignedTagIds.has(tag.id));
    }, [tagsData, assignedTagIds]);

    const tagOptions = useMemo(() => {
        return availableTags.map(tag => ({
            value: tag.id,
            label: `${tag.name} (${tag.status})`,
        }));
    }, [availableTags]);

    const filteredBits = useMemo(() => {
        if (!selectedTable) return [];
        if (!searchText) return selectedTable.bits;
        const lowerSearch = searchText.toLowerCase();
        return selectedTable.bits.filter(bit =>
            bit.tagName?.toLowerCase().includes(lowerSearch) ||
            bit.tagId?.toLowerCase().includes(lowerSearch)
        );
    }, [selectedTable, searchText]);

    // 当搜索条件变化时重置页码
    useMemo(() => {
        setCurrentPage(1);
    }, [searchText]);

    const paginatedBits = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        return filteredBits.slice(startIndex, endIndex);
    }, [filteredBits, currentPage, pageSize]);

    if (!selectedTable) return null;

    const usedCount = selectedTable.usedBits.length;
    const assignedCount = selectedTable.bits.filter(b => b.tagId).length;
    const unassignedCount = usedCount - assignedCount;
    const availableCount = selectedTable.totalBits - usedCount;

    const handleRelease = async (bitIndex: number) => {
        await releaseBitMutation.mutateAsync({tableId: selectedTable.id, bitIndex});
    };

    const handleReleaseUnused = async () => {
        const unusedBits = selectedTable.bits
            .filter(bit => !bit.tagId)
            .map(bit => bit.index);
        
        if (unusedBits.length === 0) {
            info(MESSAGES.TAGS.NO_BITS_TO_RELEASE);
            return;
        }
        
        try {
            const result = await releaseUnusedBitsMutation.mutateAsync({
                tableId: selectedTable.id,
            });

            success(MESSAGES.TAGS.BIT_RELEASE_SUCCESS.replace('{count}', String(result.releasedBits.length)));
        } catch {
            error(MESSAGES.TAGS.BIT_RELEASE_FAILED);
        }
    };

    const openAssignModal = (bitIndex: number) => {
        setSelectedBitIndex(bitIndex);
        setSelectedTagId(null);
        setTagSearchText('');
        setAssignModalVisible(true);
    };

    const handleAssign = async () => {
        if (selectedBitIndex === null || !selectedTagId) return;

        try {
            await assignBitMutation.mutateAsync({
                tableId: selectedTable.id,
                bitIndex: selectedBitIndex,
                tagId: selectedTagId,
            });
            success(`位 ${selectedBitIndex} 已分配给标签`);
            setAssignModalVisible(false);
        } catch (err) {
            error(err instanceof Error ? err.message : '分配失败');
        }
    };

    const handleUnassign = async (bitIndex: number) => {
        try {
            await unassignBitMutation.mutateAsync({
                tableId: selectedTable.id,
                bitIndex,
            });
            success(`位 ${bitIndex} 已取消分配`);
        } catch (err) {
            error(err instanceof Error ? err.message : '取消分配失败');
        }
    };

    const columns = [
        {
            title: '位号',
            dataIndex: 'index',
            key: 'index',
            width: 80,
            render: (index: number) => <Tag>{index}</Tag>,
        },
        {
            title: '标签ID',
            dataIndex: 'tagId',
            key: 'tagId',
            width: 130,
            render: (tagId: string | null) =>
                tagId || <span style={{color: token.colorTextDisabled}}>-</span>,
        },
        {
            title: '标签名称',
            dataIndex: 'tagName',
            key: 'tagName',
            render: (tagName: string | null, record: BitInfoVO) => {
                if (!tagName) return <span style={{color: token.colorTextDisabled}}>未分配</span>;
                if (record.enumValue) return <span>{tagName} · {record.enumValue}</span>;
                return tagName;
            },
        },
        {
            title: '操作',
            key: 'action',
            width: 150,
            render: (_: unknown, record: BitInfoVO) => {
                if (record.tagId) {
                    return (
                        <Space size="small">
                            <Popconfirm
                                title="确认取消分配"
                                description={`将取消位 ${record.index} 与标签 ${record.tagName} 的关联`}
                                onConfirm={() => handleUnassign(record.index)}
                                okText="确认"
                                cancelText="取消"
                            >
                                <Button
                                    type="link"
                                    size="small"
                                    loading={unassignBitMutation.isPending}
                                >
                                    取消分配
                                </Button>
                            </Popconfirm>
                            <Popconfirm
                                title={MESSAGES.TAGS.BIT_RELEASE_CONFIRM_TITLE}
                                description={`将释放位 ${record.index} (${record.tagName})`}
                                onConfirm={() => handleRelease(record.index)}
                                okText={MESSAGES.COMMON.CONFIRM}
                                cancelText={MESSAGES.COMMON.CANCEL}
                            >
                                <Button
                                    type="link"
                                    danger
                                    size="small"
                                    icon={<DeleteOutlined/>}
                                    loading={releaseBitMutation.isPending}
                                >
                                    释放
                                </Button>
                            </Popconfirm>
                        </Space>
                    );
                }
                return (
                    <Button
                        type="link"
                        size="small"
                        icon={<UserSwitchOutlined/>}
                        onClick={() => openAssignModal(record.index)}
                    >
                        分配给标签
                    </Button>
                );
            },
        },
    ];

    return (
        <>
                <BaseDrawer
                    title={
                        <span>
                            位详情 - <code style={{fontSize: 13}}>{selectedTable.tableName}</code>
                        </span>
                    }
                    width={720}
                    onClose={closeDrawer}
                    open={drawerVisible}
                    footerMode="custom"
                    className={styles.bitDetailDrawer}
                    styles={{
                        body: {
                            maxHeight: 'calc(100vh - 110px)',
                            overflowY: 'auto',
                        }
                    }}
                    footer={
                    unassignedCount > 0 ? (
                        <Popconfirm
                            title={MESSAGES.TAGS.BIT_RELEASE_UNASSIGNED_TITLE}
                            description={`将释放 ${unassignedCount} 个已分配但未使用的位`}
                            onConfirm={handleReleaseUnused}
                            okText={MESSAGES.COMMON.CONFIRM}
                            cancelText={MESSAGES.COMMON.CANCEL}
                        >
                            <Button danger loading={releaseUnusedBitsMutation.isPending}>
                                释放全部未使用的位
                            </Button>
                        </Popconfirm>
                    ) : null
                }
            >
                <Space orientation="vertical" style={{width: '100%'}} size="middle">
                    <Space wrap>
                        <Tag color="blue">总位数: {selectedTable.totalBits}</Tag>
                        <Tag color="green">已分配: {assignedCount}</Tag>
                        <Tag color="orange">未分配: {unassignedCount}</Tag>
                        <Tag color="purple">可用: {availableCount}</Tag>
                    </Space>

                    <Input
                        placeholder="搜索标签名称或ID..."
                        prefix={<SearchOutlined/>}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        allowClear
                    />

                    {filteredBits.length === 0 ? (
                        <Empty
                            description={searchText ? '未找到匹配的标签' : '暂无已分配的位'}
                        />
                    ) : (
                        <Table
                            dataSource={paginatedBits}
                            columns={columns}
                            rowKey="index"
                            size="small"
                            pagination={{
                                current: currentPage,
                                pageSize: pageSize,
                                total: filteredBits.length,
                                onChange: (page, size) => {
                                    setCurrentPage(page);
                                    setPageSize(size);
                                },
                                showSizeChanger: true,
                                showQuickJumper: true,
                                showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
                                pageSizeOptions: ['10', '20', '50', '100'],
                            }}
                        />
                    )}
                </Space>
            </BaseDrawer>

            <Modal
                title={`分配位 ${selectedBitIndex} 给标签`}
                open={assignModalVisible}
                onOk={handleAssign}
                onCancel={() => setAssignModalVisible(false)}
                okText="分配"
                cancelText="取消"
                okButtonProps={{loading: assignBitMutation.isPending, disabled: !selectedTagId}}
            >
                <Space orientation="vertical" style={{width: '100%'}} size="middle">
                    <Input
                        placeholder="搜索标签名称..."
                        prefix={<SearchOutlined/>}
                        value={tagSearchText}
                        onChange={(e) => setTagSearchText(e.target.value)}
                        allowClear
                    />
                    <Spin spinning={tagsLoading}>
                        <Select
                            style={{width: '100%'}}
                            placeholder="选择要分配的标签"
                            value={selectedTagId}
                            onChange={setSelectedTagId}
                            options={tagOptions}
                            showSearch
                            filterOption={false}
                            notFoundContent={tagsLoading ? <Spin size="small" /> : '没有可用的标签'}
                        />
                    </Spin>
                    {availableTags.length === 0 && !tagsLoading && (
                        <div style={{color: token.colorTextSecondary, fontSize: 12}}>
                            所有标签都已分配 Bit 位置
                        </div>
                    )}
                </Space>
            </Modal>
        </>
    );
};

export default BitDetailDrawer;
