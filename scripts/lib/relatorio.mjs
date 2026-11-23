import {
  telefoneValidado,
  unidadeAtivaConfirmada,
  unidadePublicavel,
  unidadeTemServicoAprovado
} from './dados.mjs';

const CAMPOS_STATUS_OK = new Set([
  'ativo',
  'confirmado',
  'aprovado',
  'oficial',
  'publicada',
  'publicado'
]);

function ehValorPendente(valor) {
  if (valor === null || valor === undefined) {
    return true;
  }
  if (typeof valor === 'string' && valor.trim() === '') {
    return true;
  }
  if (Array.isArray(valor) && valor.length === 0) {
    return true;
  }
  return false;
}

const CAMPOS_IGNORADOS = new Set(['analytics', 'matriz']);
const CAMPOS_BOOLEANOS_PENDENTES = new Set([
  'validado',
  'logoAutorizado',
  'autorizacaoImagem',
  'politicaPublicada'
]);

function percorrer(valor, caminho, destino) {
  const chaveFinal = caminho.split('.').pop() ?? '';
  if (CAMPOS_IGNORADOS.has(chaveFinal)) {
    return;
  }
  if (ehValorPendente(valor)) {
    destino.push({ campo: caminho || '(raiz)', situacao: Array.isArray(valor) ? 'lista vazia' : 'vazio' });
    return;
  }
  if (Array.isArray(valor)) {
    valor.forEach((item, indice) => percorrer(item, `${caminho}[${indice}]`, destino));
    return;
  }
  if (typeof valor === 'object') {
    for (const [chave, filho] of Object.entries(valor)) {
      percorrer(filho, caminho ? `${caminho}.${chave}` : chave, destino);
    }
    return;
  }
  if (valor === false && CAMPOS_BOOLEANOS_PENDENTES.has(chaveFinal)) {
    destino.push({ campo: caminho, situacao: 'false' });
    return;
  }
  if (caminho === 'geo.precisao' && valor === 'aproximada') {
    destino.push({ campo: caminho, situacao: 'aproximada (bloco geo omitido do JSON-LD)' });
    return;
  }
  if (typeof valor === 'string' && /^(pendente|parcial|provisoria|rascunho|a-confirmar|desatualizado)$/.test(valor)) {
    destino.push({ campo: caminho, situacao: `status: ${valor}` });
  }
}

function pendenciasDe(objeto) {
  const destino = [];
  percorrer(objeto, '', destino);
  return destino;
}

function blocosPendentes(dados) {
  const destino = [];
  for (const [pagina, config] of Object.entries(dados.paginas?.paginas ?? {})) {
    (config?.blocos ?? []).forEach((bloco, indice) => {
      if (bloco?.status === 'pendente') {
        destino.push({
          pagina,
          indice,
          tipo: bloco.tipo ?? null,
          id: bloco.id ?? null
        });
      }
    });
  }
  return destino;
}

function simNao(valor) {
  return valor ? 'sim' : 'não';
}

export function gerarRelatorio({ dados, publicacao }) {
  const site = dados.site ?? {};
  const unidades = dados.unidades?.unidades ?? [];
  const servicos = dados.servicos?.servicos ?? [];
  const preparos = dados.preparos?.preparos ?? [];
  const convenios = dados.convenios?.convenios ?? [];

  const unidadeSemEndereco = unidades.some(
    (unidade) =>
      !unidade.endereco?.logradouro ||
      !unidade.endereco?.numero ||
      !unidade.endereco?.bairro ||
      !unidade.endereco?.cep
  );
  const unidadeSemTelefone = unidades.some(
    (unidade) => !(unidade.telefones ?? []).some(telefoneValidado)
  );
  const unidadeSemHorario = unidades.some((unidade) => (unidade.horarios ?? []).length === 0);
  const unidadeSemServico = unidades.some((unidade) => (unidade.servicos ?? []).length === 0);
  const unidadeSemServicoAprovado = unidades.some(
    (unidade) => !unidadeTemServicoAprovado(unidade, servicos)
  );
  const unidadeSemConvenio = unidades.some((unidade) => (unidade.convenios ?? []).length === 0);
  const unidadeSemParticular = unidades.some((unidade) => unidade.atendimentoParticular == null);
  const preparoPendente = preparos.some((preparo) => preparo.revisao?.status !== 'aprovado');
  const servicoPendente = servicos.some((servico) => servico.status !== 'aprovado');
  const unidadeNaoConfirmada = unidades.some((unidade) => !unidadeAtivaConfirmada(unidade));
  const blocosPendentesJson = blocosPendentes(dados);
  const textoInstitucionalPendente = blocosPendentesJson.some((bloco) =>
    ['home', 'sobre'].includes(bloco.pagina)
  );
  const aceiteIdentidade = site.identidadeVisual?.aceiteFormal;
  const aceiteIdentidadeValido =
    aceiteIdentidade &&
    Boolean(aceiteIdentidade.aceitoPor) &&
    Boolean(aceiteIdentidade.data) &&
    Boolean(aceiteIdentidade.documento);

  const bloqueios = [
    {
      id: 'C-01',
      item: 'Confirmar quais unidades estão ativas (inclui Quixeramobim)',
      responsavel: 'Clínica',
      pendente: unidadeNaoConfirmada,
      bloqueia: true
    },
    {
      id: 'C-02',
      item: 'Endereço completo, CEP e coordenadas de cada unidade',
      responsavel: 'Clínica',
      pendente: unidadeSemEndereco,
      bloqueia: true
    },
    {
      id: 'C-03',
      item: 'Telefones oficiais por unidade (e WhatsApp oficial, se houver)',
      responsavel: 'Clínica',
      pendente: unidadeSemTelefone,
      bloqueia: true
    },
    {
      id: 'C-04',
      item: 'Horários de funcionamento por unidade',
      responsavel: 'Clínica',
      pendente: unidadeSemHorario,
      bloqueia: true
    },
    {
      id: 'C-05',
      item: 'Serviços realizados em cada unidade',
      responsavel: 'Clínica',
      pendente: unidadeSemServico || unidadeSemServicoAprovado || servicoPendente,
      bloqueia: true
    },
    {
      id: 'C-06',
      item: 'Convênios aceitos por unidade (lista nominal e vigência)',
      responsavel: 'Clínica',
      pendente: convenios.length === 0 || unidadeSemConvenio,
      bloqueia: true
    },
    {
      id: 'C-07',
      item: 'Formas de pagamento, documentos exigidos e atendimento particular',
      responsavel: 'Clínica',
      pendente: unidadeSemParticular,
      bloqueia: true
    },
    {
      id: 'C-08',
      item: 'Responsável técnico: nome, CRM/UF e especialidade',
      responsavel: 'Clínica',
      pendente: site.responsavelTecnico?.status !== 'confirmado',
      bloqueia: true
    },
    {
      id: 'C-09',
      item: 'Textos de preparo revisados e aprovados pelo responsável técnico',
      responsavel: 'RT',
      pendente: preparoPendente,
      bloqueia: true
    },
    {
      id: 'C-10',
      item: 'Texto institucional, história e diferenciais verificáveis',
      responsavel: 'Clínica',
      pendente: textoInstitucionalPendente,
      bloqueia: true
    },
    {
      id: 'C-11',
      item: 'Logotipo em SVG, cores oficiais, tipografia, fotos reais e autorizações de imagem',
      responsavel: 'Clínica',
      pendente: site.identidadeVisual?.status !== 'oficial' && !aceiteIdentidadeValido,
      bloqueia: true
    },
    {
      id: 'C-12',
      item: 'Domínio definitivo e acesso ao DNS/hospedagem',
      responsavel: 'Clínica',
      pendente: true,
      bloqueia: true,
      observacao:
        'Domínio configurado em urlBase; acesso ao DNS/hospedagem é dependência operacional do cliente e não é inferida pelo build.'
    },
    {
      id: 'C-13',
      item: 'Prazo médio de laudo (somente se a clínica decidir divulgar)',
      responsavel: 'Clínica',
      pendente: servicos.some((servico) => !servico.duracaoMedia),
      bloqueia: false
    },
    {
      id: 'C-14',
      item: 'Política de privacidade / aviso legal aprovado',
      responsavel: 'Clínica + jurídico',
      pendente: site.privacidade?.politicaPublicada !== true,
      bloqueia: true
    },
    {
      id: 'C-15',
      item: 'E-mail institucional oficial e redes sociais oficiais',
      responsavel: 'Clínica',
      pendente: !site.contatoInstitucional?.email,
      bloqueia: true
    }
  ];

  const json = {
    geradoDe: 'dados/*.json',
    dataDosDados: site.atualizadoEm ?? null,
    identidadeVisual: site.identidadeVisual ?? null,
    t013Rodape: {
      status: 'parcial',
      motivo:
        'Rodapé condicional: razão social e CNPJ são publicados; RT/CRM, contato institucional e endereço da matriz dependem de C-08, C-15 e C-02. O go-live estrito falha enquanto esses dados faltarem.'
    },
    resumo: {
      unidades: unidades.length,
      unidadesPublicaveis: publicacao?.unidades?.length ?? 0,
      servicos: servicos.length,
      servicosPublicaveis: publicacao?.servicos?.length ?? 0,
      preparos: preparos.length,
      preparosPublicaveis: publicacao?.preparos?.length ?? 0,
      convenios: convenios.length
    },
    bloqueios,
    blocosPendentes: blocosPendentesJson,
    site: pendenciasDe({
      marca: site.marca,
      urlBase: site.urlBase,
      portalExames: site.portalExames,
      contatoInstitucional: site.contatoInstitucional,
      responsavelTecnico: site.responsavelTecnico,
      redesSociais: site.redesSociais,
      analytics: site.analytics,
      identidadeVisual: site.identidadeVisual,
      privacidade: site.privacidade
    }),
    unidades: unidades.map((unidade) => ({
      id: unidade.id,
      slug: unidade.slug,
      nomeExibicao: unidade.nomeExibicao,
      status: unidade.status,
      validacao: unidade.validacao?.status ?? null,
      publicavel: unidadePublicavel(unidade, servicos),
      pendencias: pendenciasDe(unidade)
    })),
    servicos: servicos.map((servico) => ({
      id: servico.id,
      slug: servico.slug,
      nome: servico.nome,
      status: servico.status,
      pendencias: pendenciasDe(servico)
    })),
    preparos: preparos.map((preparo) => ({
      id: preparo.id,
      slug: preparo.slug,
      exame: preparo.exame,
      revisao: preparo.revisao?.status ?? null,
      pendencias: pendenciasDe(preparo)
    })),
    paginas: pendenciasDe(dados.paginas?.paginas ?? {})
  };

  const linhas = [];
  linhas.push('# Pendências de conteúdo — Terradic');
  linhas.push('');
  linhas.push(`Baseado em \`dados/*.json\` (data de atualização dos dados: ${site.atualizadoEm ?? 'não informada'}).`);
  linhas.push('');
  linhas.push('> **Identidade visual provisória.** A paleta e o logo publicados são placeholders derivados de flyer');
  linhas.push('> de campanha (Pacajus), não são a marca oficial. A troca depende de C-11 (brandbook + SVG).');
  linhas.push('> Nenhum telefone, endereço ou horário de exemplo do levantamento é usado no site.');
  linhas.push('');
  linhas.push('> **T013 (rodapé) - parcial.** Razão social e CNPJ já são publicados, mas RT/CRM/UF/especialidade, contato');
  linhas.push('> institucional e endereço/telefone da matriz seguem pendentes (C-08, C-15 e C-02). O rodapé mantém');
  linhas.push('> os blocos condicionais; `npm run build:go-live` falha enquanto esses dados não forem confirmados.');
  linhas.push('');
  linhas.push('## Resumo do build');
  linhas.push('');
  linhas.push('| Item | Total | Publicável agora |');
  linhas.push('|---|---|---|');
  linhas.push(`| Unidades | ${unidades.length} | ${publicacao?.unidades?.length ?? 0} |`);
  linhas.push(`| Serviços | ${servicos.length} | ${publicacao?.servicos?.length ?? 0} |`);
  linhas.push(`| Preparos | ${preparos.length} | ${publicacao?.preparos?.length ?? 0} |`);
  linhas.push(`| Convênios | ${convenios.length} | — |`);
  linhas.push('');
  linhas.push('## Bloqueios de go-live');
  linhas.push('');
  linhas.push('| Dependência | Item | Responsável | Pendente | Bloqueia go-live |');
  linhas.push('|---|---|---|---|---|');
  for (const bloqueio of bloqueios) {
    linhas.push(
      `| ${bloqueio.id} | ${bloqueio.item} | ${bloqueio.responsavel} | ${simNao(bloqueio.pendente)} | ${simNao(bloqueio.bloqueia)} |`
    );
  }
  linhas.push('');
  linhas.push('> C-02: a ausência de `geo` é listada nas unidades, mas **não** bloqueia o go-live; o bloqueio de C-02 é o endereço/CEP.');
  linhas.push('> C-12: o domínio configurado em `urlBase` é verificável por dados; o acesso operacional ao DNS/hospedagem é dependência do cliente e não é inferido pelo build.');
  linhas.push('');
  linhas.push('## Site');
  linhas.push('');
  linhas.push('| Campo | Situação |');
  linhas.push('|---|---|');
  for (const pendencia of pendenciasDe({
    marca: site.marca,
    urlBase: site.urlBase,
    portalExames: site.portalExames,
    contatoInstitucional: site.contatoInstitucional,
    responsavelTecnico: site.responsavelTecnico,
    redesSociais: site.redesSociais,
    analytics: site.analytics,
    identidadeVisual: site.identidadeVisual,
    privacidade: site.privacidade
  })) {
    linhas.push(`| \`${pendencia.campo}\` | ${pendencia.situacao} |`);
  }

  linhas.push('');
  linhas.push('## Unidades');
  for (const unidade of json.unidades) {
    linhas.push('');
    linhas.push(`### ${unidade.nomeExibicao} (\`${unidade.slug}\`) — status ${unidade.status}, validação ${unidade.validacao}`);
    linhas.push('');
    if (unidade.pendencias.length === 0) {
      linhas.push('Sem pendências registradas.');
      continue;
    }
    linhas.push('| Campo | Situação |');
    linhas.push('|---|---|');
    for (const pendencia of unidade.pendencias) {
      linhas.push(`| \`${pendencia.campo}\` | ${pendencia.situacao} |`);
    }
  }

  linhas.push('');
  linhas.push('## Serviços');
  for (const servico of json.servicos) {
    linhas.push('');
    linhas.push(`### ${servico.nome} (\`${servico.slug}\`) — status ${servico.status}`);
    linhas.push('');
    if (servico.pendencias.length === 0) {
      linhas.push('Sem pendências registradas.');
      continue;
    }
    linhas.push('| Campo | Situação |');
    linhas.push('|---|---|');
    for (const pendencia of servico.pendencias) {
      linhas.push(`| \`${pendencia.campo}\` | ${pendencia.situacao} |`);
    }
  }

  linhas.push('');
  linhas.push('## Preparos de exames');
  for (const preparo of json.preparos) {
    linhas.push('');
    linhas.push(`### ${preparo.exame} (\`${preparo.slug}\`) — revisão ${preparo.revisao}`);
    linhas.push('');
    if (preparo.pendencias.length === 0) {
      linhas.push('Sem pendências registradas.');
      continue;
    }
    linhas.push('| Campo | Situação |');
    linhas.push('|---|---|');
    for (const pendencia of preparo.pendencias) {
      linhas.push(`| \`${pendencia.campo}\` | ${pendencia.situacao} |`);
    }
  }

  linhas.push('');
  linhas.push('## Páginas editoriais');
  linhas.push('');
  if (json.paginas.length === 0) {
    linhas.push('Nenhuma pendência nos blocos editoriais renderizados.');
  } else {
    linhas.push('| Campo | Situação |');
    linhas.push('|---|---|');
    for (const pendencia of json.paginas) {
      linhas.push(`| \`${pendencia.campo}\` | ${pendencia.situacao} |`);
    }
  }

  linhas.push('');
  linhas.push('## Blocos editoriais pendentes');
  linhas.push('');
  if (json.blocosPendentes.length === 0) {
    linhas.push('Nenhum bloco pendente: todas as páginas podem ser publicadas em produção.');
  } else {
    linhas.push('| Página | Índice | Tipo | Id |');
    linhas.push('|---|---|---|---|');
    for (const bloco of json.blocosPendentes) {
      linhas.push(`| ${bloco.pagina} | ${bloco.indice} | ${bloco.tipo ?? '-'} | ${bloco.id ?? '-'} |`);
    }
  }
  linhas.push('');
  linhas.push('## Notas');
  linhas.push('');
  linhas.push('- Unidades `a-confirmar` não geram página nem entram no sitemap de produção.');
  linhas.push('- Serviços e preparos não aprovados também ficam fora do build de produção.');
  linhas.push('- Exemplos do levantamento permanecem apenas em `dados/exemplos-briefing.json`, sem uso no build.');
  linhas.push('- `analytics` é intencionalmente `null`: o site não mede audiência nem coleta dados nesta fase (Q-09).');
  linhas.push('- Convênios: catálogo vazio nesta rodada; a página e a matriz unidade×convênio são estruturais e só publicam com blocos aprovados.');
  linhas.push('- Blocos editoriais de `paginas.json` (home, unidades, serviços e preparo) são renderizados por tipo conhecido; tipo desconhecido derruba o build.');
  linhas.push('- Blocos `pendente` não entram na produção, são listados acima e impedem o go-live da página correspondente.');
  linhas.push('- Matriz e rodapé: o rodapé lê o registro da matriz confirmado diretamente (`validacao.status: confirmado`), mesmo sem página publicada; `site.contatoInstitucional.telefoneE164` deve ser idêntico ao telefone da matriz quando preenchido. `/contato/` só é gerada com endereço e telefone da matriz confirmados.');
  linhas.push('- F4: `/sobre/`, `/convenios-e-particular/` e `/contato/` existem em rascunho com blocos pendentes; em produção só entram após aprovação dos blocos.');
  linhas.push('- `npm run build` é tolerante e gera o site publicável. `npm run build:go-live` aplica os gates estritos de unidades, menu, rotas, preparos e identificação do rodapé.');
  linhas.push('');

  return { json, markdown: linhas.join('\n') };
}
