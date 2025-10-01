
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { GeminiProjectOutput, Personality, ProjectFile, FileTreeNode } from './types';
import { PERSONALITIES } from './constants';
import { generateFlutterProject } from './services/geminiService';
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

// --- Main App ---
const App: React.FC = () => {
    const [view, setView] = useState<'input' | 'output'>('input');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedProject, setGeneratedProject] = useState<GeminiProjectOutput | null>(null);

    const [description, setDescription] = useState('');
    const [personality, setPersonality] = useState<Personality>(PERSONALITIES[0]);
    const [imagesData, setImagesData] = useState<{ data: string, mimeType: string }[]>([]);

    const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
    const [locale, setLocale] = useState<Locale>('pt-br');

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
      setView('input');
    }

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
                {view === 'input' && <InputView onGenerate={handleGenerate} description={description} setDescription={setDescription} personality={personality} setPersonality={setPersonality} imagesData={imagesData} setImagesData={setImagesData} error={error} />}
                {view === 'output' && generatedProject && fileTree && <OutputView project={generatedProject} fileTree={fileTree} selectedFile={selectedFile} setSelectedFile={setSelectedFile} onReturn={handleReturnToInput} />}
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
    let score = 0;
    let changingDirection = false;
    let foodEaten = true; // Start with food eaten to place the first one

    function randomFoodPosition() {
        food.x = Math.floor(Math.random() * (canvas.width / gridSize));
        food.y = Math.floor(Math.random() * (canvas.height / gridSize));
    }

    function main() {
        if(changingDirection) return;
        changingDirection = true;
        setTimeout(() => {
            clearCanvas();
            drawFood();
            moveSnake();
            drawSnake();
            changingDirection = false;
        }, 100);
    }

    function clearCanvas() {
        ctx.fillStyle = '#0a192f'; // blueprint-bg
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function drawSnakePart(part: {x: number, y: number}) {
        ctx.fillStyle = '#64ffda'; // blueprint-line
        ctx.strokeStyle = '#0a192f'; // blueprint-bg
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
        ctx.fillStyle = '#64ffda'; // blueprint-line
        ctx.fillRect(food.x * gridSize, food.y * gridSize, gridSize, gridSize);
    }

    function moveSnake() {
        const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
        snake.unshift(head);

        if (head.x === food.x && head.y === food.y) {
            score++;
            foodEaten = true;
        } else {
            snake.pop();
        }
        
        // Auto-pilot logic
        if (Math.random() < 0.1) { // 10% chance to change direction
            const directions = [{x: 0, y: 1}, {x: 0, y: -1}, {x: 1, y: 0}, {x: -1, y: 0}];
            const newDir = directions[Math.floor(Math.random() * directions.length)];
            // Avoid reversing
            if (snake.length === 1 || (newDir.x !== -direction.x && newDir.y !== -direction.y)) {
                direction = newDir;
            }
        }
        
        // Wall collision
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
}
const InputView: React.FC<InputViewProps> = ({ onGenerate, description, setDescription, personality, setPersonality, imagesData, setImagesData, error }) => {
    const { t } = useTranslation();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    
    const addImageData = (newData: { data: string, mimeType: string }) => {
        setImagesData(prev => [...prev, newData]);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            for(const file of Array.from(files)) {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64String = (reader.result as string).split(',')[1];
                        addImageData({ data: base64String, mimeType: file.type });
                    };
                    reader.readAsDataURL(file);
                }
            }
        }
    };
    
    const onCanvasDraw = (dataUrl: string) => {
        if(!dataUrl) return;
        const base64String = dataUrl.split(',')[1];
        addImageData({ data: base64String, mimeType: 'image/png'});
    };

    const handlePaste = useCallback((e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                // FIX: Use `instanceof File` as a type guard to ensure `blob` is treated as a File object.
                // This resolves type errors with `blob.type` and `readAsDataURL(blob)` that occur when
                // the compiler incorrectly infers the type as `unknown`.
                if (blob instanceof File) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const base64String = (event.target?.result as string).split(',')[1];
                        addImageData({ data: base64String, mimeType: blob.type });
                    };
                    reader.readAsDataURL(blob);
                    e.preventDefault();
                    break;
                }
            }
        }
    }, [setImagesData]);

    useEffect(() => {
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [handlePaste]);
    
    const removeImage = (indexToRemove: number) => {
        setImagesData(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    return (
        <div className="container mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-screen relative">
            <LanguageSwitcher />
            <h1 className="text-5xl font-bold mb-2 text-center text-blueprint-text-light">{t('title')}<span className="text-blueprint-line">{t('title_factory')}</span></h1>
            <p className="text-blueprint-text-dark mb-8 text-center max-w-2xl">{t('subtitle')}</p>
            
            <div className="w-full max-w-4xl bg-blueprint-bg-light/50 p-6 rounded-lg border border-blueprint-border shadow-2xl space-y-6">
                
                {/* Visual Composer */}
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

                {/* Input Area */}
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

                {/* Config & Generate */}
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
            {isDrawing && 
                <DrawModal onClose={() => setIsDrawing(false)} onSave={onCanvasDraw} />
            }
        </div>
    );
};

const DrawModal: React.FC<{onClose: () => void, onSave: (data: string) => void}> = ({onClose, onSave}) => {
    const { t } = useTranslation();
    const canvasRef = useRef<HTMLCanvasElement>(null);
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
    fileTree: FileTreeNode;
    selectedFile: ProjectFile | null;
    setSelectedFile: (file: ProjectFile) => void;
    onReturn: () => void;
}
const OutputView: React.FC<OutputViewProps> = ({ project, fileTree, selectedFile, setSelectedFile, onReturn }) => {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col h-screen bg-blueprint-bg">
            <header className="flex items-center justify-between bg-blueprint-bg-light p-2 border-b border-blueprint-border flex-shrink-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold">{t('title')}<span className="text-blueprint-line">{t('title_factory')}</span></h1>
                  <span className="text-blueprint-text-dark opacity-60">/</span>
                  <span className="font-semibold text-blueprint-line">{project.projectName}</span>
                </div>
                <button onClick={onReturn} className="bg-blueprint-line text-blueprint-bg px-4 py-1.5 rounded-md hover:brightness-110 transition-colors text-sm font-bold">{t('new_project')}</button>
            </header>
            <main className="flex-grow grid grid-cols-12 gap-px bg-blueprint-border overflow-hidden">
                <div className="col-span-2 bg-blueprint-bg-light p-2 overflow-y-auto">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-blueprint-text-dark mb-2 px-1">{t('explorer')}</h3>
                    <FileExplorerNode node={fileTree} selectedFile={selectedFile} onFileSelect={setSelectedFile} />
                </div>
                <div className="col-span-6 bg-blueprint-bg flex flex-col">
                    <CodeEditor file={selectedFile} />
                </div>
                <div className="col-span-4 bg-blueprint-bg-light flex flex-col">
                    <LearningPath project={project} selectedFile={selectedFile} />
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

const SyntaxHighlighter: React.FC<{ code: string }> = ({ code }) => {
    const highlightedCode = useMemo(() => {
        if (!code) return '';
        return code
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') // Escape HTML
            .replace(/(\/\/.*|\/\*[\s\S]*?\*\/)/g, `<span class="text-code-comment">$1</span>`) // Comments
            .replace(/('.*?'|".*?"|'''.*?'''|""".*?""")/gs, `<span class="text-code-string">$1</span>`) // Strings
            .replace(new RegExp(dartKeywords, 'g'), `<span class="text-code-keyword">$1</span>`) // Keywords
            .replace(/\b([A-Z][a-zA-Z0-9<>,? ]*)\b/g, `<span class="text-code-class">$1</span>`) // Classes/Types
            .replace(new RegExp(dartBuiltins, 'g'), `<span class="text-code-builtin">$1</span>`)
            .replace(/([a-zA-Z_][a-zA-Z0-9_]*)(?=\()/g, `<span class="text-code-function">$1</span>`) // Function calls
            .replace(/\b(\d+(\.\d+)?)\b/g, `<span class="text-code-number">$1</span>`); // Numbers
    }, [code]);

    return (
        <pre className="text-sm text-blueprint-text-light">
            <code dangerouslySetInnerHTML={{ __html: highlightedCode }} />
        </pre>
    );
};


const CodeEditor: React.FC<{ file: ProjectFile | null }> = ({ file }) => {
    const { t } = useTranslation();
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
                <SyntaxHighlighter code={file.content} />
            </div>
        </div>
    );
};

const LearningPath: React.FC<{ project: GeminiProjectOutput, selectedFile: ProjectFile | null }> = ({ project, selectedFile }) => {
    const [tab, setTab] = useState<'explanation' | 'learning'>('explanation');
    const { t } = useTranslation();

    useEffect(() => {
      setTab('explanation');
    }, [selectedFile]);

    return (
        <div className="flex flex-col h-full">
            <div className="flex-shrink-0 border-b border-blueprint-border">
                <button onClick={() => setTab('explanation')} className={`px-4 py-2 text-sm transition-colors ${tab === 'explanation' ? 'bg-blueprint-bg text-blueprint-line' : 'text-blueprint-text-dark hover:bg-blueprint-border'}`}>{t('file_explanation')}</button>
                <button onClick={() => setTab('learning')} className={`px-4 py-2 text-sm transition-colors ${tab === 'learning' ? 'bg-blueprint-bg text-blueprint-line' : 'text-blueprint-text-dark hover:bg-blueprint-border'}`}>{t('learning_path')}</button>
            </div>
            <div className="flex-grow overflow-y-auto p-4 text-blueprint-text-light/90 text-sm leading-relaxed">
                {tab === 'explanation' && (
                    <div>
                        <h3 className="text-lg font-bold text-blueprint-line mb-2">{t('analysis_of')}: {selectedFile?.path || t('no_file_selected')}</h3>
                        {selectedFile ? (
                           <p className="whitespace-pre-wrap">{selectedFile.explanation}</p>
                        ) : (
                           <p>{t('select_file_for_analysis')}</p>
                        )}
                    </div>
                )}
                {tab === 'learning' && (
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
                )}
            </div>
        </div>
    );
};

export default App;
