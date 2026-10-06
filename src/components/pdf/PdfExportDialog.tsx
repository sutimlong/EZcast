import { useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { FileDown, X } from 'lucide-react';
import type { Actor, ScheduleDay } from '../../store/AppContext';
import PrintDocument, { type PaperSize, type ColorMode } from './PrintDocument';
import './print.css';

interface Props {
  open: boolean;
  onClose: () => void;
  movieName: string;
  actors: Actor[];
  scheduleDays: ScheduleDay[];
}

const getIpc = () => {
  try {
    return (window as any).electronAPI ?? (window as any).require?.('electron')?.ipcRenderer ?? null;
  } catch {
    return null;
  }
};

/** Wait until every image in the container is loaded & decoded and fonts are ready. */
async function waitForAssets(el: HTMLElement) {
  const imgs = Array.from(el.querySelectorAll('img'));
  await Promise.all(
    imgs.map(img =>
      img.complete && img.naturalWidth > 0
        ? img.decode().catch(() => {})
        : new Promise<void>(res => {
            img.onload = () => img.decode().catch(() => {}).finally(() => res());
            img.onerror = () => res();
          })
    )
  );
  await (document as any).fonts?.ready;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}

export default function PdfExportDialog({ open, onClose, movieName, actors, scheduleDays }: Props) {
  const [paperSize, setPaperSize] = useState<PaperSize>('A4');
  const [colorMode, setColorMode] = useState<ColorMode>('color');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const handleExport = async () => {
    setBusy(true);
    const host = document.createElement('div');
    host.id = 'print-root';
    document.body.appendChild(host);
    const root = createRoot(host);
    // Fallback (browser): make the CSS page size match the selection.
    const pageStyle = document.createElement('style');
    pageStyle.textContent = `@page { size: ${paperSize} landscape; margin: 12mm 11mm 16mm; }`;
    document.head.appendChild(pageStyle);

    try {
      flushSync(() => {
        root.render(
          <PrintDocument
            movieName={movieName}
            actors={actors}
            scheduleDays={scheduleDays}
            paperSize={paperSize}
            colorMode={colorMode}
          />
        );
      });
      await waitForAssets(host);
      document.body.classList.add('is-printing');

      const ipc = getIpc();
      if (ipc) {
        const safeName = (movieName || 'ez-cast').replace(/[\\/:*?"<>|]/g, '_');
        const result = await ipc.invoke('export-pdf', {
          pageSize: paperSize,
          defaultName: `${safeName}-演員服裝造型表`
        });
        if (!result?.canceled) {
          alert('PDF 匯出成功！');
          onClose();
        }
      } else {
        window.print();
        onClose();
      }
    } catch (e) {
      console.error(e);
      alert('PDF 匯出失敗，請再試一次。');
    } finally {
      document.body.classList.remove('is-printing');
      root.unmount();
      host.remove();
      pageStyle.remove();
      setBusy(false);
    }
  };

  return createPortal(
    <div className="pdf-dialog-backdrop" onClick={() => !busy && onClose()}>
      <div className="pdf-dialog glass-panel" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h3>匯出 PDF</h3>
          <button id="pdf-dialog-close" className="btn" style={{ padding: 4, background: 'transparent' }} onClick={onClose} disabled={busy}>
            <X size={18} />
          </button>
        </div>

        <p className="pdf-dialog-label">紙張大小</p>
        <div className="pdf-dialog-group">
          {(['A4', 'A3'] as PaperSize[]).map(s => (
            <button key={s} id={`pdf-size-${s}`} className={`pdf-option ${paperSize === s ? 'active' : ''}`} onClick={() => setPaperSize(s)}>
              <strong>{s}</strong>
              <small>{s === 'A4' ? '210 × 297 mm' : '297 × 420 mm'}</small>
            </button>
          ))}
        </div>

        <p className="pdf-dialog-label">色彩</p>
        <div className="pdf-dialog-group">
          <button id="pdf-color-color" className={`pdf-option ${colorMode === 'color' ? 'active' : ''}`} onClick={() => setColorMode('color')}>
            <strong>彩色</strong><small>保留照片原色</small>
          </button>
          <button id="pdf-color-gray" className={`pdf-option ${colorMode === 'grayscale' ? 'active' : ''}`} onClick={() => setColorMode('grayscale')}>
            <strong>黑白</strong><small>照片轉為灰階</small>
          </button>
        </div>

        <div className="pdf-dialog-actions">
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>取消</button>
          <button id="pdf-export-confirm" className="btn btn-primary" onClick={handleExport} disabled={busy}>
            <FileDown size={16} style={{ marginRight: 6 }} />
            {busy ? '產生中…' : '匯出'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
