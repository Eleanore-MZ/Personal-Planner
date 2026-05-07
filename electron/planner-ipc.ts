import { ipcMain } from 'electron'
import {
  createCategory,
  createTask,
  createTimeBlock,
  deleteCategory,
  deleteTask,
  deleteTimeBlock,
  getPlannerSnapshot,
  updateCategory,
  updateStatsGroups,
  updateTask,
  updateTaskStatus,
  updateRecurringTimeBlock,
  updateTimeBlock,
  type CreateCategoryInput,
  type CreateTaskInput,
  type CreateTimeBlockInput,
  type UpdateCategoryInput,
  type UpdateRecurringTimeBlockInput,
  type UpdateStatsGroupsInput,
  type UpdateTaskInput,
  type UpdateTimeBlockInput,
} from './planner-db'
import type { Task } from '../src/types/domain'

export function registerPlannerIpcHandlers() {
  ipcMain.handle('planner:getSnapshot', () => getPlannerSnapshot())
  ipcMain.handle('planner:createCategory', (_event, input: CreateCategoryInput) =>
    createCategory(input),
  )
  ipcMain.handle('planner:updateCategory', (_event, input: UpdateCategoryInput) =>
    updateCategory(input),
  )
  ipcMain.handle('planner:deleteCategory', (_event, categoryId: string) =>
    deleteCategory(categoryId),
  )
  ipcMain.handle('planner:updateStatsGroups', (_event, input: UpdateStatsGroupsInput) =>
    updateStatsGroups(input),
  )
  ipcMain.handle('planner:createTask', (_event, input: CreateTaskInput) =>
    createTask(input),
  )
  ipcMain.handle('planner:updateTask', (_event, input: UpdateTaskInput) =>
    updateTask(input),
  )
  ipcMain.handle('planner:deleteTask', (_event, taskId: string) =>
    deleteTask(taskId),
  )
  ipcMain.handle('planner:updateTaskStatus', (_event, taskId: string, status: Task['status']) =>
    updateTaskStatus(taskId, status),
  )
  ipcMain.handle('planner:createTimeBlock', (_event, input: CreateTimeBlockInput) =>
    createTimeBlock(input),
  )
  ipcMain.handle('planner:updateTimeBlock', (_event, input: UpdateTimeBlockInput) =>
    updateTimeBlock(input),
  )
  ipcMain.handle('planner:updateRecurringTimeBlock', (_event, input: UpdateRecurringTimeBlockInput) =>
    updateRecurringTimeBlock(input),
  )
  ipcMain.handle('planner:deleteTimeBlock', (_event, timeBlockId: string) =>
    deleteTimeBlock(timeBlockId),
  )
}
