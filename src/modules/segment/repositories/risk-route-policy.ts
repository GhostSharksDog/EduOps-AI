import 'server-only';
import { queryOne } from '@/platform/database';
export async function managedRiskSegmentOwner(segmentId: string) { return (await queryOne<{
    organizationId: string;
}>('SELECT "organizationId" FROM education_segment_snapshot WHERE "segmentId"=$1', [segmentId]))?.organizationId ?? null; }
