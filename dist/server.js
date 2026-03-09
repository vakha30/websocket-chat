"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ws_1 = require("ws");
const crypto = __importStar(require("crypto"));
// Директория для хранения загруженных изображений
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
// Создаем директорию для загрузок, если её нет
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
// Хранилище подключенных клиентов
const clients = new Map();
// Создание HTTP сервера для раздачи статических файлов
const server = http.createServer((req, res) => {
    let filePath = req.url === '/' || req.url === undefined ? '/index.html' : req.url;
    filePath = path.join(__dirname, '..', 'public', filePath);
    const extname = path.extname(filePath);
    const contentTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
    };
    // Обработка загрузки изображений
    if (req.url?.startsWith('/uploads/') && req.method === 'GET') {
        const imagePath = path.join(UPLOADS_DIR, path.basename(req.url));
        fs.readFile(imagePath, (err, content) => {
            if (err) {
                res.writeHead(404);
                res.end('Image not found');
            }
            else {
                const ext = path.extname(imagePath);
                res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'image/png' });
                res.end(content);
            }
        });
        return;
    }
    // Обработка POST запроса для загрузки изображений
    if (req.url === '/upload' && req.method === 'POST') {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            const body = Buffer.concat(chunks);
            // Парсим multipart данные
            const boundary = req.headers['content-type']?.split('boundary=')[1];
            if (!boundary) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'No boundary' }));
                return;
            }
            const boundaryBuffer = '--' + boundary;
            const parts = body.toString('binary').split(boundaryBuffer);
            for (const part of parts) {
                if (part.includes('filename=') && part.includes('image/')) {
                    // Извлекаем данные изображения
                    const headerEnd = part.indexOf('\r\n\r\n');
                    if (headerEnd !== -1) {
                        const imageData = part.substring(headerEnd + 4, part.length - 2);
                        const buffer = Buffer.from(imageData, 'binary');
                        // Генерируем уникальное имя файла
                        const ext = part.includes('png') ? '.png' :
                            part.includes('jpg') || part.includes('jpeg') ? '.jpg' :
                                part.includes('gif') ? '.gif' : '.png';
                        const filename = `${crypto.randomUUID()}${ext}`;
                        const filepath = path.join(UPLOADS_DIR, filename);
                        fs.writeFileSync(filepath, buffer);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ url: `/uploads/${filename}` }));
                        return;
                    }
                }
            }
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No image found' }));
        });
        return;
    }
    const contentType = contentTypes[extname] || 'text/plain';
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // Если файл не найден, возвращаем index.html
                fs.readFile(path.join(__dirname, '..', 'public', 'index.html'), (err, content) => {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(content, 'utf-8');
                });
            }
            else {
                res.writeHead(500);
                res.end('Server Error');
            }
        }
        else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});
// Создание WebSocket сервера
const wss = new ws_1.WebSocketServer({ server });
// Получение списка всех пользователей
function getUsersList() {
    const users = [];
    clients.forEach((client) => {
        users.push(client.username);
    });
    return users;
}
// Отправка сообщения всем подключенным клиентам
function broadcast(message, excludeWs) {
    const data = JSON.stringify(message);
    clients.forEach((client, ws) => {
        if (ws !== excludeWs && ws.readyState === ws_1.WebSocket.OPEN) {
            ws.send(data);
        }
    });
}
// Обработка новых подключений
wss.on('connection', (ws) => {
    console.log('Новое подключение');
    // Обработка сообщений от клиента
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            switch (message.type) {
                case 'join':
                    // Регистрация пользователя
                    if (message.username) {
                        clients.set(ws, { ws, username: message.username });
                        console.log(`Пользователь ${message.username} присоединился`);
                        // Отправляем список пользователей всем
                        broadcast({
                            type: 'users',
                            users: getUsersList(),
                        });
                        // Уведомляем о входе
                        broadcast({
                            type: 'join',
                            username: message.username,
                            content: `${message.username} присоединился к чату`,
                        }, ws);
                    }
                    break;
                case 'message':
                    // Пересылка сообщения всем
                    const client = clients.get(ws);
                    if (client && message.content) {
                        broadcast({
                            type: 'message',
                            username: client.username,
                            content: message.content,
                        });
                    }
                    break;
                case 'image':
                    // Пересылка изображения всем
                    const imageClient = clients.get(ws);
                    if (imageClient && message.imageUrl) {
                        broadcast({
                            type: 'image',
                            username: imageClient.username,
                            imageUrl: message.imageUrl,
                        });
                    }
                    break;
            }
        }
        catch (error) {
            console.error('Ошибка при обработке сообщения:', error);
        }
    });
    // Обработка отключения
    ws.on('close', () => {
        const client = clients.get(ws);
        if (client) {
            console.log(`Пользователь ${client.username} покинул чат`);
            // Уведомляем о выходе
            broadcast({
                type: 'leave',
                username: client.username,
                content: `${client.username} покинул чат`,
            });
            // Обновляем список пользователей
            broadcast({
                type: 'users',
                users: getUsersList(),
            });
            clients.delete(ws);
        }
    });
    // Обработка ошибок
    ws.on('error', (error) => {
        console.error('Ошибка WebSocket:', error);
    });
});
// Запуск сервера
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
    console.log('WebSocket сервер готов к работе');
});
//# sourceMappingURL=server.js.map