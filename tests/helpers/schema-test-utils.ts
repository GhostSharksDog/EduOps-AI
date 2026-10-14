import { z } from 'zod';
import { describe, it, expect } from 'vitest';

/**
 * Test helper for Zod schema validation
 */
export function testSchema<T extends z.ZodTypeAny>({
  schema,
  validCases,
  invalidCases,
}: {
  schema: T;
  validCases: Array<{ input: unknown; description: string }>;
  invalidCases: Array<{
    input: unknown;
    description: string;
    expectedError?: string | RegExp;
    expectedPath?: (string | number)[];
  }>;
}) {
  if (validCases.length > 0) {
    describe('valid inputs', () => {
      validCases.forEach(({ input, description }) => {
        it(`accepts ${description}`, () => {
          const result = schema.safeParse(input);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data).toBeDefined();
          }
        });
      });
    });
  }

  if (invalidCases.length > 0) {
    describe('invalid inputs', () => {
      invalidCases.forEach(({ input, description, expectedError, expectedPath }) => {
        it(`rejects ${description}`, () => {
          const result = schema.safeParse(input);
          expect(result.success).toBe(false);
          if (!result.success) {
            const error = result.error;
            if (expectedError) {
              expect(error.issues[0].message).toMatch(expectedError);
            }
            if (expectedPath) {
              expect(error.issues[0].path).toEqual(expectedPath);
            }
          }
        });
      });
    });
  }
}

/**
 * Test helper for strict object validation (no extra properties)
 */
export function testStrictObject<T extends z.ZodTypeAny>(schema: T, validInput: unknown) {
  it('rejects extra properties (strict mode)', () => {
    const inputWithExtra = { ...validInput as object, extraField: 'not allowed' };
    const result = schema.safeParse(inputWithExtra);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].code).toBe('unrecognized_keys');
    }
  });
}

/**
 * Test helper for required fields
 */
export function testRequiredFields<T extends z.ZodTypeAny>(
  schema: T,
  requiredFields: string[],
  validInput: Record<string, unknown>
) {
  requiredFields.forEach((field) => {
    it(`requires ${field}`, () => {
      const inputWithoutField = { ...validInput };
      delete inputWithoutField[field];
      const result = schema.safeParse(inputWithoutField);
      expect(result.success).toBe(false);
      if (!result.success) {
        const fieldError = result.error.issues.find(e => e.path.join('.') === field);
        expect(fieldError).toBeDefined();
        expect(['invalid_type', 'invalid_value'].includes(fieldError?.code || '')).toBe(true);
      }
    });
  });
}

/**
 * Test helper for optional fields
 */
export function testOptionalFields<T extends z.ZodTypeAny>(
  schema: T,
  optionalFields: string[],
  validInput: Record<string, unknown>
) {
  optionalFields.forEach((field) => {
    it(`allows omitting optional field ${field}`, () => {
      const inputWithoutField = { ...validInput };
      delete inputWithoutField[field];
      const result = schema.safeParse(inputWithoutField);
      expect(result.success).toBe(true);
    });
  });
}

/**
 * Test helper for default values
 */
export function testDefaultValues<T extends z.ZodTypeAny>(
  schema: T,
  defaults: Record<string, unknown>,
  validInputWithoutDefaults: Record<string, unknown>
) {
  Object.entries(defaults).forEach(([field, expectedDefault]) => {
    it(`applies default value for ${field}`, () => {
      const inputWithoutField = { ...validInputWithoutDefaults };
      delete inputWithoutField[field];
      const result = schema.safeParse(inputWithoutField);
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>)[field]).toEqual(expectedDefault);
      }
    });
  });
}

/**
 * Test helper for string constraints
 */
export function testStringConstraints<T extends z.ZodTypeAny>(
  schema: T,
  field: string,
  validInput: Record<string, unknown>,
  constraints: {
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    allowEmpty?: boolean;
  }
) {
  const willHaveTests =
    constraints.minLength !== undefined ||
    constraints.maxLength !== undefined ||
    !constraints.allowEmpty;

  if (!willHaveTests) {
    return;
  }

  describe(`${field} string constraints`, () => {
    if (constraints.minLength !== undefined) {
      it(`rejects ${field} shorter than ${constraints.minLength} characters`, () => {
        const input = { ...validInput, [field]: 'a'.repeat(constraints.minLength! - 1) };
        const result = schema.safeParse(input);
        expect(result.success).toBe(false);
      });
    }

    if (constraints.maxLength !== undefined) {
      it(`rejects ${field} longer than ${constraints.maxLength} characters`, () => {
        const input = { ...validInput, [field]: 'a'.repeat(constraints.maxLength! + 1) };
        const result = schema.safeParse(input);
        expect(result.success).toBe(false);
      });
    }

    if (!constraints.allowEmpty) {
      it(`rejects empty string for ${field}`, () => {
        const input = { ...validInput, [field]: '' };
        const result = schema.safeParse(input);
        expect(result.success).toBe(false);
      });
    }
  });
}

/**
 * Test helper for enum validation
 */
export function testEnumValidation<T extends z.ZodTypeAny>(
  schema: T,
  field: string,
  validValues: string[],
  validInput: Record<string, unknown>
) {
  validValues.forEach((value) => {
    it(`accepts ${field} = "${value}"`, () => {
      const input = { ...validInput, [field]: value };
      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  it(`rejects invalid ${field} value`, () => {
    const input = { ...validInput, [field]: 'INVALID_VALUE' };
    const result = schema.safeParse(input);
    expect(result.success).toBe(false);
  });
}

/**
 * Test helper for array validation
 */
export function testArrayValidation<T extends z.ZodTypeAny>(
  schema: T,
  field: string,
  validInput: Record<string, unknown>,
  constraints?: { minItems?: number; maxItems?: number }
) {
  if (constraints?.minItems !== undefined && constraints.minItems > 0) {
    it(`rejects ${field} with fewer than ${constraints.minItems} items`, () => {
      const input = { ...validInput, [field]: [] };
      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
    });
  }

  it(`accepts valid ${field} array`, () => {
    const input = { ...validInput, [field]: (validInput[field] as unknown[]) || [] };
    const result = schema.safeParse(input);
    expect(result.success).toBe(true);
  });
}

/**
 * Test helper for UUID validation
 */
export function testUUIDValidation<T extends z.ZodTypeAny>(
  schema: T,
  field: string,
  validInput: Record<string, unknown>
) {
  it(`accepts valid UUID for ${field}`, () => {
    const input = { ...validInput, [field]: '123e4567-e89b-12d3-a456-426614174000' };
    const result = schema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it(`rejects invalid UUID for ${field}`, () => {
    const input = { ...validInput, [field]: 'not-a-uuid' };
    const result = schema.safeParse(input);
    expect(result.success).toBe(false);
  });
}

/**
 * Test helper for ISO datetime validation
 */
export function testISODateTimeValidation<T extends z.ZodTypeAny>(
  schema: T,
  field: string,
  validInput: Record<string, unknown>
) {
  describe(`${field} datetime validation`, () => {
    it(`accepts valid ISO datetime for ${field}`, () => {
      const input = { ...validInput, [field]: '2024-12-31T23:59:59.999Z' };
      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it(`rejects date-only format for ${field}`, () => {
      const input = { ...validInput, [field]: '2024-01-01' };
      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it(`rejects invalid datetime for ${field}`, () => {
      const input = { ...validInput, [field]: 'not-a-datetime' };
      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
}

/**
 * Test helper for number constraints
 */
export function testNumberConstraints<T extends z.ZodTypeAny>(
  schema: T,
  field: string,
  validInput: Record<string, unknown>,
  constraints: {
    min?: number;
    max?: number;
    isInteger?: boolean;
  }
) {
  describe(`${field} number constraints`, () => {
    if (constraints.min !== undefined) {
      it(`rejects ${field} < ${constraints.min}`, () => {
        const input = { ...validInput, [field]: constraints.min! - 1 };
        const result = schema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it(`accepts ${field} = ${constraints.min}`, () => {
        const input = { ...validInput, [field]: constraints.min };
        const result = schema.safeParse(input);
        expect(result.success).toBe(true);
      });
    }

    if (constraints.max !== undefined) {
      it(`rejects ${field} > ${constraints.max}`, () => {
        const input = { ...validInput, [field]: constraints.max! + 1 };
        const result = schema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it(`accepts ${field} = ${constraints.max}`, () => {
        const input = { ...validInput, [field]: constraints.max };
        const result = schema.safeParse(input);
        expect(result.success).toBe(true);
      });
    }

    if (constraints.isInteger) {
      it(`rejects float for ${field}`, () => {
        const input = { ...validInput, [field]: 1.5 };
        const result = schema.safeParse(input);
        expect(result.success).toBe(false);
      });
    }
  });
}

/**
 * Test helper for boolean validation
 */
export function testBooleanValidation<T extends z.ZodTypeAny>(
  schema: T,
  field: string,
  validInput: Record<string, unknown>
) {
  describe(`${field} boolean validation`, () => {
    it(`accepts true for ${field}`, () => {
      const input = { ...validInput, [field]: true };
      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it(`accepts false for ${field}`, () => {
      const input = { ...validInput, [field]: false };
      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it(`rejects string for ${field}`, () => {
      const input = { ...validInput, [field]: 'true' };
      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it(`rejects number for ${field}`, () => {
      const input = { ...validInput, [field]: 1 };
      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
}
