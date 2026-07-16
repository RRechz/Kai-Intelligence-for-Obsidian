export type SupportedLanguage = 'en' | 'tr' | 'es' | 'de' | 'fr';

export const translations = {
    en: {
        settings_language: "Language",
        settings_language_desc: "Select the plugin language.",
        settings_api_key: "Gemini API Key",
        settings_api_key_desc: "Get your API key from Google AI Studio.",
        settings_model: "Model",
        settings_model_desc: "Select the Gemini model to use.",
        chat_placeholder: "Talk to Kai...",
        chat_welcome: "Hello! I am Kai. How can I help you today? (Past conversations are in the clock icon at the bottom left)",
        chat_thinking: "Kai is thinking...",
        history_cleared_msg: "Context cleared. Ready to talk on a new note!",
        history_cleared_notice: "Kai: History cleared.",
        file_error: "Could not read file.",
        error_occurred: "An error occurred.",
        operation_success: "Operation completed successfully.",
        notice_appended: "Kai added text to your note.",
        notice_rewritten: "Kai rewrote your note.",
        notice_created: "Kai created a new note: {0}",
        api_missing: "Please enter your Gemini API key in settings.",
        menu_chat: "Kai: Chat about selection",
        menu_explain: "Kai: Explain",
        menu_fix: "Kai: Fix grammar",
        menu_summarize: "Kai: Summarize",
        menu_translate: "Kai: Translate (TR/EN)",
        btn_copy: "Copy",
        btn_edit: "Edit",
        btn_sources: "Web Sources",
        msg_copied: "Copied to clipboard",
        modal_sources_title: "Information Sources"
    },
    tr: {
        settings_language: "Dil",
        settings_language_desc: "Eklenti dilini seçin.",
        settings_api_key: "Gemini API Anahtarı",
        settings_api_key_desc: "Google AI Studio'dan API anahtarınızı alın.",
        settings_model: "Model",
        settings_model_desc: "Kullanılacak Gemini modelini seçin.",
        chat_placeholder: "Kai ile konuş...",
        chat_welcome: "Merhaba! Ben Kai. Bugün sana nasıl yardımcı olabilirim? (Geçmiş konuşmalar sol alttaki saat ikonunda)",
        chat_thinking: "Kai düşünüyor...",
        history_cleared_msg: "Bağlam sıfırlandı. Yeni not üzerinde konuşmaya hazırız!",
        history_cleared_notice: "Kai: Geçmiş temizlendi.",
        file_error: "Dosya okunamadı.",
        error_occurred: "Bir hata oluştu.",
        operation_success: "İşlem başarıyla tamamlandı.",
        notice_appended: "Kai notunuza ekleme yaptı.",
        notice_rewritten: "Kai notunuzu baştan yazdı.",
        notice_created: "Kai yeni not oluşturdu: {0}",
        api_missing: "Lütfen ayarlardan Gemini API anahtarını girin.",
        menu_chat: "Kai: Seçim Hakkında Sohbet Et",
        menu_explain: "Kai: Seçimi Açıkla",
        menu_fix: "Kai: Seçimi Düzelt",
        menu_summarize: "Kai: Seçimi Özetle",
        menu_translate: "Kai: Çevir (TR/EN)",
        btn_copy: "Kopyala",
        btn_edit: "Düzenle",
        btn_sources: "Kaynaklar",
        msg_copied: "Panoya kopyalandı",
        modal_sources_title: "İnternet Kaynakları"
    },
    es: {
        settings_language: "Idioma",
        settings_language_desc: "Seleccione el idioma del plugin.",
        settings_api_key: "Clave API de Gemini",
        settings_api_key_desc: "Obtenga su clave API de Google AI Studio.",
        settings_model: "Modelo",
        settings_model_desc: "Seleccione el modelo de Gemini a utilizar.",
        chat_placeholder: "Habla con Kai...",
        chat_welcome: "¡Hola! Soy Kai. ¿Cómo puedo ayudarte hoy? (Las conversaciones pasadas están en el icono del reloj abajo a la izquierda)",
        chat_thinking: "Kai está pensando...",
        history_cleared_msg: "Contexto borrado. ¡Listos para hablar sobre una nota nueva!",
        history_cleared_notice: "Kai: Historial borrado.",
        file_error: "No se pudo leer el archivo.",
        error_occurred: "Ocurrió un error.",
        operation_success: "Operación completada con éxito.",
        notice_appended: "Kai añadió texto a tu nota.",
        notice_rewritten: "Kai reescribió tu nota.",
        notice_created: "Kai creó una nueva nota: {0}",
        api_missing: "Por favor, introduzca su clave API de Gemini en la configuración."
    },
    de: {
        settings_language: "Sprache",
        settings_language_desc: "Wählen Sie die Plugin-Sprache.",
        settings_api_key: "Gemini API-Schlüssel",
        settings_api_key_desc: "Holen Sie sich Ihren API-Schlüssel von Google AI Studio.",
        settings_model: "Modell",
        settings_model_desc: "Wählen Sie das zu verwendende Gemini-Modell.",
        chat_placeholder: "Sprich mit Kai...",
        chat_welcome: "Hallo! Ich bin Kai. Wie kann ich dir heute helfen? (Vergangene Unterhaltungen findest du im Uhrensymbol unten links)",
        chat_thinking: "Kai denkt nach...",
        history_cleared_msg: "Kontext gelöscht. Bereit, über eine neue Notiz zu sprechen!",
        history_cleared_notice: "Kai: Verlauf gelöscht.",
        file_error: "Datei konnte nicht gelesen werden.",
        error_occurred: "Ein Fehler ist aufgetreten.",
        operation_success: "Vorgang erfolgreich abgeschlossen.",
        notice_appended: "Kai hat Text zu deiner Notiz hinzugefügt.",
        notice_rewritten: "Kai hat deine Notiz neu geschrieben.",
        notice_created: "Kai hat eine neue Notiz erstellt: {0}",
        api_missing: "Bitte geben Sie Ihren Gemini API-Schlüssel in den Einstellungen ein."
    },
    fr: {
        settings_language: "Langue",
        settings_language_desc: "Sélectionnez la langue du plugin.",
        settings_api_key: "Clé API Gemini",
        settings_api_key_desc: "Obtenez votre clé API depuis Google AI Studio.",
        settings_model: "Modèle",
        settings_model_desc: "Sélectionnez le modèle Gemini à utiliser.",
        chat_placeholder: "Parlez à Kai...",
        chat_welcome: "Bonjour ! Je suis Kai. Comment puis-je vous aider aujourd'hui ? (Les conversations passées se trouvent dans l'icône d'horloge en bas à gauche)",
        chat_thinking: "Kai réfléchit...",
        history_cleared_msg: "Contexte effacé. Prêt à parler d'une nouvelle note !",
        history_cleared_notice: "Kai : Historique effacé.",
        file_error: "Impossible de lire le fichier.",
        error_occurred: "Une erreur s'est produite.",
        operation_success: "Opération terminée avec succès.",
        notice_appended: "Kai a ajouté du texte à votre note.",
        notice_rewritten: "Kai a réécrit votre note.",
        notice_created: "Kai a créé une nouvelle note : {0}",
        api_missing: "Veuillez entrer votre clé API Gemini dans les paramètres."
    }
};

let currentLanguage: SupportedLanguage = 'en'; // Default language

export const setLanguage = (lang: SupportedLanguage) => {
    currentLanguage = lang;
};

export const t = (key: keyof typeof translations['en'], ...args: string[]): string => {
    let text = (translations as any)[currentLanguage]?.[key] || translations['en'][key] || key;
    args.forEach((arg, index) => {
        text = text.replace(`{${index}}`, arg);
    });
    return text;
};