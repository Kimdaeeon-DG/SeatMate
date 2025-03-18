/*
 * SeatMate - 좌석 예약 및 할당 관리를 위한 PostgreSQL 함수
 *
 * 이 파일은 다음 함수들을 포함합니다:
 * 1. reserve_seat: 사용자가 지정한 좌석을 예약하는 함수
 * 2. find_available_seat: 사용 가능한 첫 번째 좌석을 찾는 함수
 *
 * 동시성 처리:
 * - PostgreSQL 트랜잭션 및 FOR UPDATE 잠금을 활용해 동시 좌석 선택 문제 해결
 * - 동시 요청 시 복수의 사용자가 같은 좌석을 선택했을 때 발생하는 경쟁 상태(race condition) 방지
 * - 오류 발생 시 클라이언트에 명확한 오류 메시지 반환
 *
 * 작성일: 2023년 최초 작성, 2023년 편집
 */

/**
 * reserve_seat - 사용자가 지정한 좌석을 예약하는 함수
 *
 * @param p_seat_number - 예약하려는 좌석 번호(1-40)
 * @param p_user_id - 사용자 고유 식별자(UUID 또는 문자열)
 * @param p_gender - 사용자 성별('male' 또는 'female')
 * @return JSONB - 성공/실패 상태와 메시지를 포함한 JSON 응답
 *
 * 동시성 처리:
 * 1. 트랜잭션 내에서 작업 수행 -> 일관성 보장
 * 2. SELECT FOR UPDATE NOWAIT 사용 -> 행 잠금 활용
 * 3. 중복 차단 -> 하나의 좌석에 하나의 사용자만 할당
 */
CREATE OR REPLACE FUNCTION reserve_seat(
  p_seat_number INTEGER,   -- 예약할 좌석 번호 
  p_user_id TEXT,          -- 사용자 ID
  p_gender TEXT            -- 사용자 성별(male/female)
) 
RETURNS JSONB              -- JSON 형식으로 결과 반환
LANGUAGE plpgsql
SECURITY DEFINER           -- 이 함수를 호출한 사용자의 권한이 아닌 소유자 권한으로 실행
AS $$
DECLARE
  v_table_name TEXT;           -- 성별에 따른 테이블 이름
  v_existing_record RECORD;    -- 조회된 레코드 저장
  v_result JSONB;              -- 결과값 저장
BEGIN
  -- 성별에 따라 해당하는 테이블 이름 결정
  IF p_gender = 'male' THEN
    v_table_name := 'male_seats';
  ELSIF p_gender = 'female' THEN
    v_table_name := 'female_seats';
  ELSE
    -- 잘못된 성별 파라미터가 전달된 경우 오류 반환
    RETURN jsonb_build_object(
      'success', false,
      'message', '올바른 성별을 지정해주세요 (male 또는 female)'
    );
  END IF;

  -- 내부 트랜잭션 시작 - 이 작업은 원자적으로 수행되어야 함
  BEGIN
    -- 동시성 처리 1단계: FOR UPDATE NOWAIT를 사용하여 좌석에 대한 잠금 획득 시도
    -- NOWAIT는 다른 트랜잭션이 이미 잠금을 획득한 경우 즉시 오류 반환 (대기 X)
    EXECUTE format('
      SELECT * FROM %I 
      WHERE seat_number = $1
      FOR UPDATE NOWAIT', v_table_name)
    USING p_seat_number
    INTO v_existing_record;

    -- 동시성 처리 2단계: 좌석이 이미 다른 사용자에게 할당되어 있는지 확인
    IF v_existing_record.seat_number IS NOT NULL THEN
      -- 이미 예약된 좌석이면 오류 메시지와 함께 실패 반환
      RETURN jsonb_build_object(
        'success', false,
        'message', format('좌석 %s번은 이미 다른 사용자가 선택했습니다. 다른 좌석을 선택해주세요.', p_seat_number)
      );
    END IF;

    -- 동시성 처리 3단계: 좌석이 존재하지 않으면 새로 삽입 (잠금을 획득한 상태)
    -- 피지칼 록(physical lock)으로 인해 다른 트랜잭션이 이 좌석을 동시에 삽입할 수 없음
    EXECUTE format('
      INSERT INTO %I (seat_number, user_id, created_at)
      VALUES ($1, $2, now())
      RETURNING seat_number', v_table_name)
    USING p_seat_number, p_user_id
    INTO v_existing_record;

    -- 좌석 할당 성공 시 JSON 형식의 성공 응답 반환
    RETURN jsonb_build_object(
      'success', true,
      'message', format('좌석 %s번이 성공적으로 할당되었습니다.', p_seat_number),
      'seat_number', p_seat_number
    );
  EXCEPTION
    -- 동시성 처리 4단계: 잠금 획득 실패 예외 처리 (NOWAIT로 인해 발생)
    -- 다른 트랜잭션이 이미 해당 좌석에 대한 잠금을 획득한 경우
    WHEN lock_not_available THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', format('좌석 %s번은 현재 다른 사용자가 선택 중입니다. 다른 좌석을 선택해주세요.', p_seat_number)
      );
      
    -- 동시성 처리 5단계: 중복 키 예외 처리
    -- 두 개 이상의 트랜잭션이 동시에 좌석을 삽입하려는 경우 발생할 수 있음
    -- FOR UPDATE NOWAIT를 사용해도 드물게 다른 트랜잭션에서 삽입이 시도된 경우 발생
    WHEN unique_violation THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', format('좌석 %s번은 이미 다른 사용자가 선택했습니다. 다른 좌석을 선택해주세요.', p_seat_number)
      );
      
    -- 기타 예상하지 못한 오류 처리
    WHEN OTHERS THEN
      -- 로그 추가 수반
      -- RAISE LOG '좌석 예약 중 오류 발생: %', SQLERRM;
      
      RETURN jsonb_build_object(
        'success', false,
        'message', format('오류가 발생했습니다: %s', SQLERRM)
      );
  END;
END;
$$;

/**
 * find_available_seat - 사용 가능한 첫 번째 좌석을 찾는 함수
 *
 * @param p_gender - 사용자 성별('male' 또는 'female')
 * @return INTEGER - 사용 가능한 좌석 번호 또는 사용 가능한 좌석이 없을 경우 NULL
 *
 * 이 함수는 자동으로 사용 가능한 첫 번째 좌석을 찾아 사용자에게 추천합니다.
 * 사용자가 선택한 좌석이 이미 점유된 경우 활용됩니다.
 */
CREATE OR REPLACE FUNCTION find_available_seat(
  p_gender TEXT               -- 사용자 성별(male/female)
)
RETURNS INTEGER               -- 사용 가능한 좌석 번호 반환
LANGUAGE plpgsql
SECURITY DEFINER              -- 함수 소유자의 권한으로 실행
AS $$
DECLARE
  v_table_name TEXT;          -- 성별에 따른 테이블 이름
  v_seat_number INTEGER;      -- 사용 가능한 좌석 번호
  v_total_rows INTEGER := 10; -- 총 행 수(가로 배열)
  v_total_cols INTEGER := 4;  -- 총 열 수(세로 배열)
BEGIN
  -- 성별에 따라 해당하는 테이블 이름 결정
  IF p_gender = 'male' THEN
    v_table_name := 'male_seats';
  ELSIF p_gender = 'female' THEN
    v_table_name := 'female_seats';
  ELSE
    -- 잘못된 성별 파라미터가 전달된 경우 NULL 반환
    RETURN NULL;
  END IF;

  -- 트랜잭션 내에서 일관성 있게 사용 가능한 좌석 찾기
  BEGIN
    -- 1부터 총 좌석 수까지 순회하여 사용 가능한 첫 번째 좌석 찾기
    FOR v_seat_number IN 1..(v_total_rows * v_total_cols) LOOP
      -- 해당 좌석이 이미 할당되었는지 확인 (COUNT(*) = 0이면 true, 그렇지 않으면 false)
      -- NOT EXISTS를 사용하는 것이 더 효율적이지만, 가독성을 위해 COUNT(*) = 0 사용
      EXECUTE format('
        SELECT COUNT(*) = 0 
        FROM %I 
        WHERE seat_number = $1', v_table_name)
      USING v_seat_number
      INTO v_seat_number;

      -- 좌석이 사용 가능하면(좌석이 할당되지 않음 = true) 바로 반환
      IF v_seat_number THEN
        -- 사용 가능한 좌석 번호 반환
        RETURN v_seat_number;
      END IF;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      -- 오류 발생 시 NULL 반환 (사용 가능한 좌석 없음)
      RETURN NULL;
  END;

  -- 맨 끝까지 사용 가능한 좌석을 찾지 못한 경우 NULL 반환
  RETURN NULL;
END;
$$;
