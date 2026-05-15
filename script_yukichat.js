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
    isLocalMode: false, 
    isSequential: true, // Now default
    isShuffle: localStorage.getItem('yukichat_shuffle') === 'true',
    isMusicTransitioning: false,
    lastSeekTime: 0,
    lastSyncedVideoId: null,
    playlist: []
  };
  const escapeHTML = (str) => String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };


  const isLocalEnv = location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  localStorage.setItem('yukichat_id', yukichat.id);

  let memberChibis = [];
  let adminChibis = [];

  async function loadChatMembers() {
    // Member data is now loaded from members.js as a global variable
    if (typeof window.YUKICKERS_MEMBERS !== 'undefined') {
      const data = window.YUKICKERS_MEMBERS;
      
      // Clear current lists
      memberChibis = [];
      adminChibis = [];

      data.forEach(m => {
        if (m.chibi) {
          if (m.isAdmin) {
            adminChibis.push({ file: m.chibi, name: m.name });
          } else {
            memberChibis.push({ file: m.chibi, name: m.name });
          }
        }
      });
      
      renderAvatarSelector();
    } else {
      console.error('YUKICKERS_MEMBERS is not defined. Make sure members.js is loaded.');
      // Fallback
      memberChibis = [{ file: 'chibi_yuki.png', name: 'ユキちゃん' }];
      renderAvatarSelector();
    }
  }

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
    if (memberChibis.length === 0) {
      avatarList.innerHTML = '<p style="grid-column: 1/-1; text-align: center; font-size: 0.8rem; color: #999;">アバター情報を読み込み中...</p>';
      return;
    }
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

  // Admin Custom Toggle Trigger
  const adminTriggerBtn = document.getElementById('admin-trigger-btn');
  const adminLoginModal = document.getElementById('yukichat-admin-login');
  const adminPwInput = document.getElementById('admin-pw-input');
  const adminLoginSubmit = document.getElementById('admin-login-submit');
  const adminLoginCancel = document.getElementById('admin-login-cancel');
  const adminLoginError = document.getElementById('admin-login-error');

  if (adminTriggerBtn && adminLoginModal) {
    // Show Modal
    adminTriggerBtn.addEventListener('click', () => {
      adminLoginModal.style.display = 'flex';
      adminLoginModal.style.opacity = '1';
      adminLoginModal.style.pointerEvents = 'auto';
      adminLoginError.style.display = 'none';
      adminPwInput.value = '';
      adminPwInput.focus();
    });

    // Cancel Button
    adminLoginCancel.addEventListener('click', () => {
      adminLoginModal.style.display = 'none';
    });

    // Execute Login
    const executeLogin = () => {
      const pw = adminPwInput.value;
      if (pw === '1234') {
        yukichat.isAdmin = true;
        yukichat.password = pw;
        adminLoginModal.style.display = 'none';
        
        const setupTitle = setupOverlay.querySelector('h3');
        if (setupTitle) {
          setupTitle.innerHTML = 'アバターを選んでね <span style="color:#ff0055; font-size: 0.8rem;">(管理者)</span>';
        }
        renderAvatarSelector(); // Refresh list to show Manager chibi
        
        // Show music edit button and playlist if admin
        const musicEditBtn = document.getElementById('music-edit');
        if (musicEditBtn) musicEditBtn.style.display = 'inline-block';
        const playlistContainer = document.getElementById('yukichat-playlist-container');
        if (playlistContainer) playlistContainer.style.display = 'block';
      } else {
        adminLoginError.style.display = 'block';
        adminPwInput.value = '';
        adminPwInput.focus();
      }
    };

    adminLoginSubmit.addEventListener('click', executeLogin);
    adminPwInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') executeLogin();
    });
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
    // Stop music on exit
    if (isPlayerReady && ytPlayer && ytPlayer.pauseVideo) {
      try { ytPlayer.pauseVideo(); } catch(e){}
    }
    updateMusicUI(false);
    
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
      alert('1時間チャット送信がなかったため、自動的に退室しました。');
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
      yukichat.isInitialSync = true;
      yukichat.isFirstSync = true;
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
            alert('現在、入室人数が上限（20人）に達しています。時間をおいて再度お試しください。');
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
      
      console.log('Moving to:', px, py);
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
          is_emote: (chatInput.dataset.isEmote === 'true' || ['❤️', '✨', '👍', '😊', '😭', '🎉', '🔥', '🙏'].includes(rawText)) ? 1 : 0,
          password: yukichat.password,
          is_waiting: 0
        })
      });

      if (res.ok) {
        const data = await res.json();
        const isEmote = chatInput.dataset.isEmote === 'true' || ['❤️', '✨', '👍', '😊', '😭', '🎉', '🔥', '🙏'].includes(rawText);
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
        const isEmote = chatInput.dataset.isEmote === 'true' || ['❤️', '✨', '👍', '😊', '😭', '🎉', '🔥', '🙏'].includes(rawText);
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
            <button class="avatar-kick-btn" title="キック（1分）"><i class="fa-solid fa-square-xmark"></i></button>
            <button class="avatar-ban-btn" title="永久追放"><i class="fa-solid fa-ban"></i></button>
          </div>
        ` : ''}
      `;
      
      if (yukichat.isAdmin && !state.isLocal) {
        const kickBtn = el.querySelector('.avatar-kick-btn');
        const banBtn = el.querySelector('.avatar-ban-btn');
        if (kickBtn) kickBtn.onclick = (e) => { e.stopPropagation(); yukichatKickUser(uid, state.name); };
        if (banBtn) banBtn.onclick = (e) => { e.stopPropagation(); yukichatBanUser(uid, state.name); };
      }
      
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
        if (!yukichat.isAdmin && nowTs - yukichat.lastChatTs > 3600000) {
          exitRoom(true); 
          return;
        }
      }

      // GET current world state
      // Optimization: If waiting, only GET every 30s. If active, every 2s.
      const shouldSyncGet = yukichat.isActive ? true : (nowTs - (yukichat.lastGetSync || 0) > 30000);

      if (shouldSyncGet || isImmediate) {
        if (!yukichat.isActive) yukichat.lastGetSync = nowTs;

        let getUrl = yukichat.password ? `/api/yukichat?id=${yukichat.id}&pw=${yukichat.password}` : `/api/yukichat?id=${yukichat.id}`;
        if (yukichat.isInitialSync) {
          getUrl += '&is_initial=1';
          yukichat.isInitialSync = false;
        }
        const res = await fetch(getUrl);
        if (res.status === 401 || res.status === 403) {
          handleKickBanResponse(res);
          return;
        }
        
        if (res.ok) {
          const data = await res.json();
          updateStatsUI(data.activeCount || 0, data.waitingCount || 0);

          if (data.server_time) {
        yukichat.serverTimeOffset = data.server_time - Date.now();
      }

      if (yukichat.isActive) {
            updateRemoteUsers(data.users);
            renderHistory(data.logs);
          }
          // Synchronize music state
          const musicChanged = yukichat.lastMusicOn !== data.music_on || yukichat.lastMusicStart !== data.music_start_time || yukichat.lastMusicVideoId !== data.music_video_id;
          // If music is ON, we want to call updateMusicUI regularly until it's synced (in case metadata wasn't ready)
          if (yukichat.isFirstSync || musicChanged || data.music_on) {
            updateMusicUI(data.music_on, data.music_start_time, data.music_video_id);
            yukichat.lastMusicOn = data.music_on;
            yukichat.lastMusicStart = data.music_start_time;
            yukichat.lastMusicVideoId = data.music_video_id;
            yukichat.isFirstSync = false;
          }
          if (yukichat.isAdmin && data.playlist) {
            renderPlaylist(data.playlist);
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
        const isEmoteMsg = ['❤️', '✨', '👍', '😊', '😭', '🎉', '🔥', '🙏'].includes(state.msg);
        showBubble(uid, state.msg, false, isEmoteMsg);
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

    historyList.innerHTML = logs.reverse().map(log => {
      const isSystem = log.name === 'SYSTEM';
      return `
        <div class="history-item ${log.is_admin ? 'is-admin' : ''} ${isSystem ? 'is-system' : ''}" data-log-id="${log.id}">
          <span class="log-time">${formatTime(log.ts)}</span>
          ${isSystem ? '' : `
            <span class="log-name">
              ${yukichat.isAdmin ? `<button class="admin-delete-log-btn" title="ログを削除"><i class="fa-solid fa-square-xmark"></i></button>` : ''}
              ${log.is_admin ? '<i class="fa-solid fa-crown"></i> ' : ''}${escapeHTML(log.name)}:
            </span>
          `}
          <span class="log-msg">${escapeHTML(log.msg)}</span>
        </div>
      `;
    }).join('');

    if (yukichat.isAdmin) {
      historyList.querySelectorAll('.history-item').forEach(item => {
        const btn = item.querySelector('.admin-delete-log-btn');
        if (btn) {
          btn.onclick = (e) => {
            e.stopPropagation();
            yukichatDeleteLog(item.dataset.logId);
          };
        }
      });
    }

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

  // --- Music Sync Logic ---
  let ytPlayer = null;
  let currentMusicState = false;
  let currentMusicVideoId = 'F0B7HDiY-10';
  let isPlayerReady = false;

  function loadYoutubeAPI() {
    if (window.YT) return;
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  }

  window.onYouTubeIframeAPIReady = () => {
    const savedVol = localStorage.getItem('yukichat_music_volume') || 50;
    ytPlayer = new YT.Player('yukichat-yt-player', {
      videoId: 'F0B7HDiY-10',
      playerVars: {
        'autoplay': 0,
        'controls': 0,
        'rel': 0,
        'showinfo': 0,
        'modestbranding': 1,
        'loop': 1,
        'playlist': 'F0B7HDiY-10',
        'origin': (location.protocol === 'http:' || location.protocol === 'https:') ? location.origin : undefined
      },
      events: {
        'onReady': () => {
          isPlayerReady = true;
          try { ytPlayer.setPlaybackQuality('small'); } catch(e){}
          ytPlayer.setVolume(savedVol * 0.6); // Scale: 50% slider = 30% actual
          const volSlider = document.getElementById('music-volume');
          if (volSlider) volSlider.value = savedVol;
          // Sync with current known state once ready
          updateMusicUI(currentMusicState);
        },
        'onStateChange': (event) => {
          // If a song ends, play the next one (Sequential is default, or Shuffle if ON)
          if (event.data === YT.PlayerState.ENDED && currentMusicState) {
            if (yukichat.isAdmin && yukichat.playlist.length > 0) {
              playNextInPlaylist();
            } else {
              ytPlayer.playVideo(); // Single song loop (default if no playlist)
            }
          }
        }
      }
    });
  };

  function updateMusicUI(isOn, startTime = 0, videoId = 'F0B7HDiY-10') {
    const playerContainer = document.getElementById('yukichat-music-player');
    const onBtn = document.getElementById('music-on');
    const offBtn = document.getElementById('music-off');
    
    if (!playerContainer || !onBtn || !offBtn) return;

    // Force music OFF if user is not in the room
    if (!yukichat.isActive) {
      isOn = false;
    }

    if (isOn) {
      playerContainer.classList.add('is-on');
      onBtn.classList.add('active');
      offBtn.classList.remove('active');
      
      if (isPlayerReady && ytPlayer && ytPlayer.playVideo) {
        // Change video if server says so
        if (videoId && videoId !== currentMusicVideoId) {
          console.log("Music video changed to:", videoId);
          currentMusicVideoId = videoId;
          ytPlayer.loadVideoById({
            videoId: videoId,
            startSeconds: 0,
            suggestedQuality: 'small'
          });
        }

        const state = ytPlayer.getPlayerState();
        
        const savedVol = localStorage.getItem('yukichat_music_volume') || 50;
        ytPlayer.setVolume(savedVol * 0.6);

        // Calculate synchronized playback time
        if (startTime > 0) {
          const duration = ytPlayer.getDuration();
          if (duration > 0) {
            const adjustedNow = Date.now() + (yukichat.serverTimeOffset || 0);
            const elapsedSec = (adjustedNow - startTime) / 1000;
            const targetTime = elapsedSec % duration;
            const currentTime = ytPlayer.getCurrentTime();
            const drift = Math.abs(currentTime - targetTime);

            // Sync if drift > 10s (relaxed to prevent frequent buffering)
            // Only sync once at start, or if drift is massive.
            const nowSeekTs = Date.now();
            const isInitialSyncForVideo = !yukichat.lastSyncedVideoId || yukichat.lastSyncedVideoId !== videoId;

            // Only sync if it's the first time for this video AND drift > 5s, OR if drift > 15s
            if (((isInitialSyncForVideo && drift > 5) || drift > 15) && state !== YT.PlayerState.BUFFERING && (nowSeekTs - yukichat.lastSeekTime > 10000)) {
              console.log(`[MusicSync] Drift detected: ${drift.toFixed(2)}s. Syncing to ${targetTime.toFixed(2)}s`);
              ytPlayer.seekTo(targetTime, true);
              yukichat.lastSeekTime = nowSeekTs;
              yukichat.lastSyncedVideoId = videoId;
            }
          }
        }

        // Only force play if it's completely stopped/cued, not if it's paused or buffering
        if (state === YT.PlayerState.UNSTARTED || state === YT.PlayerState.CUED) {
          ytPlayer.playVideo();
        }
      }
    } else {
      // Music is OFF, but we stay visible (no display: none) to allow turning it back ON
      playerContainer.classList.remove('is-on');
      onBtn.classList.remove('active');
      offBtn.classList.add('active');
      if (isPlayerReady && ytPlayer && ytPlayer.pauseVideo) {
        const state = ytPlayer.getPlayerState();
        if (state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING) {
          ytPlayer.pauseVideo();
        }
      }
    }
    currentMusicState = isOn;
  }

  async function setMusicState(on) {
    // Immediate UI feedback for better UX
    updateMusicUI(on);

    // Capture user gesture immediately if turning ON
    if (on && isPlayerReady && ytPlayer && ytPlayer.playVideo) {
      try {
        ytPlayer.playVideo();
      } catch(e) { console.warn("Initial play failed", e); }
    }
    
    try {
      await fetch('/api/yukichat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'music',
          value: on ? 'on' : 'off',
          id: yukichat.id,
          password: yukichat.password
        })
      });
      syncWithServer(true);
    } catch (e) { 
      console.warn('Music sync failed (Local Mode?)', e); 
      // In local mode, we still want the UI to reflect our choice
    }
  }

  const mOnBtn = document.getElementById('music-on');
  const mOffBtn = document.getElementById('music-off');
  const mVolSlider = document.getElementById('music-volume');
  const mPlayerContainer = document.getElementById('yukichat-music-player');

  if (mOnBtn) mOnBtn.onclick = (e) => { e.stopPropagation(); setMusicState(true); };
  if (mOffBtn) mOffBtn.onclick = (e) => { e.stopPropagation(); setMusicState(false); };
  if (mPlayerContainer) mPlayerContainer.onclick = (e) => e.stopPropagation();

  if (mVolSlider) {
    mVolSlider.oninput = (e) => {
      const sliderVal = e.target.value;
      const actualVol = sliderVal * 0.6; // Scale down for better range
      if (isPlayerReady && ytPlayer && ytPlayer.setVolume) {
        ytPlayer.setVolume(actualVol);
        localStorage.setItem('yukichat_music_volume', sliderVal);
      }
    };
    mVolSlider.onclick = (e) => e.stopPropagation();
  }
  
  // Playlist Editing for Admin
  const mEditBtn = document.getElementById('music-edit');
  const mEditBox = document.getElementById('music-edit-container');
  const mNewIdInput = document.getElementById('music-new-id');
  const mSaveBtn = document.getElementById('music-save-id');
  const mCancelBtn = document.getElementById('music-cancel-id');

  if (mEditBtn) {
    mEditBtn.onclick = (e) => {
      e.stopPropagation();
      if (mEditBox) mEditBox.style.display = mEditBox.style.display === 'none' ? 'flex' : 'none';
    };
  }

  if (mCancelBtn) {
    mCancelBtn.onclick = (e) => {
      e.stopPropagation();
      if (mEditBox) mEditBox.style.display = 'none';
    };
  }

  if (mSaveBtn) {
    mSaveBtn.onclick = async (e) => {
      e.stopPropagation();
      let inputVal = mNewIdInput.value.trim();
      if (!inputVal) return;
      const videoId = extractVideoId(inputVal);
      if (!videoId) {
        alert("有効な動画IDまたはURLを入力してください。");
        return;
      }
      setGlobalVideo(videoId);
    };
  }

  function extractVideoId(input) {
    let videoId = input;
    try {
      if (input.includes('youtube.com') || input.includes('youtu.be')) {
        const url = new URL(input);
        if (input.includes('youtu.be')) {
          videoId = url.pathname.slice(1);
        } else if (url.searchParams.has('v')) {
          videoId = url.searchParams.get('v');
        } else if (url.pathname.includes('/live/')) {
          videoId = url.pathname.split('/live/')[1].split('?')[0];
        } else if (url.pathname.includes('/shorts/')) {
          videoId = url.pathname.split('/shorts/')[1].split('?')[0];
        }
      }
    } catch(err) { console.warn("URL parse failed", err); }
    return videoId;
  }

  async function setGlobalVideo(videoId) {
    if (yukichat.isMusicTransitioning) return;
    yukichat.isMusicTransitioning = true;
    
    try {
      const res = await fetch('/api/yukichat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_video',
          videoId: videoId,
          id: yukichat.id,
          password: yukichat.password
        })
      });
      if (res.ok) {
        if (mEditBox) mEditBox.style.display = 'none';
        mNewIdInput.value = '';
        currentMusicVideoId = videoId; // Update locally immediately
        await syncWithServer(true);
      }
    } catch (err) { console.error("Video set failed", err); }
    
    // Cooldown to prevent double-skipping (YouTube API sometimes fires multiple ENDED events)
    setTimeout(() => {
      yukichat.isMusicTransitioning = false;
    }, 3000);
  }

  async function playNextInPlaylist() {
    if (!yukichat.playlist || yukichat.playlist.length === 0 || yukichat.isMusicTransitioning) return;
    
    let nextVideo = null;
    
    if (yukichat.isShuffle) {
      // Pick a random song that isn't the current one if possible
      let pool = yukichat.playlist;
      const currentId = (currentMusicVideoId || '').trim();
      if (pool.length > 1) {
        pool = pool.filter(item => (item.video_id || '').trim() !== currentId);
      }
      nextVideo = pool[Math.floor(Math.random() * pool.length)];
      console.log(`[Shuffle] Current: ${currentId}, Pool size: ${pool.length}, Next: ${nextVideo ? nextVideo.video_id : 'null'}`);
    } else {
      // Sequential logic
      const currentId = (currentMusicVideoId || '').trim();
      const currentIndex = yukichat.playlist.findIndex(item => (item.video_id || '').trim() === currentId);
      const nextIndex = (currentIndex + 1) % yukichat.playlist.length;
      nextVideo = yukichat.playlist[nextIndex];
      console.log(`[Sequential] Current index: ${currentIndex}, Next: ${nextVideo ? nextVideo.video_id : 'null'}`);
    }
    
    if (nextVideo) {
      console.log(`Auto Play: ${yukichat.isShuffle ? 'Shuffle' : 'Sequential'} -> ${nextVideo.video_id}`);
      currentMusicVideoId = nextVideo.video_id; // Update locally immediately
      setGlobalVideo(nextVideo.video_id);
    }
  }

  // Playlist UI Management
  function renderPlaylist(playlist) {
    const listEl = document.getElementById('yukichat-playlist-items');
    if (!listEl) return;
    yukichat.playlist = playlist;

    const fingerprint = JSON.stringify(playlist) + currentMusicVideoId;
    if (yukichat.lastPlaylistFingerprint === fingerprint) return;
    yukichat.lastPlaylistFingerprint = fingerprint;

    listEl.innerHTML = playlist.map(item => {
      const isCurrent = item.video_id === currentMusicVideoId;
      return `
        <div class="playlist-item ${isCurrent ? 'is-current' : ''}">
          <div class="playlist-item-info">
            <i class="fa-solid ${isCurrent ? 'fa-volume-high' : 'fa-music'}"></i> ${escapeHTML(item.title)}
          </div>
          <div class="playlist-item-actions">
            <button class="playlist-play-btn" onclick="yukichatSelectPlaylistItem('${item.video_id}')" title="再生">
              <i class="fa-solid ${isCurrent ? 'fa-rotate-right' : 'fa-play'}"></i>
            </button>
            <button class="playlist-del-btn" onclick="yukichatRemoveFromPlaylist('${item.video_id}')" title="削除">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      `;
    }).join('') || '<p style="text-align:center; font-size: 0.8rem; opacity: 0.5;">プレイリストは空です</p>';
  }

  window.yukichatSelectPlaylistItem = async (videoId) => {
    if (!yukichat.isAdmin) return;
    try {
      await fetch('/api/yukichat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_video',
          videoId: videoId,
          id: yukichat.id,
          password: yukichat.password
        })
      });
      syncWithServer(true);
    } catch (e) { console.error("Select failed", e); }
  };

  window.yukichatRemoveFromPlaylist = async (videoId) => {
    if (!yukichat.isAdmin || !confirm("プレイリストから削除しますか？")) return;
    try {
      await fetch('/api/yukichat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'playlist_remove',
          videoId: videoId,
          id: yukichat.id,
          password: yukichat.password
        })
      });
      syncWithServer(true);
    } catch (e) { console.error("Remove failed", e); }
  };

  const playlistAddBtn = document.getElementById('playlist-add-btn');
  const playlistUrlInput = document.getElementById('playlist-url-input');
  if (playlistAddBtn && playlistUrlInput) {
    playlistAddBtn.onclick = async () => {
      const urlText = playlistUrlInput.value.trim();
      if (!urlText) return;
      const videoId = extractVideoId(urlText);
      if (!videoId) {
        alert("無効なURLまたは動画IDです");
        return;
      }

      let title = videoId;
      try {
        // Try to fetch title via oEmbed
        const fullUrl = urlText.startsWith('http') ? urlText : `https://www.youtube.com/watch?v=${videoId}`;
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(fullUrl)}&format=json`;
        const resOembed = await fetch(oembedUrl);
        if (resOembed.ok) {
          const odata = await resOembed.json();
          if (odata.title) title = odata.title;
        }
      } catch (e) { console.warn("Title fetch failed", e); }
      
      try {
        await fetch('/api/yukichat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'playlist_add',
            videoId: videoId,
            title: title,
            id: yukichat.id,
            password: yukichat.password
          })
        });
        playlistUrlInput.value = '';
        syncWithServer(true);
      } catch (e) { console.error("Add failed", e); }
    };
  }

  const shuffleBtn = document.getElementById('playlist-shuffle-btn');
  if (shuffleBtn) {
    const updateShuffleBtnUI = () => {
      shuffleBtn.classList.toggle('active', yukichat.isShuffle);
      shuffleBtn.innerHTML = yukichat.isShuffle ? '<i class="fa-solid fa-shuffle"></i> ランダム: ON' : '<i class="fa-solid fa-shuffle"></i> ランダム: OFF';
    };
    
    updateShuffleBtnUI();
    
    shuffleBtn.onclick = () => {
      yukichat.isShuffle = !yukichat.isShuffle;
      // When Shuffle is OFF, it automatically reverts to Sequential (default)
      localStorage.setItem('yukichat_shuffle', yukichat.isShuffle);
      updateShuffleBtnUI();
    };
  }
  
  loadYoutubeAPI();

  function startSync() {
    syncWithServer();
    yukichat.syncInterval = setInterval(() => syncWithServer(), 2000);
  }

  startSync();
  loadChatMembers();

})();
