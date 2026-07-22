import { useAuth } from '../lib/AuthContext'

// school_id של המשתמשת המחוברת, נשלף מ-profiles דרך AuthContext (ראו lib/AuthContext.tsx).
// שומר על תמיכה במולטי-טננסי: כל משתמשת רואה רק את בית הספר שאליו היא משויכת.
export function useCurrentSchoolId(): number | undefined {
  const { profile } = useAuth()
  return profile?.school_id
}
