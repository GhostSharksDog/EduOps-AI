import { describe, it, expect, beforeEach } from 'vitest';
import { TargetTable, TargetTableStatus, TableType } from '@/modules/tag/domain/entities/TargetTable';

describe('TargetTable Entity', () => {
  let tt: TargetTable;

  beforeEach(() => {
    tt = new TargetTable(
      'tt-001',
      'orders',
      'Order',
      'order-001',
      'user-001',
      'CREATE TABLE orders (...);',
      TableType.PHYSICAL_TABLE,
      'tag-001',
      'tagVer-1',
      TargetTableStatus.DRAFT
    );
  });

  describe('constructor', () => {
    it('should initialize with required fields', () => {
      expect(tt.id).toBe('tt-001');
      expect(tt.tableName).toBe('orders');
    expect(tt.entityType).toBe('Order');
    expect(tt.entityTypeId).toBe('order-001');
    expect(tt.ownedBy).toBe('user-001');
    expect(tt.createTableSql).toBe('CREATE TABLE orders (...);');
    expect(tt.tableType).toBe(TableType.PHYSICAL_TABLE);
    expect(tt.status).toBe(TargetTableStatus.DRAFT);
  });

    it('should set optional fields when provided', () => {
      expect(tt.tagId).toBe('tag-001');
      expect(tt.tagVersionId).toBe('tagVer-1');
      expect(tt.errorMessage).toBeUndefined();
    });
  });

  describe('state checks', () => {
    it('status predicates reflect current state', () => {
      expect(tt.isDraft()).toBe(true);
      expect(tt.isCreated()).toBe(false);
      expect(tt.isActive()).toBe(false);
      expect(tt.isInactive()).toBe(false);
      expect(tt.isCreateFailed()).toBe(false);
    });
  });

  describe('canTransition checks', () => {
    it('canCreateTable should be true in DRAFT', () => {
      expect(tt.canCreateTable()).toBe(true);
    });

    it('canActivate should be false in DRAFT', () => {
      expect(tt.canActivate()).toBe(false);
    });

    it('canDeactivate should be false in DRAFT', () => {
      expect(tt.canDeactivate()).toBe(false);
    });

    it('canDelete should be true in DRAFT', () => {
      expect(tt.canDelete()).toBe(true);
    });
  });

  describe('state transitions', () => {
    it('markAsCreated transitions from DRAFT to CREATED', () => {
      tt.markAsCreated();
      expect(tt.status).toBe(TargetTableStatus.CREATED);
      expect(tt.updateTime).toBeDefined();
      expect(tt.errorMessage).toBeUndefined();
    });

    it('markAsCreateFailed transitions from DRAFT to CREATE_FAILED', () => {
      tt.markAsCreateFailed('err');
      expect(tt.status).toBe(TargetTableStatus.CREATE_FAILED);
      expect(tt.errorMessage).toBe('err');
      expect(tt.updateTime).toBeDefined();
    });

    it('activating from CREATED works', () => {
      tt.markAsCreated();
      tt.activate();
      expect(tt.status).toBe(TargetTableStatus.ACTIVE);
      expect(tt.activatedAt).toBeDefined();
      expect(tt.updateTime).toBeDefined();
    });

    it('deactivate from ACTIVE works', () => {
      tt.markAsCreated();
      tt.activate();
      tt.deactivate();
      expect(tt.status).toBe(TargetTableStatus.INACTIVE);
      expect(tt.deactivatedAt).toBeDefined();
      expect(tt.updateTime).toBeDefined();
    });

    it('resetToDraft from CREATE_FAILED works', () => {
      tt.markAsCreateFailed('err');
      tt.resetToDraft();
      expect(tt.status).toBe(TargetTableStatus.DRAFT);
      expect(tt.errorMessage).toBeUndefined();
      expect(tt.updateTime).toBeDefined();
    });
  
    it('linkTag allowed only for CREATED/ACTIVE', () => {
      expect(() => tt.linkTag('tag-002', 'tagVer-2')).toThrow();
      tt.markAsCreated();
      tt.linkTag('tag-002', 'tagVer-2');
      expect(tt.tagId).toBe('tag-002');
      expect(tt.tagVersionId).toBe('tagVer-2');
      expect(tt.updateTime).toBeDefined();
      
      tt.activate();
      tt.linkTag('tag-003', 'tagVer-3');
      expect(tt.tagId).toBe('tag-003');
      expect(tt.tagVersionId).toBe('tagVer-3');
    });
  
  });

  describe('updateStats', () => {
    it('should update rowCount and lastRefreshTime', () => {
      const now = new Date();
      tt.updateStats(123, now);
      expect(tt.rowCount).toBe(123);
      expect(tt.lastRefreshTime).toBe(now);
      expect(tt.updateTime).toBeDefined();
    });
  });

  describe('data conversion', () => {
    it('fromData and toData round-trip', () => {
      const data = {
        id: 'tt-002',
        tableName: 'items',
        entityType: 'Item',
        entityTypeId: 'item-001',
        ownedBy: 'user-002',
        createTableSql: 'CREATE TABLE items (...)',
        tableType: TableType.VIEW,
        tagId: 'tag-002',
        tagVersionId: 'ver-001',
        status: TargetTableStatus.DRAFT,
        errorMessage: undefined,
        activatedAt: undefined,
        deactivatedAt: undefined,
        rowCount: 5,
        lastRefreshTime: new Date('2026-01-01T00:00:00Z'),
        createTime: new Date('2026-01-01T00:00:00Z'),
        updateTime: new Date('2026-01-01T01:00:00Z'),
      } as any;
      const tt2 = TargetTable.fromData(data);
      const dataBack = tt2.toData();
      expect(dataBack.id).toBe(data.id);
      expect(dataBack.tableName).toBe(data.tableName);
      expect(dataBack.entityType).toBe(data.entityType);
      expect(dataBack.status).toBe(data.status);
      expect(dataBack.tableType).toBe(data.tableType);
      expect(dataBack.createTime).toBe(data.createTime);
      expect(dataBack.lastRefreshTime).toBe(data.lastRefreshTime);
    });
  });
});
