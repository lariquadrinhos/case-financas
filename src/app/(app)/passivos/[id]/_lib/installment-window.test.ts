import { describe, expect, it } from 'vitest'
import { VISIBLE_INSTALLMENTS, windowInstallments } from './installment-window'

/**
 * The rule this file guards is the one Figma `91:99`-`91:132` states with
 * literal numbers, and the one the screen got wrong first: a 360-parcela
 * schedule must NOT render 360 rows. Drop the truncation and the page grows to
 * tens of thousands of pixels, which is why the count assertions below are
 * exact rather than "some rows".
 */
function schedule(count: number) {
  return Array.from({ length: count }, (_, index) => ({ number: index + 1 }))
}

describe('windowInstallments — Figma 91:99-91:132 / files_design/02', () => {
  it('reproduces the mockup exactly: 360 parcelas, 12 pagas → #11..#14 and "346 restantes"', () => {
    const { visible, remaining } = windowInstallments(schedule(360), 12)
    expect(visible.map((installment) => installment.number)).toEqual([11, 12, 13, 14])
    expect(remaining).toBe(346)
  })

  it('never renders the whole schedule, however long it is', () => {
    expect(windowInstallments(schedule(360), 0).visible).toHaveLength(VISIBLE_INSTALLMENTS)
    expect(windowInstallments(schedule(360), 359).visible).toHaveLength(VISIBLE_INSTALLMENTS)
  })

  it('starts at parcela #1 on a debt with nothing paid yet', () => {
    const { visible, remaining } = windowInstallments(schedule(360), 0)
    expect(visible.map((installment) => installment.number)).toEqual([1, 2, 3, 4])
    expect(remaining).toBe(356)
  })

  it('ends at the last parcela of a debt já quitada, with nothing left to announce', () => {
    const { visible, remaining } = windowInstallments(schedule(360), 360)
    expect(visible.map((installment) => installment.number)).toEqual([357, 358, 359, 360])
    expect(remaining).toBe(0)
  })

  it('shows a short schedule whole, without the truncation line', () => {
    const { visible, remaining } = windowInstallments(schedule(3), 1)
    expect(visible.map((installment) => installment.number)).toEqual([1, 2, 3])
    expect(remaining).toBe(0)
  })

  it('orders by parcela number, whatever order the endpoint returned', () => {
    const shuffled = [{ number: 3 }, { number: 1 }, { number: 5 }, { number: 2 }, { number: 4 }]
    expect(windowInstallments(shuffled, 0).visible.map((i) => i.number)).toEqual([1, 2, 3, 4])
  })
})
