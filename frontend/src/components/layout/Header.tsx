import { Link, useLocation } from 'react-router-dom'
import { Baby, Menu, X } from 'lucide-react'
import { useState } from 'react'

const navLinks = [
  { to: '/', label: 'Guide' },
  { to: '/tracker', label: 'Tracker' },
  { to: '/supply-strategies', label: 'Supply Tips' },
  { to: '/hand-expression', label: 'Hand Expression' },
]

export function Header() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="bg-surface border-b border-border sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link to="/tracker" className="flex items-center gap-2 no-underline">
          <div className="w-9 h-9 bg-accent-300 rounded-lg flex items-center justify-center">
            <Baby size={20} className="text-dark" />
          </div>
          <span className="text-lg font-bold tracking-tight text-dark">
            BABY<span className="text-primary-500">TRACKER</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`px-3 py-2 text-sm font-semibold uppercase tracking-wide rounded-lg transition-colors no-underline ${
                location.pathname === link.to
                  ? 'text-primary-500 bg-primary-50'
                  : 'text-muted hover:text-dark hover:bg-bg'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 cursor-pointer"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav className="md:hidden border-t border-border bg-surface animate-fade-in">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMenuOpen(false)}
              className={`block px-6 py-3 text-sm font-semibold uppercase tracking-wide no-underline ${
                location.pathname === link.to
                  ? 'text-primary-500 bg-primary-50'
                  : 'text-muted hover:bg-bg'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}
