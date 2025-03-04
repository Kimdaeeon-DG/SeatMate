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
    
    // 실시간 구독 활성화
    const channel = supabase.channel('public:seats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seats' }, payload => {
        console.log('✅ 실시간 업데이트:', payload);
        // 좌석 상태 업데이트 이벤트 발생
        const event = new CustomEvent('seatsUpdated', { detail: payload.new });
        window.dispatchEvent(event);
      })
      .subscribe((status) => {
        console.log(`실시간 구독 상태: ${status}`);
      });
    
    // 좌석 초기화 이벤트 리스너 추가
    window.addEventListener('seatsReset', async () => {
      console.log('🟢 좌석 초기화 이벤트 받음 - 좌석 데이터 다시 로드');
      
      // 로컬 스토리지 초기화
      localStorage.removeItem('userSeat');
      
      // 페이지 새로고침 (선택적)
      // window.location.reload();
      
      // 이벤트 발생
      const resetCompleteEvent = new CustomEvent('seatsResetComplete');
      window.dispatchEvent(resetCompleteEvent);
    });
    
    console.log('✅ 실시간 구독이 설정되었습니다.');
    return channel;
  } catch (error) {
    console.error('❌ 실시간 구독 설정 오류:', error);
    return null;
  }
}

// 테이블 존재 여부 확인 및 생성
async function createTableIfNotExists() {
  try {
    // 테이블 존재 여부 확인
    const { data, error } = await supabase
      .from('seats')
      .select('count(*)', { count: 'exact' })
      .limit(0);
    
    if (error) {
      console.warn('테이블이 존재하지 않을 수 있습니다. 로컬 모드로 작동합니다.');
    } else {
      console.log('✅ 테이블이 존재합니다.');
    }
  } catch (error) {
    console.error('❌ 테이블 확인 중 오류:', error);
  }
}

// 실시간 구독 설정 실행
setupRealtimeSubscription();
