# Proposta técnica — Site institucional Terradic

**Documento:** proposta técnica (versão preliminar)
**Para:** direção e gestão da Terradic
**Assunto:** criação do site institucional da rede, com uma página por unidade e área de orientação ao paciente

> Este documento descreve **o que** será feito e **como** o site funcionará. Ele **não contém valores, prazos comerciais nem condições de pagamento**. A versão é preliminar e será ajustada após a reunião de briefing com a clínica.

---

## 1. Entendimento do problema

A Terradic é uma rede de diagnóstico por imagem e telerradiologia no Ceará, com atuação em várias cidades. Hoje **a clínica não tem site**: os endereços de internet da marca não levam a lugar nenhum, e a presença digital está espalhada em perfis de redes sociais por unidade e em guias de terceiros.

Na prática, isso produz quatro problemas:

1. **O paciente não encontra uma fonte oficial.** Quem procura "tomografia em Crateús" ou "mamografia em Cascavel" cai em perfis sociais, listas de terceiros ou páginas desatualizadas. Não há um lugar em que ele confirme, com segurança, se aquela unidade faz o exame que ele precisa.
2. **A informação circula em versões diferentes.** Telefones, endereços e horários aparecem em vários lugares, com formatos e valores distintos. Cada divergência gera ligação perdida, paciente que chega no lugar errado e desgaste no atendimento.
3. **A clínica não controla a primeira impressão.** O que aparece hoje é definido por terceiros. A clínica não decide o que o paciente lê primeiro, nem consegue corrigir rapidamente uma informação errada.
4. **O portal de exames existe, mas não é apresentado.** O paciente que já realizou um exame não é conduzido de forma clara ao portal onde baixa o laudo. Ele depende de instruções informais no balcão ou no telefone.

> **Sobre os dados usados nesta proposta.** As unidades, cidades, serviços e a existência de uma unidade em Quixeramobim foram levantados em fontes públicas e em material de campanha da própria clínica. **Nada disso foi confirmado formalmente pela clínica.** Telefones, endereços, horários e convênios são, portanto, **provisórios** até a validação no briefing.

---

## 2. Objetivo do projeto

Criar o **site oficial da rede**: um endereço único, confiável e fácil de usar, que concentre a informação que o paciente procura e que a clínica quer que ele encontre.

Resultados concretos e verificáveis:

- **Ser encontrado por cidade e por exame.** Cada unidade ativa tem uma página própria com conteúdo real (endereço, referência, telefone, horário, exames realizados). Cada exame tem uma página que explica o que é e em quais unidades é feito.
- **Uma única versão da verdade.** Endereço, telefone e horário existem em um só cadastro: o que aparece na página da unidade é exatamente o que aparece na página de contato, no rodapé e na informação que o Google lê.
- **Direcionar o paciente ao portal de exames.** O botão "Baixar exames" fica visível no topo, no destaque principal e no rodapé, sempre com a explicação de que o download acontece em um ambiente externo.
- **Cumprir as exigências de identificação e de publicidade médica.** Nome empresarial, CNPJ e responsável técnico com CRM acessíveis em todas as páginas; linguagem sem promessa de resultado.
- **Funcionar bem para todos.** Site leve, que abre rápido no celular com internet comum, navegável por teclado e por leitores de tela, com contraste adequado.

Uma ressalva honesta de expectativa: o site é a **base** para ser encontrado. A posição nas buscas também depende do perfil da empresa no Google (por unidade), da concorrência local e da qualidade do conteúdo. O projeto entrega a base técnica e o conteúdo; não promete primeira posição.

---

## 3. O que está incluído

Em linguagem de negócio, o projeto entrega:

**Estrutura do site**

- **Página inicial** com a apresentação da rede, os exames realizados, as unidades e o acesso ao portal de exames.
- **Página por unidade ativa**, com nome, endereço completo, referência de localização, telefones clicáveis, horário de funcionamento, exames realizados ali, convênios aceitos naquela unidade, informação sobre atendimento particular e mapa.
- **Índice de unidades**, para o paciente escolher a mais próxima.
- **Páginas de serviços** para os exames da rede (tomografia, raio-X, ultrassonografia geral e Doppler, mamografia e consultas ambulatoriais — a lista final será confirmada pela clínica), explicados em linguagem leiga e ligados às unidades que os realizam.
- **Guia de preparo de exames** em uma página única, organizada por exame, com as orientações que o paciente precisa antes de ir (jejum, medicação, documentos, vestimenta).
- **Página de convênios e atendimento particular**, com a lista por unidade e o aviso de que a cobertura deve ser confirmada com a operadora e com a unidade.
- **Página "Sobre"** com a história, a atuação da rede e a identificação do responsável técnico.
- **Página de contato** com telefones por unidade, e-mail institucional e endereço da matriz.
- **Página de erro** para endereços que não existem, com caminhos úteis de volta.

**Recursos transversais**

- **Botão "Baixar exames"** no topo, no destaque e no rodapé, apontando para o portal externo, sempre com aviso de que o paciente sai do site da clínica.
- **Identificação obrigatória** (razão social, CNPJ e responsável técnico com CRM) no rodapé de todas as páginas.
- **Otimização para busca local**: cada página com título e descrição próprios, mapa do site enviado ao Google e marcação que ajuda o Google a entender que se trata de uma clínica com endereço e serviços naquela cidade.
- **Acessibilidade** no padrão WCAG 2.1 AA: contraste adequado, navegação por teclado, textos alternativos em imagens, estrutura de página compreensível por leitores de tela.
- **Desempenho**: site leve, sem bibliotecas pesadas, imagens otimizadas e mapa que só carrega quando o visitante pede.
- **Ambiente de testes antes da publicação**, que não aparece nas buscas até a aprovação.
- **Documentação de operação**, explicando como corrigir um telefone, incluir uma unidade ou atualizar um preparo.

---

## 4. O que não está incluído

Para evitar expectativa errada, ficam **fora** desta proposta:

- Agendamento de exames pelo site.
- Área do paciente (login, histórico, dados de exames).
- Entrega ou visualização de laudos no site.
- Integração com o sistema de gestão da clínica.
- Blog, área de notícias ou newsletter.
- Painel de edição de conteúdo pela clínica (as alterações de cadastro são feitas com apoio da equipe do projeto).
- Gestão de redes sociais e anúncios pagos.
- Criação de identidade visual (logo, manual de marca, papelaria).
- Loja, venda de exames, divulgação de preços, cupons ou pacotes promocionais.
- Avaliações de pacientes, depoimentos, fotos de antes e depois.
- Aplicativo para celular e versão do site em outro idioma.
- Gestão do perfil da empresa no Google (recomendada em paralelo, porque influencia diretamente o resultado nas buscas, mas é uma frente separada).

---

## 5. Como o site funciona na prática

**O download de exames continua no portal externo.** O portal é operado pela Mobilemed e continua sendo o único lugar em que o paciente acessa o laudo. O site **apenas direciona**: o botão leva ao portal, em uma nova aba, acompanhado de um aviso claro de que se trata de um ambiente de terceiros. O site não recebe, não armazena e não vê dados do paciente, senha ou laudo. O paciente é orientado a ter em mãos o CPF e o protocolo ou senha de acesso.

**Os dados de cada unidade ficam cadastrados em um único lugar.** Corrigir um telefone é **uma alteração só**: ela se propaga para a página da unidade, o índice de unidades, a página de contato, o rodapé e a informação que o Google lê. Não existe a situação de corrigir em uma página e esquecer em outra. O mesmo vale para horário, endereço e lista de exames.

**O mapa não pesa na primeira visita.** O endereço em texto está sempre visível; o mapa interativo só carrega quando o visitante clica para vê-lo. Isso deixa o site mais rápido e evita que serviços de terceiros sejam acionados sem o visitante pedir.

**Antes de ir ao ar, o site fica em um endereço de teste** que não aparece no Google. A publicação só acontece depois da aprovação do conteúdo e do responsável técnico.

**A versão de revisão já está disponível para conferência** em <https://ygorsc23.github.io/clinica-terradic/>. É uma versão de revisão, não oficial, em endereço temporário. Ela usa dados fictícios e exibe, de forma visível, a faixa de que os dados ainda não foram confirmados. Também está fora dos resultados de busca. Serve para avaliar estrutura, organização, linguagem e legibilidade — não substitui a validação de conteúdo nem a publicação oficial, que dependem dos dados confirmados pela clínica (seção 6).

---

## 6. O que a clínica precisa fornecer

Os itens abaixo são o material que só a clínica tem. Nenhum deles impede o início do trabalho: a estrutura é construída enquanto o material é coletado. O que eles definem é **quando cada parte pode ir ao ar**.

| O que precisamos | Para que serve | Se faltar |
|---|---|---|
| Confirmação de quais unidades estão em funcionamento (incluindo a de Quixeramobim) | Define quantas páginas de unidade existem | A unidade não confirmada não é publicada |
| Endereço completo, CEP e localização no mapa de cada unidade | Página da unidade, mapa e informação para o Google | A unidade fica fora do ar até completar |
| Telefones oficiais e definição de qual número é WhatsApp oficial | Contato e botão de telefone | Não publicamos número não confirmado |
| Horários de funcionamento por unidade | Página da unidade e contato | Unidade não publicada ou horário omitido |
| Quais exames são feitos em cada unidade | Páginas de serviço e de unidade | Serviço não é associado à unidade |
| Convênios aceitos por unidade e sua vigência | Página de convênios | Nenhum convênio é exibido |
| Formas de pagamento e documentos exigidos, se quiserem divulgar | Página de convênios e particular | Publicamos apenas "consulte a unidade" |
| Responsável técnico: nome, CRM e especialidade (e se há um por unidade) | Identificação obrigatória no rodapé e na página "Sobre" | O site não pode ser publicado sem essa identificação |
| Textos de preparo de exames revisados e aprovados pelo responsável técnico | Guia de preparo | O exame não é publicado no guia até a revisão |
| Texto institucional: história, atuação e diferenciais comprováveis | Página "Sobre" e página inicial | Publicamos uma versão mínima, sem afirmações não comprovadas |
| Logo no arquivo oficial (aquele que pode ser ampliado sem perder qualidade), cores e tipografia oficiais | Identidade visual definitiva | Usamos uma identidade provisória, claramente marcada como tal |
| Fotos reais das unidades e autorização de uso de imagem de pessoas identificáveis | Página das unidades | O layout usa blocos gráficos neutros, sem banco de imagens |
| Domínio definitivo e acesso ao serviço de domínio e à hospedagem | Publicação e endereço final | O site fica em endereço de teste |
| Texto de política de privacidade ou aviso legal | Rodapé e transparência com o paciente | O link não é publicado |
| E-mail institucional e perfis oficiais de redes sociais | Contato e identificação da marca | Publicamos apenas o que for confirmado |
| Prazo médio de laudo, **se** quiserem divulgar | Página de exames | O prazo não é mencionado |

Observação importante: dados de exemplo, números encontrados em guias de terceiros e informações de material de campanha **nunca vão ao ar** como se fossem oficiais. Se um dado não for confirmado, ele simplesmente não é publicado.

---

## 7. Fases de entrega

A ordem abaixo é a ordem de execução. Não há datas nesta proposta: o ritmo de cada fase depende da chegada do material e das aprovações.

| Marco | O que é entregue | Depende da clínica? |
|---|---|---|
| **1. Fundação** | Estrutura do site, padrão visual provisório, navegação, rodapé, página inicial em esqueleto e ambiente de teste | **Não** |
| **2. Unidades e exames** | Índice de unidades, páginas de unidade, páginas de serviço, ligações entre unidade e exame | **Parcial** — estrutura pronta; conteúdo real depende dos dados |
| **3. Institucional e convênios** | Página "Sobre", identificação do responsável técnico, convênios e particular, contato, página de erro | **Parcial** — texto e lista de convênios vêm da clínica |
| **4. Busca e dados estruturados** | Títulos e descrições por página, mapa do site, informação estruturada para o Google | **Parcial** — endereço e responsável técnico precisam estar confirmados |
| **5. Qualidade** | Revisão de acessibilidade, desempenho, comportamento em celular, tablet e computador | **Não** |
| **6. Conteúdo final e aprovação** | Textos finais, guia de preparo revisado, checklist de publicidade médica e aceite do responsável técnico | **Sim — bloqueante** |
| **7. Publicação** | Endereço definitivo, e-mail e acessos, envio do site ao Google, testes finais | **Sim** — domínio e acessos |

O que **não** depende da clínica (marcos 1 e 5, e a estrutura dos marcos 2 a 4) pode ser construído e revisado com dados de teste. O que **depende** (marcos 6 e 7) fica parado até o material chegar — e é justamente aí que o cronograma real se decide.

---

## 8. Manutenção e evolução

Publicar o site é o começo do uso, não o fim do trabalho. Esta seção explica o que precisa ser acompanhado depois da publicação. Ela não altera o escopo descrito até aqui nem transforma esta proposta em proposta comercial: descreve apenas a natureza do trabalho de manutenção.

**Por que o site precisa de manutenção.** Um site de clínica envelhece por três motivos:

- **Os dados mudam.** Um telefone é trocado, o horário é ajustado, uma unidade muda de endereço ou uma nova unidade passa a atender.
- **A lista de convênios muda.** Operadoras entram e saem, a cobertura de uma unidade muda, e a lista publicada deixa de corresponder ao que a recepção informa.
- **As normas e as expectativas mudam.** As regras de comunicação em saúde são revisadas, e a forma como o paciente procura e lê informação também muda com o tempo.

Um site desatualizado é pior do que a ausência de site: ele apresenta informação errada com aparência de oficial, o que gera ligação perdida, paciente no lugar errado e desgaste no atendimento. A manutenção existe para evitar exatamente isso.

**O que é atualização de cadastro.** É a correção ou inclusão de informação que a clínica já possui: telefone, horário, endereço e referência de localização, exames realizados por unidade, convênios aceitos, fotos das unidades e textos institucionais.

Como esses dados ficam guardados em um único cadastro, a correção é feita **uma vez só** e passa a valer, ao mesmo tempo, na página da unidade, no índice de unidades, na página de contato, no rodapé e na informação que o Google lê. A alteração é feita com apoio da equipe do projeto, não por um painel de autoatendimento — o site não tem área de edição para a clínica, conforme já registrado no que está fora do escopo.

**Rotinas recomendadas.** As práticas abaixo são recomendação de boa prática para manter a informação confiável. Elas não constituem frequência contratada nem compromisso de atendimento: podem ser executadas pela própria clínica ou apoiadas pela equipe do projeto, conforme o modelo combinado.

- **Lista de convênios:** revisão a cada trimestre, com confirmação junto às operadoras e atualização da data de vigência exibida no site.
- **Telefones, horários e unidades:** conferência a cada semestre, incluindo abertura, fechamento ou mudança de endereço de unidade.
- **Textos de preparo de exames:** revisão sempre que o responsável técnico solicitar, ou quando houver mudança de protocolo.
- **Fotos:** atualização quando houver mudança física na unidade que altere a imagem mostrada ao paciente.
- **Funcionamento geral:** verificação periódica do certificado de segurança, da vigência do domínio e das páginas principais, para identificar indisponibilidade ou link quebrado antes que o paciente encontre.

**Modelos de acompanhamento.** Existem formas comuns de organizar esse acompanhamento. Nenhuma delas está detalhada aqui em condições comerciais:

- **Sob demanda:** a clínica solicita correções pontuais quando precisar, sem programação fixa.
- **Acompanhamento periódico:** revisões programadas das informações e um interlocutor definido dos dois lados.
- **Evolução por etapas:** melhorias planejadas ao longo do tempo, com prioridades acordadas.

A escolha do modelo, das condições e da forma de contratação é objeto de proposta comercial separada, não deste documento.

**Custos de operação que não são do projeto.** Existem custos recorrentes de terceiros que mantêm o site no ar e não fazem parte do trabalho de construção:

- Registro anual do domínio (o endereço do site).
- Hospedagem do site.
- Certificado de segurança, quando não estiver incluído na hospedagem.

Esses custos são da clínica ou repassados conforme contrato. Recomendamos que o domínio e a hospedagem fiquem registrados no nome da clínica, com os acessos sob sua guarda: é o que garante que ela não perca o controle do próprio endereço na internet, qualquer que seja a equipe que faça o trabalho.

**O que a manutenção não cobre.** Para evitar expectativa errada, não fazem parte da manutenção:

- Criação de conteúdo novo para campanha.
- Gestão de redes sociais.
- Anúncios pagos.
- Suporte a sistemas internos da clínica.
- Criação de identidade visual.
- Produção de fotografia.
- Desenvolvimento de novas funcionalidades.

**Evolução futura, sem compromisso.** Alguns caminhos podem ser avaliados mais adiante, fora deste escopo e sem qualquer promessa nesta proposta:

- Agendamento de exames pelo site.
- Área do paciente, com login e histórico.
- Integração com o sistema de gestão da clínica.

Uma ressalva de cautela: agendamento e área do paciente envolvem dados de saúde e exigem um projeto próprio de segurança e privacidade, com definição de responsabilidades sobre o dado. Não são uma extensão trivial do site institucional e não devem ser tratados como tal.

**Recomendação de dono.** Sugerimos que a clínica nomeie um responsável interno pelas informações do site, com autoridade para confirmar dados e aprovar textos. Isso evita a divergência mais comum nesse tipo de projeto: a recepção informar uma coisa ao paciente e o site publicar outra.

---

## 9. Premissas

1. **Identidade visual provisória.** Enquanto não houver manual de marca e logo no arquivo oficial, trabalhamos com uma direção visual aproximada, derivada de material de campanha da própria clínica. Ela serve para validar estrutura e legibilidade — **não é a marca oficial**. A marca não é redesenhada nem recriada a partir de foto ou flyer; usamos um símbolo neutro até receber o arquivo correto.
2. **A publicação exige duas validações.** Do responsável técnico, sobre qualquer texto clínico ou de comunicação em saúde; e da clínica, sobre dados de unidade, convênios e material oficial.
3. **Um interlocutor na clínica.** Alguém com autonomia para responder dúvidas de cadastro e aprovar textos, para evitar retrabalho e informação contraditória.
4. **Conteúdo em português, sem área restrita.** O site é público, informativo e sem login.
5. **Textos de preparo não são escritos por suposição.** A estrutura fica pronta; o conteúdo entra somente depois da revisão médica, com registro de quem aprovou e quando.
6. **Hospedagem com certificado de segurança e domínio próprio.** O site é publicado em uma hospedagem simples, com certificado de segurança e endereço próprio.
7. **O resultado nas buscas depende também de fatores externos**, em especial do perfil da empresa no Google por unidade — frente recomendada em paralelo e não incluída neste escopo.

---

## 10. Conformidade

**Publicidade médica.** O site será construído para atender às exigências aplicáveis à comunicação de serviços médicos: identificação do responsável técnico com CRM, nome empresarial e CNPJ acessíveis, e nenhuma promessa de resultado, garantia de diagnóstico, sensacionalismo, superlativo não comprovável, foto de antes e depois, depoimento de paciente ou comparação com concorrentes. Todo texto passa por um checklist aplicado página a página, com aceite registrado do responsável técnico. A redação vigente da norma será conferida na revisão final, junto ao responsável técnico.

**Privacidade (LGPD).** O site **não coleta dados**: não tem formulário, não tem login, não usa cookies próprios e não instala rastreadores de terceiros. Por isso não há dado pessoal nem dado de saúde trafegando pelo site. O portal de exames é um ambiente independente, com regras próprias de privacidade e segurança — o site apenas informa e direciona, deixando claro que o paciente está saindo para outro ambiente.

**Acessibilidade.** O padrão adotado é o WCAG 2.1 AA: contraste de cores adequado, navegação completa por teclado, foco visível, textos alternativos, estrutura semântica e conteúdo legível mesmo se o navegador bloquear scripts.

**Transparência.** Convênios só aparecem após confirmação, sempre com a ressalva de verificação junto à operadora e à unidade e com a data de atualização visível. Nenhum dado de exemplo é publicado.

---

## 11. Como será verificado

O aceite não é uma impressão subjetiva: cada item abaixo tem uma forma de conferência.

- **Indexação:** todas as páginas publicadas aparecem no índice do Google, e o mapa do site enviado não aponta para endereço inexistente.
- **Busca local:** cada unidade ativa tem exatamente uma página, com endereço, telefone e horário idênticos aos do cadastro e aos do perfil da empresa no Google.
- **Desempenho:** o site atinge boas notas de velocidade em celular, com conexão simulada de 4G, e não carrega scripts pesados de terceiros.
- **Acessibilidade:** auditoria automatizada sem falhas críticas ou sérias nas páginas principais, complementada por teste manual de teclado e leitor de tela.
- **Nenhum dado não confirmado:** uma verificação automática no momento da publicação impede que texto provisório, telefone de exemplo ou convênio não confirmado cheguem ao ar.
- **Funcionamento do botão de exames:** todos os botões levam ao endereço correto do portal, abrem em nova aba e exibem o aviso de ambiente externo.
- **Revisão do responsável técnico:** checklist de publicidade médica assinado, abrangendo também a confirmação de que nenhum texto ou foto de campanha foi reaproveitado.
- **Identificação:** nome do responsável técnico e CRM presentes no rodapé de todas as páginas.

O detalhamento técnico completo está no documento técnico de referência do projeto.

---

## 12. Riscos e dependências

1. **Dados não confirmados.** O maior risco não é técnico: é publicar um telefone, endereço ou horário errado com aparência de oficial. Por isso, dado não confirmado não entra no ar — o que pode reduzir o número de unidades publicadas na primeira versão.
2. **Material e identidade visual.** Sem logo, cores oficiais e fotos, o site vai ao ar com identidade provisória e sem fotos reais. É possível publicar assim, mas exige aceite explícito e gera uma segunda rodada de ajuste visual.
3. **Texto clínico e revisão médica.** O guia de preparo depende da revisão do responsável técnico. Enquanto ela não acontece, os exames correspondentes não são publicados.
4. **Convênios.** Lista desatualizada gera reclamação no balcão e desgaste com a operadora. A mitigação é ressalva visível, data de atualização e revisão periódica.
5. **Expectativa sobre o portal de exames.** É comum esperar que o site "abra o laudo". Isso não é possível nem adequado: o portal é de terceiros e exige login do paciente. O escopo deixa isso explícito desde o início.
6. **Domínio e perfil no Google.** A publicação depende do domínio e dos acessos; o resultado nas buscas depende também do perfil da empresa no Google por unidade. Ambos são dependências externas ao site e precisam de dono definido na clínica.

---

## 13. Próximos passos

1. **Conferir a versão de revisão** em <https://ygorsc23.github.io/clinica-terradic/> e registrar comentários sobre estrutura, linguagem e legibilidade antes da reunião de briefing.
2. **Reunião de briefing** para confirmar unidades ativas, serviços, convênios e responsável técnico, e para responder às dúvidas abertas deste documento.
3. **Coleta do material** listado na seção 6, com um responsável definido do lado da clínica.
4. **Validação da identidade visual**: confirmar se existe manual de marca e logo oficial; se não, aprovar a direção provisória para a primeira versão.
5. **Aprovação desta proposta** e do escopo, com registro das premissas e do que ficou fora.

---

## 14. Nota de versão

**Versão preliminar, sem valores; sujeita a ajuste após o briefing com a clínica.**

Documento de apresentação técnica. Não substitui proposta comercial, contrato ou cronograma formal.
