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

  const asText = value => String(value || '').trim();
  const asTime = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const normalize = note => {
    const updatedAt = asTime(note?.updatedAt);
    const fieldUpdatedAt = note?.fieldUpdatedAt || {};
    return {
      ...(note || {}),
      summary: note?.summary || '',
      personal: note?.personal || note?.content || '',
      ai: note?.ai || '',
      updatedAt,
      fieldUpdatedAt: {
        summary: asTime(fieldUpdatedAt.summary) || updatedAt,
        personal: asTime(fieldUpdatedAt.personal) || updatedAt,
        ai: asTime(fieldUpdatedAt.ai) || updatedAt
      }
    };
  };

  const hasContent = note => Boolean(asText(note.summary) || asText(note.personal || note.content) || asText(note.ai));
  const notify = note => window.PRACTICE_SYNC?.notifyNote?.(note);

  window.PRACTICE_NOTES = {
    get(questionId) {
      return requestResult('readonly', store => store.get(questionId)).then(normalize);
    },
    async put(question, draft) {
      const previous = await this.get(question.id);
      const note = { summary: asText(draft?.summary), personal: asText(draft?.personal), ai: asText(draft?.ai) };
      if (!hasContent(note)) {
        await requestResult('readwrite', store => store.delete(question.id));
        notify({ questionId: question.id, deleted: true, updatedAt: Date.now() });
        return null;
      }
      const now = Date.now();
      const fieldUpdatedAt = { ...previous.fieldUpdatedAt };
      ['summary', 'personal', 'ai'].forEach(field => {
        if (note[field] !== previous[field]) fieldUpdatedAt[field] = now;
      });
      const saved = normalize({
        questionId: question.id,
        number: question.number,
        title: question.title || question.content || '未命名题目',
        source: question.source,
        group: question.group || '',
        category: question.category,
        ...note,
        fieldUpdatedAt,
        updatedAt: Math.max(fieldUpdatedAt.summary || 0, fieldUpdatedAt.personal || 0, fieldUpdatedAt.ai || 0, previous.updatedAt || 0)
      });
      await requestResult('readwrite', store => store.put(saved));
      notify(saved);
      return saved;
    },
    all() {
      return requestResult('readonly', store => store.getAll()).then(notes => notes.map(normalize).sort((a, b) => b.updatedAt - a.updatedAt));
    },
    async merge(remote) {
      const incoming = normalize(remote);
      if (!incoming.questionId) return null;
      const local = await this.get(incoming.questionId);
      if (incoming.deleted) {
        if (asTime(incoming.updatedAt) > asTime(local.updatedAt)) {
          await requestResult('readwrite', store => store.delete(incoming.questionId));
          return { questionId: incoming.questionId, deleted: true, updatedAt: incoming.updatedAt };
        }
        return local;
      }
      const merged = normalize({ ...local, ...incoming, fieldUpdatedAt: { ...local.fieldUpdatedAt, ...incoming.fieldUpdatedAt } });
      ['summary', 'personal', 'ai'].forEach(field => {
        const localTime = asTime(local.fieldUpdatedAt[field]);
        const remoteTime = asTime(incoming.fieldUpdatedAt[field]);
        if (localTime > remoteTime) {
          merged[field] = local[field];
          merged.fieldUpdatedAt[field] = localTime;
        } else {
          merged[field] = incoming[field];
          merged.fieldUpdatedAt[field] = remoteTime;
        }
      });
      merged.updatedAt = Math.max(merged.fieldUpdatedAt.summary || 0, merged.fieldUpdatedAt.personal || 0, merged.fieldUpdatedAt.ai || 0);
      if (!hasContent(merged)) return null;
      await requestResult('readwrite', store => store.put(merged));
      return merged;
    },
    replaceAll(notes) {
      return openDb().then(db => new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.clear();
        notes.forEach(note => { const normalized = normalize(note); if (normalized.questionId && hasContent(normalized)) store.put(normalized); });
        transaction.oncomplete = () => { db.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error || new Error('导入失败'));
      }));
    }
  };
})();
