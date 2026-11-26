import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.MADEVI_QA_HIDE_DEV_INDICATOR === "1" ? { devIndicators: false as const } : {}),
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ] }];
  },
};
export default nextConfig;

