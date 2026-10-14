// 从types文件夹导入并重新导出，保持向后兼容?
export type { CalculationRule } from '@/modules/tag/domain/types/index';

// Value objects
export { MvConfig, MvConfig as MaterializedViewConfig } from '@/modules/tag/domain/value-objects/MaterializedViewConfig';
export { MvStep } from '@/modules/tag/domain/value-objects/MvStep';

// TagCalculationRule value object
export type {
  TagCalculationRule,
  SingleStepRule,
  CascadeStep,
  CascadeRule,
} from '@/modules/tag/domain/value-objects/TagCalculationRule';

export {
  isCascadeRule,
  isSingleStepRule,
  createSingleStepRule,
  createCascadeRule,
  validateRule,
} from '@/modules/tag/domain/value-objects/TagCalculationRule';

// DimensionColumn value object (INTERMEDIATE table support)
export type { DimensionColumn, InferColumnsResult, AggregateFunctionConfig } from '@/modules/tag/domain/value-objects/DimensionColumn';
