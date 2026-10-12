import type { NextConfig } from "next";

// 보안 헤더 (보안 점검 SEC-005)
// - 다른 사이트가 이 앱을 iframe에 넣어 클릭을 유도하지 못하게 한다(클릭재킹 방지)
// - 브라우저가 파일 형식을 추측하지 않게 하고, 다른 사이트로 주소 정보를 넘기지 않는다
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
