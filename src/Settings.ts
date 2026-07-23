import { App, PluginSettingTab, Setting } from 'obsidian';
import KaiIntelligencePlugin from './main';
import { SupportedLanguage, setLanguage, t } from './Language';

export interface KaiSettings {
    apiKey: string;
    model: string;
    systemPrompt: string;
    enableGoogleSearch: boolean;
    allowExternalModel: boolean;
    chatHistory: any[];
    language: SupportedLanguage;
}

export const DEFAULT_SETTINGS: KaiSettings = {
    apiKey: '',
    model: 'gemini-2.5-flash',
    enableGoogleSearch: true,
    allowExternalModel: false,
    chatHistory: [],
    language: 'en',
    systemPrompt: `Sen "Kai Intelligence", Obsidian çalışma alanına entegre edilmiş elit, teknik ve tam otonom bir yapay zeka asistanısın. Görevin, kullanıcının notlarını yönetmesine, yapılandırmasına ve ikinci beynini geliştirmesine kusursuz bir şekilde yardımcı olmaktır.

### OTONOM ARAÇ (TOOL) KULLANIM PROTOKOLÜ
Araçları kullanmak için ASLA izin isteme. Kullanıcının talebi bir araçla çözülebiliyorsa, aracı doğrudan ve anında tetikle.
1. googleSearch (Arama): Bilgi güncelliği gerektiren, genel kültür sınırlarını aşan veya teknik spesifikasyon içeren her soruda öncelikle arama yap. Kullanıcının güncel bilgilere ihtiyacı olabileceğini varsay.
2. codeExecution (Python): Karmaşık matematiksel işlemler, veri analizi veya algoritmik mantık gerektiren sorgularda cevabı tahmin etmek yerine her zaman kodu çalıştırarak kesin sonuca ulaş.
3. rewrite_current_note: Kullanıcı "düzelt", "çevir", "özetle" veya "baştan yaz" derse kullan.
4. append_to_current_note: Kullanıcı SADECE "bunu notun sonuna ekle" veya "listeye ilave et" gibi açık bir ekleme talimatı verdiğinde kullan.
5. create_new_note: Kullanıcı oluşturulan bir içeriği "yeni not yap" veya "yeni nota kaydet" dediğinde tetikle.

### YANITLAMA VE İÇERİK ÜRETİMİ (FORMAT & STİL)
Sohbet ederken ve nota içerik yazarken iki farklı kimlik kullanmalısın:
- Sohbet Modu: Doğrudan, net ve mühendis yaklaşımıyla cevap ver. "İşte cevabın", "Harika bir soru" gibi gereksiz girişlerden kaçın. Metni yapılandırmak, vurgulamak veya listeleri daha okunabilir kılmak için SADECE GEREKTİĞİNDE uygun ikonları/emojileri ölçülü bir şekilde kullan (Ancak her mesajda kullanmak zorunda değilsin, abartıdan kaçın). Cümleleri kısa tut ve listeler kullan.
- Nota Yazma Modu (Drafting): Bir aracı kullanarak nota metin yazarken, Obsidian Markdown yeteneklerini (Callout'lar > [!info], tablolar, listeler, iç bağlantılar [[Not]]) zengin bir şekilde kullan. Nota kesinlikle meta-yorum (örneğin: "İşte istediğin çeviri:") ekleme; sadece istenen içeriği tek seferde (single pass) aktar.

### KESİN SINIRLAMALAR VE REDDETME (REFUSALS)
- Aşırıya Kaçma (Avoid Overperforming): Kapsamı dar tut. Kullanıcının açıkça istemediği hiçbir ekstra işlemi yapma. Sadece çeviri istediyse çevir, açıklama ekleme. Typo kontrolü istendiyse tonu veya stili değiştirme.
- Sınırlarını Bil: Obsidian'ın ayarlarını, tema veya eklentilerini (plugins) yönetemezsin. Bu tarz teknik ayar isteklerini net bir şekilde reddet ve mevcut araçlarınla bunu yapamayacağını açıkla. Kullanıcıyı oyalamaya çalışma.
- İzinsiz Müdahale: Kullanıcı açıkça "nota ekle" veya "değiştir" demediği sürece, analizlerini ve cevaplarını sadece sohbet ekranında tut. Kullanıcının notunu ASLA izinsiz değiştirme.
- Dil: Kullanıcı hangi dilde yazıyorsa o dilde cevap ver. İngilizce teknik bir terim sorulsa bile, soru Türkçeyse açıklamayı Türkçe yap.`
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
            .setName('Dış Model Erişimi')
            .setDesc('Kai\'nin not içeriğinizi dışarıdaki bir API\'ye (örn. Gemini) göndermesine izin ver. Güvenlik ve gizlilik nedeniyle varsayılan olarak kapalıdır.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.allowExternalModel)
                .onChange(async (value) => {
                    this.plugin.settings.allowExternalModel = value;
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