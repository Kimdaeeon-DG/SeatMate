// 매일 정오 자동 초기화 관련 함수들

// 매일 정오 자동 초기화 설정
function setupDailyReset(seatAssignment) {
    console.log('📢 매일 정오(12:00) 자동 초기화 설정 시작');
    
    // 다음 초기화 시간 계산
    const timeUntilNextReset = calculateTimeUntilNextReset();
    
    console.log(`📢 다음 초기화까지 ${Math.floor(timeUntilNextReset / (60 * 60 * 1000))}:${Math.floor((timeUntilNextReset / (60 * 1000)) % 60)} 시간 남음`);
    
    // 다음 초기화 시간에 맞춰 타이머 설정
    setTimeout(() => performDailyReset(seatAssignment), timeUntilNextReset);
}

// 다음 초기화 시간까지 남은 시간(밀리초) 계산
function calculateTimeUntilNextReset() {
    // 한국 시간(UTC+9) 기준 현재 시점
    const now = new Date();
    
    // 다음 정오 시간 설정 (한국 시간 기준 12:00)
    const nextReset = new Date(now);
    nextReset.setHours(12, 0, 0, 0);
    
    // 현재 시간이 정오를 지났다면 다음 날 정오로 설정
    if (now >= nextReset) {
        nextReset.setDate(nextReset.getDate() + 1);
    }
    
    // 시간 차이 계산 (밀리초 단위)
    return nextReset.getTime() - now.getTime();
}

// 자동 일간 초기화 수행
async function performDailyReset(seatAssignment) {
    console.log('📢 자동 일간 초기화 시작 (12:00 정오)');
    
    try {
        // 관리자 비밀번호 가져오기
        if (!seatAssignment.adminPassword) {
            await seatAssignment.loadAdminPassword();
        }
        
        // 전체 좌석 초기화 수행
        await seatAssignment.resetAllSeatsForEveryone(seatAssignment.adminPassword);
        console.log('📢 자동 일간 초기화 완료');
        
        // 다음 날 초기화를 위한 타이머 재설정 (24시간 = 86,400,000 밀리초)
        setTimeout(() => performDailyReset(seatAssignment), 24 * 60 * 60 * 1000);
    } catch (error) {
        console.error('🔴 자동 초기화 중 오류 발생:', error);
        
        // 오류 발생 시 30분 후 재시도
        console.log('📢 30분 후 자동 초기화 재시도 예정');
        setTimeout(() => performDailyReset(seatAssignment), 30 * 60 * 1000);
    }
}

// 모듈로 내보내기
export { setupDailyReset, calculateTimeUntilNextReset, performDailyReset };
