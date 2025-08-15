// utils/response.js

export function successResponse(data, meta = {}) {
  if (Buffer.isBuffer(data)) {
    return data; // if response is a binary, returns directly
  }
  return data;
}

export function errorResponse(message, meta = {}) {
  return ({
    success: false,
    message,
    meta
  });
}