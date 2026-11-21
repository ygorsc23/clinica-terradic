import { escapar, modelo, template } from './render.mjs';
import {
  enderecoEmLinha,
  formatarDias,
  formatarTelefone,
  preparoAprovado,
  servicoAprovado,
  telefonePrincipal,
  telefoneValidado,
  unidadePublicavel,
  URL_BASE_PERMITIDA
} from './dados.mjs';
import {
  jsonLdBreadcrumb,
  jsonLdClinica,
  jsonLdOrganizacao,
  jsonLdPagina,
  jsonLdSite,
  metadados,
  serializarJsonLd
} from './seo.mjs';
import { renderizarBlocos } from './blocos.mjs';

export const ITENS_NAV = [
  { rota: '/', rotulo: 'Início' },
  { rota: '/unidades/', rotulo: 'Unidades' },
  { rota: '/servicos/', rotulo: 'Serviços' },
  { rota: '/preparo-de-exames/', rotulo: 'Preparo de exames' },
  { rota: '/convenios-e-particular/', rotulo: 'Convênios' },
  { rota: '/sobre/', rotulo: 'Sobre' },
  { rota: '/contato/', rotulo: 'Contato' }
];

function frag(ctx, chave, opcoes = {}) {
  return modelo(template(ctx.templates, chave), opcoes);
}

function blocoPorId(ctx, pagina, id) {
  return (ctx.dados.paginas.paginas[pagina]?.blocos ?? []).find((bloco) => bloco?.id === id);
}

function blocosPendentesDaPagina(dados, chave) {
  const blocos = dados.paginas?.paginas?.[chave]?.blocos;
  if (!Array.isArray(blocos)) {
    return [];
  }
  return blocos.filter((bloco) => bloco?.status === 'pendente');
}

export function paginaEditorialPublicavel(dados, chave) {
  const blocos = dados.paginas?.paginas?.[chave]?.blocos;
  if (!Array.isArray(blocos)) {
    return true;
  }
  return blocos.every((bloco) => bloco?.status === 'aprovado');
}

export function paginaTemBlocos(dados, chave) {
  const blocos = dados.paginas?.paginas?.[chave]?.blocos;
  return Array.isArray(blocos) && blocos.length > 0;
}

function temRota(ctx, rota) {
  return ctx.rotas.some((item) => item.rota === rota);
}

function textoInstrucoes(ctx) {
  return (ctx.dados.site.portalExames?.instrucoes ?? []).join(' e ');
}

function montarCta(ctx, classeBotao = 'botao-primario') {
  return frag(ctx, 'parciais/cta-exames', {
    texto: { url: ctx.dados.site.portalExames.url, classeBotao }
  });
}

function montarAvisoExterno(ctx) {
  const bloco = blocoPorId(ctx, 'home', 'aviso-externo');
  const texto = escapar(bloco?.texto ?? '').replace('{{instrucoes}}', escapar(textoInstrucoes(ctx)));
  return frag(ctx, 'parciais/aviso-externo', { fragmento: { texto } });
}

function montarPill(ctx, unidade) {
  return frag(ctx, 'parciais/pill-unidade', { texto: { nome: unidade.nomeExibicao } });
}

function montarNav(ctx, rotaAtual) {
  const itens = ITENS_NAV.filter((item) => temRota(ctx, item.rota));
  if (itens.length < 2) {
    return '';
  }
  const htmlItens = itens
    .map((item) =>
      frag(ctx, 'parciais/item-menu', {
        texto: { url: item.rota, rotulo: item.rotulo },
        fragmento: { attributes: item.rota === rotaAtual ? ' aria-current="page"' : '' }
      })
    )
    .join('');
  return frag(ctx, 'parciais/nav-principal', { fragmento: { itens: htmlItens } });
}

function montarCabecalho(ctx, rotaAtual) {
  const subtitulo = blocoPorId(ctx, 'home', 'marca-subtitulo')?.texto ?? '';
  return frag(ctx, 'parciais/cabecalho', {
    texto: { marcaNome: ctx.dados.site.marca.nome, marcaSubtitulo: subtitulo },
    fragmento: {
      nav: montarNav(ctx, rotaAtual),
      ctaExames: montarCta(ctx)
    }
  });
}

function montarRodape(ctx) {
  const site = ctx.dados.site;
  const publicacao = ctx.publicacao;

  const matriz = matrizRodape(ctx.dados);
  let blocoEnderecoMatriz = '';
  if (matriz) {
    blocoEnderecoMatriz = frag(ctx, 'parciais/rodape-endereco', {
      texto: {
        nomeExibicao: matriz.nomeExibicao,
        logradouro: matriz.endereco.logradouro,
        numero: matriz.endereco.numero,
        complemento: matriz.endereco.complemento ? `, ${matriz.endereco.complemento}` : '',
        bairro: matriz.endereco.bairro,
        cep: matriz.endereco.cep,
        cepFormatado: formatarCep(matriz.endereco.cep),
        cidade: matriz.cidade,
        uf: matriz.uf
      }
    });
  }

  let blocoContatoInstitucional = '';
  const email = site.contatoInstitucional?.email;
  const telefone = telefoneInstitucionalMatriz(ctx.dados);
  if (telefone) {
    blocoContatoInstitucional += frag(ctx, 'parciais/rodape-telefone', {
      texto: { telefone, telefoneFormatado: formatarTelefone(telefone) }
    });
  }
  if (email) {
    blocoContatoInstitucional += frag(ctx, 'parciais/rodape-email', { texto: { email } });
  }

  let colunaUnidades = '';
  if (publicacao.unidades.length > 0) {
    const itens = publicacao.unidades
      .map((unidade) =>
        frag(ctx, 'parciais/rodape-unidade-item', {
          texto: { url: `/unidades/${unidade.slug}/`, nome: unidade.nomeExibicao }
        })
      )
      .join('');
    colunaUnidades = frag(ctx, 'parciais/rodape-unidades', { fragmento: { itens } });
  }

  const textoResponsavel = textoResponsavelTecnico(site);
  const blocoResponsavelTecnico = textoResponsavel
    ? frag(ctx, 'parciais/rodape-responsavel', { texto: { texto: textoResponsavel } })
    : '';

  const linkPrivacidade =
    site.privacidade?.politicaPublicada === true ? frag(ctx, 'parciais/rodape-privacidade') : '';

  return frag(ctx, 'parciais/rodape', {
    texto: {
      marcaNome: site.marca.nome,
      razaoSocial: site.marca.razaoSocial,
      cnpj: site.marca.cnpj,
      ano: new Date().getFullYear()
    },
    fragmento: {
      blocoEnderecoMatriz,
      blocoContatoInstitucional,
      colunaUnidades,
      ctaExames: montarCta(ctx, 'botao-inverso'),
      blocoResponsavelTecnico,
      linkPrivacidade
    }
  });
}

function montarBreadcrumb(ctx, itens) {
  if (!itens || itens.length === 0) {
    return '';
  }
  const html = itens
    .map((item, indice) => {
      if (indice === itens.length - 1) {
        return frag(ctx, 'parciais/breadcrumb-atual', { texto: { rotulo: item.rotulo } });
      }
      return frag(ctx, 'parciais/breadcrumb-item', {
        texto: { url: item.url, rotulo: item.rotulo }
      });
    })
    .join('');
  return frag(ctx, 'parciais/breadcrumb', { fragmento: { itens: html } });
}

function formatarData(data) {
  if (!data) {
    return '';
  }
  const [ano, mes, dia] = String(data).split('-');
  return `${dia}/${mes}/${ano}`;
}

function dataAtualizacaoConvenios(data, quantidade = 0) {
  if (!quantidade) {
    return '';
  }
  const formatada = formatarData(data);
  return formatada ? `Lista atualizada em ${formatada}.` : 'Data de atualização não informada.';
}

function formatarCep(cep) {
  const digitos = String(cep ?? '').replace(/\D/g, '');
  if (digitos.length !== 8) {
    return String(cep ?? '');
  }
  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`;
}

function textoResponsavelTecnico(site) {
  const rt = site?.responsavelTecnico;
  if (
    rt?.status !== 'confirmado' ||
    !rt.nome ||
    !rt.crm ||
    !rt.crmUf ||
    !rt.especialidade
  ) {
    return '';
  }
  const crm = `CRM ${rt.crm}/${rt.crmUf}`;
  return `Responsável técnico: ${rt.nome} — ${crm}. ${rt.especialidade}.`;
}

function matrizRodape(dados) {
  const matriz = (dados.unidades?.unidades ?? []).find((unidade) => unidade?.matriz === true);
  if (!matriz || matriz.validacao?.status !== 'confirmado') {
    return null;
  }
  if (
    !matriz.endereco?.logradouro ||
    !matriz.endereco?.numero ||
    !matriz.endereco?.bairro ||
    !matriz.endereco?.cep
  ) {
    return null;
  }
  return matriz;
}

function telefoneInstitucionalMatriz(dados) {
  const matriz = matrizRodape(dados);
  return telefonePrincipal(matriz)?.e164 ?? '';
}

export function tituloUnidade(unidade) {
  return `${unidade.nomeExibicao} — Exames de imagem em ${unidade.cidade}/${unidade.uf}`;
}

export function descricaoUnidade(unidade, marca = 'Terradic') {
  return `${unidade.nomeExibicao} em ${unidade.cidade}/${unidade.uf}. Telefone, horário, endereço e exames de imagem disponíveis nesta unidade da rede ${marca}, no Ceará.`;
}

export function rotuloRevisaoPreparo(preparo) {
  if (!preparoAprovado(preparo)) {
    return 'Revisão pendente';
  }
  const data = preparo.revisao?.data ? ` em ${formatarData(preparo.revisao.data)}` : '';
  const responsavel = preparo.revisao?.responsavel;
  const crm = preparo.revisao?.crm;
  if (responsavel && crm) {
    return `Revisado por ${responsavel} (CRM ${crm})${data}`;
  }
  if (responsavel) {
    return `Revisado por ${responsavel}${data}`;
  }
  return data ? `Revisado${data}` : 'Revisado';
}

function montarChipsServicos(ctx, ids) {
  const itens = (ids ?? [])
    .map((id) => ctx.servicoPorId.get(id))
    .filter((servico) => servico && servicoAprovado(servico))
    .map((servico) => {
      const rota = `/servicos/${servico.slug}/`;
      if (temRota(ctx, rota)) {
        return frag(ctx, 'parciais/chip-link', {
          texto: { url: rota, nome: servico.nomeCurto ?? servico.nome }
        });
      }
      return frag(ctx, 'parciais/chip', { texto: { nome: servico.nomeCurto ?? servico.nome } });
    })
    .join('');
  return itens ? frag(ctx, 'parciais/chip-lista', { fragmento: { itens } }) : '';
}

function montarCardUnidade(ctx, unidade) {
  const telefone = (unidade.telefones ?? []).find(telefoneValidado);
  const blocoTelefone = telefone
    ? frag(ctx, 'parciais/card-telefone', {
        texto: {
          telefone: telefone.e164,
          telefoneFormatado: formatarTelefone(telefone.e164)
        }
      })
    : '';
  return frag(ctx, 'parciais/card-unidade', {
    texto: {
      url: `/unidades/${unidade.slug}/`,
      nomeExibicao: unidade.nomeExibicao,
      cidadeUf: `${unidade.cidade}/${unidade.uf}`
    },
    fragmento: {
      pill: montarPill(ctx, unidade),
      blocoTelefone,
      blocoServicos: montarChipsServicos(ctx, unidade.servicos)
    }
  });
}

function montarListaUnidades(ctx) {
  if (ctx.publicacao.unidades.length === 0) {
    return '';
  }
  const grupos = new Map();
  for (const unidade of ctx.publicacao.unidades) {
    const chave = `${unidade.cidade}/${unidade.uf}`;
    if (!grupos.has(chave)) {
      grupos.set(chave, { cidade: unidade.cidade, uf: unidade.uf, unidades: [] });
    }
    grupos.get(chave).unidades.push(unidade);
  }
  const ordenados = [...grupos.values()].sort((a, b) =>
    a.cidade < b.cidade ? -1 : a.cidade > b.cidade ? 1 : 0
  );
  return ordenados
    .map((grupo) =>
      frag(ctx, 'parciais/lista-unidades-cidade', {
        texto: { cidade: grupo.cidade, uf: grupo.uf },
        fragmento: {
          itens: grupo.unidades.map((unidade) => montarCardUnidade(ctx, unidade)).join('')
        }
      })
    )
    .join('');
}

function montarCardServico(ctx, servico) {
  const unidades = ctx.publicacao.mapaServicoUnidades.get(servico.id) ?? [];
  const quantidade = unidades.length;
  const resumo = servico.resumo
    ? frag(ctx, 'parciais/paragrafo', { texto: { texto: servico.resumo } })
    : ctx.rascunho
      ? frag(ctx, 'parciais/nota-revisao')
      : '';
  return frag(ctx, 'parciais/card-servico', {
    texto: { url: `/servicos/${servico.slug}/`, nome: servico.nome },
    fragmento: {
      resumo,
      unidades: frag(ctx, 'parciais/card-meta', {
        texto: {
          texto:
            quantidade === 0
              ? 'Nenhuma unidade publicada realiza este exame.'
              : `${quantidade} unidade${quantidade > 1 ? 's' : ''} realiza${quantidade > 1 ? 'm' : ''} este exame.`
        }
      })
    }
  });
}

function montarListaServicos(ctx) {
  if (ctx.publicacao.servicos.length === 0) {
    return '';
  }
  return frag(ctx, 'parciais/lista-servicos', {
    fragmento: { itens: ctx.publicacao.servicos.map((servico) => montarCardServico(ctx, servico)).join('') }
  });
}

function robotsTxt(ctx, { noindex = false } = {}) {
  if (ctx.rascunho) {
    return 'noindex, nofollow';
  }
  if (ctx.urlBase !== URL_BASE_PERMITIDA) {
    return 'noindex, follow';
  }
  return noindex ? 'noindex, follow' : 'index, follow';
}

function paginaHome(ctx) {
  const dadosPagina = ctx.dados.paginas.paginas.home;
  const temUnidades = temRota(ctx, '/unidades/');
  const blocos = dadosPagina.blocos ?? [];
  const visiveis = ctx.rascunho ? blocos : blocos.filter((bloco) => bloco?.status === 'aprovado');
  const pegar = (id) => visiveis.find((bloco) => bloco?.id === id);
  const idsUsados = new Set([
    'marca-subtitulo',
    'hero-etiqueta',
    'hero-titulo',
    'hero-paragrafo',
    'servicos-titulo',
    'servicos-texto',
    'unidades-titulo',
    'unidades-texto',
    'portal-titulo',
    'portal-texto'
  ]);
  const restantes = visiveis.filter((bloco) => !idsUsados.has(bloco?.id));
  const textoPortal = escapar(pegar('portal-texto')?.texto ?? '').replace(
    '{{instrucoes}}',
    escapar(textoInstrucoes(ctx))
  );

  const secaoHero = frag(ctx, 'parciais/secao-hero-home', {
    texto: {
      etiquetaHero: pegar('hero-etiqueta')?.texto ?? '',
      tituloHero: pegar('hero-titulo')?.texto ?? dadosPagina.seo.titulo,
      textoHero: pegar('hero-paragrafo')?.texto ?? ''
    },
    fragmento: {
      ctaExames: montarCta(ctx, 'botao-inverso'),
      ctaUnidades: temUnidades ? frag(ctx, 'parciais/cta-unidades') : ''
    }
  });

  const secaoEditorial =
    restantes.length > 0
      ? frag(ctx, 'parciais/secao-editorial-home', {
          fragmento: { blocos: renderizarBlocos(restantes, ctx.templates) }
        })
      : '';

  const secaoServicos =
    ctx.publicacao.servicos.length > 0
      ? frag(ctx, 'parciais/secao-servicos-home', {
          texto: {
            tituloSecao: pegar('servicos-titulo')?.texto ?? '',
            textoSecao: pegar('servicos-texto')?.texto ?? ''
          },
          fragmento: {
            linkTodos: frag(ctx, 'parciais/link-todos', {
              texto: { url: '/servicos/', rotulo: 'Ver todos os serviços' }
            }),
            lista: montarListaServicos(ctx)
          }
        })
      : '';

  const secaoUnidades =
    ctx.publicacao.unidades.length > 0
      ? frag(ctx, 'parciais/secao-unidades-home', {
          texto: {
            tituloSecao: pegar('unidades-titulo')?.texto ?? '',
            textoSecao: pegar('unidades-texto')?.texto ?? ''
          },
          fragmento: {
            linkTodos: frag(ctx, 'parciais/link-todos', {
              texto: { url: '/unidades/', rotulo: 'Ver todas as unidades' }
            }),
            lista: montarListaUnidades(ctx)
          }
        })
      : '';

  const secaoPortal = frag(ctx, 'parciais/secao-portal-home', {
    texto: { tituloSecao: pegar('portal-titulo')?.texto ?? '' },
    fragmento: {
      textoPortal,
      ctaExames: montarCta(ctx),
      avisoExterno: montarAvisoExterno(ctx)
    }
  });

  const conteudo = frag(ctx, 'home', {
    fragmento: { secaoHero, secaoEditorial, secaoServicos, secaoUnidades, secaoPortal }
  });

  return {
    rota: '/',
    titulo: dadosPagina.seo.titulo,
    descricao: dadosPagina.seo.descricao,
    conteudo,
    robots: robotsTxt(ctx),
    jsonLd: [
      jsonLdOrganizacao(ctx.dados.site, ctx.urlBase),
      jsonLdSite(ctx.dados.site, ctx.urlBase),
      jsonLdPagina({ urlBase: ctx.urlBase, rota: '/', nome: dadosPagina.seo.titulo })
    ]
  };
}

function paginaUnidades(ctx) {
  const dadosPagina = ctx.dados.paginas.paginas.unidades;
  const itens = [
    { rotulo: 'Início', url: '/' },
    { rotulo: 'Unidades', url: '/unidades/' }
  ];
  const { titulo, blocos } = conteudoEditorial(ctx, 'unidades');
  const conteudo = frag(ctx, 'unidades', {
    texto: { tituloPagina: titulo },
    fragmento: {
      breadcrumb: montarBreadcrumb(ctx, itens),
      blocos,
      lista: montarListaUnidades(ctx),
      ctaExames: montarCta(ctx),
      avisoExterno: montarAvisoExterno(ctx)
    }
  });
  return {
    rota: '/unidades/',
    titulo: dadosPagina.seo.titulo,
    descricao: dadosPagina.seo.descricao,
    conteudo,
    robots: robotsTxt(ctx),
    jsonLd: [
      jsonLdOrganizacao(ctx.dados.site, ctx.urlBase),
      jsonLdPagina({
        urlBase: ctx.urlBase,
        rota: '/unidades/',
        nome: dadosPagina.seo.titulo
      }),
      jsonLdBreadcrumb(itens, ctx.urlBase)
    ]
  };
}

function paginaUnidade(ctx, unidade) {
  const site = ctx.dados.site;
  const confirmada = unidadePublicavel(unidade, ctx.servicos ?? []);
  const seloRevisao = ctx.rascunho && !confirmada ? frag(ctx, 'parciais/selo-revisao') : '';
  const endereco = unidade.endereco ?? {};
  const telefones = (unidade.telefones ?? []).filter(telefoneValidado);
  const temEndereco = Boolean(
    endereco.logradouro && endereco.numero && endereco.bairro && endereco.cep
  );
  const matrizPublicada = matrizRodape(ctx.dados);
  const temEnderecoMatriz = Boolean(matrizPublicada);

  let blocoEndereco = '';
  if (temEndereco) {
    const referencia = endereco.referencia
      ? frag(ctx, 'parciais/referencia-endereco', { texto: { texto: endereco.referencia } })
      : '';
    blocoEndereco = frag(ctx, 'parciais/endereco-unidade', {
      texto: {
        nomeExibicao: unidade.nomeExibicao,
        logradouro: endereco.logradouro,
        numero: endereco.numero,
        complemento: endereco.complemento ? `, ${endereco.complemento}` : '',
        bairro: endereco.bairro,
        cep: endereco.cep,
        cepFormatado: formatarCep(endereco.cep),
        cidade: unidade.cidade,
        uf: unidade.uf,
        telefone: telefones[0]?.e164 ?? ''
      },
      fragmento: { referencia }
    });
  } else if (ctx.rascunho) {
    blocoEndereco = frag(ctx, 'parciais/nota-revisao');
  }

  let blocoTelefones = '';
  if (telefones.length > 0) {
    const itens = telefones
      .map((telefone) =>
        frag(ctx, 'parciais/telefone-unidade', {
          texto: {
            e164: telefone.e164,
            formatado: formatarTelefone(telefone.e164),
            rotulo: telefone.rotulo ?? ''
          }
        })
      )
      .join('');
    blocoTelefones = frag(ctx, 'parciais/telefones-unidade', { fragmento: { itens } });
  } else if (ctx.rascunho) {
    blocoTelefones = frag(ctx, 'parciais/nota-revisao');
  }

  const whatsapp = unidade.whatsapp;
  const blocoWhatsapp =
    whatsapp?.e164 && whatsapp?.validado === true
      ? frag(ctx, 'parciais/whatsapp-unidade', {
          texto: {
            numero: String(whatsapp.e164).replace(/\D/g, ''),
            avisoWhatsapp: blocoPorId(ctx, 'home', 'whatsapp-aviso')?.texto ?? ''
          }
        })
      : '';

  const blocoEmail = unidade.email
    ? frag(ctx, 'parciais/email-unidade', { texto: { email: unidade.email } })
    : '';

  let blocoHorarios = '';
  const horarios = unidade.horarios ?? [];
  if (horarios.length > 0) {
    const itens = horarios
      .map((horario) =>
        frag(ctx, 'parciais/horario-unidade', {
          texto: {
            dias: formatarDias(horario.dias),
            abre: horario.abre,
            fecha: horario.fecha
          },
          fragmento: {
            obs: horario.obs
              ? frag(ctx, 'parciais/horario-observacao', { texto: { texto: horario.obs } })
              : ''
          }
        })
      )
      .join('');
    blocoHorarios = frag(ctx, 'parciais/horarios-unidade', { fragmento: { itens } });
  } else if (ctx.rascunho) {
    blocoHorarios = frag(ctx, 'parciais/nota-revisao');
  }

  let blocoServicos = montarChipsServicos(ctx, unidade.servicos);
  if (!blocoServicos && ctx.rascunho) {
    blocoServicos = frag(ctx, 'parciais/nota-revisao');
  }

  const avisoConvenios = frag(ctx, 'parciais/convenios-aviso', {
    texto: {
      texto: blocoPorId(ctx, 'home', 'convenios-ressalva')?.texto ?? '',
      dataAtualizacao: dataAtualizacaoConvenios(
        ctx.dados.convenios?.atualizadoEm,
        (unidade.convenios ?? []).length
      )
    }
  });
  let blocoConvenios = '';
  const conveniosIds = unidade.convenios ?? [];
  if (conveniosIds.length > 0) {
    const itens = conveniosIds
      .map((id) => ctx.convenioPorId.get(id))
      .filter(Boolean)
      .map((convenio) => frag(ctx, 'parciais/chip', { texto: { nome: convenio.nome } }))
      .join('');
    blocoConvenios = `${frag(ctx, 'parciais/chip-lista', { fragmento: { itens } })}${avisoConvenios}`;
  } else {
    blocoConvenios = avisoConvenios;
  }

  let blocoParticular = '';
  if (unidade.atendimentoParticular === true) {
    blocoParticular = frag(ctx, 'parciais/particular-disponivel', {
      texto: { texto: blocoPorId(ctx, 'home', 'particular-disponivel')?.texto ?? '' }
    });
  } else if (unidade.atendimentoParticular === false) {
    blocoParticular = frag(ctx, 'parciais/particular-indisponivel', {
      texto: { texto: blocoPorId(ctx, 'home', 'particular-indisponivel')?.texto ?? '' }
    });
  } else if (ctx.rascunho) {
    blocoParticular = frag(ctx, 'parciais/nota-revisao');
  }

  let blocoMapa = '';
  if (temEndereco) {
    const consulta = enderecoEmLinha(unidade);
    const codificada = encodeURIComponent(consulta);
    const avisoMapa = blocoPorId(ctx, 'home', 'mapa-aviso')?.texto ?? '';
    blocoMapa = frag(ctx, 'parciais/mapa-fachada', {
      texto: {
        fonte: `https://www.google.com/maps?q=${codificada}&output=embed`,
        fonteLink: `https://www.google.com/maps/search/?api=1&query=${codificada}`,
        titulo: `Mapa de ${unidade.nomeExibicao}`,
        avisoMapa
      }
    });
  }

  const itensTrilha = [
    { rotulo: 'Início', url: '/' },
    { rotulo: 'Unidades', url: '/unidades/' },
    { rotulo: unidade.nomeExibicao, url: `/unidades/${unidade.slug}/` }
  ];

  const conteudo = frag(ctx, 'unidade', {
    texto: {
      nomeExibicao: unidade.nomeExibicao,
      cidade: unidade.cidade,
      uf: unidade.uf
    },
    fragmento: {
      breadcrumb: montarBreadcrumb(ctx, itensTrilha),
      pill: montarPill(ctx, unidade),
      seloRevisao,
      blocoEndereco,
      notaEnderecoMatriz:
        temEndereco && temEnderecoMatriz
          ? frag(ctx, 'parciais/nota-endereco-matriz', {
              texto: { texto: blocoPorId(ctx, 'home', 'nota-endereco-matriz')?.texto ?? '' }
            })
          : '',
      blocoTelefones,
      blocoWhatsapp,
      blocoEmail,
      blocoHorarios,
      blocoServicos,
      blocoConvenios,
      blocoParticular,
      blocoMapa,
      ctaExames: montarCta(ctx),
      avisoExterno: montarAvisoExterno(ctx)
    }
  });

  const servicosDaUnidade = (unidade.servicos ?? [])
    .map((id) => ctx.servicoPorId.get(id))
    .filter((servico) => servico && servicoAprovado(servico));

  return {
    rota: `/unidades/${unidade.slug}/`,
    titulo: tituloUnidade(unidade),
    descricao: descricaoUnidade(unidade, site.marca.nome),
    conteudo,
    robots: robotsTxt(ctx),
    jsonLd: [
      jsonLdOrganizacao(site, ctx.urlBase),
      jsonLdClinica(unidade, servicosDaUnidade, ctx.urlBase),
      jsonLdBreadcrumb(itensTrilha, ctx.urlBase)
    ]
  };
}

function paginaServicos(ctx) {
  const dadosPagina = ctx.dados.paginas.paginas.servicos;
  const itens = [
    { rotulo: 'Início', url: '/' },
    { rotulo: 'Serviços', url: '/servicos/' }
  ];
  const { titulo, blocos } = conteudoEditorial(ctx, 'servicos', {
    excluirIds: ['disclaimer-servico']
  });
  const conteudo = frag(ctx, 'servicos', {
    texto: { tituloPagina: titulo },
    fragmento: {
      breadcrumb: montarBreadcrumb(ctx, itens),
      blocos,
      lista: montarListaServicos(ctx),
      ctaExames: montarCta(ctx),
      avisoExterno: montarAvisoExterno(ctx)
    }
  });
  return {
    rota: '/servicos/',
    titulo: dadosPagina.seo.titulo,
    descricao: dadosPagina.seo.descricao,
    conteudo,
    robots: robotsTxt(ctx),
    jsonLd: [
      jsonLdOrganizacao(ctx.dados.site, ctx.urlBase),
      jsonLdPagina({ urlBase: ctx.urlBase, rota: '/servicos/', nome: dadosPagina.seo.titulo }),
      jsonLdBreadcrumb(itens, ctx.urlBase)
    ]
  };
}

function paginaServico(ctx, servico) {
  const site = ctx.dados.site;
  const aprovado = servicoAprovado(servico);
  const seloRevisao = ctx.rascunho && !aprovado ? frag(ctx, 'parciais/selo-revisao') : '';

  const resumo = servico.resumo
    ? frag(ctx, 'parciais/paragrafo', { texto: { texto: servico.resumo } })
    : ctx.rascunho
      ? frag(ctx, 'parciais/nota-revisao')
      : '';

  const descricao = (servico.descricao ?? [])
    .map((texto) => frag(ctx, 'parciais/paragrafo', { texto: { texto } }))
    .join('');

  const blocoIndicacoes =
    (servico.indicacoes ?? []).length > 0
      ? frag(ctx, 'parciais/bloco-lista', {
          texto: { titulo: 'Para que serve' },
          fragmento: {
            itens: servico.indicacoes
              .map((texto) => frag(ctx, 'parciais/lista-simples-item', { texto: { texto } }))
              .join('')
          }
        })
      : '';

  const blocoComoEfeito =
    (servico.comoEfeito ?? []).length > 0
      ? frag(ctx, 'parciais/bloco-lista', {
          texto: { titulo: 'Como é feito' },
          fragmento: {
            itens: servico.comoEfeito
              .map((texto) => frag(ctx, 'parciais/lista-simples-item', { texto: { texto } }))
              .join('')
          }
        })
      : '';

  const duracao = servico.duracaoMedia
    ? frag(ctx, 'parciais/paragrafo-duracao', { texto: { duracao: servico.duracaoMedia } })
    : '';

  const unidadesServico = ctx.publicacao.unidades.filter((unidade) =>
    (unidade.servicos ?? []).includes(servico.id)
  );
  let secaoUnidades = '';
  if (unidadesServico.length > 0) {
    const itens = unidadesServico
      .map((unidade) =>
        frag(ctx, 'parciais/item-unidade-link', {
          texto: { url: `/unidades/${unidade.slug}/`, nome: unidade.nomeExibicao }
        })
      )
      .join('');
    secaoUnidades = frag(ctx, 'parciais/secao-servico-unidades', {
      fragmento: { lista: frag(ctx, 'parciais/lista-simples', { fragmento: { itens } }) }
    });
  }

  const preparosServico = ctx.publicacao.preparos.filter(
    (preparo) => preparo.servicoId === servico.id
  );
  let secaoPreparo = '';
  if (preparosServico.length > 0 && temRota(ctx, '/preparo-de-exames/')) {
    const itens = preparosServico
      .map((preparo) =>
        frag(ctx, 'parciais/item-preparo-link', {
          texto: { url: `/preparo-de-exames/#${preparo.slug}`, exame: preparo.exame }
        })
      )
      .join('');
    secaoPreparo = frag(ctx, 'parciais/secao-servico-preparo', {
      fragmento: { lista: frag(ctx, 'parciais/lista-simples', { fragmento: { itens } }) }
    });
  }

  const itensTrilha = [
    { rotulo: 'Início', url: '/' },
    { rotulo: 'Serviços', url: '/servicos/' },
    { rotulo: servico.nome, url: `/servicos/${servico.slug}/` }
  ];

  const blocoDisclaimer = blocoPorId(ctx, 'servicos', 'disclaimer-servico');
  const disclaimer = blocoDisclaimer
    ? renderizarBlocos([blocoDisclaimer], ctx.templates)
    : '';

  const conteudo = frag(ctx, 'servico', {
    texto: { nome: servico.nome },
    fragmento: {
      breadcrumb: montarBreadcrumb(ctx, itensTrilha),
      seloRevisao,
      resumo,
      descricao,
      blocoIndicacoes,
      blocoComoEfeito,
      duracao,
      disclaimer,
      secaoUnidades,
      secaoPreparo,
      ctaExames: montarCta(ctx),
      avisoExterno: montarAvisoExterno(ctx)
    }
  });

  return {
    rota: `/servicos/${servico.slug}/`,
    titulo: `${servico.nome} | ${site.marca.nome}`,
    descricao: `${servico.nomeCurto ?? servico.nome} na ${site.marca.nome}: preparo, orientações e unidades que realizam o exame no Ceará. Conteúdo informativo que não substitui consulta médica.`,
    conteudo,
    robots: robotsTxt(ctx),
    jsonLd: [
      jsonLdOrganizacao(site, ctx.urlBase),
      jsonLdPagina({
        urlBase: ctx.urlBase,
        rota: `/servicos/${servico.slug}/`,
        nome: servico.nome,
        tipo: 'MedicalWebPage'
      }),
      jsonLdBreadcrumb(itensTrilha, ctx.urlBase)
    ]
  };
}

function montarAcordeao(ctx, preparo) {
  const selo = rotuloRevisaoPreparo(preparo);

  const resumo = preparo.resumo
    ? frag(ctx, 'parciais/paragrafo', { texto: { texto: preparo.resumo } })
    : '';

  const campos = [];
  if (preparo.jejum) campos.push(['Jejum', preparo.jejum]);
  if (preparo.hidratacao) campos.push(['Hidratação', preparo.hidratacao]);
  if (preparo.medicamentos) campos.push(['Medicamentos', preparo.medicamentos]);
  if ((preparo.documentos ?? []).length > 0) {
    campos.push(['Documentos', preparo.documentos.join('; ')]);
  }
  if (preparo.vestimenta) campos.push(['Vestimenta', preparo.vestimenta]);
  if (preparo.duracao) campos.push(['Duração estimada', preparo.duracao]);

  const dados =
    campos.length > 0
      ? frag(ctx, 'parciais/preparo-dados', {
          fragmento: {
            itens: campos
              .map(([rotulo, valor]) =>
                frag(ctx, 'parciais/preparo-dado', { texto: { rotulo, valor } })
              )
              .join('')
          }
        })
      : ctx.rascunho
        ? frag(ctx, 'parciais/nota-revisao')
        : '';

  const observacoes =
    (preparo.observacoes ?? []).length > 0
      ? frag(ctx, 'parciais/lista-simples', {
          fragmento: {
            itens: preparo.observacoes
              .map((texto) => frag(ctx, 'parciais/lista-simples-item', { texto: { texto } }))
              .join('')
          }
        })
      : '';

  const alerta = preparo.alerta
    ? frag(ctx, 'parciais/aviso-simples', { texto: { texto: preparo.alerta } })
    : '';

  const servicoDoPreparo = ctx.servicoPorId.get(preparo.servicoId);
  const linkServico =
    servicoDoPreparo && temRota(ctx, `/servicos/${servicoDoPreparo.slug}/`)
      ? frag(ctx, 'parciais/link-servico-preparo', {
          texto: { slug: servicoDoPreparo.slug, nome: servicoDoPreparo.nomeCurto ?? servicoDoPreparo.nome }
        })
      : '';

  return frag(ctx, 'parciais/acordeao-preparo', {
    texto: {
      ancora: preparo.slug,
      idPainel: `preparo-${preparo.slug}`,
      exame: preparo.exame,
      seloRevisao: selo
    },
    fragmento: {
      resumo,
      dados,
      observacoes,
      alerta,
      linkServico,
      avisoVariacao: frag(ctx, 'parciais/aviso-variacao', {
        texto: { texto: blocoPorId(ctx, 'preparo', 'aviso-variacao')?.texto ?? '' }
      })
    }
  });
}

function paginaPreparo(ctx) {
  const dadosPagina = ctx.dados.paginas.paginas.preparo;
  const acordeoes = ctx.publicacao.preparos.map((preparo) => montarAcordeao(ctx, preparo)).join('');
  const itens = [
    { rotulo: 'Início', url: '/' },
    { rotulo: 'Preparo de exames', url: '/preparo-de-exames/' }
  ];
  const { titulo, blocos } = conteudoEditorial(ctx, 'preparo', {
    excluirIds: ['aviso-variacao']
  });
  const conteudo = frag(ctx, 'preparo', {
    texto: { tituloPagina: titulo },
    fragmento: {
      breadcrumb: montarBreadcrumb(ctx, itens),
      blocos,
      acordeoes,
      ctaExames: montarCta(ctx),
      avisoExterno: montarAvisoExterno(ctx)
    }
  });
  return {
    rota: '/preparo-de-exames/',
    titulo: dadosPagina.seo.titulo,
    descricao: dadosPagina.seo.descricao,
    conteudo,
    robots: robotsTxt(ctx),
    jsonLd: [
      jsonLdOrganizacao(ctx.dados.site, ctx.urlBase),
      jsonLdPagina({
        urlBase: ctx.urlBase,
        rota: '/preparo-de-exames/',
        nome: dadosPagina.seo.titulo,
        tipo: 'MedicalWebPage'
      }),
      jsonLdBreadcrumb(itens, ctx.urlBase)
    ]
  };
}

function conteudoEditorial(ctx, chave, { excluirIds = [] } = {}) {
  const pagina = ctx.dados.paginas.paginas[chave];
  const blocos = pagina?.blocos ?? [];
  const visiveis = ctx.rascunho ? blocos : blocos.filter((bloco) => bloco?.status === 'aprovado');
  const indiceTitulo = visiveis.findIndex((bloco) => bloco?.tipo === 'titulo');
  const titulo = indiceTitulo >= 0 ? visiveis[indiceTitulo].texto : pagina?.seo?.titulo ?? '';
  const restantes = visiveis.filter(
    (bloco, indice) => indice !== indiceTitulo && !excluirIds.includes(bloco?.id)
  );
  return { titulo, blocos: renderizarBlocos(restantes, ctx.templates) };
}

function paginaSobre(ctx) {
  const site = ctx.dados.site;
  const dadosPagina = ctx.dados.paginas.paginas.sobre;
  const { titulo, blocos } = conteudoEditorial(ctx, 'sobre');
  const itens = [
    { rotulo: 'Início', url: '/' },
    { rotulo: 'Sobre', url: '/sobre/' }
  ];
  const textoRt = textoResponsavelTecnico(site);
  const responsavelTecnico = textoRt
    ? frag(ctx, 'parciais/rt-detalhe', { texto: { texto: textoRt } })
    : ctx.rascunho
      ? frag(ctx, 'parciais/nota-revisao')
      : '';

  const conteudo = frag(ctx, 'sobre', {
    texto: { tituloPagina: titulo },
    fragmento: {
      breadcrumb: montarBreadcrumb(ctx, itens),
      blocos,
      responsavelTecnico,
      ctaExames: montarCta(ctx),
      avisoExterno: montarAvisoExterno(ctx)
    }
  });

  return {
    rota: '/sobre/',
    titulo: dadosPagina.seo.titulo,
    descricao: dadosPagina.seo.descricao,
    conteudo,
    robots: robotsTxt(ctx),
    jsonLd: [
      jsonLdOrganizacao(site, ctx.urlBase),
      jsonLdPagina({ urlBase: ctx.urlBase, rota: '/sobre/', nome: dadosPagina.seo.titulo }),
      jsonLdBreadcrumb(itens, ctx.urlBase)
    ]
  };
}

function paginaConvenios(ctx) {
  const dadosPagina = ctx.dados.paginas.paginas.convenios;
  const { titulo, blocos } = conteudoEditorial(ctx, 'convenios');
  const itensTrilha = [
    { rotulo: 'Início', url: '/' },
    { rotulo: 'Convênios e particular', url: '/convenios-e-particular/' }
  ];
  const convenios = ctx.dados.convenios?.convenios ?? [];
  const itens = convenios
    .map((convenio) => {
      const unidades = ctx.publicacao.mapaConvenioUnidades.get(convenio.id) ?? [];
      const nomes = unidades.length > 0
        ? unidades.map((unidade) => unidade.nomeExibicao).join(', ')
        : 'Nenhuma unidade publicada nesta revisão.';
      return frag(ctx, 'parciais/convenio-item', {
        texto: { nome: convenio.nome, unidades: nomes }
      });
    })
    .join('');
  const lista = itens ? frag(ctx, 'parciais/lista-simples', { fragmento: { itens } }) : '';
  const ressalva = frag(ctx, 'parciais/convenios-aviso', {
    texto: {
      texto: blocoPorId(ctx, 'home', 'convenios-ressalva')?.texto ?? '',
      dataAtualizacao: dataAtualizacaoConvenios(
        ctx.dados.convenios?.atualizadoEm,
        convenios.length
      )
    }
  });

  const conteudo = frag(ctx, 'convenios', {
    texto: { tituloPagina: titulo },
    fragmento: {
      breadcrumb: montarBreadcrumb(ctx, itensTrilha),
      blocos,
      lista,
      ressalva,
      ctaExames: montarCta(ctx),
      avisoExterno: montarAvisoExterno(ctx)
    }
  });

  return {
    rota: '/convenios-e-particular/',
    titulo: dadosPagina.seo.titulo,
    descricao: dadosPagina.seo.descricao,
    conteudo,
    robots: robotsTxt(ctx),
    jsonLd: [
      jsonLdOrganizacao(ctx.dados.site, ctx.urlBase),
      jsonLdPagina({
        urlBase: ctx.urlBase,
        rota: '/convenios-e-particular/',
        nome: dadosPagina.seo.titulo
      }),
      jsonLdBreadcrumb(itensTrilha, ctx.urlBase)
    ]
  };
}

function montarContatoUnidade(ctx, unidade) {
  const telefones = (unidade.telefones ?? []).filter(telefoneValidado);
  const itensTelefones = telefones
    .map((telefone) =>
      frag(ctx, 'parciais/telefone-unidade', {
        texto: {
          e164: telefone.e164,
          formatado: formatarTelefone(telefone.e164),
          rotulo: telefone.rotulo ?? ''
        }
      })
    )
    .join('');
  return frag(ctx, 'parciais/contato-unidade', {
    texto: {
      nome: unidade.nomeExibicao,
      endereco: enderecoEmLinha(unidade),
      slug: unidade.slug
    },
    fragmento: {
      telefones: itensTelefones
        ? frag(ctx, 'parciais/telefones-unidade', { fragmento: { itens: itensTelefones } })
        : ''
    }
  });
}

function paginaContato(ctx) {
  const site = ctx.dados.site;
  const dadosPagina = ctx.dados.paginas.paginas.contato;
  const { titulo, blocos } = conteudoEditorial(ctx, 'contato');
  const itensTrilha = [
    { rotulo: 'Início', url: '/' },
    { rotulo: 'Contato', url: '/contato/' }
  ];
  const unidades = ctx.publicacao.unidades.map((unidade) => montarContatoUnidade(ctx, unidade)).join('');
  const listaUnidades = unidades
    ? frag(ctx, 'parciais/lista-simples', { fragmento: { itens: unidades } })
    : '';

  const matriz = matrizRodape(ctx.dados);
  const enderecoMatriz = matriz
    ? frag(ctx, 'parciais/rodape-endereco', {
        texto: {
          nomeExibicao: matriz.nomeExibicao,
          logradouro: matriz.endereco.logradouro,
          numero: matriz.endereco.numero,
          complemento: matriz.endereco.complemento ? `, ${matriz.endereco.complemento}` : '',
          bairro: matriz.endereco.bairro,
          cep: matriz.endereco.cep,
          cepFormatado: formatarCep(matriz.endereco.cep),
          cidade: matriz.cidade,
          uf: matriz.uf
        }
      })
    : '';

  let contatoInstitucional = '';
  const telefone = telefoneInstitucionalMatriz(ctx.dados);
  if (telefone) {
    contatoInstitucional += frag(ctx, 'parciais/rodape-telefone', {
      texto: { telefone, telefoneFormatado: formatarTelefone(telefone) }
    });
  }
  if (site.contatoInstitucional?.email) {
    contatoInstitucional += frag(ctx, 'parciais/rodape-email', {
      texto: { email: site.contatoInstitucional.email }
    });
  }

  const conteudo = frag(ctx, 'contato', {
    texto: { tituloPagina: titulo },
    fragmento: {
      breadcrumb: montarBreadcrumb(ctx, itensTrilha),
      blocos,
      listaUnidades,
      enderecoMatriz,
      contatoInstitucional
    }
  });

  return {
    rota: '/contato/',
    titulo: dadosPagina.seo.titulo,
    descricao: dadosPagina.seo.descricao,
    conteudo,
    robots: robotsTxt(ctx),
    jsonLd: [
      jsonLdOrganizacao(site, ctx.urlBase),
      jsonLdPagina({ urlBase: ctx.urlBase, rota: '/contato/', nome: dadosPagina.seo.titulo }),
      jsonLdBreadcrumb(itensTrilha, ctx.urlBase)
    ]
  };
}

function paginaPrivacidade(ctx) {
  const dadosPagina = ctx.dados.paginas.paginas.privacidade;
  const { titulo, blocos } = conteudoEditorial(ctx, 'privacidade');
  const itens = [
    { rotulo: 'Início', url: '/' },
    { rotulo: 'Política de privacidade', url: '/politica-de-privacidade/' }
  ];
  const conteudo = frag(ctx, 'privacidade', {
    texto: { tituloPagina: titulo },
    fragmento: { breadcrumb: montarBreadcrumb(ctx, itens), blocos }
  });
  return {
    rota: '/politica-de-privacidade/',
    titulo: dadosPagina.seo.titulo,
    descricao: dadosPagina.seo.descricao,
    conteudo,
    robots: robotsTxt(ctx),
    jsonLd: [
      jsonLdOrganizacao(ctx.dados.site, ctx.urlBase),
      jsonLdPagina({
        urlBase: ctx.urlBase,
        rota: '/politica-de-privacidade/',
        nome: dadosPagina.seo.titulo
      }),
      jsonLdBreadcrumb(itens, ctx.urlBase)
    ]
  };
}

function pagina404(ctx) {
  const dadosPagina = ctx.dados.paginas.paginas.naoEncontrado;
  const { titulo, blocos } = conteudoEditorial(ctx, 'naoEncontrado');
  const itensTrilha = [
    { rotulo: 'Início', url: '/' },
    { rotulo: 'Página não encontrada', url: '/404.html' }
  ];
  const links = [
    { rota: '/unidades/', rotulo: 'Ver unidades' },
    { rota: '/servicos/', rotulo: 'Ver serviços' },
    { rota: '/preparo-de-exames/', rotulo: 'Preparo de exames' },
    { rota: '/sobre/', rotulo: 'Sobre a Terradic' },
    { rota: '/contato/', rotulo: 'Contato' }
  ]
    .filter((item) => temRota(ctx, item.rota))
    .map((item) => frag(ctx, 'parciais/lista-link-item', { texto: { url: item.rota, rotulo: item.rotulo } }))
    .join('');

  return {
    rota: '/404.html',
    titulo: dadosPagina.seo.titulo,
    descricao: dadosPagina.seo.descricao,
    conteudo: frag(ctx, '404', {
      texto: { tituloPagina: titulo },
      fragmento: { breadcrumb: montarBreadcrumb(ctx, itensTrilha), blocos, links }
    }),
    robots: robotsTxt(ctx, { noindex: true }),
    jsonLd: [
      jsonLdOrganizacao(ctx.dados.site, ctx.urlBase),
      jsonLdBreadcrumb(itensTrilha, ctx.urlBase)
    ]
  };
}

export function planejarRotas(dados, publicacao, { rascunho = false } = {}) {
  const rotas = [{ rota: '/', tipo: 'home', lastmod: dados.site.atualizadoEm }];

  if (publicacao.unidades.length > 0) {
    rotas.push({ rota: '/unidades/', tipo: 'unidades', lastmod: dados.unidades.atualizadoEm });
  }
  if (publicacao.servicos.length > 0) {
    rotas.push({ rota: '/servicos/', tipo: 'servicos', lastmod: dados.servicos.atualizadoEm });
  }
  if (publicacao.preparos.length > 0) {
    rotas.push({ rota: '/preparo-de-exames/', tipo: 'preparo', lastmod: dados.preparos.atualizadoEm });
  }

  const paginas = dados.paginas?.paginas ?? {};
  const podeEntrar = (chave, { exigirBlocos = true } = {}) => {
    const pagina = paginas[chave];
    if (!pagina) {
      return false;
    }
    if (exigirBlocos && !paginaTemBlocos(dados, chave)) {
      return false;
    }
    return rascunho || paginaEditorialPublicavel(dados, chave);
  };

  if (podeEntrar('sobre')) {
    rotas.push({ rota: '/sobre/', tipo: 'sobre', lastmod: dados.paginas.atualizadoEm });
  }
  if (podeEntrar('convenios')) {
    rotas.push({
      rota: '/convenios-e-particular/',
      tipo: 'convenios',
      lastmod: dados.paginas.atualizadoEm
    });
  }
  if (podeEntrar('contato') && matrizRodape(dados) && telefoneInstitucionalMatriz(dados)) {
    rotas.push({ rota: '/contato/', tipo: 'contato', lastmod: dados.paginas.atualizadoEm });
  }
  if (dados.site.privacidade?.politicaPublicada === true && podeEntrar('privacidade')) {
    rotas.push({
      rota: '/politica-de-privacidade/',
      tipo: 'privacidade',
      lastmod: dados.paginas.atualizadoEm
    });
  }

  for (const unidade of publicacao.unidades) {
    rotas.push({
      rota: `/unidades/${unidade.slug}/`,
      tipo: 'unidade',
      unidade,
      lastmod: unidade.atualizadoEm ?? dados.site.atualizadoEm
    });
  }
  for (const servico of publicacao.servicos) {
    rotas.push({
      rota: `/servicos/${servico.slug}/`,
      tipo: 'servico',
      servico,
      lastmod: dados.servicos.atualizadoEm
    });
  }

  rotas.push({ rota: '/404.html', tipo: 'naoEncontrado', lastmod: dados.site.atualizadoEm });
  return rotas.sort((a, b) => (a.rota < b.rota ? -1 : a.rota > b.rota ? 1 : 0));
}

function montarPagina(ctx, descritor) {
  switch (descritor.tipo) {
    case 'home':
      return paginaHome(ctx);
    case 'unidades':
      return paginaUnidades(ctx);
    case 'unidade':
      return paginaUnidade(ctx, descritor.unidade);
    case 'servicos':
      return paginaServicos(ctx);
    case 'servico':
      return paginaServico(ctx, descritor.servico);
    case 'preparo':
      return paginaPreparo(ctx);
    case 'sobre':
      return paginaSobre(ctx);
    case 'convenios':
      return paginaConvenios(ctx);
    case 'contato':
      return paginaContato(ctx);
    case 'privacidade':
      return paginaPrivacidade(ctx);
    case 'naoEncontrado':
      return pagina404(ctx);
    default:
      throw new Error(`Tipo de pagina desconhecido: ${descritor.tipo}`);
  }
}

function imagemOgDaRota(rota) {
  if (rota === '/') {
    return '/assets/og-home.png';
  }
  if (rota.startsWith('/unidades')) {
    return '/assets/og-unidade.png';
  }
  if (rota.startsWith('/servicos')) {
    return '/assets/og-servico.png';
  }
  if (rota.startsWith('/preparo-de-exames')) {
    return '/assets/og-preparo.png';
  }
  return '/assets/og-institucional.png';
}

function renderizarLayout(ctx, pagina) {
  const meta = metadados({
    urlBase: ctx.urlBase,
    rota: pagina.rota,
    titulo: pagina.titulo,
    descricao: pagina.descricao,
    imagem: imagemOgDaRota(pagina.rota)
  });

  const jsonLdScript =
    pagina.jsonLd.length > 0
      ? frag(ctx, 'parciais/json-ld', {
          fragmento: { json: serializarJsonLd(pagina.jsonLd) }
        })
      : '';

  return frag(ctx, 'layout', {
    texto: {
      ...meta,
      marcaNome: ctx.dados.site.marca.nome,
      robots: pagina.robots
    },
    fragmento: {
      jsonLdScript,
      faixaRevisao: ctx.rascunho ? frag(ctx, 'parciais/faixa-revisao') : '',
      cabecalho: montarCabecalho(ctx, pagina.rota),
      conteudo: pagina.conteudo,
      rodape: montarRodape(ctx)
    }
  });
}

/**
 * Renderiza o site inteiro em memoria. Retorna a lista de paginas com rota, html,
 * lastmod e tipo. Nao escreve arquivos (quem escreve e o build).
 */
export function gerarPaginas({ dados, publicacao, templates, urlBase, rascunho }) {
  const rotas = planejarRotas(dados, publicacao, { rascunho });
  const servicos = dados.servicos?.servicos ?? [];
  const ctx = {
    dados,
    publicacao,
    templates,
    urlBase,
    rascunho,
    rotas,
    servicos,
    servicoPorId: new Map(servicos.map((item) => [item.id, item])),
    convenioPorId: new Map((dados.convenios?.convenios ?? []).map((item) => [item.id, item]))
  };

  return rotas.map((descritor) => {
    const pagina = montarPagina(ctx, descritor);
    return {
      rota: descritor.rota,
      tipo: descritor.tipo,
      lastmod: descritor.lastmod,
      html: renderizarLayout(ctx, pagina)
    };
  });
}
