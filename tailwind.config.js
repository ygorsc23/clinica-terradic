/**
 * AVISO — IDENTIDADE VISUAL PROVISORIA
 * A paleta abaixo e uma APROXIMACAO visual derivada de um flyer de campanha da
 * unidade Pacajus (material obtido em redes sociais). NAO e brandbook, NAO e a
 * marca oficial e NAO deve ser tratada como definitiva. Os valores hexadecimais
 * vivem apenas no arquivo de tema `src/css/estilo.css` (variaveis semanticas);
 * este arquivo apenas mapeia os tokens para o Tailwind.
 * Substituicao prevista em T010 (dependencia de conteudo C-11).
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./src/templates/**/*.html', './src/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        fundo: 'var(--cor-fundo)',
        superficie: 'var(--cor-superficie)',
        texto: 'var(--cor-texto)',
        'texto-inverso': 'var(--cor-texto-inverso)',
        primaria: 'var(--cor-primaria)',
        'primaria-texto': 'var(--cor-primaria-texto)',
        secundaria: 'var(--cor-secundaria)',
        'secundaria-escura': 'var(--cor-secundaria-escura)',
        acento: 'var(--cor-acento)',
        borda: 'var(--cor-borda)',
        foco: 'var(--cor-foco)',
        'foco-escuro': 'var(--cor-foco-escuro)'
      },
      borderRadius: {
        card: 'var(--raio-card)'
      },
      boxShadow: {
        card: 'var(--sombra-card)'
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif'
        ]
      },
      maxWidth: {
        conteudo: '72rem'
      }
    }
  },
  plugins: []
};
