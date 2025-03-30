-- reserve_seat 함수 정의
-- 이 함수는 좌석 할당을 위한 원자적 트랜잭션을 구현합니다.
-- 동시성 문제(race condition)를 방지하기 위해 FOR UPDATE NOWAIT를 사용합니다.

CREATE OR REPLACE FUNCTION reserve_seat(
    p_seat_number INTEGER,    -- 할당할 좌석 번호
    p_user_id TEXT,           -- 사용자 ID
    p_gender TEXT,            -- 성별 ('male' 또는 'female')
    p_student_id TEXT         -- 학번
)
RETURNS JSONB AS $$
DECLARE
    target_table TEXT;        -- 대상 테이블 이름 ('male_seats' 또는 'female_seats')
    result JSONB;             -- 반환할 결과
    alternative_seat INTEGER; -- 대체 좌석 번호
BEGIN
    -- 1. 성별에 따라 대상 테이블 결정
    IF p_gender = 'male' THEN
        target_table := 'male_seats';
    ELSIF p_gender = 'female' THEN
        target_table := 'female_seats';
    ELSE
        RETURN json_build_object(
            'success', FALSE,
            'message', '유효하지 않은 성별입니다. "male" 또는 "female"이어야 합니다.',
            'seat_number', NULL
        );
    END IF;

    -- 2. 트랜잭션 시작 (이미 트랜잭션 내에 있을 수 있으므로 SAVEPOINT 사용)
    SAVEPOINT reserve_seat_transaction;

    BEGIN
        -- 3. 좌석 할당 시도 (동시성 제어를 위한 FOR UPDATE NOWAIT 사용)
        -- 3.1. 먼저 해당 학번으로 이미 좌석이 할당되어 있는지 확인
        IF EXISTS (
            SELECT 1 FROM male_seats WHERE student_id = p_student_id
            UNION
            SELECT 1 FROM female_seats WHERE student_id = p_student_id
        ) THEN
            -- 이미 할당된 좌석이 있는 경우
            RETURN json_build_object(
                'success', FALSE,
                'message', '이미 이 학번으로 좌석이 할당되어 있습니다.',
                'seat_number', NULL
            );
        END IF;

        -- 3.2. 해당 좌석이 이미 할당되어 있는지 확인 (FOR UPDATE NOWAIT로 행 잠금)
        EXECUTE format('
            SELECT 1 FROM %I 
            WHERE seat_number = $1 
            FOR UPDATE NOWAIT', target_table)
        USING p_seat_number;

        -- 3.3. 좌석 할당 (해당 좌석이 존재하지 않으면 삽입)
        EXECUTE format('
            INSERT INTO %I (seat_number, user_id, student_id) 
            VALUES ($1, $2, $3)', target_table)
        USING p_seat_number, p_user_id, p_student_id;

        -- 3.4. 성공 응답 반환
        result := json_build_object(
            'success', TRUE,
            'message', '좌석이 성공적으로 할당되었습니다.',
            'seat_number', p_seat_number
        );

    -- 4. 예외 처리
    EXCEPTION
        -- 4.1. 좌석이 이미 할당된 경우 (행 잠금 실패)
        WHEN lock_not_available THEN
            -- 트랜잭션 롤백
            ROLLBACK TO SAVEPOINT reserve_seat_transaction;
            
            -- 대체 좌석 찾기
            SELECT * FROM find_available_seat(p_gender) INTO alternative_seat;
            
            IF alternative_seat IS NOT NULL THEN
                -- 대체 좌석 제안
                result := json_build_object(
                    'success', FALSE,
                    'message', format('좌석 %s번은 이미 할당되었습니다. 대체 좌석 %s번을 사용해보세요.', p_seat_number, alternative_seat),
                    'alternative_seat', alternative_seat
                );
            ELSE
                -- 대체 좌석이 없는 경우
                result := json_build_object(
                    'success', FALSE,
                    'message', format('좌석 %s번은 이미 할당되었으며, 사용 가능한 대체 좌석이 없습니다.', p_seat_number),
                    'alternative_seat', NULL
                );
            END IF;
            
        -- 4.2. 중복 키 오류 (동시에 같은 좌석 삽입 시도)
        WHEN unique_violation THEN
            -- 트랜잭션 롤백
            ROLLBACK TO SAVEPOINT reserve_seat_transaction;
            
            -- 대체 좌석 찾기
            SELECT * FROM find_available_seat(p_gender) INTO alternative_seat;
            
            IF alternative_seat IS NOT NULL THEN
                -- 대체 좌석 제안
                result := json_build_object(
                    'success', FALSE,
                    'message', format('좌석 %s번 할당 중 충돌이 발생했습니다. 대체 좌석 %s번을 사용해보세요.', p_seat_number, alternative_seat),
                    'alternative_seat', alternative_seat
                );
            ELSE
                -- 대체 좌석이 없는 경우
                result := json_build_object(
                    'success', FALSE,
                    'message', format('좌석 %s번 할당 중 충돌이 발생했으며, 사용 가능한 대체 좌석이 없습니다.', p_seat_number),
                    'alternative_seat', NULL
                );
            END IF;
            
        -- 4.3. 기타 오류
        WHEN OTHERS THEN
            -- 트랜잭션 롤백
            ROLLBACK TO SAVEPOINT reserve_seat_transaction;
            
            -- 오류 정보 반환
            result := json_build_object(
                'success', FALSE,
                'message', format('좌석 할당 중 오류가 발생했습니다: %s', SQLERRM),
                'error_code', SQLSTATE
            );
    END;

    -- 5. 결과 반환
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- find_available_seat 함수 정의
-- 이 함수는 지정된 성별에 대해 사용 가능한 좌석을 찾습니다.
CREATE OR REPLACE FUNCTION find_available_seat(p_gender TEXT)
RETURNS INTEGER AS $$
DECLARE
    target_table TEXT;
    available_seat INTEGER;
    total_seats INTEGER := 100; -- 총 좌석 수 (필요에 따라 조정)
BEGIN
    -- 성별에 따라 대상 테이블 결정
    IF p_gender = 'male' THEN
        target_table := 'male_seats';
    ELSIF p_gender = 'female' THEN
        target_table := 'female_seats';
    ELSE
        RETURN NULL; -- 유효하지 않은 성별
    END IF;

    -- 사용 가능한 첫 번째 좌석 찾기
    FOR i IN 1..total_seats LOOP
        EXECUTE format('
            SELECT CASE WHEN NOT EXISTS (
                SELECT 1 FROM %I WHERE seat_number = $1
            ) THEN $1 ELSE NULL END', target_table)
        INTO available_seat
        USING i;
        
        IF available_seat IS NOT NULL THEN
            RETURN available_seat;
        END IF;
    END LOOP;

    RETURN NULL; -- 사용 가능한 좌석이 없음
END;
$$ LANGUAGE plpgsql;

-- reset_all_seats 함수 정의
-- 이 함수는 모든 좌석 할당을 초기화합니다.
CREATE OR REPLACE FUNCTION reset_all_seats()
RETURNS JSONB AS $$
DECLARE
    male_count INTEGER;
    female_count INTEGER;
    result JSONB;
BEGIN
    -- 현재 할당된 좌석 수 확인
    SELECT COUNT(*) INTO male_count FROM male_seats;
    SELECT COUNT(*) INTO female_count FROM female_seats;
    
    -- 모든 좌석 삭제
    DELETE FROM male_seats;
    DELETE FROM female_seats;
    
    -- 결과 반환
    result := json_build_object(
        'success', TRUE,
        'message', '모든 좌석이 초기화되었습니다.',
        'deleted_seats', json_build_object(
            'male', male_count,
            'female', female_count
        )
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;
