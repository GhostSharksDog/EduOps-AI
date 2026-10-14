import { describe, it, expect, beforeEach } from 'vitest';
import { TagFactoryImpl } from '@/modules/tag/domain/factories/TagFactoryImpl';
import { CreateTagCommand, CreateTagVersionCommand, CreateTagCategoryCommand } from '@/modules/tag/contracts/commands/index';
import { TagValueType, UpdateCycle, RuleType } from '@/shared/enums/index';

describe('TagFactoryImpl', () => {
  let factory: TagFactoryImpl;

  beforeEach(() => {
    factory = new TagFactoryImpl();
  });

  describe('createTag', () => {
    it('should create a valid tag with required fields', () => {
      const command: CreateTagCommand = {
        name: 'Test Tag',
        valueType: TagValueType.BOOLEAN,
        categoryId: 'category-123',
        createdBy: 'user-123'
      };

      const tag = factory.createTag(command);

      expect(tag.id).toBeDefined();
      expect(tag.name).toBe('Test Tag');
      expect(tag.dataType).toBe(TagValueType.BOOLEAN);
      expect(tag.categoryId).toBe('category-123');
      expect(tag.status).toBe('DRAFT');
      expect(tag.isDeleted).toBe(false);
    });

    it('should create tag with optional fields', () => {
      const command: CreateTagCommand = {
        name: 'Test Tag',
        valueType: TagValueType.STRING,
        categoryId: 'category-123',
        description: 'Test description',
        updateCycle: UpdateCycle.DAILY,
        createdBy: 'user-123'
      };

      const tag = factory.createTag(command);

      expect(tag.description).toBe('Test description');
      expect(tag.updateCycle).toBe(UpdateCycle.DAILY);
    });

    it('should create tag with feature when provided', () => {
      const command: CreateTagCommand = {
        name: 'Test Tag',
        valueType: TagValueType.NUMBER,
        categoryId: 'category-123',
        feature: {
          customProp: 'value'
        },
        createdBy: 'user-123'
      };

      const tag = factory.createTag(command);

      expect(tag.feature).toBeDefined();
      expect((tag.feature as Record<string, unknown>).customProp).toBe('value');
    });

    it('should initialize versions as empty array', () => {
      const command: CreateTagCommand = {
        name: 'Test Tag',
        valueType: TagValueType.BOOLEAN,
        categoryId: 'category-123',
        createdBy: 'user-123'
      };

      const tag = factory.createTag(command);

      expect(tag.versions).toEqual([]);
    });

    it('should set isPublic to false by default', () => {
      const command: CreateTagCommand = {
        name: 'Test Tag',
        valueType: TagValueType.BOOLEAN,
        categoryId: 'category-123',
        createdBy: 'user-123'
      };

      const tag = factory.createTag(command);

      expect(tag.isPublic).toBe(false);
    });

    it('should use isPublic from command when provided', () => {
      const command: CreateTagCommand = {
        name: 'Test Tag',
        valueType: TagValueType.BOOLEAN,
        categoryId: 'category-123',
        createdBy: 'user-123',
        isPublic: true
      };

      const tag = factory.createTag(command);

      expect(tag.isPublic).toBe(true);
    });

    it('should create initial version when rule is provided', () => {
      const command: CreateTagCommand = {
        name: 'Test Tag',
        valueType: TagValueType.STRING,
        categoryId: 'category-123',
        createdBy: 'user-123',
        rule: {
          ruleType: RuleType.SQL,
          ruleContent: 'SELECT 1',
          dataModelIds: ['model-1']
        },
        version: {
          version: 'v1.0.0',
          description: 'Initial version'
        }
      };

      const tag = factory.createTag(command);

      expect(tag.versions).toHaveLength(1);
      expect(tag.currentVersionId).toBe(tag.versions[0].id);
      expect(tag.currentVersion).toBeDefined();
    });

    it('should not create version when rule is not provided', () => {
      const command: CreateTagCommand = {
        name: 'Test Tag',
        valueType: TagValueType.STRING,
        categoryId: 'category-123',
        createdBy: 'user-123'
      };

      const tag = factory.createTag(command);

      expect(tag.versions).toHaveLength(0);
      expect(tag.currentVersionId).toBeUndefined();
    });

    it('should set ownedBy to a valid id', () => {
      const command: CreateTagCommand = {
        name: 'Test Tag',
        valueType: TagValueType.BOOLEAN,
        categoryId: 'category-123',
        createdBy: 'user-456'
      };

      const tag = factory.createTag(command);

      expect(tag.ownedBy).toBeDefined();
      expect(typeof tag.ownedBy).toBe('string');
    });

    it('should set createTime to current date', () => {
      const command: CreateTagCommand = {
        name: 'Test Tag',
        valueType: TagValueType.BOOLEAN,
        categoryId: 'category-123',
        createdBy: 'user-123'
      };

      const tag = factory.createTag(command);

      expect(tag.createTime).toBeInstanceOf(Date);
    });
  });

  describe('createTagVersion', () => {
    it('should create a valid tag version', () => {
      const command: CreateTagVersionCommand = {
        tagId: 'tag-123',
        version: 1,
        createdBy: 'user-123'
      };

      const tagVersion = factory.createTagVersion(command);

      expect(tagVersion.id).toBeDefined();
      expect(tagVersion.tagId).toBe('tag-123');
      expect(tagVersion.version).toBe(1);
    });

    it('should create tag version with rule', () => {
      const command: CreateTagVersionCommand = {
        tagId: 'tag-123',
        version: 1,
        rule: {
          ruleType: RuleType.SQL,
          ruleContent: 'SELECT * FROM users',
          dataModelIds: ['model-1']
        },
        createdBy: 'user-123'
      };

      const tagVersion = factory.createTagVersion(command);

      expect(tagVersion.calculationRule).toBeDefined();
      // calculationRule is JSON stringified
      const parsedRule = JSON.parse(tagVersion.calculationRule || '{}');
      expect(parsedRule.ruleType).toBe(RuleType.SQL);
      expect(parsedRule.ruleContent).toBe('SELECT * FROM users');
    });

    it('should create tag version with default rule when not provided', () => {
      const command: CreateTagVersionCommand = {
        tagId: 'tag-123',
        version: 2,
        createdBy: 'user-123'
      };

      const tagVersion = factory.createTagVersion(command);

      expect(tagVersion.calculationRule).toBeDefined();
      const parsedRule = JSON.parse(tagVersion.calculationRule || '{}');
      expect(parsedRule.ruleType).toBe(RuleType.SQL);
    });
  });

  describe('createTagCategory', () => {
    it('should create a valid category without parent', () => {
      const command: CreateTagCategoryCommand = {
        name: 'Test Category',
        description: 'Test description',
        orderIndex: 1,
        createdBy: 'user-123'
      };

      const category = factory.createTagCategory(command);

      expect(category.id).toBeDefined();
      expect(category.name).toBe('Test Category');
      expect(category.description).toBe('Test description');
      expect(category.orderIndex).toBe(1);
      expect(category.isDeleted).toBe(false);
    });

    it('should create category with parent', () => {
      const command: CreateTagCategoryCommand = {
        name: 'Sub Category',
        parentId: 'parent-123',
        description: 'Sub category description',
        orderIndex: 2,
        createdBy: 'user-123'
      };

      const category = factory.createTagCategory(command);

      expect(category.parentId).toBe('parent-123');
      expect(category.path).toContain('parent-123');
    });

    it('should create category with feature', () => {
      const command: CreateTagCategoryCommand = {
        name: 'Test Category',
        description: 'Test description',
        orderIndex: 1,
        feature: {
          customProp: 'value'
        },
        createdBy: 'user-123'
      };

      const category = factory.createTagCategory(command);

      expect(category.feature).toBeDefined();
      expect((category.feature as Record<string, unknown>).customProp).toBe('value');
    });

    it('should initialize tagCount to 0', () => {
      const command: CreateTagCategoryCommand = {
        name: 'Test Category',
        description: 'Test description',
        orderIndex: 1,
        createdBy: 'user-123'
      };

      const category = factory.createTagCategory(command);

      expect(category.tagCount).toBe(0);
    });

    it('should initialize children as empty array', () => {
      const command: CreateTagCategoryCommand = {
        name: 'Test Category',
        description: 'Test description',
        orderIndex: 1,
        createdBy: 'user-123'
      };

      const category = factory.createTagCategory(command);

      expect(category.children).toEqual([]);
    });

    it('should set createTime to current date', () => {
      const command: CreateTagCategoryCommand = {
        name: 'Test Category',
        description: 'Test description',
        orderIndex: 1,
        createdBy: 'user-123'
      };

      const category = factory.createTagCategory(command);

      expect(category.createTime).toBeInstanceOf(Date);
    });
  });
});
