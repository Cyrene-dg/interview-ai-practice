(() => {
  const bank = window.PRACTICE_BANK;
  const notes = window.PRACTICE_NOTES;
  if (!bank || !notes) return;
  const escapeHtml = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;');
  const list = document.querySelector('#noteList');
  const summary = document.querySelector('#noteSummary');
  const search = document.querySelector('#noteSearch');
  let allNotes = [];

  const fileName = suffix => `InterviewAI-笔记-${new Date().toISOString().slice(0, 10)}${suffix}`;
  const download = (name, content, type) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a'); link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };
  function draw() {
    const key = search.value.trim().toLowerCase();
    const shown = allNotes.filter(note => !key || `${note.source} ${note.group || ''} ${note.category} ${note.number} ${note.title} ${note.summary} ${note.personal} ${note.ai}`.toLowerCase().includes(key));
    summary.textContent = `共 ${allNotes.length} 条笔记${key ? ` · 找到 ${shown.length} 条` : ''}`;
    list.innerHTML = shown.length ? shown.map(note => `<a class="note-list-item" href="practice.html?q=${encodeURIComponent(note.questionId)}"><div class="note-list-meta"><span>${escapeHtml(note.source)}${note.group ? ` / ${escapeHtml(note.group)}` : ''} / ${escapeHtml(note.category)}</span><b>第 ${escapeHtml(note.number)} 题</b></div><h2>${escapeHtml(note.title)}</h2>${note.summary ? `<div class="note-summary-preview">${escapeHtml(note.summary)}</div>` : ''}<p>${escapeHtml(note.personal || note.ai || '已记录笔记')}</p><small>更新于 ${new Date(note.updatedAt).toLocaleString('zh-CN', { hour12: false })} · 点击回到题目</small></a>`).join('') : '<div class="empty">还没有笔记。刷题时在解析下方写下第一条吧。</div>';
  }
  async function load() { allNotes = await notes.all(); draw(); }
  let syncReloadTimer;
  // 同步模块在页面加载后把远端笔记合并进 IndexedDB；合并结束后重新读取列表。
  window.addEventListener('practice:notes-merged', () => {
    clearTimeout(syncReloadTimer);
    syncReloadTimer = setTimeout(load, 80);
  });
  document.querySelector('#exportJson').onclick = async () => {
    const value = await notes.all();
    download(fileName('.json'), JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), notes: value }, null, 2), 'application/json;charset=utf-8');
  };
  document.querySelector('#exportReadable').onclick = async () => {
    const value = await notes.all();
    const text = ['# InterviewAI 我的笔记', '', `导出时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`, ''];
    value.forEach(note => text.push(`## ${note.source}${note.group ? ' / ' + note.group : ''} / ${note.category} · 第 ${note.number} 题`, '', `**${note.title}**`, '', note.summary ? `> 复习结论：${note.summary}` : '', note.personal ? '### 我的理解\n\n' + note.personal : '', note.ai ? '### AI 辅助解析\n\n' + note.ai : '', ''));
    download(fileName('.md'), text.join('\n'), 'text/markdown;charset=utf-8');
  };
  document.querySelector('#importNotes').onchange = async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.notes)) throw new Error('格式不正确');
      if (!confirm(`将用备份中的 ${data.notes.length} 条笔记替换当前笔记，确认继续吗？`)) return;
      await notes.replaceAll(data.notes); await load(); alert('笔记已导入。');
    } catch (_) { alert('无法导入：请选择由 InterviewAI 导出的 JSON 备份文件。'); }
    event.target.value = '';
  };
  search.oninput = draw;
  load().catch(() => { summary.textContent = '笔记库暂时无法打开'; });
})();
