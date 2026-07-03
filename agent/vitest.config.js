import { defineConfig } from 'vitest/config';
import * as dotenv from '@dotenvx/dotenvx';
export default defineConfig({
    server: {
        fs: {
            // モノレポ内のファイルアクセスを許可
            allow: ['..'],
        },
    },
    build: {
        target: 'esnext',
        rollupOptions: {
            // ESModuleとして出力
            output: {
                format: 'es',
            },
        },
    },
    root: '.',
    test: {
        environment: 'node',
        globals: true,
        isolate: true,
        env: dotenv.config({ path: '.env.test' }).parsed,
        testTimeout: 30000,
    },
    // resolve: {
    //   conditions: ['development'],
    // }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidml0ZXN0LmNvbmZpZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInZpdGVzdC5jb25maWcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUM3QyxPQUFPLEtBQUssTUFBTSxNQUFNLGtCQUFrQixDQUFDO0FBRTNDLGVBQWUsWUFBWSxDQUFDO0lBQzFCLE1BQU0sRUFBRTtRQUNOLEVBQUUsRUFBRTtZQUNGLG9CQUFvQjtZQUNwQixLQUFLLEVBQUUsQ0FBQyxJQUFJLENBQUM7U0FDZDtLQUNGO0lBQ0QsS0FBSyxFQUFFO1FBQ0wsTUFBTSxFQUFFLFFBQVE7UUFDaEIsYUFBYSxFQUFFO1lBQ2IsZ0JBQWdCO1lBQ2hCLE1BQU0sRUFBRTtnQkFDTixNQUFNLEVBQUUsSUFBSTthQUNiO1NBQ0Y7S0FDRjtJQUNELElBQUksRUFBRSxHQUFHO0lBQ1QsSUFBSSxFQUFFO1FBQ0osV0FBVyxFQUFFLE1BQU07UUFDbkIsT0FBTyxFQUFFLElBQUk7UUFDYixPQUFPLEVBQUUsSUFBSTtRQUNiLEdBQUcsRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxDQUFDLENBQUMsTUFBTTtRQUNoRCxXQUFXLEVBQUUsS0FBSztLQUNuQjtJQUNELGFBQWE7SUFDYixpQ0FBaUM7SUFDakMsSUFBSTtDQUNMLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGVzdC9jb25maWcnO1xuaW1wb3J0ICogYXMgZG90ZW52IGZyb20gJ0Bkb3RlbnZ4L2RvdGVudngnO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBzZXJ2ZXI6IHtcbiAgICBmczoge1xuICAgICAgLy8g44Oi44OO44Os44Od5YaF44Gu44OV44Kh44Kk44Or44Ki44Kv44K744K544KS6Kix5Y+vXG4gICAgICBhbGxvdzogWycuLiddLFxuICAgIH0sXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgdGFyZ2V0OiAnZXNuZXh0JyxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICAvLyBFU01vZHVsZeOBqOOBl+OBpuWHuuWKm1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIGZvcm1hdDogJ2VzJyxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgcm9vdDogJy4nLFxuICB0ZXN0OiB7XG4gICAgZW52aXJvbm1lbnQ6ICdub2RlJyxcbiAgICBnbG9iYWxzOiB0cnVlLFxuICAgIGlzb2xhdGU6IHRydWUsXG4gICAgZW52OiBkb3RlbnYuY29uZmlnKHsgcGF0aDogJy5lbnYudGVzdCcgfSkucGFyc2VkLFxuICAgIHRlc3RUaW1lb3V0OiAzMDAwMCxcbiAgfSxcbiAgLy8gcmVzb2x2ZToge1xuICAvLyAgIGNvbmRpdGlvbnM6IFsnZGV2ZWxvcG1lbnQnXSxcbiAgLy8gfVxufSk7XG4iXX0=