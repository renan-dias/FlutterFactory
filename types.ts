export interface Personality {
  id: string;
  name: string;
  prompt: {
    'pt-br': string;
    'en': string;
  };
}

export interface ProjectFile {
  path: string;
  content: string;
  explanation: string;
}

export interface LearningStep {
  title: string;
  explanation: string;
  diagram?: string;
  backendSuggestion?: string;
}

export interface GeminiProjectOutput {
  projectName: string;
  projectDescription: string;
  files: ProjectFile[];
  learningPath: LearningStep[];
}

export interface ProjectHistoryItem extends GeminiProjectOutput {
  prompt: {
    description: string;
    imagesData: { data: string; mimeType: string }[];
    personalityId: string;
  }
}

export interface FileTreeNode {
  name: string;
  path: string;
  children?: FileTreeNode[];
  content?: string;
  explanation?: string;
}
