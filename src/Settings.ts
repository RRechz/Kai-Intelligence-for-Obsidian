import { App, PluginSettingTab, Setting } from 'obsidian';
import KaiIntelligencePlugin from './main';
import { SupportedLanguage, setLanguage, t } from './Language';

export interface KaiSettings {
    apiKey: string;
    model: string;
    systemPrompt: string;
    enableGoogleSearch: boolean;
    chatHistory: any[];
    language: SupportedLanguage;
}

export const DEFAULT_SETTINGS: KaiSettings = {
    apiKey: '',
    model: 'gemini-2.5-flash',
    enableGoogleSearch: true,
    chatHistory: [],
    language: 'en',
    systemPrompt: `Sen "Kai Intelligence", Obsidian çalışma alanına entegre edilmiş elit ve teknik bir yapay zeka asistanısın. Görevin, kullanıcının notlarını yönetmesine, yapılandırmasına ve geliştirmesine kusursuz bir şekilde yardımcı olmaktır.

ARAÇ (TOOL) KULLANIM ALGORİTMASI VE KESİN KURALLAR:

1. SOHBET (Araçsız İşlem):
- Kullanıcı genel bir soru soruyorsa, kod istiyorsa veya fikir danışıyorsa hiçbir araç kullanma. Doğrudan, net ve Markdown formatında yanıt ver.

2. ÜZERİNE YAZMA / DEĞİŞTİRME (rewrite_current_note):
- Kullanıcı notu DÜZELTMENİ, ÇEVİRMENİ, ÖZETLEYİP KAYDETMENİ veya YENİDEN YAZMANI isterse kullanılır. Kendi bilgine göre bu işlemi gerçekleştir ve aracı çağırarak yeni metni nota aktar.

3. EKLEME (append_to_current_note):
- SADECE kullanıcı "bunu notun sonuna ekle", "nottaki listeye şunu da ilave et" gibi açıkça EKLEME talimatı verirse kullan.

4. YENİ NOT (create_new_note):
- Kullanıcı sohbet esnasında üretilen bir metni veya tabloyu "yeni not oluştur", "bunu yeni bir not olarak kaydet" diyerek kaydetmek isterse kullan. Başlık ve içeriği algılayarak dosyayı oluştur.

Yanıtlama Kuralları:
Gereksiz uzatmalardan ve "İşte cevabın" gibi girişlerden kaçın. Araç kullanarak bir işlemi tamamladığında kullanıcıya sadece "Not başarıyla güncellendi." veya "Yeni not oluşturuldu." şeklinde kısa bir onay ver.`
};

export class KaiSettingTab extends PluginSettingTab {
    plugin: KaiIntelligencePlugin;

    constructor(app: App, plugin: KaiIntelligencePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();
        
        containerEl.createEl('h2', {text: 'Kai Intelligence'});

        new Setting(containerEl)
            .setName(t('settings_language') || 'Language')
            .setDesc(t('settings_language_desc') || 'Select plugin language.')
            .addDropdown(dropdown => dropdown
                .addOption('en', 'English')
                .addOption('tr', 'Türkçe')
                .addOption('es', 'Español')
                .addOption('de', 'Deutsch')
                .addOption('fr', 'Français')
                .setValue(this.plugin.settings.language)
                .onChange(async (value: string) => {
                    const lang = value as SupportedLanguage;
                    this.plugin.settings.language = lang;
                    setLanguage(lang);
                    await this.plugin.saveSettings();
                    this.display();
                }));

        new Setting(containerEl)
            .setName(t('settings_api_key') || 'Gemini API Key')
            .setDesc(t('settings_api_key_desc') || 'Google AI Studio üzerinden aldığınız API anahtarını girin.')
            .addText(text => text
                .setPlaceholder('AIzaSy...')
                .setValue(this.plugin.settings.apiKey)
                .onChange(async (value) => {
                    this.plugin.settings.apiKey = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('settings_model') || 'Model')
            .setDesc(t('settings_model_desc') || 'Kullanılacak modeli seçin.')
            .addDropdown(dropdown => dropdown
                .addOption('gemini-2.5-flash-lite', 'Gemini 2.5 Lite (Hızlı Yanıtlar)')
                .addOption('gemini-2.5-flash', 'Gemini 2.5 (Dengeli Yanıtlar)')
                .addOption('gemini-3-flash-preview', 'Gemini 3 (En iyi yanıtlar, Güncel bilgiler)')
                .addOption('gemini-3.5-flash', 'Gemini 3.5 (En iyi yanıtlar, daha fazla bağlam)')
                .setValue(this.plugin.settings.model)
                .onChange(async (value) => {
                    this.plugin.settings.model = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Google Search Bağlantısı')
            .setDesc('Kai\'nin güncel bilgilere ulaşmak için internette arama yapmasına izin ver.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableGoogleSearch)
                .onChange(async (value) => {
                    this.plugin.settings.enableGoogleSearch = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Sistem Komutu (System Prompt)')
            .setDesc('Kai\'nin karakterini ve kurallarını belirleyen ana yönerge.')
            .addTextArea(text => {
                text.inputEl.style.width = '100%';
                text.inputEl.style.height = '150px';
                text.setValue(this.plugin.settings.systemPrompt)
                    .onChange(async (value) => {
                        this.plugin.settings.systemPrompt = value;
                        await this.plugin.saveSettings();
                    });
            });
    }
}