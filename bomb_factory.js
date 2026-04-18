let state = {
    playing: false,
    score: 0,
    speed: 3,
    spawnRate: 3000, 
    lastPatternTime: 0,
    spawnQueue: [],  // 次に流す爆弾の予定リスト { time, type }
    bombs: [],
    gateDir: 'right', 
    level: 1,
    username: localStorage.getItem('bomb_factory_name') || '',
    userId: localStorage.getItem('bomb_factory_id') || 'u_' + Math.random().toString(36).substr(2, 9)
};

localStorage.setItem('bomb_factory_id', state.userId);

// DOM Elements
const bombLayer = document.getElementById('bomb-layer');
const scoreValue = document.getElementById('score-value');
const speedValue = document.getElementById('speed-value');
// 以前のsortingGate(棒)は削除済みなので参照しない
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const rankingModal = document.getElementById('ranking-modal');
const rankingList = document.getElementById('ranking-list');
const usernameInput = document.getElementById('username');

// Audio (Dummy)
const playSound = (type) => {};

// --- Initialization ---
usernameInput.value = state.username;

document.getElementById('btn-start').onclick = () => {
    state.username = usernameInput.value || '名無しちゃん';
    localStorage.setItem('bomb_factory_name', state.username);
    startGame();
};

document.getElementById('btn-restart').onclick = () => {
    startGame();
};

document.getElementById('btn-ranking-open').onclick = showRanking;
document.getElementById('btn-ranking-view').onclick = showRanking;
document.getElementById('btn-start-ranking').addEventListener('click', showRanking);
document.getElementById('btn-ranking-close').onclick = () => rankingModal.classList.remove('active');

// --- Input Handling ---
const toggleGate = () => {
    if (!state.playing) return;
    const arrow = document.getElementById('junction-arrow');
    state.gateDir = (state.gateDir === 'right') ? 'down' : 'right';
    
    if (state.gateDir === 'down') {
        if (arrow) {
            arrow.classList.remove('arrow-right');
            arrow.classList.add('arrow-down');
        }
    } else {
        if (arrow) {
            arrow.classList.remove('arrow-down');
            arrow.classList.add('arrow-right');
        }
    }
    playSound('switch');
};

window.onkeydown = (e) => {
    if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        toggleGate();
    }
};

document.getElementById('game-container').onclick = (e) => {
    if (state.playing && e.target.id !== 'btn-ranking-open') {
        toggleGate();
    }
};

// --- Waypoint System ---
// コンベアの経路を定義(比率)
function getWaypoints() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const offset = 30; // ベルト幅(60px)の半分
    
    // CSSのbottom: 18% = 画面上から82%の位置
    const bottomY = h * 0.82 - offset;
    // CSSのtop: 20% = 画面上から20%の位置
    const topY = h * 0.2 + offset;
    // CSSのleft: 17% = 左辺コンベアの中心
    const leftX = w * 0.17 + offset;

    return [
        { x: w * 0.9, y: bottomY },     // WP0: スタート(箱の中・ベルトの中心高さ)
        { x: leftX, y: bottomY },       // WP1: 左下の角
        { x: leftX, y: topY },          // WP2: 左上の角
        { x: w * 0.5, y: topY }         // WP3: 分岐点(中央)
    ];
}

function getFinalDestinations(gateDir) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const offset = 30; // ベルトの中心
    const topY = h * 0.2 + offset;
    const machineCenterY = 90; // Machine top:20px + center offset:70px
    
    if (gateDir === 'right') {
        // Red Machineへ (中央 -> 右上 -> 上)
        return [ 
            { x: w * 0.8, y: topY },           // WP4: 右上の角 (中心)
            { x: w * 0.8, y: machineCenterY } // WP5: Red Machineの吸い込み口
        ];
    } else {
        // Black Machineへ (中央 -> 上)
        return [ { x: w * 0.5, y: machineCenterY } ];
    }
}

// --- Game Logic ---
function startGame() {
    state.playing = true;
    state.score = 0;
    state.speed = 3.5; // 少し速めからスタート
    state.spawnRate = 2500; // 塊と塊の間隔を短縮
    state.lastPatternTime = 0;
    state.spawnQueue = [];
    state.bombs = [];
    state.level = 1;
    state.gateDir = 'right';
    
    scoreValue.innerText = '0';
    speedValue.innerText = 'Lv. 1';
    
    const arrow = document.getElementById('junction-arrow');
    if (arrow) {
        arrow.className = 'arrow-right';
    }
    
    bombLayer.innerHTML = '';
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    
    requestAnimationFrame(gameLoop);
}

function checkSpawning(timestamp) {
    // キューに入っている爆弾を生成
    if (state.spawnQueue.length > 0) {
        if (timestamp >= state.spawnQueue[0].time) {
            spawnBomb(state.spawnQueue[0].type);
            state.spawnQueue.shift();
        }
    }

    // 次のパターン（塊）を予約
    if (timestamp - state.lastPatternTime > state.spawnRate && state.spawnQueue.length === 0) {
        generatePattern(timestamp);
        state.lastPatternTime = timestamp;
    }
}

function generatePattern(now) {
    const maxBurst = 3 + Math.floor(state.level / 2);
    const count = Math.floor(Math.random() * maxBurst) + 1;
    
    // スピードが上がっても爆弾の間隔(距離)を一定に保つため、
    // burstGapをスピードに応じて短縮する
    // 基本距離150px / (speed * 60fps) ≃ 秒数
    const burstGap = Math.max(150, 600 / (state.speed / 3.5)); 

    for (let i = 0; i < count; i++) {
        const type = Math.random() > 0.5 ? 'black' : 'red';
        state.spawnQueue.push({
            time: now + (i * burstGap),
            type: type
        });
    }
}

function gameLoop(timestamp) {
    if (!state.playing) return;

    checkSpawning(timestamp);

    const w = window.innerWidth;
    const h = window.innerHeight;

    // 後ろからループ回すことで削除によるインデックスずれを防ぐ
    for (let i = state.bombs.length - 1; i >= 0; i--) {
        const bomb = state.bombs[i];
        if (bomb.absorbed) continue;

        const target = bomb.waypoints[bomb.wpIndex];
        if (!target) {
            if (!bomb.absorbed) {
                bomb.absorbed = true;
                absorbBomb(bomb); // インデックスを渡さない
            }
            continue;
        }

        const dx = target.x - bomb.x;
        const dy = target.y - bomb.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist < state.speed) {
            bomb.x = target.x;
            bomb.y = target.y;
            bomb.wpIndex++;

            if (bomb.wpIndex === 4) {
                const finalWps = getFinalDestinations(state.gateDir);
                bomb.waypoints = bomb.waypoints.concat(finalWps);
                bomb.finalGateDirAtJunction = state.gateDir;
            }
        } else {
            bomb.x += (dx / dist) * state.speed;
            bomb.y += (dy / dist) * state.speed;
        }

        bomb.el.style.transform = `translate(-50%, -50%)`;
        bomb.el.style.left = bomb.x + 'px';
        bomb.el.style.top = bomb.y + 'px';
    }

    if (state.score > 0 && state.score % 10 === 0 && state.level <= Math.floor(state.score / 10)) {
        levelUp();
    }

    requestAnimationFrame(gameLoop);
}

function spawnBomb(forcedType) {
    const type = forcedType || (Math.random() > 0.5 ? 'black' : 'red');
    const initialWps = getWaypoints();
    const bomb = {
        id: Math.random().toString(36).substr(2, 9),
        type: type,
        x: initialWps[0].x,
        y: initialWps[0].y,
        waypoints: initialWps,
        wpIndex: 1,
        absorbed: false,
        finalGateDirAtJunction: null,
        el: document.createElement('div')
    };
    
    bomb.el.className = `bomb bomb-${type}`;
    bomb.el.style.left = bomb.x + 'px';
    bomb.el.style.top = bomb.y + 'px';
    bombLayer.appendChild(bomb.el);
    state.bombs.push(bomb);
}

function absorbBomb(bomb) {
    bomb.el.style.transition = 'all 0.3s ease-in';
    bomb.el.style.transform = 'translate(-50%, -50%) scale(0) rotate(180deg)';
    bomb.el.style.opacity = '0';

    setTimeout(() => {
        const success = (bomb.type === 'black' && bomb.finalGateDirAtJunction === 'down') || 
                        (bomb.type === 'red' && bomb.finalGateDirAtJunction === 'right');
        
        if (success) {
            state.score++;
            scoreValue.innerText = state.score;
            const machineId = bomb.finalGateDirAtJunction === 'down' ? 'machine-black' : 'machine-red';
            const machine = document.getElementById(machineId);
            if (machine) {
                machine.style.filter = 'brightness(1.5)';
                setTimeout(() => machine.style.filter = '', 100);
            }
        } else {
            gameOver();
        }
        removeBomb(bomb); // オブジェクトで削除指示
    }, 300);
}

function removeBomb(bombToRemove) {
    if (bombToRemove.el) bombToRemove.el.remove();
    state.bombs = state.bombs.filter(b => b.id !== bombToRemove.id);
}

function levelUp() {
    state.level++;
    state.speed += 0.5; // スピードアップを強化
    state.spawnRate = Math.max(800, state.spawnRate - 200); // 間隔短縮を強化
    speedValue.innerText = 'Lv. ' + state.level;
}

function gameOver() {
    state.playing = false;
    document.getElementById('last-score').innerText = state.score;
    gameOverScreen.classList.add('active');
    submitScore(state.score);
}

async function submitScore(score) {
    try {
        await fetch('/api/bomb_factory/ranking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: state.userId, name: state.username, score: score })
        });
    } catch (e) {}
}

async function showRanking() {
    rankingModal.classList.add('active');
    rankingList.innerHTML = '<p>読み込み中...</p>';
    try {
        const res = await fetch('/api/bomb_factory/ranking');
        const data = await res.json();
        rankingList.innerHTML = '';
        if (!data.ranking || data.ranking.length === 0) {
            rankingList.innerHTML = '<p>まだデータがありません</p>';
            return;
        }
        data.ranking.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'rank-item';
            div.innerHTML = `<span>${index + 1}. ${item.name}</span><span>${item.score.toLocaleString()} pts</span>`;
            rankingList.appendChild(div);
        });
    } catch (e) { rankingList.innerHTML = '<p>エラーが発生しました</p>'; }
}
