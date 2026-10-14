export { AppException } from '@/shared/errors/base.exception';
export {
  ValidationException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BusinessException,
  SystemException,
  DatabaseException,
} from '@/shared/errors/exceptions';
export { ErrorCodes, getErrorConfig, getErrorStatus, getErrorMessage } from '@/shared/errors/error-codes';
export type { ErrorCode } from '@/shared/errors/error-codes';
