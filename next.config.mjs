/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverComponentsExternalPackages: ["@langchain/langgraph", "@langchain/core", "zod", "pg"],
  },
  webpack: (config, { dev, isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
      };
    }
    if (dev) {
      config.watchOptions = {
        poll: 800,
        aggregateTimeout: 200,
      };
    }
    return config;
  },
};

export default nextConfig;
