export class AppError extends Error {
    status: number;
    code: string | number | undefined;
    constructor(message: string, status = 400, code?: string | number) {
        super(message);
        this.status = status;
        this.code = code;
    }
}
