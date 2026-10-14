'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '@/shared/lib/api-client';
import type { CreateSegmentDTO, SegmentFilterDTO, UpdateSegmentDTO } from '@/modules/segment/contracts/schemas/request/segment';
import type { SegmentVO, SegmentListVO, SegmentMemberListVO } from '@/modules/segment/contracts/schemas/response/segment';
export function useSegments(query: SegmentFilterDTO) { return useQuery<SegmentListVO>({ queryKey: ['segments', query], queryFn: () => ApiClient.get<SegmentListVO>('/segments', query) }); }
export function useSegment(id: string) { return useQuery<SegmentVO>({ queryKey: ['segment', id], queryFn: () => ApiClient.get<SegmentVO>('/segments/' + id), enabled: !!id }); }
export function useCreateSegment() { const cache = useQueryClient(); return useMutation<SegmentVO, Error, CreateSegmentDTO>({ mutationFn: dto => ApiClient.post<CreateSegmentDTO, SegmentVO>('/segments', dto), onSuccess: () => { void cache.invalidateQueries({ queryKey: ['segments'] }); } }); }
export function useUpdateSegment() { const cache = useQueryClient(); return useMutation<SegmentVO, Error, {
    segmentId: string;
    segmentData: UpdateSegmentDTO;
}>({ mutationFn: ({ segmentId, segmentData }) => ApiClient.put<UpdateSegmentDTO, SegmentVO>('/segments/' + segmentId, segmentData), onSuccess: (_, { segmentId }) => { void cache.invalidateQueries({ queryKey: ['segment', segmentId] }); void cache.invalidateQueries({ queryKey: ['segments'] }); } }); }
export function useDeleteSegment() { const cache = useQueryClient(); return useMutation<void, Error, string>({ mutationFn: id => ApiClient.delete<never, void>('/segments/' + id), onSuccess: () => { void cache.invalidateQueries({ queryKey: ['segments'] }); } }); }
export function useSegmentMembers(id: string, page = 1, pageSize = 20) { return useQuery<SegmentMemberListVO>({ queryKey: ['segment-members', id, page, pageSize], queryFn: () => ApiClient.get<SegmentMemberListVO>('/segments/' + id + '/members', { page, pageSize }), enabled: !!id }); }
