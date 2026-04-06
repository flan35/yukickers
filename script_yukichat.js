(function() {
  const yukichat = {
    id: localStorage.getItem('yukichat_id') || Math.random().toString(36).substr(2, 10),
    name: localStorage.getItem('yukichat_name') || '',
    avatar: localStorage.getItem('yukichat_avatar') || 'chibi_yuki.png',
    x: 50,
    y: 50,
    targetX: 50,
    targetY: 50,
    msg: '',
    msgTime: 0,
    users: {}, 
    avatars: {}, 
    isActive: false,
    syncInterval: null,
    isAdmin: false,
    password: '',
  };

  localStorage.setItem('yukichat_id', yukichat.id);

  const memberChibis = [
    { file: 'chibi_yuki.png', name: 'ユキちゃん' },
    { file: 'chibi_nodazouri.png', name: '野田草履' },
    { file: 'chibi_inoshishi.png', name: 'イノシシ' },
    { file: 'chibi_miki.png', name: 'ミキ' },
    { file: 'chibi_kariko.png', name: 'カリフラワー狩子' },
    { file: 'chibi_ponchan.png', name: 'ぽんちゃん' },
    { file: 'chibi_michaaam.png', name: 'michaaam' },
    { file: 'chibi_toromi.png', name: 'とろみ' }
  ];

  const adminChibi = { file: 'chibi_manager.png', name: '管理人' };

  const stage = document.getElementById('yukichat-stage');
  const setupOverlay = document.getElementById('yukichat-setup');
  const historyOverlay = document.getElementById('yukichat-history');
  const historyList = document.getElementById('yukichat-history-list');
  const activeCountEl = document.getElementById('yukichat-active-count');
  const avatarList = document.getElementById('yukichat-avatar-list');
  const nameInput = document.getElementById('yukichat-user-name');
  const enterBtn = document.getElementById('yukichat-enter-btn');
  const exitBtn = document.getElementById('yukichat-exit-btn');
  const chatInput = document.getElementById('yukichat-input');
  const sendBtn = document.getElementById('yukichat-send-btn');

  // Initialize UI Visibility
  if (historyOverlay) historyOverlay.style.display = 'none';

  // Initialize Active Counts Display (Top Left of Chat Container)
  function initStatsUI() {
    const container = document.querySelector('.yukichat-container');
    if (!container) return;
    
    let statsEl = document.getElementById('yukichat-stats-floating');
    if (!statsEl) {
      statsEl = document.createElement('div');
      statsEl.id = 'yukichat-stats-floating';
      container.appendChild(statsEl);
    }
  }
  initStatsUI();

  function updateStatsUI(active, waiting) {
    const statsEl = document.getElementById('yukichat-stats-floating');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="stat-item is-active"><i class="fa-solid fa-comments"></i> チャット中: <span>${active}</span>人</div>
        <div class="stat-item is-waiting"><i class="fa-solid fa-hourglass-half"></i> 待機中: <span>${waiting}</span>人</div>
      `;
    }
  }

  // Initialize Avatar List
  function renderAvatarSelector() {
    if (!avatarList) return;
    avatarList.innerHTML = '';
    const list = [...memberChibis];
    if (yukichat.isAdmin) list.unshift(adminChibi);

    list.forEach(m => {
      const div = document.createElement('div');
      div.className = `avatar-item ${yukichat.avatar === m.file ? 'selected' : ''}`;
      div.innerHTML = `<img src="${m.file}" alt="${m.name}"><p>${m.name}</p>`;
      div.onclick = () => {
        document.querySelectorAll('.avatar-item').forEach(el => el.classList.remove('selected'));
        div.classList.add('selected');
        yukichat.avatar = m.file;
        localStorage.setItem('yukichat_avatar', m.file);
      };
      avatarList.appendChild(div);
    });
  }
  renderAvatarSelector();

  if (nameInput) nameInput.value = yukichat.name;

  // Admin Toggle Trigger (Secret)
  if (setupOverlay) {
    const setupTitle = setupOverlay.querySelector('h3');
    let clickCount = 0;
    if (setupTitle) {
      setupTitle.style.cursor = 'pointer';
      setupTitle.onclick = () => {
        clickCount++;
        if (clickCount >= 5) {
          const pw = prompt('パスワードを入力してください');
          if (pw === '1234') {
            yukichat.isAdmin = true;
            yukichat.password = pw;
            alert('管理者モードが有効になりました');
            setupTitle.innerText = 'アバターを選んでね（管理者）';
            setupTitle.style.color = '#ff0055';
            renderAvatarSelector(); // Refresh list to show Manager chibi
          }
          clickCount = 0;
        }
      };
    }
  }

  const exitRoom = async (isAuto = false) => {
    if (!yukichat.isActive) return;
    
    // Notify server to remove instantly
    try {
      await fetch(`/api/yukichat?id=${yukichat.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: yukichat.id }),
        keepalive: true
      });
    } catch (e) { console.error('Exit notify failed', e); }

    yukichat.isActive = false;
    yukichat.initialLogsShown = false;
    yukichat.lastLogTs = null; // Clear log cache to ensure refresh upon re-entry
    
    Object.keys(yukichat.avatars).forEach(uid => {
      if (yukichat.avatars[uid]) yukichat.avatars[uid].remove();
      delete yukichat.avatars[uid];
    });
    yukichat.users = {};

    setupOverlay.classList.add('active');
    if (historyOverlay) historyOverlay.style.display = 'none';
    if (historyList) historyList.innerHTML = '';
    
    if (isAuto) {
      alert('10分間チャット送信がなかったため、自動的に退室しました。');
    }
  };

  if (exitBtn) {
    exitBtn.onclick = () => exitRoom();
  }

  window.addEventListener('pagehide', () => exitRoom());
  window.addEventListener('beforeunload', () => exitRoom());

  // Enter Room
  if (enterBtn) {
    enterBtn.onclick = async () => {
      yukichat.name = (nameInput && nameInput.value.trim()) || 'ゲスト';
      localStorage.setItem('yukichat_name', yukichat.name);
      
      yukichat.x = 10 + Math.random() * 80;
      yukichat.y = 20 + Math.random() * 60;
      yukichat.targetX = yukichat.x;
      yukichat.targetY = yukichat.y;

      setupOverlay.classList.remove('active');
      if (historyOverlay) historyOverlay.style.display = 'flex';
      yukichat.isActive = true;
      yukichat.lastChatTs = Date.now(); // Reset idle timer
      
      renderAvatar(yukichat.id, {
        name: yukichat.name,
        avatar: yukichat.avatar,
        x: yukichat.x,
        y: yukichat.y,
        isLocal: true
      });

      // Initial entry sync
      try {
        const res = await fetch(`/api/yukichat?id=${yukichat.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: yukichat.id,
            name: yukichat.name,
            avatar: yukichat.avatar,
            x: yukichat.x,
            y: yukichat.y,
            msg: '',
            password: yukichat.password
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          if (errData.reason === 'room_full') {
            alert('現在、入室人数が上限（10人）に達しています。時間をおいて再度お試しください。');
          } else if (errData.reason === 'name_ng') {
            alert('そのなまえは使用できません。別の名前を入力してください。');
          } else {
            alert('入室に失敗しました。');
          }
          yukichat.isActive = false;
          setupOverlay.classList.add('active');
          if (historyOverlay) historyOverlay.style.display = 'none';
          return;
        }
        
        await syncWithServer(true);
      } catch (e) {
        console.error('Enter failed', e);
        alert('接続エラーが発生しました。');
        yukichat.isActive = false;
        setupOverlay.classList.add('active');
      }
    };
  }

  // Move by Click
  if (stage) {
    stage.onclick = (e) => {
      if (!yukichat.isActive) return;
      const rect = stage.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * 100;
      const py = ((e.clientY - rect.top) / rect.height) * 100;
      
      yukichat.targetX = px;
      yukichat.targetY = py;
      updateLocalAvatarPos();
      syncWithServer(true);
    };
  }

  // Chat Submission
  const submitMsg = async () => {
    if (!yukichat.isActive) return;
    const rawText = chatInput.value.trim();
    if (!rawText) return;
    
    // Clear input instantly
    chatInput.value = '';
    yukichat.lastChatTs = Date.now(); // Reset idle timer on chat
    
    // Send RAW text to server and get censored version back
    try {
      const res = await fetch(`/api/yukichat?id=${yukichat.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: yukichat.id,
          name: yukichat.name,
          avatar: yukichat.avatar,
          x: yukichat.x,
          y: yukichat.y,
          msg: rawText, // Send original
          password: yukichat.password
        })
      });

      if (res.ok) {
        const data = await res.json();
        const finalMsg = data.msg || rawText;
        
        // Show the moderated version on sender's own screen
        showBubble(yukichat.id, finalMsg);
        
        // Update state but exclude it from next sync to avoid repeats
        yukichat.msg = '';
        yukichat.msgTime = Date.now();
      }
    } catch (e) {
      console.error('Chat Send Failed:', e);
    }
  };

  if (chatInput) chatInput.onkeypress = (e) => { if (e.key === 'Enter') submitMsg(); };
  if (sendBtn) sendBtn.onclick = submitMsg;

  function updateLocalAvatarPos() {
    yukichat.x = yukichat.targetX;
    yukichat.y = yukichat.targetY;
    renderAvatar(yukichat.id, {
      name: yukichat.name,
      avatar: yukichat.avatar,
      x: yukichat.x,
      y: yukichat.y,
      isLocal: true
    });
  }

  function renderAvatar(uid, state) {
    let el = yukichat.avatars[uid];
    if (!el) {
      el = document.createElement('div');
      el.className = `yukichat-avatar ${state.isLocal ? 'is-local' : ''}`;
      el.innerHTML = `
        <img src="${state.avatar}" alt="Avatar">
        <div class="avatar-name-tag">${state.is_admin ? '<i class="fa-solid fa-crown"></i> ' : ''}${state.name}</div>
        ${yukichat.isAdmin && !state.isLocal ? `
          <div class="avatar-admin-actions">
            <button class="avatar-kick-btn" title="キック（5分）" onclick="yukichatKickUser('${uid}', '${state.name.replace(/'/g, "\\'")}')"><i class="fa-solid fa-square-xmark"></i></button>
            <button class="avatar-ban-btn" title="永久追放" onclick="yukichatBanUser('${uid}', '${state.name.replace(/'/g, "\\'")}')"><i class="fa-solid fa-ban"></i></button>
          </div>
        ` : ''}
      `;
      stage.appendChild(el);
      yukichat.avatars[uid] = el;
    }

    if (state.is_admin) {
      el.classList.add('is-admin');
    } else {
      el.classList.remove('is-admin');
    }

    const img = el.querySelector('img');
    if (img.getAttribute('src') !== state.avatar) {
      img.src = state.avatar;
    }

    el.style.left = `${state.x}%`;
    el.style.top = `${state.y}%`;
    el.querySelector('.avatar-name-tag').innerText = state.name;
    el.style.zIndex = 10 + Math.floor(state.y);
  }

  function showBubble(uid, text, isStatic = false) {
    const el = yukichat.avatars[uid];
    if (!el) return;

    const old = el.querySelector('.yukichat-bubble');
    if (old) old.remove();
    if (!text) return;

    const b = document.createElement('div');
    b.className = 'yukichat-bubble';
    b.innerText = text;
    el.appendChild(b);

    if (!isStatic) {
      setTimeout(() => {
        if (b && b.parentNode) b.remove();
      }, 5000);
    }
  }

  async function syncWithServer(isImmediate = false) {
    try {
      // Sync presence (even if waiting)
      // If active, sync position. If waiting, sync presence status.
      // Ad-hoc: send POST every 10s if waiting, every 2s if active.
      const nowTs = Date.now();
      const shouldSyncPost = yukichat.isActive ? (nowTs - yukichat.msgTime > 2000) : (nowTs - (yukichat.lastWaitingSync || 0) > 10000);

      if (shouldSyncPost || isImmediate) {
        if (!yukichat.isActive) yukichat.lastWaitingSync = nowTs;
        
        const resPost = await fetch(`/api/yukichat?id=${yukichat.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: yukichat.id,
            name: yukichat.name || 'ゲスト',
            avatar: yukichat.avatar,
            x: yukichat.isActive ? yukichat.x : 50,
            y: yukichat.isActive ? yukichat.y : 50,
            msg: '',
            password: yukichat.password,
            is_waiting: yukichat.isActive ? 0 : 1
          })
        });
        if (resPost.status === 401 || resPost.status === 403) {
          handleKickBanResponse(resPost);
          return;
        }
      }

      if (yukichat.isActive) {
        // Idle Check: Time out if no chat for 10 minutes (Admins are exempt)
        if (!yukichat.isAdmin && nowTs - yukichat.lastChatTs > 600000) {
          exitRoom(true); 
          return;
        }
      }

      // GET current world state
      // Optimization: If waiting, only GET every 10s. If active, every 2s.
      const shouldSyncGet = yukichat.isActive ? true : (nowTs - (yukichat.lastGetSync || 0) > 10000);

      if (shouldSyncGet || isImmediate) {
        if (!yukichat.isActive) yukichat.lastGetSync = nowTs;

        const res = await fetch(`/api/yukichat?id=${yukichat.id}`);
        if (res.status === 401 || res.status === 403) {
          handleKickBanResponse(res);
          return;
        }
        
        if (res.ok) {
          const data = await res.json();
          updateStatsUI(data.activeCount || 0, data.waitingCount || 0);

          if (yukichat.isActive) {
            // Detect if I was kicked (not in the user list)
            if (!data.users[yukichat.id]) {
              exitRoom(false);
              alert('管理者によってキックされました。');
              return;
            }
            updateRemoteUsers(data.users);
            renderHistory(data.logs);
          }
        }
      }

    } catch (e) { console.error('Yukichat Sync Failed', e); }
  }

  function updateRemoteUsers(remoteUsers) {
    Object.keys(yukichat.users).forEach(uid => {
      if (!remoteUsers[uid] && uid !== yukichat.id) {
        if (yukichat.avatars[uid]) {
          yukichat.avatars[uid].remove();
          delete yukichat.avatars[uid];
        }
        delete yukichat.users[uid];
      }
    });

    Object.keys(remoteUsers).forEach(uid => {
      if (uid === yukichat.id) return;
      const state = remoteUsers[uid];
      const oldState = yukichat.users[uid];
      renderAvatar(uid, state);
      if (state.msg && (!oldState || oldState.msg !== state.msg)) {
        showBubble(uid, state.msg);
      }
      yukichat.users[uid] = state;
    });
  }

  function renderHistory(logs) {
    if (!historyList || !logs) return;
    
    // Check if logs changed by generating a simple fingerprint
    const fingerprint = logs.map(l => l.id + l.msg).join('|');
    if (yukichat.lastLogFingerprint === fingerprint) return;
    yukichat.lastLogFingerprint = fingerprint;

    const isAtBottom = historyList.scrollHeight - historyList.clientHeight <= historyList.scrollTop + 20;

    historyList.innerHTML = logs.reverse().map(log => `
      <div class="history-item ${log.is_admin ? 'is-admin' : ''}">
        <span class="log-name">
          ${yukichat.isAdmin ? `<button class="admin-delete-log-btn" title="ログを削除" onclick="yukichatDeleteLog('${log.id}')"><i class="fa-solid fa-square-xmark"></i></button>` : ''}
          ${log.is_admin ? '<i class="fa-solid fa-crown"></i> ' : ''}${log.name}:
        </span>
        <span class="log-msg">${log.msg}</span>
      </div>
    `).join('');

    // Add Clear Logs button if admin
    if (yukichat.isAdmin && !document.getElementById('admin-clear-logs')) {
      const title = document.querySelector('.history-title');
      const btn = document.createElement('button');
      btn.id = 'admin-clear-logs';
      btn.className = 'admin-clear-btn';
      btn.innerHTML = '<i class="fa-solid fa-trash-can"></i> 全削除';
      btn.onclick = () => clearAllLogs();
      title.appendChild(btn);
    }

    // Auto scroll if user was near bottom
    if (isAtBottom) {
      historyList.scrollTop = historyList.scrollHeight;
    }
  }

  // Admin Actions
  window.yukichatKickUser = async (targetId, name) => {
    if (!confirm(`${name} をキック（5分間参加禁止）しますか？`)) return;
    try {
      await fetch('/api/yukichat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'kick', targetId, password: yukichat.password })
      });
      syncWithServer();
    } catch (e) { console.error('Kick failed', e); }
  };

  window.yukichatBanUser = async (targetId, name) => {
    if (!confirm(`${name} を永久追放しますか？\n同じインターネット環境からは二度と入室できなくなります。`)) return;
    try {
      await fetch('/api/yukichat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ban', targetId, password: yukichat.password })
      });
      syncWithServer();
    } catch (e) { console.error('Ban failed', e); }
  };

  async function handleKickBanResponse(res) {
    const data = await res.json();
    exitRoom(false);
    alert(data.error || 'アクセスが拒否されました。');
  }

  window.yukichatDeleteLog = async (logId) => {
    if (!confirm('このチャットを削除しますか？')) return;
    try {
      await fetch('/api/yukichat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteLog', targetId: logId, password: yukichat.password })
      });
      syncWithServer();
    } catch (e) { console.error('Delete log failed', e); }
  };

  async function clearAllLogs() {
    if (!confirm('チャットログをすべて削除しますか？')) return;
    try {
      await fetch('/api/yukichat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clearLogs', password: yukichat.password })
      });
      syncWithServer();
    } catch (e) { console.error('Clear logs failed', e); }
  }

  function startSync() {
    syncWithServer();
    yukichat.syncInterval = setInterval(() => syncWithServer(), 2000);
  }

  startSync();

})();
