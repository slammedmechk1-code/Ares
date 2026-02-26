/* ============================================================
   ARES — script.js
   Topographic background (gold → white transition), particles,
   cursor trail dots, scroll reveal, FAQ, music, stat counters
   ============================================================ */
(() => {
    'use strict';

    const lerp = (a, b, t) => a + (b - a) * t;
    const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // ─── MOUSE STATE ───────────────────────────────────────
    const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2, sx: 0, sy: 0 };
    document.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    // ─── CURSOR GLOW ──────────────────────────────────────
    const cursorGlow = document.getElementById('cursorGlow');
    function updateCursorGlow() {
        if (cursorGlow) {
            cursorGlow.style.left = mouse.x + 'px';
            cursorGlow.style.top = mouse.y + 'px';
        }
        requestAnimationFrame(updateCursorGlow);
    }
    updateCursorGlow();

    // ─── CURSOR TRAIL (small dots, slow fade) ─────────────
    const trailCanvas = document.getElementById('trailCanvas');
    const trailCtx = trailCanvas.getContext('2d');
    const trailDots = [];
    const TRAIL_MAX = 18;
    const TRAIL_LIFESPAN = 1.8; // seconds — short lifespan

    function resizeTrail() {
        trailCanvas.width = window.innerWidth * dpr;
        trailCanvas.height = window.innerHeight * dpr;
        trailCanvas.style.width = window.innerWidth + 'px';
        trailCanvas.style.height = window.innerHeight + 'px';
        trailCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resizeTrail();

    let lastTrailTime = 0;
    document.addEventListener('mousemove', (e) => {
        const now = performance.now() / 1000;
        if (now - lastTrailTime < 0.04) return; // spawn every ~40ms
        lastTrailTime = now;
        trailDots.push({
            x: e.clientX,
            y: e.clientY,
            born: now,
            size: 2.5 + Math.random() * 1.5,
        });
        if (trailDots.length > TRAIL_MAX * 2) trailDots.splice(0, TRAIL_MAX);
    });

    function drawTrail() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        trailCtx.clearRect(0, 0, w, h);
        const now = performance.now() / 1000;

        for (let i = trailDots.length - 1; i >= 0; i--) {
            const d = trailDots[i];
            const age = now - d.born;
            if (age > TRAIL_LIFESPAN) {
                trailDots.splice(i, 1);
                continue;
            }
            // Slow fade-in for first 0.15s, then fade out
            let alpha;
            if (age < 0.15) {
                alpha = (age / 0.15) * 0.5; // fade in slowly
            } else {
                alpha = 0.5 * (1 - (age - 0.15) / (TRAIL_LIFESPAN - 0.15));
            }
            alpha = clamp(alpha, 0, 0.5);
            const size = d.size * (1 - age / TRAIL_LIFESPAN * 0.5);
            trailCtx.beginPath();
            trailCtx.arc(d.x, d.y, size, 0, Math.PI * 2);
            trailCtx.fillStyle = `rgba(200, 200, 200, ${alpha})`;
            trailCtx.fill();
        }
        requestAnimationFrame(drawTrail);
    }
    drawTrail();

    // ─── TOPOGRAPHIC CANVAS (gold → white transition) ─────
    const topoCanvas = document.getElementById('topoCanvas');
    const topoCtx = topoCanvas.getContext('2d');

    function resizeTopo() {
        topoCanvas.width = window.innerWidth * dpr;
        topoCanvas.height = window.innerHeight * dpr;
        topoCanvas.style.width = window.innerWidth + 'px';
        topoCanvas.style.height = window.innerHeight + 'px';
        topoCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resizeTopo();

    function pseudoNoise(x, y, t) {
        return (
            Math.sin(x * 0.015 + t * 0.3) * 0.5 +
            Math.sin(y * 0.012 - t * 0.2) * 0.5 +
            Math.sin((x + y) * 0.01 + t * 0.15) * 0.4 +
            Math.sin(x * 0.025 - y * 0.018 + t * 0.25) * 0.3 +
            Math.cos(x * 0.008 + y * 0.022 + t * 0.1) * 0.35
        );
    }

    let topoTime = 0;
    const GRID = 9;
    const CONTOUR_LEVELS = 10;

    // Color transition state: cycles between gold and white slowly
    let colorPhase = 0; // 0 = gold, 1 = white
    const COLOR_CYCLE_SPEED = 0.0003; // very slow
    let colorDir = 1;

    function getTopoColor(alpha) {
        // Interpolate between gold (201,168,76) and white (210,210,210)
        const r = Math.round(lerp(201, 210, colorPhase));
        const g = Math.round(lerp(168, 210, colorPhase));
        const b = Math.round(lerp(76, 210, colorPhase));
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function drawTopo() {
        const w = window.innerWidth;
        const h = window.innerHeight;

        // Update color phase
        colorPhase += COLOR_CYCLE_SPEED * colorDir;
        if (colorPhase >= 1) { colorPhase = 1; colorDir = -1; }
        if (colorPhase <= 0) { colorPhase = 0; colorDir = 1; }

        mouse.sx = lerp(mouse.sx, (mouse.x / w - 0.5) * 50, 0.04);
        mouse.sy = lerp(mouse.sy, (mouse.y / h - 0.5) * 50, 0.04);

        topoCtx.clearRect(0, 0, w, h);
        topoTime += 0.005;

        const scrollY = window.scrollY * 0.12;
        const cols = Math.ceil(w / GRID) + 1;
        const rows = Math.ceil(h / GRID) + 1;
        const data = new Float32Array(cols * rows);

        for (let j = 0; j < rows; j++) {
            for (let i = 0; i < cols; i++) {
                const px = i * GRID + mouse.sx;
                const py = j * GRID + mouse.sy + scrollY;
                data[j * cols + i] = pseudoNoise(px, py, topoTime);
            }
        }

        topoCtx.lineWidth = 0.6;
        for (let level = 0; level < CONTOUR_LEVELS; level++) {
            const threshold = -1.0 + (level * 2.0) / CONTOUR_LEVELS;
            const alpha = 0.04 + (level % 3 === 0 ? 0.07 : 0.03);
            topoCtx.strokeStyle = getTopoColor(alpha);
            topoCtx.beginPath();

            for (let j = 0; j < rows - 1; j++) {
                for (let i = 0; i < cols - 1; i++) {
                    const idx = j * cols + i;
                    const a = data[idx];
                    const b = data[idx + 1];
                    const c = data[idx + cols + 1];
                    const d = data[idx + cols];

                    const x0 = i * GRID;
                    const y0 = j * GRID;

                    const config =
                        (a >= threshold ? 8 : 0) |
                        (b >= threshold ? 4 : 0) |
                        (c >= threshold ? 2 : 0) |
                        (d >= threshold ? 1 : 0);

                    if (config === 0 || config === 15) continue;

                    const top = lerpEdge(a, b, threshold, x0, y0, x0 + GRID, y0);
                    const right = lerpEdge(b, c, threshold, x0 + GRID, y0, x0 + GRID, y0 + GRID);
                    const bottom = lerpEdge(d, c, threshold, x0, y0 + GRID, x0 + GRID, y0 + GRID);
                    const left = lerpEdge(a, d, threshold, x0, y0, x0, y0 + GRID);

                    switch (config) {
                        case 1: case 14: segment(left, bottom); break;
                        case 2: case 13: segment(bottom, right); break;
                        case 3: case 12: segment(left, right); break;
                        case 4: case 11: segment(top, right); break;
                        case 5: segment(left, top); segment(bottom, right); break;
                        case 6: case 9: segment(top, bottom); break;
                        case 7: case 8: segment(left, top); break;
                        case 10: segment(left, bottom); segment(top, right); break;
                    }
                }
            }
            topoCtx.stroke();
        }

        function lerpEdge(v1, v2, th, x1, y1, x2, y2) {
            const t = clamp((th - v1) / (v2 - v1 || 0.001), 0, 1);
            return [lerp(x1, x2, t), lerp(y1, y2, t)];
        }
        function segment(p1, p2) {
            topoCtx.moveTo(p1[0], p1[1]);
            topoCtx.lineTo(p2[0], p2[1]);
        }

        requestAnimationFrame(drawTopo);
    }
    drawTopo();

    // ─── PARTICLE CANVAS ──────────────────────────────────
    const partCanvas = document.getElementById('particleCanvas');
    const partCtx = partCanvas.getContext('2d');

    function resizePart() {
        partCanvas.width = window.innerWidth * dpr;
        partCanvas.height = window.innerHeight * dpr;
        partCanvas.style.width = window.innerWidth + 'px';
        partCanvas.style.height = window.innerHeight + 'px';
        partCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resizePart();

    const PARTICLE_COUNT = 45;
    const particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            vx: (Math.random() - 0.5) * 0.25,
            vy: (Math.random() - 0.5) * 0.12 - 0.08,
            size: Math.random() * 1.8 + 0.4,
            alpha: Math.random() * 0.25 + 0.05,
            pulse: Math.random() * Math.PI * 2,
        });
    }

    function drawParticles() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        partCtx.clearRect(0, 0, w, h);

        particles.forEach((p) => {
            p.pulse += 0.012;
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < -10) p.x = w + 10;
            if (p.x > w + 10) p.x = -10;
            if (p.y < -10) p.y = h + 10;
            if (p.y > h + 10) p.y = -10;

            const a = p.alpha * (0.5 + 0.5 * Math.sin(p.pulse));
            partCtx.beginPath();
            partCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            // Particles also follow color transition
            const pr = Math.round(lerp(201, 220, colorPhase));
            const pg = Math.round(lerp(168, 220, colorPhase));
            const pb = Math.round(lerp(76, 220, colorPhase));
            partCtx.fillStyle = `rgba(${pr}, ${pg}, ${pb}, ${a})`;
            partCtx.fill();
        });

        requestAnimationFrame(drawParticles);
    }
    drawParticles();

    // ─── RESIZE ────────────────────────────────────────────
    window.addEventListener('resize', () => {
        resizeTopo();
        resizePart();
        resizeTrail();
    });

    // ─── NAVBAR SCROLL ────────────────────────────────────
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 60);
    }, { passive: true });

    // ─── MOBILE MENU ──────────────────────────────────────
    const mobileToggle = document.getElementById('mobileToggle');
    const mobileMenu = document.getElementById('mobileMenu');
    mobileToggle.addEventListener('click', () => {
        mobileToggle.classList.toggle('active');
        mobileMenu.classList.toggle('open');
    });
    mobileMenu.querySelectorAll('a').forEach((a) =>
        a.addEventListener('click', () => {
            mobileToggle.classList.remove('active');
            mobileMenu.classList.remove('open');
        })
    );

    // ─── SCROLL REVEAL ────────────────────────────────────
    const revealEls = document.querySelectorAll('.reveal');
    const revealObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    revealObserver.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.1, rootMargin: '0px 0px -30px 0px' }
    );
    revealEls.forEach((el) => revealObserver.observe(el));

    // ─── STAT COUNTER ─────────────────────────────────────
    const statNumbers = document.querySelectorAll('.stat-number');
    const statObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    const target = parseInt(el.getAttribute('data-target'), 10);
                    animateCounter(el, target);
                    statObserver.unobserve(el);
                }
            });
        },
        { threshold: 0.5 }
    );
    statNumbers.forEach((el) => statObserver.observe(el));

    function animateCounter(el, target) {
        const duration = 2000;
        const start = performance.now();
        function tick(now) {
            const progress = clamp((now - start) / duration, 0, 1);
            const eased = 1 - Math.pow(1 - progress, 4);
            el.textContent = Math.round(eased * target).toLocaleString();
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    // ─── TWEAK PANELS ─────────────────────────────────────
    document.querySelectorAll('.tweak-header').forEach((header) => {
        header.addEventListener('click', () => {
            const panel = header.closest('.tweak-panel');
            const isOpen = panel.classList.contains('open');
            document.querySelectorAll('.tweak-panel.open').forEach((p) => p.classList.remove('open'));
            if (!isOpen) panel.classList.add('open');
        });
    });

    // ─── FAQ ACCORDIONS ───────────────────────────────────
    document.querySelectorAll('.faq-question').forEach((btn) => {
        btn.addEventListener('click', () => {
            const item = btn.closest('.faq-item');
            const isOpen = item.classList.contains('open');
            document.querySelectorAll('.faq-item.open').forEach((i) => i.classList.remove('open'));
            if (!isOpen) item.classList.add('open');
        });
    });

    // ─── SMOOTH ANCHOR SCROLL ─────────────────────────────
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
        a.addEventListener('click', (e) => {
            const id = a.getAttribute('href');
            if (id.length < 2) return;
            const target = document.querySelector(id);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // ─── BACKGROUND MUSIC ─────────────────────────────────
    const bgMusic = document.getElementById('bgMusic');
    const musicBtn = document.getElementById('musicToggle');
    let musicStarted = false;

    if (bgMusic) {
        bgMusic.volume = 0.2;
    }

    musicBtn.addEventListener('click', () => {
        if (!musicStarted) {
            bgMusic.play().then(() => {
                musicStarted = true;
                musicBtn.classList.add('playing');
                musicBtn.classList.remove('muted');
            }).catch(() => { });
            return;
        }
        if (bgMusic.paused) {
            bgMusic.play();
            musicBtn.classList.add('playing');
            musicBtn.classList.remove('muted');
        } else {
            bgMusic.pause();
            musicBtn.classList.remove('playing');
            musicBtn.classList.add('muted');
        }
    });

    // Auto-play attempt on first user interaction
    document.addEventListener('click', () => {
        if (!musicStarted && bgMusic) {
            bgMusic.play().then(() => {
                musicStarted = true;
                musicBtn.classList.add('playing');
                musicBtn.classList.remove('muted');
            }).catch(() => { });
        }
    }, { once: true });

})();
