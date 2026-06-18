/**
 * src/main.tsx — Entry point do Renderer Process
 *
 * Inicializa React e monta o componente raiz na div#root do index.html.
 * Usa React 19 com StrictMode para detectar efeitos colaterais em dev.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/globals.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('[main] Elemento #root não encontrado no DOM.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
