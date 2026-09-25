import type { ClassEntity, Seat } from '../types'
import { middleColSet } from './layout'

// 配置校验：在生成前给出人话提示（前置校验，避免引擎抛晦涩错误）
export function validateClass(cls: ClassEntity): string[] {
  const errors: string[] = []
  const seatById = new Map(cls.seats.map((s) => [s.id, s]))
  if (cls.students.length === 0) errors.push('还没有学生，请先添加学生名单')
  if (cls.students.length > cls.seats.length)
    errors.push(`学生数（${cls.students.length}）超过座位数（${cls.seats.length}）`)

  const fixedSeats = [...new Set(cls.students.map((s) => s.fixedSeatId).filter((id): id is string => !!id))]
  if (fixedSeats.length > cls.seats.length) errors.push('固定座位数量超过教室座位数')
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
  const mc = middleColSet(cls.layout)
  const middleNeed = cls.students.filter((s) => s.vision === 'middle_required').length
  if (middleNeed > mc.size * cls.layout.rows) {
    errors.push(`需中间列的学生 ${middleNeed} 人，超过中间列容量 ${mc.size * cls.layout.rows} 个`)
  }
  // 「靠过道可达」判定与引擎一致：紧邻过道，或最左 / 最右一列
  const hasAisleAccess = (seat: Seat) =>
    seat.tags.includes('aisle') || seat.col === 0 || seat.col === cls.layout.cols - 1
  const aisleCap = cls.seats.filter(hasAisleAccess).length
  const mobilityNeed = cls.students.filter((s) => s.special?.includes('mobility')).length
  if (mobilityNeed > aisleCap) {
    errors.push(`行动不便的学生 ${mobilityNeed} 人，超过靠过道座位容量 ${aisleCap} 个`)
  }

  // 固定座位逐条检查：座位不存在 / 两人同座 / 与学生自身照顾需求冲突
  const fixedTakenBy = new Map<string, string>() // seatId → 先占者姓名
  for (const s of cls.students) {
    if (!s.fixedSeatId) continue
    const seat = seatById.get(s.fixedSeatId)
    if (!seat) {
      errors.push(`「${s.name}」的固定座位（${seatPosLabel(s.fixedSeatId)}）在当前布局中不存在，请重新指定或清除`)
      continue
    }
    const where = `第 ${seat.row + 1} 排第 ${seat.col + 1} 列`
    const first = fixedTakenBy.get(s.fixedSeatId)
    if (first !== undefined) {
      errors.push(`固定座位冲突：「${first}」与「${s.name}」被指定到同一座位（${where}）`)
    } else {
      fixedTakenBy.set(s.fixedSeatId, s.name)
    }
    if (s.vision === 'front_required' && seat.row >= frontRows)
      errors.push(`「${s.name}」近视需前 ${frontRows} 排，但固定座位在${where}`)
    if (s.vision === 'middle_required' && !mc.has(seat.col))
      errors.push(`「${s.name}」视力需中间，但固定座位在边列（${where}）`)
    if (s.special?.includes('hearing') && seat.row >= hearingRows)
      errors.push(`「${s.name}」听力需求需在前 ${hearingRows} 排，但固定座位在${where}`)
    if (s.special?.includes('mobility') && !hasAisleAccess(seat))
      errors.push(`「${s.name}」行动不便需靠过道，但固定座位（${where}）不靠过道`)
  }
  return errors
}

// 座位 id（r{row}c{col}）→ 人话位置；无法解析时原样返回
function seatPosLabel(id: string): string {
  const m = id.match(/^r(\d+)c(\d+)$/)
  return m ? `第 ${Number(m[1]) + 1} 排第 ${Number(m[2]) + 1} 列` : id
}
