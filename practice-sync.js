import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { collection, doc, getDocs, getFirestore, onSnapshot, setDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

(() => {
  const CONFIG = window.PRACTICE_FIREBASE_CONFIG;
  const SETTINGS_KEY = 'interview-ai-practice-sync-v1';
  const RECORDS_KEY = 'interview-ai-practice-records-v1';
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const safeJson = (value, fallback) => { try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' ? parsed : fallback; } catch (_) { return fallback; } };
  let app, auth, firestore, unsubscribe, settings = readSettings(), authUser, started = false;
  const readRecords = () => safeJson(localStorage.getItem(RECORDS_KEY) || '{}', {});
  const writeRecords = records => localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  const asTime = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const b64url = bytes => {
    let text = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) text += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  };
  const fromB64url = value => {
    const text = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = text + '='.repeat((4 - text.length % 4) % 4);
    return Uint8Array.from(atob(padded), char => char.charCodeAt(0));
  };
  const emit = (name, detail = {}) => window.dispatchEvent(new CustomEvent(name, { detail }));
  const notifyStatus = (extra = {}) => emit('practice:sync-status', { enabled: Boolean(settings?.secret), ready: Boolean(authUser), vaultId: settings?.vaultId || '', ...extra });

  function readSettings() {
    const saved = safeJson(localStorage.getItem(SETTINGS_KEY) || '{}', {});
    return saved?.secret ? saved : null;
  }
  function saveSettings(next) {
    settings = next;
    if (next?.secret) localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    else localStorage.removeItem(SETTINGS_KEY);
    notifyStatus();
  }
  async function vaultIdFor(secret) {
    const digest = await crypto.subtle.digest('SHA-256', fromB64url(secret));
    return b64url(new Uint8Array(digest));
  }
  async function keyFor(secret) {
    return crypto.subtle.importKey('raw', fromB64url(secret), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }
  async function encrypt(secret, payload) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await keyFor(secret);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(payload)));
    return { iv: b64url(iv), data: b64url(new Uint8Array(cipher)) };
  }
  async function decrypt(secret, saved) {
    const key = await keyFor(secret);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64url(saved.iv) }, key, fromB64url(saved.data));
    return JSON.parse(decoder.decode(plain));
  }
  const itemId = (kind, id) => `${kind}-${b64url(encoder.encode(String(id)))}`;
  const itemRef = (kind, id) => doc(collection(firestore, 'syncVaults', settings.vaultId, 'items'), itemId(kind, id));

  async function ensureFirebase() {
    if (!CONFIG) throw new Error('Firebase 配置尚未加载');
    if (!app) {
      app = getApps()[0] || initializeApp(CONFIG);
      auth = getAuth(app);
      firestore = getFirestore(app);
      onAuthStateChanged(auth, user => { authUser = user || null; notifyStatus(); });
    }
    if (!auth.currentUser) await signInAnonymously(auth);
    authUser = auth.currentUser;
  }

  async function mergeRecord(remote) {
    if (!remote?.questionId || remote.deleted) return;
    const records = readRecords();
    const local = records[remote.questionId];
    if (!local || asTime(remote.updatedAt) > asTime(local.updatedAt)) {
      records[remote.questionId] = remote;
      writeRecords(records);
      emit('practice:records-merged', { questionId: remote.questionId });
    }
  }
  async function mergeItem(snapshot) {
    const saved = snapshot.data ? snapshot.data() : snapshot;
    if (!saved?.kind || !saved?.data || !settings?.secret) return;
    try {
      const payload = await decrypt(settings.secret, saved);
      if (saved.kind === 'record') await mergeRecord(payload);
      if (saved.kind === 'note' && window.PRACTICE_NOTES) {
        const before = await window.PRACTICE_NOTES.get(payload.questionId);
        const merged = await window.PRACTICE_NOTES.merge(payload);
        if (merged && JSON.stringify(before) !== JSON.stringify(merged)) emit('practice:notes-merged', { questionId: payload.questionId });
      }
    } catch (_) {
      // 同步密钥不匹配或数据损坏时忽略该条，不覆盖本地记录。
    }
  }
  async function pullRemote() {
    const remote = await getDocs(collection(firestore, 'syncVaults', settings.vaultId, 'items'));
    for (const item of remote.docs) await mergeItem(item);
  }
  function listenRemote() {
    unsubscribe?.();
    unsubscribe = onSnapshot(collection(firestore, 'syncVaults', settings.vaultId, 'items'), snapshot => {
      snapshot.docChanges().filter(change => change.type !== 'removed').forEach(change => mergeItem(change.doc));
      notifyStatus({ syncing: false });
    }, () => notifyStatus({ error: '云端暂时不可用，本地记录仍在浏览器中。' }));
  }
  async function upload(kind, id, payload) {
    if (!settings?.secret || !payload || !firestore) return;
    const encrypted = await encrypt(settings.secret, payload);
    await setDoc(itemRef(kind, id), { kind, version: 1, updatedAt: asTime(payload.updatedAt) || Date.now(), ...encrypted });
  }
  async function uploadLocal() {
    const records = readRecords();
    for (const [questionId, record] of Object.entries(records)) await upload('record', questionId, { ...record, questionId });
    if (window.PRACTICE_NOTES) {
      const notes = await window.PRACTICE_NOTES.all();
      for (const note of notes) await upload('note', note.questionId, note);
    }
  }
  async function connect(secret) {
    const cleaned = String(secret || '').trim();
    let raw;
    try { raw = fromB64url(cleaned); } catch (_) { throw new Error('恢复密钥格式不正确'); }
    if (raw.length !== 32) throw new Error('恢复密钥格式不正确');
    const vaultId = await vaultIdFor(cleaned);
    saveSettings({ version: 1, secret: cleaned, vaultId, connectedAt: Date.now() });
    await ensureFirebase();
    await pullRemote();
    await uploadLocal();
    listenRemote();
    started = true;
    notifyStatus({ syncing: false });
    return getStatus();
  }
  async function createNew() {
    const secret = b64url(crypto.getRandomValues(new Uint8Array(32)));
    return connect(secret);
  }
  async function boot() {
    if (started || !settings?.secret) return;
    try { await connect(settings.secret); } catch (_) { notifyStatus({ error: '暂时无法连接云端，仍可正常离线使用。' }); }
  }
  function getPairUrl() {
    if (!settings?.secret) return '';
    const url = new URL('practice-sync.html', location.href);
    url.hash = `sync=${settings.secret}`;
    return url.toString();
  }
  function getStatus() {
    return { enabled: Boolean(settings?.secret), ready: Boolean(authUser), vaultId: settings?.vaultId || '', pairUrl: getPairUrl(), secret: settings?.secret || '' };
  }

  window.PRACTICE_SYNC = {
    getStatus,
    createNew,
    connect,
    async syncNow() { if (!settings?.secret) throw new Error('请先开启同步'); await ensureFirebase(); await pullRemote(); await uploadLocal(); },
    disconnect() { unsubscribe?.(); unsubscribe = null; started = false; saveSettings(null); },
    notifyRecord(questionId, record) { if (settings?.secret && record) upload('record', questionId, { ...record, questionId }).catch(() => notifyStatus({ error: '本次记录已保存在本机，云端会稍后重试。' })); },
    notifyNote(note) { if (settings?.secret && note?.questionId) upload('note', note.questionId, note).catch(() => notifyStatus({ error: '本次笔记已保存在本机，云端会稍后重试。' })); },
    getPairUrl
  };
  emit('practice:sync-ready');
  boot();
})();
