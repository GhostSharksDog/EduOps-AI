import { describe, it, expect } from 'vitest';
import { userSchema } from '@/modules/identity/contracts/schemas/request/auth/userSchema';
import {
  testStrictObject,
  testRequiredFields,
  testStringConstraints,
} from '../../../../helpers/schema-test-utils';

describe('userSchema', () => {
  const validUserInput = {
    id: 'user-123',
    username: 'testuser',
    role: 'admin',
    realName: 'Test User',
    email: 'test@example.com',
  };

  describe('schema structure', () => {
    testStrictObject(userSchema, validUserInput);
  });

  describe('required fields', () => {
    testRequiredFields(userSchema, ['id', 'username', 'role', 'realName'], validUserInput);
    it('允许省略邮箱', () => {
      const { email, ...input } = validUserInput;
      expect(userSchema.safeParse(input).success).toBe(true);
    });
  });

  describe('id field', () => {
    testStringConstraints(userSchema, 'id', { ...validUserInput, id: 'user-123' }, {
      minLength: 1,
      allowEmpty: false,
    });
  });

  describe('username field', () => {
    testStringConstraints(userSchema, 'username', { ...validUserInput, username: 'testuser' }, {
      minLength: 1,
      allowEmpty: false,
    });
  });

  describe('role field', () => {
    testStringConstraints(userSchema, 'role', { ...validUserInput, role: 'admin' }, {
      minLength: 1,
      allowEmpty: false,
    });
  });

  describe('realName field', () => {
    testStringConstraints(userSchema, 'realName', { ...validUserInput, realName: 'Test User' }, {
      minLength: 1,
      allowEmpty: false,
    });
  });

  describe('email field', () => {
    it('accepts valid email', () => {
      const input = { ...validUserInput, email: 'user@example.com' };
      const result = userSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects invalid email format', () => {
      const input = { ...validUserInput, email: 'not-an-email' };
      const result = userSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('complete valid inputs', () => {
    it('accepts minimal valid user', () => {
      const result = userSchema.safeParse({
        id: 'id',
        username: 'user',
        role: 'role',
        realName: 'Name',
        email: 'user@example.com',
      });
      expect(result.success).toBe(true);
    });
  });
});
