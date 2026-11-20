/* 쉐어메이트 – 대여 · 물물교환 앱 (순수 JS, 의존성 없음) */
(() => {
'use strict';

/* ---------- 유틸 ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const won = n => Number(n || 0).toLocaleString('ko-KR') + '원';
const view = $('#view'), layer = $('#layer'), toastEl = $('#toast'), onbEl = $('#onb');

function ago(ts) {
  const m = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (m < 1) return '방금 전';
  if (m < 60) return m + '분 전';
  if (m < 1440) return Math.floor(m / 60) + '시간 전';
  return Math.floor(m / 1440) + '일 전';
}
function clock(ts) { const d = new Date(ts); return `${d.getHours() < 12 ? '오전' : '오후'} ${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`; }
const inDays = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

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
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'
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
const STATUS = { open: '', reserved: '예약중', done: '완료' };
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
/* 시연용: 'N분 뒤 새 글이 올라오는 상황'을 재현하기 위한 도착 예정 글 */
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
  onboarded: false, wish: ['3'], mine: [], extra: [], over: {}, chats: {}, reqs: [], recent: [],
  kwRent: ['카메라'], kwBarter: ['과일'], blocked: [], reports: [], radius: 5, feedIdx: 0,
  notes: [{ id: 'n0', icon: '👋', text: '쉐어메이트에 오신 걸 환영해요! 키워드를 등록하면 새 글 알림을 받을 수 있어요.', href: '#/keywords', ts: Date.now() - 3600000, read: false }]
});
let S;
try { S = Object.assign(freshState(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = freshState(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('저장 공간이 부족해요. 사진 크기를 줄여보세요'); } };
const all = () => [...S.mine, ...S.extra, ...SEED];
const byId = id => all().find(i => i.id === String(id));
const stOf = it => S.over[it.id] || it.status;
const isMine = it => S.mine.some(m => m.id === it.id);
const vis = () => all().filter(i => isMine(i) || !S.blocked.includes(i.seller));
const wished = id => S.wish.includes(String(id));
const unreadN = () => S.notes.filter(n => !n.read).length;
const addNote = (icon, text, href) => { S.notes.unshift({ id: 'n' + Date.now() + Math.random().toString(36).slice(2, 5), icon, text, href, ts: Date.now(), read: false }); save(); };
const likeN = it => it.likes + (wished(it.id) ? 1 : 0);

/* ---------- 키워드 · 매칭 ---------- */
const STOP = new Set(['류', '등', '또는', '종류', '및', '그리고', '이나', '하고', '정도']);
const toks = s => String(s || '').toLowerCase().split(/[,\s/·+()\[\]]+/).map(w => w.trim()).filter(w => w.length >= 2 && !STOP.has(w));
const hay = it => (it.title + ' ' + it.cat + ' ' + it.desc).toLowerCase();
const myBarterPosts = () => S.mine.filter(i => i.type === 'barter');
const autoWants = () => [...new Set(myBarterPosts().flatMap(i => toks(i.wish)))];
const barterKw = () => [...new Set([...autoWants(), ...S.kwBarter.map(k => k.toLowerCase())])];

function matches() {
  const wants = barterKw(); if (!wants.length) return [];
  const myHay = myBarterPosts().map(hay).join(' ');
  return vis().filter(i => i.type === 'barter' && !isMine(i) && stOf(i) === 'open' && i.dist <= S.radius).map(it => {
    const h = hay(it), hits = wants.filter(w => h.includes(w));
    const mutual = !!myHay && toks(it.wish).some(w => myHay.includes(w));
    return { it, hits, mutual, score: hits.length * 10 + (mutual ? 15 : 0) - it.dist * 2 };
  }).filter(m => m.hits.length).sort((a, b) => b.score - a.score);
}

/* ---------- 목록 필터 ---------- */
const F = {
  rent: { tab: 'all', period: 'all', cat: 'all', sort: 'new', q: '' },
  barter: { cat: 'all', cond: 'all', sort: 'new', q: '' }
};
const FDEF = {
  period: { label: '기간', opts: [['all', '전체'], ['3', '3일 이내'], ['7', '1주 이내'], ['30', '1개월 이내'], ['31', '1개월 이상']] },
  cat: { label: '카테고리', opts: [['all', '전체'], ...Object.keys(CATS).map(c => [c, CAT_EM[c] + ' ' + c])] },
  cond: { label: '상태', opts: [['all', '전체'], ['새것 같음', '새것 같음'], ['상', '상'], ['중', '중']] }
};
const SORTS = {
  rent: [['new', '신상품순'], ['low', '가격 낮은순'], ['high', '가격 높은순'], ['review', '리뷰 많은순']],
  barter: [['new', '신상품순'], ['near', '가까운순'], ['hot', '인기순']]
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
  if (f.q) a = a.filter(i => (i.title + i.desc + i.cat + (i.wish || '')).toLowerCase().includes(f.q.toLowerCase()));
  if (f.cat !== 'all') a = a.filter(i => i.cat.startsWith(f.cat));
  if (type === 'rent' && f.period !== 'all') { const p = +f.period; a = a.filter(i => p === 31 ? days(i) > 30 : days(i) <= p); }
  if (type === 'barter' && f.cond !== 'all') a = a.filter(i => i.cond === f.cond);
  const s = f.sort;
  if (s === 'new') a.sort((x, y) => y.ts - x.ts);
  if (s === 'low') a.sort((x, y) => (x.price ?? 1e12) - (y.price ?? 1e12));
  if (s === 'high') a.sort((x, y) => (y.price ?? -1) - (x.price ?? -1));
  if (s === 'review') a.sort((x, y) => (y.reviews || 0) - (x.reviews || 0));
  if (s === 'near') a.sort((x, y) => (isMine(x) ? 0 : x.dist) - (isMine(y) ? 0 : y.dist));
  if (s === 'hot') a.sort((x, y) => likeN(y) - likeN(x));
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
      : `<p class="price">${won(it.price)} <small>/ ${it.term}${it.unit}</small></p><p class="meta">보증금 ${it.deposit ? won(it.deposit) : '없음'} · 리뷰 ${it.reviews || 0}</p>`)
    : `<p class="wish">${I('swap', 15)}<span>${esc(it.wish)}</span></p>`;
  return `<a class="card" href="#/item/${it.id}">
    <div class="thumb" style="background:${it.bg}">${thumbIn(it)}${st !== 'open' ? `<span class="ribbon">${STATUS[st]}</span>` : ''}</div>
    <div class="info">
      <div class="tags"><span class="tag ${it.type}">${it.type === 'rent' ? '대여' : '교환'}</span>${isReq(it) ? '<span class="tag req">요청</span>' : ''}</div>
      <h3>${esc(it.title)}</h3>${body}
      <p class="meta">${esc(it.loc)}${isMine(it) ? '' : ' · ' + it.dist + 'km'} · ${ago(it.ts)}</p>
    </div>
    ${opt.del ? `<button class="del" data-act="del" data-id="${it.id}" aria-label="삭제">${I('trash', 18)}</button>` : heartBtn(it.id)}
  </a>`;
}
const empty = (em, msg) => `<div class="empty"><span class="em">${em}</span>${msg}</div>`;
const topbar = ({ back = true, title = '', right = '' } = {}) => `<div class="topbar">${back ? `<button class="ib" data-act="back" aria-label="뒤로">${I('back')}</button>` : ''}<div class="title">${esc(title)}</div>${right}</div>`;
function nav(on) {
  const chatN = Object.keys(S.chats).filter(id => { const it = byId(id); return it && !S.blocked.includes(it.seller); }).length;
  return `<nav class="nav">
    <a href="#/chats" class="${on === 'chat' ? 'on' : ''}">${I('chat', 24)}채팅${chatN ? `<span class="badge">${chatN}</span>` : ''}</a>
    <a href="#/" class="${on === 'home' ? 'on' : ''}">${I('home', 24)}홈</a>
    <a href="#/my" class="${on === 'my' ? 'on' : ''}">${I('user', 24)}MY</a></nav>`;
}
const matchBanner = (sm) => {
  const n = matches().length;
  return `<a class="matchbanner ${sm ? 'sm' : ''}" href="#/match"><div class="mi">${I('sparkle', 22)}</div><div class="mt"><b>${n ? `나와 맞는 교환 상대 ${n}명` : '내 근처 교환 매칭'}</b><small>${n ? '가까운 곳에서 내가 원하는 물건을 올린 사람이에요' : '희망 키워드를 등록하면 추천해드려요'}</small></div>${I('right', 18)}</a>`;
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
      <div class="hello"><small>우리 학교 장터</small><h1>오늘은 무엇을<br><b>빌리고</b> 또 <b style="color:var(--bar)">바꿔볼까요?</b></h1></div>
      <form class="searchbar" data-form="gsearch">${I('search', 20)}<input name="q" placeholder="전공책, 카메라, 텐트 검색" autocomplete="off"></form>
      <div class="big2">
        <a class="bigcard rent" href="#/list/rent"><span class="cnt">${rc}개 물품</span><span class="em">📦</span><h2>대여</h2><p>필요한 만큼만<br>빌려 쓰기</p></a>
        <a class="bigcard barter" href="#/list/barter"><span class="cnt">${bc}개 물품</span><span class="em">🔄</span><h2>물물교환</h2><p>안 쓰는 물건을<br>필요한 것과 맞교환</p></a>
      </div>
      ${matchBanner(false)}
      <div class="sec-h" style="padding-top:18px"><h3>카테고리</h3></div>
      <div class="cats">${Object.keys(CATS).map(c => `<a class="cat" href="#/search?cat=${encodeURIComponent(c)}"><i>${CAT_EM[c]}</i>${c}</a>`).join('')}</div>
      <div class="sec-h" style="padding-top:18px"><h3>방금 올라왔어요</h3></div>
      <div class="hscroll">${recent.map(it => `<a class="mini" href="#/item/${it.id}"><div class="thumb" style="background:${it.bg}">${thumbIn(it)}</div><h4>${esc(it.title)}</h4><p class="${it.type === 'barter' ? 'b' : ''}">${it.type === 'rent' ? (isReq(it) ? '대여 요청' : won(it.price) + ' / ' + it.term + it.unit) : '교환 · ' + esc(toks(it.wish)[0] || it.wish)}</p></a>`).join('')}</div>
      <div class="safe"></div>
    </div>${nav('home')}</div>`;
}

function List(type) {
  const f = F[type], items = filtered(type), r = type === 'rent';
  const tabs = [['all', '전체'], ['offer', '대여제품'], ['request', '대여요청']];
  const chips = r ? ['period', 'cat', 'sort'] : ['cat', 'cond', 'sort'];
  const fabHref = `#/register?type=${type}${r && f.tab === 'request' ? '&kind=request' : ''}`;
  return `<div class="screen ${type}-scope">
    ${topbar({ title: r ? '대여' : '물물교환', right: homeBtn + `<a class="ib" href="#/wishlist" aria-label="관심">${I('heart')}</a>` })}
    ${r ? '' : matchBanner(true)}
    <form class="searchbar sm" data-form="lsearch" data-type="${type}">${I('search', 18)}<input name="q" value="${esc(f.q)}" placeholder="${r ? '빌리고 싶은 물품을 검색해보세요' : '교환하고 싶은 물품을 검색해보세요'}" autocomplete="off"></form>
    ${r ? `<div class="tabs">${tabs.map(t => `<button class="${f.tab === t[0] ? 'on' : ''}" data-act="ltab" data-type="${type}" data-v="${t[0]}">${t[1]}</button>`).join('')}</div>` : ''}
    <div class="chips">${chips.map(k => `<button class="chip ${k === 'sort' ? (f.sort !== 'new' ? 'on' : '') : (f[k] !== 'all' ? 'on' : '')}" data-act="fsheet" data-type="${type}" data-k="${k}">${k === 'sort' ? I('sort', 14) + ' ' + optLabel(type, 'sort', f.sort) : (f[k] === 'all' ? flabel(k) : optLabel(type, k, f[k]))} ${k === 'sort' ? '' : I('chev', 14)}</button>`).join('')}</div>
    <div class="countrow"><span>총 ${items.length}개</span><span>${r && f.tab === 'request' ? '빌리고 싶은 물건을 올려보세요' : ''}</span></div>
    <div class="content"><div class="list">${items.length ? items.map(i => card(i)).join('') : empty('🔍', '조건에 맞는 물품이 아직 없어요.<br>첫 번째로 등록해보는 건 어때요?')}</div></div>
    <a class="fab" href="${fabHref}" aria-label="등록">${I('plus', 26)}</a></div>`;
}

function Detail(id) {
  const it = byId(id);
  if (!it) return `<div class="screen">${topbar()}${empty('🫥', '삭제되었거나 없는 물품이에요.')}</div>`;
  const r = it.type === 'rent', req = isReq(it), st = stOf(it), mine = isMine(it);
  const food = it.cat.startsWith('음식');
  const exp = it.expiry ? Math.ceil((new Date(it.expiry) - Date.now()) / 86400000) : null;
  const label = req ? '빌려줄게요 (조건 제안)' : r ? '대여 신청하기' : '교환 제안하기';
  const action = mine
    ? `<button class="btn line" data-act="done" data-id="${it.id}">${st === 'done' ? '다시 열기' : '거래 완료 처리'}</button><button class="btn pri" data-act="del" data-id="${it.id}">삭제하기</button>`
    : `<button class="btn line" data-act="chat" data-id="${it.id}" style="flex:none">${I('chat', 20)}채팅</button>
       <button class="btn pri" data-act="${req ? 'offer' : r ? 'rent' : 'prop'}" data-id="${it.id}" ${st !== 'open' ? 'disabled' : ''}>${st !== 'open' ? STATUS[st] : label}</button>`;
  const priceBlock = req
    ? `<div class="reqbox">${I('clock', 20)}<span>희망 대여 기간 <b>${it.term}${it.unit}</b></span></div>
       <div class="d-sub">${I('info', 16)}대여비·보증금은 요청자가 정하지 않고, 빌려주는 분이 제안해요</div>`
    : r ? `<div class="d-price">${won(it.price)} <small>/ ${it.term}${it.unit}</small></div>
          <div class="d-sub">${I('shield', 16)}보증금 <b>${it.deposit ? won(it.deposit) : '없음'}</b> · 반납 시 전액 환급</div>`
      : `<div class="wishbox">${I('swap', 20)}<span>교환 희망 : ${esc(it.wish)}</span></div>`;
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
        <div class="seller"><div class="avatar">🙂</div><div><div class="n">${esc(it.seller)}${mine ? ' (나)' : ''}</div><div class="s">${I('pin', 12)} ${esc(it.loc)}${mine ? '' : ' · ' + it.dist + 'km'}</div></div>
          <div class="score">${it.score.toFixed(1)}<small>신뢰점수</small></div></div>
        <div class="dtabs"><button class="on" data-act="dtab" data-v="info">상세정보</button><button data-act="dtab" data-v="guide">${r ? '대여안내' : '교환안내'}</button></div>
        <div class="pane" data-pane="info">
          <dl class="kv"><dt>카테고리</dt><dd>${esc(it.cat)}</dd>
            <dt>상품 상태</dt><dd>${esc(it.cond)}</dd>
            ${food && it.expiry ? `<dt>유통기한</dt><dd>${it.expiry.replace(/-/g, '.')} ${exp !== null ? `<span style="color:${exp <= 7 ? '#E5484D' : 'var(--sub)'};font-weight:600">(${exp >= 0 ? 'D-' + exp : '기한 지남'})</span>` : ''}</dd>` : ''}
            ${r && !req ? `<dt>리뷰</dt><dd>${it.reviews || 0}개</dd>` : ''}
            <dt>거래 장소</dt><dd>${esc(it.loc)}</dd><dt>등록</dt><dd>${ago(it.ts)} · 관심 ${likeN(it)}</dd></dl>
          <div class="desc">${esc(it.desc)}</div>
          <p class="disclaimer">${I('info', 14)} 거래는 회원 간 직접 이루어지며, 쉐어메이트는 거래에 대한 책임을 지지 않아요.</p>
        </div>
        <div class="pane" data-pane="guide" hidden><div class="guide">
          ${r ? `<div>${I('shield', 20)}<span>보증금은 물품을 상태 그대로 반납하면 <b>전액 돌려받아요</b>. 파손·분실 시 수리비만큼 차감돼요.</span></div>
                 <div>${I('clock', 20)}<span>반납 기한을 넘기면 <b>하루당 대여료의 10%</b>가 추가돼요.</span></div>` :
            `<div>${I('swap', 20)}<span>서로 합의한 물품을 <b>직접 만나서</b> 교환해요. 채팅으로 먼저 조율해보세요.</span></div>
             ${food ? `<div>${I('clock', 20)}<span>음식은 <b>유통기한이 지난 물품은 교환할 수 없어요</b>. 개봉·보관 상태를 꼭 확인하세요.</span></div>` : ''}`}
          <div>${I('pin', 20)}<span>거래는 <b>학교 안 공개된 장소</b>(도서관, 학생회관 등)에서 하는 걸 추천해요.</span></div>
          <div>${I('flag', 20)}<span>사기가 의심되거나 불쾌한 일이 생기면 우측 상단 <b>⋯ 메뉴</b>에서 신고·차단할 수 있어요.</span></div></div></div>
      </div></div>
    <div class="actionbar">${action}</div></div>`;
}

function Register(q) {
  const type = q.get('type') === 'barter' ? 'barter' : 'rent';
  const kind = type === 'rent' && q.get('kind') === 'request' ? 'request' : 'offer';
  const mainCats = Object.keys(CATS);
  return `<div class="screen">
    <div class="topbar"><div class="title">상품정보 등록</div><button class="ib" data-act="back" aria-label="닫기">${I('close')}</button></div>
    <form id="regform" class="form content" data-type="${type}" data-kind="${kind}" data-form="register" autocomplete="off">
      <div class="seg"><label><input type="radio" name="type" value="rent" ${type === 'rent' ? 'checked' : ''}><span>📦 대여</span></label><label><input type="radio" name="type" value="barter" ${type === 'barter' ? 'checked' : ''}><span>🔄 물물교환</span></label></div>
      <div class="seg kind-seg"><label><input type="radio" name="kind" value="offer" ${kind === 'offer' ? 'checked' : ''}><span>빌려줘요</span></label><label><input type="radio" name="kind" value="request" ${kind === 'request' ? 'checked' : ''}><span>빌려요 (대여 요청)</span></label></div>
      <div class="reqnote">${I('info', 18)}<span>대여 요청에서는 <b>대여비·보증금을 제시할 수 없어요.</b><br>빌려주실 분이 조건을 직접 제안해요.</span></div>
      <div class="f"><label class="l">사진</label>
        <label class="photo" id="photoBox">${I('camera', 24)}<span>사진 추가</span><input type="file" accept="image/*" id="photoIn"></label>
        <p class="hint">사진이 없으면 카테고리 이모지가 대신 보여요.</p></div>
      <div class="f"><label class="l">상품명 <i>*</i></label><input class="in" name="title" maxlength="40" placeholder="예) 운영체제 공룡책 10판"></div>
      <div class="f"><label class="l">카테고리 <i>*</i></label>
        <div class="two"><select name="main">${mainCats.map(c => `<option>${c}</option>`).join('')}</select><select name="sub">${CATS[mainCats[0]].map(c => `<option>${c}</option>`).join('')}</select></div></div>
      <div class="f"><label class="l">상품 상태</label><div class="two" style="grid-template-columns:1fr"><select name="cond"><option>새것 같음</option><option selected>상</option><option>중</option></select></div></div>
      <div class="f only-food"><label class="l">유통기한 <i>*</i></label><input class="in" type="date" name="expiry"><p class="hint">음식은 유통기한이 지난 물품은 등록할 수 없어요.</p></div>
      <div class="f"><label class="l">설명 <i>*</i></label><textarea name="desc" maxlength="500" placeholder="물품 상태, 사용 기간, 거래 방법 등을 자유롭게 적어주세요."></textarea></div>
      <div class="f only-rent"><label class="l"><span class="k-offer">대여 기간 <i>*</i></span><span class="k-request">희망 대여 기간 <i>*</i></span></label>
        <div class="two"><input class="in" name="term" type="number" min="1" value="1"><select name="unit"><option>일</option><option>주</option><option selected>개월</option></select></div></div>
      <div class="f rent-offer"><label class="l">대여료 (위 기간 기준) <i>*</i></label><input class="in" name="price" type="number" inputmode="numeric" min="0" placeholder="예) 4000"></div>
      <div class="f rent-offer"><label class="l">보증금</label><input class="in" name="deposit" type="number" inputmode="numeric" min="0" placeholder="0 (없으면 비워두세요)"></div>
      <div class="f only-barter"><label class="l">교환 희망 키워드 <i>*</i></label><input class="in" name="wish" maxlength="40" placeholder="예) 과일, 만화책 (쉼표로 구분)">
        <p class="hint">이 키워드로 가까운 교환 상대를 추천하고, 키워드가 들어간 새 글이 올라오면 알림을 보내드려요.</p></div>
      <div class="f"><label class="l">거래 장소</label><input class="in" name="loc" maxlength="20" placeholder="예) 중앙도서관 앞"></div>
    </form>
    <div class="stickybtn"><button class="btn pri block" data-act="submitreg" style="--acc:var(--pri)">등록하기</button></div></div>`;
}

function Search(q) {
  const kw = q.get('q') || '', cat = q.get('cat') || '';
  let res = null;
  if (kw || cat) {
    res = vis().filter(i => (!kw || (i.title + i.desc + i.cat + (i.wish || '')).toLowerCase().includes(kw.toLowerCase())) && (!cat || i.cat.startsWith(cat))).sort((a, b) => b.ts - a.ts);
  }
  return `<div class="screen">
    <div class="topbar"><button class="ib" data-act="back">${I('back')}</button>
      <form class="searchbar sm" data-form="gsearch" style="flex:1;margin:0">${I('search', 18)}<input name="q" value="${esc(kw)}" placeholder="무엇을 찾으세요?" autocomplete="off"></form>${homeBtn}</div>
    <div class="content">${res ? `<div class="countrow"><span>${cat ? CAT_EM[cat] + ' ' + cat : '“' + esc(kw) + '”'} 검색결과 ${res.length}개</span></div><div class="list">${res.length ? res.map(i => card(i)).join('') : empty('🔍', '검색 결과가 없어요.<br>다른 키워드로 찾아보세요.')}</div>`
      : `${S.recent.length ? `<div class="sec-h"><h3>최근 검색어</h3><a href="#/search" data-act="clr">지우기</a></div><div class="chips" style="flex-wrap:wrap">${S.recent.map(k => `<a class="chip" href="#/search?q=${encodeURIComponent(k)}">${esc(k)}</a>`).join('')}</div>` : ''}
      <div class="sec-h" style="padding-top:18px"><h3>인기 검색어</h3></div><div class="chips" style="flex-wrap:wrap">${['전공책', '카메라', '텐트', '아이패드', '정장', '요거트', '보드게임'].map(k => `<a class="chip" href="#/search?q=${encodeURIComponent(k)}">🔥 ${k}</a>`).join('')}</div>
      <div class="sec-h" style="padding-top:18px"><h3>카테고리로 찾기</h3></div><div class="cats" style="flex-wrap:wrap">${Object.keys(CATS).map(c => `<a class="cat" href="#/search?cat=${encodeURIComponent(c)}"><i>${CAT_EM[c]}</i>${c}</a>`).join('')}</div>`}</div></div>`;
}

function Match() {
  const ms = matches(), wants = barterKw();
  return `<div class="screen barter-scope">${topbar({ title: '내 근처 교환 매칭', right: homeBtn })}
    <div class="content">
      <div class="locbar"><span>${I('pin', 16)} 내 위치 · 우리 학교 주변</span><button data-act="radsheet">반경 ${S.radius}km ${I('chev', 14)}</button></div>
      <div class="wantbox"><small>내가 찾는 키워드</small><div class="chips" style="padding:8px 0 0;flex-wrap:wrap">${wants.length ? wants.map(w => `<span class="chip on">${esc(w)}</span>`).join('') : '<span class="meta">아직 없어요</span>'}<a class="chip" href="#/keywords">${I('plus', 14)} 키워드 관리</a></div>
        <p class="hint2">내가 올린 교환 글의 희망 키워드와 직접 추가한 키워드를 함께 사용해요. 가까운 순 · 서로 원하는 조합일수록 위에 보여드려요.</p></div>
      <div class="list">${ms.length ? ms.map(m => `<div class="mwrap"><div class="mbadges">${m.hits.slice(0, 2).map(h => `<span class="mb">✨ ‘${esc(h)}’ 일치</span>`).join('')}<span class="mb">${I('pin', 12)} ${m.it.dist}km</span>${m.mutual ? '<span class="mb hot">💞 서로 원해요</span>' : ''}</div>${card(m.it)}</div>`).join('')
        : empty('🧭', wants.length ? `반경 ${S.radius}km 안에는 아직 맞는 상대가 없어요.<br>반경을 넓히거나 키워드를 더 추가해보세요.` : '찾는 키워드가 없어요.<br>교환 글을 올리거나 키워드를 추가하면 추천해드려요.')}</div>
    </div></div>`;
}

function Keywords() {
  const auto = autoWants();
  const chipList = (arr, t) => arr.map(k => `<span class="chip on kchip">${esc(k)}<button data-act="kwdel" data-t="${t}" data-k="${esc(k)}" aria-label="삭제">${I('close', 12)}</button></span>`).join('');
  return `<div class="screen">${topbar({ title: '키워드 알림', right: homeBtn })}
    <div class="content"><div class="kwwrap">
      <section class="kwsec barter-scope"><h3>🔄 물물교환 선호 키워드</h3>
        <p>내가 올린 교환 글의 <b>교환 희망 키워드</b>는 자동으로 등록돼요. 이 키워드가 들어간 새 교환 글이 올라오면 알려드려요.</p>
        <div class="chips" style="padding:0;flex-wrap:wrap">${auto.map(k => `<span class="chip kchip lock">${esc(k)} <small>내 글</small></span>`).join('')}${chipList(S.kwBarter, 'barter')}${!auto.length && !S.kwBarter.length ? '<span class="meta">등록된 키워드가 없어요</span>' : ''}</div>
        <form class="kwadd" data-form="kwadd" data-t="barter"><input name="k" placeholder="키워드 추가 (예: 과일, 만화)" autocomplete="off"><button class="btn pri" style="--acc:var(--bar);height:42px">추가</button></form></section>
      <section class="kwsec rent-scope"><h3>📦 대여 키워드</h3>
        <p>대여에는 선호 물품이 없으니 원하는 키워드를 직접 추가하세요. 해당 키워드가 들어간 새 대여 글이 올라오면 알려드려요.</p>
        <div class="chips" style="padding:0;flex-wrap:wrap">${chipList(S.kwRent, 'rent') || '<span class="meta">등록된 키워드가 없어요</span>'}</div>
        <form class="kwadd" data-form="kwadd" data-t="rent"><input name="k" placeholder="키워드 추가 (예: 카메라, 텐트)" autocomplete="off"><button class="btn pri" style="height:42px">추가</button></form></section>
      <section class="kwsec demo"><h3>🧪 시연하기</h3>
        <p>서버가 없는 시연용 앱이라 “새 글이 올라오는 상황”을 버튼으로 재현해요. 키워드와 일치하면 알림이 도착합니다.</p>
        <button class="btn line block" data-act="sim">새 글 도착시키기</button></section>
    </div></div></div>`;
}

function Wishlist() {
  const items = S.wish.map(byId).filter(i => i && (isMine(i) || !S.blocked.includes(i.seller)));
  return `<div class="screen">${topbar({ title: '관심 목록', right: homeBtn })}<div class="content"><div class="list">${items.length ? items.map(i => card(i)).join('') : empty('🤍', '아직 관심 물품이 없어요.<br>마음에 드는 물품의 하트를 눌러보세요!')}</div></div></div>`;
}

function Notes() {
  const html = `<div class="screen">${topbar({ title: '알림', right: homeBtn })}<div class="content">
    <a class="kwlink" href="#/keywords">${I('tag', 18)}<span><b>키워드 알림 설정</b><small>교환 선호 키워드 · 대여 키워드</small></span>${I('right', 18)}</a>
    ${S.notes.length ? S.notes.map(n => { const un = !n.read; const inner = `<div class="ic">${n.icon}</div><div>${esc(n.text)}<small>${ago(n.ts)}</small></div>`; return n.href ? `<a class="note ${un ? 'un' : ''}" href="${n.href}">${inner}</a>` : `<div class="note ${un ? 'un' : ''}">${inner}</div>`; }).join('') : empty('🔔', '새로운 알림이 없어요.')}</div></div>`;
  S.notes.forEach(n => n.read = true); save();
  return html;
}

function Chats() {
  const ids = Object.keys(S.chats).filter(id => { const it = byId(id); return it && !S.blocked.includes(it.seller); }).sort((a, b) => S.chats[b].ts - S.chats[a].ts);
  return `<div class="screen">${topbar({ back: false, title: '채팅' })}<div class="content">${ids.length ? ids.map(id => {
    const it = byId(id), th = S.chats[id], last = th.msgs[th.msgs.length - 1];
    return `<a class="chatrow" href="#/chat/${id}"><div class="thumb" style="background:${it.bg}">${thumbIn(it)}</div><div class="t"><b>${esc(it.seller)}</b> <small>· ${esc(it.title)}</small><p>${last ? esc(last.text) : '대화를 시작해보세요'}</p></div><small>${ago(th.ts)}</small></a>`;
  }).join('') : empty('💬', '아직 대화가 없어요.<br>물품 상세에서 채팅을 시작해보세요!')}</div>${nav('chat')}</div>`;
}

function Chat(id) {
  const it = byId(id); if (!it) return `<div class="screen">${topbar()}${empty('🫥', '대화방을 찾을 수 없어요.')}</div>`;
  const th = S.chats[id] || { msgs: [], ts: Date.now() }, blocked = S.blocked.includes(it.seller);
  const sub = it.type === 'rent' ? (isReq(it) ? '대여 요청 · 희망 ' + it.term + it.unit : won(it.price) + ' / ' + it.term + it.unit) : '교환 · ' + esc(it.wish);
  return `<div class="screen">${topbar({ title: it.seller, right: homeBtn + (isMine(it) ? '' : `<button class="ib" data-act="more" data-id="${it.id}" aria-label="더보기">${I('more')}</button>`) })}
    <a class="chat-item" href="#/item/${it.id}"><div class="thumb" style="background:${it.bg}">${thumbIn(it)}</div><div><b>${esc(it.title)}</b><br><span style="color:var(--pri-d);font-weight:700">${sub}</span></div></a>
    <div class="content" id="msgbox"><div class="msgs">${th.msgs.map(msgHtml).join('')}</div></div>
    ${blocked ? `<div class="blockedbar">차단한 회원이에요. <a href="#/my/blocked">차단 관리</a>에서 해제할 수 있어요.</div>` : `
    <div class="quick">${['아직 가능한가요?', '거래 장소 어디가 좋을까요?', '가격 조정 가능할까요?'].map(t => `<button data-act="quick" data-id="${id}" data-t="${t}">${t}</button>`).join('')}</div>
    <form class="composer" data-form="chat" data-id="${id}"><input name="t" placeholder="메시지를 입력하세요" autocomplete="off">
      <button aria-label="전송">${I('send', 20)}</button></form>`}</div>`;
}
const msgHtml = m => `<div class="msg ${m.from}" title="${clock(m.t)}">${esc(m.text)}</div>`;

function My() {
  const row = (href, ic, t, extra = '') => `<a href="${href}">${I(ic, 20)}${t}${extra}<span class="r">${I('right', 18)}</span></a>`;
  return `<div class="screen">${topbar({ back: false, title: 'MY' })}<div class="content">
    <div class="profile"><div class="avatar">😀</div><div><h2>나 (학생)</h2><p>우리 학교 · 신뢰점수 4.7</p></div></div>
    <div class="stats"><a href="#/my/items"><b>${S.mine.length}</b><span>내 물품</span></a><a href="#/wishlist"><b>${S.wish.length}</b><span>관심</span></a><a href="#/my/history"><b>${S.reqs.length}</b><span>거래내역</span></a></div>
    <div class="menu">
      ${row('#/my/items', 'list', '내가 등록한 물품')}
      ${row('#/my/history', 'clock', '대여 · 교환 내역')}
      ${row('#/wishlist', 'heart', '관심 목록')}
      ${row('#/match', 'sparkle', '내 근처 교환 매칭')}
      ${row('#/keywords', 'tag', '키워드 알림 설정')}
      ${row('#/notifications', 'bell', '알림')}</div>
    <div class="menu" style="margin-top:14px">
      ${row('#/my/blocked', 'ban', '차단 관리', S.blocked.length ? `<small class="cntb">${S.blocked.length}</small>` : '')}
      ${row('#/my/reports', 'flag', '신고 내역', S.reports.length ? `<small class="cntb">${S.reports.length}</small>` : '')}
      <button data-act="showonb">${I('info', 20)}이용 안내 · 면책 고지</button>
      <button data-act="reset">${I('reset', 20)}데이터 초기화 (시연용)</button></div><div class="safe"></div>
    </div>${nav('my')}</div>`;
}
function MyItems() {
  return `<div class="screen">${topbar({ title: '내가 등록한 물품', right: `<a class="ib" href="#/register">${I('plus')}</a>` })}<div class="content"><div class="list">${S.mine.length ? S.mine.map(i => card(i, { del: true })).join('') : empty('📦', '등록한 물품이 없어요.<br>우측 상단 + 버튼으로 첫 물품을 올려보세요!')}</div></div></div>`;
}
function History() {
  return `<div class="screen">${topbar({ title: '대여 · 교환 내역' })}<div class="content">${S.reqs.length ? S.reqs.map(r => `<a class="hist" href="#/item/${r.itemId}"><div><b>${esc(r.title)}</b><small>${esc(r.detail)} · ${ago(r.ts)}</small></div><span class="state">${r.state}</span></a>`).join('') : empty('🧾', '아직 거래 내역이 없어요.')}</div></div>`;
}
function Blocked() {
  return `<div class="screen">${topbar({ title: '차단 관리' })}<div class="content">${S.blocked.length ? S.blocked.map(n => `<div class="hist"><div><b>🙂 ${esc(n)}</b><small>차단한 회원 · 글과 채팅이 보이지 않아요</small></div><button class="btn line" style="height:38px;font-size:14px" data-act="unblock" data-n="${esc(n)}">해제</button></div>`).join('') : empty('🚫', '차단한 회원이 없어요.')}<p class="hint2" style="padding:16px 20px">불쾌하거나 위험한 회원은 게시글·채팅방의 ⋯ 메뉴에서 신고하거나 차단할 수 있어요.</p></div></div>`;
}
function Reports() {
  return `<div class="screen">${topbar({ title: '신고 내역' })}<div class="content">${S.reports.length ? S.reports.map(r => `<div class="hist"><div><b>${esc(r.seller)} · ${esc(r.reason)}</b><small>${esc(r.title)} · ${ago(r.ts)}</small></div><span class="state">접수됨</span></div>`).join('') : empty('🚩', '접수한 신고가 없어요.')}</div></div>`;
}

/* ---------- 라우터 ---------- */
function render() {
  const h = location.hash.slice(1) || '/';
  const [p, qs] = h.split('?'); const seg = p.split('/').filter(Boolean); const q = new URLSearchParams(qs || '');
  let html;
  switch (seg[0]) {
    case undefined: html = Main(); break;
    case 'list': html = List(seg[1] === 'barter' ? 'barter' : 'rent'); break;
    case 'item': html = Detail(seg[1]); break;
    case 'register': photoData = null; html = Register(q); break;
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
    case 'my': html = seg[1] === 'items' ? MyItems() : seg[1] === 'history' ? History() : seg[1] === 'blocked' ? Blocked() : seg[1] === 'reports' ? Reports() : My(); break;
    default: html = Main();
  }
  view.innerHTML = html;
  closeSheet(true);
  const mb = $('#msgbox'); if (mb) mb.scrollTop = mb.scrollHeight;
  if (seg[0] === 'search' && !q.get('q') && !q.get('cat')) { const si = $('.searchbar input'); if (si) si.focus(); }
}
function rerender() { render(); const s = $('.screen'); if (s) s.style.animation = 'none'; }
window.addEventListener('hashchange', render);

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
function pushMsg(id, from, text) { const th = thread(id); th.msgs.push({ from, text, t: Date.now() }); th.ts = Date.now(); save(); }
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
  const box = $('.msgs'); if (box) { box.insertAdjacentHTML('beforeend', msgHtml({ from: 'me', text, t: Date.now() })); $('#msgbox').scrollTop = 1e6; }
  const reply = /가능|있나요|남았/.test(text) ? '네, 아직 가능해요! 😊' : /장소|어디/.test(text) ? '학교 정문 앞 카페나 도서관 로비 어때요?' : /가격|깎|조정|네고/.test(text) ? '조금은 조정할 수 있어요. 생각하는 금액 있으세요?' : /감사|고마/.test(text) ? '저도 감사해요! 좋은 거래 해요 🙌' : '네 확인했어요! 편하신 시간 알려주세요 🙌';
  setTimeout(() => {
    if (S.blocked.includes(byId(id)?.seller)) return;
    pushMsg(id, 'them', reply);
    if (location.hash === '#/chat/' + id) { const b = $('.msgs'); if (b) { b.insertAdjacentHTML('beforeend', msgHtml({ from: 'them', text: reply, t: Date.now() })); $('#msgbox').scrollTop = 1e6; } }
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

/* ---------- 액션 ---------- */
let repSel = null;
const A = {
  back() { if (history.length > 1) history.back(); else go('#/'); },
  close() { closeSheet(); },
  wish(t) {
    const id = t.dataset.id; const i = S.wish.indexOf(id);
    if (i >= 0) S.wish.splice(i, 1); else { S.wish.push(id); toast('관심 목록에 담았어요 ❤️'); }
    save();
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
  dtab(t) {
    document.querySelectorAll('.dtabs button').forEach(b => b.classList.toggle('on', b === t));
    document.querySelectorAll('.pane').forEach(p => p.hidden = p.dataset.pane !== t.dataset.v);
  },
  chat(t) { const id = t.dataset.id; sysThread(id); go('#/chat/' + id); },
  quick(t) { sendChat(t.dataset.id, t.dataset.t); },
  clr() { S.recent = []; save(); },
  del(t) {
    const id = t.dataset.id;
    sheet(`<h3>정말 삭제할까요?</h3><p style="color:var(--sub);margin-bottom:16px">삭제한 물품은 되돌릴 수 없어요.</p><div style="display:flex;gap:10px"><button class="btn line" style="flex:1" data-act="close">취소</button><button class="btn pri" style="flex:1;--acc:#E5484D" data-act="delok" data-id="${id}">삭제</button></div>`);
  },
  delok(t) {
    S.mine = S.mine.filter(i => i.id !== t.dataset.id); S.wish = S.wish.filter(i => i !== t.dataset.id); delete S.chats[t.dataset.id]; save();
    toast('삭제했어요'); closeSheet(true);
    if (location.hash.startsWith('#/item/')) go('#/my/items'); else rerender();
  },
  done(t) { const it = byId(t.dataset.id); S.over[it.id] = stOf(it) === 'done' ? 'open' : 'done'; if (isMine(it)) it.status = S.over[it.id]; save(); toast(stOf(it) === 'done' ? '거래 완료로 표시했어요 🎉' : '다시 열었어요'); rerender(); },

  /* 대여 신청 (빌려주는 글) */
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
    S.reqs.unshift({ id: 'r' + Date.now(), itemId: it.id, title: it.title, detail: `대여 ${n}${it.unit} · ${won(total)}`, ts: Date.now(), state: '승인 대기' });
    addNote('📦', `‘${it.title}’ 대여 신청을 보냈어요. ${it.seller}님의 승인을 기다려요.`, '#/chat/' + it.id);
    sysThread(it.id, `대여 신청 · ${n}${it.unit} · 대여료 ${won(total)} + 보증금 ${won(it.deposit)}`);
    closeSheet(true);
    if (msg) sendChat(it.id, msg);
    toast('대여 신청 완료! 채팅으로 일정을 조율해요'); go('#/chat/' + it.id);
  },

  /* 대여 요청 글에 조건 제안 (빌려주는 사람이 대여비·보증금 제시) */
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
    S.reqs.unshift({ id: 'r' + Date.now(), itemId: it.id, title: it.title, detail: `조건 제안 · ${won(price)} / 보증금 ${dep ? won(dep) : '없음'}`, ts: Date.now(), state: '제안함' });
    addNote('📦', `‘${it.title}’ 요청에 대여 조건을 제안했어요.`, '#/chat/' + it.id);
    sysThread(it.id, `대여 조건 제안 · ${it.term}${it.unit} · 대여료 ${won(price)} · 보증금 ${dep ? won(dep) : '없음'}`);
    closeSheet(true);
    if (msg) sendChat(it.id, msg);
    toast('조건을 제안했어요'); go('#/chat/' + it.id);
  },

  /* 교환 제안 */
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
    sysThread(it.id, '교환 제안을 보냈어요'); closeSheet(true);
    sendChat(it.id, '교환 제안드려요! ' + msg); toast('제안을 보냈어요'); go('#/chat/' + it.id);
  },

  /* 등록 */
  submitreg() {
    const f = $('#regform'), d = Object.fromEntries(new FormData(f)); const type = d.type;
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
    const id = 'u' + Date.now();
    const it = {
      id, type, kind, title: d.title.trim(), emoji: CAT_EM[d.main], bg: BGS[Math.floor(Math.random() * BGS.length)], img: photoData,
      cat: `${d.main} > ${d.sub}`, desc: d.desc.trim(), cond: d.cond, loc: d.loc.trim() || '학교 안', seller: '나', score: 4.7, status: 'open', likes: 0, reviews: 0, dist: 0, ts: Date.now(),
      ...(type === 'rent' ? (kind === 'offer' ? { price: +d.price, term: +d.term, unit: d.unit, deposit: +d.deposit || 0 } : { term: +d.term, unit: d.unit }) : { wish: d.wish.trim() }),
      ...(food ? { expiry: d.expiry } : {})
    };
    S.mine.unshift(it);
    addNote('✅', `‘${it.title}’ ${kind === 'request' ? '대여 요청이' : '물품이'} 등록됐어요.`, '#/item/' + id);
    if (type === 'barter') addNote('🔔', `교환 희망 키워드 ‘${it.wish}’로 매칭·알림을 받아요.`, '#/match');
    save(); photoData = null;
    toast('등록 완료! 🎉'); history.replaceState(null, '', '#/item/' + id); render();
  },

  /* 키워드 */
  kwdel(t) { const key = t.dataset.t === 'rent' ? 'kwRent' : 'kwBarter'; S[key] = S[key].filter(k => k !== t.dataset.k); save(); rerender(); },
  sim() {
    const tpl = INCOMING[S.feedIdx % INCOMING.length]; S.feedIdx++;
    const it = mk('x' + Date.now(), { ...tpl, ago: 0 }); S.extra.unshift(it);
    let note = null;
    if (it.type === 'rent') {
      const h = hay(it), k = S.kwRent.find(w => h.includes(w.toLowerCase()));
      if (k) note = ['🔔', `대여 키워드 ‘${k}’ 새 글이 올라왔어요: ${it.title}`];
    } else {
      const h = hay(it), hits = barterKw().filter(w => h.includes(w));
      if (hits.length && it.dist <= S.radius) note = ['💘', `찾던 ‘${hits[0]}’ 교환 글이 올라왔어요 (${it.dist}km): ${it.title}`];
    }
    if (note) { addNote(note[0], note[1], '#/item/' + it.id); toast('🔔 키워드 알림이 도착했어요'); }
    else { save(); toast(`새 ${it.type === 'rent' ? '대여' : '교환'} 글 “${it.title}” (키워드 불일치 → 알림 없음)`); }
    rerender();
  },
  unblock(t) { S.blocked = S.blocked.filter(n => n !== t.dataset.n); save(); toast('차단을 해제했어요'); rerender(); },

  /* 신고 · 차단 */
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
    const it = byId(t.dataset.id), also = $('#alsoBlock').checked, detail = $('#repmsg').value.trim();
    S.reports.unshift({ id: 'rp' + Date.now(), itemId: it.id, seller: it.seller, title: it.title, reason: repSel, detail, ts: Date.now() });
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

  /* 온보딩 */
  onbnext() { onbStep = Math.min(onbStep + 1, ONB.length - 1); drawOnb(); },
  onbskip() { onbStep = ONB.length - 1; drawOnb(); },
  onbdone() {
    if (!onbReopen && !$('#onbAgree')?.checked) return toast('안내 내용에 동의해주세요');
    S.onboarded = true; save(); onbEl.className = 'onb'; onbEl.innerHTML = '';
  },
  showonb() { showOnb(true); },
  reset() { sheet(`<h3>데이터를 초기화할까요?</h3><p style="color:var(--sub);margin-bottom:16px">등록한 물품, 관심, 채팅, 키워드, 차단·신고 내역이 모두 처음 상태로 돌아가요.</p><div style="display:flex;gap:10px"><button class="btn line" style="flex:1" data-act="close">취소</button><button class="btn pri" style="flex:1;--acc:#E5484D" data-act="resetok">초기화</button></div>`); },
  resetok() { S = freshState(); save(); closeSheet(true); go('#/'); render(); showOnb(false); }
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
    case 'gsearch': if (v.trim()) go('#/search?q=' + encodeURIComponent(v.trim())); break;
    case 'lsearch': F[f.dataset.type].q = v.trim(); rerender(); break;
    case 'chat': sendChat(f.dataset.id, v); f.reset(); break;
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
    if (e.target.value === '음식') f.setAttribute('data-food', ''); else f.removeAttribute('data-food');
  }
  if (e.target.id === 'photoIn' && e.target.files[0]) readPhoto(e.target.files[0]);
});

render();
if (!S.onboarded) showOnb(false);
})();
