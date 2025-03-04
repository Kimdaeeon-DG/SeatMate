// Supabase 설정
// 환경 변수에서만 값을 가져오도록 설정
let SUPABASE_URL = null;
let SUPABASE_KEY = null;

// 현재 환경이 Netlify인지 확인
const isNetlify = window.location.hostname.includes('netlify.app') || 
                 window.location.hostname !== 'localhost';

console.log(`🔍 현재 실행 환경: ${isNetlify ? 'Netlify' : '로컬 개발'} (${window.location.hostname})`);

// 환경 변수에서 설정 가져오기 시도
async function fetchSupabaseConfig() {
  console.log('📢 Netlify 함수 호출 시도: /.netlify/functions/get-supabase-config');
  try {
    const response = await fetch('/.netlify/functions/get-supabase-config');
    console.log('📢 Netlify 함수 응답 상태:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('📢 Netlify 함수 응답 데이터:', data);
      
      if (data.url && data.key) {
        SUPABASE_URL = data.url;
        SUPABASE_KEY = data.key;
        console.info('✅ Supabase 설정을 환경 변수에서 가져왔습니다.');
        return true;
      } else {
        console.error('❌ Netlify 함수 응답에 URL 또는 Key가 없습니다:', data);
      }
    } else {
      // 응답이 성공적이지 않은 경우 오류 메시지 표시
      const errorData = await response.json();
      console.error('❌ Supabase 설정 오류:', errorData.error);
      alert('서버 설정 오류: ' + errorData.error);
      return false;
    }
  } catch (error) {
    console.error('❌ 환경 변수에서 Supabase 설정을 가져오는 데 실패했습니다:', error);
    alert('서버 연결 오류: Netlify 함수에 연결할 수 없습니다. 관리자에게 문의해주세요.');
    return false;
  }
  
  // 설정이 없는 경우
  console.error('❌ Supabase 설정을 가져올 수 없습니다.');
  alert('서버 설정 오류: Supabase 설정을 가져올 수 없습니다. 관리자에게 문의해주세요.');
  return false;
}

// 설정 가져오기 실행 및 Supabase 초기화
async function initializeSupabase() {
  // 로컬 개발 환경과 Netlify 환경 구분
  if (isNetlify) {
    console.log('📢 Netlify 환경 감지: 환경 변수에서 설정을 가져옵니다.');
    // 환경 변수에서 설정 가져오기
    const configLoaded = await fetchSupabaseConfig();
    
    // 설정이 없으면 애플리케이션 중지
    if (!configLoaded || !SUPABASE_URL || !SUPABASE_KEY) {
      console.error('❌ Supabase 설정이 없어 애플리케이션을 시작할 수 없습니다.');
      document.body.innerHTML = `
        <div style="text-align: center; margin-top: 100px; font-family: sans-serif;">
          <h1 style="color: #e74c3c;">서버 설정 오류</h1>
          <p>필요한 환경 변수가 설정되지 않아 애플리케이션을 시작할 수 없습니다.</p>
          <p>관리자에게 문의해주세요.</p>
        </div>
      `;
      return false;
    }
  } else {
    // 로컬 개발 환경에서는 하드코딩된 값 사용 (개발용, 배포 시 제거 필요)
    console.log('📢 로컬 개발 환경 감지: 로컬 설정을 사용합니다.');
    
    // 로컬 개발 서버 URL 및 키 설정 (실제 값으로 변경 필요)
    // 주의: 이 값들은 개발 환경에서만 사용하고, 배포 시에는 환경 변수를 사용해야 함
    SUPABASE_URL = 'https://your-project-id.supabase.co';
    SUPABASE_KEY = 'your-anon-key';
    
    // 개발 환경 알림
    console.warn('⚠️ 로컬 개발 환경에서 하드코딩된 Supabase 설정을 사용 중입니다.');
    console.warn('⚠️ 배포 시에는 반드시 환경 변수를 사용해야 합니다.');
  }
  
  return true;
}

// 비동기 초기화 순서 보장
async function initializeApp() {
  console.log('🚀 앱 초기화 시작');
  const supabaseInitialized = await initializeSupabase();
  
  if (supabaseInitialized) {
    // Supabase 클라이언트 초기화
    const clientInitialized = initSupabase();
    
    if (clientInitialized) {
      // Supabase 연결 테스트
      await testSupabaseConnection();
      
      // 실시간 구독 설정
      await setupRealtimeSubscription();
      console.log('✅ 앱 초기화 완료: Supabase 및 실시간 구독 설정됨');
    } else {
      console.error('❌ Supabase 클라이언트 초기화 실패');
    }
  } else {
    console.error('❌ Supabase 초기화 실패로 앱 초기화 중단');
  }
}

// Supabase 연결 테스트 함수
async function testSupabaseConnection() {
  try {
    console.log('🔍 Supabase 연결 테스트 시작...');
    const { data, error } = await supabase.from('system_info').select('*').limit(1);
    
    if (error) {
      console.error('❌ Supabase 연결 테스트 실패:', error);
      return false;
    }
    
    console.log('✅ Supabase 연결 테스트 성공:', data);
    return true;
  } catch (e) {
    console.error('❌ Supabase 연결 테스트 중 예외 발생:', e);
    return false;
  }
}

// 초기화 실행
initializeApp();

// 주의: 배포 시에는 반드시 Netlify 환경 변수에 SUPABASE_URL과 SUPABASE_KEY를 설정해야 합니다.

// Supabase 클라이언트 초기화 (오류 처리 추가)
let supabase;

// 실제 클라이언트 초기화 함수
function initSupabase() {
  try {
    console.log('📢 Supabase 클라이언트 초기화 시도...');
    console.log('📢 SUPABASE_URL:', SUPABASE_URL ? '설정됨' : '설정되지 않음');
    console.log('📢 SUPABASE_KEY:', SUPABASE_KEY ? '설정됨' : '설정되지 않음');
    
    // URL과 키가 설정되었는지 확인
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.error('❌ Supabase URL 또는 Key가 설정되지 않았습니다.');
      supabase = createFallbackClient();
      console.info('ℹ️ 로컬 모드로 실행됩니다. 좌석 정보가 서버에 저장되지 않습니다.');
      return false;
    }
    
    // 이미 정의된 객체인지 확인
    if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
      console.log('📢 window.supabase.createClient 함수 발견, 클라이언트 생성 중...');
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      console.info('✅ Supabase가 초기화되었습니다.');
      return true;
    } else {
      console.warn('⚠️ Supabase 객체를 찾을 수 없습니다. 로컬 모드로 전환합니다.');
      supabase = createFallbackClient();
      console.info('ℹ️ 로컬 모드로 실행됩니다. 좌석 정보가 서버에 저장되지 않습니다.');
      return false;
    }
  } catch (error) {
    console.error('❌ Supabase 초기화 오류:', error);
    supabase = createFallbackClient();
    console.info('ℹ️ 오류로 인해 로컬 모드로 실행됩니다. 좌석 정보가 서버에 저장되지 않습니다.');
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

// 초기화는 initializeApp()에서 처리하므로 여기서는 실행하지 않음
// 폴백 클라이언트 생성 로직은 initSupabase() 함수 내에서 처리

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

// PostgreSQL 함수를 호출하여 좌석 할당하는 함수
async function reserveSeat(seatNumber, userId, gender) {
  try {
    // PostgreSQL 함수 호출
    const { data, error } = await supabase.rpc('reserve_seat', {
      p_seat_number: seatNumber,
      p_user_id: userId,
      p_gender: gender
    });

    if (error) {
      console.error('좌석 할당 함수 호출 오류:', error);
      return { success: false, message: `좌석 할당 중 오류가 발생했습니다: ${error.message}` };
    }

    return data || { success: false, message: '알 수 없는 오류가 발생했습니다.' };
  } catch (error) {
    console.error('좌석 할당 오류:', error);
    return { success: false, message: `좌석 할당 중 예외가 발생했습니다: ${error.message}` };
  }
}

// 사용 가능한 좌석 찾기 함수
async function findAvailableSeat(gender) {
  try {
    // PostgreSQL 함수 호출
    const { data, error } = await supabase.rpc('find_available_seat', {
      p_gender: gender
    });

    if (error) {
      console.error('사용 가능한 좌석 찾기 오류:', error);
      return null;
    }

    return data; // 사용 가능한 좌석 번호 또는 null
  } catch (error) {
    console.error('사용 가능한 좌석 찾기 오류:', error);
    return null;
  }
}

// 실시간 구독 설정 실행
setupRealtimeSubscription();

// 전역 객체에 함수 노출
window.supabaseUtils = {
  reserveSeat,
  findAvailableSeat
};
