// 매일 정오 자동 초기화 관련 함수들

// 매일 정오 자동 초기화 설정
function setupDailyReset(seatAssignment) {
    console.log('📢 매일 정오(12:00) 자동 초기화 설정 시작');
    
    // 다음 초기화 시간 계산
    const timeUntilNextReset = calculateTimeUntilNextReset();
    
    console.log(`📢 다음 초기화까지 ${Math.floor(timeUntilNextReset / (60 * 60 * 1000))}시간 ${Math.floor((timeUntilNextReset / (60 * 1000)) % 60)}분 남음`);
    
    // 다음 초기화 시간에 맞춰 타이머 설정
    setTimeout(() => performDailyReset(seatAssignment), timeUntilNextReset);
    
    // 디버깅을 위한 현재 시간 표시
    const now = new Date();
    console.log(`현재 시간(로컬): ${now.toString()}`);
    console.log(`현재 시간(ISO): ${now.toISOString()}`);
    console.log(`현재 시간대 오프셋: ${now.getTimezoneOffset()}분`);
}

// 다음 초기화 시간까지 남은 시간(밀리초) 계산
function calculateTimeUntilNextReset() {
    // 현재 시간 가져오기
    const now = new Date();
    
    // 한국 시간(KST)으로 변환 (UTC+9)
    const koreaTimeOffset = 9 * 60 * 60 * 1000; // 9시간을 밀리초로 변환
    const nowInKST = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + koreaTimeOffset);
    
    console.log(`현재 시간(KST): ${nowInKST.toISOString()}, 시간: ${nowInKST.getHours()}:${nowInKST.getMinutes()}`);
    
    // 다음 정오 시간 설정 (한국 시간 기준 12:00)
    const nextResetKST = new Date(nowInKST);
    nextResetKST.setHours(12, 0, 0, 0);
    
    // 현재 시간이 정오를 지났다면 다음 날 정오로 설정
    if (nowInKST.getHours() >= 12) {
        nextResetKST.setDate(nextResetKST.getDate() + 1);
        console.log('오늘 정오가 지났으므로 다음 날 정오로 설정');
    }
    
    console.log(`다음 초기화 시간(KST): ${nextResetKST.toISOString()}`);
    
    // 다시 UTC로 변환하여 시간 차이 계산
    const nextResetUTC = new Date(nextResetKST.getTime() - koreaTimeOffset - (now.getTimezoneOffset() * 60 * 1000));
    
    // 시간 차이 계산 (밀리초 단위)
    const timeUntilReset = nextResetUTC.getTime() - now.getTime();
    console.log(`다음 초기화까지 남은 시간: ${Math.floor(timeUntilReset / (60 * 60 * 1000))}시간 ${Math.floor((timeUntilReset / (60 * 1000)) % 60)}분`);
    
    return timeUntilReset;
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
        
        // 다음 초기화 시간 계산 (정확한 시간에 맞추기 위해 매번 계산)
        const timeUntilNextReset = calculateTimeUntilNextReset();
        console.log(`다음 초기화 예정 시간까지 ${Math.floor(timeUntilNextReset / (60 * 60 * 1000))}시간 ${Math.floor((timeUntilNextReset / (60 * 1000)) % 60)}분 남음`);
        
        // 다음 초기화를 위한 타이머 설정
        setTimeout(() => performDailyReset(seatAssignment), timeUntilNextReset);
    } catch (error) {
        console.error('🔴 자동 초기화 중 오류 발생:', error);
        
        // 오류 발생 시 30분 후 재시도
        console.log('📢 30분 후 자동 초기화 재시도 예정');
        setTimeout(() => performDailyReset(seatAssignment), 30 * 60 * 1000);
    }
}

// 모듈로 내보내기
export { setupDailyReset, calculateTimeUntilNextReset, performDailyReset };
