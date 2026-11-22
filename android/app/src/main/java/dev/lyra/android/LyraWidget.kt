package dev.lyra.android

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Shader
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.util.SizeF
import android.widget.RemoteViews

/**
 * The home-screen widgets. Five of them share one engine ([LyraWidgetUpdater]):
 *
 *  - [LyraWidget]       "Lyra live lyrics", resizable: slim player / lyrics card / big lyrics card (launcher picks by size, Android 12+)
 *  - [LyraMiniWidget]   2 x 1: cover, current lyric line, play / pause
 *  - [LyraTickerWidget] 4 x 1: one big live lyric line with a progress bar
 *  - [LyraPlayWidget]   1 x 1: play / pause on the dimmed cover
 *  - [LyraCoverWidget]  2 x 2: the cover art with the current line on it
 *
 * Every widget has its own look ([WidgetThemes]): follow the vibe in effect (default), the cover's colours, Material You
 * (the phone's wallpaper colours, Android 12+) or any one vibe. The look is chosen when the widget is added and can be
 * changed later (long-press, Reconfigure) in [WidgetConfigActivity].
 *
 * The widgets are drawn by [LyraWidgetUpdater], which follows the media session and wakes itself at the next lyric line,
 * and does nothing at all while the screen is off.
 */
abstract class LyraBaseWidget : AppWidgetProvider() {
    override fun onEnabled(context: Context) {
        LyraWidgetUpdater.attach(context)
    }

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        LyraWidgetUpdater.attach(context)
        LyraWidgetUpdater.refresh(force = true)
    }

    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, newOptions: android.os.Bundle) {
        LyraWidgetUpdater.attach(context)
        LyraWidgetUpdater.refresh(force = true)
    }

    override fun onDeleted(context: Context, ids: IntArray) {
        WidgetThemes.forget(context, ids)
        LyraWidgetUpdater.forget(ids)
    }

    override fun onDisabled(context: Context) {
        // another Lyra widget may still be on the screen: refresh() detaches only when none is left
        LyraWidgetUpdater.refresh()
    }
}

class LyraWidget : LyraBaseWidget()
class LyraMiniWidget : LyraBaseWidget()
class LyraTickerWidget : LyraBaseWidget()
class LyraPlayWidget : LyraBaseWidget()
class LyraCoverWidget : LyraBaseWidget()
class LyraCardWidget : LyraBaseWidget()
class LyraBigWidget : LyraBaseWidget()
class LyraArtWidget : LyraBaseWidget()

/** Previous / play-pause / next pressed on the widget. */
class LyraWidgetAction : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val type = when (intent.action) {
            LyraWidgetUpdater.ACTION_PREV -> "previous"
            LyraWidgetUpdater.ACTION_NEXT -> "next"
            else -> "toggle"
        }
        MediaMonitor.command("""{"type":"$type"}""")
        LyraWidgetUpdater.refreshSoon(350)
    }
}

/** The widget's colours for one vibe (matches the player card / share card / Settings skin of that vibe). */
class WidgetPalette(val top: Int, val bottom: Int, val text: Int, val text2: Int, val accent: Int, val light: Boolean)

object WidgetPalettes {
    private fun p(top: String, bottom: String, text: String, accent: String, light: Boolean = false): WidgetPalette =
        make(Color.parseColor(top), Color.parseColor(bottom), Color.parseColor(text), Color.parseColor(accent), light)

    fun make(top: Int, bottom: Int, text: Int, accent: Int, light: Boolean): WidgetPalette {
        // the secondary text is the main text at 72 % opacity
        val t2 = Color.argb(184, Color.red(text), Color.green(text), Color.blue(text))
        return WidgetPalette(top, bottom, text, t2, accent, light)
    }

    /** The vibes that have a widget look, in the order the picker lists them: id to display name. */
    val vibeNames: List<Pair<String, String>> = listOf(
        "neon" to "Neon", "chrome" to "Chrome", "dream" to "Dream", "crt" to "CRT", "sticker" to "Sticker",
        "chat" to "Chat", "paper" to "Paper", "journal" to "Journal", "doodle" to "Doodle", "dusk" to "Dusk Ridge", "arcade" to "Arcade", "noir" to "Noir", "sunset" to "Sunset",
        "blocks" to "Blocks", "stadium" to "Stadium", "cassette" to "Cassette", "trailer" to "Trailer",
        "sketch" to "Sketchbook", "glitch" to "Glitch", "comic" to "Pop Comic",
        "stencil" to "Stencil", "film" to "Film Reel", "filmstrip" to "Film Strip", "lock" to "Lock Screen", "wallet" to "Wallet",
        "route" to "Route", "editor" to "Editor", "metro" to "Metro", "web" to "Web", "lens" to "Lens",
        "picto" to "Picto", "wall" to "Drift Wall", "flap" to "Split-flap"
    )

    /** null for the default "Artwork" vibe (and unknown ids): the widget then uses the cover's colours. */
    fun of(vibe: String?): WidgetPalette? = when (vibe) {
        "neon" -> p("#1A0A33", "#07020F", "#FFFFFF", "#FF3BD9")
        "chrome" -> p("#3A63D6", "#0B1646", "#FFFFFF", "#8FD1FF")
        "dream" -> p("#3B2A66", "#1B1235", "#FFFFFF", "#FFB4EC")
        "crt" -> p("#03150C", "#000000", "#B9FFCB", "#35FF7A")
        "sticker" -> p("#FFE94A", "#FFD21A", "#111111", "#FF3D81", true)
        "chat" -> p("#18213A", "#0A0F1F", "#FFFFFF", "#2F6BFF")
        "paper" -> p("#FFFAF0", "#E9DFC9", "#2D2A3A", "#E2554D", true)
        "doodle" -> p("#FFFDF4", "#FFE3EC", "#14110F", "#FF5F7E", true)
        "journal" -> p("#FDF4E6", "#EBD2C5", "#3B2A2F", "#E0556D", true)
        "arcade" -> p("#101046", "#06061A", "#FFFFFF", "#FFE600")
        "noir" -> p("#0C0C0C", "#000000", "#F4F4F4", "#FFFFFF")
        "dusk" -> p("#1B1640", "#FF8F70", "#FFFFFF", "#FFB86B")
        "sunset" -> p("#2B0A5A", "#FF2E93", "#FFFFFF", "#FFE14D")
        "blocks" -> p("#7A7A7A", "#5E5E5E", "#FFFFFF", "#55FF55")
        "stadium" -> p("#0B3B86", "#072A63", "#FFFFFF", "#FFD23F")
        "cassette" -> p("#ECDCC0", "#CDB893", "#2A1A0E", "#C8431B", true)
        "trailer" -> p("#050505", "#000000", "#F5E9C8", "#C9A24A")
        "sketch" -> p("#F4EAD0", "#E9DFB8", "#1F1511", "#D23A2A", true)
        "glitch" -> p("#1B0A07", "#0A0504", "#FFFFFF", "#FF4A2E")
        "comic" -> p("#FFF6C9", "#FFD400", "#111111", "#FF3B6B", true)
        "stencil" -> p("#2A2A2A", "#121212", "#FFFFFF", "#FF6A13")
        "film" -> p("#2A1D12", "#0E0804", "#F0E3C8", "#D9A441")
        "filmstrip" -> p("#F2B119", "#D99A00", "#111111", "#111111", true)
        "lock" -> p("#3A2A6B", "#1B1040", "#FFFFFF", "#FF8FD8")
        "wallet" -> p("#0E3B2A", "#04140D", "#FFFFFF", "#3CFF9A")
        "route" -> p("#0B1B3A", "#050C1E", "#FFFFFF", "#4DA3FF")
        "editor" -> p("#1E1E1E", "#0F0F10", "#E6E6E6", "#3794FF")
        "metro" -> p("#16161C", "#08080C", "#FFFFFF", "#FF3B5C")
        "web" -> p("#14183A", "#07091F", "#EEF1FF", "#AAB8FF")
        "lens" -> p("#0E2A26", "#050F0E", "#E8F5EF", "#FF3B30")
        "picto" -> p("#FFFFFF", "#EDEBFF", "#1A1D2B", "#7C5CFF", true)
        "wall" -> p("#1C1C26", "#0C0C12", "#FFFFFF", "#FFB43A")
        "flap" -> p("#FFD23F", "#E8B800", "#14120A", "#7A5C00", true)
        else -> null
    }

    /** Material You: the phone's own wallpaper colours (Android 12+), dark and high-contrast so the text always reads. */
    fun material(ctx: Context): WidgetPalette? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return null
        return make(
            ctx.getColor(android.R.color.system_accent1_800),
            ctx.getColor(android.R.color.system_neutral1_900),
            ctx.getColor(android.R.color.system_neutral1_50),
            ctx.getColor(android.R.color.system_accent1_200),
            false
        )
    }
}

/** The look chosen for each widget (stored per widget id). */
object WidgetThemes {
    const val AUTO = "auto"
    const val ARTWORK = "artwork"
    const val MATERIAL = "material"
    private const val PREFS = "lyra_widget"

    /** What the picker offers: key, name, one line of description. Material You only where the phone has it. */
    fun options(): List<Triple<String, String, String>> {
        val l = ArrayList<Triple<String, String, String>>()
        l.add(Triple(AUTO, "Follow the app", "Wears the vibe you are using in Lyra"))
        l.add(Triple(ARTWORK, "Artwork", "Colours picked from the cover"))
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) l.add(Triple(MATERIAL, "Material You", "Colours from your wallpaper"))
        for ((id, name) in WidgetPalettes.vibeNames) l.add(Triple(id, name, "A fixed vibe look"))
        return l
    }

    fun get(ctx: Context, id: Int): String =
        ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("theme_$id", AUTO) ?: AUTO

    fun set(ctx: Context, id: Int, key: String) {
        ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("theme_$id", key).apply()
    }

    fun forget(ctx: Context, ids: IntArray) {
        val e = ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
        for (i in ids) e.remove("theme_$i")
        e.apply()
    }

    /** The palette for a choice; null means "use the cover's colours". [vibe] is the vibe in effect in the app. */
    fun palette(ctx: Context, key: String, vibe: String?): WidgetPalette? = when (key) {
        ARTWORK -> null
        MATERIAL -> WidgetPalettes.material(ctx)
        AUTO -> WidgetPalettes.of(vibe)
        else -> WidgetPalettes.of(key)
    }

    /** A short stable name for the palette actually used (cache key). */
    fun effectiveKey(ctx: Context, key: String, vibe: String?): String = when {
        key == MATERIAL && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> "material"
        key == AUTO -> if (WidgetPalettes.of(vibe) != null) vibe!! else ARTWORK
        key == ARTWORK || WidgetPalettes.of(key) == null -> ARTWORK
        else -> key
    }
}

object LyraWidgetUpdater {
    const val ACTION_PREV = "dev.lyra.android.widget.PREV"
    const val ACTION_TOGGLE = "dev.lyra.android.widget.TOGGLE"
    const val ACTION_NEXT = "dev.lyra.android.widget.NEXT"

    // layout kinds
    private const val K_COMPACT = 1
    private const val K_MEDIUM = 2
    private const val K_LARGE = 3
    private const val K_MINI = 4
    private const val K_TICKER = 5
    private const val K_PLAY = 6
    private const val K_COVER = 7
    private const val K_CARD = 8
    private const val K_BIG = 9
    private const val K_ART = 10

    private val providers = listOf(
        LyraWidget::class.java, LyraMiniWidget::class.java, LyraTickerWidget::class.java,
        LyraPlayWidget::class.java, LyraCoverWidget::class.java,
        LyraCardWidget::class.java, LyraBigWidget::class.java, LyraArtWidget::class.java
    )

    private val main = Handler(Looper.getMainLooper())
    private var appCtx: Context? = null
    private var attached = false
    private val listener = { refresh() }
    private val tick = Runnable { refresh() }

    // Nothing is drawn while the screen is off; it catches up the moment the screen comes on.
    private val screenReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action == Intent.ACTION_SCREEN_OFF) main.removeCallbacks(tick)
            else refresh(force = true)
        }
    }

    // per-song caches so a redraw every second costs almost nothing
    private var cachedId: String? = null
    private var cachedArtKey: String? = null
    private var cachedArt: Bitmap? = null
    private var accent: Int = Color.parseColor("#6a3d8a")
    private val bgCache = HashMap<String, Bitmap>()
    // what each widget id last showed, to skip identical redraws
    private val lastSig = HashMap<Int, String>()
    // the big-lyric widget's ViewFlipper: which child is showing, and the line it shows
    private val flipCur = HashMap<Int, Int>()
    private val flipLine = HashMap<Int, String>()
    private var vibe: String? = null
    private const val PREFS = "lyra_widget"

    /** The web UI tells us which vibe is in effect; it is remembered so the widget keeps it after a reboot. */
    fun setVibe(ctx: Context, id: String?) {
        val v = id?.takeIf { it.isNotBlank() && it != "none" }
        if (v == vibe && appCtx != null) return
        vibe = v
        ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("vibe", v).apply()
        refreshSoon()
    }

    fun attach(ctx: Context) {
        appCtx = ctx.applicationContext
        if (vibe == null) vibe = appCtx!!.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("vibe", null)
        if (!attached) {
            attached = true
            MediaMonitor.addListener(listener)
            MediaMonitor.refresh(ctx)
            val f = IntentFilter().apply { addAction(Intent.ACTION_SCREEN_OFF); addAction(Intent.ACTION_SCREEN_ON) }
            appCtx!!.registerReceiver(screenReceiver, f)
        }
    }

    fun detach() {
        if (attached) {
            attached = false
            try { appCtx?.unregisterReceiver(screenReceiver) } catch (_: Exception) { }
        }
        MediaMonitor.removeListener(listener)
        main.removeCallbacks(tick)
        lastSig.clear()
        flipCur.clear()
        flipLine.clear()
        bgCache.clear()
    }

    fun forget(ids: IntArray) {
        for (i in ids) { lastSig.remove(i); flipCur.remove(i); flipLine.remove(i) }
    }

    /** Called when new lyric lines arrive from the app. */
    fun refreshSoon(delayMs: Long = 0) {
        main.removeCallbacks(tick)
        main.postDelayed(tick, delayMs)
    }

    private fun screenOn(ctx: Context): Boolean =
        (ctx.getSystemService(Context.POWER_SERVICE) as PowerManager).isInteractive

    /** Redraw every placed widget. [force] ignores the "nothing changed" shortcut (a new widget, a resize, a theme change). */
    fun refresh(force: Boolean = false) {
        val ctx = appCtx ?: return
        main.removeCallbacks(tick)
        val mgr = AppWidgetManager.getInstance(ctx)
        val placed = providers.map { it to mgr.getAppWidgetIds(ComponentName(ctx, it)) }
        if (placed.all { it.second.isEmpty() }) {
            detach()
            return
        }
        if (!screenOn(ctx)) return // the screen-on receiver brings us back
        val now = try { MediaMonitor.now() } catch (_: Exception) { null }
        val state = describe(now)
        refreshArt(ctx, state)
        for ((cls, ids) in placed) {
            for (id in ids) {
                val key = WidgetThemes.get(ctx, id)
                val sig = "${state.id}|${state.title}|${state.lyric}|${state.nextLine}|${state.playing}|${state.progress / 12}|$key|$vibe"
                if (!force && lastSig[id] == sig) continue
                try {
                    mgr.updateAppWidget(id, build(ctx, id, cls, state, key))
                    lastSig[id] = sig
                } catch (_: Exception) {
                    // a launcher that refuses the update must never crash the app
                }
            }
        }
        if (now != null && now.playing) main.postDelayed(tick, nextDelay(now))
    }

    // ---------- what to show ----------
    private class State(
        val title: String,
        val artist: String,
        val lyric: String,
        val nextLine: String,
        val playing: Boolean,
        val progress: Int,
        val art: Bitmap?,
        val id: String?
    )

    private fun describe(now: MediaMonitor.Now?): State {
        if (now == null || now.isAd) {
            return State("Lyra", if (now?.isAd == true) "Ad playing" else "Nothing playing", "Play a song to see its lyrics here", "", false, 0, null, null)
        }
        var lyric = "♪"
        var next = ""
        val lines = LyricsNotifier.lines
        val mine = LyricsNotifier.linesTrack == now.id && lines.isNotEmpty() && LyricsNotifier.status == "synced"
        if (mine) {
            val i = LyricsNotifier.activeIndex(now.positionMs)
            if (i >= 0) {
                lyric = lines[i].text.ifBlank { "♪" }
                next = lines.getOrNull(i + 1)?.text.orEmpty()
            } else {
                next = lines.firstOrNull()?.text.orEmpty()
            }
        } else {
            lyric = when {
                LyricsNotifier.linesTrack == now.id && LyricsNotifier.status == "none" -> "No synced lyrics for this song"
                LyricsNotifier.linesTrack == now.id && LyricsNotifier.status == "loading" -> "Finding the lyrics…"
                else -> "Open Lyra to load the lyrics"
            }
        }
        val progress = if (now.durationMs > 0) ((now.positionMs * 1000) / now.durationMs).toInt().coerceIn(0, 1000) else 0
        return State(now.title, now.artist, lyric, next, now.playing, progress, now.art, now.id)
    }

    /** When to draw next: the moment the next lyric line starts (never faster than 0.4 s), else every few seconds for the progress bar. */
    private fun nextDelay(now: MediaMonitor.Now): Long {
        val lines = LyricsNotifier.lines
        if (LyricsNotifier.linesTrack == now.id && lines.isNotEmpty()) {
            val i = LyricsNotifier.activeIndex(now.positionMs)
            val nextT = lines.getOrNull(i + 1)?.t
            if (nextT != null) {
                val wait = nextT - (now.positionMs + LyricsNotifier.offsetMs)
                return wait.coerceIn(400, 4000)
            }
        }
        return 4000
    }

    // ---------- drawing ----------
    private fun build(ctx: Context, id: Int, cls: Class<*>, s: State, themeKey: String): RemoteViews {
        val pal = WidgetThemes.palette(ctx, themeKey, vibe)
        val eff = WidgetThemes.effectiveKey(ctx, themeKey, vibe)
        fun view(layout: Int, kind: Int): RemoteViews = fill(ctx, id, RemoteViews(ctx.packageName, layout), s, kind, pal, eff)
        return when (cls) {
            LyraMiniWidget::class.java -> view(R.layout.lyra_widget_mini, K_MINI)
            LyraTickerWidget::class.java -> view(R.layout.lyra_widget_ticker, K_TICKER)
            LyraPlayWidget::class.java -> view(R.layout.lyra_widget_play, K_PLAY)
            LyraCoverWidget::class.java -> view(R.layout.lyra_widget_cover, K_COVER)
            LyraCardWidget::class.java -> view(R.layout.lyra_widget_card, K_CARD)
            LyraBigWidget::class.java -> view(R.layout.lyra_widget_big, K_BIG)
            LyraArtWidget::class.java -> view(R.layout.lyra_widget_art, K_ART)
            else -> {
                val medium = view(R.layout.lyra_widget_medium, K_MEDIUM)
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) medium
                else RemoteViews(
                    mapOf(
                        SizeF(110f, 56f) to view(R.layout.lyra_widget_compact, K_COMPACT),
                        SizeF(250f, 110f) to medium,
                        SizeF(250f, 200f) to view(R.layout.lyra_widget_large, K_LARGE)
                    )
                )
            }
        }
    }

    private fun fill(ctx: Context, id: Int, v: RemoteViews, s: State, kind: Int, pl: WidgetPalette?, effKey: String): RemoteViews {
        val text = pl?.text ?: Color.WHITE
        val text2 = pl?.text2 ?: Color.argb(179, 255, 255, 255)
        val overCover = kind == K_COVER || kind == K_PLAY || kind == K_ART // text sits on the photo + scrim: always white
        val ink = if (overCover) Color.WHITE else text
        val ink2 = if (overCover) Color.argb(220, 255, 255, 255) else text2
        // only touch the views a layout really has
        fun has(vararg kinds: Int) = kind in kinds
        val hasTitle = !has(K_PLAY, K_ART)
        val hasArtist = has(K_COMPACT, K_MEDIUM, K_LARGE, K_CARD)
        val hasLyric = !has(K_COMPACT, K_PLAY, K_ART, K_BIG) // K_BIG draws its line in a flipper, below
        val hasNext = has(K_LARGE, K_CARD)
        val hasProgress = has(K_MEDIUM, K_LARGE, K_TICKER, K_CARD, K_BIG)
        val hasPrevNext = has(K_MEDIUM, K_LARGE, K_CARD)
        val hasArt = has(K_COMPACT, K_MEDIUM, K_LARGE, K_MINI, K_TICKER, K_CARD)

        if (hasTitle) v.setTextColor(R.id.lw_title, ink)
        if (hasArtist) v.setTextColor(R.id.lw_artist, ink2)
        if (hasLyric) v.setTextColor(R.id.lw_lyric, if (kind == K_COVER) ink2 else ink)
        if (hasNext) v.setTextColor(R.id.lw_next_line, ink2)
        if (hasPrevNext) {
            v.setInt(R.id.lw_prev, "setColorFilter", if (pl != null) text else 0)
            v.setInt(R.id.lw_next, "setColorFilter", if (pl != null) text else 0)
        }

        // play / pause: a solid disc with an icon that always contrasts (ink disc on light looks, white disc otherwise)
        val inkDisc = pl?.light == true && !overCover
        v.setInt(R.id.lw_play, "setBackgroundResource", if (inkDisc) R.drawable.widget_btn_bg_main_ink else R.drawable.widget_btn_bg_main)
        v.setImageViewResource(
            R.id.lw_play,
            if (inkDisc) (if (s.playing) R.drawable.ic_w_pause else R.drawable.ic_w_play)
            else (if (s.playing) R.drawable.ic_w_pause_dark else R.drawable.ic_w_play_dark)
        )

        // texts. The ticker folds the artist into its small line
        if (hasTitle) v.setTextViewText(R.id.lw_title, if (kind == K_TICKER && s.artist.isNotEmpty()) "${s.title} \u00b7 ${s.artist}" else s.title)
        if (hasArtist) v.setTextViewText(R.id.lw_artist, s.artist)
        if (hasLyric) v.setTextViewText(R.id.lw_lyric, s.lyric)
        if (hasNext) v.setTextViewText(R.id.lw_next_line, s.nextLine)
        if (kind == K_BIG) flipLyric(v, id, s.lyric, ink)
        if (hasProgress) v.setProgressBar(R.id.lw_progress, 1000, s.progress, false)

        if (hasArt) {
            val art = cachedArt
            if (art != null) v.setImageViewBitmap(R.id.lw_art, art) else v.setImageViewResource(R.id.lw_art, R.drawable.ic_ambient)
        }
        v.setImageViewBitmap(R.id.lw_bg, background(ctx, s, kind, pl, effKey) ?: return v)

        v.setOnClickPendingIntent(R.id.lw_play, broadcast(ctx, ACTION_TOGGLE, 1))
        if (hasPrevNext) {
            v.setOnClickPendingIntent(R.id.lw_prev, broadcast(ctx, ACTION_PREV, 2))
            v.setOnClickPendingIntent(R.id.lw_next, broadcast(ctx, ACTION_NEXT, 3))
        }
        val open = PendingIntent.getActivity(ctx, 4, Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        v.setOnClickPendingIntent(R.id.lw_root, open)
        return v
    }

    /**
     * The big-lyric widget: the new line goes into the hidden child of a ViewFlipper and showNext() plays the in / out
     * animations (res/anim/lw_in, lw_out). The displayed child is always set first, so a launcher that re-inflated the
     * layout still starts from the line that was on screen and the transition stays correct.
     */
    private fun flipLyric(v: RemoteViews, id: Int, line: String, ink: Int) {
        val ids = intArrayOf(R.id.lw_lyric_a, R.id.lw_lyric_b)
        v.setTextColor(ids[0], ink)
        v.setTextColor(ids[1], ink)
        val cur = flipCur[id] ?: 0
        val last = flipLine[id]
        v.setDisplayedChild(R.id.lw_flipper, cur)
        if (last != null && last != line) {
            v.setTextViewText(ids[cur], last)
            v.setTextViewText(ids[1 - cur], line)
            v.showNext(R.id.lw_flipper)
            flipCur[id] = 1 - cur
        } else {
            v.setTextViewText(ids[cur], line)
        }
        flipLine[id] = line
    }

    /** The system's own widget corner radius on Android 12+ (so the card matches the launcher's other widgets), else [fallbackDp]. */
    private fun cornerRadius(ctx: Context, fallbackDp: Float): Float =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) ctx.resources.getDimension(android.R.dimen.system_app_widget_background_radius)
        else fallbackDp * ctx.resources.displayMetrics.density

    private fun broadcast(ctx: Context, action: String, code: Int): PendingIntent =
        PendingIntent.getBroadcast(ctx, code, Intent(ctx, LyraWidgetAction::class.java).setAction(action), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

    /** The rounded cover and the cover's accent colour, rebuilt only when the song changes. */
    private fun refreshArt(ctx: Context, s: State) {
        if (s.id == cachedId && (cachedArt != null || s.art == null)) return
        cachedId = s.id
        bgCache.clear()
        val dp = ctx.resources.displayMetrics.density
        val src = s.art
        cachedArt = src?.let { rounded(it, (96 * dp).toInt(), 18 * dp) }
        accent = src?.let { accentOf(it) } ?: Color.parseColor("#6a3d8a")
    }

    /** The card behind the text, one per (song, look, layout), cached. Sizes are capped to keep the update small. */
    private fun background(ctx: Context, s: State, kind: Int, pl: WidgetPalette?, effKey: String): Bitmap? {
        val key = "${s.id}|$effKey|$kind"
        bgCache[key]?.let { return it }
        val dp = ctx.resources.displayMetrics.density
        val r = cornerRadius(ctx, 22f)
        val bmp = when (kind) {
            K_COMPACT -> gradient((260 * dp).toInt().coerceAtMost(700), (96 * dp).toInt().coerceAtMost(300), accent, r, pl)
            K_MINI -> gradient((200 * dp).toInt().coerceAtMost(600), (64 * dp).toInt().coerceAtMost(220), accent, r, pl)
            K_TICKER -> gradient((420 * dp).toInt().coerceAtMost(900), (64 * dp).toInt().coerceAtMost(220), accent, r, pl)
            K_COVER -> coverCard(s.art, (200 * dp).toInt().coerceAtMost(520), r, 0.62f, accent, pl)
            K_PLAY -> coverCard(s.art, (100 * dp).toInt().coerceAtMost(300), r, 0f, accent, pl, dim = 120)
            K_ART -> coverCard(s.art, (100 * dp).toInt().coerceAtMost(300), r, 0f, accent, pl)
            K_BIG -> gradient((200 * dp).toInt().coerceAtMost(520), (200 * dp).toInt().coerceAtMost(520), accent, r, pl)
            else -> gradient((420 * dp).toInt().coerceAtMost(900), (200 * dp).toInt().coerceAtMost(500), accent, r, pl)
        }
        bgCache[key] = bmp
        return bmp
    }

    /** The cover filling a rounded card. [scrim] darkens the bottom part (for text), [dim] darkens everything. Without a cover, the gradient. */
    private fun coverCard(src: Bitmap?, size: Int, radius: Float, scrim: Float, accent: Int, pal: WidgetPalette?, dim: Int = 0): Bitmap {
        if (src == null) return gradient(size, size, accent, radius, pal)
        val out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val c = Canvas(out)
        val rect = RectF(0f, 0f, size.toFloat(), size.toFloat())
        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        c.drawRoundRect(rect, radius, radius, p)
        p.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_ATOP)
        val side = minOf(src.width, src.height)
        val left = (src.width - side) / 2
        val top = (src.height - side) / 2
        p.isFilterBitmap = true
        c.drawBitmap(src, Rect(left, top, left + side, top + side), rect, p)
        if (dim > 0) {
            val d = Paint(Paint.ANTI_ALIAS_FLAG)
            d.color = Color.argb(dim, 0, 0, 0)
            d.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_ATOP)
            c.drawRect(rect, d)
        }
        if (scrim > 0f) {
            val sp = Paint(Paint.ANTI_ALIAS_FLAG)
            sp.shader = LinearGradient(0f, size * (1f - scrim), 0f, size.toFloat(), Color.TRANSPARENT, Color.argb(215, 0, 0, 0), Shader.TileMode.CLAMP)
            sp.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_ATOP)
            c.drawRect(0f, size * (1f - scrim), size.toFloat(), size.toFloat(), sp)
        }
        if (pal != null) {
            // a thin edge in the look's accent colour, like the border of its player card
            val edge = Paint(Paint.ANTI_ALIAS_FLAG)
            edge.style = Paint.Style.STROKE
            edge.strokeWidth = 3f
            edge.color = pal.accent
            edge.alpha = 200
            c.drawRoundRect(RectF(2f, 2f, size - 2f, size - 2f), radius, radius, edge)
        }
        return out
    }

    /** A square, rounded copy of the cover. */
    private fun rounded(src: Bitmap, size: Int, radius: Float): Bitmap {
        val out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val c = Canvas(out)
        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        c.drawRoundRect(RectF(0f, 0f, size.toFloat(), size.toFloat()), radius, radius, p)
        p.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
        val side = minOf(src.width, src.height)
        val left = (src.width - side) / 2
        val top = (src.height - side) / 2
        c.drawBitmap(src, Rect(left, top, left + side, top + side), RectF(0f, 0f, size.toFloat(), size.toFloat()), p)
        return out
    }

    /** The most vivid colour of the cover (sampled on a tiny copy), pulled to a dark value so white text always reads well. */
    private fun accentOf(src: Bitmap): Int {
        val t = Bitmap.createScaledBitmap(src, 12, 12, true)
        var best = Color.parseColor("#6a3d8a")
        var bestScore = -1f
        val hsv = FloatArray(3)
        for (y in 0 until t.height) for (x in 0 until t.width) {
            Color.colorToHSV(t.getPixel(x, y), hsv)
            val score = hsv[1] * (0.4f + hsv[2]) // saturated and not black
            if (score > bestScore) {
                bestScore = score
                best = Color.HSVToColor(floatArrayOf(hsv[0], hsv[1], hsv[2]))
            }
        }
        return best
    }

    /** Dark, rich two-tone gradient from the accent colour (or the look's own colours), with rounded corners. */
    private fun gradient(w: Int, h: Int, accent: Int, radius: Float, vibePal: WidgetPalette? = null): Bitmap {
        val hsv = FloatArray(3)
        Color.colorToHSV(accent, hsv)
        val top = vibePal?.top ?: Color.HSVToColor(floatArrayOf(hsv[0], (hsv[1] * 0.9f).coerceIn(0.25f, 0.9f), 0.46f))
        val bottom = vibePal?.bottom ?: Color.HSVToColor(floatArrayOf((hsv[0] + 24f) % 360f, (hsv[1] * 0.8f).coerceIn(0.2f, 0.85f), 0.2f))
        val out = Bitmap.createBitmap(w.coerceAtLeast(2), h.coerceAtLeast(2), Bitmap.Config.ARGB_8888)
        val c = Canvas(out)
        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        p.shader = LinearGradient(0f, 0f, w.toFloat(), h.toFloat(), top, bottom, Shader.TileMode.CLAMP)
        c.drawRoundRect(RectF(0f, 0f, w.toFloat(), h.toFloat()), radius, radius, p)
        // a soft light in the top-left corner, like glass catching the light
        val glow = Paint(Paint.ANTI_ALIAS_FLAG)
        glow.shader = android.graphics.RadialGradient(w * 0.15f, 0f, w * 0.7f, Color.argb(46, 255, 255, 255), Color.TRANSPARENT, Shader.TileMode.CLAMP)
        glow.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_ATOP)
        if (vibePal?.light != true) c.drawRoundRect(RectF(0f, 0f, w.toFloat(), h.toFloat()), radius, radius, glow)
        if (vibePal != null) {
            // a thin edge in the vibe's accent colour, like the border of its player card
            val edge = Paint(Paint.ANTI_ALIAS_FLAG)
            edge.style = Paint.Style.STROKE
            edge.strokeWidth = 3f
            edge.color = vibePal.accent
            edge.alpha = 200
            c.drawRoundRect(RectF(2f, 2f, w - 2f, h - 2f), radius, radius, edge)
        }
        return out
    }
}
