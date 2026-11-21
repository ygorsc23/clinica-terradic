/**
 * Metadados e dados estruturados (Fase 5): title/description, canonical, OG/Twitter e
 * JSON-LD Organization/WebSite/MedicalClinic/WebPage/MedicalWebPage/BreadcrumbList.
 * Nunca emitir aggregateRating, review, offer ou preco.
 */

export function urlAbsoluta(urlBase, rota) {
  if (rota === '/') {
    return `${urlBase}/`;
  }
  return `${urlBase}${rota}`;
}

export function metadados({ urlBase, rota, titulo, descricao, tipo = 'website', imagem = null }) {
  const url = urlAbsoluta(urlBase, rota);
  return {
    titulo,
    descricao,
    canonical: url,
    ogTitulo: titulo,
    ogDescricao: descricao,
    ogUrl: url,
    ogTipo: tipo,
    ogImagem: `${urlBase}${imagem ?? '/assets/og-institucional.png'}`
  };
}

export function jsonLdOrganizacao(site, urlBase) {
  const organizacao = {
    '@type': 'Organization',
    '@id': `${urlBase}/#organizacao`,
    name: site.marca.nome,
    legalName: site.marca.razaoSocial,
    taxID: site.marca.cnpj,
    url: `${urlBase}/`,
    logo: `${urlBase}/assets/marca-provisoria.svg`
  };
  const sameAs = [site.redesSociais?.instagram, site.redesSociais?.facebook].filter(Boolean);
  if (sameAs.length > 0) {
    organizacao.sameAs = sameAs;
  }
  return organizacao;
}

export function jsonLdSite(site, urlBase) {
  return {
    '@type': 'WebSite',
    '@id': `${urlBase}/#site`,
    url: `${urlBase}/`,
    name: site.marca.nome,
    inLanguage: 'pt-BR',
    publisher: { '@id': `${urlBase}/#organizacao` }
  };
}

export function jsonLdPagina({ urlBase, rota, nome, tipo = 'WebPage' }) {
  const url = urlAbsoluta(urlBase, rota);
  return {
    '@type': tipo,
    '@id': `${url}#pagina`,
    url,
    name: nome,
    inLanguage: 'pt-BR',
    isPartOf: { '@id': `${urlBase}/#site` }
  };
}

const DIAS_SCHEMA = {
  seg: 'Monday',
  ter: 'Tuesday',
  qua: 'Wednesday',
  qui: 'Thursday',
  sex: 'Friday',
  sab: 'Saturday',
  dom: 'Sunday'
};

export function jsonLdClinica(unidade, servicos, urlBase) {
  const url = `${urlBase}/unidades/${unidade.slug}/`;
  const clinica = {
    '@type': 'MedicalClinic',
    '@id': `${url}#clinica`,
    name: unidade.nomeExibicao,
    url,
    parentOrganization: { '@id': `${urlBase}/#organizacao` },
    areaServed: { '@type': 'City', name: unidade.cidade }
  };

  const telefone = (unidade.telefones ?? []).find((item) => item?.e164 && item?.validado !== false);
  if (telefone) {
    clinica.telephone = telefone.e164;
  }

  const endereco = unidade.endereco ?? {};
  if (endereco.logradouro && endereco.numero && endereco.bairro && endereco.cep) {
    const complemento = endereco.complemento ? `, ${endereco.complemento}` : '';
    clinica.address = {
      '@type': 'PostalAddress',
      streetAddress: `${endereco.logradouro}, ${endereco.numero}${complemento}`,
      addressLocality: unidade.cidade,
      addressRegion: unidade.uf,
      postalCode: endereco.cep,
      addressCountry: 'BR'
    };
  }

  if (
    typeof unidade.geo?.lat === 'number' &&
    typeof unidade.geo?.lng === 'number' &&
    ['exata', 'aproximada'].includes(unidade.geo?.precisao) &&
    Array.isArray(unidade.validacao?.fontes) &&
    unidade.validacao.fontes.length > 0
  ) {
    clinica.geo = {
      '@type': 'GeoCoordinates',
      latitude: unidade.geo.lat,
      longitude: unidade.geo.lng
    };
  }

  const horarios = (unidade.horarios ?? []).filter((item) => item?.abre && item?.fecha);
  if (horarios.length > 0) {
    clinica.openingHoursSpecification = horarios.map((item) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: (item.dias ?? []).map((dia) => DIAS_SCHEMA[dia]).filter(Boolean),
      opens: item.abre,
      closes: item.fecha
    }));
  }

  if (servicos.length > 0) {
    clinica.availableService = servicos.map((servico) => ({
      '@type': 'MedicalTest',
      name: servico.nome
    }));
  }

  return clinica;
}

export function jsonLdBreadcrumb(itens, urlBase) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: itens.map((item, indice) => ({
      '@type': 'ListItem',
      position: indice + 1,
      name: item.rotulo,
      item: urlAbsoluta(urlBase, item.url)
    }))
  };
}

export function serializarJsonLd(objetos) {
  const grafo = {
    '@context': 'https://schema.org',
    '@graph': objetos
  };
  // `<` escapado evita fechamento prematuro do <script> e mantem o JSON valido.
  return JSON.stringify(grafo).replace(/</g, '\\u003c');
}
