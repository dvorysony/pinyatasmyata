/* =========================================================
   ПИНЬЯТА СМЯТА — MOBILE APP v2.2
   Нижняя навигация удалена по просьбе пользователя.
   ========================================================= */
(function () {
    'use strict';

    const isMobile = () => window.matchMedia('(max-width: 900px)').matches;
    if (!isMobile()) return;

    /* =====================================================
       УДАЛЕНА СБОРКА BOTTOM NAVIGATION
       ===================================================== */
    function buildBottomNav() {
        // Нижняя навигация отключена. Кнопка Заказать теперь в шапке.
        return;
    }

    function attachRipple() {
        const selector = '.btn, .cat-btn, .clothing-tab, .palette-swatch, .granny, .ar-btn, .admin-filter, .star-btn';
        document.addEventListener('pointerdown', (e) => {
            const el = e.target.closest(selector);
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            const cs = getComputedStyle(el);
            if (cs.position === 'static') el.style.position = 'relative';
            if (cs.overflow === 'visible') el.style.overflow = 'hidden';
            const ripple = document.createElement('span');
            ripple.className = 'ripple';
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            el.appendChild(ripple);
            setTimeout(() => ripple.remove(), 650);
        }, { passive: true });
    }

    function haptic(ms) {
        if ('vibrate' in navigator) {
            try { navigator.vibrate(ms || 8); } catch (e) {}
        }
    }
    window.__haptic = haptic;
    document.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.btn, .cat-btn')) haptic(8);
    }, { passive: true });

    function initBottomSheetSwipe() {
        document.querySelectorAll('.modal, .price-modal').forEach(sheet => {
            let startY = 0, currentY = 0, dragging = false;
            const onStart = (e) => {
                if (e.target.closest('input, textarea, select, button, a')) return;
                startY = e.touches ? e.touches[0].clientY : e.clientY;
                dragging = true;
                sheet.style.transition = 'none';
            };
            const onMove = (e) => {
                if (!dragging) return;
                currentY = e.touches ? e.touches[0].clientY : e.clientY;
                const diff = currentY - startY;
                if (diff > 0) sheet.style.transform = 'translateY(' + diff + 'px)';
            };
            const onEnd = () => {
                if (!dragging) return;
                dragging = false;
                sheet.style.transition = '';
                const diff = currentY - startY;
                if (diff > 90) {
                    const bg = sheet.closest('.modal-bg, .price-modal-bg');
                    if (bg) bg.classList.remove('open');
                    document.body.classList.remove('modal-open');
                }
                sheet.style.transform = '';
                startY = currentY = 0;
            };
            sheet.addEventListener('touchstart', onStart, { passive: true });
            sheet.addEventListener('touchmove',  onMove,  { passive: true });
            sheet.addEventListener('touchend',   onEnd);
        });
    }

    function initPageTransitions() {
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (!link) return;
            const href = link.getAttribute('href');
            if (!href) return;
            if (href.startsWith('#') || href.startsWith('http') ||
                href.startsWith('mailto') || href.startsWith('tel')) return;
            if (link.target === '_blank') return;
            if (link.hasAttribute('data-no-transition')) return;
            e.preventDefault();
            haptic(8);
            document.body.classList.add('page-leaving');
            setTimeout(() => { window.location.href = href; }, 180);
        });
    }

    function showSkeletons() {
        const catalog = document.getElementById('catalogList');
        if (catalog && /Загрузка/.test(catalog.textContent)) {
            catalog.innerHTML = Array(6).fill('<div class="skeleton skeleton-card"></div>').join('');
        }
        const reviews = document.getElementById('reviewsList');
        if (reviews && /Загрузка/.test(reviews.textContent)) {
            reviews.innerHTML = Array(3).fill('<div class="skeleton" style="height:180px;border-radius:20px;"></div>').join('');
        }
        const stock = document.getElementById('stockList');
        if (stock && /Загрузка/.test(stock.textContent)) {
            stock.innerHTML = Array(2).fill('<div class="skeleton skeleton-card"></div>').join('');
        }
    }

    function initModalScrollLock() {
        const observer = new MutationObserver(() => {
            const anyOpen = document.querySelector('.modal-bg.open, .price-modal-bg.open');
            document.body.classList.toggle('modal-open', !!anyOpen);
        });
        observer.observe(document.body, {
            attributes: true, subtree: true, attributeFilter: ['class']
        });
    }

    function initLazyImages() {
        document.querySelectorAll('img:not([loading])').forEach(img => {
            img.loading = 'lazy';
            img.decoding = 'async';
        });
    }

    function boot() {
        buildBottomNav();
        attachRipple();
        initBottomSheetSwipe();
        initPageTransitions();
        initModalScrollLock();
        initLazyImages();
        setTimeout(showSkeletons, 30);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
