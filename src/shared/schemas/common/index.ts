// 通用schema索引文件
export {
    baseSchema,
    extensibleBaseSchema,
    type BaseVO,
    type ExtensibleBaseVO,
    type BaseSchema,
    type ExtensibleBaseSchema,
} from '@/shared/schemas/common/baseSchema';
export {
    paginationQuerySchema, paginationResponseSchema, type PaginationQueryDTO, type PaginationResponse
} from '@/shared/schemas/common/paginationQuerySchema';
export {pagedResponseSchema, type PagedVO} from '@/shared/schemas/common/pagedResponseSchema';
export {errorMessages, getErrorMessage} from '@/shared/schemas/common/errorMap';
