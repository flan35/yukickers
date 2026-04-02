document.addEventListener('DOMContentLoaded', () => {
  // Member Data for reference
  const memberData = [
    { username: 'yuki_0121', name: 'ユキちゃん', image: 'yuki.jpg' },
    { username: 'nodazourip', name: '野田草履', image: 'nodazouri.jpg' },
    { username: 'inosisi0909', name: 'イノシシ', image: 'inoshishi.jpg' },
    { username: '04miki05', name: 'ミキ', image: 'miki.jpg' },
    { username: 'kariko2525', name: 'カリフラワー狩子', image: 'kariko.jpg' },
    { username: 'ponchan_2525', name: 'ぽんちゃん', image: 'ponchan.jpg' },
    { username: 'michaaam', name: 'michaaam', image: 'mi.jpg' }
  ];

  // Intro Overlay Logic (Session-based)
  const introOverlay = document.getElementById('intro-overlay');
  const hasSeenIntro = sessionStorage.getItem('yukickers_intro_seen');

  if (hasSeenIntro) {
    // Already seen in this session, hide immediately
    if (introOverlay) introOverlay.style.display = 'none';
    document.body.classList.remove('is-loading');
    document.body.classList.add('content-ready');
  } else {
    // First time in this session, play 3s animation
    setTimeout(() => {
      if (introOverlay) {
        introOverlay.classList.add('fade-out');
        setTimeout(() => {
          introOverlay.style.display = 'none';
          document.body.classList.remove('is-loading');
          document.body.classList.add('content-ready');
          sessionStorage.setItem('yukickers_intro_seen', 'true');
          // Trigger initial reveal
          reveal();
        }, 1000); // Wait for fade-out transition
      }
    }, 2000); // 2 seconds cute intro
  }

  // Sticky Navbar
  const navbar = document.getElementById('navbar');
  
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // Visitor Counter Logic
  async function initVisitorCounter() {
    const todayEl = document.getElementById('visitor-count-today');
    const yesterdayEl = document.getElementById('visitor-count-yesterday');
    const totalEl = document.getElementById('visitor-count-total');
    
    if (!todayEl || !yesterdayEl || !totalEl) return;

    const hasCounted = sessionStorage.getItem('yukickers_counted');
    const action = hasCounted ? 'get' : 'increment';

    try {
      const response = await fetch(`/api/counter?action=${action}`);
      if (response.ok) {
        const data = await response.json();
        if (data.total !== undefined) {
          todayEl.textContent = data.today.toLocaleString();
          yesterdayEl.textContent = data.yesterday.toLocaleString();
          totalEl.textContent = data.total.toLocaleString();
          if (action === 'increment') {
            sessionStorage.setItem('yukickers_counted', 'true');
          }
        }
      }
    } catch (err) {
      console.warn('Counter fetch failed', err);
    }
  }

  initVisitorCounter();

  // Mobile Menu Toggle
  const mobileToggle = document.getElementById('mobile-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  let menuOpen = false;

  mobileToggle.addEventListener('click', () => {
    menuOpen = !menuOpen;
    if (menuOpen) {
      mobileMenu.classList.add('active');
      mobileToggle.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    } else {
      mobileMenu.classList.remove('active');
      mobileToggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
    }
  });

  // Handle Unified SPA Navigation
  const navLinks = document.querySelectorAll('a[data-nav="true"]');
  const pageSections = document.querySelectorAll('.page-section');

  // Handle initial URL hash
  const initialHash = window.location.hash.substring(1);
  if (initialHash && document.getElementById(initialHash) && initialHash !== 'home') {
    pageSections.forEach(sec => sec.classList.remove('active'));
    document.getElementById(initialHash).classList.add('active');
  }

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href').substring(1);
      
      // Page Turn Effect
      // Page Fade Effect
      createParticles(e.clientX, e.clientY);
      
      const targetSec = document.getElementById(targetId);
      const currentActive = document.querySelector('.page-section.active');
      
      if (!targetSec || currentActive === targetSec) return;

      if (currentActive) {
        currentActive.classList.remove('active');
        currentActive.classList.add('fade-out');
      }

      // Delay for the old section to fade out before switching
      setTimeout(() => {
        // Hide all sections and remove fade-out
        pageSections.forEach(sec => {
          sec.classList.remove('active');
          sec.classList.remove('fade-out');
        });
        
        // Show target section
        targetSec.classList.add('active');
        
        // Update URL hash
        if (targetId === 'home') {
          history.pushState(null, null, window.location.pathname);
        } else {
          history.pushState(null, null, '#' + targetId);
        }

        // Close mobile menu if open
        mobileMenu.classList.remove('active');
        mobileToggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
        menuOpen = false;

        // Reset scroll position
        window.scrollTo(0, 0);

        // Trigger animations for newly visible section
        setTimeout(reveal, 50);
      }, 400);
    });
  });


  // Particle Creation Function
  function createParticles(x, y) {
    const icons = ['fa-heart', 'fa-star', 'fa-sparkles', 'fa-circle'];
    const colors = ['#ff85a2', '#ffd700', '#ffb7c5', '#ffffff'];
    
    for (let i = 0; i < 15; i++) {
      const particle = document.createElement('i');
      const icon = icons[Math.floor(Math.random() * icons.length)];
      particle.className = `fa-solid ${icon} click-particle`;
      
      // Random direction and properties
      const angle = Math.random() * Math.PI * 2;
      const velocity = 50 + Math.random() * 150;
      const tx = Math.cos(angle) * velocity;
      const ty = Math.sin(angle) * velocity;
      const tr = (Math.random() - 0.5) * 500; // Rotation
      const ts = 0.5 + Math.random() * 1.5; // Scale
      
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.color = colors[Math.floor(Math.random() * colors.length)];
      particle.style.setProperty('--x', `${tx}px`);
      particle.style.setProperty('--y', `${ty}px`);
      particle.style.setProperty('--r', `${tr}deg`);
      particle.style.setProperty('--s', ts);
      
      document.body.appendChild(particle);
      
      // Cleanup
      setTimeout(() => {
        particle.remove();
      }, 800);
    }
  }

  // Reveal Animations on Scroll
  function reveal() {
    const reveals = document.querySelectorAll('.reveal');
    for (let i = 0; i < reveals.length; i++) {
      const windowHeight = window.innerHeight;
      const elementTop = reveals[i].getBoundingClientRect().top;
      const elementVisible = 100;
      
      if (elementTop < windowHeight - elementVisible) {
        reveals[i].classList.add('active');
      }
    }
  }

  // Add scroll event listener
  window.addEventListener('scroll', reveal);
  
  // Trigger once on load to show elements already in view
  reveal();

  // ==========================================================================
  // Pachislot Style Raid Lottery Logic
  // ==========================================================================
  const lotteryModal = document.getElementById('lottery-modal');
  const openLotteryBtn = document.getElementById('open-lottery');
  const closeModalBtn = document.getElementById('close-modal');
  const memberSelectionList = document.getElementById('member-selection-list');
  const startShuffleBtn = document.getElementById('start-shuffle-btn');
  const retryLotteryBtn = document.getElementById('retry-lottery-btn');
  
  const views = {
    settings: document.getElementById('lottery-view-settings'),
    shuffle: document.getElementById('lottery-view-shuffle'),
    result: document.getElementById('lottery-view-result')
  };

  const reelTracks = [
    document.getElementById('reel-1'),
    document.getElementById('reel-2'),
    document.getElementById('reel-3')
  ];
  const stopButtons = [
    document.getElementById('stop-reel-1'),
    document.getElementById('stop-reel-2'),
    document.getElementById('stop-reel-3')
  ];
  const winLamps = document.querySelectorAll('.win-lamp');
  const chancePanel = document.querySelector('.chance-panel');
  const winnerImg = document.getElementById('winner-img');
  const winnerName = document.getElementById('winner-name');
  const winnerLink = document.getElementById('winner-link');

  let activeReels = [false, false, false];
  let reelAnimations = [null, null, null];
  let lotteryWinner = null;
  let currentPool = [];
  let isFullRotating = false;

  // Open Modal
  if (openLotteryBtn) {
    openLotteryBtn.addEventListener('click', () => {
      lotteryModal.classList.add('active');
      showView('settings');
      generateMemberSelection('member-selection-list');
      resetSlotMachine();
    });
  }

  // Close Modal
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      lotteryModal.classList.remove('active');
      stopAllReels();
    });
  }

  if (retryLotteryBtn) {
    retryLotteryBtn.addEventListener('click', () => {
      showView('settings');
      resetSlotMachine();
    });
  }

  function showView(viewName) {
    Object.keys(views).forEach(key => {
      if (views[key]) views[key].classList.toggle('active', key === viewName);
    });
  }

  function resetSlotMachine() {
    activeReels = [false, false, false];
    winLamps.forEach(l => l.classList.remove('active'));
    chancePanel.classList.remove('active');
    stopButtons.forEach(b => b.disabled = true);
    isFullRotating = false;
    const container = document.querySelector('.slot-machine-container');
    if (container) container.classList.remove('is-fever');
  }

  function generateMemberSelection(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const memberCards = document.querySelectorAll('.profile-card[data-kick]');
    container.innerHTML = '';
    
    memberCards.forEach(card => {
      const name = card.querySelector('h3').textContent;
      const id = card.getAttribute('data-kick');
      const img = card.querySelector('.card-image').src;
      const isLive = card.classList.contains('is-live');
      
      const item = document.createElement('div');
      item.className = 'select-item';
      // Unique ID for checkboxes to avoid conflict between modals
      const checkId = `${containerId}-check-${id}`;
      item.innerHTML = `
        <input type="checkbox" id="${checkId}" data-id="${id}" data-name="${name}" data-img="${img}" data-img-full="${img}" data-link="${card.querySelector('.card-link').href}" ${isLive ? 'checked' : ''}>
        <label for="${checkId}" class="select-label">
          <img src="${img}" alt="${name}" class="select-avatar">
          <span class="select-name">${name}</span>
          ${isLive ? '<span class="live-indicator-dot"></span>' : ''}
        </label>
      `;
      container.appendChild(item);
    });
  }

  if (startShuffleBtn) {
    startShuffleBtn.addEventListener('click', () => {
      const checkedInputs = Array.from(memberSelectionList.querySelectorAll('input:checked'));
      if (checkedInputs.length === 0) {
        alert('メンバーを1人以上選択してください！');
        return;
      }
      
      currentPool = checkedInputs.map(input => ({
        name: input.getAttribute('data-name'),
        img: input.getAttribute('data-img-full'),
        link: input.getAttribute('data-link')
      }));

      lotteryWinner = currentPool[Math.floor(Math.random() * currentPool.length)];
      startSlotMachine(currentPool);
    });
  }

  function startSlotMachine(members) {
    showView('shuffle');
    chancePanel.classList.add('active');
    
    const displayCount = 20;
    reelTracks.forEach((track, index) => {
      track.innerHTML = '';
      for (let i = 0; i < displayCount; i++) {
        const member = members[i % members.length];
        const div = document.createElement('div');
        div.className = 'reel-item';
        div.innerHTML = `<img src="${member.img}" alt="${member.name}"><span>${member.name}</span>`;
        track.appendChild(div);
      }
      // Set the stopping point to the winner
      const stopTarget = track.children[displayCount - 1];
      stopTarget.innerHTML = `<img src="${lotteryWinner.img}" alt="${lotteryWinner.name}"><span>${lotteryWinner.name}</span>`;
      
      spinReel(index);
    });

    // Enable stop buttons after a short delay
    setTimeout(() => {
      stopButtons.forEach(btn => btn.disabled = false);
    }, 500);
  }

  function spinReel(index) {
    const track = reelTracks[index];
    const itemHeight = 160;
    const totalItems = track.children.length;
    let pos = 0;
    const speed = 20 + Math.random() * 10; // Varied speed

    activeReels[index] = true;

    function animate() {
      if (!activeReels[index]) return;
      pos += speed;
      if (pos >= (totalItems - 1) * itemHeight) {
        pos = 0;
      }
      track.style.transform = `translateY(-${pos}px)`;
      reelAnimations[index] = requestAnimationFrame(animate);
    }
    reelAnimations[index] = requestAnimationFrame(animate);
  }

  stopButtons.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      stopReel(index);
    });
  });

  function stopReel(index) {
    if (!activeReels[index]) return;
    activeReels[index] = false;
    cancelAnimationFrame(reelAnimations[index]);
    stopButtons[index].disabled = true;

    const track = reelTracks[index];
    const itemHeight = 160;
    const totalItems = track.children.length;
    const finalPos = (totalItems - 1) * itemHeight;

    // Smooth snap to target
    track.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    track.style.transform = `translateY(-${finalPos}px)`;

    // Check if all stopped
    if (activeReels.every(r => r === false)) {
      // 25% Chance for Full Rotation (Pachislot style surprise)
      if (!isFullRotating && Math.random() < 0.25) {
        triggerFullRotation();
      } else {
        isFullRotating = false;
        handleWin();
      }
    }
  }

  function triggerFullRotation() {
    isFullRotating = true;
    const container = document.querySelector('.slot-machine-container');
    container.classList.add('is-fever');

    // Start all reels again FIRST
    setTimeout(() => {
      reelTracks.forEach((_, i) => spinReel(i));
      
      // Update the winner WHILE spinning so it's not visible
      setTimeout(() => {
        // Pick a DIFFERENT winner if possible
        let newWinner = lotteryWinner;
        if (currentPool.length > 1) {
          while (newWinner === lotteryWinner) {
            newWinner = currentPool[Math.floor(Math.random() * currentPool.length)];
          }
        }
        lotteryWinner = newWinner;

        // Update the stop targets on tracks for the new winner
        reelTracks.forEach(track => {
          const stopTarget = track.children[track.children.length - 1];
          stopTarget.innerHTML = `<img src="${lotteryWinner.img}" alt="${lotteryWinner.name}"><span>${lotteryWinner.name}</span>`;
        });
      }, 200);

      // Stop all after a few seconds of crazy rotation
      setTimeout(() => {
        container.classList.remove('is-fever');
        stopAllReels();
      }, 2500);
    }, 500);
  }

  function handleWin() {
    winLamps.forEach(l => l.classList.add('active'));
    setTimeout(() => {
      winnerImg.src = lotteryWinner.img;
      winnerName.textContent = lotteryWinner.name;
      winnerLink.href = lotteryWinner.link;
      showView('result');
    }, 1000);
  }

  function stopAllReels() {
    activeReels.forEach((_, i) => stopReel(i));
  }

  // ==========================================================================
  // Yukickers Pachinko Logic (Physical Board + LCD Production)
  // ==========================================================================
  
  let pachinkoParticipants = [];
  let pachinkoDirector = null;
  let pachinkoBoard = null;

  const pachinkoModal = document.getElementById('pachinko-modal');
  const openPachinkoBtn = document.getElementById('open-pachinko');
  const closePachinkoModalBtn = document.getElementById('close-pachinko-modal');
  const pachinkoToBoardBtn = document.getElementById('pachinko-to-board-btn');
  const retryPachinkoBtn = document.getElementById('retry-pachinko-btn');

  const pachinkoViews = {
    settings: document.getElementById('pachinko-view-settings'),
    play: document.getElementById('pachinko-view-play'),
    result: document.getElementById('pachinko-view-result')
  };

  function switchPachinkoView(viewName) {
    Object.values(pachinkoViews).forEach(v => v.classList.remove('active'));
    pachinkoViews[viewName].classList.add('active');
  }

  if (openPachinkoBtn) {
    openPachinkoBtn.addEventListener('click', () => {
      pachinkoModal.classList.add('active');
      setupPachinko();
    });
  }

  if (closePachinkoModalBtn) {
    closePachinkoModalBtn.addEventListener('click', () => {
      pachinkoModal.classList.remove('active');
      if (pachinkoBoard) pachinkoBoard.stop();
    });
  }

  function setupPachinko() {
    switchPachinkoView('settings');
    generateMemberSelection('pachinko-member-selection-list');
    if (pachinkoBoard) { pachinkoBoard.stop(); pachinkoBoard = null; }
    pachinkoDirector = null;
  }

  if (pachinkoToBoardBtn) {
    pachinkoToBoardBtn.addEventListener('click', () => {
      const checkedInputs = Array.from(document.querySelectorAll('#pachinko-member-selection-list input:checked'));
      if (checkedInputs.length < 3) {
        alert("3人以上のメンバーを選んでください！");
        return;
      }

      pachinkoParticipants = checkedInputs.map(input => ({
        username: input.getAttribute('data-id'),
        name: input.getAttribute('data-name'),
        image: input.getAttribute('data-img')
      }));

      switchPachinkoView('play');
      
      setTimeout(() => {
        pachinkoDirector = new PachinkoDirector(pachinkoParticipants);
        const canvas = document.getElementById('pachinko-board-canvas');
        pachinkoBoard = new PachinkoBoard(canvas, pachinkoDirector);
        pachinkoDirector.board = pachinkoBoard;
        pachinkoBoard.start();
      }, 300);
    });
  }

  if (retryPachinkoBtn) {
    retryPachinkoBtn.addEventListener('click', () => setupPachinko());
  }

  // ========= PachinkoBoard (Physical Simulation) =========
  class PachinkoBoard {
    constructor(canvas, director) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.director = director;
      this.running = false;
      this.balls = [];
      this.pins = [];
      this.launchInterval = null;
      this.ballCount = 500;
      this.ballCountEl = document.getElementById('pachinko-balls');
      this.launchBtn = document.getElementById('pachinko-launch-btn');

      // Board dimensions
      this.resize();

      // LCD zone MUST be defined before buildPins
      this.lcdZone = {
        x: this.w * 0.2,
        y: this.h * 0.25,
        w: this.w * 0.6,
        h: this.h * 0.42
      };

      // Heso (winning pocket) position - center bottom of board
      this.heso = {
        x: this.w / 2,
        y: this.h * 0.88,
        w: 34, // Increased from 28 to 34
        h: 14  // Slightly deeper for better detection
      };

      // Out zone
      this.outY = this.h - 5;

      // Build pin field (after lcdZone and heso are set)
      this.buildPins();

      this.bindLaunchButton();
      this.updateBallDisplay();
    }

    resize() {
      const wrapper = this.canvas.parentElement;
      let w = wrapper.offsetWidth || wrapper.clientWidth || 460;
      let h = wrapper.offsetHeight || wrapper.clientHeight || Math.round(w * 4 / 3);
      if (w < 10) w = 460;
      if (h < 10) h = 613;
      this.w = w;
      this.h = h;
      this.canvas.width = w;
      this.canvas.height = h;
    }

    buildPins() {
      this.pins = [];
      const pinR = 3;
      const spacingX = 22;
      const spacingY = 20;
      const startY = 30;
      const endY = this.h * 0.92;
      
      for (let y = startY; y < endY; y += spacingY) {
        const row = Math.floor((y - startY) / spacingY);
        const offset = row % 2 === 0 ? 0 : spacingX / 2;
        
        for (let x = 15 + offset; x < this.w - 10; x += spacingX) {
          // Skip pins inside LCD zone - kept clear for visibility
          if (this.isInLCDZone(x, y)) continue;
          
          // Skip pins right at heso position for channel (Widened for easier entry)
          const hesoX = this.w / 2;
          const hesoY = this.h * 0.88;
          if (Math.abs(x - hesoX) < 26 && Math.abs(y - hesoY) < 35) continue; 

          this.pins.push({ x, y, r: pinR });
        }
      }

      // Add guide pins near heso to funnel balls (Hakama style)
      const hy = this.h * 0.84;
      const hx = this.w / 2;
      // Bottom funnel
      this.pins.push({ x: hx - 22, y: hy + 5, r: pinR }); 
      this.pins.push({ x: hx + 22, y: hy + 5, r: pinR });
      // Mid funnel
      this.pins.push({ x: hx - 28, y: hy - 15, r: pinR });
      this.pins.push({ x: hx + 28, y: hy - 15, r: pinR });
      // Upper wide funnel
      this.pins.push({ x: hx - 35, y: hy - 40, r: pinR });
      this.pins.push({ x: hx + 35, y: hy - 40, r: pinR });
      
      // Bonus: Add some guiding pins from LCD edges to center
      this.pins.push({ x: this.w * 0.2, y: this.h * 0.7, r: pinR });
      this.pins.push({ x: this.w * 0.8, y: this.h * 0.7, r: pinR });
    }

    isInLCDZone(x, y) {
      const z = this.lcdZone;
      return x > z.x && x < z.x + z.w && y > z.y && y < z.y + z.h;
    }

    bindLaunchButton() {
      if (!this.launchBtn) return;

      const startLaunch = () => {
        if (this.launchInterval) return;
        this.launchBall();
        this.launchInterval = setInterval(() => this.launchBall(), 400);
      };

      const stopLaunch = () => {
        if (this.launchInterval) {
          clearInterval(this.launchInterval);
          this.launchInterval = null;
        }
      };

      // Mouse
      this.launchBtn.addEventListener('mousedown', startLaunch);
      this.launchBtn.addEventListener('mouseup', stopLaunch);
      this.launchBtn.addEventListener('mouseleave', stopLaunch);
      // Touch
      this.launchBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startLaunch(); });
      this.launchBtn.addEventListener('touchend', stopLaunch);
      this.launchBtn.addEventListener('touchcancel', stopLaunch);
    }

    launchBall() {
      if (this.ballCount <= 0) return;
      this.ballCount--;
      this.updateBallDisplay();

      const ball = {
        x: 25 + Math.random() * 10,
        y: 10,
        vx: 2.5 + Math.random() * 2,
        vy: 0,
        r: 5,
        active: true
      };
      this.balls.push(ball);
    }

    updateBallDisplay() {
      if (this.ballCountEl) this.ballCountEl.textContent = this.ballCount;
    }

    start() {
      this.running = true;
      this.loop();
    }

    stop() {
      this.running = false;
      if (this.launchInterval) {
        clearInterval(this.launchInterval);
        this.launchInterval = null;
      }
    }

    loop() {
      if (!this.running) return;
      requestAnimationFrame(() => this.loop());
      this.update();
      this.draw();
    }

    update() {
      const gravity = 0.18;
      const friction = 0.998;
      const ballR = 5;

      for (let i = this.balls.length - 1; i >= 0; i--) {
        const b = this.balls[i];
        if (!b.active) { this.balls.splice(i, 1); continue; }

        // Gravity
        b.vy += gravity;
        b.vx *= friction;
        b.x += b.vx;
        b.y += b.vy;

        // Wall bounce
        if (b.x < ballR) { b.x = ballR; b.vx = Math.abs(b.vx) * 0.6; }
        if (b.x > this.w - ballR) { b.x = this.w - ballR; b.vx = -Math.abs(b.vx) * 0.6; }

        // Pin collisions
        for (const pin of this.pins) {
          const dx = b.x - pin.x;
          const dy = b.y - pin.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = ballR + pin.r;
          if (dist < minDist && dist > 0) {
            const nx = dx / dist;
            const ny = dy / dist;
            b.x = pin.x + nx * minDist;
            b.y = pin.y + ny * minDist;
            // Reflect velocity
            const dot = b.vx * nx + b.vy * ny;
            b.vx -= 1.5 * dot * nx;
            b.vy -= 1.5 * dot * ny;
            // Add randomness
            b.vx += (Math.random() - 0.5) * 1.2;
            b.vy *= 0.7;
          }
        }

        // LCD zone deflection REMOVED - balls now pass through the center

        // Heso check (winning pocket)
        const h = this.heso;
        if (Math.abs(b.x - h.x) < h.w / 2 && Math.abs(b.y - h.y) < h.h) {
          b.active = false;
          this.onHesoHit();
          continue;
        }

        // Out zone
        if (b.y > this.outY) {
          b.active = false;
        }
      }
    }

    onHesoHit() {
      // Reward balls
      this.ballCount += 3; // Changed from 10 to 3 as requested
      this.updateBallDisplay();

      // Trigger LCD production with Hold (Stock) logic
      if (this.director) {
        this.director.addHold();
      }
    }

    draw() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.w, this.h);

      // Background - Set to transparent so LCD behind it is visible
      ctx.clearRect(0, 0, this.w, this.h);

      // Draw pins
      for (const pin of this.pins) {
        ctx.beginPath();
        ctx.arc(pin.x, pin.y, pin.r, 0, Math.PI * 2);
        ctx.fillStyle = '#c0c0c0';
        ctx.fill();
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Draw LCD zone border (glow)
      const z = this.lcdZone;
      ctx.strokeStyle = 'rgba(83, 52, 131, 0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(z.x, z.y, z.w, z.h);

      // Draw Heso
      const h = this.heso;
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(h.x - h.w / 2, h.y - h.h / 2, h.w, h.h);
      ctx.strokeStyle = '#ffaa00';
      ctx.lineWidth = 2;
      ctx.strokeRect(h.x - h.w / 2, h.y - h.h / 2, h.w, h.h);
      // Heso label
      ctx.fillStyle = '#000';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ヘソ', h.x, h.y);

      // Draw out zone
      ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
      ctx.fillRect(0, this.outY, this.w, this.h - this.outY);

      // Draw balls
      for (const b of this.balls) {
        if (!b.active) continue;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = '#e8e8e8';
        ctx.fill();
        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 1;
        ctx.stroke();
        // Shine
        ctx.beginPath();
        ctx.arc(b.x - 1.5, b.y - 1.5, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fill();
      }
    }

    addBalls(count) {
      this.ballCount += count;
      this.updateBallDisplay();
    }
  }

  // ========= PachinkoDirector =========
  class PachinkoDirector {
    constructor(participants) {
      this.participants = participants;
      this.spinCount = 0;
      this.isSpinning = false;
      this.jackpotProb = 1 / 20;

      this.lcdArea = document.getElementById('pachinko-lcd-area');
      this.prodText = document.getElementById('pachinko-production-text');
      this.spinCountEl = document.getElementById('pachinko-spin-count');
      this.cutinOverlay = document.getElementById('pachinko-cutin');
      this.cutinTextEl = document.getElementById('cutin-text');
      this.cutinBtn = document.getElementById('cutin-btn');
      this.board = null; // Set externally after board init

      this.reelStrips = [
        document.getElementById('reel-strip-1'),
        document.getElementById('reel-strip-2'),
        document.getElementById('reel-strip-3')
      ];

      this.holdLamps = [
        document.getElementById('pachinko-hold-1'),
        document.getElementById('pachinko-hold-2'),
        document.getElementById('pachinko-hold-3'),
        document.getElementById('pachinko-hold-4')
      ];

      this.holds = 0; // Current stock count (0-4)
      this.isSpinning = false;

      this.initReels();
      this.bindEvents();
      this.showIntro();
    }

    initReels() {
      this.reelStrips.forEach(strip => {
        strip.innerHTML = '';
        // Fill with shuffled participants
        const shuffled = [...this.participants].sort(() => Math.random() - 0.5);
        shuffled.forEach(p => {
          const item = document.createElement('div');
          item.className = 'reel-item';
          item.innerHTML = `<img src="${p.image}" alt="${p.name}">`;
          strip.appendChild(item);
        });
        strip.style.transform = 'translateY(0px)';
      });
    }

    bindEvents() {
      // spin() is now called by PachinkoBoard.onHesoHit()
      this.cutinBtn.addEventListener('click', () => {
        this.cutinOverlay.classList.remove('active');
        this.cutinResolve && this.cutinResolve();
      });
    }

    showIntro() {
      this.setLCD([
        { text: 'CR ユキッカーズ', cls: 'gold' },
        { text: '〜伝説の始まり〜', cls: 'sub' },
        { text: '玉を打ってヘソを狙え！', cls: '' }
      ]);
    }

    setLCD(lines) {
      this.prodText.innerHTML = lines.map((l, i) =>
        `<div class="production-line ${l.cls}" style="animation-delay:${i * 0.3}s">${l.text}</div>`
      ).join('');
    }

    flashLCD() {
      this.lcdArea.classList.add('lcd-flash');
      setTimeout(() => this.lcdArea.classList.remove('lcd-flash'), 500);
    }

    addHold() {
      if (this.holds >= 4) return;
      this.holds++;
      this.updateHoldLamps();
      if (!this.isSpinning) {
        this.spin();
      }
    }

    updateHoldLamps() {
      this.holdLamps.forEach((lamp, i) => {
        if (!lamp) return;
        lamp.classList.toggle('active', i < this.holds);
      });
    }

    async spin() {
      if (this.isSpinning || this.holds <= 0) return;
      this.isSpinning = true;
      this.holds--;
      this.updateHoldLamps();

      // Determine jackpot
      const isJackpot = Math.random() < this.jackpotProb;
      // Determine reach early to control tempo
      const isReach = isJackpot || Math.random() < 0.4;
      
      // Calculate tempo scale: faster if holds are piled up, it's a loss AND NOT a reach
      this.tempoScale = (this.holds >= 2 && !isJackpot && !isReach) ? 0.5 : 1.0;

      this.spinCount++;
      if (this.spinCountEl) this.spinCountEl.textContent = this.spinCount;

      // Pick the winning symbol
      const jackpotMember = this.participants[Math.floor(Math.random() * this.participants.length)];

      // === STEP 1: HOLD COLOR ===
      this.updateHoldColor(isJackpot);

      // === STEP 2: FORESHADOW ===
      await this.foreshadow(isJackpot);

      // === STEP 3: SPIN REELS (Stage 1) ===
      await this.spinReels(isJackpot, isReach, jackpotMember);

      // === STEP 4: BRANCHING REACH ===
      if (isReach) {
        const reachType = this.pickReachType(isJackpot);
        await this.playReach(reachType, isJackpot, jackpotMember);
      }

      // === STEP 5: RESULT ===
      if (isJackpot) {
        await this.showJackpot(jackpotMember);
      } else {
        this.setLCD([{ text: '・・・残念', cls: 'sub' }]);
        this.setLCDBg(''); 
        this.clearHolds();
      }

      this.isSpinning = false;
      
      // Auto-spin next hold
      if (this.holds > 0) {
        const nextDelay = 800 * this.tempoScale;
        setTimeout(() => this.spin(), nextDelay);
      }
    }

    updateHoldColor(isJackpot) {
      const r = Math.random();
      let color = 'blue';
      if (isJackpot) {
        if (r < 0.2) color = 'rainbow';
        else if (r < 0.5) color = 'gold';
        else if (r < 0.8) color = 'red';
        else color = 'green';
      } else {
        if (r < 0.02) color = 'red'; // Fake intense
        else if (r < 0.1) color = 'green';
        else color = 'blue';
      }
      if (this.holdLamps[0]) this.holdLamps[0].className = `hold-lamp ${color} active`;
    }

    async foreshadow(isJackpot) {
      const msgs = [];
      const r = Math.random();
      if (isJackpot && r < 0.7) {
        msgs.push({ text: 'ざわ…ざわ…', cls: '' });
        msgs.push({ text: '何かが起きようとしている…', cls: 'gold' });
      } else if (r < 0.1) {
        msgs.push({ text: '…少し空気が変わった', cls: 'sub' });
      }

      if (msgs.length > 0) {
        this.setLCD(msgs);
        this.flashLCD();
        await this.wait(1500 * this.tempoScale);
      }
    }

    async spinReels(isJackpot, isReach, jackpotMember) {
      this.setLCD([{ text: '回転中…', cls: '' }]);

      let r1, r2, r3;
      r1 = isJackpot ? jackpotMember : this.randomParticipant();
      
      if (isReach) {
        r2 = r1;
      } else {
        r2 = this.randomParticipantExcluding(r1.username);
      }

      if (isJackpot) {
        r3 = r1;
      } else {
        const excludeList = [r1.username];
        r3 = this.randomParticipantExcluding(excludeList);
      }

      const results = [r1, r2, r3];

      // Reset matched states
      document.getElementById('pachinko-reel-1').classList.remove('matched');
      document.getElementById('pachinko-reel-2').classList.remove('matched');
      document.getElementById('pachinko-reel-3').classList.remove('matched');

      // === SPIN SEQUENTIALLY (One by one) ===
      await this.animateReel(0, results[0]);
      await this.wait(400 * this.tempoScale);
      
      await this.animateReel(1, results[1]);
      await this.wait(400 * this.tempoScale);

      // Reach check
      if (results[0].username === results[1].username) {
        document.getElementById('pachinko-reel-1').classList.add('matched');
        document.getElementById('pachinko-reel-2').classList.add('matched');
        this.setLCD([{ text: 'リーチ！！', cls: 'warning' }]); 
        this.flashLCD();
        
        // Target for playReach
        this.targetR3 = results[2];
        await this.wait(800 * this.tempoScale);
      } else {
        // NO REACH: Finish 3rd reel
        await this.animateReel(2, results[2]);
      }
    }

    async prepareReel(idx, targetMember) {
      const strip = this.reelStrips[idx];
      strip.style.transition = 'none';
      strip.style.transform = 'translateY(0px)';
      
      const spinItems = 20; 
      strip.innerHTML = '';
      for (let i = 0; i < spinItems; i++) {
        const p = this.randomParticipant();
        const item = document.createElement('div');
        item.className = 'reel-item';
        item.innerHTML = `<img src="${p.image}" alt="${p.name}">`;
        strip.appendChild(item);
      }
      const finalItem = document.createElement('div');
      finalItem.className = 'reel-item';
      finalItem.innerHTML = `<img src="${targetMember.image}" alt="${targetMember.name}">`;
      strip.appendChild(finalItem);
      
      this.currentSpinItems = spinItems;
      await this.wait(50);
    }

    startSpin(idx, duration, skipReset = false) {
      const strip = this.reelStrips[idx];
      const items = 20; // Must match prepareReel
      
      strip.style.transition = `transform ${duration}s cubic-bezier(0.2, 0.8, 0.3, 1)`;
      strip.style.transform = `translateY(-${items * 60}px)`;
      
      return this.wait(duration * 1000);
    }

    async animateReel(idx, targetMember, durationSec = null) {
      await this.prepareReel(idx, targetMember);
      return this.startSpin(idx, durationSec || (1.0 + idx * 0.5));
    }

    pickReachType(isJackpot) {
      const r = Math.random() * 100;
      if (isJackpot) {
        if (r < 10) return 'zenkaiten';    // 10% Jackpot
        if (r < 70) return 'gekiatsu';    // 60% Jackpot
        return 'anime';                   // 30% Jackpot
      } else {
        if (r < 75) return 'normal';      // 75% Loss
        if (r < 96) return 'anime';       // 21% Loss
        return 'gekiatsu';                // 4%  Loss
      }
    }

    setLCDBg(cls) {
      this.lcdArea.classList.remove('bg-blue', 'bg-red', 'bg-gold');
      if (cls) this.lcdArea.classList.add(cls);
    }

    async playReach(type, isJackpot, jackpotMember) {
      // 1. Initial Transition
      if (type !== 'normal') {
        this.setLCD([{ text: '⚡ 発展 ⚡', cls: 'warning' }]);
        this.flashLCD();
        await this.wait(1000);
      }

      switch (type) {
        case 'normal':
          this.setLCD([{ text: 'ノーマルリーチ', cls: 'sub' }]);
          await this.animateReel(2, this.targetR3);
          await this.wait(1000);
          break;

        case 'anime':
          this.setLCDBg('bg-blue');
          this.setLCD([
            { text: '🔥 SPリーチ 🔥', cls: 'warning' },
            { text: `${jackpotMember.name}登場！`, cls: 'gold' }
          ]);
          await this.wait(2000);
          await this.showCutIn(jackpotMember, 'standard');
          await this.wait(1000);
          this.setLCD([{ text: '捕まえろ！', cls: '' }]);
          await this.animateReel(2, this.targetR3, 2.5); // Slower
          await this.wait(1000);
          break;

        case 'gekiatsu':
          this.setLCDBg('bg-red');
          this.setLCD([
            { text: '💀 激アツ！ 💀', cls: 'warning' },
            { text: '期待度：最高潮', cls: 'gold' }
          ]);
          this.flashLCD();
          await this.wait(2500);
          await this.showCutIn(jackpotMember, 'red');
          await this.wait(1500);
          
          this.setLCD([{ text: 'ボタンを連打せよ！', cls: 'warning' }]);
          await this.showInteractCutIn('gold');
          
          this.setLCDBg('bg-gold');
          this.setLCD([{ text: 'いっけえええ！', cls: 'rainbow' }]);
          await this.animateReel(2, this.targetR3, 4.0); // Very slow
          await this.wait(1000);
          break;

        case 'zenkaiten':
          await this.wait(1000);
          this.setLCDBg('bg-gold');
          this.setLCD([
            { text: '🌈 全回転 🌈', cls: 'rainbow' },
            { text: '伝説の刻…', cls: 'gold' }
          ]);
          this.flashLCD();
          // Simultaneous spin logic
          const p1 = this.animateReel(0, jackpotMember, 5.0);
          const p2 = this.animateReel(1, jackpotMember, 5.0);
          const p3 = this.animateReel(2, jackpotMember, 5.0);
          await Promise.all([p1, p2, p3]);
          document.getElementById('pachinko-reel-1').classList.add('matched');
          document.getElementById('pachinko-reel-2').classList.add('matched');
          document.getElementById('pachinko-reel-3').classList.add('matched');
          await this.wait(1500);
          break;
      }
    }

    showCutIn(member, colorClass) {
      return new Promise(resolve => {
        const cutImg = document.getElementById('cutin-img');
        if (cutImg) cutImg.src = member.image;
        
        this.cutinTextEl.className = `cutin-text ${colorClass}`;
        this.cutinTextEl.textContent = colorClass === 'red' ? '決めろ！！' : 'チャンス！！';
        
        this.cutinBtn.style.display = 'none'; // No button for simple cutin
        this.cutinOverlay.classList.add('active');
        
        setTimeout(() => {
          this.cutinOverlay.classList.remove('active');
          resolve();
        }, 1500);
      });
    }

    showInteractCutIn(colorClass) {
      return new Promise(resolve => {
        this.cutinResolve = resolve;
        this.cutinTextEl.className = `cutin-text ${colorClass}`;
        this.cutinTextEl.textContent = 'ボタンを叩け！';
        this.cutinBtn.style.display = 'block';
        this.cutinOverlay.classList.add('active');
      });
    }

    async showJackpot(member) {
      // FEVER!
      this.setLCD([
        { text: '🎉 大当たり！！ 🎉', cls: 'rainbow' },
        { text: 'F E V E R ! !', cls: 'warning' }
      ]);
      this.flashLCD();

      // Flash all hold lamps rainbow
      this.holdLamps.forEach(l => l.className = 'hold-lamp rainbow');

      await this.wait(2500);

      // Kakuhen judgment
      const isKakuhen = Math.random() < 0.65;
      this.setLCD([
        { text: isKakuhen ? '🔥 確変突入！！ 🔥' : '通常大当たり！', cls: isKakuhen ? 'rainbow' : 'gold' },
        { text: isKakuhen ? '次回も大チャンス！' : 'おめでとう！', cls: 'sub' }
      ]);

      await this.wait(2000);

      // Payout balls
      if (this.board) {
        const payout = isKakuhen ? 1500 : 500;
        this.board.addBalls(payout);
      }

      // Show result view
      switchPachinkoView('result');
      document.getElementById('pachinko-winner-name').textContent = member.name;
      document.getElementById('pachinko-raid-link').href = `https://kick.com/${member.username}`;
      const feverText = document.getElementById('pachinko-fever-text');
      if (feverText) feverText.textContent = isKakuhen ? '確変 FEVER!!' : 'FEVER!!';

      this.clearHolds();
    }

    clearHolds() {
      this.holdLamps.forEach(l => l.className = 'hold-lamp');
    }

    randomParticipant() {
      return this.participants[Math.floor(Math.random() * this.participants.length)];
    }

    randomParticipantExcluding(excludeUsernames) {
      const excludes = Array.isArray(excludeUsernames) ? excludeUsernames : [excludeUsernames];
      const others = this.participants.filter(p => !excludes.includes(p.username));
      return others.length > 0 ? others[Math.floor(Math.random() * others.length)] : this.randomParticipant();
    }

    wait(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  }

  // Kick LIVE Status Check
  async function checkLiveStatus() {
    const memberCards = document.querySelectorAll('.profile-card[data-kick]');
    memberCards.forEach(async (card) => {
      const username = card.getAttribute('data-kick');
      try {
        const response = await fetch(`https://kick.com/api/v2/channels/${username}`);
        if (response.ok) {
          const data = await response.json();
          if (data && data.livestream) {
            card.classList.add('is-live');
            
            // Category Badge logic (Show category name or "Now Streaming")
            let categoryName = '配信中';
            let rawCat = '';
            if (data.livestream.categories && data.livestream.categories.length > 0) {
              rawCat = data.livestream.categories[0].name;
            } else if (data.livestream.category) {
              rawCat = data.livestream.category.name;
            }

            if (rawCat) {
              const catMap = {
                'Just Chatting': '雑談',
                'Talk Shows & Podcasts': 'トーク',
                'Slots': 'スロット',
                'Pools, Hot Tubs & Beaches': 'プール',
                'Gaming': 'ゲーム',
                'ASMR': 'ASMR',
                'Music': '音楽',
                'Art': 'アート',
                'IRL': '実写配信'
              };
              categoryName = catMap[rawCat] || rawCat;
            }
            
            let catBadge = card.querySelector('.category-badge');
            if (!catBadge) {
              catBadge = document.createElement('div');
              catBadge.className = 'category-badge';
              const cardLink = card.querySelector('.card-link');
              if (cardLink) cardLink.appendChild(catBadge);
            }
            catBadge.textContent = categoryName;

          } else {
            card.classList.remove('is-live');
          }
        }
      } catch (err) {
        console.warn(`Kick API fetch failed for ${username}`, err);
      }
    });
  }

  // Initial check and set interval (every 2 minutes)
  checkLiveStatus();
  setInterval(checkLiveStatus, 120000);

  let allHistory = [];
  let currentFilter = 'all';

  async function renderMemberArchives() {
    const historyContainer = document.getElementById('history-container');
    if (!historyContainer) return;

    // Table structure initialization
    let tbody = document.getElementById('archive-tbody');
    if (!tbody) {
      historyContainer.innerHTML = `
        <div style="overflow-x: auto;">
          <table class="archive-table">
            <thead>
              <tr>
                <th>配信日</th>
                <th>メンバー</th>
                <th>開始時間</th>
                <th>終了時間</th>
                <th>タイトル</th>
                <th style="min-width: 100px;">配信時間</th>
                <th>リンク</th>
              </tr>
            </thead>
            <tbody id="archive-tbody">
              <tr>
                <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">
                  配信履歴データを読み込み中...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
      tbody = document.getElementById('archive-tbody');
    }

    try {
      const res = await fetch('/api/archive?action=list');
      if (res.ok) {
        allHistory = await res.json();
        renderFilteredArchives();
        renderFilterButtons();
      }
    } catch (err) {
      console.error('History render error:', err);
    }
    
    setTimeout(reveal, 100);
  }

  function renderFilterButtons() {
    const filterContainer = document.getElementById('archive-filters');
    if (!filterContainer) return;

    const activeUsernames = [...new Set(allHistory.map(item => item.username))];
    let html = `<button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">すべて</button>`;
    
    activeUsernames.forEach(username => {
      const member = memberData.find(m => m.username === username) || { name: username };
      html += `<button class="filter-btn ${currentFilter === username ? 'active' : ''}" data-filter="${username}">${member.name}</button>`;
    });

    filterContainer.innerHTML = html;

    filterContainer.querySelectorAll('.filter-btn').forEach(btn => {
      btn.onclick = () => {
        currentFilter = btn.getAttribute('data-filter');
        renderFilteredArchives();
        renderFilterButtons();
      };
    });
  }

  function renderFilteredArchives() {
    const tbody = document.getElementById('archive-tbody');
    if (!tbody) return;

    const filtered = currentFilter === 'all' 
      ? allHistory 
      : allHistory.filter(item => item.username === currentFilter);

    if (!filtered || filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">
            ${currentFilter === 'all' ? '配信履歴がまだありません' : 'このメンバーの履歴は見つかりませんでした'}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(item => {
      const member = memberData.find(m => m.username === item.username) || { name: item.username, image: 'yukick.jpg' };
      return `
        <tr>
          <td>${item.date}</td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <img src="${member.image}" alt="" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">
              <span class="archive-member">${member.name}</span>
            </div>
          </td>
          <td style="font-family: var(--font-pop); color: #000;">${item.startTime}</td>
          <td style="font-family: var(--font-pop); color: #000;">${item.endTime}</td>
          <td class="archive-title-cell" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.title}</td>
          <td class="archive-duration-cell" style="font-weight: 700;">${item.duration}</td>
          <td>
            <a href="${item.link}" target="_blank" class="btn-mini">
              <i class="fa-solid fa-play"></i> 視聴
            </a>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Initial fetch and periodic update
  renderMemberArchives();
  setInterval(renderMemberArchives, 60000);


  // News Data
  const newsData = [
    { date: '2026.03.30', badge: 'メンバー加入', badgeClass: 'live', title: '新メンバー「michaaam」が加入しました！' },
    { date: '2026.03.28', badge: 'Info', badgeClass: 'info', title: 'グループルールに「BAN行為禁止」「瓜田さんへの配慮」「パパ活禁止」を追加しました' },
    { date: '2026.03.25', badge: 'Info', badgeClass: 'info', title: 'グループルールに「暴露をしない」を追加しました' },
    { date: '2026.03.23', badge: 'イベント', badgeClass: 'event', title: '３月２８日１９時～ユキッカーズ決起集会決定！' },
    { date: '2026.03.22', badge: 'メンバー加入', badgeClass: 'live', title: '野田草履、ぽんちゃんが参加' },
    { date: '2026.03.22', badge: 'Info', badgeClass: 'info', title: 'ユキッカーズ公式サイトを正式公開しました' },
    { date: '2026.03.19', badge: 'Info', badgeClass: 'info', title: 'ユキッカーズ結成' }
  ];

  // Schedule Data
  const scheduleData = [
    { date: '2026.03.30', time: '21:00', type: 'INTERVIEW', title: 'ユキッカーズ面接（みーちゃん）', venue: 'KICK', image: 'mi.jpg', link: 'https://kick.com/yuki_0121' },
    { date: '2026.05.00', time: '', type: 'GW CAMP', title: '(GW) 1泊2日キャンプ＆バーベキュー', venue: '屋外', image: 'dummy.jpg' },
    { date: '2026.05.00', time: '', type: 'SPECIAL', title: 'ユキッカーズオーディション', venue: 'KICK', image: 'dummy.jpg' },
    { date: '2026.08.00', time: '', type: 'EVENT', title: '富士山', venue: '現地', image: 'dummy.jpg' }
  ];

  const tbdScheduleData = [
    { title: '草津温泉', icon: 'fa-hot-tub-person' },
    { title: 'スキー', icon: 'fa-person-skiing' },
    { title: '沖縄', icon: 'fa-umbrella-beach' },
    { title: '運動会', icon: 'fa-flag-checkered' },
    { title: 'チーム対抗ドッジボール', icon: 'fa-volleyball' }
  ];

  function renderTbdSchedule() {
    const tbdList = document.getElementById('tbd-list');
    if (!tbdList) return;
    tbdList.innerHTML = tbdScheduleData.map(item => `
      <div class="tbd-item">
        <i class="fa-solid ${item.icon}"></i>
        ${item.title}
      </div>
    `).join('');
  }

  // Initial render for TBD
  renderTbdSchedule();

  function renderNews(data, containerId, limit = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let displayData = limit ? data.slice(0, limit) : data;
    
    container.innerHTML = displayData.map(item => `
      <li class="news-item">
        <div class="news-date">${item.date}</div>
        <div class="news-badge ${item.badgeClass}">${item.badge}</div>
        <div class="news-title">${item.title}</div>
      </li>
    `).join('');
  }

  // Initial render for news
  renderNews(newsData, 'news-summary-list', 5);
  renderNews(newsData, 'full-news-list');

  // Custom Carousel (Lotteria Style - No Swiper)
  var carouselEl = document.getElementById('heroCarousel');
  if (carouselEl) {
    var trackEl = carouselEl.querySelector('.carousel-track');
    var slideEls = carouselEl.querySelectorAll('.carousel-slide');
    var prevBtnEl = document.getElementById('carouselPrev');
    var nextBtnEl = document.getElementById('carouselNext');
    var dotsContainerEl = document.getElementById('carouselDots');
    var totalSlides = slideEls.length;
    var currentIdx = 0;

    // Create dots
    for (var i = 0; i < totalSlides; i++) {
      var dotEl = document.createElement('button');
      dotEl.classList.add('carousel-dot');
      dotEl.setAttribute('data-index', i);
      dotsContainerEl.appendChild(dotEl);
    }
    var dotEls = dotsContainerEl.querySelectorAll('.carousel-dot');

    // Add dot click listeners
    dotsContainerEl.addEventListener('click', function(e) {
      var dot = e.target.closest('.carousel-dot');
      if (dot) {
        var idx = parseInt(dot.getAttribute('data-index'));
        showSlide(idx);
      }
    });

    function showSlide(idx) {
      if (idx < 0) idx = totalSlides - 1;
      if (idx >= totalSlides) idx = 0;
      currentIdx = idx;
      console.log('showSlide:', currentIdx);
      trackEl.style.transform = 'translateX(-' + (currentIdx * 100) + '%)';
      for (var j = 0; j < totalSlides; j++) {
        slideEls[j].classList.toggle('active', j === currentIdx);
        dotEls[j].classList.toggle('active', j === currentIdx);
      }
    }

    nextBtnEl.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log('NEXT clicked, current:', currentIdx);
      showSlide(currentIdx + 1);
    });

    prevBtnEl.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log('PREV clicked, current:', currentIdx);
      showSlide(currentIdx - 1);
    });

    // Touch/swipe support
    var startX = 0;
    carouselEl.addEventListener('touchstart', function(e) {
      startX = e.touches[0].clientX;
    }, { passive: true });
    carouselEl.addEventListener('touchend', function(e) {
      var diffX = startX - e.changedTouches[0].clientX;
      if (Math.abs(diffX) > 50) {
        if (diffX > 0) showSlide(currentIdx + 1);
        else showSlide(currentIdx - 1);
      }
    });

    // Initialize to first slide
    showSlide(0);

    // Autoplay - delayed start, generous interval
    setTimeout(function() {
      setInterval(function() { showSlide(currentIdx + 1); }, 6000);
    }, 3000);
  }

  // ==========================================================================
  // Schedule Logic
  // ==========================================================================
  const scheduleListContainer = document.getElementById('schedule-list');
  const prevMonthBtn = document.getElementById('prev-month-btn');
  const nextMonthBtn = document.getElementById('next-month-btn');
  const currentMonthDisplay = document.getElementById('current-month-display');
  const scheduleCenter = document.querySelector('.schedule-center');
  const scheduleInner = document.getElementById('schedule-inner');

  if (scheduleListContainer && prevMonthBtn && nextMonthBtn && currentMonthDisplay && scheduleInner) {
    let currentScheduleDate = new Date();
    
    // 必ず2026年に固定
    currentScheduleDate.setFullYear(2026);
    // 3月(2)～12月(11)の間に固定 (以前は4月(3)からだったが、3月からに変更)
    if (currentScheduleDate.getMonth() < 2) currentScheduleDate.setMonth(2);

    function renderSchedule() {
      scheduleListContainer.innerHTML = ''; // Clear current
      
      const year = currentScheduleDate.getFullYear();
      const month = currentScheduleDate.getMonth();
      const monthStr = String(month + 1).padStart(2, '0');
      
      // Update display (e.g., 2026.04)
      currentMonthDisplay.textContent = `${year}.${monthStr}`;

      // Filter events for the current month
      const monthlyEvents = scheduleData.filter(item => {
        const [y, m] = item.date.split('.');
        const result = (y == year && m == monthStr);
        return result;
      });

      if (monthlyEvents.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'no-schedule';
        emptyDiv.style.textAlign = 'center';
        emptyDiv.style.padding = '40px';
        emptyDiv.style.color = 'var(--text-muted)';
        emptyDiv.textContent = '予定がまだありません';
        scheduleListContainer.appendChild(emptyDiv);
      } else {
        monthlyEvents.forEach(evt => {
          const [,, d] = evt.date.split('.');
          const day = parseInt(d);

          // Build date/time display string
          let timeDisplay = '';
          if (day > 0) {
            timeDisplay = `${monthStr}.${String(day).padStart(2, '0')}`;
            if (evt.time) timeDisplay += ` ${evt.time}`;
          } else {
            timeDisplay = `${monthStr}月 予定`;
          }

          // Group container for the day
          const dayGroup = document.createElement('div');
          dayGroup.className = 'schedule-day-group';

          // Grid container
          const eventsGrid = document.createElement('ul');
          eventsGrid.className = 'schedule-events-grid';

          const li = document.createElement('li');
          li.className = 'schedule-card-item';
          
          li.innerHTML = `
            <a href="${evt.link || '#event'}" ${evt.link ? 'target="_blank" rel="noopener noreferrer"' : ''} class="schedule-card-link">
              <div class="schedule-card-thumb">
                <img src="${evt.image || 'dummy.jpg'}" alt="Event Thumbnail">
              </div>
              <div class="schedule-card-info">
                <div class="schedule-card-top">
                  <div class="schedule-card-time-group">
                    <i class="fa-solid fa-play schedule-card-play-icon"></i>
                    <span class="schedule-card-time">${timeDisplay}</span>
                  </div>
                  <span class="schedule-badge">${evt.type}</span>
                </div>
                <div class="schedule-card-title">${evt.title}</div>
                <div class="schedule-card-name">
                  <img src="yuki.jpg" alt="Icon" class="schedule-card-avatar">
                  ${evt.venue}
                </div>
              </div>
            </a>
          `;
          eventsGrid.appendChild(li);

          dayGroup.appendChild(eventsGrid);
          scheduleListContainer.appendChild(dayGroup);
        });
      }
      
      // ボタンの無効化とサイドバー月数表示更新 (4月より前、もしくは12月より先にいけないようにする)
      const prevDisplay = document.getElementById('prev-month-display');
      const nextDisplay = document.getElementById('next-month-display');

      if (month <= 2) {
        prevMonthBtn.classList.add('disabled');
        if (prevDisplay) prevDisplay.textContent = '--';
      } else {
        prevMonthBtn.classList.remove('disabled');
        if (prevDisplay) prevDisplay.textContent = String(month).padStart(2, '0');
      }
      
      if (month >= 11) {
        nextMonthBtn.classList.add('disabled');
        if (nextDisplay) nextDisplay.textContent = '--';
      } else {
        nextMonthBtn.classList.remove('disabled');
        if (nextDisplay) nextDisplay.textContent = String(month + 2).padStart(2, '0');
      }

      // Re-trigger reveal animations if needed
      if (typeof reveal === 'function') setTimeout(reveal, 100);
    }

    function animateMonthTransition(direction) {
      if (!scheduleInner || !scheduleCenter) return;
      
      const outClass = direction === 'next' ? 'animate-slide-out-left' : 'animate-slide-out-right';
      const inClass = direction === 'next' ? 'animate-slide-in-right' : 'animate-slide-in-left';

      // 1. Create a clone of the current state
      const clone = scheduleInner.cloneNode(true);
      clone.id = ''; // remove ID to avoid collision
      clone.classList.add('schedule-inner-clone');
      
      // Remove IDs inside clone too
      clone.querySelectorAll('[id]').forEach(el => el.id = '');
      
      scheduleCenter.appendChild(clone);

      // 2. Update real content immediately
      if (direction === 'next') {
        currentScheduleDate.setMonth(currentScheduleDate.getMonth() + 1);
      } else {
        currentScheduleDate.setMonth(currentScheduleDate.getMonth() - 1);
      }
      renderSchedule();
      scheduleListContainer.scrollTop = 0;

      // 3. Apply animations
      clone.classList.add(outClass);
      scheduleInner.classList.remove('animate-slide-in-left', 'animate-slide-in-right');
      void scheduleInner.offsetWidth; // trigger reflow
      scheduleInner.classList.add(inClass);

      // 4. Cleanup after animation
      setTimeout(() => {
        clone.remove();
        scheduleInner.classList.remove(inClass);
      }, 600); // match CSS duration (0.6s)
    }

    prevMonthBtn.addEventListener('click', () => {
      if (currentScheduleDate.getMonth() <= 2) return; // 3月以前は戻れない
      animateMonthTransition('prev');
    });

    nextMonthBtn.addEventListener('click', () => {
      if (currentScheduleDate.getMonth() >= 11) return; // 12月以降は進めない
      animateMonthTransition('next');
    });

    // Initial render
    renderSchedule();
  }

  // --- 3D Chibi Characters Logic (Three.js) ---
  const chibiContainer = document.getElementById('chibi-container');
  if (chibiContainer && typeof THREE !== 'undefined') {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, chibiContainer.clientWidth / chibiContainer.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(chibiContainer.clientWidth, chibiContainer.clientHeight);
    chibiContainer.appendChild(renderer.domElement);

    camera.position.z = 5;

    const loader = new THREE.TextureLoader();
    const memberChibis = [
      { id: 'yuki_0121', file: 'chibi_yuki.png' },
      { id: 'nodazourip', file: 'chibi_nodazouri.png' },
      { id: 'inosisi0909', file: 'chibi_inoshishi.png' }, // Corrected ID
      { id: '04miki05', file: 'chibi_miki.png' },
      { id: 'kariko2525', file: 'chibi_kariko.png' },
      { id: 'ponchan_2525', file: 'chibi_ponchan.png' },
      { id: 'michaaam', file: 'chibi_michaaam.png' }
    ];

    const characters = [];
    const spacing = 0.8;
    const startX = -((memberChibis.length - 1) * spacing) / 2;

    memberChibis.forEach((m, i) => {
      const texture = loader.load(
        m.file, 
        undefined, 
        undefined, 
        (err) => console.error(`Failed to load ${m.file} (likely local security restriction):`, err)
      );
      const material = new THREE.SpriteMaterial({ map: texture });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(1, 1, 1);
      sprite.position.x = startX + i * spacing;
      sprite.position.y = -0.5;
      
      // Store metadata
      sprite.userData = { 
        id: m.id, 
        status: 'offline', 
        offset: Math.random() * Math.PI * 2,
        jumpPhase: 0 
      };
      
      scene.add(sprite);
      characters.push(sprite);
    });

    async function updateChibiStatus() {
      try {
        const response = await fetch('/api/archive?action=status');
        if (response.ok) {
          const statuses = await response.json();
          characters.forEach(char => {
            const found = statuses.find(s => s.user === char.userData.id || (char.userData.id === 'nosisi0909' && s.user === 'inosisi0909'));
            if (found) {
              char.userData.status = found.status;
            }
          });
        }
      } catch (err) {
        console.warn('Status fetch failed', err);
      }
    }

    // Update status every 60 seconds
    updateChibiStatus();
    setInterval(updateChibiStatus, 60000);

    function animateChibis() {
      requestAnimationFrame(animateChibis);
      const time = Date.now() * 0.005;

      characters.forEach(char => {
        if (char.userData.status === 'live') {
          // Dance: Bouncing and slightly rotating
          char.position.y = -0.5 + Math.abs(Math.sin(time + char.userData.offset)) * 0.3;
          char.rotation.z = Math.sin(time * 0.5) * 0.1;
          char.material.opacity = 1.0;
        } else {
          // Offline: Sleeping, slightly leaning and dim
          char.position.y = -0.5;
          char.rotation.z = 0.5 + Math.sin(time * 0.2) * 0.05; // Leaning
          char.material.opacity = 0.6;
        }
      });

      renderer.render(scene, camera);
    }
    animateChibis();

    // Handle resize
    window.addEventListener('resize', () => {
      renderer.setSize(chibiContainer.clientWidth, chibiContainer.clientHeight);
      camera.aspect = chibiContainer.clientWidth / chibiContainer.clientHeight;
      camera.updateProjectionMatrix();
    });
  }

});
