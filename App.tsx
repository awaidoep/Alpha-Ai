
import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, ChevronRight, ChevronDown, Plus, X, Send, 
  Trash2, Cpu, Code, Zap, Layout, MessageSquare, FileCode, Save, 
  Search, Edit2, PlusCircle, Check, FolderPlus, Monitor,
  ArrowRightCircle, HardDrive, Sparkles, Terminal, Activity, Paperclip,
  Upload, Download, FileJson, ShieldCheck, MoreVertical, Edit3, CloudUpload,
  CloudCheck, AlertTriangle, ShieldAlert, Undo2, Redo2, Play, Eye, RotateCw, Globe,
  Key, ExternalLink
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { FileNode, FileSystem, ChatMessage, AppSettings, FileOperation } from './types';
import { loadFileSystem, saveFileSystem, createDefaultFS } from './services/fileSystem';
import { getAIResponse } from './services/geminiService';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<'explorer' | 'editor' | 'chat' | 'preview'>('editor');
  const [showSettings, setShowSettings] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [fs, setFs] = useState<FileSystem>({});
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  
  // History State
  const [fsHistory, setFsHistory] = useState<FileSystem[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isInternalHistoryUpdate = useRef(false);

  // Context & AI State
  const [selectedContextIds, setSelectedContextIds] = useState<string[]>([]);
  const [isContextSelectorOpen, setIsContextSelectorOpen] = useState(false);
  const [editorAiPrompt, setEditorAiPrompt] = useState('');
  const [showEditorAi, setShowEditorAi] = useState(false);
  const [atMenuSearch, setAtMenuSearch] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>({ 
    theme: 'dark', 
    model: 'gemini-3-pro-preview',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<any>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const savedFs = await loadFileSystem() || createDefaultFS();
        setFs(savedFs);
        setFsHistory([savedFs]);
        setHistoryIndex(0);

        const savedSettings = localStorage.getItem('windsurf_settings_v1');
        if (savedSettings) {
           const parsed = JSON.parse(savedSettings);
           // Ensure migration for new fields
           setSettings(prev => ({
             ...prev,
             theme: parsed.theme || prev.theme,
             model: parsed.model || prev.model
           }));
        }
        
        const nodes = Object.values(savedFs) as FileNode[];
        const firstFile = nodes.find(f => f.type === 'file');
        if (firstFile) { 
          setActiveFileId(firstFile.id); 
          setOpenTabs([firstFile.id]); 
        }
      } catch (err) {
        setSyncError("Storage offline");
      }
    };
    init();
  }, []);

  useEffect(() => { 
    if (Object.keys(fs).length > 0) {
      setIsSaving(true);
      const timeout = setTimeout(async () => {
        try {
          await saveFileSystem(fs);
          setSyncError(null);
        } catch (e) {
          setSyncError("Write restricted");
        } finally {
          setIsSaving(false);
        }
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, [fs]);

  useEffect(() => { 
    localStorage.setItem('windsurf_settings_v1', JSON.stringify(settings)); 
  }, [settings]);

  const recordFsChange = (newFs: FileSystem) => {
    if (isInternalHistoryUpdate.current) return;
    const newHistory = fsHistory.slice(0, historyIndex + 1);
    newHistory.push(newFs);
    if (newHistory.length > 50) newHistory.shift();
    setFsHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (activeView === 'editor' && editorRef.current) {
      editorRef.current.trigger('keyboard', 'undo', null);
      return;
    }
    if (historyIndex > 0) {
      isInternalHistoryUpdate.current = true;
      const prevFs = fsHistory[historyIndex - 1];
      setFs(prevFs);
      setHistoryIndex(historyIndex - 1);
      setTimeout(() => { isInternalHistoryUpdate.current = false; }, 0);
    }
  };

  const handleRedo = () => {
    if (activeView === 'editor' && editorRef.current) {
      editorRef.current.trigger('keyboard', 'redo', null);
      return;
    }
    if (historyIndex < fsHistory.length - 1) {
      isInternalHistoryUpdate.current = true;
      const nextFs = fsHistory[historyIndex + 1];
      setFs(nextFs);
      setHistoryIndex(historyIndex + 1);
      setTimeout(() => { isInternalHistoryUpdate.current = false; }, 0);
    }
  };

  const buildPreview = () => {
    const nodes = Object.values(fs) as FileNode[];
    let targetHtml = nodes.find(n => n.name === 'index.html');
    if (!targetHtml) targetHtml = nodes.find(n => n.name.endsWith('.html'));
    
    if (!targetHtml) {
      const activeFile = activeFileId ? fs[activeFileId] : null;
      if (activeFile && activeFile.type === 'file') targetHtml = activeFile;
    }

    if (!targetHtml) {
      alert("No HTML content available.");
      return;
    }

    let htmlContent = targetHtml.content || '';
    nodes.filter(n => n.type === 'file').forEach(file => {
      const fileName = file.name;
      const content = file.content || '';
      if (fileName.endsWith('.js')) {
        const scriptTag = `<script src="${fileName}"></script>`;
        htmlContent = htmlContent.split(scriptTag).join(`<script>${content}</script>`);
        htmlContent = htmlContent.split(`./${fileName}`).join(fileName);
      }
      if (fileName.endsWith('.css')) {
        const linkTag = `<link rel="stylesheet" href="${fileName}">`;
        const linkTag2 = `<link rel="stylesheet" href="./${fileName}">`;
        htmlContent = htmlContent.split(linkTag).join(`<style>${content}</style>`);
        htmlContent = htmlContent.split(linkTag2).join(`<style>${content}</style>`);
      }
    });

    const blob = new Blob([htmlContent], { type: 'text/html' });
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(blob));
    setActiveView('preview');
  };

  const handleApplyArchitectPlan = (ops: FileOperation[]) => {
    setFs(prev => {
      const nextFs = { ...prev };
      ops.forEach(op => {
        let targetId = Object.keys(nextFs).find(id => (nextFs[id] as FileNode).name === op.path && (nextFs[id] as FileNode).type === 'file');
        if (targetId) {
          nextFs[targetId] = { ...nextFs[targetId] as FileNode, content: op.content };
        } else {
          const newId = Math.random().toString(36).substr(2, 9);
          const newNode: FileNode = { id: newId, name: op.path, type: 'file', content: op.content, parentId: 'root' };
          nextFs[newId] = newNode;
          if (nextFs['root']) {
            const root = nextFs['root'] as FileNode;
            nextFs['root'] = { 
              ...root, 
              children: [...(root.children || []), newId] 
            };
          }
          targetId = newId;
        }
        if (targetId && !openTabs.includes(targetId)) setOpenTabs(tabs => [...tabs, targetId!]);
      });
      recordFsChange(nextFs);
      return nextFs;
    });
    setActiveView('editor');
    setShowEditorAi(false);
  };

  const createNewFile = () => {
    const name = prompt("File name:");
    if (!name) return;
    const id = Math.random().toString(36).substr(2, 9);
    setFs(prev => {
      const newFile: FileNode = { id, name, type: 'file', content: '', parentId: 'root' };
      const root = prev['root'] as FileNode;
      const next: FileSystem = {
        ...prev,
        [id]: newFile,
        ['root']: { ...root, children: [...(root.children || []), id] }
      };
      recordFsChange(next);
      return next;
    });
    setActiveFileId(id);
    setOpenTabs(prev => [...new Set([...prev, id])]);
    setActiveView('editor');
  };

  const createNewFolder = () => {
    const name = prompt("Folder name:");
    if (!name) return;
    const id = Math.random().toString(36).substr(2, 9);
    setFs(prev => {
      const newFolder: FileNode = { id, name, type: 'folder', parentId: 'root', children: [], isOpen: true };
      const root = prev['root'] as FileNode;
      const next: FileSystem = {
        ...prev,
        [id]: newFolder,
        ['root']: { ...root, children: [...(root.children || []), id] }
      };
      recordFsChange(next);
      return next;
    });
  };

  const executeDownload = () => {
    if (!activeFileId || !fs[activeFileId]) return;
    const file = fs[activeFileId] as FileNode;
    const blob = new window.Blob([file.content || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowSaveConfirm(false);
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const promptValue = (customPrompt || userInput).replace(/@\S+/g, '').trim();
    if (!promptValue && !customPrompt) return;
    
    // Check for API KEY in env
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      alert("API_KEY not found in environment. Please configure process.env.API_KEY.");
      return;
    }

    const taggedFiles = selectedContextIds.map(id => fs[id]).filter(Boolean) as FileNode[];
    const userMsg: ChatMessage = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: customPrompt || userInput, 
      timestamp: Date.now(),
      contextFileNames: taggedFiles.map(f => f.name)
    };

    setChatHistory(prev => [...prev, userMsg]);
    setUserInput('');
    setEditorAiPrompt('');
    setSelectedContextIds([]);
    setIsAiLoading(true);

    try {
      const response = await getAIResponse(apiKey, settings.model, [...chatHistory, userMsg], fs, taggedFiles);
      setChatHistory(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.reasoning || "Logic updated.",
        operations: response.operations || [],
        timestamp: Date.now()
      }]);
      if (activeView !== 'chat') setActiveView('chat');
    } catch (err: any) {
      if (err?.message === "KEY_ERROR") {
        alert("The API Key is invalid or expired.");
      } else {
        alert("Architect Engine connection failed. Please check your network or API quota.");
      }
      console.error(err);
    } finally { setIsAiLoading(false); }
  };

  const handleChatInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUserInput(val);
    const lastAtIdx = val.lastIndexOf('@');
    if (lastAtIdx !== -1 && (lastAtIdx === 0 || val[lastAtIdx - 1] === ' ')) {
      setAtMenuSearch(val.slice(lastAtIdx + 1));
    } else {
      setAtMenuSearch(null);
    }
  };

  const selectFileSuggestion = (file: FileNode) => {
    if (!selectedContextIds.includes(file.id)) setSelectedContextIds([...selectedContextIds, file.id]);
    const lastAtIdx = userInput.lastIndexOf('@');
    setUserInput(userInput.slice(0, lastAtIdx) + `@${file.name} `);
    setAtMenuSearch(null);
    chatInputRef.current?.focus();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    (Array.from(files) as File[]).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const id = Math.random().toString(36).substr(2, 9);
        setFs(prev => {
          const next = { ...prev };
          const newNode: FileNode = { id, name: file.name, type: 'file', content, parentId: 'root' };
          next[id] = newNode;
          if (next['root']) {
            const root = next['root'] as FileNode;
            next['root'] = { ...root, children: [...(root.children || []), id] };
          }
          recordFsChange(next);
          return next;
        });
      };
      reader.readAsText(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteNode = (id: string) => {
    if (id === 'root') return;
    if (!window.confirm(`Delete node?`)) return;
    setFs(prev => {
      const next = { ...prev };
      const nodeToDelete = next[id] as FileNode;
      const parentId = nodeToDelete.parentId;
      if (parentId && next[parentId]) {
        next[parentId] = { ...(next[parentId] as FileNode), children: (next[parentId] as FileNode).children?.filter(cid => cid !== id) };
      }
      delete next[id];
      recordFsChange(next);
      return next;
    });
    setOpenTabs(prev => prev.filter(tid => tid !== id));
    if (activeFileId === id) setActiveFileId(null);
  };

  const handleRenameNode = (id: string) => {
    const oldName = (fs[id] as FileNode)?.name;
    const newName = prompt(`Rename:`, oldName);
    if (newName && newName !== oldName) {
      setFs(prev => {
        const next = { ...prev, [id]: { ...(prev[id] as FileNode), name: newName } };
        recordFsChange(next);
        return next;
      });
    }
  };

  const getLanguage = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch(ext) {
      case 'js': return 'javascript';
      case 'ts': return 'typescript';
      case 'html': return 'html';
      case 'css': return 'css';
      case 'json': return 'json';
      case 'py': return 'python';
      default: return 'markdown';
    }
  };

  const FileTreeItem: React.FC<{ id: string; depth: number }> = ({ id, depth }) => {
    const node = fs[id];
    if (!node) return null;
    const fileNode = node as FileNode;
    if (searchTerm && fileNode.type === 'file' && !fileNode.name.toLowerCase().includes(searchTerm.toLowerCase())) return null;

    return (
      <div className="select-none group">
        <div 
          className={`flex items-center py-4 px-5 cursor-pointer transition-all border-l-2 relative ${activeFileId === id ? 'bg-slate-900 text-teal-400 border-teal-500' : 'text-slate-500 border-transparent hover:bg-slate-900/40'}`}
          style={{ paddingLeft: `${depth * 16 + 20}px` }}
          onClick={() => {
            if (fileNode.type === 'folder') {
              setFs(prev => ({ ...prev, [id]: { ...(prev[id] as FileNode), isOpen: !(prev[id] as FileNode).isOpen } }));
            } else { 
              setActiveFileId(id); 
              if (!openTabs.includes(id)) setOpenTabs([...openTabs, id]); 
              setActiveView('editor'); 
            }
          }}
        >
          {fileNode.type === 'folder' ? (fileNode.isOpen ? <ChevronDown size={16} className="mr-3" /> : <ChevronRight size={16} className="mr-3" />) : <FileCode size={16} className="mr-3 opacity-40" />}
          <span className={`text-sm ${activeFileId === id ? 'font-bold' : 'font-medium'} truncate flex-1`}>{fileNode.name}</span>
          <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity pr-2">
            <button onClick={(e) => { e.stopPropagation(); handleRenameNode(id); }} className="p-1 hover:text-white transition-colors"><Edit3 size={14}/></button>
            <button onClick={(e) => { e.stopPropagation(); handleDeleteNode(id); }} className="p-1 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
          </div>
        </div>
        {fileNode.type === 'folder' && fileNode.isOpen && fileNode.children?.map(cid => <FileTreeItem key={cid} id={cid} depth={depth + 1} />)}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <header className="h-14 flex items-center justify-between px-6 border-b border-slate-900 bg-slate-950/90 backdrop-blur-xl z-[100] safe-area-inset">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 bg-gradient-to-tr from-teal-400 to-blue-500 rounded-lg shadow-lg">
            <Zap className="text-white" size={16} strokeWidth={3} />
          </div>
          <div className="flex flex-col">
            <h1 className="font-black text-[10px] tracking-[0.2em] uppercase italic text-white/90">WindSurf AI</h1>
            <div className="flex items-center space-x-1.5">
              {syncError ? <ShieldAlert size={10} className="text-red-500" /> : isSaving ? <Activity size={8} className="text-teal-400 animate-spin" /> : <CloudCheck size={10} className="text-slate-600" />}
              <span className={`text-[7px] font-bold uppercase tracking-widest ${syncError ? 'text-red-400' : 'text-slate-600'}`}>{syncError || (isSaving ? 'Syncing' : 'Ready')}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-slate-900/50 rounded-full px-2 py-1 mr-2">
            <button onClick={handleUndo} disabled={activeView === 'explorer' ? historyIndex <= 0 : false} className={`p-1.5 transition-all ${ (activeView === 'explorer' && historyIndex <= 0) ? 'text-slate-700' : 'text-slate-400 hover:text-teal-400 active:scale-75' }`}><Undo2 size={18} /></button>
            <button onClick={handleRedo} disabled={activeView === 'explorer' ? historyIndex >= fsHistory.length - 1 : false} className={`p-1.5 transition-all ${ (activeView === 'explorer' && historyIndex >= fsHistory.length - 1) ? 'text-slate-700' : 'text-slate-400 hover:text-teal-400 active:scale-75' }`}><Redo2 size={18} /></button>
          </div>
          <button onClick={() => setShowSettings(true)} className={`p-2 transition-colors text-slate-500 hover:text-white`}><Settings size={20} /></button>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden bg-slate-950">
        {activeView === 'explorer' && (
          <div className="absolute inset-0 flex flex-col animate-in slide-in-from-left duration-300">
            <div className="p-6 space-y-4 border-b border-slate-900 bg-slate-950/50">
              <div className="relative">
                <Search className="absolute left-4 top-3.5 text-slate-600" size={14} />
                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Filter project..." className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-3 pl-11 pr-4 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-teal-500/30 transition-all" />
              </div>
              <div className="grid grid-cols-4 gap-2">
                <button onClick={createNewFile} className="flex flex-col items-center justify-center space-y-1 py-3 bg-slate-900 border border-slate-800 rounded-xl text-[8px] font-black uppercase text-teal-400 active:scale-95 transition-all"><Plus size={14} /> <span>File</span></button>
                <button onClick={createNewFolder} className="flex flex-col items-center justify-center space-y-1 py-3 bg-slate-900 border border-slate-800 rounded-xl text-[8px] font-black uppercase text-blue-400 active:scale-95 transition-all"><FolderPlus size={14} /> <span>Dir</span></button>
                <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center space-y-1 py-3 bg-slate-900 border border-slate-800 rounded-xl text-[8px] font-black uppercase text-purple-400 active:scale-95 transition-all"><Upload size={14} /> <span>Import</span></button>
                <button onClick={() => {
                  const blob = new window.Blob([JSON.stringify(fs, null, 2)], { type: 'application/json' });
                  const link = document.createElement('a');
                  link.href = URL.createObjectURL(blob); link.download = `windsurf_backup.json`;
                  link.click();
                }} className="flex flex-col items-center justify-center space-y-1 py-3 bg-slate-900 border border-slate-800 rounded-xl text-[8px] font-black uppercase text-amber-400 active:scale-95 transition-all"><FileJson size={14} /> <span>Export</span></button>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleImportFile} />
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar pb-32"><FileTreeItem id="root" depth={0} /></div>
          </div>
        )}

        {activeView === 'editor' && (
          <div className="absolute inset-0 flex flex-col bg-slate-900 animate-in fade-in duration-300">
            <div className="h-11 bg-slate-950 flex border-b border-slate-900 items-center pr-4 overflow-hidden">
              <div className="flex flex-1 overflow-x-auto no-scrollbar">
                {openTabs.map(tabId => (
                  <div key={tabId} onClick={() => setActiveFileId(tabId)} className={`flex items-center px-6 h-full border-r border-slate-900 transition-all relative flex-shrink-0 ${activeFileId === tabId ? 'bg-slate-900 text-teal-400' : 'text-slate-600 hover:bg-slate-900/50'}`}>
                    <span className="text-[10px] font-black uppercase tracking-widest mr-4">{(fs[tabId] as FileNode)?.name}</span>
                    <X size={12} className="hover:text-red-500 cursor-pointer" onClick={(e) => { 
                      e.stopPropagation(); 
                      const next = openTabs.filter(id => id !== tabId); 
                      setOpenTabs(next); 
                      if (activeFileId === tabId) setActiveFileId(next[0] || null); 
                    }} />
                    {activeFileId === tabId && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500" />}
                  </div>
                ))}
              </div>
              <div className="flex items-center space-x-2 ml-4">
                <button onClick={buildPreview} className="p-2 text-teal-400 hover:text-white transition-colors active:scale-90" title="Preview"><Play size={18} /></button>
                {activeFileId && <button onClick={() => setShowSaveConfirm(true)} className="p-2 text-slate-500 hover:text-teal-400 transition-colors active:scale-90" title="Export"><Download size={18} /></button>}
              </div>
            </div>
            <div className="flex-1 relative">
              {activeFileId ? (
                <>
                  <Editor theme="vs-dark" onMount={(editor) => { editorRef.current = editor; }} language={getLanguage((fs[activeFileId] as FileNode)?.name)} value={(fs[activeFileId] as FileNode)?.content || ''} onChange={(val) => setFs(prev => ({ ...prev, [activeFileId]: { ...(prev[activeFileId] as FileNode), content: val || '' } }))} options={{ fontSize: 15, fontFamily: "'JetBrains Mono', monospace", minimap: { enabled: false }, padding: { top: 20 }, lineNumbers: 'on', wordWrap: 'on', smoothScrolling: true }} />
                  <button onClick={() => setShowEditorAi(!showEditorAi)} className="absolute bottom-8 right-8 p-4 bg-teal-500 text-white rounded-full shadow-2xl active:scale-90 transition-all z-[60] flex items-center space-x-2 ring-4 ring-slate-900/50"><Sparkles size={20} /><span className="text-xs font-black uppercase tracking-widest pr-2">Command</span></button>
                  {showEditorAi && (
                    <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[90%] max-w-lg bg-slate-900/95 backdrop-blur-2xl border border-teal-500/30 rounded-[2.5rem] p-5 shadow-2xl z-[70] animate-in zoom-in duration-200 ring-1 ring-white/10">
                       <div className="flex items-center space-x-3 mb-4 px-2"><Terminal size={14} className="text-teal-400" /><span className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-400">Context Intelligence</span></div>
                       <div className="flex items-center bg-black/40 rounded-2xl p-2 border border-white/5">
                         <input autoFocus value={editorAiPrompt} onChange={(e) => setEditorAiPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(editorAiPrompt)} placeholder={`Instruct for ${(fs[activeFileId] as FileNode).name}...`} className="flex-1 bg-transparent px-4 py-3 text-sm focus:outline-none placeholder:text-slate-600 font-medium" />
                         <button onClick={() => handleSendMessage(editorAiPrompt)} className="p-3 bg-teal-500 text-white rounded-xl active:scale-90 transition-transform"><ArrowRightCircle size={18} /></button>
                       </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-10"><FileCode size={80} /><p className="mt-6 text-xs font-black uppercase tracking-[0.5em]">Standby</p></div>
              )}
            </div>
          </div>
        )}

        {activeView === 'preview' && (
          <div className="absolute inset-0 flex flex-col bg-white animate-in zoom-in duration-300">
            <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center px-4 space-x-3">
              <div className="flex items-center space-x-1.5 flex-1 bg-slate-950/50 rounded-full px-4 py-2 border border-white/5">
                <Globe size={14} className="text-teal-400" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">windsurf://host/{(fs[activeFileId!] as FileNode)?.name || 'index.html'}</span>
              </div>
              <button onClick={buildPreview} className="p-2 text-slate-400 hover:text-white transition-all"><RotateCw size={18} /></button>
              <button onClick={() => setActiveView('editor')} className="p-2 text-slate-400 hover:text-red-400 transition-all"><X size={18} /></button>
            </div>
            <div className="flex-1 bg-white relative">
              {previewUrl ? <iframe src={previewUrl} className="w-full h-full border-none" /> : <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4"><Activity size={40} className="animate-pulse" /><p className="text-[10px] font-black uppercase tracking-[0.3em]">Initializing...</p></div>}
            </div>
          </div>
        )}

        {activeView === 'chat' && (
          <div className="absolute inset-0 flex flex-col bg-slate-950 animate-in slide-in-from-right duration-300">
             <div className="flex-1 overflow-y-auto p-6 space-y-10 pb-48 no-scrollbar chat-content">
               {chatHistory.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center opacity-30 text-center space-y-6 py-20">
                    <div className="w-20 h-20 bg-teal-500/10 rounded-3xl flex items-center justify-center border border-teal-500/20"><Cpu size={40} className="text-teal-400" /></div>
                    <p className="text-[10px] font-black uppercase tracking-widest">Architect Node Online</p>
                 </div>
               ) : (
                 chatHistory.map((msg) => (
                   <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                     <div className={`max-w-[92%] rounded-[2rem] px-6 py-5 text-sm leading-relaxed border shadow-2xl ${msg.role === 'user' ? 'bg-blue-600 border-blue-500 text-white rounded-br-none' : 'bg-slate-900 border-slate-800 text-slate-200 rounded-bl-none'}`}>
                       {msg.role === 'user' && msg.contextFileNames && msg.contextFileNames.length > 0 && (
                         <div className="flex flex-wrap gap-2 mb-3">{msg.contextFileNames.map(name => (<span key={name} className="flex items-center space-x-1 px-2 py-0.5 bg-blue-700/50 border border-blue-400/30 rounded-md text-[9px] font-black uppercase tracking-tighter"><Paperclip size={8} /> <span>{name}</span></span>))}</div>
                       )}
                       <p className="font-medium whitespace-pre-wrap">{msg.content}</p>
                       {msg.operations && msg.operations.length > 0 && (
                         <div className="mt-8 p-5 bg-black/60 rounded-3xl border border-white/5 space-y-5">
                           <div className="flex items-center justify-between"><div className="flex items-center space-x-2 text-teal-400"><HardDrive size={14} /><span className="text-[10px] font-black uppercase tracking-widest">Sync</span></div><span className="text-[9px] font-bold text-slate-500 uppercase">{msg.operations.length} Files</span></div>
                           <div className="space-y-2">{msg.operations.map((op, i) => (<div key={i} className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-white/5"><span className="text-[11px] font-bold font-mono text-slate-300 truncate">{op.path}</span><span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${op.action === 'create' ? 'bg-teal-500/20 text-teal-400' : 'bg-blue-500/20 text-blue-400'}`}>{op.action}</span></div>))}</div>
                           <button onClick={() => handleApplyArchitectPlan(msg.operations!)} className="w-full py-4 bg-teal-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-teal-500/20 active:scale-95 transition-all flex items-center justify-center space-x-3"><Sparkles size={14} /> <span>Apply Changes</span></button>
                         </div>
                       )}
                     </div>
                   </div>
                 ))
               )}
               {isAiLoading && <div className="p-4 bg-slate-900/50 rounded-3xl w-48 animate-pulse border border-slate-800 h-10"></div>}
             </div>
             <div className="absolute bottom-6 left-6 right-6 flex flex-col space-y-4">
               {selectedContextIds.length > 0 && (
                 <div className="flex flex-wrap gap-2 px-2">{selectedContextIds.map(id => (<div key={id} className="flex items-center space-x-2 bg-slate-900 border border-teal-500/30 text-teal-400 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl"><span>{(fs[id] as FileNode)?.name}</span><button onClick={() => setSelectedContextIds(prev => prev.filter(i => i !== id))} className="hover:text-red-500"><X size={12} /></button></div>))}</div>
               )}
               {atMenuSearch !== null && (
                 <div className="absolute bottom-full left-0 mb-4 w-72 bg-slate-900/95 backdrop-blur-2xl border border-teal-500/30 rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200 z-[120]">
                    <div className="p-4 border-b border-slate-800 text-[10px] font-black uppercase tracking-widest text-teal-400 flex items-center justify-between"><span>Context links</span><X size={12} className="cursor-pointer" onClick={() => setAtMenuSearch(null)} /></div>
                    <div className="max-h-48 overflow-y-auto no-scrollbar p-2">
                       {(Object.values(fs) as FileNode[]).filter(f => f.type === 'file' && f.name.toLowerCase().includes(atMenuSearch.toLowerCase())).map(f => (
                         <div key={f.id} onClick={() => selectFileSuggestion(f)} className="p-3 hover:bg-teal-500/10 rounded-xl cursor-pointer transition-colors flex items-center space-x-3"><FileCode size={14} className="text-slate-500" /><span className="text-[11px] font-bold text-slate-300">{f.name}</span></div>
                       ))}
                    </div>
                 </div>
               )}
               <div className="bg-slate-900/95 backdrop-blur-3xl border border-slate-800 rounded-[3rem] p-2 flex shadow-2xl items-center ring-1 ring-white/5 relative">
                 <button onClick={() => setIsContextSelectorOpen(!isContextSelectorOpen)} className={`p-4 transition-all ${selectedContextIds.length > 0 ? 'text-teal-400' : 'text-slate-600 hover:text-slate-400'}`}><Paperclip size={20} /></button>
                 <input ref={chatInputRef} value={userInput} onChange={handleChatInputChange} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Type '@' to link..." className="flex-1 bg-transparent px-4 py-4 text-sm focus:outline-none font-bold" />
                 <button onClick={() => handleSendMessage()} className="p-4 bg-teal-500 text-white rounded-full active:scale-90 transition-transform"><Send size={22} /></button>
               </div>
             </div>
          </div>
        )}
      </main>

      <nav className="h-20 bg-slate-950 border-t border-slate-900 flex items-center justify-around flex-shrink-0 pb-[env(safe-area-inset-bottom)] z-[90]">
        <button onClick={() => setActiveView('explorer')} className={`flex flex-col items-center flex-1 transition-all ${activeView === 'explorer' ? 'text-teal-400 font-black scale-110' : 'text-slate-700 font-medium'}`}><Layout size={22} /><span className="text-[9px] uppercase mt-1.5">Project</span></button>
        <button onClick={() => setActiveView('editor')} className={`flex flex-col items-center flex-1 transition-all ${activeView === 'editor' ? 'text-teal-400 font-black scale-110' : 'text-slate-700 font-medium'}`}><Code size={22} /><span className="text-[9px] uppercase mt-1.5">Editor</span></button>
        <button onClick={() => setActiveView('preview')} className={`flex flex-col items-center flex-1 transition-all ${activeView === 'preview' ? 'text-teal-400 font-black scale-110' : 'text-slate-700 font-medium'}`}><Eye size={22} /><span className="text-[9px] uppercase mt-1.5">Preview</span></button>
        <button onClick={() => setActiveView('chat')} className={`flex flex-col items-center flex-1 transition-all ${activeView === 'chat' ? 'text-teal-400 font-black scale-110' : 'text-slate-700 font-medium'}`}><MessageSquare size={22} /><span className="text-[9px] uppercase mt-1.5">Agent</span></button>
      </nav>

      {showSettings && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-[3.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[90vh]">
            <div className="px-10 pt-10 pb-6 flex items-center justify-between"><h2 className="text-xl font-black uppercase tracking-tighter text-white">Kernel Settings</h2><button onClick={() => setShowSettings(false)} className="p-3 bg-slate-800 rounded-full text-slate-500 hover:text-white"><X size={20} /></button></div>
            <div className="flex-1 px-10 py-6 space-y-10 overflow-y-auto no-scrollbar">
               <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-2">Intelligence Core</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'gemini-3-pro-preview', name: 'Architect Pro' },
                      { id: 'gemini-3-flash-preview', name: 'Flash Core' },
                    ].map(m => (
                      <div key={m.id} onClick={() => setSettings({ ...settings, model: m.id })} className={`p-4 rounded-3xl border-2 text-center transition-all cursor-pointer ${settings.model === m.id ? 'bg-teal-500/10 border-teal-500 text-teal-400' : 'bg-slate-950 border-slate-800 text-slate-600'}`}>
                        <span className="text-[10px] font-black uppercase tracking-widest">{m.name}</span>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
            <div className="p-10"><button onClick={() => setShowSettings(false)} className="w-full bg-gradient-to-tr from-teal-400 to-blue-600 text-white font-black uppercase py-7 rounded-[2.5rem] text-[10px] tracking-[0.2em]">Close Engine Panel</button></div>
          </div>
        </div>
      )}

      {showSaveConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="w-full max-w-sm bg-slate-900 border border-teal-500/30 rounded-[3rem] p-8 shadow-2xl animate-in zoom-in duration-200 text-center">
              <Download className="text-teal-400 mx-auto mb-6" size={32} />
              <h3 className="text-xl font-black uppercase tracking-tighter text-white mb-2">Export Code Node</h3>
              <p className="text-xs font-medium text-slate-400 mb-10 px-4">Download the active node buffer to your local system.</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setShowSaveConfirm(false)} className="py-5 bg-slate-800 text-slate-400 rounded-3xl text-[10px] font-black uppercase">Cancel</button>
                <button onClick={executeDownload} className="py-5 bg-teal-500 text-white rounded-3xl text-[10px] font-black uppercase">Export</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
