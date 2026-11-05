package com.afaq.ai

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

private val Blue = Color(0xFF397BFF)
private val Green = Color(0xFF25C68A)
private val Ink = Color(0xFF060A12)
private val Panel = Color(0xFF0B1220)
private val Panel2 = Color(0xFF101A2A)
private val TextMain = Color(0xFFEDF3FF)
private val TextMuted = Color(0xFF8795AA)
private val Danger = Color(0xFFEF737B)

private const val PREFS_NAME = "afaq_preferences"
private const val HISTORY_KEY = "chat_history_v2"

data class AfaqMessage(
    val id: String,
    val role: String,
    val text: String,
    val timestamp: Long
)

data class AfaqChat(
    val id: String,
    val title: String,
    val updatedAt: Long,
    val messages: List<AfaqMessage>
)

private fun loadChats(context: Context): List<AfaqChat> {
    return try {
        val raw = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString(HISTORY_KEY, "[]") ?: "[]"
        val array = JSONArray(raw)
        buildList {
            for (i in 0 until array.length()) {
                val item = array.optJSONObject(i) ?: continue
                val messageArray = item.optJSONArray("messages") ?: JSONArray()
                val messages = buildList {
                    for (j in 0 until messageArray.length()) {
                        val message = messageArray.optJSONObject(j) ?: continue
                        add(AfaqMessage(
                            id = message.optString("id", UUID.randomUUID().toString()),
                            role = message.optString("role", "assistant"),
                            text = message.optString("text", ""),
                            timestamp = message.optLong("timestamp", System.currentTimeMillis())
                        ))
                    }
                }
                add(AfaqChat(
                    id = item.optString("id"),
                    title = item.optString("title", "محادثة جديدة"),
                    updatedAt = item.optLong("updatedAt", System.currentTimeMillis()),
                    messages = messages
                ))
            }
        }.sortedByDescending { it.updatedAt }
    } catch (_: Exception) {
        emptyList()
    }
}

private fun saveChats(context: Context, chats: List<AfaqChat>) {
    val array = JSONArray()
    chats.forEach { chat ->
        val messages = JSONArray()
        chat.messages.forEach { message ->
            messages.put(JSONObject()
                .put("id", message.id)
                .put("role", message.role)
                .put("text", message.text)
                .put("timestamp", message.timestamp))
        }
        array.put(JSONObject()
            .put("id", chat.id)
            .put("title", chat.title)
            .put("updatedAt", chat.updatedAt)
            .put("messages", messages))
    }
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .edit().putString(HISTORY_KEY, array.toString()).apply()
}

private fun postChat(messages: List<AfaqMessage>, responseStyle: String): String {
    val endpoint = BuildConfig.AFAQ_API_BASE_URL.trimEnd('/') + "/api/chat"
    val payloadMessages = JSONArray()
    messages.takeLast(20).filter { it.text.isNotBlank() && (it.role == "user" || it.role == "assistant") }.forEach {
        payloadMessages.put(JSONObject().put("role", it.role).put("content", it.text))
    }
    val payload = JSONObject()
        .put("messages", payloadMessages)
        .put("preferences", JSONObject().put("responseStyle", responseStyle))

    val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 15_000
        readTimeout = 35_000
        doOutput = true
        setRequestProperty("Content-Type", "application/json; charset=utf-8")
        setRequestProperty("Accept", "application/json")
    }
    return try {
        connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
        val code = connection.responseCode
        val stream = if (code in 200..299) connection.inputStream else connection.errorStream
        val responseText = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
        val response = try { JSONObject(responseText) } catch (_: Exception) { JSONObject() }
        if (code !in 200..299) {
            throw IllegalStateException(response.optString("error").ifBlank { if (code == 401 || code == 403) "خادم آفاق محمي حالياً. يجب إتاحة عنوان الخدمة أولاً." else "تعذّر الاتصال بآفاق (HTTP $code)." })
        }
        response.optString("answer").takeIf { it.isNotBlank() }
            ?: throw IllegalStateException("لم تصل إجابة صالحة من آفاق.")
    } finally {
        connection.disconnect()
    }
}

private fun chatTitle(text: String): String {
    val clean = text.replace("\\s+".toRegex(), " ").trim()
    return if (clean.length > 36) clean.take(36) + "…" else clean.ifBlank { "محادثة جديدة" }
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { AfaqApp() }
    }

    @Composable
    private fun AfaqApp() {
        val context = LocalContext.current
        val preferences = remember { context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE) }
        val scope = rememberCoroutineScope()

        var chats by remember { mutableStateOf(loadChats(context)) }
        var activeChatId by remember { mutableStateOf<String?>(null) }
        var input by remember { mutableStateOf("") }
        var search by remember { mutableStateOf("") }
        var busy by remember { mutableStateOf(false) }
        var error by remember { mutableStateOf("") }
        var drawerOpen by remember { mutableStateOf(false) }
        var settingsOpen by remember { mutableStateOf(false) }
        var theme by remember { mutableStateOf(preferences.getString("theme", "blue") ?: "blue") }
        var responseStyle by remember { mutableStateOf(preferences.getString("responseStyle", "balanced") ?: "balanced") }
        var enterToSend by remember { mutableStateOf(preferences.getBoolean("enterToSend", true)) }
        var selectedTab by remember { mutableStateOf("chats") }
        var renameTarget by remember { mutableStateOf<AfaqChat?>(null) }
        var renameValue by remember { mutableStateOf("") }
        var deleteTarget by remember { mutableStateOf<AfaqChat?>(null) }
        var confirmClear by remember { mutableStateOf(false) }

        LaunchedEffect(chats) { saveChats(context, chats) }
        LaunchedEffect(theme, responseStyle, enterToSend) {
            preferences.edit()
                .putString("theme", theme)
                .putString("responseStyle", responseStyle)
                .putBoolean("enterToSend", enterToSend)
                .apply()
        }

        val isLight = theme == "light"
        val background = if (isLight) Color(0xFFF0F4FA) else Ink
        val surface = if (isLight) Color.White else Panel
        val surface2 = if (isLight) Color(0xFFF5F8FC) else Panel2
        val primary = if (theme == "green") Green else Blue
        val accent = if (theme == "green") Blue else Green
        val foreground = if (isLight) Color(0xFF17243A) else TextMain
        val muted = if (isLight) Color(0xFF65758E) else TextMuted
        val currentChat = chats.firstOrNull { it.id == activeChatId }
        val filteredChats = chats.filter { it.title.contains(search, ignoreCase = true) }
        val drawerState = rememberDrawerState(DrawerValue.Closed)
        LaunchedEffect(drawerOpen) { if (drawerOpen) drawerState.open() else drawerState.close() }
        LaunchedEffect(drawerState.currentValue) { drawerOpen = drawerState.currentValue == DrawerValue.Open }

        fun updateChat(id: String, transform: (AfaqChat) -> AfaqChat) {
            chats = chats.map { if (it.id == id) transform(it) else it }.sortedByDescending { it.updatedAt }
        }

        fun startNewChat() {
            activeChatId = null
            selectedTab = "chats"
            input = ""
            error = ""
            drawerOpen = false
        }

        fun submit() {
            val prompt = input.trim()
            if (prompt.isEmpty() || busy) return
            val now = System.currentTimeMillis()
            val chatId = activeChatId ?: UUID.randomUUID().toString()
            val existing = chats.firstOrNull { it.id == chatId }
            val userMessage = AfaqMessage(UUID.randomUUID().toString(), "user", prompt, now)
            val assistantMessage = AfaqMessage(UUID.randomUUID().toString(), "assistant", "", now + 1)
            val pending = if (existing == null) {
                AfaqChat(chatId, chatTitle(prompt), now, listOf(userMessage, assistantMessage))
            } else {
                existing.copy(updatedAt = now, messages = existing.messages + listOf(userMessage, assistantMessage))
            }
            chats = (listOf(pending) + chats.filterNot { it.id == chatId }).sortedByDescending { it.updatedAt }
            activeChatId = chatId
            selectedTab = "chats"
            input = ""
            error = ""
            busy = true
            scope.launch {
                try {
                    val answer = withContext(Dispatchers.IO) { postChat(pending.messages, responseStyle) }
                    updateChat(chatId) { chat ->
                        chat.copy(
                            updatedAt = System.currentTimeMillis(),
                            messages = chat.messages.map { if (it.id == assistantMessage.id) it.copy(text = answer) else it }
                        )
                    }
                } catch (exception: Exception) {
                    updateChat(chatId) { chat -> chat.copy(messages = chat.messages.filterNot { it.id == assistantMessage.id }) }
                    error = exception.message ?: "حدث خطأ أثناء الاتصال بآفاق."
                } finally {
                    busy = false
                }
            }
        }

        ModalNavigationDrawer(
            drawerState = drawerState,
            drawerContent = {
                ModalDrawerSheet(drawerContainerColor = surface, drawerContentColor = foreground) {
                    Row(Modifier.fillMaxWidth().padding(17.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(38.dp).background(Brush.linearGradient(listOf(primary, Color(0xFF173E83))), RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
                            Icon(Icons.Default.AutoAwesome, null, tint = Color.White)
                        }
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text("AFAQ AI", color = foreground, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                            Text("THINK BEYOND. BUILD BEYOND.", color = muted, fontSize = 8.sp, letterSpacing = 0.6.sp)
                        }
                        IconButton(onClick = { drawerOpen = false }) { Icon(Icons.Default.Close, null, tint = muted) }
                    }
                    NavigationDrawerItem(
                        label = { Text("محادثة جديدة", fontSize = 12.sp) },
                        selected = false,
                        onClick = { startNewChat() },
                        icon = { Icon(Icons.Default.AddComment, null) },
                        modifier = Modifier.padding(horizontal = 12.dp),
                        colors = NavigationDrawerItemDefaults.colors(unselectedIconColor = primary, unselectedTextColor = foreground)
                    )
                    NavigationDrawerItem(
                        label = { Text("الأدوات والمساعدات", fontSize = 12.sp) },
                        selected = selectedTab == "tools",
                        onClick = { selectedTab = "tools"; drawerOpen = false },
                        icon = { Icon(Icons.Default.AutoAwesome, null) },
                        modifier = Modifier.padding(horizontal = 12.dp),
                        colors = NavigationDrawerItemDefaults.colors(selectedContainerColor = primary.copy(alpha = .12f), selectedIconColor = primary, selectedTextColor = foreground, unselectedIconColor = muted, unselectedTextColor = foreground)
                    )
                    HorizontalDivider(Modifier.padding(vertical = 12.dp), color = muted.copy(alpha = .18f))
                    Text("سجل المحادثات  ·  ${chats.size}", color = muted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(horizontal = 20.dp, vertical = 5.dp))
                    OutlinedTextField(
                        value = search, onValueChange = { search = it },
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 8.dp),
                        placeholder = { Text("ابحث في محادثاتك", fontSize = 11.sp) },
                        leadingIcon = { Icon(Icons.Default.Search, null) },
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = primary, unfocusedBorderColor = muted.copy(alpha = .25f),
                            focusedTextColor = foreground, unfocusedTextColor = foreground,
                            focusedContainerColor = surface2, unfocusedContainerColor = surface2
                        )
                    )
                    LazyColumn(Modifier.weight(1f).fillMaxWidth(), contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)) {
                        items(filteredChats, key = { it.id }) { chat ->
                            var menuOpen by remember(chat.id) { mutableStateOf(false) }
                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
                                NavigationDrawerItem(
                                    label = { Text(chat.title, maxLines = 1, fontSize = 10.sp) },
                                    selected = activeChatId == chat.id && selectedTab == "chats",
                                    onClick = { activeChatId = chat.id; selectedTab = "chats"; drawerOpen = false; error = "" },
                                    icon = { Icon(Icons.Default.ChatBubbleOutline, null, modifier = Modifier.size(16.dp)) },
                                    modifier = Modifier.weight(1f),
                                    colors = NavigationDrawerItemDefaults.colors(
                                        selectedContainerColor = primary.copy(alpha = .12f),
                                        selectedIconColor = primary, selectedTextColor = foreground,
                                        unselectedIconColor = muted, unselectedTextColor = foreground
                                    )
                                )
                                Box {
                                    IconButton(onClick = { menuOpen = true }) { Icon(Icons.Default.MoreVert, null, tint = muted) }
                                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }, modifier = Modifier.background(surface)) {
                                        DropdownMenuItem(text = { Text("إعادة تسمية", fontSize = 12.sp) }, onClick = {
                                            renameTarget = chat; renameValue = chat.title; menuOpen = false
                                        }, leadingIcon = { Icon(Icons.Default.Edit, null) })
                                        DropdownMenuItem(text = { Text("حذف", fontSize = 12.sp, color = Danger) }, onClick = {
                                            deleteTarget = chat; menuOpen = false
                                        }, leadingIcon = { Icon(Icons.Default.Delete, null, tint = Danger) })
                                    }
                                }
                            }
                        }
                    }
                    HorizontalDivider(color = muted.copy(alpha = .18f))
                    NavigationDrawerItem(
                        label = { Text("تصدير سجل المحادثات", fontSize = 12.sp) },
                        selected = false,
                        onClick = {
                            drawerOpen = false
                            val exportText = chats.joinToString("\n\n====================\n\n") { chat ->
                                "# ${chat.title}\n\n" + chat.messages.joinToString("\n\n") { message ->
                                    (if (message.role == "user") "أنت" else "آفاق") + "\n" + message.text
                                }
                            }
                            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_SUBJECT, "سجل محادثات آفاق")
                                putExtra(Intent.EXTRA_TEXT, exportText)
                            }
                            context.startActivity(Intent.createChooser(shareIntent, "تصدير سجل آفاق"))
                        },
                        icon = { Icon(Icons.Default.FileDownload, null) },
                        modifier = Modifier.padding(horizontal = 12.dp),
                        colors = NavigationDrawerItemDefaults.colors(unselectedIconColor = primary, unselectedTextColor = foreground)
                    )
                    NavigationDrawerItem(
                        label = { Text("الإعدادات", fontSize = 12.sp) },
                        selected = false,
                        onClick = { settingsOpen = true; drawerOpen = false },
                        icon = { Icon(Icons.Default.Settings, null) },
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 5.dp),
                        colors = NavigationDrawerItemDefaults.colors(unselectedIconColor = primary, unselectedTextColor = foreground)
                    )
                    Text("AFAQ AI · VERSION 0.4.0", color = muted.copy(alpha = .75f), fontSize = 9.sp, modifier = Modifier.align(Alignment.CenterHorizontally).padding(12.dp))
                }
            },
            gesturesEnabled = true
        ) {
            MaterialTheme(colorScheme = if (isLight) lightColorScheme(primary = primary, secondary = accent, background = background, surface = surface, onBackground = foreground, onSurface = foreground) else darkColorScheme(primary = primary, secondary = accent, background = background, surface = surface, onPrimary = Color.White, onBackground = foreground, onSurface = foreground)) {
                Column(Modifier.fillMaxSize().background(background)) {
                    Row(
                        Modifier.fillMaxWidth().background(surface).padding(horizontal = 11.dp, vertical = 9.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = { drawerOpen = true }) { Icon(Icons.Default.Menu, "القائمة", tint = foreground) }
                        Column(Modifier.weight(1f)) {
                            Text("AFAQ AI", color = foreground, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                            Text(if (selectedTab == "tools") "الأدوات والمساعدات" else currentChat?.title ?: "THINK BEYOND. BUILD BEYOND.", color = muted, fontSize = 8.sp, maxLines = 1)
                        }
                        Surface(color = accent.copy(alpha = .12f), shape = CircleShape) {
                            Row(Modifier.padding(horizontal = 9.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                                Box(Modifier.size(6.dp).background(accent, CircleShape))
                                Spacer(Modifier.width(6.dp))
                                Text("AI", color = accent, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                        IconButton(onClick = { settingsOpen = true }) { Icon(Icons.Default.Settings, "الإعدادات", tint = muted) }
                        IconButton(onClick = { startNewChat() }) { Icon(Icons.Default.AddComment, "محادثة جديدة", tint = primary) }
                    }
                    HorizontalDivider(color = muted.copy(alpha = .13f))

                    when {
                        selectedTab == "tools" -> {
                            val templates = listOf(
                                Triple(Icons.Default.Code, "مساعد البرمجة", "اكتب لي كوداً قابلاً للتشغيل وساعدني على تصحيح الأخطاء."),
                                Triple(Icons.Default.School, "التعلّم والدراسة", "اشرح لي هذا الموضوع من الأساس مع أمثلة ثم اختبر فهمي."),
                                Triple(Icons.Default.Description, "الكتابة والتحرير", "ساعدني في صياغة النص التالي بلغة واضحة ومنظمة:"),
                                Triple(Icons.Default.Lightbulb, "تطوير الأفكار", "حوّل فكرتي إلى مشروع عملي بخطوات ومتطلبات واضحة:")
                            )
                            LazyColumn(Modifier.weight(1f).fillMaxWidth(), contentPadding = PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(11.dp)) {
                                item {
                                    Text("اختر مساعدك", color = foreground, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                                    Text("ابدأ من قالب جاهز ثم عدّل طلبك قبل الإرسال.", color = muted, fontSize = 11.sp, modifier = Modifier.padding(top = 6.dp, bottom = 8.dp))
                                }
                                items(templates) { item ->
                                    Card(
                                        modifier = Modifier.fillMaxWidth().clickable {
                                            input = item.third
                                            selectedTab = "chats"
                                            activeChatId = null
                                        },
                                        colors = CardDefaults.cardColors(containerColor = surface),
                                        shape = RoundedCornerShape(15.dp)
                                    ) {
                                        Row(Modifier.fillMaxWidth().padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
                                            Box(Modifier.size(42.dp).background(primary.copy(alpha = .12f), RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
                                                Icon(item.first, null, tint = primary)
                                            }
                                            Spacer(Modifier.width(12.dp))
                                            Column(Modifier.weight(1f)) {
                                                Text(item.second, color = foreground, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                                Text(item.third, color = muted, fontSize = 10.sp, maxLines = 2, lineHeight = 16.sp)
                                            }
                                            Icon(Icons.Default.ArrowBack, null, tint = muted, modifier = Modifier.size(16.dp))
                                        }
                                    }
                                }
                            }
                        }
                        currentChat == null -> {
                            Column(Modifier.weight(1f).fillMaxWidth().padding(horizontal = 22.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                                Box(Modifier.size(86.dp).background(Brush.linearGradient(listOf(primary, Color(0xFF122746))), RoundedCornerShape(25.dp)).border(1.dp, primary.copy(alpha = .4f), RoundedCornerShape(25.dp)), contentAlignment = Alignment.Center) {
                                    Icon(Icons.Default.AutoAwesome, null, tint = Color.White, modifier = Modifier.size(36.dp))
                                }
                                Spacer(Modifier.height(22.dp))
                                Text("أهلاً بك في آفاق", color = foreground, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                                Text("اسأل، تعلّم، برمج، وحوّل أفكارك إلى مشاريع.", color = muted, fontSize = 12.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp))
                                Spacer(Modifier.height(22.dp))
                                val ideas = listOf("مساعد البرمجة" to "ساعدني في بناء تطبيق خطوة بخطوة.", "الشرح والتعلّم" to "اشرح لي مفهوماً صعباً بطريقة سهلة.", "تطوير الأفكار" to "ساعدني في تحويل فكرة إلى مشروع.")
                                ideas.forEach { (title, prompt) ->
                                    OutlinedButton(onClick = { input = prompt }, modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp), shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.outlinedButtonColors(contentColor = foreground), border = BorderStroke(1.dp, primary.copy(alpha = .4f))) {
                                        Icon(Icons.Default.AutoAwesome, null, tint = primary, modifier = Modifier.size(16.dp))
                                        Spacer(Modifier.width(8.dp))
                                        Text(title, fontSize = 11.sp)
                                        Spacer(Modifier.weight(1f))
                                        Icon(Icons.Default.ArrowBack, null, tint = muted, modifier = Modifier.size(14.dp))
                                    }
                                }
                                Text("لا تحتاج إلى إدخال مفاتيح أو تنزيل نماذج.", color = accent, fontSize = 9.sp, modifier = Modifier.padding(top = 16.dp))
                            }
                        }
                        else -> {
                            LazyColumn(
                                modifier = Modifier.weight(1f).fillMaxWidth().padding(horizontal = 13.dp),
                                contentPadding = PaddingValues(vertical = 16.dp),
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                items(currentChat.messages, key = { it.id }) { message ->
                                    val isUser = message.role == "user"
                                    Column(Modifier.fillMaxWidth(), horizontalAlignment = if (isUser) Alignment.Start else Alignment.End) {
                                        Text(if (isUser) "أنت" else "آفاق AI", color = if (isUser) accent else primary, fontSize = 9.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp))
                                        Surface(
                                            color = if (isUser) surface2 else surface,
                                            shape = RoundedCornerShape(15.dp),
                                            modifier = Modifier.fillMaxWidth(.94f)
                                        ) {
                                            SelectionContainer {
                                                Text(
                                                    message.text.ifBlank { if (busy && !isUser) "آفاق يفكر..." else "" },
                                                    color = foreground,
                                                    fontSize = 13.sp,
                                                    lineHeight = 21.sp,
                                                    modifier = Modifier.padding(13.dp)
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    Column(Modifier.fillMaxWidth().background(background).padding(horizontal = 11.dp, vertical = 8.dp)) {
                        if (error.isNotBlank()) Text(error, color = Danger, fontSize = 10.sp, modifier = Modifier.padding(start = 5.dp, bottom = 7.dp))
                        Row(
                            Modifier.fillMaxWidth().background(surface, RoundedCornerShape(16.dp)).border(1.dp, primary.copy(alpha = .33f), RoundedCornerShape(16.dp)).padding(start = 12.dp, end = 7.dp, top = 7.dp, bottom = 7.dp),
                            verticalAlignment = Alignment.Bottom
                        ) {
                            BasicTextField(
                                value = input,
                                onValueChange = { input = it },
                                modifier = Modifier.weight(1f).padding(horizontal = 5.dp, vertical = 10.dp),
                                textStyle = androidx.compose.ui.text.TextStyle(color = foreground, fontSize = 14.sp, textDirection = TextDirection.ContentOrRtl),
                                cursorBrush = androidx.compose.ui.graphics.SolidColor(primary),
                                decorationBox = { inner ->
                                    Box {
                                        if (input.isEmpty()) Text("اكتب سؤالك إلى آفاق...", color = muted, fontSize = 12.sp)
                                        inner()
                                    }
                                },
                                keyboardOptions = KeyboardOptions(imeAction = if (enterToSend) ImeAction.Send else ImeAction.Default),
                                keyboardActions = KeyboardActions(onSend = { submit() })
                            )
                            IconButton(
                                onClick = { submit() },
                                enabled = input.isNotBlank() && !busy,
                                modifier = Modifier.size(42.dp).background(primary, CircleShape)
                            ) {
                                if (busy) CircularProgressIndicator(modifier = Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
                                else Icon(Icons.Default.ArrowUpward, null, tint = Color.White)
                            }
                        }
                        Text("قد يخطئ الذكاء الاصطناعي؛ راجع المعلومات المهمة.", color = muted.copy(alpha = .8f), fontSize = 8.sp, modifier = Modifier.align(Alignment.CenterHorizontally).padding(top = 7.dp, bottom = 2.dp))
                    }
                }
            }
        }

        if (settingsOpen) {
            AlertDialog(
                onDismissRequest = { settingsOpen = false },
                containerColor = surface,
                title = { Text("إعدادات آفاق", color = foreground, fontWeight = FontWeight.Bold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(13.dp)) {
                        Text("المظهر والألوان", color = primary, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                        Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                            listOf("blue" to "أزرق", "green" to "أخضر", "light" to "فاتح").forEach { (value, label) ->
                                FilterChip(selected = theme == value, onClick = { theme = value }, label = { Text(label, fontSize = 10.sp) })
                            }
                        }
                        HorizontalDivider(color = muted.copy(alpha = .15f))
                        Text("أسلوب الإجابة", color = primary, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                        Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                            listOf("concise" to "مختصر", "balanced" to "متوازن", "detailed" to "مفصل").forEach { (value, label) ->
                                FilterChip(selected = responseStyle == value, onClick = { responseStyle = value }, label = { Text(label, fontSize = 10.sp) })
                            }
                        }
                        HorizontalDivider(color = muted.copy(alpha = .15f))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text("الإرسال بزر Enter", color = foreground, fontSize = 11.sp)
                                Text("إيقافه يسمح بكتابة أسطر جديدة.", color = muted, fontSize = 9.sp)
                            }
                            Switch(checked = enterToSend, onCheckedChange = { enterToSend = it })
                        }
                        HorizontalDivider(color = muted.copy(alpha = .15f))
                        Text("الخدمة والنموذج", color = primary, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                        Text("آفاق يتصل بخادم مركزي ويتولى اختيار النموذج. لا تدخل أي مفتاح API داخل التطبيق.", color = muted, fontSize = 10.sp, lineHeight = 17.sp)
                        Text("سجل المحادثات محفوظ على هذا الجهاز. عند إرسال رسالة تُرسل إلى مزوّد النموذج، وقد يحتفظ بها وفق شروطه؛ لا ترسل معلومات حساسة.", color = accent, fontSize = 10.sp, lineHeight = 16.sp)
                        TextButton(onClick = { confirmClear = true }) {
                            Icon(Icons.Default.DeleteSweep, null, tint = Danger, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(7.dp))
                            Text("حذف جميع المحادثات", color = Danger, fontSize = 11.sp)
                        }
                    }
                },
                confirmButton = { TextButton(onClick = { settingsOpen = false }) { Text("حفظ", color = primary) } },
                dismissButton = { TextButton(onClick = { settingsOpen = false }) { Text("إغلاق", color = muted) } }
            )
        }

        renameTarget?.let { target ->
            AlertDialog(
                onDismissRequest = { renameTarget = null },
                containerColor = surface,
                title = { Text("إعادة تسمية المحادثة", color = foreground) },
                text = {
                    OutlinedTextField(value = renameValue, onValueChange = { renameValue = it }, singleLine = true, label = { Text("اسم المحادثة") })
                },
                confirmButton = {
                    TextButton(onClick = {
                        if (renameValue.isNotBlank()) updateChat(target.id) { it.copy(title = renameValue.trim().take(70)) }
                        renameTarget = null
                    }) { Text("حفظ", color = primary) }
                },
                dismissButton = { TextButton(onClick = { renameTarget = null }) { Text("إلغاء", color = muted) } }
            )
        }

        deleteTarget?.let { target ->
            AlertDialog(
                onDismissRequest = { deleteTarget = null },
                containerColor = surface,
                title = { Text("حذف المحادثة؟", color = foreground) },
                text = { Text("سيتم حذف «${target.title}» من هذا الجهاز.", color = muted, fontSize = 12.sp) },
                confirmButton = {
                    TextButton(onClick = {
                        chats = chats.filterNot { it.id == target.id }
                        if (activeChatId == target.id) activeChatId = null
                        deleteTarget = null
                    }) { Text("حذف", color = Danger) }
                },
                dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("إلغاء", color = muted) } }
            )
        }

        if (confirmClear) {
            AlertDialog(
                onDismissRequest = { confirmClear = false },
                containerColor = surface,
                title = { Text("حذف سجل المحادثات؟", color = foreground) },
                text = { Text("سيتم حذف جميع المحادثات المحفوظة على هذا الجهاز.", color = muted, fontSize = 12.sp) },
                confirmButton = {
                    TextButton(onClick = { chats = emptyList(); activeChatId = null; confirmClear = false; settingsOpen = false }) {
                        Text("حذف الكل", color = Danger)
                    }
                },
                dismissButton = { TextButton(onClick = { confirmClear = false }) { Text("إلغاء", color = muted) } }
            )
        }
    }
}
