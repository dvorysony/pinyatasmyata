const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'smyata2026';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('ОШИБКА: не заданы SUPABASE_URL или SUPABASE_KEY');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ROOT = __dirname;

/* ---------- Подписанные токены (переживают перезапуск сервера) ---------- */

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
    { name: "Пиньята-цифра",      descr: "Пиньята в виде цифры или буквы. Идеально для дня рождения.", price: "от 5 000 ₽",    image: "images/cifra.jpg",  button: "Написать", category: "figures" },
    { name: "Пиньята-торт",       descr: "Многоярусная пиньята-торт с декором. Красиво и вкусно!",     price: "3 500 ₽",       image: "images/tort.jpg",   button: "Написать", category: "cakes" },
    { name: "Пиньята сложная 3D", descr: "Объемные фигуры: единорог, авокадо, машинка, зайчик и другие.", price: "2 000–5 000 ₽", image: "images/3d.jpg",     button: "Написать", category: "3d" },
    { name: "Пиньята-шайба",      descr: "Круглая плоская пиньята (шайба) с декором и цветами.",        price: "1 400 ₽",       image: "images/shaiba.jpg", button: "Написать", category: "balls" },
    { name: "Пиньята-шар 40см",   descr: "Классическая пиньята-шар 40 см. Например, Brawl Stars.",      price: "1 500 ₽",       image: "images/shar40.jpg", button: "Написать", category: "balls" },
    { name: "Пиньята-шар 50см",   descr: "Классическая пиньята-шар 50 см. Например, LEGO.",              price: "1 900 ₽",       image: "images/shar50.jpg", button: "Написать", category: "balls" }
];

async function seedIfEmpty() {
    try {
        const { count, error } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true });
        if (error) { console.error('seed check:', error.message); return; }
        if (count === 0) {
            const { error: insErr } = await supabase.from('products').insert(INITIAL_PRODUCTS);
            if (insErr) console.error('seed insert:', insErr.message);
            else console.log('Стартовые товары добавлены в базу.');
        }
    } catch (e) {
        console.error('seed error:', e.message);
    }
}

async function dbList() {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('id', { ascending: true });
    if (error) { console.error('dbList:', error.message); return []; }
    return data.map(function (p) {
        return {
            id: String(p.id),
            name: p.name,
            desc: p.descr || '',
            price: p.price,
            image: p.image || '',
            button: p.button || 'Написать',
            category: p.category || 'other'
        };
    });
}

async function dbOrders() {
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) { console.error('dbOrders:', error.message); return []; }
    return data.map(function (o) {
        return {
            id: String(o.id),
            name: o.name,
            phone: o.phone,
            product: o.product || '',
            orderDate: o.order_date || '',
            comment: o.comment || '',
            status: o.status || 'new',
            createdAt: o.created_at
        };
    });
}

function parseCookies(req) {
    const h = req.headers.cookie || '';
    const out = {};
    h.split(';').forEach(function (p) {
        const i = p.indexOf('=');
        if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
    });
    return out;
}

function isAuthed(req) {
    const c = parseCookies(req);
    return verifyToken(c.session);
}

function readBody(req) {
    return new Promise(function (resolve, reject) {
        let data = '';
        req.on('data', function (chunk) {
            data += chunk;
            if (data.length > 20 * 1024 * 1024) {
                reject(new Error('Слишком большой запрос'));
                req.destroy();
            }
        });
        req.on('end', function () { resolve(data); });
        req.on('error', reject);
    });
}

function send(res, status, body, headers) {
    headers = headers || {};
    res.writeHead(status, Object.assign({
        'Content-Type': 'application/json; charset=utf-8'
    }, headers));
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.json': 'application/json; charset=utf-8'
};

const server = http.createServer(async function (req, res) {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === '/api/products' && req.method === 'GET') {
        return send(res, 200, await dbList());
    }

    if (pathname === '/api/session' && req.method === 'GET') {
        return send(res, 200, { authed: isAuthed(req) });
    }

    if (pathname === '/api/login' && req.method === 'POST') {
        try {
            const body = JSON.parse(await readBody(req));
            if (body.password !== ADMIN_PASSWORD) {
                return send(res, 401, { error: 'Неверный пароль' });
            }
            const token = makeToken();
            res.setHeader('Set-Cookie',
                'session=' + token + '; HttpOnly; Path=/; Max-Age=' + (60 * 60 * 24 * 7) + '; SameSite=Lax; Secure');
            return send(res, 200, { ok: true });
        } catch (e) {
            return send(res, 400, { error: 'Bad request' });
        }
    }

    if (pathname === '/api/logout' && req.method === 'POST') {
        res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0');
        return send(res, 200, { ok: true });
    }

    if (pathname === '/api/order' && req.method === 'POST') {
        try {
            const body = JSON.parse(await readBody(req));
            const name    = String(body.name    || '').trim().slice(0, 100);
            const phone   = String(body.phone   || '').trim().slice(0, 50);
            const product = String(body.product || '').trim().slice(0, 200);
            const order_date = String(body.date || '').trim().slice(0, 100);
            const comment = String(body.comment || '').trim().slice(0, 1000);

            if (!name || !phone) {
                return send(res, 400, { error: 'Укажите имя и телефон' });
            }

            const { error } = await supabase.from('orders').insert({
                name: name, phone: phone, product: product,
                order_date: order_date, comment: comment
            });
            if (error) return send(res, 500, { error: error.message });
            return send(res, 200, { ok: true });
        } catch (e) {
            return send(res, 400, { error: 'Bad request' });
        }
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

    if (pathname === '/api/products' && req.method === 'POST') {
        if (!isAuthed(req)) return send(res, 401, { error: 'Не авторизован' });
        try {
            const body = JSON.parse(await readBody(req));
            if (!body.name || !body.price) {
                return send(res, 400, { error: 'Нужны name и price' });
            }
            const item = {
                name:  String(body.name).slice(0, 200),
                descr: String(body.desc || '').slice(0, 1000),
                price: String(body.price).slice(0, 100),
                image: body.image || '',
                button: 'Написать',
                category: String(body.category || 'other').slice(0, 30)
            };
            const { data, error } = await supabase
                .from('products').insert(item).select().single();
            if (error) return send(res, 500, { error: error.message });
            return send(res, 200, {
                id: String(data.id), name: data.name, desc: data.descr || '',
                price: data.price, image: data.image || '',
                button: data.button || 'Написать', category: data.category || 'other'
            });
        } catch (e) {
            return send(res, 400, { error: 'Bad request' });
        }
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
            const id = itemMatch[1];
            const update = {};
            if (body.price !== undefined)    update.price = String(body.price);
            if (body.name  !== undefined)    update.name  = String(body.name);
            if (body.desc  !== undefined)    update.descr = String(body.desc);
            if (body.category !== undefined) update.category = String(body.category).slice(0, 30);
            const { error } = await supabase.from('products').update(update).eq('id', id);
            if (error) return send(res, 500, { error: error.message });
            return send(res, 200, { ok: true });
        } catch (e) {
            return send(res, 400, { error: 'Bad request' });
        }
    }

    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(ROOT, filePath);

    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        return res.end('Forbidden');
    }

    fs.readFile(filePath, function (err, data) {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            return res.end('Not found');
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
    });
});

server.listen(PORT, async function () {
    console.log('');
    console.log('  Сервер запущен:  http://localhost:' + PORT);
    console.log('  Supabase:        ' + (SUPABASE_URL ? 'подключён' : 'НЕ ПОДКЛЮЧЁН'));
    console.log('');
    await seedIfEmpty();
});