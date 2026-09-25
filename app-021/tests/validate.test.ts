import { describe, expect, it } from 'vitest'
import { validateClass } from '../src/lib/validate'
import { makeClass } from './helpers'

// 固定座位的前置校验：配置页应在点「生成」前逐条列出问题
describe('配置校验：固定座位', () => {
  it('固定座位在当前布局中不存在（行列数改小后残留的悬空座位）', () => {
    const cls = makeClass({ rows: 3, cols: 3 })
    cls.students[0].fixedSeatId = 'r4c2' // 第 5 排第 3 列：布局里不存在
    const errors = validateClass(cls)
    expect(errors.some((e) => e.includes(cls.students[0].name) && e.includes('不存在'))).toBe(true)
    expect(errors.some((e) => e.includes('第 5 排第 3 列'))).toBe(true)
  })

  it('两人被指定到同一固定座位 → 逐条列出', () => {
    const cls = makeClass({ rows: 3, cols: 4 })
    cls.students[0].fixedSeatId = 'r1c1'
    cls.students[1].fixedSeatId = 'r1c1'
    cls.students[2].fixedSeatId = 'r1c1' // 第三人也要再列一条
    const errors = validateClass(cls)
    const conflicts = errors.filter((e) => e.includes('固定座位冲突'))
    expect(conflicts).toHaveLength(2)
    expect(conflicts[0]).toContain(cls.students[0].name)
    expect(conflicts[0]).toContain(cls.students[1].name)
    expect(conflicts[1]).toContain(cls.students[2].name)
    expect(conflicts[0]).toContain('第 2 排第 2 列')
  })

  it('近视需前排的学生被固定在后排 → 提示冲突', () => {
    const cls = makeClass({ rows: 4, cols: 4, frontRows: 2 })
    cls.students[0].vision = 'front_required'
    cls.students[0].fixedSeatId = 'r3c1' // 最后一排
    const errors = validateClass(cls)
    expect(errors.some((e) => e.includes(cls.students[0].name) && e.includes('需前 2 排') && e.includes('第 4 排'))).toBe(
      true,
    )
  })

  it('行动不便的学生被固定在不靠过道的座位 → 提示冲突', () => {
    const cls = makeClass({ rows: 3, cols: 5, aisles: [1] }) // 过道在 2|3 列之间
    cls.students[0].special = ['mobility']
    cls.students[0].fixedSeatId = 'r1c3' // 第 4 列：不邻过道、不在最左/最右列
    const errors = validateClass(cls)
    expect(errors.some((e) => e.includes(cls.students[0].name) && e.includes('靠过道'))).toBe(true)
  })

  it('行动不便的学生固定在最左/最右列（引擎视为可靠过道）→ 不误报', () => {
    const cls = makeClass({ rows: 3, cols: 5, aisles: [1] })
    cls.students[0].special = ['mobility']
    cls.students[0].fixedSeatId = 'r1c0' // 最左列
    cls.students[1].special = ['mobility']
    cls.students[1].fixedSeatId = 'r1c4' // 最右列
    cls.students[2].special = ['mobility']
    cls.students[2].fixedSeatId = 'r0c1' // 紧邻过道
    expect(validateClass(cls).filter((e) => e.includes('靠过道'))).toHaveLength(0)
  })

  it('听力需求学生被固定在后一半排 → 提示冲突', () => {
    const cls = makeClass({ rows: 4, cols: 4 })
    cls.students[0].special = ['hearing']
    cls.students[0].fixedSeatId = 'r3c0' // 前一半为第 1~2 排
    const errors = validateClass(cls)
    expect(errors.some((e) => e.includes(cls.students[0].name) && e.includes('听力'))).toBe(true)
  })

  it('合法固定座位（含需中间）→ 不产生任何固定座位相关提示', () => {
    const cls = makeClass({ rows: 3, cols: 4 })
    cls.students[0].fixedSeatId = 'r0c0'
    cls.students[1].vision = 'middle_required'
    cls.students[1].fixedSeatId = 'r1c1' // 4 列时中间列为第 2、3 列
    cls.students[2].vision = 'front_required'
    cls.students[2].fixedSeatId = 'r1c2'
    const errors = validateClass(cls)
    expect(errors.filter((e) => e.includes('固定座位'))).toHaveLength(0)
  })
})
