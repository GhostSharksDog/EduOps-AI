import type {DbClient} from '@/platform/database';
/**
 * TagStorageConfig Repository 接口
 * 管理标签与 Bit 位置的关联关系
 */

export interface TagStorageConfigData {
  id: string;
  tagId: string;
  bitmapTableName: string;
  bitPosition: number | null;
  enumValue: string;
  storageType: string;
  entityType?: string | null;
  bitmapTableId?: string | null;
  ownedBy: string;
  createTime: Date;
  updateTime?: Date;
  deleteTime?: Date | null;
  createdBy?: string;
  updatedBy?: string;
  deletedBy?: string;
}

export interface CreateTagStorageConfigData {
  tagId: string;
  bitmapTableName: string;
  bitPosition: number | null;
  enumValue?: string;
  storageType: string;
  entityType?: string | null;
  bitmapTableId?: string | null;
  ownedBy: string;
  createdBy?: string;
}

export interface ITagStorageConfigRepository {
  /**
   * 根据标签 ID 查询配置
   * @param tagId 标签 ID
   * @returns 配置数据，不存在则返回 null
   */
  findByTagId(tagId: string): Promise<TagStorageConfigData | null>;

  /**
   * 根据标签 ID 查询所有配置（用于 ENUM 等多值类型）
   * @param tagId 标签 ID
   * @returns 配置数据列表
   */
  findAllByTagId(tagId: string): Promise<TagStorageConfigData[]>;

  /**
   * 根据 Bitmap 表 ID 和 Bit 位置查询配置
   * @param bitmapTableId Bitmap 表 ID
   * @param bitPosition Bit 位置
   * @returns 配置数据，不存在则返回 null
   */
  findByBitmapIdAndBitPosition(
    bitmapTableId: string,
    bitPosition: number
  ): Promise<TagStorageConfigData | null>;

  /**
   * 创建配置记录
   * @param data 创建数据
   * @param tx 可选的 数据库事务客户端
   * @returns 创建的配置数据
   */
  create(data: CreateTagStorageConfigData, tx?: DbClient): Promise<TagStorageConfigData>;

  /**
   * 软删除配置记录
   * @param id 配置 ID
   * @param deletedBy 删除者 ID
   * @param tx 可选的 数据库事务客户端
   */
  delete(id: string, deletedBy?: string, tx?: DbClient): Promise<void>;

  /**
   * 根据 ID 查询配置
   * @param id 配置 ID
   * @returns 配置数据，不存在则返回 null
   */
  findById(id: string): Promise<TagStorageConfigData | null>;

  /**
   * 根据标签 ID 查询配置（包含已软删除的记录）
   * 用于清理孤立记录
   * @param tagId 标签 ID
   * @returns 配置数据，不存在则返回 null
   */
  findAnyByTagId(tagId: string): Promise<TagStorageConfigData | null>;

  /**
   * 根据标签 ID 和枚举值查询配置（包含已软删除的记录）
   */
  findAnyByTagIdAndEnumValue(tagId: string, enumValue: string): Promise<TagStorageConfigData | null>;

  /**
   * 根据 Bitmap 表 ID 和 Bit 位置查询配置（包含已软删除的记录）
   * 用于检测唯一约束冲突
   */
  findAnyByBitmapIdAndBitPosition(
    bitmapTableId: string,
    bitPosition: number
  ): Promise<TagStorageConfigData | null>;

  /**
   * 更新配置记录（用于恢复软删除或更新字段）
   * @param id 配置 ID
   * @param data 更新数据
   * @returns 更新后的配置数据
   */
  update(id: string, data: {
    bitmapTableName?: string;
    bitPosition?: number | null;
    storageType?: string;
    entityType?: string | null;
    bitmapTableId?: string | null;
    updatedBy?: string;
    restore?: boolean;
  }, tx?: DbClient): Promise<TagStorageConfigData>;
}
