(() => {
  const bank = window.PRACTICE_BANK;
  if (!bank || !Array.isArray(bank.questions)) { document.body.innerHTML = '<p style="padding:30px">题库数据没有加载成功。</p>'; return; }
  // 做题进度不与题库版本绑定：以后新增题目时，旧题的本地记录仍然保留。
  const PAGE_SIZE = 20, NAV_SIZE = 30, storageKey = 'interview-ai-practice-records-v1', legacyStoragePrefix = 'interview-ai-practice-records-';
  const params = new URLSearchParams(location.search);
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
  const categoryQuestions = (course, category) => bank.questions.filter(q => q.source === course.name && q.category === category);
  const questionLabel = q => q.title || q.content || '未命名题目';
  const setUrl = next => history.replaceState({}, '', `${location.pathname}?${new URLSearchParams(next).toString()}`);
  document.querySelector('#totalCount')?.append(`已收录 ${bank.questions.length.toLocaleString()} 题`);

  function renderCatalog() {
    const course = courseByKey(params.get('course'));
    const category = course.categories.some(item => item.name === params.get('category')) ? params.get('category') : course.categories[0]?.name;
    const records = readRecords(); let search = '', type = 'all', status = 'all', page = Math.max(1, Number(params.get('page')) || 1);
    const courseList = document.querySelector('#courseList'), categoryList = document.querySelector('#categoryList'), mobileCourseList = document.querySelector('#mobileCourseList'), mobileCategoryList = document.querySelector('#mobileCategoryList'), mobileDirectory = document.querySelector('#mobileDirectory'), typeFilter = document.querySelector('#typeFilter'), statusFilter = document.querySelector('#statusFilter'), questionList = document.querySelector('#questionList'), pager = document.querySelector('#pager');
    const selectedQuestions = categoryQuestions(course, category), types = [...new Set(selectedQuestions.map(q => q.type))];
    const courseButtons = bank.courses.map(item => `<button class="side-button ${item.key === course.key ? 'active' : ''}" data-course="${escapeHtml(item.key)}"><span>${escapeHtml(item.name)}</span><em>${item.categories.reduce((sum, c) => sum + c.count, 0)}</em></button>`).join('');
    const categoryButtons = course.categories.map(item => `<button class="side-button category ${item.name === category ? 'active' : ''}" data-category="${escapeHtml(item.name)}"><span>${escapeHtml(item.name)}</span><em>${item.count}</em></button>`).join('');
    courseList.innerHTML = courseButtons; categoryList.innerHTML = categoryButtons; mobileCourseList.innerHTML = courseButtons; mobileCategoryList.innerHTML = categoryButtons;
    typeFilter.innerHTML = `<option value="all">全部题型</option>${types.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('')}`;
    document.querySelector('#crumb').innerHTML = `<span>${escapeHtml(course.name)}</span><i>/</i><span>${escapeHtml(category)}</span>`;
    document.querySelector('#catalogTitle').textContent = `${category} 题库`;
    const categoryRecords = selectedQuestions.map(q => records[q.id]).filter(Boolean), count = name => categoryRecords.filter(r => r.status === name).length;
    document.querySelector('#catalogSummary').textContent = `${selectedQuestions.length} 道题 · 点击任意题目直接刷题`;
    document.querySelector('#progressSummary').innerHTML = `<span>已做 <b>${categoryRecords.length}</b></span><span class="green">答对 <b>${count('correct')}</b></span><span class="red">待复习 <b>${count('wrong') + count('unmastered')}</b></span>`;
    const filtered = () => { const keyword = search.trim().toLowerCase(); return selectedQuestions.filter(q => { const record = records[q.id]; return (!keyword || `${q.title}\n${q.content}`.toLowerCase().includes(keyword)) && (type === 'all' || q.type === type) && (status === 'all' || (status === 'unmade' && !record) || record?.status === status); }); };
    function drawList() {
      const rows = filtered(), totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE)); page = Math.min(page, totalPages); const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
      questionList.innerHTML = shown.length ? shown.map(q => { const record = records[q.id], recordClass = record?.status || 'unmade'; return `<a class="question-row" href="practice.html?q=${encodeURIComponent(q.id)}"><span class="question-number">${escapeHtml(q.number)}</span><span class="question-name">${escapeHtml(questionLabel(q))}</span><span class="question-type">${escapeHtml(q.type)}</span><span class="question-status ${recordClass}">${statusText(record)}</span></a>`; }).join('') : '<div class="empty">没有找到符合条件的题目</div>';
      const first = Math.max(1, page - 2), last = Math.min(totalPages, first + 4);
      pager.innerHTML = `<span>共 ${rows.length} 题，第 ${page} / ${totalPages} 页</span><button data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>上一页</button>${Array.from({length:last-first+1},(_,i)=>first+i).map(n=>`<button class="${n === page ? 'current' : ''}" data-page="${n}">${n}</button>`).join('')}<button data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''}>下一页</button>`;
      pager.querySelectorAll('button[data-page]').forEach(button => button.onclick = () => { page = Number(button.dataset.page); drawList(); window.scrollTo({top:0,behavior:'smooth'}); });
    }
    [courseList, mobileCourseList].forEach(list => list.querySelectorAll('[data-course]').forEach(button => button.onclick = () => { const nextCourse = courseByKey(button.dataset.course); setUrl({course:nextCourse.key,category:nextCourse.categories[0]?.name || '',page:1}); location.reload(); }));
    [categoryList, mobileCategoryList].forEach(list => list.querySelectorAll('[data-category]').forEach(button => button.onclick = () => { setUrl({course:course.key,category:button.dataset.category,page:1}); location.reload(); }));
    document.querySelector('#openMobileDirectory').onclick = () => { mobileDirectory.hidden = false; document.body.classList.add('drawer-open'); };
    document.querySelector('#closeMobileDirectory').onclick = () => { mobileDirectory.hidden = true; document.body.classList.remove('drawer-open'); };
    mobileDirectory.onclick = event => { if (event.target === mobileDirectory) { mobileDirectory.hidden = true; document.body.classList.remove('drawer-open'); } };
    document.querySelector('#searchInput').oninput = event => { search = event.target.value; page = 1; drawList(); };
    typeFilter.onchange = event => { type = event.target.value; page = 1; drawList(); }; statusFilter.onchange = event => { status = event.target.value; page = 1; drawList(); }; drawList();
  }

  function renderPractice() {
    const question = bank.questions.find(item => item.id === params.get('q')) || bank.questions[0], course = bank.courses.find(item => item.name === question.source), siblings = categoryQuestions(course, question.category);
    const currentIndex = siblings.findIndex(item => item.id === question.id); let navPage = Math.floor(currentIndex / NAV_SIZE), selected = [], revealed = false;
    const app = document.querySelector('#practiceApp'), nav = document.querySelector('#practiceNav');
    document.querySelector('#backToCatalog').href = `practice-catalog.html?${new URLSearchParams({course:course.key,category:question.category}).toString()}`;
    const go = nextQuestion => { location.href = `practice.html?q=${encodeURIComponent(nextQuestion.id)}`; };
    const sameKeys = (one, other) => one.length === other.length && one.every(key => other.includes(key));
    const recordFor = () => readRecords()[question.id];
    const store = (state, answer = '') => { const records = readRecords(); records[question.id] = {status:state,answer,updatedAt:Date.now()}; saveRecords(records); };
    function drawNav() {
      const records = readRecords(), navStart = navPage * NAV_SIZE, visible = siblings.slice(navStart, navStart + NAV_SIZE);
      nav.innerHTML = `<div class="nav-top"><span class="tag">${escapeHtml(question.source)} / ${escapeHtml(question.category)}</span><h3>题号导航</h3><p>第 ${currentIndex + 1} / ${siblings.length} 题</p><form id="jumpForm" class="jump-form"><input id="jumpInput" inputmode="numeric" placeholder="题号"><button>跳转</button></form></div><div class="nav-grid">${visible.map(item => {const state=records[item.id]?.status||'';return `<button class="nav-item ${item.id === question.id ? 'current' : ''} ${state}" data-id="${escapeHtml(item.id)}">${escapeHtml(item.number)}</button>`;}).join('')}</div><div class="nav-pages"><button id="navPrevious" ${navPage === 0 ? 'disabled' : ''}>‹</button><span>${navPage + 1} / ${Math.ceil(siblings.length / NAV_SIZE)}</span><button id="navNext" ${navStart + NAV_SIZE >= siblings.length ? 'disabled' : ''}>›</button></div>`;
      nav.querySelectorAll('[data-id]').forEach(button => button.onclick = () => go(siblings.find(item => item.id === button.dataset.id)));
      nav.querySelector('#navPrevious').onclick = () => { navPage -= 1; drawNav(); }; nav.querySelector('#navNext').onclick = () => { navPage += 1; drawNav(); };
      nav.querySelector('#jumpForm').onsubmit = event => { event.preventDefault(); const wanted = nav.querySelector('#jumpInput').value.trim(), target = siblings.find(item => String(item.number) === wanted || String(item.order) === wanted); if (target) go(target); else nav.querySelector('#jumpInput').setCustomValidity('当前分类没有这道题'); };
    }
    const showAnswer = record => `<section class="answer-box ${record?.status || ''}"><div class="answer-title">${record?.status === 'correct' ? '回答正确' : record?.status === 'wrong' ? '回答不正确' : '参考答案与解析'}</div><div class="answer-line"><b>参考答案：</b>${lineBreaks(question.answer || '题库没有提供参考答案。')}</div><div class="analysis"><b>完整解析</b><p>${lineBreaks(question.analysis || '题库没有提供解析。')}</p></div></section>`;
    function drawQuestion() {
      const record = recordFor(), choice = isChoice(question), normalizedTitle = String(question.title || '').replace(/\s/g, ''), normalizedContent = String(question.content || '').replace(/\s/g, ''), title = normalizedTitle && normalizedTitle !== normalizedContent ? `<div class="question-caption">${escapeHtml(question.title)}</div>` : '', previous = siblings[currentIndex-1], next = siblings[currentIndex+1];
      const options = choice ? `<div class="options">${Object.entries(question.options).map(([key,value])=>`<button class="option ${selected.includes(key) ? 'selected' : ''}" data-option="${key}"><span>${key}</span><div>${lineBreaks(value)}</div></button>`).join('')}</div>` : `<div class="subjective-box"><label for="selfAnswer">先自己作答（内容只保存在这台设备）</label><textarea id="selfAnswer" placeholder="可以写下你的思路，或先在纸上作答后再查看参考答案。">${escapeHtml(record?.draft || '')}</textarea></div>`;
      const mainAction = choice ? `<button id="submitQuestion" class="primary" ${selected.length ? '' : 'disabled'}>${revealed ? '下一题' : '提交答案'}</button>` : (revealed ? '<button id="markMastered" class="secondary">我掌握了</button><button id="markUnmastered" class="primary">加入待复习</button>' : '<button id="revealAnswer" class="primary">查看参考答案与解析</button>');
      app.innerHTML = `<div class="question-head"><div class="crumb"><a href="${document.querySelector('#backToCatalog').href}">题库目录</a><i>/</i><span>${escapeHtml(question.source)}</span><i>/</i><span>${escapeHtml(question.category)}</span></div><div class="question-badges"><span class="tag">第 ${escapeHtml(question.number)} 题</span><span class="plain-tag">${escapeHtml(question.type)}</span></div>${title}<h1>${lineBreaks(question.content)}</h1></div>${options}<div id="answerArea">${revealed ? showAnswer(record) : ''}</div><div class="practice-actions"><button id="previousQuestion" class="secondary" ${previous ? '' : 'disabled'}>上一题</button><div>${mainAction}</div><button id="nextQuestion" class="secondary" ${next ? '' : 'disabled'}>下一题</button></div>`;
      app.querySelectorAll('[data-option]').forEach(button => button.onclick = () => { if(revealed)return; const key=button.dataset.option, multiple=question.answerKeys.length>1||question.type.includes('多选'); selected=multiple?(selected.includes(key)?selected.filter(item=>item!==key):[...selected,key]):[key]; drawQuestion(); });
      app.querySelector('#previousQuestion').onclick = () => previous && go(previous); app.querySelector('#nextQuestion').onclick = () => next && go(next);
      if(choice){app.querySelector('#submitQuestion').onclick=()=>{if(revealed){if(next)go(next);return;}const correct=sameKeys(selected,question.answerKeys);store(correct?'correct':'wrong',selected.join(','));revealed=true;drawNav();drawQuestion();};}
      else if(!revealed){app.querySelector('#revealAnswer').onclick=()=>{const draft=app.querySelector('#selfAnswer').value,records=readRecords();records[question.id]={...(records[question.id]||{}),draft,status:records[question.id]?.status||'unmastered',updatedAt:Date.now()};saveRecords(records);revealed=true;drawNav();drawQuestion();};}
      else{app.querySelector('#markMastered').onclick=()=>{store('mastered',record?.draft||'');drawNav();drawQuestion();};app.querySelector('#markUnmastered').onclick=()=>{store('unmastered',record?.draft||'');drawNav();drawQuestion();};}
    }
    drawNav(); drawQuestion();
  }
  if(document.body.dataset.page === 'catalog') renderCatalog(); if(document.body.dataset.page === 'practice') renderPractice();
})();
