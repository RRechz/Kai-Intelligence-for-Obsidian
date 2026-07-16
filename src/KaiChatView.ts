import { ItemView, WorkspaceLeaf, MarkdownRenderer, Notice, setIcon, Modal, App } from 'obsidian';
import KaiIntelligencePlugin from './main';
import { GeminiService, AttachmentData, ChatResponse } from './GeminiService';
import { t } from './Language';

export const KAI_CHAT_VIEW_TYPE = "kai-chat-view";

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

export class KaiChatView extends ItemView {
    plugin: KaiIntelligencePlugin;
    geminiService: GeminiService;
    chatContainer!: HTMLElement;
    inputField!: HTMLTextAreaElement;
    currentAttachment: AttachmentData | null = null;

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

        const attachmentPreview = inputCard.createEl('div', { cls: 'kai-attachment-preview' });
        attachmentPreview.style.display = 'none';

        this.inputField = inputCard.createEl('textarea', { 
            placeholder: t('chat_placeholder') || 'Kai ile konuş...',
            cls: 'kai-textarea',
            attr: { rows: "1" }
        });

        this.inputField.addEventListener('input', () => {
            this.inputField.style.height = 'auto';
            this.inputField.style.height = Math.min(this.inputField.scrollHeight, 150) + 'px';
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
                });
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
        const sendButton = footerRight.createEl('button', { cls: 'kai-send-btn' });
        setIcon(sendButton, 'arrow-up');

        const sendMessage = async () => {
            const text = this.inputField.value.trim();
            if (!text && !this.currentAttachment) return; 

            const displayMessage = this.currentAttachment ? `[${this.currentAttachment.name}]\n${text}` : text;
            await this.appendMessage('user', displayMessage);
            this.inputField.value = '';
            
            const attachmentToSend = this.currentAttachment; 
            this.currentAttachment = null;
            attachmentPreview.style.display = 'none';
            fileInput.value = '';
            
            this.inputField.style.height = 'auto'; 

            const loading = this.appendLoading();

            try {
                const response = await this.geminiService.processChatMessage(text, attachmentToSend || undefined);
                this.removeLoading(loading);
                await this.appendMessage('model', response.text, response.sources);
            } catch (error: any) {
                this.removeLoading(loading);
                await this.appendMessage('model', `❌ ${error.message || 'Bir hata oluştu.'}`);
            }
        };

        sendButton.addEventListener('click', sendMessage);

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
        
        if (role === 'user') {
            messageEl.createEl('div', { cls: 'kai-bubble user-bubble', text: content });
            
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
            });
            
        } else {
            const contentEl = messageEl.createEl('div', { cls: 'kai-model-content' });
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