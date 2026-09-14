'use client'

import { createContext, useContext, useState } from 'react'

const DocumentNonce = createContext(null)

export function DocumentNonceProvider({ nonce, children }) {
  // Soft navigation/router.refresh does not replace the document's CSP.
  // Retain its initial nonce until a full document reload mounts a new root.
  const [documentNonce] = useState(nonce)
  return <DocumentNonce.Provider value={documentNonce}>{children}</DocumentNonce.Provider>
}

export function NonceStyle({ children }) {
  const nonce = useContext(DocumentNonce)
  return <style nonce={nonce}>{children}</style>
}
