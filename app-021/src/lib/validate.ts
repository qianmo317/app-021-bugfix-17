import type { ClassEntity } from '../types'
import { middleColSet } from './layout'

// 座位的人话位置描述（如「第 3 排第 2 列」），与学生表/编辑弹窗保持一致
export function seatLabel(seatId: string): string {
  const m = seatId.match(/r(\d+)c(\d+)/)
  if (!m) return seatId
  return `第 ${Number(m[1]) + 1} 排第 ${Number(m[2]) + 1} 列`
}

// 配置校验：在生成前给出人话提示（前置校验，避免引擎抛晦涩错误）
export function validateClass(cls: ClassEntity): string[] {
  const errors: string[] = []
  const seatIds = new Set(cls.seats.map((s) => s.id))
  if (cls.students.length === 0) errors.push('还没有学生，请先添加学生名单')
  if (cls.students.length > cls.seats.length)
    errors.push(`学生数（${cls.students.length}）超过座位数（${cls.seats.length}）`)

  for (const s of cls.students) {
    for (const oid of s.mustApartFrom) {
      if (oid === s.id) errors.push(`学生「${s.name}」不能与自己「必须分开」`)
    }
  }

  // 容量检查
  const frontRows = Math.min(cls.constraints.frontRows, cls.layout.rows)
  const frontSeats = frontRows * cls.layout.cols
  const frontNeed = cls.students.filter((s) => s.vision === 'front_required' || s.special?.includes('hearing')).length
  const hearingRows = Math.ceil(cls.layout.rows / 2)
  const hearingSeats = hearingRows * cls.layout.cols
  if (frontNeed > Math.min(frontSeats, hearingSeats) && cls.students.length > 0) {
    errors.push(`需前排的学生（含听力）共 ${frontNeed} 人，超过前排座位容量 ${Math.min(frontSeats, hearingSeats)} 个`)
  }
  const middleCols = middleColSet(cls.layout)
  const middleNeed = cls.students.filter((s) => s.vision === 'middle_required').length
  if (middleNeed > middleCols.size * cls.layout.rows) {
    errors.push(`需中间列的学生 ${middleNeed} 人，超过中间列容量 ${middleCols.size * cls.layout.rows} 个`)
  }
  const isAisleSeat = (seat: (typeof cls.seats)[number]) =>
    seat.tags.includes('aisle') || seat.col === 0 || seat.col === cls.layout.cols - 1
  const aisleCap = cls.seats.filter(isAisleSeat).length
  const mobilityNeed = cls.students.filter((s) => s.special?.includes('mobility')).length
  if (mobilityNeed > aisleCap) {
    errors.push(`行动不便的学生 ${mobilityNeed} 人，超过靠过道座位容量 ${aisleCap} 个`)
  }

  // 固定座位检查：不存在 / 两人抢座 / 与个体照顾要求冲突
  const fixedBySeat = new Map<string, string[]>()
  for (const s of cls.students) {
    if (!s.fixedSeatId) continue
    const list = fixedBySeat.get(s.fixedSeatId) ?? []
    list.push(s.name)
    fixedBySeat.set(s.fixedSeatId, list)
  }
  for (const s of cls.students) {
    if (!s.fixedSeatId) continue
    const seat = cls.seats.find((x) => x.id === s.fixedSeatId)
    if (!seat) {
      errors.push(`「${s.name}」的固定座位 ${seatLabel(s.fixedSeatId)} 已不存在（教室当前只有 ${cls.layout.rows} 排 ${cls.layout.cols} 列）`)
      continue
    }
    if (s.vision === 'front_required' && seat.row >= frontRows) {
      errors.push(`「${s.name}」近视需坐前 ${frontRows} 排，但固定座位在${seatLabel(s.fixedSeatId)}`)
    }
    if (s.vision === 'middle_required' && !middleCols.has(seat.col)) {
      errors.push(`「${s.name}」视力需中间，但固定座位${seatLabel(s.fixedSeatId)}在边列`)
    }
    if (s.special?.includes('hearing') && seat.row >= hearingRows) {
      errors.push(`「${s.name}」听力需坐前 ${hearingRows} 排，但固定座位在${seatLabel(s.fixedSeatId)}`)
    }
    if (s.special?.includes('mobility') && !isAisleSeat(seat)) {
      errors.push(`「${s.name}」行动不便需靠过道，但固定座位${seatLabel(s.fixedSeatId)}不靠过道`)
    }
  }
  for (const [seatId, names] of fixedBySeat) {
    if (names.length > 1 && seatIds.has(seatId)) {
      errors.push(`${seatLabel(seatId)}被 ${names.length} 名学生同时固定：${names.join('、')}`)
    }
  }
  return errors
}
