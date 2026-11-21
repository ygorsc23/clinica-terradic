import http from 'node:http';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { createReadStream, mkdtempSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { spawn } from 'node:child_process';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(RAIZ, 'dist-rascunho');
const PORTA = 4184;
const PORTA_CDP = 9333;
const CHROME =
  process.env.CHROME_PATH ||
  (existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

function iniciarServidor() {
  return http.createServer(async (requisicao, resposta) => {
    const url = new URL(requisicao.url, `http://127.0.0.1:${PORTA}`);
    let arquivo = path.join(DIST, ...decodeURIComponent(url.pathname).split('/').filter(Boolean));
    if (url.pathname.endsWith('/')) {
      arquivo = path.join(arquivo, 'index.html');
    }
    try {
      const info = await stat(arquivo);
      if (info.isDirectory()) {
        arquivo = path.join(arquivo, 'index.html');
      }
      resposta.writeHead(200, { 'content-type': TIPOS[path.extname(arquivo)] ?? 'application/octet-stream' });
      createReadStream(arquivo).pipe(resposta);
    } catch {
      try {
        const conteudo = await readFile(path.join(DIST, '404.html'));
        resposta.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
        resposta.end(conteudo);
      } catch {
        resposta.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        resposta.end('404');
      }
    }
  });
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pendentes = new Map();
    this.eventos = new Map();
    ws.addEventListener('message', (evento) => {
      const mensagem = JSON.parse(evento.data);
      if (mensagem.id) {
        const pendente = this.pendentes.get(mensagem.id);
        if (pendente) {
          this.pendentes.delete(mensagem.id);
          if (mensagem.error) pendente.reject(new Error(mensagem.error.message));
          else pendente.resolve(mensagem.result);
        }
        return;
      }
      const ouvintes = this.eventos.get(mensagem.method);
      if (ouvintes) {
        for (const ouvinte of ouvintes) ouvintes.delete(ouvinte), ouvinte(mensagem.params);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pendentes.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  once(method) {
    return new Promise((resolve) => {
      const ouvinte = (params) => resolve(params);
      if (!this.eventos.has(method)) this.eventos.set(method, new Set());
      this.eventos.get(method).add(ouvinte);
    });
  }
}

async function avaliar(cdp, expressao) {
  const resultado = await cdp.send('Runtime.evaluate', {
    expression: expressao,
    returnByValue: true,
    awaitPromise: true
  });
  if (resultado.exceptionDetails) {
    throw new Error(resultado.exceptionDetails.text ?? 'erro de avaliação');
  }
  return resultado.result.value;
}

async function navegar(cdp, url) {
  const carregou = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', { url });
  await carregou;
  await new Promise((resolve) => setTimeout(resolve, 350));
}

const EXPRESSAO_OVERFLOW = `(() => {
  const largura = window.innerWidth;
  const overflow = document.documentElement.scrollWidth > largura || document.body.scrollWidth > largura;
  const fora = [];
  for (const el of document.querySelectorAll('main *, footer *')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && (r.right > largura + 1 || r.left < -1)) {
      fora.push({ tag: el.tagName, classe: String(el.className).slice(0, 60), esquerda: Math.round(r.left), direita: Math.round(r.right) });
      if (fora.length >= 8) break;
    }
  }
  const sobreposicoes = (seletor) => {
    const itens = [...document.querySelectorAll(seletor)].map((el) => el.getBoundingClientRect());
    let total = 0;
    for (let i = 0; i < itens.length; i += 1) {
      for (let j = i + 1; j < itens.length; j += 1) {
        const a = itens[i];
        const b = itens[j];
        const larguraInterseccao = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const alturaInterseccao = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (larguraInterseccao > 2 && alturaInterseccao > 2) total += 1;
      }
    }
    return total;
  };
  return {
    largura,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    overflow,
    fora,
    sobreposicoes: {
      rodape: sobreposicoes('footer .grid > div'),
      horarios: sobreposicoes('.horario-lista > li'),
      convenios: sobreposicoes('.chip-lista > li')
    }
  };
})()`;

const EXPRESSAO_A11Y = `(() => {
  const textos = (el) => (el.getAttribute('aria-label') || el.textContent || '').trim();
  const linksSemNome = [...document.querySelectorAll('a')].filter((a) => !textos(a)).length;
  const botoesSemNome = [...document.querySelectorAll('button')].filter((b) => !textos(b)).length;
  const imagensSemAlt = [...document.querySelectorAll('img')].filter((img) => !img.hasAttribute('alt')).length;
  const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
  const idsDuplicados = ids.filter((id, indice) => ids.indexOf(id) !== indice);
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => Number(h.tagName[1]));
  let salto = 0;
  for (let i = 1; i < headings.length; i += 1) {
    if (headings[i] - headings[i - 1] > 1) salto += 1;
  }
  return {
    lang: document.documentElement.lang,
    h1: document.querySelectorAll('h1').length,
    skip: document.querySelectorAll('a.pular-link[href="#conteudo"]').length,
    main: document.querySelectorAll('main#conteudo').length,
    header: document.querySelectorAll('header').length,
    footer: document.querySelectorAll('footer').length,
    nav: document.querySelectorAll('nav').length,
    linksSemNome,
    botoesSemNome,
    imagensSemAlt,
    idsDuplicados: [...new Set(idsDuplicados)],
    saltosDeHeading: salto,
    formularios: document.querySelectorAll('form').length,
    inputs: document.querySelectorAll('input,textarea,select').length
  };
})()`;

async function main() {
  if (!existsSync(CHROME)) {
    console.error(`Chrome/Edge não encontrado em ${CHROME}`);
    process.exitCode = 1;
    return;
  }
  if (!existsSync(path.join(DIST, 'index.html'))) {
    console.error('dist-rascunho/index.html ausente; rode npm run build:rascunho antes.');
    process.exitCode = 1;
    return;
  }

  const servidor = iniciarServidor();
  await new Promise((resolve) => servidor.listen(PORTA, '127.0.0.1', resolve));

  const perfil = mkdtempSync(path.join(os.tmpdir(), 'terradic-auditoria-'));
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-dev-shm-usage',
      `--remote-debugging-port=${PORTA_CDP}`,
      `--user-data-dir=${perfil}`,
      'about:blank'
    ],
    { stdio: 'ignore' }
  );

  try {
    let versao = null;
    for (let tentativa = 0; tentativa < 60; tentativa += 1) {
      try {
        const resposta = await fetch(`http://127.0.0.1:${PORTA_CDP}/json/version`);
        versao = await resposta.json();
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    if (!versao) throw new Error('CDP não respondeu');

    const lista = await (await fetch(`http://127.0.0.1:${PORTA_CDP}/json/list`)).json();
    const alvo = lista.find((item) => item.type === 'page') ?? lista[0];
    const ws = new WebSocket(alvo.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    const cdp = new Cdp(ws);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('Performance.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        window.__audit = { lcp: 0, cls: 0, shifts: 0 };
        try {
          new PerformanceObserver((lista) => {
            for (const entrada of lista.getEntries()) {
              window.__audit.lcp = Math.max(window.__audit.lcp, entrada.startTime);
            }
          }).observe({ type: 'largest-contentful-paint', buffered: true });
          new PerformanceObserver((lista) => {
            for (const entrada of lista.getEntries()) {
              if (!entrada.hadRecentInput) {
                window.__audit.cls += entrada.value;
                window.__audit.shifts += 1;
              }
            }
          }).observe({ type: 'layout-shift', buffered: true });
        } catch {}
      `
    });

    const paginas = [
      { nome: 'home', rota: '/' },
      { nome: 'unidade', rota: '/unidades/teste-centro/' },
      { nome: 'servico', rota: '/servicos/tomografia/' },
      { nome: 'preparo', rota: '/preparo-de-exames/' },
      { nome: 'contato', rota: '/contato/' },
      { nome: '404', rota: '/404.html' }
    ];
    const larguras = [320, 360, 768, 1024, 1280, 1440];
    const resultados = { chrome: versao['Browser'], overflow: [], a11y: [], teclado: [], performance: null, noJs: null };
    const base = `http://127.0.0.1:${PORTA}`;

    for (const pagina of paginas) {
      for (const largura of larguras) {
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: largura,
          height: 900,
          deviceScaleFactor: 1,
          mobile: false
        });
        await navegar(cdp, `${base}${pagina.rota}`);
        const medicao = await avaliar(cdp, EXPRESSAO_OVERFLOW);
        resultados.overflow.push({ pagina: pagina.nome, largura, ...medicao });
      }
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 360,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false
      });
      await navegar(cdp, `${base}${pagina.rota}`);
      const a11y = await avaliar(cdp, EXPRESSAO_A11Y);
      resultados.a11y.push({ pagina: pagina.nome, ...a11y });
    }

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 360,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await navegar(cdp, `${base}/`);

    const focoInicial = await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Tab',
      code: 'Tab',
      windowsVirtualKeyCode: 9
    }).then(() => avaliar(cdp, `(() => {
      const el = document.activeElement;
      const cs = getComputedStyle(el);
      return { tag: el.tagName, classe: el.className, texto: (el.textContent || '').trim(), outline: cs.outlineWidth + ' ' + cs.outlineColor };
    })()`));

    const menuAberto = await avaliar(cdp, `(() => {
      const botao = document.querySelector('[data-menu-botao]');
      if (!botao) return { existe: false };
      botao.focus();
      botao.click();
      return { existe: true, aberto: botao.getAttribute('aria-expanded') };
    })()`);
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27
    });
    const menuFechado = await avaliar(cdp, `(() => {
      const botao = document.querySelector('[data-menu-botao]');
      return { aberto: botao.getAttribute('aria-expanded'), focoNoBotao: document.activeElement === botao };
    })()`);

    await navegar(cdp, `${base}/preparo-de-exames/`);
    const acordeao = await avaliar(cdp, `(async () => {
      const detalhe = document.querySelector('details[data-acordeao]');
      if (!detalhe) return { existe: false };
      const resumo = detalhe.querySelector('summary');
      resumo.focus();
      const antes = detalhe.open;
      resumo.click();
      await new Promise((resolve) => setTimeout(resolve, 80));
      return { existe: true, antes, depois: detalhe.open, aria: resumo.getAttribute('aria-expanded') };
    })()`);

    resultadoTeclado: {
      resultados.teclado.push({ focoInicial, menuAberto, menuFechado, acordeao });
    }

    // Performance aproximada em 4G, sem Lighthouse.
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: 200000,
      uploadThroughput: 100000
    });
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await navegar(cdp, `${base}/`);
    await new Promise((resolve) => setTimeout(resolve, 800));
    const performanceAudit = await avaliar(cdp, `(() => {
      const nav = performance.getEntriesByType('navigation')[0] || {};
      const recursos = performance.getEntriesByType('resource');
      const transferencia = recursos.reduce((total, r) => total + (r.transferSize || 0), 0);
      return {
        lcp: window.__audit.lcp,
        cls: window.__audit.cls,
        shifts: window.__audit.shifts,
        domContentLoaded: nav.domContentLoadedEventEnd,
        load: nav.loadEventEnd,
        transferSize: transferencia,
        recursos: recursos.length,
        nosDom: document.querySelectorAll('*').length
      };
    })()`);
    resultados.performance = performanceAudit;

    // Sem JS: o HTML estático continua legível e os <details> existem.
    await cdp.send('Emulation.setScriptExecutionDisabled', { value: true });
    await navegar(cdp, `${base}/preparo-de-exames/`);
    const noJsPreparo = await avaliar(cdp, `({
      details: document.querySelectorAll('details').length,
      conteudo: (document.querySelector('main')?.textContent || '').trim().length
    })`);
    await navegar(cdp, `${base}/unidades/teste-centro/`);
    const noJsUnidade = await avaliar(cdp, `({
      linkMapa: document.body.innerHTML.includes('Abrir a localização no Google Maps'),
      conteudo: (document.querySelector('main')?.textContent || '').trim().length
    })`);
    resultados.noJs = { preparo: noJsPreparo, unidade: noJsUnidade };
    await cdp.send('Emulation.setScriptExecutionDisabled', { value: false });

    const css = await readFile(path.join(DIST, 'assets', 'estilo.css'));
    const js = await readFile(path.join(DIST, 'assets', 'app.js'));
    resultados.orcamento = {
      cssBytes: css.length,
      cssGzipBytes: gzipSync(css).length,
      jsBytes: js.length,
      jsGzipBytes: gzipSync(js).length
    };

    console.log(JSON.stringify(resultados, null, 2));
    ws.close();
  } finally {
    chrome.kill();
    servidor.close();
  }
}

main().catch((erro) => {
  console.error(erro.stack || erro.message);
  process.exitCode = 1;
});
