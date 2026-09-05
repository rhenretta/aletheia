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
      // Only poll inside Docker containers if WATCHPACK_POLLING is explicitly enabled.
      // On macOS/Linux native host, use native fsevents to avoid high CPU and rapid recompile loops.
      const shouldPoll = process.env.WATCHPACK_POLLING === "true";
      config.watchOptions = {
        ...(shouldPoll ? { poll: 1000 } : {}),
        aggregateTimeout: 300,
        ignored: [
          "**/node_modules/**",
          "**/.next/**",
          "**/.git/**",
          "**/traces/**",
          "**/data/**",
          "**/docs/**",
        ],
      };
    }
    return config;
  },
  async headers() {
    if (process.env.NODE_ENV !== "production") {
      return [
        {
          source: "/:path*",
          headers: [
            {
              key: "Cache-Control",
              value: "no-store, no-cache, must-revalidate, proxy-revalidate",
            },
            {
              key: "Pragma",
              value: "no-cache",
            },
            {
              key: "Expires",
              value: "0",
            },
          ],
        },
      ];
    }
    return [];
  },
};

export default nextConfig;

