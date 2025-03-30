-- 순차적 좌석 할당을 위한 함수 (1번부터 차례대로 할당)
CREATE OR REPLACE FUNCTION find_available_seat(
  p_gender TEXT
) RETURNS JSONB AS $$
DECLARE
  v_table_name TEXT;
  v_seat_number INTEGER;
  v_is_available BOOLEAN;
  v_query TEXT;
BEGIN
  -- 성별에 따라 테이블 이름 설정
  IF p_gender = 'male' THEN
    v_table_name := 'male_seats';
  ELSIF p_gender = 'female' THEN
    v_table_name := 'female_seats';
  ELSE
    RETURN jsonb_build_object('success', false, 'message', '유효하지 않은 성별입니다.');
  END IF;
  
  -- 1번부터 48번까지 순차적으로 확인
  FOR v_seat_number IN 1..48 LOOP
    -- 해당 좌석이 사용 가능한지 확인
    v_query := format('SELECT NOT EXISTS (SELECT 1 FROM %I WHERE seat_number = $1)', v_table_name);
    EXECUTE v_query INTO v_is_available USING v_seat_number;
    
    -- 사용 가능한 좌석을 찾으면 반환
    IF v_is_available THEN
      RETURN jsonb_build_object(
        'success', true, 
        'message', '사용 가능한 좌석을 찾았습니다.',
        'seat_number', v_seat_number
      );
    END IF;
  END LOOP;
  
  -- 모든 좌석이 이미 할당된 경우
  RETURN jsonb_build_object(
    'success', false, 
    'message', '사용 가능한 좌석이 없습니다.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 함수에 대한 실행 권한 부여
GRANT EXECUTE ON FUNCTION find_available_seat(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION find_available_seat(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION find_available_seat(TEXT) TO service_role;
