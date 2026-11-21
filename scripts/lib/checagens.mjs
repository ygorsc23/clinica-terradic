import { gzipSync } from 'node:zlib';

export const DOMINIO_PORTAL = 'https://entregadeexames.com.br/';

const ORCAMENTO_JS_GZIP = 10 * 1024;
const ORCAMENTO_CSS_GZIP = 25 * 1024;

const CLAIMS_PROIBIDOS = [
  'resultados precisos',
  'resultado preciso',
  'resultados garantidos',
  'resultado garantido',
  'garantia de resultado',
  'diagnóstico preciso',
  'diagnóstico garantido',
  'precisão garantida',
  'melhor da região',
  'melhor da cidade',
  'melhores exames',
  'líder da região',
  'líder no estado',
  'referência no estado',
  'excelência',
  'pioneir',
  'tecnologia de ponta',
  'sem dor',
  'indolor',
  'antes e depois',
  'antes/depois'
];

const TEXTOS_PROIBIDOS = [
  { regex: /placeholder/i, rotulo: 'placeholder' },
  { regex: /lorem/i, rotulo: 'lorem' },
  { regex: /\bTODO\b/, rotulo: 'TODO' },
  { regex: /\[CONFIRMAR\]/i, rotulo: '[CONFIRMAR]' },
  { regex: /CONFIRMAR/, rotulo: 'CONFIRMAR' },
  { regex: /a definir/i, rotulo: 'a definir' },
  { regex: /exemplo@/i, rotulo: 'exemplo@' },
  { regex: /\bXXX\b/, rotulo: 'XXX' }
];

function htmls(arquivos) {
  return [...arquivos.entries()].filter(([nome]) => nome.endsWith('.html'));
}

export function rotaDoArquivo(nome) {
  if (nome === 'index.html') {
    return '/';
  }
  if (nome === '404.html') {
    return '/404.html';
  }
  if (nome.endsWith('/index.html')) {
    return `/${nome.slice(0, -'index.html'.length)}`;
  }
  return `/${nome}`;
}

function decodificar(texto) {
  return texto
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function adicionar(erros, regra, arquivo, detalhe) {
  erros.push({ regra, arquivo, detalhe });
}

/**
 * Normalizacao documentada no README:
 * - texto visivel: entidades decodificadas, sem acentos, minusculo, pontuacao
 *   trocada por espaco e espacos colapsados;
 * - CEP e telefone: apenas digitos; o telefone descarta o prefixo 55 do E.164.
 */
function normalizarTexto(valor) {
  return decodificar(String(valor ?? ''))
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizarDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

function normalizarTelefone(valor) {
  const digitos = normalizarDigitos(valor);
  return digitos.length > 11 && digitos.startsWith('55') ? digitos.slice(2) : digitos;
}

function metaRobots(conteudo) {
  const tags = conteudo.match(/<meta\b[^>]*>/gi) ?? [];
  const valores = [];
  for (const tag of tags) {
    const nome = (tag.match(/\bname\s*=\s*["']([^"']+)["']/i)?.[1] ?? '').toLowerCase();
    if (!['robots', 'googlebot', 'bingbot'].includes(nome)) {
      continue;
    }
    valores.push(tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1] ?? '');
  }
  return valores;
}

function compararEnderecoNap({ erros, arquivo, bloco, esperado, rotulo, clinica = null }) {
  const tag = bloco.match(/<address\b[^>]*>/)?.[0] ?? '';
  const nome = extrairAtributo(tag, 'data-nap-nome');
  const logradouro = extrairAtributo(tag, 'data-nap-logradouro');
  const numero = extrairAtributo(tag, 'data-nap-numero');
  const bairro = extrairAtributo(tag, 'data-nap-bairro');
  const cep = extrairAtributo(tag, 'data-nap-cep');
  const cidade = extrairAtributo(tag, 'data-nap-cidade');
  const uf = extrairAtributo(tag, 'data-nap-uf');
  const telefone = extrairAtributo(tag, 'data-nap-telefone');

  if (esperado) {
    if (esperado.nome && nome !== esperado.nome) {
      adicionar(erros, 'nap.divergencia', arquivo, `${rotulo}: nome difere entre HTML ("${nome}") e dados ("${esperado.nome}")`);
    }
    if (esperado.logradouro && logradouro !== esperado.logradouro) {
      adicionar(erros, 'nap.divergencia', arquivo, `${rotulo}: logradouro difere entre HTML ("${logradouro}") e dados ("${esperado.logradouro}")`);
    }
    if (esperado.numero && numero !== esperado.numero) {
      adicionar(erros, 'nap.divergencia', arquivo, `${rotulo}: numero difere entre HTML ("${numero}") e dados ("${esperado.numero}")`);
    }
    if (esperado.bairro && bairro !== esperado.bairro) {
      adicionar(erros, 'nap.divergencia', arquivo, `${rotulo}: bairro difere entre HTML ("${bairro}") e dados ("${esperado.bairro}")`);
    }
    if (esperado.cep && normalizarDigitos(cep) !== normalizarDigitos(esperado.cep)) {
      adicionar(erros, 'nap.divergencia', arquivo, `${rotulo}: CEP difere entre HTML ("${cep}") e dados ("${esperado.cep}")`);
    }
    if (esperado.cidade && normalizarTexto(cidade) !== normalizarTexto(esperado.cidade)) {
      adicionar(erros, 'nap.divergencia', arquivo, `${rotulo}: cidade difere entre HTML ("${cidade}") e dados ("${esperado.cidade}")`);
    }
    if (esperado.uf && normalizarTexto(uf) !== normalizarTexto(esperado.uf)) {
      adicionar(erros, 'nap.divergencia', arquivo, `${rotulo}: UF difere entre HTML ("${uf}") e dados ("${esperado.uf}")`);
    }
  }

  if (clinica) {
    if (clinica.name !== nome) {
      adicionar(erros, 'nap.divergencia', arquivo, `nome difere entre HTML ("${nome}") e JSON-LD ("${clinica.name}")`);
    }
    if (cep && normalizarDigitos(clinica.address?.postalCode) !== normalizarDigitos(cep)) {
      adicionar(
        erros,
        'nap.divergencia',
        arquivo,
        `CEP difere entre HTML ("${cep}") e JSON-LD ("${clinica.address?.postalCode ?? ''}")`
      );
    }
    if (telefone && normalizarTelefone(clinica.telephone) !== normalizarTelefone(telefone)) {
      adicionar(
        erros,
        'nap.divergencia',
        arquivo,
        `telefone difere entre HTML ("${telefone}") e JSON-LD ("${clinica.telephone ?? ''}")`
      );
    }
    if (logradouro && !String(clinica.address?.streetAddress ?? '').startsWith(logradouro)) {
      adicionar(
        erros,
        'nap.divergencia',
        arquivo,
        'logradouro do HTML não corresponde ao streetAddress do JSON-LD'
      );
    }
    if (cidade && normalizarTexto(clinica.address?.addressLocality) !== normalizarTexto(cidade)) {
      adicionar(erros, 'nap.divergencia', arquivo, 'cidade do HTML não corresponde ao addressLocality do JSON-LD');
    }
    if (uf && normalizarTexto(clinica.address?.addressRegion) !== normalizarTexto(uf)) {
      adicionar(erros, 'nap.divergencia', arquivo, 'UF do HTML não corresponde ao addressRegion do JSON-LD');
    }
  }

  const textoVisivel = normalizarTexto(
    bloco.replace(/<address\b[^>]*>/, '').replace(/<\/address>$/, '').replace(/<[^>]+>/g, ' ')
  );
  if (logradouro && !textoVisivel.includes(normalizarTexto(logradouro))) {
    adicionar(erros, 'nap.divergencia', arquivo, `${rotulo}: logradouro visível diverge do atributo data-nap-logradouro`);
  }
  if (bairro && !textoVisivel.includes(normalizarTexto(bairro))) {
    adicionar(erros, 'nap.divergencia', arquivo, `${rotulo}: bairro visível diverge do atributo data-nap-bairro`);
  }
  if (cep && !normalizarDigitos(textoVisivel).includes(normalizarDigitos(cep))) {
    adicionar(erros, 'nap.divergencia', arquivo, `${rotulo}: CEP visível (formatado) diverge do JSON-LD`);
  }

  return { telefone };
}

function extrairAtributo(tag, nome) {
  const resultado = tag.match(new RegExp(`${nome}="([^"]*)"`));
  return resultado ? decodificar(resultado[1]) : '';
}

function conteudoDe(arquivos, arquivo) {
  return arquivos.get(arquivo) ?? '';
}

export const REGRAS = {
  'html.basico': ({ arquivos, urlBase, producao, staging = false }) => {
    const erros = [];
    for (const [arquivo, conteudo] of htmls(arquivos)) {
      const rota = rotaDoArquivo(arquivo);

      if (!/<html[^>]*\blang="pt-BR"/.test(conteudo)) {
        adicionar(erros, 'html.basico', arquivo, 'falta <html lang="pt-BR">');
      }
      if (!/class="pular-link"[^>]*href="#conteudo"|href="#conteudo"[^>]*class="pular-link"/.test(conteudo)) {
        adicionar(erros, 'html.basico', arquivo, 'falta link "Pular para o conteúdo" apontando para #conteudo');
      }
      if (!/id="conteudo"/.test(conteudo)) {
        adicionar(erros, 'html.basico', arquivo, 'falta elemento com id="conteudo"');
      }

      const h1 = (conteudo.match(/<h1\b/g) ?? []).length;
      if (h1 !== 1) {
        adicionar(erros, 'html.basico', arquivo, `esperado exatamente 1 <h1>, encontrado ${h1}`);
      }

      const tituloBruto = conteudo.match(/<title>([\s\S]*?)<\/title>/)?.[1];
      const titulo = decodificar(tituloBruto ?? '').trim();
      if (!titulo) {
        adicionar(erros, 'html.basico', arquivo, 'falta <title>');
      } else if (titulo.length > 60) {
        adicionar(erros, 'html.basico', arquivo, `title com ${titulo.length} caracteres (limite 60)`);
      }

      const descricao = decodificar(
        conteudo.match(/<meta name="description" content="([^"]*)">/)?.[1] ?? ''
      ).trim();
      if (!descricao) {
        adicionar(erros, 'html.basico', arquivo, 'falta meta description');
      } else if (descricao.length < 120 || descricao.length > 160) {
        adicionar(
          erros,
          'html.basico',
          arquivo,
          `meta description com ${descricao.length} caracteres (esperado 120 a 160)`
        );
      }

      const canonical = conteudo.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
      const canonicalEsperado = `${urlBase}${rota === '/' ? '/' : rota}`;
      if (canonical !== canonicalEsperado) {
        adicionar(
          erros,
          'html.basico',
          arquivo,
          `canonical "${canonical ?? 'ausente'}" difere de "${canonicalEsperado}"`
        );
      }

      for (const propriedade of ['og:title', 'og:description', 'og:url', 'og:type', 'og:image']) {
        if (!conteudo.includes(`property="${propriedade}"`)) {
          adicionar(erros, 'html.basico', arquivo, `falta meta ${propriedade}`);
        }
      }
      const ogImagem = decodificar(
        conteudo.match(/property="og:image" content="([^"]*)"/)?.[1] ?? ''
      );
      if (ogImagem && !/\/assets\/og-(home|unidade|servico|preparo|institucional)\.png$/.test(ogImagem)) {
        adicionar(erros, 'html.basico', arquivo, `og:image fora dos tipos esperados: ${ogImagem}`);
      }

      const robots = metaRobots(conteudo);
      const temNoindex = robots.some((valor) => valor.toLowerCase().includes('noindex'));
      if (producao) {
        if (!staging && rota !== '/404.html' && temNoindex) {
          adicionar(erros, 'html.basico', arquivo, 'build de producao nao pode ter noindex em pagina publicavel');
        }
        if (staging && !temNoindex) {
          adicionar(erros, 'html.basico', arquivo, 'build de staging exige robots noindex em todas as paginas');
        }
        if (conteudo.includes('VERSÃO DE REVISÃO')) {
          adicionar(erros, 'html.basico', arquivo, 'faixa de revisão encontrada em build de produção');
        }
      } else {
        if (!temNoindex) {
          adicionar(erros, 'html.basico', arquivo, 'build de rascunho exige robots noindex');
        }
        if (!conteudo.includes('VERSÃO DE REVISÃO')) {
          adicionar(erros, 'html.basico', arquivo, 'build de rascunho exige a faixa "VERSÃO DE REVISÃO"');
        }
      }

      if (/<(form|input|textarea|select)\b/i.test(conteudo)) {
        adicionar(erros, 'html.basico', arquivo, 'formulário ou campo de entrada encontrado (coleta de dados proibida)');
      }
      if (/localStorage|sessionStorage|document\.cookie|gtag\(|google-analytics|connect\.facebook\.net/i.test(conteudo)) {
        adicionar(erros, 'html.basico', arquivo, 'rastreamento ou armazenamento local encontrado');
      }
    }
    return erros;
  },

  'html.metaUnica': ({ arquivos }) => {
    const erros = [];
    const titulos = new Map();
    const descricoes = new Map();
    for (const [arquivo, conteudo] of htmls(arquivos)) {
      const titulo = decodificar(
        conteudo.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ''
      ).trim();
      const descricao = decodificar(
        conteudo.match(/<meta name="description" content="([^"]*)">/)?.[1] ?? ''
      ).trim();
      if (titulo) {
        if (titulos.has(titulo)) {
          adicionar(erros, 'html.metaUnica', arquivo, `title repetido (também em ${titulos.get(titulo)})`);
        } else {
          titulos.set(titulo, arquivo);
        }
      }
      if (descricao) {
        if (descricoes.has(descricao)) {
          adicionar(erros, 'html.metaUnica', arquivo, `meta description repetida (também em ${descricoes.get(descricao)})`);
        } else {
          descricoes.set(descricao, arquivo);
        }
      }
    }
    return erros;
  },

  'links.interno': ({ arquivos }) => {
    const erros = [];
    for (const [arquivo, conteudo] of htmls(arquivos)) {
      for (const resultado of conteudo.matchAll(/(?:href|src)="([^"]+)"/g)) {
        const href = decodificar(resultado[1]);
        if (/^(https?:)?\/\//.test(href) || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('data:')) {
          continue;
        }
        if (href.startsWith('#')) {
          const id = href.slice(1);
          if (id && !conteudo.includes(`id="${id}"`)) {
            adicionar(erros, 'links.interno', arquivo, `âncora interna quebrada: ${href}`);
          }
          continue;
        }
        if (!href.startsWith('/')) {
          adicionar(erros, 'links.interno', arquivo, `link deve ser absoluto a partir da raiz: ${href}`);
          continue;
        }
        const [caminhoComQuery, hash] = href.split('#');
        const caminho = caminhoComQuery.split('?')[0];
        let alvo;
        if (caminho === '' || caminho === '/') {
          alvo = 'index.html';
        } else if (caminho.endsWith('/')) {
          alvo = `${caminho.slice(1)}index.html`;
        } else {
          alvo = caminho.slice(1);
        }
        if (!arquivos.has(alvo)) {
          adicionar(erros, 'links.interno', arquivo, `link interno quebrado: ${href} (esperado ${alvo})`);
          continue;
        }
        if (hash && !conteudoDe(arquivos, alvo).includes(`id="${hash}"`)) {
          adicionar(erros, 'links.interno', arquivo, `âncora quebrada em ${alvo}: #${hash}`);
        }
      }
    }
    return erros;
  },

  'links.rel': ({ arquivos }) => {
    const erros = [];
    for (const [arquivo, conteudo] of htmls(arquivos)) {
      for (const resultado of conteudo.matchAll(/<a\b[^>]*>/g)) {
        const tag = resultado[0];
        const href = extrairAtributo(tag, 'href');
        if (!/^https?:\/\//.test(href)) {
          continue;
        }
        const target = extrairAtributo(tag, 'target');
        const rel = extrairAtributo(tag, 'rel');
        if (target !== '_blank') {
          adicionar(erros, 'links.rel', arquivo, `link externo sem target="_blank": ${href}`);
        }
        if (!rel.includes('noopener') || !rel.includes('noreferrer')) {
          adicionar(erros, 'links.rel', arquivo, `link externo sem rel="noopener noreferrer": ${href}`);
        }
      }
    }
    return erros;
  },

  'links.tel': ({ arquivos }) => {
    const erros = [];
    for (const [arquivo, conteudo] of htmls(arquivos)) {
      for (const resultado of conteudo.matchAll(/href="(tel:[^"]*)"/g)) {
        if (!/^tel:\+55\d{10,11}$/.test(resultado[1])) {
          adicionar(erros, 'links.tel', arquivo, `telefone fora do padrão E.164: ${resultado[1]}`);
        }
      }
    }
    return erros;
  },

  'portal.url': ({ arquivos }) => {
    const erros = [];
    for (const [arquivo, conteudo] of arquivos.entries()) {
      if (!conteudo.includes('entregadeexames.com.br')) {
        continue;
      }
      if (arquivo.endsWith('.js')) {
        adicionar(erros, 'portal.url', arquivo, 'o link do portal não deve ser montado em JavaScript');
        continue;
      }
      if (!arquivo.endsWith('.html')) {
        adicionar(erros, 'portal.url', arquivo, 'domínio do portal fora de HTML gerado');
        continue;
      }
      const ocorrencias = (conteudo.match(/entregadeexames\.com\.br/g) ?? []).length;
      const ancoras = [...conteudo.matchAll(/<a\b[^>]*entregadeexames\.com\.br[^>]*>/g)].map(
        (resultado) => resultado[0]
      );
      if (ancoras.length !== ocorrencias) {
        adicionar(erros, 'portal.url', arquivo, 'domínio do portal aparece fora de um link <a>');
      }
      for (const tag of ancoras) {
        const href = extrairAtributo(tag, 'href');
        if (href !== DOMINIO_PORTAL) {
          adicionar(erros, 'portal.url', arquivo, `href do portal deve ser exatamente ${DOMINIO_PORTAL}`);
        }
        if (extrairAtributo(tag, 'target') !== '_blank') {
          adicionar(erros, 'portal.url', arquivo, 'CTA do portal sem target="_blank"');
        }
        const rel = extrairAtributo(tag, 'rel');
        if (!rel.includes('noopener') || !rel.includes('noreferrer')) {
          adicionar(erros, 'portal.url', arquivo, 'CTA do portal sem noopener/noreferrer');
        }
      }
      if (/<(iframe|link|meta)\b[^>]*(entregadeexames|http-equiv="refresh")/i.test(conteudo)) {
        adicionar(erros, 'portal.url', arquivo, 'iframe, preload ou refresh apontando para ambiente externo');
      }
    }
    return erros;
  },

  'externo.requisicao': ({ arquivos }) => {
    const erros = [];
    for (const [arquivo, conteudo] of htmls(arquivos)) {
      if (/<script\b[^>]*\bsrc="(?:https?:)?\/\//i.test(conteudo)) {
        adicionar(erros, 'externo.requisicao', arquivo, 'script externo no HTML');
      }
      if (/<link\b[^>]*\bhref="(?:https?:)?\/\//i.test(conteudo)) {
        for (const resultado of conteudo.matchAll(/<link\b[^>]*>/g)) {
          const tag = resultado[0];
          const href = tag.match(/href="([^"]*)"/)?.[1] ?? '';
          if (!/^(https?:)?\/\//.test(href)) {
            continue;
          }
          const rel = tag.match(/rel="([^"]*)"/)?.[1] ?? '';
          if (rel === 'canonical') {
            continue;
          }
          adicionar(erros, 'externo.requisicao', arquivo, `link externo no HTML (rel="${rel}")`);
        }
      }
      if (/<iframe\b/i.test(conteudo)) {
        adicionar(erros, 'externo.requisicao', arquivo, 'iframe encontrado; o mapa deve ser injetado só após clique');
      }
      if (/<(img|source|video|audio)\b[^>]*\bsrc="(?:https?:)?\/\//i.test(conteudo)) {
        adicionar(erros, 'externo.requisicao', arquivo, 'mídia externa no HTML');
      }
      if (/<meta[^>]+http-equiv="refresh"/i.test(conteudo)) {
        adicionar(erros, 'externo.requisicao', arquivo, 'meta refresh encontrado');
      }
      if (/@import\s|url\(\s*['"]?https?:/i.test(conteudo)) {
        adicionar(erros, 'externo.requisicao', arquivo, 'importação ou url() externa no HTML');
      }
    }
    for (const [arquivo, conteudo] of arquivos.entries()) {
      if (arquivo.endsWith('.js')) {
        if (/\bfetch\s*\(|XMLHttpRequest|sendBeacon|importScripts|new\s+Image\s*\(/.test(conteudo)) {
          adicionar(erros, 'externo.requisicao', arquivo, 'requisição de rede em JavaScript');
        }
      }
      if (arquivo.endsWith('.css')) {
        if (/@import\s+(?:url\(\s*)?['"]?(?:https?:)?\/\//i.test(conteudo)) {
          adicionar(erros, 'externo.requisicao', arquivo, '@import remoto no CSS compilado');
        }
        if (/url\(\s*['"]?(?:https?:)?\/\//i.test(conteudo)) {
          adicionar(erros, 'externo.requisicao', arquivo, 'url() remota no CSS compilado');
        }
        if (/@font-face\s*\{[^}]*url\(\s*['"]?(?:https?:)?\/\//i.test(conteudo)) {
          adicionar(erros, 'externo.requisicao', arquivo, '@font-face com origem externa no CSS compilado');
        }
      }
    }
    return erros;
  },

  'conteudo.placeholder': ({ arquivos }) => {
    const erros = [];
    for (const [arquivo, conteudo] of arquivos.entries()) {
      if (!arquivo.endsWith('.html') && !arquivo.endsWith('.js')) {
        continue;
      }
      for (const proibido of TEXTOS_PROIBIDOS) {
        if (proibido.regex.test(conteudo)) {
          adicionar(erros, 'conteudo.placeholder', arquivo, `texto proibido encontrado: ${proibido.rotulo}`);
        }
      }
    }
    return erros;
  },

  'conteudo.claim': ({ arquivos }) => {
    const erros = [];
    for (const [arquivo, conteudo] of htmls(arquivos)) {
      const minusculo = decodificar(conteudo).toLowerCase();
      for (const claim of CLAIMS_PROIBIDOS) {
        if (minusculo.includes(claim)) {
          adicionar(erros, 'conteudo.claim', arquivo, `claim proibido: "${claim}"`);
        }
      }
    }
    return erros;
  },

  'conteudo.hex': ({ arquivos }) => {
    const erros = [];
    for (const [arquivo, conteudo] of arquivos.entries()) {
      if (!arquivo.endsWith('.html') && !arquivo.endsWith('.js') && !arquivo.endsWith('.svg')) {
        continue;
      }
      for (const resultado of conteudo.matchAll(/#[0-9a-fA-F]{6}(?![0-9a-fA-F])/g)) {
        adicionar(
          erros,
          'conteudo.hex',
          arquivo,
          `cor hexadecimal fora dos arquivos de tema: ${resultado[0]}`
        );
      }
    }
    return erros;
  },

  'nap.divergencia': ({ arquivos, napEsperado = null }) => {
    const erros = [];
    for (const [arquivo, conteudo] of htmls(arquivos)) {
      const blocosUnidade = [...conteudo.matchAll(/<address\b[^>]*data-nap-escopo="unidade"[^>]*>[\s\S]*?<\/address>/gi)].map((resultado) => resultado[0]);
      const blocosMatriz = [...conteudo.matchAll(/<address\b[^>]*data-nap-escopo="matriz"[^>]*>[\s\S]*?<\/address>/gi)].map((resultado) => resultado[0]);
      const blocosTelefone = [...conteudo.matchAll(/<p\b[^>]*data-nap-escopo="institucional"[^>]*>[\s\S]*?<\/p>/gi)].map((resultado) => resultado[0]);

      for (const blocoUnidade of blocosUnidade) {
        const jsonLd = [...conteudo.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
          .map((resultado) => {
            try {
              return JSON.parse(resultado[1]);
            } catch {
              return null;
            }
          })
          .filter(Boolean);
        let clinica = null;
        for (const bloco of jsonLd) {
          for (const no of bloco['@graph'] ?? []) {
            if (no?.['@type'] === 'MedicalClinic') {
              clinica = no;
            }
          }
        }
        if (!clinica) {
          adicionar(erros, 'nap.divergencia', arquivo, 'página de unidade sem nó MedicalClinic no JSON-LD');
        } else {
          compararEnderecoNap({ erros, arquivo, bloco: blocoUnidade, rotulo: 'unidade', clinica });
          const telefonesVisiveis = [...conteudo.matchAll(/<a\b[^>]*href="tel:[^"]*"[^>]*>([\s\S]*?)<\/a>/g)]
            .map((resultado) => normalizarTelefone(resultado[1]))
            .filter(Boolean);
          if (telefonesVisiveis.length === 0) {
            adicionar(erros, 'nap.divergencia', arquivo, 'telefone visível ausente na página da unidade');
          } else if (!telefonesVisiveis.includes(normalizarTelefone(clinica.telephone))) {
            adicionar(
              erros,
              'nap.divergencia',
              arquivo,
              `telefone visível (${telefonesVisiveis.join(', ')}) diverge do JSON-LD (${clinica.telephone})`
            );
          }
        }
      }

      if (napEsperado) {
        if (napEsperado.matriz) {
          if (blocosMatriz.length === 0) {
            adicionar(erros, 'nap.divergencia', arquivo, 'rodapé sem o endereço institucional da matriz esperado');
          } else {
            for (const blocoMatriz of blocosMatriz) {
              compararEnderecoNap({
                erros,
                arquivo,
                bloco: blocoMatriz,
                rotulo: 'rodapé',
                esperado: napEsperado.matriz
              });
            }
          }
        } else if (blocosMatriz.length > 0) {
          adicionar(
            erros,
            'nap.divergencia',
            arquivo,
            'rodapé exibe endereço da matriz quando nenhuma matriz publicável foi definida'
          );
        }

        if (napEsperado.telefoneInstitucional) {
          if (blocosTelefone.length === 0) {
            adicionar(erros, 'nap.divergencia', arquivo, 'rodapé sem o telefone institucional esperado');
          } else {
            for (const blocoTelefone of blocosTelefone) {
              const tag = blocoTelefone.match(/<p\b[^>]*>/)?.[0] ?? '';
              const telefoneOculto = extrairAtributo(tag, 'data-nap-telefone');
              const telefoneVisivel = blocoTelefone.match(/<a\b[^>]*href="tel:[^"]*"[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? '';
              if (
                normalizarTelefone(telefoneOculto) !==
                normalizarTelefone(napEsperado.telefoneInstitucional)
              ) {
                adicionar(
                  erros,
                  'nap.divergencia',
                  arquivo,
                  `telefone institucional oculto ("${telefoneOculto}") diverge de site.contatoInstitucional`
                );
              }
              if (
                normalizarTelefone(telefoneVisivel) !==
                normalizarTelefone(napEsperado.telefoneInstitucional)
              ) {
                adicionar(
                  erros,
                  'nap.divergencia',
                  arquivo,
                  `telefone institucional visível ("${telefoneVisivel}") diverge de site.contatoInstitucional`
                );
              }
            }
          }
        } else if (blocosTelefone.length > 0) {
          adicionar(
            erros,
            'nap.divergencia',
            arquivo,
            'rodapé exibe telefone institucional quando site.contatoInstitucional está vazio'
          );
        }
      }
    }
    return erros;
  },

  'artefato.producao': ({ arquivos, producao, urlBase, slugsTeste = [], staging = false }) => {
    if (!producao || staging) {
      return [];
    }
    const erros = [];
    for (const [arquivo, conteudo] of htmls(arquivos)) {
      if (
        arquivo !== '404.html' &&
        metaRobots(conteudo).some((valor) => valor.toLowerCase().includes('noindex'))
      ) {
        adicionar(erros, 'artefato.producao', arquivo, 'dist de produção não pode conter meta robots noindex');
      }
      if (conteudo.includes('VERSÃO DE REVISÃO')) {
        adicionar(erros, 'artefato.producao', arquivo, 'dist de produção não pode conter a faixa "VERSÃO DE REVISÃO"');
      }
      for (const slug of slugsTeste) {
        if (slug && conteudo.includes(`/unidades/${slug}/`)) {
          adicionar(erros, 'artefato.producao', arquivo, `dist de produção contém a unidade de teste "${slug}"`);
        }
      }
    }
    const sitemap = arquivos.get('sitemap.xml');
    if (sitemap) {
      for (const slug of slugsTeste) {
        if (slug && sitemap.includes(`/unidades/${slug}/`)) {
          adicionar(
            erros,
            'artefato.producao',
            'sitemap.xml',
            `sitemap de produção contém a unidade de teste "${slug}"`
          );
        }
      }
      for (const resultado of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
        const loc = resultado[1];
        if (urlBase && !loc.startsWith(`${urlBase}/`)) {
          adicionar(erros, 'artefato.producao', 'sitemap.xml', `URL fora da base permitida no sitemap: ${loc}`);
        }
        if (/(?:localhost|staging|exemplo|teste-)/i.test(loc)) {
          adicionar(erros, 'artefato.producao', 'sitemap.xml', `URL fictícia no sitemap: ${loc}`);
        }
      }
    }
    return erros;
  },

  'saida.obrigatoria': ({ arquivos }) => {
    const erros = [];
    for (const obrigatorio of [
      'index.html',
      '404.html',
      'sitemap.xml',
      'robots.txt',
      'assets/estilo.css',
      'assets/app.js'
    ]) {
      if (!arquivos.has(obrigatorio)) {
        adicionar(erros, 'saida.obrigatoria', obrigatorio, 'arquivo obrigatório ausente na saída');
      }
    }
    return erros;
  },

  orcamento: ({ arquivos }) => {
    const erros = [];
    const limite = [
      { arquivo: 'assets/app.js', bytes: ORCAMENTO_JS_GZIP, rotulo: 'JS' },
      { arquivo: 'assets/estilo.css', bytes: ORCAMENTO_CSS_GZIP, rotulo: 'CSS' }
    ];
    for (const item of limite) {
      const conteudo = arquivos.get(item.arquivo);
      if (!conteudo) {
        continue;
      }
      const tamanho = gzipSync(Buffer.from(conteudo, 'utf8')).length;
      if (tamanho > item.bytes) {
        adicionar(
          erros,
          'orcamento',
          item.arquivo,
          `${item.rotulo} com ${tamanho} bytes gzip (limite ${item.bytes})`
        );
      }
    }
    return erros;
  }
};

export function executarChecagens(contexto) {
  return Object.values(REGRAS).flatMap((regra) => regra(contexto));
}

export function checarSitemap({ arquivos, rotas, urlBase, staging = false }) {
  const erros = [];
  const sitemap = arquivos.get('sitemap.xml');
  if (!sitemap) {
    adicionar(erros, 'sitemap', 'sitemap.xml', 'sitemap.xml ausente');
    return erros;
  }
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((resultado) => resultado[1]);
  const esperadas = rotas
    .filter((rota) => rota !== '/404.html')
    .map((rota) => `${urlBase}${rota === '/' ? '/' : rota}`)
    .sort();
  const obtidas = [...locs].sort();
  if (JSON.stringify(esperadas) !== JSON.stringify(obtidas)) {
    adicionar(
      erros,
      'sitemap',
      'sitemap.xml',
      `URLs divergentes. Esperadas: ${esperadas.join(', ')}. Encontradas: ${obtidas.join(', ')}`
    );
  }

  for (const [indice, bloco] of [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].entries()) {
    const loc = bloco[1].match(/<loc>([^<]*)<\/loc>/)?.[1]?.trim();
    const lastmod = bloco[1].match(/<lastmod>([^<]*)<\/lastmod>/)?.[1]?.trim();
    const referencia = loc || `bloco <url> na posicao ${indice + 1}`;
    if (!loc) {
      adicionar(erros, 'sitemap', 'sitemap.xml', `${referencia}: <loc> ausente`);
    }
    if (!lastmod || !/^\d{4}-\d{2}-\d{2}$/.test(lastmod)) {
      adicionar(
        erros,
        'sitemap',
        'sitemap.xml',
        `${referencia}: lastmod ausente ou fora do formato AAAA-MM-DD`
      );
    }
  }

  const robots = arquivos.get('robots.txt');
  if (!robots) {
    adicionar(erros, 'sitemap', 'robots.txt', 'robots.txt ausente');
  } else {
    if (staging) {
      if (!robots.includes('User-agent: *') || !robots.includes('Disallow: /')) {
        adicionar(erros, 'sitemap', 'robots.txt', 'robots.txt de staging deve bloquear com User-agent: * e Disallow: /');
      }
    } else if (!robots.includes('User-agent: *') || !robots.includes('Allow: /')) {
      adicionar(erros, 'sitemap', 'robots.txt', 'robots.txt deve liberar o site com User-agent: * e Allow: /');
    }
    if (!robots.includes(`Sitemap: ${urlBase}/sitemap.xml`)) {
      adicionar(erros, 'sitemap', 'robots.txt', 'robots.txt deve apontar o sitemap absoluto');
    }
  }
  return erros;
}
