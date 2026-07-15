import { GoogleGenerativeAI, SchemaType, Tool, Part } from '@google/generative-ai';
import { App, MarkdownView, Notice, Editor } from 'obsidian';
import { KaiSettings } from './Settings';

export interface AttachmentData {
    data: string;
    mimeType: string;
    name: string;
}

export class GeminiService {
    private genAI: GoogleGenerativeAI | null = null;
    private app: App;
    private settings: KaiSettings;
    public chatHistory: any[] = [];
    private saveHistoryCallback: (history: any[]) => Promise<void>;
    
    private readonly MAX_HISTORY = 30; 
    private readonly MAX_NOTE_CHARS_TO_INJECT = 3000; 
    private readonly MAX_TOOL_ITERATIONS = 3;

    constructor(app: App, settings: KaiSettings, saveHistoryCallback: (history: any[]) => Promise<void>) {
        this.app = app;
        this.settings = settings;
        this.saveHistoryCallback = saveHistoryCallback;
        this.chatHistory = settings.chatHistory || [];
    }

    updateSettings(newSettings: KaiSettings) {
        this.settings = newSettings;
        this.genAI = new GoogleGenerativeAI(this.settings.apiKey);
    }

    public async clearHistory(): Promise<void> {
        this.chatHistory = [];
        await this.saveHistoryCallback(this.chatHistory);
    }

    private getSafeHistory(): any[] {
        const safeHistory: any[] = [];
        
        for (const msg of this.chatHistory) {
            const textContent = msg.parts?.map((p: any) => p.text || "").join("").trim();
            if (!textContent) continue;

            const lastMsg = safeHistory[safeHistory.length - 1];
            if (lastMsg && lastMsg.role === msg.role) {
                lastMsg.parts[0].text += `\n\n${textContent}`;
            } else {
                safeHistory.push({
                    role: msg.role === 'model' ? 'model' : 'user', 
                    parts: [{ text: textContent }]
                });
            }
        }
        
        if (safeHistory.length > 0 && safeHistory[0].role === 'model') {
            safeHistory.shift(); 
        }

        return safeHistory;
    }

    private getActiveMarkdownView(): MarkdownView | null {
        try {
            let activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (!activeView) {
                const markdownLeaves = this.app.workspace.getLeavesOfType("markdown");
                const firstLeaf = markdownLeaves[0];
                if (firstLeaf && firstLeaf.view) {
                    activeView = firstLeaf.view as MarkdownView;
                }
            }
            return activeView;
        } catch (error) {
            return null;
        }
    }

    private getObsidianTools(): Tool[] {
        return [{
            functionDeclarations: [
                {
                    name: "append_to_current_note",
                    description: "Kullanıcının o an açık olan notunun en sonuna yeni bir metin ekler.",
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: { textToAppend: { type: SchemaType.STRING, description: "Nota eklenecek olan metin." } },
                        required: ["textToAppend"]
                    }
                },
                {
                    name: "rewrite_current_note",
                    description: "Kullanıcının o an açık olan notunun içeriğini tamamen değiştirir.",
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: { newContent: { type: SchemaType.STRING, description: "Notun yeni tam içeriği." } },
                        required: ["newContent"]
                    }
                },
                {
                    name: "create_new_note",
                    description: "Obsidian kasasında yepyeni bir not dosyası oluşturur.",
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            title: { type: SchemaType.STRING, description: "Yeni notun başlığı." },
                            content: { type: SchemaType.STRING, description: "Yeni notun içeriği." }
                        },
                        required: ["title", "content"]
                    }
                }
            ]
        }];
    }

    private injectContext(userText: string, activeView: MarkdownView | null): string {
        if (!activeView) return userText;
        
        const noteContent = activeView.editor.getValue();
        const noteTitle = activeView.file?.basename || "İsimsiz Not";
        
        if (noteContent.length <= this.MAX_NOTE_CHARS_TO_INJECT) {
            return `[Bağlam - "${noteTitle}":\n---\n${noteContent}\n---]\n\nKullanıcı: ${userText}`;
        }

        const chunks = noteContent.split('\n\n').filter(c => c.trim().length > 0);
        const queryWords = userText.toLowerCase().replace(/[.,!?]/g, '').split(/\s+/).filter(w => w.length > 3);

        if (queryWords.length === 0) {
            const head = noteContent.substring(0, 1000);
            const tail = noteContent.substring(noteContent.length - 1000);
            return `[Bağlam (Özet) - "${noteTitle}":\n---\n${head}\n...\n${tail}\n---]\n\nKullanıcı: ${userText}`;
        }

        const scoredChunks = chunks.map(chunk => {
            const chunkLower = chunk.toLowerCase();
            const score = queryWords.reduce((acc, word) => chunkLower.includes(word) ? acc + 1 : acc, 0);
            return { chunk, score };
        }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);

        let ragContent = "";
        let currentLength = 0;
        for (const item of scoredChunks) {
            if (currentLength + item.chunk.length > this.MAX_NOTE_CHARS_TO_INJECT) break;
            ragContent += item.chunk + '\n\n...\n\n';
            currentLength += item.chunk.length;
        }

        return `[Bağlam (Alakalı Kısımlar) - "${noteTitle}":\n---\n${ragContent}\n---]\n\nKullanıcı: ${userText}`;
    }

    private async executeTool(call: any, activeView: MarkdownView | null): Promise<any> {
        try {
            if (call.name === "append_to_current_note") {
                if (activeView && call.args?.textToAppend) {
                    const editor = activeView.editor;
                    const currentLine = editor.lastLine();
                    editor.replaceRange(`\n\n${call.args.textToAppend}`, { line: currentLine, ch: editor.getLine(currentLine).length });
                    new Notice("Kai notunuza ekleme yaptı.");
                    return { success: true, message: "Metin nota başarıyla eklendi." };
                }
                return { error: "Aktif bir not bulunamadı veya eklenecek metin boş." };
            }
            
            if (call.name === "rewrite_current_note") {
                if (activeView && call.args?.newContent) {
                    activeView.editor.setValue(call.args.newContent);
                    new Notice("Kai notunuzu baştan yazdı.");
                    return { success: true, message: "Not başarıyla yeniden yazıldı." };
                }
                return { error: "Aktif bir not bulunamadı veya yeni içerik boş." };
            }
            
            if (call.name === "create_new_note") {
                if (call.args?.title && call.args?.content) {
                    const fileName = call.args.title.endsWith('.md') ? call.args.title : `${call.args.title}.md`;
                    if (this.app.vault.getAbstractFileByPath(fileName)) {
                        return { error: "Bu isimde bir not zaten var." };
                    }
                    await this.app.vault.create(fileName, call.args.content);
                    new Notice(`Kai yeni not oluşturdu: ${call.args.title}`);
                    return { success: true, message: `Oluşturuldu: ${fileName}` };
                }
                return { error: "Başlık veya içerik parametreleri eksik." };
            }

            return { error: "Bilinmeyen araç çağrısı." };
        } catch (error: any) {
            return { error: `Araç çalıştırılırken Obsidian tarafında hata oluştu: ${error.message}` };
        }
    }

    async processChatMessage(userText: string, attachment?: AttachmentData): Promise<string> {
        if (!this.settings.apiKey) throw new Error("Lütfen ayarlardan Gemini API anahtarını girin.");
        if (!this.genAI) this.genAI = new GoogleGenerativeAI(this.settings.apiKey);

        const activeView = this.getActiveMarkdownView();
        const finalMessageText = this.injectContext(userText, activeView);
        
        let finalPayload: string | Part[] = finalMessageText;
        if (attachment) {
            finalPayload = [
                { text: finalMessageText },
                { inlineData: { data: attachment.data, mimeType: attachment.mimeType } }
            ];
        }

        const tools: any[] = [...this.getObsidianTools()];

        if (this.settings.enableGoogleSearch) {
            tools.push({ googleSearch: {} });
        }
        
        tools.push({ codeExecution: {} }); 

        const model = this.genAI.getGenerativeModel({
            model: this.settings.model,
            systemInstruction: this.settings.systemPrompt,
            tools: tools,
            toolConfig: {
                includeServerSideToolInvocations: true
            } as any
        } as any);

        const chatSession = model.startChat({ history: this.getSafeHistory() });
        let response;
        
        try {
            response = await chatSession.sendMessage(finalPayload);
        } catch (error: any) {
            throw new Error(`Gemini API Hatası: ${error.message}`);
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
                throw new Error(`Araç geri bildirimi sırasında API Hatası: ${apiError.message}`);
            }
        }

        const rawHistory = await chatSession.getHistory();
        this.chatHistory = rawHistory.map(msg => ({
            role: msg.role,
            parts: msg.parts.map((p: any) => {
                if (p.inlineData) return { text: "\n[Kullanıcı bir dosya/görsel ekledi]" };
                return p;
            })
        }));
        
        if (this.chatHistory.length > this.MAX_HISTORY) {
            this.chatHistory = this.chatHistory.slice(this.chatHistory.length - this.MAX_HISTORY);
        }
        
        try {
            await this.saveHistoryCallback(this.chatHistory);
        } catch (saveError) {
            console.error("Kai: Geçmiş kaydedilirken bir hata oluştu.", saveError);
        }
        
        const responseText = response.response.text();
        if (responseText) return responseText;
        if (toolExecuted) return 'İşlem başarıyla tamamlandı.';
        return 'Cevap üretilemedi.';
    }

    async processSelectedText(editor: Editor, action: string, selectedText: string): Promise<void> {
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