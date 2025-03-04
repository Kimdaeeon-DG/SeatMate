# SeatMate 설정 가이드

## Supabase 설정 방법

SeatMate 애플리케이션의 동시성 문제를 해결하기 위해 Supabase에 PostgreSQL 함수를 설정해야 합니다. 아래 단계를 따라 설정을 완료하세요.

### 1. Supabase 프로젝트 접속

1. [Supabase 대시보드](https://app.supabase.io)에 로그인합니다.
2. 프로젝트를 선택하거나 새 프로젝트를 생성합니다.

### 2. 테이블 생성

1. Supabase 대시보드에서 좌측 메뉴의 **Table Editor**를 클릭합니다.
2. SQL 에디터를 열고 다음 SQL 스크립트를 실행합니다:

```sql
-- sql/setup_tables.sql 파일의 내용을 복사하여 붙여넣으세요
```

### 3. PostgreSQL 함수 생성

1. Supabase 대시보드에서 좌측 메뉴의 **SQL Editor**를 클릭합니다.
2. 새 쿼리를 생성하고 다음 SQL 스크립트를 실행합니다:

```sql
-- sql/reserve_seat_function.sql 파일의 내용을 복사하여 붙여넣으세요
```

### 4. 함수 테스트

1. SQL 에디터에서 다음 명령을 실행하여 함수가 제대로 작동하는지 테스트합니다:

```sql
-- 좌석 예약 테스트
SELECT reserve_seat(1, 'test_user_1', 'male');

-- 동일한 좌석에 다른 사용자 예약 시도 (실패해야 함)
SELECT reserve_seat(1, 'test_user_2', 'male');

-- 사용 가능한 좌석 찾기 테스트
SELECT find_available_seat('male');
```

### 5. 테이블 권한 설정

1. Supabase 대시보드에서 좌측 메뉴의 **Authentication** > **Policies**를 클릭합니다.
2. `male_seats`와 `female_seats` 테이블에 대해 다음 정책을 설정합니다:

#### 읽기 권한 (SELECT)
```sql
-- 모든 사용자가 읽을 수 있도록 설정
(true)
```

#### 쓰기 권한 (INSERT)
```sql
-- PostgreSQL 함수를 통해서만 INSERT 가능하도록 설정
(role() = 'authenticated' OR role() = 'anon')
```

## 프론트엔드 설정

1. `supabase-config.js` 파일에서 Supabase URL과 API 키가 올바르게 설정되어 있는지 확인합니다.
2. 웹 서버를 사용하여 애플리케이션을 실행합니다.

## 테스트 방법

1. 여러 브라우저 창을 열어 동시에 좌석 할당을 시도합니다.
2. 동일한 좌석에 대해 동시에 요청을 보내도 한 명의 사용자만 성공하고 다른 사용자는 자동으로 다른 좌석을 할당받는지 확인합니다.
3. 관리자 페이지(`admin.html`)에서 좌석 상태를 확인합니다.

## 문제 해결

- **함수 호출 오류**: Supabase 콘솔에서 SQL 에디터를 사용하여 함수가 올바르게 생성되었는지 확인합니다.
- **테이블 접근 오류**: RLS(Row Level Security) 정책이 올바르게 설정되었는지 확인합니다.
- **실시간 업데이트 문제**: 브라우저 콘솔에서 Supabase 실시간 구독 관련 오류를 확인합니다.
