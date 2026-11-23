/**
 * CSV RFC 4180 com separador `;`, usado pelo kit de coleta.
 * - Serializador: UTF-8 com BOM opcional (padrao ligado), CRLF e aspas apenas
 *   quando o valor contem `;`, `"`, CR ou LF.
 * - Parser: aceita BOM opcional, CRLF ou LF, aspas, `""`, `;` interno e CR/LF
 *   dentro de aspas. CSV malformado falha com a linha fisica do problema.
 * Sem dependencia e sem I/O: recebe e devolve strings.
 */

export const BOM = '\uFEFF';
export const SEPARADOR_CSV = ';';
export const EOL_CSV = '\r\n';

export class ErroCsv extends Error {
  constructor(motivo, linha) {
    const posicao = Number.isInteger(linha) && linha > 0 ? ` (linha ${linha})` : '';
    super(`csv: ${motivo}${posicao}`);
    this.name = 'ErroCsv';
    this.motivo = motivo;
    this.linha = Number.isInteger(linha) && linha > 0 ? linha : null;
  }
}

/** Escapa uma celula conforme RFC 4180. `null`/`undefined` viram celula vazia. */
export function escaparCelula(valor) {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  if (/[;"\r\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

/**
 * Serializa cabecalho + linhas.
 * A primeira posicao do UTF-8 e o BOM quando `bom` e verdadeiro.
 */
export function serializarCsv({
  cabecalho,
  linhas = [],
  bom = true,
  separador = SEPARADOR_CSV,
  eol = EOL_CSV
} = {}) {
  if (!Array.isArray(cabecalho) || cabecalho.length === 0) {
    throw new Error('csv: cabecalho obrigatorio');
  }
  const registros = [cabecalho, ...linhas];
  registros.forEach((registro, indice) => {
    if (!Array.isArray(registro)) {
      throw new Error(`csv: registro ${indice} deve ser uma lista`);
    }
    if (registro.length !== cabecalho.length) {
      throw new Error(
        `csv: registro ${indice} tem ${registro.length} coluna(s); o cabecalho tem ${cabecalho.length}`
      );
    }
  });
  const corpo = registros
    .map((registro) => registro.map((celula) => escaparCelula(celula)).join(separador))
    .join(eol);
  return `${bom ? BOM : ''}${corpo}${eol}`;
}

/**
 * Le um CSV e devolve `{ cabecalho, linhas }`.
 * A linha informada no erro e a linha fisica do arquivo (1 = primeira linha),
 * contando CR/LF dentro de aspas.
 */
export function lerCsv(texto, { separador = SEPARADOR_CSV } = {}) {
  if (typeof texto !== 'string') {
    throw new TypeError('csv: texto deve ser string');
  }
  if (typeof separador !== 'string' || separador.length !== 1) {
    throw new Error('csv: separador deve ter exatamente um caractere');
  }

  const conteudo = texto.startsWith(BOM) ? texto.slice(1) : texto;
  const registros = [];
  const linhasDosRegistros = [];
  let registro = [];
  let campo = '';
  let emAspas = false;
  let campoFechado = false;
  let linha = 1;
  let linhaDoRegistro = 1;
  let linhaDaAbertura = 1;
  let indice = 0;

  const finalizarCampo = () => {
    registro.push(campo);
    campo = '';
    campoFechado = false;
  };

  const finalizarRegistro = () => {
    finalizarCampo();
    registros.push(registro);
    linhasDosRegistros.push(linhaDoRegistro);
    registro = [];
  };

  while (indice < conteudo.length) {
    const caractere = conteudo[indice];

    if (emAspas) {
      if (caractere === '"') {
        if (conteudo[indice + 1] === '"') {
          campo += '"';
          indice += 2;
          continue;
        }
        emAspas = false;
        campoFechado = true;
        indice += 1;
        continue;
      }
      if (caractere === '\r') {
        campo += caractere;
        indice += 1;
        if (conteudo[indice] === '\n') {
          campo += '\n';
          indice += 1;
        }
        linha += 1;
        continue;
      }
      if (caractere === '\n') {
        campo += caractere;
        indice += 1;
        linha += 1;
        continue;
      }
      campo += caractere;
      indice += 1;
      continue;
    }

    if (campoFechado && caractere !== separador && caractere !== '\r' && caractere !== '\n') {
      throw new ErroCsv('conteudo depois de aspas fechadas', linha);
    }

    if (caractere === '"') {
      if (campo !== '' || campoFechado) {
        throw new ErroCsv('aspas no meio do campo', linha);
      }
      emAspas = true;
      linhaDaAbertura = linha;
      indice += 1;
      continue;
    }

    if (caractere === separador) {
      finalizarCampo();
      indice += 1;
      continue;
    }

    if (caractere === '\r' || caractere === '\n') {
      finalizarRegistro();
      indice += 1;
      if (caractere === '\r' && conteudo[indice] === '\n') {
        indice += 1;
      }
      linha += 1;
      linhaDoRegistro = linha;
      continue;
    }

    campo += caractere;
    indice += 1;
  }

  if (emAspas) {
    throw new ErroCsv('aspas nao fechadas', linhaDaAbertura);
  }

  if (campo !== '' || registro.length > 0 || campoFechado) {
    finalizarRegistro();
  }

  if (registros.length === 0) {
    throw new ErroCsv('planilha vazia', 1);
  }

  const [cabecalho, ...linhas] = registros;
  linhas.forEach((linhaLida, posicao) => {
    if (linhaLida.length !== cabecalho.length) {
      throw new ErroCsv(
        `linha com ${linhaLida.length} coluna(s); o cabecalho tem ${cabecalho.length}`,
        linhasDosRegistros[posicao + 1]
      );
    }
  });

  return { cabecalho, linhas, numeros: linhasDosRegistros.slice(1) };
}
