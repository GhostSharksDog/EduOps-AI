export interface BitAllocationResult {
  bitPosition: number;
  bitmapTableId: string;
  bitmapTableName: string;
  entityTypeId: string;
  entityType: string;
}

export interface MultiBitAllocationResult {
  positions: number[];
  bitmapTableId: string;
  bitmapTableName: string;
  entityTypeId: string;
  entityType: string;
}

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
  name?: string;
  description?: string;
  chTableName?: string;
}

export interface IBitmapManagementDomainService {
  allocateBit(entityTypeId: string, entityType: string, tenantId?: string): Promise<BitAllocationResult>;

  /**
   * 批量分配多个 Bit 位置（用于 ENUM 等多值标签类型）
   */
  allocateBits(entityTypeId: string, entityType: string, count: number, tenantId?: string): Promise<MultiBitAllocationResult>;

  releaseBit(bitmapTableId: string, bitPosition: number): Promise<void>;

  getOrCreateBitmapTable(entityTypeId: string, entityType: string, tenantId?: string): Promise<BitmapTableData>;

  findActiveByEntityTypeId(entityTypeId: string): Promise<BitmapTableData | null>;

  getBitmapTable(bitmapTableId: string): Promise<BitmapTableData | null>;

  resetBitmapBit(bitmapTableId: string, bitPosition: number): Promise<void>;

  checkBitAvailable(bitmapTableId: string, bitPosition: number): Promise<boolean>;
}
