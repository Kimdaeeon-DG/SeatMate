import { defineConfig } from 'vite';
import dotenv from 'dotenv';

// .env 파일 로드
dotenv.config();

export default defineConfig({
  // 환경 변수 설정
  define: {
    'process.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL),
    'process.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY),
  },
  // 개발 서버 설정
  server: {
    port: 3000,
    open: true,
  },
  // 빌드 설정
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
