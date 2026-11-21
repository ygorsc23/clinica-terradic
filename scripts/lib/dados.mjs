import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

export const URL_BASE_PERMITIDA = 'https://terradic.com.br';
export const PORTAL_EXAMES_PERMITIDO = 'https://entregadeexames.com.br/';

export const STATUS_UNIDADE = ['ativo', 'a-confirmar', 'rascunho', 'inativo'];
export const STATUS_VALIDACAO = ['pendente', 'parcial', 'confirmado'];
export const STATUS_SERVICO = ['pendente', 'aprovado', 'desatualizado'];
export const STATUS_REVISAO = ['pendente', 'aprovado', 'desatualizado'];
export const DIAS_SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
export const NOMES_DIAS = {
  seg: 'Segunda',
  ter: 'Terça',
  qua: 'Quarta',
  qui: 'Quinta',
  sex: 'Sexta',
  sab: 'Sábado',
  dom: 'Domingo'
};

const REGEX_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const REGEX_E164 = /^\+55\d{10,11}$/;
const REGEX_CEP = /^\d{8}$/;
const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_CNPJ = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;

export const TIPOS_BLOCO = [
  'titulo',
  'subtitulo',
  'paragrafo',
  'lista',
  'destaque',
  'aviso',
  'citacao'
];

async function existe(caminho) {
  try {
    await access(caminho);
    return true;
  } catch {
    return false;
  }
}

export async function carregarJson(caminho) {
  const texto = await readFile(caminho, 'utf8');
  try {
    return JSON.parse(texto);
  } catch (erro) {
    throw new Error(`${path.basename(caminho)}: JSON invalido — ${erro.message}`);
  }
}

/**
 * Le os dados de `dados/`.
 * `dados/exemplos-briefing.json` NAO e lido aqui: ele so pode ser consultado pelo
 * validador (para recusar valores identicos aos exemplos nao validados).
 * Em `--rascunho`, as unidades podem ser substituidas por `dados-teste/unidades.exemplo.json`.
 */
export async function carregarDados(raiz, { rascunho = false, avisar = () => {} } = {}) {
  const dir = path.join(raiz, 'dados');
  const [site, unidadesBase, servicos, convenios, preparos, paginas] = await Promise.all([
    carregarJson(path.join(dir, 'site.json')),
    carregarJson(path.join(dir, 'unidades.json')),
    carregarJson(path.join(dir, 'servicos.json')),
    carregarJson(path.join(dir, 'convenios.json')),
    carregarJson(path.join(dir, 'preparos.json')),
    carregarJson(path.join(dir, 'paginas.json'))
  ]);

  let unidades = unidadesBase;

  if (rascunho) {
    const caminhoTeste = path.join(raiz, 'dados-teste', 'unidades.exemplo.json');
    if (await existe(caminhoTeste)) {
      unidades = await carregarJson(caminhoTeste);
      avisar('rascunho: unidades substituidas por dados-teste/unidades.exemplo.json (dados ficticios)');
    }
  }

  return { site, unidades, servicos, convenios, preparos, paginas };
}

export async function carregarExemplosBriefing(raiz) {
  const caminho = path.join(raiz, 'dados', 'exemplos-briefing.json');
  if (!(await existe(caminho))) {
    return { telefones: [], enderecos: [] };
  }
  return carregarJson(caminho);
}

export function telefoneValidado(telefone) {
  return telefone?.validado === true && REGEX_E164.test(String(telefone?.e164 ?? ''));
}

export function telefonesValidados(unidade) {
  return (unidade?.telefones ?? []).filter(telefoneValidado);
}

export function telefonesPrincipais(unidade) {
  return (unidade?.telefones ?? []).filter((telefone) => telefone?.principal === true);
}

export function telefonePrincipal(unidade) {
  const principais = telefonesPrincipais(unidade).filter(telefoneValidado);
  return principais.length === 1 ? principais[0] : null;
}

export function unidadeAtivaConfirmada(unidade) {
  const validacao = unidade?.validacao ?? {};
  return (
    unidade?.status === 'ativo' &&
    validacao.status === 'confirmado' &&
    Boolean(validacao.confirmadoPor) &&
    Boolean(validacao.data) &&
    Array.isArray(validacao.fontes) &&
    validacao.fontes.length > 0
  );
}

/**
 * Gate de publicacao de unidade: ativa, validacao confirmada com rastreabilidade
 * (quem, quando e fontes), ao menos um telefone marcado `validado: true` em E.164
 * e ao menos um servico aprovado entre os servicos da unidade.
 * O relatorio usa o mesmo predicado para C-01/C-03.
 */
export function unidadePublicavel(unidade, servicos = []) {
  return (
    unidadeAtivaConfirmada(unidade) &&
    telefonesValidados(unidade).length > 0 &&
    unidadeTemServicoAprovado(unidade, servicos)
  );
}

export function servicoAprovado(servico) {
  return servico?.status === 'aprovado';
}

export function unidadeTemServicoAprovado(unidade, servicos = []) {
  const idsAprovados = new Set((servicos ?? []).filter(servicoAprovado).map((servico) => servico.id));
  return (unidade?.servicos ?? []).some((id) => idsAprovados.has(id));
}

export function preparoAprovado(preparo) {
  return preparo?.revisao?.status === 'aprovado';
}

function erro(erros, arquivo, campo, entidade, detalhe) {
  erros.push({
    codigo: `${arquivo}:${campo}:${entidade}`,
    arquivo,
    campo,
    entidade,
    detalhe
  });
}

function exigir(erros, arquivo, campo, entidade, valor) {
  if (valor === null || valor === undefined || valor === '') {
    erro(erros, arquivo, campo, entidade, 'campo obrigatorio vazio');
    return false;
  }
  return true;
}

function validarData(erros, arquivo, campo, entidade, valor) {
  if (valor != null && !REGEX_DATA.test(String(valor))) {
    erro(erros, arquivo, campo, entidade, 'data deve estar no formato AAAA-MM-DD');
  }
}

function validarAtualizadoEm(erros, arquivo, dados, entidade = 'topo') {
  exigir(erros, arquivo, 'atualizadoEm', entidade, dados?.atualizadoEm);
  validarData(erros, arquivo, 'atualizadoEm', entidade, dados?.atualizadoEm);
}

function validarTelefone(erros, arquivo, campo, entidade, valor, exemplosTelefones) {
  if (valor == null) {
    return;
  }
  if (!REGEX_E164.test(String(valor))) {
    erro(erros, arquivo, campo, entidade, 'telefone deve estar em E.164 (+55DDNNNNNNNNN)');
    return;
  }
  if (exemplosTelefones.has(valor)) {
    erro(
      erros,
      arquivo,
      campo,
      entidade,
      'valor identico a exemplo do levantamento (dados/exemplos-briefing.json); confirme antes de publicar'
    );
  }
}

/**
 * Valida schema, formatos, refs e coerencia de publicacao.
 * Cada erro sai como `arquivo:campo:entidade`.
 */
export function validarDados(dados, { exemplos = null, rascunho = false } = {}) {
  const erros = [];
  const exemplosTelefones = new Set(
    (exemplos?.telefones ?? []).map((item) => item?.e164).filter(Boolean)
  );

  const site = dados.site ?? {};
  exigir(erros, 'site.json', 'marca.nome', 'site', site.marca?.nome);
  exigir(erros, 'site.json', 'marca.razaoSocial', 'site', site.marca?.razaoSocial);
  if (site.marca?.cnpj != null && !REGEX_CNPJ.test(String(site.marca.cnpj))) {
    erro(erros, 'site.json', 'marca.cnpj', 'site', 'CNPJ deve seguir o formato 00.000.000/0000-00');
  } else {
    exigir(erros, 'site.json', 'marca.cnpj', 'site', site.marca?.cnpj);
  }
  validarData(erros, 'site.json', 'atualizadoEm', 'site', site.atualizadoEm);
  exigir(erros, 'site.json', 'atualizadoEm', 'site', site.atualizadoEm);

  if (site.urlBase !== URL_BASE_PERMITIDA) {
    erro(
      erros,
      'site.json',
      'urlBase',
      'site',
      `deve ser exatamente "${URL_BASE_PERMITIDA}" (sem www e sem barra final)`
    );
  }
  if (site.portalExames?.url !== PORTAL_EXAMES_PERMITIDO) {
    erro(
      erros,
      'site.json',
      'portalExames.url',
      'site',
      `deve ser exatamente "${PORTAL_EXAMES_PERMITIDO}"`
    );
  }
  if (site.portalExames?.ambienteExterno !== true) {
    erro(erros, 'site.json', 'portalExames.ambienteExterno', 'site', 'deve ser true');
  }
  if (site.analytics !== null && site.analytics !== undefined) {
    erro(
      erros,
      'site.json',
      'analytics',
      'site',
      'deve ser null nesta fase (o site nao coleta dados nem mede audiencia)'
    );
  }
  const rt = site.responsavelTecnico ?? {};
  if (!['pendente', 'confirmado'].includes(rt.status)) {
    erro(erros, 'site.json', 'responsavelTecnico.status', 'site', 'use "pendente" ou "confirmado"');
  }
  if (rt.status === 'confirmado') {
    exigir(erros, 'site.json', 'responsavelTecnico.nome', 'site', rt.nome);
    exigir(erros, 'site.json', 'responsavelTecnico.crm', 'site', rt.crm);
    exigir(erros, 'site.json', 'responsavelTecnico.crmUf', 'site', rt.crmUf);
  }

  validarAtualizadoEm(erros, 'unidades.json', dados.unidades);
  validarAtualizadoEm(erros, 'servicos.json', dados.servicos);
  validarAtualizadoEm(erros, 'preparos.json', dados.preparos);
  validarAtualizadoEm(erros, 'paginas.json', dados.paginas);

  const convenios = dados.convenios?.convenios;
  const idsConvenios = new Set();
  if (!Array.isArray(convenios)) {
    erro(erros, 'convenios.json', 'convenios', 'site', 'deve ser uma lista');
  } else {
    if (convenios.length > 0) {
      exigir(erros, 'convenios.json', 'atualizadoEm', 'convenios', dados.convenios?.atualizadoEm);
      validarData(erros, 'convenios.json', 'atualizadoEm', 'convenios', dados.convenios?.atualizadoEm);
    }
    convenios.forEach((convenio, indice) => {
      const entidade = convenio?.id ?? `indice-${indice}`;
      exigir(erros, 'convenios.json', 'id', entidade, convenio?.id);
      exigir(erros, 'convenios.json', 'nome', entidade, convenio?.nome);
      if (convenio?.id) {
        if (idsConvenios.has(convenio.id)) {
          erro(erros, 'convenios.json', 'id', entidade, 'id duplicado');
        }
        idsConvenios.add(convenio.id);
      }
      if (convenio?.exibirLogo === true && convenio?.logoAutorizado !== true) {
        erro(
          erros,
          'convenios.json',
          'logoAutorizado',
          entidade,
          'logotipo de operadora exige autorizacao registrada'
        );
      }
    });
  }

  const preparosLista = dados.preparos?.preparos;
  const idsPreparos = new Set();
  const idsPreparosDisponiveis = new Set(
    (Array.isArray(preparosLista) ? preparosLista : [])
      .map((preparo) => preparo?.id)
      .filter(Boolean)
  );
  const servicosLista = dados.servicos?.servicos;
  const idsServicos = new Set();
  const slugsServicos = new Set();
  const slugsPreparos = new Set();

  if (!Array.isArray(servicosLista)) {
    erro(erros, 'servicos.json', 'servicos', 'site', 'deve ser uma lista');
  } else {
    servicosLista.forEach((servico, indice) => {
      const entidade = servico?.slug ?? servico?.id ?? `indice-${indice}`;
      exigir(erros, 'servicos.json', 'id', entidade, servico?.id);
      exigir(erros, 'servicos.json', 'slug', entidade, servico?.slug);
      exigir(erros, 'servicos.json', 'nome', entidade, servico?.nome);
      if (servico?.slug && !REGEX_SLUG.test(servico.slug)) {
        erro(erros, 'servicos.json', 'slug', entidade, 'slug deve usar apenas [a-z0-9-], sem acento');
      }
      if (servico?.slug) {
        if (slugsServicos.has(servico.slug)) {
          erro(erros, 'servicos.json', 'slug', entidade, 'slug duplicado');
        }
        slugsServicos.add(servico.slug);
      }
      if (servico?.id) {
        if (idsServicos.has(servico.id)) {
          erro(erros, 'servicos.json', 'id', entidade, 'id duplicado');
        }
        idsServicos.add(servico.id);
      }
      for (const ref of servico?.preparos ?? []) {
        if (!idsPreparosDisponiveis.has(ref)) {
          erro(erros, 'servicos.json', 'preparos', entidade, `referencia a preparo inexistente: ${ref}`);
        }
      }
      if (!STATUS_SERVICO.includes(servico?.status)) {
        erro(erros, 'servicos.json', 'status', entidade, `use um de: ${STATUS_SERVICO.join(', ')}`);
      }
      if (servico?.status === 'aprovado') {
        exigir(erros, 'servicos.json', 'resumo', entidade, servico?.resumo);
        if (!Array.isArray(servico?.descricao) || servico.descricao.length === 0) {
          erro(erros, 'servicos.json', 'descricao', entidade, 'servico aprovado exige descricao');
        }
      }
    });
  }

  if (!Array.isArray(preparosLista)) {
    erro(erros, 'preparos.json', 'preparos', 'site', 'deve ser uma lista');
  } else {
    preparosLista.forEach((preparo, indice) => {
      const entidade = preparo?.slug ?? preparo?.id ?? `indice-${indice}`;
      exigir(erros, 'preparos.json', 'id', entidade, preparo?.id);
      exigir(erros, 'preparos.json', 'slug', entidade, preparo?.slug);
      exigir(erros, 'preparos.json', 'exame', entidade, preparo?.exame);
      exigir(erros, 'preparos.json', 'servicoId', entidade, preparo?.servicoId);
      if (preparo?.slug && !REGEX_SLUG.test(preparo.slug)) {
        erro(erros, 'preparos.json', 'slug', entidade, 'slug deve usar apenas [a-z0-9-], sem acento');
      }
      if (preparo?.slug) {
        if (slugsPreparos.has(preparo.slug)) {
          erro(erros, 'preparos.json', 'slug', entidade, 'slug duplicado');
        }
        slugsPreparos.add(preparo.slug);
      }
      if (preparo?.id) {
        if (idsPreparos.has(preparo.id)) {
          erro(erros, 'preparos.json', 'id', entidade, 'id duplicado');
        }
        idsPreparos.add(preparo.id);
      }
      if (!STATUS_REVISAO.includes(preparo?.revisao?.status)) {
        erro(
          erros,
          'preparos.json',
          'revisao.status',
          entidade,
          `use um de: ${STATUS_REVISAO.join(', ')}`
        );
      }
      if (preparo?.servicoId && !idsServicos.has(preparo.servicoId)) {
        erro(erros, 'preparos.json', 'servicoId', entidade, 'referencia a servico inexistente');
      }
      if (preparo?.revisao?.status === 'aprovado') {
        exigir(erros, 'preparos.json', 'revisao.responsavel', entidade, preparo.revisao.responsavel);
        exigir(erros, 'preparos.json', 'revisao.crm', entidade, preparo.revisao.crm);
        if (preparo.revisao.data == null) {
          erro(
            erros,
            'preparos.json',
            'revisao.data',
            entidade,
            'preparo aprovado exige data de revisao'
          );
        } else {
          validarData(erros, 'preparos.json', 'revisao.data', entidade, preparo.revisao.data);
        }
      }
    });
  }

  const unidadesLista = dados.unidades?.unidades;
  const idsUnidades = new Set();
  const slugsUnidades = new Set();
  let totalMatriz = 0;

  if (!Array.isArray(unidadesLista) || unidadesLista.length === 0) {
    erro(erros, 'unidades.json', 'unidades', 'site', 'lista de unidades vazia');
  } else {
    unidadesLista.forEach((unidade, indice) => {
      const entidade = unidade?.slug ?? unidade?.id ?? `indice-${indice}`;
      exigir(erros, 'unidades.json', 'id', entidade, unidade?.id);
      exigir(erros, 'unidades.json', 'slug', entidade, unidade?.slug);
      exigir(erros, 'unidades.json', 'nomeExibicao', entidade, unidade?.nomeExibicao);
      exigir(erros, 'unidades.json', 'cidade', entidade, unidade?.cidade);
      exigir(erros, 'unidades.json', 'uf', entidade, unidade?.uf);

      if (unidade?.slug && !REGEX_SLUG.test(unidade.slug)) {
        erro(erros, 'unidades.json', 'slug', entidade, 'slug deve usar apenas [a-z0-9-], sem acento');
      }
      if (unidade?.id) {
        if (idsUnidades.has(unidade.id)) {
          erro(erros, 'unidades.json', 'id', entidade, 'id duplicado');
        }
        idsUnidades.add(unidade.id);
      }
      if (unidade?.slug) {
        if (slugsUnidades.has(unidade.slug)) {
          erro(erros, 'unidades.json', 'slug', entidade, 'slug duplicado');
        }
        slugsUnidades.add(unidade.slug);
      }
      if (!STATUS_UNIDADE.includes(unidade?.status)) {
        erro(erros, 'unidades.json', 'status', entidade, `use um de: ${STATUS_UNIDADE.join(', ')}`);
      }
      if (!STATUS_VALIDACAO.includes(unidade?.validacao?.status)) {
        erro(
          erros,
          'unidades.json',
          'validacao.status',
          entidade,
          `use um de: ${STATUS_VALIDACAO.join(', ')}`
        );
      }
        if (unidade?.matriz === true) {
          totalMatriz += 1;
          if (!unidade?.cnpjFilial) {
            erro(erros, 'unidades.json', 'cnpjFilial', entidade, 'matriz exige CNPJ registrado');
          }
          const telefonesMatriz = Array.isArray(unidade?.telefones) ? unidade.telefones : [];
          if (telefonesMatriz.length > 0) {
            const principais = telefonesMatriz.filter((telefone) => telefone?.principal === true);
            if (principais.length !== 1) {
              erro(
                erros,
                'unidades.json',
                'telefones',
                entidade,
                'matriz exige exatamente um telefone com principal: true'
              );
            } else if (!telefoneValidado(principais[0])) {
              erro(
                erros,
                'unidades.json',
                'telefones',
                entidade,
                'o telefone principal da matriz precisa estar validado em E.164'
              );
            }
          }
        }
      validarData(erros, 'unidades.json', 'atualizadoEm', entidade, unidade?.atualizadoEm);

      const cep = unidade?.endereco?.cep;
      if (cep != null && !REGEX_CEP.test(String(cep))) {
        erro(erros, 'unidades.json', 'endereco.cep', entidade, 'CEP deve ter 8 digitos');
      }

      const lat = unidade?.geo?.lat;
      const lng = unidade?.geo?.lng;
      if ((lat == null) !== (lng == null)) {
        erro(
          erros,
          'unidades.json',
          'geo',
          entidade,
          'latitude e longitude devem estar ambas preenchidas ou ambas nulas'
        );
      }
      if (lat != null && (typeof lat !== 'number' || lat < -90 || lat > 90)) {
        erro(erros, 'unidades.json', 'geo.lat', entidade, 'latitude fora do intervalo valido');
      }
      if (lng != null && (typeof lng !== 'number' || lng < -180 || lng > 180)) {
        erro(erros, 'unidades.json', 'geo.lng', entidade, 'longitude fora do intervalo valido');
      }
      if (
        typeof lat === 'number' &&
        typeof lng === 'number' &&
        !['exata', 'aproximada'].includes(unidade?.geo?.precisao)
      ) {
        erro(
          erros,
          'unidades.json',
          'geo.precisao',
          entidade,
          'geo com coordenadas exige precisao "exata" ou "aproximada"'
        );
      }

      const telefones = Array.isArray(unidade?.telefones) ? unidade.telefones : [];
      telefones.forEach((telefone, posicao) => {
        validarTelefone(
          erros,
          'unidades.json',
          `telefones[${posicao}].e164`,
          entidade,
          telefone?.e164,
          exemplosTelefones
        );
        if (typeof telefone?.validado !== 'boolean') {
          erro(
            erros,
            'unidades.json',
            `telefones[${posicao}].validado`,
            entidade,
            'validado deve ser booleano (true ou false); ausencia nao equivale a confirmado'
          );
        }
        if (telefone?.principal != null && typeof telefone.principal !== 'boolean') {
          erro(
            erros,
            'unidades.json',
            `telefones[${posicao}].principal`,
            entidade,
            'principal deve ser booleano (true ou false)'
          );
        }
        if (telefone?.validado === true && !telefone?.e164) {
          erro(
            erros,
            'unidades.json',
            `telefones[${posicao}].e164`,
            entidade,
            'telefone marcado como validado sem numero E.164'
          );
        }
      });
      if (unidade?.whatsapp && typeof unidade.whatsapp.validado !== 'boolean') {
        erro(
          erros,
          'unidades.json',
          'whatsapp.validado',
          entidade,
          'validado deve ser booleano (true ou false)'
        );
      }
      validarTelefone(
        erros,
        'unidades.json',
        'whatsapp.e164',
        entidade,
        unidade?.whatsapp?.e164,
        exemplosTelefones
      );

      const horarios = Array.isArray(unidade?.horarios) ? unidade.horarios : [];
      horarios.forEach((horario, posicao) => {
        const dias = Array.isArray(horario?.dias) ? horario.dias : [];
        if (dias.length === 0) {
          erro(erros, 'unidades.json', `horarios[${posicao}].dias`, entidade, 'informe ao menos um dia');
        }
        for (const dia of dias) {
          if (!DIAS_SEMANA.includes(dia)) {
            erro(
              erros,
              'unidades.json',
              `horarios[${posicao}].dias`,
              entidade,
              `dia invalido: ${dia}`
            );
          }
        }
        if (!REGEX_HORA.test(String(horario?.abre)) || !REGEX_HORA.test(String(horario?.fecha))) {
          erro(
            erros,
            'unidades.json',
            `horarios[${posicao}]`,
            entidade,
            'abre e fecha devem usar HH:MM'
          );
        } else if (horario.abre >= horario.fecha) {
          erro(
            erros,
            'unidades.json',
            `horarios[${posicao}]`,
            entidade,
            'horario invalido: abre deve ser menor que fecha'
          );
        }
      });

      for (const ref of unidade?.servicos ?? []) {
        if (!idsServicos.has(ref)) {
          erro(erros, 'unidades.json', 'servicos', entidade, `referencia a servico inexistente: ${ref}`);
        }
      }
      for (const ref of unidade?.convenios ?? []) {
        if (!idsConvenios.has(ref)) {
          erro(erros, 'unidades.json', 'convenios', entidade, `referencia a convenio inexistente: ${ref}`);
        }
      }

      if (unidade?.status === 'ativo') {
        const publicavel = unidade?.validacao?.status === 'confirmado';
        if (!publicavel) {
          erro(
            erros,
            'unidades.json',
            'validacao.status',
            entidade,
            'unidade marcada como ativa exige validacao confirmada'
          );
        }
        exigir(erros, 'unidades.json', 'validacao.confirmadoPor', entidade, unidade?.validacao?.confirmadoPor);
        if (unidade?.validacao?.data == null) {
          erro(
            erros,
            'unidades.json',
            'validacao.data',
            entidade,
            'unidade ativa exige data de confirmacao'
          );
        } else {
          validarData(erros, 'unidades.json', 'validacao.data', entidade, unidade.validacao.data);
        }
        if (!Array.isArray(unidade?.validacao?.fontes) || unidade.validacao.fontes.length === 0) {
          erro(
            erros,
            'unidades.json',
            'validacao.fontes',
            entidade,
            'unidade ativa exige ao menos uma fonte de confirmacao'
          );
        }
        exigir(erros, 'unidades.json', 'cnpjFilial', entidade, unidade?.cnpjFilial);
        exigir(erros, 'unidades.json', 'endereco.logradouro', entidade, unidade?.endereco?.logradouro);
        exigir(erros, 'unidades.json', 'endereco.numero', entidade, unidade?.endereco?.numero);
        exigir(erros, 'unidades.json', 'endereco.bairro', entidade, unidade?.endereco?.bairro);
        exigir(erros, 'unidades.json', 'endereco.cep', entidade, unidade?.endereco?.cep);
        if (telefones.length === 0) {
          erro(erros, 'unidades.json', 'telefones', entidade, 'unidade ativa exige ao menos um telefone');
        } else if (telefones.filter(telefoneValidado).length === 0) {
          erro(
            erros,
            'unidades.json',
            'telefones',
            entidade,
            'unidade ativa exige ao menos um telefone com validado: true e E.164 valido'
          );
        }
        if (horarios.length === 0) {
          erro(erros, 'unidades.json', 'horarios', entidade, 'unidade ativa exige horario');
        }
        if ((unidade?.servicos ?? []).length === 0) {
          erro(erros, 'unidades.json', 'servicos', entidade, 'unidade ativa exige ao menos um servico');
        }
        if (typeof unidade?.atendimentoParticular !== 'boolean') {
          erro(
            erros,
            'unidades.json',
            'atendimentoParticular',
            entidade,
            'unidade ativa exige informacao de atendimento particular'
          );
        }
      }
    });
  }

  if (totalMatriz > 1) {
    erro(erros, 'unidades.json', 'matriz', 'site', 'apenas uma unidade pode ser marcada como matriz');
  }

  const matrizDados = (unidadesLista ?? []).find((unidade) => unidade?.matriz === true);
  const telefoneMatriz = telefonePrincipal(matrizDados)?.e164;
  if (
    !rascunho &&
    site.contatoInstitucional?.telefoneE164 &&
    telefoneMatriz &&
    site.contatoInstitucional.telefoneE164 !== telefoneMatriz
  ) {
    erro(
      erros,
      'site.json',
      'contatoInstitucional.telefoneE164',
      'site',
      'deve ser identico ao telefone institucional da matriz'
    );
  }

  const paginas = dados.paginas?.paginas ?? {};
  const paginasObrigatorias = [
    'home',
    'unidades',
    'servicos',
    'preparo',
    'naoEncontrado',
    'sobre',
    'convenios',
    'contato'
  ];
  if (site.privacidade?.politicaPublicada === true) {
    paginasObrigatorias.push('privacidade');
  }
  for (const chave of paginasObrigatorias) {
    const pagina = paginas[chave];
    if (!pagina) {
      erro(erros, 'paginas.json', 'paginas', chave, 'pagina obrigatoria ausente');
      continue;
    }
    exigir(erros, 'paginas.json', `${chave}.seo.titulo`, chave, pagina?.seo?.titulo);
    exigir(erros, 'paginas.json', `${chave}.seo.descricao`, chave, pagina?.seo?.descricao);
  }
  for (const [chave, pagina] of Object.entries(paginas)) {
    const blocos = pagina?.blocos;
    if (blocos == null) {
      continue;
    }
    if (!Array.isArray(blocos)) {
      erro(erros, 'paginas.json', `${chave}.blocos`, chave, 'blocos deve ser uma lista');
      continue;
    }
    blocos.forEach((bloco, indice) => {
      const campo = `${chave}.blocos[${indice}]`;
      if (!TIPOS_BLOCO.includes(bloco?.tipo)) {
        erro(
          erros,
          'paginas.json',
          `${campo}.tipo`,
          chave,
          `tipo de bloco invalido; use um de: ${TIPOS_BLOCO.join(', ')}`
        );
        return;
      }
      if (!['pendente', 'aprovado'].includes(bloco?.status)) {
        erro(
          erros,
          'paginas.json',
          `${campo}.status`,
          chave,
          'status do bloco deve ser "pendente" ou "aprovado"'
        );
      }
      if (bloco.tipo === 'lista') {
        if (!Array.isArray(bloco.itens) || bloco.itens.length === 0) {
          erro(erros, 'paginas.json', `${campo}.itens`, chave, 'bloco de lista exige itens');
        } else {
          bloco.itens.forEach((item, posicao) => {
            exigir(erros, 'paginas.json', `${campo}.itens[${posicao}]`, chave, item);
          });
        }
      } else {
        exigir(erros, 'paginas.json', `${campo}.texto`, chave, bloco.texto);
      }
    });
  }

  return erros;
}

function ordenarPorSlug(lista) {
  return [...lista].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

/**
 * Decide o que entra em cada build. Em producao, entidades pendentes ficam de fora
 * (e sao listadas no relatorio). Em `--rascunho`, tudo entra e os avisos sao emitidos.
 */
export function resolverPublicacao(dados, { rascunho = false } = {}) {
  const todasUnidades = ordenarPorSlug(dados.unidades?.unidades ?? []);
  const todosServicos = ordenarPorSlug(dados.servicos?.servicos ?? []);
  const todosPreparos = ordenarPorSlug(dados.preparos?.preparos ?? []);
  const avisos = [];

  const unidades = todasUnidades.filter((unidade) => rascunho || unidadePublicavel(unidade, todosServicos));

  const servicos = todosServicos.filter((servico) => {
    if (rascunho) {
      return true;
    }
    if (!servicoAprovado(servico)) {
      return false;
    }
    return unidades.some((unidade) => (unidade.servicos ?? []).includes(servico.id));
  });

  const idsServicosPublicados = new Set(servicos.map((servico) => servico.id));
  const preparos = todosPreparos.filter((preparo) => {
    if (rascunho) {
      return true;
    }
    return preparoAprovado(preparo) && idsServicosPublicados.has(preparo.servicoId);
  });

  if (!rascunho) {
    const pendentes = todasUnidades.length - unidades.length;
    if (pendentes > 0) {
      avisos.push(
        `${pendentes} unidade(s) fora do build de producao (sem status ativo, validacao confirmada, telefone validado ou servico aprovado)`
      );
    }
    const servicosFora = todosServicos.length - servicos.length;
    if (servicosFora > 0) {
      avisos.push(
        `${servicosFora} servico(s) fora do build de producao (nao aprovados ou sem unidade publicada)`
      );
    }
    const preparosFora = todosPreparos.length - preparos.length;
    if (preparosFora > 0) {
      avisos.push(`${preparosFora} preparo(s) fora do build de producao (revisao nao aprovada)`);
    }
  } else {
    const unidadesPendentes = todasUnidades.filter((unidade) => !unidadePublicavel(unidade, todosServicos)).length;
    const servicosPendentes = todosServicos.filter((servico) => servico.status !== 'aprovado').length;
    const preparosPendentes = todosPreparos.filter((preparo) => preparo.revisao?.status !== 'aprovado').length;
    if (unidadesPendentes > 0) {
      avisos.push(
        `gate ignorado no rascunho: ${unidadesPendentes} unidade(s) sem status "ativo"/validacao confirmada, telefone validado ou servico aprovado`
      );
    }
    if (servicosPendentes > 0) {
      avisos.push(`gate ignorado no rascunho: ${servicosPendentes} servico(s) nao aprovados`);
    }
    if (preparosPendentes > 0) {
      avisos.push(`gate ignorado no rascunho: ${preparosPendentes} preparo(s) sem revisao aprovada`);
    }
  }

  const mapaServicoUnidades = new Map();
  const mapaConvenioUnidades = new Map();
  for (const servico of todosServicos) {
    mapaServicoUnidades.set(
      servico.id,
      unidades.filter((unidade) => (unidade.servicos ?? []).includes(servico.id))
    );
  }
  for (const unidade of unidades) {
    for (const convenioId of unidade.convenios ?? []) {
      if (!mapaConvenioUnidades.has(convenioId)) {
        mapaConvenioUnidades.set(convenioId, []);
      }
      mapaConvenioUnidades.get(convenioId).push(unidade);
    }
  }

  return {
    unidades,
    servicos,
    preparos,
    avisos,
    mapaServicoUnidades,
    mapaConvenioUnidades
  };
}

export function formatarTelefone(e164) {
  const digitos = String(e164).replace(/\D/g, '');
  const ddd = digitos.slice(2, 4);
  const numero = digitos.slice(4);
  if (numero.length === 9) {
    return `(${ddd}) ${numero.slice(0, 5)}-${numero.slice(5)}`;
  }
  if (numero.length === 8) {
    return `(${ddd}) ${numero.slice(0, 4)}-${numero.slice(4)}`;
  }
  return String(e164);
}

export function formatarDias(dias = []) {
  const ordenados = [...dias].sort((a, b) => DIAS_SEMANA.indexOf(a) - DIAS_SEMANA.indexOf(b));
  const chave = ordenados.join(',');
  if (chave === 'seg,ter,qua,qui,sex') {
    return 'Segunda a sexta';
  }
  if (chave === 'seg,ter,qua,qui,sex,sab') {
    return 'Segunda a sábado';
  }
  if (chave === 'seg,ter,qua,qui,sex,sab,dom') {
    return 'Todos os dias';
  }
  return ordenados.map((dia) => NOMES_DIAS[dia] ?? dia).join(', ');
}

export function enderecoEmLinha(unidade) {
  const partes = [
    unidade?.endereco?.logradouro,
    unidade?.endereco?.numero,
    unidade?.endereco?.bairro,
    unidade?.cidade,
    unidade?.uf,
    unidade?.endereco?.cep
  ].filter(Boolean);
  return partes.join(', ');
}
