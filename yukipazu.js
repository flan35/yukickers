const API_URL = '/api/yukipazu/match';
const GRID_SIZE = 8;
const ROUND_TIME = 30;
const MAX_PLAYER_HP = 100; 
const STAGE_CPU_HP = [0, 10, 20, 50, 100, 500]; // Stage 1-5

const CHARACTERS = [
    { id: 'inoshishi', img: 'chibi_inoshishi.png', name: 'いのしし', type: 'atk' },
    { id: 'kariko', img: 'chibi_kariko.png', name: 'かりこ', type: 'atk' },
    { id: 'michaaam', img: 'chibi_michaaam.png', name: 'みちゃーむ', type: 'atk' },
    { id: 'ponchan', img: 'chibi_ponchan.png', name: 'ぽんちゃん', type: 'atk' },
    { id: 'miki', img: 'chibi_miki.png', name: 'みき', type: 'def' },
    { id: 'nodazouri', img: 'chibi_nodazouri.png', name: 'のだぞうり', type: 'def' },
    { id: 'toromi', img: 'chibi_toromi.png', name: 'とろみ', type: 'def' },
    { id: 'yuki', img: 'chibi_yuki.png', name: 'ゆき', type: 'special' },
    { id: 'boss', img: 'yukickersR.png', name: 'BOSS: ユキッカーズR', type: 'special' }
];

let state = {
    userId: localStorage.getItem('yukickers_puzzle_id') || 'u_' + Math.random().toString(36).substr(2, 9),
    username: localStorage.getItem('yukickers_puzzle_name') || '',
    avatar: localStorage.getItem('yukickers_puzzle_avatar') || 'chibi_yuki.png',
    matchId: null,
    isP1: true,
    isCpu: false,
    opponent: null,
    hp: MAX_PLAYER_HP,
    opponentHp: MAX_PLAYER_HP,
    atk: 0,
    def: 0,
    special: 0,
    cpuAtk: 0,
    cpuDef: 0,
    round: 1,
    phase: 'waiting',
    timer: ROUND_TIME,
    board: [],
    activeCharacters: [], // 使用する6人
    selectedTile: null,
    isProcessing: false,
    maxCombo: 0,
    combo: 0,
    lastFallEndTime: 0, 
    comboGraceTime: 3000,
    cpuStage: 0, // 0:非CPU戦, 1-5:ステージ
    totalScore: 0,
    stageScore: 0
};

localStorage.setItem('yukickers_puzzle_id', state.userId);

// --- UI Elements ---
const lobby = document.getElementById('lobby');
const game = document.getElementById('game');
const result = document.getElementById('result');
const avatarList = document.getElementById('avatarList');
const btnJoin = document.getElementById('btnJoin');
const btnCpu = document.getElementById('btnCpu');
const usernameInput = document.getElementById('username');
const puzzleBoard = document.getElementById('puzzleBoard');
const battleOverlay = document.getElementById('battleOverlay');
const battleText = document.getElementById('battleText');

// Init Avatar Selector
CHARACTERS.forEach(char => {
    if (char.id === 'boss') return; // ボスは選択肢に出さない
    
    const div = document.createElement('div');
    div.className = 'avatar-item' + (state.avatar === char.img ? ' selected' : '');
    div.innerHTML = `<img src="${char.img}" alt="${char.name}">`;
    div.onclick = () => {
        document.querySelectorAll('.avatar-item').forEach(el => el.classList.remove('selected'));
        div.classList.add('selected');
        state.avatar = char.img;
    };
    avatarList.appendChild(div);
});

usernameInput.value = state.username;

// --- Matchmaking ---
btnJoin.onclick = async () => {
    state.isCpu = false;
    state.username = usernameInput.value || '名無し';
    localStorage.setItem('yukickers_puzzle_name', state.username);
    localStorage.setItem('yukickers_puzzle_avatar', state.avatar);

    btnJoin.disabled = true;
    btnCpu.disabled = true;
    document.getElementById('matchingStatus').classList.remove('hidden');

    await joinQueue();
};

btnCpu.onclick = async () => {
    state.isCpu = true;
    state.isP1 = true;
    state.username = usernameInput.value || '名無し';
    state.matchId = 'cpu_' + Date.now();
    
    // 選出
    setupActiveCharacters();

    // CPUステージ開始 (UI更新・画面遷移は内部で実行)
    startCpuStage(1);
};

async function startCpuStage(stage) {
    state.isCpu = true; // 念のためセット
    state.cpuStage = stage;
    state.round = 1;
    state.cpuAtk = 0;
    state.cpuDef = 0;
    state.opponentHp = STAGE_CPU_HP[stage];
    state.maxOpponentHp = STAGE_CPU_HP[stage]; 
    
    if (stage === 1) {
        state.hp = MAX_PLAYER_HP;
        state.totalScore = 0;
        setupActiveCharacters(); // 駒の選出
    }

    // 対戦相手の設定
    let cpuChar;
    const normals = CHARACTERS.filter(c => c.id !== 'boss');
    if (stage === 5) {
        cpuChar = CHARACTERS.find(c => c.id === 'boss') || CHARACTERS[0];
        game.classList.add('boss-battle'); 
    } else {
        cpuChar = normals[Math.floor(Math.random() * normals.length)];
        game.classList.remove('boss-battle');
    }

    state.opponent = { 
        name: (cpuChar.name || 'CPU') + (stage === 5 ? '' : ' (CPU)'), 
        avatar: cpuChar.img || 'chibi_yuki.png'
    };

    // UI更新 (アバター等)
    const p1Container = document.getElementById('p1Avatar');
    const p2Container = document.getElementById('p2Avatar');
    if (p1Container) p1Container.src = state.avatar;
    if (p2Container) p2Container.src = state.opponent.avatar;
    document.getElementById('p1Name').innerText = state.username;
    document.getElementById('p2Name').innerText = state.opponent.name;
    
    updateHpBars(); // HP表示の同期
    updateStageDisplay();
    
    if (stage === 1) {
        lobby.classList.remove('active');
        game.classList.add('active');
        initBoard();
    }
    
    startRound();
}

function updateStageDisplay() {
    const stageInfo = document.getElementById('stageInfo');
    if (stageInfo) {
        stageInfo.innerText = state.isCpu ? `STAGE ${state.cpuStage}/5` : 'MATCH';
    }
    const totalScoreEl = document.getElementById('totalScore');
    if (totalScoreEl) {
        totalScoreEl.innerText = state.totalScore.toLocaleString();
    }
}

function setupActiveCharacters() {
    const yuki = CHARACTERS.find(c => c.id === 'yuki');
    const others = CHARACTERS.filter(c => c.id !== 'yuki' && c.id !== 'boss');
    
    // Shuffle others
    const shuffled = others.sort(() => Math.random() - 0.5);
    
    // Final 6 members (Yuki + 5 others)
    state.activeCharacters = [yuki, ...shuffled.slice(0, 5)];
    
    // Shuffle the active list to randomize index
    state.activeCharacters.sort(() => Math.random() - 0.5);
}

let queueInterval = null;

async function fetchQueueCount() {
    try {
        // ロビー画面が表示されている時だけ取得
        if (!lobby.classList.contains('active')) {
            if (queueInterval) clearInterval(queueInterval);
            queueInterval = null;
            return;
        }

        const res = await fetch(API_URL);
        const data = await res.json();
        const count = data.queueCount || 0;
        document.getElementById('queueCountDisplay').innerText = `待機中: ${count}人`;
        
        // 1人以上なら20秒ごとに更新、0人なら停止
        if (count > 0) {
            if (!queueInterval) {
                queueInterval = setInterval(fetchQueueCount, 20000);
            }
        } else {
            if (queueInterval) {
                clearInterval(queueInterval);
                queueInterval = null;
            }
        }
    } catch (e) {
        console.error("Failed to fetch queue count", e);
    }
}

// 起動時に実行
fetchQueueCount();

async function joinQueue() {
    console.log("Attempting to join queue...", { userId: state.userId, name: state.username });
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'join', userId: state.userId, name: state.username, avatar: state.avatar })
        });
        const data = await res.json();
        console.log("Join Queue Response:", data);
        
        if (data.status === 'matched') {
            console.log("Match found immediately!", data.matchId);
            startMatch(data.matchId);
        } else {
            console.log("Waiting for opponent... starting poll.");
            // Poll for match
            const poll = setInterval(async () => {
                try {
                    const res = await fetch(`${API_URL}?userId=${state.userId}`);
                    const data = await res.json();
                    if (data.status === 'matched') {
                        console.log("Match found via poll!", data.matchId);
                        clearInterval(poll);
                        startMatch(data.matchId);
                    }
                } catch (pe) {
                    console.error("Poll error:", pe);
                }
            }, 2000);
        }
    } catch (e) {
        console.error("Join Queue Error:", e);
        alert("マッチングサーバーに接続できませんでした。");
        btnJoin.disabled = false;
        btnCpu.disabled = false;
        document.getElementById('matchingStatus').classList.add('hidden');
    }
}

async function startMatch(matchId) {
    console.log("Starting match:", matchId);
    setupActiveCharacters();
    state.matchId = matchId;
    try {
        const res = await fetch(`${API_URL}?matchId=${matchId}`);
        const match = await res.json();
        console.log("Match Data loaded:", match);
        
        state.isP1 = match.p1_id === state.userId;
        state.opponent = state.isP1 ? { name: match.p2_name, avatar: match.p2_avatar } : { name: match.p1_name, avatar: match.p1_avatar };
        
        // Update Header
        document.getElementById('p1Name').innerText = state.username;
        document.getElementById('p1Avatar').src = state.avatar;
        document.getElementById('p2Name').innerText = state.opponent.name;
        document.getElementById('p2Avatar').src = state.opponent.avatar;

        lobby.classList.remove('active');
        game.classList.add('active');
        
        initBoard();
        startRound();
    } catch (e) {
        console.error("Start Match Error:", e);
        alert("対戦データの読み込みに失敗しました。");
        location.reload();
    }
}

// --- Game Logic ---
function initBoard() {
    puzzleBoard.innerHTML = '<div id="comboDisplay" class="combo-display">0 COMBO</div>';
    state.board = [];
    for (let r = 0; r < GRID_SIZE; r++) {
        state.board[r] = [];
        for (let c = 0; c < GRID_SIZE; c++) {
            let type;
            do {
                type = Math.floor(Math.random() * state.activeCharacters.length);
            } while (
                (c >= 2 && state.board[r][c-1].type === type && state.board[r][c-2].type === type) ||
                (r >= 2 && state.board[r-1][c].type === type && state.board[r-2][c].type === type)
            );
            
            const tile = createTileElement(r, c, type);
            state.board[r][c] = { r, c, type, el: tile };
            puzzleBoard.appendChild(tile);
        }
    }
}

function createTileElement(r, c, typeIndex) {
    const char = state.activeCharacters[typeIndex];
    const div = document.createElement('div');
    div.className = 'tile';
    div.dataset.r = r;
    div.dataset.c = c;
    div.style.gridRow = r + 1;
    div.style.gridColumn = c + 1;
    div.style.userSelect = 'none';
    div.style.touchAction = 'none';
    div.style.transition = 'transform 0.1s, grid-row 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    div.innerHTML = `<div class="tile-inner"><img src="${char.img}" alt="" pointer-events="none" draggable="false"></div>`;
    div.onclick = (e) => {
        const targetR = parseInt(div.dataset.r);
        const targetC = parseInt(div.dataset.c);
        onTileClick(targetR, targetC);
    };
    div.oncontextmenu = (e) => e.preventDefault();
    return div;
}

function onTileClick(r, c) {
    if (state.phase !== 'puzzle') return;

    const clickedTile = state.board[r][c];
    if (!clickedTile || clickedTile.isDead) return;

    if (!state.selectedTile) {
        state.selectedTile = clickedTile;
        clickedTile.el.classList.add('selected');
    } else {
        const dR = Math.abs(state.selectedTile.r - r);
        const dC = Math.abs(state.selectedTile.c - c);

        if ((dR === 1 && dC === 0) || (dR === 0 && dC === 1)) {
            swapTiles(state.selectedTile, clickedTile);
        } else {
            state.selectedTile.el.classList.remove('selected');
            state.selectedTile = clickedTile;
            clickedTile.el.classList.add('selected');
        }
    }
}

async function swapTiles(t1, t2, isReverting = false) {
    t1.el.classList.remove('selected');
    
    const r1 = t1.r, c1 = t1.c, r2 = t2.r, c2 = t2.c;
    t1.el.dataset.r = r2; t1.el.dataset.c = c2;
    t2.el.dataset.r = r1; t2.el.dataset.c = c1;
    
    t1.el.style.gridRow = r2 + 1; t1.el.style.gridColumn = c2 + 1;
    t2.el.style.gridRow = r1 + 1; t2.el.style.gridColumn = c1 + 1;
    
    state.board[r1][c1] = t2; state.board[r2][c2] = t1;
    t1.r = r2; t1.c = c2; t2.r = r1; t2.c = c1;

    await wait(200);

    if (!isReverting) {
        const matches = findMatches();
        if (matches.length > 0) {
            state.selectedTile = null;
            const now = Date.now();
            if (state.lastFallEndTime > 0 && now - state.lastFallEndTime < state.comboGraceTime) {
            } else if (state.lastFallEndTime > 0) {
                state.combo = 0;
            }
            await processMatches(matches);
        } else {
            await swapTiles(t1, t2, true);
            state.selectedTile = null;
        }
    }
}

function findMatches() {
    let matches = [];
    const getType = (r, c) => {
        if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return null;
        const t = state.board[r][c];
        return (t && !t.isDead) ? t.type : null;
    };

    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE - 2; c++) {
            let type = getType(r, c);
            if (type !== null && type === getType(r, c+1) && type === getType(r, c+2)) {
                let match = [state.board[r][c], state.board[r][c+1], state.board[r][c+2]];
                let next = c + 3;
                while (next < GRID_SIZE && getType(r, next) === type) {
                    match.push(state.board[r][next]);
                    next++;
                }
                matches.push(match);
                c = next - 1;
            }
        }
    }
    for (let c = 0; c < GRID_SIZE; c++) {
        for (let r = 0; r < GRID_SIZE - 2; r++) {
            let type = getType(r, c);
            if (type !== null && type === getType(r+1, c) && type === getType(r+2, c)) {
                let match = [state.board[r][c], state.board[r+1][c], state.board[r+2][c]];
                let next = r + 3;
                while (next < GRID_SIZE && getType(next, c) === type) {
                    match.push(state.board[next][c]);
                    next++;
                }
                matches.push(match);
                r = next - 1;
            }
        }
    }
    return matches;
}

async function processMatches(matchGroups) {
    state.combo++;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;
    
    // 消去が発生した瞬間に猶予タイマーをリセット（延長）する
    state.lastFallEndTime = Date.now();
    resetComboTimer();

    let matchedTiles = new Set();
    matchGroups.forEach(group => {
        const charInfo = state.activeCharacters[group[0].type];
        const type = charInfo.type;
        const count = group.length;
        
        const bonus = 1 + (state.combo * 0.1); 
        
        // --- 新しいスコア計算 ---
        let baseScore = count === 3 ? 100 : (count === 4 ? 150 : 200);
        if (count > 5) baseScore += (count - 5) * 50; // 6個目以降は+50 bonus
        
        const gainedScore = Math.floor(baseScore * (1 + (state.combo - 1) * 0.1));
        state.totalScore += gainedScore;

        if (type === 'atk') state.atk += Math.floor(count * bonus);
        else if (type === 'def') state.def += Math.floor(count * bonus);
        else if (type === 'special') { 
            state.atk += Math.floor(count * bonus); 
            state.def += Math.floor(count * bonus); 
        }

        group.forEach(t => {
            t.isDead = true;
            matchedTiles.add(t);
        });
    });

    updateStatsDisplay();

    matchedTiles.forEach(t => t.el.classList.add('match-anim'));
    await wait(600);
    matchedTiles.forEach(t => {
        t.el.remove();
        if (state.board[t.r][t.c] === t) {
            state.board[t.r][t.c] = null;
        }
    });

    await fallTiles();

    const newMatches = findMatches();
    if (newMatches.length > 0) {
        await processMatches(newMatches);
    } else {
        // Cascade finished, record end time
        state.lastFallEndTime = Date.now();
        resetComboTimer();
        if (!state.isCpu) syncScore();
    }
}

async function fallTiles() {
    for (let c = 0; c < GRID_SIZE; c++) {
        let emptySpaces = 0;
        for (let r = GRID_SIZE - 1; r >= 0; r--) {
            if (state.board[r][c] === null) {
                emptySpaces++;
            } else if (emptySpaces > 0) {
                const tile = state.board[r][c];
                const dist = emptySpaces;
                state.board[r + dist][c] = tile;
                state.board[r][c] = null;
                tile.r = r + dist;
                tile.el.dataset.r = tile.r; 
                tile.el.dataset.c = tile.c; 
                
                // 見た目だけ上にオフセットさせてから下ろす
                tile.el.style.gridRow = tile.r + 1;
                tile.el.style.transform = `translateY(-${dist * 100}%)`;
                tile.el.style.transition = 'none';

                setTimeout(() => {
                    tile.el.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                    tile.el.style.transform = 'translateY(0)';
                }, 10);
            }
        }
        for (let i = 0; i < emptySpaces; i++) {
            const r = emptySpaces - 1 - i;
            const type = Math.floor(Math.random() * state.activeCharacters.length);
            const tile = createTileElement(r, c, type); 
            tile.style.gridRow = (r + 1); 
            state.board[r][c] = { r, c, type, el: tile };
            puzzleBoard.appendChild(tile);
            tile.style.transform = `translateY(-${(emptySpaces + 1) * 100}%)`;
            setTimeout(() => {
                tile.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                tile.style.transform = '';
            }, 10);
        }
    }
    await wait(500);
}

// --- Round & Battle ---
function startRound() {
    state.timer = ROUND_TIME;
    state.phase = 'puzzle';
    state.atk = 0;
    state.def = 0;
    state.special = 0;
    updateStatsDisplay();
    
    document.getElementById('phaseTimer').innerText = state.timer;
    document.getElementById('roundLabel').innerText = `ROUND ${state.round}`;
    
    if (state.isCpu) {
        // CPU "Thinking" simulation
        const cpuInterval = setInterval(() => {
            if (state.phase !== 'puzzle') return clearInterval(cpuInterval);
            // ステージに応じて強化
            const stageBonus = state.cpuStage * 0.8; 
            const freq = 0.2 + (state.cpuStage * 0.1); // ステージ5なら0.7の確率で毎秒加算
            
            if (Math.random() < freq) state.cpuAtk += Math.floor(Math.random() * 3 + stageBonus);
            if (Math.random() < freq) state.cpuDef += Math.floor(Math.random() * 2 + stageBonus);
            
            document.getElementById('p2Atk').innerText = state.cpuAtk;
            document.getElementById('p2Def').innerText = state.cpuDef;
        }, 1000);
    }

    const interval = setInterval(() => {
        state.timer--;
        document.getElementById('phaseTimer').innerText = state.timer;
        if (state.timer <= 0) {
            clearInterval(interval);
            endPuzzlePhase();
        }
    }, 1000);
}

async function endPuzzlePhase() {
    state.phase = 'battle';
    battleOverlay.classList.remove('hidden');
    battleText.innerText = 'BATTLE!';
    
    await wait(1500);
    
    // Sync final stats and wait for opponent
    if (!state.isCpu) {
        await syncScore();
        await waitForBattleResults();
    } else {
        runBattleCalculation();
    }
}

async function syncScore() {
    await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ 
            action: 'update', 
            matchId: state.matchId, 
            userId: state.userId, 
            atk: state.atk, 
            def: state.def, 
            special: state.special 
        })
    });
}

function resetComboTimer() {
    clearTimeout(state.comboTimeout);
    state.comboTimeout = setTimeout(() => {
        const now = Date.now();
        if (now - state.lastFallEndTime >= state.comboGraceTime) {
            state.combo = 0;
            updateStatsDisplay();
        }
    }, state.comboGraceTime);
}

function updateStatsDisplay() {
    document.getElementById('p1Atk').innerText = state.atk;
    document.getElementById('p1Def').innerText = state.def;
    
    // スコアとステージ情報の更新を追加
    updateStageDisplay();

    // コンボ表示の更新
    const comboEl = document.getElementById('comboDisplay');
    if (state.combo > 1) {
        comboEl.innerText = `${state.combo} COMBO`;
        comboEl.classList.remove('active');
        void comboEl.offsetWidth; // リスタートアニメーション
        comboEl.classList.add('active');
    } else {
        comboEl.classList.remove('active');
    }
}

async function waitForBattleResults() {
    // Both players poll until opponent is ready (phase change or updated ts)
    const poll = setInterval(async () => {
        const res = await fetch(`${API_URL}?matchId=${state.matchId}`);
        const match = await res.json();
        
        const opAtk = state.isP1 ? match.p2_atk : match.p1_atk;
        const opDef = state.isP1 ? match.p2_def : match.p1_def;
        
        // Show opponent stats
        document.getElementById('p2Atk').innerText = opAtk;
        document.getElementById('p2Def').innerText = opDef;

        // If both have updated recently, run battle logic
        // For simplicity: after 3 seconds of polling, just run it 
        // (In a real game, you'd check a "p2_ready" flag or timestamp)
    }, 1000);

    await wait(3000);
    clearInterval(poll);
    runBattleCalculation();
}

async function runBattleCalculation() {
    let p1Atk, p1Def, p2Atk, p2Def;

    if (!state.isCpu) {
        const res = await fetch(`${API_URL}?matchId=${state.matchId}`);
        const match = await res.json();
        p1Atk = match.p1_atk; p1Def = match.p1_def;
        p2Atk = match.p2_atk; p2Def = match.p2_def;
    } else {
        p1Atk = state.atk; p1Def = state.def;
        p2Atk = state.cpuAtk; p2Def = state.cpuDef;
    }

    // Damage = Atk - Def (min 1 if Atk > 0)
    let p1Dmg = Math.max(0, p2Atk - p1Def);
    let p2Dmg = Math.max(0, p1Atk - p2Def);
    
    if (p2Atk > 0 && p1Dmg === 0) p1Dmg = 1;
    if (p1Atk > 0 && p2Dmg === 0) p2Dmg = 1;

    // Apply HP locally
    if (state.isCpu) {
        state.hp = Math.max(0, state.hp - p1Dmg);
        state.opponentHp = Math.max(0, state.opponentHp - p2Dmg);
    } else {
        // ... handled by sync
    }

    // Sync HP back (Only if PvP)
    if (!state.isCpu && state.isP1) {
        const isFinished = state.hp - p1Dmg <= 0 || state.opponentHp - p2Dmg <= 0 || state.round >= 10;
        let winner_id = null;
        if (isFinished) {
            const finalP1 = state.hp - p1Dmg;
            const finalP2 = state.opponentHp - p2Dmg;
            if (finalP1 > finalP2) winner_id = state.userId; // Assuming p1 is self
            else if (finalP1 < finalP2) {
                // We need opponent ID. It is in the match object from server.
                const res = await fetch(`${API_URL}?matchId=${state.matchId}`);
                const m = await res.json();
                winner_id = m.p2_id;
            }
        }

        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                action: 'sync', 
                matchId: state.matchId, 
                p1_hp: Math.max(0, state.hp - p1Dmg),
                p2_hp: Math.max(0, state.opponentHp - p2Dmg),
                round: state.round + 1,
                resetPoints: true,
                winner_id: winner_id
            })
        });
    }

    if (state.isCpu) {
        const mockMatch = { p1_hp: state.hp, p2_hp: state.opponentHp };
        updateHpBars(mockMatch);
        state.cpuAtk = 0; state.cpuDef = 0; // Reset CPU points
    } else {
        const res = await fetch(`${API_URL}?matchId=${state.matchId}`);
        const updatedMatch = await res.json();
        updateHpBars(updatedMatch);
    }
    battleText.innerText = `-${p1Dmg}/${p2Dmg} DMG`;
    await wait(2000);

    if (state.hp <= 0 || state.round >= 10) {
        finishGame();
    } else if (state.opponentHp <= 0) {
        // ステージクリア
        if (state.isCpu) {
            if (state.cpuStage < 5) {
                battleText.innerText = 'STAGE CLEAR!';
                await wait(2000);
                battleOverlay.classList.add('hidden');
                startCpuStage(state.cpuStage + 1);
            } else {
                battleText.innerText = 'ALL CLEAR!!';
                await wait(2500);
                finishGame();
            }
        } else {
            finishGame();
        }
    } else {
        state.round++;
        battleOverlay.classList.add('hidden');
        startRound();
    }
}

function updateHpBars(match) {
    if (!match && !state.isCpu) return;
    
    let myHp, opHp, myMax, opMax;
    
    if (state.isCpu) {
        myHp = state.hp;
        opHp = state.opponentHp;
        myMax = MAX_PLAYER_HP;
        opMax = state.maxOpponentHp;
    } else {
        myHp = state.isP1 ? match.p1_hp : match.p2_hp;
        opHp = state.isP1 ? match.p2_hp : match.p1_hp;
        myMax = 100; // PvPは100固定
        opMax = 100;
    }

    document.getElementById('p1HpBar').style.width = (myHp / myMax * 100) + '%';
    document.getElementById('p1HpText').innerText = `${myHp} / ${myMax}`;
    document.getElementById('p2HpBar').style.width = (opHp / opMax * 100) + '%';
    document.getElementById('p2HpText').innerText = `${opHp} / ${opMax}`;
}

function finishGame() {
    game.classList.remove('active');
    result.classList.add('active');
    
    const win = state.hp > state.opponentHp;
    document.getElementById('resultTitle').innerText = (win || (state.isCpu && state.cpuStage === 5 && state.opponentHp <= 0)) ? 'ALL CLEAR!' : (state.hp === state.opponentHp ? 'DRAW' : 'LOSE...');
    document.getElementById('finalHp').innerText = state.hp;
    document.getElementById('maxCombo').innerText = state.maxCombo;
    document.getElementById('finalScoreDisplay').innerText = state.totalScore.toLocaleString();

    // 結果の記録
    if (state.isCpu) {
        fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'record_cpu',
                userId: state.userId,
                name: state.username,
                avatar: state.avatar,
                score: state.totalScore,
                maxCombo: state.maxCombo
            })
        });
    }
}

/* --- Ranking Logic --- */
let rankingData = null;
let currentTab = 'pvp';

const btnRanking = document.getElementById('btnRanking');
const rankingModal = document.getElementById('rankingModal');
const rankingList = document.getElementById('rankingList');
const tabPvp = document.getElementById('tabPvp');
const tabCpu = document.getElementById('tabCpu');
const btnCloseRanking = document.getElementById('btnCloseRanking');

btnRanking.onclick = () => {
    rankingModal.classList.remove('hidden');
    fetchRanking();
};

btnCloseRanking.onclick = () => rankingModal.classList.add('hidden');

tabPvp.onclick = () => {
    currentTab = 'pvp';
    tabPvp.classList.add('active');
    tabCpu.classList.remove('active');
    renderRanking();
};

tabCpu.onclick = () => {
    currentTab = 'cpu';
    tabCpu.classList.add('active');
    tabPvp.classList.remove('active');
    renderRanking();
};

async function fetchRanking() {
    rankingList.innerHTML = '<div class="loading">読み込み中...</div>';
    try {
        const res = await fetch(`${API_URL}?action=ranking`);
        rankingData = await res.json();
        renderRanking();
    } catch (e) {
        rankingList.innerHTML = '<div class="error">読み込み失敗</div>';
    }
}

function renderRanking() {
    if (!rankingData) return;
    const list = currentTab === 'pvp' ? rankingData.pvp : rankingData.cpu;
    
    if (!list || list.length === 0) {
        rankingList.innerHTML = '<div style="padding:20px; text-align:center; opacity:0.5;">データがありません</div>';
        return;
    }

    rankingList.innerHTML = list.map((item, index) => `
        <div class="ranking-item">
            <div class="rank-num">${index + 1}</div>
            <img src="${item.avatar}" class="rank-avatar">
            <div class="rank-info">
                <span class="rank-name">${item.name}</span>
                <span class="rank-score">${currentTab === 'pvp' ? '勝利数' : 'ハイスコア'}</span>
            </div>
            <div class="rank-value">${currentTab === 'pvp' ? (item.wins || 0) : (item.score || 0)}</div>
        </div>
    `).join('');
}

// Helpers
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
