import http from 'node:http';
import path from 'node:path';
import { existsSync, watch } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { executarBuild } from './build.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(RAIZ, 'dist-rascunho');
const PORTA = Number(process.env.PORT || 4173);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

await executarBuild({ raiz: RAIZ, rascunho: true }).then((resultado) => {
  if (!resultado.ok) {
    console.error('build inicial falhou; corrija os erros acima antes de pre-visualizar');
    process.exitCode = 1;
  }
});

let temporizador = null;

function agendarReconstrucao() {
  clearTimeout(temporizador);
  temporizador = setTimeout(async () => {
    try {
      const resultado = await executarBuild({ raiz: RAIZ, rascunho: true, silencioso: true });
      if (!resultado.ok) {
        console.error('rebuild falhou: o build retornou erros (veja o log acima)');
        return;
      }
      console.log('rebuild concluido');
    } catch (erro) {
      console.error(`rebuild falhou: ${erro.message}`);
    }
  }, 200);
}

for (const alvo of ['src', 'dados', 'dados-teste']) {
  const caminho = path.join(RAIZ, alvo);
  if (existsSync(caminho)) {
    watch(caminho, { recursive: true }, agendarReconstrucao);
  }
}
const configTailwind = path.join(RAIZ, 'tailwind.config.js');
if (existsSync(configTailwind)) {
  watch(configTailwind, agendarReconstrucao);
}

function resolverArquivo(caminhoUrl) {
  const partes = caminhoUrl.split('/').filter(Boolean);
  let destino = path.join(DIST, ...partes);
  if (caminhoUrl.endsWith('/')) {
    destino = path.join(destino, 'index.html');
  }
  if (!destino.startsWith(DIST)) {
    return null;
  }
  return destino;
}

const servidor = http.createServer(async (requisicao, resposta) => {
  const url = new URL(requisicao.url, `http://localhost:${PORTA}`);
  let arquivo = resolverArquivo(decodeURIComponent(url.pathname));

  if (arquivo) {
    try {
      const informacao = await stat(arquivo);
      if (informacao.isDirectory()) {
        arquivo = path.join(arquivo, 'index.html');
      }
    } catch {
      arquivo = path.join(`${arquivo}`, 'index.html');
    }
  }

  if (arquivo) {
    try {
      const conteudo = await readFile(arquivo);
      resposta.writeHead(200, {
        'content-type': TIPOS[path.extname(arquivo)] ?? 'application/octet-stream'
      });
      resposta.end(conteudo);
      return;
    } catch {
      // cai no 404 abaixo
    }
  }

  try {
    const conteudo = await readFile(path.join(DIST, '404.html'));
    resposta.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    resposta.end(conteudo);
  } catch {
    resposta.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    resposta.end('404');
  }
});

servidor.listen(PORTA, () => {
  console.log(`Pre-visualizacao (rascunho): http://localhost:${PORTA}/`);
});
