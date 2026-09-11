"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(channel, (event, ...args2) => listener(event, ...args2));
  },
  off(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.off(channel, ...omit);
  },
  send(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.invoke(channel, ...omit);
  }
  // You can expose other APTs you need here.
  // ...
});
electron.contextBridge.exposeInMainWorld("plannerAPI", {
  getSnapshot: () => electron.ipcRenderer.invoke("planner:getSnapshot"),
  createCategory: (input) => electron.ipcRenderer.invoke("planner:createCategory", input),
  updateCategory: (input) => electron.ipcRenderer.invoke("planner:updateCategory", input),
  deleteCategory: (categoryId) => electron.ipcRenderer.invoke("planner:deleteCategory", categoryId),
  updateStatsGroups: (input) => electron.ipcRenderer.invoke("planner:updateStatsGroups", input),
  createTask: (input) => electron.ipcRenderer.invoke("planner:createTask", input),
  updateTask: (input) => electron.ipcRenderer.invoke("planner:updateTask", input),
  deleteTask: (taskId) => electron.ipcRenderer.invoke("planner:deleteTask", taskId),
  updateTaskStatus: (taskId, status) => electron.ipcRenderer.invoke("planner:updateTaskStatus", taskId, status),
  createTimeBlock: (input) => electron.ipcRenderer.invoke("planner:createTimeBlock", input),
  updateTimeBlock: (input) => electron.ipcRenderer.invoke("planner:updateTimeBlock", input),
  updateRecurringTimeBlock: (input) => electron.ipcRenderer.invoke("planner:updateRecurringTimeBlock", input),
  deleteTimeBlock: (timeBlockId) => electron.ipcRenderer.invoke("planner:deleteTimeBlock", timeBlockId)
});
