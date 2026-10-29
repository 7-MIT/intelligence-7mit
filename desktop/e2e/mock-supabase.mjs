// Supabase tiruan untuk E2E: /auth/v1/token, /logout dan REST tabel riwayat.
import http from 'node:http';

export function startSupabase() {
  const state = { rows: [{ id: '11111111-1111-4111-8111-111111111111', title: 'Chat dari web', messages: [{ role: 'user', content: 'pertanyaan dari web' }, { role: 'assistant', content: 'jawaban dari web' }], created_at: '2026-01-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z' }], posts: [], logins: [], loggedOut: false };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
      if (req.url.startsWith('/auth/v1/token?grant_type=password')) {
        const b = JSON.parse(body); state.logins.push(b.email);
        if (b.password !== 'rahasia123') return send(400, { msg: 'Invalid login credentials' });
        return send(200, { access_token: 'E2E-JWT', refresh_token: 'E2E-RT', expires_in: 3600, user: { id: 'user-e2e', email: b.email, user_metadata: { display_name: 'Ayu' } } });
      }
      if (req.url.startsWith('/auth/v1/logout')) { state.loggedOut = true; return send(204, {}); }
      if (req.url.startsWith('/rest/v1/intellegence_chat_history')) {
        if (req.headers.authorization !== 'Bearer E2E-JWT') return send(401, { message: 'jwt' });
        if (req.method === 'GET') return send(200, state.rows);
        if (req.method === 'POST') { state.posts.push(JSON.parse(body)); return send(201, {}); }
        return send(204, {});
      }
      send(404, {});
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, state })));
}
