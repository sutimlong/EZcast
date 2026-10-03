export interface RecentProject {
  id: string;
  name: string;
  fileHandle: any;
  lastOpened: number;
}

const DB_NAME = 'ezcast_db_v2';
const STORE_NAME = 'recent_projects';

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const getRecentProjects = async (): Promise<RecentProject[]> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const results = request.result as RecentProject[];
        results.sort((a, b) => b.lastOpened - a.lastOpened);
        resolve(results.slice(0, 5));
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Failed to get recent projects', e);
    return [];
  }
};

export const saveRecentProject = async (name: string, fileHandle: any): Promise<void> => {
  if (!fileHandle) return;
  try {
    const db = await initDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // We generate an id based on name or just use a unique id. 
    // To update an existing one with same name, let's find it first.
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const results = request.result as RecentProject[];
        let id: string = crypto.randomUUID();
        const existing = results.find(r => r.name === name);
        if (existing) {
          id = existing.id;
        }
        
        const project: RecentProject = {
          id,
          name: name || '未命名專案',
          fileHandle,
          lastOpened: Date.now()
        };
        
        store.put(project);
        
        // Keep only top 5
        const all = [...results.filter(r => r.id !== id), project];
        all.sort((a, b) => b.lastOpened - a.lastOpened);
        
        if (all.length > 5) {
          const toDelete = all.slice(5);
          toDelete.forEach(p => store.delete(p.id));
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Failed to save recent project', e);
  }
};
export const removeRecentProject = async (id: string): Promise<void> => {
  try {
    const db = await initDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Failed to remove recent project', e);
  }
};
