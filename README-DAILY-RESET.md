# SeatMate 매일 정오 자동 초기화 설정 가이드

이 문서는 SeatMate 프로젝트의 매일 정오(12:00 KST) 자동 초기화 기능을 Supabase Edge Functions를 활용하여 설정하는 방법을 상세히 안내합니다. 이 기능을 통해 매일 새로운 좌석 할당 사이클을 자동화하여 사용자 경험을 개선할 수 있습니다.

## 개요

### 기존 방식과 비교

| 항목 | 기존 방식 (daily-reset.js) | 새로운 방식 (Supabase Edge Functions) |
|---------|------------------------------|------------------------------------|
| 실행 환경 | 클라이언트 브라우저 | Supabase 서버 인프라 |
| 실행 조건 | 브라우저가 열려 있어야 함 | 브라우저 상태와 무관하게 실행 |
| 신뢰성 | 네트워크 연결 여부에 영향 받음 | 고안정성 보장 |
| 동시성 처리 | 제한적 | 데이터베이스 트랜잭션 활용 |
| 보안 | 클라이언트 수준 인증 | 인증 토큰 기반 접근 제어 |

### 주요 기능

- **서버 측 처리**: 클라이언트 측 JavaScript 코드(`daily-reset.js`)에서 Supabase Edge Functions로 마이그레이션하여 안정성 향상
- **정확한 스케줄링**: 매일 한국 시간 정오(12:00 KST)에 정확하게 실행되는 초기화 작업
- **데이터 일관성**: PostgreSQL 트랜잭션을 활용하여 초기화 과정 중 오류가 발생해도 데이터 일관성 보장
- **보안 강화**: 서비스 역할 키(service role key)와 인증 토큰을 통한 안전한 접근 통제
- **실시간 알림**: 초기화 완료 후 싸바제 실시간 채널을 통한 클라이언트 알림 기능

## 설정 방법

초기화 기능 설정은 다음과 같은 3단계로 진행됩니다: 1) Edge Function 배포, 2) 스케줄링 설정, 3) 보안 설정. 각 단계의 상세한 설명은 다음과 같습니다.

### 1. Edge Function 배포

#### 준비 사항

- Node.js 및 npm 설치 (최신 LTS 버전 권장)
- Supabase 계정 및 프로젝트 생성 완료
- 로컬 개발 환경에 프로젝트 다운로드

#### 배포 단계

Supabase CLI를 사용하여 Edge Function을 배포합니다:

```bash
# 1. Supabase CLI 설치 (설치되지 않은 경우)
npm install -g supabase

# 2. Supabase 프로젝트에 로그인
supabase login

# 3. 프로젝트 디렉토리로 이동
cd /path/to/SeatMate

# 4. Edge Function 배포
supabase functions deploy daily-reset --project-ref YOUR_PROJECT_REF
```

> **필수 정보**: `YOUR_PROJECT_REF`는 Supabase 프로젝트 대시보드의 설정 > API 페이지에서 확인할 수 있는 프로젝트 레퍼런스 ID입니다 (URL의 프로젝트 ID 부분을 사용하면 됩니다).

#### 배포 후 확인

배포가 성공적으로 완료되었는지 확인하는 방법:

```bash
# 배포된 함수 목록 확인
supabase functions list --project-ref YOUR_PROJECT_REF

# 함수 로그 확인
supabase functions logs daily-reset --project-ref YOUR_PROJECT_REF
```

### 2. 스케줄링 설정

#### 스케줄링 설정 방법

Supabase 대시보드에서 다음 단계를 따라 매일 정오 초기화 스케줄링을 설정합니다:

1. Supabase 프로젝트 대시보드(https://supabase.com/dashboard)에 로그인합니다.
2. 프로젝트를 선택한 후 왼쪽 메뉴에서 "Database" > "Scheduled Functions"를 선택합니다.
3. 페이지 상단의 "Create a new scheduled function"을 클릭합니다.
4. 다음 정보를 정확하게 입력합니다:
   - **Name**: `daily-reset-at-noon` (원하는 익숙한 이름으로 변경 가능)
   - **Schedule (CRON)**: `0 3 * * *` (UTC 기준 03:00 = KST 12:00)
   - **Function to execute**: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-reset`
   - **HTTP Method**: `POST`
   - **Headers**: `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`

#### 시간대 설정 정보

| 한국 시간(KST) | UTC 시간 | CRON 표현식 |
|------------------|-------------|----------------|
| 오전 12:00 (정오) | 오전 03:00 | `0 3 * * *` |
| 오후 06:00 (오후) | 오전 09:00 | `0 9 * * *` |
| 오전 09:00 (오전) | 오전 00:00 | `0 0 * * *` |

> **중요**: Supabase는 UTC 시간을 사용하므로 한국 시간(KST)과의 9시간 차이를 반드시 고려해야 합니다. 예를 들어 한국 시간 정오(12:00 KST)는 UTC 기준으로 오전 3시(03:00 UTC)입니다.

#### 인증 토큰 설정

- `YOUR_SERVICE_ROLE_KEY`는 Supabase 프로젝트 설정 > API 섹션에서 찾을 수 있는 'service_role' 스키마의 API 키를 사용합니다.
- 이 키는 데이터베이스에 대한 관리자 권한을 가지으므로 절대 공개되지 않도록 주의해야 합니다.

> **보안 주의**: 절대로 직접 코드에 키를 하드코딩하지 마십시오. 반드시 환경 변수나 Supabase 대시보드의 secrets 기능을 활용하세요.

### 3. 보안 설정

#### 환경 변수 구성

Edge Function에 필요한 환경 변수를 설정합니다. 이 변수들은 Edge Function이 데이터베이스에 안전하게 접근하기 위해 필수적입니다:

```bash
# Supabase 프로젝트 URL 설정
supabase secrets set SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co --project-ref YOUR_PROJECT_REF

# 서비스 역할 키 설정
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY --project-ref YOUR_PROJECT_REF
```

#### 설정 확인 방법

환경 변수가 정상적으로 설정되었는지 확인하는 방법(실제 값은 표시되지 않음):

```bash
# 설정된 secrets 목록 확인
supabase secrets list --project-ref YOUR_PROJECT_REF
```

#### 환경 변수 테스트

Edge Function에서 환경 변수에 접근할 수 있는지 확인하는 간단한 테스트:

```typescript
// Edge Function 내부에서 테스트하는 코드 예시
console.log('SUPABASE_URL 설정 여부:', Deno.env.get('SUPABASE_URL') !== undefined);
console.log('SUPABASE_SERVICE_ROLE_KEY 설정 여부:', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') !== undefined);
```

> **보안 주의사항**: 
> - 절대 서비스 역할 키를 소스 코드에 하드코딩하지 마세요.
> - 이 키는 데이터베이스에 대한 전체 관리자 권한을 가지므로 노출시 보안 위험이 매우 커집니다.
> - GitHub 같은 공개 리포지토리에 커밋하지 않도록 주의하세요 (`.gitignore`에 관련 파일 추가).
> - Supabase CLI의 `secrets` 기능은 해당 값을 안전하게 암호화하여 저장합니다.

## 작동 원리

### 초기화 프로세스 흐름 상세 절차

![SeatMate 자동 초기화 플로우](/assets/daily-reset-flow.png)

> 위 이미지가 로드되지 않는 경우, 아래 텍스트 설명을 참조하세요.

1. **스케줄러 호출** (UTC 03:00 / KST 12:00)
   - Supabase 스케줄러가 정해진 CRON 표현식(`0 3 * * *`)에 따라 Edge Function을 HTTP POST로 호출
   - 호출 시 `Authorization: Bearer YOUR_SERVICE_ROLE_KEY` 헤더 포함

2. **인증 및 권한 검증**
   - Edge Function은 먼저 요청 헤더의 `Authorization` 토큰을 검증
   - 토큰이 유효한 `service_role` 키인지 확인
   - 유효하지 않은 경우 401/403 오류 반환

3. **데이터베이스 연결 및 초기화 트랜잭션 시작**
   - `createClient()` 함수를 통해 실행 환경(Deno)에서 Supabase 클라이언트 생성
   - 환경 변수(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)를 사용하여 연결 구성
   - SQL 트랜잭션 시작 (`BEGIN` 구문)

4. **좌석 데이터 초기화 실행**
   - 보안을 위해 RLS(Row Level Security) 정책을 우회하는 `rpc()` 호출 사용
   - 트랜잭션 내에서 다음 작업 수행:
     ```sql
     TRUNCATE male_seats, female_seats; -- 모든 성별 좌석 데이터 삭제
     UPDATE system_info SET reset_timestamp = NOW(); -- 초기화 시간 기록
     ```
   - 작업이 성공하면 트랜잭션 확정 (`COMMIT`)
   - 오류 발생 시 돌아가기 (`ROLLBACK`)

5. **클라이언트 알림 메커니즘 작동**
   - 초기화 작업이 완료되면 PostgreSQL 트리거가 자동으로 실행됨
   - 트리거는 Supabase Realtime 채널을 통해 알림 전송
   - 웹 클라이언트는 realtime 구독을 통해 알림 수신
   - 알림 수신 시 UI 업데이트 또는 새로고침 유도

6. **초기화 결과 반환**
   - 작업 결과(JSON 형식)가 HTTP 응답으로 반환됨
   - 성공 시: `{"success": true, "message": "좌석이 성공적으로 초기화되었습니다.", "timestamp": "2025-03-13T12:00:00+09:00"}`
   - 실패 시: `{"success": false, "message": "오류 메시지", "error": "오류 상세 정보"}`

### 기술적 구현 상세

#### 사용 기술 스택

| 기술 | 목적 | 설명 |
|---------|--------|--------|
| **Supabase Edge Functions** | 서버리스 기능 실행 | Deno 기반 서버리스 함수 환경 |
| **TypeScript** | 타입 안전성 | 정적 타이핑을 통한 코드 안정성 제공 |
| **PostgreSQL** | 데이터 처리 | 트랜잭션 기반 좌석 초기화 처리 |
| **Supabase Realtime** | 실시간 통신 | 실시간 알림 및 데이터 동기화 |
| **Deno** | 실행 환경 | 현대적 JavaScript/TypeScript 런타임 |

#### 핵심 구현 코드

```typescript
// daily-reset/index.ts 핵심 부분 예시 (실제 코드와 다를 수 있음)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

serve(async (req) => {
  try {
    // 1. 인증 토큰 검증
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: '인증이 필요합니다.' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 2. Supabase 클라이언트 생성
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // 3. 좌석 초기화 작업 실행
    const { data, error } = await supabase.rpc('reset_all_seats');
    
    if (error) throw error;
    
    // 4. 성공 응답 반환
    return new Response(JSON.stringify({
      success: true,
      message: '좌석이 성공적으로 초기화되었습니다.',
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // 오류 처리 및 로깅
    console.error('좌석 초기화 중 오류 발생:', error);
    return new Response(JSON.stringify({
      success: false,
      message: '좌석 초기화 중 오류가 발생했습니다.',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
```

#### 동시성 처리 기술

- **트랜잭션 기반 가용성**: PostgreSQL 트랜잭션을 활용하여 새 일관성 보장 (ACID 특성)
- **실시간 너비퍼고 해결**: PostgreSQL NOTIFY/LISTEN 및 Supabase Realtime 채널을 통한 실시간 동기화
- **고장 허용**: 작업 실패 시 자동 롤백을 통한 안전한 데이터 관리

## 장점

### 안정성 및 신뢰성
- **24/7 실행 보장**: 클라이언트 브라우저가 열려있지 않아도 초기화가 자동으로 실행됩니다.
- **서버 측 처리**: Supabase 인프라에서 안정적으로 실행되어 클라이언트 상태나 네트워크 문제에 영향을 받지 않습니다.
- **중단 없는 서비스**: 사용자가 접속하지 않는 시간에도 시스템이 자동으로 관리됩니다.

### 보안 및 데이터 일관성
- **트랜잭션 처리**: 데이터베이스 수준의 트랜잭션을 통해 초기화 과정 중 오류가 발생해도 일관성을 유지합니다.
- **인증 기반 보호**: 보안 토큰을 통한 인증으로 무단 접근 및 초기화 요청을 방지합니다.
- **권한 분리**: 서비스 역할 키를 사용하여 필요한 최소한의 권한만 부여합니다.

### 확장성 및 유지보수
- **중앙 집중식 관리**: 스케줄링 설정을 Supabase 대시보드에서 쉽게 변경할 수 있습니다.
- **로깅 및 모니터링**: Supabase에서 실행 로그를 확인하여 문제 진단이 용이합니다.
- **코드 분리**: 클라이언트 코드와 서버 측 초기화 로직이 분리되어 유지보수가 용이합니다.

## 문제 해결 및 디버깅

초기화가 작동하지 않거나 문제가 발생하는 경우, 다음 단계에 따라 진단하고 해결할 수 있습니다:

### 기본 점검 사항

1. **실행 로그 확인**: 
   - Supabase 대시보드에서 스케줄된 함수의 실행 로그를 확인합니다.
   - Edge Function의 로그를 확인합니다: `supabase functions logs daily-reset`

2. **환경 변수 검증**:
   - 환경 변수가 올바르게 설정되었는지 확인합니다: `supabase secrets list`
   - `SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`가 정확히 설정되었는지 확인합니다.

3. **인증 검증**:
   - 서비스 역할 키가 유효한지 확인합니다.
   - 스케줄링 설정의 Authorization 헤더가 올바른 형식(`Bearer YOUR_SERVICE_ROLE_KEY`)인지 확인합니다.

### 수동 테스트

초기화 기능을 수동으로 테스트하려면 다음 cURL 명령을 사용할 수 있습니다:

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-reset \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

### 일반적인 문제 및 해결 방법

1. **403 Forbidden 오류**:
   - 서비스 역할 키가 올바르게 설정되었는지 확인하세요.
   - Authorization 헤더 형식이 정확한지 확인하세요.

2. **500 Internal Server Error**:
   - Edge Function 로그를 확인하여 오류 메시지를 파악하세요.
   - 데이터베이스 연결 문제인지 확인하세요.

3. **초기화는 성공했지만 클라이언트에 반영되지 않음**:
   - 실시간 구독 및 알림 메커니즘이 올바르게 작동하는지 확인하세요.
   - 클라이언트 측 코드에서 시스템 정보 테이블의 변경 사항을 감지하는지 확인하세요.

> **참고**: 문제가 지속되는 경우 Edge Function 코드를 검토하고 디버그 로그를 추가하여 문제를 더 자세히 진단할 수 있습니다.

## 자주 묻는 질문 (FAQ)

### 기본 정보

#### Q: 이 기능이 배포된 적이 있나요?
A: 네, 현재 운영 중인 SeatMate 프로젝트에 성공적으로 배포되어 사용중입니다. 매일 정오(KST 12:00)에 초기화가 자동으로 실행되고 있습니다.

#### Q: 기존 클라이언트 시스템과 어떤 테스트를 진행했나요?
A: 안정성, 성능, 동시성 처리 능력을 테스트했습니다. 같은 좌석을 동시에 여러 사용자가 선택하는 경우와 긴 시간 지속적인 시스템 안정성을 중점적으로 검증했습니다.

### 기술 관련 질문

#### Q: 동시성 문제는 어떻게 해결했나요?
A: PostgreSQL 트랜잭션을 사용하여 동시성 문제를 해결했습니다. 좌석 초기화 작업을 단일 트랜잭션 내에서 처리하여 ACID 속성을 보장하고, 오류 발생 시 로백을 통해 데이터 일관성을 보존합니다.

#### Q: Supabase Edge Functions의 크기 제한이 있나요?
A: 네, Supabase의 무료 플랜에서는 Edge Function의 실행 시간과 메모리 사용에 제한이 있습니다. 그러나 좌석 초기화와 같은 가벼운 작업은 이러한 제한에 충분히 맞게 설계되어 있습니다.

#### Q: PostgreSQL의 `NOTIFY/LISTEN` 기능은 어떻게 활용되나요?
A: PostgreSQL의 `NOTIFY/LISTEN` 기능은 데이터베이스 레벨에서 실시간 이벤트를 발생시키고 수신하는 데 사용됩니다. 좌석 초기화가 완료되면 데이터베이스 트리거가 `NOTIFY` 명령을 실행하고, Supabase Realtime을 통해 연결된 클라이언트에게 알림이 전달됩니다.

### 관리 및 운영 관련

#### Q: 초기화 시간을 변경하고 싶다면 어떻게 해야 하나요?
A: Supabase 대시보드의 "Database" > "Scheduled Functions" 섹션에서 스케줄링 작업을 편집하여 CRON 표현식을 수정하면 됩니다. 예를 들어, 한국 시간 오후 6시로 변경하고 싶다면 `0 9 * * *`로 설정하세요.

#### Q: 이 시스템을 백업하는 방법은 무엇인가요?
A: Supabase에서는 데이터베이스 백업 기능을 제공합니다. 백업하려면 Supabase 대시보드의 "Database" > "Backups" 섹션에서 수동 백업을 실행하거나, 프로 플랜에서는 자동 백업을 설정할 수 있습니다. Edge Function의 코드는 별도로 Git 등을 통해 버전 관리하는 것이 권장됩니다.

#### Q: Edge Function 코드를 갱신하려면 어떻게 해야 하나요?
A: 코드를 수정한 후 Supabase CLI로 다시 배포해야 합니다:
```bash
supabase functions deploy daily-reset --project-ref YOUR_PROJECT_REF
```
함수를 수정한 후에는 작동을 확인하기 위해 수동으로 테스트하는 것이 좋습니다.

### 고급 사용 사례

#### Q: 좀 더 복잡한 초기화 로직을 구현하고 싶다면 어떻게 해야 하나요?
A: Edge Function 코드를 확장하여 추가 로직을 구현할 수 있습니다. 예를 들어, 특정 조건에 따라 일부 좌석만 초기화하거나, 초기화 전 데이터를 보관하는 등의 기능을 추가할 수 있습니다.

#### Q: 초기화 작업을 로깅하고 모니터링하는 방법이 있나요?
A: 네, 다음과 같은 방법을 사용할 수 있습니다:
1. Edge Function 내에 `console.log`를 추가하여 중요한 이벤트를 기록합니다.
2. Supabase CLI를 통해 로그를 확인합니다: `supabase functions logs daily-reset`
3. 중요한 이벤트는 데이터베이스 테이블(`system_logs` 등)에 기록하여 영구 보관하거나 나중에 분석할 수 있습니다.

#### Q: 해당 기능은 여러 지역/타임존에서 사용할 수 있나요?
A: 네, 여러 지역에 서비스를 제공하는 경우 각 지역별로 다른 Edge Function과 스케줄링을 설정하거나, 단일 Edge Function 내에서 지역별 로직을 추가할 수 있습니다. 타임존 별 초기화 설정은 서로 다른 CRON 표현식을 갖는 여러 스케줄러를 구성하여 구현할 수 있습니다.
