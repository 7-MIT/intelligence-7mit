// Server OpenAI-compatible tiruan untuk uji end-to-end: tool calling berskrip, tanpa jaringan eksternal.
import http from 'node:http';

export function startMock(port = 0) {
  const seen = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      if (req.url.endsWith('/models')) { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ data: [{ id: 'mock-1' }] })); }
      const j = JSON.parse(body || '{}');
      seen.push({ auth: req.headers.authorization, body: j });
      const msgs = j.messages;
      const last = msgs[msgs.length - 1];
      const toolResults = msgs.filter((m) => m.role === 'tool').length;
      const userText = JSON.stringify(msgs.filter((m) => m.role === 'user').map((m) => m.content)).toLowerCase();
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const send = (delta, finish) => res.write(`data: ${JSON.stringify({ choices: [{ delta, finish_reason: finish ?? null }] })}\n\n`);
      if (j.tools && userText.includes('buat file') && toolResults === 0) {
        send({ content: 'Membuat file...' });
        send({ tool_calls: [{ index: 0, id: 'call_1', function: { name: 'write_file', arguments: '{"path":"hello.txt",' } }] });
        send({ tool_calls: [{ index: 0, function: { arguments: '"content":"halo dari agen\\n"}' } }] }, 'tool_calls');
      } else if (j.tools && userText.includes('buat file') && toolResults === 1) {
        send({ content: `Selesai. Hasil tool: ${String(last.content).slice(0, 80)}` }, 'stop');
      } else {
        send({ content: 'Halo! Ini balasan tiruan.' }, 'stop');
      }
      res.write('data: [DONE]\n\n');
      res.end();
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port, seen })));
}
