import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function normalizarBase(base) {
  const valor = String(base ?? '').trim();
  if (!valor) {
    throw new Error('base obrigatoria');
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(valor)) {
    throw new Error('base nao pode ter esquema');
  }
  if (valor.startsWith('//')) {
    throw new Error('base nao pode comecar com //');
  }
  if (valor.includes('..')) {
    throw new Error('base nao pode conter ..');
  }
  const semBarras = valor.replace(/\/+$/, '');
  if (!semBarras) {
    return '/';
  }
  return semBarras.startsWith('/') ? semBarras : `/${semBarras}`;
}

function rootRelative(url) {
  return url.startsWith('/') && !url.startsWith('//');
}

const DETECCOES_NAO_SUPORTADAS = [
  { regex: /\bsrcset\s*=/i, mensagem: 'atributo srcset nao validado' },
  { regex: /\baction\s*=/i, mensagem: 'atributo action nao validado' },
  { regex: /url\(\s*\//i, mensagem: 'url(/...) nao validado' },
  {
    regex: /\b(?:href|src)\s*=\s*\/(?!\/)[^\s"'>]*/i,
    mensagem: 'href/src root-relative sem aspas'
  }
];

export function prefixarUrl(url, base) {
  const normalizada = normalizarBase(base);
  if (
    normalizada === '/' ||
    !rootRelative(url) ||
    url === normalizada ||
    url.startsWith(`${normalizada}/`)
  ) {
    return url;
  }
  return url === '/' ? `${normalizada}/` : `${normalizada}${url}`;
}

export function prefixarHtml(html, base) {
  let reescritas = 0;
  const resultado = html.replace(
    /\b(href|src)=(["'])([^"']*)\2/g,
    (todo, atributo, aspas, url) => {
      const nova = prefixarUrl(url, base);
      if (nova === url) {
        return todo;
      }
      reescritas += 1;
      return `${atributo}=${aspas}${nova}${aspas}`;
    }
  );
  return { html: resultado, reescritas };
}

async function listarArquivos(diretorio) {
  const arquivos = [];

  async function percorrer(origem) {
    const entradas = await readdir(origem, { withFileTypes: true });
    for (const entrada of entradas) {
      const caminho = path.join(origem, entrada.name);
      if (entrada.isDirectory()) {
        await percorrer(caminho);
      } else {
        arquivos.push(caminho);
      }
    }
  }

  await percorrer(diretorio);
  return arquivos;
}

export async function prefixarDiretorio(diretorio, base) {
  const normalizada = normalizarBase(base);
  const arquivos = (await listarArquivos(diretorio)).filter((arquivo) =>
    arquivo.endsWith('.html')
  );
  let reescritas = 0;
  for (const arquivo of arquivos) {
    const original = await readFile(arquivo, 'utf8');
    const resultado = prefixarHtml(original, normalizada);
    if (resultado.html !== original) {
      await writeFile(arquivo, resultado.html, 'utf8');
    }
    reescritas += resultado.reescritas;
  }
  return { base: normalizada, reescritas, paginas: arquivos.length };
}

function caminhoRelativo(url, base) {
  const semAncora = url.split('#')[0].split('?')[0];
  if (semAncora === base) {
    return '/';
  }
  return semAncora.startsWith(`${base}/`) ? semAncora.slice(base.length) : null;
}

async function destinoExiste(diretorio, caminho) {
  let decodificado;
  try {
    decodificado = decodeURIComponent(caminho);
  } catch {
    return false;
  }
  const alvo = path.join(diretorio, ...decodificado.split('/').filter(Boolean));
  const relativo = path.relative(diretorio, alvo);
  if (relativo.startsWith('..') || path.isAbsolute(relativo)) {
    return false;
  }
  try {
    const informacao = await stat(alvo);
    if (informacao.isFile()) {
      return true;
    }
    if (informacao.isDirectory()) {
      const indice = await stat(path.join(alvo, 'index.html'));
      return indice.isFile();
    }
    return false;
  } catch {
    return false;
  }
}

export async function validarArtefato(diretorio, base) {
  const normalizada = normalizarBase(base);
  const erros = [];
  const arquivos = (await listarArquivos(diretorio)).filter((arquivo) =>
    arquivo.endsWith('.html')
  );
  let validados = 0;

  for (const arquivo of arquivos) {
    const relativo = path.relative(diretorio, arquivo).split(path.sep).join('/');
    const html = await readFile(arquivo, 'utf8');
    for (const deteccao of DETECCOES_NAO_SUPORTADAS) {
      if (deteccao.regex.test(html)) {
        erros.push(`${relativo}: ${deteccao.mensagem}`);
      }
    }
    for (const resultado of html.matchAll(/\b(href|src)=(["'])([^"']*)\2/g)) {
      const url = resultado[3];
      if (!rootRelative(url)) {
        continue;
      }
      if (url === normalizada || url.startsWith(`${normalizada}/`)) {
        const caminho = caminhoRelativo(url, normalizada);
        if (caminho === null || !(await destinoExiste(diretorio, caminho))) {
          erros.push(`${relativo}: destino inexistente para ${url}`);
        }
        validados += 1;
      } else {
        erros.push(`${relativo}: link root-relative sem prefixo ${url}`);
      }
    }
  }

  return { validados, erros };
}

const executadoDiretamente =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (executadoDiretamente) {
  const [diretorio, base] = process.argv.slice(2);
  if (!diretorio || !base) {
    console.error('Uso: node scripts/prefixar-base.mjs <diretorio> <base>');
    process.exitCode = 1;
  } else {
    try {
      const resultado = await prefixarDiretorio(diretorio, base);
      const validacao = await validarArtefato(diretorio, base);
      console.log(`Base: ${resultado.base}`);
      console.log(`Paginas HTML: ${resultado.paginas}`);
      console.log(`Reescritas: ${resultado.reescritas}`);
      console.log(`Links validados: ${validacao.validados}`);
      if (validacao.erros.length > 0) {
        for (const erro of validacao.erros) {
          console.error(erro);
        }
        process.exitCode = 1;
      }
    } catch (erro) {
      console.error(erro.message);
      process.exitCode = 1;
    }
  }
}
