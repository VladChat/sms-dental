import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const projectRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pin the file-tracing root to this project so Next.js does not climb up
  // and find a sibling lockfile at C:/Users/vladi/Documents/vcoding/.
  outputFileTracingRoot: projectRoot,
  typedRoutes: false,
};

export default nextConfig;
