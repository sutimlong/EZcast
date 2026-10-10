import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Download, Upload, Save, FilePlus } from 'lucide-react';
import { AppProvider, useAppContext } from './store/AppContext';
import { getRecentProjects, saveRecentProject, removeRecentProject, type RecentProject } from './store/recentProjects';
import SchedulePage from './pages/SchedulePage';
import ActorsPage from './pages/ActorsPage';
import PdfExportDialog from './components/pdf/PdfExportDialog';

function TitleBar({ fileName }: { fileName: string }) {
  return (
    <div style={{
      height: 38,
      background: 'rgba(255, 255, 255, 0.7)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      WebkitAppRegion: 'drag',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999
    } as any}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
        EZ Cast{fileName ? ` — ${fileName}` : ' — 未命名檔案'}
      </span>
    </div>
  );
}

function AppContent() {
  const location = useLocation();
  const { movieName, setMovieName, actors, setActors, scheduleDays, setScheduleDays } = useAppContext();
  const isActorsPage = location.pathname === '/actors';

  const [fileHandle, setFileHandle] = useState<any>(null);
  const [openedFilePath, setOpenedFilePath] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);

  useEffect(() => {
    if (!hasStarted) {
      getRecentProjects().then(setRecentProjects);
    }
  }, [hasStarted]);

  // 解析 .cast 內容並載入到畫面上。
  const loadCastData = (json: string, path: string | null) => {
    try {
      const data = JSON.parse(json);
      if (!data || typeof data !== 'object' || !Array.isArray(data.actors) || !Array.isArray(data.scheduleDays)) {
        alert('檔案格式錯誤，匯入失敗。');
        return;
      }
      setMovieName(data.movieName || '');
      setActors(data.actors);
      setScheduleDays(data.scheduleDays);
      setFileHandle(null);
      setOpenedFilePath(path);
      setHasStarted(true);
    } catch (e) {
      console.error(e);
      alert('匯入失敗，請確認檔案格式是否正確。');
    }
  };

  // 支援在 Finder 雙擊 .cast 檔案直接開啟：
  // 1) 掛載後通知 main process 已就緒，由 main 推送「待開啟的檔案」。
  // 2) 之後若 App 已在執行中，雙擊 .cast 會透過 open-cast-file 事件送來。
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api) return;

    api.onOpenCastFile((payload: any) => {
      if (payload && typeof payload.content === 'string') {
        loadCastData(payload.content, payload.filePath || null);
      } else if (payload && payload.error) {
        alert(`開啟檔案失敗：${payload.error}`);
      }
    });

    api.invoke('renderer-ready').catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNewFile = (forceNew = false) => {
    if (forceNew || window.confirm('確定要建立新檔案嗎？這將會清除當前畫面上所有未儲存的資料。')) {
      setMovieName('電影名稱');
      setActors([]);

      // Need a simple date string for today
      const today = new Date();
      const offset = today.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(today.getTime() - offset)).toISOString().split('T')[0];

      setScheduleDays([{
        id: crypto.randomUUID(),
        dayNumber: 1,
        date: localISOTime,
        scenes: []
      }]);
      setFileHandle(null);
      setOpenedFilePath(null);
      localStorage.removeItem('ezcast_save');
    }
  };

  const handleExport = async () => {
    const data = { movieName, actors, scheduleDays };
    const jsonString = JSON.stringify(data, null, 2);
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: `${movieName || 'ez-cast'}.cast`,
        types: [{ description: 'Cast Files', accept: { 'application/json': ['.cast'] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(jsonString);
      await writable.close();
      setFileHandle(handle);
      setOpenedFilePath(null);
      await saveRecentProject(movieName, handle);
      alert('匯出成功！');
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportPdf = () => {
    setPdfDialogOpen(true);
  };

  const handleLocalSave = async () => {
    const data = { movieName, actors, scheduleDays };
    const jsonString = JSON.stringify(data, null, 2);

    // Always backup to localStorage just in case
    try {
      localStorage.setItem('ezcast_save', JSON.stringify(data));
    } catch {
      console.warn('LocalStorage backup failed (quota exceeded).');
    }

    if (openedFilePath) {
      // 從 Finder 雙擊開啟的檔案：直接寫回原路徑。
      try {
        const result = await (window as any).electronAPI?.invoke('save-cast-file', {
          filePath: openedFilePath,
          content: jsonString
        });
        if (result?.ok) {
          alert('儲存成功！已直接寫入原檔案。');
        } else {
          alert(`儲存失敗：${result?.error || '未知錯誤'}`);
        }
      } catch (e) {
        console.error(e);
        alert('儲存失敗，請嘗試使用「匯出」另存新檔。');
      }
    } else if (fileHandle) {
      try {
        const writable = await fileHandle.createWritable();
        await writable.write(jsonString);
        await writable.close();
        await saveRecentProject(movieName, fileHandle);
        alert('儲存成功！已直接寫入原檔案。');
      } catch (e) {
        console.error(e);
        alert('儲存失敗，請嘗試使用「匯出」另存新檔。');
      }
    } else {
      // If no file handle exists, redirect to Export (Save As)
      handleExport();
    }
  };

  const handleImport = async () => {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [{ description: 'Cast Files', accept: { 'application/json': ['.cast'] } }]
      });
      const file = await handle.getFile();
      const json = await file.text();
      const data = JSON.parse(json);
      
      if (!data || typeof data !== 'object' || !Array.isArray(data.actors) || !Array.isArray(data.scheduleDays)) {
        alert('檔案格式錯誤，匯入失敗。');
        return false;
      }

      setMovieName(data.movieName || '');
      setActors(data.actors);
      setScheduleDays(data.scheduleDays);
      setFileHandle(handle);
      setOpenedFilePath(null);
      await saveRecentProject(data.movieName, handle);
      alert('匯入成功！後續點擊「儲存」將直接寫入此檔案。');
      return true;
    } catch (error) {
      console.error(error);
      alert('匯入失敗，請確認檔案格式是否正確。');
      return false;
    }
  };

  if (!hasStarted) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)', zIndex: 100000 }}>
        <TitleBar fileName="" />
        <div className="glass-panel" style={{ padding: 48, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0, color: 'var(--primary-blue)' }}>歡迎使用 EZ Cast</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 16 }}>請選擇您要進行的操作</p>
          <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
            <button className="btn btn-primary" style={{ padding: '12px 24px', fontSize: 16 }} onClick={() => { handleNewFile(true); setHasStarted(true); }}>
              <FilePlus size={20} style={{ marginRight: 8 }} /> 開啟新專案
            </button>
            <button className="btn btn-outline" style={{ padding: '12px 24px', fontSize: 16 }} onClick={async () => {
              const success = await handleImport();
              if (success) setHasStarted(true);
            }}>
              <Download size={20} style={{ marginRight: 8 }} /> 開啟專案.cast
            </button>
          </div>

          {recentProjects.length > 0 && (
            <div style={{ marginTop: 24, width: '100%', textAlign: 'left', background: 'rgba(255,255,255,0.4)', borderRadius: 8, padding: 16 }}>
              <h3 style={{ fontSize: 16, margin: '0 0 12px 0', color: 'var(--text-secondary)' }}>最近開啟的專案</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recentProjects.map(p => (
                  <div
                    key={p.id}
                    style={{ padding: '12px 16px', background: 'var(--white)', borderRadius: 6, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}
                    onClick={async () => {
                      if (!p.fileHandle) {
                        alert('檔案已遺失或被刪除');
                        await removeRecentProject(p.id);
                        setRecentProjects(prev => prev.filter(r => r.id !== p.id));
                        return;
                      }
                      try {
                        // Check if we have permission, if not, browser might ask
                        const options = { mode: 'read' as const };
                        if ((await p.fileHandle.queryPermission(options)) !== 'granted') {
                          if ((await p.fileHandle.requestPermission(options)) !== 'granted') {
                            throw new Error('Permission denied');
                          }
                        }

                        const file = await p.fileHandle.getFile();
                        const json = await file.text();
                        const data = JSON.parse(json);

                        if (data.movieName !== undefined) setMovieName(data.movieName);
                        if (data.actors) setActors(data.actors);
                        if (data.scheduleDays) setScheduleDays(data.scheduleDays);
                        setFileHandle(p.fileHandle);
                        await saveRecentProject(p.name, p.fileHandle);
                        setHasStarted(true);
                      } catch (e) {
                        console.error(e);
                        alert('檔案已遺失或被刪除');
                        await removeRecentProject(p.id);
                        setRecentProjects(prev => prev.filter(r => r.id !== p.id));
                      }
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{p.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {new Date(p.lastOpened).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ position: 'absolute', bottom: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, opacity: 0.8 }}>
          <div style={{ marginBottom: 4 }}>v1.3.1</div>
          <div>蘇廷融拍攝與你同在，2026</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ paddingTop: 38 }}>
      <TitleBar fileName={fileHandle?.name || (openedFilePath ? openedFilePath.split('/').pop() || '' : '')} />
      <PdfExportDialog
        open={pdfDialogOpen}
        onClose={() => setPdfDialogOpen(false)}
        movieName={movieName}
        actors={actors}
        scheduleDays={scheduleDays}
      />
      <div className="header">
        <div className="header-actions" style={{ width: '100%' }}>
          {isActorsPage ? (
            <div />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flex: 1 }}>
                  <input
                    value={movieName}
                    onChange={e => setMovieName(e.target.value)}
                    style={{
                      fontSize: 36,
                      fontWeight: 700,
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '4px solid var(--primary-blue)',
                      padding: '0 0 8px 0',
                      margin: 0,
                      color: 'inherit',
                      width: 280,
                      outline: 'none',
                      textAlign: 'center'
                    }}
                    placeholder="請輸入電影名稱..."
                  />
                  <h1 style={{ margin: 0, fontSize: 36, fontWeight: 700, paddingBottom: 8, whiteSpace: 'nowrap' }}>演員與服裝管理資料庫</h1>
                </div>

                <div style={{ display: 'flex', gap: 8, paddingBottom: 16 }}>
                  <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 14 }} onClick={handleLocalSave}>
                    <Save size={16} style={{ marginRight: 6 }} /> 儲存
                  </button>
                  <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: 14 }} onClick={() => handleNewFile()}>
                    <FilePlus size={16} style={{ marginRight: 6 }} /> 新增檔案
                  </button>
                  <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: 14 }} onClick={handleImport}>
                    <Download size={16} style={{ marginRight: 6 }} /> 匯入.cast
                  </button>
                  <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: 14 }} onClick={handleExport}>
                    <Upload size={16} style={{ marginRight: 6 }} /> 匯出.cast
                  </button>
                  <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: 14 }} onClick={handleExportPdf}>
                    <Upload size={16} style={{ marginRight: 6 }} /> 匯出.pdf
                  </button>
                </div>
              </div>
              <h2 style={{ margin: 0, fontSize: 24, color: '#000000' }}>演員</h2>
            </div>
          )}
        </div>
      </div>

      <Routes>
        <Route path="/" element={<SchedulePage />} />
        <Route path="/actors" element={<ActorsPage />} />
      </Routes>

      <div className="footer" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={(e) => {
        const duration = 2000;
        const animationEnd = Date.now() + duration;
        const xOrigin = e.clientX;
        const yOrigin = e.clientY;

        const interval: any = setInterval(function () {
          if (Date.now() > animationEnd) return clearInterval(interval);

          const heart = document.createElement('div');
          heart.innerText = ['❤️', '💖', '💗'][Math.floor(Math.random() * 3)];
          heart.style.position = 'fixed';
          heart.style.left = `${xOrigin + (Math.random() * 40 - 20)}px`;
          heart.style.top = `${yOrigin}px`;
          heart.style.fontSize = `${Math.random() * 16 + 16}px`;
          heart.style.pointerEvents = 'none';
          heart.style.transition = 'all 2s ease-out';
          heart.style.transform = 'translate(-50%, -50%)';
          heart.style.zIndex = '999999';
          heart.style.opacity = '1';
          document.body.appendChild(heart);

          // Trigger animation in next frame
          setTimeout(() => {
            heart.style.top = `${yOrigin - (Math.random() * 150 + 150)}px`;
            heart.style.left = `${xOrigin + (Math.random() * 100 - 50)}px`;
            heart.style.opacity = '0';
          }, 50);

          setTimeout(() => heart.remove(), 2000);
        }, 100);
      }}>
        蘇廷融拍攝與你同在，2026
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </AppProvider>
  );
}
