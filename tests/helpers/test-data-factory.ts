import { TagValueType, UpdateCycle } from '@/shared/enums/index';
import { 
  TEST_USER_ID, 
  TEST_ORG_ID, 
  TEST_CATEGORY_ID,
  generateTestUuid,
  generateTestId,
  TEST_DATABASE_CONFIG,
} from './constants';

export const TestDataFactory = {
  createTagPO(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
    const createTime = new Date('2024-01-01T00:00:00Z');
    return {
      id: generateTestUuid(),
      name: 'Test Tag',
      currentVersionId: null,
      categoryId: TEST_CATEGORY_ID,
      valueType: TagValueType.STRING,
      ownedBy: TEST_USER_ID,
      description: 'A test tag',
      isDeleted: false,
      isPublic: false,
      feature: { customField: 'value' },
      update_cycle: UpdateCycle.DAILY,
      createTime,
      updateTime: null,
      deleteTime: null,
      createdBy: TEST_USER_ID,
      updatedBy: null,
      deletedBy: null,
      ...overrides,
    };
  },

  createTagVersionPO(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
    const createTime = new Date('2024-01-01T00:00:00Z');
    return {
      id: generateTestUuid(),
      tagId: generateTestUuid(),
      version: 1,
      name: 'v1',
      description: 'First version',
      ownedBy: TEST_USER_ID,
      isCurrent: false,
      isDeleted: false,
      feature: {},
      createTime,
      updateTime: null,
      deleteTime: null,
      createdBy: TEST_USER_ID,
      updatedBy: null,
      deletedBy: null,
      value_type: TagValueType.STRING,
      calculationRule: '{}',
      ...overrides,
    };
  },

  createTagCategoryPO(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
    const createTime = new Date('2024-01-01T00:00:00Z');
    return {
      id: TEST_CATEGORY_ID,
      name: 'Test Category',
      parentId: null,
      path: '/test-category',
      description: 'Test category',
      orderIndex: 1,
      ownedBy: TEST_USER_ID,
      isDeleted: false,
      feature: {},
      createTime,
      updateTime: null,
      deleteTime: null,
      createdBy: TEST_USER_ID,
      updatedBy: null,
      deletedBy: null,
      ...overrides,
    };
  },
};
