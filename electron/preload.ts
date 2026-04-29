import { ipcRenderer, contextBridge } from 'electron'
import type {
  CreateCategoryInput,
  CreateTaskInput,
  CreateTimeBlockInput,
  PlannerSnapshot,
  UpdateCategoryInput,
  UpdateRecurringTimeBlockInput,
  UpdateTaskInput,
  UpdateTimeBlockInput,
} from './planner-db'
import type { Task } from '../src/types/domain'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // You can expose other APTs you need here.
  // ...
})

contextBridge.exposeInMainWorld('plannerAPI', {
  getSnapshot: (): Promise<PlannerSnapshot> => ipcRenderer.invoke('planner:getSnapshot'),
  createCategory: (input: CreateCategoryInput) =>
    ipcRenderer.invoke('planner:createCategory', input),
  updateCategory: (input: UpdateCategoryInput) =>
    ipcRenderer.invoke('planner:updateCategory', input),
  deleteCategory: (categoryId: string) =>
    ipcRenderer.invoke('planner:deleteCategory', categoryId),
  createTask: (input: CreateTaskInput) => ipcRenderer.invoke('planner:createTask', input),
  updateTask: (input: UpdateTaskInput) => ipcRenderer.invoke('planner:updateTask', input),
  deleteTask: (taskId: string) => ipcRenderer.invoke('planner:deleteTask', taskId),
  updateTaskStatus: (taskId: string, status: Task['status']) =>
    ipcRenderer.invoke('planner:updateTaskStatus', taskId, status),
  createTimeBlock: (input: CreateTimeBlockInput) =>
    ipcRenderer.invoke('planner:createTimeBlock', input),
  updateTimeBlock: (input: UpdateTimeBlockInput) =>
    ipcRenderer.invoke('planner:updateTimeBlock', input),
  updateRecurringTimeBlock: (input: UpdateRecurringTimeBlockInput) =>
    ipcRenderer.invoke('planner:updateRecurringTimeBlock', input),
  deleteTimeBlock: (timeBlockId: string) =>
    ipcRenderer.invoke('planner:deleteTimeBlock', timeBlockId),
})
