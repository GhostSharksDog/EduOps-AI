'use client';
import { useParams } from 'next/navigation';
import { Card, Spin } from 'antd';
import PageContainer from '@/shared/ui/dashboard/PageContainer';
import PageHeader from '@/shared/ui/dashboard/PageHeader';
import { TeamOutlined } from '@ant-design/icons';
import ConfigDetails from '@/modules/segment/ui/segments/[id]/components/ConfigDetails';
import { useSegment } from '@/modules/segment/ui/segments/hooks/useSegments';
export default function SegmentDetailPage() { const params = useParams(), id = params.id as string, { data, isLoading } = useSegment(id); return <PageContainer><PageHeader title={data?.name ?? '人群配置'} description="查看已保存的人群规则和配置。" iconComponent={TeamOutlined}/>{isLoading ? <Spin /> : <Card><ConfigDetails segmentInfo={data ?? null}/></Card>}</PageContainer>; }
