# Kai Intelligence for Obsidian

Kai Intelligence is a powerful AI assistant plugin for Obsidian that brings conversational intelligence directly into your note-taking workflow. Built with the Google Gemini API, it helps you work with your notes more efficiently by offering context-aware chat, smart text actions, and autonomous note operations.

## Why use it?

Kai Intelligence is designed for users who want to move faster while staying in control of their knowledge base. Instead of switching tools constantly, you can interact with your notes directly inside Obsidian.

## Features

- Context-aware chat with the currently open note
- Smart text actions such as explain, fix, summarize, and translate
- Note automation including append, rewrite, and create new note
- Optional Google Search integration for up-to-date information
- Multi-language interface support including English, Turkish, Spanish, German, and French
- Conversation history management with easy context reset

## Requirements

- Obsidian
- A valid Gemini API key from Google AI Studio

## Installation

1. Download the latest release from the Releases section.
2. Make sure the package contains the required files: `main.js`, `manifest.json`, and `styles.css`.
3. Copy them into your Obsidian plugins folder:
   - `.obsidian/plugins/kai-intelligence/`
4. Reload Obsidian and enable the plugin from Settings → Community plugins.
5. Open the plugin settings and enter your Gemini API key.

## Configuration

You can customize the plugin through its settings panel:

- Gemini API key
- Model selection
- Google Search on/off
- Interface language
- Custom system prompt

## Usage

- Open Kai from the ribbon icon or the command palette.
- Start a conversation with your active note as context.
- Select text in the editor and use the context menu actions for fast editing workflows.
- Ask Kai to create a new note, rewrite existing content, or summarize selected text.

## Development

To build the plugin locally:

```bash
npm install
npm run build
```

For development mode with watch support:

```bash
npm run dev
```

## License

This project is licensed under the [GPL-3.0 License](LICENSE).