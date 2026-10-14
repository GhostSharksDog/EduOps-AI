/**
 * BitmapOHSAdapterImpl 测试
 * 验证创建、状态更新、列表查询、以及 VO/DetailVO 映射
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { BitmapOHSAdapterImpl } from '@/modules/tag/services/bitmap/BitmapOHSAdapterImpl';
import type { NextRequest } from 'next/server';

describe('BitmapOHSAdapterImpl', () => {
  let adapter: BitmapOHSAdapterImpl;

  beforeEach(() => {
    adapter = new BitmapOHSAdapterImpl();
  });

  describe('fromRequestToCreateCommand', () => {
    it('应正确解析创建 Bitmap 表的 payload', async () => {
      const payload = {
        entityType: 'USER',
        entityTypeId: '11111111-1111-4111-8111-111111111111',
        totalBits: 128
      };
      const req = { json: async () => payload } as any as NextRequest;
      const dto = await adapter.fromRequestToCreateCommand(req);
      expect(dto).toMatchObject(payload);
    });
  });

  describe('fromRequestToUpdateStatusCommand', () => {
    it('应正确解析更新状态命令', async () => {
      const payload = { status: 'ACTIVE' };
      const req = { json: async () => payload } as any as NextRequest;
      const dto = await adapter.fromRequestToUpdateStatusCommand(req, 'id-bitmap');
      expect(dto).toMatchObject({ id: 'id-bitmap', status: 'ACTIVE' } as any);
    });
  });

  describe('fromRequestToListQuery', () => {
    it('应解析查询条件及租户信息', () => {
      const req: any = {
        url: 'https://example.com/?entityType=USER&entityTypeId=11111111-1111-1111-1111-111111111111&status=ACTIVE&search=test',
        nextUrl: new URL('https://example.com/?entityType=USER&entityTypeId=11111111-1111-1111-1111-111111111111&status=ACTIVE&search=test'),
        headers: new Headers()
      };
      (req.headers as any).set('x-tenant-id', 'tenant-1');
      const dto = adapter.fromRequestToListQuery(req);
      expect(dto.entityType).toBe('USER');
      expect(dto.entityTypeId).toBe('11111111-1111-1111-1111-111111111111');
      expect(dto.status).toBe('ACTIVE');
      expect(dto.search).toBe('test');
      expect((dto as any).tenantFilter).toEqual({ tenantId: 'tenant-1' });
    });
  });

  describe('fromEntityToVO', () => {
    it('应根据实体生成正确的 VO', () => {
      const entity: any = {
        id: 'b1',
        entityType: 'USERBITMAP',
        entityTypeId: '22222222-2222-2222-2222-222222222222',
        sequence: 7,
        ownedBy: 'tenant-1',
        totalBits: 256,
        usedBits: [0, 1, 2],
        status: 'ACTIVE',
        createTime: new Date('2026-03-22T12:00:00Z'),
        updateTime: new Date('2026-03-23T12:00:00Z')
      };
      const vo = adapter.fromEntityToVO(entity);
      const shortId = entity.entityTypeId.replace(/-/g, '').substring(0, 8);
      expect(vo.tableName).toBe(`tag_bitmap_${shortId}_${entity.sequence}`);
      expect(vo.id).toBe(entity.id);
      expect(vo.totalBits).toBe(256);
      expect(vo.createTime).toBe(entity.createTime.toISOString());
      expect(vo.updateTime).toBe(entity.updateTime?.toISOString());
    });
  });
  
  describe('fromEntityToDetailVO', () => {
    it('应返回带位信息的详细 VO', () => {
      const entity: any = {
        id: 'b2',
        entityType: 'USERBITMAP',
        entityTypeId: '33333333-3333-3333-3333-333333333333',
        sequence: 2,
        ownedBy: 'tenant-1',
        totalBits: 64,
        usedBits: [0, 1],
        status: 'ACTIVE',
        createTime: new Date('2026-03-22T12:00:00Z'),
      };
      const bits = [{ index: 0 } as any, { index: 1 } as any];
      const detail = adapter.fromEntityToDetailVO(entity, bits as any);
      expect(detail.bits.length).toBe(2);
      expect(detail.id).toBe(entity.id);
      expect(detail.tableName).toBeDefined();
    });
  });
});
