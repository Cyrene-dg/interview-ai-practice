(() => {
  const bank = window.PRACTICE_BANK;
  if (!bank || !Array.isArray(bank.questions)) { document.body.innerHTML = '<p style="padding:30px">题库数据没有加载成功。</p>'; return; }
  // 做题进度不与题库版本绑定：以后新增题目时，旧题的本地记录仍然保留。
  const PAGE_SIZE = 20, NAV_SIZE = 30, storageKey = 'interview-ai-practice-records-v1', legacyStoragePrefix = 'interview-ai-practice-records-';
  let params = new URLSearchParams(location.search);
  const escapeHtml = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const lineBreaks = value => escapeHtml(value).replace(/\n/g, '<br>');
  const readJson = key => { try { const value = JSON.parse(localStorage.getItem(key) || '{}'); return value && typeof value === 'object' ? value : {}; } catch (_) { return {}; } };
  const readRecords = () => {
    const saved = readJson(storageKey);
    if (Object.keys(saved).length) return saved;
    // 兼容旧版“按题库版本分开保存”的进度；首次访问新版本时自动合并迁移。
    const migrated = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && key.startsWith(legacyStoragePrefix) && key !== storageKey) Object.assign(migrated, readJson(key));
    }
    if (Object.keys(migrated).length) localStorage.setItem(storageKey, JSON.stringify(migrated));
    return migrated;
  };
  const saveRecords = records => localStorage.setItem(storageKey, JSON.stringify(records));
  const statusText = record => !record ? '未做' : ({ correct:'答对', wrong:'答错', mastered:'已掌握', unmastered:'待复习' }[record.status] || '未做');
  const isChoice = q => Object.keys(q.options || {}).length > 0 && q.answerKeys?.length > 0;
  const courseByKey = key => bank.courses.find(course => course.key === key) || bank.courses[0];
  const categoryQuestions = (course, category, group = '') => bank.questions.filter(q => q.source === course.name && q.category === category && (!group || q.group === group));
  const courseQuestionCount = course => bank.questions.filter(question => question.source === course.name).length;
  const questionLabel = q => q.title || q.content || '未命名题目';
  const setUrl = next => { params = new URLSearchParams(next); history.replaceState({}, '', `${location.pathname}?${params.toString()}`); };
  document.querySelector('#totalCount')?.append(`已收录 ${bank.questions.length.toLocaleString()} 题`);

  function renderCatalog() {
    const course = courseByKey(params.get('course'));
    const hasGroups = Array.isArray(course.groups);
    const legacyGroup = hasGroups && course.groups.some(item => item.name === params.get('category')) ? params.get('category') : '';
    const group = hasGroups && course.groups.some(item => item.name === params.get('group') || item.name === legacyGroup) ? (params.get('group') || legacyGroup) : '';
    const leaves = hasGroups ? (course.groups.find(item => item.name === group)?.topics || []) : course.categories;
    const category = leaves.some(item => item.name === params.get('category')) ? params.get('category') : '';
    const records = readRecords(); let search = '', type = 'all', status = 'all', page = Math.max(1, Number(params.get('page')) || 1);
    const courseList = document.querySelector('#courseList'), categoryList = document.querySelector('#categoryList'), mobileCourseList = document.querySelector('#mobileCourseList'), mobileCategoryList = document.querySelector('#mobileCategoryList'), mobileDirectory = document.querySelector('#mobileDirectory'), typeFilter = document.querySelector('#typeFilter'), statusFilter = document.querySelector('#statusFilter'), questionList = document.querySelector('#questionList'), pager = document.querySelector('#pager');
    const selectedQuestions = category ? categoryQuestions(course, category, group) : [], types = [...new Set(selectedQuestions.map(q => q.type))];
    const courseButtons = bank.courses.map(item => `<button class="side-button ${item.key === course.key ? 'active' : ''}" data-course="${escapeHtml(item.key)}"><span>${escapeHtml(item.name)}</span><em>${courseQuestionCount(item)}</em></button>`).join('');
    const categoryButtons = hasGroups
      ? course.groups.map(item => {
        const open = item.name === group;
        const topics = item.topics.map(topic => `<button class="side-button category directory-leaf ${open && topic.name === category ? 'active' : ''}" data-leaf-group="${escapeHtml(item.name)}" data-category="${escapeHtml(topic.name)}" type="button"><span>${escapeHtml(topic.name)}</span><em>${topic.count}</em></button>`).join('');
        return `<section class="directory-group"><button class="directory-parent ${open ? 'active expanded' : ''}" data-group="${escapeHtml(item.name)}" type="button"><span>${escapeHtml(item.name)}</span><em>${item.count}</em><b aria-hidden="true">⌄</b></button><div class="directory-children" data-group-children="${escapeHtml(item.name)}" ${open ? '' : 'hidden'}>${topics}</div></section>`;
      }).join('')
      : course.categories.map(item => `<button class="side-button category ${item.name === category ? 'active' : ''}" data-category="${escapeHtml(item.name)}" type="button"><span>${escapeHtml(item.name)}</span><em>${item.count}</em></button>`).join('');
    courseList.innerHTML = courseButtons; categoryList.innerHTML = categoryButtons; mobileCourseList.innerHTML = courseButtons; mobileCategoryList.innerHTML = categoryButtons;
    typeFilter.innerHTML = `<option value="all">全部题型</option>${types.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('')}`;
    document.querySelector('#crumb').innerHTML = `<span>${escapeHtml(course.name)}</span>${group ? `<i>/</i><span>${escapeHtml(group)}</span>` : ''}${category ? `<i>/</i><span>${escapeHtml(category)}</span>` : ''}`;
    document.querySelector('#catalogTitle').textContent = category ? `${category} 题库` : `${course.name} 题库`;
    const categoryRecords = selectedQuestions.map(q => records[q.id]).filter(Boolean), count = name => categoryRecords.filter(r => r.status === name).length;
    document.querySelector('#catalogSummary').textContent = category ? `${selectedQuestions.length} 道题 · 点击任意题目直接刷题` : (hasGroups ? '请选择一门课程下的知识点开始刷题' : '请选择一个分类开始刷题');
    document.querySelector('#progressSummary').innerHTML = `<span>已做 <b>${categoryRecords.length}</b></span><span class="green">答对 <b>${count('correct')}</b></span><span class="red">待复习 <b>${count('wrong') + count('unmastered')}</b></span>`;
    const filtered = () => { const keyword = search.trim().toLowerCase(); return selectedQuestions.filter(q => { const record = records[q.id]; return (!keyword || `${q.title}\n${q.content}`.toLowerCase().includes(keyword)) && (type === 'all' || q.type === type) && (status === 'all' || (status === 'unmade' && !record) || record?.status === status); }); };
    function drawList() {
      const rows = filtered(), totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE)); page = Math.min(page, totalPages); const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
      questionList.innerHTML = !category ? '<div class="empty">从左侧目录点到最末级知识点，即可查看题目。</div>' : shown.length ? shown.map(q => { const record = records[q.id], recordClass = record?.status || 'unmade'; return `<a class="question-row" href="practice.html?q=${encodeURIComponent(q.id)}"><span class="question-number">${escapeHtml(q.number)}</span><span class="question-name">${escapeHtml(questionLabel(q))}</span><span class="question-type">${escapeHtml(q.type)}</span><span class="question-status ${recordClass}">${statusText(record)}</span></a>`; }).join('') : '<div class="empty">没有找到符合条件的题目</div>';
      const first = Math.max(1, page - 2), last = Math.min(totalPages, first + 4);
      pager.innerHTML = `<span>共 ${rows.length} 题，第 ${page} / ${totalPages} 页</span><button data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>上一页</button>${Array.from({length:last-first+1},(_,i)=>first+i).map(n=>`<button class="${n === page ? 'current' : ''}" data-page="${n}">${n}</button>`).join('')}<button data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''}>下一页</button>`;
      pager.querySelectorAll('button[data-page]').forEach(button => button.onclick = () => { page = Number(button.dataset.page); drawList(); window.scrollTo({top:0,behavior:'smooth'}); });
    }
    document.querySelector('.filters').hidden = !category; document.querySelector('.question-table-head').hidden = !category;
    [courseList, mobileCourseList].forEach(list => list.querySelectorAll('[data-course]').forEach(button => button.onclick = () => { setUrl({course:button.dataset.course,page:1}); renderCatalog(); window.scrollTo({top:0,behavior:'smooth'}); }));
    [categoryList, mobileCategoryList].forEach(list => {
      list.querySelectorAll('[data-group]').forEach(button => button.onclick = () => { const children = list.querySelector(`[data-group-children="${CSS.escape(button.dataset.group)}"]`); const expanded = children.hidden; children.hidden = !expanded; button.classList.toggle('expanded', expanded); });
      list.querySelectorAll('[data-category]').forEach(button => button.onclick = () => { const next = {course:course.key,category:button.dataset.category,page:1}; if (button.dataset.leafGroup) next.group = button.dataset.leafGroup; setUrl(next); mobileDirectory.hidden = true; document.body.classList.remove('drawer-open'); renderCatalog(); window.scrollTo({top:0,behavior:'smooth'}); });
    });
    document.querySelector('#openMobileDirectory').onclick = () => { mobileDirectory.hidden = false; document.body.classList.add('drawer-open'); };
    document.querySelector('#closeMobileDirectory').onclick = () => { mobileDirectory.hidden = true; document.body.classList.remove('drawer-open'); };
    mobileDirectory.onclick = event => { if (event.target === mobileDirectory) { mobileDirectory.hidden = true; document.body.classList.remove('drawer-open'); } };
    document.querySelector('#searchInput').oninput = event => { search = event.target.value; page = 1; drawList(); };
    typeFilter.onchange = event => { type = event.target.value; page = 1; drawList(); }; statusFilter.onchange = event => { status = event.target.value; page = 1; drawList(); }; drawList();
  }

  function renderPractice() {
    const question = bank.questions.find(item => item.id === params.get('q')) || bank.questions[0], course = bank.courses.find(item => item.name === question.source), siblings = categoryQuestions(course, question.category, question.group);
    const currentIndex = siblings.findIndex(item => item.id === question.id); let navPage = Math.floor(currentIndex / NAV_SIZE), selected = [], revealed = false;
    const app = document.querySelector('#practiceApp'), navs = [document.querySelector('#practiceNav'), document.querySelector('#mobilePracticeNav')].filter(Boolean);
    let noteSaveTimer;
    document.querySelector('#backToCatalog').href = `practice-catalog.html?${new URLSearchParams({course:course.key, ...(question.group ? {group:question.group} : {}), category:question.category}).toString()}`;
    const go = nextQuestion => { location.href = `practice.html?q=${encodeURIComponent(nextQuestion.id)}`; };
    const sameKeys = (one, other) => one.length === other.length && one.every(key => other.includes(key));
    const recordFor = () => readRecords()[question.id];
    const store = (state, answer = '') => { const records = readRecords(); records[question.id] = {status:state,answer,updatedAt:Date.now()}; saveRecords(records); window.PRACTICE_SYNC?.notifyRecord?.(question.id, records[question.id]); };
    function drawNav() {
      const records = readRecords(), navStart = navPage * NAV_SIZE, visible = siblings.slice(navStart, navStart + NAV_SIZE);
      const markup = `<div class="nav-top"><span class="tag">${escapeHtml(question.source)}${question.group ? ` / ${escapeHtml(question.group)}` : ''} / ${escapeHtml(question.category)}</span><h3>题号导航</h3><p>第 ${currentIndex + 1} / ${siblings.length} 题</p><form class="jump-form"><input inputmode="numeric" placeholder="题号"><button>跳转</button></form></div><div class="nav-grid">${visible.map(item => {const state=records[item.id]?.status||'';return `<button class="nav-item ${item.id === question.id ? 'current' : ''} ${state}" data-id="${escapeHtml(item.id)}">${escapeHtml(item.number)}</button>`;}).join('')}</div><div class="nav-pages"><button class="nav-previous" ${navPage === 0 ? 'disabled' : ''}>‹</button><span>${navPage + 1} / ${Math.ceil(siblings.length / NAV_SIZE)}</span><button class="nav-next" ${navStart + NAV_SIZE >= siblings.length ? 'disabled' : ''}>›</button></div>`;
      navs.forEach(nav => {
        nav.innerHTML = markup;
        nav.querySelectorAll('[data-id]').forEach(button => button.onclick = () => go(siblings.find(item => item.id === button.dataset.id)));
        nav.querySelector('.nav-previous').onclick = () => { navPage -= 1; drawNav(); };
        nav.querySelector('.nav-next').onclick = () => { navPage += 1; drawNav(); };
        nav.querySelector('.jump-form').onsubmit = event => { event.preventDefault(); const input = event.currentTarget.querySelector('input'), wanted = input.value.trim(), target = siblings.find(item => String(item.number) === wanted || String(item.order) === wanted); if (target) go(target); else { input.setCustomValidity('当前分类没有这道题'); input.reportValidity(); } };
      });
    }
    const showAnswer = record => `<section class="answer-box ${record?.status || ''}"><div class="answer-title">${record?.status === 'correct' ? '回答正确' : record?.status === 'wrong' ? '回答不正确' : '参考答案与解析'}</div><div class="answer-line"><b>参考答案：</b>${lineBreaks(question.answer || '题库没有提供参考答案。')}</div><div class="analysis"><b>完整解析</b><p>${lineBreaks(question.analysis || '题库没有提供解析。')}</p></div></section>`;
    function attachNoteEditor() {
      const noteArea = app.querySelector('#noteArea');
      if (!noteArea) return;
      if (!window.PRACTICE_NOTES || !window.PRACTICE_MARKDOWN) { noteArea.textContent = '当前浏览器无法打开本地 Markdown 笔记。'; return; }
      noteArea.innerHTML = `<section class="study-note"><header class="study-note-head"><div><span class="study-note-kicker">✦ 学习笔记</span><small>仅保存在这台设备的当前浏览器</small></div><span id="noteState" class="note-state">正在读取…</span></header><label class="summary-editor"><span>一句话复习结论</span><input id="noteSummary" maxlength="500" placeholder="例如：组件扫描通过 @Component 及其派生注解发现 Bean。"></label><div class="note-tabs" role="tablist"><button class="note-tab active" data-note-tab="personal" type="button">🧠 我的理解</button><button class="note-tab" data-note-tab="ai" type="button">✨ AI 辅助解析</button></div><div class="markdown-note-editor"><div class="markdown-toolbar"><span id="noteHint">写下自己的理解、易错点和复习思路</span><div><button class="mode-button active" data-note-mode="edit" type="button">编辑</button><button class="mode-button" data-note-mode="preview" type="button">预览</button></div></div><textarea id="questionNote" maxlength="20000" placeholder="支持 Markdown：# 标题、**加粗**、列表、表格、代码块、链接和图片链接。"></textarea><article id="notePreview" class="markdown-preview" hidden></article><footer class="note-editor-foot"><span><b id="noteCount">0 / 20000</b></span><button id="exportSingleNote" type="button" class="text-button">导出本题 Markdown</button></footer></div></section>`;
      const summary = noteArea.querySelector('#noteSummary'), textarea = noteArea.querySelector('#questionNote'), state = noteArea.querySelector('#noteState'), counter = noteArea.querySelector('#noteCount'), preview = noteArea.querySelector('#notePreview'), hint = noteArea.querySelector('#noteHint');
      let activeTab = 'personal', activeMode = 'edit', draft = { summary: '', personal: '', ai: '' };
      const labels = { personal: '写下自己的理解、易错点和复习思路', ai: '粘贴 AI 给出的 Markdown 解析；表格和代码会在预览中呈现' };
      const updateCount = () => { counter.textContent = `${textarea.value.length} / 20000`; };
      const switchView = () => {
        textarea.hidden = activeMode !== 'edit'; preview.hidden = activeMode !== 'preview';
        if (activeMode === 'preview') preview.innerHTML = window.PRACTICE_MARKDOWN.render(textarea.value) || '<p class="markdown-empty">还没有内容可预览。</p>';
        noteArea.querySelectorAll('[data-note-mode]').forEach(button => button.classList.toggle('active', button.dataset.noteMode === activeMode));
      };
      const switchTab = tab => {
        draft[activeTab] = textarea.value; activeTab = tab; textarea.value = draft[activeTab] || ''; hint.textContent = labels[tab]; updateCount(); switchView();
        noteArea.querySelectorAll('[data-note-tab]').forEach(button => button.classList.toggle('active', button.dataset.noteTab === tab));
      };
      const save = () => {
        draft.summary = summary.value; draft[activeTab] = textarea.value; clearTimeout(noteSaveTimer); state.textContent = '正在保存…';
        noteSaveTimer = setTimeout(() => window.PRACTICE_NOTES.put(question, draft).then(() => { state.textContent = (draft.summary || draft.personal || draft.ai) ? '已自动保存' : '笔记已清空'; }).catch(() => { state.textContent = '保存失败，请稍后重试'; }), 450);
      };
      textarea.oninput = () => { updateCount(); if (activeMode === 'preview') switchView(); save(); };
      textarea.onblur = save; summary.oninput = save; summary.onblur = save;
      noteArea.querySelectorAll('[data-note-tab]').forEach(button => button.onclick = () => switchTab(button.dataset.noteTab));
      noteArea.querySelectorAll('[data-note-mode]').forEach(button => button.onclick = () => { activeMode = button.dataset.noteMode; switchView(); });
      noteArea.querySelector('#exportSingleNote').onclick = async () => {
        draft.summary = summary.value; draft[activeTab] = textarea.value; const note = await window.PRACTICE_NOTES.get(question.id); const finalNote = { ...note, ...draft };
        if (!finalNote.summary && !finalNote.personal && !finalNote.ai) { alert('本题还没有笔记可以导出。'); return; }
        const markdown = [`# ${question.source}${question.group ? ' / ' + question.group : ''} / ${question.category} · 第 ${question.number} 题`, '', `## ${question.title || question.content}`, '', finalNote.summary ? `> 复习结论：${finalNote.summary}` : '', finalNote.personal ? '## 我的理解\n\n' + finalNote.personal : '', finalNote.ai ? '## AI 辅助解析\n\n' + finalNote.ai : ''].filter(Boolean).join('\n\n') + '\n';
        const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' })), link = document.createElement('a');
        link.href = url; link.download = `InterviewAI-第${question.number}题笔记.md`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 500);
      };
      window.PRACTICE_NOTES.get(question.id).then(note => {
        if (app.querySelector('#noteArea') !== noteArea) return;
        draft = note; summary.value = draft.summary || ''; textarea.value = draft.personal || ''; updateCount(); state.textContent = (draft.summary || draft.personal || draft.ai) ? '已自动保存' : '尚未填写';
      }).catch(() => { state.textContent = '笔记库无法打开'; });
    }
    function drawQuestion() {
      const record = recordFor(), choice = isChoice(question), formattedCode = window.PRACTICE_CODE_FORMAT?.format?.(question, escapeHtml), normalizedTitle = String(question.title || '').replace(/\s/g, ''), normalizedContent = String(question.content || '').replace(/\s/g, ''), title = !formattedCode && normalizedTitle && normalizedTitle !== normalizedContent ? `<div class="question-caption">${escapeHtml(question.title)}</div>` : '', displayContent = formattedCode ? formattedCode.prompt : question.content, previous = siblings[currentIndex-1], next = siblings[currentIndex+1];
      const options = choice ? `<div class="options">${Object.entries(question.options).map(([key,value])=>`<button class="option ${selected.includes(key) ? 'selected' : ''}" data-option="${key}"><span>${key}</span><div>${lineBreaks(value)}</div></button>`).join('')}</div>` : `<div class="subjective-box"><label for="selfAnswer">先自己作答（内容只保存在这台设备）</label><textarea id="selfAnswer" placeholder="可以写下你的思路，或先在纸上作答后再查看参考答案。">${escapeHtml(record?.draft || '')}</textarea></div>`;
      const mainAction = choice ? `<button id="submitQuestion" class="primary" ${selected.length ? '' : 'disabled'}>${revealed ? '下一题' : '提交答案'}</button>` : (revealed ? '<button id="markMastered" class="secondary">我掌握了</button><button id="markUnmastered" class="primary">加入待复习</button>' : '<button id="revealAnswer" class="primary">查看参考答案与解析</button>');
      app.innerHTML = `<div class="question-head"><div class="crumb"><a href="${document.querySelector('#backToCatalog').href}">题库目录</a><i>/</i><span>${escapeHtml(question.source)}</span>${question.group ? `<i>/</i><span>${escapeHtml(question.group)}</span>` : ''}<i>/</i><span>${escapeHtml(question.category)}</span></div><div class="question-badges"><span class="tag">第 ${escapeHtml(question.number)} 题</span><span class="plain-tag">${escapeHtml(question.type)}</span></div>${title}<h1>${lineBreaks(displayContent)}</h1>${formattedCode?.html || ''}</div>${options}<div id="answerArea">${revealed ? showAnswer(record) : ''}</div><div class="practice-actions"><button id="previousQuestion" class="secondary" ${previous ? '' : 'disabled'}>上一题</button><div>${mainAction}</div><button id="nextQuestion" class="secondary" ${next ? '' : 'disabled'}>下一题</button></div><div id="noteArea"></div>`;
      app.querySelectorAll('[data-option]').forEach(button => button.onclick = () => { if(revealed)return; const key=button.dataset.option, multiple=question.answerKeys.length>1||question.type.includes('多选'); selected=multiple?(selected.includes(key)?selected.filter(item=>item!==key):[...selected,key]):[key]; drawQuestion(); });
      app.querySelectorAll('.copy-code').forEach(button => button.onclick = async () => {
        const text = button.closest('.code-card').querySelector('.code-lines').innerText;
        try { await navigator.clipboard.writeText(text); button.textContent = '已复制'; } catch (_) { button.textContent = '复制失败'; }
        setTimeout(() => { button.textContent = '复制代码'; }, 1300);
      });
      app.querySelector('#previousQuestion').onclick = () => previous && go(previous); app.querySelector('#nextQuestion').onclick = () => next && go(next);
      if(choice){app.querySelector('#submitQuestion').onclick=()=>{if(revealed){if(next)go(next);return;}const correct=sameKeys(selected,question.answerKeys);store(correct?'correct':'wrong',selected.join(','));revealed=true;drawNav();drawQuestion();};}
      else if(!revealed){app.querySelector('#revealAnswer').onclick=()=>{const draft=app.querySelector('#selfAnswer').value,records=readRecords();records[question.id]={...(records[question.id]||{}),draft,status:records[question.id]?.status||'unmastered',updatedAt:Date.now()};saveRecords(records);window.PRACTICE_SYNC?.notifyRecord?.(question.id, records[question.id]);revealed=true;drawNav();drawQuestion();};}
      else{app.querySelector('#markMastered').onclick=()=>{store('mastered',record?.draft||'');drawNav();drawQuestion();};app.querySelector('#markUnmastered').onclick=()=>{store('unmastered',record?.draft||'');drawNav();drawQuestion();};}
      attachNoteEditor();
    }
    const drawer = document.querySelector('#questionNavDrawer');
    document.querySelector('#openQuestionNav').onclick = () => { drawer.hidden = false; document.body.classList.add('drawer-open'); };
    document.querySelector('#closeQuestionNav').onclick = () => { drawer.hidden = true; document.body.classList.remove('drawer-open'); };
    drawer.onclick = event => { if (event.target === drawer) { drawer.hidden = true; document.body.classList.remove('drawer-open'); } };
    window.addEventListener('practice:records-merged', () => { drawNav(); drawQuestion(); });
    window.addEventListener('practice:notes-merged', event => { if (event.detail?.questionId === question.id) drawQuestion(); });
    drawNav(); drawQuestion();
  }
  if(document.body.dataset.page === 'catalog') renderCatalog(); if(document.body.dataset.page === 'practice') renderPractice();
})();
