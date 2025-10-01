
---

# 🛠️ FlutterFactory

**FlutterFactory** é uma ferramenta educacional interativa voltada para alunos do Técnico em Desenvolvimento de Sistemas. Ela combina inteligência artificial com prototipação visual para gerar e explicar projetos Flutter com base em imagens, descrições e esboços. O objetivo é promover aprendizado prático, acessível e criativo no desenvolvimento mobile.

---

## 🚀 Funcionalidades

- **Geração de código Flutter com explicações passo a passo**
- **Interface estilo IDE**
- **Entrada via texto, upload de imagens ou desenho em canvas**
- **Suporte a múltiplas imagens e protótipos**
- **Personalidades de instrutor (ex: Engenheiro do Google, divertido, técnico)**
- **Sugestões de backend (Firebase, Supabase, etc.)**
- **Internacionalização (PT-BR/EN) com prompts localizados**
- **Visualizador de código com syntax highlighting e rolagem**
- **Dicas de ferramentas de prototipação (Figma, Google Stitch, etc.)**

---

## 📦 Requisitos

- Node.js (v18 ou superior)
- Yarn ou npm
- Conta com acesso à API Gemini (Google AI Studio)
- Navegador moderno (Chrome, Edge, Firefox)

---

## 📥 Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/flutterfactory.git

# Acesse a pasta do projeto
cd flutterfactory

# Instale as dependências
yarn install
# ou
npm install
```

---

## ▶️ Execução

```bash
# Inicie o servidor de desenvolvimento
yarn dev
# ou
npm run dev
```

A aplicação estará disponível em `http://localhost:3000`.

---

## 🌐 Configuração de Idioma

Na tela inicial, selecione o idioma desejado no canto superior direito. Os prompts e respostas da IA serão adaptados automaticamente para PT-BR ou EN.

---

## 📁 Estrutura do Projeto

- `components/`: Componentes visuais (canvas, inputs, visualizador de código)
- `services/`: Integração com a API Gemini
- `constants.ts`: Configurações de tema e personalidades
- `App.tsx`: Composição principal da interface
- `types.ts`: Tipagens utilizadas no projeto

---

## 🧠 Recomendações de Uso

- Envie imagens de protótipos, esboços ou interfaces reais.
- Use o botão “i” para dicas sobre como prototipar com Figma ou capturar ideias.
- Experimente diferentes perfis de instrutor para adaptar o estilo de explicação.
- Explore a trilha de aprendizado sugerida pela IA para entender arquitetura e boas práticas.

---

## 📚 Licença

Este projeto é distribuído sob a licença MIT. Sinta-se livre para contribuir, adaptar e compartilhar.

---
