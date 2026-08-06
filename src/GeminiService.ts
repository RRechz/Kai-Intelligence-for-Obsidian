import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { App, MarkdownView, Editor, Notice, Modal } from 'obsidian';
import { KaiSettings } from './Settings';

export interface AttachmentData {
    data: string;
    mimeType: string;
    name: string;
}

export interface ChatResponse {
    text: string;
    sources: { title: string; uri: string }[];
}

class KaiEditProposalModal extends Modal {
    private editor: Editor;
    private originalText: string;
    private proposedText: string;
    private actionName: string;
    private applyMode: 'selection' | 'full';

    constructor(app: App, editor: Editor, originalText: string, proposedText: string, actionName: string, applyMode: 'selection' | 'full') {
        super(app);
        this.editor = editor;
        this.originalText = originalText;
        this.proposedText = proposedText;
        this.actionName = actionName;
        this.applyMode = applyMode;
    }

    private escapeHtml(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    private buildDiffHtml(originalText: string, proposedText: string): { originalHtml: string; proposedHtml: string } {
        const originalLines = originalText.split('\n');
        const proposedLines = proposedText.split('\n');
        const lineCount = Math.max(originalLines.length, proposedLines.length);
        const originalHtml: string[] = [];
        const proposedHtml: string[] = [];

        for (let i = 0; i < lineCount; i++) {
            const originalLine = originalLines[i] ?? '';
            const proposedLine = proposedLines[i] ?? '';

            if (originalLine === proposedLine) {
                const sharedLine = `<div class="kai-diff-line">${this.escapeHtml(originalLine)}</div>`;
                originalHtml.push(sharedLine);
                proposedHtml.push(sharedLine);
                continue;
            }

            originalHtml.push(`<div class="kai-diff-removed">${this.escapeHtml(originalLine)}</div>`);
            proposedHtml.push(`<div class="kai-diff-added">${this.escapeHtml(proposedLine)}</div>`);
        }

        return {
            originalHtml: originalHtml.join(''),
            proposedHtml: proposedHtml.join('')
        };
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.setAttr('style', 'min-width: min(920px, 90vw); max-width: 1100px;');

        contentEl.createEl('h2', { text: `Kai: ${this.actionName} Önizlemesi` });
        contentEl.createEl('p', { text: 'Aşağıdaki değişiklikleri notta kullanmak için “Keep All” seçin. İsterseniz “Revert All” ile iptal edebilirsiniz.', attr: { style: 'margin-bottom: 12px; color: var(--text-muted);' } });

        const previewWrapper = contentEl.createEl('div', { attr: { style: 'display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px;' } });
        const originalPane = previewWrapper.createEl('div', { attr: { style: 'border: 1px solid var(--background-modifier-border); border-radius: 8px; padding: 10px; background: var(--background-secondary);' } });
        originalPane.createEl('div', { text: 'Önceki Metin', attr: { style: 'font-weight: 600; margin-bottom: 8px;' } });
        const originalPreview = originalPane.createEl('div', { attr: { style: 'white-space: pre-wrap; font-family: var(--font-monospace); font-size: 12px; max-height: 60vh; overflow: auto;' } });
        originalPreview.innerHTML = this.buildDiffHtml(this.originalText, this.proposedText).originalHtml;

        const proposedPane = previewWrapper.createEl('div', { attr: { style: 'border: 1px solid var(--background-modifier-border); border-radius: 8px; padding: 10px; background: var(--background-primary);' } });
        proposedPane.createEl('div', { text: 'Önerilen Metin', attr: { style: 'font-weight: 600; margin-bottom: 8px;' } });
        const proposedPreview = proposedPane.createEl('div', { attr: { style: 'white-space: pre-wrap; font-family: var(--font-monospace); font-size: 12px; max-height: 60vh; overflow: auto;' } });
        proposedPreview.innerHTML = this.buildDiffHtml(this.originalText, this.proposedText).proposedHtml;

        const buttonRow = contentEl.createEl('div', { attr: { style: 'display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px;' } });
        const keepButton = buttonRow.createEl('button', { text: 'Keep All', cls: 'mod-cta' });
        const revertButton = buttonRow.createEl('button', { text: 'Revert All' });

        keepButton.addEventListener('click', () => {
            if (this.applyMode === 'full') {
                this.editor.setValue(this.proposedText);
            } else {
                this.editor.replaceSelection(this.proposedText);
            }
            new Notice(`Kai: ${this.actionName} değişikliği uygulandı.`);
            this.close();
        });

        revertButton.addEventListener('click', () => {
            new Notice(`Kai: ${this.actionName} değişikliği iptal edildi.`);
            this.close();
        });
    }

    onClose() {
        this.contentEl.empty();
    }
}

export class GeminiService {
    app: App;
    settings: KaiSettings;
    genAI: GoogleGenerativeAI | null = null;
    chatHistory: any[] = [];
    MAX_HISTORY = 30;
    MAX_TOOL_ITERATIONS = 5;
    saveHistoryCallback: (history: any[]) => Promise<void>;

    constructor(app: App, settings: KaiSettings, saveHistoryCallback: (history: any[]) => Promise<void>) {
        this.app = app;
        this.settings = settings;
        this.chatHistory = settings.chatHistory || [];
        this.saveHistoryCallback = saveHistoryCallback;
        const normalizedApiKey = this.getNormalizedApiKey(this.settings.apiKey);
        this.settings.apiKey = normalizedApiKey;
        if (normalizedApiKey && this.settings.allowExternalModel) {
            this.genAI = new GoogleGenerativeAI(normalizedApiKey);
        }
    }

    private getNormalizedApiKey(value: string): string {
        return (value || '')
            .trim()
            .replace(/^Bearer\s+/i, '')
            .replace(/^['"]+|['"]+$/g, '');
    }

    private ensureValidApiKey(): string {
        const normalizedApiKey = this.getNormalizedApiKey(this.settings.apiKey);
        if (!normalizedApiKey) {
            throw new Error('API Key eksik.');
        }

        if (/^ya29\./i.test(normalizedApiKey) || /^eyJ/i.test(normalizedApiKey) || /access_token/i.test(normalizedApiKey)) {
            throw new Error('Bu değer bir OAuth erişim tokenı gibi görünüyor. Gemini için Google AI Studio üzerinden alınan gerçek API anahtarını kullanın.');
        }

        if (normalizedApiKey.startsWith('{') || normalizedApiKey.includes('client_email')) {
            throw new Error('Bu değer bir JSON kimlik bilgisi gibi görünüyor. Gemini için "AIza..." biçiminde bir API anahtarı gerekli.');
        }

        this.settings.apiKey = normalizedApiKey;
        return normalizedApiKey;
    }

    updateSettings(newSettings: KaiSettings) {
        this.settings = newSettings;
        const normalizedApiKey = this.getNormalizedApiKey(this.settings.apiKey);
        this.settings.apiKey = normalizedApiKey;
        if (normalizedApiKey && this.settings.allowExternalModel) {
            this.genAI = new GoogleGenerativeAI(normalizedApiKey);
        } else {
            this.genAI = null;
        }
    }

    getActiveMarkdownView(): MarkdownView | null {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView) {
            return activeView;
        }

        const markdownLeaves = this.app.workspace.getLeavesOfType('markdown');
        for (let i = markdownLeaves.length - 1; i >= 0; i--) {
            const leaf = markdownLeaves[i];
            if (!leaf) continue;
            if (leaf.view instanceof MarkdownView) {
                return leaf.view;
            }
        }

        return null;
    }

    public async popHistoryUntil(userText: string) {
        let targetIndex = -1;
        for (let i = this.chatHistory.length - 1; i >= 0; i--) {
            if (this.chatHistory[i].role === 'user' && this.chatHistory[i].parts[0].text === userText) {
                targetIndex = i;
                break;
            }
        }
        if (targetIndex !== -1) {
            this.chatHistory = this.chatHistory.slice(0, targetIndex);
            await this.saveHistoryCallback(this.chatHistory);
        }
    }

    async clearHistory() {
        this.chatHistory = [];
        await this.saveHistoryCallback(this.chatHistory);
    }

    getSafeHistory() {
        return this.chatHistory.map(msg => ({
            role: msg.role === 'model' ? 'model' : 'user',
            parts: msg.parts.map((p: any) => ({ text: p.text || "" }))
        }));
    }

    private getObsidianTools(): any[] {
        return [
            {
                functionDeclarations: [
                    {
                        name: "rewrite_current_note",
                        description: "Açık olan notun tüm içeriğini yeni metinle değiştirir.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                new_content: { type: "STRING", description: "Notun yeni Markdown içeriği." }
                            },
                            required: ["new_content"]
                        }
                    },
                    {
                        name: "append_to_current_note",
                        description: "Açık olan notun sonuna yeni metin ekler.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                added_content: { type: "STRING", description: "Eklenecek içerik." }
                            },
                            required: ["added_content"]
                        }
                    },
                    {
                        name: "create_new_note",
                        description: "Yeni bir Obsidian notu oluşturur.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                title: { type: "STRING", description: "Dosya adı (örn: Yeni Fikirler.md)" },
                                content: { type: "STRING", description: "Notun içeriği." }
                            },
                            required: ["title", "content"]
                        }
                    }
                ]
            }
        ];
    }

    private async executeTool(call: any, activeView: MarkdownView | null): Promise<any> {
        const args = call.args;
        try {
            if (call.name === "rewrite_current_note" && activeView) {
                activeView.editor.setValue(args.new_content);
                return { success: true, message: "Not baştan yazıldı." };
            } 
            else if (call.name === "append_to_current_note" && activeView) {
                const current = activeView.editor.getValue();
                activeView.editor.setValue(current + "\n\n" + args.added_content);
                return { success: true, message: "Nota eklendi." };
            } 
            else if (call.name === "create_new_note") {
                let fileName = args.title.endsWith('.md') ? args.title : `${args.title}.md`;
                let file = this.app.vault.getAbstractFileByPath(fileName);
                let counter = 1;
                while (file) {
                    const nameWithoutExt = fileName.replace('.md', '');
                    const newName = `${nameWithoutExt} (${counter}).md`;
                    file = this.app.vault.getAbstractFileByPath(newName);
                    if (!file) fileName = newName;
                    counter++;
                }
                await this.app.vault.create(fileName, args.content);
                return { success: true, message: "Not oluşturuldu." };
            }
            return { success: false, message: "Geçerli bir işlem bulunamadı veya aktif not yok." };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    private applyProposedText(editor: Editor, proposedText: string, applyMode: 'selection' | 'full') {
        if (applyMode === 'full') {
            editor.setValue(proposedText);
        } else {
            editor.replaceSelection(proposedText);
        }
    }

    private showEditProposal(editor: Editor, originalText: string, proposedText: string, actionName: string, applyMode: 'selection' | 'full') {
        new KaiEditProposalModal(this.app, editor, originalText, proposedText, actionName, applyMode).open();
    }

    private extractUrls(text: string): string[] {
        const matches = text.matchAll(/(https?:\/\/|www\.)[^\s<>'")]+/gi);
        const urls: string[] = [];

        for (const match of matches) {
            let url = match[0].replace(/[.,;:!?)]$/g, '').trim();
            if (url.startsWith('www.')) {
                url = `https://${url}`;
            }
            if (!urls.includes(url)) {
                urls.push(url);
            }
        }

        return urls;
    }

    private decodeHtmlEntities(value: string): string {
        return value
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/gi, "'")
            .replace(/&#x27;/gi, "'");
    }

    private extractTextFromHtml(html: string): string {
        const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, ' ');
        const withoutStyles = withoutScripts.replace(/<style[\s\S]*?<\/style>/gi, ' ');
        const withoutComments = withoutStyles.replace(/<!--[\s\S]*?-->/g, ' ');
        const plainText = withoutComments
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<(p|div|section|article|li|ul|ol|h[1-6]|tr|table|header|footer|main)\b[^>]*>/gi, '\n')
            .replace(/<[^>]+>/g, ' ');

        return this.decodeHtmlEntities(plainText)
            .replace(/\s+/g, ' ')
            .trim();
    }

    private async fetchUrlContent(url: string): Promise<{ title: string; content: string } | null> {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; Kai-Intelligence/1.0; +https://obsidian.md)'
                }
            });

            if (!response.ok) {
                return null;
            }

            const html = await response.text();
            const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            const title = this.decodeHtmlEntities((titleMatch?.[1] || url).replace(/\s+/g, ' ').trim());
            const content = this.extractTextFromHtml(html);

            return {
                title: title || url,
                content: content.slice(0, 8000)
            };
        } catch (error) {
            return null;
        }
    }

    private async buildUrlResearchContext(userText: string): Promise<string> {
        const urls = this.extractUrls(userText);
        if (urls.length === 0) {
            return '';
        }

        const urlSummaries: string[] = [];
        for (const url of urls) {
            const result = await this.fetchUrlContent(url);
            if (!result) {
                urlSummaries.push(`URL: ${url}\nDurum: Sayfa içeriği alınamadı.`);
                continue;
            }

            urlSummaries.push(`URL: ${url}\nBaşlık: ${result.title}\nİçerik Özeti:\n${result.content || 'İçerik bulunamadı.'}`);
        }

        return `Kullanıcı aşağıdaki URL'leri paylaştı. Aşağıdaki sayfa içeriklerini dikkate alarak cevap ver:\n\n${urlSummaries.join('\n\n')}`;
    }

    private injectContext(userText: string, activeView: MarkdownView | null): string {
        if (!activeView) return userText;
        const noteContent = activeView.editor.getValue();
        return `[Aktif Not Bağlamı:\n${noteContent}]\n\nKullanıcı Mesajı: ${userText}`;
    }

    private inferTaskAndStyle(userText: string, activeView: MarkdownView | null): { task: string; style: string } {
        const explicitTaskMatch = userText.match(/Task:\s*([a-zA-Z_]+)/i);
        const explicitStyleMatch = userText.match(/Style:\s*([a-zA-Z_]+)/i);
        const normalized = userText.toLowerCase();

        const explicitTask = explicitTaskMatch?.[1]?.toLowerCase();
        const explicitStyle = explicitStyleMatch?.[1]?.toLowerCase();

        if (explicitTask) {
            return { task: explicitTask, style: explicitStyle || this.settings.aiPreferences.preferredStyle || 'balanced' };
        }

        let inferredTask = 'general';
        let inferredStyle = this.settings.aiPreferences.preferredStyle || 'balanced';

        if (this.settings.aiPreferences.autoDetectTask) {
            if (/\b(özet|summary|kısa özet|kısaca|short summary|summarize|summary)\b/i.test(normalized)) {
                inferredTask = 'summarize';
            } else if (/\b(düzelt|fix|improve|rewrite|yeniden yaz|edit|geliştir|düzenle)\b/i.test(normalized)) {
                inferredTask = 'rewrite';
            } else if (/\b(açıkla|explain|neden|what is|what does|anlat|clarify|anlama)\b/i.test(normalized)) {
                inferredTask = 'explain';
            } else if (/\b(çevir|translate|translation|tercüme)\b/i.test(normalized)) {
                inferredTask = 'translate';
            } else if (/\b(fikir|brainstorm|idea|alternatif|options|seçenek)\b/i.test(normalized)) {
                inferredTask = 'brainstorm';
            } else if (activeView) {
                const noteContent = activeView.editor.getValue();
                const looksLikeCode = /```|^\s*(function|class|const|let|var|import|export|def|if|for|while|return)\b/m.test(noteContent);
                const isStructuredNote = /^\s{0,3}(#{1,6}\s|[-*]\s|\d+\.\s)/m.test(noteContent);
                if (looksLikeCode) {
                    inferredTask = 'explain';
                } else if (isStructuredNote && /\b(özet|kısa|ana|özetle|notu)\b/i.test(normalized)) {
                    inferredTask = 'summarize';
                }
            }
        }

        if (/\b(kısa|öz|brief|concise|short)\b/i.test(normalized)) {
            inferredStyle = 'brief';
        } else if (/\b(detaylı|detailed|ayrıntılı|kapsamlı|comprehensive|adım adım)\b/i.test(normalized)) {
            inferredStyle = 'detailed';
        } else if (/\b(yaratıcı|creative|ilham verici|inspirational)\b/i.test(normalized)) {
            inferredStyle = 'creative';
        }

        if (this.settings.aiPreferences.rememberPreferences && inferredTask === 'general' && this.settings.aiPreferences.preferredTask !== 'general') {
            inferredTask = this.settings.aiPreferences.preferredTask;
        }

        if (this.settings.aiPreferences.rememberPreferences && inferredStyle === this.settings.aiPreferences.preferredStyle && inferredStyle !== 'balanced') {
            inferredStyle = this.settings.aiPreferences.preferredStyle;
        }

        return { task: inferredTask, style: inferredStyle };
    }

    private buildBehaviorInstruction(task: string, style: string): string {
        const instructions: string[] = [];

        if (task === 'summarize') {
            instructions.push('Bu istekte önemli noktaları kısa, net ve yapılandırılmış şekilde özetle.');
        } else if (task === 'rewrite') {
            instructions.push('Bu istekte metni düzelt, akıcı hale getir ve gereksiz tekrarları kaldır.');
        } else if (task === 'explain') {
            instructions.push('Bu istekte konuyu anlaşılır bir şekilde açıkla ve gerekirse adım adım anlat.');
        } else if (task === 'translate') {
            instructions.push('Bu istekte metni doğru ve doğal bir şekilde hedef dile çevir.');
        } else if (task === 'brainstorm') {
            instructions.push('Bu istekte birkaç farklı seçenek veya fikir sun ve en iyi yaklaşımı vurgula.');
        }

        if (style === 'brief') {
            instructions.push('Cevabın kısa, öz ve doğrudan olsun.');
        } else if (style === 'detailed') {
            instructions.push('Cevabın ayrıntılı, açıklayıcı ve kapsamlı olsun.');
        } else if (style === 'creative') {
            instructions.push('Cevabın yaratıcı, ilham verici ve daha özgün bir ifade tarzında olsun.');
        } else {
            instructions.push('Cevabın dengeli, net ve kullanışlı olsun.');
        }

        return instructions.join(' ');
    }

    private getFileContextInstruction(activeView: MarkdownView | null, task: string): string {
        if (!activeView) return '';
        const noteContent = activeView.editor.getValue();
        if (!noteContent.trim()) return '';

        const looksLikeCode = /```|^\s*(function|class|const|let|var|import|export|def|if|for|while|return)\b/m.test(noteContent);
        const isStructuredNote = /^\s{0,3}(#{1,6}\s|[-*]\s|\d+\.\s)/m.test(noteContent);

        if (looksLikeCode) {
            return 'Aktif not teknik veya kod odaklı görünüyor; cevapta kısa açıklamalar, örnekler ve adım adım rehberlik kullan.';
        }
        if (isStructuredNote && (task === 'summarize' || task === 'rewrite')) {
            return 'Aktif not yapılandırılmış bir Markdown notu gibi görünüyor; cevabı başlıklar ve maddelerle sun.';
        }
        return 'Aktif notun bağlamını koruyarak cevap ver.';
    }

    private persistPreferredBehavior(task: string, style: string) {
        if (!this.settings.aiPreferences.rememberPreferences) return;
        if (task !== 'general') {
            this.settings.aiPreferences.preferredTask = task as any;
        }
        if (style !== 'balanced') {
            this.settings.aiPreferences.preferredStyle = style as any;
        }
        this.saveHistoryCallback(this.chatHistory).catch(() => undefined);
    }

    async processChatMessage(userText: string, attachment?: AttachmentData): Promise<ChatResponse> {
        if (!this.settings.allowExternalModel) throw new Error('Dış model erişimi kapalı. Ayarlar -> Dış Model Erişimi açın.');
        const normalizedApiKey = this.ensureValidApiKey();
        if (!this.genAI) this.genAI = new GoogleGenerativeAI(normalizedApiKey);

        const activeView = this.getActiveMarkdownView();
        const detectedBehavior = this.inferTaskAndStyle(userText, activeView);
        const behaviorInstruction = this.buildBehaviorInstruction(detectedBehavior.task, detectedBehavior.style);
        const fileInstruction = this.getFileContextInstruction(activeView, detectedBehavior.task);
        this.persistPreferredBehavior(detectedBehavior.task, detectedBehavior.style);

        const urlResearchContext = await this.buildUrlResearchContext(userText);
        let finalMessageText = this.injectContext(userText, activeView);
        if (urlResearchContext) {
            finalMessageText = `${urlResearchContext}\n\n${finalMessageText}`;
        }

        const extraInstructions = [behaviorInstruction, fileInstruction].filter(Boolean);
        if (extraInstructions.length > 0) {
            finalMessageText = `${extraInstructions.join('\n\n')}\n\n${finalMessageText}`;
        }

        // Eğer prompt bir YouTube isteği ise, sistem komutunu destekle
        if (userText.includes("[YouTube Video Analizi]:") || userText.includes("youtube.com/watch") || userText.includes("youtu.be/")) {
            finalMessageText += "\n\n(Sistem Notu: Kullanıcı bir YouTube videosunun analizini istiyor. Lütfen videonun transkriptini, ana hatlarını, önemli zaman damgalarını veya özetini çıkarmak için erişim araçlarını kullan.)";
        }
        
        let finalPayload: string | Part[] = finalMessageText;
        if (attachment) {
            finalPayload = [
                { text: finalMessageText },
                { inlineData: { data: attachment.data, mimeType: attachment.mimeType } }
            ];
        }

        const tools: any[] = [...this.getObsidianTools()];
        
        // Eğer ayarlar üzerinden arama aktifse Google Search tool'unu ekle
        if (this.settings.enableGoogleSearch) {
            tools.push({ googleSearch: {} }); 
        }
        
        // Kod çalıştırma desteği ekle.
        tools.push({ codeExecution: {} });

        const model = this.genAI.getGenerativeModel({
            model: this.settings.model,
            systemInstruction: this.settings.systemPrompt,
            tools: tools,
            toolConfig: {
                includeServerSideToolInvocations: true
            } as any
        });

        const chatSession = model.startChat({ history: this.getSafeHistory() });
        let response;
        
        try {
            response = await chatSession.sendMessage(finalPayload);
        } catch (error: any) {
            const message = error?.message || '';
            const lowerMessage = message.toLowerCase();
            if (lowerMessage.includes('401') || lowerMessage.includes('unauth') || lowerMessage.includes('auth')) {
                throw new Error('Kimlik doğrulama başarısız. Google AI Studio’dan aldığın gerçek Gemini API anahtarını kullandığından emin ol. Anahtarın "AIza..." biçiminde olması gerekir.');
            }
            throw new Error(`API Hatası: ${message}`);
        }
        
        let toolExecuted = false;
        let functionCalls = response.response.functionCalls();
        let iterationCount = 0; 
        
        while (functionCalls && functionCalls.length > 0) {
            if (iterationCount >= this.MAX_TOOL_ITERATIONS) break;
            iterationCount++;

            const call = functionCalls[0];
            if (!call) break;
            toolExecuted = true;

            const functionResult = await this.executeTool(call, activeView);

            try {
                response = await chatSession.sendMessage([{
                    functionResponse: { name: call.name, response: functionResult }
                }]);
                functionCalls = response.response.functionCalls();
            } catch (apiError: any) {
                throw new Error(`Araç Hatası: ${apiError.message}`);
            }
        }

        const rawHistory = await chatSession.getHistory();
        this.chatHistory = rawHistory.map(msg => ({
            role: msg.role,
            parts: msg.parts.map((p: any) => {
                if (p.inlineData) return { text: "\n[Kullanıcı dosya ekledi]" };
                return p;
            })
        }));
        
        if (this.chatHistory.length > this.MAX_HISTORY) {
            this.chatHistory = this.chatHistory.slice(this.chatHistory.length - this.MAX_HISTORY);
        }
        
        await this.saveHistoryCallback(this.chatHistory);
        
        const groundingMetadata = response.response.candidates?.[0]?.groundingMetadata;
        let extractedSources: { title: string, uri: string }[] = [];
        
        if (groundingMetadata?.groundingChunks) {
            extractedSources = groundingMetadata.groundingChunks.flatMap((chunk: any) => {
                const webSource = chunk.web || chunk.source || chunk;
                if (webSource && webSource.uri) {
                    return [{
                        title: webSource.title || webSource.uri,
                        uri: webSource.uri
                    }];
                }
                return [];
            });
        }

        const responseText = response.response.text();
        return {
            text: responseText || (toolExecuted ? 'İşlem tamamlandı.' : 'Cevap üretilemedi.'),
            sources: extractedSources
        };
    }

    async generateSelectionTransform(action: string, selectedText: string, outputFormat: string = 'replace', applyMode: 'selection' | 'full' = 'selection'): Promise<string> {
        if (!this.settings.allowExternalModel) {
            throw new Error('Dış model erişimi kapalı. Ayarlar -> Dış Model Erişimi açın.');
        }

        const normalizedApiKey = this.ensureValidApiKey();
        if (!this.genAI) this.genAI = new GoogleGenerativeAI(normalizedApiKey);

        const model = this.genAI.getGenerativeModel({
            model: this.settings.model,
            systemInstruction: "Sen profesyonel bir editör ve içerik düzenleyicisin. Sadece istenen işlemi yap, gereksiz açıklama ekleme ve sonucu net bir biçimde ver."
        });

        const sourceText = (selectedText || '').trim();
        const isFullMode = applyMode === 'full';
        const modeInstruction = isFullMode
            ? 'Sadece düzenlenmiş not içeriğini ver. Ekstra açıklama, başlık veya özet ekleme.'
            : 'Sadece verilen metnin dönüştürülmüş halini ver. Metnin dışına çıkma; ekstra açıklama ekleme.';

        let prompt = '';
        const normalizedOutput = outputFormat.toLowerCase();

        if (action === 'Düzelt') {
            prompt = `Aşağıdaki metnin dilbilgisini, noktalama işaretlerini ve akıcılığını düzelt. ${modeInstruction}\n\n${sourceText}`;
        } else if (action === 'Özetle') {
            prompt = `Aşağıdaki metni kısa ve net bir özet halinde yaz. ${modeInstruction}\n\n${sourceText}`;
        } else if (action === 'Çevir') {
            prompt = `Aşağıdaki metni doğal ve doğru bir şekilde hedef dile çevir. ${modeInstruction}\n\n${sourceText}`;
        } else if (action === 'Açıkla') {
            prompt = `Aşağıdaki metni anlaşılır, detaylı ve sade bir dille açıkla. ${modeInstruction}\n\n${sourceText}`;
        } else if (action === 'Kısalt') {
            prompt = `Aşağıdaki metni çok daha kısa, öz ve akıcı bir versiyona indir. ${modeInstruction}\n\n${sourceText}`;
        } else if (action === 'Resmileştir') {
            prompt = `Aşağıdaki metni daha resmi, profesyonel ve akıcı bir tona getir. ${modeInstruction}\n\n${sourceText}`;
        } else if (action === 'Maddeye Dönüştür') {
            prompt = `Aşağıdaki metni kısa madde maddeler halinde düzenle. ${modeInstruction}\n\n${sourceText}`;
        } else if (action === 'E-posta Haline Getir') {
            prompt = `Aşağıdaki metni kısa ve profesyonel bir e-posta metnine dönüştür. ${modeInstruction}\n\n${sourceText}`;
        } else if (action === 'Not Taslağına Dönüştür') {
            prompt = `Aşağıdaki metni temiz bir not taslağına dönüştür. Başlıklar, maddeler ve kısa açıklamalar kullan. ${modeInstruction}\n\n${sourceText}`;
        } else {
            prompt = `Aşağıdaki metni istenen şekilde düzenle. ${modeInstruction}\n\n${sourceText}`;
        }

        if (normalizedOutput === 'bullets') {
            prompt += '\n\nSonucu yalnızca madde listesi olarak ver.';
        } else if (normalizedOutput === 'markdown') {
            prompt += '\n\nSonucu Markdown formatında ver.';
        } else if (normalizedOutput === 'email') {
            prompt += '\n\nSonucu profesyonel bir e-posta metni olarak ver.';
        } else if (normalizedOutput === 'notes') {
            prompt += '\n\nSonucu kısa başlıklar ve maddelerle bir not taslağı şeklinde ver.';
        }

        const response = await model.generateContent(prompt);
        return response.response.text().trim();
    }

    async processSelectedText(editor: Editor, action: string, selectedText: string, outputFormat: string = 'replace', applyMode: 'selection' | 'full' = 'selection', showProposal: boolean = true): Promise<void> {
        try {
            const resultText = await this.generateSelectionTransform(action, selectedText, outputFormat, applyMode);
            if (!resultText) {
                return;
            }

            if (showProposal) {
                this.showEditProposal(editor, selectedText, resultText, action, applyMode);
            } else {
                this.applyProposedText(editor, resultText, applyMode);
                new Notice(`Kai: İşlem başarıyla tamamlandı (${action}).`);
            }
        } catch (error: any) {
            new Notice(`Kai Hatası: ${error.message || 'İşlem tamamlanamadı.'}`);
        }
    }
}