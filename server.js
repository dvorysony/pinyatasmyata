const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'smyata2026';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT  = process.env.TELEGRAM_CHAT_ID;
const TG_PROXY = process.env.TELEGRAM_PROXY_URL || 'https://api.telegram.org';

if (!SUPABASE_URL || !SUPABASE_KEY) console.error('ОШИБКА: не заданы SUPABASE_URL или SUPABASE_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const ROOT = __dirname;

function makeToken() {
    const payload = 'admin|' + (Date.now() + 1000 * 60 * 60 * 24 * 7);
    const sig = crypto.createHmac('sha256', ADMIN_PASSWORD).update(payload).digest('hex');
    return payload + '|' + sig;
}
function verifyToken(token) {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('|');
    if (parts.length !== 3) return false;
    const role = parts[0], expStr = parts[1], sig = parts[2];
    if (role !== 'admin') return false;
    const expected = crypto.createHmac('sha256', ADMIN_PASSWORD).update(role + '|' + expStr).digest('hex');
    if (sig !== expected) return false;
    return parseInt(expStr, 10) > Date.now();
}

const INITIAL_PRODUCTS = [
    { name: "Пиньята-цифра",      descr: "Пиньята в виде цифры или буквы.", price: "от 5 000 ₽",    image: "images/cifra.jpg",  category: "cifry",  category_main: "pinyaty", category_sub: "cifry" },
    { name: "Пиньята-торт",       descr: "Многоярусная пиньята-торт.",       price: "3 500 ₽",       image: "images/tort.jpg",   category: "torti",  category_main: "pinyaty", category_sub: "torti" },
    { name: "Пиньята сложная 3D", descr: "Объемные 3D-фигуры.",              price: "2 000–5 000 ₽", image: "images/3d.jpg",     category: "3d",     category_main: "pinyaty", category_sub: "3d" },
    { name: "Пиньята-шайба",      descr: "Круглая плоская пиньята.",         price: "1 400 ₽",       image: "images/shaiba.jpg", category: "shar",   category_main: "pinyaty", category_sub: "shar" },
    { name: "Пиньята-шар 40см",   descr: "Классический шар 40 см.",          price: "1 500 ₽",       image: "images/shar40.jpg", category: "shar",   category_main: "pinyaty", category_sub: "shar" },
    { name: "Пиньята-шар 50см",   descr: "Классический шар 50 см.",          price: "1 900 ₽",       image: "images/shar50.jpg", category: "shar",   category_main: "pinyaty", category_sub: "shar" }
];

async function seedIfEmpty() {
    try {
        const { count, error } = await supabase.from('products').select('*', { count: 'exact', head: true });
        if (error) return console.error('seed:', error.message);
        if (count === 0) await supabase.from('products').insert(INITIAL_PRODUCTS);
    } catch (e) { console.error('seed:', e.message); }
}

async function dbList() {
    const { data, error } = await supabase.from('products').select('*').order('id', { ascending: true });
    if (error) return [];
    return data.map(p => ({
        id: String(p.id),
        name: p.name,
        desc: p.descr || '',
        price: p.price,
        image: p.image || '',
        button: p.button || 'Написать',
        category: p.category || 'other',
        category_main: p.category_main || 'pinyaty',
        category_sub: p.category_sub || p.category || 'other',
        inStock: !!p.in_stock
    }));
}

async function dbOrders() {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (error) return [];
    return data.map(o => ({
        id: String(o.id),
        name: o.name,
        phone: o.phone,
        product: o.product || '',
        orderDate: o.order_date || '',
        comment: o.comment || '',
        createdAt: o.created_at
    }));
}

async function dbReviews(onlyApproved) {
    let q = supabase.from('reviews').select('*').order('created_at', { ascending: false });
    if (onlyApproved) q = q.eq('status', 'approved');
    const { data, error } = await q;
    if (error) return [];
    return data.map(r => ({
        id: String(r.id),
        name: r.name,
        text: r.text,
        photo: r.photo || '',
        rating: r.rating || 5,
        source: r.source || 'site',
        status: r.status || 'pending',
        createdAt: r.created_at
    }));
}

async function dbYarnColors() {
    const { data, error } = await supabase.from('yarn_colors').select('*').order('sort_order', { ascending: true }).order('id', { ascending: true });
    if (error) return [];
    return data.map(c => ({
        id: String(c.id),
        name: c.name,
        hex: c.hex,
        sortOrder: c.sort_order || 100
    }));
}

async function sendToTelegram(text) {
    if (!TG_TOKEN || !TG_CHAT) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
        const url = TG_PROXY + '/bot' + TG_TOKEN + '/sendMessage';
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML', disable_web_page_preview: true }),
            signal: controller.signal
        });
        const data = await res.json();
        if (!data.ok) console.error('Telegram API:', data.description);
        else console.log('Telegram: отправлено');
    } catch (e) {
        console.error('Telegram:', e.name === 'AbortError' ? 'таймаут' : e.message);
    } finally { clearTimeout(timer); }
}
function escHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function parseCookies(req) {
    const h = req.headers.cookie || '';
    const out = {};
    h.split(';').forEach(p => {
        const i = p.indexOf('=');
        if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
    });
    return out;
}
function isAuthed(req) { return verifyToken(parseCookies(req).session); }
function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', c => {
            data += c;
            if (data.length > 30 * 1024 * 1024) { reject(new Error('big')); req.destroy(); }
        });
        req.on('end', () => resolve(data));
        req.on('error', reject);
    });
}
function send(res, status, body, headers) {
    res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers || {}));
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

const MIME = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
    '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8'
};

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);

    /* ТОВАРЫ */
    if (pathname === '/api/products' && req.method === 'GET') return send(res, 200, await dbList());
    if (pathname === '/api/products' && req.method === 'POST') {
        if (!isAuthed(req)) return send(res, 401, { error: 'Не авторизован' });
        try {
            const body = JSON.parse(await readBody(req));
            if (!body.name || !body.price) return send(res, 400, { error: 'Нужны name и price' });
            const item = {
                name: String(body.name).slice(0, 200),
                descr: String(body.desc || '').slice(0, 1000),
                price: String(body.price).slice(0, 100),
                image: body.image || '',
                button: 'Написать',
                category: String(body.category_sub || body.category || 'other').slice(0, 30),
                category_main: String(body.category_main || 'pinyaty').slice(0, 30),
                category_sub: String(body.category_sub || 'other').slice(0, 30),
                in_stock: !!body.in_stock
            };
            const { data, error } = await supabase.from('products').insert(item).select().single();
            if (error) return send(res, 500, { error: error.message });
            return send(res, 200, data);
        } catch (e) { return send(res, 400, { error: 'Bad request' }); }
    }

    const itemMatch = pathname.match(/^\/api\/products\/([^\/]+)$/);
    if (itemMatch && req.method === 'DELETE') {
        if (!isAuthed(req)) return send(res, 401, { error: 'Не авторизован' });
        const { error } = await supabase.from('products').delete().eq('id', itemMatch[1]);
        if (error) return send(res, 500, { error: error.message });
        return send(res, 200, { ok: true });
    }
    if (itemMatch && req.method === 'PUT') {
        if (!isAuthed(req)) return send(res, 401, { error: 'Не авторизован' });
        try {
            const body = JSON.parse(await readBody(req));
            const update = {};
            if (body.price !== undefined) update.price = String(body.price);
            if (body.name !== undefined) update.name = String(body.name);
            if (body.desc !== undefined) update.descr = String(body.desc);
            if (body.category_main !== undefined) update.category_main = String(body.category_main).slice(0, 30);
            if (body.category_sub !== undefined) update.category_sub = String(body.category_sub).slice(0, 30);
            if (body.category !== undefined) update.category = String(body.category).slice(0, 30);
            if (body.in_stock !== undefined) update.in_stock = !!body.in_stock;
            const { error } = await supabase.from('products').update(update).eq('id', itemMatch[1]);
            if (error) return send(res, 500, { error: error.message });
            return send(res, 200, { ok: true });
        } catch (e) { return send(res, 400, { error: 'Bad request' }); }
    }

    /* ЗАЯВКИ */
    if (pathname === '/api/order' && req.method === 'POST') {
        try {
            const body = JSON.parse(await readBody(req));
            const name = String(body.name || '').trim().slice(0, 100);
            const phone = String(body.phone || '').trim().slice(0, 50);
            const product = String(body.product || '').trim().slice(0, 500);
            const order_date = String(body.date || '').trim().slice(0, 100);
            const comment = String(body.comment || '').trim().slice(0, 2000);
            if (!name || !phone) return send(res, 400, { error: 'Укажите имя и телефон' });

            const { error } = await supabase.from('orders').insert({ name, phone, product, order_date, comment });
            if (error) return send(res, 500, { error: error.message });

            const txt = '🎉 <b>Новая заявка</b>\n\n👤 ' + escHtml(name) + '\n📞 ' + escHtml(phone) +
                (product ? '\n🎁 ' + escHtml(product) : '') +
                (order_date ? '\n📅 ' + escHtml(order_date) : '') +
                (comment ? '\n💬 ' + escHtml(comment.slice(0, 500)) : '');
            sendToTelegram(txt).catch(() => {});
            return send(res, 200, { ok: true });
        } catch (e) { return send(res, 400, { error: 'Bad request' }); }
    }
    if (pathname === '/api/orders' && req.method === 'GET') {
        if (!isAuthed(req)) return send(res, 401, { error: 'Не авторизован' });
        return send(res, 200, await dbOrders());
    }
    const orderMatch = pathname.match(/^\/api\/orders\/([^\/]+)$/);
    if (orderMatch && req.method === 'DELETE') {
        if (!isAuthed(req)) return send(res, 401, { error: 'Не авторизован' });
        const { error } = await supabase.from('orders').delete().eq('id', orderMatch[1]);
        if (error) return send(res, 500, { error: error.message });
        return send(res, 200, { ok: true });
    }

    /* ОТЗЫВЫ */
    if (pathname === '/api/reviews' && req.method === 'GET') return send(res, 200, await dbReviews(true));
    if (pathname === '/api/admin/reviews' && req.method === 'GET') {
        if (!isAuthed(req)) return send(res, 401, { error: 'Не авторизован' });
        return send(res, 200, await dbReviews(false));
    }
    if (pathname === '/api/reviews' && req.method === 'POST') {
        try {
            const body = JSON.parse(await readBody(req));
            const name = String(body.name || '').trim().slice(0, 100);
            const text = String(body.text || '').trim().slice(0, 2000);
            const photo = body.photo || '';
            const rating = Math.max(1, Math.min(5, parseInt(body.rating || 5, 10)));
            const source = String(body.source || 'site').slice(0, 20);
            if (!name || !text) return send(res, 400, { error: 'Укажите имя и текст' });
            const { error } = await supabase.from('reviews').insert({ name, text, photo, rating, source, status: 'pending' });
            if (error) return send(res, 500, { error: error.message });
            const t = '⭐ <b>Новый отзыв</b>\n\n👤 ' + escHtml(name) + '\n⭐ ' + rating + '/5\n💬 ' + escHtml(text.slice(0, 300));
            sendToTelegram(t).catch(() => {});
            return send(res, 200, { ok: true });
        } catch (e) { return send(res, 400, { error: 'Bad request' }); }
    }
    const revMatch = pathname.match(/^\/api\/reviews\/([^\/]+)$/);
    if (revMatch && req.method === 'PUT') {
        if (!isAuthed(req)) return send(res, 401, { error: 'Не авторизован' });
        try {
            const body = JSON.parse(await readBody(req));
            const update = {};
            if (body.status !== undefined) update.status = String(body.status);
            if (body.name !== undefined) update.name = String(body.name);
            if (body.text !== undefined) update.text = String(body.text);
            if (body.rating !== undefined) update.rating = parseInt(body.rating, 10);
            if (body.source !== undefined) update.source = String(body.source);
            if (body.photo !== undefined) update.photo = String(body.photo);
            const { error } = await supabase.from('reviews').update(update).eq('id', revMatch[1]);
            if (error) return send(res, 500, { error: error.message });
            return send(res, 200, { ok: true });
        } catch (e) { return send(res, 400, { error: 'Bad request' }); }
    }
    if (revMatch && req.method === 'DELETE') {
        if (!isAuthed(req)) return send(res, 401, { error: 'Не авторизован' });
        const { error } = await supabase.from('reviews').delete().eq('id', revMatch[1]);
        if (error) return send(res, 500, { error: error.message });
        return send(res, 200, { ok: true });
    }

    /* ЦВЕТА НИТОК */
    if (pathname === '/api/yarn-colors' && req.method === 'GET') return send(res, 200, await dbYarnColors());
    if (pathname === '/api/yarn-colors' && req.method === 'POST') {
        if (!isAuthed(req)) return send(res, 401, { error: 'Не авторизован' });
        try {
            const body = JSON.parse(await readBody(req));
            const name = String(body.name || '').trim().slice(0, 60);
            const hex = String(body.hex || '').trim().slice(0, 9);
            const sort_order = parseInt(body.sortOrder || 100, 10);
            if (!name || !hex) return send(res, 400, { error: 'Нужны name и hex' });
            const { data, error } = await supabase.from('yarn_colors').insert({ name, hex, sort_order }).select().single();
            if (error) return send(res, 500, { error: error.message });
            return send(res, 200, { id: String(data.id), name: data.name, hex: data.hex, sortOrder: data.sort_order });
        } catch (e) { return send(res, 400, { error: 'Bad request' }); }
    }
    const yarnMatch = pathname.match(/^\/api\/yarn-colors\/([^\/]+)$/);
    if (yarnMatch && req.method === 'PUT') {
        if (!isAuthed(req)) return send(res, 401, { error: 'Не авторизован' });
        try {
            const body = JSON.parse(await readBody(req));
            const update = {};
            if (body.name !== undefined) update.name = String(body.name).slice(0, 60);
            if (body.hex !== undefined) update.hex = String(body.hex).slice(0, 9);
            if (body.sortOrder !== undefined) update.sort_order = parseInt(body.sortOrder, 10);
            const { error } = await supabase.from('yarn_colors').update(update).eq('id', yarnMatch[1]);
            if (error) return send(res, 500, { error: error.message });
            return send(res, 200, { ok: true });
        } catch (e) { return send(res, 400, { error: 'Bad request' }); }
    }
    if (yarnMatch && req.method === 'DELETE') {
        if (!isAuthed(req)) return send(res, 401, { error: 'Не авторизован' });
        const { error } = await supabase.from('yarn_colors').delete().eq('id', yarnMatch[1]);
        if (error) return send(res, 500, { error: error.message });
        return send(res, 200, { ok: true });
    }

    /* СЕССИЯ */
    if (pathname === '/api/session' && req.method === 'GET') return send(res, 200, { authed: isAuthed(req) });
    if (pathname === '/api/login' && req.method === 'POST') {
        try {
            const body = JSON.parse(await readBody(req));
            if (body.password !== ADMIN_PASSWORD) return send(res, 401, { error: 'Неверный пароль' });
            const token = makeToken();
            res.setHeader('Set-Cookie', 'session=' + token + '; HttpOnly; Path=/; Max-Age=' + (60 * 60 * 24 * 7) + '; SameSite=Lax; Secure');
            return send(res, 200, { ok: true });
        } catch (e) { return send(res, 400, { error: 'Bad request' }); }
    }
    if (pathname === '/api/logout' && req.method === 'POST') {
        res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0');
        return send(res, 200, { ok: true });
    }

    /* СТАТИКА */
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(ROOT, filePath);
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Not found'); }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
    });
});

server.listen(PORT, async () => {
    console.log('');
    console.log('  Сервер:  http://localhost:' + PORT);
    console.log('  Supabase: ' + (SUPABASE_URL ? 'ok' : 'НЕТ'));
    console.log('  Telegram: ' + (TG_TOKEN ? 'ok' : 'НЕТ'));
    console.log('');
    await seedIfEmpty();
});
