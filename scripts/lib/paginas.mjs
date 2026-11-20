import { modelo, template } from './render.mjs';
import {
  enderecoEmLinha,
  formatarDias,
  formatarTelefone,
  preparoAprovado,
  servicoAprovado,
  telefoneValidado,
  unidadePublicavel
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
import { renderizarBlocos, separarBlocosHero } from './blocos.mjs';

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

function blocosDaPagina(ctx, chave) {
  return renderizarBlocos(ctx.dados.paginas.paginas[chave]?.blocos ?? [], ctx.templates);
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
  return frag(ctx, 'parciais/aviso-externo', {
    texto: { instrucoes: textoInstrucoes(ctx) }
  });
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
  return frag(ctx, 'parciais/cabecalho', {
    texto: { marcaNome: ctx.dados.site.marca.nome },
    fragmento: {
      nav: montarNav(ctx, rotaAtual),
      ctaExames: montarCta(ctx)
    }
  });
}

function montarRodape(ctx) {
  const site = ctx.dados.site;
  const publicacao = ctx.publicacao;

  const matriz = publicacao.unidades.find((unidade) => unidade.matriz);
  let blocoEnderecoMatriz = '';
  if (matriz?.endereco?.logradouro && matriz?.endereco?.numero && matriz?.endereco?.cep) {
    blocoEnderecoMatriz = frag(ctx, 'parciais/rodape-endereco', {
      texto: {
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
  const telefone = site.contatoInstitucional?.telefoneE164;
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

  const rt = site.responsavelTecnico;
  let blocoResponsavelTecnico = '';
  if (rt?.status === 'confirmado' && rt.nome && rt.crm) {
    blocoResponsavelTecnico = frag(ctx, 'parciais/rodape-responsavel', {
      texto: { nome: rt.nome, crm: rt.crm, uf: rt.crmUf, especialidade: rt.especialidade }
    });
  }

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

function formatarCep(cep) {
  const digitos = String(cep ?? '').replace(/\D/g, '');
  if (digitos.length !== 8) {
    return String(cep ?? '');
  }
  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`;
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
  return noindex ? 'noindex, follow' : 'index, follow';
}

function paginaHome(ctx) {
  const dadosPagina = ctx.dados.paginas.paginas.home;
  const temUnidades = temRota(ctx, '/unidades/');
  const { titulo, paragrafo, restantes } = separarBlocosHero(dadosPagina.blocos ?? []);

  const secaoHero = frag(ctx, 'parciais/secao-hero-home', {
    texto: {
      tituloHero: titulo?.texto ?? dadosPagina.seo.titulo,
      textoHero: paragrafo?.texto ?? ''
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
          fragmento: {
            linkTodos: frag(ctx, 'parciais/link-todos', {
              texto: { url: '/unidades/', rotulo: 'Ver todas as unidades' }
            }),
            lista: montarListaUnidades(ctx)
          }
        })
      : '';

  const secaoPortal = frag(ctx, 'parciais/secao-portal-home', {
    texto: { instrucoes: textoInstrucoes(ctx) },
    fragmento: { ctaExames: montarCta(ctx), avisoExterno: montarAvisoExterno(ctx) }
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
  const conteudo = frag(ctx, 'unidades', {
    fragmento: {
      breadcrumb: montarBreadcrumb(ctx, itens),
      blocos: blocosDaPagina(ctx, 'unidades'),
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
  const confirmada = unidadePublicavel(unidade);
  const seloRevisao = ctx.rascunho && !confirmada ? frag(ctx, 'parciais/selo-revisao') : '';
  const endereco = unidade.endereco ?? {};
  const telefones = (unidade.telefones ?? []).filter(telefoneValidado);
  const temEndereco = Boolean(
    endereco.logradouro && endereco.numero && endereco.bairro && endereco.cep
  );

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
          texto: { numero: String(whatsapp.e164).replace(/\D/g, '') }
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
    texto: { atualizadoEm: formatarData(ctx.dados.convenios?.atualizadoEm) }
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
    blocoParticular = frag(ctx, 'parciais/particular-disponivel');
  } else if (unidade.atendimentoParticular === false) {
    blocoParticular = frag(ctx, 'parciais/particular-indisponivel');
  } else if (ctx.rascunho) {
    blocoParticular = frag(ctx, 'parciais/nota-revisao');
  }

  let blocoMapa = '';
  if (temEndereco) {
    const consulta = enderecoEmLinha(unidade);
    const codificada = encodeURIComponent(consulta);
    blocoMapa = frag(ctx, 'parciais/mapa-fachada', {
      texto: {
        fonte: `https://www.google.com/maps?q=${codificada}&output=embed`,
        fonteLink: `https://www.google.com/maps/search/?api=1&query=${codificada}`,
        titulo: `Mapa de ${unidade.nomeExibicao}`
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
      notaEnderecoMatriz: temEndereco ? frag(ctx, 'parciais/nota-endereco-matriz') : '',
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
  const conteudo = frag(ctx, 'servicos', {
    fragmento: {
      breadcrumb: montarBreadcrumb(ctx, itens),
      blocos: blocosDaPagina(ctx, 'servicos'),
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
      avisoVariacao: frag(ctx, 'parciais/aviso-variacao')
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
  const conteudo = frag(ctx, 'preparo', {
    fragmento: {
      breadcrumb: montarBreadcrumb(ctx, itens),
      blocos: blocosDaPagina(ctx, 'preparo'),
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
      jsonLdPagina({ urlBase: ctx.urlBase, rota: '/preparo-de-exames/', nome: dadosPagina.seo.titulo }),
      jsonLdBreadcrumb(itens, ctx.urlBase)
    ]
  };
}

function pagina404(ctx) {
  const dadosPagina = ctx.dados.paginas.paginas.naoEncontrado;
  const itensTrilha = [
    { rotulo: 'Início', url: '/' },
    { rotulo: 'Página não encontrada', url: '/404.html' }
  ];
  const links = [
    { rota: '/unidades/', rotulo: 'Ver unidades' },
    { rota: '/servicos/', rotulo: 'Ver serviços' },
    { rota: '/preparo-de-exames/', rotulo: 'Preparo de exames' }
  ]
    .filter((item) => temRota(ctx, item.rota))
    .map((item) => frag(ctx, 'parciais/lista-link-item', { texto: { url: item.rota, rotulo: item.rotulo } }))
    .join('');

  return {
    rota: '/404.html',
    titulo: dadosPagina.seo.titulo,
    descricao: dadosPagina.seo.descricao,
    conteudo: frag(ctx, '404', {
      fragmento: { breadcrumb: montarBreadcrumb(ctx, itensTrilha), links }
    }),
    robots: robotsTxt(ctx, { noindex: true }),
    jsonLd: []
  };
}

export function planejarRotas(dados, publicacao) {
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
    case 'naoEncontrado':
      return pagina404(ctx);
    default:
      throw new Error(`Tipo de pagina desconhecido: ${descritor.tipo}`);
  }
}

function renderizarLayout(ctx, pagina) {
  const meta = metadados({
    urlBase: ctx.urlBase,
    rota: pagina.rota,
    titulo: pagina.titulo,
    descricao: pagina.descricao
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
  const rotas = planejarRotas(dados, publicacao);
  const ctx = {
    dados,
    publicacao,
    templates,
    urlBase,
    rascunho,
    rotas,
    servicoPorId: new Map((dados.servicos?.servicos ?? []).map((item) => [item.id, item])),
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
