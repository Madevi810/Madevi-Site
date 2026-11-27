const errors: Record<number, [code: string, message: string]> = {
  400: ["INVALID_INPUT", "Data permintaan tidak valid."],
  401: ["UNAUTHENTICATED", "Masuk untuk melanjutkan."],
  403: ["FORBIDDEN", "Permintaan tidak diizinkan."],
  404: ["NOT_FOUND", "Data tidak ditemukan."],
  409: ["CONFLICT", "Data telah berubah atau tindakan bertentangan dengan status saat ini."],
  413: ["BODY_TOO_LARGE", "Ukuran permintaan melebihi batas."],
  415: ["UNSUPPORTED_MEDIA", "Jenis berkas tidak didukung."],
  422: ["INVALID_INPUT", "Data permintaan tidak valid."],
  429: ["RATE_LIMITED", "Terlalu banyak permintaan."],
  500: ["INTERNAL_ERROR", "Permintaan belum dapat diproses."],
  503: ["UNAVAILABLE", "Layanan sementara tidak tersedia. Periksa hasil sebelum mencoba lagi."],
};

export function apiError(status: number, requestId: string, message?: string, inputHeaders?: HeadersInit) {
  const [code, fallback] = errors[status] ?? errors[status >= 500 ? 500 : 400];
  const headers = new Headers(inputHeaders);
  headers.set("x-request-id", requestId);
  headers.set("Cache-Control", "no-store");
  headers.delete("content-length");
  headers.set("Content-Type", "application/json");
  if (status === 429 && !headers.has("Retry-After")) headers.set("Retry-After", "60");
  return Response.json({error: {code, message: message || fallback}, requestId}, {status, headers});
}

export function logApiFailure(route: string, method: string, requestId: string, status: number) {
  console.warn(JSON.stringify({event: "api.failure", route, method, requestId, status, code: errors[status]?.[0] ?? "INTERNAL_ERROR", at: new Date().toISOString()}));
}

export function apiRoute<Args extends unknown[]>(route: string, method: string, handler: (...args: Args) => Response | Promise<Response>, preserveBody = false) {
  return async (...args: Args) => {
    const id = crypto.randomUUID();
    let response: Response;
    try {
      response = await handler(...args);
    } catch {
      response = preserveBody&&route.startsWith("/api/auth/")
        ? Response.json({code:"UNAVAILABLE",message:"Autentikasi sementara tidak tersedia."},{status:503,headers:{"Cache-Control":"no-store"}})
        : apiError(503, id);
    }
    if (response.status >= 500) logApiFailure(route, method, id, response.status);
    if (response.ok || response.status < 400 || preserveBody) {
      const headers=new Headers(response.headers);
      headers.set("x-request-id", id);
      return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    }
    let message: string | undefined;
    if (response.headers.get("Content-Type")?.startsWith("application/json")) {
      const data = await response.json().catch(() => null);
      const candidate = typeof data?.error === "string" ? data.error : data?.error?.message;
      if (typeof candidate === "string") message = candidate;
    }
    return apiError(response.status, id, message, response.headers);
  };
}
