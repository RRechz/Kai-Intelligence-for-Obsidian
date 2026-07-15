import { ItemView, WorkspaceLeaf, MarkdownRenderer, Notice, setIcon, Modal, App } from 'obsidian';
import KaiIntelligencePlugin from './main';
import { GeminiService, AttachmentData } from './GeminiService';

export const KAI_CHAT_VIEW_TYPE = "kai-chat-view";

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
            placeholder: 'Kai ile konuş...',
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
            await this.appendMessage('model', 'Bağlam sıfırlandı. Yeni not üzerinde konuşmaya hazırız!');
            new Notice("Kai: Geçmiş temizlendi.");
        });

        const footerRight = inputFooter.createEl('div', { cls: 'kai-footer-right' });
        footerRight.createEl('span', { text: 'Auto', cls: 'kai-mode-text' });
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
                await this.appendMessage('model', response);
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
        await this.appendMessage('model', 'Merhaba, ben Kai. İstersen aktif notunun üzerinden konuşabilir veya bana yeni bir soru sorabilirsin. (Geçmiş konuşmalar sol alttaki saat ikonunda)');
    }

    async appendMessage(role: 'user' | 'model', content: string) {
        const messageEl = this.chatContainer.createEl('div', { cls: `kai-message ${role}` });
        
        if (role === 'user') {
            messageEl.createEl('div', { cls: 'kai-bubble user-bubble', text: content });
        } else {
            const bubble = messageEl.createEl('div', { cls: 'kai-bubble model-bubble' });
            try {
                await MarkdownRenderer.render(this.plugin.app, content, bubble, '', this);
            } catch {
                bubble.textContent = content;
            }
        }

        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    appendLoading() {
        const loading = this.chatContainer.createEl('div', { 
            cls: 'kai-message model loading',
            text: 'Kai düşünüyor...'
        });
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
        return loading;
    }

    removeLoading(loadingEl: HTMLElement) {
        if (loadingEl && loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);
    }

    async onClose() { }
}