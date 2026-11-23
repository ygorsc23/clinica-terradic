/**
 * Modelo do kit de coleta (`coleta-1`).
 *
 * Este modulo concentra o formato fixo dos cinco CSVs, o mapeamento coluna ->
 * caminho JSON, os tokens de resposta e a montagem do modelo a partir de
 * `dados/*.json` + `dados/exemplos-briefing.json` + relatorio de pendencias.
 * Nao implementa a escrita em `dados/` (isso pertence ao importador, etapa
 * seguinte); aqui so existe leitura dos dados e geracao das planilhas.
 */

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  DIAS_SEMANA,
  carregarDados,
  carregarExemplosBriefing,
  formatarDias,
  formatarTelefone,
  preparoAprovado,
  resolverPublicacao,
  validarDados
} from './dados.mjs';
import { ErroCsv, lerCsv } from './csv.mjs';

export const MODELO_VERSAO = 'coleta-1';
export const SENTINELA = 'A CONFIRMAR: ';
export const TOKEN_NAO_TEMOS = 'NAO_TEMOS';
export const TOKEN_NAO_SABEMOS = 'NAO_SABEMOS';

export const ARQUIVO_UNIDADES = 'unidades.csv';
export const ARQUIVO_SITE = 'site.csv';
export const ARQUIVO_CONVENIOS = 'convenios.csv';
export const ARQUIVO_PREPAROS = 'preparos.csv';
export const ARQUIVO_TEXTOS = 'textos.csv';

export const COLUNAS = {
  unidades: [
    'modelo_versao',
    'base_dados_em',
    'tipo_registro',
    'slug',
    'id',
    'nome_exibicao',
    'cidade',
    'uf',
    'cnpj_filial',
    'matriz',
    'endereco_logradouro',
    'endereco_numero',
    'endereco_complemento',
    'endereco_bairro',
    'endereco_cep',
    'endereco_referencia',
    'geo_lat',
    'geo_lng',
    'geo_precisao',
    'telefone_1_rotulo',
    'telefone_1_e164',
    'telefone_1_tipo',
    'telefone_1_principal',
    'telefone_2_rotulo',
    'telefone_2_e164',
    'telefone_2_tipo',
    'telefone_2_principal',
    'telefone_3_rotulo',
    'telefone_3_e164',
    'telefone_3_tipo',
    'telefone_3_principal',
    'whatsapp_e164',
    'email',
    'horarios',
    'servicos',
    'convenios',
    'atendimento_particular',
    'comodidades_estacionamento',
    'comodidades_acessivel',
    'observacoes_publicas',
    'redes_instagram',
    'redes_facebook',
    'confirmacao',
    'confirmado_por',
    'como_confirmou',
    'fonte',
    'data_confirmacao',
    'observacoes_coleta'
  ],
  site: [
    'modelo_versao',
    'base_dados_em',
    'tipo_registro',
    'rt_nome',
    'rt_crm',
    'rt_crm_uf',
    'rt_especialidade',
    'email_institucional',
    'telefone_institucional_e164',
    'instagram',
    'facebook',
    'confirmacao',
    'confirmado_por',
    'como_confirmou',
    'fonte',
    'data_confirmacao',
    'observacoes_coleta'
  ],
  convenios: [
    'modelo_versao',
    'base_dados_em',
    'tipo_registro',
    'id',
    'nome',
    'tipo_convenio',
    'exibir_logo',
    'logo_autorizado',
    'aviso',
    'vigencia_inicio',
    'vigencia_fim',
    'unidades',
    'confirmacao',
    'confirmado_por',
    'como_confirmou',
    'fonte',
    'data_confirmacao',
    'observacoes_coleta'
  ],
  preparos: [
    'modelo_versao',
    'base_dados_em',
    'tipo_registro',
    'id',
    'slug',
    'exame',
    'servico_id',
    'resumo',
    'jejum',
    'hidratacao',
    'medicamentos',
    'documentos',
    'vestimenta',
    'duracao',
    'observacoes',
    'alerta',
    'registro_profissional',
    'confirmacao',
    'confirmado_por',
    'como_confirmou',
    'fonte',
    'data_confirmacao',
    'observacoes_coleta'
  ],
  textos: [
    'modelo_versao',
    'base_dados_em',
    'tipo_registro',
    'pagina',
    'bloco',
    'tipo_bloco',
    'texto',
    'itens',
    'confirmacao',
    'confirmado_por',
    'como_confirmou',
    'fonte',
    'data_confirmacao',
    'observacoes_coleta'
  ]
};

export const TIPO_REGISTRO = {
  unidades: 'unidade',
  site: 'site',
  convenios: 'convenio',
  preparos: 'preparo',
  textos: 'texto'
};

export const ARQUIVOS_COLETA = [
  { chave: 'unidades', arquivo: ARQUIVO_UNIDADES, tipo: TIPO_REGISTRO.unidades },
  { chave: 'site', arquivo: ARQUIVO_SITE, tipo: TIPO_REGISTRO.site },
  { chave: 'convenios', arquivo: ARQUIVO_CONVENIOS, tipo: TIPO_REGISTRO.convenios },
  { chave: 'preparos', arquivo: ARQUIVO_PREPAROS, tipo: TIPO_REGISTRO.preparos },
  { chave: 'textos', arquivo: ARQUIVO_TEXTOS, tipo: TIPO_REGISTRO.textos }
];

/** Coluna -> caminho no JSON. `null` significa metadado, referencia ou log (sem destino direto). */
export const MAPA_COLUNAS = {
  unidades: {
    modelo_versao: null,
    base_dados_em: null,
    tipo_registro: null,
    slug: 'slug',
    id: 'id',
    nome_exibicao: 'nomeExibicao',
    cidade: 'cidade',
    uf: 'uf',
    cnpj_filial: 'cnpjFilial',
    matriz: 'matriz',
    endereco_logradouro: 'endereco.logradouro',
    endereco_numero: 'endereco.numero',
    endereco_complemento: 'endereco.complemento',
    endereco_bairro: 'endereco.bairro',
    endereco_cep: 'endereco.cep',
    endereco_referencia: 'endereco.referencia',
    geo_lat: 'geo.lat',
    geo_lng: 'geo.lng',
    geo_precisao: 'geo.precisao',
    telefone_1_rotulo: 'telefones[0].rotulo',
    telefone_1_e164: 'telefones[0].e164',
    telefone_1_tipo: 'telefones[0].tipo',
    telefone_1_principal: 'telefones[0].principal',
    telefone_2_rotulo: 'telefones[1].rotulo',
    telefone_2_e164: 'telefones[1].e164',
    telefone_2_tipo: 'telefones[1].tipo',
    telefone_2_principal: 'telefones[1].principal',
    telefone_3_rotulo: 'telefones[2].rotulo',
    telefone_3_e164: 'telefones[2].e164',
    telefone_3_tipo: 'telefones[2].tipo',
    telefone_3_principal: 'telefones[2].principal',
    whatsapp_e164: 'whatsapp.e164',
    email: 'email',
    horarios: 'horarios',
    servicos: 'servicos',
    convenios: 'convenios',
    atendimento_particular: 'atendimentoParticular',
    comodidades_estacionamento: 'comodidades.estacionamento',
    comodidades_acessivel: 'comodidades.acessivel',
    observacoes_publicas: 'observacoesPublicas',
    redes_instagram: 'redesSociais.instagram',
    redes_facebook: 'redesSociais.facebook',
    confirmacao: null,
    confirmado_por: 'validacao.confirmadoPor',
    como_confirmou: 'validacao.fontes',
    fonte: 'validacao.fontes',
    data_confirmacao: 'validacao.data',
    observacoes_coleta: null
  },
  site: {
    modelo_versao: null,
    base_dados_em: null,
    tipo_registro: null,
    rt_nome: 'responsavelTecnico.nome',
    rt_crm: 'responsavelTecnico.crm',
    rt_crm_uf: 'responsavelTecnico.crmUf',
    rt_especialidade: 'responsavelTecnico.especialidade',
    email_institucional: 'contatoInstitucional.email',
    telefone_institucional_e164: 'contatoInstitucional.telefoneE164',
    instagram: 'redesSociais.instagram',
    facebook: 'redesSociais.facebook',
    confirmacao: null,
    confirmado_por: null,
    como_confirmou: null,
    fonte: null,
    data_confirmacao: null,
    observacoes_coleta: null
  },
  convenios: {
    modelo_versao: null,
    base_dados_em: null,
    tipo_registro: null,
    id: 'id',
    nome: 'nome',
    tipo_convenio: 'tipo',
    exibir_logo: 'exibirLogo',
    logo_autorizado: 'logoAutorizado',
    aviso: 'aviso',
    vigencia_inicio: null,
    vigencia_fim: null,
    unidades: 'unidades[].convenios',
    confirmacao: null,
    confirmado_por: null,
    como_confirmou: null,
    fonte: null,
    data_confirmacao: null,
    observacoes_coleta: null
  },
  preparos: {
    modelo_versao: null,
    base_dados_em: null,
    tipo_registro: null,
    id: 'id',
    slug: 'slug',
    exame: 'exame',
    servico_id: 'servicoId',
    resumo: 'resumo',
    jejum: 'jejum',
    hidratacao: 'hidratacao',
    medicamentos: 'medicamentos',
    documentos: 'documentos',
    vestimenta: 'vestimenta',
    duracao: 'duracao',
    observacoes: 'observacoes',
    alerta: 'alerta',
    registro_profissional: 'revisao.crm',
    confirmacao: null,
    confirmado_por: 'revisao.responsavel',
    como_confirmou: null,
    fonte: null,
    data_confirmacao: 'revisao.data',
    observacoes_coleta: null
  },
  textos: {
    modelo_versao: null,
    base_dados_em: null,
    tipo_registro: null,
    pagina: 'paginas.paginas',
    bloco: 'paginas.paginas[].blocos',
    tipo_bloco: 'paginas.paginas[].blocos[].tipo',
    texto: 'paginas.paginas[].blocos[].texto',
    itens: 'paginas.paginas[].blocos[].itens',
    confirmacao: null,
    confirmado_por: null,
    como_confirmou: null,
    fonte: null,
    data_confirmacao: null,
    observacoes_coleta: null
  }
};

/** Colunas de referencia: emitidas sempre sem a sentinela e sem edicao pela planilha. */
export const COLUNAS_REFERENCIA = {
  unidades: ['slug', 'id', 'matriz', 'telefone_1_principal', 'telefone_2_principal', 'telefone_3_principal'],
  site: [],
  convenios: ['id'],
  preparos: ['id', 'slug', 'exame', 'servico_id'],
  textos: ['pagina', 'bloco', 'tipo_bloco']
};

/** Colunas de controle/confirmacao: o gerador sempre emite vazio. */
export const COLUNAS_SEM_PREENCHIMENTO = [
  'confirmacao',
  'confirmado_por',
  'como_confirmou',
  'fonte',
  'data_confirmacao',
  'observacoes_coleta'
];

export const SECOES_HTML = {
  'resumo-dependencias': 'Resumo das dependências',
  unidades: 'Unidades',
  unidade: 'Ficha de cada unidade',
  'anexo-telefones': 'Anexo: telefones do levantamento',
  site: 'Site, responsável técnico, contato e redes',
  servicos: 'Serviços',
  convenios: 'Convênios e vigência',
  particular: 'Atendimento particular, documentos e pagamento',
  preparos: 'Preparos e revisão do RT',
  textos: 'Textos editoriais',
  privacidade: 'Política de privacidade',
  identidade: 'Identidade visual, fotos e autorizações',
  dominio: 'Domínio, DNS e hospedagem',
  laudo: 'Prazo médio de laudo'
};

const COLUNAS_TELEFONES = ['rotulo', 'e164', 'tipo', 'principal'];

/**
 * Dependencia de conteudo -> onde ela e respondida.
 * Se um C-xx pendente do relatorio nao tiver entrada valida aqui, a geracao falha
 * com `coleta:mapeamento:C-xx`.
 */
export const MAPA_DEPENDENCIAS = {
  'C-01': {
    secoes: ['unidades', 'unidade'],
    arquivos: [ARQUIVO_UNIDADES],
    colunas: ['slug', 'id', 'matriz', 'nome_exibicao', 'cidade', 'uf']
  },
  'C-02': {
    secoes: ['unidade'],
    arquivos: [ARQUIVO_UNIDADES],
    colunas: [
      'endereco_logradouro',
      'endereco_numero',
      'endereco_complemento',
      'endereco_bairro',
      'endereco_cep',
      'endereco_referencia',
      'geo_lat',
      'geo_lng',
      'geo_precisao'
    ]
  },
  'C-03': {
    secoes: ['unidade', 'anexo-telefones'],
    arquivos: [ARQUIVO_UNIDADES],
    colunas: COLUNAS.unidades.filter((coluna) => /^telefone_\d_/.test(coluna)).concat(['whatsapp_e164'])
  },
  'C-04': {
    secoes: ['unidade'],
    arquivos: [ARQUIVO_UNIDADES],
    colunas: ['horarios']
  },
  'C-05': {
    secoes: ['unidade', 'servicos'],
    arquivos: [ARQUIVO_UNIDADES],
    colunas: ['servicos']
  },
  'C-06': {
    secoes: ['unidade', 'convenios'],
    arquivos: [ARQUIVO_UNIDADES, ARQUIVO_CONVENIOS],
    colunas: ['convenios', 'id', 'nome', 'tipo_convenio', 'exibir_logo', 'logo_autorizado', 'aviso'].concat([
      'vigencia_inicio',
      'vigencia_fim',
      'unidades'
    ])
  },
  'C-07': {
    secoes: ['unidade', 'particular', 'textos'],
    arquivos: [ARQUIVO_UNIDADES, ARQUIVO_TEXTOS],
    colunas: ['atendimento_particular', 'comodidades_estacionamento', 'comodidades_acessivel']
  },
  'C-08': {
    secoes: ['site'],
    arquivos: [ARQUIVO_SITE],
    colunas: ['rt_nome', 'rt_crm', 'rt_crm_uf', 'rt_especialidade']
  },
  'C-09': {
    secoes: ['preparos'],
    arquivos: [ARQUIVO_PREPAROS],
    colunas: COLUNAS.preparos.filter(
      (coluna) => !['modelo_versao', 'base_dados_em', 'tipo_registro'].includes(coluna)
    )
  },
  'C-10': {
    secoes: ['textos'],
    arquivos: [ARQUIVO_TEXTOS],
    colunas: ['pagina', 'bloco', 'tipo_bloco', 'texto', 'itens']
  },
  'C-11': {
    secoes: ['identidade'],
    arquivos: [],
    colunas: []
  },
  'C-12': {
    secoes: ['dominio'],
    arquivos: [],
    colunas: []
  },
  'C-13': {
    secoes: ['laudo'],
    arquivos: [],
    colunas: []
  },
  'C-14': {
    secoes: ['textos', 'privacidade'],
    arquivos: [ARQUIVO_TEXTOS],
    colunas: ['pagina', 'bloco', 'texto']
  },
  'C-15': {
    secoes: ['site'],
    arquivos: [ARQUIVO_SITE],
    colunas: ['email_institucional', 'telefone_institucional_e164', 'instagram', 'facebook']
  }
};

const ARQUIVO_POR_NOME = new Map(ARQUIVOS_COLETA.map((item) => [item.arquivo, item.chave]));

function colunaExisteNaDependencia(coluna, arquivos) {
  return arquivos.some((nome) => {
    const chave = ARQUIVO_POR_NOME.get(nome);
    return Boolean(chave) && COLUNAS[chave].includes(coluna);
  });
}

export function mapeamentoValido(id) {
  const mapa = MAPA_DEPENDENCIAS[id];
  if (!mapa) {
    return false;
  }
  const secoes = mapa.secoes ?? [];
  const arquivos = mapa.arquivos ?? [];
  if (secoes.length === 0 && arquivos.length === 0) {
    return false;
  }
  if (!secoes.every((secao) => Object.hasOwn(SECOES_HTML, secao))) {
    return false;
  }
  if (!arquivos.every((nome) => ARQUIVO_POR_NOME.has(nome))) {
    return false;
  }
  return (mapa.colunas ?? []).every((coluna) => colunaExisteNaDependencia(coluna, arquivos));
}

export function descreverOndeResponder(id) {
  const mapa = MAPA_DEPENDENCIAS[id];
  if (!mapa) {
    return '';
  }
  const partes = [];
  if ((mapa.arquivos ?? []).length > 0) {
    partes.push(`planilha ${mapa.arquivos.join(', ')}`);
  }
  if ((mapa.colunas ?? []).length > 0) {
    partes.push(`colunas ${mapa.colunas.join(', ')}`);
  }
  const secoes = (mapa.secoes ?? []).map((secao) => SECOES_HTML[secao] ?? secao);
  if (secoes.length > 0) {
    partes.push(`questionário: ${secoes.join(', ')}`);
  }
  return partes.join(' · ');
}

export function baseDadosEm(dados) {
  const valor = dados?.site?.atualizadoEm;
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new Error('coleta:base_dados_em:site — dados.site.atualizadoEm ausente ou fora de AAAA-MM-DD');
  }
  return valor;
}

export function formatarDataBr(iso) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (!partes) {
    return '';
  }
  return `${partes[3]}/${partes[2]}/${partes[1]}`;
}

export function ehSentinela(valor) {
  return typeof valor === 'string' && valor.trim().startsWith('A CONFIRMAR:');
}

export function ehToken(valor) {
  const texto = String(valor ?? '').trim().toUpperCase();
  return texto === TOKEN_NAO_TEMOS || texto === TOKEN_NAO_SABEMOS;
}

export function marcarAConfirmar(valor) {
  return `${SENTINELA}${valor}`;
}

export function textoBruto(valor) {
  if (valor === null || valor === undefined) {
    return '';
  }
  return String(valor);
}

export function preencher(valor, { marcar = true } = {}) {
  if (valor === null || valor === undefined) {
    return '';
  }
  const texto = typeof valor === 'boolean' ? (valor ? 'sim' : 'nao') : String(valor);
  if (texto.trim() === '') {
    return '';
  }
  return marcar ? marcarAConfirmar(texto) : texto;
}

export function boolTexto(valor) {
  if (valor === null || valor === undefined) {
    return null;
  }
  return valor ? 'sim' : 'nao';
}

export function formatarDecimal(valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    return '';
  }
  return String(valor).replace('.', ',');
}

export function formatarLista(valor) {
  return (Array.isArray(valor) ? valor : [])
    .filter((item) => item !== null && item !== undefined && String(item).trim() !== '')
    .join('|');
}

export function formatarHorariosCsv(horarios) {
  return (Array.isArray(horarios) ? horarios : [])
    .filter((horario) => horario && Array.isArray(horario.dias) && horario.dias.length > 0)
    .map((horario) => {
      const observacao = horario.obs ?? horario.observacao ?? '';
      return `${horario.dias.join(',')}:${horario.abre ?? ''}-${horario.fecha ?? ''}${
        observacao ? `:${observacao}` : ''
      }`;
    })
    .join('|');
}

export function unidadeConfirmada(unidade) {
  return unidade?.status === 'ativo' || unidade?.validacao?.status === 'confirmado';
}

function textoEndereco(unidade) {
  const endereco = unidade?.endereco ?? {};
  const partes = [
    endereco.logradouro,
    endereco.numero,
    endereco.complemento,
    endereco.bairro,
    endereco.cep ? `CEP ${endereco.cep}` : '',
    endereco.referencia ? `referência: ${endereco.referencia}` : ''
  ];
  return partes.filter(Boolean).join(', ');
}

function textoTelefones(unidade) {
  return (Array.isArray(unidade?.telefones) ? unidade.telefones : [])
    .map((telefone) =>
      [
        telefone?.rotulo,
        telefone?.e164 ? formatarTelefone(telefone.e164) : '',
        telefone?.principal ? '(principal)' : ''
      ]
        .filter(Boolean)
        .join(' ')
    )
    .filter(Boolean)
    .join(' | ');
}

function textoHorarios(unidade) {
  return (Array.isArray(unidade?.horarios) ? unidade.horarios : [])
    .map(
      (horario) =>
        `${formatarDias(horario?.dias ?? [])}: ${horario?.abre}-${horario?.fecha}${
          horario?.obs ? ` (${horario.obs})` : ''
        }`
    )
    .join(' | ');
}

function textoComodidades(unidade) {
  const comodidades = unidade?.comodidades ?? {};
  return [
    ['estacionamento', comodidades.estacionamento],
    ['acessível', comodidades.acessivel]
  ]
    .filter(([, valor]) => valor !== null && valor !== undefined)
    .map(([rotulo, valor]) => `${rotulo}: ${valor ? 'sim' : 'nao'}`)
    .join('; ');
}

function conhecidosUnidade(unidade) {
  const confirmada = unidadeConfirmada(unidade);
  const campos = [
    ['Nome de exibição', unidade?.nomeExibicao],
    ['Cidade/UF', [unidade?.cidade, unidade?.uf].filter(Boolean).join('/')],
    ['CNPJ da filial', unidade?.cnpjFilial],
    ['Endereço', textoEndereco(unidade)],
    ['CEP', unidade?.endereco?.cep],
    ['Coordenadas', formatoCoordenadas(unidade)],
    ['Telefones', textoTelefones(unidade)],
    ['WhatsApp', unidade?.whatsapp?.e164 ? formatarTelefone(unidade.whatsapp.e164) : ''],
    ['E-mail', unidade?.email],
    ['Horários', textoHorarios(unidade)],
    ['Serviços', formatarLista(unidade?.servicos)],
    ['Convênios', formatarLista(unidade?.convenios)],
    ['Atendimento particular', boolTexto(unidade?.atendimentoParticular)],
    ['Comodidades', textoComodidades(unidade)],
    ['Observações públicas', unidade?.observacoesPublicas],
    ['Redes sociais', [unidade?.redesSociais?.instagram, unidade?.redesSociais?.facebook].filter(Boolean).join(' | ')]
  ];
  return campos
    .filter(([, valor]) => valor !== null && valor !== undefined && String(valor).trim() !== '')
    .map(([rotulo, valor]) => ({
      rotulo,
      valor: String(valor),
      situacao: confirmada ? 'já confirmado' : 'a confirmar'
    }));
}

function formatoCoordenadas(unidade) {
  const lat = unidade?.geo?.lat;
  const lng = unidade?.geo?.lng;
  if (lat === null || lat === undefined) {
    return '';
  }
  if (lng === null || lng === undefined) {
    return '';
  }
  return `${formatarDecimal(lat)}, ${formatarDecimal(lng)} (${unidade?.geo?.precisao ?? 'sem precisão'})`;
}

function valoresUnidade(unidade) {
  const confirmada = unidadeConfirmada(unidade);
  const dado = (valor) => (confirmada ? null : valor);
  const telefones = confirmada ? [] : Array.isArray(unidade?.telefones) ? unidade.telefones : [];
  const valores = {
    slug: unidade?.slug,
    id: unidade?.id,
    matriz: unidade?.matriz === true ? 'sim' : 'nao',
    nome_exibicao: dado(unidade?.nomeExibicao),
    cidade: dado(unidade?.cidade),
    uf: dado(unidade?.uf),
    cnpj_filial: dado(unidade?.cnpjFilial),
    endereco_logradouro: dado(unidade?.endereco?.logradouro),
    endereco_numero: dado(unidade?.endereco?.numero),
    endereco_complemento: dado(unidade?.endereco?.complemento),
    endereco_bairro: dado(unidade?.endereco?.bairro),
    endereco_cep: dado(unidade?.endereco?.cep),
    endereco_referencia: dado(unidade?.endereco?.referencia),
    geo_lat: dado(formatarDecimal(unidade?.geo?.lat)),
    geo_lng: dado(formatarDecimal(unidade?.geo?.lng)),
    geo_precisao:
      unidade?.geo?.lat !== null && unidade?.geo?.lat !== undefined
        ? dado(unidade?.geo?.precisao)
        : null,
    whatsapp_e164: dado(unidade?.whatsapp?.e164),
    email: dado(unidade?.email),
    horarios: dado(formatarHorariosCsv(unidade?.horarios)),
    servicos: dado(formatarLista(unidade?.servicos)),
    convenios: dado(formatarLista(unidade?.convenios)),
    atendimento_particular: dado(boolTexto(unidade?.atendimentoParticular)),
    comodidades_estacionamento: dado(boolTexto(unidade?.comodidades?.estacionamento)),
    comodidades_acessivel: dado(boolTexto(unidade?.comodidades?.acessivel)),
    observacoes_publicas: dado(unidade?.observacoesPublicas),
    redes_instagram: dado(unidade?.redesSociais?.instagram),
    redes_facebook: dado(unidade?.redesSociais?.facebook)
  };
  for (let posicao = 0; posicao < 3; posicao += 1) {
    const telefone = telefones[posicao];
    COLUNAS_TELEFONES.forEach((campo) => {
      const coluna = `telefone_${posicao + 1}_${campo}`;
      if (!telefone) {
        valores[coluna] = null;
        return;
      }
      if (campo === 'principal') {
        valores[coluna] = telefone.principal === true ? 'sim' : 'nao';
        return;
      }
      valores[coluna] = telefone[campo] ?? null;
    });
  }
  return valores;
}

function montarLinha(arquivo, base, valores) {
  const referencia = new Set(COLUNAS_REFERENCIA[arquivo] ?? []);
  return COLUNAS[arquivo].map((coluna) => {
    if (coluna === 'modelo_versao') {
      return MODELO_VERSAO;
    }
    if (coluna === 'base_dados_em') {
      return base;
    }
    if (coluna === 'tipo_registro') {
      return TIPO_REGISTRO[arquivo];
    }
    if (COLUNAS_SEM_PREENCHIMENTO.includes(coluna)) {
      return '';
    }
    const valor = valores[coluna];
    return referencia.has(coluna) ? textoBruto(valor) : preencher(valor);
  });
}

function linhaUnidade(unidade, base) {
  return montarLinha('unidades', base, valoresUnidade(unidade));
}

function linhaSite(site, base) {
  const responsavelTecnico = site?.responsavelTecnico ?? {};
  const rtConfirmado = responsavelTecnico.status === 'confirmado';
  const valores = {
    rt_nome: rtConfirmado ? null : responsavelTecnico.nome,
    rt_crm: rtConfirmado ? null : responsavelTecnico.crm,
    rt_crm_uf: rtConfirmado ? null : responsavelTecnico.crmUf,
    rt_especialidade: rtConfirmado ? null : responsavelTecnico.especialidade,
    email_institucional: site?.contatoInstitucional?.email,
    telefone_institucional_e164: site?.contatoInstitucional?.telefoneE164,
    instagram: site?.redesSociais?.instagram,
    facebook: site?.redesSociais?.facebook
  };
  return montarLinha('site', base, valores);
}

function linhaConvenio(convenio, base) {
  return montarLinha('convenios', base, {
    id: convenio?.id,
    nome: null,
    tipo_convenio: null,
    exibir_logo: null,
    logo_autorizado: null,
    aviso: null,
    vigencia_inicio: null,
    vigencia_fim: null,
    unidades: null
  });
}

function linhaPreparo(preparo, base) {
  const confirmado = preparoAprovado(preparo);
  const dado = (valor) => (confirmado ? null : valor);
  return montarLinha('preparos', base, {
    id: preparo?.id,
    slug: preparo?.slug,
    exame: preparo?.exame,
    servico_id: preparo?.servicoId,
    resumo: dado(preparo?.resumo),
    jejum: dado(preparo?.jejum),
    hidratacao: dado(preparo?.hidratacao),
    medicamentos: dado(preparo?.medicamentos),
    documentos: dado(formatarLista(preparo?.documentos)),
    vestimenta: dado(preparo?.vestimenta),
    duracao: dado(preparo?.duracao),
    observacoes: dado(formatarLista(preparo?.observacoes)),
    alerta: dado(preparo?.alerta),
    registro_profissional: null,
    confirmacao: null,
    confirmado_por: null,
    como_confirmou: null,
    fonte: null,
    data_confirmacao: null,
    observacoes_coleta: null
  });
}

function linhaTexto(bloco, base) {
  return montarLinha('textos', base, {
    pagina: bloco?.pagina,
    bloco: bloco?.id ?? `#${bloco?.indice ?? ''}`,
    tipo_bloco: bloco?.tipo,
    texto: null,
    itens: null
  });
}

function pendenciasDaUnidade(relatorio, slug) {
  const lista = relatorio?.unidades;
  if (!Array.isArray(lista)) {
    return [];
  }
  const entrada = lista.find((unidade) => unidade?.slug === slug);
  return Array.isArray(entrada?.pendencias) ? entrada.pendencias : [];
}

function conhecidosSite(site) {
  const responsavelTecnico = site?.responsavelTecnico ?? {};
  const confirmado = responsavelTecnico.status === 'confirmado';
  const identificacaoRt = [
    responsavelTecnico.nome,
    responsavelTecnico.crm
      ? `CRM ${responsavelTecnico.crm}${responsavelTecnico.crmUf ? `/${responsavelTecnico.crmUf}` : ''}`
      : '',
    responsavelTecnico.especialidade
  ]
    .filter(Boolean)
    .join(' — ');
  const campos = [
    ['Responsável técnico', identificacaoRt, confirmado],
    ['E-mail institucional', site?.contatoInstitucional?.email, false],
    [
      'Telefone institucional',
      site?.contatoInstitucional?.telefoneE164
        ? formatarTelefone(site.contatoInstitucional.telefoneE164)
        : '',
      false
    ],
    ['Instagram', site?.redesSociais?.instagram, false],
    ['Facebook', site?.redesSociais?.facebook, false]
  ];
  return campos
    .filter(([, valor]) => valor !== null && valor !== undefined && String(valor).trim() !== '')
    .map(([rotulo, valor, jaConfirmado]) => ({
      rotulo,
      valor: String(valor),
      situacao: jaConfirmado ? 'já confirmado' : 'a confirmar'
    }));
}

function arredondarDependencias(relatorio) {
  const bloqueios = Array.isArray(relatorio?.bloqueios) ? relatorio.bloqueios : [];
  const semMapa = bloqueios.filter((bloqueio) => bloqueio?.pendente && !mapeamentoValido(bloqueio.id));
  if (semMapa.length > 0) {
    throw new Error(`coleta:mapeamento:${semMapa.map((bloqueio) => bloqueio.id).join(',')}`);
  }
  return bloqueios.map((bloqueio) => ({
    id: bloqueio.id,
    item: bloqueio.item,
    responsavel: bloqueio.responsavel,
    pendente: bloqueio.pendente === true,
    bloqueia: bloqueio.bloqueia === true,
    ondeResponder: descreverOndeResponder(bloqueio.id),
    secoes: (MAPA_DEPENDENCIAS[bloqueio.id]?.secoes ?? []).map(
      (secao) => SECOES_HTML[secao] ?? secao
    )
  }));
}

/**
 * Monta o modelo do kit a partir dos dados carregados e do relatorio de pendencias.
 * Funcao pura: nao le arquivos, nao escreve nada e nao usa relogio.
 */
export function montarModeloColeta({ dados, exemplos = {}, relatorio = {} }) {
  const base = baseDadosEm(dados);
  const dependencias = arredondarDependencias(relatorio);
  const unidades = Array.isArray(dados?.unidades?.unidades) ? dados.unidades.unidades : [];
  const convenios = Array.isArray(dados?.convenios?.convenios) ? dados.convenios.convenios : [];
  const preparos = Array.isArray(dados?.preparos?.preparos) ? dados.preparos.preparos : [];
  const blocosPendentes = Array.isArray(relatorio?.blocosPendentes) ? relatorio.blocosPendentes : [];

  const linhasUnidades = unidades.map((unidade) => linhaUnidade(unidade, base));
  const linhasConvenios = [...convenios]
    .sort((a, b) => (String(a?.id) < String(b?.id) ? -1 : String(a?.id) > String(b?.id) ? 1 : 0))
    .map((convenio) => linhaConvenio(convenio, base));
  const linhasPreparos = preparos.map((preparo) => linhaPreparo(preparo, base));
  const linhasTextos = blocosPendentes.map((bloco) => linhaTexto(bloco, base));

  const arquivos = {
    unidades: {
      arquivo: ARQUIVO_UNIDADES,
      tipo: TIPO_REGISTRO.unidades,
      cabecalho: COLUNAS.unidades,
      linhas: linhasUnidades
    },
    site: {
      arquivo: ARQUIVO_SITE,
      tipo: TIPO_REGISTRO.site,
      cabecalho: COLUNAS.site,
      linhas: [linhaSite(dados?.site ?? {}, base)]
    },
    convenios: {
      arquivo: ARQUIVO_CONVENIOS,
      tipo: TIPO_REGISTRO.convenios,
      cabecalho: COLUNAS.convenios,
      linhas: linhasConvenios
    },
    preparos: {
      arquivo: ARQUIVO_PREPAROS,
      tipo: TIPO_REGISTRO.preparos,
      cabecalho: COLUNAS.preparos,
      linhas: linhasPreparos
    },
    textos: {
      arquivo: ARQUIVO_TEXTOS,
      tipo: TIPO_REGISTRO.textos,
      cabecalho: COLUNAS.textos,
      linhas: linhasTextos
    }
  };

  const telefonesLevantamento = (Array.isArray(exemplos?.telefones) ? exemplos.telefones : [])
    .filter((telefone) => telefone?.valorOriginal || telefone?.e164)
    .map((telefone) => ({
      exibicao: `A CONFIRMAR: ${telefone.valorOriginal ?? telefone.e164}`,
      observacao: telefone.observacao ?? ''
    }));
  const enderecosLevantamento = Array.isArray(exemplos?.enderecos) ? exemplos.enderecos : [];

  return {
    modeloVersao: MODELO_VERSAO,
    baseDadosEm: base,
    dataBaseLegivel: formatarDataBr(base),
    dependencias,
    arquivos,
    resumo: {
      unidades: linhasUnidades.length,
      site: 1,
      convenios: linhasConvenios.length,
      preparos: linhasPreparos.length,
      textos: linhasTextos.length,
      dependenciasPendentes: dependencias.filter((dependencia) => dependencia.pendente).length
    },
    unidades: unidades.map((unidade, indice) => ({
      slug: unidade?.slug ?? '',
      id: unidade?.id ?? '',
      nome: unidade?.nomeExibicao ?? unidade?.slug ?? '',
      cidade: unidade?.cidade ?? '',
      uf: unidade?.uf ?? '',
      matriz: unidade?.matriz === true,
      status: unidade?.status ?? '',
      validacao: unidade?.validacao?.status ?? '',
      confirmada: unidadeConfirmada(unidade),
      referencia: [
        { rotulo: 'Slug', valor: String(unidade?.slug ?? '') },
        { rotulo: 'ID', valor: String(unidade?.id ?? '') },
        { rotulo: 'Matriz', valor: unidade?.matriz ? 'sim' : 'nao' }
      ],
      conhecidos: conhecidosUnidade(unidade),
      pendencias: pendenciasDaUnidade(relatorio, unidade?.slug),
      linha: arquivos.unidades.linhas[indice] ?? []
    })),
    site: {
      conhecidos: conhecidosSite(dados?.site ?? {}),
      pendencias: Array.isArray(relatorio?.site) ? relatorio.site : [],
      responsavelTecnicoConfirmado: dados?.site?.responsavelTecnico?.status === 'confirmado'
    },
    servicos: (Array.isArray(dados?.servicos?.servicos) ? dados.servicos.servicos : []).map((servico) => ({
      id: servico?.id ?? '',
      slug: servico?.slug ?? '',
      nome: servico?.nome ?? '',
      status: servico?.status ?? ''
    })),
    preparos: preparos.map((preparo) => ({
      id: preparo?.id ?? '',
      slug: preparo?.slug ?? '',
      exame: preparo?.exame ?? '',
      servicoId: preparo?.servicoId ?? '',
      status: preparo?.revisao?.status ?? '',
      confirmado: preparoAprovado(preparo)
    })),
    convenios: convenios.map((convenio) => ({
      id: convenio?.id ?? '',
      nome: convenio?.nome ?? '',
      tipo: convenio?.tipo ?? ''
    })),
    textos: blocosPendentes.map((bloco) => ({
      pagina: bloco?.pagina ?? '',
      bloco: bloco?.id ?? `#${bloco?.indice ?? ''}`,
      tipo: bloco?.tipo ?? ''
    })),
    anexo: {
      telefones: telefonesLevantamento,
      enderecos: enderecosLevantamento
    }
  };
}

/**
 * Texto do LEIA-ME (UTF-8 com BOM). Explica como preencher, os tokens, o bloco
 * de confirmacao, o cuidado com o Excel, a LGPD e a devolucao da pasta.
 */
export function gerarLeiaMe(modelo) {
  const linhas = [
    '\uFEFFKIT DE COLETA DE DADOS — TERRADIC',
    '',
    `Versão do modelo: ${modelo.modeloVersao}`,
    `Data-base dos dados: ${modelo.dataBaseLegivel}`,
    '',
    'O que é este kit',
    '----------------',
    'Este kit reúne o questionário em HTML e cinco planilhas CSV. Ele é derivado do estado atual',
    'de dados/*.json e serve para a clínica confirmar o que falta (C-01 a C-15). Nada deste kit é',
    'publicado no site. A fonte de verdade continua sendo dados/*.json, preenchida pelo importador',
    'depois de revisão humana.',
    '',
    'Quem preenche o quê',
    '-------------------',
    '- Gestor da clínica: unidades.csv, site.csv, convenios.csv e os textos gerais em textos.csv.',
    '- Responsável técnico (RT): preparos.csv e os campos de CRM/UF/especialidade em site.csv.',
    '- Jurídico da clínica: texto da política de privacidade em textos.csv.',
    '- O documento questionario.html é para leitura e reunião; o preenchimento oficial é nas planilhas.',
    '',
    'Arquivos deste kit',
    '------------------',
    `- ${ARQUIVO_UNIDADES}: ${modelo.resumo.unidades} linha(s), uma por unidade existente.`,
    `- ${ARQUIVO_SITE}: uma linha com responsável técnico, contato institucional e redes.`,
    `- ${ARQUIVO_CONVENIOS}: ${modelo.resumo.convenios} linha(s) de convênio existente; acrescente uma`,
    '  linha por convênio novo (o catálogo pode ser ampliado).',
    `- ${ARQUIVO_PREPAROS}: ${modelo.resumo.preparos} linha(s), uma por preparo existente.`,
    `- ${ARQUIVO_TEXTOS}: ${modelo.resumo.textos} linha(s), uma por bloco editorial pendente.`,
    '- questionario.html: questionário imprimível, em A4, com as perguntas por unidade.',
    '- LEIA-ME.txt: este arquivo.',
    '',
    'Como salvar no Excel sem quebrar acentos e números',
    '--------------------------------------------------',
    '1. Abra o CSV no Excel em português. O arquivo usa ponto e vírgula (;) como separador.',
    '2. Formate as colunas de telefone e CEP como Texto antes de digitar. Não remova o sinal + do',
    '   telefone: o formato esperado é +55DDNNNNNNNNN.',
    '3. Use vírgula decimal nos campos de coordenada (ex.: -3,7319).',
    '4. Use datas no formato DD/MM/AAAA.',
    '5. Salve como "CSV UTF-8 (delimitado por ponto e vírgula)". Não salve como XLSX e não troque',
    '   o separador para vírgula.',
    '6. Se o Excel só oferecer "CSV UTF-8 (delimitado por vírgula)", ajuste a configuração regional',
    '   do Windows para separador de listas ";" ou use a opção de CSV com ponto e vírgula.',
    '',
    'O que significam os avisos das células',
    '--------------------------------------',
    '- "A CONFIRMAR: ..." é um valor do levantamento ou do JSON que ainda não foi confirmado.',
    '  Ele nunca é importado. Para confirmar, apague o prefixo "A CONFIRMAR: " e ajuste o valor se',
    '  necessário.',
    `- ${TOKEN_NAO_TEMOS}: resposta explícita de ausência. Em lista, grava lista vazia; em texto ou`,
    '  booleano, grava ausência. Não use em campo obrigatório (por exemplo, slug, nome, cidade, UF).',
    `- ${TOKEN_NAO_SABEMOS}: registra que a informação não é conhecida agora. O valor existente é`,
    '  preservado e a pendência fica registrada. Não use em campo obrigatório.',
    '- Célula vazia: nada será alterado nesta rodada. Use quando não houver resposta.',
    '',
    'Bloco de confirmação',
    '---------------------',
    'Toda linha com algum dado respondido precisa do bloco completo:',
    '- confirmacao: confirmo ou corrijo;',
    '- confirmado_por: nome e função de quem confirmou (mínimo 3 caracteres);',
    '- como_confirmou: email, telefone, reuniao, documento ou whatsapp;',
    '- fonte: assunto, protocolo, arquivo ou ata que comprova a resposta;',
    '- data_confirmacao: DD/MM/AAAA.',
    'Um "ok" genérico não vale. O bloco registra a declaração da clínica; ele não publica nada.',
    '',
    'Privacidade (LGPD)',
    '------------------',
    'Não inclua dados de paciente, exames, laudos, CPF de paciente nem informação clínica',
    'individual no kit ou em qualquer célula de texto livre. O CRM do responsável técnico é dado',
    'profissional e só deve ser informado junto com o nome de quem confirmou.',
    '',
    'Confiança e limite da validação',
    '-------------------------------',
    'A planilha é entrada de terceiro: o preenchimento pode vir da clínica, do RT e do jurídico.',
    'A validação do importador é estrutural (formato, versão, referências, limites e invariantes de',
    'status) e não prova a veracidade do dado. O gate é a revisão humana do diff de dados/*.json,',
    'das fontes e do log antes da promoção manual.',
    '',
    'Como devolver',
    '-------------',
    '1. Preencha as planilhas e confira se cada linha respondida tem o bloco de confirmação.',
    '2. Devolva a pasta completa (os cinco CSVs) pelo canal combinado com o coordenador.',
    '3. O coordenador importa, revisa o diff e promove manualmente o que estiver confirmado.',
    '4. O build e o go-live continuam sendo os únicos gates de publicação.',
    '',
    'O que é importado e o que é promoção manual',
    '-------------------------------------------',
    'A importação grava apenas valores e rastreabilidade, sempre em estado pendente. Ela nunca',
    'publica, nunca marca unidade como ativa e nunca aprova preparo, bloco ou RT. A promoção é um',
    'ato humano, feito depois da revisão do diff, e continua sujeita ao npm run build:go-live.',
    '',
    `Documento gerado a partir de dados/*.json — modelo ${modelo.modeloVersao} — não editar à mão.`,
    ''
  ];
  return `${linhas.join('\n')}`;
}

// ---------------------------------------------------------------------------
// Importacao do kit (etapas K2/K3)
// ---------------------------------------------------------------------------

const ARQUIVO_POR_CHAVE = Object.fromEntries(ARQUIVOS_COLETA.map((item) => [item.chave, item.arquivo]));
const COLUNAS_DADOS = Object.fromEntries(
  Object.keys(COLUNAS).map((chave) => [
    chave,
    COLUNAS[chave].filter(
      (coluna) =>
        !['modelo_versao', 'base_dados_em', 'tipo_registro'].includes(coluna) &&
        !(COLUNAS_REFERENCIA[chave] ?? []).includes(coluna) &&
        !COLUNAS_SEM_PREENCHIMENTO.includes(coluna)
    )
  ])
);
const COLUNAS_E164 = new Set([
  'telefone_1_e164',
  'telefone_2_e164',
  'telefone_3_e164',
  'whatsapp_e164',
  'telefone_institucional_e164'
]);
const CANAIS_CONFIRMACAO = new Set(['email', 'telefone', 'reuniao', 'documento', 'whatsapp']);
const RESPOSTAS_CONFIRMACAO = new Set(['confirmo', 'corrijo']);
const AVISO_CONVENIO_PADRAO = 'Cobertura sujeita a confirmação junto à operadora e à unidade.';
const REGEX_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const REGEX_UF = /^[A-Za-z]{2}$/;
const REGEX_CNPJ = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;
const REGEX_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LIMITE_ARQUIVO_BYTES = 2 * 1024 * 1024;
const LIMITE_LINHAS = 2000;
const LIMITE_CELULA_CHARS = 10000;
const LIMITE_CAMPOS = 200;
const REGEX_CONTROLE = /[\u0000-\u001F\u007F]/;
const REGEX_CONTROLE_GLOBAL = /[\u0000-\u001F\u007F]/g;

function compararTexto(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function erroColeta(arquivo, campo, entidade, detalhe, linha = null) {
  return {
    codigo: `${arquivo}:${campo}:${entidade}`,
    arquivo,
    campo,
    entidade,
    detalhe,
    linha: Number.isInteger(linha) ? linha : null
  };
}

function ordenarErrosColeta(erros) {
  return [...erros].sort(
    (a, b) =>
      compararTexto(a.arquivo ?? '', b.arquivo ?? '') ||
      (a.linha ?? 0) - (b.linha ?? 0) ||
      compararTexto(a.campo ?? '', b.campo ?? '') ||
      compararTexto(a.entidade ?? '', b.entidade ?? '') ||
      compararTexto(a.detalhe ?? '', b.detalhe ?? '')
  );
}

function classificarCelula(valor) {
  const texto = String(valor ?? '').trim();
  if (texto === '') {
    return { tipo: 'vazio' };
  }
  if (texto.startsWith('A CONFIRMAR:')) {
    return { tipo: 'sentinela' };
  }
  const maiusculo = texto.toUpperCase();
  if (maiusculo === TOKEN_NAO_TEMOS) {
    return { tipo: 'nao-temos' };
  }
  if (maiusculo === TOKEN_NAO_SABEMOS) {
    return { tipo: 'nao-sabemos' };
  }
  return { tipo: 'valor', valor: texto };
}

function ehFormula(texto, coluna) {
  if (texto.startsWith('=') || texto.startsWith('@')) {
    return true;
  }
  if (texto.startsWith('-') && !['geo_lat', 'geo_lng'].includes(coluna)) {
    return true;
  }
  return texto.startsWith('+') && !COLUNAS_E164.has(coluna);
}

function normalizarDataCelula(texto) {
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  let ano;
  let mes;
  let dia;
  if (br) {
    [dia, mes, ano] = [Number(br[1]), Number(br[2]), Number(br[3])];
  } else if (iso) {
    [ano, mes, dia] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else {
    return { ok: false, detalhe: 'data deve usar DD/MM/AAAA ou AAAA-MM-DD' };
  }
  const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
  const diasPorMes = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (ano < 1900 || mes < 1 || mes > 12 || dia < 1 || dia > diasPorMes[mes - 1]) {
    return { ok: false, detalhe: 'data inexistente no calendario' };
  }
  return {
    ok: true,
    valor: `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  };
}

function normalizarCepCelula(texto) {
  const digitos = texto.replace(/^(\d{5})-(\d{3})$/, '$1$2');
  if (!/^\d{8}$/.test(digitos)) {
    return { ok: false, detalhe: 'CEP deve ter 8 digitos (aceito 00000-000)' };
  }
  return { ok: true, valor: digitos };
}

function normalizarTelefoneCelula(texto) {
  if (/^\+55\d{10,11}$/.test(texto)) {
    return { ok: true, valor: texto };
  }
  if (/^55\d{10,11}$/.test(texto)) {
    return { ok: true, valor: `+${texto}` };
  }
  return {
    ok: false,
    detalhe: 'telefone deve estar em E.164 (+55DDNNNNNNNNN), sem espacos, parenteses ou hifen'
  };
}

function normalizarDecimalCelula(texto) {
  if (!/^-?\d+(?:[.,]\d+)?$/.test(texto)) {
    return { ok: false, detalhe: 'use numero decimal com virgula ou ponto (ex.: -3,7319)' };
  }
  return { ok: true, valor: Number(texto.replace(',', '.')) };
}

function normalizarBooleanoCelula(texto) {
  const valor = texto.trim().toLowerCase();
  if (valor === 'sim') {
    return { ok: true, valor: true };
  }
  if (valor === 'nao' || valor === 'não') {
    return { ok: true, valor: false };
  }
  return { ok: false, detalhe: 'use "sim" ou "nao"' };
}

function normalizarUfCelula(texto) {
  if (!REGEX_UF.test(texto)) {
    return { ok: false, detalhe: 'UF deve ter 2 letras (ex.: CE)' };
  }
  return { ok: true, valor: texto.toUpperCase() };
}

function normalizarEmailCelula(texto) {
  if (!REGEX_EMAIL.test(texto)) {
    return { ok: false, detalhe: 'e-mail invalido (ex.: nome@dominio)' };
  }
  return { ok: true, valor: texto };
}

function normalizarListaCelula(texto) {
  const vistos = new Set();
  const itens = [];
  for (const bruto of texto.split('|')) {
    const item = bruto.trim();
    if (item === '' || vistos.has(item)) {
      continue;
    }
    vistos.add(item);
    itens.push(item);
  }
  return itens;
}

function normalizarHorariosCelula(texto) {
  const horarios = [];
  for (const faixa of texto.split('|')) {
    const parte = faixa.trim();
    if (parte === '') {
      continue;
    }
    const separador = parte.indexOf(':');
    if (separador <= 0) {
      return { ok: false, detalhe: 'horario deve usar dias:HH:MM-HH:MM[:observacao]' };
    }
    const dias = parte
      .slice(0, separador)
      .split(',')
      .map((dia) => dia.trim())
      .filter(Boolean);
    const resto = parte.slice(separador + 1);
    const horas = /^(([01]\d|2[0-3]):[0-5]\d)-(([01]\d|2[0-3]):[0-5]\d)(?::(.*))?$/.exec(resto);
    if (!horas) {
      return { ok: false, detalhe: 'horario deve usar dias:HH:MM-HH:MM[:observacao]' };
    }
    if (dias.length === 0 || dias.some((dia) => !DIAS_SEMANA.includes(dia))) {
      return { ok: false, detalhe: `dias devem ser um de: ${DIAS_SEMANA.join(', ')}` };
    }
    if (horas[1] >= horas[3]) {
      return { ok: false, detalhe: 'horario invalido: abre deve ser menor que fecha' };
    }
    const observacao = (horas[5] ?? '').trim();
    horarios.push({
      dias,
      abre: horas[1],
      fecha: horas[3],
      obs: observacao === '' ? null : observacao
    });
  }
  return { ok: true, valor: horarios };
}

function maiorData(...datas) {
  const validas = datas.filter((data) => typeof data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data));
  return validas.length === 0 ? null : validas.sort(compararTexto).at(-1);
}

function diferencias(antes, depois, prefixo = '') {
  const destino = [];
  if (JSON.stringify(antes) === JSON.stringify(depois)) {
    return destino;
  }
  const ambosObjetos =
    antes && depois && typeof antes === 'object' && typeof depois === 'object' && !Array.isArray(antes) && !Array.isArray(depois);
  if (ambosObjetos) {
    const chaves = new Set([...Object.keys(antes), ...Object.keys(depois)]);
    for (const chave of [...chaves].sort(compararTexto)) {
      destino.push(...diferencias(antes[chave] ?? null, depois[chave] ?? null, prefixo ? `${prefixo}.${chave}` : chave));
    }
    return destino;
  }
  if (Array.isArray(antes) && Array.isArray(depois)) {
    const tamanho = Math.max(antes.length, depois.length);
    for (let posicao = 0; posicao < tamanho; posicao += 1) {
      destino.push(
        ...diferencias(
          antes[posicao] ?? null,
          depois[posicao] ?? null,
          `${prefixo}[${posicao}]`
        )
      );
    }
    return destino;
  }
  destino.push({ caminho: prefixo || '(raiz)', de: antes ?? null, para: depois ?? null });
  return destino;
}

function filtrarDiferencias(diffs, ignorar = []) {
  return diffs.filter(
    (diff) => !ignorar.some((caminho) => diff.caminho === caminho || diff.caminho.startsWith(`${caminho}.`) || diff.caminho.startsWith(`${caminho}[`))
  );
}

function resumirValor(valor) {
  if (valor === null || valor === undefined) {
    return null;
  }
  if (typeof valor === 'object') {
    return JSON.stringify(valor);
  }
  const texto = String(valor);
  return texto.length > 120 ? `${texto.slice(0, 117)}...` : texto;
}

function fontesConfirmacao(confirmacao) {
  const fontes = [`confirmacao via ${confirmacao.comoConfirmou}`, confirmacao.fonte];
  return fontes.filter((fonte, indice) => fontes.indexOf(fonte) === indice);
}

function entidadeDaLinha(chave, mapa, numero) {
  const valor = (coluna) => String(mapa[coluna] ?? '').trim();
  if (chave === 'unidades') {
    return valor('slug') || `linha-${numero}`;
  }
  if (chave === 'site') {
    return 'site';
  }
  if (chave === 'convenios') {
    return valor('id') || `linha-${numero}`;
  }
  if (chave === 'preparos') {
    return valor('id') || valor('slug') || `linha-${numero}`;
  }
  const pagina = valor('pagina') || 'pagina';
  const bloco = valor('bloco') || `linha-${numero}`;
  return `${pagina}/${bloco}`;
}

function classificarLinha(estado, chave, mapa, entidade, numero) {
  const classes = {};
  for (const coluna of COLUNAS[chave]) {
    const bruto = String(mapa[coluna] ?? '');
    if (bruto.length > LIMITE_CELULA_CHARS) {
      estado.erros.push(
        erroColeta(
          ARQUIVO_POR_CHAVE[chave],
          coluna,
          entidade,
          `celula excede o limite de ${LIMITE_CELULA_CHARS} caracteres`,
          numero
        )
      );
      classes[coluna] = { tipo: 'invalido' };
      continue;
    }
    if (REGEX_CONTROLE.test(bruto)) {
      estado.erros.push(
        erroColeta(
          ARQUIVO_POR_CHAVE[chave],
          coluna,
          entidade,
          'celula contem caractere de controle (TAB, CR, LF ou similar)',
          numero
        )
      );
      classes[coluna] = { tipo: 'invalido' };
      continue;
    }
    const classe = classificarCelula(bruto);
    if (classe.tipo === 'valor' && ehFormula(classe.valor, coluna)) {
      estado.erros.push(
        erroColeta(
          ARQUIVO_POR_CHAVE[chave],
          coluna,
          entidade,
          'celula inicia com =, @, - ou + fora de telefone/coordenada (possivel injecao de formula)',
          numero
        )
      );
      classes[coluna] = { tipo: 'invalido' };
    } else {
      classes[coluna] = classe;
    }
  }
  return classes;
}

function lerConfirmacao(estado, arquivo, classes, entidade, numero) {
  const confirmacao = {};
  let valido = true;
  const falta = (campo, detalhe) => {
    estado.erros.push(erroColeta(arquivo, campo, entidade, detalhe, numero));
    valido = false;
  };

  const resposta = classes.confirmacao;
  if (resposta.tipo !== 'valor' || !RESPOSTAS_CONFIRMACAO.has(resposta.valor.toLowerCase())) {
    falta('confirmacao', 'informe "confirmo" ou "corrijo" na linha com dado');
  } else {
    confirmacao.confirmacao = resposta.valor.toLowerCase();
  }

  const por = classes.confirmado_por;
  if (por.tipo !== 'valor' || por.valor.length < 3) {
    falta('confirmado_por', 'informe nome e funcao de quem confirmou (minimo 3 caracteres)');
  } else {
    confirmacao.confirmadoPor = por.valor;
  }

  const canal = classes.como_confirmou;
  const canalNormalizado = canal.tipo === 'valor' ? canal.valor.toLowerCase().replace('e-mail', 'email') : '';
  if (!CANAIS_CONFIRMACAO.has(canalNormalizado)) {
    falta('como_confirmou', 'use email, telefone, reuniao, documento ou whatsapp');
  } else {
    confirmacao.comoConfirmou = canalNormalizado;
  }

  const fonte = classes.fonte;
  if (fonte.tipo !== 'valor' || fonte.valor.length < 3) {
    falta('fonte', 'informe assunto, protocolo, arquivo ou ata (minimo 3 caracteres)');
  } else {
    confirmacao.fonte = fonte.valor;
  }

  const data = classes.data_confirmacao;
  if (data.tipo !== 'valor') {
    falta('data_confirmacao', 'informe a data da confirmacao em DD/MM/AAAA');
  } else {
    const normalizada = normalizarDataCelula(data.valor);
    if (!normalizada.ok) {
      falta('data_confirmacao', normalizada.detalhe);
    } else {
      confirmacao.data = normalizada.valor;
    }
  }

  return valido ? confirmacao : null;
}

function prepararLinha(estado, chave, item, linha) {
  const errosIniciais = estado.erros.length;
  const entidade = entidadeDaLinha(chave, linha.mapa, linha.numero);
  const classes = classificarLinha(estado, chave, linha.mapa, entidade, linha.numero);
  const reg = {
    arquivo: item.arquivo,
    linha: linha.numero,
    entidade,
    tipo: TIPO_REGISTRO[chave],
    campos: [],
    camposSentinela: [],
    camposVazios: 0,
    tokens: [],
    sobrescritas: [],
    errosIniciais
  };

  let temDado = false;
  for (const coluna of COLUNAS_DADOS[chave]) {
    const classe = classes[coluna];
    if (classe.tipo === 'sentinela') {
      reg.camposSentinela.push(coluna);
    } else if (classe.tipo === 'vazio') {
      reg.camposVazios += 1;
    } else if (classe.tipo === 'nao-temos' || classe.tipo === 'nao-sabemos') {
      reg.tokens.push({
        campo: coluna,
        valor: classe.tipo === 'nao-temos' ? TOKEN_NAO_TEMOS : TOKEN_NAO_SABEMOS
      });
      temDado = true;
    } else if (classe.tipo === 'valor') {
      temDado = true;
    }
  }

  reg.valores = {};
  for (const coluna of COLUNAS_DADOS[chave]) {
    const classe = classes[coluna];
    if (classe.tipo === 'valor') {
      reg.valores[coluna] = classe.valor;
    } else if (classe.tipo === 'nao-temos' || classe.tipo === 'nao-sabemos') {
      reg.valores[coluna] = classe.tipo === 'nao-temos' ? TOKEN_NAO_TEMOS : TOKEN_NAO_SABEMOS;
    }
  }

  const observacaoClasse = classes.observacoes_coleta;
  const observacao =
    observacaoClasse.tipo === 'valor'
      ? observacaoClasse.valor
      : observacaoClasse.tipo === 'nao-temos'
        ? TOKEN_NAO_TEMOS
        : observacaoClasse.tipo === 'nao-sabemos'
          ? TOKEN_NAO_SABEMOS
          : null;

  if (!temDado) {
    estado.linhasIgnoradas.push({
      arquivo: item.arquivo,
      linha: linha.numero,
      entidade,
      tipo: reg.tipo,
      motivo: observacao ? 'somente observacoes_coleta' : 'sem dado respondido',
      ...(observacao ? { observacao } : {})
    });
    return null;
  }

  reg.campos = COLUNAS_DADOS[chave].filter((coluna) =>
    ['valor', 'nao-temos', 'nao-sabemos'].includes(classes[coluna].tipo)
  );
  if (observacao) {
    reg.observacao = observacao;
  }
  const confirmacao = lerConfirmacao(estado, item.arquivo, classes, entidade, linha.numero);
  if (!confirmacao) {
    return null;
  }
  return { entidade, classes, reg, confirmacao };
}

function registrarImportada(estado, reg, confirmacao) {
  if (estado.erros.length > reg.errosIniciais) {
    return;
  }
  const registro = { ...reg };
  delete registro.errosIniciais;
  delete registro.valores;
  estado.linhasImportadas.push(registro);
  estado.confirmacoes.push({
    arquivo: reg.arquivo,
    linha: reg.linha,
    entidade: reg.entidade,
    confirmacao: confirmacao.confirmacao,
    confirmadoPor: confirmacao.confirmadoPor,
    comoConfirmou: confirmacao.comoConfirmou,
    fonte: confirmacao.fonte,
    data: confirmacao.data
  });
  if (estado.sobrescrever) {
    for (const campo of reg.campos) {
      estado.sobrescritas.push({
        arquivo: reg.arquivo,
        entidade: reg.entidade,
        campo,
        valor: resumirValor(reg.valores[campo] ?? '')
      });
    }
  }
  if (reg.tipo === 'convenio' && reg.valores.unidades && !ehToken(reg.valores.unidades)) {
    for (const slug of normalizarListaCelula(reg.valores.unidades)) {
      estado.relacoes.push({
        arquivo: reg.arquivo,
        entidade: slug,
        convenio: reg.entidade,
        data: confirmacao.data
      });
    }
  }
  estado.tokens.push(
    ...reg.tokens.map((token) => ({
      arquivo: reg.arquivo,
      entidade: reg.entidade,
      campo: token.campo,
      token: token.valor
    }))
  );
}

function valorObrigatorio(estado, arquivo, classes, coluna, entidade, numero) {
  const classe = classes[coluna];
  if (classe.tipo === 'nao-temos' || classe.tipo === 'nao-sabemos') {
    estado.erros.push(
      erroColeta(arquivo, coluna, entidade, 'token nao e aceito em campo obrigatorio', numero)
    );
    return null;
  }
  if (classe.tipo !== 'valor') {
    estado.erros.push(erroColeta(arquivo, coluna, entidade, 'campo obrigatorio vazio', numero));
    return null;
  }
  return classe.valor;
}

function aplicarTexto(novo, chave, classe) {
  if (classe.tipo === 'valor') {
    novo[chave] = classe.valor;
  } else if (classe.tipo === 'nao-temos') {
    novo[chave] = null;
  }
}

function aplicarBooleano(estado, arquivo, classes, coluna, entidade, numero, novo, chave) {
  const classe = classes[coluna];
  if (classe.tipo === 'valor') {
    const normalizado = normalizarBooleanoCelula(classe.valor);
    if (!normalizado.ok) {
      estado.erros.push(erroColeta(arquivo, coluna, entidade, normalizado.detalhe, numero));
      return;
    }
    novo[chave] = normalizado.valor;
  } else if (classe.tipo === 'nao-temos') {
    novo[chave] = false;
  }
}

function aplicarLista(estado, arquivo, classes, coluna, entidade, numero, novo, chave, validar) {
  const classe = classes[coluna];
  if (classe.tipo === 'nao-temos') {
    novo[chave] = [];
    return;
  }
  if (classe.tipo !== 'valor') {
    return;
  }
  const itens = normalizarListaCelula(classe.valor);
  if (validar) {
    const invalido = itens.find((item) => !validar.has(item));
    if (invalido) {
      estado.erros.push(
        erroColeta(arquivo, coluna, entidade, `referencia inexistente: ${invalido}`, numero)
      );
      return;
    }
  }
  novo[chave] = itens;
}

function aplicarTelefones(estado, arquivo, classes, entidade, numero, unidade, novo) {
  const mexido = [1, 2, 3].some((posicao) =>
    ['rotulo', 'e164', 'tipo'].some((campo) =>
      ['valor', 'nao-temos', 'nao-sabemos'].includes(classes[`telefone_${posicao}_${campo}`].tipo)
    )
  );
  if (!mexido) {
    return;
  }

  const existentes = Array.isArray(unidade.telefones) ? unidade.telefones : [];
  const telefones = [];
  for (let posicao = 1; posicao <= 3; posicao += 1) {
    const sufixo = `telefone_${posicao}_`;
    const e164Classe = classes[`${sufixo}e164`];
    const tipoClasse = classes[`${sufixo}tipo`];
    const rotuloClasse = classes[`${sufixo}rotulo`];
    const principalClasse = classes[`${sufixo}principal`];
    const existente = existentes[posicao - 1] ?? null;

    if (e164Classe.tipo === 'nao-temos') {
      continue;
    }

    if (e164Classe.tipo !== 'valor') {
      const outrosPreenchidos = [tipoClasse, rotuloClasse].some(
        (classe) => classe.tipo === 'valor'
      );
      if (outrosPreenchidos) {
        estado.erros.push(
          erroColeta(
            arquivo,
            `${sufixo}e164`,
            entidade,
            'slot de telefone com rotulo/tipo/principal exige e164',
            numero
          )
        );
        continue;
      }
      if (existente) {
        telefones.push(existente);
      }
      continue;
    }

    const e164 = normalizarTelefoneCelula(e164Classe.valor);
    if (!e164.ok) {
      estado.erros.push(erroColeta(arquivo, `${sufixo}e164`, entidade, e164.detalhe, numero));
      continue;
    }
    if (tipoClasse.tipo !== 'valor' || !['fixo', 'movel'].includes(tipoClasse.valor.toLowerCase())) {
      estado.erros.push(
        erroColeta(arquivo, `${sufixo}tipo`, entidade, 'informe tipo "fixo" ou "movel" quando houver e164', numero)
      );
      continue;
    }
    const principal = (() => {
      if (principalClasse.tipo === 'valor') {
        const normalizado = normalizarBooleanoCelula(principalClasse.valor);
        if (!normalizado.ok) {
          estado.erros.push(
            erroColeta(arquivo, `${sufixo}principal`, entidade, normalizado.detalhe, numero)
          );
          return null;
        }
        return normalizado.valor;
      }
      if (principalClasse.tipo === 'nao-temos' || principalClasse.tipo === 'nao-sabemos') {
        estado.erros.push(
          erroColeta(arquivo, `${sufixo}principal`, entidade, 'principal nao aceita token', numero)
        );
        return null;
      }
      return false;
    })();
    if (principal === null) {
      continue;
    }
    const rotulo =
      rotuloClasse.tipo === 'valor' ? rotuloClasse.valor : existente?.rotulo ?? null;
    telefones.push({
      rotulo,
      e164: e164.valor,
      tipo: tipoClasse.valor.toLowerCase(),
      validado: true,
      principal
    });
  }

  if (telefones.filter((telefone) => telefone.principal === true).length > 1) {
    estado.erros.push(
      erroColeta(arquivo, 'telefones', entidade, 'no maximo um telefone pode ser principal', numero)
    );
    return;
  }
  novo.telefones = telefones;
}

function aplicarWhatsapp(estado, arquivo, classes, entidade, numero, unidade, novo) {
  const classe = classes.whatsapp_e164;
  if (classe.tipo === 'nao-temos') {
    novo.whatsapp = { e164: null, validado: false };
    return;
  }
  if (classe.tipo !== 'valor') {
    return;
  }
  const e164 = normalizarTelefoneCelula(classe.valor);
  if (!e164.ok) {
    estado.erros.push(erroColeta(arquivo, 'whatsapp_e164', entidade, e164.detalhe, numero));
    return;
  }
  void unidade;
  novo.whatsapp = { e164: e164.valor, validado: true };
}

function aplicarGeo(estado, arquivo, classes, entidade, numero, unidade, novo) {
  const lerCoordenada = (coluna, chave) => {
    const classe = classes[coluna];
    if (classe.tipo === 'nao-temos') {
      return { tipo: 'limpar', valor: null };
    }
    if (classe.tipo === 'valor') {
      const normalizado = normalizarDecimalCelula(classe.valor);
      if (!normalizado.ok) {
        estado.erros.push(erroColeta(arquivo, coluna, entidade, normalizado.detalhe, numero));
        return { tipo: 'invalido' };
      }
      return { tipo: 'valor', valor: normalizado.valor };
    }
    return { tipo: 'preservar', valor: unidade?.geo?.[chave] ?? null };
  };

  const lat = lerCoordenada('geo_lat', 'lat');
  const lng = lerCoordenada('geo_lng', 'lng');
  if (lat.tipo === 'invalido' || lng.tipo === 'invalido') {
    return;
  }
  const temLat = lat.valor !== null && lat.valor !== undefined;
  const temLng = lng.valor !== null && lng.valor !== undefined;
  if (temLat !== temLng) {
    estado.erros.push(
      erroColeta(arquivo, 'geo', entidade, 'latitude e longitude devem ser informadas juntas', numero)
    );
    return;
  }
  if (temLat) {
    novo.geo = { ...(novo.geo ?? {}), lat: lat.valor, lng: lng.valor };
  } else {
    novo.geo = { ...(novo.geo ?? {}), lat: null, lng: null };
  }

  const precisao = classes.geo_precisao;
  if (precisao.tipo === 'valor') {
    if (!['exata', 'aproximada'].includes(precisao.valor)) {
      estado.erros.push(
        erroColeta(arquivo, 'geo_precisao', entidade, 'use "exata" ou "aproximada"', numero)
      );
      return;
    }
    novo.geo.precisao = precisao.valor;
  } else if (precisao.tipo === 'nao-temos') {
    novo.geo.precisao = null;
  }
  if (temLat && !['exata', 'aproximada'].includes(novo.geo.precisao)) {
    estado.erros.push(
      erroColeta(arquivo, 'geo_precisao', entidade, 'coordenadas exigem precisao "exata" ou "aproximada"', numero)
    );
  }
}

function processarUnidade(estado, item, linha) {
  const preparado = prepararLinha(estado, 'unidades', item, linha);
  if (!preparado) {
    return;
  }
  const { entidade, classes, reg, confirmacao } = preparado;
  if (estado.unidadesCsv.has(entidade)) {
    estado.erros.push(
      erroColeta(item.arquivo, 'slug', entidade, 'linha duplicada para a mesma unidade', linha.numero)
    );
    return;
  }
  estado.unidadesCsv.add(entidade);
  const lista = estado.candidato.unidades.unidades;
  let indice = lista.findIndex((unidade) => unidade.slug === entidade);
  if (indice === -1) {
    const idCsv = classes.id.tipo === 'valor' ? classes.id.valor : null;
    const porId = idCsv ? lista.findIndex((unidade) => unidade.id === idCsv) : -1;
    if (porId !== -1) {
      estado.erros.push(
        erroColeta(
          item.arquivo,
          'slug',
          entidade,
          `campo imutavel: slug nao pode mudar (id ${idCsv} pertence a ${lista[porId].slug})`,
          linha.numero
        )
      );
      return;
    }
    estado.erros.push(
      erroColeta(item.arquivo, 'slug', entidade, 'unidade inexistente; crie manualmente pelo fluxo do README', linha.numero)
    );
    return;
  }
  const atual = lista[indice];

  const slug = valorObrigatorio(estado, item.arquivo, classes, 'slug', entidade, linha.numero);
  if (slug !== null && slug !== atual.slug) {
    estado.erros.push(erroColeta(item.arquivo, 'slug', entidade, 'campo imutavel: slug nao pode mudar', linha.numero));
  }
  const id = valorObrigatorio(estado, item.arquivo, classes, 'id', entidade, linha.numero);
  if (id !== null && id !== atual.id) {
    estado.erros.push(erroColeta(item.arquivo, 'id', entidade, 'campo imutavel: id nao pode mudar', linha.numero));
  }
  const matriz = valorObrigatorio(estado, item.arquivo, classes, 'matriz', entidade, linha.numero);
  if (matriz !== null) {
    const normalizada = normalizarBooleanoCelula(matriz);
    if (!normalizada.ok) {
      estado.erros.push(erroColeta(item.arquivo, 'matriz', entidade, normalizada.detalhe, linha.numero));
    } else if (normalizada.valor !== (atual.matriz === true)) {
      estado.erros.push(erroColeta(item.arquivo, 'matriz', entidade, 'campo imutavel: matriz nao pode mudar', linha.numero));
    }
  }

  const novo = structuredClone(atual);

  for (const [coluna, chave] of [
    ['nome_exibicao', 'nomeExibicao'],
    ['cidade', 'cidade'],
    ['cnpj_filial', 'cnpjFilial'],
    ['endereco_logradouro', 'logradouro'],
    ['endereco_numero', 'numero'],
    ['endereco_complemento', 'complemento'],
    ['endereco_bairro', 'bairro'],
    ['endereco_referencia', 'referencia'],
    ['observacoes_publicas', 'observacoesPublicas']
  ]) {
    const classe = classes[coluna];
    if (chave === 'observacoesPublicas') {
      aplicarTexto(novo, chave, classe);
      continue;
    }
    if (['nomeExibicao', 'cidade'].includes(chave) && (classe.tipo === 'nao-temos' || classe.tipo === 'nao-sabemos')) {
      estado.erros.push(erroColeta(item.arquivo, coluna, entidade, 'token nao e aceito em campo obrigatorio', linha.numero));
      continue;
    }
    if (chave in (novo.endereco ?? {})) {
      if (classe.tipo === 'valor') {
        novo.endereco[chave] = classe.valor;
      } else if (classe.tipo === 'nao-temos') {
        novo.endereco[chave] = null;
      }
      continue;
    }
    aplicarTexto(novo, chave, classe);
  }

  const uf = classes.uf;
  if (uf.tipo === 'valor') {
    const normalizada = normalizarUfCelula(uf.valor);
    if (!normalizada.ok) {
      estado.erros.push(erroColeta(item.arquivo, 'uf', entidade, normalizada.detalhe, linha.numero));
    } else {
      novo.uf = normalizada.valor;
    }
  } else if (uf.tipo === 'nao-temos' || uf.tipo === 'nao-sabemos') {
    estado.erros.push(erroColeta(item.arquivo, 'uf', entidade, 'token nao e aceito em campo obrigatorio', linha.numero));
  }

  if (novo.cnpjFilial) {
    if (!REGEX_CNPJ.test(novo.cnpjFilial)) {
      estado.erros.push(erroColeta(item.arquivo, 'cnpj_filial', entidade, 'CNPJ deve seguir 00.000.000/0000-00', linha.numero));
    }
  }

  const cep = classes.endereco_cep;
  if (cep.tipo === 'valor') {
    const normalizado = normalizarCepCelula(cep.valor);
    if (!normalizado.ok) {
      estado.erros.push(erroColeta(item.arquivo, 'endereco_cep', entidade, normalizado.detalhe, linha.numero));
    } else {
      novo.endereco.cep = normalizado.valor;
    }
  } else if (cep.tipo === 'nao-temos') {
    novo.endereco.cep = null;
  }

  aplicarGeo(estado, item.arquivo, classes, entidade, linha.numero, atual, novo);
  aplicarTelefones(estado, item.arquivo, classes, entidade, linha.numero, atual, novo);
  aplicarWhatsapp(estado, item.arquivo, classes, entidade, linha.numero, atual, novo);

  const email = classes.email;
  if (email.tipo === 'valor') {
    const normalizado = normalizarEmailCelula(email.valor);
    if (!normalizado.ok) {
      estado.erros.push(erroColeta(item.arquivo, 'email', entidade, normalizado.detalhe, linha.numero));
    } else {
      novo.email = normalizado.valor;
    }
  } else if (email.tipo === 'nao-temos') {
    novo.email = null;
  }

  const horarios = classes.horarios;
  if (horarios.tipo === 'valor') {
    const normalizados = normalizarHorariosCelula(horarios.valor);
    if (!normalizados.ok) {
      estado.erros.push(erroColeta(item.arquivo, 'horarios', entidade, normalizados.detalhe, linha.numero));
    } else {
      novo.horarios = normalizados.valor;
    }
  } else if (horarios.tipo === 'nao-temos') {
    novo.horarios = [];
  }

  aplicarLista(estado, item.arquivo, classes, 'servicos', entidade, linha.numero, novo, 'servicos', estado.idsServicos);

  const conveniosCelula = classes.convenios;
  const ladoConvenios = estado.conveniosPorUnidade.get(atual.slug) ?? new Set();
  let conveniosBase = atual.convenios ?? [];
  if (conveniosCelula.tipo === 'valor') {
    const itens = normalizarListaCelula(conveniosCelula.valor);
    const invalido = itens.find((idConvenio) => !estado.idsConvenios.has(idConvenio));
    if (invalido) {
      estado.erros.push(erroColeta(item.arquivo, 'convenios', entidade, `referencia inexistente: ${invalido}`, linha.numero));
    }
    conveniosBase = itens;
  } else if (conveniosCelula.tipo === 'nao-temos') {
    conveniosBase = [];
    if (ladoConvenios.size > 0) {
      estado.erros.push(
        erroColeta(
          item.arquivo,
          'convenios',
          entidade,
          `conflito: unidade diz NAO_TEMOS, mas convenios.csv vincula ${[...ladoConvenios].sort(compararTexto).join(', ')}`,
          linha.numero
        )
      );
    }
  }
  const conveniosFinal = [...conveniosBase];
  for (const idConvenio of [...ladoConvenios].sort(compararTexto)) {
    if (!conveniosFinal.includes(idConvenio)) {
      conveniosFinal.push(idConvenio);
    }
  }
  novo.convenios = conveniosFinal;

  aplicarBooleano(estado, item.arquivo, classes, 'atendimento_particular', entidade, linha.numero, novo, 'atendimentoParticular');
  novo.comodidades = { ...(novo.comodidades ?? {}) };
  aplicarBooleano(estado, item.arquivo, classes, 'comodidades_estacionamento', entidade, linha.numero, novo.comodidades, 'estacionamento');
  aplicarBooleano(estado, item.arquivo, classes, 'comodidades_acessivel', entidade, linha.numero, novo.comodidades, 'acessivel');

  novo.redesSociais = { ...(novo.redesSociais ?? {}) };
  aplicarTexto(novo.redesSociais, 'instagram', classes.redes_instagram);
  aplicarTexto(novo.redesSociais, 'facebook', classes.redes_facebook);

  const diffs = filtrarDiferencias(diferencias(atual, novo), ['status', 'validacao', 'atualizadoEm']);
  const confirmada = unidadeConfirmada(atual);
  if (confirmada && diffs.length > 0 && !estado.sobrescrever) {
    estado.erros.push(
      erroColeta(
        item.arquivo,
        'sobrescrever',
        entidade,
        'unidade confirmada com alteracao; revise e use --sobrescrever (a entidade sera rebaixada)',
        linha.numero
      )
    );
    return;
  }
  if (confirmada && diffs.length === 0) {
    registrarImportada(estado, reg, confirmacao);
    return;
  }

  novo.status = 'a-confirmar';
  novo.validacao = {
    ...(novo.validacao ?? {}),
    status: 'pendente',
    confirmadoPor: confirmacao.confirmadoPor,
    data: maiorData(atual.validacao?.data, confirmacao.data) ?? confirmacao.data,
    fontes: fontesConfirmacao(confirmacao)
  };
  novo.atualizadoEm = maiorData(atual.atualizadoEm, confirmacao.data) ?? atual.atualizadoEm;
  lista[indice] = novo;
  estado.alterados.add('unidades');
  estado.datas.unidades.push(confirmacao.data);
  registrarImportada(estado, reg, confirmacao);
}

function processarSite(estado, item, linha) {
  const preparado = prepararLinha(estado, 'site', item, linha);
  if (!preparado) {
    return;
  }
  const { classes, reg, confirmacao } = preparado;
  const entidade = 'site';
  const atual = estado.candidato.site;
  const novo = structuredClone(atual);
  const camposRt = ['rt_nome', 'rt_crm', 'rt_crm_uf', 'rt_especialidade'];
  const rtSubmetido = camposRt.some((coluna) => ['valor', 'nao-temos', 'nao-sabemos'].includes(classes[coluna].tipo));

  aplicarTexto(novo.responsavelTecnico, 'nome', classes.rt_nome);
  aplicarTexto(novo.responsavelTecnico, 'crm', classes.rt_crm);
  const crmUf = classes.rt_crm_uf;
  if (crmUf.tipo === 'valor') {
    const normalizada = normalizarUfCelula(crmUf.valor);
    if (!normalizada.ok) {
      estado.erros.push(erroColeta(item.arquivo, 'rt_crm_uf', entidade, normalizada.detalhe, linha.numero));
    } else {
      novo.responsavelTecnico.crmUf = normalizada.valor;
    }
  } else if (crmUf.tipo === 'nao-temos') {
    novo.responsavelTecnico.crmUf = null;
  }
  aplicarTexto(novo.responsavelTecnico, 'especialidade', classes.rt_especialidade);

  const email = classes.email_institucional;
  if (email.tipo === 'valor') {
    const normalizado = normalizarEmailCelula(email.valor);
    if (!normalizado.ok) {
      estado.erros.push(erroColeta(item.arquivo, 'email_institucional', entidade, normalizado.detalhe, linha.numero));
    } else {
      novo.contatoInstitucional.email = normalizado.valor;
    }
  } else if (email.tipo === 'nao-temos') {
    novo.contatoInstitucional.email = null;
  }

  const telefone = classes.telefone_institucional_e164;
  if (telefone.tipo === 'valor') {
    const normalizado = normalizarTelefoneCelula(telefone.valor);
    if (!normalizado.ok) {
      estado.erros.push(erroColeta(item.arquivo, 'telefone_institucional_e164', entidade, normalizado.detalhe, linha.numero));
    } else {
      novo.contatoInstitucional.telefoneE164 = normalizado.valor;
    }
  } else if (telefone.tipo === 'nao-temos') {
    novo.contatoInstitucional.telefoneE164 = null;
  }

  aplicarTexto(novo.redesSociais, 'instagram', classes.instagram);
  aplicarTexto(novo.redesSociais, 'facebook', classes.facebook);

  const diffs = filtrarDiferencias(diferencias(atual, novo), ['atualizadoEm']);
  const confirmados = diffs.filter((diff) => {
    if (diff.caminho.startsWith('responsavelTecnico')) {
      return atual.responsavelTecnico?.status === 'confirmado';
    }
    if (diff.caminho.startsWith('contatoInstitucional')) {
      const chave = diff.caminho.split('.').at(-1);
      return Boolean(atual.contatoInstitucional?.[chave]);
    }
    if (diff.caminho.startsWith('redesSociais')) {
      const chave = diff.caminho.split('.').at(-1);
      return Boolean(atual.redesSociais?.[chave]);
    }
    return false;
  });
  if (confirmados.length > 0 && !estado.sobrescrever) {
    estado.erros.push(
      erroColeta(
        item.arquivo,
        'sobrescrever',
        entidade,
        `campo institucional ja confirmado/preenchido: ${confirmados.map((diff) => diff.caminho).join(', ')}; use --sobrescrever`,
        linha.numero
      )
    );
    return;
  }
  if (diffs.length === 0) {
    registrarImportada(estado, reg, confirmacao);
    return;
  }

  if (rtSubmetido) {
    novo.responsavelTecnico.status = 'pendente';
  }
  estado.candidato.site = novo;
  estado.alterados.add('site');
  registrarImportada(estado, reg, confirmacao);
}

function processarConvenio(estado, item, linha) {
  const preparado = prepararLinha(estado, 'convenios', item, linha);
  if (!preparado) {
    return;
  }
  const { classes, reg, confirmacao } = preparado;
  const id = valorObrigatorio(estado, item.arquivo, classes, 'id', reg.entidade, linha.numero);
  if (id === null) {
    return;
  }
  if (!REGEX_SLUG.test(id)) {
    estado.erros.push(erroColeta(item.arquivo, 'id', id, 'id deve usar apenas [a-z0-9-], sem acento', linha.numero));
    return;
  }
  if (estado.idsConvenioCsv.has(id)) {
    estado.erros.push(erroColeta(item.arquivo, 'id', id, 'id duplicado em convenios.csv', linha.numero));
    return;
  }
  estado.idsConvenioCsv.add(id);

  const lista = estado.candidato.convenios.convenios;
  const indice = lista.findIndex((convenio) => convenio.id === id);
  const atual = indice >= 0 ? lista[indice] : null;
  const novo = atual
    ? structuredClone(atual)
    : { id, nome: null, tipo: null, exibirLogo: false, logoAutorizado: false, aviso: null };

  const nome = classes.nome;
  if (nome.tipo === 'valor') {
    novo.nome = nome.valor;
  } else if (nome.tipo === 'nao-temos' || nome.tipo === 'nao-sabemos') {
    estado.erros.push(erroColeta(item.arquivo, 'nome', id, 'token nao e aceito em campo obrigatorio', linha.numero));
  }
  if (!novo.nome) {
    estado.erros.push(erroColeta(item.arquivo, 'nome', id, 'nome do convenio e obrigatorio', linha.numero));
    return;
  }

  const tipo = classes.tipo_convenio;
  if (tipo.tipo === 'valor') {
    novo.tipo = tipo.valor;
  } else if (tipo.tipo === 'nao-temos') {
    novo.tipo = null;
  }

  aplicarBooleano(estado, item.arquivo, classes, 'exibir_logo', id, linha.numero, novo, 'exibirLogo');
  aplicarBooleano(estado, item.arquivo, classes, 'logo_autorizado', id, linha.numero, novo, 'logoAutorizado');

  const aviso = classes.aviso;
  const avisoSubmetido =
    aviso.tipo === 'valor' || aviso.tipo === 'nao-temos' || aviso.tipo === 'nao-sabemos';
  const dataVigenciaEnviada = ['valor', 'nao-temos'].includes(classes.vigencia_inicio.tipo) ||
    ['valor', 'nao-temos'].includes(classes.vigencia_fim.tipo);
  let avisoTexto = novo.aviso ?? '';
  if (aviso.tipo === 'valor') {
    avisoTexto = aviso.valor;
  } else if (aviso.tipo === 'nao-temos') {
    avisoTexto = '';
  }

  const vigencia = (coluna) => {
    const classe = classes[coluna];
    if (classe.tipo === 'valor') {
      const normalizada = normalizarDataCelula(classe.valor);
      if (!normalizada.ok) {
        estado.erros.push(erroColeta(item.arquivo, coluna, id, normalizada.detalhe, linha.numero));
        return null;
      }
      return normalizada.valor;
    }
    return null;
  };
  const inicio = vigencia('vigencia_inicio');
  const fim = vigencia('vigencia_fim');
  if (dataVigenciaEnviada) {
    avisoTexto = avisoTexto
      .replace(/\s*Vigência informada:\s*\d{2}\/\d{2}\/\d{4}(?:\s*a\s*\d{2}\/\d{2}\/\d{4})?\.?\s*$/, '')
      .trimEnd();
    if (inicio || fim) {
      const intervalo = inicio && fim ? `${formatarDataBr(inicio)} a ${formatarDataBr(fim)}` : formatarDataBr(inicio || fim);
      const sufixo = `Vigência informada: ${intervalo}.`;
      avisoTexto = avisoTexto ? `${avisoTexto} ${sufixo}` : sufixo;
    }
  }
  if (!atual && !avisoSubmetido && avisoTexto === '') {
    avisoTexto = AVISO_CONVENIO_PADRAO;
  }
  novo.aviso = avisoTexto === '' ? null : avisoTexto;

  const unidadesLado = [];
  const unidadesClasse = classes.unidades;
  if (unidadesClasse.tipo === 'valor') {
    const slugs = normalizarListaCelula(unidadesClasse.valor);
    const invalido = slugs.find((slug) => !listaDeUnidades(estado).some((unidade) => unidade.slug === slug));
    if (invalido) {
      estado.erros.push(erroColeta(item.arquivo, 'unidades', id, `unidade inexistente: ${invalido}`, linha.numero));
    } else {
      unidadesLado.push(...slugs);
    }
  }
  for (const slug of unidadesLado) {
    if (!estado.conveniosPorUnidade.has(slug)) {
      estado.conveniosPorUnidade.set(slug, new Set());
    }
    estado.conveniosPorUnidade.get(slug).add(id);
    const relacaoAtual = estado.confirmacoesPorUnidade.get(slug);
    if (!relacaoAtual || confirmacao.data >= relacaoAtual.data) {
      estado.confirmacoesPorUnidade.set(slug, {
        data: confirmacao.data,
        confirmadoPor: confirmacao.confirmadoPor,
        comoConfirmou: confirmacao.comoConfirmou,
        fonte: confirmacao.fonte,
        arquivo: item.arquivo,
        linha: linha.numero,
        convenio: id
      });
    }
  }

  const diffs = atual ? diferencias(atual, novo) : [];
  if (atual && diffs.length > 0 && !estado.sobrescrever) {
    estado.erros.push(
      erroColeta(
        item.arquivo,
        'sobrescrever',
        id,
        'convenio ja cadastrado com alteracao; use --sobrescrever',
        linha.numero
      )
    );
    return;
  }
  if (atual && diffs.length === 0) {
    estado.datas.convenios.push(confirmacao.data);
    registrarImportada(estado, reg, confirmacao);
    return;
  }

  if (atual) {
    lista[indice] = novo;
  } else {
    lista.push(novo);
  }
  estado.alterados.add('convenios');
  estado.idsConvenios.add(id);
  estado.datas.convenios.push(confirmacao.data);
  registrarImportada(estado, reg, confirmacao);
}

function listaDeUnidades(estado) {
  return estado.candidato.unidades?.unidades ?? [];
}

function processarPreparo(estado, item, linha) {
  const preparado = prepararLinha(estado, 'preparos', item, linha);
  if (!preparado) {
    return;
  }
  const { classes, reg, confirmacao } = preparado;
  const idCelula = classes.id.tipo === 'valor' ? classes.id.valor : null;
  const slugCelula = classes.slug.tipo === 'valor' ? classes.slug.valor : null;
  const chaveId = idCelula ? `id:${idCelula}` : null;
  const chaveSlug = slugCelula ? `slug:${slugCelula}` : null;
  if ((chaveId && estado.preparosCsv.has(chaveId)) || (chaveSlug && estado.preparosCsv.has(chaveSlug))) {
    const campo = chaveId && estado.preparosCsv.has(chaveId) ? 'id' : 'slug';
    const entidade = campo === 'id' ? idCelula : slugCelula;
    estado.erros.push(
      erroColeta(item.arquivo, campo, entidade, 'linha duplicada para o mesmo preparo', linha.numero)
    );
    return;
  }
  if (chaveId) {
    estado.preparosCsv.add(chaveId);
  }
  if (chaveSlug) {
    estado.preparosCsv.add(chaveSlug);
  }
  const id = valorObrigatorio(estado, item.arquivo, classes, 'id', reg.entidade, linha.numero);
  if (id === null) {
    return;
  }
  const lista = estado.candidato.preparos.preparos;
  const indice = lista.findIndex((preparo) => preparo.id === id);
  if (indice === -1) {
    estado.erros.push(
      erroColeta(item.arquivo, 'id', id, 'preparo inexistente; crie manualmente pelo fluxo do README', linha.numero)
    );
    return;
  }
  const atual = lista[indice];

  for (const [coluna, chave] of [
    ['slug', 'slug'],
    ['exame', 'exame'],
    ['servico_id', 'servicoId']
  ]) {
    const valor = valorObrigatorio(estado, item.arquivo, classes, coluna, id, linha.numero);
    if (valor !== null && valor !== atual[chave]) {
      estado.erros.push(erroColeta(item.arquivo, coluna, id, `campo imutavel: ${coluna} nao pode mudar`, linha.numero));
    }
  }

  const novo = structuredClone(atual);
  for (const chave of ['resumo', 'jejum', 'hidratacao', 'medicamentos', 'vestimenta', 'duracao', 'alerta']) {
    aplicarTexto(novo, chave, classes[chave]);
  }
  aplicarLista(estado, item.arquivo, classes, 'documentos', id, linha.numero, novo, 'documentos');
  aplicarLista(estado, item.arquivo, classes, 'observacoes', id, linha.numero, novo, 'observacoes');

  const crm = classes.registro_profissional;
  if (crm.tipo === 'valor') {
    novo.revisao.crm = crm.valor;
  } else if (crm.tipo === 'nao-temos') {
    novo.revisao.crm = null;
  }

  const diffs = filtrarDiferencias(diferencias(atual, novo), [
    'revisao.status',
    'revisao.responsavel',
    'revisao.data',
    'atualizadoEm'
  ]);
  const confirmado = preparoAprovado(atual);
  if (confirmado && diffs.length > 0 && !estado.sobrescrever) {
    estado.erros.push(
      erroColeta(
        item.arquivo,
        'sobrescrever',
        id,
        'preparo aprovado com alteracao; use --sobrescrever (a revisao sera rebaixada para pendente)',
        linha.numero
      )
    );
    return;
  }
  if (confirmado && diffs.length === 0) {
    registrarImportada(estado, reg, confirmacao);
    return;
  }

  novo.revisao = {
    ...(novo.revisao ?? {}),
    status: 'pendente',
    responsavel: confirmacao.confirmadoPor,
    crm: novo.revisao?.crm ?? null,
    data: maiorData(novo.revisao?.data, confirmacao.data) ?? confirmacao.data
  };
  novo.atualizadoEm = maiorData(atual.atualizadoEm, confirmacao.data) ?? atual.atualizadoEm;
  lista[indice] = novo;
  estado.alterados.add('preparos');
  estado.datas.preparos.push(confirmacao.data);
  registrarImportada(estado, reg, confirmacao);
}

function localizarBloco(estado, pagina, localizador) {
  const paginas = estado.candidato.paginas?.paginas ?? {};
  const config = paginas[pagina];
  if (!config) {
    return { erro: `pagina inexistente: ${pagina}`, campo: 'pagina' };
  }
  const blocos = Array.isArray(config.blocos) ? config.blocos : [];
  let indice = -1;
  if (localizador.startsWith('#')) {
    indice = Number(localizador.slice(1));
    if (!Number.isInteger(indice) || indice < 0 || indice >= blocos.length) {
      return { erro: `bloco inexistente: ${localizador}`, campo: 'bloco' };
    }
  } else {
    indice = blocos.findIndex((bloco) => bloco.id === localizador);
    if (indice === -1) {
      return { erro: `bloco inexistente: ${localizador}`, campo: 'bloco' };
    }
  }
  return { config, blocos, indice, bloco: blocos[indice] };
}

function processarTexto(estado, item, linha) {
  const preparado = prepararLinha(estado, 'textos', item, linha);
  if (!preparado) {
    return;
  }
  const { classes, reg, confirmacao } = preparado;
  const pagina = valorObrigatorio(estado, item.arquivo, classes, 'pagina', reg.entidade, linha.numero);
  const localizador = valorObrigatorio(estado, item.arquivo, classes, 'bloco', reg.entidade, linha.numero);
  const tipo = valorObrigatorio(estado, item.arquivo, classes, 'tipo_bloco', reg.entidade, linha.numero);
  if (pagina === null || localizador === null || tipo === null) {
    return;
  }
  const chaveTexto = `${pagina}/${localizador}`;
  if (estado.textosCsv.has(chaveTexto)) {
    estado.erros.push(
      erroColeta(item.arquivo, 'bloco', chaveTexto, 'linha duplicada para o mesmo bloco', linha.numero)
    );
    return;
  }
  estado.textosCsv.add(chaveTexto);
  const localizado = localizarBloco(estado, pagina, localizador);
  if (localizado.erro) {
    estado.erros.push(erroColeta(item.arquivo, localizado.campo ?? 'bloco', reg.entidade, localizado.erro, linha.numero));
    return;
  }
  if (localizado.bloco.tipo !== tipo) {
    estado.erros.push(
      erroColeta(item.arquivo, 'tipo_bloco', reg.entidade, 'tipo_bloco nao corresponde ao bloco atual', linha.numero)
    );
    return;
  }

  const novo = structuredClone(localizado.bloco);
  const texto = classes.texto;
  if (localizado.bloco.tipo === 'lista') {
    aplicarLista(estado, item.arquivo, classes, 'itens', reg.entidade, linha.numero, novo, 'itens');
    if (texto.tipo === 'valor') {
      novo.texto = texto.valor;
    }
  } else {
    if (texto.tipo === 'nao-temos' || texto.tipo === 'nao-sabemos') {
      estado.erros.push(
        erroColeta(item.arquivo, 'texto', reg.entidade, 'token nao e aceito em texto obrigatorio; deixe vazio para preservar', linha.numero)
      );
      return;
    }
    aplicarTexto(novo, 'texto', texto);
  }

  const diffs = filtrarDiferencias(diferencias(localizado.bloco, novo), ['status']);
  const aprovado = localizado.bloco.status === 'aprovado';
  if (aprovado && diffs.length > 0 && !estado.sobrescrever) {
    estado.erros.push(
      erroColeta(
        item.arquivo,
        'sobrescrever',
        reg.entidade,
        'bloco aprovado com alteracao; use --sobrescrever (o bloco sera rebaixado para pendente)',
        linha.numero
      )
    );
    return;
  }
  if (aprovado && diffs.length === 0) {
    registrarImportada(estado, reg, confirmacao);
    return;
  }

  novo.status = 'pendente';
  localizado.blocos[localizado.indice] = novo;
  estado.alterados.add('paginas');
  estado.datas.paginas.push(confirmacao.data);
  registrarImportada(estado, reg, confirmacao);
}

function aplicarRelacoesConvenio(estado) {
  if (estado.conveniosPorUnidade.size === 0) {
    return;
  }
  for (const slug of [...estado.conveniosPorUnidade.keys()].sort(compararTexto)) {
    const ids = [...estado.conveniosPorUnidade.get(slug)].sort(compararTexto);
    const lista = listaDeUnidades(estado);
    const indice = lista.findIndex((unidade) => unidade.slug === slug);
    if (indice === -1) {
      continue;
    }
    const atual = lista[indice];
    const existentes = new Set(atual.convenios ?? []);
    const faltantes = ids.filter((id) => !existentes.has(id));
    if (faltantes.length === 0) {
      continue;
    }
    const confirmada = unidadeConfirmada(atual);
    if (confirmada && !estado.sobrescrever) {
      estado.erros.push(
        erroColeta(
          ARQUIVO_CONVENIOS,
          'unidades',
          slug,
          `convenios.csv vincula ${faltantes.join(', ')} a unidade confirmada; use --sobrescrever`
        )
      );
      continue;
    }
    const novo = structuredClone(atual);
    novo.convenios = [...(atual.convenios ?? []), ...faltantes];
    const relacao = estado.confirmacoesPorUnidade.get(slug);
    const dataRelacao = relacao?.data ?? null;
    if (dataRelacao) {
      novo.atualizadoEm = maiorData(atual.atualizadoEm, dataRelacao) ?? atual.atualizadoEm;
      novo.validacao = {
        ...(novo.validacao ?? {}),
        status: 'pendente',
        confirmadoPor: relacao.confirmadoPor,
        data: maiorData(novo.validacao?.data, dataRelacao) ?? dataRelacao,
        fontes: fontesConfirmacao(relacao)
      };
      estado.datas.unidades.push(dataRelacao);
    }
    if (confirmada) {
      novo.status = 'a-confirmar';
      novo.validacao = { ...(novo.validacao ?? {}), status: 'pendente' };
    }
    lista[indice] = novo;
    estado.alterados.add('unidades');
  }
}

function validarCruzado(estado) {
  const { candidato } = estado;
  const site = candidato.site ?? {};
  if (site.contatoInstitucional?.email && !REGEX_EMAIL.test(site.contatoInstitucional.email)) {
    estado.erros.push(
      erroColeta('site.json', 'contatoInstitucional.email', 'site', 'e-mail institucional invalido')
    );
  }
  const unidades = listaDeUnidades(estado);
  for (const unidade of unidades) {
    const principais = (unidade.telefones ?? []).filter((telefone) => telefone?.principal === true);
    if (principais.length > 1) {
      estado.erros.push(
        erroColeta(ARQUIVO_UNIDADES, 'telefones', unidade.slug, 'no maximo um telefone pode ser principal')
      );
    }
    if (unidade.email && !REGEX_EMAIL.test(unidade.email)) {
      estado.erros.push(erroColeta('unidades.json', 'email', unidade.slug, 'e-mail invalido'));
    }
  }
  const matriz = unidades.find((unidade) => unidade?.matriz === true);
  const principalMatriz = (matriz?.telefones ?? []).find((telefone) => telefone?.principal === true);
  const telefoneInstitucional = site.contatoInstitucional?.telefoneE164;
  if (telefoneInstitucional && !/^\+55\d{10,11}$/.test(telefoneInstitucional)) {
    estado.erros.push(
      erroColeta('site.json', 'contatoInstitucional.telefoneE164', 'site', 'telefone deve estar em E.164')
    );
  }
  if (telefoneInstitucional && principalMatriz?.e164 && telefoneInstitucional !== principalMatriz.e164) {
    estado.erros.push(
      erroColeta(
        'site.json',
        'contatoInstitucional.telefoneE164',
        'site',
        'deve ser identico ao telefone principal da matriz'
      )
    );
  }

  const exemplos = estado.exemplosTelefones;
  const errosDados = validarDados(candidato, { exemplos: { telefones: [...exemplos].map((e164) => ({ e164 })) } });
  for (const erro of errosDados) {
    let detalhe = erro.detalhe;
    if (String(detalhe).includes('exemplo do levantamento')) {
      detalhe = `${detalhe}. Remova manualmente o exemplo correspondente de dados/exemplos-briefing.json apos registrar a confirmacao e reimporte; o importador nao altera esse arquivo.`;
    }
    estado.erros.push({
      codigo: erro.codigo,
      arquivo: erro.arquivo,
      campo: erro.campo,
      entidade: erro.entidade,
      detalhe,
      linha: null
    });
  }
}

export function escaparMarkdown(valor) {
  return String(valor ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/`/g, '\\`')
    .replace(/\r\n|\r|\n/g, '<br>')
    .replace(REGEX_CONTROLE_GLOBAL, '�');
}

function derivadosDaLinha(estado, linha) {
  const candidato = estado.candidato;
  if (!candidato) {
    return null;
  }
  if (linha.tipo === 'unidade') {
    const unidade = candidato.unidades?.unidades?.find((item) => item.slug === linha.entidade);
    if (!unidade) {
      return null;
    }
    return {
      status: unidade.status,
      'validacao.status': unidade.validacao?.status ?? null,
      'validacao.confirmadoPor': unidade.validacao?.confirmadoPor ?? null,
      'validacao.data': unidade.validacao?.data ?? null,
      'validacao.fontes': unidade.validacao?.fontes ?? [],
      atualizadoEm: unidade.atualizadoEm ?? null
    };
  }
  if (linha.tipo === 'site') {
    return {
      'responsavelTecnico.status': candidato.site?.responsavelTecnico?.status ?? null
    };
  }
  if (linha.tipo === 'convenio') {
    const convenio = candidato.convenios?.convenios?.find((item) => item.id === linha.entidade);
    return {
      aviso: convenio?.aviso ?? null,
      'convenios.atualizadoEm': candidato.convenios?.atualizadoEm ?? null
    };
  }
  if (linha.tipo === 'preparo') {
    const preparo = candidato.preparos?.preparos?.find((item) => item.id === linha.entidade);
    return {
      'revisao.status': preparo?.revisao?.status ?? null,
      'revisao.responsavel': preparo?.revisao?.responsavel ?? null,
      'revisao.crm': preparo?.revisao?.crm ?? null,
      'revisao.data': preparo?.revisao?.data ?? null,
      atualizadoEm: preparo?.atualizadoEm ?? null
    };
  }
  if (linha.tipo === 'texto') {
    const [pagina, localizador] = linha.entidade.split('/');
    const blocos = candidato.paginas?.paginas?.[pagina]?.blocos ?? [];
    const bloco = localizador?.startsWith('#')
      ? blocos[Number(localizador.slice(1))]
      : blocos.find((item) => item.id === localizador);
    return {
      status: bloco?.status ?? null,
      'paginas.atualizadoEm': candidato.paginas?.atualizadoEm ?? null
    };
  }
  return null;
}

function resumirDerivados(derivados) {
  if (!derivados) {
    return '';
  }
  return Object.entries(derivados)
    .map(([campo, valor]) => `${campo}=${Array.isArray(valor) ? valor.join('|') : valor ?? 'null'}`)
    .join('; ');
}

function gerarLogImportacao(estado, { resultado, baseDadosEm, baseDadosEmAtual, modeloVersao }) {
  const processadas = [...estado.linhasImportadas].sort(
    (a, b) => compararTexto(a.arquivo, b.arquivo) || a.linha - b.linha
  );
  const linhasImportadas =
    resultado === 'importado'
      ? processadas.map((linha) => ({ ...linha, derivados: derivadosDaLinha(estado, linha) }))
      : [];
  const linhasIgnoradas = [...estado.linhasIgnoradas].sort(
    (a, b) => compararTexto(a.arquivo, b.arquivo) || a.linha - b.linha
  );
  const sobrescritas = [...estado.sobrescritas].sort(
    (a, b) =>
      compararTexto(a.arquivo, b.arquivo) ||
      compararTexto(a.entidade, b.entidade) ||
      compararTexto(a.campo, b.campo)
  );
  const confirmacoes = [...estado.confirmacoes].sort(
    (a, b) => compararTexto(a.arquivo, b.arquivo) || a.linha - b.linha
  );
  const tokens = [...estado.tokens].sort(
    (a, b) =>
      compararTexto(a.arquivo, b.arquivo) ||
      compararTexto(a.entidade, b.entidade) ||
      compararTexto(a.campo, b.campo)
  );
  const erros = ordenarErrosColeta(estado.erros);
  const relacoes = [...estado.relacoes].sort(
    (a, b) =>
      compararTexto(a.entidade, b.entidade) ||
      compararTexto(a.convenio, b.convenio) ||
      compararTexto(a.data ?? '', b.data ?? '')
  );
  const promocoesPendentes = [];
  if (resultado === 'importado' && estado.candidato) {
    for (const linha of processadas) {
      if (linha.tipo === 'unidade') {
        const unidade = estado.candidato.unidades?.unidades?.find((item) => item.slug === linha.entidade);
        if (unidade && (unidade.status !== 'ativo' || unidade.validacao?.status !== 'confirmado')) {
          promocoesPendentes.push(`unidade ${linha.entidade}: continua a-confirmar/pendente`);
        }
      } else if (linha.tipo === 'preparo') {
        const preparo = estado.candidato.preparos?.preparos?.find((item) => item.id === linha.entidade);
        if (preparo && preparo.revisao?.status !== 'aprovado') {
          promocoesPendentes.push(`preparo ${linha.entidade}: revisao pendente`);
        }
      } else if (linha.tipo === 'texto') {
        const [pagina, localizador] = linha.entidade.split('/');
        const blocos = estado.candidato.paginas?.paginas?.[pagina]?.blocos ?? [];
        const bloco = localizador?.startsWith('#')
          ? blocos[Number(localizador.slice(1))]
          : blocos.find((item) => item.id === localizador);
        if (bloco && bloco.status !== 'aprovado') {
          promocoesPendentes.push(`bloco ${linha.entidade}: pendente`);
        }
      } else if (linha.tipo === 'site') {
        if (estado.candidato.site?.responsavelTecnico?.status !== 'confirmado') {
          promocoesPendentes.push('site: responsavel tecnico/contato permanecem pendentes');
        }
      }
    }
  }
  promocoesPendentes.sort(compararTexto);

  const json = {
    modeloVersao,
    baseDadosEm,
    baseDadosEmAtual,
    resultado,
    nadaFoiGravado: resultado !== 'importado',
    arquivosLidos: [...estado.arquivosLidos].sort(compararTexto),
    resumo: {
      linhasImportadas: linhasImportadas.length,
      linhasProcessadas: processadas.length,
      linhasIgnoradas: linhasIgnoradas.length,
      erros: erros.length,
      sobrescritas: sobrescritas.length
    },
    linhasImportadas,
    linhasProcessadas: processadas,
    linhasIgnoradas,
    camposIgnorados: {
      sentinela: processadas.reduce((total, linha) => total + linha.camposSentinela.length, 0),
      vazio: processadas.reduce((total, linha) => total + linha.camposVazios, 0)
    },
    tokens,
    sobrescritas,
    confirmacoes,
    relacoes,
    erros,
    promocoesPendentes
  };

  const md = [];
  md.push('# Importação do kit de coleta');
  md.push('');
  md.push(`- Modelo: \`${escaparMarkdown(modeloVersao)}\``);
  md.push(`- Data-base do kit: \`${escaparMarkdown(baseDadosEm || 'nao informada')}\``);
  md.push(`- Data-base atual dos dados: \`${escaparMarkdown(baseDadosEmAtual || 'nao informada')}\``);
  md.push(`- Resultado: **${escaparMarkdown(resultado)}**`);
  md.push(`- Linhas importadas: ${linhasImportadas.length}`);
  md.push(`- Linhas processadas: ${processadas.length}`);
  md.push(`- Linhas ignoradas: ${linhasIgnoradas.length}`);
  md.push(`- Erros: ${erros.length}`);
  md.push('');
  md.push('## Arquivos lidos');
  md.push('');
  if (json.arquivosLidos.length === 0) {
    md.push('Nenhum arquivo lido.');
  } else {
    for (const arquivo of json.arquivosLidos) {
      md.push(`- ${escaparMarkdown(arquivo)}`);
    }
  }
  md.push('');
  md.push('## Linhas importadas');
  md.push('');
  if (linhasImportadas.length === 0) {
    md.push(
      resultado === 'importado'
        ? 'Nenhuma linha importada.'
        : 'Nenhuma linha importada: nada foi gravado em `dados/`.'
    );
  } else {
    md.push('| Arquivo | Linha | Entidade | Campos | Derivados | Observação |');
    md.push('|---|---|---|---|---|---|');
    for (const linha of linhasImportadas) {
      md.push(
        `| ${escaparMarkdown(linha.arquivo)} | ${linha.linha} | ${escaparMarkdown(linha.entidade)} | ${escaparMarkdown(linha.campos.join(', '))} | ${escaparMarkdown(resumirDerivados(linha.derivados))} | ${escaparMarkdown(linha.observacao ?? '')} |`
      );
    }
  }
  if (resultado !== 'importado') {
    md.push('');
    md.push('## Linhas processadas (não gravadas)');
    md.push('');
    if (processadas.length === 0) {
      md.push('Nenhuma linha processada.');
    } else {
      md.push('| Arquivo | Linha | Entidade | Campos | Observação |');
      md.push('|---|---|---|---|---|');
      for (const linha of processadas) {
        md.push(
          `| ${escaparMarkdown(linha.arquivo)} | ${linha.linha} | ${escaparMarkdown(linha.entidade)} | ${escaparMarkdown(linha.campos.join(', '))} | ${escaparMarkdown(linha.observacao ?? '')} |`
        );
      }
    }
  }
  md.push('');
  md.push('## Linhas ignoradas');
  md.push('');
  if (linhasIgnoradas.length === 0) {
    md.push('Nenhuma linha ignorada.');
  } else {
    md.push('| Arquivo | Linha | Entidade | Motivo | Observação |');
    md.push('|---|---|---|---|---|');
    for (const linha of linhasIgnoradas) {
      md.push(
        `| ${escaparMarkdown(linha.arquivo)} | ${linha.linha} | ${escaparMarkdown(linha.entidade)} | ${escaparMarkdown(linha.motivo)} | ${escaparMarkdown(linha.observacao ?? '')} |`
      );
    }
  }
  md.push('');
  md.push('## Campos ignorados');
  md.push('');
  md.push(`- Células com sentinela: ${json.camposIgnorados.sentinela}`);
  md.push(`- Células vazias: ${json.camposIgnorados.vazio}`);
  md.push('');
  md.push('## Tokens');
  md.push('');
  if (tokens.length === 0) {
    md.push('Nenhum token informado.');
  } else {
    md.push('| Arquivo | Entidade | Campo | Token |');
    md.push('|---|---|---|---|');
    for (const token of tokens) {
      md.push(
        `| ${escaparMarkdown(token.arquivo)} | ${escaparMarkdown(token.entidade)} | ${escaparMarkdown(token.campo)} | ${escaparMarkdown(token.token)} |`
      );
    }
  }
  md.push('');
  md.push('## Sobrescritas');
  md.push('');
  if (sobrescritas.length === 0) {
    md.push('Nenhuma sobrescrita.');
  } else {
    md.push('| Arquivo | Entidade | Campo | Valor submetido |');
    md.push('|---|---|---|---|');
    for (const item of sobrescritas) {
      md.push(
        `| ${escaparMarkdown(item.arquivo)} | ${escaparMarkdown(item.entidade)} | ${escaparMarkdown(item.campo)} | ${escaparMarkdown(item.valor)} |`
      );
    }
  }
  md.push('');
  md.push('## Confirmações');
  md.push('');
  if (confirmacoes.length === 0) {
    md.push('Nenhuma confirmação.');
  } else {
    md.push('| Arquivo | Linha | Entidade | Resposta | Quem | Como | Fonte | Data |');
    md.push('|---|---|---|---|---|---|---|---|');
    for (const item of confirmacoes) {
      md.push(
        `| ${escaparMarkdown(item.arquivo)} | ${item.linha} | ${escaparMarkdown(item.entidade)} | ${escaparMarkdown(item.confirmacao)} | ${escaparMarkdown(item.confirmadoPor)} | ${escaparMarkdown(item.comoConfirmou)} | ${escaparMarkdown(item.fonte)} | ${escaparMarkdown(item.data)} |`
      );
    }
  }
  md.push('');
  md.push('## Vínculos por convênio');
  md.push('');
  if (relacoes.length === 0) {
    md.push('Nenhum vínculo novo por convênio.');
  } else {
    md.push('| Arquivo | Unidade | Convênio | Data da confirmação |');
    md.push('|---|---|---|---|');
    for (const item of relacoes) {
      md.push(
        `| ${escaparMarkdown(item.arquivo)} | ${escaparMarkdown(item.entidade)} | ${escaparMarkdown(item.convenio)} | ${escaparMarkdown(item.data)} |`
      );
    }
  }
  md.push('');
  md.push('## Erros');
  md.push('');
  if (erros.length === 0) {
    md.push('Nenhum erro.');
  } else {
    for (const erro of erros) {
      md.push(
        `- \`${escaparMarkdown(erro.codigo)}\` — ${escaparMarkdown(erro.detalhe)}${erro.linha ? ` (linha ${erro.linha})` : ''}`
      );
    }
  }
  md.push('');
  md.push('## Promoções manuais pendentes');
  md.push('');
  if (promocoesPendentes.length === 0) {
    md.push('Nenhuma promoção pendente registrada.');
  } else {
    for (const item of promocoesPendentes) {
      md.push(`- ${escaparMarkdown(item)}`);
    }
  }
  md.push('');
  if (resultado !== 'importado') {
    md.push('> Nada foi gravado em `dados/`. Corrija os erros e rode o importador de novo.');
    md.push('');
  }
  md.push('> O log não é fonte de verdade; `dados/*.json` continua sendo. A promoção de status é manual.');
  md.push('');

  return { json, markdown: md.join('\n') };
}

async function gravarLogImportacao(dirPasta, log) {
  await mkdir(dirPasta, { recursive: true });
  await writeFile(path.join(dirPasta, 'importacao.json'), `${JSON.stringify(log.json, null, 2)}\n`, 'utf8');
  await writeFile(path.join(dirPasta, 'importacao.md'), log.markdown, 'utf8');
}

function decodificarCsv(buffer, arquivo, estado) {
  if (
    buffer.length >= 2 &&
    ((buffer[0] === 0xff && buffer[1] === 0xfe) || (buffer[0] === 0xfe && buffer[1] === 0xff))
  ) {
    estado.erros.push(
      erroColeta(arquivo, 'csv', 'encoding', 'arquivo UTF-16; salve como CSV UTF-8 com separador ";"')
    );
    return null;
  }
  const texto = buffer.toString('utf8');
  if (texto.includes('\uFFFD') || texto.includes('\u0000')) {
    estado.erros.push(
      erroColeta(arquivo, 'csv', 'encoding', 'texto nao esta em UTF-8; salve como CSV UTF-8 (BOM opcional)')
    );
    return null;
  }
  const primeiraLinha = texto.split(/\r\n|\n|\r/)[0] ?? '';
  if (!primeiraLinha.includes(';') && primeiraLinha.includes(',')) {
    estado.erros.push(
      erroColeta(arquivo, 'csv', 'separador', 'separador esperado ";"; reabra e salve com ponto e virgula')
    );
    return null;
  }
  return texto;
}

function validarCabecalho(estado, chave, arquivo, cabecalho) {
  const esperado = COLUNAS[chave];
  const faltantes = esperado.filter((coluna) => !cabecalho.includes(coluna));
  const desconhecidas = cabecalho.filter((coluna) => !esperado.includes(coluna));
  const duplicadas = cabecalho.filter((coluna, indice) => cabecalho.indexOf(coluna) !== indice);
  if (faltantes.length === 0 && desconhecidas.length === 0 && duplicadas.length === 0) {
    return true;
  }
  const detalhes = [];
  if (faltantes.length > 0) {
    detalhes.push(`faltantes: ${faltantes.join(', ')}`);
  }
  if (desconhecidas.length > 0) {
    detalhes.push(`desconhecidas: ${desconhecidas.join(', ')}`);
  }
  if (duplicadas.length > 0) {
    detalhes.push(`duplicadas: ${[...new Set(duplicadas)].join(', ')}`);
  }
  estado.erros.push(erroColeta(arquivo, 'colunas', chave, detalhes.join('; ')));
  return false;
}

/**
 * Importa o kit de `pasta` para `dados/` da raiz, validando tudo antes de gravar.
 * Em qualquer erro, nenhum JSON de `dados/` e escrito; apenas o log e atualizado.
 */
export async function importarColeta({ raiz, pasta = 'relatorios/coleta', sobrescrever = false } = {}) {
  const dirPasta = path.isAbsolute(pasta) ? pasta : path.resolve(raiz, pasta);
  const estado = {
    candidato: null,
    erros: [],
    avisos: [],
    sobrescrever,
    linhasImportadas: [],
    linhasIgnoradas: [],
    confirmacoes: [],
    sobrescritas: [],
    tokens: [],
    datas: { unidades: [], convenios: [], preparos: [], paginas: [] },
    arquivosLidos: [],
    alterados: new Set(),
    unidadesCsv: new Set(),
    preparosCsv: new Set(),
    textosCsv: new Set(),
    idsConvenios: new Set(),
    idsConvenioCsv: new Set(),
    idsServicos: new Set(),
    conveniosPorUnidade: new Map(),
    confirmacoesPorUnidade: new Map(),
    relacoes: [],
    exemplosTelefones: new Set()
  };
  let dados = null;
  let exemplos = { telefones: [], enderecos: [] };
  let baseDadosEm = '';
  let baseDadosEmKit = '';
  let modeloVersao = MODELO_VERSAO;
  let resultado = 'nada foi gravado';

  try {
    dados = await carregarDados(raiz);
    exemplos = await carregarExemplosBriefing(raiz);
  } catch (erro) {
    estado.erros.push({
      codigo: 'coleta:dados:raiz',
      arquivo: 'dados',
      campo: 'json',
      entidade: 'raiz',
      detalhe: erro.message,
      linha: null
    });
    const log = gerarLogImportacao(estado, { resultado, baseDadosEm: baseDadosEmKit || baseDadosEm, baseDadosEmAtual: baseDadosEm, modeloVersao });
    await gravarLogImportacao(dirPasta, log);
    return { ok: false, erros: ordenarErrosColeta(estado.erros), avisos: [], arquivosGravados: [], log };
  }

  baseDadosEm = dados.site?.atualizadoEm ?? '';
  modeloVersao = MODELO_VERSAO;
  estado.exemplosTelefones = new Set(
    (exemplos?.telefones ?? []).map((telefone) => telefone?.e164).filter(Boolean)
  );

  const errosAtuais = validarDados(dados, { exemplos });
  if (errosAtuais.length > 0) {
    for (const erro of errosAtuais) {
      estado.erros.push({ ...erro, linha: null });
    }
    const log = gerarLogImportacao(estado, { resultado, baseDadosEm: baseDadosEmKit || baseDadosEm, baseDadosEmAtual: baseDadosEm, modeloVersao });
    await gravarLogImportacao(dirPasta, log);
    return { ok: false, erros: ordenarErrosColeta(estado.erros), avisos: [], arquivosGravados: [], log };
  }

  estado.candidato = structuredClone(dados);
  estado.idsConvenios = new Set((dados.convenios?.convenios ?? []).map((convenio) => convenio.id));
  estado.idsServicos = new Set((dados.servicos?.servicos ?? []).map((servico) => servico.id));

  const arquivos = new Map();
  for (const item of ARQUIVOS_COLETA) {
    const caminho = path.join(dirPasta, item.arquivo);
    let buffer;
    try {
      buffer = await readFile(caminho);
    } catch {
      estado.erros.push({
        codigo: `coleta:arquivos:${item.arquivo}`,
        arquivo: item.arquivo,
        campo: 'arquivo',
        entidade: item.chave,
        detalhe: 'arquivo obrigatorio ausente na pasta do kit',
        linha: null
      });
      continue;
    }
    const texto = decodificarCsv(buffer, item.arquivo, estado);
    if (texto === null) {
      continue;
    }
    if (buffer.length > LIMITE_ARQUIVO_BYTES) {
      estado.erros.push(
        erroColeta(
          item.arquivo,
          'csv',
          'limite',
          `arquivo excede o limite de ${LIMITE_ARQUIVO_BYTES} bytes`
        )
      );
      continue;
    }
    let lido;
    try {
      lido = lerCsv(texto);
    } catch (erro) {
      if (erro instanceof ErroCsv) {
        estado.erros.push(
          erroColeta(item.arquivo, 'csv', `linha-${erro.linha ?? 1}`, erro.motivo, erro.linha)
        );
        continue;
      }
      throw erro;
    }
    if (lido.cabecalho.length > LIMITE_CAMPOS) {
      estado.erros.push(
        erroColeta(item.arquivo, 'colunas', item.chave, `cabecalho excede ${LIMITE_CAMPOS} campos`)
      );
      continue;
    }
    if (!validarCabecalho(estado, item.chave, item.arquivo, lido.cabecalho)) {
      continue;
    }
    if (lido.linhas.length > LIMITE_LINHAS) {
      estado.erros.push(
        erroColeta(item.arquivo, 'linhas', item.chave, `arquivo excede ${LIMITE_LINHAS} linhas de dados`)
      );
      continue;
    }
    const linhas = lido.linhas.map((valores, indice) => {
      const mapa = {};
      lido.cabecalho.forEach((coluna, posicao) => {
        mapa[coluna] = valores[posicao] ?? '';
      });
      return { mapa, numero: lido.numeros?.[indice] ?? indice + 2 };
    });
    if (linhas.length > 0) {
      const versoes = new Set(linhas.map((linha) => String(linha.mapa.modelo_versao ?? '').trim()));
      if (versoes.size !== 1 || !versoes.has(MODELO_VERSAO)) {
        estado.erros.push(
          erroColeta(item.arquivo, 'modelo_versao', item.chave, `use a versao ${MODELO_VERSAO}`)
        );
        continue;
      }
      const tipos = new Set(linhas.map((linha) => String(linha.mapa.tipo_registro ?? '').trim()));
      if (tipos.size !== 1 || !tipos.has(TIPO_REGISTRO[item.chave])) {
        estado.erros.push(
          erroColeta(item.arquivo, 'tipo_registro', item.chave, `use o tipo ${TIPO_REGISTRO[item.chave]}`)
        );
        continue;
      }
      const bases = new Set(linhas.map((linha) => String(linha.mapa.base_dados_em ?? '').trim()));
      if (bases.size !== 1) {
        estado.erros.push(erroColeta(item.arquivo, 'base_dados_em', item.chave, 'data-base divergente entre linhas'));
        continue;
      }
      const base = [...bases][0];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) {
        estado.erros.push(erroColeta(item.arquivo, 'base_dados_em', item.chave, 'data-base deve usar AAAA-MM-DD'));
        continue;
      }
      if (base !== baseDadosEm) {
        estado.avisos.push(`${item.arquivo}: base_dados_em ${base} difere dos dados atuais (${baseDadosEm})`);
      }
      if (!baseDadosEmKit) {
        baseDadosEmKit = base;
      } else if (base !== baseDadosEmKit) {
        estado.erros.push(
          erroColeta(
            item.arquivo,
            'base_dados_em',
            item.chave,
            `base ${base} difere da base dos demais arquivos (${baseDadosEmKit}); o kit precisa de uma unica base`
          )
        );
      }
    }
    if (item.chave === 'site' && linhas.length !== 1) {
      estado.erros.push(
        erroColeta(item.arquivo, 'linhas', 'site', 'site.csv exige exatamente uma linha de dados')
      );
      continue;
    }
    arquivos.set(item.chave, { ...item, linhas });
    estado.arquivosLidos.push(item.arquivo);
  }

  if (baseDadosEmKit && baseDadosEm && baseDadosEmKit < baseDadosEm && !estado.sobrescrever) {
    estado.erros.push({
      codigo: 'coleta:base_dados_em:kit',
      arquivo: 'coleta',
      campo: 'base_dados_em',
      entidade: 'kit',
      detalhe: `base do kit (${baseDadosEmKit}) anterior a base atual de dados (${baseDadosEm}); gere o kit de novo ou use --sobrescrever de forma auditada`,
      linha: null
    });
  }

  if (estado.erros.length > 0) {
    const log = gerarLogImportacao(estado, { resultado, baseDadosEm: baseDadosEmKit || baseDadosEm, baseDadosEmAtual: baseDadosEm, modeloVersao });
    await gravarLogImportacao(dirPasta, log);
    return { ok: false, erros: ordenarErrosColeta(estado.erros), avisos: estado.avisos, arquivosGravados: [], log };
  }

  if (arquivos.has('site')) {
    for (const linha of arquivos.get('site').linhas) {
      processarSite(estado, arquivos.get('site'), linha);
    }
  }
  if (arquivos.has('convenios')) {
    for (const linha of arquivos.get('convenios').linhas) {
      processarConvenio(estado, arquivos.get('convenios'), linha);
    }
  }
  if (arquivos.has('unidades')) {
    for (const linha of arquivos.get('unidades').linhas) {
      processarUnidade(estado, arquivos.get('unidades'), linha);
    }
  }
  if (arquivos.has('preparos')) {
    for (const linha of arquivos.get('preparos').linhas) {
      processarPreparo(estado, arquivos.get('preparos'), linha);
    }
  }
  if (arquivos.has('textos')) {
    for (const linha of arquivos.get('textos').linhas) {
      processarTexto(estado, arquivos.get('textos'), linha);
    }
  }
  aplicarRelacoesConvenio(estado);

  if (estado.datas.unidades.length > 0) {
    estado.candidato.unidades.atualizadoEm =
      maiorData(estado.candidato.unidades.atualizadoEm, ...estado.datas.unidades) ??
      estado.candidato.unidades.atualizadoEm;
    estado.alterados.add('unidades');
  }
  if (estado.datas.convenios.length > 0) {
    estado.candidato.convenios.atualizadoEm =
      maiorData(estado.candidato.convenios.atualizadoEm, ...estado.datas.convenios) ??
      estado.candidato.convenios.atualizadoEm;
    estado.alterados.add('convenios');
  }
  if (estado.datas.preparos.length > 0) {
    estado.candidato.preparos.atualizadoEm =
      maiorData(estado.candidato.preparos.atualizadoEm, ...estado.datas.preparos) ??
      estado.candidato.preparos.atualizadoEm;
    estado.alterados.add('preparos');
  }
  if (estado.datas.paginas.length > 0) {
    estado.candidato.paginas.atualizadoEm =
      maiorData(estado.candidato.paginas.atualizadoEm, ...estado.datas.paginas) ??
      estado.candidato.paginas.atualizadoEm;
    estado.alterados.add('paginas');
  }

  validarCruzado(estado);

  if (estado.erros.length > 0) {
    const log = gerarLogImportacao(estado, { resultado, baseDadosEm: baseDadosEmKit || baseDadosEm, baseDadosEmAtual: baseDadosEm, modeloVersao });
    await gravarLogImportacao(dirPasta, log);
    return { ok: false, erros: ordenarErrosColeta(estado.erros), avisos: estado.avisos, arquivosGravados: [], log };
  }

  const arquivosGravados = [];
  const pendentes = [];
  await mkdir(dirPasta, { recursive: true });
  try {
    for (const [chave, arquivo] of [
      ['site', 'site.json'],
      ['unidades', 'unidades.json'],
      ['convenios', 'convenios.json'],
      ['preparos', 'preparos.json'],
      ['paginas', 'paginas.json']
    ]) {
      if (!estado.alterados.has(chave)) {
        continue;
      }
      const destino = path.join(raiz, 'dados', arquivo);
      const conteudo = `${JSON.stringify(estado.candidato[chave], null, 2)}\n`;
      let atualTexto = null;
      try {
        atualTexto = await readFile(destino, 'utf8');
      } catch {
        atualTexto = null;
      }
      if (atualTexto === conteudo) {
        continue;
      }
      const temporario = path.join(dirPasta, `gravacao-${arquivo}.tmp`);
      await writeFile(temporario, conteudo, 'utf8');
      pendentes.push({ temporario, destino, arquivo });
    }
    for (const item of pendentes) {
      await rename(item.temporario, item.destino);
      arquivosGravados.push(item.arquivo);
    }
  } finally {
    for (const item of pendentes) {
      await rm(item.temporario, { force: true }).catch(() => {});
    }
  }

  resultado = 'importado';
  const log = gerarLogImportacao(estado, { resultado, baseDadosEm: baseDadosEmKit || baseDadosEm, baseDadosEmAtual: baseDadosEm, modeloVersao });
  await gravarLogImportacao(dirPasta, log);
  return {
    ok: true,
    erros: [],
    avisos: estado.avisos,
    arquivosGravados,
    log
  };
}

