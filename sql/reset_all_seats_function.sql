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
GRANT EXECUTE ON FUNCTION reset_all_seats() TO authenticated;
GRANT EXECUTE ON FUNCTION reset_all_seats() TO anon;
GRANT EXECUTE ON FUNCTION reset_all_seats() TO service_role;
