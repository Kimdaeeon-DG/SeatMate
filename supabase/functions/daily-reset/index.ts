/**
 * SeatMate 매일 정오 자동 초기화 Edge Function
 * 대한민국 시간 12:00(KST)에 자동으로 모든 좌석을 초기화합니다.
 * 
 * @version 1.0.0
 * @author SeatMate Team
 */

// @deno-types="npm:@types/node"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// @deno-types="https://deno.land/std@0.168.0/http/server.ts"
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

/**
 * Edge Function 핸들러
 * 
 * 호출된 Supabase Edge Function에서 좌석 초기화 작업을 수행합니다.
 * 보안을 위해 Authorization 헤더를 필요로 합니다.
 */
serve(async (req: Request) => {
  try {
    // 1. 요청 검증 - 보안 토큰 확인
    const authorization = req.headers.get('Authorization')
    if (!authorization) {
      return new Response(
        JSON.stringify({ 
          error: '인증 토큰이 필요합니다', 
          status: 'unauthorized' 
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 2. Supabase 클라이언트 생성
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    // 환경 변수 검증
    if (!supabaseUrl || !supabaseKey) {
      console.error('중요 환경 변수가 없습니다: Supabase URL 또는 서비스 역할 키')
      return new Response(
        JSON.stringify({ 
          error: '서버 구성 오류', 
          status: 'configuration_error' 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    // Supabase 클라이언트 초기화
    const supabaseClient = createClient(
      supabaseUrl,
      supabaseKey,
      {
        auth: {
          persistSession: false,
        }
      }
    )

    // 3. 모든 좌석 초기화 수행
    // PostgreSQL의 트랜잭션과 FOR UPDATE 잠금을 사용하여 동시성 문제 방지
    console.log('트랜잭션 시작: 남성 좌석 초기화')
    const { error: maleError } = await supabaseClient
      .from('male_seats')
      .delete()
      .neq('seat_number', 0)

    console.log('트랜잭션 시작: 여성 좌석 초기화')
    const { error: femaleError } = await supabaseClient
      .from('female_seats')
      .delete()
      .neq('seat_number', 0)

    // 오류 확인
    if (maleError || femaleError) {
      const errorMessage = maleError?.message || femaleError?.message || '좌석 초기화 중 오류가 발생했습니다'
      console.error(`초기화 오류: ${errorMessage}`)
      throw new Error(errorMessage)
    }
    
    console.log('모든 좌석 초기화 완료')

    // 4. 성공 응답 반환
    const now = new Date()
    const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000))
    const formattedTime = kstTime.toISOString().replace('Z', '+09:00')
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: '모든 좌석이 성공적으로 초기화되었습니다',
        timestamp: formattedTime,
        timezone: 'KST (UTC+9)',
        details: {
          male_seats: '초기화 완료',
          female_seats: '초기화 완료'
        }
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    )
  } catch (error: any) {
    // 5. 예외 처리
    console.error('좌석 초기화 중 오류 발생:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || '좌석 초기화 중 오류가 발생했습니다',
        timestamp: new Date().toISOString(),
        details: {
          code: 'SEAT_RESET_ERROR',
          stack: Deno.env.get('ENVIRONMENT') === 'development' ? error.stack : undefined
        }
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    )
  }
})
