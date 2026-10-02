import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { Download, Upload, Save, FilePlus } from 'lucide-react';
import { AppProvider, useAppContext } from './store/AppContext';
import SchedulePage from './pages/SchedulePage';
import ActorsPage from './pages/ActorsPage';

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

  const handleNewFile = () => {
    if (window.confirm('確定要建立新檔案嗎？這將會清除當前畫面上所有未儲存的資料。')) {
      setMovieName('');
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
      alert('匯出成功！');
    } catch (e) {
      console.error(e);
    }
  };

  const handleLocalSave = async () => {
    const data = { movieName, actors, scheduleDays };
    const jsonString = JSON.stringify(data, null, 2);
    
    // Always backup to localStorage just in case
    localStorage.setItem('ezcast_save', JSON.stringify(data));

    if (fileHandle) {
      try {
        const writable = await fileHandle.createWritable();
        await writable.write(jsonString);
        await writable.close();
        alert('儲存成功！已直接寫入原檔案。');
      } catch (e) {
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
      if (data.movieName !== undefined) setMovieName(data.movieName);
      if (data.actors) setActors(data.actors);
      if (data.scheduleDays) setScheduleDays(data.scheduleDays);
      setFileHandle(handle);
      alert('匯入成功！後續點擊「儲存」將直接寫入此檔案。');
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="app-container" style={{ paddingTop: 38 }}>
      <TitleBar fileName={fileHandle?.name || ''} />
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
                      outline: 'none' 
                    }}
                    placeholder="請輸入電影名稱..."
                  />
                  <h1 style={{ margin: 0, fontSize: 36, fontWeight: 700, paddingBottom: 8, whiteSpace: 'nowrap' }}>演員與服裝管理資料庫</h1>
                </div>

                <div style={{ display: 'flex', gap: 8, paddingBottom: 16 }}>
                  <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 14 }} onClick={handleLocalSave}>
                    <Save size={16} style={{ marginRight: 6 }} /> 儲存
                  </button>
                  <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: 14 }} onClick={handleNewFile}>
                    <FilePlus size={16} style={{ marginRight: 6 }} /> 新增檔案
                  </button>
                  <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: 14 }} onClick={handleImport}>
                    <Download size={16} style={{ marginRight: 6 }} /> 匯入.cast
                  </button>
                  <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: 14 }} onClick={handleExport}>
                    <Upload size={16} style={{ marginRight: 6 }} /> 匯出.cast
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

        const interval: any = setInterval(function() {
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
