/* =====================================================================
   « Le voyage de la donnée » — animation pilotée par le défilement.
   Des particules passent d'une forme à l'autre au fil du scroll :
   étoiles → cube de données → application → tableau de bord → réseau IA.
   ===================================================================== */
(function () {
    'use strict';

    const section = document.getElementById('story');
    const canvas = document.getElementById('story-canvas');
    if (!section || !canvas) return;

    const ctx = canvas.getContext('2d');
    const steps = Array.from(section.querySelectorAll('.story-step'));
    const bar = section.querySelector('.story-progress-fill');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ORANGE = [255, 122, 47];
    const BLUE = [59, 108, 255];

    // Moments (0 → 1) où chaque forme est complète.
    const STOPS = [0, 0.2, 0.45, 0.7, 0.93];

    let W = 0, H = 0, DPR = 1, N = 0;
    let particles = [];
    let formations = [];
    let scene = { cx: 0, cy: 0, s: 0 };
    let targetP = 0, p = 0;
    let netNodes = [];

    const rand = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    // ---------- Formes ----------
    function pick(list, n) {
        const out = [];
        for (let i = 0; i < n; i++) out.push(list(i, n));
        return out;
    }

    function onSegment(x1, y1, x2, y2) {
        const t = Math.random();
        return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
    }

    function formStars() {
        return pick(() => [rand(0, W), rand(0, H)], N);
    }

    function formCube() {
        const { cx, cy, s } = scene;
        const a = s * 0.62;
        const c = Math.cos(Math.PI / 6), sn = Math.sin(Math.PI / 6);
        // projection isométrique d'un point 3D (x, y, z) du cube [0, a]^3
        const iso = (x, y, z) => [cx + (x - z) * c, cy + (x + z) * sn - y - a * 0.1];
        const edges = [
            [[0, a, 0], [a, a, 0]], [[a, a, 0], [a, a, a]], [[a, a, a], [0, a, a]], [[0, a, a], [0, a, 0]],
            [[a, 0, 0], [a, a, 0]], [[a, 0, a], [a, a, a]], [[0, 0, a], [0, a, a]],
            [[a, 0, 0], [a, 0, a]], [[a, 0, a], [0, 0, a]],
        ];
        return pick(() => {
            const r = Math.random();
            if (r < 0.45) {
                const [e1, e2] = edges[(Math.random() * edges.length) | 0];
                const t = Math.random();
                return iso(e1[0] + (e2[0] - e1[0]) * t, e1[1] + (e2[1] - e1[1]) * t, e1[2] + (e2[2] - e1[2]) * t);
            }
            const u = rand(0, a), v = rand(0, a);
            if (r < 0.65) return iso(u, a, v);      // dessus
            if (r < 0.83) return iso(a, v, u);      // face droite
            return iso(u, v, a);                     // face gauche
        }, N);
    }

    function formWindow() {
        const { cx, cy, s } = scene;
        const w = s * 1.55, h = s * 1.05;
        const x0 = cx - w / 2, y0 = cy - h / 2;
        const header = y0 + h * 0.13;
        const lines = [];
        const indents = [0, 1, 2, 2, 1, 2, 3, 1, 0];
        indents.forEach((ind, i) => {
            const lx = x0 + w * 0.07 + ind * w * 0.06;
            const len = rand(0.25, 0.62) * w;
            lines.push([lx, header + h * 0.09 + i * h * 0.085, Math.min(lx + len, x0 + w * 0.92)]);
        });
        return pick(() => {
            const r = Math.random();
            if (r < 0.28) {
                const side = (Math.random() * 4) | 0;
                if (side === 0) return onSegment(x0, y0, x0 + w, y0);
                if (side === 1) return onSegment(x0 + w, y0, x0 + w, y0 + h);
                if (side === 2) return onSegment(x0, y0 + h, x0 + w, y0 + h);
                return onSegment(x0, y0, x0, y0 + h);
            }
            if (r < 0.36) return onSegment(x0, header, x0 + w, header);
            if (r < 0.42) {
                const k = (Math.random() * 3) | 0, ang = rand(0, Math.PI * 2), rr = h * 0.022;
                return [x0 + w * 0.05 + k * w * 0.04 + Math.cos(ang) * rr, y0 + h * 0.065 + Math.sin(ang) * rr];
            }
            const [lx, ly, lx2] = lines[(Math.random() * lines.length) | 0];
            return [rand(lx, lx2), ly + rand(-1.2, 1.2)];
        }, N);
    }

    function formDashboard() {
        const { cx, cy, s } = scene;
        const w = s * 1.55, h = s * 1.05;
        const x0 = cx - w / 2, yb = cy + h / 2;
        const heights = [0.32, 0.48, 0.41, 0.62, 0.55, 0.78, 0.9];
        const bw = w / (heights.length * 1.6);
        const curve = (t) => {
            const x = x0 + t * w;
            const y = yb - h * (0.45 + 0.4 * t + 0.08 * Math.sin(t * Math.PI * 3));
            return [x, y];
        };
        return pick(() => {
            const r = Math.random();
            if (r < 0.1) return Math.random() < 0.5 ? onSegment(x0, yb, x0 + w, yb) : onSegment(x0, yb, x0, yb - h);
            if (r < 0.68) {
                const k = (Math.random() * heights.length) | 0;
                const bx = x0 + bw * 0.6 + k * bw * 1.6;
                const bh = heights[k] * h * 0.75;
                const q = Math.random();
                if (q < 0.3) return [rand(bx, bx + bw), rand(yb - bh, yb)];
                if (q < 0.55) return onSegment(bx, yb - bh, bx + bw, yb - bh);
                if (q < 0.78) return onSegment(bx, yb - bh, bx, yb);
                return onSegment(bx + bw, yb - bh, bx + bw, yb);
            }
            const [x, y] = curve(Math.random());
            return [x, y + rand(-0.6, 0.6)];
        }, N);
    }

    function formNetwork() {
        const { cx, cy, s } = scene;
        const layers = [4, 6, 6, 3];
        const w = s * 1.6, h = s * 1.15;
        const nodes = layers.map((count, li) =>
            Array.from({ length: count }, (_, ni) => [
                cx - w / 2 + (li / (layers.length - 1)) * w,
                cy - h / 2 + ((ni + 0.5) / count) * h,
            ])
        );
        netNodes = nodes;
        return pick(() => {
            if (Math.random() < 0.5) {
                const layer = nodes[(Math.random() * nodes.length) | 0];
                const [nx, ny] = layer[(Math.random() * layer.length) | 0];
                const ang = rand(0, Math.PI * 2), rr = Math.abs(rand(-1, 1) * rand(0, 1)) * s * 0.05;
                return [nx + Math.cos(ang) * rr, ny + Math.sin(ang) * rr];
            }
            const li = (Math.random() * (nodes.length - 1)) | 0;
            const a = nodes[li][(Math.random() * nodes[li].length) | 0];
            const b = nodes[li + 1][(Math.random() * nodes[li + 1].length) | 0];
            return onSegment(a[0], a[1], b[0], b[1]);
        }, N);
    }

    // ---------- Mise en place ----------
    function layout() {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = canvas.clientWidth;
        H = canvas.clientHeight;
        canvas.width = W * DPR;
        canvas.height = H * DPR;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

        const mobile = W < 900;
        N = mobile ? 1100 : 2400;
        scene = mobile
            ? { cx: W * 0.5, cy: H * 0.36, s: Math.min(W, H) * 0.34 }
            : { cx: W * 0.66, cy: H * 0.5, s: Math.min(W * 0.5, H) * 0.36 };

        formations = [formStars(), formCube(), formWindow(), formDashboard(), formNetwork()];
        particles = Array.from({ length: N }, () => ({
            delay: Math.random(),
            arc: rand(-0.35, 0.35),
            phase: rand(0, Math.PI * 2),
            speed: rand(0.6, 1.4),
            size: rand(1.1, 2.4),
        }));
    }

    // ---------- Rendu ----------
    function segmentFor(prog) {
        for (let i = 0; i < STOPS.length - 1; i++) {
            if (prog <= STOPS[i + 1]) {
                const u = (prog - STOPS[i]) / (STOPS[i + 1] - STOPS[i]);
                return { from: i, to: i + 1, t: clamp((u - 0.12) / 0.76, 0, 1) };
            }
        }
        return { from: STOPS.length - 1, to: STOPS.length - 1, t: 1 };
    }

    function draw(time) {
        ctx.clearRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'lighter';

        const { from, to, t } = segmentFor(p);
        const A = formations[from], B = formations[to];
        const left = scene.cx - scene.s * 0.9, span = scene.s * 1.8;

        for (let i = 0; i < N; i++) {
            const pt = particles[i];
            const local = reduceMotion ? t : ease(clamp(t * 1.5 - pt.delay * 0.5, 0, 1));
            const ax = A[i][0], ay = A[i][1], bx = B[i][0], by = B[i][1];
            const dx = bx - ax, dy = by - ay;
            const bend = Math.sin(local * Math.PI) * pt.arc;
            let x = ax + dx * local - dy * bend;
            let y = ay + dy * local + dx * bend;

            // petite respiration permanente pour que la scène reste vivante
            const wob = 1.4;
            x += Math.sin(time * 0.001 * pt.speed + pt.phase) * wob;
            y += Math.cos(time * 0.0012 * pt.speed + pt.phase) * wob;

            // couleur : blanc (étoiles) → dégradé orange-bleu selon la position
            const formed = from === 0 ? local : 1;
            const g = clamp((x - left) / span, 0, 1);
            const r = (ORANGE[0] + (BLUE[0] - ORANGE[0]) * g) * formed + 255 * (1 - formed);
            const gg = (ORANGE[1] + (BLUE[1] - ORANGE[1]) * g) * formed + 255 * (1 - formed);
            const b = (ORANGE[2] + (BLUE[2] - ORANGE[2]) * g) * formed + 255 * (1 - formed);
            const alpha = from === 0 ? 0.35 + 0.5 * local : 0.85;

            ctx.fillStyle = `rgba(${r | 0},${gg | 0},${b | 0},${alpha})`;
            const sz = pt.size;
            ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
        }
        ctx.globalCompositeOperation = 'source-over';

        // lignes du réseau de neurones, qui s'allument à la dernière étape
        if (to === 4 && netNodes.length) {
            const k = from === 4 ? 1 : t;
            if (k > 0.05) {
                ctx.lineWidth = 0.6;
                for (let li = 0; li < netNodes.length - 1; li++) {
                    for (const a of netNodes[li]) {
                        for (const b of netNodes[li + 1]) {
                            const grad = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
                            grad.addColorStop(0, `rgba(255,122,47,${0.22 * k})`);
                            grad.addColorStop(1, `rgba(59,108,255,${0.22 * k})`);
                            ctx.strokeStyle = grad;
                            ctx.beginPath();
                            ctx.moveTo(a[0], a[1]);
                            ctx.lineTo(b[0], b[1]);
                            ctx.stroke();
                        }
                    }
                }
                for (const layer of netNodes) {
                    for (const [nx, ny] of layer) {
                        const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, scene.s * 0.09);
                        g.addColorStop(0, `rgba(255,255,255,${0.35 * k})`);
                        g.addColorStop(1, 'rgba(255,255,255,0)');
                        ctx.fillStyle = g;
                        ctx.fillRect(nx - scene.s * 0.09, ny - scene.s * 0.09, scene.s * 0.18, scene.s * 0.18);
                    }
                }
            }
        }
    }

    function updateSteps() {
        steps.forEach((el) => {
            const a = parseFloat(el.dataset.from), b = parseFloat(el.dataset.to);
            el.classList.toggle('is-active', p >= a && p < b);
        });
        if (bar) bar.style.transform = `scaleX(${p})`;
    }

    // ?storyp=0.5 dans l'adresse fige l'animation à ce moment (pour les tests)
    const forcedP = parseFloat(new URLSearchParams(location.search).get('storyp'));

    function readScroll() {
        if (!isNaN(forcedP)) { targetP = clamp(forcedP, 0, 1); return; }
        const rect = section.getBoundingClientRect();
        const total = section.offsetHeight - window.innerHeight;
        targetP = clamp(-rect.top / total, 0, 1);
    }

    let visible = true;
    new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
    }).observe(section);

    function loop(time) {
        readScroll();
        p += (targetP - p) * (reduceMotion || !isNaN(forcedP) ? 1 : 0.09);
        if (visible) {
            draw(time);
            updateSteps();
        }
        requestAnimationFrame(loop);
    }

    // ---------- Défilement glissé (effet « vidéo ») ----------
    if (window.Lenis && !reduceMotion) {
        const lenis = new window.Lenis({ duration: 1.2, smoothWheel: true });
        window.__lenis = lenis;
        const raf = (time) => {
            lenis.raf(time);
            requestAnimationFrame(raf);
        };
        requestAnimationFrame(raf);
    }

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(layout, 150);
    });

    layout();
    requestAnimationFrame(loop);

    // ---------- Travelling de l'en-tête ----------
    const hero = document.querySelector('.hero');
    if (hero && !reduceMotion) {
        const updateHero = () => {
            const hp = clamp(window.scrollY / window.innerHeight, 0, 1);
            hero.style.setProperty('--hp', hp.toFixed(4));
            requestAnimationFrame(updateHero);
        };
        requestAnimationFrame(updateHero);
    }

    // ---------- Titres qui se dévoilent ----------
    document.documentElement.classList.add('js-anim');
    const headers = document.querySelectorAll('.section-header');
    const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
            if (e.isIntersecting) {
                e.target.classList.add('in-view');
                io.unobserve(e.target);
            }
        });
    }, { threshold: 0.3 });
    headers.forEach((h) => io.observe(h));
})();
