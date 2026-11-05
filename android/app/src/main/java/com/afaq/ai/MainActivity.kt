package com.afaq.ai

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.lifecycleScope
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.flow.catch
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

private val Ink = Color(0xFF071711)
private val Panel = Color(0xFF10251C)
private val Panel2 = Color(0xFF163126)
private val Gold = Color(0xFFD8B879)
private val Mint = Color(0xFF9CC9AA)
private val TextMain = Color(0xFFEAF1E9)
private val TextMuted = Color(0xFF91A99A)
private const val MODEL_URL = "https://huggingface.co/litert-community/Qwen3-0.6B/resolve/main/Qwen3-0.6B.litertlm"
private const val MODEL_FILE = "Qwen3-0.6B.litertlm"

data class ChatMessage(val id: Long, val user: Boolean, val text: String)

class MainActivity : ComponentActivity() {
    private var engine: Engine? = null
    private var conversation: Conversation? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            AfaqApp(
                modelFile = File(filesDir, MODEL_FILE),
                onDownload = { progress -> downloadModel(progress) },
                onInitialize = { initializeModel() },
                onSend = { prompt, onChunk -> sendPrompt(prompt, onChunk) },
                onClose = { closeModel() }
            )
        }
    }

    private suspend fun downloadModel(onProgress: (Int) -> Unit) = withContext(Dispatchers.IO) {
        val target = File(filesDir, MODEL_FILE)
        if (target.exists() && target.length() > 400_000_000L) {
            onProgress(100)
            return@withContext
        }
        val partial = File(filesDir, "$MODEL_FILE.part")
        val connection = (URL(MODEL_URL).openConnection() as HttpURLConnection).apply {
            connectTimeout = 30_000
            readTimeout = 60_000
            instanceFollowRedirects = true
            setRequestProperty("User-Agent", "AFAQ-AI-Android")
        }
        try {
            connection.connect()
            if (connection.responseCode !in 200..299) error("تعذّر تنزيل النموذج: HTTP ${connection.responseCode}")
            val total = connection.contentLengthLong
            connection.inputStream.use { input ->
                partial.outputStream().buffered().use { output ->
                    val buffer = ByteArray(1024 * 256)
                    var count: Int
                    var received = 0L
                    while (input.read(buffer).also { count = it } >= 0) {
                        if (count == 0) continue
                        output.write(buffer, 0, count)
                        received += count
                        if (total > 0) onProgress(((received * 100) / total).toInt().coerceIn(0, 99))
                    }
                }
            }
            if (partial.length() < 400_000_000L) error("حجم ملف النموذج أقل من المتوقع؛ أعد المحاولة.")
            if (!partial.renameTo(target)) {
                partial.copyTo(target, overwrite = true)
                partial.delete()
            }
            onProgress(100)
        } catch (t: Throwable) {
            partial.delete()
            throw t
        } finally {
            connection.disconnect()
        }
    }

    private suspend fun initializeModel() = withContext(Dispatchers.IO) {
        val model = File(filesDir, MODEL_FILE)
        check(model.exists() && model.length() > 400_000_000L) { "حمّل النموذج أولاً." }
        closeModel()
        val newEngine = Engine(EngineConfig(modelPath = model.absolutePath, backend = Backend.CPU(), cacheDir = cacheDir.absolutePath))
        newEngine.initialize()
        engine = newEngine
        conversation = newEngine.createConversation(
            ConversationConfig(systemInstruction = Contents.of("أنت آفاق، مساعد ذكي عربي. أجب باللغة العربية الواضحة، وكن دقيقاً ومفيداً. عند طلب البرمجة قدم أمثلة صحيحة واشرحها. لا تخترع معلومات عند عدم المعرفة."))
        )
    }

    private suspend fun sendPrompt(prompt: String, onChunk: (String) -> Unit) {
        val active = conversation ?: error("النموذج غير جاهز.")
        active.sendMessageAsync(prompt).catch { throw it }.collect { message ->
            onChunk(message.text)
        }
    }

    private fun closeModel() {
        try { conversation?.close() } catch (_: Throwable) {}
        try { engine?.close() } catch (_: Throwable) {}
        conversation = null
        engine = null
    }

    override fun onDestroy() {
        closeModel()
        super.onDestroy()
    }

    @Composable
    private fun AfaqApp(
        modelFile: File,
        onDownload: suspend ((Int) -> Unit) -> Unit,
        onInitialize: suspend () -> Unit,
        onSend: suspend (String, (String) -> Unit) -> Unit,
        onClose: () -> Unit
    ) {
        val scope = rememberCoroutineScope()
        var downloaded by remember { mutableStateOf(modelFile.exists() && modelFile.length() > 400_000_000L) }
        var ready by remember { mutableStateOf(false) }
        var busy by remember { mutableStateOf(false) }
        var progress by remember { mutableIntStateOf(0) }
        var status by remember { mutableStateOf(if (downloaded) "النموذج محفوظ على جهازك" else "حمّل النموذج للبدء") }
        var error by remember { mutableStateOf("") }
        var input by remember { mutableStateOf("") }
        var messages by remember { mutableStateOf(listOf<ChatMessage>()) }
        var messageId by remember { mutableLongStateOf(0L) }

        MaterialTheme(colorScheme = darkColorScheme(
            primary = Gold, secondary = Mint, background = Ink, surface = Panel,
            onPrimary = Ink, onBackground = TextMain, onSurface = TextMain
        )) {
            Column(Modifier.fillMaxSize().background(Ink)) {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 15.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(Modifier.size(42.dp).background(Brush.linearGradient(listOf(Gold, Color(0xFF8B7046))), RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.AutoAwesome, null, tint = Ink, modifier = Modifier.size(23.dp))
                    }
                    Spacer(Modifier.width(11.dp))
                    Column(Modifier.weight(1f)) {
                        Text("AFAQ AI", color = TextMain, fontWeight = FontWeight.Bold, fontSize = 18.sp, letterSpacing = 1.sp)
                        Text("آفاق · مساحة ذكاء اصطناعي", color = TextMuted, fontSize = 10.sp)
                    }
                    Surface(color = if (ready) Color(0xFF1C4934) else Panel2, shape = CircleShape) {
                        Row(Modifier.padding(horizontal = 10.dp, vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.size(6.dp).background(if (ready) Mint else Gold, CircleShape))
                            Spacer(Modifier.width(6.dp))
                            Text(if (ready) "جاهز" else "محلي", color = if (ready) Mint else Gold, fontSize = 10.sp)
                        }
                    }
                }
                HorizontalDivider(color = Color.White.copy(alpha = .07f))
                if (!ready && messages.isEmpty()) {
                    Column(Modifier.weight(1f).fillMaxWidth().padding(horizontal = 22.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                        Box(Modifier.size(92.dp).background(Brush.radialGradient(listOf(Color(0xFF345541), Panel)), CircleShape).border(1.dp, Gold.copy(alpha = .35f), CircleShape), contentAlignment = Alignment.Center) {
                            Icon(Icons.Default.AutoAwesome, null, tint = Gold, modifier = Modifier.size(36.dp))
                        }
                        Spacer(Modifier.height(25.dp))
                        Text("مرحباً بك في آفاق", color = TextMain, fontSize = 25.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(9.dp))
                        Text("ذكاء اصطناعي يعمل على جهازك،
ومحادثاتك تبقى خاصة.", color = TextMuted, fontSize = 13.sp, lineHeight = 22.sp, textAlign = TextAlign.Center)
                        Spacer(Modifier.height(26.dp))
                        Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(17.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.Memory, null, tint = Gold)
                                    Spacer(Modifier.width(9.dp))
                                    Column(Modifier.weight(1f)) {
                                        Text("Qwen3 · 0.6B", color = TextMain, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                                        Text("نموذج محلي · تنزيل لمرة واحدة", color = TextMuted, fontSize = 10.sp)
                                    }
                                    Text("~600 MB", color = Gold, fontSize = 10.sp)
                                }
                                Spacer(Modifier.height(14.dp))
                                Text(status, color = TextMuted, fontSize = 11.sp)
                                if (busy) {
                                    Spacer(Modifier.height(10.dp))
                                    LinearProgressIndicator(progress = { progress / 100f }, modifier = Modifier.fillMaxWidth(), color = Gold, trackColor = Panel2)
                                    Text("$progress%", color = Gold, fontSize = 10.sp, modifier = Modifier.align(Alignment.End).padding(top = 5.dp))
                                }
                                Spacer(Modifier.height(13.dp))
                                Button(
                                    onClick = {
                                        error = ""
                                        busy = true
                                        scope.launch {
                                            try {
                                                if (!downloaded) {
                                                    status = "جارٍ تنزيل ملفات النموذج..."
                                                    onDownload { progress = it }
                                                    downloaded = true
                                                }
                                                status = "جارٍ تهيئة النموذج على جهازك..."
                                                progress = 100
                                                onInitialize()
                                                ready = true
                                                status = "النموذج جاهز"
                                            } catch (t: Throwable) {
                                                error = t.message ?: "حدث خطأ غير متوقع"
                                                status = "تعذّر إكمال التشغيل"
                                            } finally { busy = false }
                                        }
                                    },
                                    enabled = !busy,
                                    modifier = Modifier.fillMaxWidth().height(49.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Gold, contentColor = Ink),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    if (busy) CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = Ink)
                                    else Icon(Icons.Default.Download, null)
                                    Spacer(Modifier.width(8.dp))
                                    Text(if (downloaded) "تشغيل النموذج" else "تنزيل النموذج والبدء", fontWeight = FontWeight.Bold)
                                }
                                Text("يتطلب اتصالاً بالإنترنت للتنزيل الأول ومساحة فارغة كافية. بعد ذلك يعمل دون اتصال.", color = TextMuted, fontSize = 9.sp, lineHeight = 16.sp, modifier = Modifier.padding(top = 10.dp))
                            }
                        }
                        if (error.isNotBlank()) Text(error, color = Color(0xFFFF9B91), fontSize = 11.sp, modifier = Modifier.padding(top = 12.dp))
                    }
                } else {
                    LazyColumn(Modifier.weight(1f).fillMaxWidth().padding(horizontal = 14.dp), contentPadding = PaddingValues(vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        items(messages, key = { it.id }) { msg ->
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = if (msg.user) Arrangement.Start else Arrangement.End) {
                                Surface(color = if (msg.user) Panel2 else Panel, shape = RoundedCornerShape(17.dp), modifier = Modifier.fillMaxWidth(.9f)) {
                                    Column(Modifier.padding(13.dp)) {
                                        Text(if (msg.user) "أنت" else "آفاق", color = Gold, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                        Spacer(Modifier.height(5.dp))
                                        Text(msg.text, color = TextMain, fontSize = 13.sp, lineHeight = 21.sp)
                                    }
                                }
                            }
                        }
                        if (busy) item { LinearProgressIndicator(modifier = Modifier.fillMaxWidth(.35f), color = Gold, trackColor = Panel2) }
                    }
                }
                if (ready) {
                    Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp).background(Panel, RoundedCornerShape(17.dp)).border(1.dp, Color.White.copy(alpha = .08f), RoundedCornerShape(17.dp)).padding(8.dp), verticalAlignment = Alignment.Bottom) {
                        BasicTextField(
                            value = input, onValueChange = { input = it },
                            modifier = Modifier.weight(1f).padding(horizontal = 9.dp, vertical = 11.dp),
                            textStyle = androidx.compose.ui.text.TextStyle(color = TextMain, fontSize = 14.sp, textDirection = androidx.compose.ui.text.style.TextDirection.ContentOrRtl),
                            cursorBrush = androidx.compose.ui.graphics.SolidColor(Gold),
                            decorationBox = { inner -> Box { if (input.isEmpty()) Text("اكتب رسالتك إلى آفاق...", color = TextMuted, fontSize = 13.sp); inner() } },
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                            keyboardActions = KeyboardActions(onSend = { submit(input, { input = "" }, { error = it }, { messages = messages + it }, { id, text -> messages = messages.map { item -> if (item.id == id) item.copy(text = text) else item } }, scope, onSend, { busy = it }) })
                        )
                        IconButton(onClick = { submit(input, { input = "" }, { error = it }, { messages = messages + it }, { messageId++ }, scope, onSend, { busy = it }) }, enabled = input.isNotBlank() && !busy, modifier = Modifier.size(42.dp).background(Gold, CircleShape)) {
                            Icon(Icons.Default.ArrowUpward, null, tint = Ink)
                        }
                    }
                    if (error.isNotBlank()) Text(error, color = Color(0xFFFF9B91), fontSize = 10.sp, modifier = Modifier.padding(horizontal = 18.dp))
                    Text("قد يخطئ النموذج؛ تحقق من المعلومات المهمة.", color = TextMuted, fontSize = 9.sp, modifier = Modifier.align(Alignment.CenterHorizontally).padding(bottom = 8.dp))
                } else {
                    Text("AFAQ AI  ·  ON-DEVICE INTELLIGENCE", color = TextMuted.copy(alpha = .6f), fontSize = 8.sp, letterSpacing = 1.3.sp, modifier = Modifier.align(Alignment.CenterHorizontally).padding(bottom = 15.dp))
                }
            }
        }
    }

    private fun submit(
        raw: String,
        clearInput: () -> Unit,
        setError: (String) -> Unit,
        append: (ChatMessage) -> Unit,
        updateMessage: (Long, String) -> Unit,
        scope: kotlinx.coroutines.CoroutineScope,
        onSend: suspend (String, (String) -> Unit) -> Unit,
        setBusy: (Boolean) -> Unit
    ) {
        val prompt = raw.trim()
        if (prompt.isEmpty()) return
        clearInput()
        setError("")
        val id = System.currentTimeMillis()
        append(ChatMessage(id, true, prompt))
        append(ChatMessage(id + 1, false, ""))
        setBusy(true)
        scope.launch {
            val response = StringBuilder()
            try {
                onSend(prompt) { chunk ->
                    response.append(chunk)
                    updateMessage(id + 1, response.toString())
                }
            } catch (t: Throwable) {
                setError(t.message ?: "حدث خطأ أثناء التوليد")
                updateMessage(id + 1, "تعذّر إنشاء الإجابة. جرّب مرة أخرى.")
            } finally {
                setBusy(false)
            }
        }
    }
}
