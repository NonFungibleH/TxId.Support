// Which write functions of a contract are eligible for Actions. Shared by the
// customer dashboard (ActionsForm) and the admin Demo Creator so both compute
// eligibility identically — and identically to what the server enforces at
// prepare time: non-payable, non-view/pure, and only simple (static) arg types.
// Admin-looking names are flagged so they're enabled with care.

export const STATIC_ARG = /^(u?int\d*|address|bool|bytes\d+)$/
export const ADMIN_HINT = /owner|admin|upgrade|mint|pause|withdrawa?ll|setfee|transferownership|renounce/i

export interface WriteFunction {
  name: string
  inputs: string[]
  adminish: boolean
}

export function writeFunctionsOf(abiJson: string | null | undefined): WriteFunction[] {
  if (!abiJson) return []
  try {
    const abi = JSON.parse(abiJson) as {
      type?: string
      name?: string
      stateMutability?: string
      constant?: boolean
      inputs?: { type: string }[]
    }[]
    return abi
      .filter(
        f =>
          f.type === "function" &&
          !!f.name &&
          f.stateMutability !== "view" &&
          f.stateMutability !== "pure" &&
          f.stateMutability !== "payable" &&
          f.constant !== true &&
          (f.inputs ?? []).every(i => STATIC_ARG.test(i.type)),
      )
      .map(f => ({
        name: f.name as string,
        inputs: (f.inputs ?? []).map(i => i.type),
        adminish: ADMIN_HINT.test(f.name as string),
      }))
  } catch {
    return []
  }
}
