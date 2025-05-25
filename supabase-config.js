// Supabase 설정
// 주의: 새 Supabase 프로젝트를 생성한 후 아래 URL과 API 키를 업데이트해야 합니다.
// Supabase 설정을 환경변수로 가져오기
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'local-development-key';
// Supabase 클라이언트 초기화 (오류 처리 추가)
let supabase;

// 실제 클라이언트 초기화 함수
function initSupabase() {
  try {
    // 이미 정의된 객체인지 확인
    if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          autoRefreshToken: true,
          persistSession: true
        },
        global: {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          },
        },
      });
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

// 전역 Supabase 유틸리티 객체 생성
window.supabaseUtils = window.supabaseUtils || {};

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
          
        // 초기화 정보 업데이트
        const { error: updateError } = await supabase
          .from('system_info')
          .update({
            reset_timestamp: resetTimestamp,
            reset_id: resetId,
            last_updated: new Date().toISOString()
          })
          .eq('id', 1);
          
        // 업데이트 실패 시 insert with merge 시도
        if (updateError) {
          console.warn('⚠️ 초기화 정보 업데이트 실패, 삽입 시도 중...', updateError);
          
          const { error: insertError } = await supabase
            .from('system_info')
            .insert([
              {
                id: 1, // 초기화 정보를 위한 ID
                reset_timestamp: resetTimestamp,
                reset_id: resetId,
                last_updated: new Date().toISOString()
              }
            ])
            .onConflict('id')
            .merge(); // 이미 존재하는 경우 업데이트
          
          if (insertError) {
            console.error('❌ 초기화 정보 저장 오류:', insertError);
          } else {
            console.log('✅ 초기화 정보 저장 성공');
          }
        } else {
          console.log('✅ 초기화 정보 업데이트 성공');
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

// 전역 객체에 함수 노출
window.supabaseUtils = window.supabaseUtils || {};
window.supabaseUtils.broadcastSeatsReset = broadcastSeatsReset;

// SQL 함수를 통한 모든 좌석 초기화
async function resetAllSeatsViaSql() {
  try {
    const { data, error } = await supabase.rpc('reset_all_seats');
    
    if (error) {
      console.error('❌ SQL 함수를 통한 좌석 초기화 오류:', error);
      return false;
    }
    
    console.log('✅ SQL 함수를 통한 좌석 초기화 성공:', data);
    return true;
  } catch (error) {
    console.error('❌ SQL 함수를 통한 좌석 초기화 중 예외 발생:', error);
    return false;
  }
}

// 전역 객체에 함수 노출
window.supabaseUtils.resetAllSeatsViaSql = resetAllSeatsViaSql;

// SQL 함수를 통한 사용 가능한 좌석 찾기
async function findAvailableSeat(gender) {
  try {
    // PostgreSQL 함수 호출
    const { data, error } = await supabase.rpc('find_available_seat', { p_gender: gender });
    
    if (error) {
      console.error('❌ SQL 함수를 통한 사용 가능한 좌석 찾기 오류:', error);
      return null;
    }
    
    if (data && data.success) {
      console.log('✅ SQL 함수를 통한 사용 가능한 좌석 찾기 성공:', data.seat_number);
      return data.seat_number;
    } else {
      console.log('⚠️ 사용 가능한 좌석이 없습니다.');
      return null;
    }
  } catch (error) {
    console.error('❌ SQL 함수를 통한 사용 가능한 좌석 찾기 중 예외 발생:', error);
    return null;
  }
}

// 전역 객체에 함수 노출
window.supabaseUtils.findAvailableSeat = findAvailableSeat;

// 시스템 정보 테이블 초기화 함수
async function initSystemInfoTable() {
  try {
    // system_info 테이블이 비어있는지 확인
    const { data, error } = await supabase
      .from('system_info')
      .select('id')
      .eq('id', 1)
      .single();
      
    if (error && error.code === 'PGRST116') { // 결과가 없는 경우
      // 초기 레코드 생성
      const { error: insertError } = await supabase
        .from('system_info')
        .insert([{
          id: 1,
          reset_timestamp: new Date().toISOString(),
          reset_id: 'initial_' + Math.random().toString(36).substring(2, 15),
          last_updated: new Date().toISOString()
        }]);
        
      if (insertError) {
        console.error('❌ 시스템 정보 테이블 초기화 오류:', insertError);
      } else {
        console.log('✅ 시스템 정보 테이블 초기화 완료');
      }
    } else if (error) {
      console.error('❌ 시스템 정보 테이블 확인 오류:', error);
    } else {
      console.log('✅ 시스템 정보 테이블이 이미 초기화되어 있습니다.');
    }
  } catch (error) {
    console.error('❌ 시스템 정보 테이블 초기화 중 오류:', error);
  }
}

// 페이지 로드 시 시스템 정보 테이블 초기화
document.addEventListener('DOMContentLoaded', initSystemInfoTable);

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

// 사용 가능한 좌석 찾기 함수
async function findAvailableSeat(gender) {
  try {
    const tableName = gender === 'male' ? 'male_seats' : 'female_seats';
    
    // 전체 좌석 수 (1부터 40까지)
    const totalSeats = 40;
    
    // 현재 할당된 좌석 번호 가져오기
    const { data, error } = await supabase
      .from(tableName)
      .select('seat_number');
      
    if (error) {
      console.error('사용 가능한 좌석 검색 오류:', error);
      return { error: error.message };
    }
    
    // 할당된 좌석 번호 집합 생성
    const assignedSeats = new Set();
    if (data) {
      data.forEach(seat => assignedSeats.add(seat.seat_number));
    }
    
    // 사용 가능한 좌석 찾기
    for (let i = 1; i <= totalSeats; i++) {
      if (!assignedSeats.has(i)) {
        return { data: i }; // 처음으로 발견한 사용 가능한 좌석 반환
      }
    }
    
    // 사용 가능한 좌석이 없음
    return { data: null };
  } catch (error) {
    console.error('사용 가능한 좌석 검색 예외:', error);
    return { error: error.message };
  }
}

// 좌석 할당 함수 - SQL 함수 대신 기본 테이블 작업 사용
async function reserveSeat(seatNumber, userId, gender, studentId) {
  try {
    // 좌석 번호가 숫자인지 확인
    if (typeof seatNumber !== 'number') {
      try {
        seatNumber = parseInt(seatNumber, 10);
        if (isNaN(seatNumber)) {
          throw new Error('좌석 번호가 유효한 숫자가 아닙니다.');
        }
      } catch (parseError) {
        console.error('좌석 번호 파싱 오류:', parseError);
        return { success: false, message: '좌석 번호가 유효한 숫자가 아닙니다.' };
      }
    }

    // 학번이 없으면 빈 문자열로 설정
    studentId = studentId || '';
    
    // 테이블 이름 결정
    const tableName = gender === 'male' ? 'male_seats' : 'female_seats';
    
    // 1. 학번으로 이미 좌석이 할당되어 있는지 확인
    if (studentId) {
      // 남자 테이블 확인
      const { data: maleData, error: maleError } = await supabase
        .from('male_seats')
        .select('seat_number')
        .eq('student_id', studentId);
        
      if (maleError) {
        console.error('학번 좌석 확인 오류 (male):', maleError);
      } else if (maleData && maleData.length > 0) {
        return { 
          success: false, 
          message: `이미 이 학번으로 ${maleData[0].seat_number}번 좌석이 할당되어 있습니다.`,
          existingSeat: maleData[0].seat_number,
          gender: 'male'
        };
      }
      
      // 여자 테이블 확인
      const { data: femaleData, error: femaleError } = await supabase
        .from('female_seats')
        .select('seat_number')
        .eq('student_id', studentId);
        
      if (femaleError) {
        console.error('학번 좌석 확인 오류 (female):', femaleError);
      } else if (femaleData && femaleData.length > 0) {
        return { 
          success: false, 
          message: `이미 이 학번으로 ${femaleData[0].seat_number}번 좌석이 할당되어 있습니다.`,
          existingSeat: femaleData[0].seat_number,
          gender: 'female'
        };
      }
    }
    
    // 2. 선택한 좌석이 이미 할당되어 있는지 확인
    const { data: seatData, error: seatError } = await supabase
      .from(tableName)
      .select('*')
      .eq('seat_number', seatNumber);
      
    if (seatError) {
      console.error('좌석 할당 확인 오류:', seatError);
      return { success: false, message: `좌석 할당 확인 중 오류가 발생했습니다: ${seatError.message}` };
    }
    
    if (seatData && seatData.length > 0) {
      // 이미 할당된 좌석이므로 다른 좌석 찾기
      const { data: availableSeat, error: findError } = await findAvailableSeat(gender);
      
      if (findError || !availableSeat) {
        return { 
          success: false, 
          message: `좌석 ${seatNumber}번은 이미 할당되어 있습니다. 사용 가능한 다른 좌석이 없습니다.` 
        };
      }
      
      return { 
        success: false, 
        message: `좌석 ${seatNumber}번은 이미 할당되어 있습니다. 대체 좌석 ${availableSeat}번을 사용해보세요.`,
        alternative_seat: availableSeat
      };
    }
    
    // 3. 좌석 할당 실행
    const { data: insertData, error: insertError } = await supabase
      .from(tableName)
      .insert([
        { 
          seat_number: seatNumber, 
          user_id: userId,
          student_id: studentId,
          created_at: new Date().toISOString()
        }
      ]);
      
    if (insertError) {
      console.error('좌석 할당 오류:', insertError);
      return { success: false, message: `좌석 할당 중 오류가 발생했습니다: ${insertError.message}` };
    }
    
    // 4. 성공 응답 반환
    return { 
      success: true, 
      message: `좌석 ${seatNumber}번이 성공적으로 할당되었습니다.`,
      seat_number: seatNumber
    };
  } catch (error) {
    console.error('좌석 할당 오류:', error);
    return { success: false, message: `좌석 할당 중 예외가 발생했습니다: ${error.message}` };
  }
}

// 사용 가능한 좌석 찾기 함수 - 순차적 할당 (1번부터 차례로)
async function findAvailableSeat(gender) {
  try {
    console.log(`🔍 순차적 좌석 할당 시도 - ${gender} 성별용 좌석`);
    
    // 순차적 할당을 위해 클라이언트에서 직접 구현
    const tableName = gender === 'male' ? 'male_seats' : 'female_seats';
    
    // Supabase에서 현재 할당된 좌석 목록 가져오기
    const { data: assignedSeats, error: queryError } = await supabase
      .from(tableName)
      .select('seat_number');
      
    if (queryError) {
      console.error('❌ 할당된 좌석 조회 오류:', queryError);
      return null;
    }
    
    // 할당된 좌석 번호 집합 생성
    const assignedSeatNumbers = new Set(assignedSeats.map(seat => seat.seat_number));
    console.log(`현재 할당된 좌석: ${[...assignedSeatNumbers].join(', ')}`);
    
    // 1번부터 총 좌석 수까지 확인 (순차적 할당)
    const totalSeats = 48; // 총 좌석 수
    for (let i = 1; i <= totalSeats; i++) {
      // 이미 할당된 좌석이 아니면 반환
      if (!assignedSeatNumbers.has(i)) {
        console.log(`✅ 순차적으로 찾은 다음 사용 가능한 좌석: ${i}`);
        return i;
      }
    }
    
    // 모든 좌석이 할당된 경우
    console.log('⚠️ 사용 가능한 좌석이 없습니다.');
    return null;
  } catch (error) {
    console.error('❌ 사용 가능한 좌석 찾기 오류:', error);
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
