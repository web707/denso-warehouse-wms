export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message || code || `HTTP ${status}`);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static async fromResponse(res) {
    let body = null;
    try {
      body = await res.json();
    } catch {
      // no JSON body
    }
    const message = res.status === 401
      ? 'API từ chối truy cập (401). Hãy triển khai backend đúng phiên bản hoặc kiểm tra cấu hình xác thực.'
      : (Array.isArray(body?.message) ? body.message.join('; ') : body?.message);
    return new ApiError(res.status, body?.code, message, body?.details);
  }
}
