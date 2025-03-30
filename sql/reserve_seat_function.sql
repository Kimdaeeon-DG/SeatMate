-- 좌석 예약을 위한 PostgreSQL 함수
-- 이 함수는 원자적 트랜잭션을 사용하여 동시 좌석 예약 문제를 해결합니다.

CREATE OR REPLACE FUNCTION reserve_seat(
  p_seat_number INTEGER,
  p_user_id TEXT,
  p_gender TEXT
) 
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_table_name TEXT;
  v_existing_record RECORD;
  v_result JSONB;
BEGIN
  -- 성별에 따라 테이블 선택
  IF p_gender = 'male' THEN
    v_table_name := 'male_seats';
  ELSIF p_gender = 'female' THEN
    v_table_name := 'female_seats';
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'message', '올바른 성별을 지정해주세요 (male 또는 female)'
    );
  END IF;

  -- 트랜잭션 시작
  BEGIN
    -- FOR UPDATE를 사용하여 해당 좌석에 대한 잠금 획득
    -- 이 쿼리는 해당 좌석이 있으면 잠금을 획득하고, 없으면 아무 행도 반환하지 않음
    EXECUTE format('
      SELECT * FROM %I 
      WHERE seat_number = $1
      FOR UPDATE NOWAIT', v_table_name)
    USING p_seat_number
    INTO v_existing_record;

    -- 좌석이 이미 존재하는지 확인
    IF v_existing_record.seat_number IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', format('좌석 %s번은 이미 다른 사용자가 선택했습니다. 다른 좌석을 선택해주세요.', p_seat_number)
      );
    END IF;

    -- 좌석이 존재하지 않으면 새로 삽입
    EXECUTE format('
      INSERT INTO %I (seat_number, user_id, created_at)
      VALUES ($1, $2, now())
      RETURNING seat_number', v_table_name)
    USING p_seat_number, p_user_id
    INTO v_existing_record;

    -- 성공 응답 반환
    RETURN jsonb_build_object(
      'success', true,
      'message', format('좌석 %s번이 성공적으로 할당되었습니다.', p_seat_number),
      'seat_number', p_seat_number
    );
  EXCEPTION
    -- 잠금 획득 실패 (다른 트랜잭션이 이미 잠금을 획득한 경우)
    WHEN lock_not_available THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', format('좌석 %s번은 현재 다른 사용자가 선택 중입니다. 다른 좌석을 선택해주세요.', p_seat_number)
      );
    -- 중복 키 오류 (동시에 같은 좌석을 삽입하려는 경우)
    WHEN unique_violation THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', format('좌석 %s번은 이미 다른 사용자가 선택했습니다. 다른 좌석을 선택해주세요.', p_seat_number)
      );
    -- 기타 오류
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', format('오류가 발생했습니다: %s', SQLERRM)
      );
  END;
END;
$$;

-- 사용 가능한 좌석 번호를 찾는 함수
CREATE OR REPLACE FUNCTION find_available_seat(
  p_gender TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_table_name TEXT;
  v_seat_number INTEGER;
  v_is_available BOOLEAN;
  v_total_rows INTEGER := 10; -- 총 행 수
  v_total_cols INTEGER := 4;  -- 총 열 수
BEGIN
  -- 성별에 따라 테이블 선택
  IF p_gender = 'male' THEN
    v_table_name := 'male_seats';
  ELSIF p_gender = 'female' THEN
    v_table_name := 'female_seats';
  ELSE
    RETURN NULL;
  END IF;

  -- 1부터 총 좌석 수까지 확인하여 사용 가능한 첫 번째 좌석 반환
  FOR v_seat_number IN 1..(v_total_rows * v_total_cols) LOOP
    -- 해당 좌석이 이미 할당되었는지 확인
    EXECUTE format('
      SELECT COUNT(*) = 0 
      FROM %I 
      WHERE seat_number = $1', v_table_name)
    USING v_seat_number
    INTO v_is_available;

    -- 좌석이 사용 가능하면 반환
    IF v_is_available THEN
      RETURN v_seat_number;
    END IF;
  END LOOP;

  -- 사용 가능한 좌석이 없으면 NULL 반환
  RETURN NULL;
END;
$$;
