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
    // { file: 'chibi_toromi.png', name: 'とろみ' } // Joined status voided
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

  // Initialize Active Count Display
  if (!activeCountEl && setupOverlay) {
    const countP = document.createElement('p');
    countP.id = 'yukichat-active-count';
    countP.style.cssText = 'color: #ff85a2; font-weight: bold; margin-bottom: 15px; font-size: 0.9rem;';
    countP.innerHTML = '現在の入室人数: <span id="active-count-num">--</span>人';
    const setupContent = setupOverlay.querySelector('.setup-content');
    if (setupContent) setupContent.insertBefore(countP, avatarList);
  }

  // Initialize Avatar List
  memberChibis.forEach(m => {
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

  if (nameInput) nameInput.value = yukichat.name;

  const exitRoom = async (isAuto = false) => {
    if (!yukichat.isActive) return;
    
    // Notify server to remove instantly
    try {
      await fetch('/api/yukichat', {
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
        const res = await fetch('/api/yukichat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: yukichat.id,
            name: yukichat.name,
            avatar: yukichat.avatar,
            x: yukichat.x,
            y: yukichat.y,
            msg: ''
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
      const res = await fetch('/api/yukichat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: yukichat.id,
          name: yukichat.name,
          avatar: yukichat.avatar,
          x: yukichat.x,
          y: yukichat.y,
          msg: rawText // Send original
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
        <div class="avatar-name-tag">${state.name}</div>
      `;
      stage.appendChild(el);
      yukichat.avatars[uid] = el;
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
      if (yukichat.isActive) {
        // Idle Check: Time out if no chat for 10 minutes
        if (Date.now() - yukichat.lastChatTs > 600000) {
          exitRoom(true); 
          return;
        }

        // Send position only if not just sent by submitMsg
        if (Date.now() - yukichat.msgTime > 2000) {
          await fetch('/api/yukichat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: yukichat.id,
              name: yukichat.name,
              avatar: yukichat.avatar,
              x: yukichat.x,
              y: yukichat.y,
              msg: '' // No message for routine sync
            })
          });
        }
      }

      // GET current world state
      const res = await fetch('/api/yukichat');
      if (res.ok) {
        const data = await res.json();
        
        const numSpan = document.getElementById('active-count-num');
        if (numSpan) numSpan.innerText = data.activeCount || 0;

        if (yukichat.isActive) {
          updateRemoteUsers(data.users);
          renderHistory(data.logs);
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
    
    // Check if logs changed by looking at the last message timestamp
    const lastMsg = logs[0];
    if (yukichat.lastLogTs === lastMsg?.ts) return;
    yukichat.lastLogTs = lastMsg?.ts;

    const isAtBottom = historyList.scrollHeight - historyList.clientHeight <= historyList.scrollTop + 20;

    historyList.innerHTML = logs.reverse().map(log => `
      <div class="history-item">
        <span class="log-name">${log.name}:</span>
        <span class="log-msg">${log.msg}</span>
      </div>
    `).join('');

    // Auto scroll if user was near bottom
    if (isAtBottom) {
      historyList.scrollTop = historyList.scrollHeight;
    }
  }

  function startSync() {
    syncWithServer();
    yukichat.syncInterval = setInterval(() => syncWithServer(), 2000);
  }

  startSync();

})();
