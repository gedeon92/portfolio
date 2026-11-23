/* =====================================================================
   Transitions entre sections en particules.
   Avant chaque section, une scène plein écran (.interlude) se fige au
   défilement : les particules s'envolent et forment le symbole de la
   section suivante — même principe que « Le voyage de la donnée ».
   ===================================================================== */
(function () {
    'use strict';

    // symbole de chaque section (caractères Font Awesome)
    const GLYPHS = {
        about: '',      // astronaute
        skills: '',     // code </>
        projects: '',   // fusée
        experience: '', // mallette
        education: '',  // chapeau de diplômé
        contact: '',    // antenne satellite
    };

    const interludes = Array.from(document.querySelectorAll('.interlude'));
    if (!interludes.length) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const story = document.getElementById('story');

    const canvas = document.createElement('canvas');
    canvas.className = 'bg-particles';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);
    const ctx = canvas.getContext('2d');

    const ORANGE = [255, 122, 47];
    const BLUE = [59, 108, 255];
    const FONT = '"Font Awesome 6 Free"';
    const MORPH_END = 0.55; // la forme est complète à 55 % de la scène

    let W = 0, H = 0, DPR = 1, N = 0, mobile = false;
    let scene = { cx: 0, cy: 0, s: 0 };
    let formations = [];
    let particles = [];
    let pos = 0;

    const rand = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

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
        N = mobile ? 1000 : 2200;
        scene = mobile
            ? { cx: W * 0.5, cy: H * 0.34, s: Math.min(W, H) * 0.34 }
            : { cx: W * 0.68, cy: H * 0.5, s: Math.min(W * 0.5, H) * 0.4 };

        formations = [stars()].concat(
            interludes.map((el) => (GLYPHS[el.dataset.for] ? glyphPoints(GLYPHS[el.dataset.for]) : stars()))
        );
        particles = Array.from({ length: N }, () => ({
            delay: Math.random(),
            arc: rand(-0.4, 0.4),
            phase: rand(0, Math.PI * 2),
            speed: rand(0.6, 1.4),
            size: rand(1.1, 2.4),
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
            // visibilité de la scène (1 = plein écran)
            const vis = clamp(Math.min((H - r.top) / (H * 0.5), r.bottom / (H * 0.5)), 0, 1);
            stage = Math.max(stage, vis);
            el.classList.toggle('is-active', u > 0.08 && u < 0.97);
        });
        return { target, stage };
    }

    function storyCover() {
        if (!story) return 0;
        const r = story.getBoundingClientRect();
        return Math.min(clamp((H - r.top) / (H * 0.6), 0, 1), clamp(r.bottom / (H * 0.6), 0, 1));
    }

    // ---------- Rendu ----------
    function draw(time) {
        ctx.clearRect(0, 0, W, H);

        const last = formations.length - 1;
        const from = Math.min(Math.floor(pos), last);
        const to = Math.min(from + 1, last);
        const t = pos - from;
        const A = formations[from], B = formations[to];
        const left = scene.cx - scene.s, span = scene.s * 2;

        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < N; i++) {
            const pt = particles[i];
            const local = reduceMotion ? (t > 0.5 ? 1 : 0) : ease(clamp(t * 1.5 - pt.delay * 0.5, 0, 1));
            const ax = A[i][0], ay = A[i][1], bx = B[i][0], by = B[i][1];
            const dx = bx - ax, dy = by - ay;
            const bend = Math.sin(local * Math.PI) * pt.arc;
            let x = ax + dx * local - dy * bend;
            let y = ay + dy * local + dx * bend;
            x += Math.sin(time * 0.001 * pt.speed + pt.phase) * 1.4;
            y += Math.cos(time * 0.0012 * pt.speed + pt.phase) * 1.4;

            const colored = from === 0 ? local : 1;
            const g = clamp((x - left) / span, 0, 1);
            const r = (ORANGE[0] + (BLUE[0] - ORANGE[0]) * g) * colored + 255 * (1 - colored);
            const gg = (ORANGE[1] + (BLUE[1] - ORANGE[1]) * g) * colored + 255 * (1 - colored);
            const b = (ORANGE[2] + (BLUE[2] - ORANGE[2]) * g) * colored + 255 * (1 - colored);
            const alpha = from === 0 && t === 0 ? 0.4 : 0.85;

            ctx.fillStyle = `rgba(${r | 0},${gg | 0},${b | 0},${alpha})`;
            ctx.fillRect(x - pt.size / 2, y - pt.size / 2, pt.size, pt.size);
        }
        ctx.globalCompositeOperation = 'source-over';
    }

    // ?scenep=2.5 dans l'adresse fige la forme à ce moment (pour les tests)
    const forced = parseFloat(new URLSearchParams(location.search).get('scenep'));

    function loop(time) {
        const { target, stage } = measure();
        const goal = isNaN(forced) ? target : forced;
        pos += (goal - pos) * (reduceMotion || !isNaN(forced) ? 1 : 0.08);

        // plein éclat pendant les scènes, très discret pendant le contenu
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
