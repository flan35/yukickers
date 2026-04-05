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
    { file: 'chibi_michaaam.png', name: 'michaaam' }
  ];

  const stage = document.getElementById('yukichat-stage');
  const setupOverlay = document.getElementById('yukichat-setup');
  const activeCountEl = document.getElementById('yukichat-active-count');
  const avatarList = document.getElementById('yukichat-avatar-list');
  const nameInput = document.getElementById('yukichat-user-name');
  const enterBtn = document.getElementById('yukichat-enter-btn');
  const exitBtn = document.getElementById('yukichat-exit-btn');
  const chatInput = document.getElementById('yukichat-input');
  const sendBtn = document.getElementById('yukichat-send-btn');

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
      yukichat.isActive = true;
      
      renderAvatar(yukichat.id, {
        name: yukichat.name,
        avatar: yukichat.avatar,
        x: yukichat.x,
        y: yukichat.y,
        isLocal: true
      });

      await syncWithServer(true);
    };
  }

  // Exit Room
  if (exitBtn) {
    exitBtn.onclick = () => {
      yukichat.isActive = false;
      yukichat.initialLogsShown = false;
      
      // Clear all avatars from stage
      Object.keys(yukichat.avatars).forEach(uid => {
        if (yukichat.avatars[uid]) yukichat.avatars[uid].remove();
        delete yukichat.avatars[uid];
      });
      yukichat.users = {};

      // Show setup again
      setupOverlay.classList.add('active');
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

  // Maximum Strict Profanity Filter (Regex-based Phrases)
  function sanitizeMsg(text) {
    if (!text) return '';
    const ngWords = [
      /[死殺][し抜き]?[に]?[行いくくるきた]/g, /[死殺]す[ぞぜやろっ]/g, /[死殺][ねろ]/g, /ぶっ殺/g, /ぶち殺/g, /ブチ殺/g,
      /首[つ釣]る/g, /自殺[し]?[ろたよ]/g, /クタバレ/g, /くたばれ/g, /地獄/g, /呪い/g, /遺影/g,
      /殴[るりっ][てたぞぜ]/g, /蹴[るりっ][てたぞぜ]/g, /叩[くきい][てたぞぜ]/g, /[刺指][さし]?[すした]/g, /[埋う]め[るてた]/g,
      /[壊こわ]す/g, /ぶっ[壊こわ]す/g, /火[ををあつけ]/g, /爆破/g, /包丁/g, /ナイフ/g, /刺す/g,
      /ガイジ/g, /池沼/g, /片輪/g, /基地外/g, /きちがい/g, /気違い/g, /土人/g, /土方/g, /部落/g,
      /アホ/g, /あほ/g, /バカ/g, /ばか/g, /馬鹿/g, /カス/g, /かす/g, /クズ/g, /くず/g, /ゴミ/g, /ごみ/g, /クソ/g, /くそ/g, /糞/g,
      /キモい/g, /きもい/g, /しつけー/g, /ウザい/g, /うざい/g, /キショい/g, /きしょい/g, /ブス/g, /ぶす/g, /ハゲ/g, /デブ/g,
      /マンコ/g, /まんこ/g, /チンコ/g, /ちんこ/g, /クリトラ/g, /フェラ/g, /オナニー/g, /中出し/g, /なかがだし/g, /セックス/g, /淫乱/g, /ヤリマン/g, /レイプ/g, /強姦/g, /犯す/g,
      /消えろ/g, /きえろ/g, /いなくなれ/g, /邪魔/g, /不快/g, /しねよ/g
    ];
    const positiveWords = ['だいすき', 'らぶ', 'にこにこ', 'きらきら', 'はぴはぴ', '天才！', '最高に可愛い', 'しあわせ', 'ゆめかわいい', 'なかよし', '最高！', '世界一！', '尊い'];
    let sanitized = text;
    ngWords.forEach(pattern => {
      sanitized = sanitized.replace(pattern, () => {
         return positiveWords[Math.floor(Math.random() * positiveWords.length)];
      });
    });
    return sanitized;
  }

  // Chat Submission
  const submitMsg = () => {
    if (!yukichat.isActive) return;
    const rawText = chatInput.value.trim();
    if (!rawText) return;
    
    const text = sanitizeMsg(rawText);
    yukichat.msg = text;
    yukichat.msgTime = Date.now();
    chatInput.value = '';
    
    showBubble(yukichat.id, text);
    syncWithServer(true);
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
        await fetch('/api/yukichat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: yukichat.id,
            name: yukichat.name,
            avatar: yukichat.avatar,
            x: yukichat.x,
            y: yukichat.y,
            msg: yukichat.msg
          })
        });

        if (Date.now() - yukichat.msgTime > 3000) {
          yukichat.msg = '';
        }
      }

      const res = await fetch('/api/yukichat');
      if (res.ok) {
        const data = await res.json();
        
        const numSpan = document.getElementById('active-count-num');
        if (numSpan) numSpan.innerText = data.activeCount || 0;

        if (yukichat.isActive) {
          updateRemoteUsers(data.users);
          
          if (yukichat.isActive && !yukichat.initialLogsShown && data.logs && data.logs.length > 0) {
            yukichat.initialLogsShown = true;
            data.logs.reverse().forEach((log, i) => {
              const uid = Object.keys(data.users).find(key => data.users[key].name === log.name);
              if (uid && uid !== yukichat.id) {
                setTimeout(() => showBubble(uid, log.msg), i * 300);
              }
            });
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

  function startSync() {
    syncWithServer();
    yukichat.syncInterval = setInterval(() => syncWithServer(), 2000);
  }

  startSync();

})();
