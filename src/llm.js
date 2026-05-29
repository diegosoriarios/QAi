const http = require('http');

async function callLLM(systemPrompt, userPrompt, config) {
  const model = config.llm?.model || 'qwen2.5-coder:7b';

  const body = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    stream: false,
    keep_alive: config.ollama?.keepAlive || '0m',
    options: {
      temperature: 0.1,
      num_ctx: config.ollama?.numCtx || 8192
    }
  });

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 11434,
        path: '/api/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) { reject(new Error(parsed.error)); return; }
            resolve(parsed.message?.content || '');
          } catch {
            reject(new Error('Failed to parse Ollama response'));
          }
        });
      }
    );
    req.on('error', (err) => reject(new Error(`Ollama connection failed: ${err.message}`)));
    req.write(body);
    req.end();
  });
}

module.exports = { callLLM };
