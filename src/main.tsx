import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LazyMotion, domAnimation } from 'framer-motion'
import { BladeProvider } from '@razorpay/blade/components'
import { bladeTheme } from '@razorpay/blade/tokens'
import '@razorpay/blade/fonts.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BladeProvider themeTokens={bladeTheme} colorScheme="light">
      <LazyMotion strict features={domAnimation}>
        <App />
      </LazyMotion>
    </BladeProvider>
  </StrictMode>,
)
