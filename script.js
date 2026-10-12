const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const state = { params: [], headers: [], form: [], urlenc: [], bodyType: 'none', lastText: '', lastType: '' };
let history = []; try { history = JSON.parse(localStorage.getItem('relay-hist') || '[]') } catch (e) { }

/* theme */
(function () {
    let t; try { t = localStorage.getItem('relay-theme') } catch (e) { }
    if (!t) t = matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = t
})();
$('#theme').onclick = () => { const d = document.documentElement, t = d.dataset.theme === 'dark' ? 'light' : 'dark'; d.dataset.theme = t; try { localStorage.setItem('relay-theme', t) } catch (e) { } };

function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 1700) }

/* tabs */
function tabs(rootSel, attr, prefix) {
    $(rootSel).addEventListener('click', e => {
        const b = e.target.closest('.tab'); if (!b) return;
        $$(rootSel + ' .tab').forEach(x => x.setAttribute('aria-selected', x === b));
        const id = b.dataset[attr];
        $$('[id^="' + prefix + '"]').forEach(p => p.classList.contains('panel') && p.classList.toggle('on', p.id === prefix + id));
    });
}
tabs('#reqTabs', 'p', 'p-'); tabs('#resTabs', 'r', 'r-');

/* key/value editors */
function renderKV(name) {
    const box = $('#kv-' + name), isForm = name === 'form';
    box.innerHTML = '';
    state[name].forEach((r, i) => {
        const d = document.createElement('div'); d.className = 'kv-row' + (isForm ? ' file' : '');
        d.innerHTML = '<input type="checkbox" aria-label="Enable"' + (r.on ? ' checked' : '') + '>'
            + '<input type="text" placeholder="Key" value="' + esc(r.k).replace(/"/g, '&quot;') + '">'
            + (isForm && r.file ? '<input type="file">' : '<input type="text" placeholder="Value" value="' + esc(r.v).replace(/"/g, '&quot;') + '">')
            + '<button type="button" class="x" aria-label="Remove">×</button>';
        const [c, k, v, x] = d.children;
        c.onchange = () => { r.on = c.checked; sync(name) };
        k.oninput = () => { r.k = k.value; sync(name, true) };
        if (r.file) v.onchange = () => { r.fileObj = v.files[0] }; else v.oninput = () => { r.v = v.value; sync(name, true) };
        x.onclick = () => { state[name].splice(i, 1); renderKV(name); sync(name) };
        if (isForm) {
            const tg = document.createElement('button'); tg.type = 'button'; tg.className = 'ghost'; tg.textContent = r.file ? 'Text' : 'File';
            tg.onclick = () => { r.file = !r.file; renderKV(name) }; d.insertBefore(tg, x)
        }
        box.appendChild(d);
    });
}
function sync(name, keepUrl) {
    const n = $('#n-' + name); if (n) n.textContent = state[name].filter(r => r.on && r.k).length;
    if (name === 'params' && !keepUrl) return;
    if (name === 'params') writeUrl();
}
$$('[data-add]').forEach(b => b.onclick = () => {
    const n = b.dataset.add; state[n].push({ on: true, k: '', v: '', file: false }); renderKV(n); sync(n)
    const ins = $$('#kv-' + n + ' input[type=text]'); ins[ins.length - 2]?.focus()
});

/* url <-> params sync */
function writeUrl() {
    const u = $('#url').value.split('?')[0].split('#')[0];
    const q = state.params.filter(r => r.on && r.k).map(r => encodeURIComponent(r.k) + '=' + encodeURIComponent(r.v)).join('&');
    $('#url').value = u + (q ? '?' + q : '');
}
$('#url').addEventListener('input', () => {
    const q = $('#url').value.split('#')[0].split('?')[1] || '';
    state.params = q ? q.split('&').map(p => { const [i, ...r] = p.split('='); let k = i, v = r.join('='); try { k = decodeURIComponent(i); v = decodeURIComponent(v) } catch (e) { } return { on: true, k, v } }) : [];
    renderKV('params'); sync('params', true);
});

/* auth */
function renderAuth() {
    const t = $('#authType').value, f = $('#authFields');
    const inp = (id, l, type = 'text', ph = '') => '<div class="field"><label for="' + id + '">' + l + '</label><input id="' + id + '" type="' + type + '" placeholder="' + ph + '" autocomplete="off" autocapitalize="off" spellcheck="false"></div>';
    f.innerHTML = t === 'bearer' ? inp('a-token', 'Token', 'password', 'eyJhbGciOi…')
        : t === 'basic' ? inp('a-user', 'Username') + inp('a-pass', 'Password', 'password')
            : t === 'apikey' ? inp('a-key', 'Key name', 'text', 'X-API-Key') + inp('a-val', 'Value', 'password')
                + '<div class="field"><label for="a-in">Add to</label><select id="a-in" style="width:100%;font-family:var(--sans);font-size:16px;font-weight:500"><option value="header">Header</option><option value="query">Query parameter</option></select></div>'
                : '<p class="hint">This request doesn\'t send any credentials.</p>';
}
$('#authType').onchange = renderAuth;

/* body */
$('#bodyType').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.bodyType = b.dataset.t;
    $$('#bodyType button').forEach(x => x.setAttribute('aria-pressed', x === b));
    ['none', 'json', 'form', 'urlenc', 'raw'].forEach(t => $('#b-' + t).hidden = t !== state.bodyType)
});
function jsonCheck() {
    const v = $('#json').value.trim(), e = $('#jerr'); if (!v) { e.textContent = ''; return true }
    try { JSON.parse(v); e.textContent = ''; return true } catch (x) { e.textContent = 'Invalid JSON: ' + x.message; return false }
}
$('#json').addEventListener('input', jsonCheck);
$('#fmt').onclick = () => { if (jsonCheck() && $('#json').value.trim()) $('#json').value = JSON.stringify(JSON.parse($('#json').value), null, 2) };
$('#min').onclick = () => { if (jsonCheck() && $('#json').value.trim()) $('#json').value = JSON.stringify(JSON.parse($('#json').value)) };
$('#json').addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); const t = e.target, s = t.selectionStart; t.setRangeText('  ', s, t.selectionEnd, 'end') } });

/* send */
$('#form').addEventListener('submit', async e => {
    e.preventDefault();
    let url = $('#url').value.trim();
    if (!url) return toast('Enter a URL first');
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const method = $('#method').value, headers = new Headers();
    state.headers.filter(r => r.on && r.k).forEach(r => { try { headers.set(r.k, r.v) } catch (x) { } });
    const at = $('#authType').value;
    try {
        if (at === 'bearer' && $('#a-token').value) headers.set('Authorization', 'Bearer ' + $('#a-token').value);
        if (at === 'basic') headers.set('Authorization', 'Basic ' + btoa(unescape(encodeURIComponent($('#a-user').value + ':' + $('#a-pass').value))));
        if (at === 'apikey' && $('#a-key').value) {
            if ($('#a-in').value === 'header') headers.set($('#a-key').value, $('#a-val').value);
            else { const u = new URL(url); u.searchParams.set($('#a-key').value, $('#a-val').value); url = u.toString() }
        }
    } catch (x) { return toast('Check your auth fields') }
    let body; const canBody = !['GET', 'HEAD'].includes(method);
    if (canBody) {
        const bt = state.bodyType;
        if (bt === 'json') { if (!jsonCheck()) return toast('Fix the JSON body first'); body = $('#json').value.trim() || undefined; if (body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json') }
        else if (bt === 'raw') { body = $('#raw').value || undefined }
        else if (bt === 'urlenc') { const p = new URLSearchParams(); state.urlenc.filter(r => r.on && r.k).forEach(r => p.append(r.k, r.v)); body = p.toString(); if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/x-www-form-urlencoded') }
        else if (bt === 'form') { const f = new FormData(); state.form.filter(r => r.on && r.k).forEach(r => r.file ? (r.fileObj && f.append(r.k, r.fileObj)) : f.append(r.k, r.v)); body = f }
    }
    const btn = $('#send'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Sending';
    const t0 = performance.now();
    try {
        const res = await fetch(url, { method, headers, body });
        const buf = await res.arrayBuffer(), ms = Math.round(performance.now() - t0);
        const ct = res.headers.get('content-type') || '';
        const text = new TextDecoder().decode(buf);
        show({ ok: true, status: res.status, statusText: res.statusText, ms, size: buf.byteLength, ct, text, headers: [...res.headers.entries()] });
        addHist({ method, url, status: res.status });
    } catch (err) {
        show({ ok: false, ms: Math.round(performance.now() - t0), text: 'Request failed: ' + err.message + '\n\nThis is usually a CORS restriction, an unreachable host, or mixed content (calling http from an https page). The server must send Access-Control-Allow-Origin for browser requests to succeed.' });
        addHist({ method, url, status: 'ERR' });
    } finally { btn.disabled = false; btn.textContent = 'Send' }
});

function hl(json) {
    return esc(json).replace(/("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, m => {
        let c = 'nm'; if (/^"/.test(m)) c = /:$/.test(m) ? 'k' : 's'; else if (/true|false|null/.test(m)) c = 'b'; return '<span class="' + c + '">' + m + '</span>'
    })
}
function fmtSize(n) { return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB' }
function show(r) {
    $('#resEmpty').hidden = true; $('#resBox').hidden = false;
    const b = $('#rStatus');
    b.textContent = r.ok ? r.status + ' ' + (r.statusText || '') : 'Error';
    b.className = 'badge ' + (r.ok ? 's' + String(r.status)[0] : 'e');
    $('#rTime').textContent = r.ms + ' ms'; $('#rSize').textContent = r.ok ? fmtSize(r.size) : '';
    let out = r.text, html = false;
    if (r.ok && (/json/i.test(r.ct) || /^\s*[\[{]/.test(r.text))) { try { out = hl(JSON.stringify(JSON.parse(r.text), null, 2)); html = true; state.lastText = JSON.stringify(JSON.parse(r.text), null, 2); state.lastType = 'json' } catch (e) { } }
    if (!html) { state.lastText = r.text; state.lastType = /html/i.test(r.ct || '') ? 'html' : 'txt' }
    const pre = $('#rBody'); if (html) pre.innerHTML = out; else pre.textContent = out || '(empty body)';
    $('#rHeaders').innerHTML = (r.headers || []).map(([k, v]) => '<tr><td>' + esc(k) + '</td><td>' + esc(v) + '</td></tr>').join('') || '<tr><td colspan="2" class="hint">No headers exposed. Cross-origin responses only reveal CORS-safelisted headers.</td></tr>';
    $('#n-rh').textContent = (r.headers || []).length;
    $('#rPrev').srcdoc = state.lastType === 'html' ? r.text : '<pre style="font:13px monospace;white-space:pre-wrap;padding:8px">' + esc(state.lastText) + '</pre>';
    $('#resCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
$('#copy').onclick = async () => { try { await navigator.clipboard.writeText(state.lastText); toast('Copied') } catch (e) { toast('Copy failed') } };
$('#wrap').onclick = () => $('#rBody').classList.toggle('nowrap');
$('#dl').onclick = () => {
    const ext = { json: 'json', html: 'html', txt: 'txt' }[state.lastType] || 'txt';
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([state.lastText])); a.download = 'response.' + ext; a.click(); URL.revokeObjectURL(a.href)
};

/* history */
function addHist(h) { history = [h, ...history.filter(x => !(x.url === h.url && x.method === h.method))].slice(0, 15); try { localStorage.setItem('relay-hist', JSON.stringify(history)) } catch (e) { } renderHist() }
function renderHist() {
    const box = $('#hist');
    if (!history.length) { box.innerHTML = '<p class="hint">Sent requests appear here.</p>'; return }
    box.innerHTML = ''; history.forEach(h => {
        const b = document.createElement('button');
        b.innerHTML = '<span class="m">' + esc(h.method) + '</span><span class="u">' + esc(h.url) + '</span><span class="badge">' + esc(String(h.status)) + '</span>';
        b.onclick = () => { $('#method').value = h.method; $('#url').value = h.url; $('#url').dispatchEvent(new Event('input')); toast('Request restored') }; box.appendChild(b)
    })
}

/* init */
renderAuth(); renderHist(); $('#url').dispatchEvent(new Event('input'));
state.headers.push({ on: true, k: 'Accept', v: 'application/json' }); renderKV('headers'); sync('headers');
['form', 'urlenc'].forEach(n => renderKV(n));