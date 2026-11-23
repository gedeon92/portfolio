/* =====================================================================
   Effets d'interface : lumière qui suit la souris sur les cartes.
   ===================================================================== */
(function () {
    'use strict';
    if (window.matchMedia('(hover: none)').matches) return;

    const SELECTOR = '.project-card, .skill-category, .timeline-content, .education-card, ' +
        '.interest-card, .contact-item, .about-quote, .stat-item, .contact-form-container';

    document.addEventListener('pointermove', (e) => {
        const card = e.target.closest(SELECTOR);
        if (!card) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
    }, { passive: true });
})();

/* Mot géant derrière chaque titre, horloge de Dakar, année du pied de page */
(function () {
    'use strict';
    document.querySelectorAll('.section-header').forEach((h) => {
        const tag = h.querySelector('.section-tag');
        if (tag) h.dataset.ghost = tag.textContent.trim();
    });

    const year = document.getElementById('footer-year');
    if (year) year.textContent = String(new Date().getFullYear());

    const clock = document.getElementById('dakar-time');
    if (clock) {
        const fmt = new Intl.DateTimeFormat('fr-FR', {
            timeZone: 'Africa/Dakar', hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
        const tick = () => { clock.textContent = `${fmt.format(new Date())} GMT`; };
        tick();
        setInterval(tick, 1000);
    }
})();
