/**
 * SeatMate 자동 초기화 Edge Function을 위한 타입 정의 파일
 * 
 * Deno 환경에서 실행되는 Supabase Edge Function을 위한 타입 정의를 제공합니다.
 * TypeScript 컴파일러가 Deno API와 사용되는 모듈을 인식할 수 있도록 돕니다.
 */

/**
 * Deno 환경을 위한 네임스페이스 정의
 */
declare namespace Deno {
  /** 환경 변수 관리를 위한 인터페이스 */
  export interface Env {
    /**
     * 환경 변수 값을 가져오는 함수
     * @param key 환경 변수 이름
     * @returns 환경 변수 값 또는 undefined
     */
    get(key: string): string | undefined;
  }
  
  /** 환경 변수 객체 */
  export const env: Env;
}

/**
 * Supabase JavaScript SDK를 위한 모듈 정의
 */
declare module 'https://esm.sh/@supabase/supabase-js@2' {
  /**
   * Supabase 클라이언트 인스턴스 생성 함수
   * @param supabaseUrl Supabase 프로젝트 URL
   * @param supabaseKey Supabase 프로젝트 API 키
   * @param options 추가 구성 옵션
   * @returns Supabase 클라이언트 인스턴스
   */
  export function createClient(
    supabaseUrl: string,
    supabaseKey: string,
    options?: any
  ): any;
}

/**
 * Deno 표준 라이브러리 HTTP 서버 모듈 정의
 */
declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  /**
   * HTTP 서버 시작 함수
   * @param handler 요청을 처리하는 함수
   */
  export function serve(handler: (request: Request) => Response | Promise<Response>): void;
}
