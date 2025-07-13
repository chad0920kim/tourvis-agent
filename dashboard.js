// ======================
// 설정 및 전역 변수
// ======================
const API_BASE_URL = window.location.hostname === 'chad0920kim.github.io' 
    ? 'https://cxdashboard.run.goorm.site'
    : 'http://localhost:8505';

console.log('🔗 Dashboard API URL:', API_BASE_URL);

let charts = {};
let currentData = {};
let currentFeedbackFilter = 'all';
let allFeedbackData = [];
let allQAData = [];
let globalQAData = [];

// ======================
// 유틸리티 함수들
// ======================
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

function showError(message, container = 'feedbackList') {
    const el = document.getElementById(container);
    if (el) el.innerHTML = '<div class="error">' + message + '</div>';
}

// ======================
// API 함수들
// ======================
async function testApiConnection() {
    console.log('🔍 API 연결 테스트 중...');
    updateConnectionStatus(false, 'API 연결 확인 중...');

    try {
        const response = await fetch(API_BASE_URL + '/health', {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ API 연결 성공:', data);
            updateConnectionStatus(true, data.service || 'Server');
            return true;
        }
    } catch (error) {
        console.error('❌ API 연결 실패:', error);
    }

    updateConnectionStatus(false, 'API 서버 미응답');
    return false;
}

async function fetchStats(days = 7) {
    try {
        const response = await fetch(API_BASE_URL + '/api/stats?days=' + days, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(10000)
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ 통계 데이터 수신:', data);
            return data;
        }
    } catch (error) {
        console.warn('⚠️ 통계 요청 실패:', error.message);
    }

    return {
        total_feedback: 0,
        positive: 0,
        negative: 0,
        satisfaction_rate: 0,
        unique_users: 0
    };
}

async function fetchFeedback(limit = 50, feedback_type = 'all') {
    const endpoints = [
        '/api/feedback',
        '/admin/feedback', 
        '/feedback'
    ];

    for (const endpoint of endpoints) {
        try {
            const url = API_BASE_URL + endpoint + '?limit=' + limit + '&feedback_type=' + feedback_type;
            console.log('📝 피드백 데이터 요청:', url);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(10000)
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ 피드백 데이터 수신:', {
                    endpoint: endpoint,
                    filter: feedback_type,
                    count: data.feedback?.length || 0,
                    total: data.total || 0
                });
                return data;
            } else if (response.status !== 404) {
                console.warn('⚠️ ' + endpoint + ' 응답 오류:', response.status);
            }
        } catch (error) {
            if (!error.message.includes('404')) {
                console.warn('⚠️ ' + endpoint + ' 요청 실패:', error.message);
            }
        }
    }

    console.log('📝 모든 피드백 API 엔드포인트 실패 - 빈 데이터 반환');
    return {
        feedback: [],
        total: 0
    };
}

async function fetchConversations(days = 7, limit = 50) {
    console.log('💬 Q&A 데이터 요청 시작:', { days, limit });
    
    const endpoints = [
        '/api/qa/conversations',
        '/qa/conversations',
        '/conversations'
    ];

    for (const endpoint of endpoints) {
        try {
            const url = `${API_BASE_URL}${endpoint}?days=${days}&limit=${limit}`;
            console.log('💬 Q&A 요청 URL:', url);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(15000)
            });

            console.log('💬 Q&A 응답 상태:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Q&A 데이터 수신 성공:', {
                    endpoint: endpoint,
                    conversations_count: data.conversations?.length || 0,
                    total: data.total || 0,
                    stats: data.stats || {},
                    raw_data_sample: data.conversations?.slice(0, 2) || []
                });
                
                // 🔧 데이터 유효성 검사
                if (!data.conversations) {
                    console.warn('⚠️ conversations 필드가 없음:', data);
                    data.conversations = [];
                }
                
                if (!data.stats) {
                    console.warn('⚠️ stats 필드가 없음, 기본값 설정');
                    data.stats = {
                        unique_sessions: 0,
                        match_distribution: { good: 0, bad: 0, improve: 0, none: 0 }
                    };
                }
                
                return data;
            } else if (response.status !== 404) {
                console.warn('⚠️ ' + endpoint + ' 응답 오류:', response.status);
                
                // 응답 내용 확인
                try {
                    const errorText = await response.text();
                    console.warn('⚠️ 오류 응답 내용:', errorText);
                } catch (e) {
                    console.warn('⚠️ 오류 응답 읽기 실패');
                }
            }
        } catch (error) {
            if (!error.message.includes('404')) {
                console.warn('⚠️ ' + endpoint + ' 요청 실패:', error.message);
            }
        }
    }

    console.log('💬 모든 Q&A 엔드포인트 실패 - 빈 데이터 반환');
    return {
        conversations: [],
        total: 0,
        stats: {
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

// ======================
// 탭 전환
// ======================
function switchTab(tabName) {
    console.log('🔄 탭 전환:', tabName);
    
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
        console.log('🔄 Q&A 탭 활성화 - 데이터 새로고침 시작');
        refreshConversationData();
    }
}

// ======================
// 데이터 처리 함수들
// ======================
function enrichFeedbackWithQA(feedbackData, qaData) {
    console.log('🔍 피드백-Q&A 연결 시작');
    console.log('📝 피드백 데이터 수:', feedbackData.length);
    console.log('💬 Q&A 데이터 수:', qaData.length);
    
    return feedbackData.map((feedback, index) => {
        const chatId = feedback.feedback || feedback.chat_id;
        const relatedQAs = qaData.filter(qa => qa.chat_id === chatId);
        
        if (relatedQAs.length > 0) {
            const latestQA = relatedQAs.sort((a, b) => {
                return new Date(b.timestamp) - new Date(a.timestamp);
            })[0];
            
            return {
                ...feedback,
                question: latestQA.question || feedback.question || '',
                answer: latestQA.answer || feedback.answer || '',
                qa_id: latestQA.id,
                match_status: latestQA.match_status,
                hasQAData: true,
                qaCount: relatedQAs.length
            };
        }
        
        return {
            ...feedback,
            question: feedback.question || '',
            answer: feedback.answer || '',
            hasQAData: false,
            qaCount: 0
        };
    });
}

async function loadQAData() {
    try {
        console.log('💬 전역 Q&A 데이터 로드 시작');
        const data = await fetchConversations(30, 1000);
        globalQAData = data.conversations || [];
        allQAData = globalQAData;
        console.log('✅ 전역 Q&A 데이터 로드 완료:', globalQAData.length + '개');
        return globalQAData;
    } catch (error) {
        console.warn('⚠️ Q&A 데이터 로드 실패:', error);
        globalQAData = [];
        allQAData = [];
        return [];
    }
}

function calculateResponseRate(feedbackCount, qaCount) {
    if (qaCount === 0) return 0;
    return Math.round((feedbackCount / qaCount) * 100);
}

// ======================
// 데이터 새로고침 함수들 (🔧 Q&A 처리 수정)
// ======================
async function refreshData() {
    const days = parseInt(document.getElementById('daysSelect').value);
    try {
        document.getElementById('feedbackList').innerHTML = '<div class="loading">피드백 데이터를 불러오는 중...</div>';
        
        // 데이터 로드
        const [stats, qaData] = await Promise.all([
            fetchStats(days),
            globalQAData.length > 0 ? Promise.resolve({conversations: globalQAData}) : fetchConversations(days, 1000)
        ]);
        
        // Q&A 데이터 업데이트
        if (qaData.conversations) {
            allQAData = qaData.conversations;
        }
        
        // 응답률 계산
        const totalQA = allQAData.length;
        const responseRate = calculateResponseRate(stats.total_feedback, totalQA);
        
        // 통합 통계 객체 생성
        currentData = {
            stats: {
                ...stats,
                total_qa: totalQA,
                response_rate: responseRate
            },
            conversations: qaData
        };
        
        updateFeedbackStats(currentData.stats, currentData.conversations);
        updateFeedbackCharts(currentData, days);
        await loadFeedback(currentFeedbackFilter);
    } catch (error) {
        console.error('데이터 새로고침 실패:', error);
        showError('데이터를 불러오는 중 오류가 발생했습니다.');
    }
}

async function refreshConversationData() {
    const days = parseInt(document.getElementById('conversationDaysSelect').value);
    console.log('🔄 Q&A 데이터 새로고침 시작:', { days });
    
    try {
        const data = await fetchConversations(days, 100);
        console.log('📊 Q&A 새로고침 완료:', data);
        
        currentData = data;
        
        // 🔧 Q&A 통계 및 차트 업데이트 강제 실행
        updateConversationStats(data);
        updateConversationCharts(data);
        
        console.log('✅ Q&A 화면 업데이트 완료');
    } catch (error) {
        console.error('❌ Q&A 데이터 새로고침 실패:', error);
        showError('Q&A 데이터를 불러오는 중 오류가 발생했습니다.');
    }
}

// ======================
// 통계 업데이트 함수들 (🔧 Q&A 처리 수정)
// ======================
function updateFeedbackStats(stats, conversationData) {
    document.getElementById('totalFeedback').textContent = stats.total_feedback || 0;
    document.getElementById('positiveFeedback').textContent = stats.positive || 0;
    document.getElementById('negativeFeedback').textContent = stats.negative || 0;
    document.getElementById('uniqueUsers').textContent = stats.unique_users || 0;
    document.getElementById('satisfactionRate').textContent = (stats.satisfaction_rate || 0) + '%';
    
    // Q&A 관련 통계 업데이트
    document.getElementById('totalQA').textContent = stats.total_qa || 0;
    document.getElementById('responseRate').textContent = (stats.response_rate || 0) + '%';
    
    // 사용자 참여도 계산 및 표시
    const participationRate = stats.unique_users > 0 
        ? (stats.total_feedback / stats.unique_users).toFixed(2)
        : '0.00';
    
    const participationElement = document.getElementById('participationRate');
    if (participationElement) {
        participationElement.textContent = participationRate + '회';
    }
}

function updateConversationStats(conversationData) {
    console.log('📊 Q&A 통계 업데이트 시작:', conversationData);
    
    // 🔧 안전한 데이터 접근
    const stats = conversationData?.stats || {};
    const matchDistribution = stats?.match_distribution || {};
    const conversations = conversationData?.conversations || [];
    
    console.log('📊 Q&A 통계 세부정보:', {
        total_conversations: conversations.length,
        unique_sessions: stats.unique_sessions,
        match_distribution: matchDistribution,
        stats_object: stats
    });
    
    // 🔧 각 통계 업데이트를 개별적으로 처리
    const totalConversations = stats.unique_sessions || 0;
    const matchGood = matchDistribution.good || 0;
    const matchBad = matchDistribution.bad || 0;
    const matchImprove = matchDistribution.improve || 0;
    const matchNone = matchDistribution.none || 0;
    
    console.log('📊 업데이트할 수치들:', {
        totalConversations,
        matchGood,
        matchBad,
        matchImprove,
        matchNone
    });
    
    // DOM 업데이트
    const totalConversationsEl = document.getElementById('totalConversations');
    const matchGoodEl = document.getElementById('matchGood');
    const matchBadEl = document.getElementById('matchBad');
    const matchImproveEl = document.getElementById('matchImprove');
    const matchNoneEl = document.getElementById('matchNone');
    
    if (totalConversationsEl) {
        totalConversationsEl.textContent = totalConversations;
        console.log('✅ totalConversations 업데이트:', totalConversations);
    } else {
        console.warn('⚠️ totalConversations 엘리먼트를 찾을 수 없음');
    }
    
    if (matchGoodEl) {
        matchGoodEl.textContent = matchGood;
        console.log('✅ matchGood 업데이트:', matchGood);
    } else {
        console.warn('⚠️ matchGood 엘리먼트를 찾을 수 없음');
    }
    
    if (matchBadEl) {
        matchBadEl.textContent = matchBad;
        console.log('✅ matchBad 업데이트:', matchBad);
    } else {
        console.warn('⚠️ matchBad 엘리먼트를 찾을 수 없음');
    }
    
    if (matchImproveEl) {
        matchImproveEl.textContent = matchImprove;
        console.log('✅ matchImprove 업데이트:', matchImprove);
    } else {
        console.warn('⚠️ matchImprove 엘리먼트를 찾을 수 없음');
    }
    
    if (matchNoneEl) {
        matchNoneEl.textContent = matchNone;
        console.log('✅ matchNone 업데이트:', matchNone);
    } else {
        console.warn('⚠️ matchNone 엘리먼트를 찾을 수 없음');
    }
    
    console.log('📊 Q&A 통계 업데이트 완료');
}

// ======================
// 차트 업데이트 함수들
// ======================
function updateFeedbackCharts(data, days) {
    const stats = data.stats;
    
    // 기존 차트 파괴
    if (charts.trendChart) charts.trendChart.destroy();
    if (charts.avgChart) charts.avgChart.destroy();
    if (charts.responseRateChart) charts.responseRateChart.destroy();

    // 시간별 피드백 추이 차트
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    const trendLabels = generateTimeLabels(days);
    const trendData = generateTrendData(stats, days);

    charts.trendChart = new Chart(trendCtx, {
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
    charts.avgChart = new Chart(avgCtx, {
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

    // 응답률 추이 차트
    const responseCtx = document.getElementById('responseRateChart').getContext('2d');
    const responseRateData = generateResponseRateData(allFeedbackData, allQAData, days);
    
    charts.responseRateChart = new Chart(responseCtx, {
        type: 'bar',
        data: {
            labels: trendLabels,
            datasets: [{
                label: '피드백 응답률 (%)',
                data: responseRateData,
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
                    max: 100,
                    ticks: {
                        stepSize: 10,
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
}

function updateConversationCharts(conversationData) {
    console.log('📈 Q&A 차트 업데이트 시작:', conversationData);
    
    const conversations = conversationData.conversations || [];
    const stats = conversationData.stats || {};
    
    // 매치 상태 분포 차트 (세션 기준)
    if (charts.matchStatusChart) {
        charts.matchStatusChart.destroy();
        console.log('🗑️ 기존 matchStatusChart 제거');
    }
    
    const matchCtx = document.getElementById('matchStatusChart');
    if (!matchCtx) {
        console.error('❌ matchStatusChart 캔버스를 찾을 수 없음');
        return;
    }
    
    const matchData = stats.match_distribution || { good: 0, bad: 0, improve: 0, none: 0 };
    console.log('📊 매치 분포 데이터:', matchData);
    
    charts.matchStatusChart = new Chart(matchCtx.getContext('2d'), {
        type: 'pie',
        data: {
            labels: ['✅ 매치', '❌ 매치안됨', '⚠️ 보강필요', '❓ 미평가'],
            datasets: [{
                data: [
                    matchData.good || 0,
                    matchData.bad || 0,
                    matchData.improve || 0,
                    matchData.none || 0
                ],
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
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                            return label + ': ' + value + '명 (' + percentage + '%)';
                        }
                    }
                }
            }
        }
    });
    console.log('✅ matchStatusChart 생성 완료');

    // 요일별 Q&A 추이 차트
    if (charts.qaTimeChart) {
        charts.qaTimeChart.destroy();
        console.log('🗑️ 기존 qaTimeChart 제거');
    }
    
    const timeCtx = document.getElementById('qaTimeChart');
    if (!timeCtx) {
        console.error('❌ qaTimeChart 캔버스를 찾을 수 없음');
        return;
    }
    
    const weeklyData = [0, 0, 0, 0, 0, 0, 0]; // 월-일
    
    conversations.forEach(conv => {
        if (conv.timestamp) {
            try {
                const date = new Date(conv.timestamp);
                const dayOfWeek = date.getDay(); // 0=일요일, 1=월요일, ...
                const mappedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 월요일=0, 일요일=6
                if (mappedDay >= 0 && mappedDay < 7) {
                    weeklyData[mappedDay]++;
                }
            } catch (e) {
                console.warn('날짜 파싱 오류:', conv.timestamp);
            }
        }
    });
    
    console.log('📊 요일별 데이터:', weeklyData);
    
    charts.qaTimeChart = new Chart(timeCtx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['월', '화', '수', '목', '금', '토', '일'],
            datasets: [{
                label: '사용자 수',
                data: weeklyData,
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
    console.log('✅ qaTimeChart 생성 완료');
    console.log('📈 Q&A 차트 업데이트 완료');
}

// ======================
// 헬퍼 함수들
// ======================
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

function generateResponseRateData(feedbackData, qaData, days) {
    const responseRates = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() - i);
        const dateStr = targetDate.toDateString();
        
        // 해당 날짜의 피드백과 Q&A 수 계산
        const dayFeedback = feedbackData.filter(fb => {
            const fbDate = new Date(fb.timestamp);
            return fbDate.toDateString() === dateStr;
        }).length;
        
        const dayQA = qaData.filter(qa => {
            const qaDate = new Date(qa.timestamp);
            return qaDate.toDateString() === dateStr;
        }).length;
        
        const responseRate = calculateResponseRate(dayFeedback, dayQA);
        responseRates.push(responseRate);
    }
    
    return responseRates;
}

// ======================
// 피드백 관련 함수들
// ======================
async function loadFeedback(type) {
    type = type || 'all';
    currentFeedbackFilter = type;
    
    // 필터 버튼 활성화 상태 업데이트
    document.querySelectorAll('.data-filters button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(type === 'all' ? 'allBtn' : type + 'Btn').classList.add('active');

    // 로딩 표시
    document.getElementById('feedbackList').innerHTML = '<div class="loading">피드백 데이터를 불러오는 중...</div>';

    const limit = parseInt(document.getElementById('limitSelect').value);
    
    try {
        // Load feedback and QA data simultaneously
        const [feedbackData, qaData] = await Promise.all([
            fetchFeedback(limit, type),
            globalQAData.length > 0 ? Promise.resolve(globalQAData) : loadQAData()
        ]);
        
        console.log('📊 피드백 데이터 로드 결과:', {
            filter_type: type,
            feedback_count: feedbackData.feedback?.length || 0,
            qa_count: qaData.length
        });
        
        // Enrich feedback data with QA data
        const enrichedFeedback = enrichFeedbackWithQA(feedbackData.feedback || [], qaData);
        
        allFeedbackData = enrichedFeedback;
        displayFeedback(enrichedFeedback);
    } catch (error) {
        console.error('피드백 로드 실패:', error);
        showError('피드백 데이터를 불러오는 중 오류가 발생했습니다.');
    }
}

function displayFeedback(feedbackList) {
    const container = document.getElementById('feedbackList');
    const countElement = document.getElementById('feedbackCount');
    
    console.log('🖥️ 피드백 표시:', {
        count: feedbackList.length,
        filter: currentFeedbackFilter
    });
    
    countElement.textContent = feedbackList.length + '개';
    
    if (feedbackList.length === 0) {
        container.innerHTML = '<div class="error">표시할 피드백이 없습니다.<br><small>필터: ' + currentFeedbackFilter + '</small></div>';
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
        
        // Q&A connection status display
        let qaStatus = '';
        if (feedback.hasQAData) {
            qaStatus = '<span style="color: #28a745; font-weight: 600;">✓ Q&A 연결됨 (' + feedback.qaCount + '건)</span>';
        } else {
            qaStatus = '<span style="color: #dc3545;">○ Q&A 미연결</span>';
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
        
        return '<div class="data-item ' + typeClass + '">' +
            '<div class="data-meta">' +
                '<div style="display: flex; align-items: center; gap: 10px;">' +
                    '<span class="data-type ' + typeClass + '">' + typeText + '</span>' +
                    matchStatusText +
                '</div>' +
                '<span>' + date + '</span>' +
            '</div>' +
            '<div class="data-content">' +
                '<div class="question">❓ ' + (feedback.question || '질문 정보 없음') + '</div>' +
                '<div class="answer ' + (index < 5 ? '' : 'collapsed') + '" id="answer_' + index + '">' +
                    (feedback.answer || '답변 정보 없음') +
                '</div>' +
                (feedback.answer && feedback.answer.length > 200 ? 
                    '<button class="expand-toggle" onclick="toggleAnswer(' + index + ')">' +
                        '<span id="toggle_text_' + index + '">' + (index < 5 ? '접기' : '더보기') + '</span>' +
                    '</button>' : ''
                ) +
            '</div>' +
            '<div class="data-details">' +
                '💬 Chat ID: ' + (feedback.chat_id || feedback.feedback || 'unknown') + ' | ' +
                '🌐 IP: ' + (feedback.client_ip || 'unknown') + ' | ' +
                '🆔 피드백 ID: ' + (feedback.feedback_id || 'unknown') + ' | ' +
                '📊 타입: ' + (feedback.feedback || 'unknown') + ' | ' +
                qaStatus +
                (feedback.qa_id ? ' | 🔗 Q&A ID: ' + feedback.qa_id : '') +
            '</div>' +
        '</div>';
    }).join('');
    
    container.innerHTML = html;
}

// 답변 토글 함수
function toggleAnswer(index) {
    const answer = document.getElementById('answer_' + index);
    const toggleText = document.getElementById('toggle_text_' + index);
    
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

// ======================
// 이벤트 리스너 및 초기화
// ======================
async function initializeDashboard() {
    console.log('🚀 대시보드 초기화 시작');
    
    const isConnected = await testApiConnection();
    
    if (isConnected) {
        // Load QA data first, then load feedback data
        console.log('🔄 초기 Q&A 데이터 로드 시작');
        await loadQAData();
        console.log('🔄 초기 피드백 데이터 로드 시작');
        await refreshData();
        console.log('✅ 대시보드 초기화 완료');
    } else {
        console.warn('⚠️ API 연결 실패 - 오프라인 모드');
        showError('API 서버에 연결할 수 없습니다. 서버 상태를 확인해주세요.');
    }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', initializeDashboard);

// 이벤트 리스너 등록
document.getElementById('limitSelect').addEventListener('change', function() {
    loadFeedback(currentFeedbackFilter);
});
document.getElementById('daysSelect').addEventListener('change', refreshData);
document.getElementById('conversationDaysSelect').addEventListener('change', function() {
    console.log('🔄 Q&A 기간 변경 - 새로고침 시작');
    refreshConversationData();
});

// 키보드 단축키 (Ctrl+R로 새로고침)
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab.id === 'feedbackContent') {
            refreshData();
        } else {
            console.log('🔄 Ctrl+R로 Q&A 새로고침');
            refreshConversationData();
        }
    }
});

console.log('🚀 투어비스 고객센터 에이전트 대시보드 스크립트 로드 완료');
