import type {DbClient} from '@/platform/database';
import { TenantFilterOptions } from '@/platform/get-current-tenant';

export interface BitmapTableData {
  id: string;
  entityType: string;
  entityTypeId: string;
  ownedBy: string;
  sequence: number;
  totalBits: number;
  usedBits: number[];
  status: string;
  createTime: Date;
  updateTime?: Date;
  deleteTime?: Date | null;
  isDeleted?: boolean;
  name?: string;
  description?: string;
  chTableName?: string;
}

export interface AllocateBitResult {
  bitmapTableData: BitmapTableData;
  bitPosition: number;
  isNewTable: boolean;
}

export interface IBitmapTableRepository {
  create(data: BitmapTableData): Promise<BitmapTableData>;

  findById(id: string, tenantFilter?: TenantFilterOptions): Promise<BitmapTableData | null>;

  findByEntityTypeId(entityTypeId: string, includeDeleted?: boolean, tenantFilter?: TenantFilterOptions): Promise<BitmapTableData[]>;

  findActiveByEntityTypeId(entityTypeId: string, tenantFilter?: TenantFilterOptions): Promise<BitmapTableData | null>;

  findAll(tenantFilter?: TenantFilterOptions): Promise<BitmapTableData[]>;

  /**
   * @deprecated 使用 findByEntityTypeId 代替
   * @removal v2.0.0
   */
  findByEntityType(entityType: string): Promise<BitmapTableData[]>;

  /**
   * @deprecated 使用 findActiveByEntityTypeId 代替
   * @removal v2.0.0
   */
  findActiveByEntityType(entityType: string): Promise<BitmapTableData | null>;

  update(data: BitmapTableData, tenantFilter?: TenantFilterOptions): Promise<BitmapTableData>;

  delete(id: string): Promise<void>;

  /**
   * 原子性地分配一个位（解决并发竞态条件）
   * 使用 数据库事务 + 悲观锁确保并发安全
   * @param entityTypeId 实体类型ID
   * @param entityType 实体类型名称
   * @param tenantId 租户ID
   * @returns 分配结果，包含表数据、位号和是否为新表
   */
  allocateBitAtomically(
    entityTypeId: string,
    entityType: string,
    tenantId: string
  ): Promise<AllocateBitResult>;

  /**
   * 原子性地释放一个位
   * @param bitmapTableId Bitmap表ID
   * @param bitPosition 位位置
   * @returns 更新后的表数据，如果位未被使用则返回null
   */
  releaseBitAtomically(bitmapTableId: string, bitPosition: number): Promise<BitmapTableData | null>;

  /**
   * 手动分配指定的 Bit 位置
   * @param bitmapTableId Bitmap 表 ID
   * @param bitPosition 目标 Bit 位置 (0-63)
   * @param tx 可选的 数据库事务客户端
   * @returns 更新后的表数据
   * @throws Error 如果 Bit 已被占用
   */
  assignBitAt(bitmapTableId: string, bitPosition: number, tx?: DbClient): Promise<BitmapTableData>;

  /**
   * 手动释放指定的 Bit 位置（与 releaseBitAtomically 功能相同，提供语义化命名）
   * @param bitmapTableId Bitmap 表 ID
   * @param bitPosition 目标 Bit 位置 (0-63)
   * @param tx 可选的 数据库事务客户端
   * @returns 更新后的表数据，如果位未被使用则返回 null
   */
  releaseBitAt(bitmapTableId: string, bitPosition: number, tx?: DbClient): Promise<BitmapTableData | null>;
}
