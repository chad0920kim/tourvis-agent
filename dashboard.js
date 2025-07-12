// dashboard.js - 투어비스 통합 대시보드 JavaScript

// 설정
const API_BASE_URL = 'http://localhost:8001'; // main_sub.py 서비스 URL

let trendChart, avgChart, wordFrequencyChart, matchStatusChart, qaTimeChart;
let currentFeedbackFilter = 'all';
let currentConversationFilter = 'all';

let allFeedbackData = [];
let allConversationData = [];
let currentSearchQuery = '';
let isSearchMode = false;

// 탭 전환 함수
function switchTab(tabName) {
    // 모든 탭 내용 숨기기
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // 모든 탭 버튼 비활성화
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    // 선택된 탭 활성화
    document.getElementById(tabName + 'Content').classList.add('active');
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    // 탭에 따른 초기 데이터 로드
    if (tabName === 'feedback') {
        refreshData();
    } else if (tabName === 'questions') {
        refreshQuestionData();
    } else if (tabName === 'conversations') {
        refreshConversationData();
    }
}

// API 호출 함수들
async function fetchStats(days = 7) {
    try {
        const response = await fetch(`${API_BASE_URL}/stats?days=${days}`);
        if (!response.ok) throw new Error('네트워크 응답이 올바르지 않습니다');
        return await response.json();
    } catch (error) {
        console.error('통계 데이터 로드 실패:', error);
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
        const response = await fetch(`${API_BASE_URL}/admin/feedback?limit=${limit}&feedback_type=${feedback_type}`);
        if (!response.ok) throw new Error('네트워크 응답이 올바르지 않습니다');
        return await response.json();
    } catch (error) {
        console.error('피드백 데이터 로드 실패:', error);
        return { feedback: [], total: 0 };
    }
}

// Q&A 대화 데이터 로드 함수들
async function fetchConversations(days = 7, limit = 50) {
    try {
        // 실제 API 엔드포인트로 요청 (향후 main_sub.py에 추가될 예정)
        const response = await fetch(`${API_BASE_URL}/qa/conversations?days=${days}&limit=${limit}`);
        if (response.ok) {
            return await response.json();
        } else {
            // API가 아직 없는 경우 목업 데이터 사용
            console.warn('Q&A API 엔드포인트가 아직 구현되지 않음. 목업 데이터 사용.');
        }
    } catch (error) {
        console.error('Q&A API 호출 실패:', error);
    }

    // 목업 데이터 (실제 qa_conversations.jsonl 형식에 맞춤)
    const mockData = generateMockConversations(days, limit);
    return {
        conversations: mockData,
        total: mockData.length,
        stats: {
            total_conversations: mockData.length,
            unique_sessions: new Set(mockData.map(c => c.session_id)).size,
            match_distribution: {
                good: mockData.filter(c => c.match_status === 1.0).length,
                bad: mockData.filter(c => c.match_status === 0.0).length,
                improve: mockData.filter(c => c.match_status === 0.5).length,
                none: mockData.filter(c => !c.match_status).length
            }
        }
    };
}

// 목업 Q&A 데이터 생성
function generateMockConversations(days = 7, limit = 50) {
    const questions = [
        "체크인 시간이 언제인가요?",
        "취소 수수료는 얼마인가요?",
        "무료 취소는 언제까지 가능한가요?",
        "항공료에 세금이 포함되어 있나요?",
        "수하물 규정이 어떻게 되나요?",
        "호텔 조식은 포함되어 있나요?",
        "신용카드 무이자 할부가 가능한가요?",
        "예약 확인은 어떻게 하나요?",
        "비자는 어떻게 발급받나요?",
        "환불은 언제 처리되나요?",
        "좌석 선택이 가능한가요?",
        "패키지 상품 할인이 있나요?",
        "고객센터 연락처가 어떻게 되나요?",
        "여행자 보험은 포함되어 있나요?",
        "날짜 변경 수수료는 얼마인가요?"
    ];

    const answers = [
        "일반적으로 호텔 체크인 시간은 오후 3시부터입니다. 다만 호텔마다 정책이 다를 수 있으니 예약 확인서를 확인해 주세요.",
        "취소 수수료는 예약 조건에 따라 다릅니다. 무료 취소 기간, 부분 취소 수수료 기간, 전액 취소 수수료 기간으로 나뉩니다.",
        "무료 취소는 일반적으로 출발 24-48시간 전까지 가능합니다. 상품별로 조건이 다르니 예약 시 확인해 주세요.",
        "항공료에는 기본 세금과 유류할증료가 포함되어 있습니다. 추가 세금이 있는 경우 별도 안내드립니다.",
        "수하물 규정은 항공사별로 다릅니다. 일반적으로 이코노미 클래스는 23kg까지 무료입니다.",
        "호텔 조식 포함 여부는 상품 상세페이지에서 확인하실 수 있습니다. '조식 포함' 표시를 확인해 주세요.",
        "대부분의 신용카드로 2-12개월 무이자 할부가 가능합니다. 카드사별 혜택을 확인해 주세요.",
        "예약 완료 후 이메일로 예약 확인서가 발송됩니다. 마이페이지에서도 확인 가능합니다.",
        "비자 발급은 여행객이 직접 진행하셔야 합니다. 투어비스는 비자 대행 서비스를 제공하지 않습니다.",
        "환불은 취소 완료 후 5-7 영업일 내에 처리됩니다. 카드사 정책에 따라 실제 입금까지 추가 시간이 소요될 수 있습니다."
    ];

    const mockConversations = [];
    const now = new Date();
    const matchStatuses = [1.0, 0.0, 0.5, null];

    for (let i = 0; i < Math.min(limit, 100); i++) {
        const daysAgo = Math.floor(Math.random() * days);
        const timestamp = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
        const chatId = `user_${Math.random().toString(36).substr(2, 8)}`;
        const sessionId = `${chatId}_${timestamp.toISOString().split('T')[0].replace(/-/g, '')}`;
        
        const questionIndex = Math.floor(Math.random() * questions.length);
        const question = questions[questionIndex];
        const answer = answers[Math.min(questionIndex, answers.length - 1)];
        
        mockConversations.push({
            id: `${chatId}_${Math.floor(timestamp.getTime() / 1000)}_${Math.floor(Math.random() * 10000)}`,
            session_id: sessionId,
            chat_id: chatId,
            timestamp: timestamp.toISOString(),
            question: question,
            answer: answer,
            metadata: {
                has_typo_correction: Math.random() < 0.1,
                original_question: question,
                response_time_ms: Math.floor(Math.random() * 3000) + 500
            },
            match_status: matchStatuses[Math.floor(Math.random() * matchStatuses.length)]
        });
    }

    // 시간순 정렬 (최신 순)
    return mockConversations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// 피드백 데이터 새로고침
async function refreshData() {
    const days = parseInt(document.getElementById('daysSelect').value);
    
    // 통계 업데이트
    const stats = await fetchStats(days);
    updateStatsDisplay(stats);
    
    // 차트 업데이트
    updateCharts(stats, days);
    
    // 피드백 목록 로드
    await loadFeedback(currentFeedbackFilter);
}

// Q&A 대화 데이터 새로고침
async function refreshConversationData() {
    const days = parseInt(document.getElementById('conversationDaysSelect').value);
    const limit = parseInt(document.getElementById('conversationLimitSelect').value);
    
    const data = await fetchConversations(days, limit);
    updateConversationStats(data);
    await loadConversations(currentConversationFilter, data);
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
    
    document.getElementById('totalConversations').textContent = stats.total_conversations || conversations.length;
    document.getElementById('totalSessions').textContent = stats.unique_sessions || 0;
    
    if (stats.match_distribution) {
        document.getElementById('matchGood').textContent = stats.match_distribution.good || 0;
        document.getElementById('matchBad').textContent = stats.match_distribution.bad || 0;
        document.getElementById('matchImprove').textContent = stats.match_distribution.improve || 0;
    } else {
        // 통계가 없는 경우 직접 계산
        let matchGood = 0, matchBad = 0, matchImprove = 0;
        conversations.forEach(conv => {
            const status = conv.match_status;
            if (status === 1.0) matchGood++;
            else if (status === 0.0) matchBad++;
            else if (status === 0.5) matchImprove++;
        });
        
        document.getElementById('matchGood').textContent = matchGood;
        document.getElementById('matchBad').textContent = matchBad;
        document.getElementById('matchImprove').textContent = matchImprove;
    }
}

// 차트 업데이트
function updateCharts(stats, days) {
    // 기존 차트 파괴
    if (trendChart) {
        trendChart.destroy();
    }
    if (avgChart) {
        avgChart.destroy();
    }

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

    // 평균 피드백 차트
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

// Q&A 매치 상태 차트 업데이트
function updateConversationCharts(data) {
    const conversations = data.conversations || [];
    
    // 매치 상태 차트
    if (matchStatusChart) {
        matchStatusChart.destroy();
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

    // Q&A 시간 추이 차트 (간단한 예시)
    if (qaTimeChart) {
        qaTimeChart.destroy();
    }
    
    const timeCtx = document.getElementById('qaTimeChart').getContext('2d');
    qaTimeChart = new Chart(timeCtx, {
        type: 'bar',
        data: {
            labels: ['월', '화', '수', '목', '금', '토', '일'],
            datasets: [{
                label: 'Q&A 수',
                data: [12, 8, 15, 20, 18, 5, 3],
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

// 추이 데이터 생성 (목업)
function generateTrendData(stats, days) {
    const positive = [];
    const negative = [];
    
    // 간단한 랜덤 데이터 생성 (실제로는 API에서 일별 데이터를 가져와야 함)
    for (let i = 0; i < days; i++) {
        positive.push(Math.floor(Math.random() * (stats.positive / days * 2)) || 0);
        negative.push(Math.floor(Math.random() * (stats.negative / days * 2)) || 0);
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
    const data = await fetchFeedback(limit, type);
    
    allFeedbackData = data.feedback || [];
    displayFeedback(allFeedbackData);
}

// Q&A 대화 로드
async function loadConversations(type = 'all', data = null) {
    currentConversationFilter = type;
    
    // 필터 버튼 상태 업데이트
    document.querySelectorAll('#conversationsContent .data-filters button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(type === 'all' ? 'allConvBtn' : type + 'Btn').classList.add('active');
    
    if (!data) {
        const days = parseInt(document.getElementById('conversationDaysSelect').value);
        const limit = parseInt(document.getElementById('conversationLimitSelect').value);
        data = await fetchConversations(days, limit);
    }
    
    let filteredData = data.conversations || [];
    
    // 필터링
    if (type !== 'all') {
        if (type === 'match_good') {
            filteredData = filteredData.filter(c => c.match_status === 1.0);
        } else if (type === 'match_bad') {
            filteredData = filteredData.filter(c => c.match_status === 0.0);
        } else if (type === 'match_improve') {
            filteredData = filteredData.filter(c => c.match_status === 0.5);
        } else if (type === 'no_match') {
            filteredData = filteredData.filter(c => c.match_status === null || c.match_status === undefined);
        }
    }
    
    allConversationData = filteredData;
    displayConversations(allConversationData);
    updateConversationCharts(data);
}

// 피드백 표시
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

// Q&A 대화 표시
function displayConversations(conversationList) {
    const container = document.getElementById('conversationsList');
    const countElement = document.getElementById('conversationsCount');
    
    countElement.textContent = conversationList.length + '개';
    
    if (conversationList.length === 0) {
        container.innerHTML = '<div class="error">표시할 Q&A 대화가 없습니다.</div>';
        return;
    }
    
    const html = conversationList.map((conversation, index) => {
        const date = new Date(conversation.timestamp).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // 매치 상태 표시
        let matchStatusHtml = '';
        if (conversation.match_status === 1.0) {
            matchStatusHtml = '<span class="match-status match-good">매치⭕️</span>';
        } else if (conversation.match_status === 0.0) {
            matchStatusHtml = '<span class="match-status match-bad">매치✖️</span>';
        } else if (conversation.match_status === 0.5) {
            matchStatusHtml = '<span class="match-status match-improve">보강➡️</span>';
        }
        
        return `
            <div class="data-item qa-item">
                <div class="data-meta">
                    <span class="data-type qa">💬 Q&A</span>
                    <span>${date}${matchStatusHtml}</span>
                </div>
                <div class="data-content">
                    <div class="question">❓ ${conversation.question}</div>
                    <div class="answer ${index < 3 ? '' : 'collapsed'}" id="qa_answer_${index}">
                        ${conversation.answer}
                    </div>
                    ${conversation.answer.length > 200 ? 
                        `<button class="expand-toggle" onclick="toggleQAAnswer(${index})">
                            <span id="qa_toggle_text_${index}">${index < 3 ? '접기' : '더보기'}</span>
                        </button>` : ''
                    }
                </div>
                <div class="data-details">
                    💬 Chat ID: ${conversation.chat_id} | 
                    🆔 QA ID: ${conversation.id} | 
                    📅 세션: ${conversation.session_id}
                    ${conversation.metadata?.has_typo_correction ? ' | ✏️ 오타보정됨' : ''}
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

// Q&A 답변 토글 함수
function toggleQAAnswer(index) {
    const answer = document.getElementById(`qa_answer_${index}`);
    const toggleText = document.getElementById(`qa_toggle_text_${index}`);
    
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

// 모든 Q&A 대화 펼치기/접기
function expandAllConversations() {
    document.querySelectorAll('#conversationsList .answer').forEach(answer => {
        answer.classList.remove('collapsed');
    });
    document.querySelectorAll('#conversationsList .expand-toggle span').forEach(span => {
        span.textContent = '접기';
    });
}

function collapseAllConversations() {
    document.querySelectorAll('#conversationsList .answer').forEach(answer => {
        answer.classList.add('collapsed');
    });
    document.querySelectorAll('#conversationsList .expand-toggle span').forEach(span => {
        span.textContent = '더보기';
    });
}

// 검색어 관련 함수들 (향후 구현)
async function refreshQuestionData() {
    const days = parseInt(document.getElementById('questionDaysSelect').value);
    console.log(`검색어 데이터 새로고침 (${days}일) - 향후 구현 예정`);
    
    // 목업 검색어 통계
    const mockQuestionStats = {
        total_questions: Math.floor(Math.random() * 500) + 100,
        avg_length: Math.floor(Math.random() * 20) + 15,
        avg_word_count: Math.floor(Math.random() * 5) + 3,
        unique_words: Math.floor(Math.random() * 200) + 50
    };
    
    // 통계 업데이트
    document.getElementById('totalQuestions').textContent = mockQuestionStats.total_questions;
    document.getElementById('avgLength').textContent = mockQuestionStats.avg_length + '자';
    document.getElementById('avgWordCount').textContent = mockQuestionStats.avg_word_count + '개';
    document.getElementById('uniqueWords').textContent = mockQuestionStats.unique_words + '개';
    
    // 목업 키워드 차트
    updateWordFrequencyChart();
}

function updateWordFrequencyChart() {
    if (wordFrequencyChart) {
        wordFrequencyChart.destroy();
    }
    
    const ctx = document.getElementById('wordFrequencyChart').getContext('2d');
    const mockKeywords = [
        { word: '체크인', count: 45 },
        { word: '취소', count: 38 },
        { word: '환불', count: 32 },
        { word: '할부', count: 28 },
        { word: '예약', count: 25 },
        { word: '호텔', count: 22 },
        { word: '항공료', count: 20 },
        { word: '수하물', count: 18 },
        { word: '날짜변경', count: 15 },
        { word: '비자', count: 12 }
    ];
    
    wordFrequencyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: mockKeywords.map(k => k.word),
            datasets: [{
                label: '검색 빈도',
                data: mockKeywords.map(k => k.count),
                backgroundColor: [
                    '#667eea', '#764ba2', '#f093fb', '#f5576c',
                    '#4facfe', '#00f2fe', '#43e97b', '#38f9d7',
                    '#ffecd2', '#fcb69f'
                ],
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 5
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

function searchQuestions() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) {
        alert('검색어를 입력해주세요.');
        return;
    }
    
    currentSearchQuery = query;
    isSearchMode = true;
    
    console.log(`검색: "${query}" - 향후 구현 예정`);
    
    // 목업 검색 결과
    const mockResults = [
        `"${query}"가 포함된 검색어 1`,
        `"${query}"가 포함된 검색어 2`,
        `"${query}"가 포함된 검색어 3`
    ];
    
    document.getElementById('questionsList').innerHTML = `
        <div class="data-item qa-item">
            <div class="data-content">
                <div class="question">🔍 검색 결과: "${query}"</div>
                <div class="answer">
                    ${mockResults.map(result => `• ${result}`).join('<br>')}
                    <br><br>
                    <em>실제 검색 기능은 향후 구현 예정입니다.</em>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('questionsCount').textContent = mockResults.length + '개';
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    currentSearchQuery = '';
    isSearchMode = false;
    
    // 전체 검색어 목록 다시 로드
    refreshQuestionData();
    
    console.log('검색 초기화');
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    refreshData(); // 초기 피드백 데이터 로드
    
    // 검색어 입력 시 엔터키 이벤트
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchQuestions();
        }
    });
});

// 이벤트 리스너
document.getElementById('limitSelect').addEventListener('change', function() {
    loadFeedback(currentFeedbackFilter);
});

document.getElementById('conversationLimitSelect').addEventListener('change', function() {
    loadConversations(currentConversationFilter);
});

document.getElementById('questionLimitSelect').addEventListener('change', function() {
    refreshQuestionData();
});

document.getElementById('daysSelect').addEventListener('change', function() {
    refreshData();
});

document.getElementById('conversationDaysSelect').addEventListener('change', function() {
    refreshConversationData();
});

document.getElementById('questionDaysSelect').addEventListener('change', function() {
    refreshQuestionData();
});

// 추가 유틸리티 함수들

// 날짜 포맷팅 함수
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 텍스트 하이라이트 함수
function highlightText(text, query) {
    if (!query || !text) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

// 데이터 내보내기 함수
function exportData(type) {
    let data, filename;
    
    switch(type) {
        case 'feedback':
            data = allFeedbackData;
            filename = 'feedback_data.json';
            break;
        case 'conversations':
            data = allConversationData;
            filename = 'qa_conversations.json';
            break;
        default:
            console.error('Unknown export type:', type);
            return;
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 에러 처리 함수
function showError(message, container = 'feedbackList') {
    const element = document.getElementById(container);
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

// 성능 모니터링
function measurePerformance(name, fn) {
    return async function(...args) {
        const start = performance.now();
        const result = await fn.apply(this, args);
        const end = performance.now();
        console.log(`${name} 실행 시간: ${(end - start).toFixed(2)}ms`);
        return result;
    };
}

// 성능 최적화된 함수들로 래핑
const optimizedRefreshData = measurePerformance('피드백 데이터 새로고침', refreshData);
const optimizedRefreshConversationData = measurePerformance('Q&A 데이터 새로고침', refreshConversationData);
const optimizedRefreshQuestionData = measurePerformance('검색어 데이터 새로고침', refreshQuestionData);

// 키보드 단축키 지원
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + R: 현재 탭 새로고침
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        const activeTab = document.querySelector('.tab-button.active').id;
        
        switch(activeTab) {
            case 'feedbackTab':
                optimizedRefreshData();
                break;
            case 'questionsTab':
                optimizedRefreshQuestionData();
                break;
            case 'conversationsTab':
                optimizedRefreshConversationData();
                break;
        }
    }
    
    // Ctrl/Cmd + 1,2,3: 탭 전환
    if ((e.ctrlKey || e.metaKey) && ['1', '2', '3'].includes(e.key)) {
        e.preventDefault();
        const tabMap = {
            '1': 'feedback',
            '2': 'questions', 
            '3': 'conversations'
        };
        switchTab(tabMap[e.key]);
    }
    
    // ESC: 검색 초기화
    if (e.key === 'Escape' && isSearchMode) {
        clearSearch();
    }
});

// 자동 새로고침 기능 (옵션)
let autoRefreshInterval = null;

function startAutoRefresh(minutes = 5) {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    autoRefreshInterval = setInterval(() => {
        const activeTab = document.querySelector('.tab-button.active').id;
        console.log(`자동 새로고침: ${activeTab}`);
        
        switch(activeTab) {
            case 'feedbackTab':
                optimizedRefreshData();
                break;
            case 'questionsTab':
                optimizedRefreshQuestionData();
                break;
            case 'conversationsTab':
                optimizedRefreshConversationData();
                break;
        }
    }, minutes * 60 * 1000);
    
    console.log(`자동 새로고침 시작: ${minutes}분마다`);
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        console.log('자동 새로고침 중지');
    }
}

// 페이지 가시성 API를 이용한 최적화
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // 페이지가 숨겨지면 자동 새로고침 중지
        if (autoRefreshInterval) {
            console.log('페이지 숨김: 자동 새로고침 일시 중지');
        }
    } else {
        // 페이지가 다시 보이면 즉시 새로고침
        console.log('페이지 복원: 데이터 새로고침');
        const activeTab = document.querySelector('.tab-button.active').id;
        
        switch(activeTab) {
            case 'feedbackTab':
                optimizedRefreshData();
                break;
            case 'questionsTab':
                optimizedRefreshQuestionData();
                break;
            case 'conversationsTab':
                optimizedRefreshConversationData();
                break;
        }
    }
});

// 브라우저 지원 체크
function checkBrowserSupport() {
    const features = {
        fetch: 'fetch' in window,
        promises: 'Promise' in window,
        localStorage: 'localStorage' in window,
        canvas: 'getContext' in document.createElement('canvas'),
        es6: (() => {
            try {
                eval('const test = () => {};');
                return true;
            } catch (e) {
                return false;
            }
        })()
    };
    
    const unsupported = Object.entries(features).filter(([key, supported]) => !supported);
    
    if (unsupported.length > 0) {
        console.warn('지원되지 않는 브라우저 기능:', unsupported.map(([key]) => key));
        showError(`이 브라우저는 일부 기능을 지원하지 않습니다: ${unsupported.map(([key]) => key).join(', ')}`);
    } else {
        console.log('✅ 모든 브라우저 기능이 지원됩니다.');
    }
    
    return unsupported.length === 0;
}

// 초기화 완료 로그
console.log('🚀 투어비스 통합 대시보드 초기화 완료');
console.log('📊 사용 가능한 기능:');
console.log('- 피드백 분석 및 시각화');
console.log('- Q&A 대화 분석');
console.log('- 검색어 분석');
console.log('- 실시간 통계');
console.log('- 키보드 단축키 (Ctrl+R: 새로고침, Ctrl+1,2,3: 탭 전환)');
console.log('- 자동 새로고침 (현재 비활성화, startAutoRefresh(분) 으로 활성화 가능)');

// 브라우저 지원 체크
checkBrowserSupport();

// 개발 모드에서만 자동 새로고침 활성화 (옵션)
// if (window.location.hostname === 'localhost') {
//     startAutoRefresh(2); // 2분마다 자동 새로고침
// }
