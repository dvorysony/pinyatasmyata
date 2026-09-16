const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;

// ПАРОЛЬ АДМИНА. Поменяйте здесь или через переменную окружения:
// Windows:  set ADMIN_PASSWORD=мойпароль && node server.js
// Mac/Linux: ADMIN_PASSWORD=мойпароль node server.js
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'smyata2026';

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'products.json');
const SESSIONS = new Map(); // token -> время истечения

// ---------- стартовые товары ----------
const INITIAL_PRODUCTS = [
    { id: "new-1", name: "Пиньята-цифра",        desc: "Пиньята-цифра, праздничная растяжка, бита и конвертики для сбора сладостей — всё выполнено вручную в едином стиле, чтобы каждая деталь дополняла друг друга..", price: "от 5 000 ₽",    image: "images/cifra.jpg",  button: "Написать" },
    { id: "new-2", name: "Пиньята-торт",         desc: "Многоярусная пиньята-торт с декором. Красиво и вкусно!",     price: "3 500 ₽",       image: "images/tort.jpg",   button: "Написать" },
    { id: "new-3", name: "Пиньята сложная 3D",   desc: "Объемные фигуры: единорог, авокадо, машинка, зайчик и другие.", price: "2 000–5 000 ₽", image: "images/3d.jpg",     button: "Написать" },
    { id: "new-4", name: "Пиньята-шайба",        desc: "Круглая плоская пиньята (шайба) с декором и цветами.",        price: "1 400 ₽",       image: "images/shaiba.jpg", button: "Написать" },
    { id: "new-5", name: "Пиньята-шар 40см",     desc: "Классическая пиньята-шар 40 см. Например, Brawl Stars.",      price: "1 500 ₽",       image: "images/shar40.jpg", button: "Написать" },
    { id: "new-6", name: "Пиньята-шар 50см",     desc: "Классическая пиньята-шар 50 см. Например, LEGO.",              price: "1 900 ₽",       image: "images/shar50.jpg", button: "Написать" }
];

function loadProducts() {
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
        // первый запуск — создаём файл со стартовым набором
        fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_PRODUCTS, null, 2));
        return INITIAL_PRODUCTS.slice();
    }
}

function saveProducts(list) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
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
    const t = c.session;
    if (!t) return false;
    const exp = SESSIONS.get(t);
    if (!exp || exp < Date.now()) { SESSIONS.delete(t); return false; }
    return true;
}

function readBody(req) {
    return new Promise(function (resolve, reject) {
        let data = '';
        req.on('data', function (chunk) {
            data += chunk;
            if (data.length > 20 * 1024 * 1024) { // 20 МБ лимит
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

    // ================= API =================

    // Публичный список товаров
    if (pathname === '/api/products' && req.method === 'GET') {
        return send(res, 200, loadProducts());
    }

    // Проверка: залогинен ли
    if (pathname === '/api/session' && req.method === 'GET') {
        return send(res, 200, { authed: isAuthed(req) });
    }

    // Вход
    if (pathname === '/api/login' && req.method === 'POST') {
        try {
            const body = JSON.parse(await readBody(req));
            if (body.password !== ADMIN_PASSWORD) {
                return send(res, 401, { error: 'Неверный пароль' });
            }
            const token = crypto.randomBytes(24).toString('hex');
            SESSIONS.set(token, Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 дней
            res.setHeader('Set-Cookie',
                'session=' + token + '; HttpOnly; Path=/; Max-Age=' + (60 * 60 * 24 * 7) + '; SameSite=Lax');
            return send(res, 200, { ok: true });
        } catch (e) {
            return send(res, 400, { error: 'Bad request' });
        }
    }

    // Выход
    if (pathname === '/api/logout' && req.method === 'POST') {
        const c = parseCookies(req);
        if (c.session) SESSIONS.delete(c.session);
        res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0');
        return send(res, 200, { ok: true });
    }

    // Добавить товар
    if (pathname === '/api/products' && req.method === 'POST') {
        if (!isAuthed(req)) return send(res, 401, { error: 'Не авторизован' });
        try {
            const body = JSON.parse(await readBody(req));
            if (!body.name || !body.price) {
                return send(res, 400, { error: 'Нужны name и price' });
            }
            const list = loadProducts();
            const item = {
                id: 'p' + Date.now(),
                name:  String(body.name).slice(0, 200),
                desc:  String(body.desc || '').slice(0, 1000),
                price: String(body.price).slice(0, 100),
                image: body.image || '',
                button: 'Написать'
            };
            list.push(item);
            saveProducts(list);
            return send(res, 200, item);
        } catch (e) {
            return send(res, 400, { error: 'Bad request' });
        }
    }

    // Удалить / изменить конкретный товар
    const itemMatch = pathname.match(/^\/api\/products\/([^\/]+)$/);

    if (itemMatch && req.method === 'DELETE') {
        if (!isAuthed(req)) return send(res, 401, { error: 'Не авторизован' });
        const id = itemMatch[1];
        const list = loadProducts().filter(function (p) { return p.id !== id; });
        saveProducts(list);
        return send(res, 200, { ok: true });
    }

    if (itemMatch && req.method === 'PUT') {
        if (!isAuthed(req)) return send(res, 401, { error: 'Не авторизован' });
        try {
            const body = JSON.parse(await readBody(req));
            const id = itemMatch[1];
            const list = loadProducts();
            const item = list.find(function (p) { return p.id === id; });
            if (!item) return send(res, 404, { error: 'Не найдено' });
            if (body.price !== undefined) item.price = String(body.price);
            if (body.name  !== undefined) item.name  = String(body.name);
            if (body.desc  !== undefined) item.desc  = String(body.desc);
            saveProducts(list);
            return send(res, 200, item);
        } catch (e) {
            return send(res, 400, { error: 'Bad request' });
        }
    }

    // ================= СТАТИКА =================

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

server.listen(PORT, function () {
    console.log('');
    console.log('  Сервер запущен:  http://localhost:' + PORT);
    console.log('  Порт:            ' + PORT);
    console.log('  Пароль админа задан через переменную окружения ADMIN_PASSWORD');
    console.log('');
});