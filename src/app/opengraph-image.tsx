import { ImageResponse } from 'next/og'

export const alt = "Atlas - Describe the person. We'll find them."
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 80,
          background: '#f7f5f1',
          color: '#171717',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, letterSpacing: '0.34em' }}>
          ATLAS
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 92, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.02 }}>
            <span>Describe the person.</span>
            <span>We&rsquo;ll find them.</span>
          </div>
          <div style={{ display: 'flex', fontSize: 30, opacity: 0.62 }}>
            AI talent search for casting directors, producers, and creative teams.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 26 }}>
          <span style={{ fontWeight: 700 }}>
            atlas<span style={{ color: '#4655c4' }}>.select</span>
          </span>
          <span style={{ opacity: 0.55 }}>AI-native talent discovery</span>
        </div>
      </div>
    ),
    size,
  )
}
