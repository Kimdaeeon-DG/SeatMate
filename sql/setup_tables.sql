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
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 시스템 정보 초기 레코드 삽입 (없는 경우에만)
INSERT INTO system_info (id, reset_timestamp)
VALUES (1, NOW())
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
