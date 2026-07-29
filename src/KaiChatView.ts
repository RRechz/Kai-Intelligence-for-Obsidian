import { ItemView, WorkspaceLeaf, MarkdownRenderer, Notice, setIcon, Modal, App } from 'obsidian';
import KaiIntelligencePlugin from './main';
import { GeminiService, AttachmentData, ChatResponse } from './GeminiService';
import { t } from './Language';

export const KAI_CHAT_VIEW_TYPE = "kai-chat-view";

// ======================= AI SUGGESTIONS DATA =======================
interface AISuggestion {
    id: string;
    textKey: string;
    animationClass: string;
    iconHtml: string;
}

const AI_SUGGESTIONS: AISuggestion[] = [
    {
        id: "youtube_analysis",
        textKey: "ai_suggestion_youtube_analysis",
        animationClass: "anim-pulse",
        iconHtml: `<svg viewBox="0 0 24 24"><path fill="#FF0000" d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816z"/><path fill="#FFFFFF" d="M9 16l6.5-4L9 8z"/><path fill="#8B0000" opacity="0.3" d="M9 16l6.5-4L9 8z" transform="translate(1, 1)"/></svg>`
    },
    {
        id: "summarize",
        textKey: "ai_suggestion_summarize",
        animationClass: "anim-spin",
        iconHtml: `<svg viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2" fill="#2196F3"/><path fill="#FFEB3B" d="M8 7h8v2H8zm0 4h8v2H8zm0 4h5v2H8z"/></svg>`
    },
    {
        id: "explain_code",
        textKey: "ai_suggestion_explain_code",
        animationClass: "anim-bounce",
        iconHtml: `<svg viewBox="0 0 24 24"><path fill="#9C27B0" d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4z"/><path fill="#4CAF50" d="M14.6 16.6l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/><path fill="#FF9800" d="M13.4 5l-2.8 14h2l2.8-14h-2z"/></svg>`
    },
    {
        id: "fix_grammar",
        textKey: "ai_suggestion_fix_grammar",
        animationClass: "anim-shake",
        iconHtml: `<svg viewBox="0 0 24 24"><path fill="#4CAF50" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/><path fill="#F44336" d="M3 21h18v2H3z"/></svg>`
    },
    {
        id: "translate",
        textKey: "ai_suggestion_translate",
        animationClass: "anim-flip",
        iconHtml: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#03A9F4"/><path fill="#8BC34A" d="M2 12c0 3.64 1.95 6.82 4.9 8.5C9.28 17.65 11.16 16 12 16s2.72 1.65 5.1 4.5C20.05 18.82 22 15.64 22 12c0-1.85-.5-3.58-1.37-5H3.37C2.5 8.42 2 10.15 2 12z"/></svg>`
    },
    {
        id: "brainstorm",
        textKey: "ai_suggestion_brainstorm",
        animationClass: "anim-glow",
        iconHtml: `<svg viewBox="0 0 24 24"><path fill="#FFC107" d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z"/><rect x="10" y="19" width="4" height="3" fill="#607D8B"/><path fill="#FF5722" d="M11 11h2v2h-2z"/></svg>`
    },
    {
        id: "professional_tone",
        textKey: "ai_suggestion_professional_tone",
        animationClass: "anim-stretch",
        iconHtml: `<svg viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="12" rx="2" fill="#795548"/><path fill="#FFD700" d="M10 4h4v4h-4z"/><circle cx="12" cy="14" r="2" fill="#E0E0E0"/></svg>`
    },
    {
        id: "extract_keywords",
        textKey: "ai_suggestion_extract_keywords",
        animationClass: "anim-ring",
        iconHtml: `<svg viewBox="0 0 24 24"><path fill="#FF5722" d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4h2.35l2 2 2-2 2 2 2-2v-4h-6.35z"/><circle cx="7" cy="12" r="1.5" fill="#FFFFFF"/></svg>`
    },
    {
        id: "continue_writing",
        textKey: "ai_suggestion_continue_writing",
        animationClass: "anim-slide-up",
        iconHtml: `<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="2" fill="#00BCD4"/><circle cx="12" cy="12" r="2" fill="#E91E63"/><path fill="#9C27B0" d="M18 8l4 4-4 4v-3h-4v-2h4z"/></svg>`
    },
    {
        id: "create_table",
        textKey: "ai_suggestion_create_table",
        animationClass: "anim-jelly",
        iconHtml: `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="1" fill="#4CAF50"/><rect x="3" y="4" width="18" height="5" fill="#1B5E20"/><path fill="#C8E6C9" d="M8 9v11M16 9v11M3 14h18"/></svg>`
    }
];
// ===================================================================

class KaiSourcesModal extends Modal {
    sources: { title: string, uri: string }[];

    constructor(app: App, sources: { title: string, uri: string }[]) {
        super(app);
        this.sources = sources;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: t('modal_sources_title') || 'İnternet Kaynakları' });

        const list = contentEl.createEl('ul', { attr: { style: 'padding-left: 20px;' } });
        this.sources.forEach(src => {
            const li = list.createEl('li', { attr: { style: 'margin-bottom: 12px;' } });
            li.createEl('a', { 
                text: src.title, 
                href: src.uri, 
                attr: { target: '_blank', style: 'color: var(--text-accent); font-weight: 600; text-decoration: none;' } 
            });
            li.createEl('div', { 
                text: src.uri, 
                attr: { style: 'font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px;' } 
            });
        });
    }

    onClose() {
        this.contentEl.empty();
    }
}

class KaiHistoryModal extends Modal {
    history: any[];

    constructor(app: App, history: any[]) {
        super(app);
        this.history = history;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: 'Arşivlenmiş Sohbet Geçmişi' });
        contentEl.createEl('p', { 
            text: 'Kai ile yaptığınız önceki konuşmalar. Yeni bir bağlama geçtiğinizde bu geçmişi çöp kutusu ikonundan temizleyebilirsiniz.', 
            attr: { style: 'margin-bottom: 16px; color: var(--text-muted); font-size: 13px;' } 
        });

        const scrollArea = contentEl.createEl('div');
        scrollArea.style.maxHeight = '60vh';
        scrollArea.style.overflowY = 'auto';
        scrollArea.style.paddingRight = '8px';

        if (!this.history || this.history.length === 0) {
            scrollArea.createEl('p', { text: 'Henüz kaydedilmiş bir geçmiş bulunmuyor.' });
            return;
        }

        this.history.forEach((msg) => {
            const roleName = msg.role === 'user' ? 'Sen' : 'Kai';
            const text = msg.parts?.map((p: any) => p.text).join('') || '';
            
            if (text) {
                const msgDiv = scrollArea.createEl('div', { 
                    attr: { style: 'margin-bottom: 12px; padding: 12px; border-radius: 8px; border: 1px solid var(--background-modifier-border); background-color: var(--background-secondary);' } 
                });
                msgDiv.createEl('strong', { text: `${roleName}: ` });
                const displayText = text.length > 400 ? text.substring(0, 400) + '...' : text;
                msgDiv.createEl('span', { text: displayText });
            }
        });
    }

    onClose() {
        this.contentEl.empty();
    }
}

class KaiOptionsModal extends Modal {
    options: { length: 'short'|'medium'|'long'; tone: 'concise'|'neutral'|'detailed'; includeSources: boolean; format: 'markdown'|'plain' };
    onSave: (opts: any) => void;

    constructor(app: App, options: any, onSave: (opts: any) => void) {
        super(app);
        this.options = Object.assign({}, options);
        this.onSave = onSave;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'AI Seçenekleri' });

        // Length
        contentEl.createEl('div', { text: 'Yanıt Uzunluğu', attr: { style: 'margin-top:8px; font-weight:600' } });
        const lengths = ['short','medium','long'] as const;
        const lengthLabels: any = { short: t('btn_short') || 'Short', medium: t('btn_medium') || 'Medium', long: t('btn_long') || 'Long' };
        lengths.forEach(l => {
            const id = `kai-opt-length-${l}`;
            const wrapper = contentEl.createEl('div', { attr: { style: 'margin:6px 0; display:flex; gap:8px; align-items:center;' } });
            const input = wrapper.createEl('input', { attr: { type: 'radio', name: 'kai-opt-length', id } }) as HTMLInputElement;
            if (this.options.length === l) input.checked = true;
            const label = wrapper.createEl('label', { attr: { for: id } });
            label.textContent = lengthLabels[l];
            input.addEventListener('change', () => { if (input.checked) this.options.length = l; });
        });

        // Tone
        contentEl.createEl('div', { text: 'Ton', attr: { style: 'margin-top:12px; font-weight:600' } });
        const tones: any = { concise: 'Concise', neutral: 'Neutral', detailed: 'Detailed' };
        Object.keys(tones).forEach((k) => {
            const id = `kai-opt-tone-${k}`;
            const wrapper = contentEl.createEl('div', { attr: { style: 'margin:6px 0; display:flex; gap:8px; align-items:center;' } });
            const input = wrapper.createEl('input', { attr: { type: 'radio', name: 'kai-opt-tone', id } }) as HTMLInputElement;
            if (this.options.tone === (k as any)) input.checked = true;
            const label = wrapper.createEl('label', { attr: { for: id } });
            label.textContent = tones[k as any];
            input.addEventListener('change', () => { if (input.checked) this.options.tone = k as any; });
        });

        // Include sources
        const srcWrapper = contentEl.createEl('div', { attr: { style: 'margin-top:12px; display:flex; gap:8px; align-items:center;' } });
        const srcToggle = srcWrapper.createEl('input', { attr: { type: 'checkbox', id: 'kai-opt-sources' } }) as HTMLInputElement;
        srcToggle.checked = !!this.options.includeSources;
        const srcLabel = srcWrapper.createEl('label', { attr: { for: 'kai-opt-sources' } });
        srcLabel.textContent = t('btn_sources') || 'Include sources';
        srcToggle.addEventListener('change', () => { this.options.includeSources = srcToggle.checked; });

        // Format
        contentEl.createEl('div', { text: 'Çıktı Formatı', attr: { style: 'margin-top:12px; font-weight:600' } });
        const formats: any = { markdown: 'Markdown', plain: 'Plain text' };
        Object.keys(formats).forEach((k) => {
            const id = `kai-opt-format-${k}`;
            const wrapper = contentEl.createEl('div', { attr: { style: 'margin:6px 0; display:flex; gap:8px; align-items:center;' } });
            const input = wrapper.createEl('input', { attr: { type: 'radio', name: 'kai-opt-format', id } }) as HTMLInputElement;
            if (this.options.format === (k as any)) input.checked = true;
            const label = wrapper.createEl('label', { attr: { for: id } });
            label.textContent = formats[k as any];
            input.addEventListener('change', () => { if (input.checked) this.options.format = k as any; });
        });

        // Buttons
        const btnRow = contentEl.createEl('div', { attr: { style: 'margin-top:16px; display:flex; gap:8px; justify-content:flex-end;' } });
        const saveBtn = btnRow.createEl('button', { text: 'Save', cls: 'mod-cta' });
        const cancelBtn = btnRow.createEl('button', { text: 'Cancel' });
        saveBtn.addEventListener('click', () => {
            this.onSave(this.options);
            this.close();
        });
        cancelBtn.addEventListener('click', () => this.close());
    }

    onClose() {
        this.contentEl.empty();
    }
}

export class KaiChatView extends ItemView {
    plugin: KaiIntelligencePlugin;
    geminiService: GeminiService;
    chatContainer!: HTMLElement;
    inputField!: HTMLTextAreaElement;
    sendButton?: HTMLButtonElement;
    currentAttachment: AttachmentData | null = null;
    aiOptions: {
        length: 'short' | 'medium' | 'long';
        tone: 'concise' | 'neutral' | 'detailed';
        includeSources: boolean;
        format: 'markdown' | 'plain';
    } = { length: 'medium', tone: 'neutral', includeSources: true, format: 'markdown' };

    constructor(leaf: WorkspaceLeaf, plugin: KaiIntelligencePlugin) {
        super(leaf);
        this.plugin = plugin;
        this.geminiService = new GeminiService(
            this.plugin.app, 
            this.plugin.settings, 
            async (newHistory) => {
                this.plugin.settings.chatHistory = newHistory;
                await this.plugin.saveSettings();
            }
        );
    }

    getViewType() { return KAI_CHAT_VIEW_TYPE; }
    getDisplayText() { return "Kai Intelligence"; }
    getIcon() { return "bot"; }

    public setContextAndFocus(selectedText: string) {
        if (this.inputField) {
            this.inputField.value = `> ${selectedText}\n\n`;
            this.inputField.focus();
            this.inputField.setSelectionRange(this.inputField.value.length, this.inputField.value.length);
            this.inputField.style.height = 'auto';
            this.inputField.style.height = Math.min(this.inputField.scrollHeight, 150) + 'px';
        }
    }

    private updateSendButtonState(sendButton?: HTMLButtonElement) {
        const hasContent = this.inputField?.value.trim().length > 0 || !!this.currentAttachment;
        const target = sendButton ?? this.sendButton;
        if (target) {
            target.disabled = !hasContent;
            target.classList.toggle('is-ready', hasContent);
        }
    }

    private formatTimestamp(date: Date = new Date()): string {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // ================== AI ÖNERİLERİ RENDER FONKSİYONU ==================
    private renderAISuggestions(inputCardElement: HTMLElement, onSelect: (suggestionText: string) => void) {
        const suggestionsContainer = document.createElement("div");
        suggestionsContainer.className = "kai-suggestions-container";

        const suggestionsLabel = document.createElement("div");
        suggestionsLabel.className = "kai-suggestions-label";
        suggestionsLabel.textContent = t('ai_suggestions_title') || 'Hızlı başlangıç';

        const suggestionsHint = document.createElement("div");
        suggestionsHint.className = "kai-suggestions-hint";
        suggestionsHint.textContent = t('ai_suggestions_hint') || 'Bir eylem seçin, sonra düzenleyip gönderin.';

        const suggestionsWrapper = document.createElement("div");
        suggestionsWrapper.className = "kai-suggestions-wrapper";

        AI_SUGGESTIONS.forEach((suggestion) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "kai-suggestion-btn";
            const suggestionText = t(suggestion.textKey as any) || suggestion.textKey;
            btn.innerHTML = `${suggestion.iconHtml} <span>${suggestionText}</span>`;
            btn.title = suggestionText;
            btn.setAttribute("aria-label", suggestionText);

            btn.addEventListener("click", () => {
                btn.classList.add(suggestion.animationClass, "is-active");
                onSelect(suggestionText);

                window.setTimeout(() => {
                    btn.classList.remove(suggestion.animationClass, "is-active");
                }, 1800);
            });

            suggestionsWrapper.appendChild(btn);
        });

        suggestionsContainer.appendChild(suggestionsLabel);
        suggestionsContainer.appendChild(suggestionsHint);
        suggestionsContainer.appendChild(suggestionsWrapper);
        inputCardElement.insertBefore(suggestionsContainer, inputCardElement.firstChild);
    }
    // =========================================================================

    async onOpen() {
        const container = this.contentEl;
        container.empty();
        container.addClass('kai-chat-view');

        const header = container.createEl('div', { cls: 'kai-header' });
        const titleEl = header.createEl('h3');
        titleEl.textContent = 'Kai Intelligence ';
        titleEl.createEl('sup', { text: 'BETA', cls: 'kai-beta-badge' });
        header.createEl('p', { text: 'AirNote\'tan tanıdığın asistan', cls: 'kai-subtitle' });

        this.chatContainer = container.createEl('div', { cls: 'kai-messages' });

        const inputArea = container.createEl('div', { cls: 'kai-input-area' });
        const inputCard = inputArea.createEl('div', { cls: 'kai-input-card' });

        let sendMessage: () => Promise<void> = async () => {};

        // AI Önerilerini Render Et (Input Card'ın üst kısmına ekle)
        this.renderAISuggestions(inputCard, (suggestionText) => {
            this.inputField.value = `[${suggestionText}]: `;
            this.inputField.focus();
            const end = this.inputField.value.length;
            this.inputField.setSelectionRange(end, end);
            this.inputField.style.height = 'auto';
            this.inputField.style.height = Math.min(this.inputField.scrollHeight, 150) + 'px';
        });

        const attachmentPreview = inputCard.createEl('div', { cls: 'kai-attachment-preview' });
        attachmentPreview.style.display = 'none';

        this.inputField = inputCard.createEl('textarea', { 
            placeholder: t('chat_placeholder') || 'Kai ile konuş...',
            cls: 'kai-textarea',
            attr: { rows: "1" }
        });

        const updateSendButtonState = () => this.updateSendButtonState(this.sendButton);

        this.inputField.addEventListener('input', () => {
            this.inputField.style.height = 'auto';
            this.inputField.style.height = Math.min(this.inputField.scrollHeight, 150) + 'px';
            updateSendButtonState();
        });

        const inputFooter = inputCard.createEl('div', { cls: 'kai-input-footer' });
        const footerLeft = inputFooter.createEl('div', { cls: 'kai-footer-left' });
        const attachBtn = footerLeft.createEl('span', { cls: 'kai-icon-btn', attr: { title: "Dosya Ekle" } });
        setIcon(attachBtn, 'paperclip');
        
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/png, image/jpeg, image/webp, application/pdf';
        fileInput.style.display = 'none';

        attachBtn.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = (event.target?.result as string).split(',')[1] || "";
                if (!base64) {
                    new Notice("Dosya okunamadı.");
                    return;
                }

                this.currentAttachment = {
                    data: base64,
                    mimeType: file.type,
                    name: file.name
                };
                
                attachmentPreview.style.display = 'flex';
                attachmentPreview.innerHTML = `
                    <span class="kai-attachment-name" style="display: flex; align-items: center; gap: 4px;">
                        <strong>📎</strong> ${file.name}
                    </span>
                    <button class="kai-attachment-remove" style="cursor:pointer; border:none; background:none; color:var(--text-error);">✖</button>
                `;
                
                attachmentPreview.querySelector('.kai-attachment-remove')?.addEventListener('click', () => {
                    this.currentAttachment = null;
                    attachmentPreview.style.display = 'none';
                    fileInput.value = '';
                    updateSendButtonState();
                });
                updateSendButtonState();
            };
            reader.readAsDataURL(file);
        });
        footerLeft.appendChild(fileInput);
        
        const historyBtn = footerLeft.createEl('span', { cls: 'kai-icon-btn', attr: { title: "Sohbet Geçmişini Görüntüle" } });
        setIcon(historyBtn, 'history');
        historyBtn.addEventListener('click', () => {
            new KaiHistoryModal(this.plugin.app, this.geminiService.chatHistory).open();
        });

        const clearBtn = footerLeft.createEl('span', { cls: 'kai-icon-btn', attr: { title: "Bağlamı Sıfırla" } });
        setIcon(clearBtn, 'trash');
        clearBtn.addEventListener('click', async () => {
            await this.geminiService.clearHistory();
            this.chatContainer.empty();
            await this.appendMessage('model', t('history_cleared_msg') || 'Bağlam sıfırlandı. Yeni not üzerinde konuşmaya hazırız!');
            new Notice(t('history_cleared_notice') || "Kai: Geçmiş temizlendi.");
        });

        const footerRight = inputFooter.createEl('div', { cls: 'kai-footer-right' });
        const hintText = footerRight.createEl('span', { cls: 'kai-hint-text', text: 'Enter gönderir • Shift+Enter yeni satır' });
        // Options button: opens modal with AI response configuration
        const optionsBtn = footerLeft.createEl('span', { cls: 'kai-icon-btn', attr: { title: "AI Seçenekleri" } });
        setIcon(optionsBtn, 'sliders');
        optionsBtn.addEventListener('click', () => {
            new KaiOptionsModal(this.plugin.app, this.aiOptions, (newOpts) => {
                this.aiOptions = newOpts;
                new Notice(t('operation_success') || 'Options updated');
            }).open();
        });
        this.sendButton = footerRight.createEl('button', { cls: 'kai-send-btn' }) as HTMLButtonElement;
        this.sendButton.disabled = true;
        setIcon(this.sendButton, 'arrow-up');

        sendMessage = async () => {
            const text = this.inputField.value.trim();
            if (!text && !this.currentAttachment) return; 
            // Build prompt hints from AI options
            const lang = this.plugin.settings.language || 'en';
            const hints: string[] = [];
            // length
            if (this.aiOptions.length === 'short') {
                hints.push(lang === 'tr' ? 'Lütfen yanıtı kısa ve öz ver.' : 'Please answer briefly and concisely.');
            } else if (this.aiOptions.length === 'medium') {
                hints.push(lang === 'tr' ? 'Lütfen orta uzunlukta, yeterli detay ver.' : 'Please provide a medium-length, sufficiently detailed answer.');
            } else {
                hints.push(lang === 'tr' ? 'Lütfen ayrıntılı ve kapsamlı bir yanıt ver.' : 'Please provide a detailed and comprehensive answer.');
            }
            // tone
            if (this.aiOptions.tone === 'concise') {
                hints.push(lang === 'tr' ? 'Ton kısa ve öz olsun.' : 'Use a concise tone.');
            } else if (this.aiOptions.tone === 'detailed') {
                hints.push(lang === 'tr' ? 'Ton ayrıntılı ve açıklayıcı olsun.' : 'Use a detailed and explanatory tone.');
            }
            // format
            if (this.aiOptions.format === 'markdown') {
                hints.push(lang === 'tr' ? 'Çıktıyı Markdown formatında ver.' : 'Return the answer in Markdown format.');
            } else {
                hints.push(lang === 'tr' ? 'Çıktıyı düz metin olarak ver.' : 'Return the answer as plain text.');
            }
            // include sources hint (informational)
            if (this.aiOptions.includeSources) {
                hints.push(lang === 'tr' ? 'Mümkünse kaynakları göster.' : 'Include sources when available.');
            }

            const finalTextToSend = text ? `${hints.join(' ')}\n\n${text}` : hints.join(' ');

            const displayMessage = this.currentAttachment ? `[${this.currentAttachment.name}]\n${text}` : text;
            await this.appendMessage('user', displayMessage);
            this.inputField.value = '';
            
            const attachmentToSend = this.currentAttachment; 
            this.currentAttachment = null;
            attachmentPreview.style.display = 'none';
            fileInput.value = '';
            
            this.inputField.style.height = 'auto';
            updateSendButtonState();

            const loading = this.appendLoading();

            try {
                const response = await this.geminiService.processChatMessage(finalTextToSend, attachmentToSend || undefined);
                this.removeLoading(loading);
                await this.appendMessage('model', response.text, response.sources);
            } catch (error: any) {
                this.removeLoading(loading);
                await this.appendMessage('model', `❌ ${error.message || 'Bir hata oluştu.'}`);
            }
        };

        this.sendButton.addEventListener('click', sendMessage);
        updateSendButtonState();

        this.inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        await this.appendMessage('model', t('chat_welcome') || 'Merhaba, ben Kai. İstersen aktif notunun üzerinden konuşabilir veya bana yeni bir soru sorabilirsin. (Geçmiş konuşmalar sol alttaki saat ikonunda)');
    }

    async appendMessage(role: 'user' | 'model', content: string, sources: {title: string, uri: string}[] = []) {
        const messageEl = this.chatContainer.createEl('div', { cls: `kai-message ${role}` });
        const bubble = messageEl.createEl('div', { cls: `kai-bubble ${role === 'user' ? 'user-bubble' : 'model-bubble'}` });

        const bubbleMeta = bubble.createEl('div', { cls: 'kai-bubble-meta' });
        bubbleMeta.createEl('span', { text: role === 'user' ? 'Sen' : 'Kai' });
        bubbleMeta.createEl('span', { text: this.formatTimestamp() });

        const contentEl = bubble.createEl('div', { cls: 'kai-bubble-content' });

        if (role === 'user') {
            contentEl.textContent = content;
            
            const actions = messageEl.createEl('div', { cls: 'kai-msg-actions user-actions' });
            const editBtn = actions.createEl('button', { cls: 'kai-action-btn', attr: { title: t('btn_edit') || 'Düzenle' } });
            setIcon(editBtn, 'pencil');

            editBtn.addEventListener('click', async () => {
                let nextSibling = messageEl.nextElementSibling;
                while(nextSibling) {
                    const toRemove = nextSibling;
                    nextSibling = nextSibling.nextElementSibling;
                    toRemove.remove();
                }
                messageEl.remove();

                await this.geminiService.popHistoryUntil(content);
                this.inputField.value = content;
                this.inputField.focus();
                this.inputField.style.height = 'auto';
                this.inputField.style.height = Math.min(this.inputField.scrollHeight, 150) + 'px';
                this.updateSendButtonState(this.sendButton);
            });
            
        } else {
            try {
                await MarkdownRenderer.render(this.plugin.app, content, contentEl, '', this);
            } catch {
                contentEl.textContent = content;
            }

            const actions = messageEl.createEl('div', { cls: 'kai-msg-actions model-actions' });
            
            const copyBtn = actions.createEl('button', { cls: 'kai-action-btn', attr: { title: t('btn_copy') || 'Kopyala' } });
            setIcon(copyBtn, 'copy');
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(content);
                new Notice(t('msg_copied') || 'Panoya kopyalandı');
            });

            if (sources && sources.length > 0) {
                const sourceBtn = actions.createEl('button', { cls: 'kai-action-btn sources-btn', attr: { title: t('btn_sources') || 'Kaynaklar' } });
                setIcon(sourceBtn, 'globe');
                sourceBtn.createEl('span', { text: ` ${sources.length}` }); 
                
                sourceBtn.addEventListener('click', () => {
                    new KaiSourcesModal(this.plugin.app, sources).open();
                });
            }
        }

        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    appendLoading() {
        const loadingStr = this.plugin.settings.enableGoogleSearch 
            ? 'Kai interneti tarıyor' 
            : (t('chat_thinking') || 'Kai düşünüyor');

        const loadingContainer = this.chatContainer.createEl('div', { cls: 'kai-message model loading-wrapper' });
        
        loadingContainer.createEl('span', { text: loadingStr, cls: 'kai-loading-text' });
        
        const dots = loadingContainer.createEl('div', { cls: 'kai-typing-dots' });
        dots.createEl('span');
        dots.createEl('span');
        dots.createEl('span');
        
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
        return loadingContainer;
    }

    removeLoading(loadingEl: HTMLElement) {
        if (loadingEl && loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);
    }

    async onClose() { }
}