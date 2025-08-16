 // ====== CONFIG ======
    const API_BASE = "https://fitnessgpt-fdw9.onrender.com"; // change if needed



    // Sidebar mode switching
    const modes = {
      chat:     { btn: null, view: document.getElementById("chat-view"),   title:"Chat" },
      meal:     { btn: null, view: document.getElementById("meal-view"),   title:"Meal Analyzer" },
      physique: { btn: null, view: document.getElementById("physique-view"), title:"Physique Analyzer" },
      profile: { btn: null, view: document.getElementById("profile-view"), title:"Your Profile" }
    };
    document.querySelectorAll(".mode-btn").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const mode = btn.dataset.mode;
        switchMode(mode);
      });
      modes[btn.dataset.mode].btn = btn;
    });
    function switchMode(mode){
      for (const k in modes){
        modes[k].view.classList.toggle("active", k===mode);
        modes[k].btn.classList.toggle("active", k===mode);
      }
      document.getElementById("title").textContent = modes[mode].title;
    }

    // ====== CHAT ======
    const chatbox = document.getElementById("chatbox");
    const input = document.getElementById("input");
    const sendBtn = document.getElementById("send");
    const typing = document.getElementById("typing-indicator");

    input.addEventListener("keydown", (e)=>{
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    sendBtn.addEventListener("click", sendMessage);

    function addMessage(sender, html, cls){
      const div = document.createElement("div");
      div.className = `msg ${cls}`;
      div.innerHTML = `<strong>${sender}</strong><br>${html}`;
      chatbox.appendChild(div);
      chatbox.scrollTop = chatbox.scrollHeight;
    }

    function chatgptOutputToHtml(text) {
      let html = text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_,lang,code)=>`<pre><code>${code.trim()}</code></pre>`);
      html = html.replace(/`([^`\n]+?)`/g,'<code>$1</code>');
      html = html.replace(/\*\*\*(.*?)\*\*\*/g,'<strong><em>$1</em></strong>').replace(/___(.*?)___/g,'<strong><em>$1</em></strong>');
      html = html.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/__(.*?)__/g,'<strong>$1</strong>');
      html = html.replace(/\*(.*?)\*/g,'<em>$1</em>').replace(/_(.*?)_/g,'<em>$1</em>');
      html = html.replace(/\n/g,'<br>');
      return html;
    }

    function typeMessage(sender, text, cls) {
  const div = document.createElement("div");
  div.className = `msg ${cls}`;
  div.innerHTML = `<strong>${sender}</strong><br>`;
  const span = document.createElement("span");
  div.appendChild(span);
  chatbox.appendChild(div);
  chatbox.scrollTop = chatbox.scrollHeight;

  let i = 0;
  const interval = setInterval(() => {
    const ch = text.charAt(i++);
    if (ch === "\n") {
      // Insert a visible <br> element instead of a text newline
      span.appendChild(document.createElement("br"));
    } else {
      span.appendChild(document.createTextNode(ch));
    }
    chatbox.scrollTop = chatbox.scrollHeight;

    if (i >= text.length) {
      clearInterval(interval);
      // Optionally replace text with parsed HTML from ChatGPT
      span.innerHTML = chatgptOutputToHtml(text);
    }
  }, 8);
}

    async function sendMessage(){
      document.getElementById("greeting").style.display = "none";
      const msg = input.value.trim();
      if (!msg) return;
      addMessage("You", chatgptOutputToHtml(msg), "user");
      input.value = "";
      typing.style.display = "block";
      await new Promise(requestAnimationFrame);

      try{
        const res = await fetch(`${API_BASE}/chat`, {
          method:"POST", headers:{ "Content-Type":"application/json" },
          body: JSON.stringify({ user_id, message: msg })
        });
        const data = await res.json();
        typing.style.display = "none";
        typeMessage("FitnessGPT", data.reply || "Sorry, no reply.", "bot");
      }catch(err){
        typing.style.display = "none";
        addMessage("FitnessGPT", "Sorry, something went wrong.", "bot");
      }
    }

    // Reset convo on load (fix small bug in the original)
    window.addEventListener("load", async ()=>{
      try{
        await fetch(`${API_BASE}/reset`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user_id, message: "" })
        });
      }catch(e){}
    });

    // ====== MEAL ANALYZER ======
    const mealFile = document.getElementById("meal-file");
    const mealPreview = document.getElementById("meal-preview");
    const mealBtn = document.getElementById("meal-analyze");
    const mealGoal = document.getElementById("meal-goal");
    const mealAllergies = document.getElementById("meal-allergies");
    const mealResult = document.getElementById("meal-result");
    const mealScore = document.getElementById("meal-score");

    mealFile.addEventListener("change", ()=> previewImage(mealFile, mealPreview));
mealBtn.addEventListener("click", async () => {
  if (!mealFile.files[0]) { pop(mealResult, "Please choose a meal image first."); return; }
  mealBtn.disabled = true; mealResult.textContent = "Analyzing meal…";
  mealBtn.textContent = "Analyzing…";
  mealScore.innerHTML = "";

  const fd = new FormData();
  fd.append("file", mealFile.files[0]);
  fd.append("user_id", user_id);
  fd.append("dietary_goal", mealGoal.value);
  fd.append("allergies", mealAllergies.value);

  try {
    const res = await fetch(`${API_BASE}/analyze-meal`, { method: "POST", body: fd });
    const data = await res.json();

    const rawText = String(data.result || data.reply || data.error || "");
    const lines = rawText.split(/\r?\n/);
    const firstIdx = lines.findIndex(l => l.trim());
    if (firstIdx < 0) throw new Error("Empty response");

    const firstLine = lines[firstIdx].trim().replace(/^\uFEFF/, "");
    const summary = lines.slice(firstIdx + 1).join("\n").trim();

    let parsed = null;
    try { parsed = JSON.parse(firstLine); } catch { /* keep null */ }

    // Don’t display JSON; pass parsed + summary to renderer
    renderMeal(parsed, { result: summary, raw: rawText });
  } catch (e) {
    console.error(e);
    mealResult.textContent = "Error analyzing meal.";
  } finally {
    mealBtn.disabled = false; mealBtn.textContent = "Analyze Meal"; mealResult.textContent = "Analyze Meal";
  }
});

function boldTitles(txt) {
  return String(txt || "").replace(
    /^(-\s+)([^\n]+)$/gm,
    (m, dash, title) => `${dash}<strong>${title.trim()}</strong>`
  );
}
function typeOut(el, html, speed = 10, step = 3) {
  el.innerHTML = "";

  // Parse the HTML into elements and text nodes
  let container = document.createElement('div');
  container.innerHTML = html;

  // Flatten the HTML into an array of {text, isBold} chunks
  let chunks = [];
  function processNode(node, isBold = false) {
    if (node.nodeType === Node.TEXT_NODE) {
      chunks.push({ text: node.textContent, isBold });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.tagName === 'STRONG') {
        // Pass true for isBold when inside strong tag
        node.childNodes.forEach(child => processNode(child, true));
      } else {
        node.childNodes.forEach(child => processNode(child, isBold));
      }
    }
  }
  container.childNodes.forEach(node => processNode(node));

  return new Promise(resolve => {
    let i = 0;

    function tick() {
      // Clear element content
      el.innerHTML = "";

      // Build content up to current i characters
      let charsWritten = 0;

      for (let chunk of chunks) {
        if (charsWritten + chunk.text.length <= i) {
          // Add entire chunk
          if (chunk.isBold) {
            let strong = document.createElement('strong');
            strong.textContent = chunk.text;
            el.appendChild(strong);
          } else {
            el.appendChild(document.createTextNode(chunk.text));
          }
          charsWritten += chunk.text.length;
        } else {
          // Add partial chunk
          let remaining = i - charsWritten;
          if (remaining > 0) {
            let partialText = chunk.text.slice(0, remaining);
            if (chunk.isBold) {
              let strong = document.createElement('strong');
              strong.textContent = partialText;
              el.appendChild(strong);
            } else {
              el.appendChild(document.createTextNode(partialText));
            }
          }
          break;
        }
      }

      i += step;
      if (i <= html.replace(/<[^>]*>/g, '').length) {
        setTimeout(tick, speed);
      } else {
        resolve();
      }
    }

    tick();
  });
}
// ----- your render hook (diagram BELOW the typed results) -----
function typeOutHTMLLive(el, html, speed = 8, step = 3) {
  const tokens = String(html).split(/(<[^>]+>|\n)/g).filter(Boolean);
  let i = 0;
  el.innerHTML = "";

  // Stack to track current parent for appending nodes
  // Start with the root container
  const parents = [el];

  return new Promise(resolve => {
    (function tick() {
      if (i >= tokens.length) return resolve();

      const t = tokens[i];

      if (t === "\n") {
        // Append <br> to the current parent (last in stack)
        parents[parents.length - 1].appendChild(document.createElement("br"));
        i++;
        return setTimeout(tick, speed);
      }

      if (t.startsWith("<")) {
        // Check if it's a closing tag
        if (/^<\//.test(t)) {
          // Pop one level from stack when closing tag
          parents.pop();
          i++;
          return tick();
        }

        // It's an opening tag (e.g. <b>), create element and append to current parent
        // Extract tag name, ignoring attributes for simplicity
        const tagNameMatch = t.match(/^<([a-zA-Z0-9]+)/);
        if (tagNameMatch) {
          const tagName = tagNameMatch[1];
          const elNew = document.createElement(tagName);
          parents[parents.length - 1].appendChild(elNew);
          // Push this new element as current parent to write inside of it
          parents.push(elNew);
        } else {
          // fallback, insert as HTML into root if regex fails
          parents[parents.length - 1].insertAdjacentHTML("beforeend", t);
        }
        i++;
        return tick();
      }

      // Otherwise, it's a text token; append it to current parent as text node
      parents[parents.length - 1].appendChild(document.createTextNode(t.slice(0, step)));

      tokens[i] = t.slice(step);
      if (!tokens[i].length) i++;

      setTimeout(tick, speed);
    })();
  });
}

async function renderMeal(parsed, raw) {
  const mealText = document.getElementById("mealText");
  // your styles
  Object.assign(mealText.style, {
    fontSize: "16px", color: "#fff", fontFamily: "Montserrat",
    whiteSpace: "pre-wrap", filter: "drop-shadow(1.5px 1.5px 2px #111)",
    border: "1px solid rgba(255,255,255,0.15)", padding: "12px", borderRadius: "12px",
    lineHeight: "1.3"
  });

  // 1) IMPORTANT INFO FIRST (gradient)
  mealText.innerHTML = ""; // clear
  const stats = document.createElement("div");
  stats.style.lineHeight = "1.0";
  stats.style.marginBottom = "0px";

  const grad = (v) =>
    `<span style="background:linear-gradient(90deg,#4facfe,#a044ff);
                  -webkit-background-clip:text;background-clip:text;
                  -webkit-text-fill-color:transparent;font-weight:700;line-height:1.6;white-space:nowrap;">
                  ${v}</span>`;

  if (parsed && typeof parsed === "object") {
    const kcal = parsed.calories_kcal_range ? `${parsed.calories_kcal_range} kcal` : "—";
    const m = parsed.macros || {};
    const p = (m.protein_g ?? "—") + " g" + (m.protein_pct!=null ? ` (${m.protein_pct}%)` : "");
    const c = (m.carbs_g   ?? "—") + " g" + (m.carbs_pct  !=null ? ` (${m.carbs_pct }%)` : "");
    const f = (m.fat_g     ?? "—") + " g" + (m.fat_pct    !=null ? ` (${m.fat_pct   }%)` : "");
    const itemsHTML = Array.isArray(parsed.items)
      ? parsed.items.map(i => `<li>${grad(i.name)} — ${grad(i.portion_estimate || "")}</li>`).join("")
      : "";

    stats.innerHTML = `
      <div><strong>Calories:</strong> ${grad(kcal)}</div>
      <div><strong>Protein:</strong> ${grad(p)}</div>
      <div><strong>Carbs:</strong> ${grad(c)}</div>
      <div><strong>Fat:</strong> ${grad(f)}</div>
      ${itemsHTML ? `
        <div style="margin-top:8px;"><strong>Items:</strong></div>
        <ul style="margin:6px 0 0 18px;padding:0">${itemsHTML}</ul>` : "" }
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.2);margin:10px 0 0">
    `;
    mealText.appendChild(stats);
  }

  // 2) THEN THE DEEPER ANALYSIS (bolded headings, typed)
  const summary = String((raw && (raw.result || raw.reply || raw.error)) || "");
  const boldedHTML = boldLinesStartingWithDash(summary);
  console.log(boldedHTML);
  const analysis = document.createElement("div");
  analysis.style.lineHeight = "1.3";
  
  mealText.appendChild(analysis);
  await typeOutHTMLLive(analysis, boldedHTML, 8, 3);
}
function boldLinesStartingWithDash(text) {
  // Split the text into lines
  const lines = text.split('\n');

  // Map over each line and wrap in <b> if it starts with "- "
  const processedLines = lines.map(line => {
    if (line.startsWith('- ')) {
      return '<b>' + line + '</b>';
    }
    return line;
  });

  // Join the lines back together
  return processedLines.join('\n');
}
    



    // ====== PHYSIQUE ANALYZER ======
const physFile = document.getElementById("phys-file");
const physPreview = document.getElementById("phys-preview");
const physBtn = document.getElementById("phys-analyze");
const physGoal = document.getElementById("phys-goal");
const physSex = document.getElementById("phys-sex");
const physHeight = document.getElementById("phys-height");
const physWeight = document.getElementById("phys-weight");
const physResult = document.getElementById("phys-result");
const physScore = document.getElementById("phys-score");


// Preview image when a file is selected
physFile.addEventListener("change", () => {
  previewImage(physFile, physPreview);
  // Reset results on new file selected
  physResult.textContent = "";
  physScore.innerHTML = "";
});

physBtn.addEventListener("click", async () => {
  if (!physFile.files[0]) { pop(physResult, "Please choose an image first."); return; }

  physBtn.disabled = true;
  physBtn.textContent = "Analyzing…";
  physResult.textContent = "";      // don't show JSON here
  physScore.innerHTML = "";

  const heightCm = parseFloat(physHeight.value);
  const weightKg = parseFloat(physWeight.value);

  const fd = new FormData();
  fd.append("file", physFile.files[0]);
  fd.append("user_id", user_id);
  fd.append("goal", physGoal.value);
  fd.append("sex", physSex.value);
  fd.append("height_cm", isNaN(heightCm) ? 0 : heightCm);
  fd.append("weight_kg", isNaN(weightKg) ? 0 : weightKg);

  try {
    const res = await fetch(`${API_BASE}/rate-physique`, { method: "POST", body: fd });
    const data = await res.json();

    const rawText = String(data.result || data.reply || data.error || "");
    const lines = rawText.split(/\r?\n/);
    const firstIdx = lines.findIndex(l => l.trim().length);
    if (firstIdx < 0) throw new Error("Empty response");

    const firstLine = lines[firstIdx].trim().replace(/^\uFEFF/, "");
    const summary = lines.slice(firstIdx + 1).join("\n").trim();

    let parsed = null;
    try { parsed = JSON.parse(firstLine); } catch {}

    renderPhysique(parsed, { result: summary, raw: rawText });
  } catch (e) {
    console.error(e);
    physResult.textContent = "Error analyzing physique.";
  } finally {
    physBtn.disabled = false;
    physBtn.textContent = "Rate Physique";
  }
});
async function renderPhysique(parsed, raw) {
  physScore.innerHTML = "";

  Object.assign(physResult.style, {
    fontFamily: "Montserrat",
    fontSize: "16px",
    lineHeight: "1.55",
    color: "#fff",
    filter: "drop-shadow(1.5px 1.5px 2px #111)"
  });
  physResult.innerHTML = "";

  // Gradient helper for all key text
  const grad = (v) =>
    `<span style="background:linear-gradient(90deg,#4facfe,#a044ff);
                  -webkit-background-clip:text;background-clip:text;
                  -webkit-text-fill-color:transparent;font-weight:700;">${v}</span>`;

  if (parsed && typeof parsed === "object") {
    const bf     = parsed.bf_percent_range ? `${parsed.bf_percent_range}` : "—";
    const score  = (parsed.overall_score_0_10 != null) ? `${parsed.overall_score_0_10}/10` : "—";
    const posture = parsed.posture?.summary || "—";
    const strengths = Array.isArray(parsed.muscle_balance?.strengths) ? parsed.muscle_balance.strengths : [];
    const gaps      = Array.isArray(parsed.muscle_balance?.gaps)      ? parsed.muscle_balance.gaps      : [];

    const stats = document.createElement("div");
    stats.style.lineHeight = "1.4";
    stats.style.marginBottom = "8px";

    const row = (label, valueHTML) =>
      `<div style="display:flex;min-width:0;align-items:baseline;gap:8px;margin:2px 0;">
         <span style="font-weight:700;white-space:nowrap">${label}</span>
         <span>${valueHTML}</span>
       </div>`;

    const list = (arr) => arr.length
      ? `<ul style="margin:0 0 0 16px;padding:0;list-style:disc">
           ${arr.slice(0,5).map(x => `<li style="margin:1px 0;">${grad(x)}</li>`).join("")}
         </ul>`
      : `<div style="opacity:.8">—</div>`;

    stats.innerHTML = [
      row("Body fat (est.):", grad(bf)),
      row("Overall score:",   grad(score)),
      row("Posture:",         grad(posture)),
      `<div style="display:flex;min-width:0;gap:18px;margin-top:4px;">
         <div style="display:flex;min-width:0; margin-top:8px;">
           <div style="font-weight:700;margin-bottom:1px">Strengths</div>
           ${list(strengths)}
         </div>
         <div style="display:flex;min-width:0; margin-top:8px;">
           <div style="font-weight:700;margin-bottom:1px">Gaps</div>
           ${list(gaps)}
         </div>
       </div>`,
      `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.18);margin:8px 0 0">`
    ].join("");

    physResult.appendChild(stats);
  }

  const summaryRaw = String((raw && (raw.result || raw.reply || raw.error)) || "");
  const summary = summaryRaw.trim();

  if (summary.length === 0) {
    const note = document.createElement("div");
    note.style.opacity = "0.9";
    note.textContent = "No additional analysis provided.";
    physResult.appendChild(note);
    return;
  }

  const boldedHTML = boldTitlesph(summary);
  const analysis = document.createElement("div");
  analysis.style.marginTop = "8px";
  physResult.appendChild(analysis);

  await typeOutHTMLLive(analysis, boldedHTML, 8, 3);
}



// Bold titles lines helper (wrap lines not starting with - in <strong>)
function boldTitlesph(text) {
  return text
    .split('\n')
    .map(line => {
      if (line.trim() !== "" && !line.trim().startsWith("- ")) {
        return `<strong>${line.trim()}</strong>`;
      }
      return line;
    })
    .join('\n');
}

// ====== UTIL ======
function previewImage(inputEl, previewEl) {
  const file = inputEl.files[0];
  if (!file) {
    previewEl.textContent = "No image selected";
    return;
  }
  if (!file.type.startsWith("image/")) {
    previewEl.textContent = "Please select an image file";
    inputEl.value = "";
    return;
  }
  const url = URL.createObjectURL(file);
  previewEl.innerHTML = `<img src="${url}" alt="preview">`;
}

function tryParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function pop(el, text) {
  el.textContent = text;
  el.style.animation = "none";
  requestAnimationFrame(() => {
    el.style.animation = "blurFadeIn_greeting .3s ease";
  });
}
function badgeForScore(score, label) {
  if (Number.isNaN(score) || score < 0) return "";
  const cls = score >= 7 ? "score-good" : (score >= 4 ? "score-mid" : "score-bad");
  return `<span class="badge ${cls}">${label}: ${score}/10</span>`;

}
// profile
// ===== Keys & input IDs =====
const PROFILE_KEY = "fitnessgpt_profile_v1";
const PROFILE_HASH_KEY = "fitnessgpt_profile_hash_v1";
const PROFILE_INPUT_IDS = [
  "p-age","p-sex","p-height","p-weight","p-bf","p-activity","p-goal","p-diet","p-allergies"
];



// ===== Local profile helpers =====
function getUserProfile(){
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}"); }
  catch { return {}; }
}


function setUserProfile(p){
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  localStorage.setItem(PROFILE_HASH_KEY, hashProfile(p));
}


function hashProfile(p){ 
  return btoa(unescape(encodeURIComponent(JSON.stringify(p))));
}


function hasChanged(p){ 
  return hashProfile(p) !== localStorage.getItem(PROFILE_HASH_KEY);
}


function readNum(id){ 
  const el = document.getElementById(id);
  const v = parseFloat(el?.value);
  return isNaN(v) ? null : v; 
}


function val(id){ 
  const el = document.getElementById(id);
  const v = el?.value?.trim();
  return v || null; 
}


function collectProfile(){
  const allergies = (val("p-allergies")||"").split(",").map(s=>s.trim()).filter(Boolean);
  const p = {
    age: readNum("p-age"),
    sex: val("p-sex"),
    height_cm: readNum("p-height"),
    weight_kg: readNum("p-weight"),
    body_fat_pct: readNum("p-bf"),
    activity: val("p-activity"),
    goal: val("p-goal") || "balanced",
    diet: val("p-diet"),
    allergies: allergies.length ? allergies : undefined
  };
  Object.keys(p).forEach(k => (p[k] == null) && delete p[k]);
  return p;
}


function fillFormFromProfile(){
  const p = getUserProfile();
  const set = (id, v) => { if (v != null && document.getElementById(id)) document.getElementById(id).value = v; };
  set("p-age", p.age); 
  set("p-sex", p.sex);
  set("p-height", p.height_cm); 
  set("p-weight", p.weight_kg);
  set("p-bf", p.body_fat_pct); 
  set("p-activity", p.activity);
  set("p-goal", p.goal); 
  set("p-diet", p.diet);
  if (p.allergies && document.getElementById("p-allergies")) {
    document.getElementById("p-allergies").value = p.allergies.join(", ");
  }
}


// ===== User ID =====
function getUserId(){
  let id = localStorage.getItem("fitnessgpt_user_id");
  if (!id) {
    id = "u_" + crypto.getRandomValues(new Uint32Array(2)).join("-");
    localStorage.setItem("fitnessgpt_user_id", id);
  }
  return id;
}


const user_id = getUserId();
console.log("Using user_id:", user_id);


// ===== Sync to backend (no-op if API_BASE missing) =====
async function syncProfileIfChanged(p){
  console.log("API_BASE:", typeof API_BASE === "undefined" ? "(undefined)" : API_BASE);
  console.log("[profile] sync check for user:", user_id);


  if (typeof API_BASE !== "string" || !API_BASE) {
    console.warn("[profile] API_BASE not set — skipping sync");
    return;
  }


  try {
    console.log("[syncProfileIfChanged] about to fetch with profile:", p);
    const res = await fetch(`${API_BASE}/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id, ...p }),
    });
    console.log("[syncProfileIfChanged] fetch done, status:", res.status);
    if (!res.ok) {
      console.error("Profile sync failed:", await res.text());
    }
  } catch (err) {
    console.error("Fetch error:", err);
  }
}


// ===== Debounced autosave handler =====
function handleProfileChangeDebounced(){
  clearTimeout(handleProfileChangeDebounced._t);
  handleProfileChangeDebounced._t = setTimeout(async () => {
    const p = collectProfile();
    setUserProfile(p);
    await syncProfileIfChanged(p);
    console.log("[profile] autosaved:", p);
  }, 400);
}


function isProfileInput(el){
  return !!el && PROFILE_INPUT_IDS.includes(el.id);
}


// ===== Start autosave (bind events, observe DOM) =====
function startProfileAutosave(){
  if (startProfileAutosave._started) return;
  startProfileAutosave._started = true;



  // Initial fill
  fillFormFromProfile();


  // Which inputs exist
  const existing = PROFILE_INPUT_IDS.filter(id => document.getElementById(id));
  const missing  = PROFILE_INPUT_IDS.filter(id => !document.getElementById(id));
  console.log("[profile] existing inputs:", existing);
  if (missing.length) console.warn("[profile] missing inputs:", missing);


  // Delegate input/change/focusout events at document level (capture: true)
  const onAny = (e) => {
    const t = e.target;
    if (isProfileInput(t)) {
      console.log("[profile] change on:", t.id);
      handleProfileChangeDebounced();
    }
  };
  document.addEventListener("input", onAny, true);
  document.addEventListener("change", onAny, true);
  document.addEventListener("focusout", onAny, true);


  // Observe late-mounted inputs and auto-fill once they arrive
  startProfileAutosave._seen = startProfileAutosave._seen || new Set();
  const mo = new MutationObserver(() => {
    const newlyThere = PROFILE_INPUT_IDS.filter(id => {
      return document.getElementById(id) && !startProfileAutosave._seen.has(id);
    });
    if (newlyThere.length){
      newlyThere.forEach(id => startProfileAutosave._seen.add(id));
      console.log("[profile] inputs appeared:", newlyThere);
      fillFormFromProfile();
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
}


// Start once DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  startProfileAutosave();



  // Prevent Enter key in profile inputs from submitting form / reloading page
  
});



// ===== Multiple-load stopping logic =====
window.addEventListener('load', () => {
  const reloadCount = parseInt(localStorage.getItem('reloadCount') || '0', 10);
  const lastReloadTime = parseInt(localStorage.getItem('lastReloadTime') || '0', 10);
  const now = Date.now();


  if (now - lastReloadTime > 5 * 60 * 1000) {
    localStorage.setItem('reloadCount', '0');


    (async () => {
      const p = collectProfile();
      setUserProfile(p);
      await syncProfileIfChanged(p);
      console.log("[profile] autosaved (initial):", p);
    })();
  }


  if (reloadCount >= 2) {
    console.log('Too many reloads, stopping further reloads.');
    return;
  }


  localStorage.setItem('reloadCount', (reloadCount + 1).toString());
  localStorage.setItem('lastReloadTime', now.toString());
});


