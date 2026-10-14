
export interface BaseVO {
  id: string;
  ownedBy?: string | null;
  isDeleted: boolean;
  createTime: string;
  updateTime?: string | null;
  deleteTime?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  deletedBy?: string | null;
}

export interface ExtensibleBaseVO extends BaseVO {
  description?: string | null;
  feature?: unknown;
}
