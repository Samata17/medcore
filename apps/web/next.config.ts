import path from "node:path";
import type { NextConfig } from "next";

/** Security headers applied to every page. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Docker builds set NEXT_OUTPUT=standalone to produce a self-contained server (Vercel doesn't need it).
  ...(process.env.NEXT_OUTPUT === "standalone"
    ? { output: "standalone" as const, outputFileTracingRoot: path.resolve(process.cwd(), "../..") }
    : {}),
  // The shared types package ships TypeScript source, so Next compiles it.
  transpilePackages: ["@medcore/types"],
  /**
   * Optional sign-in proxy (NEXT_PUBLIC_AUTH_PROXY=true): /api/v1/auth/* on this website is
   * forwarded to the API so the refresh cookie is first-party. See src/lib/api.ts.
   */
  async rewrites() {
    if (process.env.NEXT_PUBLIC_AUTH_PROXY !== "true") return [];
    const api = process.env.NEXT_PUBLIC_API_URL ?? "";
    if (!/^https?:\/\//.test(api)) {
      throw new Error("NEXT_PUBLIC_AUTH_PROXY=true needs an absolute NEXT_PUBLIC_API_URL, e.g. https://api.example.com/api/v1");
    }
    return [{ source: "/api/v1/auth/:path*", destination: `${api.replace(/\/+$/, "")}/auth/:path*` }];
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
