/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverComponentsExternalPackages: ["@langchain/langgraph", "@langchain/core", "zod", "pg"],
  },
  webpack: (config, { dev, isServer }) => {
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
