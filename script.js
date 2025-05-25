class SeatAssignment {
    constructor() {
        // 강의실 좌석 배치 설정
        this.totalRows = 9;  // 행 수
        this.totalCols = 4;   // 열 수
        this.seatElements = new Map();  // 좌석 요소 캐싱
        
        // 상태 관리
        this.state = {
            selectedGender: null,
            studentId: localStorage.getItem('studentId') || '',
            userId: this.generateOrGetUserId(),
            selectedSeat: null,
            maleAssignments: new Set(),
            femaleAssignments: new Set(),
            lastResetTimestamp: localStorage.getItem('lastResetTimestamp') || '0',
            userSeat: null,
            adminPassword: null,
            isLoadingSeats: false
        }

        // 초기화 및 설정
        this.initializeElements();
        this.initializeEventListeners();
        this.createSeatGrid();
        
        // 데이터 로드
        this.loadSeatsFromSupabase().then((data) => {
            this.checkResetStatus(data);
            this.loadAndDisplayUserSeat();
            
            // 저장된 학번 처리
            if (this.state.studentId) {
                this.studentIdInput.value = this.state.studentId;
                this.checkStudentIdAssignment();
            }
        });
        
        // 실시간 업데이트 설정
        this.setupRealtimeSubscription();
        
        // 개발자용 초기화 기능
        this.setupDevTools();
        
        // 주기적 상태 저장
        setInterval(() => this.saveToLocalStorage(), 30000);
        
        this.isLoadingSeats = false;
        
        // 초기화 시 로컬스토리지에서 데이터 불러오기
        this.loadFromLocalStorage();
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
        this.seatGrid = document.querySelector('.seat-grid');
        this.studentIdInput = document.getElementById('studentId');
    }

    initializeEventListeners() {
        this.maleBtn.addEventListener('click', () => this.selectGender('male'));
        this.femaleBtn.addEventListener('click', () => this.selectGender('female'));
        this.studentIdInput.addEventListener('input', (event) => this.handleStudentIdInput(event));
    }

    createSeatGrid() {
        // 좌석 그리드 초기화
        this.seatGrid.innerHTML = '';
        this.seatElements.clear(); // 캠싱된 요소 초기화
        
        // 행 우선으로 좌석 생성 (왼쪽에서 오른쪽으로, 위에서 아래로)
        let seatNumber = 1;
        const spacerText = ['띄', '어', '앉', '기']; // 띄워앉기 글자 분리
        
        for (let i = 0; i < this.totalRows; i++) {
            // 일반 좌석 행 생성
            for (let j = 0; j < this.totalCols; j++) {
                const seat = document.createElement('div');
                seat.className = 'seat';
                seat.textContent = seatNumber;
                
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
                this.seatElements.set(seatNumber, seat);
                seatNumber++;
            }
            
            // 마지막 행이 아닐 때만 띄워앉기 행 추가
            if (i < this.totalRows - 1) {
                for (let j = 0; j < this.totalCols; j++) {
                    const spacer = document.createElement('div');
                    spacer.className = 'seat spacer';
                    spacer.textContent = spacerText[j]; // 각 칸에 띄,어,앉,기 배치
                    this.seatGrid.appendChild(spacer);
                }
            }
        }
    }

    selectGender(gender) {
        // 학번 입력 확인
        if (!this.studentId) {
            alert('학번을 입력해주세요.');
            this.seatNumberDisplay.textContent = '학번을 먼저 입력해주세요.';
            this.seatNumberDisplay.style.color = '#ff0000';
            return;
        }
        
        // 학번이 8자리인지 확인
        if (this.studentId.length !== 8) {
            alert('학번은 8자리로 입력해주세요.');
            this.seatNumberDisplay.textContent = '학번은 8자리로 입력해주세요.';
            this.seatNumberDisplay.style.color = '#ff0000';
            return;
        }
        
        // 이미 할당된 좌석이 있는지 확인
        this.checkStudentIdAssignment().then(hasAssignment => {
            // 이미 할당된 좌석이 없는 경우에만 계속 진행
            if (!hasAssignment) {
                this.selectedGender = gender;
                
                // 버튼 상태 업데이트
                this.maleBtn.classList.toggle('active', gender === 'male');
                this.femaleBtn.classList.toggle('active', gender === 'female');
                
                // 선택 상태에 따라 안내 메시지 업데이트
                if (gender === 'male') {
                    this.seatNumberDisplay.textContent = '남성을 선택했습니다. 좌석을 배정하는 중...';
                    this.seatNumberDisplay.style.color = 'var(--male-color-dark)';
                } else if (gender === 'female') {
                    this.seatNumberDisplay.textContent = '여성을 선택했습니다. 좌석을 배정하는 중...';
                    this.seatNumberDisplay.style.color = 'var(--female-color-dark)';
                }
                
                // 애니메이션 효과 추가
                this.animateSelection(gender);
                
                // 성별 선택 후 바로 좌석 할당 시작
                setTimeout(() => {
                    this.assignSeat();
                }, 500); // 0.5초 뒤에 좌석 할당 시작 (애니메이션 효과 후)
            }
        });
    }
    
    // 선택 애니메이션 효과 - CSS 클래스 기반으로 변경
    animateSelection(gender) {
        const button = gender === 'male' ? this.maleBtn : this.femaleBtn;
        
        const handleAnimationEnd = () => {
            button.classList.remove('pulse-animation');
            button.removeEventListener('animationend', handleAnimationEnd);
        }
        button.addEventListener('animationend', handleAnimationEnd);
        button.classList.add('pulse-animation');
    }
    
    // 좌석 애니메이션 효과 - 캠싱된 요소 활용 최적화 버전
    animateSeat(seatNumber) {
        // 캠싱된 좌석 요소 사용 (성능 최적화)
        const seatElement = this.seatElements.get(seatNumber);
        
        if (seatElement) {
            // CSS 클래스를 사용한 애니메이션 추가
            seatElement.classList.add('pulse-animation');
            
            // 애니메이션 완료 후 클래스 제거
            setTimeout(() => {
                seatElement.classList.remove('pulse-animation');
            }, 500);
        }
    }

    async getNextAvailableSeat(gender) {
        try {
            // PostgreSQL 함수를 호출하여 사용 가능한 좌석 찾기 (순차적 할당 방식)
            if (window.supabaseUtils && window.supabaseUtils.findAvailableSeat) {
                console.log(`PostgreSQL 함수를 통해 사용 가능한 좌석 찾기 시도 (${gender})`);
                const seatNumber = await window.supabaseUtils.findAvailableSeat(gender);
                
                if (seatNumber) {
                    console.log(`PostgreSQL 함수로 찾은 다음 사용 가능한 좌석: ${seatNumber}`);
                    return seatNumber;
                }
                console.log('PostgreSQL 함수로 사용 가능한 좌석을 찾지 못함, 기본 방식으로 전환');
            } else {
                console.log('순차적 좌석 할당을 위한 findAvailableSeat 함수를 찾을 수 없습니다. 기본 방식으로 전환합니다.');
            }
            
            // 기본 방식: Supabase 쿼리 사용
            console.log(`기본 방식으로 사용 가능한 좌석 찾기 시도 (${gender})`);
            const tableName = gender === 'male' ? 'male_seats' : 'female_seats';
            
            // Supabase에서 현재 할당된 좌석 목록 가져오기
            const { data: assignedSeats, error } = await supabase
                .from(tableName)
                .select('seat_number');
                
            if (error) {
                console.error('할당된 좌석 조회 오류:', error);
                // 오류 발생 시 로컬 데이터 사용
                const assignments = gender === 'male' ? this.maleAssignments : this.femaleAssignments;
                
                // 1부터 총 좌석 수까지 확인
                const totalSeats = this.totalRows * this.totalCols;
                for (let i = 1; i <= totalSeats; i++) {
                    // 이미 할당된 좌석이 아니면 반환
                    if (!assignments.has(i)) {
                        console.log(`로컬 데이터로 찾은 다음 사용 가능한 좌석: ${i}`);
                        return i;
                    }
                }
            } else {
                // 할당된 좌석 번호 집합 생성
                const assignedSeatNumbers = new Set(assignedSeats.map(seat => seat.seat_number));
                console.log(`현재 할당된 좌석: ${[...assignedSeatNumbers].join(', ')}`);
                
                // 1부터 총 좌석 수까지 확인
                const totalSeats = this.totalRows * this.totalCols;
                for (let i = 1; i <= totalSeats; i++) {
                    // 이미 할당된 좌석이 아니면 반환
                    if (!assignedSeatNumbers.has(i)) {
                        console.log(`Supabase 쿼리로 찾은 다음 사용 가능한 좌석: ${i}`);
                        return i;
                    }
                }
            }
            
            // 모든 좌석이 할당된 경우
            console.log('사용 가능한 좌석이 없습니다.');
            return null;
        } catch (error) {
            console.error('다음 가능한 좌석 찾기 오류:', error);
            return null;
        }
    }

    // 좌석 할당 기능 - 동시성 문제 방지 개선
    async assignSeat() {
        try {
            // 유효성 검사
            const validation = await this.validateSeatAssignment(null, this.selectedGender);
            if (!validation.isValid) {
                alert(validation.message);
                return;
            }

            // 다음 가능한 좌석 가져오기
            const seatNumber = await this.getNextAvailableSeat(this.selectedGender);
            
            if (!seatNumber) {
                alert('사용 가능한 좌석이 없습니다.');
                return;
            }
            
            console.log('📍 좌석 할당 시도:', { 
                seatNumber, 
                gender: this.selectedGender, 
                userId: this.state.userId, 
                studentId: this.state.studentId 
            });
            
            // PostgreSQL 함수를 통한 좌석 할당 (동시성 문제 방지)
            const result = await this.saveSeatToSupabase(seatNumber);
            
            if (result && result.success) {
                // 성공적으로 저장되면 로컬 상태 업데이트
                this.updateLocalSeatAssignment(seatNumber);
                
                console.log(`✅ 좌석 ${seatNumber}번이 성공적으로 할당되었습니다.`);
                alert(`좌석 ${seatNumber}번이 성공적으로 할당되었습니다.`);
                
                // 성별 선택 버튼 상태 초기화
                this.maleBtn.classList.remove('active');
                this.femaleBtn.classList.remove('active');
                this.seatNumberDisplay.style.color = this.selectedGender === 'male' ? 'var(--male-color-dark)' : 'var(--female-color-dark)';
                this.seatNumberDisplay.textContent = `${seatNumber}번 좌석이 배정되었습니다.`;
                
                // 성공 시에만 성별 선택 초기화
                this.state.selectedGender = null;
                    
                    // 학번 저장
                    localStorage.setItem('studentId', this.state.studentId);
                    
                    // 성공적인 좌석 할당 후 상태 업데이트
                    this.updateSeatDisplay();
                    return { success: true };
                } else {
                    throw new Error('좌석 할당에 실패했습니다. 다시 시도해주세요.');
                }
            } catch (error) {
                console.error('좌석 할당 중 내부 오류:', error);
                throw error;
            }
        } catch (error) {
            console.error('좌석 할당 중 오류 발생:', error);
            
            // 오류 메시지 표시 및 재시도 로직
            if (error.message.includes('이미 다른 사용자가 선택한 좌석') || 
                error.message.includes('현재 다른 사용자가 선택 중')) {
                
                const retry = confirm(`${error.message}\n\n다른 좌석을 자동으로 배정할까요?`);
                if (retry) {
                    setTimeout(() => {
                        this.assignSeat();
                    }, 500);
                }
            } else {
                alert(`좌석 할당 중 오류가 발생했습니다: ${error.message}`);
            }
            return { success: false, error: error.message };
        }
    }
    
    // 좌석 할당 유효성 검사
    async validateSeatAssignment(seatNumber, gender) {
        try {
            // 학번 유효성 검사
            if (!this.state.studentId || this.state.studentId.length !== 8) {
                return {
                    isValid: false,
                    message: '유효한 학번을 입력해주세요 (8자리).',
                }
            }

            // 성별 선택 여부 검사
            if (!gender) {
                return {
                    isValid: false,
                    message: '성별을 선택해주세요.',
                }
            }

            // 남자 테이블 확인
            const { data: maleData, error: maleError } = await supabase
                .from('male_seats')
                .select('seat_number')
                .eq('student_id', this.state.studentId);

            if (maleError) {
                console.error('남자 좌석 확인 오류:', maleError);
                return {
                    isValid: false,
                    message: '서버 오류가 발생했습니다.',
                }
            }

            // 여자 테이블 확인
            const { data: femaleData, error: femaleError } = await supabase
                .from('female_seats')
                .select('seat_number')
                .eq('student_id', this.state.studentId);

            if (femaleError) {
                console.error('여자 좌석 확인 오류:', femaleError);
                return {
                    isValid: false,
                    message: '서버 오류가 발생했습니다.'
                }
            }

            // 이미 할당된 좌석이 있는 경우
            if (maleData && maleData.length > 0) {
                const existingSeat = maleData[0].seat_number;
                this.showAssignedSeat(existingSeat, 'male');
                return {
                    isValid: false,
                    message: `이미 ${existingSeat}번 좌석이 할당되어 있습니다.`
                }
            }

            if (femaleData && femaleData.length > 0) {
                const existingSeat = femaleData[0].seat_number;
                this.showAssignedSeat(existingSeat, 'female');
                return {
                    isValid: false,
                    message: `이미 ${existingSeat}번 좌석이 할당되어 있습니다.`
                }
            }

            // 모든 검사 통과
            return {
                isValid: true,
                message: ''
            }

        } catch (error) {
            console.error('학번 좌석 확인 중 오류:', error);
            return {
                isValid: false,
                message: '서버 오류가 발생했습니다.',
            }
        }
    }
    
    // 로컬 좌석 할당 정보 업데이트
    updateLocalSeatAssignment(seatNumber) {
        const assignments = this.selectedGender === 'male' ? this.maleAssignments : this.femaleAssignments;
        assignments.add(seatNumber);

        this.userSeat = { number: seatNumber, gender: this.selectedGender, userId: this.userId };
        this.saveUserSeat();
        this.updateSeatDisplay();
    }
    
    // Supabase에 좌석 할당 정보 저장 - PostgreSQL 함수를 사용한 경쟁 상태(race condition) 방지
    async saveSeatToSupabase(seatNumber) {
        try {
            if (!seatNumber) {
                alert('사용 가능한 좌석이 없습니다.');
                return;
            }

            const result = await window.supabaseUtils.reserveSeat(
                seatNumber,
                this.state.studentId,
                this.selectedGender
            );

            if (!result.success) {
                throw new Error(result.message);
            }

            return result;
        } catch (error) {
            console.error('좌석 저장 중 오류:', error);
            throw error;
        }
    }
    
    // 이미 할당된 좌석 표시
    showAssignedSeat(seatNumber, gender) {
        // 버튼 비활성화
        this.maleBtn.disabled = true;
        this.femaleBtn.disabled = true;
        
        // 좌석 정보 표시
        this.seatNumberDisplay.textContent = `${seatNumber}번 좌석이 이미 배정되어 있습니다.`;
        this.seatNumberDisplay.style.color = gender === 'male' ? 'var(--male-color-dark)' : 'var(--female-color-dark)';
    }
        
        // 좌석 강조 표시
        this.highlightAssignedSeat(seatNumber, gender);
        
        // 로컬 스토리지에 저장
        const userSeatInfo = {
            number: seatNumber,
            gender: gender,
            studentId: this.studentId,
            timestamp: new Date().toISOString()
        }
        
        localStorage.setItem('userSeat', JSON.stringify(userSeatInfo));
        this.userSeat = userSeatInfo;
    }
    
    // 할당된 좌석 강조 표시
    highlightAssignedSeat(seatNumber, gender) {
        // 모든 좌석 초기화
        for (let i = 1; i <= this.totalRows * this.totalCols; i++) {
            const seat = this.seatElements.get(i);
            if (seat) {
                seat.classList.remove('male', 'female', 'mixed', 'pulse-animation');
            }
        }
        
        // 할당된 좌석 강조
        const seat = this.seatElements.get(parseInt(seatNumber));
        if (seat) {
            seat.classList.add(gender);
            seat.classList.add('pulse-animation');
            
            // 스크롤하여 좌석 보이게 하기
            setTimeout(() => {
                seat.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 500);
        }
    }

    loadUserSeat() {
        const savedSeat = localStorage.getItem('userSeat');
        return savedSeat ? JSON.parse(savedSeat) : null;
    }
    
    // Supabase에서 좌석 데이터 로드 (캠싱 요소 활용 최적화 버전)
    async loadSeatsFromSupabase() {
        if (this.isLoadingSeats) return []; // 이미 로딩 중이면 무시
        
        this.isLoadingSeats = true;
        try {
            console.log('💾 Supabase에서 좌석 데이터 불러오기 시작');
            
            // 남자 좌석 데이터 가져오기
            const { data: maleSeats, error: maleError } = await supabase
                .from('male_seats')
                .select('*');
                
            if (maleError) {
                console.error('남자 좌석 데이터 불러오기 오류:', maleError);
                return [];
            }
            
            // 여자 좌석 데이터 가져오기
            const { data: femaleSeats, error: femaleError } = await supabase
                .from('female_seats')
                .select('*');
                
            if (femaleError) {
                console.error('여자 좌석 데이터 불러오기 오류:', femaleError);
                return [];
            }
            
            // 좌석 정보 처리
            this.maleAssignments = new Set(maleSeats.map(seat => seat.seat_number));
            this.femaleAssignments = new Set(femaleSeats.map(seat => seat.seat_number));
            
            // 내 좌석 확인
            const myMaleSeat = maleSeats.find(seat => seat.student_id === this.state.studentId);
            const myFemaleSeat = femaleSeats.find(seat => seat.student_id === this.state.studentId);
                }
            });
            
            // 좌석 표시 업데이트 - 캠싱된 요소 사용
            this.updateSeatDisplay();
            
            // 남성과 여성 데이터 합치기 (반환용)
            const combinedData = [
                ...(maleData || []).map(seat => ({ ...seat, gender: 'male' })),
                ...(femaleData || []).map(seat => ({ ...seat, gender: 'female' }))
            ];
            
            return combinedData;
        } catch (error) {
            console.error('좌석 데이터 로드 중 오류 발생:', error);
            return [];
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
    
    // 관리자 비밀번호를 Supabase에서 안전하게 로드하는 함수
    async loadAdminPassword() {
        try {
            // system_info 테이블에서 관리자 비밀번호 가져오기
            const { data, error } = await supabase
                .from('system_info')
                .select('admin_password')
                .eq('id', 1)
                .single();
                
            if (error) {
                console.error('관리자 비밀번호 로드 오류:', error);
                // 오류 발생 시 기본 비밀번호 사용 (개발 환경용)
                this.adminPassword = 'love1030';
            } else if (data && data.admin_password) {
                this.adminPassword = data.admin_password;
            } else {
                // 데이터가 없는 경우 기본 비밀번호 사용 (개발 환경용)
                this.adminPassword = 'love1030';
            }
        } catch (error) {
            console.error('관리자 비밀번호 로드 중 오류:', error);
            // 오류 발생 시 기본 비밀번호 사용 (개발 환경용)
            this.adminPassword = 'love1030';
        }
    }
    
    // 개발자용 초기화 기능
    setupDevTools() {
        // 전역 객체에 초기화 기능 추가
        window.resetSeatSystem = () => {
            return this.resetAllSeats();
        }
        
        // 관리자용 전체 초기화 기능 (서버 함수 호출)
        window.resetAllSeatsForEveryone = (adminPassword) => {
            return this.resetAllSeatsForEveryone(adminPassword);
        }
        
        // 개발자 안내 메시지
        console.info('💻 개발자 도구: ');
        console.info('    // 좌석 상태 초기화');
        console.info('    resetSeatSystem() {');
        console.info(' - 모든 사용자 좌석 초기화(관리자): resetAllSeatsForEveryone("[admin password]")');  // 비밀번호 노출 방지
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
