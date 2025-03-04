class SeatAssignment {
    constructor() {
        // 기본 설정
        this.totalRows = 10;
        this.totalCols = 4;
        this.selectedGender = null;
        this.maleAssignments = new Set();
        this.femaleAssignments = new Set();
        this.userId = this.generateOrGetUserId();
        this.userSeat = this.loadUserSeat();
        this.adminPassword = 'love1030'; // 관리자 비밀번호 중앙 관리
        this.lastResetTimestamp = localStorage.getItem('lastResetTimestamp') || '0';

        // 초기화 및 설정
        this.initializeElements();
        this.initializeEventListeners();
        this.createSeatGrid();
        
        // Supabase에서 좌석 데이터 로드 및 로컬 스토리지 동기화
        this.loadSeatsFromSupabase().then((data) => {
            // 서버에 좌석 데이터가 없으면 로컬 스토리지 초기화 검토
            this.checkResetStatus(data);
            this.loadAndDisplayUserSeat();
        });
        
        // 실시간 업데이트 리스너 설정
        this.setupRealtimeListener();
        
        // 개발자용 초기화 기능 설정
        this.setupDevTools();
    }
    
    // 고유 사용자 ID 생성 또는 가져오기
    generateOrGetUserId() {
        let userId = localStorage.getItem('userId');
        if (!userId) {
            userId = 'user_' + Math.random().toString(36).substring(2, 15);
            localStorage.setItem('userId', userId);
        }
        return userId;
    }

    initializeElements() {
        this.seatNumberDisplay = document.getElementById('seatNumber');
        this.maleBtn = document.getElementById('maleBtn');
        this.femaleBtn = document.getElementById('femaleBtn');
        this.selectBtn = document.getElementById('selectBtn');
        this.seatGrid = document.querySelector('.seat-grid');
    }

    initializeEventListeners() {
        this.maleBtn.addEventListener('click', () => this.selectGender('male'));
        this.femaleBtn.addEventListener('click', () => this.selectGender('female'));
        this.selectBtn.addEventListener('click', () => this.assignSeat());
    }

    createSeatGrid() {
        // 행 우선으로 좌석 생성 (왼쪽에서 오른쪽으로, 위에서 아래로)
        let seatNumber = 1;
        
        for (let i = 0; i < this.totalRows; i++) {
            for (let j = 0; j < this.totalCols; j++) {
                const seat = document.createElement('div');
                seat.className = 'seat';
                seat.textContent = seatNumber++;
                
                // 열 구분을 위한 클래스 추가
                if (j === 0) {
                    seat.classList.add('column-1');
                } else if (j === 1) {
                    seat.classList.add('column-2');
                } else if (j === 2) {
                    seat.classList.add('column-3');
                } else if (j === 3) {
                    seat.classList.add('column-4');
                }
                
                this.seatGrid.appendChild(seat);
            }
        }
    }

    selectGender(gender) {
        this.selectedGender = gender;
        this.maleBtn.classList.toggle('active', gender === 'male');
        this.femaleBtn.classList.toggle('active', gender === 'female');
    }

    getNextAvailableSeat(gender) {
        // 모든 좌석을 순회하면서 사용자가 선택한 성별에 따라 가능한 좌석 찾기
        for (let i = 1; i <= this.totalRows * this.totalCols; i++) {
            // 해당 성별로 이미 할당된 좌석이 아니면 선택 가능
            // 다른 성별이 이미 할당되어 있어도 선택 가능하도록 변경
            const assignments = gender === 'male' ? this.maleAssignments : this.femaleAssignments;
            if (!assignments.has(i)) {
                return i;
            }
        }
        return null;
    }

    // 좌석 할당 기능
    async assignSeat() {
        // 유효성 검사
        if (!this.validateSeatAssignment()) {
            return;
        }

        // 다음 가능한 좌석 가져오기
        const seatNumber = this.getNextAvailableSeat(this.selectedGender);
        
        try {
            console.log('📍 좌석 할당 시도:', { seatNumber, gender: this.selectedGender, userId: this.userId });
            
            // 로컬 상태 업데이트
            this.updateLocalSeatAssignment(seatNumber);
            
            // Supabase에 좌석 할당 정보 저장
            await this.saveSeatToSupabase(seatNumber);
            
            console.log(`✅ 좌석 ${seatNumber}번이 성공적으로 할당되었습니다.`);
            
        } catch (error) {
            console.error('좌석 할당 중 오류 발생:', error);
            // 오류가 발생해도 사용자가 좌석을 선택할 수 있도록 유지
            alert('서버 연결 오류가 발생했지만, 좌석은 임시로 할당되었습니다.');
        }
    }
    
    // 좌석 할당 유효성 검사
    validateSeatAssignment() {
        // 이미 좌석이 배정된 사용자인지 확인
        if (this.userSeat) {
            alert('이미 좌석이 배정되어 있습니다.');
            return false;
        }

        // 성별 선택 여부 확인
        if (!this.selectedGender) {
            alert('성별을 선택해주세요.');
            return false;
        }
        
        // 모든 좌석이 해당 성별로 이미 할당되었는지 확인
        const availableSeat = this.getNextAvailableSeat(this.selectedGender);
        if (availableSeat === null) {
            alert(`더 이상 ${this.selectedGender === 'male' ? '남성' : '여성'} 좌석이 없습니다.`);
            return false;
        }
        
        return true;
    }
    
    // 로컬 좌석 할당 정보 업데이트
    updateLocalSeatAssignment(seatNumber) {
        const assignments = this.selectedGender === 'male' ? this.maleAssignments : this.femaleAssignments;
        assignments.add(seatNumber);

        this.userSeat = { number: seatNumber, gender: this.selectedGender, userId: this.userId };
        this.saveUserSeat();
        this.updateSeatDisplay();
    }
    
    // Supabase에 좌석 할당 정보 저장
    async saveSeatToSupabase(seatNumber) {
        try {
            console.log(`💾 Supabase에 좌석 저장 시도: 좌석 ${seatNumber}, 성별 ${this.selectedGender}`);
            
            // 성별에 따라 테이블 선택
            const tableName = this.selectedGender === 'male' ? 'male_seats' : 'female_seats';
            
            // 해당 테이블에서 좌석 번호로 기존 데이터 확인
            const { data: existingData, error: fetchError } = await supabase
                .from(tableName)
                .select('*')
                .eq('seat_number', seatNumber);
                
            if (fetchError) {
                throw new Error(`기존 데이터 확인 오류: ${fetchError.message}`);
            }
            
            // 기존 데이터가 있는지 확인
            if (existingData && existingData.length > 0) {
                // 이미 존재하는 좌석 - 사용자 ID 업데이트
                console.log(`⚠️ 기존 좌석 발견: 업데이트 시도`);
                const updateResult = await supabase
                    .from(tableName)
                    .update({ user_id: this.userId })
                    .eq('seat_number', seatNumber);
                    
                if (updateResult.error) {
                    throw new Error(`좌석 업데이트 오류: ${updateResult.error.message}`);
                }
                
                console.log(`✅ 기존 좌석 업데이트 성공: 좌석 ${seatNumber}, 테이블 ${tableName}`);
            } else {
                // 새로운 좌석 할당
                console.log(`➕ 새 좌석 할당 시도: 테이블 ${tableName}`);
                const result = await supabase
                    .from(tableName)
                    .insert([
                        { 
                            seat_number: seatNumber, 
                            user_id: this.userId
                        }
                    ]);
                
                if (result.error) {
                    // 중복 오류가 발생하면 업데이트 시도
                    if (result.error.code === '23505') { // 중복 제약 조건 위방 코드
                        console.log(`⚠️ 중복 오류 발생: 업데이트 시도`);
                        // 이미 존재하는 데이터를 업데이트
                        const updateResult = await supabase
                            .from(tableName)
                            .update({ user_id: this.userId })
                            .eq('seat_number', seatNumber);
                            
                        if (updateResult.error) {
                            throw new Error(`좌석 업데이트 오류: ${updateResult.error.message}`);
                        }
                        
                        console.log(`✅ 좌석 업데이트 성공: 좌석 ${seatNumber}, 테이블 ${tableName}`);
                    } else {
                        throw new Error(`좌석 저장 오류: ${result.error.message}`);
                    }
                } else {
                    console.log(`✅ Supabase에 좌석 저장 성공: 좌석 ${seatNumber}, 테이블 ${tableName}`);
                }
            }
        } catch (error) {
            console.error('좌석 저장 오류:', error);
            // 오류가 발생해도 사용자 경험을 위해 로컬에는 유지
            // 다음 시도에 자동 동기화 예정
        }
    }

    // 좌석 표시 업데이트 - 사용자의 좌석만 표시
    updateSeatDisplay() {
        // 모든 좌석 표시 초기화
        this.resetSeatDisplay();
        
        // 사용자 자신의 좌석만 표시
        if (this.userSeat) {
            const seats = document.querySelectorAll('.seat');
            const seatIndex = this.userSeat.number - 1;
            const seatElement = seats[seatIndex];
            
            if (seatElement) {
                // 개인 페이지에서는 항상 사용자 자신의 성별로만 표시
                // 혼합 성별(노란색)은 관리자 페이지에서만 표시
                seatElement.classList.add(this.userSeat.gender);
            }
            
            this.seatNumberDisplay.textContent = `${this.userSeat.number}번입니다`;
        } else {
            this.seatNumberDisplay.textContent = '좌석을 선택해주세요';
        }
    }
    
    // 모든 좌석 표시 초기화
    resetSeatDisplay() {
        const seats = document.querySelectorAll('.seat');
        seats.forEach(seat => {
            seat.classList.remove('male', 'female', 'mixed');
        });
    }

    saveUserSeat() {
        localStorage.setItem('userSeat', JSON.stringify(this.userSeat));
    }

    loadUserSeat() {
        const savedSeat = localStorage.getItem('userSeat');
        return savedSeat ? JSON.parse(savedSeat) : null;
    }
    
    // Supabase에서 좌석 데이터 로드
    async loadSeatsFromSupabase() {
        try {
            // 남성 좌석 데이터 로드
            const { data: maleData, error: maleError } = await supabase
                .from('male_seats')
                .select('*');
                
            // 여성 좌석 데이터 로드
            const { data: femaleData, error: femaleError } = await supabase
                .from('female_seats')
                .select('*');
                
            if (maleError) {
                console.error('남성 좌석 데이터 로드 오류:', maleError);
            }
            
            if (femaleError) {
                console.error('여성 좌석 데이터 로드 오류:', femaleError);
            }
            
            // 좌석 데이터 초기화
            this.maleAssignments.clear();
            this.femaleAssignments.clear();

            // 남성 데이터에 성별 정보 추가
            const processedMaleData = (maleData || []).map(seat => ({
                ...seat,
                gender: 'male'
            }));
            
            // 여성 데이터에 성별 정보 추가
            const processedFemaleData = (femaleData || []).map(seat => ({
                ...seat,
                gender: 'female'
            }));
            
            // 남성과 여성 데이터 합치기
            const combinedData = [...processedMaleData, ...processedFemaleData];
            
            // 데이터베이스에서 좌석 정보 로드
            this.processSeatsData(combinedData);
            
            // 좌석 표시 업데이트
            this.updateSeatDisplay();
            
            return combinedData;
        } catch (error) {
            console.error('좌석 데이터 로드 중 오류 발생:', error);
            return [];
        }
    }
    
    // 서버에서 가져온 좌석 데이터 처리
    processSeatsData(data) {
        // 좌석별 성별 할당 정보를 임시로 저장할 객체
        const seatOccupancy = {};
        
        // 먼저 각 좌석별로 할당된 성별 정보 수집
        data.forEach(seat => {
            const seatNumber = seat.seat_number;
            if (!seatOccupancy[seatNumber]) {
                seatOccupancy[seatNumber] = [];
            }
            seatOccupancy[seatNumber].push(seat.gender);
            
            // 현재 사용자의 좌석인지 확인
            if (seat.user_id === this.userId) {
                this.userSeat = {
                    number: seat.seat_number,
                    gender: seat.gender,
                    userId: seat.user_id
                };
                this.saveUserSeat();
            }
        });
        
        // 수집된 정보를 기반으로 남성/여성 할당 처리
        for (const [seatNumber, genders] of Object.entries(seatOccupancy)) {
            const seatNum = parseInt(seatNumber);
            const hasMale = genders.includes('male');
            const hasFemale = genders.includes('female');
            
            if (hasMale) {
                this.maleAssignments.add(seatNum);
            }
            
            if (hasFemale) {
                this.femaleAssignments.add(seatNum);
            }
        }
    }
    
    // 초기화 상태 확인 - 서버에 데이터가 없지만 로컬에 있는 경우 초기화
    async checkResetStatus(serverData) {
        console.log('📢 초기화 상태 확인 시작');
        
        // 서버에 데이터가 없고 로컬에 좌석 정보가 있는 경우
        if (serverData.length === 0 && this.userSeat) {
            console.log('📢 서버에 데이터가 없지만 로컬에 좌석 정보가 있음 - 초기화 필요');
            
            // 서버에 데이터가 없는 경우 = 초기화가 이미 이루어졌을 가능성
            // 로컬 스토리지 초기화
            this.resetClientState();
            return true;
        }
        
        // 서버에 데이터가 있지만 현재 사용자의 좌석이 없는 경우 확인
        if (serverData.length > 0 && this.userSeat) {
            const userSeatExists = serverData.some(seat => 
                seat.user_id === this.userId && 
                seat.seat_number === this.userSeat.number);
                
            if (!userSeatExists) {
                console.log('📢 서버에 현재 사용자의 좌석 정보가 없음 - 로컬 스토리지 초기화');
                this.resetClientState();
                return true;
            }
        }
        
        // system_info 테이블에서 초기화 정보 확인
        try {
            const { data: systemInfo, error } = await supabase
                .from('system_info')
                .select('*')
                .eq('id', 1)
                .single();
                
            if (error) {
                console.warn('📢 system_info 테이블 조회 오류:', error);
                return false;
            }
            
            if (systemInfo && systemInfo.reset_timestamp) {
                const serverResetTime = new Date(systemInfo.reset_timestamp).getTime();
                const localResetTime = new Date(this.lastResetTimestamp).getTime();
                
                // 서버의 초기화 시간이 로컬보다 더 최신이면 로컬 스토리지 초기화
                if (serverResetTime > localResetTime) {
                    console.log('📢 서버의 초기화 시간이 로컬보다 더 최신임 - 로컬 스토리지 초기화');
                    this.lastResetTimestamp = systemInfo.reset_timestamp;
                    localStorage.setItem('lastResetTimestamp', systemInfo.reset_timestamp);
                    this.resetClientState();
                    return true;
                }
            }
        } catch (error) {
            console.error('📢 초기화 정보 확인 중 오류:', error);
        }
        
        console.log('📢 초기화 상태 확인 완료 - 초기화 필요 없음');
        return false;
    }
    
    // 실시간 업데이트 리스너 설정
    setupRealtimeListener() {
        // 서버에서 좌석 업데이트 이벤트 수신
        window.addEventListener('seatsUpdated', async (event) => {
            console.log('💬 좌석 업데이트 이벤트 수신:', event.detail);
            await this.loadSeatsFromSupabase();
        });
        
        // 좌석 초기화 이벤트 수신
        window.addEventListener('seatsReset', async (event) => {
            console.log('🔄 좌석 초기화 이벤트 수신', event.detail ? `(ID: ${event.detail.resetId})` : '');
            
            // 초기화 타임스태프 업데이트
            if (event.detail && event.detail.timestamp) {
                this.lastResetTimestamp = event.detail.timestamp;
                localStorage.setItem('lastResetTimestamp', event.detail.timestamp);
                console.log('🔄 초기화 타임스태프 업데이트:', this.lastResetTimestamp);
            }
            
            this.resetClientState();
            await this.loadSeatsFromSupabase();
        });
    }

    loadAndDisplayUserSeat() {
        this.updateSeatDisplay();
    }
    
    // 개발자용 초기화 기능
    setupDevTools() {
        // 전역 객체에 초기화 기능 추가
        window.resetSeatSystem = () => {
            return this.resetAllSeats();
        };
        
        // 관리자용 전체 초기화 기능 (서버 함수 호출)
        window.resetAllSeatsForEveryone = (adminPassword) => {
            return this.resetAllSeatsForEveryone(adminPassword);
        };
        
        // 개발자 안내 메시지
        console.info('💻 개발자 도구: ');
        console.info(' - 내 좌석 초기화: resetSeatSystem()');
        console.info(` - 모든 사용자 좌석 초기화(관리자): resetAllSeatsForEveryone("${this.adminPassword}")`);
    }
    
    // 클라이언트 상태 초기화 공통 함수
    resetClientState() {
        console.log('📢 클라이언트 상태 초기화 시작');
        
        // 로컬 스토리지 완전 초기화 - 사용자 ID는 유지
        const userId = localStorage.getItem('userId');
        localStorage.clear();
        if (userId) {
            localStorage.setItem('userId', userId);
        }
        
        // 초기화 타임스태프 저장 - 오프라인 기기 동기화를 위해
        const resetTimestamp = new Date().toISOString();
        localStorage.setItem('lastResetTimestamp', resetTimestamp);
        this.lastResetTimestamp = resetTimestamp;
        
        console.log('📢 로컬 스토리지 초기화 완료');
        
        // 메모리에서 할당된 좌석 초기화
        this.maleAssignments.clear();
        this.femaleAssignments.clear();
        
        // 화면 초기화
        this.selectedGender = null;
        this.userSeat = null;
        
        // 버튼 상태 초기화
        this.maleBtn.classList.remove('active');
        this.femaleBtn.classList.remove('active');
        
        // 좌석 표시 초기화
        this.resetSeatDisplay();
        this.seatNumberDisplay.textContent = '좌석을 선택해주세요';
        
        console.log('📢 클라이언트 상태 초기화 완료');
    }
    
    // 내 좌석만 초기화 기능
    async resetAllSeats() {
        try {
            // 남성 테이블에서 현재 사용자의 좌석 데이터 삭제
            const { error: maleError } = await supabase
                .from('male_seats')
                .delete()
                .eq('user_id', this.userId);
                
            // 여성 테이블에서 현재 사용자의 좌석 데이터 삭제
            const { error: femaleError } = await supabase
                .from('female_seats')
                .delete()
                .eq('user_id', this.userId);
                
            if (maleError) console.error('남성 좌석 삭제 오류:', maleError);
            if (femaleError) console.error('여성 좌석 삭제 오류:', femaleError);
            
            // 클라이언트 상태 초기화
            this.resetClientState();
            
            // 다시 좌석 데이터 로드
            await this.loadSeatsFromSupabase();
            
            console.log('🟢 성공: 내 좌석이 초기화되었습니다.');
            return true;
        } catch (error) {
            console.error('좌석 초기화 중 오류 발생:', error);
            alert('좌석 초기화 중 오류가 발생했습니다.');
            return false;
        }
    }
    
    // 모든 사용자의 좌석 초기화 기능 (관리자용)
    async resetAllSeatsForEveryone(adminPassword) {
        try {
            console.log('📢 모든 사용자의 좌석 초기화 시작');
            
            // 관리자 비밀번호 확인
            if (adminPassword !== this.adminPassword) {
                console.error('🔴 관리자 인증 실패: 비밀번호가 올바르지 않습니다.');
                throw new Error('관리자 인증 실패: 비밀번호가 올바르지 않습니다.');
            }
            
            // 서버에서 모든 좌석 삭제
            console.log('📢 Supabase에서 모든 좌석 데이터 삭제 중...');
            
            // 남성 테이블 삭제
            const { error: maleError } = await supabase
                .from('male_seats')
                .delete()
                .neq('seat_number', 0);
                
            // 여성 테이블 삭제
            const { error: femaleError } = await supabase
                .from('female_seats')
                .delete()
                .neq('seat_number', 0);
                
            if (maleError) {
                console.error('🔴 남성 테이블 삭제 오류:', maleError);
            }
            
            if (femaleError) {
                console.error('🔴 여성 테이블 삭제 오류:', femaleError);
            }
            
            console.log('🟢 Supabase 좌석 데이터 삭제 성공');
            
            // 클라이언트 상태 초기화
            this.resetClientState();
            
            // 다시 좌석 데이터 로드
            await this.loadSeatsFromSupabase();
            
            console.log('🟢 성공: 모든 사용자의 좌석이 초기화되었습니다.');
            
            // 실시간 업데이트를 위해 이벤트 발생 (로컬 이벤트)
            const resetEvent = new CustomEvent('seatsReset');
            window.dispatchEvent(resetEvent);
            
            // 모든 클라이언트에 좌석 초기화 메시지 브로드캐스트
            console.log('📢 모든 클라이언트에 초기화 메시지 브로드캐스트 시작');
            await this.broadcastResetEvent();
            
            // 새로고침을 위한 지연 추가
            setTimeout(() => {
                alert('모든 사용자의 좌석이 초기화되었습니다.');
                
                // 현재 페이지도 새로고침하여 완전히 초기화
                window.location.reload();
            }, 1000);
            
            return true;
        } catch (error) {
            console.error('전체 좌석 초기화 중 오류 발생:', error);
            alert(error.message || '전체 좌석 초기화 중 오류가 발생했습니다.');
            return false;
        }
    }
    
    // 브로드캐스트 이벤트 전송 함수
    async broadcastResetEvent() {
        if (typeof broadcastSeatsReset === 'function') {
            const broadcastResult = await broadcastSeatsReset();
            if (broadcastResult) {
                console.log('🔄 모든 클라이언트에 좌석 초기화 메시지 전송 성공');
            } else {
                console.warn('⚠️ 일부 클라이언트에 좌석 초기화 메시지가 전송되지 않았을 수 있습니다.');
            }
        } else {
            console.warn('⚠️ broadcastSeatsReset 함수를 찾을 수 없습니다. 실시간 업데이트가 일부 클라이언트에 전달되지 않을 수 있습니다.');
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new SeatAssignment();
});
