import { describe, it, expect } from 'vitest';
import { errorMessages, getErrorMessage } from '@/shared/schemas/common/errorMap';

describe('errorMessages', () => {
  describe('required field errors', () => {
    it('provides required field error message', () => {
      expect(errorMessages.required).toBeDefined();
      expect(typeof errorMessages.required).toBe('string');
      expect(errorMessages.required).toContain('不能为空');
    });
  });

  describe('string constraint errors', () => {
    it('provides minLength error message function', () => {
      expect(errorMessages.minLength).toBeDefined();
      expect(typeof errorMessages.minLength).toBe('function');
      
      const message = errorMessages.minLength(5);
      expect(message).toContain('5');
      expect(message).toContain('字符');
    });

    it('provides maxLength error message function', () => {
      expect(errorMessages.maxLength).toBeDefined();
      expect(typeof errorMessages.maxLength).toBe('function');
      
      const message = errorMessages.maxLength(100);
      expect(message).toContain('100');
      expect(message).toContain('字符');
    });
  });

  describe('number constraint errors', () => {
    it('provides minValue error message function', () => {
      expect(errorMessages.minValue).toBeDefined();
      expect(typeof errorMessages.minValue).toBe('function');
      
      const message = errorMessages.minValue(0);
      expect(message).toContain('0');
    });

    it('provides maxValue error message function', () => {
      expect(errorMessages.maxValue).toBeDefined();
      expect(typeof errorMessages.maxValue).toBe('function');
      
      const message = errorMessages.maxValue(100);
      expect(message).toContain('100');
    });
  });

  describe('type validation errors', () => {
    it('provides invalidType error message function', () => {
      expect(errorMessages.invalidType).toBeDefined();
      expect(typeof errorMessages.invalidType).toBe('function');
      
      const message = errorMessages.invalidType('string');
      expect(message).toContain('类型');
      expect(message).toContain('string');
    });

    it('provides invalidUUID error message', () => {
      expect(errorMessages.invalidUUID).toBeDefined();
      expect(typeof errorMessages.invalidUUID).toBe('string');
      expect(errorMessages.invalidUUID).toContain('UUID');
    });

    it('provides invalidEmail error message', () => {
      expect(errorMessages.invalidEmail).toBeDefined();
      expect(typeof errorMessages.invalidEmail).toBe('string');
      expect(errorMessages.invalidEmail).toContain('邮箱');
    });

    it('provides invalidURL error message', () => {
      expect(errorMessages.invalidURL).toBeDefined();
      expect(typeof errorMessages.invalidURL).toBe('string');
      expect(errorMessages.invalidURL).toContain('URL');
    });

    it('provides invalidDate error message', () => {
      expect(errorMessages.invalidDate).toBeDefined();
      expect(typeof errorMessages.invalidDate).toBe('string');
    });

    it('provides invalidDateTime error message', () => {
      expect(errorMessages.invalidDateTime).toBeDefined();
      expect(typeof errorMessages.invalidDateTime).toBe('string');
    });
  });

  describe('enum validation errors', () => {
    it('provides invalidEnum error message function', () => {
      expect(errorMessages.invalidEnum).toBeDefined();
      expect(typeof errorMessages.invalidEnum).toBe('function');
      
      const message = errorMessages.invalidEnum(['A', 'B', 'C']);
      expect(message).toContain('A');
      expect(message).toContain('B');
      expect(message).toContain('C');
    });

    it('provides invalidSortOrder error message', () => {
      expect(errorMessages.invalidSortOrder).toBeDefined();
      expect(typeof errorMessages.invalidSortOrder).toBe('string');
    });

    it('provides invalidExportFormat error message', () => {
      expect(errorMessages.invalidExportFormat).toBeDefined();
      expect(typeof errorMessages.invalidExportFormat).toBe('string');
    });

    it('provides invalidEncoding error message', () => {
      expect(errorMessages.invalidEncoding).toBeDefined();
      expect(typeof errorMessages.invalidEncoding).toBe('string');
    });

    it('provides invalidGranularity error message', () => {
      expect(errorMessages.invalidGranularity).toBeDefined();
      expect(typeof errorMessages.invalidGranularity).toBe('string');
    });

    it('provides invalidRefreshType error message', () => {
      expect(errorMessages.invalidRefreshType).toBeDefined();
      expect(typeof errorMessages.invalidRefreshType).toBe('string');
    });

    it('provides invalidStatus error message', () => {
      expect(errorMessages.invalidStatus).toBeDefined();
      expect(typeof errorMessages.invalidStatus).toBe('string');
    });

    it('provides invalidRuleType error message', () => {
      expect(errorMessages.invalidRuleType).toBeDefined();
      expect(typeof errorMessages.invalidRuleType).toBe('string');
    });
  });

  describe('business logic errors', () => {
    it('provides endTimeBeforeStart error message', () => {
      expect(errorMessages.endTimeBeforeStart).toBeDefined();
      expect(typeof errorMessages.endTimeBeforeStart).toBe('string');
    });

    it('provides duplicateName error message', () => {
      expect(errorMessages.duplicateName).toBeDefined();
      expect(typeof errorMessages.duplicateName).toBe('string');
    });

    it('provides notFound error message', () => {
      expect(errorMessages.notFound).toBeDefined();
      expect(typeof errorMessages.notFound).toBe('string');
    });

    it('provides permissionDenied error message', () => {
      expect(errorMessages.permissionDenied).toBeDefined();
      expect(typeof errorMessages.permissionDenied).toBe('string');
    });

    it('provides operationFailed error message', () => {
      expect(errorMessages.operationFailed).toBeDefined();
      expect(typeof errorMessages.operationFailed).toBe('string');
    });
  });
});

describe('getErrorMessage', () => {
  describe('with string error keys', () => {
    it('returns required error message', () => {
      const message = getErrorMessage('required');
      expect(message).toBe(errorMessages.required);
    });

    it('returns invalidUUID error message', () => {
      const message = getErrorMessage('invalidUUID');
      expect(message).toBe(errorMessages.invalidUUID);
    });

    it('returns invalidEmail error message', () => {
      const message = getErrorMessage('invalidEmail');
      expect(message).toBe(errorMessages.invalidEmail);
    });

    it('returns notFound error message', () => {
      const message = getErrorMessage('notFound');
      expect(message).toBe(errorMessages.notFound);
    });
  });

  describe('with parameterized error keys', () => {
    it('returns formatted minLength message with parameter', () => {
      const message = getErrorMessage('minLength', 10);
      expect(message).toContain('10');
    });

    it('returns formatted maxLength message with parameter', () => {
      const message = getErrorMessage('maxLength', 255);
      expect(message).toContain('255');
    });

    it('returns formatted minValue message with parameter', () => {
      const message = getErrorMessage('minValue', 0);
      expect(message).toContain('0');
    });

    it('returns formatted maxValue message with parameter', () => {
      const message = getErrorMessage('maxValue', 100);
      expect(message).toContain('100');
    });

    it('returns formatted invalidEnum message with array parameter', () => {
      const message = getErrorMessage('invalidEnum', ['ACTIVE', 'INACTIVE']);
      expect(message).toContain('ACTIVE');
      expect(message).toContain('INACTIVE');
    });

    it('returns formatted invalidType message with expected type', () => {
      const message = getErrorMessage('invalidType', 'string');
      expect(message).toContain('string');
    });
  });

  describe('Chinese language validation', () => {
    it('all error messages are in Chinese', () => {
      // Test a sample of string-based error messages
      const stringKeys: (keyof typeof errorMessages)[] = [
        'required',
        'invalidUUID',
        'invalidEmail',
        'invalidURL',
        'invalidDate',
        'invalidDateTime',
        'invalidSortOrder',
        'invalidExportFormat',
        'invalidEncoding',
        'invalidGranularity',
        'invalidRefreshType',
        'invalidStatus',
        'invalidRuleType',
        'endTimeBeforeStart',
        'duplicateName',
        'notFound',
        'permissionDenied',
        'operationFailed',
      ];

      stringKeys.forEach((key) => {
        const message = errorMessages[key];
        if (typeof message === 'string') {
          // Check that message contains Chinese characters
          const hasChinese = /[\u4e00-\u9fff]/.test(message);
          expect(hasChinese).toBe(true);
        }
      });
    });

    it('parameterized messages maintain Chinese format', () => {
      const message = getErrorMessage('minLength', 10);
      // Should contain Chinese characters alongside the number
      expect(/[\u4e00-\u9fff]/.test(message)).toBe(true);
      expect(message).toContain('10');
    });
  });

  describe('message consistency', () => {
    it('returns consistent messages for same key', () => {
      const message1 = getErrorMessage('required');
      const message2 = getErrorMessage('required');
      expect(message1).toBe(message2);
    });

    it('returns consistent messages for same parameters', () => {
      const message1 = getErrorMessage('minLength', 10);
      const message2 = getErrorMessage('minLength', 10);
      expect(message1).toBe(message2);
    });

    it('returns different messages for different parameters', () => {
      const message1 = getErrorMessage('minLength', 5);
      const message2 = getErrorMessage('minLength', 10);
      expect(message1).not.toBe(message2);
    });
  });
});
