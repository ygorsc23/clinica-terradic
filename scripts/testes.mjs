import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

import {
  carregarDados,
  carregarExemplosBriefing,
  resolverPublicacao,
  validarDados
} from './lib/dados.mjs';
import { REGRAS, checarSitemap } from './lib/checagens.mjs';
import { carregarTemplates } from './lib/render.mjs';
import {
  descricaoUnidade,
  gerarPaginas,
  planejarRotas,
  rotuloRevisaoPreparo,
  tituloUnidade
} from './lib/paginas.mjs';
import { validarGoLive } from './lib/golive.mjs';
import { gerarRelatorio } from './lib/relatorio.mjs';
import { renderizarBlocos } from './lib/blocos.mjs';
import { diretorioDeSaida, fotografiaDiretorio, gerarRobots, gerarSitemap } from './build.mjs';
import { serializarJsonLd } from './lib/seo.mjs';
import { normalizarBase, prefixarDiretorio, prefixarHtml, validarArtefato } from './prefixar-base.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL_BASE = 'https://terradic.com.br';

const dadosBase = await carregarDados(RAIZ, { rascunho: false });
const exemplos = await carregarExemplosBriefing(RAIZ);
const templates = await carregarTemplates(path.join(RAIZ, 'src', 'templates'));
const unidadesTeste = JSON.parse(
  await readFile(path.join(RAIZ, 'dados-teste', 'unidades.exemplo.json'), 'utf8')
);

function dadosComUnidadesAtivas() {
  const dados = structuredClone(dadosBase);
  dados.unidades = structuredClone(unidadesTeste);
  return dados;
}

async function paginasDe(dados, { rascunho = false } = {}) {
  const publicacao = resolverPublicacao(dados, { rascunho });
  return gerarPaginas({ dados, publicacao, templates, urlBase: URL_BASE, rascunho });
}

function htmlDaPagina(paginas, rota) {
  return paginas.find((pagina) => pagina.rota === rota)?.html ?? '';
}

function conteudoPrincipal(html) {
  return html.match(/<main[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? '';
}

function decodificarHtml(texto) {
  return String(texto)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function jsonLdDaPagina(html) {
  const bruto = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  return bruto ? JSON.parse(bruto) : null;
}

function validar(dados) {
  return validarDados(dados, { exemplos });
}

function temCodigo(erros, codigo) {
  return erros.some((erro) => erro.codigo === codigo);
}

function rodar(regra, arquivos, producao = true, extra = {}) {
  return REGRAS[regra]({
    arquivos: new Map(Object.entries(arquivos)),
    urlBase: URL_BASE,
    producao,
    ...extra
  });
}

function textoPseudoaleatorio(tamanho) {
  return randomBytes(tamanho).toString('base64');
}

// ---------- Validador de dados (T004) ----------

test('dados de produção atuais passam na validação', () => {
  assert.deepEqual(validar(structuredClone(dadosBase)), []);
});

test('unidade ativa sem CEP falha com arquivo:campo:entidade', () => {
  const dados = dadosComUnidadesAtivas();
  dados.unidades.unidades[0].endereco.cep = null;
  const erros = validar(dados);
  assert.ok(temCodigo(erros, 'unidades.json:endereco.cep:teste-centro'));
});

test('slug duplicado é rejeitado', () => {
  const dados = dadosComUnidadesAtivas();
  dados.unidades.unidades[1].slug = dados.unidades.unidades[0].slug;
  const erros = validar(dados);
  assert.ok(erros.some((erro) => erro.detalhe.includes('slug duplicado')));
});

test('slug com acento ou maiúscula é rejeitado', () => {
  const dados = dadosComUnidadesAtivas();
  dados.unidades.unidades[0].slug = 'Canindé';
  const erros = validar(dados);
  assert.ok(temCodigo(erros, 'unidades.json:slug:Canindé'));
});

test('telefone fora do padrão E.164 é rejeitado', () => {
  const dados = dadosComUnidadesAtivas();
  dados.unidades.unidades[0].telefones.push({ rotulo: 'Teste', e164: '85 9000-0009', validado: true });
  const erros = validar(dados);
  assert.ok(temCodigo(erros, 'unidades.json:telefones[2].e164:teste-centro'));
});

test('telefone idêntico a exemplo do levantamento é recusado', () => {
  const dados = dadosComUnidadesAtivas();
  dados.unidades.unidades[0].telefones[0].e164 = exemplos.telefones[0].e164;
  const erros = validar(dados);
  assert.ok(
    erros.some(
      (erro) =>
        erro.codigo === 'unidades.json:telefones[0].e164:teste-centro' &&
        erro.detalhe.includes('exemplo do levantamento')
    )
  );
});

test('horário com abre >= fecha é rejeitado', () => {
  const dados = dadosComUnidadesAtivas();
  dados.unidades.unidades[0].horarios[0].abre = '19:00';
  const erros = validar(dados);
  assert.ok(temCodigo(erros, 'unidades.json:horarios[0]:teste-centro'));
});

test('referência de serviço inexistente é rejeitada', () => {
  const dados = dadosComUnidadesAtivas();
  dados.unidades.unidades[0].servicos.push('servico-inexistente');
  const erros = validar(dados);
  assert.ok(
    erros.some(
      (erro) =>
        erro.codigo === 'unidades.json:servicos:teste-centro' &&
        erro.detalhe.includes('servico-inexistente')
    )
  );
});

test('unidade ativa sem validação confirmada é rejeitada', () => {
  const dados = dadosComUnidadesAtivas();
  dados.unidades.unidades[0].validacao.status = 'pendente';
  const erros = validar(dados);
  assert.ok(temCodigo(erros, 'unidades.json:validacao.status:teste-centro'));
});

test('portal de exames com URL diferente da exata é rejeitado', () => {
  const dados = dadosComUnidadesAtivas();
  dados.site.portalExames.url = 'https://entregadeexames.com.br';
  const erros = validar(dados);
  assert.ok(temCodigo(erros, 'site.json:portalExames.url:site'));
});

test('urlBase com www ou barra final é rejeitada', () => {
  const dados = dadosComUnidadesAtivas();
  dados.site.urlBase = 'https://www.terradic.com.br/';
  const erros = validar(dados);
  assert.ok(temCodigo(erros, 'site.json:urlBase:site'));
});

test('serviço aprovado sem descrição é rejeitado', () => {
  const dados = dadosComUnidadesAtivas();
  dados.servicos.servicos[0].status = 'aprovado';
  const erros = validar(dados);
  assert.ok(temCodigo(erros, 'servicos.json:descricao:tomografia'));
});

test('preparo aprovado sem responsável técnico é rejeitado', () => {
  const dados = dadosComUnidadesAtivas();
  dados.preparos.preparos[0].revisao.status = 'aprovado';
  const erros = validar(dados);
  assert.ok(temCodigo(erros, 'preparos.json:revisao.responsavel:tomografia-sem-contraste'));
});

test('nenhum serviço, preparo ou unidade é publicado em produção hoje', () => {
  const publicacao = resolverPublicacao(dadosBase, { rascunho: false });
  assert.equal(publicacao.unidades.length, 0);
  assert.equal(publicacao.servicos.length, 0);
  assert.equal(publicacao.preparos.length, 0);
});

test('em rascunho as unidades de teste entram no build', () => {
  const dados = dadosComUnidadesAtivas();
  const publicacao = resolverPublicacao(dados, { rascunho: true });
  assert.equal(publicacao.unidades.length, 4);
});

// ---------- Checagens de saída (T008) ----------

test('links.interno acusa link para rota inexistente', () => {
  const erros = rodar('links.interno', {
    'index.html': '<a href="/rota-inexistente/">x</a>'
  });
  assert.ok(erros.some((erro) => erro.regra === 'links.interno' && erro.detalhe.includes('/rota-inexistente/')));
});

test('links.interno acusa âncora quebrada', () => {
  const erros = rodar('links.interno', {
    'index.html': '<a href="/unidades/#contato">x</a>',
    'unidades/index.html': '<p id="outra-coisa">sem âncora</p>'
  });
  assert.ok(erros.some((erro) => erro.detalhe.includes('#contato')));
});

test('links.rel exige target e rel em link externo', () => {
  const erros = rodar('links.rel', {
    'index.html': '<a href="https://example.com">externo</a>'
  });
  assert.equal(erros.length, 2);
  assert.ok(erros.every((erro) => erro.regra === 'links.rel'));
});

test('links.tel exige E.164', () => {
  const erros = rodar('links.tel', {
    'index.html': '<a href="tel:3333-4444">Telefone</a>'
  });
  assert.ok(erros.some((erro) => erro.regra === 'links.tel'));
});

test('portal.url aceita somente a URL exata', () => {
  const comParametro = rodar('portal.url', {
    'index.html':
      '<a href="https://entregadeexames.com.br/?origem=site" target="_blank" rel="noopener noreferrer">Baixar</a>'
  });
  assert.ok(comParametro.some((erro) => erro.detalhe.includes('exatamente')));

  const correta = rodar('portal.url', {
    'index.html':
      '<a href="https://entregadeexames.com.br/" target="_blank" rel="noopener noreferrer">Baixar</a>'
  });
  assert.equal(correta.length, 0);
});

test('externo.requisicao acusa script externo', () => {
  const erros = rodar('externo.requisicao', {
    'index.html': '<!DOCTYPE html><html><head><script src="https://cdn.example.com/x.js"></script></head></html>'
  });
  assert.ok(erros.some((erro) => erro.regra === 'externo.requisicao'));
});

test('externo.requisicao permite canonical e bloqueia preload externo', () => {
  const permitido = rodar('externo.requisicao', {
    'index.html': '<link rel="canonical" href="https://terradic.com.br/">'
  });
  assert.equal(permitido.length, 0);

  const bloqueado = rodar('externo.requisicao', {
    'index.html': '<link rel="preload" href="https://fonts.example.com/fonte.woff2" as="font">'
  });
  assert.ok(bloqueado.some((erro) => erro.regra === 'externo.requisicao'));
});

test('conteudo.placeholder acusa texto provisório', () => {
  const erros = rodar('conteudo.placeholder', { 'index.html': '<p>lorem ipsum</p>' });
  assert.ok(erros.some((erro) => erro.detalhe.includes('lorem')));
});

test('conteudo.claim acusa promessa de resultado', () => {
  const erros = rodar('conteudo.claim', { 'index.html': '<p>Resultados precisos para o seu exame.</p>' });
  assert.ok(erros.some((erro) => erro.regra === 'conteudo.claim'));
});

test('conteudo.hex acusa cor literal fora do tema', () => {
  const hex = `#${'FF0000'}`;
  const erros = rodar('conteudo.hex', { 'index.html': `<span style="color:${hex}">x</span>` });
  assert.ok(erros.some((erro) => erro.detalhe.includes(hex)));
});

test('nap.divergencia acusa nome diferente entre HTML e JSON-LD', () => {
  const json = {
    '@graph': [
      {
        '@type': 'MedicalClinic',
        name: 'Unidade B',
        telephone: '+5585900000001',
        address: { streetAddress: 'Rua A, 1', postalCode: '60000000' }
      }
    ]
  };
  const html = `<address data-nap-escopo="unidade" data-nap-nome="Unidade A" data-nap-logradouro="Rua A" data-nap-cep="60000000" data-nap-telefone="+5585900000001"></address><script type="application/ld+json">${JSON.stringify(json)}</script>`;
  const erros = rodar('nap.divergencia', { 'unidades/a/index.html': html });
  assert.ok(erros.some((erro) => erro.regra === 'nap.divergencia' && erro.detalhe.includes('nome')));
});

test('orcamento falha quando o JS passa de 10 KB gzip', () => {
  const erros = rodar('orcamento', { 'assets/app.js': textoPseudoaleatorio(40000) });
  assert.ok(erros.some((erro) => erro.regra === 'orcamento' && erro.detalhe.includes('JS')));
});

test('saida.obrigatoria acusa arquivos ausentes', () => {
  const erros = rodar('saida.obrigatoria', { 'index.html': '<html></html>' });
  assert.ok(erros.some((erro) => erro.arquivo === 'sitemap.xml'));
});

test('html.basico acusa ausência de h1 único', () => {
  const html =
    '<!DOCTYPE html><html lang="pt-BR"><head><title>x</title></head><body><a class="pular-link" href="#conteudo">p</a><main id="conteudo"></main></body></html>';
  const erros = rodar('html.basico', { 'index.html': html });
  assert.ok(erros.some((erro) => erro.detalhe.includes('<h1>')));
});

test('html.basico recusa faixa de revisão em produção', () => {
  const html =
    '<!DOCTYPE html><html lang="pt-BR"><head><title>x</title></head><body>VERSÃO DE REVISÃO<a class="pular-link" href="#conteudo">p</a><main id="conteudo"><h1>t</h1></main></body></html>';
  const erros = rodar('html.basico', { 'index.html': html }, true);
  assert.ok(erros.some((erro) => erro.detalhe.includes('faixa de revisão')));
});

test('html.metaUnica acusa título repetido', () => {
  const erros = rodar('html.metaUnica', {
    'a.html': '<title>Mesmo título</title>',
    'b.html': '<title>Mesmo título</title>'
  });
  assert.ok(erros.some((erro) => erro.regra === 'html.metaUnica' && erro.detalhe.includes('repetido')));
});

test('sitemap acusa URL que não foi gerada', () => {
  const arquivos = new Map([
    [
      'sitemap.xml',
      '<?xml version="1.0" encoding="UTF-8"?><urlset><url><loc>https://terradic.com.br/unidade-fantasma/</loc><lastmod>2026-11-20</lastmod></url></urlset>'
    ],
    ['robots.txt', 'User-agent: *\nAllow: /\nSitemap: https://terradic.com.br/sitemap.xml']
  ]);
  const erros = checarSitemap({ arquivos, rotas: ['/'], urlBase: URL_BASE });
  assert.ok(erros.some((erro) => erro.regra === 'sitemap'));
});

// ---------- Rodada 2: gates e regressões ----------

test('B2: unidade ativa exige telefone com validado booleano e true', () => {
  const dados = dadosComUnidadesAtivas();
  delete dados.unidades.unidades[0].telefones[0].validado;
  assert.ok(temCodigo(validar(dados), 'unidades.json:telefones[0].validado:teste-centro'));

  const semValidado = dadosComUnidadesAtivas();
  semValidado.unidades.unidades[0].telefones.forEach((telefone) => {
    telefone.validado = false;
  });
  assert.ok(temCodigo(validar(semValidado), 'unidades.json:telefones:teste-centro'));
});

test('B2: unidade ativa exige confirmadoPor, data e fontes', () => {
  const dados = dadosComUnidadesAtivas();
  delete dados.unidades.unidades[0].validacao.confirmadoPor;
  dados.unidades.unidades[0].validacao.data = null;
  dados.unidades.unidades[0].validacao.fontes = [];
  const erros = validar(dados);
  assert.ok(temCodigo(erros, 'unidades.json:validacao.confirmadoPor:teste-centro'));
  assert.ok(temCodigo(erros, 'unidades.json:validacao.data:teste-centro'));
  assert.ok(temCodigo(erros, 'unidades.json:validacao.fontes:teste-centro'));
});

test('B1: go-live acusa preparo pendente exigido por serviço publicável', () => {
  const dados = dadosComUnidadesAtivas();
  const tomografia = dados.servicos.servicos.find((servico) => servico.id === 'tomografia');
  tomografia.status = 'aprovado';
  tomografia.resumo = 'Exame de imagem.';
  tomografia.descricao = ['Descrição aprovada para teste.'];
  dados.unidades.unidades[0].servicos = ['tomografia'];
  dados.preparos.preparos.find((preparo) => preparo.slug === 'tomografia-sem-contraste').revisao = {
    status: 'aprovado',
    responsavel: 'RT Teste',
    crm: '12345',
    data: '2026-11-20'
  };
  const publicacao = resolverPublicacao(dados, { rascunho: false });
  const erros = validarGoLive({
    dados,
    publicacao,
    rotas: planejarRotas(dados, publicacao).map((pagina) => pagina.rota)
  });
  assert.ok(
    erros.some((erro) => erro.codigo === 'preparos.json:revisao.status:tomografia-com-contraste')
  );
});

test('B3/B4: go-live lista RT, contato, matriz, unidades, menu e rotas de uma vez', () => {
  const publicacao = resolverPublicacao(dadosBase, { rascunho: false });
  const erros = validarGoLive({
    dados: dadosBase,
    publicacao,
    rotas: planejarRotas(dadosBase, publicacao).map((pagina) => pagina.rota)
  });
  const codigos = new Set(erros.map((erro) => erro.codigo));
  for (const codigo of [
    'unidades.json:publicadas:site',
    'rotas:menu:site',
    'rotas:/sobre/:site',
    'site.json:responsavelTecnico.status:site',
    'site.json:responsavelTecnico.crm:site',
    'site.json:contatoInstitucional.email:site',
    'site.json:contatoInstitucional.telefoneE164:site',
    'unidades.json:endereco.cep:caninde'
  ]) {
    assert.ok(codigos.has(codigo), `esperado ${codigo}`);
  }
  assert.ok(erros.length >= 10);
});

test('M1: título e descrição de todas as unidades respeitam os limites', () => {
  for (const unidade of dadosBase.unidades.unidades) {
    const titulo = tituloUnidade(unidade);
    const descricao = descricaoUnidade(unidade, dadosBase.site.marca.nome);
    assert.ok(titulo.length <= 60, `${unidade.slug}: title com ${titulo.length}`);
    assert.ok(
      descricao.length >= 120 && descricao.length <= 160,
      `${unidade.slug}: description com ${descricao.length}`
    );
  }
});

test('M2: ressalva e data de atualização aparecem mesmo com convênio na lista', async () => {
  const dados = dadosComUnidadesAtivas();
  dados.convenios = {
    versao: 1,
    atualizadoEm: '2026-11-20',
    convenios: [
      {
        id: 'unimed',
        nome: 'Unimed',
        tipo: 'medicina-de-grupo',
        exibirLogo: false,
        logoAutorizado: false
      }
    ]
  };
  dados.unidades.unidades[0].convenios = ['unimed'];
  const paginas = await paginasDe(dados, { rascunho: true });
  const html = htmlDaPagina(paginas, '/unidades/teste-centro/');
  assert.ok(html.includes('Unimed'));
  assert.match(html, /Lista atualizada em 20\/11\/2026/);
  assert.match(html, /cobertura junto à operadora/);
});

test('M3: serviço pendente não aparece em chips nem em availableService', async () => {
  const dados = dadosComUnidadesAtivas();
  dados.servicos.servicos.push({
    id: 'pendente-teste',
    slug: 'pendente-teste',
    nome: 'Serviço Pendente Teste',
    nomeCurto: 'Pendente Teste',
    resumo: null,
    descricao: [],
    indicacoes: [],
    comoEfeito: [],
    duracaoMedia: null,
    exigePedidoMedico: false,
    preparos: [],
    seo: { titulo: null, descricao: null },
    status: 'pendente'
  });
  dados.unidades.unidades[0].servicos = ['pendente-teste'];
  const paginas = await paginasDe(dados, { rascunho: true });
  const html = htmlDaPagina(paginas, '/unidades/teste-centro/');
  assert.ok(!html.includes('Serviço Pendente Teste'));
  assert.ok(!html.includes('Pendente Teste'));
  const jsonLd = jsonLdDaPagina(html);
  const clinica = jsonLd['@graph'].find((no) => no['@type'] === 'MedicalClinic');
  assert.ok(!(clinica.availableService ?? []).some((servico) => servico.name.includes('Pendente')));
});

test('M4: selo de preparo mostra responsável, CRM e data', async () => {
  const dados = dadosComUnidadesAtivas();
  dados.preparos.preparos[0].revisao = {
    status: 'aprovado',
    responsavel: 'Dra. Teste',
    crm: '12345',
    data: '2026-11-20'
  };
  assert.equal(
    rotuloRevisaoPreparo(dados.preparos.preparos[0]),
    'Revisado por Dra. Teste (CRM 12345) em 20/11/2026'
  );
  const paginas = await paginasDe(dados, { rascunho: true });
  assert.match(
    htmlDaPagina(paginas, '/preparo-de-exames/'),
    /Revisado por Dra\. Teste \(CRM 12345\) em 20\/11\/2026/
  );
});

test('M5: token de foco escuro tem contraste >= 3:1 contra a secundária', async () => {
  const css = await readFile(path.join(RAIZ, 'src', 'css', 'estilo.css'), 'utf8');
  const secundaria = css.match(/--cor-secundaria:\s*(#[0-9a-fA-F]{6})/)?.[1];
  const focoEscuro = css.match(/--cor-foco-escuro:\s*(#[0-9a-fA-F]{6})/)?.[1];
  assert.ok(secundaria && focoEscuro);

  const luminancia = (hex) => {
    const canais = [1, 3, 5].map((inicio) => parseInt(hex.slice(inicio, inicio + 2), 16) / 255);
    const linear = canais.map((canal) =>
      canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4
    );
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const [claro, escuro] = [luminancia(focoEscuro), luminancia(secundaria)].sort((a, b) => b - a);
  const contraste = (claro + 0.05) / (escuro + 0.05);
  assert.ok(contraste >= 3, `contraste ${contraste.toFixed(2)}:1`);
  assert.match(css, /\.heroi\s*:focus-visible/);
  assert.match(css, /\.rodape\s*:focus-visible/);
});

test('M6: renderizador de blocos suporta os tipos e escapa HTML', () => {
  const html = renderizarBlocos(
    [
      { tipo: 'titulo', texto: 'Título' },
      { tipo: 'subtitulo', texto: 'Subtítulo' },
      { tipo: 'paragrafo', texto: '<script>alert(1)</script>' },
      { tipo: 'lista', titulo: 'Lista', itens: ['Um', '<b>Dois</b>'] },
      { tipo: 'destaque', texto: 'Destaque' },
      { tipo: 'aviso', texto: 'Aviso' },
      { tipo: 'citacao', texto: 'Citação' }
    ],
    templates
  );
  assert.match(html, /<h2 class="secao-titulo">Título<\/h2>/);
  assert.match(html, /<h3 class="bloco-subtitulo">Subtítulo<\/h3>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.ok(!html.includes('<script>alert(1)'));
  assert.match(html, /<aside class="bloco-destaque">Destaque<\/aside>/);
  assert.match(html, /<blockquote class="bloco-citacao"><p>Citação<\/p><\/blockquote>/);
  assert.match(html, /&lt;b&gt;Dois&lt;\/b&gt;/);
  assert.throws(
    () => renderizarBlocos([{ tipo: 'html', texto: 'x' }], templates),
    /Tipo de bloco desconhecido/
  );
});

test('M7: relatório calcula C-03 pelo gate real de telefone validado', () => {
  const dados = dadosComUnidadesAtivas();
  dados.unidades.unidades = dados.unidades.unidades.filter((unidade) => unidade.status === 'ativo');
  const relatorio = gerarRelatorio({
    dados,
    publicacao: resolverPublicacao(dados, { rascunho: true })
  });
  assert.equal(relatorio.json.bloqueios.find((item) => item.id === 'C-03').pendente, false);

  const semValidacao = structuredClone(dados);
  semValidacao.unidades.unidades.forEach((unidade) => {
    unidade.telefones.forEach((telefone) => {
      delete telefone.validado;
    });
  });
  const relatorioSem = gerarRelatorio({
    dados: semValidacao,
    publicacao: resolverPublicacao(semValidacao, { rascunho: true })
  });
  assert.equal(relatorioSem.json.bloqueios.find((item) => item.id === 'C-03').pendente, true);
});

test('M8: NAP compara CEP visível normalizado além dos atributos ocultos', () => {
  const json = {
    '@graph': [
      {
        '@type': 'MedicalClinic',
        name: 'Unidade A',
        telephone: '+5585900000001',
        address: { streetAddress: 'Rua A, 10', postalCode: '60000000' }
      }
    ]
  };
  const html = `<address data-nap-escopo="unidade" data-nap-nome="Unidade A" data-nap-logradouro="Rua A" data-nap-bairro="Centro" data-nap-cep="60000000" data-nap-telefone="+5585900000001"><span>Rua A, 10</span><span>Centro · CEP 60000-001</span></address><a href="tel:+5585900000001">(85) 90000-0001</a><script type="application/ld+json">${JSON.stringify(json)}</script>`;
  const erros = rodar('nap.divergencia', { 'unidades/a/index.html': html });
  assert.ok(erros.some((erro) => erro.regra === 'nap.divergencia' && erro.detalhe.includes('CEP visível')));
});

test('A1: artefato de produção recusa noindex, faixa e dados de teste', () => {
  const erros = rodar(
    'artefato.producao',
    {
      'index.html':
        '<meta name="robots" content="noindex"><p>VERSÃO DE REVISÃO</p><a href="/unidades/teste-centro/">x</a>',
      'sitemap.xml':
        '<?xml version="1.0"?><urlset><url><loc>http://localhost:4173/unidades/teste-centro/</loc></url></urlset>'
    },
    true,
    { slugsTeste: ['teste-centro'] }
  );
  assert.ok(erros.some((erro) => erro.detalhe.includes('noindex')));
  assert.ok(erros.some((erro) => erro.detalhe.includes('VERSÃO DE REVISÃO')));
  assert.ok(erros.some((erro) => erro.detalhe.includes('teste-centro')));
  assert.ok(erros.some((erro) => erro.detalhe.includes('fictícia')));
});

test('A1: artefato.producao é ignorado no build de rascunho', () => {
  const erros = rodar(
    'artefato.producao',
    { 'index.html': '<meta name="robots" content="noindex">' },
    false
  );
  assert.equal(erros.length, 0);
});

test('A3: externo.requisicao varre @import, url() e @font-face externos no CSS', () => {
  const importRemoto = rodar('externo.requisicao', {
    'assets/estilo.css': '@import url("https://fonts.googleapis.com/css2?family=Inter");'
  });
  assert.ok(importRemoto.some((erro) => erro.detalhe.includes('@import remoto')));

  const fonteRemota = rodar('externo.requisicao', {
    'assets/estilo.css':
      '@font-face{font-family:Inter;src:url(https://fonts.gstatic.com/s/inter.woff2) format("woff2")}'
  });
  assert.ok(fonteRemota.some((erro) => erro.detalhe.includes('@font-face')));
});

test('L1: 404 tem trilha de navegação', async () => {
  const paginas = await paginasDe(dadosBase);
  const html = htmlDaPagina(paginas, '/404.html');
  assert.match(html, /Trilha de navegação/);
  assert.match(html, /Página não encontrada/);
});

test('L2: conteudo.hex também acusa cor literal em SVG', () => {
  const erros = rodar('conteudo.hex', { 'assets/marca.svg': '<svg fill="#FF0000"></svg>' });
  assert.ok(erros.some((erro) => erro.regra === 'conteudo.hex'));
});

test('L4/L5/M8: marca vem do JSON, WhatsApp avisa ambiente externo e nota da matriz aparece', async () => {
  const dados = dadosComUnidadesAtivas();
  dados.site.marca.nome = 'Marca Teste';
  const paginas = await paginasDe(dados, { rascunho: true });
  const htmlUnidade = htmlDaPagina(paginas, '/unidades/teste-centro/');
  assert.ok(htmlUnidade.includes('O WhatsApp é um serviço externo'));
  assert.ok(htmlUnidade.includes('endereço institucional da matriz'));
  assert.ok(htmlUnidade.includes('Marca Teste'));
});


// ---------- Rodada 3: F4, blocos, rodapé/NAP e robustez ----------

function dadosComMatrizCompleta() {
  const dados = dadosComUnidadesAtivas();
  dados.unidades.unidades = dados.unidades.unidades.filter(
    (unidade) => unidade.slug === 'teste-centro'
  );
  const tomografia = dados.servicos.servicos.find((servico) => servico.id === 'tomografia');
  tomografia.status = 'aprovado';
  tomografia.resumo = 'Exame de imagem.';
  tomografia.descricao = ['Descrição aprovada para teste.'];
  dados.unidades.unidades[0].servicos = ['tomografia'];
  dados.preparos.preparos
    .filter((preparo) => preparo.servicoId === 'tomografia')
    .forEach((preparo) => {
      preparo.revisao = {
        status: 'aprovado',
        responsavel: 'RT Teste',
        crm: '12345',
        data: '2026-11-20'
      };
    });
  dados.site.responsavelTecnico = {
    status: 'confirmado',
    nome: 'Dra. Teste',
    crm: '12345',
    crmUf: 'CE',
    especialidade: 'Radiologia'
  };
  dados.site.contatoInstitucional = {
    email: 'contato@terradic.invalid',
    telefoneE164: '+558590000001'
  };
  return dados;
}

function napEsperadoDe(dados, publicacao) {
  const matriz = (dados.unidades?.unidades ?? []).find(
    (unidade) => unidade.matriz === true && unidade.validacao?.status === 'confirmado'
  );
  return {
    matriz: matriz
      ? {
          nome: matriz.nomeExibicao,
          logradouro: matriz.endereco.logradouro,
          numero: matriz.endereco.numero,
          bairro: matriz.endereco.bairro,
          cep: matriz.endereco.cep,
          cidade: matriz.cidade,
          uf: matriz.uf
        }
      : null,
    telefoneInstitucional:
      (matriz?.telefones ?? []).find((telefone) => telefone.validado === true)?.e164 ?? null
  };
}

test('R3-A1: com matriz confirmada, rodapé contém endereço e telefone institucional', async () => {
  const dados = dadosComMatrizCompleta();
  const paginas = await paginasDe(dados);
  const home = htmlDaPagina(paginas, '/');
  assert.ok(home.includes('Avenida das Palmeiras'));
  assert.ok(home.includes('(85) 9000-0001'));
  assert.ok(home.includes('Radiologia'));
});

test('R3-A1: matriz não confirmada bloqueia o go-live e omite o rodapé', async () => {
  const dados = dadosComMatrizCompleta();
  dados.unidades.unidades[0].status = 'a-confirmar';
  dados.unidades.unidades[0].validacao.status = 'pendente';
  const publicacao = resolverPublicacao(dados, { rascunho: false });
  const erros = validarGoLive({
    dados,
    publicacao,
    rotas: planejarRotas(dados, publicacao, { rascunho: false }).map((pagina) => pagina.rota)
  });
  assert.ok(erros.some((erro) => erro.codigo === 'unidades.json:matriz-confirmada:teste-centro'));
  const paginas = await paginasDe(dados);
  const home = htmlDaPagina(paginas, '/');
  assert.ok(!home.includes('Avenida das Palmeiras'));
});

test('R3-A1: matriz confirmada sem página publicada ainda alimenta o rodapé', async () => {
  const dados = dadosComUnidadesAtivas();
  dados.site.contatoInstitucional = {
    email: 'contato@terradic.invalid',
    telefoneE164: '+558590000001'
  };
  const publicacao = resolverPublicacao(dados, { rascunho: false });
  assert.equal(publicacao.unidades.length, 0);
  const paginas = await paginasDe(dados);
  const home = htmlDaPagina(paginas, '/');
  assert.ok(home.includes('Avenida das Palmeiras'));
  assert.ok(home.includes('(85) 9000-0001'));
});

test('R3-A2: nap.divergencia acusa divergência no rodapé (CEP e telefone)', async () => {
  const dados = dadosComMatrizCompleta();
  const publicacao = resolverPublicacao(dados, { rascunho: false });
  const paginas = await paginasDe(dados);
  const home = htmlDaPagina(paginas, '/');
  const esperado = napEsperadoDe(dados, publicacao);

  const cepErrado = home.replace('data-nap-cep="60000000"', 'data-nap-cep="60000001"');
  const errosCep = rodar('nap.divergencia', { 'index.html': cepErrado }, true, {
    napEsperado: esperado
  });
  assert.ok(errosCep.some((erro) => erro.detalhe.includes('rodapé: CEP')));

  const telefoneErrado = home.replace(
    'data-nap-telefone="+558590000001"',
    'data-nap-telefone="+558590000011"'
  );
  const errosTelefone = rodar('nap.divergencia', { 'index.html': telefoneErrado }, true, {
    napEsperado: esperado
  });
  assert.ok(errosTelefone.some((erro) => erro.detalhe.includes('telefone institucional')));
});

test('R3-A3: unidade ativa sem serviço aprovado não publica e bloqueia go-live', () => {
  const dados = dadosComUnidadesAtivas();
  const publicacao = resolverPublicacao(dados, { rascunho: false });
  assert.equal(publicacao.unidades.length, 0);
  const erros = validarGoLive({
    dados,
    publicacao,
    rotas: planejarRotas(dados, publicacao, { rascunho: false }).map((pagina) => pagina.rota)
  });
  assert.ok(erros.some((erro) => erro.codigo === 'servicos.json:aprovados:site'));
  assert.ok(erros.some((erro) => erro.codigo === 'unidades.json:servicos:teste-centro'));
});

test('R3-A4: marca e títulos de seção vêm de paginas.json', async () => {
  const dados = structuredClone(dadosBase);
  dados.paginas.paginas.home.blocos.find((bloco) => bloco.id === 'marca-subtitulo').texto =
    'Marca Teste Sub';
  dados.paginas.paginas.home.blocos.find((bloco) => bloco.id === 'servicos-titulo').texto =
    'Título Serviços Teste';
  const paginas = await paginasDe(dados, { rascunho: true });
  const home = htmlDaPagina(paginas, '/');
  assert.ok(home.includes('Marca Teste Sub'));
  assert.ok(home.includes('Título Serviços Teste'));
  assert.ok(!home.includes('Serviços de imagem'));
});

test('R3-A5: bloco com status inválido falha na validação', () => {
  const dados = structuredClone(dadosBase);
  dados.paginas.paginas.home.blocos[0].status = 'rascunho';
  assert.ok(temCodigo(validar(dados), 'paginas.json:home.blocos[0].status:home'));
});

test('R3-A5: bloco pendente não publica F4 em produção, aparece no rascunho e no relatório', async () => {
  const producao = await paginasDe(dadosBase);
  const rascunho = await paginasDe(dadosBase, { rascunho: true });
  assert.ok(!producao.some((pagina) => pagina.rota === '/sobre/'));
  assert.ok(rascunho.some((pagina) => pagina.rota === '/sobre/'));

  const relatorio = gerarRelatorio({
    dados: dadosBase,
    publicacao: resolverPublicacao(dadosBase, { rascunho: false })
  });
  assert.ok(relatorio.json.blocosPendentes.some((bloco) => bloco.pagina === 'sobre'));

  const publicacao = resolverPublicacao(dadosBase, { rascunho: false });
  const erros = validarGoLive({
    dados: dadosBase,
    publicacao,
    rotas: planejarRotas(dadosBase, publicacao, { rascunho: false }).map((pagina) => pagina.rota)
  });
  assert.ok(erros.some((erro) => erro.codigo === 'paginas.json:blocos:sobre'));
});

test('R3-A6: go-live exige especialidade e rodapé não gera pontuação órfã', async () => {
  const dados = dadosComMatrizCompleta();
  dados.site.responsavelTecnico.especialidade = null;
  const publicacao = resolverPublicacao(dados, { rascunho: false });
  const erros = validarGoLive({
    dados,
    publicacao,
    rotas: planejarRotas(dados, publicacao, { rascunho: false }).map((pagina) => pagina.rota)
  });
  assert.ok(
    erros.some((erro) => erro.codigo === 'site.json:responsavelTecnico.especialidade:site')
  );

  const paginas = await paginasDe(dados);
  const home = htmlDaPagina(paginas, '/');
  assert.ok(!home.includes('CRM 12345/CE'));
  assert.ok(!home.includes('CRM 12345/CE. .'));

  dados.site.responsavelTecnico.especialidade = 'Radiologia';
  const comEspecialidade = htmlDaPagina(await paginasDe(dados), '/');
  assert.ok(comEspecialidade.includes('CRM 12345/CE. Radiologia'));
});

test('R3-A7: convênio exige atualizadoEm válido', () => {
  const dados = dadosComUnidadesAtivas();
  dados.convenios = {
    convenios: [{ id: 'unimed', nome: 'Unimed', exibirLogo: false, logoAutorizado: false }]
  };
  assert.ok(temCodigo(validar(dados), 'convenios.json:atualizadoEm:convenios'));

  dados.convenios.atualizadoEm = '2026-11-20';
  assert.ok(!temCodigo(validar(dados), 'convenios.json:atualizadoEm:convenios'));
});

test('R3-A8: noindex é detectado com atributos em qualquer ordem', () => {
  const erros = rodar(
    'artefato.producao',
    { 'index.html': '<meta content="noindex" name="robots">' },
    true
  );
  assert.ok(erros.some((erro) => erro.detalhe.includes('noindex')));
});

test('R3-A8: sitemap de produção não pode conter unidade de teste', () => {
  const erros = rodar(
    'artefato.producao',
    {
      'index.html': '<html></html>',
      'sitemap.xml':
        '<?xml version="1.0"?><urlset><url><loc>https://terradic.com.br/unidades/teste-centro/</loc></url></urlset>'
    },
    true,
    { slugsTeste: ['teste-centro'] }
  );
  assert.ok(erros.some((erro) => erro.detalhe.includes('unidade de teste "teste-centro"')));
});

test('R3-B: F4 gera sobre, convênios e contato no rascunho e não na produção pendente', async () => {
  const dados = dadosComUnidadesAtivas();
  const producao = await paginasDe(dados);
  const rascunho = await paginasDe(dados, { rascunho: true });
  for (const rota of ['/sobre/', '/convenios-e-particular/', '/contato/']) {
    assert.ok(!producao.some((pagina) => pagina.rota === rota));
    assert.ok(rascunho.some((pagina) => pagina.rota === rota));
  }
  const homeRascunho = htmlDaPagina(rascunho, '/');
  assert.ok(homeRascunho.includes('href="/sobre/"'));
  assert.ok(homeRascunho.includes('href="/contato/"'));
});

test('R3-B: /contato/ lista telefones de dados confirmados e não tem formulário', async () => {
  const paginas = await paginasDe(dadosComUnidadesAtivas(), { rascunho: true });
  const contato = htmlDaPagina(paginas, '/contato/');
  assert.ok(contato.includes('(85) 9000-0001'));
  assert.ok(!/<form|<input/i.test(contato));
});

test('R3-B: /convenios-e-particular/ mostra ressalva e data com lista preenchida', async () => {
  const dados = dadosComUnidadesAtivas();
  dados.convenios = {
    versao: 1,
    atualizadoEm: '2026-11-20',
    convenios: [
      { id: 'unimed', nome: 'Unimed', exibirLogo: false, logoAutorizado: false }
    ]
  };
  dados.unidades.unidades[0].convenios = ['unimed'];
  const paginas = await paginasDe(dados, { rascunho: true });
  const convenios = htmlDaPagina(paginas, '/convenios-e-particular/');
  assert.ok(convenios.includes('Unimed'));
  assert.match(convenios, /Lista atualizada em 20\/11\/2026/);
  assert.match(convenios, /cobertura junto à operadora/);
});

test('R3-B: /sobre/ exibe RT com CRM e especialidade quando confirmados', async () => {
  const dados = dadosComMatrizCompleta();
  const paginas = await paginasDe(dados, { rascunho: true });
  const sobre = htmlDaPagina(paginas, '/sobre/');
  assert.ok(sobre.includes('Dra. Teste'));
  assert.ok(sobre.includes('CRM 12345/CE. Radiologia'));
});

test('R3-B: privacidade é condicional a publicada e a blocos aprovados', async () => {
  const dados = structuredClone(dadosBase);
  dados.site.privacidade.politicaPublicada = true;
  const pendenteDraft = await paginasDe(dados, { rascunho: true });
  const pendenteProd = await paginasDe(dados);
  assert.ok(pendenteDraft.some((pagina) => pagina.rota === '/politica-de-privacidade/'));
  assert.ok(!pendenteProd.some((pagina) => pagina.rota === '/politica-de-privacidade/'));

  dados.paginas.paginas.privacidade.blocos.forEach((bloco) => {
    bloco.status = 'aprovado';
  });
  const aprovadaProd = await paginasDe(dados);
  assert.ok(aprovadaProd.some((pagina) => pagina.rota === '/politica-de-privacidade/'));
});


// ---------- Rodada 3.5: correções da revisão estática ----------

test('R35-M3: cross-check do telefone institucional não roda no rascunho', () => {
  const dados = dadosComUnidadesAtivas();
  dados.site.contatoInstitucional = {
    email: 'contato@terradic.invalid',
    telefoneE164: '+558599999999'
  };
  const errosRascunho = validarDados(dados, { exemplos, rascunho: true });
  assert.ok(!temCodigo(errosRascunho, 'site.json:contatoInstitucional.telefoneE164:site'));
  const errosProducao = validarDados(dados, { exemplos, rascunho: false });
  assert.ok(temCodigo(errosProducao, 'site.json:contatoInstitucional.telefoneE164:site'));
});

test('R35-M4: catálogo sem preparo aprovado tem bloqueio dedicado e não exige rota', () => {
  const dados = dadosComUnidadesAtivas();
  const publicacao = resolverPublicacao(dados, { rascunho: false });
  const erros = validarGoLive({
    dados,
    publicacao,
    rotas: planejarRotas(dados, publicacao, { rascunho: false }).map((pagina) => pagina.rota)
  });
  assert.ok(erros.some((erro) => erro.codigo === 'preparos.json:aprovados:site'));
  assert.ok(!erros.some((erro) => erro.codigo === 'rotas:/preparo-de-exames/:site'));
});

test('R35-M1: templates não contêm texto editorial longo fora de blocos', () => {
  const permitidos = new Set([
    'Pular para o conteúdo',
    'Portal de exames externo · abre em nova aba',
    'Abrir a localização no Google Maps',
    'VERSÃO DE REVISÃO — DADOS NÃO CONFIRMADOS.',
    'Identidade visual provisória, derivada de flyer de campanha. Não publicar.'
  ]);
  const achados = [];
  for (const [nome, html] of templates) {
    const semComentarios = html.replace(/<!--[\s\S]*?-->/g, ' ');
    for (const no of semComentarios.replace(/<[^>]+>/g, '\n').split('\n')) {
      const texto = no.replace(/\s+/g, ' ').trim();
      if (!texto || texto.includes('{{') || permitidos.has(texto)) {
        continue;
      }
      if (texto.length > 40) {
        achados.push(`${nome}: ${texto}`);
      }
    }
  }
  assert.deepEqual(achados, []);
});

test('R35-M2: NAP compara número, cidade e UF e falha se apenas o número mudar', async () => {
  const dados = dadosComMatrizCompleta();
  const publicacao = resolverPublicacao(dados, { rascunho: false });
  const home = htmlDaPagina(await paginasDe(dados), '/');
  const esperado = napEsperadoDe(dados, publicacao);

  const numeroErrado = home.replace('data-nap-numero="1200"', 'data-nap-numero="1201"');
  const errosNumero = rodar('nap.divergencia', { 'index.html': numeroErrado }, true, {
    napEsperado: esperado
  });
  assert.ok(errosNumero.some((erro) => erro.detalhe.includes('rodapé: numero')));

  const cidadeErrada = home.replace('data-nap-cidade="Fortaleza"', 'data-nap-cidade="Caucaia"');
  const errosCidade = rodar('nap.divergencia', { 'index.html': cidadeErrada }, true, {
    napEsperado: esperado
  });
  assert.ok(errosCidade.some((erro) => erro.detalhe.includes('rodapé: cidade')));
});

test('R35-M5: ressalva de convênios sem lista não afirma data de atualização', async () => {
  const dados = dadosComUnidadesAtivas();
  dados.convenios = { versao: 1, atualizadoEm: '2026-11-20', convenios: [] };
  const html = htmlDaPagina(await paginasDe(dados, { rascunho: true }), '/unidades/teste-centro/');
  assert.ok(html.includes('Confirme com a unidade'));
  assert.ok(!html.includes('Lista atualizada em'));
});

test('R35-B2: noindex é detectado em googlebot, bingbot e com NOINDEX', () => {
  const googlebot = rodar(
    'artefato.producao',
    { 'index.html': '<meta name="googlebot" content="NOINDEX">' },
    true
  );
  assert.ok(googlebot.some((erro) => erro.detalhe.includes('noindex')));

  const bingbot = rodar(
    'artefato.producao',
    { 'index.html': '<meta content="noindex" name="bingbot">' },
    true
  );
  assert.ok(bingbot.some((erro) => erro.detalhe.includes('noindex')));

  const segundaMeta = rodar(
    'artefato.producao',
    {
      'index.html':
        '<meta name="robots" content="index, follow"><meta name="robots" content="NOINDEX">'
    },
    true
  );
  assert.ok(segundaMeta.some((erro) => erro.detalhe.includes('noindex')));
});

test('R35-B3: nap.divergencia percorre todas as ocorrências de data-nap-escopo', async () => {
  const dados = dadosComMatrizCompleta();
  const publicacao = resolverPublicacao(dados, { rascunho: false });
  const home = htmlDaPagina(await paginasDe(dados), '/');
  const esperado = napEsperadoDe(dados, publicacao);
  const segundoTelefone =
    '<p data-nap-escopo="institucional" data-nap-telefone="+558590000099"><a href="tel:+558590000099">(85) 9000-0099</a></p>';
  const erros = rodar(
    'nap.divergencia',
    { 'index.html': home + segundoTelefone },
    true,
    { napEsperado: esperado }
  );
  assert.ok(erros.some((erro) => erro.detalhe.includes('telefone institucional')));
});

test('R35-B4: C-10/C-12 são calculados e o relatório não repete F4 como não implementada', () => {
  const dados = dadosComUnidadesAtivas();
  dados.paginas.paginas.sobre.blocos.forEach((bloco) => {
    bloco.status = 'aprovado';
  });
  const relatorio = gerarRelatorio({
    dados,
    publicacao: resolverPublicacao(dados, { rascunho: false })
  });
  assert.equal(relatorio.json.bloqueios.find((item) => item.id === 'C-10').pendente, false);
  assert.equal(relatorio.json.bloqueios.find((item) => item.id === 'C-12').pendente, false);
  assert.ok(!relatorio.markdown.includes('Fase 4 / T033-T035 não implementada'));
});

test('R35-B4: C-11 e C-14 passam a bloquear o go-live', () => {
  const publicacao = resolverPublicacao(dadosBase, { rascunho: false });
  const erros = validarGoLive({
    dados: dadosBase,
    publicacao,
    rotas: planejarRotas(dadosBase, publicacao, { rascunho: false }).map((pagina) => pagina.rota)
  });
  assert.ok(erros.some((erro) => erro.codigo === 'site.json:identidadeVisual.status:site'));
  assert.ok(erros.some((erro) => erro.codigo === 'site.json:privacidade.politicaPublicada:site'));
});

test('R35-B5: rodapé usa o telefone principal explícito da matriz', async () => {
  const dados = dadosComMatrizCompleta();
  const home = htmlDaPagina(await paginasDe(dados), '/');
  assert.ok(home.includes('(85) 9000-0001'));
  assert.ok(!home.includes('(85) 9000-0002</a>'));

  const duplicado = structuredClone(dados);
  duplicado.unidades.unidades[0].telefones[1].principal = true;
  const publicacao = resolverPublicacao(duplicado, { rascunho: false });
  const erros = validarGoLive({
    dados: duplicado,
    publicacao,
    rotas: planejarRotas(duplicado, publicacao, { rascunho: false }).map((pagina) => pagina.rota)
  });
  assert.ok(erros.some((erro) => erro.codigo === 'unidades.json:telefones:teste-centro'));

  const semPrincipal = structuredClone(dados);
  semPrincipal.unidades.unidades[0].telefones.forEach((telefone) => {
    telefone.principal = false;
  });
  const publicacaoSem = resolverPublicacao(semPrincipal, { rascunho: false });
  const errosSem = validarGoLive({
    dados: semPrincipal,
    publicacao: publicacaoSem,
    rotas: planejarRotas(semPrincipal, publicacaoSem, { rascunho: false }).map((pagina) => pagina.rota)
  });
  assert.ok(errosSem.some((erro) => erro.codigo === 'unidades.json:telefones:teste-centro'));
});


// ---------- Rodada 4: F5/F6 ----------

test('R4-F5: metadados completos e únicos em todas as rotas do rascunho', async () => {
  const paginas = await paginasDe(dadosComUnidadesAtivas(), { rascunho: true });
  const titulos = new Set();
  const descricoes = new Set();
  for (const pagina of paginas) {
    const html = pagina.html;
    const titulo = decodificarHtml(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '').trim();
    const descricao = decodificarHtml(
      html.match(/<meta name="description" content="([^"]*)">/)?.[1] ?? ''
    ).trim();
    assert.ok(titulo.length > 0 && titulo.length <= 60, `${pagina.rota}: title ${titulo.length}`);
    assert.ok(
      descricao.length >= 120 && descricao.length <= 160,
      `${pagina.rota}: description ${descricao.length}`
    );
    assert.ok(!titulos.has(titulo), `title repetido: ${titulo}`);
    assert.ok(!descricoes.has(descricao), `description repetida: ${descricao}`);
    titulos.add(titulo);
    descricoes.add(descricao);

    const canonical = `${URL_BASE}${pagina.rota === '/' ? '/' : pagina.rota}`;
    assert.ok(html.includes(`rel="canonical" href="${canonical}"`), `${pagina.rota}: canonical`);
    for (const propriedade of ['og:title', 'og:description', 'og:image', 'og:url', 'og:type']) {
      assert.ok(html.includes(`property="${propriedade}"`), `${pagina.rota}: ${propriedade}`);
    }
    assert.ok(html.includes('property="og:locale" content="pt_BR"'));
    assert.ok(html.includes('name="twitter:card" content="summary_large_image"'));

    const imagemEsperada =
      pagina.rota === '/'
        ? 'og-home.png'
        : pagina.rota.startsWith('/unidades')
          ? 'og-unidade.png'
          : pagina.rota.startsWith('/servicos')
            ? 'og-servico.png'
            : pagina.rota.startsWith('/preparo-de-exames')
              ? 'og-preparo.png'
              : 'og-institucional.png';
    assert.ok(html.includes(`/assets/${imagemEsperada}`), `${pagina.rota}: og:image`);
  }
  assert.ok(paginas.length >= 6);
});

test('R4-F5: imagens OG existem, são 1200x630 e pesam menos de 200 KB', async () => {
  for (const nome of [
    'og-home.png',
    'og-unidade.png',
    'og-servico.png',
    'og-preparo.png',
    'og-institucional.png'
  ]) {
    const buffer = await readFile(path.join(RAIZ, 'src', 'estatico', 'assets', nome));
    assert.ok(buffer.length <= 200 * 1024, `${nome}: ${buffer.length} bytes`);
    assert.equal(buffer.readUInt32BE(16), 1200, `${nome}: largura`);
    assert.equal(buffer.readUInt32BE(20), 630, `${nome}: altura`);
  }
});

test('R4-F5: JSON-LD final sem propriedades proibidas e com tipos por página', async () => {
  const paginas = await paginasDe(dadosComUnidadesAtivas(), { rascunho: true });
  const proibidos = ['aggregateRating', 'review', 'priceRange', 'offers', 'Offer', 'price'];
  for (const pagina of paginas) {
    const bruto = pagina.html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
    assert.ok(bruto, `${pagina.rota}: JSON-LD ausente`);
    const grafo = JSON.parse(bruto);
    assert.equal(grafo['@context'], 'https://schema.org');
    assert.ok(Array.isArray(grafo['@graph']));
    const texto = JSON.stringify(grafo);
    for (const proibido of proibidos) {
      assert.ok(!texto.includes(`"${proibido}"`), `${pagina.rota}: JSON-LD contém ${proibido}`);
    }
    const tipos = grafo['@graph'].map((no) => no['@type']);
    assert.ok(tipos.includes('Organization'), `${pagina.rota}: Organization`);
    if (pagina.rota === '/') {
      assert.ok(tipos.includes('WebSite'));
    } else {
      assert.ok(!tipos.includes('WebSite'), `${pagina.rota}: WebSite fora da home`);
      assert.ok(tipos.includes('BreadcrumbList'), `${pagina.rota}: BreadcrumbList`);
    }
    if (
      (pagina.rota.startsWith('/servicos/') && pagina.rota !== '/servicos/') ||
      pagina.rota.startsWith('/preparo-de-exames/')
    ) {
      assert.ok(tipos.includes('MedicalWebPage'), `${pagina.rota}: MedicalWebPage`);
    }
  }
});

test('R4-F5: Organization usa legalName, taxID e sameAs quando houver redes', async () => {
  const dados = structuredClone(dadosComUnidadesAtivas());
  dados.site.redesSociais.instagram = 'https://www.instagram.com/terradic';
  const home = htmlDaPagina(await paginasDe(dados, { rascunho: true }), '/');
  const grafo = JSON.parse(
    home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1]
  );
  const organizacao = grafo['@graph'].find((no) => no['@type'] === 'Organization');
  assert.equal(organizacao.legalName, dados.site.marca.razaoSocial);
  assert.equal(organizacao.taxID, dados.site.marca.cnpj);
  assert.ok(organizacao.sameAs.includes('https://www.instagram.com/terradic'));
});

test('R4-F5: MedicalClinic completa e geo condicional', async () => {
  const dados = dadosComMatrizCompleta();
  const paginas = await paginasDe(dados);
  const unidade = htmlDaPagina(paginas, '/unidades/teste-centro/');
  const grafo = JSON.parse(
    unidade.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1]
  );
  const clinica = grafo['@graph'].find((no) => no['@type'] === 'MedicalClinic');
  assert.ok(clinica);
  assert.ok(clinica.address.streetAddress);
  assert.equal(clinica.address.addressLocality, 'Fortaleza');
  assert.equal(clinica.telephone, '+558590000001');
  assert.ok(clinica.openingHoursSpecification.length > 0);
  assert.ok(clinica.availableService.some((servico) => servico.name === 'Tomografia computadorizada'));
  assert.ok(clinica.parentOrganization);
  assert.ok(clinica.areaServed);
  assert.ok(!Object.hasOwn(clinica, 'medicalSpecialty'));
  assert.ok(clinica.geo);

  const semGeo = dadosComUnidadesAtivas();
  semGeo.unidades.unidades[1].geo = { lat: null, lng: null, precisao: 'aproximada' };
  const paginasSemGeo = await paginasDe(semGeo, { rascunho: true });
  const unidadeSemGeo = htmlDaPagina(paginasSemGeo, '/unidades/teste-litoral/');
  const grafoSemGeo = JSON.parse(
    unidadeSemGeo.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1]
  );
  const clinicaSemGeo = grafoSemGeo['@graph'].find((no) => no['@type'] === 'MedicalClinic');
  assert.equal(clinicaSemGeo.geo, undefined);
});

test('R4-F5: internal linking atinge todas as rotas em até 2 cliques', async () => {
  const paginas = await paginasDe(dadosComUnidadesAtivas(), { rascunho: true });
  const rotas = new Set(paginas.map((pagina) => pagina.rota));
  const links = new Map();
  for (const pagina of paginas) {
    const destinos = [...pagina.html.matchAll(/href="(\/[^"]*)"/g)]
      .map((resultado) => resultado[1].split('#')[0].split('?')[0])
      .filter((href) => href && !href.startsWith('/assets/') && href !== '/404.html');
    for (const href of destinos) {
      assert.ok(rotas.has(href), `${pagina.rota}: link para rota não gerada ${href}`);
    }
    links.set(pagina.rota, destinos);
  }

  const visitados = new Map([['/', 0]]);
  let fila = ['/'];
  while (fila.length > 0) {
    const proxima = [];
    for (const rota of fila) {
      const profundidade = visitados.get(rota);
      for (const destino of links.get(rota) ?? []) {
        if (!visitados.has(destino)) {
          visitados.set(destino, profundidade + 1);
          proxima.push(destino);
        }
      }
    }
    fila = proxima;
  }
  for (const rota of rotas) {
    if (rota === '/404.html') continue;
    assert.ok(visitados.has(rota), `${rota}: inalcançável a partir da home`);
    assert.ok(visitados.get(rota) <= 2, `${rota}: profundidade ${visitados.get(rota)}`);
  }

  const home = htmlDaPagina(paginas, '/');
  for (const unidade of resolverPublicacao(dadosComUnidadesAtivas(), { rascunho: true }).unidades) {
    assert.ok(home.includes(`/unidades/${unidade.slug}/`), `rodapé/home sem ${unidade.slug}`);
  }
});

test('R4-F5: staging recebe noindex e robots próprio; produção não', async () => {
  const dados = dadosComMatrizCompleta();
  const stagingUrl = 'https://staging.terradic.com.br';
  const paginas = await gerarPaginas({
    dados,
    publicacao: resolverPublicacao(dados, { rascunho: false }),
    templates,
    urlBase: stagingUrl,
    rascunho: false
  });
  for (const pagina of paginas) {
    assert.ok(pagina.html.includes('<meta name="robots" content="noindex, follow">'), pagina.rota);
    assert.ok(pagina.html.includes(`href="${stagingUrl}${pagina.rota}"`), pagina.rota);
  }
  const robotsStaging = gerarRobots(stagingUrl);
  assert.ok(robotsStaging.includes('Disallow: /'));
  assert.ok(gerarRobots(URL_BASE).includes('Allow: /'));

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?><urlset><url><loc>${stagingUrl}/</loc><lastmod>2026-11-20</lastmod></url></urlset>`;
  const erros = checarSitemap({
    arquivos: new Map([
      ['sitemap.xml', sitemap],
      ['robots.txt', robotsStaging]
    ]),
    rotas: ['/'],
    urlBase: stagingUrl,
    staging: true
  });
  assert.deepEqual(erros, []);
});

test('R4-F6: preparo e mapa funcionam sem JavaScript', async () => {
  const paginas = await paginasDe(dadosComUnidadesAtivas(), { rascunho: true });
  const preparo = htmlDaPagina(paginas, '/preparo-de-exames/');
  assert.ok(preparo.includes('<details'));
  assert.ok(preparo.includes('<summary'));
  const unidade = htmlDaPagina(paginas, '/unidades/teste-centro/');
  assert.ok(unidade.includes('Abrir a localização no Google Maps'));
  assert.ok(unidade.includes('Carregar mapa nesta página'));
  const semScripts = preparo.replace(/<script[\s\S]*?<\/script>/g, '');
  assert.ok(semScripts.includes('Preparo de exames'));
  assert.ok(semScripts.includes('<details'));
});

// ---------- Rodada 4: garantias do QA ----------

test('R4-QA: sitemap exige lastmod por URL', () => {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?><urlset>
  <url><loc>${URL_BASE}/</loc><lastmod>2026-11-20</lastmod></url>
  <url><loc>${URL_BASE}/unidades/</loc><lastmod>null</lastmod></url>
</urlset>`;
  const erros = checarSitemap({
    arquivos: new Map([
      ['sitemap.xml', sitemap],
      ['robots.txt', gerarRobots(URL_BASE)]
    ]),
    rotas: ['/', '/unidades/'],
    urlBase: URL_BASE
  });
  const lastmod = erros.filter((erro) => erro.detalhe.includes('lastmod'));
  assert.equal(lastmod.length, 1);
  assert.ok(lastmod[0].detalhe.includes(`${URL_BASE}/unidades/`));
});

test('R4-QA: sitemap reprova url sem loc e sem lastmod', () => {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?><urlset>
  <url><lastmod>2026-11-20</lastmod></url>
  <url><loc>${URL_BASE}/sobre/</loc></url>
</urlset>`;
  const erros = checarSitemap({
    arquivos: new Map([
      ['sitemap.xml', sitemap],
      ['robots.txt', gerarRobots(URL_BASE)]
    ]),
    rotas: ['/sobre/'],
    urlBase: URL_BASE
  });
  assert.ok(erros.some((erro) => erro.detalhe.includes('<loc> ausente')));
  assert.ok(
    erros.some(
      (erro) =>
        erro.detalhe.includes(`${URL_BASE}/sobre/`) && erro.detalhe.includes('lastmod')
    )
  );
});

test('R4-QA: gerarSitemap inclui loc e lastmod por rota e omite 404', () => {
  const sitemap = gerarSitemap(
    [
      { rota: '/', lastmod: '2026-11-20' },
      { rota: '/unidades/', lastmod: '2026-11-21' },
      { rota: '/404.html', lastmod: '2026-11-20' }
    ],
    URL_BASE
  );
  assert.equal((sitemap.match(/<url>/g) ?? []).length, 2);
  assert.ok(sitemap.includes(`<loc>${URL_BASE}/</loc>`));
  assert.ok(sitemap.includes(`<loc>${URL_BASE}/unidades/</loc>`));
  assert.ok(sitemap.includes('<lastmod>2026-11-21</lastmod>'));
  assert.ok(!sitemap.includes('/404.html'));
});

test('R4-QA: validador exige atualizadoEm no topo dos arquivos usados', () => {
  const casos = [
    ['paginas', 'paginas.json', 'topo'],
    ['servicos', 'servicos.json', 'topo'],
    ['preparos', 'preparos.json', 'topo'],
    ['unidades', 'unidades.json', 'topo']
  ];
  for (const [chave, arquivo, entidade] of casos) {
    const dados = structuredClone(dadosBase);
    delete dados[chave].atualizadoEm;
    assert.ok(temCodigo(validar(dados), `${arquivo}:atualizadoEm:${entidade}`), arquivo);
  }
});

test('R4-QA: convenios.atualizadoEm so e exigido quando ha convenio', () => {
  const vazio = structuredClone(dadosBase);
  vazio.convenios = { versao: 1, convenios: [] };
  assert.ok(!temCodigo(validar(vazio), 'convenios.json:atualizadoEm:convenios'));

  const comItem = structuredClone(dadosBase);
  comItem.convenios = {
    versao: 1,
    convenios: [{ id: 'unimed', nome: 'Unimed', exibirLogo: false, logoAutorizado: false }]
  };
  assert.ok(temCodigo(validar(comItem), 'convenios.json:atualizadoEm:convenios'));
});

test('R4-QA: geo exige precisao e fontes para entrar no JSON-LD', async () => {
  const dados = dadosComMatrizCompleta();
  const unidade = dados.unidades.unidades[0];
  unidade.geo = { lat: -3.7319, lng: -38.5267 };
  assert.ok(temCodigo(validar(dados), 'unidades.json:geo.precisao:teste-centro'));
  const semPrecisao = await paginasDe(dados);
  const clinicaSemPrecisao = jsonLdDaPagina(
    htmlDaPagina(semPrecisao, '/unidades/teste-centro/')
  )['@graph'].find((no) => no['@type'] === 'MedicalClinic');
  assert.equal(clinicaSemPrecisao.geo, undefined);

  unidade.geo.precisao = 'aproximada';
  const fontes = unidade.validacao.fontes;
  unidade.validacao.fontes = [];
  const semFonte = await paginasDe(dados, { rascunho: true });
  const clinicaSemFonte = jsonLdDaPagina(
    htmlDaPagina(semFonte, '/unidades/teste-centro/')
  )['@graph'].find((no) => no['@type'] === 'MedicalClinic');
  assert.equal(clinicaSemFonte.geo, undefined);

  unidade.validacao.fontes = fontes;
  const comGeo = await paginasDe(dados);
  const clinicaComGeo = jsonLdDaPagina(
    htmlDaPagina(comGeo, '/unidades/teste-centro/')
  )['@graph'].find((no) => no['@type'] === 'MedicalClinic');
  assert.deepEqual(clinicaComGeo.geo, {
    '@type': 'GeoCoordinates',
    latitude: -3.7319,
    longitude: -38.5267
  });
});

test('R4-QA: diretorio de saida separa producao, rascunho e staging', () => {
  const staging = 'https://staging.terradic.com.br';
  assert.equal(diretorioDeSaida(), 'dist');
  assert.equal(diretorioDeSaida({ urlBase: URL_BASE }), 'dist');
  assert.equal(diretorioDeSaida({ urlBase: staging }), 'dist-staging');
  assert.equal(diretorioDeSaida({ rascunho: true, urlBase: staging }), 'dist-rascunho');
});

test('R4-QA: fingerprint detecta mudanca em arquivo binario', async () => {
  const diretorio = await mkdtemp(path.join(os.tmpdir(), 'terradic-fingerprint-'));
  try {
    await writeFile(path.join(diretorio, 'og.png'), Buffer.from([0, 1, 2, 3]));
    const antes = await fotografiaDiretorio(diretorio);
    await writeFile(path.join(diretorio, 'og.png'), Buffer.from([0, 1, 2, 4]));
    const depois = await fotografiaDiretorio(diretorio);
    assert.notEqual(antes, depois);
  } finally {
    await rm(diretorio, { recursive: true, force: true });
  }
});

test('R4-QA: JSON-LD interno tem isPartOf e nao usa SearchAction', async () => {
  const paginas = await paginasDe(dadosComMatrizCompleta());
  for (const pagina of paginas) {
    const grafo = jsonLdDaPagina(pagina.html);
    assert.ok(grafo, pagina.rota);
    assert.ok(!JSON.stringify(grafo).includes('SearchAction'), pagina.rota);
    const tipos = grafo['@graph'].map((no) => no['@type']);
    if (pagina.rota === '/') {
      assert.ok(tipos.includes('WebSite'), 'home: WebSite');
      continue;
    }
    assert.ok(!tipos.includes('WebSite'), `${pagina.rota}: WebSite fora da home`);
    const nosPagina = grafo['@graph'].filter(
      (no) => no['@type'] === 'WebPage' || no['@type'] === 'MedicalWebPage'
    );
    assert.ok(nosPagina.length > 0, `${pagina.rota}: WebPage/MedicalWebPage`);
    for (const no of nosPagina) {
      assert.deepEqual(no.isPartOf, { '@id': `${URL_BASE}/#site` }, `${pagina.rota}: isPartOf`);
    }
  }
});

test('R4-QA: serializarJsonLd escapa fechamento de script', () => {
  const json = serializarJsonLd([{ texto: '</script>' }]);
  assert.ok(json.includes('\\u003c/script>'));
  assert.ok(!json.includes('</script>'));
});

test('R4-QA: conteudo liga servico, unidade e preparo', async () => {
  const paginas = await paginasDe(dadosComMatrizCompleta());
  const servico = conteudoPrincipal(htmlDaPagina(paginas, '/servicos/tomografia/'));
  assert.ok(servico.includes('href="/unidades/teste-centro/"'));
  assert.ok(servico.includes('href="/preparo-de-exames/#tomografia-sem-contraste"'));
  const unidade = conteudoPrincipal(htmlDaPagina(paginas, '/unidades/teste-centro/'));
  assert.ok(unidade.includes('href="/servicos/tomografia/"'));
  const preparo = conteudoPrincipal(htmlDaPagina(paginas, '/preparo-de-exames/'));
  assert.ok(preparo.includes('href="/servicos/tomografia/"'));
});

test('R4-QA: og:image de cada rota existe em src/estatico/assets', async () => {
  const paginas = await paginasDe(dadosComUnidadesAtivas(), { rascunho: true });
  for (const pagina of paginas) {
    const imagem = pagina.html.match(/<meta property="og:image" content="([^"]+)">/)?.[1];
    assert.ok(imagem, pagina.rota);
    assert.ok(imagem.startsWith(`${URL_BASE}/assets/`), pagina.rota);
    const nome = imagem.slice(`${URL_BASE}/assets/`.length);
    await readFile(path.join(RAIZ, 'src', 'estatico', 'assets', nome));
  }
});

test('R4-QA: staging tem noindex e producao tem index nas paginas publicaveis', async () => {
  const dados = dadosComMatrizCompleta();
  const stagingUrl = 'https://staging.terradic.com.br';
  const staging = await gerarPaginas({
    dados,
    publicacao: resolverPublicacao(dados, { rascunho: false }),
    templates,
    urlBase: stagingUrl,
    rascunho: false
  });
  for (const pagina of staging) {
    assert.ok(
      pagina.html.includes('<meta name="robots" content="noindex, follow">'),
      `${pagina.rota}: staging`
    );
  }

  const producao = await paginasDe(dados);
  for (const pagina of producao) {
    const esperado = pagina.rota === '/404.html' ? 'noindex, follow' : 'index, follow';
    assert.ok(
      pagina.html.includes(`<meta name="robots" content="${esperado}">`),
      `${pagina.rota}: ${esperado}`
    );
  }
});

// ---------- Preview no GitHub Pages ----------

test('R4-QA: prefixarHtml reescreve href/src root-relative e preserva absolutos', () => {
  const base = normalizarBase('clinica-terradic/');
  assert.equal(base, '/clinica-terradic');
  const html = [
    '<a href="/">home</a>',
    '<a href="/unidades/">unidades</a>',
    '<a href="/#topo">topo</a>',
    '<a href="#ancora">ancora</a>',
    '<a href="https://exemplo.com/">externo</a>',
    '<a href="//cdn.exemplo.com/x">cdn</a>',
    '<a href="mailto:contato@exemplo.com">mail</a>',
    '<a href="tel:+558500000000">tel</a>',
    '<a href="data:text/plain,ok">dados</a>',
    '<img src="/assets/foto.png">',
    '<link rel="canonical" href="https://owner.github.io/clinica-terradic/">',
    '<meta property="og:image" content="https://owner.github.io/clinica-terradic/assets/og.png">'
  ].join('');

  const resultado = prefixarHtml(html, base);
  assert.equal(resultado.reescritas, 4);
  assert.ok(resultado.html.includes('href="/clinica-terradic/"'));
  assert.ok(resultado.html.includes('href="/clinica-terradic/unidades/"'));
  assert.ok(resultado.html.includes('href="/clinica-terradic/#topo"'));
  assert.ok(resultado.html.includes('src="/clinica-terradic/assets/foto.png"'));
  assert.ok(resultado.html.includes('href="#ancora"'));
  assert.ok(resultado.html.includes('href="https://exemplo.com/"'));
  assert.ok(resultado.html.includes('href="//cdn.exemplo.com/x"'));
  assert.ok(resultado.html.includes('href="mailto:contato@exemplo.com"'));
  assert.ok(resultado.html.includes('href="tel:+558500000000"'));
  assert.ok(resultado.html.includes('href="data:text/plain,ok"'));
  assert.ok(
    resultado.html.includes('rel="canonical" href="https://owner.github.io/clinica-terradic/"')
  );
  assert.ok(
    resultado.html.includes('content="https://owner.github.io/clinica-terradic/assets/og.png"')
  );

  const segunda = prefixarHtml(resultado.html, base);
  assert.equal(segunda.reescritas, 0);
  assert.equal(segunda.html, resultado.html);
});

test('R4-QA: prefixar base valida destinos e falha em links sem prefixo', async () => {
  const diretorio = await mkdtemp(path.join(os.tmpdir(), 'terradic-prefixo-'));
  try {
    await mkdir(path.join(diretorio, 'sobre'), { recursive: true });
    await mkdir(path.join(diretorio, 'assets'), { recursive: true });
    await writeFile(
      path.join(diretorio, 'index.html'),
      '<a href="/sobre/">sobre</a><img src="/assets/foto.png">'
    );
    await writeFile(path.join(diretorio, 'sobre', 'index.html'), '<a href="/">home</a>');
    await writeFile(path.join(diretorio, 'assets', 'foto.png'), Buffer.from([0]));

    const prefixado = await prefixarDiretorio(diretorio, '/clinica-terradic');
    assert.ok(prefixado.reescritas > 0);
    const valido = await validarArtefato(diretorio, '/clinica-terradic');
    assert.deepEqual(valido.erros, []);
    assert.ok(valido.validados >= 3);

    await writeFile(
      path.join(diretorio, 'index.html'),
      '<a href="/sem-prefixo/">restante</a>'
    );
    const semPrefixo = await validarArtefato(diretorio, '/clinica-terradic');
    assert.ok(semPrefixo.erros.some((erro) => erro.includes('sem prefixo')));

    await writeFile(
      path.join(diretorio, 'index.html'),
      '<a href="/clinica-terradic/ausente/">restante</a>'
    );
    const inexistente = await validarArtefato(diretorio, '/clinica-terradic');
    assert.ok(inexistente.erros.some((erro) => erro.includes('destino inexistente')));
  } finally {
    await rm(diretorio, { recursive: true, force: true });
  }
});

test('R4-QA: normalizarBase rejeita esquema, // e ..', () => {
  for (const base of [
    'https://owner.github.io/clinica-terradic',
    'http:clinica-terradic',
    '//owner.github.io/clinica-terradic',
    '/clinica/../terradic'
  ]) {
    assert.throws(() => normalizarBase(base), base);
  }
});

test('R4-QA: validarArtefato detecta atributos e links nao suportados', async () => {
  const diretorio = await mkdtemp(path.join(os.tmpdir(), 'terradic-prefixo-'));
  const casos = [
    ['srcset.html', '<img srcset="/assets/foto.png 1x">', 'srcset'],
    ['action.html', '<form action="/enviar"></form>', 'action'],
    ['url.html', '<div style="background:url(/assets/foto.png)"></div>', 'url(/...)'],
    ['href-sem-aspas.html', '<a href=/sobre/>x</a>', 'sem aspas'],
    ['src-sem-aspas.html', '<img src=/assets/foto.png>', 'sem aspas']
  ];
  try {
    for (const [nome, html, esperado] of casos) {
      const arquivo = path.join(diretorio, nome);
      await writeFile(arquivo, html);
      const resultado = await validarArtefato(diretorio, '/clinica-terradic');
      assert.ok(
        resultado.erros.some((erro) => erro.includes(esperado)),
        `${nome}: ${esperado}`
      );
      await rm(arquivo);
    }
  } finally {
    await rm(diretorio, { recursive: true, force: true });
  }
});
