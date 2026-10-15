/**
 * v1.7.0 (2026-10-15)
 * v1.7.3 (2026-10-15)
 * 改动：任务可附加多张图片，只保存文件名；删除任务时清掉图片目录。
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Minus, Pin, CircleCheck, Trash2, Bell, ArrowRight, Droplet, Sparkles, Power, Globe } from 'lucide-react'
import TodoInput from './components/TodoInput'
import TodoList from './components/TodoList'
import { getTranslation } from './i18n'
import type { Language } from './i18n'
import { applyPineTheme, readSavedPine, DEFAULT_PINE, PINE_KEY, PINE_SWATCHES, normalizeHex } from './theme'
import { addTaskImages, deleteTaskImage, deleteTaskImageFolder } from './taskImages'

export type TodoBucket = 'today' | 'later'

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  dueTime?: Date | null;
  details?: string;
  bucket: TodoBucket;
  images: string[];
}

interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  releaseUrl: string;
  releaseNotes: string;
}

const STORAGE_KEY = 'softdo-todos'
const BUCKET_KEY = 'softdo-active-bucket'
const SKIP_VERSION_KEY = 'softdo-skip-version'
const OPACITY_KEY = 'softdo-opacity'
const LAST_RUN_VERSION_KEY = 'softdo-version'
const VERSION = 'v1.7.0'
const LANGUAGE_KEY = 'softdo-language'

function App() {
  const [todos, setTodos] = useState<Todo[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed.map((item: Todo) => ({
          ...item,
          dueTime: item.dueTime ? new Date(item.dueTime) : null,
          bucket: item.bucket === 'later' ? 'later' : 'today',
          images: Array.isArray(item.images) ? item.images.filter((name) => typeof name === 'string') : []
        }))
      }
    } catch { /* Ignore parse errors */ }
    return []
  })
  
  const [opacity, setOpacity] = useState(() => {
    const saved = localStorage.getItem(OPACITY_KEY)
    return saved ? parseFloat(saved) : 1
  })
  
  const [isPinned, setIsPinned] = useState(false)
  const [showOpacityControl, setShowOpacityControl] = useState(false)
  const [, setTick] = useState(0)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [showWelcome, setShowWelcome] = useState(false)
  const [showVersionToast, setShowVersionToast] = useState(false)
  const opacityRef = useRef<HTMLDivElement>(null)
  const colorPickingRef = useRef(false)
  const [pineColor, setPineColor] = useState<string>(() => readSavedPine())
  const [autoStart, setAutoStart] = useState(false)
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem(LANGUAGE_KEY)
    return (saved === 'zh' || saved === 'en') ? saved : 'en'
  })
  const t = getTranslation(language)
  const [activeBucket, setActiveBucket] = useState<TodoBucket>(() => {
    const saved = localStorage.getItem(BUCKET_KEY)
    return saved === 'later' ? 'later' : 'today'
  })
  const visibleTodos = todos.filter(todo => todo.bucket === activeBucket)
  const remainingCount = visibleTodos.filter(todo => !todo.completed).length
  
  // Resize logic
  const isResizing = useRef(false)
  const resizeDir = useRef<string>('')
  const startPos = useRef({ x: 0, y: 0 })
  const startBounds = useRef({ x: 0, y: 0, w: 0, h: 0 })

  const handleResizeStart = (e: React.MouseEvent, dir: string) => {
    e.preventDefault()
    isResizing.current = true
    resizeDir.current = dir
    startPos.current = { x: e.screenX, y: e.screenY }
    startBounds.current = { 
      x: window.screenX, 
      y: window.screenY, 
      w: window.outerWidth, 
      h: window.outerHeight 
    }
    
    document.body.style.cursor = dir === 'se' ? 'nwse-resize' : 'nesw-resize'
    document.body.style.userSelect = 'none'
  }

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return

    requestAnimationFrame(() => {
      const deltaX = e.screenX - startPos.current.x
      const deltaY = e.screenY - startPos.current.y
      const dir = resizeDir.current
      
      let newW = startBounds.current.w
      let newH = startBounds.current.h
      let newX = startBounds.current.x
      const newY = startBounds.current.y // Top doesn't change for bottom resize

      // Calculate dimensions based on direction
      if (dir === 'se') {
        newW = Math.max(320, startBounds.current.w + deltaX)
        newH = Math.max(480, startBounds.current.h + deltaY)
      } else if (dir === 'sw') {
        // For left resize: width changes inverse to delta, X changes by delta
        // We need to ensuring width >= minWidth
        const rawW = startBounds.current.w - deltaX
        if (rawW >= 320) {
            newW = rawW
            newX = startBounds.current.x + deltaX
        } else {
            // Clamped
            newW = 320
            newX = startBounds.current.x + (startBounds.current.w - 320)
        }
        newH = Math.max(480, startBounds.current.h + deltaY)
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { ipcRenderer } = require('electron')
        ipcRenderer.send('resize-window', { 
            width: newW, 
            height: newH,
            x: newX,
            y: newY
        })
      } catch { /* Not in Electron */ }
    })
  }, [])

  const handleResizeEnd = useCallback(() => {
    isResizing.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    document.addEventListener('mousemove', handleResizeMove)
    document.addEventListener('mouseup', handleResizeEnd)
    return () => {
      document.removeEventListener('mousemove', handleResizeMove)
      document.removeEventListener('mouseup', handleResizeEnd)
    }
  }, [handleResizeMove, handleResizeEnd])
  
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
  }, [todos])

  useEffect(() => {
    localStorage.setItem(BUCKET_KEY, activeBucket)
  }, [activeBucket])

  useEffect(() => {
    localStorage.setItem(OPACITY_KEY, opacity.toString())
  }, [opacity])

  useEffect(() => {
    applyPineTheme(pineColor)
    localStorage.setItem(PINE_KEY, pineColor)
  }, [pineColor])

  // Click outside to close opacity control
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorPickingRef.current) return
      if (opacityRef.current && !opacityRef.current.contains(event.target as Node)) {
        setShowOpacityControl(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(interval)
  }, [])

  // Check version for welcome message
  useEffect(() => {
    const lastRunVersion = localStorage.getItem(LAST_RUN_VERSION_KEY)
    if (lastRunVersion !== VERSION) {
      setTimeout(() => setShowWelcome(true), 1000)
      localStorage.setItem(LAST_RUN_VERSION_KEY, VERSION)
    }
  }, [])

  // Check auto-launch status on mount
  useEffect(() => {
    const checkAutoLaunch = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { ipcRenderer } = require('electron');
        const enabled = await ipcRenderer.invoke('get-auto-launch');
        setAutoStart(enabled);
      } catch { /* Not in Electron */ }
    };
    checkAutoLaunch();
  }, [])

  // Auto-update check
  useEffect(() => {
    const checkUpdate = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { ipcRenderer } = require('electron');
        const result = await ipcRenderer.invoke('check-for-updates');
        
        // Ensure strictly newer version
        const currentVerNum = VERSION.replace('v', '');
        const latestVerNum = result.latestVersion.replace('v', '');

        if (result.hasUpdate && latestVerNum !== currentVerNum) {
          const skippedVersion = localStorage.getItem(SKIP_VERSION_KEY);
          if (skippedVersion !== result.latestVersion) {
            setTimeout(() => {
              setUpdateInfo(result);
            }, 5000);
          }
        }
      } catch { /* Not in Electron or network error */ }
    }

    checkUpdate();
  }, [])

  const addTodo = (text: string, dueTime?: Date | null, details?: string) => {
    const note = details?.trim()
    setTodos(prev => [...prev, {
      id: crypto.randomUUID(),
      text: text.trim(),
      completed: false,
      dueTime,
      details: note || undefined,
      bucket: activeBucket,
      images: []
    }])
  }

  const toggleTodo = (id: string) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t))
  }

  const deleteTodo = (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id))
    void deleteTaskImageFolder(id)
  }

  const addImages = async (id: string) => {
    const names = await addTaskImages(id)
    if (names.length === 0) return
    setTodos(prev => prev.map(t => t.id === id ? { ...t, images: [...t.images, ...names] } : t))
  }

  const removeImage = async (id: string, name: string) => {
    await deleteTaskImage(id, name)
    setTodos(prev => prev.map(t => t.id === id ? { ...t, images: t.images.filter(item => item !== name) } : t))
  }
  
  const renameTodo = (id: string, newText: string) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, text: newText } : t))
  }

  const updateDetails = (id: string, details: string) => {
    const note = details.trim()
    setTodos(prev => prev.map(t => {
      if (t.id !== id) return t
      if ((t.details || '') === note) return t
      return { ...t, details: note || undefined }
    }))
  }

  const reorderTodos = (fromIndex: number, toIndex: number) => {
    setTodos(prev => {
      const bucketItems = prev.filter(item => item.bucket === activeBucket)
      const [removed] = bucketItems.splice(fromIndex, 1)
      bucketItems.splice(toIndex, 0, removed)
      let i = 0
      return prev.map(item => item.bucket === activeBucket ? bucketItems[i++] : item)
    })
  }

  const moveTodo = (id: string, bucket: TodoBucket) => {
    setTodos(prev => prev.map(item => item.id === id ? { ...item, bucket } : item))
  }

  const updateDue = (id: string, dueTime: Date | null) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, dueTime } : t))
  }

  const clearAll = () => {
    setTodos(prev => prev.filter(item => item.bucket !== activeBucket))
  }

  // Sync with main process for notifications
  useEffect(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ipcRenderer } = require('electron')
      ipcRenderer.send('update-notification-schedule', todos)
    } catch { /* Not in Electron */ }
  }, [todos])

  const closeApp = () => window.close()
  const minimizeApp = () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ipcRenderer } = require('electron');
      ipcRenderer.send('minimize-window'); // Uses minimize-to-tray if configured
    } catch { /* Not in Electron */ }
  }

  const togglePin = () => {
    setIsPinned(!isPinned);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ipcRenderer } = require('electron');
      ipcRenderer.send('toggle-always-on-top', !isPinned);
    } catch { /* Not in Electron */ }
  }

  const handleUpdate = () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ipcRenderer } = require('electron');
      ipcRenderer.send('open-release-page');
    } catch { /* Not in Electron */ }
    setUpdateInfo(null);
  }

  const skipUpdate = () => {
    if (updateInfo) {
      localStorage.setItem(SKIP_VERSION_KEY, updateInfo.latestVersion);
      setUpdateInfo(null);
    }
  }

  const closeUpdate = () => setUpdateInfo(null)
  const closeWelcome = () => setShowWelcome(false)

  const toggleAutoStart = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ipcRenderer } = require('electron');
      const newValue = await ipcRenderer.invoke('set-auto-launch', !autoStart);
      setAutoStart(newValue);
    } catch { /* Not in Electron */ }
  }

  return (
    <div className="h-screen w-screen p-4 bg-transparent flex flex-col">
      {/* Main Container */}
      <div 
        className="relative flex-1 w-full rounded-[28px] overflow-hidden flex flex-col border border-white/60 transition-colors duration-200 backdrop-blur-3xl"
        style={{ backgroundColor: `rgba(232, 240, 235, ${opacity})` }}
      >
        
        {/* Window Controls */}
        <div className="flex items-center justify-between px-5 py-4 app-drag-region relative z-50">
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <span className="w-1.5 h-1.5 rounded-[2px] bg-pine" />
            <span className="text-sm font-semibold text-neu-text">SoftDo</span>

            <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                   // Mock version check
                   try {
                     // eslint-disable-next-line @typescript-eslint/no-require-imports
                     const { ipcRenderer } = require('electron');
                     ipcRenderer.invoke('check-for-updates').then((result: any) => {
                        if (!result.hasUpdate) {
                            setShowVersionToast(true);
                            setTimeout(() => setShowVersionToast(false), 3000);
                        } else {
                            setUpdateInfo(result);
                        }
                     });
                   } catch {
                       setShowVersionToast(true);
                       setTimeout(() => setShowVersionToast(false), 3000);
                   }
                }}
                className="app-no-drag text-[10px] font-medium text-stone/80 hover:text-pine transition-colors cursor-pointer relative z-50 px-1" 
                title="Click to check for updates"
            >
                {VERSION}
            </motion.button>
          </motion.div>
          
          <div className="flex items-center gap-1.5 app-no-drag">
            {/* Opacity Control */}
            <div className="relative" ref={opacityRef}>
              <motion.button
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => setShowOpacityControl(!showOpacityControl)}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer ${
                  showOpacityControl ? 'bg-pine/15 text-pine' : 'hover:bg-black/5 text-neu-text/30'
                }`}
              >
                <Droplet size={11} fill={showOpacityControl ? 'currentColor' : 'none'} strokeWidth={3} />
              </motion.button>
              
              <AnimatePresence>
                {showOpacityControl && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.95 }}
                    className="absolute top-9 right-0 w-52 p-2.5 bg-white/98 backdrop-blur-2xl rounded-xl shadow-xl border border-gray-200/60 flex flex-col gap-2 items-center z-50 origin-top-right"
                  >
                    <div className="w-full flex justify-between text-[10px] text-neu-muted font-medium px-0.5">
                      <span>{t.opacity}</span>
                      <span>{Math.round(opacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="1"
                      step="0.01"
                      value={opacity}
                      onChange={(e) => setOpacity(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-pine-soft rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-pine [&::-webkit-slider-thumb]:shadow-sm outline-none"
                    />
                    
                    <div className="w-full h-px bg-gray-100" />

                    <div className="w-full flex flex-col gap-1.5 px-0.5">
                      <div className="w-full flex items-center justify-between">
                        <span className="text-[10px] text-neu-muted font-medium">{t.accentColor}</span>
                        <button
                          type="button"
                          onClick={() => setPineColor(DEFAULT_PINE)}
                          className="text-[10px] font-medium text-stone/70 hover:text-pine cursor-pointer"
                        >
                          {t.resetColor}
                        </button>
                      </div>
                      <div className="grid grid-cols-7 gap-1.5 items-center">
                        {PINE_SWATCHES.map((swatch) => (
                          <button
                            key={swatch}
                            type="button"
                            title={swatch}
                            onClick={() => setPineColor(swatch)}
                            className={`w-5 h-5 rounded-full border cursor-pointer ${
                              pineColor === swatch ? 'border-ink ring-2 ring-pine/30' : 'border-black/10'
                            }`}
                            style={{ backgroundColor: swatch }}
                          />
                        ))}
                        <label className="w-5 h-5 rounded-full border border-dashed border-stone/40 overflow-hidden cursor-pointer relative">
                          <span className="absolute inset-[3px] rounded-full" style={{ backgroundColor: pineColor }} />
                          <input
                            type="color"
                            value={pineColor}
                            onFocus={() => { colorPickingRef.current = true }}
                            onBlur={() => { window.setTimeout(() => { colorPickingRef.current = false }, 250) }}
                            onChange={(e) => setPineColor(normalizeHex(e.target.value))}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                        </label>
                      </div>
                    </div>
                    
                    <div className="w-full h-px bg-gray-100" />
                    
                    {/* Auto Start Toggle */}
                    <button
                      onClick={toggleAutoStart}
                      className="w-full flex items-center justify-between px-1 py-1 rounded-lg hover:bg-pine-soft transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Power size={12} className={autoStart ? 'text-pine' : 'text-neu-muted/50'} />
                        <span className="text-[10px] font-medium text-neu-muted">{t.autoStart}</span>
                      </div>
                      <div className={`w-7 h-4 rounded-full transition-colors ${autoStart ? 'bg-pine' : 'bg-gray-200'} flex items-center px-0.5`}>
                        <motion.div 
                          animate={{ x: autoStart ? 12 : 0 }}
                          className="w-3 h-3 bg-white rounded-full shadow-sm"
                        />
                      </div>
                    </button>
                    
                    {/* Divider */}
                    <div className="w-full h-px bg-gray-100" />
                    
                    {/* Language Toggle */}
                    <button
                      onClick={() => {
                        const newLang = language === 'en' ? 'zh' : 'en'
                        setLanguage(newLang)
                        localStorage.setItem(LANGUAGE_KEY, newLang)
                      }}
                      className="w-full flex items-center justify-between px-1 py-1 rounded-lg hover:bg-pine-soft transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Globe size={12} className="text-neu-muted/50" />
                        <span className="text-[10px] font-medium text-neu-muted">{t.language}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-medium">
                        <span className={language === 'en' ? 'text-pine' : 'text-neu-muted/40'}>EN</span>
                        <span className="text-neu-muted/30">/</span>
                        <span className={language === 'zh' ? 'text-pine' : 'text-neu-muted/40'}>中</span>
                      </div>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              onClick={togglePin}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer ${
                isPinned ? 'bg-pine/15 text-pine' : 'hover:bg-black/5 text-neu-text/30'
              }`}
            >
              <Pin size={11} fill={isPinned ? 'currentColor' : 'none'} strokeWidth={3} />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              onClick={minimizeApp}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/5 text-neu-text/30 transition-all duration-300 cursor-pointer ml-1"
            >
              <Minus size={11} strokeWidth={3} />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.06, backgroundColor: 'rgba(212,86,78,0.1)' }}
              whileTap={{ scale: 0.94 }}
              onClick={closeApp}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:text-red-400 text-neu-text/30 transition-all duration-300 cursor-pointer"
            >
              <X size={11} strokeWidth={3} />
            </motion.button>
          </div>
        </div>

        {/* Welcome Notification */}
        <AnimatePresence>
          {showWelcome && !updateInfo && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginBottom: 0 }}
              animate={{ height: 'auto', opacity: 1, marginBottom: 8 }}
              exit={{ height: 0, opacity: 0, marginBottom: 0 }}
              className="px-5 overflow-hidden flex-shrink-0 relative z-40"
            >
              <div className="bg-pine-soft rounded-xl p-3 flex items-start gap-3 border border-pine-line">
                <div className="p-1.5 bg-pine rounded-lg text-white mt-0.5">
                  <Sparkles size={14} />
                </div>
                <div className="flex-1 min-w-0 z-10">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-ink tracking-normal">{t.welcome} {VERSION}!</span>
                    <button onClick={closeWelcome} className="text-pine/75 hover:text-pine-deep transition-colors p-0.5 hover:bg-pine-soft rounded-full">
                      <X size={12} />
                    </button>
                  </div>
                  <p className="text-[11px] text-stone leading-relaxed">
                    {t.welcomeFeatures}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Update Notification */}
        <AnimatePresence>
          {updateInfo && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginBottom: 0 }}
              animate={{ height: 'auto', opacity: 1, marginBottom: 8 }}
              exit={{ height: 0, opacity: 0, marginBottom: 0 }}
              className="px-5 overflow-hidden flex-shrink-0 relative z-40"
            >
              <div className="bg-pine-soft rounded-xl p-3 flex items-start gap-3 border border-pine-line mb-2">
                <div className="p-1.5 bg-pine-soft rounded-lg text-pine mt-0.5">
                  <Bell size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-ink">{t.newVersion} {updateInfo.latestVersion}</span>
                    <button onClick={closeUpdate} className="text-pine/75 hover:text-pine-deep transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                  <p className="text-[10px] text-pine/80 mb-2 leading-relaxed">
                    {t.updateAvailable}
                  </p>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleUpdate}
                      className="flex-1 bg-pine text-white text-[10px] font-medium py-1.5 rounded-lg hover:bg-pine-deep transition-colors flex items-center justify-center gap-1"
                    >
                      <span>{t.update}</span>
                      <ArrowRight size={10} />
                    </button>
                    <button 
                      onClick={skipUpdate}
                      className="px-3 bg-white text-pine text-[10px] font-medium py-1.5 rounded-lg border border-pine-line hover:bg-pine-soft transition-colors"
                    >
                      {t.skip}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 relative z-30 [scrollbar-gutter:stable]">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-5"
          >
            {/* Header with bucket switcher */}
            <header className="flex items-start justify-between gap-3">
              <div className="space-y-2 min-w-0 flex-1">
                <div className="app-no-drag inline-flex p-1 rounded-[18px] bg-black/[0.04] border border-black/[0.04]">
                  {([
                    { key: 'today' as const, label: t.todayTab },
                    { key: 'later' as const, label: t.laterTab },
                  ]).map(tab => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveBucket(tab.key)}
                      className={`px-3 h-8 rounded-[14px] text-xs font-bold transition-all cursor-pointer ${
                        activeBucket === tab.key
                          ? 'bg-white text-pine shadow-sm'
                          : 'text-neu-muted/70 hover:text-neu-text'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <motion.p 
                  key={`${activeBucket}-${remainingCount}`}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-neu-muted text-xs font-medium tracking-normal"
                >
                  {remainingCount} {t.remaining}
                </motion.p>
              </div>
              
              {/* Clear All Button */}
              <div className="h-8 flex items-center">
                 <AnimatePresence>
                    {visibleTodos.length > 0 && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={clearAll}
                        className="flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-red-50 text-red-500 text-xs font-bold hover:bg-red-100 transition-colors cursor-pointer border border-red-100/50 shadow-sm ml-4 whitespace-nowrap"
                    >
                        <Trash2 size={12} strokeWidth={2.5} />
                        <span>{t.clearAll}</span>
                    </motion.button>
                    )}
                </AnimatePresence>
              </div>
            </header>
            
            {/* Input & List */}
            {/* Input & List */}
            <div className="space-y-4">
              <TodoInput onAdd={addTodo} language={language} />
              
              <AnimatePresence mode="popLayout" initial={false}>
                {visibleTodos.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, scale: 0.9, height: 0 }}
                    animate={{ opacity: 1, scale: 1, height: 'auto' }}
                    exit={{ opacity: 0, scale: 0.9, height: 0 }}
                    transition={{ duration: 0.3, type: "spring", bounce: 0 }}
                    className="text-center py-12 overflow-hidden"
                  >
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-pine-soft flex items-center justify-center border border-pine-line/60"
                    >
                      <CircleCheck size={24} className="text-pine/75" />
                    </motion.div>
                    <motion.p 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.15 }}
                      className="text-neu-muted/60 text-sm font-medium"
                    >
                      {activeBucket === 'today' ? t.allClear : t.laterAllClear}
                    </motion.p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="list"
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                  >
                    <TodoList 
                      todos={visibleTodos} 
                      onToggle={toggleTodo} 
                      onDelete={deleteTodo}
                      onRename={renameTodo}
                      onUpdateDetails={updateDetails}
                      onUpdateDue={updateDue}
                      onReorder={reorderTodos}
                      onMove={moveTodo}
                      onAddImages={addImages}
                      onRemoveImage={removeImage}
                      language={language}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        {/* Glow Resize Handle (Bottom-Right) */}
        {/* Resize Handles */}
        {/* Bottom Right */}
        <div 
          className="absolute bottom-0 right-0 w-8 h-8 flex items-end justify-end z-50 group app-no-drag cursor-nwse-resize"
          onMouseDown={(e) => handleResizeStart(e, 'se')}
        >
          <div 
            className="absolute bottom-0 right-0 w-full h-full rounded-tl-3xl transition-all duration-300 ease-out opacity-0 group-hover:opacity-100"
            style={{ 
              background: `radial-gradient(circle at bottom right, rgba(23, 33, 28, 0.18) 0%, transparent 70%)` 
            }}
          />
        </div>

        {/* Bottom Left */}
        <div 
          className="absolute bottom-0 left-0 w-8 h-8 flex items-end justify-start z-50 group app-no-drag cursor-nesw-resize"
          onMouseDown={(e) => handleResizeStart(e, 'sw')}
        >
          <div 
            className="absolute bottom-0 left-0 w-full h-full rounded-tr-3xl transition-all duration-300 ease-out opacity-0 group-hover:opacity-100"
            style={{ 
              background: `radial-gradient(circle at bottom left, rgba(23, 33, 28, 0.18) 0%, transparent 70%)` 
            }}
          />
        </div>
        {/* Version Check Toast */}
        <AnimatePresence>
          {showVersionToast && (
            <motion.div
                initial={{ opacity: 0, x: 20, y: 0 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: 20, transition: { duration: 0.3 } }}
                className="absolute bottom-5 right-5 z-[60] flex items-center gap-3 px-4 py-3 bg-white/90 backdrop-blur-xl border border-pine-line rounded-2xl shadow-xl shadow-pine/10 overflow-hidden"
            >
                {/* Progress Bar (Purple Line Reducing) */}
                <motion.div 
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ duration: 3, ease: 'linear' }}
                    className="absolute bottom-0 left-0 h-[2px] bg-pine"
                />
                
                <div className="p-1.5 bg-pine-soft rounded-full text-pine">
                    <CircleCheck size={16} />
                </div>
                <div>
                   <h3 className="text-xs font-bold text-neu-text">{t.upToDate}</h3>
                   <p className="text-[10px] text-neu-muted">{t.latestVersion} {VERSION}</p>
                </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}

export default App
