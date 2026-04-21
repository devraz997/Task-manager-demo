import { create } from 'zustand';
import type { AppState } from '../types';
import type { EngineAction } from '../engine/reconciliation';
import { reconcileAction } from '../engine/reconciliation';

interface AppStore extends AppState {
  dispatch: (action: EngineAction) => void;
  undo: () => void;
  redo: () => void;
  seek: (userEventIndex: number) => void;
  getUserActionEventIndices: () => number[];
}

export const useAppStore = create<AppStore>((set, get) => ({
  eventLog: [],
  cursor: 0,

  dispatch: (action: EngineAction) => {
    set((state) => reconcileAction(state, action));
  },

  undo: () => {
    const { eventLog, cursor } = get();
    // Find the previous user_action event
    let newCursor = cursor;
    while (newCursor > 0) {
      newCursor--;
      if (newCursor === 0 || eventLog[newCursor - 1]?.intent.reason === 'user_action') {
        break;
      }
    }
    // Now newCursor points to just after the previous user_action, or 0
    // Wait: if we have user_action at index 0 (length 1 batch), then after undo, cursor should be 0.
    // If we have user_action at index 0, and user_action at index 1... newCursor finds index 1.
    set({ cursor: newCursor });
  },

  redo: () => {
    const { eventLog, cursor } = get();
    if (cursor >= eventLog.length) return;
    
    // Find next user_action boundary
    let newCursor = cursor + 1;
    while (newCursor < eventLog.length && eventLog[newCursor].intent.reason !== 'user_action') {
      newCursor++;
    }
    set({ cursor: newCursor });
  },

  seek: (targetUserEventIndex: number) => {
    const { eventLog } = get();
    const indices = get().getUserActionEventIndices();
    if (targetUserEventIndex === 0) {
      set({ cursor: 0 });
    } else if (targetUserEventIndex <= indices.length) {
      // The user wants to go to the state AFTER the targeted user event
      const userEventLogIndex = indices[targetUserEventIndex - 1];
      // The cursor should be positioned after this user event and all its cascades
      let newCursor = userEventLogIndex + 1;
      while (newCursor < eventLog.length && eventLog[newCursor].intent.reason !== 'user_action') {
        newCursor++;
      }
      set({ cursor: newCursor });
    }
  },

  getUserActionEventIndices: () => {
    const { eventLog } = get();
    const indices: number[] = [];
    eventLog.forEach((e, i) => {
      if (e.intent.reason === 'user_action') indices.push(i);
    });
    return indices;
  }
}));
