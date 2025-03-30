-- 테이블 생성 및 초기화 스크립트

-- 남성 좌석 테이블
CREATE TABLE IF NOT EXISTS male_seats (
  id SERIAL PRIMARY KEY,
  seat_number INTEGER NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 여성 좌석 테이블
CREATE TABLE IF NOT EXISTS female_seats (
  id SERIAL PRIMARY KEY,
  seat_number INTEGER NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 시스템 정보 테이블
CREATE TABLE IF NOT EXISTS system_info (
  id INTEGER PRIMARY KEY,
  reset_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reset_id TEXT,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 시스템 정보 초기 레코드 삽입 (없는 경우에만)
INSERT INTO system_info (id, reset_timestamp, reset_id)
VALUES (1, NOW(), 'initial_' || substr(md5(random()::text), 1, 10))
ON CONFLICT (id) DO NOTHING;

-- 실시간 알림을 위한 트리거 함수
CREATE OR REPLACE FUNCTION notify_seat_update()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('seat_updates', json_build_object(
    'table', TG_TABLE_NAME,
    'type', TG_OP,
    'record', row_to_json(NEW)
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 남성 좌석 테이블에 트리거 추가
DROP TRIGGER IF EXISTS notify_male_seat_changes ON male_seats;
CREATE TRIGGER notify_male_seat_changes
AFTER INSERT OR UPDATE OR DELETE ON male_seats
FOR EACH ROW EXECUTE FUNCTION notify_seat_update();

-- 여성 좌석 테이블에 트리거 추가
DROP TRIGGER IF EXISTS notify_female_seat_changes ON female_seats;
CREATE TRIGGER notify_female_seat_changes
AFTER INSERT OR UPDATE OR DELETE ON female_seats
FOR EACH ROW EXECUTE FUNCTION notify_seat_update();

-- 시스템 정보 테이블에 트리거 추가
DROP TRIGGER IF EXISTS notify_system_info_changes ON system_info;
CREATE TRIGGER notify_system_info_changes
AFTER UPDATE ON system_info
FOR EACH ROW EXECUTE FUNCTION notify_seat_update();

-- 좌석 예약 함수
CREATE OR REPLACE FUNCTION reserve_seat(
  p_seat_number INTEGER,
  p_user_id TEXT,
  p_gender TEXT
) RETURNS JSONB AS $$
DECLARE
  v_table_name TEXT;
  v_existing_record RECORD;
  v_result JSONB;
BEGIN
  -- 성별에 따라 테이블 이름 설정
  IF p_gender = 'male' THEN
    v_table_name := 'male_seats';
  ELSIF p_gender = 'female' THEN
    v_table_name := 'female_seats';
  ELSE
    RETURN jsonb_build_object('success', false, 'message', '유효하지 않은 성별입니다.');
  END IF;
  
  -- 트랜잭션 시작
  BEGIN
    -- 1단계: 잠금 획득 시도 (FOR UPDATE NOWAIT)
    -- 해당 좌석에 대한 배타적 잠금을 획득하여 다른 트랜잭션이 동시에 접근하지 못하게 함
    EXECUTE format('
      SELECT * FROM %I 
      WHERE seat_number = $1
      FOR UPDATE NOWAIT', v_table_name)
    USING p_seat_number
    INTO v_existing_record;
    
    -- 2단계: 좌석 상태 확인
    -- 이미 해당 좌석이 할당되어 있는지 확인
    IF v_existing_record.id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false, 
        'message', '이미 할당된 좌석입니다.',
        'seat_number', p_seat_number
      );
    END IF;
    
    -- 3단계: 좌석 할당 처리
    -- 좌석이 비어있으면 새 레코드 삽입
    EXECUTE format('
      INSERT INTO %I (seat_number, user_id) 
      VALUES ($1, $2)
      RETURNING id', v_table_name)
    USING p_seat_number, p_user_id
    INTO v_existing_record;
    
    -- 성공 응답 반환
    RETURN jsonb_build_object(
      'success', true, 
      'message', '좌석이 성공적으로 할당되었습니다.',
      'seat_number', p_seat_number
    );
    
  EXCEPTION
    -- 4단계: 잠금 획득 실패 처리 (다른 사용자가 이미 잠금을 획득한 경우)
    WHEN lock_not_available THEN
      RETURN jsonb_build_object(
        'success', false, 
        'message', '다른 사용자가 이 좌석을 선택 중입니다. 다른 좌석을 선택해주세요.',
        'seat_number', p_seat_number,
        'error_code', 'lock_not_available'
      );
    
    -- 5단계: 중복 키 오류 처리 (동시에 같은 좌석을 삽입하려는 경우)
    WHEN unique_violation THEN
      RETURN jsonb_build_object(
        'success', false, 
        'message', '이 좌석은 이미 할당되었습니다. 다른 좌석을 선택해주세요.',
        'seat_number', p_seat_number,
        'error_code', 'unique_violation'
      );
    
    -- 기타 예외 처리
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'success', false, 
        'message', '좌석 할당 중 오류가 발생했습니다: ' || SQLERRM,
        'seat_number', p_seat_number,
        'error_code', 'unknown_error'
      );
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 사용 가능한 좌석 찾기 함수
CREATE OR REPLACE FUNCTION find_available_seat(
  p_gender TEXT
) RETURNS JSONB AS $$
DECLARE
  v_table_name TEXT;
  v_seat_number INTEGER;
  v_is_available BOOLEAN;
  v_max_attempts INTEGER := 10;
  v_attempt INTEGER := 0;
BEGIN
  -- 성별에 따라 테이블 이름 설정
  IF p_gender = 'male' THEN
    v_table_name := 'male_seats';
  ELSIF p_gender = 'female' THEN
    v_table_name := 'female_seats';
  ELSE
    RETURN jsonb_build_object('success', false, 'message', '유효하지 않은 성별입니다.');
  END IF;
  
  -- 최대 시도 횟수만큼 반복
  WHILE v_attempt < v_max_attempts LOOP
    v_attempt := v_attempt + 1;
    
    -- 랜덤 좌석 번호 생성 (1-48)
    v_seat_number := floor(random() * 48) + 1;
    
    -- 해당 좌석이 사용 가능한지 확인
    EXECUTE format('
      SELECT NOT EXISTS (
        SELECT 1 FROM %I WHERE seat_number = $1
      )', v_table_name)
    USING v_seat_number
    INTO v_is_available;
    
    -- 사용 가능한 좌석을 찾으면 반환
    IF v_is_available THEN
      RETURN jsonb_build_object(
        'success', true, 
        'message', '사용 가능한 좌석을 찾았습니다.',
        'seat_number', v_seat_number
      );
    END IF;
  END LOOP;
  
  -- 모든 시도 후에도 사용 가능한 좌석을 찾지 못한 경우
  RETURN jsonb_build_object(
    'success', false, 
    'message', '사용 가능한 좌석을 찾을 수 없습니다.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 모든 좌석을 초기화하는 함수
CREATE OR REPLACE FUNCTION reset_all_seats()
RETURNS BOOLEAN AS $$
DECLARE
  v_success BOOLEAN := TRUE;
  v_reset_timestamp TIMESTAMP WITH TIME ZONE := NOW();
  v_reset_id TEXT := 'reset_' || substr(md5(random()::text), 1, 10);
BEGIN
  -- 트랜잭션 시작
  BEGIN
    -- 모든 남성 좌석 삭제
    DELETE FROM male_seats WHERE seat_number > 0;
    
    -- 모든 여성 좌석 삭제
    DELETE FROM female_seats WHERE seat_number > 0;
    
    -- 시스템 정보 업데이트
    UPDATE system_info 
    SET 
      reset_timestamp = v_reset_timestamp,
      reset_id = v_reset_id,
      last_updated = NOW()
    WHERE id = 1;
    
    -- 시스템 정보가 없으면 생성
    IF NOT FOUND THEN
      INSERT INTO system_info (id, reset_timestamp, reset_id, last_updated)
      VALUES (1, v_reset_timestamp, v_reset_id, NOW());
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    -- 오류 발생 시 실패 반환
    RAISE NOTICE 'Error resetting seats: %', SQLERRM;
    v_success := FALSE;
  END;
  
  RETURN v_success;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 함수에 대한 실행 권한 부여
GRANT EXECUTE ON FUNCTION reserve_seat(INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reserve_seat(INTEGER, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION reserve_seat(INTEGER, TEXT, TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION find_available_seat(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION find_available_seat(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION find_available_seat(TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION reset_all_seats() TO authenticated;
GRANT EXECUTE ON FUNCTION reset_all_seats() TO anon;
GRANT EXECUTE ON FUNCTION reset_all_seats() TO service_role;

-- RLS 정책 설정
ALTER TABLE male_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE female_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_info ENABLE ROW LEVEL SECURITY;

-- 모든 사용자에게 모든 작업 허용 정책 생성
CREATE POLICY "모든 사용자가 읽을 수 있음" ON male_seats FOR SELECT USING (true);
CREATE POLICY "사용자가 좌석을 예약할 수 있음" ON male_seats FOR INSERT WITH CHECK (true);
CREATE POLICY "시스템 정보 삭제 가능" ON male_seats FOR DELETE USING (true);

CREATE POLICY "모든 사용자가 읽을 수 있음" ON female_seats FOR SELECT USING (true);
CREATE POLICY "사용자가 좌석을 예약할 수 있음" ON female_seats FOR INSERT WITH CHECK (true);
CREATE POLICY "시스템 정보 삭제 가능" ON female_seats FOR DELETE USING (true);

CREATE POLICY "모든 사용자가 읽을 수 있음" ON system_info FOR SELECT USING (true);
CREATE POLICY "시스템 정보 삽입 가능" ON system_info FOR INSERT WITH CHECK (true);
CREATE POLICY "시스템 정보 업데이트 가능" ON system_info FOR UPDATE USING (true);
CREATE POLICY "시스템 정보 삭제 가능" ON system_info FOR DELETE USING (true);
