/* =====================================================================
   « Voyage en avion » entre les sections.
   - Carte de vol fixe : chaque section est une escale, l'avion suit
     la route au fil du défilement.
   - À chaque changement de section : un avion traverse l'écran et un
     panneau façon aéroport annonce la nouvelle escale.
   ===================================================================== */
(function () {
    'use strict';

    const STOPS = [
        { id: 'home', label: 'Accueil' },
        { id: 'about', label: 'À propos' },
        { id: 'skills', label: 'Compétences' },
        { id: 'projects', label: 'Projets' },
        { id: 'experience', label: 'Expériences' },
        { id: 'education', label: 'Formation' },
        { id: 'contact', label: 'Contact' },
    ].filter((s) => document.getElementById(s.id));

    if (STOPS.length < 2) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const VB_W = 120, VB_H = 700, PAD = 30;
    const pad2 = (n) => String(n).padStart(2, '0');

    // ---------- Carte de vol ----------
    const route = document.createElement('nav');
    route.className = 'flight-route';
    route.setAttribute('aria-label', 'Carte de vol du portfolio');

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${VB_W} ${VB_H}`);

    // points de la route : zigzag doux de haut en bas
    const pts = STOPS.map((_, i) => [
        i % 2 === 0 ? VB_W * 0.62 : VB_W * 0.3,
        PAD + (i / (STOPS.length - 1)) * (VB_H - PAD * 2),
    ]);

    // courbe lissée (Catmull-Rom → Bézier)
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
        const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        d += ` C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p2[0]} ${p2[1]}`;
    }

    const defs = document.createElementNS(SVG_NS, 'defs');
    defs.innerHTML =
        '<linearGradient id="flightTrail" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#ff7a2f"/><stop offset="1" stop-color="#3b6cff"/></linearGradient>';
    svg.appendChild(defs);

    const pathBg = document.createElementNS(SVG_NS, 'path');
    pathBg.setAttribute('d', d);
    pathBg.setAttribute('class', 'flight-path-bg');
    svg.appendChild(pathBg);

    const pathTrail = document.createElementNS(SVG_NS, 'path');
    pathTrail.setAttribute('d', d);
    pathTrail.setAttribute('class', 'flight-path-trail');
    svg.appendChild(pathTrail);

    route.appendChild(svg);

    const plane = document.createElement('div');
    plane.className = 'flight-plane';
    plane.innerHTML = '<i class="fas fa-plane"></i>';
    route.appendChild(plane);

    const stopEls = STOPS.map((s, i) => {
        const a = document.createElement('a');
        a.href = `#${s.id}`;
        a.className = 'flight-stop';
        a.style.top = `${(pts[i][1] / VB_H) * 100}%`;
        a.style.left = `${(pts[i][0] / VB_W) * 100}%`;
        a.innerHTML = `<span class="flight-dot"></span><span class="flight-label"><b>${pad2(i + 1)}</b> ${s.label}</span>`;
        a.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.getElementById(s.id);
            const y = target.getBoundingClientRect().top + window.scrollY - 80;
            if (window.__lenis) window.__lenis.scrollTo(y);
            else window.scrollTo({ top: y, behavior: 'smooth' });
        });
        route.appendChild(a);
        return a;
    });

    document.body.appendChild(route);

    // longueur de la route à chaque escale
    const total = pathBg.getTotalLength();
    pathTrail.style.strokeDasharray = `${total}`;
    const stopLen = pts.map(([px, py]) => {
        let best = 0, bestD = Infinity;
        for (let l = 0; l <= total; l += total / 600) {
            const q = pathBg.getPointAtLength(l);
            const dd = (q.x - px) ** 2 + (q.y - py) ** 2;
            if (dd < bestD) { bestD = dd; best = l; }
        }
        return best;
    });

    // ---------- Annonce façon panneau d'aéroport ----------
    const board = document.createElement('div');
    board.className = 'flight-board';
    board.setAttribute('aria-live', 'polite');
    document.body.appendChild(board);

    const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let boardTimer, scrambleRaf;
    function announce(i) {
        const text = `ESCALE ${pad2(i + 1)}/${pad2(STOPS.length)} — ${STOPS[i].label.toUpperCase()}`;
        cancelAnimationFrame(scrambleRaf);
        clearTimeout(boardTimer);
        board.classList.add('is-visible');
        const start = performance.now();
        const run = (now) => {
            const k = Math.min((now - start) / 700, 1);
            const fixed = Math.floor(text.length * k);
            let out = '';
            for (let c = 0; c < text.length; c++) {
                const ch = text[c];
                out += c < fixed || ch === ' ' || reduceMotion ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
            }
            board.innerHTML = `<i class="fas fa-plane"></i><span>${out}</span>`;
            if (k < 1) scrambleRaf = requestAnimationFrame(run);
        };
        scrambleRaf = requestAnimationFrame(run);
        boardTimer = setTimeout(() => board.classList.remove('is-visible'), 2600);
    }

    // ---------- Avion qui traverse l'écran ----------
    const flyby = document.createElement('div');
    flyby.className = 'flight-flyby';
    flyby.setAttribute('aria-hidden', 'true');
    flyby.innerHTML = '<div class="flyby-craft"><span class="flyby-trail"></span><i class="fas fa-plane"></i></div>';
    document.body.appendChild(flyby);

    function flyBy(forward) {
        if (reduceMotion) return;
        flyby.classList.remove('is-flying', 'is-reverse');
        void flyby.offsetWidth; // relance l'animation
        flyby.classList.toggle('is-reverse', !forward);
        flyby.classList.add('is-flying');
    }

    // ---------- Suivi du défilement ----------
    let current = -1;
    let shownP = 0;

    function progress() {
        const mid = window.scrollY + window.innerHeight * 0.45;
        const tops = STOPS.map((s) => document.getElementById(s.id).getBoundingClientRect().top + window.scrollY);
        let k = 0;
        while (k < tops.length - 1 && mid >= tops[k + 1]) k++;
        const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
        if (atBottom) return { k: tops.length - 1, f: tops.length - 1 };
        const next = tops[k + 1];
        const frac = next === undefined ? 0 : Math.min(Math.max((mid - tops[k]) / (next - tops[k]), 0), 1);
        return { k, f: k + frac };
    }

    function frame() {
        const { k, f } = progress();
        shownP += (f - shownP) * 0.12;

        const i = Math.min(Math.floor(shownP), STOPS.length - 2);
        const frac = shownP - i;
        const len = stopLen[i] + (stopLen[i + 1] - stopLen[i]) * frac;
        const pt = pathBg.getPointAtLength(len);
        const ahead = pathBg.getPointAtLength(Math.min(len + 2, total));
        const behind = pathBg.getPointAtLength(Math.max(len - 2, 0));
        const angle = Math.atan2((ahead.y - behind.y) * (route.clientHeight / VB_H), (ahead.x - behind.x) * (route.clientWidth / VB_W));

        plane.style.left = `${(pt.x / VB_W) * 100}%`;
        plane.style.top = `${(pt.y / VB_H) * 100}%`;
        plane.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
        pathTrail.style.strokeDashoffset = `${total - len}`;

        if (k !== current) {
            const forward = k > current;
            stopEls.forEach((el, n) => {
                el.classList.toggle('is-active', n === k);
                el.classList.toggle('is-done', n < k);
            });
            if (current !== -1) {
                flyBy(forward);
                announce(k);
            }
            current = k;
        }
        requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
})();
