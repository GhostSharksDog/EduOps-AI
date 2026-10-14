export class BitmapTable {
  constructor(
    public id: string,
    public entityType: string,          // 冗余字段，便于展示
    public entityTypeId: string,        // 项目内部实体类型 ID
    public ownedBy: string,
    public sequence: number = 1,
    public totalBits: number = 64,
    public usedBits: number[] = [],
    public status: string = 'ACTIVE',
    public createTime: Date = new Date(),
    public updateTime?: Date,
    public name?: string,
    public description?: string,
    public chTableName?: string
  ) {}

  allocateBit(): number | null {
    if (!this.hasAvailableBit()) {
      return null;
    }

    const bitPosition = this.peekNextAvailableBit();
    if (bitPosition === null) {
      return null;
    }

    this.usedBits = [...this.usedBits, bitPosition].sort((a, b) => a - b);
    return bitPosition;
  }

  releaseBit(bitPosition: number): void {
    this.usedBits = this.usedBits.filter((b) => b !== bitPosition);
  }

  hasAvailableBit(): boolean {
    return this.usedBits.length < this.totalBits;
  }

  isBitUsed(bitPosition: number): boolean {
    return this.usedBits.includes(bitPosition);
  }

  peekNextAvailableBit(): number | null {
    for (let i = 0; i < this.totalBits; i++) {
      if (!this.usedBits.includes(i)) {
        return i;
      }
    }
    return null;
  }

  getAvailableBitCount(): number {
    return this.totalBits - this.usedBits.length;
  }

  getUsedBitCount(): number {
    return this.usedBits.length;
  }

  isValidBitPosition(bitPosition: number): boolean {
    return bitPosition >= 0 && bitPosition < this.totalBits;
  }

  deactivate(): void {
    this.status = 'INACTIVE';
    this.updateTime = new Date();
  }

  activate(): void {
    this.status = 'ACTIVE';
    this.updateTime = new Date();
  }

  static fromData(data: {
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
    name?: string;
    description?: string;
    chTableName?: string;
  }): BitmapTable {
    return new BitmapTable(
      data.id,
      data.entityType,
      data.entityTypeId,
      data.ownedBy,
      data.sequence,
      data.totalBits,
      data.usedBits,
      data.status,
      data.createTime,
      data.updateTime,
      data.name,
      data.description,
      data.chTableName
    );
  }

  toData(): {
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
    name?: string;
    description?: string;
    chTableName?: string;
  } {
    return {
      id: this.id,
      entityType: this.entityType,
      entityTypeId: this.entityTypeId,
      ownedBy: this.ownedBy,
      sequence: this.sequence,
      totalBits: this.totalBits,
      usedBits: this.usedBits,
      status: this.status,
      createTime: this.createTime,
      updateTime: this.updateTime,
      name: this.name,
      description: this.description,
      chTableName: this.chTableName,
    };
  }
}
