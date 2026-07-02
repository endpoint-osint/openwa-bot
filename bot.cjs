const { io } = require('socket.io-client');

const API_KEY = process.env.OPENWA_API_KEY || process.env.API_MASTER_KEY || 'openwa-dev-key-2026';
const PORT = process.env.PORT || 2785;
const BASE_URL = process.env.OPENWA_URL || `http://localhost:${PORT}`;

let SESSION_ID = null;

async function waitForServer() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
}

async function findOrCreateSession() {
  const res = await fetch(`${BASE_URL}/api/sessions`, {
    headers: { 'X-API-Key': API_KEY }
  });
  const sessions = await res.json();

  if (sessions.length > 0) {
    const s = sessions[0];
    SESSION_ID = s.id;
    console.log(`[BOT] Sessao existente: ${s.name} (${s.id}) status=${s.status}`);

    if (s.status === 'created') {
      await fetch(`${BASE_URL}/api/sessions/${SESSION_ID}/start`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY }
      });
      console.log('[BOT] Sessao iniciada, aguardando QR...');
    }
    return;
  }

  const res2 = await fetch(`${BASE_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'meu-bot' })
  });
  const s = await res2.json();
  SESSION_ID = s.id;
  console.log(`[BOT] Nova sessao: ${s.name} (${s.id})`);

  await fetch(`${BASE_URL}/api/sessions/${SESSION_ID}/start`, {
    method: 'POST',
    headers: { 'X-API-Key': API_KEY }
  });
}

async function sendMessage(chatId, text) {
  try {
    const res = await fetch(`${BASE_URL}/api/sessions/${SESSION_ID}/messages/send-text`, {
      method: 'POST',
      headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, text })
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[ERRO API]', res.status, err);
      return;
    }
    console.log(`[ENVIADO] ${chatId}: "${text}"`);
  } catch (err) {
    console.error('[ERRO ENVIO]', err.message);
  }
}

const replies = {
  'oi': 'Ola! Eu sou um bot criado com OpenWA. Como posso ajudar?',
  'ola': 'Ola! Eu sou um bot criado com OpenWA. Como posso ajudar?',
  'bom dia': 'Bom dia! Como posso ajudar hoje?',
  'boa tarde': 'Boa tarde! Em que posso ajudar?',
  'boa noite': 'Boa noite! Como posso ajudar?',
  'tudo bem': 'Tudo otimo! E voce?',
  'obrigado': 'Por nada! Estou aqui para ajudar.',
  'valeu': 'Por nada! Estou aqui para ajudar.',
  'help': 'Comandos: oi, bom dia, boa tarde, boa noite, obrigado, info',
  'info': 'OpenWA Bot v1.0 | Node.js + Socket.IO | Status: Online',
};

async function startBot() {
  console.log('[BOT] Aguardando servidor...');
  const ready = await waitForServer();
  if (!ready) {
    console.error('[BOT] Servidor nao respondeu. Abortando.');
    process.exit(1);
  }

  await findOrCreateSession();

  const socket = io(`${BASE_URL}/events`, {
    auth: { apiKey: API_KEY },
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log('[BOT] Conectado ao OpenWA via Socket.IO');
    socket.emit('message', {
      type: 'subscribe',
      sessionId: SESSION_ID || '*',
      events: ['message.received', 'session.status'],
      requestId: 'bot-sub',
    });
  });

  socket.on('message', async (msg) => {
    if (msg.type === 'event') {
      const { event, data } = msg.payload;

      if (event === 'message.received') {
        if (data.fromMe) return;
        if (data.isGroup) return;

        const chatId = data.from;
        const text = (data.body || '').trim().toLowerCase();

        console.log(`[RECEBIDO] ${chatId}: "${data.body}"`);

        for (const [key, reply] of Object.entries(replies)) {
          if (text.includes(key)) {
            await sendMessage(chatId, reply);
            return;
          }
        }

        if (text.length > 0) {
          await sendMessage(chatId, 'Olá! Digite "help" para ver os comandos.');
        }
      }
    } else if (msg.type === 'subscribed') {
      console.log('[BOT] Inscrito:', msg.events);
    } else if (msg.type === 'error') {
      console.error('[BOT] Erro:', msg.code, msg.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('[BOT] Desconectado. Reconectando...');
  });

  socket.on('connect_error', (err) => {
    console.error('[BOT] Erro conexao:', err.message);
  });

  console.log('[BOT] Iniciando...');
}

startBot();
