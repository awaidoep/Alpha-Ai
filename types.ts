
export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  parentId: string | null;
  children?: string[];
  isOpen?: boolean;
}

export interface FileSystem {
  [id: string]: FileNode;
}

export interface FileOperation {
  path: string;
  content: string;
  action: 'create' | 'update';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  operations?: FileOperation[];
  timestamp: number;
  contextFileNames?: string[]; 
}

export interface AppSettings {
  theme: 'dark' | 'light';
  model: string;
}
