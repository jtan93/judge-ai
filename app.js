// ============================================================
// 🔧 [관리자 설정] 서비스 운영을 위한 기본 키 설정
// ============================================================
const DEFAULT_GEMINI_API_KEY = 'AIzaSyAhY9r1gGZXbsCea9f0RRlFvTRmdMkoX4g';
const DEFAULT_FIREBASE_CONFIG = {
    apiKey: "AIzaSyDmnHwcyGhUf-vIMSoFa7pdPTdViyypVZw",
    authDomain: "my-fist-anti.firebaseapp.com",
    projectId: "my-fist-anti",
    storageBucket: "my-fist-anti.firebasestorage.app",
    messagingSenderId: "963114529490",
    appId: "1:963114529490:web:37ee2457290ead9fb1730b"
};
// ============================================================

// --- Firebase Configuration (localStorage 우선, 없으면 기본값 사용) ---
let firebaseConfig = null;
try {
    const savedConfig = localStorage.getItem('firebase_config');
    if (savedConfig) {
        firebaseConfig = JSON.parse(savedConfig);
    }
} catch (e) { /* 무시 */ }

// localStorage에 없으면 기본값 사용
if (!firebaseConfig && DEFAULT_FIREBASE_CONFIG && DEFAULT_FIREBASE_CONFIG.apiKey) {
    firebaseConfig = DEFAULT_FIREBASE_CONFIG;
}

// Initialize Firebase (Compat)
let db = null;
let serverTimestamp = null;
let increment = null;

function initializeFirebaseApp(config) {
    if (!config) return false;
    try {
        if (firebase.apps.length > 0) {
            firebase.app().delete();
        }
        firebase.initializeApp(config);
        db = firebase.firestore();
        serverTimestamp = firebase.firestore.FieldValue.serverTimestamp;
        increment = firebase.firestore.FieldValue.increment;
        console.log("✅ Firebase가 초기화되었습니다.");
        return true;
    } catch (e) {
        console.error("❌ Firebase 초기화 오류:", e);
        return false;
    }
}

// 초기 실행 시 시도
if (firebaseConfig) {
    initializeFirebaseApp(firebaseConfig);
}

document.addEventListener('DOMContentLoaded', () => {
    const apiKeyBtn = document.getElementById('api-key-btn');
    const apiModal = document.getElementById('api-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const saveKeyBtn = document.getElementById('save-key-btn');
    const apiKeyInput = document.getElementById('api-key-input');
    const firebaseConfigInput = document.getElementById('firebase-config-input');
    
    const submitBtn = document.getElementById('submit-btn');
    const conflictText = document.getElementById('conflict-text');
    const resultOverlay = document.getElementById('result-overlay');
    const resultCardContainer = document.getElementById('result-card-container');
    const closeResultBtn = document.getElementById('close-result-btn');
    const judgmentText = document.getElementById('judgment-text');
    const currentDateSpan = document.getElementById('current-date');
    const scrollTopBtn = document.getElementById('scroll-top-btn');
    const retryBtn = document.getElementById('retry-btn');

    // UI Sections within the card
    const shareSection = document.getElementById('share-section');
    const voteSection = document.getElementById('vote-section');
    const resetSection = document.getElementById('reset-section');

    // Core UI elements
    const topicBtns = document.querySelectorAll('.topic-btn');
    const voteABtn = document.getElementById('vote-a-btn');
    const voteBBtn = document.getElementById('vote-b-btn');
    const countA = document.getElementById('count-a');
    const countB = document.getElementById('count-b');
    const totalParticipants = document.getElementById('participant-count');
    const mockFeedContainer = document.getElementById('mock-feed-container');
    const cardNewsContainer = document.getElementById('card-news-container');

    // Loading elements
    const hammerOverlay = document.getElementById('hammer-overlay');
    const scanStatusText = document.getElementById('scan-status-text');

    // Share buttons (Missing in previous update)
    const copyLinkBtn = document.getElementById('copy-link-btn');
    const kakaoShareBtn = document.getElementById('kakao-share-btn');

    // State
    let currentVotes = { A: 0, B: 0 };
    let hasVoted = false;
    let baseParticipants = Math.floor(Math.random() * 5000) + 3000;
    let lastSelectedModel = null;
    let currentConcernId = null; // 현재 열린 판결문의 Firestore 문서 ID 저장

    // Initialize - Safe Check
    if (totalParticipants) {
        totalParticipants.textContent = baseParticipants.toLocaleString();
    }

    if (mockFeedContainer) {
        // renderMockFeeds() 대신 하단에서 listenRecentConcerns()가 호출됩니다.
    }

    // 0. Hot Topics logic
    topicBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            conflictText.value = btn.getAttribute('data-topic');
            conflictText.style.transition = "background-color 0.3s ease";
            conflictText.style.backgroundColor = "rgba(216, 198, 237, 0.3)";
            setTimeout(() => {
                conflictText.style.backgroundColor = "transparent";
            }, 500);
        });
    });

    // 1. Unified Settings Management (Gemini & Firebase)
    // localStorage에 값이 있으면 그것을 사용, 없으면 코드에 내장된 기본값 사용
    let geminiApiKey = localStorage.getItem('gemini_api_key') || DEFAULT_GEMINI_API_KEY || '';
    
    // UI 초기 상태 반영 (설정 버튼은 숨김 처리 - 로고 5번 클릭으로만 접근)
    if (apiKeyBtn) apiKeyBtn.style.display = 'none'; // 일반 사용자에게 설정 버튼 감추기
    if (geminiApiKey && apiKeyInput) {
        apiKeyInput.value = geminiApiKey;
    }
    const savedFirebase = localStorage.getItem('firebase_config');
    if (savedFirebase && firebaseConfigInput) {
        firebaseConfigInput.value = savedFirebase;
    }

    apiKeyBtn.addEventListener('click', () => {
        apiModal.classList.remove('hidden');
    });

    // --- NEW: 히든 트리거 (로고 5번 클릭) ---
    const mainLogo = document.getElementById('main-logo');
    let logoClickCount = 0;
    let logoClickTimer = null;

    if (mainLogo) {
        mainLogo.addEventListener('click', () => {
            logoClickCount++;
            clearTimeout(logoClickTimer);
            
            if (logoClickCount >= 5) {
                apiModal.classList.remove('hidden');
                logoClickCount = 0;
                console.log("🔓 [보안] 관리자 모드 진입 성공");
            } else {
                logoClickTimer = setTimeout(() => {
                    logoClickCount = 0;
                }, 1000); // 1초 내에 5번 클릭해야 함
            }
        });
    }

    closeModalBtn.addEventListener('click', () => {
        apiModal.classList.add('hidden');
    });

    saveKeyBtn.addEventListener('click', () => {
        const geminiKey = apiKeyInput.value.trim();
        let firebaseRaw = firebaseConfigInput.value.trim();
        
        let success = true;

        // Gemini Key Save
        if (geminiKey) {
            localStorage.setItem('gemini_api_key', geminiKey);
            geminiApiKey = geminiKey;
        }

        // Firebase Config Save (유연한 파싱 적용)
        if (firebaseRaw) {
            try {
                // 사용자가 const firebaseConfig = { ... } 전체를 붙여넣었을 경우 중괄호 부분만 추출 시도
                if (firebaseRaw.includes('{') && firebaseRaw.includes('}')) {
                    const match = firebaseRaw.match(/\{[\s\S]*\}/);
                    if (match) {
                        firebaseRaw = match[0];
                    }
                }

                // JSON인지 확인하기 위해 시도 (작은따옴표 등을 큰따옴표로 변환하는 등의 처리는 위험하므로 eval 대신 안전한 방식 고민)
                // 단순히 eval을 쓰는 것은 보안상 좋지 않으나, 로컬 설정 입력창이므로 사용 편의성을 위해 Function 생성자 활용 (JSON.parse보다 유연)
                const configObject = new Function(`return ${firebaseRaw}`)();
                
                if (configObject && typeof configObject === 'object') {
                    localStorage.setItem('firebase_config', JSON.stringify(configObject));
                    console.log("✅ [보안] Firebase 설정이 브라우저에 저장되었습니다.");
                } else {
                    throw new Error("Invalid Object");
                }
            } catch (e) {
                alert('Firebase 설정 형식이 올바르지 않습니다.\n\n{ "apiKey": "..." } 와 같은 JSON 형태이거나, Firebase 콘솔에서 복사한 객체 내용이어야 합니다.');
                success = false;
            }
        }

        if (success) {
            alert('모든 설정이 안전하게 저장되었습니다! 설정을 반영하기 위해 페이지를 새로고침합니다.');
            location.reload();
        }
    });

    window.addEventListener('click', (e) => {
        if (e.target === apiModal) {
            apiModal.classList.add('hidden');
        }
    });

    // 2. Submit Action, Animations & API Call
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            const text = conflictText ? conflictText.value.trim() : '';

            if (!text) {
                alert('판결할 사건의 전말을 먼저 입력해주세요.');
                return;
            }

            if (!geminiApiKey || geminiApiKey === 'YOUR_GEMINI_API_KEY_HERE') {
                alert('서비스 준비 중입니다. 잠시 후 다시 시도해 주세요.');
                return;
            }

            // UI 초기화 및 로딩 시작
            submitBtn.disabled = true;
            document.body.classList.add('animating');
            const initialOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";

            if (hammerOverlay) {
                hammerOverlay.classList.remove('hidden');
                hammerOverlay.style.opacity = '1';
                if (scanStatusText) scanStatusText.textContent = "AI 판사가 다툼을 분석하고 있습니다...";
            }

            if (resultOverlay) resultOverlay.classList.add('hidden');
            if (judgmentText) {
                judgmentText.innerHTML = '<p class="loading-msg">⚖️ AI 판사가 사건을 구성하고 있습니다...</p>';
                judgmentText.classList.add('streaming'); 
            }

            // 투표 및 UI 상태 초기화
            hasVoted = false;
            currentVotes = { A: 0, B: 0 };
            if (countA) countA.textContent = "0";
            if (countB) countB.textContent = "0";
            if (cardNewsContainer) cardNewsContainer.classList.remove('slide-up-visible');
            if (shareSection) shareSection.classList.remove('slide-up-visible');
            if (voteSection) voteSection.classList.remove('slide-up-visible');
            if (resetSection) resetSection.classList.remove('slide-up-visible');

            const today = new Date();
            const options = { year: 'numeric', month: 'short', day: 'numeric' };
            if (currentDateSpan) {
                currentDateSpan.textContent = today.toLocaleDateString('en-US', options).toUpperCase();
            }

            // --- 스트리밍 판결 시작 ---
            let fullText = "";
            let hasTextBeenRendered = false;

            try {
                const urlResult = await getGeminiUrl(geminiApiKey);
                const streamUrl = urlResult.replace(':generateContent', ':streamGenerateContent');
                const prompt = `당신은 공정하고 위트있는 '인공지능 판사'입니다. 다음 형식을 지켜서 답변해주세요: **[사건 요약]**, **[판사 AI의 시선]**, **[최종 판결]**, **[처방 및 권고조치]**. 사용자 입력: "${text}"`;

                console.log("🚀 [Gemini] 스트리밍 판결 요청 중...");
                
                const response = await fetch(streamUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });

                if (!response.ok) {
                    const errorJson = await response.json().catch(() => ({}));
                    throw new Error(errorJson.error?.message || 'API 키가 올바르지 않거나 네트워크 오류가 발생했습니다.');
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";

                // 로딩 창 닫고 결과 창 열기 준비
                await new Promise(r => setTimeout(r, 1200));
                if (hammerOverlay) hammerOverlay.style.opacity = '0';
                
                setTimeout(() => {
                    if (hammerOverlay) hammerOverlay.classList.add('hidden');
                    if (resultOverlay) {
                        resultOverlay.classList.remove('hidden');
                        setTimeout(() => cardNewsContainer?.classList.add('slide-up-visible'), 50);
                    }
                }, 400);

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    buffer += chunk;
                    
                    // 더 유연한 JSON 객체 추출 로직
                    let braceIdx;
                    while ((braceIdx = buffer.indexOf('{')) !== -1) {
                        let openBraces = 0;
                        let endIdx = -1;

                        for (let i = braceIdx; i < buffer.length; i++) {
                            if (buffer[i] === '{') openBraces++;
                            else if (buffer[i] === '}') openBraces--;
                            if (openBraces === 0) {
                                endIdx = i;
                                break;
                            }
                        }

                        if (endIdx !== -1) {
                            const jsonStr = buffer.substring(braceIdx, endIdx + 1);
                            buffer = buffer.substring(endIdx + 1);

                            try {
                                const json = JSON.parse(jsonStr);
                                const chunkText = json.candidates?.[0]?.content?.parts?.[0]?.text;
                                if (chunkText) {
                                    fullText += chunkText;
                                    if (judgmentText) {
                                        // 첫 텍스트가 들어오면 로딩 메시지 제거
                                        if (!hasTextBeenRendered) {
                                            judgmentText.innerHTML = '';
                                            hasTextBeenRendered = true;
                                        }
                                        judgmentText.innerHTML = formatResponse(fullText);
                                        console.log("📝 [Gemini] Chunk 수신:", chunkText.substring(0, 10) + "...");
                                    }
                                }
                            } catch (e) {
                                // JSON 형식이 아니면(예: [ 또는 ,) 그냥 넘어감
                            }
                        } else {
                            break; 
                        }
                    }
                }

                if (!fullText) {
                    throw new Error("AI가 판결 내용을 생성하지 못했습니다. 다시 시도해 주세요.");
                }

                console.log("✅ [Gemini] 스트리밍 완료. 최종 저장 중...");
                
                // UI 마무리
                if (judgmentText) judgmentText.classList.remove('streaming');
                setTimeout(() => voteSection?.classList.add('slide-up-visible'), 200);
                setTimeout(() => shareSection?.classList.add('slide-up-visible'), 400);
                setTimeout(() => resetSection?.classList.add('slide-up-visible'), 600);

                // --- 백그라운드 저장 ---
                if (db && fullText) {
                    try {
                        const docRef = await db.collection("concerns").add({
                            text: text,
                            judgment: fullText,
                            totalVotes: 0,
                            votesA: 0,
                            votesB: 0,
                            category: "법률/윤리",
                            createdAt: serverTimestamp()
                        });
                        currentConcernId = docRef.id;
                        console.log("✅ [Firestore] 저장 완료 (ID:", currentConcernId, ")");
                    } catch (dbErr) {
                        console.warn("⚠️ [Firestore] 저장 실패 (API가 비활성화되어 있을 수 있습니다):", dbErr);
                    }
                }

            } catch (err) {
                console.error("Streaming Error:", err);
                hasError = true;
                if (hammerOverlay) hammerOverlay.classList.add('hidden');
                if (resultOverlay) resultOverlay.classList.remove('hidden');
                judgmentText.innerHTML = `<p style="color: #c0392b; font-weight: bold;">판결 중 오류 발생</p><p>${err.message}</p>`;
            } finally {
                submitBtn.disabled = false;
            }
        });
    }

    // Helper: 모델 찾기 및 URL 생성 (기존 getGeminiJudgment 로직 분리)
    async function getGeminiUrl(apiKey) {
        let modelToUse = lastSelectedModel;
        if (!modelToUse) {
            try {
                const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
                if (listResponse.ok) {
                    const listData = await listResponse.json();
                    const validModels = listData.models.filter(m => m.supportedGenerationMethods.includes('generateContent') && m.name.includes('gemini'));
                    if (validModels.length > 0) {
                        const pref = ['1.5-flash', '1.5-pro', '10-pro'];
                        let bestMatch = validModels[0];
                        for (const p of pref) {
                            const found = validModels.find(m => m.name.includes(p));
                            if (found) { bestMatch = found; break; }
                        }
                        modelToUse = bestMatch.name;
                        lastSelectedModel = modelToUse;
                    }
                }
            } catch (e) { console.warn("모델 조회 실패", e); }
        }
        modelToUse = modelToUse || 'models/gemini-1.5-flash';
        return `https://generativelanguage.googleapis.com/v1/${modelToUse}:generateContent?key=${apiKey}`;
    }

    // 2.5 Close Result Modal
    const closeResultModal = () => {
        resultOverlay.classList.add('hidden');
        document.body.classList.remove('animating');
        document.body.style.overflow = 'auto'; // Restore scroll
    };

    if (retryBtn) retryBtn.addEventListener('click', closeResultModal);
    if (closeResultBtn) closeResultBtn.addEventListener('click', closeResultModal);

    // Close on overlay click
    if (resultOverlay) {
        resultOverlay.addEventListener('click', (e) => {
            if (e.target === resultOverlay) closeResultModal();
        });
    }


    // 3. Voting Logic (v2: Firestore Sync - Compat)
    async function handleVote(docId, type) {
        if (hasVoted || !db || !docId) return;
        
        hasVoted = true;
        
        try {
            await db.collection("concerns").doc(docId).update({
                [type === 'A' ? 'votesA' : 'votesB']: increment(1)
            });
            alert('소중한 투표 의견이 실시간으로 기록되었습니다!');
            
            // UI 피드백
            if (voteABtn && voteBBtn) {
                voteABtn.style.opacity = type === 'A' ? "1" : "0.5";
                voteBBtn.style.opacity = type === 'B' ? "1" : "0.5";
                voteABtn.style.pointerEvents = "none";
                voteBBtn.style.pointerEvents = "none";
            }
        } catch (e) {
            console.error("❌ [Firestore] 투표 반영 실패:", e);
            alert('투표 처리 중 오류가 발생했습니다.');
            hasVoted = false;
        }
    }

    // 현재 판결문 모달의 투표 버튼 리스너
    if (voteABtn) voteABtn.addEventListener('click', () => handleVote(currentConcernId, 'A'));
    if (voteBBtn) voteBBtn.addEventListener('click', () => handleVote(currentConcernId, 'B'));

    // 4. Share Actions
    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(window.location.href).then(() => {
                const originalText = copyLinkBtn.innerHTML;
                copyLinkBtn.innerHTML = '✅ 복사 완료!';
                setTimeout(() => { copyLinkBtn.innerHTML = originalText; }, 2000);
            });
        });
    }

    if (kakaoShareBtn) {
        kakaoShareBtn.addEventListener('click', () => {
            alert('카카오톡 공유 API가 연결되면 이 판결문이 카카오톡으로 전송됩니다!\n(현재는 데모 버전입니다.)');
        });
    }

    /**
     * [스마트 타이핑 효과] - 성능 최적화 버전
     * HTML 태그는 즉시 해석하고 텍스트만 한 글자씩 출력.
     * 렉을 유발하는 강제 스크롤 연산을 제거했습니다.
     */
    async function typeWriterEffect(element, html) {
        element.innerHTML = "";
        let isTag = false;
        let text = "";

        for (let i = 0; i < html.length; i++) {
            const char = html[i];

            if (char === "<") isTag = true;

            if (isTag) {
                text += char;
                if (char === ">") {
                    isTag = false;
                    element.innerHTML = text;
                }
            } else {
                text += char;
                element.innerHTML = text;
                // 매번 스크롤하지 않고 자연스럽게 텍스트만 추가 (렉 제거)
                await new Promise(r => setTimeout(r, 15 + Math.random() * 15));
            }
        }
    }

    // let cachedModel = null; // [삭제] 모델 리스트를 조회하지 않으므로 더 이상 필요하지 않습니다.



    function formatResponse(text) {
        let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.split('\n').filter(line => line.trim() !== '').map(line => `<p>${line}</p>`).join('');
        return formatted;
    }


    scrollTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // 6. Firestore Real-time Feed (Replacing renderMockFeeds - Compat)
    function listenRecentConcerns() {
        if (!mockFeedContainer) return;

        // Firebase가 설정되지 않은 경우 안내 메시지 표시
        if (!db) {
            mockFeedContainer.innerHTML = `
                <div class="empty-feed" style="border-color: #ff9f43; background: rgba(255, 159, 67, 0.05);">
                    <p style="font-size: 1.2rem; margin-bottom: 10px;">📉 실시간 피드 미연동 상태</p>
                    <p style="font-size: 0.9rem; font-weight: 400;">프로젝트를 공유하거나 배포하기 전, <b>비밀 설정(로고 5번 클릭)</b>을 통해 <br>Firebase Config를 입력하면 진짜 다른 사람들의 고민이 나타납니다!</p>
                </div>
            `;
            return;
        }

        db.collection("concerns")
          .orderBy("createdAt", "desc")
          .limit(5)
          .onSnapshot((snapshot) => {
            mockFeedContainer.innerHTML = '';
            
            if (snapshot.empty) {
                mockFeedContainer.innerHTML = '<div class="empty-feed">아직 등록된 고민이 없습니다. 첫 번째 고민의 주인공이 되어보세요!</div>';
                return;
            }

            snapshot.forEach((doc) => {
                const data = doc.data();
                const card = document.createElement('div');
                card.className = 'feed-card';
                
                const votesA = data.votesA || 0;
                const votesB = data.votesB || 0;
                const total = votesA + votesB;
                const aPercent = total > 0 ? Math.round((votesA / total) * 100) : 50;
                const bPercent = total > 0 ? 100 - aPercent : 50;

                card.innerHTML = `
                    <span class="feed-badge">${data.category || '사연 맛보기'}</span>
                    <div class="feed-text">"${data.text}"</div>
                    <div class="feed-stats">
                        <span title="투표수">🗳 ${total.toLocaleString()}</span>
                        <span style="margin-left:auto; color: ${votesA >= votesB ? '#FF3B30' : '#007AFF'}">
                            여론: A ${aPercent}% vs B ${bPercent}%
                        </span>
                    </div>
                `;
                
                card.addEventListener('click', () => {
                    conflictText.value = data.text;
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    conflictText.style.transition = "background-color 0.3s ease";
                    conflictText.style.backgroundColor = "rgba(216, 198, 237, 0.3)";
                    setTimeout(() => { conflictText.style.backgroundColor = "transparent"; }, 500);
                });

                mockFeedContainer.appendChild(card);
            });
        }, (error) => {
            console.error("❌ [Firestore] 피드 구독 중 오류:", error);
            mockFeedContainer.innerHTML = '<div class="empty-feed">데이터를 불러오는 중 오류가 발생했습니다. 보안 규칙을 확인해 주세요.</div>';
        });
    }

    // Replace initialization calls
    if (mockFeedContainer) {
        listenRecentConcerns();
    }

    // 7. Partnership Modal Logic
    const partnershipModal = document.getElementById('partnership-modal');
    const partnershipOpenBtn = document.getElementById('partnership-open-btn');
    const closePartnershipBtn = document.getElementById('close-partnership-modal');
    const partnershipForm = document.getElementById('partnership-form');

    partnershipOpenBtn.addEventListener('click', () => {
        partnershipModal.classList.remove('hidden');
    });

    closePartnershipBtn.addEventListener('click', () => {
        partnershipModal.classList.add('hidden');
    });

    window.addEventListener('click', (e) => {
        if (e.target === partnershipModal) {
            partnershipModal.classList.add('hidden');
        }
    });

    // Optional: add a small thank you alert or handle submission via JS if preferred, 
    // but here we let the form submit normally to the Formspree endpoint.
    if (partnershipForm) {
        partnershipForm.addEventListener('submit', () => {
            // Just a small visual hint before the redirect
            const btn = partnershipForm.querySelector('.send-btn');
            btn.textContent = '전송 중...';
            btn.disabled = true;
        });
    }
});
