/**
 * 应用异常基类
 * 
 * 所有业务异常都应继承此类
 */
export class AppException extends Error {
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(
    code: string,
    httpStatus: number,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppException';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
    this.timestamp = new Date();

    // 确保原型链正确 (TypeScript 编译到 ES5 时需要)
    Object.setPrototypeOf(this, AppException.prototype);
  }

  /**
   * 转换为 JSON 格式（用于日志和响应）
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      httpStatus: this.httpStatus,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }

  /**
   * 转换为 API 响应格式
   */
  toApiResponse(requestId?: string): Record<string, unknown> {
    const response: Record<string, unknown> = {
      code: this.code,
      message: this.message,
      status: this.httpStatus,
    };

    if (requestId) {
      response.requestId = requestId;
    }

    if (this.details && Object.keys(this.details).length > 0) {
      response.details = this.details;
    }

    return response;
  }
}
