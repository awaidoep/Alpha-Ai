
import { FileNode, FileSystem } from '../types';

const DB_NAME = 'WindSurfFS';
const STORE_NAME = 'files';

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.error("IndexedDB Open Error:", request.error);
        reject(request.error);
      };
    } catch (e) {
      console.error("Critical Storage Initialization Error:", e);
      reject(e);
    }
  });
};

export const saveFileSystem = async (fs: FileSystem): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(fs, 'root_fs');
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.error("IndexedDB Put Error:", tx.error);
        reject(tx.error);
      };
    });
  } catch (e) {
    console.error("FileSystem Save Exception:", e);
  }
};

export const loadFileSystem = async (): Promise<FileSystem | null> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get('root_fs');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => {
        console.error("IndexedDB Get Error:", request.error);
        reject(request.error);
      };
    });
  } catch (e) {
    console.error("FileSystem Load Exception:", e);
    return null;
  }
};

export const createDefaultFS = (): FileSystem => {
  const rootId = 'root';
  const readmeId = 'readme';
  const mainJsId = 'mainjs';

  return {
    [rootId]: {
      id: rootId,
      name: 'WindSurf Project',
      type: 'folder',
      parentId: null,
      children: [readmeId, mainJsId],
      isOpen: true
    },
    [readmeId]: {
      id: readmeId,
      name: 'README.md',
      type: 'file',
      parentId: rootId,
      content: '# Welcome to WindSurf AI Editor\n\nStart coding with AI assistance. Tag files in chat with @ for context.\n\n### Commands\n- Use `Play` button to preview websites.\n- Use `Undo/Redo` for project changes.\n- Chat with Architect AI to generate code.'
    },
    [mainJsId]: {
      id: mainJsId,
      name: 'main.js',
      type: 'file',
      parentId: rootId,
      content: 'console.log("WindSurf Engine Online.");'
    }
  };
};
