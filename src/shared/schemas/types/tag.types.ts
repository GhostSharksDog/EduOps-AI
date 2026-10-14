import type { ExtensibleBaseVO } from '@/shared/schemas/types/base.types';

export interface TagCategoryRef {
  id: string;
  name: string;
}

export interface TagVersionRef {
  id: string;
  version: string;
  isCurrent: boolean;
}

export interface TagVO extends ExtensibleBaseVO {
  name: string;
  categoryId: string;
  dataType: string;
  status: string;
  updateCycle: string;
  isPublic: boolean;
  currentVersionId?: string;
}

export interface TagVersionVO {
  id: string;
  tagId: string;
  version: string;
  description?: string;
  ruleId?: string;
  isCurrent: boolean;
  isDeleted: boolean;
  feature?: unknown;
  createTime: string;
  updateTime?: string;
  deleteTime?: string;
  createdBy?: string;
  updatedBy?: string;
  deletedBy?: string;
}
