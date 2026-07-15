import { Plugin, WorkspaceLeaf } from 'obsidian';
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

                    // 2. Explain
                    menu.addItem((item) => {
                        item
                            .setTitle(t('menu_explain') || 'Kai: Açıkla')
                            .setIcon('book-open')
                            .onClick(() => this.geminiService.processSelectedText(editor, 'Açıkla', selection));
                    });

                    // 3. Fix
                    menu.addItem((item) => {
                        item
                            .setTitle(t('menu_fix') || 'Kai: Düzelt')
                            .setIcon('wand-2')
                            .onClick(() => this.geminiService.processSelectedText(editor, 'Düzelt', selection));
                    });

                    // 4. Summarize
                    menu.addItem((item) => {
                        item
                            .setTitle(t('menu_summarize') || 'Kai: Özetle')
                            .setIcon('list')
                            .onClick(() => this.geminiService.processSelectedText(editor, 'Özetle', selection));
                    });

                    // 5. Translate
                    menu.addItem((item) => {
                        item
                            .setTitle(t('menu_translate') || 'Kai: Çevir')
                            .setIcon('languages')
                            .onClick(() => this.geminiService.processSelectedText(editor, 'Çevir', selection));
                    });
                }
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
