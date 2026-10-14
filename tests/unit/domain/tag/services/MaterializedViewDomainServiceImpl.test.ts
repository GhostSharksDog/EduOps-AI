import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { MaterializedViewDomainServiceImpl } from '@/modules/tag/domain/services/MaterializedViewDomainServiceImpl';
import { IClickHouseClientAdapter, MvRefreshStatus } from '@/platform/database/interface/IClickHouseClientAdapter';
import { MvConfig, RefreshInterval } from '@/modules/tag/domain/value-objects/MaterializedViewConfig';
import { MvStep } from '@/modules/tag/domain/value-objects/MvStep';

/**
 * MaterializedViewDomainServiceImpl 单元测试
 * 
 * 测试覆盖：
 * - createMv: 单步骤 MV 创建、级联 MV 创建、错误传播
 * - deleteMv: 倒序删除、错误捕获继续执行
 * - stopMv / startMv: 遍历操作、错误捕获继续执行
 * - getRefreshStatus: 状态对象转换、null 处理
 * 
 * Mock 依赖：
 * - IClickHouseClientAdapter
 */
describe('MaterializedViewDomainServiceImpl', () => {
  let service: MaterializedViewDomainServiceImpl;
  let mockChClient: IClickHouseClientAdapter;

  beforeEach(() => {
    // Mock ClickHouse Client
    mockChClient = {
      testConnection: vi.fn(),
      query: vi.fn(),
      execute: vi.fn(),
      createMaterializedView: vi.fn(),
      createTable: vi.fn(),
      convertToLocalNonReplicated: vi.fn(),
      getMvTargetTable: vi.fn(),
      createBitmapMaterializedView: vi.fn(),
      createEnumBitmapTable: vi.fn(),
      createEnumBitmapMaterializedView: vi.fn(),
      dropMaterializedView: vi.fn(),
      dropTable: vi.fn(),
      stopView: vi.fn(),
      startView: vi.fn(),
      getRefreshStatus: vi.fn(),
      checkTableExists: vi.fn(),
      resetBitmapBit: vi.fn(),
      syncTagBitmap: vi.fn(),
    };

    service = new MaterializedViewDomainServiceImpl(mockChClient);
  });

  describe('createMv', () => {
    describe('single step MV', () => {
      it('should create single step MV with provided SQL', async () => {
        // Arrange
        const config = new MvConfig(
          'mv_tag_123_v1',
          'tag_value_123_v1',
          RefreshInterval.DAILY,
          [] // No steps = single step MV
        );
        const sql = 'SELECT user_id, tag_value FROM source_table';

        (mockChClient.createMaterializedView as Mock).mockResolvedValue(undefined);

        // Act
        await service.createMv(config, sql);

        // Assert
        expect(mockChClient.createMaterializedView).toHaveBeenCalledWith(
          'mv_tag_123_v1',
          'tag_value_123_v1',
          RefreshInterval.DAILY,
          sql, false
        );
      });

      it('should throw error when SQL is not provided for single step MV', async () => {
        // Arrange
        const config = new MvConfig(
          'mv_tag_123_v1',
          'tag_value_123_v1',
          RefreshInterval.DAILY,
          []
        );

        // Act & Assert
        await expect(service.createMv(config)).rejects.toThrow(
          '单步骤 MV 需要提供 SQL'
        );
      });

      it('should propagate error when ClickHouse fails', async () => {
        // Arrange
        const config = new MvConfig(
          'mv_tag_123_v1',
          'tag_value_123_v1',
          RefreshInterval.DAILY,
          []
        );
        const sql = 'SELECT * FROM table';

        (mockChClient.createMaterializedView as Mock).mockRejectedValue(
          new Error('ClickHouse connection failed')
        );

        // Act & Assert
        await expect(service.createMv(config, sql)).rejects.toThrow(
          'ClickHouse connection failed'
        );
      });
    });

    describe('cascade MV', () => {
      it('should create cascade MV with multiple steps in order', async () => {
        // Arrange
        const steps = [
          new MvStep(1, 'SELECT user_id FROM users', 'tag_value_123_v1_step1', 'mv_tag_123_v1_step1'),
          new MvStep(2, 'SELECT user_id, value FROM step1', 'tag_value_123_v1_step2', 'mv_tag_123_v1_step2'),
          new MvStep(3, 'SELECT * FROM step2', 'tag_value_123_v1', 'mv_tag_123_v1'),
        ];
        const config = new MvConfig(
          'mv_tag_123_v1',
          'tag_value_123_v1',
          RefreshInterval.HOURLY,
          steps
        );

        (mockChClient.createMaterializedView as Mock).mockResolvedValue(undefined);

        // Act
        await service.createMv(config);

        // Assert - should create each step in order
        expect(mockChClient.createMaterializedView).toHaveBeenCalledTimes(3);
        expect(mockChClient.createMaterializedView).toHaveBeenNthCalledWith(
          1,
          'mv_tag_123_v1_step1',
          'tag_value_123_v1_step1',
          RefreshInterval.HOURLY,
          'SELECT user_id FROM users', false
        );
        expect(mockChClient.createMaterializedView).toHaveBeenNthCalledWith(
          2,
          'mv_tag_123_v1_step2',
          'tag_value_123_v1_step2',
          RefreshInterval.HOURLY,
          'SELECT user_id, value FROM step1', false
        );
        expect(mockChClient.createMaterializedView).toHaveBeenNthCalledWith(
          3,
          'mv_tag_123_v1',
          'tag_value_123_v1',
          RefreshInterval.HOURLY,
          'SELECT * FROM step2', false
        );
      });

      it('should apply variable replacements to cascade steps', async () => {
        // Arrange
        const steps = [
          new MvStep(
            1,
            'SELECT {tagId}, {version} FROM users',
            'tag_value_abc_v2_step1',
            'mv_tag_abc_v2_step1',
            'abc', 2
          ),
        ];
        const config = new MvConfig(
          'mv_tag_abc_v2',
          'tag_value_abc_v2',
          RefreshInterval.DAILY,
          steps
        );

        (mockChClient.createMaterializedView as Mock).mockResolvedValue(undefined);

        // Act
        await service.createMv(config);

        // Assert - variables should be replaced
        expect(mockChClient.createMaterializedView).toHaveBeenCalledWith(
          'mv_tag_abc_v2_step1',
          'tag_value_abc_v2_step1',
          RefreshInterval.DAILY,
          'SELECT abc, 2 FROM users', false // {tagId} -> abc, {version} -> 2
        );
      });

      it('should propagate error when cascade step fails', async () => {
        // Arrange
        const steps = [
          new MvStep(1, 'SELECT * FROM step1', 'tag_value_123_v1_step1', 'mv_tag_123_v1_step1'),
          new MvStep(2, 'SELECT * FROM step2', 'tag_value_123_v1', 'mv_tag_123_v1'),
        ];
        const config = new MvConfig(
          'mv_tag_123_v1',
          'tag_value_123_v1',
          RefreshInterval.DAILY,
          steps
        );

        (mockChClient.createMaterializedView as Mock)
          .mockResolvedValueOnce(undefined) // First step succeeds
          .mockRejectedValueOnce(new Error('Step 2 failed')); // Second step fails

        // Act & Assert
        await expect(service.createMv(config)).rejects.toThrow('Step 2 failed');
        expect(mockChClient.createMaterializedView).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('deleteMv', () => {
    it('should delete MVs and tables in REVERSE order', async () => {
      // Arrange
      const steps = [
        new MvStep(1, 'sql1', 'table_step1', 'mv_step1'),
        new MvStep(2, 'sql2', 'table_step2', 'mv_step2'),
        new MvStep(3, 'sql3', 'table_final', 'mv_final'),
      ];
      const config = new MvConfig(
        'mv_final',
        'table_final',
        RefreshInterval.DAILY,
        steps
      );

      (mockChClient.dropMaterializedView as Mock).mockResolvedValue(undefined);
      (mockChClient.dropTable as Mock).mockResolvedValue(undefined);

      // Act
      await service.deleteMv(config);

      // Assert - MVs deleted in reverse order
      expect(mockChClient.dropMaterializedView).toHaveBeenCalledTimes(3);
      expect(mockChClient.dropMaterializedView).toHaveBeenNthCalledWith(1, 'mv_final');
      expect(mockChClient.dropMaterializedView).toHaveBeenNthCalledWith(2, 'mv_step2');
      expect(mockChClient.dropMaterializedView).toHaveBeenNthCalledWith(3, 'mv_step1');

      // Assert - Tables deleted in reverse order
      expect(mockChClient.dropTable).toHaveBeenCalledTimes(3);
      expect(mockChClient.dropTable).toHaveBeenNthCalledWith(1, 'table_final');
      expect(mockChClient.dropTable).toHaveBeenNthCalledWith(2, 'table_step2');
      expect(mockChClient.dropTable).toHaveBeenNthCalledWith(3, 'table_step1');
    });

    it('should delete single MV and table for non-cascade config', async () => {
      // Arrange
      const config = new MvConfig(
        'mv_single',
        'table_single',
        RefreshInterval.DAILY,
        []
      );

      (mockChClient.dropMaterializedView as Mock).mockResolvedValue(undefined);
      (mockChClient.dropTable as Mock).mockResolvedValue(undefined);

      // Act
      await service.deleteMv(config);

      // Assert
      expect(mockChClient.dropMaterializedView).toHaveBeenCalledWith('mv_single');
      expect(mockChClient.dropTable).toHaveBeenCalledWith('table_single');
    });

    it('should continue deletion even if one MV fails (error is caught)', async () => {
      // Arrange
      const steps = [
        new MvStep(1, 'sql1', 'table1', 'mv1'),
        new MvStep(2, 'sql2', 'table2', 'mv2'),
        new MvStep(3, 'sql3', 'table3', 'mv3'),
      ];
      const config = new MvConfig(
        'mv3',
        'table3',
        RefreshInterval.DAILY,
        steps
      );

      (mockChClient.dropMaterializedView as Mock)
        .mockRejectedValueOnce(new Error('MV not found')) // mv3 fails
        .mockResolvedValueOnce(undefined) // mv2 succeeds
        .mockResolvedValueOnce(undefined); // mv1 succeeds
      (mockChClient.dropTable as Mock).mockResolvedValue(undefined);

      // Act - should not throw
      await service.deleteMv(config);

      // Assert - all MVs should be attempted
      expect(mockChClient.dropMaterializedView).toHaveBeenCalledTimes(3);
    });

    it('should continue table deletion even if one table fails', async () => {
      // Arrange
      const steps = [
        new MvStep(1, 'sql1', 'table1', 'mv1'),
        new MvStep(2, 'sql2', 'table2', 'mv2'),
      ];
      const config = new MvConfig(
        'mv2',
        'table2',
        RefreshInterval.DAILY,
        steps
      );

      (mockChClient.dropMaterializedView as Mock).mockResolvedValue(undefined);
      (mockChClient.dropTable as Mock)
        .mockRejectedValueOnce(new Error('Table not found')) // table2 fails
        .mockResolvedValueOnce(undefined); // table1 succeeds

      // Act - should not throw
      await service.deleteMv(config);

      // Assert - all tables should be attempted
      expect(mockChClient.dropTable).toHaveBeenCalledTimes(2);
    });

    it('should delete MVs before tables', async () => {
      // Arrange
      const config = new MvConfig(
        'mv_test',
        'table_test',
        RefreshInterval.DAILY,
        []
      );

      const callOrder: string[] = [];
      (mockChClient.dropMaterializedView as Mock).mockImplementation(async () => {
        callOrder.push('dropMV');
      });
      (mockChClient.dropTable as Mock).mockImplementation(async () => {
        callOrder.push('dropTable');
      });

      // Act
      await service.deleteMv(config);

      // Assert - MV should be deleted before table
      expect(callOrder).toEqual(['dropMV', 'dropTable']);
    });
  });

  describe('stopMv', () => {
    it('should stop all MVs', async () => {
      // Arrange
      const mvNames = ['mv1', 'mv2', 'mv3'];
      (mockChClient.stopView as Mock).mockResolvedValue(undefined);

      // Act
      await service.stopMv(mvNames);

      // Assert
      expect(mockChClient.stopView).toHaveBeenCalledTimes(3);
      expect(mockChClient.stopView).toHaveBeenCalledWith('mv1');
      expect(mockChClient.stopView).toHaveBeenCalledWith('mv2');
      expect(mockChClient.stopView).toHaveBeenCalledWith('mv3');
    });

    it('should continue stopping even if one MV fails', async () => {
      // Arrange
      const mvNames = ['mv1', 'mv2', 'mv3'];
      (mockChClient.stopView as Mock)
        .mockResolvedValueOnce(undefined) // mv1 succeeds
        .mockRejectedValueOnce(new Error('MV not found')) // mv2 fails
        .mockResolvedValueOnce(undefined); // mv3 succeeds

      // Act - should not throw
      await service.stopMv(mvNames);

      // Assert - all MVs should be attempted
      expect(mockChClient.stopView).toHaveBeenCalledTimes(3);
    });

    it('should handle empty array', async () => {
      // Act
      await service.stopMv([]);

      // Assert
      expect(mockChClient.stopView).not.toHaveBeenCalled();
    });
  });

  describe('startMv', () => {
    it('should start all MVs', async () => {
      // Arrange
      const mvNames = ['mv1', 'mv2', 'mv3'];
      (mockChClient.startView as Mock).mockResolvedValue(undefined);

      // Act
      await service.startMv(mvNames);

      // Assert
      expect(mockChClient.startView).toHaveBeenCalledTimes(3);
      expect(mockChClient.startView).toHaveBeenCalledWith('mv1');
      expect(mockChClient.startView).toHaveBeenCalledWith('mv2');
      expect(mockChClient.startView).toHaveBeenCalledWith('mv3');
    });

    it('should continue starting even if one MV fails', async () => {
      // Arrange
      const mvNames = ['mv1', 'mv2', 'mv3'];
      (mockChClient.startView as Mock)
        .mockRejectedValueOnce(new Error('MV not found')) // mv1 fails
        .mockResolvedValueOnce(undefined) // mv2 succeeds
        .mockResolvedValueOnce(undefined); // mv3 succeeds

      // Act - should not throw
      await service.startMv(mvNames);

      // Assert - all MVs should be attempted
      expect(mockChClient.startView).toHaveBeenCalledTimes(3);
    });

    it('should handle empty array', async () => {
      // Act
      await service.startMv([]);

      // Assert
      expect(mockChClient.startView).not.toHaveBeenCalled();
    });
  });

  describe('getRefreshStatus', () => {
    it('should return status object from ClickHouse client', async () => {
      // Arrange
      const mockStatus: MvRefreshStatus = {
        name: 'mv_test',
        last_refresh_time: '2024-01-15 10:30:00',
        last_exception: '',
        is_stale: 0,
      };
      (mockChClient.getRefreshStatus as Mock).mockResolvedValue(mockStatus);

      // Act
      const result = await service.getRefreshStatus('mv_test');

      // Assert
      expect(result).toEqual({
        name: 'mv_test',
        lastRefreshTime: new Date('2024-01-15 10:30:00'),
        lastException: '',
        isStale: false,
      });
    });

    it('should handle null last_refresh_time', async () => {
      // Arrange
      const mockStatus: MvRefreshStatus = {
        name: 'mv_test',
        last_refresh_time: undefined,
        last_exception: 'Some error',
        is_stale: 1,
      };
      (mockChClient.getRefreshStatus as Mock).mockResolvedValue(mockStatus);

      // Act
      const result = await service.getRefreshStatus('mv_test');

      // Assert
      expect(result).toEqual({
        name: 'mv_test',
        lastRefreshTime: undefined,
        lastException: 'Some error',
        isStale: true,
      });
    });

    it('should return null when MV not found', async () => {
      // Arrange
      (mockChClient.getRefreshStatus as Mock).mockResolvedValue(null);

      // Act
      const result = await service.getRefreshStatus('non_existent_mv');

      // Assert
      expect(result).toBeNull();
    });

    it('should correctly convert is_stale=1 to true', async () => {
      // Arrange
      const mockStatus: MvRefreshStatus = {
        name: 'mv_stale',
        last_refresh_time: '2024-01-10 00:00:00',
        last_exception: 'Connection timeout',
        is_stale: 1,
      };
      (mockChClient.getRefreshStatus as Mock).mockResolvedValue(mockStatus);

      // Act
      const result = await service.getRefreshStatus('mv_stale');

      // Assert
      expect(result?.isStale).toBe(true);
    });

    it('should correctly convert is_stale=0 to false', async () => {
      // Arrange
      const mockStatus: MvRefreshStatus = {
        name: 'mv_fresh',
        last_refresh_time: '2024-01-15 12:00:00',
        last_exception: '',
        is_stale: 0,
      };
      (mockChClient.getRefreshStatus as Mock).mockResolvedValue(mockStatus);

      // Act
      const result = await service.getRefreshStatus('mv_fresh');

      // Assert
      expect(result?.isStale).toBe(false);
    });

    it('should handle empty last_exception', async () => {
      // Arrange
      const mockStatus: MvRefreshStatus = {
        name: 'mv_test',
        last_refresh_time: '2024-01-15 10:30:00',
        last_exception: '',
        is_stale: 0,
      };
      (mockChClient.getRefreshStatus as Mock).mockResolvedValue(mockStatus);

      // Act
      const result = await service.getRefreshStatus('mv_test');

      // Assert
      expect(result?.lastException).toBe('');
    });
  });

  describe('错误处理', () => {
    it('should propagate ClickHouse errors in createMv', async () => {
      // Arrange
      const config = new MvConfig(
        'mv_test',
        'table_test',
        RefreshInterval.DAILY,
        []
      );
      (mockChClient.createMaterializedView as Mock).mockRejectedValue(
        new Error('Connection refused')
      );

      // Act & Assert
      await expect(service.createMv(config, 'SELECT 1')).rejects.toThrow(
        'Connection refused'
      );
    });

    it('should propagate ClickHouse errors in getRefreshStatus', async () => {
      // Arrange
      (mockChClient.getRefreshStatus as Mock).mockRejectedValue(
        new Error('Query timeout')
      );

      // Act & Assert
      await expect(service.getRefreshStatus('mv_test')).rejects.toThrow(
        'Query timeout'
      );
    });
  });
});
