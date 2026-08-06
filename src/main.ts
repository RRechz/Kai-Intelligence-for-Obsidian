import { Plugin, WorkspaceLeaf, MarkdownView } from 'obsidian';
import { KaiSettings, DEFAULT_SETTINGS, KaiSettingTab } from './Settings';
import { KaiChatView, KAI_CHAT_VIEW_TYPE } from './KaiChatView';
import { GeminiService } from './GeminiService';
import { setLanguage, t } from './Language';

export default class KaiIntelligencePlugin extends Plugin {
    settings!: KaiSettings;
    geminiService!: GeminiService;

    async onload() {
        await this.loadSettings();
        
        this.geminiService = new GeminiService(this.app, this.settings, async (newHistory) => {
            this.settings.chatHistory = newHistory;
            await this.saveData(this.settings);
        });

        this.registerView(
            KAI_CHAT_VIEW_TYPE,
            (leaf) => new KaiChatView(leaf, this)
        );

        this.addRibbonIcon('bot', 'Open Kai Intelligence', () => {
            this.activateChatView();
        });

        this.addCommand({
            id: 'open-kai-chat',
            name: 'Kai Intelligence Sohbetini Aç',
            callback: () => {
                this.activateChatView();
            }
        });

        this.addCommand({
            id: 'kai-summarize-selection',
            name: 'Kai: Seçimi Özetle',
            callback: async () => {
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (!view) return;
                const editor = view.editor;
                const selection = editor.getSelection();
                if (!selection) return;
                await this.geminiService.processSelectedText(editor, 'Özetle', selection);
            }
        });

        this.addCommand({
            id: 'kai-fix-selection',
            name: 'Kai: Seçimi Düzelt',
            callback: async () => {
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (!view) return;
                const editor = view.editor;
                const selection = editor.getSelection();
                if (!selection) return;
                await this.geminiService.processSelectedText(editor, 'Düzelt', selection);
            }
        });

        this.addCommand({
            id: 'kai-propose-note-edit',
            name: 'Kai: Notu Düzenle (Öneri)',
            callback: async () => {
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (!view) return;
                const editor = view.editor;
                const noteText = editor.getValue();
                if (!noteText.trim()) return;
                await this.geminiService.processSelectedText(editor, 'Düzelt', noteText, 'replace', 'full');
            }
        });

        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu, editor, view) => {
                const selection = editor.getSelection();
                if (selection) {
                    menu.addSeparator(); 
                    menu.addItem((item) => {
                        item
                            .setTitle(t('menu_chat') || 'Kai: Seçimle Sohbet Et')
                            .setIcon('message-circle')
                            .onClick(async () => {
                                const leaf = await this.activateChatView();
                                if (leaf && leaf.view instanceof KaiChatView) {
                                    leaf.view.setContextAndFocus(selection);
                                }
                            });
                    });
                    
                    menu.addSeparator();

                    const createSelectionAction = (title: string, icon: string, action: string, outputFormat: string = 'replace') => {
                        menu.addItem((item) => {
                            item
                                .setTitle(title)
                                .setIcon(icon)
                                .onClick(() => this.geminiService.processSelectedText(editor, action, selection, outputFormat));
                        });
                    };

                    createSelectionAction(t('menu_explain') || 'Kai: Açıkla', 'book-open', 'Açıkla');
                    createSelectionAction(t('menu_fix') || 'Kai: Düzelt', 'wand-2', 'Düzelt');
                    createSelectionAction(t('menu_summarize') || 'Kai: Özetle', 'list', 'Özetle');
                    createSelectionAction(t('menu_translate') || 'Kai: Çevir', 'languages', 'Çevir');
                    createSelectionAction('Kai: Kısalt', 'chevrons-down', 'Kısalt');
                    createSelectionAction('Kai: Resmileştir', 'sparkles', 'Resmileştir');
                    createSelectionAction('Kai: Maddeye Dönüştür', 'list-plus', 'Maddeye Dönüştür', 'bullets');
                    createSelectionAction('Kai: E-posta Haline Getir', 'mail', 'E-posta Haline Getir', 'email');
                    createSelectionAction('Kai: Not Taslağına Dönüştür', 'file-text', 'Not Taslağına Dönüştür', 'notes');
                }

                menu.addSeparator();
                menu.addItem((item) => {
                    item
                        .setTitle('Kai: Notu Düzenle (Öneri)')
                        .setIcon('sparkles')
                        .onClick(async () => {
                            const noteView = this.app.workspace.getActiveViewOfType(MarkdownView);
                            if (!noteView) return;
                            const noteEditor = noteView.editor;
                            const fullText = noteEditor.getValue();
                            if (!fullText.trim()) return;
                            await this.geminiService.processSelectedText(noteEditor, 'Düzelt', fullText, 'replace', 'full');
                        });
                });
            })
        );

        this.addSettingTab(new KaiSettingTab(this.app, this));
    }

    async activateChatView(): Promise<WorkspaceLeaf | null> {
        const { workspace } = this.app;
        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(KAI_CHAT_VIEW_TYPE);
        
        if (leaves.length > 0) {
            leaf = leaves[0] || null; 
        } else {
            leaf = workspace.getRightLeaf(false);
            if(leaf) {
                await leaf.setViewState({ type: KAI_CHAT_VIEW_TYPE, active: true });
            }
        }
        
        if (leaf) workspace.revealLeaf(leaf);
        return leaf;
    }

    onunload() {
        this.app.workspace.detachLeavesOfType(KAI_CHAT_VIEW_TYPE);
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        setLanguage(this.settings.language);
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.geminiService.updateSettings(this.settings);
    }
}
