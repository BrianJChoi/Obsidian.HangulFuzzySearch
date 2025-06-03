"use strict";

// Simple test plugin
class HangulSearchPlugin {
    constructor(app, manifest) {
        this.app = app;
        this.manifest = manifest;
    }

    async onload() {
        console.log('Hangul Search Plugin: Starting to load...');
        
        // Add a simple command that should always work
        this.addCommand({
            id: 'test-hangul-plugin',
            name: 'Test Hangul Plugin - Hello World',
            callback: () => {
                new Notice('Hangul plugin is working!');
            }
        });

        console.log('Hangul Search Plugin: Basic command added');
        
        // Add the hangul quick switcher command
        this.addCommand({
            id: 'hangul-quick-switcher',
            name: 'Open Hangul Quick Switcher (Test)',
            callback: () => {
                new Notice('Hangul Quick Switcher clicked! (This is a test version)');
            }
        });

        console.log('Hangul Search Plugin: All commands loaded successfully');
    }

    onunload() {
        console.log('Hangul Search Plugin: Unloading...');
    }

    addCommand(command) {
        return this.app.commands.addCommand(command);
    }
}

// Make sure Notice is available
const { Notice } = require('obsidian');

module.exports = HangulSearchPlugin; 