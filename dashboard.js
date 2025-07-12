// dashboard.js - 투어비스 통합 대시보드 JavaScript (실제 API 전용)

// 설정
const API_BASE_URL = window.location.origin;

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
                // 404가 아닌 다른 오류는 로그에 기록
                console.warn(`⚠️ ${endpoint} 응답 오류: ${response.status}`);
            }
        } catch (error) {
            if (!error.message.includes('404')) {
                console.warn(`⚠️ ${endpoint} 요청 실패:`, error.message);
            }
        }
    }

    console.log('📊 API 연결 실패 - 데모 데이터 사용');
    return generateDemoStats(days);
}

// 피드백 데이터
async function fetchFeedback(limit = 50, feedback_type = 'all') {
    try {
        console.log(`📝 피드백 데이터 요청: ${API_BASE_URL}/admin/feedback?limit=${limit}&feedback_type=${feedback_type}`);
        const response = await fetch(`${API_BASE_URL}/admin/feedback?limit=${limit}&feedback_type=${feedback_type}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('✅ 피드백 데이터 수신:', data);
        return data;
    } catch (error) {
        console.error('❌ 피드백 데이터 로드 실패:', error);
        showError('피드백 데이터를 불러올 수 없습니다.');
        return {
            feedback: [],
            total: 0
        };
    }
}

// Q&A 데이터
async function fetchConversations(days = 7, limit = 50) {
    console.log(`💬 Q&A 데이터 요청 시도...`);
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

// 피드백 표시
async function loadFeedback(type = 'all') {
    currentFeedbackFilter = type;
    document.querySelectorAll('.data-filters button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(type === 'all' ? 'allBtn' : type + 'Btn').classList.add('active');

    const limit = parseInt(document.getElementById('limitSelect').value);
    const data = await fetchFeedback(limit, type);
    allFeedbackData = data.feedback || [];
    displayFeedback(allFeedbackData);
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
        
        return `
            <div class="data-item ${typeClass}">
                <div class="data-meta">
                    <span class="data-type ${typeClass}">${typeText}</span>
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
                    💬 Chat ID: ${feedback.chat_id || 'unknown'} | 
                    🌐 IP: ${feedback.client_ip || 'unknown'} | 
                    🆔 피드백 ID: ${feedback.feedback_id || 'unknown'}
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

// 이벤트
document.addEventListener('DOMContentLoaded', async () => {
    await testApiConnection();
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

console.log(`🚀 투어비스 통합 대시보드 초기화 완료`);
