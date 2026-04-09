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
    isAdmin: false,
    password: '',
    isKicked: false,
    isIntersecting: false,
    isLocalMode: false, // Fallback for testing without server
  };

  const isLocalEnv = location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  localStorage.setItem('yukichat_id', yukichat.id);

  const memberChibis = [
    { file: 'chibi_yuki.png', name: 'ユキちゃん' },
    { file: 'chibi_nodazouri.png', name: '野田草履' },
    { file: 'chibi_inoshishi.png', name: 'イノシシ' },
    { file: 'chibi_miki.png', name: 'ミキ' },
    { file: 'chibi_kariko.png', name: 'カリフラワー狩子' },
    { file: 'chibi_ponchan.png', name: 'ぽんちゃん' },
    { file: 'chibi_michaaam.png', name: 'michaaam' },
    { file: 'chibi_toromi.png', name: 'とろみ' },
    { file: 'chibi_urita.png', name: '瓜田純士' },
    { file: 'chibi_reiko.png', name: '瓜田麗子' }
  ];

  const adminChibis = [
    { file: 'chibi_manager.png', name: '管理人' },
    { file: 'yukickersR.png', name: 'ユキッカーズ' }
  ];

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
      statsEl.style.opacity = '0'; // Hidden by default
      statsEl.innerHTML = `
        <div class="stat-item is-active"><i class="fa-solid fa-comments"></i> チャット中: <span id="num-active">--</span>人</div>
        <div class="stat-item is-waiting"><i class="fa-solid fa-hourglass-half"></i> 待機中: <span id="num-waiting">--</span>人</div>
      `;
      container.appendChild(statsEl);
    }

    // Visibility Observer
    const observer = new IntersectionObserver((entries) => {
      yukichat.isIntersecting = entries[0].isIntersecting;
      if (yukichat.isIntersecting) {
        if (statsEl) statsEl.style.opacity = '1';
        syncWithServer(true); // Sync immediately when in view
      }
    }, { threshold: 0.1 });
    observer.observe(container);
  }
  initStatsUI();

  function updateStatsUI(active, waiting) {
    const activeEl = document.getElementById('num-active');
    const waitingEl = document.getElementById('num-waiting');
    if (activeEl) activeEl.innerText = active;
    if (waitingEl) waitingEl.innerText = waiting;
  }

  // Initialize Avatar List
  function renderAvatarSelector() {
    if (!avatarList) return;
    avatarList.innerHTML = '';
    const list = [...memberChibis];
    if (yukichat.isAdmin) {
      adminChibis.forEach(ac => list.unshift(ac));
    }

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
    const triggerArea = setupOverlay.querySelector('.yukichat-disclaimer') || setupTitle;
    let clickCount = 0;
    if (triggerArea) {
      triggerArea.style.cursor = 'pointer';
      triggerArea.style.userSelect = 'none'; // Prevent selection while fast clicking
      triggerArea.style.touchAction = 'manipulation'; // Prevent double-tap zoom on mobile
      
      triggerArea.addEventListener('click', () => {
        clickCount++;
        if (clickCount >= 5) {
          const pw = prompt('パスワードを入力してください');
          if (pw === '1234') {
            yukichat.isAdmin = true;
            yukichat.password = pw;
            alert('管理者モードが有効になりました');
            if (setupTitle) {
              setupTitle.innerText = 'アバターを選んでね（管理者）';
              setupTitle.style.color = '#ff0055';
            }
            renderAvatarSelector(); // Refresh list to show Manager chibi
          }
          clickCount = 0;
        }
      });
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
    yukichat.lastLogTs = null;
    yukichat.lastLogFingerprint = null; // Reset so logs are re-rendered on re-entry
    
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

      try {
        // Initial entry sync
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
            password: yukichat.password,
            is_waiting: 0
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
        console.warn('Backend connection failed, entering Local Mode', e);
        yukichat.isLocalMode = true;
        if (activeCountEl) activeCountEl.innerText = '(Local Mode)';
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
          is_emote: chatInput.dataset.isEmote === 'true' ? 1 : 0,
          password: yukichat.password,
          is_waiting: 0
        })
      });

      if (res.ok) {
        const data = await res.json();
        const isEmote = chatInput.dataset.isEmote === 'true';
        const finalMsg = data.msg || rawText;
        
        // Show the moderated version on sender's own screen
        showBubble(yukichat.id, finalMsg, false, isEmote);
        
        // Update state but exclude it from next sync to avoid repeats
        yukichat.msg = '';
        yukichat.msgTime = Date.now();
        chatInput.dataset.isEmote = 'false';
      }
    } catch (e) {
      if (yukichat.isLocalMode) {
        const isEmote = chatInput.dataset.isEmote === 'true';
        showBubble(yukichat.id, rawText, false, isEmote);
        chatInput.dataset.isEmote = 'false';
      } else {
        console.error('Chat Send Failed:', e);
      }
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
            <button class="avatar-kick-btn" title="キック（1分）" onclick="yukichatKickUser('${uid}', '${state.name.replace(/'/g, "\\'")}')"><i class="fa-solid fa-square-xmark"></i></button>
            <button class="avatar-ban-btn" title="永久追放" onclick="yukichatBanUser('${uid}', '${state.name.replace(/'/g, "\\'")}')"><i class="fa-solid fa-ban"></i></button>
          </div>
        ` : ''}
      `;
      
      // Emote trigger for local user
      if (state.isLocal) {
        const img = el.querySelector('img');
        img.style.cursor = 'help';
        img.onclick = (event) => {
          event.stopPropagation();
          toggleEmoteMenu(el);
        };
      }

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

  function showBubble(uid, text, isStatic = false, isEmote = false) {
    const el = yukichat.avatars[uid];
    if (!el) return;

    const old = el.querySelector('.yukichat-bubble');
    if (old) old.remove();
    if (!text) return;

    let emoteClass = '';
    if (isEmote) {
      const mapping = {
        '❤️': 'love', '✨': 'sparkle', '👍': 'good', '😊': 'happy',
        '😭': 'sad', '🎉': 'burst', '🔥': 'fire', '🙏': 'pray'
      };
      emoteClass = `is-emote-${mapping[text] || 'love'}`;
    }

    const b = document.createElement('div');
    b.className = `yukichat-bubble ${isEmote ? 'is-emote' : ''} ${emoteClass}`;
    b.innerText = text;
    el.appendChild(b);

    if (!isStatic) {
      setTimeout(() => {
        if (b && b.parentNode) b.remove();
      }, isEmote ? 3000 : 5000);
    }
  }

  function toggleEmoteMenu(anchorEl) {
    let menu = document.getElementById('emote-menu');
    if (menu) {
      menu.remove();
      return;
    }

    menu = document.createElement('div');
    menu.id = 'emote-menu';
    menu.className = 'emote-menu';
    const emotes = ['❤️', '✨', '👍', '😊', '😭', '🎉', '🔥', '🙏'];
    const radius = 80;
    
    emotes.forEach((emo, i) => {
      const angle = (i * (360 / emotes.length)) - 90; // Start from top
      const rad = angle * (Math.PI / 180);
      const x = Math.cos(rad) * radius;
      const y = Math.sin(rad) * radius;

      const btn = document.createElement('span');
      btn.className = 'emote-btn';
      btn.innerText = emo;
      btn.style.left = `${x}px`;
      btn.style.top = `${y}px`;
      btn.style.animationDelay = `${i * 0.05}s`;

      btn.onclick = (e) => {
        e.stopPropagation();
        sendEmote(emo);
        menu.remove();
      };
      menu.appendChild(btn);
    });

    anchorEl.appendChild(menu);
  }

  function sendEmote(emoji) {
    chatInput.value = emoji;
    chatInput.dataset.isEmote = 'true';
    submitMsg();
  }

  async function syncWithServer(isImmediate = false) {
    if (yukichat.isLocalMode && !isImmediate) return;
    try {
      // Optimization: If NOT active and NOT in view, skip everything.
      if (!yukichat.isActive && !yukichat.isIntersecting && !isImmediate && !yukichat.isLocalMode) return;

      // Sync presence (even if waiting)
      // If active, sync position. If waiting, sync presence status.
      // Ad-hoc: send POST every 30s if waiting, every 2s if active.
      const nowTs = Date.now();
      const shouldSyncPost = yukichat.isActive ? (nowTs - yukichat.msgTime > 2000) : (nowTs - (yukichat.lastWaitingSync || 0) > 30000);

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
            is_emote: chatInput.dataset.isEmote === 'true' ? 1 : 0,
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
      // Optimization: If waiting, only GET every 30s. If active, every 2s.
      const shouldSyncGet = yukichat.isActive ? true : (nowTs - (yukichat.lastGetSync || 0) > 30000);

      if (shouldSyncGet || isImmediate) {
        if (!yukichat.isActive) yukichat.lastGetSync = nowTs;

        const getUrl = yukichat.password ? `/api/yukichat?id=${yukichat.id}&pw=${yukichat.password}` : `/api/yukichat?id=${yukichat.id}`;
        const res = await fetch(getUrl);
        if (res.status === 401 || res.status === 403) {
          handleKickBanResponse(res);
          return;
        }
        
        if (res.ok) {
          const data = await res.json();
          updateStatsUI(data.activeCount || 0, data.waitingCount || 0);

          if (yukichat.isActive) {
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
    if (!confirm(`${name} をキック（1分間参加禁止）しますか？`)) return;
    try {
      await fetch(`/api/yukichat?id=${yukichat.id}`, {
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
    if (yukichat.isKicked) return;
    
    try {
      const data = await res.json();
      // Only treat as a real kick/ban if the server explicitly says so
      if (data.reason !== 'kicked' && data.reason !== 'banned') return;
      
      yukichat.isKicked = true;
      if (yukichat.syncInterval) {
        clearInterval(yukichat.syncInterval);
        yukichat.syncInterval = null;
      }
      exitRoom(false);
      alert(data.error || 'アクセスが拒否されました。');
    } catch (e) {
      // JSON parse failed - not a real kick/ban response, ignore
      console.warn('Non-kick 401/403 response, ignoring', e);
    }
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
