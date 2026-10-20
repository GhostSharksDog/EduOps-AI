import {useCompanyUnitFixture} from '@/tests/helpers/company-unit-fixture';
const companyId=useCompanyUnitFixture();
/**
 * TargetTableOHSAdapterImpl 测试
 * 验证创建/更新命令的 JSON 解析、列表查询及实体到 VO 的转换
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TargetTableOHSAdapterImpl } from '@/modules/tag/services/target-table/TargetTableOHSAdapterImpl';
import type { NextRequest } from 'next/server';

describe('TargetTableOHSAdapterImpl', () => {
  let adapter: TargetTableOHSAdapterImpl;

  beforeEach(() => {
    adapter = new TargetTableOHSAdapterImpl();
  });

  describe('fromRequestToCreateCommandAsync', () => {
    it('应正确解析创建目标表的 payload', async () => {
      const payload = {
        tableName: 'tag_value_example_v1',
        entityType: 'USER',
        entityTypeId: '11111111-1111-4111-a111-111111111111',
        ownedBy: '22222222-2222-4222-b222-222222222222',
        createTableSql: 'CREATE TABLE test (id UUID);',
        tableType: 'PHYSICAL_TABLE',
        tagId: '33333333-3333-4333-a333-333333333333',
      };
      const req = { json: async () => payload } as any as NextRequest;
      const dto = await adapter.fromRequestToCreateCommandAsync(req);
      expect(dto).toMatchObject(payload);
    });
  });

  describe('fromRequestToUpdateCommandAsync', () => {
    it('应正确解析更新命令 payload', async () => {
      const payload = {
        tableName: 'tag_value_example_v2',
        createTableSql: 'CREATE TABLE updated (id UUID);',
        tableType: 'VIEW',
        tagId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
        tagVersionId: 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb'
      };
      const req = { json: async () => payload } as any as NextRequest;
      const dto = await adapter.fromRequestToUpdateCommandAsync(req);
      expect(dto).toMatchObject(payload);
    });
  });

  describe('fromRequestToListQuery', () => {
    it('应解析分页与筛选条件', () => {
      const req: any = {
        url: 'https://example.com/?status=DRAFT&entityTypeId=11111111-1111-4111-a111-111111111111&tagId=22222222-2222-4222-b222-222222222222&page=3&pageSize=25',
        nextUrl: new URL('https://example.com/?status=DRAFT&entityTypeId=11111111-1111-4111-a111-111111111111&tagId=22222222-2222-4222-b222-222222222222&page=3&pageSize=25'),
        headers: new Headers()
      };
      const dto = adapter.fromRequestToListQuery(req);
      expect(dto.status).toBe('DRAFT');
      expect(dto.entityTypeId).toBe('11111111-1111-4111-a111-111111111111');
      expect(dto.tagId).toBe('22222222-2222-4222-b222-222222222222');
      expect(dto.page).toBe(3);
      expect(dto.pageSize).toBe(25);
    });
  });

  describe('fromEntityToVO', () => {
    it('应根据 entity 生成正确的 VO', () => {
      const entity: any = {
        id: 'tb1',
        tableName: 'tag_bitmap_11111111_1',
        entityType: 'USER',
        entityTypeId: '11111111-1111-1111-1111-111111111111',
        ownedBy: 'tenant-1',
        createTableSql: 'CREATE TABLE ...',
        tableType: 'PHYSICAL_TABLE',
        sequence: 1,
        status: 'ACTIVE',
        createTime: new Date('2026-03-22T12:00:00Z'),
      };
      const vo = adapter.fromEntityToVO(entity);
      expect(vo.tableName).toBe(entity.tableName);
      expect(vo.id).toBe(entity.id);
      expect(vo.tableType).toBe('PHYSICAL_TABLE');
      // VO 不暴露未映射字段，此处仅验证必需字段映射正确
    });
  });
});
