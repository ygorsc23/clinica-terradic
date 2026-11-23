/**
 * CLI do kit de coleta (`npm run coleta`).
 *
 * Le `dados/*.json` e `dados/exemplos-briefing.json`, valida com o mesmo
 * `validarDados` do build, monta o modelo `coleta-1` e grava os sete arquivos
 * em `relatorios/coleta/`. Nao acessa a rede e nao escreve em `dados/`, `dist/`
 * ou `src/`.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  carregarDados,
  carregarExemplosBriefing,
  resolverPublicacao,
  validarDados
} from './lib/dados.mjs';
import { gerarRelatorio } from './lib/relatorio.mjs';
import { MODELO_VERSAO, gerarLeiaMe, montarModeloColeta } from './lib/coleta.mjs';
import { serializarCsv } from './lib/csv.mjs';
import { renderizarQuestionario } from './lib/coleta-html.mjs';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PASTA_COLETA = 'relatorios/coleta';

export const ARQUIVOS_GERADOS = [
  'questionario.html',
  'LEIA-ME.txt',
  'unidades.csv',
  'site.csv',
  'convenios.csv',
  'preparos.csv',
  'textos.csv'
];

function caminhoRelativo(raiz, caminho) {
  return path.relative(raiz, caminho).split(path.sep).join('/');
}

function lerOpcoes(argv) {
  const raiz = argv.find((argumento) => argumento.startsWith('--raiz='));
  return {
    raiz: raiz ? path.resolve(raiz.slice('--raiz='.length)) : RAIZ,
    silencioso: argv.includes('--silencioso')
  };
}

export async function executarColeta({ raiz = RAIZ, silencioso = false } = {}) {
  const log = silencioso ? () => {} : (...argumentos) => console.log(...argumentos);
  const erroLog = silencioso ? () => {} : (...argumentos) => console.error(...argumentos);

  log(`Terradic - kit de coleta (modelo ${MODELO_VERSAO})`);

  const dados = await carregarDados(raiz);
  const exemplos = await carregarExemplosBriefing(raiz);
  const erros = validarDados(dados, { exemplos });
  if (erros.length > 0) {
    for (const erro of erros) {
      erroLog(`${erro.codigo} — ${erro.detalhe}`);
    }
    erroLog(`\n${erros.length} erro(s) de dados. Kit nao gerado.`);
    return { ok: false, erros, arquivos: [], modelo: null };
  }

  const publicacao = resolverPublicacao(dados);
  const relatorio = gerarRelatorio({ dados, publicacao }).json;
  const modelo = montarModeloColeta({ dados, exemplos, relatorio });

  const pasta = path.join(raiz, ...PASTA_COLETA.split('/'));
  await mkdir(pasta, { recursive: true });

  const conteudos = new Map();
  for (const chave of ['unidades', 'site', 'convenios', 'preparos', 'textos']) {
    const arquivo = modelo.arquivos[chave];
    conteudos.set(
      arquivo.arquivo,
      serializarCsv({ cabecalho: arquivo.cabecalho, linhas: arquivo.linhas })
    );
  }
  conteudos.set('questionario.html', renderizarQuestionario(modelo));
  conteudos.set('LEIA-ME.txt', gerarLeiaMe(modelo));

  const arquivos = [];
  for (const nome of ARQUIVOS_GERADOS) {
    const conteudo = conteudos.get(nome);
    if (typeof conteudo !== 'string') {
      throw new Error(`coleta:arquivo:${nome} — conteudo nao gerado`);
    }
    await writeFile(path.join(pasta, nome), conteudo, 'utf8');
    arquivos.push(nome);
  }

  const dependenciasPendentes = modelo.dependencias.filter((dependencia) => dependencia.pendente);
  const pastaRelativa = caminhoRelativo(raiz, pasta);
  log(`Arquivos gerados em ${pastaRelativa}/:`);
  for (const nome of arquivos) {
    log(`  ${nome}`);
  }
  log(
    `Linhas: unidades ${modelo.resumo.unidades}, site ${modelo.resumo.site}, convenios ${modelo.resumo.convenios}, preparos ${modelo.resumo.preparos}, textos ${modelo.resumo.textos}`
  );
  log(
    `Dependencias pendentes: ${dependenciasPendentes.length > 0 ? dependenciasPendentes.map((item) => item.id).join(', ') : 'nenhuma'}`
  );

  return { ok: true, erros: [], arquivos, modelo };
}

const executadoDiretamente =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (executadoDiretamente) {
  const opcoes = lerOpcoes(process.argv.slice(2));
  executarColeta(opcoes)
    .then((resultado) => {
      if (!resultado.ok) {
        process.exitCode = 1;
      }
    })
    .catch((erro) => {
      console.error(erro.message);
      process.exitCode = 1;
    });
}
