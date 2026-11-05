package com.afaq.ai

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.style.TextAlign
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

private val Ink = Color(0xFF071711)
private val Panel = Color(0xFF10251C)
private val Panel2 = Color(0xFF163126)
private val Gold = Color(0xFFD8B879)
private val Mint = Color(0xFF9CC9AA)
private val TextMain = Color(0xFFEAF1E9)
private val TextMuted = Color(0xFF91A99A)

data class ChatMessage(val id: Long, val user: Boolean, val text: String)

class MainActivity : ComponentActivity() {
    private fun securePrefs() = EncryptedSharedPreferences.create(
        this, "afaq_secure_settings",
        MasterKey.Builder(this).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { AfaqApp() }
    }

    private suspend fun askCloud(prompt: String, history: List<ChatMessage>): String = withContext(Dispatchers.IO) {
        val prefs = securePrefs()
        val endpoint = prefs.getString("endpoint", "https://api.openai.com/v1/chat/completions")!!.trim()
        val model = prefs.getString("model", "gpt-4o-mini")!!.trim()
        val key = prefs.getString("api_key", "")!!.trim()
        check(key.isNotBlank()) { "أضف مفتاح API من الإعدادات أولاً." }
        check(endpoint.startsWith("https://")) { "عنوان الخدمة يجب أن يبدأ بـ https://" }
        check(model.isNotBlank()) { "اكتب اسم النموذج." }

        val messages = JSONArray()
        messages.put(JSONObject().put("role", "system").put("content", "أنت آفاق، مساعد ذكي مفيد ودقيق. أجب بلغة المستخدم، وفضّل العربية عند الكتابة بالعربية. لا تختلق المعلومات."))
        history.takeLast(16).forEach { m ->
            messages.put(JSONObject().put("role", if (m.user) "user" else "assistant").put("content", m.text))
        }
        messages.put(JSONObject().put("role", "user").put("content", prompt))
        val body = JSONObject().put("model", model).put("messages", messages).put("temperature", 0.7)
        val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 20000
            readTimeout = 90000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Authorization", "Bearer $key")
        }
        try {
            conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val raw = stream.bufferedReader().use { it.readText() }
            if (code !in 200..299) {
                val detail = try { JSONObject(raw).optJSONObject("error")?.optString("message") } catch (_: Exception) { null }
                error(detail?.takeIf { it.isNotBlank() } ?: "فشل الاتصال بالخدمة (HTTP $code)")
            }
            val answer = JSONObject(raw).optJSONArray("choices")?.optJSONObject(0)
                ?.optJSONObject("message")?.optString("content")
            check(!answer.isNullOrBlank()) { "الخدمة لم تُرجع إجابة نصية." }
            answer!!
        } finally { conn.disconnect() }
    }

    @Composable
    private fun AfaqApp() {
        val prefs = remember { securePrefs() }
        val scope = rememberCoroutineScope()
        var key by remember { mutableStateOf(prefs.getString("api_key", "") ?: "") }
        var endpoint by remember { mutableStateOf(prefs.getString("endpoint", "https://api.openai.com/v1/chat/completions") ?: "") }
        var model by remember { mutableStateOf(prefs.getString("model", "gpt-4o-mini") ?: "") }
        var settingsOpen by remember { mutableStateOf(key.isBlank()) }
        var input by remember { mutableStateOf("") }
        var busy by remember { mutableStateOf(false) }
        var error by remember { mutableStateOf("") }
        var messages by remember { mutableStateOf(listOf<ChatMessage>()) }
        var configured by remember { mutableStateOf(key.isNotBlank()) }

        MaterialTheme(colorScheme = darkColorScheme(primary = Gold, secondary = Mint, background = Ink, surface = Panel, onPrimary = Ink, onBackground = TextMain, onSurface = TextMain)) {
            Column(Modifier.fillMaxSize().background(Ink)) {
                Row(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 15.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(42.dp).background(Brush.linearGradient(listOf(Gold, Color(0xFF8B7046))), RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.AutoAwesome, null, tint = Ink, modifier = Modifier.size(23.dp))
                    }
                    Spacer(Modifier.width(11.dp))
                    Column(Modifier.weight(1f)) {
                        Text("AFAQ AI", color = TextMain, fontWeight = FontWeight.Bold, fontSize = 18.sp, letterSpacing = 1.sp)
                        Text("آفاق · مساعدك الذكي", color = TextMuted, fontSize = 10.sp)
                    }
                    Surface(color = if (configured) Color(0xFF1C4934) else Panel2, shape = CircleShape) {
                        Text(if (configured) "سحابي" else "إعداد أولي", color = if (configured) Mint else Gold, fontSize = 10.sp, modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp))
                    }
                    IconButton(onClick = { settingsOpen = true }) { Icon(Icons.Default.Settings, "الإعدادات", tint = TextMuted) }
                    IconButton(onClick = { messages = emptyList(); error = "" }) { Icon(Icons.Default.AddComment, "محادثة جديدة", tint = Gold) }
                }
                HorizontalDivider(color = Color.White.copy(alpha = .07f))
                if (messages.isEmpty()) {
                    Column(Modifier.weight(1f).fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                        Box(Modifier.size(88.dp).background(Brush.radialGradient(listOf(Color(0xFF345541), Panel)), CircleShape), contentAlignment = Alignment.Center) {
                            Icon(Icons.Default.AutoAwesome, null, tint = Gold, modifier = Modifier.size(36.dp))
                        }
                        Spacer(Modifier.height(22.dp))
                        Text("مرحباً بك في آفاق", color = TextMain, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(8.dp))
                        Text("ذكاء اصطناعي سحابي متعدد النماذج", color = TextMuted, fontSize = 13.sp)
                        Spacer(Modifier.height(22.dp))
                        Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(18.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.Cloud, null, tint = Gold)
                                    Spacer(Modifier.width(9.dp))
                                    Column {
                                        Text("بدون تنزيل نموذج ضخم", color = TextMain, fontWeight = FontWeight.SemiBold)
                                        Text("التطبيق لا يحمل ملفات ذكاء اصطناعي محلية", color = TextMuted, fontSize = 10.sp)
                                    }
                                }
                                Spacer(Modifier.height(12.dp))
                                Text(if (configured) "الإعدادات محفوظة. اكتب رسالتك وابدأ." else "حتى تبدأ، أضف مفتاح API من الإعدادات.", color = TextMuted, fontSize = 12.sp)
                                if (!configured) {
                                    Spacer(Modifier.height(12.dp))
                                    Button(onClick = { settingsOpen = true }, colors = ButtonDefaults.buttonColors(containerColor = Gold, contentColor = Ink)) { Text("إعداد الاتصال السحابي") }
                                }
                            }
                        }
                    }
                } else {
                    LazyColumn(Modifier.weight(1f).fillMaxWidth().padding(horizontal = 14.dp), contentPadding = PaddingValues(vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        items(messages, key = { it.id }) { msg ->
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = if (msg.user) Arrangement.Start else Arrangement.End) {
                                Surface(color = if (msg.user) Panel2 else Panel, shape = RoundedCornerShape(17.dp), modifier = Modifier.fillMaxWidth(.92f)) {
                                    Column(Modifier.padding(13.dp)) {
                                        Text(if (msg.user) "أنت" else "آفاق", color = Gold, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                        Spacer(Modifier.height(5.dp))
                                        Text(msg.text, color = TextMain, fontSize = 13.sp, lineHeight = 21.sp)
                                    }
                                }
                            }
                        }
                        if (busy) item { LinearProgressIndicator(Modifier.fillMaxWidth(.4f), color = Gold, trackColor = Panel2) }
                    }
                }
                Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp).background(Panel, RoundedCornerShape(17.dp)).padding(8.dp), verticalAlignment = Alignment.Bottom) {
                    BasicTextField(
                        value = input, onValueChange = { input = it }, modifier = Modifier.weight(1f).padding(horizontal = 9.dp, vertical = 11.dp),
                        textStyle = androidx.compose.ui.text.TextStyle(color = TextMain, fontSize = 14.sp),
                        decorationBox = { inner -> Box { if (input.isEmpty()) Text("اكتب رسالتك إلى آفاق...", color = TextMuted, fontSize = 13.sp); inner() } }
                    )
                    IconButton(onClick = {
                        val prompt = input.trim()
                        if (prompt.isNotEmpty() && !busy) {
                            input = ""; error = ""
                            val previous = messages
                            messages = previous + ChatMessage(System.currentTimeMillis(), true, prompt)
                            busy = true
                            scope.launch {
                                try {
                                    val answer = askCloud(prompt, previous)
                                    messages = messages + ChatMessage(System.currentTimeMillis() + 1, false, answer)
                                } catch (t: Throwable) { error = t.message ?: "حدث خطأ بالاتصال." }
                                finally { busy = false }
                            }
                        }
                    }, enabled = input.isNotBlank() && !busy && configured, modifier = Modifier.size(42.dp).background(Gold, CircleShape)) {
                        Icon(Icons.Default.ArrowUpward, null, tint = Ink)
                    }
                }
                if (error.isNotBlank()) Text(error, color = Color(0xFFFF9B91), fontSize = 10.sp, modifier = Modifier.padding(horizontal = 18.dp, vertical = 4.dp))
                Text("تحقق من المعلومات المهمة · اتصالك يمر عبر مزود النموذج", color = TextMuted, fontSize = 9.sp, modifier = Modifier.align(Alignment.CenterHorizontally).padding(bottom = 8.dp))
            }
        }

        if (settingsOpen) {
            AlertDialog(
                onDismissRequest = { settingsOpen = false }, containerColor = Panel,
                title = { Text("إعدادات الاتصال", color = TextMain, fontWeight = FontWeight.Bold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                        Text("عنوان API المتوافق مع OpenAI", color = Gold, fontSize = 11.sp)
                        OutlinedTextField(endpoint, { endpoint = it }, singleLine = true, placeholder = { Text("https://.../v1/chat/completions") })
                        Text("اسم النموذج", color = Gold, fontSize = 11.sp)
                        OutlinedTextField(model, { model = it }, singleLine = true, placeholder = { Text("اسم النموذج لدى مزودك") })
                        Text("مفتاح API", color = Gold, fontSize = 11.sp)
                        OutlinedTextField(key, { key = it }, singleLine = true, visualTransformation = PasswordVisualTransformation(), placeholder = { Text("ألصق المفتاح هنا") })
                        Text("يُحفظ المفتاح مشفّراً على جهازك. استخدام API قد يترتب عليه رسوم من المزود. لا تشارك مفتاحك مع أحد.", color = TextMuted, fontSize = 10.sp, lineHeight = 16.sp)
                    }
                },
                confirmButton = {
                    TextButton(onClick = {
                        if (endpoint.startsWith("https://") && model.isNotBlank() && key.isNotBlank()) {
                            prefs.edit().putString("endpoint", endpoint.trim()).putString("model", model.trim()).putString("api_key", key.trim()).apply()
                            configured = true
                            settingsOpen = false
                        } else { error = "أكمل العنوان واسم النموذج ومفتاح API صحيحاً." }
                    }) { Text("حفظ", color = Gold) }
                },
                dismissButton = { TextButton(onClick = { settingsOpen = false }) { Text("إلغاء", color = TextMuted) } }
            )
        }
    }
}
