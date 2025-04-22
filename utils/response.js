// utils/response.js

export function successResponse(data, meta = {}) {
    return ({
        success: true,
        data,
        meta
    })
}
export function errorResponse(message, meta = {}) {
    return ({
        success: false,
        message,
        meta
    })
}
