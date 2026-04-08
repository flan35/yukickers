const API_URL = '/api/zookeeper/match';
const GRID_SIZE = 8;
const ROUND_TIME = 30;
const INITIAL_HP = 100;

const CHARACTERS = [
    { id: 'inoshishi', img: 'chibi_inoshishi.png', name: 'いのしし', type: 'atk' },
    { id: 'kariko', img: 'chibi_kariko.png', name: 'かりこ', type: 'atk' },
    { id: 'michaaam', img: 'chibi_michaaam.png', name: 'みちゃーむ', type: 'atk' },
    { id: 'ponchan', img: 'chibi_ponchan.png', name: 'ぽんちゃん', type: 'atk' },
    { id: 'miki', img: 'chibi_miki.png', name: 'みき', type: 'def' },
    { id: 'nodazouri', img: 'chibi_nodazouri.png', name: 'のだぞうり', type: 'def' },
    { id: 'toromi', img: 'chibi_toromi.png', name: 'とろみ', type: 'def' },
    { id: 'yuki', img: 'chibi_yuki.png', name: 'ゆき', type: 'special' }
];

let state = {
    userId: localStorage.getItem('yukickers_puzzle_id') || 'u_' + Math.random().toString(36).substr(2, 9),
    username: localStorage.getItem('yukickers_puzzle_name') || '',
    avatar: localStorage.getItem('yukickers_puzzle_avatar') || 'chibi_yuki.png',
    matchId: null,
    isP1: true,
    isCpu: false,
    opponent: null,
    hp: INITIAL_HP,
    opponentHp: INITIAL_HP,
    atk: 0,
    def: 0,
    special: 0,
    cpuAtk: 0,
    cpuDef: 0,
    round: 1,
    phase: 'waiting',
    timer: ROUND_TIME,
    board: [],
    selectedTile: null,
    isProcessing: false,
    maxCombo: 0,
    combo: 0
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
    
    // CPU opponent setup
    const cpuChar = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
    state.opponent = { name: cpuChar.name + ' (CPU)', avatar: cpuChar.img };
    state.matchId = 'cpu_' + Date.now();

    lobby.classList.remove('active');
    game.classList.add('active');
    
    // Header
    document.getElementById('p1Name').innerText = state.username;
    document.getElementById('p1Avatar').src = state.avatar;
    document.getElementById('p2Name').innerText = state.opponent.name;
    document.getElementById('p2Avatar').src = state.opponent.avatar;

    initBoard();
    startRound();
};

async function joinQueue() {
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'join', userId: state.userId, name: state.username, avatar: state.avatar })
        });
        const data = await res.json();
        
        if (data.status === 'matched') {
            startMatch(data.matchId);
        } else {
            // Poll for match
            const poll = setInterval(async () => {
                const res = await fetch(`${API_URL}?userId=${state.userId}`);
                const data = await res.json();
                if (data.status === 'matched') {
                    clearInterval(poll);
                    startMatch(data.matchId);
                }
            }, 2000);
        }
    } catch (e) {
        console.error(e);
        btnJoin.disabled = false;
    }
}

async function startMatch(matchId) {
    state.matchId = matchId;
    const res = await fetch(`${API_URL}?matchId=${matchId}`);
    const match = await res.json();
    
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
}

// --- Game Logic ---
function initBoard() {
    puzzleBoard.innerHTML = '';
    state.board = [];
    for (let r = 0; r < GRID_SIZE; r++) {
        state.board[r] = [];
        for (let c = 0; c < GRID_SIZE; c++) {
            let type;
            do {
                type = Math.floor(Math.random() * CHARACTERS.length);
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
    const char = CHARACTERS[typeIndex];
    const div = document.createElement('div');
    div.className = 'tile';
    div.dataset.r = r;
    div.dataset.c = c;
    div.style.gridRow = r + 1;
    div.style.gridColumn = c + 1;
    div.innerHTML = `<div class="tile-inner"><img src="${char.img}" alt="" pointer-events="none"></div>`;
    div.onclick = (e) => {
        // datasetから最新の座標を取得
        const targetR = parseInt(div.dataset.r);
        const targetC = parseInt(div.dataset.c);
        onTileClick(targetR, targetC);
    };
    return div;
}

function onTileClick(r, c) {
    if (state.isProcessing || state.phase !== 'puzzle') return;

    const clickedTile = state.board[r][c];
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
    state.isProcessing = true;
    t1.el.classList.remove('selected');
    
    // Physical swap animations
    const r1 = t1.r, c1 = t1.c, r2 = t2.r, c2 = t2.c;
    t1.el.style.gridRow = r2 + 1; t1.el.style.gridColumn = c2 + 1;
    t2.el.style.gridRow = r1 + 1; t2.el.style.gridColumn = c1 + 1;
    
    // Logical swap
    state.board[r1][c1] = t2; state.board[r2][c2] = t1;
    t1.r = r2; t1.c = c2; t2.r = r1; t2.c = c1;

    await wait(200);

    if (!isReverting) {
        const matches = findMatches();
        if (matches.length > 0) {
            state.selectedTile = null;
            await processMatches(matches);
        } else {
            await swapTiles(t1, t2, true);
            state.selectedTile = null;
            state.isProcessing = false;
        }
    } else {
        state.isProcessing = false;
    }
}

function findMatches() {
    let matches = [];
    // Horiz
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE - 2; c++) {
            let type = state.board[r][c].type;
            if (type === state.board[r][c+1].type && type === state.board[r][c+2].type) {
                let match = [state.board[r][c], state.board[r][c+1], state.board[r][c+2]];
                let next = c + 3;
                while (next < GRID_SIZE && state.board[r][next].type === type) {
                    match.push(state.board[r][next]);
                    next++;
                }
                matches.push(match);
                c = next - 1;
            }
        }
    }
    // Vert
    for (let c = 0; c < GRID_SIZE; c++) {
        for (let r = 0; r < GRID_SIZE - 2; r++) {
            let type = state.board[r][c].type;
            if (type === state.board[r+1][c].type && type === state.board[r+2][c].type) {
                let match = [state.board[r][c], state.board[r+1][c], state.board[r+2][c]];
                let next = r + 3;
                while (next < GRID_SIZE && state.board[next][c].type === type) {
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

    let matchedTiles = new Set();
    matchGroups.forEach(group => {
        const type = CHARACTERS[group[0].type].type;
        const count = group.length;
        
        // Stats
        if (type === 'atk') state.atk += count;
        else if (type === 'def') state.def += count;
        else if (type === 'special') { state.atk += count; state.def += count; }

        group.forEach(t => matchedTiles.add(t));
    });

    updateStatsDisplay();

    // Remove tiles
    matchedTiles.forEach(t => t.el.classList.add('match-anim'));
    await wait(300);
    matchedTiles.forEach(t => {
        t.el.remove();
        state.board[t.r][t.c] = null;
    });

    // Fall
    await fallTiles();

    // Check cascades
    const newMatches = findMatches();
    if (newMatches.length > 0) {
        await processMatches(newMatches);
    } else {
        state.combo = 0;
        state.isProcessing = false;
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
                state.board[r + emptySpaces][c] = tile;
                state.board[r][c] = null;
                tile.r = r + emptySpaces;
                tile.el.dataset.r = tile.r; // IMPORTANT: Update dataset coordinate
                tile.el.style.gridRow = tile.r + 1;
            }
        }
        // Fill new
        for (let i = 0; i < emptySpaces; i++) {
            const r = emptySpaces - 1 - i;
            const type = Math.floor(Math.random() * CHARACTERS.length);
            const tile = createTileElement(r, c, type); // Fix: use final r, not -1
            tile.style.gridRow = (r + 1); 
            state.board[r][c] = { r, c, type, el: tile };
            puzzleBoard.appendChild(tile);
            // Anim from top
            tile.style.transform = `translateY(-${(emptySpaces + 1) * 100}%)`;
            setTimeout(() => {
                tile.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                tile.style.transform = '';
            }, 10);
        }
    }
    await wait(250); // Slightly faster
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
            // Gradually gain points based on round
            const power = state.round * 0.5;
            if (Math.random() < 0.3) state.cpuAtk += Math.floor(Math.random() * 3 + power);
            if (Math.random() < 0.3) state.cpuDef += Math.floor(Math.random() * 2 + power);
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

function updateStatsDisplay() {
    document.getElementById('p1Atk').innerText = state.atk;
    document.getElementById('p1Def').innerText = state.def;
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
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                action: 'sync', 
                matchId: state.matchId, 
                p1_hp: Math.max(0, state.hp - p1Dmg), // This part was slightly wrong in previous logic, refined here
                p2_hp: Math.max(0, state.opponentHp - p2Dmg),
                round: state.round + 1,
                resetPoints: true
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

    if (state.hp <= 0 || state.opponentHp <= 0 || state.round >= 10) {
        finishGame();
    } else {
        state.round++;
        battleOverlay.classList.add('hidden');
        startRound();
    }
}

function updateHpBars(match) {
    if (!match) return;
    
    // Always show local player on the left (p1-stats self)
    // and opponent on the right (p2-stats opponent)
    // The HTML has p1-stats self and p2-stats opponent
    // Let's map them correctly
    const myHp = state.isP1 ? match.p1_hp : match.p2_hp;
    const opHp = state.isP1 ? match.p2_hp : match.p1_hp;

    document.getElementById('p1HpBar').style.width = myHp + '%';
    document.getElementById('p1HpText').innerText = `${myHp} / 100`;
    document.getElementById('p2HpBar').style.width = opHp + '%';
    document.getElementById('p2HpText').innerText = `${opHp} / 100`;
}

function finishGame() {
    game.classList.remove('active');
    result.classList.add('active');
    
    const win = state.hp > state.opponentHp;
    document.getElementById('resultTitle').innerText = win ? 'YOU WIN!' : (state.hp === state.opponentHp ? 'DRAW' : 'LOSE...');
    document.getElementById('finalHp').innerText = state.hp;
    document.getElementById('maxCombo').innerText = state.maxCombo;
}

// Helpers
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
