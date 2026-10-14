import { useQuery } from '@tanstack/react-query';
import { ApiClient } from '@/shared/lib/api-client';
import type {TagListVO} from '@/modules/tag/contracts';
import type { AuditLogListVO } from '@/shared/schemas/response/audit-log/index';
import type {DataSourceListVO} from '@/modules/data/contracts';
import type { CategoryDistributionItem } from '@/shared/schemas/response/dashboard/index';

export function useCategoryDistribution(page: number = 1, pageSize: number = 10) {
  return useQuery<CategoryDistributionItem[]>({
    queryKey: ['dashboard', 'category-distribution', page, pageSize],
    queryFn: () => 
      ApiClient.get<{ categories: CategoryDistributionItem[] }>('/dashboard/category-distribution', { page, pageSize })
      .then(res => res.categories),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecentTags(page: number = 1, pageSize: number = 5) {
  return useQuery<TagListVO>({
    queryKey: ['dashboard', 'recent-tags', page, pageSize],
    queryFn: () =>
      ApiClient.get<TagListVO>('/tags', { page, pageSize, sort: '-createTime' })
      .then(res => res),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecentActivities(page: number = 1, pageSize: number = 5) {
  return useQuery<AuditLogListVO>({
    queryKey: ['dashboard', 'recent-activities', page, pageSize],
    queryFn: () =>
      ApiClient.get<AuditLogListVO>('/audit-logs', { page, pageSize })
      .then(res => res),
    staleTime: 30 * 1000,
  });
}

export function useDataSources(page: number = 1, pageSize: number = 3) {
  return useQuery<DataSourceListVO>({
    queryKey: ['dashboard', 'data-sources', page, pageSize],
    queryFn: () =>
      ApiClient.get<DataSourceListVO>('/data-sources', { page, pageSize })
      .then(res => res),
    staleTime: 5 * 60 * 1000,
  });
}
