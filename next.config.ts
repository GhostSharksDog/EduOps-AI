import type {NextConfig} from "next";

const nextConfig: NextConfig = {
    output: 'standalone',
    distDir: process.env.NEXT_DIST_DIR || '.next',
    reactCompiler: true,
    reactStrictMode: false,
    serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
