import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { App, MarkdownView, Editor, Notice } from 'obsidian';
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
        if (this.settings.apiKey && this.settings.allowExternalModel) {
            this.genAI = new GoogleGenerativeAI(this.settings.apiKey);
        }
    }

    updateSettings(newSettings: KaiSettings) {
        this.settings = newSettings;
        if (this.settings.apiKey && this.settings.allowExternalModel) {
            this.genAI = new GoogleGenerativeAI(this.settings.apiKey);
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

    private injectContext(userText: string, activeView: MarkdownView | null): string {
        if (!activeView) return userText;
        const noteContent = activeView.editor.getValue();
        return `[Aktif Not Bağlamı:\n${noteContent}]\n\nKullanıcı Mesajı: ${userText}`;
    }

    private buildBehaviorInstruction(userText: string): string {
        const taskMatch = userText.match(/Task:\s*([a-zA-Z_]+)/i);
        const styleMatch = userText.match(/Style:\s*([a-zA-Z_]+)/i);

        const task = taskMatch?.[1]?.toLowerCase();
        const style = styleMatch?.[1]?.toLowerCase();

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

        if (style === 'brief' || style === 'concise') {
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

    async processChatMessage(userText: string, attachment?: AttachmentData): Promise<ChatResponse> {
        if (!this.settings.allowExternalModel) throw new Error('Dış model erişimi kapalı. Ayarlar -> Dış Model Erişimi açın.');
        if (!this.settings.apiKey) throw new Error("API Key eksik.");
        if (!this.genAI) this.genAI = new GoogleGenerativeAI(this.settings.apiKey);

        const activeView = this.getActiveMarkdownView();
        const behaviorInstruction = this.buildBehaviorInstruction(userText);
        let finalMessageText = this.injectContext(userText, activeView);
        if (behaviorInstruction) {
            finalMessageText = `${behaviorInstruction}\n\n${finalMessageText}`;
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
            throw new Error(`API Hatası: ${error.message}`);
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

    async processSelectedText(editor: Editor, action: string, selectedText: string): Promise<void> {
        if (!this.settings.allowExternalModel) {
            new Notice("Kai: Dış model erişimi ayarlarda devre dışı. Lütfen Settings -> Dış Model Erişimi'ni açın.");
            return;
        }

        if (!this.settings.apiKey) {
            new Notice("Kai: Lütfen ayarlardan Gemini API anahtarını girin.");
            return;
        }

        if (!this.genAI) this.genAI = new GoogleGenerativeAI(this.settings.apiKey);

        const model = this.genAI.getGenerativeModel({
            model: this.settings.model,
            systemInstruction: "Sen profesyonel bir editörsün. Sadece istenen işlemi yap ve gereksiz açıklama ekleme. Markdown formatını koru."
        });

        let prompt = "";
        if (action === "Düzelt") prompt = `Aşağıdaki metnin dilbilgisini, noktalama işaretlerini ve akıcılığını düzelt, Markdown formatını bozma:\n\n${selectedText}`;
        else if (action === "Özetle") prompt = `Aşağıdaki metni kısaca özetle:\n\n${selectedText}`;
        else if (action === "Çevir") prompt = `Aşağıdaki metin Türkçeyse İngilizceye, İngilizceyse Türkçeye (veya uygun şekilde) çevir:\n\n${selectedText}`;
        else if (action === "Açıkla") prompt = `Aşağıdaki metni karmaşık terimlerden arındırarak, detaylı ama anlaşılır bir dille açıkla:\n\n${selectedText}`;

        try {
            const response = await model.generateContent(prompt);
            const resultText = response.response.text();

            if (resultText) {
                if (action === "Düzelt") {
                    editor.replaceSelection(resultText);
                } else {
                    editor.replaceSelection(`${selectedText}\n\n**Kai (${action}):**\n${resultText}`);
                }
                new Notice(`Kai: İşlem başarıyla tamamlandı (${action}).`);
            }
        } catch (error: any) {
            new Notice(`Kai Hatası: İşlem tamamlanamadı.`);
        }
    }
}