export interface CampRow {
  id: number
  school_id: number
  name: string
  start_date: string
  end_date: string
  created_at: string
}

export interface CampPeriodRow {
  id: number
  school_id: number
  camp_id: number
  start_date: string
  end_date: string
  includes_morning: boolean
  includes_afternoon: boolean
}

export interface CampWithPeriods extends CampRow {
  camp_periods: CampPeriodRow[]
}
