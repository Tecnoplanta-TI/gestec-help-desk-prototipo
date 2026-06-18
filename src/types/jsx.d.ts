/**
 * src/types/jsx.d.ts
 *
 * React 19 removeu o namespace global `JSX` (movido para `React.JSX`).
 * Este shim reexpõe o namespace global para manter as anotações de retorno
 * `JSX.Element` usadas em todo o Renderer sem reescrever cada arquivo.
 */

import type { JSX as ReactJSX } from 'react'

declare global {
  namespace JSX {
    type Element = ReactJSX.Element
    type ElementClass = ReactJSX.ElementClass
    type ElementAttributesProperty = ReactJSX.ElementAttributesProperty
    type ElementChildrenAttribute = ReactJSX.ElementChildrenAttribute
    type IntrinsicAttributes = ReactJSX.IntrinsicAttributes
    type IntrinsicClassAttributes<T> = ReactJSX.IntrinsicClassAttributes<T>
    type IntrinsicElements = ReactJSX.IntrinsicElements
  }
}
