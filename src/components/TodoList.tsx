/**
 * v1.7.0 (2026-10-15)
 * 改动：透传跨栏移动；同一时间只展开一条任务说明。
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Todo, TodoBucket } from '../App'
import TodoItem from './TodoItem'
import type { Language } from '../i18n'

interface TodoListProps {
  todos: Todo[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, text: string) => void;
  onUpdateDetails: (id: string, details: string) => void;
  onUpdateDue: (id: string, due: Date | null) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onMove: (id: string, bucket: TodoBucket) => void;
  language: Language;
}

export default function TodoList({ 
  todos, 
  onToggle, 
  onDelete, 
  onRename, 
  onUpdateDetails, 
  onUpdateDue,
  onReorder,
  onMove,
  language 
}: TodoListProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [targetIndex, setTargetIndex] = useState<number | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const openDetails = useCallback((id: string) => setExpandedId(id), [])
  const closeDetails = useCallback(() => setExpandedId(null), [])

  useEffect(() => {
    if (expandedId && !todos.some(todo => todo.id === expandedId)) {
      setExpandedId(null)
    }
  }, [todos, expandedId])

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5'
    }
  }

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
    if (draggedIndex !== null && targetIndex !== null && draggedIndex !== targetIndex) {
      onReorder(draggedIndex, targetIndex)
    }
    setDraggedIndex(null)
    setTargetIndex(null)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedIndex !== null && index !== targetIndex) {
      setTargetIndex(index)
    }
  }

  return (
    <div ref={containerRef} className="space-y-2 relative">
      <AnimatePresence mode='popLayout'>
        {todos.map((todo, index) => (
          <motion.div
            key={todo.id}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: draggedIndex === index ? 1.02 : 1
            }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ 
              duration: 0.2, 
              type: "spring", 
              stiffness: 500, 
              damping: 30 
            }}
            draggable={expandedId !== todo.id}
            onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, index)}
            onDragEnd={(e) => handleDragEnd(e as unknown as React.DragEvent)}
            onDragOver={(e) => handleDragOver(e as unknown as React.DragEvent, index)}
            className="relative cursor-grab active:cursor-grabbing"
          >
            {/* Drop Indicator - Top */}
            <AnimatePresence>
              {targetIndex === index && draggedIndex !== null && draggedIndex > index && (
                <motion.div
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  exit={{ opacity: 0, scaleX: 0 }}
                  className="absolute -top-1.5 left-4 right-4 h-0.5 bg-pine rounded-full origin-left z-10"
                />
              )}
            </AnimatePresence>
            
            {/* Drop Indicator - Bottom */}
            <AnimatePresence>
              {targetIndex === index && draggedIndex !== null && draggedIndex < index && (
                <motion.div
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  exit={{ opacity: 0, scaleX: 0 }}
                  className="absolute -bottom-1.5 left-4 right-4 h-0.5 bg-pine rounded-full origin-left z-10"
                />
              )}
            </AnimatePresence>
            
            <TodoItem 
              todo={todo} 
              onToggle={onToggle} 
              onDelete={onDelete}
              onRename={onRename}
              onUpdateDetails={onUpdateDetails}
              onUpdateDue={onUpdateDue}
              onMove={onMove}
              language={language}
              detailsOpen={expandedId === todo.id}
              onOpenDetails={() => openDetails(todo.id)}
              onCloseDetails={closeDetails}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
