import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  carregarDados,
  carregarExemplosBriefing,
  resolverPublicacao,
  validarDados
} from './lib/dados.mjs';
import { gerarRelatorio } from './lib/relatorio.mjs';
import { ErroCsv, lerCsv, serializarCsv } from './lib/csv.mjs';
import {
  ARQUIVOS_COLETA,
  COLUNAS,
  MAPA_DEPENDENCIAS,
  MODELO_VERSAO,
  TIPO_REGISTRO,
  escaparMarkdown,
  formatarDataBr,
  importarColeta,
  montarModeloColeta
} from './lib/coleta.mjs';
import { renderizarQuestionario } from './lib/coleta-html.mjs';
import { executarColeta } from './coleta.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DADOS_REAIS = await carregarDados(RAIZ);
const EXEMPLOS_REAIS = await carregarExemplosBriefing(RAIZ);
const PUBLICACAO_REAL = resolverPublicacao(DADOS_REAIS);
const RELATORIO_REAL = gerarRelatorio({ dados: DADOS_REAIS, publicacao: PUBLICACAO_REAL }).json;
const BASE = DADOS_REAIS.site.atualizadoEm;
const UNIDADE = DADOS_REAIS.unidades.unidades.find((unidade) => unidade.slug === 'caninde');
const PREPARO = DADOS_REAIS.preparos.preparos[0];
const BLOCO = RELATORIO_REAL.blocosPendentes.find((bloco) => {
  const config = DADOS_REAIS.paginas.paginas[bloco.pagina]?.blocos?.[bloco.indice];
  return config && config.tipo !== 'lista';
});
const BLOCO_CONFIG = DADOS_REAIS.paginas.paginas[BLOCO.pagina].blocos[BLOCO.indice];
const BLOCO_LOCALIZADOR = BLOCO.id ?? `#${BLOCO.indice}`;
const TELEFONE = '+5585991234567';

function somarDiasISO(iso, dias) {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

const DATA_CONFIRMACAO = somarDiasISO(BASE, 5);
const CONFIRMACAO = {
  confirmacao: 'confirmo',
  confirmado_por: 'Maria Gestora',
  como_confirmou: 'email',
  fonte: 'Email de 20/11/2026',
  data_confirmacao: formatarDataBr(DATA_CONFIRMACAO)
};
const ARQUIVO_POR_CHAVE = Object.fromEntries(ARQUIVOS_COLETA.map((item) => [item.chave, item.arquivo]));

const raizesTemporarias = [];
let hashDadosReaisAntes = null;

async function criarRaiz() {
  const raiz = await mkdtemp(path.join(os.tmpdir(), 'coleta-testes-'));
  raizesTemporarias.push(raiz);
  await cp(path.join(RAIZ, 'dados'), path.join(raiz, 'dados'), { recursive: true });
  return raiz;
}

function pastaKit(raiz) {
  return path.join(raiz, 'relatorios', 'coleta');
}

async function hashArquivos(arquivos) {
  const linhas = [];
  for (const arquivo of arquivos) {
    linhas.push(`${arquivo} ${createHash('sha256').update(await readFile(arquivo)).digest('hex')}`);
  }
  return linhas.join('\n');
}

async function hashDadosReais() {
  const arquivos = await readdir(path.join(RAIZ, 'dados'));
  return hashArquivos(arquivos.sort().map((arquivo) => path.join(RAIZ, 'dados', arquivo)));
}

async function hashDadosTemp(raiz) {
  const arquivos = ['site.json', 'unidades.json', 'servicos.json', 'convenios.json', 'preparos.json', 'paginas.json'];
  return hashArquivos(arquivos.map((arquivo) => path.join(raiz, 'dados', arquivo)));
}

function criarLinha(chave, valores) {
  const linha = new Array(COLUNAS[chave].length).fill('');
  for (const [coluna, valor] of Object.entries({ modelo_versao: MODELO_VERSAO, base_dados_em: BASE, tipo_registro: TIPO_REGISTRO[chave] })) {
    linha[COLUNAS[chave].indexOf(coluna)] = valor;
  }
  for (const [coluna, valor] of Object.entries(valores)) {
    const indice = COLUNAS[chave].indexOf(coluna);
    assert.notEqual(indice, -1, `coluna inexistente no modelo: ${coluna}`);
    linha[indice] = valor;
  }
  return linha;
}

function linhaUnidade(valores = {}) {
  return criarLinha('unidades', {
    slug: UNIDADE.slug,
    id: UNIDADE.id,
    nome_exibicao: 'Terradic Caninde',
    cidade: UNIDADE.cidade,
    uf: UNIDADE.uf,
    cnpj_filial: UNIDADE.cnpjFilial,
    matriz: UNIDADE.matriz === true ? 'sim' : 'nao',
    endereco_logradouro: 'Rua das Flores',
    endereco_numero: '123',
    endereco_bairro: 'Centro',
    endereco_cep: '60123456',
    telefone_1_rotulo: 'Recepcao',
    telefone_1_e164: TELEFONE,
    telefone_1_tipo: 'fixo',
    telefone_1_principal: 'sim',
    whatsapp_e164: TELEFONE,
    email: 'caninde@example.invalid',
    horarios: 'seg,ter,qua,qui,sex:08:00-18:00',
    servicos: PREPARO.servicoId,
    atendimento_particular: 'sim',
    comodidades_estacionamento: 'nao',
    comodidades_acessivel: 'sim',
    ...CONFIRMACAO,
    ...valores
  });
}

function linhaSite(valores = {}) {
  return criarLinha('site', {
    rt_nome: 'Dr. Joao Silva',
    rt_crm: '12345',
    rt_crm_uf: 'CE',
    rt_especialidade: 'Radiologia',
    email_institucional: 'contato@example.invalid',
    telefone_institucional_e164: TELEFONE,
    instagram: 'perfil-teste',
    ...CONFIRMACAO,
    ...valores
  });
}

function linhaConvenio(valores = {}) {
  return criarLinha('convenios', {
    id: 'saude-teste',
    nome: 'Saude Teste',
    tipo_convenio: 'medicina-de-grupo',
    exibir_logo: 'nao',
    logo_autorizado: 'nao',
    aviso: 'Cobertura sujeita a confirmacao.',
    vigencia_inicio: '01/01/2026',
    vigencia_fim: '31/12/2026',
    unidades: UNIDADE.slug,
    ...CONFIRMACAO,
    ...valores
  });
}

function linhaPreparo(valores = {}) {
  return criarLinha('preparos', {
    id: PREPARO.id,
    slug: PREPARO.slug,
    exame: PREPARO.exame,
    servico_id: PREPARO.servicoId,
    resumo: 'Orientacao de preparo revisada.',
    jejum: 'Nao exige jejum.',
    documentos: 'pedido medico',
    duracao: '10 minutos',
    registro_profissional: '12345/CE',
    ...CONFIRMACAO,
    ...valores
  });
}

function linhaTexto(valores = {}) {
  return criarLinha('textos', {
    pagina: BLOCO.pagina,
    bloco: BLOCO_LOCALIZADOR,
    tipo_bloco: BLOCO_CONFIG.tipo,
    texto: 'Sobre a Terradic e a rede',
    ...CONFIRMACAO,
    ...valores
  });
}

async function escreverCsv(pasta, chave, linhas) {
  await writeFile(
    path.join(pasta, ARQUIVO_POR_CHAVE[chave]),
    serializarCsv({ cabecalho: COLUNAS[chave], linhas }),
    'utf8'
  );
}

async function criarKit(raiz, mutar = null) {
  const kit = {
    unidades: [linhaUnidade()],
    site: [linhaSite()],
    convenios: [linhaConvenio()],
    preparos: [linhaPreparo()],
    textos: [linhaTexto()]
  };
  if (mutar) {
    mutar(kit);
  }
  const pasta = pastaKit(raiz);
  await mkdir(pasta, { recursive: true });
  for (const item of ARQUIVOS_COLETA) {
    await escreverCsv(pasta, item.chave, kit[item.chave] ?? []);
  }
  return { kit, pasta };
}

async function importar(raiz, opcoes = {}) {
  return importarColeta({ raiz, pasta: 'relatorios/coleta', ...opcoes });
}

function definirDataConfirmacao(kit, dataBr) {
  for (const [chave, linhas] of Object.entries(kit)) {
    const cabecalho = COLUNAS[chave];
    for (const linha of linhas) {
      for (const [campo, valor] of Object.entries({ ...CONFIRMACAO, data_confirmacao: dataBr })) {
        linha[cabecalho.indexOf(campo)] = valor;
      }
    }
  }
}

async function lerCsvDaPasta(raiz, chave) {
  return lerCsv(await readFile(path.join(pastaKit(raiz), ARQUIVO_POR_CHAVE[chave]), 'utf8'));
}

async function gravarCsvDaPasta(raiz, chave, csv) {
  await writeFile(
    path.join(pastaKit(raiz), ARQUIVO_POR_CHAVE[chave]),
    serializarCsv({ cabecalho: csv.cabecalho, linhas: csv.linhas }),
    'utf8'
  );
}

async function atualizarDados(raiz, nome, mutar) {
  const caminho = path.join(raiz, 'dados', nome);
  const dados = JSON.parse(await readFile(caminho, 'utf8'));
  mutar(dados);
  await writeFile(caminho, `${JSON.stringify(dados, null, 2)}\n`, 'utf8');
}

function codigos(resultado) {
  return resultado.erros.map((erro) => erro.codigo);
}

function problemasExternos(html) {
  const problemas = new Set();
  const elementosExternos = new Set([
    'script',
    'link',
    'img',
    'iframe',
    'object',
    'embed',
    'video',
    'audio',
    'form',
    'input'
  ]);
  for (const tag of html.match(/<[a-zA-Z](?:[^>"']|"[^"]*"|'[^']*')*>/g) ?? []) {
    const nome = /^<([a-zA-Z0-9-]+)/.exec(tag)?.[1]?.toLowerCase();
    if (elementosExternos.has(nome)) {
      problemas.add(`<${nome}>`);
    }
    if (/\b(?:src|href)\s*=/i.test(tag)) {
      problemas.add('src/href');
    }
    if (/\bstyle\s*=\s*["'][^"']*url\s*\(/i.test(tag)) {
      problemas.add('url(');
    }
  }
  for (const estilo of html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? []) {
    if (/@import/i.test(estilo)) {
      problemas.add('@import');
    }
    if (/url\s*\(/i.test(estilo)) {
      problemas.add('url(');
    }
  }
  return [...problemas];
}

before(async () => {
  hashDadosReaisAntes = await hashDadosReais();
});

after(async () => {
  try {
    assert.equal(await hashDadosReais(), hashDadosReaisAntes, 'dados/ real foi alterado pela suite');
  } finally {
    for (const raiz of raizesTemporarias) {
      await rm(raiz, { recursive: true, force: true });
    }
  }
});

test('CSV: round-trip preserva acentos, aspas, ponto e virgula e multilinha', () => {
  const csv = serializarCsv({
    cabecalho: ['a', 'b', 'c'],
    linhas: [
      ['saude;clinica', 'aspas "x"', 'linha 1\r\nlinha 2'],
      ['ação', '', '']
    ]
  });
  assert.deepEqual(lerCsv(csv), {
    cabecalho: ['a', 'b', 'c'],
    linhas: [
      ['saude;clinica', 'aspas "x"', 'linha 1\r\nlinha 2'],
      ['ação', '', '']
    ],
    numeros: [2, 4]
  });
});

test('CSV: aspas nao fechadas falham com a linha', () => {
  assert.throws(
    () => lerCsv('a;b\r\n"x;y'),
    (erro) => erro instanceof ErroCsv && erro.linha === 2 && /aspas nao fechadas/.test(erro.message)
  );
});

test('CSV: numero de colunas inconsistente falha com a linha', () => {
  assert.throws(
    () => lerCsv('a;b\r\n1;2;3'),
    (erro) => erro instanceof ErroCsv && erro.linha === 2 && /coluna/.test(erro.message)
  );
});

test('CSV: arquivo vazio falha como cabecalho ausente', () => {
  assert.throws(() => lerCsv(''), (erro) => erro instanceof ErroCsv && /planilha vazia/.test(erro.message));
});

test('T026: kit gerado tem bytes, A4 e contrato de impressao verificaveis por script', async () => {
  const raiz = await criarRaiz();
  const resultado = await executarColeta({ raiz, silencioso: true });
  assert.equal(resultado.ok, true);
  const pasta = pastaKit(raiz);
  const nomes = (await readdir(pasta)).sort();
  assert.deepEqual(nomes, [
    'LEIA-ME.txt',
    'convenios.csv',
    'preparos.csv',
    'questionario.html',
    'site.csv',
    'textos.csv',
    'unidades.csv'
  ]);

  for (const item of ARQUIVOS_COLETA) {
    const buffer = await readFile(path.join(pasta, item.arquivo));
    assert.deepEqual([...buffer.subarray(0, 3)], [0xef, 0xbb, 0xbf], `${item.arquivo}: BOM`);
    const texto = buffer.toString('utf8');
    assert.ok(texto.includes(';'), `${item.arquivo}: separador ;`);
    assert.equal((texto.match(/\r\n/g) ?? []).length, (texto.match(/\n/g) ?? []).length, `${item.arquivo}: CRLF`);
    const lido = lerCsv(texto);
    assert.deepEqual(lido.cabecalho, COLUNAS[item.chave], `${item.arquivo}: cabecalho`);
    for (const linha of lido.linhas) {
      assert.equal(linha[0], MODELO_VERSAO);
      assert.equal(linha[1], BASE);
      assert.equal(linha[2], TIPO_REGISTRO[item.chave]);
    }
  }

  const leiaMe = await readFile(path.join(pasta, 'LEIA-ME.txt'));
  assert.deepEqual([...leiaMe.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  const leiaMeTexto = leiaMe.toString('utf8');
  for (const termo of ['A CONFIRMAR: ', 'NAO_TEMOS', 'NAO_SABEMOS', 'LGPD', 'entrada de terceiro']) {
    assert.ok(leiaMeTexto.includes(termo), `LEIA-ME deve conter ${termo}`);
  }

  const html = await readFile(path.join(pasta, 'questionario.html'), 'utf8');
  assert.match(html, /@page\s*\{\s*size:\s*A4;\s*margin:\s*18mm;\s*\}/);
  assert.match(html, /table\s*\{[^}]*width:\s*100%/);
  assert.ok(html.includes('overflow-wrap: anywhere'));
  assert.ok(html.includes('page-break-before: always'));
  assert.ok(!html.includes('white-space: nowrap'));
  assert.deepEqual(problemasExternos(html), [], 'questionario.html nao pode conter requisicao externa');
  for (let numero = 1; numero <= 15; numero += 1) {
    assert.ok(html.includes(`C-${String(numero).padStart(2, '0')}`), `C-${numero}`);
  }
});

test('questionario aceita URL em texto e detecta injecao de src/href', () => {
  const dados = structuredClone(DADOS_REAIS);
  const unidade = dados.unidades.unidades.find((item) => item.slug === UNIDADE.slug);
  unidade.redesSociais = { instagram: 'https://instagram.com/terradic', facebook: null };
  unidade.observacoesPublicas = 'Site https://terradic.com.br e contato@dominio';
  const publicacao = resolverPublicacao(dados);
  const relatorio = gerarRelatorio({ dados, publicacao }).json;
  const html = renderizarQuestionario(montarModeloColeta({ dados, exemplos: EXEMPLOS_REAIS, relatorio }));
  assert.deepEqual(problemasExternos(html), []);
  assert.ok(html.includes('https://instagram.com/terradic'));
  assert.deepEqual(problemasExternos(`<p>texto legítimo: href=manual e src=manual</p>`), []);
  assert.ok(problemasExternos(`${html}<img src="http://example.test/x.png">`).includes('<img>'));
  assert.ok(problemasExternos(`${html}<link rel="stylesheet" href="http://example.test/a.css">`).includes('<link>'));
  assert.ok(problemasExternos(`${html}<script src="http://example.test/x.js"></script>`).includes('<script>'));
  assert.ok(
    problemasExternos(`${html}<style>@import url(http://example.test/a.css);</style>`).includes('@import')
  );
  assert.ok(problemasExternos(`${html}<a href="http://example.test/">x</a>`).includes('src/href'));
  assert.ok(
    problemasExternos(`${html}<a title="x>y" href="http://example.test/">z</a>`).includes('src/href')
  );
});

test('paridade: toda secao de MAPA_DEPENDENCIAS existe no questionario renderizado', async () => {
  const modelo = montarModeloColeta({
    dados: DADOS_REAIS,
    exemplos: EXEMPLOS_REAIS,
    relatorio: RELATORIO_REAL
  });
  const html = renderizarQuestionario(modelo);
  for (const [id, mapa] of Object.entries(MAPA_DEPENDENCIAS)) {
    for (const secao of mapa.secoes ?? []) {
      if (secao === 'unidade') {
        assert.ok(html.includes('id="unidade-'), `${id}: secao unidade precisa de uma secao por unidade`);
      } else {
        assert.ok(html.includes(`id="${secao}"`), `${id}: secao ${secao} ausente no HTML`);
      }
    }
  }
  assert.ok(html.includes('A CONFIRMAR:'), 'questionario deve mostrar o anexo/sentinela');
});

test('AC-05: dependencia pendente sem mapeamento derruba a geracao', () => {
  const relatorio = structuredClone(RELATORIO_REAL);
  relatorio.bloqueios.push({
    id: 'C-16',
    item: 'Dependencia nova sem mapeamento',
    responsavel: 'Teste',
    pendente: true,
    bloqueia: true
  });
  assert.throws(
    () => montarModeloColeta({ dados: DADOS_REAIS, exemplos: EXEMPLOS_REAIS, relatorio }),
    /coleta:mapeamento:C-16/
  );
});

test('T023: fixture completo importa, valida e nao promove status', async () => {
  const raiz = await criarRaiz();
  await criarKit(raiz);
  const resultado = await importar(raiz);
  assert.equal(resultado.ok, true, codigos(resultado).join(', '));

  const site = JSON.parse(await readFile(path.join(raiz, 'dados/site.json'), 'utf8'));
  const unidades = JSON.parse(await readFile(path.join(raiz, 'dados/unidades.json'), 'utf8'));
  const convenios = JSON.parse(await readFile(path.join(raiz, 'dados/convenios.json'), 'utf8'));
  const preparos = JSON.parse(await readFile(path.join(raiz, 'dados/preparos.json'), 'utf8'));
  const paginas = JSON.parse(await readFile(path.join(raiz, 'dados/paginas.json'), 'utf8'));
  const unidade = unidades.unidades.find((item) => item.slug === UNIDADE.slug);

  assert.equal(unidade.status, 'a-confirmar');
  assert.equal(unidade.validacao.status, 'pendente');
  assert.equal(unidade.validacao.confirmadoPor, 'Maria Gestora');
  assert.equal(unidade.telefones[0].validado, true);
  assert.equal(site.responsavelTecnico.status, 'pendente');
  assert.equal(convenios.convenios[0].id, 'saude-teste');
  assert.equal(preparos.preparos.find((item) => item.id === PREPARO.id).revisao.status, 'pendente');
  const bloco = paginas.paginas[BLOCO.pagina].blocos[BLOCO.indice];
  assert.equal(bloco.status, 'pendente');
  assert.equal(bloco.texto, 'Sobre a Terradic e a rede');

  const candidato = {
    site,
    unidades,
    servicos: JSON.parse(await readFile(path.join(raiz, 'dados/servicos.json'), 'utf8')),
    convenios,
    preparos,
    paginas
  };
  assert.deepEqual(validarDados(candidato, { exemplos: EXEMPLOS_REAIS }), []);
  assert.ok(Array.isArray(resultado.log.json.confirmacoes) && resultado.log.json.confirmacoes.length > 0);
  const derivadaUnidade = resultado.log.json.linhasImportadas.find((linha) => linha.tipo === 'unidade');
  assert.equal(derivadaUnidade.derivados.status, 'a-confirmar');
  assert.equal(derivadaUnidade.derivados['validacao.status'], 'pendente');
  assert.equal(derivadaUnidade.derivados.atualizadoEm, DATA_CONFIRMACAO);
  const derivadaConvenio = resultado.log.json.linhasImportadas.find((linha) => linha.tipo === 'convenio');
  assert.match(derivadaConvenio.derivados.aviso, /Vigência informada/);
  assert.equal(derivadaConvenio.derivados['convenios.atualizadoEm'], DATA_CONFIRMACAO);
  const derivadaPreparo = resultado.log.json.linhasImportadas.find((linha) => linha.tipo === 'preparo');
  assert.equal(derivadaPreparo.derivados['revisao.status'], 'pendente');
  const derivadaTexto = resultado.log.json.linhasImportadas.find((linha) => linha.tipo === 'texto');
  assert.equal(derivadaTexto.derivados.status, 'pendente');
});

test('T021: reimportar o mesmo kit mantem bytes dos JSON e do log', async () => {
  const raiz = await criarRaiz();
  await criarKit(raiz);
  const primeira = await importar(raiz);
  assert.equal(primeira.ok, true);
  const hashJson1 = await hashDadosTemp(raiz);
  const hashLog1 = await readFile(path.join(pastaKit(raiz), 'importacao.json'));
  const hashMd1 = await readFile(path.join(pastaKit(raiz), 'importacao.md'));
  const segunda = await importar(raiz);
  assert.equal(segunda.ok, true);
  assert.equal(await hashDadosTemp(raiz), hashJson1);
  assert.deepEqual(await readFile(path.join(pastaKit(raiz), 'importacao.json')), hashLog1);
  assert.deepEqual(await readFile(path.join(pastaKit(raiz), 'importacao.md')), hashMd1);
  assert.deepEqual(segunda.arquivosGravados, []);
});

test('idempotencia com confirmacao posterior a base mantem site.atualizadoEm e o log', async () => {
  const raiz = await criarRaiz();
  await criarKit(raiz);
  const primeira = await importar(raiz);
  assert.equal(primeira.ok, true);
  const site1 = JSON.parse(await readFile(path.join(raiz, 'dados/site.json'), 'utf8')).atualizadoEm;
  const unidades1 = JSON.parse(await readFile(path.join(raiz, 'dados/unidades.json'), 'utf8')).unidades.find(
    (item) => item.slug === UNIDADE.slug
  );
  assert.equal(site1, BASE);
  assert.equal(unidades1.atualizadoEm, DATA_CONFIRMACAO);
  assert.ok(DATA_CONFIRMACAO > BASE);
  const hashJson = await hashDadosTemp(raiz);
  const hashLog = await readFile(path.join(pastaKit(raiz), 'importacao.json'));
  const segunda = await importar(raiz);
  assert.equal(segunda.ok, true);
  assert.equal(await hashDadosTemp(raiz), hashJson);
  assert.deepEqual(await readFile(path.join(pastaKit(raiz), 'importacao.json')), hashLog);
  assert.equal(
    JSON.parse(await readFile(path.join(raiz, 'dados/site.json'), 'utf8')).atualizadoEm,
    BASE
  );
  assert.equal(segunda.log.json.baseDadosEmAtual, BASE);
});

test('A -> B -> A nao regride datas por entidade e e deterministico', async () => {
  const dataA = formatarDataBr(somarDiasISO(BASE, 1));
  const dataB = formatarDataBr(somarDiasISO(BASE, 6));
  const isoB = somarDiasISO(BASE, 6);
  const raiz = await criarRaiz();
  await criarKit(raiz, (kit) => definirDataConfirmacao(kit, dataA));
  assert.equal((await importar(raiz)).ok, true);
  await criarKit(raiz, (kit) => definirDataConfirmacao(kit, dataB));
  assert.equal((await importar(raiz)).ok, true);

  await criarKit(raiz, (kit) => definirDataConfirmacao(kit, dataA));
  assert.equal((await importar(raiz)).ok, true);
  const unidades = JSON.parse(await readFile(path.join(raiz, 'dados/unidades.json'), 'utf8'));
  const unidade = unidades.unidades.find((item) => item.slug === UNIDADE.slug);
  assert.equal(unidade.validacao.data, isoB);
  assert.equal(unidade.atualizadoEm, isoB);
  assert.equal(unidades.atualizadoEm, isoB);
  const preparos = JSON.parse(await readFile(path.join(raiz, 'dados/preparos.json'), 'utf8'));
  const preparo = preparos.preparos.find((item) => item.id === PREPARO.id);
  assert.equal(preparo.revisao.data, isoB);
  assert.equal(preparo.atualizadoEm, isoB);
  assert.equal(preparos.atualizadoEm, isoB);
  const convenios = JSON.parse(await readFile(path.join(raiz, 'dados/convenios.json'), 'utf8'));
  assert.equal(convenios.atualizadoEm, isoB);
  const paginas = JSON.parse(await readFile(path.join(raiz, 'dados/paginas.json'), 'utf8'));
  assert.equal(paginas.atualizadoEm, isoB);
  assert.equal(JSON.parse(await readFile(path.join(raiz, 'dados/site.json'), 'utf8')).atualizadoEm, BASE);

  const hashes = await hashDadosTemp(raiz);
  const log = await readFile(path.join(pastaKit(raiz), 'importacao.json'));
  await criarKit(raiz, (kit) => definirDataConfirmacao(kit, dataA));
  assert.equal((await importar(raiz)).ok, true);
  assert.equal(await hashDadosTemp(raiz), hashes);
  assert.deepEqual(await readFile(path.join(pastaKit(raiz), 'importacao.json')), log);
});

test('kit com erro lista tudo e nao grava dados; log usa linhasProcessadas', async () => {
  const raiz = await criarRaiz();
  await criarKit(raiz, (kit) => {
    kit.unidades[0] = linhaUnidade({ endereco_cep: '1234' });
    kit.unidades.push(
      criarLinha('unidades', {
        slug: 'taua',
        id: 'taua',
        nome_exibicao: 'Terradic Taua',
        cidade: 'Taua',
        uf: 'CE',
        telefone_1_e164: '(85) 3333-4444',
        telefone_1_tipo: 'fixo',
        ...CONFIRMACAO
      })
    );
    kit.unidades.push(
      criarLinha('unidades', {
        slug: 'pacajus',
        id: 'pacajus',
        nome_exibicao: 'Terradic Pacajus',
        cidade: 'Pacajus',
        uf: 'CE',
        confirmacao: 'confirmo',
        confirmado_por: ''
      })
    );
  });
  const antes = await hashDadosTemp(raiz);
  const resultado = await importar(raiz);
  const lista = codigos(resultado);
  assert.equal(resultado.ok, false);
  assert.ok(lista.includes('unidades.csv:endereco_cep:caninde'));
  assert.ok(lista.includes('unidades.csv:telefone_1_e164:taua'));
  assert.ok(lista.includes('unidades.csv:confirmado_por:pacajus'));
  assert.equal(await hashDadosTemp(raiz), antes);
  assert.equal(resultado.log.json.nadaFoiGravado, true);
  assert.equal(resultado.log.json.linhasImportadas.length, 0);
  assert.ok(resultado.log.json.linhasProcessadas.length > 0);
  assert.match(await readFile(path.join(pastaKit(raiz), 'importacao.md'), 'utf8'), /nada foi gravado/);
});

test('telefone identico ao levantamento e recusado com instrucao de remocao', async () => {
  const raiz = await criarRaiz();
  await criarKit(raiz, (kit) => {
    kit.unidades[0] = linhaUnidade({ telefone_1_e164: '+558533433739', whatsapp_e164: '+5585991234567' });
  });
  const resultado = await importar(raiz);
  assert.equal(resultado.ok, false);
  assert.ok(codigos(resultado).some((codigo) => codigo.includes('telefones[0].e164')));
  assert.ok(resultado.erros.some((erro) => erro.detalhe.includes('Remova manualmente o exemplo')));
});

test('ausencia de cada campo do bloco de confirmacao falha', async () => {
  const raiz = await criarRaiz();
  const simples = (slug, valores) =>
    criarLinha('unidades', {
      slug,
      id: slug,
      nome_exibicao: `Terradic ${slug}`,
      cidade: slug,
      uf: 'CE',
      matriz: 'nao',
      ...CONFIRMACAO,
      ...valores
    });
  await criarKit(raiz, (kit) => {
    kit.unidades = [
      linhaUnidade({ confirmado_por: '' }),
      simples('taua', { como_confirmou: '' }),
      simples('pacajus', { fonte: '' }),
      simples('crateus', { data_confirmacao: '' })
    ];
  });
  const resultado = await importar(raiz);
  const lista = codigos(resultado);
  assert.ok(lista.includes(`unidades.csv:confirmado_por:${UNIDADE.slug}`));
  assert.ok(lista.includes('unidades.csv:como_confirmou:taua'));
  assert.ok(lista.includes('unidades.csv:fonte:pacajus'));
  assert.ok(lista.includes('unidades.csv:data_confirmacao:crateus'));
});

test('cabecalho desconhecido, duplicado e ausente; status nao e importavel', async () => {
  const casos = [
    ['desconhecida', (csv) => {
      csv.cabecalho.push('foo');
      csv.linhas.forEach((linha) => linha.push('x'));
    }],
    ['duplicada', (csv) => {
      csv.cabecalho.push('slug');
      csv.linhas.forEach((linha) => linha.push('x'));
    }],
    ['ausente', (csv) => {
      const indice = csv.cabecalho.indexOf('email');
      csv.cabecalho.splice(indice, 1);
      csv.linhas.forEach((linha) => linha.splice(indice, 1));
    }],
    ['status', (csv) => {
      csv.cabecalho.push('status');
      csv.linhas.forEach((linha) => linha.push('ativo'));
    }],
    ['validacao_status', (csv) => {
      csv.cabecalho.push('validacao_status');
      csv.linhas.forEach((linha) => linha.push('confirmado'));
    }],
    ['aprovado', (csv) => {
      csv.cabecalho.push('aprovado');
      csv.linhas.forEach((linha) => linha.push('sim'));
    }]
  ];
  for (const [rotulo, mutacao] of casos) {
    const raiz = await criarRaiz();
    await criarKit(raiz);
    const csv = await lerCsvDaPasta(raiz, 'unidades');
    mutacao(csv);
    await gravarCsvDaPasta(raiz, 'unidades', csv);
    const resultado = await importar(raiz);
    assert.equal(resultado.ok, false, rotulo);
    assert.ok(codigos(resultado).includes('unidades.csv:colunas:unidades'), rotulo);
  }
});

test('modelo_versao desconhecida e tipo_registro errado falham', async () => {
  const raiz = await criarRaiz();
  await criarKit(raiz);
  const versao = await lerCsvDaPasta(raiz, 'unidades');
  versao.linhas.forEach((linha) => (linha[0] = 'coleta-0'));
  await gravarCsvDaPasta(raiz, 'unidades', versao);
  const erroVersao = await importar(raiz);
  assert.ok(codigos(erroVersao).includes('unidades.csv:modelo_versao:unidades'));

  const raiz2 = await criarRaiz();
  await criarKit(raiz2);
  const tipo = await lerCsvDaPasta(raiz2, 'site');
  tipo.linhas.forEach((linha) => (linha[2] = 'unidade'));
  await gravarCsvDaPasta(raiz2, 'site', tipo);
  const erroTipo = await importar(raiz2);
  assert.ok(codigos(erroTipo).includes('site.csv:tipo_registro:site'));
});

test('UTF-16 e separador virgula sao recusados', async () => {
  const raiz = await criarRaiz();
  await criarKit(raiz);
  const caminho = path.join(pastaKit(raiz), 'unidades.csv');
  const texto = await readFile(caminho, 'utf8');
  await writeFile(caminho, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(texto, 'utf16le')]));
  const utf16 = await importar(raiz);
  assert.ok(codigos(utf16).includes('unidades.csv:csv:encoding'));

  const raiz2 = await criarRaiz();
  await criarKit(raiz2);
  await writeFile(path.join(pastaKit(raiz2), 'unidades.csv'), texto.replace(/;/g, ','), 'utf8');
  const virgula = await importar(raiz2);
  assert.ok(codigos(virgula).includes('unidades.csv:csv:separador'));
});

test('data invalida falha na confirmacao', async () => {
  const raiz = await criarRaiz();
  await criarKit(raiz, (kit) => {
    kit.unidades[0] = linhaUnidade({ data_confirmacao: '31/02/2026' });
  });
  const resultado = await importar(raiz);
  assert.ok(codigos(resultado).includes(`unidades.csv:data_confirmacao:${UNIDADE.slug}`));
});

test('coordenada incompleta e formulas =, @, + e - sao recusadas', async () => {
  const raiz = await criarRaiz();
  await criarKit(raiz, (kit) => {
    kit.unidades[0] = linhaUnidade({
      geo_lat: '-3,7319',
      geo_lng: '',
      nome_exibicao: '=formula',
      cidade: '@formula',
      uf: '+formula',
      endereco_logradouro: '-formula'
    });
  });
  const resultado = await importar(raiz);
  const lista = codigos(resultado);
  assert.ok(lista.includes(`unidades.csv:geo:${UNIDADE.slug}`));
  assert.ok(lista.includes(`unidades.csv:nome_exibicao:${UNIDADE.slug}`));
  assert.ok(lista.includes(`unidades.csv:cidade:${UNIDADE.slug}`));
  assert.ok(lista.includes(`unidades.csv:uf:${UNIDADE.slug}`));
  assert.ok(lista.includes(`unidades.csv:endereco_logradouro:${UNIDADE.slug}`));
});

test('duplicidade de unidade, preparo e texto falha por arquivo', async () => {
  const raiz = await criarRaiz();
  await criarKit(raiz, (kit) => {
    kit.unidades.push([...kit.unidades[0]]);
    kit.preparos.push([...kit.preparos[0]]);
    kit.textos.push([...kit.textos[0]]);
  });
  const resultado = await importar(raiz);
  const lista = codigos(resultado);
  assert.ok(lista.includes(`unidades.csv:slug:${UNIDADE.slug}`));
  assert.ok(lista.includes(`preparos.csv:id:${PREPARO.id}`));
  assert.ok(lista.includes(`textos.csv:bloco:${BLOCO.pagina}/${BLOCO_LOCALIZADOR}`));
});

test('campo imutavel nao muda, nem com --sobrescrever', async () => {
  const raiz = await criarRaiz();
  await criarKit(raiz, (kit) => {
    kit.unidades[0] = linhaUnidade({ id: 'outro-id' });
    kit.preparos[0] = linhaPreparo({ servico_id: 'servico-inexistente' });
  });
  const resultado = await importar(raiz, { sobrescrever: true });
  const lista = codigos(resultado);
  assert.ok(lista.includes(`unidades.csv:id:${UNIDADE.slug}`));
  assert.ok(lista.includes(`preparos.csv:servico_id:${PREPARO.id}`));
});

test('slug e matriz sao campos imutaveis', async () => {
  const raizSlug = await criarRaiz();
  await criarKit(raizSlug, (kit) => {
    kit.unidades[0] = linhaUnidade({ slug: 'caninde-renomeada' });
  });
  const resultadoSlug = await importar(raizSlug);
  const erroSlug = resultadoSlug.erros.find(
    (erro) => erro.codigo === 'unidades.csv:slug:caninde-renomeada'
  );
  assert.ok(erroSlug);
  assert.match(erroSlug.detalhe, /campo imutavel: slug nao pode mudar/);

  const raizMatriz = await criarRaiz();
  await criarKit(raizMatriz, (kit) => {
    kit.unidades[0] = linhaUnidade({ matriz: UNIDADE.matriz === true ? 'nao' : 'sim' });
  });
  const resultadoMatriz = await importar(raizMatriz);
  const erroMatriz = resultadoMatriz.erros.find(
    (erro) => erro.codigo === `unidades.csv:matriz:${UNIDADE.slug}`
  );
  assert.ok(erroMatriz);
  assert.match(erroMatriz.detalhe, /campo imutavel: matriz nao pode mudar/);
});

test('referencia de servico e convenio inexistente falha', async () => {
  const raiz = await criarRaiz();
  await criarKit(raiz, (kit) => {
    kit.unidades[0] = linhaUnidade({ servicos: 'servico-inexistente', convenios: 'convenio-inexistente' });
  });
  const resultado = await importar(raiz);
  const lista = codigos(resultado);
  assert.ok(lista.includes(`unidades.csv:servicos:${UNIDADE.slug}`));
  assert.ok(lista.includes(`unidades.csv:convenios:${UNIDADE.slug}`));
});

test('dois principais na matriz falham', async () => {
  const raiz = await criarRaiz();
  await criarKit(raiz, (kit) => {
    kit.unidades[0] = linhaUnidade({
      telefone_2_e164: '+5585991234568',
      telefone_2_tipo: 'movel',
      telefone_2_principal: 'sim'
    });
  });
  const resultado = await importar(raiz);
  assert.equal(resultado.ok, false);
  assert.ok(codigos(resultado).includes(`unidades.csv:telefones:${UNIDADE.slug}`));
  assert.ok(resultado.erros.some((erro) => erro.codigo === `unidades.csv:telefones:${UNIDADE.slug}` && erro.detalhe.includes('no maximo um telefone')));
});

test('telefone institucional precisa ser igual ao principal da matriz', async () => {
  const raiz = await criarRaiz();
  await criarKit(raiz, (kit) => {
    kit.site[0] = linhaSite({ telefone_institucional_e164: '+5585999999999' });
  });
  const resultado = await importar(raiz);
  assert.equal(resultado.ok, false);
  assert.ok(codigos(resultado).includes('site.json:contatoInstitucional.telefoneE164:site'));
});

test('NAO_TEMOS, NAO_SABEMOS, celula vazia e A CONFIRMAR sem espaco', async () => {
  const raiz = await criarRaiz();
  await atualizarDados(raiz, 'unidades.json', (dados) => {
    const unidade = dados.unidades.find((item) => item.slug === UNIDADE.slug);
    unidade.whatsapp = { e164: '+5585900000001', validado: false };
    unidade.comodidades.estacionamento = true;
    unidade.observacoesPublicas = 'Original';
  });
  await criarKit(raiz, (kit) => {
    kit.unidades[0] = linhaUnidade({
      whatsapp_e164: 'NAO_TEMOS',
      comodidades_estacionamento: 'NAO_SABEMOS',
      observacoes_publicas: '',
      atendimento_particular: 'NAO_TEMOS',
      servicos: 'NAO_TEMOS',
      cidade: 'A CONFIRMAR:CE'
    });
  });
  const resultado = await importar(raiz);
  assert.equal(resultado.ok, true, codigos(resultado).join(', '));
  const unidade = JSON.parse(await readFile(path.join(raiz, 'dados/unidades.json'), 'utf8')).unidades.find(
    (item) => item.slug === UNIDADE.slug
  );
  assert.deepEqual(unidade.whatsapp, { e164: null, validado: false });
  assert.equal(unidade.comodidades.estacionamento, true);
  assert.equal(unidade.observacoesPublicas, 'Original');
  assert.equal(unidade.atendimentoParticular, false);
  assert.deepEqual(unidade.servicos, []);
  assert.equal(unidade.cidade, UNIDADE.cidade);
});

test('NAO_SABEMOS em aviso de convenio novo deixa aviso nulo', async () => {
  const raiz = await criarRaiz();
  await criarKit(raiz, (kit) => {
    kit.convenios[0] = linhaConvenio({ aviso: 'NAO_SABEMOS', vigencia_inicio: '', vigencia_fim: '' });
  });
  const resultado = await importar(raiz);
  assert.equal(resultado.ok, true, codigos(resultado).join(', '));
  const convenio = JSON.parse(await readFile(path.join(raiz, 'dados/convenios.json'), 'utf8')).convenios[0];
  assert.equal(convenio.aviso, null);
  assert.ok(resultado.log.json.tokens.some((token) => token.campo === 'aviso'));
});

test('log registra o aviso padrao aplicado a convenio novo', async () => {
  const raiz = await criarRaiz();
  await criarKit(raiz, (kit) => {
    kit.convenios[0] = linhaConvenio({ aviso: '', vigencia_inicio: '', vigencia_fim: '' });
  });
  const resultado = await importar(raiz);
  assert.equal(resultado.ok, true, codigos(resultado).join(', '));
  const convenio = JSON.parse(await readFile(path.join(raiz, 'dados/convenios.json'), 'utf8')).convenios[0];
  assert.match(convenio.aviso, /Cobertura sujeita/);
  const linha = resultado.log.json.linhasImportadas.find((item) => item.tipo === 'convenio');
  assert.match(linha.derivados.aviso, /Cobertura sujeita/);
});

test('base misturada entre arquivos e erro explicito', async () => {
  const raiz = await criarRaiz();
  await criarKit(raiz);
  const site = await lerCsvDaPasta(raiz, 'site');
  site.linhas[0][site.cabecalho.indexOf('base_dados_em')] = '2026-11-19';
  await gravarCsvDaPasta(raiz, 'site', site);
  const antes = await hashDadosTemp(raiz);
  const resultado = await importar(raiz);
  assert.equal(resultado.ok, false);
  assert.ok(codigos(resultado).includes('site.csv:base_dados_em:site'));
  assert.equal(await hashDadosTemp(raiz), antes);
});

test('convenio vincula unidade mesmo sem linha no unidades.csv', async () => {
  const raiz = await criarRaiz();
  await criarKit(raiz, (kit) => {
    kit.unidades = [];
  });
  const resultado = await importar(raiz);
  assert.equal(resultado.ok, true, codigos(resultado).join(', '));
  const unidades = JSON.parse(await readFile(path.join(raiz, 'dados/unidades.json'), 'utf8'));
  const caninde = unidades.unidades.find((item) => item.slug === UNIDADE.slug);
  assert.ok(caninde.convenios.includes('saude-teste'));
  assert.equal(caninde.validacao.data, DATA_CONFIRMACAO);
  assert.equal(caninde.atualizadoEm, DATA_CONFIRMACAO);
  assert.equal(unidades.atualizadoEm, DATA_CONFIRMACAO);
  assert.ok(
    resultado.log.json.relacoes.some(
      (relacao) => relacao.entidade === UNIDADE.slug && relacao.convenio === 'saude-teste'
    )
  );
});

test('markdown escapa pipes e controles; TAB/CR sao recusados no CSV', async () => {
  const escapado = escaparMarkdown('a|b\r\nc\td');
  assert.ok(escapado.includes('a\\|b<br>c'));
  assert.ok(!escapado.includes('\t'));
  assert.ok(!escapado.includes('\r') && !escapado.includes('\n'));

  const raiz = await criarRaiz();
  await criarKit(raiz, (kit) => {
    kit.unidades[0] = linhaUnidade({
      confirmado_por: 'Maria | Gestora',
      fonte: 'ata | reuniao'
    });
  });
  const resultado = await importar(raiz);
  assert.equal(resultado.ok, true, codigos(resultado).join(', '));
  const md = await readFile(path.join(pastaKit(raiz), 'importacao.md'), 'utf8');
  assert.ok(md.includes('Maria \\| Gestora'));
  assert.ok(md.includes('ata \\| reuniao'));

  const raizControle = await criarRaiz();
  await criarKit(raizControle, (kit) => {
    kit.unidades[0] = linhaUnidade({ nome_exibicao: 'Ter\tradic', cidade: 'Cani\rnde' });
  });
  const controles = await importar(raizControle);
  assert.ok(codigos(controles).includes(`unidades.csv:nome_exibicao:${UNIDADE.slug}`));
  assert.ok(codigos(controles).includes(`unidades.csv:cidade:${UNIDADE.slug}`));
});

test('limites de celula, linhas, bytes e campos sao aplicados', async () => {
  const raizCelula = await criarRaiz();
  await criarKit(raizCelula, (kit) => {
    kit.unidades[0] = linhaUnidade({ observacoes_publicas: 'x'.repeat(10001) });
  });
  assert.ok(
    codigos(await importar(raizCelula)).includes(`unidades.csv:observacoes_publicas:${UNIDADE.slug}`)
  );

  const raizLinhas = await criarRaiz();
  await criarKit(raizLinhas, (kit) => {
    kit.unidades = Array.from({ length: 2001 }, () => linhaUnidade());
  });
  assert.ok(codigos(await importar(raizLinhas)).includes('unidades.csv:linhas:unidades'));

  const raizBytes = await criarRaiz();
  await criarKit(raizBytes);
  await writeFile(path.join(pastaKit(raizBytes), 'unidades.csv'), 'x'.repeat(2 * 1024 * 1024 + 1), 'utf8');
  assert.ok(codigos(await importar(raizBytes)).includes('unidades.csv:csv:limite'));

  const raizCampos = await criarRaiz();
  await criarKit(raizCampos);
  const csv = await lerCsvDaPasta(raizCampos, 'unidades');
  for (let indice = 0; indice < 153; indice += 1) {
    csv.cabecalho.push(`extra_${indice}`);
    csv.linhas.forEach((linha) => linha.push(''));
  }
  await gravarCsvDaPasta(raizCampos, 'unidades', csv);
  const campos = await importar(raizCampos);
  assert.ok(
    campos.erros.some(
      (erro) => erro.codigo === 'unidades.csv:colunas:unidades' && erro.detalhe.includes('excede')
    )
  );
});

test('anexo sem e164 e geracao deterministica', async () => {
  const modelo = montarModeloColeta({
    dados: DADOS_REAIS,
    exemplos: EXEMPLOS_REAIS,
    relatorio: RELATORIO_REAL
  });
  assert.ok(modelo.anexo.telefones.every((telefone) => !('e164' in telefone)));

  const raiz = await criarRaiz();
  const primeira = await executarColeta({ raiz, silencioso: true });
  assert.equal(primeira.ok, true);
  const hashes1 = await hashArquivos(
    (await readdir(pastaKit(raiz))).sort().map((arquivo) => path.join(pastaKit(raiz), arquivo))
  );
  const segunda = await executarColeta({ raiz, silencioso: true });
  assert.equal(segunda.ok, true);
  const hashes2 = await hashArquivos(
    (await readdir(pastaKit(raiz))).sort().map((arquivo) => path.join(pastaKit(raiz), arquivo))
  );
  assert.equal(hashes2, hashes1);
});

test('base do kit anterior falha sem --sobrescrever e grava as duas bases com a flag', async () => {
  const raiz = await criarRaiz();
  await criarKit(raiz);
  for (const item of ARQUIVOS_COLETA) {
    const csv = await lerCsvDaPasta(raiz, item.chave);
    const indice = csv.cabecalho.indexOf('base_dados_em');
    csv.linhas.forEach((linha) => (linha[indice] = '2026-11-19'));
    await gravarCsvDaPasta(raiz, item.chave, csv);
  }
  const antes = await hashDadosTemp(raiz);
  const semFlag = await importar(raiz);
  assert.ok(codigos(semFlag).includes('coleta:base_dados_em:kit'));
  assert.equal(await hashDadosTemp(raiz), antes);
  const comFlag = await importar(raiz, { sobrescrever: true });
  assert.equal(comFlag.ok, true);
  assert.equal(comFlag.log.json.baseDadosEm, '2026-11-19');
  assert.equal(comFlag.log.json.baseDadosEmAtual, BASE);
});

test('entidade confirmada exige --sobrescrever e e rebaixada', async () => {
  const raiz = await criarRaiz();
  await criarKit(raiz);
  assert.equal((await importar(raiz)).ok, true);
  await atualizarDados(raiz, 'unidades.json', (dados) => {
    const unidade = dados.unidades.find((item) => item.slug === UNIDADE.slug);
    unidade.validacao = {
      status: 'confirmado',
      confirmadoPor: 'Maria',
      data: BASE,
      fontes: ['ata']
    };
  });
  const csv = await lerCsvDaPasta(raiz, 'unidades');
  const indice = csv.cabecalho.indexOf('nome_exibicao');
  csv.linhas[0][indice] = 'Terradic Caninde Centro';
  await gravarCsvDaPasta(raiz, 'unidades', csv);

  const antes = await hashDadosTemp(raiz);
  const semFlag = await importar(raiz);
  assert.equal(semFlag.ok, false);
  assert.ok(codigos(semFlag).includes(`unidades.csv:sobrescrever:${UNIDADE.slug}`));
  assert.equal(await hashDadosTemp(raiz), antes);

  const comFlag = await importar(raiz, { sobrescrever: true });
  assert.equal(comFlag.ok, true);
  const unidade = JSON.parse(await readFile(path.join(raiz, 'dados/unidades.json'), 'utf8')).unidades.find(
    (item) => item.slug === UNIDADE.slug
  );
  assert.equal(unidade.status, 'a-confirmar');
  assert.equal(unidade.validacao.status, 'pendente');
  assert.equal(unidade.nomeExibicao, 'Terradic Caninde Centro');
  assert.ok(comFlag.log.json.sobrescritas.some((item) => item.campo === 'nome_exibicao'));
  const logFlag = await readFile(path.join(pastaKit(raiz), 'importacao.json'));
  const comFlag2 = await importar(raiz, { sobrescrever: true });
  assert.equal(comFlag2.ok, true);
  assert.deepEqual(await readFile(path.join(pastaKit(raiz), 'importacao.json')), logFlag);
  assert.ok(comFlag2.log.json.sobrescritas.some((item) => item.campo === 'nome_exibicao'));
});

test('log de falha nao lista linhas como importadas e nao deixa .tmp em dados', async () => {
  const raiz = await criarRaiz();
  await criarKit(raiz, (kit) => {
    kit.unidades[0] = linhaUnidade({ endereco_cep: '1234' });
  });
  const resultado = await importar(raiz);
  assert.equal(resultado.ok, false);
  assert.equal(resultado.log.json.linhasImportadas.length, 0);
  assert.ok(resultado.log.json.linhasProcessadas.length > 0);
  const arquivos = await readdir(path.join(raiz, 'dados'));
  assert.ok(arquivos.every((arquivo) => !arquivo.endsWith('.tmp')));
});
