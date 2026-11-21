/* 쉐어메이트 – 대여 · 물물교환 앱 (순수 JS, 의존성 없음 + 오픈뱅킹 간편송금) */
(() => {
  'use strict';

  /* ---------- 유틸 ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const won = n => Number(n || 0).toLocaleString('ko-KR') + '원';
  const view = $('#view'), layer = $('#layer'), toastEl = $('#toast'), onbEl = $('#onb');
  const ORG_CODE = 'M202603077'; // 금융결제원 이용기관코드

  function ago(ts) {
    const m = Math.max(0, Math.floor((Date.now() - ts) / 60000));
    if (m < 1) return '방금 전';
    if (m < 60) return m + '분 전';
    if (m < 1440) return Math.floor(m / 60) + '시간 전';
    return Math.floor(m / 1440) + '일 전';
  }
  function clock(ts) { const d = new Date(ts); return `${d.getHours() < 12 ? '오전' : '오후'} ${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`; }
  const inDays = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

  /* ---------- 백엔드 / 위치 / 날짜 / 리뷰 도우미 ---------- */
  const BE = window.BE || { enabled: false, items: [], rooms: [], reviews: [], roomCache: {} };
  const LOCAL = { user: null };
  const me = () => BE.enabled ? (BE.user || null) : LOCAL.user;
  const myName = () => (me() && me().name) || '나';
  const rad = x => x * Math.PI / 180;
  const hav = (a, b, c, d) => { const dl = rad(c - a), dn = rad(d - b), x = Math.sin(dl / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(dn / 2) ** 2; return 2 * 6371 * Math.asin(Math.sqrt(x)); };
  const distOf = it => (S.pos && it.lat != null && it.lng != null) ? Math.round(hav(S.pos.lat, S.pos.lng, it.lat, it.lng) * 10) / 10 : (it.dist ?? null);
  const lymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return lymd(d); };
  const dLeft = s => Math.round((new Date(s + 'T00:00:00') - new Date(lymd(new Date()) + 'T00:00:00')) / 864e5);
  let MUT = new Map(), unwatch = null, calOff = 0, loginMode = 'in', revStar = 5;
  const sKey = it => it.uid || it.seller;
  /* 같은 사람은 어디서든 같은 아이콘 (uid 또는 닉네임으로 고정) */
  const AV_E = ['🐶', '🐱', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐸', '🐵', '🐰', '🐹'];
  const AV_BG = ['#FFE3E3', '#FFF0D6', '#FFF9DB', '#E6F7E0', '#DDF3F6', '#E3E9FF', '#F0E4FF', '#FFE4F1'];
  const hashStr = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const avOf = key => { const h = hashStr(key); return { e: AV_E[h % AV_E.length], bg: AV_BG[(h >> 4) % AV_BG.length] }; };
  const avThumb = key => { const v = avOf(key); return `<div class="thumb" style="background:${v.bg}">${v.e}</div>`; };
  /* 채팅 안 읽음: 상대가 보낸 마지막 메시지 시각이 '내가 마지막으로 본 시각'보다 최신이면 안 읽음 */
  let curRoom = null;
  const readAt = id => (S.chatRead || {})[id] || 0;
  const roomUnread = r => !!(BE.user && r.lastFrom && r.lastFrom !== BE.user.uid && (r.ts || 0) > readAt(r.id));
  const localUnread = id => { const th = S.chats[id]; if (!th || !th.msgs.length) return false; return th.msgs[th.msgs.length - 1].from === 'them' && th.ts > readAt(id); };
  const markRead = id => {
    if (!id) return; if (!S.chatRead) S.chatRead = {};
    const r = BE.enabled ? BE.rooms.find(x => x.id === id) : null;
    const v = r ? (r.ts || 0) : (S.chats[id] ? S.chats[id].ts : 0);
    if (v && S.chatRead[id] !== v) { S.chatRead[id] = v; save(); }
    if (BE.enabled && BE.user && !document.hidden) BE.markRead(id);
  };
  const allRev = () => BE.enabled ? BE.reviews : S.reviews;
  const revFor = id => allRev().filter(r => r.itemId === id);
  const rn = it => (it.reviews || 0) + revFor(it.id).length;
  const avgOf = rs => rs.length ? (rs.reduce((a, r) => a + r.rating, 0) / rs.length).toFixed(1) : '-';
  const canReview = it => !isMine(it) && S.reqs.some(r => r.itemId === it.id);
  /* 신뢰점수: 처음엔 5.0, 이후 그 회원이 받은 리뷰 별점 평균으로 변동 */
  const trustOf = key => { const rs = allRev().filter(r => r.sKey === key); return rs.length ? rs.reduce((a, r) => a + r.rating, 0) / rs.length : 5.0; };
  const myKey = () => (me() && me().uid) || myName();
  /* 신고: 한 사람이 같은 회원을 여러 번 신고해도 1번으로만 집계 (신고한 사람 수 기준) */
  const SUSPEND_N = 3;
  const repCount = key => BE.enabled ? (BE.repCounts[key] || 0) : new Set(S.reports.filter(r => r.sKey === key).map(r => r.reporter || 'me')).size;
  const suspended = () => BE.enabled && !!BE.user && repCount(BE.user.uid) >= SUSPEND_N;
  const AUTH_MSG = {
    'auth/invalid-credential': '이메일 또는 비밀번호가 맞지 않아요', 'auth/wrong-password': '이메일 또는 비밀번호가 맞지 않아요', 'auth/user-not-found': '이메일 또는 비밀번호가 맞지 않아요',
    'auth/invalid-email': '이메일 형식이 올바르지 않아요', 'auth/email-already-in-use': '이미 가입된 이메일이에요. 로그인해주세요',
    'auth/weak-password': '비밀번호가 너무 약해요 (8자 이상, 영문+숫자)', 'auth/too-many-requests': '시도가 너무 많아요. 잠시 후 다시 해주세요', 'auth/user-disabled': '사용이 중지된 계정이에요',
    'auth/network-request-failed': '네트워크 연결을 확인해주세요', 'auth/popup-closed-by-user': '로그인 창이 닫혔어요', 'auth/cancelled-popup-request': '', 'auth/popup-blocked': '팝업이 차단됐어요. 허용 후 다시 눌러주세요',
    'auth/unauthorized-domain': 'Firebase 콘솔 → Authentication → 승인된 도메인에 이 주소를 추가해야 해요', 'auth/operation-not-allowed': 'Firebase 콘솔에서 이 로그인 방법을 사용 설정해야 해요',
    'auth/account-exists-with-different-credential': '같은 이메일로 다른 방법으로 가입된 계정이에요', 'local/nickname-taken': '이미 사용 중인 닉네임이에요'
  };
  function showLgErr(msg, field) {
    const el = $('#lgErr'); if (!el) return toast(msg);
    el.textContent = msg || '';
    document.querySelectorAll('.lgform input').forEach(i => i.classList.toggle('err', !!msg && i.name === field));
    if (msg && field) { const f = $(`.lgform input[name=${field}]`); if (f) f.focus(); }
  }
  const authErr = e => { const m = AUTH_MSG[e.code]; if (m === '') return; showLgErr(m || '로그인에 실패했어요 (' + (e.code || e.message) + ')'); };

  /* ---------- 아이콘 ---------- */
  const P = {
    back: '<path d="M15 18l-6-6 6-6"/>',
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    heart: '<path d="M12 20s-7-4.4-9-9.2C1.8 7.6 3.9 4.5 7 4.5c2 0 3.5 1 5 3 1.5-2 3-3 5-3 3.1 0 5.2 3.1 4 6.3-2 4.8-9 9.2-9 9.2z"/>',
    bell: '<path d="M6 8a6 6 0 1112 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 21a2 2 0 004 0"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    chat: '<path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.2A8 8 0 1121 12z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    chev: '<path d="M6 9l6 6 6-6"/>',
    right: '<path d="M9 6l6 6-6 6"/>',
    pin: '<path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    reset: '<path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8"/><path d="M3 3v5h5"/>',
    more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    flag: '<path d="M5 21V4h11l-1.5 4L16 12H5"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
    sparkle: '<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1"/>',
    sort: '<path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    out: '<path d="M9 21H5V3h4M16 17l5-5-5-5M21 12H9"/>',
    wallet: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 12h.01"/><path d="M2 10h20"/>'
  };
  const I = (n, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${P[n]}</svg>`;

  /* ---------- 카테고리 ---------- */
  const CATS = {
    '도서': ['교재', '소설/에세이', '만화', '자격증/수험서'],
    '전자기기': ['노트북/태블릿', '카메라', '음향기기', '충전기/주변기기'],
    '생활/가전': ['주방', '청소', '소형가전'],
    '의류/잡화': ['정장', '가방', '액세서리'],
    '스포츠/레저': ['캠핑', '운동기구', '자전거'],
    '음식': ['유제품', '과일', '간식'],
    '기타': ['보드게임', '기타']
  };
  const CAT_EM = { '도서': '📚', '전자기기': '💻', '생활/가전': '🏠', '의류/잡화': '👔', '스포츠/레저': '⛺', '음식': '🍎', '기타': '🎲' };
  const BGS = ['linear-gradient(135deg,#d8f5ea,#a8e8d0)', 'linear-gradient(135deg,#ffe9d6,#ffcba4)', 'linear-gradient(135deg,#e5e9ff,#c7cffd)', 'linear-gradient(135deg,#fff3c9,#ffe08a)', 'linear-gradient(135deg,#ffe0e8,#ffb9cb)', 'linear-gradient(135deg,#e0f4ff,#b3e1fb)'];
  const UNIT_DAYS = { '일': 1, '주': 7, '개월': 30 };
  const STATUS = { open: '', reserved: '예약중', done: '거래 완료' };
  const REASONS = ['허위 물품 · 사기 의심', '욕설 · 비매너 행동', '부적절한 게시물 (불법·위험 물품)', '연락 두절 · 약속 불이행', '개인정보 요구 · 외부 거래 유도', '기타'];

  /* ---------- 샘플 데이터 ---------- */
  const mk = (id, o) => Object.assign({ id: String(id), status: 'open', bg: BGS[(parseInt(String(id).replace(/\D/g, ''), 10) || 0) % BGS.length], seller: '민지', score: 4.8, loc: '공대 1호관', cond: '상', kind: 'offer', likes: 3, dist: 1, reviews: 0 }, o, { ts: Date.now() - (o.ago || 0) * 60000 });
  const SEED = [
    mk(1, { type: 'rent', title: '운영체제 공룡책 (10판)', emoji: '📘', cat: '도서 > 교재', price: 4000, term: 4, unit: '개월', deposit: 5000, desc: '한 학기 동안 사용했어요. 형광펜 밑줄이 조금 있지만 필기는 거의 없어요.\n전공 수업 들으시는 분께 추천!\n\n반납은 학기 말 도서관 앞에서 해주세요.', ago: 12, likes: 8, dist: 0.3, reviews: 6 }),
    mk(2, { type: 'rent', title: '4인용 캠핑 텐트 (원터치)', emoji: '⛺', cat: '스포츠/레저 > 캠핑', price: 12000, term: 3, unit: '일', deposit: 20000, desc: 'MT, 동아리 캠핑 때 쓰기 좋아요. 설치 5분 컷!\n폴대/팩 포함, 파손 시 보증금에서 차감됩니다.', ago: 55, seller: '준호', loc: '기숙사 A동', cond: '새것 같음', likes: 14, dist: 0.8, reviews: 11 }),
    mk(3, { type: 'rent', title: '미러리스 카메라 (A6000)', emoji: '📷', cat: '전자기기 > 카메라', price: 25000, term: 1, unit: '주', deposit: 100000, desc: '졸업사진, 행사 촬영용으로 빌려가세요. 렌즈/배터리 2개/충전기 포함입니다.', ago: 130, seller: '서연', loc: '학생회관', cond: '상', score: 4.9, likes: 21, dist: 1.2, reviews: 19 }),
    mk(4, { type: 'rent', title: '아이패드 에어 5세대 + 펜슬', emoji: '📱', cat: '전자기기 > 노트북/태블릿', price: 30000, term: 1, unit: '주', deposit: 150000, desc: '시험기간 필기용으로 대여해요. 공부 앱 설치되어 있고 초기화 후 반납 부탁드려요.', ago: 240, seller: '도현', loc: '중앙도서관', cond: '새것 같음', likes: 17, dist: 0.5, reviews: 8 }),
    mk(5, { type: 'rent', kind: 'request', title: '졸업사진용 정장 빌려요 (M)', emoji: '👔', cat: '의류/잡화 > 정장', term: 2, unit: '일', desc: '졸업사진 촬영 때 입을 정장을 빌리고 싶어요. 허리 30~32 사이즈면 좋겠어요!\n조건(대여비·보증금)은 빌려주시는 분이 제안해주세요.', ago: 300, seller: '하준', loc: '인문관', cond: '상', likes: 2, dist: 0.9 }),
    mk(6, { type: 'rent', title: '보드게임 카탄 + 확장판', emoji: '🎲', cat: '기타 > 보드게임', price: 3000, term: 3, unit: '일', deposit: 5000, desc: '과 MT나 모임에서 같이 즐기세요. 구성품 전부 있어요!', ago: 420, seller: '지우', loc: '기숙사 B동', likes: 6, dist: 1.6, reviews: 3 }),
    mk(7, { type: 'rent', title: '미니 빔프로젝터', emoji: '📽️', cat: '생활/가전 > 소형가전', price: 10000, term: 3, unit: '일', deposit: 30000, desc: '자취방 영화관 만들기! HDMI 케이블 포함, 삼각대 별도 대여 가능해요.', ago: 800, seller: '예린', loc: '후문 원룸촌', cond: '상', likes: 11, dist: 2.4, reviews: 5 }),
    mk(8, { type: 'barter', title: '그릭요거트 6개 (플레인)', emoji: '🥛', cat: '음식 > 유제품', wish: '과일 류 (바나나·사과 등)', expiry: inDays(40), desc: '대용량으로 시켰다가 양이 너무 많아서 교환하고 싶어요. 냉장 보관 중이고 개봉 전입니다.', ago: 25, seller: '유진', loc: '기숙사 A동', cond: '새것 같음', likes: 9, dist: 0.4 }),
    mk(9, { type: 'barter', title: '읽은 소설책 5권 묶음', emoji: '📚', cat: '도서 > 소설/에세이', wish: '만화책 또는 자격증 교재', desc: '한 번 읽고 보관만 했어요. 상태 깨끗해요. 베스트셀러 위주입니다.', ago: 90, seller: '태민', loc: '중앙도서관', likes: 5, dist: 1.1 }),
    mk(10, { type: 'barter', title: '핸드드립 홈카페 세트', emoji: '☕', cat: '생활/가전 > 주방', wish: '원두 / 차 종류', desc: '드리퍼, 서버, 필터 포함. 거의 안 써서 교환하고 싶어요.', ago: 200, seller: '소은', loc: '학생회관', cond: '새것 같음', likes: 7, dist: 0.7 }),
    mk(12, { type: 'barter', title: '수제 쿠키 12개입', emoji: '🍪', cat: '음식 > 간식', wish: '음료 (캔커피·차 등)', expiry: inDays(5), desc: '베이킹 수업 실습으로 만들었어요. 방부제 없어서 이번 주 안에 드시는 걸 추천해요!', ago: 40, seller: '나연', loc: '인문관', cond: '새것 같음', likes: 12, dist: 0.6 }),
    mk(13, { type: 'barter', title: '요가매트 + 폼롤러', emoji: '🧘', cat: '스포츠/레저 > 운동기구', wish: '러닝화 (265)', desc: '두세 번 쓰고 안 써요. 소독해서 드릴게요.', ago: 600, seller: '다은', loc: '체육관 앞', likes: 4, dist: 2.8 }),
    mk(14, { type: 'barter', title: '제철 사과 한 봉지 (5개)', emoji: '🍎', cat: '음식 > 과일', wish: '시리얼, 요거트', expiry: inDays(10), desc: '본가에서 보내주셨는데 혼자 다 못 먹어요. 시리얼이나 요거트랑 바꿔요!', ago: 70, seller: '지호', loc: '기숙사 B동', cond: '새것 같음', likes: 6, dist: 0.6 }),
    mk(15, { type: 'barter', title: '바나나 한 송이', emoji: '🍌', cat: '음식 > 과일', wish: '간식, 빵', expiry: inDays(4), desc: '대용량으로 샀어요. 잘 익어서 바로 드시기 좋아요.', ago: 150, seller: '채원', loc: '후문 원룸촌', likes: 3, dist: 1.9 }),
    mk(16, { type: 'barter', title: '만화책 세트 (1~12권)', emoji: '📕', cat: '도서 > 만화', wish: '소설책, 에세이', desc: '완결 시리즈예요. 소설이나 에세이와 교환 원해요.', ago: 500, seller: '건우', loc: '인문관', likes: 5, dist: 0.9 })
  ];
  const INCOMING = [
    { type: 'barter', title: '딸기 1kg (설향)', emoji: '🍓', cat: '음식 > 과일', wish: '요거트, 우유', expiry: inDays(4), desc: '딸기농장 다니는 친구가 보내줬어요. 신선해요!', seller: '가은', loc: '기숙사 B동', dist: 0.5, cond: '새것 같음' },
    { type: 'rent', title: '캐논 DSLR 카메라 + 렌즈', emoji: '📷', cat: '전자기기 > 카메라', price: 18000, term: 1, unit: '주', deposit: 80000, desc: '행사 촬영, 과제용으로 대여해요. 삼각대 포함!', seller: '시우', loc: '공대 2호관', dist: 0.7, reviews: 4 },
    { type: 'barter', title: '원피스 만화책 1~20권', emoji: '📗', cat: '도서 > 만화', wish: '소설책, 에세이', desc: '상태 좋은 만화책 묶음이에요.', seller: '하린', loc: '중앙도서관', dist: 1.3 },
    { type: 'rent', title: '스노보드 풀세트', emoji: '🏂', cat: '스포츠/레저 > 운동기구', price: 40000, term: 3, unit: '일', deposit: 100000, desc: '보드, 바인딩, 부츠 포함. 겨울 MT에 딱이에요.', seller: '민석', loc: '체육관 앞', dist: 2.2, reviews: 2 },
    { type: 'barter', title: '수제 청귤청 (과일청)', emoji: '🍊', cat: '음식 > 과일', wish: '차, 원두', expiry: inDays(30), desc: '직접 담근 청귤청이에요. 차랑 바꾸고 싶어요.', seller: '서윤', loc: '학생회관', dist: 2.1, cond: '새것 같음' },
    { type: 'rent', title: '노트북 거치대 + 기계식 키보드', emoji: '⌨️', cat: '전자기기 > 충전기/주변기기', price: 5000, term: 1, unit: '주', deposit: 20000, desc: '과제 기간에 빌려 쓰세요.', seller: '재민', loc: '기숙사 A동', dist: 0.4, reviews: 1 }
  ];

  /* ---------- 상태 ---------- */
  const KEY = 'sharemate.v1';
  const freshState = () => ({
    v: 3, onboarded: false, wish: [], mine: [], extra: [], over: {}, chats: {}, reqs: [], recent: [], pos: null, rentals: [], reviews: [], alarm: { on: true, days: [3, 1, 0] }, notified: [],
    kwRent: [], kwBarter: [], blocked: [], reports: [], radius: 5, feedIdx: 0,
    account: null, transfers: [], chatRead: {},
    notes: [{ id: 'n0', icon: '👋', text: '쉐어메이트에 오신 걸 환영해요! 키워드를 등록하면 새 글 알림을 받을 수 있어요.', href: '#/keywords', ts: Date.now() - 3600000, read: false }]
  });
  let S = freshState(), curUid = null;
  const skey = uid => KEY + ':' + uid;
  const save = () => { if (!curUid) return; try { localStorage.setItem(skey(curUid), JSON.stringify(S)); } catch (e) { toast('저장 공간이 부족해요. 사진 크기를 줄여보세요'); } };
  function migrate() {
    if ((S.v || 1) < 2) {
      S.rentals = S.rentals.filter(r => r.state !== 'active' || r.confirmed);
      S.v = 2;
    }
    if (S.v < 3) {                                  // 예전 기본 키워드(카메라·과일) 제거
      S.kwRent = (S.kwRent || []).filter(k => k !== '카메라'); S.kwBarter = (S.kwBarter || []).filter(k => k !== '과일');
      S.v = 3;
    }
  }
  function loadState(uid) {
    curUid = uid;
    let raw = localStorage.getItem(skey(uid));
    if (!raw && localStorage.getItem(KEY) && !localStorage.getItem('sharemate.legacyDone')) { raw = localStorage.getItem(KEY); localStorage.setItem('sharemate.legacyDone', '1'); }
    try { S = Object.assign(freshState(), JSON.parse(raw || '{}')); } catch (e) { S = freshState(); }
    migrate(); save();
  }
  /* 실서비스(Firebase 연결) 모드에서는 샘플 글(SEED)·시연 글(extra)을 쓰지 않고 실제 글만 보여요 */
  const all = () => BE.enabled ? [...S.mine, ...BE.items.filter(i => !(BE.user && i.uid === BE.user.uid))] : [...S.mine, ...S.extra, ...SEED];
  const byId = id => all().find(i => i.id === String(id));
  const stOf = it => it.status === 'done' ? 'done' : (S.over[it.id] || it.status);
  const isMine = it => S.mine.some(m => m.id === it.id);
  const isPartner = it => { const u = me(); return !!(u && it.partnerUid && it.partnerUid === u.uid) || S.reqs.some(r => r.itemId === it.id && r.state !== '취소됨'); };
  const canSee = it => stOf(it) !== 'done' || isMine(it) || wished(it.id) || isPartner(it);
  const vis = () => all().filter(i => canSee(i) && (isMine(i) || !S.blocked.includes(i.seller)));
  const wished = id => S.wish.includes(String(id));
  const unreadN = () => S.notes.filter(n => !n.read).length;
  const addNote = (icon, text, href) => { S.notes.unshift({ id: 'n' + Date.now() + Math.random().toString(36).slice(2, 5), icon, text, href, ts: Date.now(), read: false }); save(); };
  const likeN = it => it.likes + (wished(it.id) ? 1 : 0);

  /* ---------- 키워드 · 매칭 ---------- */
  const STOP = new Set(['류', '등', '또는', '종류', '및', '그리고', '이나', '하고', '정도']);
  const toks = s => String(s || '').toLowerCase().split(/[,\s/·+()\[\]]+/).map(w => w.trim()).filter(w => w.length >= 2 && !STOP.has(w));
  const hay = it => (it.title + ' ' + it.cat + ' ' + it.desc + ' ' + (it.kw || '')).toLowerCase();
  const mhay = it => (it.title + ' ' + it.cat).toLowerCase();
  const myBarterPosts = () => S.mine.filter(i => i.type === 'barter');
  const autoWants = () => [...new Set(myBarterPosts().flatMap(i => toks(i.wish)))];
  const barterKw = () => [...new Set([...autoWants(), ...S.kwBarter.map(k => k.toLowerCase())])];

  function matches() {
    const wants = barterKw(), mine = myBarterPosts(); if (!wants.length) return [];
    return vis().filter(i => i.type === 'barter' && !isMine(i) && stOf(i) === 'open' && (distOf(i) ?? 0) <= S.radius).map(it => {
      const h = mhay(it), hits = wants.filter(w => h.includes(w));
      const swap = mine.find(m => toks(m.wish).some(w => h.includes(w)) && toks(it.wish).some(w => mhay(m).includes(w)));
      return { it, hits, mutual: !!swap, swap, score: (swap ? 1000 : 0) + hits.length * 10 - (distOf(it) ?? 3) * 2 };
    }).filter(m => m.hits.length || m.mutual).sort((a, b) => b.score - a.score);
  }

  /* ---------- 목록 필터 ---------- */
  const F = {
    rent: { tab: 'all', period: 'all', cat: 'all', sort: 'new', q: '' },
    barter: { cat: 'all', cond: 'all', sort: 'rec', q: '' }
  };
  const FDEF = {
    period: { label: '기간', opts: [['all', '전체'], ['3', '3일 이내'], ['7', '1주 이내'], ['30', '1개월 이내'], ['31', '1개월 이상']] },
    cat: { label: '카테고리', opts: [['all', '전체'], ...Object.keys(CATS).map(c => [c, CAT_EM[c] + ' ' + c])] },
    cond: { label: '상태', opts: [['all', '전체'], ['새것 같음', '새것 같음'], ['상', '상'], ['중', '중']] }
  };
  const SORTS = {
    rent: [['new', '신상품순'], ['low', '가격 낮은순'], ['high', '가격 높은순'], ['review', '리뷰 많은순']],
    barter: [['rec', '추천순(맞교환 우선)'], ['new', '신상품순'], ['near', '가까운순'], ['hot', '인기순']]
  };
  const fopts = (type, k) => k === 'sort' ? SORTS[type] : FDEF[k].opts;
  const flabel = k => k === 'sort' ? '정렬' : FDEF[k].label;
  const optLabel = (type, k, v) => (fopts(type, k).find(o => o[0] === v) || [])[1];
  const days = it => it.term * UNIT_DAYS[it.unit];

  function filtered(type) {
    const f = F[type];
    let a = vis().filter(i => i.type === type);
    if (type === 'rent' && f.tab !== 'all') a = a.filter(i => i.kind === f.tab);
    if (type === 'barter') a = a.filter(i => i.kind === 'offer');
    if (f.q) a = a.filter(i => (i.title + i.desc + i.cat + (i.wish || '') + (i.kw || '')).toLowerCase().includes(f.q.toLowerCase()));
    if (f.cat !== 'all') a = a.filter(i => i.cat.startsWith(f.cat));
    if (type === 'rent' && f.period !== 'all') { const p = +f.period; a = a.filter(i => p === 31 ? days(i) > 30 : days(i) <= p); }
    if (type === 'barter' && f.cond !== 'all') a = a.filter(i => i.cond === f.cond);
    const s = f.sort;
    if (s === 'new') a.sort((x, y) => y.ts - x.ts);
    if (s === 'low') a.sort((x, y) => (x.price ?? 1e12) - (y.price ?? 1e12));
    if (s === 'high') a.sort((x, y) => (y.price ?? -1) - (x.price ?? -1));
    if (s === 'review') a.sort((x, y) => rn(y) - rn(x));
    if (s === 'near') a.sort((x, y) => (isMine(x) ? 0 : (distOf(x) ?? 99)) - (isMine(y) ? 0 : (distOf(y) ?? 99)));
    if (s === 'hot') a.sort((x, y) => likeN(y) - likeN(x));
    if (s === 'rec') { const sc = new Map(matches().map(m => [m.it.id, m.score])); a.sort((x, y) => (sc.get(y.id) ?? -1e9) - (sc.get(x.id) ?? -1e9) || y.ts - x.ts); }
    return a;
  }

  /* ---------- 공통 조각 ---------- */
  const thumbIn = it => it.img ? `<img src="${it.img}" alt="">` : it.emoji;
  const heartBtn = (id, cls = 'hbtn') => `<button class="${cls} ${wished(id) ? 'on' : ''}" data-act="wish" data-id="${id}" aria-label="관심">${I('heart', 20)}</button>`;
  const homeBtn = `<a class="ib" href="#/" aria-label="홈">${I('home')}</a>`;
  const isReq = it => it.type === 'rent' && it.kind === 'request';

  function card(it, opt = {}) {
    const st = stOf(it);
    const body = it.type === 'rent'
        ? (isReq(it)
            ? `<p class="price req">희망 ${it.term}${it.unit} 대여</p><p class="meta">대여비·보증금은 빌려주는 분이 제안해요</p>`
            : `<p class="price">${won(it.price)} <small>/ ${it.term}${it.unit}</small></p><p class="meta">보증금 ${it.deposit ? won(it.deposit) : '없음'} · 리뷰 ${rn(it)}</p>`)
        : `<p class="wish">${I('swap', 15)}<span>${esc(it.wish)}</span></p>`;
    return `<a class="card" href="#/item/${it.id}">
    <div class="thumb" style="background:${it.bg}">${thumbIn(it)}${st !== 'open' ? `<span class="ribbon">${STATUS[st]}</span>` : ''}</div>
    <div class="info">
      <div class="tags"><span class="tag ${it.type}">${it.type === 'rent' ? '대여' : '교환'}</span>${MUT.has(it.id) ? `<span class="tag mut">서로 원해요 [${esc(MUT.get(it.id))}]</span>` : ''}${isReq(it) ? '<span class="tag req">요청</span>' : ''}</div>
      <h3>${esc(it.title)}</h3>${body}
      <p class="meta">${esc(it.loc)}${isMine(it) || distOf(it) == null ? '' : ' · ' + distOf(it) + 'km'} · ${ago(it.ts)}</p>
    </div>
    ${opt.del ? `<button class="del" data-act="del" data-id="${it.id}" aria-label="삭제">${I('trash', 18)}</button>` : heartBtn(it.id)}
  </a>`;
  }
  const empty = (em, msg) => `<div class="empty"><span class="em">${em}</span>${msg}</div>`;
  const topbar = ({ back = true, title = '', right = '' } = {}) => `<div class="topbar">${back ? `<button class="ib" data-act="back" aria-label="뒤로">${I('back')}</button>` : ''}<div class="title">${esc(title)}</div>${right}</div>`;
  function nav(on) {
    const chatN = Object.keys(S.chats).filter(id => { const it = byId(id); return it && !S.blocked.includes(it.seller) && localUnread(id); }).length
      + (BE.enabled && BE.user ? BE.rooms.filter(r => !S.blocked.includes(r.names && r.names[BE.partner(r, BE.user.uid)]) && roomUnread(r)).length : 0);
    return `<nav class="nav">
    <a href="#/chats" class="${on === 'chat' ? 'on' : ''}">${I('chat', 24)}채팅${chatN ? `<span class="badge">${chatN}</span>` : ''}</a>
    <a href="#/" class="${on === 'home' ? 'on' : ''}">${I('home', 24)}홈</a>
    <a href="#/calendar" class="${on === 'cal' ? 'on' : ''}">${I('cal', 24)}캘린더</a>
    <a href="#/my" class="${on === 'my' ? 'on' : ''}">${I('user', 24)}MY</a></nav>`;
  }
  const matchBanner = (sm) => {
    const n = matches().length;
    return `<a class="matchbanner ${sm ? 'sm' : ''}" href="#/match"><div class="mi">${I('sparkle', 22)}</div><div class="mt"><b>${n ? `나와 맞는 교환 상대 ${n}명` : '내 근처 교환 매칭'}</b><small>희망 키워드 기반으로 매칭해요.</small></div>${I('right', 18)}</a>`;
  };

  /* ---------- 화면 ---------- */
  function Main() {
    const v = vis(), rc = v.filter(i => i.type === 'rent').length, bc = v.filter(i => i.type === 'barter').length;
    const recent = [...v].sort((a, b) => b.ts - a.ts).slice(0, 8);
    return `<div class="screen">
    <div class="topbar"><button class="ib" data-act="drawer" aria-label="메뉴">${I('menu')}</button><div class="logo">쉐어메이트</div>
      <a class="ib" href="#/notifications" aria-label="알림">${I('bell')}${unreadN() ? '<i class="dot"></i>' : ''}</a>
      <a class="ib" href="#/wishlist" aria-label="관심">${I('heart')}</a></div>
    <div class="content">
      <div class="hello"><h1><b>빌리고,</b> 나누고,<br><b style="color:var(--bar)">바꾸고!</b></h1></div>
      <form class="searchbar" data-form="gsearch">${I('search', 20)}<input name="q" placeholder="원하는 물건을 검색하세요" autocomplete="off"></form>
      <div class="big2">
        <a class="bigcard rent" href="#/list/rent"><span class="cnt">${rc}개 물품</span><span class="em">📦</span><h2>대여</h2><p>필요한 만큼만<br>빌려 쓰기</p></a>
        <a class="bigcard barter" href="#/list/barter"><span class="cnt">${bc}개 물품</span><span class="em">🔄</span><h2>물물교환</h2><p>안 쓰는 물건을<br>필요한 것과 맞교환</p></a>
      </div>
      ${matchBanner(false)}
      <div class="sec-h" style="padding-top:18px"><h3>카테고리</h3></div>
      <div class="cats">${Object.keys(CATS).map(c => `<a class="cat" href="#/search?cat=${encodeURIComponent(c)}"><i>${CAT_EM[c]}</i>${c}</a>`).join('')}</div>
      ${recent.length ? `<div class="sec-h" style="padding-top:18px"><h3>방금 올라왔어요</h3></div>` : ''}
      <div class="hscroll">${recent.map(it => `<a class="mini" href="#/item/${it.id}"><div class="thumb" style="background:${it.bg}">${thumbIn(it)}</div><h4>${esc(it.title)}</h4><p class="${it.type === 'barter' ? 'b' : ''}">${it.type === 'rent' ? (isReq(it) ? '대여 요청' : won(it.price) + ' / ' + it.term + it.unit) : '교환 · ' + esc(toks(it.wish)[0] || it.wish)}</p></a>`).join('')}</div>
      <div class="safe"></div>
    </div>${nav('home')}</div>`;
  }

  function List(type) {
    const f = F[type], items = filtered(type), r = type === 'rent';
    MUT = r ? new Map() : new Map(matches().filter(m => m.mutual).map(m => [m.it.id, m.swap.title]));
    const tabs = [['all', '전체'], ['offer', '대여제품'], ['request', '대여요청']];
    const chips = r ? ['period', 'cat', 'sort'] : ['cat', 'cond', 'sort'];
    const fabHref = `#/register?type=${type}${r && f.tab === 'request' ? '&kind=request' : ''}`;
    return `<div class="screen ${type}-scope">
    ${topbar({ title: r ? '대여' : '물물교환', right: homeBtn + `<a class="ib" href="#/wishlist" aria-label="관심">${I('heart')}</a>` })}
    ${r ? '' : matchBanner(true)}
    <form class="searchbar sm" data-form="lsearch" data-type="${type}">${I('search', 18)}<input name="q" value="${esc(f.q)}" placeholder="${r ? '빌리고 싶은 물품을 검색해보세요' : '교환하고 싶은 물품을 검색해보세요'}" autocomplete="off"></form>
    ${r ? `<div class="tabs">${tabs.map(t => `<button class="${f.tab === t[0] ? 'on' : ''}" data-act="ltab" data-type="${type}" data-v="${t[0]}">${t[1]}</button>`).join('')}</div>` : ''}
    <div class="chips">${chips.map(k => `<button class="chip ${k === 'sort' ? (f.sort !== (r ? 'new' : 'rec') ? 'on' : '') : (f[k] !== 'all' ? 'on' : '')}" data-act="fsheet" data-type="${type}" data-k="${k}">${k === 'sort' ? I('sort', 14) + ' ' + optLabel(type, 'sort', f.sort) : (f[k] === 'all' ? flabel(k) : optLabel(type, k, f[k]))} ${k === 'sort' ? '' : I('chev', 14)}</button>`).join('')}</div>
    <div class="countrow"><span>총 ${items.length}개</span><span>${r && f.tab === 'request' ? '빌리고 싶은 물건을 올려보세요' : ''}</span></div>
    <div class="content"><div class="list">${items.length ? items.map(i => card(i)).join('') : empty('🔍', '조건에 맞는 물품이 아직 없어요.<br>첫 번째로 등록해보는 건 어때요?')}</div></div>
    <a class="fab" href="${fabHref}" aria-label="등록">${I('plus', 26)}</a></div>`;
  }

  function Detail(id) {
    const it = byId(id);
    if (!it) return `<div class="screen">${topbar()}${empty('🫥', '삭제되었거나 없는 물품이에요.')}</div>`;
    if (!canSee(it)) return `<div class="screen">${topbar()}${empty('🔒', '거래가 완료된 게시글이에요.<br>작성자, 거래 상대방, 찜한 사람만 볼 수 있어요.')}</div>`;
    const r = it.type === 'rent', req = isReq(it), st = stOf(it), mine = isMine(it);
    const food = it.cat.startsWith('음식');
    const exp = it.expiry ? Math.ceil((new Date(it.expiry) - Date.now()) / 86400000) : null;
    const label = req ? '빌려줄게요 (조건 제안)' : r ? '대여 신청하기' : '교환 제안하기';
    const action = mine
        ? `<button class="btn line" data-act="done" data-id="${it.id}">${st === 'done' ? '다시 열기' : '거래 완료 처리'}</button><button class="btn line" data-act="edit" data-id="${it.id}" style="flex:none">${I('list', 18)}수정</button><button class="btn pri" data-act="del" data-id="${it.id}">삭제하기</button>`
        : `<button class="btn line" data-act="chat" data-id="${it.id}" style="flex:none">${I('chat', 20)}채팅</button>
       <button class="btn pri" data-act="${req ? 'offer' : r ? 'rent' : 'prop'}" data-id="${it.id}" ${st !== 'open' ? 'disabled' : ''}>${st !== 'open' ? STATUS[st] : label}</button>`;
    const priceBlock = req
        ? `<div class="reqbox">${I('clock', 20)}<span>희망 대여 기간 <b>${it.term}${it.unit}</b></span></div>
       <div class="d-sub">${I('info', 16)}대여비·보증금은 요청자가 정하지 않고, 빌려주는 분이 제안해요</div>`
        : r ? `<div class="d-price">${won(it.price)} <small>/ ${it.term}${it.unit}</small></div>
          <div class="d-sub">${I('shield', 16)}보증금 <b>${it.deposit ? won(it.deposit) : '없음'}</b> · 반납 시 전액 환급</div>`
            : `<div class="wishbox">${I('swap', 20)}<span>교환 희망 : ${esc(it.wish)}</span></div>`;
    const md = !mine && S.pos && hasMeet(it) ? ` · 내 위치에서 ${Math.round(hav(S.pos.lat, S.pos.lng, it.mlat, it.mlng) * 10) / 10}km` : '';
    const meetBlock = hasMeet(it)
        ? `<div class="meet"><div class="meet-h"><b>${I('pin', 16)} 거래 희망 장소</b><span>${esc(it.loc)}${md}</span></div>
          <div class="mapbox" id="meetmap"></div>
          <div class="meet-b"><button class="btn line" data-act="mapview" data-id="${it.id}">크게 보기</button><a class="btn line" href="${kakaoTo(it)}" target="_blank" rel="noopener">길찾기 (카카오맵)</a></div></div>`
        : `<p class="hint2 nomap">${I('pin', 13)} <span>${mine ? '글 수정에서 지도에 거래 장소를 표시할 수 있어요.' : '작성자가 지도에 거래 장소를 표시하지 않았어요. 채팅으로 장소를 정해보세요.'}</span></p>`;
    const gb = 'style="background:rgba(255,255,255,.75)"';
    return `<div class="screen ${it.type}-scope">
    <div class="topbar" style="position:absolute;left:0;right:0;top:0;background:transparent;backdrop-filter:none">
      <button class="ib" data-act="back" ${gb}>${I('back')}</button><div class="sp"></div>
      <a class="ib" href="#/" ${gb}>${I('home')}</a>
      ${mine ? '' : `<button class="ib" data-act="more" data-id="${it.id}" ${gb} aria-label="더보기">${I('more')}</button>`}</div>
    <div class="content">
      <div class="hero" style="background:${it.bg}">${thumbIn(it)}</div>
      <div class="sheetbody">
        <div class="tags"><span class="tag ${it.type}">${r ? '대여' : '물물교환'}</span>${req ? '<span class="tag req">요청</span>' : ''}${st !== 'open' ? `<span class="tag st">${STATUS[st]}</span>` : ''}</div>
        <div class="d-title"><h1>${esc(it.title)}</h1>${heartBtn(it.id, 'ib')}</div>
        ${priceBlock}
        <div class="seller"><div class="avatar" style="background:${avOf(sKey(it)).bg}">${avOf(sKey(it)).e}</div><div><div class="n">${esc(it.seller)}${mine ? ' (나)' : ''}</div><div class="s">${I('pin', 12)} ${esc(it.loc)}${mine || distOf(it) == null ? '' : ' · ' + distOf(it) + 'km'}</div></div>
          <div class="score">${trustOf(sKey(it)).toFixed(1)}<small>신뢰점수</small></div></div>
        <div class="revrow"><a href="#/seller/${encodeURIComponent(sKey(it))}">⭐ ${avgOf(allRev().filter(x => x.sKey === sKey(it)))} · 이 판매자 물품 리뷰 모두 보기 ${I('right', 16)}</a>${canReview(it) ? `<button data-act="revw" data-id="${it.id}">리뷰 쓰기</button>` : ''}</div>
        <div class="dtabs"><button class="on" data-act="dtab" data-v="info">상세정보</button><button data-act="dtab" data-v="guide">${r ? '대여안내' : '교환안내'}</button></div>
        <div class="pane" data-pane="info">
          <dl class="kv"><dt>작성자 신고</dt><dd>${(n => `<span style="font-weight:700;color:${n ? '#E5484D' : 'var(--sub)'}">${n}건</span>${n >= SUSPEND_N ? ' (정지된 계정)' : ''}`)(repCount(sKey(it)))}</dd><dt>카테고리</dt><dd>${esc(it.cat)}</dd>
            <dt>상품 상태</dt><dd>${esc(it.cond)}</dd>
            ${food && it.expiry ? `<dt>유통기한</dt><dd>${it.expiry.replace(/-/g, '.')} ${exp !== null ? `<span style="color:${exp <= 7 ? '#E5484D' : 'var(--sub)'};font-weight:600">(${exp >= 0 ? 'D-' + exp : '기한 지남'})</span>` : ''}</dd>` : ''}
            ${r && !req ? `<dt>리뷰</dt><dd>${rn(it)}개</dd>` : ''}
            ${it.kw ? `<dt>키워드</dt><dd>${toks(it.kw).map(k => `<span class="kwtag">#${esc(k)}</span>`).join(' ')}</dd>` : ''}<dt>거래 장소</dt><dd>${esc(it.loc)}</dd><dt>등록</dt><dd>${ago(it.ts)} · 관심 ${likeN(it)}</dd></dl>
          ${meetBlock}
          <div class="desc">${esc(it.desc)}</div>
          <p class="disclaimer">${I('info', 14)} 거래는 회원 간 직접 이루어지며, 쉐어메이트는 거래에 대한 책임을 지지 않아요.</p>
        </div>
        <div class="pane" data-pane="guide" hidden><div class="guide">
          ${r ? '' : `<div>${I('swap', 20)}<span>서로 합의한 물품을 <b>직접 만나서</b> 교환해요. 채팅으로 먼저 조율해보세요.</span></div>
             ${food ? `<div>${I('clock', 20)}<span>음식은 <b>유통기한이 지난 물품은 교환할 수 없어요</b>. 개봉·보관 상태를 꼭 확인하세요.</span></div>` : ''}`}
          <div>${I('flag', 20)}<span>사기가 의심되거나 불쾌한 일이 생기면 우측 상단 <b>⋯ 메뉴</b>에서 신고·차단할 수 있어요.</span></div></div></div>
      </div></div>
    <div class="actionbar">${action}</div></div>`;
  }

  function Register(q) {
    const type = q.get('type') === 'barter' ? 'barter' : 'rent';
    const kind = type === 'rent' && q.get('kind') === 'request' ? 'request' : 'offer';
    const mainCats = Object.keys(CATS);
    return `<div class="screen">
    <div class="topbar"><div class="title">${q.get('edit') ? '게시글 수정' : '상품정보 등록'}</div><button class="ib" data-act="back" aria-label="닫기">${I('close')}</button></div>
    <form id="regform" class="form content" data-type="${type}" data-kind="${kind}" data-form="register" autocomplete="off">
      <div class="seg"><label><input type="radio" name="type" value="rent" ${type === 'rent' ? 'checked' : ''}><span>📦 대여</span></label><label><input type="radio" name="type" value="barter" ${type === 'barter' ? 'checked' : ''}><span>🔄 물물교환</span></label></div>
      <div class="seg kind-seg"><label><input type="radio" name="kind" value="offer" ${kind === 'offer' ? 'checked' : ''}><span>대여제공</span></label><label><input type="radio" name="kind" value="request" ${kind === 'request' ? 'checked' : ''}><span>대여요청</span></label></div>
      <div class="reqnote">${I('info', 18)}<span>대여 요청에서는 <b>대여비·보증금을 제시할 수 없어요.</b><br>빌려주실 분이 조건을 직접 제안해요.</span></div>
      <div class="f"><label class="l">사진</label>
        <label class="photo" id="photoBox">${I('camera', 24)}<span>사진 추가</span><input type="file" accept="image/*" id="photoIn"></label>
        <p class="hint">사진이 없으면 카테고리 이모지가 대신 보여요.</p></div>
      <div class="f"><label class="l">상품명 <i>*</i></label><input class="in" name="title" maxlength="40" placeholder="예) 운영체제 공룡책 10판"></div>
      <div class="f"><label class="l">카테고리 <i>*</i></label>
        <div class="two"><select name="main">${mainCats.map(c => `<option>${c}</option>`).join('')}</select><select name="sub">${CATS[mainCats[0]].map(c => `<option>${c}</option>`).join('')}</select></div></div>
      <div class="f"><label class="l">상품 상태</label><div class="two" style="grid-template-columns:1fr"><select name="cond"><option>새것 같음</option><option selected>상</option><option>중</option></select></div></div>
      <div class="f only-food" hidden><label class="l">유통기한 <i>*</i></label><input class="in" type="date" name="expiry" min="${lymd(new Date())}"><p class="hint">음식은 유통기한이 지난 물품은 등록할 수 없어요.</p></div>
      <div class="f"><label class="l">설명 <i>*</i></label><textarea name="desc" maxlength="500" placeholder="물품 상태, 사용 기간, 거래 방법 등을 자유롭게 적어주세요."></textarea></div>
      <div class="f only-rent"><label class="l"><span class="k-offer">대여 기간 <i>*</i></span><span class="k-request">희망 대여 기간 <i>*</i></span></label>
        <div class="two"><input class="in" name="term" type="number" min="1" value="1"><select name="unit"><option>일</option><option>주</option><option selected>개월</option></select></div></div>
      <div class="f rent-offer"><label class="l">대여 기간 기준 <i>*</i></label><input class="in" name="price" type="number" inputmode="numeric" min="0" placeholder="대여료 입력 (예: 4000)"></div>
      <div class="f rent-offer"><label class="l">보증금</label><input class="in" name="deposit" type="number" inputmode="numeric" min="0" placeholder="0 (없으면 비워두세요)"></div>
      <div class="f only-rent"><label class="l">키워드 <small>(선택)</small></label><input class="in" name="kw" maxlength="40" placeholder="예) 카메라, 졸업사진, 행사 (쉼표로 구분)">
        <p class="hint">검색에 잘 걸리고, 이 키워드를 등록해둔 사람에게 새 글 알림이 가요.</p></div>
      <div class="f only-barter"><label class="l">교환 희망 키워드 <i>*</i></label><input class="in" name="wish" maxlength="40" placeholder="예) 과일, 만화책 (쉼표로 구분)">
        <p class="hint">다른 사용자가 올린 물품 중 내가 찾는 물품의 키워드예요. 카테고리와 게시글 제목을 기준으로 가까운 교환 상대를 추천하고, 새 글이 올라오면 알림을 보내드려요.</p></div>
      <div class="f"><label class="l">거래 장소</label><input class="in" name="loc" maxlength="20" placeholder="예) 중앙도서관 앞">
        <div id="meetstat" class="meetstat"></div>
        <p class="hint">지도에 위치를 표시하면 상대가 만날 장소를 한눈에 볼 수 있어요.</p></div>
    </form>
    <div class="stickybtn"><button class="btn pri block" data-act="submitreg" style="--acc:var(--pri)">${q.get('edit') ? '수정 완료' : '등록하기'}</button></div></div>`;
  }

  function Search(q) {
    const kw = q.get('q') || '', cat = q.get('cat') || '';
    let res = null;
    if (kw || cat) {
      res = vis().filter(i => (!kw || (i.title + i.desc + i.cat + (i.wish || '') + (i.kw || '')).toLowerCase().includes(kw.toLowerCase())) && (!cat || i.cat.startsWith(cat))).sort((a, b) => b.ts - a.ts);
    }
    return `<div class="screen">
    <div class="topbar"><button class="ib" data-act="back">${I('back')}</button>
      <form class="searchbar sm" data-form="gsearch" style="flex:1;margin:0">${I('search', 18)}<input name="q" value="${esc(kw)}" placeholder="원하는 물건을 검색하세요" autocomplete="off"></form>${homeBtn}</div>
    <div class="content">${res ? `<div class="countrow"><span>${cat ? CAT_EM[cat] + ' ' + cat : '“' + esc(kw) + '”'} 검색결과 ${res.length}개</span></div><div class="list">${res.length ? res.map(i => card(i)).join('') : empty('🔍', '검색 결과가 없어요.<br>다른 키워드로 찾아보세요.')}</div>`
        : `${S.recent.length ? `<div class="sec-h"><h3>최근 검색어</h3><a href="#/search" data-act="clr">지우기</a></div><div class="chips" style="flex-wrap:wrap">${S.recent.map(k => `<a class="chip" href="#/search?q=${encodeURIComponent(k)}">${esc(k)}</a>`).join('')}</div>` : ''}
      <div class="sec-h" style="padding-top:18px"><h3>인기 검색어</h3></div><div class="chips" style="flex-wrap:wrap">${['전공책', '카메라', '텐트', '아이패드', '정장', '요거트', '보드게임'].map(k => `<a class="chip" href="#/search?q=${encodeURIComponent(k)}">🔥 ${k}</a>`).join('')}</div>
      <div class="sec-h" style="padding-top:18px"><h3>카테고리로 찾기</h3></div><div class="cats" style="flex-wrap:wrap">${Object.keys(CATS).map(c => `<a class="cat" href="#/search?cat=${encodeURIComponent(c)}"><i>${CAT_EM[c]}</i>${c}</a>`).join('')}</div>`}</div></div>`;
  }

  function Match() {
    const ms = matches(), wants = barterKw();
    return `<div class="screen barter-scope">${topbar({ title: '내 근처 교환 매칭', right: homeBtn })}
    <div class="content">
      <div class="locbar"><span>${I('pin', 16)} ${S.pos ? '내 현재 위치 기준' : '위치 미확인 (샘플 거리)'}</span><span style="gap:6px"><button data-act="locate">📍 내 위치</button><button data-act="radsheet">반경 ${S.radius}km ${I('chev', 14)}</button></span></div>
      <div class="wantbox"><small>희망 키워드</small><div class="chips" style="padding:8px 0 0;flex-wrap:wrap">${wants.length ? wants.map(w => `<span class="chip on">${esc(w)}</span>`).join('') : '<span class="meta">아직 없어요</span>'}<a class="chip" href="#/keywords">${I('plus', 14)} 키워드 관리</a></div>
        <p class="hint2">희망 키워드 기반으로 매칭해요.</p></div>
      <div class="list">${ms.length ? ms.map(m => `<div class="mwrap"><div class="mbadges">${m.hits.slice(0, 2).map(h => `<span class="mb">✨ ‘${esc(h)}’ 일치</span>`).join('')}<span class="mb">${I('pin', 12)} ${distOf(m.it) ?? '?'}km</span>${m.mutual ? `<span class="mb hot">서로 원해요 [${esc(m.swap.title)}]</span>` : ''}</div>${card(m.it)}</div>`).join('')
        : empty('🧭', wants.length ? `반경 ${S.radius}km 안에는 아직 맞는 상대가 없어요.<br>반경을 넓히거나 키워드를 더 추가해보세요.` : '희망 키워드가 없어요.<br>교환 글을 올리거나 희망 키워드를 추가하면 추천해드려요.')}</div>
    </div></div>`;
  }

  function Keywords() {
    const auto = autoWants();
    const chipList = (arr, t) => arr.map(k => `<span class="chip on kchip">${esc(k)}<button data-act="kwdel" data-t="${t}" data-k="${esc(k)}" aria-label="삭제">${I('close', 12)}</button></span>`).join('');
    return `<div class="screen">${topbar({ title: '키워드 알림', right: homeBtn })}
    <div class="content"><div class="kwwrap">
      <section class="kwsec barter-scope"><h3>🔄 물물교환 희망 키워드</h3>
        <p><b>희망 키워드</b>는 다른 사용자가 올린 물품 중 내가 찾는 물품이에요. 내가 올린 교환 글의 희망 키워드는 자동으로 등록돼요. <b>카테고리나 게시글 제목</b>에 키워드가 들어간 새 교환 글이 올라오면 알려드려요.</p>
        <div class="chips" style="padding:0;flex-wrap:wrap">${auto.map(k => `<span class="chip kchip lock">${esc(k)} <small>내 글</small></span>`).join('')}${chipList(S.kwBarter, 'barter')}${!auto.length && !S.kwBarter.length ? '<span class="meta">등록된 키워드가 없어요</span>' : ''}</div>
        <form class="kwadd" data-form="kwadd" data-t="barter"><input name="k" placeholder="키워드 추가 (예: 과일, 만화)" autocomplete="off"><button class="btn pri" style="--acc:var(--bar);height:42px">추가</button></form></section>
      <section class="kwsec rent-scope"><h3>📦 대여 키워드</h3>
        <p>대여는 희망 키워드가 따로 없으니 원하는 키워드를 직접 추가하세요. 해당 키워드가 들어간 새 대여 글이 올라오면 알려드려요.</p>
        <div class="chips" style="padding:0;flex-wrap:wrap">${chipList(S.kwRent, 'rent') || '<span class="meta">등록된 키워드가 없어요</span>'}</div>
        <form class="kwadd" data-form="kwadd" data-t="rent"><input name="k" placeholder="키워드 추가 (예: 카메라, 텐트)" autocomplete="off"><button class="btn pri" style="height:42px">추가</button></form></section>
      ${BE.enabled ? '' : `<section class="kwsec demo"><h3>🧪 시연하기</h3>
        <p>서버가 없는 시연용 앱이라 “새 글이 올라오는 상황”을 버튼으로 재현해요. 키워드와 일치하면 알림이 도착합니다.</p>
        <button class="btn line block" data-act="sim">새 글 도착시키기</button></section>`}
    </div></div></div>`;
  }

  function Wishlist() {
    const items = S.wish.map(byId).filter(i => i && (isMine(i) || !S.blocked.includes(i.seller)));
    return `<div class="screen">${topbar({ title: '관심 목록', right: homeBtn })}<div class="content"><div class="list">${items.length ? items.map(i => card(i)).join('') : empty('🤍', '아직 관심 물품이 없어요.<br>마음에 드는 물품의 하트를 눌러보세요!')}</div></div></div>`;
  }

  function Notes() {
    const html = `<div class="screen">${topbar({ title: '알림', right: homeBtn })}<div class="content">
    <a class="kwlink" href="#/keywords">${I('tag', 18)}<span><b>키워드 알림 설정</b><small>교환 희망 키워드 · 대여 키워드</small></span>${I('right', 18)}</a>
    ${S.notes.length ? S.notes.map(n => { const un = !n.read; const inner = `<div class="ic">${n.icon}</div><div>${esc(n.text)}<small>${ago(n.ts)}</small></div>`; return n.href ? `<a class="note ${un ? 'un' : ''}" href="${n.href}">${inner}</a>` : `<div class="note ${un ? 'un' : ''}">${inner}</div>`; }).join('') : empty('🔔', '새로운 알림이 없어요.')}</div></div>`;
    S.notes.forEach(n => n.read = true); save();
    return html;
  }

  function Chats() {
    const ids = Object.keys(S.chats).filter(id => { const it = byId(id); return it && !S.blocked.includes(it.seller); }).sort((a, b) => S.chats[b].ts - S.chats[a].ts);
    return `<div class="screen">${topbar({ back: false, title: '채팅' })}<div class="content">${remoteRows()}${ids.length ? ids.map(id => {
      const it = byId(id), th = S.chats[id], last = th.msgs[th.msgs.length - 1];
      const preview = last && last.text.startsWith('[송금완료]') ? '💸 송금을 보냈어요' : (last ? last.text : '대화를 시작해보세요');
      return `<a class="chatrow" href="#/chat/${id}">${avThumb(sKey(it))}<div class="t"><b>${esc(it.seller)}</b> <small>· ${esc(it.title)}</small><p>${esc(preview)}</p></div><small>${ago(th.ts)}</small>${localUnread(id) ? '<i class="udot"></i>' : ''}</a>`;
    }).join('') : (BE.enabled && BE.rooms.length ? '' : empty('💬', '아직 대화가 없어요.<br>물품 상세에서 채팅을 시작해보세요!'))}</div>${nav('chat')}</div>`;
  }

  /* 직관적인 송금 버튼 & 빠른 송금 칩이 적용된 채팅방 */
  function Chat(id) {
    const it = byId(id); if (!it) return `<div class="screen">${topbar()}${empty('🫥', '대화방을 찾을 수 없어요.')}</div>`;
    const th = S.chats[id] || { msgs: [], ts: Date.now() }, blocked = S.blocked.includes(it.seller);
    const sub = it.type === 'rent' ? (isReq(it) ? '대여 요청 · 희망 ' + it.term + it.unit : won(it.price) + ' / ' + it.term + it.unit) : '교환 · ' + esc(it.wish);
    const suggestAmt = (it.price || 0) + (it.deposit || 0);
    const remitChip = suggestAmt > 0
        ? `<button data-act="remit" data-id="${id}" data-amt="${suggestAmt}" style="background:#e6f7f0;color:#0d7a4f;border:1px solid #a3e4c9;font-weight:700">💸 ${won(suggestAmt)} 바로 송금</button>`
        : `<button data-act="remit" data-id="${id}" style="background:#e6f7f0;color:#0d7a4f;border:1px solid #a3e4c9;font-weight:700">💸 간편송금 하기</button>`;

    return `<div class="screen">${topbar({ title: it.seller, right: homeBtn + (isMine(it) ? '' : `<button class="ib" data-act="more" data-id="${it.id}" aria-label="더보기">${I('more')}</button>`) })}
    <a class="chat-item" href="#/item/${it.id}"><div class="thumb" style="background:${it.bg}">${thumbIn(it)}</div><div style="flex:1"><b>${esc(it.title)}</b><br><span style="color:var(--pri-d);font-weight:700">${sub}</span></div>
      ${!blocked ? `<button data-act="remit" data-id="${id}" style="background:var(--pri);color:#fff;border:none;border-radius:10px;padding:7px 11px;font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap">💸 송금하기</button>` : ''}</a>
    <div class="content" id="msgbox"><div class="msgs">${th.msgs.map(msgHtml).join('')}</div></div>
    ${blocked ? `<div class="blockedbar">차단한 회원이에요. <a href="#/my/blocked">차단 관리</a>에서 해제할 수 있어요.</div>` : `
    <div class="quick">${remitChip}${['아직 가능한가요?', '거래 장소 어디가 좋을까요?', '가격 조정 가능할까요?'].map(t => `<button data-act="quick" data-id="${id}" data-t="${t}">${t}</button>`).join('')}</div>
    <form class="composer" data-form="chat" data-id="${id}" style="gap:6px">
      <button type="button" data-act="remit" data-id="${id}" aria-label="송금하기" style="width:auto;padding:0 11px;border-radius:12px;background:#e6f7f0;color:#0d7a4f;border:1px solid #b5ebd4;font-weight:800;font-size:13px;white-space:nowrap;flex-shrink:0">💸 송금</button>
      <input name="t" placeholder="메시지를 입력하세요" autocomplete="off">
      <button aria-label="전송">${I('send', 20)}</button></form>`}</div>`;
  }

  /* 송금 완료 메시지 전용 영수증 카드 렌더링 */
  function msgHtml(m) {
    if (m.text && m.text.startsWith('[송금완료]')) {
      const lines = m.text.replace('[송금완료]', '').trim().split('\n');
      const title = lines[0] || '송금이 완료되었어요';
      const meta = lines.slice(1).map(l => `<div style="font-size:11px;color:#3d6b58;margin-top:2px">${esc(l)}</div>`).join('');
      return wrapMsg(m, `<div class="msg ${m.from}" style="background:linear-gradient(135deg,#e6f7f0,#d2f2e4);color:#0b4f34;border:1px solid #a8e3ca;padding:12px 14px;border-radius:16px;max-width:240px">
      <div style="font-weight:800;font-size:13.5px;margin-bottom:4px">💸 ${esc(title)}</div>
      ${meta}
      <div style="font-size:10px;color:#528771;margin-top:6px;border-top:1px dashed #9cd9bf;padding-top:4px">테스트 모의 송금 · 실제 이체가 아니에요</div>
    </div>`);
    }
    return wrapMsg(m, `<div class="msg ${m.from}">${esc(m.text)}</div>`);
  }
  /* 말풍선 옆에 보낸 시간 + (내가 보낸 메시지를 상대가 아직 안 읽었으면) 노란 1 */
  function wrapMsg(m, bubble) {
    if (m.from === 'sys') return bubble;
    const meta = `<span class="mmeta">${m.from === 'me' && m.unread ? '<i class="r1">1</i>' : ''}<small>${clock(m.t)}</small></span>`;
    return `<div class="mrow ${m.from}">${m.from === 'me' ? meta + bubble : bubble + meta}</div>`;
  }

  function My() {
    const row = (href, ic, t, extra = '') => `<a href="${href}">${I(ic, 20)}${t}${extra}<span class="r">${I('right', 18)}</span></a>`;
    const acc = S.account;
    const walletBox = acc
        ? `<div style="margin:0 16px 14px;padding:14px 16px;border-radius:16px;background:linear-gradient(135deg,#eef5ff,#dceaff);border:1px solid #c5dcff">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:12px;font-weight:700;color:var(--pri-d)">🏦 테스트 계좌 (모의)</span>
          <span style="font-size:11px;color:var(--sub)">${esc(acc.bankName)} ${esc(acc.accountNum)}</span>
        </div>
        <div style="font-size:21px;font-weight:800;color:#111;margin:4px 0 8px">${won(acc.balance)}</div>
        <div style="display:flex;gap:8px">
          <button data-act="chargeacc" style="flex:1;height:34px;border-radius:10px;border:none;background:var(--pri);color:#fff;font-weight:700;font-size:12.5px;cursor:pointer">+ 10만원 충전</button>
          <button data-act="linkacc" style="height:34px;padding:0 12px;border-radius:10px;border:1px solid #b5d1ff;background:#fff;color:var(--pri-d);font-weight:600;font-size:12.5px;cursor:pointer">계좌 변경</button>
        </div>
      </div>`
        : `<div style="margin:0 16px 14px;padding:14px 16px;border-radius:16px;background:#f4f7fb;border:1px dashed #c8d4e6;display:flex;justify-content:space-between;align-items:center;gap:10px">
        <div><b style="font-size:13.5px;display:block">🏦 간편송금 계좌 연결</b><small style="color:var(--sub);font-size:11.5px">채팅방에서 바로 송금할 수 있어요</small></div>
        <button data-act="linkacc" style="height:36px;padding:0 14px;border-radius:10px;border:none;background:var(--pri);color:#fff;font-weight:700;font-size:12.5px;cursor:pointer;white-space:nowrap">계좌 연결</button>
      </div>`;

    return `<div class="screen">${topbar({ back: false, title: 'MY' })}<div class="content">
    <div class="profile"><div class="avatar">😀</div><div><h2>${esc(me() ? myName() : '나 (학생)')}</h2><p>우리 학교 · 신뢰점수 ${trustOf(myKey()).toFixed(1)}${BE.enabled && me() ? ` · 받은 신고 ${repCount(me().uid)}건` : ''}</p></div></div>
    ${walletBox}
    <div class="stats"><a href="#/my/items"><b>${S.mine.length}</b><span>내 물품</span></a><a href="#/wishlist"><b>${S.wish.length}</b><span>관심</span></a><a href="#/my/history"><b>${S.reqs.length}</b><span>거래내역</span></a></div>
    <div class="menu">
      ${row('#/my/items', 'list', '내가 등록한 물품')}
      ${row('#/my/history', 'clock', '대여 · 교환 내역')}
      ${row('#/calendar', 'cal', '대여 캘린더 · 반납 알림')}
      ${row('#/wishlist', 'heart', '관심 목록')}
      ${row('#/match', 'sparkle', '내 근처 교환 매칭')}
      ${row('#/keywords', 'tag', '키워드 알림 설정')}
      ${row('#/notifications', 'bell', '알림')}</div>
    <div class="menu" style="margin-top:14px">
      ${row('#/my/blocked', 'ban', '차단 관리', S.blocked.length ? `<small class="cntb">${S.blocked.length}</small>` : '')}
      ${row('#/my/reports', 'flag', '신고 내역', S.reports.length ? `<small class="cntb">${S.reports.length}</small>` : '')}
      <button data-act="showonb">${I('info', 20)}이용 안내 · 면책 고지</button>
      <button data-act="logout">${I('out', 20)}로그아웃</button>
      ${BE.enabled ? '' : `<button data-act="reset">${I('reset', 20)}데이터 초기화 (시연용)</button>`}</div><div class="safe"></div>
    </div>${nav('my')}</div>`;
  }
  function MyItems() {
    return `<div class="screen">${topbar({ title: '내가 등록한 물품', right: `<a class="ib" href="#/register">${I('plus')}</a>` })}<div class="content"><div class="list">${S.mine.length ? S.mine.map(i => card(i, { del: true })).join('') : empty('📦', '등록한 물품이 없어요.<br>우측 상단 + 버튼으로 첫 물품을 올려보세요!')}</div></div></div>`;
  }
  const reqRole = r => r.role || (/^조건 제안/.test(r.detail) ? 'lend' : /^대여/.test(r.detail) ? 'borrow' : null);
  const isPending = r => !!reqRole(r) && ['승인 대기', '제안함'].includes(r.state);
  function History() {
    const pend = S.reqs.filter(isPending).length;
    const cls = st => st === '취소됨' ? 'st-off' : ['승인 대기', '제안함'].includes(st) ? 'st-wait' : '';
    return `<div class="screen">${topbar({ title: '대여 · 교환 내역' })}<div class="content">
    ${pend ? `<p class="histnote">상대가 수락하고 물건을 주고받았다면 <b>‘대여 시작’</b>을 눌러주세요. 그때부터 캘린더에 반영돼요.</p>` : ''}
    ${S.reqs.length ? S.reqs.map(r => `<div class="hist hrow"><a href="#/item/${r.itemId}" class="hl"><b>${esc(r.title)}</b><small>${esc(r.detail)} · ${ago(r.ts)}</small></a>
      <div class="hr"><span class="state ${cls(r.state)}">${esc(r.state)}</span>${isPending(r) ? `<div class="bt"><button data-act="rstart" data-id="${r.id}">대여 시작</button><button class="x" data-act="rcancel" data-id="${r.id}">취소</button></div>` : ''}</div></div>`).join('') : empty('🧾', '아직 거래 내역이 없어요.')}</div></div>`;
  }
  function Blocked() {
    return `<div class="screen">${topbar({ title: '차단 관리' })}<div class="content">${S.blocked.length ? S.blocked.map(n => `<div class="hist"><div><b>🙂 ${esc(n)}</b><small>차단한 회원 · 글과 채팅이 보이지 않아요</small></div><button class="btn line" style="height:38px;font-size:14px" data-act="unblock" data-n="${esc(n)}">해제</button></div>`).join('') : empty('🚫', '차단한 회원이 없어요.')}<p class="hint2" style="padding:16px 20px">불쾌하거나 위험한 회원은 게시글·채팅방의 ⋯ 메뉴에서 신고하거나 차단할 수 있어요.</p></div></div>`;
  }
  function Reports() {
    return `<div class="screen">${topbar({ title: '신고 내역' })}<div class="content">${S.reports.length ? S.reports.map(r => `<div class="hist"><div><b>${esc(r.seller)} · ${esc(r.reason)}</b><small>${esc(r.title)} · ${ago(r.ts)}</small></div><span class="state">접수됨</span></div>`).join('') : empty('🚩', '접수한 신고가 없어요.')}</div></div>`;
  }

  /* ---------- 로그인 · 캘린더 · 리뷰 · 실시간 채팅 화면 ---------- */
  function Login() {
    const up = loginMode === 'up';
    return `<div class="screen login"><div class="lg-logo">쉐어<br>메이트</div><p class="lg-sub">${up ? '간단히 가입하고<br>빌리고, 나누고, 바꿔보세요' : '로그인하고 직접<br>대여 · 교환 · 채팅해요'}</p>
    <form class="lgform" data-form="login" autocomplete="on" novalidate>${up ? '<input name="name" placeholder="닉네임 (2~12자, 거래 상대에게 보여요)" maxlength="12" autocomplete="nickname">' : ''}
      <input name="email" type="email" placeholder="이메일" autocomplete="email" inputmode="email">
      <input name="pw" type="password" placeholder="${up ? '비밀번호 (8자 이상, 영문+숫자)' : '비밀번호'}" autocomplete="${up ? 'new-password' : 'current-password'}">
      ${up ? '<input name="pw2" type="password" placeholder="비밀번호 확인" autocomplete="new-password">' : ''}
      <p class="lg-err" id="lgErr" role="alert"></p>
      <button class="btn pri block" style="--acc:var(--pri)">${up ? '가입하기' : '로그인'}</button></form>
    ${up ? '' : '<button class="lg-sw" data-act="pwreset">비밀번호를 잊으셨나요?</button>'}
    <button class="lg-sw" data-act="lmode">${up ? '이미 계정이 있어요' : '이메일로 새로 가입하기'}</button>
    ${BE.enabled ? '' : '<p class="lg-note">데모 모드예요 · 계정은 이 브라우저에만 저장돼요</p>'}</div>`;
  }

  /* ---------- 계정 ---------- */
  const ACC_KEY = 'sharemate.accounts', SES_KEY = 'sharemate.session';
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, NICK_RE = /^[가-힣a-zA-Z0-9_]{2,12}$/;
  const accs = () => { try { return JSON.parse(localStorage.getItem(ACC_KEY) || '{}'); } catch (e) { return {}; } };
  async function hashPw(pw, salt) {
    const data = new TextEncoder().encode(salt + ':' + pw);
    if (window.crypto && crypto.subtle) { const b = await crypto.subtle.digest('SHA-256', data); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
    let h = 5381; data.forEach(c => { h = ((h << 5) + h + c) >>> 0; }); return 'f' + h.toString(16);
  }
  function validateAuth(mode, d) {
    if (!EMAIL_RE.test(d.email)) return ['email', '이메일 형식이 올바르지 않아요'];
    if (mode === 'up') {
      if (!NICK_RE.test(d.name)) return ['name', '닉네임은 2~12자, 한글·영문·숫자·_ 만 쓸 수 있어요'];
      if (d.pw.length < 8 || !/[A-Za-z]/.test(d.pw) || !/\d/.test(d.pw)) return ['pw', '비밀번호는 8자 이상, 영문과 숫자를 함께 넣어주세요'];
      if (d.pw !== d.pw2) return ['pw2', '비밀번호가 서로 달라요'];
    } else if (!d.pw) return ['pw', '비밀번호를 입력해주세요'];
    return null;
  }
  const startLocal = x => { LOCAL.user = { uid: x.uid, name: x.name, email: x.email }; localStorage.setItem(SES_KEY, x.uid); enterApp(); };
  LOCAL.signUp = async (email, pw, name) => {
    const a = accs(); if (a[email]) throw { code: 'auth/email-already-in-use' };
    if (Object.values(a).some(x => x.name.toLowerCase() === name.toLowerCase())) throw { code: 'local/nickname-taken' };
    const salt = Math.random().toString(36).slice(2), uid = 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    a[email] = { uid, name, email, salt, hash: await hashPw(pw, salt), createdAt: Date.now() };
    localStorage.setItem(ACC_KEY, JSON.stringify(a)); startLocal(a[email]);
  };
  LOCAL.signIn = async (email, pw) => {
    const x = accs()[email]; if (!x || x.hash !== await hashPw(pw, x.salt)) throw { code: 'auth/invalid-credential' };
    startLocal(x);
  };
  LOCAL.restore = () => { const uid = localStorage.getItem(SES_KEY), x = Object.values(accs()).find(a => a.uid === uid); LOCAL.user = x ? { uid: x.uid, name: x.name, email: x.email } : null; };

  function enterApp() {
    const u = me();
    closeSheet(true); onbEl.className = 'onb'; onbEl.innerHTML = '';
    if (!u) { curUid = null; S = freshState(); loginMode = 'in'; render(); return; }
    loadState(u.uid);
    if (BE.enabled) {
      S.mine = BE.items.filter(i => i.uid === u.uid);
      /* 예전 데모 데이터(샘플 글 id: 숫자/x…)가 남아 있으면 정리 */
      const demo = id => /^\d+$|^x\d/.test(String(id));
      S.wish = S.wish.filter(id => !demo(id)); S.reqs = S.reqs.filter(r => !demo(r.itemId)); S.rentals = S.rentals.filter(r => !demo(r.itemId));
      S.extra = []; Object.keys(S.chats).forEach(id => { if (demo(id)) delete S.chats[id]; }); save();
    }
    render();
    if (!S.onboarded) showOnb(false); else A.locate(true);
    checkDue(true);
  }

  function Calendar() {
    const now = new Date(), base = new Date(now.getFullYear(), now.getMonth() + calOff, 1), y = base.getFullYear(), m = base.getMonth();
    const n = new Date(y, m + 1, 0).getDate(), today = lymd(now), act = S.rentals.filter(r => r.state === 'active');
    let cells = '<i></i>'.repeat(base.getDay());
    for (let d = 1; d <= n; d++) {
      const k = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, inR = act.filter(r => k >= r.start && k <= r.end);
      cells += `<span class="${k === today ? 'today ' : ''}${inR.length ? 'rg ' + inR[0].role : ''}${act.some(r => r.end === k) ? ' end' : ''}">${d}</span>`;
    }
    const rows = [...S.rentals].sort((a, b) => (a.state === 'active' ? 0 : 1) - (b.state === 'active' ? 0 : 1) || a.end.localeCompare(b.end));
    const al = S.alarm, perm = 'Notification' in window ? Notification.permission : 'unsupported';
    return `<div class="screen">${topbar({ title: '대여 캘린더', right: homeBtn })}<div class="content">
    <div class="calhead"><button class="ib" data-act="calnav" data-d="-1" aria-label="이전 달">${I('back')}</button><b>${y}년 ${m + 1}월</b><button class="ib" data-act="calnav" data-d="1" aria-label="다음 달">${I('right')}</button></div>
    <div class="calgrid">${['일', '월', '화', '수', '목', '금', '토'].map(w => `<em>${w}</em>`).join('')}${cells}</div>
    <div class="callegend"><span class="lg borrow"></span>빌린 기간<span class="lg lend"></span>빌려준 기간<span class="lg end"></span>반납일</div>
    <div class="alarmbox"><div class="ah"><b>${I('bell', 18)} 반납 기간 알림</b><button class="sw ${al.on ? 'on' : ''}" data-act="alarm" aria-label="알림 켜기/끄기"><i></i></button></div>
      <div class="chips" style="padding:8px 0 0;flex-wrap:wrap">${[[3, '3일 전'], [1, '1일 전'], [0, '당일']].map(([d, l]) => `<button class="chip ${al.days.includes(d) ? 'on' : ''}" data-act="aday" data-d="${d}">${l}</button>`).join('')}</div>
      ${perm === 'default' ? `<button class="btn line block" style="margin-top:10px;height:42px;font-size:14px" data-act="notifperm">브라우저 알림 허용하기</button>` : `<p class="hint2" style="padding:8px 0 0">${perm === 'granted' ? '브라우저 알림이 켜져 있어요. 앱을 열어둔 동안 알려드려요.' : perm === 'denied' ? '브라우저 알림이 차단돼 있어요. 앱 안 알림(🔔)으로만 알려드려요.' : '이 브라우저는 시스템 알림을 지원하지 않아요.'}</p>`}</div>
    ${S.reqs.filter(isPending).length ? `<a class="pendlink" href="#/my/history">⏳ 확정 전 대여 신청 ${S.reqs.filter(isPending).length}건 · ‘대여 시작’을 누르면 캘린더에 반영돼요</a>` : ''}
    <div class="sec-h"><h3>내 대여 일정</h3></div>
    ${rows.length ? rows.map(r => {
      const dl = dLeft(r.end), done = r.state === 'returned', b = r.role === 'borrow', it = byId(r.itemId);
      const tag = done ? '완료' : dl < 0 ? `연체 ${-dl}일` : dl === 0 ? 'D-DAY' : 'D-' + dl;
      return `<div class="rrow ${done ? 'done' : dl <= 1 ? 'warn' : ''}"><a href="#/item/${r.itemId}" class="rt"><span class="rb ${r.role}">${b ? '빌림' : '빌려줌'}</span><b>${esc(r.title)}</b><small>${r.start.slice(5).replace('-', '/')} ~ ${r.end.slice(5).replace('-', '/')}</small></a><span class="dd">${tag}</span>
        <div class="ra">${done ? (b && it && canReview(it) ? `<button data-act="revw" data-id="${r.itemId}">리뷰 쓰기</button>` : '') : `<button data-act="rret" data-id="${r.id}">${b ? '반납 완료' : '회수 완료'}</button>`}<button data-act="rdel" data-id="${r.id}" aria-label="삭제">${I('close', 14)}</button></div></div>`;
    }).join('') : empty('📅', '확정된 대여 일정이 없어요.<br>대여가 시작되면(내역 → 대여 시작) 반납일이 여기에 표시돼요.')}
    <div class="safe"></div></div>${nav('cal')}</div>`;
  }

  function Seller(key) {
    const items = vis().filter(i => sKey(i) === key), rs = allRev().filter(r => r.sKey === key), name = (items[0] && items[0].seller) || (rs[0] && rs[0].seller) || key;
    const avg = avgOf(rs);
    return `<div class="screen">${topbar({ title: name + '님의 리뷰', right: homeBtn })}<div class="content">
    <div class="rsum"><b>${avg}</b><span class="st">${avg === '-' ? '☆☆☆☆☆' : '★'.repeat(Math.round(avg)) + '☆'.repeat(5 - Math.round(avg))}</span><small>리뷰 ${rs.length}개 · 올린 물품 ${items.length}개</small></div>
    ${items.length ? items.map(it => { const l = revFor(it.id); return `<section class="ritem"><a href="#/item/${it.id}" class="rhead"><div class="thumb" style="background:${it.bg}">${thumbIn(it)}</div><div><b>${esc(it.title)}</b><small>${it.type === 'rent' ? '대여' : '교환'} · 리뷰 ${l.length}개${l.length ? ' · ★' + avgOf(l) : ''}</small></div></a>
      ${l.length ? l.map(r => `<div class="rv"><div class="st">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div><p>${esc(r.text)}</p><small>${esc(r.author)} · ${ago(r.ts)}</small></div>`).join('') : '<p class="meta" style="padding:2px 20px 14px">아직 리뷰가 없어요</p>'}</section>`; }).join('') : empty('📦', '이 판매자가 올린 물품이 없어요.')}
    </div></div>`;
  }

  /* Firebase 실시간 채팅방 (직관적인 송금 버튼 포함) */
  function RChat(id) {
    const rm = BE.rooms.find(r => r.id === id) || BE.roomCache[id];
    if (!rm) return `<div class="screen">${topbar()}${empty('🫥', '대화방을 찾을 수 없어요.')}</div>`;
    const name = (rm.names && rm.names[BE.partner(rm, BE.user.uid)]) || '상대방', it = byId(rm.itemId);
    return `<div class="screen">${topbar({ title: name, right: homeBtn + (it && !isMine(it) ? `<button class="ib" data-act="more" data-id="${it.id}" aria-label="더보기">${I('more')}</button>` : '') })}
    <a class="chat-item" href="#/item/${rm.itemId}"><div class="thumb" style="background:${rm.itemBg}">${rm.itemEmoji}</div><div style="flex:1"><b>${esc(rm.itemTitle)}</b></div>
      <button data-act="rremit" data-id="${id}" style="background:var(--pri);color:#fff;border:none;border-radius:10px;padding:7px 11px;font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap">💸 송금하기</button></a>
    <div class="content" id="msgbox"><div class="msgs"></div></div>
    <form class="composer" data-form="rchat" data-id="${id}" style="gap:6px">
      <button type="button" data-act="rremit" data-id="${id}" aria-label="송금하기" style="width:auto;padding:0 11px;border-radius:12px;background:#e6f7f0;color:#0d7a4f;border:1px solid #b5ebd4;font-weight:800;font-size:13px;white-space:nowrap;flex-shrink:0">💸 송금</button>
      <input name="t" placeholder="메시지를 입력하세요" autocomplete="off"><button aria-label="전송">${I('send', 20)}</button></form></div>`;
  }
  let roomMsgs = [], roomId = null;
  function drawRoom() {
    const b = $('.msgs'); if (!b) return;
    const rm = BE.rooms.find(r => r.id === roomId) || BE.roomCache[roomId] || {};
    const pRead = (rm.read && rm.members && rm.read[BE.partner(rm, BE.user.uid)]) || 0;
    const mb = $('#msgbox'), atBottom = !mb || mb.scrollHeight - mb.scrollTop - mb.clientHeight < 80;
    b.innerHTML = roomMsgs.map(m => {
      const from = m.type === 'sys' ? 'sys' : m.from === BE.user.uid ? 'me' : 'them';
      return msgHtml({ from, text: m.text, t: m.t, unread: from === 'me' && (m.t || 0) > pRead });
    }).join('') || '<div class="msg sys">대화를 시작해보세요 🙂</div>';
    if (mb && atBottom) mb.scrollTop = 1e9;
  }
  function watchRoom(id) {
    roomId = id; roomMsgs = [];
    unwatch = BE.watch(id, ms => { roomMsgs = ms; drawRoom(); if (curRoom === id && !document.hidden) BE.markRead(id); });
  }
  function remoteRows() {
    if (!BE.enabled || !BE.user) return '';
    return BE.rooms.filter(r => !S.blocked.includes(r.names && r.names[BE.partner(r, BE.user.uid)])).map(r => {
      const o = (r.names && r.names[BE.partner(r, BE.user.uid)]) || '상대방';
      const preview = r.last && r.last.startsWith('[송금완료]') ? '💸 송금을 보냈어요' : (r.last || '대화를 시작해보세요');
      return `<a class="chatrow" href="#/rchat/${r.id}">${avThumb(BE.partner(r, BE.user.uid))}<div class="t"><b>${esc(o)}</b> <small>· ${esc(r.itemTitle)}</small><p>${esc(preview)}</p></div><small>${ago(r.ts)}</small>${roomUnread(r) ? '<i class="udot"></i>' : ''}</a>`;
    }).join('');
  }
  function chatTo(it, sys, msg) {
    if (BE.enabled && it.uid) {
      BE.openRoom(it).then(async rid => { await BE.send(rid, sys, 'sys'); if (msg) await BE.send(rid, msg); go('#/rchat/' + rid); }).catch(e => toast('채팅을 열 수 없어요 (' + (e.code || e.message) + ')'));
      return;
    }
    sysThread(it.id, sys); if (msg) sendChat(it.id, msg); go('#/chat/' + it.id);
  }

  /* 게시글 수정 */
  function syncFood(f) {
    const food = f.elements.main.value === '음식';
    f.querySelector('.only-food').hidden = !food;
    if (food) f.setAttribute('data-food', ''); else f.removeAttribute('data-food');
  }
  function prefill(id) {
    const it = S.mine.find(i => i.id === id), f = $('#regform'); if (!it || !f) return;
    const E = f.elements, [m, sub] = it.cat.split(' > ');
    f.dataset.edit = id; f.dataset.type = it.type; f.dataset.kind = it.kind;
    f.querySelector(`[name=type][value=${it.type}]`).checked = true; f.querySelector(`[name=kind][value=${it.kind}]`).checked = true;
    E.main.value = m; E.sub.innerHTML = CATS[m].map(c => `<option>${c}</option>`).join(''); E.sub.value = sub;
    E.title.value = it.title; E.desc.value = it.desc; E.cond.value = it.cond; E.loc.value = it.loc;
    if (it.type === 'rent') { E.term.value = it.term; E.unit.value = it.unit; E.kw.value = it.kw || ''; if (it.kind === 'offer') { E.price.value = it.price; E.deposit.value = it.deposit || ''; } } else E.wish.value = it.wish;
    syncFood(f); if (it.expiry) E.expiry.value = it.expiry;
    meet = hasMeet(it) ? { lat: it.mlat, lng: it.mlng } : null;
    if (it.img) { photoData = it.img; $('#photoBox').innerHTML = `<img src="${photoData}" alt=""><input type="file" accept="image/*" id="photoIn">`; }
  }

  /* 새 글 알림은 내가 등록한 키워드가 '제목·카테고리·(대여)키워드칸'에 있을 때만 (설명 본문은 제외) */
  function kwNote(it) {
    if (!it || isMine(it) || S.blocked.includes(it.seller) || stOf(it) === 'done') return null;
    if (it.type === 'rent') {
      const h = (mhay(it) + ' ' + (it.kw || '')).toLowerCase();
      const k = S.kwRent.map(w => w.trim()).filter(Boolean).find(w => h.includes(w.toLowerCase()));
      return k ? ['🔔', `대여 키워드 ‘${k}’ 새 글이 올라왔어요: ${it.title}`] : null;
    }
    const mh = mhay(it), hits = barterKw().filter(w => w && mh.includes(w));
    return hits.length && (distOf(it) ?? 0) <= S.radius ? ['💘', `희망 키워드 ‘${hits[0]}’ 교환 글이 올라왔어요${distOf(it) != null ? ' (' + distOf(it) + 'km)' : ''}: ${it.title}`] : null;
  }
  function addRental(it, role, nDays, reqId) {
    if (reqId && S.rentals.some(r => r.reqId === reqId)) return;
    const start = lymd(new Date());
    S.rentals.unshift({ id: 'c' + Date.now(), reqId, itemId: it.id, title: it.title, role, start, end: addDays(start, Math.max(1, Math.round(nDays))), state: 'active', confirmed: true });
    save(); checkDue(true);
  }
  function releaseItem(itemId, exceptReq) {
    if (S.over[itemId] !== 'reserved') return;
    if (S.reqs.some(x => x.itemId === itemId && x.id !== exceptReq && x.state === '승인 대기')) return;
    delete S.over[itemId]; const it = S.mine.find(m => m.id === itemId); if (it && it.status === 'reserved') it.status = 'open';
  }
  function checkDue(quiet) {
    if (!S.alarm.on) return;
    S.rentals.filter(r => r.state === 'active').forEach(r => {
      const dl = dLeft(r.end), key = r.id + ':' + (dl < 0 ? 'late' + lymd(new Date()) : dl);
      if (!(dl < 0 || S.alarm.days.includes(dl)) || S.notified.includes(key)) return;
      S.notified.push(key);
      const v = r.role === 'borrow' ? '반납' : '회수';
      const txt = dl < 0 ? `‘${r.title}’ ${v} 기한이 ${-dl}일 지났어요` : dl === 0 ? `오늘은 ‘${r.title}’ ${v}일이에요` : `‘${r.title}’ ${v}까지 ${dl}일 남았어요`;
      addNote('⏰', txt, '#/calendar');
      if ('Notification' in window && Notification.permission === 'granted') { try { new Notification('쉐어메이트', { body: txt }); } catch (e) { } }
      if (!quiet) toast('⏰ ' + txt);
    });
    S.notified = S.notified.slice(-200); save();
  }
  function softRender() { if (layer.classList.contains('open')) return; if (/^#\/(register|chat\/|rchat|keywords|search)/.test(location.hash)) return; render(); }

  /* ---------- 라우터 ---------- */
  function render() {
    killMaps();
    if (unwatch) { unwatch(); unwatch = null; }
    if (curRoom) { markRead(curRoom); curRoom = null; }
    if (BE.enabled && !BE.ready) { view.innerHTML = '<div class="screen login"><div class="lg-logo">쉐어<br>메이트</div><p class="lg-sub">불러오는 중…</p></div>'; return; }
    if (!me()) { view.innerHTML = Login(); return; }
    if (suspended()) { view.innerHTML = `<div class="screen login"><div class="lg-logo">🚫</div><p class="lg-sub" style="line-height:1.7">서로 다른 회원 ${SUSPEND_N}명 이상에게 신고되어<br><b>계정 이용이 정지</b>됐어요.<br>문의: 운영자에게 연락해주세요.</p><button class="btn line block" style="margin-top:20px" data-act="logout">로그아웃</button></div>`; return; }
    const h = location.hash.slice(1) || '/';
    const [p, qs] = h.split('?'); const seg = p.split('/').filter(Boolean); const q = new URLSearchParams(qs || '');
    let html;
    if (seg[0] !== 'list') MUT = new Map();
    switch (seg[0]) {
      case undefined: html = Main(); break;
      case 'list': html = List(seg[1] === 'barter' ? 'barter' : 'rent'); break;
      case 'item': html = Detail(seg[1]); break;
      case 'register': photoData = null; meet = null; html = Register(q); break;
      case 'search': {
        const kw = q.get('q'); if (kw && !S.recent.includes(kw)) { S.recent = [kw, ...S.recent].slice(0, 8); save(); }
        html = Search(q); break;
      }
      case 'match': html = Match(); break;
      case 'keywords': html = Keywords(); break;
      case 'wishlist': html = Wishlist(); break;
      case 'notifications': html = Notes(); break;
      case 'chats': html = Chats(); break;
      case 'chat': html = Chat(seg[1]); break;
      case 'rchat': html = BE.enabled ? RChat(seg[1]) : Main(); break;
      case 'calendar': html = Calendar(); break;
      case 'seller': html = Seller(decodeURIComponent(seg[1] || '')); break;
      case 'my': html = seg[1] === 'items' ? MyItems() : seg[1] === 'history' ? History() : seg[1] === 'blocked' ? Blocked() : seg[1] === 'reports' ? Reports() : My(); break;
      default: html = Main();
    }
    view.innerHTML = html;
    closeSheet(true);
    if (seg[0] === 'chat' || seg[0] === 'rchat') { curRoom = seg[1]; markRead(curRoom); }
    if (seg[0] === 'register' && q.get('edit')) prefill(q.get('edit'));
    if (seg[0] === 'register') syncMeet();
    if (seg[0] === 'item') initMeetMap(seg[1]);
    if (seg[0] === 'rchat' && BE.enabled) watchRoom(seg[1]);
    const mb = $('#msgbox'); if (mb) mb.scrollTop = mb.scrollHeight;
    if (seg[0] === 'search' && !q.get('q') && !q.get('cat')) { const si = $('.searchbar input'); if (si) si.focus(); }
  }
  function rerender() { render(); const s = $('.screen'); if (s) s.style.animation = 'none'; }
  window.addEventListener('hashchange', render);

  /* ---------- 거래 장소 지도 (Leaflet + OpenStreetMap · API 키 필요 없음) ---------- */
  let MAPS = [], sheetMap = null, pickMk = null, pick = null, pickName = '', meet = null;
  const hasMeet = it => !!it && Number.isFinite(it.mlat) && Number.isFinite(it.mlng);
  const mapOK = () => !!window.L;
  const kname = it => encodeURIComponent(String(it.loc || '거래 장소').replace(/[,\s]+/g, ' ').trim());
  const kakaoTo = it => `https://map.kakao.com/link/to/${kname(it)},${it.mlat},${it.mlng}`;
  const pinIcon = type => L.divIcon({ className: 'pinwrap', html: `<div class="pinmk ${type === 'barter' ? 'bar' : ''}"></div>`, iconSize: [34, 34], iconAnchor: [17, 41] });
  function newMap(el, c, z, opt) {
    const m = L.map(el, Object.assign({ center: c, zoom: z }, opt));
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(m);
    MAPS.push(m); return m;
  }
  function killMaps() { MAPS.forEach(m => { try { m.remove(); } catch (e) { } }); MAPS = []; sheetMap = null; pickMk = null; }
  function sheetMapNew(el, c, z) {                       // 시트(바텀시트) 안의 지도: 한 번에 하나만
    if (sheetMap) { try { sheetMap.remove(); } catch (e) { } MAPS = MAPS.filter(m => m !== sheetMap); }
    pickMk = null; sheetMap = newMap(el, c, z, {});
    setTimeout(() => { try { sheetMap && sheetMap.invalidateSize(); } catch (e) { } }, 350);   // 시트가 올라온 뒤 크기 재계산
    return sheetMap;
  }
  /* 글 상세: 작은 지도 (누르면 크게 보기) */
  function initMeetMap(id) {
    const el = $('#meetmap'), it = byId(id); if (!el || !hasMeet(it)) return;
    if (!mapOK()) { el.innerHTML = '<div class="mapfail">지도를 불러오지 못했어요.<br>인터넷 연결을 확인해주세요.</div>'; return; }
    const c = [it.mlat, it.mlng];
    const m = newMap(el, c, 16, { zoomControl: false, dragging: false, touchZoom: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false });
    L.marker(c, { icon: pinIcon(it.type), interactive: false }).addTo(m);
    m.on('click', () => A.mapview({ dataset: { id } }));
  }
  /* 글 등록/수정: 위치 선택 */
  function syncMeet() {
    const b = $('#meetstat'); if (!b) return;
    b.innerHTML = meet
      ? `<span class="meetok">${I('check', 16)} 지도에 위치가 표시됐어요</span><span><button type="button" data-act="mappick">변경</button><button type="button" data-act="mapclear">삭제</button></span>`
      : `<button type="button" class="mapbtn" data-act="mappick">${I('pin', 18)} 지도에서 위치 선택</button>`;
  }
  function setPick(lat, lng) {
    pick = { lat, lng };
    if (!sheetMap) return;
    if (!pickMk) {
      const f = $('#regform');
      pickMk = L.marker([lat, lng], { icon: pinIcon(f && f.dataset.type), draggable: true }).addTo(sheetMap);
      pickMk.on('dragend', () => { const p = pickMk.getLatLng(); pick = { lat: p.lat, lng: p.lng }; pickName = ''; });
    } else pickMk.setLatLng([lat, lng]);
  }
  function mapSearch(q) {                                // 장소·주소 검색 (OpenStreetMap Nominatim)
    q = q.trim(); if (!q || !sheetMap) return;
    toast('검색 중…');
    fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=ko&q=' + encodeURIComponent(q))
      .then(r => r.json()).then(a => {
        if (!sheetMap) return;
        if (!a.length) return toast('검색 결과가 없어요. 다른 이름이나 주소로 찾아보세요');
        const p = a[0], la = +p.lat, ln = +p.lon;
        sheetMap.setView([la, ln], 17); setPick(la, ln);
        pickName = String(p.name || (p.display_name || '').split(',')[0] || q).trim();
      }).catch(() => toast('검색에 실패했어요. 지도를 직접 눌러 선택해주세요'));
  }

  /* ---------- 시트 / 토스트 ---------- */
  function sheet(html, side) {
    layer.innerHTML = `<div class="dim" data-act="close"></div><div class="sheet ${side ? 'side drawer' : ''}">${html}</div>`;
    requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('open')));
  }
  function closeSheet(now) {
    layer.classList.remove('open');
    if (now) layer.innerHTML = ''; else setTimeout(() => { if (!layer.classList.contains('open')) layer.innerHTML = ''; }, 280);
  }
  let tt;
  function toast(m) { toastEl.textContent = m; toastEl.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => toastEl.classList.remove('show'), 2200); }
  const go = h => { location.hash = h; };

  /* ---------- 첫 접속 안내 + 면책 ---------- */
  const ONB = [
    { em: '🤝', t: '쉐어메이트에 오신 걸 환영해요', d: '필요한 물건은 빌리고, 안 쓰는 물건은 바꿔 쓰는<br>우리 학교 공유 장터예요.' },
    { em: '📦', t: '대여 · 물물교환', d: '<b>대여</b>는 기간과 보증금을 정해 빌려 쓰고, <b>물물교환</b>은 서로 원하는 물건을 맞바꿔요.<br>필요한 물건은 <b>대여 요청</b>으로 올려보세요. 조건은 빌려주는 분이 제안해요.' },
    { em: '✨', t: '매칭과 키워드 알림', d: '내 근처에서 내가 원하는 물건을 올린 사람을 <b>매칭</b>해 드려요.<br>키워드를 등록하면 새 글이 올라올 때 <b>알림</b>이 와요.' },
    { em: '⚠️', t: '거래 전에 꼭 확인해주세요', warn: true }
  ];
  let onbStep = 0, onbReopen = false;
  function drawOnb() {
    const s = ONB[onbStep], last = onbStep === ONB.length - 1;
    const warn = `<div class="warn"><b>회원 간 거래에 대한 책임 안내</b>
    <p>쉐어메이트는 회원 사이의 거래(대여·교환·금전 거래)를 연결해 주는 서비스예요. 물품의 상태, 사기, 분실·파손, 분쟁 등 <b>회원 간 거래에서 생기는 모든 문제에 대해 쉐어메이트는 책임을 지지 않아요.</b></p>
    <p>거래는 회원 본인의 책임으로 이루어져요. 학교 안 공개된 장소에서 만나고, 의심스러운 회원은 <b>신고·차단</b>해주세요.</p></div>
    <label class="agree"><input type="checkbox" id="onbAgree" ${onbReopen ? 'checked' : ''}><span>위 내용을 확인했고 동의합니다</span></label>`;
    onbEl.className = 'onb show';
    onbEl.innerHTML = `<div class="onb-card ${s.warn ? 'w' : ''}">
    ${onbReopen ? `<button class="onb-x" data-act="onbdone" aria-label="닫기">${I('close')}</button>` : ''}
    <div class="onb-em">${s.em}</div><h2>${s.t}</h2>${s.warn ? warn : `<p class="onb-d">${s.d}</p>`}
    <div class="dots">${ONB.map((_, i) => `<i class="${i === onbStep ? 'on' : ''}"></i>`).join('')}</div>
    <div class="onb-act">${!last ? '<button class="skip" data-act="onbskip">건너뛰기</button>' : ''}
      <button class="btn pri" id="onbGo" data-act="${last ? 'onbdone' : 'onbnext'}" ${last && !onbReopen ? 'disabled' : ''}>${last ? (onbReopen ? '확인' : '동의하고 시작하기') : '다음'}</button></div></div>`;
  }
  function showOnb(reopen) { onbStep = reopen ? ONB.length - 1 : 0; onbReopen = !!reopen; drawOnb(); }

  /* ---------- 채팅 로직 ---------- */
  function thread(id) { if (!S.chats[id]) S.chats[id] = { msgs: [], ts: Date.now() }; return S.chats[id]; }
  function pushMsg(id, from, text) {
    const th = thread(id);
    if (from === 'them') th.msgs.forEach(m => { if (m.from === 'me') m.unread = false; });   // 상대가 답장 = 내 메시지 읽음
    th.msgs.push({ from, text, t: Date.now(), ...(from === 'me' ? { unread: true } : {}) }); th.ts = Date.now(); save();
  }
  function sysThread(id, text) {
    const th = thread(id);
    if (!th.msgs.length) th.msgs.push({ from: 'sys', text: '대화가 시작됐어요. 안전한 거래를 위해 학교 안에서 만나세요 🙂', t: Date.now() });
    if (text) th.msgs.push({ from: 'sys', text, t: Date.now() });
    th.ts = Date.now(); save();
  }
  function sendChat(id, text) {
    text = text.trim(); if (!text) return;
    const it = byId(id); if (it && S.blocked.includes(it.seller)) return toast('차단한 회원에게는 메시지를 보낼 수 없어요');
    pushMsg(id, 'me', text);
    const box = $('.msgs'); if (box) { box.insertAdjacentHTML('beforeend', msgHtml({ from: 'me', text, t: Date.now(), unread: true })); $('#msgbox').scrollTop = 1e6; }
    if (text.startsWith('[송금완료]')) return;
    const reply = /가능|있나요|남았/.test(text) ? '네, 아직 가능해요! 😊' : /장소|어디/.test(text) ? '학교 정문 앞 카페나 도서관 로비 어때요?' : /가격|깎|조정|네고/.test(text) ? '조금은 조정할 수 있어요. 생각하는 금액 있으세요?' : /감사|고마/.test(text) ? '저도 감사해요! 좋은 거래 해요 🙌' : '네 확인했어요! 편하신 시간 알려주세요 🙌';
    setTimeout(() => {
      if (S.blocked.includes(byId(id)?.seller)) return;
      pushMsg(id, 'them', reply);
      if (location.hash === '#/chat/' + id) { const b = $('.msgs'); if (b) { b.querySelectorAll('.r1').forEach(x => x.remove()); b.insertAdjacentHTML('beforeend', msgHtml({ from: 'them', text: reply, t: Date.now() })); $('#msgbox').scrollTop = 1e6; } }
      else addNote('💬', `${byId(id)?.seller || '상대방'}님이 메시지를 보냈어요: ${reply}`, '#/chat/' + id);
    }, 1100);
  }

  /* ---------- 사진 리사이즈 ---------- */
  let photoData = null;
  function readPhoto(file) {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 720, k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k;
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        photoData = c.toDataURL('image/jpeg', 0.75);
        $('#photoBox').innerHTML = `<img src="${photoData}" alt=""><input type="file" accept="image/*" id="photoIn">`;
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  }

  /* ---------- 오픈뱅킹 계좌 연결 & 간편송금 시트 ---------- */
  function openLinkAccountSheet(onDone) {
    const randAcc = '110-' + (100 + Math.floor(Math.random() * 900)) + '-' + (100000 + Math.floor(Math.random() * 900000));
    sheet(`<h3>🏦 오픈뱅킹 계좌 연결</h3>
    <p style="color:var(--sub);font-size:13px;margin-bottom:12px">이용기관코드 <b>${ORG_CODE}</b> · <b>테스트(모의) 계좌</b>예요. 실제 돈은 이동하지 않고, 연결하면 연습용 잔액 <b>1,000,000원</b>이 생겨요.</p>
    <div class="f2"><label>은행 선택</label>
      <select id="obBank" style="width:100%;height:42px;border-radius:10px;border:1px solid var(--line);padding:0 10px">
        <option>신한은행</option><option>국민은행</option><option>카카오뱅크</option><option>토스뱅크</option><option>우리은행</option><option>하나은행</option>
      </select>
    </div>
    <div class="f2"><label>계좌번호</label><input id="obAccNum" value="${randAcc}"></div>
    <button class="btn pri block" style="--acc:var(--pri);margin-top:10px" id="obLinkOk">계좌 연결 완료</button>`);
    $('#obLinkOk').onclick = () => {
      const bankName = $('#obBank').value, accountNum = $('#obAccNum').value.trim();
      if (!accountNum) return toast('계좌번호를 입력해주세요');
      const finNum = '1' + ORG_CODE.slice(1) + String(Math.floor(Math.random() * 1e14)).padStart(14, '0');
      S.account = { bankName, accountNum, fintechUseNum: finNum, balance: 1000000 };
      save();
      if (BE.enabled && BE.saveAccount) BE.saveAccount(S.account).catch(() => {});
      closeSheet(true);
      toast('계좌가 연결되었어요! (잔액 1,000,000원)');
      if (onDone) onDone(); else rerender();
    };
  }

  function openRemitSheet({ receiverName, itemTitle, presetAmt, onTransfer }) {
    if (!S.account) {
      sheet(`<h3>🏦 계좌 연결이 필요해요</h3>
      <p style="color:var(--sub);font-size:14px;line-height:1.55;margin-bottom:16px">오픈뱅킹 간편송금을 사용하려면 먼저 내 계좌를 연결해야 해요. (10초 만에 테스트 계좌 연결 가능)</p>
      <div style="display:flex;gap:10px">
        <button class="btn line" style="flex:1" data-act="close">취소</button>
        <button class="btn pri" style="flex:1;--acc:var(--pri)" id="goLinkBtn">지금 계좌 연결</button>
      </div>`);
      $('#goLinkBtn').onclick = () => openLinkAccountSheet(() => openRemitSheet({ receiverName, itemTitle, presetAmt, onTransfer }));
      return;
    }

    const acc = S.account;
    sheet(`<h3>💸 ${esc(receiverName)}님에게 송금</h3>
    <p style="color:var(--sub);font-size:13px;margin-bottom:6px">${esc(itemTitle)}</p>
    <p style="color:#8A6100;background:#FFF6DB;font-size:12px;font-weight:600;padding:7px 10px;border-radius:10px;margin-bottom:10px">연습용 모의 송금이에요 · 실제로 돈이 이동하지 않아요</p>
    <div style="background:#f4f7fb;padding:10px 12px;border-radius:12px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:12.5px;color:var(--sub)">출금: ${esc(acc.bankName)} ${esc(acc.accountNum)}</span>
      <b style="font-size:13.5px;color:var(--pri-d)">잔액 ${won(acc.balance)}</b>
    </div>
    <div class="f2"><label>송금할 금액 (원)</label>
      <input id="remitAmt" type="number" inputmode="numeric" min="1" value="${presetAmt || ''}" placeholder="보낼 금액을 입력하세요">
    </div>
    <div style="display:flex;gap:6px;margin-bottom:14px">
      <button type="button" class="chip" data-addamt="1000">+1천원</button>
      <button type="button" class="chip" data-addamt="5000">+5천원</button>
      <button type="button" class="chip" data-addamt="10000">+1만원</button>
      <button type="button" class="chip" data-addamt="50000">+5만원</button>
    </div>
    <button class="btn pri block" style="--acc:var(--pri)" id="remitGoBtn">송금 보내기</button>`);

    document.querySelectorAll('[data-addamt]').forEach(b => {
      b.onclick = () => {
        const inp = $('#remitAmt');
        inp.value = (Number(inp.value || 0) + Number(b.dataset.addamt));
      };
    });

    $('#remitGoBtn').onclick = () => {
      const amt = Math.floor(Number($('#remitAmt').value));
      if (!amt || amt <= 0) return toast('송금할 금액을 입력해주세요');
      if (acc.balance < amt) return toast('계좌 잔액이 부족해요 (현재 잔액: ' + won(acc.balance) + ')');

      const tranId = ORG_CODE + 'U' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
      acc.balance -= amt;
      S.transfers.unshift({ tranId, to: receiverName, itemTitle, amount: amt, ts: Date.now() });
      save();
      if (BE.enabled && BE.saveAccount) BE.saveAccount(acc).catch(() => {});

      const receiptMsg = `[송금완료] ${receiverName}님에게 ${won(amt)} 모의 송금을 기록했어요.\n출금계좌: ${acc.bankName} (${acc.accountNum})\n거래고유번호: ${tranId}`;
      closeSheet(true);
      toast(`💸 ${won(amt)} 송금 완료!`);
      onTransfer(receiptMsg, amt, tranId);
    };
  }

  /* ---------- 액션 ---------- */
  function setDone(it, on, partnerUid) {
    S.over[it.id] = on ? 'done' : 'open';
    if (isMine(it)) {
      it.status = S.over[it.id]; it.partnerUid = on ? (partnerUid || null) : null;
      if (BE.enabled) BE.saveItem(it).catch(e => toast('서버 저장에 실패했어요 (' + (e.code || e.message) + ')'));
    }
    save(); toast(on ? '거래 완료로 표시했어요 🎉 작성자·거래 상대방·찜한 사람만 볼 수 있어요' : '다시 열었어요'); rerender();
  }
  let repSel = null;
  const A = {
    back() { if (history.length > 1) history.back(); else go('#/'); },
    close() { closeSheet(); },
    wish(t) {
      const id = t.dataset.id; const i = S.wish.indexOf(id);
      if (i >= 0) S.wish.splice(i, 1); else { S.wish.push(id); toast('관심 목록에 담았어요 ❤️'); }
      save();
      const wi = byId(id); if (BE.enabled && BE.user && wi && wi.remote && wi.uid !== BE.user.uid) BE.setWish(id, wished(id)).catch(() => { });
      document.querySelectorAll(`[data-act="wish"][data-id="${id}"]`).forEach(b => b.classList.toggle('on', wished(id)));
      if (location.hash === '#/wishlist') rerender();
    },
    drawer() {
      sheet(`<div class="drawer-logo">쉐어메이트</div><div class="drawer">
      <a href="#/list/rent">📦 대여</a><a href="#/list/barter">🔄 물물교환</a><a href="#/match">✨ 내 근처 교환 매칭</a><a href="#/register">➕ 물품 등록</a>
      <a href="#/keywords">🔔 키워드 알림</a><a href="#/wishlist">❤️ 관심 목록</a><a href="#/chats">💬 채팅</a><a href="#/my">🙂 MY</a></div>`, true);
    },
    ltab(t) { F[t.dataset.type].tab = t.dataset.v; rerender(); },
    fsheet(t) {
      const type = t.dataset.type, k = t.dataset.k, cur = F[type][k];
      sheet(`<h3>${flabel(k)}</h3>${fopts(type, k).map(o => `<button class="opt ${o[0] === cur ? 'on' : ''}" data-act="setf" data-type="${type}" data-k="${k}" data-v="${o[0]}">${o[1]}${o[0] === cur ? I('check', 18) : ''}</button>`).join('')}`);
    },
    setf(t) { F[t.dataset.type][t.dataset.k] = t.dataset.v; rerender(); },
    radsheet() {
      sheet(`<h3>매칭 반경</h3>${[1, 2, 3, 5, 10].map(km => `<button class="opt ${km === S.radius ? 'on' : ''}" data-act="setrad" data-v="${km}">${km}km 이내${km === S.radius ? I('check', 18) : ''}</button>`).join('')}`);
    },
    setrad(t) { S.radius = +t.dataset.v; save(); rerender(); },
    mapview(t) {
      const it = byId(t.dataset.id); if (!hasMeet(it)) return;
      sheet(`<h3>거래 희망 장소</h3><p class="meetname">${I('pin', 16)} ${esc(it.loc)}</p>
        <div class="mapbox tall" id="viewmap"></div>
        <div class="meet-b"><a class="btn line" href="https://map.kakao.com/link/map/${kname(it)},${it.mlat},${it.mlng}" target="_blank" rel="noopener">카카오맵으로 보기</a><a class="btn pri" style="--acc:var(--pri)" href="${kakaoTo(it)}" target="_blank" rel="noopener">길찾기</a></div>
        <p class="hint2">작성자가 거래 희망 장소로 표시한 곳이에요. 만나기 전에 채팅으로 한 번 더 확인하세요.</p>`);
      const el = $('#viewmap'); if (!el) return;
      if (!mapOK()) { el.innerHTML = '<div class="mapfail">지도를 불러오지 못했어요.<br>인터넷 연결을 확인해주세요.</div>'; return; }
      const c = [it.mlat, it.mlng], m = sheetMapNew(el, c, 16);
      L.marker(c, { icon: pinIcon(it.type), interactive: false }).addTo(m);
    },
    mappick() {
      if (!mapOK()) return toast('지도를 불러오지 못했어요. 인터넷 연결을 확인해주세요');
      pick = meet ? { ...meet } : null; pickName = '';
      sheet(`<h3>거래 장소를 지도에서 선택</h3>
        <form class="mapsearch" data-form="mapsearch"><input name="q" placeholder="장소·주소 검색 (예: 대전역)" autocomplete="off"><button class="btn pri" style="--acc:var(--pri)">검색</button></form>
        <div class="mapbox tall" id="pickmap"></div>
        <p class="hint2">지도를 누르거나 핀을 끌어서 만날 위치를 정하세요.</p>
        <div class="meet-b"><button type="button" class="btn line" data-act="maploc">📍 내 위치</button><button type="button" class="btn pri" style="--acc:var(--pri)" data-act="mapok">이 위치로 선택</button></div>`);
      const has = pick || S.pos, c = pick ? [pick.lat, pick.lng] : S.pos ? [S.pos.lat, S.pos.lng] : [37.5665, 126.978];
      const m = sheetMapNew($('#pickmap'), c, has ? 16 : 12);
      m.on('click', ev => { pickName = ''; setPick(ev.latlng.lat, ev.latlng.lng); });
      if (pick) setPick(pick.lat, pick.lng);
    },
    maploc() {
      if (!navigator.geolocation) return toast('이 기기는 위치 기능을 지원하지 않아요');
      navigator.geolocation.getCurrentPosition(p => {
        if (!sheetMap) return;
        const la = p.coords.latitude, ln = p.coords.longitude;
        sheetMap.setView([la, ln], 17); pickName = ''; setPick(la, ln);
      }, () => toast('위치를 가져오지 못했어요. 위치 권한을 확인해주세요'), { enableHighAccuracy: true, timeout: 10000 });
    },
    mapok() {
      if (!pick) return toast('지도를 눌러 위치를 정해주세요');
      meet = { lat: +pick.lat.toFixed(6), lng: +pick.lng.toFixed(6) };
      const f = $('#regform');
      if (f && pickName && !f.elements.loc.value.trim()) f.elements.loc.value = pickName.slice(0, 20);
      syncMeet(); closeSheet(); toast('거래 장소를 지도에 표시했어요 📍');
    },
    mapclear() { meet = null; syncMeet(); },
    dtab(t) {
      document.querySelectorAll('.dtabs button').forEach(b => b.classList.toggle('on', b === t));
      document.querySelectorAll('.pane').forEach(p => p.hidden = p.dataset.pane !== t.dataset.v);
      MAPS.forEach(m => { try { m.invalidateSize(); } catch (e) { } });
    },
    chat(t) {
      const it = byId(t.dataset.id);
      if (BE.enabled && it.uid) BE.openRoom(it).then(rid => go('#/rchat/' + rid)).catch(e => toast('채팅을 열 수 없어요 (' + (e.code || e.message) + ')'));
      else { sysThread(it.id); go('#/chat/' + it.id); }
    },
    quick(t) { sendChat(t.dataset.id, t.dataset.t); },
    remit(t) {
      const it = byId(t.dataset.id); if (!it) return;
      const preset = t.dataset.amt ? Number(t.dataset.amt) : ((it.price || 0) + (it.deposit || 0));
      openRemitSheet({
        receiverName: it.seller,
        itemTitle: it.title,
        presetAmt: preset > 0 ? preset : '',
        onTransfer: (receiptMsg) => sendChat(it.id, receiptMsg)
      });
    },
    rremit(t) {
      const rid = t.dataset.id;
      const rm = BE.rooms.find(r => r.id === rid) || BE.roomCache[rid];
      if (!rm) return;
      const partnerUid = BE.partner(rm, BE.user.uid);
      const partnerName = (rm.names && rm.names[partnerUid]) || '상대방';
      const it = byId(rm.itemId);
      const preset = it ? ((it.price || 0) + (it.deposit || 0)) : 0;
      openRemitSheet({
        receiverName: partnerName,
        itemTitle: rm.itemTitle,
        presetAmt: preset > 0 ? preset : '',
        onTransfer: (receiptMsg, amt, tranId) => {
          BE.send(rid, receiptMsg, 'msg').catch(() => toast('송금 메시지 전송에 실패했어요'));
          if (BE.recordTransfer) BE.recordTransfer({ roomId: rid, toUid: partnerUid, toName: partnerName, amount: amt, tranId }).catch(() => {});
        }
      });
    },
    linkacc() { openLinkAccountSheet(() => rerender()); },
    chargeacc() {
      if (!S.account) return;
      S.account.balance += 100000;
      save();
      if (BE.enabled && BE.saveAccount) BE.saveAccount(S.account).catch(() => {});
      toast('100,000원이 충전되었어요!');
      rerender();
    },
    clr() { S.recent = []; save(); },
    del(t) {
      const id = t.dataset.id;
      sheet(`<h3>정말 삭제할까요?</h3><p style="color:var(--sub);margin-bottom:16px">삭제한 물품은 되돌릴 수 없어요.</p><div style="display:flex;gap:10px"><button class="btn line" style="flex:1" data-act="close">취소</button><button class="btn pri" style="flex:1;--acc:#E5484D" data-act="delok" data-id="${id}">삭제</button></div>`);
    },
    delok(t) {
      if (BE.enabled) BE.delItem(t.dataset.id).catch(() => toast('삭제에 실패했어요'));
      S.mine = S.mine.filter(i => i.id !== t.dataset.id); S.wish = S.wish.filter(i => i !== t.dataset.id); delete S.chats[t.dataset.id]; save();
      toast('삭제했어요'); closeSheet(true);
      if (location.hash.startsWith('#/item/')) go('#/my/items'); else rerender();
    },
    done(t) {
      const it = byId(t.dataset.id); if (!it) return;
      if (stOf(it) === 'done') return setDone(it, false);
      const cands = BE.enabled && BE.user ? BE.rooms.filter(r => r.itemId === it.id).map(r => { const u = BE.partner(r, BE.user.uid); return { uid: u, name: (r.names && r.names[u]) || '상대방' }; }) : [];
      if (!cands.length) return setDone(it, true, null);
      sheet(`<h3>거래 상대방을 선택해주세요</h3><p style="color:var(--sub);font-size:13.5px;line-height:1.55;margin-bottom:8px">거래 완료 후에는 <b>작성자 · 거래 상대방 · 이 글을 찜한 사람</b>에게만 글이 보여요.</p>
      ${cands.map(c => `<button class="opt" data-act="doneok" data-id="${it.id}" data-u="${esc(c.uid)}"><span>🙂 ${esc(c.name)}</span>${I('right', 18)}</button>`).join('')}
      <button class="opt" data-act="doneok" data-id="${it.id}" data-u=""><span>앱 밖에서 거래했어요 (상대 선택 안 함)</span></button>`);
    },
    doneok(t) { closeSheet(true); const it = byId(t.dataset.id); if (it) setDone(it, true, t.dataset.u || null); },

    rent(t) {
      const it = byId(t.dataset.id);
      sheet(`<h3>대여 신청</h3><p style="color:var(--sub);font-size:14px">${esc(it.title)}</p>
      <div class="stepper"><button data-act="step" data-d="-1">−</button><b id="qty" data-q="${it.term}">${it.term}${it.unit}</b><button data-act="step" data-d="1">+</button></div>
      <div class="cost" id="cost" data-price="${it.price}" data-term="${it.term}" data-dep="${it.deposit}" data-unit="${it.unit}"></div>
      <textarea id="reqmsg" placeholder="판매자에게 전할 메시지 (선택)"></textarea>
      <button class="btn pri block" style="--acc:var(--pri)" data-act="rentok" data-id="${it.id}">신청하기</button>`);
      calcCost();
    },
    step(t) { const q = $('#qty'); const n = Math.max(1, +q.dataset.q + +t.dataset.d); q.dataset.q = n; q.textContent = n + $('#cost').dataset.unit; calcCost(); },
    rentok(t) {
      const it = byId(t.dataset.id), n = +$('#qty').dataset.q, msg = $('#reqmsg').value.trim();
      const c = $('#cost').dataset; const total = Math.round(c.price / c.term * n);
      S.over[it.id] = 'reserved'; if (isMine(it)) it.status = 'reserved';
      S.reqs.unshift({ id: 'r' + Date.now(), itemId: it.id, title: it.title, detail: `대여 ${n}${it.unit} · ${won(total)}`, ts: Date.now(), state: '승인 대기', role: 'borrow', days: n * UNIT_DAYS[it.unit] });
      addNote('📦', `‘${it.title}’ 대여 신청을 보냈어요. ${it.seller}님의 승인을 기다려요.`, '#/chat/' + it.id);
      closeSheet(true); toast('대여 신청을 보냈어요. 대여가 시작되면 내역에서 ‘대여 시작’을 눌러주세요');
      chatTo(it, `대여 신청 · ${n}${it.unit} · 대여료 ${won(total)} + 보증금 ${won(it.deposit)}`, msg);
    },

    offer(t) {
      const it = byId(t.dataset.id);
      sheet(`<h3>조건 제안하기</h3><p style="color:var(--sub);font-size:14px;margin-bottom:6px">${esc(it.seller)}님이 <b>${it.term}${it.unit}</b> 동안 빌리고 싶어해요.<br>빌려주는 조건을 제안해주세요.</p>
      <div class="f2"><label>대여료 (${it.term}${it.unit} 기준)</label><input id="offPrice" type="number" inputmode="numeric" min="0" placeholder="예) 8000"></div>
      <div class="f2"><label>보증금 (선택)</label><input id="offDep" type="number" inputmode="numeric" min="0" placeholder="0"></div>
      <textarea id="reqmsg" placeholder="상품 상태, 거래 장소 등 전달할 내용 (선택)"></textarea>
      <button class="btn pri block" style="--acc:var(--pri)" data-act="offerok" data-id="${it.id}">제안 보내기</button>`);
    },
    offerok(t) {
      const it = byId(t.dataset.id), pv = $('#offPrice').value, dv = $('#offDep').value, msg = $('#reqmsg').value.trim();
      if (pv === '' || +pv < 0) return toast('대여료를 입력해주세요');
      const price = +pv, dep = +dv || 0;
      S.reqs.unshift({ id: 'r' + Date.now(), itemId: it.id, title: it.title, detail: `조건 제안 · ${won(price)} / 보증금 ${dep ? won(dep) : '없음'}`, ts: Date.now(), state: '제안함', role: 'lend', days: it.term * UNIT_DAYS[it.unit] });
      addNote('📦', `‘${it.title}’ 요청에 대여 조건을 제안했어요.`, '#/chat/' + it.id);
      closeSheet(true); toast('조건을 제안했어요. 대여가 시작되면 내역에서 ‘대여 시작’을 눌러주세요');
      chatTo(it, `대여 조건 제안 · ${it.term}${it.unit} · 대여료 ${won(price)} · 보증금 ${dep ? won(dep) : '없음'}`, msg);
    },

    prop(t) {
      const it = byId(t.dataset.id);
      sheet(`<h3>교환 제안</h3><p style="color:var(--sub);font-size:14px;margin-bottom:12px">${esc(it.seller)}님은 <b style="color:#E8661D">${esc(it.wish)}</b>을(를) 원해요.</p>
      <textarea id="reqmsg" placeholder="내가 교환해줄 수 있는 물품을 적어주세요. 예) 사과 3개 + 바나나 한 송이"></textarea>
      <button class="btn pri block" style="--acc:var(--bar)" data-act="propok" data-id="${it.id}">제안 보내기</button>`);
    },
    propok(t) {
      const it = byId(t.dataset.id), msg = $('#reqmsg').value.trim();
      if (!msg) return toast('교환할 물품을 적어주세요');
      S.reqs.unshift({ id: 'r' + Date.now(), itemId: it.id, title: it.title, detail: `교환 제안 · ${msg.slice(0, 20)}`, ts: Date.now(), state: '제안 중' });
      addNote('🔄', `‘${it.title}’ 교환 제안을 보냈어요.`, '#/chat/' + it.id);
      closeSheet(true); toast('제안을 보냈어요');
      chatTo(it, '교환 제안을 보냈어요', '교환 제안드려요! ' + msg);
    },

    submitreg() {
      const f = $('#regform'), d = Object.fromEntries(new FormData(f)); const type = d.type, editId = f.dataset.edit;
      const kind = type === 'rent' && d.kind === 'request' ? 'request' : 'offer';
      const need = (c, m) => { if (!c) { toast(m); return true; } };
      if (need(d.title.trim(), '상품명을 입력해주세요')) return;
      if (need(d.desc.trim(), '설명을 입력해주세요')) return;
      if (type === 'rent' && need(+d.term >= 1, '대여 기간을 입력해주세요')) return;
      if (type === 'rent' && kind === 'offer' && need(d.price !== '' && +d.price >= 0, '대여료를 입력해주세요')) return;
      if (type === 'barter' && need(d.wish.trim(), '교환 희망 키워드를 입력해주세요')) return;
      const food = d.main === '음식';
      if (food && need(d.expiry, '유통기한을 선택해주세요')) return;
      if (food && need(new Date(d.expiry) >= new Date(new Date().toDateString()), '유통기한이 지난 음식은 등록할 수 없어요')) return;
      const base = {
        type, kind, title: d.title.trim(), emoji: CAT_EM[d.main], img: photoData || undefined, cat: `${d.main} > ${d.sub}`, desc: d.desc.trim(), cond: d.cond, loc: d.loc.trim() || '학교 안', mlat: meet ? meet.lat : undefined, mlng: meet ? meet.lng : undefined,
        kw: type === 'rent' ? ((d.kw || '').trim() || undefined) : undefined, expiry: food ? d.expiry : undefined,
        ...(type === 'rent' ? (kind === 'offer' ? { price: +d.price, term: +d.term, unit: d.unit, deposit: +d.deposit || 0 } : { term: +d.term, unit: d.unit }) : { wish: d.wish.trim() })
      };
      const fail = e => toast('서버 저장에 실패했어요 (' + (e.code || e.message) + ')');
      if (editId) {
        const old = S.mine.find(i => i.id === editId); if (!old) return toast('수정할 글을 찾을 수 없어요');
        ['price', 'deposit', 'term', 'unit', 'wish', 'kw', 'expiry', 'img', 'mlat', 'mlng'].forEach(k => delete old[k]);
        Object.assign(old, base);
        if (BE.enabled) BE.saveItem(old).catch(fail);
        save(); photoData = null; toast('수정했어요 ✏️'); history.replaceState(null, '', '#/item/' + editId); render(); return;
      }
      const id = 'u' + Date.now() + (me() ? me().uid.slice(0, 4).replace(/\W/g, '') : '');
      const it = { id, ...base, bg: BGS[Math.floor(Math.random() * BGS.length)], seller: myName(), uid: me() ? me().uid : undefined, score: 4.7, status: 'open', likes: 0, reviews: 0, ts: Date.now(), lat: S.pos ? S.pos.lat : undefined, lng: S.pos ? S.pos.lng : undefined, ...(BE.enabled ? {} : { dist: 0 }) };
      S.mine.unshift(it);
      if (BE.enabled) BE.createItem(it).catch(fail);
      addNote('✅', `‘${it.title}’ ${kind === 'request' ? '대여 요청이' : '물품이'} 등록됐어요.`, '#/item/' + id);
      if (type === 'barter') addNote('🔔', `교환 희망 키워드 ‘${it.wish}’로 매칭·알림을 받아요.`, '#/match');
      save(); photoData = null;
      toast('등록 완료! 🎉'); history.replaceState(null, '', '#/item/' + id); render();
    },

    kwdel(t) { const key = t.dataset.t === 'rent' ? 'kwRent' : 'kwBarter'; S[key] = S[key].filter(k => k !== t.dataset.k); save(); rerender(); },
    sim() {
      const tpl = INCOMING[S.feedIdx % INCOMING.length]; S.feedIdx++;
      const it = mk('x' + Date.now(), { ...tpl, ago: 0 }); S.extra.unshift(it);
      const note = kwNote(it);
      if (note) { addNote(note[0], note[1], '#/item/' + it.id); toast('🔔 키워드 알림이 도착했어요'); }
      else { save(); toast(`새 ${it.type === 'rent' ? '대여' : '교환'} 글 “${it.title}” (키워드 불일치 → 알림 없음)`); }
      rerender();
    },
    unblock(t) { S.blocked = S.blocked.filter(n => n !== t.dataset.n); save(); toast('차단을 해제했어요'); rerender(); },

    more(t) {
      const it = byId(t.dataset.id);
      sheet(`<h3>${esc(it.seller)} 님</h3>
      <button class="opt" data-act="report" data-id="${it.id}"><span>🚩 신고하기</span>${I('right', 18)}</button>
      <button class="opt" data-act="block" data-id="${it.id}" style="color:#E5484D"><span>🚫 차단하기</span>${I('right', 18)}</button>`);
    },
    report(t) {
      const it = byId(t.dataset.id); repSel = null;
      sheet(`<h3>신고하기</h3><p style="color:var(--sub);font-size:13.5px;margin-bottom:6px">${esc(it.seller)} 님 · ${esc(it.title)}</p>
      <div id="reasons">${REASONS.map(r => `<button class="opt" data-act="rsel" data-v="${esc(r)}"><span>${esc(r)}</span></button>`).join('')}</div>
      <textarea id="repmsg" placeholder="자세한 내용을 적어주시면 검토에 도움이 돼요 (선택)" style="margin-top:12px"></textarea>
      <label class="agree" style="margin-bottom:14px"><input type="checkbox" id="alsoBlock"><span>이 회원도 함께 차단하기</span></label>
      <button class="btn pri block" style="--acc:#E5484D" data-act="reportok" data-id="${it.id}">신고 접수하기</button>`);
    },
    rsel(t) { repSel = t.dataset.v; document.querySelectorAll('#reasons .opt').forEach(b => { const on = b === t; b.classList.toggle('on', on); b.innerHTML = `<span>${esc(b.dataset.v)}</span>${on ? I('check', 18) : ''}`; }); },
    reportok(t) {
      if (!repSel) return toast('신고 사유를 선택해주세요');
      const it = byId(t.dataset.id), also = $('#alsoBlock').checked, detail = $('#repmsg').value.trim(), key = sKey(it);
      if (S.reports.some(r => (r.sKey || r.seller) === key || r.seller === it.seller && !r.sKey)) { closeSheet(true); return toast('이미 신고한 회원이에요. 같은 회원은 한 번만 신고할 수 있어요'); }
      if (BE.enabled && it.uid) BE.report({ targetUid: it.uid, targetName: it.seller, itemId: it.id, reason: repSel, detail }).catch(e => toast('신고 저장 실패 (' + (e.code || e.message) + ')'));
      S.reports.unshift({ id: 'rp' + Date.now(), itemId: it.id, sKey: key, seller: it.seller, title: it.title, reason: repSel, detail, ts: Date.now() });
      addNote('🚩', `${it.seller}님에 대한 신고가 접수됐어요. 검토 후 조치할게요.`);
      if (also && !S.blocked.includes(it.seller)) S.blocked.push(it.seller);
      save(); closeSheet(true); toast(also ? '신고 접수 및 차단했어요' : '신고가 접수됐어요');
      if (also) go('#/'); else rerender();
    },
    block(t) {
      const it = byId(t.dataset.id);
      sheet(`<h3>${esc(it.seller)} 님을 차단할까요?</h3><p style="color:var(--sub);margin-bottom:16px;line-height:1.6">차단하면 이 회원의 글이 보이지 않고, 채팅도 할 수 없어요.<br>MY → 차단 관리에서 언제든 해제할 수 있어요.</p>
      <div style="display:flex;gap:10px"><button class="btn line" style="flex:1" data-act="close">취소</button><button class="btn pri" style="flex:1;--acc:#E5484D" data-act="blockok" data-id="${it.id}">차단하기</button></div>`);
    },
    blockok(t) {
      const it = byId(t.dataset.id); if (!S.blocked.includes(it.seller)) S.blocked.push(it.seller);
      save(); closeSheet(true); toast(`${it.seller}님을 차단했어요`); go('#/');
    },

    edit(t) { go('#/register?edit=' + t.dataset.id); },
    locate(t) {
      const quiet = t === true;
      if (!navigator.geolocation) { if (!quiet) toast('이 기기는 위치 기능을 지원하지 않아요'); return; }
      navigator.geolocation.getCurrentPosition(p => {
        S.pos = { lat: p.coords.latitude, lng: p.coords.longitude, ts: Date.now() }; save();
        if (!quiet) toast('내 위치를 확인했어요 📍 가까운 순으로 보여드려요'); softRender();
      }, err => { if (!quiet) toast(err.code === 1 ? '위치 권한이 꺼져 있어요. 브라우저/폰 설정에서 허용해주세요' : '위치를 가져오지 못했어요 (https 또는 localhost에서만 동작해요)'); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
    },
    pwreset() {
      const em = ($('.lgform input[name=email]').value || '').trim().toLowerCase();
      if (!EMAIL_RE.test(em)) return showLgErr('가입한 이메일을 위 입력창에 먼저 적어주세요', 'email');
      if (!BE.enabled) return showLgErr('데모 모드에서는 비밀번호 재설정 메일을 보낼 수 없어요');
      BE.resetPw(em).then(() => { showLgErr(''); toast('재설정 메일을 보냈어요. 가입된 이메일이라면 곧 도착해요 (스팸함도 확인해보세요)'); }).catch(authErr);
    },
    lmode() { loginMode = loginMode === 'in' ? 'up' : 'in'; render(); },
    logout() { history.replaceState(null, '', '#/'); if (BE.enabled) BE.logout(); else { LOCAL.user = null; localStorage.removeItem(SES_KEY); enterApp(); } toast('로그아웃했어요'); },
    calnav(t) { calOff += +t.dataset.d; rerender(); },
    alarm() { S.alarm.on = !S.alarm.on; save(); rerender(); },
    aday(t) { const d = +t.dataset.d; S.alarm.days = S.alarm.days.includes(d) ? S.alarm.days.filter(x => x !== d) : [...S.alarm.days, d]; save(); rerender(); },
    notifperm() { Notification.requestPermission().then(() => rerender()); },
    rstart(t) {
      const r = S.reqs.find(x => x.id === t.dataset.id), role = r && reqRole(r); if (!r || !role) return;
      const it = byId(r.itemId); addRental({ id: r.itemId, title: r.title }, role, r.days || (it && it.term ? days(it) : 1), r.id);
      r.state = '대여 중'; if (!(it && stOf(it) === 'done')) S.over[r.itemId] = 'reserved';
      save(); toast('대여를 시작했어요 · 캘린더에 반납일이 등록됐어요 📅'); rerender();
    },
    rcancel(t) {
      const r = S.reqs.find(x => x.id === t.dataset.id); if (!r) return;
      r.state = '취소됨'; releaseItem(r.itemId, r.id); save(); toast('신청을 취소했어요'); rerender();
    },
    rret(t) {
      const r = S.rentals.find(x => x.id === t.dataset.id); if (!r) return;
      r.state = 'returned'; const q = S.reqs.find(x => x.id === r.reqId); if (q) q.state = r.role === 'borrow' ? '반납 완료' : '회수 완료';
      releaseItem(r.itemId, r.reqId); save(); toast('반납 처리했어요 · 리뷰를 남겨보세요'); rerender();
    },
    rdel(t) {
      const r = S.rentals.find(x => x.id === t.dataset.id);
      if (r && r.state === 'active') { const q = S.reqs.find(x => x.id === r.reqId); if (q) q.state = '취소됨'; releaseItem(r.itemId, r.reqId); }
      S.rentals = S.rentals.filter(x => x.id !== t.dataset.id); save(); rerender();
    },
    revw(t) {
      const it = byId(t.dataset.id); revStar = 5;
      sheet(`<h3>리뷰 쓰기</h3><p style="color:var(--sub);font-size:14px">${esc(it.title)} · ${esc(it.seller)}님</p>
      <div class="stars" id="stars">${[1, 2, 3, 4, 5].map(n => `<button data-act="star" data-v="${n}" class="on">★</button>`).join('')}</div>
      <textarea id="revtxt" placeholder="물품 상태, 거래 매너는 어땠나요?"></textarea>
      <button class="btn pri block" style="--acc:var(--pri)" data-act="revok" data-id="${it.id}">리뷰 등록하기</button>`);
    },
    star(t) { revStar = +t.dataset.v; document.querySelectorAll('#stars button').forEach(b => b.classList.toggle('on', +b.dataset.v <= revStar)); },
    revok(t) {
      const it = byId(t.dataset.id), text = $('#revtxt').value.trim(); if (!text) return toast('리뷰 내용을 입력해주세요');
      const r = { id: 'rv' + Date.now(), itemId: it.id, itemTitle: it.title, sKey: sKey(it), seller: it.seller, author: myName(), authorUid: me() ? me().uid : 'local', rating: revStar, text, ts: Date.now() };
      if (BE.enabled) BE.addReview(r).catch(() => toast('리뷰 저장에 실패했어요')); else { S.reviews.unshift(r); save(); }
      closeSheet(true); toast('리뷰를 남겼어요 ⭐'); go('#/seller/' + encodeURIComponent(sKey(it)));
    },

    onbnext() { onbStep = Math.min(onbStep + 1, ONB.length - 1); drawOnb(); },
    onbskip() { onbStep = ONB.length - 1; drawOnb(); },
    onbdone() {
      if (!onbReopen && !$('#onbAgree')?.checked) return toast('안내 내용에 동의해주세요');
      S.onboarded = true; save(); onbEl.className = 'onb'; onbEl.innerHTML = ''; A.locate(true);
    },
    showonb() { showOnb(true); },
    reset() { sheet(`<h3>데이터를 초기화할까요?</h3><p style="color:var(--sub);margin-bottom:16px">등록한 물품, 관심, 채팅, 키워드, 차단·신고 내역이 모두 처음 상태로 돌아가요.</p><div style="display:flex;gap:10px"><button class="btn line" style="flex:1" data-act="close">취소</button><button class="btn pri" style="flex:1;--acc:#E5484D" data-act="resetok">초기화</button></div>`); },
    resetok() { S = freshState(); if (BE.enabled && BE.user) S.mine = BE.items.filter(i => i.uid === BE.user.uid); save(); closeSheet(true); go('#/'); render(); showOnb(false); }
  };
  function calcCost() {
    const c = $('#cost'); if (!c) return; const n = +$('#qty').dataset.q, price = +c.dataset.price, term = +c.dataset.term, dep = +c.dataset.dep;
    const fee = Math.round(price / term * n);
    c.innerHTML = `<div><span>대여료</span><span>${won(fee)}</span></div><div><span>보증금 (반납 시 환급)</span><span>${dep ? won(dep) : '없음'}</span></div><div class="t"><span>결제 예상 금액</span><span>${won(fee + dep)}</span></div>`;
  }

  /* ---------- 이벤트 ---------- */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]'); if (!t) return;
    if (t.tagName === 'A' && t.dataset.act === 'clr') { e.preventDefault(); A.clr(); rerender(); return; }
    e.preventDefault(); e.stopPropagation();
    (A[t.dataset.act] || (() => { }))(t);
  });
  document.addEventListener('submit', e => {
    const f = e.target.closest('[data-form]'); if (!f) return; e.preventDefault();
    const fd = new FormData(f), v = String(fd.get('q') ?? fd.get('t') ?? fd.get('k') ?? '');
    switch (f.dataset.form) {
      case 'login': {
        const d = Object.fromEntries(new FormData(f)); d.email = (d.email || '').trim().toLowerCase(); d.name = (d.name || '').trim(); d.pw = d.pw || ''; d.pw2 = d.pw2 || '';
        const bad = validateAuth(loginMode, d); if (bad) return showLgErr(bad[1], bad[0]);
        const btn = f.querySelector('button.pri'); btn.disabled = true; showLgErr('');
        const up = loginMode === 'up', srv = BE.enabled;
        (up ? (srv ? BE.emailUp(d.email, d.pw, d.name) : LOCAL.signUp(d.email, d.pw, d.name)) : (srv ? BE.emailIn(d.email, d.pw) : LOCAL.signIn(d.email, d.pw)))
            .catch(authErr).finally(() => { btn.disabled = false; });
        break;
      }
      case 'rchat': { const t = v.trim(); if (t.startsWith('[송금완료]')) { toast('송금 영수증 형식의 메시지는 직접 보낼 수 없어요'); break; } if (t) BE.send(f.dataset.id, t).catch(() => toast('전송에 실패했어요')); f.reset(); break; }
      case 'gsearch': if (v.trim()) go('#/search?q=' + encodeURIComponent(v.trim())); break;
      case 'mapsearch': mapSearch(v); break;
      case 'lsearch': F[f.dataset.type].q = v.trim(); rerender(); break;
      case 'chat': if (v.trim().startsWith('[송금완료]')) { toast('송금 영수증 형식의 메시지는 직접 보낼 수 없어요'); break; } sendChat(f.dataset.id, v); f.reset(); break;
      case 'kwadd': {
        const key = f.dataset.t === 'rent' ? 'kwRent' : 'kwBarter';
        v.split(/[,，]/).map(s => s.trim()).filter(s => s.length >= 2).forEach(k => { if (!S[key].some(x => x.toLowerCase() === k.toLowerCase())) S[key].push(k); });
        save(); rerender(); toast('키워드를 추가했어요'); break;
      }
    }
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'onbAgree') { const b = $('#onbGo'); if (b) b.disabled = !e.target.checked; return; }
    const f = e.target.closest('#regform'); if (!f) return;
    if (e.target.name === 'type') {
      f.dataset.type = e.target.value;
      if (e.target.value === 'barter') { f.dataset.kind = 'offer'; const o = f.querySelector('input[name=kind][value=offer]'); if (o) o.checked = true; }
    }
    if (e.target.name === 'kind') f.dataset.kind = e.target.value;
    if (e.target.name === 'main') {
      f.sub.innerHTML = CATS[e.target.value].map(c => `<option>${c}</option>`).join('');
      syncFood(f);
    }
    if (e.target.id === 'photoIn' && e.target.files[0]) readPhoto(e.target.files[0]);
  });

  const synced = new Set(), APP_START = Date.now();
  BE.onError = authErr;
  BE.onChange = (k, p) => {
    if (k === 'auth') { enterApp(); return; }
    if (k === 'profile') { render(); return; }
    if (!BE.user) return;
    if (k === 'items') {
      S.mine = BE.items.filter(i => i.uid === BE.user.uid);
      S.wish.forEach(id => { const it = BE.items.find(i => i.id === id); if (it && it.uid !== BE.user.uid && !(it.wishers || []).includes(BE.user.uid) && !synced.has(id)) { synced.add(id); BE.setWish(id, true).catch(() => synced.delete(id)); } });
      softRender();
    }
    else if (k === 'new') {
      /* 앱을 켠 뒤 실제로 새로 올라온 글만, 같은 글은 한 번만, 키워드가 맞을 때만 알림 */
      if ((p.ts || 0) < APP_START - 60000 || S.notified.includes('item:' + p.id)) return;
      const n = kwNote(p); if (!n) return;
      S.notified.push('item:' + p.id); addNote(n[0], n[1], '#/item/' + p.id); toast('🔔 키워드 알림이 도착했어요');
    }
    else if (k === 'reports') { if (suspended()) render(); else softRender(); }
    else if (k === 'rooms') { if (curRoom) { markRead(curRoom); if (BE.enabled && roomId === curRoom) drawRoom(); } else softRender(); }
    else if (k === 'reviews') { if (/^#\/(seller|item)/.test(location.hash)) softRender(); }
  };

  LOCAL.restore();
  if (!BE.enabled || BE.ready) enterApp(); else render();
  setInterval(() => checkDue(), 36e5);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDue(); });
})();