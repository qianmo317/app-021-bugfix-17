import { describe, expect, it } from 'vitest'
import { validateClass } from '../src/lib/validate'
import { buildSeats } from '../src/lib/layout'
import { makeClass, makeStudent } from './helpers'

// 取座位 id：r{row}c{col}（0 基）
const sid = (r: number, c: number) => `r${r}c${c}`

describe('配置校验：固定座位', () => {
  it('正常配置不报错', () => {
    const cls = makeClass({ rows: 4, cols: 6, students: [] })
    cls.students = [
      makeStudent({ name: '甲', fixedSeatId: sid(0, 0), vision: 'front_required' }),
      makeStudent({ name: '乙', fixedSeatId: sid(2, 3), special: ['mobility'] }),
      makeStudent({ name: '丙' }),
    ]
    expect(validateClass(cls)).toEqual([])
  })

  it('固定座位不存在（缩小行列后悬挂）逐条列出', () => {
    const cls = makeClass({ rows: 4, cols: 6, students: [] })
    const a = makeStudent({ name: '甲', fixedSeatId: sid(5, 2) }) // 原 6 排布局里的座位
    const b = makeStudent({ name: '乙', fixedSeatId: sid(2, 7) }) // 原 8 列布局里的座位
    cls.students = [a, b]
    const errors = validateClass(cls)
    expect(errors).toHaveLength(2)
    expect(errors.some((e) => e.includes('甲') && e.includes('已不存在'))).toBe(true)
    expect(errors.some((e) => e.includes('乙') && e.includes('已不存在'))).toBe(true)
  })

  it('缩小布局后重建座位，悬挂的固定座位被标出', () => {
    const cls = makeClass({ rows: 6, cols: 8, students: [] })
    const a = makeStudent({ name: '甲', fixedSeatId: sid(5, 7) })
    cls.students = [a]
    // 用户把布局改成 4 排 6 列，但学生条目里的 fixedSeatId 没被清
    cls.layout = { ...cls.layout, rows: 4, cols: 6 }
    cls.seats = buildSeats(cls.layout)
    const errors = validateClass(cls)
    expect(errors.some((e) => e.includes('甲') && e.includes('已不存在'))).toBe(true)
  })

  it('两人抢同一个固定座位逐条列出，且与是否存在无关', () => {
    const cls = makeClass({ rows: 4, cols: 6, students: [] })
    cls.students = [
      makeStudent({ name: '甲', fixedSeatId: sid(1, 1) }),
      makeStudent({ name: '乙', fixedSeatId: sid(1, 1) }),
      makeStudent({ name: '丙', fixedSeatId: sid(2, 2) }),
      makeStudent({ name: '丁', fixedSeatId: sid(2, 2) }),
    ]
    const errors = validateClass(cls)
    const dupes = errors.filter((e) => e.includes('同时固定'))
    expect(dupes).toHaveLength(2)
    expect(dupes.some((e) => e.includes('甲') && e.includes('乙'))).toBe(true)
    expect(dupes.some((e) => e.includes('丙') && e.includes('丁'))).toBe(true)
  })

  it('不存在的座位不重复报「抢座」，只报不存在', () => {
    const cls = makeClass({ rows: 4, cols: 6, students: [] })
    cls.students = [
      makeStudent({ name: '甲', fixedSeatId: sid(9, 9) }),
      makeStudent({ name: '乙', fixedSeatId: sid(9, 9) }),
    ]
    const errors = validateClass(cls)
    expect(errors.filter((e) => e.includes('已不存在'))).toHaveLength(2)
    expect(errors.some((e) => e.includes('同时固定'))).toBe(false)
  })

  it('近视需前排的学生固定在后排 → 报错并点名座位', () => {
    const cls = makeClass({ rows: 5, cols: 6, students: [], frontRows: 2 })
    cls.students = [makeStudent({ name: '近视甲', vision: 'front_required', fixedSeatId: sid(4, 2) })]
    const errors = validateClass(cls)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('近视甲')
    expect(errors[0]).toContain('近视需坐前 2 排')
    expect(errors[0]).toContain('第 5 排第 3 列')
  })

  it('近视学生固定在前 N 排内不报错（后排只是容量问题之外的边界）', () => {
    const cls = makeClass({ rows: 5, cols: 6, students: [], frontRows: 2 })
    cls.students = [makeStudent({ name: '近视甲', vision: 'front_required', fixedSeatId: sid(1, 2) })]
    expect(validateClass(cls)).toEqual([])
  })

  it('行动不便学生固定在不靠过道的座位 → 报错', () => {
    // 4 列、无过道：仅第 0/3 列靠过道；r1c1、r1c2 不靠过道
    const cls = makeClass({ rows: 4, cols: 4, aisles: [], students: [] })
    cls.students = [makeStudent({ name: '不便甲', special: ['mobility'], fixedSeatId: sid(1, 1) })]
    const errors = validateClass(cls)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('不便甲')
    expect(errors[0]).toContain('行动不便需靠过道')
  })

  it('行动不便学生固定在过道旁座位不报错', () => {
    // 过道在第 1、2 列之间 → 列 1、2 靠过道
    const cls = makeClass({ rows: 4, cols: 4, aisles: [1], students: [] })
    cls.students = [makeStudent({ name: '不便甲', special: ['mobility'], fixedSeatId: sid(2, 1) })]
    expect(validateClass(cls)).toEqual([])
  })

  it('需中间列学生固定在边列 → 报错', () => {
    const cls = makeClass({ rows: 4, cols: 6, aisles: [], students: [] })
    cls.students = [makeStudent({ name: '中甲', vision: 'middle_required', fixedSeatId: sid(1, 0) })]
    const errors = validateClass(cls)
    expect(errors.some((e) => e.includes('中甲') && e.includes('需中间'))).toBe(true)
  })

  it('听力学生固定在后半部分 → 报错', () => {
    // 5 排：听力需前 3 排；r3 不满足
    const cls = makeClass({ rows: 5, cols: 6, students: [] })
    cls.students = [makeStudent({ name: '听甲', special: ['hearing'], fixedSeatId: sid(3, 2) })]
    const errors = validateClass(cls)
    expect(errors.some((e) => e.includes('听甲') && e.includes('听力需坐前'))).toBe(true)
  })

  it('同一学生可同时触发多条冲突，逐条列出', () => {
    const cls = makeClass({ rows: 5, cols: 4, aisles: [], students: [], frontRows: 2 })
    // r4c1：不在前 2 排、不靠过道
    cls.students = [
      makeStudent({
        name: '叠加甲',
        vision: 'front_required',
        special: ['mobility'],
        fixedSeatId: sid(4, 1),
      }),
    ]
    const errors = validateClass(cls)
    expect(errors).toHaveLength(2)
    expect(errors.some((e) => e.includes('近视需坐前'))).toBe(true)
    expect(errors.some((e) => e.includes('行动不便需靠过道'))).toBe(true)
  })
})
