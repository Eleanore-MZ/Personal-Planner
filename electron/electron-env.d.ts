/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  ipcRenderer: import('electron').IpcRenderer
  plannerAPI: {
    getSnapshot: () => Promise<import('./planner-db').PlannerSnapshot>
    createCategory: (
      input: import('./planner-db').CreateCategoryInput,
    ) => Promise<import('../src/types/domain').Category>
    updateCategory: (
      input: import('./planner-db').UpdateCategoryInput,
    ) => Promise<import('../src/types/domain').Category>
    deleteCategory: (categoryId: string) => Promise<string>
    updateStatsGroups: (
      input: import('./planner-db').UpdateStatsGroupsInput,
    ) => Promise<import('../src/types/domain').StatsGroup[]>
    createTask: (
      input: import('./planner-db').CreateTaskInput,
    ) => Promise<import('../src/types/domain').Task>
    updateTask: (
      input: import('./planner-db').UpdateTaskInput,
    ) => Promise<import('../src/types/domain').Task>
    deleteTask: (taskId: string) => Promise<string>
    updateTaskStatus: (
      taskId: string,
      status: import('../src/types/domain').Task['status'],
    ) => Promise<import('../src/types/domain').Task | undefined>
    createTimeBlock: (
      input: import('./planner-db').CreateTimeBlockInput,
    ) => Promise<import('../src/types/domain').TimeBlock>
    updateTimeBlock: (
      input: import('./planner-db').UpdateTimeBlockInput,
    ) => Promise<import('../src/types/domain').TimeBlock>
    updateRecurringTimeBlock: (
      input: import('./planner-db').UpdateRecurringTimeBlockInput,
    ) => Promise<import('./planner-db').PlannerSnapshot>
    deleteTimeBlock: (timeBlockId: string) => Promise<string>
  }
}
