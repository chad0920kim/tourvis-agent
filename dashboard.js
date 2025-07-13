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
    try {
        const response = await fetch(API_BASE_URL + '/api/qa/conversations?days=' + days + '&limit=' + limit, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(10000)
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Q&A 데이터 수신:', data);
            return data;
        }
    } catch (error) {
        console.warn('⚠️ Q&A 요청 실패:', error.message);
    }

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
