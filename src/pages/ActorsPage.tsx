import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Plus, Image as ImageIcon, GripVertical, Trash2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAppContext, type Actor, type Costume } from '../store/AppContext';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, horizontalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const CostumeItem = ({ costume, actorId, handlePhotoUpload, handleDeleteCostume, handleDeletePhoto, handleChangeCostumeName }: { costume: Costume, actorId: string, handlePhotoUpload: any, handleDeleteCostume: any, handleDeletePhoto: any, handleChangeCostumeName: any }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: costume.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
    position: 'relative' as const,
  };
  const [hovered, setHovered] = useState(false);
  const [nameValue, setNameValue] = useState(costume.name);

  useEffect(() => {
    setNameValue(costume.name);
  }, [costume.name]);

  return (
    <div ref={setNodeRef} style={{ flexShrink: 0, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 4 }}>
        <div {...attributes} {...listeners} style={{ display: 'flex', alignItems: 'center', cursor: 'grab', color: 'var(--text-secondary)' }}>
          <GripVertical size={16} />
        </div>
        <input 
          value={nameValue} 
          onChange={(e) => setNameValue(e.target.value)} 
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.currentTarget.blur();
          }}
          style={{ fontWeight: 500, fontSize: 14, border: 'none', borderBottom: '1px dashed transparent', background: 'transparent', outline: 'none', padding: 0, margin: 0, width: '100%', transition: 'border-color 0.2s', marginTop: 2 }}
          onFocus={(e) => e.target.style.borderBottom = '1px dashed var(--primary-purple)'}
          onBlur={(e) => {
            e.target.style.borderBottom = '1px dashed transparent';
            const trimmed = nameValue.trim() || '未命名服裝';
            if (trimmed !== costume.name) {
              handleChangeCostumeName(actorId, costume.id, trimmed, () => {
                setNameValue(costume.name);
              });
            } else {
              setNameValue(trimmed);
            }
          }}
        />
      </div>
      <div
        style={{ position: 'relative', width: 180, height: 270, border: '1px dashed var(--primary-purple)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'rgba(255,255,255,0.5)' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', cursor: 'pointer' }}>
          {costume.photoUrl ? (
            <img src={costume.photoUrl} alt="定妝照" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: hovered ? 'grayscale(80%) brightness(40%)' : 'none', transition: 'all 0.2s' }} />
          ) : (
            <>
              <ImageIcon size={24} color="var(--primary-purple)" />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>定妝照</span>
            </>
          )}
          <input type="file" hidden accept="image/*,.heic,.heif" onChange={(e) => e.target.files && handlePhotoUpload(actorId, costume.id, e.target.files[0])} />
        </label>
        {hovered && costume.photoUrl && (
          <button
            className="btn btn-danger"
            style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', padding: '6px 12px', background: 'var(--primary-red)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDeletePhoto(costume.id);
            }}
          >
            <Trash2 size={16} /> 刪除照片
          </button>
        )}
      </div>
      <button 
        className="btn btn-danger" 
        style={{ width: '100%', marginTop: 8, padding: '6px 0', border: '1px solid var(--primary-red)', borderRadius: 'var(--radius-sm)' }}
        onClick={() => handleDeleteCostume(actorId, costume.id)}
      >
        <Trash2 size={16} style={{ marginRight: 4 }} /> 刪除服裝
      </button>
    </div>
  );
};

const SortableActor = ({ actor, index, handlePhotoUpload, handleAddCostume, handleDeleteCostume, handleChangeCostumeName }: { actor: Actor, index: number, handlePhotoUpload: any, handleAddCostume: any, handleDeleteCostume: any, handleChangeCostumeName: any }) => {
  const { updateActor, removeActor } = useAppContext();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: actor.id });

  const [hovered, setHovered] = useState(false);
  const [isTitleDirty, setIsTitleDirty] = useState(false);
  const initialTitleRef = useRef(actor.customTitle || '');
  
  const isLeadingRole = (title: string | undefined) => {
    if (!title) return false;
    return /(主演|主要演員|主角|男主|女主)/.test(title);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEndCostumes = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = actor.costumes.findIndex(c => c.id === active.id);
      const newIndex = actor.costumes.findIndex(c => c.id === over.id);
      updateActor(actor.id, {
        costumes: arrayMove(actor.costumes, oldIndex, newIndex)
      });
    }
  };

  const handleDeleteCostumePhoto = (costumeId: string) => {
    if (window.confirm('確定要刪除這張定妝照嗎？')) {
      const newCostumes = actor.costumes.map(c => c.id === costumeId ? { ...c, photoUrl: '' } : c);
      updateActor(actor.id, { costumes: newCostumes });
    }
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} className="glass-panel" style={{ padding: 24, border: isLeadingRole(actor.customTitle) ? '2px solid #FFD700' : undefined, boxShadow: isLeadingRole(actor.customTitle) ? '0 0 15px rgba(255, 215, 0, 0.3)' : undefined, ...style }}>
      <div {...attributes} {...listeners} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: 12, cursor: 'grab', color: 'var(--text-secondary)' }}>
        <GripVertical size={24} />
      </div>
      <button style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, padding: '4px 12px', background: 'var(--primary-red)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14, fontWeight: 500 }} onClick={() => removeActor(actor.id)}>
        刪除演員
      </button>
      <div style={{ display: 'flex', gap: 24, overflowX: 'auto', paddingRight: 64, paddingLeft: 24, paddingBottom: 16, alignItems: 'flex-start' }}>
        
        {/* Col 1 + Col 2 Sub-container */}
        <div style={{ display: 'flex', gap: 24, flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', width: 180, flexShrink: 0 }}>
              <input
                style={{ marginBottom: 8, fontWeight: 500, fontSize: 16, border: 'none', background: 'transparent', width: 180, textAlign: 'center', borderBottom: isLeadingRole(actor.customTitle) ? '1px dashed #FFD700' : '1px dashed var(--primary-cyan)', outline: 'none', padding: '4px 0', color: isLeadingRole(actor.customTitle) ? '#B8860B' : 'inherit' }}
                placeholder={`演員 ${index + 1}`}
                value={actor.customTitle || ''}
                onChange={(e) => {
                  updateActor(actor.id, { customTitle: e.target.value });
                  setIsTitleDirty(true);
                }}
                onFocus={(e) => { initialTitleRef.current = e.target.value; }}
                onBlur={(e) => {
                  if (isLeadingRole(e.target.value) && (isTitleDirty || !isLeadingRole(initialTitleRef.current))) {
                    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, zIndex: 9999, colors: ['#FFD700', '#FFA500', '#FF8C00'] });
                  }
                  setIsTitleDirty(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.currentTarget.blur();
                }}
              />
              <div
                style={{ position: 'relative', flex: 1, width: 180, border: isLeadingRole(actor.customTitle) ? '1px dashed #FFD700' : '1px dashed var(--primary-cyan)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'rgba(255,255,255,0.5)', display: 'flex', flexDirection: 'column' }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, cursor: 'pointer' }}>
              {actor.standardPhotoUrl ? (
                <img src={actor.standardPhotoUrl} alt="標準照片" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: hovered ? 'grayscale(80%) brightness(40%)' : 'none', transition: 'all 0.2s' }} />
              ) : (
                <>
                  <ImageIcon size={24} color="var(--primary-cyan)" />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>標準照片</span>
                </>
              )}
              <input type="file" hidden accept="image/*,.heic,.heif" onChange={(e) => e.target.files && handlePhotoUpload(actor.id, null, e.target.files[0])} />
            </label>
            {hovered && actor.standardPhotoUrl && (
              <button
                className="btn btn-danger"
                style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', padding: '6px 12px', background: 'var(--primary-red)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (window.confirm('確定要刪除標準照片嗎？')) {
                    updateActor(actor.id, { standardPhotoUrl: '' });
                  }
                }}
              >
                <Trash2 size={16} /> 刪除
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 250, flexShrink: 0, marginTop: 36 }}>
          <input placeholder="劇中名稱" value={actor.name} onChange={e => updateActor(actor.id, { name: e.target.value })} style={{ flex: 1 }} />
          <input placeholder="本名" value={actor.realName} onChange={e => updateActor(actor.id, { realName: e.target.value })} style={{ flex: 1 }} />
          <input placeholder="聯絡電話" value={actor.contactPhone} onChange={e => updateActor(actor.id, { contactPhone: e.target.value })} style={{ flex: 1 }} />
          <input placeholder="電子郵件" value={actor.email} onChange={e => updateActor(actor.id, { email: e.target.value })} style={{ flex: 1 }} />
          <input placeholder="緊急聯絡人姓名" value={actor.emergencyContactName} onChange={e => updateActor(actor.id, { emergencyContactName: e.target.value })} style={{ flex: 1 }} />
          <input placeholder="緊急聯絡人電話" value={actor.emergencyContactPhone} onChange={e => updateActor(actor.id, { emergencyContactPhone: e.target.value })} style={{ flex: 1 }} />
        </div>
      </div>

        <div style={{ display: 'flex', gap: 16, borderLeft: '1px solid var(--glass-border)', paddingLeft: 24 }}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndCostumes}>
            <SortableContext items={actor.costumes.map(c => c.id)} strategy={horizontalListSortingStrategy}>
              {actor.costumes.map(costume => (
                <CostumeItem key={costume.id} costume={costume} actorId={actor.id} handlePhotoUpload={handlePhotoUpload} handleDeleteCostume={handleDeleteCostume} handleDeletePhoto={handleDeleteCostumePhoto} handleChangeCostumeName={handleChangeCostumeName} />
              ))}
            </SortableContext>
          </DndContext>

          <div style={{ display: 'flex', alignItems: 'center', marginLeft: 16, flexShrink: 0 }}>
            <button className="btn btn-outline" style={{ whiteSpace: 'nowrap', flexShrink: 0 }} onClick={() => handleAddCostume(actor.id)}>
              <Plus size={16} style={{ marginRight: 4 }} /> 新增服裝
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ActorsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { actors, addActor, updateActor, reorderActors } = useAppContext();
  const hasAutoAdded = useRef(false);

  useEffect(() => {
    if (location.state?.autoAdd && !hasAutoAdded.current) {
      addActor();
      hasAutoAdded.current = true;
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 100);
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, addActor, navigate, location.pathname]);

  const handlePhotoUpload = (actorId: string, costumeId: string | null, file: File) => {
    const isSupported = file.type.match(/image\/(jpeg|jpg|png|webp|gif)/i) && !file.name.toLowerCase().endsWith('.heic');

    if (!isSupported) {
      alert('請將照片轉換為.jpg或.png格式');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      if (!costumeId) {
        updateActor(actorId, { standardPhotoUrl: url });
      } else {
        const actor = actors.find(a => a.id === actorId);
        if (actor) {
          const newCostumes = actor.costumes.map(c => c.id === costumeId ? { ...c, photoUrl: url } : c);
          updateActor(actorId, { costumes: newCostumes });
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddCostume = (actorId: string) => {
    const actor = actors.find(a => a.id === actorId);
    if (actor) {
      const letter = String.fromCharCode(65 + actor.costumes.length); // A, B, C...
      updateActor(actorId, {
        costumes: [...actor.costumes, { id: crypto.randomUUID(), photoUrl: '', name: `服裝${letter}` }]
      });
    }
  };

  const handleDeleteCostume = (actorId: string, costumeId: string) => {
    if (window.confirm('確定要刪除此服裝嗎？')) {
      const actor = actors.find(a => a.id === actorId);
      if (actor) {
        updateActor(actorId, {
          costumes: actor.costumes.filter(c => c.id !== costumeId)
        });
      }
    }
  };

  const handleChangeCostumeName = (actorId: string, costumeId: string, newName: string, onFail?: () => void) => {
    const actor = actors.find(a => a.id === actorId);
    if (actor) {
      if (actor.costumes.some(c => c.id !== costumeId && c.name === newName)) {
        alert('角色服裝名稱重複');
        if (onFail) onFail();
        return;
      }
      const newCostumes = actor.costumes.map(c => c.id === costumeId ? { ...c, name: newName } : c);
      updateActor(actorId, { costumes: newCostumes });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderActors(active.id as string, over.id as string);
    }
  };

  return (
    <div className="content-area page-slide-left">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24, gap: 16 }}>
        <button className="btn btn-outline" onClick={() => navigate('/')}>
          <ChevronLeft size={18} /> 上一頁
        </button>
        <h2 style={{ margin: 0, fontSize: 24 }}>演員資料及定妝照</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={actors.map(a => a.id)} strategy={verticalListSortingStrategy}>
            {actors.map((actor, index) => (
              <SortableActor
                key={actor.id}
                actor={actor}
                index={index}
                handlePhotoUpload={handlePhotoUpload}
                handleAddCostume={handleAddCostume}
                handleDeleteCostume={handleDeleteCostume}
                handleChangeCostumeName={handleChangeCostumeName}
              />
            ))}
          </SortableContext>
        </DndContext>

        <button className="btn btn-primary" onClick={addActor} style={{ alignSelf: 'center' }}>
          <Plus size={18} style={{ marginRight: 8 }} /> 新增演員
        </button>
      </div>
    </div>
  );
}
