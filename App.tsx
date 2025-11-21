import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { GoogleGenAI, Chat } from '@google/genai';
import type { GeminiProjectOutput, Personality, ProjectFile, FileTreeNode, ProjectHistoryItem } from './types';
import { PERSONALITIES } from './constants';
import { generateFlutterProject, generateTutorialHtml } from './services/geminiService';
import { Icon } from './components/Icon';
import { InputCanvas } from './components/InputCanvas';

// --- i18n ---
const translations = {
  'pt-br': {
    title: 'Flutter',
    title_factory: 'Factory',
    subtitle: 'Transforme suas ideias em realidade. IA avançada para gerar arquitetura, código e guias completos.',
    visualize_app: '1. Visualizar',
    describe_app: '2. Descrever',
    choose_instructor: '3. Instrutor',
    generate: 'INICIAR PROJETO',
    error_empty_input: 'Por favor, forneça uma descrição ou uma imagem para começar.',
    loading_title: 'PROCESSANDO',
    loading_subtitle: 'Analisando requisitos...\nGerando arquitetura Flutter...\nEscrevendo código limpo...',
    new_project: 'Novo Projeto',
    explorer: 'Explorador',
    select_file_prompt: 'Selecione um arquivo para visualizar o código',
    file_explanation: 'Análise Técnica',
    learning_path: 'Guia de Implementação',
    no_file_selected: 'Nenhum arquivo selecionado',
    analysis_of: 'Análise de',
    select_file_for_analysis: 'Selecione um arquivo para ver a explicação detalhada do propósito e estrutura do código.',
    project_mission: 'Objetivo do Projeto',
    personality_tars_name: 'TARS',
    personality_google_name: 'Engenheiro Google',
    personality_fun_name: 'Mentor Criativo',
    draw: 'Desenhar',
    upload: 'Upload',
    paste: 'Colar',
    clear: 'Limpar',
    input_placeholder: 'Descreva seu app em detalhes. Ex: "Um app de finanças pessoais com dashboard de gastos, lista de transações e categorias editáveis. Estilo moderno e escuro."',
    upload_prompt: 'Arraste imagens ou clique para upload',
    select_file: 'Selecionar',
    paste_prompt: 'Ctrl+V para colar',
    draw_in_modal_title: 'Esboço Rápido',
    close: 'Fechar',
    save_drawing: 'Confirmar',
    visualize_info: 'Envie mockups, rascunhos ou diagramas para guiar a geração.',
    backend_suggestion: 'Arquitetura Sugerida',
    project_history: 'Projetos Recentes',
    clear_history: 'Limpar',
    chat: 'Assistente',
    export_pdf: 'PDF Tutorial',
    generating_pdf: 'Gerando PDF...',
    ask_for_changes: 'Solicite alterações ou tire dúvidas...',
    apply_changes: 'Aplicar Alteração',
    ai_suggestion: 'Sugestão de alteração em',
    personality_desc_tars: 'Lógico, conciso e direto ao ponto. Foco em eficiência.',
    personality_desc_google: 'Padrões industriais, Clean Architecture e melhores práticas.',
    personality_desc_fun: 'Didático, encorajador e focado em aprendizado rápido.',
  },
  'en': {
    title: 'Flutter',
    title_factory: 'Factory',
    subtitle: 'Turn ideas into reality. Advanced AI to generate architecture, code, and complete guides.',
    visualize_app: '1. Visualize',
    describe_app: '2. Describe',
    choose_instructor: '3. Instructor',
    generate: 'START PROJECT',
    error_empty_input: 'Please provide a description or an image to start.',
    loading_title: 'PROCESSING',
    loading_subtitle: 'Analyzing requirements...\nGenerating Flutter architecture...\nWriting clean code...',
    new_project: 'New Project',
    explorer: 'Explorer',
    select_file_prompt: 'Select a file to view code',
    file_explanation: 'Technical Analysis',
    learning_path: 'Implementation Guide',
    no_file_selected: 'No file selected',
    analysis_of: 'Analysis of',
    select_file_for_analysis: 'Select a file to view detailed explanation of purpose and structure.',
    project_mission: 'Project Goal',
    personality_tars_name: 'TARS',
    personality_google_name: 'Google Engineer',
    personality_fun_name: 'Creative Mentor',
    draw: 'Draw',
    upload: 'Upload',
    paste: 'Paste',
    clear: 'Clear',
    input_placeholder: 'Describe your app in detail. E.g., "A personal finance app with spending dashboard, transaction list, and editable categories. Dark modern style."',
    upload_prompt: 'Drag images or click to upload',
    select_file: 'Select',
    paste_prompt: 'Ctrl+V to paste',
    draw_in_modal_title: 'Quick Sketch',
    close: 'Close',
    save_drawing: 'Confirm',
    visualize_info: 'Upload mockups, sketches, or diagrams to guide generation.',
    backend_suggestion: 'Suggested Architecture',
    project_history: 'Recent Projects',
    clear_history: 'Clear',
    chat: 'Assistant',
    export_pdf: 'PDF Tutorial',
    generating_pdf: 'Generating PDF...',
    ask_for_changes: 'Request changes or ask questions...',
    apply_changes: 'Apply Change',
    ai_suggestion: 'Suggested change in',
    personality_desc_tars: 'Logical, concise, and straight to the point. Efficiency focus.',
    personality_desc_google: 'Industry standards, Clean Architecture, and best practices.',
    personality_desc_fun: 'Didactic, encouraging, and focused on rapid learning.',
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
    const [history, setHistory] = useState<ProjectHistoryItem[]>([]);

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

            const historyItem: ProjectHistoryItem = {
                ...project,
                prompt: {
                    description,
                    imagesData,
                    personalityId: personality.id,
                },
            };
            
            setHistory(prevHistory => {
                const newHistory = [historyItem, ...prevHistory.filter(p => p.projectName !== project.projectName)].slice(0, 10);
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
      setError(null);
      setLastChangeInfo(null);
      setView('input');
    }

    const handleLoadProject = (projectToLoad: ProjectHistoryItem) => {
        if (projectToLoad.prompt) {
            setDescription(projectToLoad.prompt.description);
            setImagesData(projectToLoad.prompt.imagesData);
            const loadedPersonality = PERSONALITIES.find(p => p.id === projectToLoad.prompt.personalityId) || PERSONALITIES[0];
            setPersonality(loadedPersonality);
        }
        
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
            <div className="h-screen bg-blueprint-bg font-sans text-blueprint-text-light overflow-hidden selection:bg-blueprint-line selection:text-blueprint-bg">
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
            if (!canvas || !ctx) return;
            clearCanvas();
            drawGrid();
            drawFood();
            moveSnake();
            drawSnake();
        }, 80);
    }

    function clearCanvas() {
        if (!canvas || !ctx) return;
        ctx.fillStyle = '#0a192f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function drawGrid() {
        if (!ctx) return;
        ctx.strokeStyle = 'rgba(100, 255, 218, 0.03)';
        ctx.lineWidth = 1;
        // Drawing full grid can be expensive, skipping for performance in loading screen
    }

    function drawSnakePart(part: {x: number, y: number}) {
        if (!ctx) return;
        ctx.fillStyle = '#64ffda';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#64ffda';
        ctx.fillRect(part.x * gridSize, part.y * gridSize, gridSize - 2, gridSize - 2);
        ctx.shadowBlur = 0;
    }
    
    function drawSnake() {
        snake.forEach(drawSnakePart);
    }

    function drawFood() {
        if (!ctx) return;
        if(foodEaten) {
            randomFoodPosition();
            foodEaten = false;
        }
        ctx.fillStyle = '#e06c75';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#e06c75';
        ctx.fillRect(food.x * gridSize, food.y * gridSize, gridSize - 2, gridSize - 2);
        ctx.shadowBlur = 0;
    }

    function moveSnake() {
        const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
        snake.unshift(head);

        if (head.x === food.x && head.y === food.y) {
            foodEaten = true;
        } else {
            snake.pop();
        }
        
        if (Math.random() < 0.05) {
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

    const intervalId = setInterval(main, 80);
    return () => clearInterval(intervalId);
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-20" />;
}

const LoadingScreen: React.FC = () => {
    const { t } = useTranslation();
    return (
      <div className="fixed inset-0 bg-blueprint-bg flex flex-col items-center justify-center z-50 overflow-hidden">
        <SnakeGame />
        <div className="z-10 text-center p-8 bg-blueprint-bg/80 backdrop-blur-md rounded-xl border border-blueprint-line/20 shadow-neon">
            <div className="mb-6 relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 border-t-2 border-blueprint-line rounded-full animate-spin"></div>
                <div className="absolute inset-2 border-r-2 border-code-function rounded-full animate-spin" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
            </div>
            <h2 className="text-3xl text-blueprint-line font-bold mb-4 tracking-widest">{t('loading_title')}</h2>
            <p className="text-blueprint-text-light/80 whitespace-pre-wrap font-mono text-sm">{t('loading_subtitle')}</p>
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
        <div className="absolute top-6 right-6 flex gap-1 bg-blueprint-bg-light/50 p-1 rounded-lg border border-blueprint-border backdrop-blur-sm z-20">
            <button onClick={() => switchLang('pt-br')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${locale === 'pt-br' ? 'bg-blueprint-line text-blueprint-bg shadow-lg' : 'text-blueprint-text-dim hover:text-blueprint-text-light'}`}>PT-BR</button>
            <button onClick={() => switchLang('en')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${locale === 'en' ? 'bg-blueprint-line text-blueprint-bg shadow-lg' : 'text-blueprint-text-dim hover:text-blueprint-text-light'}`}>EN</button>
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
  setImagesData: React.Dispatch<React.SetStateAction<{ data: string, mimeType: string }[]>>;
  error: string | null;
  history: ProjectHistoryItem[];
  onLoadProject: (project: ProjectHistoryItem) => void;
  onClearHistory: () => void;
  onDeleteItem: (projectName: string) => void;
}
const InputView: React.FC<InputViewProps> = ({ onGenerate, description, setDescription, personality, setPersonality, imagesData, setImagesData, error, history, onLoadProject, onClearHistory, onDeleteItem }) => {
    const { t } = useTranslation();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    
    const addImageData = useCallback((newData: { data: string, mimeType: string }) => {
        setImagesData(prev => [...prev, newData]);
    }, [setImagesData]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        processFiles(e.target.files);
    };

    const processFiles = (files: FileList | null) => {
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
    }
    
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

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        processFiles(e.dataTransfer.files);
    };

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Left History Panel */}
            <aside className="w-72 bg-blueprint-bg-light/50 border-r border-blueprint-border flex flex-col z-10 backdrop-blur-md">
                <div className="p-5 border-b border-blueprint-border flex justify-between items-center bg-blueprint-bg-light/80">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-blueprint-text-dim">{t('project_history')}</h2>
                    {history.length > 0 && (
                        <button
                            onClick={onClearHistory}
                            className="text-xs text-blueprint-text-dim hover:text-red-400 transition-colors"
                        >
                           {t('clear_history')}
                        </button>
                    )}
                </div>
                <div className="flex-grow overflow-y-auto p-3 space-y-2 custom-scrollbar">
                    {history.length > 0 ? (
                        history.map((project) => (
                            <div key={project.projectName} className="group relative">
                                <button
                                    onClick={() => onLoadProject(project)}
                                    className="w-full text-left p-3 rounded-lg border border-transparent hover:bg-blueprint-bg hover:border-blueprint-line/30 transition-all duration-200 group-hover:shadow-md"
                                >
                                    <div className="font-semibold text-sm text-blueprint-text-light truncate mb-1">{project.projectName}</div>
                                    <div className="text-xs text-blueprint-text-dim truncate opacity-70">{project.projectDescription}</div>
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDeleteItem(project.projectName); }}
                                    className="absolute top-2 right-2 p-1.5 rounded-md text-blueprint-text-dim hover:bg-red-500/10 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Icon type="trash" className="w-3 h-3" />
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-10 text-blueprint-text-dim/50 text-sm italic">
                            <p>Histórico vazio.</p>
                        </div>
                    )}
                </div>
            </aside>

            {/* Right Main Panel */}
            <main className="flex-grow flex flex-col relative overflow-y-auto scroll-smooth">
                <LanguageSwitcher />
                
                <div className="flex-grow flex flex-col items-center justify-center p-8 md:p-12">
                    <div className="w-full max-w-5xl space-y-10">
                        
                        <div className="text-center space-y-4 animate-fade-in-up">
                            <h1 className="text-6xl md:text-7xl font-black tracking-tighter text-white drop-shadow-lg">
                                Flutter<span className="text-blueprint-line">Factory</span>
                            </h1>
                            <p className="text-lg text-blueprint-text-dim max-w-2xl mx-auto leading-relaxed">{t('subtitle')}</p>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                            
                            {/* Inputs Section */}
                            <div className="lg:col-span-8 space-y-6">
                                {/* Card 1: Visualize */}
                                <div className="bg-blueprint-bg-light/40 backdrop-blur-sm border border-blueprint-border rounded-xl p-6 transition-all hover:border-blueprint-line/30 hover:shadow-glass">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-sm font-bold uppercase tracking-wider text-blueprint-line">{t('visualize_app')}</h2>
                                        <div className="flex gap-2">
                                            <button onClick={() => setIsDrawing(true)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded bg-blueprint-bg border border-blueprint-border hover:border-blueprint-line text-blueprint-text-light transition-all">
                                                <Icon type="draw" className="w-3 h-3" /> {t('draw')}
                                            </button>
                                            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded bg-blueprint-bg border border-blueprint-border hover:border-blueprint-line text-blueprint-text-light transition-all">
                                                <Icon type="upload" className="w-3 h-3" /> {t('upload')}
                                            </button>
                                        </div>
                                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" multiple />
                                    </div>
                                    
                                    <div 
                                        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                                        className={`relative rounded-lg border-2 border-dashed transition-all min-h-[160px] flex flex-col items-center justify-center p-4 ${isDragging ? 'border-blueprint-line bg-blueprint-line/5' : 'border-blueprint-border bg-blueprint-bg/50'}`}
                                    >
                                        {imagesData.length > 0 ? (
                                            <div className="flex flex-wrap gap-4 justify-center w-full">
                                                {imagesData.map((img, index) => (
                                                    <div key={index} className="relative w-24 h-24 group rounded-lg overflow-hidden border border-blueprint-border shadow-sm">
                                                        <img src={`data:${img.mimeType};base64,${img.data}`} alt="Upload" className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <button onClick={() => removeImage(index)} className="p-1.5 bg-red-500/80 rounded-full text-white hover:bg-red-600 transition-colors">
                                                                <Icon type="trash" className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                                <div className="w-24 h-24 flex items-center justify-center rounded-lg border-2 border-dashed border-blueprint-border hover:border-blueprint-line cursor-pointer transition-colors text-blueprint-text-dim hover:text-blueprint-line" onClick={() => fileInputRef.current?.click()}>
                                                    <Icon type="upload" className="w-6 h-6" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center pointer-events-none">
                                                <Icon type="image" className="w-10 h-10 mx-auto mb-3 text-blueprint-text-dim opacity-50"/>
                                                <p className="text-sm text-blueprint-text-dim">{t('upload_prompt')}</p>
                                                <p className="text-xs text-blueprint-text-dim/50 mt-1">{t('paste_prompt')}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Card 2: Describe */}
                                <div className="bg-blueprint-bg-light/40 backdrop-blur-sm border border-blueprint-border rounded-xl p-6 transition-all hover:border-blueprint-line/30 hover:shadow-glass">
                                    <h2 className="text-sm font-bold uppercase tracking-wider text-blueprint-line mb-4">{t('describe_app')}</h2>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder={t('input_placeholder')}
                                        className="w-full bg-blueprint-bg/50 border border-blueprint-border rounded-lg p-4 text-blueprint-text-light placeholder-blueprint-text-dim/40 focus:outline-none focus:border-blueprint-line focus:ring-1 focus:ring-blueprint-line transition-all resize-none h-32 font-sans leading-relaxed"
                                    />
                                </div>
                            </div>

                            {/* Sidebar Options */}
                            <div className="lg:col-span-4 space-y-6 h-full flex flex-col">
                                 {/* Card 3: Personality */}
                                 <div className="bg-blueprint-bg-light/40 backdrop-blur-sm border border-blueprint-border rounded-xl p-6 flex-grow">
                                     <h2 className="text-sm font-bold uppercase tracking-wider text-blueprint-line mb-4">{t('choose_instructor')}</h2>
                                     <div className="space-y-3">
                                         {PERSONALITIES.map(p => (
                                             <button
                                                 key={p.id}
                                                 onClick={() => setPersonality(p)}
                                                 className={`w-full text-left p-4 rounded-lg border transition-all duration-200 relative overflow-hidden group ${personality.id === p.id ? 'bg-blueprint-line/10 border-blueprint-line shadow-[0_0_15px_rgba(100,255,218,0.1)]' : 'bg-blueprint-bg/50 border-blueprint-border hover:border-blueprint-text-dim/50'}`}
                                             >
                                                 <div className={`font-bold text-sm mb-1 ${personality.id === p.id ? 'text-blueprint-line' : 'text-blueprint-text-light'}`}>{t(p.name as TranslationKey)}</div>
                                                 <div className="text-xs text-blueprint-text-dim leading-relaxed">
                                                    {p.id === 'tars' ? t('personality_desc_tars') : p.id === 'google-engineer' ? t('personality_desc_google') : t('personality_desc_fun')}
                                                 </div>
                                                 {personality.id === p.id && <div className="absolute right-0 top-0 p-1"><div className="w-2 h-2 rounded-full bg-blueprint-line animate-pulse"></div></div>}
                                             </button>
                                         ))}
                                     </div>
                                 </div>

                                 <div className="pt-2">
                                     {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm text-center mb-4 animate-pulse">{error}</div>}
                                     <button
                                         onClick={onGenerate}
                                         className="w-full bg-blueprint-line text-blueprint-bg font-black py-4 rounded-xl text-lg tracking-widest hover:bg-white transition-all transform hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(100,255,218,0.4)] active:translate-y-0 active:shadow-none"
                                     >
                                         {t('generate')}
                                     </button>
                                 </div>
                            </div>
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
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-blueprint-bg border border-blueprint-border rounded-xl shadow-2xl p-6 w-full max-w-3xl flex flex-col gap-4" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-blueprint-text-light">{t('draw_in_modal_title')}</h3>
                    <button onClick={onClose} className="text-blueprint-text-dim hover:text-white"><Icon type="trash" className="w-5 h-5" /></button> {/* Used trash icon as generic close placeholder if x not available, or change icon component */}
                </div>
                <div className="aspect-video bg-blueprint-bg-light rounded-lg overflow-hidden border border-blueprint-border shadow-inner">
                    <InputCanvas width={800} height={450} onDraw={setTempDataUrl} />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-medium text-blueprint-text-dim border border-blueprint-border hover:bg-blueprint-border/50 hover:text-white transition-colors">{t('close')}</button>
                    <button onClick={handleSave} className="px-5 py-2.5 rounded-lg text-sm font-bold bg-blueprint-line text-blueprint-bg hover:brightness-110 shadow-neon transition-all">{t('save_drawing')}</button>
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
                document.title = `${project.projectName} Tutorial`;
                
                window.print();

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
        <div className="flex flex-col h-screen bg-blueprint-bg overflow-hidden">
            {/* Header */}
            <header className="flex items-center justify-between bg-blueprint-bg-light/80 backdrop-blur-md h-16 px-6 border-b border-blueprint-border flex-shrink-0 z-20">
                <div className="flex items-center gap-3">
                  <div className="flex items-baseline gap-0.5">
                      <h1 className="text-xl font-black text-white tracking-tight">Flutter</h1>
                      <span className="text-xl font-black text-blueprint-line">Factory</span>
                  </div>
                  <span className="text-blueprint-border text-2xl font-light">/</span>
                  <span className="font-medium text-blueprint-text-light text-sm bg-blueprint-bg px-3 py-1 rounded-full border border-blueprint-border">{project.projectName}</span>
                </div>
                 <div className="flex items-center gap-3">
                  <button 
                    onClick={handleExportPdf} 
                    disabled={isGeneratingPdf} 
                    className="group flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold tracking-wide text-blueprint-text-dim hover:text-blueprint-text-light hover:bg-blueprint-border/50 transition-all disabled:opacity-50"
                  >
                    <span className={`w-2 h-2 rounded-full ${isGeneratingPdf ? 'bg-yellow-400 animate-pulse' : 'bg-blueprint-text-dim group-hover:bg-blueprint-line'}`}></span>
                    {isGeneratingPdf ? t('generating_pdf') : t('export_pdf')}
                  </button>
                  <div className="h-6 w-px bg-blueprint-border"></div>
                  <button onClick={onReturn} className="bg-blueprint-line text-blueprint-bg px-5 py-2 rounded-md hover:bg-white transition-all text-xs font-bold uppercase tracking-wider shadow-neon">{t('new_project')}</button>
                </div>
            </header>
            
            {/* Workspace Grid */}
            <main className="flex-grow grid grid-cols-12 min-h-0">
                {/* Explorer Panel */}
                <div className="col-span-2 bg-blueprint-bg-light/30 border-r border-blueprint-border flex flex-col min-h-0">
                    <div className="p-3 border-b border-blueprint-border bg-blueprint-bg/50">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-blueprint-text-dim pl-2">{t('explorer')}</h3>
                    </div>
                    <div className="overflow-y-auto p-2 custom-scrollbar flex-grow">
                        <FileExplorerNode node={fileTree} selectedFile={selectedFile} onFileSelect={setSelectedFile} />
                    </div>
                </div>
                
                {/* Editor Panel */}
                <div className="col-span-6 bg-blueprint-bg flex flex-col min-h-0 relative z-0">
                   <CodeEditor file={selectedFile} lastChangeInfo={lastChangeInfo} />
                </div>
                
                {/* Tools Panel */}
                <div className="col-span-4 bg-blueprint-bg-light border-l border-blueprint-border flex flex-col min-h-0 shadow-[-5px_0_15px_rgba(0,0,0,0.1)] z-10">
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
        return <div className="space-y-0.5">{node.children?.map(child => <FileExplorerNode key={child.path} node={child} selectedFile={selectedFile} onFileSelect={onFileSelect} />)}</div>;
    }
    
    const isFolder = !!node.children;

    if (isFolder) {
        return (
            <div className="select-none">
                <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center gap-1.5 text-left px-2 py-1 rounded-md hover:bg-white/5 transition-colors group">
                    <svg className={`w-3 h-3 transition-transform text-blueprint-text-dim group-hover:text-blueprint-text-light ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    <Icon type="folder" className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-blueprint-text-light/90 group-hover:text-white font-medium">{node.name}</span>
                </button>
                {isOpen && <div className="border-l border-blueprint-border/30 ml-3 pl-1">{node.children?.map(child => <FileExplorerNode key={child.path} node={child} selectedFile={selectedFile} onFileSelect={onFileSelect} level={level + 1} />)}</div>}
            </div>
        );
    } else {
        const isSelected = selectedFile?.path === node.path;
        return (
            <button
                onClick={() => onFileSelect({ path: node.path, content: node.content || '', explanation: node.explanation || '' })}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-all group ${isSelected ? 'bg-blueprint-line/10 text-blueprint-line' : 'text-blueprint-text-dim hover:bg-white/5 hover:text-blueprint-text-light'}`}
            >
                <div className="w-4 flex justify-center">
                    <Icon type={getFileIcon(node.name)} className={`w-3.5 h-3.5 ${isSelected ? 'text-blueprint-line' : 'text-blueprint-text-dim group-hover:text-blueprint-text-light'}`} />
                </div>
                <span className={`text-xs truncate ${isSelected ? 'font-bold' : 'font-normal'}`}>{node.name}</span>
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
            .replace(/(\/\/.*|\/\*[\s\S]*?\*\/)/g, `<span class="text-code-comment italic">$1</span>`)
            .replace(/('.*?'|".*?"|'''.*?'''|""".*?""")/gs, `<span class="text-code-string">$1</span>`)
            .replace(new RegExp(dartKeywords, 'g'), `<span class="text-code-keyword font-bold">$1</span>`)
            .replace(/\b([A-Z][a-zA-Z0-9<>,? ]*)\b/g, `<span class="text-code-class">$1</span>`)
            .replace(new RegExp(dartBuiltins, 'g'), `<span class="text-code-builtin">$1</span>`)
            .replace(/([a-zA-Z_][a-zA-Z0-9_]*)(?=\()/g, `<span class="text-code-function">$1</span>`)
            .replace(/\b(\d+(\.\d+)?)\b/g, `<span class="text-code-number">$1</span>`);
    }, []);

    // Function to generate line numbers
    const renderLineNumber = (num: number) => (
        <span className="inline-block w-8 mr-4 text-right text-blueprint-text-dim/30 select-none text-xs">{num}</span>
    );

    if (diff) {
        return (
            <div className="font-mono text-sm leading-6 overflow-auto h-full custom-scrollbar p-4">
                {diff.map((line, i) => {
                    const lineClasses = {
                        added: 'bg-green-500/10 border-l-2 border-green-500',
                        removed: 'bg-red-500/10 border-l-2 border-red-500 opacity-60',
                        common: 'border-l-2 border-transparent',
                    }[line.type];
                    
                    return (
                        <div key={i} className={`flex ${lineClasses} px-2`}>
                            {renderLineNumber(i + 1)}
                            <span className="flex-1 whitespace-pre-wrap break-all" dangerouslySetInnerHTML={{ __html: highlight(line.content) }} />
                        </div>
                    );
                })}
            </div>
        );
    }

    const lines = (code || '').split('\n');

    return (
         <div className="font-mono text-[13px] leading-6 overflow-auto h-full custom-scrollbar pb-10">
            {lines.map((line, i) => (
                 <div key={i} className="flex hover:bg-white/5 px-4">
                    {renderLineNumber(i + 1)}
                    <span className="flex-1 whitespace-pre-wrap break-all text-blueprint-text-light" dangerouslySetInnerHTML={{ __html: highlight(line) || ' ' }} />
                 </div>
            ))}
        </div>
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
            <div className="absolute inset-0 flex flex-col items-center justify-center text-blueprint-text-dim opacity-40 pointer-events-none">
                <Icon type="dart" className="w-24 h-24 mb-4" />
                <p className="text-lg font-light">{t('select_file_prompt')}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#0d1b2e]"> {/* Slightly darker background for editor */}
            <div className="flex-shrink-0 h-10 flex items-center px-4 border-b border-blueprint-border bg-blueprint-bg/80 backdrop-blur-sm sticky top-0 z-10">
                <span className="text-xs text-blueprint-text-dim mr-2">Viewing:</span>
                <span className="text-sm text-blueprint-line font-mono">{file.path}</span>
                {lastChangeInfo && file.path === lastChangeInfo.filePath && (
                     <span className="ml-4 text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">Diff View</span>
                )}
            </div>
            <div className="flex-grow overflow-hidden relative">
                {diff ? <SyntaxHighlighter diff={diff} /> : <SyntaxHighlighter code={file.content} />}
            </div>
        </div>
    );
};

const FileAnalysisView: React.FC<{selectedFile: ProjectFile | null}> = ({ selectedFile }) => {
    const { t } = useTranslation();
    return (
      <div className="animate-fade-in">
          <h3 className="text-sm font-bold text-blueprint-line uppercase tracking-wider mb-4 flex items-center gap-2">
             <Icon type="info" className="w-4 h-4"/> 
             {t('analysis_of')}: <span className="text-white">{selectedFile?.path || '...'}</span>
          </h3>
          {selectedFile ? (
             <div className="prose prose-invert prose-sm max-w-none">
                <p className="whitespace-pre-wrap text-blueprint-text-dim leading-relaxed">{selectedFile.explanation}</p>
             </div>
          ) : (
             <div className="text-center py-10 text-blueprint-text-dim/50 italic">
                 {t('select_file_for_analysis')}
             </div>
          )}
      </div>
    );
};

const LearningPathView: React.FC<{project: GeminiProjectOutput}> = ({ project }) => {
    const { t } = useTranslation();
    return (
      <div className="space-y-8 animate-fade-in">
          <div>
             <h3 className="text-sm font-bold text-blueprint-line uppercase tracking-wider mb-2">{t('project_mission')}</h3>
             <div className="bg-blueprint-bg/50 p-4 rounded-lg border border-blueprint-border">
                 <p className="italic text-blueprint-text-light font-medium">{project.projectDescription}</p>
             </div>
          </div>

          <div className="relative border-l-2 border-blueprint-border ml-3 space-y-8 pb-4">
            {project.learningPath.map((step, index) => (
                <div key={index} className="relative pl-6 group">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blueprint-bg border-2 border-blueprint-border group-hover:border-blueprint-line group-hover:bg-blueprint-line transition-colors"></div>
                    <h4 className="font-bold text-base text-white mb-2 flex items-center gap-2">
                        <span className="text-blueprint-line opacity-60 text-xs font-mono">{(index + 1).toString().padStart(2, '0')}</span>
                        {step.title}
                    </h4>
                    <p className="text-blueprint-text-dim mb-3">{step.explanation}</p>
                    
                    {step.diagram && (
                        <div className="bg-[#0d1b2e] p-4 rounded-lg border border-blueprint-border overflow-x-auto my-3">
                            <pre className="text-[10px] font-mono text-blueprint-line leading-tight">{step.diagram}</pre>
                        </div>
                    )}
                    
                    {step.backendSuggestion && (
                        <div className="bg-blue-900/20 p-3 rounded-lg border border-blue-500/30 flex gap-3 items-start">
                            <Icon type="folder" className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" /> {/* Using folder icon as generic backend placeholder or create server icon */}
                            <div>
                                <h5 className="font-bold text-blue-300 text-xs uppercase tracking-wider mb-1">{t('backend_suggestion')}</h5>
                                <p className="text-xs text-blue-100/80">{step.backendSuggestion}</p>
                            </div>
                        </div>
                    )}
                </div>
            ))}
          </div>
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
                    <div className="mt-3 p-0 bg-blueprint-bg border border-blueprint-line/30 rounded-lg overflow-hidden shadow-lg">
                        <div className="bg-blueprint-line/10 px-3 py-2 border-b border-blueprint-line/10 flex justify-between items-center">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-blueprint-line">{t('ai_suggestion')}</p>
                            <code className="text-xs text-white">{data.filePath}</code>
                        </div>
                        <div className="p-3">
                            <button onClick={() => onApplyCodeChange(data.filePath, data.newContent)} className="w-full py-2 text-xs bg-blueprint-line text-blueprint-bg rounded font-bold hover:brightness-110 transition-transform active:scale-95">
                                {t('apply_changes')}
                            </button>
                        </div>
                    </div>
                );
            }
        } catch (e) { /* Not valid JSON */ }
        return null;
    };

    return (
        <div className="h-full flex flex-col relative">
            {messages.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center opacity-30 pointer-events-none">
                    <div className="w-16 h-16 bg-blueprint-line/10 rounded-full flex items-center justify-center mb-4">
                        <Icon type="info" className="w-8 h-8 text-blueprint-line"/>
                    </div>
                    <p className="max-w-[200px] text-sm">{t('ask_for_changes')}</p>
                </div>
            )}
            
            <div className="flex-grow space-y-6 pb-4 pr-2 overflow-y-auto custom-scrollbar">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div 
                            className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                                msg.role === 'user' 
                                ? 'bg-blueprint-line text-blueprint-bg font-medium rounded-br-none' 
                                : 'bg-white/10 text-blueprint-text-light rounded-bl-none border border-white/5'
                            }`}
                        >
                            <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content.replace(/```json[\s\S]*?```/, '')}</p>
                            {msg.role === 'model' && <CodeUpdateBlock content={msg.content} />}
                        </div>
                        <span className="text-[10px] text-blueprint-text-dim mt-1 opacity-50 px-1">
                            {msg.role === 'user' ? 'You' : 'TARS'}
                        </span>
                    </div>
                ))}
                {isAwaitingResponse && messages[messages.length-1]?.role === 'model' && messages[messages.length-1].content === '' && (
                    <div className="flex justify-start items-center gap-2">
                        <div className="bg-white/10 rounded-2xl rounded-bl-none px-4 py-3 border border-white/5">
                           <div className="flex space-x-1.5">
                             <div className="w-1.5 h-1.5 bg-blueprint-text-dim rounded-full animate-bounce"></div>
                             <div className="w-1.5 h-1.5 bg-blueprint-text-dim rounded-full animate-bounce delay-100"></div>
                             <div className="w-1.5 h-1.5 bg-blueprint-text-dim rounded-full animate-bounce delay-200"></div>
                           </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            
            <form onSubmit={handleSubmit} className="flex-shrink-0 mt-2 pt-4 border-t border-blueprint-border">
                <div className="relative">
                    <input 
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={t('ask_for_changes')}
                        className="w-full bg-blueprint-bg/50 border border-blueprint-border rounded-xl py-3 pl-4 pr-12 text-blueprint-text-light focus:outline-none focus:border-blueprint-line focus:ring-1 focus:ring-blueprint-line transition-all shadow-inner text-sm"
                        disabled={isAwaitingResponse}
                    />
                    <button 
                        type="submit" 
                        disabled={isAwaitingResponse || !input.trim()} 
                        className="absolute right-2 top-1.5 p-1.5 bg-blueprint-line text-blueprint-bg rounded-lg disabled:opacity-30 disabled:grayscale hover:brightness-110 transition-all"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transform rotate-90" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                    </button>
                </div>
            </form>
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
            <div className="flex-shrink-0 border-b border-blueprint-border flex">
                {(Object.keys(tabConfig) as Array<keyof typeof tabConfig>).map(tabKey => (
                    <button 
                        key={tabKey}
                        onClick={() => setActiveTab(tabKey)} 
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all relative overflow-hidden ${activeTab === tabKey ? 'text-blueprint-line bg-blueprint-bg/50' : 'text-blueprint-text-dim hover:text-blueprint-text-light hover:bg-white/5'}`}
                    >
                        {tabConfig[tabKey]}
                        {activeTab === tabKey && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blueprint-line shadow-[0_-2px_10px_rgba(100,255,218,0.5)]"></div>}
                    </button>
                ))}
            </div>
            <div className="flex-grow overflow-y-auto p-5 text-blueprint-text-light/90 text-sm leading-relaxed custom-scrollbar">
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

export default App;