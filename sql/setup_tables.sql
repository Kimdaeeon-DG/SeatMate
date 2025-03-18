/*
 * SeatMate - 테이블 생성 및 초기화 스크립트
 * 
 * 이 스크립트는 SeatMate 프로젝트에 필요한 데이터베이스 테이블을 생성하고 초기화합니다.
 * 좌석 관리, 실시간 알림 및 시스템 정보 관리를 위한 테이블과 트리거를 포함합니다.
 * 
 * 작성일: 2023년 최초 작성, 2023년 편집
 */

-- 남성 좌석 테이블 - 남성 사용자의 좌석 할당 정보 저장
CREATE TABLE IF NOT EXISTS male_seats (
  id SERIAL PRIMARY KEY,                              -- 고유 식별자(자동 증가)
  seat_number INTEGER NOT NULL UNIQUE,               -- 좌석 번호(1-40, 고유한 값)
  user_id TEXT NOT NULL,                            -- 사용자 ID(로컬 스토리지에 저장된 값)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()  -- 좌석 할당 시간
);

-- 여성 좌석 테이블 - 여성 사용자의 좌석 할당 정보 저장
CREATE TABLE IF NOT EXISTS female_seats (
  id SERIAL PRIMARY KEY,                              -- 고유 식별자(자동 증가)
  seat_number INTEGER NOT NULL UNIQUE,               -- 좌석 번호(1-40, 고유한 값)
  user_id TEXT NOT NULL,                            -- 사용자 ID(로컬 스토리지에 저장된 값)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()  -- 좌석 할당 시간
);

-- 시스템 정보 테이블 - 초기화 시간 및 시스템 상태 정보 관리
CREATE TABLE IF NOT EXISTS system_info (
  id INTEGER PRIMARY KEY,                            -- 고유 식별자(항상 1값 사용)
  reset_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- 초기화 시간 기록
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()    -- 마지막 업데이트 시간
);

-- 시스템 정보 초기 레코드 삽입 (없는 경우에만)
-- 아이디가 1인 레코드만 사용하여 시스템 상태를 관리
INSERT INTO system_info (id, reset_timestamp)
VALUES (1, NOW())
ON CONFLICT (id) DO NOTHING;  -- 이미 존재하는 경우 무시

/**
 * 실시간 알림을 위한 트리거 함수
 * 테이블 변경시 PostgreSQL 알림(NOTIFY) 기능을 활용하여 연결된 클라이언트에 변경사항을 알림
 */
CREATE OR REPLACE FUNCTION notify_seat_update()
RETURNS TRIGGER AS $$
BEGIN
  -- JSON 형식으로 변경 정보를 포장하여 클라이언트에 전송
  PERFORM pg_notify('seat_updates', json_build_object(
    'table', TG_TABLE_NAME,  -- 변경된 테이블 이름
    'type', TG_OP,           -- 작업 유형(INSERT, UPDATE, DELETE)
    'record', row_to_json(NEW) -- 변경된 레코드 데이터
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 남성 좌석 테이블에 실시간 알림 트리거 추가
-- 좌석 배정 변경시 클라이언트에 실시간 알림을 제공
DROP TRIGGER IF EXISTS notify_male_seat_changes ON male_seats;
CREATE TRIGGER notify_male_seat_changes
AFTER INSERT OR UPDATE OR DELETE ON male_seats  -- 모든 작업 변경시 실행
FOR EACH ROW EXECUTE FUNCTION notify_seat_update();

-- 여성 좌석 테이블에 실시간 알림 트리거 추가
-- 좌석 배정 변경시 클라이언트에 실시간 알림을 제공
DROP TRIGGER IF EXISTS notify_female_seat_changes ON female_seats;
CREATE TRIGGER notify_female_seat_changes
AFTER INSERT OR UPDATE OR DELETE ON female_seats  -- 모든 작업 변경시 실행
FOR EACH ROW EXECUTE FUNCTION notify_seat_update();

-- 시스템 정보 테이블에 실시간 알림 트리거 추가
-- 초기화 시간 변경시 클라이언트에 알림을 제공(좌석 초기화 시)
DROP TRIGGER IF EXISTS notify_system_info_changes ON system_info;
CREATE TRIGGER notify_system_info_changes
AFTER UPDATE ON system_info  -- 업데이트 시에만 실행(삽입 제외)
FOR EACH ROW EXECUTE FUNCTION notify_seat_update();
