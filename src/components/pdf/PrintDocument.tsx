import type { Actor, ScheduleDay, Costume } from '../../store/AppContext';

export type PaperSize = 'A4' | 'A3';
export type ColorMode = 'color' | 'grayscale';

interface PrintDocumentProps {
  movieName: string;
  actors: Actor[];
  scheduleDays: ScheduleDay[];
  paperSize: PaperSize;
  colorMode: ColorMode;
}

const COSTUMES_PER_ROW = 4;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function Photo({ src, label }: { src: string; label: string }) {
  return (
    <figure className="pd-photo">
      <div className="pd-photo-frame">
        {src ? <img src={src} alt={label} /> : <span className="pd-photo-empty">無照片</span>}
      </div>
      <figcaption>{label || '\u00a0'}</figcaption>
    </figure>
  );
}

function ActorBlock({ actor }: { actor: Actor }) {
  const rows = chunk<Costume | null>(actor.costumes, COSTUMES_PER_ROW);
  if (rows.length === 0) rows.push([]);

  const emergency = [actor.emergencyContactName, actor.emergencyContactPhone].filter(Boolean).join(' ');
  const infos: [string, string][] = [
    ['本名', actor.realName],
    ['電話', actor.contactPhone],
    ['Email', actor.email],
    ['緊急聯絡人', emergency]
  ].filter(([, v]) => Boolean(v)) as [string, string][];

  return (
    <section className="pd-actor">
      <header className="pd-actor-header">
        <h2>{actor.name || actor.realName || '未命名演員'}</h2>
        <div className="pd-actor-info">
          {infos.map(([k, v]) => (
            <span className="pd-info-pill" key={k}><b>{k}</b>{v}</span>
          ))}
        </div>
      </header>
      <div className="pd-actor-box">
        <div className="pd-actor-left">
          <Photo src={actor.standardPhotoUrl} label="" />
        </div>
        <div className="pd-actor-right">
          {rows.map((row, ri) => {
            // Pad to 4 so every photo keeps the same width.
            const padded = [...row, ...Array(COSTUMES_PER_ROW - row.length).fill(null)];
            return (
              <div className="pd-costume-row" key={ri}>
                {padded.map((c, ci) =>
                  c ? <Photo key={c.id} src={c.photoUrl} label={c.name} /> : <div key={`pad-${ci}`} className="pd-photo pd-photo-pad" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
function formatDate(date: string) {
  if (!date) return '';
  const [y, m, d] = date.split('-');
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
  if (isNaN(dateObj.getTime())) return date;
  return `${date.replace(/-/g, '.')}（${WEEKDAYS[dateObj.getDay()]}）`;
}

function DayBlock({ day, index, actors }: { day: ScheduleDay; index: number; actors: Actor[] }) {
  const actorLabel = (actorId: string, costumeId: string) => {
    const a = actors.find(x => x.id === actorId);
    if (!a) return '';
    const c = a.costumes.find(x => x.id === costumeId);
    return `${a.name || a.realName || '演員'}${c?.name ? ` - ${c.name}` : ''}`;
  };

  return (
    <section className="pd-day">
      <header className="pd-day-header">
        <h2>DAY {index + 1}</h2>
        {day.date && <span className="pd-date-pill">{formatDate(day.date)}</span>}
      </header>
      <table className="pd-table">
        <colgroup>
          <col style={{ width: '11%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '34%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '18%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>時間</th><th>場次</th><th>劇本頁數</th><th>拍攝內容</th><th>演員</th><th>備註</th>
          </tr>
        </thead>
        <tbody>
          {day.scenes.length === 0 ? (
            <tr className="pd-empty-row"><td /><td /><td /><td /><td /><td /></tr>
          ) : (
            day.scenes.map(s => {
              const time = (s.timeHour || s.timeMinute) ? `${s.timeHour || '--'}:${s.timeMinute || '--'}` : (s.time || '');
              return (
                <tr key={s.id}>
                  <td className="c">{time}</td>
                  <td className="c">{s.sceneName}</td>
                  <td className="c">{s.scriptPages}</td>
                  <td className="pre">{s.content}</td>
                  <td>
                    <ul className="pd-actor-list">
                      {s.actors.map(sa => (
                        <li key={`${sa.actorId}-${sa.costumeId}`}>{actorLabel(sa.actorId, sa.costumeId)}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="pre">{s.transport}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </section>
  );
}

export default function PrintDocument({ movieName, actors, scheduleDays, paperSize, colorMode }: PrintDocumentProps) {
  return (
    <div className={`print-doc paper-${paperSize} ${colorMode === 'grayscale' ? 'is-grayscale' : ''}`}>
      <h1 className="pd-title">{movieName || '電影名稱'} - 演員服裝造型表</h1>

      {actors.map(a => <ActorBlock key={a.id} actor={a} />)}

      {scheduleDays.length > 0 && <div style={{ breakBefore: 'page' }} />}
      {scheduleDays.map((d, i) => <DayBlock key={d.id} day={d} index={i} actors={actors} />)}

      <p className="pd-signature">蘇廷融拍攝與您同在，2026</p>
    </div>
  );
}
