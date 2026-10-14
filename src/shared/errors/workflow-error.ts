/** 可向用户显示的业务错误。 */
export class WorkflowError extends Error {
    constructor(message: string, public readonly status = 409, public readonly code?: string) { super(message); }
}
