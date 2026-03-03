import { create } from 'zustand';

export const useTabStore = create((set, get) => ({
  tabs: [],
  activeTabId: null,

  openTab: (session) => {
    const { tabs } = get();
    const existing = tabs.find((t) => t.sessionId === session.id);
    if (existing) {
      set({ activeTabId: existing.id });
      return existing.id;
    }
    const id = crypto.randomUUID();
    const tab = { id, sessionId: session.id, name: session.name };
    set({ tabs: [...tabs, tab], activeTabId: id });
    return id;
  },

  closeTab: (tabId) => {
    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex((t) => t.id === tabId);
    const next = tabs.filter((t) => t.id !== tabId);
    let nextActive = activeTabId;
    if (activeTabId === tabId) {
      nextActive = next[Math.min(idx, next.length - 1)]?.id || null;
    }
    set({ tabs: next, activeTabId: nextActive });
  },

  setActiveTab: (tabId) => set({ activeTabId: tabId }),
}));
