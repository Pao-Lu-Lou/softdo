import { useState, useRef } from 'react'
import { Plus, Clock, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { getTranslation } from '../i18n'
import type { Language } from '../i18n'

interface TodoInputProps {
  onAdd: (text: string, dueTime?: Date | null, details?: string) => void;
  language: Language;
}

export default function TodoInput({ onAdd, language }: TodoInputProps) {
  const t = getTranslation(language)
  const [text, setText] = useState('')
  const [details, setDetails] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [showDuePicker, setShowDuePicker] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [hour, setHour] = useState('12')
  const [minute, setMinute] = useState('00')
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const minuteInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (text.trim()) {
      let due: Date | null = null
      if (selectedDate) {
        const h = Math.min(23, Math.max(0, parseInt(hour) || 0))
        const m = Math.min(59, Math.max(0, parseInt(minute) || 0))
        due = new Date(`${selectedDate}T${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`)
      }
      onAdd(text, due, details)
      setText('')
      setDetails('')
      setShowDetails(false)
      setSelectedDate('')
      setHour('12')
      setMinute('00')
      setShowDuePicker(false)
    }
  }

  const toggleDuePicker = () => {
    if (showDuePicker) {
      setSelectedDate('')
      setHour('12')
      setMinute('00')
    } else {
      setCalendarMonth(new Date())
    }
    setShowDuePicker(!showDuePicker)
  }

  const normalizeHour = (val: string) => {
    const num = parseInt(val) || 0
    return Math.min(23, Math.max(0, num)).toString().padStart(2, '0')
  }

  const normalizeMinute = (val: string) => {
    const num = parseInt(val) || 0
    return Math.min(59, Math.max(0, num)).toString().padStart(2, '0')
  }

  const hasDue = selectedDate !== ''

  // Helper to format date as YYYY-MM-DD in local timezone
  const formatDateLocal = (d: Date) => {
    const year = d.getFullYear()
    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    const day = d.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Quick options
  const quickOptions = [
    { label: t.today, days: 0 },
    { label: t.tomorrow, days: 1 },
    { label: t.threeDays, days: 3 },
    { label: t.nextWeek, days: 7 },
  ]

  const selectQuickOption = (days: number) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    setSelectedDate(formatDateLocal(d))
  }

  const formatSelectedDate = () => {
    if (!selectedDate) return ''
    const [year, month, day] = selectedDate.split('-').map(Number)
    const d = new Date(year, month - 1, day)
    return d.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const prevMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))
  }

  const selectDay = (day: number) => {
    const d = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)
    setSelectedDate(formatDateLocal(d))
  }

  const isToday = (day: number) => {
    const today = new Date()
    return calendarMonth.getFullYear() === today.getFullYear() &&
           calendarMonth.getMonth() === today.getMonth() &&
           day === today.getDate()
  }

  const isPast = (day: number) => {
    const d = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return d < today
  }

  const isSelected = (day: number) => {
    if (!selectedDate) return false
    const d = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)
    return formatDateLocal(d) === selectedDate
  }

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(calendarMonth)
    const firstDay = getFirstDayOfMonth(calendarMonth)
    const days = []
    const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

    // Weekday headers
    const headers = weekdays.map(w => (
      <div key={w} className="text-[10px] font-semibold text-neu-muted/40 text-center py-1">
        {w}
      </div>
    ))

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} />)
    }

    // Days
    for (let day = 1; day <= daysInMonth; day++) {
      const past = isPast(day)
      const today = isToday(day)
      const selected = isSelected(day)
      
      days.push(
        <button
          key={day}
          type="button"
          disabled={past}
          onClick={() => selectDay(day)}
          className={`
            w-7 h-7 rounded-lg text-xs font-semibold transition-all duration-100 cursor-pointer
            ${selected ? 'bg-pine text-white shadow-md shadow-pine/20' :
              today ? 'bg-pine-soft text-pine' :
              past ? 'text-neu-muted/20 cursor-not-allowed' :
              'text-neu-text/80 hover:bg-pine-soft'}
          `}
        >
          {day}
        </button>
      )
    }

    return { headers, days }
  }

  const { headers, days } = renderCalendar()

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-3">
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t.whatNeedsToBeDone}
              className="w-full bg-white/92 rounded-[18px] pl-5 pr-11 py-3 outline-none text-neu-text placeholder-stone/70 border border-pine-line/80 transition-all duration-200 focus:bg-white focus:border-pine text-sm font-medium"
            />
            <button
              type="button"
              onClick={() => setShowDetails(open => !open)}
              title={t.editDetails}
              className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                showDetails || details.trim()
                  ? 'text-pine bg-pine-soft'
                  : 'text-neu-muted/40 hover:text-pine hover:bg-pine-soft'
              }`}
            >
              <FileText size={16} />
            </button>
          </div>
          
          <button
            type="button"
            onClick={toggleDuePicker}
            className={`w-[46px] h-[46px] rounded-[18px] flex items-center justify-center transition-all duration-200 cursor-pointer border flex-shrink-0 shadow-sm ${
              hasDue
                ? 'bg-pine border-pine text-white shadow-pine/15'
                : showDuePicker
                ? 'bg-pine-soft border-pine-line text-pine'
                : 'bg-white/70 border-white/60 text-neu-muted/40 hover:text-pine hover:border-pine-line hover:bg-white/90'
            }`}
          >
            <Clock size={18} />
          </button>
        </div>
        
        <button
          type="submit"
          disabled={!text.trim()}
          className="bg-pine rounded-[18px] w-[46px] h-[46px] flex items-center justify-center text-white shadow-[0_8px_16px_-10px_rgba(31,122,77,0.9)] disabled:opacity-40 disabled:shadow-none transition-all duration-200 cursor-pointer flex-shrink-0 hover:bg-pine-deep active:scale-[0.98]"
        >
          <Plus size={20} strokeWidth={2.5} />
        </button>
        </div>
        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <textarea
                autoFocus
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    e.currentTarget.form?.requestSubmit()
                  }
                }}
                placeholder={t.addDetails}
                className="w-full h-24 px-4 py-3 text-sm leading-5 bg-white/70 border border-white/60 rounded-[18px] resize-none outline-none text-neu-text placeholder-neu-muted/35 focus:bg-white/95 focus:border-pine"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </form>
      
      {/* Due Picker */}
      <AnimatePresence>
        {showDuePicker && (
          <motion.div
            layout
            initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="p-3 bg-white rounded-2xl border border-pine-line shadow-lg space-y-3 overflow-hidden"
          >
            {/* Quick Options */}
            <div className="grid grid-cols-2 gap-2">
              {quickOptions.map((opt) => {
                const d = new Date()
                d.setDate(d.getDate() + opt.days)
                const val = formatDateLocal(d)
                const isSelected = selectedDate === val
                
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => selectQuickOption(opt.days)}
                    className={`py-2 rounded-xl text-[11px] font-semibold transition-colors duration-100 cursor-pointer ${
                      isSelected
                        ? 'bg-pine text-white'
                        : 'bg-pine-soft text-pine hover:bg-pine-soft'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
            
            {/* Custom Calendar */}
            <div className="space-y-3">
              {/* Month Navigation */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-neu-muted/50 hover:bg-pine-soft hover:text-pine transition-colors cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-semibold text-neu-text">
                  {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-neu-muted/50 hover:bg-pine-soft hover:text-pine transition-colors cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              
              {/* Calendar Grid - Fixed Columns, Center Items */}
              <div className="grid grid-cols-7 gap-y-1 justify-items-center">
                {headers}
                {days}
              </div>
            </div>
            
            {/* Time Input */}
            <div className="flex flex-col gap-3 pt-3 border-t border-pine-line/70">
              <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-stone">{t.time}</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={hour}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 2)
                        setHour(val)
                        if (val.length === 2) {
                          setHour(normalizeHour(val))
                          minuteInputRef.current?.focus()
                          minuteInputRef.current?.select()
                        }
                      }}
                      onBlur={(e) => setHour(normalizeHour(e.target.value))}
                      className="w-8 h-8 rounded-lg bg-pine-soft/80 border border-pine-line text-center text-xs font-bold text-pine outline-none focus:border-pine focus:bg-white transition-colors"
                    />
                    <span className="text-pine-mist font-bold">:</span>
                    <input
                      ref={minuteInputRef}
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={minute}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setMinute(e.target.value.replace(/\D/g, '').slice(0, 2))}
                      onBlur={(e) => setMinute(normalizeMinute(e.target.value))}
                      className="w-8 h-8 rounded-lg bg-pine-soft/80 border border-pine-line text-center text-xs font-bold text-pine outline-none focus:border-pine focus:bg-white transition-colors"
                    />
                  </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                {['09', '12', '18'].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => { setHour(h); setMinute('00') }}
                    className={`px-2 py-1.5 rounded-[10px] text-[10px] font-semibold transition-all cursor-pointer ${
                      hour === h && minute === '00'
                        ? 'bg-pine text-white shadow-md shadow-pine/15'
                        : 'bg-pine-soft/80 text-pine hover:bg-pine-soft'
                    }`}
                  >
                    {h}:00
                  </button>
                ))}
              </div>
            </div>
            
            {/* Preview */}
            {hasDue && (
              <div className="flex items-center justify-between py-2 px-3 bg-pine-soft rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-pine-soft0" />
                  <span className="text-[11px] font-semibold text-pine">
                    {formatSelectedDate()} {language === 'zh' ? ' ' : 'at'} {normalizeHour(hour)}:{normalizeMinute(minute)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedDate(''); setHour('12'); setMinute('00') }}
                  className="text-[10px] font-medium text-pine hover:text-red-500 cursor-pointer"
                >
                  {language === 'zh' ? '清除' : 'Clear'}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
