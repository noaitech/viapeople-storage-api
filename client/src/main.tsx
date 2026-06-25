import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Evita quebras do React ao usar a tradução automática do navegador ou extensões que alteram o DOM
if (typeof window !== "undefined") {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function (this: any, child: any) {
    if (child.parentNode !== this) {
      if (typeof console !== "undefined") {
        console.warn("removeChild evitado: nó filho não pertence a este pai.", child, this);
      }
      return child;
    }
    return originalRemoveChild.apply(this, arguments as any);
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (this: any, newNode: any, referenceNode: any) {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (typeof console !== "undefined") {
        console.warn("insertBefore evitado: nó de referência não pertence a este pai.", newNode, referenceNode, this);
      }
      return newNode;
    }
    return originalInsertBefore.apply(this, arguments as any);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
