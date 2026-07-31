import { useState } from 'react'
import { Mail } from 'lucide-react'
import packageJson from '../../../package.json'
import { ContactModal } from './ContactModal'

// פוטר גלובלי למערכת: פס ברוחב מלא בתחתית העמוד, בדומה למבנה נפוץ באתרים (שורת קישורים +
// שורת זכויות יוצרים ממורכזת) — שם + גרסה, זכויות יוצרים, וכפתור "צור קשר" שפותח טופס פנייה
export function Footer() {
  const [contactOpen, setContactOpen] = useState(false)

  return (
    <footer className="w-full bg-accent px-6 py-3 text-[#dceae6]">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 border-b border-white/15 pb-2 text-[12px]">
        <span>
          שיבוצית <span className="text-white">v{packageJson.version}</span>
        </span>
        <button
          type="button"
          onClick={() => setContactOpen(true)}
          className="flex items-center gap-1 hover:text-white"
        >
          <Mail size={13} />
          צור קשר
        </button>
      </div>
      <div className="mx-auto max-w-5xl pt-2 text-center text-[11.5px]">
        © {new Date().getFullYear()} כל הזכויות שמורות לאביטל זולדן
      </div>

      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} />}
    </footer>
  )
}
