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

    const jsonString = response.text.trim();
    // Basic validation to ensure it's a JSON object
    if (!jsonString.startsWith('{') || !jsonString.endsWith('}')) {
       throw new Error('Invalid JSON response from API.');
    }
    const parsedResponse = JSON.parse(jsonString);
    return parsedResponse as GeminiProjectOutput;

  } catch (error) {
    console.error('Error generating project:', error);
    throw new Error('Failed to generate project. Please check your API key and try again.');
  }
};
