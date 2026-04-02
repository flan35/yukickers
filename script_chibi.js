  // --- 3D Chibi Characters Logic (Hybrid Local/Prod) ---
  const chibiContainer = document.getElementById('chibi-home-section');
  if (chibiContainer) {
    const memberChibis = [
      { id: 'yuki_0121', file: 'chibi_yuki.png', name: 'ユキちゃん' },
      { id: 'nodazourip', file: 'chibi_nodazouri.png', name: '野田草履' },
      { id: 'inosisi0909', file: 'chibi_inoshishi.png', name: 'イノシシ' },
      { id: '04miki05', file: 'chibi_miki.png', name: 'ミキ' },
      { id: 'kariko2525', file: 'chibi_kariko.png', name: 'カリフラワー狩子' },
      { id: 'ponchan_2525', file: 'chibi_ponchan.png', name: 'ぽんちゃん' },
      { id: 'michaaam', file: 'chibi_michaaam.png', name: 'michaaam' }
    ];

    const isLocal = window.location.protocol === 'file:';

    if (isLocal || typeof THREE === 'undefined') {
      // --- LOCAL FALLBACK (Standard HTML/CSS) ---
      chibiContainer.style.display = 'flex';
      chibiContainer.style.justifyContent = 'center';
      chibiContainer.style.alignItems = 'flex-end';
      chibiContainer.style.gap = '15px';
      chibiContainer.style.paddingBottom = '20px';

      memberChibis.forEach(m => {
        const img = document.createElement('img');
        img.src = m.file;
        img.alt = m.name;
        img.style.height = '150px';
        img.style.width = 'auto';
        img.style.objectFit = 'contain';
        img.style.filter = 'drop-shadow(0 5px 15px rgba(0,0,0,0.2))';
        img.style.animation = `chibiPuni ${2 + Math.random()}s ease-in-out infinite`;
        chibiContainer.appendChild(img);
      });

      if (!document.getElementById('chibi-puni-style')) {
        const style = document.createElement('style');
        style.id = 'chibi-puni-style';
        style.innerHTML = `
          @keyframes chibiPuni {
            0%, 100% { transform: translateY(0) scale(1, 1); }
            25% { transform: translateY(-10px) scale(0.9, 1.15); }
            50% { transform: translateY(0) scale(1.1, 0.9); }
            75% { transform: translateY(-5px) scale(0.95, 1.05); }
          }
        `;
        document.head.appendChild(style);
      }
    } else {
      // --- PRODUCTION (Three.js 3D with Squash and Stretch) ---
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, chibiContainer.clientWidth / chibiContainer.clientHeight, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(chibiContainer.clientWidth, chibiContainer.clientHeight);
      chibiContainer.appendChild(renderer.domElement);

      camera.position.z = 8;

      const loader = new THREE.TextureLoader();
      const characters = [];
      const spacing = 1.6;
      const startX = -((memberChibis.length - 1) * spacing) / 2;

      memberChibis.forEach((m, i) => {
        const texture = loader.load(m.file);
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(1.5, 1.5, 1);
        sprite.position.x = startX + i * spacing;
        sprite.position.y = -0.5;
        sprite.userData = { id: m.id, status: 'offline', offset: Math.random() * Math.PI * 2 };
        scene.add(sprite);
        characters.push(sprite);
      });

      async function updateChibiStatus() {
        try {
          const response = await fetch('/api/archive?action=status');
          if (response.ok) {
            const statuses = await response.json();
            characters.forEach(char => {
              const found = statuses.find(s => s.user === char.userData.id);
              if (found) char.userData.status = found.status;
            });
          }
        } catch (err) { console.warn('Status fetch failed', err); }
      }

      updateChibiStatus();
      setInterval(updateChibiStatus, 60000);

      function animateChibis() {
        requestAnimationFrame(animateChibis);
        const time = Date.now() * 0.005;

        characters.forEach(char => {
          const breathing = Math.sin(time + char.userData.offset) * 0.05;
          const offset = char.userData.offset;

          if (char.userData.status === 'live') {
            const jump = Math.abs(Math.sin(time * 2 + offset));
            char.position.y = -0.5 + jump * 1.0;
            
            // Squash and Stretch: vertical stretch when flying, horizontal squash when landing
            const stretch = 1 + jump * 0.3;
            const squash = 1 - jump * 0.15;
            char.scale.set(1.5 * squash, 1.5 * stretch, 1);
            
            char.rotation.z = Math.sin(time * 3 + offset) * 0.2;
            char.material.opacity = 1.0;
          } else {
            // Sleeping: subtle breathing and leaning
            char.position.y = -0.6 + breathing * 0.2;
            const breatheScale = 1 + breathing * 0.15;
            char.scale.set(1.5 * (1 / breatheScale), 1.5 * breatheScale, 1);
            
            char.rotation.z = 0.4 + Math.sin(time * 0.5 + offset) * 0.05;
            char.material.opacity = 0.6;
          }
        });
        renderer.render(scene, camera);
      }
      animateChibis();

      window.addEventListener('resize', () => {
        renderer.setSize(chibiContainer.clientWidth, chibiContainer.clientHeight);
        camera.aspect = chibiContainer.clientWidth / chibiContainer.clientHeight;
        camera.updateProjectionMatrix();
      });
    }
  }
