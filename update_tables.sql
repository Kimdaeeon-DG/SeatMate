-- male_seats 테이블에 student_id 컬럼 추가
ALTER TABLE male_seats ADD COLUMN IF NOT EXISTS student_id TEXT;

-- female_seats 테이블에 student_id 컬럼 추가
ALTER TABLE female_seats ADD COLUMN IF NOT EXISTS student_id TEXT;

-- student_id 컬럼에 인덱스 추가 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_male_seats_student_id ON male_seats (student_id);
CREATE INDEX IF NOT EXISTS idx_female_seats_student_id ON female_seats (student_id);

-- student_id 유니크 제약 추가 (한 학번당 하나의 좌석만 할당 가능)
ALTER TABLE male_seats ADD CONSTRAINT unique_male_student_id UNIQUE (student_id);
ALTER TABLE female_seats ADD CONSTRAINT unique_female_student_id UNIQUE (student_id);

-- 주석 추가
COMMENT ON COLUMN male_seats.student_id IS '학생 ID (학번)';
COMMENT ON COLUMN female_seats.student_id IS '학생 ID (학번)';

-- 테이블 구조 확인 쿼리
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM 
    information_schema.columns
WHERE 
    table_name IN ('male_seats', 'female_seats')
ORDER BY 
    table_name, ordinal_position;
