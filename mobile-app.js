/* =========================================================
   ПИНЬЯТА СМЯТА — MOBILE APP v2.1
   SVG-иконки: дом, каталог, свитер, звезда, конверт
   ========================================================= */
(function () {
    'use strict';

    const isMobile = () => window.matchMedia('(max-width: 900px)').matches;
    if (!isMobile()) return;

    const ADMIN_PAGES = ['admin-colors.html'];

    const ICONS = {
        home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/></svg>',
        catalog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.2"/></svg>',
        sweater: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6.5 5 8 2.8 12.5l2.7 1.3 1-2.4V19a.8.8 0 0 0 .8.8h9.4a.8.8 0 0 0 .8-.8v-7.6l1 2.4 2.7-1.3L19 8l-3-1.5"/><path d="M8 6.5a4 4 0 0 1 8 0"/><path d="M8 6.5V5.5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1"/><path d="M9.5 20.8v-6"/><path d="M14.5 20.8v-6"/></svg>',
        star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.2 14.9 9l6.3.9-4.6 4.5 1.1 6.3L12 17.8l-5.7 3 1.1-6.4L2.8 10 9.1 9z"/></svg>',
        mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5.5" width="18" height="13" rx="1.8"/><path d="M3 8.5 12 14l9-5.5"/></svg>'
    };

    const NAV_ITEMS = [
        { href: 'index.html',   icon: ICONS.home,    label: 'Главная', match: /^(index\.html)?$/ },
        { href: 'catalog.html', icon: ICONS.catalog, label: 'Каталог', match: /^catalog\.html$/ },
        { href: 'knit.html',    icon: ICONS.sweater, label: 'Тёплый',  match: /^knit\.html$/ },
        { href: 'reviews.html', icon: ICONS.star,    label: 'Отзывы',  match: /^reviews\.html$/ }
    ];

    function currentPage() {
        return location.pathname.split('/').pop() || 'index.html';
    }
    function isAdminPage() {
        return ADMIN_PAGES.includes(currentPage());
    }

    function buildBottomNav() {
        if (document.querySelector('.mobile-app-nav')) return;
        if (isAdminPage()) {
            document.body.classList.add('no-bottom-nav');
            return;
        }
        const page = currentPage();
        const nav = document.createElement('nav');
        nav.className = 'mobile-app-nav';
        nav.setAttribute('aria-label', 'Мобильная навигация');

        let html = '<div class="mobile-app-nav__inner">';
        NAV_ITEMS.forEach(item => {
            const active = item.match.test(page) ? ' active' : '';
            html += '<a href="' + item.href + '" class="mobile-app-nav__item' + active + '">' +
                '<span class="mobile-app-nav__icon">' + item.icon + '</span>' +
                '<span class="mobile-app-nav__label">' + item.label + '</span>' +
            '</a>';
        });
        if (document.getElementById('orderModal')) {
            html += '<button class="mobile-app-nav__item mobile-app-nav__item--accent" type="button" id="navOrderBtn" aria-label="Оставить заявку">' +
                '<span class="mobile-app-nav__icon">' + ICONS.mail + '</span>' +
                '<span class="mobile-app-nav__label">Заказать</span>' +
            '</button>';
        }
        html += '</div>';
        nav.innerHTML = html;
        document.body.appendChild(nav);

        const orderBtn = nav.querySelector('#navOrderBtn');
        if (orderBtn) {
            orderBtn.addEventListener('click', () => {
                haptic(10);
                if (typeof window.openOrder === 'function') window.openOrder();
            });
        }
    }

    function initNavScrollBehavior() {
        const nav = document.querySelector('.mobile-app-nav');
        if (!nav) return;
        let lastY = window.scrollY, ticking = false;
        const THRESHOLD = 8;
        function onScroll() {
            const y = window.scrollY;
            const delta = y - lastY;
            if (y < 60) nav.classList.remove('hidden-by-scroll');
            else if (delta > THRESHOLD && y > 200) nav.classList.add('hidden-by-scroll');
            else if (delta < -THRESHOLD) nav.classList.remove('hidden-by-scroll');
            lastY = y;
            ticking = false;
        }
        window.addEventListener('scroll', () => {
            if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
        }, { passive: true });
    }

    function attachRipple() {
        const selector = '.btn, .cat-btn, .mobile-app-nav__item, .clothing-tab, .palette-swatch, .granny, .ar-btn, .admin-filter, .star-btn';
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
        if (e.target.closest('.btn, .mobile-app-nav__item, .cat-btn')) haptic(8);
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

    function highlightActiveNav() {
        const page = currentPage();
        document.querySelectorAll('.mobile-app-nav__item').forEach(item => {
            const href = item.getAttribute('href');
            if (!href) return;
            const target = href.split('/').pop() || 'index.html';
            item.classList.toggle('active', target === page);
        });
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
        initNavScrollBehavior();
        attachRipple();
        initBottomSheetSwipe();
        initPageTransitions();
        initModalScrollLock();
        initLazyImages();
        highlightActiveNav();
        setTimeout(showSkeletons, 30);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (isMobile()) {
                buildBottomNav();
                highlightActiveNav();
            } else {
                const nav = document.querySelector('.mobile-app-nav');
                if (nav) nav.remove();
                document.body.style.paddingBottom = '';
                document.body.classList.remove('no-bottom-nav');
            }
        }, 200);
    });
})();