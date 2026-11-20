import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const REGEX_TOKEN = /\{\{([a-zA-Z0-9_-]+)\}\}/g;

export function escapar(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Substitui tokens `{{chave}}` de um template.
 * `fragmento` entra cru (HTML ja renderizado internamente);
 * `texto` entra escapado (conteudo vindo de JSON).
 */
export function modelo(template, { texto = {}, fragmento = {} } = {}) {
  const faltando = new Set();
  const resultado = template.replace(REGEX_TOKEN, (original, chave) => {
    if (Object.hasOwn(fragmento, chave)) {
      return fragmento[chave] ?? '';
    }
    if (Object.hasOwn(texto, chave)) {
      return escapar(texto[chave]);
    }
    faltando.add(chave);
    return original;
  });
  if (faltando.size > 0) {
    throw new Error(`Tokens nao preenchidos: ${[...faltando].join(', ')}`);
  }
  return resultado;
}

export function listar(itens, template, preparar) {
  return itens.map((item) => modelo(template, preparar(item))).join('');
}

async function lerArquivosHtml(diretorio, prefixo = '') {
  const entradas = await readdir(diretorio, { withFileTypes: true });
  const arquivos = [];
  for (const entrada of entradas) {
    const caminho = path.join(diretorio, entrada.name);
    const chave = prefixo ? `${prefixo}/${entrada.name}` : entrada.name;
    if (entrada.isDirectory()) {
      arquivos.push(...(await lerArquivosHtml(caminho, chave)));
    } else if (entrada.name.endsWith('.html')) {
      arquivos.push([chave.replace(/\.html$/, ''), await readFile(caminho, 'utf8')]);
    }
  }
  return arquivos;
}

export async function carregarTemplates(diretorio) {
  const arquivos = await lerArquivosHtml(diretorio);
  return new Map(arquivos);
}

export function template(templates, chave) {
  const conteudo = templates.get(chave);
  if (typeof conteudo !== 'string') {
    throw new Error(`Template nao encontrado: ${chave}`);
  }
  return conteudo;
}
