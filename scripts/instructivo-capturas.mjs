// Capturas del instructivo (docs/instructivo/capturas). Se corre contra la app LOCAL con el seed de
// desarrollo: carga unos datos de ejemplo por la API (cobro con saldo a favor, alumno eventual,
// potencial alumno con clase de prueba) y saca las capturas con Chrome por el protocolo DevTools.
//
//   1. Base local con seed:  npm run db:seed   (DATABASE_URL a localhost, base "academy")
//   2. App levantada:        npm run dev
//   3. Capturas:             node scripts/instructivo-capturas.mjs
//
// Variables opcionales: INSTRUCTIVO_WEB_URL (http://localhost:3000), INSTRUCTIVO_API_URL
// (http://localhost:3001/api/v1), INSTRUCTIVO_USER (direccion), INSTRUCTIVO_PASSWORD
// (DEV_SEED_PASSWORD o el valor por defecto del seed) y CHROME_PATH.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = process.env.INSTRUCTIVO_WEB_URL ?? 'http://localhost:3000';
const api = process.env.INSTRUCTIVO_API_URL ?? 'http://localhost:3001/api/v1';
for (const url of [web, api])
  if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(`${url}/`))
    throw new Error(`Solo contra la app local (localhost): ${url}`);
const username = process.env.INSTRUCTIVO_USER ?? 'direccion';
const password =
  process.env.INSTRUCTIVO_PASSWORD ?? process.env.DEV_SEED_PASSWORD ?? 'AcademiaDev2026!';
const chromePath =
  process.env.CHROME_PATH ??
  (process.platform === 'win32'
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : '/usr/bin/google-chrome');
const outDir = fileURLToPath(new URL('../docs/instructivo/capturas/', import.meta.url));
mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- Datos de ejemplo por la API ---------------------------------------------------------------
const login = await fetch(`${api}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password }),
});
if (!login.ok) throw new Error(`No se pudo iniciar sesión como ${username} (${login.status})`);
const session = /academy_session=([^;]+)/.exec(login.headers.get('set-cookie') ?? '')?.[1];
if (!session) throw new Error('El login no devolvió la cookie de sesión');
const call = async (method, path, body) => {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: `academy_session=${session}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok && response.status !== 409)
    throw new Error(`${method} ${path}: ${response.status} ${JSON.stringify(data)}`);
  return data;
};
const cents = (value) => Math.round(Number(value) * 100);

await call('POST', '/cash-shifts/open', {});
const receivables = await call('GET', '/payments/receivables?pageSize=10');
const debtors = receivables.items.map((item) => item.student);
if (debtors.length < 2) throw new Error('El seed tiene que dejar al menos dos alumnos con deuda');
const [withCredit, withDebt] = debtors;
const debtOf = async (studentId) =>
  (await call('GET', `/monthly-charges?studentId=${studentId}`)).items
    .filter((charge) => charge.status !== 'VOID')
    .reduce((sum, charge) => sum + cents(charge.outstandingAmount), 0);
const creditDebt = await debtOf(withCredit.id);
await call('POST', '/payments', {
  studentId: withCredit.id,
  tenders: [{ method: 'CASH', amount: ((creditDebt + 500000) / 100).toFixed(2) }],
  allowCredit: true,
});
const classes = (await call('GET', '/classes?status=ACTIVE&pageSize=5')).items;
await call('POST', '/payments/other', {
  walkIn: { name: 'Lucía Gómez', phone: '3704 555-123', dni: null },
  concept: 'SINGLE_CLASS',
  classId: classes[0].id,
  tenders: [{ method: 'MERCADO_PAGO', amount: '8000.00' }],
});
const lead = await call('POST', '/leads', {
  name: 'Sofía Martínez',
  source: 'INSTAGRAM',
  phone: '3704 111-222',
});
await call('POST', `/leads/${lead.id}/trial-classes`, { classId: classes[0].id });

// --- Chrome por DevTools -----------------------------------------------------------------------
const port = 9300 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), 'instructivo-chrome-'));
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  '--hide-scrollbars',
  '--lang=es-AR',
  'about:blank',
]);
let target;
for (let attempt = 0; attempt < 50 && !target; attempt++) {
  await sleep(200);
  target = await fetch(`http://127.0.0.1:${port}/json/list`)
    .then((response) => response.json())
    .then((list) => list.find((item) => item.type === 'page'))
    .catch(() => undefined);
}
if (!target) throw new Error('Chrome no abrió el puerto de depuración');
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});
let nextId = 0;
const pending = new Map();
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? expression);
  return result.value;
};
const waitFor = async (condition, label, timeout = 60000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evaluate(`Boolean(${condition})`).catch(() => false)) return;
    await sleep(300);
  }
  throw new Error(`No apareció: ${label}`);
};
const waitText = (text) =>
  waitFor(`document.body && document.body.innerText.includes(${JSON.stringify(text)})`, text);
const click = (text, selector = 'button, a, [role=tab], label') =>
  evaluate(`(() => {
    const items = [...document.querySelectorAll(${JSON.stringify(selector)})];
    const element = items.find((item) => item.textContent.trim().includes(${JSON.stringify(text)}));
    if (!element) throw new Error('No encontré: ' + ${JSON.stringify(text)});
    element.click();
    return true;
  })()`);
const type = async (selector, text) => {
  await evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) throw new Error('No encontré el campo ' + ${JSON.stringify(selector)});
    element.focus();
    element.select?.();
    return true;
  })()`);
  await send('Input.insertText', { text });
};
const choose = (selector, index) =>
  evaluate(`(() => {
    const select = document.querySelector(${JSON.stringify(selector)});
    const value = select.options[${index}].value;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return value;
  })()`);
const scrollTo = (text, selector = 'h2, h3, caption') =>
  evaluate(`(() => {
    const element = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .find((item) => item.textContent.trim().includes(${JSON.stringify(text)}));
    element?.scrollIntoView({ block: 'start' });
    window.scrollBy(0, -16);
    return Boolean(element);
  })()`);
const go = async (path, text) => {
  await send('Page.navigate', { url: `${web}${path}` });
  await waitText(text);
  await sleep(800);
};
const shot = async (name) => {
  await sleep(400);
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(outDir, `${name}.png`), Buffer.from(data, 'base64'));
  console.log(`  ${name}.png`);
};

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 860,
    deviceScaleFactor: 1,
    mobile: false,
  });
  // Tema claro: se lee mejor impreso.
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'light' }],
  });
  await send('Network.setCookie', {
    name: 'academy_session',
    value: session,
    domain: 'localhost',
    path: '/',
  });
  console.log(`Capturas en ${outDir}`);

  await go('/', 'Registrar pago');
  await shot('inicio');

  // Registrar pago: buscar, cuotas, cobrar de más y alumno eventual.
  await click('Registrar pago');
  await waitFor(`document.querySelector('.collect-search-field input')`, 'buscador');
  await type('.collect-search-field input', withDebt.lastName);
  await waitFor(`document.querySelector('.collect-result')`, 'resultados');
  await shot('cobro-buscador');
  await click(withDebt.lastName, '.collect-result');
  await waitText('Importe que paga');
  await shot('cobro-cuotas');
  const debt = await debtOf(withDebt.id);
  await type('.collect-amount input', ((debt + 300000) / 100).toFixed(0));
  await waitText('de más');
  await click('dejarlo como saldo a favor', 'label');
  await shot('cobro-saldo-a-favor');
  await click('Cambiar alumno');
  await waitFor(`document.querySelector('.collect-walk-in')`, 'alumno eventual');
  await click('No es alumno');
  await type('.collect-walk-in-fields input', 'Martín Pérez');
  await waitFor(`document.querySelector('.collect-panel select option:nth-child(2)')`, 'clases');
  await choose('.collect-panel select', 1);
  await type('.collect-amount input', '8000');
  await shot('cobro-eventual');

  // Estado de cuenta con saldo a favor, y Corregir: medio, cuotas y devolución.
  await go(`/payments?studentId=${withCredit.id}`, 'Saldo a favor');
  await shot('estado-de-cuenta');
  await click('Saldo a favor', 'button.payment-action');
  await waitText('Corregir pago');
  await shot('corregir-pago');
  await click('Cuotas', 'dialog[open] [role=tab]');
  await waitText('Queda como saldo a favor');
  await shot('corregir-cuotas');
  await click('Devolver saldo', 'dialog[open] [role=tab]');
  await waitText('Importe a devolver');
  await shot('devolver-saldo');

  await go('/payments?tab=history', 'Historial de cobros');
  await shot('historial-cobros');

  await go(`/students/${withDebt.id}`, 'Cuotas');
  await scrollTo('Clases actuales');
  await shot('ficha-alumno');
  await scrollTo('Cuotas', 'h2');
  await shot('ficha-cuotas');

  await go(`/leads/${lead.id}`, 'Clases de prueba');
  await scrollTo('Clases de prueba');
  await shot('potencial-clase-de-prueba');

  await go('/cash', 'Caja');
  await shot('caja');
  await go('/classes', 'Clases');
  await shot('clases');
  await go('/reports', 'Reportes');
  await scrollTo('Recaudación por concepto y medio');
  await shot('reportes-recaudacion');
  await go('/settlements', 'Liquidación');
  await shot('liquidacion');
} finally {
  socket.close();
  chrome.kill();
  await sleep(500);
  rmSync(profile, { recursive: true, force: true });
}
