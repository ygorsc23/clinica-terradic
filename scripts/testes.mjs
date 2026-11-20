import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

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
