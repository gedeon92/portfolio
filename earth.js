/* =====================================================================
   La Terre derrière la photo : globe en points lumineux, Dakar marqué,
   arc animé Goma → Dakar.
   ===================================================================== */
(function () {
    'use strict';

    const holder = document.querySelector('.hero-earth');
    const PTS = window.EARTH_POINTS;
    if (!holder || !PTS) return;

    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    holder.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const RAD = Math.PI / 180;
    const DAKAR = { lat: 14.69, lon: -17.44, name: 'DAKAR' };
    const GOMA = { lat: -1.68, lon: 29.22, name: 'GOMA' };

    // décalage du centre du globe par rapport à Dakar :
    // Dakar apparaît en haut à gauche du globe, au-dessus de la photo.
    let OFFSET = { lon: 30, lat: -34 };

    let size = 0, DPR = 1, R = 0, C = 0;
    let visible = true;
    let compact = false; // petit écran : étiquette au-dessus à droite

    const lat = new Float32Array(PTS.length / 2);
    const lon = new Float32Array(PTS.length / 2);
    for (let i = 0; i < lat.length; i++) {
        lat[i] = (PTS[i * 2] / 10) * RAD;
        lon[i] = (PTS[i * 2 + 1] / 10) * RAD;
    }

    function layout() {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        size = holder.clientWidth;
        canvas.width = canvas.height = size * DPR;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        C = size / 2;
        R = C * 0.985;
        compact = window.innerWidth <= 768;
        OFFSET = window.innerWidth <= 768 ? { lon: 35, lat: -12 } : { lon: 30, lat: -34 };
    }

    // projection orthographique : renvoie [x, y, profondeur] (profondeur < 0 = face cachée)
    function project(la, lo, la0, lo0, alt) {
        const cl = Math.cos(la), sl = Math.sin(la);
        const dl = lo - lo0;
        const depth = Math.sin(la0) * sl + Math.cos(la0) * cl * Math.cos(dl);
        const k = R * (alt || 1);
        const x = k * cl * Math.sin(dl);
        const y = k * (Math.cos(la0) * sl - Math.sin(la0) * cl * Math.cos(dl));
        return [C + x, C - y, depth];
    }

    // point sur le grand cercle entre a et b (t de 0 à 1)
    function slerp(a, b, t) {
        const toV = (p) => [Math.cos(p.lat * RAD) * Math.cos(p.lon * RAD), Math.cos(p.lat * RAD) * Math.sin(p.lon * RAD), Math.sin(p.lat * RAD)];
        const va = toV(a), vb = toV(b);
        const dot = va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2];
        const w = Math.acos(Math.min(1, Math.max(-1, dot)));
        const s1 = Math.sin((1 - t) * w) / Math.sin(w), s2 = Math.sin(t * w) / Math.sin(w);
        const v = [va[0] * s1 + vb[0] * s2, va[1] * s1 + vb[1] * s2, va[2] * s1 + vb[2] * s2];
        return { lat: Math.asin(v[2]), lon: Math.atan2(v[1], v[0]) };
    }

    function color(x, a) {
        const g = Math.min(Math.max(x / size, 0), 1);
        const r = 255 + (59 - 255) * g, gg = 122 + (108 - 122) * g, b = 47 + (255 - 47) * g;
        return `rgba(${r | 0},${gg | 0},${b | 0},${a})`;
    }

    function drawMarker(p, la0, lo0, time, big) {
        const [x, y, d] = project(p.lat * RAD, p.lon * RAD, la0, lo0);
        if (d <= 0.05) return;
        const pulse = (time * 0.0008) % 1;
        if (big) {
            for (let k = 0; k < 2; k++) {
                const ph = (pulse + k * 0.5) % 1;
                ctx.strokeStyle = `rgba(255,170,110,${(1 - ph) * 0.9})`;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(x, y, 4 + ph * size * 0.05, 0, Math.PI * 2);
                ctx.stroke();
            }
            const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 0.03);
            glow.addColorStop(0, 'rgba(255,200,150,0.9)');
            glow.addColorStop(1, 'rgba(255,122,47,0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(x, y, size * 0.03, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x, y, big ? 3.5 : 2.5, 0, Math.PI * 2);
        ctx.fill();

        // étiquette avec trait de rappel
        const lx = compact ? x + 8 : x - (big ? 34 : 26);
        const ly = y - (big ? 30 : 22);
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + (compact ? 2 : -4), y - 4);
        ctx.lineTo(lx + (compact ? 0 : 4), ly + 4);
        ctx.stroke();
        ctx.font = `500 ${big ? 13 : 10}px "JetBrains Mono", monospace`;
        ctx.textAlign = compact ? 'left' : 'right';
        ctx.fillStyle = big ? '#fff' : 'rgba(255,255,255,0.7)';
        ctx.fillText(p.name, lx, ly);
        if (big && !compact) {
            ctx.font = '400 10px "JetBrains Mono", monospace';
            ctx.fillStyle = 'rgba(255,170,110,0.9)';
            ctx.fillText('14.69°N 17.44°O', lx, ly + 14);
        }
    }

    function draw(time) {
        ctx.clearRect(0, 0, size, size);
        const sway = reduceMotion ? 0 : Math.sin(time * 0.00018) * 7;
        const lo0 = (DAKAR.lon + OFFSET.lon + sway) * RAD;
        const la0 = (DAKAR.lat + OFFSET.lat) * RAD;

        // continents en points
        const dot = Math.max(1.2, size / 520);
        for (let i = 0; i < lat.length; i++) {
            const [x, y, d] = project(lat[i], lon[i], la0, lo0);
            if (d <= 0) continue;
            ctx.fillStyle = color(x, 0.15 + 0.75 * d);
            ctx.fillRect(x - dot / 2, y - dot / 2, dot, dot);
        }

        // arc Goma → Dakar, tracé en boucle avec une tête lumineuse
        const cycle = reduceMotion ? 1 : (time * 0.00022) % 1.3;
        const reach = Math.min(cycle, 1);
        const steps = 70;
        let prev = null;
        ctx.lineWidth = 2;
        for (let s = 0; s <= steps * reach; s++) {
            const t = s / steps;
            const p = slerp(GOMA, DAKAR, t);
            const [x, y, d] = project(p.lat, p.lon, la0, lo0, 1 + 0.22 * Math.sin(Math.PI * t));
            if (prev && d > -0.1) {
                ctx.strokeStyle = `rgba(255,${(150 + 80 * t) | 0},${(90 + 120 * t) | 0},${0.35 + 0.6 * t})`;
                ctx.beginPath();
                ctx.moveTo(prev[0], prev[1]);
                ctx.lineTo(x, y);
                ctx.stroke();
            }
            prev = [x, y];
        }
        if (prev && reach < 1) {
            const g = ctx.createRadialGradient(prev[0], prev[1], 0, prev[0], prev[1], 10);
            g.addColorStop(0, 'rgba(255,255,255,1)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(prev[0], prev[1], 10, 0, Math.PI * 2);
            ctx.fill();
        }

        drawMarker(GOMA, la0, lo0, time, false);
        drawMarker(DAKAR, la0, lo0, time, true);
    }

    function loop(time) {
        if (visible) draw(time);
        requestAnimationFrame(loop);
    }

    new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(holder);
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layout, 150); });

    layout();
    requestAnimationFrame(loop);
})();
