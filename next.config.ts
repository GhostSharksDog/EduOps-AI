import type {NextConfig} from "next";

const nextConfig: NextConfig = {
    output: 'standalone',
    distDir: process.env.NEXT_DIST_DIR || '.next',
    reactCompiler: true,
    reactStrictMode: false,
    serverExternalPackages: ['better-sqlite3'],
    // Windows原生图片编码器的DLL不会被默认依赖追踪收录。
    outputFileTracingIncludes: {
        '/*': ['./node_modules/@img/sharp-win32-x64/lib/*.dll'],
    },
};

export default nextConfig;
