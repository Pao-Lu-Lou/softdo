/**
 * v1.7.0 (2026-10-15)
 * 改动：任务可在今日/长期之间移动。说明在行内展开编辑。
 */
import { Check, Trash2, Clock, Pencil, FileText, X, GripVertical, ChevronLeft, ChevronRight, CalendarDays, Layers } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'
import type { Todo, TodoBucket } from '../App'
import { getTranslation } from '../i18n'
import type { Language } from '../i18n'

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, text: string) => void;
  onUpdateDetails: (id: string, details: string) => void;
  onUpdateDue: (id: string, due: Date | null) => void;
  onMove: (id: string, bucket: TodoBucket) => void;
  language: Language;
  detailsOpen: boolean;
  onOpenDetails: () => void;
  onCloseDetails: () => void;
}

interface TimeInfo {
  text: string;
  urgent: boolean;
  overdue: boolean;
  secondsLeft?: number;
}

function formatTimeRemaining(dueTime: Date, t: any): TimeInfo {
  const now = new Date()
  const diff = dueTime.getTime() - now.getTime()
  
  if (diff < 0) {
    const mins = Math.abs(Math.floor(diff / 60000))
    if (mins < 60) return { text: `${mins}m ${t.overdue}`, urgent: true, overdue: true }
    const hours = Math.floor(mins / 60)
    if (hours < 24) return { text: `${hours}h ${t.overdue}`, urgent: true, overdue: true }
    return { text: `${Math.floor(hours / 24)}d ${t.overdue}`, urgent: true, overdue: true }
  }
  
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return { text: `${seconds}s`, urgent: true, overdue: false, secondsLeft: seconds }
  
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return { text: `${mins}m ${t.left}`, urgent: mins < 30, overdue: false }
  const hours = Math.floor(mins / 60)
  if (hours < 24) return { text: `${hours}h ${mins % 60}m`, urgent: hours < 2, overdue: false }
  const days = Math.floor(hours / 24)
  return { text: `${days}d ${hours % 24}h`, urgent: false, overdue: false }
}

export default function TodoItem({ todo, onToggle, onDelete, onRename, onUpdateDetails, onUpdateDue, onMove, language, detailsOpen, onOpenDetails, onCloseDetails }: TodoItemProps) {
  const t = getTranslation(language)
  const [, setTick] = useState(0)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(todo.text)
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 })
  const [detailsText, setDetailsText] = useState(todo.details || '')
  const detailsTextRef = useRef(todo.details || '')
  const savedDetailsRef = useRef(todo.details || '')
  const onUpdateDetailsRef = useRef(onUpdateDetails)
  savedDetailsRef.current = todo.details || ''
  const openRef = useRef(false)
  const skipSaveRef = useRef(false)
  const cardRef = useRef<HTMLDivElement>(null)
  onUpdateDetailsRef.current = onUpdateDetails
  
  // Due Picker State
  const [showDueModal, setShowDueModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [hour, setHour] = useState('12')
  const [minute, setMinute] = useState('00')
  const [calendarMonth, setCalendarMonth] = useState(new Date())

  
  const menuRef = useRef<HTMLDivElement>(null)
  
  // Initialize due picker state when opening
  const openDueModal = () => {
    if (todo.dueTime) {
      const d = new Date(todo.dueTime)
      setSelectedDate(formatDateLocal(d))
      setHour(d.getHours().toString().padStart(2, '0'))
      setMinute(d.getMinutes().toString().padStart(2, '0'))
      setCalendarMonth(new Date(d.getFullYear(), d.getMonth(), 1))
    } else {
      setSelectedDate('')
      setHour('12')
      setMinute('00')
      setCalendarMonth(new Date())
    }
    setShowDueModal(true)
    setShowContextMenu(false)
  }

  const handleSaveDue = () => {
    if (selectedDate) {
      const h = Math.min(23, Math.max(0, parseInt(hour) || 0))
      const m = Math.min(59, Math.max(0, parseInt(minute) || 0))
      const due = new Date(`${selectedDate}T${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`)
      onUpdateDue(todo.id, due)
    } else {
      onUpdateDue(todo.id, null)
    }
    setShowDueModal(false)
  }

  // Update every second if urgent
  useEffect(() => {
    if (!todo.dueTime) return
    const now = new Date()
    const diff = new Date(todo.dueTime).getTime() - now.getTime()
    if (diff > 0 && diff < 60000) {
        const interval = setInterval(() => setTick(t => t + 1), 1000)
        return () => clearInterval(interval)
    }
  }, [todo.dueTime])

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowContextMenu(false)
      }
    }
    if (showContextMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showContextMenu])

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenuPos({ x: e.clientX, y: e.clientY })
    setShowContextMenu(true)
  }

  const setDraft = (value: string) => {
    detailsTextRef.current = value
    setDetailsText(value)
  }

  useEffect(() => {
    if (detailsOpen && !openRef.current) {
      setDraft(savedDetailsRef.current)
    }
    if (!detailsOpen && openRef.current) {
      openRef.current = false
      if (!skipSaveRef.current) {
        onUpdateDetailsRef.current(todo.id, detailsTextRef.current.trim())
      }
      skipSaveRef.current = false
    }
    if (detailsOpen) openRef.current = true
  }, [detailsOpen, todo.id])

  useEffect(() => {
    return () => {
      if (openRef.current && !skipSaveRef.current) {
        onUpdateDetailsRef.current(todo.id, detailsTextRef.current.trim())
      }
    }
  }, [todo.id])

  useEffect(() => {
    if (!detailsOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        onCloseDetails()
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [detailsOpen, onCloseDetails])

  const timeInfo = todo.dueTime ? formatTimeRemaining(new Date(todo.dueTime), t) : null

  // Calendar Helpers (adapted from TodoInput)
  const formatDateLocal = (d: Date) => {
    const year = d.getFullYear()
    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    const day = d.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  
  const isPast = (day: number) => {
    const d = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)
    const today = new Date(); today.setHours(0,0,0,0)
    return d < today
  }

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(calendarMonth)
    const firstDay = getFirstDayOfMonth(calendarMonth)
    const days = []
    const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

    const headers = weekdays.map(w => (
      <div key={w} className="text-[10px] font-semibold text-neu-muted/40 text-center py-1">{w}</div>
    ))

    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} />)

    for (let day = 1; day <= daysInMonth; day++) {
      const past = isPast(day)
      const selected = selectedDate === formatDateLocal(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day))
      const today = formatDateLocal(new Date()) === formatDateLocal(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day))
      
      days.push(
        <button
          key={day}
          type="button"
          disabled={past}
          onClick={() => setSelectedDate(formatDateLocal(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)))}
          className={clsx(
            "w-7 h-7 rounded-lg text-xs font-semibold transition-all duration-100 cursor-pointer",
            selected ? 'bg-pine text-white shadow-md shadow-pine/20' :
            today ? 'bg-pine-soft text-pine' :
            past ? 'text-neu-muted/20 cursor-not-allowed' : 'text-neu-text/80 hover:bg-pine-soft'
          )}
        >
          {day}
        </button>
      )
    }
    return { headers, days }
  }

  const { headers, days } = renderCalendar()
  
  return (
    <>
      <motion.div
        ref={cardRef}
        layout
        onContextMenu={handleContextMenu}
        className={clsx(
          'group flex flex-col gap-2 p-3 bg-white/78 hover:bg-white/92 border border-white/80 rounded-[20px] shadow-[0_8px_20px_-16px_rgba(23,33,28,0.45)] transition-colors duration-200 relative overflow-hidden cursor-default',
          todo.completed && 'opacity-60 bg-white/40'
        )}
      >
        <div className="flex items-center gap-2">
        {/* Drag Handle */}
        <div className="w-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-grab active:cursor-grabbing text-neu-muted/30 hover:text-pine -ml-1">
          <GripVertical size={14} />
        </div>

        {/* Checkbox */}
        <motion.button
          layout={false}
          whileTap={{ scale: 0.95 }}
          onClick={() => onToggle(todo.id)}
          className="relative cursor-pointer flex-shrink-0 group/checkbox"
        >
          <motion.div
            layout
            className={clsx(
              "w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 border",
              todo.completed 
                ? 'border-pine bg-pine text-white shadow-[0_2px_8px_rgba(31,122,77,0.28)]' 
                : 'border-neu-muted/20 bg-white/50 backdrop-blur-md shadow-inner'
            )}
          >
            <motion.div
              initial={false}
              animate={{ scale: todo.completed ? 1 : 0, opacity: todo.completed ? 1 : 0 }}
            >
              <Check size={12} strokeWidth={3} className="drop-shadow-sm" />
            </motion.div>
          </motion.div>
        </motion.button>

        {/* Task Text & Due Time */}
        <div className="flex-1 min-w-0 overflow-hidden relative">
          {isEditing ? (
              <form 
                  onSubmit={(e) => { e.preventDefault(); if (editText.trim()) { onRename(todo.id, editText.trim()); setIsEditing(false); } }}
                  className="w-full"
              >
                  <input
                      type="text"
                      autoFocus
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onBlur={() => { if (editText.trim()) onRename(todo.id, editText.trim()); else setEditText(todo.text); setIsEditing(false); }}
                      className="w-full bg-transparent border-none outline-none text-sm font-medium text-neu-text p-0 m-0"
                  />
              </form>
          ) : (
              <div className="relative group/text">
                <motion.span 
                  animate={{ color: todo.completed ? 'rgba(107, 117, 111, 0.55)' : 'rgba(23, 33, 28, 1)' }}
                  className="block text-sm font-medium select-none truncate"
                >
                  {todo.text}
                </motion.span>
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: todo.completed ? 1 : 0 }}
                  style={{ originX: 0 }}
                  className="absolute top-1/2 left-0 right-0 h-[1px] bg-neu-text/60 pointer-events-none"
                />
              </div>
          )}
          
          <AnimatePresence>
            {timeInfo && !todo.completed && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className={clsx(
                  "flex items-center gap-1 mt-1 text-[11px] font-medium whitespace-nowrap",
                  timeInfo.overdue ? 'text-red-500' : timeInfo.urgent ? 'text-amber-500' : 'text-neu-muted/50'
                )}
              >
                <div className="flex items-center gap-1">
                  <Clock size={10} />
                  <span>{timeInfo.text}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        </div>

        <div className="flex items-center gap-0.5 pl-10 max-h-0 opacity-0 overflow-hidden pointer-events-none group-hover:max-h-8 group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200">
          {!todo.completed && (
            <>
              <motion.button
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={onOpenDetails}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${detailsOpen || todo.details?.trim() ? "text-pine bg-pine-soft" : "text-neu-muted/30 hover:text-pine hover:bg-pine-soft"}`}
                  title={t.editDetails}
              >
                  <FileText size={14} />
              </motion.button>
              <motion.button
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={openDueModal}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-neu-muted/30 hover:text-pine hover:bg-pine-soft transition-all cursor-pointer"
                  title={t.changeDue}
              >
                  <Clock size={14} />
              </motion.button>
              <motion.button
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={() => { setEditText(todo.text); setIsEditing(true); }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-neu-muted/30 hover:text-pine hover:bg-pine-soft transition-all cursor-pointer"
                  title={t.rename}
              >
                  <Pencil size={14} />
              </motion.button>
              <motion.button
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={() => onMove(todo.id, todo.bucket === 'later' ? 'today' : 'later')}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-neu-muted/30 hover:text-pine hover:bg-pine-soft transition-all cursor-pointer"
                  title={todo.bucket === 'later' ? t.moveToToday : t.moveToLater}
              >
                  {todo.bucket === 'later' ? <CalendarDays size={14} /> : <Layers size={14} />}
              </motion.button>
            </>
          )}
          <motion.button
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              onClick={() => onDelete(todo.id)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-neu-muted/30 hover:text-red-400 hover:bg-red-50 transition-all cursor-pointer"
              title={t.delete}
          >
              <Trash2 size={14} />
          </motion.button>
        </div>

        <AnimatePresence initial={false}>
          {detailsOpen ? (
            <motion.div
              key="editor"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden pl-14"
            >
              <textarea
                autoFocus
                value={detailsText}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    onCloseDetails()
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    skipSaveRef.current = true
                    setDraft(todo.details || '')
                    onCloseDetails()
                  }
                }}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder={t.addDetails}
                className="w-full h-24 px-3 py-2 text-xs leading-5 bg-white/80 border border-pine-line rounded-2xl resize-none outline-none text-neu-text placeholder-neu-muted/40 focus:border-pine focus:bg-white"
              />
            </motion.div>
          ) : todo.details?.trim() ? (
            <motion.button
              key="preview"
              type="button"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onClick={onOpenDetails}
              title={t.editDetails}
              className="pl-14 pr-1 flex items-center gap-1.5 w-full text-left cursor-pointer"
            >
              <FileText size={11} className="text-pine/75 flex-shrink-0" />
              <span className="text-[11px] leading-4 text-neu-muted/70 truncate">{todo.details.replace(/\s+/g, ' ')}</span>
            </motion.button>
          ) : null}
        </AnimatePresence>
      </motion.div>

      {/* Context Menu */}
      <AnimatePresence>
        {showContextMenu && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.9, y: -5 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: -5 }}
            style={{ top: Math.min(contextMenuPos.y, window.innerHeight - 180), left: Math.min(contextMenuPos.x, window.innerWidth - 160) }}
            className="fixed z-[100] bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/80 py-2 min-w-[160px] origin-top-left"
          >
            {/* Header to fill space */}
            <div className="px-3.5 py-2 mb-1">
               <p className="text-[11px] font-medium text-stone">{t.task}</p>
               <p className="text-xs font-bold text-neu-text truncate">{todo.text}</p>
            </div>
            <div className="h-px bg-gray-100/50 mx-2 mb-1" />
            
            <MenuButton icon={<Clock size={13} />} text={t.changeDue} onClick={openDueModal} />
            <MenuButton icon={<FileText size={13} />} text={t.editDetails} onClick={() => { setShowContextMenu(false); onOpenDetails(); }} />
            <MenuButton icon={<Pencil size={13} />} text={t.rename} onClick={() => { setShowContextMenu(false); setEditText(todo.text); setIsEditing(true); }} />
            <MenuButton
              icon={todo.bucket === 'later' ? <CalendarDays size={13} /> : <Layers size={13} />}
              text={todo.bucket === 'later' ? t.moveToToday : t.moveToLater}
              onClick={() => { setShowContextMenu(false); onMove(todo.id, todo.bucket === 'later' ? 'today' : 'later'); }}
            />
            
            <div className="h-px bg-gray-100/50 my-1 mx-2" />
            <MenuButton icon={<Trash2 size={13} />} text={t.delete} color="text-red-500" onClick={() => { setShowContextMenu(false); onDelete(todo.id); }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Due Date Modal */}
      <AnimatePresence>
        {showDueModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
            onClick={() => setShowDueModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[260px] bg-white rounded-3xl shadow-2xl border border-white/50 overflow-hidden"
            >
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                   <h3 className="text-xs font-bold text-neu-text">{t.changeDue}</h3>
                   <button onClick={() => setShowDueModal(false)} className="text-neu-muted hover:text-neu-text p-1"><X size={14}/></button>
                </div>
                
                {/* Simplified Calendar adapted from TodoInput */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} className="p-1 hover:bg-pine-soft rounded-lg text-neu-muted"><ChevronLeft size={14}/></button>
                    <span className="text-[10px] font-bold">{calendarMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                    <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} className="p-1 hover:bg-pine-soft rounded-lg text-neu-muted"><ChevronRight size={14}/></button>
                  </div>
                  <div className="grid grid-cols-7 gap-y-0.5 justify-items-center">
                    {headers}
                    {days}
                  </div>
                </div>
                
                {/* Time picker */}
                <div className="flex items-center justify-center gap-2 pt-2 border-t border-gray-100">
                   <input type="text" maxLength={2} value={hour} onFocus={e => e.target.select()} onChange={e => setHour(e.target.value.replace(/\D/g,'').slice(0,2))} className="w-8 h-8 rounded-lg bg-gray-50 text-center text-xs font-bold text-pine outline-none focus:bg-white border border-transparent focus:border-pine" />
                   <span className="font-bold text-gray-300">:</span>
                   <input type="text" maxLength={2} value={minute} onFocus={e => e.target.select()} onChange={e => setMinute(e.target.value.replace(/\D/g,'').slice(0,2))} className="w-8 h-8 rounded-lg bg-gray-50 text-center text-xs font-bold text-pine outline-none focus:bg-white border border-transparent focus:border-pine" />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                   <button onClick={() => { setSelectedDate(''); onUpdateDue(todo.id, null); setShowDueModal(false); }} className="py-1.5 text-[10px] font-bold text-red-500 bg-red-50 rounded-xl hover:bg-red-100 transition-colors">Clear</button>
                   <button onClick={handleSaveDue} className="py-1.5 text-[10px] font-bold text-white bg-pine rounded-xl hover:bg-pine-deep shadow-lg shadow-pine/15 transition-colors">Save</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </>
  )
}

function MenuButton({ icon, text, onClick, color = "text-neu-text" }: { icon: React.ReactNode, text: string, onClick: () => void, color?: string }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full px-3.5 py-2.5 text-left text-xs font-semibold hover:bg-pine-soft hover:text-pine-deep transition-all flex items-center gap-3 cursor-pointer",
        color
      )}
    >
      <span className="opacity-50 group-hover:opacity-100">{icon}</span>
      <span>{text}</span>
    </button>
  )
}
