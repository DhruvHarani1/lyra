import { describe, expect, it } from 'vitest'
import { smtcScript } from './script'

describe('smtcScript player selection', () => {
  it('keeps Spotify as the default Windows media session filter', () => {
    const script = smtcScript(false)

    expect(script).toContain('$followAnyPlayer = $false')
    expect(script).toContain("$s.SourceAppUserModelId -match 'Spotify'")
  })

  it('uses the current session and falls back to a playing session when enabled', () => {
    const script = smtcScript(false, true)

    expect(script).toContain('$followAnyPlayer = $true')
    expect(script).toContain('$mgr.GetCurrentSession()')
    expect(script).toContain('$candidate.GetPlaybackInfo().PlaybackStatus')
    expect(script).toContain('return $candidate')
  })
})

describe('smtcScript bridge command responses', () => {
  it('returns command results with their request ids', () => {
    const script = smtcScript(false, true)

    expect(script).toContain("$request = $line | ConvertFrom-Json")
    expect(script).toContain("TryTogglePlayPauseAsync()")
    expect(script).toContain("commandResult = @{ id = [int]$request.id; ok = [bool]$commandOk")
  })

  it('reports rejected commands instead of discarding the result', () => {
    const script = smtcScript(false, true)

    expect(script).toContain("$commandOk = (Await $s.TryPlayAsync() ([bool])) -eq $true")
    expect(script).toContain("$commandError = $_.Exception.Message")
  })

  it('includes player identity in the artwork cache key and resets thumbnail state on player changes', () => {
    const script = smtcScript(false, true)

    expect(script).toContain('$key = "$($s.SourceAppUserModelId)|$($p.Title)|$($p.Artist)|$($p.AlbumTitle)"')
    expect(script).toContain("$thumbSentKey = ''")
  })
})
