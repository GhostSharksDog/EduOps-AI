import {useCompanyUnitFixture} from '@/tests/helpers/company-unit-fixture';
const companyId=useCompanyUnitFixture();
/**
 * AdminOHSAdapterImpl 测试
 * 验证 fromRequestToXxxCommand 与 fromAuditLogXxxVO 的映射及边界情形
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { AdminOHSAdapterImpl } from '@/modules/system/services/admin/AdminOHSAdapterImpl';
import { NextRequest } from 'next/server';

describe('AdminOHSAdapterImpl', () => {
  let adapter: AdminOHSAdapterImpl;

  beforeEach(() => {
    adapter = new AdminOHSAdapterImpl();
  });

  describe('fromRequestToGetTablesQuery', () => {
    it('应正确解析 schema 参数，默认 schema 为 public', () => {
      const req1 = new NextRequest('https://example.com/?schema=custom_schema', { method: 'GET' } as any);
      const q1 = adapter.fromRequestToGetTablesQuery(req1);
      expect(q1).toEqual({ schema: 'custom_schema' });

      const req2 = new NextRequest('https://example.com/', { method: 'GET' } as any);
      const q2 = adapter.fromRequestToGetTablesQuery(req2);
      expect(q2).toEqual({ schema: 'public' });
    });
  });

  describe('fromRequestToGetPreviewQuery', () => {
    it('应解析 limit、offset 及 table', () => {
      const req = new NextRequest('https://example.com/?limit=50&offset=5', { method: 'GET' } as any);
      const q = adapter.fromRequestToGetPreviewQuery(req, 'users');
      expect(q).toEqual({ table: 'users', limit: 50, offset: 5 });
    });
  });

  describe('fromRequestToTruncateTableCommand', () => {
    it('应返回待截断的表信息', () => {
      const req = new NextRequest('https://example.com/', { method: 'POST' } as any);
      const cmd = adapter.fromRequestToTruncateTableCommand(req, 'audit_logs');
      expect(cmd).toEqual({ table: 'audit_logs' });
    });
  });

  describe('fromRequestToGetAuditLogsQuery', () => {
    it('应包含分页、过滤参数和租户筛选', () => {
      const req = new NextRequest('https://example.com/?page=2&pageSize=15&action=DELETE&entity=TAG&actorId=abc&startTime=2020-01-01T00:00:00.000Z&endTime=2020-01-02T00:00:00.000Z', { method: 'GET' } as any);
      // 模拟租户信息
      (req.headers as any).set?.('x-tenant-id', 'tenant-1');
      const q = adapter.fromRequestToGetAuditLogsQuery(req);
      expect(q.page).toBe(2);
      expect(q.pageSize).toBe(15);
      expect(q.action).toBe('DELETE');
      expect(q.entity).toBe('TAG');
      expect(q.actorId).toBe('abc');
      expect(q.startTime?.toISOString()).toBe('2020-01-01T00:00:00.000Z');
      expect(q.endTime?.toISOString()).toBe('2020-01-02T00:00:00.000Z');
      expect(q.tenantFilter).toEqual({ tenantId: companyId } as any);
    });
  });

  describe('fromAuditLogToVO / fromAuditLogListToVO', () => {
    it('应正确将日志映射为 VO', () => {
      const log = {
        id: 'log-1',
        action: 'LOGIN',
        entity: 'USER',
        entityId: 'entity-1',
        actorId: 'actor-1',
        actorUsername: 'user1',
        actorRealName: null,
        actorEmail: null,
        actorRole: null,
        metadata: { ip: '127.0.0.1' },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      } as any;
      const vo = adapter.fromAuditLogToVO(log as any);
      expect(vo).toEqual(log as any);
    });

    it('应正确映射日志列表到 VO 列表', () => {
      const logs = [
        { id: 'l1', action: 'A', entity: 'E', entityId: 'id1', actorId: 'a1', actorUsername: 'u1', actorRealName: null, actorEmail: null, actorRole: null, metadata: null, createdAt: new Date() },
        { id: 'l2', action: 'B', entity: 'E', entityId: 'id2', actorId: 'a2', actorUsername: 'u2', actorRealName: null, actorEmail: null, actorRole: null, metadata: null, createdAt: new Date() }
      ];
      const list = adapter.fromAuditLogListToVO(logs as any, 2, 1, 2);
      expect(list.total).toBe(2);
      expect(list.page).toBe(1);
      expect(list.pageSize).toBe(2);
      expect(list.totalPages).toBe(1);
      expect(list.items.length).toBe(2);
      expect(list.items[0].id).toBe('l1');
    });
  });

  describe('fromRequestToResolveErrorCommand', () => {
    it('应包装日志ID', () => {
      const req = new NextRequest('https://example.com/', { method: 'GET' } as any);
      const cmd = adapter.fromRequestToResolveErrorCommand(req, 'err-123');
      expect(cmd).toEqual({ logId: 'err-123' });
    });
  });
});
