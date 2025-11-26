import { GoogleGenAI } from '@google/genai';
import { RESPONSE_SCHEMA } from '../constants';
import type { GeminiProjectOutput, Personality } from '../types';

const base64ToGeminiPart = (base64Data: string, mimeType: string) => {
  return {
    inlineData: {
      data: base64Data,
      mimeType,
    },
  };
};

export const generateFlutterProject = async (
  description: string,
  imagesData: { data: string; mimeType: string }[],
  personality: Personality,
  locale: 'pt-br' | 'en'
): Promise<GeminiProjectOutput> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set. Please configure it in your Vercel project settings.");
  }
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const parts: ({ text: string } | { inlineData: { data: string; mimeType: string } })[] = [{ text: `App Description: ${description}` }];

    if (imagesData.length > 0) {
      // Add images from last to first, so they appear in order in the prompt
      imagesData.slice().reverse().forEach(imageData => {
        parts.unshift(base64ToGeminiPart(imageData.data, imageData.mimeType));
      });
      parts.unshift({ text: "Here are some drawings, mockups, or reference images of the app I want to build:" });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        systemInstruction: personality.prompt[locale],
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    const jsonString = response.text?.trim();
    // Basic validation to ensure it's a JSON object
    if (!jsonString || !jsonString.startsWith('{') || !jsonString.endsWith('}')) {
       throw new Error('Invalid JSON response from API.');
    }
    const parsedResponse = JSON.parse(jsonString);
    return parsedResponse as GeminiProjectOutput;

  } catch (error: any) {
    console.error('Error generating project:', error);
    
    const errorMessage = error.message || JSON.stringify(error);

    if (errorMessage.includes('429') || errorMessage.includes('Quota exceeded') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
        const isPt = locale === 'pt-br';
        throw new Error(isPt 
            ? 'Limite de cota da API excedido. Isso pode ocorrer se você estiver no plano gratuito ou se a região não for suportada. Aguarde um momento e tente novamente.' 
            : 'API quota exceeded. This can happen if you are on the free tier or the region is not supported. Please wait a moment and try again.');
    }

    throw new Error(locale === 'pt-br' ? 'Falha ao gerar o projeto. Verifique sua chave de API.' : 'Failed to generate project. Check your API key.');
  }
};

export const generateTutorialHtml = async (
  project: GeminiProjectOutput,
  personality: Personality,
  locale: 'pt-br' | 'en'
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
  }
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const projectContext = `
    Project Name: ${project.projectName}
    Description: ${project.projectDescription}
    Files:
    ${project.files.map(f => `--- File: ${f.path} ---\n${f.content}\n--- End File ---`).join('\n\n')}
    Learning Path:
    ${project.learningPath.map((step, i) => `${i+1}. ${step.title}\n${step.explanation}`).join('\n')}
  `;

  const prompt = locale === 'pt-br' ? 
    `Sua personalidade é a de ${personality.name}. Baseado no seguinte contexto de projeto Flutter, gere um tutorial EXTREMAMENTE DETALHADO em HTML para um arquivo PDF. O tutorial deve ser um guia completo para um desenvolvedor iniciante, do zero até o projeto finalizado.

O tutorial DEVE incluir as seguintes seções, nesta ordem:

1.  **Introdução:** Uma breve boas-vindas e uma visão geral do que será construído.
2.  **Pré-requisitos:** Liste o que o desenvolvedor precisa ter instalado (Flutter SDK, VS Code com extensões Flutter e Dart).
3.  **Configurando o Projeto no VS Code:**
    *   Instruções passo a passo sobre como criar um novo projeto Flutter usando a paleta de comandos do VS Code (Ctrl+Shift+P -> Flutter: New Project).
    *   Instruções para nomear o projeto (use o nome "${project.projectName}").
4.  **Estrutura de Pastas:**
    *   Explique a estrutura de pastas inicial gerada pelo Flutter.
    *   Mostre a estrutura de pastas final para este projeto específico (ex: criando \`lib/screens\`, \`lib/widgets\`, \`lib/providers\`, etc.) e explique o propósito de cada pasta.
5.  **Dependências (pubspec.yaml):**
    *   Explique o que é o arquivo \`pubspec.yaml\`.
    *   Liste TODAS as dependências necessárias para este projeto (ex: \`provider\`, \`shared_preferences\`, etc.) e suas versões aproximadas.
    *   Mostre o bloco \`dependencies:\` completo do \`pubspec.yaml\` que o usuário deve usar.
    *   Instrua o usuário a rodar \`flutter pub get\`.
6.  **Codificando o Aplicativo (Passo a Passo):**
    *   Para CADA arquivo do projeto (de \`main.dart\` aos modelos, widgets, telas, etc.):
        *   **Antes do código:** Forneça uma explicação clara do propósito do arquivo. O que esta classe fará? Qual é o seu papel no aplicativo?
        *   **O código completo:** Apresente o código completo do arquivo dentro de um bloco \`<pre><code>\`. O código deve ser bem comentado.
        *   **Depois do código:** Se necessário, adicione uma explicação adicional sobre partes importantes ou complexas do código que acabaram de ser apresentadas.
7.  **Conclusão:** Um resumo do que foi aprendido e sugestões para próximos passos.

O HTML deve ser um documento único e bem formatado, pronto para impressão. Use tags como <h1>, <h2>, <h3>, <p>, <pre><code>, <ul>, <li>, <strong>, etc. Não inclua tags <html>, <head> ou <body>, apenas o conteúdo interno para ser injetado.

Contexto do Projeto:
${projectContext}` :
    `Your personality is that of ${personality.name}. Based on the following Flutter project context, generate an EXTREMELY DETAILED tutorial in HTML format for a PDF file. The tutorial must be a complete guide for a beginner developer, from scratch to the finished project.

The tutorial MUST include the following sections, in this order:

1.  **Introduction:** A brief welcome and an overview of what will be built.
2.  **Prerequisites:** List what the developer needs to have installed (Flutter SDK, VS Code with Flutter and Dart extensions).
3.  **Setting up the Project in VS Code:**
    *   Step-by-step instructions on how to create a new Flutter project using the VS Code command palette (Ctrl+Shift+P -> Flutter: New Project).
    *   Instructions to name the project (use the name "${project.projectName}").
4.  **Folder Structure:**
    *   Explain the initial folder structure generated by Flutter.
    *   Show the final folder structure for this specific project (e.g., creating \`lib/screens\`, \`lib/widgets\`, \`lib/providers\`, etc.) and explain the purpose of each folder.
5.  **Dependencies (pubspec.yaml):**
    *   Explain what the \`pubspec.yaml\` file is.
    *   List ALL necessary dependencies for this project (e.g., \`provider\`, \`shared_preferences\`, etc.) and their approximate versions.
    *   Show the complete \`dependencies:\` block from \`pubspec.yaml\` that the user should use.
    *   Instruct the user to run \`flutter pub get\`.
6.  **Coding the Application (Step-by-Step):**
    *   For EACH file in the project (from \`main.dart\` to models, widgets, screens, etc.):
        *   **Before the code:** Provide a clear explanation of the file's purpose. What will this class do? What is its role in the application?
        *   **The full code:** Present the complete code for the file inside a \`<pre><code>\` block. The code should be well-commented.
        *   **After the code:** If necessary, add additional explanations about important or complex parts of the code that were just presented.
7.  **Conclusion:** A summary of what was learned and suggestions for next steps.

The HTML should be a single, well-formatted document ready for printing. Use tags like <h1>, <h2>, <h3>, <p>, <pre><code>, <ul>, <li>, <strong>, etc. Do not include <html>, <head>, or <body> tags, just the inner content to be injected.

Project Context:
${projectContext}`;

  try {
    // Using gemini-2.5-flash which is generally more available and has higher free tier quotas than pro models
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', 
      contents: prompt,
    });
    return response.text || '';
  } catch (error: any) {
    console.error('Error generating tutorial:', error);
    
    const errorMessage = error.message || JSON.stringify(error);
    if (errorMessage.includes('429') || errorMessage.includes('Quota exceeded')) {
        throw new Error(locale === 'pt-br' 
            ? 'Limite de cota excedido ao gerar o tutorial. Tente novamente em alguns instantes.' 
            : 'Quota exceeded while generating tutorial. Please try again later.');
    }
    
    throw new Error('Failed to generate tutorial content.');
  }
};
