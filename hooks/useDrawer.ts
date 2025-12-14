import { create } from 'zustand';

interface DrawerStore {
  leftDrawerOpen: boolean;
  rightDrawerOpen: boolean;
  openLeftDrawer: () => void;
  closeLeftDrawer: () => void;
  toggleLeftDrawer: () => void;
  openRightDrawer: () => void;
  closeRightDrawer: () => void;
  toggleRightDrawer: () => void;
  closeAllDrawers: () => void;
}

export const useDrawer = create<DrawerStore>((set) => ({
  leftDrawerOpen: false,
  rightDrawerOpen: false,
  openLeftDrawer: () => set({ leftDrawerOpen: true, rightDrawerOpen: false }),
  closeLeftDrawer: () => set({ leftDrawerOpen: false }),
  toggleLeftDrawer: () => set((state) => ({ 
    leftDrawerOpen: !state.leftDrawerOpen, 
    rightDrawerOpen: false 
  })),
  openRightDrawer: () => set({ rightDrawerOpen: true, leftDrawerOpen: false }),
  closeRightDrawer: () => set({ rightDrawerOpen: false }),
  toggleRightDrawer: () => set((state) => ({ 
    rightDrawerOpen: !state.rightDrawerOpen, 
    leftDrawerOpen: false 
  })),
  closeAllDrawers: () => set({ leftDrawerOpen: false, rightDrawerOpen: false }),
}));
