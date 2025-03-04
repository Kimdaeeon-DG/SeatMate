// Supabase 설정
const SUPABASE_URL = 'https://tgshommuzbalotwormis.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnc2hvbW11emJhbG90d29ybWlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEwNzYwOTcsImV4cCI6MjA1NjY1MjA5N30.vzVHHXP9ez7DZQBe7FiApHnBPbc1tfDkk5G9jKjQKG8';

// Supabase 클라이언트 초기화 (오류 처리 추가)
let supabase;

// 실제 클라이언트 초기화 함수
function initSupabase() {
  try {
    // 이미 정의된 객체인지 확인
    if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      console.info('✅ Supabase가 초기화되었습니다.');
      return true;
    } else {
      console.warn('⚠️ Supabase 객체를 찾을 수 없습니다. 로컬 모드로 전환합니다.');
      return false;
    }
  } catch (error) {
    console.error('❌ Supabase 초기화 오류:', error);
    return false;
  }
}

// 폴백 객체 생성 - 오류가 발생해도 앱이 작동하도록
function createFallbackClient() {
  return {
    from: (table) => ({
      select: (query) => Promise.resolve({ data: [], error: null }),
      insert: (data) => Promise.resolve({ data: null, error: null }),
      delete: () => Promise.resolve({ data: null, error: null }),
      eq: () => Promise.resolve({ data: null, error: null })
    }),
    channel: (name) => ({
      on: () => ({
        subscribe: (callback) => { if (callback) callback('FALLBACK_MODE'); return { unsubscribe: () => {} }; }
      })
    })
  };
}

// 초기화 실행
if (!initSupabase()) {
  supabase = createFallbackClient();
  console.info('ℹ️ 로컬 모드로 실행됩니다. 좌석 정보가 서버에 저장되지 않습니다.');
}

// 실시간 구독 설정 (오류 처리 개선)
async function setupRealtimeSubscription() {
  try {
    // 테이블 존재 여부 확인 및 생성
    await createTableIfNotExists();
    
    // 실시간 구독 활성화 - 남성과 여성 테이블 모두 구독
    const channel = supabase.channel('public:seat_updates')
      // 남성 테이블 변경 구독
      .on('postgres_changes', { event: '*', schema: 'public', table: 'male_seats' }, payload => {
        console.log('✅ 남성 좌석 실시간 업데이트:', payload);
        // 성별 정보 추가
        const updatedData = { ...payload.new, gender: 'male' };
        // 좌석 상태 업데이트 이벤트 발생
        const event = new CustomEvent('seatsUpdated', { detail: updatedData });
        window.dispatchEvent(event);
      })
      // 여성 테이블 변경 구독
      .on('postgres_changes', { event: '*', schema: 'public', table: 'female_seats' }, payload => {
        console.log('✅ 여성 좌석 실시간 업데이트:', payload);
        // 성별 정보 추가
        const updatedData = { ...payload.new, gender: 'female' };
        // 좌석 상태 업데이트 이벤트 발생
        const event = new CustomEvent('seatsUpdated', { detail: updatedData });
        window.dispatchEvent(event);
      })
      // 시스템 정보 테이블 변경 구독 (초기화 정보)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_info' }, payload => {
        console.log('✅ 시스템 정보 업데이트:', payload);
        // 초기화 정보가 있는 경우 처리
        if (payload.new && payload.new.reset_timestamp) {
          // 초기화 이벤트 발생
          const resetEvent = new CustomEvent('seatsReset', { 
            detail: { timestamp: payload.new.reset_timestamp, id: payload.new.reset_id }
          });
          window.dispatchEvent(resetEvent);
        }
      })
      // 브로드캐스트 메시지 리스너 추가 - 좌석 초기화 이벤트 수신
      .on('broadcast', { event: 'seats-reset' }, payload => {
        console.log('🔄 좌석 초기화 브로드캐스트 메시지 수신:', payload);
        
        // 초기화 타임스태프 저장
        if (payload.payload && payload.payload.timestamp) {
            localStorage.setItem('lastResetTimestamp', payload.payload.timestamp);
        }
        
        // 사용자 ID 보존
        const userId = localStorage.getItem('userId');
        
        // 로컬 스토리지 초기화 - 모든 사용자의 좌석 정보 삭제
        localStorage.clear(); // 모든 로컬 스토리지 삭제
        
        // 사용자 ID 유지
        if (userId) {
            localStorage.setItem('userId', userId);
        }
        
        // 초기화 타임스태프 다시 저장
        if (payload.payload && payload.payload.timestamp) {
            localStorage.setItem('lastResetTimestamp', payload.payload.timestamp);
        }
        
        // 좌석 초기화 이벤트 발생
        const resetEvent = new CustomEvent('seatsReset', { 
            detail: payload.payload 
        });
        window.dispatchEvent(resetEvent);
        
        // 페이지 새로고침 - 모든 상태를 완전히 초기화하기 위해 필요
        setTimeout(() => {
          window.location.reload();
        }, 1000); // 이벤트가 완전히 처리되도록 딜레이 증가
      })
      .subscribe((status) => {
        console.log(`실시간 구독 상태: ${status}`);
      });
    
    // 전역 변수로 채널 저장 (다른 곳에서 사용하기 위함)
    window.supabaseChannel = channel;
    
    // 좌석 초기화 이벤트 리스너 추가 (로컬 이벤트)
    window.addEventListener('seatsReset', async () => {
      console.log('🟢 좌석 초기화 이벤트 받음 - 좌석 데이터 다시 로드');
      
      // 로컬 스토리지 초기화
      localStorage.removeItem('userSeat');
    });
    
    console.log('✅ 실시간 구독이 설정되었습니다.');
    return channel;
  } catch (error) {
    console.error('❌ 실시간 구독 설정 오류:', error);
    return null;
  }
}

// 좌석 초기화 브로드캠스트 함수 (모든 클라이언트에 알림)
async function broadcastSeatsReset() {
  try {
    if (window.supabaseChannel) {
      const resetTimestamp = new Date().toISOString();
      const resetId = 'reset_' + Math.random().toString(36).substring(2, 15);
      
      // 로컬에도 초기화 타임스태프 저장
      localStorage.setItem('lastResetTimestamp', resetTimestamp);
      
      // 초기화 타임스태프를 Supabase에 저장
      try {
        // 모든 남성 좌석 삭제
        await supabase
          .from('male_seats')
          .delete()
          .neq('seat_number', 0);
          
        // 모든 여성 좌석 삭제
        await supabase
          .from('female_seats')
          .delete()
          .neq('seat_number', 0);
          
        // 새 초기화 레코드 추가
        const { error: insertError } = await supabase
          .from('system_info')
          .insert([
            {
              id: 1, // 초기화 정보를 위한 ID
              reset_timestamp: resetTimestamp,
              reset_id: resetId
            }
          ])
          .onConflict('id')
          .merge(); // 이미 존재하는 경우 업데이트
          
        if (insertError) {
          console.error('❌ 초기화 타임스태프 저장 오류:', insertError);
        } else {
          console.log('✅ 초기화 타임스태프 저장 성공');
        }
      } catch (dbError) {
        console.error('❌ 초기화 타임스태프 저장 중 오류:', dbError);
        // 데이터베이스 오류가 발생해도 브로드캐스트는 계속 진행
      }
      
      await window.supabaseChannel.send({
        type: 'broadcast',
        event: 'seats-reset',
        payload: { 
          message: 'all-seats-reset', 
          timestamp: resetTimestamp,
          resetId: resetId
        }
      });
      console.log('🔄 좌석 초기화 브로드캐스트 메시지 전송 완료');
      return true;
    } else {
      console.error('❌ 실시간 채널이 설정되지 않았습니다.');
      return false;
    }
  } catch (error) {
    console.error('❌ 브로드캐스트 메시지 전송 오류:', error);
    return false;
  }
}

// 테이블 존재 여부 확인 및 생성
async function createTableIfNotExists() {
  try {
    // 남성 테이블 확인
    const { data: maleData, error: maleError } = await supabase
      .from('male_seats')
      .select('count(*)', { count: 'exact' })
      .limit(0);
    
    // 여성 테이블 확인
    const { data: femaleData, error: femaleError } = await supabase
      .from('female_seats')
      .select('count(*)', { count: 'exact' })
      .limit(0);
    
    // 시스템 테이블 확인 (초기화 정보 저장용)
    const { data: systemData, error: systemError } = await supabase
      .from('system_info')
      .select('count(*)', { count: 'exact' })
      .limit(0);
    
    if (maleError || femaleError || systemError) {
      console.warn('하나 이상의 테이블이 존재하지 않습니다. 로컬 모드로 작동합니다.');
      console.log('테이블 구조 확인 필요: Supabase 대시보드에서 다음 구조로 테이블을 설정해야 합니다:');
      console.log('1. male_seats 테이블:');
      console.log('   - seat_number: integer (primary key)');
      console.log('   - user_id: text (not null)');
      console.log('   - created_at: timestamp with time zone (default: now())');
      console.log('\n2. female_seats 테이블:');
      console.log('   - seat_number: integer (primary key)');
      console.log('   - user_id: text (not null)');
      console.log('   - created_at: timestamp with time zone (default: now())');
      console.log('\n3. system_info 테이블:');
      console.log('   - id: integer (primary key)');
      console.log('   - reset_timestamp: timestamp with time zone');
      console.log('   - reset_id: text');
    } else {
      console.log('✅ 모든 테이블이 존재합니다.');
      
      // 테이블 구조 확인 시도
      try {
        // 남성 좌석 데이터 샘플 가져오기
        const { data: maleSampleData, error: maleSampleError } = await supabase
          .from('male_seats')
          .select('*')
          .limit(1);
          
        // 여성 좌석 데이터 샘플 가져오기
        const { data: femaleSampleData, error: femaleSampleError } = await supabase
          .from('female_seats')
          .select('*')
          .limit(1);
          
        if (!maleSampleError && maleSampleData && maleSampleData.length > 0) {
          console.log('현재 male_seats 테이블 구조 샘플:', maleSampleData[0]);
        }
        
        if (!femaleSampleError && femaleSampleData && femaleSampleData.length > 0) {
          console.log('현재 female_seats 테이블 구조 샘플:', femaleSampleData[0]);
        }
      } catch (sampleError) {
        console.error('테이블 구조 확인 오류:', sampleError);
      }
    }
  } catch (error) {
    console.error('❌ 테이블 확인 중 오류:', error);
  }
}

// 실시간 구독 설정 실행
setupRealtimeSubscription();
