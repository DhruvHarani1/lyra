import type { ReactNode } from 'react'

/** The framed window of a scene vibe (see styles/scene.css): a panel when there is no video, plus the vibe's own frame layers. */
export function SceneWindow({ children }: { children?: ReactNode }) {
  return (
    <div className="scenewin">
      <div className="scenewin__art">
        <span>No video</span>
        <div className="scenewin__eq">
          {[0, 0.2, 0.1, 0.3, 0.15].map((d, i) => (
            <i key={i} style={{ animationDelay: `${d}s` }} />
          ))}
        </div>
      </div>
      {children}
    </div>
  )
}
