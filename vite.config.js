import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// T8-penguin-canvas Vite 配置
// 端口策略:前端 11422 / 后端 18766(避开主项目 5176/18765 与常见 51xx 占用)
export default defineConfig({
    plugins: [react()],
    assetsInclude: ['**/*.mid'],
    optimizeDeps: {
        include: [
            '@xyflow/react',
            'lucide-react',
            'react',
            'react-dom',
            'react-dom/client',
            'zustand',
        ],
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 11422,
        strictPort: true,
        host: '127.0.0.1',
        warmup: {
            clientFiles: [
                './src/main.tsx',
                './src/App.tsx',
                './src/components/Canvas.tsx',
                './src/components/nodes/ImageNode.tsx',
                './src/components/nodes/UploadNode.tsx',
                './src/components/nodes/OutputNode.tsx',
            ],
        },
        proxy: {
            // 后端 API 代理
            '/api': {
                target: 'http://127.0.0.1:18766',
                changeOrigin: true,
            },
            // 静态文件服务代理
            '/files': {
                target: 'http://127.0.0.1:18766',
                changeOrigin: true,
            },
            '/output': {
                target: 'http://127.0.0.1:18766',
                changeOrigin: true,
            },
            '/input': {
                target: 'http://127.0.0.1:18766',
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false,
        rollupOptions: {
            output: {
                manualChunks: {
                    'react-vendor': ['react', 'react-dom'],
                    'xyflow': ['@xyflow/react'],
                },
            },
        },
    },
    define: {
        __APP_VERSION__: JSON.stringify('2.0.2'),
        __APP_NAME__: JSON.stringify('T8-penguin-canvas'),
    },
});
