export class ApiError extends Error {
    constructor(
        public readonly status: number,
        public readonly code: string,
        message: string,
        public readonly details?: Record<string, unknown>,
    ) {
        super(message);
    }
}

export const err = {
    unauthorized: (msg = "Invalid or missing license key") =>
        new ApiError(401, "unauthorized", msg),
    forbidden: (msg: string) => new ApiError(403, "forbidden", msg),
    siteLimit: (msg = "Site limit reached for this plan") =>
        new ApiError(403, "site_limit_reached", msg),
    quotaExceeded: (msg = "Monthly quota exceeded") =>
        new ApiError(402, "quota_exceeded", msg),
    payloadTooLarge: (max: number) =>
        new ApiError(413, "payload_too_large", `Image exceeds ${max} bytes`),
    unprocessable: (msg: string) => new ApiError(422, "unprocessable_image", msg),
    rateLimited: (msg = "Too many requests") => new ApiError(429, "rate_limited", msg),
};
