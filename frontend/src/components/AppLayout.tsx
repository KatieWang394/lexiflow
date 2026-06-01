/**
 * AppLayout — 全局布局外壳
 * ==========================
 * 所有页面都包裹在这里，提供：
 *   - 中间内容区（Outlet，各页面渲染在此）
 *   - 底部固定 tab 导航栏（复习 / 词条 / 我的）
 *
 * 移动端优先：内容区最大宽度 max-w-md，水平居中，
 * 底部导航高度 60px，内容区留出相应 padding-bottom。
 */

import { NavLink, Outlet } from 'react-router-dom'
import { BookOpen, BookMarked, User } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---- Tab 配置 -------------------------------------------------------

const tabs = [
  {
    to: '/',
    label: '复习',
    icon: BookOpen,
    end: true,
  },
  {
    to: '/terms',
    label: '词条',
    icon: BookMarked,
    end: false,
  },
  {
    to: '/me',
    label: '我的',
    icon: User,
    end: false,
  },
] as const

// ---- 组件 -----------------------------------------------------------

export default function AppLayout() {
  return (
    /*
     * 外层容器：全屏高度，flex 竖排，内容居中（移动端无需居中，
     * 桌面端限制最大宽度让它看起来像手机 app）
     */
    <div className="flex justify-center bg-background min-h-svh">
      <div className="relative flex flex-col w-full max-w-md min-h-svh">

        {/* ── 页面内容区（Outlet） ─────────────────────────────── */}
        {/* pb-[60px] 防止内容被底部导航栏遮住 */}
        <main className="flex flex-col flex-1 pb-[60px] overflow-y-auto">
          <Outlet />
        </main>

        {/* ── 底部 tab 导航栏 ──────────────────────────────────── */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md h-[60px] bg-white/95 backdrop-blur-sm border-t border-[#dde8f2] z-20 flex items-stretch">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col flex-1 items-center justify-center gap-0.5 text-xs transition-colors',
                  isActive
                    ? 'text-[#2d8fcb]'
                    : 'text-[#aab4bd] hover:text-[#5f7486]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      'size-5 transition-all',
                      isActive && 'stroke-[2.3px]',
                    )}
                  />
                  <span
                    className={cn(
                      'transition-all',
                      isActive && 'font-medium',
                    )}
                  >
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

      </div>
    </div>
  )
}
