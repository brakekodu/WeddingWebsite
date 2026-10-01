import type { NextConfig } from "next";

const baseSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Invitation URLs are bearer credentials: never leak them via Referer,
// never let search engines index them.
const privateRouteHeaders = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: baseSecurityHeaders },
      { source: "/i/:path*", headers: privateRouteHeaders },
      { source: "/rsvp", headers: privateRouteHeaders },
      { source: "/admin/:path*", headers: privateRouteHeaders },
    ];
  },
};

export default nextConfig;
