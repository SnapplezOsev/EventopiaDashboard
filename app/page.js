'use client';

import { useState, useEffect, useReducer, useCallback, useRef } from 'react';
import Header from '@/components/Header';
import WeekGrid from '@/components/WeekGrid';
import TaskSidebar from '@/components/TaskSidebar';
import AssignmentModal from '@/components/AssignmentModal';
import TaskModal from '@/components/TaskModal';
import SettingsModal from '@/components/SettingsModal';
import MeetingModal from '@/components/MeetingModal';
import Screensaver from '@/components/Screensaver';

// --- State Reducer ---
const initialState = {
  functions: [],
  crew: { internal: [], freelancers: [] },
  tasks: [],
  weekStart: null,
  weekEnd: null,
  isLoading: true,
  error: null,
  selectedFunction: null,
  selectedTask: null,
  isTaskModalOpen: false,
  weekOffset: 0,
};

function dashboardReducer(state, action) {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, isLoading: true, error: null };
    case 'FETCH_SUCCESS':
      return {
        ...state,
        isLoading: false,
        functions: action.payload.functions || [],
        crew: action.payload.crew || { internal: [], freelancers: [] },
        tasks: action.payload.tasks || [],
        weekStart: action.payload.weekStart,
        weekEnd: action.payload.weekEnd,
      };
    case 'FETCH_ERROR':
      return { ...state, isLoading: false, error: action.payload };
    case 'SELECT_FUNCTION':
      return { ...state, selectedFunction: action.payload };
    case 'CLOSE_MODAL':
      return { ...state, selectedFunction: null };
    case 'OPEN_TASK_MODAL':
      return { ...state, selectedTask: action.payload, isTaskModalOpen: true };
    case 'CLOSE_TASK_MODAL':
      return { ...state, selectedTask: null, isTaskModalOpen: false };
    case 'CHANGE_WEEK':
      return { ...state, weekOffset: state.weekOffset + action.payload };
    case 'OPTIMISTIC_ASSIGN': {
      const { functionId, crewId, crewName, crewCategory, projectCrewId } = action.payload;
      return {
        ...state,
        functions: state.functions.map(f =>
          f.id === functionId
            ? {
                ...f,
                assignedCrew: [
                  ...f.assignedCrew,
                  { projectCrewId, crewId, name: crewName, category: crewCategory },
                ],
              }
            : f
        ),
        selectedFunction: state.selectedFunction?.id === functionId
          ? {
              ...state.selectedFunction,
              assignedCrew: [
                ...state.selectedFunction.assignedCrew,
                { projectCrewId, crewId, name: crewName, category: crewCategory },
              ],
            }
          : state.selectedFunction,
      };
    }
    case 'OPTIMISTIC_UNASSIGN': {
      const { projectCrewId: pcId } = action.payload;
      return {
        ...state,
        functions: state.functions.map(f => ({
          ...f,
          assignedCrew: f.assignedCrew.filter(c => c.projectCrewId !== pcId),
        })),
        selectedFunction: state.selectedFunction
          ? {
              ...state.selectedFunction,
              assignedCrew: state.selectedFunction.assignedCrew.filter(
                c => c.projectCrewId !== pcId
              ),
            }
          : null,
      };
    }
    default:
      return state;
  }
}

// --- Helper: Get ISO week string from offset ---
function getWeekString(offset = 0) {
  const now = new Date();
  const target = new Date(now);
  target.setDate(target.getDate() + offset * 7);

  // Get Monday of that week
  const day = target.getDay();
  const diff = target.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(target.setDate(diff));

  // ISO week number
  const startOfYear = new Date(monday.getFullYear(), 0, 1);
  const days = Math.floor((monday - startOfYear) / (24 * 60 * 60 * 1000));
  const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);

  const year = monday.getFullYear();
  const weekStr = `${year}-W${weekNum.toString().padStart(2, '0')}`;
  return weekStr;
}

// --- Helper: Get adaptive refresh interval ---
function getRefreshInterval() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const hour = now.getHours();

  // Tuesday afternoon meeting (13:00-17:00)
  if (day === 2 && hour >= 13 && hour < 17) {
    return 60 * 1000; // 1 minute
  }

  // Weekday office hours (07:00-18:00)
  if (day >= 1 && day <= 5 && hour >= 7 && hour < 18) {
    return 5 * 60 * 1000; // 5 minutes
  }

  // Off-hours & weekends
  return 15 * 60 * 1000; // 15 minutes
}

// --- Helper: Check if screensaver should be active ---
function shouldShowScreensaver(settings) {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 6=Sat
  const hour = now.getHours();
  const minute = now.getMinutes();
  const time = hour + minute / 60;

  // Weekend
  if (day === 0 || day === 6) return true;

  const startArr = (settings?.startTime || '09:50').split(':').map(Number);
  const endArr = (settings?.endTime || '19:00').split(':').map(Number);
  const startDecimal = startArr[0] + (startArr[1] || 0) / 60;
  const endDecimal = endArr[0] + (endArr[1] || 0) / 60;

  if (time < startDecimal || time >= endDecimal) return true;

  return false;
}

// --- Main Dashboard Component ---
export default function Dashboard() {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);
  const [screensaverActive, setScreensaverActive] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [retryCountdown, setRetryCountdown] = useState(null);
  const [settings, setSettings] = useState({
    startTime: '07:00',
    endTime: '19:00',
    wakeDuration: 2
  });
  const screensaverTimerRef = useRef(null);
  const wakeTimeoutRef = useRef(null);
  const forceSleepRef = useRef(false);

  const isAnyModalOpenRef = useRef(false);
  isAnyModalOpenRef.current = isSettingsModalOpen || isMeetingModalOpen || state.isTaskModalOpen || Boolean(state.selectedFunction);

  // Idle reset function: called on ANY user interaction when awake
  const resetIdleTimer = useCallback(() => {
    if (wakeTimeoutRef.current) {
      clearTimeout(wakeTimeoutRef.current);
      wakeTimeoutRef.current = null;
    }

    // If screensaver is currently showing, don't schedule sleep
    if (screensaverActive) return;

    // Check if we are outside office hours or in manual sleep mode
    const outsideOfficeHours = shouldShowScreensaver(settings);
    if (outsideOfficeHours || forceSleepRef.current) {
      const minutes = Math.max(1, Number(settings?.wakeDuration) || 2);
      const durationMs = minutes * 60 * 1000;

      wakeTimeoutRef.current = setTimeout(() => {
        wakeTimeoutRef.current = null;
        // Never put the screen to sleep if a modal is open!
        if (isAnyModalOpenRef.current) {
          resetIdleTimer();
          return;
        }
        setScreensaverActive(true);
      }, durationMs);
    }
  }, [screensaverActive, settings]);

  // Global activity listener (click, touch, pointer, keydown) to keep screen awake on interaction
  useEffect(() => {
    const onActivity = () => {
      if (!screensaverActive) {
        resetIdleTimer();
      }
    };

    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('touchstart', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity, { passive: true });

    // Initialize the idle timer
    resetIdleTimer();

    return () => {
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('touchstart', onActivity);
      window.removeEventListener('keydown', onActivity);
      if (wakeTimeoutRef.current) {
        clearTimeout(wakeTimeoutRef.current);
        wakeTimeoutRef.current = null;
      }
    };
  }, [screensaverActive, resetIdleTimer]);

  useEffect(() => {
    const saved = localStorage.getItem('dashboard_settings');
    if (saved) {
      try { setSettings(JSON.parse(saved)); } catch(e) {}
    }
  }, []);

  const handleSaveSettings = useCallback((newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('dashboard_settings', JSON.stringify(newSettings));
    setIsSettingsModalOpen(false);
    if (wakeTimeoutRef.current) {
      clearTimeout(wakeTimeoutRef.current);
      wakeTimeoutRef.current = null;
    }
    resetIdleTimer();
  }, [resetIdleTimer]);

  // Fetch data
  const fetchData = useCallback(async () => {
    dispatch({ type: 'FETCH_START' });
    try {
      const weekStr = getWeekString(state.weekOffset);
      const res = await fetch(`/api/schedule?week=${weekStr}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      dispatch({ type: 'FETCH_SUCCESS', payload: data });
      setRetryCountdown(null);
    } catch (err) {
      console.error('Failed to fetch schedule:', err);
      dispatch({ type: 'FETCH_ERROR', payload: err.message });
    }
  }, [state.weekOffset]);

  // Automatic retry timer on error (retries every 10 seconds)
  useEffect(() => {
    if (!state.error) {
      setRetryCountdown(null);
      return;
    }

    setRetryCountdown(10);
    const timer = setInterval(() => {
      setRetryCountdown(prev => {
        if (prev === null || prev <= 1) {
          fetchData();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [state.error, fetchData]);

  // Auto-refetch immediately when network comes back online
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network online — re-fetching schedule...');
      fetchData();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [fetchData]);

  // Initial fetch + adaptive interval
  useEffect(() => {
    fetchData();

    let intervalId;
    const setupInterval = () => {
      const interval = getRefreshInterval();
      intervalId = setInterval(() => {
        fetchData();
        // Recalculate interval in case time-of-day changed
        clearInterval(intervalId);
        setupInterval();
      }, interval);
    };
    setupInterval();

    return () => clearInterval(intervalId);
  }, [fetchData]);

  // Periodic screensaver schedule check (every 1 minute)
  useEffect(() => {
    const checkSchedule = () => {
      if (forceSleepRef.current) return; // Stay asleep if manually triggered

      if (shouldShowScreensaver(settings)) {
        if (!wakeTimeoutRef.current && !screensaverActive) {
          if (!isAnyModalOpenRef.current) {
            setScreensaverActive(true);
          }
        }
      } else {
        // Within office hours: wake up and cancel any sleep timeout
        if (wakeTimeoutRef.current) {
          clearTimeout(wakeTimeoutRef.current);
          wakeTimeoutRef.current = null;
        }
        setScreensaverActive(false);
      }
    };

    checkSchedule();
    screensaverTimerRef.current = setInterval(checkSchedule, 60 * 1000);

    return () => {
      if (screensaverTimerRef.current) clearInterval(screensaverTimerRef.current);
    };
  }, [settings, screensaverActive]);

  // Handle screensaver wake
  const handleWake = useCallback(() => {
    setScreensaverActive(false);
    forceSleepRef.current = false;
    resetIdleTimer();
  }, [resetIdleTimer]);

  // Handle week navigation
  const handleWeekChange = useCallback((delta) => {
    dispatch({ type: 'CHANGE_WEEK', payload: delta });
  }, []);

  // Handle function selection
  const handleFunctionClick = useCallback((func) => {
    dispatch({ type: 'SELECT_FUNCTION', payload: func });
  }, []);

  // --- Task Handlers ---
  const handleTaskClick = useCallback((task) => {
    dispatch({ type: 'OPEN_TASK_MODAL', payload: task });
  }, []);

  const handleCreateTask = useCallback(() => {
    dispatch({ type: 'OPEN_TASK_MODAL', payload: null });
  }, []);

  const handleSaveTask = useCallback(async (taskData) => {
    try {
      const isNew = !taskData.id;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch('/api/tasks', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to save task');
      }
      dispatch({ type: 'CLOSE_TASK_MODAL' });
      fetchData(); // Refresh tasks
    } catch (err) {
      console.error(err);
      alert(`Misslyckades att spara uppgiften: ${err.message}`);
    }
  }, [fetchData]);

  const handleTaskAssign = useCallback(async (taskId, crewId) => {
    try {
      const res = await fetch('/api/tasks/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, crewId }),
      });
      if (!res.ok) throw new Error('Failed to assign task');
      dispatch({ type: 'CLOSE_TASK_MODAL' });
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Misslyckades att tilldela uppgiften.');
    }
  }, [fetchData]);

  // --- Meeting Handlers ---
  const handleSaveMeeting = useCallback(async (meetingData) => {
    try {
      const isEdit = Boolean(meetingData.id);
      const res = await fetch('/api/meetings', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meetingData),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to save meeting');
      }
      setIsMeetingModalOpen(false);
      setEditingMeeting(null);
      fetchData();
    } catch (err) {
      console.error(err);
      alert(`Misslyckades att ${meetingData.id ? 'ändra' : 'boka'} mötet: ${err.message}`);
    }
  }, [fetchData]);

  const handleDeleteMeeting = useCallback(async (meetingId) => {
    try {
      const res = await fetch(`/api/meetings?id=${meetingId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete meeting');
      dispatch({ type: 'CLOSE_MODAL' });
      setIsMeetingModalOpen(false);
      setEditingMeeting(null);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Misslyckades att ta bort mötet.');
    }
  }, [fetchData]);

  // Handle crew assignment
  const handleAssign = useCallback(async (crewId) => {
    if (!state.selectedFunction) return;

    const allCrew = [...state.crew.internal, ...state.crew.freelancers];
    const crewMember = allCrew.find(c => c.id === crewId);
    if (!crewMember) return;

    // Optimistic update with temp ID
    const tempId = `temp-${Date.now()}`;
    dispatch({
      type: 'OPTIMISTIC_ASSIGN',
      payload: {
        functionId: state.selectedFunction.id,
        crewId,
        crewName: crewMember.name,
        crewCategory: crewMember.folderId === 40 ? 'internal' : 'freelancer',
        projectCrewId: tempId,
      },
    });

    try {
      const res = await fetch('/api/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionId: state.selectedFunction.id,
          crewId,
        }),
      });
      if (!res.ok) throw new Error('Assignment failed');
      // Refresh to get real IDs
      fetchData();
    } catch (err) {
      console.error('Failed to assign crew:', err);
      fetchData(); // Revert optimistic update
    }
  }, [state.selectedFunction, state.crew, fetchData]);

  // Handle crew unassignment
  const handleUnassign = useCallback(async (projectCrewId, isAppointment = false) => {
    dispatch({
      type: 'OPTIMISTIC_UNASSIGN',
      payload: { projectCrewId },
    });

    try {
      const res = await fetch('/api/unassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectCrewId, isAppointment }),
      });
      if (!res.ok) throw new Error('Unassignment failed');
      fetchData();
    } catch (err) {
      console.error('Failed to unassign crew:', err);
      fetchData(); // Revert
    }
  }, [fetchData]);

  // Count events for tomorrow (screensaver display)
  const tomorrowEventCount = (() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    return state.functions.filter(f => {
      const start = f.planperiod_start?.slice(0, 10);
      const end = f.planperiod_end?.slice(0, 10);
      return start <= tomorrowStr && end >= tomorrowStr;
    }).length;
  })();

  // Compute weekStart as a Date for the Header
  const weekStartDate = state.weekStart ? new Date(state.weekStart) : new Date();

  return (
    <div className="h-screen w-screen overflow-hidden p-4 flex flex-col gap-3">
      {/* Header */}
      <Header
        weekStart={weekStartDate}
        onWeekChange={handleWeekChange}
        onCreateMeeting={() => setIsMeetingModalOpen(true)}
      />

      {/* Reconnection Alert Banner if error occurs while having cached data */}
      {state.error && state.functions.length > 0 && (
        <div className="bg-amber-500/15 border border-amber-500/30 text-amber-200 px-4 py-2.5 rounded-2xl flex items-center justify-between text-sm backdrop-blur-md shadow-lg shrink-0">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
            <span className="font-medium">
              Nätverksanslutningen bröts — behåller sparad vy.
            </span>
            {retryCountdown !== null && (
              <span className="text-amber-300/80 text-xs font-mono bg-black/20 px-2 py-0.5 rounded-md">
                Återansluter om {retryCountdown}s...
              </span>
            )}
          </div>
          <button
            onClick={fetchData}
            className="px-4 py-1.5 bg-amber-500/25 hover:bg-amber-500/40 active:scale-95 text-amber-100 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            Återanslut nu
          </button>
        </div>
      )}

      {/* Main content: Grid + Sidebar */}
      <div className="flex-1 flex gap-3 min-h-0">
        {/* Week Grid */}
        <div className="flex-1 min-w-0">
          {state.isLoading && state.functions.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="inline-block w-12 h-12 border-4 border-white/20 border-t-blue-500 rounded-full animate-spin mb-4" />
                <p className="text-white/50 text-lg">Laddar schema...</p>
              </div>
            </div>
          ) : state.error && state.functions.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center glass-panel p-8 max-w-md">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-xl">
                  ⚠️
                </div>
                <p className="text-red-400 text-xl font-semibold mb-2">Kunde inte ansluta till Rentman</p>
                <p className="text-white/50 text-sm mb-4">{state.error}</p>
                {retryCountdown !== null && (
                  <p className="text-blue-400 text-xs font-mono mb-4 animate-pulse">
                    Återansluter automatiskt om {retryCountdown} sekunder...
                  </p>
                )}
                <button
                  onClick={fetchData}
                  className="touch-interactive px-6 py-3 bg-blue-600 hover:bg-blue-500 active:scale-95 rounded-xl font-medium transition-all shadow-lg"
                >
                  Försök nu
                </button>
              </div>
            </div>
          ) : (
            <WeekGrid
              functions={state.functions}
              weekStart={state.weekStart}
              onFunctionClick={handleFunctionClick}
            />
          )}
        </div>

        {/* Task Sidebar & Action Buttons */}
        <div className="w-[450px] flex-shrink-0 flex flex-col gap-3">
          <div className="flex-1 min-h-0">
            <TaskSidebar 
              tasks={state.tasks} 
              onTaskClick={handleTaskClick} 
              onCreateTask={handleCreateTask} 
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="flex-1 bg-white/5 hover:bg-white/10 active:scale-95 transition-all p-4 rounded-2xl border border-white/10 flex items-center justify-center gap-2 text-white font-medium shadow-sm"
            >
              <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Inställningar
            </button>
            <button
              onClick={() => {
                forceSleepRef.current = true;
                setScreensaverActive(true);
              }}
              className="flex-1 bg-white/5 hover:bg-white/10 active:scale-95 transition-all p-4 rounded-2xl border border-white/10 flex items-center justify-center gap-2 text-white font-medium shadow-sm"
            >
              <svg className="w-5 h-5 text-indigo-300" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path></svg>
              Sovläge
            </button>
          </div>
        </div>
      </div>

      {/* Assignment Modal */}
      {state.selectedFunction && (
        <AssignmentModal
          func={state.selectedFunction}
          crew={state.crew}
          onAssign={handleAssign}
          onUnassign={handleUnassign}
          onEditMeeting={(meeting) => {
            dispatch({ type: 'CLOSE_MODAL' });
            setEditingMeeting(meeting);
            setIsMeetingModalOpen(true);
          }}
          onDeleteMeeting={handleDeleteMeeting}
          onClose={() => dispatch({ type: 'CLOSE_MODAL' })}
        />
      )}

      {/* Task Modal */}
      {state.isTaskModalOpen && (
        <TaskModal
          task={state.selectedTask}
          crew={state.crew}
          onClose={() => dispatch({ type: 'CLOSE_TASK_MODAL' })}
          onSave={handleSaveTask}
          onAssign={handleTaskAssign}
        />
      )}

      {/* Meeting Modal */}
      {isMeetingModalOpen && (
        <MeetingModal
          meeting={editingMeeting}
          crew={state.crew}
          onClose={() => {
            setIsMeetingModalOpen(false);
            setEditingMeeting(null);
          }}
          onSave={handleSaveMeeting}
          onDelete={handleDeleteMeeting}
        />
      )}

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <SettingsModal
          currentSettings={settings}
          onSave={handleSaveSettings}
          onClose={() => setIsSettingsModalOpen(false)}
        />
      )}

      {/* Screensaver */}
      <Screensaver
        isActive={screensaverActive}
        onWake={handleWake}
        nextDayEventCount={tomorrowEventCount}
      />
    </div>
  );
}
