/* 쉐어메이트 백엔드: Firebase Auth(이메일/비밀번호) + Firestore(게시글·실시간 채팅·리뷰)
   firebase-config.js 가 비어있으면 enabled=false 로 남고 앱은 로컬 계정(데모) 모드로 동작합니다. */
(() => {
const BE = window.BE = { enabled: false, ready: false, user: null, items: [], rooms: [], reviews: [], repCounts: {}, roomCache: {}, onChange() {} };
const cfg = window.FIREBASE_CONFIG;
if (!cfg || !cfg.apiKey || !window.firebase) return;
firebase.initializeApp(cfg);
const auth = firebase.auth(), db = firebase.firestore(), FV = firebase.firestore.FieldValue;
BE.enabled = true;
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => { });   // 새로고침/재접속해도 로그인 유지
let subs = [];
const clean = o => { const c = JSON.parse(JSON.stringify(o)); delete c.remote; delete c.wishers; return c; };
const REMOVABLE = ['price', 'deposit', 'term', 'unit', 'wish', 'kw', 'expiry', 'img', 'mlat', 'mlng'];
const stop = () => { subs.forEach(f => f()); subs = []; BE.items = []; BE.rooms = []; BE.reviews = []; BE.repCounts = {}; };
const partner = (r, uid) => r.members.find(u => u !== uid);

/* 거래 완료(done) 글은 규칙상 ① 작성자 ② 거래 상대방(partnerUid) ③ 찜한 사용자(wishers)만 읽을 수 있어요.
   Firestore 규칙은 '필터'가 아니라서, 읽을 수 있는 글만 가져오도록 쿼리를 4개로 나눠 합칩니다. */
function start(u) {
  const parts = { open: [], mine: [], wish: [], partner: [] };
  let first = true;
  const merge = () => {
    const m = new Map();
    Object.values(parts).forEach(a => a.forEach(it => m.set(it.id, it)));
    BE.items = [...m.values()].sort((a, b) => (b.ts || 0) - (a.ts || 0));
    BE.onChange('items');
  };
  const watch = (key, q, notify) => subs.push(q.onSnapshot(s => {
    parts[key] = s.docs.map(d => ({ ...d.data(), id: d.id, remote: true }));
    if (notify && !first && !s.metadata.fromCache) s.docChanges().filter(c => c.type === 'added' && c.doc.data().uid !== u.uid)
      .forEach(c => BE.onChange('new', { ...c.doc.data(), id: c.doc.id, remote: true }));
    if (notify) first = false;
    /* 예전에 올린 글(done 필드 없음) 보정: 작성자가 접속하면 한 번 채워 넣어요 */
    if (key === 'mine') s.docs.filter(d => d.data().done === undefined)
      .forEach(d => d.ref.set({ done: d.data().status === 'done', wishers: d.data().wishers || [], partnerUid: d.data().partnerUid || null }, { merge: true }).catch(() => { }));
    merge();
  }, e => console.error('items:' + key, e)));
  const items = db.collection('items');
  watch('open', items.where('done', '==', false).limit(500), true);
  watch('mine', items.where('uid', '==', u.uid), false);
  watch('wish', items.where('wishers', 'array-contains', u.uid), false);
  watch('partner', items.where('partnerUid', '==', u.uid), false);

  subs.push(db.collection('chats').where('members', 'array-contains', u.uid).onSnapshot(s => {
    BE.rooms = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.ts - a.ts);
    BE.onChange('rooms');
  }, e => console.error('chats', e)));
  subs.push(db.collection('reviews').orderBy('ts', 'desc').limit(500).onSnapshot(s => {
    BE.reviews = s.docs.map(d => ({ ...d.data(), id: d.id })); BE.onChange('reviews');
  }, e => console.error('reviews', e)));
  /* 신고: 문서 id = 신고자uid_대상uid → 한 사람이 같은 회원을 여러 번 신고해도 1건. 대상별 '신고한 사람 수'를 셉니다 */
  subs.push(db.collection('reports').onSnapshot(s => {
    const c = {}; s.docs.forEach(d => { const t = d.data().targetUid; if (t) c[t] = (c[t] || 0) + 1; });
    BE.repCounts = c; BE.onChange('reports');
  }, e => console.error('reports', e)));
}

/* 회원 프로필 문서 (처음 로그인/가입 때 생성) */
function ensureProfile(u, name) {
  const ref = db.collection('users').doc(u.uid);
  const provider = (u.providerData[0] && u.providerData[0].providerId) || 'password';
  return ref.get().then(s => ref.set({
    name: name || u.displayName || (u.email || '').split('@')[0] || '회원', email: u.email || '', photo: u.photoURL || '',
    provider, lastLogin: Date.now(), ...(s.exists ? {} : { createdAt: Date.now() })
  }, { merge: true })).catch(() => { });
}

auth.onAuthStateChanged(u => {
  stop();
  BE.user = u ? { uid: u.uid, name: u.displayName || (u.email || '').split('@')[0] || '회원', email: u.email || '', photo: u.photoURL || '' } : null;
  BE.ready = true;
  if (u) { start(BE.user); if (!BE.signingUp) ensureProfile(u); }
  BE.onChange('auth');
});
/* 로그인 · 가입 (이메일/비밀번호) */
BE.emailIn = (email, pw) => auth.signInWithEmailAndPassword(email, pw);
BE.emailUp = async (email, pw, name) => {
  BE.signingUp = true;
  try {
    const c = await auth.createUserWithEmailAndPassword(email, pw);
    await c.user.updateProfile({ displayName: name });           // 닉네임 저장
    if (BE.user && BE.user.uid === c.user.uid) BE.user.name = name;
    await ensureProfile(c.user, name);
    BE.onChange('profile');
  } finally { BE.signingUp = false; }
};
BE.resetPw = email => auth.sendPasswordResetEmail(email);
BE.logout = () => auth.signOut();

/* 게시글 */
BE.createItem = it => db.collection('items').doc(it.id).set({ ...clean(it), done: it.status === 'done', wishers: [], partnerUid: null });
BE.saveItem = it => {                                           // 수정 · 상태 변경 (찜 목록 wishers 는 건드리지 않아요)
  const c = clean(it); c.done = it.status === 'done';
  REMOVABLE.forEach(k => { if (!(k in c)) c[k] = FV.delete(); });
  return db.collection('items').doc(it.id).set(c, { merge: true });
};
BE.delItem = id => db.collection('items').doc(id).delete();
BE.setWish = (id, on) => db.collection('items').doc(id).update({ wishers: on ? FV.arrayUnion(auth.currentUser.uid) : FV.arrayRemove(auth.currentUser.uid) });

/* 채팅: 방 id = 게시글id_구매자uid (게시글 하나당 사람마다 1:1 방) */
BE.openRoom = async it => {
  const u = BE.user, id = it.id + '_' + u.uid, ref = db.collection('chats').doc(id);
  const meta = { members: [u.uid, it.uid], names: { [u.uid]: u.name, [it.uid]: it.seller }, itemId: it.id, itemTitle: it.title, itemEmoji: it.emoji || '📦', itemBg: it.bg || '' };
  const snap = await ref.get();
  if (!snap.exists) await ref.set({ ...meta, ts: Date.now(), last: '', lastFrom: '' });
  BE.roomCache[id] = { id, ...meta, ts: Date.now(), last: '' };
  return id;
};
BE.send = async (id, text, type) => {
  const t = Date.now(), ref = db.collection('chats').doc(id);
  await ref.collection('messages').add({ from: BE.user.uid, text, t, type: type || 'msg' });
  await ref.update({ last: text, ts: t, lastFrom: BE.user.uid });
};
BE.watch = (id, cb) => db.collection('chats').doc(id).collection('messages').orderBy('t')
  .onSnapshot(s => cb(s.docs.map(d => d.data())), e => console.error('msgs', e));
BE.partner = partner;
/* 읽음 표시: 채팅방 문서의 read.{uid} 에 마지막으로 본 시각 저장 → 상대 화면에서 '1'이 사라짐 */
const lastMark = {};
BE.markRead = id => {
  const u = BE.user; if (!u || !id) return;
  const now = Date.now(); if (now - (lastMark[id] || 0) < 1500) return; lastMark[id] = now;
  db.collection('chats').doc(id).update({ ['read.' + u.uid]: now }).catch(() => { });
};
/* 신고 (같은 사람 → 같은 대상은 문서 1개라 중복 집계 불가, 규칙에서 덮어쓰기도 막음) */
BE.report = r => {
  const u = BE.user; if (!u || r.targetUid === u.uid) return Promise.reject(new Error('본인은 신고할 수 없어요'));
  const ref = db.collection('reports').doc(u.uid + '_' + r.targetUid);
  return ref.get().then(s => s.exists ? Promise.reject(new Error('이미 신고한 회원이에요'))
    : ref.set({ ...r, reporterUid: u.uid, ts: Date.now() }));
};

/* 리뷰 */
BE.addReview = r => db.collection('reviews').add(r);
})();
