import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { GoogleGenAI, Chat } from '@google/genai';
import type { GeminiProjectOutput, Personality, ProjectFile, FileTreeNode } from './types';
import { PERSONALITIES } from './constants';
import { generateFlutterProject, generateTutorialHtml } from './services/geminiService';
import { Icon } from './components/Icon';
import { InputCanvas } from './components/InputCanvas';

// --- i18n ---
const translations = {
  'pt-br': {
    title: 'Flutter',
    title_factory: 'Factory',
    subtitle: 'Descreva e esboce sua ideia de aplicativo. Nossa IA, inspirada no TARS, irá gerar o projeto Flutter completo e guiá-lo em sua construção.',
    visualize_app: '1. Visualize seu App',
    describe_app: '2. Descreva seu App',
    choose_instructor: '3. Escolha seu Instrutor',
    generate: 'GERAR',
    error_empty_input: 'Forneça uma descrição ou uma imagem.',
    loading_title: 'GERANDO PROJETO',
    loading_subtitle: 'TARS está analisando seu conceito... \n Montando a arquitetura Flutter... \n Escrevendo o código base... Por favor, aguarde.',
    new_project: 'Novo Projeto',
    explorer: 'Explorador',
    select_file_prompt: 'Selecione um arquivo para ver seu conteúdo',
    file_explanation: 'Análise do Arquivo',
    learning_path: 'Trilha de Aprendizagem',
    no_file_selected: 'Nenhum arquivo selecionado',
    analysis_of: 'Análise',
    select_file_for_analysis: 'Selecione um arquivo para ver a análise do TARS sobre seu propósito e código.',
    project_mission: 'Missão do Projeto',
    personality_tars_name: 'TARS (Interestelar)',
    personality_google_name: 'Engenheiro(a) Google',
    personality_fun_name: 'Desenvolvedor(a) Criativo',
    draw: 'Desenhar',
    upload: 'Carregar',
    paste: 'Colar',
    clear: 'Limpar',
    input_placeholder: 'Ex: "Um app de lista de tarefas simples com categorias. Usuários podem adicionar, marcar e deletar tarefas. Quero um design limpo e minimalista."',
    upload_prompt: 'Arraste e solte ou clique para carregar',
    select_file: 'Selecionar Arquivo',
    paste_prompt: 'Pressione Ctrl+V para colar uma imagem.',
    draw_in_modal_title: 'Desenhe o Mockup do seu App',
    close: 'Fechar',
    save_drawing: 'Salvar Desenho',
    visualize_info: 'Use ferramentas como Figma, Sketch, ou até mesmo a foto de um rascunho em um guardanapo para enviar o protótipo do seu app.',
    backend_suggestion: 'Sugestão de Backend',
    project_history: 'Histórico de Projetos',
    clear_history: 'Limpar Histórico',
    chat: 'Chat',
    export_pdf: 'Exportar PDF',
    generating_pdf: 'Gerando...',
    ask_for_changes: 'Peça por alterações...',
    apply_changes: 'Aplicar Alterações',
    ai_suggestion: 'IA sugere uma atualização para',
  },
  'en': {
    title: 'Flutter',
    title_factory: 'Factory',
    subtitle: 'Describe and sketch your app idea. Our AI, inspired by TARS, will generate the complete Flutter project and guide you through building it.',
    visualize_app: '1. Visualize Your App',
    describe_app: '2. Describe Your App',
    choose_instructor: '3. Choose Your Instructor',
    generate: 'GENERATE',
    error_empty_input: 'Please provide a description or an image.',
    loading_title: 'GENERATING PROJECT',
    loading_subtitle: 'TARS is analyzing your concept... \n Assembling Flutter architecture... \n Writing boilerplate... Please wait.',
    new_project: 'New Project',
    explorer: 'Explorer',
    select_file_prompt: 'Select a file to view its content',
    file_explanation: 'File Explanation',
    learning_path: 'Learning Path',
    no_file_selected: 'No file selected',
    analysis_of: 'Analysis',
    select_file_for_analysis: 'Select a file to see TARS\'s explanation of its purpose and code.',
    project_mission: 'Project Mission',
    personality_tars_name: 'TARS (Interstellar)',
    personality_google_name: 'Precise Google Engineer',
    personality_fun_name: 'Fun & Creative Dev',
    draw: 'Draw',
    upload: 'Upload',
    paste: 'Paste',
    clear: 'Clear',
    input_placeholder: 'e.g., "A simple to-do list app with categories. Users can add, check off, and delete tasks. I want a clean, minimalist design."',
    upload_prompt: 'Drag & drop or click to upload',
    select_file: 'Select File',
    paste_prompt: 'Press Ctrl+V to paste an image.',
    draw_in_modal_title: 'Draw Your App Mockup',
    close: 'Close',
    save_drawing: 'Save Drawing',
    visualize_info: 'Use tools like Figma, Sketch, or even a photo of a napkin sketch to upload your app prototype.',
    backend_suggestion: 'Backend Suggestion',
    project_history: 'Project History',
    clear_history: 'Clear History',
    chat: 'Chat',
    export_pdf: 'Export PDF',
    generating_pdf: 'Generating...',
    ask_for_changes: 'Ask for changes...',
    apply_changes: 'Apply Changes',
    ai_suggestion: 'AI suggests an update for',
  },
};

type Locale = keyof typeof translations;
type TranslationKey = keyof (typeof translations)['pt-br'];

const LanguageContext = React.createContext<{ t: (key: TranslationKey) => string; setLocale: (locale: Locale) => void; locale: Locale; }>({
  t: (key: TranslationKey) => key,
  setLocale: () => {},
  locale: 'pt-br',
});

const useTranslation = () => React.useContext(LanguageContext);

// --- Diff Logic ---
type DiffLine = {
  content: string;
  type: 'added' | 'removed' | 'common';
};

const calculateDiff = (oldText: string, newText: string): DiffLine[] => {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const n = oldLines.length;
    const m = newLines.length;
    const lcsMatrix = Array(n + 1).fill(0).map(() => Array(m + 1).fill(0));

    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            if (oldLines[i - 1] === newLines[j - 1]) {
                lcsMatrix[i][j] = 1 + lcsMatrix[i - 1][j - 1];
            } else {
                lcsMatrix[i][j] = Math.max(lcsMatrix[i - 1][j], lcsMatrix[i][j - 1]);
            }
        }
    }

    const diff: DiffLine[] = [];
    let i = n, j = m;
    
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            diff.push({ content: newLines[j - 1], type: 'common' });
            i--; j--;
        } else if (j > 0 && (i === 0 || lcsMatrix[i][j - 1] >= lcsMatrix[i - 1][j])) {
            diff.push({ content: newLines[j - 1], type: 'added' });
            j--;
        } else if (i > 0 && (j === 0 || lcsMatrix[i][j - 1] < lcsMatrix[i - 1][j])) {
            diff.push({ content: oldLines[i - 1], type: 'removed' });
            i--;
        }
    }

    return diff.reverse();
};


// --- Main App ---
const App: React.FC = () => {
    const [view, setView] = useState<'input' | 'output'>('input');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedProject, setGeneratedProject] = useState<GeminiProjectOutput | null>(null);
    const [history, setHistory] = useState<GeminiProjectOutput[]>([]);

    const [description, setDescription] = useState('');
    const [personality, setPersonality] = useState<Personality>(PERSONALITIES[0]);
    const [imagesData, setImagesData] = useState<{ data: string, mimeType: string }[]>([]);

    const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
    const [locale, setLocale] = useState<Locale>('pt-br');
    const [lastChangeInfo, setLastChangeInfo] = useState<{ filePath: string; oldContent: string } | null>(null);


    useEffect(() => {
        try {
            const storedHistory = localStorage.getItem('flutterFactoryHistory');
            if (storedHistory) {
                setHistory(JSON.parse(storedHistory));
            }
        } catch (error) {
            console.error("Failed to load history from localStorage", error);
            setHistory([]);
        }
    }, []);

    const t = useCallback((key: TranslationKey) => {
        return translations[locale][key] || translations['en'][key] || key;
    }, [locale]);

    const handleGenerate = async () => {
        if (!description && imagesData.length === 0) {
            setError(t('error_empty_input'));
            return;
        }
        setIsLoading(true);
        setError(null);
        setGeneratedProject(null);
        try {
            const project = await generateFlutterProject(description, imagesData, personality, locale);
            setGeneratedProject(project);
            
            setHistory(prevHistory => {
                const newHistory = [project, ...prevHistory.filter(p => p.projectName !== project.projectName)].slice(0, 10); // Keep latest 10, prevent duplicates
                localStorage.setItem('flutterFactoryHistory', JSON.stringify(newHistory));
                return newHistory;
            });

            if (project.files.length > 0) {
              const mainFile = project.files.find(f => f.path.endsWith('main.dart')) || project.files[0];
              setSelectedFile(mainFile);
            }
            setView('output');
        } catch (err: any) {
            setError(err.message || 'An unknown error occurred.');
            setView('input');
        } finally {
            setIsLoading(false);
        }
    };

    const handleReturnToInput = () => {
      setGeneratedProject(null);
      setSelectedFile(null);
      setDescription('');
      setImagesData([]);
      setError(null);
      setLastChangeInfo(null);
      setView('input');
    }

    const handleLoadProject = (projectToLoad: GeminiProjectOutput) => {
        setGeneratedProject(projectToLoad);
        if (projectToLoad.files.length > 0) {
            const mainFile = projectToLoad.files.find(f => f.path.endsWith('main.dart')) || projectToLoad.files[0];
            setSelectedFile(mainFile);
        } else {
            setSelectedFile(null);
        }
        setLastChangeInfo(null);
        setView('output');
    };

    const handleClearHistory = () => {
        setHistory([]);
        localStorage.removeItem('flutterFactoryHistory');
    };
    
    const handleDeleteHistoryItem = (projectName: string) => {
        setHistory(prevHistory => {
            const newHistory = prevHistory.filter(p => p.projectName !== projectName);
            localStorage.setItem('flutterFactoryHistory', JSON.stringify(newHistory));
            return newHistory;
        });
    };
    
    const handleFileSelect = (file: ProjectFile) => {
        if (lastChangeInfo && file.path !== lastChangeInfo.filePath) {
            setLastChangeInfo(null);
        }
        setSelectedFile(file);
    };


    const fileTree = useMemo(() => {
        if (!generatedProject) return null;
        const root: FileTreeNode = { name: 'root', path: '', children: [] };
        const getOrCreateNode = (path: string[]): FileTreeNode => {
            let currentLevel = root.children!;
            let currentPath = '';
            let node: FileTreeNode | undefined;
            for (const part of path) {
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                node = currentLevel.find(child => child.name === part);
                if (!node) {
                    node = { name: part, path: currentPath, children: part.includes('.') ? undefined : [] };
                    currentLevel.push(node);
                }
                if (node.children) { currentLevel = node.children; }
            }
            return node!;
        };
        for (const file of generatedProject.files) {
            const parts = file.path.split('/');
            const fileName = parts.pop()!;
            const parentNode = getOrCreateNode(parts);
            if (parentNode) {
              const fileNode: FileTreeNode = { name: fileName, path: file.path, content: file.content, explanation: file.explanation };
              if (parentNode.children) { parentNode.children.push(fileNode); }
              else { parentNode.children = [fileNode]; }
            }
        }
        const sortNodes = (nodes: FileTreeNode[]) => {
            nodes.sort((a, b) => {
                if (a.children && !b.children) return -1;
                if (!a.children && b.children) return 1;
                return a.name.localeCompare(b.name);
            });
            nodes.forEach(node => { if(node.children) sortNodes(node.children); });
        };
        sortNodes(root.children!);
        return root;
    }, [generatedProject]);


    if (isLoading) {
      return (
        <LanguageContext.Provider value={{ t, setLocale, locale }}>
            <LoadingScreen />
        </LanguageContext.Provider>
      );
    }

    return (
        <LanguageContext.Provider value={{ t, setLocale, locale }}>
            <div className="min-h-screen bg-blueprint-bg font-mono">
                {view === 'input' && <InputView onGenerate={handleGenerate} description={description} setDescription={setDescription} personality={personality} setPersonality={setPersonality} imagesData={imagesData} setImagesData={setImagesData} error={error} history={history} onLoadProject={handleLoadProject} onClearHistory={handleClearHistory} onDeleteItem={handleDeleteHistoryItem}/>}
                {view === 'output' && generatedProject && fileTree && <OutputView project={generatedProject} setProject={setGeneratedProject} personality={personality} fileTree={fileTree} selectedFile={selectedFile} setSelectedFile={handleFileSelect} onReturn={handleReturnToInput} lastChangeInfo={lastChangeInfo} setLastChangeInfo={setLastChangeInfo} />}
            </div>
        </LanguageContext.Provider>
    );
};

// --- Child Components ---

const SnakeGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gridSize = 20;
    let canvasSize = { width: window.innerWidth, height: window.innerHeight };
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    let snake = [{ x: 10, y: 10 }];
    let food = { x: 15, y: 15 };
    let direction = { x: 1, y: 0 };
    let foodEaten = true;

    function randomFoodPosition() {
        food.x = Math.floor(Math.random() * (canvas.width / gridSize));
        food.y = Math.floor(Math.random() * (canvas.height / gridSize));
    }

    function main() {
        setTimeout(() => {
            clearCanvas();
            drawFood();
            moveSnake();
            drawSnake();
        }, 100);
    }

    function clearCanvas() {
        ctx.fillStyle = '#0a192f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function drawSnakePart(part: {x: number, y: number}) {
        ctx.fillStyle = '#64ffda';
        ctx.strokeStyle = '#0a192f';
        ctx.fillRect(part.x * gridSize, part.y * gridSize, gridSize, gridSize);
        ctx.strokeRect(part.x * gridSize, part.y * gridSize, gridSize, gridSize);
    }
    
    function drawSnake() {
        snake.forEach(drawSnakePart);
    }

    function drawFood() {
        if(foodEaten) {
            randomFoodPosition();
            foodEaten = false;
        }
        ctx.fillStyle = '#64ffda';
        ctx.fillRect(food.x * gridSize, food.y * gridSize, gridSize, gridSize);
    }

    function moveSnake() {
        const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
        snake.unshift(head);

        if (head.x === food.x && head.y === food.y) {
            foodEaten = true;
        } else {
            snake.pop();
        }
        
        if (Math.random() < 0.1) {
            const directions = [{x: 0, y: 1}, {x: 0, y: -1}, {x: 1, y: 0}, {x: -1, y: 0}];
            const newDir = directions[Math.floor(Math.random() * directions.length)];
            if (snake.length === 1 || (newDir.x !== -direction.x && newDir.y !== -direction.y)) {
                direction = newDir;
            }
        }
        
        if (head.x * gridSize >= canvas.width) head.x = 0;
        if (head.x < 0) head.x = Math.floor(canvas.width / gridSize) -1;
        if (head.y * gridSize >= canvas.height) head.y = 0;
        if (head.y < 0) head.y = Math.floor(canvas.height / gridSize) -1;
    }

    const intervalId = setInterval(main, 100);
    return () => clearInterval(intervalId);
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-30" />;
}

const LoadingScreen: React.FC = () => {
    const { t } = useTranslation();
    return (
      <div className="fixed inset-0 bg-blueprint-bg flex flex-col items-center justify-center z-50 overflow-hidden">
        <SnakeGame />
        <div className="z-10 text-center">
            <h2 className="text-2xl text-blueprint-line font-bold mb-2 tracking-widest">{t('loading_title')}</h2>
            <p className="text-blueprint-text-light whitespace-pre-wrap">{t('loading_subtitle')}</p>
        </div>
      </div>
    );
}

const LanguageSwitcher = () => {
    const { locale, setLocale } = useTranslation();
    const switchLang = (lang: Locale) => {
        setLocale(lang);
    };
    return (
        <div className="absolute top-4 right-4 flex gap-2 border border-blueprint-border rounded-md p-1">
            <button onClick={() => switchLang('pt-br')} className={`px-3 py-1 text-sm rounded-md transition-colors ${locale === 'pt-br' ? 'bg-blueprint-line text-blueprint-bg' : 'text-blueprint-text-dark hover:text-blueprint-text-light'}`}>PT-BR</button>
            <button onClick={() => switchLang('en')} className={`px-3 py-1 text-sm rounded-md transition-colors ${locale === 'en' ? 'bg-blueprint-line text-blueprint-bg' : 'text-blueprint-text-dark hover:text-blueprint-text-light'}`}>EN</button>
        </div>
    )
}

interface InputViewProps {
  onGenerate: () => void;
  description: string;
  setDescription: (val: string) => void;
  personality: Personality;
  setPersonality: (p: Personality) => void;
  imagesData: { data: string, mimeType: string }[];
  setImagesData: (data: { data: string, mimeType: string }[]) => void;
  error: string | null;
  history: GeminiProjectOutput[];
  onLoadProject: (project: GeminiProjectOutput) => void;
  onClearHistory: () => void;
  onDeleteItem: (projectName: string) => void;
}
const InputView: React.FC<InputViewProps> = ({ onGenerate, description, setDescription, personality, setPersonality, imagesData, setImagesData, error, history, onLoadProject, onClearHistory, onDeleteItem }) => {
    const { t } = useTranslation();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    
    const addImageData = useCallback((newData: { data: string, mimeType: string }) => {
        setImagesData(prev => [...prev, newData]);
    }, [setImagesData]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            for (let i = 0; i < files.length; i++) {
                const file = files.item(i);
                if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const result = reader.result;
                        if (typeof result === 'string') {
                            const base64String = result.split(',')[1];
                            if (base64String) {
                                addImageData({ data: base64String, mimeType: file.type });
                            }
                        }
                    };
                    reader.readAsDataURL(file);
                }
            }
        }
    };
    
    const onCanvasDraw = (dataUrl: string) => {
        if(!dataUrl) return;
        const base64String = dataUrl.split(',')[1];
        if (base64String) {
            addImageData({ data: base64String, mimeType: 'image/png'});
        }
    };

    const handlePaste = useCallback((e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const blob = item.getAsFile();
                
                if (blob) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const result = event.target?.result;
                        if (typeof result === 'string') {
                            const base64String = result.split(',')[1];
                            if(base64String) {
                                addImageData({ data: base64String, mimeType: blob.type });
                            }
                        }
                    };
                    reader.readAsDataURL(blob);
                    e.preventDefault();
                    return;
                }
            }
        }
    }, [addImageData]);

    useEffect(() => {
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [handlePaste]);
    
    const removeImage = (indexToRemove: number) => {
        setImagesData(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    return (
        <div className="flex h-screen">
            {/* Left History Panel */}
            <aside className="w-80 bg-blueprint-bg-light border-r border-blueprint-border flex flex-col p-4">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-blueprint-text-dark">{t('project_history')}</h2>
                    {history.length > 0 && (
                        <button
                            onClick={onClearHistory}
                            className="flex items-center gap-2 px-3 py-1 text-xs transition-colors border border-blueprint-border text-blueprint-text-dark hover:bg-red-500/20 hover:text-red-400 rounded-md"
                        >
                            <Icon type="trash" className="w-3 h-3" />
                            {t('clear_history')}
                        </button>
                    )}
                </div>
                <div className="flex-grow overflow-y-auto -mr-2 pr-2">
                    {history.length > 0 ? (
                        <ul className="space-y-3">
                            {history.map((project) => (
                                <li key={project.projectName} className="group">
                                    <button
                                        onClick={() => onLoadProject(project)}
                                        className="w-full text-left p-3 rounded-md bg-blueprint-bg border border-blueprint-border hover:border-blueprint-line/50 transition-colors"
                                    >
                                        <div className="flex justify-between items-start">
                                            <p className="font-semibold text-blueprint-text-light break-words pr-2">{project.projectName}</p>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDeleteItem(project.projectName); }}
                                                className="ml-2 p-1 rounded-full text-blueprint-text-dark hover:bg-red-500/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                                aria-label={`Delete ${project.projectName}`}
                                            >
                                                <Icon type="trash" className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <p className="text-xs text-blueprint-text-dark truncate mt-1">{project.projectDescription}</p>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="h-full flex items-center justify-center text-center text-xs text-blueprint-text-dark px-4">
                            <p>Os projetos que você gerar aparecerão aqui.</p>
                        </div>
                    )}
                </div>
            </aside>

            {/* Right Main Panel */}
            <main className="flex-grow flex flex-col items-center justify-center p-8 overflow-y-auto relative">
                <LanguageSwitcher />
                <div className="w-full max-w-4xl">
                  <div className="text-center">
                    <h1 className="text-5xl font-bold mb-2 text-blueprint-text-light">{t('title')}<span className="text-blueprint-line">{t('title_factory')}</span></h1>
                    <p className="text-blueprint-text-dark mb-8 max-w-2xl mx-auto">{t('subtitle')}</p>
                  </div>
                  
                  <div className="w-full bg-blueprint-bg-light/50 p-6 rounded-lg border border-blueprint-border shadow-2xl space-y-6">
                      
                      <div className="space-y-2">
                          <div className="flex items-center gap-2 group relative">
                              <h2 className="text-sm font-bold uppercase tracking-wider text-blueprint-text-dark">{t('visualize_app')}</h2>
                              <Icon type="info" className="w-4 h-4 text-blueprint-text-dark cursor-pointer"/>
                              <div className="absolute bottom-full left-0 mb-2 w-64 bg-blueprint-bg-light border border-blueprint-border text-blueprint-text-light text-xs rounded-md p-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                  {t('visualize_info')}
                              </div>
                          </div>
                          <div className="bg-blueprint-bg p-3 rounded-md border-2 border-dashed border-blueprint-border min-h-[200px] w-full flex items-center justify-center relative">
                              {imagesData.length > 0 ? (
                                  <div className="flex flex-wrap gap-4 p-2 justify-center">
                                      {imagesData.map((img, index) => (
                                          <div key={index} className="relative w-32 h-32 rounded-md overflow-hidden border border-blueprint-border">
                                              <img src={`data:${img.mimeType};base64,${img.data}`} alt={`Mockup ${index + 1}`} className="w-full h-full object-cover"/>
                                              <button onClick={() => removeImage(index)} className="absolute top-1 right-1 p-1 rounded-full bg-red-600/80 hover:bg-red-500 text-white transition-colors">
                                                  <Icon type="trash" className="w-4 h-4" />
                                              </button>
                                          </div>
                                      ))}
                                  </div>
                              ) : (
                                  <div className="text-center text-blueprint-text-dark">
                                      <Icon type="image" className="w-16 h-16 mx-auto mb-2"/>
                                      <p className="text-sm">{t('draw')}, {t('upload').toLowerCase()} ou {t('paste').toLowerCase()} uma ou mais imagens.</p>
                                  </div>
                              )}
                          </div>
                      </div>

                      <div className="flex flex-col gap-4">
                           <textarea
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              placeholder={t('input_placeholder')}
                              className="bg-blueprint-bg border border-blueprint-border rounded-md p-3 w-full text-blueprint-text-light focus:outline-none focus:ring-2 focus:ring-blueprint-line resize-none"
                              rows={5}
                          />
                          <div className="flex items-center justify-between gap-2">
                              <div className="flex gap-2">
                                  <button onClick={() => setIsDrawing(true)} className="flex items-center gap-2 px-4 py-2 text-sm transition-colors border border-blueprint-border text-blueprint-text-dark hover:bg-blueprint-border hover:text-blueprint-text-light rounded-md">
                                      <Icon type={'draw'} className="w-4 h-4" /> {t('draw')}
                                  </button>
                                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 text-sm transition-colors border border-blueprint-border text-blueprint-text-dark hover:bg-blueprint-border hover:text-blueprint-text-light rounded-md">
                                      <Icon type={'upload'} className="w-4 h-4" /> {t('upload')}
                                  </button>
                                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" multiple />
                              </div>
                              <div className="text-sm text-blueprint-text-dark">{t('paste_prompt')}</div>
                          </div>
                      </div>

                      <div>
                           <h2 className="text-sm font-bold mb-2 uppercase tracking-wider text-blueprint-text-dark">{t('choose_instructor')}</h2>
                          <select
                              value={personality.id}
                              onChange={(e) => setPersonality(PERSONALITIES.find(p => p.id === e.target.value)!)}
                              className="bg-blueprint-bg border border-blueprint-border rounded-md p-3 w-full text-blueprint-text-light focus:outline-none focus:ring-2 focus:ring-blueprint-line"
                          >
                              {PERSONALITIES.map(p => <option key={p.id} value={p.id}>{t(p.name as TranslationKey)}</option>)}
                          </select>
                      </div>

                      <div className="pt-2">
                          {error && <p className="text-red-400 text-center mb-4">{error}</p>}
                          <button
                              onClick={onGenerate}
                              className="w-full bg-blueprint-line text-blueprint-bg font-bold py-4 rounded-md text-lg tracking-widest hover:brightness-110 transition-all transform hover:scale-[1.02]"
                          >
                              {t('generate')}
                          </button>
                      </div>
                  </div>
                </div>
            </main>

            {isDrawing && 
                <DrawModal onClose={() => setIsDrawing(false)} onSave={onCanvasDraw} />
            }
        </div>
    );
};

const DrawModal: React.FC<{onClose: () => void, onSave: (data: string) => void}> = ({onClose, onSave}) => {
    const { t } = useTranslation();
    const [tempDataUrl, setTempDataUrl] = useState('');

    const handleSave = () => {
        onSave(tempDataUrl);
        onClose();
    }

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-blueprint-bg-light border border-blueprint-border rounded-lg shadow-xl p-6 w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-4 text-blueprint-text-light">{t('draw_in_modal_title')}</h3>
                <div className="aspect-video bg-blueprint-bg rounded-md overflow-hidden">
                    <InputCanvas width={800} height={450} onDraw={setTempDataUrl} />
                </div>
                <div className="flex justify-end gap-4 mt-4">
                    <button onClick={onClose} className="px-4 py-2 rounded-md text-blueprint-text-dark border border-blueprint-border hover:bg-blueprint-border hover:text-blueprint-text-light transition-colors">{t('close')}</button>
                    <button onClick={handleSave} className="px-4 py-2 rounded-md bg-blueprint-line text-blueprint-bg font-bold hover:brightness-110 transition-colors">{t('save_drawing')}</button>
                </div>
            </div>
        </div>
    )
}

interface OutputViewProps {
    project: GeminiProjectOutput;
    setProject: (project: GeminiProjectOutput) => void;
    personality: Personality;
    fileTree: FileTreeNode;
    selectedFile: ProjectFile | null;
    setSelectedFile: (file: ProjectFile) => void;
    onReturn: () => void;
    lastChangeInfo: { filePath: string; oldContent: string } | null;
    setLastChangeInfo: (info: { filePath: string; oldContent: string } | null) => void;
}
const OutputView: React.FC<OutputViewProps> = ({ project, setProject, personality, fileTree, selectedFile, setSelectedFile, onReturn, lastChangeInfo, setLastChangeInfo }) => {
    const { t, locale } = useTranslation();
    const [activeTab, setActiveTab] = useState<'analysis' | 'learning' | 'chat'>('analysis');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [chatMessages, setChatMessages] = useState<{role: 'user' | 'model', content: string}[]>([]);
    const [isAwaitingResponse, setIsAwaitingResponse] = useState(false);
    const chatInstance = useRef<Chat | null>(null);

    useEffect(() => {
        if (!process.env.API_KEY) return;
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const chatSystemInstruction = `${personality.prompt[locale]} You have already generated a Flutter project. Now, act as a conversational assistant to help modify it. When asked to change a file, YOU MUST respond with ONLY a JSON object in a markdown code block: { "filePath": "path/to/file.dart", "newContent": "..." }. For all other conversation, respond normally.`;
        
        chatInstance.current = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: { systemInstruction: chatSystemInstruction },
        });
        setChatMessages([]);
        setActiveTab('analysis');
    }, [project, personality, locale]);
    
    useEffect(() => {
      setActiveTab('analysis');
    }, [selectedFile]);

    const handleExportPdf = async () => {
        setIsGeneratingPdf(true);
        try {
            const htmlContent = await generateTutorialHtml(project, personality, locale);
            const printArea = document.getElementById('print-area');
            if (printArea) {
                printArea.innerHTML = `<div id="print-content">${htmlContent}</div>`;
                
                const originalTitle = document.title;
                document.title = `${project.projectName} Tutorial`; // Set title for PDF filename suggestion
                
                window.print();

                // Restore title after a short delay
                setTimeout(() => {
                    document.title = originalTitle;
                }, 1000);

                printArea.innerHTML = '';
            }
        } catch (error: any) {
            console.error("PDF generation failed", error);
            alert(`Failed to generate PDF tutorial: ${error.message}`);
        } finally {
            setIsGeneratingPdf(false);
        }
    };
    
    const handleSendMessage = async (message: string) => {
        if (!chatInstance.current || isAwaitingResponse) return;

        setIsAwaitingResponse(true);
        setChatMessages(prev => [...prev, { role: 'user', content: message }, { role: 'model', content: '' }]);

        try {
            const result = await chatInstance.current.sendMessageStream({ message });
            let fullResponse = "";
            for await (const chunk of result) {
                fullResponse += chunk.text;
                setChatMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = { role: 'model', content: fullResponse };
                    return newMessages;
                });
            }
        } catch (error) {
            console.error("Chat error:", error);
            setChatMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1].content = "Sorry, an error occurred.";
                return newMessages;
            });
        } finally {
            setIsAwaitingResponse(false);
        }
    };

    const handleApplyCodeChange = (filePath: string, newContent: string) => {
        const oldContent = project.files.find(file => file.path === filePath)?.content;
        if (oldContent !== undefined) {
            setLastChangeInfo({ filePath, oldContent });
        }

        const updatedFiles = project.files.map(file => 
            file.path === filePath ? { ...file, content: newContent } : file
        );
        const newProjectState = { ...project, files: updatedFiles };
        setProject(newProjectState);
        
        if (selectedFile?.path === filePath) {
            setSelectedFile({ ...selectedFile, content: newContent });
        }
    };


    return (
        <div className="flex flex-col h-screen bg-blueprint-bg">
            <header className="flex items-center justify-between bg-blueprint-bg-light p-2 border-b border-blueprint-border flex-shrink-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold">{t('title')}<span className="text-blueprint-line">{t('title_factory')}</span></h1>
                  <span className="text-blueprint-text-dark opacity-60">/</span>
                  <span className="font-semibold text-blueprint-line">{project.projectName}</span>
                </div>
                 <div className="flex items-center gap-4">
                  <button 
                    onClick={handleExportPdf} 
                    disabled={isGeneratingPdf} 
                    className="bg-blueprint-border text-blueprint-text-light px-4 py-1.5 rounded-md hover:bg-blueprint-line hover:text-blueprint-bg transition-colors text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGeneratingPdf ? t('generating_pdf') : t('export_pdf')}
                  </button>
                  <button onClick={onReturn} className="bg-blueprint-line text-blueprint-bg px-4 py-1.5 rounded-md hover:brightness-110 transition-colors text-sm font-bold">{t('new_project')}</button>
                </div>
            </header>
            <main className="flex-grow grid grid-cols-12 gap-px bg-blueprint-border overflow-hidden">
                <div className="col-span-2 bg-blueprint-bg-light p-2 overflow-y-auto">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-blueprint-text-dark mb-2 px-1">{t('explorer')}</h3>
                    <FileExplorerNode node={fileTree} selectedFile={selectedFile} onFileSelect={setSelectedFile} />
                </div>
                <div className="col-span-6 bg-blueprint-bg flex flex-col min-h-0">
                    <CodeEditor file={selectedFile} lastChangeInfo={lastChangeInfo} />
                </div>
                <div className="col-span-4 bg-blueprint-bg-light flex flex-col min-h-0">
                    <SidePanel 
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        project={project}
                        selectedFile={selectedFile}
                        chatMessages={chatMessages}
                        isAwaitingResponse={isAwaitingResponse}
                        onSendMessage={handleSendMessage}
                        onApplyCodeChange={handleApplyCodeChange}
                    />
                </div>
            </main>
        </div>
    );
};

const FileExplorerNode: React.FC<{ node: FileTreeNode, selectedFile: ProjectFile | null, onFileSelect: (file: ProjectFile) => void, level?: number }> = ({ node, selectedFile, onFileSelect, level = 0 }) => {
    const [isOpen, setIsOpen] = useState(true);

    const getFileIcon = (fileName: string) => {
      if (fileName.endsWith('.dart')) return 'dart';
      if (fileName.endsWith('.yaml')) return 'yaml';
      if (fileName.match(/\.(png|jpg|jpeg|gif|svg)$/)) return 'image';
      return 'file';
    };

    if (node.name === 'root') {
        return <>{node.children?.map(child => <FileExplorerNode key={child.path} node={child} selectedFile={selectedFile} onFileSelect={onFileSelect} />)}</>;
    }
    
    const isFolder = !!node.children;

    if (isFolder) {
        return (
            <div>
                <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center gap-1.5 text-left p-1 rounded-md hover:bg-blueprint-border/50 transition-colors">
                    <svg className={`w-4 h-4 transition-transform text-blueprint-text-dark ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    <Icon type="folder" className="w-5 h-5 text-yellow-500" />
                    <span className="text-blueprint-text-light">{node.name}</span>
                </button>
                {isOpen && <div style={{ paddingLeft: `${(level + 1) * 12}px` }}>{node.children?.map(child => <FileExplorerNode key={child.path} node={child} selectedFile={selectedFile} onFileSelect={onFileSelect} level={level + 1} />)}</div>}
            </div>
        );
    } else {
        const isSelected = selectedFile?.path === node.path;
        return (
            <button
                onClick={() => onFileSelect({ path: node.path, content: node.content || '', explanation: node.explanation || '' })}
                className={`w-full flex items-center gap-1.5 p-1 rounded-md text-left transition-colors text-blueprint-text-dark ${isSelected ? 'bg-blueprint-border text-blueprint-text-light' : 'hover:bg-blueprint-border/50'}`}
                style={{ paddingLeft: `${(level + 1) * 12}px` }}
            >
                <Icon type={getFileIcon(node.name)} className="w-5 h-5 text-blueprint-line" />
                <span className={`${isSelected ? 'text-blueprint-text-light' : 'text-blueprint-text-dark'}`}>{node.name}</span>
            </button>
        );
    }
};

const dartKeywords = `\\b(abstract|as|assert|async|await|break|case|catch|class|const|continue|covariant|default|deferred|do|dynamic|else|enum|export|extends|extension|external|factory|false|final|finally|for|Function|get|hide|if|implements|import|in|interface|is|late|library|mixin|new|null|on|operator|part|required|rethrow|return|set|show|static|super|switch|sync|this|throw|true|try|typedef|var|void|while|with|yield)\\b`;
const dartBuiltins = `\\b(int|double|String|bool|List|Map|Set|Runes|Symbol|Object|Never|Future|Stream|dynamic|void)\\b`;

const SyntaxHighlighter: React.FC<{ code?: string; diff?: DiffLine[] }> = ({ code, diff }) => {
    const highlight = useCallback((line: string) => {
        if (!line) return '';
        return line
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/(\/\/.*|\/\*[\s\S]*?\*\/)/g, `<span class="text-code-comment">$1</span>`)
            .replace(/('.*?'|".*?"|'''.*?'''|""".*?""")/gs, `<span class="text-code-string">$1</span>`)
            .replace(new RegExp(dartKeywords, 'g'), `<span class="text-code-keyword">$1</span>`)
            .replace(/\b([A-Z][a-zA-Z0-9<>,? ]*)\b/g, `<span class="text-code-class">$1</span>`)
            .replace(new RegExp(dartBuiltins, 'g'), `<span class="text-code-builtin">$1</span>`)
            .replace(/([a-zA-Z_][a-zA-Z0-9_]*)(?=\()/g, `<span class="text-code-function">$1</span>`)
            .replace(/\b(\d+(\.\d+)?)\b/g, `<span class="text-code-number">$1</span>`);
    }, []);

    if (diff) {
        return (
            <pre className="text-sm text-blueprint-text-light">
                <code>
                    {diff.map((line, i) => {
                        const lineClasses = {
                            added: 'bg-green-500/10',
                            removed: 'bg-red-500/10',
                            common: '',
                        }[line.type];
                        
                        const prefix = { added: '+', removed: '-', common: ' ' }[line.type];

                        return (
                            <div key={i} className={`flex ${lineClasses}`}>
                                <span className="w-6 text-center shrink-0 select-none text-blueprint-text-dark/50">{prefix}</span>
                                <span className="flex-1" dangerouslySetInnerHTML={{ __html: highlight(line.content) }} />
                            </div>
                        );
                    })}
                </code>
            </pre>
        );
    }

    const highlightedCode = useMemo(() => highlight(code || ''), [code, highlight]);

    return (
        <pre className="text-sm text-blueprint-text-light">
            <code dangerouslySetInnerHTML={{ __html: highlightedCode }} />
        </pre>
    );
};


const CodeEditor: React.FC<{ file: ProjectFile | null, lastChangeInfo: { filePath: string; oldContent: string } | null; }> = ({ file, lastChangeInfo }) => {
    const { t } = useTranslation();
    
    const diff = useMemo(() => {
        if (file && lastChangeInfo && file.path === lastChangeInfo.filePath) {
            return calculateDiff(lastChangeInfo.oldContent, file.content);
        }
        return null;
    }, [file, lastChangeInfo]);

    if (!file) {
        return (
            <div className="flex-grow flex items-center justify-center text-blueprint-text-dark">
                <p>{t('select_file_prompt')}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex-shrink-0 p-2 border-b border-blueprint-border bg-blueprint-bg-light">
                <span className="text-blueprint-text-light">{file.path}</span>
            </div>
            <div className="flex-grow overflow-auto p-4">
                {diff ? <SyntaxHighlighter diff={diff} /> : <SyntaxHighlighter code={file.content} />}
            </div>
        </div>
    );
};

const SidePanel: React.FC<{
    activeTab: 'analysis' | 'learning' | 'chat';
    setActiveTab: (tab: 'analysis' | 'learning' | 'chat') => void;
    project: GeminiProjectOutput;
    selectedFile: ProjectFile | null;
    chatMessages: {role: 'user' | 'model', content: string}[];
    isAwaitingResponse: boolean;
    onSendMessage: (message: string) => void;
    onApplyCodeChange: (filePath: string, newContent: string) => void;
}> = (props) => {
    const { t } = useTranslation();
    const { activeTab, setActiveTab, project, selectedFile, chatMessages, isAwaitingResponse, onSendMessage, onApplyCodeChange } = props;

    const tabConfig = {
        analysis: t('file_explanation'),
        learning: t('learning_path'),
        chat: t('chat'),
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex-shrink-0 border-b border-blueprint-border">
                {(Object.keys(tabConfig) as Array<keyof typeof tabConfig>).map(tabKey => (
                    <button 
                        key={tabKey}
                        onClick={() => setActiveTab(tabKey)} 
                        className={`px-4 py-2 text-sm transition-colors ${activeTab === tabKey ? 'bg-blueprint-bg text-blueprint-line' : 'text-blueprint-text-dark hover:bg-blueprint-border'}`}
                    >
                        {tabConfig[tabKey]}
                    </button>
                ))}
            </div>
            <div className="flex-grow overflow-y-auto p-4 text-blueprint-text-light/90 text-sm leading-relaxed">
                {activeTab === 'analysis' && <FileAnalysisView selectedFile={selectedFile} />}
                {activeTab === 'learning' && <LearningPathView project={project} />}
                {activeTab === 'chat' && (
                    <ChatView 
                        messages={chatMessages} 
                        isAwaitingResponse={isAwaitingResponse} 
                        onSendMessage={onSendMessage} 
                        onApplyCodeChange={onApplyCodeChange}
                    />
                )}
            </div>
        </div>
    );
}

const FileAnalysisView: React.FC<{selectedFile: ProjectFile | null}> = ({ selectedFile }) => {
    const { t } = useTranslation();
    return (
      <div>
          <h3 className="text-lg font-bold text-blueprint-line mb-2">{t('analysis_of')}: {selectedFile?.path || t('no_file_selected')}</h3>
          {selectedFile ? (
             <p className="whitespace-pre-wrap">{selectedFile.explanation}</p>
          ) : (
             <p>{t('select_file_for_analysis')}</p>
          )}
      </div>
    );
};

const LearningPathView: React.FC<{project: GeminiProjectOutput}> = ({ project }) => {
    const { t } = useTranslation();
    return (
      <div>
          <h3 className="text-lg font-bold text-blueprint-line mb-4">{t('project_mission')}: {project.projectName}</h3>
          <p className="mb-6 italic text-blueprint-text-dark">{project.projectDescription}</p>
          {project.learningPath.map((step, index) => (
              <div key={index} className="mb-6 pb-6 border-b border-blueprint-border last:border-b-0">
                  <h4 className="font-bold text-md text-blueprint-line mb-2">{step.title}</h4>
                  <p className="whitespace-pre-wrap mb-3">{step.explanation}</p>
                  {step.diagram && (
                      <div className="bg-blueprint-bg p-3 rounded-md mt-2">
                          <pre className="text-xs text-blueprint-line/80"><code>{step.diagram}</code></pre>
                      </div>
                  )}
                  {step.backendSuggestion && (
                      <div className="bg-blueprint-bg p-3 rounded-md mt-4 border-l-4 border-blueprint-line">
                          <h5 className="font-bold text-blueprint-line/90 text-xs uppercase tracking-wider mb-2">{t('backend_suggestion')}</h5>
                          <p className="text-xs whitespace-pre-wrap">{step.backendSuggestion}</p>
                      </div>
                  )}
              </div>
          ))}
      </div>
    );
};

const ChatView: React.FC<{
    messages: {role: 'user' | 'model', content: string}[];
    isAwaitingResponse: boolean;
    onSendMessage: (message: string) => void;
    onApplyCodeChange: (filePath: string, newContent: string) => void;
}> = ({ messages, isAwaitingResponse, onSendMessage, onApplyCodeChange }) => {
    const { t } = useTranslation();
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isAwaitingResponse) {
            onSendMessage(input);
            setInput('');
        }
    };
    
    const CodeUpdateBlock: React.FC<{ content: string }> = ({ content }) => {
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
        if (!jsonMatch || !jsonMatch[1]) return null;

        try {
            const data = JSON.parse(jsonMatch[1]);
            if (data.filePath && data.newContent) {
                return (
                    <div className="mt-2 p-3 bg-blueprint-bg border border-blueprint-border rounded-md">
                        <p className="text-xs text-blueprint-text-dark">{t('ai_suggestion')} <code className="font-bold text-blueprint-text-light">{data.filePath}</code></p>
                        <button onClick={() => onApplyCodeChange(data.filePath, data.newContent)} className="mt-2 w-full text-center px-3 py-1.5 text-sm bg-blueprint-line text-blueprint-bg rounded-md font-bold hover:brightness-110 transition-colors">
                            {t('apply_changes')}
                        </button>
                    </div>
                );
            }
        } catch (e) { /* Not valid JSON */ }
        return null;
    };

    return (
        <div className="h-full flex flex-col -mr-4">
            <div className="flex-grow space-y-4 pr-4 overflow-y-auto">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-lg px-3 py-2 ${msg.role === 'user' ? 'bg-blueprint-line text-blueprint-bg' : 'bg-blueprint-border'}`}>
                            <p className="whitespace-pre-wrap break-words">{msg.content.replace(/```json[\s\S]*?```/, '')}</p>
                            {msg.role === 'model' && <CodeUpdateBlock content={msg.content} />}
                        </div>
                    </div>
                ))}
                {isAwaitingResponse && messages[messages.length-1]?.role === 'model' && messages[messages.length-1].content === '' && (
                    <div className="flex justify-start">
                        <div className="bg-blueprint-border rounded-lg px-3 py-2">
                           <div className="animate-pulse flex space-x-1.5">
                             <div className="w-2 h-2 bg-blueprint-text-dark rounded-full"></div>
                             <div className="w-2 h-2 bg-blueprint-text-dark rounded-full animate-delay-150"></div>
                             <div className="w-2 h-2 bg-blueprint-text-dark rounded-full animate-delay-300"></div>
                           </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSubmit} className="flex-shrink-0 mt-4 pr-4">
                <div className="flex items-center gap-2">
                    <input 
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={t('ask_for_changes')}
                        className="flex-grow bg-blueprint-bg border border-blueprint-border rounded-md p-2 w-full text-blueprint-text-light focus:outline-none focus:ring-2 focus:ring-blueprint-line"
                        disabled={isAwaitingResponse}
                    />
                    <button type="submit" disabled={isAwaitingResponse || !input.trim()} className="p-2 bg-blueprint-line text-blueprint-bg rounded-md disabled:opacity-50 hover:brightness-110 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                    </button>
                </div>
            </form>
        </div>
    );
};

export default App;
