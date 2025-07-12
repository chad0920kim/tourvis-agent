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

// API 연결 테스트
async function testApiConnection() {
    try {
        console.log('🔍 API 연결 테스트 중...');
        updateConnectionStatus(false, 'API 연결 확인 중...');
        
        const response = await fetch(`${API_BASE_URL}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ API 연결 성공:', data);
            updateConnectionStatus(true, `API 연결됨 (${data.service})`);
            return true;
        } else {
            console.error('❌ API 응답 오류:', response.status);
            updateConnectionStatus(false, `API 오류: ${response.status}`);
            return false;
        }
    } catch (error) {
        console.error('❌ API 연결 실패:', error);
        updateConnectionStatus(false, 'API 연결 실패');
        return false;
    }
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

// API 호출 함수들
async function fetchStats(days = 7) {
    try {
        console.log(`📊 통계 데이터 요청: ${API_BASE_URL}/stats?days=${days}`);
        const response = await fetch(`${API_BASE_URL}/stats?days=${days}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(10000)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('✅ 통계 데이터 수신:', data);
        return data;
    } catch (error) {
        console.error('❌ 통계 데이터 로드 실패:', error);
        showError('통계 데이터를 불러올 수 없습니다.');
        return {
            total_feedback: 0,
            positive: 0,
            negative: 0,
            satisfaction_rate: 0,
            unique_users: 0
        };
    }
}

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

// Q&A 대화 데이터 로드 (아직 구현되지 않은 기능)
async function fetchConversations(days = 7, limit = 50) {
    try {
        console.log(`💬 Q&A 데이터 요청 시도...`);
        // Q&A API는 아직 완전히 구현되지 않음
        console.log('Q&A API는 현재 구현 중입니다.');
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
    } catch (error) {
        console.error('Q&A API 호출 실패:', error);
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
}

// 피드백 데이터 새로고침
async function refreshData() {
    const days = parseInt(document.getElementById('daysSelect').value);
    
    try {
        // 로딩 표시
        document.getElementById('feedbackList').innerHTML = '<div class="loading">피드백 데이터를 불러오는 중...</div>';
        
        // 통계 업데이트
        const stats = await fetchStats(days);
        updateStatsDisplay(stats);
        
        // 차트 업데이트
        updateCharts(stats, days);
        
        // 피드백 목록 로드
        await loadFeedback(currentFeedbackFilter);
    } catch (error) {
        console.error('데이터 새로고침 실패:', error);
        showError('데이터를 불러오는 중 오류가 발생했습니다.');
    }
}

// Q&A 대화 데이터 새로고침
async function refreshConversationData() {
    const days = parseInt(document.getElementById('conversationDaysSelect').value);
    
    try {
        const data = await fetchConversations(days, 100);
        updateConversationStats(data);
        updateConversationCharts(data);
    } catch (error) {
        console.error('Q&A 데이터 새로고침 실패:', error);
        showError('Q&A 데이터를 불러오는 중 오류가 발생했습니다.');
    }
}

// 통계 표시 업데이트
function updateStatsDisplay(stats) {
    document.getElementById('totalFeedback').textContent = stats.total_feedback || 0;
    document.getElementById('positiveFeedback').textContent = stats.positive || 0;
    document.getElementById('negativeFeedback').textContent = stats.negative || 0;
    document.getElementById('uniqueUsers').textContent = stats.unique_users || 0;
    document.getElementById('satisfactionRate').textContent = (stats.satisfaction_rate || 0) + '%';
}

// Q&A 대화 통계 업데이트
function updateConversationStats(data) {
    const stats = data.stats || {};
    const conversations = data.conversations || [];
    
    document.getElementById('totalConversations').textContent = stats.total_conversations || 0;
    document.getElementById('totalSessions').textContent = stats.unique_sessions || 0;
    
    if (stats.match_distribution) {
        document.getElementById('matchGood').textContent = stats.match_distribution.good || 0;
        document.getElementById('matchBad').textContent = stats.match_distribution.bad || 0;
        document.getElementById('matchImprove').textContent = stats.match_distribution.improve || 0;
    } else {
        document.getElementById('matchGood').textContent = 0;
        document.getElementById('matchBad').textContent = 0;
        document.getElementById('matchImprove').textContent = 0;
    }
}

// 차트 업데이트
function updateCharts(stats, days) {
    // 기존 차트 파괴
    if (window.trendChart) {
        window.trendChart.destroy();
    }
    if (window.avgChart) {
        window.avgChart.destroy();
    }

    // 시간별 피드백 추이 차트
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    const trendLabels = generateTimeLabels(days);
    const trendData = generateTrendData(stats, days);

    window.trendChart = new Chart(trendCtx, {
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
    window.avgChart = new Chart(avgCtx, {
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

// Q&A 매치 상태 차트 업데이트
function updateConversationCharts(data) {
    const conversations = data.conversations || [];
    
    // 매치 상태 차트
    if (window.matchStatusChart) {
        window.matchStatusChart.destroy();
    }
    
    const matchCtx = document.getElementById('matchStatusChart').getContext('2d');
    let matchGood = 0, matchBad = 0, matchImprove = 0, noMatch = 0;
    
    conversations.forEach(conv => {
        const status = conv.match_status;
        if (status === 1.0) matchGood++;
        else if (status === 0.0) matchBad++;
        else if (status === 0.5) matchImprove++;
        else noMatch++;
    });
    
    window.matchStatusChart = new Chart(matchCtx, {
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
    if (window.qaTimeChart) {
        window.qaTimeChart.destroy();
    }
    
    const timeCtx = document.getElementById('qaTimeChart').getContext('2d');
    window.qaTimeChart = new Chart(timeCtx, {
        type: 'bar',
        data: {
            labels: ['월', '화', '수', '목', '금', '토', '일'],
            datasets: [{
                label: 'Q&A 수',
                data: [0, 0, 0, 0, 0, 0, 0], // 실제 데이터가 없으므로 0으로 표시
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

// 추이 데이터 생성 (균등 분포)
function generateTrendData(stats, days) {
    const positive = [];
    const negative = [];
    
    // 균등하게 분포 (실제로는 API에서 일별 데이터를 가져와야 함)
    const avgPositive = Math.floor((stats.positive || 0) / days);
    const avgNegative = Math.floor((stats.negative || 0) / days);
    
    for (let i = 0; i < days; i++) {
        positive.push(avgPositive);
        negative.push(avgNegative);
    }
    
    return { positive, negative };
}

// 피드백 로드
async function loadFeedback(type = 'all') {
    currentFeedbackFilter = type;
    
    // 필터 버튼 상태 업데이트
    document.querySelectorAll('.data-filters button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(type === 'all' ? 'allBtn' : type + 'Btn').classList.add('active');
    
    const limit = parseInt(document.getElementById('limitSelect').value);
    
    try {
        const data = await fetchFeedback(limit, type);
        allFeedbackData = data.feedback || [];
        displayFeedback(allFeedbackData);
    } catch (error) {
        console.error('피드백 로드 실패:', error);
        showError('피드백 데이터를 불러오는 중 오류가 발생했습니다.');
    }
}

// 피드백 표시
function displayFeedback(feedbackList) {
    const container = document.getElementById('feedbackList');
    const countElement = document.getElementById('feedbackCount');
    
    countElement.textContent = feedbackList.length + '개';
    
    if (feedbackList.length === 0) {
        container.innerHTML = '<div class="error">표시할 피드백이 없습니다.<br><br>아직 수집된 피드백 데이터가 없거나 서버 연결에 문제가 있을 수 있습니다.</div>';
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

// 에러 표시 함수
function showError(message, container = 'feedbackList') {
    console.error('에러 발생:', message);
    const element = document.getElementById(container);
    if (element) {
        element.innerHTML = `
            <div class="error">
                <h4>⚠️ 오류 발생</h4>
                <p>${message}</p>
                <button onclick="refreshData()" style="margin-top: 10px; padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer;">
                    🔄 다시 시도
                </button>
            </div>
        `;
    }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 대시보드 초기화 시작');
    
    // API 연결 테스트
    const isConnected = await testApiConnection();
    if (isConnected) {
        console.log('✅ API 연결 성공 - 실제 데이터 사용');
    } else {
        console.log('⚠️ API 연결 실패');
    }
    
    // 초기 데이터 로드
    await refreshData();
});

// 이벤트 리스너
document.getElementById('limitSelect').addEventListener('change', function() {
    loadFeedback(currentFeedbackFilter);
});

document.getElementById('daysSelect').addEventListener('change', function() {
    refreshData();
});

document.getElementById('conversationDaysSelect').addEventListener('change', function() {
    refreshConversationData();
});

// 키보드 단축키 지원
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        const activeTab = document.querySelector('.tab-button.active').id;
        
        switch(activeTab) {
            case 'feedbackTab':
                refreshData();
                break;
            case 'conversationsTab':
                refreshConversationData();
                break;
        }
    }
    
    if ((e.ctrlKey || e.metaKey) && ['1', '2'].includes(e.key)) {
        e.preventDefault();
        const tabMap = {
            '1': 'feedback',
            '2': 'conversations'
        };
        switchTab(tabMap[e.key]);
    }
});

console.log('🚀 투어비스 통합 대시보드 초기화 완료 (실제 API 전용)');
console.log('📊 사용 가능한 기능:');
console.log('- 실제 피드백 데이터 분석 및 시각화');
console.log('- 실시간 통계');
console.log('- 키보드 단축키 (Ctrl+R: 새로고침, Ctrl+1,2: 탭 전환)');
console.log(`- API 연결: ${API_BASE_URL}`);
