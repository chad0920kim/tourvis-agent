// dashboard.js - 투어비스 통합 대시보드 JavaScript (실제 API 전용) - mrk1

// 설정 - Goorm 공개 도메인 사용
const API_BASE_URL = window.location.hostname === 'chad0920kim.github.io' 
    ? 'https://cxdashboard.run.goorm.site'  // Goorm 공개 도메인
    : 'http://localhost:8505';  // 로컬에서는 HTTP 사용

console.log(`🔗 Dashboard API URL (Goorm): ${API_BASE_URL}`);

let trendChart, avgChart, matchStatusChart, qaTimeChart;
let currentFeedbackFilter = 'all';
let allFeedbackData = [];

// 연결 상태 업데이트 함수
function updateConnectionStatus(isConnected, message = '') {
    const statusElement = document.getElementById('connectionStatus');
    const textElement = document.getElementById('connectionText');

    if (isConnected) {
        statusElement.className = 'connection-status connected';
        textElement.textContent = message || 'API 연결됨';
    } else {
        statusElement.className = 'connection-status disconnected';
        textElement.textContent = message || 'API 연결 실패';
    }
}

// API 연결 테스트 (여러 엔드포인트 시도)
async function testApiConnection() {
    const healthEndpoints = [
        '/health',
        '/api/health', 
        '/status',
        '/ping',
        '/'
    ];
    
    console.log('🔍 API 연결 테스트 중...');
    updateConnectionStatus(false, 'API 연결 확인 중...');

    for (const endpoint of healthEndpoints) {
        try {
            console.log(`시도 중: ${API_BASE_URL}${endpoint}`);
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'GET',
                signal: AbortSignal.timeout(3000)
            });

            if (response.ok) {
                const contentType = response.headers.get('content-type');
                let data = {};
                
                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    data = { service: 'Server', status: 'ok' };
                }
                
                console.log(`✅ API 연결 성공 (${endpoint}):`, data);
                updateConnectionStatus(true, `API 연결됨 (${data.service || 'Server'})`);
                return true;
            }
        } catch (error) {
            console.log(`❌ ${endpoint} 실패:`, error.message);
        }
    }

    // 모든 엔드포인트 실패 시
    console.error('❌ 모든 API 엔드포인트 연결 실패');
    updateConnectionStatus(false, 'API 서버 미응답 (데모 모드)');
    
    // 데모 모드로 계속 진행
    return false;
}

// 탭 전환 함수
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });

    document.getElementById(tabName + 'Content').classList.add('active');
    document.getElementById(tabName + 'Tab').classList.add('active');

    if (tabName === 'feedback') {
        refreshData();
    } else if (tabName === 'conversations') {
        refreshConversationData();
    }
}

// 통계 데이터 (개선된 오류 처리)
async function fetchStats(days = 7) {
    const statsEndpoints = [
        `/api/stats?days=${days}`,
        `/stats?days=${days}`,
        `/admin/stats?days=${days}`
    ];

    for (const endpoint of statsEndpoints) {
        try {
            console.log(`📊 통계 데이터 요청: ${API_BASE_URL}${endpoint}`);
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(10000)
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ 통계 데이터 수신:', data);
                return data;
            } else if (response.status !== 404) {
                console.warn(`⚠️ ${endpoint} 응답 오류: ${response.status}`);
            }
        } catch (error) {
            if (!error.message.includes('404')) {
                console.warn(`⚠️ ${endpoint} 요청 실패:`, error.message);
            }
        }
    }

    console.log('📊 API 연결 실패 - 빈 데이터 반환');
    return {
        total_feedback: 0,
        positive: 0,
        negative: 0,
        satisfaction_rate: 0,
        unique_users: 0
    };
}

// 피드백 데이터 (개선된 오류 처리)
async function fetchFeedback(limit = 50, feedback_type = 'all') {
    const feedbackEndpoints = [
        `/api/feedback?limit=${limit}&feedback_type=${feedback_type}`,
        `/admin/feedback?limit=${limit}&feedback_type=${feedback_type}`,
        `/feedback?limit=${limit}&feedback_type=${feedback_type}`
    ];

    for (const endpoint of feedbackEndpoints) {
        try {
            console.log(`📝 피드백 데이터 요청: ${API_BASE_URL}${endpoint}`);
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(10000)
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ 피드백 데이터 수신:', data);
                return data;
            } else if (response.status !== 404) {
                console.warn(`⚠️ ${endpoint} 응답 오류: ${response.status}`);
            }
        } catch (error) {
            if (!error.message.includes('404')) {
                console.warn(`⚠️ ${endpoint} 요청 실패:`, error.message);
            }
        }
    }

    console.log('📝 API 연결 실패 - 빈 데이터 반환');
    return {
        feedback: [],
        total: 0
    };
}

// 피드백과 Q&A 데이터 연결 함수
function enrichFeedbackWithQA(feedbackData, qaData) {
    console.log('🔍 피드백-Q&A 연결 시작');
    console.log('📝 피드백 데이터 수:', feedbackData.length);
    console.log('💬 Q&A 데이터 수:', qaData.length);
    
    // String similarity calculation function (simple Levenshtein distance based)
    function similarity(str1, str2) {
        if (!str1 || !str2) return 0;
        
        // Normalize: remove spaces, special characters, convert to lowercase
        const normalize = (s) => s.replace(/[\s\W]/g, '').toLowerCase();
        const s1 = normalize(str1);
        const s2 = normalize(str2);
        
        if (s1 === s2) return 1.0;
        if (s1.length === 0 || s2.length === 0) return 0;
        
        // Check inclusion relationship
        if (s1.includes(s2) || s2.includes(s1)) {
            return Math.max(s2.length / s1.length, s1.length / s2.length) * 0.8;
        }
        
        // Simple edit distance calculation
        const matrix = [];
        for (let i = 0; i <= s2.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= s1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= s2.length; i++) {
            for (let j = 1; j <= s1.length; j++) {
                if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        const distance = matrix[s2.length][s1.length];
        const maxLength = Math.max(s1.length, s2.length);
        return 1 - (distance / maxLength);
    }
    
    return feedbackData.map((feedback, index) => {
        const chatId = feedback.feedback || feedback.chat_id;
        console.log(`\n🔍 피드백 #${index} 처리 중, Chat ID: ${chatId}`);
        
        const relatedQAs = qaData.filter(qa => qa.chat_id === chatId);
        console.log(`💬 관련 Q&A 개수: ${relatedQAs.length}`);
        
        if (relatedQAs.length > 0) {
            let bestMatch = null;
            let bestScore = 0;
            
            // If feedback has original question, match with that
            if (feedback.question && feedback.question.trim()) {
                console.log(`📝 피드백 질문: "${feedback.question}"`);
                
                relatedQAs.forEach(qa => {
                    const score = similarity(feedback.question, qa.question);
                    console.log(`💬 Q&A 질문: "${qa.question?.substring(0, 30)}..." - 유사도: ${score.toFixed(3)}`);
                    
                    if (score > bestScore && score > 0.7) { // Only when similarity > 70%
                        bestScore = score;
                        bestMatch = qa;
                    }
                });
                
                if (bestMatch) {
                    console.log(`✅ 질문 매칭 성공! 유사도: ${bestScore.toFixed(3)}`);
                    console.log(`   선택된 Q&A: ${bestMatch.question?.substring(0, 50)}...`);
                    
                    return {
                        ...feedback,
                        question: bestMatch.question,
                        answer: bestMatch.answer,
                        qa_id: bestMatch.id,
                        match_status: bestMatch.match_status,
                        hasQAData: true,
                        qaCount: relatedQAs.length,
                        matchScore: bestScore
                    };
                }
            }
            
            // If question matching fails, use most recent QA (existing logic)
            console.log(`📝 질문 매칭 실패, 최근 Q&A 사용`);
            const latestQA = relatedQAs.sort((a, b) => {
                return new Date(b.timestamp) - new Date(a.timestamp);
            })[0];
            
            return {
                ...feedback,
                question: latestQA.question,
                answer: latestQA.answer,
                qa_id: latestQA.id,
                match_status: latestQA.match_status,
                hasQAData: true,
                qaCount: relatedQAs.length,
                matchScore: 0
            };
        }
        
        console.log(`❌ Chat ID 매칭 실패`);
        return {
            ...feedback,
            question: feedback.question || '',
            answer: feedback.answer || '',
            hasQAData: false,
            qaCount: 0,
            matchScore: 0
        };
    });
}

// Q&A 데이터 로드 및 저장
let globalQAData = [];

async function loadQAData() {
    try {
        const data = await fetchConversations(30, 1000); // 최근 30일, 최대 1000개
        globalQAData = data.conversations || [];
        console.log(`✅ Q&A 데이터 로드 완료: ${globalQAData.length}개`);
        return globalQAData;
    } catch (error) {
        console.warn('⚠️ Q&A 데이터 로드 실패:', error);
        globalQAData = [];
        return [];
    }
}
async function fetchConversations(days = 7, limit = 50) {
    const qaEndpoints = [
        `/api/qa/conversations?days=${days}&limit=${limit}`,
        `/qa/conversations?days=${days}&limit=${limit}`,
        `/conversations?days=${days}&limit=${limit}`
    ];

    for (const endpoint of qaEndpoints) {
        try {
            console.log(`💬 Q&A 데이터 요청: ${API_BASE_URL}${endpoint}`);
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(10000)
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Q&A 데이터 수신:', data);
                return data;
            } else if (response.status !== 404) {
                console.warn(`⚠️ ${endpoint} 응답 오류: ${response.status}`);
            }
        } catch (error) {
            if (!error.message.includes('404')) {
                console.warn(`⚠️ ${endpoint} 요청 실패:`, error.message);
            }
        }
    }

    console.log(`💬 Q&A API 연결 실패 - 데모 데이터 사용`);
    return {
        conversations: [],
        total: 0,
        stats: {
            total_conversations: 0,
            unique_sessions: 0,
            match_distribution: {
                good: 0,
                bad: 0,
                improve: 0,
                none: 0
            }
        }
    };
}

// 새로고침
async function refreshData() {
    const days = parseInt(document.getElementById('daysSelect').value);
    try {
        document.getElementById('feedbackList').innerHTML = '<div class="loading">피드백 데이터를 불러오는 중...</div>';
        const stats = await fetchStats(days);
        updateStatsDisplay(stats);
        updateCharts(stats, days);
        await loadFeedback(currentFeedbackFilter);
    } catch (error) {
        console.error('데이터 새로고침 실패:', error);
        showError('데이터를 불러오는 중 오류가 발생했습니다.');
    }
}

async function refreshConversationData() {
    const days = parseInt(document.getElementById('conversationDaysSelect').value);
    const data = await fetchConversations(days, 100);
    updateConversationStats(data);
    updateConversationCharts(data);
}

// 통계 UI 업데이트
function updateStatsDisplay(stats) {
    document.getElementById('totalFeedback').textContent = stats.total_feedback || 0;
    document.getElementById('positiveFeedback').textContent = stats.positive || 0;
    document.getElementById('negativeFeedback').textContent = stats.negative || 0;
    document.getElementById('uniqueUsers').textContent = stats.unique_users || 0;
    document.getElementById('satisfactionRate').textContent = (stats.satisfaction_rate || 0) + '%';
    
    // 🔧 사용자 참여도 계산 및 표시
    const participationRate = stats.unique_users > 0 
        ? (stats.total_feedback / stats.unique_users).toFixed(2)
        : '0.00';
    
    // 사용자 참여도 표시 업데이트
    const participationElement = document.getElementById('participationRate');
    if (participationElement) {
        participationElement.textContent = participationRate + '회';
    }
}

function updateConversationStats(data) {
    const stats = data.stats || {};
    document.getElementById('totalConversations').textContent = stats.total_conversations || 0;
    document.getElementById('totalSessions').textContent = stats.unique_sessions || 0;
    document.getElementById('matchGood').textContent = stats.match_distribution.good || 0;
    document.getElementById('matchBad').textContent = stats.match_distribution.bad || 0;
    document.getElementById('matchImprove').textContent = stats.match_distribution.improve || 0;
}

// 차트 업데이트
function updateCharts(stats, days) {
    // 기존 차트 파괴
    if (trendChart) trendChart.destroy();
    if (avgChart) avgChart.destroy();

    // 시간별 피드백 추이 차트
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    const trendLabels = generateTimeLabels(days);
    const trendData = generateTrendData(stats, days);

    trendChart = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: trendLabels,
            datasets: [{
                label: '👍 도움됨',
                data: trendData.positive,
                borderColor: '#28a745',
                backgroundColor: 'rgba(40, 167, 69, 0.1)',
                tension: 0.4,
                fill: true
            }, {
                label: '👎 아쉬움',
                data: trendData.negative,
                borderColor: '#dc3545',
                backgroundColor: 'rgba(220, 53, 69, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });

    // 피드백 분포 차트
    const avgCtx = document.getElementById('avgChart').getContext('2d');
    avgChart = new Chart(avgCtx, {
        type: 'doughnut',
        data: {
            labels: ['👍 도움됨', '👎 아쉬움'],
            datasets: [{
                data: [stats.positive || 0, stats.negative || 0],
                backgroundColor: ['#28a745', '#dc3545'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                }
            }
        }
    });
}

function updateConversationCharts(data) {
    const conversations = data.conversations || [];
    
    // 매치 상태 차트
    if (matchStatusChart) matchStatusChart.destroy();
    
    const matchCtx = document.getElementById('matchStatusChart').getContext('2d');
    let matchGood = 0, matchBad = 0, matchImprove = 0, noMatch = 0;
    
    conversations.forEach(conv => {
        const status = conv.match_status;
        if (status === 1.0) matchGood++;
        else if (status === 0.0) matchBad++;
        else if (status === 0.5) matchImprove++;
        else noMatch++;
    });
    
    matchStatusChart = new Chart(matchCtx, {
        type: 'pie',
        data: {
            labels: ['매치⭕️', '매치✖️', '보강➡️', '미평가'],
            datasets: [{
                data: [matchGood, matchBad, matchImprove, noMatch],
                backgroundColor: ['#28a745', '#dc3545', '#ffc107', '#6c757d'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                }
            }
        }
    });

    // Q&A 시간 추이 차트
    if (qaTimeChart) qaTimeChart.destroy();
    
    const timeCtx = document.getElementById('qaTimeChart').getContext('2d');
    qaTimeChart = new Chart(timeCtx, {
        type: 'bar',
        data: {
            labels: ['월', '화', '수', '목', '금', '토', '일'],
            datasets: [{
                label: 'Q&A 수',
                data: [0, 0, 0, 0, 0, 0, 0],
                backgroundColor: '#17a2b8',
                borderColor: '#138496',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// 시간 라벨 생성
function generateTimeLabels(days) {
    const labels = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        
        if (days <= 7) {
            labels.push(date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }));
        } else {
            labels.push(date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }));
        }
    }
    
    return labels;
}

// 추이 데이터 생성
function generateTrendData(stats, days) {
    const positive = [];
    const negative = [];
    
    const avgPositive = Math.floor((stats.positive || 0) / days);
    const avgNegative = Math.floor((stats.negative || 0) / days);
    
    for (let i = 0; i < days; i++) {
        positive.push(avgPositive);
        negative.push(avgNegative);
    }
    
    return { positive, negative };
}

// 데모 데이터 생성 함수들
function generateDemoStats(days) {
    const total = Math.floor(Math.random() * 50) + 20; // 20-70개
    const positive = Math.floor(total * (0.6 + Math.random() * 0.3)); // 60-90%
    const negative = total - positive;
    
    return {
        total_feedback: total,
        positive: positive,
        negative: negative,
        satisfaction_rate: Math.round((positive / total) * 100),
        unique_users: Math.floor(total * (0.7 + Math.random() * 0.2)) // 70-90%
    };
} 대한 구체적인 정보는 제공되지 않았습니다. 일반적으로 체크카드는 신용카드와 달리 즉시 결제가 이루어지며, 무이자 할부 혜택은 적용되지 않을 수 있습니다.",
        "예약 확인에 대한 문제를 해결하기 위해 PC/모바일 예약 확인을 통해 투어비스 웹사이트나 모바일 앱에서 로그인 후 예약 내역을 확인할 수 있습니다.",
        "항공권 결제 영수증과 취소 규정 영수증에 대한 정보를 안내드립니다. 항공권 결제 후 카드 영수증을 받을 수 있는 방법과 취소 수수료 및 환불 규정을 확인하실 수 있습니다.",
        "항공권 취소 수수료는 항공사, 예약 클래스, 출발일에 따라 다르게 적용될 수 있습니다. 정확한 취소 수수료를 확인하려면 투어비스 고객센터에 문의하시기 바랍니다.",
        "이름의 띄어쓰기가 되지 않는 문제는 주로 예약 시 입력한 이름과 관련이 있을 수 있습니다. 항공권 예약 시 이름은 여권에 기재된 대로 입력해야 합니다.",
        "바우처 발행 여부를 확인하기 위해서는 예약 내역을 확인해야 합니다. 이메일 확인이나 투어비스 웹사이트 또는 앱에서 예약 내역을 확인할 수 있습니다.",
        "만 2세 미만의 유아가 좌석을 사용하기 위해 소아 요금을 지불하려고 할 때 결제가 되지 않는 문제는 여러 가지 이유로 발생할 수 있습니다.",
        "결제 내역을 확인하기 위해 이메일 확인, 투어비스 웹사이트 또는 앱 로그인, 카드사 확인, 고객센터 문의 등의 방법을 시도해 보세요.",
        "항공사 마일리지 적립에 대한 정보는 마일리지 적립 방법과 적립 기준에 대해 확인하실 수 있습니다.",
        "현재 항공권 인보이스 출력에 대한 구체적인 정보를 찾을 수 없습니다. 항공권 예약 확인 방법이나 결제 내역 조회를 통해 확인하실 수 있습니다.",
        "여권 정보가 틀렸을 경우, 항공권의 탑승객 영문 이름과 여권의 영문 이름이 반드시 일치해야 합니다. 일치하지 않을 경우 탑승이나 입국이 거절될 수 있습니다.",
        "호텔의 레이트 체크아웃 가능 여부는 각 호텔의 정책에 따라 다를 수 있습니다. 일반적으로 호텔의 객실 상황에 따라 가능할 수도 있으며, 추가 요금이 부과될 수 있습니다.",
        "호텔 체크인에 대한 정보를 찾고 계신 것 같네요. 대부분의 호텔은 오후 2시에서 3시 사이에 체크인을 시작합니다.",
        "전자항공권(e-티켓)을 출력하는 방법은 홈페이지 예약 시와 유선상 예약 시에 따라 다릅니다. 투어비스 홈페이지에서 '내 여행 > 예약조회 > E-Ticket 확인'에서 출력할 수 있습니다.",
        "발권대행 수수료는 항공권 예약, 상담, 발권대행 업무에 대한 수수료입니다. 항공권 결제 시 발권대행 수수료는 요금 규정에서 확인하실 수 있습니다.",
        "항공권 결제 및 발권 당일에 취소할 경우, 수수료 부과 여부에 대한 정보를 확인하실 수 있습니다.",
        "투어비스 회원탈퇴 방법에 대한 정보를 안내해드립니다. 회원탈퇴 절차와 관련된 자세한 안내를 받으실 수 있습니다.",
        "예약에 관련된 질문이신 것 같은데, 항공권 예약, 호텔 예약, 투어&티켓 예약, 패키지 상품 예약 등 다양한 예약 방법이 있습니다.",
        "환불과 관련된 정보를 제공하기 위해, 어떤 상품에 대한 환불인지 구체적으로 말씀해 주시면 해당 정보를 안내해 드리겠습니다.",
        "항공권의 이름 변경에 대한 정보는 발권 완료 후 예약 시 기재한 영문명의 수정은 불가합니다. 영문명 기재 오류 시 탑승이나 입국이 거절될 수 있습니다."
    ];
    
    const feedbackItems = [];
    const count = Math.min(limit, Math.floor(Math.random() * 15) + 5); // 5-20개
    
    for (let i = 0; i < count; i++) {
        const randomIndex = Math.floor(Math.random() * demoQuestions.length);
        const randomQuestion = demoQuestions[randomIndex];
        const randomAnswer = demoAnswers[randomIndex];
        
        let type;
        if (feedback_type === 'all') {
            type = Math.random() > 0.25 ? 'positive' : 'negative'; // 75% positive
        } else {
            type = feedback_type;
        }
        
        const timestamp = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
        
        // 실제 데이터와 유사한 chat_id 형식 생성
        const chatIdFormats = [
            `user_d1a0bec29162c2fa`,
            `user_a8637fe0996f0fdf`,
            `user_4891505317499602`,
            `user_94493c82d6a7d76e`,
            `user_9d6cba34176152e1`,
            `user_e03e0b49d8d41fca`,
            `user_1f36a76072182486`,
            `user_c5b87d77359bb543`,
            `user_c4ba5f6289c10bf6`,
            `user_ba6454cad9bb1fb9`
        ];
        
        const randomChatId = chatIdFormats[Math.floor(Math.random() * chatIdFormats.length)];
        
        feedbackItems.push({
            feedback_id: `demo_${Date.now()}_${i}`,
            chat_id: randomChatId,
            feedback: type,
            question: randomQuestion,
            answer: randomAnswer + " ※ 이 답변은 AI가 안내한 내용으로 실제와 다를 수 있습니다.",
            timestamp: timestamp.toISOString(),
            client_ip: `192.168.1.${100 + Math.floor(Math.random() * 50)}`,
            user_agent: 'Demo Browser'
        });
    }
    
    return {
        feedback: feedbackItems,
        total: feedbackItems.length
    };
}

// 피드백 표시
async function loadFeedback(type = 'all') {
    currentFeedbackFilter = type;
    document.querySelectorAll('.data-filters button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(type === 'all' ? 'allBtn' : type + 'Btn').classList.add('active');

    const limit = parseInt(document.getElementById('limitSelect').value);
    
    // Load feedback and QA data simultaneously
    const [feedbackData, qaData] = await Promise.all([
        fetchFeedback(limit, type),
        globalQAData.length > 0 ? Promise.resolve(globalQAData) : loadQAData()
    ]);
    
    // Enrich feedback data with QA data
    const enrichedFeedback = enrichFeedbackWithQA(feedbackData.feedback || [], qaData);
    
    allFeedbackData = enrichedFeedback;
    displayFeedback(enrichedFeedback);
}

function displayFeedback(feedbackList) {
    const container = document.getElementById('feedbackList');
    const countElement = document.getElementById('feedbackCount');
    
    countElement.textContent = feedbackList.length + '개';
    
    if (feedbackList.length === 0) {
        container.innerHTML = '<div class="error">표시할 피드백이 없습니다.</div>';
        return;
    }
    
    const html = feedbackList.map((feedback, index) => {
        const date = new Date(feedback.timestamp).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const typeClass = feedback.feedback === 'positive' ? 'positive' : 'negative';
        const typeText = feedback.feedback === 'positive' ? '👍 도움됨' : '👎 아쉬움';
        
        // Q&A connection status display (with match score)
        let qaStatus = '';
        if (feedback.hasQAData) {
            const matchInfo = feedback.matchScore > 0 ? 
                `질문매칭 ${(feedback.matchScore * 100).toFixed(0)}%` : 
                '최근Q&A';
            qaStatus = `<span style="color: #28a745; font-weight: 600;">✓ Q&A 연결됨 (${feedback.qaCount}건, ${matchInfo})</span>`;
        } else {
            qaStatus = `<span style="color: #dc3545;">○ Q&A 미연결</span>`;
        }
        
        // Match status display
        let matchStatusText = '';
        if (feedback.hasQAData && feedback.match_status !== undefined) {
            const matchLabels = {
                1.0: '<span style="color: #28a745;">⭕️ 매치</span>',
                0.0: '<span style="color: #dc3545;">✖️ 매치 안됨</span>',
                0.5: '<span style="color: #ffc107;">➡️ 보강 필요</span>'
            };
            matchStatusText = matchLabels[feedback.match_status] || '<span style="color: #6c757d;">- 미평가</span>';
        }
        
        return `
            <div class="data-item ${typeClass}">
                <div class="data-meta">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="data-type ${typeClass}">${typeText}</span>
                        ${matchStatusText}
                    </div>
                    <span>${date}</span>
                </div>
                <div class="data-content">
                    <div class="question">❓ ${feedback.question || '질문 정보 없음'}</div>
                    <div class="answer ${index < 5 ? '' : 'collapsed'}" id="answer_${index}">
                        ${feedback.answer || '답변 정보 없음'}
                    </div>
                    ${(feedback.answer && feedback.answer.length > 200) ? 
                        `<button class="expand-toggle" onclick="toggleAnswer(${index})">
                            <span id="toggle_text_${index}">${index < 5 ? '접기' : '더보기'}</span>
                        </button>` : ''
                    }
                </div>
                <div class="data-details">
                    💬 Chat ID: ${feedback.chat_id || feedback.feedback || 'unknown'} | 
                    🌐 IP: ${feedback.client_ip || 'unknown'} | 
                    🆔 피드백 ID: ${feedback.feedback_id || 'unknown'} | 
                    ${qaStatus}
                    ${feedback.qa_id ? ` | 🔗 Q&A ID: ${feedback.qa_id}` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

// 답변 토글 함수
function toggleAnswer(index) {
    const answer = document.getElementById(`answer_${index}`);
    const toggleText = document.getElementById(`toggle_text_${index}`);
    
    if (answer.classList.contains('collapsed')) {
        answer.classList.remove('collapsed');
        toggleText.textContent = '접기';
    } else {
        answer.classList.add('collapsed');
        toggleText.textContent = '더보기';
    }
}

// 모든 답변 펼치기/접기
function expandAllAnswers() {
    document.querySelectorAll('#feedbackList .answer').forEach(answer => {
        answer.classList.remove('collapsed');
    });
    document.querySelectorAll('#feedbackList .expand-toggle span').forEach(span => {
        span.textContent = '접기';
    });
}

function collapseAllAnswers() {
    document.querySelectorAll('#feedbackList .answer').forEach(answer => {
        answer.classList.add('collapsed');
    });
    document.querySelectorAll('#feedbackList .expand-toggle span').forEach(span => {
        span.textContent = '더보기';
    });
}

// 에러 표시
function showError(message, container = 'feedbackList') {
    const el = document.getElementById(container);
    if (el) el.innerHTML = `<div class="error">${message}</div>`;
}

// Events
document.addEventListener('DOMContentLoaded', async () => {
    await testApiConnection();
    // Load QA data first, then load feedback data
    await loadQAData();
    await refreshData();
});
document.getElementById('limitSelect').addEventListener('change', () => loadFeedback(currentFeedbackFilter));
document.getElementById('daysSelect').addEventListener('change', refreshData);
document.getElementById('conversationDaysSelect').addEventListener('change', refreshConversationData);
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        refreshData();
    }
});

console.log(`🚀 투어비스 통합 대시보드 초기화 완료 (mrk1)`);
