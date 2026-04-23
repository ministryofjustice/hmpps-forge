import CodeEmitter from './CodeEmitter'

/**
 * Emits the object-to-array coercion used by compiled iterators.
 *
 * The generated functions all need the same object iteration shape. Keeping the
 * coercion in shared codegen prevents render, inventory, validation, and answer
 * prep from drifting apart.
 */
export function emitNormalizeIteratorInput(emitter: CodeEmitter, inputVar: string): void {
  emitter.emitBlock(
    `if (${inputVar} != null && !Array.isArray(${inputVar}) && typeof ${inputVar} === "object")`,
    () => {
      emitter.emit(
        `${inputVar} = Object.entries(${inputVar}).map(function(e) { return typeof e[1] === "object" && e[1] !== null ? Object.assign({"@key": e[0]}, e[1]) : {"@key": e[0], "@value": e[1]}; });`,
      )
    },
  )
}

/**
 * Emits the iterator item scope object expected by @scope/@item references.
 *
 * Object items are copied rather than mutated because their source may be
 * backed by session or data state shared with later compiled evaluations.
 */
export function emitIteratorItemScope(emitter: CodeEmitter, inputVar: string, indexVar: string, itemVar: string): void {
  emitter.emit(
    `var ${itemVar} = typeof ${inputVar}[${indexVar}] === "object" && ${inputVar}[${indexVar}] !== null ? Object.assign({}, ${inputVar}[${indexVar}]) : { "@value": ${inputVar}[${indexVar}] };`,
  )
  emitter.emit(`${itemVar}["@index"] = ${indexVar};`)
  emitter.emit(`${itemVar}["@type"] = "iterator";`)
  emitter.emit(`${itemVar}["@item"] = ${inputVar}[${indexVar}];`)
}
