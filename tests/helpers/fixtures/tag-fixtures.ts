// tests/helpers/fixtures/tag-fixtures.ts
import { Tag } from '@/modules/tag/domain/entities/Tag';
import { TagCategory } from '@/modules/tag/domain/entities/TagCategory';
import { TagStatus, TagValueType, UpdateCycle } from '@/shared/enums/index';
import { generateTestUuid, TEST_USER_ID } from '../constants';

export function createTestTag(overrides: Partial<{
  id: string;
  name: string;
  dataType: TagValueType;
  status: TagStatus;
  updateCycle: UpdateCycle;
  ownedBy: string;
  categoryId: string;
  createdBy: string;
  isPublic: boolean;
  description: string;
}> = {}): Tag {
  return new Tag(
    overrides.id ?? generateTestUuid(),
    overrides.name ?? 'Test Tag',
    overrides.dataType ?? TagValueType.STRING,
    overrides.status ?? TagStatus.DRAFT,
    overrides.updateCycle ?? UpdateCycle.DAILY,
    overrides.ownedBy ?? TEST_USER_ID,
    overrides.categoryId ?? generateTestUuid(),
    new Date(),
    overrides.createdBy ?? TEST_USER_ID,
    overrides.isPublic ?? false,
    overrides.description
  );
}

export function createTestTagCategory(overrides: Partial<{
  id: string;
  name: string;
  path: string;
  orderIndex: number;
  ownedBy: string;
  createdBy: string;
  parentId: string;
  description: string;
}> = {}): TagCategory {
  return new TagCategory(
    overrides.id ?? generateTestUuid(),
    overrides.name ?? 'Test Category',
    overrides.path ?? '/test',
    overrides.orderIndex ?? 0,
    overrides.ownedBy ?? TEST_USER_ID,
    new Date(),
    overrides.createdBy ?? TEST_USER_ID,
    0,
    undefined,
    overrides.parentId,
    undefined,
    overrides.description
  );
}
