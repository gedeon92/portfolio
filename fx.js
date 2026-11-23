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
