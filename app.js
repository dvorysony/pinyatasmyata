/* =========================================================
   Пиньята Смята — общие утилиты
   ========================================================= */

const PHONE = "79095415959";
window.PHONE = PHONE;

/* ---------- ESC ---------- */
function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({
        "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
}
window.esc = esc;

/* ---------- API ---------- */
async function apiGet(url) {
    const r = await fetch(url, { credentials:'same-origin' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
}
async function apiSend(method, url, data) {
    const r = await fetch(url, {
        method, credentials:'same-origin',
        headers: {'Content-Type':'application/json'},
        body: data ? JSON.stringify(data) : undefined
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
}
window.apiGet = apiGet;
window.apiSend = apiSend;

/* ---------- ЦЕНА ---------- */
function formatPrice(raw, type, rawTo) {
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return '';
    const f = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    if (type === 'from') return 'от ' + f + ' ₽';
    if (type === 'range') {
        const to = String(rawTo || '').replace(/\D/g, '');
        if (!to) return 'от ' + f + ' ₽';
        return f + '–' + to.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
    }
    return f + ' ₽';
}
function parsePrice(s) {
    s = String(s || '').trim();
    const r = s.match(/^(\d[\d\s]*)\s*[–\-—]\s*(\d[\d\s]*)/);
    if (r) return { type:'range', from:r[1].replace(/\D/g,''), to:r[2].replace(/\D/g,'') };
    if (/^от\s/i.test(s)) return { type:'from', from:s.replace(/\D/g,''), to:'' };
    return { type:'fixed', from:s.replace(/\D/g,''), to:'' };
}
window.formatPrice = formatPrice;
window.parsePrice = parsePrice;

/* ---------- СЖАТИЕ ФОТО ---------- */
function compressImage(file, maxSide, quality) {
    maxSide = maxSide || 1100; quality = quality || 0.82;
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('read'));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error('image'));
            img.onload = () => {
                const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
                const w = Math.max(1, Math.round(img.width * scale));
                const h = Math.max(1, Math.round(img.height * scale));
                const c = document.createElement('canvas');
                c.width = w; c.height = h;
                const ctx = c.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                resolve(c.toDataURL('image/jpeg', quality));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}
window.compressImage = compressImage;

/* ---------- REVEAL ---------- */
const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); revealObserver.unobserve(e.target); } });
}, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
function observeReveals() {
    document.querySelectorAll('.reveal:not(.visible)').forEach(el => revealObserver.observe(el));
}
window.observeReveals = observeReveals;

/* ---------- SMOOTH SCROLL ---------- */
function smoothScrollTo(target) {
    if (!target) return;
    const header = document.getElementById('siteHeader');
    const h = header ? header.offsetHeight : 0;
    const top = target.getBoundingClientRect().top + window.pageYOffset - h - 14;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}
window.smoothScrollTo = smoothScrollTo;

/* ---------- MOBILE MENU ---------- */
function initMobileMenu() {
    const toggle = document.getElementById('menuToggle');
    const menu = document.getElementById('mobileMenu');
    if (!toggle || !menu) return;
    toggle.addEventListener('click', () => {
        if (menu.classList.contains('open')) {
            menu.classList.remove('open');
            toggle.classList.remove('active');
            document.body.classList.remove('menu-open');
        } else {
            menu.classList.add('open');
            toggle.classList.add('active');
            document.body.classList.add('menu-open');
        }
    });
    document.addEventListener('click', e => {
        const link = e.target.closest('.mobile-menu a');
        if (link) {
            menu.classList.remove('open');
            toggle.classList.remove('active');
            document.body.classList.remove('menu-open');
        }
    });
}

/* ---------- HEADER SCROLL ---------- */
function initHeaderScroll() {
    const header = document.getElementById('siteHeader');
    if (!header) return;
    const update = () => {
        if (window.scrollY > 18) header.classList.add('scrolled');
        else header.classList.remove('scrolled');
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
}

/* ---------- МОДАЛКА ЗАЯВКИ (глобальная) ---------- */
function openOrder() { openOrderFor(''); }
function openOrderFor(productName) {
    const m = document.getElementById('orderModal');
    if (!m) return;
    document.getElementById('orderProduct').value = productName || '';
    document.getElementById('orderStatus').textContent = '';
    document.getElementById('orderStatus').className = 'form-status';
    m.classList.add('open');
    document.body.classList.add('modal-open');
    setTimeout(() => document.getElementById('orderName').focus(), 150);
}
function closeOrder() {
    const m = document.getElementById('orderModal');
    if (!m) return;
    m.classList.remove('open');
    document.body.classList.remove('modal-open');
}
window.openOrder = openOrder;
window.openOrderFor = openOrderFor;
window.closeOrder = closeOrder;

async function submitOrder() {
    const name = document.getElementById('orderName').value.trim();
    const phone = document.getElementById('orderPhone').value.trim();
    const product = document.getElementById('orderProduct').value.trim();
    const dateRaw = document.getElementById('orderDate').value;
    let date = '';
    if (dateRaw) { const p = dateRaw.split('-'); date = p[2] + '.' + p[1] + '.' + p[0]; }
    const comment = document.getElementById('orderComment').value.trim();
    const statusEl = document.getElementById('orderStatus');
    const btn = document.getElementById('orderBtn');
    if (!name || !phone) { statusEl.textContent = 'Заполните имя и телефон.'; statusEl.className = 'form-status err'; return; }
    btn.disabled = true; btn.textContent = 'Отправляем…'; statusEl.textContent = '';
    try {
        await apiSend('POST', '/api/order', { name, phone, product, date, comment });
        statusEl.textContent = 'Спасибо! Заявка отправлена.';
        statusEl.className = 'form-status ok';
        ['orderName','orderPhone','orderProduct','orderDate','orderComment'].forEach(id => document.getElementById(id).value = '');
        setTimeout(closeOrder, 2000);
    } catch (e) {
        statusEl.textContent = e.message || 'Не удалось отправить.';
        statusEl.className = 'form-status err';
    } finally { btn.disabled = false; btn.textContent = 'Отправить заявку'; }
}
window.submitOrder = submitOrder;

/* ---------- ЗВЁЗДЫ ---------- */
let reviewRating = 5;
function setRating(v) {
    reviewRating = v;
    document.querySelectorAll('#reviewStars .star-btn').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.star, 10) <= v);
    });
}
window.setRating = setRating;

/* ---------- ФОТО В МОДАЛКЕ ОТЗЫВА ---------- */
let reviewPhotoData = '';
function clearReviewPhoto() {
    reviewPhotoData = '';
    const input = document.getElementById('reviewPhoto');
    if (input) input.value = '';
    const prev = document.getElementById('reviewPhotoPreview');
    if (prev) prev.style.display = 'none';
}
window.clearReviewPhoto = clearReviewPhoto;

/* ---------- МОДАЛКА ОТЗЫВА ---------- */
function openReview() {
    const m = document.getElementById('reviewModal');
    if (!m) return;
    document.getElementById('reviewStatus').textContent = '';
    document.getElementById('reviewStatus').className = 'form-status';
    setRating(5);
    m.classList.add('open');
    document.body.classList.add('modal-open');
}
function closeReview() {
    const m = document.getElementById('reviewModal');
    if (!m) return;
    m.classList.remove('open');
    document.body.classList.remove('modal-open');
}
window.openReview = openReview;
window.closeReview = closeReview;

async function submitReview() {
    const name = document.getElementById('reviewName').value.trim();
    const text = document.getElementById('reviewText').value.trim();
    const statusEl = document.getElementById('reviewStatus');
    const btn = document.getElementById('reviewBtn');
    if (!name || !text) { statusEl.textContent = 'Заполните имя и текст отзыва.'; statusEl.className = 'form-status err'; return; }
    btn.disabled = true; btn.textContent = 'Отправляем…';
    try {
        await apiSend('POST', '/api/reviews', {
            name, text, rating: reviewRating, photo: reviewPhotoData, source: 'site'
        });
        /* ✅ Отзыв опубликован сразу */
        statusEl.textContent = 'Спасибо! Ваш отзыв опубликован.';
        statusEl.className = 'form-status ok';
        document.getElementById('reviewName').value = '';
        document.getElementById('reviewText').value = '';
        clearReviewPhoto();
        setTimeout(closeReview, 2000);
        if (typeof loadReviews === 'function') loadReviews();
    } catch (e) {
        statusEl.textContent = e.message || 'Не удалось отправить.';
        statusEl.className = 'form-status err';
    } finally { btn.disabled = false; btn.textContent = 'Отправить отзыв'; }
}
window.submitReview = submitReview;

/* ---------- РЕНДЕР КАРТОЧКИ ОТЗЫВА ---------- */
function renderReviewCard(r, isAdmin) {
    const initials = (r.name || '?').trim().charAt(0).toUpperCase();
    const avatar = r.photo
        ? '<div class="review-avatar"><img src="' + esc(r.photo) + '" alt=""></div>'
        : '<div class="review-avatar">' + esc(initials) + '</div>';
    const sourceLabel = { site:'Сайт', vk:'ВКонтакте', instagram:'Instagram', whatsapp:'WhatsApp', other:'Соцсети' }[r.source] || r.source;
    const stars = '★'.repeat(r.rating || 5) + '☆'.repeat(5 - (r.rating || 5));
    const isLong = (r.text || '').length > 220;
    const textCls = isLong ? 'review-text is-clamped' : 'review-text';

    let adminButtons = '';
    if (isAdmin) {
        if (r.status === 'pending') {
            adminButtons = '<button class="delete-btn approve-btn" type="button" onclick="approveReview(\'' + esc(r.id) + '\')">Опубликовать</button>';
        } else {
            adminButtons = '<button class="delete-btn" type="button" onclick="hideReview(\'' + esc(r.id) + '\')">Скрыть</button>';
        }
        adminButtons += '<button class="delete-btn" type="button" onclick="deleteReview(\'' + esc(r.id) + '\')">Удалить</button>';
    }

    return '<article class="review-card" data-review-id="' + esc(r.id) + '">' +
        '<div class="review-head">' + avatar +
            '<div><div class="review-author">' + esc(r.name) + '</div><div class="review-source">' + esc(sourceLabel) + (isAdmin ? ' · ' + (r.status === 'approved' ? 'Опубликован' : 'На модерации') : '') + '</div></div>' +
        '</div>' +
        '<div class="review-stars">' + stars + '</div>' +
        '<p class="' + textCls + '">' + esc(r.text) + '</p>' +
        (isLong ? '<button class="review-more" type="button" onclick="toggleReview(this)">Читать полностью</button>' : '') +
        (r.photo ? '<div class="review-photo"><img src="' + esc(r.photo) + '" alt="" loading="lazy"></div>' : '') +
        adminButtons +
    '</article>';
}
window.renderReviewCard = renderReviewCard;

function toggleReview(btn) {
    const p = btn.previousElementSibling;
    if (p.classList.contains('is-clamped')) { p.classList.remove('is-clamped'); btn.textContent = 'Свернуть'; }
    else { p.classList.add('is-clamped'); btn.textContent = 'Читать полностью'; }
}
window.toggleReview = toggleReview;

/* ---------- ОБЩАЯ ИНИЦИАЛИЗАЦИЯ ---------- */
document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    initHeaderScroll();
    observeReveals();

    /* Биндинг фото отзыва */
    const reviewPhotoInput = document.getElementById('reviewPhoto');
    if (reviewPhotoInput) {
        reviewPhotoInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (!file) return;
            compressImage(file).then(dataUrl => {
                reviewPhotoData = dataUrl;
                document.getElementById('reviewPhotoImg').src = dataUrl;
                document.getElementById('reviewPhotoPreview').style.display = 'block';
            }).catch(() => alert('Не удалось обработать фото'));
        });
    }

    /* Escape закрывает модалки */
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeOrder();
            closeReview();
        }
    });

    /* Клик по фону закрывает модалки */
    ['orderModal','reviewModal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', function (e) {
            if (e.target === this) {
                if (id === 'orderModal') closeOrder();
                if (id === 'reviewModal') closeReview();
            }
        });
    });

    /* Открытие заявки по кнопкам [data-open-order] */
    document.addEventListener('click', e => {
        const btn = e.target.closest('[data-open-order]');
        if (btn) { e.preventDefault(); openOrder(); return; }
        const productBtn = e.target.closest('[data-product]');
        if (productBtn) { e.preventDefault(); openOrderFor(productBtn.getAttribute('data-product')); }
    });

    /* Минимальная дата заказа */
    const dateEl = document.getElementById('orderDate');
    if (dateEl) {
        const t = new Date();
        dateEl.min = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
    }
});
