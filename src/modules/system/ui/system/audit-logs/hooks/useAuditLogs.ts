import {useQuery} from '@tanstack/react-query';
import {ApiClient} from '@/shared/lib/api-client';
import type {AuditLogListVO} from '@/shared/schemas/response/audit-log/index';
import type {AuditLogQueryDTO} from '@/shared/schemas/request/audit/index';

export function useAuditLogs(params: AuditLogQueryDTO) {
    return useQuery({
        queryKey: ['audit-logs', params],
        queryFn: () => ApiClient.get<AuditLogListVO>('/audit-logs', params),
        staleTime: 30000,
    });
}
