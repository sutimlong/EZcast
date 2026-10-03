import { createContext, useContext, useState, type ReactNode } from 'react';
import { arrayMove } from '@dnd-kit/sortable';

export interface Costume {
  id: string;
  photoUrl: string;
  name: string;
}

export interface Actor {
  id: string;
  customTitle?: string;
  name: string; // 劇中名稱
  realName: string; // 本名
  standardPhotoUrl: string;
  contactPhone: string;
  email: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  costumes: Costume[];
}

export interface SceneActor {
  actorId: string;
  costumeId: string;
}

export interface Scene {
  id: string;
  time: string;
  timeHour?: string;
  timeMinute?: string;
  sceneName: string;
  scriptPages: string;
  content: string;
  actors: SceneActor[];
  transport: string;
}

export interface ScheduleDay {
  id: string;
  dayNumber: number;
  date: string;
  scenes: Scene[];
}

interface AppContextType {
  actors: Actor[];
  setActors: React.Dispatch<React.SetStateAction<Actor[]>>;
  addActor: () => void;
  updateActor: (id: string, updates: Partial<Actor>) => void;
  removeActor: (id: string) => void;
  
  movieName: string;
  setMovieName: React.Dispatch<React.SetStateAction<string>>;
  scheduleDays: ScheduleDay[];
  setScheduleDays: React.Dispatch<React.SetStateAction<ScheduleDay[]>>;
  addScheduleDay: () => void;
  updateScheduleDay: (dayId: string, updates: Partial<ScheduleDay>) => void;
  removeScheduleDay: (dayId: string) => void;
  moveScheduleDayUp: (dayId: string) => void;
  moveScheduleDayDown: (dayId: string) => void;
  addSceneToDay: (dayId: string) => void;
  updateScene: (dayId: string, sceneId: string, updates: Partial<Scene>) => void;
  removeScene: (dayId: string, sceneId: string) => void;
  moveSceneUp: (dayId: string, sceneId: string) => void;
  moveSceneDown: (dayId: string, sceneId: string) => void;
  reorderScene: (dayId: string, sourceId: string, targetId: string) => void;
  reorderScheduleDays: (activeId: string, overId: string) => void;
  reorderScenes: (dayId: string, activeId: string, overId: string) => void;
  reorderActors: (activeId: string, overId: string) => void;
}

const defaultContext: AppContextType = {
  actors: [],
  setActors: () => {},
  addActor: () => {},
  updateActor: () => {},
  removeActor: () => {},
  movieName: '電影名稱',
  setMovieName: () => {},
  scheduleDays: [],
  setScheduleDays: () => {},
  addScheduleDay: () => {},
  updateScheduleDay: () => {},
  removeScheduleDay: () => {},
  moveScheduleDayUp: () => {},
  moveScheduleDayDown: () => {},
  addSceneToDay: () => {},
  updateScene: () => {},
  removeScene: () => {},
  moveSceneUp: () => {},
  moveSceneDown: () => {},
  reorderScene: () => {},
  reorderScheduleDays: () => {},
  reorderScenes: () => {},
  reorderActors: () => {},
};

const AppContext = createContext<AppContextType>(defaultContext);

const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const AppProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [movieName, setMovieName] = useState('電影名稱');
  
  const [actors, setActors] = useState<Actor[]>([]);
  
  const [scheduleDays, setScheduleDays] = useState<ScheduleDay[]>([
    {
      id: crypto.randomUUID(),
      dayNumber: 1,
      date: getLocalDateString(),
      scenes: []
    }
  ]);

  const addActor = () => {
    const newActor: Actor = {
      id: crypto.randomUUID(),
      name: '',
      realName: '',
      standardPhotoUrl: '',
      contactPhone: '',
      email: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      costumes: [
        { id: crypto.randomUUID(), photoUrl: '', name: '服裝A' }
      ]
    };
    setActors([...actors, newActor]);
  };

  const updateActor = (id: string, updates: Partial<Actor>) => {
    setActors(actors.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const removeActor = (id: string) => {
    setActors(actors.filter(a => a.id !== id));
  };

  const reorderActors = (activeId: string, overId: string) => {
    setActors((items) => {
      const oldIndex = items.findIndex(i => i.id === activeId);
      const newIndex = items.findIndex(i => i.id === overId);
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const addScheduleDay = () => {
    const newDay: ScheduleDay = {
      id: crypto.randomUUID(),
      dayNumber: scheduleDays.length + 1,
      date: getLocalDateString(),
      scenes: []
    };
    setScheduleDays([...scheduleDays, newDay]);
  };

  const updateScheduleDay = (dayId: string, updates: Partial<ScheduleDay>) => {
    setScheduleDays(days => days.map(day => day.id === dayId ? { ...day, ...updates } : day));
  };

  const removeScheduleDay = (dayId: string) => {
    setScheduleDays(days => days.filter(day => day.id !== dayId));
  };

  const moveScheduleDayUp = (dayId: string) => {
    setScheduleDays(days => {
      const idx = days.findIndex(d => d.id === dayId);
      if (idx > 0) {
        const newDays = [...days];
        const temp = newDays[idx - 1];
        newDays[idx - 1] = newDays[idx];
        newDays[idx] = temp;
        return newDays;
      }
      return days;
    });
  };

  const moveScheduleDayDown = (dayId: string) => {
    setScheduleDays(days => {
      const idx = days.findIndex(d => d.id === dayId);
      if (idx >= 0 && idx < days.length - 1) {
        const newDays = [...days];
        const temp = newDays[idx + 1];
        newDays[idx + 1] = newDays[idx];
        newDays[idx] = temp;
        return newDays;
      }
      return days;
    });
  };

  const addSceneToDay = (dayId: string) => {
    const newScene: Scene = {
      id: crypto.randomUUID(),
      time: '',
      timeHour: '',
      timeMinute: '',
      sceneName: '',
      scriptPages: '',
      content: '',
      actors: [],
      transport: ''
    };
    setScheduleDays(days => days.map(day => {
      if (day.id === dayId) {
        return { ...day, scenes: [...day.scenes, newScene] };
      }
      return day;
    }));
  };

  const updateScene = (dayId: string, sceneId: string, updates: Partial<Scene>) => {
    setScheduleDays(days => days.map(day => {
      if (day.id === dayId) {
        return {
          ...day,
          scenes: day.scenes.map(s => s.id === sceneId ? { ...s, ...updates } : s)
        };
      }
      return day;
    }));
  };

  const removeScene = (dayId: string, sceneId: string) => {
    setScheduleDays(days => days.map(day => {
      if (day.id === dayId) {
        return { ...day, scenes: day.scenes.filter(s => s.id !== sceneId) };
      }
      return day;
    }));
  };

  const moveSceneUp = (dayId: string, sceneId: string) => {
    setScheduleDays(days => days.map(day => {
      if (day.id === dayId) {
        const idx = day.scenes.findIndex(s => s.id === sceneId);
        if (idx > 0) {
          const newScenes = [...day.scenes];
          const temp = newScenes[idx - 1];
          newScenes[idx - 1] = newScenes[idx];
          newScenes[idx] = temp;
          return { ...day, scenes: newScenes };
        }
      }
      return day;
    }));
  };

  const moveSceneDown = (dayId: string, sceneId: string) => {
    setScheduleDays(days => days.map(day => {
      if (day.id === dayId) {
        const idx = day.scenes.findIndex(s => s.id === sceneId);
        if (idx >= 0 && idx < day.scenes.length - 1) {
          const newScenes = [...day.scenes];
          const temp = newScenes[idx + 1];
          newScenes[idx + 1] = newScenes[idx];
          newScenes[idx] = temp;
          return { ...day, scenes: newScenes };
        }
      }
      return day;
    }));
  };

  const reorderScene = (_dayId: string, _sourceId: string, _targetId: string) => {
    // keeping for backward compatibility if needed
  };

  const reorderScheduleDays = (activeId: string, overId: string) => {
    setScheduleDays((days) => {
      const oldIndex = days.findIndex(d => d.id === activeId);
      const newIndex = days.findIndex(d => d.id === overId);
      return arrayMove(days, oldIndex, newIndex);
    });
  };

  const reorderScenes = (dayId: string, activeId: string, overId: string) => {
    setScheduleDays((days) => days.map(day => {
      if (day.id === dayId) {
        const oldIndex = day.scenes.findIndex(s => s.id === activeId);
        const newIndex = day.scenes.findIndex(s => s.id === overId);
        return { ...day, scenes: arrayMove(day.scenes, oldIndex, newIndex) };
      }
      return day;
    }));
  };

  return (
    <AppContext.Provider value={{
      movieName, setMovieName,
      actors, setActors, addActor, updateActor, removeActor,
      scheduleDays, setScheduleDays, addScheduleDay, updateScheduleDay, removeScheduleDay, moveScheduleDayUp, moveScheduleDayDown, addSceneToDay,
      updateScene, removeScene, moveSceneUp, moveSceneDown, reorderScene, reorderScheduleDays, reorderScenes, reorderActors
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
