/**
 * CLI do importador do kit de coleta (`npm run importar:coleta`).
 *
 * Le os cinco CSVs de `--pasta` (padrao `relatorios/coleta`), valida tudo,
 * grava `dados/*.json` apenas se o kit inteiro estiver valido e escreve o log
 * deterministico em `importacao.md`/`importacao.json`. Nao acessa a rede.
 */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { importarColeta } from './lib/coleta.mjs';

export const RAIZ_IMPORTACAO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PASTA_IMPORTACAO = 'relatorios/coleta';

function limparTerminal(valor) {
  return String(valor ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '?')
    .replace(/\r|\n/g, ' ');
}

export function lerOpcoesImportacao(argv) {  const pasta = argv.find((argumento) => argumento.startsWith('--pasta='));
  const raiz = argv.find((argumento) => argumento.startsWith('--raiz='));
  return {
    raiz: raiz ? path.resolve(raiz.slice('--raiz='.length)) : RAIZ_IMPORTACAO,
    pasta: pasta && pasta.slice('--pasta='.length) ? pasta.slice('--pasta='.length) : PASTA_IMPORTACAO,
    sobrescrever: argv.includes('--sobrescrever')
  };
}

export async function executarImportacao({
  raiz = RAIZ_IMPORTACAO,
  pasta = PASTA_IMPORTACAO,
  sobrescrever = false,
  silencioso = false
} = {}) {
  const log = silencioso ? () => {} : (...argumentos) => console.log(...argumentos);
  const erroLog = silencioso ? () => {} : (...argumentos) => console.error(...argumentos);

  const resultado = await importarColeta({ raiz, pasta, sobrescrever });

  if (!resultado.ok) {
    for (const erro of resultado.erros) {
      const linha = erro.linha ? ` (linha ${erro.linha})` : '';
      erroLog(`${limparTerminal(erro.codigo)} — ${limparTerminal(erro.detalhe)}${linha}`);
    }
    if (resultado.avisos.length > 0) {
      for (const aviso of resultado.avisos) {
        erroLog(`aviso: ${limparTerminal(aviso)}`);
      }
    }
    erroLog(`\n${resultado.erros.length} erro(s). Nada foi gravado em dados/. Log: importacao.md/json.`);
    return resultado;
  }

  log('Terradic - importacao do kit de coleta');
  for (const aviso of resultado.avisos) {
    log(`aviso: ${limparTerminal(aviso)}`);
  }
  log(
    `Linhas importadas: ${resultado.log.json.resumo.linhasImportadas}, ignoradas: ${resultado.log.json.resumo.linhasIgnoradas}, erros: 0`
  );
  if (resultado.arquivosGravados.length === 0) {
    log('Nenhum JSON alterado (kit idempotente nesta rodada).');
  } else {
    log(`JSON gravados: ${resultado.arquivosGravados.join(', ')}`);
  }
  log('Log: relatorios/coleta/importacao.md e importacao.json');
  log('Promocao de status continua manual; o go-live segue exigindo npm run build:go-live.');
  return resultado;
}

const executadoDiretamente =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (executadoDiretamente) {
  executarImportacao(lerOpcoesImportacao(process.argv.slice(2)))
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
