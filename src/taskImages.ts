/**
 * v1.7.3 (2026-10-15)
 * 改动：任务图片只走主进程，渲染层不保存图片内容。
 */

function ipc() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ipcRenderer } = require('electron')
  return ipcRenderer
}

export async function addTaskImages(todoId: string): Promise<string[]> {
  try {
    const names = await ipc().invoke('task-images-add', todoId)
    return Array.isArray(names) ? names.filter((name) => typeof name === 'string') : []
  } catch {
    return []
  }
}

export async function readTaskImage(todoId: string, name: string): Promise<string> {
  return ipc().invoke('task-images-read', todoId, name)
}

export async function deleteTaskImage(todoId: string, name: string): Promise<void> {
  await ipc().invoke('task-images-delete', todoId, name)
}

export async function deleteTaskImageFolder(todoId: string): Promise<void> {
  try {
    await ipc().invoke('task-images-delete-task', todoId)
  } catch { /* folder may already be gone */ }
}
