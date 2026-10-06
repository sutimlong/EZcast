import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Calendar, GripVertical, X } from 'lucide-react';
import { useAppContext, type SceneActor, type ScheduleDay, type Scene } from '../store/AppContext';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TextareaAutosize from 'react-textarea-autosize';


const SceneActorPill = ({ sa, scene, dayId, getActorLabel }: { sa: SceneActor, scene: Scene, dayId: string, getActorLabel: (sa: SceneActor) => string }) => {
  const { updateScene, actors } = useAppContext();
  const [hovered, setHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const uniqueId = `${sa.actorId}-${sa.costumeId}`;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: uniqueId });

  const actor = actors.find(a => a.id === sa.actorId);
  const costume = actor?.costumes.find(c => c.id === sa.costumeId);
  const photoUrl = costume?.photoUrl;

  const isLeadingRole = (title: string | undefined) => {
    if (!title) return false;
    return /(主演|主要演員|主角|男主|女主)/.test(title);
  };
  const isLeading = isLeadingRole(actor?.customTitle);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
    position: 'relative' as const,
    display: 'inline-flex', 
    alignItems: 'center', 
    gap: 6, 
    cursor: 'grab',
    ...(isLeading ? { border: '1px solid #FFD700', boxShadow: '0 0 8px rgba(255, 215, 0, 0.4)', color: '#B8860B', background: 'rgba(255, 215, 0, 0.15)' } : {})
  };

  return (
    <>
      <div 
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className="actor-pill" 
        style={style}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
      >
        <GripVertical size={14} style={{ opacity: 0.5, marginLeft: -4, marginRight: -4 }} />
        {getActorLabel(sa)}
        {hovered && (
          <span 
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.1)', borderRadius: '50%', padding: 2 }}
            onClick={(e) => {
              e.stopPropagation();
              const newActors = scene.actors.filter(a => !(a.actorId === sa.actorId && a.costumeId === sa.costumeId));
              updateScene(dayId, scene.id, { actors: newActors });
            }}
          >
            <X size={10} />
          </span>
        )}
      </div>
      {hovered && photoUrl && createPortal(
        <div style={{
          position: 'fixed',
          top: mousePos.y + 15,
          left: mousePos.x + 15,
          zIndex: 999999,
          pointerEvents: 'none',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          borderRadius: 8,
          overflow: 'hidden',
          width: 150,
          background: '#fff',
          border: '1px solid var(--glass-border)'
        }}>
          <img src={photoUrl} style={{ width: '100%', display: 'block', objectFit: 'cover' }} alt="定妝照" />
        </div>,
        document.body
      )}
    </>
  );
};

const SortableScene = ({ scene, dayId, getActorLabel }: { scene: Scene, dayId: string, getActorLabel: (sa: SceneActor) => string }) => {
  const { updateScene, removeScene, actors } = useAppContext();
  const [selectedScene, setSelectedScene] = useState<boolean>(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: scene.id });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const handleScroll = (e: Event) => {
      if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) {
        return;
      }
      if (selectedScene) setSelectedScene(false);
    };
    
    const handleClickOutside = (e: MouseEvent) => {
      if (
        selectedScene &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setSelectedScene(false);
      }
    };

    if (selectedScene) {
      window.addEventListener('scroll', handleScroll, true);
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedScene]);

  const toggleDropdown = () => {
    if (!selectedScene) {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) setDropdownRect(rect);
    }
    setSelectedScene(!selectedScene);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isDragging ? 'var(--white)' : 'inherit',
    zIndex: selectedScene ? 50 : (isDragging ? 10 : 1),
    position: 'relative' as const,
  };

  const handleAddActorToScene = (actorId: string, costumeId: string) => {
    if (scene.actors.some(a => a.actorId === actorId && a.costumeId === costumeId)) return;
    updateScene(dayId, scene.id, { actors: [...scene.actors, { actorId, costumeId }] });
  };

  return (
    <tr ref={setNodeRef} style={style}>
      <td style={{ textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', padding: 8, cursor: 'grab' }} {...attributes} {...listeners}>
          <GripVertical size={20} color="var(--text-secondary)" />
        </div>
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <select 
            value={scene.timeHour || ''} 
            onChange={e => updateScene(dayId, scene.id, { timeHour: e.target.value })} 
            style={{ width: 44, padding: '4px 0', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.5)', textAlign: 'center', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}
          >
            <option value="">hh</option>
            {Array.from({ length: 24 }).map((_, i) => (
              <option key={i} value={String(i).padStart(2, '0')}>{String(i).padStart(2, '0')}</option>
            ))}
          </select>
          <span style={{ fontWeight: 600 }}>:</span>
          <select 
            value={scene.timeMinute || ''} 
            onChange={e => updateScene(dayId, scene.id, { timeMinute: e.target.value })} 
            style={{ width: 44, padding: '4px 0', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.5)', textAlign: 'center', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}
          >
            <option value="">mm</option>
            {Array.from({ length: 60 }).map((_, i) => (
              <option key={i} value={String(i).padStart(2, '0')}>{String(i).padStart(2, '0')}</option>
            ))}
          </select>
        </div>
      </td>
      <td>
        <TextareaAutosize placeholder="text" value={scene.sceneName} onChange={e => updateScene(dayId, scene.id, { sceneName: e.target.value })} style={{ width: '100%', resize: 'none', textAlign: 'center' }} minRows={1} />
      </td>
      <td>
        <TextareaAutosize placeholder="text" value={scene.scriptPages} onChange={e => updateScene(dayId, scene.id, { scriptPages: e.target.value })} style={{ width: '100%', resize: 'none', textAlign: 'center' }} minRows={1} />
      </td>
      <td>
        <TextareaAutosize placeholder="text" value={scene.content} onChange={e => updateScene(dayId, scene.id, { content: e.target.value })} style={{ width: '100%', resize: 'none' }} minRows={1} />
      </td>
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <DndContext
            sensors={useSensors(
              useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
              useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
            )}
            collisionDetection={closestCenter}
            onDragEnd={(e) => {
              const { active, over } = e;
              if (active.id !== over?.id && over) {
                const oldIndex = scene.actors.findIndex(sa => `${sa.actorId}-${sa.costumeId}` === active.id);
                const newIndex = scene.actors.findIndex(sa => `${sa.actorId}-${sa.costumeId}` === over.id);
                if (oldIndex !== -1 && newIndex !== -1) {
                  const newActors = arrayMove(scene.actors, oldIndex, newIndex);
                  updateScene(dayId, scene.id, { actors: newActors });
                }
              }
            }}
          >
            <SortableContext items={scene.actors.map(sa => `${sa.actorId}-${sa.costumeId}`)} strategy={verticalListSortingStrategy}>
              {scene.actors.map((sa) => (
                <SceneActorPill key={`${sa.actorId}-${sa.costumeId}`} sa={sa} scene={scene} dayId={dayId} getActorLabel={getActorLabel} />
              ))}
            </SortableContext>
          </DndContext>
          <div style={{ position: 'relative' }}>
            <button ref={buttonRef} className="btn btn-outline" style={{ padding: '4px 12px', fontSize: 12, borderRadius: 9999 }} onClick={toggleDropdown}>
              添加演員及服裝
            </button>
            
            {selectedScene && dropdownRect && createPortal(
              <div 
                ref={dropdownRef}
                className="glass-panel" 
                style={{ 
                  position: 'fixed', 
                  top: dropdownRect.bottom + 4, 
                  left: dropdownRect.left, 
                  zIndex: 999999, 
                  padding: 12, 
                  minWidth: 200, 
                  maxHeight: 300, 
                  overflowY: 'auto', 
                  boxShadow: 'var(--shadow-glass)' 
                }}
              >
                {actors.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>請先去添加演員</div>}
                {actors.map(actor => (
                  <div key={actor.id} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{actor.name || actor.realName || '未命名'}</div>
                    {actor.costumes.map(costume => (
                      <div key={costume.id} style={{ fontSize: 12, padding: '4px 8px', cursor: 'pointer', background: 'rgba(255,255,255,0.5)', borderRadius: 4, marginBottom: 4 }} onClick={() => { handleAddActorToScene(actor.id, costume.id); setSelectedScene(false); }}>
                        {costume.name}
                      </div>
                    ))}
                  </div>
                ))}
              </div>,
              document.body
            )}
          </div>
        </div>
      </td>
      <td>
        <TextareaAutosize placeholder="text" value={scene.transport} onChange={e => updateScene(dayId, scene.id, { transport: e.target.value })} style={{ width: '100%', resize: 'none' }} minRows={1} />
      </td>
      <td style={{ textAlign: 'center' }}>
        <button className="btn btn-danger" style={{ padding: 4 }} onClick={() => removeScene(dayId, scene.id)}>
          <Trash2 size={16} />
        </button>
      </td>
    </tr>
  );
};

const SortableDay = ({ day, dayIndex, getWeekday, getActorLabel }: { day: ScheduleDay, dayIndex: number, getWeekday: (s: string) => string, getActorLabel: (sa: SceneActor) => string }) => {
  const { updateScheduleDay, addSceneToDay, reorderScenes, removeScheduleDay } = useAppContext();
  const dateRef = useRef<HTMLInputElement>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: day.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
    position: 'relative' as const
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEndScenes = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id && over) {
      reorderScenes(day.id, active.id as string, over.id as string);
    }
  };

  return (
    <div ref={setNodeRef} className="glass-panel" style={{ padding: 24, marginBottom: 24, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, background: 'rgba(255,255,255,0.6)', padding: '12px 24px', borderRadius: 'var(--radius-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div {...attributes} {...listeners} style={{ display: 'flex', alignItems: 'center', cursor: 'grab', marginRight: 8 }}>
            <GripVertical size={24} color="var(--primary-blue)" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 22, color: 'var(--primary-blue)' }}>
            DAY {dayIndex + 1}
          </span>
          <div 
            style={{ position: 'relative', display: 'inline-block' }}
            onClick={() => {
              try {
                dateRef.current?.showPicker();
              } catch {
                // Ignore if showPicker is not supported
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', background: 'var(--white)', border: '1px solid var(--glass-border)', borderRadius: 9999, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
              <Calendar size={16} color="var(--primary-blue)" />
              <span style={{ fontSize: 16, fontWeight: 500 }}>{day.date.replace(/-/g, '.')} {getWeekday(day.date)}</span>
            </div>
            <input 
              ref={dateRef}
              type="date" 
              value={day.date} 
              onChange={e => updateScheduleDay(day.id, { date: e.target.value })} 
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 10 }}
            />
          </div>
        </div>
        <button 
          className="btn btn-danger" 
          style={{ padding: '6px 12px', background: 'var(--primary-red)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => {
            if (window.confirm(`確定要刪除 DAY ${dayIndex + 1} 嗎？`)) {
              removeScheduleDay(day.id);
            }
          }}
        >
          <Trash2 size={16} /> 刪除
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndScenes}>
        <table className="schedule-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th style={{ width: 160, textAlign: 'center' }}>時間</th>
              <th style={{ width: 100, textAlign: 'center' }}>場次</th>
              <th style={{ width: 100, textAlign: 'center' }}>劇本頁數</th>
              <th style={{ textAlign: 'center' }}>拍攝內容</th>
              <th style={{ width: 250, textAlign: 'center' }}>演員</th>
              <th style={{ width: 150, textAlign: 'center' }}>備註</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            <SortableContext items={day.scenes.map(s => s.id)} strategy={verticalListSortingStrategy}>
              {day.scenes.map((scene) => (
                <SortableScene key={scene.id} scene={scene} dayId={day.id} getActorLabel={getActorLabel} />
              ))}
            </SortableContext>
          </tbody>
        </table>
      </DndContext>

      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <button className="btn btn-outline" onClick={() => addSceneToDay(day.id)}>
          <Plus size={16} style={{ marginRight: 8 }} /> 添加場次
        </button>
      </div>
    </div>
  );
};

export default function SchedulePage() {
  const navigate = useNavigate();
  const { actors, scheduleDays, addScheduleDay, reorderScheduleDays } = useAppContext();

  const getWeekday = (dateString: string) => {
    if (!dateString) return '';
    const [y, m, d] = dateString.split('-');
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
    if (isNaN(dateObj.getTime())) return '';
    return dateObj.toLocaleDateString('zh-TW', { weekday: 'long' });
  };

  const isLeadingRole = (title: string | undefined) => {
    if (!title) return false;
    return /(主演|主要演員|主角|男主|女主)/.test(title);
  };

  const getActorLabel = (sa: SceneActor) => {
    const actor = actors.find(a => a.id === sa.actorId);
    if (!actor) return '';
    const costume = actor.costumes.find(c => c.id === sa.costumeId);
    return `${actor.name || actor.realName || '演員'} - ${costume?.name || ''}`;
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEndDays = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id && over) {
      reorderScheduleDays(active.id as string, over.id as string);
    }
  };

  return (
    <div className="content-area page-slide-right">
      <div style={{ marginBottom: 32 }}>
        {actors.length === 0 ? (
          <div className="glass-panel" style={{ padding: 32, textAlign: 'center' }}>
            <button className="btn btn-primary" onClick={() => navigate('/actors', { state: { autoAdd: true } })}>
              <Plus size={18} style={{ marginRight: 8 }} /> 添加演員
            </button>
          </div>
        ) : (
          <div className="glass-panel" style={{ position: 'relative', padding: '32px 32px 24px 32px' }}>
            <button style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, padding: '6px 16px', fontSize: 14, background: 'var(--primary-blue)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 500 }} onClick={() => navigate('/actors')}>
              編輯演員
            </button>
            <div className="horizontal-scroll" style={{ gap: 48 }}>
              {actors.map((actor, index) => {
                const isLeading = isLeadingRole(actor.customTitle);
                return (
                  <div key={actor.id} style={{ minWidth: 170, textAlign: 'center' }}>
                    <div style={{ marginBottom: 8, fontWeight: 500, color: isLeading ? '#B8860B' : 'inherit' }}>{actor.customTitle || `演員 ${index + 1}`}</div>
                    <div style={{ width: 170, height: 225, background: isLeading ? 'rgba(255, 215, 0, 0.15)' : 'rgba(255,255,255,0.5)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', margin: '0 auto', border: isLeading ? '2px solid #FFD700' : '1px solid var(--glass-border)', boxShadow: isLeading ? '0 0 15px rgba(255, 215, 0, 0.3)' : undefined }}>
                      <img src={actor.standardPhotoUrl || './default-avatar.jpg'} alt="照片" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ marginTop: 8, fontSize: 14, fontWeight: 600, color: isLeading ? '#B8860B' : 'inherit' }}>{actor.name || '-'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{actor.realName || '-'}</div>
                  </div>
                );
              })}
            <div style={{ display: 'flex', alignItems: 'center', padding: 24 }}>
              <button className="btn btn-outline" style={{ borderRadius: '50%', width: 48, height: 48, padding: 0 }} onClick={() => navigate('/actors', { state: { autoAdd: true } })}>
                <Plus size={24} />
              </button>
            </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, margin: '0 0 16px 0' }}>拍攝場次</h2>
        
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndDays}>
          <SortableContext items={scheduleDays.map(d => d.id)} strategy={verticalListSortingStrategy}>
            {scheduleDays.map((day, dayIndex) => (
              <SortableDay key={day.id} day={day} dayIndex={dayIndex} getWeekday={getWeekday} getActorLabel={getActorLabel} />
            ))}
          </SortableContext>
        </DndContext>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button className="btn btn-primary" onClick={addScheduleDay}>
            <Plus size={18} style={{ marginRight: 8 }} /> 添加日期
          </button>
        </div>
      </div>
    </div>
  );
}
