(() => {
  const bank = window.PRACTICE_BANK;
  const app = document.querySelector('#homeApp');
  if (!bank?.questions || !app) return;

  const escapeHtml = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&quot;').replace(/'/g, '&#039;');
  const readRecords = () => { try { const value = JSON.parse(localStorage.getItem('interview-ai-practice-records-v1') || '{}'); return value && typeof value === 'object' ? value : {}; } catch (_) { return {}; } };
  const catalog = (course, category = '') => `practice-catalog.html?${new URLSearchParams({ course, ...(category ? { category } : {}) }).toString()}`;
  const codeFillCategory = '代码填空与阅读';

  function render() {
    const records = readRecords();
    const completed = Object.values(records).filter(record => record?.status && record.status !== 'unmade').length;
    const latest = Object.entries(records)
      .map(([id, record]) => ({ question: bank.questions.find(item => item.id === id), record }))
      .filter(item => item.question && item.record?.updatedAt)
      .sort((a, b) => b.record.updatedAt - a.record.updatedAt)[0];
    const java = bank.courses.find(course => course.key === 'java');
    const codeCount = bank.questions.filter(question => question.source === 'Java' && question.category === codeFillCategory).length;
    const continueHref = latest ? `practice.html?q=${encodeURIComponent(latest.question.id)}` : 'practice-catalog.html';
    const continueTitle = latest ? `继续：${latest.question.title || latest.question.content}` : '从题库开始刷题';
    const continueDescription = latest ? `${latest.question.source} / ${latest.question.category} · 第 ${latest.question.number} 题` : '先选一个分类，再从任意题目开始。';

    app.innerHTML = `<section class="home-hero"><div class="home-kicker">个人刷题库 · 本地笔记 · 跨设备同步</div><h1>从今天要练的内容开始</h1><p>题库、代码填空和学习笔记都在这里；直接打开某一道题的链接也依然有效。</p><div class="home-hero-actions"><a class="primary home-primary" href="${continueHref}">${latest ? '继续上次刷题 →' : '浏览题库 →'}</a><a class="secondary home-secondary" href="${catalog('408')}">进入 408</a></div></section><section class="home-progress"><div><span>已收录</span><b>${bank.questions.length.toLocaleString()}</b><small>道题</small></div><div><span>本机已做</span><b>${completed}</b><small>道题</small></div><div><span>代码填空</span><b>${codeCount}</b><small>道训练题</small></div></section><section class="home-section"><div class="home-section-head"><div><h2>从这里继续</h2><p>${escapeHtml(continueDescription)}</p></div><a href="${continueHref}">打开 →</a></div><a class="resume-card" href="${continueHref}"><span class="resume-icon">↻</span><div><b>${escapeHtml(continueTitle)}</b><small>${escapeHtml(continueDescription)}</small></div><span class="resume-arrow">→</span></a></section><section class="home-section"><div class="home-section-head"><div><h2>选择一种练习</h2><p>题库按知识分类；代码题也可以单独集中练。</p></div></div><div class="home-grid"><a class="home-card" href="practice-catalog.html"><span class="home-card-icon">▦</span><h3>浏览全部题库</h3><p>Java、后端开发、数据库与 408，按知识点挑选题目。</p><em>进入题库 →</em></a><a class="home-card feature" href="${catalog(java?.key || 'java', codeFillCategory)}"><span class="home-card-icon">&lt;/&gt;</span><h3>代码填空与阅读</h3><p>带行号和正确缩进的 Java 代码，逐空作答并查看参考实现。</p><em>开始代码填空 →</em></a><a class="home-card" href="practice-notes.html"><span class="home-card-icon">✦</span><h3>我的学习笔记</h3><p>按题保存 Markdown 笔记，支持自己的理解和 AI 解析分开记录。</p><em>查看笔记 →</em></a><a class="home-card" href="practice-sync.html"><span class="home-card-icon">⇄</span><h3>跨设备同步</h3><p>用恢复密钥把做题记录与笔记带到手机或另一台电脑。</p><em>管理同步 →</em></a></div></section>`;
  }

  window.addEventListener('practice:records-merged', render);
  render();
})();
