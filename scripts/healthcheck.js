import config from '../src/config/index.js';
try {
  const response = await fetch(`http://127.0.0.1:${config.port}/api/ready`, { signal: AbortSignal.timeout(3000) });
  if (!response.ok || (await response.json()).status !== 'ok') process.exitCode = 1;
} catch { process.exitCode = 1; }
