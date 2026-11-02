// Static export only (ADR-002): no API routes, no server actions, no Next.js server at runtime.
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};
export default nextConfig;
