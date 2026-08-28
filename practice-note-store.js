(() => {
  const DB_NAME = 'interview-ai-practice-notes';
  const STORE_NAME = 'notes';
  const DB_VERSION = 1;

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'questionId' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('无法打开本地笔记库'));
    });
  }

  function requestResult(mode, action) {
    return openDb().then(db => new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const request = action(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('笔记操作失败'));
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => reject(transaction.error || new Error('笔记操作失败'));
    }));
  }

  window.PRACTICE_NOTES = {
    get(questionId) {
      return requestResult('readonly', store => store.get(questionId)).then(note => ({
        summary: note?.summary || '', personal: note?.personal || note?.content || '', ai: note?.ai || ''
      }));
    },
    put(question, draft) {
      const note = { summary: String(draft?.summary || '').trim(), personal: String(draft?.personal || '').trim(), ai: String(draft?.ai || '').trim() };
      if (!note.summary && !note.personal && !note.ai) return requestResult('readwrite', store => store.delete(question.id));
      return requestResult('readwrite', store => store.put({
        questionId: question.id,
        number: question.number,
        title: question.title || question.content || '未命名题目',
        source: question.source,
        category: question.category,
        ...note,
        updatedAt: Date.now()
      }));
    },
    all() {
      return requestResult('readonly', store => store.getAll()).then(notes => notes.map(note => ({ ...note, summary: note.summary || '', personal: note.personal || note.content || '', ai: note.ai || '' })).sort((a, b) => b.updatedAt - a.updatedAt));
    },
    replaceAll(notes) {
      return openDb().then(db => new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.clear();
        notes.forEach(note => { if (note?.questionId && (String(note.summary || '').trim() || String(note.personal || note.content || '').trim() || String(note.ai || '').trim())) store.put({ ...note, personal: note.personal || note.content || '' }); });
        transaction.oncomplete = () => { db.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error || new Error('导入失败'));
      }));
    }
  };
})();
