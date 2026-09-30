# Plataforma de Skins para CS2 — Conceito do Produto

## 1. Visão geral

A plataforma será um **agregador, comparador de preços e construtor de inventários de skins para Counter-Strike 2**.

Ela **não será um marketplace** e não realizará compra ou venda diretamente.

O objetivo é ajudar o usuário a:

- encontrar uma skin específica;
- comparar preços entre diferentes marketplaces e a Steam;
- descobrir onde aquela skin está mais barata;
- explorar skins por cor, arma, categoria, estilo, preço e outras características;
- montar kits de skins completos;
- criar loadouts personalizados;
- montar um inventário dentro de um orçamento;
- descobrir a melhor combinação de skins pelo menor custo possível.

A ideia pode ser resumida como:

> **Um PCPartPicker de skins de CS2.**

Em vez de comparar peças de computador e montar um PC, o usuário compara skins em diferentes plataformas e monta o seu inventário ideal.

---

# 2. Problema

O mercado de skins de CS2 é fragmentado.

Uma mesma skin pode estar disponível em diversos sites com preços diferentes, condições diferentes e características diferentes.

Hoje, um jogador pode precisar:

1. procurar a skin em um marketplace;
2. abrir outro marketplace;
3. verificar a Steam;
4. comparar preços manualmente;
5. analisar wear e float;
6. repetir esse processo para diversas armas;
7. calcular quanto custaria montar o inventário completo.

Além disso, muitas vezes o usuário **não sabe exatamente qual skin quer**.

Ele pode saber apenas que deseja:

- um inventário vermelho;
- uma AK preta;
- um loadout azul;
- um kit barato;
- skins clean;
- um inventário de até R$ 500;
- um conjunto combinando com uma knife específica.

A plataforma resolve os dois problemas:

**comparação de preços** e **descoberta de skins**.

---

# 3. Proposta de valor

A plataforma centraliza informações de skins de diferentes marketplaces e transforma esses dados em uma experiência simples de descoberta e comparação.

O usuário poderá responder perguntas como:

> Onde essa skin está mais barata?

> Quanto custa montar esse inventário?

> Quais skins vermelhas existem para AK-47?

> Qual o melhor loadout preto até R$ 800?

> Quais skins combinam com minha knife?

> Quanto eu economizo comprando cada skin no marketplace mais barato?

---

# 4. Os três pilares do produto

## 4.1 Search

Para usuários que já sabem qual skin querem.

Exemplo:

> AK-47 | Redline

A plataforma apresenta:

- imagem;
- arma;
- nome;
- coleção;
- raridade;
- exterior;
- float;
- StatTrak;
- preços;
- marketplaces;
- histórico de preço;
- menor preço encontrado.

Exemplo:

| Marketplace | Preço | Diferença |
| --- | ---: | ---: |
| CSFloat | R$ 82 | Melhor preço |
| Skinport | R$ 87 | +6% |
| DMarket | R$ 91 | +11% |
| Steam | R$ 115 | +40% |

O usuário poderá clicar no marketplace e ser direcionado para a oferta.

---

## 4.2 Discover

Para usuários que querem encontrar uma skin, mas ainda não sabem exatamente qual.

Exemplos:

> Quero uma AK vermelha até R$ 100.

> Quero uma AWP preta.

> Quero uma USP-S roxa Minimal Wear.

Filtros possíveis:

- arma;
- tipo de arma;
- cor;
- faixa de preço;
- exterior;
- float;
- raridade;
- coleção;
- StatTrak;
- Souvenir;
- estilo visual;
- popularidade;
- marketplace;
- desconto em relação à Steam.

Exemplo de navegação:

`Rifles → AK-47 → Vermelho → Até R$ 100`

---

## 4.3 Build

É o principal diferencial da plataforma.

O usuário poderá montar um inventário completo de CS2.

Exemplo:

## Meu Loadout

| Slot | Skin | Melhor preço |
| --- | --- | ---: |
| Glock-18 | Vogue | R$ 38 |
| USP-S | Cortex | R$ 21 |
| AK-47 | Neon Rider | R$ 174 |
| M4A1-S | Decimator | R$ 91 |
| AWP | Neo-Noir | R$ 167 |

**Total do inventário: R$ 491**

A plataforma identifica automaticamente o marketplace mais barato para cada item.

---

# 5. Comparador de preços

Cada skin terá sua própria página.

Exemplo:

# AK-47 | Redline

### Field-Tested

- CSFloat — R$ 82
- Skinport — R$ 87
- DMarket — R$ 91
- Steam — R$ 115

### Informações

- Melhor preço: R$ 82
- Média dos marketplaces: R$ 91
- Steam: R$ 115
- Economia máxima: R$ 33
- Economia percentual: 28,7%

A página também poderá mostrar:

- gráfico de preço;
- menor preço histórico;
- maior preço histórico;
- média dos últimos 7 dias;
- média dos últimos 30 dias;
- quantidade de ofertas;
- diferença entre Steam e marketplaces.

---

# 6. Condições das skins

O usuário poderá comparar preços separadamente por exterior:

- Factory New;
- Minimal Wear;
- Field-Tested;
- Well-Worn;
- Battle-Scarred.

Também poderão existir filtros para:

- StatTrak;
- Souvenir;
- float;
- pattern;
- stickers.

Em versões futuras, determinados itens poderão ter comparação mais avançada baseada em:

- float específico;
- pattern index;
- Doppler phase;
- Fade percentage;
- Blue Gem;
- stickers aplicados.

---

# 7. Kits de skins

A plataforma terá conjuntos prontos de skins.

Os kits poderão ser criados pela plataforma, comunidade ou automaticamente pelo sistema.

## Exemplos

### Kit Vermelho

- AK-47 | Redline
- M4A1-S | Cyrex
- Glock-18 | Candy Apple
- USP-S | Check Engine
- AWP | Redline

**Preço total estimado: R$ 437**

---

### Kit Azul

Conjunto de skins predominantemente azuis.

---

### Kit Preto

Inventário focado em skins escuras e minimalistas.

---

### Kit Roxo

Inventário com skins em tons de roxo.

---

### Kit Low Budget

Inventário completo com foco em custo-benefício.

---

### Kit Premium

Inventário com skins de maior valor.

---

# 8. Categorias de kits

Os kits poderão ser organizados por:

## Cor

- vermelho;
- azul;
- verde;
- roxo;
- rosa;
- amarelo;
- laranja;
- branco;
- preto;
- dourado;
- multicolorido.

## Orçamento

- até R$ 100;
- até R$ 250;
- até R$ 500;
- até R$ 1.000;
- até R$ 2.500;
- até R$ 5.000;
- premium.

## Estilo

- clean;
- dark;
- colorful;
- minimalista;
- cyberpunk;
- militar;
- futurista;
- anime;
- neon;
- clássico.

## Categoria

- rifles;
- pistolas;
- SMGs;
- snipers;
- heavy;
- knives;
- gloves;
- loadout completo.

---

# 9. Builder de inventário

O usuário poderá construir manualmente seu próprio inventário.

Exemplo:

```text
MEU INVENTÁRIO

Knife          [Escolher skin]
Gloves         [Escolher skin]

AK-47          Neon Rider       R$ 174
M4A1-S         Decimator        R$ 91
AWP            Neo-Noir         R$ 167

Glock-18       Vogue            R$ 38
USP-S          Cortex           R$ 21
Desert Eagle   [Escolher skin]

TOTAL                            R$ 491
```

Ao adicionar uma skin, o sistema atualiza automaticamente:

- valor total;
- marketplace mais barato;
- preço Steam;
- economia;
- distribuição de compras.

---

# 10. Otimização de compra

Nem sempre comprar cada skin no lugar mais barato será a melhor experiência.

Por isso, o usuário poderá escolher estratégias.

## Menor preço possível

Compra cada item no marketplace com o menor preço.

Exemplo:

```text
CSFloat
AK-47      R$ 174
USP-S      R$ 21

Skinport
AWP        R$ 167
M4A1-S     R$ 91

Steam
Glock      R$ 38
```

---

## Menor número de marketplaces

O sistema tenta concentrar as compras em menos plataformas, mesmo que o valor final seja um pouco maior.

Exemplo:

> Você pode economizar R$ 12 comprando em quatro sites diferentes ou comprar tudo em dois marketplaces.

---

## Melhor equilíbrio

O algoritmo considera:

- preço;
- quantidade de marketplaces;
- disponibilidade;
- diferença de preço.

---

# 11. Smart Loadout

O Smart Loadout poderá ser uma das principais funcionalidades da plataforma.

O usuário fornece algumas preferências.

Exemplo:

```text
Orçamento: R$ 1.000

Cor:
Vermelho

Estilo:
Clean

Prioridades:
AK-47
AWP
USP-S

Incluir knife:
Não
```

A plataforma gera automaticamente opções de inventário.

## Loadout A

Mais equilibrado.

## Loadout B

Prioriza AK e AWP.

## Loadout C

Prioriza quantidade de skins.

Cada loadout mostra:

- skins utilizadas;
- valor total;
- preço por item;
- marketplaces;
- economia;
- visual do conjunto.

---

# 12. Busca por orçamento

Uma experiência importante será começar pelo dinheiro disponível.

Exemplo:

> Tenho R$ 500.

A plataforma pode perguntar:

### Qual estilo você quer?

- vermelho;
- azul;
- preto;
- branco;
- roxo;
- colorido;
- surpresa.

### Quais armas são prioridade?

- AK-47;
- M4A1-S;
- M4A4;
- AWP;
- Glock;
- USP-S;
- Desert Eagle;
- todas.

Então gera combinações automaticamente.

---

# 13. Busca baseada em uma skin

Outra experiência interessante:

> Eu já tenho uma AK-47 Neon Rider. Monte um inventário combinando com ela.

A plataforma identifica:

- cores predominantes;
- estilo;
- faixa visual;
- skins semelhantes.

Depois sugere:

- Glock;
- USP-S;
- M4;
- AWP;
- Desert Eagle;
- knife;
- gloves.

---

# 14. Knife + Gloves

Um módulo específico poderá ser criado para combinações entre facas e luvas.

Exemplo:

> Butterfly Knife | Doppler

A plataforma mostra gloves que combinam visualmente.

O usuário também poderá fazer o contrário:

> Eu tenho Specialist Gloves | Crimson Kimono. Quais knives combinam?

---

# 15. Wishlist

O usuário poderá salvar skins.

Exemplo:

## Minha Wishlist

- AK-47 | Vulcan
- AWP | Asiimov
- M4A1-S | Printstream

Para cada item:

- preço atual;
- menor preço;
- marketplace;
- variação;
- preço desejado.

No futuro, o sistema poderá permitir alertas de preço.

Exemplo:

> Avise quando AK-47 | Vulcan Field-Tested ficar abaixo de R$ 400.

---

# 16. Histórico de preços

A plataforma poderá registrar preços ao longo do tempo.

Exemplo:

### AK-47 | Redline

- Hoje: R$ 82
- 7 dias: R$ 86
- 30 dias: R$ 91
- 90 dias: R$ 97

Isso permite mostrar:

- tendência;
- variação percentual;
- menor preço recente;
- maior preço recente.

O objetivo não é dizer ao usuário se ele deve comprar ou investir, mas apresentar dados que ajudem na comparação.

---

# 17. Página de uma skin

Estrutura possível:

## Header

- imagem;
- arma;
- nome;
- raridade;
- coleção.

## Seletor

- exterior;
- StatTrak;
- Souvenir.

## Preços

Tabela comparativa entre marketplaces.

## Histórico

Gráfico de preço.

## Informações

- coleção;
- raridade;
- exterior disponível;
- faixa de float.

## Skins semelhantes

Sugestões por:

- cor;
- preço;
- arma;
- estilo.

## Combina com

Outras skins para montar um inventário.

---

# 18. Página inicial

A home pode ser centrada em descoberta.

## Hero

> Encontre sua próxima skin pelo melhor preço.

Campo de busca:

`Pesquisar AK-47, AWP, knife, skin...`

Botões:

- Explorar skins
- Montar inventário

---

## Seções

### Trending skins

Skins populares no momento.

### Maiores diferenças de preço

Itens em que existe grande diferença entre Steam e marketplaces.

### Kits populares

- Red Loadout
- Black Loadout
- Purple Loadout
- Budget Loadout

### Monte por orçamento

- R$ 250
- R$ 500
- R$ 1.000
- R$ 2.500

### Explore por cor

Cards visuais para cada cor.

---

# 19. Perfis de usuário

Usuários registrados poderão ter:

- inventários salvos;
- kits salvos;
- wishlist;
- skins favoritas;
- histórico de builds;
- preferências;
- alertas.

---

# 20. Compartilhamento

Cada kit ou inventário poderá possuir uma URL pública.

Exemplo:

```text
/site/loadout/black-red-1500
```

O usuário poderá compartilhar o inventário com amigos.

Isso cria potencial de conteúdo e crescimento orgânico.

---

# 21. Kits da comunidade

Em uma evolução da plataforma, usuários poderão criar kits públicos.

Exemplo:

### Darth Vader Loadout

Criado por usuário123

- AK-47
- M4A1-S
- AWP
- Glock
- USP-S
- Knife
- Gloves

Outros usuários poderão:

- visualizar;
- salvar;
- copiar;
- avaliar;
- compartilhar.

---

# 22. Marketplaces

A plataforma poderá agregar preços de múltiplas fontes.

Exemplos possíveis:

- Steam Community Market;
- CSFloat;
- Skinport;
- DMarket;
- outros marketplaces que disponibilizem integração adequada.

Cada integração dependerá da API, termos de uso e disponibilidade de dados de cada serviço.

A plataforma deverá tratar cada marketplace como um **provider** independente.

Isso facilita adicionar ou remover integrações sem alterar o núcleo do sistema.

---

# 23. Atualização dos preços

Os preços precisam ter indicação clara de atualização.

Exemplo:

> Atualizado há 3 minutos.

A plataforma poderá manter:

- preço atual;
- timestamp;
- quantidade disponível;
- URL da oferta;
- marketplace;
- exterior;
- atributos adicionais.

---

# 24. Normalização de preços

Como cada marketplace pode utilizar moedas diferentes, o sistema deverá normalizar os valores.

Exemplo:

```text
USD → BRL
EUR → BRL
Steam BRL → BRL
```

Internamente, o sistema pode preservar:

- preço original;
- moeda original;
- preço convertido;
- taxa utilizada;
- momento da conversão.

---

# 25. Modelo conceitual de dados

Principais entidades:

## Skin

Representa o modelo da skin.

Exemplo:

```text
AK-47 | Redline
```

---

## Skin Variant

Representa uma versão específica.

Exemplo:

```text
AK-47 | Redline
Field-Tested
StatTrak: false
```

---

## Marketplace

Exemplo:

```text
CSFloat
Skinport
DMarket
Steam
```

---

## Listing / Price

Representa uma oferta ou preço encontrado.

```text
skin_variant
marketplace
price
currency
url
float
updated_at
```

---

## Loadout

Inventário criado por um usuário.

---

## Loadout Item

Uma skin dentro do inventário.

---

## Kit

Conjunto de skins criado pela plataforma ou comunidade.

---

## Wishlist

Itens monitorados pelo usuário.

---

# 26. Sistema de cores

As skins poderão receber classificação de cores predominantes.

Exemplo:

```text
AK-47 | Redline

Primary:
Red

Secondary:
Black
```

Isso permitirá buscas como:

> skins vermelhas

> skins vermelho + preto

> inventário predominantemente branco

Inicialmente, a classificação poderá ser cadastrada manualmente ou importada de uma base existente.

Em versões posteriores, poderá ser automatizada utilizando análise de imagem.

---

# 27. Sistema de estilos

Além da cor, skins poderão receber tags.

Exemplos:

- clean;
- dark;
- neon;
- anime;
- military;
- futuristic;
- colorful;
- minimal;
- cyberpunk;
- classic.

Essas tags melhoram muito o Discover e o Smart Loadout.

---

# 28. Algoritmo de kits

O sistema poderá montar kits considerando:

```text
budget
color
style
weapons
priority_weapons
exterior
marketplaces
```

Exemplo:

```text
budget = 1000
color = red
priority = [AK-47, AWP]
```

O algoritmo tenta maximizar:

- coerência visual;
- quantidade de armas;
- prioridade do usuário;
- uso do orçamento;
- custo-benefício.

---

# 29. Recomendações

A plataforma poderá recomendar skins relacionadas.

## Similaridade visual

> Pessoas vendo essa skin também podem gostar destas.

## Mesmo orçamento

Skins próximas do mesmo preço.

## Mesma cor

Skins com paleta semelhante.

## Mesmo estilo

Skins visualmente compatíveis.

## Combinação

Itens que combinam dentro de um loadout.

---

# 30. Diferença em relação a um marketplace

A plataforma **não possui inventário próprio**.

Não existe:

- saldo interno;
- depósito;
- saque;
- trade entre usuários;
- escrow;
- compra dentro da plataforma.

O fluxo será:

```text
Usuário
   ↓
Plataforma
   ↓
Compara ofertas
   ↓
Escolhe marketplace
   ↓
É direcionado para o site externo
```

Isso mantém o foco do produto em:

> descoberta + comparação + construção de inventário.

---

# 31. Possível monetização

A monetização poderá acontecer sem transformar a plataforma em marketplace.

## Links de afiliados

Quando um usuário clicar em uma oferta, o link pode utilizar programa de afiliados do marketplace, quando disponível.

---

## Publicidade

Espaços para parceiros relevantes ao ecossistema de CS2.

---

## Premium

Possíveis funcionalidades:

- mais alertas de preço;
- histórico avançado;
- analytics de inventário;
- Smart Loadout avançado;
- mais inventários salvos;
- ferramentas de comparação.

---

# 32. Diferenciais

O diferencial não deve ser apenas:

> comparar preço de skins.

O produto deve ser apresentado como:

> **a plataforma para descobrir, comparar e montar inventários de CS2.**

Principais diferenciais:

1. Comparação entre múltiplos marketplaces.
2. Comparação com Steam.
3. Exploração por cor.
4. Exploração por estilo.
5. Kits prontos.
6. Builder de inventário.
7. Smart Loadout.
8. Montagem por orçamento.
9. Otimização de onde comprar.
10. Combinação automática entre skins.
11. Wishlist e alertas.
12. Kits da comunidade.

---

# 33. MVP

A primeira versão não precisa implementar todo o conceito.

## MVP 1

### Catálogo

- listagem de skins;
- busca por nome;
- filtro por arma;
- filtro por preço;
- filtro por cor.

### Comparador

- página da skin;
- preços de diferentes marketplaces;
- preço Steam;
- link externo.

### Kits

- kits criados manualmente pela plataforma;
- categorias por cor;
- preço total.

### Builder

- selecionar armas;
- adicionar skin;
- visualizar total;
- visualizar menor preço.

### Conta

- salvar loadouts;
- favoritos.

---

# 34. Segunda fase

Depois da validação do MVP:

- Smart Loadout;
- kits automáticos;
- wishlist;
- alertas;
- histórico de preço;
- otimização por marketplace;
- comparação avançada;
- compartilhamento de inventários.

---

# 35. Terceira fase

Funcionalidades mais avançadas:

- float avançado;
- stickers;
- pattern;
- Doppler phases;
- Fade percentage;
- knives + gloves;
- skins raras;
- kits da comunidade;
- rankings de kits;
- recomendações personalizadas;
- análise visual automática.

---

# 36. Fluxos principais

## Fluxo 1 — Buscar skin

```text
Home
↓
Busca "AK Redline"
↓
Página da skin
↓
Seleciona Field-Tested
↓
Compara preços
↓
Escolhe marketplace
↓
Abre oferta externa
```

---

## Fluxo 2 — Descobrir skin

```text
Explore
↓
AK-47
↓
Cor vermelha
↓
Até R$ 150
↓
Lista de skins
↓
Skin escolhida
↓
Comparação de preços
```

---

## Fluxo 3 — Montar inventário

```text
Build
↓
Seleciona AK
↓
Seleciona skin
↓
Seleciona AWP
↓
Seleciona skin
↓
...
↓
Preço total
↓
Distribuição por marketplace
```

---

## Fluxo 4 — Smart Loadout

```text
Smart Loadout
↓
Orçamento
↓
Cor
↓
Estilo
↓
Armas prioritárias
↓
Sistema gera opções
↓
Usuário escolhe
↓
Salva ou compartilha
```

---

# 37. Exemplo da experiência ideal

Um usuário entra na plataforma sem saber quais skins comprar.

Ele informa:

```text
Orçamento:
R$ 700

Cor:
Preto + vermelho

Prioridade:
AK
AWP
USP

Knife:
Não
```

A plataforma retorna:

## Loadout 1 — Balanced

6 skins — R$ 681

## Loadout 2 — Rifle Focus

5 skins — R$ 697

## Loadout 3 — Full Inventory

9 skins — R$ 695

O usuário abre o Balanced.

A plataforma mostra:

```text
AK-47        R$ 180
AWP          R$ 170
M4A1-S       R$ 110
USP-S        R$ 70
Glock        R$ 61
Deagle       R$ 90

TOTAL        R$ 681
```

Depois mostra:

```text
Comprando tudo na Steam:
R$ 842

Comprando nos menores preços:
R$ 681

Economia:
R$ 161
```

E finalmente:

```text
CSFloat
3 itens
R$ 371

Skinport
2 itens
R$ 220

Steam
1 item
R$ 90
```

Esse fluxo representa a essência da plataforma.

---

# 38. Posicionamento

A plataforma não deve parecer apenas uma tabela de preços.

Ela deve comunicar:

> **Descubra skins. Monte seu inventário. Compare preços.**

ou:

> **Seu próximo inventário começa aqui.**

ou:

> **Monte o inventário que você quer pelo melhor preço disponível.**

---

# 39. Resumo do produto

A plataforma será um ecossistema de descoberta e comparação de skins para CS2.

O usuário poderá:

**SEARCH**

Encontrar uma skin específica e descobrir onde ela está mais barata.

**DISCOVER**

Explorar skins por arma, preço, cor, estilo e características.

**BUILD**

Montar um inventário completo e descobrir o menor custo possível.

**SMART LOADOUT**

Informar orçamento e preferências e receber sugestões automáticas de inventários.

O foco do produto não será simplesmente responder:

> Onde essa skin está mais barata?

Mas também:

> **Com o dinheiro que eu tenho, qual inventário eu consigo montar?**

Esse é o ponto que transforma a plataforma de um simples comparador de preços em uma ferramenta completa para jogadores e colecionadores de CS2.
