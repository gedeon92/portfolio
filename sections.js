/* =====================================================================
   Transitions entre sections en particules.
   Avant chaque section, une scène plein écran (.interlude) se fige au
   défilement : les particules tourbillonnent et forment le symbole de la
   section suivante, avec nébuleuse, anneaux en orbite et effet hyperespace.
   ===================================================================== */
(function () {
    'use strict';

    // symbole (caractère Font Awesome) et palette de chaque section
    const SCENES = {
        about:      { glyph: '', colors: ['#ff7a2f', '#ff4f8b'] }, // astronaute
        skills:     { glyph: '', colors: ['#29d3ff', '#3b6cff'] }, // code </>
        projects:   { glyph: '', colors: ['#ffb02e', '#ff4f4f'] }, // fusée
        experience: { glyph: '', colors: ['#b26bff', '#3b6cff'] }, // mallette
        education:  { glyph: '', colors: ['#2bd5a0', '#29a3ff'] }, // diplôme
        contact:    { glyph: '', colors: ['#ff7a2f', '#3b6cff'] }, // antenne
    };
    const STAR_COLORS = ['#ffffff', '#ffffff'];

    const interludes = Array.from(document.querySelectorAll('.interlude'));
    if (!interludes.length) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const story = document.getElementById('story');

    const canvas = document.createElement('canvas');
    canvas.className = 'bg-particles';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);
    const ctx = canvas.getContext('2d');

    const FONT = '"Font Awesome 6 Free"';
    const MORPH_END = 0.55;

    const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const palettes = [STAR_COLORS.map(hex)].concat(
        interludes.map((el) => (SCENES[el.dataset.for] || SCENES.contact).colors.map(hex))
    );

    let W = 0, H = 0, DPR = 1, N = 0, mobile = false;
    let scene = { cx: 0, cy: 0, s: 0 };
    let formations = [];
    let particles = [];
    let warp = [];
    let pos = 0;
    let prev = null;
    let burstAt = -1e9, lastShape = 0;
    const mouse = { x: -1e4, y: -1e4 };
    window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
    window.addEventListener('mouseleave', () => { mouse.x = mouse.y = -1e4; });

    const rand = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

    // ---------- Décor des scènes (numéro géant, titre ligne par ligne, barre) ----------
    interludes.forEach((el) => {
        const pin = el.querySelector('.interlude-pin');
        const label = el.querySelector('.story-label');
        const sc = SCENES[el.dataset.for] || SCENES.contact;
        el.style.setProperty('--c1', sc.colors[0]);
        el.style.setProperty('--c2', sc.colors[1]);

        const num = document.createElement('span');
        num.className = 'interlude-num';
        num.textContent = label ? label.textContent.trim().slice(0, 2) : '';
        pin.prepend(num);

        const title = el.querySelector('.story-title');
        if (title) {
            const lines = title.innerHTML.split(/<br\s*\/?>/i);
            title.innerHTML = lines
                .map((l, i) => `<span class="line"><span style="transition-delay:${0.08 + i * 0.09}s">${l}</span></span>`)
                .join('');
        }

        const bar = document.createElement('div');
        bar.className = 'interlude-progress';
        bar.innerHTML = '<span></span>';
        pin.appendChild(bar);
    });

    // ---------- Formes ----------
    function stars() {
        return Array.from({ length: N }, () => [rand(0, W), rand(0, H)]);
    }

    function glyphPoints(glyph) {
        const size = 260;
        const off = document.createElement('canvas');
        off.width = off.height = size;
        const o = off.getContext('2d');
        o.fillStyle = '#fff';
        o.textAlign = 'center';
        o.textBaseline = 'middle';
        o.font = `900 ${size * 0.82}px ${FONT}`;
        o.fillText(glyph, size / 2, size / 2);
        const data = o.getImageData(0, 0, size, size).data;
        const inside = [];
        for (let y = 0; y < size; y += 2) {
            for (let x = 0; x < size; x += 2) {
                if (data[(y * size + x) * 4 + 3] > 128) inside.push([x, y]);
            }
        }
        if (!inside.length) return stars();
        const k = (scene.s * 2) / size;
        return Array.from({ length: N }, () => {
            const [x, y] = inside[(Math.random() * inside.length) | 0];
            return [scene.cx + (x - size / 2 + rand(-1, 1)) * k, scene.cy + (y - size / 2 + rand(-1, 1)) * k];
        });
    }

    function layout() {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = W * DPR;
        canvas.height = H * DPR;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

        mobile = W < 900;
        N = mobile ? 1100 : 2600;
        scene = mobile
            ? { cx: W * 0.5, cy: H * 0.34, s: Math.min(W, H) * 0.38 }
            : { cx: W * 0.68, cy: H * 0.5, s: Math.min(W * 0.5, H) * 0.46 };

        formations = [stars()].concat(
            interludes.map((el) => glyphPoints((SCENES[el.dataset.for] || SCENES.contact).glyph))
        );
        prev = new Float32Array(N * 2).fill(NaN);
        particles = Array.from({ length: N }, () => ({
            delay: Math.random(),
            arc: rand(-0.4, 0.4),
            spin: rand(-1.4, 1.4),
            phase: rand(0, Math.PI * 2),
            speed: rand(0.6, 1.4),
            size: rand(1.3, 2.9),
            tw: rand(0.0015, 0.004),
        }));
        warp = Array.from({ length: mobile ? 70 : 150 }, () => ({
            a: rand(0, Math.PI * 2),
            o: Math.random(),
            v: rand(0.6, 1.6),
            w: rand(0.6, 1.8),
        }));
    }

    // ---------- Lecture du défilement ----------
    function measure() {
        let target = 0, stage = 0;
        interludes.forEach((el) => {
            const r = el.getBoundingClientRect();
            const run = el.offsetHeight - H;
            const u = clamp(-r.top / run, 0, 1);
            target += clamp(u / MORPH_END, 0, 1);
            const vis = clamp(Math.min((H - r.top) / (H * 0.5), r.bottom / (H * 0.5)), 0, 1);
            stage = Math.max(stage, vis);
            el.classList.toggle('is-active', u > 0.08 && u < 0.97);
            el.style.setProperty('--u', u.toFixed(4));
        });
        return { target, stage };
    }

    function storyCover() {
        if (!story) return 0;
        const r = story.getBoundingClientRect();
        return Math.min(clamp((H - r.top) / (H * 0.6), 0, 1), clamp(r.bottom / (H * 0.6), 0, 1));
    }

    // ---------- Éléments de décor dessinés ----------
    function drawNebula(c1, c2, strength) {
        const R = scene.s * 1.9;
        const g = ctx.createRadialGradient(scene.cx - scene.s * 0.2, scene.cy - scene.s * 0.2, 0, scene.cx, scene.cy, R);
        g.addColorStop(0, rgba(c1, 0.22 * strength));
        g.addColorStop(0.45, rgba(c2, 0.12 * strength));
        g.addColorStop(1, rgba(c2, 0));
        ctx.fillStyle = g;
        ctx.fillRect(scene.cx - R, scene.cy - R, R * 2, R * 2);
    }

    function drawOrbits(time, c1, c2, strength) {
        const rings = [
            { rx: 1.35, ry: 0.42, tilt: -0.35, speed: 0.00035, col: c1 },
            { rx: 1.15, ry: 0.3, tilt: 0.5, speed: -0.00025, col: c2 },
        ];
        rings.forEach((rg, i) => {
            const rx = scene.s * rg.rx, ry = scene.s * rg.ry;
            ctx.save();
            ctx.translate(scene.cx, scene.cy);
            ctx.rotate(rg.tilt + Math.sin(time * 0.0002 + i) * 0.08);
            ctx.strokeStyle = rgba(rg.col, 0.28 * strength);
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 6]);
            ctx.beginPath();
            ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            // petite lune lumineuse en orbite
            const a = time * rg.speed * (reduceMotion ? 0 : 1) + i * 2;
            const mx = Math.cos(a) * rx, my = Math.sin(a) * ry;
            const g = ctx.createRadialGradient(mx, my, 0, mx, my, 14);
            g.addColorStop(0, rgba([255, 255, 255], 0.95 * strength));
            g.addColorStop(0.35, rgba(rg.col, 0.8 * strength));
            g.addColorStop(1, rgba(rg.col, 0));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(mx, my, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }

    function drawWarp(time, flying, c1, c2) {
        if (flying < 0.12 || reduceMotion) return;
        const maxR = Math.hypot(W, H) * 0.6;
        ctx.lineCap = 'round';
        warp.forEach((w) => {
            const life = (w.o + time * 0.0006 * w.v) % 1;
            const r1 = scene.s * 0.25 + life * maxR;
            const len = (40 + 220 * life) * flying;
            const ca = Math.cos(w.a), sa = Math.sin(w.a);
            const col = mix(c1, c2, (Math.sin(w.a * 3) + 1) / 2);
            const grad = ctx.createLinearGradient(scene.cx + ca * r1, scene.cy + sa * r1, scene.cx + ca * (r1 + len), scene.cy + sa * (r1 + len));
            grad.addColorStop(0, rgba(col, 0));
            grad.addColorStop(1, rgba([255, 255, 255], 0.75 * flying * (1 - life * 0.6)));
            ctx.strokeStyle = grad;
            ctx.lineWidth = w.w;
            ctx.beginPath();
            ctx.moveTo(scene.cx + ca * r1, scene.cy + sa * r1);
            ctx.lineTo(scene.cx + ca * (r1 + len), scene.cy + sa * (r1 + len));
            ctx.stroke();
        });
    }

    function drawBurst(time, c1, c2) {
        const age = (time - burstAt) / 1200;
        if (age < 0 || age >= 1 || reduceMotion) return;
        const halo = ctx.createRadialGradient(scene.cx, scene.cy, 0, scene.cx, scene.cy, scene.s * 1.4);
        halo.addColorStop(0, rgba([255, 255, 255], 0.35 * (1 - age)));
        halo.addColorStop(0.3, rgba(c1, 0.25 * (1 - age)));
        halo.addColorStop(1, rgba(c2, 0));
        ctx.fillStyle = halo;
        ctx.fillRect(scene.cx - scene.s * 1.4, scene.cy - scene.s * 1.4, scene.s * 2.8, scene.s * 2.8);
        for (let k = 0; k < 3; k++) {
            const a2 = clamp(age * 1.3 - k * 0.15, 0, 1);
            if (a2 <= 0 || a2 >= 1) continue;
            const rr = scene.s * (0.3 + 1.5 * (1 - Math.pow(1 - a2, 3)));
            const ring = ctx.createLinearGradient(scene.cx - rr, 0, scene.cx + rr, 0);
            ring.addColorStop(0, rgba(c1, 0.85 * (1 - a2)));
            ring.addColorStop(1, rgba(c2, 0.85 * (1 - a2)));
            ctx.strokeStyle = ring;
            ctx.lineWidth = 2.5 - k * 0.7;
            ctx.beginPath();
            ctx.arc(scene.cx, scene.cy, rr, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // ---------- Rendu ----------
    function draw(time) {
        ctx.clearRect(0, 0, W, H);

        const last = formations.length - 1;
        const from = Math.min(Math.floor(pos), last);
        const to = Math.min(from + 1, last);
        const t = pos - from;
        const A = formations[from], B = formations[to];
        const flying = Math.sin(clamp(t, 0, 1) * Math.PI);

        // palette de la scène (mélange pendant la transition)
        const pk = ease(clamp(t, 0, 1));
        const c1 = mix(palettes[from][0], palettes[to][0], pk);
        const c2 = mix(palettes[from][1], palettes[to][1], pk);
        const formed = from === 0 ? pk : 1; // 0 = étoiles, 1 = symbole

        ctx.globalCompositeOperation = 'lighter';
        drawNebula(c1, c2, formed);
        drawWarp(time, flying, c1, c2);
        drawOrbits(time, c1, c2, formed * (1 - flying * 0.6));
        drawBurst(time, c1, c2);

        const theta = reduceMotion ? 0 : Math.sin(time * 0.00035) * 0.55;
        const cosT = Math.cos(theta), sinT = Math.sin(theta);
        const floatY = reduceMotion ? 0 : Math.sin(time * 0.0008) * 8;
        const repel = mobile ? 0 : 130;
        const left = scene.cx - scene.s, span = scene.s * 2;

        for (let i = 0; i < N; i++) {
            const pt = particles[i];
            const local = reduceMotion ? (t > 0.5 ? 1 : 0) : ease(clamp(t * 1.5 - pt.delay * 0.5, 0, 1));
            const ax = A[i][0], ay = A[i][1], bx = B[i][0], by = B[i][1];
            const dx = bx - ax, dy = by - ay;
            const bend = Math.sin(local * Math.PI) * pt.arc;
            let x = ax + dx * local - dy * bend;
            let y = ay + dy * local + dx * bend;

            // tourbillon autour du centre pendant le vol
            const swirl = Math.sin(local * Math.PI) * pt.spin;
            if (swirl && !reduceMotion) {
                const ox = x - scene.cx, oy = y - scene.cy;
                const cs = Math.cos(swirl), sn = Math.sin(swirl);
                x = scene.cx + ox * cs - oy * sn;
                y = scene.cy + ox * sn + oy * cs;
            }

            // pivot 3D doux et flottement du symbole
            const w = from === 0 ? local : 1;
            if (w > 0) {
                const rx = x - scene.cx;
                const persp = 1 + (rx / scene.s) * sinT * 0.12;
                x = scene.cx + rx * (1 + (cosT - 1) * w);
                y = scene.cy + (y - scene.cy) * (1 + (persp - 1) * w) + floatY * w;
            }

            x += Math.sin(time * 0.001 * pt.speed + pt.phase) * 1.4;
            y += Math.cos(time * 0.0012 * pt.speed + pt.phase) * 1.4;

            if (repel) {
                const mx = x - mouse.x, my = y - mouse.y;
                const md = Math.hypot(mx, my);
                if (md < repel && md > 0.1) {
                    const f = (1 - md / repel) * 38;
                    x += (mx / md) * f;
                    y += (my / md) * f;
                }
            }

            // couleur : blanc (étoiles) → dégradé de la palette selon la position
            const g = clamp((x - left) / span, 0, 1);
            const pc = mix(c1, c2, g);
            const colored = from === 0 ? local : 1;
            const col = mix([255, 255, 255], pc, colored);
            const alpha = from === 0 && t === 0 ? 0.4 : 0.9;

            const px = prev[i * 2], py = prev[i * 2 + 1];
            const moved = px === px ? Math.hypot(x - px, y - py) : 0;
            if (moved > 2.5 && moved < 180 && !reduceMotion) {
                ctx.strokeStyle = rgba(col, alpha);
                ctx.lineWidth = pt.size * 0.9;
                ctx.beginPath();
                ctx.moveTo(x - (x - px) * 2.4, y - (y - py) * 2.4);
                ctx.lineTo(x, y);
                ctx.stroke();
            } else {
                ctx.fillStyle = rgba(col, alpha);
                ctx.fillRect(x - pt.size / 2, y - pt.size / 2, pt.size, pt.size);
            }

            // halo doux (une particule sur quatre) et scintillements
            if (i % 4 === 0 && colored > 0.5) {
                ctx.fillStyle = rgba(pc, 0.07);
                ctx.beginPath();
                ctx.arc(x, y, pt.size * 4, 0, Math.PI * 2);
                ctx.fill();
            }
            if (!reduceMotion && Math.sin(time * pt.tw + pt.phase * 7) > 0.985) {
                ctx.fillStyle = 'rgba(255,255,255,0.95)';
                ctx.beginPath();
                ctx.arc(x, y, pt.size * 1.4, 0, Math.PI * 2);
                ctx.fill();
            }

            prev[i * 2] = x;
            prev[i * 2 + 1] = y;
        }
        ctx.globalCompositeOperation = 'source-over';
    }

    // ?scenep=2.5 dans l'adresse fige la forme à ce moment (pour les tests)
    const forced = parseFloat(new URLSearchParams(location.search).get('scenep'));

    function loop(time) {
        const { target, stage } = measure();
        const goal = isNaN(forced) ? target : forced;
        pos += (goal - pos) * (reduceMotion || !isNaN(forced) ? 1 : 0.08);

        const nearest = Math.round(pos);
        if (nearest > 0 && Math.abs(pos - nearest) < 0.02 && nearest !== lastShape) {
            burstAt = time;
            lastShape = nearest;
        } else if (Math.abs(pos - lastShape) > 0.6) {
            lastShape = -1;
        }

        const visible = (isNaN(forced) ? Math.max(0.12, stage) : 1) * (1 - storyCover());
        canvas.style.opacity = visible.toFixed(3);
        if (visible > 0.01) draw(time);
        requestAnimationFrame(loop);
    }

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(layout, 150);
    });

    const start = () => {
        layout();
        requestAnimationFrame(loop);
    };
    if (document.fonts && document.fonts.load) {
        document.fonts.load(`900 40px ${FONT}`).then(start, start);
    } else {
        start();
    }
})();
