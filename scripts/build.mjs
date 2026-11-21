import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  URL_BASE_PERMITIDA,
  carregarDados,
  carregarExemplosBriefing,
  carregarJson,
  resolverPublicacao,
  telefonePrincipal,
  validarDados
} from './lib/dados.mjs';
import { carregarTemplates } from './lib/render.mjs';
import { gerarPaginas, planejarRotas } from './lib/paginas.mjs';
import { validarGoLive } from './lib/golive.mjs';
import { gerarRelatorio } from './lib/relatorio.mjs';
import { checarSitemap, executarChecagens, rotaDoArquivo } from './lib/checagens.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function lerOpcoes(argv) {
  const base = argv.find((argumento) => argumento.startsWith('--base-url='));
  const goLive = argv.includes('--go-live');
  return {
    goLive,
    rascunho: goLive ? false : argv.includes('--rascunho'),
    check: argv.includes('--check') || goLive,
    silencioso: argv.includes('--silencioso'),
    baseUrl: base ? base.slice('--base-url='.length) : null
  };
}

function caminhoRelativoDaRota(rota) {
  if (rota === '/') {
    return 'index.html';
  }
  if (rota.endsWith('/')) {
    return `${rota.slice(1)}index.html`;
  }
  return rota.slice(1);
}

function caminhoDaRota(dist, rota) {
  return path.join(dist, ...caminhoRelativoDaRota(rota).split('/'));
}

export function diretorioDeSaida({ rascunho = false, urlBase = URL_BASE_PERMITIDA } = {}) {
  if (rascunho) {
    return 'dist-rascunho';
  }
  if (urlBase !== URL_BASE_PERMITIDA) {
    return 'dist-staging';
  }
  return 'dist';
}

export function gerarSitemap(paginas, urlBase) {
  const urls = paginas
    .filter((pagina) => pagina.rota !== '/404.html')
    .sort((a, b) => (a.rota < b.rota ? -1 : a.rota > b.rota ? 1 : 0))
    .map(
      (pagina) =>
        `  <url>\n    <loc>${urlBase}${pagina.rota === '/' ? '/' : pagina.rota}</loc>\n    <lastmod>${pagina.lastmod}</lastmod>\n  </url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function gerarRobots(urlBase) {
  if (urlBase !== URL_BASE_PERMITIDA) {
    return `User-agent: *\nDisallow: /\n\nSitemap: ${urlBase}/sitemap.xml\n`;
  }
  return `User-agent: *\nAllow: /\n\nSitemap: ${urlBase}/sitemap.xml\n`;
}

async function copiarEstaticos(origem, destino) {
  if (!existsSync(origem)) {
    return;
  }
  const entradas = await readdir(origem, { withFileTypes: true });
  await mkdir(destino, { recursive: true });
  for (const entrada of entradas) {
    const de = path.join(origem, entrada.name);
    const para = path.join(destino, entrada.name);
    if (entrada.isDirectory()) {
      await copiarEstaticos(de, para);
    } else {
      await copyFile(de, para);
    }
  }
}

function compilarCss(raiz, destino) {
  const cli = path.join(raiz, 'node_modules', 'tailwindcss', 'lib', 'cli.js');
  if (!existsSync(cli)) {
    throw new Error('Tailwind CLI não encontrado. Rode `npm ci` antes do build.');
  }
  const resultado = spawnSync(
    process.execPath,
    [
      cli,
      '-c',
      'tailwind.config.js',
      '-i',
      path.join('src', 'css', 'estilo.css'),
      '-o',
      path.join(destino, 'assets', 'estilo.css'),
      '--minify'
    ],
    { cwd: raiz, encoding: 'utf8' }
  );
  if (resultado.status !== 0) {
    throw new Error(`Tailwind falhou: ${resultado.stderr || resultado.stdout}`);
  }
}

async function escreverSaida({ raiz, destino, paginas, urlBase }) {
  await rm(destino, { recursive: true, force: true });
  await mkdir(path.join(destino, 'assets'), { recursive: true });

  compilarCss(raiz, destino);
  await copyFile(path.join(raiz, 'src', 'js', 'app.js'), path.join(destino, 'assets', 'app.js'));
  await copiarEstaticos(path.join(raiz, 'src', 'estatico'), destino);

  for (const pagina of paginas) {
    const arquivo = caminhoDaRota(destino, pagina.rota);
    await mkdir(path.dirname(arquivo), { recursive: true });
    await writeFile(arquivo, pagina.html, 'utf8');
  }

  await writeFile(path.join(destino, 'sitemap.xml'), gerarSitemap(paginas, urlBase), 'utf8');
  await writeFile(path.join(destino, 'robots.txt'), gerarRobots(urlBase), 'utf8');
}

async function escreverRelatorio(raiz, dados, publicacao) {
  const { json, markdown } = gerarRelatorio({ dados, publicacao });
  const diretorio = path.join(raiz, 'relatorios');
  await mkdir(diretorio, { recursive: true });
  await writeFile(path.join(diretorio, 'pendencias.json'), `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  await writeFile(path.join(diretorio, 'pendencias.md'), markdown, 'utf8');
}

const EXTENSOES_TEXTO = ['.html', '.js', '.css', '.xml', '.txt', '.svg'];

async function lerMapaDaSaida(diretorio) {
  const arquivos = new Map();

  async function percorrer(origem, prefixo = '') {
    const entradas = await readdir(origem, { withFileTypes: true });
    for (const entrada of entradas) {
      const caminho = path.join(origem, entrada.name);
      const chave = prefixo ? `${prefixo}/${entrada.name}` : entrada.name;
      if (entrada.isDirectory()) {
        await percorrer(caminho, chave);
      } else if (EXTENSOES_TEXTO.includes(path.extname(entrada.name))) {
        arquivos.set(chave, await readFile(caminho, 'utf8'));
      }
    }
  }

  await percorrer(diretorio);
  return arquivos;
}

function assinatura(paginas) {
  return paginas.map((pagina) => `${pagina.rota}\u0000${pagina.html}`).join('\u0001');
}

export async function fotografiaDiretorio(diretorio) {
  if (!existsSync(diretorio)) {
    return null;
  }
  const arquivos = [];

  async function percorrer(origem, prefixo = '') {
    const entradas = await readdir(origem, { withFileTypes: true });
    for (const entrada of entradas) {
      const caminho = path.join(origem, entrada.name);
      const chave = prefixo ? `${prefixo}/${entrada.name}` : entrada.name;
      if (entrada.isDirectory()) {
        await percorrer(caminho, chave);
      } else {
        const hash = createHash('sha256').update(await readFile(caminho)).digest('hex');
        arquivos.push([chave, hash]);
      }
    }
  }

  await percorrer(diretorio);
  return JSON.stringify(arquivos.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

async function carregarSlugsTeste(raiz) {
  const caminho = path.join(raiz, 'dados-teste', 'unidades.exemplo.json');
  if (!existsSync(caminho)) {
    return [];
  }
  const teste = await carregarJson(caminho);
  return (teste.unidades ?? []).map((unidade) => unidade?.slug).filter(Boolean);
}

function criarNapEsperado(dados, publicacao) {
  const matriz = (dados.unidades?.unidades ?? []).find((unidade) => unidade?.matriz === true);
  const matrizConfirmada =
    matriz && matriz.validacao?.status === 'confirmado' ? matriz : null;
  return {
    matriz: matrizConfirmada
      ? {
          nome: matrizConfirmada.nomeExibicao,
          logradouro: matrizConfirmada.endereco?.logradouro ?? '',
          numero: matrizConfirmada.endereco?.numero ?? '',
          bairro: matrizConfirmada.endereco?.bairro ?? '',
          cep: matrizConfirmada.endereco?.cep ?? '',
          cidade: matrizConfirmada.cidade ?? '',
          uf: matrizConfirmada.uf ?? ''
        }
      : null,
    telefoneInstitucional: telefonePrincipal(matrizConfirmada)?.e164 ?? null
  };
}

function imprimirErros(erros, rotulo) {
  for (const erro of erros) {
    if (erro.codigo) {
      console.error(`${rotulo ? `${rotulo}: ` : ''}${erro.codigo} — ${erro.detalhe}`);
    } else {
      console.error(`${rotulo ? `${rotulo}: ` : ''}[${erro.regra}] ${erro.arquivo}: ${erro.detalhe}`);
    }
  }
}

export async function executarBuild({
  raiz = RAIZ,
  rascunho = false,
  check = false,
  goLive = false,
  baseUrl = null,
  silencioso = false
} = {}) {
  const log = silencioso ? () => {} : (...argumentos) => console.log(...argumentos);
  const avisos = [];
  const avisar = (mensagem) => {
    avisos.push(mensagem);
    log(`aviso: ${mensagem}`);
  };

  rascunho = goLive ? false : rascunho;
  check = check || goLive;

  const modo = goLive ? 'go-live' : rascunho ? 'rascunho' : 'producao';
  log(`Terradic — build (${modo})`);

  const dados = await carregarDados(raiz, { rascunho, avisar });
  const exemplos = await carregarExemplosBriefing(raiz);
  const errosDados = validarDados(dados, { exemplos, rascunho });
  const urlBase = baseUrl || dados.site.urlBase;
  const staging = urlBase !== URL_BASE_PERMITIDA;

  if (baseUrl && baseUrl !== URL_BASE_PERMITIDA) {
    avisar(`urlBase de preview usada apenas na saída: ${baseUrl}`);
  }
  if (dados.site.identidadeVisual?.status !== 'oficial') {
    avisar(
      'identidade visual provisoria (paleta aproximada de flyer + logo placeholder) — go-live depende de C-11'
    );
  }

  const publicacao = resolverPublicacao(dados, { rascunho });
  for (const aviso of publicacao.avisos) {
    avisar(aviso);
  }

  // O relatório é sempre sobre os dados reais (nunca sobre os dados de teste do rascunho).
  const dadosRelatorio = rascunho ? await carregarDados(raiz, { rascunho: false }) : dados;
  const publicacaoRelatorio = rascunho
    ? resolverPublicacao(dadosRelatorio, { rascunho: false })
    : publicacao;

  const errosGoLive = goLive
    ? validarGoLive({
        dados,
        publicacao,
        rotas: planejarRotas(dados, publicacao).map((pagina) => pagina.rota)
      })
    : [];

  if (errosDados.length > 0 || errosGoLive.length > 0) {
    const bloqueios = [...errosDados, ...errosGoLive];
    imprimirErros(bloqueios, goLive ? 'go-live' : null);
    console.error(`\n${bloqueios.length} bloqueio(s). Build interrompido.`);
    await escreverRelatorio(raiz, dadosRelatorio, publicacaoRelatorio);
    return { ok: false, erros: bloqueios, avisos, paginas: [] };
  }

  const templates = await carregarTemplates(path.join(raiz, 'src', 'templates'));
  const paginas = gerarPaginas({ dados, publicacao, templates, urlBase, rascunho });

  const distProducao = path.join(raiz, 'dist');
  const saida = path.join(raiz, diretorioDeSaida({ rascunho, urlBase }));
  const auditarDist = check && saida !== distProducao;
  const distAntes = auditarDist ? await fotografiaDiretorio(distProducao) : null;

  await escreverSaida({ raiz, destino: saida, paginas, urlBase });
  await escreverRelatorio(raiz, dadosRelatorio, publicacaoRelatorio);

  log(`Paginas geradas: ${paginas.length}`);
  for (const pagina of paginas) {
    log(`  ${pagina.rota}`);
  }
  log('Relatorio: relatorios/pendencias.md e relatorios/pendencias.json');

  if (!check) {
    return { ok: true, erros: [], avisos, paginas };
  }

  const errosCheck = [];
  const mapa = await lerMapaDaSaida(saida);
  const slugsTeste = await carregarSlugsTeste(raiz);

  errosCheck.push(
    ...executarChecagens({
      arquivos: mapa,
      urlBase,
      producao: !rascunho,
      staging,
      slugsTeste,
      napEsperado: criarNapEsperado(dados, publicacao)
    })
  );
  errosCheck.push(
    ...checarSitemap({
      arquivos: mapa,
      rotas: paginas.map((pagina) => pagina.rota),
      urlBase,
      staging
    })
  );

  // Auditoria da produção real, gerada em diretório temporário. Todas as regras
  // aplicáveis rodam sobre esse artefato — não sobre um mapa parcial em memória.
  const diretorioProducao = await mkdtemp(path.join(os.tmpdir(), 'terradic-producao-'));
  let paginasProducao = [];
  try {
    const errosProducao = validarDados(dadosRelatorio, { exemplos });
    for (const erro of errosProducao) {
      errosCheck.push(erro);
    }

    paginasProducao = gerarPaginas({
      dados: dadosRelatorio,
      publicacao: publicacaoRelatorio,
      templates,
      urlBase: URL_BASE_PERMITIDA,
      rascunho: false
    });
    await escreverSaida({
      raiz,
      destino: diretorioProducao,
      paginas: paginasProducao,
      urlBase: URL_BASE_PERMITIDA
    });

    const mapaProducao = await lerMapaDaSaida(diretorioProducao);
    errosCheck.push(
      ...executarChecagens({
        arquivos: mapaProducao,
        urlBase: URL_BASE_PERMITIDA,
        producao: true,
        slugsTeste,
        napEsperado: criarNapEsperado(dadosRelatorio, publicacaoRelatorio)
      })
    );
    errosCheck.push(
      ...checarSitemap({
        arquivos: mapaProducao,
        rotas: paginasProducao.map((pagina) => pagina.rota),
        urlBase: URL_BASE_PERMITIDA
      })
    );
  } finally {
    await rm(diretorioProducao, { recursive: true, force: true });
  }

  if (distAntes !== null) {
    const distDepois = await fotografiaDiretorio(distProducao);
    if (distAntes !== distDepois) {
      errosCheck.push({
        regra: 'artefato.distIntacto',
        arquivo: 'dist',
        detalhe: 'o --check de rascunho alterou o dist/ de produção'
      });
    }
    // O dist/ de produção existente também é auditado, sem ser reescrito.
    const mapaDist = await lerMapaDaSaida(distProducao);
    errosCheck.push(
      ...executarChecagens({
        arquivos: mapaDist,
        urlBase: URL_BASE_PERMITIDA,
        producao: true,
        staging: false,
        slugsTeste,
        napEsperado: criarNapEsperado(dadosRelatorio, publicacaoRelatorio)
      })
    );
    const rotasDist = [...mapaDist.keys()]
      .filter((nome) => nome.endsWith('.html'))
      .map((nome) => rotaDoArquivo(nome));
    errosCheck.push(
      ...checarSitemap({
        arquivos: mapaDist,
        rotas: rotasDist,
        urlBase: URL_BASE_PERMITIDA,
        staging: false
      })
    );
  }

  const segundaDraft = gerarPaginas({ dados, publicacao, templates, urlBase, rascunho });
  const segundaProducao = gerarPaginas({
    dados: dadosRelatorio,
    publicacao: publicacaoRelatorio,
    templates,
    urlBase: URL_BASE_PERMITIDA,
    rascunho: false
  });
  if (assinatura(paginas) !== assinatura(segundaDraft)) {
    errosCheck.push({
      regra: 'determinismo',
      arquivo: saida,
      detalhe: 'duas renderizações de rascunho produziram HTML diferente'
    });
  }
  if (assinatura(paginasProducao) !== assinatura(segundaProducao)) {
    errosCheck.push({
      regra: 'determinismo',
      arquivo: 'producao',
      detalhe: 'duas renderizações de produção produziram HTML diferente'
    });
  }

  if (errosCheck.length > 0) {
    imprimirErros(errosCheck);
    console.error(`\n${errosCheck.length} falha(s) de verificacao.`);
    return { ok: false, erros: errosCheck, avisos, paginas };
  }

  log('Verificacoes (--check): OK');
  return { ok: true, erros: [], avisos, paginas };
}

const executadoDiretamente =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (executadoDiretamente) {
  const opcoes = lerOpcoes(process.argv.slice(2));
  executarBuild(opcoes)
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
