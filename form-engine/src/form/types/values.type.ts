import { ConditionalExpr, FormatExpr } from './expressions.type'
import { ConditionalExprBuilder } from '../builders/ConditionalExprBuilder'

export type ConditionalString = string | ConditionalExpr | ConditionalExprBuilder | FormatExpr

export type ConditionalValue<T> = T | ConditionalExpr | ConditionalExprBuilder | (T extends string ? FormatExpr : never)
