const waitForSync = () => window.PRACTICE_SYNC ? Promise.resolve(window.PRACTICE_SYNC) : new Promise(resolve => window.addEventListener('practice:sync-ready', () => resolve(window.PRACTICE_SYNC), { once: true }));

const copyText = async value => {
  try { await navigator.clipboard.writeText(value); return true; } catch (_) {
    const area = document.createElement('textarea'); area.value = value; document.body.append(area); area.select(); const copied = document.execCommand('copy'); area.remove(); return copied;
  }
};

const download = (name, content) => {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 600);
};

const renderQr = url => {
  const node = document.querySelector('#pairQr');
  node.innerHTML = '';
  if (window.QRCode) new window.QRCode(node, { text: url, width: 174, height: 174, correctLevel: window.QRCode.CorrectLevel.M });
  else node.textContent = '二维码组件未加载，请使用恢复密钥连接。';
};

const setBusy = (button, busy, text) => { button.disabled = busy; if (text) button.textContent = text; };

const cleanFragment = () => history.replaceState({}, '', `${location.pathname}${location.search}`);

const ready = async () => {
  const sync = await waitForSync();
  const disabled = document.querySelector('#syncDisabled'), connecting = document.querySelector('#syncConnecting'), enabled = document.querySelector('#syncEnabled'), join = document.querySelector('#joinPanel');
  const statusText = document.querySelector('#syncStatusText'), badge = document.querySelector('#syncBadge'), pairPanel = document.querySelector('#pairingPanel'), recoveryKey = document.querySelector('#recoveryKey');
  let incomingSecret = new URLSearchParams(location.hash.slice(1)).get('sync');
  if (incomingSecret) { document.querySelector('#joinRecoveryKey').value = incomingSecret; join.hidden = false; cleanFragment(); }

  const display = state => {
    const active = state.enabled;
    disabled.hidden = active || Boolean(incomingSecret);
    connecting.hidden = active || Boolean(incomingSecret);
    enabled.hidden = !active;
    if (!active) return;
    recoveryKey.value = state.secret || '';
    if (state.error) { statusText.textContent = state.error; badge.textContent = '稍后重试'; badge.className = 'sync-badge warning'; }
    else if (state.ready) { statusText.textContent = '本机已连接；后续答题和笔记会自动上传。'; badge.textContent = '已连接'; badge.className = 'sync-badge success'; }
    else { statusText.textContent = '正在连接云端…'; badge.textContent = '连接中'; badge.className = 'sync-badge'; }
  };
  display(sync.getStatus());
  window.addEventListener('practice:sync-status', event => display({ ...sync.getStatus(), ...event.detail }));

  document.querySelector('#createSync').onclick = async event => {
    const button = event.currentTarget; setBusy(button, true, '正在生成恢复密钥…'); connecting.hidden = false; disabled.hidden = true;
    try { await sync.createNew(); pairPanel.hidden = false; renderQr(sync.getPairUrl()); display(sync.getStatus()); }
    catch (error) { alert(`暂时无法开启同步：${error.message || error}`); disabled.hidden = false; connecting.hidden = true; }
    finally { setBusy(button, false, '开启新的跨设备同步'); }
  };
  document.querySelector('#joinSync').onclick = async event => {
    const button = event.currentTarget, secret = document.querySelector('#joinRecoveryKey').value.trim(); setBusy(button, true, '正在接入…');
    try { await sync.connect(secret); incomingSecret = ''; join.hidden = true; pairPanel.hidden = false; renderQr(sync.getPairUrl()); display(sync.getStatus()); }
    catch (error) { alert(`无法接入：${error.message || error}`); }
    finally { setBusy(button, false, '接入此同步库'); }
  };
  document.querySelector('#cancelJoin').onclick = () => { incomingSecret = ''; join.hidden = true; disabled.hidden = false; };
  document.querySelector('#syncNow').onclick = async event => { const button = event.currentTarget; setBusy(button, true, '同步中…'); try { await sync.syncNow(); alert('同步完成。'); } catch (error) { alert(`同步暂时失败：${error.message || error}`); } finally { setBusy(button, false, '立即同步'); } };
  document.querySelector('#showPairing').onclick = () => { pairPanel.hidden = !pairPanel.hidden; if (!pairPanel.hidden) renderQr(sync.getPairUrl()); };
  document.querySelector('#copyRecoveryKey').onclick = async () => { const copied = await copyText(sync.getStatus().secret); alert(copied ? '恢复密钥已复制。' : '复制失败，请手动选择并复制。'); };
  document.querySelector('#downloadRecoveryKey').onclick = () => download('InterviewAI-同步恢复密钥.txt', `InterviewAI 跨设备同步恢复密钥\n\n${sync.getStatus().secret}\n\n请妥善保存。丢失后无法恢复云端同步内容；不要转发给他人。\n`);
  document.querySelector('#disconnectSync').onclick = () => { if (confirm('只断开本机吗？本机原有进度和笔记不会删除，云端和其他设备也不会删除。')) { sync.disconnect(); pairPanel.hidden = true; disabled.hidden = false; enabled.hidden = true; } };
};

ready();
